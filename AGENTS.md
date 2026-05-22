# AGENTS.md

## Repo overview

Flat repo of JavaScript "comic source" plugins for the Venera manga reader app. Each `.js` file (except `_venera_.js` and `_template_.js`) is a self-contained source config fetched by the app at runtime via jsDelivr CDN. There is **no build system, no package manager, no tests, no linting.**

## Key files

- `_venera_.js` — Library/typedef for IDE code completion. **Do not modify.**
- `_template_.js` — Starter template for new sources. Copy and rename to create a new source.
- `index.json` — Registry of all sources (name, fileName, key, version). **Must be updated** when adding, removing, or renaming a source file.
- `.github/workflows/purge_cdn.yml` — On push to `main`, purges changed `.js`/`.json` files from jsDelivr CDN cache.

## Adding or updating a source

1. Each source file must have `/** @type {import('./_venera_.js')} */` at the top.
2. The class must extend `ComicSource` and define `name`, `key`, `version`, and `url`.
3. The `url` field must point to the file's jsDelivr CDN path: `https://cdn.jsdelivr.net/gh/venera-app/venera-configs@main/<filename>.js`
4. The `key` field should be a unique identifier (typically lowercase snake_case).
5. After adding/removing/renaming a source, update `index.json` with the corresponding entry.

## Venera API notes

- **`Network.get/post/put/delete`** return `{status, headers, body}` where `body` is a **string** (UTF-8 decoded). Use `Network.fetchBytes` for binary responses.
- **`fetch`** (global) is a browser-like wrapper available since app 1.2.0. Returns `{ok, status, json(), text(), arrayBuffer()}`.
- **`HtmlDocument`** — HTML parser. Always call `.dispose()` when done.
- **`Network.setCookies(url, cookies)`** — Each cookie is a `new Cookie({name, value, domain})`.
- **`Convert`** — hashing (md5, sha1, sha256, sha512, hmac), encoding (utf8, gbk, base64, hex), decryption (AES-ECB/CBC/CFB/OFB, RSA).
- **`this.loadData`/`saveData`/`deleteData`** — scoped per-source persistent key-value storage.
- **`this.loadSetting`** — reads user-configured settings declared in the `settings` block.
- **Throw `'Login expired'`** (exact string) from account/favorite methods to trigger automatic re-login in the app.
- **`this.translate(key)`** — looks up translation using `APP.locale` and the source's `translation` object.
- **`ImageLoadingConfig`** — for compatibility with older app versions, create a plain object rather than using the constructor.
