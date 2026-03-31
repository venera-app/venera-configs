/** @type {import('./_venera_.js')} */
class Lanraragi extends ComicSource {
    name = "Lanraragi"
    key = "lanraragi"
    version = "1.2.0"
    minAppVersion = "1.4.0"
    url = "https://cdn.jsdelivr.net/gh/venera-app/venera-configs@main/lanraragi.js"

    settings = {
        api: { title: "API", type: "input", default: "http://lrr.tvc-16.science" },
        apiKey: { title: "APIKEY", type: "input", default: "" }
    }

    get baseUrl() { 
        const api = this.loadSetting('api') || this.settings.api.default

        return api.replace(/\/$/, '')
    }

    get headers() {
        const raw = this.loadSetting('apiKey')
        const headers = {}
        if (raw) {
            headers.Authorization = "Bearer " + Convert.encodeBase64(Convert.encodeUtf8(raw))
        }
        return headers
    }

    // 临时的折中手段，app 尚不支持 api token 形式的授权判断（isLogged）
    account = {
      loginWithCookies: {
        fields: ["apiKey"],
        validate: function(cookies) {
          var provided = (cookies && cookies.length > 0) ? cookies[0] : '';
          if (provided && provided.length > 0) {
            return true;
          }
          return false;
        }
      },
      logout: function() {
        this.deleteData("account");
      }
    }

    _getStart(key, page) {
        if (page === 1) {
            this.saveData(key, 0)
            return 0
        }
        return Number(this.loadData(key) || 0)
    }

    _updateStart(key, returned) {
        const cur = Number(this.loadData(key) || 0)
        this.saveData(key, cur + (returned || 0))
    }

    // Parse various rating string/number formats and convert to 0-5 scale with 0.5 step
    _toStarsFromValue(v) {
        if (v === null || v === undefined) return null
        const s = String(v).trim()
        if (s.length === 0) return null

        // Support emoji star formats like '⭐⭐⭐' or '★★★' used by some Lanraragi setups
        if (s.includes('⭐') || s.includes('★')) {
            const count = (s.match(/⭐/g) || s.match(/★/g) || []).length
            if (count >= 0) return Math.max(0, Math.min(5, count))
        }

        // fraction like 7/10 or 3/5
        if (s.includes('/')) {
            const parts = s.split('/')
            const num = parseFloat(parts[0])
            const den = parseFloat(parts[1]) || 10
            if (!isNaN(num) && !isNaN(den) && den > 0) {
                const scaled = (num / den) * 5
                return Math.round(scaled * 2) / 2
            }
        }

        // percentage like 78%
        if (s.includes('%')) {
            const num = parseFloat(s.replace('%', ''))
            if (!isNaN(num)) {
                const scaled = (num / 100) * 5
                return Math.round(scaled * 2) / 2
            }
        }

        // plain number
        const n = parseFloat(s)
        if (isNaN(n)) return null
        // if number > 5 assume 10-point scale
        if (n > 5) {
            const scaled = n / 2
            return Math.round(scaled * 2) / 2
        }
        // else already 5-point or smaller
        return Math.round(n * 2) / 2
    }

    // Extract rating value from tags (tags can be comma-separated string or array)
    _extractRatingFromTags(tags) {
        if (!tags) return null
        let arr = []
        if (Array.isArray(tags)) {
            arr = tags
        } else {
            arr = String(tags).split(',').map(t => t.trim()).filter(Boolean)
        }
        for (const t of arr) {
            if (typeof t !== 'string') continue
            const low = t.toLowerCase()
            if (low.startsWith('rating:')) {
                const raw = t.slice('rating:'.length).trim()
                // emoji stars like '⭐⭐⭐' or '★★★'
                if (raw.includes('⭐') || raw.includes('★')) {
                    const count = (raw.match(/⭐/g) || raw.match(/★/g) || []).length
                    return String(count)
                }
                return raw
            }
        }
        return null
    }

    // Convert tags input (string comma-separated or array) to array of trimmed strings
    _tagsToArray(tags) {
        if (!tags) return []
        if (Array.isArray(tags)) return tags.map(t => String(t).trim()).filter(Boolean)
        return String(tags).split(',').map(t => t.trim()).filter(Boolean)
    }

