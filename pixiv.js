/** @type {import('./_venera_.js')} */
class Pixiv extends ComicSource {

    name = "Pixiv"
    key = "pixiv"
    version = "1.2.2"
    minAppVersion = "1.6.0"
    url = "https://cdn.jsdelivr.net/gh/theoldman-lab/venera-configs@main/pixiv.js"

    // ---- Constants ----
    static authUrl = "https://oauth.secure.pixiv.net/auth/token"
    static clientId = "MOBrBDS8blbauoSck0ZfDbtuzpyT"
    static clientSecret = "lsACyCD94FhDUtGTXi3QzcFE2uU1hqtDaKeqrdwj"
    static hashSecret = "28c1fdd170a5204386cb1313c7077b34f83e4aaf4aa829ce78c231e05b0bae2c"
    static ua = "PixivIOSApp/7.13.3 (iOS 14.6; iPhone13,2)"

    get apiBase() {
        return this.loadSetting('apiHost') || 'https://app-api.pixiv.net'
    }

    // ===========================================================
    //  AUTH HEADERS — 每次请求独立生成
    //  X-Client-Time / X-Client-Hash 是 Pixiv 必须的签名头,
    //  缺一不可, 否则 API 返回 4xx
    // ===========================================================

    /**
     * 生成基础请求头 (不含 Authorization)
     */
    getSignHeaders() {
        let d = new Date()
        let time = d.toISOString().replace(/\.\d+Z$/, '+00:00')
        let hash = Convert.hexEncode(Convert.md5(Convert.encodeUtf8(time + Pixiv.hashSecret)))
        return {
            'X-Client-Time': time,
            'X-Client-Hash': hash,
            'User-Agent': Pixiv.ua,
            'App-OS': 'ios',
            'App-OS-Version': '14.6',
            'App-Version': '5.0.166',
            'Accept-Language': 'zh-cn'
        }
    }

    /**
     * API 请求头 (含 Authorization + Host 头, 每次重新计算签名)
     */
    getApiHeaders() {
        let token = this.loadData('access_token')
        if (!token) return null
        let h = this.getSignHeaders()
        h['Authorization'] = 'Bearer ' + token
        h['Host'] = 'app-api.pixiv.net'
        return h
    }

    /**
     * POST 请求头 (含 Content-Type)
     */
    getPostHeaders() {
        let h = this.getApiHeaders()
        if (!h) return null
        h['Content-Type'] = 'application/x-www-form-urlencoded'
        return h
    }

    // ===========================================================
    //  TOKEN 管理
    // ===========================================================

    async refreshToken() {
        let refreshToken = this.loadData('refresh_token')
        if (!refreshToken) throw 'No refresh token'

        let body = `client_id=${Pixiv.clientId}`
            + `&client_secret=${Pixiv.clientSecret}`
            + `&grant_type=refresh_token`
            + `&refresh_token=${encodeURIComponent(refreshToken)}`
            + `&get_secure_url=1`
            + `&include_policy=true`

        let res = await Network.post(Pixiv.authUrl, this.getSignHeaders(), body)
        if (res.status !== 200) throw `Token refresh failed: HTTP ${res.status}`

        let json = JSON.parse(res.body)
        let resp = json.response
        this.saveData('access_token', resp.access_token)
        this.saveData('refresh_token', resp.refresh_token)
        this.saveData('user_id', resp.user.id.toString())
        this.saveData('user_name', resp.user.name)
        this.saveData('user_account', resp.user.account)
        return resp.access_token
    }

    /**
     * 用 pending_refresh_token 换 access_token
     * (来自 Webview 登录的延迟交换)
     */
    async exchangeWebviewToken() {
        let token = this.loadData('pending_refresh_token')
        if (!token) return false
        this.deleteData('pending_refresh_token')
        try {
            let body = `client_id=${Pixiv.clientId}`
                + `&client_secret=${Pixiv.clientSecret}`
                + `&grant_type=refresh_token`
                + `&refresh_token=${encodeURIComponent(token)}`
                + `&get_secure_url=1`
                + `&include_policy=true`
            let res = await Network.post(Pixiv.authUrl, this.getSignHeaders(), body)
            if (res.status !== 200) return false
            let json = JSON.parse(res.body)
            this.saveData('access_token', json.response.access_token)
            this.saveData('refresh_token', json.response.refresh_token)
            this.saveData('user_id', json.response.user.id.toString())
            this.saveData('user_name', json.response.user.name)
            this.saveData('user_account', json.response.user.account)
            return true
        } catch (e) {
            return false
        }
    }

