#!/usr/bin/env node

const path = require("node:path");
const { spawnSync } = require("node:child_process");

const target = process.argv[2];
if (!target) {
  throw new Error("Usage: node scripts/build-source.js <plugin-id|all>");
}

const repoRoot = path.resolve(__dirname, "..");
const generateArgs = [path.join("scripts", "build", "generate.js")];
if (target !== "all") {
  generateArgs.push("--plugin", target);
}

const result = spawnSync(
  process.execPath,
  generateArgs,
  {
    cwd: repoRoot,
    stdio: "inherit",
  },
);

process.exit(result.status === 0 ? 0 : result.status || 1);
