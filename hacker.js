import { createServer } from "node:http";
import { createReadStream, existsSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { runSubmission } from "./runner/index.js";

const host = process.env.HOST || "0.0.0.0";
const port = Number(process.env.PORT || 3000);
const rootDir = process.cwd();
const localStore = {
  users: [],
  problems: [],
  assignments: [],
  submissions: [],
  notifications: [],
  loginEvents: [],
};

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".jsx": "text/babel; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function readRequestBody(req, limit = 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let body = "";

    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > limit) {
        reject(new Error("Request body is too large."));
        req.destroy();
      }
    });

    req.on("end", () => {
      resolve(body);
    });

    req.on("error", reject);
  });
}

function readJsonBody(req) {
  return readRequestBody(req).then((body) => {
    try {
      return body ? JSON.parse(body) : {};
    } catch {
      throw new Error("Invalid JSON body.");
    }
  });
}

function publicUser(user) {
  if (!user) return null;
  const { password, ...safeUser } = user;
  return safeUser;
}

function makeLeaderboard() {
  const rowsByUser = new Map();

  localStore.submissions.forEach((submission) => {
    const key = submission.userId || "guest";
    const user = localStore.users.find((candidate) => candidate.id === key) || submission.user || {};
    const row = rowsByUser.get(key) || {
      userId: key,
      username: user.name || user.email || "Student",
      rating: 1400,
      solved: new Set(),
      attempts: 0,
    };

    row.attempts += 1;
    if (submission.status === "ACCEPTED") {
      row.solved.add(String(submission.problemId));
    }
    rowsByUser.set(key, row);
  });

  return [...rowsByUser.values()]
    .map((row) => {
      const solvedCount = row.solved.size;
      const score = solvedCount * 100 - Math.max(0, row.attempts - solvedCount) * 10;
      return {
        userId: row.userId,
        username: row.username,
        rating: row.rating + solvedCount * 35,
        avatarGradient: ["#7c6af7", "#4fd1c5"],
        overall: { rank: 0, score, problemsSolved: solvedCount, timePenalty: `${row.attempts * 3}m`, trend: 1 },
        contest: { rank: 0, score, problemsSolved: solvedCount, timePenalty: `${row.attempts * 3}m`, trend: 1, timeTaken: `${Math.max(1, row.attempts * 7)}m` },
        global: { rank: 0, score, problemsSolved: solvedCount, timePenalty: `${row.attempts * 3}m`, trend: 1 },
      };
    })
    .sort((left, right) => right.overall.score - left.overall.score)
    .map((row, index) => ({
      ...row,
      overall: { ...row.overall, rank: index + 1 },
      contest: { ...row.contest, rank: index + 1 },
      global: { ...row.global, rank: index + 1 },
    }));
}

