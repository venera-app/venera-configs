/** @type {import('./_venera_.js')} */

class Pixiv extends ComicSource {

    // ============================================================
    //  BASIC INFO
    // ============================================================
    name = "Pixiv"
    key = "pixiv"
    version = "2.0.0"
    minAppVersion = "1.6.0"
    url = "https://cdn.jsdelivr.net/gh/theoldman-lab/venera-configs@main/pixiv.js"

    // ============================================================
    //  CONSTANTS (ref: PIXIV_API.md §1, PixEz OAuthClient)
    // ============================================================
    static AUTH_URL      = "https://oauth.secure.pixiv.net/auth/token"
    static CLIENT_ID     = "MOBrBDS8blbauoSck0ZfDbtuzpyT"
    static CLIENT_SECRET = "lsACyCD94FhDUtGTXi3QzcFE2uU1hqtDaKeqrdwj"
    static HASH_SECRET   = "28c1fdd170a5204386cb1313c7077b34f83e4aaf4aa829ce78c231e05b0bae2c"
    static USER_AGENT    = "PixivAndroidApp/5.0.166 (Android 10.0; Pixel C)"

    get apiBase() {
        return this.loadSetting('apiHost') || 'https://app-api.pixiv.net'
    }

    // ============================================================
    //  SIGN HEADERS (ref: PIXIV_API.md §3.1)
    // ============================================================

    getSignHeaders() {
        let d = new Date()
        let time = d.toISOString().replace(/\.\d+Z$/, '+00:00')
        let hash = Convert.hexEncode(
            Convert.md5(Convert.encodeUtf8(time + Pixiv.HASH_SECRET))
        )
        return {
            'X-Client-Time':    time,
            'X-Client-Hash':    hash,
            'User-Agent':       Pixiv.USER_AGENT,
            'App-OS':           'Android',
            'App-OS-Version':   'Android 10.0',
            'App-Version':      '5.0.166',
            'Accept-Language':  'zh-cn'
        }
    }

    getApiHeaders() {
        let token = this.loadData('access_token')
        if (!token) return null
        let h = this.getSignHeaders()
        h['Authorization'] = 'Bearer ' + token
        h['Host'] = 'app-api.pixiv.net'
        return h
    }

    getPostHeaders() {
        let h = this.getApiHeaders()
        if (!h) return null
        h['Content-Type'] = 'application/x-www-form-urlencoded'
        return h
    }

    // ============================================================
    //  TOKEN REFRESH (ref: PixEz OAuthClient.postRefreshAuthToken)
    // ============================================================

    async refreshToken() {
        let refreshToken = this.loadData('refresh_token')
        if (!refreshToken) throw 'No refresh token'

        let body = [
            'client_id=' + encodeURIComponent(Pixiv.CLIENT_ID),
            'client_secret=' + encodeURIComponent(Pixiv.CLIENT_SECRET),
            'grant_type=refresh_token',
            'refresh_token=' + encodeURIComponent(refreshToken),
            'include_policy=true'
        ].join('&')

        let res = await Network.post(Pixiv.AUTH_URL, this.getSignHeaders(), body)
        if (res.status !== 200) throw 'Token refresh failed: HTTP ' + res.status

        let json = JSON.parse(res.body)
        let resp = json.response
        if (!resp || !resp.access_token) throw 'Invalid token response'

        this._saveTokenResponse(resp)
        return resp.access_token
    }

    _saveTokenResponse(resp) {
        this.saveData('access_token', resp.access_token)
        this.saveData('refresh_token', resp.refresh_token)
        if (resp.user) {
            this.saveData('user_id', resp.user.id.toString())
            this.saveData('user_name', resp.user.name)
            this.saveData('user_account', resp.user.account)
        }
    }

    // ============================================================
    //  OAUTH ERROR DETECTION (ref: PixEz RefreshTokenInterceptor)
    // ============================================================

    _isOAuthError(res) {
        if (!res) return false
        if (res.status === 400 || res.status === 401) {
            try {
                let json = JSON.parse(res.body)
                let msg = json?.error?.message || json?.errors?.system?.message || ''
                if (msg.indexOf('OAuth') !== -1) return true
            } catch (e) {}
            if (res.status === 401) return true
        }
        return false
    }

