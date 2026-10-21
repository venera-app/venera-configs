#!/usr/bin/env node

const { execFileSync } = require("child_process");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const baseRef = process.env.GITHUB_BASE_REF
  ? `origin/${process.env.GITHUB_BASE_REF}`
  : process.argv[2];

if (!baseRef) {
  console.error("Missing base ref. Set GITHUB_BASE_REF or pass it as the first argument.");
  process.exit(1);
}

const output = execGit(["diff", "--name-only", `${baseRef}...HEAD`]);
const files = output
  .split("\n")
  .map((line) => line.trim())
  .filter(Boolean)
  .filter(isConfigFile)
  .sort();

for (const file of files) {
  console.log(file);
}

function isConfigFile(filePath) {
  if (!filePath.endsWith(".js")) {
    return false;
  }
  const baseName = path.basename(filePath);
  return !baseName.startsWith("_");
}

function execGit(args) {
  return execFileSync("git", args, {
    cwd: repoRoot,
    encoding: "utf8",
  }).trim();
}
