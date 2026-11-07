class Pawchive extends ComicSource {
    name = "Pawchive"

    key = "pawchive"

    version = "1.0.0"

    minAppVersion = "1.6.0"

    url = "https://cdn.jsdelivr.net/gh/venera-app/venera-configs@main/pawchive.js"

    // 创作者索引由 /creators 一次性返回，数据量很大，只放在内存里缓存。
    _creators = null

    _creatorIndex = null

    _creatorsAt = 0

    // 账号收藏缓存，避免详情页和收藏页反复请求。
    _favCache = {}

    // 作者投稿列表缓存，避免重复打开作者页时重复翻页。
    _postCache = {}

    // 投稿详情缓存，避免详情页和阅读页重复请求同一篇投稿。
    _postDetailCache = {}

    // ---------------------------------------------------------------- settings

    get siteHost() {
        return this.normalizeHost(this.loadSetting('siteHost'), 'pawchive.pw')
    }

    get baseUrl() {
        return 'https://' + this.siteHost
    }

    get apiBase() {
        return this.baseUrl + '/api/v1'
    }

    get imageHost() {
        return this.normalizeHost(this.loadSetting('imageHost'), 'img.' + this.siteHost)
    }

    get fileHost() {
        return this.normalizeHost(this.loadSetting('fileHost'), 'file.' + this.siteHost)
    }

    normalizeHost(value, fallback) {
        let host = value === null || value === undefined ? '' : String(value).trim()
        if (!host) {
            return fallback
        }
        host = host.replace(/^https?:\/\//i, '')
        host = host.replace(/\/.*$/, '')
        host = host.replace(/^\s+|\s+$/g, '')
        return host || fallback
    }

    get headers() {
        return {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
            'Accept': 'application/json, text/plain, */*',
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
            'Referer': this.baseUrl + '/',
        }
    }

    get imageHeaders() {
        return {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
            'Referer': this.baseUrl + '/',
        }
    }

    // ---------------------------------------------------------------- request

    apiUrl(path, params) {
        let url = this.apiBase + '/' + String(path).replace(/^\/+/, '')
        if (!params) {
            return url
        }
        let query = []
        for (let key in params) {
            let value = params[key]
            if (value === null || value === undefined || value === '') {
                continue
            }
            query.push(encodeURIComponent(key) + '=' + encodeURIComponent(value))
        }
        return query.length > 0 ? url + '?' + query.join('&') : url
    }

    async request(method, path, params, data, extraHeaders) {
        let url = this.apiUrl(path, params)
        let headers = Object.assign({}, this.headers, extraHeaders || {})
        try {
            if (method === 'GET') {
                return await Network.get(url, headers)
            }
            if (method === 'POST') {
                return await Network.post(url, headers, data === undefined ? null : data)
            }
            if (method === 'DELETE') {
                return await Network.delete(url, headers)
            }
            return await Network.sendRequest(method, url, headers, data === undefined ? null : data)
        } catch (e) {
            throw '网络请求失败: ' + e
        }
    }

    apiError(res, path) {
        let status = res ? res.status : 0
        let message = ''
        try {
            let json = JSON.parse(res.body)
            if (json && json.error) {
                message = String(json.error)
            }
        } catch (e) {
        }
        if (status === 404) {
            return '内容不存在或已被删除'
        }
        if (status === 401 || status === 403 || status === 302) {
            return 'Login expired'
        }
        if (status === 429) {
            return '请求过于频繁，请稍后重试'
        }
        let text = '请求失败 (HTTP ' + status + ')'
        if (message) {
            text += ': ' + message
        }
        return text
    }

    async apiGet(path, params) {
        let res = await this.request('GET', path, params)
        if (!res || res.status !== 200) {
            throw this.apiError(res, path)
        }
        try {
            return JSON.parse(String(res.body).replace(/^\uFEFF/, ''))
        } catch (e) {
            throw '接口返回了无法解析的数据'
        }
    }

    // ---------------------------------------------------------------- helpers

    toMillis(value) {
        if (value === null || value === undefined || value === '') {
            return 0
        }
        if (typeof value === 'number') {
            return value < 100000000000 ? value * 1000 : value
        }
        let text = String(value).trim()
        if (!text) {
            return 0
        }
        if (/^\d+$/.test(text)) {
            let number = parseInt(text, 10)
            return number < 100000000000 ? number * 1000 : number
        }
        let time = Date.parse(text)
        if (!isNaN(time)) {
            return time
        }
        time = Date.parse(text + 'Z')
        return isNaN(time) ? 0 : time
    }

    formatDate(value, withTime) {
        let time = this.toMillis(value)
        if (!time) {
            return ''
        }
        let date = new Date(time)
        let pad = (number) => number < 10 ? '0' + number : String(number)
        let text = date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate())
        if (withTime) {
            text += ' ' + pad(date.getHours()) + ':' + pad(date.getMinutes())
        }
        return text
    }

    serviceName(service) {
        let key = String(service || '').toLowerCase()
        let names = {
            fanbox: 'Pixiv Fanbox',
            patreon: 'Patreon',
            fantia: 'Fantia',
            discord: 'Discord',
            gumroad: 'Gumroad',
            subscribestar: 'SubscribeStar',
            boosty: 'Boosty',
            afdian: '爱发电',
            dlsite: 'DLsite',
            pixiv: 'Pixiv',
        }
        if (names[key]) {
            return names[key]
        }
        return key ? key.charAt(0).toUpperCase() + key.slice(1) : '未知平台'
    }

    serviceKey(name) {
        let text = String(name || '').toLowerCase()
        let names = {
            'pixiv fanbox': 'fanbox',
            'patreon': 'patreon',
            'fantia': 'fantia',
            'discord': 'discord',
            'gumroad': 'gumroad',
            'subscribestar': 'subscribestar',
            'boosty': 'boosty',
            '爱发电': 'afdian',
            'dlsite': 'dlsite',
            'pixiv': 'pixiv',
        }
        return names[text] || text
    }

    decodeEntities(text) {
        return String(text)
            .replace(/&nbsp;/gi, ' ')
            .replace(/&amp;/gi, '&')
            .replace(/&lt;/gi, '<')
            .replace(/&gt;/gi, '>')
            .replace(/&quot;/gi, '"')
            .replace(/&#39;/g, "'")
            .replace(/&#x27;/gi, "'")
            .replace(/&#(\d+);/g, (match, code) => String.fromCharCode(parseInt(code, 10)))
            .replace(/&#x([0-9a-f]+);/gi, (match, code) => String.fromCharCode(parseInt(code, 16)))
    }

    cleanHtml(html) {
        if (html === null || html === undefined) {
            return ''
        }
        let text = String(html)
        text = text.replace(/<script[\s\S]*?<\/script>/gi, ' ')
        text = text.replace(/<style[\s\S]*?<\/style>/gi, ' ')
        text = text.replace(/<!--[\s\S]*?-->/g, ' ')
        text = text.replace(/<br\s*\/?>/gi, '\n')
        text = text.replace(/<\/(p|div|li|h[1-6]|tr|blockquote)>/gi, '\n')
        text = text.replace(/<li[^>]*>/gi, '• ')
        text = text.replace(/<[^>]+>/g, ' ')
        text = this.decodeEntities(text)
        text = text.replace(/[ \t]+\n/g, '\n')
        text = text.replace(/\n[ \t]+/g, '\n')
        text = text.replace(/[ \t]{2,}/g, ' ')
        text = text.replace(/\n{3,}/g, '\n\n')
        return text.replace(/^\s+|\s+$/g, '')
    }

    shorten(text, limit) {
        let value = String(text || '')
        if (value.length <= limit) {
            return value
        }
        return value.substring(0, limit - 3) + '...'
    }

    parseTags(raw) {
        let tags = []
        let add = (value) => {
            if (value === null || value === undefined) {
                return
            }
            if (typeof value === 'object') {
                add(value.name || value.tag || value.text || value.title || '')
                return
            }
            let text = String(value).replace(/^\s+|\s+$/g, '')
            if (text && tags.indexOf(text) < 0) {
                tags.push(text)
            }
        }
        if (Array.isArray(raw)) {
            for (let tag of raw) {
                add(tag)
            }
        } else if (typeof raw === 'string') {
            let text = raw.replace(/^\s+|\s+$/g, '')
            if (!text) {
                return tags
            }
            if (text.charAt(0) === '[' || text.charAt(0) === '{') {
                try {
                    let parsed = JSON.parse(text)
                    if (Array.isArray(parsed)) {
                        for (let tag of parsed) {
                            add(tag)
                        }
                    } else {
                        add(parsed)
                    }
                } catch (e) {
                    text.split(',').forEach(add)
                }
            } else {
                text.split(',').forEach(add)
            }
        } else {
            add(raw)
        }
        return tags
    }

    basename(path) {
        let text = String(path || '').split('?')[0]
        let index = text.lastIndexOf('/')
        return index >= 0 ? text.substring(index + 1) : text
    }

    fileExtension(file) {
        if (!file) {
            return ''
        }
        let name = String(file.name || file.path || '').split('?')[0]
        let index = name.lastIndexOf('.')
        return index >= 0 ? name.substring(index + 1).toLowerCase() : ''
    }

    isImage(file) {
        let extensions = ['jpg', 'jpeg', 'jfif', 'png', 'apng', 'gif', 'webp', 'avif', 'bmp', 'heic', 'heif']
        return extensions.indexOf(this.fileExtension(file)) >= 0
    }

    allFiles(post) {
        let files = []
        let seen = {}
        let add = (file) => {
            if (!file || (!file.path && !file.name)) {
                return
            }
            let key = String(file.path || '') + '|' + String(file.name || '')
            if (seen[key]) {
                return
            }
            seen[key] = true
            files.push(file)
        }
        if (post && post.file) {
            add(post.file)
        }
        if (post && Array.isArray(post.attachments)) {
            for (let file of post.attachments) {
                add(file)
            }
        }
        if (files.length === 0 && post && post.content) {
            let regex = /<img[^>]+src\s*=\s*["']([^"']+)["']/gi
            let match
            while ((match = regex.exec(post.content)) !== null) {
                let url = this.decodeEntities(match[1])
                if (/^https?:\/\//i.test(url)) {
                    add({ name: this.basename(url), path: url })
                }
            }
        }
        return files
    }

    imageFiles(post) {
        let result = []
        for (let file of this.allFiles(post)) {
            if (this.isImage(file)) {
                result.push(file)
            }
        }
        return result
    }

    fileUrl(file, thumbnail) {
        if (!file) {
            return ''
        }
        let path = file.path ? String(file.path).trim() : ''
        if (!path && file.name) {
            path = String(file.name).trim()
        }
        if (!path) {
            return ''
        }
        if (/^https?:\/\//i.test(path)) {
            return path
        }
        if (path.indexOf('//') === 0) {
            return 'https:' + path
        }
        if (path.indexOf('/data/') === 0) {
            path = path.substring(5)
        } else if (path.indexOf('data/') === 0) {
            path = path.substring(4)
        }
        if (path.charAt(0) !== '/') {
            path = '/' + path
        }
        let useThumbnail = !!thumbnail || !!file.preview_only
        let host = useThumbnail ? this.imageHost : this.fileHost
        let url = 'https://' + host + (useThumbnail ? '/thumbnail' : '') + '/data' + path
        let name = file.name || this.basename(path)
        if (name) {
            url += (url.indexOf('?') >= 0 ? '&' : '?') + 'f=' + encodeURIComponent(name)
        }
        return url
    }

    postCover(post) {
        let images = this.imageFiles(post)
        for (let file of images) {
            return this.fileUrl(file, true)
        }
        let files = this.allFiles(post)
        for (let file of files) {
            return this.fileUrl(file, true)
        }
        return ''
    }

    postTitle(post) {
        let title = this.cleanHtml(post.title || post.substring || '')
        if (!title) {
            title = '投稿 ' + post.id
        }
        return this.shorten(title, 140)
    }

    chapterTitle(post) {
        let date = this.formatDate(post.published || post.added || post.edited)
        let title = this.postTitle(post)
        return date ? '[' + date + '] ' + title : title
    }

    postDescription(post) {
        let content = this.cleanHtml(post.content || '')
        if (!content) {
            content = this.cleanHtml(post.substring || '')
        }
        content = this.shorten(content, 3000)
        let lines = []
        if (content) {
            lines.push(content)
        }
        let meta = []
        meta.push('平台: ' + this.serviceName(post.service))
        meta.push('创作者 ID: ' + (post.user || ''))
        let published = this.formatDate(post.published || post.added || post.edited, true)
        if (published) {
            meta.push('发布时间: ' + published)
        }
        let edited = this.formatDate(post.edited, true)
        if (edited && edited !== published) {
            meta.push('编辑时间: ' + edited)
        }
        let tags = this.parseTags(post.tags)
        if (tags.length > 0) {
            meta.push('标签: ' + tags.join(', '))
        }
        let images = this.imageFiles(post)
        let files = this.allFiles(post)
        if (images.length > 0) {
            meta.push('图片: ' + images.length + ' 张')
        }
        if (files.length > images.length) {
            meta.push('其他附件: ' + (files.length - images.length) + ' 个 (暂不支持在阅读器中打开)')
        }
        if (meta.length > 0) {
            lines.push(meta.join('\n'))
        }
        return lines.join('\n\n')
    }

    postTags(post) {
        let result = {
            '平台': [this.serviceName(post.service)],
        }
        let tags = this.parseTags(post.tags)
        if (tags.length > 0) {
            result['标签'] = tags
        }
        return result
    }

    creatorWebUrl(parsed) {
        return this.baseUrl + '/' + encodeURIComponent(parsed.service) +
            '/user/' + encodeURIComponent(parsed.creatorId)
    }

    postWebUrl(parsed) {
        return this.creatorWebUrl(parsed) + '/post/' + encodeURIComponent(parsed.postId)
    }

    iconUrl(service, creatorId) {
        return this.baseUrl + '/icons/' + encodeURIComponent(service) + '/' + encodeURIComponent(creatorId)
    }

    creatorComicId(service, creatorId) {
        return 'c|' + service + '|' + creatorId
    }

    postComicId(service, creatorId, postId) {
        return 'p|' + service + '|' + creatorId + '|' + postId
    }

    safeDecode(value) {
        try {
            return decodeURIComponent(value)
        } catch (e) {
            return value
        }
    }

    parseId(id) {
        let text = id === null || id === undefined ? '' : String(id).trim()
        if (!text) {
            return null
        }
        if (text.indexOf('c|') === 0) {
            let parts = text.split('|')
            if (parts.length >= 3) {
                return {
                    type: 'creator',
                    service: parts[1],
                    creatorId: parts.slice(2).join('|'),
                }
            }
        }
        if (text.indexOf('p|') === 0) {
            let parts = text.split('|')
            if (parts.length >= 4) {
                return {
                    type: 'post',
                    service: parts[1],
                    creatorId: parts[2],
                    postId: parts.slice(3).join('|'),
                }
            }
        }
        let match = text.match(/\/([^/?#]+)\/user\/([^/?#]+)\/post\/([^/?#]+)/)
        if (match) {
            return {
                type: 'post',
                service: this.safeDecode(match[1]),
                creatorId: this.safeDecode(match[2]),
                postId: this.safeDecode(match[3]),
            }
        }
        match = text.match(/\/([^/?#]+)\/user\/([^/?#]+)/)
        if (match) {
            return {
                type: 'creator',
                service: this.safeDecode(match[1]),
                creatorId: this.safeDecode(match[2]),
            }
        }
        return null
    }

    parseCreatorParam(param) {
        let text = param === null || param === undefined ? '' : String(param).trim()
        if (!text) {
            return null
        }
        if (text.indexOf('c|') === 0) {
            return this.parseId(text)
        }
        let parts = text.split('|')
        if (parts.length >= 2) {
            return {
                type: 'creator',
                service: parts[0],
                creatorId: parts.slice(1).join('|'),
            }
        }
        parts = text.split(':')
        if (parts.length >= 2) {
            return {
                type: 'creator',
                service: parts[0],
                creatorId: parts.slice(1).join(':'),
            }
        }
        return null
    }

    // ---------------------------------------------------------------- creators

    sortCreators(creators, sort) {
        let list = creators.slice()
        if (sort === 'favorited') {
            list.sort((a, b) => (b.favorited || 0) - (a.favorited || 0))
        } else if (sort === 'name') {
            list.sort((a, b) => {
                let left = String(a.name || '').toLowerCase()
                let right = String(b.name || '').toLowerCase()
                return left < right ? -1 : left > right ? 1 : 0
            })
        } else {
            list.sort((a, b) => this.toMillis(b.updated) - this.toMillis(a.updated))
        }
        return list
    }

    async getCreators(force) {
        let now = Date.now()
        if (!force && this._creators && now - this._creatorsAt < 30 * 60 * 1000) {
            return this._creators
        }
        try {
            let data = await this.apiGet('creators')
            if (data && !Array.isArray(data) && Array.isArray(data.creators)) {
                data = data.creators
            }
            if (!Array.isArray(data)) {
                throw '创作者列表格式不正确'
            }
            this._creators = data
            this._creatorsAt = now
            this._creatorIndex = {}
            for (let creator of data) {
                if (creator && creator.service && creator.id) {
                    this._creatorIndex[creator.service + '|' + creator.id] = creator
                }
            }
            return data
        } catch (e) {
            if (this._creators) {
                return this._creators
            }
            throw e
        }
    }

    findCreator(service, creatorId) {
        if (!this._creatorIndex) {
            return null
        }
        return this._creatorIndex[service + '|' + creatorId] || null
    }

    findCreatorInList(creators, service, creatorId) {
        for (let creator of creators) {
            if (creator && creator.service === service && String(creator.id) === String(creatorId)) {
                return creator
            }
        }
        return null
    }

    creatorComic(creator) {
        let service = creator.service || ''
        let creatorId = creator.id || ''
        return new Comic({
            id: this.creatorComicId(service, creatorId),
            title: creator.name || this.serviceName(service) + ' / ' + creatorId,
            subtitle: this.serviceName(service),
            cover: this.iconUrl(service, creatorId),
            tags: [this.serviceName(service)],
            description: 'Pawchive 创作者 · ' + this.serviceName(service) + ' · ID: ' + creatorId,
        })
    }

    postComic(post) {
        let creator = this.findCreator(post.service, post.user)
        let subtitle = creator && creator.name ? creator.name : this.serviceName(post.service) + ' · ' + post.user
        return new Comic({
            id: this.postComicId(post.service, post.user, post.id),
            title: this.postTitle(post),
            subtitle: subtitle,
            cover: this.postCover(post),
            tags: this.parseTags(post.tags),
            description: this.shorten(this.cleanHtml(post.content || post.substring || ''), 260),
            maxPage: this.imageFiles(post).length,
        })
    }

    recommendCreators(service, creatorId) {
        if (!this._creators) {
            return []
        }
        let result = []
        let list = this.sortCreators(this._creators.filter((creator) => {
            return creator.service === service && String(creator.id) !== String(creatorId)
        }), 'favorited')
        for (let creator of list.slice(0, 6)) {
            result.push(this.creatorComic(creator))
        }
        return result
    }

    // ---------------------------------------------------------------- posts

    creatorPostLimit() {
        let value = this.loadSetting('maxCreatorPosts')
        if (value === '0' || value === 0 || value === 'all') {
            return 0
        }
        let number = parseInt(value, 10)
        if (isNaN(number) || number < 50) {
            return 200
        }
        return number
    }

    async getCreatorPosts(service, creatorId, force) {
        let limit = this.creatorPostLimit()
        let key = service + '|' + creatorId + '|' + limit
        let now = Date.now()
        let cached = this._postCache[key]
        if (!force && cached && now - cached.at < 5 * 60 * 1000) {
            return cached.data
        }
        let path = encodeURIComponent(service) + '/user/' + encodeURIComponent(creatorId)
        let posts = []
        let offset = 0
        while (true) {
            let batch = await this.apiGet(path, offset > 0 ? { o: offset } : null)
            if (!Array.isArray(batch)) {
                break
            }
            for (let post of batch) {
                posts.push(post)
            }
            if (batch.length < 50) {
                break
            }
            if (limit > 0 && posts.length >= limit) {
                break
            }
            offset += 50
            if (offset > 10000) {
                break
            }
        }
        if (limit > 0 && posts.length > limit) {
            posts = posts.slice(0, limit)
        }
        this._postCache[key] = { at: now, data: posts }
        return posts
    }

    async getPost(service, creatorId, postId) {
        let key = service + '|' + creatorId + '|' + postId
        let now = Date.now()
        let cached = this._postDetailCache[key]
        if (cached && now - cached.at < 2 * 60 * 1000) {
            return cached.data
        }
        let path = encodeURIComponent(service) + '/user/' + encodeURIComponent(creatorId) +
            '/post/' + encodeURIComponent(postId)
        let post = await this.apiGet(path)
        if (!post || !post.id) {
            throw '投稿不存在或已被删除'
        }
        this._postDetailCache[key] = { at: now, data: post }
        return post
    }

    // ---------------------------------------------------------------- favorites

    async accountFavorites(type) {
        let now = Date.now()
        let cached = this._favCache[type]
        if (cached && now - cached.at < 60 * 1000) {
            return cached.data
        }
        let res = await this.request('GET', 'account/favorites', { type: type })
        if (!res || res.status !== 200) {
            if (res && (res.status === 401 || res.status === 403 || res.status === 302)) {
                throw 'Login expired'
            }
            throw this.apiError(res, 'account/favorites')
        }
        let data
        try {
            data = JSON.parse(String(res.body).replace(/^\uFEFF/, ''))
        } catch (e) {
            throw 'Login expired'
        }
        if (!Array.isArray(data)) {
            data = []
        }
        this._favCache[type] = { at: now, data: data }
        return data
    }

    clearFavoriteCache() {
        this._favCache = {}
    }

    async checkFavorite(parsed) {
        try {
            if (parsed.type === 'creator') {
                let list = await this.accountFavorites('artist')
                for (let item of list) {
                    if (String(item.id) === String(parsed.creatorId) &&
                        (!item.service || item.service === parsed.service)) {
                        return true
                    }
                }
            } else {
                let list = await this.accountFavorites('post')
                for (let item of list) {
                    if (String(item.id) === String(parsed.postId) &&
                        (!item.user || String(item.user) === String(parsed.creatorId))) {
                        return true
                    }
                }
            }
        } catch (e) {
        }
        return undefined
    }

    // ---------------------------------------------------------------- info

    async loadCreatorInfo(parsed) {
        let path = encodeURIComponent(parsed.service) + '/user/' + encodeURIComponent(parsed.creatorId)
        let profile = null
        try {
            profile = await this.apiGet(path + '/profile')
        } catch (e) {
        }
        let posts = []
        try {
            posts = await this.getCreatorPosts(parsed.service, parsed.creatorId)
        } catch (e) {
        }
        let cachedCreator = this.findCreator(parsed.service, parsed.creatorId)
        if (!profile && posts.length === 0 && !cachedCreator) {
            throw '创作者不存在或已被删除'
        }
        let name = (profile && profile.name) || (cachedCreator && cachedCreator.name) ||
            (this.serviceName(parsed.service) + ' / ' + parsed.creatorId)
        let links = []
        try {
            let value = await this.apiGet(path + '/links')
            if (Array.isArray(value)) {
                links = value
            }
        } catch (e) {
        }
        let creatorTags = []
        try {
            let value = await this.apiGet(path + '/tags')
            if (Array.isArray(value)) {
                for (let item of value) {
                    if (item && item.tag) {
                        creatorTags.push(item.tag)
                    }
                }
            }
        } catch (e) {
        }
        let chapters = new Map()
        let latest = ''
        let visible = 0
        for (let post of posts) {
            if (this.imageFiles(post).length > 0) {
                chapters.set(post.id, this.chapterTitle(post))
                visible++
                let date = post.published || post.added || post.edited
                if (!latest || this.toMillis(date) > this.toMillis(latest)) {
                    latest = date
                }
            }
        }
        let lines = ['Pawchive 创作者']
        lines.push('平台: ' + this.serviceName(parsed.service))
        lines.push('ID: ' + parsed.creatorId)
        if (profile && profile.public_id) {
            lines.push('Public ID: ' + profile.public_id)
        }
        if (profile && profile.updated) {
            lines.push('档案更新: ' + this.formatDate(profile.updated, true))
        }
        if (latest) {
            lines.push('最近投稿: ' + this.formatDate(latest, true))
        }
        lines.push('已加载投稿: ' + posts.length + ' 篇，其中 ' + visible + ' 篇包含图片')
        let limit = this.creatorPostLimit()
        if (limit > 0) {
            lines.push('提示: 为保证加载速度，作者页最多加载最近 ' + limit + ' 篇投稿，可在源设置中调整。')
        }
        if (links.length > 0) {
            let linked = []
            for (let link of links) {
                if (link && (link.name || link.id)) {
                    linked.push(this.serviceName(link.service) + ': ' + (link.name || link.id))
                }
            }
            if (linked.length > 0) {
                lines.push('关联账号:\n' + linked.join('\n'))
            }
        }
        let tags = {
            '平台': [this.serviceName(parsed.service)],
        }
        if (creatorTags.length > 0) {
            tags['标签'] = creatorTags.slice(0, 50)
        }
        return new ComicDetails({
            title: name,
            subtitle: this.serviceName(parsed.service),
            cover: this.iconUrl(parsed.service, parsed.creatorId),
            description: lines.join('\n\n'),
            tags: tags,
            chapters: chapters,
            isFavorite: this.isLogged ? await this.checkFavorite(parsed) : undefined,
            recommend: this.recommendCreators(parsed.service, parsed.creatorId),
            updateTime: this.formatDate(latest, true),
            uploadTime: this.formatDate(latest, true),
            url: this.creatorWebUrl(parsed),
        })
    }

    async loadPostInfo(parsed) {
        let post = await this.getPost(parsed.service, parsed.creatorId, parsed.postId)
        let images = this.imageFiles(post)
        let creator = this.findCreator(post.service, post.user)
        let recommend = []
        try {
            recommend.push(new Comic({
                id: this.creatorComicId(post.service, post.user),
                title: creator && creator.name ? creator.name : (this.serviceName(post.service) + ' / ' + post.user),
                subtitle: '查看创作者的全部投稿',
                cover: this.iconUrl(post.service, post.user),
                tags: [this.serviceName(post.service)],
                description: '',
            }))
        } catch (e) {
        }
        return new ComicDetails({
            title: this.postTitle(post),
            subtitle: creator && creator.name ? creator.name : (this.serviceName(post.service) + ' · ' + post.user),
            cover: this.postCover(post),
            description: this.postDescription(post),
            tags: this.postTags(post),
            thumbnails: null,
            recommend: recommend,
            isFavorite: this.isLogged ? await this.checkFavorite(parsed) : undefined,
            uploadTime: this.formatDate(post.published || post.added || post.edited, true),
            updateTime: this.formatDate(post.edited || post.published || post.added, true),
            url: this.postWebUrl(parsed),
            maxPage: images.length,
        })
    }

    // ---------------------------------------------------------------- source

    init() {
    }

    explore = [
        {
            title: '最新投稿',
            type: 'multiPageComicList',
            loadNext: async (next) => {
                let offset = next ? parseInt(next, 10) : 0
                if (isNaN(offset) || offset < 0) {
                    offset = 0
                }
                let posts = await this.apiGet('posts', offset > 0 ? { o: offset } : null)
                if (!Array.isArray(posts)) {
                    posts = []
                }
                return {
                    comics: posts.map((post) => this.postComic(post)),
                    next: posts.length >= 50 ? String(offset + 50) : null,
                }
            },
        },
        {
            title: '热门创作者',
            type: 'multiPageComicList',
            loadNext: async (next) => {
                let offset = next ? parseInt(next, 10) : 0
                if (isNaN(offset) || offset < 0) {
                    offset = 0
                }
                let creators = this.sortCreators(await this.getCreators(), 'favorited')
                let slice = creators.slice(offset, offset + 50)
                return {
                    comics: slice.map((creator) => this.creatorComic(creator)),
                    next: offset + 50 < creators.length ? String(offset + 50) : null,
                }
            },
        },
        {
            title: '最近更新创作者',
            type: 'multiPageComicList',
            loadNext: async (next) => {
                let offset = next ? parseInt(next, 10) : 0
                if (isNaN(offset) || offset < 0) {
                    offset = 0
                }
                let creators = this.sortCreators(await this.getCreators(), 'updated')
                let slice = creators.slice(offset, offset + 50)
                return {
                    comics: slice.map((creator) => this.creatorComic(creator)),
                    next: offset + 50 < creators.length ? String(offset + 50) : null,
                }
            },
        },
    ]

    category = {
        title: 'Pawchive',
        parts: [
            {
                name: '平台',
                type: 'fixed',
                categories: [
                    {
                        label: '全部',
                        target: {
                            page: 'category',
                            attributes: { category: 'all', param: null },
                        },
                    },
                    {
                        label: 'Fanbox',
                        target: {
                            page: 'category',
                            attributes: { category: 'service', param: 'fanbox' },
                        },
                    },
                    {
                        label: 'Patreon',
                        target: {
                            page: 'category',
                            attributes: { category: 'service', param: 'patreon' },
                        },
                    },
                    {
                        label: 'Fantia',
                        target: {
                            page: 'category',
                            attributes: { category: 'service', param: 'fantia' },
                        },
                    },
                    {
                        label: 'Discord',
                        target: {
                            page: 'category',
                            attributes: { category: 'service', param: 'discord' },
                        },
                    },
                    {
                        label: 'Gumroad',
                        target: {
                            page: 'category',
                            attributes: { category: 'service', param: 'gumroad' },
                        },
                    },
                    {
                        label: 'SubscribeStar',
                        target: {
                            page: 'category',
                            attributes: { category: 'service', param: 'subscribestar' },
                        },
                    },
                ],
            },
            {
                name: '浏览',
                type: 'fixed',
                categories: [
                    {
                        label: '最新投稿',
                        target: {
                            page: 'category',
                            attributes: { category: 'recent', param: null },
                        },
                    },
                    {
                        label: '热门创作者',
                        target: {
                            page: 'category',
                            attributes: { category: 'popular', param: null },
                        },
                    },
                    {
                        label: '全部创作者',
                        target: {
                            page: 'category',
                            attributes: { category: 'all', param: null },
                        },
                    },
                ],
            },
        ],
        enableRankingPage: false,
    }

    categoryComics = {
        load: async (category, param, options, page) => {
            let currentPage = page && page > 0 ? page : 1
            let offset = (currentPage - 1) * 50
            if (category === 'recent') {
                let posts = await this.apiGet('posts', offset > 0 ? { o: offset } : null)
                if (!Array.isArray(posts)) {
                    posts = []
                }
                return {
                    comics: posts.map((post) => this.postComic(post)),
                    maxPage: posts.length >= 50 ? currentPage + 1 : currentPage,
                }
            }
            if (category === 'creator') {
                let parsed = this.parseCreatorParam(param)
                if (!parsed) {
                    return { comics: [], maxPage: currentPage }
                }
                let path = encodeURIComponent(parsed.service) + '/user/' + encodeURIComponent(parsed.creatorId)
                let posts = await this.apiGet(path, offset > 0 ? { o: offset } : null)
                if (!Array.isArray(posts)) {
                    posts = []
                }
                return {
                    comics: posts.map((post) => this.postComic(post)),
                    maxPage: posts.length >= 50 ? currentPage + 1 : currentPage,
                }
            }
            let creators = await this.getCreators()
            if (category === 'service') {
                creators = creators.filter((creator) => creator.service === param)
            }
            let sort = options && options[0] ? options[0] : (category === 'popular' ? 'favorited' : 'updated')
            creators = this.sortCreators(creators, sort)
            let total = creators.length
            let slice = creators.slice(offset, offset + 50)
            return {
                comics: slice.map((creator) => this.creatorComic(creator)),
                maxPage: Math.max(1, Math.ceil(total / 50)),
            }
        },
        optionList: [
            {
                label: '排序',
                options: [
                    'updated-最近更新',
                    'favorited-收藏最多',
                    'name-名称',
                ],
                notShowWhen: ['recent', 'creator'],
            },
        ],
    }

    search = {
        load: async (keyword, options, page) => {
            let scope = options && options[0] ? options[0] : 'posts'
            let currentPage = page && page > 0 ? page : 1
            let offset = (currentPage - 1) * 50
            if (scope === 'hash') {
                let hash = String(keyword || '').replace(/^\s+|\s+$/g, '').toLowerCase()
                if (!/^[0-9a-f]{64}$/.test(hash)) {
                    throw '文件 Hash 搜索需要 64 位 SHA-256'
                }
                let result = await this.apiGet('search_hash/' + encodeURIComponent(hash))
                let posts = result && Array.isArray(result.posts) ? result.posts : []
                return {
                    comics: posts.map((post) => this.postComic(post)),
                    maxPage: 1,
                }
            }
            if (scope === 'creators') {
                let text = String(keyword || '').replace(/^\s+|\s+$/g, '').toLowerCase()
                let creators = this.sortCreators(await this.getCreators(), 'updated')
                if (text) {
                    creators = creators.filter((creator) => {
                        let name = String(creator.name || '').toLowerCase()
                        let id = String(creator.id || '').toLowerCase()
                        return name.indexOf(text) >= 0 || id.indexOf(text) >= 0
                    })
                }
                let total = creators.length
                let slice = creators.slice(offset, offset + 50)
                return {
                    comics: slice.map((creator) => this.creatorComic(creator)),
                    maxPage: Math.max(1, Math.ceil(total / 50)),
                }
            }
            let text = String(keyword || '').replace(/^\s+|\s+$/g, '')
            if (text.length < 3) {
                throw 'Pawchive 投稿搜索至少需要 3 个字符'
            }
            let posts = await this.apiGet('posts', {
                q: text,
                o: offset > 0 ? offset : null,
            })
            if (!Array.isArray(posts)) {
                posts = []
            }
            return {
                comics: posts.map((post) => this.postComic(post)),
                maxPage: posts.length >= 50 ? currentPage + 1 : currentPage,
            }
        },
        optionList: [
            {
                label: '搜索范围',
                options: [
                    'posts-投稿',
                    'creators-创作者',
                    'hash-文件 Hash',
                ],
            },
        ],
        enableTagsSuggestions: false,
    }

    favorites = {
        multiFolder: true,

        addOrDelFavorite: async (comicId, folderId, isAdding) => {
            let parsed = this.parseId(comicId)
            if (!parsed) {
                throw '无效的漫画 ID'
            }
            let path
            if (parsed.type === 'creator') {
                path = 'favorites/creator/' + encodeURIComponent(parsed.service) + '/' +
                    encodeURIComponent(parsed.creatorId)
            } else {
                path = 'favorites/post/' + encodeURIComponent(parsed.service) + '/' +
                    encodeURIComponent(parsed.creatorId) + '/' + encodeURIComponent(parsed.postId)
            }
            let res = await this.request(isAdding ? 'POST' : 'DELETE', path)
            if (res && res.status >= 200 && res.status < 300) {
                this.clearFavoriteCache()
                return 'ok'
            }
            if (res && (res.status === 401 || res.status === 403 || res.status === 302)) {
                throw 'Login expired'
            }
            throw this.apiError(res, path)
        },

        loadFolders: async (comicId) => {
            let folders = {
                'creator': '收藏的创作者',
                'post': '收藏的投稿',
            }
            let favorited = []
            if (comicId) {
                let parsed = this.parseId(comicId)
                if (parsed) {
                    try {
                        if (parsed.type === 'creator') {
                            let list = await this.accountFavorites('artist')
                            for (let item of list) {
                                if (String(item.id) === String(parsed.creatorId) &&
                                    (!item.service || item.service === parsed.service)) {
                                    favorited.push('creator')
                                    break
                                }
                            }
                        } else {
                            let list = await this.accountFavorites('post')
                            for (let item of list) {
                                if (String(item.id) === String(parsed.postId) &&
                                    (!item.user || String(item.user) === String(parsed.creatorId))) {
                                    favorited.push('post')
                                    break
                                }
                            }
                        }
                    } catch (e) {
                        if (String(e).indexOf('Login expired') >= 0) {
                            throw e
                        }
                    }
                }
            }
            return { folders: folders, favorited: favorited }
        },

        loadComics: async (page, folder) => {
            let currentPage = page && page > 0 ? page : 1
            let offset = (currentPage - 1) * 50
            if (folder === 'post') {
                let list = await this.accountFavorites('post')
                let comics = []
                for (let item of list.slice(offset, offset + 50)) {
                    let service = item.service || ''
                    let creatorId = item.user || item.creator_id || ''
                    let postId = item.id || ''
                    if (!service || !creatorId || !postId) {
                        continue
                    }
                    comics.push(new Comic({
                        id: this.postComicId(service, creatorId, postId),
                        title: item.title || ('投稿 ' + postId),
                        subtitle: this.serviceName(service) + ' · ' + creatorId,
                        cover: this.iconUrl(service, creatorId),
                        tags: [this.serviceName(service)],
                        description: '',
                        favoriteId: postId,
                    }))
                }
                return {
                    comics: comics,
                    maxPage: Math.max(1, Math.ceil(list.length / 50)),
                }
            }
            let list = await this.accountFavorites('artist')
            let comics = []
            for (let item of list.slice(offset, offset + 50)) {
                comics.push(this.creatorComic(item))
            }
            return {
                comics: comics,
                maxPage: Math.max(1, Math.ceil(list.length / 50)),
            }
        },
    }

    comic = {
        loadInfo: async (id) => {
            let parsed = this.parseId(id)
            if (!parsed) {
                throw '无效的漫画 ID'
            }
            if (parsed.type === 'creator') {
                return await this.loadCreatorInfo(parsed)
            }
            return await this.loadPostInfo(parsed)
        },

        loadThumbnails: async (id, next) => {
            let parsed = this.parseId(id)
            if (!parsed || parsed.type !== 'post') {
                return { thumbnails: [], next: null }
            }
            let post = await this.getPost(parsed.service, parsed.creatorId, parsed.postId)
            let thumbnails = []
            for (let file of this.imageFiles(post)) {
                let url = this.fileUrl(file, true)
                if (url) {
                    thumbnails.push(url)
                }
            }
            return { thumbnails: thumbnails, next: null }
        },

        loadEp: async (comicId, epId) => {
            let parsed = this.parseId(comicId)
            if (!parsed) {
                throw '无效的漫画 ID'
            }
            let postId = parsed.type === 'post' ? parsed.postId : epId
            if (!postId) {
                throw '未指定要阅读的投稿'
            }
            let post = await this.getPost(parsed.service, parsed.creatorId, postId)
            let preferThumbnail = this.loadSetting('preferThumbnail') === true
            let images = []
            for (let file of this.imageFiles(post)) {
                let url = this.fileUrl(file, preferThumbnail || !!file.preview_only)
                if (url && images.indexOf(url) < 0) {
                    images.push(url)
                }
            }
            if (images.length === 0) {
                throw '该投稿没有可阅读的图片'
            }
            return { images: images }
        },

        loadComments: async (comicId, subId, page, replyTo) => {
            let parsed = this.parseId(comicId)
            if (!parsed) {
                return { comments: [], maxPage: 1 }
            }
            let postId = parsed.type === 'post' ? parsed.postId : (subId || null)
            if (!postId) {
                return { comments: [], maxPage: 1 }
            }
            return await this.loadPostComments(parsed.service, parsed.creatorId, postId, page, replyTo)
        },

        loadChapterComments: async (comicId, epId, page, replyTo) => {
            let parsed = this.parseId(comicId)
            if (!parsed) {
                return { comments: [], maxPage: 1 }
            }
            let postId = parsed.type === 'post' ? parsed.postId : epId
            if (!postId) {
                return { comments: [], maxPage: 1 }
            }
            return await this.loadPostComments(parsed.service, parsed.creatorId, postId, page, replyTo)
        },

        onImageLoad: (url, comicId, epId) => {
            return {
                url: url,
                headers: this.imageHeaders,
            }
        },

        onThumbnailLoad: (url) => {
            return {
                url: url,
                headers: this.imageHeaders,
            }
        },

        idMatch: "^((c\\|[^|]+\\|[^|]+|p\\|[^|]+\\|[^|]+\\|[^|]+|https?://(?:www\\.)?pawchive\\.(?:pw|st)/.+))$",

        onClickTag: (namespace, tag) => {
            if (namespace === '平台') {
                return {
                    page: 'category',
                    attributes: {
                        category: 'service',
                        param: this.serviceKey(tag),
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
                'pawchive.pw',
                'www.pawchive.pw',
                'pawchive.st',
                'www.pawchive.st',
            ],
            linkToId: (url) => {
                let parsed = this.parseId(url)
                if (!parsed) {
                    return null
                }
                if (parsed.type === 'creator') {
                    return this.creatorComicId(parsed.service, parsed.creatorId)
                }
                return this.postComicId(parsed.service, parsed.creatorId, parsed.postId)
            },
        },

        enableTagsTranslate: false,
    }

    async loadPostComments(service, creatorId, postId, page, replyTo) {
        let path = encodeURIComponent(service) + '/user/' + encodeURIComponent(creatorId) +
            '/post/' + encodeURIComponent(postId) + '/comments'
        let res = await this.request('GET', path)
        if (res && res.status === 404) {
            return { comments: [], maxPage: 1 }
        }
        if (!res || res.status !== 200) {
            throw this.apiError(res, path)
        }
        let data
        try {
            data = JSON.parse(String(res.body).replace(/^\uFEFF/, ''))
        } catch (e) {
            data = []
        }
        let source = Array.isArray(data) ? data : (data && Array.isArray(data.comments) ? data.comments : [])
        let all = []
        let counts = {}
        for (let item of source) {
            if (!item) {
                continue
            }
            let parent = item.parent_id === null || item.parent_id === undefined ? '' : String(item.parent_id)
            if (parent) {
                counts[parent] = (counts[parent] || 0) + 1
            }
            all.push(item)
        }
        let comments = []
        for (let item of all) {
            let parent = item.parent_id === null || item.parent_id === undefined ? '' : String(item.parent_id)
            if (replyTo) {
                if (parent !== String(replyTo)) {
                    continue
                }
            } else if (parent) {
                continue
            }
            let content = item.content || ''
            if (!content && Array.isArray(item.revisions) && item.revisions.length > 0) {
                content = item.revisions[item.revisions.length - 1].content || ''
            }
            comments.push(new Comment({
                userName: item.commenter_name || (item.commenter ? '用户 ' + item.commenter : '匿名'),
                content: this.cleanHtml(content),
                time: this.formatDate(item.published, true),
                replyCount: replyTo ? 0 : (counts[String(item.id)] || 0),
                id: item.id === null || item.id === undefined ? undefined : String(item.id),
            }))
        }
        if (comments.length === 0 && !replyTo) {
            for (let item of all) {
                comments.push(new Comment({
                    userName: item.commenter_name || (item.commenter ? '用户 ' + item.commenter : '匿名'),
                    content: this.cleanHtml(item.content || ''),
                    time: this.formatDate(item.published, true),
                    replyCount: counts[String(item.id)] || 0,
                    id: item.id === null || item.id === undefined ? undefined : String(item.id),
                }))
            }
        }
        return { comments: comments, maxPage: 1 }
    }

    account = {
        login: async (account, pwd) => {
            let body = 'username=' + encodeURIComponent(account) +
                '&password=' + encodeURIComponent(pwd) +
                '&location=' + encodeURIComponent('/')
            let res = await Network.post(this.baseUrl + '/account/login', Object.assign({}, this.headers, {
                'Content-Type': 'application/x-www-form-urlencoded',
            }), body)
            if (res && (res.status === 401 || res.status === 403)) {
                throw '账号或密码错误'
            }
            if (!res || res.status >= 400) {
                throw '登录失败 (HTTP ' + (res ? res.status : 0) + ')'
            }
            let check = await this.request('GET', 'account/favorites', { type: 'artist' })
            if (!check || check.status !== 200) {
                await new Promise((resolve) => setTimeout(resolve, 400))
                check = await this.request('GET', 'account/favorites', { type: 'artist' })
            }
            if (check && check.status === 200) {
                this.clearFavoriteCache()
                this._postCache = {}
                this._postDetailCache = {}
                return 'ok'
            }
            throw '登录失败：账号或密码错误，或站点要求完成验证'
        },

        loginWithWebview: {
            url: 'https://pawchive.pw/account/login',
            checkStatus: (url, title) => {
                let text = String(url || '')
                return text.indexOf('/account/login') < 0 &&
                    text.indexOf('/account/register') < 0 &&
                    text.indexOf('pawchive') >= 0
            },
            onLoginSuccess: () => {
                this.clearFavoriteCache()
                this._postCache = {}
                this._postDetailCache = {}
            },
        },

        loginWithCookies: {
            fields: ['session'],
            validate: async (values) => {
                let value = values && values[0] ? String(values[0]).trim() : ''
                value = value.replace(/^session\s*=\s*/i, '').replace(/^['"]|['"]$/g, '')
                if (!value) {
                    return false
                }
                Network.setCookies(this.baseUrl, [new Cookie({
                    name: 'session',
                    value: value,
                    domain: this.siteHost,
                })])
                await new Promise((resolve) => setTimeout(resolve, 100))
                let res = await this.request('GET', 'account/favorites', { type: 'artist' })
                return !!(res && res.status === 200)
            },
        },

        logout: () => {
            Network.deleteCookies(this.baseUrl)
            Network.deleteCookies(this.apiBase)
            this.clearFavoriteCache()
            this._postCache = {}
            this._postDetailCache = {}
        },

        registerWebsite: 'https://pawchive.pw/account/register',
    }

    settings = {
        siteHost: {
            title: '站点域名',
            type: 'input',
            validator: null,
            default: 'pawchive.pw',
        },
        imageHost: {
            title: '图片域名',
            type: 'input',
            validator: null,
            default: 'img.pawchive.pw',
        },
        fileHost: {
            title: '文件域名',
            type: 'input',
            validator: null,
            default: 'file.pawchive.pw',
        },
        preferThumbnail: {
            title: '使用缩略图服务器阅读',
            type: 'switch',
            default: false,
        },
        maxCreatorPosts: {
            title: '作者投稿加载上限',
            type: 'select',
            options: [
                { value: '100', text: '100 篇' },
                { value: '200', text: '200 篇' },
                { value: '500', text: '500 篇' },
                { value: '1000', text: '1000 篇' },
                { value: '0', text: '全部 (较慢)' },
            ],
            default: '200',
        },
        refreshCreators: {
            title: '刷新创作者列表',
            type: 'callback',
            buttonText: '立即刷新',
            callback: async () => {
                try {
                    let creators = await this.getCreators(true)
                    UI.showMessage('已刷新 ' + creators.length + ' 位创作者')
                } catch (e) {
                    UI.showMessage(String(e))
                }
            },
        },
    }

    translation = {
        'zh_CN': {
            '最新投稿': '最新投稿',
            '热门创作者': '热门创作者',
            '最近更新创作者': '最近更新创作者',
            '平台': '平台',
            '浏览': '浏览',
            '全部': '全部',
            '排序': '排序',
            '最近更新': '最近更新',
            '收藏最多': '收藏最多',
            '名称': '名称',
            '搜索范围': '搜索范围',
            '文件 Hash': '文件 Hash',
            '投稿': '投稿',
            '创作者': '创作者',
            '收藏的创作者': '收藏的创作者',
            '收藏的投稿': '收藏的投稿',
            '站点域名': '站点域名',
            '图片域名': '图片域名',
            '文件域名': '文件域名',
            '使用缩略图服务器阅读': '使用缩略图服务器阅读',
            '作者投稿加载上限': '作者投稿加载上限',
            '刷新创作者列表': '刷新创作者列表',
            '立即刷新': '立即刷新',
            '100 篇': '100 篇',
            '200 篇': '200 篇',
            '500 篇': '500 篇',
            '1000 篇': '1000 篇',
            '全部 (较慢)': '全部 (较慢)',
            '标签': '标签',
            '创作者 ID': '创作者 ID',
        },
        'zh_TW': {
            '最新投稿': '最新投稿',
            '热门创作者': '熱門創作者',
            '最近更新创作者': '最近更新創作者',
            '平台': '平台',
            '浏览': '瀏覽',
            '全部': '全部',
            '排序': '排序',
            '最近更新': '最近更新',
            '收藏最多': '收藏最多',
            '名称': '名稱',
            '搜索范围': '搜尋範圍',
            '文件 Hash': '檔案 Hash',
            '投稿': '投稿',
            '创作者': '創作者',
            '收藏的创作者': '收藏的創作者',
            '收藏的投稿': '收藏的投稿',
            '站点域名': '站點網域',
            '图片域名': '圖片網域',
            '文件域名': '檔案網域',
            '使用缩略图服务器阅读': '使用縮圖伺服器閱讀',
            '作者投稿加载上限': '作者投稿載入上限',
            '刷新创作者列表': '重新整理創作者列表',
            '立即刷新': '立即重新整理',
            '100 篇': '100 篇',
            '200 篇': '200 篇',
            '500 篇': '500 篇',
            '1000 篇': '1000 篇',
            '全部 (较慢)': '全部 (較慢)',
            '标签': '標籤',
            '创作者 ID': '創作者 ID',
        },
        'en': {
            '最新投稿': 'Latest Posts',
            '热门创作者': 'Popular Creators',
            '最近更新创作者': 'Recently Updated Creators',
            '平台': 'Platform',
            '浏览': 'Browse',
            '全部': 'All',
            '排序': 'Sort',
            '最近更新': 'Recently Updated',
            '收藏最多': 'Most Favorited',
            '名称': 'Name',
            '搜索范围': 'Search In',
            '文件 Hash': 'File Hash',
            '投稿': 'Posts',
            '创作者': 'Creators',
            '收藏的创作者': 'Favorite Creators',
            '收藏的投稿': 'Favorite Posts',
            '站点域名': 'Site Host',
            '图片域名': 'Image Host',
            '文件域名': 'File Host',
            '使用缩略图服务器阅读': 'Read via Thumbnail Server',
            '作者投稿加载上限': 'Creator Post Limit',
            '刷新创作者列表': 'Refresh Creator List',
            '立即刷新': 'Refresh Now',
            '100 篇': '100 posts',
            '200 篇': '200 posts',
            '500 篇': '500 posts',
            '1000 篇': '1000 posts',
            '全部 (较慢)': 'All (slow)',
            '标签': 'Tags',
            '创作者 ID': 'Creator ID',
        },
    }
}
