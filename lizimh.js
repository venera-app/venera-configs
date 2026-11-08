/** @type {import('./_venera_.js')} */

/**
 * 栗子漫画 (lizimh.com / com.hbsclj.uth)
 *
 * 协议来自官方 Android 1.1.7 (Flutter AOT) 逆向：
 *   - 接口域名：https://mh.lizimh.net
 *   - 签名：lzsign = md5("q2sIObYCp2uBZgCNBlY93J3z67hK0wS" + path + t)，t 为秒级时间戳
 *   - 首页 / 配置额外参数：packname=com.jy.zyds&appsign256=
 *   - 配置接口额外参数：platform=ios
 *   - 域名发现：DNS TXT adnet.lizimh.com / adnet.lizi.lat，
 *     Base64 -> AES-256-ECB(key=f8d992c74b29491d8a3e3fd5f07389d8) -> https://mh.lizimh.net/
 *   - 章节 v3 接口需要登录后的 token；未登录时按章节封面所在目录探测页码
 *   - $jp$ 路径的图片走 t1.imge.store，并使用 xorshift32 流密码混淆，
 *     seed = FNV1a32("v7\nimgio-fast-obfuscation-v7\n" + path)
 *
 * 图片线路：
 *   普通路径 -> https://media.imgo.buzz（明文，速度快）
 *   $jp$ 路径 -> https://t1.imge.store（混淆，需本地解密）
 */
class Lizimh extends ComicSource {
    name = "栗子漫画"
    key = "lizimh"
    version = "1.0.0"
    minAppVersion = "1.4.0"
    url = "https://cdn.jsdelivr.net/gh/venera-app/venera-configs@main/lizimh.js"

    api = "https://mh.lizimh.net"
    signPrefix = "q2sIObYCp2uBZgCNBlY93J3z67hK0wS"
    imageHost = "https://media.imgo.buzz"
    jpHost = "https://t1.imge.store"
    imageSalt = "imgio-fast-obfuscation-v7"
    txtKey = "f8d992c74b29491d8a3e3fd5f07389d8"

    fallbackApi = ["http://ai.qsmm.fun", "http://ai.xajtl.com"]
    fallbackTags = [
        "热血", "格斗", "武侠", "魔幻", "魔法", "冒险", "爱情", "搞笑", "校园", "科幻",
        "后宫", "励志", "职场", "美食", "社会", "黑道", "战争", "历史", "悬疑", "竞技",
        "体育", "恐怖", "推理", "生活", "治愈", "神鬼", "四格", "百合", "耽美", "舞蹈",
        "侦探", "音乐", "萌系", "古风", "恋爱", "都市", "穿越", "游戏", "其他", "日常",
        "仙侠", "修仙", "纯爱", "青春", "权谋", "浪漫", "偶像", "大女主", "复仇", "虐心",
        "灵异", "逆袭", "妖怪", "架空", "动作", "宫斗", "脑洞", "战斗", "系统", "智斗",
        "机甲", "异能", "末日", "奇幻", "宫廷", "亲情", "剧情", "玄幻", "霸总", "转生",
        "重生", "性转"
    ]
    fallbackClasses = [["国漫", 1], ["日漫", 2], ["韩漫", 3], ["美漫", 4], ["精选推荐", 5]]

    tags = this.fallbackTags
    classes = this.fallbackClasses

    settings = {
        imageLine: {
            title: "图片线路",
            type: "select",
            options: [
                { value: "auto", text: "自动（推荐）" },
                { value: "media", text: "media.imgo.buzz" },
                { value: "t1", text: "t1.imge.store" },
            ],
            default: "auto",
        },
        maxPages: {
            title: "单章最大页数",
            type: "input",
            default: "500",
            validator: "^\\d{1,4}$",
        },
    }

    _config = null
    _configPromise = null
    _chapters = {}
    _pageCache = {}
    _imagePaths = {}
    _discovering = null
    _line = "auto"

    get headers() {
        return {
            "Accept": "application/json",
            "User-Agent": "Dart/3.5 (dart:io)",
        }
    }

    get imageHeaders() {
        return {
            "User-Agent":
                "Mozilla/5.0 (Linux; Android 12; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36",
            "Referer": this.api + "/",
        }
    }

