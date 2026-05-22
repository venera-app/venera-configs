# venera-configs

个人 fork，加入 Pixiv 漫画源。

## Pixiv 源 (`pixiv.js`)

已实现完整功能：

- [x] 登录 — refresh_token OAuth2 认证，支持 PHPSESSID Cookie 备用登录
- [x] 探索 — 关注动态 / 日榜 / 周榜 / 推荐 / 最新作品
- [x] 分类 — 7种排行模式 + 热门标签浏览
- [x] 搜索 — 关键词/标签搜索，支持排序与搜索目标切换
- [x] 作品详情 — 标题/画师/标签/多页分章，Referer 防盗链
- [x] 收藏 — 添加/删除/查看 Pixiv 书签
- [x] 关注画师动态 — 探索页与分类页均可访问，未登录自动隐藏
- [x] 设置 — 可切换 API 地址（代理）和图片质量

### 已知限制

- Ugoira 动图视为普通图片（未调用 ugoira_metadata API）
- "最新作品"分区仅首页（Pixiv 该 API 使用游标分页）
- 多图作品仅 Large 尺寸（API `meta_pages` 无原图字段）
- 小说功能未实现

### API 参考

`pixivpy/` 目录包含 pixivpy3 Python 库源码，用于 Pixiv App-API 参考。
仅在实现 JS 源时查阅，不影响运行时。

## 如何添加新源

1. 复制 `_template_.js`，重命名为 `your_config_name.js`
2. 编辑源文件 —— `_template_.js` 含完整注释，`_venera_.js` 提供 IDE 代码补全
3. 在 `index.json` 中注册新源（name / fileName / key / version）
4. 确保 `url` 字段指向 `https://cdn.jsdelivr.net/gh/theoldman-lab/venera-configs@main/<filename>.js`
5. 推送到 `main` 分支，GitHub Actions 自动刷新 jsDelivr CDN 缓存
