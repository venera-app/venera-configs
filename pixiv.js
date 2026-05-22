/** @type {import('./_venera_.js')} */
class Pixiv extends ComicSource {
    // ================================================================
    // WORK STATUS: 骨架已完成，等待填充 Pixiv API 实现
    // ================================================================
    //
    // TODO 清单:
    //
    // [ ] 1. 认证系统
    //     Pixiv 使用 OAuth2 (refresh_token / access_token)，
    //     也可通过 Cookie (PHPSESSID) 登录。
    //     选用方案: login 方法实现账号密码登录获取 token，
    //     loginWithCookies 保留作为备选。
    //
    // [ ] 2. 探索页 (explore)
    //     - 日榜/周榜/月榜/新人榜 (ranking API)
    //     - 关注画师新作 (followed illusts)
    //     - 推荐作品 (recommended)
    //
    // [ ] 3. 搜索 (search)
    //     - 关键词搜索 + 排序选项 (按热度/日期)
    //     - 支持按标签搜索 (partial_match_for_tags)
    //
    // [ ] 4. 分类浏览 (category/tags)
    //     - 热门标签列表
    //     - 按标签浏览作品
    //
    // [ ] 5. 作品详情 (comic.loadInfo)
    //     - 作品基本信息 (标题、画师、标签)
    //     - 多图作品/漫画分页 (page_count)
    //     - 收藏状态
    //
    // [ ] 6. 图片加载 (comic.loadEp / onImageLoad)
    //     - Pixiv 图片有 referer 防盗链保护
    //     - 需要特殊请求头
    //
    // [ ] 7. 收藏功能 (favorites)
    //     - 添加/删除书签
    //     - 公开/私有收藏
    //
    // [ ] 8. 设置 (settings)
    //     - 图片质量选择
    //     - 默认浏览模式
    //
    // [ ] 9. 翻译 (translation)
    //     - zh_CN / zh_TW / en
    //
    // ================================================================
    // Pixiv API 参考:
    //   认证: POST https://oauth.secure.pixiv.net/auth/token
    //   API 基址: https://app-api.pixiv.net
    //   图片: https://i.pximg.net
    //   Headers 需携带: Authorization: Bearer <token>
    //   User-Agent: PixivIOSApp/7.x (iOS 伪装)
    // ================================================================

    name = "Pixiv"
    key = "pixiv"
    version = "1.0.0"
    minAppVersion = "1.6.0"
    url = "https://cdn.jsdelivr.net/gh/venera-app/venera-configs@main/pixiv.js"

    // ---------- 内部工具方法 ----------

    // TODO: 实现 OAuth token 刷新逻辑
    getToken() {
        return this.loadData('access_token')
    }

    // TODO: 实现 base headers
    get headers() {
        let token = this.getToken()
        return {
            'Authorization': `Bearer ${token}`,
            'User-Agent': 'PixivIOSApp/7.13.3 (iOS 14.6; iPhone13,2)',
            'Accept-Language': 'zh-cn'
        }
    }

    // ---------- 认证 ----------

    account = {
        // TODO: 实现 Pixiv OAuth2 登录
        // login: async (account, pwd) => {
        //     1. POST https://oauth.secure.pixiv.net/auth/token
        //        body: client_id=xxx&client_secret=xxx&grant_type=password
        //              &username=<account>&password=<pwd>
        //     2. 保存 refresh_token, access_token, user_id 到本地
        //     3. return 'ok'
        // },
        login: async (account, pwd) => {

        },

        // 备选: Cookie 登录
        loginWithCookies: {
            fields: ["PHPSESSID"],
            // TODO: validate 用 PHPSESSID 请求用户信息验证 cookie 有效性
            validate: async (values) => {

            },
        },

        logout: () => {
            this.deleteData('access_token')
            this.deleteData('refresh_token')
            this.deleteData('user_id')
            Network.deleteCookies('https://www.pixiv.net')
        },

        registerWebsite: 'https://www.pixiv.net/signup/'
    }

    // ---------- 探索页 ----------

    explore = [
        {
            title: "Pixiv",
            type: "multiPartPage",

            // TODO: 加载日榜/周榜/推荐等分区
            load: async (page) => {
                /*
                示例结构:
                return [
                    { title: "Daily Ranking", comics: [...], viewMore: "..." },
                    { title: "Weekly Ranking", comics: [...], viewMore: "..." },
                    { title: "Recommended", comics: [...], viewMore: "..." }
                ]
                */
            },
        }
    ]

    // ---------- 分类/标签 ----------

    category = {
        title: "Pixiv",
        parts: [
            {
                name: "Tags",
                type: "dynamic",
                // TODO: 加载热门标签列表
                loader: async () => {
                    return []
                }
            }
        ],
        enableRankingPage: true,
    }

    categoryComics = {
        // TODO: 按标签/排名加载作品列表
        load: async (category, param, options, page) => {

        },
    }

    // ---------- 搜索 ----------

    search = {
        // TODO: 关键词搜索作品
        load: async (keyword, options, page) => {

        },

        // TODO: 搜索选项 (排序方式)
        optionList: [
            {
                type: "select",
                options: [
                    "date_desc-Newest",
                    "date_asc-Oldest",
                    "popular_desc-Most Popular"
                ],
                label: "Sort",
                default: "date_desc"
            }
        ],
    }

    // ---------- 收藏 ----------

    // TODO: 实现书签增删查
    // favorites = {
    //     multiFolder: false,
    //     addOrDelFavorite: async (comicId, folderId, isAdding, favoriteId) => {},
    //     loadFolders: async (comicId) => {},
    //     loadComics: async (page, folder) => {},
    // }

    // ---------- 作品详情 ----------

    comic = {
        // TODO: 加载作品详情 (标题/画师/标签/图片列表)
        loadInfo: async (id) => {
            /*
            返回 ComicDetails:
            new ComicDetails({
                title: "",
                subtitle: "",    // 画师名
                cover: "",       // 第一张图作为封面
                description: "",
                tags: {},
                chapters: new Map(),  // 多图作品每张图作为一个 chapter
            })
            */
        },

        // TODO: 加载作品图片
        loadEp: async (comicId, epId) => {
            /*
            单图: 直接返回原图 URL
            多图: epId 为页码，返回对应图片
            Pixiv 图片 URL 格式:
            https://i.pximg.net/img-original/img/YYYY/MM/DD/..._p0.png
            */
        },

        // TODO: 图片加载配置 (防盗链 header)
        onImageLoad: (url, comicId, epId) => {
            return {
                headers: {
                    'Referer': 'https://www.pixiv.net/',
                    'User-Agent': 'PixivIOSApp/7.13.3 (iOS 14.6; iPhone13,2)'
                }
            }
        },

        // TODO: 识别 pixiv URL 中的作品 ID
        idMatch: "^\\d+$",

        // TODO: 从 URL 解析作品 ID
        link: {
            domains: ['www.pixiv.net', 'pixiv.net'],
            linkToId: (url) => {
                // https://www.pixiv.net/artworks/12345678
                let match = url.match(/artworks\/(\d+)/)
                return match ? match[1] : null
            }
        },
    }

    // ---------- 设置 ----------

    settings = {
        // TODO: 图片质量设置
        // imageQuality: {
        //     title: "Image Quality",
        //     type: "select",
        //     options: [
        //         { value: "original", text: "Original" },
        //         { value: "regular", text: "Regular" }
        //     ],
        //     default: "original"
        // }
    }

    // ---------- 翻译 ----------

    translation = {
        'zh_CN': {},
        'zh_TW': {},
        'en': {}
    }
}
