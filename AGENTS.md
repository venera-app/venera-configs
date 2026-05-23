# AGENTS.md

## Repo overview

Flat repo of JavaScript "comic source" plugins for the Venera manga reader app. Each `.js` file (except `_venera_.js` and `_template_.js`) is a self-contained source config fetched by the app at runtime via jsDelivr CDN. There is **no build system, no package manager, no tests, no linting.**

## Key files

- `_venera_.js` — Library/typedef for IDE code completion. **Do not modify.**
- `_template_.js` — Starter template for new sources. Copy and rename to create a new source.
- `index.json` — Registry of all sources (name, fileName, key, version). **Must be updated** when adding, removing, or renaming a source file.
- `pixiv.js` — Pixiv illust browsing source. Uses WebView login (`accounts.pixiv.net/login` → localStorage → refresh_token) to authenticate with Pixiv's app API (`app-api.pixiv.net`).
- `PIXIV_API.md` — Comprehensive Pixiv API reference documentation extracted from the PixEz Flutter project. Consult this when working on `pixiv.js`.
- `pixez/` — Extracted Pixiv API layer from the PixEz Flutter project. Reference-only codebase for understanding Pixiv's internal API protocol.
- `.github/workflows/purge_cdn.yml` — On push to `main`, purges changed `.js`/`.json` files from jsDelivr CDN cache.

## Adding or updating a source

1. Each source file must have `/** @type {import('./_venera_.js')} */` at the top.
2. The class must extend `ComicSource` and define `name`, `key`, `version`, and `url`.
3. The `url` field must point to the file's jsDelivr CDN path: `https://cdn.jsdelivr.net/gh/theoldman-lab/venera-configs@main/<filename>.js`
4. The `key` field should be a unique identifier (typically lowercase snake_case).
5. After adding/removing/renaming a source, update `index.json` with the corresponding entry.

## pixiv.js v2.0.0 implementation notes

Rewritten from scratch, based on the PixEz Flutter project (`pixez/`) API layer. Reference: `PIXIV_API.md`.

### Status

| Module | Status |
|--------|--------|
| Authentication | WebView login + manual refresh_token |
| Token management | Auto-refresh on OAuth errors (HTTP 400) |
| Explore | Following feed (`/v2/illust/follow?restrict=all`) |
| Comic detail | Info + chapters + image loading |
| Search | Not yet |
| Favorites | Not yet |
| Comments | Not yet |
| Category/Ranking | Not yet |

### Authentication

- **Primary flow**: `loginWithWebview` — opens `accounts.pixiv.net/login?lang=zh` in Venera's built-in WebView. After successful login, Pixiv's web SPA stores OAuth tokens in localStorage. Venera captures this automatically as `_localStorage`. `onLoginSuccess` extracts `refresh_token` and saves it as `pending_refresh_token`, which is exchanged for `access_token` on the next API call or when `login()` is invoked.
- **Fallback flow**: `login(account, pwd)` — treats `account` as a `refresh_token` (Pixiv's password grant is blocked). Calls `/auth/token` with `grant_type=refresh_token`.
- **Auto-refresh**: When any API call returns HTTP 400 with `"OAuth"` in `error.message`, automatically refreshes the token and retries the request (ref: `PixEz RefreshTokenInterceptor`).

### Required headers

Every API request to `app-api.pixiv.net` must include:

| Header | Value |
|--------|-------|
| `X-Client-Time` | Current UTC time: `yyyy-MM-dd'T'HH:mm:ss'+00:00'` |
| `X-Client-Hash` | `MD5(X-Client-Time + hashSecret)` as hex |
| `User-Agent` | `PixivAndroidApp/5.0.166 (Android 10.0; Pixel C)` |
| `App-OS` / `App-OS-Version` | `Android` / `Android 10.0` |
| `App-Version` | `5.0.166` |
| `Authorization` | `Bearer {access_token}` |
| `Host` | `app-api.pixiv.net` |

Hash secret: `28c1fdd170a5204386cb1313c7077b34f83e4aaf4aa829ce78c231e05b0bae2c`

OAuth endpoints (`oauth.secure.pixiv.net`) use the same headers minus `Authorization` and `Host`.

### Pixiv API hosts

| Host | Purpose |
|------|---------|
| `app-api.pixiv.net` | REST API (illust, novel, user, search, etc.) |
| `oauth.secure.pixiv.net` | OAuth token endpoint (`/auth/token`) |
| `accounts.pixiv.net` | Web login (WebView) |
| `i.pximg.net` / `s.pximg.net` | Image CDN |

### Image CDN

All image URLs are signed/domain-locked to `i.pximg.net`. Requests must include:
- `Referer: https://app-api.pixiv.net/`
- A valid `User-Agent` matching the app client

### Pagination

Pixiv uses `next_url` cursor-based pagination. Responses contain a `next_url` field (relative path) for the next page, or `null` when there are no more pages. The explore feed uses `loadNext` to follow this cursor.

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
