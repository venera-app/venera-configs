/**
 * Hanime1 H漫画 源（独立漫画源）
 * 列表：https://hanimeone.me/comics
 * 详情：https://hanimeone.me/comic/{id}
 * 需要 venera-v ≥ 1.0.0
 *
 * v1.0.0
 */

class Hanime1ComicsSource extends ComicSource {
    name = "Hanime1 H漫画"
    key = "hanime1_comics"
    version = "1.2.1"
    minAppVersion = "1.0.0"
    url = ""

    baseUrl = "https://hanimeone.me"

    headers = {
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "zh-TW,zh;q=0.9,en;q=0.8",
        "Referer": "https://hanimeone.me/",
    }

    attr(el, name) {
        if (!el) return ""
        let a = el.attributes
        if (!a) return ""
        return a[name] || a[name.toLowerCase()] || ""
    }

    text(el) {
        if (!el) return ""
        return (el.text || "").trim()
    }

    absUrl(u) {
        if (!u) return ""
        u = (u + "").trim()
        if (!u || u.indexOf("data:") === 0) return ""
        if (u.indexOf("//") === 0) return "https:" + u
        if (u.indexOf("http://") === 0 || u.indexOf("https://") === 0) return u
        if (u.charAt(0) === "/") return this.baseUrl + u
        return ""
    }

    async getHtml(url) {
        let res = await Network.get(url, this.headers)
        if (res.status !== 200) {
            throw "请求失败: " + res.status
        }
        return new HtmlDocument(res.body)
    }

    parseList(doc) {
        let comics = []
        let items = doc.querySelectorAll(".comic-rows-videos-div")
        if (!items) items = []

        for (let i = 0; i < items.length; i++) {
            let item = items[i]
            let linkEl = item.querySelector("a") || item
            let href = this.attr(linkEl, "href")
            if (!href) continue
            if (href.charAt(0) === "/") href = this.baseUrl + href

            let m = href.match(/\/comic\/(\d+)/)
            if (!m) continue
            let id = m[1]

            let titleEl = item.querySelector(".comic-rows-videos-title")
            let title = this.text(titleEl) || this.attr(item, "title") || this.attr(linkEl, "title")
            if (!title) continue

            // 真实封面在 data-srcset（nhentai CDN），src 多为 placeholder 黑图
            let coverEl = item.querySelector("img")
            let cover = this.attr(coverEl, "data-srcset") ||
                        this.attr(coverEl, "data-src") ||
                        this.attr(coverEl, "srcset") ||
                        this.attr(coverEl, "src")
            if (cover && (cover.indexOf(" ") >= 0 || cover.indexOf(",") >= 0)) {
                cover = cover.split(",")[0].trim().split(" ")[0]
            }
            if (cover && cover.indexOf("placeholder") >= 0) {
                cover = this.attr(coverEl, "data-srcset") || this.attr(coverEl, "data-src") || ""
                if (cover && cover.indexOf(",") >= 0) cover = cover.split(",")[0].trim().split(" ")[0]
            }
            cover = this.absUrl(cover)

            comics.push(new Comic({
                id: id,
                title: title,
                cover: cover || undefined,
            }))
        }
        return comics
    }

    parseMaxPage(doc, page) {
        let maxPage = page
        let links = doc.querySelectorAll("a")
        if (!links) return page + 1
        for (let i = 0; i < links.length; i++) {
            let href = this.attr(links[i], "href")
            if (!href) continue
            let m = href.match(/[?&]page=(\d+)/)
            if (m) {
                let p = parseInt(m[1])
                if (p > maxPage) maxPage = p
            }
        }
        if (maxPage <= page) maxPage = page + 1
        return maxPage
    }

    explore = [
        {
            title: "H漫画",
            type: "multiPageComicList",
            load: async (page) => {
                let url = this.baseUrl + "/comics?page=" + page
                let doc = await this.getHtml(url)
                return {
                    comics: this.parseList(doc),
                    maxPage: this.parseMaxPage(doc, page),
                }
            },
        },
    ]

    category = {
        title: "H漫画",
        parts: [
            {
                name: "H漫画",
                type: "fixed",
                categories: ["最新"],
                categoryParams: ["latest"],
                itemType: "category",
            },
        ],
    }

    categoryComics = {
        load: async (category, param, options, page) => {
            let url = this.baseUrl + "/comics?page=" + page
            let doc = await this.getHtml(url)
            return {
                comics: this.parseList(doc),
                maxPage: this.parseMaxPage(doc, page),
            }
        },
    }

