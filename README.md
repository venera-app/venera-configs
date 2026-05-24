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

| 模块 | 说明 |
|------|------|
| 认证 | PKCE WebView 登录 + 手动 refresh_token，OAuth HTTP 400 自动刷新 |
| 探索页 | 关注动态 (`/v2/illust/follow?restrict=all`)，`next_url` 游标分页 |
| 作品详情 | 标题/画师/多页统一章节，原图/大图加载 |
| 图片加载 | `Referer` + `User-Agent` 头 |
| 标签系统 | 详情页 `"原始名 [翻译名]"` 格式，`onClickTag` 提取原始名做 `exact_match_for_tags` 搜索 |
| 画师作品 | Artist 标签点击 → `user_illusts` 分类（offset 分页 30/页） |
| 分类页 | 热门标签发现 (`/v1/trending-tags/illust`)；`tag_search` 分类支持标签跳转 |
| 搜索 | `loadNext` 游标分页，三路架构（标签点击/关键词/用户），禁用自动补全 |
| 评论 | 加载/发表/回复评论 (`/v3/illust/comments`, `/v1/illust/comment/add`)，游标分页 |
| 收藏 | 书签标签→文件夹，添加/删除/加载收藏。`isFavorite` 从 `illust.is_bookmarked` 直接取值 |
| 画师关注 | `likeComic` 基于服务器实际状态 toggle，默认私密关注 |
| 排行榜 | 未实现 |

### 标签系统

- **列表卡片**（`parseIllust`）：扁平标签（`translated_name || name`），末尾追加画师名
- **详情页**（`loadInfo`）：`'Artist': ["画师名 |用户ID"]` + `'Tags': ["原始名 [翻译名]"]`。`[翻译]` 仅在 `translated_name` 存在且不同于 `name` 时追加
- **`onClickTag`**：`namespace === 'Artist'` → 解析 `|ID` → 跳转 `user_illusts` 分类页；其他 → 提取 ` [` 前原始名 → `exact_match_for_tags` + `popular_desc`

### 搜索架构

三条路径，匹配 PixEz 设计：

| 路径 | 触发 | 端点 | 参数 |
|------|------|------|------|
| 标签点击 | `onClickTag` → `_pendingTagSearch` | `/v1/search/illust` | `exact_match_for_tags` + `popular_desc` |
| 关键词 | 搜索栏用户输入 | `/v1/search/illust` | 用户自选 sort/search_target/ai |
| 用户 | `searchTarget='users'` | `/v1/search/user` | `filter=for_android` |

所有路径通过 `loadNext` 使用 `next_url` 游标。`popular-preview` 端点已被替换（仅返回少量热门预览，非完整标签结果集）。自动补全已禁用：Venera `encodeURIComponent` 将 `:` 编码为 `%3A`，导致 Pixiv 命名空间匹配失效。

### 评论

- `loadComments`：`/v3/illust/comments` 顶层评论 + `replyTo` 参数触发 `/v2/illust/comment/replies` 回复加载，`next_url` 游标转页码
- `sendComment`：POST `/v1/illust/comment/add`，form-urlencoded body（`illust_id` + `comment`，回复时追加 `parent_comment_id`）
- `likeComment`/`voteComment`：空桩方法（Pixiv API 不支持），满足 Venera 框架检测

### 收藏 & 关注

- **收藏**：书签标签→Venera 文件夹（`multiFolder: true`，始终含 `'Default'`），`loadFolders` 查询 `/v1/user/bookmark-tags/illust`，`addOrDelFavorite` POST 添加/删除书签，`loadComics` offset 分页加载
- **关注**：`likeComic` 忽略 Venera 的 `isLike` 参数，每次调用 `/v1/user/follow/detail` 查询实际状态再 toggle。默认私密关注（`restrict=private`）。`loadInfo` 通过 `/v1/user/follow/detail` 获取关注状态映射到 `isLiked`

### 认证

**PKCE WebView（主流程）**：IIFE 在解析时生成 `code_challenge` → `app-api.pixiv.net/web/v1/login?...&client=pixiv-android` → 服务器创建 PKCE 会话 → 重定向至 `accounts.pixiv.net/login` → OAuth 重定向链 → `callback?code=...` → `checkStatus` 捕获授权码 → `_exchangeAuthCode()` POST `/auth/token` 交换 token。

**手动流程**：`login(account, pwd)` 接受 `refresh_token` 作为 `account` 参数。

**关键经验**：
- `loginWithWebview.url` 必须在对象字面量中通过 IIFE 设置，不可在 `init()` 里设置
- `checkStatus` 仅匹配 `/auth/pixiv/callback?code=...`，宽泛匹配会损坏 PKCE verifier
- `/auth/token` 必须 `Content-Type: application/x-www-form-urlencoded`，`application/json` 会导致 `invalid_client`
- `code_verifier` 在 URL 生成与 token 交换之间不可重新生成

### 请求签名

所有 `app-api.pixiv.net` 请求必须携带：

| Header | 值 |
|--------|-----|
| `X-Client-Time` | UTC 时间 `yyyy-MM-dd'T'HH:mm:ss'+00:00'` |
| `X-Client-Hash` | `MD5(X-Client-Time + hashSecret)` 十六进制 |
| `User-Agent` | `PixivAndroidApp/5.0.166 (Android 10.0; Pixel C)` |
| `App-OS` / `App-OS-Version` | `Android` / `Android 10.0` |
| `App-Version` | `5.0.166` |
| `Authorization` | `Bearer {access_token}` |
| `Host` | `app-api.pixiv.net` |

Hash 密钥：`28c1fdd170a5204386cb1313c7077b34f83e4aaf4aa829ce78c231e05b0bae2c`

### Pixiv API 主机

| Host | 用途 |
|------|------|
| `app-api.pixiv.net` | REST API |
| `oauth.secure.pixiv.net` | OAuth token |
| `accounts.pixiv.net` | Web 登录 |
| `i.pximg.net` / `s.pximg.net` | 图片 CDN（需 `Referer` + UA） |

### 分页

Pixiv 使用 `next_url` 游标分页。响应中 `next_url`（相对路径）指向下一页，`null` 为最后一页。

## Venera API 注意事项

- **`Network.get/post/put/delete`**：返回 `{status, headers, body}`，`body` 为 UTF-8 字符串。二进制用 `fetchBytes`
- **`fetch`**：类浏览器包装器（≥1.2.0），返回 `{ok, status, json(), text(), arrayBuffer()}`
- **`HtmlDocument`**：HTML 解析器，用后必须 `.dispose()`
- **`Convert`**：哈希/编码/解密。关键：`Convert.md5()` 返回 `ArrayBuffer`，需 `hexEncode` 转十六进制
- **`this.loadData/saveData/deleteData`**：按源隔离的持久化键值存储
- **`this.loadSetting`**：读取 `settings` 块中的用户设置
- 抛出 `'Login expired'`（精确字符串）触发 App 自动重新登录
- **`this.translate(key)`**：`APP.locale` + `translation` 对象查找翻译
- **`ImageLoadingConfig`**：兼容旧版 App，创建普通对象而非用构造函数
