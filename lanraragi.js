/** @type {import('./_venera_.js')} */
class Lanraragi extends ComicSource {
    name = "Lanraragi"
    key = "lanraragi"
    version = "1.1.0"
    minAppVersion = "1.4.0"
    url = "https://git.nyne.dev/nyne/venera-configs/raw/branch/main/lanraragi.js"

    settings = {
        api: { title: "API", type: "input", default: "http://lrr.tvc-16.science" },
        apiKey: { title: "APIKEY", type: "input", default: "" }
    }

    get baseUrl() { 
        const api = this.loadSetting('api') || this.settings.api.default

        return api.replace(/\/$/, '')
    }

    get headers() {
        let apiKey = this.loadSetting('apiKey')
        if (apiKey) apiKey = "Bearer " + Convert.encodeBase64(Convert.encodeUtf8(apiKey))

        return {
            "Authorization": `${apiKey}`,
        }
    }

    async init() {
        try {
            const url = `${this.baseUrl}/api/categories`
            const res = await Network.get(url, this.headers)
            if (res.status !== 200) { this.saveData('categories', []); return }
            let data = []
            try { data = JSON.parse(res.body) } catch (_) { data = [] }
            if (!Array.isArray(data)) data = []
            this.saveData('categories', data)
            this.saveData('categories_ts', Date.now())
        } catch (_) { this.saveData('categories', []) }
    }

    // account = {
    //     login: async (account, pwd) => {},
    //     loginWithWebview: { url: "", checkStatus: (url, title) => false, onLoginSuccess: () => {} },
    //     loginWithCookies: { fields: ["ipb_member_id","ipb_pass_hash","igneous","star"], validate: async (values) => false },
    //     logout: () => {},
    //     registerWebsite: null,
    // }

