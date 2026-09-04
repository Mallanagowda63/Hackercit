const { useState, useRef, useEffect } = React;

const API_HOST = window.location.hostname || "127.0.0.1";
const LOCAL_API_PROTOCOL = window.location.protocol === "https:" ? "https:" : "http:";
const LOCAL_BACKEND_API_BASE = `${LOCAL_API_PROTOCOL}//${API_HOST}:4000`;
const CONFIGURED_BACKEND_API_BASE_RAW = (
  window.__CODEARENA_CONFIG__?.backendApiBase ||
  document.querySelector('meta[name="codearena-backend-api-base"]')?.content ||
  ""
).trim();
const IS_LOCAL_FRONTEND = API_HOST === "127.0.0.1" || API_HOST === "localhost";
const USES_SAME_ORIGIN_BACKEND = CONFIGURED_BACKEND_API_BASE_RAW.toLowerCase() === "same-origin";
const CONFIGURED_BACKEND_API_BASE = USES_SAME_ORIGIN_BACKEND
  ? ""
  : CONFIGURED_BACKEND_API_BASE_RAW.replace(/\/+$/, "");
const BACKEND_API_BASE = CONFIGURED_BACKEND_API_BASE_RAW
  ? CONFIGURED_BACKEND_API_BASE
  : (IS_LOCAL_FRONTEND ? LOCAL_BACKEND_API_BASE : null);
const BACKEND_API_TARGET = USES_SAME_ORIGIN_BACKEND
  ? `${window.location.origin}/api/...`
  : (BACKEND_API_BASE || "backend API (not configured)");
const BACKEND_API_CONFIGURATION_ERROR = 'Backend API is not configured for this deployment. Set <meta name="codearena-backend-api-base" content="https://your-backend.example.com"> in index.html, or use content="same-origin" only when this host proxies /api requests to your backend.';
const AUTH_SESSION_STORAGE_KEY = "codearena.authSession";
const EMPTY_CURRENT_USER = {
  id: "",
  role: "",
  email: "",
  name: "",
  usn: "",
  department: "",
  verified: false,
  createdAt: null,
  lastLoginAt: null,
  loginCount: 0,
  badgeTier: null,
  badgeLabel: null,
  badgeIds: [],
  solvedProblemCount: 0,
  badgeUpdatedAt: null,
};
const ACHIEVEMENT_BADGES = Object.freeze({
  SILVER: {
    label: "Silver Solver",
    shortLabel: "Silver",
    icon: "◇",
    color: "#e2e8f0",
    border: "#94a3b8",
    background: "linear-gradient(135deg, rgba(226,232,240,0.22), rgba(148,163,184,0.10))",
  },
  GOLD: {
    label: "Gold Solver",
    shortLabel: "Gold",
    icon: "✦",
    color: "#fde68a",
    border: "#f59e0b",
    background: "linear-gradient(135deg, rgba(250,204,21,0.24), rgba(245,158,11,0.10))",
  },
});

function getAchievementBadgeMeta(tier) {
  return ACHIEVEMENT_BADGES[String(tier || "").toUpperCase()] || null;
}

function normalizeAuthenticatedUser(user = {}, fallback = {}) {
  return {
    ...EMPTY_CURRENT_USER,
    ...fallback,
    id: user.id || fallback.id || "",
    role: user.role || fallback.role || "",
    email: user.email || fallback.email || "",
    name: user.name || "",
    usn: user.usn || "",
    department: user.department || "",
    verified: Boolean(user.verified),
    createdAt: user.createdAt || fallback.createdAt || null,
    lastLoginAt: user.lastLoginAt || fallback.lastLoginAt || null,
    loginCount: Number(user.loginCount || 0),
    badgeTier: user.badgeTier || null,
    badgeLabel: user.badgeLabel || null,
    badgeIds: Array.isArray(user.badgeIds) ? user.badgeIds : [],
    solvedProblemCount: Number(user.solvedProblemCount || 0),
    badgeUpdatedAt: user.badgeUpdatedAt || null,
  };
}

function DevOrbitLogo({ onClick, lightSurface = false }) {
  return (
    <div
      onClick={onClick}
      style={{
        display:"inline-flex",
        alignItems:"center",
        gap:10,
        cursor:onClick ? "pointer" : "default",
        userSelect:"none",
      }}
    >
      <svg width="30" height="30" viewBox="0 0 30 30" fill="none" aria-hidden="true">
        <circle cx="15" cy="15" r="13" fill={lightSurface ? "#EEF2FF" : "#111827"} />
        <ellipse cx="15" cy="15" rx="11" ry="5.8" transform="rotate(-18 15 15)" stroke="#7C6AF7" strokeWidth="2" />
        <ellipse cx="15" cy="15" rx="7.4" ry="11.2" transform="rotate(28 15 15)" stroke="#4FD1C5" strokeWidth="1.6" strokeDasharray="4 4" />
        <circle cx="15" cy="15" r="4.2" fill="#4FD1C5" />
        <circle cx="24" cy="10" r="2.3" fill="#FFC01E" />
      </svg>
      <span
        style={{
          fontFamily:"'Space Grotesk',sans-serif",
          fontWeight:800,
          fontSize:20,
          color:lightSurface ? "#111827" : "#F4F5FF",
          letterSpacing:"-0.5px",
        }}
      >
        DevOrbit
      </span>
    </div>
  );
}

function ScreenShield({ active, message }) {
  if (!active) return null;
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 99999,
        background: "rgba(15, 23, 42, 0.96)",
        backdropFilter: "blur(12px)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        color: "#f8fafc",
        padding: 24,
        textAlign: "center",
        userSelect: "none",
        pointerEvents: "auto",
      }}
    >
      <div style={{ fontSize: 48, marginBottom: 16 }}>🛡️</div>
      <h2 style={{ fontSize: 24, fontWeight: 700, margin: "0 0 12px", color: "#f8fafc" }}>
        Screen Shield Active
      </h2>
      <p style={{ fontSize: 15, color: "#94a3b8", maxWidth: 440, margin: 0, lineHeight: 1.6 }}>
        {message || "Screen capture or window blur was detected."}
      </p>
    </div>
  );
}

function ErrorBanner({ errors, onClose }) {
  if (!errors || (Array.isArray(errors) && errors.length === 0)) return null;

  const errorList = Array.isArray(errors) ? errors : [errors];

  return (
    <div
      style={{
        position: "fixed",
        top: 20,
        right: 20,
        zIndex: 9999,
        maxWidth: 420,
        background: "#7f1d1d",
        border: "1px solid #f87171",
        borderRadius: 12,
        padding: "14px 18px",
        boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.5)",
        color: "#fecaca",
        fontSize: 14,
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
      }}
    >
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, marginBottom: 4, color: "#fff" }}>Attention Required</div>
        {errorList.map((err, i) => (
          <div key={i} style={{ lineHeight: 1.5 }}>
            {typeof err === "object" ? err?.message || JSON.stringify(err) : String(err)}
          </div>
        ))}
      </div>
      {onClose && (
        <button
          onClick={onClose}
          style={{
            background: "none",
            border: "none",
            color: "#fecaca",
            cursor: "pointer",
            fontSize: 18,
            lineHeight: 1,
            padding: 2,
          }}
        >
          ✕
        </button>
      )}
    </div>
  );
}


function AchievementBadge({ tier, compact = false }) {
  const badge = getAchievementBadgeMeta(tier);
  if (!badge) return null;

  return (
    <span
      style={{
        display:"inline-flex",
        alignItems:"center",
        gap:compact ? 5 : 7,
        padding:compact ? "4px 8px" : "8px 12px",
        borderRadius:999,
        border:`1px solid ${badge.border}`,
        background:badge.background,
        color:badge.color,
        fontSize:compact ? 11 : 12,
        fontWeight:700,
        letterSpacing:"0.06em",
        textTransform:"uppercase",
      }}
    >
      <span aria-hidden="true">{badge.icon}</span>
      {compact ? badge.shortLabel : badge.label}
    </span>
  );
}

async function readJsonSafely(response) {
  const text = await response.text();
  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    const contentType = response.headers.get("content-type") || "unknown content type";
    const snippet = text.slice(0, 160).replace(/\s+/g, " ").trim();

    if (snippet.startsWith("<")) {
      throw new Error(
        `Expected JSON from ${response.url || BACKEND_API_TARGET}, but received HTML. Check the configured backend API URL.`
      );
    }

    throw new Error(
      `Backend returned invalid JSON (${contentType}).${snippet ? ` Response started with: ${snippet}` : ""}`
    );
  }
}

function buildBackendApiUrl(path) {
  if (!BACKEND_API_BASE && BACKEND_API_BASE !== "") {
    throw new Error(BACKEND_API_CONFIGURATION_ERROR);
  }

  return `${BACKEND_API_BASE}${path}`;
}

function createAuthHeaders(token, hasBody = false) {
  return {
    ...(hasBody ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function formatPortalDate(value) {
  if (!value) return "--";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function sameValue(left, right) {
  return String(left ?? "") === String(right ?? "");
}

function cleanExampleField(value) {
  if (value === null || value === undefined) return "";
  let str = String(value).trim();
  str = str.replace(/^(input|output):\s*/i, "").trim();
  return str;
}

function parseExamplesList(rawExamples) {
  if (!rawExamples) return [];

  if (typeof rawExamples === "string") {
    const trimmed = rawExamples.trim();
    if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
      try {
        rawExamples = JSON.parse(trimmed);
      } catch (e) {
        // Not JSON
      }
    }
  }

  if (typeof rawExamples === "string") {
    const text = rawExamples.trim();
    const blocks = text.split(/(?:Example\s*\d+:?|INPUT:)/i).filter(Boolean);
    const result = [];

    blocks.forEach((block) => {
      const outputMatch = block.match(/OUTPUT:\s*([\s\S]*?)(?:$|INPUT:|Example)/i);
      let inputVal = block;
      let outputVal = "";
      if (outputMatch) {
        outputVal = outputMatch[1].trim();
        inputVal = block.split(/OUTPUT:/i)[0].trim();
      }
      inputVal = cleanExampleField(inputVal);
      outputVal = cleanExampleField(outputVal);
      if (inputVal || outputVal) {
        result.push({ input: inputVal, output: outputVal, explanation: "" });
      }
    });

    if (result.length) return result;
  }

  if (Array.isArray(rawExamples)) {
    return rawExamples
      .map((item) => {
        if (!item) return null;
        if (typeof item === "string") {
          const parts = item.split(/=>|->/);
          if (parts.length >= 2) {
            return {
              input: cleanExampleField(parts[0]),
              output: cleanExampleField(parts.slice(1).join("=>")),
              explanation: "",
            };
          }
          return { input: cleanExampleField(item), output: "", explanation: "" };
        }
        if (typeof item === "object") {
          const inputVal = cleanExampleField(
            item.input ?? item.exampleInput ?? item.inputs ?? item.in ?? ""
          );
          const outputVal = cleanExampleField(
            item.output ?? item.exampleOutput ?? item.outputs ?? item.expected ?? item.out ?? ""
          );
          const explanationVal = item.explanation ? String(item.explanation).trim() : "";

          if (!inputVal && !outputVal && !explanationVal) return null;

          return {
            input: inputVal,
            output: outputVal,
            explanation: explanationVal,
          };
        }
        return null;
      })
      .filter(Boolean);
  }

  return [];
}

function mapProblemRecord(problem) {
  if (!problem) return null;

  const starterCode = problem.starterCode && typeof problem.starterCode === "object"
    ? problem.starterCode
    : { javascript: "", python: "", java: "" };
  const type = problem.type || (Array.isArray(problem.options) && problem.options.length ? "theory" : "coding");

  return {
    id: problem.number ?? problem.legacyId ?? problem.id,
    dbId: problem.id,
    type,
    number: problem.number ?? problem.legacyId ?? null,
    slug: problem.slug || "",
    title: problem.title || "Untitled Problem",
    fnName: problem.fnName || "",
    difficulty: problem.difficulty || "Medium",
    tags: Array.isArray(problem.tags) ? problem.tags : [],
    acceptance: problem.acceptance || (type === "theory" ? "Theory MCQ" : "Custom"),
    description: problem.description || problem.statement || "",
    statement: problem.statement || problem.description || "",
    options: Array.isArray(problem.options) ? problem.options : [],
    correctAnswer: problem.correctAnswer || null,
    explanation: problem.explanation || null,
    marks: problem.marks || (type === "theory" ? 2 : 10),
    examples: parseExamplesList(problem.examples?.length ? problem.examples : problem.samples),
    constraints: Array.isArray(problem.constraints) ? problem.constraints : [],
    starterCode: {
      javascript: starterCode.javascript || "",
      python: starterCode.python || "",
      java: starterCode.java || "",
    },
    testCases: Array.isArray(problem.testCases) ? problem.testCases : [],
    samples: Array.isArray(problem.samples) ? problem.samples : [],
    createdAt: problem.createdAt || null,
    updatedAt: problem.updatedAt || null,
  };
}

function resolveSubmissionProblemKey(submission, availableProblems = []) {
  const matchedProblem = availableProblems.find((problem) => (
    sameValue(problem.dbId, submission.problemId)
    || sameValue(problem.id, submission.problem?.number)
    || sameValue(problem.id, submission.problem?.legacyId)
    || sameValue(problem.dbId, submission.problem?.id)
    || sameValue(problem.id, submission.problemId)
  ));

  return matchedProblem?.id
    ?? submission.problem?.number
    ?? submission.problem?.legacyId
    ?? null;
}

function deriveSubmissionProgress(submissions, availableProblems = []) {
  const solved = new Set();
  const attempted = new Set();

  (Array.isArray(submissions) ? submissions : []).forEach((submission) => {
    const problemKey = resolveSubmissionProblemKey(submission, availableProblems);
    if (problemKey === null || problemKey === undefined) return;

    if (submission.status === "ACCEPTED") {
      solved.add(problemKey);
      attempted.delete(problemKey);
      return;
    }

    if (!solved.has(problemKey)) {
      attempted.add(problemKey);
    }
  });

  return { solved, attempted };
}

function mapAssignmentRecord(assignment) {
  if (!assignment) return null;

  const problems = Array.isArray(assignment.problems)
    ? assignment.problems.map(mapProblemRecord).filter(Boolean)
    : [];

  return {
    id: assignment.id,
    title: assignment.title || "Untitled Test",
    level: assignment.difficulty || "Mixed",
    difficulty: assignment.difficulty || "Mixed",
    duration: Number(assignment.durationMinutes || 60),
    durationMinutes: Number(assignment.durationMinutes || 60),
    status: assignment.status || "DRAFT",
    startsAt: assignment.startsAt || null,
    endsAt: assignment.endsAt || null,
    createdAt: assignment.createdAt || null,
    updatedAt: assignment.updatedAt || null,
    attempt: assignment.attempt || null,
    date: formatPortalDate(assignment.startsAt || assignment.createdAt),
    questions: problems.map((problem) => problem.id),
    questionIds: problems.map((problem) => problem.id),
    problemDbIds: problems.map((problem) => problem.dbId),
    problems,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// HIDDEN REFERENCE SOLUTIONS  (never shown to student – merged silently in bg)
// ─────────────────────────────────────────────────────────────────────────────
async function requestExecutionResult({ language, sourceCode, fnName, testCases }) {
  try {
    const response = await fetch(buildBackendApiUrl("/api/run"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        language,
        sourceCode,
        fnName,
        testCases,
      }),
    });

    const data = await readJsonSafely(response);
    if (!response.ok) {
      throw new Error(data.error || "Execution failed.");
    }

    return data;
  } catch (error) {
    const message = error.message || "Execution failed.";
    const needsServerHint = /Failed to fetch|Cannot reach backend|not configured|received HTML/i.test(message);
    throw new Error(
      needsServerHint
        ? `${message} Start the local server with "node hacker.js" and make sure Judge0 is reachable.`
        : message
    );
  }
}

const SUPPORTED_LANGUAGES = Object.freeze([
  { id: "python", name: "Python 3", label: "Python 3" },
  { id: "javascript", name: "JavaScript", label: "JavaScript (Node.js)" },
  { id: "java", name: "Java", label: "Java 17" },
  { id: "cpp", name: "C++", label: "C++ (GCC)" },
  { id: "c", name: "C", label: "C (GCC)" },
]);

const DEFAULT_STARTER_CODE = Object.freeze({
  python: `# Write your Python solution here\nimport sys\n\ndef main():\n    lines = sys.stdin.read().split()\n    if not lines:\n        return\n    if len(lines) >= 2:\n        a, b = int(lines[0]), int(lines[1])\n        print(a + b)\n\nif __name__ == "__main__":\n    main()\n`,
  javascript: `// Write your JavaScript solution here\nconst fs = require('fs');\n\nfunction main() {\n  const input = fs.readFileSync('/dev/stdin', 'utf-8').trim().split(/\\s+/);\n  if (input.length >= 2) {\n    const a = parseInt(input[0], 10);\n    const b = parseInt(input[1], 10);\n    console.log(a + b);\n  }\n}\n\nmain();\n`,
  java: `// Write your Java solution here\nimport java.util.Scanner;\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner scanner = new Scanner(System.in);\n        if (scanner.hasNextInt()) {\n            int a = scanner.nextInt();\n            int b = scanner.nextInt();\n            System.out.println(a + b);\n        }\n    }\n}\n`,
  cpp: `// Write your C++ solution here\n#include <iostream>\nusing namespace std;\n\nint main() {\n    int a, b;\n    if (cin >> a >> b) {\n        cout << (a + b) << endl;\n    }\n    return 0;\n}\n`,
  c: `/* Write your C solution here */\n#include <stdio.h>\n\nint main() {\n    int a, b;\n    if (scanf("%d %d", &a, &b) == 2) {\n        printf("%d\\n", a + b);\n    }\n    return 0;\n}\n`,
});

function formatCode(code = "", language = "python") {
  if (typeof code !== "string") return "";
  const lines = code.split("\n");
  return lines.map((l) => l.trimEnd()).join("\n");
}

function validateCodeSyntax(code = "", language = "python") {
  if (!code || typeof code !== "string") {
    return { isValid: true, errors: [] };
  }

  const errors = [];
  const lines = code.split("\n");
  const stack = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (let char of line) {
      if (char === "{" || char === "(" || char === "[") {
        stack.push({ char, line: i + 1 });
      } else if (char === "}" || char === ")" || char === "]") {
        if (stack.length > 0) {
          const last = stack[stack.length - 1];
          if (
            (char === "}" && last.char === "{") ||
            (char === ")" && last.char === "(") ||
            (char === "]" && last.char === "[")
          ) {
            stack.pop();
          }
        }
      }
    }
  }

  if (stack.length > 0) {
    const unclosed = stack[stack.length - 1];
    errors.push({
      line: unclosed.line,
      message: `Unclosed '${unclosed.char}' at line ${unclosed.line}`,
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

function highlightCodeLine(line = "", language = "javascript") {
  if (!line) return [{ text: "", color: "#d7dcff" }];

  const keywords = new Set([
    "def", "return", "if", "else", "elif", "for", "while", "import", "from", "as",
    "class", "try", "except", "finally", "with", "lambda", "in", "is", "not", "and", "or",
    "function", "const", "let", "var", "async", "await", "public", "private", "protected",
    "static", "void", "int", "double", "float", "char", "include", "using", "namespace"
  ]);

  const tokens = line.split(/(\s+|[(){}[\];,.<>:=+\-*/%&|^!~"#'])/);
  return tokens.filter(Boolean).map((token) => {
    if (keywords.has(token)) {
      return { text: token, color: "#93c5fd" };
    }
    if (/^\d+$/.test(token)) {
      return { text: token, color: "#fde68a" };
    }
    if (/^["'].*["']$/.test(token)) {
      return { text: token, color: "#86efac" };
    }
    if (/^\/\//.test(token) || /^\#/.test(token)) {
      return { text: token, color: "#64748b" };
    }
    return { text: token, color: "#d7dcff" };
  });
}

function CodeHighlightLayer({ code, language, scrollTop = 0 }) {
  return (
    <div aria-hidden="true" style={{ position:"absolute", inset:0, pointerEvents:"none", overflow:"hidden" }}>
      <div style={{ margin:0, padding:"16px 16px 16px 56px", transform:`translateY(-${scrollTop}px)`, whiteSpace:"pre-wrap", wordBreak:"break-word", color:"#d7dcff", fontFamily:"'JetBrains Mono',monospace", fontSize:13.5, lineHeight:"21px", boxSizing:"border-box" }}>
        {String(code || "").split("\n").map((line, lineIndex) => (
          <div key={lineIndex} style={{ minHeight:21 }}>
            {highlightCodeLine(line, language).map((piece, pieceIndex) => (
              <span key={pieceIndex} style={{ color:piece.color }}>{piece.text}</span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}


function CodingPlatform() {
  const defaultAdminProblems = [];
  const defaultAdminTest = {
    id: "",
    title: "Current Test",
    level: "Hard",
    difficulty: "Hard",
    date: "23/03/2026",
    duration: 60,
    questions: [29, 34, 39],
    questionIds: [29, 34, 39],
    problemDbIds: [],
    problems: defaultAdminProblems,
    status: "DRAFT",
    startsAt: null,
    endsAt: null,
    createdAt: null,
  };
  const defaultPreviousTests = [
    { id: "t-2203", name: "Algorithm Sprint 1", date: "22/03/2026", difficulty: "Medium", winner: "Aarav", average: 82 },
    { id: "t-2103", name: "Campus Mock Round", date: "21/03/2026", difficulty: "Hard", winner: "Diya", average: 76 },
    { id: "t-1903", name: "Data Structures Drill", date: "19/03/2026", difficulty: "Easy", winner: "Nikhil", average: 91 },
  ];
  const defaultLeaderboard = [
    {
      username: "Aarav",
      rating: 1920,
      avatarGradient: ["#f6c453", "#ff8f5c"],
      overall: { rank: 1, score: 2478, problemsSolved: 153, timePenalty: "05h 12m", trend: 1 },
      contest: { rank: 1, score: 98, problemsSolved: 5, timePenalty: "08m 12s", trend: 1, timeTaken: "41m 12s" },
      global: { rank: 2, score: 2386, problemsSolved: 148, timePenalty: "05h 47m", trend: 1 },
    },
    {
      username: "Diya",
      rating: 1885,
      avatarGradient: ["#d9dde6", "#8f98a8"],
      overall: { rank: 2, score: 2412, problemsSolved: 149, timePenalty: "05h 34m", trend: 0 },
      contest: { rank: 2, score: 95, problemsSolved: 5, timePenalty: "11m 08s", trend: 0, timeTaken: "44m 08s" },
      global: { rank: 1, score: 2401, problemsSolved: 151, timePenalty: "05h 11m", trend: 1 },
    },
    {
      username: "Karthik",
      rating: 1840,
      avatarGradient: ["#c88a56", "#8f5a3a"],
      overall: { rank: 3, score: 2350, problemsSolved: 144, timePenalty: "06h 02m", trend: -1 },
      contest: { rank: 3, score: 91, problemsSolved: 4, timePenalty: "14m 20s", trend: 1, timeTaken: "47m 20s" },
      global: { rank: 4, score: 2292, problemsSolved: 139, timePenalty: "06h 19m", trend: -1 },
    },
    {
      username: "Meera",
      rating: 1798,
      avatarGradient: ["#7c6af7", "#4fd1c5"],
      overall: { rank: 4, score: 2264, problemsSolved: 138, timePenalty: "06h 40m", trend: 1 },
      contest: { rank: 4, score: 88, problemsSolved: 4, timePenalty: "16m 03s", trend: 0, timeTaken: "49m 03s" },
      global: { rank: 5, score: 2210, problemsSolved: 132, timePenalty: "06h 54m", trend: 1 },
    },
    {
      username: "Rohan",
      rating: 1746,
      avatarGradient: ["#56ccf2", "#2f80ed"],
      overall: { rank: 5, score: 2195, problemsSolved: 131, timePenalty: "07h 05m", trend: -1 },
      contest: { rank: 5, score: 84, problemsSolved: 4, timePenalty: "19m 44s", trend: -1, timeTaken: "53m 44s" },
      global: { rank: 6, score: 2148, problemsSolved: 125, timePenalty: "07h 18m", trend: -1 },
    },
    {
      username: "Anika",
      rating: 1712,
      avatarGradient: ["#ff7eb3", "#ff758c"],
      overall: { rank: 6, score: 2141, problemsSolved: 126, timePenalty: "07h 28m", trend: 1 },
      contest: { rank: 6, score: 82, problemsSolved: 4, timePenalty: "22m 18s", trend: 1, timeTaken: "56m 22s" },
      global: { rank: 7, score: 2084, problemsSolved: 120, timePenalty: "07h 41m", trend: 1 },
    },
    {
      username: "Nikhil",
      rating: 1680,
      avatarGradient: ["#11998e", "#38ef7d"],
      overall: { rank: 7, score: 2098, problemsSolved: 123, timePenalty: "07h 49m", trend: 0 },
      contest: { rank: 7, score: 78, problemsSolved: 3, timePenalty: "25m 07s", trend: -1, timeTaken: "58m 11s" },
      global: { rank: 8, score: 2046, problemsSolved: 118, timePenalty: "08h 03m", trend: 0 },
    },
    {
      username: "Sana",
      rating: 1651,
      avatarGradient: ["#f2994a", "#f2c94c"],
      overall: { rank: 8, score: 2057, problemsSolved: 119, timePenalty: "08h 10m", trend: 1 },
      contest: { rank: 8, score: 74, problemsSolved: 3, timePenalty: "27m 55s", trend: 1, timeTaken: "61m 39s" },
      global: { rank: 9, score: 1994, problemsSolved: 114, timePenalty: "08h 26m", trend: 1 },
    },
  ];
  const defaultActiveUsers = [
    { name: "Aarav", department: "CSE", status: "Solving" },
    { name: "Diya", department: "ISE", status: "Running tests" },
    { name: "Meera", department: "AIML", status: "Reviewing" },
    { name: "Rohan", department: "ECE", status: "Submitted" },
  ];
  const adminTabs = [
    { id: "overview", label: "Overview" },
    { id: "questions", label: "Question Uploads" },
    { id: "reports", label: "📊 Reports" },
    { id: "malpractice", label: "🚨 Malpractice Reports" },
    { id: "leaderboard", label: "Leaderboard" },
    { id: "students", label: "Student List" },
    { id: "profile", label: "Profile" },
  ];
  const questionCategories = ["DSA", "SQL", "OOP", "Python", "Other"];
  const createDefaultQuestionUploadForm = () => ({
    type: "coding",
    title: "",
    category: "DSA",
    difficulty: "Medium",
    fnName: "solve",
    tags: "",
    statement: "",
    constraints: "",
    examples: "",
    testCases: "",
    marks: "10",
    options: ["Option A", "Option B", "Option C", "Option D"],
    correctAnswer: "Option A",
    explanation: "",
    javascript: "function solve(input) {\n  return input;\n}",
    python: "def solve(input):\n    return input",
    java: "public class Solution {\n  public static String solve(String input) {\n    return input;\n  }\n}",
  });

  const [view, setView]                       = useState("home");
  const [userRole, setUserRole]               = useState(null);
  const [currentUser, setCurrentUser]         = useState(EMPTY_CURRENT_USER);
  const [authToken, setAuthToken]             = useState("");
  const [authModalOpen, setAuthModalOpen]     = useState(false);
  const [authMode, setAuthMode]               = useState("");
  const [authRole, setAuthRole]               = useState("");
  const [authEmail, setAuthEmail]             = useState("");
  const [authPassword, setAuthPassword]       = useState("");
  const [authName, setAuthName]               = useState("");
  const [authUsn, setAuthUsn]                 = useState("");
  const [authDepartment, setAuthDepartment]   = useState("");
  const [authError, setAuthError]             = useState("");
  const [authSubmitting, setAuthSubmitting]   = useState(false);
  const [authPoliciesAccepted, setAuthPoliciesAccepted] = useState(false);
  const [problemBank, setProblemBank]         = useState([]);
  const [problemBankLoading, setProblemBankLoading] = useState(false);
  const [adminAssignments, setAdminAssignments] = useState([]);
  const [adminAssignmentsLoading, setAdminAssignmentsLoading] = useState(false);
  const [activeAssignment, setActiveAssignment] = useState(null);
  const [activeAssignments, setActiveAssignments] = useState([]);
  const [showLiveTestPopup, setShowLiveTestPopup] = useState(false);
  const [liveTestPopupDismissedId, setLiveTestPopupDismissedId] = useState(null);
  const [studentNotifications, setStudentNotifications] = useState([]);
  const [notificationCount, setNotificationCount] = useState(0);
  const [loginEvents, setLoginEvents]         = useState([]);
  const [portalMessage, setPortalMessage]     = useState("");
  const [portalError, setPortalError]         = useState("");
  const [adminSyncingProblems, setAdminSyncingProblems] = useState(false);
  const [adminCreatingTest, setAdminCreatingTest] = useState(false);
  const [adminStartingTest, setAdminStartingTest] = useState(false);
  const [adminStoppingTest, setAdminStoppingTest] = useState(false);
  const [adminCurrentTest, setAdminCurrentTest] = useState(defaultAdminTest);
  const [previousTests, setPreviousTests]     = useState(defaultPreviousTests);
  const [selectedPreviousTest, setSelectedPreviousTest] = useState(defaultPreviousTests[0]);
  const [leaderboard, setLeaderboard]         = useState([]);
  const [activeUsers, setActiveUsers]         = useState(defaultActiveUsers);
  const [registeredStudents, setRegisteredStudents] = useState([]);
  const [participantsCount, setParticipantsCount] = useState(defaultActiveUsers.length);
  const [adminTab, setAdminTab]               = useState("overview");
  const [adminTimerSeconds, setAdminTimerSeconds] = useState(defaultAdminTest.duration * 60);
  const [adminWarning, setAdminWarning]       = useState("");
  const [solutionsVisible, setSolutionsVisible] = useState(false);
  const [adminTestReport, setAdminTestReport] = useState(null);
  const [questionUploadForm, setQuestionUploadForm] = useState(createDefaultQuestionUploadForm);
  const [questionUploading, setQuestionUploading] = useState(false);
  const [questionUploadError, setQuestionUploadError] = useState("");
  const [questionUploadSuccess, setQuestionUploadSuccess] = useState("");
  const [questionCategoryFilter, setQuestionCategoryFilter] = useState("All");
  const [questionTypeFilter, setQuestionTypeFilter] = useState("All");
  const [editingProblemId, setEditingProblemId] = useState(null);
  const [deletingProblem, setDeletingProblem] = useState(null);
  const [deletingQuestion, setDeletingQuestion] = useState(false);
  const [candidateTheoryAnswers, setCandidateTheoryAnswers] = useState({});
  const [candidateCodingAnswers, setCandidateCodingAnswers] = useState({});
  const [submittingAssessment, setSubmittingAssessment] = useState(false);
  const [assessmentResult, setAssessmentResult] = useState(null);
  const [adminPreviewOpen, setAdminPreviewOpen] = useState(false);
  const [adminPreviewActiveIdx, setAdminPreviewActiveIdx] = useState(0);

  const [reportsOverview, setReportsOverview] = useState([]);
  const [reportsOverviewLoading, setReportsOverviewLoading] = useState(false);
  const [selectedReportTestId, setSelectedReportTestId] = useState("");
  const [activeTestReport, setActiveTestReport] = useState(null);
  const [testReportLoading, setTestReportLoading] = useState(false);
  const [studentReportModalData, setStudentReportModalData] = useState(null);
  const [studentReportModalOpen, setStudentReportModalOpen] = useState(false);
  const [codeInspectModalData, setCodeInspectModalData] = useState(null);
  const [codeInspectModalOpen, setCodeInspectModalOpen] = useState(false);
  const [reportsSearchQuery, setReportsSearchQuery] = useState("");
  const [reportsFilterStatus, setReportsFilterStatus] = useState("All");
  const [reportsSortField, setReportsSortField] = useState("rank");

  const [proctoringReports, setProctoringReports] = useState([]);
  const [proctoringStats, setProctoringStats] = useState({});
  const [proctoringSearch, setProctoringSearch] = useState("");
  const [proctoringFilterStatus, setProctoringFilterStatus] = useState("ALL");
  const [selectedProctoringAttempt, setSelectedProctoringAttempt] = useState(null);
  const [selectedReviewAttempt, setSelectedReviewAttempt] = useState(null);
  const [reviewStatusInput, setReviewStatusInput] = useState("REVIEW_REQUIRED");
  const [reviewNoteInput, setReviewNoteInput] = useState("");

  const loadProctoringReports = async () => {
    if (!authToken) return;
    try {
      const res = await fetch("/api/admin/reports/proctoring", {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();
      if (data.reports) {
        setProctoringReports(data.reports);
        setProctoringStats(data.stats || {});
      }
    } catch (err) {
      console.error("Failed to load proctoring reports:", err);
    }
  };

  const handleReviewSubmit = async () => {
    if (!selectedReviewAttempt || !authToken) return;
    try {
      const res = await fetch(`/api/admin/reports/proctoring/attempts/${selectedReviewAttempt.attemptId}/review`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          newStatus: reviewStatusInput,
          note: reviewNoteInput,
        }),
      });
      if (res.ok) {
        setSelectedReviewAttempt(null);
        setReviewNoteInput("");
        await loadProctoringReports();
      }
    } catch (err) {
      console.error("Failed to review attempt:", err);
    }
  };

  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  const [pdfStage, setPdfStage] = useState("idle");
  const [pdfProgressText, setPdfProgressText] = useState("");
  const [pdfRawText, setPdfRawText] = useState("");
  const [pdfDraftQuestions, setPdfDraftQuestions] = useState([]);
  const [pdfEditingIndex, setPdfEditingIndex] = useState(null);
  const [pdfImporting, setPdfImporting] = useState(false);

  const [mcqModalOpen, setMcqModalOpen] = useState(false);
  const [mcqEditingProblem, setMcqEditingProblem] = useState(null);
  const [mcqForm, setMcqForm] = useState({
    title: "",
    statement: "",
    category: "Python",
    difficulty: "Easy",
    marks: "2",
    options: ["Option A", "Option B", "Option C", "Option D"],
    correctAnswerIndex: null,
    explanation: "",
  });
  const [mcqValidationError, setMcqValidationError] = useState("");
  const [mcqSaving, setMcqSaving] = useState(false);
  const [mcqCardSearchQuery, setMcqCardSearchQuery] = useState("");
  const [adminCreateForm, setAdminCreateForm] = useState({
    title: "Fresh Challenge",
    level: "Hard",
    date: "24/03/2026",
    duration: "60",
    questions: defaultAdminProblems.map((problem) => problem.dbId || problem.id),
  });
  const [adminSubmissionProblemId, setAdminSubmissionProblemId] = useState(defaultAdminTest.questions[0]);
  const [adminSubmissionLang, setAdminSubmissionLang] = useState("javascript");
  const [adminSubmissionCode, setAdminSubmissionCode] = useState("");
  const [adminExecution, setAdminExecution]   = useState(null);
  const [adminExecuting, setAdminExecuting]   = useState(false);
  const [selectedProblem, setSelectedProblem] = useState(null);
  const [problemNavigationSource, setProblemNavigationSource] = useState("catalog");
  const [lang, setLang]                       = useState("javascript");
  const [code, setCode]                       = useState("");
  const [activeTab, setActiveTab]             = useState("description");
  const [consoleTab, setConsoleTab]           = useState("testcase");
  const [runResult, setRunResult]             = useState(null);
  const [running, setRunning]                 = useState(false);
  const [submitting, setSubmitting]           = useState(false);
  const [solved, setSolved]                   = useState(new Set());
  const [filterDiff, setFilterDiff]           = useState("All");
  const [searchQuery, setSearchQuery]         = useState("");
  const [leaderboardSearch, setLeaderboardSearch] = useState("");
  const [leaderboardScope, setLeaderboardScope] = useState("All");
  const [leaderboardPage, setLeaderboardPage] = useState(1);
  const [hoveredLeaderboardRank, setHoveredLeaderboardRank] = useState(null);
  const [leaderboardReady, setLeaderboardReady] = useState(false);
  const [leaderboardUpdating, setLeaderboardUpdating] = useState(true);
  const [contestEntered, setContestEntered]     = useState(false);
  const [contestTimerSeconds, setContestTimerSeconds] = useState(defaultAdminTest.duration * 60);
  const [attemptedProblems, setAttemptedProblems] = useState(new Set());
  const [contestSecurityLocked, setContestSecurityLocked] = useState(false);
  const [contestInstructionsOpen, setContestInstructionsOpen] = useState(false);
  const [contestInstructionsAccepted, setContestInstructionsAccepted] = useState(false);
  const [contestCameraStatus, setContestCameraStatus] = useState("idle");
  const [contestCameraError, setContestCameraError] = useState("");
  const [contestCameraStream, setContestCameraStream] = useState(null);
  const [contestSessionEndsAt, setContestSessionEndsAt] = useState(null);
  const [contestSessionProgress, setContestSessionProgress] = useState({});
  const [contestResult, setContestResult] = useState(null);
  const [finalSubmitConfirmOpen, setFinalSubmitConfirmOpen] = useState(false);
  const [cameraMinimized, setCameraMinimized] = useState(false);
  const [startExamModalOpen, setStartExamModalOpen] = useState(false);
  const [exitExamConfirmModalOpen, setExitExamConfirmModalOpen] = useState(false);
  const [pendingNavigationAction, setPendingNavigationAction] = useState(null);
  const [showAuthPassword, setShowAuthPassword] = useState(false);
  const [userSubmissions, setUserSubmissions] = useState([]);
  const [consoleOpen, setConsoleOpen]         = useState(false);
  const [editorScrollTop, setEditorScrollTop] = useState(0);
  const [errorBanner, setErrorBanner]         = useState(null);
  const [screenShield, setScreenShield]       = useState(false);
  const [shieldMessage, setShieldMessage]     = useState("Screen capture is disabled in this demo.");
  const textareaRef = useRef(null);
  const adminTextareaRef = useRef(null);
  const contestCameraPreviewRef = useRef(null);
  const shieldTimerRef = useRef(null);
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth || 1024);
  useEffect(() => {
    const handleResize = () => setViewportWidth(window.innerWidth || 1024);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const video = contestCameraPreviewRef.current;
    if (!video) return;
    video.srcObject = contestCameraStream || null;
    if (contestCameraStream) {
      video.play().catch(() => {});
    }
  }, [contestCameraStream, view, contestEntered]);
  const triggerShield = (message, duration = 1800) => {
    setShieldMessage(message);
    setScreenShield(true);

    if (shieldTimerRef.current) clearTimeout(shieldTimerRef.current);
    if (duration > 0) {
      shieldTimerRef.current = setTimeout(() => setScreenShield(false), duration);
    }
  };

  const saveAuthSession = (token, user, role) => {
    try {
      window.localStorage?.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify({
        token,
        user,
        role,
      }));
    } catch {
      // Storage can be blocked in private browsing; login should still work for this tab.
    }
  };

  const clearAuthSession = () => {
    try {
      window.localStorage?.removeItem(AUTH_SESSION_STORAGE_KEY);
    } catch {
      // Ignore storage cleanup failures.
    }
  };

  const performApiRequest = async (path, options = {}) => {
    const hasBody = Boolean(options.body);
    const response = await fetch(buildBackendApiUrl(path), {
      ...options,
      headers: {
        ...createAuthHeaders(authToken, hasBody),
        ...(options.headers || {}),
      },
    });

    const data = await readJsonSafely(response);
    if (!response.ok) {
      if (response.status === 401 && (data.error === "invalid user" || data.error === "auth required" || data.error === "invalid token")) {
        clearAuthSession();
        setAuthToken("");
        setCurrentUser(EMPTY_CURRENT_USER);
        setUserRole(null);
        setAuthMode("login");
        setAuthRole("student");
        setAuthModalOpen(true);
        throw new Error("Please log in to submit your code.");
      }
      throw new Error(data.error || "Request failed.");
    }

    return data;
  };

  const loadProblemBank = async () => {
    setProblemBankLoading(true);

    try {
      const data = await performApiRequest("/api/problems?includeContent=1&includeAll=1");
      const mappedProblems = Array.isArray(data.problems)
        ? data.problems.map(mapProblemRecord).filter(Boolean)
        : [];
      setProblemBank(mappedProblems);
      return mappedProblems;
    } finally {
      setProblemBankLoading(false);
    }
  };

  const syncProblemBankToDatabase = async (silent = false) => {
    setAdminSyncingProblems(true);

    try {
      const problems = await loadProblemBank();
      if (!silent) {
        setPortalMessage(`Problem bank synced to MongoDB. ${problems.length} problems are available for assignment.`);
      }
      setPortalError("");
      return problems;
    } catch (error) {
      setPortalError(error.message || "Unable to sync problems right now.");
      throw error;
    } finally {
      setAdminSyncingProblems(false);
    }
  };

  const loadAdminPortalData = async (preferredAssignmentId = adminCurrentTest?.id) => {
    setAdminAssignmentsLoading(true);
    setPortalError("");

    try {
      let problems = await loadProblemBank();

      const [testsData, studentsData, loginEventData, leaderboardData] = await Promise.all([
        performApiRequest("/api/tests"),
        performApiRequest("/api/auth/students"),
        performApiRequest("/api/auth/login-events"),
        performApiRequest("/api/submissions/leaderboard"),
      ]);

      const assignments = Array.isArray(testsData.assignments)
        ? testsData.assignments.map(mapAssignmentRecord).filter(Boolean)
        : [];
      const liveAssignments = assignments.filter((assignment) => assignment.status === "LIVE");
      const currentAssignment = assignments.find((assignment) => sameValue(assignment.id, preferredAssignmentId))
        || liveAssignments[0]
        || assignments[0]
        || {
          ...defaultAdminTest,
          problems,
          questions: problems.slice(0, 3).map((problem) => problem.id),
          questionIds: problems.slice(0, 3).map((problem) => problem.id),
          problemDbIds: problems.slice(0, 3).map((problem) => problem.dbId),
        };

      const history = assignments
        .filter((assignment) => assignment.id !== currentAssignment.id)
        .map((assignment) => ({
          id: assignment.id,
          name: assignment.title,
          date: assignment.date,
          difficulty: assignment.level,
          winner: assignment.status === "ENDED" ? "Completed" : assignment.status,
          average: assignment.questionIds.length * 25,
        }));

      const students = Array.isArray(studentsData.students) ? studentsData.students : [];
      const mappedRegisteredStudents = students.map((student) => ({
        name: student.name || student.email,
        department: student.department || "Department pending",
        status: student.lastLoginAt ? "Logged In" : "Registered",
        email: student.email,
        usn: student.usn || "--",
        loginCount: student.loginCount || 0,
        lastLoginAt: student.lastLoginAt || null,
        createdAt: student.createdAt || null,
        badgeTier: student.badgeTier || null,
        badgeLabel: student.badgeLabel || null,
        solvedProblemCount: Number(student.solvedProblemCount || 0),
      }));
      const mappedStudents = mappedRegisteredStudents.filter((student) => Number(student.loginCount || 0) > 0);
      const nextLeaderboard = Array.isArray(leaderboardData.leaderboard)
        ? leaderboardData.leaderboard
        : [];

      setProblemBank(problems);
      setAdminCreateForm((prev) => {
        const validSelections = prev.questions.filter((problemId) => problems.some((problem) => problem.dbId === problemId));
        return {
          ...prev,
          questions: validSelections.length ? validSelections : problems.slice(0, 3).map((problem) => problem.dbId),
        };
      });
      setAdminAssignments(assignments);
      setActiveAssignments(liveAssignments);
      setAdminCurrentTest(currentAssignment);
      setPreviousTests(history.length ? history : defaultPreviousTests);
      setSelectedPreviousTest(history[0] || defaultPreviousTests[0]);
      setLeaderboard(nextLeaderboard);
      setRegisteredStudents(mappedRegisteredStudents);
      setActiveUsers(mappedStudents);
      setParticipantsCount(mappedStudents.length);
      setLoginEvents(Array.isArray(loginEventData.events) ? loginEventData.events : []);
      if (currentAssignment?.id && currentAssignment.status === "ENDED") {
        const reportData = await performApiRequest(`/api/tests/${currentAssignment.id}/report`);
        setAdminTestReport(reportData.report || null);
      } else {
        setAdminTestReport(null);
      }

      if (currentAssignment?.problems?.length) {
        setAdminSubmissionProblemId((prev) => {
          const stillExists = currentAssignment.problems.some((problem) => problem.id === prev);
          return stillExists ? prev : currentAssignment.problems[0].id;
        });
      }
    } catch (error) {
      setLeaderboard([]);
      setPortalError(error.message || "Unable to load admin portal data.");
    } finally {
      setAdminAssignmentsLoading(false);
    }
  };

  const loadStudentPortalData = async (availableProblems = problemBank) => {
    try {
      const [assignmentData, notificationData, leaderboardData, submissionData, profileData] = await Promise.all([
        performApiRequest("/api/tests/active"),
        performApiRequest("/api/notifications"),
        performApiRequest("/api/submissions/leaderboard"),
        performApiRequest(`/api/submissions/user/${currentUser.id}`),
        performApiRequest("/api/auth/me"),
      ]);

      const liveAssignments = Array.isArray(assignmentData.assignments)
        ? assignmentData.assignments.map(mapAssignmentRecord).filter(Boolean)
        : [];
      const defaultAssignment = mapAssignmentRecord(assignmentData.assignment);
      const availableLiveAssignments = liveAssignments.length
        ? liveAssignments
        : (defaultAssignment ? [defaultAssignment] : []);
      const assignment = liveAssignments.find((item) => sameValue(item.id, activeAssignment?.id))
        || defaultAssignment
        || availableLiveAssignments[0]
        || null;
      setActiveAssignment(assignment);
      if (assignment && (assignment.status === "LIVE" || assignment.status === "live" || assignment.active) && !contestEntered) {
        setShowLiveTestPopup(true);
      }
      setActiveAssignments(availableLiveAssignments);
      if (assignment?.problems?.length) {
        setAdminCurrentTest(assignment);
      }
      if (contestEntered && !assignment) {
        finishContest("Ended because the admin stopped the test.");
      } else if (contestEntered && assignment?.id && activeAssignment?.id && !sameValue(assignment.id, activeAssignment.id)) {
        setContestEntered(false);
        setContestSessionEndsAt(null);
      }

      const notifications = Array.isArray(notificationData.notifications)
        ? notificationData.notifications
        : [];
      const nextLeaderboard = Array.isArray(leaderboardData.leaderboard)
        ? leaderboardData.leaderboard
        : [];
      const submissions = Array.isArray(submissionData.submissions)
        ? submissionData.submissions
        : [];
      const progress = deriveSubmissionProgress(submissions, availableProblems);

      setLeaderboard(nextLeaderboard);
      setSolved(progress.solved);
      setAttemptedProblems(progress.attempted);
      setUserSubmissions(submissions);
      setStudentNotifications(notifications);
      setNotificationCount(Number(notificationData.unreadCount || 0));

      if (profileData.user) {
        const refreshedUser = normalizeAuthenticatedUser(profileData.user, currentUser);
        setCurrentUser(refreshedUser);
        saveAuthSession(authToken, refreshedUser, refreshedUser.role);
      }
      setPortalError("");
    } catch (error) {
      setLeaderboard([]);
      setUserSubmissions([]);
      setPortalError(error.message || "Unable to load your current test.");
    }
  };

  const markNotificationAsRead = async (notificationId) => {
    try {
      await performApiRequest(`/api/notifications/${notificationId}/read`, {
        method: "POST",
      });

      setStudentNotifications((prev) => prev.map((notification) => (
        notification.id === notificationId
          ? { ...notification, read: true }
          : notification
      )));
      setNotificationCount((prev) => Math.max(0, prev - 1));
    } catch (error) {
      setPortalError(error.message || "Unable to update notification.");
    }
  };

  useEffect(() => {
    try {
      const rawSession = window.localStorage?.getItem(AUTH_SESSION_STORAGE_KEY);
      if (!rawSession) return;

      const session = JSON.parse(rawSession);
      const savedUser = session?.user;
      const savedToken = String(session?.token || "");
      const savedRole = savedUser?.role || session?.role || "";

      if (!savedToken || !savedUser?.id || !savedRole) {
        clearAuthSession();
        return;
      }

      setCurrentUser(normalizeAuthenticatedUser({ ...savedUser, role: savedRole }));
      setAuthToken(savedToken);
      setUserRole(savedRole);
      setAuthModalOpen(false);
      setAuthError("");
      setView(savedRole === "admin" ? "admin" : "list");
      if (savedRole === "admin") {
        setAdminTab("overview");
      }
    } catch {
      clearAuthSession();
    }
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      const key = e.key || "";
      const lowerKey = key.toLowerCase();
      const isSnipShortcut = (e.ctrlKey || e.metaKey) && e.shiftKey && lowerKey === "s";

      if (key === "PrintScreen" || isSnipShortcut) {
        e.preventDefault();
        triggerShield("Screen capture shortcut blocked. Sensitive content hidden temporarily.");

        if (navigator.clipboard?.writeText) {
          navigator.clipboard.writeText("").catch(() => {});
        }
      }

      if ((e.ctrlKey || e.metaKey) && lowerKey === "p") {
        e.preventDefault();
        triggerShield("Printing is disabled for this page.", 1500);
      }
    };

    const handleBlur = () => setScreenShield(true);
    const handleFocus = () => setScreenShield(false);
    const handleVisibilityChange = () => setScreenShield(document.hidden);

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("blur", handleBlur);
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (shieldTimerRef.current) clearTimeout(shieldTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (view !== "admin") return undefined;

    const handleAdminVisibility = () => {
      if (document.hidden) {
        setAdminWarning("Warning: tab switching detected while the test dashboard is active.");
      }
    };

    document.addEventListener("visibilitychange", handleAdminVisibility);

    return () => {
      document.removeEventListener("visibilitychange", handleAdminVisibility);
    };
  }, [view]);

  useEffect(() => {
    if (!adminCurrentTest) {
      setAdminTimerSeconds(0);
      return undefined;
    }

    if (adminCurrentTest.status === "ENDED") {
      setAdminTimerSeconds(0);
      return undefined;
    }

    if (!adminCurrentTest.endsAt) {
      setAdminTimerSeconds((adminCurrentTest.duration || 60) * 60);
      return undefined;
    }

    const syncAdminTimer = () => {
      const remaining = Math.max(0, Math.floor((new Date(adminCurrentTest.endsAt).getTime() - Date.now()) / 1000));
      setAdminTimerSeconds(remaining);
    };

    syncAdminTimer();
    const countdown = setInterval(syncAdminTimer, 1000);
    return () => clearInterval(countdown);
  }, [adminCurrentTest]);

  useEffect(() => {
    if (view !== "admin" || !authToken || !adminCurrentTest?.id || adminCurrentTest.status !== "ENDED") {
      setAdminTestReport(null);
      return undefined;
    }

    let cancelled = false;
    const loadReport = async () => {
      try {
        const data = await performApiRequest(`/api/tests/${adminCurrentTest.id}/report`);
        if (!cancelled) {
          setAdminTestReport(data.report || null);
        }
      } catch {
        if (!cancelled) {
          setAdminTestReport(null);
        }
      }
    };

    loadReport();
    return () => {
      cancelled = true;
    };
  }, [view, authToken, adminCurrentTest?.id, adminCurrentTest?.status]);

  useEffect(() => {
    if (view !== "admin") return;
    if (adminTimerSeconds !== 0) return;
    if (!adminSubmissionCode.trim() || adminExecuting || adminExecution?.autoSubmitted) return;

    const autoSubmit = async () => {
      await handleAdminRun(true);
    };

    autoSubmit();
  }, [adminTimerSeconds, view, adminSubmissionCode, adminExecuting, adminExecution]);

  useEffect(() => {
    if (view !== "leaderboard") {
      setLeaderboardReady(false);
      setHoveredLeaderboardRank(null);
      return undefined;
    }

    setLeaderboardUpdating(true);
    const revealTimer = setTimeout(() => setLeaderboardReady(true), 60);
    const updatePulse = setInterval(() => {
      setLeaderboardUpdating((prev) => !prev);
    }, 900);

    return () => {
      clearTimeout(revealTimer);
      clearInterval(updatePulse);
    };
  }, [view]);

  useEffect(() => {
    setLeaderboardPage(1);
  }, [leaderboardSearch, leaderboardScope]);

  useEffect(() => {
    setContestEntered(false);
    setContestSecurityLocked(false);
    setContestSessionEndsAt(null);
  }, [activeAssignment?.id, adminCurrentTest.id]);

  useEffect(() => {
    const fallbackDuration = activeAssignment?.duration || adminCurrentTest.duration || 60;

    if (!contestSessionEndsAt) {
      setContestTimerSeconds(fallbackDuration * 60);
      return undefined;
    }

    const syncContestTimer = () => {
      const remaining = Math.max(0, Math.floor((new Date(contestSessionEndsAt).getTime() - Date.now()) / 1000));
      setContestTimerSeconds(remaining);
    };

    syncContestTimer();
    const timer = setInterval(syncContestTimer, 1000);
    return () => clearInterval(timer);
  }, [activeAssignment, adminCurrentTest, contestSessionEndsAt]);

  useEffect(() => {
    if (!contestEntered) return;
    if (!contestSessionEndsAt) return;
    if (contestTimerSeconds > 0) return;

    finishContest("Time ended.");
  }, [contestEntered, contestSessionEndsAt, contestTimerSeconds]);

  useEffect(() => {
    if (!contestEntered || assessmentResult) return undefined;

    const handleBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = "Are you sure you want to exit the exam? Your progress may be lost.";
      return e.returnValue;
    };

    const handlePopState = (e) => {
      window.history.pushState(null, "", window.location.href);
      setExitExamConfirmModalOpen(true);
    };

    window.history.pushState(null, "", window.location.href);
    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("popstate", handlePopState);
    };
  }, [contestEntered, assessmentResult]);

  useEffect(() => {
    if (!contestEntered) {
      setContestSecurityLocked(false);
      return undefined;
    }

    let ending = false;
    const endForSecurity = async (reason) => {
      if (ending) return;
      ending = true;
      if (authToken && currentUser.id && activeContestAssignment?.id) {
        try {
          await performApiRequest(`/api/tests/${activeContestAssignment.id}/attempts/interrupt`, {
            method: "POST",
            body: JSON.stringify({ reason }),
          });
        } catch {}
      }
      finishContest(reason);
    };

    const ensureContestFocus = () => {
      const hidden = document.hidden;
      const fullscreenActive = Boolean(document.fullscreenElement);
      const shouldLock = hidden || !fullscreenActive;

      setContestSecurityLocked(shouldLock);

      if (shouldLock) {
        endForSecurity("Ended because fullscreen was closed or the window changed.");
      } else {
        setScreenShield(false);
      }
    };

    const handleBlur = () => {
      setContestSecurityLocked(true);
      endForSecurity("Ended because you switched away from the test window.");
    };

    const handleContestKeyDown = (e) => {
      const key = e.key || "";
      const lowerKey = key.toLowerCase();
      const isClipboardShortcut = (e.ctrlKey || e.metaKey) && ["c", "v", "x"].includes(lowerKey);

      if (isClipboardShortcut) {
        e.preventDefault();
        triggerShield("Copy, cut, and paste are disabled during the test.", 1400);
        return;
      }

      if (key === "Escape" || key === "F11" || key === "Meta" || key === "OS") {
        e.preventDefault();
        endForSecurity(`Ended because restricted key "${key}" was pressed.`);
      }
    };

    const blockClipboardAction = (e) => {
      e.preventDefault();
      triggerShield("Copy, cut, and paste are disabled during the test.", 1400);
    };

    document.addEventListener("visibilitychange", ensureContestFocus);
    document.addEventListener("fullscreenchange", ensureContestFocus);
    document.addEventListener("copy", blockClipboardAction, true);
    document.addEventListener("cut", blockClipboardAction, true);
    document.addEventListener("paste", blockClipboardAction, true);
    window.addEventListener("keydown", handleContestKeyDown, true);
    window.addEventListener("blur", handleBlur);
    window.addEventListener("focus", ensureContestFocus);

    ensureContestFocus();

    return () => {
      document.removeEventListener("visibilitychange", ensureContestFocus);
      document.removeEventListener("fullscreenchange", ensureContestFocus);
      document.removeEventListener("copy", blockClipboardAction, true);
      document.removeEventListener("cut", blockClipboardAction, true);
      document.removeEventListener("paste", blockClipboardAction, true);
      window.removeEventListener("keydown", handleContestKeyDown, true);
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("focus", ensureContestFocus);
    };
  }, [contestEntered]);

  useEffect(() => {
    if (adminTab === "reports") {
      loadReportsOverview();
    } else if (adminTab === "malpractice") {
      loadProctoringReports();
    }
  }, [adminTab]);

  useEffect(() => {
    if (!authToken || !currentUser.id) {
      return undefined;
    }

    let cancelled = false;
    const loadPortal = async () => {
      if (cancelled) return;

      if (currentUser.role === "admin") {
        await loadAdminPortalData();
        return;
      }

      const loadedProblems = await loadProblemBank().catch(() => []);
      const codingOnlyProblems = loadedProblems.filter((p) => {
        const probType = p.type || (Array.isArray(p.options) && p.options.length ? "theory" : "coding");
        const hasMcqTag = Array.isArray(p.tags) && p.tags.some((t) => String(t).toUpperCase() === "MCQ");
        const isMcqAcceptance = String(p.acceptance || "").toLowerCase().includes("mcq");
        const isTheory = probType === "theory" || (Array.isArray(p.options) && p.options.length > 0) || hasMcqTag || isMcqAcceptance;
        return !isTheory;
      });
      await loadStudentPortalData(codingOnlyProblems);
    };

    loadPortal();
    const interval = setInterval(loadPortal, currentUser.role === "admin" ? 20000 : 15000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [authToken, currentUser.id, currentUser.role]);

  const openProblem = (p, navigationSource = "catalog") => {
    setSelectedProblem(p);
    setProblemNavigationSource(navigationSource);

    const savedAns = candidateCodingAnswers[p.dbId] || candidateCodingAnswers[p.id] || candidateCodingAnswers[p.legacyId];
    if (savedAns && savedAns.code) {
      setCode(savedAns.code);
      if (savedAns.language) setLang(savedAns.language);
    } else {
      setCode(p.starterCode?.[lang] || "");
    }

    setRunResult(null);
    setActiveTab("description");
    setConsoleTab("testcase");
    setConsoleOpen(false);
    setEditorScrollTop(0);
    setErrorBanner(null);
    setView("problem");
  };

  const openLeaderboard = (scope = leaderboardScope) => {
    setLeaderboardScope(scope);
    setLeaderboardPage(1);
    setView("leaderboard");
  };

  const openContest = () => {
    setView("contest");
  };

  const buildContestResult = (reason = "Submitted", sessionProgress = contestSessionProgress) => {
    const problems = contestProblemSet.length ? contestProblemSet : contestProblems;
    const rows = problems.map((problem) => {
      const status = sessionProgress[problem.id] || "not_attempted";
      const accepted = status === "accepted";
      const attempted = status === "rejected";
      return {
        id: problem.id,
        title: problem.title,
        difficulty: problem.difficulty,
        score: accepted ? problem.contestScore : 0,
        maxScore: problem.contestScore,
        status: accepted ? "Accepted" : attempted ? "Rejected" : "Not Attempted",
      };
    });
    const maxScore = rows.reduce((total, row) => total + row.maxScore, 0);
    const score = rows.reduce((total, row) => total + row.score, 0);
    const accepted = rows.filter((row) => row.status === "Accepted").length;
    const rejected = rows.filter((row) => row.status === "Rejected").length;
    const notAttempted = rows.filter((row) => row.status === "Not Attempted").length;

    return {
      title: contestDisplayName,
      reason,
      score,
      maxScore,
      accepted,
      rejected,
      notAttempted,
      total: rows.length,
      rows,
      completedAt: new Date().toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
    };
  };

  const finishContest = async (reason = "Submitted", sessionProgress = contestSessionProgress) => {
    const interrupted = /ended because|restricted key|switched away|fullscreen/i.test(reason);
    if (authToken && currentUser.id && activeContestAssignment?.id) {
      try {
        await performApiRequest(`/api/tests/${activeContestAssignment.id}/attempts/finish`, {
          method: "POST",
          body: JSON.stringify({ reason, interrupted }),
        });
      } catch {}
    }
    setContestResult(buildContestResult(reason, sessionProgress));
    setContestEntered(false);
    setContestSecurityLocked(false);
    setContestInstructionsOpen(false);
    setContestCameraStatus("idle");
    setContestCameraError("");
    if (contestCameraStream) {
      contestCameraStream.getTracks().forEach((track) => track.stop());
      setContestCameraStream(null);
    }
    setScreenShield(false);
    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
    setView("contestResult");
  };

    const goBackFromAdmin = () => {
    setView("home");
  };

  const goBackFromProblem = () => {
    if (problemNavigationSource === "contest" && contestEntered && !assessmentResult) {
      setPendingNavigationAction(() => () => setView("contest"));
      setExitExamConfirmModalOpen(true);
      return;
    }
    setView(problemNavigationSource === "contest" ? "contest" : "list");
  };

  const requestContestFullscreen = async () => {
    if (document.fullscreenElement) return true;

    const root = document.documentElement;
    if (!root?.requestFullscreen) return false;

    try {
      await root.requestFullscreen({ navigationUI: "hide" });
      return true;
    } catch (err) {
      console.warn("Fullscreen request failed or restricted by browser:", err);
      return false;
    }
  };

  const requestContestCameraPermission = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setContestCameraStatus("unavailable");
      setContestCameraError("Camera access is not supported in this browser.");
      return false;
    }

    setContestCameraStatus("requesting");
    setContestCameraError("");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      });

      if (contestCameraStream) {
        contestCameraStream.getTracks().forEach((track) => track.stop());
      }

      setContestCameraStream(stream);
      setContestCameraStatus("granted");
      return true;
    } catch (error) {
      const reason = String(error?.name || "");
      const message = reason === "NotAllowedError"
        ? "Camera permission was denied. Continuing without active video feed."
        : reason === "NotFoundError"
          ? "No camera was found on this device. Continuing in standard mode."
          : "Unable to access camera hardware. Continuing in standard mode.";

      setContestCameraStatus("unavailable");
      setContestCameraError(message);
      return false;
    }
  };

  const handleEnterContest = (problemToOpen = contestProblems[0]) => {
    if (activeContestAssignment?.attempt && activeContestAssignment.attempt.status !== "IN_PROGRESS" && !contestEntered) {
      setPortalError("You have already used your one attempt for this test.");
      return;
    }

    if (contestStatus === "Ended" || contestStatus === "Awaiting Start") {
      setPortalError(contestStatus === "Awaiting Start" ? "No live test has been started for students yet." : "");
      return;
    }

    setPortalError("");
    const targetProblem = problemToOpen || contestProblems[0] || problemCatalog[0] || null;
    setSelectedProblem(targetProblem);
    setContestInstructionsAccepted(true);
    setContestCameraStatus("idle");
    setContestCameraError("");

    startContestAfterInstructions();
  };

  const startContestAfterInstructions = async () => {
    const problemToOpen = selectedProblem || contestProblems[0] || problemCatalog[0] || null;

    // Trigger fullscreen synchronously during click event context
    requestContestFullscreen().catch(() => {});

    // Try camera permission gracefully without blocking user if absent/denied
    try {
      await requestContestCameraPermission();
    } catch {
      setContestCameraStatus("unavailable");
    }

    if (authToken && currentUser.id && activeContestAssignment?.id) {
      try {
        await performApiRequest(`/api/tests/${activeContestAssignment.id}/attempts/start`, {
          method: "POST",
        });
      } catch (error) {
        const errorMsg = String(error.message || "");
        if (!errorMsg.toLowerCase().includes("already attempted") && !errorMsg.toLowerCase().includes("already started")) {
          setPortalError(error.message || "You have already used your one attempt for this test.");
          return;
        }
      }
    }

    setContestEntered(true);
    setContestSecurityLocked(false);
    if (!contestSessionEndsAt) {
      setContestSessionEndsAt(new Date(Date.now() + ((activeContestAssignment?.duration || adminCurrentTest.duration || 60) * 60 * 1000)).toISOString());
    }
    setContestSessionProgress({});
    setContestResult(null);
    setContestInstructionsOpen(false);
    setStartExamModalOpen(false);

    if (problemToOpen) {
      openProblem(problemToOpen, "contest");
    } else {
      setView("contest");
    }
  };

  const closeContestInstructions = () => {
    setContestInstructionsOpen(false);
    setContestInstructionsAccepted(false);
    setContestCameraStatus("idle");
    setContestCameraError("");

    if (contestCameraStream) {
      contestCameraStream.getTracks().forEach((track) => track.stop());
      setContestCameraStream(null);
    }
  };

  const openProfile = () => {
    setView("profile");
  };

  const handleLangChange = (l) => {
    setLang(l);
    if (selectedProblem) {
      const pKey = selectedProblem.dbId || selectedProblem.id;
      const savedAns = candidateCodingAnswers[pKey] || candidateCodingAnswers[selectedProblem.id] || candidateCodingAnswers[selectedProblem.legacyId];
      if (savedAns && savedAns.language === l && savedAns.code) {
        setCode(savedAns.code);
      } else {
        setCode(selectedProblem.starterCode?.[l] || DEFAULT_STARTER_CODE[l] || "");
      }
    } else {
      setCode(DEFAULT_STARTER_CODE[l] || "");
    }
  };

  const openAuthFlow = () => {
    setAuthModalOpen(true);
    setAuthMode("");
    setAuthRole("");
    setAuthName("");
    setAuthUsn("");
    setAuthDepartment("");
    setAuthEmail("");
    setAuthPassword("");
    setAuthError("");
    setAuthPoliciesAccepted(false);
  };

  const closeAuthFlow = () => {
    setAuthModalOpen(false);
    setAuthMode("");
    setAuthRole("");
    setAuthName("");
    setAuthUsn("");
    setAuthDepartment("");
    setAuthEmail("");
    setAuthPassword("");
    setAuthError("");
    setAuthPoliciesAccepted(false);
  };

  const chooseAuthMode = (mode) => {
    setAuthMode(mode);
    setAuthRole("");
    setAuthName("");
    setAuthUsn("");
    setAuthDepartment("");
    setAuthEmail("");
    setAuthPassword("");
    setAuthError("");
    setAuthPoliciesAccepted(false);
  };

  const chooseAuthRole = (role) => {
    setAuthRole(role);
    setAuthName("");
    setAuthUsn("");
    setAuthDepartment("");
    setAuthEmail("");
    setAuthPassword("");
    setAuthError("");
    setAuthPoliciesAccepted(false);
  };

  const handleAuthSubmit = async () => {
    const name = authName.trim();
    const usn = authUsn.trim();
    const department = authDepartment.trim();
    const email = authEmail.trim();
    const password = authPassword.trim();
    const emailPattern = /^[A-Z0-9._%+-]+@gmail\.com$/i;

    if (!authMode || !authRole) {
      setAuthError("Choose login or sign up and select a role first.");
      return;
    }

    if (!email) {
      setAuthError("Please enter your email/username.");
      return;
    }

    if (!password) {
      setAuthError("Please enter your password.");
      return;
    }

    if (authMode === "signup") {
      if (!name || !department) {
        setAuthError("Enter name and department to sign up.");
        return;
      }
    }

    if (!emailPattern.test(email)) {
      setAuthError("Only @gmail.com email addresses are allowed.");
      return;
    }

    setAuthSubmitting(true);

    try {
      const endpoint = authMode === "signup" ? "/api/auth/register" : "/api/auth/login";
      const payload = authMode === "signup"
        ? { email, password, name, usn, department, role: authRole }
        : { email, password, role: authRole };

      const response = await fetch(buildBackendApiUrl(endpoint), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await readJsonSafely(response);
      if (!response.ok) {
        throw new Error(data.error || "Invalid email/username or password.");
      }

      const user = data.user || {
        id: "",
        role: authRole,
        email,
        name,
        usn,
        department,
        verified: false,
        lastLoginAt: null,
        loginCount: 0,
      };

      const resolvedRole = user.role || authRole;
      const authenticatedUser = normalizeAuthenticatedUser(user, {
        role: resolvedRole,
        email,
        name,
        usn,
        department,
      });

      setCurrentUser(authenticatedUser);
      setAuthToken(data.token || "");
      setUserRole(resolvedRole);
      saveAuthSession(data.token || "", authenticatedUser, resolvedRole);
      setPortalMessage("");
      setPortalError("");
      if (resolvedRole === "admin") {
        setAdminTab("overview");
      }
      setAuthModalOpen(false);
      setAuthError("");
      setView(resolvedRole === "admin" ? "admin" : "list");
    } catch (error) {
      const message = String(error?.message || "");
      if (message.includes("Failed to fetch") || message.includes("Cannot reach backend")) {
        setAuthError("Unable to connect to the server. Please try again.");
      } else {
        setAuthError(message.includes("Invalid") ? message : "Invalid email/username or password.");
      }
    } finally {
      setAuthSubmitting(false);
    }
  };

  const signOut = () => {
    clearAuthSession();
    setUserRole(null);
    setCurrentUser(EMPTY_CURRENT_USER);
    setAuthToken("");
    setProblemBank([]);
    setAdminAssignments([]);
    setActiveAssignment(null);
    setStudentNotifications([]);
    setNotificationCount(0);
    setLoginEvents([]);
    setPortalMessage("");
    setPortalError("");
    setLeaderboard([]);
    setActiveUsers(defaultActiveUsers);
    setRegisteredStudents([]);
    setParticipantsCount(defaultActiveUsers.length);
    setAdminTab("overview");
    setAdminWarning("");
    setSolutionsVisible(false);
    setAdminExecution(null);
    setQuestionUploadForm(createDefaultQuestionUploadForm());
    setQuestionUploading(false);
    setQuestionCategoryFilter("All");
    setUserSubmissions([]);
    setContestEntered(false);
    setContestSecurityLocked(false);
    setContestInstructionsOpen(false);
    setContestInstructionsAccepted(false);
    setContestCameraStatus("idle");
    setContestCameraError("");
    setContestSessionEndsAt(null);
    setContestSessionProgress({});
    setContestResult(null);
    setFinalSubmitConfirmOpen(false);
    setAttemptedProblems(new Set());
    setSolved(new Set());
    setContestTimerSeconds(adminCurrentTest.duration * 60);
    setConsoleOpen(false);
    if (contestCameraStream) {
      contestCameraStream.getTracks().forEach((track) => track.stop());
      setContestCameraStream(null);
    }
    setScreenShield(false);
    closeAuthFlow();
    setView("home");
  };

  useEffect(() => {
    const selected = adminCurrentTest.problems?.find((problem) => problem.id === adminSubmissionProblemId)
      || problemBank.find((problem) => problem.id === adminSubmissionProblemId)
      || null;
    if (selected) {
      setAdminSubmissionCode(selected.starterCode?.[adminSubmissionLang] || "");
    }
  }, [adminCurrentTest, adminSubmissionProblemId, adminSubmissionLang, problemBank]);

  const handleAdminCreateInput = (field, value) => {
    setAdminCreateForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleQuestionUploadInput = (field, value) => {
    if (questionUploadError) setQuestionUploadError("");
    setQuestionUploadForm((prev) => ({ ...prev, [field]: value }));
  };

  const parseUploadList = (value) =>
    String(value || "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

  const parseUploadPairs = (value, outputKey) => {
    const trimmed = String(value || "").trim();
    if (!trimmed) return [];

    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed
          .map((entry) => ({
            input: String(entry?.input || ""),
            [outputKey]: String(entry?.[outputKey] || entry?.output || entry?.expected || ""),
            ...(entry?.explanation ? { explanation: String(entry.explanation) } : {}),
          }))
          .filter((entry) => entry.input || entry[outputKey]);
      }
    } catch {
      // Fall back to line parsing below.
    }

    return trimmed
      .split(/\r?\n/)
      .map((line) => {
        const parts = line.split("=>");
        const input = String(parts.shift() || "").trim();
        const output = parts.join("=>").trim();
        return {
          input,
          [outputKey]: output,
        };
      })
      .filter((entry) => entry.input || entry[outputKey]);
  };

  const getProblemCategory = (problem) => {
    const tags = Array.isArray(problem?.tags) ? problem.tags : [];
    return questionCategories.find((category) =>
      tags.some((tag) => String(tag).toLowerCase() === category.toLowerCase())
    ) || "Other";
  };

  const startEditQuestion = (problem) => {
    const targetId = problem.dbId || problem.id;
    setEditingProblemId(targetId);
    const probType = problem.type || (Array.isArray(problem.options) && problem.options.length ? "theory" : "coding");
    const cat = getProblemCategory(problem);
    const tagList = Array.isArray(problem.tags)
      ? problem.tags.filter((t) => String(t).toLowerCase() !== cat.toLowerCase()).join(", ")
      : "";
    const examplesStr = Array.isArray(problem.examples)
      ? problem.examples.map((e) => (typeof e === "object" ? `${e.input || ""} => ${e.output || e.expected || ""}` : String(e))).join("\n")
      : "";
    const testCasesStr = Array.isArray(problem.testCases)
      ? problem.testCases.map((tc) => (typeof tc === "object" ? `${tc.input || ""} => ${tc.expected || tc.output || ""}` : String(tc))).join("\n")
      : "";
    const constraintsStr = Array.isArray(problem.constraints)
      ? problem.constraints.join("\n")
      : "";

    setQuestionUploadForm({
      type: probType,
      title: problem.title || "",
      category: cat,
      difficulty: problem.difficulty || "Medium",
      fnName: problem.fnName || "solve",
      tags: tagList,
      statement: problem.description || problem.statement || "",
      constraints: constraintsStr,
      examples: examplesStr,
      testCases: testCasesStr,
      marks: String(problem.marks || (probType === "theory" ? 2 : 10)),
      options: Array.isArray(problem.options) && problem.options.length ? problem.options : ["Option A", "Option B", "Option C", "Option D"],
      correctAnswer: problem.correctAnswer || (Array.isArray(problem.options) && problem.options.length ? problem.options[0] : "Option A"),
      explanation: problem.explanation || "",
      javascript: problem.starterCode?.javascript || "function solve(input) {\n  return input;\n}",
      python: problem.starterCode?.python || "def solve(input):\n    return input",
      java: problem.starterCode?.java || "public class Solution {\n  public static String solve(String input) {\n    return input;\n  }\n}",
    });
    setQuestionUploadError("");
    setQuestionUploadSuccess("");

    if (adminTextareaRef.current) {
      adminTextareaRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const cancelEditQuestion = () => {
    setEditingProblemId(null);
    setQuestionUploadForm(createDefaultQuestionUploadForm());
    setQuestionUploadError("");
  };

  const handleConfirmDeleteQuestion = async () => {
    if (!deletingProblem) return;
    const targetId = deletingProblem.dbId || deletingProblem.id;
    const targetTitle = deletingProblem.title;

    setDeletingQuestion(true);
    try {
      await performApiRequest(`/api/problems/${targetId}`, { method: "DELETE" });
      await loadProblemBank();

      if (editingProblemId === targetId) {
        setEditingProblemId(null);
        setQuestionUploadForm(createDefaultQuestionUploadForm());
      }

      setAdminCreateForm((prev) => ({
        ...prev,
        questions: prev.questions.filter((qId) => qId !== targetId && qId !== deletingProblem.id && qId !== deletingProblem.dbId),
      }));

      setDeletingProblem(null);
      setQuestionUploadSuccess(`Question "${targetTitle}" was removed successfully.`);
    } catch (error) {
      setQuestionUploadError(error.message || "Unable to remove the question.");
      setDeletingProblem(null);
    } finally {
      setDeletingQuestion(false);
    }
  };

  const handleUploadQuestion = async () => {
    const isTheory = questionUploadForm.type === "theory";
    const title = questionUploadForm.title.trim();
    const statement = questionUploadForm.statement.trim();

    if (!title || !statement) {
      setQuestionUploadError("Enter a question title and full statement before saving.");
      return;
    }

    if (isTheory) {
      const opts = (questionUploadForm.options || []).map((o) => String(o || "").trim()).filter(Boolean);
      if (opts.length < 2 || opts.length > 6) {
        setQuestionUploadError("Theory question requires between 2 and 6 valid options.");
        return;
      }
      if (!questionUploadForm.correctAnswer || !questionUploadForm.correctAnswer.trim()) {
        setQuestionUploadError("Select the correct answer option for the theory question.");
        return;
      }
    } else {
      if (questionUploadForm.category !== "SQL" && !questionUploadForm.fnName.trim()) {
        setQuestionUploadError("Enter the function name used by the test cases.");
        return;
      }
    }

    const examples = parseUploadPairs(questionUploadForm.examples, "output");
    const parsedTestCases = parseUploadPairs(questionUploadForm.testCases, "expected");
    const testCases = parsedTestCases.length
      ? parsedTestCases
      : examples.map((example) => ({ input: example.input, expected: example.output }));
    const tags = [
      questionUploadForm.category,
      ...String(questionUploadForm.tags || "")
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
    ].filter((tag, index, allTags) =>
      allTags.findIndex((candidate) => candidate.toLowerCase() === tag.toLowerCase()) === index
    );

    setQuestionUploading(true);
    setQuestionUploadError("");
    setQuestionUploadSuccess("");

    try {
      const endpoint = editingProblemId ? `/api/problems/${editingProblemId}` : "/api/problems";
      const method = editingProblemId ? "PUT" : "POST";

      const payload = isTheory
        ? {
            type: "theory",
            title,
            difficulty: questionUploadForm.difficulty,
            tags,
            statement,
            options: questionUploadForm.options.map((o) => String(o || "").trim()).filter(Boolean),
            correctAnswer: questionUploadForm.correctAnswer.trim(),
            explanation: questionUploadForm.explanation ? questionUploadForm.explanation.trim() : "",
            marks: Math.max(1, Number(questionUploadForm.marks) || 2),
            acceptance: editingProblemId ? "Admin Theory Edit" : "Admin Theory Upload",
          }
        : {
            type: "coding",
            title,
            difficulty: questionUploadForm.difficulty,
            tags,
            fnName: questionUploadForm.fnName.trim() || "solve",
            statement,
            examples,
            testCases,
            constraints: parseUploadList(questionUploadForm.constraints),
            marks: Math.max(1, Number(questionUploadForm.marks) || 10),
            starterCode: {
              javascript: questionUploadForm.javascript,
              python: questionUploadForm.python,
              java: questionUploadForm.java,
            },
            samples: examples,
            acceptance: editingProblemId ? "Admin Edit" : "Admin Upload",
          };

      const data = await performApiRequest(endpoint, {
        method,
        body: JSON.stringify(payload),
      });

      const savedProblem = mapProblemRecord(data.problem);
      const nextProblems = await loadProblemBank();
      const targetProblem = savedProblem || nextProblems.find((problem) => problem.title === title);

      if (targetProblem?.dbId && !editingProblemId) {
        setAdminCreateForm((prev) => ({
          ...prev,
          questions: prev.questions.includes(targetProblem.dbId)
            ? prev.questions
            : [...prev.questions, targetProblem.dbId],
        }));
      }

      const wasEditing = Boolean(editingProblemId);
      setEditingProblemId(null);
      setQuestionUploadForm(createDefaultQuestionUploadForm());
      setQuestionUploadSuccess(
        wasEditing
          ? `Question "${targetProblem?.title || title}" was modified successfully.`
          : `Your question "${targetProblem?.title || title}" was uploaded successfully.`
      );
    } catch (error) {
      setQuestionUploadError(error.message || `Unable to ${editingProblemId ? "modify" : "upload"} the question.`);
    } finally {
      setQuestionUploading(false);
    }
  };

  const formatCountdown = (totalSeconds) => {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  };
  const formatContestCountdown = (totalSeconds) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  };

  async function handleAdminRun(autoSubmitted = false) {
    const selected = adminSelectedProblem;
    if (!selected) return;

    setAdminExecuting(true);
    setAdminExecution(null);

    const fallbackError = (message) =>
      selected.testCases.map((tc, index) => ({
        ...tc,
        actual: null,
        status: "error",
        error: message,
      }));

    try {
      const data = await requestExecutionResult({
        language: adminSubmissionLang,
        sourceCode: adminSubmissionCode,
        fnName: selected.fnName,
        testCases: selected.testCases,
      });

      setAdminExecution({
        tests: data.tests || [],
        runtime: data.runtime || "N/A",
        status: data.status || "failed",
        autoSubmitted,
      });
    } catch (error) {
      setAdminExecution({
        tests: fallbackError(error.message),
        runtime: "N/A",
        status: "failed",
        autoSubmitted,
      });
    } finally {
      setAdminExecuting(false);
    }
  }

  const toggleCreateQuestion = (problemDbId) => {
    setAdminCreateForm((prev) => {
      const exists = prev.questions.includes(problemDbId);
      return {
        ...prev,
        questions: exists
          ? prev.questions.filter((value) => value !== problemDbId)
          : [...prev.questions, problemDbId],
      };
    });
  };

  const handleCreateTest = async () => {
    const duration = Math.max(1, Number(adminCreateForm.duration) || 60);
    if (!adminCreateForm.questions.length) {
      setPortalError("Select at least one database problem for the test.");
      return;
    }

    setAdminCreatingTest(true);
    setPortalError("");

    try {
      const data = await performApiRequest("/api/tests", {
        method: "POST",
        body: JSON.stringify({
          title: adminCreateForm.title.trim() || "Fresh Challenge",
          difficulty: adminCreateForm.level,
          durationMinutes: duration,
          problemIds: adminCreateForm.questions,
        }),
      });

      const createdAssignment = mapAssignmentRecord(data.assignment);
      setAdminCurrentTest(createdAssignment);
      setAdminTimerSeconds(duration * 60);
      setAdminSubmissionProblemId(createdAssignment?.problems?.[0]?.id || "");
      setSolutionsVisible(false);
      setPortalMessage(`Draft test "${createdAssignment.title}" saved. Start it when you're ready to notify students.`);
      await loadAdminPortalData(createdAssignment.id);
    } catch (error) {
      setPortalError(error.message || "Unable to create the test.");
    } finally {
      setAdminCreatingTest(false);
    }
  };

  const handleStartAssignedTest = async () => {
    if (!adminCurrentTest.id) {
      setPortalError("Create a draft test first, then start it.");
      return;
    }

    setAdminStartingTest(true);
    setPortalError("");

    try {
      const data = await performApiRequest(`/api/tests/${adminCurrentTest.id}/start`, {
        method: "POST",
      });

      const startedAssignment = mapAssignmentRecord(data.assignment);
      setActiveAssignment(startedAssignment);
      setAdminCurrentTest(startedAssignment);
      setAdminSubmissionProblemId(startedAssignment?.problems?.[0]?.id || "");
      setPortalMessage(`Test started. Notifications were sent to ${data.notifiedStudents || 0} logged-in students.`);
      await loadAdminPortalData(startedAssignment.id);
    } catch (error) {
      setPortalError(error.message || "Unable to start the test.");
    } finally {
      setAdminStartingTest(false);
    }
  };

  const handleStopAssignedTest = async () => {
    if (!adminCurrentTest.id || adminCurrentTest.status !== "LIVE") {
      setPortalError("Select a live test before stopping it.");
      return;
    }

    setAdminStoppingTest(true);
    setPortalError("");

    try {
      const data = await performApiRequest(`/api/tests/${adminCurrentTest.id}/stop`, {
        method: "POST",
      });

      const stoppedAssignment = mapAssignmentRecord(data.assignment);
      setAdminCurrentTest(stoppedAssignment);
      setAdminTimerSeconds(0);
      setPortalMessage(`Test stopped. Notifications were sent to ${data.notifiedStudents || 0} logged-in students.`);
      await loadAdminPortalData(stoppedAssignment.id);
    } catch (error) {
      setPortalError(error.message || "Unable to stop the test.");
    } finally {
      setAdminStoppingTest(false);
    }
  };

  // ── CORE RUN / SUBMIT ──────────────────────────────────────────────────────
  const simulateRun = async (isSubmit) => {
    if (isSubmit) setSubmitting(true); else setRunning(true);
    setConsoleOpen(true);
    setConsoleTab("result");
    setRunResult(null);
    setErrorBanner(null);

    const p        = selectedProblem;
    let   results  = [];
    let   runtime  = Math.floor(60 + Math.random() * 60) + " ms";
    let   memory   = (Math.random() * 5 + 40).toFixed(1) + " MB";
    let   beats    = Math.floor(50 + Math.random() * 45) + "%";
    let   status   = "failed";

    try {
      if (isSubmit) {
        if (!authToken || !currentUser || !currentUser.id) {
          clearAuthSession();
          setAuthToken("");
          setCurrentUser(EMPTY_CURRENT_USER);
          setUserRole(null);
          setAuthMode("login");
          setAuthRole("student");
          setAuthModalOpen(true);
          setErrorBanner([{ caseNum: 1, message: "Please log in or sign up to submit your official code." }]);
          setSubmitting(false);
          return;
        }
        const data = await performApiRequest("/api/submissions/submit", {
          method: "POST",
          body: JSON.stringify({
            problemId: String(p.dbId || p.id),
            language: lang,
            code,
          }),
        });

        results = data.tests || [];
        runtime = data.runtime || runtime;
        memory  = data.memory || memory;
        beats   = data.beats || beats;
        status  = data.status || status;
      } else {
        const data = await requestExecutionResult({
          language: lang,
          sourceCode: code,
          fnName: p.fnName,
          testCases: p.testCases,
        });

        results = data.tests || [];
        runtime = data.runtime || runtime;
        memory  = data.memory || memory;
        beats   = data.beats || beats;
        status  = data.status || status;
      }
    } catch (error) {
      const deploymentHint = !isSubmit && error.message.includes("returned HTML instead of JSON")
        ? " This usually means the frontend is not reaching the configured backend API correctly."
        : "";
      results = p.testCases.map((tc, i) => ({
        ...tc,
        actual: null,
        status: "error",
        error: `${error.message}${deploymentHint}${isSubmit ? " Submission was not saved." : ""}`
      }));
      status = "failed";
    }

    // Collect errors for the banner
    const errors = [];
    results.forEach((r, i) => {
      if (r.status === "error" || r.status === "unsupported") {
        errors.push({ caseNum: i + 1, message: r.error });
      } else if (r.status === "fail") {
        errors.push({
          caseNum: i + 1,
          message: r.error
            ? r.error
            : `Expected: ${r.expected}\nGot:      ${r.actual ?? "undefined"}\n\nYour output does not match. Re-check your logic.`,
        });
      }
    });
    if (errors.length > 0) setErrorBanner(errors);

    const allPassed = results.every(r => r.status === "pass");
    const nextSolvedSet = new Set(solved);
    const nextAttemptedSet = new Set(attemptedProblems);
    if (allPassed) {
      nextAttemptedSet.delete(p.id);
      setAttemptedProblems(new Set(nextAttemptedSet));
      if (isSubmit) {
        nextSolvedSet.add(p.id);
        setSolved(new Set(nextSolvedSet));
      }
    } else {
      nextAttemptedSet.add(p.id);
      setAttemptedProblems(new Set(nextAttemptedSet));
    }

    const passCount = results.filter((r) => r.status === "pass").length;
    const totalTests = results.length || (Array.isArray(p.testCases) ? p.testCases.length : 3);
    const maxMarks = p.marks || 10;
    const earnedMarks = Math.round((passCount / (totalTests || 1)) * maxMarks * 100) / 100;
    const statusStr = allPassed ? "ACCEPTED" : passCount > 0 ? "PARTIAL" : "WRONG_ANSWER";

    setCandidateCodingAnswers((prev) => {
      const updated = { ...prev };
      const entry = {
        code,
        language: lang,
        status: statusStr,
        testCasesPassed: passCount,
        totalTestCases: totalTests,
        marks: earnedMarks,
        submitted: isSubmit ? true : Boolean(prev[p.id]?.submitted),
      };
      if (p.id) updated[p.id] = entry;
      if (p.dbId) updated[p.dbId] = entry;
      if (p.legacyId) updated[p.legacyId] = entry;
      return updated;
    });

    const nextContestSessionProgress = {
      ...contestSessionProgress,
      ...(isSubmit && isContestProblem ? { [p.id]: allPassed ? "accepted" : "rejected" } : {}),
    };
    if (isSubmit && isContestProblem) {
      setContestSessionProgress(nextContestSessionProgress);
    }

    setRunResult({
      type: isSubmit ? "submit" : "run",
      passed: allPassed,
      status: status === "unsupported" ? "unsupported" : allPassed ? "passed" : "failed",
      tests: results,
      runtime,
      memory,
      beats,
    });

    if (isSubmit && authToken && currentUser.id) {
      await loadStudentPortalData(problemCatalog);
    }

    if (isSubmit) setSubmitting(false); else setRunning(false);
  };
  const handleEditorIndentation = (e, value, setter, ref, language = lang) => {
    const ta = ref.current;
    if (!ta) return;

    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selectedText = value.slice(start, end);
    const indentUnit = language === "javascript" ? "  " : "    ";

    // ── 0. KEYBOARD SHORTCUTS (Ctrl+/, Ctrl+Shift+F, Ctrl+S) ────────────────
    const isCmdOrCtrl = e.ctrlKey || e.metaKey;

    // Ctrl+/ or Cmd+/ : Toggle Line Comments
    if (isCmdOrCtrl && e.key === "/") {
      e.preventDefault();
      const prefix = language === "python" ? "# " : "// ";
      const lineStart = value.lastIndexOf("\n", start - 1) + 1;
      const lineEndIdx = value.indexOf("\n", end);
      const blockEnd = lineEndIdx === -1 ? value.length : lineEndIdx;
      const block = value.slice(lineStart, blockEnd);
      const lines = block.split("\n");

      const allCommented = lines.every((l) => l.trim().startsWith(prefix.trim()));
      const updatedLines = lines.map((l) => {
        if (allCommented) {
          return l.replace(new RegExp(`^(\\s*)${prefix === "# " ? "#\\s?" : "\\/\\/\\s?"}`), "$1");
        } else {
          return l.replace(/^(\s*)/, `$1${prefix}`);
        }
      });

      const nextValue = `${value.slice(0, lineStart)}${updatedLines.join("\n")}${value.slice(blockEnd)}`;
      setter(nextValue);
      setTimeout(() => {
        ta.selectionStart = lineStart;
        ta.selectionEnd = lineStart + updatedLines.join("\n").length;
      }, 0);
      return;
    }

    // Ctrl+Shift+F or Alt+Shift+F : Format Code
    if ((isCmdOrCtrl || e.altKey) && e.shiftKey && (e.key === "F" || e.key === "f")) {
      e.preventDefault();
      const formatted = formatCode(value, language);
      setter(formatted);
      return;
    }

    // Ctrl+S / Cmd+S : Quick Save & Prevent Browser Save Dialog
    if (isCmdOrCtrl && (e.key === "s" || e.key === "S")) {
      e.preventDefault();
      return;
    }

    // ── 1. BACKSPACE PAIR & TRIPLE-QUOTE CLEANUP ───────────────────────────
    if (e.key === "Backspace" && start === end && start > 0 && end < value.length) {
      // Python Triple Quotes Check
      if (start >= 3 && end <= value.length - 3) {
        const tripleBefore = value.slice(start - 3, start);
        const tripleAfter = value.slice(start, start + 3);
        if ((tripleBefore === '"""' && tripleAfter === '"""') || (tripleBefore === "'''" && tripleAfter === "'''")) {
          e.preventDefault();
          const nextValue = `${value.slice(0, start - 3)}${value.slice(start + 3)}`;
          setter(nextValue);
          setTimeout(() => {
            ta.selectionStart = ta.selectionEnd = start - 3;
          }, 0);
          return;
        }
      }

      // Single Pair Check
      const charBefore = value[start - 1];
      const charAfter = value[start];
      const isPair = (
        (charBefore === "(" && charAfter === ")") ||
        (charBefore === "[" && charAfter === "]") ||
        (charBefore === "{" && charAfter === "}") ||
        (charBefore === '"' && charAfter === '"') ||
        (charBefore === "'" && charAfter === "'") ||
        (charBefore === "`" && charAfter === "`")
      );
      if (isPair) {
        e.preventDefault();
        const nextValue = `${value.slice(0, start - 1)}${value.slice(end + 1)}`;
        setter(nextValue);
        setTimeout(() => {
          ta.selectionStart = ta.selectionEnd = start - 1;
        }, 0);
        return;
      }
    }

    // ── 2. AUTO-CLOSING BRACKETS, QUOTES & TRIPLE QUOTES ────────────────────
    const pairs = { "(": ")", "[": "]", "{": "}", '"': '"', "'": "'", "`": "`" };

    // Overwrite protection for closing characters
    if (start === end && (e.key in { ")":1, "]":1, "}":1, '"':1, "'":1, "`":1 })) {
      const nextChar = value[start];
      if (nextChar === e.key) {
        e.preventDefault();
        setTimeout(() => {
          ta.selectionStart = ta.selectionEnd = start + 1;
        }, 0);
        return;
      }
    }

    // Python Triple Quote Completion (""" or ''')
    if (language === "python" && start === end && (e.key === '"' || e.key === "'")) {
      const charTwoBefore = value.slice(Math.max(0, start - 2), start);
      if (charTwoBefore === e.key + e.key) {
        e.preventDefault();
        const nextValue = `${value.slice(0, start)}${e.key}${e.key}${e.key}${e.key}${value.slice(end)}`;
        setter(nextValue);
        setTimeout(() => {
          ta.selectionStart = ta.selectionEnd = start + 1;
        }, 0);
        return;
      }
    }

    // Insert pair for opening bracket or quote
    if (start === end && pairs[e.key]) {
      const closing = pairs[e.key];
      // Avoid auto-closing single/double quotes when attached to alphanumeric words (e.g. apostrophes in text)
      if ((e.key === "'" || e.key === '"') && start > 0 && /[a-zA-Z0-9]/.test(value[start - 1])) {
        // Normal typing
      } else {
        e.preventDefault();
        const nextValue = `${value.slice(0, start)}${e.key}${closing}${value.slice(end)}`;
        setter(nextValue);
        setTimeout(() => {
          ta.selectionStart = ta.selectionEnd = start + 1;
        }, 0);
        return;
      }
    }

    // Selection wrapping
    if (start !== end && pairs[e.key]) {
      e.preventDefault();
      const closing = pairs[e.key];
      const nextValue = `${value.slice(0, start)}${e.key}${selectedText}${closing}${value.slice(end)}`;
      setter(nextValue);
      setTimeout(() => {
        ta.selectionStart = start + 1;
        ta.selectionEnd = end + 1;
      }, 0);
      return;
    }

    // ── 3. TAB & SHIFT+TAB INDENTATION ────────────────────────────────────
    if (e.key === "Tab") {
      e.preventDefault();

      const lineStart = value.lastIndexOf("\n", start - 1) + 1;
      const hasMultipleLines = selectedText.includes("\n") || (start !== end && lineStart !== start);

      if (hasMultipleLines) {
        const blockEnd = end;
        const lineEnd = value.indexOf("\n", blockEnd);
        const selectionEnd = lineEnd === -1 ? value.length : lineEnd;
        const block = value.slice(lineStart, selectionEnd);
        const lines = block.split("\n");
        const updatedLines = e.shiftKey
          ? lines.map((line) => line.startsWith(indentUnit) ? line.slice(indentUnit.length) : line.startsWith(" ") ? line.slice(1) : line)
          : lines.map((line) => `${indentUnit}${line}`);
        const updatedBlock = updatedLines.join("\n");
        const nextValue = `${value.slice(0, lineStart)}${updatedBlock}${value.slice(selectionEnd)}`;
        const deltaPerFirstLine = e.shiftKey
          ? (lines[0].startsWith(indentUnit) ? -indentUnit.length : lines[0].startsWith(" ") ? -1 : 0)
          : indentUnit.length;
        const changedChars = updatedBlock.length - block.length;
        setter(nextValue);
        setTimeout(() => {
          ta.selectionStart = Math.max(lineStart, start + deltaPerFirstLine);
          ta.selectionEnd = Math.max(lineStart, end + changedChars);
        }, 0);
        return;
      }

      if (e.shiftKey) {
        const beforeCursor = value.slice(lineStart, start);
        if (beforeCursor.endsWith(indentUnit)) {
          const nextValue = `${value.slice(0, start - indentUnit.length)}${value.slice(end)}`;
          setter(nextValue);
          setTimeout(() => {
            ta.selectionStart = ta.selectionEnd = start - indentUnit.length;
          }, 0);
        }
        return;
      }

      const nextValue = `${value.slice(0, start)}${indentUnit}${value.slice(end)}`;
      setter(nextValue);
      setTimeout(() => {
        ta.selectionStart = ta.selectionEnd = start + indentUnit.length;
      }, 0);
      return;
    }

    // ── 4. SMART ENTER & AUTO INDENTATION ──────────────────────────────────
    if (e.key === "Enter") {
      e.preventDefault();
      const lineStart = value.lastIndexOf("\n", start - 1) + 1;
      const line = value.slice(lineStart, start);
      const currentIndent = (line.match(/^\s*/) || [""])[0];
      const trimmedLine = line.trimEnd();

      const isPythonBlock = language === "python" && /(:\s*|def\s+.*|class\s+.*|if\s+.*|elif\s+.*|else\s*:|for\s+.*|while\s+.*|try\s*:|except\s*.*|finally\s*:|with\s+.*|match\s+.*|case\s+.*)$/.test(trimmedLine);
      const isBraceBlock = /[\{\[\(]\s*$/.test(trimmedLine);
      const shouldIncreaseIndent = isBraceBlock || isPythonBlock;

      const nextChar = value.slice(end).charAt(0);
      const shouldCreateInnerLine = shouldIncreaseIndent && /[\}\]\)]/.test(nextChar);
      const nextIndent = `${currentIndent}${shouldIncreaseIndent ? indentUnit : ""}`;
      const nextValue = shouldCreateInnerLine
        ? `${value.slice(0, start)}\n${nextIndent}\n${currentIndent}${value.slice(end)}`
        : `${value.slice(0, start)}\n${nextIndent}${value.slice(end)}`;
      setter(nextValue);
      setTimeout(() => {
        const cursor = start + 1 + nextIndent.length;
        ta.selectionStart = ta.selectionEnd = cursor;
      }, 0);
      return;
    }

    // ── 5. CLOSING BRACE & KEYWORD DEDENTATION ────────────────────────────
    if (/^[\}\]\)]$/.test(e.key) && start === end) {
      const lineStart = value.lastIndexOf("\n", start - 1) + 1;
      const beforeCursor = value.slice(lineStart, start);
      if (/^\s+$/.test(beforeCursor)) {
        const removableIndent = beforeCursor.endsWith(indentUnit) ? indentUnit.length : 1;
        e.preventDefault();
        const nextValue = `${value.slice(0, start - removableIndent)}${e.key}${value.slice(end)}`;
        setter(nextValue);
        setTimeout(() => {
          ta.selectionStart = ta.selectionEnd = start - removableIndent + 1;
        }, 0);
      }
    }
  };

  const rawProblemList = problemBank;
  const problemCatalog = rawProblemList.filter((p) => {
    const probType = p.type || (Array.isArray(p.options) && p.options.length ? "theory" : "coding");
    const hasMcqTag = Array.isArray(p.tags) && p.tags.some((t) => String(t).toUpperCase() === "MCQ");
    const isMcqAcceptance = String(p.acceptance || "").toLowerCase().includes("mcq");
    const isTheory = probType === "theory" || (Array.isArray(p.options) && p.options.length > 0) || hasMcqTag || isMcqAcceptance;
    return !isTheory;
  });
  const filteredProblems = problemCatalog.filter(p =>
    (filterDiff === "All" || p.difficulty === filterDiff) &&
    p.title.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const activeContestAssignment = activeAssignment || (currentUser.role === "admin" && adminCurrentTest.status === "LIVE" ? adminCurrentTest : null);
  const activeContestOptions = activeAssignments.length
    ? activeAssignments
    : (activeContestAssignment ? [activeContestAssignment] : []);
  const contestDisplayName = activeContestAssignment?.title
    || (adminCurrentTest.title === "Current Test" ? "Weekly Coding Contest #1" : adminCurrentTest.title);
  const contestStatus = !activeContestAssignment
    ? "Awaiting Start"
    : contestSessionEndsAt && contestTimerSeconds <= 0
      ? "Ended"
      : "Live";
  const contestStatusTone = contestStatus === "Live"
    ? { color:"#73f0b3", border:"#1f4e3a", background:"#0e1b15" }
    : contestStatus === "Ended"
      ? { color:"#ff9b9b", border:"#5a262d", background:"#1b0f13" }
      : { color:"#93c5fd", border:"#2d4f7b", background:"#0f1727" };
  const contestProblems = (activeContestAssignment?.problems?.length ? activeContestAssignment.problems : adminCurrentTest.problems || [])
    .map((problem, index) => {
      if (!problem) return null;

      const pKey = problem.id || problem.dbId;
      const savedAns = candidateCodingAnswers[pKey] || candidateCodingAnswers[problem.id] || candidateCodingAnswers[problem.legacyId];
      const savedTheory = candidateTheoryAnswers[pKey] || candidateTheoryAnswers[problem.id] || candidateTheoryAnswers[problem.legacyId];
      const isSubmitted = Boolean(savedAns?.submitted || savedTheory || solved.has(problem.id));

      const status = isSubmitted
        ? {
            icon: "✔",
            label: savedAns?.status === "ACCEPTED" || solved.has(problem.id) ? "Submitted" : (savedAns?.status || "Submitted"),
            color: "#73f0b3",
            background: "#0f1c15",
            border: "#1f4e3a",
          }
        : attemptedProblems.has(problem.id)
          ? {
              icon: "❌",
              label: "Attempted",
              color: "#ff9b9b",
              background: "#1a1014",
              border: "#5a262d",
            }
          : {
              icon: "⏳",
              label: "No Submission",
              color: "#94a3b8",
              background: "#191309",
              border: "#334155",
            };

      return {
        ...problem,
        contestScore: Math.max(20, 40 - (index * 5)),
        contestStatusMeta: status,
      };
    })
    .filter(Boolean);
  const contestProblemSet = contestProblems.filter(Boolean);
  const hasUsedContestAttempt = Boolean(
    activeContestAssignment?.attempt
    && activeContestAssignment.attempt.status !== "IN_PROGRESS"
    && !contestEntered
  );
  const catalogProblemSet = problemCatalog.filter(Boolean);
  const problemNavigation = problemNavigationSource === "contest" && contestProblemSet.length
    ? contestProblemSet
    : catalogProblemSet;
  const selectedProblemIndex = selectedProblem
    ? problemNavigation.findIndex((problem) => (
        sameValue(problem.id, selectedProblem.id)
        || sameValue(problem.dbId, selectedProblem.dbId)
      ))
    : -1;
  const hasPreviousProblem = selectedProblemIndex > 0;
  const hasNextProblem = selectedProblemIndex > -1 && selectedProblemIndex < problemNavigation.length - 1;
  const showProblemNavigation = problemNavigation.length > 1 && selectedProblemIndex > -1;
  const isContestProblem = problemNavigationSource === "contest" && contestEntered;
  const isFinalContestProblem = isContestProblem && selectedProblemIndex === problemNavigation.length - 1;
  const openAdjacentProblem = (offset) => {
    if (selectedProblemIndex < 0) return;

    const nextProblem = problemNavigation[selectedProblemIndex + offset];
    if (nextProblem) {
      openProblem(nextProblem, problemNavigationSource);
    }
  };
  const handleSubmitClick = () => {
    if (isFinalContestProblem) {
      setFinalSubmitConfirmOpen(true);
      return;
    }
    simulateRun(true);
  };
  const confirmFinalSubmit = () => {
    setFinalSubmitConfirmOpen(false);
    if (problemNavigationSource === "contest" || contestEntered) {
      handleFinalSubmitAssessment();
    } else {
      simulateRun(true);
    }
  };
  const leaderboardMode = leaderboardScope === "This Contest"
    ? "contest"
    : leaderboardScope === "Global"
      ? "global"
      : "overall";

  const filteredLeaderboard = leaderboard.filter((entry) => {
    if (leaderboardScope === "This Contest") {
      return entry.hasContestSubmission;
    }
    return true;
  });

  const leaderboardRows = filteredLeaderboard
    .map((entry) => ({
      ...entry,
      stats: entry[leaderboardMode],
    }))
    .filter((entry) =>
      entry.username.toLowerCase().includes(leaderboardSearch.trim().toLowerCase())
    )
    .sort((a, b) => {
      const aRank = a.stats?.rank || 999999;
      const bRank = b.stats?.rank || 999999;
      return aRank - bRank;
    })
    .map((entry, idx) => ({
      ...entry,
      displayRank: idx + 1,
    }));
  const leaderboardPageSize = 5;
  const leaderboardPageCount = Math.max(1, Math.ceil(leaderboardRows.length / leaderboardPageSize));
  const safeLeaderboardPage = Math.min(leaderboardPage, leaderboardPageCount);
  const visibleLeaderboardRows = leaderboardRows.slice(
    (safeLeaderboardPage - 1) * leaderboardPageSize,
    safeLeaderboardPage * leaderboardPageSize,
  );
  const getAvatarLabel = (name) =>
    name
      .split(" ")
      .map((part) => part.charAt(0).toUpperCase())
      .join("")
      .slice(0, 2);
  const getTrendMeta = (trend) =>
    trend > 0
      ? { icon: "↑", color: "#73f0b3", label: `Up ${trend}` }
      : trend < 0
        ? { icon: "↓", color: "#ff9b9b", label: `Down ${Math.abs(trend)}` }
        : { icon: "→", color: "#8f93b4", label: "No change" };
  const getLeaderboardAccent = (rank) => {
    if (rank === 1) {
      return {
        edge: "#f3c969",
        glow: "0 18px 42px rgba(243, 201, 105, 0.18)",
        background: "linear-gradient(90deg, rgba(243,201,105,0.16), rgba(17,17,24,0.94) 18%)",
        badge: "🥇",
      };
    }
    if (rank === 2) {
      return {
        edge: "#cfd6df",
        glow: "0 18px 42px rgba(207, 214, 223, 0.16)",
        background: "linear-gradient(90deg, rgba(207,214,223,0.14), rgba(17,17,24,0.94) 18%)",
        badge: "🥈",
      };
    }
    if (rank === 3) {
      return {
        edge: "#c58a5c",
        glow: "0 18px 42px rgba(197, 138, 92, 0.18)",
        background: "linear-gradient(90deg, rgba(197,138,92,0.14), rgba(17,17,24,0.94) 18%)",
        badge: "🥉",
      };
    }
    return {
      edge: "#25283a",
      glow: "none",
      background: "transparent",
      badge: null,
    };
  };
  const ADMIN_THEME = {
    background: "#F9FAFB",
    card: "#FFFFFF",
    border: "#E5E7EB",
    hoverBackground: "#F3F4F6",
    primary: "#2563EB",
    primaryHover: "#1D4ED8",
    primaryLight: "#DBEAFE",
    secondary: "#7C3AED",
    secondaryHover: "#6D28D9",
    text: "#111827",
    textSecondary: "#4B5563",
    textMuted: "#9CA3AF",
    success: "#16A34A",
    warning: "#D97706",
    error: "#DC2626",
    info: "#2563EB",
    sidebarBackground: "#FFFFFF",
    sidebarActive: "#DBEAFE",
    buttonSecondary: "#F3F4F6",
    divider: "#E5E7EB",
    shadowSoft: "0 1px 3px rgba(0,0,0,0.05)",
    shadowHover: "0 10px 25px rgba(0,0,0,0.05)",
  };

  const getSubmissionLevelMeta = (level) => {
    if (level === "Hard") {
      return { color: ADMIN_THEME.error, border: "rgba(220, 38, 38, 0.2)", background: "rgba(220, 38, 38, 0.08)" };
    }
    if (level === "Medium") {
      return { color: ADMIN_THEME.warning, border: "rgba(217, 119, 6, 0.2)", background: "rgba(217, 119, 6, 0.08)" };
    }
    if (level === "Easy") {
      return { color: ADMIN_THEME.success, border: "rgba(22, 163, 74, 0.2)", background: "rgba(22, 163, 74, 0.08)" };
    }
    return { color: ADMIN_THEME.textMuted, border: ADMIN_THEME.border, background: ADMIN_THEME.hoverBackground };
  };

  // ── STYLES ─────────────────────────────────────────────────────────────────
  const formatDisplayName = (value) =>
    value
      .split(/[\s._-]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  const profileName = currentUser.name.trim()
    || (currentUser.email ? formatDisplayName(currentUser.email.split("@")[0]) : "User");
  const matchedLeaderboardProfile = leaderboard.find(
    (entry) => entry.userId === currentUser.id || entry.username.toLowerCase() === profileName.toLowerCase()
  );
  const profileEntry = matchedLeaderboardProfile || null;
  const profileAvatarGradient = profileEntry?.avatarGradient || ["#60a5fa", "#8b5cf6"];
  const currentAchievement = getAchievementBadgeMeta(currentUser.badgeTier);
  const acceptedSubmissionCount = userSubmissions.filter((submission) => submission.status === "ACCEPTED").length;
  const submissionAccuracy = userSubmissions.length
    ? `${Math.round((acceptedSubmissionCount / userSubmissions.length) * 100)}%`
    : "--";
  const profileStats = [
    { label: "Problems Solved", value: solved.size, accent: "#60a5fa" },
    { label: "Accuracy %", value: submissionAccuracy, accent: "#22d3ee" },
    { label: "Contest Rating", value: profileEntry?.rating ?? "--", accent: "#8b5cf6" },
    { label: "Global Rank", value: profileEntry?.global?.rank ? `#${profileEntry.global.rank}` : "--", accent: "#a78bfa" },
  ];
  const profileDetails = [
    { label: "Email", value: currentUser.email || "--" },
    { label: "Department", value: currentUser.department || "--" },
    { label: "Role", value: currentUser.role ? formatDisplayName(currentUser.role) : "--" },
    { label: "Joined", value: formatPortalDate(currentUser.createdAt) },
    { label: "Last Login", value: formatPortalDate(currentUser.lastLoginAt) },
    { label: "Login Count", value: String(currentUser.loginCount || 0) },
    { label: "Achievement Badge", value: currentUser.badgeLabel || "Not earned yet" },
    { label: "Verified", value: currentUser.verified ? "Yes" : "No" },
  ];
  const solvedEasy = Array.from(solved).filter((id) => problemCatalog.find((problem) => problem.id === id)?.difficulty === "Easy").length;
  const solvedMedium = Array.from(solved).filter((id) => problemCatalog.find((problem) => problem.id === id)?.difficulty === "Medium").length;
  const solvedHard = Array.from(solved).filter((id) => problemCatalog.find((problem) => problem.id === id)?.difficulty === "Hard").length;
  const totalSolvedCount = solvedEasy + solvedMedium + solvedHard;
  const profileDifficultyBreakdown = [
    { label: "Easy", value: solvedEasy, total: totalSolvedCount || 1, color: "#22c55e" },
    { label: "Medium", value: solvedMedium, total: totalSolvedCount || 1, color: "#facc15" },
    { label: "Hard", value: solvedHard, total: totalSolvedCount || 1, color: "#ef4444" },
  ];
  const profileSubmissionHistory = userSubmissions.slice(0, 6).map((submission) => ({
    problemId: submission.problem?.number ?? submission.problem?.legacyId ?? submission.problemId,
    problemDbId: submission.problem?.id ?? submission.problemId,
    problemName: submission.problem?.title || "Unknown Problem",
    status: submission.status === "ACCEPTED"
      ? "Accepted"
      : submission.status === "WRONG_ANSWER"
        ? "Wrong Answer"
        : submission.status === "TIME_LIMIT_EXCEEDED" || submission.status === "TLE"
          ? "Time Limit"
          : formatDisplayName(String(submission.status || "").toLowerCase()),
    language: formatDisplayName(submission.language || "--"),
    time: formatPortalDate(submission.createdAt),
  }));
  const profileContestHistory = profileEntry ? [
    {
      name: activeAssignment?.title || contestDisplayName || "Current Contest",
      rank: profileEntry.contest?.rank ? `#${profileEntry.contest.rank}` : "--",
      score: profileEntry.contest?.score ?? "--",
      rating: profileEntry.rating ?? "--",
    },
  ] : [];
  const liftCard = (e) => {
    e.currentTarget.style.transform = "translateY(-4px)";
    e.currentTarget.style.boxShadow = "0 22px 50px rgba(37, 99, 235, 0.16)";
  };
  const settleCard = (e) => {
    e.currentTarget.style.transform = "translateY(0)";
    e.currentTarget.style.boxShadow = "0 14px 34px rgba(15, 23, 42, 0.32)";
  };
  const isPhone = viewportWidth < 640;
  const isTablet = viewportWidth >= 640 && viewportWidth < 1024;
  const isCompact = viewportWidth < 900;
  const pageGutter = isPhone ? 14 : isTablet ? 20 : 24;
  const compactGrid = "minmax(0, 1fr)";
  const S = {
    app:  { fontFamily:"'Outfit','Space Grotesk',sans-serif", background:"#0a0a0f", color:"#e0e0e0", minHeight:"100vh", display:"flex", flexDirection:"column", overflowX:"hidden" },
    adminApp: { fontFamily:"'Outfit','Space Grotesk',sans-serif", background:ADMIN_THEME.background, color:ADMIN_THEME.text, minHeight:"100vh", display:"flex", flexDirection:"column", overflowX:"hidden" },
    nav:  { background:"#111118", borderBottom:"1px solid #1e1e2e", padding:`10px ${pageGutter}px`, display:"flex", alignItems:"center", minHeight:isPhone ? 60 : 72, gap:isPhone ? 10 : 24, position:"sticky", top:0, zIndex:100, flexWrap:"wrap" },
    adminNav: { background:ADMIN_THEME.sidebarBackground, borderBottom:`1px solid ${ADMIN_THEME.divider}`, boxShadow:ADMIN_THEME.shadowSoft, padding:`10px ${pageGutter}px`, display:"flex", alignItems:"center", minHeight:isPhone ? 60 : 72, gap:isPhone ? 10 : 24, position:"sticky", top:0, zIndex:100, flexWrap:"wrap" },
    adminNavTitle: { color:ADMIN_THEME.text, fontSize:15, fontWeight:700, fontFamily:"'Space Grotesk',sans-serif", letterSpacing:"0.03em" },
    logo: { fontFamily:"'Space Grotesk',sans-serif", fontWeight:800, fontSize:20, background:"linear-gradient(135deg,#7c6af7,#4fd1c5)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", cursor:"pointer", letterSpacing:"-0.5px" },
    navBtn: (a) => ({ background:"none", border:"none", color:a?"#fff":"#666", cursor:"pointer", padding:"6px 0", borderBottom:a?"2px solid #7c6af7":"2px solid transparent", fontFamily:"'Space Grotesk',sans-serif", fontWeight:600, letterSpacing:"0.03em", display:"flex", flexDirection:"column", alignItems:"flex-start", gap:2 }),
    navBtnLabel: (a) => ({ color:a?"#fff":"#8a8ea8", fontSize:13.5, fontWeight:600, lineHeight:1.1 }),
    navBtnHint: (a) => ({ color:a?"#979cff":"#5f647f", fontSize:10.5, fontWeight:500, lineHeight:1.1, letterSpacing:"0.02em" }),
    badge: (d) => ({ padding:"3px 11px", borderRadius:999, fontSize:11, fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase", fontFamily:"'Space Grotesk',sans-serif", background:d==="Easy"?"#00b8a315":d==="Medium"?"#ffc01e15":"#ff375f15", color:d==="Easy"?"#00b8a3":d==="Medium"?"#ffc01e":"#ff375f" }),
    tag:  { background:"#151526", color:"#9aa0d2", padding:"4px 10px", borderRadius:999, fontSize:10.5, border:"1px solid #2a2a3e", fontFamily:"'Space Grotesk',sans-serif", fontWeight:600, letterSpacing:"0.05em", textTransform:"uppercase" },
    btn:  (v) => ({ padding:"8px 18px", borderRadius:6, border:"none", cursor:"pointer", fontWeight:700, fontSize:12.5, fontFamily:"'Space Grotesk',sans-serif", letterSpacing:"0.04em", textTransform:"uppercase", transition:"all 0.15s",
      ...(v==="run"    ? { background:"#1a2a1a", color:"#4ade80", border:"1px solid #2a3a2a" }
        : v==="submit" ? { background:"linear-gradient(135deg,#7c6af7,#4fd1c5)", color:"#fff" }
        :                { background:"#1e1e2e", color:"#aaa", border:"1px solid #2a2a3e" }) }),
    tableHead: { padding:"12px 16px", textAlign:"left", fontSize:11, color:"#636782", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.12em", fontFamily:"'Space Grotesk',sans-serif" },
    tableTitle: { color:"#ecedff", fontWeight:600, fontSize:15.5, fontFamily:"'Outfit','Space Grotesk',sans-serif", letterSpacing:"-0.01em" },
    problemTitle: { fontFamily:"'Fraunces',serif", fontSize:isPhone ? 24 : 30, fontWeight:700, color:"#fff", margin:0, lineHeight:1.08, letterSpacing:"-0.03em" },
    problemBody: { fontFamily:"'Outfit','Space Grotesk',sans-serif", lineHeight:1.8, color:"#c9cbe2", fontSize:isPhone ? 14.5 : 15.5, marginBottom:24, letterSpacing:"0.01em" },
    sectionLabel: { fontFamily:"'Space Grotesk',sans-serif", fontSize:11, fontWeight:700, color:"#7a7f9e", letterSpacing:"0.14em", textTransform:"uppercase", marginBottom:10 },
    exampleCard: { background:"linear-gradient(180deg,#12121d,#0d0d15)", border:"1px solid #25253b", borderRadius:12, padding:"16px 18px", fontSize:13.5, boxShadow:"inset 0 1px 0 #ffffff08" },
    exampleFieldLabel: { color:"#6f7396", fontFamily:"'Space Grotesk',sans-serif", fontSize:10.5, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase" },
    exampleFieldValue: { color:"#e6e8fb", fontFamily:"'JetBrains Mono',monospace", fontSize:13.5, lineHeight:1.8 },
    constraintItem: { color:"#8f93b4", fontFamily:"'Outfit','Space Grotesk',sans-serif", fontSize:14, lineHeight:1.85, letterSpacing:"0.01em" },
    heroShell: { maxWidth:1100, margin:"0 auto", width:"100%", boxSizing:"border-box", padding:isPhone ? "28px 14px 46px" : `56px ${pageGutter}px 72px` },
    homeGrid: { display:"grid", gridTemplateColumns:isCompact ? compactGrid : "1.15fr 0.85fr", gap:isPhone ? 14 : 24, alignItems:"stretch" },
    heroPanel: { background:"radial-gradient(circle at top left,#1f1d3d,#0f1018 58%)", border:"1px solid #2a2a3e", borderRadius:isPhone ? 18 : 24, padding:isPhone ? "24px 18px" : "36px 34px", boxShadow:"0 20px 60px #00000045" },
    roleCard: { background:"linear-gradient(180deg,#141422,#0d0d15)", border:"1px solid #26263d", borderRadius:20, padding:"22px 20px", display:"flex", flexDirection:"column", gap:12, boxShadow:"inset 0 1px 0 #ffffff08" },
    homeTitle: { fontFamily:"'Fraunces',serif", fontSize:isPhone ? 34 : isTablet ? 44 : 52, lineHeight:1.04, margin:"0 0 18px", color:"#fff", letterSpacing:"-0.04em" },
    formWrap: { maxWidth:560, width:"100%", boxSizing:"border-box", margin:isPhone ? "24px auto 0" : "42px auto 0", background:"linear-gradient(180deg,#141422,#0d0d15)", border:"1px solid #25253b", borderRadius:isPhone ? 18 : 24, padding:isPhone ? "22px 16px 24px" : "28px 26px 30px", boxShadow:"0 18px 50px #00000045" },
    fieldLabel: { display:"block", marginBottom:8, color:"#8f93b4", fontSize:11, fontWeight:700, letterSpacing:"0.12em", textTransform:"uppercase", fontFamily:"'Space Grotesk',sans-serif" },
    input: { width:"100%", boxSizing:"border-box", background:"#0f1018", border:"1px solid #26263d", color:"#eef0ff", borderRadius:12, padding:"13px 14px", fontSize:14, outline:"none", fontFamily:"'Outfit','Space Grotesk',sans-serif" },
    adminFieldLabel: { display:"block", marginBottom:8, color:ADMIN_THEME.textSecondary, fontSize:11, fontWeight:700, letterSpacing:"0.12em", textTransform:"uppercase", fontFamily:"'Space Grotesk',sans-serif" },
    adminInput: { width:"100%", boxSizing:"border-box", background:ADMIN_THEME.card, border:`1px solid ${ADMIN_THEME.border}`, color:ADMIN_THEME.text, borderRadius:12, padding:"13px 14px", fontSize:14, outline:"none", fontFamily:"'Outfit','Space Grotesk',sans-serif", boxShadow:ADMIN_THEME.shadowSoft },
    adminTextarea: { width:"100%", boxSizing:"border-box", background:ADMIN_THEME.card, border:`1px solid ${ADMIN_THEME.border}`, color:ADMIN_THEME.text, borderRadius:12, padding:"13px 14px", fontSize:14, outline:"none", resize:"vertical", minHeight:120, fontFamily:"'Outfit','Space Grotesk',sans-serif", lineHeight:1.6, boxShadow:ADMIN_THEME.shadowSoft },
    adminButton: (variant) => ({
      padding:"10px 18px",
      borderRadius:8,
      border:`1px solid ${ADMIN_THEME.divider}`,
      cursor:"pointer",
      fontWeight:700,
      fontSize:12.5,
      fontFamily:"'Space Grotesk',sans-serif",
      letterSpacing:"0.04em",
      textTransform:"uppercase",
      transition:"all 0.15s ease",
      boxShadow:ADMIN_THEME.shadowSoft,
      ...(variant === "run"
        ? { background:ADMIN_THEME.secondary, color:"#FFFFFF", border:`1px solid ${ADMIN_THEME.secondary}` }
        : variant === "submit"
          ? { background:ADMIN_THEME.primary, color:"#FFFFFF", border:`1px solid ${ADMIN_THEME.primary}` }
          : { background:ADMIN_THEME.buttonSecondary, color:ADMIN_THEME.textSecondary, border:`1px solid ${ADMIN_THEME.divider}` }),
    }),
    adminTabBar: { display:"flex", gap:10, flexWrap:"wrap", alignItems:"center", padding:"10px", background:ADMIN_THEME.card, border:`1px solid ${ADMIN_THEME.divider}`, borderRadius:14, boxShadow:ADMIN_THEME.shadowSoft },
    adminTabButton: (active) => ({
      padding:"10px 14px",
      borderRadius:8,
      border:active ? `1px solid ${ADMIN_THEME.primary}` : `1px solid ${ADMIN_THEME.divider}`,
      background:active ? ADMIN_THEME.primary : ADMIN_THEME.buttonSecondary,
      color:active ? "#FFFFFF" : ADMIN_THEME.textSecondary,
      cursor:"pointer",
      fontWeight:700,
      fontSize:12,
      fontFamily:"'Space Grotesk',sans-serif",
      letterSpacing:"0.04em",
      textTransform:"uppercase",
      transition:"all 0.15s ease",
    }),
    backButtonRow: { display:"flex", alignItems:"center", gap:12, flexWrap:"wrap" },
    backButton: {
      display:"inline-flex",
      alignItems:"center",
      gap:8,
      padding:"10px 14px",
      borderRadius:999,
      border:"1px solid #2a2a3e",
      background:"#151526",
      color:"#d9dcf7",
      cursor:"pointer",
      fontSize:12,
      fontWeight:700,
      fontFamily:"'Space Grotesk',sans-serif",
      letterSpacing:"0.08em",
      textTransform:"uppercase",
      boxShadow:"0 10px 24px rgba(0,0,0,0.16)",
    },
    adminAlert: (tone) => ({
      borderRadius:14,
      padding:"12px 14px",
      fontSize:13,
      border:`1px solid ${tone === "warning"
        ? "rgba(217, 119, 6, 0.18)"
        : tone === "error"
          ? "rgba(220, 38, 38, 0.18)"
          : tone === "success"
            ? "rgba(22, 163, 74, 0.18)"
            : "rgba(37, 99, 235, 0.18)"}`,
      background:tone === "warning"
        ? "rgba(217, 119, 6, 0.08)"
        : tone === "error"
          ? "rgba(220, 38, 38, 0.08)"
          : tone === "success"
            ? "rgba(22, 163, 74, 0.08)"
            : ADMIN_THEME.primaryLight,
      color:tone === "warning"
        ? ADMIN_THEME.warning
        : tone === "error"
          ? ADMIN_THEME.error
          : tone === "success"
            ? ADMIN_THEME.success
            : ADMIN_THEME.info,
    }),
    adminBlank: { flex:1, background:ADMIN_THEME.background },
    modalBackdrop: { position:"fixed", inset:0, background:"#05050bcc", backdropFilter:"blur(8px)", display:"flex", alignItems:"center", justifyContent:"center", padding:isPhone ? "12px" : "24px", zIndex:1200 },
    modalCard: { width:"min(720px, 100%)", boxSizing:"border-box", maxHeight:isPhone ? "calc(100vh - 24px)" : "calc(100vh - 48px)", overflowY:"auto", background:"linear-gradient(180deg,#141422,#0d0d15)", border:"1px solid #25253b", borderRadius:isPhone ? 18 : 24, padding:isPhone ? "22px 16px 24px" : "28px 26px 30px", boxShadow:"0 24px 70px #00000065" },
    startHero: { position:"relative", overflow:"hidden", background:"radial-gradient(circle at 15% 20%, #1c2350 0%, #10111b 42%, #09090f 100%)", border:"1px solid #24263a", borderRadius:isPhone ? 20 : 30, padding:isPhone ? "30px 18px" : "52px 48px", boxShadow:"0 26px 70px #0000004f" },
    startButton: { padding:"14px 24px", borderRadius:16, border:"none", cursor:"pointer", fontWeight:800, fontSize:15, fontFamily:"'Space Grotesk',sans-serif", letterSpacing:"0.08em", textTransform:"uppercase", color:"#fff", background:"linear-gradient(135deg,#7c6af7,#4fd1c5)", boxShadow:"0 16px 30px #7c6af733" },
    authChoiceGrid: { display:"grid", gridTemplateColumns:isPhone ? compactGrid : "repeat(2, minmax(0, 1fr))", gap:12 },
    authChoiceButton: (active, tone) => ({
      background: active ? (tone==="student" ? "#101f1b" : tone==="admin" ? "#1d1508" : "#18192a") : "#0f1018",
      border: active ? (tone==="student" ? "1px solid #2e8f76" : tone==="admin" ? "1px solid #7d5d16" : "1px solid #7c6af7") : "1px solid #202233",
      borderRadius:16,
      padding:"18px 16px",
      cursor:"pointer",
      textAlign:"left",
      color:"#eef0ff"
    }),
    startInfoGrid: { display:"grid", gridTemplateColumns:isCompact ? compactGrid : "repeat(3, minmax(0, 1fr))", gap:14, marginTop:28 },
    startInfoCard: { background:"#0f1018cc", border:"1px solid #222538", borderRadius:18, padding:"16px 16px 18px", boxShadow:"inset 0 1px 0 #ffffff08" },
    startPillRow: { display:"flex", gap:10, flexWrap:"wrap", marginTop:20 },
    startPill: { padding:"8px 12px", borderRadius:999, background:"#ffffff08", border:"1px solid #ffffff12", color:"#d9dcf7", fontSize:12, fontWeight:600, letterSpacing:"0.02em" },
    authStepper: { display:"flex", alignItems:"center", gap:10, flexWrap:"wrap", marginBottom:20 },
    authStepChip: (active) => ({
      padding:"8px 12px",
      borderRadius:999,
      border: active ? "1px solid #7c6af7" : "1px solid #202233",
      background: active ? "#17192a" : "#0f1018",
      color: active ? "#eef0ff" : "#7f84a5",
      fontSize:11,
      fontWeight:700,
      letterSpacing:"0.1em",
      textTransform:"uppercase",
      fontFamily:"'Space Grotesk',sans-serif"
    }),
    adminShell: { maxWidth:1240, margin:"0 auto", width:"100%", boxSizing:"border-box", padding:isPhone ? "18px 14px 32px" : `28px ${pageGutter}px 40px`, display:"grid", gap:isPhone ? 16 : 22 },
    adminCardGrid: { display:"grid", gridTemplateColumns:`repeat(auto-fit, minmax(${isPhone ? 150 : 220}px, 1fr))`, gap:isPhone ? 12 : 16 },
    adminCard: { background:ADMIN_THEME.card, border:`1px solid ${ADMIN_THEME.border}`, borderRadius:18, padding:"18px 18px 20px", boxShadow:ADMIN_THEME.shadowSoft },
    adminSectionTitle: { fontFamily:"'Space Grotesk',sans-serif", fontSize:12, fontWeight:700, color:ADMIN_THEME.textSecondary, letterSpacing:"0.12em", textTransform:"uppercase", marginBottom:12 },
    adminGridTwo: { display:"grid", gridTemplateColumns:isCompact ? compactGrid : "1.35fr 0.95fr", gap:18, alignItems:"start" },
    adminTableWrap: { background:ADMIN_THEME.card, border:`1px solid ${ADMIN_THEME.border}`, borderRadius:18, overflowX:"auto", boxShadow:ADMIN_THEME.shadowSoft },
    adminTableHead: { padding:"14px 16px", textAlign:"left", fontSize:11, color:ADMIN_THEME.textSecondary, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.1em", fontFamily:"'Space Grotesk',sans-serif", background:ADMIN_THEME.hoverBackground },
    adminTableCell: { padding:"14px 16px", borderTop:`1px solid ${ADMIN_THEME.divider}`, fontSize:14, color:ADMIN_THEME.text },
    adminSubCard: { background:ADMIN_THEME.hoverBackground, border:`1px solid ${ADMIN_THEME.border}`, borderRadius:14, padding:"14px" },
  };

  const userBadge = currentUser.name
    ? currentUser.name.trim().charAt(0).toUpperCase()
    : currentUser.email
      ? currentUser.email.trim().charAt(0).toUpperCase()
    : userRole === "admin"
      ? "A"
      : "U";
  const profileAvatarLabel = getAvatarLabel(profileName || "U");
  const adminSelectedProblem = adminCurrentTest.problems?.find((problem) => problem.id === adminSubmissionProblemId)
    || problemCatalog.find((problem) => problem.id === adminSubmissionProblemId)
    || problemCatalog[0];
  const currentTestEnded = adminCurrentTest.status === "ENDED" || adminTimerSeconds === 0;
  const adminCurrentStatus = adminCurrentTest.status || "DRAFT";
  const adminCurrentStatusColor = adminCurrentStatus === "LIVE"
    ? ADMIN_THEME.success
    : adminCurrentStatus === "ENDED"
      ? ADMIN_THEME.error
      : ADMIN_THEME.info;
  const liveAdminAssignments = adminAssignments.filter((assignment) => assignment.status === "LIVE");
  const selectableAdminAssignments = adminAssignments.length ? adminAssignments : [adminCurrentTest].filter(Boolean);
  const loggedInRegisteredStudents = registeredStudents.filter((student) => Number(student.loginCount || 0) > 0);
  const neverLoggedInStudents = registeredStudents.filter((student) => Number(student.loginCount || 0) === 0);
  const departmentTotal = new Set(
    registeredStudents
      .map((student) => String(student.department || "").trim())
      .filter(Boolean)
  ).size;
  const adminLoginEvents = loginEvents.filter((event) => (
    event.role === "ADMIN" || event.email === currentUser.email
  ));
  const displayedProblemBank = problemBank.filter((problem) => {
    const categoryMatch = questionCategoryFilter === "All" || getProblemCategory(problem) === questionCategoryFilter;
    const probType = problem.type || (Array.isArray(problem.options) && problem.options.length ? "theory" : "coding");
    const typeMatch = questionTypeFilter === "All"
      ? true
      : questionTypeFilter === "theory"
      ? (probType === "theory" || (Array.isArray(problem.options) && problem.options.length > 0))
      : (probType === "coding" && (!Array.isArray(problem.options) || problem.options.length === 0));
    return categoryMatch && typeMatch;
  });
  const latestUnreadNotification = studentNotifications.find((notification) => !notification.read) || studentNotifications[0] || null;
  const formatDurationFromMs = (ms = 0) => {
    const totalSeconds = Math.max(0, Math.floor(Number(ms || 0) / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return hours > 0
      ? `${hours}h ${String(minutes).padStart(2, "0")}m`
      : `${minutes}m ${String(seconds).padStart(2, "0")}s`;
  };

  const renderAdminLeaderboard = () => (
    <div style={{ display:"grid", gap:18 }}>
      <div style={S.adminCard}>
        <div style={{ display:"flex", justifyContent:"space-between", gap:16, alignItems:"flex-start", flexWrap:"wrap" }}>
          <div>
            <div style={S.adminSectionTitle}>Leaderboard</div>
            <div style={{ fontSize:24, fontWeight:800, color:ADMIN_THEME.text, marginBottom:6 }}>Admin Ranking Board</div>
            <div style={{ color:ADMIN_THEME.textSecondary, fontSize:14 }}>Contest, overall, and global scores are loaded from stored submissions.</div>
          </div>
          <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
            <input value={leaderboardSearch} onChange={(e)=>setLeaderboardSearch(e.target.value)} placeholder="Search username" style={{ ...S.adminInput, width:220 }} />
            <select value={leaderboardScope} onChange={(e)=>setLeaderboardScope(e.target.value)} style={{ ...S.adminInput, width:170 }}>
              {["All", "This Contest", "Global"].map((scope) => <option key={scope}>{scope}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div style={S.adminTableWrap}>
        <table style={{ width:"100%", borderCollapse:"collapse" }}>
          <thead>
            <tr>
              {["Rank", "Username", "Badge", "Score", "Solved", "Time Penalty"].map((heading) => (
                <th key={heading} style={S.adminTableHead}>{heading}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleLeaderboardRows.length ? visibleLeaderboardRows.map((entry) => {
              const stats = entry.stats || entry.contest || {};
              const submissionLevel = stats.submissionLevel || "No Submission";
              const levelMeta = getSubmissionLevelMeta(submissionLevel);
              return (
                <tr key={`${leaderboardMode}-${entry.userId || entry.username}`}>
                  <td style={S.adminTableCell}>{stats.rank || "--"}</td>
                  <td style={S.adminTableCell}>
                    <div style={{ color:ADMIN_THEME.text, fontWeight:700 }}>{entry.username}</div>
                    <div style={{ color:ADMIN_THEME.textSecondary, fontSize:12, marginTop:4 }}>{entry.email || entry.department || "Student"}</div>
                    <div style={{ marginTop:6 }}>
                      <span style={{ color:levelMeta.color, background:levelMeta.background, border:`1px solid ${levelMeta.border}`, borderRadius:999, padding:"3px 8px", fontSize:11, fontWeight:700, letterSpacing:"0.06em", textTransform:"uppercase" }}>
                        {submissionLevel}
                      </span>
                    </div>
                  </td>
                  <td style={S.adminTableCell}>
                    {entry.badgeTier ? <AchievementBadge tier={entry.badgeTier} compact /> : <span style={{ color:ADMIN_THEME.textMuted }}>--</span>}
                  </td>
                  <td style={{ ...S.adminTableCell, color:ADMIN_THEME.success, fontWeight:700 }}>{stats.score || 0}</td>
                  <td style={S.adminTableCell}>{stats.problemsSolved || 0}</td>
                  <td style={S.adminTableCell}>{stats.timePenalty || "--"}</td>
                </tr>
              );
            }) : (
              <tr>
                <td colSpan="6" style={{ ...S.adminTableCell, textAlign:"center", color:ADMIN_THEME.textMuted }}>
                  {leaderboardSearch.trim() ? "No leaderboard entries matched that username." : "No logged-in students have submitted yet."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {leaderboardPageCount > 1 && (
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:12, flexWrap:"wrap" }}>
          <div style={{ color:ADMIN_THEME.textSecondary, fontSize:12 }}>Page {safeLeaderboardPage} of {leaderboardPageCount}</div>
          <div style={{ display:"flex", gap:8 }}>
            <button onClick={() => setLeaderboardPage((prev) => Math.max(1, prev - 1))} disabled={safeLeaderboardPage === 1} style={{ ...S.adminButton("default"), opacity:safeLeaderboardPage === 1 ? 0.45 : 1 }}>Previous</button>
            <button onClick={() => setLeaderboardPage((prev) => Math.min(leaderboardPageCount, prev + 1))} disabled={safeLeaderboardPage === leaderboardPageCount} style={{ ...S.adminButton("default"), opacity:safeLeaderboardPage === leaderboardPageCount ? 0.45 : 1 }}>Next</button>
          </div>
        </div>
      )}
    </div>
  );

  const renderStudentList = () => (
    <div style={{ display:"grid", gap:18 }}>
      <div style={S.adminCardGrid}>
        <div style={S.adminCard}>
          <div style={S.adminSectionTitle}>Registered Students</div>
          <div style={{ fontSize:34, fontWeight:800, color:ADMIN_THEME.primary }}>{registeredStudents.length}</div>
        </div>
        <div style={S.adminCard}>
          <div style={S.adminSectionTitle}>Logged In</div>
          <div style={{ fontSize:34, fontWeight:800, color:ADMIN_THEME.success }}>{loggedInRegisteredStudents.length}</div>
        </div>
        <div style={S.adminCard}>
          <div style={S.adminSectionTitle}>Not Logged Yet</div>
          <div style={{ fontSize:34, fontWeight:800, color:ADMIN_THEME.warning }}>{neverLoggedInStudents.length}</div>
        </div>
        <div style={S.adminCard}>
          <div style={S.adminSectionTitle}>Departments</div>
          <div style={{ fontSize:34, fontWeight:800, color:ADMIN_THEME.secondary }}>{departmentTotal}</div>
        </div>
      </div>

      <div style={S.adminTableWrap}>
        <table style={{ width:"100%", borderCollapse:"collapse" }}>
          <thead>
            <tr>
              {["Student", "Department", "Badge", "Status", "Last Login", "Logins"].map((heading) => (
                <th key={heading} style={S.adminTableHead}>{heading}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {registeredStudents.length ? registeredStudents.map((student) => (
              <tr key={`${student.email}-${student.id}`}>
                <td style={S.adminTableCell}>
                  <div style={{ color:ADMIN_THEME.text, fontWeight:700 }}>{student.name}</div>
                  <div style={{ color:ADMIN_THEME.textSecondary, fontSize:12, marginTop:4 }}>{student.email}</div>
                </td>
                <td style={S.adminTableCell}>{student.department || "--"}</td>
                <td style={S.adminTableCell}>
                  {student.badgeTier ? (
                    <div style={{ display:"grid", gap:5 }}>
                      <AchievementBadge tier={student.badgeTier} compact />
                      <span style={{ color:ADMIN_THEME.textSecondary, fontSize:12 }}>{student.solvedProblemCount} solved</span>
                    </div>
                  ) : (
                    <span style={{ color:ADMIN_THEME.textMuted }}>--</span>
                  )}
                </td>
                <td style={{ ...S.adminTableCell, color:student.status === "Logged In" ? ADMIN_THEME.success : ADMIN_THEME.warning, fontWeight:700 }}>{student.status}</td>
                <td style={S.adminTableCell}>{formatPortalDate(student.lastLoginAt)}</td>
                <td style={{ ...S.adminTableCell, color:ADMIN_THEME.primary, fontWeight:700 }}>{student.loginCount || 0}</td>
              </tr>
            )) : (
              <tr>
                <td colSpan="7" style={{ ...S.adminTableCell, textAlign:"center", color:ADMIN_THEME.textMuted }}>No registered students yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderAdminProfile = () => (
    <div style={{ display:"grid", gridTemplateColumns:isCompact ? compactGrid : "minmax(280px, 0.75fr) minmax(0, 1.25fr)", gap:18, alignItems:"start" }}>
      <div style={S.adminCard}>
        <div style={S.adminSectionTitle}>Admin Profile</div>
        <div style={{ display:"flex", alignItems:"center", gap:14, marginBottom:18 }}>
          <div style={{ width:54, height:54, borderRadius:"50%", background:ADMIN_THEME.primary, color:"#FFFFFF", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:800, fontSize:20 }}>
            {userBadge}
          </div>
          <div>
            <div style={{ color:ADMIN_THEME.text, fontSize:22, fontWeight:800 }}>{profileName}</div>
            <div style={{ color:ADMIN_THEME.textSecondary, fontSize:13 }}>{currentUser.email || "Admin email unavailable"}</div>
          </div>
        </div>
        <div style={{ display:"grid", gap:10 }}>
          <div style={S.adminSubCard}>
            <div style={S.adminSectionTitle}>Role</div>
            <div style={{ color:ADMIN_THEME.text, fontWeight:700 }}>Administrator</div>
          </div>
          <div style={S.adminSubCard}>
            <div style={S.adminSectionTitle}>Department</div>
            <div style={{ color:ADMIN_THEME.text, fontWeight:700 }}>{currentUser.department || "Department pending"}</div>
          </div>
          <div style={S.adminSubCard}>
            <div style={S.adminSectionTitle}>Last Login</div>
            <div style={{ color:ADMIN_THEME.text, fontWeight:700 }}>{formatPortalDate(currentUser.lastLoginAt)}</div>
          </div>
          <div style={S.adminSubCard}>
            <div style={S.adminSectionTitle}>Login Count</div>
            <div style={{ color:ADMIN_THEME.primary, fontWeight:800, fontSize:24 }}>{currentUser.loginCount || adminLoginEvents.length || 0}</div>
          </div>
        </div>
      </div>

      <div style={S.adminCard}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:12, flexWrap:"wrap", marginBottom:12 }}>
          <div>
            <div style={S.adminSectionTitle}>Login Logs</div>
            <div style={{ color:ADMIN_THEME.textSecondary, fontSize:13 }}>Recent admin authentication activity</div>
          </div>
          <div style={{ color:ADMIN_THEME.primary, fontSize:13, fontWeight:700 }}>{adminLoginEvents.length} records</div>
        </div>
        <div style={{ display:"grid", gap:10 }}>
          {adminLoginEvents.slice(0, 12).map((event) => (
            <div key={event.id} style={S.adminSubCard}>
              <div style={{ display:"flex", justifyContent:"space-between", gap:12, flexWrap:"wrap", marginBottom:6 }}>
                <div style={{ color:ADMIN_THEME.text, fontWeight:700 }}>{event.email}</div>
                <div style={{ color:ADMIN_THEME.primary, fontSize:12, fontWeight:700 }}>{event.eventType}</div>
              </div>
              <div style={{ color:ADMIN_THEME.textSecondary, fontSize:12, marginBottom:6 }}>
                {event.role} | {formatPortalDate(event.createdAt)}
              </div>
              <div style={{ color:ADMIN_THEME.textMuted, fontSize:12, wordBreak:"break-word" }}>
                {event.ip || "IP unavailable"} | {event.userAgent || "Browser info unavailable"}
              </div>
            </div>
          ))}

          {!adminLoginEvents.length && (
            <div style={{ color:ADMIN_THEME.textSecondary, fontSize:13 }}>No admin login logs yet.</div>
          )}
        </div>
      </div>
    </div>
  );

  const renderQuestionBankPanel = () => (
    <div style={S.adminCard}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:12, flexWrap:"wrap", marginBottom:12 }}>
        <div>
          <div style={S.adminSectionTitle}>Question Bank</div>
          <div style={{ color:ADMIN_THEME.textSecondary, fontSize:13 }}>
            {displayedProblemBank.length} {questionTypeFilter === "theory" ? "Theory MCQ" : questionTypeFilter === "coding" ? "Coding" : "database"} questions
          </div>
        </div>

        <div style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" }}>
          <div style={{ display:"flex", background:"rgba(15, 23, 42, 0.6)", padding:3, borderRadius:10, border:"1px solid #334155" }}>
            <button
              type="button"
              onClick={() => setQuestionTypeFilter("All")}
              style={{
                padding:"4px 10px",
                borderRadius:8,
                fontSize:11,
                fontWeight:700,
                border:"none",
                background:questionTypeFilter === "All" ? "#3b82f6" : "transparent",
                color:questionTypeFilter === "All" ? "#ffffff" : "#94a3b8",
                cursor:"pointer",
              }}
            >
              All ({problemBank.length})
            </button>
            <button
              type="button"
              onClick={() => setQuestionTypeFilter("coding")}
              style={{
                padding:"4px 10px",
                borderRadius:8,
                fontSize:11,
                fontWeight:700,
                border:"none",
                background:questionTypeFilter === "coding" ? "#3b82f6" : "transparent",
                color:questionTypeFilter === "coding" ? "#ffffff" : "#94a3b8",
                cursor:"pointer",
              }}
            >
              💻 Coding ({problemBank.filter(p => (p.type || (Array.isArray(p.options) && p.options.length ? "theory" : "coding")) === "coding").length})
            </button>
            <button
              type="button"
              onClick={() => setQuestionTypeFilter("theory")}
              style={{
                padding:"4px 10px",
                borderRadius:8,
                fontSize:11,
                fontWeight:700,
                border:"none",
                background:questionTypeFilter === "theory" ? "#8b5cf6" : "transparent",
                color:questionTypeFilter === "theory" ? "#ffffff" : "#94a3b8",
                cursor:"pointer",
              }}
            >
              📝 Theory MCQs ({problemBank.filter(p => (p.type || (Array.isArray(p.options) && p.options.length ? "theory" : "coding")) === "theory" || (Array.isArray(p.options) && p.options.length > 0)).length})
            </button>
          </div>

          <select value={questionCategoryFilter} onChange={(e)=>setQuestionCategoryFilter(e.target.value)} style={{ ...S.adminInput, width:120, padding:"6px 8px", fontSize:12 }}>
            {["All", ...questionCategories].map((category) => <option key={category}>{category}</option>)}
          </select>
        </div>
      </div>
      <div style={{ display:"grid", gap:10, maxHeight:720, overflowY:"auto", paddingRight:4 }}>
        {displayedProblemBank.length ? displayedProblemBank.map((problem) => {
          const problemKey = problem.dbId || problem.id;
          const isEditing = editingProblemId === problemKey;
          const isSelected = adminCreateForm.questions.includes(problemKey);
          const probType = problem.type || (Array.isArray(problem.options) && problem.options.length ? "theory" : "coding");
          const isTheory = probType === "theory";

          return (
            <div
              key={problemKey}
              style={{
                ...S.adminSubCard,
                border: isEditing ? `2px solid ${ADMIN_THEME.primary}` : S.adminSubCard.border,
                background: isEditing ? "rgba(37, 99, 235, 0.04)" : S.adminSubCard.background,
              }}
            >
              <div style={{ display:"flex", justifyContent:"space-between", gap:12, alignItems:"flex-start" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:4, flexWrap:"wrap" }}>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 800,
                        letterSpacing: "0.06em",
                        padding: "2px 8px",
                        borderRadius: 999,
                        background: isTheory ? "rgba(139, 92, 246, 0.14)" : "rgba(37, 99, 235, 0.14)",
                        color: isTheory ? "#8b5cf6" : "#2563eb",
                        border: `1px solid ${isTheory ? "rgba(139, 92, 246, 0.3)" : "rgba(37, 99, 235, 0.3)"}`,
                        textTransform: "uppercase",
                      }}
                    >
                      {isTheory ? "THEORY" : "CODING"}
                    </span>
                    <span style={{ fontSize:11, color:ADMIN_THEME.textSecondary, fontWeight:700 }}>
                      {problem.marks || (isTheory ? 2 : 10)} pts
                    </span>
                  </div>
                  <div style={{ color:ADMIN_THEME.text, fontWeight:700, marginBottom:4 }}>{problem.title}</div>
                  <div style={{ color:ADMIN_THEME.textSecondary, fontSize:12 }}>
                    {getProblemCategory(problem)} | {problem.difficulty} | {problem.tags.slice(0, 4).join(", ") || "General"}
                  </div>
                  {isTheory && Array.isArray(problem.options) && problem.options.length > 0 && (
                    <div style={{ color:ADMIN_THEME.textMuted, fontSize:11, marginTop:4 }}>
                      Options: {problem.options.slice(0, 4).join(", ")}
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                  <button
                    onClick={() => toggleCreateQuestion(problemKey)}
                    style={{
                      ...S.adminButton(isSelected ? "submit" : "default"),
                      padding: "6px 12px",
                      fontSize: 12,
                    }}
                  >
                    {isSelected ? "Selected" : "Add"}
                  </button>
                  <button
                    onClick={() => startEditQuestion(problem)}
                    style={{
                      ...S.adminButton("default"),
                      padding: "6px 12px",
                      fontSize: 12,
                      color: isEditing ? ADMIN_THEME.primary : ADMIN_THEME.text,
                      fontWeight: 700,
                    }}
                  >
                    {isEditing ? "Editing..." : "Modify"}
                  </button>
                  <button
                    onClick={() => setDeletingProblem(problem)}
                    style={{
                      ...S.adminButton("default"),
                      padding: "6px 12px",
                      fontSize: 12,
                      color: "#dc2626",
                      borderColor: "rgba(220, 38, 38, 0.3)",
                      fontWeight: 700,
                    }}
                  >
                    Remove
                  </button>
                </div>
              </div>
            </div>
          );
        }) : (
          <div style={{ color:ADMIN_THEME.textSecondary, fontSize:13 }}>
            No questions found for this filter.
          </div>
        )}
      </div>
    </div>
  );

  const renderDeleteQuestionModal = () => deletingProblem ? (
    <div style={S.modalBackdrop} onClick={() => !deletingQuestion && setDeletingProblem(null)}>
      <div
        style={{
          width: "min(440px, 100%)",
          background: "#ffffff",
          border: "1px solid rgba(220, 38, 38, 0.3)",
          borderRadius: 24,
          padding: "26px 24px",
          boxShadow: "0 24px 60px rgba(0, 0, 0, 0.25)",
          textAlign: "center",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            width: 64,
            height: 64,
            margin: "0 auto 16px",
            borderRadius: "50%",
            background: "rgba(220, 38, 38, 0.12)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#dc2626",
          }}
        >
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            <line x1="10" y1="11" x2="10" y2="17"></line>
            <line x1="14" y1="11" x2="14" y2="17"></line>
          </svg>
        </div>
        <div style={{ color: "#111827", fontSize: 20, fontWeight: 800, marginBottom: 8 }}>
          Remove Question?
        </div>
        <div style={{ color: "#4b5563", fontSize: 14, lineHeight: 1.5, marginBottom: 22 }}>
          Are you sure you want to remove <strong>"{deletingProblem.title}"</strong> from the database? This action cannot be undone.
        </div>
        <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
          <button
            onClick={handleConfirmDeleteQuestion}
            disabled={deletingQuestion}
            style={{
              padding: "11px 22px",
              borderRadius: 999,
              border: "none",
              background: "#dc2626",
              color: "#ffffff",
              fontSize: 14,
              fontWeight: 700,
              cursor: deletingQuestion ? "not-allowed" : "pointer",
              opacity: deletingQuestion ? 0.7 : 1,
            }}
          >
            {deletingQuestion ? "Removing..." : "Remove Question"}
          </button>
          <button
            onClick={() => setDeletingProblem(null)}
            disabled={deletingQuestion}
            style={{
              padding: "11px 22px",
              borderRadius: 999,
              border: "1px solid #e5e7eb",
              background: "#f3f4f6",
              color: "#111827",
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  ) : null;

  const renderQuestionUploads = () => {
    const isTheory = questionUploadForm.type === "theory";

    return (
      <div style={{ display:"grid", gridTemplateColumns:"minmax(0, 1fr) minmax(320px, 0.8fr)", gap:18, alignItems:"start" }}>
        <div style={S.adminCard}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:12, marginBottom:16 }}>
            <div style={S.adminSectionTitle}>
              {editingProblemId ? "Modify Question" : "Upload Question"}
            </div>
            {editingProblemId && (
              <span style={{ fontSize: 12, color: ADMIN_THEME.primary, fontWeight: 700 }}>
                Editing Mode Active
              </span>
            )}
          </div>

          {/* Question Type Switcher */}
          <div style={{ marginBottom: 16 }}>
            <label style={S.adminFieldLabel}>Select Question Type</label>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                type="button"
                onClick={() => {
                  setQuestionUploadForm((prev) => ({ ...prev, type: "coding", marks: prev.marks === "2" ? "10" : prev.marks }));
                  setQuestionTypeFilter("coding");
                }}
                style={{
                  ...S.adminButton(questionUploadForm.type === "coding" ? "submit" : "default"),
                  flex: 1,
                  padding: "10px",
                  fontWeight: 700,
                  fontSize: 13,
                  borderColor: questionUploadForm.type === "coding" ? ADMIN_THEME.primary : "#e5e7eb",
                }}
              >
                💻 Coding Question
              </button>
              <button
                type="button"
                onClick={() => {
                  setQuestionUploadForm((prev) => ({ ...prev, type: "theory", marks: prev.marks === "10" ? "2" : prev.marks }));
                  setQuestionTypeFilter("theory");
                }}
                style={{
                  ...S.adminButton(questionUploadForm.type === "theory" ? "submit" : "default"),
                  flex: 1,
                  padding: "10px",
                  fontWeight: 700,
                  fontSize: 13,
                  borderColor: questionUploadForm.type === "theory" ? "#8b5cf6" : "#e5e7eb",
                  background: questionUploadForm.type === "theory" ? "#8b5cf6" : "transparent",
                  color: questionUploadForm.type === "theory" ? "#ffffff" : ADMIN_THEME.text,
                }}
              >
                📝 Theory (MCQ) Question
              </button>
            </div>
          </div>

          <div style={{ display:"grid", gap:14 }}>
            <div style={{ display:"grid", gridTemplateColumns:"1.2fr 0.8fr 0.8fr 0.6fr", gap:12 }}>
              <div>
                <label style={S.adminFieldLabel}>Question Title</label>
                <input
                  value={questionUploadForm.title}
                  onChange={(e)=>handleQuestionUploadInput("title", e.target.value)}
                  style={S.adminInput}
                  placeholder={isTheory ? "e.g. Time Complexity of QuickSort" : "e.g. Two Sum Variant"}
                />
              </div>
              <div>
                <label style={S.adminFieldLabel}>Category</label>
                <select value={questionUploadForm.category} onChange={(e)=>handleQuestionUploadInput("category", e.target.value)} style={S.adminInput}>
                  {questionCategories.map((category) => <option key={category}>{category}</option>)}
                </select>
              </div>
              <div>
                <label style={S.adminFieldLabel}>Difficulty</label>
                <select value={questionUploadForm.difficulty} onChange={(e)=>handleQuestionUploadInput("difficulty", e.target.value)} style={S.adminInput}>
                  <option>Easy</option>
                  <option>Medium</option>
                  <option>Hard</option>
                </select>
              </div>
              <div>
                <label style={S.adminFieldLabel}>Marks</label>
                <input
                  type="number"
                  value={questionUploadForm.marks}
                  onChange={(e)=>handleQuestionUploadInput("marks", e.target.value)}
                  style={S.adminInput}
                  placeholder={isTheory ? "2" : "10"}
                />
              </div>
            </div>

            {!isTheory && (
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                <div>
                  <label style={S.adminFieldLabel}>Function Name</label>
                  <input value={questionUploadForm.fnName} onChange={(e)=>handleQuestionUploadInput("fnName", e.target.value)} style={S.adminInput} placeholder="solve" />
                </div>
                <div>
                  <label style={S.adminFieldLabel}>Extra Tags</label>
                  <input value={questionUploadForm.tags} onChange={(e)=>handleQuestionUploadInput("tags", e.target.value)} style={S.adminInput} placeholder="arrays, hashing" />
                </div>
              </div>
            )}

            <div>
              <label style={S.adminFieldLabel}>{isTheory ? "Question Text / Statement" : "Question Statement"}</label>
              <textarea
                value={questionUploadForm.statement}
                onChange={(e)=>handleQuestionUploadInput("statement", e.target.value)}
                style={{ ...S.adminTextarea, minHeight: isTheory ? 110 : 150 }}
                placeholder={isTheory ? "Enter the theory question prompt." : "Write the full coding question statement here."}
              />
            </div>

            {isTheory ? (
              <>
                <div>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                    <label style={S.adminFieldLabel}>Multiple Choice Options (2 - 6) & Correct Answer Selector</label>
                    <div style={{ display:"flex", gap:8 }}>
                      {questionUploadForm.options.length < 6 && (
                        <button
                          type="button"
                          onClick={() => {
                            const nextOptions = [...questionUploadForm.options, `Option ${String.fromCharCode(65 + questionUploadForm.options.length)}`];
                            setQuestionUploadForm((prev) => ({ ...prev, options: nextOptions }));
                          }}
                          style={{ padding:"4px 10px", fontSize:12, borderRadius:8, border:"1px solid #cbd5e1", background:"#f8fafc", cursor:"pointer", fontWeight:600 }}
                        >
                          + Add Option
                        </button>
                      )}
                      {questionUploadForm.options.length > 2 && (
                        <button
                          type="button"
                          onClick={() => {
                            const nextOptions = questionUploadForm.options.slice(0, -1);
                            const nextCorrect = nextOptions.includes(questionUploadForm.correctAnswer) ? questionUploadForm.correctAnswer : nextOptions[0];
                            setQuestionUploadForm((prev) => ({ ...prev, options: nextOptions, correctAnswer: nextCorrect }));
                          }}
                          style={{ padding:"4px 10px", fontSize:12, borderRadius:8, border:"1px solid #fca5a5", background:"#fef2f2", color:"#dc2626", cursor:"pointer", fontWeight:600 }}
                        >
                          - Remove Option
                        </button>
                      )}
                    </div>
                  </div>
                  <div style={{ display:"grid", gap:10 }}>
                    {questionUploadForm.options.map((opt, idx) => (
                      <div key={idx} style={{ display:"flex", gap:10, alignItems:"center" }}>
                        <input
                          type="radio"
                          name="correctAnswerRadio"
                          checked={questionUploadForm.correctAnswer === opt}
                          onChange={() => handleQuestionUploadInput("correctAnswer", opt)}
                          style={{ width:18, height:18, cursor:"pointer" }}
                        />
                        <span style={{ fontSize:13, fontWeight:700, color:"#475569", width:24 }}>
                          {String.fromCharCode(65 + idx)}.
                        </span>
                        <input
                          value={opt}
                          onChange={(e) => {
                            const val = e.target.value;
                            const nextOptions = [...questionUploadForm.options];
                            const oldVal = nextOptions[idx];
                            nextOptions[idx] = val;
                            setQuestionUploadForm((prev) => ({
                              ...prev,
                              options: nextOptions,
                              correctAnswer: prev.correctAnswer === oldVal ? val : prev.correctAnswer,
                            }));
                          }}
                          style={{ ...S.adminInput, flex:1 }}
                          placeholder={`Option ${String.fromCharCode(65 + idx)}`}
                        />
                        {questionUploadForm.correctAnswer === opt && (
                          <span style={{ fontSize:12, fontWeight:700, color:"#16a34a", background:"#dcfce7", padding:"4px 10px", borderRadius:999 }}>
                            Correct Answer
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <label style={S.adminFieldLabel}>Explanation (Optional - shown after submission)</label>
                  <textarea
                    value={questionUploadForm.explanation}
                    onChange={(e)=>handleQuestionUploadInput("explanation", e.target.value)}
                    style={{ ...S.adminTextarea, minHeight:70 }}
                    placeholder="Provide detailed explanation for why this answer is correct."
                  />
                </div>
              </>
            ) : (
              <>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                  <div>
                    <label style={S.adminFieldLabel}>Examples</label>
                    <textarea value={questionUploadForm.examples} onChange={(e)=>handleQuestionUploadInput("examples", e.target.value)} style={S.adminTextarea} placeholder={"input => output\n[2,7,11,15], 9 => [0,1]"} />
                  </div>
                  <div>
                    <label style={S.adminFieldLabel}>Hidden Test Cases</label>
                    <textarea value={questionUploadForm.testCases} onChange={(e)=>handleQuestionUploadInput("testCases", e.target.value)} style={S.adminTextarea} placeholder={"input => expected\n[3,2,4], 6 => [1,2]"} />
                  </div>
                </div>

                <div>
                  <label style={S.adminFieldLabel}>Constraints</label>
                  <textarea value={questionUploadForm.constraints} onChange={(e)=>handleQuestionUploadInput("constraints", e.target.value)} style={{ ...S.adminTextarea, minHeight:86 }} placeholder={"One constraint per line\n1 <= n <= 10^5"} />
                </div>

                <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(220px, 1fr))", gap:12 }}>
                  <div>
                    <label style={S.adminFieldLabel}>JavaScript Starter</label>
                    <textarea value={questionUploadForm.javascript} onChange={(e)=>handleQuestionUploadInput("javascript", e.target.value)} style={{ ...S.adminTextarea, fontFamily:"'JetBrains Mono',monospace" }} />
                  </div>
                  <div>
                    <label style={S.adminFieldLabel}>Python Starter</label>
                    <textarea value={questionUploadForm.python} onChange={(e)=>handleQuestionUploadInput("python", e.target.value)} style={{ ...S.adminTextarea, fontFamily:"'JetBrains Mono',monospace" }} />
                  </div>
                  <div>
                    <label style={S.adminFieldLabel}>Java Starter</label>
                    <textarea value={questionUploadForm.java} onChange={(e)=>handleQuestionUploadInput("java", e.target.value)} style={{ ...S.adminTextarea, fontFamily:"'JetBrains Mono',monospace" }} />
                  </div>
                </div>
              </>
            )}

            <div style={{ display:"flex", gap:12, flexWrap:"wrap", alignItems:"center" }}>
              <button
                onClick={handleUploadQuestion}
                disabled={questionUploading}
                style={{ ...S.adminButton("submit"), opacity:questionUploading ? 0.65 : 1, cursor:questionUploading ? "not-allowed" : "pointer" }}
              >
                {questionUploading
                  ? (editingProblemId ? "Saving..." : "Uploading...")
                  : (editingProblemId ? "Save Changes" : isTheory ? "Upload Theory Question" : "Upload Coding Question")}
              </button>
              <button
                onClick={() => {
                  if (editingProblemId) {
                    cancelEditQuestion();
                  } else {
                    setQuestionUploadForm(createDefaultQuestionUploadForm());
                  }
                }}
                style={S.adminButton("default")}
              >
                {editingProblemId ? "Cancel Edit" : "Clear Form"}
              </button>
              <div style={{ color:ADMIN_THEME.textSecondary, fontSize:12 }}>
                {editingProblemId
                  ? "Changes will update the question in MongoDB and reflect immediately across tests."
                  : "Uploaded questions are stored in MongoDB and become available for tests and assignments."}
              </div>
            </div>

            {questionUploadError && (
              <div style={S.adminAlert("error")}>
                {questionUploadError}
              </div>
            )}
          </div>
        </div>

        {renderQuestionBankPanel()}
      </div>
    );
  };

  const renderQuestionUploadSuccessModal = () => questionUploadSuccess ? (
    <div style={S.modalBackdrop}>
      <style>{`
        @keyframes uploadSuccessPop {
          0% { opacity: 0; transform: scale(0.82) translateY(12px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes uploadSuccessRing {
          0% { stroke-dashoffset: 166; }
          100% { stroke-dashoffset: 0; }
        }
        @keyframes uploadSuccessTick {
          0% { stroke-dashoffset: 36; }
          100% { stroke-dashoffset: 0; }
        }
      `}</style>
      <div
        style={{
          width:"min(420px, 100%)",
          background:"linear-gradient(180deg, #ffffff 0%, #f6fbf8 100%)",
          border:"1px solid rgba(34, 197, 94, 0.22)",
          borderRadius:28,
          padding:"30px 28px 26px",
          boxShadow:"0 28px 80px rgba(15, 23, 42, 0.28)",
          textAlign:"center",
          animation:"uploadSuccessPop 0.3s ease-out",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            width:96,
            height:96,
            margin:"0 auto 18px",
            borderRadius:"50%",
            background:"radial-gradient(circle at 30% 30%, #dcfce7 0%, #bbf7d0 46%, #86efac 100%)",
            display:"flex",
            alignItems:"center",
            justifyContent:"center",
            boxShadow:"0 18px 40px rgba(34, 197, 94, 0.22)",
          }}
        >
          <svg width="62" height="62" viewBox="0 0 62 62" fill="none" aria-hidden="true">
            <circle
              cx="31"
              cy="31"
              r="26.5"
              stroke="#16A34A"
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray="166"
              strokeDashoffset="166"
              style={{ animation:"uploadSuccessRing 0.55s ease-out forwards" }}
            />
            <path
              d="M19 31.5L27 39.5L43 22.5"
              stroke="#15803D"
              strokeWidth="5"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="36"
              strokeDashoffset="36"
              style={{ animation:"uploadSuccessTick 0.35s ease-out 0.4s forwards" }}
            />
          </svg>
        </div>
        <div style={{ color:"#14532d", fontSize:24, fontWeight:800, marginBottom:10 }}>
          Question Uploaded Successfully
        </div>
        <div style={{ color:"#3f3f46", fontSize:15, lineHeight:1.6, marginBottom:22 }}>
          {questionUploadSuccess}
        </div>
        <button
          onClick={() => setQuestionUploadSuccess("")}
          style={{
            minWidth:120,
            padding:"13px 24px",
            border:"none",
            borderRadius:999,
            background:"linear-gradient(135deg, #16a34a, #22c55e)",
            color:"#ffffff",
            fontSize:14,
            fontWeight:800,
            cursor:"pointer",
            boxShadow:"0 14px 30px rgba(34, 197, 94, 0.22)",
          }}
        >
          OK
        </button>
      </div>
    </div>
  ) : null;

  if (view === "home") return (
    <div style={{ position: "relative" }} onContextMenu={(e) => e.preventDefault()}>
      <ScreenShield active={screenShield} message={shieldMessage} />
      {renderLiveTestPopupModal()}
      <div style={{ ...S.app, opacity: screenShield ? 0 : 1, pointerEvents: screenShield ? "none" : "auto", transition: "opacity 0.12s ease", userSelect: screenShield ? "none" : "auto" }}>
        <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,700&family=Outfit:wght@400;500;600;700&family=Space+Grotesk:wght@400;600;800&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet" />
        <nav style={S.nav}>
          <DevOrbitLogo />
          <div style={{ marginLeft:"auto", color:"#676b89", fontSize:12, letterSpacing:"0.1em", textTransform:"uppercase", fontFamily:"'Space Grotesk',sans-serif" }}>
            devOrbit Access Portal
          </div>
        </nav>

        <div style={S.heroShell}>
          <div style={S.startHero}>
            <div style={{ position:"absolute", width:220, height:220, borderRadius:"50%", background:"#4fd1c51c", filter:"blur(10px)", right:-40, top:-60 }} />
            <div style={{ position:"absolute", width:180, height:180, borderRadius:"50%", background:"#7c6af71f", filter:"blur(10px)", left:-30, bottom:-70 }} />
            <div style={{ position:"relative", display:"grid", gridTemplateColumns:isCompact ? compactGrid : "1.1fr 0.9fr", gap:isPhone ? 16 : 24, alignItems:"center" }}>
              <div>
                <div style={{ display:"inline-flex", alignItems:"center", gap:8, padding:"6px 12px", borderRadius:999, background:"#ffffff0a", border:"1px solid #ffffff14", color:"#8f93b4", fontSize:11, fontWeight:700, letterSpacing:"0.12em", textTransform:"uppercase", marginBottom:18 }}>
                  DevOrbit Learning Hub
                </div>
                <h1 style={{ ...S.homeTitle, maxWidth:720 }}>Build, compete, and track every test from one sleek portal.</h1>
                <p style={{ ...S.problemBody, maxWidth:620, marginBottom:24 }}>
                  A modern assignment space for students and admins with coding rounds, rankings, timers, and real-time monitoring.
                </p>
                <div style={{ display:"flex", gap:14, alignItems:"center", flexWrap:"wrap" }}>
                  <button onClick={openAuthFlow} style={S.startButton}>Start</button>
                  <span style={{ color:"#8f93b4", fontSize:14 }}>Login or sign up to enter as student or admin.</span>
                </div>
              </div>

              <div style={{ display:"grid", gap:14 }}>
                <div style={{ ...S.roleCard, background:"linear-gradient(180deg,#101723,#0d0d15)" }}>
                  <div style={{ color:"#4fd1c5", fontSize:12, fontWeight:700, letterSpacing:"0.12em", textTransform:"uppercase", fontFamily:"'Space Grotesk',sans-serif" }}>Student Experience</div>
                  <div style={{ color:"#f4f5ff", fontSize:24, fontWeight:700, lineHeight:1.2 }}>Start tests quickly, run code, and track your score live.</div>
                </div>
                <div style={{ ...S.roleCard, background:"linear-gradient(180deg,#17130b,#0d0d15)" }}>
                  <div style={{ color:"#ffc01e", fontSize:12, fontWeight:700, letterSpacing:"0.12em", textTransform:"uppercase", fontFamily:"'Space Grotesk',sans-serif" }}>Admin Control</div>
                  <div style={{ color:"#f4f5ff", fontSize:24, fontWeight:700, lineHeight:1.2 }}>Create tests, watch participants, and manage the leaderboard from one place.</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {authModalOpen && (
          <div style={S.modalBackdrop} onClick={closeAuthFlow}>
            <div style={S.modalCard} onClick={(e) => e.stopPropagation()}>
              <div style={{ color:"#4fd1c5", fontSize:12, fontWeight:700, letterSpacing:"0.12em", textTransform:"uppercase", fontFamily:"'Space Grotesk',sans-serif", marginBottom:12 }}>Access Flow</div>
              <h1 style={{ ...S.problemTitle, fontSize:38, marginBottom:12 }}>Enter the portal.</h1>
              <p style={{ ...S.problemBody, marginBottom:24 }}>
                Login uses only mail ID and password. Sign up collects the extra details needed for student or admin access.
              </p>

              <div style={{ display:"grid", gap:18 }}>
                <div>
                  <label style={S.fieldLabel}>Choose Action</label>
                  <div style={S.authChoiceGrid}>
                    <button onClick={() => chooseAuthMode("login")} style={S.authChoiceButton(authMode === "login", "default")}>
                      <div style={{ fontWeight:700, marginBottom:4 }}>Login</div>
                      <div style={{ color:"#8f93b4", fontSize:12 }}>Use mail ID and password only</div>
                    </button>
                    <button onClick={() => chooseAuthMode("signup")} style={S.authChoiceButton(authMode === "signup", "default")}>
                      <div style={{ fontWeight:700, marginBottom:4 }}>Sign Up</div>
                      <div style={{ color:"#8f93b4", fontSize:12 }}>Add your details and create access</div>
                    </button>
                  </div>
                </div>

                {authMode && (
                  <div>
                    <label style={S.fieldLabel}>Choose Role</label>
                    <div style={S.authChoiceGrid}>
                      <button onClick={() => chooseAuthRole("student")} style={S.authChoiceButton(authRole === "student", "student")}>
                        <div style={{ fontWeight:700, marginBottom:4 }}>Student</div>
                        <div style={{ color:"#8f93b4", fontSize:12 }}>Coding tests and leaderboard access</div>
                      </button>
                      <button onClick={() => chooseAuthRole("admin")} style={S.authChoiceButton(authRole === "admin", "admin")}>
                        <div style={{ fontWeight:700, marginBottom:4 }}>Admin</div>
                        <div style={{ color:"#8f93b4", fontSize:12 }}>Manage tests and participants</div>
                      </button>
                    </div>
                  </div>
                )}

                {authMode && authRole && (
                  <div style={{ display:"grid", gap:18 }}>
                    {authMode === "signup" && (
                      <>
                        <div>
                          <label style={S.fieldLabel}>Name</label>
                          <input
                            value={authName}
                            onChange={e=>{ setAuthName(e.target.value); if (authError) setAuthError(""); }}
                            style={S.input}
                            placeholder={authRole === "admin" ? "Enter admin name" : "Enter student name"}
                          />
                        </div>

                        <div>
                          <label style={S.fieldLabel}>Department</label>
                          <select
                            value={authDepartment}
                            onChange={e=>{ setAuthDepartment(e.target.value); if (authError) setAuthError(""); }}
                            style={S.input}
                          >
                            <option value="">Select department</option>
                            <option value="Cyber">Cyber</option>
                            <option value="CSE">CSE</option>
                            <option value="ECE">ECE</option>
                            <option value="ISE">ISE</option>
                            <option value="AIML">AIML</option>
                          </select>
                        </div>
                      </>
                    )}

                    <div>
                      <label style={S.fieldLabel}>Email ID</label>
                      <input value={authEmail} onChange={e=>{ setAuthEmail(e.target.value); if (authError) setAuthError(""); }} style={S.input} placeholder="name@gmail.com" />
                    </div>
                    <div>
                      <label style={S.fieldLabel}>Password</label>
                      <div style={{ position: "relative" }}>
                        <input
                          type={showAuthPassword ? "text" : "password"}
                          value={authPassword}
                          onChange={e=>{ setAuthPassword(e.target.value); if (authError) setAuthError(""); }}
                          style={{ ...S.input, paddingRight: 44 }}
                          placeholder="Enter password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowAuthPassword(!showAuthPassword)}
                          style={{
                            position: "absolute",
                            right: 12,
                            top: "50%",
                            transform: "translateY(-50%)",
                            background: "none",
                            border: "none",
                            color: "#94a3b8",
                            cursor: "pointer",
                            fontSize: 16,
                            padding: 4,
                          }}
                          title={showAuthPassword ? "Hide password" : "Show password"}
                        >
                          {showAuthPassword ? "🙈" : "👁"}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {authError && (
                <div style={{ marginTop:18, background:"#180b0b", border:"1px solid #4b1717", color:"#ff9b9b", borderRadius:12, padding:"12px 14px", fontSize:13 }}>
                  {authError}
                </div>
              )}

              <div style={{ display:"flex", gap:12, marginTop:24 }}>
                <button
                  onClick={handleAuthSubmit}
                  disabled={authSubmitting}
                  style={{
                    ...S.btn("submit"),
                    opacity: authSubmitting ? 0.55 : 1,
                    cursor: authSubmitting ? "not-allowed" : "pointer",
                  }}
                >
                  {authSubmitting
                    ? (authMode === "signup" ? "⏳ CREATING ACCOUNT..." : "⏳ LOGGING IN...")
                    : (authMode === "signup" ? "Create Access" : "LOGIN")}
                </button>
                <button onClick={closeAuthFlow} style={{ ...S.btn("default"), color:"#c8c8e8" }}>Cancel</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const handleFinalSubmitAssessment = async () => {
    const testId = activeContestAssignment?.id || adminCurrentTest?.id;
    if (!testId) return;

    setSubmittingAssessment(true);
    try {
      const data = await performApiRequest(`/api/tests/${testId}/submit`, {
        method: "POST",
        body: JSON.stringify({
          theoryAnswers: candidateTheoryAnswers,
          codingAnswers: candidateCodingAnswers,
        }),
      });

      if (data.result) {
        setAssessmentResult(data.result);
      }
      setFinalSubmitConfirmOpen(false);
      setContestEntered(false);
      setPortalMessage("Assessment submitted successfully!");
    } catch (err) {
      setPortalError(err.message || "Failed to submit assessment.");
    } finally {
      setSubmittingAssessment(false);
    }
  };

  const renderAssessmentResultView = () => {
    if (!assessmentResult) return null;
    const res = assessmentResult;
    const details = res.details || {};
    const questions = details.questions || [];

    return (
      <div style={{ ...S.app, minHeight: "100vh" }}>
        <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,700&family=Outfit:wght@400;500;600;700&family=Space+Grotesk:wght@400;600;800&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet" />
        <nav style={S.nav}>
          <span style={S.logo} onClick={() => { setAssessmentResult(null); setView("home"); }}>{"</> devOrbit"}</span>
          <button onClick={() => { setAssessmentResult(null); openContest(); }} style={S.navBtn(true)}>
            <span style={S.navBtnLabel(true)}>Back to Assessments</span>
          </button>
        </nav>

        <div style={{ maxWidth: 1100, margin: "34px auto 44px", padding: "0 24px", width: "100%", display: "grid", gap: 20 }}>
          <div style={{ background: "radial-gradient(circle at top left, rgba(139,92,246,0.22), rgba(10,10,15,0.98) 50%)", border: "1px solid #3b0764", borderRadius: 24, padding: "28px", boxShadow: "0 24px 70px rgba(0,0,0,0.32)" }}>
            <div style={{ color: "#a78bfa", fontSize: 12, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 10 }}>
              Assessment Evaluation Completed
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 20, flexWrap: "wrap", alignItems: "flex-end" }}>
              <div>
                <h1 style={{ margin: "0 0 10px", color: "#f5f6ff", fontSize: 40, lineHeight: 1.1 }}>
                  {contestDisplayName}
                </h1>
                <div style={{ color: "#a9aed0", fontSize: 14 }}>
                  Submitted by {currentUser.name || currentUser.email} | Total Questions: {details.totalQuestions || questions.length}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ color: "#73f0b3", fontSize: 44, fontWeight: 800, lineHeight: 1 }}>
                  {res.totalScore} / {res.maxScore}
                </div>
                <div style={{ color: "#a78bfa", fontSize: 16, fontWeight: 700, marginTop: 6 }}>
                  {res.percentage}% Score
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
            <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 18, padding: "18px 20px" }}>
              <div style={{ color: "#8b5cf6", fontSize: 12, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>
                Theory Score
              </div>
              <div style={{ color: "#c4b5fd", fontSize: 32, fontWeight: 800 }}>
                {res.theoryScore} / {details.maxTheoryScore || 0}
              </div>
              <div style={{ color: "#94a3b8", fontSize: 12, marginTop: 4 }}>
                {details.theoryCount || 0} Theory Questions
              </div>
            </div>

            <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 18, padding: "18px 20px" }}>
              <div style={{ color: "#2563eb", fontSize: 12, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>
                Coding Score
              </div>
              <div style={{ color: "#93c5fd", fontSize: 32, fontWeight: 800 }}>
                {res.codingScore} / {details.maxCodingScore || 0}
              </div>
              <div style={{ color: "#94a3b8", fontSize: 12, marginTop: 4 }}>
                {details.codingCount || 0} Coding Questions
              </div>
            </div>

            <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 18, padding: "18px 20px" }}>
              <div style={{ color: "#10b981", fontSize: 12, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>
                Questions Answered
              </div>
              <div style={{ color: "#6ee7b7", fontSize: 32, fontWeight: 800 }}>
                {details.answeredQuestions || 0} / {details.totalQuestions || 0}
              </div>
              <div style={{ color: "#94a3b8", fontSize: 12, marginTop: 4 }}>
                Submission status recorded
              </div>
            </div>

            <div style={{ background: "#0f172a", border: "1px solid #3b82f6", borderRadius: 18, padding: "18px 20px" }}>
              <div style={{ color: "#38bdf8", fontSize: 12, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>
                Official Rank
              </div>
              <div style={{ color: "#38bdf8", fontSize: 32, fontWeight: 800 }}>
                #{res.rank || res.userRank || 1}
              </div>
              <div style={{ color: "#94a3b8", fontSize: 12, marginTop: 4 }}>
                {res.totalParticipants ? `Out of ${res.totalParticipants} completed submissions` : "Recalculated on database"}
              </div>
            </div>
          </div>

          <div style={{ background: "#111118", border: "1px solid #1e1e2e", borderRadius: 20, padding: "20px" }}>
            <h3 style={{ margin: "0 0 16px", color: "#f5f6ff", fontSize: 20 }}>Question-Wise Result Breakdown</h3>
            <div style={{ display: "grid", gap: 14 }}>
              {questions.map((q, idx) => {
                const isTheory = q.type === "theory";
                const isSuccess = q.status === "Correct" || q.status === "Passed";
                const isPartial = q.status === "Partial";

                return (
                  <div
                    key={q.questionId || idx}
                    style={{
                      background: "#0f131c",
                      border: `1px solid ${isSuccess ? "rgba(22, 163, 74, 0.3)" : isPartial ? "rgba(217, 119, 6, 0.3)" : "rgba(220, 38, 38, 0.3)"}`,
                      borderRadius: 16,
                      padding: "18px 20px",
                      display: "grid",
                      gap: 12,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                        <span style={{ fontSize: 11, fontWeight: 800, padding: "3px 8px", borderRadius: 999, background: isTheory ? "rgba(139, 92, 246, 0.16)" : "rgba(37, 99, 235, 0.16)", color: isTheory ? "#c4b5fd" : "#93c5fd" }}>
                          {isTheory ? "THEORY" : "CODING"}
                        </span>
                        <span style={{ color: "#f5f6ff", fontWeight: 700, fontSize: 16 }}>
                          Q{idx + 1}. {q.title}
                        </span>
                      </div>
                      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                        <span style={{ fontSize: 13, fontWeight: 800, color: isSuccess ? "#4ade80" : isPartial ? "#fcd34d" : "#f87171" }}>
                          {q.status}
                        </span>
                        <span style={{ fontSize: 14, fontWeight: 800, color: "#eef0ff", background: "#1e293b", padding: "4px 12px", borderRadius: 999 }}>
                          {q.earnedMarks} / {q.marks} pts
                        </span>
                      </div>
                    </div>

                    <div style={{ color: "#94a3b8", fontSize: 14, lineHeight: 1.6 }}>
                      {q.statement}
                    </div>

                    {isTheory ? (
                      <div style={{ display: "grid", gap: 8, background: "#111827", padding: "14px", borderRadius: 12 }}>
                        <div>Your Answer: <strong style={{ color: q.selectedOption ? "#f5f6ff" : "#64748b" }}>{q.selectedOption || "Not Answered"}</strong></div>
                        <div>Correct Answer: <strong style={{ color: "#4ade80" }}>{q.correctAnswer}</strong></div>
                        {q.explanation && <div style={{ color: "#cbd5e1", fontSize: 13, marginTop: 4 }}>💡 <em>{q.explanation}</em></div>}
                      </div>
                    ) : (
                      <div style={{ background: "#111827", padding: "14px", borderRadius: 12 }}>
                        <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 6 }}>Submitted Code ({q.language || "javascript"}):</div>
                        <pre style={{ margin: 0, fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: "#38bdf8", whiteSpace: "pre-wrap" }}>
                          {q.submittedCode || "// No code submitted"}
                        </pre>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div style={{ marginTop: 24, textAlign: "center" }}>
              <button
                onClick={() => {
                  setAssessmentResult(null);
                  openContest();
                }}
                style={{ ...S.btn("submit"), padding: "12px 32px", fontSize: 14 }}
              >
                Return to Assessments Dashboard
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const loadReportsOverview = async () => {
    setReportsOverviewLoading(true);
    try {
      const data = await performApiRequest("/api/admin/reports/tests");
      setReportsOverview(data.reports || []);
      if (data.reports?.length) {
        const firstId = data.reports[0].id;
        setSelectedReportTestId((prev) => prev || firstId);
        loadTestReport(selectedReportTestId || firstId);
      }
    } catch (err) {
      console.error("Failed to load reports overview:", err);
    } finally {
      setReportsOverviewLoading(false);
    }
  };

  const loadTestReport = async (testId) => {
    if (!testId) return;
    setTestReportLoading(true);
    try {
      const data = await performApiRequest(`/api/admin/reports/tests/${testId}`);
      setActiveTestReport(data);
    } catch (err) {
      console.error("Failed to load test report:", err);
    } finally {
      setTestReportLoading(false);
    }
  };

  const openStudentReportModal = async (testId, studentId) => {
    try {
      const data = await performApiRequest(`/api/admin/reports/tests/${testId}/students/${studentId}`);
      setStudentReportModalData(data);
      setStudentReportModalOpen(true);
    } catch (err) {
      setPortalError(err.message || "Unable to load student report.");
    }
  };

  const openCodeInspectModal = async (submissionId, questionDetail) => {
    if (submissionId) {
      try {
        const data = await performApiRequest(`/api/admin/reports/submissions/${submissionId}`);
        setCodeInspectModalData({
          title: data.submission.problem?.title || questionDetail?.title || "Coding Submission",
          studentName: data.submission.user?.name || data.submission.user?.email || "Student",
          language: data.submission.language || questionDetail?.language || "javascript",
          code: data.submission.code || questionDetail?.submittedCode || "",
          status: data.submission.status || questionDetail?.status || "ACCEPTED",
          earnedMarks: questionDetail?.earnedMarks ?? (data.submission.status === "ACCEPTED" ? 10 : 0),
          maxMarks: questionDetail?.marks ?? 10,
          testCasesPassed: questionDetail?.testCasesPassed ?? (data.submission.status === "ACCEPTED" ? 10 : 0),
          totalTestCases: questionDetail?.totalTestCases ?? 10,
        });
        setCodeInspectModalOpen(true);
        return;
      } catch (err) {
        // Fallback
      }
    }

    setCodeInspectModalData({
      title: questionDetail?.title || "Coding Submission",
      studentName: studentReportModalData?.student?.name || "Student",
      language: questionDetail?.language || "javascript",
      code: questionDetail?.submittedCode || "// No source code recorded",
      status: questionDetail?.status || "ACCEPTED",
      earnedMarks: questionDetail?.earnedMarks ?? 0,
      maxMarks: questionDetail?.marks ?? 10,
      testCasesPassed: questionDetail?.testCasesPassed ?? 0,
      totalTestCases: questionDetail?.totalTestCases ?? 10,
    });
    setCodeInspectModalOpen(true);
  };

  const downloadReportCSV = () => {
    if (!activeTestReport || !activeTestReport.students) return;
    const testInfo = activeTestReport.test || {};
    const students = activeTestReport.students || [];

    const headers = [
      "Rank",
      "Student Name",
      "Email",
      "Department",
      "Total Score",
      "Max Score",
      "Percentage",
      "Theory Score",
      "Coding Score",
      "Status",
      "Time Used (Mins)",
      "Submission Date"
    ];

    const rows = students.map((s) => [
      s.rank,
      `"${s.studentName || s.student?.name || 'Unknown Student'}"`,
      `"${s.studentEmail || s.student?.email || 'Not Available'}"`,
      `"${s.studentDepartment || s.student?.department || 'Not Available'}"`,
      s.totalScore,
      s.maxScore,
      `"${s.percentage}%"`,
      s.theoryScore,
      s.codingScore,
      `"${s.status}"`,
      s.timeUsedMinutes,
      `"${s.submittedAt ? new Date(s.submittedAt).toLocaleString() : 'N/A'}"`
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `assessment_report_${(testInfo.title || 'test').replace(/[^a-zA-Z0-9_]/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const renderAdminReports = () => {
    const stats = activeTestReport?.stats || {};
    const testInfo = activeTestReport?.test || {};
    const top3 = activeTestReport?.top3 || [];
    const students = activeTestReport?.students || [];

    const filteredStudents = students
      .filter((s) => {
        if (!reportsSearchQuery.trim()) return true;
        const q = reportsSearchQuery.toLowerCase();
        return (
          s.studentName.toLowerCase().includes(q) ||
          s.studentEmail.toLowerCase().includes(q)
        );
      })
      .filter((s) => {
        if (reportsFilterStatus === "Completed") return s.status === "Completed";
        if (reportsFilterStatus === "In Progress") return s.status !== "Completed";
        return true;
      })
      .sort((a, b) => {
        if (reportsSortField === "score") return b.totalScore - a.totalScore;
        if (reportsSortField === "percentage") return b.percentage - a.percentage;
        if (reportsSortField === "name") return a.studentName.localeCompare(b.studentName);
        if (reportsSortField === "time") return a.timeUsedMinutes - b.timeUsedMinutes;
        return a.rank - b.rank;
      });

    return (
      <div style={{ display: "grid", gap: 20 }}>
        <div style={{ ...S.adminCard, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
          <div>
            <div style={{ color: "#8b5cf6", fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em" }}>
              ASSESSMENT REPORTS & RANKING
            </div>
            <div style={{ color: ADMIN_THEME.text, fontSize: 22, fontWeight: 800, marginTop: 4 }}>
              {testInfo.title || "Select an Assessment Report"}
            </div>
          </div>

          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <label style={{ color: ADMIN_THEME.textSecondary, fontSize: 13, fontWeight: 700 }}>Select Test:</label>
            <select
              value={selectedReportTestId}
              onChange={(e) => {
                const id = e.target.value;
                setSelectedReportTestId(id);
                loadTestReport(id);
              }}
              style={{ ...S.adminInput, minWidth: 260, background: "#0f172a", color: "#f8fafc", borderColor: "#334155" }}
            >
              {reportsOverview.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.title} ({r.completedCount} submissions | Avg {r.avgPercentage}%)
                </option>
              ))}
            </select>

            <button
              onClick={() => {
                loadReportsOverview();
                if (selectedReportTestId) loadTestReport(selectedReportTestId);
              }}
              style={{ ...S.adminButton("default"), padding: "9px 16px" }}
            >
              🔄 Refresh
            </button>

            <button
              onClick={downloadReportCSV}
              style={{
                ...S.adminButton("submit"),
                padding: "9px 18px",
                background: "linear-gradient(135deg, #10b981, #059669)",
                color: "#ffffff",
                fontWeight: 800,
                boxShadow: "0 4px 14px rgba(16, 185, 129, 0.25)",
              }}
            >
              📥 DOWNLOAD REPORT
            </button>
          </div>
        </div>

        {testReportLoading ? (
          <div style={{ ...S.adminCard, textAlign: "center", padding: "40px", color: ADMIN_THEME.textSecondary }}>
            Loading assessment report statistics & student submissions...
          </div>
        ) : !activeTestReport ? (
          <div style={{ ...S.adminCard, textAlign: "center", padding: "40px", color: ADMIN_THEME.textSecondary }}>
            No assessment selected or no submissions yet.
          </div>
        ) : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14 }}>
              <div style={{ ...S.adminSubCard, background: "rgba(30, 41, 59, 0.7)", border: "1px solid #334155" }}>
                <div style={{ color: ADMIN_THEME.textSecondary, fontSize: 12, fontWeight: 700 }}>TOTAL STUDENTS</div>
                <div style={{ fontSize: 26, fontWeight: 800, color: "#38bdf8", marginTop: 4 }}>{stats.totalStudents || 0}</div>
                <div style={{ color: "#94a3b8", fontSize: 11, marginTop: 4 }}>{stats.completedStudents || 0} Completed</div>
              </div>

              <div style={{ ...S.adminSubCard, background: "rgba(30, 41, 59, 0.7)", border: "1px solid #334155" }}>
                <div style={{ color: ADMIN_THEME.textSecondary, fontSize: 12, fontWeight: 700 }}>AVERAGE SCORE</div>
                <div style={{ fontSize: 26, fontWeight: 800, color: "#a78bfa", marginTop: 4 }}>
                  {stats.avgScore || 0} <span style={{ fontSize: 14, color: "#94a3b8" }}>/ {stats.maxScore || 0}</span>
                </div>
                <div style={{ color: "#c4b5fd", fontSize: 12, fontWeight: 700, marginTop: 4 }}>Avg {stats.avgPercentage || 0}%</div>
              </div>

              <div style={{ ...S.adminSubCard, background: "rgba(30, 41, 59, 0.7)", border: "1px solid #334155" }}>
                <div style={{ color: ADMIN_THEME.textSecondary, fontSize: 12, fontWeight: 700 }}>TOP SCORE</div>
                <div style={{ fontSize: 26, fontWeight: 800, color: "#4ade80", marginTop: 4 }}>
                  {stats.highestScore || 0} <span style={{ fontSize: 14, color: "#94a3b8" }}>/ {stats.maxScore || 0}</span>
                </div>
                <div style={{ color: "#86efac", fontSize: 11, marginTop: 4 }}>Lowest: {stats.lowestScore || 0} pts</div>
              </div>

              <div style={{ ...S.adminSubCard, background: "rgba(30, 41, 59, 0.7)", border: "1px solid #334155" }}>
                <div style={{ color: ADMIN_THEME.textSecondary, fontSize: 12, fontWeight: 700 }}>THEORY AVG</div>
                <div style={{ fontSize: 26, fontWeight: 800, color: "#f472b6", marginTop: 4 }}>{stats.avgTheoryScore || 0} pts</div>
                <div style={{ color: "#94a3b8", fontSize: 11, marginTop: 4 }}>Multiple choice evaluation</div>
              </div>

              <div style={{ ...S.adminSubCard, background: "rgba(30, 41, 59, 0.7)", border: "1px solid #334155" }}>
                <div style={{ color: ADMIN_THEME.textSecondary, fontSize: 12, fontWeight: 700 }}>CODING AVG</div>
                <div style={{ fontSize: 26, fontWeight: 800, color: "#60a5fa", marginTop: 4 }}>{stats.avgCodingScore || 0} pts</div>
                <div style={{ color: "#94a3b8", fontSize: 11, marginTop: 4 }}>Automated test cases</div>
              </div>
            </div>

            <div style={S.adminCard}>
              <div style={{ ...S.adminSectionTitle, marginBottom: 14 }}>🏆 TOP 3 PERFORMERS (RANKING & TIE-BREAKER)</div>
              {!top3.length ? (
                <div style={{ color: ADMIN_THEME.textSecondary, fontSize: 13 }}>No student attempts recorded yet.</div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
                  {top3.map((student) => (
                    <div
                      key={student.submissionId}
                      style={{
                        background: student.rank === 1
                          ? "linear-gradient(135deg, rgba(234, 179, 8, 0.16), rgba(202, 138, 4, 0.08))"
                          : student.rank === 2
                          ? "linear-gradient(135deg, rgba(148, 163, 184, 0.16), rgba(100, 116, 139, 0.08))"
                          : "linear-gradient(135deg, rgba(217, 119, 6, 0.16), rgba(180, 83, 9, 0.08))",
                        border: `1px solid ${student.rank === 1 ? "#eab308" : student.rank === 2 ? "#94a3b8" : "#d97706"}`,
                        borderRadius: 16,
                        padding: "16px",
                        display: "flex",
                        flexDirection: "column",
                        gap: 10,
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 28 }}>{student.medal}</span>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 800,
                            padding: "3px 10px",
                            borderRadius: 999,
                            background: student.rank === 1 ? "#fef08a" : student.rank === 2 ? "#e2e8f0" : "#ffedd5",
                            color: student.rank === 1 ? "#713f12" : student.rank === 2 ? "#1e293b" : "#7c2d12",
                          }}
                        >
                          RANK {student.rank}
                        </span>
                      </div>

                      <div>
                        <div style={{ fontSize: 17, fontWeight: 800, color: ADMIN_THEME.text }}>{student.studentName}</div>
                        <div style={{ color: ADMIN_THEME.textSecondary, fontSize: 12 }}>
                          {student.studentEmail}
                        </div>
                      </div>

                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 4 }}>
                        <div style={{ fontSize: 22, fontWeight: 900, color: ADMIN_THEME.text }}>
                          {student.totalScore} <span style={{ fontSize: 13, color: ADMIN_THEME.textSecondary }}>/ {student.maxScore} pts</span>
                        </div>
                        <div style={{ fontSize: 16, fontWeight: 800, color: "#4ade80" }}>{student.percentage}%</div>
                      </div>

                      <div style={{ fontSize: 12, color: ADMIN_THEME.textSecondary, borderTop: "1px dashed rgba(255,255,255,0.1)", paddingTop: 8, marginTop: 4, display: "flex", justifyContent: "space-between" }}>
                        <span>Theory: {student.theoryScore} | Coding: {student.codingScore}</span>
                        <span>⏱ {student.timeUsedMinutes} mins</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={S.adminCard}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 14, marginBottom: 16 }}>
                <div style={S.adminSectionTitle}>ALL STUDENT RESULTS ({filteredStudents.length})</div>

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                  <input
                    type="text"
                    placeholder="🔍 Search name or email..."
                    value={reportsSearchQuery}
                    onChange={(e) => setReportsSearchQuery(e.target.value)}
                    style={{ ...S.adminInput, width: 220, padding: "8px 12px", fontSize: 13 }}
                  />

                  <select
                    value={reportsFilterStatus}
                    onChange={(e) => setReportsFilterStatus(e.target.value)}
                    style={{ ...S.adminInput, width: 140, padding: "8px 12px", fontSize: 13 }}
                  >
                    <option value="All">All Status</option>
                    <option value="Completed">Completed</option>
                    <option value="In Progress">In Progress</option>
                  </select>

                  <select
                    value={reportsSortField}
                    onChange={(e) => setReportsSortField(e.target.value)}
                    style={{ ...S.adminInput, width: 140, padding: "8px 12px", fontSize: 13 }}
                  >
                    <option value="rank">Sort by Rank</option>
                    <option value="score">Sort by Score</option>
                    <option value="percentage">Sort by %</option>
                    <option value="name">Sort by Name</option>
                    <option value="time">Sort by Time</option>
                  </select>
                </div>
              </div>

              {!filteredStudents.length ? (
                <div style={{ color: ADMIN_THEME.textSecondary, fontSize: 13, padding: "20px 0" }}>
                  No student submissions match the current filter/search.
                </div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, color: ADMIN_THEME.text }}>
                    <thead>
                      <tr style={{ borderBottom: `1px solid ${ADMIN_THEME.border}`, textAlign: "left", color: ADMIN_THEME.textSecondary }}>
                        <th style={{ padding: "10px" }}>Rank</th>
                        <th style={{ padding: "10px" }}>Student</th>
                        <th style={{ padding: "10px" }}>Score</th>
                        <th style={{ padding: "10px" }}>Percentage</th>
                        <th style={{ padding: "10px" }}>Breakdown</th>
                        <th style={{ padding: "10px" }}>Status</th>
                        <th style={{ padding: "10px" }}>Time Used</th>
                        <th style={{ padding: "10px", textAlign: "right" }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredStudents.map((s) => (
                        <tr key={s.submissionId} style={{ borderBottom: `1px solid ${ADMIN_THEME.divider}` }}>
                          <td style={{ padding: "12px 10px", fontWeight: 800 }}>
                            {s.rank === 1 ? "🥇 1" : s.rank === 2 ? "🥈 2" : s.rank === 3 ? "🥉 3" : s.rank}
                          </td>
                          <td style={{ padding: "12px 10px" }}>
                            <div style={{ fontWeight: 700 }}>{s.studentName}</div>
                            <div style={{ color: ADMIN_THEME.textSecondary, fontSize: 11 }}>{s.studentEmail}</div>
                          </td>
                          <td style={{ padding: "12px 10px", fontWeight: 800 }}>
                            {s.totalScore} / {s.maxScore} pts
                          </td>
                          <td style={{ padding: "12px 10px", fontWeight: 800, color: s.percentage >= 70 ? "#4ade80" : s.percentage >= 40 ? "#facc15" : "#f87171" }}>
                            {s.percentage}%
                          </td>
                          <td style={{ padding: "12px 10px", fontSize: 12, color: ADMIN_THEME.textSecondary }}>
                            Theory: {s.theoryScore} | Coding: {s.codingScore}
                          </td>
                          <td style={{ padding: "12px 10px" }}>
                            <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: "rgba(34, 197, 94, 0.14)", color: "#4ade80", border: "1px solid rgba(34, 197, 94, 0.3)" }}>
                              {s.status}
                            </span>
                          </td>
                          <td style={{ padding: "12px 10px", color: ADMIN_THEME.textSecondary }}>{s.timeUsedMinutes} mins</td>
                          <td style={{ padding: "12px 10px", textAlign: "right" }}>
                            <button
                              onClick={() => openStudentReportModal(testInfo.id, s.userId)}
                              style={{
                                padding: "5px 12px",
                                fontSize: 12,
                                fontWeight: 700,
                                borderRadius: 8,
                                border: "1px solid #8b5cf6",
                                background: "rgba(139, 92, 246, 0.12)",
                                color: "#8b5cf6",
                                cursor: "pointer",
                              }}
                            >
                              👁 VIEW REPORT
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    );
  };

  const renderAdminMalpracticeReports = () => {
    const stats = proctoringStats || {};
    const reports = proctoringReports || [];

    const filteredReports = reports.filter((r) => {
      if (proctoringFilterStatus !== "ALL" && r.proctoringStatus !== proctoringFilterStatus) {
        return false;
      }
      if (proctoringSearch.trim()) {
        const q = proctoringSearch.toLowerCase();
        return (
          r.studentName.toLowerCase().includes(q) ||
          r.studentEmail.toLowerCase().includes(q) ||
          r.testTitle.toLowerCase().includes(q)
        );
      }
      return true;
    });

    const getStatusBadge = (status, score) => {
      if (status === "REJECTED_FOR_MALPRACTICE" || status === "REJECTED") {
        return <span style={{ background: "#450a0a", color: "#f87171", border: "1px solid #991b1b", padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 700 }}>REJECTED</span>;
      }
      if (status === "CONFIRMED_MALPRACTICE") {
        return <span style={{ background: "#431407", color: "#fb923c", border: "1px solid #9a3412", padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 700 }}>MALPRACTICE CONFIRMED</span>;
      }
      if (status === "REVIEW_REQUIRED" || status === "FLAGGED" || score >= 40) {
        return <span style={{ background: "#3b0764", color: "#c084fc", border: "1px solid #6b21a8", padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 700 }}>REVIEW REQUIRED</span>;
      }
      if (status === "LOW_RISK") {
        return <span style={{ background: "#1e1b4b", color: "#818cf8", border: "1px solid #3730a3", padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 700 }}>LOW RISK</span>;
      }
      if (status === "CLEARED") {
        return <span style={{ background: "#064e3b", color: "#34d399", border: "1px solid #065f46", padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 700 }}>CLEARED</span>;
      }
      return <span style={{ background: "#064e3b", color: "#a7f3d0", border: "1px solid #047857", padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 700 }}>NORMAL</span>;
    };

    const getScoreColor = (score) => {
      if (score >= 80) return "#f87171";
      if (score >= 40) return "#fb923c";
      if (score >= 20) return "#facc15";
      return "#4ade80";
    };

    return (
      <div style={{ display: "grid", gap: 20 }}>
        {/* Header Bar */}
        <div style={{ ...S.adminCard, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
          <div>
            <div style={{ color: "#ef4444", fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em" }}>
              🚨 EXAM SECURITY & PROCTORING AUDIT
            </div>
            <div style={{ color: ADMIN_THEME.text, fontSize: 22, fontWeight: 800, marginTop: 4 }}>
              Student Malpractice Reports
            </div>
          </div>

          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <a
              href="/api/admin/reports/proctoring/export"
              target="_blank"
              rel="noreferrer"
              style={{
                background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
                color: "#fff",
                padding: "8px 16px",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 700,
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                boxShadow: "0 4px 14px rgba(239, 68, 68, 0.3)",
              }}
            >
              📥 Export CSV Report
            </a>
          </div>
        </div>

        {/* Stats Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
          <div style={{ background: "#0a0a0f", border: "1px solid #1e1e2e", borderRadius: 12, padding: 18 }}>
            <div style={{ color: "#888", fontSize: 12, fontWeight: 700 }}>TOTAL STUDENTS</div>
            <div style={{ color: "#fff", fontSize: 28, fontWeight: 800, marginTop: 4 }}>{stats.totalStudents || 0}</div>
          </div>
          <div style={{ background: "#0a0a0f", border: "1px solid #1e1e2e", borderRadius: 12, padding: 18 }}>
            <div style={{ color: "#67e8f9", fontSize: 12, fontWeight: 700 }}>ACTIVE ATTEMPTS</div>
            <div style={{ color: "#67e8f9", fontSize: 28, fontWeight: 800, marginTop: 4 }}>{stats.totalActiveAttempts || 0}</div>
          </div>
          <div style={{ background: "#0a0a0f", border: "1px solid #3b0764", borderRadius: 12, padding: 18 }}>
            <div style={{ color: "#c084fc", fontSize: 12, fontWeight: 700 }}>FLAGGED / REVIEW REQUIRED</div>
            <div style={{ color: "#c084fc", fontSize: 28, fontWeight: 800, marginTop: 4 }}>{stats.totalFlagged || 0}</div>
          </div>
          <div style={{ background: "#0a0a0f", border: "1px solid #450a0a", borderRadius: 12, padding: 18 }}>
            <div style={{ color: "#f87171", fontSize: 12, fontWeight: 700 }}>REJECTED FOR MALPRACTICE</div>
            <div style={{ color: "#f87171", fontSize: 28, fontWeight: 800, marginTop: 4 }}>{stats.totalRejected || 0}</div>
          </div>
        </div>

        {/* Filters */}
        <div style={{ ...S.adminCard, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <input
            type="text"
            value={proctoringSearch}
            onChange={(e) => setProctoringSearch(e.target.value)}
            placeholder="Search student name, email, test title..."
            style={{ flex: "1 1 240px", background: "#0f0f18", border: "1px solid #2a2a3e", color: "#fff", padding: "8px 14px", borderRadius: 8, fontSize: 13 }}
          />

          <select
            value={proctoringFilterStatus}
            onChange={(e) => setProctoringFilterStatus(e.target.value)}
            style={{ background: "#0f0f18", border: "1px solid #2a2a3e", color: "#fff", padding: "8px 14px", borderRadius: 8, fontSize: 13 }}
          >
            <option value="ALL">All Statuses</option>
            <option value="NORMAL">Normal</option>
            <option value="LOW_RISK">Low Risk</option>
            <option value="REVIEW_REQUIRED">Review Required</option>
            <option value="CONFIRMED_MALPRACTICE">Malpractice Confirmed</option>
            <option value="REJECTED_FOR_MALPRACTICE">Rejected for Malpractice</option>
            <option value="CLEARED">Cleared</option>
          </select>
        </div>

        {/* Reports Table */}
        <div style={{ ...S.adminCard, padding: 0, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", color: "#fff", fontSize: 13, textAlign: "left" }}>
            <thead>
              <tr style={{ background: "#0a0a14", borderBottom: "1px solid #1e1e2e" }}>
                <th style={{ padding: "14px 16px", color: "#888", fontWeight: 700 }}>Student</th>
                <th style={{ padding: "14px 16px", color: "#888", fontWeight: 700 }}>Test Title</th>
                <th style={{ padding: "14px 16px", color: "#888", fontWeight: 700 }}>Risk Score</th>
                <th style={{ padding: "14px 16px", color: "#888", fontWeight: 700 }}>Proctoring Status</th>
                <th style={{ padding: "14px 16px", color: "#888", fontWeight: 700 }}>Events Summary</th>
                <th style={{ padding: "14px 16px", color: "#888", fontWeight: 700 }}>Started At</th>
                <th style={{ padding: "14px 16px", color: "#888", fontWeight: 700 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredReports.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: 24, textAlign: "center", color: "#666" }}>
                    No proctoring records match your criteria.
                  </td>
                </tr>
              ) : (
                filteredReports.map((r, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #141420", background: i % 2 === 0 ? "#06060c" : "#0a0a12" }}>
                    <td style={{ padding: "14px 16px" }}>
                      <div style={{ fontWeight: 700, color: "#fff" }}>{r.studentName}</div>
                      <div style={{ fontSize: 11, color: "#888" }}>{r.studentEmail}</div>
                    </td>
                    <td style={{ padding: "14px 16px", color: "#c8c8e8", fontWeight: 600 }}>{r.testTitle}</td>
                    <td style={{ padding: "14px 16px" }}>
                      <span style={{ fontSize: 16, fontWeight: 800, color: getScoreColor(r.totalRiskScore) }}>
                        {r.totalRiskScore}
                      </span>
                    </td>
                    <td style={{ padding: "14px 16px" }}>
                      {getStatusBadge(r.proctoringStatus, r.totalRiskScore)}
                    </td>
                    <td style={{ padding: "14px 16px", color: "#aaa", fontSize: 12 }}>
                      {Object.entries(r.eventCounts || {}).length === 0 ? (
                        <span style={{ color: "#555" }}>No events</span>
                      ) : (
                        Object.entries(r.eventCounts).map(([type, cnt]) => `${type}: ${cnt}`).join(" • ")
                      )}
                    </td>
                    <td style={{ padding: "14px 16px", color: "#888", fontSize: 12 }}>
                      {r.startedAt ? new Date(r.startedAt).toLocaleTimeString() : "--"}
                    </td>
                    <td style={{ padding: "14px 16px" }}>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button
                          onClick={() => setSelectedProctoringAttempt(r)}
                          style={{ background: "#1e1b4b", border: "1px solid #3730a3", color: "#a5b4fc", padding: "4px 10px", borderRadius: 6, cursor: "pointer", fontSize: 11, fontWeight: 700 }}
                        >
                          Timeline
                        </button>
                        <button
                          onClick={() => {
                            setSelectedReviewAttempt(r);
                            setReviewStatusInput(r.proctoringStatus || "REVIEW_REQUIRED");
                            setReviewNoteInput(r.adminDecision?.note || "");
                          }}
                          style={{ background: "#312e81", border: "1px solid #4338ca", color: "#c7d2fe", padding: "4px 10px", borderRadius: 6, cursor: "pointer", fontSize: 11, fontWeight: 700 }}
                        >
                          Review
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Timeline Modal */}
        {selectedProctoringAttempt && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
            <div style={{ background: "#0a0a14", border: "1px solid #2a2a3e", borderRadius: 12, width: "100%", maxWidth: 640, maxHeight: "80vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
              <div style={{ padding: "16px 20px", borderBottom: "1px solid #1e1e2e", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ color: "#fff", fontWeight: 800, fontSize: 16 }}>Proctoring Event Timeline</div>
                  <div style={{ color: "#888", fontSize: 12 }}>{selectedProctoringAttempt.studentName} — {selectedProctoringAttempt.testTitle}</div>
                </div>
                <button onClick={() => setSelectedProctoringAttempt(null)} style={{ background: "none", border: "none", color: "#888", fontSize: 20, cursor: "pointer" }}>×</button>
              </div>

              <div style={{ padding: 20, overflowY: "auto", flex: 1, display: "grid", gap: 12 }}>
                {selectedProctoringAttempt.events.length === 0 ? (
                  <div style={{ color: "#666", textAlign: "center", padding: 20 }}>No security events recorded during this attempt.</div>
                ) : (
                  selectedProctoringAttempt.events.map((evt, idx) => (
                    <div key={idx} style={{ background: "#12121c", border: "1px solid #1e1e30", borderRadius: 8, padding: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <span style={{ fontWeight: 700, color: "#fff", fontSize: 13 }}>{evt.eventType}</span>
                          <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, background: evt.severity === "CRITICAL" ? "#450a0a" : evt.severity === "HIGH" ? "#431407" : "#1e1b4b", color: "#fff", fontWeight: 700 }}>
                            {evt.severity} (+{evt.score})
                          </span>
                        </div>
                        <div style={{ color: "#777", fontSize: 11, marginTop: 4 }}>
                          {new Date(evt.timestamp).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Review Action Modal */}
        {selectedReviewAttempt && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
            <div style={{ background: "#0a0a14", border: "1px solid #2a2a3e", borderRadius: 12, width: "100%", maxWidth: 500, padding: 20, display: "grid", gap: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #1e1e2e", paddingBottom: 12 }}>
                <div style={{ color: "#fff", fontWeight: 800, fontSize: 16 }}>Admin Malpractice Review</div>
                <button onClick={() => setSelectedReviewAttempt(null)} style={{ background: "none", border: "none", color: "#888", fontSize: 20, cursor: "pointer" }}>×</button>
              </div>

              <div>
                <label style={{ color: "#aaa", fontSize: 12, fontWeight: 700, display: "block", marginBottom: 6 }}>Proctoring Decision Status:</label>
                <select
                  value={reviewStatusInput}
                  onChange={(e) => setReviewStatusInput(e.target.value)}
                  style={{ width: "100%", background: "#0f0f18", border: "1px solid #2a2a3e", color: "#fff", padding: "8px 12px", borderRadius: 8, fontSize: 13 }}
                >
                  <option value="NORMAL">NORMAL (No malpractice)</option>
                  <option value="REVIEW_REQUIRED">REVIEW REQUIRED</option>
                  <option value="UNDER_REVIEW">UNDER REVIEW</option>
                  <option value="CONFIRMED_MALPRACTICE">CONFIRMED MALPRACTICE</option>
                  <option value="REJECTED_FOR_MALPRACTICE">REJECTED FOR MALPRACTICE</option>
                  <option value="CLEARED">CLEARED (Flag Removed)</option>
                </select>
              </div>

              <div>
                <label style={{ color: "#aaa", fontSize: 12, fontWeight: 700, display: "block", marginBottom: 6 }}>Admin Note / Audit Reason:</label>
                <textarea
                  value={reviewNoteInput}
                  onChange={(e) => setReviewNoteInput(e.target.value)}
                  placeholder="Enter audit explanation or review note..."
                  style={{ width: "100%", height: 80, background: "#0f0f18", border: "1px solid #2a2a3e", color: "#fff", padding: "8px 12px", borderRadius: 8, fontSize: 13, resize: "none" }}
                />
              </div>

              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button onClick={() => setSelectedReviewAttempt(null)} style={{ background: "#1e1e2e", border: "none", color: "#aaa", padding: "8px 16px", borderRadius: 8, cursor: "pointer", fontSize: 13 }}>Cancel</button>
                <button onClick={handleReviewSubmit} style={{ background: "#7c6af7", border: "none", color: "#fff", padding: "8px 16px", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 700 }}>Save Decision</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderStudentReportModal = () => {
    if (!studentReportModalOpen || !studentReportModalData) return null;
    const { student, test, submission } = studentReportModalData;
    const questions = submission?.details?.questions || [];

    return (
      <div style={S.modalBackdrop} onClick={() => setStudentReportModalOpen(false)}>
        <div
          style={{
            width: "min(920px, 94vw)",
            maxHeight: "calc(100vh - 40px)",
            background: "#0f172a",
            color: "#f8fafc",
            border: "1px solid #334155",
            borderRadius: 24,
            padding: "24px",
            boxShadow: "0 24px 70px rgba(0, 0, 0, 0.5)",
            display: "flex",
            flexDirection: "column",
            gap: 16,
            overflowY: "auto",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #1e293b", paddingBottom: 12 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 800, color: "#8b5cf6", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                Student Assessment Detail Report
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#f8fafc" }}>
                {student.name || "Unknown Student"}
              </div>
              <div style={{ fontSize: 13, color: "#94a3b8", marginTop: 2 }}>
                Email: {student.email} | Dept: {student.department || "Not Available"}
              </div>
            </div>
            <button
              onClick={() => setStudentReportModalOpen(false)}
              style={{ padding: "6px 14px", borderRadius: 999, border: "1px solid #475569", background: "#1e293b", color: "#f8fafc", fontWeight: 700, cursor: "pointer" }}
            >
              ✕ Close
            </button>
          </div>

          <div style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 16, padding: "16px 20px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14 }}>
            <div>
              <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 700 }}>ASSESSMENT & ATTEMPT</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#f8fafc" }}>{test.title}</div>
              <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>Attempt ID: {submission.id}</div>
            </div>

            <div>
              <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 700 }}>RANK & STATUS</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#38bdf8" }}>Rank {submission.rank} of {submission.totalStudents}</div>
              <div style={{ fontSize: 11, color: "#4ade80", fontWeight: 700, marginTop: 2 }}>Submitted: {submission.createdAt ? new Date(submission.createdAt).toLocaleString() : "N/A"}</div>
            </div>

            <div>
              <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 700 }}>SCORE BREAKDOWN</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#4ade80" }}>{submission.totalScore} / {submission.maxScore} pts ({submission.percentage}%)</div>
              <div style={{ fontSize: 11, color: "#cbd5e1", marginTop: 2 }}>Theory: {submission.theoryScore} | Coding: {submission.codingScore}</div>
            </div>

            <div>
              <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 700 }}>TIME USED</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#c4b5fd" }}>{submission.timeUsedMinutes} minutes</div>
            </div>
          </div>

          {studentReportModalData.proctoring && (
            <div style={{ background: "rgba(30, 41, 59, 0.5)", border: "1px solid #3b0764", borderRadius: 16, padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
              <div>
                <div style={{ fontSize: 11, color: "#c084fc", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  🚨 PROCTORING & SECURITY AUDIT
                </div>
                <div style={{ fontSize: 13, color: "#e2e8f0", marginTop: 2 }}>
                  Interruption Count: <strong style={{ color: "#fb923c" }}>{studentReportModalData.proctoring.interruptionCount}</strong> | Status: <strong style={{ color: "#f87171" }}>{studentReportModalData.proctoring.status}</strong>
                </div>
              </div>
              {studentReportModalData.proctoring.finishReason && (
                <div style={{ fontSize: 12, color: "#94a3b8" }}>
                  Finish Reason: <em>{studentReportModalData.proctoring.finishReason}</em>
                </div>
              )}
            </div>
          )}

          <div style={{ display: "grid", gap: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: "#cbd5e1" }}>QUESTION-BY-QUESTION EVALUATION DETAILS</div>
            {questions.map((q, idx) => {
              const isCoding = q.type === "coding";
              const isPassed = q.status === "ACCEPTED" || q.status === "Passed" || q.status === "Correct";
              const isPartial = q.status === "Partial";

              return (
                <div key={idx} style={{ background: "#1e293b", border: `1px solid ${isPassed ? "rgba(34, 197, 94, 0.3)" : isPartial ? "rgba(234, 179, 8, 0.3)" : "rgba(239, 68, 68, 0.3)"}`, borderRadius: 14, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <span style={{ fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 999, background: isCoding ? "#1e3a8a" : "#2e1065", color: isCoding ? "#60a5fa" : "#c4b5fd", border: `1px solid ${isCoding ? "#3b82f6" : "#8b5cf6"}` }}>
                        Q{idx + 1} — {isCoding ? "CODING" : "THEORY / MCQ"}
                      </span>
                      <span style={{ fontWeight: 800, color: "#f8fafc", fontSize: 15 }}>{q.title}</span>
                    </div>

                    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                      <span style={{ fontSize: 12, fontWeight: 800, color: isPassed ? "#4ade80" : isPartial ? "#facc15" : "#f87171" }}>
                        {q.status} ({q.earnedMarks} / {q.marks} pts)
                      </span>

                      {isCoding && (
                        <button
                          onClick={() => openCodeInspectModal(q.submissionId, q)}
                          style={{ padding: "3px 10px", fontSize: 11, fontWeight: 700, borderRadius: 6, border: "1px solid #38bdf8", background: "rgba(56, 189, 248, 0.12)", color: "#38bdf8", cursor: "pointer" }}
                        >
                          💻 VIEW CODE
                        </button>
                      )}
                    </div>
                  </div>

                  <div style={{ color: "#94a3b8", fontSize: 13, whiteSpace: "pre-wrap" }}>{q.statement}</div>

                  {isCoding ? (
                    <div style={{ fontSize: 12, color: "#cbd5e1", display: "flex", gap: 16 }}>
                      <span>Test Cases Passed: <strong>{q.testCasesPassed ?? 0} / {q.totalTestCases ?? 10}</strong></span>
                      <span>Language: <strong>{q.language || "javascript"}</strong></span>
                    </div>
                  ) : (
                    <div style={{ fontSize: 12, color: "#cbd5e1", display: "grid", gap: 4, background: "#0f172a", padding: "10px 12px", borderRadius: 10 }}>
                      <div>Selected Answer: <span style={{ color: isPassed ? "#4ade80" : "#f87171", fontWeight: 700 }}>{q.selectedOption || "No Answer"}</span></div>
                      <div>Correct Answer: <span style={{ color: "#4ade80", fontWeight: 700 }}>{q.correctAnswer}</span></div>
                      {q.explanation && <div style={{ color: "#94a3b8", fontSize: 11, marginTop: 2 }}>💡 Explanation: {q.explanation}</div>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  const renderCodeInspectionModal = () => {
    if (!codeInspectModalOpen || !codeInspectModalData) return null;

    return (
      <div style={S.modalBackdrop} onClick={() => setCodeInspectModalOpen(false)}>
        <div
          style={{
            width: "min(800px, 92vw)",
            maxHeight: "calc(100vh - 50px)",
            background: "#0f172a",
            color: "#f8fafc",
            border: "1px solid #334155",
            borderRadius: 24,
            padding: "24px",
            boxShadow: "0 24px 70px rgba(0, 0, 0, 0.5)",
            display: "flex",
            flexDirection: "column",
            gap: 14,
            overflowY: "auto",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #1e293b", paddingBottom: 12 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 800, color: "#38bdf8", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                Admin Code Submission Inspector
              </div>
              <div style={{ fontSize: 20, fontWeight: 800, color: "#f8fafc" }}>
                {codeInspectModalData.title}
              </div>
            </div>
            <button
              onClick={() => setCodeInspectModalOpen(false)}
              style={{ padding: "6px 14px", borderRadius: 999, border: "1px solid #475569", background: "#1e293b", color: "#f8fafc", fontWeight: 700, cursor: "pointer" }}
            >
              ✕ Close
            </button>
          </div>

          <div style={{ display: "flex", gap: 16, fontSize: 13, color: "#cbd5e1", flexWrap: "wrap", background: "#1e293b", padding: "12px 16px", borderRadius: 12 }}>
            <div>Student: <strong style={{ color: "#f8fafc" }}>{codeInspectModalData.studentName}</strong></div>
            <div>Language: <strong style={{ color: "#38bdf8" }}>{codeInspectModalData.language}</strong></div>
            <div>Status: <strong style={{ color: codeInspectModalData.status === "ACCEPTED" || codeInspectModalData.status === "Passed" ? "#4ade80" : "#f87171" }}>{codeInspectModalData.status}</strong></div>
            <div>Score: <strong style={{ color: "#a78bfa" }}>{codeInspectModalData.earnedMarks} / {codeInspectModalData.maxMarks} pts</strong></div>
            <div>Test Cases: <strong style={{ color: "#f8fafc" }}>{codeInspectModalData.testCasesPassed} / {codeInspectModalData.totalTestCases}</strong></div>
          </div>

          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#94a3b8", marginBottom: 6 }}>SUBMITTED SOURCE CODE (READ-ONLY)</div>
            <pre
              style={{
                width: "100%",
                minHeight: 260,
                maxHeight: 450,
                background: "#090d16",
                border: "1px solid #1e293b",
                borderRadius: 14,
                padding: "16px",
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 13,
                color: "#38bdf8",
                lineHeight: 1.6,
                overflowX: "auto",
                boxSizing: "border-box",
                whiteSpace: "pre-wrap",
              }}
            >
              {codeInspectModalData.code}
            </pre>
          </div>
        </div>
      </div>
    );
  };



  const renderLeftStatsPanel = () => {
    const totalTestsCount = adminAssignments.length || selectableAdminAssignments.length || 1;
    const activeStudentsCount = registeredStudents.length || participantsCount || 42;
    const completedTestsCount = adminAssignments.filter((a) => a.status === "COMPLETED").length;
    const pendingDraftsCount = adminAssignments.filter((a) => a.status === "DRAFT" || !a.status).length;

    return (
      <div style={{ display: "grid", gap: 14 }}>
        <div style={{ ...S.adminCard, padding: "16px" }}>
          <div style={{ ...S.adminSectionTitle, marginBottom: 12 }}>⚡ QUICK STATS</div>

          <div style={{ display: "grid", gap: 10 }}>
            <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 12, padding: "12px" }}>
              <div style={{ color: "#94a3b8", fontSize: 11, fontWeight: 700 }}>TOTAL ASSESSMENTS</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#38bdf8", marginTop: 2 }}>{totalTestsCount}</div>
            </div>

            <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 12, padding: "12px" }}>
              <div style={{ color: "#94a3b8", fontSize: 11, fontWeight: 700 }}>ACTIVE CANDIDATES</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#4ade80", marginTop: 2 }}>{activeStudentsCount}</div>
            </div>

            <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 12, padding: "12px" }}>
              <div style={{ color: "#94a3b8", fontSize: 11, fontWeight: 700 }}>COMPLETED ROUNDS</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#a78bfa", marginTop: 2 }}>{completedTestsCount}</div>
            </div>

            <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 12, padding: "12px" }}>
              <div style={{ color: "#94a3b8", fontSize: 11, fontWeight: 700 }}>PENDING DRAFTS</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#facc15", marginTop: 2 }}>{pendingDraftsCount}</div>
            </div>
          </div>
        </div>

        <div style={{ ...S.adminCard, padding: "16px" }}>
          <div style={{ ...S.adminSectionTitle, marginBottom: 10 }}>🖥 SYSTEM HEALTH</div>
          <div style={{ display: "grid", gap: 8, fontSize: 12, color: "#cbd5e1" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Backend API:</span>
              <span style={{ color: "#4ade80", fontWeight: 700 }}>● Online</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Execution Engine:</span>
              <span style={{ color: "#4ade80", fontWeight: 700 }}>● Judge0 Ready</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Database:</span>
              <span style={{ color: "#38bdf8", fontWeight: 700 }}>● Connected</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderRightActivityPanel = () => {
    const activities = [
      { id: "act_1", icon: "📥", text: "New MCQ Question added", time: "Just now" },
      { id: "act_2", icon: "📝", text: `Assessment "${adminCurrentTest.title}" updated`, time: "5 mins ago" },
      { id: "act_3", icon: "👤", text: "Student submission evaluated", time: "12 mins ago" },
      { id: "act_4", icon: "🎓", text: "New student candidate registered", time: "1 hr ago" },
    ];

    return (
      <div style={{ display: "grid", gap: 14 }}>
        <div style={{ ...S.adminCard, padding: "16px" }}>
          <div style={{ ...S.adminSectionTitle, marginBottom: 12 }}>🔔 RECENT ACTIVITY</div>

          <div style={{ display: "grid", gap: 10 }}>
            {activities.map((act) => (
              <div key={act.id} style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 12, padding: "10px 12px", display: "flex", gap: 10, alignItems: "flex-start" }}>
                <span style={{ fontSize: 16 }}>{act.icon}</span>
                <div>
                  <div style={{ color: "#f8fafc", fontSize: 12, fontWeight: 600, lineHeight: 1.4 }}>{act.text}</div>
                  <div style={{ color: "#94a3b8", fontSize: 10, marginTop: 2 }}>{act.time}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ ...S.adminCard, padding: "16px", background: "linear-gradient(135deg, rgba(139, 92, 246, 0.1), rgba(99, 102, 241, 0.05))", border: "1px solid rgba(139, 92, 246, 0.3)" }}>
          <div style={{ color: "#c4b5fd", fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
            💡 QUICK TIP
          </div>
          <div style={{ color: "#e2e8f0", fontSize: 12, lineHeight: 1.5 }}>
            You can upload an MCQ PDF using <strong>[↑ UPLOAD MCQ PDF]</strong> to extract questions in seconds!
          </div>
        </div>
      </div>
    );
  };

  function renderLiveTestPopupModal() {
    if (
      !showLiveTestPopup ||
      !activeContestAssignment ||
      contestEntered ||
      liveTestPopupDismissedId === activeContestAssignment.id
    ) {
      return null;
    }

    const testProbs = Array.isArray(activeContestAssignment.problems) ? activeContestAssignment.problems : [];
    const theoryCount = testProbs.filter((p) => (p.type || (Array.isArray(p.options) && p.options.length ? "theory" : "coding")) === "theory").length;
    const codingCount = testProbs.length - theoryCount;
    const totalMarks = testProbs.reduce((sum, p) => sum + (p.marks || (p.type === "theory" ? 2 : 10)), 0);
    const durationMins = activeContestAssignment.duration || activeContestAssignment.durationMinutes || 60;
    const levelText = activeContestAssignment.difficulty || activeContestAssignment.level || "Medium";

    return (
      <div
        style={S.modalBackdrop}
        onClick={() => {
          setLiveTestPopupDismissedId(activeContestAssignment.id);
          setShowLiveTestPopup(false);
        }}
      >
        <div
          style={{
            width: "min(580px, 92vw)",
            background: "linear-gradient(145deg, #090d16, #1e1b4b)",
            color: "#f8fafc",
            border: "2px solid #818cf8",
            borderRadius: 24,
            padding: "26px",
            boxShadow: "0 25px 90px rgba(99, 102, 241, 0.45)",
            display: "flex",
            flexDirection: "column",
            gap: 16,
            animation: "modalFadeIn 0.3s ease-out",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 44, height: 44, borderRadius: 14, background: "rgba(99, 102, 241, 0.2)", border: "1px solid #818cf8", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>
                📢
              </div>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#ef4444", boxShadow: "0 0 10px #ef4444" }} />
                  <span style={{ fontSize: 11, fontWeight: 900, color: "#818cf8", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                    LIVE TEST ANNOUNCEMENT
                  </span>
                </div>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#ffffff", marginTop: 2 }}>
                  Assessment Test is Live!
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setLiveTestPopupDismissedId(activeContestAssignment.id);
                setShowLiveTestPopup(false);
              }}
              style={{ padding: "6px 12px", borderRadius: 999, border: "1px solid #475569", background: "transparent", color: "#cbd5e1", fontSize: 13, cursor: "pointer" }}
            >
              ✕
            </button>
          </div>

          {/* Test Overview Main Box */}
          <div style={{ background: "rgba(15, 23, 42, 0.8)", border: "1px solid rgba(129, 140, 248, 0.35)", borderRadius: 18, padding: "18px", display: "grid", gap: 12 }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: "#38bdf8", marginBottom: 4 }}>
                {activeContestAssignment.title || "Live Assessment Challenge"}
              </div>
              <div style={{ fontSize: 13, color: "#cbd5e1", lineHeight: 1.5 }}>
                {activeContestAssignment.description || "An official test is currently active for your class. Review the specifications below and launch your exam attempt."}
              </div>
            </div>

            {/* Test Details Grid */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 2 }}>
              <div style={{ background: "rgba(30, 41, 59, 0.7)", border: "1px solid rgba(255, 255, 255, 0.08)", borderRadius: 12, padding: "10px 14px" }}>
                <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>⏱ Test Duration</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: "#ffffff", marginTop: 2 }}>{durationMins} Minutes</div>
              </div>

              <div style={{ background: "rgba(30, 41, 59, 0.7)", border: "1px solid rgba(255, 255, 255, 0.08)", borderRadius: 12, padding: "10px 14px" }}>
                <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>🎯 Total Marks</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: "#4ade80", marginTop: 2 }}>{totalMarks} Points</div>
              </div>

              <div style={{ background: "rgba(30, 41, 59, 0.7)", border: "1px solid rgba(255, 255, 255, 0.08)", borderRadius: 12, padding: "10px 14px" }}>
                <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>📝 Total Questions</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: "#ffffff", marginTop: 2 }}>
                  {testProbs.length} ({theoryCount} Theory, {codingCount} Coding)
                </div>
              </div>

              <div style={{ background: "rgba(30, 41, 59, 0.7)", border: "1px solid rgba(255, 255, 255, 0.08)", borderRadius: 12, padding: "10px 14px" }}>
                <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>⚡ Difficulty Level</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: "#a78bfa", marginTop: 2 }}>{levelText}</div>
              </div>
            </div>

            {/* Exam Rules & Guidelines */}
            <div style={{ background: "rgba(239, 68, 68, 0.08)", border: "1px solid rgba(239, 68, 68, 0.25)", borderRadius: 12, padding: "12px 14px", fontSize: 12, color: "#fca5a5" }}>
              <div style={{ fontWeight: 800, color: "#f87171", marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
                <span>🛡️ Exam Guidelines & Security Protocol</span>
              </div>
              <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 4, lineHeight: 1.4 }}>
                <li><strong>Fullscreen Required:</strong> Entering test switches browser into locked fullscreen mode.</li>
                <li><strong>Anti-Cheating Monitoring:</strong> Tab switching or unfocus triggers security warnings and auto-submits.</li>
                <li><strong>No Copy/Paste:</strong> Copying, cutting, and pasting are disabled throughout the exam.</li>
                <li><strong>Single Session:</strong> Your timer starts as soon as you click <em>Start Test Now</em>.</li>
              </ul>
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 4 }}>
            <button
              type="button"
              onClick={() => {
                setLiveTestPopupDismissedId(activeContestAssignment.id);
                setShowLiveTestPopup(false);
              }}
              style={{ padding: "12px 20px", borderRadius: 12, border: "1px solid #475569", background: "transparent", color: "#cbd5e1", fontWeight: 700, fontSize: 13, cursor: "pointer" }}
            >
              Dismiss for Now
            </button>
            <button
              type="button"
              onClick={() => {
                setShowLiveTestPopup(false);
                openContest();
              }}
              style={{
                padding: "12px 28px",
                borderRadius: 12,
                border: "none",
                background: "linear-gradient(135deg, #6366f1, #4f46e5)",
                color: "#ffffff",
                fontWeight: 800,
                fontSize: 14,
                cursor: "pointer",
                boxShadow: "0 4px 20px rgba(99, 102, 241, 0.5)",
              }}
            >
              🚀 Start Test Now
            </button>
          </div>
        </div>
      </div>
    );
  };


  const renderPdfUploadModal = () => {
    if (!pdfModalOpen) return null;

    const handlePdfFileSelect = (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setPdfStage("uploading");
      setPdfProgressText("Uploading PDF document...");

      const reader = new FileReader();
      reader.onload = async (evt) => {
        const text = evt.target.result;
        setPdfStage("extracting");
        setPdfProgressText("Extracting questions and options A/B/C/D...");

        setTimeout(async () => {
          setPdfStage("processing");
          setPdfProgressText("Detecting correct answers, marks, and categories...");

          try {
            const data = await performApiRequest("/api/problems/upload-mcq-pdf", {
              method: "POST",
              body: JSON.stringify({ rawText: text }),
            });

            setPdfDraftQuestions(data.questions || []);
            setPdfStage("ready");
            setPdfProgressText("");
          } catch (err) {
            setPortalError(err.message || "Failed to extract questions from file.");
            setPdfStage("idle");
          }
        }, 600);
      };

      reader.readAsText(file);
    };

    const handleImportAllPdfs = async () => {
      if (!pdfDraftQuestions.length) return;
      setPdfImporting(true);

      try {
        const data = await performApiRequest("/api/problems/import-mcq-bulk", {
          method: "POST",
          body: JSON.stringify({ questions: pdfDraftQuestions }),
        });

        const createdCount = data.count || data.problems?.length || 0;
        const importedDbIds = (data.problems || []).map((p) => p.dbId || p.id).filter(Boolean);
        if (importedDbIds.length) {
          setAdminCreateForm((prev) => ({
            ...prev,
            questions: Array.from(new Set([...prev.questions, ...importedDbIds])),
          }));
        }
        setPortalMessage(`Successfully imported ${createdCount} MCQ question(s) into database & attached to active test draft!`);

        await loadAdminPortalData();

        setPdfModalOpen(false);
        setPdfStage("idle");
        setPdfDraftQuestions([]);
      } catch (err) {
        setPortalError(err.message || "Failed to import questions.");
      } finally {
        setPdfImporting(false);
      }
    };

    return (
      <div style={S.modalBackdrop} onClick={() => setPdfModalOpen(false)}>
        <div
          style={{
            width: "min(920px, 94vw)",
            maxHeight: "calc(100vh - 40px)",
            background: "#0f172a",
            color: "#f8fafc",
            border: "1px solid #334155",
            borderRadius: 24,
            padding: "24px",
            boxShadow: "0 24px 70px rgba(0, 0, 0, 0.5)",
            display: "flex",
            flexDirection: "column",
            gap: 16,
            overflowY: "auto",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #1e293b", paddingBottom: 12 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 800, color: "#38bdf8", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                BULK MCQ PDF IMPORTER
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#f8fafc" }}>
                Upload & Extract MCQ Questions
              </div>
            </div>
            <button
              onClick={() => setPdfModalOpen(false)}
              style={{ padding: "6px 14px", borderRadius: 999, border: "1px solid #475569", background: "#1e293b", color: "#f8fafc", fontWeight: 700, cursor: "pointer" }}
            >
              ✕ Close
            </button>
          </div>

          {pdfStage !== "ready" && pdfStage !== "idle" ? (
            <div style={{ padding: "40px", textAlign: "center", display: "grid", gap: 12 }}>
              <div style={{ fontSize: 28 }}>⏳</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: "#38bdf8" }}>{pdfProgressText}</div>
              <div style={{ fontSize: 12, color: "#94a3b8" }}>Stage: {pdfStage.toUpperCase()}</div>
            </div>
          ) : !pdfDraftQuestions.length ? (
            <div style={{ border: "2px dashed #334155", borderRadius: 16, padding: "40px", textAlign: "center", background: "#1e293b" }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>📄</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#f8fafc", marginBottom: 6 }}>Select MCQ PDF or Text Document</div>
              <div style={{ fontSize: 13, color: "#94a3b8", marginBottom: 16 }}>Supports formatted questions (Q1. Statement, A/B/C/D options, Correct Answer)</div>
              <input type="file" accept=".pdf,.txt,.doc" onChange={handlePdfFileSelect} style={{ display: "none" }} id="pdf_mcq_input" />
              <label htmlFor="pdf_mcq_input" style={{ ...S.adminButton("submit"), padding: "10px 24px", cursor: "pointer" }}>
                📁 Select MCQ Document
              </label>
            </div>
          ) : (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: "#4ade80" }}>
                  Extracted {pdfDraftQuestions.length} Question(s) — Ready for Review & Import
                </div>
                <button
                  onClick={handleImportAllPdfs}
                  disabled={pdfImporting}
                  style={{
                    padding: "10px 24px",
                    borderRadius: 10,
                    border: "none",
                    background: "linear-gradient(135deg, #10b981, #059669)",
                    color: "#ffffff",
                    fontWeight: 800,
                    cursor: pdfImporting ? "not-allowed" : "pointer",
                    opacity: pdfImporting ? 0.6 : 1,
                  }}
                >
                  {pdfImporting ? "Importing..." : `IMPORT ALL (${pdfDraftQuestions.length} QUESTIONS)`}
                </button>
              </div>

              <div style={{ display: "grid", gap: 14 }}>
                {pdfDraftQuestions.map((q, idx) => (
                  <div key={q.tempId || idx} style={{ background: "#1e293b", border: `1px solid ${q.isMalformed ? "#f87171" : "#334155"}`, borderRadius: 14, padding: "16px", display: "grid", gap: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontWeight: 800, color: "#38bdf8", fontSize: 14 }}>Q{idx + 1}. {q.title}</span>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <span style={{ fontSize: 11, fontWeight: 800, padding: "2px 8px", borderRadius: 999, background: q.isMalformed ? "rgba(239,68,68,0.2)" : "rgba(34,197,94,0.2)", color: q.isMalformed ? "#f87171" : "#4ade80" }}>
                          {q.isMalformed ? "⚠️ Malformed" : "Valid"}
                        </span>
                        <button
                          onClick={() => setPdfDraftQuestions(pdfDraftQuestions.filter((_, i) => i !== idx))}
                          style={{ padding: "4px 10px", fontSize: 11, fontWeight: 700, borderRadius: 6, border: "1px solid #f87171", background: "rgba(239,68,68,0.12)", color: "#f87171", cursor: "pointer" }}
                        >
                          🗑 Delete
                        </button>
                      </div>
                    </div>

                    <div style={{ color: "#e2e8f0", fontSize: 13 }}>{q.statement}</div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      {q.options.map((opt, oIdx) => (
                        <div key={oIdx} style={{ background: "#0f172a", border: "1px solid #334155", padding: "8px 12px", borderRadius: 8, fontSize: 12, color: opt === q.correctAnswer ? "#4ade80" : "#cbd5e1" }}>
                          <strong>{String.fromCharCode(65 + oIdx)}.</strong> {opt} {opt === q.correctAnswer && "✓"}
                        </div>
                      ))}
                    </div>

                    <div style={{ fontSize: 12, color: "#94a3b8", display: "flex", gap: 16 }}>
                      <span>Correct Answer: <strong style={{ color: "#4ade80" }}>{q.correctAnswer}</strong></span>
                      <span>Marks: <strong>{q.marks}</strong></span>
                      <span>Category: <strong>{q.category}</strong></span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    );
  };

  const renderAdminPreviewModal = () => {
    if (!adminPreviewOpen) return null;
    const previewProblemIds = adminCreateForm.questions.length ? adminCreateForm.questions : (adminCurrentTest.questions || []);
    const previewProblems = previewProblemIds
      .map((qId) => problemBank.find((p) => p.dbId === qId || p.id === qId || p.legacyId === qId))
      .filter(Boolean);

    const activeIdx = Math.min(adminPreviewActiveIdx, Math.max(0, previewProblems.length - 1));
    const activeProblem = previewProblems[activeIdx] || previewProblems[0];
    const isTheory = activeProblem && (activeProblem.type === "theory" || (Array.isArray(activeProblem.options) && activeProblem.options.length));

    return (
      <div style={S.modalBackdrop} onClick={() => setAdminPreviewOpen(false)}>
        <div
          style={{
            width: "min(960px, 94vw)",
            maxHeight: "calc(100vh - 40px)",
            background: "#0f172a",
            color: "#f8fafc",
            border: "1px solid #334155",
            borderRadius: 24,
            padding: "24px",
            boxShadow: "0 24px 70px rgba(0, 0, 0, 0.4)",
            display: "flex",
            flexDirection: "column",
            gap: 16,
            overflowY: "auto",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #1e293b", paddingBottom: 12 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 800, color: "#8b5cf6", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                Admin Assessment Preview Mode
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#f8fafc" }}>
                {adminCreateForm.title || "Combined Assessment"}
              </div>
            </div>
            <button
              onClick={() => setAdminPreviewOpen(false)}
              style={{ padding: "8px 16px", borderRadius: 999, border: "1px solid #475569", background: "#1e293b", color: "#f8fafc", fontWeight: 700, cursor: "pointer" }}
            >
              Close Preview ✕
            </button>
          </div>

          {!previewProblems.length ? (
            <div style={{ padding: "30px", textAlign: "center", color: "#94a3b8" }}>
              No questions selected for this assessment preview. Select questions in the Create Test section.
            </div>
          ) : (
            <>
              <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 6 }}>
                {previewProblems.map((p, idx) => {
                  const pIsTheory = p.type === "theory" || (Array.isArray(p.options) && p.options.length);
                  return (
                    <button
                      key={p.dbId || p.id || idx}
                      onClick={() => setAdminPreviewActiveIdx(idx)}
                      style={{
                        padding: "8px 14px",
                        borderRadius: 10,
                        border: idx === activeIdx ? `2px solid ${pIsTheory ? "#8b5cf6" : "#2563eb"}` : "1px solid #334155",
                        background: idx === activeIdx ? (pIsTheory ? "#2e1065" : "#1e3a8a") : "#1e293b",
                        color: "#f8fafc",
                        fontWeight: 700,
                        fontSize: 12,
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {idx + 1}. [{pIsTheory ? "THEORY" : "CODING"}] {p.title}
                    </button>
                  );
                })}
              </div>

              {activeProblem && (
                <div style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 16, padding: "20px", display: "grid", gap: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                      <span style={{ fontSize: 12, fontWeight: 800, padding: "4px 10px", borderRadius: 999, background: isTheory ? "#8b5cf6" : "#2563eb", color: "#ffffff" }}>
                        {isTheory ? "THEORY QUESTION" : "CODING QUESTION"}
                      </span>
                      <span style={{ fontSize: 13, color: "#94a3b8" }}>{activeProblem.difficulty} | {activeProblem.marks || (isTheory ? 2 : 10)} Marks</span>
                    </div>
                    <span style={{ fontSize: 13, color: "#cbd5e1" }}>Question {activeIdx + 1} of {previewProblems.length}</span>
                  </div>

                  <h3 style={{ margin: 0, fontSize: 20, color: "#f8fafc" }}>{activeProblem.title}</h3>
                  <div style={{ color: "#e2e8f0", fontSize: 15, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
                    {activeProblem.statement || activeProblem.description}
                  </div>

                  {isTheory ? (
                    <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#94a3b8" }}>Multiple Choice Options (Candidate Preview):</div>
                      {(activeProblem.options || []).map((opt, oIdx) => (
                        <div key={oIdx} style={{ display: "flex", gap: 12, alignItems: "center", padding: "12px 16px", borderRadius: 12, background: "#0f172a", border: "1px solid #334155", color: "#f8fafc" }}>
                          <input type="radio" disabled name={`preview_${activeProblem.id}`} style={{ width: 18, height: 18 }} />
                          <span style={{ fontWeight: 700, color: "#94a3b8", width: 20 }}>{String.fromCharCode(65 + oIdx)}.</span>
                          <span style={{ fontSize: 14 }}>{opt}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#94a3b8" }}>Starter Code IDE Preview:</div>
                      <pre style={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 12, padding: "14px", fontFamily: "'JetBrains Mono', monospace", color: "#38bdf8", fontSize: 13, overflowX: "auto" }}>
                        {activeProblem.starterCode?.javascript || "function solve(input) {\n  return input;\n}"}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    );
  };

  const openCreateMcqModal = () => {
    setMcqEditingProblem(null);
    setMcqForm({
      title: "",
      statement: "",
      category: "Python",
      difficulty: "Easy",
      marks: "2",
      options: ["", "", "", ""],
      correctAnswerIndex: null,
      explanation: "",
    });
    setMcqValidationError("");
    setMcqModalOpen(true);
  };

  const openEditMcqModal = (problem) => {
    setMcqEditingProblem(problem);
    const opts = Array.isArray(problem.options) && problem.options.length >= 2 ? problem.options : ["", "", "", ""];
    const cIdx = opts.findIndex(
      (o) => String(o).trim().toLowerCase() === String(problem.correctAnswer || "").trim().toLowerCase()
    );
    setMcqForm({
      title: problem.title || "",
      statement: problem.statement || problem.description || "",
      category: getProblemCategory(problem),
      difficulty: problem.difficulty || "Easy",
      marks: String(problem.marks || 2),
      options: opts,
      correctAnswerIndex: cIdx >= 0 ? cIdx : 0,
      explanation: problem.explanation || "",
    });
    setMcqValidationError("");
    setMcqModalOpen(true);
  };

  const handleSaveMcq = async () => {
    const stmt = mcqForm.statement.trim();
    const titleText = mcqForm.title.trim() || stmt.slice(0, 80);

    if (!stmt) {
      setMcqValidationError("Question text cannot be empty.");
      return;
    }

    const validOptions = mcqForm.options.map((o) => String(o || "").trim());
    if (validOptions.length < 2) {
      setMcqValidationError("At least 2 options are required.");
      return;
    }

    const hasEmptyOption = validOptions.some((o) => !o);
    if (hasEmptyOption) {
      setMcqValidationError("Option text cannot be empty. Please fill in all option fields (A, B, C, D).");
      return;
    }

    if (
      mcqForm.correctAnswerIndex === null ||
      mcqForm.correctAnswerIndex === undefined ||
      mcqForm.correctAnswerIndex < 0 ||
      mcqForm.correctAnswerIndex >= validOptions.length
    ) {
      setMcqValidationError("Please select exactly ONE correct answer option.");
      return;
    }

    const marksNum = Number(mcqForm.marks);
    if (Number.isNaN(marksNum) || marksNum <= 0) {
      setMcqValidationError("Marks must be a positive number greater than 0.");
      return;
    }

    setMcqSaving(true);
    setMcqValidationError("");

    try {
      const selectedAnswerText = validOptions[mcqForm.correctAnswerIndex];
      const targetId = mcqEditingProblem ? (mcqEditingProblem.dbId || mcqEditingProblem.id) : null;
      const endpoint = targetId ? `/api/problems/${targetId}` : "/api/problems";
      const method = targetId ? "PUT" : "POST";

      const payload = {
        type: "theory",
        title: titleText,
        statement: stmt,
        difficulty: mcqForm.difficulty,
        tags: [mcqForm.category || "Python", "MCQ", "Custom"],
        options: validOptions,
        correctAnswer: selectedAnswerText,
        explanation: mcqForm.explanation ? mcqForm.explanation.trim() : "",
        marks: marksNum,
        acceptance: targetId ? "Admin MCQ Edit" : "Custom MCQ",
      };

      const data = await performApiRequest(endpoint, {
        method,
        body: JSON.stringify(payload),
      });

      const updatedProblems = await loadProblemBank();
      const savedProb = mapProblemRecord(data.problem) || updatedProblems.find((p) => p.title === titleText);

      if (savedProb?.dbId && !targetId) {
        setAdminCreateForm((prev) => ({
          ...prev,
          questions: prev.questions.includes(savedProb.dbId) ? prev.questions : [...prev.questions, savedProb.dbId],
        }));
      }

      setMcqModalOpen(false);
      setPortalMessage(
        targetId
          ? `MCQ "${savedProb?.title || titleText}" updated successfully.`
          : `New MCQ "${savedProb?.title || titleText}" created and added to test!`
      );
    } catch (err) {
      setMcqValidationError(err.message || "Failed to save MCQ question.");
    } finally {
      setMcqSaving(false);
    }
  };

  const renderMcqModal = () => {
    if (!mcqModalOpen) return null;

    const handleOptionChange = (idx, val) => {
      setMcqForm((prev) => {
        const nextOpts = [...prev.options];
        nextOpts[idx] = val;
        return { ...prev, options: nextOpts };
      });
    };

    return (
      <div style={S.modalBackdrop} onClick={() => !mcqSaving && setMcqModalOpen(false)}>
        <div
          style={{
            width: "min(680px, 94vw)",
            maxHeight: "calc(100vh - 50px)",
            background: "#0f172a",
            color: "#f8fafc",
            border: "1px solid #334155",
            borderRadius: 24,
            padding: "24px",
            boxShadow: "0 24px 70px rgba(0, 0, 0, 0.5)",
            display: "flex",
            flexDirection: "column",
            gap: 16,
            overflowY: "auto",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #1e293b", paddingBottom: 12 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 800, color: "#8b5cf6", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                Admin Test Creation Tool
              </div>
              <div style={{ fontSize: 20, fontWeight: 800, color: "#f8fafc" }}>
                {mcqEditingProblem ? "Edit MCQ Question" : "Create New MCQ Question"}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setMcqModalOpen(false)}
              disabled={mcqSaving}
              style={{ padding: "6px 14px", borderRadius: 999, border: "1px solid #475569", background: "#1e293b", color: "#f8fafc", fontWeight: 700, cursor: "pointer" }}
            >
              ✕ Close
            </button>
          </div>

          {mcqValidationError && (
            <div style={{ background: "rgba(220, 38, 38, 0.15)", border: "1px solid #ef4444", color: "#fca5a5", borderRadius: 12, padding: "12px 14px", fontSize: 13, fontWeight: 600 }}>
              ⚠️ {mcqValidationError}
            </div>
          )}

          <div style={{ display: "grid", gap: 16 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#cbd5e1", marginBottom: 6 }}>
                QUESTION <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <textarea
                value={mcqForm.statement}
                onChange={(e) => setMcqForm({ ...mcqForm, statement: e.target.value, title: e.target.value.slice(0, 80) })}
                placeholder="Enter question"
                rows={3}
                style={{
                  width: "100%",
                  background: "#1e293b",
                  border: "1px solid #334155",
                  borderRadius: 12,
                  color: "#f8fafc",
                  padding: "12px 14px",
                  fontSize: 14,
                  outline: "none",
                  resize: "vertical",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#cbd5e1", marginBottom: 8 }}>
                OPTIONS <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <div style={{ display: "grid", gap: 10 }}>
                {mcqForm.options.map((optText, oIdx) => {
                  const letter = String.fromCharCode(65 + oIdx);
                  return (
                    <div key={oIdx} style={{ display: "flex", gap: 10, alignItems: "center" }}>
                      <span style={{ fontWeight: 800, color: "#94a3b8", fontSize: 14, minWidth: 20 }}>
                        {letter}.
                      </span>
                      <input
                        type="text"
                        value={optText}
                        onChange={(e) => handleOptionChange(oIdx, e.target.value)}
                        placeholder={`Enter option ${letter}`}
                        style={{
                          flex: 1,
                          background: "#1e293b",
                          border: "1px solid #334155",
                          borderRadius: 10,
                          color: "#f8fafc",
                          padding: "10px 12px",
                          fontSize: 13,
                          outline: "none",
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#cbd5e1", marginBottom: 8 }}>
                CORRECT ANSWER <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <div style={{ display: "flex", gap: 20, alignItems: "center", background: "#1e293b", border: "1px solid #334155", borderRadius: 12, padding: "12px 16px" }}>
                {mcqForm.options.map((_, oIdx) => {
                  const letter = String.fromCharCode(65 + oIdx);
                  const isCorrect = mcqForm.correctAnswerIndex === oIdx;
                  return (
                    <label key={oIdx} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", userSelect: "none" }}>
                      <input
                        type="radio"
                        name="mcqCorrectAnswerChoice"
                        checked={isCorrect}
                        onChange={() => setMcqForm({ ...mcqForm, correctAnswerIndex: oIdx })}
                        style={{ width: 18, height: 18, accentColor: "#8b5cf6", cursor: "pointer" }}
                      />
                      <span style={{ fontWeight: isCorrect ? 800 : 600, color: isCorrect ? "#c4b5fd" : "#cbd5e1", fontSize: 14 }}>
                        {letter}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#cbd5e1", marginBottom: 6 }}>MARKS</label>
                <input
                  type="number"
                  min="1"
                  value={mcqForm.marks}
                  onChange={(e) => setMcqForm({ ...mcqForm, marks: e.target.value })}
                  style={{ width: "100%", background: "#1e293b", border: "1px solid #334155", borderRadius: 10, color: "#f8fafc", padding: "10px", fontSize: 13, outline: "none", boxSizing: "border-box" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#cbd5e1", marginBottom: 6 }}>DIFFICULTY</label>
                <select
                  value={mcqForm.difficulty}
                  onChange={(e) => setMcqForm({ ...mcqForm, difficulty: e.target.value })}
                  style={{ width: "100%", background: "#1e293b", border: "1px solid #334155", borderRadius: 10, color: "#f8fafc", padding: "10px", fontSize: 13, outline: "none" }}
                >
                  <option value="Easy">Easy</option>
                  <option value="Medium">Medium</option>
                  <option value="Hard">Hard</option>
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#cbd5e1", marginBottom: 6 }}>TOPIC</label>
                <select
                  value={mcqForm.category}
                  onChange={(e) => setMcqForm({ ...mcqForm, category: e.target.value })}
                  style={{ width: "100%", background: "#1e293b", border: "1px solid #334155", borderRadius: 10, color: "#f8fafc", padding: "10px", fontSize: 13, outline: "none" }}
                >
                  {questionCategories.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#cbd5e1", marginBottom: 6 }}>
                EXPLANATION (OPTIONAL)
              </label>
              <textarea
                value={mcqForm.explanation}
                onChange={(e) => setMcqForm({ ...mcqForm, explanation: e.target.value })}
                placeholder="Enter explanation"
                rows={2}
                style={{
                  width: "100%",
                  background: "#1e293b",
                  border: "1px solid #334155",
                  borderRadius: 12,
                  color: "#f8fafc",
                  padding: "10px 12px",
                  fontSize: 13,
                  outline: "none",
                  resize: "vertical",
                  boxSizing: "border-box",
                }}
              />
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 10 }}>
            <button
              type="button"
              onClick={() => setMcqModalOpen(false)}
              disabled={mcqSaving}
              style={{ padding: "10px 18px", borderRadius: 10, border: "1px solid #475569", background: "transparent", color: "#cbd5e1", fontWeight: 700, cursor: "pointer" }}
            >
              CANCEL
            </button>
            <button
              type="button"
              onClick={handleSaveMcq}
              disabled={mcqSaving}
              style={{
                padding: "10px 22px",
                borderRadius: 10,
                border: "none",
                background: "linear-gradient(135deg, #8b5cf6, #6366f1)",
                color: "#ffffff",
                fontWeight: 700,
                cursor: mcqSaving ? "not-allowed" : "pointer",
                opacity: mcqSaving ? 0.6 : 1,
              }}
            >
              {mcqSaving ? "Saving..." : mcqEditingProblem ? "SAVE MCQ" : "ADD MCQ"}
            </button>
          </div>
        </div>
      </div>
    );
  };

  if (view === "admin") return (
    <div style={{ position: "relative" }} onContextMenu={(e) => e.preventDefault()}>
      <ScreenShield active={screenShield} message={shieldMessage} />
      <div style={{ ...S.adminApp, opacity: screenShield ? 0 : 1, pointerEvents: screenShield ? "none" : "auto", transition: "opacity 0.12s ease", userSelect: screenShield ? "none" : "auto" }}>
        <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,700&family=Outfit:wght@400;500;600;700&family=Space+Grotesk:wght@400;600;800&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet" />
        <nav style={S.adminNav}>
          <DevOrbitLogo lightSurface onClick={()=>setView("home")} />
          <span style={S.adminNavTitle}>Admin Portal</span>
          <div style={{ marginLeft:"auto" }}>
            <button onClick={signOut} style={S.adminButton("default")}>Sign Out</button>
          </div>
        </nav>

        <div style={S.adminShell}>
          {renderAdminPreviewModal()}
          {renderMcqModal()}
          {renderQuestionUploadSuccessModal()}
          {renderDeleteQuestionModal()}
          {renderStudentReportModal()}
          {renderCodeInspectionModal()}
          {renderPdfUploadModal()}
          {renderLiveTestPopupModal()}

          {adminWarning && (
            <div style={S.adminAlert("warning")}>
              {adminWarning}
            </div>
          )}

          {portalError && (
            <div style={S.adminAlert("error")}>
              {portalError}
            </div>
          )}

          {portalMessage && (
            <div style={S.adminAlert("success")}>
              {portalMessage}
            </div>
          )}

          {adminAssignmentsLoading && (
            <div style={S.adminAlert("info")}>
              Loading live portal data from MongoDB...
            </div>
          )}

          <div style={S.adminTabBar}>
            {adminTabs.map((tab) => (
              <button key={tab.id} onClick={() => setAdminTab(tab.id)} style={S.adminTabButton(adminTab === tab.id)}>
                {tab.label}
              </button>
            ))}
          </div>

          {adminTab === "overview" && (
            <div style={{ display: "flex", gap: 20, flexWrap: "wrap", alignItems: "flex-start", width: "100%" }}>
              <div style={{ flex: "1 1 240px", maxWidth: 280, minWidth: 220 }}>
                {renderLeftStatsPanel()}
              </div>

              <div style={{ flex: "3 1 640px", minWidth: 0 }}>
                <div style={S.adminCardGrid}>
            <div style={S.adminCard}>
              <div style={S.adminSectionTitle}>Current Test</div>
              <div style={{ fontSize:24, fontWeight:700, color:ADMIN_THEME.text, marginBottom:14 }}>{adminCurrentTest.title}</div>
              <div style={{ display:"grid", gap:8, color:ADMIN_THEME.textSecondary, fontSize:14 }}>
                <div>Level: <span style={{ color:ADMIN_THEME.secondary, fontWeight:700 }}>{adminCurrentTest.level}</span></div>
                <div>Date: <span style={{ color:ADMIN_THEME.text, fontWeight:600 }}>{adminCurrentTest.date}</span></div>
                <div>Duration: <span style={{ color:ADMIN_THEME.text, fontWeight:600 }}>{adminCurrentTest.duration} mins</span></div>
                <div>Status: <span style={{ color:adminCurrentStatusColor, fontWeight:700 }}>{adminCurrentStatus}</span></div>
                <div>Start: <span style={{ color:ADMIN_THEME.text, fontWeight:600 }}>{formatPortalDate(adminCurrentTest.startsAt)}</span></div>
                <div>Timer: <span style={{ color:currentTestEnded ? ADMIN_THEME.error : ADMIN_THEME.primary, fontWeight:700 }}>{formatCountdown(adminTimerSeconds)}</span></div>
              </div>
              <div style={{ marginTop:14 }}>
                <label style={S.adminFieldLabel}>Manage Test</label>
                <select
                  value={adminCurrentTest.id || ""}
                  onChange={(e) => {
                    const selectedAssignment = selectableAdminAssignments.find((assignment) => sameValue(assignment.id, e.target.value));
                    if (!selectedAssignment) return;
                    setAdminCurrentTest(selectedAssignment);
                    setAdminSubmissionProblemId(selectedAssignment?.problems?.[0]?.id || "");
                    setSolutionsVisible(false);
                  }}
                  style={S.adminInput}
                >
                  {selectableAdminAssignments.map((assignment) => (
                    <option key={assignment.id || "default-test"} value={assignment.id || ""}>
                      {assignment.title} - {assignment.status || "DRAFT"}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ display:"flex", gap:10, flexWrap:"wrap", marginTop:16 }}>
                <button
                  onClick={handleStartAssignedTest}
                  disabled={adminStartingTest || !adminCurrentTest.id || adminCurrentTest.status === "LIVE"}
                  style={{
                    ...S.adminButton("submit"),
                    opacity: adminStartingTest || !adminCurrentTest.id || adminCurrentTest.status === "LIVE" ? 0.6 : 1,
                    cursor: adminStartingTest || !adminCurrentTest.id || adminCurrentTest.status === "LIVE" ? "not-allowed" : "pointer",
                  }}
                >
                  {adminStartingTest ? "Starting..." : adminCurrentTest.status === "LIVE" ? "Test Live" : "Start Test"}
                </button>
                <button
                  onClick={handleStopAssignedTest}
                  disabled={adminStoppingTest || !adminCurrentTest.id || adminCurrentTest.status !== "LIVE"}
                  style={{
                    ...S.adminButton("default"),
                    color: adminCurrentTest.status === "LIVE" ? ADMIN_THEME.error : ADMIN_THEME.textSecondary,
                    border: adminCurrentTest.status === "LIVE" ? `1px solid ${ADMIN_THEME.error}` : `1px solid ${ADMIN_THEME.border}`,
                    opacity: adminStoppingTest || !adminCurrentTest.id || adminCurrentTest.status !== "LIVE" ? 0.6 : 1,
                    cursor: adminStoppingTest || !adminCurrentTest.id || adminCurrentTest.status !== "LIVE" ? "not-allowed" : "pointer",
                  }}
                >
                  {adminStoppingTest ? "Stopping..." : "Stop Test"}
                </button>
                <button
                  onClick={() => syncProblemBankToDatabase(false)}
                  disabled={adminSyncingProblems}
                  style={{ ...S.adminButton("default"), opacity: adminSyncingProblems ? 0.6 : 1, cursor: adminSyncingProblems ? "not-allowed" : "pointer" }}
                >
                  {adminSyncingProblems ? "Syncing..." : "Sync Problems"}
                </button>
              </div>
            </div>

            <div style={S.adminCard}>
              <div style={S.adminSectionTitle}>Test Queue</div>
              <div style={{ color:ADMIN_THEME.textSecondary, fontSize:13, marginBottom:12 }}>
                Live now: <span style={{ color:ADMIN_THEME.success, fontWeight:700 }}>{liveAdminAssignments.length}</span>
              </div>
              <div style={{ display:"grid", gap:10 }}>
                {selectableAdminAssignments.slice(0, 5).map((test, index) => (
                  <button
                    key={test.id || `test-${index}`}
                    onClick={() => {
                      setAdminCurrentTest(test);
                      setAdminSubmissionProblemId(test?.problems?.[0]?.id || "");
                      setSolutionsVisible(false);
                    }}
                    style={{
                      background:adminCurrentTest?.id===test.id ? ADMIN_THEME.sidebarActive : ADMIN_THEME.hoverBackground,
                      border:adminCurrentTest?.id===test.id ? `1px solid ${ADMIN_THEME.primary}` : `1px solid ${ADMIN_THEME.border}`,
                      borderRadius:12,
                      color:ADMIN_THEME.text,
                      padding:"12px 14px",
                      textAlign:"left",
                      cursor:"pointer",
                      boxShadow:adminCurrentTest?.id===test.id ? ADMIN_THEME.shadowSoft : "none"
                    }}
                  >
                    <div style={{ display:"flex", justifyContent:"space-between", gap:10, alignItems:"center" }}>
                      <span style={{ fontWeight:700 }}>{test.title || test.name}</span>
                      <span style={{ color:test.status === "LIVE" ? ADMIN_THEME.success : test.status === "ENDED" ? ADMIN_THEME.error : ADMIN_THEME.info, fontSize:11, fontWeight:800 }}>{test.status || "ENDED"}</span>
                    </div>
                    <div style={{ color:ADMIN_THEME.textSecondary, fontSize:12, marginTop:4 }}>{test.date} | {test.level || test.difficulty}</div>
                  </button>
                ))}
              </div>
            </div>

            <div style={S.adminCard}>
              <div style={S.adminSectionTitle}>Participants</div>
              <div style={{ fontSize:32, fontWeight:800, color:ADMIN_THEME.primary, lineHeight:1, marginBottom:10 }}>{participantsCount}</div>
              <div style={{ color:ADMIN_THEME.textSecondary, fontSize:14, marginBottom:12 }}>Students with login activity stored in MongoDB</div>
              <div style={{ display:"inline-flex", alignItems:"center", gap:8, padding:"6px 10px", borderRadius:999, background:"rgba(22, 163, 74, 0.08)", border:"1px solid rgba(22, 163, 74, 0.18)", color:ADMIN_THEME.success, fontSize:12, fontWeight:700 }}>
                <span style={{ width:8, height:8, borderRadius:"50%", background:ADMIN_THEME.success, boxShadow:"0 0 0 4px rgba(22, 163, 74, 0.12)" }} />
                Login-tracked
              </div>
            </div>

            <div style={S.adminCard}>
              <div style={S.adminSectionTitle}>Solutions</div>
              <div style={{ fontSize:14, color:ADMIN_THEME.textSecondary, marginBottom:14 }}>Submitted solutions become viewable after the timer ends.</div>
              <button
                onClick={() => setSolutionsVisible((prev) => !prev)}
                disabled={!currentTestEnded}
                style={{
                  ...(currentTestEnded ? S.adminButton("run") : S.adminButton("default")),
                  opacity:currentTestEnded?1:0.7,
                  cursor:currentTestEnded?"pointer":"not-allowed"
                }}
              >
                View Solutions
              </button>
            </div>
          </div>

          {currentTestEnded && adminTestReport && (
            <div style={{ display:"grid", gap:18 }}>
              <div style={S.adminCard}>
                <div style={S.adminSectionTitle}>Post-Test Report</div>
                <div style={{ display:"grid", gridTemplateColumns:`repeat(auto-fit, minmax(${isPhone ? 140 : 180}px, 1fr))`, gap:12 }}>
                  <div style={S.adminSubCard}>
                    <div style={{ color:ADMIN_THEME.textSecondary, fontSize:12 }}>Attendance</div>
                    <div style={{ color:ADMIN_THEME.text, fontSize:24, fontWeight:800 }}>{adminTestReport.attendedCount}/{adminTestReport.totalStudents}</div>
                  </div>
                  <div style={S.adminSubCard}>
                    <div style={{ color:ADMIN_THEME.textSecondary, fontSize:12 }}>Best Student</div>
                    <div style={{ color:ADMIN_THEME.text, fontSize:18, fontWeight:800 }}>{adminTestReport.bestStudent?.name || "--"}</div>
                    <div style={{ color:ADMIN_THEME.textSecondary, fontSize:12 }}>{adminTestReport.bestStudent?.score || 0} points</div>
                  </div>
                  <div style={S.adminSubCard}>
                    <div style={{ color:ADMIN_THEME.textSecondary, fontSize:12 }}>Average Score</div>
                    <div style={{ color:ADMIN_THEME.text, fontSize:24, fontWeight:800 }}>{adminTestReport.averageScore}</div>
                  </div>
                  <div style={S.adminSubCard}>
                    <div style={{ color:ADMIN_THEME.textSecondary, fontSize:12 }}>Average Time</div>
                    <div style={{ color:ADMIN_THEME.text, fontSize:24, fontWeight:800 }}>{formatDurationFromMs(adminTestReport.averageTimeSpentMs)}</div>
                  </div>
                  <div style={S.adminSubCard}>
                    <div style={{ color:ADMIN_THEME.textSecondary, fontSize:12 }}>Interrupted</div>
                    <div style={{ color:ADMIN_THEME.error, fontSize:24, fontWeight:800 }}>{adminTestReport.interruptedCount}</div>
                  </div>
                </div>
              </div>

              <div style={S.adminTableWrap}>
                <div style={{ padding:"18px 18px 8px" }}>
                  <div style={S.adminSectionTitle}>Student Attendance & Activity</div>
                  <div style={{ color:ADMIN_THEME.textSecondary, fontSize:14 }}>Each student’s attendance, score, time usage, submissions, and interruption details.</div>
                </div>
                <table style={{ width:"100%", borderCollapse:"collapse", minWidth:860 }}>
                  <thead>
                    <tr>
                      {["Student", "Attendance", "Score", "Solved", "Time Used", "Submissions", "Interruptions", "Result"].map((heading) => (
                        <th key={heading} style={S.adminTableHead}>{heading}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {adminTestReport.students.map((student) => (
                      <tr key={student.userId}>
                        <td style={S.adminTableCell}>
                          <div style={{ fontWeight:700 }}>{student.name}</div>
                          <div style={{ color:ADMIN_THEME.textSecondary, fontSize:12 }}>{student.email}</div>
                        </td>
                        <td style={S.adminTableCell}>{student.attendance}</td>
                        <td style={S.adminTableCell}>{student.score}</td>
                        <td style={S.adminTableCell}>{student.solved}</td>
                        <td style={S.adminTableCell}>{formatDurationFromMs(student.timeSpentMs)}</td>
                        <td style={S.adminTableCell}>{student.submissionCount}</td>
                        <td style={{ ...S.adminTableCell, color:student.interruptionCount ? ADMIN_THEME.error : ADMIN_THEME.success }}>
                          {student.interruptionCount}
                        </td>
                        <td style={S.adminTableCell}>
                          <div>{student.attemptStatus}</div>
                          {student.finishReason && (
                            <div style={{ color:ADMIN_THEME.textSecondary, fontSize:12, marginTop:4 }}>{student.finishReason}</div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div style={{ display:"grid", gridTemplateColumns:`repeat(auto-fit, minmax(${isPhone ? 240 : 340}px, 1fr))`, gap:18, alignItems:"start" }}>
            <div style={S.adminCard}>
              <div style={S.adminSectionTitle}>Code Submission</div>
              <div style={{ display:"grid", gap:14 }}>
                <div style={{ display:"grid", gridTemplateColumns:isPhone ? compactGrid : "1fr 1fr", gap:12 }}>
                  <div>
                    <label style={S.adminFieldLabel}>Question</label>
                    <select
                      value={String(adminSubmissionProblemId ?? "")}
                      onChange={(e) => {
                        const selectedProblem = adminCurrentTest.problems?.find((problem) => String(problem.id) === e.target.value)
                          || problemCatalog.find((problem) => String(problem.id) === e.target.value);
                        setAdminSubmissionProblemId(selectedProblem ? selectedProblem.id : e.target.value);
                      }}
                      style={S.adminInput}
                    >
                      {adminCurrentTest.questions.map((id) => {
                        const problem = adminCurrentTest.problems?.find((item) => item.id === id)
                          || problemCatalog.find((item) => item.id === id);
                        return <option key={id} value={id}>{problem ? `${problem.id}. ${problem.title}` : id}</option>;
                      })}
                    </select>
                  </div>
                  <div>
                    <label style={S.adminFieldLabel}>Language</label>
                    <select value={adminSubmissionLang} onChange={(e)=>setAdminSubmissionLang(e.target.value)} style={S.adminInput}>
                      <option value="javascript">JavaScript</option>
                      <option value="python">Python</option>
                      <option value="java">Java</option>
                    </select>
                  </div>
                </div>

                <div style={{ ...S.adminSubCard, padding:"0", overflow:"hidden" }}>
                  <div style={{ padding:"10px 12px", borderBottom:`1px solid ${ADMIN_THEME.divider}`, color:ADMIN_THEME.textSecondary, fontSize:12 }}>
                    Write solution for {adminSelectedProblem?.title || "the selected problem"}
                  </div>
                  <textarea
                    ref={adminTextareaRef}
                    value={adminSubmissionCode}
                    onChange={(e)=>setAdminSubmissionCode(e.target.value)}
                    onKeyDown={(e) => handleEditorIndentation(e, adminSubmissionCode, setAdminSubmissionCode, adminTextareaRef, adminSubmissionLang)}
                    spellCheck={false}
                    style={{ width:"100%", minHeight:240, background:ADMIN_THEME.background, color:ADMIN_THEME.text, border:"none", outline:"none", resize:"vertical", padding:"14px", fontFamily:"'JetBrains Mono',monospace", fontSize:13, lineHeight:1.7, boxSizing:"border-box" }}
                  />
                </div>

                <div style={{ display:"flex", gap:12, flexWrap:"wrap" }}>
                  <button
                    onClick={() => handleAdminRun(false)}
                    disabled={adminExecuting}
                    style={{ ...S.adminButton("run"), opacity: adminExecuting ? 0.65 : 1, cursor: adminExecuting ? "not-allowed" : "pointer" }}
                  >
                    {adminExecuting ? "Running..." : "Run Code"}
                  </button>
                  <div style={{ color:ADMIN_THEME.textSecondary, fontSize:13, alignSelf:"center" }}>
                    Execution uses the current backend runner, now powered by Judge0.
                  </div>
                </div>

                {adminExecution && (
                  <div style={S.adminSubCard}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10, gap:12, flexWrap:"wrap" }}>
                      <div style={{ color:adminExecution.status==="passed" ? ADMIN_THEME.success : ADMIN_THEME.error, fontWeight:700 }}>
                        {adminExecution.autoSubmitted ? "Auto-submitted" : "Execution Result"}
                      </div>
                      <div style={{ color:ADMIN_THEME.textSecondary, fontSize:12 }}>Runtime: {adminExecution.runtime}</div>
                    </div>
                    <div style={{ display:"grid", gap:10 }}>
                      {adminExecution.tests.map((test, index) => (
                        <div key={index} style={{ background:ADMIN_THEME.card, border:`1px solid ${ADMIN_THEME.border}`, borderRadius:12, padding:"12px 14px" }}>
                          <div style={{ color:ADMIN_THEME.text, fontWeight:700, marginBottom:6 }}>Case {index + 1}</div>
                          <div style={{ color:test.status==="pass" ? ADMIN_THEME.success : test.status==="fail" ? ADMIN_THEME.error : ADMIN_THEME.warning, fontSize:13, marginBottom:6 }}>
                            {test.status.toUpperCase()}
                          </div>
                          {test.error ? (
                            <div style={{ color:ADMIN_THEME.error, fontSize:12, whiteSpace:"pre-wrap" }}>{test.error}</div>
                          ) : (
                            <div style={{ color:ADMIN_THEME.textSecondary, fontSize:12 }}>
                              Expected: <span style={{ color:ADMIN_THEME.text }}>{test.expected}</span>
                              <br />
                              Got: <span style={{ color:ADMIN_THEME.text }}>{test.actual}</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div style={{ display:"grid", gap:18 }}>
              {/* DEDICATED MCQ TEST QUESTIONS CARD */}
              <div style={{ ...S.adminCard, background: "linear-gradient(145deg, #0f172a, #1e1b4b)", border: "2px solid #818cf8", boxShadow: "0 10px 30px rgba(99, 102, 241, 0.15)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 22 }}>📋</span>
                      <div style={{ ...S.adminSectionTitle, color: "#ffffff", margin: 0, fontSize: 18 }}>MCQ Questions (Test Purpose)</div>
                      <span style={{ fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 999, background: "#818cf8", color: "#0f172a", textTransform: "uppercase" }}>
                        For Tests Only
                      </span>
                    </div>
                    <div style={{ color: "#94a3b8", fontSize: 12, marginTop: 4 }}>
                      Manage and review theory MCQs added for test assessments.
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <button
                      type="button"
                      onClick={openCreateMcqModal}
                      style={{
                        padding: "9px 16px",
                        borderRadius: 10,
                        background: "linear-gradient(135deg, #8b5cf6, #6366f1)",
                        border: "none",
                        color: "#ffffff",
                        fontWeight: 800,
                        fontSize: 13,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        boxShadow: "0 4px 14px rgba(139, 92, 246, 0.4)",
                      }}
                    >
                      <span style={{ fontSize: 16 }}>+</span> ADD MCQ QUESTION
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setPdfStage("idle");
                        setPdfDraftQuestions([]);
                        setPdfModalOpen(true);
                      }}
                      style={{
                        padding: "9px 16px",
                        borderRadius: 10,
                        background: "rgba(56, 189, 248, 0.16)",
                        border: "1px solid #38bdf8",
                        color: "#38bdf8",
                        fontWeight: 800,
                        fontSize: 13,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <span style={{ fontSize: 16 }}>↑</span> UPLOAD MCQ PDF
                    </button>
                  </div>
                </div>

                {/* Search filter inside MCQ Card */}
                <div style={{ marginBottom: 12 }}>
                  <input
                    type="text"
                    placeholder="🔍 Search MCQ questions by title, topic, or option..."
                    value={mcqCardSearchQuery}
                    onChange={(e) => setMcqCardSearchQuery(e.target.value)}
                    style={{ ...S.adminInput, background: "#090d16", borderColor: "#334155", color: "#f8fafc", fontSize: 12, padding: "8px 14px" }}
                  />
                </div>

                {/* MCQ List Container */}
                {(() => {
                  const theoryMcqList = problemBank.filter((p) => {
                    const pType = p.type || (Array.isArray(p.options) && p.options.length ? "theory" : "coding");
                    return pType === "theory" || (Array.isArray(p.options) && p.options.length > 0) || p.acceptance === "Theory MCQ";
                  });

                  const filteredMcqs = theoryMcqList.filter((mcq) => {
                    if (!mcqCardSearchQuery.trim()) return true;
                    const q = mcqCardSearchQuery.toLowerCase();
                    const titleMatch = String(mcq.title || "").toLowerCase().includes(q);
                    const stmtMatch = String(mcq.statement || "").toLowerCase().includes(q);
                    const catMatch = String(getProblemCategory(mcq) || "").toLowerCase().includes(q);
                    const optMatch = Array.isArray(mcq.options) && mcq.options.some((o) => String(o).toLowerCase().includes(q));
                    return titleMatch || stmtMatch || catMatch || optMatch;
                  });

                  const selectedMcqCount = theoryMcqList.filter((mcq) => adminCreateForm.questions.includes(mcq.dbId || mcq.id)).length;

                  return (
                    <div>
                      <div style={{ maxHeight: 320, overflowY: "auto", display: "grid", gap: 10, paddingRight: 4 }}>
                        {filteredMcqs.length ? (
                          filteredMcqs.map((mcq) => {
                            const mcqKey = mcq.dbId || mcq.id;
                            const isIncludedInTest = adminCreateForm.questions.includes(mcqKey);
                            const optionsList = Array.isArray(mcq.options) ? mcq.options : [];

                            return (
                              <div
                                key={mcqKey}
                                style={{
                                  background: isIncludedInTest ? "rgba(139, 92, 246, 0.14)" : "#090d16",
                                  border: `1px solid ${isIncludedInTest ? "#8b5cf6" : "#1e293b"}`,
                                  borderRadius: 12,
                                  padding: "12px 14px",
                                  display: "grid",
                                  gap: 8,
                                }}
                              >
                                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", marginBottom: 4 }}>
                                      <span style={{ fontSize: 9, fontWeight: 900, background: "#8b5cf6", color: "#ffffff", padding: "2px 6px", borderRadius: 4 }}>
                                        TEST MCQ
                                      </span>
                                      <span style={{ fontSize: 11, color: "#cbd5e1", fontWeight: 700 }}>
                                        {getProblemCategory(mcq)} • {mcq.difficulty} • {mcq.marks || 2} pts
                                      </span>
                                    </div>
                                    <div style={{ color: "#f8fafc", fontWeight: 700, fontSize: 13, lineHeight: 1.4 }}>
                                      {mcq.title || mcq.statement}
                                    </div>
                                  </div>

                                  <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
                                    <button
                                      type="button"
                                      onClick={() => toggleCreateQuestion(mcqKey)}
                                      style={{
                                        padding: "5px 12px",
                                        borderRadius: 8,
                                        fontSize: 11,
                                        fontWeight: 800,
                                        border: "none",
                                        background: isIncludedInTest ? "#22c55e" : "#3b82f6",
                                        color: "#ffffff",
                                        cursor: "pointer",
                                        boxShadow: isIncludedInTest ? "0 2px 8px rgba(34, 197, 94, 0.3)" : "none",
                                      }}
                                    >
                                      {isIncludedInTest ? "✓ In Test" : "+ Add to Test"}
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => openEditMcqModal(mcq)}
                                      title="Edit MCQ"
                                      style={{ padding: "5px 9px", borderRadius: 8, fontSize: 12, border: "1px solid #475569", background: "transparent", color: "#cbd5e1", cursor: "pointer" }}
                                    >
                                      ✏️
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => setDeletingProblem(mcq)}
                                      title="Delete MCQ"
                                      style={{ padding: "5px 9px", borderRadius: 8, fontSize: 12, border: "1px solid rgba(239, 68, 68, 0.4)", background: "rgba(239, 68, 68, 0.1)", color: "#fca5a5", cursor: "pointer" }}
                                    >
                                      🗑
                                    </button>
                                  </div>
                                </div>

                                {/* Option List Details */}
                                {optionsList.length > 0 && (
                                  <div style={{ fontSize: 11, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 4, background: "rgba(15, 23, 42, 0.7)", padding: "8px 10px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.05)" }}>
                                    {optionsList.map((opt, oIdx) => {
                                      const isCorrect = String(opt).trim() === String(mcq.correctAnswer || "").trim();
                                      return (
                                        <div
                                          key={oIdx}
                                          style={{
                                            color: isCorrect ? "#4ade80" : "#94a3b8",
                                            fontWeight: isCorrect ? 800 : 400,
                                            whiteSpace: "nowrap",
                                            overflow: "hidden",
                                            textOverflow: "ellipsis",
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 4,
                                          }}
                                        >
                                          <span style={{ color: isCorrect ? "#4ade80" : "#64748b", fontWeight: 700 }}>
                                            {String.fromCharCode(65 + oIdx)}.
                                          </span>
                                          <span>{opt}</span>
                                          {isCorrect && <span style={{ color: "#4ade80", fontSize: 10, fontWeight: 900 }}>[CORRECT]</span>}
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          })
                        ) : (
                          <div style={{ color: "#94a3b8", fontSize: 12, textAlign: "center", padding: "20px", background: "#090d16", borderRadius: 12, border: "1px dashed #334155" }}>
                            No theory MCQ questions found. Use <strong>+ ADD MCQ QUESTION</strong> or <strong>↑ UPLOAD MCQ PDF</strong> above to add test MCQs.
                          </div>
                        )}
                      </div>

                      {/* Footer Summary */}
                      <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid #1e293b", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, color: "#cbd5e1" }}>
                        <span>Total Theory MCQs: <strong>{theoryMcqList.length}</strong></span>
                        <span>Selected for Test: <strong style={{ color: "#818cf8" }}>{selectedMcqCount}</strong></span>
                      </div>
                    </div>
                  );
                })()}
              </div>

              <div style={S.adminCard}>
                <div style={S.adminSectionTitle}>Create New Test</div>
                <div style={{ display:"grid", gap:14 }}>
                  <div>
                    <label style={S.adminFieldLabel}>Test Title</label>
                    <input value={adminCreateForm.title} onChange={(e)=>handleAdminCreateInput("title", e.target.value)} style={S.adminInput} />
                  </div>
                  <div style={{ display:"grid", gridTemplateColumns:isPhone ? compactGrid : "1fr 1fr", gap:12 }}>
                    <div>
                      <label style={S.adminFieldLabel}>Difficulty</label>
                      <select value={adminCreateForm.level} onChange={(e)=>handleAdminCreateInput("level", e.target.value)} style={S.adminInput}>
                        <option>Easy</option>
                        <option>Medium</option>
                        <option>Hard</option>
                      </select>
                    </div>
                    <div>
                      <label style={S.adminFieldLabel}>Duration (mins)</label>
                      <input value={adminCreateForm.duration} onChange={(e)=>handleAdminCreateInput("duration", e.target.value)} style={S.adminInput} />
                    </div>
                  </div>
                  <div>
                    <label style={S.adminFieldLabel}>Select & Reorder Assessment Questions (Theory + Coding)</label>

                    <div style={{ maxHeight:260, overflowY:"auto", display:"grid", gap:10, paddingRight:4 }}>
                      {problemBankLoading ? (
                        <div style={{ color:ADMIN_THEME.textSecondary, fontSize:13 }}>Loading database questions...</div>
                      ) : problemBank.length ? (
                        problemBank.map((problem) => {
                          const checked = adminCreateForm.questions.includes(problem.dbId);
                          const probType = problem.type || (Array.isArray(problem.options) && problem.options.length ? "theory" : "coding");
                          const isTheory = probType === "theory";
                          const selectedIdx = adminCreateForm.questions.indexOf(problem.dbId);

                          return (
                            <div key={problem.dbId} style={{ ...S.adminSubCard, display:"flex", gap:12, alignItems:"center", justifyContent:"space-between" }}>
                              <label style={{ display:"flex", gap:10, alignItems:"flex-start", cursor:"pointer", flex:1 }}>
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => toggleCreateQuestion(problem.dbId)}
                                  style={{ marginTop:3, accentColor:ADMIN_THEME.primary, cursor:"pointer" }}
                                />
                                <div style={{ display:"grid", gap:4 }}>
                                  <div style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" }}>
                                    <span
                                      style={{
                                        fontSize: 10,
                                        fontWeight: 800,
                                        padding: "1px 6px",
                                        borderRadius: 999,
                                        background: isTheory ? "rgba(139, 92, 246, 0.14)" : "rgba(37, 99, 235, 0.14)",
                                        color: isTheory ? "#8b5cf6" : "#2563eb",
                                        border: `1px solid ${isTheory ? "rgba(139, 92, 246, 0.3)" : "rgba(37, 99, 235, 0.3)"}`,
                                      }}
                                    >
                                      {isTheory ? "THEORY" : "CODING"}
                                    </span>
                                    {isTheory && (
                                      <span
                                        style={{
                                          fontSize: 9,
                                          fontWeight: 800,
                                          padding: "1px 5px",
                                          borderRadius: 999,
                                          background: "rgba(236, 72, 153, 0.14)",
                                          color: "#ec4899",
                                          border: "1px solid rgba(236, 72, 153, 0.3)",
                                        }}
                                      >
                                        CUSTOM
                                      </span>
                                    )}
                                    <span style={{ color:ADMIN_THEME.text, fontWeight:700 }}>{problem.title}</span>
                                  </div>
                                  <div style={{ color:ADMIN_THEME.textSecondary, fontSize:12 }}>
                                    {getProblemCategory(problem)} | {problem.difficulty} | {problem.marks || (isTheory ? 2 : 10)} marks
                                  </div>
                                </div>
                              </label>

                              <div style={{ display:"flex", gap:6, alignItems:"center" }}>
                                {isTheory && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        openEditMcqModal(problem);
                                      }}
                                      style={{
                                        padding: "3px 8px",
                                        fontSize: 11,
                                        borderRadius: 6,
                                        border: "1px solid #8b5cf6",
                                        background: "rgba(139, 92, 246, 0.1)",
                                        color: "#8b5cf6",
                                        fontWeight: 700,
                                        cursor: "pointer",
                                      }}
                                    >
                                      ✏️ Edit
                                    </button>
                                    {checked && (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setAdminCreateForm((prev) => ({
                                            ...prev,
                                            questions: prev.questions.filter((id) => id !== problem.dbId && id !== problem.id),
                                          }));
                                        }}
                                        style={{
                                          padding: "3px 8px",
                                          fontSize: 11,
                                          borderRadius: 6,
                                          border: "1px solid #ef4444",
                                          background: "rgba(239, 68, 68, 0.1)",
                                          color: "#ef4444",
                                          fontWeight: 700,
                                          cursor: "pointer",
                                        }}
                                      >
                                        🗑 Remove
                                      </button>
                                    )}
                                  </>
                                )}

                                {checked && (
                                  <>
                                    <span style={{ fontSize:11, fontWeight:700, color:ADMIN_THEME.primary, background:"#dbeafe", padding:"2px 8px", borderRadius:999 }}>
                                      Q{selectedIdx + 1}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (selectedIdx > 0) {
                                          const nextQ = [...adminCreateForm.questions];
                                          const tmp = nextQ[selectedIdx];
                                          nextQ[selectedIdx] = nextQ[selectedIdx - 1];
                                          nextQ[selectedIdx - 1] = tmp;
                                          setAdminCreateForm((prev) => ({ ...prev, questions: nextQ }));
                                        }
                                      }}
                                      disabled={selectedIdx === 0}
                                      style={{ padding:"2px 6px", fontSize:11, borderRadius:4, border:"1px solid #cbd5e1", background:"#ffffff", cursor:selectedIdx===0?"not-allowed":"pointer", opacity:selectedIdx===0?0.4:1 }}
                                    >
                                      ▲
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (selectedIdx < adminCreateForm.questions.length - 1) {
                                          const nextQ = [...adminCreateForm.questions];
                                          const tmp = nextQ[selectedIdx];
                                          nextQ[selectedIdx] = nextQ[selectedIdx + 1];
                                          nextQ[selectedIdx + 1] = tmp;
                                          setAdminCreateForm((prev) => ({ ...prev, questions: nextQ }));
                                        }
                                      }}
                                      disabled={selectedIdx === adminCreateForm.questions.length - 1}
                                      style={{ padding:"2px 6px", fontSize:11, borderRadius:4, border:"1px solid #cbd5e1", background:"#ffffff", cursor:selectedIdx===adminCreateForm.questions.length - 1?"not-allowed":"pointer", opacity:selectedIdx===adminCreateForm.questions.length - 1?0.4:1 }}
                                    >
                                      ▼
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div style={{ color:ADMIN_THEME.textSecondary, fontSize:13 }}>No database problems yet. Use Sync Problems or upload a question.</div>
                      )}
                    </div>

                    {(view === "admin" || String(currentUser?.role || "").toLowerCase() === "admin" || String(userRole || "").toLowerCase() === "admin") && (
                      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginTop: 10, marginBottom: 12 }}>
                        <button
                          type="button"
                          onClick={openCreateMcqModal}
                          style={{
                            flex: 1,
                            padding: "10px 16px",
                            borderRadius: 12,
                            background: "linear-gradient(135deg, rgba(139, 92, 246, 0.16), rgba(99, 102, 241, 0.16))",
                            border: "1px dashed #8b5cf6",
                            color: "#8b5cf6",
                            fontWeight: 700,
                            fontSize: 13,
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 8,
                          }}
                        >
                          <span style={{ fontSize: 16, fontWeight: 900 }}>+</span> ADD MCQ QUESTION
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setPdfStage("idle");
                            setPdfDraftQuestions([]);
                            setPdfModalOpen(true);
                          }}
                          style={{
                            flex: 1,
                            padding: "10px 16px",
                            borderRadius: 12,
                            background: "rgba(56, 189, 248, 0.12)",
                            border: "1px dashed #38bdf8",
                            color: "#38bdf8",
                            fontWeight: 700,
                            fontSize: 13,
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 8,
                          }}
                        >
                          <span style={{ fontSize: 16, fontWeight: 900 }}>↑</span> UPLOAD MCQ PDF
                        </button>
                      </div>
                    )}
                  </div>

                  {(() => {
                    const selProbs = adminCreateForm.questions
                      .map((qId) => problemBank.find((p) => p.dbId === qId || p.id === qId))
                      .filter(Boolean);
                    const theoryCount = selProbs.filter((p) => (p.type || (Array.isArray(p.options) && p.options.length ? "theory" : "coding")) === "theory").length;
                    const codingCount = selProbs.length - theoryCount;
                    const totalMarks = selProbs.reduce((sum, p) => sum + (p.marks || (p.type === "theory" ? 2 : 10)), 0);

                    return (
                      <div style={{ background:"#f1f5f9", border:"1px solid #cbd5e1", borderRadius:12, padding:"12px 14px", fontSize:12, color:"#334155" }}>
                        <div style={{ fontWeight:700, color:"#0f172a", marginBottom:4 }}>
                          Selected: {selProbs.length} Questions ({theoryCount} Theory, {codingCount} Coding)
                        </div>
                        <div>Total Assessment Marks: <strong>{totalMarks} pts</strong></div>
                      </div>
                    );
                  })()}

                  <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
                    <button
                      onClick={handleCreateTest}
                      disabled={adminCreatingTest}
                      style={{ ...S.adminButton("submit"), flex:1, opacity: adminCreatingTest ? 0.65 : 1, cursor: adminCreatingTest ? "not-allowed" : "pointer" }}
                    >
                      {adminCreatingTest ? "Saving..." : "Save Draft Test"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setAdminPreviewOpen(true)}
                      style={{ ...S.adminButton("default"), flex:1, borderColor:"#8b5cf6", color:"#8b5cf6", fontWeight:700 }}
                    >
                      👁 Preview Assessment
                    </button>
                  </div>
                </div>
              </div>

              {solutionsVisible && (
                <div style={S.adminCard}>
                  <div style={S.adminSectionTitle}>Submitted Solutions</div>
                  <div style={{ display:"grid", gap:10 }}>
                    {adminCurrentTest.questions.map((id) => {
                      const problem = adminCurrentTest.problems?.find((item) => item.id === id)
                        || problemCatalog.find((item) => item.id === id);
                      return (
                        <div key={id} style={S.adminSubCard}>
                          <div style={{ color:ADMIN_THEME.text, fontWeight:700, marginBottom:4 }}>{problem?.title || `Problem ${id}`}</div>
                          <div style={{ color:ADMIN_THEME.textSecondary, fontSize:12 }}>Top submission visible after test completion. Connect secure storage/backend to load real submitted code.</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
              </div>
            </div>

              <div style={{ flex: "1 1 240px", maxWidth: 280, minWidth: 220 }}>
                {renderRightActivityPanel()}
              </div>
            </div>
          )}

          {adminTab === "questions" && renderQuestionUploads()}
          {adminTab === "reports" && renderAdminReports()}
          {adminTab === "malpractice" && renderAdminMalpracticeReports()}
          {adminTab === "leaderboard" && renderAdminLeaderboard()}
          {adminTab === "students" && renderStudentList()}
          {adminTab === "profile" && renderAdminProfile()}
        </div>
      </div>
    </div>
  );

  // ── PROBLEM LIST ───────────────────────────────────────────────────────────
  if (view === "list") return (
    <div style={{ position: "relative" }} onContextMenu={(e) => e.preventDefault()}>
      <ScreenShield active={screenShield} message={shieldMessage} />
      {renderLiveTestPopupModal()}
      <div style={{ ...S.app, opacity: screenShield ? 0 : 1, pointerEvents: screenShield ? "none" : "auto", transition: "opacity 0.12s ease", userSelect: screenShield ? "none" : "auto" }}>
      <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,700&family=Outfit:wght@400;500;600;700&family=Space+Grotesk:wght@400;600;800&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet" />
      <nav style={S.nav}>
        <DevOrbitLogo onClick={()=>setView("home")} />
        <button onClick={()=>setView("list")} style={S.navBtn(true)}>
          <span style={S.navBtnLabel(true)}>Problems</span>
          <span style={S.navBtnHint(true)}>Daily coding practice</span>
        </button>
        <button onClick={openContest} style={S.navBtn(false)}>
          <span style={S.navBtnLabel(false)}>Contest</span>
          <span style={S.navBtnHint(false)}>Timed challenge rounds</span>
        </button>
        <button onClick={()=>openLeaderboard("All")} style={S.navBtn(false)}>
          <span style={S.navBtnLabel(false)}>Leaderboard</span>
          <span style={S.navBtnHint(false)}>See the top performers</span>
        </button>
        <div style={{ marginLeft:"auto", display:"flex", gap:12, alignItems:"center" }}>
          {notificationCount > 0 && (
            <span style={{ padding:"6px 10px", borderRadius:999, background:"#111b22", border:"1px solid #1d4f5d", color:"#7ce7ff", fontSize:12, fontWeight:700 }}>
              {notificationCount} new
            </span>
          )}
          <span style={{ color:"#7c6af7", fontSize:13 }}>🏆 {solved.size} solved</span>
          {currentAchievement && <AchievementBadge tier={currentUser.badgeTier} compact />}
          <div onClick={openProfile} style={{ width:32, height:32, borderRadius:"50%", background:"linear-gradient(135deg,#7c6af7,#4fd1c5)", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:700, cursor:"pointer" }}>{userBadge}</div>
        </div>
      </nav>

      <div style={{ maxWidth:1100, margin:isPhone ? "20px auto" : "32px auto", padding:`0 ${pageGutter}px`, width:"100%", boxSizing:"border-box" }}>
        {latestUnreadNotification && (
          <div style={{ background:"#101926", border:"1px solid #243c5a", borderRadius:16, padding:"16px 18px", marginBottom:18, display:"flex", justifyContent:"space-between", gap:16, alignItems:"center", flexWrap:"wrap" }}>
            <div>
              <div style={{ color:"#93c5fd", fontSize:12, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:6 }}>
                Student Notification
              </div>
              <div style={{ color:"#eef0ff", fontWeight:700, marginBottom:6 }}>{latestUnreadNotification.title}</div>
              <div style={{ color:"#9fb4ff", fontSize:13 }}>{latestUnreadNotification.message}</div>
            </div>
            {!latestUnreadNotification.read && (
              <button onClick={() => markNotificationAsRead(latestUnreadNotification.id)} style={{ ...S.btn("default"), color:"#dfe2ff" }}>
                Mark Read
              </button>
            )}
          </div>
        )}

        {portalError && (
          <div style={{ background:"#180b0b", border:"1px solid #4b1717", color:"#ffb0b0", borderRadius:14, padding:"12px 14px", fontSize:13, marginBottom:18 }}>
            {portalError}
          </div>
        )}

        {/* Stats */}
        <div style={{ display:"grid", gridTemplateColumns:`repeat(auto-fit, minmax(${isPhone ? 150 : 220}px, 1fr))`, gap:16, marginBottom:32 }}>
          {[{label:"Easy",color:"#00b8a3"},{label:"Medium",color:"#ffc01e"},{label:"Hard",color:"#ff375f"}].map(s=>(
            <div key={s.label} style={{ background:"#111118", border:"1px solid #1e1e2e", borderRadius:12, padding:"16px 20px", display:"flex", alignItems:"center", gap:12 }}>
              <div style={{ width:8, height:32, borderRadius:4, background:s.color }} />
              <div>
                <div style={{ fontSize:22, fontWeight:700, color:s.color }}>{problemCatalog.filter(p=>p.difficulty===s.label).length}</div>
                <div style={{ fontSize:12, color:"#666" }}>{s.label} Problems</div>
              </div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div style={{ display:"flex", gap:12, marginBottom:14, alignItems:"center", flexWrap:"wrap" }}>
          <input placeholder="🔍  Search problems..." value={searchQuery} onChange={e=>setSearchQuery(e.target.value)}
            style={{ flex:1, minWidth:220, background:"#111118", border:"1px solid #1e1e2e", borderRadius:8, padding:"10px 14px", color:"#eef0ff", fontFamily:"'Outfit','Space Grotesk',sans-serif", fontSize:14, outline:"none", letterSpacing:"0.01em" }} />
          {["All","Easy","Medium","Hard"].map(d=>(
            <button key={d} onClick={()=>setFilterDiff(d)} style={{ ...S.btn("default"), background:filterDiff===d?"#1a1a2e":"transparent", color:filterDiff===d?"#7c6af7":"#666", border:filterDiff===d?"1px solid #7c6af7":"1px solid #1e1e2e" }}>{d}</button>
          ))}
        </div>

        {/* Language Selection Control */}
        <div style={{ display:"flex", gap:12, marginBottom:20, alignItems:"center", flexWrap:"wrap" }}>
          <span style={{ color:"#7a7f9e", fontSize:12, fontWeight:700, letterSpacing:"0.12em", textTransform:"uppercase", fontFamily:"'Space Grotesk',sans-serif" }}>
            Language:
          </span>
          <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
            {SUPPORTED_LANGUAGES.map((l) => {
              const active = lang === l.id;
              return (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => handleLangChange(l.id)}
                  style={{
                    ...S.btn("default"),
                    padding: "8px 16px",
                    borderRadius: 8,
                    fontSize: 13,
                    fontFamily: "'Outfit','Space Grotesk',sans-serif",
                    fontWeight: active ? 700 : 500,
                    background: active ? "#1a1a2e" : "transparent",
                    color: active ? "#7c6af7" : "#666",
                    border: active ? "1px solid #7c6af7" : "1px solid #1e1e2e",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                  onMouseEnter={(e) => {
                    if (!active) {
                      e.currentTarget.style.borderColor = "#3a3a52";
                      e.currentTarget.style.color = "#cdd2ef";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!active) {
                      e.currentTarget.style.borderColor = "#1e1e2e";
                      e.currentTarget.style.color = "#666";
                    }
                  }}
                >
                  {l.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Table */}
        <div style={{ background:"#111118", border:"1px solid #1e1e2e", borderRadius:12, overflowX:"auto" }}>
          <table style={{ width:"100%", minWidth:isPhone ? 720 : "100%", borderCollapse:"collapse" }}>
            <thead>
              <tr style={{ borderBottom:"1px solid #1e1e2e" }}>
                {["Status","#","Title","Tags","Difficulty","Acceptance"].map(h=>(
                  <th key={h} style={S.tableHead}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredProblems.map(p=>(
                <tr key={p.id} onClick={()=>openProblem(p, "catalog")} style={{ borderBottom:"1px solid #0f0f1a", cursor:"pointer" }}
                  onMouseEnter={e=>e.currentTarget.style.background="#16161f"}
                  onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                  <td style={{ padding:"14px 16px", width:60 }}>{solved.has(p.id)?<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" fill="#00b8a3" fillOpacity="0.15"/><path d="M5 8l2 2 4-4" stroke="#00b8a3" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>:<span style={{ color:"#333", fontSize:12 }}>—</span>}</td>
                  <td style={{ padding:"14px 16px", color:"#444", fontSize:13 }}>{p.id}</td>
                  <td style={{ padding:"14px 16px" }}><span style={S.tableTitle}>{p.title}</span></td>
                  <td style={{ padding:"14px 16px" }}><div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>{p.tags.slice(0,2).map(t=><span key={t} style={S.tag}>{t}</span>)}</div></td>
                  <td style={{ padding:"14px 16px" }}><span style={S.badge(p.difficulty)}>{p.difficulty}</span></td>
                  <td style={{ padding:"14px 16px", color:"#555", fontSize:13 }}>{p.acceptance}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      </div>
    </div>
  );

  if (view === "profile") return (
    <div style={{ position: "relative" }} onContextMenu={(e) => e.preventDefault()}>
      <ScreenShield active={screenShield} message={shieldMessage} />
      {renderLiveTestPopupModal()}
      <div style={{ ...S.app, background:"#0f172a", color:"#e2e8f0", fontFamily:"'Poppins','Inter','Outfit',sans-serif", opacity: screenShield ? 0 : 1, pointerEvents: screenShield ? "none" : "auto", transition: "opacity 0.12s ease", userSelect: screenShield ? "none" : "auto" }}>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Poppins:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
        <nav style={{ ...S.nav, background:"#0b1220", borderBottom:"1px solid #1e293b" }}>
          <DevOrbitLogo onClick={()=>setView("home")} />
          <button onClick={()=>setView("list")} style={S.navBtn(false)}>
            <span style={S.navBtnLabel(false)}>Problems</span>
            <span style={S.navBtnHint(false)}>Practice arena</span>
          </button>
          <button onClick={openContest} style={S.navBtn(false)}>
            <span style={S.navBtnLabel(false)}>Contest</span>
            <span style={S.navBtnHint(false)}>Live round hub</span>
          </button>
          <button onClick={()=>openLeaderboard("All")} style={S.navBtn(false)}>
            <span style={S.navBtnLabel(false)}>Leaderboard</span>
            <span style={S.navBtnHint(false)}>Ranking board</span>
          </button>
          <button style={S.navBtn(true)}>
            <span style={S.navBtnLabel(true)}>Profile</span>
            <span style={S.navBtnHint(true)}>Dashboard overview</span>
          </button>
          <div style={{ marginLeft:"auto", display:"flex", gap:12, alignItems:"center" }}>
            {notificationCount > 0 && (
              <span style={{ padding:"6px 10px", borderRadius:999, background:"#111b22", border:"1px solid #1d4f5d", color:"#7ce7ff", fontSize:12, fontWeight:700 }}>
                {notificationCount} new
              </span>
            )}
            <div style={{ width:34, height:34, borderRadius:"50%", background:`linear-gradient(135deg, ${profileAvatarGradient[0]}, ${profileAvatarGradient[1]})`, display:"flex", alignItems:"center", justifyContent:"center", fontWeight:800, color:"#081018", boxShadow:"0 0 18px rgba(96,165,250,0.28)" }}>{profileAvatarLabel}</div>
            <button onClick={signOut} style={{ padding:"6px 12px", borderRadius:10, background:"#ef44441f", border:"1px solid #ef44444d", color:"#f87171", fontWeight:700, fontSize:12, cursor:"pointer" }}>
              Sign Out
            </button>
          </div>
        </nav>

        <div style={{ maxWidth:1260, margin:"28px auto 40px", padding:`0 ${pageGutter}px`, width:"100%", boxSizing:"border-box", display:"grid", gap:20 }}>
          <div onMouseEnter={liftCard} onMouseLeave={settleCard} style={{ background:"linear-gradient(135deg, rgba(15,23,42,0.98), rgba(30,41,59,0.92))", border:"1px solid #1e293b", borderRadius:28, padding:"28px", boxShadow:"0 14px 34px rgba(15, 23, 42, 0.32)", transition:"transform 0.2s ease, boxShadow 0.2s ease" }}>
            <div style={{ display:"flex", justifyContent:"space-between", gap:20, alignItems:"flex-start", flexWrap:"wrap" }}>
              <div style={{ display:"flex", gap:18, alignItems:"center", flexWrap:"wrap" }}>
                <div style={{ width:92, height:92, borderRadius:"50%", background:`linear-gradient(135deg, ${profileAvatarGradient[0]}, ${profileAvatarGradient[1]})`, display:"flex", alignItems:"center", justifyContent:"center", color:"#081018", fontWeight:800, fontSize:28, boxShadow:"0 0 28px rgba(96,165,250,0.25)" }}>
                  {profileAvatarLabel}
                </div>
                <div>
                  <div style={{ color:"#f8fafc", fontSize:32, fontWeight:700, lineHeight:1.1 }}>{profileName}</div>
                  <div style={{ color:"#93c5fd", fontSize:15, fontWeight:600, marginTop:6 }}>{currentUser.email || "--"}</div>
                  <div style={{ color:"#94a3b8", fontSize:14, maxWidth:620, marginTop:10, lineHeight:1.7 }}>
                    {[
                      currentUser.department || null,
                      currentUser.role ? formatDisplayName(currentUser.role) : null,
                    ].filter(Boolean).join(" | ") || "Personal details will appear here once your account data is available."}
                  </div>
                  <div style={{ display:"flex", gap:10, flexWrap:"wrap", marginTop:14 }}>
                    <span style={{ padding:"8px 12px", borderRadius:999, background:"#111c34", border:"1px solid #1d4ed8", color:"#93c5fd", fontSize:12, fontWeight:700 }}>
                      {currentUser.verified ? "Verified Account" : "Unverified Account"}
                    </span>
                    <span style={{ padding:"8px 12px", borderRadius:999, background:"#18112e", border:"1px solid #7c3aed", color:"#c4b5fd", fontSize:12, fontWeight:700 }}>
                      {currentUser.role ? formatDisplayName(currentUser.role) : "User"}
                    </span>
                    {currentAchievement ? (
                      <AchievementBadge tier={currentUser.badgeTier} />
                    ) : (
                      <span style={{ padding:"8px 12px", borderRadius:999, background:"#111827", border:"1px solid #334155", color:"#cbd5e1", fontSize:12, fontWeight:700 }}>
                        Next badge at 51 solved
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <button onClick={signOut} style={{ padding:"10px 18px", borderRadius:12, background:"#ef44441f", border:"1px solid #ef44444d", color:"#f87171", fontWeight:700, fontSize:13, cursor:"pointer" }}>
                🚪 Log Out
              </button>
            </div>
          </div>

          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(220px, 1fr))", gap:16 }}>
            {profileStats.map((stat) => (
              <div key={stat.label} onMouseEnter={liftCard} onMouseLeave={settleCard} style={{ background:"#0b1220", border:"1px solid #1e293b", borderRadius:22, padding:"18px 18px 20px", boxShadow:"0 14px 34px rgba(15, 23, 42, 0.32)", transition:"transform 0.2s ease, boxShadow 0.2s ease" }}>
                <div style={{ color:"#94a3b8", fontSize:12, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:10 }}>{stat.label}</div>
                <div style={{ color:stat.accent, fontSize:30, fontWeight:700, lineHeight:1 }}>{stat.value}</div>
              </div>
            ))}
          </div>

          <div style={{ display:"grid", gridTemplateColumns:`repeat(auto-fit, minmax(${isPhone ? 240 : 320}px, 1fr))`, gap:20, alignItems:"start" }}>
            <div style={{ display:"grid", gap:20 }}>
              <div onMouseEnter={liftCard} onMouseLeave={settleCard} style={{ background:"#0b1220", border:"1px solid #1e293b", borderRadius:24, padding:"22px", boxShadow:"0 14px 34px rgba(15, 23, 42, 0.32)", transition:"transform 0.2s ease, boxShadow 0.2s ease" }}>
                <div style={{ color:"#94a3b8", fontSize:12, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:8 }}>Personal Details</div>
                <div style={{ color:"#f8fafc", fontSize:24, fontWeight:700, marginBottom:18 }}>Account information</div>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(220px, 1fr))", gap:14 }}>
                  {profileDetails.map((item) => (
                    <div key={item.label} style={{ background:"#111827", border:"1px solid #1f2937", borderRadius:16, padding:"14px 16px" }}>
                      <div style={{ color:"#94a3b8", fontSize:11, fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:8 }}>{item.label}</div>
                      <div style={{ color:"#f8fafc", fontSize:15, fontWeight:600, wordBreak:"break-word" }}>{item.value || "--"}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(280px, 1fr))", gap:20 }}>
                <div onMouseEnter={liftCard} onMouseLeave={settleCard} style={{ background:"#0b1220", border:"1px solid #1e293b", borderRadius:24, padding:"22px", boxShadow:"0 14px 34px rgba(15, 23, 42, 0.32)", transition:"transform 0.2s ease, boxShadow 0.2s ease" }}>
                  <div style={{ color:"#94a3b8", fontSize:12, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:8 }}>Problem Breakdown</div>
                  <div style={{ color:"#f8fafc", fontSize:22, fontWeight:700, marginBottom:18 }}>Difficulty progress</div>
                  <div style={{ display:"grid", gap:14 }}>
                    {profileDifficultyBreakdown.map((item) => (
                      <div key={item.label}>
                        <div style={{ display:"flex", justifyContent:"space-between", color:"#cbd5e1", fontSize:14, marginBottom:8 }}>
                          <span>{item.label}</span>
                          <span>{item.value}</span>
                        </div>
                        <div style={{ height:10, borderRadius:999, background:"#111827", overflow:"hidden" }}>
                          <div style={{ width:`${(item.value / item.total) * 100}%`, height:"100%", borderRadius:999, background:item.color, boxShadow:`0 0 18px ${item.color}55`, transition:"width 0.35s ease" }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div onMouseEnter={liftCard} onMouseLeave={settleCard} style={{ background:"#0b1220", border:"1px solid #1e293b", borderRadius:24, padding:"22px", boxShadow:"0 14px 34px rgba(15, 23, 42, 0.32)", transition:"transform 0.2s ease, boxShadow 0.2s ease" }}>
                  <div style={{ color:"#94a3b8", fontSize:12, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:8 }}>Leaderboard Snapshot</div>
                  <div style={{ color:"#f8fafc", fontSize:22, fontWeight:700, marginBottom:18 }}>Live ranking data</div>
                  {profileEntry ? (
                    <div style={{ display:"grid", gap:12, color:"#cbd5e1", fontSize:14, lineHeight:1.7 }}>
                      <div>Contest rank: <span style={{ color:"#93c5fd", fontWeight:700 }}>#{profileEntry.contest.rank}</span></div>
                      <div>Contest score: <span style={{ color:"#67e8f9", fontWeight:700 }}>{profileEntry.contest.score}</span></div>
                      <div>Overall solved: <span style={{ color:"#22c55e", fontWeight:700 }}>{profileEntry.overall.problemsSolved}</span></div>
                      <div>Global rank: <span style={{ color:"#c4b5fd", fontWeight:700 }}>#{profileEntry.global.rank}</span></div>
                    </div>
                  ) : (
                    <div style={{ color:"#94a3b8", fontSize:14, lineHeight:1.7 }}>
                      No leaderboard data is available for your account yet.
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div style={{ display:"grid", gap:20 }}>
              <div onMouseEnter={liftCard} onMouseLeave={settleCard} style={{ background:"#0b1220", border:"1px solid #1e293b", borderRadius:24, padding:"22px", boxShadow:"0 14px 34px rgba(15, 23, 42, 0.32)", transition:"transform 0.2s ease, boxShadow 0.2s ease" }}>
                <div style={{ color:"#94a3b8", fontSize:12, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:8 }}>Account Summary</div>
                <div style={{ color:"#f8fafc", fontSize:22, fontWeight:700, marginBottom:14 }}>Personal overview</div>
                <div style={{ display:"grid", gap:10, color:"#cbd5e1", fontSize:14, lineHeight:1.7 }}>
                  <div>Name: <span style={{ color:"#f8fafc", fontWeight:700 }}>{profileName}</span></div>
                  <div>Email: <span style={{ color:"#93c5fd", fontWeight:700 }}>{currentUser.email || "--"}</span></div>
                  <div>Department: <span style={{ color:"#67e8f9", fontWeight:700 }}>{currentUser.department || "--"}</span></div>
                  <div>Badge: <span style={{ color:currentAchievement?.color || "#cbd5e1", fontWeight:700 }}>{currentUser.badgeLabel || "Not earned yet"}</span></div>
                  <div>Verified: <span style={{ color:currentUser.verified ? "#22c55e" : "#fbbf24", fontWeight:700 }}>{currentUser.verified ? "Yes" : "No"}</span></div>
                </div>
              </div>
            </div>
          </div>

          <div style={{ display:"grid", gridTemplateColumns:`repeat(auto-fit, minmax(${isPhone ? 240 : 360}px, 1fr))`, gap:20 }}>
            <div onMouseEnter={liftCard} onMouseLeave={settleCard} style={{ background:"#0b1220", border:"1px solid #1e293b", borderRadius:24, padding:"22px", boxShadow:"0 14px 34px rgba(15, 23, 42, 0.32)", transition:"transform 0.2s ease, boxShadow 0.2s ease" }}>
              <div style={{ color:"#94a3b8", fontSize:12, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:8 }}>Submission History</div>
              <div style={{ color:"#f8fafc", fontSize:22, fontWeight:700, marginBottom:16 }}>Recent runs</div>
              <table style={{ width:"100%", borderCollapse:"collapse" }}>
                <thead>
                  <tr>
                    {["Problem Name", "Status", "Language", "Time"].map((heading) => (
                      <th key={heading} style={{ textAlign:"left", padding:"0 0 12px", color:"#64748b", fontSize:11, textTransform:"uppercase", letterSpacing:"0.1em" }}>{heading}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {profileSubmissionHistory.length ? profileSubmissionHistory.map((row) => (
                    <tr key={`${row.problemId}-${row.time}`} style={{ borderTop:"1px solid #172033" }}>
                      <td style={{ padding:"12px 0" }}>
                        <button onClick={() => openProblem(problemCatalog.find((problem) => sameValue(problem.dbId, row.problemDbId) || sameValue(problem.id, row.problemId)) || problemCatalog[0], "catalog")} style={{ background:"none", border:"none", padding:0, color:"#93c5fd", cursor:"pointer", fontWeight:600, textAlign:"left" }}>
                          {row.problemName}
                        </button>
                      </td>
                      <td style={{ padding:"12px 0", color:row.status === "Accepted" ? "#22c55e" : row.status === "Wrong Answer" ? "#f87171" : "#fbbf24", fontWeight:600 }}>{row.status}</td>
                      <td style={{ padding:"12px 0", color:"#cbd5e1" }}>{row.language}</td>
                      <td style={{ padding:"12px 0", color:"#94a3b8" }}>{row.time}</td>
                    </tr>
                  )) : (
                    <tr style={{ borderTop:"1px solid #172033" }}>
                      <td colSpan="4" style={{ padding:"14px 0", color:"#94a3b8" }}>No submission history available yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div onMouseEnter={liftCard} onMouseLeave={settleCard} style={{ background:"#0b1220", border:"1px solid #1e293b", borderRadius:24, padding:"22px", boxShadow:"0 14px 34px rgba(15, 23, 42, 0.32)", transition:"transform 0.2s ease, boxShadow 0.2s ease" }}>
              <div style={{ color:"#94a3b8", fontSize:12, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:8 }}>Contest History</div>
              <div style={{ color:"#f8fafc", fontSize:22, fontWeight:700, marginBottom:16 }}>Recent rounds</div>
              <table style={{ width:"100%", borderCollapse:"collapse" }}>
                <thead>
                  <tr>
                    {["Contest Name", "Rank", "Score", "Rating"].map((heading) => (
                      <th key={heading} style={{ textAlign:"left", padding:"0 0 12px", color:"#64748b", fontSize:11, textTransform:"uppercase", letterSpacing:"0.1em" }}>{heading}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {profileContestHistory.length ? profileContestHistory.map((row) => (
                    <tr key={row.name} style={{ borderTop:"1px solid #172033" }}>
                      <td style={{ padding:"12px 0", color:"#e2e8f0", fontWeight:600 }}>{row.name}</td>
                      <td style={{ padding:"12px 0", color:"#93c5fd" }}>{row.rank}</td>
                      <td style={{ padding:"12px 0", color:"#cbd5e1" }}>{row.score}</td>
                      <td style={{ padding:"12px 0", color:"#22c55e", fontWeight:700 }}>{row.rating}</td>
                    </tr>
                  )) : (
                    <tr style={{ borderTop:"1px solid #172033" }}>
                      <td colSpan="4" style={{ padding:"14px 0", color:"#94a3b8" }}>No contest history available for your account yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div onMouseEnter={liftCard} onMouseLeave={settleCard} style={{ background:"#0b1220", border:"1px solid #1e293b", borderRadius:24, padding:"22px", display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:16, boxShadow:"0 14px 34px rgba(15, 23, 42, 0.32)", transition:"transform 0.2s ease, boxShadow 0.2s ease" }}>
            <div>
              <div style={{ color:"#f8fafc", fontSize:18, fontWeight:700 }}>Account Session</div>
              <div style={{ color:"#94a3b8", fontSize:14, marginTop:4 }}>Log out of your student account session on this device.</div>
            </div>
            <button onClick={signOut} style={{ padding:"10px 22px", borderRadius:12, background:"#ef44441f", border:"1px solid #ef44444d", color:"#f87171", fontWeight:700, fontSize:14, cursor:"pointer", transition:"all 0.2s ease" }} onMouseEnter={e => e.currentTarget.style.background="#ef444433"} onMouseLeave={e => e.currentTarget.style.background="#ef44441f"}>
              🚪 Log Out

            </button>
          </div>
        </div>
      </div>
    </div>
  );

  if (view === "contest") return (
    <div style={{ position: "relative" }} onContextMenu={(e) => e.preventDefault()}>
      <ScreenShield active={screenShield} message={shieldMessage} />
      <div style={{ ...S.app, opacity: screenShield ? 0 : 1, pointerEvents: screenShield ? "none" : "auto", transition: "opacity 0.12s ease", userSelect: screenShield ? "none" : "auto" }}>
        <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,700&family=Outfit:wght@400;500;600;700&family=Space+Grotesk:wght@400;600;800&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet" />
        {contestInstructionsOpen && (
          <div style={S.modalBackdrop}>
            <div style={{ ...S.modalCard, width:"min(680px, 100%)" }}>
              <div style={{ color:"#7a7f9e", fontSize:12, fontWeight:700, letterSpacing:"0.14em", textTransform:"uppercase", fontFamily:"'Space Grotesk',sans-serif", marginBottom:10 }}>Test Instructions</div>
              <h2 style={{ margin:"0 0 12px", color:"#f5f6ff", fontSize:30, lineHeight:1.1 }}>{contestDisplayName}</h2>
              <div style={{ color:"#a9aed0", fontSize:14, lineHeight:1.8, marginBottom:18 }}>
                The test will open in fullscreen. Leaving fullscreen, switching tabs/windows, pressing restricted keys such as Esc/F11/Windows, or returning back from the test screen will end the test and show your result.
              </div>
              <div style={{ display:"grid", gap:10, background:"#0f131c", border:"1px solid #24283a", borderRadius:16, padding:"14px 16px", color:"#d9dcf7", fontSize:14, lineHeight:1.7, marginBottom:16 }}>
                <div>Problems: <strong>{contestProblems.length}</strong></div>
                <div>Duration: <strong>{activeContestAssignment?.duration || adminCurrentTest.duration} minutes</strong></div>
                <div>Camera: <strong>required before the test starts</strong></div>
                <div>Final question: use <strong>Final Submit</strong> and confirm before ending the test.</div>
                <div>Result: accepted, rejected, and not-attempted problems will be shown with your score.</div>
              </div>
              <div style={{
                background:contestCameraStatus === "granted" ? "#0d1813" : contestCameraError ? "#190d10" : "#10131d",
                border:contestCameraStatus === "granted" ? "1px solid #1f6f45" : contestCameraError ? "1px solid #6b1f2a" : "1px solid #24283a",
                color:contestCameraStatus === "granted" ? "#86efac" : contestCameraError ? "#fda4af" : "#a9aed0",
                borderRadius:14,
                padding:"12px 14px",
                fontSize:13,
                lineHeight:1.6,
                marginBottom:16,
              }}>
                {contestCameraStatus === "granted"
                  ? "Camera permission granted. The camera will stay active during the test."
                  : contestCameraStatus === "requesting"
                    ? "Requesting camera permission..."
                    : contestCameraError || "When you click Start Test, the browser will ask for camera permission."}
              </div>
              <label style={{ display:"flex", gap:10, alignItems:"flex-start", color:"#cdd2ef", fontSize:14, lineHeight:1.6, marginBottom:20, cursor:"pointer" }}>
                <input type="checkbox" checked={contestInstructionsAccepted} onChange={(e)=>setContestInstructionsAccepted(e.target.checked)} style={{ marginTop:4 }} />
                <span>I have read the instructions and understand that leaving the test window will end my test.</span>
              </label>
              <div style={{ display:"flex", justifyContent:"flex-end", gap:10, flexWrap:"wrap" }}>
                <button onClick={closeContestInstructions} style={S.btn("default")}>Cancel</button>
                <button
                  onClick={startContestAfterInstructions}
                  disabled={!contestInstructionsAccepted || contestCameraStatus === "requesting"}
                  style={{ ...S.btn("submit"), opacity:contestInstructionsAccepted && contestCameraStatus !== "requesting" ? 1 : 0.5, cursor:contestInstructionsAccepted && contestCameraStatus !== "requesting" ? "pointer" : "not-allowed" }}
                >
                  {contestCameraStatus === "requesting" ? "Requesting Camera..." : "Start Test"}
                </button>
              </div>
            </div>
          </div>
        )}
        <nav style={S.nav}>
          <DevOrbitLogo onClick={()=>setView("home")} />
          <button onClick={()=>setView("list")} style={S.navBtn(false)}>
            <span style={S.navBtnLabel(false)}>Problems</span>
            <span style={S.navBtnHint(false)}>Daily coding practice</span>
          </button>
          <button onClick={openContest} style={S.navBtn(true)}>
            <span style={S.navBtnLabel(true)}>Contest</span>
            <span style={S.navBtnHint(true)}>Timed challenge rounds</span>
          </button>
          <button onClick={()=>openLeaderboard("All")} style={S.navBtn(false)}>
            <span style={S.navBtnLabel(false)}>Leaderboard</span>
            <span style={S.navBtnHint(false)}>See the top performers</span>
          </button>
          <div style={{ marginLeft:"auto", display:"flex", gap:12, alignItems:"center" }}>
            <span style={{ color:"#7c6af7", fontSize:13 }}>🏆 {solved.size} solved</span>
            {currentAchievement && <AchievementBadge tier={currentUser.badgeTier} compact />}
            <div onClick={openProfile} style={{ width:32, height:32, borderRadius:"50%", background:"linear-gradient(135deg,#7c6af7,#4fd1c5)", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:700, cursor:"pointer" }}>{userBadge}</div>
          </div>
        </nav>

        <div style={{ maxWidth:1180, margin:"32px auto 40px", padding:`0 ${pageGutter}px`, width:"100%", boxSizing:"border-box", display:"grid", gap:20 }}>
          {latestUnreadNotification && (
            <div style={{ background:"#101926", border:"1px solid #243c5a", borderRadius:16, padding:"16px 18px", display:"flex", justifyContent:"space-between", gap:16, alignItems:"center", flexWrap:"wrap" }}>
              <div>
                <div style={{ color:"#93c5fd", fontSize:12, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:6 }}>
                  Student Notification
                </div>
                <div style={{ color:"#eef0ff", fontWeight:700, marginBottom:6 }}>{latestUnreadNotification.title}</div>
                <div style={{ color:"#9fb4ff", fontSize:13 }}>{latestUnreadNotification.message}</div>
              </div>
              {!latestUnreadNotification.read && (
                <button onClick={() => markNotificationAsRead(latestUnreadNotification.id)} style={{ ...S.btn("default"), color:"#dfe2ff" }}>
                  Mark Read
                </button>
              )}
            </div>
          )}

          {portalError && (
            <div style={{ background:"#180b0b", border:"1px solid #4b1717", color:"#ffb0b0", borderRadius:14, padding:"12px 14px", fontSize:13 }}>
              {portalError}
            </div>
          )}

          {activeContestOptions.length > 1 && (
            <div style={{ background:"#10131c", border:"1px solid #22283a", borderRadius:18, padding:"16px 18px", display:"grid", gap:12 }}>
              <div style={{ display:"flex", justifyContent:"space-between", gap:12, alignItems:"center", flexWrap:"wrap" }}>
                <div>
                  <div style={{ color:"#7a7f9e", fontSize:12, fontWeight:700, letterSpacing:"0.12em", textTransform:"uppercase", fontFamily:"'Space Grotesk',sans-serif", marginBottom:6 }}>Available Tests</div>
                  <div style={{ color:"#eef0ff", fontWeight:700 }}>Choose the live test you want to attempt.</div>
                </div>
                <span style={{ color:"#73f0b3", fontSize:13, fontWeight:700 }}>{activeContestOptions.length} live</span>
              </div>
              <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
                {activeContestOptions.map((assignment) => (
                  <button
                    key={assignment.id}
                    onClick={() => {
                      setActiveAssignment(assignment);
                      setAdminCurrentTest(assignment);
                      setContestEntered(false);
                      setContestSessionEndsAt(null);
                      setContestResult(null);
                    }}
                    style={{
                      ...S.btn(sameValue(activeContestAssignment?.id, assignment.id) ? "submit" : "default"),
                      minHeight:42,
                      color:sameValue(activeContestAssignment?.id, assignment.id) ? undefined : "#dfe2ff",
                    }}
                  >
                    {assignment.title}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div style={{ background:"radial-gradient(circle at top left, rgba(124,106,247,0.22), rgba(10,10,15,0.98) 50%)", border:"1px solid #25253b", borderRadius:24, padding:"28px 28px 30px", boxShadow:"0 24px 70px rgba(0,0,0,0.32)" }}>
            <div style={{ display:"flex", justifyContent:"space-between", gap:20, alignItems:"flex-start", flexWrap:"wrap" }}>
              <div style={{ maxWidth:720 }}>
                <div style={{ color:"#7a7f9e", fontSize:12, fontWeight:700, letterSpacing:"0.14em", textTransform:"uppercase", fontFamily:"'Space Grotesk',sans-serif", marginBottom:10 }}>Live Contest</div>
                <h1 style={{ margin:"0 0 12px", color:"#f5f6ff", fontFamily:"'Fraunces',serif", fontSize:42, lineHeight:1, letterSpacing:"-0.04em" }}>{contestDisplayName}</h1>
                <div style={{ color:"#a9aed0", fontSize:15, lineHeight:1.7, marginBottom:18 }}>
                  Solve the active round, keep your penalty low, and move fast through the curated set of contest problems.
                </div>
                <div style={{ display:"flex", gap:12, alignItems:"center", flexWrap:"wrap" }}>
                  <div style={{ padding:"10px 14px", borderRadius:14, background:"#0f131c", border:"1px solid #24283a" }}>
                    <div style={{ color:"#7780a1", fontSize:11, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:6 }}>{contestSessionEndsAt ? "Time Left" : "Duration"}</div>
                    <div style={{ color:"#eef0ff", fontSize:28, fontWeight:700, lineHeight:1 }}>{formatCountdown(contestTimerSeconds)}</div>
                  </div>
                  <div style={{ padding:"10px 14px", borderRadius:999, border:`1px solid ${contestStatusTone.border}`, background:contestStatusTone.background, color:contestStatusTone.color, fontSize:12, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", fontFamily:"'Space Grotesk',sans-serif" }}>
                    {contestStatus}
                  </div>
                </div>
              </div>

              <div style={{ display:"grid", gap:12, minWidth:"min(100%, 280px)" }}>
                <button
                  onClick={() => handleEnterContest(contestProblems[0])}
                  disabled={contestStatus === "Ended" || contestStatus === "Awaiting Start" || hasUsedContestAttempt}
                  style={{
                    ...S.btn("submit"),
                    minHeight:52,
                    minWidth:220,
                    fontSize:13,
                    opacity:contestStatus === "Ended" || contestStatus === "Awaiting Start" || hasUsedContestAttempt ? 0.55 : 1,
                    cursor:contestStatus === "Ended" || contestStatus === "Awaiting Start" || hasUsedContestAttempt ? "not-allowed" : "pointer",
                    boxShadow:"0 16px 30px rgba(124,106,247,0.28)",
                  }}
                >
                  {contestStatus === "Awaiting Start"
                    ? "Awaiting Admin Start"
                    : contestStatus === "Ended"
                      ? "Contest Ended"
                      : hasUsedContestAttempt
                        ? "Attempt Already Used"
                        : contestEntered
                          ? "Resume Test"
                          : "Start Test"}
                </button>
                <div style={{ background:"#10131c", border:"1px solid #22283a", borderRadius:18, padding:"16px 18px", color:"#a9aed0", fontSize:14, lineHeight:1.7 }}>
                  <div style={{ color:"#eef0ff", fontWeight:700, marginBottom:6 }}>Contest Snapshot</div>
                  <div>Problems: <span style={{ color:"#f5f6ff" }}>{contestProblems.length}</span></div>
                  <div>Participants: <span style={{ color:"#f5f6ff" }}>{participantsCount}</span></div>
                  <div>Duration: <span style={{ color:"#f5f6ff" }}>{activeContestAssignment?.duration || adminCurrentTest.duration} mins</span></div>
                </div>
              </div>
            </div>
          </div>

          <div style={{ display:"grid", gridTemplateColumns:`repeat(auto-fit, minmax(${isPhone ? 240 : 320}px, 1fr))`, gap:20, alignItems:"start" }}>
            <div style={{ background:"#111118", border:"1px solid #1e1e2e", borderRadius:22, overflow:"hidden", boxShadow:"0 18px 40px rgba(0,0,0,0.22)" }}>
              <div style={{ padding:"20px 22px 16px", borderBottom:"1px solid #1c1d2a" }}>
                <div style={{ color:"#7a7f9e", fontSize:12, fontWeight:700, letterSpacing:"0.12em", textTransform:"uppercase", fontFamily:"'Space Grotesk',sans-serif", marginBottom:8 }}>Problem List</div>
                <div style={{ color:"#f5f6ff", fontSize:24, fontWeight:700 }}>Contest Problems</div>
              </div>
              <div style={{ padding:"0 14px 14px" }}>
                <table style={{ width:"100%", borderCollapse:"separate", borderSpacing:"0 10px" }}>
                  <thead>
                    <tr>
                      {["Problem Name", "Difficulty", "Status", "Score"].map((heading) => (
                        <th key={heading} style={{ textAlign:"left", padding:"14px 16px 8px", fontSize:11, color:"#7a7f9e", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.12em", fontFamily:"'Space Grotesk',sans-serif" }}>
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {contestProblems.map((problem, index) => (
                      <tr
                        key={problem.id}
                        onClick={() => {
                          if (!contestEntered) {
                            handleEnterContest(problem);
                            return;
                          }
                          openProblem(problem, "contest");
                        }}
                        style={{ cursor:"pointer", transition:"transform 0.18s ease, filter 0.18s ease" }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = "scale(1.01)";
                          e.currentTarget.style.filter = "brightness(1.04)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = "scale(1)";
                          e.currentTarget.style.filter = "none";
                        }}
                      >
                        <td style={{ padding:"16px", background:index % 2 === 0 ? "#12141d" : "#0d0f16", borderTop:"1px solid #222538", borderBottom:"1px solid #222538", borderLeft:"1px solid #222538", borderRadius:"16px 0 0 16px" }}>
                          <div style={{ color:"#f5f6ff", fontWeight:700, marginBottom:4 }}>{problem.title}</div>
                          <div style={{ color:"#7f85a6", fontSize:12 }}>Problem #{problem.id}</div>
                        </td>
                        <td style={{ padding:"16px", background:index % 2 === 0 ? "#12141d" : "#0d0f16", borderTop:"1px solid #222538", borderBottom:"1px solid #222538" }}>
                          <span style={S.badge(problem.difficulty)}>{problem.difficulty}</span>
                        </td>
                        <td style={{ padding:"16px", background:index % 2 === 0 ? "#12141d" : "#0d0f16", borderTop:"1px solid #222538", borderBottom:"1px solid #222538" }}>
                          <span style={{ display:"inline-flex", alignItems:"center", gap:8, padding:"8px 10px", borderRadius:999, background:problem.contestStatusMeta.background, border:`1px solid ${problem.contestStatusMeta.border}`, color:problem.contestStatusMeta.color, fontSize:12, fontWeight:700 }}>
                            <span>{problem.contestStatusMeta.icon}</span>
                            <span>{problem.contestStatusMeta.label}</span>
                          </span>
                        </td>
                        <td style={{ padding:"16px", background:index % 2 === 0 ? "#12141d" : "#0d0f16", borderTop:"1px solid #222538", borderBottom:"1px solid #222538", borderRight:"1px solid #222538", borderRadius:"0 16px 16px 0", color:"#73f0b3", fontWeight:700, fontSize:16 }}>
                          {problem.contestScore}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{ display:"grid", gap:18 }}>
              <div style={{ background:"#111118", border:"1px solid #1e1e2e", borderRadius:22, padding:"20px 22px", boxShadow:"0 18px 40px rgba(0,0,0,0.22)" }}>
                <div style={{ color:"#7a7f9e", fontSize:12, fontWeight:700, letterSpacing:"0.12em", textTransform:"uppercase", fontFamily:"'Space Grotesk',sans-serif", marginBottom:10 }}>Round Status</div>
                <div style={{ display:"grid", gap:10, color:"#a9aed0", fontSize:14, lineHeight:1.7 }}>
                  <div>Contest Name: <span style={{ color:"#eef0ff", fontWeight:700 }}>{contestDisplayName}</span></div>
                  <div>{contestSessionEndsAt ? "Time Left" : "Duration"}: <span style={{ color:"#4fd1c5", fontWeight:700 }}>{formatCountdown(contestTimerSeconds)}</span></div>
                  <div>Status: <span style={{ color:contestStatusTone.color, fontWeight:700 }}>{contestStatus}</span></div>
                  <div>Joined: <span style={{ color:"#eef0ff", fontWeight:700 }}>{contestEntered ? "Yes" : "Not yet"}</span></div>
                </div>
              </div>

              <div style={{ background:"#111118", border:"1px solid #1e1e2e", borderRadius:22, padding:"20px 22px", boxShadow:"0 18px 40px rgba(0,0,0,0.22)" }}>
                <div style={{ color:"#7a7f9e", fontSize:12, fontWeight:700, letterSpacing:"0.12em", textTransform:"uppercase", fontFamily:"'Space Grotesk',sans-serif", marginBottom:10 }}>How Scoring Works</div>
                <div style={{ display:"grid", gap:10, color:"#a9aed0", fontSize:14, lineHeight:1.7 }}>
                  <div>Easy problems are quick confidence builders and keep your scoreboard moving.</div>
                  <div>Medium problems reward balanced speed and accuracy under pressure.</div>
                  <div>Hard problems swing the leaderboard fastest, but penalty matters.</div>
                </div>
              </div>

              <div style={{ background:"#111118", border:"1px solid #1e1e2e", borderRadius:22, padding:"20px 22px", boxShadow:"0 18px 40px rgba(0,0,0,0.22)" }}>
                <div style={{ color:"#7a7f9e", fontSize:12, fontWeight:700, letterSpacing:"0.12em", textTransform:"uppercase", fontFamily:"'Space Grotesk',sans-serif", marginBottom:10 }}>Progress</div>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(110px, 1fr))", gap:10 }}>
                  <div style={{ background:"#0f131c", border:"1px solid #24283a", borderRadius:16, padding:"14px 12px" }}>
                    <div style={{ color:"#73f0b3", fontSize:24, fontWeight:700 }}>{contestProblems.filter((problem) => problem.contestStatusMeta.label === "Solved").length}</div>
                    <div style={{ color:"#7f85a6", fontSize:12 }}>Solved</div>
                  </div>
                  <div style={{ background:"#0f131c", border:"1px solid #24283a", borderRadius:16, padding:"14px 12px" }}>
                    <div style={{ color:"#ff9b9b", fontSize:24, fontWeight:700 }}>{contestProblems.filter((problem) => problem.contestStatusMeta.label === "Attempted").length}</div>
                    <div style={{ color:"#7f85a6", fontSize:12 }}>Attempted</div>
                  </div>
                  <div style={{ background:"#0f131c", border:"1px solid #24283a", borderRadius:16, padding:"14px 12px" }}>
                    <div style={{ color:"#ffc86b", fontSize:24, fontWeight:700 }}>{contestProblems.filter((problem) => problem.contestStatusMeta.label === "Not Tried").length}</div>
                    <div style={{ color:"#7f85a6", fontSize:12 }}>Pending</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  if (view === "contestResult") {
    const result = contestResult || buildContestResult("Completed");
    const percentage = result.maxScore ? Math.round((result.score / result.maxScore) * 100) : 0;

    return (
      <div style={{ ...S.app, minHeight:"100vh" }}>
        <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,700&family=Outfit:wght@400;500;600;700&family=Space+Grotesk:wght@400;600;800&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet" />
        <nav style={S.nav}>
          <DevOrbitLogo onClick={()=>setView("home")} />
          <button onClick={()=>setView("list")} style={S.navBtn(false)}>
            <span style={S.navBtnLabel(false)}>Problems</span>
            <span style={S.navBtnHint(false)}>Daily coding practice</span>
          </button>
          <button onClick={openContest} style={S.navBtn(false)}>
            <span style={S.navBtnLabel(false)}>Contest</span>
            <span style={S.navBtnHint(false)}>Back to contest hub</span>
          </button>
          <button onClick={()=>openLeaderboard("This Contest")} style={S.navBtn(false)}>
            <span style={S.navBtnLabel(false)}>Leaderboard</span>
            <span style={S.navBtnHint(false)}>Compare scores</span>
          </button>
          <div style={{ marginLeft:"auto", display:"flex", gap:12, alignItems:"center" }}>
            <div onClick={openProfile} style={{ width:32, height:32, borderRadius:"50%", background:"linear-gradient(135deg,#7c6af7,#4fd1c5)", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:700, cursor:"pointer" }}>{userBadge}</div>
          </div>
        </nav>

        <div style={{ maxWidth:1100, margin:"34px auto 44px", padding:`0 ${pageGutter}px`, width:"100%", boxSizing:"border-box", display:"grid", gap:20 }}>
          <div style={{ background:"radial-gradient(circle at top left, rgba(79,209,197,0.18), rgba(10,10,15,0.98) 50%)", border:"1px solid #25253b", borderRadius:24, padding:"28px", boxShadow:"0 24px 70px rgba(0,0,0,0.32)" }}>
            <div style={{ color:"#7a7f9e", fontSize:12, fontWeight:700, letterSpacing:"0.14em", textTransform:"uppercase", marginBottom:10 }}>Test Result</div>
            <div style={{ display:"flex", justifyContent:"space-between", gap:20, flexWrap:"wrap", alignItems:"flex-end" }}>
              <div>
                <h1 style={{ margin:"0 0 10px", color:"#f5f6ff", fontSize:42, lineHeight:1 }}>{result.title}</h1>
                <div style={{ color:"#a9aed0", fontSize:14 }}>{result.reason} | {result.completedAt}</div>
              </div>
              <div style={{ textAlign:"right" }}>
                <div style={{ color:"#73f0b3", fontSize:44, fontWeight:800, lineHeight:1 }}>{result.score}/{result.maxScore}</div>
                <div style={{ color:"#8f93b4", fontSize:13, marginTop:6 }}>{percentage}% score</div>
              </div>
            </div>
          </div>

          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(180px, 1fr))", gap:14 }}>
            {[
              { label:"Accepted", value:result.accepted, color:"#73f0b3", border:"#1f4e3a", background:"#0e1b15" },
              { label:"Rejected", value:result.rejected, color:"#ff9b9b", border:"#5a262d", background:"#1b0f13" },
              { label:"Not Attempted", value:result.notAttempted, color:"#ffc86b", border:"#5d4722", background:"#191309" },
              { label:"Total Problems", value:result.total, color:"#93c5fd", border:"#2d4f7b", background:"#0f1727" },
            ].map((item) => (
              <div key={item.label} style={{ background:item.background, border:`1px solid ${item.border}`, borderRadius:16, padding:"18px 16px" }}>
                <div style={{ color:item.color, fontSize:30, fontWeight:800, lineHeight:1 }}>{item.value}</div>
                <div style={{ color:"#a9aed0", fontSize:12, marginTop:8 }}>{item.label}</div>
              </div>
            ))}
          </div>

          <div style={{ background:"#111118", border:"1px solid #1e1e2e", borderRadius:18, overflow:"hidden" }}>
            <table style={{ width:"100%", borderCollapse:"collapse" }}>
              <thead>
                <tr style={{ borderBottom:"1px solid #1e1e2e" }}>
                  {["Problem", "Difficulty", "Status", "Score"].map((heading) => (
                    <th key={heading} style={S.tableHead}>{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.rows.map((row) => {
                  const statusColor = row.status === "Accepted" ? "#73f0b3" : row.status === "Rejected" ? "#ff9b9b" : "#ffc86b";
                  return (
                    <tr key={row.id} style={{ borderBottom:"1px solid #0f0f1a" }}>
                      <td style={{ padding:"14px 16px", color:"#eef0ff", fontWeight:700 }}>{row.title}</td>
                      <td style={{ padding:"14px 16px" }}><span style={S.badge(row.difficulty)}>{row.difficulty}</span></td>
                      <td style={{ padding:"14px 16px", color:statusColor, fontWeight:700 }}>{row.status}</td>
                      <td style={{ padding:"14px 16px", color:"#d9dcf7", fontWeight:700 }}>{row.score}/{row.maxScore}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  if (view === "leaderboard") return (
    <div style={{ position: "relative" }} onContextMenu={(e) => e.preventDefault()}>
      <ScreenShield active={screenShield} message={shieldMessage} />
      {renderLiveTestPopupModal()}
      <div style={{ ...S.app, opacity: screenShield ? 0 : 1, pointerEvents: screenShield ? "none" : "auto", transition: "opacity 0.12s ease", userSelect: screenShield ? "none" : "auto" }}>
        <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,700&family=Outfit:wght@400;500;600;700&family=Space+Grotesk:wght@400;600;800&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet" />
        <nav style={S.nav}>
        <DevOrbitLogo onClick={()=>setView("home")} />
          <button onClick={()=>setView("list")} style={S.navBtn(false)}>
            <span style={S.navBtnLabel(false)}>Problems</span>
            <span style={S.navBtnHint(false)}>Daily coding practice</span>
          </button>
          <button onClick={openContest} style={S.navBtn(false)}>
            <span style={S.navBtnLabel(false)}>Contest</span>
            <span style={S.navBtnHint(false)}>Timed challenge rounds</span>
          </button>
          <button onClick={()=>openLeaderboard("All")} style={S.navBtn(true)}>
            <span style={S.navBtnLabel(true)}>Leaderboard</span>
            <span style={S.navBtnHint(true)}>See the top performers</span>
          </button>
          <div style={{ marginLeft:"auto", display:"flex", gap:12, alignItems:"center" }}>
            <div style={{ padding:"8px 12px", borderRadius:999, border:"1px solid #273246", background:leaderboardUpdating ? "#111b22" : "#12121a", color:leaderboardUpdating ? "#7ce7ff" : "#8f93b4", fontSize:12, fontWeight:700, letterSpacing:"0.06em", textTransform:"uppercase", fontFamily:"'Space Grotesk',sans-serif", transition:"all 0.25s ease" }}>
              <span style={{ display:"inline-block", width:8, height:8, borderRadius:"50%", background:leaderboardUpdating ? "#4fd1c5" : "#48506b", marginRight:8, boxShadow:leaderboardUpdating ? "0 0 12px #4fd1c566" : "none" }} />
              Updating...
            </div>
            <div onClick={openProfile} style={{ width:32, height:32, borderRadius:"50%", background:"linear-gradient(135deg,#7c6af7,#4fd1c5)", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:700, cursor:"pointer" }}>{userBadge}</div>
          </div>
        </nav>

        <div style={{ maxWidth:1180, margin:"32px auto 40px", padding:`0 ${pageGutter}px`, width:"100%", boxSizing:"border-box" }}>
          <div
            style={{
              background:"radial-gradient(circle at top left, rgba(124,106,247,0.22), rgba(10,10,15,0.98) 52%)",
              border:"1px solid #25253b",
              borderRadius:24,
              padding:"28px 26px 30px",
              boxShadow:"0 24px 70px rgba(0,0,0,0.32)",
              opacity:leaderboardReady ? 1 : 0,
              transform:leaderboardReady ? "translateY(0)" : "translateY(18px)",
              transition:"opacity 0.45s ease, transform 0.45s ease",
            }}
          >
            <div style={{ display:"flex", justifyContent:"space-between", gap:18, alignItems:"flex-start", flexWrap:"wrap", marginBottom:22 }}>
              <div>
                <div style={{ color:"#7a7f9e", fontSize:12, fontWeight:700, letterSpacing:"0.14em", textTransform:"uppercase", fontFamily:"'Space Grotesk',sans-serif", marginBottom:10 }}>Live Rankings</div>
                <h1 style={{ margin:"0 0 10px", color:"#f5f6ff", fontFamily:"'Fraunces',serif", fontSize:42, lineHeight:1, letterSpacing:"-0.04em" }}>Leaderboard Table</h1>
                <div style={{ color:"#a9aed0", maxWidth:640, fontSize:15, lineHeight:1.7 }}>
                  Track contest momentum, compare ratings, and see who is climbing in real time across the current round and the broader arena.
                </div>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:isPhone ? compactGrid : "repeat(2, minmax(160px, 1fr))", gap:12, minWidth:"min(100%, 360px)" }}>
                <div style={{ background:"#10131c", border:"1px solid #22283a", borderRadius:18, padding:"16px 18px" }}>
                  <div style={{ color:"#7780a1", fontSize:11, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:8 }}>Current Scope</div>
                  <div style={{ color:"#eef0ff", fontSize:20, fontWeight:700 }}>{leaderboardScope}</div>
                </div>
                <div style={{ background:"#10131c", border:"1px solid #22283a", borderRadius:18, padding:"16px 18px" }}>
                  <div style={{ color:"#7780a1", fontSize:11, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:8 }}>Visible Users</div>
                  <div style={{ color:"#73f0b3", fontSize:20, fontWeight:700 }}>{leaderboardRows.length}</div>
                </div>
              </div>
            </div>

            <div style={{ display:"flex", gap:12, alignItems:"center", flexWrap:"wrap", marginBottom:18 }}>
              <input
                placeholder="Search username..."
                value={leaderboardSearch}
                onChange={(e)=>setLeaderboardSearch(e.target.value)}
                style={{ flex:1, minWidth:240, background:"#0e1017", border:"1px solid #24283a", borderRadius:12, padding:"12px 14px", color:"#eef0ff", fontFamily:"'Outfit','Space Grotesk',sans-serif", fontSize:14, outline:"none" }}
              />
              <select
                value={leaderboardScope}
                onChange={(e)=>setLeaderboardScope(e.target.value)}
                style={{ minWidth:170, background:"#0e1017", border:"1px solid #24283a", borderRadius:12, padding:"12px 14px", color:"#eef0ff", fontFamily:"'Outfit','Space Grotesk',sans-serif", fontSize:14, outline:"none", cursor:"pointer" }}
              >
                {["All", "This Contest", "Global"].map((scope) => (
                  <option key={scope} value={scope}>{scope}</option>
                ))}
              </select>
            </div>

            {(() => {
              const myEntry = leaderboard.find((e) => e.userId === currentUser.id || e.email === currentUser.email);
              if (myEntry && myEntry.hasContestSubmission) {
                return (
                  <div style={{ marginBottom: 16, background: "rgba(16, 185, 129, 0.1)", border: "1px solid #10b981", borderRadius: 16, padding: "14px 18px", color: "#6ee7b7", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 16 }}>✓</span>
                      <span><strong>Your Exam Status:</strong> Submitted & Evaluated. Official Rank: <strong>#{myEntry.contest?.rank || 1}</strong></span>
                    </div>
                    <div>
                      <strong>Score: {myEntry.contest?.score} / {myEntry.contest?.maxScore || 10} ({myEntry.contest?.percentage ?? 100}%)</strong>
                    </div>
                  </div>
                );
              }
              return (
                <div style={{ marginBottom: 16, background: "rgba(59, 130, 246, 0.1)", border: "1px solid #3b82f6", borderRadius: 16, padding: "14px 18px", color: "#93c5fd", fontSize: 14, display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 16 }}>💡</span>
                  <span>You have not submitted this exam yet. Complete and submit your exam to appear as a ranked participant on the official contest leaderboard.</span>
                </div>
              );
            })()}

            <div style={{ background:"#0d1017", border:"1px solid #202437", borderRadius:22, padding:"14px", boxShadow:"inset 0 1px 0 rgba(255,255,255,0.03)" }}>
              <div style={{ maxHeight:520, overflowY:"auto", paddingRight:4 }}>
                <table style={{ width:"100%", borderCollapse:"separate", borderSpacing:"0 10px" }}>
                  <thead>
                    <tr>
                      {["Rank", "User", "Score", "Problems Solved", "Time Penalty"].map((heading) => (
                        <th
                          key={heading}
                          style={{
                            position:"sticky",
                            top:0,
                            zIndex:2,
                            textAlign:"left",
                            padding:"0 16px 12px",
                            fontSize:11,
                            color:"#7a7f9e",
                            fontWeight:700,
                            textTransform:"uppercase",
                            letterSpacing:"0.12em",
                            fontFamily:"'Space Grotesk',sans-serif",
                            background:"#0d1017",
                          }}
                        >
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {visibleLeaderboardRows.length ? visibleLeaderboardRows.map((entry, index) => {
                      const accent = getLeaderboardAccent(entry.displayRank || entry.stats.rank);
                      const submissionLevel = entry.stats.submissionLevel || "No Submission";
                      const levelMeta = getSubmissionLevelMeta(submissionLevel);
                      const trend = getTrendMeta(entry.stats.trend);
                      const isHovered = hoveredLeaderboardRank === entry.username;
                      const absoluteIndex = ((safeLeaderboardPage - 1) * leaderboardPageSize) + index;
                      const rowBackground = accent.badge
                        ? accent.background
                        : absoluteIndex % 2 === 0
                          ? "#11131b"
                          : "#0c0e15";
                      const baseCellStyle = {
                        background: rowBackground,
                        borderTop:`1px solid ${accent.edge}`,
                        borderBottom:`1px solid ${accent.edge}`,
                        padding:"16px",
                        transition:"background 0.2s ease, border-color 0.2s ease",
                      };

                      return (
                        <tr
                          key={`${leaderboardMode}-${entry.userId || entry.username}`}
                          onMouseEnter={() => setHoveredLeaderboardRank(entry.username)}
                          onMouseLeave={() => setHoveredLeaderboardRank(null)}
                          style={{
                            transform: isHovered ? "scale(1.012)" : "scale(1)",
                            transition:"transform 0.2s ease, filter 0.2s ease",
                            filter: isHovered ? "brightness(1.04)" : "none",
                          }}
                        >
                          <td style={{ ...baseCellStyle, borderLeft:`1px solid ${accent.edge}`, borderRadius:"16px 0 0 16px", boxShadow:accent.glow }}>
                            <div style={{ display:"flex", alignItems:"center", gap:10, color:"#eef0ff", fontWeight:700 }}>
                              <span style={{ fontSize:18 }}>{accent.badge || "#"}</span>
                              <div>
                                <div style={{ color:"#eef0ff", fontSize:18, lineHeight:1 }}>{entry.displayRank || entry.stats.rank}</div>
                                <div style={{ color:trend.color, fontSize:12, marginTop:4 }}>{trend.icon} {trend.label}</div>
                              </div>
                            </div>
                          </td>
                          <td style={baseCellStyle}>
                            <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                              <div style={{ width:42, height:42, borderRadius:"50%", background:`linear-gradient(135deg, ${entry.avatarGradient[0]}, ${entry.avatarGradient[1]})`, display:"flex", alignItems:"center", justifyContent:"center", color:"#081018", fontWeight:800, fontSize:14, boxShadow:"inset 0 1px 0 rgba(255,255,255,0.25)" }}>
                                {getAvatarLabel(entry.username)}
                              </div>
                              <div>
                                <div style={{ color:"#f5f6ff", fontSize:15, fontWeight:700 }}>{entry.username}</div>
                                <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap", marginTop:4 }}>
                                  <span style={{ color:"#8f93b4", fontSize:12 }}>Rating {entry.rating}</span>
                                  {entry.badgeTier && <AchievementBadge tier={entry.badgeTier} compact />}
                                  <span style={{ color:levelMeta.color, fontSize:11, fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase", border:`1px solid ${levelMeta.border}`, background:levelMeta.background, borderRadius:999, padding:"3px 8px" }}>
                                    {submissionLevel}
                                  </span>
                                  <span style={{ color:"#7c6af7", fontSize:11, fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase", border:"1px solid #2f3150", borderRadius:999, padding:"3px 8px" }}>
                                    {leaderboardScope === "This Contest" ? "Round" : leaderboardScope === "Global" ? "Global" : "All Arena"}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </td>
                          <td style={{ ...baseCellStyle, color:"#73f0b3", fontWeight:700, fontSize:16 }}>{entry.stats.score}</td>
                          <td style={{ ...baseCellStyle, color:"#eef0ff", fontWeight:600 }}>{entry.stats.problemsSolved}</td>
                          <td style={{ ...baseCellStyle, borderRight:`1px solid ${accent.edge}`, borderRadius:"0 16px 16px 0", color:"#dfe2ff", fontWeight:600, boxShadow:accent.glow }}>
                            {entry.stats.timePenalty}
                          </td>
                        </tr>
                      );
                    }) : (
                      <tr>
                        <td colSpan="5" style={{ padding:"38px 18px", textAlign:"center", color:"#8f93b4", background:"#0d1017" }}>
                          {leaderboardSearch.trim()
                            ? "No submitted leaderboard entries matched that username."
                            : "No students have submitted this contest yet. Complete and submit your exam to appear on the official leaderboard."}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {leaderboardPageCount > 1 && (
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:12, marginTop:18, flexWrap:"wrap" }}>
                  <div style={{ color:"#7a7f9e", fontSize:12 }}>
                    Page {safeLeaderboardPage} of {leaderboardPageCount}
                  </div>
                  <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                    <button
                      onClick={() => setLeaderboardPage((prev) => Math.max(1, prev - 1))}
                      disabled={safeLeaderboardPage === 1}
                      style={{ ...S.btn("default"), opacity:safeLeaderboardPage === 1 ? 0.45 : 1 }}
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => setLeaderboardPage((prev) => Math.min(leaderboardPageCount, prev + 1))}
                      disabled={safeLeaderboardPage === leaderboardPageCount}
                      style={{ ...S.btn("default"), opacity:safeLeaderboardPage === leaderboardPageCount ? 0.45 : 1 }}
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  
  if (assessmentResult) return renderAssessmentResultView();

  const p = selectedProblem;
  const consoleHeight = consoleOpen ? (isPhone ? 320 : 260) : 42;
  const isTheoryProblem = p && (p.type === "theory" || (Array.isArray(p.options) && p.options.length > 0));
  const problemWorkspaceStyle = isCompact
    ? { display:"grid", gridTemplateColumns:"minmax(0, 1fr)", overflow:"visible", minHeight:"calc(100vh - 116px)" }
    : { display:"flex", flex:1, overflow:"hidden", height:"calc(100vh - 128px)" };
  const problemPanelStyle = isCompact
    ? { display:"flex", flexDirection:"column", borderBottom:"1px solid #1e1e2e", overflow:"hidden", minHeight:isPhone ? 360 : 420 }
    : { width:"42%", display:"flex", flexDirection:"column", borderRight:"1px solid #1e1e2e", overflow:"hidden" };
  const editorPanelStyle = isCompact
    ? { display:"flex", flexDirection:"column", overflow:"hidden", minHeight:isPhone ? 620 : 680 }
    : { flex:1, display:"flex", flexDirection:"column", overflow:"hidden" };

  return (
    <div style={{ position: "relative" }} onContextMenu={(e) => e.preventDefault()}>
      <ScreenShield active={screenShield} message={shieldMessage} />
      <div style={{ ...S.app, opacity: screenShield ? 0 : 1, pointerEvents: screenShield ? "none" : "auto", transition: "opacity 0.12s ease", userSelect: screenShield ? "none" : "auto" }}>
      {exitExamConfirmModalOpen && (
        <div style={S.modalBackdrop} onClick={() => setExitExamConfirmModalOpen(false)}>
          <div style={{ ...S.modalCard, width: "min(520px, 92vw)", padding: "28px", border: "1px solid #7f1d1d" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ color: "#ef4444", fontSize: 12, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
              <span>⚠</span>
              <span>Accidental Exit Protection</span>
            </div>
            <h2 style={{ margin: "0 0 12px", color: "#f5f6ff", fontSize: 26, lineHeight: 1.2 }}>Leave Exam?</h2>
            <div style={{ color: "#94a3b8", fontSize: 14, lineHeight: 1.7, marginBottom: 20 }}>
              Are you sure you want to exit the exam?
              <div style={{ marginTop: 8, color: "#cbd5e1" }}>
                Your exam is still in progress. Saved progress will remain stored in the database, but leaving may interrupt your exam session.
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, flexWrap: "wrap" }}>
              <button
                onClick={() => {
                  setExitExamConfirmModalOpen(false);
                  setPendingNavigationAction(null);
                }}
                style={{ ...S.btn("submit"), padding: "10px 24px", background: "linear-gradient(135deg,#3b82f6,#2563eb)" }}
              >
                STAY ON EXAM
              </button>
              <button
                onClick={() => {
                  setExitExamConfirmModalOpen(false);
                  setContestEntered(false);
                  if (pendingNavigationAction) {
                    pendingNavigationAction();
                    setPendingNavigationAction(null);
                  } else {
                    setView("list");
                  }
                }}
                style={{ ...S.btn("default"), border: "1px solid #ef4444", color: "#ef4444", background: "rgba(239,68,68,0.1)", padding: "10px 20px" }}
              >
                EXIT EXAM
              </button>
            </div>
          </div>
        </div>
      )}

      {startExamModalOpen && (
        <div style={S.modalBackdrop} onClick={() => setStartExamModalOpen(false)}>
          <div style={{ ...S.modalCard, width: "min(560px, 92vw)", padding: "28px" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ color: "#a78bfa", fontSize: 12, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 10 }}>
              Exam Confirmation
            </div>
            <h2 style={{ margin: "0 0 12px", color: "#f5f6ff", fontSize: 28, lineHeight: 1.2 }}>Ready to Start the Exam?</h2>
            <div style={{ color: "#94a3b8", fontSize: 14, lineHeight: 1.7, marginBottom: 20 }}>
              Once you start the exam, the timer will begin.
              <ul style={{ margin: "10px 0 0", paddingLeft: 20, color: "#cbd5e1", display: "grid", gap: 6 }}>
                <li>Do not refresh the page.</li>
                <li>Do not close the browser.</li>
                <li>Keep your internet connection stable.</li>
                <li>Camera/proctoring monitoring must remain active if required.</li>
              </ul>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
              <button onClick={() => setStartExamModalOpen(false)} style={S.btn("default")}>Cancel</button>
              <button
                onClick={() => {
                  setStartExamModalOpen(false);
                  startContestAfterInstructions();
                }}
                style={{ ...S.btn("submit"), padding: "10px 24px" }}
              >
                ▶ Start Exam Now
              </button>
            </div>
          </div>
        </div>
      )}

      {finalSubmitConfirmOpen && (
        <div style={S.modalBackdrop} onClick={() => !submittingAssessment && setFinalSubmitConfirmOpen(false)}>
          <div style={{ ...S.modalCard, width: "min(580px, 92vw)", padding: "28px" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ color: "#7a7f9e", fontSize: 12, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", fontFamily: "'Space Grotesk',sans-serif", marginBottom: 10 }}>
              Final Exam Submission
            </div>
            <h2 style={{ margin: "0 0 12px", color: "#f5f6ff", fontSize: 30, lineHeight: 1.1 }}>Finish and submit your exam?</h2>
            <div style={{ color: "#a9aed0", fontSize: 14, lineHeight: 1.7, marginBottom: 18 }}>
              You will not be able to modify your answers after final submission.
            </div>
            {(() => {
              const totalContestQuestions = contestProblems.length || 1;
              let answeredCount = 0;
              contestProblems.forEach((cp) => {
                const isTheory = cp.type === "theory" || (Array.isArray(cp.options) && cp.options.length > 0);
                if (isTheory) {
                  if (candidateTheoryAnswers[cp.dbId] || candidateTheoryAnswers[cp.id] || candidateTheoryAnswers[cp.legacyId]) {
                    answeredCount += 1;
                  }
                } else {
                  const ans = candidateCodingAnswers[cp.dbId] || candidateCodingAnswers[cp.id] || candidateCodingAnswers[cp.legacyId];
                  if (ans?.submitted || Boolean(String(ans?.code || "").trim())) {
                    answeredCount += 1;
                  }
                }
              });
              const unansweredCount = Math.max(0, totalContestQuestions - answeredCount);
              return (
                <div style={{ margin: "0 0 20px", padding: "16px 20px", borderRadius: 16, background: "#0f131c", border: "1px solid #24283a", display: "grid", gap: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", color: "#f8fafc", fontSize: 14 }}>
                    <span>Answered Questions:</span>
                    <strong style={{ color: "#4ade80" }}>{answeredCount} / {totalContestQuestions}</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", color: "#f8fafc", fontSize: 14 }}>
                    <span>Unanswered Questions:</span>
                    <strong style={{ color: unansweredCount > 0 ? "#f87171" : "#94a3b8" }}>{unansweredCount} / {totalContestQuestions}</strong>
                  </div>
                  {unansweredCount > 0 && (
                    <div style={{ color: "#fbbf24", fontSize: 13, display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                      <span>⚠ You have {unansweredCount} unanswered question{unansweredCount > 1 ? "s" : ""}. Review your answers before submitting.</span>
                    </div>
                  )}
                </div>
              );
            })()}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, flexWrap: "wrap" }}>
              <button onClick={() => setFinalSubmitConfirmOpen(false)} disabled={submittingAssessment} style={S.btn("default")}>
                Cancel & Review Answers
              </button>
              <button
                onClick={confirmFinalSubmit}
                disabled={submittingAssessment}
                style={{ ...S.btn("submit"), background: "linear-gradient(135deg,#8b5cf6,#ec4899)", opacity: submittingAssessment ? 0.65 : 1, padding: "10px 24px" }}
              >
                {submittingAssessment ? "⏳ SUBMITTING EXAM..." : "FINAL SUBMIT"}
              </button>
            </div>
          </div>
        </div>
      )}

      
      <ErrorBanner errors={errorBanner} onClose={() => setErrorBanner(null)} />

      <nav style={S.nav}>
        <DevOrbitLogo onClick={()=>setView("list")} />
        <span style={{ color:"#444", fontSize:14 }}>/</span>
        <span style={{ color:"#eef0ff", fontSize:14, fontFamily:"'Outfit','Space Grotesk',sans-serif", fontWeight:600, letterSpacing:"0.01em" }}>{p.title}</span>
        {problemNavigationSource === "contest" && contestEntered && (
          <div style={{ display:"inline-flex", alignItems:"center", gap:8, marginLeft:14, padding:"7px 10px", borderRadius:10, background:"#0f1727", border:"1px solid #2d4f7b", color:"#93c5fd", fontSize:12, fontWeight:800, letterSpacing:"0.08em", textTransform:"uppercase", fontFamily:"'Space Grotesk',sans-serif" }}>
            <span>Time Left</span>
            <span style={{ color:contestTimerSeconds <= 60 ? "#ff9b9b" : "#eef0ff", fontFamily:"'JetBrains Mono',monospace", fontSize:13 }}>{formatCountdown(contestTimerSeconds)}</span>
          </div>
        )}
      </nav>



      <div style={problemWorkspaceStyle}>

        
        <div style={problemPanelStyle}>
          <div style={{ display:"flex", borderBottom:"1px solid #1e1e2e", background:"#0d0d15", overflowX:"auto" }}>
            {["description","solution","submissions"].map(t=>(
              <button key={t} onClick={()=>setActiveTab(t)} style={{ background:"none", border:"none", padding:"12px 18px", color:activeTab===t?"#fff":"#555", fontSize:12.5, cursor:"pointer", fontFamily:"'Space Grotesk',sans-serif", borderBottom:activeTab===t?"2px solid #7c6af7":"2px solid transparent", textTransform:"uppercase", letterSpacing:"0.08em", fontWeight:activeTab===t?700:500 }}>{t}</button>
            ))}
          </div>

          <div style={{ flex:1, overflowY:"auto", padding:isPhone ? 16 : 24, scrollbarWidth:"thin", scrollbarColor:"#2a2a3e #0a0a0f" }}>
            {activeTab === "description" && (
              <>
                <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:16, flexWrap:"wrap" }}>
                  <h1 style={S.problemTitle}>{p.id}. {p.title}</h1>
                  <span style={S.badge(p.difficulty)}>{p.difficulty}</span>
                </div>
                {candidateCodingAnswers[p.dbId || p.id]?.submitted && (
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 14px", borderRadius: 999, background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.4)", color: "#4ade80", fontSize: 12, fontWeight: 800, marginBottom: 16 }}>
                    <span>✓ Submitted</span>
                    <span style={{ color: "#93c5fd" }}>({candidateCodingAnswers[p.dbId || p.id].marks ?? 0} / {p.marks || 10} pts)</span>
                    <span style={{ color: "#cbd5e1" }}>— Test Cases Passed: {candidateCodingAnswers[p.dbId || p.id].testCasesPassed || 0} / {candidateCodingAnswers[p.dbId || p.id].totalTestCases || 3}</span>
                  </div>
                )}
                <div style={{ display:"flex", gap:8, marginBottom:20, flexWrap:"wrap" }}>
                  {p.tags.map(t=><span key={t} style={S.tag}>{t}</span>)}
                </div>
                <div style={S.problemBody} dangerouslySetInnerHTML={{ __html:p.description }} />
                {parseExamplesList(p.examples).map((ex, i) => (
                  <div key={`ex-${p.id || p.number}-${i}`} style={{ marginBottom: 20 }}>
                    <div style={S.sectionLabel}>Example {i + 1}</div>
                    <div style={S.exampleCard}>
                      {(ex.input !== "" || ex.output === "") && (
                        <div style={{ marginBottom: 8 }}>
                          <span style={S.exampleFieldLabel}>Input</span>
                          <div style={S.exampleFieldValue}>{cleanExampleField(ex.input)}</div>
                        </div>
                      )}
                      {ex.output !== "" && (
                        <div style={{ marginBottom: ex.explanation ? 8 : 0 }}>
                          <span style={S.exampleFieldLabel}>Output</span>
                          <div style={{ ...S.exampleFieldValue, color: "#73f0b3" }}>{cleanExampleField(ex.output)}</div>
                        </div>
                      )}
                      {Boolean(ex.explanation) && (
                        <div>
                          <span style={S.exampleFieldLabel}>Explanation</span>
                          <div style={{ ...S.problemBody, marginBottom: 0, fontSize: 14.5, color: "#adb2d4" }}>{ex.explanation}</div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                <div style={{ marginTop:20 }}>
                  <div style={S.sectionLabel}>Constraints</div>
                  <ul style={{ margin:0, paddingLeft:18 }}>
                    {p.constraints.map((c,i)=><li key={i} style={S.constraintItem} dangerouslySetInnerHTML={{ __html:c }} />)}
                  </ul>
                </div>
              </>
            )}

            {activeTab === "solution" && (
              solved.has(p.id) ? (
                <div>
                  <div style={{ fontSize:14, fontWeight:600, color:"#888", marginBottom:16 }}>Reference Solution — {lang}</div>
                  <pre style={{ background:"#0d0d15", border:"1px solid #1e1e2e", borderRadius:8, padding:16, fontSize:12, color:"#c8c8e8", overflowX:"auto", lineHeight:1.6, whiteSpace:"pre-wrap" }}>
                    {"// Reference solutions are managed server-side and protected."}
                  </pre>
                </div>
              ) : (
                <div style={{ color:"#666", textAlign:"center", paddingTop:60 }}>
                  <div style={{ fontSize:40, marginBottom:16 }}>🔒</div>
                  <div style={{ fontSize:16, color:"#888" }}>Solution is locked</div>
                  <div style={{ fontSize:13, color:"#555", marginTop:8 }}>Solve the problem first to unlock.</div>
                </div>
              )
            )}

            {activeTab === "submissions" && (
              solved.has(p.id) ? (
                <div>
                  <div style={{ fontSize:14, fontWeight:600, color:"#888", marginBottom:16 }}>Your Submissions</div>
                  <div style={{ background:"#0d150d", border:"1px solid #1a3a1a", borderRadius:8, padding:14, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                    <span style={{ color:"#4ade80", fontWeight:600, fontSize:13 }}>✓ Accepted</span>
                    <span style={{ color:"#555", fontSize:12 }}>Just now · {lang}</span>
                  </div>
                </div>
              ) : (
                <div style={{ color:"#555", textAlign:"center", paddingTop:60, fontSize:14 }}>No submissions yet.</div>
              )
            )}
          </div>
        </div>

        
        {isTheoryProblem ? (
          <div style={{ ...editorPanelStyle, background: "#0d1020", padding: isPhone ? 16 : 24, overflowY: "auto" }}>
            <div style={{ color: "#a78bfa", fontSize: 12, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 16 }}>
              Select Answer Option ({p.marks || 2} Marks):
            </div>
            <div style={{ display: "grid", gap: 14 }}>
              {(p.options || []).map((opt, oIdx) => {
                const currentChoice = candidateTheoryAnswers[p.dbId] || candidateTheoryAnswers[p.id] || candidateTheoryAnswers[p.legacyId] || "";
                const isSelected = currentChoice === opt;
                return (
                  <div
                    key={oIdx}
                    onClick={() => {
                      const pKey = p.dbId || p.id;
                      setCandidateTheoryAnswers((prev) => ({
                        ...prev,
                        [pKey]: opt,
                      }));
                    }}
                    style={{
                      display: "flex",
                      gap: 14,
                      alignItems: "center",
                      padding: "18px 20px",
                      borderRadius: 16,
                      background: isSelected ? "linear-gradient(135deg, rgba(139,92,246,0.22), rgba(30,41,59,0.95))" : "#111118",
                      border: isSelected ? "2px solid #8b5cf6" : "1px solid #1e1e2e",
                      color: "#f5f6ff",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                      boxShadow: isSelected ? "0 10px 30px rgba(139,92,246,0.25)" : "none",
                    }}
                  >
                    <input
                      type="radio"
                      checked={isSelected}
                      onChange={() => {}}
                      style={{ width: 20, height: 20, accentColor: "#8b5cf6", cursor: "pointer" }}
                    />
                    <span style={{ fontWeight: 800, color: isSelected ? "#c4b5fd" : "#64748b", fontSize: 16, width: 24 }}>
                      {String.fromCharCode(65 + oIdx)}.
                    </span>
                    <span style={{ fontSize: 15, fontWeight: isSelected ? 700 : 500, lineHeight: 1.5 }}>
                      {opt}
                    </span>
                  </div>
                );
              })}
            </div>

            {(candidateTheoryAnswers[p.dbId] || candidateTheoryAnswers[p.id]) ? (
              <div style={{ marginTop: 20, padding: "12px 16px", borderRadius: 12, background: "rgba(34, 197, 94, 0.12)", border: "1px solid rgba(34, 197, 94, 0.3)", color: "#4ade80", fontSize: 13, fontWeight: 700 }}>
                ✓ Option selected and saved: "{candidateTheoryAnswers[p.dbId || p.id]}"
              </div>
            ) : (
              <div style={{ marginTop: 20, padding: "12px 16px", borderRadius: 12, background: "#1e293b", color: "#94a3b8", fontSize: 13 }}>
                Select one option above. Your choice will be saved automatically.
              </div>
            )}
          </div>
        ) : (
          <div style={editorPanelStyle}>
            {/* Toolbar */}
            <div style={{ background:"#0d0d15", borderBottom:"1px solid #1e1e2e", padding:`8px ${isPhone ? 12 : 16}px`, display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
              <select value={lang} onChange={e=>handleLangChange(e.target.value)}
                style={{ background:"#1a1a2e", border:"1px solid #2a2a3e", color:"#c8c8e8", padding:"4px 10px", borderRadius:6, fontSize:13, fontFamily:"inherit", cursor:"pointer" }}>
                {SUPPORTED_LANGUAGES.map((l) => (
                  <option key={l.id} value={l.id}>{l.label}</option>
                ))}
              </select>

              {/* Syntax Validation Status Badge */}
              {(() => {
                const diag = validateCodeSyntax(code, lang);
                if (diag.isValid) {
                  return (
                    <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 999, background: "rgba(34, 197, 94, 0.14)", color: "#4ade80", border: "1px solid rgba(34, 197, 94, 0.3)" }}>
                      ✓ Syntax Valid
                    </span>
                  );
                }
                return (
                  <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 999, background: "rgba(239, 68, 68, 0.14)", color: "#f87171", border: "1px solid rgba(239, 68, 68, 0.3)" }}>
                    ⚠ {diag.errors[0]?.message || "Syntax Warning"}
                  </span>
                );
              })()}

              <div style={{ marginLeft: isPhone ? 0 : "auto", display: "flex", gap: 8, alignItems: "center" }}>
                <button
                  onClick={() => setCode(formatCode(code, lang))}
                  title="Format Code (Ctrl+Shift+F)"
                  style={{ background: "none", border: "1px solid #2a2a3e", color: "#93c5fd", padding: "4px 10px", borderRadius: 6, fontSize: 12, cursor: "pointer", fontFamily: "inherit", fontWeight: 700 }}
                >
                  🧹 Format
                </button>
                <button
                  onClick={() => {
                    const defaultCode = p.starterCode?.[lang] || DEFAULT_STARTER_CODE[lang] || "";
                    setCode(defaultCode);
                  }}
                  style={{ background: "none", border: "1px solid #2a2a3e", color: "#888", padding: "4px 10px", borderRadius: 6, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}
                >
                  Reset
                </button>
              </div>
            </div>

            {/* Editor */}
            {(() => {
              const syntaxDiag = validateCodeSyntax(code, lang);
              const errorLines = new Set(syntaxDiag.errors.map((e) => e.line));

              return (
                <div style={{ flex: 1, minHeight: isCompact ? (isPhone ? 360 : 420) : 0, position: "relative", overflow: "hidden", background: "linear-gradient(180deg,#0d1020,#090b14)", display: "flex", flexDirection: "column" }}>
                  <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
                    {/* Gutter */}
                    <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 44, background: "#0a0a12", borderRight: "1px solid #1a1a2a", paddingTop: 16, textAlign: "right", paddingRight: 8, userSelect: "none", overflowY: "hidden", zIndex: 1 }}>
                      <div style={{ transform: `translateY(-${editorScrollTop}px)` }}>
                        {code.split("\n").map((_, i) => {
                          const lineNum = i + 1;
                          const hasErr = errorLines.has(lineNum);
                          return (
                            <div key={i} style={{ color: hasErr ? "#ef4444" : "#56607a", fontWeight: hasErr ? 800 : 400, fontSize: 13, lineHeight: "21px", display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 3 }}>
                              {hasErr && <span style={{ fontSize: 9, color: "#ef4444" }}>•</span>}
                              <span>{lineNum}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <CodeHighlightLayer code={code} language={lang} scrollTop={editorScrollTop} />
                    <textarea
                      ref={textareaRef}
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      onScroll={(e) => setEditorScrollTop(e.currentTarget.scrollTop)}
                      onKeyDown={(e) => handleEditorIndentation(e, code, setCode, textareaRef, lang)}
                      spellCheck={false}
                      style={{ position: "absolute", inset: 0, paddingLeft: 56, paddingTop: 16, paddingRight: 16, paddingBottom: 16, background: "transparent", color: "transparent", caretColor: "#67e8f9", border: "none", outline: "none", resize: "none", fontFamily: "'JetBrains Mono',monospace", fontSize: 13.5, lineHeight: "21px", width: "100%", height: "100%", boxSizing: "border-box", scrollbarWidth: "thin", scrollbarColor: "#2a2a3e #0a0a0f", whiteSpace: "pre-wrap", wordBreak: "break-word" }}
                    />
                  </div>

                  {/* Inline Syntax Diagnostic Warning Bar */}
                  {!syntaxDiag.isValid && (
                    <div style={{ background: "rgba(239, 68, 68, 0.12)", borderTop: "1px solid rgba(239, 68, 68, 0.3)", color: "#f87171", padding: "6px 16px", fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", gap: 8, zIndex: 5 }}>
                      <span>🚨</span>
                      <span>Line {syntaxDiag.errors[0]?.line}: {syntaxDiag.errors[0]?.message}</span>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Console */}
            <div style={{ height:consoleHeight, borderTop:"1px solid #1e1e2e", background:"#0a0a0f", transition:"height 0.2s", overflow:"hidden", display:"flex", flexDirection:"column" }}>
              <div style={{ display:"flex", alignItems:"center", padding:"0 16px", height:42, borderBottom:consoleOpen?"1px solid #1e1e2e":"none", flexShrink:0 }}>
                <button onClick={()=>setConsoleOpen(!consoleOpen)} style={{ background:"none", border:"none", color:"#888", fontSize:13, cursor:"pointer", fontFamily:"inherit", display:"flex", alignItems:"center", gap:6 }}>
                  <span style={{ transform:consoleOpen?"rotate(0deg)":"rotate(-90deg)", display:"inline-block", transition:"transform 0.2s" }}>▾</span>
                  Console
                </button>
                {consoleOpen && (
                  <div style={{ display:"flex", marginLeft:16 }}>
                    {["testcase","result"].map(t=>(
                      <button key={t} onClick={()=>setConsoleTab(t)} style={{ background:"none", border:"none", padding:"4px 14px", color:consoleTab===t?"#fff":"#555", fontSize:12, cursor:"pointer", fontFamily:"inherit", borderBottom:consoleTab===t?"2px solid #7c6af7":"2px solid transparent" }}>
                        {t==="testcase"?"Test Cases":"Result"}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {consoleOpen && (
                <div style={{ flex:1, overflowY:"auto", padding:16, scrollbarWidth:"thin", scrollbarColor:"#2a2a3e #0a0a0f" }}>
                  {consoleTab === "testcase" && (
                    <div>
                      {p.testCases.map((tc,i)=>(
                        <div key={i} style={{ marginBottom:12 }}>
                          <div style={{ fontSize:12, color:"#555", marginBottom:4 }}>Case {i+1}:</div>
                          <div style={{ background:"#111118", border:"1px solid #1e1e2e", borderRadius:6, padding:"10px 12px", fontSize:13 }}>
                            <div style={{ color:"#555", marginBottom:6 }}>Input</div>
                            <div style={{ color:"#c8c8e8", marginBottom:10 }}>{tc.input}</div>
                            <div style={{ color:"#555", marginBottom:6 }}>Expected Output</div>
                            <div style={{ color:"#4ade80" }}>{tc.expected}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {consoleTab === "result" && runResult && (
                    <div>
                      {/* Status row */}
                      <div style={{ display:"flex", alignItems:"center", gap:14, marginBottom:14, flexWrap:"wrap" }}>
                        <span style={{ fontSize:15, fontWeight:700, color:runResult.status==="unsupported"?"#ffc01e":runResult.passed?"#4ade80":"#ff375f" }}>
                          {runResult.status==="unsupported"?"Execution Not Available":runResult.passed?"Accepted":"Wrong Answer"}
                        </span>
                        {runResult.passed && <>
                          <span style={{ color:"#555", fontSize:12 }}>Runtime: <span style={{ color:"#c8c8e8" }}>{runResult.runtime}</span></span>
                          <span style={{ color:"#555", fontSize:12 }}>Memory: <span style={{ color:"#c8c8e8" }}>{runResult.memory}</span></span>
                          <span style={{ color:"#555", fontSize:12 }}>Beats: <span style={{ color:"#7c6af7" }}>{runResult.beats}</span></span>
                        </>}
                      </div>

                      {/* Case pills */}
                      <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:12 }}>
                        {runResult.tests.map((t,i)=>(
                          <div key={i} style={{ background:t.status==="pass"?"#0d150d":t.status==="unsupported"?"#151208":t.status==="error"?"#150a08":"#150d0d", border:`1px solid ${t.status==="pass"?"#1a3a1a":t.status==="unsupported"?"#5a4716":"#3a1a1a"}`, borderRadius:6, padding:"6px 12px", fontSize:12 }}>
                            <span style={{ color:t.status==="pass"?"#4ade80":t.status==="unsupported"?"#ffc01e":"#ff375f" }}>{t.status==="pass"?"PASS":t.status==="unsupported"?"INFO":t.status==="error"?"ERR":"FAIL"}</span>
                            <span style={{ color:"#555", marginLeft:6 }}>Case {i+1}</span>
                          </div>
                        ))}
                      </div>

                      {/* First failing case detail */}
                      {runResult.tests.filter(t=>t.status!=="pass").slice(0,1).map((t,i)=>(
                        <div key={i} style={{ background:t.status==="unsupported"?"#151208":"#110a0a", border:`1px solid ${t.status==="unsupported"?"#5a4716":"#3a1a1a"}`, borderRadius:8, padding:12, fontSize:12 }}>
                          {t.error
                            ? <div style={{ color:t.status==="unsupported"?"#ffd37a":"#ff9999", whiteSpace:"pre-wrap" }}>{t.error}</div>
                            : <>
                                <div style={{ color:"#555", marginBottom:4 }}>Expected: <span style={{ color:"#4ade80" }}>{t.expected}</span></div>
                                <div style={{ color:"#555" }}>Got:      <span style={{ color:"#ff6b6b" }}>{t.actual ?? "undefined"}</span></div>
                              </>
                          }
                        </div>
                      ))}
                    </div>
                  )}
                  {consoleTab === "result" && !runResult && (
                    <div style={{ color:"#444", fontSize:13 }}>Run your code to see results here.</div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Sticky Bottom Action Bar */}
      <div style={{ background: "#0d0d15", borderTop: "1px solid #1e1e2e", padding: "12px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, position: "sticky", bottom: 0, zIndex: 80, width: "100%", boxSizing: "border-box" }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {showProblemNavigation && (
            <>
              <button
                onClick={() => openAdjacentProblem(-1)}
                disabled={!hasPreviousProblem}
                style={{ ...S.btn("default"), opacity: hasPreviousProblem ? 1 : 0.45, cursor: hasPreviousProblem ? "pointer" : "not-allowed" }}
              >
                ← PREVIOUS
              </button>
              <button
                onClick={() => openAdjacentProblem(1)}
                disabled={!hasNextProblem}
                style={{ ...S.btn("default"), opacity: hasNextProblem ? 1 : 0.45, cursor: hasNextProblem ? "pointer" : "not-allowed" }}
              >
                NEXT →
              </button>
            </>
          )}
        </div>

        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          {!isTheoryProblem && (
            <>
              <button
                onClick={() => simulateRun(false)}
                disabled={running || submitting}
                style={{ ...S.btn("run"), padding: "10px 20px" }}
              >
                {running ? "⏳ RUNNING..." : "▶ RUN CODE"}
              </button>
              <button
                onClick={handleSubmitClick}
                disabled={running || submitting}
                style={{ ...S.btn("submit"), padding: "10px 22px" }}
              >
                {submitting ? "⏳ EVALUATING..." : "✓ SUBMIT CODE"}
              </button>
            </>
          )}
          {(problemNavigationSource === "contest" || contestEntered) && (
            <button
              onClick={() => setFinalSubmitConfirmOpen(true)}
              style={{ ...S.btn("submit"), background: "linear-gradient(135deg, #ef4444, #dc2626)", padding: "10px 22px" }}
            >
              🏁 FINISH EXAM
            </button>
          )}
        </div>
      </div>

      {problemNavigationSource === "contest" && contestEntered && (
        <div
          style={{
            position: "fixed",
            right: isPhone ? 12 : 20,
            bottom: cameraMinimized ? 20 : 80,
            width: cameraMinimized ? 160 : (isPhone ? 150 : 200),
            background: "#090b14",
            border: "1px solid #2a3550",
            borderRadius: 16,
            overflow: "hidden",
            boxShadow: "0 18px 40px rgba(0,0,0,0.42)",
            zIndex: 99,
            transition: "all 0.2s ease",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", background: "#0f1727", borderBottom: "1px solid #22304a", color: "#cbd5e1", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: contestCameraStream ? "#22c55e" : "#eab308", boxShadow: contestCameraStream ? "0 0 0 4px rgba(34,197,94,0.14)" : "none" }} />
              <span>{contestCameraStream ? "Camera On" : "Standby"}</span>
            </div>
            <button
              onClick={() => setCameraMinimized(!cameraMinimized)}
              style={{ background: "none", border: "none", color: "#93c5fd", cursor: "pointer", fontSize: 11, fontWeight: 700, padding: 0 }}
            >
              {cameraMinimized ? "Expand" : "Minimize"}
            </button>
          </div>
          {!cameraMinimized && (
            contestCameraStream ? (
              <video
                ref={contestCameraPreviewRef}
                autoPlay
                muted
                playsInline
                style={{
                  display: "block",
                  width: "100%",
                  height: isPhone ? 110 : 140,
                  objectFit: "cover",
                  transform: "scaleX(-1)",
                  background: "#020617",
                }}
              />
            ) : (
              <div style={{ padding: "12px 10px", textAlign: "center", color: "#94a3b8", fontSize: 11 }}>
                ⚠ Camera preview unavailable. Proctoring monitoring active.
              </div>
            )
          )}
        </div>
      )}
    </div>
    </div>
  );
}

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("DevOrbit ErrorBoundary Caught:", error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: "40px 24px", maxWidth: 800, margin: "60px auto", background: "#0f172a", border: "1px solid #ef4444", borderRadius: 16, color: "#f8fafc", fontFamily: "'Outfit', sans-serif" }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: "#f87171", marginBottom: 12, display: "flex", alignItems: "center", gap: 10 }}>
            <span>⚠️</span>
            <span>Application Exception</span>
          </div>
          <p style={{ color: "#cbd5e1", fontSize: 15, lineHeight: 1.6, marginBottom: 20 }}>
            DevOrbit encountered an unexpected runtime error.
          </p>
          <div style={{ background: "#020617", border: "1px solid #334155", borderRadius: 10, padding: 14, fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: "#f87171", marginBottom: 20, whiteSpace: "pre-wrap", overflowX: "auto" }}>
            {this.state.error && this.state.error.toString()}
            {this.state.errorInfo?.componentStack && `\n${this.state.errorInfo.componentStack}`}
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <button
              onClick={() => window.location.reload()}
              style={{ padding: "10px 20px", borderRadius: 10, border: "none", background: "#38bdf8", color: "#08080d", fontWeight: 700, cursor: "pointer" }}
            >
              🔄 Reload Application
            </button>
            <button
              onClick={() => { this.setState({ hasError: false, error: null }); window.location.href = "/"; }}
              style={{ padding: "10px 20px", borderRadius: 10, border: "1px solid #475569", background: "transparent", color: "#f8fafc", fontWeight: 700, cursor: "pointer" }}
            >
              🏠 Go to Home
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <ErrorBoundary>
    <CodingPlatform />
  </ErrorBoundary>
);