    // ===========================================================
    //  HTTP 封装 (带 OAuth 400/401 自动刷新)
    //
    //  Pixiv API 在 token 过期时返回 HTTP 400 (非 401),
    //  响应体 error.message 包含 "OAuth" 字样。
    //  参考 PixEz RefreshTokenInterceptor。
    // ===========================================================

    /**
     * 判断 HTTP 响应是否因 OAuth token 过期失败
     */
    _isOAuthError(res) {
        if (!res) return false
        if (res.status === 400 || res.status === 401) {
            try {
                let json = JSON.parse(res.body)
                let msg = json?.error?.message || json?.errors?.system?.message || ''
                if (msg.indexOf('OAuth') !== -1) return true
            } catch (e) {}
            // 无 body 可解析时, 401 也视为需要刷新
            if (res.status === 401) return true
        }
        return false
    }

    async apiGet(url) {
        if (this.loadData('pending_refresh_token')) {
            await this.exchangeWebviewToken()
        }
        let headers = this.getApiHeaders()
        if (!headers) throw 'Login expired'
        let res = await Network.get(url, headers)
        if (this._isOAuthError(res)) {
            await this.refreshToken()
            headers = this.getApiHeaders()
            res = await Network.get(url, headers)
        }
        if (res.status !== 200) throw `HTTP ${res.status}`
        return JSON.parse(res.body)
    }

    async apiPost(url, body) {
        if (this.loadData('pending_refresh_token')) {
            await this.exchangeWebviewToken()
        }
        let headers = this.getPostHeaders()
        if (!headers) throw 'Login expired'
        let res = await Network.post(url, headers, body)
        if (this._isOAuthError(res)) {
            await this.refreshToken()
            headers = this.getPostHeaders()
            res = await Network.post(url, headers, body)
        }
        if (res.status !== 200) throw `HTTP ${res.status}`
        return JSON.parse(res.body)
    }

    // async apiGetRaw(url) - 带签名头的 GET (不需 Authorization)
    async apiGetRaw(url) {
        let res = await Network.get(url, this.getSignHeaders())
        if (res.status !== 200) throw `HTTP ${res.status}`
        return JSON.parse(res.body)
    }

    // ===========================================================
    //  ACCOUNT
    // ===========================================================

    account = {
        loginWithWebview: {
            url: "https://accounts.pixiv.net/login?lang=zh",

            checkStatus: (url, title) => {
                // 登录成功后的跳转目标: www.pixiv.net 的非登录页
                if ((url.includes('www.pixiv.net') || url.includes('pixiv.net'))
                    && !url.includes('/login')
                    && !url.includes('accounts.pixiv.net')) {
                    return true
                }
                return false
            },

            onLoginSuccess: () => {
                try {
                    let storage = this.loadData('_localStorage')
                    if (!storage) return
                    if (typeof storage === 'string') storage = JSON.parse(storage)

                    let tokenData = null
                    if (storage.token) {
                        tokenData = typeof storage.token === 'string'
                            ? JSON.parse(storage.token)
                            : storage.token
                    }
                    if (!tokenData) tokenData = storage

                    let refreshToken = tokenData?.refresh_token
                    if (refreshToken) {
                        this.saveData('pending_refresh_token', refreshToken)
                    }
                } catch (e) { }
            },
        },

        /*
         * login 的两种使用方式:
         *   1. Webview 登录后, 自动用 pending_refresh_token 换取 access_token
         *   2. 高级用户可手动输入 refresh_token 作为 account 参数
         *
         * account — 留空则用已缓存的 token; 或直接填 refresh_token
         * pwd     — 未使用 (Pixiv 的 password grant 已封禁)
         */
        login: async (account, pwd) => {
            let token = this.loadData('pending_refresh_token')
                || this.loadData('refresh_token')
                || (account || '').trim()

            if (!token) throw 'Login required. Please login via Webview first.'

            this.deleteData('pending_refresh_token')

            // 如果 token 来自 account 参数 (手动输入), 先存入 refresh_token
            if (token === (account || '').trim() && !this.loadData('refresh_token')) {
                this.saveData('refresh_token', token)
            }

            await this.refreshToken()
            return 'ok'
        },

        logout: () => {
            this.deleteData('access_token')
            this.deleteData('refresh_token')
            this.deleteData('pending_refresh_token')
            this.deleteData('user_id')
            this.deleteData('user_name')
            this.deleteData('user_account')
            Network.deleteCookies('https://www.pixiv.net')
            Network.deleteCookies('https://accounts.pixiv.net')
        },

        registerWebsite: 'https://www.pixiv.net/signup/'
    }

