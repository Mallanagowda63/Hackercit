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
// Admins sign in from /admin; the public login popup is student-only.
const IS_ADMIN_ENTRY = /^\/admin\/?$/i.test(window.location.pathname);
const DEFAULT_AUTH_ROLE = IS_ADMIN_ENTRY ? "admin" : "student";
// Tab switches / leaving fullscreen / restricted keys: the 4th one ends the test.
const MAX_CONTEST_WARNINGS = 4;
// Height of the fixed Run / Submit bar on the coding screen.
const PROBLEM_ACTION_BAR_HEIGHT = 66;
// Shared test links look like /test/<testId>; opening one takes a student straight into that test.
const TEST_LINK_ID = (window.location.pathname.match(/^\/test\/([0-9a-f]{24})\/?$/i) || [])[1] || null;
// The test a student may see: the one from the link they opened last. It is remembered, so
// going back to the home page (which leaves the /test/<id> address) keeps the same test.
const STUDENT_TEST_LINK_STORAGE_KEY = "codearena.testLink";
const STUDENT_TEST_ID = (() => {
  try {
    if (TEST_LINK_ID) window.localStorage?.setItem(STUDENT_TEST_LINK_STORAGE_KEY, TEST_LINK_ID);
    return TEST_LINK_ID || window.localStorage?.getItem(STUDENT_TEST_LINK_STORAGE_KEY) || null;
  } catch {
    return TEST_LINK_ID;
  }
})();
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

// The ScholarLogic logo has a white background and dark text, so it sits on a white badge
// to stay readable on the dark headers.
function ScholarLogicBadge({ height = 34, onClick }) {
  return (
    <span
      onClick={onClick}
      title={onClick ? "Go to home page" : undefined}
      style={{
        cursor:onClick ? "pointer" : "inherit",
        display:"inline-flex",
        alignItems:"center",
        background:"#ffffff",
        borderRadius:8,
        padding:"3px 8px",
        boxShadow:"0 1px 4px rgba(0,0,0,0.25)",
        flexShrink:0,
      }}
    >
      <img src="/scholarlogic-logo.png" alt="ScholarLogic" style={{ height, width:"auto", display:"block" }} />
    </span>
  );
}

function DevOrbitLogo({ onClick, lightSurface = false, showPartner = true, showBrand = false }) {
  if (!showBrand && !showPartner) return null;

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
      {showBrand && (
      <svg width="30" height="30" viewBox="0 0 30 30" fill="none" aria-hidden="true">
        <circle cx="15" cy="15" r="13" fill={lightSurface ? "#EEF2FF" : "#111827"} />
        <ellipse cx="15" cy="15" rx="11" ry="5.8" transform="rotate(-18 15 15)" stroke="#7C6AF7" strokeWidth="2" />
        <ellipse cx="15" cy="15" rx="7.4" ry="11.2" transform="rotate(28 15 15)" stroke="#4FD1C5" strokeWidth="1.6" strokeDasharray="4 4" />
        <circle cx="15" cy="15" r="4.2" fill="#4FD1C5" />
        <circle cx="24" cy="10" r="2.3" fill="#FFC01E" />
      </svg>
      )}
      {showBrand && (
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
      )}
      {showPartner && <ScholarLogicBadge />}
    </div>
  );
}

function ScreenShield({ active, message, title, action }) {
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
      <div style={{ fontSize: 48, marginBottom: 16 }}>{title ? "📷" : "🛡️"}</div>
      <h2 style={{ fontSize: 24, fontWeight: 700, margin: "0 0 12px", color: "#f8fafc" }}>
        {title || "Screen Shield Active"}
      </h2>
      <p style={{ fontSize: 15, color: "#94a3b8", maxWidth: 440, margin: 0, lineHeight: 1.6 }}>
        {message || "Screen capture or window blur was detected."}
      </p>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          style={{ marginTop: 20, padding: "10px 22px", borderRadius: 10, border: "none", background: "#22c55e", color: "#04130a", fontWeight: 800, fontSize: 14, cursor: "pointer" }}
        >
          {action.label}
        </button>
      )}
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

// Combines <input type="date"> and <input type="time"> values into a Date in the admin's local time zone.
function buildScheduledStart(dateValue, timeValue) {
  if (!dateValue || !timeValue) return null;
  const startsAt = new Date(`${dateValue}T${timeValue}`);
  return Number.isNaN(startsAt.getTime()) ? null : startsAt;
}

// Validates a schedule window; returns { startsAt, endsAt } or { error }.
function resolveScheduleWindow(startDate, startTime, endDate, endTime) {
  const startsAt = buildScheduledStart(startDate, startTime);
  if (!startsAt) return { error: "Pick both a start date and a start time to schedule the test." };
  // A start time that is now or already past opens the test right away.
  const startsNow = startsAt.getTime() <= Date.now();

  if (!endDate && !endTime) return { startsAt, endsAt: null, startsNow };
  const endsAt = buildScheduledStart(endDate || startDate, endTime);
  if (!endsAt) return { error: "Pick an end time (and end date if it is a different day)." };
  if (endsAt.getTime() <= startsAt.getTime()) return { error: "The end time must be after the start time." };
  if (endsAt.getTime() <= Date.now()) return { error: "The end time has already passed. Pick a later end date/time." };
  return { startsAt, endsAt, startsNow };
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
// A request that never got a response ("Failed to fetch": dropped/stale connection, brief network
// blip) is retried a couple of times so students don't have to click Run/Submit twice. A request
// with no answer after 90s (nginx gives up at 90s anyway) is abandoned and retried on a fresh
// connection instead of leaving "Submitting..." spinning. Error responses are not retried.
const REQUEST_ATTEMPT_TIMEOUT_MS = 90000;

async function fetchWithRetry(url, options = {}, retries = 2) {
  for (let attempt = 0; ; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_ATTEMPT_TIMEOUT_MS);
    try {
      return await fetch(url, { ...options, signal: controller.signal });
    } catch (error) {
      if (attempt >= retries) {
        throw error?.name === "AbortError"
          ? new Error("The server took too long to respond. Please try again.")
          : error;
      }
      await new Promise((resolve) => setTimeout(resolve, 600 * (attempt + 1)));
    } finally {
      clearTimeout(timer);
    }
  }
}

// Indian mobile number: 10 digits starting 6-9, optionally written with +91 / 91 / 0, spaces or
// dashes. Returns the 10 digits, or "" when it is not a valid mobile number (same rule as the server).
function normalizeMobileNumber(value) {
  let digits = String(value || "").replace(/[\s\-().]/g, "");
  if (digits.startsWith("+91")) digits = digits.slice(3);
  else if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  return /^[6-9]\d{9}$/.test(digits) ? digits : "";
}

// ── MCQ Excel import ────────────────────────────────────────────────────────
// Sheet layout (header row optional):  [question] | opA | opB | opC | opD | cort(op)
// e.g. "The ratio of boys to girls ... ?" | 15 | 18 | 20 | 25 | C(20)
// The answer is the option letter, optionally with the option's value in brackets: "C", "C(20)",
// "C) 20", "Option C". A bare value ("20") is matched to the option with that text. When both a
// letter and a value are given they must agree, otherwise the row is rejected so nothing is
// imported with a wrong answer. Optional extra columns: Marks, Category, Difficulty, Explanation.
const MCQ_OPTION_LETTERS = ["A", "B", "C", "D"];

function normalizeMcqText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function sameMcqValue(left, right) {
  const a = normalizeMcqText(left).toLowerCase();
  const b = normalizeMcqText(right).toLowerCase();
  if (a === b) return true;
  const numA = Number(a.replace(/,/g, ""));
  const numB = Number(b.replace(/,/g, ""));
  return a !== "" && b !== "" && Number.isFinite(numA) && Number.isFinite(numB) && numA === numB;
}

function findMcqColumns(rows) {
  for (let r = 0; r < Math.min(rows.length, 5); r += 1) {
    const cells = (rows[r] || []).map((cell) => normalizeMcqText(cell).toLowerCase());
    const optionCols = {};
    cells.forEach((cell, c) => {
      const m = cell.match(/^op(?:tion)?\s*[-_.]?\s*([a-d])$/);
      if (m) optionCols[m[1].toUpperCase()] = c;
    });
    if (Object.keys(optionCols).length < 2) continue;

    const findCol = (pattern) => cells.findIndex((cell) => pattern.test(cell));
    const used = new Set(Object.values(optionCols));
    const answer = findCol(/^(cor+e?c?t|cort|ans|answer|key|right)/);
    if (answer >= 0) used.add(answer);
    let question = findCol(/^(q|ques|question|questions|q\.?\s*no|statement)\b/);
    if (question < 0) {
      // Header cell above the questions is often empty (as in the template): use the first free column.
      question = cells.findIndex((_, c) => !used.has(c));
      if (question < 0) question = 0;
    }
    return {
      headerRow: r,
      question,
      options: MCQ_OPTION_LETTERS.map((letter) => (letter in optionCols ? optionCols[letter] : -1)),
      answer,
      marks: findCol(/^marks?$/),
      category: findCol(/^(category|topic|subject)$/),
      difficulty: findCol(/^(difficulty|level)$/),
      explanation: findCol(/^(explanation|solution)$/),
    };
  }
  // No header row: columns A-F are question, A, B, C, D, answer.
  return { headerRow: -1, question: 0, options: [1, 2, 3, 4], answer: 5, marks: -1, category: -1, difficulty: -1, explanation: -1 };
}

function parseMcqAnswer(rawAnswer, options) {
  const raw = normalizeMcqText(rawAnswer);
  if (!raw) return { error: "Correct answer is empty." };

  // Letter form: "C", "c", "(C)", "C)", "C.", "Option C", "opC", "C(20)", "C - 20", "C) 20".
  // The letter must stand alone, so an answer like "Delhi" is not read as option D.
  const m = raw.match(/^(?:op(?:tion)?\s*[-_.:]?\s*)?\(?\s*([a-d])\s*\)?(?=$|[\s(\[.:\-])\s*[.:\-]?\s*(.*)$/i);
  if (m) {
    const letter = m[1].toUpperCase();
    const index = MCQ_OPTION_LETTERS.indexOf(letter);
    const value = normalizeMcqText(m[2]).replace(/^[(\[]\s*/, "").replace(/\s*[)\]]$/, "");
    if (!normalizeMcqText(options[index])) return { error: `Answer is option ${letter}, but option ${letter} is empty.` };
    if (value && !sameMcqValue(value, options[index])) {
      const other = options.findIndex((opt) => sameMcqValue(value, opt));
      return {
        error: other >= 0
          ? `Answer "${raw}" does not match: option ${letter} is "${options[index]}", but "${value}" is option ${MCQ_OPTION_LETTERS[other]}.`
          : `Answer "${raw}" does not match: option ${letter} is "${options[index]}", not "${value}".`,
      };
    }
    return { index };
  }

  // Value form: the answer is the text of one option.
  const matches = options.map((opt, i) => (sameMcqValue(raw, opt) ? i : -1)).filter((i) => i >= 0);
  if (matches.length === 1) return { index: matches[0] };
  if (matches.length > 1) return { error: `Answer "${raw}" matches more than one option.` };
  return { error: `Answer "${raw}" is not an option letter (A-D) and does not match any option.` };
}

function parseMcqSheetRows(rows, defaults = {}) {
  const cols = findMcqColumns(rows);
  const cell = (row, c) => (c >= 0 ? normalizeMcqText(row[c]) : "");
  const results = [];

  rows.forEach((row, r) => {
    if (r <= cols.headerRow) return;
    if (!row || row.every((value) => !normalizeMcqText(value))) return;

    const statement = cell(row, cols.question);
    const rawOptions = cols.options.map((c) => cell(row, c));
    const lastFilled = rawOptions.reduce((last, opt, i) => (opt ? i : last), -1);
    const options = rawOptions.slice(0, lastFilled + 1);
    const problems = [];

    if (!statement) problems.push("Question text is empty.");
    if (options.filter(Boolean).length < 2) problems.push("Needs at least 2 options.");
    if (options.some((opt) => !opt)) problems.push("An option in the middle is empty (fill options in order A, B, C, D).");
    const seen = new Map();
    options.forEach((opt, i) => {
      const key = opt.toLowerCase();
      if (opt && seen.has(key)) problems.push(`Options ${MCQ_OPTION_LETTERS[seen.get(key)]} and ${MCQ_OPTION_LETTERS[i]} are the same ("${opt}").`);
      else seen.set(key, i);
    });

    let correctAnswerIndex = -1;
    const rawAnswer = cell(row, cols.answer);
    if (!problems.length) {
      const parsed = parseMcqAnswer(rawAnswer, options);
      if (parsed.error) problems.push(parsed.error);
      else correctAnswerIndex = parsed.index;
    }

    const marks = Number(cell(row, cols.marks));
    results.push({
      tempId: `xlsx_row_${r + 1}`,
      rowNumber: r + 1,
      title: statement.length > 80 ? `${statement.slice(0, 80)}...` : statement,
      statement,
      options,
      correctAnswerIndex,
      correctAnswer: correctAnswerIndex >= 0 ? options[correctAnswerIndex] : "",
      rawAnswer,
      marks: Number.isFinite(marks) && marks > 0 ? marks : (defaults.marks || 2),
      category: cell(row, cols.category) || defaults.category || "Other",
      sheetCategory: cell(row, cols.category),
      difficulty: cell(row, cols.difficulty) || defaults.difficulty || "Easy",
      explanation: cell(row, cols.explanation),
      problems,
      isMalformed: problems.length > 0,
    });
  });

  return results;
}

let sheetJsPromise = null;
function loadSheetJs() {
  if (window.XLSX) return Promise.resolve(window.XLSX);
  if (!sheetJsPromise) {
    sheetJsPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
      script.onload = () => (window.XLSX ? resolve(window.XLSX) : reject(new Error("Excel reader did not load.")));
      script.onerror = () => {
        sheetJsPromise = null;
        reject(new Error("Could not load the Excel reader. Check the internet connection and try again."));
      };
      document.head.appendChild(script);
    });
  }
  return sheetJsPromise;
}

// Phone detection during exams: TensorFlow.js + COCO-SSD (its "cell phone" class). The library is
// loaded by index.html with the page; the model is prepared as soon as a student logs in. If it
// cannot load, the exam continues and loading is retried in the background.
let phoneDetectorPromise = null;
function loadPhoneDetector() {
  if (!phoneDetectorPromise) {
    phoneDetectorPromise = (window.cocoSsd
      ? window.cocoSsd.load({ base: "lite_mobilenet_v2" })
      : Promise.reject(new Error("Phone detection library did not load.")))
      .catch((error) => {
        phoneDetectorPromise = null;
        throw error;
      });
  }
  return phoneDetectorPromise;
}

async function requestExecutionResult({ language, sourceCode, fnName, testCases }) {
  try {
    const response = await fetchWithRetry(buildBackendApiUrl("/api/run"), {
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
    if (/Failed to fetch|NetworkError|Load failed/i.test(message) && !IS_LOCAL_FRONTEND) {
      throw new Error("Could not reach the server. Check your internet connection and try again.");
    }
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
]);

const DEFAULT_STARTER_CODE = Object.freeze({
  python: `# Write your Python solution here\nimport sys\n\ndef main():\n    lines = sys.stdin.read().split()\n    if not lines:\n        return\n    if len(lines) >= 2:\n        a, b = int(lines[0]), int(lines[1])\n        print(a + b)\n\nif __name__ == "__main__":\n    main()\n`,
  javascript: `// Write your JavaScript solution here\nconst fs = require('fs');\n\nfunction main() {\n  const input = fs.readFileSync('/dev/stdin', 'utf-8').trim().split(/\\s+/);\n  if (input.length >= 2) {\n    const a = parseInt(input[0], 10);\n    const b = parseInt(input[1], 10);\n    console.log(a + b);\n  }\n}\n\nmain();\n`,
  java: `// Write your Java solution here\nimport java.util.Scanner;\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner scanner = new Scanner(System.in);\n        if (scanner.hasNextInt()) {\n            int a = scanner.nextInt();\n            int b = scanner.nextInt();\n            System.out.println(a + b);\n        }\n    }\n}\n`,
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
  const C = { text: "#d4d4d4", keyword: "#9d8cf2", fn: "#e6c07b", string: "#8cc79b", number: "#e8a36a", comment: "#6b6b6b", literal: "#e8a36a" };
  if (!line) return [{ text: "", color: C.text }];

  const isPython = language === "python";
  // Lines inside a /** ... */ block (or Python docstring markers are left as normal text).
  const trimmed = line.trimStart();
  if (!isPython && (/^\/\*/.test(trimmed) || /^\*(\s|\/|$)/.test(trimmed) || /^\*\//.test(trimmed))) {
    return [{ text: line, color: C.comment }];
  }

  const keywords = new Set([
    "def", "return", "if", "else", "elif", "for", "while", "import", "from", "as", "class", "try", "except",
    "finally", "with", "lambda", "in", "is", "not", "and", "or", "pass", "break", "continue", "yield", "global",
    "function", "const", "let", "var", "async", "await", "new", "this", "self", "typeof", "instanceof", "of",
    "switch", "case", "default", "throw", "catch", "do", "public", "private", "protected", "static", "final",
    "void", "int", "long", "double", "float", "char", "boolean", "byte", "short", "String", "extends",
    "implements", "interface", "package", "throws", "include", "using", "namespace",
  ]);
  const literals = new Set(["true", "false", "null", "undefined", "None", "True", "False", "NaN", "Infinity"]);

  const pieces = [];
  const push = (text, color) => {
    if (!text) return;
    const last = pieces[pieces.length - 1];
    if (last && last.color === color) last.text += text;
    else pieces.push({ text, color });
  };

  let i = 0;
  let previousWord = "";
  while (i < line.length) {
    const rest = line.slice(i);
    // Comments run to the end of the line.
    if ((!isPython && rest.startsWith("//")) || (isPython && rest[0] === "#")) {
      push(rest, C.comment);
      break;
    }
    // Strings.
    const quote = rest[0];
    if (quote === '"' || quote === "'" || (quote === "`" && !isPython)) {
      let j = 1;
      while (j < rest.length && rest[j] !== quote) j += rest[j] === "\\" ? 2 : 1;
      const text = rest.slice(0, Math.min(j + 1, rest.length));
      push(text, C.string);
      i += text.length;
      previousWord = "";
      continue;
    }
    // Numbers.
    const number = rest.match(/^\d+(\.\d+)?/);
    if (number && !/[A-Za-z_$]/.test(line[i - 1] || "")) {
      push(number[0], C.number);
      i += number[0].length;
      continue;
    }
    // Words.
    const word = rest.match(/^[A-Za-z_$][\w$]*/);
    if (word) {
      const value = word[0];
      const after = line.slice(i + value.length);
      let color = C.text;
      if (keywords.has(value)) color = C.keyword;
      else if (literals.has(value)) color = C.literal;
      else if (/^\s*\(/.test(after) || previousWord === "def" || previousWord === "function") color = C.fn;
      push(value, color);
      previousWord = value;
      i += value.length;
      continue;
    }
    // Anything else (spaces, punctuation) stays plain.
    push(rest[0], C.text);
    if (!/\s/.test(rest[0])) previousWord = "";
    i += 1;
  }
  return pieces;
}

// ── IDE EDITOR ───────────────────────────────────────────────────────────────
// Textarea over a highlighted copy of the code, with a line-number gutter, the current line
// highlighted, and indent guide lines (one vertical line per indentation level, like VS Code).
// Lines do not wrap, so every line number stays level with its line.
const EDITOR_LINE_HEIGHT = 21;
const EDITOR_PADDING_TOP = 16;
const EDITOR_TEXT_LEFT = 56;
const EDITOR_FONT = "'JetBrains Mono','Fira Code',Consolas,monospace";

function leadingColumns(line) {
  let columns = 0;
  for (const char of line) {
    if (char === " ") columns += 1;
    else if (char === "\t") columns += 4 - (columns % 4);
    else break;
  }
  return columns;
}

function computeIndentGuides(lines, unit) {
  const levels = lines.map((line) => (line.trim() ? Math.floor(leadingColumns(line) / unit) : null));
  // A blank line inside a block keeps the guides of the lines around it.
  const nextLevels = new Array(lines.length).fill(0);
  let next = 0;
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    nextLevels[index] = next;
    if (levels[index] !== null) next = levels[index];
  }
  let previous = 0;
  return levels.map((level, index) => {
    if (level !== null) {
      previous = level;
      return level;
    }
    return Math.min(previous, nextLevels[index]);
  });
}

function CodeEditor({ value, onChange, language, onKeyDown, textareaRef, errorLines = null, minHeight = 0, ariaLabel = "Code editor" }) {
  const [scroll, setScroll] = useState({ top: 0, left: 0 });
  const [activeLine, setActiveLine] = useState(0);
  const fallbackRef = useRef(null);
  const inputRef = textareaRef || fallbackRef;
  const code = String(value || "");
  const lines = code.split("\n");
  const indentUnit = language === "javascript" ? 2 : 4;
  const guides = computeIndentGuides(lines, indentUnit);
  const currentLine = Math.min(activeLine, lines.length - 1);

  const syncActiveLine = (element) => {
    if (!element) return;
    const caret = typeof element.selectionStart === "number" ? element.selectionStart : 0;
    setActiveLine(element.value.slice(0, caret).split("\n").length - 1);
  };

  return (
    <div style={{ flex: 1, position: "relative", overflow: "hidden", minHeight }}>
      {/* Current line */}
      <div aria-hidden="true" style={{ position: "absolute", left: 0, right: 0, top: EDITOR_PADDING_TOP + currentLine * EDITOR_LINE_HEIGHT - scroll.top, height: EDITOR_LINE_HEIGHT, background: "rgba(255,255,255,0.035)", borderTop: "1px solid rgba(255,255,255,0.04)", borderBottom: "1px solid rgba(255,255,255,0.04)", boxSizing: "border-box", pointerEvents: "none" }} />

      {/* Highlighted code + indent guides */}
      <div aria-hidden="true" style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
        <div style={{ position: "absolute", top: 0, left: 0, minWidth: "100%", padding: `${EDITOR_PADDING_TOP}px 16px ${EDITOR_PADDING_TOP}px ${EDITOR_TEXT_LEFT}px`, transform: `translate(${-scroll.left}px, ${-scroll.top}px)`, whiteSpace: "pre", color: "#d4d4d4", fontFamily: EDITOR_FONT, fontSize: 13.5, lineHeight: `${EDITOR_LINE_HEIGHT}px`, tabSize: 4, MozTabSize: 4, boxSizing: "border-box" }}>
          {lines.map((line, lineIndex) => (
            <div key={lineIndex} style={{ position: "relative", height: EDITOR_LINE_HEIGHT }}>
              {Array.from({ length: guides[lineIndex] }, (_, level) => (
                <span key={`g${level}`} style={{ position: "absolute", top: 0, bottom: 0, left: `${level * indentUnit}ch`, borderLeft: `1px solid ${lineIndex === currentLine && level === guides[lineIndex] - 1 ? "rgba(167,139,250,0.55)" : "rgba(148,163,184,0.17)"}` }} />
              ))}
              {highlightCodeLine(line, language).map((piece, pieceIndex) => (
                <span key={pieceIndex} style={{ color: piece.color, position: "relative" }}>{piece.text}</span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Line numbers */}
      <div aria-hidden="true" style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 44, background: "#141414", borderRight: "1px solid #232323", overflow: "hidden", zIndex: 1, pointerEvents: "none", userSelect: "none" }}>
        <div style={{ paddingTop: EDITOR_PADDING_TOP, transform: `translateY(${-scroll.top}px)` }}>
          {lines.map((_, lineIndex) => {
            const lineNumber = lineIndex + 1;
            const hasError = Boolean(errorLines && errorLines.has(lineNumber));
            const isCurrent = lineIndex === currentLine;
            return (
              <div key={lineIndex} style={{ height: EDITOR_LINE_HEIGHT, lineHeight: `${EDITOR_LINE_HEIGHT}px`, paddingRight: 8, display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 3, fontFamily: EDITOR_FONT, fontSize: 12, color: hasError ? "#ef4444" : isCurrent ? "#a3a3a3" : "#555555", fontWeight: hasError || isCurrent ? 700 : 400 }}>
                {hasError && <span style={{ fontSize: 9 }}>•</span>}
                <span>{lineNumber}</span>
              </div>
            );
          })}
        </div>
      </div>

      <textarea
        ref={inputRef}
        value={code}
        aria-label={ariaLabel}
        wrap="off"
        spellCheck={false}
        autoCapitalize="off"
        autoComplete="off"
        autoCorrect="off"
        onChange={(e) => { onChange(e.target.value); syncActiveLine(e.target); }}
        onScroll={(e) => setScroll({ top: e.currentTarget.scrollTop, left: e.currentTarget.scrollLeft })}
        onKeyDown={onKeyDown}
        onKeyUp={(e) => syncActiveLine(e.currentTarget)}
        onClick={(e) => syncActiveLine(e.currentTarget)}
        onSelect={(e) => syncActiveLine(e.currentTarget)}
        onFocus={(e) => syncActiveLine(e.currentTarget)}
        style={{ position: "absolute", inset: 0, zIndex: 2, paddingLeft: EDITOR_TEXT_LEFT, paddingTop: EDITOR_PADDING_TOP, paddingRight: 16, paddingBottom: EDITOR_PADDING_TOP, background: "transparent", color: "transparent", caretColor: "#e8873a", border: "none", outline: "none", resize: "none", fontFamily: EDITOR_FONT, fontSize: 13.5, lineHeight: `${EDITOR_LINE_HEIGHT}px`, tabSize: 4, MozTabSize: 4, width: "100%", height: "100%", boxSizing: "border-box", whiteSpace: "pre", overflow: "auto", scrollbarWidth: "thin", scrollbarColor: "#333 #141414" }}
      />
    </div>
  );
}

// ── PRACTICE IDE (PLAYGROUND) ────────────────────────────────────────────────
const PLAYGROUND_STORAGE_KEY = "devorbit.playground.v1";
const PLAYGROUND_LANGUAGES = Object.freeze([
  { id: "python", label: "Python 3" },
  { id: "javascript", label: "JavaScript (Node.js)" },
  { id: "java", label: "Java" },
]);
const PLAYGROUND_STARTER_CODE = Object.freeze({
  python: "# DevOrbit IDE: write any program, type its input on the right, and press Run (Ctrl+Enter).\nimport sys\n\n\ndef main():\n    name = sys.stdin.read().strip() or \"World\"\n    print(\"Hello, \" + name + \"!\")\n\n\nif __name__ == \"__main__\":\n    main()\n",
  javascript: "// DevOrbit IDE: write any program, type its input on the right, and press Run (Ctrl+Enter).\nconst input = require(\"fs\").readFileSync(0, \"utf-8\").trim();\n\nfunction main() {\n  const name = input || \"World\";\n  console.log(\"Hello, \" + name + \"!\");\n}\n\nmain();\n",
  java: "// DevOrbit IDE: the class must be named Main. Press Run (Ctrl+Enter).\nimport java.util.Scanner;\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner scanner = new Scanner(System.in);\n        String name = scanner.hasNextLine() ? scanner.nextLine().trim() : \"\";\n        if (name.isEmpty()) {\n            name = \"World\";\n        }\n        System.out.println(\"Hello, \" + name + \"!\");\n    }\n}\n",
});

function loadPlaygroundDraft() {
  const fallback = { lang: "python", codes: {}, stdin: "" };
  try {
    const parsed = JSON.parse(window.localStorage?.getItem(PLAYGROUND_STORAGE_KEY) || "null");
    if (!parsed || typeof parsed !== "object") return fallback;
    return {
      lang: PLAYGROUND_LANGUAGES.some((item) => item.id === parsed.lang) ? parsed.lang : "python",
      codes: parsed.codes && typeof parsed.codes === "object" ? parsed.codes : {},
      stdin: typeof parsed.stdin === "string" ? parsed.stdin : "",
    };
  } catch {
    return fallback;
  }
}

// ── DAILY STREAK CALENDAR ────────────────────────────────────────────────────
const STREAK_COLORS = ["#1a1d29", "#5b2b0b", "#9a4710", "#e0701a", "#ffb547"];
const CALENDAR_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function streakColor(count) {
  if (!count) return STREAK_COLORS[0];
  if (count === 1) return STREAK_COLORS[1];
  if (count <= 3) return STREAK_COLORS[2];
  if (count <= 6) return STREAK_COLORS[3];
  return STREAK_COLORS[4];
}

function StreakCalendar({ calendar, today, weeks = 26, cell = 12, gap = 3 }) {
  if (!today) return null;
  const DAY_MS = 24 * 60 * 60 * 1000;
  const todayMs = Date.parse(`${today}T00:00:00Z`);
  if (!Number.isFinite(todayMs)) return null;
  const weekEndMs = todayMs + (6 - new Date(todayMs).getUTCDay()) * DAY_MS;
  const startMs = weekEndMs - (weeks * 7 - 1) * DAY_MS;
  const columns = Array.from({ length: weeks }, (_, week) => Array.from({ length: 7 }, (__, day) => {
    const time = startMs + (week * 7 + day) * DAY_MS;
    const key = new Date(time).toISOString().slice(0, 10);
    return { key, time, count: Number(calendar?.[key] || 0), future: time > todayMs };
  }));
  const monthLabels = columns.map((days, week) => {
    const month = new Date(days[0].time).getUTCMonth();
    const previousMonth = week > 0 ? new Date(columns[week - 1][0].time).getUTCMonth() : null;
    return week === 0 || month !== previousMonth ? CALENDAR_MONTHS[month] : "";
  });

  return (
    <div style={{ overflowX: "auto", paddingBottom: 4 }}>
      <div style={{ display: "inline-flex", flexDirection: "column", gap: 6 }}>
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${weeks}, ${cell}px)`, gap, fontSize: 10, color: "#7a7f9e", height: 12 }}>
          {monthLabels.map((label, index) => <div key={index} style={{ whiteSpace: "nowrap", overflow: "visible" }}>{label}</div>)}
        </div>
        <div style={{ display: "grid", gridTemplateRows: `repeat(7, ${cell}px)`, gridAutoFlow: "column", gridAutoColumns: `${cell}px`, gap }}>
          {columns.flat().map((day) => (
            <div
              key={day.key}
              title={day.future ? "" : `${day.count} submission${day.count === 1 ? "" : "s"} on ${day.key}`}
              style={{ width: cell, height: cell, borderRadius: 3, background: day.future ? "transparent" : streakColor(day.count), outline: day.key === today ? "1px solid #ffd089" : "none", outlineOffset: 1 }}
            />
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4, justifyContent: "flex-end", fontSize: 10, color: "#7a7f9e" }}>
          <span style={{ marginRight: 4 }}>Less</span>
          {STREAK_COLORS.map((color) => <span key={color} style={{ width: 10, height: 10, borderRadius: 2, background: color, display: "inline-block" }} />)}
          <span style={{ marginLeft: 4 }}>More</span>
        </div>
      </div>
    </div>
  );
}

function formatTimeLeft(targetIso) {
  const ms = new Date(targetIso).getTime() - Date.now();
  if (!Number.isFinite(ms) || ms <= 0) return "";
  const days = Math.floor(ms / 86400000);
  const hours = Math.floor((ms % 86400000) / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${Math.max(1, minutes)}m`;
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
    { id: "monitor", label: "Live monitor" },
    { id: "questions", label: "Question uploads" },
    { id: "reports", label: "Reports" },
    { id: "malpractice", label: "Malpractice" },
    { id: "leaderboard", label: "Leaderboard" },
    { id: "challenge", label: "Monthly challenge" },
    { id: "feedback", label: "Feedback" },
    { id: "students", label: "Students" },
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
  const [authPhone, setAuthPhone]             = useState("");
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
  const [portalMessage, setPortalMessage]     = useState("");
  const [portalError, setPortalError]         = useState("");
  const [adminSyncingProblems, setAdminSyncingProblems] = useState(false);
  const [adminCreatingTest, setAdminCreatingTest] = useState(false);
  const [adminStartingTest, setAdminStartingTest] = useState(false);
  const [adminSchedulingTest, setAdminSchedulingTest] = useState(false);
  const [adminScheduleDate, setAdminScheduleDate] = useState("");
  const [adminScheduleTime, setAdminScheduleTime] = useState("");
  const [adminScheduleEndDate, setAdminScheduleEndDate] = useState("");
  const [adminScheduleEndTime, setAdminScheduleEndTime] = useState("");
  const [nextScheduledStartAt, setNextScheduledStartAt] = useState(null);
  const [linkTestId, setLinkTestId] = useState(TEST_LINK_ID);
  const [linkTestInfo, setLinkTestInfo] = useState(null);
  const [linkTestError, setLinkTestError] = useState("");
  const [linkAutoStarted, setLinkAutoStarted] = useState(false);
  const [portalRefreshTick, setPortalRefreshTick] = useState(0);
  const [adminStoppingTest, setAdminStoppingTest] = useState(false);
  const [adminCurrentTest, setAdminCurrentTest] = useState(defaultAdminTest);
  const [previousTests, setPreviousTests]     = useState(defaultPreviousTests);
  const [selectedPreviousTest, setSelectedPreviousTest] = useState(defaultPreviousTests[0]);
  const [leaderboard, setLeaderboard]         = useState([]);
  const [activeUsers, setActiveUsers]         = useState(defaultActiveUsers);
  const [registeredStudents, setRegisteredStudents] = useState([]);
  const [participantsCount, setParticipantsCount] = useState(defaultActiveUsers.length);
  const [adminTab, setAdminTab]               = useState("overview");
  // Live Monitor tab: which test is watched, its latest data, and the card filter/search.
  const [monitorTestId, setMonitorTestId]     = useState("");
  const [monitorData, setMonitorData]         = useState(null);
  const [monitorError, setMonitorError]       = useState("");
  const [monitorFilter, setMonitorFilter]     = useState("all");
  const [monitorSearch, setMonitorSearch]     = useState("");
  // Student Activity window (opened from the admin Leaderboard / Student List).
  const [activityUserId, setActivityUserId]   = useState("");
  const [activityData, setActivityData]       = useState(null);
  const [activityError, setActivityError]     = useState("");
  const [activityTab, setActivityTab]         = useState("problems");
  const [activityCode, setActivityCode]       = useState(null);
  const [adminTimerSeconds, setAdminTimerSeconds] = useState(defaultAdminTest.duration * 60);
  const [adminWarning, setAdminWarning]       = useState("");
  const [attendanceTableOpen, setAttendanceTableOpen] = useState(false);
  const [pendingReportScroll, setPendingReportScroll] = useState(false);
  const [deletingTestId, setDeletingTestId] = useState(null);
  const adminReportRef = useRef(null);
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
  // Students see a thank-you screen after a test; scores stay in the admin reports only.
  const [thankYouTest, setThankYouTest] = useState(null);
  const [feedbackRating, setFeedbackRating] = useState(0);
  const [feedbackComment, setFeedbackComment] = useState("");
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [feedbackError, setFeedbackError] = useState("");
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
  const [mcqImportCategory, setMcqImportCategory] = useState("Other");
  const [mcqImportFileName, setMcqImportFileName] = useState("");

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
    scheduleDate: "",
    scheduleTime: "",
    scheduleEndDate: "",
    scheduleEndTime: "",
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
  const [filterTopic, setFilterTopic]         = useState("All");
  const [weeklyGoal, setWeeklyGoal]           = useState(() => {
    try {
      const saved = Number(window.localStorage.getItem("dv-weekly-goal"));
      return Number.isInteger(saved) && saved >= 1 && saved <= 20 ? saved : 3;
    } catch (_) {
      return 3;
    }
  });
  const [goalEditing, setGoalEditing]         = useState(false);
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
  // True while a student is in a test but not yet in fullscreen (e.g. the camera prompt closed it).
  const [contestNeedsFullscreen, setContestNeedsFullscreen] = useState(false);
  const [contestWarningCount, setContestWarningCount] = useState(0);
  const [contestWarningReason, setContestWarningReason] = useState("");
  const [contestInstructionsOpen, setContestInstructionsOpen] = useState(false);
  const [contestInstructionsAccepted, setContestInstructionsAccepted] = useState(false);
  const [contestCameraStatus, setContestCameraStatus] = useState("idle");
  const [contestCameraError, setContestCameraError] = useState("");
  const [contestCameraStream, setContestCameraStream] = useState(null);
  const [contestSessionEndsAt, setContestSessionEndsAt] = useState(null);
  const [contestSessionProgress, setContestSessionProgress] = useState({});
  const [contestResult, setContestResult] = useState(null);
  const [finalSubmitConfirmOpen, setFinalSubmitConfirmOpen] = useState(false);
  const [startExamModalOpen, setStartExamModalOpen] = useState(false);
  const [exitExamConfirmModalOpen, setExitExamConfirmModalOpen] = useState(false);
  const [pendingNavigationAction, setPendingNavigationAction] = useState(null);
  const [showAuthPassword, setShowAuthPassword] = useState(false);
  const [userSubmissions, setUserSubmissions] = useState([]);
  // Daily practice streak, monthly challenge, and the practice IDE.
  const [streakInfo, setStreakInfo] = useState(null);
  const [challengeData, setChallengeData] = useState(null);
  const [challengeLoading, setChallengeLoading] = useState(false);
  const [challengeError, setChallengeError] = useState("");
  const [playgroundDraft, setPlaygroundDraft] = useState(loadPlaygroundDraft);
  const [playgroundRunning, setPlaygroundRunning] = useState(false);
  const [playgroundResult, setPlaygroundResult] = useState(null);
  const playgroundTextareaRef = useRef(null);
  const [adminChallenges, setAdminChallenges] = useState([]);
  const [adminChallengesLoading, setAdminChallengesLoading] = useState(false);
  const [adminChallengeForm, setAdminChallengeForm] = useState(null);
  const [adminChallengeSaving, setAdminChallengeSaving] = useState(false);
  const [adminChallengeMessage, setAdminChallengeMessage] = useState(null);
  const [adminChallengeProblemSearch, setAdminChallengeProblemSearch] = useState("");
  const [adminChallengeDetail, setAdminChallengeDetail] = useState(null);
  const [adminEmailStatus, setAdminEmailStatus] = useState(null);
  const [adminEmailForm, setAdminEmailForm] = useState({ subject: "", message: "", testTo: "" });
  const [adminEmailBusy, setAdminEmailBusy] = useState(false);
  const [adminEmailMessage, setAdminEmailMessage] = useState(null);
  const [adminEmailSelected, setAdminEmailSelected] = useState([]);
  const [adminEmailPickerSearch, setAdminEmailPickerSearch] = useState("");
  const [adminEmailDepartment, setAdminEmailDepartment] = useState("");
  const [adminEmailHideSent, setAdminEmailHideSent] = useState(true);
  const [adminEmailConfirm, setAdminEmailConfirm] = useState(false);
  const [adminEmailResult, setAdminEmailResult] = useState(null);
  const [adminEmailSending, setAdminEmailSending] = useState(null);
  const [adminFeedback, setAdminFeedback] = useState(null);
  const [adminFeedbackLoading, setAdminFeedbackLoading] = useState(false);
  const [adminFeedbackError, setAdminFeedbackError] = useState("");
  const [adminFeedbackNewCount, setAdminFeedbackNewCount] = useState(0);
  const [adminFeedbackFilter, setAdminFeedbackFilter] = useState("all");
  const [adminFeedbackSearch, setAdminFeedbackSearch] = useState("");
  const [consoleOpen, setConsoleOpen]         = useState(false);
  const [editorScrollTop, setEditorScrollTop] = useState(0);
  const [errorBanner, setErrorBanner]         = useState(null);
  const [screenShield, setScreenShield]       = useState(false);
  const [shieldMessage, setShieldMessage]     = useState("Screen capture is disabled in this demo.");
  // Exam camera proctoring: the exam stays blurred while the camera is off/covered or a phone is in view.
  const [cameraIssue, setCameraIssue]         = useState("");
  const [phoneDetected, setPhoneDetected]     = useState(false);
  const [faceMissing, setFaceMissing]         = useState(false);
  const [aiCheckStatus, setAiCheckStatus]     = useState("loading");
  const proctorBlock = !contestEntered
    ? null
    : cameraIssue
      ? {
        title: "Camera Required",
        message: `${cameraIssue} The test is hidden until your camera is on. Your timer keeps running.`,
        action: { label: "Turn camera on", onClick: () => requestContestCameraPermission() },
      }
      : phoneDetected
        ? {
          title: "Phone Detected",
          message: "A mobile phone was detected on camera. Put it away to continue. This has been recorded. Your timer keeps running.",
          action: null,
        }
        : faceMissing
          ? {
            title: "Face Not Visible",
            message: "Your face is not visible on camera. Sit facing the camera and keep it uncovered to continue. Your timer keeps running.",
            action: null,
          }
          : null;
  const shieldActive = screenShield || Boolean(proctorBlock);
  const shieldActiveMessage = proctorBlock ? proctorBlock.message : shieldMessage;
  const shieldTitle = proctorBlock ? proctorBlock.title : undefined;
  const shieldAction = proctorBlock ? proctorBlock.action : null;
  const textareaRef = useRef(null);
  const adminTextareaRef = useRef(null);
  const contestCameraPreviewRef = useRef(null);
  const shieldTimerRef = useRef(null);
  // Last downloaded problem bank; the background refreshes reuse it for 2 minutes.
  const problemBankCacheRef = useRef({ problems: [], loadedAt: 0 });
  const collectExamAnswersRef = useRef(null);
  // Live Monitor check-in: the student's progress/flags, and a small snapshot from the exam camera.
  const liveProgressRef = useRef(null);
  const cameraSnapshotRef = useRef(null);
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
    const response = await fetchWithRetry(buildBackendApiUrl(path), {
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
        setAuthRole(DEFAULT_AUTH_ROLE);
        setAuthModalOpen(true);
        throw new Error("Please log in to submit your code.");
      }
      throw new Error(data.error || "Request failed.");
    }

    return data;
  };

  const isProblemBankFresh = () => problemBankCacheRef.current.problems.length > 0
    && Date.now() - problemBankCacheRef.current.loadedAt < 120000;

  const loadProblemBank = async () => {
    setProblemBankLoading(true);

    try {
      const data = await performApiRequest("/api/problems?includeContent=1&includeAll=1");
      const mappedProblems = Array.isArray(data.problems)
        ? data.problems.map(mapProblemRecord).filter(Boolean)
        : [];
      setProblemBank(mappedProblems);
      problemBankCacheRef.current = { problems: mappedProblems, loadedAt: Date.now() };
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

  // `background`: the 20s auto-refresh, which may reuse the problem bank downloaded in the last 2
  // minutes. Every other call (after adding, editing or importing questions) downloads it fresh.
  const loadAdminPortalData = async (preferredAssignmentId = adminCurrentTest?.id, { background = false } = {}) => {
    // The 20s background refresh updates quietly; only the first load and admin actions show the banner.
    if (!background) setAdminAssignmentsLoading(true);
    setPortalError("");

    try {
      // Everything loads at the same time; the problem bank is reused for 2 minutes.
      const [problems, testsData, studentsData, leaderboardData] = await Promise.all([
        background && isProblemBankFresh() ? problemBankCacheRef.current.problems : loadProblemBank(),
        performApiRequest("/api/tests"),
        performApiRequest("/api/auth/students"),
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
        id: student.id,
        name: student.name || student.email,
        department: student.department || "Department pending",
        status: student.lastLoginAt ? "Logged In" : "Registered",
        email: student.email,
        usn: student.usn || "--",
        phone: student.phone || "",
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
      const [assignmentData, leaderboardData, submissionData, profileData, streakData, currentChallengeData] = await Promise.all([
        performApiRequest("/api/tests/active"),
        performApiRequest("/api/submissions/leaderboard"),
        performApiRequest(`/api/submissions/user/${currentUser.id}`),
        performApiRequest("/api/auth/me"),
        // Extras: a failure here must never break the portal.
        performApiRequest("/api/submissions/streak").catch(() => null),
        performApiRequest("/api/challenges/current").catch(() => null),
      ]);
      if (streakData) setStreakInfo(streakData);
      if (currentChallengeData) setChallengeData(currentChallengeData);

      // A student only sees the test from the link they opened, never the other live tests.
      const liveAssignments = (Array.isArray(assignmentData.assignments)
        ? assignmentData.assignments.map(mapAssignmentRecord).filter(Boolean)
        : []
      ).filter((assignment) => STUDENT_TEST_ID && sameValue(assignment.id, STUDENT_TEST_ID));
      const defaultAssignment = liveAssignments[0] || null;
      const availableLiveAssignments = liveAssignments.length
        ? liveAssignments
        : (defaultAssignment ? [defaultAssignment] : []);
      const assignment = (linkTestId && liveAssignments.find((item) => sameValue(item.id, linkTestId)))
        || liveAssignments.find((item) => sameValue(item.id, activeAssignment?.id))
        || defaultAssignment
        || availableLiveAssignments[0]
        || null;
      setNextScheduledStartAt(assignmentData.nextStartsAt || null);
      setActiveAssignment(assignment);
      const assignmentAlreadyAttempted = Boolean(assignment?.attempt && assignment.attempt.status !== "IN_PROGRESS");
      if (assignment && (assignment.status === "LIVE" || assignment.status === "live" || assignment.active) && !contestEntered && !assignmentAlreadyAttempted && !sameValue(assignment.id, linkTestId)) {
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

  useEffect(() => {
    try {
      const rawSession = window.localStorage?.getItem(AUTH_SESSION_STORAGE_KEY);
      if (!rawSession) {
        if (IS_ADMIN_ENTRY) {
          setAuthMode("login");
          setAuthRole("admin");
          setAuthModalOpen(true);
        } else if (TEST_LINK_ID) {
          setAuthMode("login");
          setAuthRole("student");
          setAuthModalOpen(true);
        }
        return;
      }

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

    if (adminCurrentTest.status === "SCHEDULED") {
      setAdminTimerSeconds((adminCurrentTest.duration || 60) * 60);
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
    if (!pendingReportScroll || !adminTestReport) return;
    adminReportRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    setPendingReportScroll(false);
  }, [pendingReportScroll, adminTestReport]);

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
    let armed = Boolean(document.fullscreenElement) && !document.hidden;
    let warnings = 0;
    setContestNeedsFullscreen(!armed);
    setContestWarningCount(0);
    setContestWarningReason("");

    const logProctoringEvent = (eventType, reason, warningNumber) => {
      if (!authToken || !currentUser.id || !activeContestAssignment?.id) return;
      performApiRequest("/api/proctoring/events", {
        method: "POST",
        body: JSON.stringify({
          assignmentId: activeContestAssignment.id,
          eventType,
          metadata: { reason, warning: warningNumber, maxWarnings: MAX_CONTEST_WARNINGS },
        }),
      }).catch(() => {});
    };

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

    const handleViolation = (eventType, reason) => {
      if (!armed || ending) return;
      armed = false;
      warnings += 1;
      setContestWarningCount(warnings);
      setContestWarningReason(reason);
      logProctoringEvent(eventType, reason, warnings);

      if (warnings >= MAX_CONTEST_WARNINGS) {
        endForSecurity(`Ended after ${MAX_CONTEST_WARNINGS} warnings. Last: ${reason}`);
        return;
      }
      setContestNeedsFullscreen(true);
    };

    const ensureContestFocus = () => {
      const hidden = document.hidden;
      const fullscreenActive = Boolean(document.fullscreenElement);

      if (!armed) {
        if (fullscreenActive && !hidden) {
          armed = true;
          setContestNeedsFullscreen(false);
        } else {
          setContestNeedsFullscreen(true);
        }
        return;
      }

      const shouldLock = hidden || !fullscreenActive;

      setContestSecurityLocked(shouldLock);

      if (shouldLock) {
        handleViolation(hidden ? "TAB_SWITCH" : "FULLSCREEN_EXIT", hidden ? "You switched to another tab or window." : "You left fullscreen mode.");
      } else {
        setScreenShield(false);
      }
    };

    const handleBlur = () => {
      if (!armed) return;
      handleViolation("WINDOW_BLUR", "You switched away from the test window.");
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

      if (armed && (key === "Escape" || key === "F11" || key === "Meta" || key === "OS")) {
        e.preventDefault();
        handleViolation("SUSPICIOUS_SHORTCUT", `You pressed a restricted key (${key === "Meta" || key === "OS" ? "Windows" : key}).`);
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
      setContestNeedsFullscreen(false);
    };
  }, [contestEntered]);

  useEffect(() => {
    if (adminTab === "reports") {
      loadReportsOverview();
    } else if (adminTab === "malpractice") {
      loadProctoringReports();
    }
  }, [adminTab]);

  // Live Monitor: refresh the watched test every 15s while the tab is open.
  useEffect(() => {
    if (adminTab !== "monitor" || !authToken) return undefined;
    const liveTests = adminAssignments.filter((assignment) => assignment.status === "LIVE");
    const testId = monitorTestId || liveTests[0]?.id || "";
    if (!monitorTestId && testId) setMonitorTestId(testId);
    if (!testId) {
      setMonitorData(null);
      return undefined;
    }

    let cancelled = false;
    let loading = false;
    const loadMonitor = async () => {
      if (cancelled || loading) return;
      loading = true;
      try {
        const data = await performApiRequest(`/api/admin/reports/monitor/${testId}`);
        if (!cancelled) {
          setMonitorData(data);
          setMonitorError("");
        }
      } catch (error) {
        if (!cancelled) setMonitorError(error.message || "Could not load the live monitor.");
      } finally {
        loading = false;
      }
    };
    loadMonitor();
    const interval = setInterval(loadMonitor, 15000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [adminTab, monitorTestId, authToken, adminAssignments.filter((assignment) => assignment.status === "LIVE").map((assignment) => assignment.id).join(",")]);

  useEffect(() => {
    if (!authToken || !currentUser.id) {
      return undefined;
    }

    let cancelled = false;
    let loading = false;
    // Skip a refresh while the previous one is still running. Overlapping refreshes on a slow
    // server fill the browser's few connections and leave Run/Submit/Final Submit queued behind them.
    const loadPortal = async () => {
      if (cancelled || loading) return;
      loading = true;
      try {
        await refreshPortal();
      } finally {
        loading = false;
      }
    };
    const refreshPortal = async () => {

      if (currentUser.role === "admin") {
        await loadAdminPortalData(undefined, { background: true });
        return;
      }

      // During an exam only check that the test is still live. The full refresh (problem bank,
      // leaderboard, submissions) from every student at once is what stalled exam submissions.
      if (contestEntered) {
        const data = await performApiRequest("/api/tests/active").catch(() => null);
        if (cancelled || !data) return;
        const liveIds = [data.assignment, ...(Array.isArray(data.assignments) ? data.assignments : [])]
          .filter(Boolean)
          .map((item) => item.id);
        if (activeContestAssignment?.id && !liveIds.some((id) => sameValue(id, activeContestAssignment.id))) {
          finishContest("Ended because the admin stopped the test.");
        }
        return;
      }

      // The problem bank rarely changes, so re-download it at most every 2 minutes.
      const loadedProblems = isProblemBankFresh()
        ? problemBankCacheRef.current.problems
        : await loadProblemBank().catch(() => []);
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
    // Students refresh every 45s (hundreds of them poll at once); a scheduled test still opens on
    // time through nextScheduledStartAt, and the exam itself is unaffected.
    const interval = setInterval(loadPortal, currentUser.role === "admin" ? 20000 : 45000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [authToken, currentUser.id, currentUser.role, portalRefreshTick, contestEntered]);

  // Autosave + Live Monitor check-in: while the exam is open, every 30s send the student's progress,
  // camera flags and a small camera snapshot for the admin's Live Monitor, plus the answers when
  // they changed (so they are kept even if the browser closes or Final Submit fails).
  useEffect(() => {
    const testId = activeAssignment?.id;
    if (!contestEntered || !testId || !authToken || currentUser.role === "admin") return undefined;

    let cancelled = false;
    let saving = false;
    let lastSaved = "";
    const saveAnswers = async () => {
      if (cancelled || saving || !collectExamAnswersRef.current) return;
      const answers = collectExamAnswersRef.current();
      const answersJson = JSON.stringify(answers);
      const payload = {};
      if (liveProgressRef.current) payload.progress = liveProgressRef.current();
      const snapshot = cameraSnapshotRef.current ? cameraSnapshotRef.current() : null;
      if (snapshot) payload.snapshot = snapshot;
      if (answersJson !== lastSaved) Object.assign(payload, answers);
      saving = true;
      try {
        await performApiRequest(`/api/tests/${testId}/attempts/draft`, { method: "POST", body: JSON.stringify(payload) });
        lastSaved = answersJson;
      } catch {
      } finally {
        saving = false;
      }
    };

    // First check-in shortly after the exam opens (the camera picture needs a moment to start).
    const firstCheckIn = setTimeout(saveAnswers, 3000);
    const interval = setInterval(saveAnswers, 30000);
    return () => {
      cancelled = true;
      clearTimeout(firstCheckIn);
      clearInterval(interval);
    };
  }, [contestEntered, activeAssignment?.id, authToken, currentUser.role]);

  // Prepare the phone detection model as soon as a student is logged in, so it is ready before
  // they start an exam.
  useEffect(() => {
    if (!authToken || !currentUser.id || currentUser.role === "admin") return;
    loadPhoneDetector().catch(() => {});
  }, [authToken, currentUser.id, currentUser.role]);

  // Camera proctoring while the exam is open: every 2s check the camera is live and not covered,
  // and look for a phone in the picture. Either one blurs the exam (see proctorBlock) until fixed,
  // and each new incident is logged for the malpractice report.
  useEffect(() => {
    if (!contestEntered || currentUser.role === "admin") {
      setCameraIssue("");
      setPhoneDetected(false);
      setFaceMissing(false);
      return undefined;
    }
    if (!contestCameraStream) {
      setCameraIssue("Your camera is off.");
      return undefined;
    }
    setPhoneDetected(false);
    setFaceMissing(false);

    let cancelled = false;
    const testId = activeAssignment?.id;
    const track = contestCameraStream.getVideoTracks()[0] || null;
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.srcObject = contestCameraStream;
    video.play().catch(() => {});
    const canvas = document.createElement("canvas");
    canvas.width = 32;
    canvas.height = 24;
    const context = canvas.getContext("2d", { willReadFrequently: true });

    let darkChecks = 0;
    let phoneHits = 0;
    let phoneMisses = 0;
    let faceMisses = 0;
    let faceHits = 0;
    let cameraIncidentOpen = false;
    let phoneIncidentOpen = false;
    let faceIncidentOpen = false;
    // Frames come from the on-screen preview when it is showing (always playing), otherwise from
    // a hidden video element on the same stream.
    const frameSource = () => {
      const preview = contestCameraPreviewRef.current;
      return preview && preview.srcObject === contestCameraStream && preview.readyState >= 2 ? preview : video;
    };
    // Small JPEG (~5 KB) of the current camera picture for the admin's Live Monitor.
    const snapshotCanvas = document.createElement("canvas");
    snapshotCanvas.width = 192;
    snapshotCanvas.height = 144;
    const snapshotContext = snapshotCanvas.getContext("2d");
    cameraSnapshotRef.current = () => {
      const source = frameSource();
      if (!snapshotContext || source.readyState < 2) return null;
      try {
        snapshotContext.drawImage(source, 0, 0, snapshotCanvas.width, snapshotCanvas.height);
        return snapshotCanvas.toDataURL("image/jpeg", 0.6);
      } catch {
        return null;
      }
    };
    let detector = null;
    let detecting = false;

    const logEvent = (eventType, reason) => {
      if (!authToken || !testId) return;
      performApiRequest("/api/proctoring/events", {
        method: "POST",
        body: JSON.stringify({ assignmentId: testId, eventType, metadata: { reason } }),
      }).catch(() => {});
    };

    const averageBrightness = () => {
      const source = frameSource();
      if (!context || source.readyState < 2) return null;
      context.drawImage(source, 0, 0, canvas.width, canvas.height);
      const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
      let total = 0;
      for (let i = 0; i < data.length; i += 4) total += (data[i] * 299 + data[i + 1] * 587 + data[i + 2] * 114) / 1000;
      return total / (data.length / 4);
    };

    const checkCamera = () => {
      let issue = "";
      if (!track || track.readyState !== "live" || !contestCameraStream.active) {
        issue = "Your camera turned off or was disconnected.";
      } else if (track.muted || !track.enabled) {
        issue = "Your camera is not sending video.";
      } else {
        const brightness = averageBrightness();
        darkChecks = brightness !== null && brightness < 15 ? darkChecks + 1 : 0;
        if (darkChecks >= 3) issue = "Your camera is covered or the room is too dark.";
      }

      setCameraIssue(issue);
      if (issue && !cameraIncidentOpen) logEvent("CAMERA_OFF", issue);
      cameraIncidentOpen = Boolean(issue);
    };

    // One model pass per check: a phone in view, and whether the student (a person) is visible.
    // A phone held over the camera hides the face, so that is caught by the face check.
    const checkPhone = async () => {
      const source = frameSource();
      if (!detector || detecting || source.readyState < 2) return;
      detecting = true;
      try {
        const predictions = await detector.detect(source, 10, 0.3);
        const seen = predictions.some((p) => p.class === "cell phone" && p.score >= 0.4);
        const personVisible = predictions.some((p) => p.class === "person" && p.score >= 0.4);
        faceMisses = personVisible ? 0 : faceMisses + 1;
        faceHits = personVisible ? faceHits + 1 : 0;
        // About 6s without the student in view blurs the exam; two checks with them back removes it.
        if (faceMisses >= 4 && !faceIncidentOpen) {
          faceIncidentOpen = true;
          setFaceMissing(true);
          logEvent("FACE_NOT_VISIBLE", "The student was not visible on camera.");
        } else if (faceHits >= 2 && faceIncidentOpen) {
          faceIncidentOpen = false;
          setFaceMissing(false);
        }
        phoneHits = seen ? phoneHits + 1 : 0;
        phoneMisses = seen ? 0 : phoneMisses + 1;
        // Two detections in a row to show the block, two clear checks in a row to remove it.
        if (phoneHits >= 2 && !phoneIncidentOpen) {
          phoneIncidentOpen = true;
          setPhoneDetected(true);
          logEvent("PHONE_DETECTED", "A mobile phone was detected on camera.");
        } else if (phoneMisses >= 2 && phoneIncidentOpen) {
          phoneIncidentOpen = false;
          setPhoneDetected(false);
        }
      } catch {
      } finally {
        detecting = false;
      }
    };

    // Usually already loaded at login; if loading failed, retry every 30s during the exam.
    let detectorLoading = false;
    let lastDetectorAttempt = 0;
    const ensureDetector = () => {
      if (detector || detectorLoading || Date.now() - lastDetectorAttempt < 30000) return;
      detectorLoading = true;
      lastDetectorAttempt = Date.now();
      if (!cancelled) setAiCheckStatus("loading");
      loadPhoneDetector()
        .then((model) => {
          if (cancelled) return;
          detector = model;
          setAiCheckStatus("on");
        })
        .catch(() => {
          if (!cancelled) setAiCheckStatus("off");
        })
        .finally(() => {
          detectorLoading = false;
        });
    };
    ensureDetector();

    const handleTrackChange = () => checkCamera();
    track?.addEventListener("ended", handleTrackChange);
    track?.addEventListener("mute", handleTrackChange);
    track?.addEventListener("unmute", handleTrackChange);

    checkCamera();
    const interval = setInterval(() => {
      if (cancelled) return;
      checkCamera();
      ensureDetector();
      checkPhone();
    }, 1500);

    return () => {
      cancelled = true;
      clearInterval(interval);
      track?.removeEventListener("ended", handleTrackChange);
      track?.removeEventListener("mute", handleTrackChange);
      track?.removeEventListener("unmute", handleTrackChange);
      video.srcObject = null;
      cameraSnapshotRef.current = null;
    };
  }, [contestEntered, contestCameraStream, activeAssignment?.id, authToken, currentUser.role]);

  useEffect(() => {
    if (!linkTestId || !authToken || !currentUser.id || currentUser.role === "admin") return undefined;
    if (contestEntered || view === "thankYou") return undefined;

    let cancelled = false;
    const loadLinkInfo = async () => {
      try {
        const data = await performApiRequest(`/api/tests/${linkTestId}/info`);
        if (cancelled) return;
        setLinkTestError("");
        setLinkTestInfo(data.test || null);
        if (data.test?.status === "LIVE" && !data.test.attemptUsed) {
          setPortalRefreshTick((tick) => tick + 1);
          setView("contest");
        } else {
          setView("testLink");
        }
      } catch (error) {
        if (cancelled) return;
        setLinkTestInfo(null);
        setLinkTestError(/not found/i.test(error.message || "") ? "This test link is not valid. The test may have been deleted." : (error.message || "Could not open this test."));
        setView("testLink");
      }
    };

    loadLinkInfo();
    const interval = setInterval(loadLinkInfo, 15000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [linkTestId, authToken, currentUser.id, currentUser.role, contestEntered]);

  // Once the linked live test is loaded on the contest page, start it automatically.
  useEffect(() => {
    if (!linkTestId || linkAutoStarted || contestEntered || view !== "contest") return;
    if (!activeContestAssignment || !sameValue(activeContestAssignment.id, linkTestId)) return;
    if (linkTestInfo?.status !== "LIVE" || linkTestInfo?.attemptUsed || hasUsedContestAttempt) return;
    setLinkAutoStarted(true);
    handleEnterContest(contestProblems[0]);
  });

  // Reload the moment a scheduled test is due, instead of waiting for the next poll.
  useEffect(() => {
    if (!nextScheduledStartAt) return undefined;
    const delay = new Date(nextScheduledStartAt).getTime() - Date.now() + 1500;
    if (!Number.isFinite(delay) || delay > 24 * 60 * 60 * 1000) return undefined;
    const timer = setTimeout(() => setPortalRefreshTick((tick) => tick + 1), Math.max(0, delay));
    return () => clearTimeout(timer);
  }, [nextScheduledStartAt]);

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

  const leaveTestLink = () => {
    setLinkTestId(null);
    setLinkTestInfo(null);
    setLinkTestError("");
    try {
      window.history.replaceState(null, "", "/");
    } catch {}
  };

  const shareTestLink = async (test) => {
    if (!test?.id) return;
    const url = `${window.location.origin}/test/${test.id}`;
    try {
      await navigator.clipboard.writeText(url);
      setPortalMessage(`Test link copied: ${url}  (students who open it go straight into "${test.title || "the test"}")`);
    } catch {
      window.prompt("Copy this test link and share it with students:", url);
    }
  };

  const showThankYouScreen = (test) => {
    setThankYouTest(test || { id: null, title: "Assessment" });
    setFeedbackRating(0);
    setFeedbackComment("");
    setFeedbackSent(false);
    setFeedbackError("");
    setView("thankYou");
  };

  const submitTestFeedback = async () => {
    if (!feedbackRating) {
      setFeedbackError("Tap an emoji to rate the test first.");
      return;
    }
    if (!thankYouTest?.id) {
      setFeedbackSent(true);
      return;
    }

    setFeedbackSubmitting(true);
    setFeedbackError("");
    try {
      await performApiRequest(`/api/tests/${thankYouTest.id}/feedback`, {
        method: "POST",
        body: JSON.stringify({ rating: feedbackRating, comment: feedbackComment }),
      });
      setFeedbackSent(true);
    } catch (error) {
      setFeedbackError(error.message || "Could not send feedback. Please try again.");
    } finally {
      setFeedbackSubmitting(false);
    }
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
      const testId = activeContestAssignment.id;
      const answers = collectExamAnswersRef.current ? collectExamAnswersRef.current() : null;
      // Save the answers first: if the submit below never reaches the server, the server
      // auto-submits these saved answers a few minutes later.
      if (answers) {
        try {
          await performApiRequest(`/api/tests/${testId}/attempts/draft`, {
            method: "POST",
            body: JSON.stringify({ ...answers, final: true }),
          });
        } catch {}
      }
      try {
        await performApiRequest(`/api/tests/${testId}/attempts/finish`, {
          method: "POST",
          body: JSON.stringify({ reason, interrupted }),
        });
      } catch {}
      // Time up / test stopped / warnings: submit the answers too (in the background, since
      // grading can take a while).
      if (answers) {
        performApiRequest(`/api/tests/${testId}/submit`, {
          method: "POST",
          body: JSON.stringify({ ...answers, isAutoSubmit: true }),
        }).catch(() => {});
      }
    }
    setContestResult(buildContestResult(reason, sessionProgress));
    const finishedTest = activeContestAssignment?.id
      ? { id: activeContestAssignment.id, title: activeContestAssignment.title || "Assessment" }
      : null;
    if (activeContestAssignment?.id) {
      setLiveTestPopupDismissedId(activeContestAssignment.id);
    }
    setShowLiveTestPopup(false);
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
    showThankYouScreen(finishedTest);
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

  const renderFullscreenGate = () => {
    if (!contestEntered || !contestNeedsFullscreen) return null;
    return (
      <div style={{ position:"fixed", inset:0, zIndex:100000, background:"rgba(5,6,12,0.94)", display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
        <div style={{ width:"min(460px, 100%)", background:"#11111b", border:"1px solid #2b2b45", borderRadius:20, padding:"28px 24px", textAlign:"center" }}>
          {contestWarningCount > 0 ? (
            <>
              <div style={{ fontSize:44 }}>⚠️</div>
              <h2 style={{ color:"#fca5a5", fontSize:22, margin:"12px 0 8px" }}>Warning {contestWarningCount} of {MAX_CONTEST_WARNINGS}</h2>
              <p style={{ color:"#fecaca", fontSize:14, fontWeight:700, margin:"0 0 8px" }}>{contestWarningReason}</p>
              <p style={{ color:"#a9aed0", fontSize:14, lineHeight:1.6, margin:"0 0 16px" }}>
                {MAX_CONTEST_WARNINGS - contestWarningCount === 1
                  ? "This is your last chance. One more violation will end your test."
                  : `${MAX_CONTEST_WARNINGS - contestWarningCount} more violations will end your test.`}
                {" "}This has been recorded. Your timer is still running.
              </p>
              <div style={{ display:"flex", justifyContent:"center", gap:8, marginBottom:20 }}>
                {Array.from({ length: MAX_CONTEST_WARNINGS }, (_, index) => (
                  <span key={index} style={{ width:28, height:8, borderRadius:999, background:index < contestWarningCount ? "#ef4444" : "#2b2b45" }} />
                ))}
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize:44 }}>🖥️</div>
              <h2 style={{ color:"#f5f6ff", fontSize:22, margin:"12px 0 8px" }}>Continue your test in fullscreen</h2>
              <p style={{ color:"#a9aed0", fontSize:14, lineHeight:1.6, margin:"0 0 20px" }}>
                The test runs in fullscreen mode. Your timer is already running.
                Switching tabs/windows, leaving fullscreen or pressing restricted keys gives a warning;
                after {MAX_CONTEST_WARNINGS} warnings the test ends.
              </p>
            </>
          )}
          <button
            type="button"
            onClick={() => { requestContestFullscreen(); }}
            style={{ ...S.btn("submit"), width:"100%", padding:"12px 20px" }}
          >
            {contestWarningCount > 0 ? "Return to Test (Fullscreen)" : "Enter Fullscreen"}
          </button>
        </div>
      </div>
    );
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

  // Returns true when the camera is on, otherwise the message to show the student.
  const requestContestCameraPermission = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      const message = "Camera access is not supported in this browser. Use the latest Google Chrome or Microsoft Edge to take the test.";
      setContestCameraStatus("unavailable");
      setContestCameraError(message);
      return message;
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
        ? "Camera permission is blocked. Click the camera icon in the browser address bar, choose Allow, then try again. The test cannot start without your camera."
        : reason === "NotFoundError"
          ? "No camera was found on this device. The test cannot start without a working camera."
          : reason === "NotReadableError"
            ? "Your camera is being used by another app (Zoom, Teams, Camera app). Close that app and try again."
            : "Unable to start your camera. Check that it is connected and try again. The test cannot start without your camera.";

      setContestCameraStatus("unavailable");
      setContestCameraError(message);
      return message;
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

    // The camera is required: the test does not start until camera permission is given.
    let cameraResult;
    try {
      cameraResult = await requestContestCameraPermission();
    } catch {
      cameraResult = "Unable to start your camera. The test cannot start without your camera.";
    }
    if (cameraResult !== true) {
      setContestCameraStatus("unavailable");
      setPortalError(cameraResult);
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
      return;
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
      const durationEnd = Date.now() + ((activeContestAssignment?.duration || adminCurrentTest.duration || 60) * 60 * 1000);
      const testEnd = activeContestAssignment?.endsAt ? new Date(activeContestAssignment.endsAt).getTime() : NaN;
      setContestSessionEndsAt(new Date(Number.isFinite(testEnd) ? Math.min(durationEnd, testEnd) : durationEnd).toISOString());
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

  // ── Monthly challenge (student) ──
  const loadCurrentChallenge = async () => {
    setChallengeLoading(true);
    try {
      const data = await performApiRequest("/api/challenges/current");
      setChallengeData(data);
      setChallengeError("");
    } catch (error) {
      setChallengeError(error.message || "Unable to load the monthly challenge.");
    } finally {
      setChallengeLoading(false);
    }
  };

  const openChallenge = () => {
    setView("challenge");
    loadCurrentChallenge();
  };

  const openPlayground = () => {
    setView("playground");
  };

  // ── Practice IDE ──
  const playgroundLang = playgroundDraft.lang;
  const playgroundCode = typeof playgroundDraft.codes[playgroundLang] === "string"
    ? playgroundDraft.codes[playgroundLang]
    : PLAYGROUND_STARTER_CODE[playgroundLang];

  const updatePlaygroundDraft = (changes) => {
    setPlaygroundDraft((prev) => {
      const next = { ...prev, ...changes };
      try {
        window.localStorage?.setItem(PLAYGROUND_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Storage can be full or blocked; the draft still lives for this visit.
      }
      return next;
    });
  };

  const setPlaygroundCode = (nextCode) => {
    setPlaygroundDraft((prev) => {
      const next = { ...prev, codes: { ...prev.codes, [prev.lang]: nextCode } };
      try {
        window.localStorage?.setItem(PLAYGROUND_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Storage can be full or blocked; the draft still lives for this visit.
      }
      return next;
    });
  };

  const runPlayground = async () => {
    if (playgroundRunning) return;
    if (!playgroundCode.trim()) {
      setPlaygroundResult({ error: "Write some code first." });
      return;
    }

    setPlaygroundRunning(true);
    setPlaygroundResult(null);
    try {
      const data = await performApiRequest("/api/run/playground", {
        method: "POST",
        body: JSON.stringify({ language: playgroundLang, code: playgroundCode, stdin: playgroundDraft.stdin }),
      });
      setPlaygroundResult(data);
    } catch (error) {
      setPlaygroundResult({ error: error.message || "Run failed. Try again." });
    } finally {
      setPlaygroundRunning(false);
    }
  };

  // ── Monthly challenge (admin) ──
  const DEFAULT_CHALLENGE_PRIZES = ["DevOrbit Hoodie + Premium Gift Hamper", "DevOrbit Hoodie + Gift Kit", "DevOrbit Hoodie + Goodies"];
  // Months follow India time, like the backend.
  const currentChallengeMonth = () => new Date(Date.now() + 330 * 60000).toISOString().slice(0, 7);
  const createEmptyChallengeForm = () => ({
    id: null,
    title: "",
    month: currentChallengeMonth(),
    description: "",
    prizes: [...DEFAULT_CHALLENGE_PRIZES],
    problemIds: [],
  });

  const loadAdminChallenges = async () => {
    setAdminChallengesLoading(true);
    try {
      const data = await performApiRequest("/api/challenges");
      setAdminChallenges(Array.isArray(data.challenges) ? data.challenges : []);
    } catch (error) {
      setAdminChallengeMessage({ type: "error", text: error.message || "Unable to load monthly challenges." });
    } finally {
      setAdminChallengesLoading(false);
    }
  };

  useEffect(() => {
    if (view !== "admin" || adminTab !== "challenge" || !authToken) return;
    loadAdminChallenges();
    setAdminChallengeForm((prev) => prev || createEmptyChallengeForm());
  }, [view, adminTab, authToken]);

  const saveAdminChallenge = async () => {
    const form = adminChallengeForm;
    if (!form || adminChallengeSaving) return;
    if (!form.month) {
      setAdminChallengeMessage({ type: "error", text: "Choose the challenge month." });
      return;
    }
    if (!form.problemIds.length) {
      setAdminChallengeMessage({ type: "error", text: "Pick at least one problem." });
      return;
    }

    setAdminChallengeSaving(true);
    setAdminChallengeMessage(null);
    try {
      await performApiRequest(form.id ? `/api/challenges/${form.id}` : "/api/challenges", {
        method: form.id ? "PUT" : "POST",
        body: JSON.stringify({
          title: form.title,
          month: form.month,
          description: form.description,
          prizes: form.prizes,
          problemIds: form.problemIds,
        }),
      });
      setAdminChallengeMessage({ type: "success", text: form.id ? "Challenge updated." : "Challenge created. Students can see it now." });
      setAdminChallengeForm(createEmptyChallengeForm());
      setAdminChallengeDetail(null);
      await loadAdminChallenges();
    } catch (error) {
      setAdminChallengeMessage({ type: "error", text: error.message || "Unable to save the challenge." });
    } finally {
      setAdminChallengeSaving(false);
    }
  };

  const editAdminChallenge = (challenge) => {
    setAdminChallengeForm({
      id: challenge.id,
      title: challenge.title || "",
      month: challenge.month,
      description: challenge.description || "",
      prizes: [0, 1, 2].map((index) => challenge.prizes?.[index] || DEFAULT_CHALLENGE_PRIZES[index]),
      problemIds: Array.isArray(challenge.problemIds) ? challenge.problemIds.map(String) : [],
    });
    setAdminChallengeMessage(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const deleteAdminChallenge = async (challenge) => {
    if (!window.confirm(`Delete "${challenge.title}"? Its standings will no longer be shown.`)) return;
    try {
      await performApiRequest(`/api/challenges/${challenge.id}`, { method: "DELETE" });
      if (adminChallengeDetail?.id === challenge.id) setAdminChallengeDetail(null);
      if (adminChallengeForm?.id === challenge.id) setAdminChallengeForm(createEmptyChallengeForm());
      setAdminChallengeMessage({ type: "success", text: "Challenge deleted." });
      await loadAdminChallenges();
    } catch (error) {
      setAdminChallengeMessage({ type: "error", text: error.message || "Unable to delete the challenge." });
    }
  };

  const viewAdminChallengeStandings = async (challenge) => {
    try {
      const data = await performApiRequest(`/api/challenges/${challenge.id}`);
      setAdminChallengeDetail(data.challenge || null);
    } catch (error) {
      setAdminChallengeMessage({ type: "error", text: error.message || "Unable to load the standings." });
    }
  };

  // ── Student feedback (admin) ──
  const FEEDBACK_RATING_META = {
    1: { emoji: "😞", label: "Poor" },
    2: { emoji: "😕", label: "Okay" },
    3: { emoji: "😐", label: "Good" },
    4: { emoji: "🙂", label: "Very good" },
    5: { emoji: "🤩", label: "Excellent" },
  };

  const loadAdminFeedbackCount = async () => {
    try {
      const data = await performApiRequest("/api/admin/feedback/new-count");
      setAdminFeedbackNewCount(Number(data.newCount) || 0);
    } catch (_) {
      // The badge is optional; ignore failures.
    }
  };

  // Keep the "new feedback" badge on the tab fresh while the admin portal is open.
  useEffect(() => {
    if (view !== "admin" || !authToken || userRole !== "admin") return undefined;
    loadAdminFeedbackCount();
    const timer = setInterval(loadAdminFeedbackCount, 60000);
    return () => clearInterval(timer);
  }, [view, authToken, userRole]);

  // Opening the Feedback tab loads everything, keeps the new ones highlighted for this visit,
  // and marks them seen so the badge clears.
  const loadAdminFeedback = async () => {
    setAdminFeedbackLoading(true);
    setAdminFeedbackError("");
    try {
      const data = await performApiRequest("/api/admin/feedback");
      setAdminFeedback(data);
      const newIds = (data.feedback || []).filter((row) => row.isNew).map((row) => row.id);
      if (newIds.length) {
        await performApiRequest("/api/admin/feedback/mark-seen", { method: "POST", body: JSON.stringify({ ids: newIds }) });
      }
      setAdminFeedbackNewCount(0);
    } catch (error) {
      setAdminFeedbackError(error.message || "Unable to load feedback.");
    } finally {
      setAdminFeedbackLoading(false);
    }
  };

  useEffect(() => {
    if (view !== "admin" || adminTab !== "feedback" || !authToken) return;
    loadAdminFeedback();
  }, [view, adminTab, authToken]);

  // ── Email all students (admin) ──
  const loadAdminEmailStatus = async () => {
    try {
      const data = await performApiRequest("/api/admin/announcements/status");
      setAdminEmailStatus(data);
      setAdminEmailForm((prev) => (prev.testTo ? prev : { ...prev, testTo: data.adminEmail || "" }));
      return data;
    } catch (error) {
      setAdminEmailMessage({ type: "error", text: error.message || "Unable to load the email status." });
      return null;
    }
  };

  useEffect(() => {
    if (view !== "admin" || adminTab !== "challenge" || !authToken) return;
    loadAdminEmailStatus();
  }, [view, adminTab, authToken]);

  // While a send is running, refresh progress every 2 seconds.
  useEffect(() => {
    if (view !== "admin" || adminTab !== "challenge" || adminEmailStatus?.job?.status !== "SENDING") return undefined;
    const timer = setTimeout(loadAdminEmailStatus, 2000);
    return () => clearTimeout(timer);
  }, [view, adminTab, adminEmailStatus]);

  // When a send to students finishes, swap the sending animation for the result popup.
  useEffect(() => {
    if (!adminEmailSending || adminEmailSending.isTest || adminEmailBusy) return undefined;
    const job = adminEmailStatus?.job;
    if (!job || job.status === "SENDING") return undefined;
    // Keep the animation on screen for at least ~1.8s so it doesn't just flash.
    const wait = Math.max(0, 1800 - (Date.now() - adminEmailSending.startedAt));
    const timer = setTimeout(() => {
      setAdminEmailSending(null);
      if (job.status === "DONE") {
        setAdminEmailMessage({ type: "success", text: `"${job.subject}" sent to ${job.sent} students.` });
        setAdminEmailResult({ type: "success", title: "Emails sent!", text: `"${job.subject}" was delivered to Resend for all ${job.sent} selected students.` });
      } else {
        const reason = job.errors?.[0] ? ` ${job.errors[0]}` : "";
        setAdminEmailMessage({ type: "error", text: `${job.sent} of ${job.total} sent, ${job.failed} failed.${reason}` });
        setAdminEmailResult({ type: "error", title: job.sent ? "Some emails failed" : "Emails not sent", text: `${job.sent} of ${job.total} sent, ${job.failed} failed.${reason}` });
      }
    }, wait);
    return () => clearTimeout(timer);
  }, [adminEmailSending, adminEmailBusy, adminEmailStatus]);

  const prefillChallengeEmail = (challenge) => {
    const problemCount = challenge.problems?.length || 0;
    const prizes = (challenge.prizes || []).map((prize, index) => `${PRIZE_MEDALS[index] || ""} Rank ${index + 1}: ${prize}`).join("\n");
    const lines = [
      `The ${challenge.title} is ${challenge.status === "LIVE" ? "live now" : "coming up"} on DevOrbit!`,
      `Dates: ${formatChallengeDate(challenge.startsAt)} to ${formatChallengeDate(challenge.endsAt)}`,
      problemCount ? `Problems: ${problemCount}` : "",
      challenge.description ? `\n${challenge.description}` : "",
      prizes ? `\nPrizes for the top 3:\n${prizes}` : "",
      "\nLog in, open the challenge and start solving. Good luck!",
    ].filter(Boolean);
    setAdminEmailForm((prev) => ({ ...prev, subject: `${challenge.title} - you're invited!`, message: lines.join("\n") }));
    setAdminEmailMessage(null);
    document.getElementById("admin-email-students")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const sendAdminEmail = async (mode, confirmed = false) => {
    const subject = adminEmailForm.subject.trim();
    const message = adminEmailForm.message.trim();
    if (!subject || !message) {
      setAdminEmailMessage({ type: "error", text: "Enter a subject and a message." });
      return;
    }
    const isTest = mode === "test";
    if (isTest && !adminEmailForm.testTo.trim()) {
      setAdminEmailMessage({ type: "error", text: "Enter the email address for the test." });
      return;
    }
    const maxRecipients = adminEmailStatus?.maxRecipients || 100;
    const selectedCount = adminEmailSelected.length;
    if (!isTest) {
      if (!selectedCount) {
        setAdminEmailMessage({ type: "error", text: "Select the students to email." });
        return;
      }
      if (selectedCount > maxRecipients) {
        setAdminEmailMessage({ type: "error", text: `You can email at most ${maxRecipients} students at a time.` });
        return;
      }
      // First click opens the confirmation popup; its "Send" button calls this again with confirmed = true.
      if (!confirmed) {
        setAdminEmailConfirm(true);
        return;
      }
      setAdminEmailConfirm(false);
    }

    setAdminEmailBusy(true);
    setAdminEmailMessage(null);
    setAdminEmailSending({ isTest, total: isTest ? 1 : selectedCount, startedAt: Date.now() });
    try {
      await performApiRequest("/api/admin/announcements/email", {
        method: "POST",
        body: JSON.stringify({ subject, message, ...(isTest ? { testTo: adminEmailForm.testTo.trim() } : { userIds: adminEmailSelected }) }),
      });
      if (isTest) {
        setAdminEmailMessage({ type: "success", text: `Test email sent to ${adminEmailForm.testTo.trim()}. Check the inbox (and spam folder).` });
        // Let the animation play for a moment before showing the result.
        await new Promise((resolve) => setTimeout(resolve, 1200));
        setAdminEmailSending(null);
        setAdminEmailResult({ type: "success", title: "Test email sent", text: `A test email was sent to ${adminEmailForm.testTo.trim()}. Check the inbox and the spam folder.` });
      } else {
        // The sending popup stays open and follows the job's progress until it finishes.
        setAdminEmailSelected([]);
      }
      await loadAdminEmailStatus();
    } catch (error) {
      setAdminEmailSending(null);
      setAdminEmailMessage({ type: "error", text: error.message || "Unable to send the email." });
      setAdminEmailResult({ type: "error", title: "Email not sent", text: error.message || "Unable to send the email." });
    } finally {
      setAdminEmailBusy(false);
    }
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
    setAuthMode(IS_ADMIN_ENTRY ? "login" : "");
    setAuthRole(DEFAULT_AUTH_ROLE);
    setAuthName("");
    setAuthUsn("");
    setAuthDepartment("");
    setAuthPhone("");
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
    setAuthPhone("");
    setAuthEmail("");
    setAuthPassword("");
    setAuthError("");
    setAuthPoliciesAccepted(false);
  };

  const chooseAuthMode = (mode) => {
    setAuthMode(mode);
    setAuthRole(DEFAULT_AUTH_ROLE);
    setAuthName("");
    setAuthUsn("");
    setAuthDepartment("");
    setAuthPhone("");
    setAuthEmail("");
    setAuthPassword("");
    setAuthError("");
    setAuthPoliciesAccepted(false);
  };

  const handleAuthSubmit = async () => {
    const name = authName.trim();
    const usn = authUsn.trim();
    const department = authDepartment.trim();
    const phone = normalizeMobileNumber(authPhone);
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
      if (!phone) {
        setAuthError("Enter a valid 10-digit mobile number.");
        return;
      }
    }

    if (!IS_ADMIN_ENTRY && !emailPattern.test(email)) {
      setAuthError("Only @gmail.com email addresses are allowed.");
      return;
    }

    setAuthSubmitting(true);

    try {
      const endpoint = authMode === "signup" ? "/api/auth/register" : "/api/auth/login";
      const payload = authMode === "signup"
        ? { email, password, name, usn, department, phone, role: authRole }
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
    setPortalMessage("");
    setPortalError("");
    setLeaderboard([]);
    setActiveUsers(defaultActiveUsers);
    setRegisteredStudents([]);
    setParticipantsCount(defaultActiveUsers.length);
    setAdminTab("overview");
    setAdminWarning("");
    setAdminExecution(null);
    setQuestionUploadForm(createDefaultQuestionUploadForm());
    setQuestionUploading(false);
    setQuestionCategoryFilter("All");
    setUserSubmissions([]);
    setStreakInfo(null);
    setChallengeData(null);
    setChallengeError("");
    setPlaygroundResult(null);
    setAdminChallenges([]);
    setAdminChallengeForm(null);
    setAdminChallengeDetail(null);
    setAdminChallengeMessage(null);
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

  const handleCreateTest = async (withSchedule = false) => {
    const duration = Math.max(1, Number(adminCreateForm.duration) || 60);
    if (!adminCreateForm.questions.length) {
      setPortalError("Select at least one database problem for the test.");
      return;
    }

    const scheduleWindow = withSchedule
      ? resolveScheduleWindow(adminCreateForm.scheduleDate, adminCreateForm.scheduleTime, adminCreateForm.scheduleEndDate, adminCreateForm.scheduleEndTime)
      : null;
    if (scheduleWindow?.error) {
      setPortalError(scheduleWindow.error);
      return;
    }
    const scheduledStart = scheduleWindow?.startsAt || null;

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

      let createdAssignment = mapAssignmentRecord(data.assignment);
      if (scheduledStart) {
        const scheduled = await performApiRequest(`/api/tests/${createdAssignment.id}/schedule`, {
          method: "POST",
          body: JSON.stringify({
            startsAt: scheduledStart.toISOString(),
            endsAt: scheduleWindow.endsAt ? scheduleWindow.endsAt.toISOString() : undefined,
          }),
        });
        createdAssignment = mapAssignmentRecord(scheduled.assignment);
      }
      setAdminCurrentTest(createdAssignment);
      setAdminTimerSeconds(duration * 60);
      setAdminSubmissionProblemId(createdAssignment?.problems?.[0]?.id || "");
      setPortalMessage(scheduledStart
        ? (scheduleWindow.startsNow
          ? `Test "${createdAssignment.title}" is LIVE now and stays open until ${formatPortalDate(scheduleWindow.endsAt || createdAssignment.endsAt)}.`
          : `Test "${createdAssignment.title}" scheduled for ${formatPortalDate(scheduledStart)}. It will start automatically and notify students.`)
        : `Draft test "${createdAssignment.title}" saved. Start it now or schedule a date and time.`);
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
      setPortalMessage("Test started.");
      await loadAdminPortalData(startedAssignment.id);
    } catch (error) {
      setPortalError(error.message || "Unable to start the test.");
    } finally {
      setAdminStartingTest(false);
    }
  };

  const handleScheduleAssignedTest = async () => {
    if (!adminCurrentTest.id) {
      setPortalError("Create a draft test first, then schedule it.");
      return;
    }

    const scheduleWindow = resolveScheduleWindow(adminScheduleDate, adminScheduleTime, adminScheduleEndDate, adminScheduleEndTime);
    if (scheduleWindow.error) {
      setPortalError(scheduleWindow.error);
      return;
    }
    const scheduledStart = scheduleWindow.startsAt;

    setAdminSchedulingTest(true);
    setPortalError("");

    try {
      const data = await performApiRequest(`/api/tests/${adminCurrentTest.id}/schedule`, {
        method: "POST",
        body: JSON.stringify({
          startsAt: scheduledStart.toISOString(),
          endsAt: scheduleWindow.endsAt ? scheduleWindow.endsAt.toISOString() : undefined,
        }),
      });

      const scheduledAssignment = mapAssignmentRecord(data.assignment);
      setAdminCurrentTest(scheduledAssignment);
      setAdminScheduleDate("");
      setAdminScheduleTime("");
      setAdminScheduleEndDate("");
      setAdminScheduleEndTime("");
      setPortalMessage(data.startedNow
        ? `Test is LIVE now and stays open until ${formatPortalDate(scheduleWindow.endsAt || data.assignment?.endsAt)}.`
        : `Test scheduled for ${formatPortalDate(scheduledStart)}. It will start automatically and notify students.`);
      await loadAdminPortalData(scheduledAssignment.id);
    } catch (error) {
      setPortalError(error.message || "Unable to schedule the test.");
    } finally {
      setAdminSchedulingTest(false);
    }
  };

  const handleUnscheduleAssignedTest = async () => {
    if (!adminCurrentTest.id || adminCurrentTest.status !== "SCHEDULED") return;

    setAdminSchedulingTest(true);
    setPortalError("");

    try {
      const data = await performApiRequest(`/api/tests/${adminCurrentTest.id}/unschedule`, {
        method: "POST",
      });

      const draftAssignment = mapAssignmentRecord(data.assignment);
      setAdminCurrentTest(draftAssignment);
      setPortalMessage("Schedule cancelled. The test is back to draft.");
      await loadAdminPortalData(draftAssignment.id);
    } catch (error) {
      setPortalError(error.message || "Unable to cancel the schedule.");
    } finally {
      setAdminSchedulingTest(false);
    }
  };

  const downloadProctoringReport = async () => {
    try {
      const response = await fetch(buildBackendApiUrl("/api/admin/reports/proctoring/export"), {
        headers: createAuthHeaders(authToken),
      });
      if (!response.ok) {
        const data = await readJsonSafely(response);
        throw new Error(data.error || "Unable to export the report.");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `proctoring-malpractice-report-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      setPortalError(error.message || "Unable to export the report.");
    }
  };

  const downloadAdminTestReport = () => {
    if (!adminTestReport) return;

    const csvCell = (value) => {
      const text = value === null || value === undefined ? "" : String(value);
      return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    };
    const formatTime = (value) => (value ? new Date(value).toLocaleString("en-IN") : "");

    const headers = ["Name", "Email", "USN", "Department", "Attendance", "Score", "Solved", "Time Used", "Submissions", "Interruptions", "Result", "Finish Reason", "Started At", "Finished At"];
    const rows = (adminTestReport.students || []).map((student) => [
      student.name,
      student.email,
      student.usn,
      student.department,
      student.attendance,
      student.score,
      student.solved,
      formatDurationFromMs(student.timeSpentMs),
      student.submissionCount,
      student.interruptionCount,
      student.attemptStatus,
      student.finishReason,
      formatTime(student.startedAt),
      formatTime(student.finishedAt),
    ]);

    const csv = [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
    // The BOM makes Excel open the file as UTF-8 so names keep their characters.
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const safeTitle = String(adminCurrentTest.title || "test").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "test";
    link.href = url;
    link.download = `${safeTitle}-report-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const openTestFromQueue = (test) => {
    setAdminCurrentTest(test);
    setAdminSubmissionProblemId(test?.problems?.[0]?.id || "");
    setAdminExecution(null);

    if (test.status === "ENDED") {
      setAttendanceTableOpen(true);
      setPendingReportScroll(true);
    } else {
      setPortalMessage(`"${test.title || "This test"}" is ${String(test.status || "DRAFT").toLowerCase()}. Its report will be available after the test ends.`);
    }
  };

  const handleDeleteTest = async (test) => {
    if (!test?.id) return;
    if (test.status === "LIVE") {
      setPortalError("Stop the live test before deleting it.");
      return;
    }

    const confirmed = window.confirm(
      `Delete "${test.title || "this test"}"?\n\nThis permanently removes the test and all of its results, attempts, notifications and feedback. This cannot be undone.`
    );
    if (!confirmed) return;

    setDeletingTestId(test.id);
    setPortalError("");
    try {
      await performApiRequest(`/api/tests/${test.id}`, { method: "DELETE" });
      const deletedCurrent = sameValue(adminCurrentTest?.id, test.id);
      if (deletedCurrent) {
        setAdminTestReport(null);
      }
      setPortalMessage(`Test "${test.title || "Untitled"}" deleted.`);
      await loadAdminPortalData(deletedCurrent ? null : adminCurrentTest?.id);
    } catch (error) {
      setPortalError(error.message || "Unable to delete the test.");
    } finally {
      setDeletingTestId(null);
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
      setPortalMessage("Test stopped.");
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
          setAuthRole(DEFAULT_AUTH_ROLE);
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
  // Search matches the title or a topic; the topic chips narrow it further.
  const problemMatchesSearch = (p) => {
    const query = searchQuery.trim().toLowerCase();
    if (filterTopic !== "All" && !(p.tags || []).includes(filterTopic)) return false;
    if (!query) return true;
    return p.title.toLowerCase().includes(query) || (p.tags || []).some((tag) => String(tag).toLowerCase().includes(query));
  };
  const filteredProblems = problemCatalog.filter(p =>
    (filterDiff === "All" || p.difficulty === filterDiff) && problemMatchesSearch(p)
  );
  const activeContestAssignment = activeAssignment || (currentUser.role === "admin" && adminCurrentTest.status === "LIVE" ? adminCurrentTest : null);
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
  const leaderboardPageSize = 10;
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
    background: "#F8F8F7",
    card: "#FFFFFF",
    border: "#E7E5E4",
    hoverBackground: "#F5F5F4",
    primary: "#1D3FCF",
    primaryHover: "#1733A8",
    primaryLight: "#EEF2FD",
    secondary: "#1C1917",
    secondaryHover: "#000000",
    text: "#1C1917",
    textSecondary: "#57534E",
    textMuted: "#A8A29E",
    success: "#15803D",
    warning: "#A15C07",
    error: "#B42318",
    info: "#1D3FCF",
    sidebarBackground: "#FFFFFF",
    sidebarActive: "#EEF2FD",
    buttonSecondary: "#FFFFFF",
    divider: "#EEEDEB",
    shadowSoft: "none",
    shadowHover: "0 6px 18px rgba(28,25,23,0.06)",
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
    adminApp: { fontFamily:"'IBM Plex Sans','Outfit',system-ui,sans-serif", background:ADMIN_THEME.background, color:ADMIN_THEME.text, minHeight:"100vh", display:"flex", flexDirection:"column", overflowX:"hidden" },
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
    adminFieldLabel: { display:"block", marginBottom:6, color:ADMIN_THEME.textSecondary, fontSize:13, fontWeight:500, fontFamily:"'IBM Plex Sans','Outfit',system-ui,sans-serif" },
    adminInput: { width:"100%", boxSizing:"border-box", background:ADMIN_THEME.card, border:`1px solid ${ADMIN_THEME.border}`, color:ADMIN_THEME.text, borderRadius:6, padding:"9px 12px", fontSize:14, outline:"none", fontFamily:"'IBM Plex Sans','Outfit',system-ui,sans-serif" },
    adminTextarea: { width:"100%", boxSizing:"border-box", background:ADMIN_THEME.card, border:`1px solid ${ADMIN_THEME.border}`, color:ADMIN_THEME.text, borderRadius:6, padding:"10px 12px", fontSize:14, outline:"none", resize:"vertical", minHeight:120, fontFamily:"'IBM Plex Sans','Outfit',system-ui,sans-serif", lineHeight:1.6 },
    adminButton: (variant) => ({
      padding:"9px 16px",
      borderRadius:6,
      cursor:"pointer",
      fontWeight:500,
      fontSize:14,
      fontFamily:"'IBM Plex Sans','Outfit',system-ui,sans-serif",
      lineHeight:1.3,
      transition:"background 0.15s ease, border-color 0.15s ease, color 0.15s ease",
      ...(variant === "run"
        ? { background:ADMIN_THEME.secondary, color:"#FFFFFF", border:`1px solid ${ADMIN_THEME.secondary}` }
        : variant === "submit"
          ? { background:ADMIN_THEME.primary, color:"#FFFFFF", border:`1px solid ${ADMIN_THEME.primary}` }
          : { background:ADMIN_THEME.buttonSecondary, color:ADMIN_THEME.text, border:`1px solid ${ADMIN_THEME.border}` }),
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
      borderRadius:6,
      padding:"12px 14px",
      fontSize:13.5,
      border:`1px solid ${tone === "warning"
        ? "rgba(217, 119, 6, 0.18)"
        : tone === "error"
          ? "rgba(220, 38, 38, 0.18)"
          : tone === "success"
            ? "rgba(22, 163, 74, 0.18)"
            : "rgba(37, 99, 235, 0.18)"}`,
      background:tone === "warning"
        ? "#FDF3E7"
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
    adminShell: { maxWidth:1240, margin:"0 auto", width:"100%", boxSizing:"border-box", padding:isPhone ? "18px 14px 32px" : `24px ${pageGutter}px 48px`, display:"grid", gap:isPhone ? 16 : 24 },
    adminCardGrid: { display:"grid", gridTemplateColumns:`repeat(auto-fit, minmax(${isPhone ? 150 : 220}px, 1fr))`, gap:isPhone ? 12 : 16 },
    adminCard: { background:ADMIN_THEME.card, border:`1px solid ${ADMIN_THEME.border}`, borderRadius:8, padding:isPhone ? "18px 16px" : "22px 24px" },
    adminSectionTitle: { fontFamily:"'IBM Plex Sans','Outfit',system-ui,sans-serif", fontSize:13, fontWeight:500, color:ADMIN_THEME.textSecondary, marginBottom:10 },
    adminGridTwo: { display:"grid", gridTemplateColumns:isCompact ? compactGrid : "1.35fr 0.95fr", gap:18, alignItems:"start" },
    adminTableWrap: { background:ADMIN_THEME.card, border:`1px solid ${ADMIN_THEME.border}`, borderRadius:8, overflowX:"auto" },
    adminTableHead: { padding:"12px 16px", textAlign:"left", whiteSpace:"nowrap", fontSize:12, color:ADMIN_THEME.textSecondary, fontWeight:500, fontFamily:"'IBM Plex Sans','Outfit',system-ui,sans-serif", background:"#FAFAF9" },
    adminTableCell: { padding:"14px 16px", borderTop:`1px solid ${ADMIN_THEME.divider}`, fontSize:14, color:ADMIN_THEME.text },
    adminSubCard: { background:"#FAFAF9", border:`1px solid ${ADMIN_THEME.border}`, borderRadius:6, padding:"14px" },
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
      : adminCurrentStatus === "SCHEDULED"
        ? ADMIN_THEME.warning
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
  const formatDurationFromMs = (ms = 0) => {
    const totalSeconds = Math.max(0, Math.floor(Number(ms || 0) / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return hours > 0
      ? `${hours}h ${String(minutes).padStart(2, "0")}m`
      : `${minutes}m ${String(seconds).padStart(2, "0")}s`;
  };

  const formatDifficultyLabel = (value) => {
    const text = String(value || "Medium").toLowerCase();
    return text.charAt(0).toUpperCase() + text.slice(1);
  };
  const formatChallengeDate = (value) => {
    const date = new Date(value);
    return Number.isFinite(date.getTime())
      ? date.toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
      : "--";
  };
  const CHALLENGE_STATUS_TONE = {
    LIVE: { label: "Live now", color: "#73f0b3", border: "#1f4e3a", background: "#0e1b15" },
    UPCOMING: { label: "Upcoming", color: "#93c5fd", border: "#2d4f7b", background: "#0f1727" },
    ENDED: { label: "Ended", color: "#ffb4b4", border: "#5a262d", background: "#1b0f13" },
  };
  const PRIZE_MEDALS = ["🥇", "🥈", "🥉"];

  // Extra student navigation: the practice IDE and the monthly challenge.
  const renderExtraNavButtons = (active = "") => (
    <>
      <button onClick={openPlayground} style={S.navBtn(active === "playground")}>
        <span style={S.navBtnLabel(active === "playground")}>IDE</span>
        <span style={S.navBtnHint(active === "playground")}>Code playground</span>
      </button>
      <button onClick={openChallenge} style={S.navBtn(active === "challenge")}>
        <span style={S.navBtnLabel(active === "challenge")}>🏆 Monthly Challenge</span>
        <span style={S.navBtnHint(active === "challenge")}>Win a hoodie + gifts</span>
      </button>
    </>
  );

  const renderStreakPill = () => {
    if (!streakInfo) return null;
    const current = streakInfo.currentStreak || 0;
    return (
      <span
        title={streakInfo.practicedToday ? `${current}-day streak. You practised today.` : current ? `${current}-day streak. Practise today to keep it.` : "Practise today to start a streak."}
        style={{ display:"inline-flex", alignItems:"center", gap:5, padding:"5px 10px", borderRadius:999, background:streakInfo.practicedToday ? "rgba(255,140,40,0.14)" : "#15151f", border:`1px solid ${streakInfo.practicedToday ? "#7a3d10" : "#2a2a3e"}`, color:current ? "#ffb547" : "#8a8ea8", fontSize:13, fontWeight:800 }}
      >
        <span style={{ filter:current ? "none" : "grayscale(1)" }}>🔥</span>{current}
      </span>
    );
  };

  const renderStreakCard = (weeks = 26) => {
    const info = streakInfo;
    const current = info?.currentStreak || 0;
    const message = !info
      ? "Loading your streak..."
      : info.practicedToday
        ? "You practised today. Come back tomorrow to keep the flame going!"
        : current > 0
          ? "Run or submit a problem today to keep your streak alive."
          : "Run or submit any problem today to start a new streak.";
    return (
      <div style={{ background:"linear-gradient(135deg, rgba(255,140,40,0.12), rgba(17,17,24,0.96) 45%)", border:"1px solid #3a2414", borderRadius:18, padding:"18px 20px", display:"flex", gap:22, flexWrap:"wrap", alignItems:"center", marginBottom:24 }}>
        <div style={{ display:"flex", alignItems:"center", gap:14, minWidth:190 }}>
          <div style={{ fontSize:46, lineHeight:1, filter:current ? "drop-shadow(0 0 14px rgba(255,140,40,0.55))" : "grayscale(1) opacity(0.5)" }}>🔥</div>
          <div>
            <div style={{ fontSize:34, fontWeight:800, color:current ? "#ffb547" : "#8a8ea8", lineHeight:1 }}>
              {current}
              <span style={{ fontSize:14, fontWeight:600, color:"#a9aed0", marginLeft:6 }}>day{current === 1 ? "" : "s"}</span>
            </div>
            <div style={{ fontSize:11, color:"#a9aed0", marginTop:6, letterSpacing:"0.1em", textTransform:"uppercase", fontWeight:700 }}>Current streak</div>
          </div>
        </div>
        <div style={{ display:"flex", gap:12, flexWrap:"wrap" }}>
          {[
            ["Longest", `${info?.longestStreak || 0} days`, "#f5f6ff"],
            ["Active days", info?.activeDays || 0, "#f5f6ff"],
            ["Today", info?.practicedToday ? "✓ Done" : "Pending", info?.practicedToday ? "#73f0b3" : "#ffc01e"],
          ].map(([label, value, color]) => (
            <div key={label} style={{ background:"#12121b", border:"1px solid #262636", borderRadius:12, padding:"10px 14px", minWidth:92 }}>
              <div style={{ color:"#7a7f9e", fontSize:10.5, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:4 }}>{label}</div>
              <div style={{ color, fontSize:16, fontWeight:700 }}>{value}</div>
            </div>
          ))}
        </div>
        <div style={{ flex:"1 1 300px", minWidth:0 }}>
          <div style={{ color:"#d6d9f0", fontSize:13, marginBottom:10 }}>{message}</div>
          {info && <StreakCalendar calendar={info.calendar} today={info.today} weeks={weeks} />}
        </div>
      </div>
    );
  };

  // Top menu shared by the student pages that use the new minimal design.
  const renderStudentNav = (active = "", contained = false) => {
    const streak = streakInfo?.currentStreak || 0;
    const solvedTotal = problemCatalog.filter((problem) => solved.has(problem.id)).length;
    const link = (id, label, onClick) => {
      const isActive = active === id;
      return (
        <button key={id} onClick={onClick} aria-current={isActive ? "page" : undefined}
          style={{ background:"none", border:"none", cursor:"pointer", padding:"16px 0 14px", color:isActive ? "#ececec" : "#8e8e8e", fontFamily:"inherit", fontSize:14.5, fontWeight:isActive ? 600 : 400, borderBottom:`2px solid ${isActive ? "#ececec" : "transparent"}`, whiteSpace:"nowrap", flexShrink:0 }}
          onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.color = "#c9c9c9"; }}
          onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.color = "#8e8e8e"; }}>
          {label}
        </button>
      );
    };
    return (
      <nav style={{ borderBottom:"1px solid #222", background:"#131313", flexShrink:0, position:"relative", zIndex:50 }}>
        <div style={{ padding:`0 ${contained ? pageGutter : isPhone ? 12 : 20}px`, display:"flex", alignItems:"center", gap:isPhone ? 16 : 22, maxWidth:contained ? 1240 : "none", margin:"0 auto", boxSizing:"border-box" }}>
          <button onClick={() => setView("home")} style={{ background:"none", border:"none", padding:"14px 0", cursor:"pointer", color:"#f2f2f2", fontFamily:"inherit", fontSize:16, fontWeight:700, flexShrink:0 }}>ScholarLogic</button>
          <div style={{ display:"flex", gap:isPhone ? 16 : 22, overflowX:"auto", flex:"1 1 auto", minWidth:0, scrollbarWidth:"none", marginLeft:isPhone ? 0 : 8 }}>
            {link("list", "Problems", () => setView("list"))}
            {link("contest", "Contest", openContest)}
            {link("leaderboard", "Leaderboard", () => openLeaderboard("All"))}
            {link("playground", "IDE", openPlayground)}
            {link("challenge", "Monthly challenge", openChallenge)}
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:isPhone ? 10 : 18, flexShrink:0 }}>
            {!isPhone && (
              <span style={{ fontFamily:"'IBM Plex Mono','JetBrains Mono',monospace", fontSize:13.5, color:"#a3a3a3", display:"flex", gap:16 }}>
                <span style={{ color:streakInfo?.practicedToday ? "#e8873a" : "#a3a3a3" }}>streak {streak}</span>
                {active !== "playground" && <span>{solvedTotal} solved</span>}
              </span>
            )}
            <button onClick={openProfile} title="Your profile" style={{ width:32, height:32, borderRadius:6, background:"#1c1c1c", border:"1px solid #2a2a2a", color:"#ececec", fontFamily:"inherit", fontWeight:700, fontSize:13.5, cursor:"pointer" }}>{userBadge}</button>
          </div>
        </div>
      </nav>
    );
  };

  // ── Student home: problem list with a progress sidebar ──
  const renderProblemsHome = () => {
    const T = {
      bg: "#131313",
      surface: "#181818",
      border: "#2a2a2a",
      borderSoft: "#222222",
      text: "#ececec",
      textSoft: "#c9c9c9",
      muted: "#8e8e8e",
      faint: "#5c5c5c",
      accent: "#e8873a",
      accentHover: "#f0964d",
      easy: "#4cb782",
      medium: "#e9b84a",
      hard: "#e5575f",
      sans: "'IBM Plex Sans','Outfit',system-ui,sans-serif",
      mono: "'IBM Plex Mono','JetBrains Mono',ui-monospace,monospace",
    };
    const DIFF_COLOR = { Easy: T.easy, Medium: T.medium, Hard: T.hard };
    const wide = !isPhone && !isTablet;
    const DAY_MS = 24 * 60 * 60 * 1000;
    const IST_OFFSET_MS = 330 * 60 * 1000;
    const dayKeyOf = (value) => new Date(new Date(value).getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);

    // Streak and calendar (days are India time, like the backend).
    const info = streakInfo;
    const currentStreak = info?.currentStreak || 0;
    const bestStreak = info?.longestStreak || 0;
    const todayKey = info?.today || dayKeyOf(Date.now());
    const todayMs = Date.parse(`${todayKey}T00:00:00Z`);
    const mondayMs = todayMs - ((new Date(todayMs).getUTCDay() + 6) % 7) * DAY_MS;
    const weekDays = Array.from({ length: 7 }, (_, index) => {
      const time = mondayMs + index * DAY_MS;
      const key = new Date(time).toISOString().slice(0, 10);
      return { key, label: "MTWTFSS"[index], active: Number(info?.calendar?.[key] || 0) > 0, today: key === todayKey, future: time > todayMs };
    });
    const daysLabel = (count) => `${count} day${count === 1 ? "" : "s"}`;
    const streakText = !info
      ? "Loading your streak..."
      : info.practicedToday
        ? `You practised today. Come back tomorrow to keep it going. Your best is ${daysLabel(bestStreak)}.`
        : currentStreak > 0
          ? `Solve a problem today to keep your streak alive. Your best is ${daysLabel(bestStreak)}.`
          : `Solve one problem today to start a new streak. Your best is ${daysLabel(bestStreak)}.`;

    // Weekly goal: distinct problems accepted since Monday.
    const weekStartKey = new Date(mondayMs).toISOString().slice(0, 10);
    const solvedThisWeek = new Set(
      userSubmissions
        .filter((submission) => submission.status === "ACCEPTED" && submission.createdAt && dayKeyOf(submission.createdAt) >= weekStartKey)
        .map((submission) => String(submission.problem?.id ?? submission.problemId))
    ).size;
    const goalLeft = Math.max(0, weeklyGoal - solvedThisWeek);
    const saveGoal = (value) => {
      setWeeklyGoal(value);
      setGoalEditing(false);
      try { window.localStorage.setItem("dv-weekly-goal", String(value)); } catch (_) { /* optional */ }
    };

    // Progress.
    const totalCount = problemCatalog.length;
    const solvedCount = problemCatalog.filter((problem) => solved.has(problem.id)).length;
    const milestone = [10, 25, 50, 100, 150, 200, 300, 500].find((value) => value > solvedCount && value <= totalCount) || totalCount;
    const progressText = solvedCount >= totalCount && totalCount
      ? "You've solved every problem. Impressive!"
      : `${milestone - solvedCount} more to reach ${milestone} solved.`;
    const byDifficulty = ["Easy", "Medium", "Hard"].map((label) => {
      const all = problemCatalog.filter((problem) => problem.difficulty === label);
      return { label, total: all.length, solved: all.filter((problem) => solved.has(problem.id)).length };
    });

    // Up next: the first unsolved problem in list order.
    const upNext = problemCatalog.find((problem) => !solved.has(problem.id)) || null;
    const upNextHint = !info
      ? ""
      : info.practicedToday
        ? "you've already practised today"
        : currentStreak > 0
          ? `solving it today keeps your ${daysLabel(currentStreak)} streak`
          : "solving it today starts your streak";

    // Topics: the most common tags become chips.
    const tagCounts = new Map();
    problemCatalog.forEach((problem) => (problem.tags || []).forEach((tag) => tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1)));
    const topTopics = [...tagCounts.entries()].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0]))).slice(0, isPhone ? 5 : 8).map(([tag]) => tag);
    if (filterTopic !== "All" && !topTopics.includes(filterTopic)) topTopics.push(filterTopic);
    const searchMatched = problemCatalog.filter(problemMatchesSearch);
    const diffTabs = ["All", "Easy", "Medium", "Hard"].map((label) => ({
      label,
      count: label === "All" ? searchMatched.length : searchMatched.filter((problem) => problem.difficulty === label).length,
    }));

    // Activity heatmap for the sidebar.
    const heatWeeks = isPhone ? 20 : 28;
    const heatEndMs = todayMs + (6 - ((new Date(todayMs).getUTCDay() + 6) % 7)) * DAY_MS;
    const heatStartMs = heatEndMs - (heatWeeks * 7 - 1) * DAY_MS;
    const heatColumns = Array.from({ length: heatWeeks }, (_, week) => Array.from({ length: 7 }, (__, day) => {
      const time = heatStartMs + (week * 7 + day) * DAY_MS;
      const key = new Date(time).toISOString().slice(0, 10);
      return { key, time, count: Number(info?.calendar?.[key] || 0), future: time > todayMs };
    }));
    const heatMonths = heatColumns.map((days, week) => {
      const month = new Date(days[0].time).getUTCMonth();
      const previous = week > 0 ? new Date(heatColumns[week - 1][0].time).getUTCMonth() : null;
      return week === 0 || month !== previous ? CALENDAR_MONTHS[month] : "";
    });
    const sinceLabel = heatMonths[0];
    // A month label needs about 3 columns of room; drop the first one if the next month starts right after.
    const nextLabelAt = heatMonths.findIndex((label, index) => index > 0 && label);
    if (nextLabelAt > 0 && nextLabelAt < 3) heatMonths[0] = "";
    const heatActiveDays = heatColumns.flat().filter((day) => day.count > 0 && !day.future).length;
    const heatColor = (count) => (count <= 0 ? "#262626" : count === 1 ? "#7a4318" : count <= 3 ? "#b45f22" : "#e8873a");

    const challenge = challengeData?.challenge;
    const showChallenge = challenge && challenge.status !== "ENDED";

    const sectionTitle = { fontFamily:T.sans, fontSize:13, fontWeight:600, letterSpacing:"0.12em", textTransform:"uppercase", color:T.muted };
    const linkStyle = { background:"none", border:"none", padding:0, color:T.text, textDecoration:"underline", textUnderlineOffset:3, cursor:"pointer", font:"inherit" };
    const bar = (percent, color) => (
      <div style={{ height:6, borderRadius:999, background:"#2a2a2a", overflow:"hidden" }}>
        <div style={{ width:`${Math.min(100, Math.max(0, percent))}%`, height:"100%", borderRadius:999, background:color, transition:"width 0.4s ease" }} />
      </div>
    );
    const upNextCard = (
      <div style={{ background:T.bg, border:`1px solid ${T.border}`, borderRadius:10, padding:isPhone ? "18px 16px" : "24px 26px", display:"flex", alignItems:"center", gap:16, flexWrap:"wrap", marginBottom:isPhone ? 24 : 36 }}>
        {upNext ? (
          <>
            <div style={{ flex:"1 1 260px", minWidth:0 }}>
              <div style={{ color:T.muted, fontSize:13, marginBottom:6 }}>Up next for you</div>
              <div style={{ display:"flex", alignItems:"baseline", gap:10, marginBottom:8, minWidth:0 }}>
                <span style={{ fontFamily:T.mono, color:T.muted, fontSize:18 }}>{upNext.id}.</span>
                <span style={{ color:T.text, fontSize:isPhone ? 19 : 22, fontWeight:600, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{upNext.title}</span>
              </div>
              <div style={{ fontSize:14, color:T.muted }}>
                <span style={{ color:DIFF_COLOR[upNext.difficulty] || T.muted }}>{upNext.difficulty}</span>
                {(upNext.tags || []).length > 0 && <> · {upNext.tags.slice(0, 3).join(", ")}</>}
                {upNextHint && <> · {upNextHint}</>}
              </div>
            </div>
            <button onClick={() => openProblem(upNext, "catalog")} style={{ background:T.accent, color:"#1a1009", border:"none", borderRadius:6, padding:"12px 22px", fontFamily:T.sans, fontSize:15, fontWeight:600, cursor:"pointer", flexShrink:0, width:isPhone ? "100%" : "auto" }}
              onMouseEnter={(e) => { e.currentTarget.style.background = T.accentHover; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = T.accent; }}>
              Solve now
            </button>
          </>
        ) : (
          <div>
            <div style={{ color:T.muted, fontSize:13, marginBottom:6 }}>Up next for you</div>
            <div style={{ color:T.text, fontSize:20, fontWeight:600 }}>{totalCount ? "You've solved every problem. 🎉" : "Problems are loading..."}</div>
            {totalCount > 0 && <div style={{ color:T.muted, fontSize:14, marginTop:6 }}>New problems are added regularly. Try the monthly challenge meanwhile.</div>}
          </div>
        )}
      </div>
    );

    const problemList = (
      <div>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", gap:12, flexWrap:"wrap", marginBottom:18 }}>
          <h1 style={{ margin:0, color:T.text, fontSize:isPhone ? 24 : 28, fontWeight:600 }}>Problems</h1>
          <span style={{ color:T.muted, fontSize:15 }}>{totalCount} total, {solvedCount} solved</span>
        </div>

        <div style={{ display:"flex", gap:12, alignItems:"center", flexWrap:"wrap", marginBottom:14 }}>
          <input placeholder="Search title or topic" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} aria-label="Search problems"
            style={{ flex:"1 1 260px", minWidth:0, background:T.bg, border:`1px solid ${T.border}`, borderRadius:6, padding:"11px 14px", color:T.text, fontFamily:T.sans, fontSize:15, outline:"none" }}
            onFocus={(e) => { e.currentTarget.style.borderColor = "#4a4a4a"; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = T.border; }} />
          <label style={{ display:"flex", alignItems:"center", gap:10, color:T.muted, fontSize:14, flex:isPhone ? "1 1 100%" : "0 0 auto" }}>
            Language
            <select value={lang} onChange={(e) => handleLangChange(e.target.value)}
              style={{ flex:isPhone ? 1 : "0 0 auto", background:T.bg, border:`1px solid ${T.border}`, borderRadius:6, padding:"10px 12px", color:T.text, fontFamily:T.sans, fontSize:15, cursor:"pointer", outline:"none" }}>
              {SUPPORTED_LANGUAGES.map((language) => <option key={language.id} value={language.id} style={{ background:"#1c1c1c" }}>{language.label}</option>)}
            </select>
          </label>
        </div>

        <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:22 }}>
          {["All", ...topTopics].map((topic) => {
            const active = filterTopic === topic;
            return (
              <button key={topic} onClick={() => setFilterTopic(topic)}
                style={{ background:active ? "#ececec" : "transparent", color:active ? "#151515" : T.textSoft, border:`1px solid ${active ? "#ececec" : T.border}`, borderRadius:5, padding:"7px 13px", fontFamily:T.sans, fontSize:14, fontWeight:active ? 500 : 400, cursor:"pointer" }}
                onMouseEnter={(e) => { if (!active) e.currentTarget.style.borderColor = "#4a4a4a"; }}
                onMouseLeave={(e) => { if (!active) e.currentTarget.style.borderColor = T.border; }}>
                {topic === "All" ? "All topics" : topic}
              </button>
            );
          })}
        </div>

        <div role="tablist" style={{ display:"flex", gap:isPhone ? 18 : 28, borderBottom:`1px solid ${T.borderSoft}`, overflowX:"auto" }}>
          {diffTabs.map((tab) => {
            const active = filterDiff === tab.label;
            return (
              <button key={tab.label} role="tab" aria-selected={active} onClick={() => setFilterDiff(tab.label)}
                style={{ background:"none", border:"none", borderBottom:`2px solid ${active ? T.text : "transparent"}`, marginBottom:-1, padding:"0 0 12px", cursor:"pointer", fontFamily:T.sans, fontSize:16, color:active ? T.text : T.muted, fontWeight:active ? 600 : 400, whiteSpace:"nowrap" }}>
                {tab.label} <span style={{ fontSize:14, color:active ? T.textSoft : T.faint, fontWeight:400 }}>{tab.count}</span>
              </button>
            );
          })}
        </div>

        <div style={{ width:"100%" }}>
          <div style={{ display:"grid", gridTemplateColumns:isPhone ? "28px 1fr 64px" : "40px minmax(0,1.4fr) minmax(0,1.2fr) 90px 90px", gap:12, padding:"14px 0", borderBottom:`1px solid ${T.borderSoft}`, color:T.muted, fontSize:14, fontWeight:500 }}>
            <span />
            <span>Title</span>
            {!isPhone && <span>Topics</span>}
            {!isPhone && <span style={{ textAlign:"right" }}>Acceptance</span>}
            <span style={{ textAlign:"right" }}>Difficulty</span>
          </div>
          {filteredProblems.map((problem) => {
            const isSolved = solved.has(problem.id);
            return (
              <div key={problem.id} role="button" tabIndex={0} onClick={() => openProblem(problem, "catalog")}
                onKeyDown={(e) => { if (e.key === "Enter") openProblem(problem, "catalog"); }}
                style={{ display:"grid", gridTemplateColumns:isPhone ? "28px 1fr 64px" : "40px minmax(0,1.4fr) minmax(0,1.2fr) 90px 90px", gap:12, alignItems:"center", padding:"17px 0", borderBottom:`1px solid ${T.borderSoft}`, cursor:"pointer", transition:"background 0.12s ease" }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "#1a1a1a"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
                <span style={{ paddingLeft:2 }} aria-label={isSolved ? "Solved" : "Not solved"}>
                  {isSolved && <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8.5l3.2 3L13 4.5" stroke={T.easy} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                </span>
                <span style={{ minWidth:0, display:"flex", gap:10, alignItems:"baseline" }}>
                  <span style={{ fontFamily:T.mono, color:T.muted, fontSize:14, flexShrink:0 }}>{problem.id}.</span>
                  <span style={{ color:T.text, fontSize:16, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{problem.title}</span>
                </span>
                {!isPhone && <span style={{ color:T.muted, fontSize:15, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{(problem.tags || []).slice(0, 3).join(", ") || "--"}</span>}
                {!isPhone && <span style={{ fontFamily:T.mono, color:T.textSoft, fontSize:14, textAlign:"right" }}>{/%/.test(String(problem.acceptance || "")) ? problem.acceptance : "—"}</span>}
                <span style={{ color:DIFF_COLOR[problem.difficulty] || T.muted, fontSize:15, textAlign:"right" }}>{problem.difficulty}</span>
              </div>
            );
          })}
          {!filteredProblems.length && (
            <div style={{ padding:"28px 0", color:T.muted, fontSize:15 }}>
              No problems match. <button onClick={() => { setSearchQuery(""); setFilterTopic("All"); setFilterDiff("All"); }} style={linkStyle}>Clear filters</button>
            </div>
          )}
        </div>
        <div style={{ color:T.muted, fontSize:14, marginTop:18 }}>Showing {filteredProblems.length} of {totalCount}</div>
      </div>
    );

    const sidebar = (
      <aside style={{ display:"grid", gap:isPhone ? 30 : 38, alignContent:"start", fontFamily:T.sans }}>
        <section>
          <div style={{ ...sectionTitle, marginBottom:12 }}>Streak</div>
          <div style={{ color:T.text, fontSize:34, fontWeight:600, lineHeight:1.1, marginBottom:10 }}>{daysLabel(currentStreak)}</div>
          <div style={{ color:T.textSoft, fontSize:15, lineHeight:1.6, marginBottom:16 }}>{streakText}</div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(7, 1fr)", gap:8, maxWidth:300 }}>
            {weekDays.map((day) => (
              <div key={day.key} style={{ display:"grid", gap:8, justifyItems:"center" }} title={day.future ? day.key : `${day.key}: ${day.active ? "practised" : "no practice"}`}>
                <span style={{ fontSize:12, color:T.muted }}>{day.label}</span>
                <span style={{ width:"100%", maxWidth:34, aspectRatio:"1", borderRadius:5, boxSizing:"border-box",
                  background:day.active ? T.accent : day.future ? "transparent" : "#2a2a2a",
                  border:day.today ? `2px solid ${T.accent}` : day.future ? `1px solid ${T.border}` : "none" }} />
              </div>
            ))}
          </div>
        </section>

        <section>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:12 }}>
            <span style={sectionTitle}>This week's goal</span>
            <span style={{ fontFamily:T.mono, color:T.text, fontSize:16 }}>{Math.min(solvedThisWeek, weeklyGoal)} / {weeklyGoal}</span>
          </div>
          {bar((solvedThisWeek / weeklyGoal) * 100, solvedThisWeek >= weeklyGoal ? T.easy : T.accent)}
          <div style={{ color:T.textSoft, fontSize:15, marginTop:12, display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" }}>
            <span>{goalLeft ? `${goalLeft} problem${goalLeft === 1 ? "" : "s"} before Sunday.` : "Goal reached this week. Nice work!"}</span>
            {goalEditing ? (
              <select autoFocus value={weeklyGoal} onChange={(e) => saveGoal(Number(e.target.value))} onBlur={() => setGoalEditing(false)}
                style={{ background:T.bg, border:`1px solid ${T.border}`, borderRadius:5, color:T.text, padding:"3px 6px", fontFamily:T.sans, fontSize:14 }}>
                {[1, 2, 3, 4, 5, 7, 10, 15, 20].map((value) => <option key={value} value={value} style={{ background:"#1c1c1c" }}>{value} per week</option>)}
              </select>
            ) : (
              <button onClick={() => setGoalEditing(true)} style={linkStyle}>Change goal</button>
            )}
          </div>
        </section>

        <section>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:12 }}>
            <span style={sectionTitle}>Progress</span>
            <span style={{ fontFamily:T.mono, color:T.text, fontSize:16 }}>{solvedCount} / {totalCount}</span>
          </div>
          {bar(totalCount ? (solvedCount / totalCount) * 100 : 0, "#ececec")}
          <div style={{ color:T.textSoft, fontSize:15, marginTop:12, marginBottom:16 }}>{progressText}</div>
          <div style={{ display:"grid", gap:10 }}>
            {byDifficulty.map((row) => (
              <div key={row.label} style={{ display:"flex", justifyContent:"space-between", fontSize:15 }}>
                <span style={{ color:DIFF_COLOR[row.label] }}>{row.label}</span>
                <span style={{ fontFamily:T.mono, color:T.textSoft }}>{row.solved} / {row.total}</span>
              </div>
            ))}
          </div>
        </section>

        <section>
          <div style={{ ...sectionTitle, marginBottom:14 }}>Since {sinceLabel || ""}</div>
          <div style={{ overflowX:"auto" }}>
            <div style={{ display:"inline-grid", gap:5 }}>
              <div style={{ display:"grid", gridTemplateColumns:`repeat(${heatWeeks}, 8px)`, gap:2, fontSize:10, color:T.muted, height:12 }}>
                {heatMonths.map((label, index) => <div key={index} style={{ whiteSpace:"nowrap", overflow:"visible" }}>{label}</div>)}
              </div>
              <div style={{ display:"grid", gridTemplateRows:"repeat(7, 8px)", gridAutoFlow:"column", gridAutoColumns:"8px", gap:2 }}>
                {heatColumns.flat().map((day) => (
                  <div key={day.key} title={day.future ? "" : `${day.count} submission${day.count === 1 ? "" : "s"} on ${day.key}`}
                    style={{ width:8, height:8, borderRadius:1.5, boxSizing:"border-box", background:day.future ? "transparent" : heatColor(day.count), border:day.key === todayKey ? "1px solid #ececec" : "none" }} />
                ))}
              </div>
            </div>
          </div>
          <div style={{ color:T.muted, fontSize:14, marginTop:10 }}>{heatActiveDays} active day{heatActiveDays === 1 ? "" : "s"}</div>
        </section>

        <section style={{ borderTop:`1px solid ${T.border}`, paddingTop:24, display:"grid", gap:14, color:T.textSoft, fontSize:15, lineHeight:1.6 }}>
          {showChallenge && (
            <div>
              {challenge.status === "LIVE" ? "This month's challenge" : "Next challenge"}: win a hoodie and a few gifts.{" "}
              <button onClick={openChallenge} style={linkStyle}>Details</button>
            </div>
          )}
          <div>Curious how you compare? <button onClick={() => openLeaderboard("All")} style={linkStyle}>See the leaderboard</button></div>
        </section>
      </aside>
    );

    return (
      <div style={{ position:"relative" }} onContextMenu={(e) => e.preventDefault()}>
        <ScreenShield active={shieldActive} message={shieldActiveMessage} title={shieldTitle} action={shieldAction} />
        {renderFullscreenGate()}
        {renderLiveTestPopupModal()}
        <div style={{ ...S.app, background:T.bg, color:T.text, fontFamily:T.sans, opacity: shieldActive ? 0 : 1, pointerEvents: shieldActive ? "none" : "auto", transition: "opacity 0.12s ease", userSelect: shieldActive ? "none" : "auto" }}>
          <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
          <div style={{ position:"sticky", top:0, zIndex:50 }}>{renderStudentNav("list", true)}</div>

          <main style={{ maxWidth:1240, width:"100%", margin:"0 auto", padding:`${isPhone ? 20 : 38}px ${pageGutter}px 60px`, boxSizing:"border-box" }}>
            {portalError && (
              <div style={{ background:"#1f1212", border:"1px solid #4b1e1e", color:"#f3b0b0", borderRadius:8, padding:"12px 14px", fontSize:14, marginBottom:18 }}>{portalError}</div>
            )}
            {wide ? (
              <div style={{ display:"grid", gridTemplateColumns:"minmax(0,1fr) 300px", gap:48, alignItems:"start" }}>
                <div style={{ minWidth:0 }}>{upNextCard}{problemList}</div>
                <div>{sidebar}</div>
              </div>
            ) : (
              <div>
                {upNextCard}
                <div style={{ marginBottom:36 }}>{sidebar}</div>
                {problemList}
              </div>
            )}
          </main>
        </div>
      </div>
    );
  };

  const renderChallengeBanner = () => {
    const challenge = challengeData?.challenge;
    if (!challenge || challenge.status === "ENDED") return null;
    const tone = CHALLENGE_STATUS_TONE[challenge.status] || CHALLENGE_STATUS_TONE.LIVE;
    const timeLeft = formatTimeLeft(challenge.status === "LIVE" ? challenge.endsAt : challenge.startsAt);
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={openChallenge}
        onKeyDown={(e) => { if (e.key === "Enter") openChallenge(); }}
        style={{ cursor:"pointer", marginBottom:24, borderRadius:18, padding:"18px 20px", background:"linear-gradient(120deg, rgba(243,201,105,0.16), rgba(124,106,247,0.16) 55%, rgba(17,17,24,0.96))", border:"1px solid #4a3d1f", display:"flex", alignItems:"center", gap:18, flexWrap:"wrap" }}
      >
        <div style={{ fontSize:40, lineHeight:1 }}>🏆</div>
        <div style={{ flex:"1 1 260px", minWidth:0 }}>
          <div style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap", marginBottom:6 }}>
            <span style={{ color:tone.color, background:tone.background, border:`1px solid ${tone.border}`, borderRadius:999, padding:"3px 10px", fontSize:11, fontWeight:800, letterSpacing:"0.08em", textTransform:"uppercase" }}>{tone.label}</span>
            {timeLeft && <span style={{ color:"#d6d9f0", fontSize:12 }}>{challenge.status === "LIVE" ? `${timeLeft} left` : `Starts in ${timeLeft}`}</span>}
          </div>
          <div style={{ color:"#fff4d6", fontSize:19, fontWeight:800 }}>{challenge.title}</div>
          <div style={{ color:"#c9cbe2", fontSize:13, marginTop:4 }}>Top 3 win a DevOrbit hoodie 🧥 + gifts 🎁 · {challenge.problems.length} problems · {challenge.participantCount} participating</div>
        </div>
        <span style={{ ...S.btn("submit"), padding:"10px 18px" }}>View challenge →</span>
      </div>
    );
  };

  const renderAdminFeedback = () => {
    const data = adminFeedback;
    const rows = data?.feedback || [];
    const search = adminFeedbackSearch.trim().toLowerCase();
    const visible = rows.filter((row) => {
      if (adminFeedbackFilter === "new" && !row.isNew) return false;
      if (adminFeedbackFilter === "comments" && !row.comment) return false;
      if (/^[1-5]$/.test(adminFeedbackFilter) && row.rating !== Number(adminFeedbackFilter)) return false;
      if (!search) return true;
      return [row.name, row.email, row.usn, row.department, row.testTitle, row.comment].some((value) => String(value || "").toLowerCase().includes(search));
    });
    const newCount = rows.filter((row) => row.isNew).length;
    const ratingCounts = [5, 4, 3, 2, 1].map((value) => ({ value, count: rows.filter((row) => row.rating === value).length }));
    const average = data?.averageRating;
    const formatWhen = (value) => (value ? new Date(value).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "");
    const chip = (id, label) => (
      <button key={id} onClick={() => setAdminFeedbackFilter(id)} style={{ ...S.adminButton(adminFeedbackFilter === id ? "run" : "default"), padding:"6px 12px", fontSize:13 }}>{label}</button>
    );

    return (
      <div style={{ display:"grid", gap:18 }}>
        <div style={S.adminCard}>
          <div style={{ display:"flex", justifyContent:"space-between", gap:12, flexWrap:"wrap", alignItems:"flex-start" }}>
            <div>
              <div style={S.adminSectionTitle}>Student Feedback</div>
              <div style={{ fontSize:24, fontWeight:800, color:ADMIN_THEME.text }}>
                {data ? `${data.count} responses` : "Feedback"}
                {newCount > 0 && <span style={{ marginLeft:10, fontSize:13, background:ADMIN_THEME.error, color:"#fff", borderRadius:999, padding:"3px 10px", verticalAlign:"middle" }}>{newCount} new</span>}
              </div>
              <div style={{ color:ADMIN_THEME.textSecondary, fontSize:14, marginTop:4 }}>
                Ratings and comments students leave after finishing a test. New ones are highlighted; the tab shows a badge when more arrive.
              </div>
            </div>
            <button onClick={loadAdminFeedback} disabled={adminFeedbackLoading} style={{ ...S.adminButton("default"), opacity:adminFeedbackLoading ? 0.6 : 1 }}>
              {adminFeedbackLoading ? "Loading..." : "Refresh"}
            </button>
          </div>

          {data && data.count > 0 && (
            <div style={{ display:"flex", gap:18, flexWrap:"wrap", alignItems:"center", marginTop:16 }}>
              <div style={{ fontSize:30, fontWeight:800, color:ADMIN_THEME.text }}>
                {average != null ? `${FEEDBACK_RATING_META[Math.round(average)]?.emoji || ""} ${average}` : "--"}
                <span style={{ fontSize:13, color:ADMIN_THEME.textMuted, fontWeight:600 }}> / 5 average</span>
              </div>
              <div style={{ display:"flex", gap:12, flexWrap:"wrap", fontSize:13, color:ADMIN_THEME.textSecondary }}>
                {ratingCounts.map(({ value, count }) => (
                  <span key={value}>{FEEDBACK_RATING_META[value].emoji} {FEEDBACK_RATING_META[value].label}: <strong style={{ color:ADMIN_THEME.text }}>{count}</strong></span>
                ))}
              </div>
            </div>
          )}
        </div>

        {adminFeedbackError && <div style={S.adminAlert("error")}>{adminFeedbackError}</div>}

        <div style={{ display:"flex", gap:8, flexWrap:"wrap", alignItems:"center" }}>
          {chip("all", "All")}
          {chip("new", `New (${newCount})`)}
          {chip("comments", "With comments")}
          {[5, 4, 3, 2, 1].map((value) => chip(String(value), `${FEEDBACK_RATING_META[value].emoji} ${value}`))}
          <input value={adminFeedbackSearch} onChange={(e) => setAdminFeedbackSearch(e.target.value)} placeholder="Search student, USN, test, comment" style={{ ...S.adminInput, width:isPhone ? "100%" : 280, padding:"8px 12px", marginLeft:isPhone ? 0 : "auto" }} />
        </div>

        <div style={{ display:"grid", gap:10 }}>
          {visible.length ? visible.map((row) => {
            const meta = FEEDBACK_RATING_META[row.rating] || { emoji: "❔", label: "No rating" };
            return (
              <div key={row.id} style={{ ...S.adminCard, padding:"14px 16px", display:"flex", gap:14, alignItems:"flex-start", borderLeft:row.isNew ? `4px solid ${ADMIN_THEME.primary}` : undefined, background:row.isNew ? ADMIN_THEME.primaryLight : undefined }}>
                <div style={{ textAlign:"center", minWidth:56 }}>
                  <div style={{ fontSize:30, lineHeight:1 }}>{meta.emoji}</div>
                  <div style={{ fontSize:11, fontWeight:700, color:ADMIN_THEME.textSecondary, marginTop:4 }}>{meta.label}</div>
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:"flex", gap:8, flexWrap:"wrap", alignItems:"center" }}>
                    {row.isNew && <span style={{ background:ADMIN_THEME.primary, color:"#fff", borderRadius:999, padding:"1px 8px", fontSize:10, fontWeight:800, letterSpacing:"0.06em" }}>NEW</span>}
                    <button type="button" onClick={() => row.userId && openStudentActivity(row.userId)} style={{ background:"none", border:"none", padding:0, cursor:"pointer", color:ADMIN_THEME.primary, fontWeight:700, fontSize:14 }}>{row.name}</button>
                    <span style={{ color:ADMIN_THEME.textMuted, fontSize:12 }}>{[row.usn, row.department].filter(Boolean).join(" · ")}</span>
                    <span style={{ color:ADMIN_THEME.textMuted, fontSize:12, marginLeft:"auto" }}>{formatWhen(row.updatedAt)}</span>
                  </div>
                  <div style={{ color:ADMIN_THEME.textSecondary, fontSize:13, marginTop:2 }}>Test: <strong style={{ color:ADMIN_THEME.text }}>{row.testTitle}</strong></div>
                  <div style={{ color:row.comment ? ADMIN_THEME.text : ADMIN_THEME.textMuted, fontSize:14, marginTop:8, whiteSpace:"pre-wrap", overflowWrap:"anywhere" }}>
                    {row.comment || "No comment, rating only."}
                  </div>
                </div>
              </div>
            );
          }) : (
            <div style={{ ...S.adminCard, textAlign:"center", color:ADMIN_THEME.textMuted }}>
              {adminFeedbackLoading ? "Loading feedback..." : rows.length ? "No feedback matches this filter." : "No feedback yet. Students can rate a test right after they finish it."}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderAdminEmailCard = () => {
    const status = adminEmailStatus;
    const job = status?.job;
    const sending = job?.status === "SENDING";
    const configured = status ? status.configured : true;
    const maxRecipients = status?.maxRecipients || 100;
    const students = status?.students || [];
    const updateEmail = (changes) => setAdminEmailForm((prev) => ({ ...prev, ...changes }));
    const jobLabel = { SENDING: "Sending", DONE: "Sent", PARTIAL: "Partly sent", FAILED: "Failed" };
    const disabled = adminEmailBusy || sending || !configured;

    // Students who already received an email with exactly this subject.
    const subjectKey = adminEmailForm.subject.trim().toLowerCase();
    const alreadySent = new Map();
    if (subjectKey) {
      (status?.history || []).forEach((log) => {
        if (String(log.subject || "").trim().toLowerCase() !== subjectKey) return;
        log.userIds.forEach((id) => { if (!alreadySent.has(id)) alreadySent.set(id, log.sentAt); });
      });
    }

    const selectedSet = new Set(adminEmailSelected);
    const departments = [...new Set(students.map((student) => student.department).filter(Boolean))].sort();
    const search = adminEmailPickerSearch.trim().toLowerCase();
    const visible = students.filter((student) => {
      if (adminEmailDepartment && student.department !== adminEmailDepartment) return false;
      if (adminEmailHideSent && alreadySent.has(student.id)) return false;
      if (!search) return true;
      return [student.name, student.email, student.usn].some((value) => String(value || "").toLowerCase().includes(search));
    });
    const selectedCount = adminEmailSelected.length;
    const remaining = maxRecipients - selectedCount;

    const toggleStudent = (id) => {
      if (selectedSet.has(id)) {
        setAdminEmailSelected(adminEmailSelected.filter((item) => item !== id));
      } else if (remaining > 0) {
        setAdminEmailSelected([...adminEmailSelected, id]);
      } else {
        setAdminEmailMessage({ type: "error", text: `You can select at most ${maxRecipients} students per email.` });
      }
    };
    // Adds visible, not-yet-selected students until the limit is reached.
    const fillFromVisible = () => {
      const additions = visible.filter((student) => !selectedSet.has(student.id)).slice(0, Math.max(0, remaining)).map((student) => student.id);
      setAdminEmailSelected([...adminEmailSelected, ...additions]);
      setAdminEmailMessage(null);
    };
    const notSentCount = subjectKey ? students.filter((student) => !alreadySent.has(student.id)).length : students.length;

    return (
      <div id="admin-email-students" style={S.adminCard}>
        <div style={S.adminSectionTitle}>Email Students</div>
        <div style={{ fontSize:20, fontWeight:800, color:ADMIN_THEME.text, marginBottom:6 }}>Announce a challenge by email</div>
        <div style={{ color:ADMIN_THEME.textSecondary, fontSize:14, marginBottom:14 }}>
          Pick up to {maxRecipients} students per email{status?.from ? `, sent from ${status.from}` : ""}. Each student gets their own email starting with "Hi &lt;name&gt;," and a button to open DevOrbit. Students who already got an email with the same subject are marked, so you can send to the next {maxRecipients} tomorrow. Use "Email students" on a challenge below to fill in the message.
        </div>

        {!configured && (
          <div style={{ marginBottom:14, padding:"10px 14px", borderRadius:10, fontSize:13, fontWeight:600, color:ADMIN_THEME.error, background:"rgba(220,38,38,0.08)", border:"1px solid rgba(220,38,38,0.25)" }}>
            Email is not set up on the server. Add RESEND_API_KEY and MAIL_FROM to backend/.env and restart.
          </div>
        )}
        {adminEmailMessage && (
          <div style={{ marginBottom:14, padding:"10px 14px", borderRadius:10, fontSize:13, fontWeight:600, color:adminEmailMessage.type === "error" ? ADMIN_THEME.error : ADMIN_THEME.success, background:adminEmailMessage.type === "error" ? "rgba(220,38,38,0.08)" : "rgba(22,163,74,0.08)", border:`1px solid ${adminEmailMessage.type === "error" ? "rgba(220,38,38,0.25)" : "rgba(22,163,74,0.25)"}` }}>
            {adminEmailMessage.text}
          </div>
        )}
        {job && (
          <div style={{ marginBottom:14, padding:"10px 14px", borderRadius:10, fontSize:13, color:ADMIN_THEME.text, border:`1px solid ${ADMIN_THEME.border}` }}>
            <strong>{jobLabel[job.status] || job.status}:</strong> "{job.subject}" · {job.sent} of {job.total} sent{job.failed ? ` · ${job.failed} failed` : ""}
            {job.errors?.length > 0 && <div style={{ color:ADMIN_THEME.error, marginTop:6 }}>{job.errors.join(" | ")}</div>}
          </div>
        )}

        <label style={{ display:"block", marginBottom:12 }}>
          <span style={S.adminFieldLabel}>Subject</span>
          <input value={adminEmailForm.subject} maxLength={150} onChange={(e) => updateEmail({ subject: e.target.value })} placeholder="e.g. Weekly Challenge #3 is live!" style={S.adminInput} />
        </label>
        <label style={{ display:"block", marginBottom:12 }}>
          <span style={S.adminFieldLabel}>Message</span>
          <textarea value={adminEmailForm.message} maxLength={5000} onChange={(e) => updateEmail({ message: e.target.value })} placeholder="What the challenge is, the dates, prizes and how to join." style={{ ...S.adminTextarea, minHeight:160 }} />
        </label>

        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:10, flexWrap:"wrap", marginBottom:8 }}>
          <span style={S.adminFieldLabel}>
            Recipients: <strong style={{ color:remaining < 0 ? ADMIN_THEME.error : ADMIN_THEME.text }}>{selectedCount} / {maxRecipients} selected</strong>
            {subjectKey && ` · ${students.length - notSentCount} already got this subject · ${notSentCount} not yet`}
          </span>
          <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
            <button onClick={fillFromVisible} disabled={remaining <= 0 || !visible.length} style={{ ...S.adminButton("default"), padding:"6px 10px", opacity:remaining <= 0 || !visible.length ? 0.6 : 1 }}>
              Select next {Math.max(0, Math.min(remaining, visible.filter((student) => !selectedSet.has(student.id)).length))}
            </button>
            <button onClick={() => setAdminEmailSelected([])} disabled={!selectedCount} style={{ ...S.adminButton("default"), padding:"6px 10px", opacity:selectedCount ? 1 : 0.6 }}>
              Clear
            </button>
          </div>
        </div>
        <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:8, alignItems:"center" }}>
          <input value={adminEmailPickerSearch} onChange={(e) => setAdminEmailPickerSearch(e.target.value)} placeholder="Search name, email or USN" style={{ ...S.adminInput, flex:"1 1 200px", padding:"8px 12px" }} />
          <select value={adminEmailDepartment} onChange={(e) => setAdminEmailDepartment(e.target.value)} style={{ ...S.adminInput, flex:"0 1 180px", padding:"8px 12px" }}>
            <option value="">All departments</option>
            {departments.map((department) => <option key={department} value={department}>{department}</option>)}
          </select>
          <label style={{ display:"flex", alignItems:"center", gap:6, fontSize:13, color:ADMIN_THEME.textSecondary, cursor:"pointer" }}>
            <input type="checkbox" checked={adminEmailHideSent} onChange={(e) => setAdminEmailHideSent(e.target.checked)} />
            Hide students who already got this subject
          </label>
        </div>
        <div style={{ maxHeight:300, overflowY:"auto", border:`1px solid ${ADMIN_THEME.border}`, borderRadius:12, marginBottom:14 }}>
          {visible.length ? visible.map((student) => {
            const checked = selectedSet.has(student.id);
            const sentAt = alreadySent.get(student.id);
            return (
              <label key={student.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 12px", borderTop:`1px solid ${ADMIN_THEME.divider}`, cursor:"pointer", background:checked ? ADMIN_THEME.primaryLight : "transparent", fontSize:13 }}>
                <input type="checkbox" checked={checked} onChange={() => toggleStudent(student.id)} />
                <span style={{ flex:"1 1 140px", minWidth:0, color:ADMIN_THEME.text, fontWeight:600, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{student.name}</span>
                {!isPhone && <span style={{ flex:"1 1 200px", minWidth:0, color:ADMIN_THEME.textSecondary, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{student.email}</span>}
                <span style={{ color:ADMIN_THEME.textMuted, minWidth:60 }}>{student.department || "--"}</span>
                {sentAt && <span style={{ color:ADMIN_THEME.success, fontSize:11, fontWeight:700 }}>✓ sent {new Date(sentAt).toLocaleDateString("en-IN", { day:"numeric", month:"short" })}</span>}
              </label>
            );
          }) : (
            <div style={{ padding:16, color:ADMIN_THEME.textMuted, fontSize:13 }}>
              {status ? (students.length ? "No students match this filter." : "No students yet.") : "Loading students..."}
            </div>
          )}
        </div>

        <div style={{ display:"flex", gap:10, flexWrap:"wrap", justifyContent:"flex-end" }}>
          <button onClick={() => sendAdminEmail("selected")} disabled={disabled || !selectedCount || remaining < 0} style={{ ...S.adminButton("run"), opacity:disabled || !selectedCount || remaining < 0 ? 0.6 : 1 }}>
            {sending ? `Sending ${job.sent}/${job.total}...` : `Send to ${selectedCount} selected student${selectedCount === 1 ? "" : "s"}`}
          </button>
        </div>

        {adminEmailConfirm && (() => {
          const byId = new Map(students.map((student) => [student.id, student]));
          const names = adminEmailSelected.map((id) => byId.get(id)?.name).filter(Boolean);
          const shownNames = names.slice(0, 6).join(", ") + (names.length > 6 ? ` and ${names.length - 6} more` : "");
          return (
            <div role="dialog" aria-modal="true" onClick={() => setAdminEmailConfirm(false)} style={{ position:"fixed", inset:0, zIndex:2000, background:"rgba(17,24,39,0.55)", backdropFilter:"blur(4px)", display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
              <div onClick={(e) => e.stopPropagation()} style={{ width:"100%", maxWidth:520, maxHeight:"90vh", overflowY:"auto", background:ADMIN_THEME.card, borderRadius:16, boxShadow:"0 20px 50px rgba(0,0,0,0.25)", padding:isPhone ? 18 : 24 }}>
                <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:14 }}>
                  <div style={{ width:44, height:44, borderRadius:12, background:ADMIN_THEME.primaryLight, display:"flex", alignItems:"center", justifyContent:"center", fontSize:22 }}>✉️</div>
                  <div>
                    <div style={{ fontSize:18, fontWeight:800, color:ADMIN_THEME.text }}>Send this email?</div>
                    <div style={{ fontSize:13, color:ADMIN_THEME.textSecondary }}>To {selectedCount} student{selectedCount === 1 ? "" : "s"}. This cannot be undone.</div>
                  </div>
                </div>
                <div style={{ border:`1px solid ${ADMIN_THEME.border}`, borderRadius:12, padding:"12px 14px", marginBottom:12, fontSize:13, color:ADMIN_THEME.textSecondary, display:"grid", gap:6 }}>
                  <div><strong style={{ color:ADMIN_THEME.text }}>Subject:</strong> {adminEmailForm.subject.trim()}</div>
                  <div><strong style={{ color:ADMIN_THEME.text }}>From:</strong> {status?.from || "--"}</div>
                  <div><strong style={{ color:ADMIN_THEME.text }}>To:</strong> {shownNames || `${selectedCount} students`}</div>
                </div>
                <div style={{ fontSize:12, fontWeight:700, color:ADMIN_THEME.textMuted, textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:6 }}>Message preview</div>
                <div style={{ background:ADMIN_THEME.background, border:`1px solid ${ADMIN_THEME.border}`, borderRadius:12, padding:"12px 14px", fontSize:13, color:ADMIN_THEME.text, whiteSpace:"pre-wrap", overflowWrap:"anywhere", maxHeight:180, overflowY:"auto", marginBottom:18 }}>
                  {`Hi <name>,\n\n${adminEmailForm.message.trim()}`}
                </div>
                <div style={{ display:"flex", gap:10, justifyContent:"flex-end", flexWrap:"wrap" }}>
                  <button onClick={() => setAdminEmailConfirm(false)} style={S.adminButton("default")}>Cancel</button>
                  <button onClick={() => sendAdminEmail("selected", true)} disabled={adminEmailBusy} style={{ ...S.adminButton("run"), opacity:adminEmailBusy ? 0.6 : 1 }}>
                    Send to {selectedCount} student{selectedCount === 1 ? "" : "s"}
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

        {adminEmailSending && (() => {
          const liveJob = !adminEmailSending.isTest && job && job.status === "SENDING" ? job : null;
          const total = liveJob ? liveJob.total : adminEmailSending.total;
          const done = liveJob ? liveJob.sent + liveJob.failed : 0;
          const percent = total ? Math.round((done / total) * 100) : 0;
          return (
            <div role="dialog" aria-modal="true" aria-live="polite" style={{ position:"fixed", inset:0, zIndex:2000, background:"rgba(17,24,39,0.6)", backdropFilter:"blur(4px)", display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
              <style>{`
                @keyframes dvMailFly { 0% { transform: translate(-70px, 26px) rotate(-8deg) scale(0.8); opacity: 0; } 15% { opacity: 1; } 55% { transform: translate(0, -6px) rotate(4deg) scale(1); opacity: 1; } 85% { opacity: 1; } 100% { transform: translate(80px, -40px) rotate(12deg) scale(0.75); opacity: 0; } }
                @keyframes dvMailTrail { 0% { transform: scaleX(0); opacity: 0; } 40% { opacity: 0.7; } 100% { transform: scaleX(1); opacity: 0; } }
                @keyframes dvMailPulse { 0%, 100% { transform: scale(1); opacity: 0.55; } 50% { transform: scale(1.18); opacity: 0.15; } }
                @keyframes dvMailStripes { from { background-position: 0 0; } to { background-position: 28px 0; } }
                @keyframes dvMailDots { 0%, 20% { content: "."; } 40% { content: ".."; } 60%, 100% { content: "..."; } }
                .dv-mail-dots::after { content: "..."; animation: dvMailDots 1.2s steps(1) infinite; }
                @media (prefers-reduced-motion: reduce) { .dv-mail-anim { animation: none !important; } }
              `}</style>
              <div style={{ width:"100%", maxWidth:400, background:ADMIN_THEME.card, borderRadius:18, boxShadow:"0 24px 60px rgba(0,0,0,0.3)", padding:"28px 24px 24px", textAlign:"center", overflow:"hidden" }}>
                <div style={{ position:"relative", height:120, marginBottom:8, display:"flex", alignItems:"center", justifyContent:"center" }}>
                  <div className="dv-mail-anim" style={{ position:"absolute", width:96, height:96, borderRadius:"50%", background:"linear-gradient(135deg,#6366f1,#a855f7)", animation:"dvMailPulse 1.6s ease-in-out infinite" }} />
                  <div style={{ position:"absolute", width:76, height:76, borderRadius:"50%", background:"linear-gradient(135deg,#4f46e5,#7c3aed)" }} />
                  <div className="dv-mail-anim" style={{ position:"absolute", left:"50%", top:"56%", width:70, height:2, marginLeft:-90, background:"linear-gradient(90deg, transparent, #c4b5fd)", transformOrigin:"left center", animation:"dvMailTrail 1.6s ease-in-out infinite" }} />
                  <div className="dv-mail-anim" style={{ position:"relative", fontSize:40, lineHeight:1, animation:"dvMailFly 1.6s ease-in-out infinite", filter:"drop-shadow(0 4px 6px rgba(0,0,0,0.25))" }}>✉️</div>
                </div>
                <div style={{ fontSize:19, fontWeight:800, color:ADMIN_THEME.text }}>
                  <span className="dv-mail-dots">{adminEmailSending.isTest ? "Sending test email" : "Sending emails"}</span>
                </div>
                <div style={{ fontSize:13, color:ADMIN_THEME.textSecondary, marginTop:6, marginBottom:18 }}>
                  {adminEmailSending.isTest ? `To ${adminEmailForm.testTo.trim()}` : liveJob ? `${liveJob.sent} of ${total} sent` : `Preparing ${total} email${total === 1 ? "" : "s"}`}
                </div>
                <div style={{ height:10, borderRadius:999, background:ADMIN_THEME.hoverBackground, overflow:"hidden" }}>
                  <div className="dv-mail-anim" style={{ height:"100%", width:liveJob ? `${Math.max(8, percent)}%` : "100%", borderRadius:999, transition:"width 0.6s ease", backgroundColor:"#6366f1", backgroundImage:"linear-gradient(45deg, rgba(255,255,255,0.28) 25%, transparent 25%, transparent 50%, rgba(255,255,255,0.28) 50%, rgba(255,255,255,0.28) 75%, transparent 75%, transparent)", backgroundSize:"28px 28px", animation:"dvMailStripes 0.8s linear infinite", opacity:liveJob ? 1 : 0.55 }} />
                </div>
                <div style={{ fontSize:12, color:ADMIN_THEME.textMuted, marginTop:12 }}>Please keep this page open.</div>
              </div>
            </div>
          );
        })()}

        {adminEmailResult && (
          <div role="dialog" aria-modal="true" onClick={() => setAdminEmailResult(null)} style={{ position:"fixed", inset:0, zIndex:2000, background:"rgba(17,24,39,0.55)", backdropFilter:"blur(4px)", display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
            <div onClick={(e) => e.stopPropagation()} style={{ width:"100%", maxWidth:420, background:ADMIN_THEME.card, borderRadius:16, boxShadow:"0 20px 50px rgba(0,0,0,0.25)", padding:24, textAlign:"center" }}>
              <style>{"@keyframes dvResultPop { 0% { transform: scale(0.3); opacity: 0; } 60% { transform: scale(1.15); opacity: 1; } 100% { transform: scale(1); } } @media (prefers-reduced-motion: reduce) { .dv-result-pop { animation: none !important; } }"}</style>
              <div className="dv-result-pop" style={{ width:56, height:56, margin:"0 auto 12px", borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", fontSize:28, background:adminEmailResult.type === "error" ? "rgba(220,38,38,0.1)" : "rgba(22,163,74,0.1)", animation:"dvResultPop 0.5s ease-out" }}>
                {adminEmailResult.type === "error" ? "⚠️" : "✅"}
              </div>
              <div style={{ fontSize:18, fontWeight:800, color:adminEmailResult.type === "error" ? ADMIN_THEME.error : ADMIN_THEME.text, marginBottom:6 }}>{adminEmailResult.title}</div>
              <div style={{ fontSize:14, color:ADMIN_THEME.textSecondary, marginBottom:18, overflowWrap:"anywhere" }}>{adminEmailResult.text}</div>
              <button onClick={() => setAdminEmailResult(null)} style={{ ...S.adminButton("run"), minWidth:120 }}>OK</button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderAdminChallenges = () => {
    const form = adminChallengeForm || createEmptyChallengeForm();
    const updateForm = (changes) => setAdminChallengeForm({ ...form, ...changes });
    const selectedIds = new Set(form.problemIds.map(String));
    const searchText = adminChallengeProblemSearch.trim().toLowerCase();
    const pickableProblems = problemCatalog
      .filter((problem) => problem.dbId)
      .filter((problem) => !searchText || problem.title.toLowerCase().includes(searchText) || String(problem.id).includes(searchText));
    const toggleProblem = (dbId) => {
      const id = String(dbId);
      updateForm({ problemIds: selectedIds.has(id) ? form.problemIds.filter((item) => String(item) !== id) : [...form.problemIds, id] });
    };
    const detail = adminChallengeDetail;

    return (
      <div style={{ display:"grid", gap:18 }}>
        <div style={S.adminCard}>
          <div style={S.adminSectionTitle}>Monthly Coding Challenge</div>
          <div style={{ fontSize:24, fontWeight:800, color:ADMIN_THEME.text, marginBottom:6 }}>{form.id ? "Edit challenge" : "Create this month's challenge"}</div>
          <div style={{ color:ADMIN_THEME.textSecondary, fontSize:14, marginBottom:16 }}>
            Students solve the chosen problems during the month (India time). Only accepted submissions made in that month count. Easy = 20, Medium = 35, Hard = 50 points; ties go to whoever reached the score first. The top 3 win the prizes below.
          </div>

          {adminChallengeMessage && (
            <div style={{ marginBottom:14, padding:"10px 14px", borderRadius:10, fontSize:13, fontWeight:600, color:adminChallengeMessage.type === "error" ? ADMIN_THEME.error : ADMIN_THEME.success, background:adminChallengeMessage.type === "error" ? "rgba(220,38,38,0.08)" : "rgba(22,163,74,0.08)", border:`1px solid ${adminChallengeMessage.type === "error" ? "rgba(220,38,38,0.25)" : "rgba(22,163,74,0.25)"}` }}>
              {adminChallengeMessage.text}
            </div>
          )}

          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(220px, 1fr))", gap:14, marginBottom:14 }}>
            <label>
              <span style={S.adminFieldLabel}>Month</span>
              <input type="month" value={form.month} onChange={(e) => updateForm({ month: e.target.value })} style={S.adminInput} />
            </label>
            <label>
              <span style={S.adminFieldLabel}>Title (optional)</span>
              <input value={form.title} maxLength={120} onChange={(e) => updateForm({ title: e.target.value })} placeholder="e.g. November Code Sprint" style={S.adminInput} />
            </label>
          </div>
          <label style={{ display:"block", marginBottom:14 }}>
            <span style={S.adminFieldLabel}>Description (optional)</span>
            <textarea value={form.description} maxLength={2000} onChange={(e) => updateForm({ description: e.target.value })} placeholder="Theme, rules or anything students should know." style={{ ...S.adminTextarea, minHeight:80 }} />
          </label>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(220px, 1fr))", gap:14, marginBottom:14 }}>
            {[0, 1, 2].map((index) => (
              <label key={index}>
                <span style={S.adminFieldLabel}>{PRIZE_MEDALS[index]} Prize for rank {index + 1}</span>
                <input
                  value={form.prizes[index] || ""}
                  maxLength={160}
                  onChange={(e) => updateForm({ prizes: form.prizes.map((prize, prizeIndex) => (prizeIndex === index ? e.target.value : prize)) })}
                  style={S.adminInput}
                />
              </label>
            ))}
          </div>

          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:12, flexWrap:"wrap", marginBottom:8 }}>
            <span style={S.adminFieldLabel}>Problems ({form.problemIds.length} selected)</span>
            <input value={adminChallengeProblemSearch} onChange={(e) => setAdminChallengeProblemSearch(e.target.value)} placeholder="Search problems" style={{ ...S.adminInput, width:240, padding:"9px 12px" }} />
          </div>
          <div style={{ maxHeight:280, overflowY:"auto", border:`1px solid ${ADMIN_THEME.border}`, borderRadius:12, marginBottom:16 }}>
            {pickableProblems.length ? pickableProblems.map((problem) => {
              const checked = selectedIds.has(String(problem.dbId));
              return (
                <label key={problem.dbId} style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 14px", borderTop:`1px solid ${ADMIN_THEME.divider}`, cursor:"pointer", background:checked ? ADMIN_THEME.primaryLight : "transparent" }}>
                  <input type="checkbox" checked={checked} onChange={() => toggleProblem(problem.dbId)} />
                  <span style={{ color:ADMIN_THEME.textMuted, fontSize:12, minWidth:32 }}>#{problem.id}</span>
                  <span style={{ flex:1, color:ADMIN_THEME.text, fontSize:14, fontWeight:600 }}>{problem.title}</span>
                  <span style={{ color:ADMIN_THEME.textSecondary, fontSize:12 }}>{formatDifficultyLabel(problem.difficulty)}</span>
                </label>
              );
            }) : (
              <div style={{ padding:16, color:ADMIN_THEME.textMuted, fontSize:13 }}>{problemCatalog.length ? "No problems match that search." : "No coding problems yet. Upload some in Question Uploads."}</div>
            )}
          </div>

          <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
            <button onClick={saveAdminChallenge} disabled={adminChallengeSaving} style={{ ...S.adminButton("run"), opacity:adminChallengeSaving ? 0.6 : 1 }}>
              {adminChallengeSaving ? "Saving..." : form.id ? "Save changes" : "Create challenge"}
            </button>
            {form.id && (
              <button onClick={() => { setAdminChallengeForm(createEmptyChallengeForm()); setAdminChallengeMessage(null); }} style={S.adminButton("default")}>
                Cancel edit
              </button>
            )}
          </div>
        </div>

        {renderAdminEmailCard()}

        <div style={S.adminTableWrap}>
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead>
              <tr>
                {["Month", "Challenge", "Status", "Problems", "Participants", "Top 3", "Actions"].map((heading) => (
                  <th key={heading} style={S.adminTableHead}>{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {adminChallenges.length ? adminChallenges.map((challenge) => (
                <tr key={challenge.id}>
                  <td style={S.adminTableCell}>{challenge.monthLabel}</td>
                  <td style={{ ...S.adminTableCell, fontWeight:700 }}>{challenge.title}</td>
                  <td style={S.adminTableCell}>{(CHALLENGE_STATUS_TONE[challenge.status] || CHALLENGE_STATUS_TONE.LIVE).label}</td>
                  <td style={S.adminTableCell}>{challenge.problems?.length || 0}</td>
                  <td style={S.adminTableCell}>{challenge.participantCount || 0}</td>
                  <td style={S.adminTableCell}>
                    {challenge.topThree?.length
                      ? challenge.topThree.map((row) => <div key={row.userId}>{PRIZE_MEDALS[row.rank - 1] || ""} {row.name} ({row.score})</div>)
                      : <span style={{ color:ADMIN_THEME.textMuted }}>--</span>}
                  </td>
                  <td style={S.adminTableCell}>
                    <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                      <button onClick={() => viewAdminChallengeStandings(challenge)} style={{ ...S.adminButton("default"), padding:"6px 10px" }}>Standings</button>
                      <button onClick={() => editAdminChallenge(challenge)} style={{ ...S.adminButton("default"), padding:"6px 10px" }}>Edit</button>
                      <button onClick={() => prefillChallengeEmail(challenge)} style={{ ...S.adminButton("default"), padding:"6px 10px" }}>Email students</button>
                      <button onClick={() => deleteAdminChallenge(challenge)} style={{ ...S.adminButton("default"), padding:"6px 10px", color:ADMIN_THEME.error }}>Delete</button>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="7" style={{ ...S.adminTableCell, textAlign:"center", color:ADMIN_THEME.textMuted }}>
                    {adminChallengesLoading ? "Loading challenges..." : "No monthly challenges yet. Create the first one above."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {detail && (
          <div style={S.adminCard}>
            <div style={{ display:"flex", justifyContent:"space-between", gap:12, flexWrap:"wrap", alignItems:"flex-start", marginBottom:12 }}>
              <div>
                <div style={S.adminSectionTitle}>Standings · {detail.monthLabel}</div>
                <div style={{ fontSize:20, fontWeight:800, color:ADMIN_THEME.text }}>{detail.title}</div>
                <div style={{ color:ADMIN_THEME.textSecondary, fontSize:13, marginTop:4 }}>
                  {formatChallengeDate(detail.startsAt)} to {formatChallengeDate(detail.endsAt)} · {detail.participantCount} participants · max {detail.maxScore} points
                  {detail.status !== "ENDED" && " · Winners are final when the month ends."}
                </div>
              </div>
              <button onClick={() => setAdminChallengeDetail(null)} style={S.adminButton("default")}>Close</button>
            </div>
            <div style={{ overflowX:"auto" }}>
              <table style={{ width:"100%", borderCollapse:"collapse" }}>
                <thead>
                  <tr>
                    {["Rank", "Student", "USN", "Department", "Score", "Solved", "Wrong tries", "Reached score at", "Prize"].map((heading) => (
                      <th key={heading} style={S.adminTableHead}>{heading}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {detail.standings.length ? detail.standings.map((row) => (
                    <tr key={row.userId} style={{ background:row.rank && row.rank <= 3 ? "rgba(217,119,6,0.06)" : "transparent" }}>
                      <td style={{ ...S.adminTableCell, fontWeight:800 }}>{row.rank ? `${PRIZE_MEDALS[row.rank - 1] || ""} ${row.rank}` : "--"}</td>
                      <td style={S.adminTableCell}>
                        <button type="button" onClick={() => openStudentActivity(row.userId)} style={{ background:"none", border:"none", padding:0, cursor:"pointer", color:ADMIN_THEME.primary, fontWeight:700, fontSize:"inherit", textDecoration:"underline" }}>{row.name}</button>
                      </td>
                      <td style={S.adminTableCell}>{row.usn || "--"}</td>
                      <td style={S.adminTableCell}>{row.department || "--"}</td>
                      <td style={{ ...S.adminTableCell, color:ADMIN_THEME.success, fontWeight:700 }}>{row.score}</td>
                      <td style={S.adminTableCell}>{row.solved} / {detail.problems.length}</td>
                      <td style={S.adminTableCell}>{row.wrongAttempts}</td>
                      <td style={S.adminTableCell}>{row.finishedAt ? formatChallengeDate(row.finishedAt) : "--"}</td>
                      <td style={S.adminTableCell}>{row.rank && row.rank <= 3 ? detail.prizes[row.rank - 1] : "--"}</td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan="9" style={{ ...S.adminTableCell, textAlign:"center", color:ADMIN_THEME.textMuted }}>No submissions for this challenge yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
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
                    <button type="button" onClick={() => openStudentActivity(entry.userId)} title="See everything this student has done" style={{ background:"none", border:"none", padding:0, cursor:"pointer", color:ADMIN_THEME.primary, fontWeight:700, fontSize:"inherit", textAlign:"left", textDecoration:"underline" }}>{entry.username}</button>
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

  // ── Student Activity: everything one student has done ───────────────────
  const openStudentActivity = async (userId) => {
    if (!userId) return;
    setActivityUserId(userId);
    setActivityData(null);
    setActivityError("");
    setActivityTab("problems");
    setActivityCode(null);
    try {
      const data = await performApiRequest(`/api/admin/reports/students/${userId}/activity`);
      setActivityData(data);
    } catch (error) {
      setActivityError(error.message || "Could not load this student's activity.");
    }
  };

  const openActivitySubmissionCode = async (submissionId) => {
    setActivityCode({ loading: true });
    try {
      const data = await performApiRequest(`/api/admin/reports/submissions/${submissionId}`);
      setActivityCode(data.submission || null);
    } catch (error) {
      setActivityCode({ error: error.message || "Could not load this submission." });
    }
  };

  const renderStudentActivityModal = () => {
    if (!activityUserId) return null;
    const close = () => { setActivityUserId(""); setActivityData(null); setActivityCode(null); };
    const student = activityData?.student;
    const stats = activityData?.stats || {};
    const rankEntry = leaderboard.find((entry) => sameValue(entry.userId, activityUserId));
    const when = (value) => (value ? formatPortalDate(value) : "--");
    const statusColor = (status) => (status === "ACCEPTED" || status === "Submitted" ? ADMIN_THEME.success
      : status === "Malpractice" || /ERROR|WRONG/.test(String(status)) ? ADMIN_THEME.error
        : ADMIN_THEME.warning);
    const cell = { ...S.adminTableCell, fontSize:13 };
    const tabs = [
      ["problems", `Problems (${stats.problemsSolved || 0} solved / ${stats.problemsTried || 0} tried)`],
      ["submissions", `Submissions (${stats.totalSubmissions || 0})`],
      ["exams", `Exams (${stats.examsTaken || 0})`],
    ];

    return (
      <div style={S.modalBackdrop} onClick={close}>
        <div
          onClick={(e) => e.stopPropagation()}
          style={{ width:"min(1040px, 96vw)", maxHeight:"calc(100vh - 40px)", overflowY:"auto", background:ADMIN_THEME.background, borderRadius:20, padding:22, display:"grid", gap:16, color:ADMIN_THEME.text, fontFamily:"'Outfit','Space Grotesk',sans-serif" }}
        >
          <div style={{ display:"flex", justifyContent:"space-between", gap:12, alignItems:"flex-start" }}>
            <div>
              <div style={S.adminSectionTitle}>Student Activity</div>
              <div style={{ fontSize:24, fontWeight:800 }}>{student?.name || "Loading..."}</div>
              {student && (
                <div style={{ color:ADMIN_THEME.textSecondary, fontSize:13, marginTop:4 }}>
                  {[student.usn !== "Not Available" ? student.usn : "", student.email, student.phone, student.department].filter(Boolean).join(" · ")}
                  <br />Joined {when(student.createdAt)} · Last login {when(student.lastLoginAt)} · {student.loginCount || 0} logins
                </div>
              )}
            </div>
            <button type="button" onClick={close} style={S.adminButton("default")}>✕ Close</button>
          </div>

          {activityError && <div style={S.adminAlert("error")}>{activityError}</div>}
          {!activityData && !activityError && <div style={{ ...S.adminCard, textAlign:"center", color:ADMIN_THEME.textSecondary }}>Loading activity...</div>}

          {activityData && (
            <>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(150px, 1fr))", gap:12 }}>
                {[
                  ["Leaderboard rank", rankEntry?.overall?.rank ? `#${rankEntry.overall.rank}` : "--", rankEntry?.overall?.score ? `${rankEntry.overall.score} points` : ""],
                  ["Problems solved", stats.problemsSolved || 0, Object.entries(stats.solvedByDifficulty || {}).map(([d, n]) => `${d} ${n}`).join(" · ")],
                  ["Submissions", stats.totalSubmissions || 0, `${stats.acceptedSubmissions || 0} accepted (${stats.acceptanceRate || 0}%)`],
                  ["Active days", stats.activeDays || 0, stats.lastActivityAt ? `last ${when(stats.lastActivityAt)}` : "no submissions yet"],
                  ["Exams taken", stats.examsTaken || 0, ""],
                  ["Languages", Object.keys(stats.languages || {}).length || 0, Object.entries(stats.languages || {}).map(([l, n]) => `${l} ${n}`).join(" · ")],
                ].map(([label, value, hint]) => (
                  <div key={label} style={S.adminCard}>
                    <div style={{ ...S.adminSectionTitle, marginBottom:6 }}>{label}</div>
                    <div style={{ fontSize:26, fontWeight:800, color:ADMIN_THEME.primary }}>{value}</div>
                    {hint && <div style={{ color:ADMIN_THEME.textSecondary, fontSize:12, marginTop:4 }}>{hint}</div>}
                  </div>
                ))}
              </div>

              <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                {tabs.map(([id, label]) => (
                  <button key={id} type="button" onClick={() => setActivityTab(id)} style={S.adminButton(activityTab === id ? "submit" : "default")}>{label}</button>
                ))}
              </div>

              <div style={S.adminTableWrap}>
                <table style={{ width:"100%", borderCollapse:"collapse" }}>
                  {activityTab === "problems" && (
                    <>
                      <thead><tr>{["Problem", "Difficulty", "Status", "Attempts", "Solved on", "Language"].map((h) => <th key={h} style={S.adminTableHead}>{h}</th>)}</tr></thead>
                      <tbody>
                        {activityData.problems.length ? activityData.problems.map((p) => (
                          <tr key={p.problemId}>
                            <td style={{ ...cell, fontWeight:700 }}>{p.title}</td>
                            <td style={cell}>{p.difficulty}</td>
                            <td style={{ ...cell, color:p.solved ? ADMIN_THEME.success : ADMIN_THEME.warning, fontWeight:700 }}>{p.solved ? "Solved" : "Tried, not solved"}</td>
                            <td style={cell}>{p.attempts}</td>
                            <td style={cell}>{p.solved ? when(p.solvedAt) : "--"}</td>
                            <td style={cell}>{p.languages.join(", ") || "--"}</td>
                          </tr>
                        )) : <tr><td colSpan="6" style={{ ...cell, textAlign:"center", color:ADMIN_THEME.textMuted }}>No practice problems tried yet.</td></tr>}
                      </tbody>
                    </>
                  )}
                  {activityTab === "submissions" && (
                    <>
                      <thead><tr>{["When", "Problem", "Language", "Result", "Run time", "Code"].map((h) => <th key={h} style={S.adminTableHead}>{h}</th>)}</tr></thead>
                      <tbody>
                        {activityData.submissions.length ? activityData.submissions.map((sub) => (
                          <tr key={sub.id}>
                            <td style={cell}>{when(sub.createdAt)}</td>
                            <td style={{ ...cell, fontWeight:700 }}>{sub.title} <span style={{ color:ADMIN_THEME.textMuted, fontWeight:400 }}>({sub.difficulty})</span></td>
                            <td style={cell}>{sub.language || "--"}</td>
                            <td style={{ ...cell, color:statusColor(sub.status), fontWeight:700 }}>{String(sub.status || "").replace(/_/g, " ")}</td>
                            <td style={cell}>{sub.timeMs != null ? `${sub.timeMs} ms` : "--"}</td>
                            <td style={cell}><button type="button" onClick={() => openActivitySubmissionCode(sub.id)} style={S.adminButton("default")}>View code</button></td>
                          </tr>
                        )) : <tr><td colSpan="6" style={{ ...cell, textAlign:"center", color:ADMIN_THEME.textMuted }}>No submissions yet.</td></tr>}
                        {activityData.submissions.length >= 100 && <tr><td colSpan="6" style={{ ...cell, textAlign:"center", color:ADMIN_THEME.textMuted }}>Showing the latest 100 submissions.</td></tr>}
                      </tbody>
                    </>
                  )}
                  {activityTab === "exams" && (
                    <>
                      <thead><tr>{["Test", "Result", "Score", "Warnings", "Started", "Note"].map((h) => <th key={h} style={S.adminTableHead}>{h}</th>)}</tr></thead>
                      <tbody>
                        {activityData.exams.length ? activityData.exams.map((exam) => (
                          <tr key={exam.assignmentId}>
                            <td style={{ ...cell, fontWeight:700 }}>{exam.title}</td>
                            <td style={{ ...cell, color:statusColor(exam.result), fontWeight:700 }}>{exam.result}</td>
                            <td style={cell}>{exam.score != null ? `${exam.score} / ${exam.maxScore} (${exam.percentage}%)` : "--"}</td>
                            <td style={{ ...cell, color:exam.warnings ? ADMIN_THEME.error : ADMIN_THEME.textSecondary }}>{exam.warnings}</td>
                            <td style={cell}>{when(exam.startedAt)}</td>
                            <td style={{ ...cell, color:ADMIN_THEME.textSecondary }}>{exam.finishReason || "--"}</td>
                          </tr>
                        )) : <tr><td colSpan="6" style={{ ...cell, textAlign:"center", color:ADMIN_THEME.textMuted }}>No exams taken yet.</td></tr>}
                      </tbody>
                    </>
                  )}
                </table>
              </div>
            </>
          )}

          {activityCode && (
            <div style={S.adminCard}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:12, marginBottom:10 }}>
                <div style={{ fontWeight:800 }}>
                  {activityCode.loading ? "Loading code..." : activityCode.error ? "Code" : `${activityCode.problem?.title || "Submission"} · ${activityCode.language || ""} · ${String(activityCode.status || "").replace(/_/g, " ")}`}
                </div>
                <button type="button" onClick={() => setActivityCode(null)} style={S.adminButton("default")}>Hide code</button>
              </div>
              {activityCode.error && <div style={S.adminAlert("error")}>{activityCode.error}</div>}
              {!activityCode.loading && !activityCode.error && (
                <pre style={{ margin:0, background:"#0f172a", color:"#e2e8f0", padding:14, borderRadius:12, overflowX:"auto", fontSize:12.5, lineHeight:1.5, maxHeight:420, fontFamily:"'JetBrains Mono',monospace" }}>{activityCode.code || "(no code saved)"}</pre>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  // ── Live Monitor: what every student in a test is doing right now ──────────
  const renderLiveMonitor = () => {
    const testOptions = [...adminAssignments].sort((a, b) => Number(b.status === "LIVE") - Number(a.status === "LIVE"));
    const students = Array.isArray(monitorData?.students) ? monitorData.students : [];
    const summary = monitorData?.summary || {};
    const isFlagged = (s) => Boolean(s.cameraIssue || s.phoneDetected || s.faceMissing);
    const query = monitorSearch.trim().toLowerCase();
    const visible = students.filter((s) => {
      if (monitorFilter === "writing" && s.state !== "Writing") return false;
      if (monitorFilter === "flagged" && !isFlagged(s) && s.state !== "Malpractice") return false;
      if (monitorFilter === "inactive" && s.state !== "Inactive") return false;
      if (monitorFilter === "done" && !["Submitted", "Auto-submitted"].includes(s.state)) return false;
      if (!query) return true;
      return [s.name, s.email, s.usn, s.phone].some((value) => String(value || "").toLowerCase().includes(query));
    });
    const stateColors = {
      Writing: ADMIN_THEME.success,
      Inactive: ADMIN_THEME.warning,
      Malpractice: ADMIN_THEME.error,
      Submitted: ADMIN_THEME.primary,
      "Auto-submitted": ADMIN_THEME.secondary,
    };
    const ago = (value) => {
      if (!value) return "never";
      const seconds = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 1000));
      if (seconds < 60) return `${seconds}s ago`;
      if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
      return `${Math.floor(seconds / 3600)}h ago`;
    };
    const timeLeft = (seconds) => {
      if (!seconds) return "--";
      const h = Math.floor(seconds / 3600);
      const m = Math.floor((seconds % 3600) / 60);
      return h ? `${h}h ${m}m` : `${m}m ${String(seconds % 60).padStart(2, "0")}s`;
    };
    const filters = [
      ["all", `All (${summary.started || 0})`],
      ["writing", `Writing now (${summary.writing || 0})`],
      ["flagged", `Flagged (${(summary.flaggedNow || 0) + (summary.malpractice || 0)})`],
      ["inactive", `Inactive (${summary.inactive || 0})`],
      ["done", `Submitted (${summary.submitted || 0})`],
    ];

    return (
      <div style={{ display:"grid", gap:18 }}>
        <div style={{ ...S.adminCard, display:"flex", justifyContent:"space-between", gap:16, alignItems:"center", flexWrap:"wrap" }}>
          <div>
            <div style={S.adminSectionTitle}>Live Monitor</div>
            <div style={{ color:ADMIN_THEME.text, fontSize:22, fontWeight:800 }}>What students are doing now</div>
            <div style={{ color:ADMIN_THEME.textSecondary, fontSize:13, marginTop:4 }}>
              Each student checks in about every 30 seconds with their progress, camera status and a camera photo. Refreshes every 15 seconds.
              {monitorData?.generatedAt ? ` Updated ${ago(monitorData.generatedAt)}.` : ""}
            </div>
          </div>
          <select
            value={monitorTestId}
            onChange={(e) => { setMonitorData(null); setMonitorTestId(e.target.value); }}
            style={{ ...S.adminInput, width:"min(420px, 100%)" }}
          >
            {!testOptions.length && <option value="">No tests yet</option>}
            {testOptions.map((assignment) => (
              <option key={assignment.id} value={assignment.id}>
                {assignment.status === "LIVE" ? "🟢 " : ""}{assignment.title} ({assignment.status})
              </option>
            ))}
          </select>
        </div>

        {monitorError && <div style={S.adminAlert("error")}>{monitorError}</div>}

        {!monitorTestId ? (
          <div style={{ ...S.adminCard, textAlign:"center", color:ADMIN_THEME.textSecondary }}>No live test right now. Pick a test above to see its students.</div>
        ) : !monitorData ? (
          <div style={{ ...S.adminCard, textAlign:"center", color:ADMIN_THEME.textSecondary }}>Loading students...</div>
        ) : (
          <>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(150px, 1fr))", gap:12 }}>
              {[
                ["Started", summary.started, ADMIN_THEME.text],
                ["Writing now", summary.writing, ADMIN_THEME.success],
                ["Camera / phone flag now", summary.flaggedNow, ADMIN_THEME.error],
                ["Inactive (90s+)", summary.inactive, ADMIN_THEME.warning],
                ["Malpractice", summary.malpractice, ADMIN_THEME.error],
                ["Submitted", summary.submitted, ADMIN_THEME.primary],
              ].map(([label, value, color]) => (
                <div key={label} style={S.adminCard}>
                  <div style={{ ...S.adminSectionTitle, marginBottom:6 }}>{label}</div>
                  <div style={{ fontSize:28, fontWeight:800, color }}>{value || 0}</div>
                </div>
              ))}
            </div>

            <div style={{ ...S.adminCard, display:"flex", gap:10, flexWrap:"wrap", alignItems:"center" }}>
              {filters.map(([id, label]) => (
                <button key={id} type="button" onClick={() => setMonitorFilter(id)} style={S.adminButton(monitorFilter === id ? "submit" : "default")}>
                  {label}
                </button>
              ))}
              <input
                value={monitorSearch}
                onChange={(e) => setMonitorSearch(e.target.value)}
                placeholder="Search name, email, USN, mobile"
                style={{ ...S.adminInput, width:"min(320px, 100%)", marginLeft:"auto" }}
              />
            </div>

            {!visible.length ? (
              <div style={{ ...S.adminCard, textAlign:"center", color:ADMIN_THEME.textSecondary }}>
                {students.length ? "No students match this filter." : "No student has started this test yet."}
              </div>
            ) : (
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(260px, 1fr))", gap:14 }}>
                {visible.map((s) => {
                  const color = stateColors[s.state] || ADMIN_THEME.textSecondary;
                  const flags = [
                    s.cameraIssue && `📷 ${s.cameraIssue}`,
                    s.phoneDetected && "📱 Phone detected",
                    s.faceMissing && "🙈 Face not visible",
                  ].filter(Boolean);
                  const progressPct = s.totalQuestions ? Math.round(((s.answered || 0) / s.totalQuestions) * 100) : 0;
                  return (
                    <div key={s.attemptId} style={{ ...S.adminCard, padding:0, overflow:"hidden", border:`1px solid ${flags.length || s.state === "Malpractice" ? ADMIN_THEME.error : ADMIN_THEME.border}` }}>
                      <div style={{ position:"relative", background:"#0f172a", height:150, display:"flex", alignItems:"center", justifyContent:"center" }}>
                        {s.snapshot ? (
                          <img src={s.snapshot} alt={`Camera of ${s.name}`} style={{ width:"100%", height:"100%", objectFit:"cover", transform:"scaleX(-1)" }} />
                        ) : (
                          <span style={{ color:"#94a3b8", fontSize:12 }}>{["Writing", "Inactive"].includes(s.state) ? "No camera photo yet" : "Exam finished"}</span>
                        )}
                        <span style={{ position:"absolute", top:8, left:8, background:color, color:"#fff", fontSize:11, fontWeight:800, padding:"3px 9px", borderRadius:999 }}>{s.state}</span>
                        {s.snapshotAt && <span style={{ position:"absolute", bottom:6, right:8, color:"#e2e8f0", fontSize:10, background:"rgba(15,23,42,0.7)", padding:"2px 6px", borderRadius:6 }}>photo {ago(s.snapshotAt)}</span>}
                      </div>
                      <div style={{ padding:"12px 14px", display:"grid", gap:8 }}>
                        <div>
                          <div style={{ color:ADMIN_THEME.text, fontWeight:800 }}>{s.name}</div>
                          <div style={{ color:ADMIN_THEME.textSecondary, fontSize:12 }}>{[s.usn, s.email, s.phone].filter(Boolean).join(" · ")}</div>
                        </div>
                        {flags.length > 0 && (
                          <div style={{ display:"grid", gap:4 }}>
                            {flags.map((flag) => (
                              <div key={flag} style={{ background:"#FEF2F2", color:ADMIN_THEME.error, fontSize:12, fontWeight:700, padding:"4px 8px", borderRadius:8 }}>{flag}</div>
                            ))}
                          </div>
                        )}
                        <div>
                          <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, color:ADMIN_THEME.textSecondary }}>
                            <span>Answered {s.answered ?? "?"} / {s.totalQuestions || "?"}</span>
                            <span>Time left {timeLeft(s.timeLeftSeconds)}</span>
                          </div>
                          <div style={{ height:6, background:ADMIN_THEME.hoverBackground, borderRadius:999, marginTop:4 }}>
                            <div style={{ width:`${progressPct}%`, height:"100%", background:ADMIN_THEME.success, borderRadius:999 }} />
                          </div>
                        </div>
                        {s.state === "Writing" && s.currentQuestion ? (
                          <div style={{ fontSize:12, color:ADMIN_THEME.text }}>On question {s.currentQuestion}: <span style={{ color:ADMIN_THEME.textSecondary }}>{s.currentTitle}</span></div>
                        ) : null}
                        <div style={{ fontSize:12, color:s.warnings ? ADMIN_THEME.error : ADMIN_THEME.textSecondary, fontWeight:s.warnings ? 700 : 400 }}>
                          ⚠ {s.warnings} warning{s.warnings === 1 ? "" : "s"}
                          {s.recentEvents?.length ? <span style={{ fontWeight:400, color:ADMIN_THEME.textSecondary }}> · last: {s.recentEvents[0].reason}</span> : null}
                        </div>
                        <div style={{ fontSize:11, color:ADMIN_THEME.textMuted }}>
                          {s.finishReason && !["Writing", "Inactive"].includes(s.state) ? `${s.finishReason} · ` : ""}Last seen {ago(s.lastSeenAt)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    );
  };

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
              {["Student", "Mobile", "Department", "Badge", "Status", "Last Login", "Logins"].map((heading) => (
                <th key={heading} style={S.adminTableHead}>{heading}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {registeredStudents.length ? registeredStudents.map((student) => (
              <tr key={`${student.email}-${student.id}`}>
                <td style={S.adminTableCell}>
                  <button type="button" onClick={() => openStudentActivity(student.id)} title="See everything this student has done" style={{ background:"none", border:"none", padding:0, cursor:"pointer", color:ADMIN_THEME.primary, fontWeight:700, fontSize:"inherit", textAlign:"left", textDecoration:"underline" }}>{student.name}</button>
                  <div style={{ color:ADMIN_THEME.textSecondary, fontSize:12, marginTop:4 }}>{student.email}</div>
                </td>
                <td style={S.adminTableCell}>{student.phone || "--"}</td>
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
            <div style={{ color:ADMIN_THEME.primary, fontWeight:800, fontSize:24 }}>{currentUser.loginCount || 0}</div>
          </div>
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
      <ScreenShield active={shieldActive} message={shieldActiveMessage} title={shieldTitle} action={shieldAction} />
      {renderFullscreenGate()}
      {renderLiveTestPopupModal()}
      <div style={{ ...S.app, opacity: shieldActive ? 0 : 1, pointerEvents: shieldActive ? "none" : "auto", transition: "opacity 0.12s ease", userSelect: shieldActive ? "none" : "auto" }}>
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
              <div style={{ marginBottom:18 }}>
                <DevOrbitLogo showBrand showPartner={false} />
              </div>
              <div style={{ color:"#4fd1c5", fontSize:12, fontWeight:700, letterSpacing:"0.12em", textTransform:"uppercase", fontFamily:"'Space Grotesk',sans-serif", marginBottom:12 }}>Access Flow</div>
              <h1 style={{ ...S.problemTitle, fontSize:38, marginBottom:12 }}>{IS_ADMIN_ENTRY ? "Admin portal." : "Enter the portal."}</h1>
              <p style={{ ...S.problemBody, marginBottom:24 }}>
                {IS_ADMIN_ENTRY
                  ? "Admin login only. Sign in with the admin mail ID and password."
                  : "Login uses only mail ID and password. Sign up collects the extra details needed for student access."}
              </p>

              <div style={{ display:"grid", gap:18 }}>
                {!IS_ADMIN_ENTRY && (
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
                          <label style={S.fieldLabel}>Mobile Number</label>
                          <input
                            type="tel"
                            inputMode="numeric"
                            autoComplete="tel"
                            maxLength={16}
                            value={authPhone}
                            onChange={e=>{ setAuthPhone(e.target.value); if (authError) setAuthError(""); }}
                            style={S.input}
                            placeholder="10-digit mobile number"
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
                      <input value={authEmail} onChange={e=>{ setAuthEmail(e.target.value); if (authError) setAuthError(""); }} style={S.input} placeholder={IS_ADMIN_ENTRY ? "admin email" : "name@gmail.com"} />
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

  // The student's current exam answers, including code typed in the editor but not yet run.
  const collectExamAnswers = () => {
    const codingAnswers = { ...candidateCodingAnswers };
    const problem = selectedProblem;
    const isContestProblem = problem && contestProblemSet.some((item) => sameValue(item.id, problem.id));
    const isTheory = problem && (problem.type === "theory" || (Array.isArray(problem.options) && problem.options.length > 0));
    const isStarterCode = problem && String(code || "").trim() === String(problem.starterCode?.[lang] || "").trim();
    if (contestEntered && isContestProblem && !isTheory && String(code || "").trim() && !isStarterCode) {
      const previous = codingAnswers[problem.dbId] || codingAnswers[problem.id] || {};
      if (previous.code !== code) {
        const entry = { ...previous, code, language: lang };
        if (problem.id) codingAnswers[problem.id] = entry;
        if (problem.dbId) codingAnswers[problem.dbId] = entry;
      }
    }
    return { theoryAnswers: candidateTheoryAnswers, codingAnswers };
  };
  collectExamAnswersRef.current = collectExamAnswers;

  // Live Monitor check-in: how far the student is and what the camera checks see right now.
  const collectLiveProgress = () => {
    const { theoryAnswers, codingAnswers } = collectExamAnswers();
    const keysOf = (problem) => [problem.dbId, problem.id, problem.legacyId].filter(Boolean);
    const answered = contestProblemSet.filter((problem) => keysOf(problem).some((key) => (
      String(theoryAnswers[key] ?? "").trim() !== "" || String(codingAnswers[key]?.code ?? "").trim() !== ""
    ))).length;
    const currentIndex = selectedProblem
      ? contestProblemSet.findIndex((problem) => sameValue(problem.id, selectedProblem.id))
      : -1;
    return {
      answered,
      total: contestProblemSet.length,
      current: currentIndex >= 0 ? currentIndex + 1 : 0,
      currentTitle: currentIndex >= 0 ? String(contestProblemSet[currentIndex].title || "").slice(0, 120) : "",
      cameraIssue,
      phoneDetected,
      faceMissing,
    };
  };
  liveProgressRef.current = collectLiveProgress;

  const handleFinalSubmitAssessment = async () => {
    const testId = activeContestAssignment?.id || adminCurrentTest?.id;
    if (!testId) return;

    const finishExamScreen = () => {
      setFinalSubmitConfirmOpen(false);
      setContestEntered(false);
      showThankYouScreen({ id: testId, title: activeContestAssignment?.title || adminCurrentTest?.title || "Assessment" });
    };

    setSubmittingAssessment(true);
    const answers = collectExamAnswers();
    // Save the answers first (small, quick request). If grading below cannot reach the server,
    // the server submits these saved answers by itself within a few minutes.
    let answersSaved = false;
    try {
      await performApiRequest(`/api/tests/${testId}/attempts/draft`, {
        method: "POST",
        body: JSON.stringify({ ...answers, final: true }),
      });
      answersSaved = true;
    } catch {}

    try {
      await performApiRequest(`/api/tests/${testId}/submit`, {
        method: "POST",
        body: JSON.stringify(answers),
      });
      finishExamScreen();
    } catch (err) {
      if (answersSaved) {
        finishExamScreen();
        setPortalMessage("Your answers are saved. Your exam will be submitted automatically within a few minutes.");
      } else {
        setPortalError(err.message || "Failed to submit assessment.");
      }
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
      "USN",
      "Mobile",
      "Email",
      "Department",
      "Total Score",
      "Max Score",
      "Percentage",
      "Theory Score",
      "Coding Score",
      "Result",
      "Warnings",
      "Finish Reason",
      "Time Used (Mins)",
      "Submission Date"
    ];
    const csvText = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;

    const rows = students.map((s) => [
      s.rank || "-",
      `"${s.studentName || s.student?.name || 'Unknown Student'}"`,
      csvText(s.studentUsn || s.student?.usn || "Not Available"),
      csvText(s.studentPhone || "Not Available"),
      `"${s.studentEmail || s.student?.email || 'Not Available'}"`,
      `"${s.studentDepartment || s.student?.department || 'Not Available'}"`,
      s.totalScore,
      s.maxScore,
      `"${s.percentage}%"`,
      s.theoryScore,
      s.codingScore,
      csvText(s.result || s.status),
      s.warnings || 0,
      csvText(s.finishReason),
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
                <div style={{ color: ADMIN_THEME.textSecondary, fontSize: 12, fontWeight: 700 }}>TOOK THE EXAM</div>
                <div style={{ fontSize: 26, fontWeight: 800, color: "#38bdf8", marginTop: 4 }}>{stats.totalStudents || 0}</div>
                <div style={{ color: "#94a3b8", fontSize: 11, marginTop: 4 }}>{stats.completedStudents || 0} Graded</div>
              </div>

              <div style={{ ...S.adminSubCard, background: "rgba(30, 41, 59, 0.7)", border: "1px solid #334155" }}>
                <div style={{ color: ADMIN_THEME.textSecondary, fontSize: 12, fontWeight: 700 }}>RESULTS</div>
                <div style={{ display: "grid", gap: 3, marginTop: 6, fontSize: 12, fontWeight: 700 }}>
                  <span style={{ color: "#4ade80" }}>Submitted: {stats.submitted || 0}</span>
                  <span style={{ color: "#38bdf8" }}>Auto-submitted: {stats.autoSubmitted || 0}</span>
                  <span style={{ color: "#f87171" }}>Malpractice: {stats.malpractice || 0}</span>
                  <span style={{ color: "#facc15" }}>Not submitted: {(stats.notSubmitted || 0) + (stats.inProgress || 0)}</span>
                </div>
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
                        <th style={{ padding: "10px" }}>Result</th>
                        <th style={{ padding: "10px" }}>Time Used</th>
                        <th style={{ padding: "10px", textAlign: "right" }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredStudents.map((s) => (
                        <tr key={s.submissionId || `attempt-${s.userId}`} style={{ borderBottom: `1px solid ${ADMIN_THEME.divider}` }}>
                          <td style={{ padding: "12px 10px", fontWeight: 800 }}>
                            {s.rank === 1 ? "🥇 1" : s.rank === 2 ? "🥈 2" : s.rank === 3 ? "🥉 3" : (s.rank || "—")}
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
                            {(() => {
                              const result = s.result || s.status;
                              const color = /^Malpractice/.test(result) ? "#f87171" : /^Auto/.test(result) ? "#38bdf8" : /^Submitted|^Completed/.test(result) ? "#4ade80" : "#facc15";
                              return (
                                <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: "rgba(148, 163, 184, 0.12)", color, border: `1px solid ${color}55`, whiteSpace: "nowrap" }}>
                                  {result}
                                </span>
                              );
                            })()}
                            {s.warnings > 0 && (
                              <div style={{ color: "#fca5a5", fontSize: 11, marginTop: 4 }}>⚠ {s.warnings} warning{s.warnings === 1 ? "" : "s"}</div>
                            )}
                          </td>
                          <td style={{ padding: "12px 10px", color: ADMIN_THEME.textSecondary }}>{s.timeUsedMinutes} mins</td>
                          <td style={{ padding: "12px 10px", textAlign: "right" }}>
                            {s.submissionId ? (
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
                            ) : (
                              <span style={{ color: ADMIN_THEME.textSecondary, fontSize: 11 }}>{s.finishReason || "No answers graded"}</span>
                            )}
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
            <button
              type="button"
              onClick={downloadProctoringReport}
              style={{
                border: "none",
                cursor: "pointer",
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
            </button>
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
                <th style={{ padding: "14px 16px", color: "#888", fontWeight: 700 }}>Test Score</th>
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
                  <td colSpan={8} style={{ padding: 24, textAlign: "center", color: "#666" }}>
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
                    <td style={{ padding: "14px 16px", whiteSpace: "nowrap" }}>
                      {r.score === null || r.score === undefined ? (
                        <span style={{ color: "#666", fontSize: 12 }}>Not submitted</span>
                      ) : (
                        <span style={{ fontSize: 15, fontWeight: 800, color: "#60a5fa" }}>
                          {r.score}{r.maxScore ? <span style={{ color: "#888", fontWeight: 600, fontSize: 12 }}> / {r.maxScore}</span> : null}
                        </span>
                      )}
                    </td>
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



  const formatAdminStatus = (status) => {
    const value = String(status || "DRAFT").toUpperCase();
    return value.charAt(0) + value.slice(1).toLowerCase();
  };
  const adminStatusPill = (status) => {
    const value = String(status || "DRAFT").toUpperCase();
    const tone = value === "LIVE"
      ? { color:"#15803D", background:"#ECFDF3" }
      : value === "SCHEDULED"
        ? { color:"#A15C07", background:"#FEF6E7" }
        : value === "ENDED"
          ? { color:"#57534E", background:"#F0EFED" }
          : { color:"#1D3FCF", background:"#EEF2FD" };
    return { ...tone, fontSize:12, fontWeight:500, padding:"3px 8px", borderRadius:4 };
  };
  const adminLevelColor = (level) => {
    const value = String(level || "").toLowerCase();
    if (value === "hard") return "#B42318";
    if (value === "medium") return "#A15C07";
    if (value === "easy") return "#15803D";
    return ADMIN_THEME.textSecondary;
  };

  const renderOverviewStats = () => {
    const liveCount = liveAdminAssignments.length;
    const stats = [
      { label: "Assessments", value: adminAssignments.length },
      { label: "Registered students", value: registeredStudents.length || participantsCount || 0 },
      { label: "Live now", value: liveCount, note: liveCount ? `${liveCount === 1 ? "test" : "tests"} running` : "no test running", live: liveCount > 0 },
      { label: "Pending drafts", value: adminAssignments.filter((a) => a.status === "DRAFT" || !a.status).length },
    ];

    return (
      <div style={{ ...S.adminCard, padding:0, display:"grid", gridTemplateColumns:`repeat(${isPhone ? 2 : 4}, minmax(0,1fr))`, overflow:"hidden" }}>
        {stats.map((stat, index) => (
          <div key={stat.label} style={{ padding:isPhone ? "16px" : "20px 20px 18px", borderLeft:(isPhone ? index % 2 : index) ? `1px solid ${ADMIN_THEME.divider}` : "none", borderTop:isPhone && index >= 2 ? `1px solid ${ADMIN_THEME.divider}` : "none", minWidth:0 }}>
            <div style={{ color:ADMIN_THEME.textSecondary, fontSize:12 }}>{stat.label}</div>
            <div style={{ display:"flex", alignItems:"baseline", gap:10, marginTop:8 }}>
              <span style={{ fontSize:isPhone ? 22 : 26, fontWeight:600, color:stat.live ? ADMIN_THEME.success : ADMIN_THEME.text, lineHeight:1 }}>{Number(stat.value || 0).toLocaleString("en-IN")}</span>
              {stat.note && <span style={{ fontSize:11.5, color:ADMIN_THEME.textSecondary }}>{stat.note}</span>}
            </div>
          </div>
        ))}
      </div>
    );
  };

  function renderLiveTestPopupModal() {
    if (
      !showLiveTestPopup ||
      !activeContestAssignment ||
      contestEntered ||
      hasUsedContestAttempt ||
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
                <li><strong>Camera Required:</strong> Allow camera access when asked. The test will not start without your camera.</li>
                <li><strong>Camera Must Stay On:</strong> If your camera turns off, is covered, or the room is too dark, the test is blurred until the camera works again. Your timer keeps running.</li>
                <li><strong>No Mobile Phones:</strong> A phone seen on camera blurs the test until it is put away, and it is recorded as malpractice.</li>
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

    // Reads the first sheet of an Excel file in the browser and turns each row into an MCQ.
    const handleExcelFileSelect = async (e) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file) return;

      setMcqImportFileName(file.name);
      setPdfStage("extracting");
      setPdfProgressText(`Reading ${file.name}...`);

      try {
        const XLSX = await loadSheetJs();
        const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: "", blankrows: false });
        const questions = parseMcqSheetRows(rows);
        if (!questions.length) {
          throw new Error("No questions found in the first sheet. Put one question per row: question, opA, opB, opC, opD, correct answer.");
        }

        // Do not import a question twice: skip ones already in the bank or repeated in this file.
        const bankStatements = new Set(problemBank
          .filter((problem) => problem.type === "theory" || (Array.isArray(problem.options) && problem.options.length))
          .map((problem) => normalizeMcqText(String(problem.description || problem.statement || "").replace(/<[^>]*>/g, " ")).toLowerCase()));
        const seenInFile = new Map();
        questions.forEach((question) => {
          const key = question.statement.toLowerCase();
          if (!key) return;
          if (seenInFile.has(key)) {
            question.problems.push(`Same question as row ${seenInFile.get(key)}.`);
          } else {
            seenInFile.set(key, question.rowNumber);
            if (bankStatements.has(key)) question.problems.push("Already in the question bank.");
          }
          question.isMalformed = question.problems.length > 0;
        });

        setPdfDraftQuestions(questions);
        setPdfStage("ready");
        setPdfProgressText("");
      } catch (err) {
        setPortalError(err.message || "Could not read the Excel file.");
        setPdfStage("idle");
      }
    };

    const validMcqs = pdfDraftQuestions.filter((q) => !q.isMalformed);
    const rejectedMcqs = pdfDraftQuestions.filter((q) => q.isMalformed);

    const handleImportAllPdfs = async () => {
      if (!validMcqs.length) return;
      setPdfImporting(true);

      try {
        // Only rows that passed every check are imported.
        const data = await performApiRequest("/api/problems/import-mcq-bulk", {
          method: "POST",
          body: JSON.stringify({
            questions: validMcqs.map((q) => ({ ...q, category: q.sheetCategory || mcqImportCategory })),
          }),
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
                BULK MCQ EXCEL IMPORTER
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#f8fafc" }}>
                Upload MCQ Questions from Excel
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
              <div style={{ fontSize: 32, marginBottom: 10 }}>📊</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#f8fafc", marginBottom: 6 }}>Select MCQ Excel File (.xlsx, .xls, .csv)</div>
              <div style={{ fontSize: 13, color: "#94a3b8", marginBottom: 12 }}>One question per row, in the first sheet:</div>
              <div style={{ overflowX: "auto", marginBottom: 12 }}>
                <table style={{ margin: "0 auto", borderCollapse: "collapse", fontSize: 12, color: "#e2e8f0", background: "#0f172a" }}>
                  <thead>
                    <tr>
                      {["Question", "opA", "opB", "opC", "opD", "cort(op)"].map((h) => (
                        <th key={h} style={{ border: "1px solid #334155", padding: "6px 10px", color: "#38bdf8" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      {["The ratio of boys to girls is 3:2. If there are 30 boys, how many girls?", "15", "18", "20", "25", "C(20)"].map((v, i) => (
                        <td key={i} style={{ border: "1px solid #334155", padding: "6px 10px", maxWidth: 260 }}>{v}</td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
              <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 16, lineHeight: 1.6 }}>
                Correct answer: the option letter, e.g. <strong>C</strong> or <strong>C(20)</strong>. If you also write the value, it must match that option.<br />
                Optional columns: Marks, Category, Difficulty, Explanation. Rows with any problem are shown and not imported.
              </div>
              <input type="file" accept=".xlsx,.xls,.csv" onChange={handleExcelFileSelect} style={{ display: "none" }} id="pdf_mcq_input" />
              <label htmlFor="pdf_mcq_input" style={{ ...S.adminButton("submit"), padding: "10px 24px", cursor: "pointer" }}>
                📁 Select Excel File
              </label>
            </div>
          ) : (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: "#4ade80" }}>
                    {validMcqs.length} question(s) ready to import{mcqImportFileName ? ` from ${mcqImportFileName}` : ""}
                  </div>
                  {rejectedMcqs.length > 0 && (
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#f87171", marginTop: 4 }}>
                      {rejectedMcqs.length} row(s) need fixing and will NOT be imported (shown in red below)
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <label style={{ fontSize: 12, color: "#94a3b8" }}>
                    Category{" "}
                    <select value={mcqImportCategory} onChange={(e) => setMcqImportCategory(e.target.value)} style={{ ...S.adminInput, width: 110, padding: "6px 8px", fontSize: 12 }}>
                      {questionCategories.map((category) => <option key={category}>{category}</option>)}
                    </select>
                  </label>
                  <button
                    onClick={() => { setPdfDraftQuestions([]); setPdfStage("idle"); }}
                    style={{ padding: "10px 16px", borderRadius: 10, border: "1px solid #475569", background: "transparent", color: "#cbd5e1", fontWeight: 700, cursor: "pointer" }}
                  >
                    Choose another file
                  </button>
                  <button
                    onClick={handleImportAllPdfs}
                    disabled={pdfImporting || !validMcqs.length}
                    style={{
                      padding: "10px 24px",
                      borderRadius: 10,
                      border: "none",
                      background: "linear-gradient(135deg, #10b981, #059669)",
                      color: "#ffffff",
                      fontWeight: 800,
                      cursor: pdfImporting || !validMcqs.length ? "not-allowed" : "pointer",
                      opacity: pdfImporting || !validMcqs.length ? 0.6 : 1,
                    }}
                  >
                    {pdfImporting ? "Importing..." : `IMPORT ${validMcqs.length} QUESTION(S)`}
                  </button>
                </div>
              </div>

              <div style={{ display: "grid", gap: 14 }}>
                {pdfDraftQuestions.map((q, idx) => (
                  <div key={q.tempId || idx} style={{ background: "#1e293b", border: `1px solid ${q.isMalformed ? "#f87171" : "#334155"}`, borderRadius: 14, padding: "16px", display: "grid", gap: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontWeight: 800, color: "#38bdf8", fontSize: 14 }}>{q.rowNumber ? `Row ${q.rowNumber}` : `Q${idx + 1}`}</span>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <span style={{ fontSize: 11, fontWeight: 800, padding: "2px 8px", borderRadius: 999, background: q.isMalformed ? "rgba(239,68,68,0.2)" : "rgba(34,197,94,0.2)", color: q.isMalformed ? "#f87171" : "#4ade80" }}>
                          {q.isMalformed ? "⚠️ Not imported" : "Ready"}
                        </span>
                        <button
                          onClick={() => setPdfDraftQuestions(pdfDraftQuestions.filter((_, i) => i !== idx))}
                          style={{ padding: "4px 10px", fontSize: 11, fontWeight: 700, borderRadius: 6, border: "1px solid #f87171", background: "rgba(239,68,68,0.12)", color: "#f87171", cursor: "pointer" }}
                        >
                          🗑 Delete
                        </button>
                      </div>
                    </div>

                    <div style={{ color: "#e2e8f0", fontSize: 14, fontWeight: 600 }}>{q.statement || <em style={{ color: "#f87171" }}>(no question text)</em>}</div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      {q.options.map((opt, oIdx) => {
                        const isCorrect = oIdx === (q.correctAnswerIndex ?? q.options.indexOf(q.correctAnswer));
                        return (
                          <div key={oIdx} style={{ background: isCorrect ? "rgba(34,197,94,0.12)" : "#0f172a", border: `1px solid ${isCorrect ? "#22c55e" : "#334155"}`, padding: "8px 12px", borderRadius: 8, fontSize: 12, color: isCorrect ? "#4ade80" : "#cbd5e1" }}>
                            <strong>{String.fromCharCode(65 + oIdx)}.</strong> {opt || <em>(empty)</em>} {isCorrect && "✓ correct"}
                          </div>
                        );
                      })}
                    </div>

                    {q.isMalformed && Array.isArray(q.problems) && (
                      <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.4)", borderRadius: 8, padding: "8px 12px", color: "#fca5a5", fontSize: 12, display: "grid", gap: 4 }}>
                        {q.problems.map((problem, pIdx) => <div key={pIdx}>✗ {problem}</div>)}
                      </div>
                    )}

                    <div style={{ fontSize: 12, color: "#94a3b8", display: "flex", gap: 16, flexWrap: "wrap" }}>
                      <span>Answer in sheet: <strong style={{ color: "#e2e8f0" }}>{q.rawAnswer || "—"}</strong></span>
                      {!q.isMalformed && <span>Correct option: <strong style={{ color: "#4ade80" }}>{String.fromCharCode(65 + q.correctAnswerIndex)} ({q.correctAnswer})</strong></span>}
                      <span>Marks: <strong>{q.marks}</strong></span>
                      <span>Category: <strong>{q.sheetCategory || mcqImportCategory}</strong></span>
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
      <ScreenShield active={shieldActive} message={shieldActiveMessage} title={shieldTitle} action={shieldAction} />
      {renderFullscreenGate()}
      <div style={{ ...S.adminApp, opacity: shieldActive ? 0 : 1, pointerEvents: shieldActive ? "none" : "auto", transition: "opacity 0.12s ease", userSelect: shieldActive ? "none" : "auto" }}>
        <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet" />
        <header style={{ background:"#FFFFFF", borderBottom:`1px solid ${ADMIN_THEME.border}`, position:"sticky", top:0, zIndex:100 }}>
          <div style={{ maxWidth:1240, margin:"0 auto", padding:`0 ${pageGutter}px`, boxSizing:"border-box" }}>
            <div style={{ display:"flex", alignItems:"center", gap:10, padding:isPhone ? "12px 0 4px" : "14px 0 2px" }}>
              <button onClick={()=>setView("home")} style={{ background:"none", border:"none", padding:0, cursor:"pointer", fontFamily:"inherit", fontSize:16, fontWeight:700, color:ADMIN_THEME.text }}>ScholarLogic</button>
              <span style={{ color:ADMIN_THEME.textSecondary, fontSize:13 }}>Admin</span>
              <button onClick={signOut} style={{ ...S.adminButton("default"), marginLeft:"auto", padding:"7px 12px", fontSize:13 }}>Sign out</button>
            </div>
            <nav aria-label="Admin sections" style={{ display:"flex", gap:isPhone ? 18 : 22, overflowX:"auto", scrollbarWidth:"none" }}>
              {adminTabs.map((tab) => {
                const active = adminTab === tab.id;
                return (
                  <button key={tab.id} onClick={() => setAdminTab(tab.id)} aria-current={active ? "page" : undefined}
                    style={{ background:"none", border:"none", borderBottom:`2px solid ${active ? ADMIN_THEME.text : "transparent"}`, padding:"12px 0 11px", cursor:"pointer", fontFamily:"inherit", fontSize:14, fontWeight:active ? 600 : 400, color:active ? ADMIN_THEME.text : ADMIN_THEME.textSecondary, whiteSpace:"nowrap", flexShrink:0, display:"inline-flex", alignItems:"center", gap:6 }}
                    onMouseEnter={(e) => { if (!active) e.currentTarget.style.color = ADMIN_THEME.text; }}
                    onMouseLeave={(e) => { if (!active) e.currentTarget.style.color = ADMIN_THEME.textSecondary; }}>
                    {tab.label}
                    {tab.id === "feedback" && adminFeedbackNewCount > 0 && (
                      <span style={{ background:ADMIN_THEME.error, color:"#fff", borderRadius:999, padding:"0 6px", fontSize:11, fontWeight:600, lineHeight:"17px" }}>{adminFeedbackNewCount}</span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>
        </header>

        <div style={S.adminShell}>
          {renderAdminPreviewModal()}
          {renderMcqModal()}
          {renderQuestionUploadSuccessModal()}
          {renderDeleteQuestionModal()}
          {renderStudentReportModal()}
          {renderCodeInspectionModal()}
          {renderPdfUploadModal()}
          {renderStudentActivityModal()}
          {renderLiveTestPopupModal()}

          {[
            ["warning", adminWarning, () => setAdminWarning("")],
            ["error", portalError, () => setPortalError("")],
            ["success", portalMessage, () => setPortalMessage("")],
          ].filter(([, text]) => text).map(([tone, text, dismiss]) => (
            <div key={tone} role={tone === "error" ? "alert" : "status"} style={{ ...S.adminAlert(tone), display:"flex", alignItems:"center", gap:12 }}>
              <span style={{ flex:1, minWidth:0 }}>{text}</span>
              <button onClick={dismiss} aria-label="Dismiss" style={{ background:"none", border:"none", cursor:"pointer", color:"inherit", padding:2, lineHeight:0, flexShrink:0 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
              </button>
            </div>
          ))}

          {adminAssignmentsLoading && (
            <div style={S.adminAlert("info")}>
              Loading live portal data from MongoDB...
            </div>
          )}

          {adminTab === "overview" && (
            <div style={{ display:"grid", gap:isPhone ? 16 : 20, minWidth:0 }}>
              {renderOverviewStats()}

              <div style={{ display:"grid", gridTemplateColumns:isPhone || isTablet ? "minmax(0,1fr)" : "minmax(0,1fr) 300px", gap:24, alignItems:"start" }}>
                <div style={{ display:"grid", gap:24, minWidth:0 }}>
                  {/* Current test */}
                  <div style={{ ...S.adminCard, padding:isPhone ? "18px 16px" : "22px 24px" }}>
                    <div style={{ display:"flex", justifyContent:"space-between", gap:16, flexWrap:"wrap", alignItems:"flex-start" }}>
                      <div style={{ minWidth:0 }}>
                        <div style={{ color:ADMIN_THEME.textSecondary, fontSize:12, marginBottom:6 }}>Current test</div>
                        <div style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
                          <span style={{ fontSize:22, fontWeight:600, color:ADMIN_THEME.text }}>{adminCurrentTest.title}</span>
                          <span style={adminStatusPill(adminCurrentStatus)}>{formatAdminStatus(adminCurrentStatus)}</span>
                        </div>
                      </div>
                      <label style={{ display:"flex", alignItems:"center", gap:10, color:ADMIN_THEME.textSecondary, fontSize:13, whiteSpace:"nowrap", flex:isPhone ? "1 1 100%" : "0 0 auto" }}>
                        Switch test
                        <select
                          value={adminCurrentTest.id || ""}
                          onChange={(e) => {
                            const selectedAssignment = selectableAdminAssignments.find((assignment) => sameValue(assignment.id, e.target.value));
                            if (!selectedAssignment) return;
                            setAdminCurrentTest(selectedAssignment);
                            setAdminSubmissionProblemId(selectedAssignment?.problems?.[0]?.id || "");
                            setAdminExecution(null);
                          }}
                          style={{ ...S.adminInput, width:isPhone ? "100%" : 200, padding:"8px 10px" }}
                        >
                          {selectableAdminAssignments.map((assignment) => (
                            <option key={assignment.id || "default-test"} value={assignment.id || ""}>
                              {assignment.title}{assignment.status && assignment.status !== "ENDED" ? ` (${formatAdminStatus(assignment.status).toLowerCase()})` : ""}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>

                    <div style={{ display:"grid", gridTemplateColumns:`repeat(${isPhone ? 2 : 4}, minmax(0,1fr))`, gap:16, borderTop:`1px solid ${ADMIN_THEME.divider}`, borderBottom:`1px solid ${ADMIN_THEME.divider}`, margin:"18px 0", padding:"16px 0" }}>
                      {[
                        ["Level", <span style={{ color:adminLevelColor(adminCurrentTest.level), fontWeight:500 }}>{adminCurrentTest.level || "--"}</span>],
                        ["Starts", formatPortalDate(adminCurrentTest.startsAt)],
                        ["Duration", `${adminCurrentTest.duration || "--"} min`],
                        ["Timer", <span style={{ fontFamily:"'IBM Plex Mono','JetBrains Mono',monospace", color:adminCurrentStatus === "LIVE" ? ADMIN_THEME.primary : ADMIN_THEME.text }}>{formatCountdown(adminTimerSeconds)}</span>],
                      ].map(([label, value]) => (
                        <div key={label} style={{ minWidth:0 }}>
                          <div style={{ color:ADMIN_THEME.textSecondary, fontSize:12, marginBottom:4 }}>{label}</div>
                          <div style={{ color:ADMIN_THEME.text, fontSize:14 }}>{value}</div>
                        </div>
                      ))}
                    </div>

                    <div style={{ display:"flex", gap:10, flexWrap:"wrap", alignItems:"center" }}>
                      <button
                        onClick={handleStartAssignedTest}
                        disabled={adminStartingTest || !adminCurrentTest.id || adminCurrentTest.status === "LIVE"}
                        style={{ ...S.adminButton("submit"), opacity: adminStartingTest || !adminCurrentTest.id || adminCurrentTest.status === "LIVE" ? 0.55 : 1, cursor: adminStartingTest || !adminCurrentTest.id || adminCurrentTest.status === "LIVE" ? "not-allowed" : "pointer" }}
                      >
                        {adminStartingTest ? "Starting..." : adminCurrentTest.status === "LIVE" ? "Test is live" : "Start now"}
                      </button>
                      <button
                        onClick={handleStopAssignedTest}
                        disabled={adminStoppingTest || !adminCurrentTest.id || adminCurrentTest.status !== "LIVE"}
                        style={{
                          ...S.adminButton("default"),
                          color: adminCurrentTest.status === "LIVE" ? ADMIN_THEME.error : ADMIN_THEME.textMuted,
                          borderColor: adminCurrentTest.status === "LIVE" ? ADMIN_THEME.error : ADMIN_THEME.border,
                          background: adminCurrentTest.status === "LIVE" ? "#FFFFFF" : ADMIN_THEME.hoverBackground,
                          cursor: adminStoppingTest || !adminCurrentTest.id || adminCurrentTest.status !== "LIVE" ? "not-allowed" : "pointer",
                        }}
                      >
                        {adminStoppingTest ? "Stopping..." : "Stop test"}
                      </button>
                      {!isPhone && <span style={{ width:1, height:28, background:ADMIN_THEME.border, margin:"0 4px" }} />}
                      <button
                        onClick={() => syncProblemBankToDatabase(false)}
                        disabled={adminSyncingProblems}
                        style={{ ...S.adminButton("default"), opacity: adminSyncingProblems ? 0.6 : 1, cursor: adminSyncingProblems ? "not-allowed" : "pointer" }}
                      >
                        {adminSyncingProblems ? "Syncing..." : "Sync problems"}
                      </button>
                      <button
                        onClick={() => shareTestLink(adminCurrentTest)}
                        disabled={!adminCurrentTest.id || adminCurrentTest.status === "ENDED"}
                        title={adminCurrentTest.status === "ENDED" ? "This test has ended" : "Copy a link that takes students straight into this test"}
                        style={{ ...S.adminButton("default"), display:"inline-flex", alignItems:"center", gap:7, opacity: !adminCurrentTest.id || adminCurrentTest.status === "ENDED" ? 0.55 : 1, cursor: !adminCurrentTest.id || adminCurrentTest.status === "ENDED" ? "not-allowed" : "pointer" }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>
                        Copy share link
                      </button>
                    </div>

                    {adminCurrentTest.id && adminCurrentTest.status !== "LIVE" && adminCurrentTest.status !== "ENDED" && (
                      <div style={{ marginTop:18, paddingTop:16, borderTop:`1px solid ${ADMIN_THEME.divider}` }}>
                        {adminCurrentTest.status === "SCHEDULED" ? (
                          <div style={{ display:"flex", gap:10, flexWrap:"wrap", alignItems:"center", justifyContent:"space-between" }}>
                            <div style={{ color:ADMIN_THEME.textSecondary, fontSize:13 }}>
                              Starts automatically on <span style={{ color:ADMIN_THEME.text, fontWeight:600 }}>{formatPortalDate(adminCurrentTest.startsAt)}</span>
                              {adminCurrentTest.endsAt && (
                                <> · ends <span style={{ color:ADMIN_THEME.text, fontWeight:600 }}>{formatPortalDate(adminCurrentTest.endsAt)}</span></>
                              )}
                            </div>
                            <button
                              onClick={handleUnscheduleAssignedTest}
                              disabled={adminSchedulingTest}
                              style={{ ...S.adminButton("default"), opacity: adminSchedulingTest ? 0.6 : 1, cursor: adminSchedulingTest ? "not-allowed" : "pointer" }}
                            >
                              {adminSchedulingTest ? "Cancelling..." : "Cancel schedule"}
                            </button>
                          </div>
                        ) : (
                          <div style={{ display:"grid", gap:12 }}>
                            <div style={{ color:ADMIN_THEME.text, fontSize:14, fontWeight:600 }}>Schedule this test</div>
                            <div style={{ display:"grid", gridTemplateColumns:`repeat(${isPhone ? 2 : 4}, minmax(0, 1fr))`, gap:10 }}>
                              <div>
                                <label style={S.adminFieldLabel}>Start date</label>
                                <input type="date" value={adminScheduleDate} onChange={(e) => setAdminScheduleDate(e.target.value)} style={S.adminInput} />
                              </div>
                              <div>
                                <label style={S.adminFieldLabel}>Start time</label>
                                <input type="time" value={adminScheduleTime} onChange={(e) => setAdminScheduleTime(e.target.value)} style={S.adminInput} />
                              </div>
                              <div>
                                <label style={S.adminFieldLabel}>End date (optional)</label>
                                <input type="date" value={adminScheduleEndDate} onChange={(e) => setAdminScheduleEndDate(e.target.value)} style={S.adminInput} />
                              </div>
                              <div>
                                <label style={S.adminFieldLabel}>End time (optional)</label>
                                <input type="time" value={adminScheduleEndTime} onChange={(e) => setAdminScheduleEndTime(e.target.value)} style={S.adminInput} />
                              </div>
                            </div>
                            <div>
                              <button
                                onClick={handleScheduleAssignedTest}
                                disabled={adminSchedulingTest || !adminScheduleDate || !adminScheduleTime}
                                style={{ ...S.adminButton("run"), opacity: adminSchedulingTest || !adminScheduleDate || !adminScheduleTime ? 0.55 : 1, cursor: adminSchedulingTest || !adminScheduleDate || !adminScheduleTime ? "not-allowed" : "pointer" }}
                              >
                                {adminSchedulingTest ? "Scheduling..." : "Schedule"}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Test queue */}
                  <div style={{ ...S.adminCard, padding:0, overflow:"hidden" }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", gap:12, flexWrap:"wrap", padding:isPhone ? "16px 16px 10px" : "20px 24px 12px" }}>
                      <span style={{ fontSize:16, fontWeight:600, color:ADMIN_THEME.text }}>Test queue</span>
                      <span style={{ fontSize:13, color:ADMIN_THEME.textSecondary }}>
                        {liveAdminAssignments.length} live · {adminAssignments.filter((test) => test.status === "ENDED").length} ended
                      </span>
                    </div>
                    <div style={{ overflowX:"auto" }}>
                      <table style={{ width:"100%", borderCollapse:"collapse", minWidth:isPhone ? 560 : 0 }}>
                        <thead>
                          <tr>
                            {["Test", "Scheduled", "Level", "Status", ""].map((heading, index) => (
                              <th key={index} style={{ textAlign:"left", padding:`8px ${index === 0 ? (isPhone ? 16 : 24) : 12}px`, color:ADMIN_THEME.textSecondary, fontSize:12, fontWeight:500 }}>{heading}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {selectableAdminAssignments.slice(0, 8).map((test, index) => {
                            const selected = adminCurrentTest?.id === test.id;
                            return (
                              <tr
                                key={test.id || `test-${index}`}
                                tabIndex={0}
                                title={test.status === "ENDED" ? "Open this test's report" : "Select this test"}
                                onClick={() => openTestFromQueue(test)}
                                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openTestFromQueue(test); } }}
                                style={{ cursor:"pointer", background:selected ? "#F3F6FD" : "transparent", borderTop:`1px solid ${ADMIN_THEME.divider}` }}
                                onMouseEnter={(e) => { if (!selected) e.currentTarget.style.background = ADMIN_THEME.hoverBackground; }}
                                onMouseLeave={(e) => { if (!selected) e.currentTarget.style.background = "transparent"; }}
                              >
                                <td style={{ padding:`16px 12px 16px ${isPhone ? 16 : 24}px`, fontSize:14, fontWeight:500, color:ADMIN_THEME.text, maxWidth:220, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }} title={test.title || test.name}>{test.title || test.name}</td>
                                <td style={{ padding:"16px 12px", fontSize:13, color:ADMIN_THEME.textSecondary, whiteSpace:"nowrap" }}>{test.startsAt ? formatPortalDate(test.startsAt) : test.date || "--"}</td>
                                <td style={{ padding:"16px 12px", fontSize:13, color:adminLevelColor(test.level || test.difficulty) }}>{test.level || test.difficulty || "--"}</td>
                                <td style={{ padding:"16px 12px", fontSize:13 }}>
                                  {test.status === "LIVE"
                                    ? <span style={{ display:"inline-flex", alignItems:"center", gap:6, color:ADMIN_THEME.success, fontWeight:500 }}><span style={{ width:7, height:7, borderRadius:"50%", background:ADMIN_THEME.success }} />Live</span>
                                    : <span style={{ color:ADMIN_THEME.textSecondary }}>{formatAdminStatus(test.status || "ENDED")}</span>}
                                </td>
                                <td style={{ padding:`16px ${isPhone ? 16 : 24}px 16px 12px`, textAlign:"right", whiteSpace:"nowrap" }}>
                                  <span style={{ color:ADMIN_THEME.primary, fontSize:13, marginRight:18 }}>{test.status === "ENDED" ? "View report" : "Select"}</span>
                                  {test.id && (
                                    <button
                                      type="button"
                                      aria-label={`Delete ${test.title || "test"}`}
                                      title={test.status === "LIVE" ? "Stop the test before deleting it" : "Delete this test"}
                                      onClick={(e) => { e.stopPropagation(); handleDeleteTest(test); }}
                                      disabled={deletingTestId === test.id || test.status === "LIVE"}
                                      style={{ background:"none", border:"none", padding:2, verticalAlign:"middle", color:ADMIN_THEME.textMuted, cursor:deletingTestId === test.id || test.status === "LIVE" ? "not-allowed" : "pointer", opacity:deletingTestId === test.id || test.status === "LIVE" ? 0.35 : 1 }}
                                      onMouseEnter={(e) => { e.currentTarget.style.color = ADMIN_THEME.error; }}
                                      onMouseLeave={(e) => { e.currentTarget.style.color = ADMIN_THEME.textMuted; }}
                                    >
                                      {deletingTestId === test.id ? "…" : (
                                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M19 6l-1 14H6L5 6" /></svg>
                                      )}
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                          {!selectableAdminAssignments.length && (
                            <tr><td colSpan="5" style={{ padding:"18px 24px", color:ADMIN_THEME.textSecondary, fontSize:14, borderTop:`1px solid ${ADMIN_THEME.divider}` }}>No tests yet. Create one below.</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {/* Side column */}
                <div style={{ display:"grid", gap:24, alignContent:"start" }}>
                  <div style={{ ...S.adminCard, padding:"22px 24px" }}>
                    <div style={{ fontSize:16, fontWeight:600, color:ADMIN_THEME.text, marginBottom:10 }}>Test report</div>
                    <div style={{ fontSize:13.5, color:ADMIN_THEME.textSecondary, lineHeight:1.6, marginBottom:16 }}>
                      {currentTestEnded
                        ? <>Every student's attendance, score, time taken, submissions and interruptions for <strong style={{ color:ADMIN_THEME.text }}>{adminCurrentTest.title}</strong>, as an Excel file.</>
                        : "The report can be downloaded once the test ends."}
                    </div>
                    <button
                      onClick={downloadAdminTestReport}
                      disabled={!adminTestReport}
                      style={{ ...S.adminButton("run"), display:"inline-flex", alignItems:"center", gap:8, opacity:adminTestReport ? 1 : 0.45, cursor:adminTestReport ? "pointer" : "not-allowed" }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 4v12" /><path d="M7 11l5 5 5-5" /><path d="M5 20h14" /></svg>
                      Download report
                    </button>
                  </div>

                  <div style={{ ...S.adminCard, padding:"22px 24px" }}>
                    <div style={{ fontSize:16, fontWeight:600, color:ADMIN_THEME.text, marginBottom:12 }}>Participants</div>
                    <div style={{ fontSize:28, fontWeight:600, color:ADMIN_THEME.text, lineHeight:1, marginBottom:10 }}>{Number(participantsCount || 0).toLocaleString("en-IN")}</div>
                    <div style={{ color:ADMIN_THEME.textSecondary, fontSize:13.5, marginBottom:12 }}>Students with recorded login activity.</div>
                    <div style={{ display:"inline-flex", alignItems:"center", gap:7, color:ADMIN_THEME.success, fontSize:12.5 }}>
                      <span style={{ width:6, height:6, borderRadius:"50%", background:ADMIN_THEME.success }} />
                      Login tracking on
                    </div>
                  </div>

                  <div style={{ display:"grid", gap:10, padding:"0 4px" }}>
                    {[
                      ["Review malpractice reports", "malpractice"],
                      ["Upload questions", "questions"],
                      ["Open student list", "students"],
                    ].map(([label, tab]) => (
                      <button key={tab} onClick={() => setAdminTab(tab)} style={{ background:"none", border:"none", padding:0, textAlign:"left", color:ADMIN_THEME.primary, fontSize:13.5, cursor:"pointer", fontFamily:"inherit" }}
                        onMouseEnter={(e) => { e.currentTarget.style.textDecoration = "underline"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.textDecoration = "none"; }}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

          {currentTestEnded && adminTestReport && (
            <div ref={adminReportRef} style={{ display:"grid", gap:18, scrollMarginTop:90 }}>
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
                <div style={{ padding:attendanceTableOpen ? "18px 18px 8px" : "18px", display:"flex", justifyContent:"space-between", alignItems:"center", gap:12, flexWrap:"wrap" }}>
                  <div>
                    <div style={S.adminSectionTitle}>Student Attendance & Activity</div>
                    <div style={{ color:ADMIN_THEME.textSecondary, fontSize:14 }}>Each student’s attendance, score, time usage, submissions, and interruption details.</div>
                  </div>
                  <button onClick={() => setAttendanceTableOpen((prev) => !prev)} style={S.adminButton(attendanceTableOpen ? "default" : "run")}>
                    {attendanceTableOpen ? "Hide Table" : `Show Table (${adminTestReport.students.length})`}
                  </button>
                </div>
                {attendanceTableOpen && (
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
                        <td style={{ ...S.adminTableCell, whiteSpace:"nowrap" }}>{formatDurationFromMs(student.timeSpentMs)}</td>
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
                )}
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
                        setAdminExecution(null);
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
                    <select value={adminSubmissionLang} onChange={(e)=>{ setAdminSubmissionLang(e.target.value); setAdminExecution(null); }} style={S.adminInput}>
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
                      <span style={{ fontSize: 16 }}>↑</span> UPLOAD MCQ EXCEL
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
                            No theory MCQ questions found. Use <strong>+ ADD MCQ QUESTION</strong> or <strong>↑ UPLOAD MCQ EXCEL</strong> above to add test MCQs.
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

            </div>
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
                  <div style={{ display:"grid", gridTemplateColumns:isPhone ? compactGrid : "1fr 1fr", gap:12 }}>
                    <div>
                      <label style={S.adminFieldLabel}>Start Date (optional)</label>
                      <input type="date" value={adminCreateForm.scheduleDate} onChange={(e)=>handleAdminCreateInput("scheduleDate", e.target.value)} style={S.adminInput} />
                    </div>
                    <div>
                      <label style={S.adminFieldLabel}>Start Time (optional)</label>
                      <input type="time" value={adminCreateForm.scheduleTime} onChange={(e)=>handleAdminCreateInput("scheduleTime", e.target.value)} style={S.adminInput} />
                    </div>
                    <div>
                      <label style={S.adminFieldLabel}>End Date (optional)</label>
                      <input type="date" value={adminCreateForm.scheduleEndDate} onChange={(e)=>handleAdminCreateInput("scheduleEndDate", e.target.value)} style={S.adminInput} />
                    </div>
                    <div>
                      <label style={S.adminFieldLabel}>End Time (optional)</label>
                      <input type="time" value={adminCreateForm.scheduleEndTime} onChange={(e)=>handleAdminCreateInput("scheduleEndTime", e.target.value)} style={S.adminInput} />
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
                          <span style={{ fontSize: 16, fontWeight: 900 }}>↑</span> UPLOAD MCQ EXCEL
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
                      onClick={() => handleCreateTest(false)}
                      disabled={adminCreatingTest}
                      style={{ ...S.adminButton("submit"), flex:1, opacity: adminCreatingTest ? 0.65 : 1, cursor: adminCreatingTest ? "not-allowed" : "pointer" }}
                    >
                      {adminCreatingTest ? "Saving..." : "Save Draft Test"}
                    </button>
                    <button
                      onClick={() => handleCreateTest(true)}
                      disabled={adminCreatingTest || !adminCreateForm.scheduleDate || !adminCreateForm.scheduleTime}
                      style={{
                        ...S.adminButton("run"),
                        flex:1,
                        opacity: adminCreatingTest || !adminCreateForm.scheduleDate || !adminCreateForm.scheduleTime ? 0.6 : 1,
                        cursor: adminCreatingTest || !adminCreateForm.scheduleDate || !adminCreateForm.scheduleTime ? "not-allowed" : "pointer",
                      }}
                    >
                      {adminCreatingTest ? "Saving..." : "Save & Schedule"}
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
            </div>
          )}

          {adminTab === "questions" && renderQuestionUploads()}
          {adminTab === "reports" && renderAdminReports()}
          {adminTab === "malpractice" && renderAdminMalpracticeReports()}
          {adminTab === "leaderboard" && renderAdminLeaderboard()}
          {adminTab === "challenge" && renderAdminChallenges()}
          {adminTab === "feedback" && renderAdminFeedback()}
          {adminTab === "students" && renderStudentList()}
          {adminTab === "monitor" && renderLiveMonitor()}
          {adminTab === "profile" && renderAdminProfile()}
        </div>
      </div>
    </div>
  );

  // ── PROBLEM LIST ───────────────────────────────────────────────────────────
  if (view === "list") return renderProblemsHome();

  if (view === "profile") return (
    <div style={{ position: "relative" }} onContextMenu={(e) => e.preventDefault()}>
      <ScreenShield active={shieldActive} message={shieldActiveMessage} title={shieldTitle} action={shieldAction} />
      {renderFullscreenGate()}
      {renderLiveTestPopupModal()}
      <div style={{ ...S.app, background:"#0f172a", color:"#e2e8f0", fontFamily:"'Poppins','Inter','Outfit',sans-serif", opacity: shieldActive ? 0 : 1, pointerEvents: shieldActive ? "none" : "auto", transition: "opacity 0.12s ease", userSelect: shieldActive ? "none" : "auto" }}>
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
          {renderExtraNavButtons()}
          <button style={S.navBtn(true)}>
            <span style={S.navBtnLabel(true)}>Profile</span>
            <span style={S.navBtnHint(true)}>Dashboard overview</span>
          </button>
          <div style={{ marginLeft:"auto", display:"flex", gap:12, alignItems:"center" }}>
            <div style={{ width:34, height:34, borderRadius:"50%", background:`linear-gradient(135deg, ${profileAvatarGradient[0]}, ${profileAvatarGradient[1]})`, display:"flex", alignItems:"center", justifyContent:"center", fontWeight:800, color:"#081018", boxShadow:"0 0 18px rgba(96,165,250,0.28)" }}>{profileAvatarLabel}</div>
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
            </div>
          </div>

          <div style={{ background:"#0b1220", border:"1px solid #1e293b", borderRadius:24, padding:"22px 22px 4px", boxShadow:"0 14px 34px rgba(15, 23, 42, 0.32)" }}>
            <div style={{ color:"#94a3b8", fontSize:12, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:12 }}>Daily Practice Streak</div>
            {renderStreakCard(isPhone ? 20 : 53)}
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
      <ScreenShield active={shieldActive} message={shieldActiveMessage} title={shieldTitle} action={shieldAction} />
      {renderFullscreenGate()}
      <div style={{ ...S.app, opacity: shieldActive ? 0 : 1, pointerEvents: shieldActive ? "none" : "auto", transition: "opacity 0.12s ease", userSelect: shieldActive ? "none" : "auto" }}>
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
                <div>
                  Camera: <strong>required before the test starts</strong>
                  <ul style={{ margin:"6px 0 0", paddingLeft:20, color:"#b8bdd9", fontSize:13, lineHeight:1.6 }}>
                    <li>Allow camera access when the browser asks. If you block it, the test will not start.</li>
                    <li>Close Zoom, Teams, or any other app that uses the camera before starting.</li>
                    <li>Sit in a well-lit room facing the camera. Do not cover the camera.</li>
                    <li>If the camera turns off, is covered, or the room is too dark, the test is blurred until you turn it back on. Your timer keeps running.</li>
                    <li>Keep your mobile phone away. A phone seen on camera blurs the test and is recorded as malpractice.</li>
                    <li>The exam team can see your progress and a photo from your camera during the test.</li>
                  </ul>
                </div>
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
          {renderExtraNavButtons()}
          <div style={{ marginLeft:"auto", display:"flex", gap:12, alignItems:"center" }}>
            <span style={{ color:"#7c6af7", fontSize:13 }}>🏆 {solved.size} solved</span>
            {currentAchievement && <AchievementBadge tier={currentUser.badgeTier} compact />}
            <div onClick={openProfile} style={{ width:32, height:32, borderRadius:"50%", background:"linear-gradient(135deg,#7c6af7,#4fd1c5)", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:700, cursor:"pointer" }}>{userBadge}</div>
          </div>
        </nav>

        <div style={{ maxWidth:1180, margin:"32px auto 40px", padding:`0 ${pageGutter}px`, width:"100%", boxSizing:"border-box", display:"grid", gap:20 }}>

          {portalError && (
            <div style={{ background:"#180b0b", border:"1px solid #4b1717", color:"#ffb0b0", borderRadius:14, padding:"12px 14px", fontSize:13 }}>
              {portalError}
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

  if (view === "testLink") {
    const info = linkTestInfo;
    const startsAtMs = info?.startsAt ? new Date(info.startsAt).getTime() : NaN;
    const secondsToStart = Number.isFinite(startsAtMs) ? Math.max(0, Math.floor((startsAtMs - Date.now()) / 1000)) : null;
    let icon = "⏳";
    let heading = "Opening your test...";
    let detail = "Please wait a moment.";

    if (linkTestError) {
      icon = "🔗";
      heading = "Link not available";
      detail = linkTestError;
    } else if (info?.attemptUsed) {
      icon = "✅";
      heading = "You have already taken this test";
      detail = `Your answers for "${info.title}" were submitted. Results will be shared by your instructor.`;
    } else if (info?.status === "SCHEDULED") {
      icon = "🗓️";
      heading = `${info.title} starts soon`;
      detail = `Starts on ${formatPortalDate(info.startsAt)}${secondsToStart !== null ? ` (in ${formatCountdown(secondsToStart)})` : ""}. Keep this page open; the test will open by itself.`;
    } else if (info?.status === "DRAFT") {
      icon = "🕒";
      heading = `${info.title} has not started yet`;
      detail = "Keep this page open; it will open as soon as your instructor starts the test.";
    } else if (info?.status === "ENDED") {
      icon = "🏁";
      heading = `${info.title} has ended`;
      detail = "This test is no longer accepting answers.";
    }

    return (
      <div style={{ ...S.app, minHeight:"100vh" }}>
        <nav style={S.nav}>
          <DevOrbitLogo onClick={() => { leaveTestLink(); setView("home"); }} />
        </nav>
        <div style={{ minHeight:"calc(100vh - 80px)", display:"flex", alignItems:"center", justifyContent:"center", padding:"32px 16px", boxSizing:"border-box" }}>
          <div style={{ width:"min(520px, 100%)", background:"linear-gradient(180deg,#141422,#0d0d15)", border:"1px solid #2b2b45", borderRadius:24, padding:"32px 26px", textAlign:"center" }}>
            <div style={{ fontSize:56 }}>{icon}</div>
            <h1 style={{ color:"#f5f6ff", fontSize:26, margin:"14px 0 10px" }}>{heading}</h1>
            <p style={{ color:"#a9aed0", fontSize:15, lineHeight:1.7, margin:"0 0 22px" }}>{detail}</p>
            {info && !linkTestError && (
              <div style={{ color:"#7a7f9e", fontSize:13, marginBottom:20 }}>
                {info.questionCount} questions · {info.durationMinutes} minutes
              </div>
            )}
            <button type="button" onClick={() => { leaveTestLink(); openContest(); }} style={{ ...S.btn("default"), width:"100%" }}>
              Go to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (view === "thankYou") {
    const ratingOptions = [
      { value: 1, emoji: "😞", label: "Poor" },
      { value: 2, emoji: "😕", label: "Okay" },
      { value: 3, emoji: "😐", label: "Good" },
      { value: 4, emoji: "🙂", label: "Very good" },
      { value: 5, emoji: "🤩", label: "Excellent" },
    ];
    const confetti = ["🎉", "✨", "🎊", "⭐", "💜", "🎉", "✨", "🎊", "⭐", "💙", "🎉", "✨"];
    const firstName = String(currentUser.name || "").trim().split(/\s+/)[0];

    return (
      <div style={{ ...S.app, minHeight:"100vh", position:"relative", overflow:"hidden" }}>
        <style>{`
          @keyframes dvThanksPop { 0% { transform: scale(0.4); opacity: 0; } 60% { transform: scale(1.12); opacity: 1; } 100% { transform: scale(1); } }
          @keyframes dvThanksWave { 0%, 100% { transform: rotate(0deg); } 20% { transform: rotate(16deg); } 40% { transform: rotate(-10deg); } 60% { transform: rotate(12deg); } 80% { transform: rotate(-6deg); } }
          @keyframes dvThanksFall { 0% { transform: translateY(-12vh) rotate(0deg); opacity: 0; } 10% { opacity: 1; } 100% { transform: translateY(110vh) rotate(360deg); opacity: 0; } }
          @keyframes dvThanksRise { from { transform: translateY(18px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
          @media (prefers-reduced-motion: reduce) { .dv-thanks-anim { animation: none !important; } }
        `}</style>

        {confetti.map((piece, index) => (
          <span
            key={index}
            aria-hidden="true"
            className="dv-thanks-anim"
            style={{
              position:"absolute",
              top:0,
              left:`${4 + index * 8}%`,
              fontSize:18 + (index % 3) * 6,
              animation:`dvThanksFall ${5 + (index % 4)}s linear ${index * 0.35}s infinite`,
              pointerEvents:"none",
            }}
          >
            {piece}
          </span>
        ))}

        <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", padding:"32px 16px", boxSizing:"border-box", position:"relative" }}>
          <div
            className="dv-thanks-anim"
            style={{ width:"min(560px, 100%)", background:"linear-gradient(180deg,#141422,#0d0d15)", border:"1px solid #2b2b45", borderRadius:24, padding:"36px 28px", textAlign:"center", boxShadow:"0 24px 60px #00000060", animation:"dvThanksRise 0.6s ease-out both" }}
          >
            <div className="dv-thanks-anim" style={{ fontSize:72, lineHeight:1, animation:"dvThanksPop 0.7s ease-out both" }}>🎉</div>
            <h1 style={{ margin:"18px 0 8px", color:"#f5f6ff", fontSize:30, lineHeight:1.2, fontFamily:"'Fraunces',serif" }}>
              Thank you for attending{firstName ? `, ${firstName}` : ""}!{" "}
              <span className="dv-thanks-anim" style={{ display:"inline-block", transformOrigin:"70% 70%", animation:"dvThanksWave 1.8s ease-in-out 0.8s 2" }}>👋</span>
            </h1>
            <p style={{ color:"#a9aed0", fontSize:15, lineHeight:1.7, margin:"0 0 6px" }}>
              Your answers for <strong style={{ color:"#e2e4ff" }}>{thankYouTest?.title || "this test"}</strong> have been submitted successfully. ✅
            </p>
            <p style={{ color:"#7a7f9e", fontSize:13, margin:"0 0 26px" }}>Your results will be shared by your instructor.</p>

            <div style={{ borderTop:"1px solid #25253b", paddingTop:22 }}>
              {feedbackSent ? (
                <div className="dv-thanks-anim" style={{ animation:"dvThanksPop 0.5s ease-out both" }}>
                  <div style={{ fontSize:44 }}>💜</div>
                  <div style={{ color:"#e2e4ff", fontWeight:700, fontSize:16, marginTop:8 }}>Thanks for your feedback!</div>
                  <div style={{ color:"#7a7f9e", fontSize:13, marginTop:4 }}>It helps us make the next test better.</div>
                </div>
              ) : (
                <>
                  <div style={{ color:"#e2e4ff", fontWeight:700, fontSize:16, marginBottom:14 }}>How was the test?</div>
                  <div style={{ display:"flex", justifyContent:"center", gap:isPhone ? 6 : 10, flexWrap:"wrap", marginBottom:16 }}>
                    {ratingOptions.map((option) => {
                      const selected = feedbackRating === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => { setFeedbackRating(option.value); setFeedbackError(""); }}
                          aria-label={option.label}
                          aria-pressed={selected}
                          style={{
                            background:selected ? "#1e1b4b" : "transparent",
                            border:selected ? "1px solid #818cf8" : "1px solid #2b2b45",
                            borderRadius:14,
                            padding:"8px 10px",
                            cursor:"pointer",
                            display:"grid",
                            gap:4,
                            minWidth:62,
                            transform:selected ? "scale(1.08)" : "scale(1)",
                            transition:"transform 0.15s ease, background 0.15s ease",
                          }}
                        >
                          <span style={{ fontSize:30 }}>{option.emoji}</span>
                          <span style={{ color:selected ? "#c7d2fe" : "#7a7f9e", fontSize:11, fontWeight:700 }}>{option.label}</span>
                        </button>
                      );
                    })}
                  </div>
                  <textarea
                    value={feedbackComment}
                    onChange={(e) => setFeedbackComment(e.target.value)}
                    maxLength={1000}
                    placeholder="Anything you'd like to tell us? (optional)"
                    style={{ ...S.input, width:"100%", minHeight:90, resize:"vertical", boxSizing:"border-box", marginBottom:12 }}
                  />
                  {feedbackError && <div style={{ color:"#fda4af", fontSize:13, marginBottom:10 }}>{feedbackError}</div>}
                  <button
                    type="button"
                    onClick={submitTestFeedback}
                    disabled={feedbackSubmitting}
                    style={{ ...S.btn("submit"), width:"100%", opacity:feedbackSubmitting ? 0.6 : 1, cursor:feedbackSubmitting ? "not-allowed" : "pointer" }}
                  >
                    {feedbackSubmitting ? "Sending..." : "Submit Feedback"}
                  </button>
                </>
              )}
            </div>

            <button
              type="button"
              onClick={() => { setThankYouTest(null); leaveTestLink(); openContest(); }}
              style={{ ...S.btn("default"), marginTop:16, width:"100%" }}
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

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
          {renderExtraNavButtons()}
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

  // ── PRACTICE IDE ─────────────────────────────────────────────────────────
  if (view === "playground") {
    const result = playgroundResult;
    const ranOk = Boolean(result && !result.error && result.statusId === 3);
    const errorText = result && !result.error
      ? [result.compileOutput, result.stderr, result.message].map((value) => String(value || "").trim()).filter(Boolean).join("\n\n")
      : "";
    const playgroundDiag = validateCodeSyntax(playgroundCode, playgroundLang);
    const playgroundErrorLines = new Set(playgroundDiag.errors.map((item) => item.line));
    const mono = "'IBM Plex Mono','JetBrains Mono',monospace";
    const toolButton = { background:"transparent", border:"1px solid #333", color:"#d4d4d4", padding:"6px 11px", borderRadius:6, fontSize:13, cursor:"pointer", fontFamily:"inherit" };
    const paneHeader = { display:"flex", alignItems:"center", gap:10, padding:`0 ${isPhone ? 12 : 16}px`, height:52, borderBottom:"1px solid #222", flexShrink:0, boxSizing:"border-box" };
    const outputStatus = playgroundRunning
      ? <span style={{ color:"#a3a3a3" }}>Running...</span>
      : !result
        ? <span style={{ color:"#8e8e8e" }}>Not run yet</span>
        : result.error
          ? <span style={{ color:"#ff8a8a" }}>Could not run</span>
          : (
            <span style={{ display:"inline-flex", gap:10, alignItems:"center" }}>
              <span style={{ color:ranOk ? "#4cb782" : "#ff8a8a" }}>{ranOk ? "Finished" : result.status}</span>
              {result.runtime && <span style={{ color:"#8e8e8e", fontFamily:mono }}>{result.runtime}</span>}
              {result.memory && <span style={{ color:"#8e8e8e", fontFamily:mono }}>{result.memory}</span>}
            </span>
          );

    return (
      <div style={{ position: "relative" }} onContextMenu={(e) => e.preventDefault()}>
        <ScreenShield active={shieldActive} message={shieldActiveMessage} title={shieldTitle} action={shieldAction} />
        {renderFullscreenGate()}
        {renderLiveTestPopupModal()}
        <div style={{ ...S.app, background:"#131313", color:"#ececec", fontFamily:"'IBM Plex Sans','Outfit',system-ui,sans-serif", height: isCompact ? "auto" : "100vh", overflow: isCompact ? "visible" : "hidden", opacity: shieldActive ? 0 : 1, pointerEvents: shieldActive ? "none" : "auto", transition: "opacity 0.12s ease", userSelect: shieldActive ? "none" : "auto" }}>
          <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
          <style>{`
            .dv-ide-btn:hover:not(:disabled) { border-color:#4a4a4a !important; color:#f2f2f2 !important; }
            .dv-ide-input::placeholder { color:#5c5c5c; }
            @keyframes dvSpin { to { transform: rotate(360deg); } }
          `}</style>
          {renderStudentNav("playground")}

          <div style={{ flex:1, minHeight:0, display:"grid", gridTemplateColumns: isCompact ? "minmax(0, 1fr)" : "minmax(0, 1.6fr) minmax(320px, 1fr)" }}>
            {/* Editor */}
            <div style={{ display:"flex", flexDirection:"column", minHeight: isCompact ? 480 : 0, borderRight: isCompact ? "none" : "1px solid #222", borderBottom: isCompact ? "1px solid #222" : "none" }}>
              <div style={{ ...paneHeader, height:"auto", minHeight:52, flexWrap:"wrap", padding:`8px ${isPhone ? 12 : 16}px` }}>
                <span style={{ color:"#f2f2f2", fontWeight:700, fontSize:14.5, marginRight:4 }}>DevOrbit IDE</span>
                <select
                  value={playgroundLang}
                  onChange={(e) => { updatePlaygroundDraft({ lang: e.target.value }); setPlaygroundResult(null); }}
                  aria-label="Language"
                  style={{ background:"#181818", border:"1px solid #333", color:"#ececec", padding:"6px 10px", borderRadius:6, fontSize:13.5, fontFamily:"inherit", cursor:"pointer", outline:"none", minWidth:isPhone ? 0 : 150 }}
                >
                  {PLAYGROUND_LANGUAGES.map((item) => <option key={item.id} value={item.id} style={{ background:"#1c1c1c" }}>{item.label}</option>)}
                </select>
                {playgroundDiag.isValid ? (
                  <span style={{ fontSize:12.5, color:"#4cb782", display:"inline-flex", alignItems:"center", gap:5 }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
                    Brackets balanced
                  </span>
                ) : (
                  <span style={{ fontSize:12.5, color:"#ff8a8a" }}>{playgroundDiag.errors[0]?.message}</span>
                )}
                <div style={{ marginLeft:"auto", display:"flex", gap:8, alignItems:"center" }}>
                  <button className="dv-ide-btn" onClick={() => setPlaygroundCode(formatCode(playgroundCode, playgroundLang))} title="Format code (Ctrl+Shift+F)" style={toolButton}>Format</button>
                  <button className="dv-ide-btn"
                    onClick={() => { if (window.confirm("Reset the editor to the starter code? Your code for this language will be replaced.")) { setPlaygroundCode(PLAYGROUND_STARTER_CODE[playgroundLang]); setPlaygroundResult(null); } }}
                    style={toolButton}
                  >
                    Reset
                  </button>
                  <button onClick={runPlayground} disabled={playgroundRunning} title="Run (Ctrl+Enter)"
                    style={{ background:"#e8873a", border:"1px solid #e8873a", color:"#1a1009", borderRadius:6, padding:"7px 16px", fontFamily:"inherit", fontSize:14, fontWeight:600, display:"inline-flex", alignItems:"center", gap:8, cursor:playgroundRunning ? "not-allowed" : "pointer", opacity:playgroundRunning ? 0.75 : 1 }}
                    onMouseEnter={(e) => { if (!e.currentTarget.disabled) e.currentTarget.style.background = "#f0964d"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "#e8873a"; }}>
                    {playgroundRunning
                      ? <span style={{ width:12, height:12, border:"2px solid rgba(26,16,9,0.35)", borderTopColor:"#1a1009", borderRadius:"50%", display:"inline-block", animation:"dvSpin 0.8s linear infinite" }} />
                      : <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4.5v15l13-7.5z" /></svg>}
                    {playgroundRunning ? "Running..." : "Run"}
                    {!isPhone && !playgroundRunning && <span style={{ fontFamily:mono, fontSize:11.5, fontWeight:400, opacity:0.75 }}>Ctrl+Enter</span>}
                  </button>
                </div>
              </div>
              <div style={{ flex:1, minHeight:0, display:"flex", flexDirection:"column", background:"#141414" }}>
                <CodeEditor
                  key={playgroundLang}
                  value={playgroundCode}
                  onChange={setPlaygroundCode}
                  language={playgroundLang}
                  textareaRef={playgroundTextareaRef}
                  errorLines={playgroundErrorLines}
                  minHeight={isCompact ? 420 : 0}
                  ariaLabel="IDE code editor"
                  onKeyDown={(e) => {
                    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                      e.preventDefault();
                      runPlayground();
                      return;
                    }
                    handleEditorIndentation(e, playgroundCode, setPlaygroundCode, playgroundTextareaRef, playgroundLang);
                  }}
                />
              </div>
            </div>

            {/* Input + output */}
            <div style={{ display:"flex", flexDirection:"column", minHeight:0, background:"#131313" }}>
              <div style={paneHeader}>
                <span style={{ fontSize:14, fontWeight:600, color:"#f2f2f2" }}>Input</span>
                <span style={{ fontSize:13.5, color:"#8e8e8e" }}>stdin</span>
                {playgroundDraft.stdin && (
                  <button onClick={() => updatePlaygroundDraft({ stdin: "" })} style={{ marginLeft:"auto", background:"none", border:"none", color:"#a3a3a3", fontFamily:"inherit", fontSize:13, cursor:"pointer", padding:"4px 2px" }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = "#f2f2f2"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = "#a3a3a3"; }}>
                    Clear
                  </button>
                )}
              </div>
              <textarea
                className="dv-ide-input"
                value={playgroundDraft.stdin}
                onChange={(e) => updatePlaygroundDraft({ stdin: e.target.value })}
                spellCheck={false}
                aria-label="Program input"
                placeholder="Type the input your program reads"
                style={{ height:isCompact ? 130 : 180, resize:"vertical", background:"#141414", border:"none", borderBottom:"1px solid #222", padding:`14px ${isPhone ? 12 : 16}px`, color:"#ececec", fontFamily:mono, fontSize:13.5, lineHeight:1.6, outline:"none", boxSizing:"border-box", width:"100%", flexShrink:0 }}
              />
              <div style={paneHeader}>
                <span style={{ fontSize:14, fontWeight:600, color:"#f2f2f2" }}>Output</span>
                <span style={{ marginLeft:"auto", fontSize:12.5 }}>{outputStatus}</span>
              </div>
              <div aria-live="polite" style={{ flex:1, minHeight: isCompact ? 220 : 0, overflow:"auto", background:"#141414", padding:`14px ${isPhone ? 12 : 16}px`, fontFamily:mono, fontSize:13.5, lineHeight:1.65 }}>
                {playgroundRunning && <div style={{ color:"#a3a3a3" }}>Running your code...</div>}
                {!playgroundRunning && !result && <div style={{ color:"#6b6b6b" }}>Press Run or Ctrl+Enter to see the output here.</div>}
                {!playgroundRunning && result?.error && <div style={{ color:"#ff8a8a", whiteSpace:"pre-wrap" }}>{result.error}</div>}
                {!playgroundRunning && result && !result.error && (
                  <>
                    {result.stdout
                      ? <pre style={{ margin:0, color:"#ececec", whiteSpace:"pre-wrap", wordBreak:"break-word", fontFamily:"inherit" }}>{result.stdout}</pre>
                      : !errorText && <div style={{ color:"#6b6b6b" }}>(no output)</div>}
                    {errorText && <pre style={{ margin: result.stdout ? "12px 0 0" : 0, color:"#ff8a8a", whiteSpace:"pre-wrap", wordBreak:"break-word", fontFamily:"inherit" }}>{errorText}</pre>}
                  </>
                )}
              </div>
              <div style={{ color:"#7a7a7a", fontSize:12, padding:`10px ${isPhone ? 12 : 16}px`, borderTop:"1px solid #222", flexShrink:0 }}>
                Your code and input are saved in this browser. Java code must use <code style={{ fontFamily:mono, color:"#c9c9c9" }}>public class Main</code>.
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── MONTHLY CODING CHALLENGE ──────────────────────────────────────────────
  if (view === "challenge") {
    const challenge = challengeData?.challenge || null;
    const previous = challengeData?.previous || null;
    const tone = challenge ? (CHALLENGE_STATUS_TONE[challenge.status] || CHALLENGE_STATUS_TONE.LIVE) : null;
    const timeLeft = challenge ? formatTimeLeft(challenge.status === "LIVE" ? challenge.endsAt : challenge.startsAt) : "";
    const mySolvedIds = new Set((challenge?.me?.solvedProblemIds || []).map(String));
    const cardStyle = { background:"#0f1119", border:"1px solid #22263a", borderRadius:20, padding:"20px 22px" };
    const sectionLabel = { color:"#7a7f9e", fontSize:11.5, fontWeight:700, letterSpacing:"0.14em", textTransform:"uppercase", fontFamily:"'Space Grotesk',sans-serif", marginBottom:12 };
    const prizeTones = [
      { edge:"#f3c969", glow:"rgba(243,201,105,0.22)" },
      { edge:"#cfd6df", glow:"rgba(207,214,223,0.16)" },
      { edge:"#c58a5c", glow:"rgba(197,138,92,0.18)" },
    ];

    return (
      <div style={{ position: "relative" }} onContextMenu={(e) => e.preventDefault()}>
        <ScreenShield active={shieldActive} message={shieldActiveMessage} title={shieldTitle} action={shieldAction} />
        {renderFullscreenGate()}
        {renderLiveTestPopupModal()}
        <div style={{ ...S.app, opacity: shieldActive ? 0 : 1, pointerEvents: shieldActive ? "none" : "auto", transition: "opacity 0.12s ease", userSelect: shieldActive ? "none" : "auto" }}>
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
            <button onClick={()=>openLeaderboard("All")} style={S.navBtn(false)}>
              <span style={S.navBtnLabel(false)}>Leaderboard</span>
              <span style={S.navBtnHint(false)}>See the top performers</span>
            </button>
            {renderExtraNavButtons("challenge")}
            <div style={{ marginLeft:"auto", display:"flex", gap:12, alignItems:"center" }}>
              {renderStreakPill()}
              <div onClick={openProfile} style={{ width:32, height:32, borderRadius:"50%", background:"linear-gradient(135deg,#7c6af7,#4fd1c5)", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:700, cursor:"pointer" }}>{userBadge}</div>
            </div>
          </nav>

          <div style={{ maxWidth:1180, margin:isPhone ? "20px auto 40px" : "32px auto 48px", padding:`0 ${pageGutter}px`, width:"100%", boxSizing:"border-box", display:"grid", gap:20 }}>
            {challengeError && !challenge && (
              <div style={{ background:"#180b0b", border:"1px solid #4b1717", color:"#ffb0b0", borderRadius:14, padding:"12px 14px", fontSize:13 }}>{challengeError}</div>
            )}

            {!challenge ? (
              <div style={{ ...cardStyle, textAlign:"center", padding:"48px 24px" }}>
                <div style={{ fontSize:54, marginBottom:12 }}>🏆</div>
                <h1 style={{ margin:"0 0 10px", color:"#f5f6ff", fontFamily:"'Fraunces',serif", fontSize:isPhone ? 28 : 36 }}>Monthly Coding Challenge</h1>
                <div style={{ color:"#a9aed0", fontSize:15, lineHeight:1.7, maxWidth:560, margin:"0 auto" }}>
                  {challengeLoading ? "Loading the challenge..." : "No challenge has been announced yet. Every month the top 3 coders win a DevOrbit hoodie 🧥 and gifts 🎁. Keep your streak going so you are ready!"}
                </div>
              </div>
            ) : (
              <>
                {/* Hero */}
                <div style={{ borderRadius:26, padding:isPhone ? "24px 20px" : "32px 32px", background:"radial-gradient(circle at top right, rgba(243,201,105,0.22), transparent 45%), radial-gradient(circle at bottom left, rgba(124,106,247,0.25), transparent 50%), #0d0f17", border:"1px solid #3b3220", boxShadow:"0 24px 70px rgba(0,0,0,0.35)" }}>
                  <div style={{ display:"flex", gap:10, alignItems:"center", flexWrap:"wrap", marginBottom:14 }}>
                    <span style={{ color:tone.color, background:tone.background, border:`1px solid ${tone.border}`, borderRadius:999, padding:"4px 12px", fontSize:11.5, fontWeight:800, letterSpacing:"0.08em", textTransform:"uppercase" }}>{tone.label}</span>
                    <span style={{ color:"#d6d9f0", fontSize:13 }}>{challenge.monthLabel}</span>
                    {timeLeft && <span style={{ color:"#ffd089", fontSize:13, fontWeight:700 }}>⏳ {challenge.status === "LIVE" ? `${timeLeft} left` : `Starts in ${timeLeft}`}</span>}
                  </div>
                  <h1 style={{ margin:"0 0 10px", color:"#fff4d6", fontFamily:"'Fraunces',serif", fontSize:isPhone ? 30 : 44, lineHeight:1.05, letterSpacing:"-0.03em" }}>{challenge.title}</h1>
                  <div style={{ color:"#c9cbe2", fontSize:15, lineHeight:1.7, maxWidth:720, whiteSpace:"pre-wrap" }}>
                    {challenge.description || "Solve this month's problems to climb the challenge board. The top 3 coders win a DevOrbit hoodie and gifts!"}
                  </div>
                  <div style={{ display:"flex", gap:12, flexWrap:"wrap", marginTop:20 }}>
                    {[
                      ["Problems", challenge.problems.length],
                      ["Max points", challenge.maxScore],
                      ["Participants", challenge.participantCount],
                      ["Your rank", challenge.me?.rank ? `#${challenge.me.rank}` : "--"],
                      ["Your points", challenge.me?.score || 0],
                    ].map(([label, value]) => (
                      <div key={label} style={{ background:"rgba(10,10,15,0.6)", border:"1px solid #2a2d40", borderRadius:14, padding:"10px 16px", minWidth:100 }}>
                        <div style={{ color:"#7a7f9e", fontSize:10.5, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:4 }}>{label}</div>
                        <div style={{ color:"#f5f6ff", fontSize:20, fontWeight:800 }}>{value}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Prizes */}
                <div>
                  <div style={sectionLabel}>🎁 Prizes for the top 3</div>
                  <div style={{ display:"grid", gridTemplateColumns:`repeat(auto-fit, minmax(${isPhone ? 200 : 240}px, 1fr))`, gap:14 }}>
                    {challenge.prizes.slice(0, 3).map((prize, index) => (
                      <div key={index} style={{ ...cardStyle, borderColor:prizeTones[index].edge, boxShadow:`0 16px 40px ${prizeTones[index].glow}`, display:"flex", alignItems:"center", gap:14 }}>
                        <div style={{ fontSize:38 }}>{PRIZE_MEDALS[index]}</div>
                        <div>
                          <div style={{ color:prizeTones[index].edge, fontSize:12, fontWeight:800, letterSpacing:"0.1em", textTransform:"uppercase" }}>Rank {index + 1}</div>
                          <div style={{ color:"#f5f6ff", fontSize:15.5, fontWeight:700, marginTop:4 }}>🧥 {prize}</div>
                          {challenge.winners?.[index] && <div style={{ color:"#73f0b3", fontSize:13, marginTop:6 }}>Winner: {challenge.winners[index].name}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ display:"grid", gridTemplateColumns: isCompact ? "minmax(0, 1fr)" : "minmax(0, 1fr) minmax(0, 1fr)", gap:20, alignItems:"start" }}>
                  {/* Problems */}
                  <div style={cardStyle}>
                    <div style={sectionLabel}>Challenge problems</div>
                    <div style={{ display:"grid", gap:10 }}>
                      {challenge.problems.map((problem, index) => {
                        const catalogProblem = problemCatalog.find((item) => sameValue(item.dbId, problem.id));
                        const solvedHere = mySolvedIds.has(String(problem.id));
                        const canOpen = Boolean(catalogProblem) && challenge.status !== "UPCOMING";
                        const difficulty = formatDifficultyLabel(problem.difficulty);
                        return (
                          <div
                            key={problem.id}
                            role={canOpen ? "button" : undefined}
                            tabIndex={canOpen ? 0 : undefined}
                            onClick={() => { if (canOpen) openProblem(catalogProblem, "catalog"); }}
                            onKeyDown={(e) => { if (canOpen && e.key === "Enter") openProblem(catalogProblem, "catalog"); }}
                            style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 14px", borderRadius:14, background:solvedHere ? "rgba(34,197,94,0.08)" : "#12141e", border:`1px solid ${solvedHere ? "rgba(34,197,94,0.35)" : "#23273a"}`, cursor:canOpen ? "pointer" : "default", opacity:canOpen || solvedHere ? 1 : 0.6 }}
                          >
                            <span style={{ width:28, height:28, borderRadius:8, background:"#1b1e2c", color:"#a9aed0", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:800, fontSize:13, flexShrink:0 }}>{index + 1}</span>
                            <div style={{ flex:1, minWidth:0 }}>
                              <div style={{ color:"#eef0ff", fontWeight:700, fontSize:15, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{problem.title}</div>
                              <div style={{ color:"#7a7f9e", fontSize:12, marginTop:3 }}>
                                {solvedHere ? "✓ Solved for this challenge" : challenge.status === "UPCOMING" ? `Opens ${formatChallengeDate(challenge.startsAt)}` : catalogProblem ? "Click to solve" : "Not available right now"}
                              </div>
                            </div>
                            <span style={S.badge(difficulty)}>{difficulty}</span>
                            <span style={{ color:"#ffd089", fontWeight:800, fontSize:13, minWidth:52, textAlign:"right" }}>+{problem.points}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Standings */}
                  <div style={cardStyle}>
                    <div style={{ ...sectionLabel, display:"flex", justifyContent:"space-between", gap:8 }}>
                      <span>{challenge.status === "ENDED" ? "Final standings" : "Live standings"}</span>
                      <button onClick={loadCurrentChallenge} disabled={challengeLoading} style={{ background:"none", border:"none", color:"#93c5fd", cursor:"pointer", fontSize:11.5, fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase", padding:0 }}>
                        {challengeLoading ? "Refreshing..." : "↻ Refresh"}
                      </button>
                    </div>
                    {challenge.standings.length ? (
                      <div style={{ display:"grid", gap:8 }}>
                        {challenge.standings.map((row, index) => {
                          const isMe = sameValue(row.userId, currentUser.id);
                          const medal = row.rank && row.rank <= 3 ? PRIZE_MEDALS[row.rank - 1] : null;
                          return (
                            <div key={row.userId} style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 12px", borderRadius:12, background:isMe ? "rgba(124,106,247,0.14)" : index % 2 ? "#0f1119" : "#12141e", border:`1px solid ${isMe ? "#7c6af7" : medal ? prizeTones[row.rank - 1].edge + "66" : "#1d2030"}` }}>
                              <span style={{ width:36, textAlign:"center", fontWeight:800, color:"#eef0ff", fontSize:medal ? 20 : 14 }}>{medal || (row.rank ? row.rank : "--")}</span>
                              <div style={{ flex:1, minWidth:0 }}>
                                <div style={{ color:"#f5f6ff", fontWeight:700, fontSize:14, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                                  {row.name}{isMe && <span style={{ color:"#c4b5fd", fontSize:11, marginLeft:8, fontWeight:800 }}>YOU</span>}
                                </div>
                                <div style={{ color:"#7a7f9e", fontSize:12 }}>{row.solved}/{challenge.problems.length} solved{row.department ? ` · ${row.department}` : ""}</div>
                              </div>
                              <span style={{ color:"#73f0b3", fontWeight:800, fontSize:16 }}>{row.score}</span>
                            </div>
                          );
                        })}
                        {challenge.me && !challenge.standings.some((row) => sameValue(row.userId, currentUser.id)) && (
                          <div style={{ marginTop:6, padding:"10px 12px", borderRadius:12, background:"rgba(124,106,247,0.14)", border:"1px solid #7c6af7", color:"#e0dcff", fontSize:13 }}>
                            You: {challenge.me.rank ? `#${challenge.me.rank}` : "not ranked yet"} · {challenge.me.score} points · {challenge.me.solved} solved
                          </div>
                        )}
                      </div>
                    ) : (
                      <div style={{ color:"#8f93b4", fontSize:14, lineHeight:1.7 }}>
                        {challenge.status === "UPCOMING" ? "The board opens when the challenge starts." : "No one is on the board yet. Solve a problem and take the #1 spot!"}
                      </div>
                    )}
                  </div>
                </div>

                {/* Rules */}
                <div style={cardStyle}>
                  <div style={sectionLabel}>How it works</div>
                  <div style={{ display:"grid", gridTemplateColumns:`repeat(auto-fit, minmax(${isPhone ? 200 : 230}px, 1fr))`, gap:14, color:"#c9cbe2", fontSize:14, lineHeight:1.6 }}>
                    <div>📅 Runs from <strong>{formatChallengeDate(challenge.startsAt)}</strong> to <strong>{formatChallengeDate(challenge.endsAt)}</strong>.</div>
                    <div>✅ Only accepted submissions made during the challenge month count. Problems solved before it started need a fresh submission.</div>
                    <div>🎯 Easy = 20, Medium = 35, Hard = 50 points. Ties go to whoever reached the score first, then to fewer wrong attempts.</div>
                    <div>🧥 The top 3 at the end of the month win the prizes. Winners are announced here.</div>
                  </div>
                </div>
              </>
            )}

            {previous?.winners?.length > 0 && (
              <div style={cardStyle}>
                <div style={sectionLabel}>🏅 Last winners · {previous.monthLabel}</div>
                <div style={{ display:"grid", gridTemplateColumns:`repeat(auto-fit, minmax(${isPhone ? 200 : 220}px, 1fr))`, gap:12 }}>
                  {previous.winners.map((row) => (
                    <div key={row.userId} style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 14px", borderRadius:14, background:"#12141e", border:"1px solid #23273a" }}>
                      <span style={{ fontSize:28 }}>{PRIZE_MEDALS[row.rank - 1] || "🏅"}</span>
                      <div style={{ minWidth:0 }}>
                        <div style={{ color:"#f5f6ff", fontWeight:700 }}>{row.name}</div>
                        <div style={{ color:"#7a7f9e", fontSize:12 }}>{row.score} points · {previous.prizes?.[row.rank - 1] || "Prize"}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── LEADERBOARD ───────────────────────────────────────────────────────────
  if (view === "leaderboard") {
    const myBoardEntry = leaderboardRows.find((entry) => sameValue(entry.userId, currentUser.id)) || null;
    const showPodium = !leaderboardSearch.trim() && safeLeaderboardPage === 1 && leaderboardRows.length > 0;
    const podiumOrder = isPhone ? [0, 1, 2] : [1, 0, 2];
    const podiumEntries = showPodium
      ? podiumOrder.map((index) => leaderboardRows[index]).filter(Boolean)
      : [];
    const podiumMeta = {
      1: { medal:"🥇", edge:"#f3c969", glow:"rgba(243,201,105,0.28)", pedestal:isPhone ? 0 : 46, avatar:76 },
      2: { medal:"🥈", edge:"#cfd6df", glow:"rgba(207,214,223,0.18)", pedestal:isPhone ? 0 : 22, avatar:62 },
      3: { medal:"🥉", edge:"#c58a5c", glow:"rgba(197,138,92,0.2)", pedestal:0, avatar:62 },
    };
    const scopeOptions = [
      { value:"All", label:"Practice Arena" },
      { value:"This Contest", label:"This Contest" },
      { value:"Global", label:"Global" },
    ];
    const headerStats = [
      { label:"Ranked students", value:leaderboardRows.length, color:"#73f0b3" },
      { label:"Top score", value:leaderboardRows[0]?.stats?.score ?? "--", color:"#ffd089" },
      { label:"Your rank", value:myBoardEntry ? `#${myBoardEntry.displayRank}` : "--", color:"#c4b5fd" },
      { label:"Your streak", value:`🔥 ${streakInfo?.currentStreak || 0}`, color:"#ffb547" },
    ];

    return (
      <div style={{ position: "relative" }} onContextMenu={(e) => e.preventDefault()}>
        <ScreenShield active={shieldActive} message={shieldActiveMessage} title={shieldTitle} action={shieldAction} />
        {renderFullscreenGate()}
        {renderLiveTestPopupModal()}
        <div style={{ ...S.app, opacity: shieldActive ? 0 : 1, pointerEvents: shieldActive ? "none" : "auto", transition: "opacity 0.12s ease", userSelect: shieldActive ? "none" : "auto" }}>
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
            {renderExtraNavButtons()}
            <div style={{ marginLeft:"auto", display:"flex", gap:12, alignItems:"center" }}>
              <div style={{ padding:"7px 12px", borderRadius:999, border:"1px solid #273246", background:"#111b22", color:"#7ce7ff", fontSize:11.5, fontWeight:700, letterSpacing:"0.06em", textTransform:"uppercase", fontFamily:"'Space Grotesk',sans-serif", display:"flex", alignItems:"center" }}>
                <span style={{ display:"inline-block", width:8, height:8, borderRadius:"50%", background:leaderboardUpdating ? "#4fd1c5" : "#2f8f86", marginRight:8, boxShadow:"0 0 12px #4fd1c566", transition:"background 0.6s ease" }} />
                Live
              </div>
              {renderStreakPill()}
              <div onClick={openProfile} style={{ width:32, height:32, borderRadius:"50%", background:"linear-gradient(135deg,#7c6af7,#4fd1c5)", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:700, cursor:"pointer" }}>{userBadge}</div>
            </div>
          </nav>

          <div style={{ maxWidth:1180, margin:isPhone ? "20px auto 40px" : "32px auto 48px", padding:`0 ${pageGutter}px`, width:"100%", boxSizing:"border-box" }}>
            <div
              style={{
                background:"radial-gradient(circle at 15% 0%, rgba(124,106,247,0.26), transparent 45%), radial-gradient(circle at 90% 10%, rgba(243,201,105,0.16), transparent 40%), #0a0b12",
                border:"1px solid #25253b",
                borderRadius:28,
                padding:isPhone ? "22px 16px 24px" : "30px 28px 32px",
                boxShadow:"0 24px 70px rgba(0,0,0,0.32)",
                opacity:leaderboardReady ? 1 : 0,
                transform:leaderboardReady ? "translateY(0)" : "translateY(18px)",
                transition:"opacity 0.45s ease, transform 0.45s ease",
              }}
            >
              {/* Header */}
              <div style={{ display:"flex", justifyContent:"space-between", gap:18, alignItems:"flex-start", flexWrap:"wrap", marginBottom:22 }}>
                <div style={{ maxWidth:560 }}>
                  <div style={{ color:"#9a90ff", fontSize:12, fontWeight:700, letterSpacing:"0.16em", textTransform:"uppercase", fontFamily:"'Space Grotesk',sans-serif", marginBottom:10 }}>🏆 Hall of Fame</div>
                  <h1 style={{ margin:"0 0 10px", color:"#f5f6ff", fontFamily:"'Fraunces',serif", fontSize:isPhone ? 32 : 44, lineHeight:1, letterSpacing:"-0.04em" }}>Leaderboard</h1>
                  <div style={{ color:"#a9aed0", fontSize:15, lineHeight:1.7 }}>
                    Solve problems, keep your daily streak alive, and climb to the top. Harder problems earn more points.
                  </div>
                </div>
                <div style={{ display:"grid", gridTemplateColumns:isPhone ? "repeat(2, minmax(0, 1fr))" : "repeat(4, minmax(110px, 1fr))", gap:10, flex:isPhone ? "1 1 100%" : "0 1 auto" }}>
                  {headerStats.map((stat) => (
                    <div key={stat.label} style={{ background:"rgba(16,19,28,0.85)", border:"1px solid #22283a", borderRadius:16, padding:"12px 14px" }}>
                      <div style={{ color:"#7780a1", fontSize:10.5, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:6 }}>{stat.label}</div>
                      <div style={{ color:stat.color, fontSize:20, fontWeight:800 }}>{stat.value}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Scope + search */}
              <div style={{ display:"flex", gap:12, alignItems:"center", flexWrap:"wrap", marginBottom:22 }}>
                <div style={{ display:"flex", gap:4, padding:4, background:"#0e1017", border:"1px solid #24283a", borderRadius:14, flexWrap:"wrap" }}>
                  {scopeOptions.map((option) => {
                    const active = leaderboardScope === option.value;
                    return (
                      <button
                        key={option.value}
                        onClick={() => setLeaderboardScope(option.value)}
                        style={{ border:"none", cursor:"pointer", borderRadius:10, padding:"9px 14px", fontSize:13, fontWeight:700, fontFamily:"'Outfit','Space Grotesk',sans-serif", background:active ? "linear-gradient(135deg,#7c6af7,#4f8bf7)" : "transparent", color:active ? "#fff" : "#8f93b4", boxShadow:active ? "0 8px 20px rgba(124,106,247,0.35)" : "none", transition:"all 0.2s ease" }}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
                <input
                  placeholder="🔍  Search student..."
                  value={leaderboardSearch}
                  onChange={(e)=>setLeaderboardSearch(e.target.value)}
                  style={{ flex:1, minWidth:200, background:"#0e1017", border:"1px solid #24283a", borderRadius:12, padding:"12px 14px", color:"#eef0ff", fontFamily:"'Outfit','Space Grotesk',sans-serif", fontSize:14, outline:"none" }}
                />
              </div>

              {/* Contest status (contest scope only) */}
              {leaderboardScope === "This Contest" && (myBoardEntry?.hasContestSubmission ? (
                <div style={{ marginBottom:18, background:"rgba(16, 185, 129, 0.1)", border:"1px solid #10b981", borderRadius:16, padding:"14px 18px", color:"#6ee7b7", fontSize:14, display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:10 }}>
                  <span>✓ <strong>Your exam:</strong> submitted and evaluated. Official rank <strong>#{myBoardEntry.contest?.rank || myBoardEntry.displayRank}</strong></span>
                  <strong>Score: {myBoardEntry.contest?.score} / {myBoardEntry.contest?.maxScore || 10} ({myBoardEntry.contest?.percentage ?? 0}%)</strong>
                </div>
              ) : (
                <div style={{ marginBottom:18, background:"rgba(59, 130, 246, 0.1)", border:"1px solid #3b82f6", borderRadius:16, padding:"14px 18px", color:"#93c5fd", fontSize:14 }}>
                  💡 Only students who have submitted the current exam appear here. Submit your exam to get an official rank.
                </div>
              ))}

              {/* Podium */}
              {podiumEntries.length > 0 && (
                <div style={{ display:"grid", gridTemplateColumns:isPhone ? "minmax(0, 1fr)" : `repeat(${podiumEntries.length}, minmax(0, 1fr))`, gap:14, alignItems:"end", marginBottom:22, maxWidth:podiumEntries.length < 3 && !isPhone ? 260 * podiumEntries.length : "none", marginLeft:"auto", marginRight:"auto" }}>
                  {podiumEntries.map((entry) => {
                    const meta = podiumMeta[entry.displayRank] || podiumMeta[3];
                    const isMe = sameValue(entry.userId, currentUser.id);
                    return (
                      <div key={`podium-${entry.userId || entry.username}`} style={{ position:"relative", textAlign:"center", borderRadius:22, padding:`22px 16px ${18 + meta.pedestal}px`, background:`linear-gradient(180deg, ${meta.glow}, rgba(13,16,23,0.95) 60%)`, border:`1px solid ${isMe ? "#7c6af7" : meta.edge}`, boxShadow:`0 18px 44px ${meta.glow}` }}>
                        {entry.displayRank === 1 && <div style={{ position:"absolute", top:-18, left:"50%", transform:"translateX(-50%)", fontSize:28 }}>👑</div>}
                        <div style={{ width:meta.avatar, height:meta.avatar, margin:"0 auto 12px", borderRadius:"50%", background:`linear-gradient(135deg, ${entry.avatarGradient?.[0] || "#7c6af7"}, ${entry.avatarGradient?.[1] || "#4fd1c5"})`, display:"flex", alignItems:"center", justifyContent:"center", color:"#081018", fontWeight:800, fontSize:meta.avatar / 3, border:`3px solid ${meta.edge}`, boxShadow:`0 0 24px ${meta.glow}` }}>
                          {getAvatarLabel(entry.username)}
                        </div>
                        <div style={{ fontSize:26, lineHeight:1 }}>{meta.medal}</div>
                        <div style={{ color:"#f5f6ff", fontSize:16, fontWeight:800, marginTop:8, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                          {entry.username}{isMe && <span style={{ color:"#c4b5fd", fontSize:11, marginLeft:6 }}>YOU</span>}
                        </div>
                        <div style={{ color:meta.edge, fontSize:26, fontWeight:800, marginTop:6 }}>{entry.stats?.score ?? 0}<span style={{ color:"#8f93b4", fontSize:12, fontWeight:600, marginLeft:4 }}>pts</span></div>
                        <div style={{ color:"#a9aed0", fontSize:12.5, marginTop:6 }}>
                          {entry.stats?.problemsSolved ?? 0} solved · 🔥 {entry.streak?.current || 0}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Your position, when it is not on this page */}
              {myBoardEntry && !visibleLeaderboardRows.some((entry) => sameValue(entry.userId, currentUser.id)) && (
                <div style={{ marginBottom:16, display:"flex", alignItems:"center", gap:12, flexWrap:"wrap", padding:"12px 16px", borderRadius:16, background:"rgba(124,106,247,0.12)", border:"1px solid #7c6af7", color:"#e0dcff", fontSize:14 }}>
                  <strong style={{ fontSize:18 }}>#{myBoardEntry.displayRank}</strong>
                  <span>That's you, with <strong>{myBoardEntry.stats?.score ?? 0}</strong> points and <strong>{myBoardEntry.stats?.problemsSolved ?? 0}</strong> solved.</span>
                  <span style={{ marginLeft:"auto", color:"#a9aed0" }}>
                    {myBoardEntry.displayRank > 1 && leaderboardRows[myBoardEntry.displayRank - 2]
                      ? `${Math.max(1, (leaderboardRows[myBoardEntry.displayRank - 2].stats?.score || 0) - (myBoardEntry.stats?.score || 0))} pts to pass #${myBoardEntry.displayRank - 1}`
                      : "Keep it up!"}
                  </span>
                </div>
              )}

              {/* Table */}
              <div style={{ background:"#0d1017", border:"1px solid #202437", borderRadius:22, padding:isPhone ? "8px" : "14px", overflowX:"auto" }}>
                <table style={{ width:"100%", minWidth:640, borderCollapse:"separate", borderSpacing:"0 8px" }}>
                  <thead>
                    <tr>
                      {["Rank", "Student", "Score", "Solved", "Streak", "Time Penalty"].map((heading) => (
                        <th key={heading} style={{ textAlign:"left", padding:"0 16px 6px", fontSize:11, color:"#7a7f9e", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.12em", fontFamily:"'Space Grotesk',sans-serif" }}>
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {visibleLeaderboardRows.length ? visibleLeaderboardRows.map((entry, index) => {
                      const rank = entry.displayRank || entry.stats?.rank;
                      const accent = getLeaderboardAccent(rank);
                      const submissionLevel = entry.stats?.submissionLevel || "No Submission";
                      const levelMeta = getSubmissionLevelMeta(submissionLevel);
                      const isHovered = hoveredLeaderboardRank === entry.username;
                      const isMe = sameValue(entry.userId, currentUser.id);
                      const streakCount = entry.streak?.current || 0;
                      const edge = isMe ? "#7c6af7" : accent.edge;
                      const rowBackground = isMe
                        ? "linear-gradient(90deg, rgba(124,106,247,0.22), rgba(17,17,24,0.94) 30%)"
                        : accent.badge
                          ? accent.background
                          : index % 2 === 0 ? "#11131b" : "#0e1018";
                      const cell = {
                        background: rowBackground,
                        borderTop:`1px solid ${edge}`,
                        borderBottom:`1px solid ${edge}`,
                        padding:"14px 16px",
                        transition:"background 0.2s ease, border-color 0.2s ease",
                      };

                      return (
                        <tr
                          key={`${leaderboardMode}-${entry.userId || entry.username}`}
                          onMouseEnter={() => setHoveredLeaderboardRank(entry.username)}
                          onMouseLeave={() => setHoveredLeaderboardRank(null)}
                          style={{ transform: isHovered ? "translateX(4px)" : "none", transition:"transform 0.2s ease, filter 0.2s ease", filter: isHovered ? "brightness(1.08)" : "none" }}
                        >
                          <td style={{ ...cell, borderLeft:`3px solid ${edge}`, borderRadius:"14px 0 0 14px", width:70 }}>
                            <div style={{ display:"flex", alignItems:"center", gap:8, color:"#eef0ff", fontWeight:800 }}>
                              {accent.badge
                                ? <span style={{ fontSize:24 }}>{accent.badge}</span>
                                : <span style={{ width:30, height:30, borderRadius:9, background:"#1a1d2b", display:"inline-flex", alignItems:"center", justifyContent:"center", fontSize:14 }}>{rank}</span>}
                            </div>
                          </td>
                          <td style={cell}>
                            <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                              <div style={{ width:40, height:40, flexShrink:0, borderRadius:"50%", background:`linear-gradient(135deg, ${entry.avatarGradient?.[0] || "#7c6af7"}, ${entry.avatarGradient?.[1] || "#4fd1c5"})`, display:"flex", alignItems:"center", justifyContent:"center", color:"#081018", fontWeight:800, fontSize:14, boxShadow:"inset 0 1px 0 rgba(255,255,255,0.25)" }}>
                                {getAvatarLabel(entry.username)}
                              </div>
                              <div style={{ minWidth:0 }}>
                                <div style={{ color:"#f5f6ff", fontSize:15, fontWeight:700, display:"flex", alignItems:"center", gap:8 }}>
                                  {entry.username}
                                  {isMe && <span style={{ color:"#fff", background:"#7c6af7", fontSize:10, fontWeight:800, letterSpacing:"0.08em", borderRadius:999, padding:"2px 7px" }}>YOU</span>}
                                </div>
                                <div style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap", marginTop:5 }}>
                                  {entry.badgeTier && <AchievementBadge tier={entry.badgeTier} compact />}
                                  <span style={{ color:levelMeta.color, fontSize:10.5, fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase", border:`1px solid ${levelMeta.border}`, background:levelMeta.background, borderRadius:999, padding:"2px 8px" }}>
                                    {submissionLevel}
                                  </span>
                                  {entry.department && <span style={{ color:"#7a7f9e", fontSize:12 }}>{entry.department}</span>}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td style={{ ...cell, color:"#73f0b3", fontWeight:800, fontSize:17 }}>{entry.stats?.score ?? 0}</td>
                          <td style={{ ...cell, color:"#eef0ff", fontWeight:600 }}>{entry.stats?.problemsSolved ?? 0}</td>
                          <td style={cell}>
                            <span style={{ display:"inline-flex", alignItems:"center", gap:4, color:streakCount ? "#ffb547" : "#5d6180", fontWeight:800 }}>
                              <span style={{ filter:streakCount ? "none" : "grayscale(1)" }}>🔥</span>{streakCount}
                            </span>
                          </td>
                          <td style={{ ...cell, borderRight:`1px solid ${edge}`, borderRadius:"0 14px 14px 0", color:"#dfe2ff", fontWeight:600 }}>
                            {entry.stats?.timePenalty || "--"}
                          </td>
                        </tr>
                      );
                    }) : (
                      <tr>
                        <td colSpan="6" style={{ padding:"38px 18px", textAlign:"center", color:"#8f93b4" }}>
                          {leaderboardSearch.trim()
                            ? "No students matched that name."
                            : leaderboardScope === "This Contest"
                              ? "No students have submitted this contest yet."
                              : "No ranked students yet. Solve a problem to be the first!"}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>

                {leaderboardPageCount > 1 && (
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:12, marginTop:10, padding:"0 6px 4px", flexWrap:"wrap" }}>
                    <div style={{ color:"#7a7f9e", fontSize:12 }}>
                      Page {safeLeaderboardPage} of {leaderboardPageCount}
                    </div>
                    <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                      <button onClick={() => setLeaderboardPage((prev) => Math.max(1, prev - 1))} disabled={safeLeaderboardPage === 1} style={{ ...S.btn("default"), opacity:safeLeaderboardPage === 1 ? 0.45 : 1 }}>
                        Previous
                      </button>
                      <button onClick={() => setLeaderboardPage((prev) => Math.min(leaderboardPageCount, prev + 1))} disabled={safeLeaderboardPage === leaderboardPageCount} style={{ ...S.btn("default"), opacity:safeLeaderboardPage === leaderboardPageCount ? 0.45 : 1 }}>
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {challengeData?.challenge && challengeData.challenge.status !== "ENDED" && (
                <div style={{ marginTop:18 }}>{renderChallengeBanner()}</div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (assessmentResult) return renderAssessmentResultView();

  const p = selectedProblem;
  const isExamWorkspace = problemNavigationSource === "contest" && contestEntered;
  const consoleHeight = consoleOpen ? (isPhone ? 320 : 260) : 0;
  const isTheoryProblem = p && (p.type === "theory" || (Array.isArray(p.options) && p.options.length > 0));
  const problemWorkspaceStyle = isCompact
    ? { display:"grid", gridTemplateColumns:"minmax(0, 1fr)", overflow:"visible", minHeight:"calc(100vh - 116px)" }
    : { display:"flex", flex:1, overflow:"hidden", height:`calc(100vh - ${(isExamWorkspace ? 130 : 72) + PROBLEM_ACTION_BAR_HEIGHT}px)` };
  // Exam question palette: completed = coding answer submitted / MCQ option chosen; attempted = code run only.
  const getExamQuestionState = (problem) => {
    const keys = [problem.dbId, problem.id, problem.legacyId].filter((key) => key !== undefined && key !== null && key !== "");
    if (keys.some((key) => candidateTheoryAnswers[key] !== undefined && candidateTheoryAnswers[key] !== null && candidateTheoryAnswers[key] !== "")) return "completed";
    if (keys.some((key) => candidateCodingAnswers[key]?.submitted) || contestSessionProgress[problem.id] === "accepted" || contestSessionProgress[problem.id] === "rejected") return "completed";
    if (keys.some((key) => candidateCodingAnswers[key])) return "attempted";
    return "notStarted";
  };
  const examQuestionStates = isExamWorkspace ? problemNavigation.map(getExamQuestionState) : [];
  const examCompletedCount = examQuestionStates.filter((state) => state === "completed").length;
  const problemPanelStyle = isCompact
    ? { display:"flex", flexDirection:"column", borderBottom:"1px solid #262626", overflow:"hidden", minHeight:isPhone ? 360 : 420 }
    : { width:"42%", display:"flex", flexDirection:"column", borderRight:"1px solid #262626", overflow:"hidden" };
  const editorPanelStyle = isCompact
    ? { display:"flex", flexDirection:"column", overflow:"hidden", minHeight:isPhone ? 620 : 680 }
    : { flex:1, display:"flex", flexDirection:"column", overflow:"hidden" };

  return (
    <div style={{ position: "relative" }} onContextMenu={(e) => e.preventDefault()}>
      <ScreenShield active={shieldActive} message={shieldActiveMessage} title={shieldTitle} action={shieldAction} />
      {renderFullscreenGate()}
      <div style={{ ...S.app, background:"#131313", color:"#ececec", fontFamily:"'IBM Plex Sans','Outfit',system-ui,sans-serif", opacity: shieldActive ? 0 : 1, pointerEvents: shieldActive ? "none" : "auto", transition: "opacity 0.12s ease", userSelect: shieldActive ? "none" : "auto" }}>
      <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
      <style>{`
        .dv-ws-body { color:#d4d4d4; font-size:15px; line-height:1.75; }
        .dv-ws-body p { margin:0 0 14px; }
        .dv-ws-body code { font-family:'IBM Plex Mono','JetBrains Mono',monospace; font-size:13px; background:#232323; border:1px solid #2e2e2e; border-radius:4px; padding:1px 6px; color:#e5e5e5; }
        .dv-ws-body pre { background:#181818; border:1px solid #262626; border-radius:6px; padding:12px 14px; overflow-x:auto; }
        .dv-ws-body pre code { background:none; border:none; padding:0; }
        .dv-ws-body strong { color:#f2f2f2; }
        .dv-ws-btn:hover:not(:disabled) { border-color:#4a4a4a !important; color:#f2f2f2 !important; }
      `}</style>
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
                <li>Allow camera access. The exam cannot start without your camera.</li>
                <li>Keep your camera on and uncovered, in a well-lit room. Otherwise the exam is blurred until it works again.</li>
                <li>Keep your mobile phone away. A phone on camera blurs the exam and is recorded as malpractice.</li>
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

      <nav style={{ display:"flex", alignItems:"center", gap:isPhone ? 10 : 14, padding:`0 ${isPhone ? 12 : 16}px`, height:52, borderBottom:"1px solid #262626", background:"#131313", flexShrink:0, position:"sticky", top:0, zIndex:60 }}>
        <button onClick={isExamWorkspace ? undefined : () => setView("list")} disabled={isExamWorkspace}
          style={{ background:"none", border:"none", padding:0, cursor:isExamWorkspace ? "default" : "pointer", color:"#f2f2f2", fontFamily:"inherit", fontSize:15, fontWeight:700, flexShrink:0 }}>
          ScholarLogic
        </button>
        <span style={{ color:"#444", fontSize:15 }}>/</span>
        {isExamWorkspace ? (
          <span style={{ color:"#a3a3a3", fontSize:14, minWidth:0, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{activeContestAssignment?.title || "Exam"}</span>
        ) : (
          <button onClick={() => setView("list")} className="dv-ws-btn" style={{ background:"none", border:"1px solid transparent", borderRadius:6, padding:"5px 8px", cursor:"pointer", color:"#a3a3a3", fontFamily:"inherit", fontSize:14, display:"inline-flex", alignItems:"center", gap:7 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
            Problem list
          </button>
        )}
        {isExamWorkspace && (
          <div title="Time left" style={{ display:"inline-flex", alignItems:"center", gap:8, marginLeft:6, padding:"5px 10px", borderRadius:6, border:`1px solid ${contestTimerSeconds <= 60 ? "#7f1d1d" : "#333"}`, background:contestTimerSeconds <= 60 ? "rgba(229,87,95,0.1)" : "#1a1a1a", fontSize:13, color:"#a3a3a3", flexShrink:0 }}>
            {!isPhone && <span>Time left</span>}
            <span style={{ color:contestTimerSeconds <= 60 ? "#ff8a8a" : "#f2f2f2", fontFamily:"'IBM Plex Mono','JetBrains Mono',monospace", fontWeight:500 }}>{formatCountdown(contestTimerSeconds)}</span>
          </div>
        )}
        <div style={{ display:"flex", gap:8, alignItems:"center", marginLeft:"auto", flexShrink:0 }}>
          {showProblemNavigation && [[-1, hasPreviousProblem, "Previous"], [1, hasNextProblem, "Next"]].map(([step, enabled, label]) => (
            <button key={label} onClick={() => openAdjacentProblem(step)} disabled={!enabled} className="dv-ws-btn" aria-label={label}
              style={{ background:"transparent", border:"1px solid #333", borderRadius:6, color:"#d4d4d4", padding:isPhone ? "6px 9px" : "6px 12px", fontFamily:"inherit", fontSize:13, display:"inline-flex", alignItems:"center", gap:6, opacity:enabled ? 1 : 0.4, cursor:enabled ? "pointer" : "not-allowed" }}>
              {step < 0 && <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>}
              {!isPhone && label}
              {step > 0 && <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 18l6-6-6-6" /></svg>}
            </button>
          ))}
        </div>
      </nav>



      {isExamWorkspace && problemNavigation.length > 0 && (
        <div style={{ background:"#161616", borderBottom:"1px solid #262626", padding:"10px 16px", display:"flex", alignItems:"center", gap:14, flexWrap:"wrap" }}>
          <div style={{ color:"#e2e4ff", fontSize:13, fontWeight:700, whiteSpace:"nowrap" }}>
            Question {selectedProblemIndex + 1} of {problemNavigation.length}
            <span style={{ color:"#4cb782", marginLeft:10, fontWeight:500 }}>✓ {examCompletedCount}/{problemNavigation.length} completed</span>
          </div>
          <div style={{ display:"flex", gap:6, flexWrap:"wrap", flex:1 }}>
            {problemNavigation.map((problem, index) => {
              const state = examQuestionStates[index];
              const current = index === selectedProblemIndex;
              const colors = state === "completed"
                ? { background:"#1f6f4a", color:"#ffffff", border:"#2f8f62" }
                : state === "attempted"
                  ? { background:"#8a4a12", color:"#ffffff", border:"#b4631f" }
                  : { background:"#1c1c1c", color:"#a3a3a3", border:"#333" };
              return (
                <button
                  key={problem.dbId || problem.id || index}
                  type="button"
                  title={`Question ${index + 1}: ${problem.title || ""} (${state === "completed" ? "completed" : state === "attempted" ? "attempted" : "not started"})`}
                  onClick={() => openProblem(problem, problemNavigationSource)}
                  style={{
                    width:34,
                    height:34,
                    borderRadius:8,
                    background:colors.background,
                    color:colors.color,
                    border:current ? "2px solid #e8873a" : `1px solid ${colors.border}`,
                    boxShadow:current ? "0 0 0 3px rgba(232,135,58,0.25)" : "none",
                    fontWeight:800,
                    fontSize:13,
                    cursor:"pointer",
                    fontFamily:"'IBM Plex Mono','JetBrains Mono',monospace",
                  }}
                >
                  {index + 1}
                </button>
              );
            })}
          </div>
          <div style={{ display:"flex", gap:12, color:"#7a7f9e", fontSize:11, fontWeight:700, whiteSpace:"nowrap" }}>
            <span><span style={{ display:"inline-block", width:10, height:10, borderRadius:3, background:"#1f6f4a", marginRight:5 }} />Completed</span>
            <span><span style={{ display:"inline-block", width:10, height:10, borderRadius:3, background:"#8a4a12", marginRight:5 }} />Attempted</span>
            <span><span style={{ display:"inline-block", width:10, height:10, borderRadius:3, background:"#1c1c1c", border:"1px solid #333", marginRight:5 }} />Not started</span>
          </div>
        </div>
      )}

      <div style={problemWorkspaceStyle}>


        <div style={problemPanelStyle}>
          <div role="tablist" style={{ display:"flex", gap:24, padding:`0 ${isPhone ? 16 : 24}px`, borderBottom:"1px solid #262626", background:"#131313", overflowX:"auto", flexShrink:0 }}>
            {["description","solution","submissions"].map(t=>(
              <button key={t} role="tab" aria-selected={activeTab===t} onClick={()=>setActiveTab(t)} style={{ background:"none", border:"none", padding:"14px 0 12px", color:activeTab===t?"#f2f2f2":"#8e8e8e", fontSize:14, cursor:"pointer", fontFamily:"inherit", borderBottom:activeTab===t?"2px solid #f2f2f2":"2px solid transparent", fontWeight:activeTab===t?600:400, whiteSpace:"nowrap" }}>{t.charAt(0).toUpperCase() + t.slice(1)}</button>
            ))}
          </div>

          <div style={{ flex:1, overflowY:"auto", padding:isPhone ? "20px 16px" : "26px 28px", scrollbarWidth:"thin", scrollbarColor:"#333 #131313" }}>
            {activeTab === "description" && (() => {
              // MCQ titles are usually a cut-off copy of the question. When the description just
              // repeats the title, show the full question once as the heading instead of twice.
              const plainText = (html) => String(html || "").replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
              const isTheoryQuestion = p.type === "theory" || (Array.isArray(p.options) && p.options.length > 0);
              const questionText = plainText(p.description);
              const titleText = plainText(p.title).replace(/(\.\.\.|…)$/, "").trim();
              const questionRepeatsTitle = isTheoryQuestion && Boolean(questionText) && Boolean(titleText)
                && questionText.toLowerCase().startsWith(titleText.toLowerCase());
              return (
              <>
                <h1 style={{ margin:"0 0 12px", color:"#f2f2f2", fontSize:questionRepeatsTitle ? (isPhone ? 19 : 22) : (isPhone ? 22 : 26), lineHeight:1.3, fontWeight:600, letterSpacing:"-0.01em" }}>
                  {p.id}. {questionRepeatsTitle ? questionText : p.title}
                </h1>
                <div style={{ display:"flex", gap:6, marginBottom:22, flexWrap:"wrap", alignItems:"center" }}>
                  {p.difficulty && (
                    <span style={{ fontSize:12.5, fontWeight:600, padding:"3px 9px", borderRadius:4,
                      color:p.difficulty === "Easy" ? "#4cb782" : p.difficulty === "Hard" ? "#e5575f" : "#e9b84a",
                      background:p.difficulty === "Easy" ? "rgba(76,183,130,0.14)" : p.difficulty === "Hard" ? "rgba(229,87,95,0.14)" : "rgba(233,184,74,0.14)" }}>
                      {p.difficulty}
                    </span>
                  )}
                  {(p.tags || []).map(t=>(
                    <span key={t} style={{ fontSize:12.5, padding:"3px 9px", borderRadius:4, background:"#232323", color:"#c9c9c9" }}>{t}</span>
                  ))}
                </div>
                {candidateCodingAnswers[p.dbId || p.id]?.submitted && (
                  <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap", padding:"10px 12px", borderRadius:6, background:"rgba(76,183,130,0.1)", border:"1px solid rgba(76,183,130,0.3)", color:"#4cb782", fontSize:13, fontWeight:500, marginBottom:20 }}>
                    <span>✓ Submitted</span>
                    <span style={{ color:"#c9c9c9" }}>{candidateCodingAnswers[p.dbId || p.id].marks ?? 0} / {p.marks || 10} points</span>
                    <span style={{ color:"#8e8e8e" }}>· test cases passed {candidateCodingAnswers[p.dbId || p.id].testCasesPassed || 0} / {candidateCodingAnswers[p.dbId || p.id].totalTestCases || 3}</span>
                  </div>
                )}
                {!questionRepeatsTitle && (
                  <div className="dv-ws-body" style={{ marginBottom:26 }} dangerouslySetInnerHTML={{ __html:p.description }} />
                )}
                {parseExamplesList(p.examples).map((ex, i) => (
                  <div key={`ex-${p.id || p.number}-${i}`} style={{ marginBottom: 22 }}>
                    <div style={{ color:"#f2f2f2", fontSize:15, fontWeight:600, marginBottom:10 }}>Example {i + 1}</div>
                    <div style={{ background:"#181818", border:"1px solid #262626", borderRadius:6, padding:"14px 16px", fontFamily:"'IBM Plex Mono','JetBrains Mono',monospace", fontSize:13.5, lineHeight:1.8 }}>
                      {(ex.input !== "" || ex.output === "") && (
                        <div style={{ display:"flex", gap:10, alignItems:"baseline" }}>
                          <span style={{ color:"#8e8e8e", flexShrink:0 }}>Input</span>
                          <span style={{ color:"#ececec", whiteSpace:"pre-wrap", overflowWrap:"anywhere" }}>{cleanExampleField(ex.input)}</span>
                        </div>
                      )}
                      {ex.output !== "" && (
                        <div style={{ display:"flex", gap:10, alignItems:"baseline" }}>
                          <span style={{ color:"#8e8e8e", flexShrink:0 }}>Output</span>
                          <span style={{ color:"#ececec", whiteSpace:"pre-wrap", overflowWrap:"anywhere" }}>{cleanExampleField(ex.output)}</span>
                        </div>
                      )}
                      {Boolean(ex.explanation) && (
                        <div style={{ fontFamily:"'IBM Plex Sans','Outfit',sans-serif", color:"#a3a3a3", fontSize:13.5, lineHeight:1.6, marginTop:10 }}>{ex.explanation}</div>
                      )}
                    </div>
                  </div>
                ))}
                {Array.isArray(p.constraints) && p.constraints.length > 0 && (
                  <div style={{ marginTop:8 }}>
                    <div style={{ color:"#f2f2f2", fontSize:15, fontWeight:600, marginBottom:10 }}>Constraints</div>
                    <ul className="dv-ws-body" style={{ margin:0, paddingLeft:20, fontSize:14 }}>
                      {p.constraints.map((c,i)=><li key={i} style={{ marginBottom:4 }} dangerouslySetInnerHTML={{ __html:c }} />)}
                    </ul>
                  </div>
                )}
              </>
              );
            })()}

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
          <div style={{ ...editorPanelStyle, background: "#131313", padding: isPhone ? "20px 16px" : "26px 28px", overflowY: "auto" }}>
            <div style={{ color: "#a3a3a3", fontSize: 14, marginBottom: 16 }}>
              Choose one answer <span style={{ color:"#6b6b6b" }}>· {p.marks || 2} marks</span>
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
                      padding: "14px 16px",
                      borderRadius: 6,
                      background: isSelected ? "rgba(232,135,58,0.08)" : "#181818",
                      border: isSelected ? "1px solid #e8873a" : "1px solid #2a2a2a",
                      color: "#ececec",
                      cursor: "pointer",
                      transition: "border-color 0.15s ease, background 0.15s ease",
                    }}
                  >
                    <input
                      type="radio"
                      checked={isSelected}
                      onChange={() => {}}
                      style={{ width: 18, height: 18, accentColor: "#e8873a", cursor: "pointer" }}
                    />
                    <span style={{ fontWeight: 600, color: isSelected ? "#e8873a" : "#6b6b6b", fontSize: 15, width: 22, fontFamily:"'IBM Plex Mono','JetBrains Mono',monospace" }}>
                      {String.fromCharCode(65 + oIdx)}.
                    </span>
                    <span style={{ fontSize: 15, fontWeight: isSelected ? 500 : 400, lineHeight: 1.55 }}>
                      {opt}
                    </span>
                  </div>
                );
              })}
            </div>

            {(candidateTheoryAnswers[p.dbId] || candidateTheoryAnswers[p.id]) ? (
              <div style={{ marginTop: 18, padding: "10px 14px", borderRadius: 6, background: "rgba(76,183,130,0.1)", border: "1px solid rgba(76,183,130,0.3)", color: "#4cb782", fontSize: 13, fontWeight: 500 }}>
                ✓ Option selected and saved: "{candidateTheoryAnswers[p.dbId || p.id]}"
              </div>
            ) : (
              <div style={{ marginTop: 18, padding: "10px 14px", borderRadius: 6, background: "#1a1a1a", border: "1px solid #262626", color: "#8e8e8e", fontSize: 13 }}>
                Select one option above. Your choice will be saved automatically.
              </div>
            )}
          </div>
        ) : (
          <div style={editorPanelStyle}>
            {/* Toolbar */}
            <div style={{ background:"#131313", borderBottom:"1px solid #262626", padding:`8px ${isPhone ? 12 : 16}px`, display:"flex", alignItems:"center", gap:12, flexWrap:"wrap", flexShrink:0 }}>
              <select value={lang} onChange={e=>handleLangChange(e.target.value)} aria-label="Language"
                style={{ background:"#181818", border:"1px solid #333", color:"#ececec", padding:"6px 10px", borderRadius:6, fontSize:13.5, fontFamily:"inherit", cursor:"pointer", outline:"none" }}>
                {SUPPORTED_LANGUAGES.map((l) => (
                  <option key={l.id} value={l.id} style={{ background:"#1c1c1c" }}>{l.label}</option>
                ))}
              </select>

              {(() => {
                const diag = validateCodeSyntax(code, lang);
                return diag.isValid ? (
                  <span style={{ fontSize:12.5, color:"#4cb782", display:"inline-flex", alignItems:"center", gap:5 }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
                    Syntax valid
                  </span>
                ) : (
                  <span style={{ fontSize:12.5, color:"#ff8a8a", display:"inline-flex", alignItems:"center", gap:5, minWidth:0 }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><path d="M12 7v6M12 17h.01" /></svg>
                    {diag.errors[0]?.message || "Syntax warning"}
                  </span>
                );
              })()}

              <div style={{ marginLeft:"auto", display:"flex", gap:8, alignItems:"center" }}>
                <button onClick={() => setCode(formatCode(code, lang))} title="Format code (Ctrl+Shift+F)" className="dv-ws-btn"
                  style={{ background:"transparent", border:"1px solid #333", color:"#d4d4d4", padding:"5px 11px", borderRadius:6, fontSize:13, cursor:"pointer", fontFamily:"inherit" }}>
                  Format
                </button>
                <button onClick={() => setCode(p.starterCode?.[lang] || DEFAULT_STARTER_CODE[lang] || "")} title="Reset to the starter code" className="dv-ws-btn"
                  style={{ background:"transparent", border:"1px solid #333", color:"#d4d4d4", padding:"5px 11px", borderRadius:6, fontSize:13, cursor:"pointer", fontFamily:"inherit" }}>
                  Reset
                </button>
              </div>
            </div>

            {/* Editor */}
            {(() => {
              const syntaxDiag = validateCodeSyntax(code, lang);
              const errorLines = new Set(syntaxDiag.errors.map((e) => e.line));

              return (
                <div style={{ flex: 1, minHeight: isCompact ? (isPhone ? 360 : 420) : 0, position: "relative", overflow: "hidden", background: "#141414", display: "flex", flexDirection: "column" }}>
                  <CodeEditor
                    key={p.dbId || p.id}
                    value={code}
                    onChange={setCode}
                    language={lang}
                    textareaRef={textareaRef}
                    errorLines={errorLines}
                    onKeyDown={(e) => handleEditorIndentation(e, code, setCode, textareaRef, lang)}
                  />

                  {/* Inline Syntax Diagnostic Warning Bar */}
                  {!syntaxDiag.isValid && (
                    <div style={{ background: "rgba(229,87,95,0.1)", borderTop: "1px solid rgba(229,87,95,0.3)", color: "#ff8a8a", padding: "6px 16px", fontSize: 12.5, display: "flex", alignItems: "center", gap: 8, zIndex: 5 }}>
                      <span aria-hidden="true">●</span>
                      <span>Line {syntaxDiag.errors[0]?.line}: {syntaxDiag.errors[0]?.message}</span>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Console */}
            <div style={{ height:consoleHeight, borderTop:consoleOpen ? "1px solid #262626" : "none", background:"#131313", transition:"height 0.2s", overflow:"hidden", display:"flex", flexDirection:"column", flexShrink:0 }}>
              <div style={{ display:"flex", alignItems:"center", gap:22, padding:"0 16px", height:40, borderBottom:"1px solid #262626", flexShrink:0 }}>
                {["testcase","result"].map(t=>(
                  <button key={t} onClick={()=>setConsoleTab(t)} style={{ background:"none", border:"none", padding:"10px 0 8px", color:consoleTab===t?"#f2f2f2":"#8e8e8e", fontSize:13, cursor:"pointer", fontFamily:"inherit", borderBottom:consoleTab===t?"2px solid #f2f2f2":"2px solid transparent", fontWeight:consoleTab===t ? 500 : 400 }}>
                    {t==="testcase"?"Test cases":"Result"}
                  </button>
                ))}
              </div>

              {consoleOpen && (
                <div style={{ flex:1, overflowY:"auto", padding:16, scrollbarWidth:"thin", scrollbarColor:"#333 #131313" }}>
                  {consoleTab === "testcase" && (
                    <div>
                      {p.testCases.map((tc,i)=>(
                        <div key={i} style={{ marginBottom:12 }}>
                          <div style={{ fontSize:12.5, color:"#8e8e8e", marginBottom:6 }}>Case {i+1}</div>
                          <div style={{ background:"#181818", border:"1px solid #262626", borderRadius:6, padding:"10px 12px", fontSize:13, fontFamily:"'IBM Plex Mono','JetBrains Mono',monospace" }}>
                            <div style={{ color:"#8e8e8e", marginBottom:4, fontFamily:"'IBM Plex Sans',sans-serif", fontSize:12 }}>Input</div>
                            <div style={{ color:"#ececec", marginBottom:10, whiteSpace:"pre-wrap", overflowWrap:"anywhere" }}>{tc.input}</div>
                            <div style={{ color:"#8e8e8e", marginBottom:4, fontFamily:"'IBM Plex Sans',sans-serif", fontSize:12 }}>Expected output</div>
                            <div style={{ color:"#4cb782", whiteSpace:"pre-wrap", overflowWrap:"anywhere" }}>{tc.expected}</div>
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
                    <div style={{ color:"#8e8e8e", fontSize:13 }}>Run your code to see the results here.</div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Action Bar: fixed so Run/Submit always stay visible (sticky breaks inside the overflow-hidden app). */}
      <div aria-hidden="true" style={{ height: PROBLEM_ACTION_BAR_HEIGHT, flexShrink: 0 }} />
      <div style={{ background: "#131313", borderTop: "1px solid #262626", display: "flex", alignItems: "stretch", position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 80, height: PROBLEM_ACTION_BAR_HEIGHT, boxSizing: "border-box" }}>
        {!isCompact && <div style={{ width:"42%", borderRight:"1px solid #262626", flexShrink:0 }} />}
        <div style={{ flex:1, minWidth:0, display:"flex", alignItems:"center", gap:10, padding:`0 ${isPhone ? 12 : 16}px` }}>
          {!isTheoryProblem && (
            <button onClick={() => setConsoleOpen(!consoleOpen)} aria-expanded={consoleOpen} className="dv-ws-btn"
              style={{ background:"none", border:"1px solid transparent", borderRadius:6, color:"#c9c9c9", fontFamily:"inherit", fontSize:13.5, cursor:"pointer", display:"inline-flex", alignItems:"center", gap:7, padding:"7px 10px" }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ transform:consoleOpen ? "rotate(180deg)" : "none", transition:"transform 0.2s" }}><path d="M6 15l6-6 6 6" /></svg>
              Console
            </button>
          )}
          <div style={{ marginLeft:"auto", display:"flex", gap:10, alignItems:"center" }}>
            {!isTheoryProblem && (
              <>
                <button onClick={() => simulateRun(false)} disabled={running || submitting} className="dv-ws-btn"
                  style={{ background:"#1a1a1a", border:"1px solid #333", color:"#ececec", borderRadius:6, padding:isPhone ? "9px 12px" : "10px 18px", fontFamily:"inherit", fontSize:14, fontWeight:600, display:"inline-flex", alignItems:"center", gap:8, cursor:running || submitting ? "not-allowed" : "pointer", opacity:running || submitting ? 0.6 : 1 }}>
                  {running
                    ? <span style={{ width:12, height:12, border:"2px solid #555", borderTopColor:"#ececec", borderRadius:"50%", display:"inline-block", animation:"dvSpin 0.8s linear infinite" }} />
                    : <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4.5v15l13-7.5z" /></svg>}
                  {running ? "Running..." : "Run code"}
                </button>
                <button onClick={handleSubmitClick} disabled={running || submitting}
                  style={{ background:"#e8873a", border:"1px solid #e8873a", color:"#1a1009", borderRadius:6, padding:isPhone ? "9px 14px" : "10px 22px", fontFamily:"inherit", fontSize:14, fontWeight:600, display:"inline-flex", alignItems:"center", gap:8, cursor:running || submitting ? "not-allowed" : "pointer", opacity:running || submitting ? 0.7 : 1 }}
                  onMouseEnter={(e) => { if (!e.currentTarget.disabled) e.currentTarget.style.background = "#f0964d"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "#e8873a"; }}>
                  {submitting && <span style={{ width:12, height:12, border:"2px solid rgba(26,16,9,0.35)", borderTopColor:"#1a1009", borderRadius:"50%", display:"inline-block", animation:"dvSpin 0.8s linear infinite" }} />}
                  {submitting ? "Evaluating..." : "Submit code"}
                </button>
              </>
            )}
            {(problemNavigationSource === "contest" || contestEntered) && (
              <button onClick={() => setFinalSubmitConfirmOpen(true)}
                style={{ background:"#b42318", border:"1px solid #b42318", color:"#ffffff", borderRadius:6, padding:isPhone ? "9px 12px" : "10px 18px", fontFamily:"inherit", fontSize:14, fontWeight:600, cursor:"pointer" }}>
                Finish exam
              </button>
            )}
          </div>
        </div>
        <style>{"@keyframes dvSpin { to { transform: rotate(360deg); } }"}</style>
      </div>

      {problemNavigationSource === "contest" && contestEntered && (
        <div
          style={{
            position: "fixed",
            right: isPhone ? 12 : 20,
            bottom: 80,
            width: isPhone ? 150 : 200,
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
              {contestCameraStream && (
                <span style={{ color: aiCheckStatus === "on" ? "#86efac" : aiCheckStatus === "off" ? "#fca5a5" : "#fcd34d", fontSize: 9, letterSpacing: "0.04em" }}>
                  · {aiCheckStatus === "on" ? "AI check on" : aiCheckStatus === "off" ? "AI check unavailable" : "AI check loading"}
                </span>
              )}
            </div>
          </div>
          {contestCameraStream ? (
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
