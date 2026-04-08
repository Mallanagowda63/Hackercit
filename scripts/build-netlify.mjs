import { mkdir, rm, copyFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");
const distDir = resolve(rootDir, "dist");

const filesToCopy = [
  "index.html",
  "hacker.jsx",
  "admin.jsx",
];

await rm(distDir, { recursive: true, force: true });
await mkdir(distDir, { recursive: true });

await Promise.all(
  filesToCopy.map((file) => copyFile(resolve(rootDir, file), resolve(distDir, file))),
);

console.log(`Netlify static bundle ready in ${distDir}`);
