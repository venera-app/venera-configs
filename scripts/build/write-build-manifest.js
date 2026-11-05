#!/usr/bin/env node

const path = require("node:path");
const {
  REPO_ROOT,
  BUILD_MANIFEST_PATH,
  loadPluginConfigs,
  loadReleaseAuthority,
  buildPublicBaseUrl,
  toPluginOutputPath,
  buildPublicIndexEntries,
  writeJson,
  readJson,
  discoverPluginConfigFiles,
} = require("./lib");

const CHECK_MODE = process.argv.includes("--check");

function buildManifest() {
  const authority = loadReleaseAuthority();
  const publicBaseUrl = buildPublicBaseUrl(authority);
  const existingManifest = (() => {
    try {
      return readJson(BUILD_MANIFEST_PATH);
    } catch (_) {
      return null;
    }
  })();
  const checksumById = new Map(
    (existingManifest && Array.isArray(existingManifest.plugins)
      ? existingManifest.plugins
      : []
    ).map((plugin) => [plugin.id, plugin.checksums || { sha256: null, bytes: null }]),
  );

  const plugins = loadPluginConfigs()
    .map((item) => {
      const { config, configPath } = item;
      const sourceEntries =
        config.source.type === "single"
          ? [config.source.entry]
          : config.source.moduleOrder.slice();
      const outputPath = toPluginOutputPath(config.artifact);

      return {
        id: config.id,
        artifact: config.artifact,
        name: config.name,
        version: config.version,
        minAppVersion: config.minAppVersion,
        description: config.description || null,
        aliases: config.aliases || [],
        allowedOrigins: config.allowedOrigins || [],
        allowedUrls: config.allowedUrls || [],
        deprecation: config.deprecation || null,
        pipeline: config.pipeline || { mode: "standard" },
        runtimeShared: config.runtimeShared || [],
        source: config.source,
        sourceEntries,
        configPath: path.relative(REPO_ROOT, configPath),
        outputPath,
        publicUrl: `${publicBaseUrl}${outputPath}`,
        checksums: checksumById.get(config.id) || {
          sha256: null,
          bytes: null,
        },
      };
    })
    .sort((a, b) => a.id.localeCompare(b.id));

  return {
    schemaVersion: 2,
    generatedAt: new Date().toISOString(),
    releaseAuthorityPath: path.relative(REPO_ROOT, path.join("scripts", "config", "release-authority.json")),
    releaseAuthority: authority,
    publicIndex: buildPublicIndexEntries(plugins),
    pluginConfigFiles: discoverPluginConfigFiles().map((p) => path.relative(REPO_ROOT, p)),
    plugins,
  };
}

function main() {
  const manifest = buildManifest();
  const next = `${JSON.stringify(manifest, null, 2)}\n`;

  if (CHECK_MODE) {
    const current = readJson(BUILD_MANIFEST_PATH);
    const currentNormalized = JSON.stringify(
      {
        ...current,
        generatedAt: manifest.generatedAt,
      },
      null,
      2,
    );
    const nextNormalized = JSON.stringify(manifest, null, 2);
    if (currentNormalized !== nextNormalized) {
      throw new Error(
        `Build manifest drift: ${path.relative(REPO_ROOT, BUILD_MANIFEST_PATH)} is out of date`,
      );
    }
    console.log("build-manifest is up to date");
    return;
  }

  writeJson(BUILD_MANIFEST_PATH, manifest);
  process.stdout.write(`Wrote ${path.relative(REPO_ROOT, BUILD_MANIFEST_PATH)}\n`);
}

module.exports = { buildManifest };

if (require.main === module) {
  main();
}