    init() {
        this.loadPageCache()
        try {
            this._line = this.loadSetting("imageLine") || "auto"
        } catch (e) {
            this._line = "auto"
        }
        this.buildCategory()
        this.getConfig().catch(() => {})
    }

    // ---------- 签名与请求 ----------

    signedPath(path, query) {
        let parts = []
        if (query && query.length) parts = query.slice()
        parts = parts.filter((entry) => {
            let key = String(entry).split("=")[0]
            return key !== "lzsign" && key !== "t"
        })
        if (path === "/app/api/home/data" || path === "/app/api/configv2") {
            if (!parts.some((entry) => entry.split("=")[0] === "packname")) {
                parts.push("packname=com.jy.zyds")
            }
            if (!parts.some((entry) => entry.split("=")[0] === "appsign256")) {
                parts.push("appsign256=")
            }
        }
        if (path === "/app/api/configv2") {
            if (!parts.some((entry) => entry.split("=")[0] === "platform")) {
                parts.push("platform=ios")
            }
        }
        let t = String(Math.floor(Date.now() / 1000))
        let sign = Convert.hexEncode(
            Convert.md5(Convert.encodeUtf8(this.signPrefix + path + t))
        ).toLowerCase()
        parts.push("lzsign=" + sign, "t=" + t)
        return path + "?" + parts.join("&")
    }

    parseJson(res, allowFail) {
        if (res.status !== 200) {
            if (allowFail) return null
            throw new Error("请求失败 HTTP " + res.status)
        }
        let data
        try {
            data = JSON.parse(res.body)
        } catch (e) {
            if (allowFail) return null
            throw new Error("接口返回格式错误")
        }
        if (data.code !== 201 && data.code !== 200) {
            if (allowFail) return null
            throw new Error(data.msg || "接口错误 code=" + data.code)
        }
        return data.data
    }

    async request(base, path, query, options) {
        let url = base + this.signedPath(path, query)
        let headers = Object.assign({}, this.headers)
        if (options && options.headers) Object.assign(headers, options.headers)
        let res = await Network.get(url, headers)
        return this.parseJson(res, options && options.allowFail)
    }

    async getJson(path, query, options) {
        try {
            return await this.request(this.api, path, query, options)
        } catch (e) {
            if (options && options.allowFail) return null
            let base = await this.discoverApi().catch(() => null)
            if (base && base !== this.api) {
                this.api = base
                return await this.request(base, path, query, options)
            }
            for (let fallback of this.fallbackApi) {
                if (!fallback || fallback === this.api) continue
                try {
                    let data = await this.request(fallback, path, query, options)
                    this.api = fallback
                    return data
                } catch (_) {}
            }
            throw e
        }
    }

