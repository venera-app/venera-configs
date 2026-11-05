#!/usr/bin/env node

const {
  BUILD_MANIFEST_PATH,
  PUBLIC_INDEX_PATH,
  buildPublicIndexEntries,
  readJson,
  writeJson,
} = require("./lib");

const CHECK_MODE = process.argv.includes("--check");

function indexFromManifest(manifest) {
  if (!manifest || !Array.isArray(manifest.plugins)) {
    throw new Error("build-manifest plugins are missing");
  }
  return buildPublicIndexEntries(manifest.plugins);
}

function main() {
  const next = indexFromManifest(readJson(BUILD_MANIFEST_PATH));

  if (CHECK_MODE) {
    const current = readJson(PUBLIC_INDEX_PATH);
    if (JSON.stringify(current) !== JSON.stringify(next)) {
      throw new Error("index.json is out of date");
    }
    console.log("index.json is up to date");
    return;
  }

  writeJson(PUBLIC_INDEX_PATH, next);
  console.log("Updated index.json");
}

module.exports = { indexFromManifest };

if (require.main === module) {
  main();
}
