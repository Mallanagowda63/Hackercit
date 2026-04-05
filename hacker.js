import { createServer } from "node:http";
import { createReadStream, existsSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { runSubmission } from "./runner/index.js";

const host = process.env.HOST || "0.0.0.0";
const port = Number(process.env.PORT || 3000);
const rootDir = process.cwd();

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

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";

    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1024 * 1024) {
        reject(new Error("Request body is too large."));
        req.destroy();
      }
    });

    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error("Invalid JSON body."));
      }
    });

    req.on("error", reject);
  });
}

createServer(async (req, res) => {
  const requestUrl = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  const pathname = requestUrl.pathname;

  if (req.method === "GET" && pathname === "/api/health") {
    sendJson(res, 200, {
      ok: true,
      service: "codearena",
      dockerRequired: true,
      host,
      port,
    });
    return;
  }

  if (req.method === "POST" && pathname === "/api/run") {
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

  const reqPath = pathname === "/" ? "/index.html" : pathname || "/index.html";
  const safePath = normalize(reqPath).replace(/^(\.\.[/\\])+/, "");
  const filePath = join(rootDir, safePath);

  if (!existsSync(filePath)) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
    return;
  }

  const contentType = contentTypes[extname(filePath)] || "application/octet-stream";
  res.writeHead(200, { "Content-Type": contentType });
  createReadStream(filePath).pipe(res);
}).listen(port, host, () => {
  const displayHost = host === "0.0.0.0" ? "127.0.0.1" : host;
  console.log(`CodeArena is running at http://${displayHost}:${port}`);
});
