# venera-configs

Venera 漫画阅读器插件仓库，提供 Pixiv 漫画源。

## Pixiv 源 (`pixiv.js`) — v2.0.0

基于 PixEz Flutter 项目的 API 层完全重写。

### 已实现

| 功能 | 说明 |
|------|------|
| 登录 | WebView 打开 `accounts.pixiv.net/login`，自动提取 localStorage 中的 `refresh_token`，通过 `/auth/token` 交换 `access_token` |
| Token 管理 | 自动刷新（HTTP 400 + `OAuth` 错误触发，与 Pixiv 官方客户端一致） |
| 探索页 | 关注动态（`/v2/illust/follow?restrict=all`），`next_url` 游标分页 |
| 作品详情 | 标题/画师/多页分章，原图/大图加载 |
| 图片加载 | `Referer` + `User-Agent` 头（Pixiv 图片 CDN 要求） |

### 待实现

| 功能 |
|------|
| 搜索 |
| 收藏/书签 |
| 评论 |
| 排行榜 |
| 热门标签 |
| 小说支持 |

### 登录方式

1. **主流程**：Venera 内置浏览器打开 Pixiv 网页登录 → 登录成功后 localStorage 中的 `refresh_token` 被自动捕获 → 下次 API 调用时交换 `access_token`
2. **备用流程**：手动粘贴 `refresh_token` 到账号输入框 → 直接调用 `/auth/token` 交换

### API 参考

- `PIXIV_API.md` — Pixiv API 完整文档（50+ 端点、认证流程、图片 CDN、数据结构）
- `pixez/` — PixEz Flutter 项目的 API 层提取代码（Dart，仅作参考）

### 请求签名（关键）

Pixiv API 要求每个请求携带 `X-Client-Time` + `X-Client-Hash`（MD5），缺一不可：

```
X-Client-Time: 2026-01-01T00:00:00+00:00
X-Client-Hash: md5(X-Client-Time + "28c1fdd170a5204386cb1313c7077b34f83e4aaf4aa829ce78c231e05b0bae2c")
```

Token 过期时返回 **HTTP 400**（非 401），响应体 `error.message` 包含 `"OAuth"`。

## 如何添加新源

1. 复制 `_template_.js`，重命名为 `your_config_name.js`
2. 编辑源文件 — `_template_.js` 含完整注释，`_venera_.js` 提供 IDE 代码补全
3. 在 `index.json` 中注册新源（name / fileName / key / version）
4. 确保 `url` 字段指向 `https://cdn.jsdelivr.net/gh/theoldman-lab/venera-configs@main/<filename>.js`
5. 推送到 `main` 分支，GitHub Actions 自动刷新 jsDelivr CDN 缓存