    // ===========================================================
    //  UTILITY
    // ===========================================================

    static parseNextUrl(nextUrl) {
        if (!nextUrl) return null
        let idx = nextUrl.indexOf('?')
        if (idx === -1) return {}
        let qs = nextUrl.substring(idx + 1)
        let result = {}
        for (let pair of qs.split('&')) {
            let [k, v] = pair.split('=')
            k = decodeURIComponent(k)
            v = decodeURIComponent(v || '')
            if (k.endsWith('[]')) k = k.substring(0, k.length - 2)
            result[k] = v
        }
        return result
    }

    parseIllust(illust) {
        let cover = illust.image_urls.medium
        if (illust.page_count > 1 && illust.meta_pages && illust.meta_pages.length > 0) {
            cover = illust.meta_pages[0].image_urls.medium
        }
        let tags = (illust.tags || []).map(t => t.translated_name || t.name)
        return new Comic({
            id: illust.id.toString(),
            title: illust.title,
            subTitle: illust.user.name,
            cover: cover,
            tags: tags,
            description: (illust.caption || '').replace(/<[^>]*>/g, ''),
            maxPage: illust.page_count || 1
        })
    }

    parseNovel(novel) {
        let tags = (novel.tags || []).map(t => t.translated_name || t.name)
        let cover = novel.cover_urls?.medium || ''
        return new Comic({
            id: 'novel_' + novel.id.toString(),
            title: novel.title,
            subTitle: novel.user.name,
            cover: cover,
            tags: tags,
            description: (novel.caption || '').replace(/<[^>]*>/g, ''),
            maxPage: novel.page_count || 1
        })
    }

    static pageSize = 30
    offsetForPage(page) { return (page - 1) * Pixiv.pageSize }

    /**
     * 为 endpoint URL 追加 offset 和 filter 参数
     */
    buildUrl(path, page) {
        let sep = path.includes('?') ? '&' : '?'
        let url = `${this.apiBase}${path}`
        if (page > 1) url += `${sep}offset=${this.offsetForPage(page)}`
        return url
    }

    async fetchIllusts(path, page) {
        let url = this.buildUrl(path, page)
        return await this.apiGet(url)
    }

    // ===========================================================
    //  EXPLORE
    // ===========================================================

