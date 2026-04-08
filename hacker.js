import { createServer } from "node:http";
import { createReadStream, existsSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { runSubmission } from "./runner/index.js";

const host = process.env.HOST || "0.0.0.0";
const port = Number(process.env.PORT || 3000);
const rootDir = process.cwd();
const backendProxyBase = (process.env.BACKEND_API_PROXY_URL || "http://127.0.0.1:4000").replace(/\/+$/, "");

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

    res.writeHead(upstreamResponse.status, responseHeaders);
    res.end(responseBody);
  } catch (error) {
    sendJson(res, 502, {
      error: "Unable to reach backend API proxy.",
      detail: error.message,
      backendProxyBase,
    });
  }
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
