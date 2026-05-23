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
    static REDIRECT_URI  = "https://app-api.pixiv.net/web/v1/users/auth/pixiv/callback"
    static PKCE_CHARS    = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~"

    get apiBase() {
        return this.loadSetting('apiHost') || 'https://app-api.pixiv.net'
    }

    // ============================================================
    //  INIT — setup PKCE login URL before WebView opens
    //  (ref: PixEz CryptoPlugin + OAuthClient.generateWebviewUrl)
    // ============================================================

    init() {
        let verifier = this._generateCodeVerifier()
        this.saveData('_pkce_verifier', verifier)
        let challenge = this._generateCodeChallenge(verifier)
        this.account.loginWithWebview.url =
            'https://app-api.pixiv.net/web/v1/login' +
            '?code_challenge=' + challenge +
            '&code_challenge_method=S256' +
            '&client=pixiv-android'
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
    //  PKCE — code_verifier / code_challenge
    //  (ref: PixEz CryptoPlugin)
    // ============================================================

    _generateCodeVerifier() {
        let chars = Pixiv.PKCE_CHARS
        let result = ''
        for (let i = 0; i < 128; i++) {
            result += chars[randomInt(0, chars.length - 1)]
        }
        return result
    }

    _generateCodeChallenge(verifier) {
        let hash = Convert.sha256(Convert.encodeUtf8(verifier))
        let b64 = Convert.encodeBase64(hash)
        let result = ''
        for (let i = 0; i < b64.length; i++) {
            let c = b64[i]
            if (c === '+') result += '-'
            else if (c === '/') result += '_'
            else if (c === '=') break
            else result += c
        }
        return result
    }

    // ============================================================
    //  TOKEN EXCHANGE (ref: PixEz OAuthClient.code2Token)
    // ============================================================

    async _exchangeAuthCode() {
        let code = this.loadData('_pkce_code')
        let verifier = this.loadData('_pkce_verifier')
        if (!code || !verifier) return false

        this.deleteData('_pkce_code')
        this.deleteData('_pkce_verifier')

        let body = [
            'client_id=' + encodeURIComponent(Pixiv.CLIENT_ID),
            'client_secret=' + encodeURIComponent(Pixiv.CLIENT_SECRET),
            'grant_type=authorization_code',
            'code=' + encodeURIComponent(code),
            'code_verifier=' + encodeURIComponent(verifier),
            'redirect_uri=' + encodeURIComponent(Pixiv.REDIRECT_URI),
            'include_policy=true'
        ].join('&')

        let res = await Network.post(Pixiv.AUTH_URL, this.getSignHeaders(), body)
        if (res.status !== 200) return false

        let json = JSON.parse(res.body)
        let resp = json.response
        if (!resp || !resp.access_token) return false

        this._saveTokenResponse(resp)
        return true
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
    //  _ensureToken — exchange pending auth code before API calls
    // ============================================================

    async _ensureToken() {
        let code = this.loadData('_pkce_code')
        if (code) {
            try { await this._exchangeAuthCode() } catch (e) {}
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
    //  CATEGORY (stub — not yet implemented)
    // ============================================================

    category = {
        title: "",
        parts: [],
        enableRankingPage: false,
    }

    // ============================================================
    //  CATEGORY COMICS (stub — not yet implemented)
    // ============================================================

    categoryComics = {
        load: async (category, param, options, page) => {
            return { comics: [], maxPage: 1 }
        },
    }

    // ============================================================
    //  SEARCH (stub — not yet implemented)
    // ============================================================

    search = {
        load: async (keyword, options, page) => {
            return { comics: [], maxPage: 1 }
        },
    }

    // ============================================================
    //  FAVORITES (stub — not yet implemented)
    // ============================================================

    favorites = {
        multiFolder: false,

        addOrDelFavorite: async (comicId, folderId, isAdding, favoriteId) => {
            throw 'Login expired'
        },

        loadFolders: async (comicId) => {
            return { folders: {}, favorited: [] }
        },

        loadComics: async (page, folder) => {
            return { comics: [], maxPage: 1 }
        },
    }

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
    //  PKCE flow (same as PixEz + official Pixiv Android client):
    //    1. init() generates code_verifier + code_challenge
    //    2. WebView opens app-api.pixiv.net/web/v1/login?code_challenge=...
    //       (this IS the Pixiv login page — just via the App API gateway)
    //    3. After login, Pixiv redirects to callback?code=...
    //    4. checkStatus captures the authorization code
    //    5. _exchangeAuthCode exchanges it with App OAuth credentials
    //
    //  Fallback: manual refresh_token via account parameter.
    // ============================================================

    account = {

        loginWithWebview: {
            // Set by init() — PKCE login URL
            url: "",

            checkStatus: (url, title) => {
                let codeIdx = url.indexOf('code=')
                if (url.includes('/auth/pixiv/callback') && codeIdx !== -1) {
                    let start = codeIdx + 5
                    let end = url.indexOf('&', start)
                    if (end === -1) end = url.length
                    let code = url.substring(start, end)
                    if (code) {
                        this.saveData('_pkce_code', decodeURIComponent(code))
                        return true
                    }
                }
                return false
            },

            onLoginSuccess: () => {
                try {
                    this._exchangeAuthCode().catch(function(){})
                } catch (e) {}
            },
        },

        login: async (account, pwd) => {
            // 1) Exchange PKCE authorization code
            let code = this.loadData('_pkce_code')
            if (code) {
                let ok = await this._exchangeAuthCode()
                if (ok) return 'ok'
                throw 'Login failed: unable to exchange authorization code'
            }

            // 2) Refresh existing stored token
            if (this.loadData('refresh_token')) {
                try {
                    await this.refreshToken()
                    return 'ok'
                } catch (e) {
                    throw 'Login failed: unable to refresh token'
                }
            }

            // 3) Manual refresh_token via account parameter
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
            this.deleteData('_pkce_code')
            this.deleteData('_pkce_verifier')
            this.deleteData('user_id')
            this.deleteData('user_name')
            this.deleteData('user_account')
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
