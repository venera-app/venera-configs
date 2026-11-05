const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const crypto = require("node:crypto");
const { z } = require("zod");

const REPO_ROOT = path.resolve(__dirname, "../..");
const PLUGINS_DIR = path.join(REPO_ROOT, "plugins");
const GENERATED_DIR = path.join(REPO_ROOT, ".generated");
const DIST_PLUGINS_DIR_REL = "dist/plugins";
const DIST_PLUGINS_DIR = path.join(
  REPO_ROOT,
  ...DIST_PLUGINS_DIR_REL.split("/"),
);
const BUILD_MANIFEST_PATH = path.join(GENERATED_DIR, "build-manifest.json");
const PUBLIC_INDEX_PATH = path.join(REPO_ROOT, "index.json");
const RELEASE_AUTHORITY_PATH = path.join(
  REPO_ROOT,
  "scripts",
  "config",
  "release-authority.json",
);

const pluginSourceSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("single"),
    entry: z.string().min(1),
  }),
  z.object({
    type: z.literal("concat"),
    moduleOrder: z.array(z.string().min(1)).min(1),
  }),
]);

const pluginPipelineSchema = z
  .object({
    mode: z.enum(["standard", "legacy_passthrough"]).default("standard"),
    injectRuntimeReleaseAuthority: z.boolean().default(true),
  })
  .default({ mode: "standard", injectRuntimeReleaseAuthority: true });

const pluginConfigSchema = z.object({
  id: z.string().min(1),
  artifact: z.string().regex(/^[A-Za-z0-9_.-]+\.js$/),
  name: z.string().min(1),
  version: z.string().min(1),
  minAppVersion: z.string().min(1),
  description: z.string().min(1).optional(),
  aliases: z.array(z.string().min(1)).optional().default([]),
  allowedOrigins: z.array(z.string().min(1)).optional().default([]),
  allowedUrls: z.array(z.string().min(1)).optional().default([]),
  deprecation: z
    .object({
      note: z.string().min(1),
      replacementId: z.string().min(1).optional(),
      since: z.string().min(1).optional(),
    })
    .optional(),
  source: pluginSourceSchema,
  pipeline: pluginPipelineSchema.optional(),
  runtimeShared: z.array(z.string().min(1)).optional().default([]),
});

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function normalizePluginConfig(rawConfig, filePath) {
  const parsed = pluginConfigSchema.safeParse(rawConfig);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `${issue.path.join(".") || "<root>"}: ${issue.message}`)
      .join("; ");
    throw new Error(
      `Invalid plugin config ${path.relative(REPO_ROOT, filePath)}: ${issues}`,
    );
  }
  const config = parsed.data;
  if (!config.pipeline) {
    config.pipeline = { mode: "standard", injectRuntimeReleaseAuthority: true };
  }
  if (typeof config.pipeline.injectRuntimeReleaseAuthority !== "boolean") {
    config.pipeline.injectRuntimeReleaseAuthority = true;
  }
  return config;
}

function discoverPluginConfigFiles() {
  if (!fs.existsSync(PLUGINS_DIR)) {
    return [];
  }
  return fs
    .readdirSync(PLUGINS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(PLUGINS_DIR, entry.name, "plugin.config.json"))
    .filter((filePath) => fs.existsSync(filePath))
    .sort((a, b) => a.localeCompare(b));
}

function loadPluginConfigs() {
  return discoverPluginConfigFiles().map((filePath) => {
    const config = normalizePluginConfig(readJson(filePath), filePath);
    return {
      configPath: filePath,
      pluginDir: path.dirname(filePath),
      dirName: path.basename(path.dirname(filePath)),
      config,
    };
  });
}

