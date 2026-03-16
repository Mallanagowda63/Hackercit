import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { buildRunnerFiles } from "./templates.js";

const DOCKER_TIMEOUT_MS = Number(process.env.DOCKER_TIMEOUT_MS || 30000);
const MEMORY_LIMIT = "128m";
const CPU_LIMIT = "0.5";

function makeHttpError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function validatePayload(payload) {
  if (!payload || typeof payload !== "object") {
    throw makeHttpError("Request payload is required.");
  }

  const { language, sourceCode, fnName, testCases } = payload;

  if (!["javascript", "python", "java"].includes(language)) {
    throw makeHttpError("Unsupported language.");
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

function normalizeVolumePath(filePath) {
  return filePath.replace(/\\/g, "/");
}

function executeDocker({ image, command, workingDir }) {
  return new Promise((resolve, reject) => {
    const args = [
      "run",
      "--rm",
      "--network",
      "none",
      "--memory",
      MEMORY_LIMIT,
      "--cpus",
      CPU_LIMIT,
      "-v",
      `${normalizeVolumePath(workingDir)}:/workspace`,
      "-w",
      "/workspace",
      image,
      ...command,
    ];

    const child = spawn("docker", args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill();
      reject(makeHttpError("Execution timed out.", 408));
    }, DOCKER_TIMEOUT_MS);

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      clearTimeout(timer);
      if (settled) return;
      settled = true;

      if (error.code === "ENOENT") {
        reject(makeHttpError("Docker is not installed or not available in PATH.", 500));
        return;
      }

      reject(makeHttpError(error.message || "Failed to start Docker.", 500));
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      if (settled) return;
      settled = true;

      resolve({ code, stdout, stderr });
    });
  });
}

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export async function runSubmission(payload) {
  validatePayload(payload);

  const tempRoot = join(os.tmpdir(), "codearena");
  await mkdir(tempRoot, { recursive: true });
  const workingDir = await mkdtemp(join(tempRoot, "run-"));

  try {
    const runner = buildRunnerFiles(payload);

    await Promise.all(
      runner.files.map((file) => writeFile(join(workingDir, file.name), file.content, "utf8")),
    );

    const startedAt = Date.now();
    const execution = await executeDocker({
      image: runner.image,
      command: runner.command,
      workingDir,
    });
    const runtime = `${Date.now() - startedAt} ms`;

    const outputFile = join(workingDir, "results.json");
    let parsed = null;

    if (execution.code === 0) {
      const fileText = await readFile(outputFile, "utf8");
      parsed = safeJsonParse(fileText);
    }

    if (!parsed) {
      throw makeHttpError(
        execution.stderr.trim() || execution.stdout.trim() || "Runner did not produce valid results.",
        400,
      );
    }

    return {
      passed: parsed.tests.every((test) => test.status === "pass"),
      status: parsed.tests.every((test) => test.status === "pass") ? "passed" : "failed",
      tests: parsed.tests,
      runtime,
      memory: "Docker-limited",
      beats: "N/A",
      stderr: execution.stderr.trim(),
    };
  } finally {
    await rm(workingDir, { recursive: true, force: true });
  }
}
