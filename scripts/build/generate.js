#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const {
  REPO_ROOT,
  BUILD_MANIFEST_PATH,
  PUBLIC_INDEX_PATH,
  writeJson,
  ensureDir,
  sha256Hex,
} = require("./lib");
const { bundlePlugin } = require("./bundle-plugin");
const { compatTransform } = require("./compat-transform");
const { finalMinify } = require("./final-minify");
const { buildManifest } = require("./write-build-manifest");
const { indexFromManifest } = require("./write-public-index");

const { spawnSync } = require("node:child_process");

function runScript(scriptPath, args = []) {
  const result = spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: REPO_ROOT,
    stdio: "inherit",
  });
  if (result.status !== 0) {
    throw new Error(`Script failed: ${scriptPath}`);
  }
}

function parseArgs(argv) {
  const args = {
    pluginId: null,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--plugin") {
      args.pluginId = argv[i + 1];
      i += 1;
    }
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  runScript(path.join("scripts", "build", "validate-plugin-config.js"));

  const manifest = buildManifest();
  const plugins = manifest.plugins.filter((plugin) => {
    if (!args.pluginId) return true;
    return plugin.id === args.pluginId;
  });

  if (plugins.length === 0) {
    throw new Error(args.pluginId ? `Unknown plugin id: ${args.pluginId}` : "No plugins to generate");
  }

  for (const plugin of plugins) {
    const bundled = await bundlePlugin(plugin);
    const compat = compatTransform(bundled.code, plugin);
    const finalCode = await finalMinify(compat, plugin);

    const outputPath = path.join(REPO_ROOT, plugin.outputPath);
    ensureDir(path.dirname(outputPath));
    fs.writeFileSync(outputPath, finalCode, "utf8");

    plugin.checksums = {
      sha256: sha256Hex(finalCode),
      bytes: Buffer.byteLength(finalCode, "utf8"),
    };
  }

  manifest.generatedAt = new Date().toISOString();
  manifest.publicIndex = indexFromManifest(manifest);
  writeJson(BUILD_MANIFEST_PATH, manifest);
  writeJson(PUBLIC_INDEX_PATH, manifest.publicIndex);
  console.log("Updated index.json");

  console.log(
    args.pluginId
      ? `Generated plugin: ${args.pluginId}`
      : `Generated ${plugins.length} plugin artifact(s)`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