    search = {
        load: async (keyword, options, page) => {
            let url = this.baseUrl + "/comics?s=" + encodeURIComponent(keyword || "") + "&page=" + page
            let doc = await this.getHtml(url)
            return {
                comics: this.parseList(doc),
                maxPage: this.parseMaxPage(doc, page),
            }
        },
        optionList: [],
    }

    comic = {
        loadInfo: async (id) => {
            let url = this.baseUrl + "/comic/" + id
            let doc = await this.getHtml(url)

            let titleEl = doc.querySelector("h3") || doc.querySelector("h1") || doc.querySelector("title")
            let title = this.text(titleEl)
            title = title.replace(/ \| Hanime1.*$/i, "").replace(/ - Hanime1.*$/i, "").trim()
            if (!title) title = "漫画 " + id

            let cover = ""
            let meta = doc.querySelector("meta[property='og:image']")
            cover = this.absUrl(this.attr(meta, "content"))
            if (!cover) {
                let img = doc.querySelector(".comic-rows-videos-div img") || doc.querySelector("img")
                cover = this.absUrl(this.attr(img, "src") || this.attr(img, "data-src"))
            }

            // 信息标签：作者 / 标签 / 角色 / 同人 / 社团
            let tags = {}
            let collect = (path, label) => {
                let list = []
                let seen = {}
                let links = doc.querySelectorAll("a")
                if (!links) return
                for (let i = 0; i < links.length; i++) {
                    let href = this.attr(links[i], "href") || ""
                    if (href.indexOf(path) < 0) continue
                    if (href.indexOf("/comics/") >= 0) continue
                    let t = this.text(links[i]).replace(/\u00a0/g, " ").trim()
                    if (!t) {
                        let d = links[i].querySelector("div")
                        t = this.text(d).replace(/\u00a0/g, " ").trim()
                    }
                    if (!t || seen[t]) continue
                    seen[t] = true
                    list.push(t)
                }
                if (list.length > 0) tags[label] = list
            }
            collect("/artists/", "作者")
            collect("/tags/", "标签")
            collect("/characters/", "角色")
            collect("/parodies/", "同人")
            collect("/groups/", "社团")

            let description = ""
            let bodyText = this.text(doc.querySelector("body")) || ""
            let pm = bodyText.match(/頁數[：:]\s*(\d+)/)
            if (pm) description = "页数：" + pm[1]

            return new ComicDetails({
                title: title,
                cover: cover || undefined,
                description: description,
                tags: tags,
                chapters: {
                    "1": "第1话",
                },
            })
        },

                loadEp: async (comicId, epId) => {
            let url = this.baseUrl + "/comic/" + comicId
            let res = await Network.get(url, this.headers)
            if (res.status !== 200) {
                throw "请求失败: " + res.status
            }
            let html = res.body
            let images = []
            let seen = {}

            // 页面缩略图: https://t2.nhentai.net/galleries/{gid}/{n}t.webp
            // 原图:     https://i2.nhentai.net/galleries/{gid}/{n}.webp
            let re = /https:\/\/t(\d)\.nhentai\.net\/galleries\/(\d+)\/(\d+)t\.(webp|jpg|jpeg|png)/gi
            let m
            let pages = []
            while ((m = re.exec(html)) !== null) {
                let host = m[1]
                let gid = m[2]
                let num = parseInt(m[3])
                let ext = m[4]
                if (seen[num]) continue
                seen[num] = true
                pages.push({
                    num: num,
                    url: "https://i" + host + ".nhentai.net/galleries/" + gid + "/" + num + "." + ext
                })
            }
            pages.sort(function (a, b) { return a.num - b.num })
            for (let i = 0; i < pages.length; i++) {
                images.push(pages[i].url)
            }

            // 兜底：data-srcset 里的图（去掉 cover）
            if (images.length === 0) {
                let re2 = /data-srcset=["'](https:\/\/[^"']+)["']/gi
                while ((m = re2.exec(html)) !== null) {
                    let u = m[1].split(" ")[0]
                    if (u.indexOf("cover") >= 0) continue
                    if (u.indexOf("placeholder") >= 0) continue
                    // 缩略图转原图
                    u = u.replace(/\/\/t(\d)\.nhentai\.net\//, "//i$1.nhentai.net/")
                    u = u.replace(/\/(\d+)t\.(webp|jpg|jpeg|png)/, "/$1.$2")
                    if (seen[u]) continue
                    seen[u] = true
                    images.push(u)
                }
            }

            if (images.length === 0) {
                throw "未解析到漫画图片，站点结构可能已变化"
            }
            return { images: images }
        },

        onClickTag: (namespace, tag) => {
            return {
                action: "search",
                keyword: tag || "",
            }
        },
    }
}