    explore = [
        { title: "Lanraragi", type: "multiPageComicList", load: async (page = 1) => {
            const url = `${this.baseUrl}/api/archives`
            const res = await Network.get(url, this.headers)
            if (res.status !== 200) throw `Invalid status code: ${res.status}`
            const data = JSON.parse(res.body)
            const list = data.slice((page-1)*50, page*50)
            const parseComic = (item) => {
                let base = this.baseUrl.replace(/\/$/, '')
                if (!/^https?:\/\//.test(base)) base = 'http://' + base
                const cover = `${base}/api/archives/${item.arcid}/thumbnail`
                return new Comic({ id: item.arcid, title: item.title, subTitle: '', cover, tags: item.tags ? item.tags.split(',').map(t=>t.trim()).filter(Boolean) : [], description: `页数: ${item.pagecount} | 新: ${item.isnew} | 扩展: ${item.extension}` })
            }
            return { comics: list.map(parseComic), maxPage: Math.ceil(data.length/50) }
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
            const pageSize = 100
            const start = Math.max(0, (page - 1) * pageSize)

            const qp = []
            const add = (k, v) => qp.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
            add('draw', String(Date.now() % 1000))
            add('columns[0][data]', '')
            add('columns[0][name]', 'title')
            add('columns[0][searchable]', 'true')
            add('columns[0][orderable]', 'true')
            add('columns[0][search][value]', '')
            add('columns[0][search][regex]', 'false')
            add('columns[1][data]', 'tags')
            add('columns[1][name]', 'artist')
            add('columns[1][searchable]', 'true')
            add('columns[1][orderable]', 'true')
            add('columns[1][search][value]', '')
            add('columns[1][search][regex]', 'false')
            add('columns[2][data]', 'tags')
            add('columns[2][name]', 'series')
            add('columns[2][searchable]', 'true')
            add('columns[2][orderable]', 'true')
            add('columns[2][search][value]', '')
            add('columns[2][search][regex]', 'false')
            add('columns[3][data]', 'tags')
            add('columns[3][name]', 'tags')
            add('columns[3][searchable]', 'true')
            add('columns[3][orderable]', 'false')
            // Filter by category identifier in tags column
            add('columns[3][search][value]', category || '')
            add('columns[3][search][regex]', 'false')
            add('order[0][column]', '0')
            add('order[0][dir]', 'asc')
            add('start', String(start))
            add('length', String(pageSize))
            add('search[value]', '')
            add('search[regex]', 'false')

            const url = `${base}/search?${qp.join('&')}`
            const res = await Network.get(url, this.headers)
            if (res.status !== 200) throw `Invalid status code: ${res.status}`
            const data = JSON.parse(res.body)
            const list = Array.isArray(data.data) ? data.data : []
            const comics = list.map(item => {
                const cover = `${base}/api/archives/${item.arcid}/thumbnail`
                const tags = item.tags ? item.tags.split(',').map(t => t.trim()).filter(Boolean) : []
                return new Comic({
                    id: item.arcid,
                    title: item.title || item.filename || item.arcid,
                    subTitle: '',
                    cover,
                    tags,
                    description: `页数: ${item.pagecount} | 新: ${item.isnew} | 扩展: ${item.extension}`
                })
            })

            const total = typeof data.recordsFiltered === 'number' && data.recordsFiltered >= 0
                ? data.recordsFiltered
                : (list.length < pageSize ? start + list.length : start + pageSize)
            const maxPage = Math.max(1, Math.ceil(total / pageSize))
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
            add('start', '-1')
            add('sortby', sortby)
            add('order', order)
            add('newonly', newonly)
            add('untaggedonly', untaggedonly)
            add('groupby_tanks', groupby)

            const url = `${base}/api/search?${qp.join('&')}`
            const res = await Network.get(url, this.headers)
            if (res.status !== 200) throw `Invalid status code: ${res.status}`
            const data = JSON.parse(res.body)
            const all = Array.isArray(data.data) ? data.data : []

            const pageSize = 100
            const start = Math.max(0, (page - 1) * pageSize)
            const slice = all.slice(start, start + pageSize)

            const comics = slice.map(item => {
                const cover = `${base}/api/archives/${item.arcid}/thumbnail`
                const tags = item.tags ? item.tags.split(',').map(t => t.trim()).filter(Boolean) : []
                return new Comic({
                    id: item.arcid,
                    title: item.title || item.filename || item.arcid,
                    subTitle: '',
                    cover,
                    tags,
                    description: `页数: ${item.pagecount ?? ''} | 新: ${item.isnew ?? ''} | 扩展: ${item.extension ?? ''}`
                })
            })

            const total = (typeof data.recordsFiltered === 'number' && data.recordsFiltered >= 0)
                ? data.recordsFiltered
                : all.length
            const maxPage = Math.max(1, Math.ceil(total / pageSize))
            return { comics, maxPage }
        },
        loadNext: async (keyword, options, next) => {
            const page = (typeof next === 'number' && next > 0) ? next : 1
            return await this.search.load(keyword, options, page)
        },
        optionList: [
            { type: "select", options: ["title-按标题","lastread-最近阅读"], label: "sortby", default: "title" },
            { type: "select", options: ["asc-升序","desc-降序"], label: "order", default: "asc" },
            { type: "select", options: ["false-全部","true-仅新"], label: "newonly", default: "false" },
            { type: "select", options: ["false-全部","true-仅未打标签"], label: "untaggedonly", default: "false" },
            { type: "select", options: ["true-启用","false-禁用"], label: "groupby_tanks", default: "true" }
        ],
        enableTagsSuggestions: false,
    }

    // favorites = {
    //     multiFolder: false,
    //     addOrDelFavorite: async (comicId, folderId, isAdding, favoriteId) => {},
    //     loadFolders: async (comicId) => {},
    //     addFolder: async (name) => {},
    //     deleteFolder: async (folderId) => {},
    //     loadComics: async (page, folder) => {},
    //     loadNext: async (next, folder) => {},
    //     singleFolderForSingleComic: false,
    // }

    comic = {
        loadInfo: async (id) => {
            const url = `${this.baseUrl}/api/archives/${id}/metadata`
            const res = await Network.get(url, this.headers)
            if (res.status !== 200) throw `Invalid status code: ${res.status}`
            const data = JSON.parse(res.body)
            const cover = `${this.baseUrl}/api/archives/${id}/thumbnail`
            let tags = data.tags ? data.tags.split(',').map(t=>t.trim()).filter(Boolean) : []
            const rating = tags.find(t=>t.startsWith('rating:'))
            if (rating) tags = tags.filter(t=>!t.startsWith('rating:'))
            const chapters = new Map(); chapters.set(id, data.title || 'Local manga')
            return { title: data.title || data.filename || id, cover, description: data.summary || '', tags: { "Tags": tags, "Extension": [data.extension], "Rating": rating ? [rating.replace('rating:', '')] : [], "Page": [String(data.pagecount)] }, chapters }
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
        starRating: async (id, rating) => {},
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
        // onClickTag: (namespace, tag) => {},
        // link: { domains: ['example.com'], linkToId: (url) => null },
        enableTagsTranslate: false,
    }
}
