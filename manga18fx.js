/** @type {import('./_venera_.js')} */

class Manga18fx extends ComicSource {
    name = "Manga18FX"
    key = "manga18fx"
    version = "1.0.2"
    minAppVersion = "1.6.0"
    url = "https://cdn.jsdelivr.net/gh/venera-app/venera-configs@main/manga18fx.js"

    base = "https://manga18fx.com"

    // 封面兜底链的最后一环。详情页没有 og:image，站点自己这张 logo 一定在（200 image/png）。
    SITE_ICON = "https://manga18fx.com/images/manga18fx.png"

    // 列表固定 24 条一页（末页实测 6 / 13 / 15 条，与 3462→145 页、37→2 页的换算吻合）
    perPage = 24

    // 探索页每个分区只铺前 5 本，其余全交给 viewMore
    explorePreview = 5

    ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36"

    // 会话级总页数缓存：path -> maxPage（进程内存活，app 重启即清）
    maxPageCache = {}

    // 探索页四个分区。path 是站点相对路径，fallback 只在页面 h1 抓不到时兜底，
    // 正常情况标题一律取原站 h1（见 pageTitle）。
    exploreSections = [
        { path: "/hot-manga", fallback: "Popular Manga" },
        { path: "/manga-genre/manhwa", fallback: "Manhwa" },
        { path: "/manhwa-raw", fallback: "Manhwa Raw" },
        { path: "/manga-genre/manhua", fallback: "Manhua" },
    ]

    // param 统一用**站点相对路径**（不带前导斜杠），这样探索页的 viewMore
    // 和分类页的标签可以共用同一套 URL 规则。
    categoryParts = [
        {
            name: "Categories",
            items: [
                ["Uncensored Manhwa", "manga-genre/uncensored-manhwa"],
                ["Drama", "manga-genre/drama"],
                ["Action", "manga-genre/action"],
            ],
        },
        {
            name: "Genres",
            items: [
                ["Romance", "manga-genre/romance"],
                ["Harem", "manga-genre/harem"],
                ["Seinen", "manga-genre/seinen"],
                ["School Life", "manga-genre/school-life"],
                ["Mature", "manga-genre/mature"],
                ["Psychological", "manga-genre/psychological"],
                ["Tragedy", "manga-genre/tragedy"],
                ["Ecchi", "manga-genre/ecchi"],
                ["Comedy", "manga-genre/comedy"],
                ["Fantasy", "manga-genre/fantasy"],
                ["Supernatural", "manga-genre/supernatural"],
                ["Isekai", "manga-genre/isekai"],
                ["Shoujo", "manga-genre/shoujo"],
                ["Adventure", "manga-genre/adventure"],
                ["Shounen", "manga-genre/shounen"],
                ["Mystery", "manga-genre/mystery"],
                ["Thriller", "manga-genre/thriller"],
                ["Reincarnation", "manga-genre/reincarnation"],
            ],
        },
    ]

    init() {
        this.base = String(this.base || "").replace(/\/+$/, "")
    }

    // ==================== 基础工具 ====================

    headers(extra) {
        let h = {
            "User-Agent": this.ua,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
            "Referer": this.base + "/",
        }
        if (extra) {
            for (let k in extra) h[k] = extra[k]
        }
        return h
    }

