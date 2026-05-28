# Pixiv API 文档

> 从 [PixEz](https://github.com/Notsfsssf/pixez-flutter) 项目逆向提取，基于 Pixiv Android App `v5.0.166` 的 API 协议。

---

## 目录

1. [基础信息](#1-基础信息)
2. [认证系统](#2-认证系统)
3. [请求规范](#3-请求规范)
4. [API 端点列表](#4-api-端点列表)
   - [插画相关](#41-插画相关)
   - [小说相关](#42-小说相关)
   - [用户相关](#43-用户相关)
   - [搜索相关](#44-搜索相关)
   - [收藏/书签相关](#45-收藏书签相关)
   - [评论相关](#46-评论相关)
   - [关注相关](#47-关注相关)
   - [排行榜相关](#48-排行榜相关)
   - [系列相关](#49-系列相关)
   - [追番/追漫相关](#410-追番追漫相关)
   - [Spotlight 相关](#411-spotlight-相关)
   - [账号管理相关](#412-账号管理相关)
   - [设置相关](#413-设置相关)
5. [图片 CDN 体系](#5-图片-cdn-体系)
6. [响应数据结构](#6-响应数据结构)
7. [枚举与常量](#7-枚举与常量)

---

## 1. 基础信息

| 项目 | 值 |
|------|-----|
| **主 API Host** | `https://app-api.pixiv.net` |
| **OAuth Host** | `https://oauth.secure.pixiv.net` |
| **账号管理 Host** | `https://accounts.pixiv.net` |
| **图片 CDN** | `i.pximg.net` / `s.pximg.net` |
| **User-Agent** | `PixivAndroidApp/5.0.166 (Android 10.0; Pixel C)` |
| **App-OS** | `Android` |
| **App-OS-Version** | `Android 10.0` |
| **App-Version** | `5.0.166` |
| **Content-Type (POST)** | `application/x-www-form-urlencoded` |

### X-Client 签名

所有请求都需要携带签名验证头：

```
X-Client-Time: 2024-01-01T00:00:00+00:00
X-Client-Hash: MD5(X-Client-Time + "28c1fdd170a5204386cb1313c7077b34f83e4aaf4aa829ce78c231e05b0bae2c")
```

时间格式：`yyyy-MM-dd'T'HH:mm:ss'+00:00'`（UTC 时间）

---

## 2. 认证系统

Pixiv 使用 **OAuth 2.0 Password Grant + PKCE** 两种认证方式。

### 2.1 OAuth 客户端凭证

```
CLIENT_ID:     "MOBrBDS8blbauoSck0ZfDbtuzpyT"
CLIENT_SECRET: "lsACyCD94FhDUtGTXi3QzcFE2uU1hqtDaKeqrdwj"
```

### 2.2 Password Grant 登录

**POST** `https://oauth.secure.pixiv.net/auth/token`

```json
{
  "client_id":     "MOBrBDS8blbauoSck0ZfDbtuzpyT",
  "client_secret": "lsACyCD94FhDUtGTXi3QzcFE2uU1hqtDaKeqrdwj",
  "grant_type":    "password",
  "username":      "用户账号或邮箱",
  "password":      "密码",
  "Device_token":  "pixiv",
  "get_secure_url": true,
  "include_policy": true
}
```

**响应示例：**
```json
{
  "response": {
    "access_token": "xxx",
    "expires_in": 3600,
    "token_type": "bearer",
    "scope": "",
    "refresh_token": "xxx",
    "user": {
      "profile_image_urls": {
        "px_16x16": "https://...",
        "px_50x50": "https://...",
        "px_170x170": "https://..."
      },
      "id": "123456",
      "name": "用户名",
      "account": "pixiv_account",
      "mail_address": "user@mail.com",
      "is_premium": false,
      "x_restrict": 0,
      "is_mail_authorized": true,
      "require_policy_agreement": false
    }
  }
}
```

### 2.3 PKCE + WebView 登录

用于通过内置浏览器完成第三方登录的流程：

1. **生成 Code Verifier**（128 字符随机串）：从字符集 `ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~` 随机生成 128 位。

2. **生成 Code Challenge**：
   ```
   code_challenge = Base64URL(SHA256(ASCII(code_verifier))).replaceAll('=', '')
   ```

3. **构建登录 URL**：
   ```
   https://app-api.pixiv.net/web/v1/login
     ?code_challenge={code_challenge}
     &code_challenge_method=S256
     &client=pixiv-android
   ```

4. **用户完成登录后，从回调 URL 提取 `code` 参数**

5. **用 code 换取 token**：使用下面的 `authorization_code` grant

### 2.4 Authorization Code Grant

**POST** `https://oauth.secure.pixiv.net/auth/token`

```json
{
  "code": "从WebView回调获取的code",
  "redirect_uri": "https://app-api.pixiv.net/web/v1/users/auth/pixiv/callback",
  "grant_type": "authorization_code",
  "include_policy": true,
  "client_id": "MOBrBDS8blbauoSck0ZfDbtuzpyT",
  "code_verifier": "第1步生成的code_verifier",
  "client_secret": "lsACyCD94FhDUtGTXi3QzcFE2uU1hqtDaKeqrdwj"
}
```

响应格式与 Password Grant 相同。

### 2.5 Refresh Token

**POST** `https://oauth.secure.pixiv.net/auth/token`

```json
{
  "client_id": "MOBrBDS8blbauoSck0ZfDbtuzpyT",
  "client_secret": "lsACyCD94FhDUtGTXi3QzcFE2uU1hqtDaKeqrdwj",
  "grant_type": "refresh_token",
  "refresh_token": "登录响应中的refresh_token",
  "include_policy": true
}
```

> **Token 失效判断**：当 API 返回 HTTP 400 且 `errors.error.message` 包含 `"OAuth"` 时，说明 access_token 已过期，应用应自动调用 refresh 流程重新获取 token。

---

## 3. 请求规范

### 3.1 全局请求头

所有 `app-api.pixiv.net` 请求必须携带：

| Header | 值 |
|--------|-----|
| `Authorization` | `Bearer {access_token}` |
| `X-Client-Time` | UTC 时间 `yyyy-MM-dd'T'HH:mm:ss'+00:00'` |
| `X-Client-Hash` | `MD5(X-Client-Time + hashSalt)` |
| `User-Agent` | `PixivAndroidApp/5.0.155 (Android 10.0; Pixel C)` |
| `Accept-Language` | `zh-CN`（可自定义） |
| `App-OS` | `Android` |
| `App-OS-Version` | `Android 10.0` |
| `App-Version` | `5.0.166` |
| `Host` | `app-api.pixiv.net` |

### 3.2 filter 参数

大多数请求显式指定 `filter=for_android` 或 `filter=for_ios`。这会返回适配相应平台的响应格式。

### 3.3 分页机制

API 不提供传统 `page` / `limit` 分页。响应中可能包含：

- **`next_url`** 字段：下一页请求的完整 URL（相对于 baseUrl）。用此 URL 发起 GET 请求即获取下一页数据。
- **`offset`** 参数：部分端点支持 `offset` 进行分页。

### 3.4 缓存策略

代码中使用 `DioCacheInterceptor` 进行响应缓存，不同端点使用不同的 stale time：
- 首页推荐：2 分钟
- 插画详情：默认策略（请求优先）
- 排行榜：强制刷新

建议在自己实现时根据业务需要设置 HTTP 缓存头。

---

## 4. API 端点列表

> 以下所有 `app-api.pixiv.net` 端点使用 `GET` 方法，除非特别标注 `POST`。
> 显式含有 `?filter=for_android` 的路径在代码中是追加到 URL 中的，此处已合并。

---

### 4.1 插画相关

#### 获取首页推荐插画

```
GET /v1/illust/recommended?filter=for_ios&include_ranking_label=true
```

返回插画推荐流，包含 `next_url` 用于分页。

#### 获取漫画推荐

```
GET /v1/manga/recommended?filter=for_ios&include_ranking_label=true
```

#### 获取插画详情

```
GET /v1/illust/detail?filter=for_android
```

**参数：**
| 参数 | 类型 | 说明 |
|------|------|------|
| `illust_id` | int | 插画 ID |

**响应结构要点：**
```json
{
  "illust": {
    "id": 12345678,
    "title": "作品标题",
    "type": "illust",          // "illust" | "manga" | "ugoira"
    "image_urls": {
      "square_medium": "https://i.pximg.net/...",
      "medium": "https://i.pximg.net/...",
      "large": "https://i.pximg.net/..."
    },
    "caption": "<html>说明文字</html>",
    "restrict": 0,              // 0=公开 1=非公开
    "x_restrict": 0,            // 0=全年龄 1=R-18
    "sanity_level": 2,          // 安全等级 0-6
    "user": { ... },
    "tags": [{"name": "标签", "translated_name": "翻译"}],
    "page_count": 1,
    "meta_single_page": {
      "original_image_url": "https://i.pximg.net/..."
    },
    "meta_pages": [
      {
        "image_urls": {
          "medium": "https://...",
          "large": "https://...",
          "original": "https://..."
        }
      }
    ],
    "total_view": 12345,
    "total_bookmarks": 678,
    "total_comments": 90,
    "is_bookmarked": false,
    "illust_ai_type": 1,       // 1=非AI 2=AI生成
    "illust_book_style": 0,
    "create_date": "2024-01-01T00:00:00+09:00"
  }
}
```

#### 获取关联插画

```
GET /v2/illust/related?filter=for_android
```

**参数：** `illust_id` (int)

#### 获取插画收藏详情

```
GET /v2/illust/bookmark/detail
```

**参数：** `illust_id` (int)

返回：`{ "bookmark_detail": { "is_bookmarked": bool, "tags": [...], "restrict": "public"/"private" } }`

#### 获取插画收藏标签列表

```
GET /v1/user/bookmark-tags/illust
```

**参数：** `user_id` (int), `restrict` (string, 默认 `"public"`)

返回：`{ "bookmark_tags": [{"name": "标签名", "count": 123}], "next_url": "..." }`

#### 获取动图 (Ugoira) 元数据

```
GET /v1/ugoira/metadata
```

**参数：** `illust_id` (int)

**响应：**
```json
{
  "ugoira_metadata": {
    "zip_urls": {
      "medium": "https://i.pximg.net/img-zip-ugoira/img/...ugoira600x600.zip"
    },
    "frames": [
      {"file": "000000.jpg", "delay": 40},
      {"file": "000001.jpg", "delay": 60}
    ]
  }
}
```

动图是下载 ZIP 文件后按帧序列 + 延迟时间播放。

#### 获取新手引导插画

```
GET /v1/walkthrough/illusts
```

无需 Authorization 头，用于未登录状态下展示。

#### 获取插画系列信息

```
GET /v1/illust/series
```

**参数：** `illust_series_id` (int)

#### 通过插画 ID 查所属系列

```
GET /v1/illust-series/illust
```

**参数：** `illust_id` (int)

---

### 4.2 小说相关

#### 首页小说推荐

```
GET /v1/novel/recommended?include_privacy_policy=true&filter=for_android&include_ranking_novels=true
```

#### 小说详情

```
GET /v2/novel/detail
```

**参数：** `novel_id` (int)

#### 小说正文

```
GET /v1/novel/text
```

**参数：** `novel_id` (int)

#### WebView 版小说页面

```
GET /webview/v2/novel
```

**参数：** `id` (int)

#### 关注用户的小说作品（时间线）

```
GET /v1/novel/follow
```

**参数：** `restrict` (string, `"public"` / `"private"` / `"all"`)

#### 获取用户的小说列表

```
GET /v1/user/novels?filter=for_android
```

**参数：** `user_id` (int)

---

### 4.3 用户相关

#### 用户详情

```
GET /v1/user/detail?filter=for_android
```

**参数：** `user_id` (int)

响应包含用户资料、统计数据等。

#### 推荐用户

```
GET /v1/user/recommended?filter=for_android
```

#### 获取用户插画作品

```
GET /v1/user/illusts?filter=for_android
```

**参数：**
| 参数 | 类型 | 说明 |
|------|------|------|
| `user_id` | int | 用户 ID |
| `type` | string | `"illust"` / `"manga"` |
| `offset` | int? | 分页偏移量（可选） |

#### 获取用户收藏的插画

```
GET /v1/user/bookmarks/illust
```

**参数：**
| 参数 | 类型 | 说明 |
|------|------|------|
| `user_id` | int | 用户 ID |
| `restrict` | string | `"public"` / `"private"` |
| `tag` | string? | 按收藏标签过滤 |
| `offset` | int? | 分页偏移量 |

#### 获取用户收藏的小说

```
GET /v1/user/bookmarks/novel
```

**参数：** `user_id` (int), `restrict` (string)

---

### 4.4 搜索相关

#### 搜索插画

```
GET /v1/search/illust
```

**参数：**
| 参数 | 类型 | 说明 |
|------|------|------|
| `word` | string | 搜索关键词 |
| `filter` | string | `"for_android"` 或 `"for_ios"` |
| `sort` | string? | `"date_desc"`（最新）/ `"date_asc"`（最旧）/ `"popular_desc"`（最热） |
| `search_target` | string? | `"partial_match_for_tags"`（标签部分匹配）/ `"exact_match_for_tags"` / `"title_and_caption"` |
| `search_ai_type` | int? | `1`=排除AI / `2`=仅AI（推测） |
| `start_date` | string? | 起始日期 `yyyy-M-d` |
| `end_date` | string? | 结束日期 `yyyy-M-d` |
| `bookmark_num_min` | int? | 最少收藏数 |
| `bookmark_num_max` | int? | 最多收藏数 |
| `merge_plain_keyword_results` | bool | `true` |

#### 搜索小说

```
GET /v1/search/novel?filter=for_android&merge_plain_keyword_results=true
```

**参数：**
| 参数 | 类型 | 说明 |
|------|------|------|
| `word` | string | 搜索关键词 |
| `sort` | string? | 排序方式 |
| `search_target` | string? | 搜索目标 |
| `start_date` / `end_date` | string? | 日期范围 `yyyy-M-d` |
| `bookmark_num` | int? | 最少收藏数 |

#### 搜索用户

```
GET /v1/search/user?filter=for_android
```

**参数：** `word` (string)

#### 搜索自动完成

```
GET /v2/search/autocomplete?merge_plain_keyword_results=true
```

**参数：** `word` (string)

返回自动补全建议列表（标签、关键词），数据结构：`{ "tags": [{"name": "...", "translated_name": "..."}] }`

#### 热门预览搜索

```
GET /v1/search/popular-preview/illust?filter=for_android&include_translated_tag_results=true&merge_plain_keyword_results=true&search_target=partial_match_for_tags
```

**参数：** `word` (string)

---

### 4.5 收藏/书签相关

#### 添加插画收藏

```
POST /v2/illust/bookmark/add
```

**参数（form-urlencoded）：**
| 参数 | 类型 | 说明 |
|------|------|------|
| `illust_id` | int | 插画 ID |
| `restrict` | string | `"public"` / `"private"` |
| `tags[]` | string? | 收藏标签，多个用空格分隔，如 `"标签A 标签B"` |

#### 取消插画收藏

```
POST /v1/illust/bookmark/delete
```

**参数：** `illust_id` (int)

#### 添加小说收藏

```
POST /v2/novel/bookmark/add
```

**参数：** `novel_id` (int), `restrict` (string)

#### 取消小说收藏

```
POST /v1/novel/bookmark/delete
```

**参数：** `novel_id` (int)

---

### 4.6 评论相关

#### 获取插画评论

```
GET /v3/illust/comments
```

**参数：** `illust_id` (int)

#### 获取小说评论

```
GET /v3/novel/comments
```

**参数：** `novel_id` (int)

#### 获取评论回复

```
GET /v2/illust/comment/replies
GET /v2/novel/comment/replies
```

**参数：** `comment_id` (int)

#### 发表插画评论

```
POST /v1/illust/comment/add
```

**参数：**
| 参数 | 类型 | 说明 |
|------|------|------|
| `illust_id` | int | 插画 ID |
| `comment` | string | 评论内容 |
| `parent_comment_id` | int? | 若是回复某条评论，传其 ID |

#### 发表小说评论

```
POST /v1/novel/comment/add
```

**参数：**
| 参数 | 类型 | 说明 |
|------|------|------|
| `novel_id` | int | 小说 ID |
| `comment` | string | 评论内容 |
| `parent_comment_id` | int? | 回复评论 ID |

---

### 4.7 关注相关

#### 关注用户

```
POST /v1/user/follow/add
```

**参数：** `user_id` (int), `restrict` (string, `"public"` / `"private"`)

#### 取消关注用户

```
POST /v1/user/follow/delete
```

**参数：** `user_id` (int)

#### 获取关注详情

```
GET /v1/user/follow/detail
```

**参数：** `user_id` (int)

返回：`{ "follow_detail": { "is_followed": bool, "restrict": "public"/"private" } }`

#### 获取粉丝列表

```
GET /v1/user/follower?filter=for_android
```

**参数：** `user_id` (int), `restrict` (string)

#### 获取关注中列表

```
GET /v1/user/following?filter=for_android
```

**参数：** `user_id` (int), `restrict` (string)

#### 获取关注用户的插画时间线

```
GET /v2/illust/follow
```

**参数：** `restrict` (string)

---

### 4.8 排行榜相关

#### 插画排行榜

```
GET /v1/illust/ranking?filter=for_android
```

**参数：**
| 参数 | 类型 | 说明 |
|------|------|------|
| `mode` | string | `"day"` / `"week"` / `"month"` / `"day_male"` / `"day_female"` / `"week_original"` / `"week_rookie"` / `"day_manga"` 等 |
| `date` | string? | 指定日期 `yyyy-MM-dd`（可选，不传为当天） |

#### 小说排行榜

```
GET /v1/novel/ranking?filter=for_android
```

**参数：** `mode` (string), `date` (string?)

#### 热门标签（插画）

```
GET /v1/trending-tags/illust?filter=for_android
```

#### 热门标签（小说）

```
GET /v1/trending-tags/novel?filter=for_android
```

---

### 4.9 系列相关

#### 小说系列详情

```
GET /v2/novel/series
```

**参数：** `series_id` (int/string)

---

### 4.10 追番/追漫相关

#### 追漫列表

```
GET /v1/watchlist/manga
```

#### 追漫添加

```
POST /v1/watchlist/manga/add
```

**参数：** `series_id` (int)

#### 追漫删除

```
POST /v1/watchlist/manga/delete
```

**参数：** `series_id` (int)

#### 追小说列表

```
GET /v1/watchlist/novel
```

#### 追小说添加

```
POST /v1/watchlist/novel/add
```

**参数：** `series_id` (string)

#### 追小说删除

```
POST /v1/watchlist/novel/delete
```

**参数：** `series_id` (string)

---

### 4.11 Spotlight 相关

Pixivision 精选文章。

```
GET /v1/spotlight/articles?filter=for_android
```

**参数：** `category` (string, 分类标识)

**响应：**
```json
{
  "spotlight_articles": [
    {
      "id": 123,
      "title": "标题",
      "pure_title": "纯文本标题",
      "thumbnail": "https://...",
      "article_url": "https://www.pixiv.net/...",
      "publish_date": "2024-01-01T00:00:00+09:00"
    }
  ],
  "next_url": "..."
}
```

---

### 4.12 账号管理相关

Host: `https://accounts.pixiv.net`

#### 创建临时账号

```
POST /api/provisional-accounts/create
```

**请求头：** `Authorization: Bearer l-f9qZ0ZyqSwRyZs8-MymbtWBbSxmCu1pmbOlyisou8`（固定值）

**参数：**
| 参数 | 类型 | 说明 |
|------|------|------|
| `user_name` | string | 用户名 |
| `ref` | string | 固定 `"pixiv_android_app_provisional_account"` |

#### 修改账号信息

```
POST /api/account/edit
```

**请求头：** `Authorization: Bearer {access_token}`

**参数（全部可选）：**
| 参数 | 类型 | 说明 |
|------|------|------|
| `new_mail_address` | string? | 新邮箱 |
| `new_user_account` | string? | 新用户 ID（pixiv id） |
| `current_password` | string | 当前密码 |
| `new_password` | string? | 新密码 |

---

### 4.13 设置相关

#### 获取 AI 显示设置

```
GET /v1/user/ai-show-settings
```

#### 修改 AI 显示设置

```
POST /v1/user/ai-show-settings/edit
```

**参数：** `show_ai` (bool)

#### 获取受限模式设置

```
GET /v1/user/restricted-mode-settings
```

返回：`{ "is_restricted_mode_enabled": true/false }`

#### 修改受限模式设置

```
POST /v1/user/restricted-mode-settings
```

**参数：** `is_restricted_mode_enabled` (bool)

---

## 5. 图片 CDN 体系

### 5.1 图片域名

| Host | 用途 |
|------|------|
| `i.pximg.net` | 主图片 CDN（插画原图、缩略图、头像、动图 ZIP 等） |
| `s.pximg.net` | 辅助图片 CDN（较少使用） |

### 5.2 图片 URL 结构

Pixiv 插画图片 URL 遵循固定的路径模式：

```
https://i.pximg.net/img-original/img/{year}/{month}/{day}/{hour}/{minute}/{sec}/{user_id}_p{page}.{ext}
https://i.pximg.net/img-master/img/{date_path}/{illust_id}_p0_master1200.jpg
https://i.pximg.net/img-zip-ugoira/img/{date_path}/{illust_id}_ugoira600x600.zip
```

### 5.3 图片质量/尺寸变体

每个插画页面的 `image_urls` 提供以下尺寸：

| 字段 | 说明 | 典型尺寸 |
|------|------|----------|
| `square_medium` | 方形缩略图 | ~540x540 |
| `medium` | 中等尺寸 | ~540px 宽 |
| `large` | 大尺寸 | ~600px 宽 |

`meta_pages` 中的每个页面额外提供 `original` 字段指向原图。

### 5.4 下载图片所需的请求头

```
Referer: https://app-api.pixiv.net/
User-Agent: PixivIOSApp/5.8.0
```

> **注意**：直接访问 `i.pximg.net` 在某些网络环境下可能被屏蔽（DNS 污染/SNI 阻断）。原项目使用自定义 DNS 解析（硬编码 IP `210.140.139.133`）+ ECH（Encrypted Client Hello）来绕过限制。

### 5.5 图片代理/反代

原项目支持配置自定义图片代理域名来替代直接访问 `i.pximg.net`。例如配置 `pixiv.re` 作为反代：

- 原 URL：`https://i.pximg.net/img-original/...`
- 代理后：`https://i.pixiv.re/img-original/...`

URL 重写规则：将原 host 替换为代理 host，路径保持不变。

---

## 6. 响应数据结构

### 6.1 分页响应通用结构

多数列表类 API 返回以下结构：

```json
{
  "illusts": [ /* ... */ ],   // 数据数组
  "novels": [ /* ... */ ],
  "users": [ /* ... */ ],
  "next_url": "/v1/...?参数"   // 下一页 URL 或 null
}
```

### 6.2 插画 (Illust) 对象

```
Illusts {
  id: int,
  title: string,
  type: "illust" | "manga" | "ugoira",
  image_urls: ImageUrls,
  caption: string (HTML),
  restrict: int (0=公开, 1=私密),
  x_restrict: int (0=一般, 1=R-18),
  sanity_level: int (0-6),
  user: User,
  tags: [Tags],
  tools: [string],
  create_date: string (ISO 8601),
  page_count: int,
  width: int,
  height: int,
  total_view: int,
  total_bookmarks: int,
  total_comments: int?,
  is_bookmarked: bool,
  visible: bool,
  is_muted: bool,
  illust_ai_type: int (1=非AI, 2=AI),
  illust_book_style: int,
  meta_single_page: { original_image_url: string },
  meta_pages: [MetaPages],
  series: { id: int, title: string }?
}
```

### 6.3 用户 (User) 对象

```
{
  id: int,
  name: string,
  account: string (pixiv ID),
  profile_image_urls: {
    medium: string
  },
  is_followed: bool?,
  comment: string?
}
```

### 6.4 标签 (Tags) 对象

```
{
  name: string,
  translated_name: string?  // 翻译后的标签名
}
```

### 6.5 错误响应

```json
{
  "error": {
    "user_message": "面向用户的提示信息",
    "message": "OAuth error / Rate limit ...",
    "reason": "...",
    "user_message_details": {}
  }
}
```

常见错误类型：
- **OAuth 错误** → access_token 过期，需刷新
- **Limit** → 频率限制，稍后重试
- `Connection closed before full header was received` → 网络中断，自动重试（最多 2 次）

---

## 7. 枚举与常量

### 7.1 restrict（可见性/限制）

| 值 | 含义 |
|----|------|
| `"public"` | 公开 |
| `"private"` | 私密 |

### 7.2 type（作品类型）

| 值 | 含义 |
|----|------|
| `"illust"` | 插画 |
| `"manga"` | 漫画 |
| `"ugoira"` | 动图 |
| `"novel"` | 小说 |

### 7.3 排行榜 mode

| 值 | 说明 |
|----|------|
| `"day"` | 每日综合 |
| `"week"` | 每周综合 |
| `"month"` | 每月综合 |
| `"day_male"` | 每日男性向 |
| `"day_female"` | 每日女性向 |
| `"week_original"` | 每周原创 |
| `"week_rookie"` | 每周新人 |
| `"day_manga"` | 每日漫画 |
| `"day_r18"` | 每日 R-18 |

### 7.4 搜索 sort

| 值 | 说明 |
|----|------|
| `"date_desc"` | 按日期降序（最新） |
| `"date_asc"` | 按日期升序（最旧） |
| `"popular_desc"` | 按热门度降序 |

### 7.5 搜索 search_target

| 值 | 说明 |
|----|------|
| `"partial_match_for_tags"` | 标签部分匹配 |
| `"exact_match_for_tags"` | 标签精确匹配 |
| `"title_and_caption"` | 标题及说明文字 |

### 7.6 illust_ai_type（AI 类型）

| 值 | 含义 |
|----|------|
| `1` | 非 AI 作品 |
| `2` | AI 生成作品 |

### 7.7 sanity_level（安全等级）

| 值 | 含义 |
|----|------|
| `0-2` | 全年龄 |
| `3-4` | 轻微敏感 |
| `5-6` | R-18 级别 |

### 7.8 x_restrict

| 值 | 含义 |
|----|------|
| `0` | 全年龄/一般向 |
| `1` | R-18 成人向 |

---

## 附录 A：DNS 硬编码 IP

原项目为解决 DNS 污染问题，硬编码了以下 IP 地址（来自 Cloudflare DoH `doh.dns.sb` 解析结果）：

| Host | IP |
|------|----|
| `app-api.pixiv.net` | `210.140.139.155` |
| `oauth.secure.pixiv.net` | `210.140.139.155` |
| `i.pximg.net` | `210.140.139.133` |
| `s.pximg.net` | `210.140.139.133` |

> **注意**：这些 IP 随时可能变化，建议使用自己的 DNS 解析或 DoH 服务实时获取。

## 附录 B：网络绕过方式

原项目使用 Rust HTTP 客户端 `rhttp` 实现以下绕过：
1. **ECH (Encrypted Client Hello)**：防止 SNI 被识别
2. **自定义 DNS**：绕过 DNS 污染，直接返回正确 IP
3. **TLS 证书验证关闭**：`verifyCertificates: false`

在不使用绕过的情况下（设置 `disableBypassSni=true`），使用标准 HTTPS 连接即可。

## 附录 C：完整的 Pixiv API Host 列表

| 用途 | Host |
|------|------|
| REST API | `app-api.pixiv.net` |
| OAuth 认证 | `oauth.secure.pixiv.net` |
| 账号管理 | `accounts.pixiv.net` |
| 主图片 CDN | `i.pximg.net` |
| 辅助图片 CDN | `s.pximg.net` |
| Web 页面 | `www.pixiv.net` |
| 短链接 | `pixiv.me` |
| Pixivision 文章 | `pixivision.net` |

---

> **文档版本**：基于 PixEz Flutter v1.9.81 源码提取  
> **最后更新**：2026-05-22