function validateReleaseAuthority(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("release-authority.json must be an object");
  }
  const requiredString = [
    ["provider", raw.provider],
    ["repo.owner", raw.repo && raw.repo.owner],
    ["repo.name", raw.repo && raw.repo.name],
    ["ref", raw.ref],
    ["urlTemplate.scheme", raw.urlTemplate && raw.urlTemplate.scheme],
    ["urlTemplate.host", raw.urlTemplate && raw.urlTemplate.host],
    [
      "urlTemplate.repositoryPathPrefix",
      raw.urlTemplate && raw.urlTemplate.repositoryPathPrefix,
    ],
    [
      "urlTemplate.repoRefSeparator",
      raw.urlTemplate && raw.urlTemplate.repoRefSeparator,
    ],
  ];
  for (const [key, value] of requiredString) {
    if (typeof value !== "string" || value.trim() === "") {
      throw new Error(
        `release-authority.json invalid: ${key} must be a non-empty string`,
      );
    }
  }
  if (raw.urlTemplate.scheme !== "https") {
    throw new Error(
      'release-authority.json invalid: urlTemplate.scheme must be "https"',
    );
  }
  if (typeof raw.urlTemplate.trailingSlash !== "boolean") {
    throw new Error(
      "release-authority.json invalid: urlTemplate.trailingSlash must be boolean",
    );
  }
  return raw;
}

function loadReleaseAuthority() {
  if (!fs.existsSync(RELEASE_AUTHORITY_PATH)) {
    throw new Error(
      `Missing ${path.relative(REPO_ROOT, RELEASE_AUTHORITY_PATH)}`,
    );
  }
  return validateReleaseAuthority(readJson(RELEASE_AUTHORITY_PATH));
}

function buildPublicBaseUrl(authority) {
  const prefix = authority.urlTemplate.repositoryPathPrefix.replace(
    /^\/+|\/+$/g,
    "",
  );
  const repoRef = `${authority.repo.name}${authority.urlTemplate.repoRefSeparator}${authority.ref}`;
  const trailing = authority.urlTemplate.trailingSlash ? "/" : "";
  return `${authority.urlTemplate.scheme}://${authority.urlTemplate.host}/${prefix}/${authority.repo.owner}/${repoRef}${trailing}`;
}

// Metadata extraction functions removed: config.json is now the single source of truth
// for plugin metadata (id, name, version, minAppVersion).
// See validate-plugin-config.js for metadata sourcing from config.

function sha256Hex(content) {
  return crypto.createHash("sha256").update(content).digest("hex");
}

function normalizeOutputCode(code) {
  return `${String(code)
    .replace(/^\s*["\']use strict["\'];\s*/, "")
    .replace(/[ \t]+$/gm, "")
    .trimEnd()}\n`;
}

function toPluginOutputPath(fileName) {
  const normalizedFileName = String(fileName || "").replace(/^\/+/, "");
  if (!normalizedFileName) {
    throw new Error("Artifact filename is required");
  }
  return normalizedFileName.startsWith(`${DIST_PLUGINS_DIR_REL}/`)
    ? normalizedFileName
    : path.posix.join(DIST_PLUGINS_DIR_REL, normalizedFileName);
}

function buildPublicIndexEntries(plugins) {
  return plugins.map((plugin) => {
    const entry = {
      name: plugin.name,
      fileName: plugin.artifact,
      key: plugin.id,
      version: plugin.version,
      url: plugin.publicUrl,
    };
    if (plugin.description) {
      entry.description = plugin.description;
    }
    return entry;
  });
}

module.exports = {
  REPO_ROOT,
  PLUGINS_DIR,
  GENERATED_DIR,
  DIST_PLUGINS_DIR_REL,
  DIST_PLUGINS_DIR,
  BUILD_MANIFEST_PATH,
  PUBLIC_INDEX_PATH,
  RELEASE_AUTHORITY_PATH,
  pluginConfigSchema,
  ensureDir,
  readJson,
  writeJson,
  normalizePluginConfig,
  discoverPluginConfigFiles,
  loadPluginConfigs,
  loadReleaseAuthority,
  buildPublicBaseUrl,
  sha256Hex,
  normalizeOutputCode,
  toPluginOutputPath,
  buildPublicIndexEntries,
};
