import { createServer } from "node:http";
import { createReadStream, existsSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { spawn } from "node:child_process";

const host = process.env.HOST || "0.0.0.0";
const port = Number(process.env.PORT || 3000);
const rootDir = process.cwd();
const backendPort = process.env.BACKEND_PORT || "4000";
const defaultBackendProxyBase = `http://127.0.0.1:${backendPort}`;
const backendProxyBase = (process.env.BACKEND_API_PROXY_URL || defaultBackendProxyBase).replace(/\/+$/, "");
const shouldStartBackend = process.env.START_BACKEND !== "false" && backendProxyBase === defaultBackendProxyBase;
let backendProcess = null;

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".jsx": "text/babel; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".pdf": "application/pdf",
};

function sendJson(res, statusCode, payload) {
  if (res.headersSent) return;
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function startBackendServer() {
  if (!shouldStartBackend) return;

  backendProcess = spawn(process.execPath, ["src/index.js"], {
    cwd: join(rootDir, "backend"),
    env: {
      ...process.env,
      PORT: backendPort,
    },
    stdio: ["ignore", "inherit", "inherit"],
    windowsHide: true,
  });

  backendProcess.on("exit", (code, signal) => {
    if (code === 0 || signal) return;
    console.error(`Backend process exited with code ${code}. Database API routes will be unavailable until it is restarted.`);
  });
}

function stopBackendServer() {
  if (backendProcess && !backendProcess.killed) {
    backendProcess.kill();
  }
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

function buildProxyHeaders(req, hasBody) {
  const headers = {};

  Object.entries(req.headers || {}).forEach(([key, value]) => {
    if (!value) return;

    const loweredKey = key.toLowerCase();
    if (loweredKey === "host" || loweredKey === "connection" || loweredKey === "content-length") {
      return;
    }

    headers[key] = Array.isArray(value) ? value.join(", ") : value;
  });

  if (hasBody && !headers["Content-Type"] && !headers["content-type"]) {
    headers["Content-Type"] = "application/json";
  }

  return headers;
}

async function proxyBackendRequest(req, res, requestUrl) {
  const method = req.method || "GET";
  const hasBody = method !== "GET" && method !== "HEAD";
  const targetUrl = new URL(`${requestUrl.pathname}${requestUrl.search}`, `${backendProxyBase}/`).toString();

  try {
    const upstreamResponse = await fetch(targetUrl, {
      method,
      headers: buildProxyHeaders(req, hasBody),
      body: hasBody ? await readRequestBody(req, 5 * 1024 * 1024) : undefined,
      redirect: "manual",
    });

    const responseBody = Buffer.from(await upstreamResponse.arrayBuffer());
    const responseHeaders = {};

    upstreamResponse.headers.forEach((value, key) => {
      const loweredKey = key.toLowerCase();
      if (loweredKey === "connection" || loweredKey === "content-encoding" || loweredKey === "transfer-encoding") {
        return;
      }

      responseHeaders[key] = value;
    });

    if (!res.headersSent) {
      res.writeHead(upstreamResponse.status, responseHeaders);
      res.end(responseBody);
    }
  } catch (error) {
    sendJson(res, 502, {
      error: "Unable to reach backend API. Start the backend with npm start --prefix backend.",
      detail: error.message,
      backendProxyBase,
    });
  }
}

startBackendServer();
process.on("SIGINT", () => {
  stopBackendServer();
  process.exit(0);
});
process.on("SIGTERM", () => {
  stopBackendServer();
  process.exit(0);
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception in server process:", err);
});

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled Rejection in server process:", reason);
});

createServer(async (req, res) => {
  req.on("error", (err) => {
    console.error("Request socket error:", err?.message || err);
  });
  res.on("error", (err) => {
    console.error("Response socket error:", err?.message || err);
  });

  const requestUrl = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  const pathname = requestUrl.pathname;

  if (req.method === "GET" && pathname === "/api/health") {
    sendJson(res, 200, {
      ok: true,
      service: "devorbit",
      executionProvider: "Judge0",
      judge0Url: (process.env.JUDGE0_URL || "https://ce.judge0.com").replace(/\/+$/, ""),
      host,
      port,
    });
    return;
  }

  if (pathname === "/run") {
    const proxyUrl = new URL(requestUrl.toString());
    proxyUrl.pathname = "/api/run";
    await proxyBackendRequest(req, res, proxyUrl);
    return;
  }

  if (pathname.startsWith("/api/")) {
    await proxyBackendRequest(req, res, requestUrl);
    return;
  }

  const reqPath = pathname === "/" ? "/index.html" : pathname || "/index.html";
  const safePath = normalize(reqPath).replace(/^(\.\.[/\\])+/, "");
  let filePath = join(rootDir, safePath);

  if (!existsSync(filePath)) {
    if (!extname(filePath)) {
      filePath = join(rootDir, "index.html");
    } else {
      if (!res.headersSent) {
        res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("Not found");
      }
      return;
    }
  }

  const contentType = contentTypes[extname(filePath)] || "application/octet-stream";
  if (!res.headersSent) {
    res.writeHead(200, { "Content-Type": contentType });
  }
  const fileStream = createReadStream(filePath);
  fileStream.on("error", (err) => {
    console.error("File stream error:", err?.message || err);
    if (!res.headersSent) {
      res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Internal Server Error");
    }
  });
  res.on("error", () => {
    fileStream.destroy();
  });
  fileStream.pipe(res);
}).listen(port, host, () => {
  const displayHost = host === "0.0.0.0" ? "127.0.0.1" : host;
  console.log(`DevOrbit is running at http://${displayHost}:${port}`);
});
