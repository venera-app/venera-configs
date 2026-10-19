class Pixiv extends ComicSource {
    name = "Pixiv"

    key = "pixiv"

    version = "0.4.1"

    minAppVersion = "1.6.0"

    url = "https://cdn.jsdelivr.net/gh/venera-app/venera-configs@main/pixiv.js"

    BASE_API = "https://app-api.pixiv.net"

    BASE_OAUTH = "https://oauth.secure.pixiv.net"

    HASH_SALT = "28c1fdd170a5204386cb1313c7077b34f83e4aaf4aa829ce78c231e05b0bae2c"

    CLIENT_ID = "MOBrBDS8blbauoSck0ZfDbtuzpyT"

    CLIENT_SECRET = "lsACyCD94FhDUtGTXi3QzcFE2uU1hqtDaKeqrdwj"

    get apiHost() {
        return (this.loadSetting('apiHost') || "app-api.pixiv.net").replace(/^https?:\/\//, '').replace(/\/$/, '')
    }

    get baseUrl() {
        return "https://" + this.apiHost
    }

    get oauthHost() {
        return (this.loadSetting('oauthHost') || "oauth.secure.pixiv.net").replace(/^https?:\/\//, '').replace(/\/$/, '')
    }

    get oauthUrl() {
        return "https://" + this.oauthHost
    }

    isoTime() {
        return new Date().toISOString().split('.')[0] + '+00:00'
    }

    sign(time) {
        return Convert.hexEncode(Convert.md5(Convert.encodeUtf8(time + this.HASH_SALT)))
    }

    subAccounts() {
        try {
            let arr = JSON.parse(this.loadSetting('sub_accounts') || '[]')
            return Array.isArray(arr) ? arr : []
        } catch (e) {
            return []
        }
    }

    accountCount() {
        return 1 + this.subAccounts().length
    }

    accountName(index) {
        if (index === 0) {
            return '主账号'
        }
        let sub = this.subAccounts()[index - 1]
        return sub && sub.name ? sub.name : `账号${index}`
    }

    get activeAccount() {
        let value = this.loadData('active_account')
        let index = value === null || value === undefined || value === '' ? 0 : Number(value)
        if (isNaN(index) || index < 0) {
            return 0
        }
        return index
    }

    accountTokenKey(index) {
        return index === 0 ? 'access_token' : `access_token_${index}`
    }

    accountRefreshKey(index) {
        return index === 0 ? 'refresh_token' : `refresh_token_${index}`
    }

    accountUserIdKey(index) {
        return index === 0 ? 'user_id' : `user_id_${index}`
    }

    hasAccount(index) {
        return !!this.loadData(this.accountTokenKey(index))
    }

    getUserId(index) {
        let i = index === undefined ? this.activeAccount : index
        return this.loadData(this.accountUserIdKey(i))
    }

    requireAccount() {
        if (this.hasAccount(this.activeAccount)) {
            return
        }
        if (this.activeAccount === 0) {
            throw 'Login expired'
        }
        throw '当前账号未登录, 请在设置中登录附属账号或切换账号'
    }

    buildHeaders(auth = true, contentType = null, accountIndex = null) {
        let time = this.isoTime()
        let headers = {
            "X-Client-Time": time,
            "X-Client-Hash": this.sign(time),
            "User-Agent": "PixivAndroidApp/5.0.155 (Android 10.0; Pixel C)",
            "App-OS": "Android",
            "App-OS-Version": "Android 10.0",
            "App-Version": "5.0.166",
            "Accept-Language": "zh-CN",
        }
        if (contentType) {
            headers["Content-Type"] = contentType
        }
        if (auth) {
            let index = accountIndex === null || accountIndex === undefined ? this.activeAccount : accountIndex
            let token = this.loadData(this.accountTokenKey(index))
            if (token) {
                headers["Authorization"] = "Bearer " + token
            }
        }
        return headers
    }

    buildQuery(params) {
        if (!params) return ''
        let parts = []
        for (let key in params) {
            let value = params[key]
            if (value === null || value === undefined || value === '') continue
            parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
        }
        return parts.length > 0 ? '?' + parts.join('&') : ''
    }

    fixNextUrl(url) {
        if (!url) return url
        return url.replace(/^https?:\/\/[^/]+/, this.baseUrl)
    }

    needRefresh(res, accountIndex) {
        if (!res) return false
        let index = accountIndex === undefined ? this.activeAccount : accountIndex
        if (res.status === 401) return !!this.loadData(this.accountRefreshKey(index))
        if (res.status === 400 && res.body && res.body.indexOf('OAuth') >= 0) {
            return !!this.loadData(this.accountRefreshKey(index))
        }
        return false
    }

    async request(method, path, params, body, auth = true, contentType = null, accountIndex = null) {
        let index = accountIndex === null || accountIndex === undefined ? this.activeAccount : accountIndex
        let url = /^https?:\/\//.test(path) ? path : this.baseUrl + path
        url += this.buildQuery(params)
        let res = await Network.sendRequest(method, url, this.buildHeaders(auth, contentType, index), body)
        if (auth && this.needRefresh(res, index)) {
            await this.ensureRefresh(index)
            res = await Network.sendRequest(method, url, this.buildHeaders(auth, contentType, index), body)
        }
        return res
    }

    apiGet(path, params, auth = true) {
        return this.request('GET', path, params, null, auth)
    }

    apiPost(path, body, auth = true) {
        return this.request('POST', path, null, body, auth, "application/x-www-form-urlencoded")
    }

    apiDelete(path, params, auth = true) {
        return this.request('DELETE', path, params, null, auth)
    }

    check(res) {
        if (!res || res.status !== 200) {
            let detail = res && res.body ? String(res.body).substring(0, 300) : ''
            throw `Invalid status code: ${res ? res.status : 'no response'}${detail ? ' - ' + detail : ''}`
        }
        return JSON.parse(res.body)
    }

    assertOk(res, message = 'Request failed') {
        if (!res) {
            throw message
        }
        if (res.status === 401 || (res.status === 400 && res.body && res.body.indexOf('OAuth') >= 0)) {
            throw 'Login expired'
        }
        if (res.status !== 200) {
            let detail = res.body ? String(res.body).substring(0, 300) : ''
            throw `${message}: ${res.status}${detail ? ' - ' + detail : ''}`
        }
        return 'ok'
    }

    async loadIllustPage(next, path, params) {
        let res = await this.apiGet(next || path, next ? null : params)
        let json = this.check(res)
        return {
            comics: this.parseIllustList(json),
            next: json.next_url ? this.fixNextUrl(json.next_url) : null,
        }
    }

    ensureRefresh(accountIndex) {
        let index = accountIndex === undefined ? this.activeAccount : accountIndex
        if (!this._refreshPromises) {
            this._refreshPromises = {}
        }
        if (!this._refreshPromises[index]) {
            this._refreshPromises[index] = this.refreshToken(index).then(
                (v) => {
                    this._refreshPromises[index] = null
                    return v
                },
                (e) => {
                    this._refreshPromises[index] = null
                    throw e
                }
            )
        }
        return this._refreshPromises[index]
    }

    async refreshToken(accountIndex) {
        let index = accountIndex === undefined ? this.activeAccount : accountIndex
        let refreshToken = this.loadData(this.accountRefreshKey(index))
        if (!refreshToken) {
            throw 'Login expired'
        }
        let body = `client_id=${this.CLIENT_ID}&client_secret=${this.CLIENT_SECRET}` +
            `&grant_type=refresh_token&refresh_token=${encodeURIComponent(refreshToken)}&include_policy=true`
        let res = await Network.post(this.oauthUrl + '/auth/token', this.buildHeaders(false, "application/x-www-form-urlencoded"), body)
        if (res.status !== 200) {
            throw 'Login expired'
        }
        this.saveToken(JSON.parse(res.body), index)
    }

    preparePkce() {
        if (this.loginUrl) {
            return this.loginUrl
        }
        const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~'
        let verifier = ''
        for (let i = 0; i < 128; i++) {
            verifier += charset[randomInt(0, charset.length - 1)]
        }
        this.pkceVerifier = verifier
        let challenge = Convert.encodeBase64(Convert.sha256(Convert.encodeUtf8(verifier)))
            .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
        this.loginUrl = `${this.BASE_API}/web/v1/login?code_challenge=${challenge}&code_challenge_method=S256&client=pixiv-android`
        return this.loginUrl
    }

    init() {
        this._refreshPromises = {}
        this.preparePkce()
        if (this.pkceVerifier) {
            this.saveData('pkce_verifier', this.pkceVerifier)
        }
        this.refreshTrendTags()
        this.refreshRecommendUsers()
    }

    parseAuthError(body) {
        if (!body) return 'unknown error'
        try {
            let json = JSON.parse(body)
            if (json.errors) {
                for (let key in json.errors) {
                    let err = json.errors[key]
                    if (err && err.message) return err.message
                }
            }
            if (json.error) return json.error
        } catch (e) {
        }
        return String(body).substring(0, 300)
    }

    saveToken(json, accountIndex = 0) {
        this.saveData(this.accountTokenKey(accountIndex), json.access_token)
        this.saveData(this.accountRefreshKey(accountIndex), json.refresh_token)
        if (json.user) {
            this.saveData(this.accountUserIdKey(accountIndex), String(json.user.id))
        }
    }

    account = (() => {
        const source = this
        return {
            login: async (account, pwd) => {
                let body = `client_id=${source.CLIENT_ID}&client_secret=${source.CLIENT_SECRET}` +
                    `&grant_type=password&username=${encodeURIComponent(account)}` +
                    `&password=${encodeURIComponent(pwd)}` +
                    `&Device_token=pixiv&get_secure_url=true&include_policy=true`
                let res = await Network.post(source.oauthUrl + '/auth/token',
                    source.buildHeaders(false, "application/x-www-form-urlencoded"), body)
                if (res.status !== 200) {
                    let msg = source.parseAuthError(res.body)
                    if (/captcha|verify|challenge/i.test(msg)) {
                        msg += ' (Pixiv 要求人机验证, 请改用网页登录)'
                    }
                    throw 'Login failed: ' + msg
                }
                source.saveToken(JSON.parse(res.body), 0)
                source.saveData('active_account', '0')
                source.refreshRecommendUsers()
                return 'ok'
            },

            loginWithWebview: {
                get url() {
                    return source.preparePkce()
                },
                checkStatus: (url, title) => {
                    let match = url.match(/[?#&]code=([^&#]+)/)
                    if (match) {
                        if (source.pkceVerifier) {
                            source.saveData('pkce_verifier', source.pkceVerifier)
                        }
                        source.saveData('pkce_code', decodeURIComponent(match[1]))
                        return true
                    }
                    return false
                },
                onLoginSuccess: async () => {
                    let code = source.loadData('pkce_code')
                    let verifier = source.pkceVerifier || source.loadData('pkce_verifier')
                    if (!code || !verifier) {
                        throw 'Login failed: missing authorization code'
                    }
                    let body = `client_id=${source.CLIENT_ID}&client_secret=${source.CLIENT_SECRET}` +
                        `&grant_type=authorization_code&code=${encodeURIComponent(code)}` +
                        `&code_verifier=${encodeURIComponent(verifier)}` +
                        `&redirect_uri=${encodeURIComponent(source.BASE_API + '/web/v1/users/auth/pixiv/callback')}` +
                        `&include_policy=true`
                    let res = await Network.post(source.oauthUrl + '/auth/token', source.buildHeaders(false, "application/x-www-form-urlencoded"), body)
                    if (res.status !== 200) {
                        throw 'Login failed: ' + source.parseAuthError(res.body)
                    }
                    source.saveToken(JSON.parse(res.body), 0)
                    source.saveData('active_account', '0')
                    source.refreshRecommendUsers()
                    return 'ok'
                },
            },

            logout: () => {
                source.deleteData(source.recommendUsersKey())
                source.deleteData('access_token')
                source.deleteData('refresh_token')
                source.deleteData('user_id')
                source.deleteData('pkce_code')
                source.deleteData('pkce_verifier')
                source.deleteData('active_account')
            },

            registerWebsite: "https://accounts.pixiv.net/signup"
        }
    })()

    cleanCaption(html) {
        if (!html) return ""
        return html
            .replace(/<br\s*\/?>/gi, "\n")
            .replace(/<[^>]+>/g, "")
            .replace(/&amp;/g, "&")
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">")
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
    }

    pickPageUrl(urls, quality) {
        if (!urls) return null
        if (quality === 'original') {
            return urls.original || urls.large || urls.medium
        }
        return urls[quality] || urls.large || urls.medium
    }

    pickSingleUrl(illust, quality) {
        if (quality === 'original') {
            return (illust.meta_single_page && illust.meta_single_page.original_image_url) || (illust.image_urls && illust.image_urls.large)
        }
        return (illust.image_urls && (illust.image_urls[quality] || illust.image_urls.large)) || null
    }

    pickCover(illust) {
        let quality = this.loadSetting('imageQuality') || 'large'
        if (quality === 'original') {
            if (illust.meta_pages && illust.meta_pages.length > 0) {
                return illust.meta_pages[0].image_urls.original
            }
            return (illust.meta_single_page && illust.meta_single_page.original_image_url) || (illust.image_urls && illust.image_urls.large)
        }
        return (illust.image_urls && (illust.image_urls[quality] || illust.image_urls.large)) || null
    }

    rewriteHost(url) {
        if (!url) return url
        let mode = this.loadSetting('imageHost') || 'i.pximg.net'
        let host = mode
        if (mode === 'custom') {
            host = this.loadSetting('customImageHost') || 'i.pximg.net'
        }
        if (host === 'i.pximg.net') return url
        return url.replace(/\/\/i\.pximg\.net\//, '//' + host + '/')
    }

    parseComic(illust) {
        let tags = (illust.tags || []).map(tag => tag.name)
        return new Comic({
            id: String(illust.id),
            title: illust.title,
            subTitle: illust.user ? illust.user.name : "",
            cover: this.rewriteHost(this.pickCover(illust)),
            tags: tags,
            description: this.cleanCaption(illust.caption),
            maxPage: illust.page_count || 1,
        })
    }

    parseIllustList(json) {
        return (json.illusts || []).map(illust => this.parseComic(illust))
    }

    // 拉取插画所属系列的全部作品 (用于把 Pixiv 连载映射为章节); 无系列或失败时返回 null
    async fetchSeriesIllusts(illust) {
        if (!illust || !illust.series || !illust.series.id) {
            return null
        }
        try {
            let list = []
            let next = null
            // 防御性上限: 最多翻 5 页, 避免超长系列拖慢详情页
            for (let i = 0; i < 5; i++) {
                let res = await this.apiGet(next || '/v1/illust-series/illust',
                    next ? null : { illust_id: illust.id })
                if (res.status !== 200) {
                    break
                }
                let json = JSON.parse(res.body)
                for (let item of (json.illusts || [])) {
                    list.push(item)
                }
                next = json.next_url ? this.fixNextUrl(json.next_url) : null
                if (!next) {
                    break
                }
            }
            if (list.length <= 1) {
                return null
            }
            // 接口返回顺序为新 -> 旧, 按投稿时间升序还原阅读顺序
            return list.sort((a, b) => {
                let ta = a.create_date ? Date.parse(a.create_date) : 0
                let tb = b.create_date ? Date.parse(b.create_date) : 0
                return ta - tb
            })
        } catch (e) {
            return null
        }
    }

    explore = [
        {
            title: "推荐插画",
            type: "multiPageComicList",
            loadNext: (next) => this.loadIllustPage(next, '/v1/illust/recommended', {
                filter: 'for_android',
                include_ranking_label: true,
            }),
        },
        {
            title: "推荐漫画",
            type: "multiPageComicList",
            loadNext: (next) => this.loadIllustPage(next, '/v1/manga/recommended', {
                filter: 'for_android',
                include_ranking_label: true,
            }),
        },
        {
            title: "关注新作",
            type: "multiPageComicList",
            loadNext: async (next) => {
                this.requireAccount()
                return this.loadIllustPage(next, '/v2/illust/follow', { restrict: 'all' })
            },
        },
        {
            title: "综合日榜",
            type: "multiPageComicList",
            loadNext: (next) => this.loadIllustPage(next, '/v1/illust/ranking', {
                filter: 'for_android',
                mode: 'day',
            }),
        },
        {
            title: "热门标签",
            type: "multiPageComicList",
            load: async (page) => {
                let res = await this.apiGet('/v1/trending-tags/illust', { filter: 'for_android' })
                let json = this.check(res)
                let comics = []
                for (let item of (json.trend_tags || [])) {
                    if (item.illust) {
                        comics.push(this.parseComic(item.illust))
                    }
                }
                return { comics: comics, maxPage: 1 }
            },
        },
    ]

    static fallbackTags = [
        { label: 'オリジナル', tag: 'オリジナル' },
        { label: '初音ミク', tag: '初音ミク' },
        { label: '女の子', tag: '女の子' },
        { label: 'イラスト', tag: 'イラスト' },
        { label: 'Fate/GrandOrder', tag: 'Fate/GrandOrder' },
        { label: 'ブルーアーカイブ', tag: 'ブルーアーカイブ' },
        { label: 'ホロライブ', tag: 'ホロライブ' },
        { label: '原神', tag: '原神' },
        { label: '東方Project', tag: '東方Project' },
        { label: 'ラブライブ!', tag: 'ラブライブ!' },
        { label: '呪術廻戦', tag: '呪術廻戦' },
        { label: '鬼滅の刃', tag: '鬼滅の刃' },
        { label: 'ウマ娘', tag: 'ウマ娘' },
        { label: 'にじさんじ', tag: 'にじさんじ' },
        { label: 'VTuber', tag: 'VTuber' },
        { label: '創作', tag: '創作' },
    ]

    getTrendTags() {
        let cached = this.loadData('trend_tags')
        if (Array.isArray(cached) && cached.length > 0) {
            return cached
        }
        return Pixiv.fallbackTags
    }

    refreshTrendTags() {
        return this.apiGet('/v1/trending-tags/illust', { filter: 'for_android' }).then(
            (res) => {
                if (res.status !== 200) {
                    return
                }
                let json = JSON.parse(res.body)
                let tags = []
                for (let item of (json.trend_tags || [])) {
                    tags.push({ label: item.translated_name || item.tag, tag: item.tag })
                }
                if (tags.length > 0) {
                    this.saveData('trend_tags', tags)
                }
            },
            () => { }
        )
    }

    // 推荐画师按账号隔离缓存 (推荐结果是账号个性化的), 供同步 dynamic loader 读取
    recommendUsersKey() {
        let userId = this.getUserId()
        return userId ? `recommend_users_${userId}` : 'recommend_users'
    }

    getRecommendUsers() {
        let cached = this.loadData(this.recommendUsersKey())
        return Array.isArray(cached) ? cached : []
    }

    // 后台刷新推荐画师; 未登录时静默跳过, 失败静默忽略
    refreshRecommendUsers() {
        if (!this.hasAccount(this.activeAccount)) {
            return
        }
        return this.apiGet('/v1/user/recommended', { filter: 'for_android' }).then(
            (res) => {
                if (res.status !== 200) {
                    return
                }
                let json = JSON.parse(res.body)
                let users = []
                for (let item of (json.user_previews || [])) {
                    let user = item.user
                    if (user && user.id) {
                        users.push({ name: user.name || String(user.id), id: String(user.id) })
                    }
                }
                if (users.length > 0) {
                    this.saveData(this.recommendUsersKey(), users)
                }
            },
            () => { }
        )
    }

    category = {
        title: "Pixiv",
        parts: [
            {
                name: "热门标签",
                type: "dynamic",
                loader: () => {
                    let items = []
                    for (let t of this.getTrendTags()) {
                        items.push({
                            label: t.label,
                            target: {
                                page: 'category',
                                attributes: {
                                    category: 'tag',
                                    param: t.tag,
                                },
                            },
                        })
                    }
                    return items
                },
            },
            {
                name: "推荐画师",
                type: "dynamic",
                loader: () => {
                    let items = []
                    for (let u of this.getRecommendUsers()) {
                        items.push({
                            label: u.name,
                            target: {
                                page: 'category',
                                attributes: {
                                    category: 'artist',
                                    param: u.id,
                                },
                            },
                        })
                    }
                    return items
                },
            },
        ],
        enableRankingPage: true,
    }

    pagedMax(json, page) {
        return json && json.next_url ? page + 1 : page
    }

    async resolveUserId(nameOrId) {
        if (/^\d+$/.test(String(nameOrId))) {
            return String(nameOrId)
        }
        let res = await this.apiGet('/v1/search/user', {
            filter: 'for_android',
            word: nameOrId,
        })
        let json = this.check(res)
        let previews = json.user_previews || []
        if (previews.length > 0 && previews[0].user) {
            return String(previews[0].user.id)
        }
        return null
    }

    categoryComics = {
        load: async (category, param, options, page) => {
            let offset = (page - 1) * 30
            let sort = (options && options[0]) || 'date_desc'
            if (category === 'artist') {
                let userId = await this.resolveUserId(param)
                if (!userId) {
                    return { comics: [], maxPage: page }
                }
                let res = await this.apiGet('/v1/user/illusts', {
                    filter: 'for_android',
                    user_id: userId,
                    offset: offset || null,
                })
                let json = this.check(res)
                return { comics: this.parseIllustList(json), maxPage: this.pagedMax(json, page) }
            }
            let res = await this.apiGet('/v1/search/illust', {
                filter: 'for_android',
                merge_plain_keyword_results: true,
                word: param || category,
                search_target: 'exact_match_for_tags',
                sort: sort,
                offset: offset || null,
            })
            let json = this.check(res)
            return { comics: this.parseIllustList(json), maxPage: this.pagedMax(json, page) }
        },

        optionList: [
            {
                label: "排序",
                options: [
                    "date_desc-最新",
                    "date_asc-最早",
                    "popular_desc-热门",
                ],
                notShowWhen: ['artist'],
            },
        ],

        ranking: {
            options: [
                "day-日榜",
                "day_male-男性向日榜",
                "day_female-女性向日榜",
                "week_original-原创周榜",
                "week_rookie-新人周榜",
                "week-周榜",
                "month-月榜",
                "day_ai-AI 日榜",
                "day_r18_ai-R18 AI 日榜",
                "day_r18-R18 日榜",
                "week_r18-R18 周榜",
                "week_r18g-R18G 周榜",
            ],
            load: async (option, page) => {
                let offset = (page - 1) * 30
                let res = await this.apiGet('/v1/illust/ranking', {
                    filter: 'for_android',
                    mode: option,
                    offset: offset || null,
                })
                let json = this.check(res)
                return { comics: this.parseIllustList(json), maxPage: this.pagedMax(json, page) }
            },
        },
    }

    search = {
        loadNext: async (keyword, options, next) => {
            let sort = options[0] || 'date_desc'
            let target = options[1] || 'partial_match_for_tags'
            let res = await this.apiGet(next || '/v1/search/illust', next ? null : {
                filter: 'for_android',
                merge_plain_keyword_results: true,
                word: keyword,
                sort: sort,
                search_target: target,
            })
            let json = this.check(res)
            return {
                comics: this.parseIllustList(json),
                next: json.next_url ? this.fixNextUrl(json.next_url) : null,
            }
        },

        optionList: [
            {
                label: "排序",
                options: [
                    "date_desc-最新",
                    "date_asc-最早",
                    "popular_desc-热门",
                ],
            },
            {
                label: "搜索范围",
                options: [
                    "partial_match_for_tags-标签(部分匹配)",
                    "exact_match_for_tags-标签(完整匹配)",
                    "title_and_caption-标题与简介",
                ],
            },
        ],

        enableTagsSuggestions: true,

        onTagSuggestionSelected: (namespace, tag) => tag,
    }

    tagFolderId(restrict, name) {
        return 'tag:' + (restrict || 'public') + ':' + name
    }

    parseTagFolder(folderId) {
        if (!folderId || folderId.indexOf('tag:') !== 0) return null
        let rest = folderId.substring(4)
        let idx = rest.indexOf(':')
        if (idx < 0) return null
        return { restrict: rest.substring(0, idx), name: rest.substring(idx + 1) }
    }

    buildBookmarkBody(comicId, restrict, tags) {
        let body = `illust_id=${encodeURIComponent(comicId)}&restrict=${encodeURIComponent(restrict || 'public')}`
        for (let tag of (tags || [])) {
            body += `&tags[]=${encodeURIComponent(tag)}`
        }
        return body
    }

    async getBookmarkDetail(comicId) {
        let res = await this.apiGet('/v2/illust/bookmark/detail', { illust_id: comicId })
        if (res.status !== 200) {
            return null
        }
        return JSON.parse(res.body).bookmark_detail || null
    }

    favorites = {
        multiFolder: true,

        addOrDelFavorite: async (comicId, folderId, isAdding, favoriteId) => {
            this.requireAccount()
            let parts = this.parseTagFolder(folderId)
            if (!isAdding) {
                if (!parts) {
                    let res = await this.apiPost('/v1/illust/bookmark/delete',
                        `illust_id=${encodeURIComponent(comicId)}`)
                    return this.assertOk(res, 'Failed to delete favorite')
                }
                let detail = await this.getBookmarkDetail(comicId)
                if (!detail || !detail.is_bookmarked) {
                    return 'ok'
                }
                let remaining = (detail.tags || [])
                    .map(t => t.name)
                    .filter(n => n !== parts.name)
                let res = await this.apiPost('/v2/illust/bookmark/add',
                    this.buildBookmarkBody(comicId, detail.restrict || parts.restrict || 'public', remaining))
                return this.assertOk(res, 'Failed to update favorite')
            }
            if (!parts) {
                let detail = await this.getBookmarkDetail(comicId)
                let tags = detail && detail.is_bookmarked ? (detail.tags || []).map(t => t.name) : []
                let res = await this.apiPost('/v2/illust/bookmark/add',
                    this.buildBookmarkBody(comicId, folderId, tags))
                return this.assertOk(res, 'Failed to add favorite')
            }
            let detail = await this.getBookmarkDetail(comicId)
            let restrict = detail && detail.is_bookmarked && detail.restrict ? detail.restrict : parts.restrict
            let tags = detail && detail.is_bookmarked ? (detail.tags || []).map(t => t.name) : []
            if (tags.indexOf(parts.name) < 0) {
                tags.push(parts.name)
            }
            let res = await this.apiPost('/v2/illust/bookmark/add',
                this.buildBookmarkBody(comicId, restrict, tags))
            return this.assertOk(res, 'Failed to add favorite')
        },

        loadFolders: async (comicId) => {
            this.requireAccount()
            let folders = {
                'public': '公开收藏',
                'private': '私密收藏',
            }
            let favorited = []
            let detail = null
            if (comicId) {
                try {
                    detail = await this.getBookmarkDetail(comicId)
                } catch (e) {
                }
            }
            let userId = this.getUserId()
            for (let restrict of ['public', 'private']) {
                try {
                    let res = await this.apiGet('/v1/user/bookmark-tags/illust', {
                        user_id: userId || null,
                        restrict: restrict,
                    })
                    if (res.status === 200) {
                        let json = JSON.parse(res.body)
                        for (let tag of (json.bookmark_tags || [])) {
                            folders[this.tagFolderId(restrict, tag.name)] = `${tag.name} (${tag.count})`
                        }
                    }
                } catch (e) {
                }
            }
            if (detail && detail.is_bookmarked) {
                let restrict = detail.restrict || 'public'
                favorited.push(restrict)
                for (let tag of (detail.tags || [])) {
                    favorited.push(this.tagFolderId(restrict, tag.name))
                }
            }
            return { folders: folders, favorited: favorited }
        },

        addFolder: async (name) => {
            let res = await this.apiPost('/v1/user/bookmark-tags/illust',
                `tag=${encodeURIComponent(name)}&restrict=public`)
            return this.assertOk(res, 'Failed to add folder')
        },

        deleteFolder: async (folderId) => {
            let parts = this.parseTagFolder(folderId)
            if (!parts) {
                throw 'Invalid folder'
            }
            let res = await this.apiDelete('/v1/user/bookmark-tags/illust', {
                tag: parts.name,
                restrict: parts.restrict,
            })
            return this.assertOk(res, 'Failed to delete folder')
        },

        loadNext: async (next, folder) => {
            this.requireAccount()
            let userId = this.getUserId()
            let restrict = 'public'
            let tag = null
            let parts = this.parseTagFolder(folder)
            if (parts) {
                restrict = parts.restrict
                tag = parts.name
            } else if (folder === 'private') {
                restrict = 'private'
            }
            let res = await this.apiGet(next || '/v1/user/bookmarks/illust', next ? null : {
                user_id: userId,
                restrict: restrict,
                tag: tag,
                filter: 'for_android',
            })
            let json = this.check(res)
            return {
                comics: this.parseIllustList(json),
                next: json.next_url ? this.fixNextUrl(json.next_url) : null,
            }
        },

        singleFolderForSingleComic: false,
    }

    comic = {
        loadInfo: async (id) => {
            let detailRes = await this.apiGet('/v1/illust/detail', {
                illust_id: id,
                filter: 'for_android',
            })
            let json = this.check(detailRes)
            let illust = json.illust
            let related = []
            try {
                let relatedRes = await this.apiGet('/v2/illust/related', {
                    illust_id: id,
                    filter: 'for_android',
                })
                if (relatedRes.status === 200) {
                    related = this.parseIllustList(JSON.parse(relatedRes.body))
                }
            } catch (e) {
            }
            let tags = {}
            if (illust.user) {
                tags['作者'] = [illust.user.name]
            }
            tags['标签'] = (illust.tags || []).map(tag => tag.name)
            let chapters = {}
            let series = await this.fetchSeriesIllusts(illust)
            if (series) {
                // 连载系列: 每件作品作为一个章节, 章节 id 为该作品的 illust id
                for (let i = 0; i < series.length; i++) {
                    let work = series[i]
                    chapters[String(work.id)] = work.title || `第 ${i + 1} 篇`
                }
            } else if ((illust.page_count || 1) > 1) {
                chapters['0'] = `1-${illust.page_count}`
            }
            return new ComicDetails({
                title: illust.title,
                subtitle: illust.user ? illust.user.name : "",
                cover: this.rewriteHost(this.pickCover(illust)),
                description: this.cleanCaption(illust.caption),
                tags: tags,
                chapters: chapters,
                isFavorite: illust.is_bookmarked || false,
                recommend: related,
                commentCount: illust.total_comments || 0,
                likesCount: illust.total_bookmarks || 0,
                uploader: illust.user ? illust.user.name : "",
                uploadTime: illust.create_date,
                updateTime: illust.create_date,
                url: `https://www.pixiv.net/artworks/${illust.id}`,
                maxPage: illust.page_count || 1,
            })
        },

        loadEp: async (comicId, epId) => {
            // 系列章节的 epId 是系列中另一件作品的 illust id;
            // 单作品多页时章节 id 为 '0', 需回退到 comicId
            let targetId = epId && epId !== '0' ? epId : comicId
            let res = await this.apiGet('/v1/illust/detail', {
                illust_id: targetId,
                filter: 'for_android',
            })
            let illust = this.check(res).illust
            let quality = this.loadSetting('imageQuality') || 'large'
            let images = []
            if (illust.meta_pages && illust.meta_pages.length > 0) {
                for (let page of illust.meta_pages) {
                    let url = this.pickPageUrl(page.image_urls, quality)
                    if (url) {
                        images.push(this.rewriteHost(url))
                    }
                }
            } else {
                let url = this.pickSingleUrl(illust, quality)
                if (url) {
                    images.push(this.rewriteHost(url))
                }
            }
            return { images: images }
        },

        loadThumbnails: async (id, next) => {
            let res = await this.apiGet('/v1/illust/detail', {
                illust_id: id,
                filter: 'for_android',
            })
            let illust = this.check(res).illust
            let quality = this.loadSetting('imageQuality') || 'large'
            let thumbQuality = quality === 'original' ? 'large' : quality
            let thumbnails = []
            if (illust.meta_pages && illust.meta_pages.length > 0) {
                for (let page of illust.meta_pages) {
                    let url = this.pickPageUrl(page.image_urls, thumbQuality)
                    if (url) {
                        thumbnails.push(this.rewriteHost(url))
                    }
                }
            } else {
                let url = this.pickSingleUrl(illust, thumbQuality)
                if (url) {
                    thumbnails.push(this.rewriteHost(url))
                }
            }
            return { thumbnails: thumbnails, next: null }
        },

        onImageLoad: (url, comicId, epId) => {
            return {
                url: this.rewriteHost(url),
                headers: {
                    "referer": this.BASE_API + "/",
                    "user-agent": "PixivIOSApp/5.8.0",
                },
            }
        },

        onThumbnailLoad: (url) => {
            return {
                url: this.rewriteHost(url),
                headers: {
                    "referer": this.BASE_API + "/",
                    "user-agent": "PixivIOSApp/5.8.0",
                },
            }
        },

        loadComments: async (comicId, subId, page, replyTo) => {
            let comments = []
            let json
            if (replyTo) {
                let res = await this.apiGet('/v2/illust/comment/replies', {
                    comment_id: replyTo,
                    offset: page > 1 ? (page - 1) * 20 : null,
                })
                json = this.check(res)
            } else {
                let res = await this.apiGet('/v3/illust/comments', {
                    illust_id: comicId,
                    offset: page > 1 ? (page - 1) * 20 : null,
                })
                json = this.check(res)
            }
            for (let item of (json.comments || [])) {
                comments.push(this.parseComment(item))
            }
            return { comments: comments, maxPage: json.next_url ? page + 1 : page }
        },

        sendComment: async (comicId, subId, content, replyTo) => {
            this.requireAccount()
            let body = `illust_id=${encodeURIComponent(comicId)}&comment=${encodeURIComponent(content)}`
            if (replyTo) {
                body += `&parent_comment_id=${encodeURIComponent(replyTo)}`
            }
            let res = await this.apiPost('/v1/illust/comment/add', body)
            return this.assertOk(res, 'Failed to send comment')
        },

        idMatch: "^(\\d+)$",

        onClickTag: (namespace, tag) => {
            if (namespace === '作者') {
                return {
                    page: 'category',
                    attributes: {
                        category: 'artist',
                        param: tag,
                    },
                }
            }
            return {
                page: 'search',
                attributes: {
                    keyword: tag,
                },
            }
        },

        link: {
            domains: [
                'pixiv.net',
                'www.pixiv.net',
            ],
            linkToId: (url) => {
                let match = url.match(/artworks\/(\d+)/) || url.match(/[?&]illust_id=(\d+)/)
                return match ? match[1] : null
            },
        },

        enableTagsTranslate: true,
    }

    parseComment(item) {
        let user = item.user || {}
        let profile = user.profile_image_urls || {}
        return new Comment({
            userName: user.name || "",
            avatar: profile.medium ? this.rewriteHost(profile.medium) : undefined,
            content: item.comment || "",
            time: item.date,
            replyCount: item.has_replies ? 1 : 0,
            id: item.id !== undefined ? String(item.id) : undefined,
        })
    }

    async loadAiShowSetting() {
        this.requireAccount()
        let res = await this.apiGet('/v1/user/ai-show-settings')
        return !!this.check(res).show_ai
    }

    async setAiShowSetting(show) {
        let res = await this.apiPost('/v1/user/ai-show-settings/edit',
            `show_ai=${show ? 'true' : 'false'}`)
        return this.assertOk(res, 'Failed to update AI display setting')
    }

    async loadRestrictedModeSetting() {
        this.requireAccount()
        let res = await this.apiGet('/v1/user/restricted-mode-settings')
        return !!this.check(res).is_restricted_mode_enabled
    }

    async setRestrictedModeSetting(enabled) {
        let res = await this.apiPost('/v1/user/restricted-mode-settings',
            `is_restricted_mode_enabled=${enabled ? 'true' : 'false'}`)
        return this.assertOk(res, 'Failed to update restricted mode setting')
    }

    settings = {
        apiHost: {
            title: "API 地址",
            type: "input",
            validator: null,
            default: "app-api.pixiv.net",
        },
        oauthHost: {
            title: "OAuth 地址",
            type: "input",
            validator: null,
            default: "oauth.secure.pixiv.net",
        },
        imageQuality: {
            title: "图片质量",
            type: "select",
            options: [
                { value: 'medium', text: '中' },
                { value: 'large', text: '大' },
                { value: 'original', text: '原图' },
            ],
            default: 'large',
        },
        imageHost: {
            title: "图片域名",
            type: "select",
            options: [
                { value: 'i.pximg.net', text: 'i.pximg.net' },
                { value: 'i.pixiv.re', text: 'i.pixiv.re' },
                { value: 'custom', text: '自定义' },
            ],
            default: 'i.pximg.net',
        },
        customImageHost: {
            title: "自定义图片域名",
            type: "input",
            validator: null,
            default: "",
        },
        ai_show_settings: {
            title: "AI 作品显示",
            type: "callback",
            buttonText: "查询 / 切换",
            callback: async () => {
                try {
                    let current = await this.loadAiShowSetting()
                    let index = await UI.showSelectDialog("AI 作品显示",
                        ["显示 AI 作品", "隐藏 AI 作品"], current ? 0 : 1)
                    if (index === null || index === undefined) {
                        return
                    }
                    let next = index === 0
                    if (next === current) {
                        UI.showMessage("未更改")
                        return
                    }
                    await this.setAiShowSetting(next)
                    UI.showMessage(`已${next ? '显示' : '隐藏'} AI 作品`)
                } catch (e) {
                    UI.showMessage(String(e))
                }
            },
        },
        restricted_mode_settings: {
            title: "浏览限制(R-18)",
            type: "callback",
            buttonText: "查询 / 切换",
            callback: async () => {
                try {
                    let enabled = await this.loadRestrictedModeSetting()
                    let index = await UI.showSelectDialog("浏览限制(R-18)",
                        ["不受限 (显示 R-18)", "开启浏览限制 (隐藏 R-18)"], enabled ? 1 : 0)
                    if (index === null || index === undefined) {
                        return
                    }
                    let next = index === 1
                    if (next === enabled) {
                        UI.showMessage("未更改")
                        return
                    }
                    await this.setRestrictedModeSetting(next)
                    UI.showMessage(next ? "已开启浏览限制 (隐藏 R-18)" : "已关闭浏览限制 (显示 R-18)")
                } catch (e) {
                    UI.showMessage(String(e))
                }
            },
        },
        refresh_recommend_users: {
            title: "刷新推荐画师",
            type: "callback",
            buttonText: "立即刷新",
            callback: async () => {
                if (!this.hasAccount(this.activeAccount)) {
                    UI.showMessage("请先登录")
                    return
                }
                await this.refreshRecommendUsers()
                UI.showMessage(`推荐画师已更新 (${this.getRecommendUsers().length} 位)`)
            },
        },
        sub_accounts: {
            title: "附属账号列表",
            type: "input",
            validator: null,
            default: "[]",
            description: "JSON 数组, 格式 [{\"name\":\"小号1\",\"username\":\"用户名\",\"password\":\"密码\"}]; 密码明文存储",
        },
        login_sub_accounts: {
            title: "登录附属账号",
            type: "callback",
            buttonText: "登录所有附属账号",
            callback: async () => {
                let subs = this.subAccounts()
                if (subs.length === 0) {
                    UI.showMessage("请先在附属账号列表中添加账号")
                    return
                }
                let ok = 0
                for (let i = 0; i < subs.length; i++) {
                    let acc = subs[i]
                    try {
                        let body = `client_id=${this.CLIENT_ID}&client_secret=${this.CLIENT_SECRET}` +
                            `&grant_type=password&username=${encodeURIComponent(acc.username)}` +
                            `&password=${encodeURIComponent(acc.password)}` +
                            `&Device_token=pixiv&get_secure_url=true&include_policy=true`
                        let res = await Network.post(this.oauthUrl + '/auth/token',
                            this.buildHeaders(false, "application/x-www-form-urlencoded"), body)
                        if (res.status === 200) {
                            this.saveToken(JSON.parse(res.body), i + 1)
                            ok++
                        } else {
                            UI.showMessage(`${this.accountName(i + 1)}: ${this.parseAuthError(res.body)}`)
                        }
                    } catch (e) {
                        UI.showMessage(`${this.accountName(i + 1)}: ${e}`)
                    }
                }
                UI.showMessage(`附属账号登录: ${ok}/${subs.length} 成功`)
            },
        },
        clear_sub_accounts: {
            title: "清除附属账号",
            type: "callback",
            buttonText: "清除所有附属账号TOKEN",
            callback: () => {
                let subs = this.subAccounts()
                for (let i = 0; i < subs.length; i++) {
                    this.deleteData(`access_token_${i + 1}`)
                    this.deleteData(`refresh_token_${i + 1}`)
                    this.deleteData(`user_id_${i + 1}`)
                }
                this.saveData('active_account', '0')
                UI.showMessage("已清除所有附属账号TOKEN")
            },
        },
        switch_account: {
            title: "切换当前账号",
            type: "callback",
            buttonText: "选择当前账号",
            callback: async () => {
                let options = []
                for (let i = 0; i < this.accountCount(); i++) {
                    options.push(`${this.accountName(i)}${this.hasAccount(i) ? '' : ' (未登录)'}`)
                }
                let index = await UI.showSelectDialog("选择当前账号", options, Math.min(this.activeAccount, this.accountCount() - 1))
                if (index === null || index === undefined) {
                    return
                }
                this.saveData('active_account', String(index))
                this.refreshRecommendUsers()
                UI.showMessage(`已切换到 ${this.accountName(index)}`)
            },
        },
    }

    translation = {
        'zh_CN': {
            '推荐插画': '推荐插画',
            '推荐漫画': '推荐漫画',
            '关注新作': '关注新作',
            '综合日榜': '综合日榜',
            '热门标签': '热门标签',
            'Pixiv': 'Pixiv',
            '排序': '排序',
            '搜索范围': '搜索范围',
            '最新': '最新',
            '最早': '最早',
            '热门': '热门',
            '标签(部分匹配)': '标签(部分匹配)',
            '标签(完整匹配)': '标签(完整匹配)',
            '标题与简介': '标题与简介',
            '日榜': '日榜',
            '周榜': '周榜',
            '月榜': '月榜',
            '男性向日榜': '男性向日榜',
            '女性向日榜': '女性向日榜',
            '新人周榜': '新人周榜',
            '原创周榜': '原创周榜',
            'AI 日榜': 'AI 日榜',
            'R18 AI 日榜': 'R18 AI 日榜',
            'R18 日榜': 'R18 日榜',
            'R18 周榜': 'R18 周榜',
            'R18G 周榜': 'R18G 周榜',
            '公开收藏': '公开收藏',
            '私密收藏': '私密收藏',
            '作者': '作者',
            '标签': '标签',
            'API 地址': 'API 地址',
            'OAuth 地址': 'OAuth 地址',
            '图片质量': '图片质量',
            '图片域名': '图片域名',
            '中': '中',
            '大': '大',
            '原图': '原图',
            '自定义': '自定义',
            '自定义图片域名': '自定义图片域名',
            '附属账号列表': '附属账号列表',
            '登录附属账号': '登录附属账号',
            '清除附属账号': '清除附属账号',
            '切换当前账号': '切换当前账号',
            'AI 作品显示': 'AI 作品显示',
            '浏览限制(R-18)': '浏览限制(R-18)',
            '推荐画师': '推荐画师',
            '刷新推荐画师': '刷新推荐画师',
        },
        'zh_TW': {
            '推荐插画': '推薦插畫',
            '推荐漫画': '推薦漫畫',
            '关注新作': '關注新作',
            '综合日榜': '綜合日榜',
            '热门标签': '熱門標籤',
            '排序': '排序',
            '搜索范围': '搜尋範圍',
            '最新': '最新',
            '最早': '最早',
            '热门': '熱門',
            '标签(部分匹配)': '標籤(部分匹配)',
            '标签(完整匹配)': '標籤(完整匹配)',
            '标题与简介': '標題與簡介',
            '日榜': '日榜',
            '周榜': '週榜',
            '月榜': '月榜',
            '男性向日榜': '男性向日榜',
            '女性向日榜': '女性向日榜',
            '新人周榜': '新人週榜',
            '原创周榜': '原創週榜',
            'AI 日榜': 'AI 日榜',
            'R18 AI 日榜': 'R18 AI 日榜',
            'R18 日榜': 'R18 日榜',
            'R18 周榜': 'R18 週榜',
            'R18G 周榜': 'R18G 週榜',
            '公开收藏': '公開收藏',
            '私密收藏': '私密收藏',
            '作者': '作者',
            '标签': '標籤',
            'API 地址': 'API 位址',
            'OAuth 地址': 'OAuth 位址',
            '图片质量': '圖片品質',
            '图片域名': '圖片網域',
            '中': '中',
            '大': '大',
            '原图': '原圖',
            '自定义': '自訂',
            '自定义图片域名': '自訂圖片網域',
            '附属账号列表': '附屬帳號列表',
            '登录附属账号': '登入附屬帳號',
            '清除附属账号': '清除附屬帳號',
            '切换当前账号': '切換目前帳號',
            'AI 作品显示': 'AI 作品顯示',
            '浏览限制(R-18)': '瀏覽限制(R-18)',
            '推荐画师': '推薦畫師',
            '刷新推荐画师': '重新整理推薦畫師',
        },
        'en': {
            '推荐插画': 'Recommended Illustrations',
            '推荐漫画': 'Recommended Manga',
            '关注新作': 'Following',
            '综合日榜': 'Daily Ranking',
            '热门标签': 'Trending Tags',
            '排序': 'Sort',
            '搜索范围': 'Search Target',
            '最新': 'Newest',
            '最早': 'Oldest',
            '热门': 'Popular',
            '标签(部分匹配)': 'Tags (partial)',
            '标签(完整匹配)': 'Tags (exact)',
            '标题与简介': 'Title & Caption',
            '日榜': 'Daily',
            '周榜': 'Weekly',
            '月榜': 'Monthly',
            '男性向日榜': 'Daily Male',
            '女性向日榜': 'Daily Female',
            '新人周榜': 'Weekly Rookie',
            '原创周榜': 'Weekly Original',
            'AI 日榜': 'Daily AI',
            'R18 AI 日榜': 'Daily R18 AI',
            'R18 日榜': 'Daily R18',
            'R18 周榜': 'Weekly R18',
            'R18G 周榜': 'Weekly R18G',
            '公开收藏': 'Public',
            '私密收藏': 'Private',
            '作者': 'Artist',
            '标签': 'Tags',
            'API 地址': 'API Host',
            'OAuth 地址': 'OAuth Host',
            '图片质量': 'Image Quality',
            '图片域名': 'Image Host',
            '中': 'Medium',
            '大': 'Large',
            '原图': 'Original',
            '自定义': 'Custom',
            '自定义图片域名': 'Custom Image Host',
            '附属账号列表': 'Sub-accounts',
            '登录附属账号': 'Login Sub-accounts',
            '清除附属账号': 'Clear Sub-accounts',
            '切换当前账号': 'Switch Account',
            'AI 作品显示': 'AI Work Display',
            '浏览限制(R-18)': 'Restricted Mode (R-18)',
            '推荐画师': 'Recommended Artists',
            '刷新推荐画师': 'Refresh Recommended Artists',
        },
    }
}
