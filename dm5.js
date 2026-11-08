/** @type {import('./_venera_.js')} */
class Dm5Source extends ComicSource {
    name = "动漫屋"
    key = "dm5"
    version = "0.2.0"
    minAppVersion = "1.6.0"
    url = "https://m.dm5.com"

    get baseUrl() { return "https://m.dm5.com" }

    get headers() {
        return {
            "User-Agent": "Mozilla/5.0 (Linux; Android 10; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36",
            "Referer": this.baseUrl + "/"
        }
    }

    abs(u) {
        if (!u) return ""
        u = ("" + u).trim()
        if (u.startsWith("//")) return "https:" + u
        if (u.startsWith("http://") || u.startsWith("https://")) return u
        if (!u.startsWith("/")) u = "/" + u
        return this.baseUrl + u
    }

    text(el) { return el ? (el.text || "").trim().replace(/\s+/g, " ") : "" }
    attr(el, name) { return el && el.attributes ? (el.attributes[name] || "") : "" }

    async getText(url, referer) {
        let headers = Object.assign({}, this.headers)
        if (referer) headers["Referer"] = referer
        let res = await Network.get(url, headers)
        if (res.status !== 200) throw `Request Error: ${res.status} ${url}`
        return res.body || ""
    }

    async getDoc(url, referer) {
        return new HtmlDocument(await this.getText(url, referer))
    }

    parseComicItem(a) {
        let href = this.attr(a, "href")
        if (!href || !/\/manhua-[^/]+\/?$/i.test(href)) return null
        let img = a.querySelector("img")
        let title = this.attr(a, "title") || this.attr(img, "alt") || this.text(a)
        title = title.split(/\s{2,}/)[0].trim()
        let cover = this.attr(img, "data-src") || this.attr(img, "data-original") || this.attr(img, "src")
        let id = this.abs(href)
        if (!title || /排行|更新|历史|更多/.test(title)) return null
        return new Comic({ id, title, cover: this.abs(cover), description: this.baseUrl })
    }

    parseComicList(doc) {
        let list = []
        let seen = {}
        for (let a of doc.querySelectorAll("a")) {
            let c = this.parseComicItem(a)
            if (c && !seen[c.id]) {
                seen[c.id] = true
                list.push(c)
            }
        }
        return list
    }

    parseTitle(html, doc) {
        let m = html.match(/var\s+DM5_COMIC_MNAME\s*=\s*"([^"]+)"/)
        return (m ? m[1] : "") || this.text(doc.querySelector("h1")) || this.text(doc.querySelector(".title"))
    }

    parseChapters(doc) {
        let list = []
        let seen = {}
        for (let a of doc.querySelectorAll("[id^='detail-list-select-'] li a.chapteritem")) {
            let href = this.attr(a, "href")
            if (!href || seen[href]) continue
            let name = this.text(a.querySelector(".detail-list-2-info-title")) || this.text(a)
            if (!name) continue
            seen[href] = true
            list.push([this.abs(href), name])
        }
        const num = (name) => {
            let m = name.match(/第\s*(\d+)\s*[回话話]/)
            return m ? parseInt(m[1], 10) : null
        }
        list.sort((a, b) => {
            let na = num(a[1]), nb = num(b[1])
            if (na === null && nb === null) return 0
            if (na === null) return 1
            if (nb === null) return -1
            return na - nb
        })
        let chapters = {}
        for (let [href, name] of list) chapters[href] = name
        return chapters
    }

    parseImagesFromPacked(html) {
        let m = html.match(/eval\(function\(p,a,c,k,e,d\)[\s\S]*?'\.split\('\|'\),0,\{\}\)\)/i)
        if (!m) return []
        try {
            let unpacked = eval(m[0].replace(/^eval/, ""))
            let images = unpacked.match(/https?:\/\/[^'"]+/g) || []
            return images.filter(u => /\.(jpg|jpeg|png|webp|gif)(\?|$)/i.test(u))
        } catch (e) {
            return []
        }
    }

    explore = [
        {
            title: "动漫屋",
            type: "multiPageComicList",
            load: async (page) => {
                let doc = await this.getDoc(this.baseUrl + "/")
                let comics = this.parseComicList(doc)
                doc.dispose()
                return { comics, maxPage: 1 }
            }
        }
    ]

    search = {
        load: async (keyword, options, page) => {
            let doc = await this.getDoc(`${this.baseUrl}/search?keyword=${encodeURIComponent(keyword)}`)
            let comics = this.parseComicList(doc)
            doc.dispose()
            return { comics, maxPage: 1 }
        },
        optionList: []
    }

    comic = {
        loadInfo: async (id) => {
            let html = await this.getText(id)
            let doc = new HtmlDocument(html)
            let title = this.parseTitle(html, doc)
            let cover = this.attr(doc.querySelector(".detail-main-cover img"), "src") || this.attr(doc.querySelector(".cover img"), "src")
            let desc = this.text(doc.querySelector(".detail-desc"))
            let author = this.text(doc.querySelector(".detail-main-info-author a"))
            let genres = []
            for (let a of doc.querySelectorAll(".detail-main-info-class a")) {
                let name = this.text(a)
                if (name) genres.push(name)
            }
            let tags = {}
            if (author) tags["作者"] = [author]
            if (genres.length) tags["类型"] = genres
            let chapters = this.parseChapters(doc)
            doc.dispose()
            return new ComicDetails({ title, cover: this.abs(cover), description: desc, tags, chapters, url: id })
        },
        loadEp: async (comicId, epId) => {
            let url = epId || comicId
            let html = await this.getText(url, comicId)
            let images = this.parseImagesFromPacked(html)
            if (!images.length) throw `No images parsed: ${url}`
            return { images }
        },
        onImageLoad: (url, comicId, epId) => ({ headers: Object.assign({}, this.headers, { "Referer": epId || comicId || this.baseUrl }) }),
        onThumbnailLoad: (url) => ({ headers: this.headers })
    }

    getHomePage = this.explore
    getComicInfo = this.comic.loadInfo
    getChapters = this.comic.loadInfo
    getImages = this.comic.loadEp
}