    // Clean tags for list display: remove rating:, date_added:, URL-like and source: entries
    _cleanListTags(tags) {
        const arr = this._tagsToArray(tags)
        const out = []
        for (let t of arr) {
            if (typeof t !== 'string') continue
            const lt = t.toLowerCase()
            if (lt.startsWith('rating:')) continue
            if (lt.startsWith('date_added:')) continue
            if (t.includes('://')) continue
            if (lt.startsWith('source:')) continue
            out.push(t)
        }
        return out
    }

    async init() {
        try {
            const url = `${this.baseUrl}/api/categories`
            const res = await Network.get(url, this.headers)
            if (res.status !== 200) { this.saveData('categories', []); return }
            let data = []
            try { data = JSON.parse(res.body) } catch (_) { data = [] }
            if (!Array.isArray(data)) data = []
            // Save full categories list
            this.saveData('categories', data)
            this.saveData('categories_ts', Date.now())

            if (Array.isArray(data)) {
                const favorites = Array.isArray(data)
                    ? data.filter(c => c && (c.search === "" || c.search === null || typeof c.search === 'undefined'))
                    : []
                this.saveData('favorites', favorites)
                this.saveData('favorites_ts', Date.now())
            } else {
                this.saveData('favorites', [])
            }
        } catch (_) { this.saveData('categories', []) }
    }

