/** @type {import('./_venera_.js')} */
class Pixiv extends ComicSource {
    /*
     * ================================================================
     * WORK STATUS — 2025-05-22
     * ================================================================
     * [x] Auth      — Webview 自动登录 (primary) / refresh_token 备用 / 401 自动刷新
     * [x] Explore   — Following/Daily/Weekly/Recommended/Newest 五分区
     * [x] Category  — 7种排行 + 动态热门标签 + 关注新作
     * [x] CategoryComics — offset 分页 (newest 仅首页, 是 API 限制)
     * [x] Search    — 关键词搜索 + 排序/搜索目标双选项
     * [x] Favorites — 书签增删查 / 自动 Login expired 重登录
     * [x] Comic     — 详情/多页 Chapter/图片加载 + Referer 防盗链
     * [x] Settings  — API Host / Image Quality
     * [x] Translation — zh_CN / zh_TW / en
     *
     * 已知限制:
     * - Ugoira (动图) 视为普通图片, 未调用 ugoira_metadata
     * - illust_new (Newest) 用游标分页, 仅支持首页
     * - 多图作品仅 Large 尺寸 (API meta_pages 无原图 URL)
     * - R-18 内容未做特殊过滤 (依赖 Pixiv 默认 filter=for_ios)
     * - parseNextUrl 已实现但未使用 (留待 cursor 分页扩展)
     * ================================================================
     */
    name = "Pixiv"
    key = "pixiv"
    version = "1.1.0"
    minAppVersion = "1.6.0"
    url = "https://cdn.jsdelivr.net/gh/theoldman-lab/venera-configs@main/pixiv.js"

    static authUrl = "https://oauth.secure.pixiv.net/auth/token"
    static clientId = "MOBrBDS8blbauoSck0ZfDbtuzpyT"
    static clientSecret = "lsACyCD94FhDUtGTXi3QzcFE2uU1hqtDaKeqrdwj"
    static hashSecret = "28c1fdd170a5204386cb1313c7077b34f83e4aaf4aa829ce78c231e05b0bae2c"
    static ua = "PixivIOSApp/7.13.3 (iOS 14.6; iPhone13,2)"

    get apiBase() {
        return this.loadSetting('apiHost') || 'https://app-api.pixiv.net'
    }

    // ---- Auth helpers ----

    getAuthHeaders() {
        let d = new Date()
        let time = d.toISOString().replace(/\.\d+Z$/, '+00:00')
        let hash = Convert.hexEncode(Convert.md5(Convert.encodeUtf8(time + Pixiv.hashSecret)))
        return {
            'X-Client-Time': time,
            'X-Client-Hash': hash,
            'App-OS': 'ios',
            'App-OS-Version': '14.6',
            'User-Agent': Pixiv.ua,
            'Content-Type': 'application/x-www-form-urlencoded'
        }
    }

    get apiHeaders() {
        let token = this.loadData('access_token')
        if (!token) return null
        return {
            'Authorization': `Bearer ${token}`,
            'App-OS': 'ios',
            'App-OS-Version': '14.6',
            'User-Agent': Pixiv.ua,
            'Accept-Language': 'zh-cn'
        }
    }

