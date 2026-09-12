class MangaForFree extends ComicSource {

    name = "MangaForFree"
    key = "mangaforfree"
    version = "0.6.3"
    minAppVersion = "1.6.0"
    url = "https://cdn.jsdelivr.net/gh/meaninglesslyy/venera-configs@main/mangaforfree.js"

    base = "https://mangaforfree.net"
    ajaxUrl = "https://mangaforfree.net/wp-admin/admin-ajax.php"
    logo = "https://mangaforfree.net/wp-content/uploads/2023/02/LOGO-Mangaforfree-Net-2.jpg"

    pageHeaders() {
        return {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9,zh-CN;q=0.8",
            "Referer": this.base + "/",
        }
    }

    ajaxHeaders() {
        return {
            ...this.pageHeaders(),
            "X-Requested-With": "XMLHttpRequest",
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        }
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms))
    }

    normalizeUrl(u) {
        if (!u) return ""
        u = String(u).trim()
        if (u.startsWith("//")) return "https:" + u
        if (/^https?:\/\//i.test(u)) return u
        if (u.startsWith("/")) return this.base + u
        return u
    }

    slugFromUrl(url) {
        return url.replace(/\/+$/, "").split("/").pop()
    }

    prettyTitle(slug) {
        let t = String(slug).replace(/[-_]/g, " ").replace(/\b\w/g, c => c.toUpperCase())
        return t || slug
    }

    dedupe(comics) {
        let seen = new Set()
        return comics.filter(c => {
            if (seen.has(c.id)) return false
            seen.add(c.id)
            return true
        })
    }

    // ============ 通用工具 ============
    parseRss(body) {
        let comics = []
        let re = /<item>([\s\S]*?)<\/item>/g
        let m
        while ((m = re.exec(body)) !== null) {
            let block = m[1]
            let t = block.match(/<title>([^<]*)<\/title>/)
            let l = block.match(/<link>([^<]*)<\/link>/)
            if (t && l) comics.push({ id: this.slugFromUrl(l[1]), title: t[1].trim(), subTitle: null, cover: "" })
        }
        return comics
    }

    async fetchBody(label, url, headers) {
        let res = await Network.get(url, headers || this.pageHeaders())
        if (res.status !== 200) throw `Invalid status code: ${res.status}`
        return res.body
    }

    // sitemap 列表：缓存 6 小时后自动重新拉取，新漫画自动跟上
    async allSlugs() {
        let cached = this.loadData("all_slugs")
        if (cached) {
            try {
                let obj = JSON.parse(cached)
                if (Array.isArray(obj.list) && obj.t && (Date.now() - obj.t) < 6 * 3600 * 1000) {
                    return obj.list
                }
            } catch (e) { }
        }

        let body = await this.fetchBody("sitemap", `${this.base}/wp-sitemap-posts-wp-manga-1.xml`)
        let slugs = []
        let re = /<loc>https?:\/\/mangaforfree\.net\/manga\/([^/<]+)\/?<\/loc>/g
        let m
        while ((m = re.exec(body)) !== null) {
            let s = m[1]
            if (s && !s.includes("chapter")) slugs.push(s)
        }
        slugs = [...new Set(slugs)]
        this.saveData("all_slugs", JSON.stringify({ t: Date.now(), list: slugs }))
        return slugs
    }

    // 补封面 + 顺手补真实标题（同一请求，带缓存）
    async fillCover(c) {
        let cachedCover = this.loadData("cov_" + c.id)
        let cachedTitle = this.loadData("tle_" + c.id)
        if (cachedCover) c.cover = cachedCover
        if (cachedTitle) c.title = cachedTitle
        if (cachedCover && cachedTitle) return
        try {
            let res = await Network.get(`${this.base}/manga/${c.id}/`, this.pageHeaders())
            if (res.status === 200) {
                let doc = new HtmlDocument(res.body)
                let el = doc.querySelector(".summary_image img")
                let cover = this.normalizeUrl(el?.attributes["data-src"] || el?.attributes["src"] || "")
                let tEl = doc.querySelector(".post-title h1")?.text?.trim()
                doc.dispose()
                if (cover) { c.cover = cover; this.saveData("cov_" + c.id, cover) }
                if (tEl) { c.title = tEl; this.saveData("tle_" + c.id, tEl) }
            }
        } catch (e) { }
    }

    async enrichCovers(comics, max = 24) {
        let list = comics.slice(0, max)
        for (let i = 0; i < list.length; i += 2) {
            await Promise.all(list.slice(i, i + 2).map(c => this.fillCover(c)))
            await this.sleep(250)
        }
    }

    // 类型/最新 RSS（大厅用）
    async genreRss(param, page) {
        let url = param === "latest" ? `${this.base}/manga/feed/` : `${this.base}/manga-genre/${param}/feed/`
        url += `?posts_per_rss=30&paged=${page}`
        return this.parseRss(await this.fetchBody(`${param} p${page}`, url))
    }

    // HTML 漫画条目解析（搜索用）
    parseSearchHtml(body) {
        let doc = new HtmlDocument(body)
        let comics = []
        doc.querySelectorAll(".c-tabs-item__content, .page-item-detail").forEach(el => {
            let thumb = el.querySelector(".tab-thumb img, .item-thumb img, img")
            let cover = this.normalizeUrl(thumb?.attributes["data-src"] || thumb?.attributes["src"] || "")
            let linkEl = el.querySelector(".tab-summary .post-title h3 a, .item-summary h3 a, h3 a, a")
            let link = linkEl?.attributes["href"] || ""
            let title = linkEl?.text?.trim() || ""
            if (link && title) comics.push({ id: this.slugFromUrl(link), title, subTitle: null, cover })
        })
        doc.dispose()
        return comics
    }

    // ============ 大厅：LATEST + “更多”入口（跳到 ALL） ============
    explore = [
        {
            title: "MangaForFree",
            type: "multiPartPage",
            load: async (page) => {
                let comics = this.dedupe(await this.genreRss("latest", 1)).slice(0, 15)
                await this.enrichCovers(comics, 12)
                return [
                    {
                        title: "LATEST",
                        comics,
                        viewMore: { page: "category", attributes: { category: "ALL", param: "all" } },
                    }
                ]
            }
        }
    ]

    // ============ 分类：ALL（sitemap 驱动，43页×24本） ============
    category = {
        title: "MangaForFree",
        parts: [
            {
                name: "分类",
                type: "fixed",
                itemType: "category",
                categories: ["ALL"],
                categoryParams: ["all"],
            }
        ],
        enableRankingPage: false,
    }

    categoryComics = {
        load: async (category, param, options, page) => {
            try {
                let slugs = await this.allSlugs()
                let perPage = 24
                let start = (page - 1) * perPage
                let slice = slugs.slice(start, start + perPage)

                let comics = slice.map(s => ({
                    id: s,
                    title: this.prettyTitle(s),
                    subTitle: null,
                    cover: "",
                }))

                await this.enrichCovers(comics, slice.length)
                let maxPage = Math.max(1, Math.ceil(slugs.length / perPage))
                return { comics, maxPage }
            } catch (e) {
                return { comics: [], maxPage: page }
            }
        }
    }

    // ============ 搜索 ============
    search = {
        load: async (keyword, options, page) => {
            let kw = encodeURIComponent(keyword)

            try {
                let comics = []
                for (let p = 1; p <= 2; p++) {
                    let url = p === 1 ? `${this.base}/search/${kw}/` : `${this.base}/search/${kw}/page/${p}/`
                    comics = comics.concat(this.parseSearchHtml(await this.fetchBody("search", url)))
                }
                comics = this.dedupe(comics)
                if (comics.length) return { comics, maxPage: page + 1 }
            } catch (e) { }

            try {
                let comics = this.parseRss(await this.fetchBody("search-rss", `${this.base}/search/${kw}/feed/rss2/`))
                await this.enrichCovers(comics, 10)
                if (comics.length) return { comics, maxPage: 1 }
            } catch (e) { }

            try {
                let comics = []
                for (let p = 1; p <= 2; p++) {
                    comics = comics.concat(this.parseRss(await this.fetchBody(
                        "search-rss2",
                        `${this.base}/?s=${kw}&post_type=wp-manga&feed=rss2&posts_per_rss=50&paged=${p}`
                    )))
                }
                comics = this.dedupe(comics)
                await this.enrichCovers(comics, 15)
                if (comics.length) return { comics, maxPage: 1 }
            } catch (e) { }

            let res = await Network.post(this.ajaxUrl, this.ajaxHeaders(), `action=wp-manga-search-manga&title=${kw}`)
            let data = JSON.parse(res.body)
            let comics = (data.data || []).map(item => ({ id: this.slugFromUrl(item.url), title: item.title, subTitle: null, cover: "" }))
            await this.enrichCovers(comics, 10)
            return { comics, maxPage: 1 }
        },
        optionList: []
    }

    // ============ 详情 / 章节 ============
    async extractMangaId(pageHtml, respHeaders) {
        let link = respHeaders?.["link"] || respHeaders?.["Link"] || ""
        let m = link.match(/[?&]p=(\d+)/)
        if (m) return m[1]
        m = pageHtml.match(/rel=["']shortlink["'][^>]*href=["'][^"']*[?&]p=(\d+)/)
        if (m) return m[1]
        m = pageHtml.match(/[?&]p=(\d{4,7})/)
        if (m) return m[1]
        throw "无法从详情页提取 manga id"
    }

    async getChaptersByMangaId(mangaId) {
        let res = await Network.post(this.ajaxUrl, this.ajaxHeaders(), `action=manga_get_chapters&manga=${mangaId}`)
        if (res.status !== 200) throw `Invalid status code: ${res.status}`
        let doc = new HtmlDocument(res.body)
        let chapters = new Map()
        let seen = new Set()
        doc.querySelectorAll("ul.main.version-chap li.wp-manga-chapter > a").forEach(a => {
            let href = a.attributes["href"]
            let name = a.text.trim()
            if (!href || !name || seen.has(href)) return
            seen.add(href)
            chapters.set(this.slugFromUrl(href), name)
        })
        doc.dispose()
        return chapters
    }

    comic = {
        loadInfo: async (id) => {
            let res = await Network.get(`${this.base}/manga/${id}/`, this.pageHeaders())
            if (res.status !== 200) throw `Invalid status code: ${res.status}`
            let doc = new HtmlDocument(res.body)
            let title = doc.querySelector(".post-title h1")?.text?.trim() || id
            let coverEl = doc.querySelector(".summary_image img")
            let cover = this.normalizeUrl(
                coverEl?.attributes["data-src"] || coverEl?.attributes["data-lazy-src"] || coverEl?.attributes["src"] || ""
            )
            let desc = doc.querySelector(".summary__content")?.text?.trim()
                || doc.querySelector(".manga-excerpt")?.text?.trim() || ""
            let authors = doc.querySelectorAll(".author-content a").map(a => a.text.trim())
            let tags = doc.querySelectorAll(".genres-content a").map(a => a.text.trim())
            let status = doc.querySelector(".post-status .summary-content")?.text?.trim()
            doc.dispose()

            let mangaId = await this.extractMangaId(res.body, res.headers)
            let chapters = await this.getChaptersByMangaId(mangaId)
            if (!chapters.size) throw "未解析到章节列表"

            return new ComicDetails({
                id, title, cover, description: desc,
                tags: { "作者": authors, "状态": status ? [status] : [], "标签": tags },
                chapters,
            })
        },

        loadEp: async (comicId, epId) => {
            let res = await Network.get(`${this.base}/manga/${comicId}/${epId}/`, this.pageHeaders())
            if (res.status !== 200) throw `Invalid status code: ${res.status}`
            let doc = new HtmlDocument(res.body)
            let images = []
            doc.querySelectorAll(".reading-content img").forEach(img => {
                let src = this.normalizeUrl(
                    img.attributes["data-src"] || img.attributes["data-lazy-src"] || img.attributes["src"] || ""
                )
                if (src) images.push(src)
            })
            doc.dispose()
            if (!images.length) throw "未解析到图片"
            return { images }
        },
    }

    // ============ 设置：立即刷新按钮 ============
    settings = {
        refresh_list: {
            title: "刷新漫画列表",
            type: "callback",
            buttonText: "立即重新拉取全站列表",
            callback: () => {
                this.deleteData("all_slugs")
                return this.allSlugs().then(n => `✅ 已刷新，共 ${n.length} 本`)
            }
        }
    }
}