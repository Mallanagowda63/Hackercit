import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { app } = require("../backend/src/app.js");

export default function handler(req, res) {
  return app(req, res);
}
