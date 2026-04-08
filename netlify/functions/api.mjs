import serverless from "serverless-http";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { app } = require("../../backend/src/app.js");

const FUNCTION_PREFIX = "/.netlify/functions/api";

const wrappedApp = (req, res) => {
  if (typeof req.url === "string" && req.url.startsWith(FUNCTION_PREFIX)) {
    req.url = req.url.slice(FUNCTION_PREFIX.length) || "/";
  }

  return app(req, res);
};

export const handler = serverless(wrappedApp);