async function handleLocalApi(req, res, pathname) {
  const method = req.method || "GET";
  const now = new Date().toISOString();

  if (pathname === "/api/auth/register" && method === "POST") {
    const body = await readJsonBody(req);
    const email = String(body.email || "").trim().toLowerCase();
    const role = String(body.role || "student").trim() || "student";

    if (!email || !body.password) {
      sendJson(res, 400, { error: "Email and password are required." });
      return true;
    }

    if (localStore.users.some((user) => user.email === email && user.role === role)) {
      sendJson(res, 409, { error: "An account already exists for this email and role. Log in instead." });
      return true;
    }

    const user = {
      id: `local-user-${Date.now()}`,
      role,
      email,
      password: String(body.password),
      name: String(body.name || email.split("@")[0]),
      usn: String(body.usn || ""),
      department: String(body.department || (role === "admin" ? "Administration" : "")),
      verified: true,
      createdAt: now,
      lastLoginAt: now,
      loginCount: 1,
    };

    localStore.users.push(user);
    localStore.loginEvents.unshift({ id: `login-${Date.now()}`, userId: user.id, email, role, createdAt: now });
    sendJson(res, 201, { token: `local-token-${user.id}`, user: publicUser(user) });
    return true;
  }

  if (pathname === "/api/auth/login" && method === "POST") {
    const body = await readJsonBody(req);
    const email = String(body.email || "").trim().toLowerCase();
    const role = String(body.role || "student").trim() || "student";
    let user = localStore.users.find((candidate) => candidate.email === email && candidate.role === role);

    if (!user) {
      user = {
        id: `local-user-${Date.now()}`,
        role,
        email,
        password: String(body.password || ""),
        name: email.split("@")[0] || "Local User",
        usn: "",
        department: role === "admin" ? "Administration" : "Department pending",
        verified: true,
        createdAt: now,
        lastLoginAt: now,
        loginCount: 1,
      };
      localStore.users.push(user);
    } else if (user.password && body.password && user.password !== String(body.password)) {
      sendJson(res, 401, { error: "Incorrect password for this local account." });
      return true;
    } else {
      user.lastLoginAt = now;
      user.loginCount = Number(user.loginCount || 0) + 1;
    }

    localStore.loginEvents.unshift({ id: `login-${Date.now()}`, userId: user.id, email, role, createdAt: now });
    sendJson(res, 200, { token: `local-token-${user.id}`, user: publicUser(user) });
    return true;
  }

  if (pathname === "/api/auth/students" && method === "GET") {
    sendJson(res, 200, { students: localStore.users.filter((user) => user.role === "student").map(publicUser) });
    return true;
  }

  if (pathname === "/api/auth/login-events" && method === "GET") {
    sendJson(res, 200, { events: localStore.loginEvents });
    return true;
  }

  if (pathname === "/api/problems/import" && method === "POST") {
    const body = await readJsonBody(req);
    if (Array.isArray(body.problems)) {
      localStore.problems = body.problems.map((problem, index) => ({
        ...problem,
        id: problem.id || `local-problem-${Date.now()}-${index}`,
        number: problem.number ?? problem.legacyId ?? problem.id ?? index + 1,
        legacyId: problem.legacyId ?? problem.number ?? problem.id ?? index + 1,
        createdAt: problem.createdAt || now,
        updatedAt: now,
      }));
    }
    sendJson(res, 200, { imported: localStore.problems.length });
    return true;
  }

  if (pathname === "/api/problems" && method === "POST") {
    const body = await readJsonBody(req);
    const nextNumber = Math.max(0, ...localStore.problems.map((problem) => Number(problem.number ?? problem.id) || 0)) + 1;
    const problem = {
      id: `local-problem-${Date.now()}`,
      legacyId: nextNumber,
      number: nextNumber,
      slug: String(body.title || "local-problem").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
      title: body.title || "Local Problem",
      fnName: body.fnName || "solve",
      difficulty: body.difficulty || "Medium",
      tags: body.tags || [],
      acceptance: body.acceptance || "Local",
      description: body.statement || body.description || "",
      examples: body.examples || [],
      testCases: body.testCases || [],
      constraints: body.constraints || [],
      samples: body.samples || body.examples || [],
      starterCode: body.starterCode || {},
      createdAt: now,
      updatedAt: now,
    };
    localStore.problems.push(problem);
    sendJson(res, 201, { problem });
    return true;
  }

  if (pathname.startsWith("/api/problems") && method === "GET") {
    sendJson(res, 200, { problems: localStore.problems });
    return true;
  }

  if (pathname === "/api/tests" && method === "GET") {
    sendJson(res, 200, { assignments: localStore.assignments });
    return true;
  }

  if (pathname === "/api/tests" && method === "POST") {
    const body = await readJsonBody(req);
    const selectedProblems = localStore.problems.filter((problem) =>
      (body.problemIds || []).some((id) => String(id) === String(problem.id) || String(id) === String(problem.number))
    );
    const assignment = {
      id: `local-test-${Date.now()}`,
      title: body.title || "Fresh Challenge",
      difficulty: body.difficulty || "Mixed",
      durationMinutes: Number(body.durationMinutes || 60),
      status: "DRAFT",
      startsAt: null,
      endsAt: null,
      createdAt: now,
      updatedAt: now,
      problems: selectedProblems,
    };
    localStore.assignments.unshift(assignment);
    sendJson(res, 201, { assignment });
    return true;
  }

  if (pathname === "/api/tests/active" && method === "GET") {
    const assignments = localStore.assignments.filter((assignment) => assignment.status === "LIVE");
    sendJson(res, 200, { assignments, assignment: assignments[0] || null });
    return true;
  }

  const testActionMatch = pathname.match(/^\/api\/tests\/([^/]+)\/(start|stop)$/);
  if (testActionMatch && method === "POST") {
    const [, assignmentId, action] = testActionMatch;
    const assignment = localStore.assignments.find((item) => String(item.id) === String(assignmentId));
    if (!assignment) {
      sendJson(res, 404, { error: "Test not found." });
      return true;
    }
    assignment.status = action === "start" ? "LIVE" : "ENDED";
    assignment.startsAt = action === "start" ? now : assignment.startsAt;
    assignment.endsAt = action === "stop" ? now : assignment.endsAt;
    assignment.updatedAt = now;
    sendJson(res, 200, { assignment, notifiedStudents: localStore.users.filter((user) => user.role === "student").length });
    return true;
  }

  if (pathname === "/api/notifications" && method === "GET") {
    sendJson(res, 200, { notifications: localStore.notifications, unreadCount: localStore.notifications.length });
    return true;
  }

  if (pathname === "/api/submissions/leaderboard" && method === "GET") {
    sendJson(res, 200, { leaderboard: makeLeaderboard() });
    return true;
  }

  const userSubmissionsMatch = pathname.match(/^\/api\/submissions\/user\/([^/]+)$/);
  if (userSubmissionsMatch && method === "GET") {
    sendJson(res, 200, { submissions: localStore.submissions.filter((submission) => submission.userId === userSubmissionsMatch[1]) });
    return true;
  }

  if (pathname === "/api/submissions/submit" && method === "POST") {
    const body = await readJsonBody(req);
    const problem = localStore.problems.find((candidate) =>
      String(candidate.id) === String(body.problemId)
      || String(candidate.number) === String(body.problemId)
      || String(candidate.legacyId) === String(body.problemId)
    );

    if (!problem) {
      sendJson(res, 404, { error: "Problem not found for Judge0 submission." });
      return true;
    }

    const execution = await runSubmission({
      language: body.language || "javascript",
      sourceCode: body.code || "",
      fnName: problem.fnName,
      testCases: problem.testCases || [],
    });
    const accepted = Array.isArray(execution.tests) && execution.tests.every((test) => test.status === "pass");
    const submission = {
      id: `local-submission-${Date.now()}`,
      userId: "",
      problemId: String(body.problemId || ""),
      language: body.language || "javascript",
      code: body.code || "",
      status: accepted ? "ACCEPTED" : "FAILED",
      tests: execution.tests || [],
      runtime: execution.runtime || "N/A",
      memory: execution.memory || "N/A",
      beats: execution.beats || "N/A",
      createdAt: now,
    };
    localStore.submissions.unshift(submission);
    sendJson(res, 200, { ...execution, submission });
    return true;
  }

  return false;
}