    // ============================================================
    //  _ensureToken — exchange pending token before API calls
    // ============================================================

    async _ensureToken() {
        let pending = this.loadData('pending_refresh_token')
        if (!pending) return
        this.deleteData('pending_refresh_token')
        this.saveData('refresh_token', pending)
        try {
            await this.refreshToken()
        } catch (e) {
            this.deleteData('refresh_token')
        }
    }

    // ============================================================
    //  HTTP HELPERS (with auto token exchange + refresh)
    // ============================================================

    async apiGet(url) {
        await this._ensureToken()
        let headers = this.getApiHeaders()
        if (!headers) throw 'Login expired'

        let res = await Network.get(url, headers)
        if (this._isOAuthError(res)) {
            await this.refreshToken()
            headers = this.getApiHeaders()
            res = await Network.get(url, headers)
        }
        if (res.status !== 200) throw 'HTTP ' + res.status + ': ' + url
        return JSON.parse(res.body)
    }

    async apiPost(url, body) {
        await this._ensureToken()
        let headers = this.getPostHeaders()
        if (!headers) throw 'Login expired'

        let res = await Network.post(url, headers, body)
        if (this._isOAuthError(res)) {
            await this.refreshToken()
            headers = this.getPostHeaders()
            res = await Network.post(url, headers, body)
        }
        if (res.status !== 200) throw 'HTTP ' + res.status + ': ' + url
        return JSON.parse(res.body)
    }

    // ============================================================
    //  LOCALSTORAGE TOKEN EXTRACTION
    //
    //  After WebView login at accounts.pixiv.net, Pixiv's web SPA
    //  stores OAuth tokens in localStorage. Venera captures this
    //  as _localStorage (per _template_.js loginWithWebview docs).
    //
    //  We search multiple paths since the exact key structure
    //  depends on Pixiv's frontend implementation.
    // ============================================================

    _extractRefreshToken(storage) {
        if (!storage) return null
        if (typeof storage === 'string') {
            try { storage = JSON.parse(storage) } catch (e) { return null }
        }
        if (!storage || typeof storage !== 'object') return null

        if (storage.token) {
            let t = typeof storage.token === 'string'
                ? (() => { try { return JSON.parse(storage.token) } catch (e) { return null } })()
                : storage.token
            if (t && t.refresh_token) return t.refresh_token
        }

        if (storage.refresh_token) return storage.refresh_token

        for (let key of Object.keys(storage)) {
            try {
                let val = storage[key]
                if (typeof val === 'string') {
                    try { val = JSON.parse(val) } catch (e) { continue }
                }
                if (val && typeof val === 'object' && val.refresh_token) {
                    return val.refresh_token
                }
            } catch (e) {}
        }

        return null
    }

    // ============================================================
    //  UTILITY — parse Pixiv illust to Venera Comic
    // ============================================================