    /**
     * 只做 trim + 协议补齐 + 站内绝对路径拼接。
     * 图片地址在这个站全是绝对地址（`src` 与 `data-src` 同值），
     * 这里补的是以防万一的 `/xxx` 形式。
     */
    abs(u) {
        let s = String(u == null ? "" : u).trim()
        if (!s) return ""
        if (s.indexOf("//") === 0) return "https:" + s
        if (/^https?:\/\//i.test(s)) return s
        if (s.charAt(0) === "/") return this.base + s
        return this.base + "/" + s
    }

    cleanText(s) {
        return String(s == null ? "" : s).replace(/\s+/g, " ").trim()
    }

    /**
     * 从链接里取漫画 slug。列表页只把漫画链接喂进来，
     * 但章节链接（`/manga/{slug}/chapter-3`）形状相同，显式挡掉。
     */
    idFromHref(href) {
        let s = String(href == null ? "" : href).trim()
        if (!s) return ""
        s = s.replace(/^https?:\/\/[^/]+/i, "")
        s = s.split("#")[0].split("?")[0]
        if (/\/chapter-/i.test(s)) return ""
        let m = /\/manga\/([^/]+)/.exec(s)
        return m ? m[1] : ""
    }

    async fetchPage(url) {
        let res = await Network.get(url, this.headers())
        if (res.status !== 200) {
            throw `Invalid status code: ${res.status} (${url})`
        }
        return res.body
    }

    /** 分页 URL：第 1 页不带参数，其余一律 `?page=N`（对路径式分页同样有效） */
    listUrl(path, page) {
        let rel = String(path == null ? "" : path).trim()
        if (!rel) rel = "/"
        if (rel.charAt(0) !== "/") rel = "/" + rel
        let p = Number(page) || 1
        if (p <= 1) return this.base + rel
        let sep = rel.indexOf("?") >= 0 ? "&" : "?"
        return this.base + rel + sep + "page=" + p
    }

    chapterUrl(comicId, epId) {
        let e = String(epId == null ? "" : epId).trim()
        if (!e) return this.base + "/manga/" + comicId
        if (/^https?:\/\//i.test(e)) return e
        if (e.charAt(0) === "/") return this.base + e
        // 裸章节号（"319" / "316.5"）也要能拼。
        // ⚠️ 小数章在站点 URL 里是 `chapter-316-5`（点写成连字符），
        // 拼成 `chapter-316.5` 会 404（实测确认）。
        if (/^\d+([.-]\d+)?$/.test(e)) {
            return this.base + "/manga/" + comicId + "/chapter-" + e.replace(/\./g, "-")
        }
        return this.base + "/manga/" + comicId + "/" + e
    }

    // ==================== 解析 ====================

    /** 列表卡片：`.bsx-item` 一套选择器同时服务列表页 / 搜索页 / 分类页 */
    parseList(doc) {
        let out = []
        for (let item of doc.querySelectorAll(".bsx-item")) {
            let a = item.querySelector(".thumb-manga a") || item.querySelector("a")
            if (!a) continue
            let id = this.idFromHref(a.attributes["href"])
            if (!id) continue

            let img = item.querySelector(".thumb-manga img") || item.querySelector("img")
            let cover = ""
            if (img) cover = this.abs(img.attributes["data-src"] || img.attributes["src"])
            if (!cover) cover = this.SITE_ICON

            let t = item.querySelector("h3.tt a") || item.querySelector(".bigor-manga a")
            let title = t ? this.cleanText(t.text) : id
            if (!title) title = id

            // 卡片底部挂着最新章节 + 日期，顺手当副标题用
            let ch = item.querySelector(".list-chapter .chapter-item")
            let desc = ""
            if (ch) {
                let ca = ch.querySelector("a.btn-link") || ch.querySelector("a")
                let cn = ca ? this.cleanText(ca.text) : ""
                let on = ch.querySelector(".post-on")
                let dt = on ? this.cleanText(on.text) : ""
                desc = cn
                if (cn && dt) desc = cn + " · " + dt
            }

            out.push(new Comic({
                id: id,
                title: title,
                cover: cover,
                tags: [],
                description: desc,
            }))
        }
        return out
    }

    /**
     * 分区标题一律取原站 h1（`/hot-manga` → "Popular Manga"，
     * `/manga-genre/manhwa` → "LATEST Manhwa UPDATES"）。
     * 搜索页的 h1 是 `RESULTS FOR "xx"`，不在这个用途里，但取到也无害。
     */
    pageTitle(doc) {
        let h1 = doc.querySelector(".releases h1") || doc.querySelector("h1")
        if (!h1) return ""
        // h1 里夹着 `<i class="icofont-...">` 图标，text 只留文案
        return this.cleanText(h1.text)
    }

    /** `.res-title` 的 `"3462 Results"` → 3462 */
    resultsCount(doc) {
        let el = doc.querySelector(".res-title")
        if (!el) return 0
        let m = /([\d,]+)\s*Results/i.exec(this.cleanText(el.text))
        if (!m) return 0
        let n = parseInt(m[1].replace(/,/g, ""), 10)
        return isNaN(n) ? 0 : n
    }

    /** 分页器里 active 的页号（越界回落后，它就是真实的末页号） */
    currentPage(doc) {
        let a = doc.querySelector(".pagination li.active a")
        if (!a) return 0
        let n = parseInt(this.cleanText(a.text), 10)
        if (!isNaN(n) && n > 0) return n
        let m = /page=(\d+)/.exec(a.attributes["href"] || "")
        if (m) {
            let v = parseInt(m[1], 10)
            if (!isNaN(v) && v > 0) return v
        }
        return 0
    }

    nextDisabled(doc) {
        return !!doc.querySelector(".pagination li.next.disabled")
    }

    /**
     * 请求一个超大页码。站点越界不 404，而是静默回落到末页，
     * 于是分页器 active 的页号 = 真实总页数（实测 manhwa→145、hot-manga→171、manhua→2）。
     */
    async probeMaxPage(path) {
        let url = this.listUrl(path, 99999)
        let doc = new HtmlDocument(await this.fetchPage(url))
        let p = this.currentPage(doc)
        doc.dispose()
        return p > 0 ? p : 1
    }

    /**
     * 总页数。优先用 `.res-title` 的 Results 计数（免一次请求），
     * 没有的话（hot-manga / 搜索页）才去越界探测，探测结果进缓存。
     */
    async resolveMaxPage(path, page, doc) {
        let n = this.resultsCount(doc)
        if (n > 0) return Math.max(1, Math.ceil(n / this.perPage))

        // 当前页就是末页时，分页器直接告诉了我们答案，不用再探
        if (this.nextDisabled(doc)) {
            let cur = this.currentPage(doc)
            if (cur > 0) {
                this.maxPageCache[path] = cur
                return cur
            }
        }

        let cached = this.maxPageCache[path]
        if (cached) return Math.max(cached, page)

        let probed = 1
        try {
            probed = await this.probeMaxPage(path)
        } catch (e) {
            // 探测失败不能把已经拿到的内容吞掉：保守返回当前页
            probed = page
        }
        this.maxPageCache[path] = probed
        return Math.max(probed, page)
    }

    /** 详情页推荐位 `.related-manga .related-items .item` */
    parseRelated(doc) {
        let out = []
        for (let item of doc.querySelectorAll(".related-manga .related-items .item")) {
            let a = item.querySelector(".thumb a") || item.querySelector("a")
            if (!a) continue
            let id = this.idFromHref(a.attributes["href"])
            if (!id) continue
            let img = item.querySelector(".thumb img") || item.querySelector("img")
            let cover = ""
            if (img) cover = this.abs(img.attributes["data-src"] || img.attributes["src"])
            if (!cover) cover = this.SITE_ICON
            let t = item.querySelector("h5.tt a") || item.querySelector(".bigor a")
            let title = t ? this.cleanText(t.text) : id
            out.push(new Comic({ id: id, title: title || id, cover: cover, tags: [] }))
        }
        return out
    }

    /** `#chapterlist` 里的全量章节（站点一次直出，343 章也全在 DOM 里） */
    parseChapters(doc) {
        // ⚠️ 站点把最新章排在列表最上面（chapter-319 → chapter-1），先收进数组、
        // 再反转插入 object，让阅读顺序（旧 → 新）与阅读器的「下一章 / 上一章」
        // 方向对齐 —— 否则读第 78 話按「下一章」会跑到第 77 話。
        let pairs = []
        for (let li of doc.querySelectorAll("#chapterlist .row-content-chapter li")) {
            let a = li.querySelector("a.chapter-name") || li.querySelector("a")
            if (!a) continue
            let href = String(a.attributes["href"] || "").trim()
            if (!href) continue
            let name = this.cleanText(a.text) || href
            // epId 用完整站内路径，无歧义，loadEp 直接吃
            pairs.push([href, name])
        }
        let chapters = {}
        for (let i = pairs.length - 1; i >= 0; i--) chapters[pairs[i][0]] = pairs[i][1]
        return chapters
    }

    /**
     * `Type` / `Status` 这两行只有 `<h5>` 标题文字、正文没有 class，
     * 按标题文字定位它所在的 `.post-content_item` 再取 `.summary-content`。
     * 不用 `element.parent` —— 少一个依赖，mock 也省事。
     */
    summaryField(doc, label) {
        let want = String(label == null ? "" : label).toLowerCase()
        for (let item of doc.querySelectorAll(".post-content_item")) {
            let h5 = item.querySelector(".summary-heading h5")
            if (!h5) continue
            let t = this.cleanText(h5.text).toLowerCase().replace(/:+$/, "")
            if (t !== want) continue
            let val = item.querySelector(".summary-content")
            if (val) return this.cleanText(val.text)
        }
        return ""
    }

    // ==================== 探索页 ====================

    explore = [
        {
            title: "Manga18FX",
            type: "multiPartPage",
            load: async () => {
                let defs = this.exploreSections
                // 四个分区彼此独立，一次并发打满；某一页挂了只丢那一块
                let docs = await Promise.all(defs.map((d) => {
                    return this.fetchPage(this.base + d.path)
                        .then((html) => new HtmlDocument(html))
                        .catch(() => null)
                }))

                let parts = []
                for (let i = 0; i < defs.length; i++) {
                    let d = defs[i]
                    let doc = docs[i]
                    if (!doc) continue
                    let title = this.pageTitle(doc) || d.fallback
                    let comics = this.parseList(doc).slice(0, this.explorePreview)
                    doc.dispose()
                    if (!comics.length) continue
                    parts.push({
                        title: title,
                        comics: comics,
                        // 其余全部交给 viewMore
                        viewMore: {
                            page: "category",
                            attributes: {
                                category: title,
                                param: d.path.replace(/^\/+/, ""),
                            },
                        },
                    })
                }
                return parts
            },
        },
    ]

    // ==================== 分类页 ====================

    category = {
        title: "Manga18FX",
        parts: [
            {
                name: "Categories",
                type: "fixed",
                categories: [
                    {
                        label: "Uncensored Manhwa",
                        target: { page: "category", attributes: { category: "Uncensored Manhwa", param: "manga-genre/uncensored-manhwa" } },
                    },
                    {
                        label: "Drama",
                        target: { page: "category", attributes: { category: "Drama", param: "manga-genre/drama" } },
                    },
                    {
                        label: "Action",
                        target: { page: "category", attributes: { category: "Action", param: "manga-genre/action" } },
                    },
                ],
            },
            {
                name: "Genres",
                type: "fixed",
                categories: [
                    {
                        label: "Romance",
                        target: { page: "category", attributes: { category: "Romance", param: "manga-genre/romance" } },
                    },
                    {
                        label: "Harem",
                        target: { page: "category", attributes: { category: "Harem", param: "manga-genre/harem" } },
                    },
                    {
                        label: "Seinen",
                        target: { page: "category", attributes: { category: "Seinen", param: "manga-genre/seinen" } },
                    },
                    {
                        label: "School Life",
                        target: { page: "category", attributes: { category: "School Life", param: "manga-genre/school-life" } },
                    },
                    {
                        label: "Mature",
                        target: { page: "category", attributes: { category: "Mature", param: "manga-genre/mature" } },
                    },
                    {
                        label: "Psychological",
                        target: { page: "category", attributes: { category: "Psychological", param: "manga-genre/psychological" } },
                    },
                    {
                        label: "Tragedy",
                        target: { page: "category", attributes: { category: "Tragedy", param: "manga-genre/tragedy" } },
                    },
                    {
                        label: "Ecchi",
                        target: { page: "category", attributes: { category: "Ecchi", param: "manga-genre/ecchi" } },
                    },
                    {
                        label: "Comedy",
                        target: { page: "category", attributes: { category: "Comedy", param: "manga-genre/comedy" } },
                    },
                    {
                        label: "Fantasy",
                        target: { page: "category", attributes: { category: "Fantasy", param: "manga-genre/fantasy" } },
                    },
                    {
                        label: "Supernatural",
                        target: { page: "category", attributes: { category: "Supernatural", param: "manga-genre/supernatural" } },
                    },
                    {
                        label: "Isekai",
                        target: { page: "category", attributes: { category: "Isekai", param: "manga-genre/isekai" } },
                    },
                    {
                        label: "Shoujo",
                        target: { page: "category", attributes: { category: "Shoujo", param: "manga-genre/shoujo" } },
                    },
                    {
                        label: "Adventure",
                        target: { page: "category", attributes: { category: "Adventure", param: "manga-genre/adventure" } },
                    },
                    {
                        label: "Shounen",
                        target: { page: "category", attributes: { category: "Shounen", param: "manga-genre/shounen" } },
                    },
                    {
                        label: "Mystery",
                        target: { page: "category", attributes: { category: "Mystery", param: "manga-genre/mystery" } },
                    },
                    {
                        label: "Thriller",
                        target: { page: "category", attributes: { category: "Thriller", param: "manga-genre/thriller" } },
                    },
                    {
                        label: "Reincarnation",
                        target: { page: "category", attributes: { category: "Reincarnation", param: "manga-genre/reincarnation" } },
                    },
                ],
            },
        ],
        enableRankingPage: false,
    }

    categoryComics = {
        load: async (category, param, options, page) => {
            let rel = String(param == null ? "" : param).trim().replace(/^\/+/, "")
            if (!rel) return { comics: [], maxPage: 1 }
            let path = "/" + rel
            let p = Number(page) || 1
            let doc = new HtmlDocument(await this.fetchPage(this.listUrl(path, p)))
            let comics = this.parseList(doc)
            let maxPage = await this.resolveMaxPage(path, p, doc)
            doc.dispose()
            if (!comics.length) return { comics: [], maxPage: 1 }
            return { comics: comics, maxPage: maxPage }
        },
    }

    // ==================== 搜索 ====================

    search = {
        load: async (keyword, options, page) => {
            let kw = String(keyword == null ? "" : keyword).trim()
            if (!kw) return { comics: [], maxPage: 1 }

            // 贴详情页 URL 也能搜出那本
            let m = /manga18fx\.com\/manga\/([^/?#]+)/i.exec(kw)
            if (m) kw = m[1]

            let p = Number(page) || 1
            let path = "/search?q=" + encodeURIComponent(kw)
            let doc = new HtmlDocument(await this.fetchPage(this.listUrl(path, p)))
            let comics = this.parseList(doc)
            let maxPage = await this.resolveMaxPage(path, p, doc)
            doc.dispose()
            if (!comics.length) return { comics: [], maxPage: 1 }
            return { comics: comics, maxPage: maxPage }
        },
        optionList: [],
        enableTagsSuggestions: false,
    }

    // ==================== 详情 / 章节 ====================

    comic = {
        loadInfo: async (id) => {
            let doc = new HtmlDocument(await this.fetchPage(this.base + "/manga/" + id))

            let h1 = doc.querySelector(".post-title h1") || doc.querySelector("h1")
            let title = h1 ? this.cleanText(h1.text) : id
            if (!title) title = id

            let img = doc.querySelector(".summary_image img")
            let cover = ""
            if (img) cover = this.abs(img.attributes["data-src"] || img.attributes["src"])
            if (!cover) {
                let og = doc.querySelector("meta[property='og:image']")
                if (og) cover = this.abs(og.attributes["content"])
            }
            if (!cover) cover = this.SITE_ICON

            // description 是死的（SelectableText，不渲染 HTML），纯文本就好
            let dsc = doc.querySelector(".panel-story-description .dsct") || doc.querySelector(".dsct")
            let description = dsc ? this.cleanText(dsc.text) : ""

            // tags 是 Map<String, List<String>>（跟 Comic.tags 的扁平数组不是一回事）
            let tags = {}

            let genres = []
            for (let a of doc.querySelectorAll(".genres-content a")) {
                let t = this.cleanText(a.text)
                if (t) genres.push(t)
            }
            if (genres.length) tags["Genres"] = genres

            let authors = []
            for (let a of doc.querySelectorAll(".author-content a")) {
                let t = this.cleanText(a.text)
                if (t) authors.push(t)
            }
            if (authors.length) tags["Author"] = authors

            let artists = []
            for (let a of doc.querySelectorAll(".artist-content a")) {
                let t = this.cleanText(a.text)
                if (t) artists.push(t)
            }
            if (artists.length) tags["Artist"] = artists

            // Type / Status 是纯文本行，没有 class 可挂，按 summary-heading 的标题文字找
            let type = this.summaryField(doc, "Type")
            if (type) tags["Type"] = [type]
            let status = this.summaryField(doc, "Status")
            if (status) tags["Status"] = [status]

            let chapters = this.parseChapters(doc)
            let recommend = this.parseRelated(doc)

            doc.dispose()

            return new ComicDetails({
                title: title,
                cover: cover,
                tags: tags,
                description: description,
                chapters: chapters,
                url: this.base + "/manga/" + id,
                recommend: recommend,
            })
        },

        loadEp: async (comicId, epId) => {
            let doc = new HtmlDocument(await this.fetchPage(this.chapterUrl(comicId, epId)))

            let images = []
            for (let img of doc.querySelectorAll(".read-content .page-break img")) {
                let u = this.abs(img.attributes["src"] || img.attributes["data-src"])
                if (u) images.push(u)
            }
            // 结构变了也别整章空手而归：read-content 里的图按域名筛一遍
            if (!images.length) {
                for (let img of doc.querySelectorAll(".read-content img")) {
                    let u = this.abs(img.attributes["src"] || img.attributes["data-src"])
                    if (u && /manga18fx\.com/i.test(u)) images.push(u)
                }
            }
            doc.dispose()

            return { images: images }
        },

        /**
         * 唯一能自定义「点了执行什么」的地方就是详情页的 tag 芯片。
         * Genres 芯片 → 直接开对应的 genre 分类页（slug 规则就是小写连字符，
         * "School Life" → school-life，跟站点 URL 完全一致）。
         * 其余（Author / Artist / Type / Status）不劫持，返回 null。
         */
        onClickTag: (namespace, tag) => {
            let t = this.cleanText(tag)
            if (!t) return null
            if (namespace !== "Genres") return null
            let slug = t.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")
            if (!slug) return null
            return {
                page: "category",
                attributes: { category: t, param: "manga-genre/" + slug },
            }
        },

        idMatch: "manga18fx\\.com/manga/([^/?#]+)",

        link: {
            domains: ["manga18fx.com", "www.manga18fx.com"],
            linkToId: (url) => {
                let m = /manga18fx\.com\/manga\/([^/?#]+)/i.exec(String(url == null ? "" : url))
                return m ? m[1] : null
            },
        },
    }

    translation = {
        "zh_CN": {
            "Manga18FX": "Manga18FX",
            "Categories": "分类",
            "Genres": "题材",
        },
        "zh_TW": {
            "Categories": "分類",
            "Genres": "題材",
        },
        "en": {},
    }
}