createServer(async (req, res) => {
  const requestUrl = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  const pathname = requestUrl.pathname;

  if (req.method === "GET" && pathname === "/api/health") {
    sendJson(res, 200, {
      ok: true,
      service: "codearena",
      executionProvider: "Judge0",
      judge0Url: (process.env.JUDGE0_URL || "https://ce.judge0.com").replace(/\/+$/, ""),
      host,
      port,
    });
    return;
  }

  if (req.method === "POST" && (pathname === "/api/run" || pathname === "/run")) {
    try {
      const payload = await readJsonBody(req);
      const result = await runSubmission(payload);
      sendJson(res, 200, result);
    } catch (error) {
      const statusCode = error.statusCode || 500;
      sendJson(res, statusCode, { error: error.message || "Execution failed." });
    }
    return;
  }

  if (pathname.startsWith("/api/") && pathname !== "/api/health") {
    try {
      const handled = await handleLocalApi(req, res, pathname);
      if (!handled) {
        sendJson(res, 404, { error: "Local API route not found.", path: pathname });
      }
    } catch (error) {
      sendJson(res, 500, { error: error.message || "Local API request failed." });
    }
    return;
  }

  const reqPath = pathname === "/" ? "/index.html" : pathname || "/index.html";
  const safePath = normalize(reqPath).replace(/^(\.\.[/\\])+/, "");
  let filePath = join(rootDir, safePath);

  if (!existsSync(filePath)) {
    if (!extname(filePath)) {
      filePath = join(rootDir, "index.html");
    } else {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }
  }

  const contentType = contentTypes[extname(filePath)] || "application/octet-stream";
  res.writeHead(200, { "Content-Type": contentType });
  createReadStream(filePath).pipe(res);
}).listen(port, host, () => {
  const displayHost = host === "0.0.0.0" ? "127.0.0.1" : host;
  console.log(`CodeArena is running at http://${displayHost}:${port}`);
});
