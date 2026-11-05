# venera-configs

> [!WARNING]
> This repository is the canonical source for Venera plugin configuration,
> generated metadata, and release-authority wiring.
>
> It is not a runtime loader. Downstream consumers must validate plugin
> configs, public index entries, and artifact integrity before execution.
> [![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/mythic3011/venera-configs)
> [![Plugin Configs](https://img.shields.io/badge/plugin%20configs-canonical-blue)](#what-this-repo-contains)
> [![Build Manifest](https://img.shields.io/badge/build-manifest-generated-purple)](#generated-output)
> [![Verification](https://img.shields.io/badge/verification-enabled-brightgreen)](#build-and-verify)

A schema-validated source catalog for Venera plugin configs and generated build metadata.

## Index

- [venera-configs](#venera-configs)
  - [Index](#index)
  - [What This Repo Contains](#what-this-repo-contains)
  - [What To Edit](#what-to-edit)
  - [Generated Output](#generated-output)
  - [Build And Verify](#build-and-verify)
  - [Contributing](#contributing)
  - [Release And License](#release-and-license)
  - [中文說明](#中文說明)
    - [要改什麼](#要改什麼)
    - [生成內容](#生成內容)
    - [怎麼驗證](#怎麼驗證)
    - [貢獻說明](#貢獻說明)
    - [授權](#授權)

## What This Repo Contains

This repo keeps the plugin catalog and the data needed to build it in a
deterministic way.

Primary authoring inputs:

- `plugins/*/plugin.config.json`
- `plugins/*/src`
- `support/*`
- `scripts/config/release-authority.json`

Primary generated outputs:

- `.generated/build-manifest.json`
- `dist/plugins/*.js`
- `index.json`, written from plugin configs by the build
- `publicIndex` entries embedded in the build manifest

The loader should derive final URLs from release authority plus the generated
output path, not from hard-coded CDN strings.

## What To Edit

Treat these as compatibility surfaces:

- plugin `key`
- plugin `name`
- plugin `version`
- artifact filename
- `publicIndex` entry shape
- release-authority base URL

Do not hand-edit generated URLs, `index.json`, or manifest entries.

`i18n/ehentai.json` remains only as legacy compatibility content.

Use these rules while editing:

- add or update `plugins/*/plugin.config.json` -> run `npm run sync-manifest`
- change plugin source or build inputs -> run `npm run generate`
- verify the manifest -> run `npm run check:manifest`
- verify generated output -> run `npm run check-generated`

## Generated Output

Plugin configs are discovered from `plugins/*/plugin.config.json`.
Source files under `plugins/*/src` are built into generated plugin artifacts.
The build pipeline also writes integrity metadata (`sha256`, `bytes`) into
`.generated/build-manifest.json`.

Generated artifacts are built from `plugins/*/src` using
`plugins/*/plugin.config.json`. For example, `dist/plugins/ehentai.js` is
generated from `plugins/ehentai/src`.

Generated artifacts are automatically:

1. Transpiled to ES2018-compatible syntax for `flutter_qjs`
2. Kept parser-friendly for Venera `ComicSourceParser`
3. Left unminified enough that the file still starts with `class <Source> extends ComicSource`

Do not hand-edit generated files under `dist/plugins`; commit generated outputs
with source changes.

For `source.type: "concat"` plugins, module files can import repo-local support
helpers only through domain indexes.

- Supported import forms:
  - `import "support/<domain>/index.js"`
  - `import { helperA, helperB as localName } from "support/<domain>/index.js"`
- Supported specifiers:
  - `support/<domain>/index.js`
  - relative `./...` and `../...` paths ending with `.js`
- Not supported:
  - deep support imports such as `support/http/request-client.js`
  - plugin imports from `support/testing`
  - `shared/...`
  - package/bare imports
  - default imports
  - namespace imports (`* as`)

The build pipeline inlines imported module code and emits standalone plugin
artifacts without `import`/`export` at runtime.

Source files should also avoid runtime features that `flutter_qjs` does not
support well:

- initialize fields inside `constructor()`; do not use class field initializers
- do not rely on optional chaining, nullish coalescing, `.at()`, `replaceAll()`, or `matchAll()` in root source files

Each generated plugin artifact records:

- `sha256`: SHA-256 of the final artifact text
- `bytes`: UTF-8 byte length of the final artifact text

## Build And Verify

Common checks while iterating:

```bash
npm run pipeline:build
npm run check-generated
npm run check:manifest
npm test
npm run test:runtime
npm run audit:unsafe-runtime-code
```

For release-authority validation:

```bash
npm run validate:release-authority
npm run validate:plugins
```

For a full pre-push validation pass:

```bash
npm run pipeline:ci
```

To build individual plugins or the full set:

```bash
npm run build:plugin -- <plugin-id>
npm run build:plugin -- all
npm run build:all
```

To sync the generated manifest:

```bash
npm run generate
npm run sync-manifest
npm run check:manifest
```

## Contributing

Contributions should be actionable.

Include:

- the affected plugin or support domain
- reproduction steps or the expected output change
- whether the change affects generated artifacts or release authority
- validation output from the relevant `npm run ...` checks

Low-effort wishlist issues without a concrete path to validation may be closed
without implementation.

## Release And License

This repository does not publish alternate package channels on its own.
Committed source, generated artifacts, and the canonical build manifest are the
source of truth for downstream loader integration.

This repository is licensed under the PolyForm Noncommercial License 1.0.0.
It is intended for personal use only and is not licensed for business or
commercial use.

The standalone LICENSE file is the source of truth for the terms. The
`license` field in `package.json` points to that file.

## 中文說明

此 repo 是 Venera plugin configuration 與 generated metadata 的 canonical source。它不是
runtime loader；下游 consumer 在執行前必須先驗證 plugin config、public index entry 與
artifact integrity。

### 要改什麼

以下都是相容性 surface：

- plugin `key`
- plugin `name`
- plugin `version`
- artifact filename
- `publicIndex` entry shape
- release-authority base URL

不要手動編輯生成後的 URL、`index.json` 或 manifest entry。`i18n/ehentai.json` 仍然只保留作 legacy
compatibility content。

更新規則如下：

- 新增或更新 `plugins/*/plugin.config.json` 後，執行 `npm run sync-manifest`
- 變更 plugin source 或 build inputs 後，執行 `npm run generate`
- 要確認 manifest 是否最新，執行 `npm run check:manifest`
- 要確認生成輸出是否最新，執行 `npm run check-generated`

### 生成內容

`plugins/*/plugin.config.json` 會被掃描，`plugins/*/src` 會被建置成生成後的 plugin
artifacts。`index.json` 由 plugin config 生成，`.generated/build-manifest.json` 會同時記錄 public index 與 integrity metadata。

`dist/plugins/*.js` 會由對應的 `plugins/*/src` 生成，且要保持：

1. ES2018-compatible syntax，方便 `flutter_qjs` 使用
2. Parser-friendly，檔案開頭必須是 `class <Source> extends ComicSource`
3. 不要手動編輯 `dist/plugins` 下的生成檔

`source.type: "concat"` 的 plugins 只可以匯入 `support/<domain>/index.js`
或以 `.js` 結尾的相對路徑；不支援 deep support import、`support/testing`、`shared/...`、
package/bare imports、default imports、namespace imports。

source files 也應避免依賴 `flutter_qjs` 不友善的語法：

- 在 `constructor()` 裡初始化 fields，不要用 class field initializers
- 不要依賴 optional chaining、nullish coalescing、`.at()`、`replaceAll()` 或 `matchAll()`

### 怎麼驗證

常用檢查：

```bash
npm run pipeline:build
npm run check-generated
npm run check:manifest
npm test
npm run test:runtime
npm run audit:unsafe-runtime-code
```

release-authority validation：

```bash
npm run validate:release-authority
npm run validate:plugins
```

完整 pre-push validation：

```bash
npm run pipeline:ci
```

單一 plugin 或全部 plugin 建置：

```bash
npm run build:plugin -- <plugin-id>
npm run build:plugin -- all
npm run build:all
```

同步 manifest：

```bash
npm run generate
npm run sync-manifest
npm run check:manifest
```

### 貢獻說明

請提供：

- 受影響的 plugin 或 support domain
- 重現步驟或預期輸出變更
- 變更是否影響 generated artifacts 或 release authority
- 相關 `npm run ...` 驗證結果

低成本、沒有驗證路徑的 wishlist issue 可能會被關閉。

### 授權

此 repository 依 PolyForm Noncommercial License 1.0.0 授權。它僅供個人使用，不授權商業或
business use。

LICENSE 檔是條款的 source of truth，而 `package.json` 的 `license` 欄位會指向該檔案。