    async refreshToken() {
        let refreshToken = this.loadData('refresh_token')
        if (!refreshToken) throw 'No refresh token'

        let res = await Network.post(Pixiv.authUrl, this.getAuthHeaders(),
            `client_id=${Pixiv.clientId}&client_secret=${Pixiv.clientSecret}&grant_type=refresh_token&refresh_token=${refreshToken}&get_secure_url=1`)

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

    // Authenticated GET with auto-refresh on 401
    async apiGet(url) {
        // webview 登录后延迟换 token
        if (this.loadData('pending_refresh_token')) {
            await this.exchangeWebviewToken()
        }
        let token = this.loadData('access_token')
        if (!token) {
            token = await this.refreshToken()
        }
        let res = await Network.get(url, this.apiHeaders)
        if (res.status === 401) {
            token = await this.refreshToken()
            res = await Network.get(url, this.apiHeaders)
        }
        if (res.status !== 200) throw `HTTP ${res.status}: ${res.body}`
        return JSON.parse(res.body)
    }

    // Authenticated POST with auto-refresh on 401
    async apiPost(url, body) {
        if (this.loadData('pending_refresh_token')) {
            await this.exchangeWebviewToken()
        }
        let token = this.loadData('access_token')
        if (!token) {
            token = await this.refreshToken()
        }
        let postHeaders = Object.assign({}, this.apiHeaders, {
            'Content-Type': 'application/x-www-form-urlencoded'
        })
        let res = await Network.post(url, postHeaders, body)
        if (res.status === 401) {
            token = await this.refreshToken()
            postHeaders = Object.assign({}, this.apiHeaders, {
                'Content-Type': 'application/x-www-form-urlencoded'
            })
            res = await Network.post(url, postHeaders, body)
        }
        if (res.status !== 200) throw `HTTP ${res.status}: ${res.body}`
        return JSON.parse(res.body)
    }

    // ---- Account ----

    /**
     * 用延迟的 refresh_token 换取 access_token
     * 适用于 loginWithWebview 后需要异步 OAuth 交换的场景
     */
    async exchangeWebviewToken() {
        let token = this.loadData('pending_refresh_token')
        if (!token) return false
        this.deleteData('pending_refresh_token')
        try {
            let res = await Network.post(Pixiv.authUrl, this.getAuthHeaders(),
                `client_id=${Pixiv.clientId}&client_secret=${Pixiv.clientSecret}&grant_type=refresh_token&refresh_token=${encodeURIComponent(token)}&get_secure_url=1`)
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

    account = {
        /*
         * 主登录方式: Webview 内嵌浏览器登录 Pixiv
         * App 内打开 Pixiv 登录页, 用户输入账号密码,
         * 登录成功后自动从 LocalStorage 提取 refresh_token
         */
        loginWithWebview: {
            url: "https://accounts.pixiv.net/login?lang=zh",

            checkStatus: (url, title) => {
                // 登录成功后 Pixiv 重定向到 www.pixiv.net (非登录页)
                if (url.includes('www.pixiv.net') && !url.includes('/login')) {
                    return true
                }
                return false
            },

            onLoginSuccess: () => {
                // Webview 关闭后 App 已保存 LocalStorage, 提取 refresh_token
                try {
                    let storage = this.loadData('_localStorage')
                    if (!storage) return
                    if (typeof storage === 'string') storage = JSON.parse(storage)

                    let tokenData = null
                    // Pixiv web 的 token 存储格式: {"token": "{\"refresh_token\":\"...\"}"}
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
         * 备用: 手动输入 refresh_token 登录
         * (Webview 方式失败或高级用户手动填入)
         */
        login: async (account, pwd) => {
            // 优先: webview 登录后暂存的 pending_refresh_token
            // 其次: 上次 OAuth 刷新时的最新 refresh_token
            // 最后: 用户本次手动输入的 refresh_token
            let refreshToken = this.loadData('pending_refresh_token')
                || this.loadData('refresh_token')
                || (account || '').trim()
            this.deleteData('pending_refresh_token')

            if (!refreshToken) {
                throw 'Login required. Please login via Webview first.'
            }

            let res = await Network.post(Pixiv.authUrl, this.getAuthHeaders(),
                `client_id=${Pixiv.clientId}&client_secret=${Pixiv.clientSecret}&grant_type=refresh_token&refresh_token=${encodeURIComponent(refreshToken)}&get_secure_url=1`)

            if (res.status !== 200) {
                let msg = `Login failed (HTTP ${res.status})`
                try {
                    let json = JSON.parse(res.body)
                    if (json.has_error) msg = json.errors.system.message || msg
                } catch (e) { }
                throw msg
            }

            let json = JSON.parse(res.body)
            this.saveData('access_token', json.response.access_token)
            this.saveData('refresh_token', json.response.refresh_token)
            this.saveData('user_id', json.response.user.id.toString())
            this.saveData('user_name', json.response.user.name)
            this.saveData('user_account', json.response.user.account)
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
        },

        registerWebsite: 'https://www.pixiv.net/signup/'
    }

    // ---- Utility ----

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
            description: illust.caption || '',
            maxPage: illust.page_count || 1
        })
    }

    // page: 1-based → Pixiv offset
    static pageSize = 30

    offsetForPage(page) {
        return (page - 1) * Pixiv.pageSize
    }

    async getIllusts(url, page) {
        if (page > 1) {
            let sep = url.includes('?') ? '&' : '?'
            url += `${sep}offset=${this.offsetForPage(page)}`
        }
        return await this.apiGet(url)
    }

    // ---- Explore ----

    explore = [
        {
            title: "",

            type: "multiPartPage",

            load: async (page) => {
                let base = this.apiBase
                // Following 需登录，失败则静默跳过
                let following = await this.getIllusts(`${base}/v2/illust/follow?restrict=public`, 1).catch(() => null)
                let futures = await Promise.all([
                    this.getIllusts(`${base}/v1/illust/ranking?mode=day`, 1).catch(() => null),
                    this.getIllusts(`${base}/v1/illust/ranking?mode=week`, 1).catch(() => null),
                    this.getIllusts(`${base}/v1/illust/recommended?content_type=illust&include_ranking_label=true`, 1).catch(() => null),
                    this.getIllusts(`${base}/v1/illust/new?content_type=illust`, 1).catch(() => null),
                ])

                let sections = [
                    { title: 'Following',      data: following, category: 'follow', param: '' },
                    { title: 'Daily Ranking',   data: futures[0], category: 'ranking', param: 'day' },
                    { title: 'Weekly Ranking',  data: futures[1], category: 'ranking', param: 'week' },
                    { title: 'Recommended',     data: futures[2], category: 'recommended', param: '' },
                    { title: 'Newest',          data: futures[3], category: 'newest', param: '' },
                ]

                let result = []
                for (let s of sections) {
                    let comics = []
                    if (s.data && s.data.illusts) {
                        comics = s.data.illusts.map(e => this.parseIllust(e))
                    }
                    // Following 分区无数据时跳过 (未登录)
                    if (s.category === 'follow' && comics.length === 0) continue
                    result.push({
                        title: s.title,
                        comics: comics,
                        viewMore: {
                            page: 'category',
                            attributes: {
                                category: s.category,
                                param: s.param,
                            }
                        }
                    })
                }
                return result
            },
        }
    ]

    // ---- Category ----

    category = {
        title: "Pixiv",
        parts: [
            {
                name: "Ranking",
                type: "fixed",
                categories: [
                    { label: "Following",    target: { page: "category", attributes: { category: "follow", param: "" } } },
                    { label: "Daily",        target: { page: "category", attributes: { category: "ranking", param: "day" } } },
                    { label: "Weekly",       target: { page: "category", attributes: { category: "ranking", param: "week" } } },
                    { label: "Monthly",      target: { page: "category", attributes: { category: "ranking", param: "month" } } },
                    { label: "Male Popular", target: { page: "category", attributes: { category: "ranking", param: "day_male" } } },
                    { label: "Female Popular",target: { page: "category", attributes: { category: "ranking", param: "day_female" } } },
                    { label: "Rookie",       target: { page: "category", attributes: { category: "ranking", param: "week_rookie" } } },
                    { label: "Original",     target: { page: "category", attributes: { category: "ranking", param: "week_original" } } },
                ]
            },
            {
                name: "Tags",
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

    // ---- Category Comics ----

    categoryComics = {
        load: async (category, param, options, page) => {
            let base = this.apiBase
            let json

            if (category === 'ranking') {
                json = await this.getIllusts(
                    `${base}/v1/illust/ranking?mode=${param}`, page)
            } else if (category === 'follow') {
                json = await this.getIllusts(
                    `${base}/v2/illust/follow?restrict=public`, page)
            } else if (category === 'recommended') {
                json = await this.getIllusts(
                    `${base}/v1/illust/recommended?content_type=illust&include_ranking_label=true`, page)
            } else if (category === 'newest') {
                // illust_new 使用 max_illust_id 游标分页，不支持 offset
                if (page > 1) return { comics: [], maxPage: 1 }
                json = await this.apiGet(
                    `${base}/v1/illust/new?content_type=illust`)
            } else if (category === 'tag') {
                json = await this.getIllusts(
                    `${base}/v1/search/illust?word=${encodeURIComponent(param)}&search_target=partial_match_for_tags`, page)
            } else {
                throw `Unknown category: ${category}`
            }

            let comics = (json.illusts || []).map(e => this.parseIllust(e))
            let hasNext = !!json.next_url
            return {
                comics: comics,
                maxPage: hasNext ? page + 1 : page
            }
        },
    }

    // ---- Search ----

    search = {
        load: async (keyword, options, page) => {
            let sort = options[0] || 'date_desc'
            let searchTarget = options[1] || 'partial_match_for_tags'
            let base = this.apiBase
            let json = await this.getIllusts(
                `${base}/v1/search/illust?word=${encodeURIComponent(keyword)}&search_target=${searchTarget}&sort=${sort}`, page)

            let comics = (json.illusts || []).map(e => this.parseIllust(e))
            let hasNext = !!json.next_url
            return {
                comics: comics,
                maxPage: hasNext ? page + 1 : page
            }
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
    }

    // ---- Favorites ----

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
            } catch (e) {
                if (String(e).includes('401') || String(e).includes('Token refresh failed')) {
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
                    let json = await this.apiGet(`${this.apiBase}/v2/illust/bookmark/detail?illust_id=${comicId}`)
                    if (json.bookmark_detail) {
                        favorited.push('0')
                    }
                } catch (e) {
                    if (String(e).includes('401') || String(e).includes('Token refresh failed')) {
                        throw 'Login expired'
                    }
                }
            }
            return { folders: folders, favorited: favorited }
        },

        loadComics: async (page, folder) => {
            let userId = this.loadData('user_id')
            if (!userId) throw 'Login required'
            try {
                let json = await this.apiGet(
                    `${this.apiBase}/v1/user/bookmarks/illust?user_id=${userId}&restrict=public&offset=${(page - 1) * Pixiv.pageSize}`)
                let comics = (json.illusts || []).map(e => this.parseIllust(e))
                let hasNext = !!json.next_url
                return { comics: comics, maxPage: hasNext ? page + 1 : page }
            } catch (e) {
                if (String(e).includes('401') || String(e).includes('Token refresh failed')) {
                    throw 'Login expired'
                }
                throw e
            }
        },
    }

    // ---- Comic Detail ----

    comic = {
        loadInfo: async (id) => {
            let json = await this.apiGet(`${this.apiBase}/v1/illust/detail?illust_id=${id}`)
            let illust = json.illust
            if (!illust) throw 'Illust not found'

            let chapters = new Map()
            if (illust.page_count > 1 && illust.meta_pages && illust.meta_pages.length > 0) {
                for (let i = 0; i < illust.meta_pages.length; i++) {
                    chapters.set(i.toString(), `Page ${i + 1}`)
                }
            } else {
                chapters.set('0', illust.title)
            }

            let tags = {}
            if (illust.tags && illust.tags.length > 0) {
                tags['Tags'] = illust.tags.map(t => t.translated_name || t.name)
            }
            tags['Author'] = [illust.user.name]
            if (illust.user.account) {
                tags['Account'] = [illust.user.account]
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
                commentCount: illust.total_comments || 0,
                likesCount: illust.total_bookmarks || 0,
                uploadTime: illust.create_date,
                url: `https://www.pixiv.net/artworks/${illust.id}`,
                stars: (illust.total_bookmarks || 0) > 0 ? Math.min(5, Math.ceil((illust.total_bookmarks || 0) / 2000)) : 0,
            })
        },

        loadEp: async (comicId, epId) => {
            let json = await this.apiGet(`${this.apiBase}/v1/illust/detail?illust_id=${comicId}`)
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
                    images.push(page.image_urls.large)
                }
            }

            return { images: images }
        },

        onImageLoad: (url, comicId, epId) => {
            return {
                headers: {
                    'Referer': 'https://www.pixiv.net/',
                    'User-Agent': Pixiv.ua
                }
            }
        },

        onClickTag: (namespace, tag) => {
            if (namespace === 'Tags') {
                return {
                    page: 'search',
                    attributes: { keyword: tag }
                }
            }
            if (namespace === 'Author') {
                return {
                    page: 'search',
                    attributes: { keyword: tag }
                }
            }
            return null
        },

        idMatch: "^\\d+$",

        link: {
            domains: ['www.pixiv.net', 'pixiv.net'],
            linkToId: (url) => {
                let match = url.match(/artworks\/(\d+)/)
                return match ? match[1] : null
            }
        },
    }

    // ---- Settings ----

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
        }
    }

    // ---- Translation ----

    translation = {
        'zh_CN': {
            'API Host': 'API地址',
            'Image Quality': '图片质量',
            'All': '全部',
            'Tags': '标签',
            'Author': '作者',
            'Account': '账号',
        },
        'zh_TW': {
            'API Host': 'API位址',
            'Image Quality': '圖片品質',
            'All': '全部',
            'Tags': '標籤',
            'Author': '作者',
            'Account': '帳號',
        },
        'en': {}
    }
}
