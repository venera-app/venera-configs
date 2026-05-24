# venera-configs

Venera 漫画阅读器的 JS 配置插件仓库。每个 `.js` 文件（除 `_venera_.js` 和 `_template_.js` 外）是一个自包含的漫画源配置，运行时通过 jsDelivr CDN 拉取。**无构建系统、无包管理器、无测试、无 lint。**

## 文件结构

| 文件 | 用途 |
|------|------|
| `_venera_.js` | 运行时库/类型定义，供 IDE 代码补全。**不可修改。** |
| `_template_.js` | 新源的起始模板。复制并重命名来创建新源。 |
| `index.json` | 所有源的注册表（name / fileName / key / version）。**添加、删除或重命名源时必须更新。** |
| `pixiv.js` | Pixiv 插画浏览源。PKCE WebView 登录 + 手动 refresh_token。 |
| `PIXIV_API.md` | Pixiv API 完整参考文档（提取自 PixEz Flutter 项目）。修改 `pixiv.js` 时查阅。 |
| `pixez/` | PixEz Flutter 项目的 API 层提取代码。**已 gitignore** — 新克隆不可用，主要参考 `PIXIV_API.md`。 |
| `.github/workflows/purge_cdn.yml` | 推送到 main 时自动刷新 jsDelivr CDN 缓存。 |

## 添加或更新源

1. 每个源文件顶部必须有 `/** @type {import('./_venera_.js')} */`
2. 类必须继承 `ComicSource`，定义 `name`、`key`、`version`、`minAppVersion`、`url`
3. `url` 必须指向 jsDelivr CDN：`https://cdn.jsdelivr.net/gh/theoldman-lab/venera-configs@main/<filename>.js`
4. `key` 应为唯一标识符（通常用小写 snake_case）
5. 添加/删除/重命名源后，必须更新 `index.json`

## Pixiv 源 (`pixiv.js`) — v0.4.0

基于 PixEz Flutter 项目的 API 层重写。参考文档：`PIXIV_API.md`。

### 功能状态

| 模块 | 状态 |
|------|------|
| 认证 | PKCE WebView 登录（主流程）+ 手动 refresh_token |
| Token 管理 | OAuth 错误（HTTP 400）时自动刷新 |
| 探索页 | 关注动态 (`/v2/illust/follow?restrict=all`)，`next_url` 游标分页 |
| 作品详情 | 标题/画师/多页统一章节，原图/大图加载 |
| 图片加载 | `Referer` + `User-Agent` 头 |
| 标签系统 | 详情页：`'Artist'`（画师名\|ID）+ `'Tags'`（`"原始名 [翻译名]"`）；点击用原始名精确搜索 |
| 画师作品 | `onClickTag` → `categoryComics.load` 走 `user_illusts` 分类（offset 分页，30/页） |
| 分类页 | 热门标签动态发现 (`/v1/trending-tags/illust`)；`tag_search` 分类类型支持标签跳转搜索 |
| 搜索 | `loadNext` 游标分页。标签点击→`exact_match_for_tags`（全量结果）；关键词→用户自选排序/目标/AI过滤；用户搜索→`search/user`。自动补全已禁用（Venera `encodeURIComponent` 编码 `:` → `%3A` 导致 Pixiv 命名空间匹配失效） |
| 收藏/书签 | 未实现 |
| 评论 | 未实现 |
| 排行榜 | 未实现 |

### 标签系统

- **列表卡片**（`parseIllust`）：扁平标签（`translated_name || name`），末尾追加画师名
- **详情页**（`loadInfo`）：命名空间标签 — `'Artist': ["画师名 |用户ID"]` 和 `'Tags': ["原始名 [翻译名]", ...]`。`[翻译]` 后缀仅在 `translated_name` 存在且不同于 `name` 时追加
- **`onClickTag` 点击流程**：
  - `namespace === 'Artist'` → 解析 `|ID` 后缀 → 跳转 `user_illusts` 分类页
  - 其他标签 → 提取 ` [` 前面的原始名 → 搜索 `exact_match_for_tags` + `popular_desc`
- **`categoryComics.load`**：
  - `user_illusts`：offset 分页 `/v1/user/illusts?offset=...`
  - `tag_search`：`search/illust` + `exact_match_for_tags` + `popular_desc`，游标→页码转换通过 `_tag_cursor`

### 搜索架构（v0.4.0）

三条路径，匹配 PixEz 设计：

| 路径 | 触发方式 | 端点 | 参数 |
|------|---------|------|------|
| 标签点击 | `onClickTag` → `_pendingTagSearch` | `/v1/search/illust` | `exact_match_for_tags` + `popular_desc` |
| 关键词 | 搜索栏（用户输入） | `/v1/search/illust` | 用户自选 sort/search_target/ai |
| 用户 | `searchTarget='users'` | `/v1/search/user` | `filter=for_android` |

所有路径均通过 `loadNext` 使用 `next_url` 游标分页。早期版本使用的 `popular-preview` 端点已被替换，因为它仅返回少量热门预览，而非完整标签结果集。

### v0.3.x → v0.4.0 修复摘要

- 搜索 `load` 替换为 `loadNext` 游标分页 — 移除脆弱的 `_search_cursor` saveData 黑科技
- `onClickTag` 搜索跳转改用 `attributes` 包装（`{page: 'search', attributes: {keyword: tag}}`），符合 PageJumpTarget schema
- 标签搜索从 `popular-preview` 改为 `search/illust` + `exact_match_for_tags` — 修复"只能搜到几个结果"的问题
- 标签展示增强为 `"原始名 [翻译名]"` 格式；`onClickTag` 提取原始名实现精确搜索
- 禁用自动补全：Venera 的 `encodeURIComponent` 将 `:` 编码为 `%3A`，导致 Pixiv 服务端命名空间匹配失效