    explore = [
        { title: "Lanraragi", type: "multiPageComicList", load: async (page = 1) => {
            const base = (this.baseUrl || '').replace(/\/$/, '')
            const exploreKey = 'explore_start'
            let start = this._getStart(exploreKey, page)
            const qp = []
            const add = (k, v) => qp.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
            add('sortby', 'date_added')
            add('order', 'desc')
            add('start', String(start))

            const url = `${base}/api/search?${qp.join('&')}`
            const res = await Network.get(url, this.headers)
            if (res.status !== 200) throw `Invalid status code: ${res.status}`
            const data = JSON.parse(res.body)
            const list = Array.isArray(data.data) ? data.data : []

            const parseComic = (item) => {
                let b = base
                if (!/^https?:\/\//.test(b)) b = 'http://' + b
                const cover = `${b}/api/archives/${item.arcid}/thumbnail`
                const tagRating = this._extractRatingFromTags(item.tags)
                const stars = this._toStarsFromValue(tagRating ?? null)
                return new Comic({ id: item.arcid, title: item.title || item.filename || item.arcid, subTitle: '', cover, tags: this._cleanListTags(item.tags), description: '页数: ' + (item.pagecount || '') + ' | 新: ' + (item.isnew || '') + ' | 扩展: ' + (item.extension || ''), stars })
            }

            const returned = list.length
            this._updateStart(exploreKey, returned)

            const total = (typeof data.recordsFiltered === 'number' && data.recordsFiltered >= 0)
                ? data.recordsFiltered
                : (start + returned)
            const serverPage = returned || 1
            const maxPage = Math.max(1, Math.ceil(total / serverPage))

            return { comics: list.map(parseComic), maxPage }
        }}
    ]

    category = {
        title: "Lanraragi",
        parts: [ { name: "ALL", type: "dynamic", loader: () => {
            const data = this.loadData('categories')
            if (!Array.isArray(data) || data.length === 0) throw 'Please check your API settings or categories.'
            const items = []
            for (const cat of data) {
                if (!cat) continue
                const id = cat.id ?? cat._id ?? cat.name
                const label = cat.name ?? String(id)
                try { items.push({ label, target: new PageJumpTarget({ page: 'category', attributes: { category: id, param: null } }) }) }
                catch (_) { items.push({ label, target: { page: 'category', attributes: { category: id, param: null } } }) }
            }
            return items
        } } ],
        enableRankingPage: false,
    }

    categoryComics = {
        load: async (category, param, options, page) => {
            // Use /search endpoint filtered by category tag value
            const base = (this.baseUrl || '').replace(/\/$/, '')
            const key = 'category_start_' + String(category || '')
            let start = this._getStart(key, page)

            const qp = []
            const add = (k, v) => qp.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
            add('category', category || '')
            add('sortby', 'date_added')
            add('order', 'desc')
            add('start', String(start))

            const url = `${base}/api/search?${qp.join('&')}`
            const res = await Network.get(url, this.headers)
            if (res.status !== 200) throw `Invalid status code: ${res.status}`
            const data = JSON.parse(res.body)
            const list = Array.isArray(data.data) ? data.data : []
            const comics = list.map(item => {
                const cover = `${base}/api/archives/${item.arcid}/thumbnail`
                const tags = this._cleanListTags(item.tags)
                const tagRating = this._extractRatingFromTags(item.tags)
                const stars = this._toStarsFromValue(tagRating ?? null)
                return new Comic({
                    id: item.arcid,
                    title: item.title || item.filename || item.arcid,
                    subTitle: '',
                    cover,
                    tags,
                    description: '页数: ' + (item.pagecount || '') + ' | 新: ' + (item.isnew || '') + ' | 扩展: ' + (item.extension || ''),
                    stars
                })
            })

            const returned = list.length
            this._updateStart(key, returned)

            const total = typeof data.recordsFiltered === 'number' && data.recordsFiltered >= 0
                ? data.recordsFiltered
                : (start + returned)
            const serverPage = returned || 1
            const maxPage = Math.max(1, Math.ceil(total / serverPage))
            return { comics, maxPage }
        }
    }

    search = {
        load: async (keyword, options, page = 1) => {
            const base = (this.baseUrl || '').replace(/\/$/, '')

            // Fetch all results once (start=-1), then page locally for consistent UX across servers
            const qp = []
            const add = (k, v) => qp.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
            const pick = (key, def) => {
                let v = options && (options[key])
                if (typeof v === 'string') {
                    const idx = v.indexOf('-');
                    if (idx > 0) v = v.slice(0, idx)
                }
                return (v === undefined || v === null || v === '') ? def : v
            }
            const sortby = pick(0, 'title')
            const order = pick(1, 'asc')
            const newonly = String(pick(2, 'false'))
            const untaggedonly = String(pick(3, 'false'))
            const groupby = String(pick(4, 'true'))

            add('filter', (keyword || '').trim())
            add('sortby', sortby)
            add('order', order)
            add('newonly', newonly)
            add('untaggedonly', untaggedonly)
            add('groupby_tanks', groupby)

            const searchKey = 'search_start_' + encodeURIComponent(String(keyword || ''))
            let start = 0
            if (page === 1) {
                this.saveData(searchKey, 0)
            } else {
                start = Number(this.loadData(searchKey) || 0)
            }
            add('start', String(start))

            const url = `${base}/api/search?${qp.join('&')}`
            const res = await Network.get(url, this.headers)
            if (res.status !== 200) throw `Invalid status code: ${res.status}`
            const data = JSON.parse(res.body)
            const list = Array.isArray(data.data) ? data.data : []

            const comics = list.map(item => {
                const cover = `${base}/api/archives/${item.arcid}/thumbnail`
                const tags = this._cleanListTags(item.tags)
                const tagRating = this._extractRatingFromTags(item.tags)
                const stars = this._toStarsFromValue(tagRating ?? null)
                return new Comic({
                    id: item.arcid,
                    title: item.title || item.filename || item.arcid,
                    subTitle: '',
                    cover,
                    tags,
                    description: '页数: ' + (item.pagecount || '') + ' | 新: ' + (item.isnew || '') + ' | 扩展: ' + (item.extension || ''),
                    stars
                })
            })

            const returned = list.length
            this.saveData(searchKey, start + returned)

            const total = (typeof data.recordsFiltered === 'number' && data.recordsFiltered >= 0)
                ? data.recordsFiltered
                : (start + returned)
            const serverPage = returned || 1
            const maxPage = Math.max(1, Math.ceil(total / serverPage))
            return { comics, maxPage }
        },
        loadNext: async (keyword, options, next) => {
            const page = (typeof next === 'number' && next > 0) ? next : 1
            return await this.search.load(keyword, options, page)
        },
        optionList: [
            { type: "select", options: ["title-按标题","date_added-最新添加","lastread-最近阅读"], label: "sortby", default: "title" },
            { type: "select", options: ["asc-升序","desc-降序"], label: "order", default: "asc" },
            { type: "select", options: ["false-全部","true-仅新"], label: "newonly", default: "false" },
            { type: "select", options: ["false-全部","true-仅未打标签"], label: "untaggedonly", default: "false" },
            { type: "select", options: ["true-启用","false-禁用"], label: "groupby_tanks", default: "true" }
        ],
        enableTagsSuggestions: false,
    }

    favorites = {
        multiFolder: true,
        singleFolderForSingleComic: false,

        addOrDelFavorite: async (comicId, folderId, isAdding, favoriteId) => {
            const hdrs = this.headers || {}
            if (!hdrs || Object.keys(hdrs).length === 0) {
                throw 'API token required to modify favorites'
            }

            if (!folderId || String(folderId) === '-1') {
                throw 'Invalid folder id'
            }

            const base = (this.baseUrl || '').replace(/\/$/, '')
            const url = `${base}/api/categories/${folderId}/${comicId}`

            let res
            if (isAdding) {
                res = await Network.put(url, hdrs)
            } else {
                // remove
                res = await Network.delete(url, hdrs)
            }

            if (res.status !== 200 && res.status !== 204) throw `Invalid status code: ${res.status}`
            return 'ok'
        },

        loadFolders: async (comicId) => {
            const data = this.loadData('favorites')
            const folders = {}
            if (Array.isArray(data)) {
                for (const cat of data) {
                    if (!cat) continue
                    const id = cat.id ?? cat._id ?? cat.name
                    const label = cat.name ?? String(id)
                    folders[String(id)] = label
                }
            }

            const favorited = []
            if (comicId) {
                try {
                    const info = await this.comic.loadInfo(comicId)

                    try {
                        if (info && (info.isFavorite === true || info.isFavorite === 'true')) {
                            // Prefer explicit folders array if provided by loadInfo
                            const infoFolders = Array.isArray(info.folders) ? info.folders.map(f => String(f)) : null
                            const added = new Set(favorited)
                            if (infoFolders && infoFolders.length > 0) {
                                for (const f of infoFolders) {
                                    for (const [fid, fname] of Object.entries(folders)) {
                                        if (f === fid || f === fname) {
                                            added.add(fid)
                                        }
                                    }
                                }
                            }
                            // assign deduped results back to favorited
                            favorited.length = 0
                            for (const v of added) favorited.push(v)
                        }
                    } catch (_) {}

                    const tags = info.tags || {}
                    const possibleKeys = Object.keys(tags)
                    for (const k of possibleKeys) {
                        if (String(k).toLowerCase() === 'category') {
                            const vals = tags[k]
                            if (Array.isArray(vals)) {
                                for (const v of vals) {
                                    // try to match category id or name
                                    for (const [fid, fname] of Object.entries(folders)) {
                                        if (String(v) === fid || String(v) === fname) {
                                            if (!favorited.includes(fid)) favorited.push(fid)
                                        }
                                    }
                                }
                            }
                        }
                    }
                } catch (_) {}
            }

            return { folders: folders, favorited: favorited }
        },

        loadComics: async (page, folder) => {
            return await this.categoryComics.load(folder, null, [], (typeof page === 'number' && page > 0) ? page : 1)
        },
    }

    comic = {
        loadInfo: async (id) => {
            const url = `${this.baseUrl}/api/archives/${id}/metadata`
            const res = await Network.get(url, this.headers)
            if (res.status !== 200) throw `Invalid status code: ${res.status}`
            const data = JSON.parse(res.body)
            const cover = `${this.baseUrl}/api/archives/${id}/thumbnail`
                let flatTags = data.tags ? data.tags.split(',').map(t=>t.trim()).filter(Boolean) : []
                const rating = flatTags.find(t=>t.startsWith('rating:'))
                if (rating) flatTags = flatTags.filter(t=>!t.startsWith('rating:'))

                let uploadTime = null
                const dateTag = flatTags.find(t => t.startsWith('date_added:'))
                if (dateTag) {
                    uploadTime = dateTag.slice('date_added:'.length).trim()
                    flatTags = flatTags.filter(t => !t.startsWith('date_added:'))
                }

                const nsMap = new Map();
                const nonNs = []
                for (const t of flatTags) {
                    const idx = t.indexOf(':')
                    if (idx > 0) {
                        const ns = t.slice(0, idx)
                        const val = t.slice(idx + 1)
                        if (!nsMap.has(ns)) nsMap.set(ns, [])
                        nsMap.get(ns).push(val)
                    } else {
                        nonNs.push(t)
                    }
                }

                const tagsObj = {}
                for (const [k, v] of nsMap.entries()) {
                    tagsObj[k] = v
                }
                tagsObj['Tags'] = nonNs
                // Preserve special metadata fields
                tagsObj['Pages'] = [String(data.pagecount)]
                tagsObj['Extension'] = [data.extension]

                // Move any tag value that looks like a URL (contains '://') into description
                const urlEntries = []
                const skipKeys = new Set(['Extension', 'Pages'])
                for (const key of Object.keys(tagsObj)) {
                    if (skipKeys.has(key)) continue
                    const arr = tagsObj[key]
                    if (!Array.isArray(arr)) continue
                    const keep = []
                    for (const val of arr) {
                        if (typeof val !== 'string') { keep.push(val); continue }
                        // already a URL with scheme
                        if (val.includes('://')) {
                            urlEntries.push(val)
                            continue
                        }
                        // special-case 'source' namespace: may lack scheme, prepend https://
                        if (String(key).toLowerCase() === 'source') {
                            let corrected = val
                            if (corrected.startsWith('//')) corrected = 'https:' + corrected
                            else if (!/^https?:\/\//i.test(corrected)) corrected = 'https://' + corrected
                            urlEntries.push(corrected)
                            continue
                        }
                        // otherwise keep the tag
                        keep.push(val)
                    }
                    tagsObj[key] = keep
                }

                let summary = data.summary || ''
                if (urlEntries.length) {
                    if (summary) summary += '\n'
                    summary += '关联：' + urlEntries.join(', ')
                }

                let isFavorite = false
                let folders = []
                try {
                    const catUrl = `${this.baseUrl}/api/archives/${id}/categories`
                    const catRes = await Network.get(catUrl, this.headers)
                    if (catRes.status === 200) {
                        let catData = []
                        try { catData = JSON.parse(catRes.body) } catch (_) { catData = [] }

                        // Normalize common response shapes. Prefer explicit `categories` array.
                        if (catData && typeof catData === 'object') {
                            if (Array.isArray(catData.categories)) catData = catData.categories
                            else if (Array.isArray(catData.data)) catData = catData.data
                            else if (!Array.isArray(catData)) catData = []
                        }

                        if (Array.isArray(catData) && catData.length > 0) {
                            // Find categories that actually contain this archive id in their `archives` list
                            const matched = []
                            for (const c of catData) {
                                const archives = Array.isArray(c.archives) ? c.archives : []
                                if (Array.isArray(archives) && archives.some(a => String(a) === String(id))) {
                                    matched.push(c)
                                }
                            }

                            if (matched.length > 0) {
                                isFavorite = true
                                folders = matched.map(c => String(c.id ?? c._id ?? c.name ?? c))
                            }
                        }
                    }
                } catch (_) { /* ignore category detection errors */ }

                const chapters = new Map(); chapters.set(id, data.title || 'Local manga')
                let stars = this._toStarsFromValue((rating ? rating.replace('rating:', '') : null))
                // Ensure details page always has a numeric star value (0 if no rating),
                // otherwise UI may not allow submitting a rating.
                if (stars === null || stars === undefined) stars = 0
                return {
                    title: data.title || data.filename || id,
                    cover,
                    description: summary,
                    uploadTime: uploadTime,
                    tags: tagsObj,
                    stars,
                    chapters,
                    isFavorite: isFavorite,
                    folders: folders
                }
        },
        loadThumbnails: async (id, next) => {
            const metaUrl = `${this.baseUrl}/api/archives/${id}/metadata`
            const res = await Network.get(metaUrl, this.headers)
            if (res.status !== 200) throw `Invalid status code: ${res.status}`
            const data = JSON.parse(res.body)
            const pagecount = data.pagecount || 1
            const thumbnails = []
            for (let i = 1; i <= pagecount; i++) thumbnails.push(`${this.baseUrl}/api/archives/${id}/thumbnail?page=${i}`)
            return { thumbnails, next: null }
        },
        starRating: async (id, rating) => {
            // Only allow when API token (headers) is provided
            const hdrs = this.headers || {}
            if (!hdrs || Object.keys(hdrs).length === 0) {
                throw 'API token required to submit rating'
            }

            // Fetch current metadata to preserve other tags
            const metaUrl = `${this.baseUrl}/api/archives/${id}/metadata`
            const getRes = await Network.get(metaUrl, hdrs)
            if (getRes.status !== 200) throw `Invalid status code: ${getRes.status}`
            let data = {}
            try { data = JSON.parse(getRes.body) } catch (_) { data = {} }

            let tagsArr = []
            if (data.tags) tagsArr = String(data.tags).split(',').map(t => t.trim()).filter(Boolean)

            // remove existing rating tags
            tagsArr = tagsArr.filter(t => !(typeof t === 'string' && t.toLowerCase().startsWith('rating:')))

            // if rating > 0, add emoji rating tag
            if (rating > 0) {
                const starsStr = '⭐'.repeat(rating / 2)
                tagsArr.push(`rating:${starsStr}`)
            }

            const tagsStr = tagsArr.join(', ')
            const body = `tags=${encodeURIComponent(tagsStr)}`
            const putUrl = `${this.baseUrl}/api/archives/${id}/metadata`
            const putRes = await Network.put(putUrl, Object.assign({}, hdrs, { 'Content-Type': 'application/x-www-form-urlencoded' }), body)
            if (putRes.status !== 200 && putRes.status !== 204) throw `Invalid status code: ${putRes.status}`
            return 'ok'
        },
        loadEp: async (comicId, epId) => {
            const base = (this.baseUrl || '').replace(/\/$/, '')
            const url = `${base}/api/archives/${comicId}/files?force=false`
            const res = await Network.get(url, this.headers)
            if (res.status !== 200) throw `Invalid status code: ${res.status}`
            const data = JSON.parse(res.body)
            const images = (data.pages || []).map(p => {
                if (!p) return null
                const s = String(p)
                if (/^https?:\/\//i.test(s)) return s
                return `${base}${s.startsWith('/') ? s : '/' + s}`
            }).filter(Boolean)
            return { images }
        },
        onImageLoad: (url, comicId, epId) => {
            return {
                headers: this.headers
            }
        },
        onThumbnailLoad: (url) => {
            return {
                headers: this.headers
            }
        },
        // likeComic: async (id, isLike) => {},
        // loadComments: async (comicId, subId, page, replyTo) => {},
        // sendComment: async (comicId, subId, content, replyTo) => {},
        // likeComment: async (comicId, subId, commentId, isLike) => {},
        // voteComment: async (id, subId, commentId, isUp, isCancel) => {},
        // idMatch: null,
        onClickTag: (namespace, tag) => {
            // Pages 和 Extension 不可点击
            const ns = namespace ? String(namespace) : ''
            const nsLower = ns.toLowerCase()
            if (nsLower === 'pages' || nsLower === 'extension') return null

            // always return a search for namespace:tag; if namespace missing, just tag
            let t = String(tag)
            if (t.includes(' ')) t = `"${t}"`
            const keyword = ns ? `${ns}:${t}` : t
            return { action: 'search', keyword: keyword, param: null }
        },
        // link: { domains: ['example.com'], linkToId: (url) => null },
        enableTagsTranslate: true,
    }

    translation = {
        'zh_CN': {
            "language": "语言",
            "artist": "画师",
            "male": "男性",
            "female": "女性",
            "mixed": "混合",
            "other": "其它",
            "parody": "原作",
            "character": "角色",
            "group": "团队",
            "cosplayer": "Coser",
            "reclass": "重新分类",
            "uploader": "上传者",
            "Languages": "语言",
            "Artists": "画师",
            "Characters": "角色",
            "Groups": "团队",
            "Tags": "标签",
            "Parodies": "原作",
            "Categories": "分类",
            "Category": "分类",
            "series": "系列",
            "Series": "系列",
            "Pages": "页数",
            "Extension": "文件类型",
        },
        'en_US': {
            "language": "Language",
            "artist": "Artist",
            "male": "Male",
            "female": "Female",
            "mixed": "Mixed",
            "other": "Other",
            "parody": "Parody",
            "character": "Character",
            "group": "Group",
            "cosplayer": "Cosplayer",
            "reclass": "Reclass",
            "uploader": "Uploader",
            "Languages": "Languages",
            "Artists": "Artists",
            "Characters": "Characters",
            "Groups": "Groups",
            "Tags": "Tags",
            "Parodies": "Parodies",
            "Categories": "Categories",
            "Category": "Category",
            "series": "Series",
            "Series": "Series",
            "Pages": "Pages",
            "Extension": "Extension",
        }
    }
}
