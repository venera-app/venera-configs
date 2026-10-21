#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const repoRoot = path.resolve(__dirname, "..");
const indexPath = path.join(repoRoot, "index.json");
const baseRef = process.env.GITHUB_BASE_REF
  ? `origin/${process.env.GITHUB_BASE_REF}`
  : process.argv[2];

if (!baseRef) {
  fail("Missing base ref. Set GITHUB_BASE_REF or pass it as the first argument.");
}

const currentIndex = readJson(fs.readFileSync(indexPath, "utf8"), "working tree index.json");
const baseIndex = readBaseIndex(baseRef);

const currentByFile = buildIndexByFile(currentIndex, "working tree");
const baseByFile = buildIndexByFile(baseIndex, baseRef);

const changedFiles = listChangedFiles(baseRef);
const changedConfigFiles = changedFiles.filter(isConfigFile);

const touchedFiles = new Set(changedConfigFiles);
if (changedFiles.includes("index.json")) {
  const changedEntries = diffIndexEntries(baseByFile, currentByFile);
  for (const fileName of changedEntries) {
    touchedFiles.add(fileName);
  }
}

if (touchedFiles.size === 0) {
  console.log("No config version checks needed for this PR.");
  process.exit(0);
}

const errors = [];

for (const fileName of [...touchedFiles].sort()) {
  const filePath = path.join(repoRoot, fileName);
  const currentEntry = currentByFile.get(fileName);
  const baseEntry = baseByFile.get(fileName);

  if (!currentEntry) {
    errors.push(`${fileName}: missing entry in index.json.`);
    continue;
  }

  if (!fs.existsSync(filePath)) {
    errors.push(`${fileName}: file does not exist in working tree.`);
    continue;
  }

  const fileVersion = readConfigVersion(filePath);
  if (!fileVersion) {
    errors.push(`${fileName}: unable to read top-level version from config file.`);
    continue;
  }

  if (fileVersion !== currentEntry.version) {
    errors.push(
      `${fileName}: version mismatch, file has ${fileVersion} but index.json has ${currentEntry.version}.`
    );
  }

  if (!baseEntry) {
    continue;
  }

  if (!isSemverGreater(currentEntry.version, baseEntry.version)) {
    errors.push(
      `${fileName}: version must be increased in PR, base is ${baseEntry.version} and current is ${currentEntry.version}.`
    );
  }
}

if (errors.length > 0) {
  console.error("Version validation failed:");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log(`Version validation passed for ${touchedFiles.size} config file(s).`);

function fail(message) {
  console.error(message);
  process.exit(1);
}

function readJson(content, label) {
  try {
    return JSON.parse(content);
  } catch (error) {
    fail(`Failed to parse ${label}: ${error.message}`);
  }
}

function readBaseIndex(ref) {
  try {
    const content = execGit(["show", `${ref}:index.json`]);
    return readJson(content, `${ref}:index.json`);
  } catch (error) {
    fail(`Failed to read index.json from ${ref}: ${error.message}`);
  }
}

function buildIndexByFile(index, label) {
  if (!Array.isArray(index)) {
    fail(`Invalid ${label} index.json: expected an array.`);
  }

  const byFile = new Map();
  for (const entry of index) {
    if (!entry || typeof entry.fileName !== "string") {
      fail(`Invalid ${label} index.json entry: missing fileName.`);
    }
    byFile.set(entry.fileName, entry);
  }
  return byFile;
}

function listChangedFiles(ref) {
  const output = execGit(["diff", "--name-only", `${ref}...HEAD`]);
  return output
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function diffIndexEntries(baseByFile, currentByFile) {
  const changed = [];
  const allFiles = new Set([...baseByFile.keys(), ...currentByFile.keys()]);
  for (const fileName of allFiles) {
    const baseEntry = baseByFile.get(fileName);
    const currentEntry = currentByFile.get(fileName);
    if (JSON.stringify(baseEntry) !== JSON.stringify(currentEntry)) {
      changed.push(fileName);
    }
  }
  return changed;
}

function isConfigFile(filePath) {
  if (!filePath.endsWith(".js")) {
    return false;
  }
  const baseName = path.basename(filePath);
  return !baseName.startsWith("_");
}

function readConfigVersion(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  const match = content.match(/^\s*version\s*=\s*["']([^"']+)["']/m);
  return match ? match[1] : null;
}

function isSemverGreater(current, base) {
  const currentParts = parseVersion(current);
  const baseParts = parseVersion(base);

  for (let index = 0; index < Math.max(currentParts.length, baseParts.length); index += 1) {
    const currentValue = currentParts[index] ?? 0;
    const baseValue = baseParts[index] ?? 0;
    if (currentValue > baseValue) {
      return true;
    }
    if (currentValue < baseValue) {
      return false;
    }
  }

  return false;
}

function parseVersion(version) {
  if (!/^\d+(\.\d+)*$/.test(version)) {
    fail(`Unsupported version format: ${version}`);
  }
  return version.split(".").map((part) => Number(part));
}

function execGit(args) {
  return execFileSync("git", args, {
    cwd: repoRoot,
    encoding: "utf8",
  }).trim();
}