    parseIllust(illust) {
        let cover = illust.image_urls.medium
        if (illust.page_count > 1 && illust.meta_pages && illust.meta_pages.length > 0) {
            cover = illust.meta_pages[0].image_urls.medium
        }
        let tags = (illust.tags || []).map(function(t) { return t.translated_name || t.name })
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

    // ============================================================
    //  EXPLORE — following illust feed
    //  (ref: PixEz ApiClient.getFollowIllusts + getNext)
    //
    //  GET /v2/illust/follow?restrict=all
    //  Response: { illusts: [...], next_url: "/v2/..." | null }
    // ============================================================

    explore = [
        {
            title: "Following",
            type: "multiPageComicList",

            loadNext: async (next) => {
                let url = next
                    ? this.apiBase + next
                    : this.apiBase + '/v2/illust/follow?restrict=all'

                let json = await this.apiGet(url)
                let comics = (json.illusts || []).map((function(e) { return this.parseIllust(e) }).bind(this))

                return { comics: comics, next: json.next_url || null }
            },
        }
    ]

    // ============================================================
    //  COMIC — detail view + image loading
    // ============================================================

    comic = {

        loadInfo: async (id) => {
            let json = await this.apiGet(
                this.apiBase + '/v1/illust/detail?illust_id=' + id)
            let illust = json.illust
            if (!illust) throw 'Illust not found'

            let chapters = new Map()
            if (illust.page_count > 1 && illust.meta_pages && illust.meta_pages.length > 0) {
                for (let i = 0; i < illust.meta_pages.length; i++) {
                    chapters.set(i.toString(), 'Page ' + (i + 1))
                }
            } else {
                chapters.set('0', illust.title)
            }

            return new ComicDetails({
                title: illust.title,
                subtitle: illust.user.name,
                cover: illust.image_urls.medium,
                description: illust.caption || '',
                chapters: chapters,
                url: 'https://www.pixiv.net/artworks/' + illust.id,
                commentCount: illust.total_comments || 0,
                likesCount: illust.total_bookmarks || 0,
                uploadTime: illust.create_date,
                maxPage: illust.page_count || 1
            })
        },

        loadEp: async (comicId, epId) => {
            let json = await this.apiGet(
                this.apiBase + '/v1/illust/detail?illust_id=' + comicId)
            let illust = json.illust
            if (!illust) throw 'Illust not found'

            let images = []
            if (illust.page_count <= 1 || !illust.meta_pages || illust.meta_pages.length === 0) {
                let url = illust.meta_single_page?.original_image_url
                    || illust.image_urls.large
                images.push(url)
            } else {
                let idx = parseInt(epId || '0')
                let page = illust.meta_pages[idx]
                if (page) {
                    let url = page.image_urls.original || page.image_urls.large
                    images.push(url)
                }
            }
            return { images: images }
        },

        onImageLoad: (url, comicId, epId) => {
            return {
                headers: {
                    'Referer': 'https://app-api.pixiv.net/',
                    'User-Agent': Pixiv.USER_AGENT
                }
            }
        },

        onThumbnailLoad: (url) => {
            return {
                headers: {
                    'Referer': 'https://app-api.pixiv.net/',
                    'User-Agent': Pixiv.USER_AGENT
                }
            }
        },

        idMatch: "^\\d+$",
    }

    // ============================================================
    //  ACCOUNT
    //
    //  Primary:  WebView opens accounts.pixiv.net/login.
    //            After login, Pixiv redirects to www.pixiv.net and
    //            stores OAuth tokens in localStorage. Venera
    //            captures this automatically as _localStorage.
    //
    //  Fallback: Manual refresh_token via account parameter.
    // ============================================================

    account = {

        loginWithWebview: {
            url: "https://accounts.pixiv.net/login?lang=zh",

            checkStatus: (url, title) => {
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
                    let token = this._extractRefreshToken(storage)
                    if (token) {
                        this.saveData('pending_refresh_token', token)
                    }
                } catch (e) {}
            },
        },

        login: async (account, pwd) => {
            // 1) pending token from WebView login
            let pending = this.loadData('pending_refresh_token')
            if (pending) {
                this.deleteData('pending_refresh_token')
                this.saveData('refresh_token', pending)
                try {
                    await this.refreshToken()
                    return 'ok'
                } catch (e) {
                    this.deleteData('refresh_token')
                    throw 'Login failed: unable to exchange token'
                }
            }

            // 2) stored refresh_token from previous session
            if (this.loadData('refresh_token')) {
                try {
                    await this.refreshToken()
                    return 'ok'
                } catch (e) {
                    throw 'Login failed: unable to refresh token'
                }
            }

            // 3) manual refresh_token via account parameter
            let manual = (account || '').trim()
            if (manual) {
                this.saveData('refresh_token', manual)
                try {
                    await this.refreshToken()
                    return 'ok'
                } catch (e) {
                    this.deleteData('refresh_token')
                    throw 'Login failed: invalid refresh token'
                }
            }

            throw 'Please login via WebView first, or provide a valid refresh_token'
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

    // ============================================================
    //  SETTINGS
    // ============================================================

    settings = {
        apiHost: {
            title: "API Host",
            type: "input",
            default: "https://app-api.pixiv.net",
            validator: "^https?://.+"
        }
    }

    // ============================================================
    //  TRANSLATION
    // ============================================================

    translation = {
        'zh_CN': {
            'API Host': 'API 地址',
            'Following': '关注',
        },
        'zh_TW': {
            'API Host': 'API 位址',
            'Following': '關注',
        },
        'en': {}
    }
}