    // 官方 TXT 域名配置：Base64 + AES-256-ECB
    decodeApiTxt(value) {
        let encoded = String(value || "").replace(/^"|"$/g, "").trim()
        if (!encoded) throw new Error("空 TXT")
        let input = Convert.decodeBase64(encoded)
        let key = Convert.encodeUtf8(this.txtKey)
        let decrypted = new Uint8Array(Convert.decryptAesEcb(input, key))
        let padding = decrypted[decrypted.length - 1]
        if (padding > 0 && padding <= 16 && padding <= decrypted.length) {
            decrypted = decrypted.slice(0, decrypted.length - padding)
        }
        let text = Convert.decodeUtf8(decrypted.buffer)
            .replace(/\u0000+$/g, "")
            .trim()
        text = text.replace(/\/+$/, "")
        if (!/^https:\/\/[^/?#:]+$/i.test(text)) throw new Error("TXT 域名无效")
        return text
    }

    async discoverApi() {
        if (this._discovering) return this._discovering
        let task = (async () => {
            let names = ["adnet.lizimh.com", "adnet.lizi.lat"]
            let providers = [
                "https://dns.alidns.com/resolve",
                "https://dns.google/resolve",
            ]
            for (let name of names) {
                for (let provider of providers) {
                    try {
                        let url = provider + "?name=" + encodeURIComponent(name) + "&type=TXT"
                        let res = await Network.get(url, { "Accept": "application/json" })
                        if (res.status !== 200) continue
                        let json = JSON.parse(res.body)
                        if (json.Status !== 0 || !Array.isArray(json.Answer)) continue
                        for (let answer of json.Answer) {
                            try {
                                return this.decodeApiTxt(answer.data)
                            } catch (_) {}
                        }
                    } catch (_) {}
                }
            }
            return null
        })()
        this._discovering = task
        try {
            return await task
        } finally {
            this._discovering = null
        }
    }

    // ---------- 配置 / 分类 ----------

    async getConfig() {
        if (this._config) return this._config
        if (this._configPromise) return this._configPromise
        this._configPromise = (async () => {
            try {
                let data = await this.getJson("/app/api/configv2")
                let general = data.cfg_general || {}
                let tags = general.category_tabs
                let classes = data.cfg_comic_class
                if (Array.isArray(tags) && tags.length) this.tags = tags
                if (Array.isArray(classes) && classes.length) {
                    this.classes = classes.map((c) => [c.name, c.id])
                }
                this.buildCategory()
                this._config = data
                return data
            } finally {
                this._configPromise = null
            }
        })()
        return this._configPromise
    }

    buildCategory() {
        let tags = this.tags.map((tag) => ({
            label: tag,
            target: {
                page: "category",
                attributes: { category: tag, param: "tag:" + tag },
            },
        }))
        let classes = this.classes.map((item) => ({
            label: item[0],
            target: {
                page: "category",
                attributes: { category: item[0], param: "class:" + item[1] },
            },
        }))
        this.category = {
            title: "栗子漫画",
            parts: [
                {
                    name: "推荐",
                    type: "fixed",
                    categories: [
                        {
                            label: "全部",
                            target: {
                                page: "category",
                                attributes: { category: "全部", param: null },
                            },
                        },
                        {
                            label: "热门排行",
                            target: {
                                page: "category",
                                attributes: { category: "热门排行", param: "rank" },
                            },
                        },
                    ],
                },
                { name: "题材", type: "fixed", categories: tags },
                { name: "地区", type: "fixed", categories: classes },
                {
                    name: "状态",
                    type: "fixed",
                    categories: [
                        {
                            label: "连载中",
                            target: {
                                page: "category",
                                attributes: { category: "连载中", param: "isend:1" },
                            },
                        },
                        {
                            label: "已完结",
                            target: {
                                page: "category",
                                attributes: { category: "已完结", param: "isend:2" },
                            },
                        },
                    ],
                },
            ],
            enableRankingPage: true,
        }
    }

    // 初始分类，等待 init/config 更新
    category = {
        title: "栗子漫画",
        parts: [
            {
                name: "推荐",
                type: "fixed",
                categories: [
                    {
                        label: "全部",
                        target: {
                            page: "category",
                            attributes: { category: "全部", param: null },
                        },
                    },
                    {
                        label: "热门排行",
                        target: {
                            page: "category",
                            attributes: { category: "热门排行", param: "rank" },
                        },
                    },
                ],
            },
        ],
        enableRankingPage: true,
    }

    // ---------- 数据解析 ----------

    parseComic(item) {
        let id = item && item.id !== undefined ? String(item.id) : ""
        let score = Number(item && item.score)
        return new Comic({
            id: id,
            title: (item && (item.name || item.title)) || "",
            subTitle: (item && item.author) || "",
            cover: this.imageUrl(item && (item.picY || item.picX || item.cover)),
            tags: item && item.tags ? String(item.tags).split(",").filter((x) => x) : [],
            description: (item && item.content) || "",
            stars: isFinite(score) && score > 0 ? score / 2 : null,
        })
    }

    parseComicList(list) {
        let out = []
        let seen = {}
        for (let item of list || []) {
            let comic = this.parseComic(item)
            if (!comic.id || !comic.title || seen[comic.id]) continue
            seen[comic.id] = true
            out.push(comic)
        }
        return out
    }

    // ---------- 首页 ----------

    explore = [
        {
            title: "首页",
            type: "multiPartPage",
            load: async () => {
                let data = await this.getJson("/app/api/home/data")
                let result = []
                let swiper = data.home_swiper_list || []
                let banners = []
                for (let item of swiper) {
                    let id = String(item.extend || "")
                    if (!/^\d+$/.test(id)) continue
                    let text = String(item.text || "")
                    let title = text.indexOf("|") >= 0 ? text.split("|").pop() : text
                    banners.push(
                        new Comic({
                            id: id,
                            title: title || id,
                            cover: this.imageUrl(item.pic),
                            description: "",
                        })
                    )
                }
                if (banners.length) {
                    result.push({
                        title: "编辑推荐",
                        comics: banners,
                        viewMore: {
                            page: "category",
                            attributes: { category: "全部", param: null },
                        },
                    })
                }
                for (let section of data.home_content_list || []) {
                    let comics = this.parseComicList(section.comic_list)
                    if (!comics.length) continue
                    result.push({
                        title: section.title || "推荐",
                        comics: comics,
                        viewMore: {
                            page: "category",
                            attributes: { category: "全部", param: null },
                        },
                    })
                }
                return result
            },
        },
    ]

    // ---------- 分类 ----------

    categoryComics = {
        load: async (category, param, options, page) => {
            let p = page || 1
            if (param === "rank") {
                let data = await this.getJson("/app/api/rank/list")
                let comics = []
                for (let group of data.rank_list || []) {
                    comics = comics.concat(this.parseComicList(group.comic_list))
                }
                let seen = {}
                comics = comics.filter((c) => !seen[c.id] && (seen[c.id] = true))
                return { comics: comics, maxPage: 1 }
            }
            let query = []
            let parts = param ? String(param).split("|") : []
            for (let part of parts) {
                if (part.indexOf("tag:") === 0) {
                    query.push("tag=" + encodeURIComponent(part.substring(4)))
                } else if (part.indexOf("class:") === 0) {
                    query.push("class=" + encodeURIComponent(part.substring(6)))
                } else if (part.indexOf("isend:") === 0) {
                    query.push("isend=" + encodeURIComponent(part.substring(6)))
                }
            }
            query.push("page=" + p)
            let data = await this.getJson("/app/api/category/list", query)
            let comics = this.parseComicList(data.category_list)
            return {
                comics: comics,
                maxPage: comics.length >= 15 ? p + 1 : p,
            }
        },
        ranking: {
            options: ["日漫-日漫", "国漫-国漫", "韩漫-韩漫"],
            load: async (option, page) => {
                let data = await this.getJson("/app/api/rank/list")
                let groups = data.rank_list || []
                let selected = groups.filter((g) => g.name === option)
                if (!selected.length) {
                    let index = ["日漫", "国漫", "韩漫"].indexOf(option)
                    selected = index >= 0 && groups[index] ? [groups[index]] : groups
                }
                let comics = []
                for (let group of selected) {
                    comics = comics.concat(this.parseComicList(group.comic_list))
                }
                let seen = {}
                comics = comics.filter((c) => !seen[c.id] && (seen[c.id] = true))
                return { comics: comics, maxPage: 1 }
            },
        },
    }

    // ---------- 搜索 ----------

    search = {
        load: async (keyword, options, page) => {
            let data = await this.getJson("/app/api/search/full", [
                "q=" + encodeURIComponent(keyword),
            ])
            return { comics: this.parseComicList(data.search_full), maxPage: 1 }
        },
    }

    // ---------- 详情 / 章节 ----------

    sortChapters(list) {
        return list.slice().sort((a, b) => {
            let oa = Number(a.order)
            let ob = Number(b.order)
            if (isFinite(oa) && isFinite(ob) && oa !== ob) return oa - ob
            let ca = String(a.created_at || "")
            let cb = String(b.created_at || "")
            return ca < cb ? -1 : ca > cb ? 1 : 0
        })
    }

    comic = {
        loadInfo: async (id) => {
            id = String(id)
            let data = await this.getJson("/app/api/v2/detail/" + id)
            let list = this.sortChapters(data.chapters || [])
            let chapters = {}
            let map = {}
            let byId = {}
            let index = 0
            let lastTime = ""
            for (let item of list) {
                index++
                let chapterId = String(item.id)
                let key = "c" + index + "_" + chapterId
                let name = item.name || "第" + index + "话"
                chapters[key] = name
                map[key] = {
                    id: chapterId,
                    name: name,
                    cover: item.cover || "",
                }
                byId[chapterId] = key
                if (item.created_at) lastTime = String(item.created_at)
            }
            this._chapters[id] = { map: map, byId: byId }
            let tags = {}
            let author = String(data.author || "").split(",").filter((x) => x)
            let tagList = String(data.tags || "").split(",").filter((x) => x)
            if (author.length) tags["作者"] = author
            if (tagList.length) tags["标签"] = tagList
            if (Number(data.isend) === 2) tags["状态"] = ["已完结"]
            else if (Number(data.isend) === 1) tags["状态"] = ["连载中"]
            let score = Number(data.score)
            if (isFinite(score) && score > 0) tags["评分"] = [String(data.score)]
            return new ComicDetails({
                title: data.name || "",
                cover: this.imageUrl(data.picY || data.picX),
                description: data.content || "",
                tags: tags,
                chapters: chapters,
                stars: isFinite(score) && score > 0 ? score / 2 : null,
                updateTime: lastTime ? lastTime.substring(0, 10) : null,
            })
        },

        loadEp: async (comicId, epId) => {
            comicId = String(comicId)
            epId = String(epId)
            if (!this._chapters[comicId]) {
                await this.comic.loadInfo(comicId)
            }
            let store = this._chapters[comicId] || { map: {}, byId: {} }
            let entry = store.map[epId]
            if (!entry && store.byId[epId]) entry = store.map[store.byId[epId]]
            if (!entry && /^\d+$/.test(epId)) entry = { id: epId, cover: "" }
            if (!entry) throw new Error("章节不存在")

            let official = await this.officialImages(entry.id)
            if (official && official.length) {
                return {
                    images: official.map((path) => this.imageUrl(path)),
                }
            }

            let cover = entry.cover
            if (!cover) {
                let data = await this.getJson("/app/api/v2/detail/" + comicId)
                for (let item of data.chapters || []) {
                    if (String(item.id) === entry.id && item.cover) {
                        cover = item.cover
                        break
                    }
                }
            }
            if (!cover) throw new Error("该章节没有可用图片")
            let images = await this.probeChapter(cover)
            if (!images.length) throw new Error("未找到章节图片")
            return { images: images }
        },

        onImageLoad: (url) => {
            let path = this._imagePaths[url] || url
            let candidates = this.imageCandidates(path)
            if (candidates.indexOf(url) < 0) candidates.unshift(url)
            let index = 0
            let next = () => {
                if (index >= candidates.length) return undefined
                let target = candidates[index++]
                return {
                    url: target,
                    headers: this.imageHeaders,
                    onResponse: (body) => this.decodeImage(body, target),
                    onLoadFailed: next,
                }
            }
            return next()
        },

        onThumbnailLoad: (url) => {
            return {
                url: url,
                headers: this.imageHeaders,
                onResponse: (body) => this.decodeImage(body, url),
            }
        },
    }

    // ---------- 官方章节接口（登录后） ----------

    getToken() {
        try {
            let token = this.loadData("token")
            if (token && typeof token === "string") return token.trim()
        } catch (e) {}
        return ""
    }

    async officialImages(chapterId) {
        let token = this.getToken()
        if (!token) return null
        try {
            let data = await this.getJson(
                "/app/api/chapter/v3/" + chapterId,
                [],
                { headers: { authorization: token }, allowFail: true }
            )
            if (!data) return null
            let pics = data.pics || data.images || data.image_list
            if (!Array.isArray(pics) || !pics.length) return null
            let out = []
            for (let item of pics) {
                if (typeof item === "string" && item) out.push(item)
                else if (item && (item.url || item.pic || item.path)) {
                    out.push(item.url || item.pic || item.path)
                }
            }
            return out.length ? out : null
        } catch (e) {
            return null
        }
    }

    // ---------- 图片地址 ----------

    imageCandidates(path) {
        if (!path) return []
        path = String(path).trim()
        if (!path) return []
        if (/^https?:\/\//i.test(path)) return [path]
        let isJp = path.indexOf("$jp$") === 0
        let clean = isJp ? path.replace(/^\$jp\$(?:cf)?/, "") : path
        if (clean.charAt(0) !== "/") clean = "/" + clean
        let out = []
        let line = this._line || "auto"
        if (line === "media") {
            out.push(this.imageHost + clean)
        } else if (line === "t1") {
            out.push(this.jpHost + clean)
        } else if (isJp) {
            out.push(this.jpHost + clean, this.imageHost + clean)
        } else {
            out.push(this.imageHost + clean, this.jpHost + clean)
        }
        out.push("http://img2.mechat.fun" + clean)
        let seen = {}
        return out.filter((u) => u && !seen[u] && (seen[u] = true))
    }

    imageUrl(path) {
        if (!path) return ""
        let candidates = this.imageCandidates(path)
        let url = candidates[0] || ""
        if (url) this._imagePaths[url] = path
        return url
    }

    // ---------- 图片解密 ----------

    isImage(bytes) {
        if (!bytes || bytes.length < 12) return false
        if (
            bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
            bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
        ) return true
        if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return true
        if (
            bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
            bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
        ) return true
        if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return true
        return false
    }

    imageSeed(url) {
        let value = String(url || "").split("#")[0]
        let match = value.match(/^[a-z][a-z0-9+.-]*:\/\/[^/?#]*(.*)$/i)
        let path = match ? match[1] : value
        if (match && (!path || path.charAt(0) === "?")) path = "/" + path
        let input = "v7\n" + this.imageSalt + "\n" + path
        let bytes = new Uint8Array(Convert.encodeUtf8(input))
        let hash = 0x811c9dc5
        for (let i = 0; i < bytes.length; i++) {
            hash ^= bytes[i]
            hash = Math.imul(hash, 0x01000193) >>> 0
        }
        return hash || 0x9e3779b9
    }

    imageStep(value) {
        let s = value >>> 0
        s ^= s << 13
        s >>>= 0
        s ^= s >>> 17
        s >>>= 0
        s ^= s << 5
        return s >>> 0
    }

    decodeImage(data, url) {
        let bytes = data instanceof ArrayBuffer ? new Uint8Array(data) : new Uint8Array(data.buffer || data)
        if (this.isImage(bytes)) {
            if (data instanceof ArrayBuffer) return data
            return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
        }
        let out = new Uint8Array(bytes.length)
        out.set(bytes)
        let state = this.imageSeed(url)
        let limit = Math.min(out.length, 65536)
        for (let i = 0; i < limit; i++) {
            state = this.imageStep(state)
            out[i] ^= state & 0xff
        }
        if (!this.isImage(out)) throw new Error("图片解码失败")
        return out.buffer
    }

    // ---------- 章节页码探测 ----------

    maxPages() {
        let value = 500
        try {
            value = parseInt(this.loadSetting("maxPages") || "500", 10)
        } catch (e) {}
        if (!isFinite(value) || value < 1) value = 500
        return Math.min(value, 2000)
    }

    async mapLimit(items, limit, fn) {
        let out = new Array(items.length)
        let index = 0
        let workers = []
        let run = async () => {
            while (index < items.length) {
                let i = index++
                out[i] = await fn(items[i])
            }
        }
        for (let i = 0; i < Math.min(limit, items.length); i++) workers.push(run())
        await Promise.all(workers)
        return out
    }

    pageUrl(dir, ext, page) {
        let candidates = this.imageCandidates(dir + "/" + page + "." + ext)
        return candidates[0] || ""
    }

    async pageExists(dir, ext, page) {
        let url = this.pageUrl(dir, ext, page)
        if (!url) return false
        try {
            let res = await Network.sendRequest("HEAD", url, this.imageHeaders)
            if (res.status === 200 || res.status === 206) return true
            if (res.status === 404 || res.status === 403 || res.status === 410) return false
            if (res.status === 405 || res.status === 501) {
                let range = Object.assign({ "Range": "bytes=0-0" }, this.imageHeaders)
                let fallback = await Network.sendRequest("GET", url, range)
                return fallback.status === 200 || fallback.status === 206
            }
            return null
        } catch (e) {
            return null
        }
    }

    loadPageCache() {
        try {
            let raw = this.loadData("pageCache")
            if (raw) this._pageCache = JSON.parse(raw)
        } catch (e) {
            this._pageCache = {}
        }
    }

    savePageCache() {
        try {
            this.saveData("pageCache", JSON.stringify(this._pageCache))
        } catch (e) {}
    }

    async probeChapter(cover) {
        let match = String(cover).match(/^(.*)\/(\d+)\.([A-Za-z0-9]+)(?:\?.*)?$/)
        if (!match) return []
        let dir = match[1]
        let ext = match[3].toLowerCase()
        let exts = [ext, "webp", "jpg", "jpeg", "png"].filter(
            (item, index, array) => array.indexOf(item) === index
        )
        for (let candidate of exts) {
            let range = await this.probeRange(dir, candidate)
            if (range && range.last >= range.first) {
                let images = []
                for (let i = range.first; i <= range.last; i++) {
                    images.push(this.imageUrl(dir + "/" + i + "." + candidate))
                }
                return images
            }
        }
        return []
    }

    async probeRange(dir, ext) {
        let key = dir + "|" + ext
        let cached = this._pageCache[key]
        if (cached && cached.last >= cached.first) {
            let lastOk = await this.pageExists(dir, ext, cached.last)
            let nextGone = await this.pageExists(dir, ext, cached.last + 1)
            if (lastOk === true && nextGone === false) return cached
        }

        let max = this.maxPages()
        let first = 1
        let head = await this.mapLimit(
            [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
            6,
            (i) => this.pageExists(dir, ext, i)
        )
        let found = -1
        for (let i = 0; i < head.length; i++) {
            if (head[i] === true) {
                found = i
                break
            }
        }
        if (found >= 0) {
            first = found + 1
        } else {
            let tail = []
            for (let i = 13; i <= 48; i++) tail.push(i)
            let more = await this.mapLimit(tail, 8, (i) => this.pageExists(dir, ext, i))
            for (let i = 0; i < more.length; i++) {
                if (more[i] === true) {
                    first = tail[i]
                    break
                }
            }
            if (first === 1) {
                // 1~48 都不存在，视为无效章节
                return null
            }
        }

        let lo = first
        let step = 1
        let hi = first + 1
        while (hi <= max) {
            let exists = await this.pageExists(dir, ext, hi)
            if (exists === true) {
                lo = hi
                step *= 2
                hi = lo + step
            } else if (exists === false) {
                break
            } else {
                hi++
            }
        }
        if (hi > max) hi = max + 1

        while (lo + 1 < hi) {
            let mid = Math.floor((lo + hi) / 2)
            let exists = await this.pageExists(dir, ext, mid)
            if (exists === true) lo = mid
            else hi = mid
        }

        // 防止探测抖动造成提前截断
        for (let i = 1; i <= 4; i++) {
            let exists = await this.pageExists(dir, ext, lo + i)
            if (exists === true) lo += i
            else break
        }

        let range = { first: first, last: lo }
        this._pageCache[key] = range
        this.savePageCache()
        return range
    }

    // ---------- 账号 ----------

    account = {
        login: async (account, pwd) => {
            let email = String(account || "").trim()
            let password = String(pwd || "").trim()
            if (!email || !password) throw new Error("请输入邮箱和密码")
            let response = await Network.post(
                this.api + this.signedPath("/app/api/user/login"),
                Object.assign({ "Content-Type": "application/json" }, this.headers),
                JSON.stringify({ email: email, pwd: password })
            )
            let data = null
            try {
                data = JSON.parse(response.body)
            } catch (e) {}
            if (response.status === 400 || response.status === 401 || response.status === 403) {
                throw new Error(data && data.msg ? data.msg : "邮箱或密码错误")
            }
            if (response.status === 429) throw new Error("登录请求过于频繁，请稍后重试")
            if (response.status !== 200) throw new Error("登录失败 HTTP " + response.status)
            if (!data) throw new Error("登录返回格式错误")
            let token = data && data.data && data.data.token
            if (!token || (typeof data.code === "number" && data.code !== 201 && data.code !== 200)) {
                throw new Error(data && data.msg ? data.msg : "登录失败")
            }
            this.saveData("token", String(token))
            return true
        },
        logout: () => {
            try {
                this.deleteData("token")
            } catch (e) {}
        },
    }
}
