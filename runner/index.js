import { buildRunnerFiles } from "./templates.js";

const JUDGE0_URL = String(process.env.JUDGE0_URL || "https://ce.judge0.com").replace(/\/+$/, "");
const JUDGE0_TIMEOUT_MS = Number(process.env.JUDGE0_TIMEOUT_MS || process.env.RUNNER_TIMEOUT_MS || 45000);
const JUDGE0_AUTH_TOKEN = String(process.env.JUDGE0_AUTH_TOKEN || "").trim();
const JUDGE0_AUTH_USER = String(process.env.JUDGE0_AUTH_USER || "").trim();
const JUDGE0_LANGUAGE_IDS = Object.freeze({
  javascript: Number(process.env.JUDGE0_LANGUAGE_ID_JAVASCRIPT || 63),
  python: Number(process.env.JUDGE0_LANGUAGE_ID_PYTHON || 71),
  java: Number(process.env.JUDGE0_LANGUAGE_ID_JAVA || 62),
});

function makeHttpError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function isDirectJudge0Payload(payload) {
  return Boolean(
    payload
      && typeof payload === "object"
      && typeof payload.code === "string"
      && payload.code.trim()
      && Number.isFinite(Number(payload.language_id)),
  );
}

function validatePayload(payload) {
  if (!payload || typeof payload !== "object") {
    throw makeHttpError("Request payload is required.");
  }

  const { language, sourceCode, fnName, testCases } = payload;

  if (!["javascript", "python", "java"].includes(language)) {
    throw makeHttpError("Unsupported language.");
  }

  if (!Number.isFinite(JUDGE0_LANGUAGE_IDS[language])) {
    throw makeHttpError(`Judge0 language id is not configured for "${language}".`, 500);
  }

  if (typeof sourceCode !== "string" || !sourceCode.trim()) {
    throw makeHttpError("Source code is required.");
  }

  if (typeof fnName !== "string" || !fnName.trim()) {
    throw makeHttpError("Function name is required.");
  }

  if (!Array.isArray(testCases) || testCases.length === 0) {
    throw makeHttpError("At least one test case is required.");
  }
}

function replaceOrThrow(source, searchValue, replaceValue, language) {
  const updated = source.replace(searchValue, replaceValue);
  if (updated === source) {
    throw makeHttpError(`Unable to prepare ${language} code for Judge0 execution.`, 500);
  }

  return updated;
}

function buildExecutionSource(payload) {
  const runner = buildRunnerFiles(payload);
  const mainFile = Array.isArray(runner.files) ? runner.files[0] : null;

  if (!mainFile?.content) {
    throw makeHttpError("Runner source was not generated.", 500);
  }

  if (payload.language === "javascript") {
    return replaceOrThrow(
      mainFile.content,
      'require("node:fs").writeFileSync("results.json", JSON.stringify({ tests }, null, 2));',
      'process.stdout.write(JSON.stringify({ tests }));',
      "javascript",
    );
  }

  if (payload.language === "python") {
    return replaceOrThrow(
      mainFile.content,
      /with open\("results\.json", "w", encoding="utf-8"\) as file:\n\s+json\.dump\(\{"tests": tests\}, file, indent=2\)/,
      'print(json.dumps({"tests": tests}, separators=(",", ":")))',
      "python",
    );
  }

  if (payload.language === "java") {
    return replaceOrThrow(
      mainFile.content,
      'Files.writeString(Path.of("results.json"), "{\\"tests\\":[" + String.join(",", tests) + "]}");',
      'System.out.print("{\\"tests\\":[" + String.join(",", tests) + "]}");',
      "java",
    );
  }

  return mainFile.content;
}

function buildJudge0Headers() {
  const headers = {
    "Content-Type": "application/json",
  };

  if (JUDGE0_AUTH_TOKEN) {
    headers["X-Auth-Token"] = JUDGE0_AUTH_TOKEN;
  }

  if (JUDGE0_AUTH_USER) {
    headers["X-Auth-User"] = JUDGE0_AUTH_USER;
  }

  return headers;
}

async function postToJudge0({ sourceCode, languageId, stdin = "" }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), JUDGE0_TIMEOUT_MS);

  try {
    const response = await fetch(`${JUDGE0_URL}/submissions?base64_encoded=false&wait=true`, {
      method: "POST",
      headers: buildJudge0Headers(),
      body: JSON.stringify({
        source_code: sourceCode,
        language_id: languageId,
        stdin,
      }),
      signal: controller.signal,
    });

    const text = await response.text();
    const data = text ? safeJsonParse(text) : {};

    if (!data) {
      throw makeHttpError("Judge0 returned invalid JSON.", 502);
    }

    if (!response.ok) {
      throw makeHttpError(
        data.error || data.message || `Judge0 request failed with status ${response.status}.`,
        response.status >= 400 && response.status < 600 ? response.status : 502,
      );
    }

    return data;
  } catch (error) {
    if (error.name === "AbortError") {
      throw makeHttpError("Judge0 execution timed out.", 504);
    }

    if (error.statusCode) {
      throw error;
    }

    throw makeHttpError(error.message || "Unable to reach Judge0.", 502);
  } finally {
    clearTimeout(timer);
  }
}

function formatRuntime(data) {
  const seconds = Number(data?.time);
  if (!Number.isFinite(seconds)) {
    return "N/A";
  }

  return `${Math.max(1, Math.round(seconds * 1000))} ms`;
}

function formatMemory(data) {
  const memory = Number(data?.memory);
  if (!Number.isFinite(memory)) {
    return "N/A";
  }

  return `${memory} KB`;
}

function extractJudge0Failure(data) {
  return [
    data?.compile_output,
    data?.stderr,
    data?.message,
    data?.status?.description,
  ]
    .map((value) => String(value || "").trim())
    .find(Boolean) || "Execution failed.";
}

function normalizeExecutionResult(parsed, execution) {
  const tests = Array.isArray(parsed?.tests) ? parsed.tests : null;

  if (!tests) {
    throw makeHttpError(extractJudge0Failure(execution), 400);
  }

  const passed = tests.every((test) => test.status === "pass");

  return {
    passed,
    status: passed ? "passed" : "failed",
    tests,
    runtime: formatRuntime(execution),
    memory: formatMemory(execution),
    beats: "N/A",
    stderr: [execution?.stderr, execution?.compile_output].map((value) => String(value || "").trim()).filter(Boolean).join("\n"),
  };
}

export async function runSubmission(payload) {
  if (isDirectJudge0Payload(payload)) {
    return postToJudge0({
      sourceCode: payload.code,
      languageId: Number(payload.language_id),
      stdin: payload.input || "",
    });
  }

  validatePayload(payload);

  const execution = await postToJudge0({
    sourceCode: buildExecutionSource(payload),
    languageId: JUDGE0_LANGUAGE_IDS[payload.language],
    stdin: payload.input || payload.stdin || payload.customInput || "",
  });
  const parsed = safeJsonParse(String(execution.stdout || "").trim());

  return normalizeExecutionResult(parsed, execution);
}
