#!/usr/bin/env node

const path = require("node:path");
const { spawnSync } = require("node:child_process");

const repoRoot = path.resolve(__dirname, "..");
const checkMode = process.argv.includes("--check");

function run(script, args = []) {
  const result = spawnSync(process.execPath, [path.join("scripts", "build", script), ...args], {
    cwd: repoRoot,
    stdio: "inherit",
  });
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

if (checkMode) {
  run("validate-plugin-config.js");
  run("write-build-manifest.js", ["--check"]);
  run("write-public-index.js", ["--check"]);
  console.log("build-manifest and index.json are up to date");
  process.exit(0);
}

run("validate-plugin-config.js");
run("write-build-manifest.js");
run("write-public-index.js");
console.log("Updated build-manifest and index.json");
