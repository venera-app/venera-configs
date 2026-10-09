#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const indexPath = path.resolve(__dirname, "..", "index.json");

try {
  const entries = JSON.parse(fs.readFileSync(indexPath, "utf8"));
  if (!Array.isArray(entries)) {
    throw new Error("index.json must contain an array.");
  }

  const errors = [];
  const keys = new Map();
  const files = new Map();

  for (const [position, entry] of entries.entries()) {
    const label = `index.json entry ${position + 1} (${entry?.fileName ?? "missing fileName"})`;
    for (const [field, seen] of [["key", keys], ["fileName", files]]) {
      const value = entry?.[field];
      if (typeof value !== "string" || value.trim() === "") {
        errors.push(`${label}: ${field} must be a non-empty string.`);
        continue;
      }
      if (seen.has(value)) {
        errors.push(`${label}: duplicate ${field} ${JSON.stringify(value)}; already used by ${seen.get(value)}.`);
      } else {
        seen.set(value, label);
      }
    }
  }

  if (errors.length > 0) {
    throw new Error(errors.join("\n"));
  }
  console.log(`Config ID validation passed for ${entries.length} index entries.`);
} catch (error) {
  console.error(`Config ID validation failed:\n${error.message}`);
  process.exitCode = 1;
}