### 认证

**主流程（PKCE WebView）** — `loginWithWebview.url` 通过 IIFE 在解析时生成：
```
app-api.pixiv.net/web/v1/login?code_challenge=...&code_challenge_method=S256&client=pixiv-android
```
Pixiv 服务器创建 PKCE 会话 → 重定向至 `accounts.pixiv.net/login` → 用户登录 → Pixiv 跟随 OAuth 重定向链 → `callback?code=...` → `checkStatus` 捕获授权码 → `_exchangeAuthCode()` 用 `authorization_code` + `code_verifier` + App OAuth 凭证交换 `access_token`。

**手动流程** — `login(account, pwd)` 接受纯 `refresh_token` 作为 `account` 参数。

**自动刷新**：任何 API 调用返回 HTTP 400 且 `error.message` 包含 `"OAuth"` 时，自动刷新 token 并重试请求（参考 PixEz `RefreshTokenInterceptor`）。

**关键经验**：
- `loginWithWebview.url` 必须在对象字面量中通过 IIFE 直接设置，**不可**在 `init()` 里设置 — Venera 在解析时读取
- `checkStatus` 必须**仅**匹配 PKCE callback URL（`/auth/pixiv/callback?code=...`）。宽泛的兜底匹配（如 `pixiv.net`）会导致过早 `onLoginSuccess`，损坏 PKCE verifier
- OAuth `/auth/token` 请求必须包含 `Content-Type: application/x-www-form-urlencoded` 头 — Venera 默认 `application/json` 会导致 `invalid_client` 错误
- `code_verifier` 在 URL 生成与 token 交换之间**不可重新生成** — 每次 PKCE 会话保持唯一静态 verifier
- JavaScript `new Map()` 通过 JS-to-Dart 桥接序列化方式与普通对象 `{}` 不同 — 对 `chapters` 和 `tags` 使用普通对象

### 请求签名（关键）

所有对 `app-api.pixiv.net` 的请求必须携带：

| Header | 值 |
|--------|-----|
| `X-Client-Time` | 当前 UTC 时间：`yyyy-MM-dd'T'HH:mm:ss'+00:00'` |
| `X-Client-Hash` | `MD5(X-Client-Time + hashSecret)` 的十六进制 |
| `User-Agent` | `PixivAndroidApp/5.0.166 (Android 10.0; Pixel C)` |
| `App-OS` / `App-OS-Version` | `Android` / `Android 10.0` |
| `App-Version` | `5.0.166` |
| `Authorization` | `Bearer {access_token}` |
| `Host` | `app-api.pixiv.net` |

Hash 密钥：`28c1fdd170a5204386cb1313c7077b34f83e4aaf4aa829ce78c231e05b0bae2c`

OAuth 端点（`oauth.secure.pixiv.net`）使用相同 Headers，但不含 `Authorization` 和 `Host`。

### Pixiv API 主机

| Host | 用途 |
|------|------|
| `app-api.pixiv.net` | REST API（插画/小说/用户/搜索等） |
| `oauth.secure.pixiv.net` | OAuth token 端点（`/auth/token`） |
| `accounts.pixiv.net` | Web 登录（WebView） |
| `i.pximg.net` / `s.pximg.net` | 图片 CDN |

### 图片 CDN

所有图片 URL 均签名/域名锁定到 `i.pximg.net`。请求必须包含：
- `Referer: https://app-api.pixiv.net/`
- 与客户端匹配的有效 `User-Agent`

### 分页

Pixiv 使用 `next_url` 游标分页。响应中包含 `next_url` 字段（相对路径）指向下一页，或 `null` 表示最后一页。探索页通过 `loadNext` 跟随此游标。

## Venera API 注意事项

- **`Network.get/post/put/delete`** 返回 `{status, headers, body}`，其中 `body` 为 **字符串**（UTF-8 解码）。二进制响应使用 `Network.fetchBytes`。
- **`fetch`**（全局）是类似浏览器的包装器，自 app 1.2.0 可用。返回 `{ok, status, json(), text(), arrayBuffer()}`。与 `Network.get` 不同，`body` 是 `ArrayBuffer`；使用 `.text()` 或 `.json()` 读取。
- **`HtmlDocument`** — HTML 解析器。使用完毕后务必调用 `.dispose()`。
- **`Network.setCookies(url, cookies)`** — 每个 cookie 为 `new Cookie({name, value, domain})`。
- **`Convert`** — 哈希（md5 / sha1 / sha256 / sha512 / hmac），编码（utf8 / gbk / base64 / hex），解密（AES-ECB/CBC/CFB/OFB / RSA）。
  - **关键**：`Convert.md5()`（及所有哈希函数）返回 `ArrayBuffer`，**不是**十六进制字符串。使用 `Convert.hexEncode(Convert.md5(data))` 获取十六进制字符串（如 Pixiv `X-Client-Hash`）。
- **`this.loadData`/`saveData`/`deleteData`** — 按源隔离的持久化键值存储。
- **`this.loadSetting`** — 读取用户在 `settings` 块中声明的设置（如 `pixiv.js` 中 `apiHost` 代理支持）。
- 从账户/收藏方法中 **抛出 `'Login expired'`（精确字符串）** 可触发 App 自动重新登录。
- **`this.translate(key)`** — 使用 `APP.locale` 和源的 `translation` 对象查找翻译。
- **`ImageLoadingConfig`** — 兼容旧版 App，创建普通对象而非使用构造函数。
- **`categoryComics.load` 必须同步**（直接返回值，不能是 Promise）。Venera Dart 桥接严格检查返回类型；async 函数返回 Promise 而非 List。