    explore = [
        {
            title: "Discover",
            type: "multiPartPage",

            load: async (page) => {
                // Explore 仅首页有意义 — 多分区聚合无法按统一页码翻页
                if (page && page > 1) return []

                let [following, dayRank, weekRank, recom, newest] =
                    await Promise.allSettled([
                        this.fetchIllusts('/v2/illust/follow?restrict=public', 1),
                        this.fetchIllusts('/v1/illust/ranking?filter=for_ios&mode=day', 1),
                        this.fetchIllusts('/v1/illust/ranking?filter=for_ios&mode=week', 1),
                        this.fetchIllusts('/v1/illust/recommended?filter=for_ios&include_ranking_label=true', 1),
                        this.fetchIllusts('/v1/illust/new?filter=for_ios', 1),
                    ])

                let sections = [
                    { title: 'Following',       data: following,     category: 'follow',  param: '' },
                    { title: 'Daily Ranking',   data: dayRank,       category: 'ranking', param: 'day' },
                    { title: 'Weekly Ranking',  data: weekRank,      category: 'ranking', param: 'week' },
                    { title: 'Recommended',     data: recom,         category: 'recommended', param: '' },
                    { title: 'Newest',          data: newest,        category: 'newest', param: '' },
                ]

                let result = []
                for (let s of sections) {
                    if (s.data && s.data.status === 'fulfilled' && s.data.value) {
                        let comics = (s.data.value.illusts || []).map(e => this.parseIllust(e))
                        if (s.category === 'follow' && comics.length === 0) continue
                        result.push({
                            title: s.title,
                            comics: comics,
                            viewMore: {
                                page: 'category',
                                attributes: { category: s.category, param: s.param }
                            }
                        })
                    }
                }
                return result
            },
        }
    ]

    // ===========================================================
    //  CATEGORY
    // ===========================================================

    category = {
        title: "Pixiv",
        parts: [
            {
                name: "Ranking",
                type: "fixed",
                categories: [
                    { label: "Following",       target: { page: "category", attributes: { category: "follow", param: "" } } },
                    { label: "Daily",           target: { page: "category", attributes: { category: "ranking", param: "day" } } },
                    { label: "Weekly",          target: { page: "category", attributes: { category: "ranking", param: "week" } } },
                    { label: "Monthly",         target: { page: "category", attributes: { category: "ranking", param: "month" } } },
                    { label: "Male Popular",    target: { page: "category", attributes: { category: "ranking", param: "day_male" } } },
                    { label: "Female Popular",  target: { page: "category", attributes: { category: "ranking", param: "day_female" } } },
                    { label: "Rookie",          target: { page: "category", attributes: { category: "ranking", param: "week_rookie" } } },
                    { label: "Original",        target: { page: "category", attributes: { category: "ranking", param: "week_original" } } },
                    { label: "Daily R-18",      target: { page: "category", attributes: { category: "ranking", param: "day_r18" } } },
                ]
            },
            {
                name: "Trending Tags",
                type: "dynamic",
                loader: async () => {
                    try {
                        let json = await this.apiGet(`${this.apiBase}/v1/trending-tags/illust?filter=for_ios`)
                        return (json.trend_tags || []).map(t => ({
                            label: t.translated_name || t.tag,
                            target: { page: "category", attributes: { category: "tag", param: t.tag } }
                        }))
                    } catch (e) {
                        return []
                    }
                }
            }
        ],
        enableRankingPage: false,
    }

    // ===========================================================
    //  CATEGORY COMICS
    // ===========================================================

    categoryComics = {
        load: async (category, param, options, page) => {
            let sort = (options && options[0]) || 'date_desc'
            let path, json

            switch (category) {
                case 'ranking':
                    path = `/v1/illust/ranking?filter=for_ios&mode=${param}`
                    json = await this.fetchIllusts(path, page)
                    break
                case 'follow':
                    path = `/v2/illust/follow?restrict=public`
                    json = await this.fetchIllusts(path, page)
                    break
                case 'recommended':
                    path = `/v1/illust/recommended?filter=for_ios&include_ranking_label=true`
                    json = await this.fetchIllusts(path, page)
                    break
                case 'newest':
                    // illust_new 使用 max_illust_id 游标, 不支持 offset 翻页
                    if (page > 1) return { comics: [], maxPage: 1 }
                    json = await this.apiGet(`${this.apiBase}/v1/illust/new?filter=for_ios`)
                    break
                case 'tag':
                    path = `/v1/search/illust?filter=for_ios&word=${encodeURIComponent(param)}&search_target=partial_match_for_tags&sort=${sort}&merge_plain_keyword_results=true`
                    json = await this.fetchIllusts(path, page)
                    break
                default:
                    throw `Unknown category: ${category}`
            }

            let comics = (json.illusts || []).map(e => this.parseIllust(e))
            let hasNext = !!json.next_url
            return { comics: comics, maxPage: hasNext ? page + 1 : page }
        },

        optionList: [
            {
                type: "select",
                options: [
                    "date_desc-Newest",
                    "date_asc-Oldest",
                    "popular_desc-Most Popular"
                ],
                label: "Sort",
                default: "date_desc",
                showWhen: ["tag"]
            }
        ],
    }

