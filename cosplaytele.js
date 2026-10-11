class CosplayTele extends ComicSource {
    name = "CosplayTele"
    key = "cosplaytele"
    version = "1.6.1"
    minAppVersion = "1.6.0"
    url = ""
    base = "https://cosplaytele.com"

    pageHeaders() {
        return {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
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

    // 解析搜索结果的 HTML
    parseSearchResults(html, totalCount) {
        // 注意：搜索结果 HTML 中的 URL 是转义的，需要处理
        var c = []
        // 匹配每个搜索结果的 item 块
        var itemRe = /<div class='item asl_r_pagepost asl_r_pagepost_\d+ asl_r_post'>([\s\S]*?)<\/div>\s*<div class='clear'><\/div>\s*<\/div>/g
        var itemMatch
        while ((itemMatch = itemRe.exec(html)) !== null) {
            var itemHtml = itemMatch[1]
            // 提取封面图
            var imgRe = /<img[^>]+src=['"]([^'"]+)['"]/
            var imgMatch = imgRe.exec(itemHtml)
            var cover = imgMatch ? imgMatch[1].replace(/\\\//g, "/") : ""
            // 提取标题和链接
            var linkRe = /<a class="asl_res_url" href='([^']+)'>([\s\S]*?)<\/a>/
            var linkMatch = linkRe.exec(itemHtml)
            if (!linkMatch) continue
            var href = linkMatch[1].replace(/\\\//g, "/")
            var title = linkMatch[2].replace(/<[^>]+>/g, "").replace(/&#8211;/g, "-").replace(/&#8220;/g, "\u201c").replace(/&#8221;/g, "\u201d").trim()
            // 提取 slug 作为 id
            var slug = href.replace("https://cosplaytele.com/", "").replace(/\/$/, "")
            if (slug && title) {
                c.push({id: slug, title: title, cover: cover})
            }
        }
        // 如果正则没匹配到，尝试另一种方式
        if (c.length === 0) {
            // 简单方式：找所有 asl_res_url
            var simpleRe = /<a class="asl_res_url" href='([^']+)'>([\s\S]*?)<\/a>/g
            var simpleMatch
            while ((simpleMatch = simpleRe.exec(html)) !== null) {
                var href = simpleMatch[1].replace(/\\\//g, "/")
                var title = simpleMatch[2].replace(/<[^>]+>/g, "").replace(/&#8211;/g, "-").replace(/&#8220;/g, "\u201c").replace(/&#8221;/g, "\u201d").trim()
                var slug = href.replace("https://cosplaytele.com/", "").replace(/\/$/, "")
                if (slug && title) {
                    c.push({id: slug, title: title, cover: ""})
                }
            }
        }
        // 计算最大页数（每页10条）
        var maxPage = Math.ceil(totalCount / 10) || 1
        return {comics: c, maxPage: maxPage}
    }

    // 解析热门文章列表
    parsePopularList(html) {
        var c = []
        // 匹配 wpp-list 中的每个 li
        var itemRe = /<li[^>]*>([\s\S]*?)<\/li>/g
        var itemMatch
        while ((itemMatch = itemRe.exec(html)) !== null) {
            var itemHtml = itemMatch[1]
            // 提取封面图
            var imgRe = /<img[^>]+src=["']([^"']+)["']/
            var imgMatch = imgRe.exec(itemHtml)
            var cover = imgMatch ? imgMatch[1] : ""
            // 提取标题和链接
            var linkRe = /<a[^>]+href=["']([^"']+)["'][^>]*class=["']wpp-post-title["'][^>]*>([\s\S]*?)<\/a>/
            var linkMatch = linkRe.exec(itemHtml)
            if (!linkMatch) {
                // 尝试简单方式
                linkRe = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/g
                var links = []
                while ((linkMatch = linkRe.exec(itemHtml)) !== null) {
                    links.push(linkMatch)
                }
                // 第一个 a 是封面链接，第二个是标题链接
                if (links.length >= 2) {
                    var href = links[1][1]
                    var title = links[1][2].replace(/<[^>]+>/g, "").trim()
                } else if (links.length >= 1) {
                    var href = links[0][1]
                    var title = links[0][2].replace(/<[^>]+>/g, "").trim()
                } else {
                    continue
                }
            } else {
                var href = linkMatch[1]
                var title = linkMatch[2].replace(/<[^>]+>/g, "").trim()
            }
            var slug = href.replace("https://cosplaytele.com/", "").replace(/\/$/, "")
            if (slug && title) {
                c.push({id: slug, title: title, cover: cover})
            }
        }
        return {comics: c, maxPage: 1}
    }

    // ============ 搜索（箭头函数） ============
    search = {
        load: (k, o, p) => {
            var body = "action=ajaxsearchlite_search&aslp=" + encodeURIComponent(k) + "&asid=1&options=customset%5B%5D%3Dpost%26asl_gen%5B%5D%3Dtitle%26qtranslate_lang%3D0%26filters_initial%3D1%26filters_changed%3D0&asl_req_json=1"
            return Network.post("https://cosplaytele.com/wp-admin/admin-ajax.php", {
                "Content-type": "application/x-www-form-urlencoded; charset=UTF-8",
                "Accept": "text/html"
            }, body).then((r) => {
                if (r.status !== 200) throw "err"
                var json = JSON.parse(r.body)
                return this.parseSearchResults(json.html, json.full_results_count || 0)
            }).catch(() => {
                return {comics: [], maxPage: 1}
            })
        },
        optionList: []
    }

    // ============ 解析 Top View 列表 ============
    parseTopList(html) {
        var c = []
        var itemRe = /<li[^>]*>([\s\S]*?)<\/li>/g
        var itemMatch
        while ((itemMatch = itemRe.exec(html)) !== null) {
            var itemHtml = itemMatch[1]
            var imgRe = /<img[^>]+src=["']([^"']+)["']/
            var imgMatch = imgRe.exec(itemHtml)
            var cover = imgMatch ? imgMatch[1] : ""
            var linkRe = /<a[^>]+href=["']([^"']+)["'][^>]*class=["']wpp-post-title["'][^>]*>([\s\S]*?)<\/a>/
            var linkMatch = linkRe.exec(itemHtml)
            if (!linkMatch) {
                linkRe = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/g
                var links = []
                while ((linkMatch = linkRe.exec(itemHtml)) !== null) {
                    links.push(linkMatch)
                }
                if (links.length >= 2) {
                    var href = links[1][1]
                    var title = links[1][2].replace(/<[^>]+>/g, "").trim()
                } else if (links.length >= 1) {
                    var href = links[0][1]
                    var title = links[0][2].replace(/<[^>]+>/g, "").trim()
                } else {
                    continue
                }
            } else {
                var href = linkMatch[1]
                var title = linkMatch[2].replace(/<[^>]+>/g, "").trim()
            }
            var slug = href.replace("https://cosplaytele.com/", "").replace(/\/$/, "")
            if (slug && title) {
                c.push({id: slug, title: title, cover: cover})
            }
        }
        return {comics: c, maxPage: 1}
    }

    // ============ 分类 ============
    category = {
        title: "CosplayTele",
        parts: [
            {
                name: "内容类型",
                type: "fixed",
                itemType: "category",
                categories: ["Cosplay Nude", "Cosplay Ero", "Video Cosplay", "Cosplay", "AI Art", "Only Video"],
                categoryParams: ["cosplay-nude", "cosplay-ero", "video-cosplayy", "cosplay", "ai-art", "only-video"],
            },
            {
                name: "游戏作品",
                type: "fixed",
                itemType: "category",
                categories: ["Genshin Impact", "Azur Lane", "Fate/Grand Order", "Wuthering Waves", "Honkai:Star Rail", "NIKKE", "Zenless Zone Zero", "Blue Archive", "League Of Legends", "Final Fantasy", "Arknights"],
                categoryParams: ["genshin-impact", "azur-lane", "fate-grand-order", "wuthering-waves", "honkai-star-rail", "nikke", "zenless-zone-zero", "blue-archive", "league-of-legends", "final-fantasy", "arknights"],
            },
            {
                name: "动漫作品",
                type: "fixed",
                itemType: "category",
                categories: ["Re:Zero", "NieR:Automata", "Sono Bisque Doll", "Spy x Family", "Dead or Alive", "Chainsaw Man", "Demon Slayer", "Evangelion", "Bocchi The Rock", "Overlord"],
                categoryParams: ["rezero", "nierautomata", "sono-bisque-doll", "spy-x-family", "dead-or-alive", "chainsaw-man", "kimetsu-no-yaiba", "evangelion", "bocchi-the-rock", "overlord"],
            },
            {
                name: "Cosplay Freestyle",
                type: "fixed",
                itemType: "category",
                categories: ["Maid", "School Girl", "ELF", "Nun", "Nurse", "Miko", "Cheongsam", "Hololive", "Devil", "Kimono", "Bunny Girl", "Hatsune Miku"],
                categoryParams: ["maid", "school-girl", "elf", "nun", "nurse", "miko", "cheongsam", "hololive", "devil", "kimono", "bunny-girl", "hatsune-miku"],
            },
            {
                name: "Best Cosplayer",
                type: "fixed",
                itemType: "category",
                categories: ["Machi馬吉", "ChuChu Magic", "Tiny Asa", "水淼Aqua", "铃木美咲", "Byoru", "Umeko J", "咬一口兔娘ovo", "小丁", "Minami", "Rioko", "你的小狗", "DemiFairyTW", "Tokar 浵卡", "阿薰kaOri", "米胡桃MeeHutao", "Bangni邦尼", "Arty Huang", "PoppaChan", "Nekokoyoshi", "Meenfox", "九言", "Hoshilily", "软萌兔兔酱"],
                categoryParams: ["machi", "chuchu-magic", "tiny-asababy", "aqua", "misaki-suzuki", "byoru", "umeko-j", "sticky-bunny", "xiao-ding", "minami", "rioko", "puppyporn090", "demifairytw", "tokar", "axunkaorii", "meehutao69", "bangni", "artyhuang", "poppachan", "nekokoyoshi", "meenfox", "jiu-yan", "hoshilily", "sweetrabbit233"],
            },
            {
                name: "热门时间",
                type: "fixed",
                itemType: "category",
                categories: ["Top 24 Hours", "Top 3 Days", "Top 7 Days"],
                categoryParams: ["top-24h", "top-3d", "top-7d"],
            }
        ],
        enableRankingPage: false,
    }

    categoryComics = {
        load: (cat, param, options, p) => {
            // Top View 分类：使用 WPP API
            if (param.indexOf("top-") === 0) {
                var rangeMap = {"top-24h": "daily", "top-3d": "daily", "top-7d": "weekly"}
                var timeQtyMap = {"top-24h": 24, "top-3d": 72, "top-7d": 168}
                var range = rangeMap[param] || "daily"
                var timeQty = timeQtyMap[param] || 24
                var requestBody = JSON.stringify({
                    title: "", limit: "20", offset: 0, range: range, time_quantity: timeQty, time_unit: "hour",
                    freshness: false, order_by: "views", post_type: "post", pid: "", exclude: "", cat: "",
                    taxonomy: "category", term_id: "", author: "",
                    shorten_title: {active: false, length: 0, words: false},
                    "post-excerpt": {active: false, length: 0, keep_format: false, words: false},
                    thumbnail: {active: true, build: "manual", width: "1920", height: "1080"},
                    rating: false, stats_tag: {comment_count: false, views: "1", author: false, date: {active: false, format: "F j, Y"}, category: false, taxonomy: {active: false, name: "category"}},
                    markup: {custom_html: true, "wpp-start": "<ul class=\"wpp-list\">", "wpp-end": "</ul>", "title-start": "<h2>", "title-end": "</h2>", "post-html": "<li class=\"{current_class}\">{thumb} {title} <span class=\"wpp-meta post-stats\">{stats}</span><p class=\"wpp-excerpt\">{excerpt}</p></li>"},
                    theme: {name: ""}
                })
                return Network.post("https://cosplaytele.com/wp-json/wordpress-popular-posts/v2/widget", {
                    "X-Requested-With": "XMLHttpRequest", "Content-Type": "application/json", "X-WP-Nonce": "848c6cd23e"
                }, requestBody).then((r) => {
                    if (r.status !== 200) throw "err"
                    var json = JSON.parse(r.body)
                    return this.parseTopList(json.widget || "")
                }).catch(() => {
                    return {comics: [], maxPage: 1}
                })
            }
            // 普通分类/标签：使用 WordPress REST API
            var catMap = {
                "cosplay-nude": {id: 193, type: "category"}, "free-style": {id: 400, type: "category"},
                "cosplay-ero": {id: 194, type: "category"}, "game": {id: 398, type: "category"},
                "video-cosplayy": {id: 850, type: "category"}, "anime": {id: 399, type: "category"},
                "cosplay": {id: 363, type: "category"}, "ai-art": {id: 589, type: "category"},
                "only-video": {id: 1124, type: "category"},
                "genshin-impact": {id: 23, type: "category"}, "azur-lane": {id: 43, type: "category"},
                "fate-grand-order": {id: 153, type: "category"},
                "wuthering-waves": {id: 1135, type: "tag"}, "honkai-star-rail": {id: 779, type: "tag"},
                "nikke": {id: 416, type: "tag"}, "zenless-zone-zero": {id: 1112, type: "tag"},
                "blue-archive": {id: 211, type: "tag"}, "league-of-legends": {id: 121, type: "tag"},
                "final-fantasy": {id: 130, type: "tag"}, "arknights": {id: 315, type: "tag"},
                "xiuren": {id: 946, type: "category"}, "pure-media": {id: 955, type: "category"},
                "fantasy-factory": {id: 63, type: "category"},
                "rezero": {id: 197, type: "tag"}, "nierautomata": {id: 133, type: "tag"},
                "sono-bisque-doll": {id: 89, type: "tag"}, "spy-x-family": {id: 126, type: "tag"},
                "dead-or-alive": {id: 237, type: "tag"}, "chainsaw-man": {id: 378, type: "tag"},
                "kimetsu-no-yaiba": {id: 59, type: "tag"}, "evangelion": {id: 260, type: "tag"},
                "bocchi-the-rock": {id: 470, type: "tag"}, "overlord": {id: 305, type: "tag"},
                "maid": {id: 693, type: "tag"}, "school-girl": {id: 739, type: "tag"},
                "elf": {id: 707, type: "tag"}, "nun": {id: 672, type: "tag"},
                "nurse": {id: 700, type: "tag"}, "miko": {id: 230, type: "tag"},
                "cheongsam": {id: 726, type: "tag"}, "hololive": {id: 228, type: "tag"},
                "devil": {id: 710, type: "tag"}, "kimono": {id: 719, type: "tag"},
                "bunny-girl": {id: 742, type: "tag"}, "hatsune-miku": {id: 259, type: "tag"},
                "machi": {id: 1023, type: "category"}, "chuchu-magic": {id: 1171, type: "category"},
                "tiny-asababy": {id: 852, type: "category"}, "misaki-suzuki": {id: 702, type: "category"},
                "minami": {id: 1183, type: "category"},
                "puppyporn090": {id: 1172, type: "category"}, "demifairytw": {id: 1141, type: "category"},
                "tokar": {id: 733, type: "category"}, "axunkaorii": {id: 971, type: "category"},
                "meehutao69": {id: 1179, type: "category"}, "bangni": {id: 1138, type: "category"},
                "poppachan": {id: 347, type: "category"}, "nekokoyoshi": {id: 22, type: "category"},
                "meenfox": {id: 429, type: "category"}, "hoshilily": {id: 41, type: "category"},
                "sweetrabbit233": {id: 803, type: "category"}
            }
            var info = catMap[param] || {id: 193, type: "category"}
            var url = ""
            if (info.type === "tag") {
                url = "https://cosplaytele.com/wp-json/wp/v2/posts?tags=" + info.id + "&page=" + p + "&per_page=20&_embed"
            } else {
                url = "https://cosplaytele.com/wp-json/wp/v2/posts?categories=" + info.id + "&page=" + p + "&per_page=20&_embed"
            }
            return Network.get(url, {}).then((r) => {
                if (r.status !== 200) throw "err"
                var posts = JSON.parse(r.body)
                var c = []
                for (var i = 0; i < posts.length; i++) {
                    var post = posts[i]
                    var slug = post.slug || ""
                    var title = post.title ? post.title.rendered : ""
                    // 去除 HTML 标签
                    title = title.replace(/<[^>]+>/g, "").replace(/&#8211;/g, "-").replace(/&#8220;/g, "\u201c").replace(/&#8221;/g, "\u201d").trim()
                    // 提取封面
                    var cover = ""
                    if (post._embedded && post._embedded["wp:featuredmedia"] && post._embedded["wp:featuredmedia"][0]) {
                        cover = post._embedded["wp:featuredmedia"][0].source_url || ""
                    }
                    if (slug && title) {
                        c.push({id: slug, title: title, cover: cover})
                    }
                }
                // 尝试从响应头获取总页数
                var maxPage = p
                try {
                    // 尝试从响应头获取 X-WP-TotalPages
                    if (r.headers && r.headers["x-wp-totalpages"]) {
                        maxPage = parseInt(r.headers["x-wp-totalpages"]) || 1
                    } else if (r.responseHeaders) {
                        var hdrs = r.responseHeaders
                        var tpMatch = hdrs.match(/x-wp-totalpages:\s*(\d+)/i)
                        if (tpMatch) maxPage = parseInt(tpMatch[1]) || 1
                    }
                } catch (e) {}
                // 如果获取不到，根据返回数量估算
                if (maxPage === p) {
                    if (c.length < 20) {
                        maxPage = p
                    } else {
                        // 无法获取总页数时，给一个足够大的值
                        maxPage = 500
                    }
                }
                return {comics: c, maxPage: maxPage}
            }).catch(() => {
                return {comics: [], maxPage: p}
            })
        }
    }

    // ============ 大厅（最新） ============
    explore = [
        {
            title: "Cosplaytele",
            type: "multiPageComicList",
            load: (p) => {
                var url = "https://cosplaytele.com/wp-json/wp/v2/posts?page=" + p + "&per_page=20&_embed&orderby=date&order=desc"
                return Network.get(url, {}).then((r) => {
                    if (r.status !== 200) throw "err"
                    var posts = JSON.parse(r.body)
                    var c = []
                    for (var i = 0; i < posts.length; i++) {
                        var post = posts[i]
                        var slug = post.slug || ""
                        var title = post.title ? post.title.rendered : ""
                        title = title.replace(/<[^>]+>/g, "").replace(/&#8211;/g, "-").replace(/&#8220;/g, "\u201c").replace(/&#8221;/g, "\u201d").trim()
                        var cover = ""
                        if (post._embedded && post._embedded["wp:featuredmedia"] && post._embedded["wp:featuredmedia"][0]) {
                            cover = post._embedded["wp:featuredmedia"][0].source_url || ""
                        }
                        if (slug && title) {
                            c.push({id: slug, title: title, cover: cover})
                        }
                    }
                    var maxPage = p
                    try {
                        if (r.headers && r.headers["x-wp-totalpages"]) {
                            maxPage = parseInt(r.headers["x-wp-totalpages"]) || 1
                        } else if (r.responseHeaders) {
                            var hdrs = r.responseHeaders
                            var tpMatch = hdrs.match(/x-wp-totalpages:\s*(\d+)/i)
                            if (tpMatch) maxPage = parseInt(tpMatch[1]) || 1
                        }
                    } catch (e) {}
                    if (maxPage === p) {
                        if (c.length < 20) {
                            maxPage = p
                        } else {
                            maxPage = 500
                        }
                    }
                    return {comics: c, maxPage: maxPage}
                }).catch(() => {
                    return {comics: [], maxPage: p}
                })
            }
        }
    ]

    // ============ 详情 / 图片 ============
    comic = {
        loadInfo: (id) => {
            var url = "https://cosplaytele.com/" + id + "/"
            return Network.get(url, this.pageHeaders()).then((r) => {
                if (r.status !== 200) throw "err"
                // 从 og:title 和 og:image 提取
                var title = ""
                var titleM = r.body.match(/<meta property="og:title" content="([^"]+)"/)
                if (titleM) title = titleM[1]
                if (!title) {
                    var h1M = r.body.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)
                    if (h1M) title = h1M[1].replace(/<[^>]+>/g, "").trim()
                }
                var cover = this.extractCover(r.body)
                return {id: id, title: title || id, cover: cover, tags: {}, chapters: {"0": "View All Photos"}}
            })
        },

        loadEp: (id, e) => {
            var url = "https://cosplaytele.com/" + id + "/"
            var self = this
            return Network.get(url, self.pageHeaders()).then((r) => {
                if (r.status !== 200) throw "err"
                var allImgs = []
                var seen = {}
                // 用 HtmlDocument 解析，只从 .entry-content 区域提取图片
                var d = new HtmlDocument(r.body)
                var content = self.safeQuery(d, ".entry-content")
                var html = ""
                if (content) {
                    html = content.innerHTML
                } else {
                    html = r.body
                }
                d.dispose()
                // 截断到 "Recommend For You" 之前，排除推荐图片
                var cutPos = html.indexOf("Recommend For You")
                if (cutPos > 0) html = html.substring(0, cutPos)
                // 提取所有图片 URL
                // 方式1: 提取 <a data-fancybox href="..."> 中的 href
                var re1 = /<a[^>]+data-fancybox[^>]+href=["']([^"']+)["']/g
                var m
                while ((m = re1.exec(html)) !== null) {
                    var s = m[1]
                    if (s && !seen[s] && (s.indexOf(".jpg") > 0 || s.indexOf(".png") > 0 || s.indexOf(".webp") > 0 || s.indexOf(".jpeg") > 0)) {
                        seen[s] = true
                        allImgs.push(s)
                    }
                }
                // 方式2: 提取所有 <img src="..."> 中的 src
                if (allImgs.length === 0) {
                    var re2 = /<img[^>]+src=["']([^"']+)["']/g
                    while ((m = re2.exec(html)) !== null) {
                        var s = m[1]
                        if (s && !seen[s] && (s.indexOf(".jpg") > 0 || s.indexOf(".png") > 0 || s.indexOf(".webp") > 0 || s.indexOf(".jpeg") > 0)) {
                            seen[s] = true
                            allImgs.push(s)
                        }
                    }
                }
                if (!allImgs.length) throw "no images"
                return {images: allImgs}
            })
        }
    }

    settings = {}
}