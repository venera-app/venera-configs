class FourKHD extends ComicSource {
    name = "4KHD"
    key = "fourkhd"
    version = "1.4.3"
    minAppVersion = "1.6.0"
    url = ""
    base = "https://www.4khd.com"

    pageHeaders() {
        return {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9,zh-CN;q=0.8",
            "Referer": this.base + "/",
        }
    }

    // 安全地执行 querySelectorAll，避免 null 崩溃
    safeQueryAll(doc, selector) {
        try {
            var result = doc.querySelectorAll(selector)
            return result || []
        } catch (e) {
            return []
        }
    }

    // 安全地执行 querySelector
    safeQuery(doc, selector) {
        try {
            return doc.querySelector(selector) || null
        } catch (e) {
            return null
        }
    }

    // 提取封面 URL（从 og:image meta）
    extractCover(body) {
        var m = body.match(/<meta property="og:image" content="([^"]+)"/)
        if (m) return m[1]
        m = body.match(/<meta name="twitter:image" content="([^"]+)"/)
        if (m) return m[1]
        return ""
    }

    // 解析列表页
    parseList(body) {
        var d = new HtmlDocument(body)
        var c = []
        var items = this.safeQueryAll(d, "li.wp-block-post")
        for (var i = 0; i < items.length; i++) {
            var el = items[i]
            var img = this.safeQuery(el, ".wp-block-post-featured-image img")
            var cover = ""
            if (img) {
                cover = img.attributes["src"] || img.attributes["data-src"] || ""
            }
            var a = this.safeQuery(el, ".wp-block-post-title a")
            if (!a) continue
            var href = a.attributes["href"] || ""
            var t = (a.text || "").trim()
            if (href && t) {
                // 保留完整路径作为 id，例如: content/14/artgravia-vol728-yeha.html
                var path = href.replace("https://www.4khd.com/", "")
                c.push({id: path, title: t, cover: cover})
            }
        }

        // 获取最大页码
        var mp = 1
        // 方式1: 标准 WordPress 块分页
        var nums = this.safeQueryAll(d, ".wp-block-query-pagination-numbers .page-numbers")
        for (var i = 0; i < nums.length; i++) {
            var txt = (nums[i].text || "").trim().replace(/,/g, "")
            var n = parseInt(txt)
            if (!isNaN(n) && n > mp) mp = n
        }
        // 方式2: 如果没找到，尝试直接找 .page-numbers
        if (mp === 1) {
            var allNums = this.safeQueryAll(d, ".page-numbers")
            for (var i = 0; i < allNums.length; i++) {
                var txt = (allNums[i].text || "").trim().replace(/,/g, "")
                var n = parseInt(txt)
                if (!isNaN(n) && n > mp) mp = n
            }
        }
        d.dispose()
        return {comics: c, maxPage: mp}
    }

    // ============ 搜索（箭头函数确保 this 指向类实例） ============
    search = {
        load: (k, o, p) => {
            var url = "https://www.4khd.com/search/" + encodeURIComponent(k) + "/"
            if (p > 1) url = "https://www.4khd.com/search/" + encodeURIComponent(k) + "/page/" + p + "/"
            return Network.get(url, {}).then((r) => {
                if (r.status !== 200) throw "err"
                return this.parseList(r.body)
            }).catch(() => {
                return {comics: [], maxPage: 1}
            })
        },
        optionList: []
    }

    // ============ 大厅（箭头函数） ============
    explore = [
        {
            title: "4KHD",
            type: "multiPageComicList",
            load: (p) => {
                var url = "https://www.4khd.com/pages/popular/"
                if (p > 1) url = "https://www.4khd.com/pages/popular/?query-3-page=" + p
                return Network.get(url, {}).then((r) => {
                    if (r.status !== 200) throw "err"
                    return this.parseList(r.body)
                }).catch(() => {
                    return {comics: [], maxPage: p}
                })
            }
        }
    ]

    // ============ 分类（箭头函数） ============
    category = {
        title: "4KHD",
        parts: [
            {
                name: "分类",
                type: "fixed",
                itemType: "category",
                categories: ["Popular", "Cosplay", "Album"],
                categoryParams: ["popular", "cosplay", "album"],
            }
        ],
        enableRankingPage: false,
    }

    categoryComics = {
        load: (cat, param, options, p) => {
            var url = "https://www.4khd.com/pages/" + param + "/"
            if (p > 1) url = "https://www.4khd.com/pages/" + param + "/?query-3-page=" + p
            return Network.get(url, {}).then((r) => {
                if (r.status !== 200) throw "err"
                return this.parseList(r.body)
            }).catch(() => {
                return {comics: [], maxPage: p}
            })
        }
    }

    // ============ 详情 / 图片（箭头函数） ============
    comic = {
        loadInfo: (id) => {
            var url = "https://www.4khd.com/" + id
            return Network.get(url, this.pageHeaders()).then((r) => {
                if (r.status !== 200) throw "err"
                var d = new HtmlDocument(r.body)
                var t = this.safeQuery(d, ".wp-block-post-title")
                var tt = t ? (t.text || "").trim() : id
                // 封面从 og:image 取
                var cover = this.extractCover(r.body)
                // 只有一个章节
                d.dispose()
                return {id: id, title: tt, cover: cover, tags: {}, chapters: {"0": "View All Photos"}}
            })
        },

        loadEp: (id, e) => {
            // 递归获取所有分页图片
            var allImgs = []
            var seen = {}
            var pageNum = 1
            var baseUrl = "https://www.4khd.com/" + id
            var self = this

            function fetchPage() {
                var url = pageNum === 1 ? baseUrl : baseUrl.replace(".html", ".html/" + pageNum)
                return Network.get(url, self.pageHeaders()).then((r) => {
                    if (r.status !== 200) return {images: allImgs}
                    // 用 HtmlDocument 解析，只从 .entry-content 区域提取图片
                    var d = new HtmlDocument(r.body)
                    var content = self.safeQuery(d, ".entry-content")
                    var html = ""
                    if (content) {
                        html = content.innerHTML
                    } else {
                        // 降级：截取到 "Read More" 之前（推荐区域之前）
                        html = r.body
                        var rmPos = html.indexOf("Read More")
                        if (rmPos > 0) html = html.substring(0, rmPos)
                    }
                    d.dispose()
                    var pageImgs = []
                    // 正则提取所有 pic.4khd.com 的图片
                    var re = /<img[^>]+src=["']([^"']*pic\.4khd[^"']*)["']/g
                    var m
                    while ((m = re.exec(html)) !== null) {
                        var s = m[1]
                        if (s && !seen[s]) {
                            seen[s] = true
                            pageImgs.push(s)
                            allImgs.push(s)
                        }
                    }
                    // 检查是否有下一页
                    var hasNext = r.body.indexOf('rel="next"') >= 0
                    if (hasNext && pageNum < 50) {
                        pageNum++
                        return fetchPage()
                    }
                    return {images: allImgs}
                })
            }

            return fetchPage().then(function(result) {
                if (!result.images || !result.images.length) throw "no images"
                return result
            })
        }
    }

    settings = {}
}