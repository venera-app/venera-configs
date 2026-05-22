# venera-configs

Venera 漫画阅读器插件仓库，加入 Pixiv 漫画源。

## Pixiv 源 (`pixiv.js`) — v1.2.2

### 已实现

| 功能 | 说明 |
|------|------|
| 登录 | Webview OAuth 2.0（自动提取 refresh_token）+ 手动输入 refresh_token 备用 |
| Token 管理 | 自动刷新（HTTP 400 + `OAuth` 错误触发，与 Pixiv 官方客户端一致） |
| 探索页 | 关注动态 / 日榜 / 周榜 / 推荐 / 最新作品，5 分区并行加载 |
| 分类浏览 | 9 种排行（日/周/月/男性向/女性向/新人/原创/R-18）+ 动态热门标签 |
| 搜索 | 关键词/标签搜索，支持排序（最新/最旧/最热）和搜索目标切换 |
| 作品详情 | 标题/画师/标签/多页分章，点击标签/作者跳转搜索 |
| 图片加载 | Referer + UA 防盗链，大图/原图可切换，缩略图独立配置 |
| 评论 | 浏览（多页自动合并）+ 发表评论 + 回复 |
| 收藏 | 添加/删除 Pixiv 书签 |
| 设置 | API 地址（代理）、图片质量、评论加载页数 |
| 多语言 | zh_CN / zh_TW / en（24 个 UI 字符串） |

### 已知限制

- Ugoira 动图视为普通图片
- `v1/illust/new` 仅首页（Pixiv 使用 `max_illust_id` 游标分页，不支持 offset）
- 多图作品每页为独立 Chapter，无法同时查看所有页
- Pixiv 书签标签无法作为文件夹管理（`multiFolder` 关闭）
- 小说功能未实现

### API 参考

- `pixez-flutter/PIXIV_API.md` — Pixiv API 完整文档（50+ 端点、认证流程、图片 CDN、数据结构）
- `pixez-flutter/` — PixEz Flutter 项目的 API 层提取代码（Dart，仅作参考）

### 请求签名（关键）

Pixiv API 要求每个请求携带 `X-Client-Time` + `X-Client-Hash`（MD5），缺一不可：

```
X-Client-Time: 2026-01-01T00:00:00+00:00
X-Client-Hash: md5(X-Client-Time + "28c1fdd170a5204386cb1313c7077b34f83e4aaf4aa829ce78c231e05b0bae2c")
```

Token 过期时返回 **HTTP 400**（非 401），响应体 `error.message` 包含 `"OAuth"`。

## 如何添加新源

1. 复制 `_template_.js`，重命名为 `your_config_name.js`
2. 编辑源文件 —— `_template_.js` 含完整注释，`_venera_.js` 提供 IDE 代码补全
3. 在 `index.json` 中注册新源（name / fileName / key / version）
4. 确保 `url` 字段指向 `https://cdn.jsdelivr.net/gh/theoldman-lab/venera-configs@main/<filename>.js`
5. 推送到 `main` 分支，GitHub Actions 自动刷新 jsDelivr CDN 缓存