    // ===========================================================
    //  SEARCH
    // ===========================================================

    search = {
        load: async (keyword, options, page) => {
            let sort = (options && options[0]) || 'date_desc'
            let searchTarget = (options && options[1]) || 'partial_match_for_tags'
            let path = `/v1/search/illust`
                + `?filter=for_ios`
                + `&word=${encodeURIComponent(keyword)}`
                + `&search_target=${searchTarget}`
                + `&sort=${sort}`
                + `&merge_plain_keyword_results=true`
            let json = await this.fetchIllusts(path, page)

            let comics = (json.illusts || []).map(e => this.parseIllust(e))
            let hasNext = !!json.next_url
            return { comics: comics, maxPage: hasNext ? page + 1 : page }
        },

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
            },
            {
                type: "select",
                options: [
                    "partial_match_for_tags-Tags (Partial)",
                    "exact_match_for_tags-Tags (Exact)",
                    "title_and_caption-Title & Caption"
                ],
                label: "Search Target",
                default: "partial_match_for_tags"
            }
        ],

        enableTagsSuggestions: false,
    }

    // ===========================================================
    //  FAVORITES
    // ===========================================================

    favorites = {
        multiFolder: false,

        addOrDelFavorite: async (comicId, folderId, isAdding, favoriteId) => {
            try {
                if (isAdding) {
                    await this.apiPost(`${this.apiBase}/v2/illust/bookmark/add`,
                        `illust_id=${comicId}&restrict=public`)
                } else {
                    await this.apiPost(`${this.apiBase}/v1/illust/bookmark/delete`,
                        `illust_id=${comicId}`)
                }
                return 'ok'
            } catch (e) {
                let msg = String(e)
                if (msg.includes('Login expired') || msg.includes('401') || msg.includes('400')) {
                    throw 'Login expired'
                }
                throw e
            }
        },

        loadFolders: async (comicId) => {
            let folders = { '0': this.translate('All') }
            let favorited = []
            if (comicId) {
                try {
                    let json = await this.apiGet(
                        `${this.apiBase}/v2/illust/bookmark/detail?illust_id=${comicId}`)
                    if (json.bookmark_detail && json.bookmark_detail.is_bookmarked) {
                        favorited.push('0')
                    }
                } catch (e) {
                    let msg = String(e)
                    if (msg.includes('Login expired') || msg.includes('401') || msg.includes('400')) {
                        throw 'Login expired'
                    }
                    // non-auth error: return folders without favorited info
                }
            }
            return { folders: folders, favorited: favorited }
        },

        loadComics: async (page, folder) => {
            let userId = this.loadData('user_id')
            if (!userId) throw 'Login expired'
            try {
                let path = `/v1/user/bookmarks/illust`
                    + `?user_id=${userId}`
                    + `&restrict=public`
                    + `&offset=${(page - 1) * Pixiv.pageSize}`
                let json = await this.apiGet(`${this.apiBase}${path}`)
                let comics = (json.illusts || []).map(e => this.parseIllust(e))
                let hasNext = !!json.next_url
                return { comics: comics, maxPage: hasNext ? page + 1 : page }
            } catch (e) {
                let msg = String(e)
                if (msg.includes('Login expired') || msg.includes('401') || msg.includes('400')) {
                    throw 'Login expired'
                }
                throw e
            }
        },
    }

    // ===========================================================
    //  COMIC DETAIL
    // ===========================================================

    comic = {
        loadInfo: async (id) => {
            let json = await this.apiGet(`${this.apiBase}/v1/illust/detail?filter=for_ios&illust_id=${id}`)
            let illust = json.illust
            if (!illust) throw 'Illust not found'

            // 多页作品: 每页一个 Chapter
            let chapters = new Map()
            if (illust.page_count > 1 && illust.meta_pages && illust.meta_pages.length > 0) {
                for (let i = 0; i < illust.meta_pages.length; i++) {
                    chapters.set(i.toString(), `Page ${i + 1}`)
                }
            } else {
                chapters.set('0', illust.title)
            }

            // Tags 按命名空间分组
            let tags = {}
            if (illust.tags && illust.tags.length > 0) {
                tags[this.translate('Tags')] = illust.tags.map(t => t.translated_name || t.name)
            }
            tags[this.translate('Author')] = [illust.user.name]
            if (illust.user.account) {
                tags[this.translate('Account')] = [illust.user.account]
            }

            let cover = illust.image_urls.medium
            if (illust.page_count > 1 && illust.meta_pages && illust.meta_pages.length > 0) {
                cover = illust.meta_pages[0].image_urls.medium
            }

            return new ComicDetails({
                title: illust.title,
                subtitle: illust.user.name,
                cover: cover,
                description: illust.caption || '',
                tags: tags,
                chapters: chapters,
                isFavorite: illust.is_bookmarked || false,
                subId: null,
                commentCount: illust.total_comments || 0,
                likesCount: illust.total_bookmarks || 0,
                uploadTime: illust.create_date,
                url: `https://www.pixiv.net/artworks/${illust.id}`,
                stars: (illust.total_bookmarks || 0) > 0
                    ? Math.min(5, Math.ceil((illust.total_bookmarks || 0) / 2000))
                    : 0,
                maxPage: illust.page_count || 1
            })
        },

        loadEp: async (comicId, epId) => {
            let json = await this.apiGet(`${this.apiBase}/v1/illust/detail?filter=for_ios&illust_id=${comicId}`)
            let illust = json.illust
            if (!illust) throw 'Illust not found'

            let images = []
            if (illust.page_count <= 1 || !illust.meta_pages || illust.meta_pages.length === 0) {
                let quality = this.loadSetting('imageQuality') || 'large'
                let url = (quality === 'original' && illust.meta_single_page?.original_image_url)
                    || illust.image_urls.large
                images.push(url)
            } else {
                let idx = parseInt(epId || '0')
                let page = illust.meta_pages[idx]
                if (page) {
                    let quality = this.loadSetting('imageQuality') || 'large'
                    let url = (quality === 'original' ? page.image_urls.original : null)
                        || page.image_urls.large
                    images.push(url)
                }
            }
            return { images: images }
        },

        onImageLoad: (url, comicId, epId) => {
            return {
                headers: {
                    'Referer': 'https://app-api.pixiv.net/',
                    'User-Agent': Pixiv.ua
                }
            }
        },

        onThumbnailLoad: (url) => {
            return {
                headers: {
                    'Referer': 'https://app-api.pixiv.net/',
                    'User-Agent': Pixiv.ua
                }
            }
        },

        /**
         * 点击标签/作者时跳转到搜索页
         */
        onClickTag: (namespace, tag) => {
            if (namespace === this.translate('Tags') || namespace === 'Tags') {
                return { page: 'search', attributes: { keyword: tag } }
            }
            if (namespace === this.translate('Author') || namespace === 'Author') {
                return { page: 'search', attributes: { keyword: tag } }
            }
            return null
        },

        /**
         * 通过 Pixiv URL 提取作品 ID
         */
        link: {
            domains: ['www.pixiv.net', 'pixiv.net', 'pixiv.me'],
            linkToId: (url) => {
                let match = url.match(/artworks\/(\d+)/)
                if (match) return match[1]
                // pixiv.me 短链格式
                match = url.match(/pixiv\.me\/users\/(\d+)\/artworks\/(\d+)/)
                if (match) return match[2]
                return null
            }
        },

        idMatch: "^\\d+$",

        // ---- Comments ----
        loadComments: async (comicId, subId, page, replyTo) => {
            // Pixiv 评论使用 next_url 游标分页, 非页码制.
            // 首次请求 (page 1) 跟随 next_url 链一次拉取多页,
            // 高页码返回空以表示无更多数据.
            if (page && page > 1) return { comments: [], maxPage: 1 }

            let baseUrl = replyTo
                ? `${this.apiBase}/v2/illust/comment/replies?comment_id=${replyTo}`
                : `${this.apiBase}/v3/illust/comments?illust_id=${comicId}`

            let allComments = []
            let url = baseUrl
            let pagesFetched = 0
            let maxFetched = parseInt(this.loadSetting('commentPages')) || 3

            while (url && pagesFetched < maxFetched) {
                let json = await this.apiGet(url)
                let batch = (json.comments || []).map(c => {
                    return new Comment({
                        userName: c.user ? c.user.name : 'Anonymous',
                        avatar: c.user?.profile_image_urls?.medium || '',
                        content: c.comment || '',
                        time: c.date || '',
                        replyCount: c.has_replies ? 1 : 0,
                        id: c.id ? c.id.toString() : '',
                    })
                })
                allComments.push(...batch)
                pagesFetched++
                url = json.next_url ? `${this.apiBase}${json.next_url}` : null
            }

            return { comments: allComments, maxPage: 1 }
        },

        sendComment: async (comicId, subId, content, replyTo) => {
            let body = `illust_id=${comicId}&comment=${encodeURIComponent(content)}`
            if (replyTo) body += `&parent_comment_id=${replyTo}`
            await this.apiPost(`${this.apiBase}/v1/illust/comment/add`, body)
            return 'ok'
        },
    }

    // ===========================================================
    //  SETTINGS
    // ===========================================================

    settings = {
        apiHost: {
            title: "API Host",
            type: "input",
            default: "https://app-api.pixiv.net",
            validator: "^https?://.+"
        },
        imageQuality: {
            title: "Image Quality",
            type: "select",
            options: [
                { value: 'large', text: 'Large (~1200px)' },
                { value: 'original', text: 'Original' },
            ],
            default: 'large'
        },
        commentPages: {
            title: "Comments Page Limit",
            type: "select",
            options: [
                { value: '1', text: '1 page' },
                { value: '2', text: '2 pages' },
                { value: '3', text: '3 pages' },
                { value: '5', text: '5 pages' },
            ],
            default: '3'
        }
    }

    // ===========================================================
    //  TRANSLATION
    // ===========================================================

    translation = {
        'zh_CN': {
            'Discover': '发现',
            'Following': '关注',
            'Daily Ranking': '日榜',
            'Weekly Ranking': '周榜',
            'Monthly': '月榜',
            'Recommended': '推荐',
            'Newest': '最新',
            'Ranking': '排行',
            'Trending Tags': '热门标签',
            'Daily': '每日',
            'Weekly': '每周',
            'Male Popular': '男性向',
            'Female Popular': '女性向',
            'Rookie': '新人',
            'Original': '原创',
            'Daily R-18': '每日 R-18',
            'Sort': '排序',
            'Search Target': '搜索目标',
            'All': '全部',
            'Tags': '标签',
            'Author': '作者',
            'Account': '账号',
            'API Host': 'API地址',
            'Image Quality': '图片质量',
            'Comments Page Limit': '评论加载页数',
        },
        'zh_TW': {
            'Discover': '發現',
            'Following': '關注',
            'Daily Ranking': '日榜',
            'Weekly Ranking': '週榜',
            'Monthly': '月榜',
            'Recommended': '推薦',
            'Newest': '最新',
            'Ranking': '排行',
            'Trending Tags': '熱門標籤',
            'Daily': '每日',
            'Weekly': '每週',
            'Male Popular': '男性向',
            'Female Popular': '女性向',
            'Rookie': '新人',
            'Original': '原創',
            'Daily R-18': '每日 R-18',
            'Sort': '排序',
            'Search Target': '搜尋目標',
            'All': '全部',
            'Tags': '標籤',
            'Author': '作者',
            'Account': '帳號',
            'API Host': 'API位址',
            'Image Quality': '圖片品質',
            'Comments Page Limit': '評論載入頁數',
        },
        'en': {}
    }
}
