class MangaForFree extends ComicSource {

    name = "MangaForFree"
    key = "mangaforfree"
    version = "0.7.4"
    minAppVersion = "1.6.0"
    url = "https://cdn.jsdelivr.net/gh/venera-app/venera-configs@main/mangaforfree.js"

    base = "https://mangaforfree.net"
    ajaxUrl = "https://mangaforfree.net/wp-admin/admin-ajax.php"
    logo = "https://mangaforfree.net/wp-content/uploads/2023/02/LOGO-Mangaforfree-Net-2.jpg"

    // 章节图缓存有效期：站点换图床后能自动跟上，又不至于每次重读都联网
    EP_CACHE_TTL = 6 * 3600 * 1000
    // 图片请求全局最小间隔（毫秒）：下载整章时压并发，降 CF 风控
    IMG_INTERVAL = 120

    // 图片节流队列（实例级，串行放行）
    imgQueue = Promise.resolve()
    imgLastAt = 0

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

    imgHeaders(referer) {
        return {
            "User-Agent": this.pageHeaders()["User-Agent"],
            "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
            "Referer": referer || this.base + "/",
        }
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms))
    }

    // ============ URL 规整（下载稳定性的地基） ============

    // 强制绝对化：//x → https://x，/x → base + x，其它相对串 → base + "/" + x
    // 绝不把相对路径透传给 Dio（那就是 relative URL without a base 的直接来源）
    normalizeUrl(u) {
        if (!u) return ""
        u = String(u).trim().replace(/&amp;/g, "&")
        if (!u) return ""
        if (u.startsWith("//")) return "https:" + u
        if (/^https?:\/\//i.test(u)) return u
        if (u.startsWith("/")) return this.base + u
        if (/^(data|blob|javascript):/i.test(u)) return ""
        return this.base + "/" + u.replace(/^\.?\//, "")
    }

    // 【解析阶段】图片专用：拿不到合法绝对地址就返回 null，调用方据此丢弃，
    // 避免空串进下载队列。用于从 HTML 里解析出来的 URL（可能有相对路径，补 base 是对的）。
    absImageUrl(u) {
        let s = this.normalizeUrl(u)
        if (!s) return null
        if (!/^https?:\/\//i.test(s)) return null
        return s
    }

    // 【钩子阶段】安全改写：绝不猜相对路径去拼 base
    //
    // ⚠️⚠️ onImageLoad / onThumbnailLoad 收到的 url 不一定是网络地址 ——
    // 本地下载的漫画会把 `cover.webp`（相对路径）或 `file:///data/...`（本地绝对路径）
    // 送进来。app 里有一段专门靠前缀识别本地封面的逻辑：
    //
    //   if (((configs['url'] as String?) ?? url).startsWith('cover.') && sourceKey != null) {
    //       var comicInfo = await comicSource.loadComicInfo!(cid!);
    //       yield* loadThumbnail(comicInfo.data.cover, sourceKey);   // 回源取网络封面
    //       return;
    //   }
    //
    // 一旦这里把 `cover.webp` 补成 `https://{站名}/cover.webp`，前缀判定当场失效，
    // app 不再回源，而是老实去请求那个 404 ——
    // 症状：「下载好的漫画进详情页封面不加载，但正文图能看、目录也正常」。
    //
    // 所以本函数【只做 trim + 协议补齐】，拿不到 http(s) 就返回 ""，由调用方原样透传。
    // 这个坑在 jjcos v1.2.1 已经踩过一次，别再犯。
    tryAbs(u) {
        if (!u) return ""
        let s = String(u).trim().replace(/&amp;/g, "&")
        if (!s) return ""
        if (s.startsWith("//")) return "https:" + s
        if (/^https?:\/\//i.test(s)) return s
        return ""     // 本地路径 / 其它协议 —— 一个字都不许改
    }

    // 去掉 WordPress 缩略图尺寸段：xxx-193x278.jpg → xxx.jpg（下载要原图）
    // 注意第二段可能是 0（如 -600x0 表示等比缩放），所以用 \d{1,4} 而非 \d{2,4}
    stripThumbSize(u) {
        if (!u) return u
        return String(u).replace(/-\d{1,4}x\d{1,4}(\.(jpe?g|png|webp|gif|avif))$/i, "$1")
    }

    // 取图片地址：兼容各类懒加载属性（Madara 站常用 data-src / data-lazy-src）
    imgAttr(img) {
        let a = img?.attributes || {}
        return a["data-src"] || a["data-lazy-src"] || a["data-original"] || a["data-url"] || a["src"] || ""
    }

    // 垃圾图判定：logo/头像/广告/图标/占位图，下载时一律剔除
    isJunkImage(u) {
        if (!u) return true
        let s = String(u).toLowerCase()
        if (!/^https?:\/\//i.test(s)) return true
        if (/\.(svg|ico)(\?|$)/i.test(s)) return true
        if (/\/(logo|avatar|gravatar|banner|placeholder|loading|spinner|ads?|adsense)[-_.\/]/i.test(s)) return true
        if (/wp-content\/(themes|plugins)\//i.test(s)) return true
        if (/(1x1|blank|transparent|spacer)\.(gif|png)/i.test(s)) return true
        return false
    }

    slugFromUrl(url) {
        return String(url || "").replace(/\/+$/, "").split("/").pop()
    }

    // 文件名清洗 —— 下载到本地的关键防线
    //
    // Windows 文件名禁止：< > : " / \ | ? * 以及 0x00-0x1F 控制字符，
    // 且不允许以空格或点结尾。章节名/漫画名里出现这些字符时，下载会在建目录/
    // 建文件那一步直接炸：
    //   FileSystemException: Exists failed, path = '...'
    //   名或卷标语法不正 (ERROR_INVALID_NAME)
    //
    // 处理策略：非法字符换成**全角等价字符**（保留可读性，不做粗暴删除），
    // 干掉控制字符与换行，折叠空白，去掉结尾的点/空格，并限制长度。
    sanitizeName(s, maxLen = 150) {
        if (s === null || s === undefined) return ""
        const FULLWIDTH = {
            "<": "＜", ">": "＞", ":": "：", '"': "”",
            "/": "／", "\\": "＼", "|": "｜", "?": "？", "*": "＊",
        }
        let t = String(s)
            .replace(/[\x00-\x1f\x7f]/g, "")            // 控制字符 / 换行 / 制表符
            .replace(/[<>:"/\\|?*]/g, c => FULLWIDTH[c]) // Windows 非法字符 → 全角
            .replace(/[\u2028\u2029]/g, "")              // 行分隔符
            .replace(/\s+/g, " ")                        // 折叠空白
            .trim()
            .replace(/[.\s]+$/, "")                      // 结尾的点/空格 Windows 不收
        if (t.length > maxLen) t = t.slice(0, maxLen).trim().replace(/[.\s]+$/, "")
        return t
    }

    // 章节名清洗：下载时章节名就是文件名，必须过一遍
    sanitizeChapterName(name, fallback) {
        return this.sanitizeName(name, 150) || this.sanitizeName(fallback, 150) || "chapter"
    }

    prettyTitle(slug) {
        let t = String(slug).replace(/[-_]/g, " ").replace(/\b\w/g, c => c.toUpperCase())
        return t || slug
    }

    dedupe(comics) {
        let seen = new Set()
        return comics.filter(c => {
            if (!c || !c.id || seen.has(c.id)) return false
            seen.add(c.id)
            return true
        })
    }

    // 封面解析：多路兜底，任何路径都不返回空串
    //
    // ⚠️ 两个必须守住的点（都是踩过的坑）：
    //   1. 【不要】对封面做 stripThumbSize。站点给的 `-193x278.jpg` 是 WP 派生缩略图，
    //      而"原图"在启用图片优化插件（Imagify/ShortPixel 之类）的站上可能已被删除 →
    //      去尺寸段反而 404 → 封面不显示。封面在 UI 上就是小图，没有拿原图的必要。
    //   2. 【不要】让 og:image 排第一。Yoast 有时把 og:image 覆盖成站点默认图/logo，
    //      导致封面"异常"。`.summary_image img` 才是主题直接渲染的真封面，优先它。
    pickCover(doc, html) {
        let cands = []

        // 1. 主题封面区（Madara 标准结构，最可靠）—— 含各类懒加载属性
        let coverEl = doc.querySelector(".summary_image img")
        if (coverEl) {
            ;["data-src", "data-lazy-src", "data-original", "src"].forEach(k => {
                let v = coverEl.attributes?.[k]
                if (v) cands.push(v)
            })
        }

        // 2. og:image / twitter:image（备选，下面会过滤掉站点默认图/logo）
        ;["meta[property='og:image']", "meta[name='og:image']", "meta[name='twitter:image']", "meta[property='twitter:image']"].forEach(sel => {
            let v = doc.querySelector(sel)?.attributes?.["content"]
            if (v) cands.push(v)
        })

        // 3. 正文首图（简介里常带一张）
        let bodyImg = doc.querySelector(".summary__content img, .manga-excerpt img, .description-summary img")
        if (bodyImg) {
            ;["data-src", "data-lazy-src", "src"].forEach(k => {
                let v = bodyImg.attributes?.[k]
                if (v) cands.push(v)
            })
        }

        // 4. msapplication-TileImage / apple-touch-icon
        ;["meta[name='msapplication-TileImage']", "link[rel='apple-touch-icon']"].forEach(sel => {
            let el = doc.querySelector(sel)
            let v = el?.attributes?.["content"] || el?.attributes?.["href"]
            if (v) cands.push(v)
        })

        // 5. 从原始 HTML 里正则兜底抓 og:image（HtmlDocument 解析失败时救命）
        if (html) {
            let m = String(html).match(/<meta[^>]+(?:property|name)=["'](?:og:image|twitter:image)["'][^>]+content=["']([^"']+)["']/i)
            if (m) cands.push(m[1])
        }

        for (let c of cands) {
            // 保留站点原始 URL（不去尺寸段），只做绝对化
            let u = this.absImageUrl(c)
            if (!u) continue
            // 站点默认图/logo 不算封面 —— 宁可往下走找真封面，也别显示一个假封面
            if (u === this.logo || /logo/i.test(u)) continue
            if (this.isJunkImage(u)) continue
            return u
        }
        // 6. 终极兜底：站点 logo。宁可显示 logo，也绝不让 cover 变成空串炸掉下载
        return this.logo
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

    // 带指数退避的重试：被 Cloudflare 拦下时等一等再试，避免把风控越打越死
    async fetchBodyRetry(label, url, headers, tries = 3) {
        for (let i = 1; i <= tries; i++) {
            try {
                return await this.fetchBody(label, url, headers)
            } catch (e) {
                if (i === tries) throw e
                await this.sleep(1200 * i)
            }
        }
    }

    // 拉整页（保留 headers 供解析 manga id），带退避重试
    async fetchPage(label, url, tries = 3) {
        for (let i = 1; i <= tries; i++) {
            try {
                let res = await Network.get(url, this.pageHeaders())
                if (res.status === 200) return res
                throw `Invalid status code: ${res.status}`
            } catch (e) {
                if (i === tries) throw e
                await this.sleep(1500 * i)
            }
        }
    }

    // ============ 图片节流闸门（下载防风控的核心） ============
    // 串行放行：所有图片请求按 IMG_INTERVAL 排队，把 app 的并发洪峰压成涓流
    throttleImage() {
        let prev = this.imgQueue
        let run = prev.then(async () => {
            let wait = this.imgLastAt + this.IMG_INTERVAL - Date.now()
            if (wait > 0) await this.sleep(wait)
            this.imgLastAt = Date.now()
        })
        // 队列本身吞掉异常，避免一次失败卡死后续所有图片
        this.imgQueue = run.then(() => { }, () => { })
        return run
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

        let body = await this.fetchBodyRetry("sitemap", `${this.base}/wp-sitemap-posts-wp-manga-1.xml`)
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
    // 返回 0=已缓存未联网, 1=联网成功, 2=联网失败(疑似被 Cloudflare 拦)
    async fillCover(c) {
        let cachedCover = this.loadData("cov_" + c.id)
        let cachedTitle = this.loadData("tle_" + c.id)
        if (cachedCover) c.cover = cachedCover
        if (cachedTitle) c.title = cachedTitle
        if (cachedCover && cachedTitle) return 0
        try {
            let res = await Network.get(`${this.base}/manga/${c.id}/`, this.pageHeaders())
            if (res.status === 200) {
                let doc = new HtmlDocument(res.body)
                let cover = this.pickCover(doc, res.body)
                let tEl = doc.querySelector(".post-title h1")?.text?.trim()
                doc.dispose()
                // pickCover 有 logo 兜底，这里一定拿得到非空值
                if (cover) { c.cover = cover; this.saveData("cov_" + c.id, cover) }
                if (tEl) { c.title = tEl; this.saveData("tle_" + c.id, tEl) }
                return 1
            }
            return 2
        } catch (e) {
            return 2
        }
    }

    // 串行补封面，按结果自适应节流，避免请求洪峰触发 Cloudflare 风控
    async enrichCovers(comics, max = 24) {
        let list = comics.slice(0, max)
        for (let c of list) {
            let status = await this.fillCover(c)
            if (status === 0) await this.sleep(60)        // 缓存命中，轻间隔
            else if (status === 1) await this.sleep(600)  // 联网成功，正常节流
            else await this.sleep(1500)                   // 疑似被拦，多等一会儿让风控冷静
        }
        // 兜底：任何漏网的空封面补 logo，保证下游（含下载）永远拿到合法绝对 URL
        list.forEach(c => { if (!c.cover) c.cover = this.logo })
    }

    // 类型/最新 RSS（大厅用）
    async genreRss(param, page) {
        let url = param === "latest" ? `${this.base}/manga/feed/` : `${this.base}/manga-genre/${param}/feed/`
        url += `?posts_per_rss=30&paged=${page}`
        return this.parseRss(await this.fetchBodyRetry(`${param} p${page}`, url))
    }

    // HTML 漫画条目解析（搜索用）
    parseSearchHtml(body) {
        let doc = new HtmlDocument(body)
        let comics = []
        doc.querySelectorAll(".c-tabs-item__content, .page-item-detail").forEach(el => {
            let thumb = el.querySelector(".tab-thumb img, .item-thumb img, img")
            // 保留站点原始 URL，不做 stripThumbSize（去尺寸段可能 404）
            let cover = this.absImageUrl(this.imgAttr(thumb)) || ""
            let linkEl = el.querySelector(".tab-summary .post-title h3 a, .item-summary h3 a, h3 a, a")
            let link = linkEl?.attributes["href"] || ""
            let title = linkEl?.text?.trim() || ""
            if (link && title) comics.push({ id: this.slugFromUrl(link), title, subTitle: null, cover })
        })
        doc.dispose()
        return comics
    }

    // ============ 大厅：LATEST + "更多"入口（跳到 ALL） ============
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

    // ============ 分类：ALL（sitemap 驱动，每页12本，节流加载） ============
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
                let perPage = 12
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
                    comics = comics.concat(this.parseSearchHtml(await this.fetchBodyRetry("search", url, this.pageHeaders(), 2)))
                }
                comics = this.dedupe(comics)
                if (comics.length) return { comics, maxPage: page + 1 }
            } catch (e) { }

            try {
                let comics = this.parseRss(await this.fetchBodyRetry("search-rss", `${this.base}/search/${kw}/feed/rss2/`, this.pageHeaders(), 2))
                await this.enrichCovers(comics, 10)
                if (comics.length) return { comics, maxPage: 1 }
            } catch (e) { }

            try {
                let comics = []
                for (let p = 1; p <= 2; p++) {
                    comics = comics.concat(this.parseRss(await this.fetchBodyRetry(
                        "search-rss2",
                        `${this.base}/?s=${kw}&post_type=wp-manga&feed=rss2&posts_per_rss=50&paged=${p}`,
                        this.pageHeaders(),
                        2
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
        // 官方扩展同款：英文站排除 Raw 章节
        // ⚠️ 站点把最新章排在列表最上面（chapter-100 → chapter-1），先收进数组、
        // 再反转插入 Map，让阅读顺序（旧 → 新）与阅读器的「下一章 / 上一章」
        // 方向对齐 —— 否则读第 78 話按「下一章」会跑到第 77 話。
        let pairs = []
        doc.querySelectorAll("ul.main.version-chap li.wp-manga-chapter > a").forEach(a => {
            let href = a.attributes["href"]
            let name = a.text.trim()
            if (!href || !name || seen.has(href)) return
            seen.add(href)
            let epId = this.slugFromUrl(href)
            // 章节名会成为下载文件名，必须清洗掉 Windows 非法字符（否则 FileSystemException）
            pairs.push([epId, this.sanitizeChapterName(name, epId)])
        })
        for (let i = pairs.length - 1; i >= 0; i--) chapters.set(pairs[i][0], pairs[i][1])
        doc.dispose()
        return chapters
    }

    // 章节图解析
    //
    // 语义对齐 Tachiyomi 官方扩展：图集块(li.blocks-gallery-item) 与普通正文图
    // (.reading-content .text-left:not(:has(.blocks-gallery-item)) img) 取【并集】，
    // 逗号分隔的选择器由 csslib 按 DOM 顺序返回，天然保持阅读顺序。
    //
    // 推荐位必须靠 DOM 容器区分 —— 它跟正文图常在同一 uploads 目录下，URL 上分不出来，
    // 所以先扫一遍推荐容器把里面的图做成黑名单，再从候选里剔除。
    extractChapterImages(doc) {
        // 1. 推荐位容器 → 黑名单
        let blocked = new Set()
        const BLOCK_SELECTORS = [
            ".related", ".manga-related", ".wp-manga-related", ".recommend",
            ".recommendations", "#jp-relatedposts", ".c-tabs-item__content",
            ".page-item-detail", ".manga-extra", ".sidebar", ".wp-manga-tabs",
        ]
        BLOCK_SELECTORS.forEach(sel => {
            try {
                doc.querySelectorAll(sel + " img").forEach(img => {
                    let u = this.absImageUrl(this.imgAttr(img))
                    if (u) blocked.add(u)
                })
            } catch (e) { }
        })

        let pickOne = (sel) => {
            let out = []
            try {
                doc.querySelectorAll(sel).forEach(img => {
                    let u = this.absImageUrl(this.imgAttr(img))
                    if (u) out.push(u)
                })
            } catch (e) { }
            return out
        }

        // 2. 首选：官方扩展同款并集选择器（DOM 顺序）
        let raw = pickOne(
            "li.blocks-gallery-item img, " +
            ".reading-content .text-left:not(:has(.blocks-gallery-item)) img, " +
            ".reading-content img, #readerarea img"
        )

        // 3. 兜底：`:has()` 不被支持或站点改版时，逐个试并合并
        if (!raw.length) {
            ;[
                ".reading-content img", "#readerarea img", "li.blocks-gallery-item img",
                ".entry-content img", ".post-content img", "article img",
            ].forEach(sel => { raw = raw.concat(pickOne(sel)) })
        }

        // 4. 去重 + 剔黑名单 + 剔垃圾图
        let out = [], seen = new Set()
        raw.forEach(u => {
            if (!u || seen.has(u) || blocked.has(u) || this.isJunkImage(u)) return
            seen.add(u)
            out.push(u)
        })
        return out
    }

    comic = {
        loadInfo: async (id) => {
            // 30 分钟短缓存：反复进同一本漫画不再发请求，避免反复触发 CF 验证
            let cacheKey = "info_" + id
            let cached = this.loadData(cacheKey)
            if (cached) {
                try {
                    let o = JSON.parse(cached)
                    if (o.t && (Date.now() - o.t) < 30 * 60 * 1000 && o.chapters) {
                        // 老缓存可能存了空封面，读出来时补兜底
                        return new ComicDetails({
                            id, title: o.title, cover: o.cover || this.logo, description: o.description,
                            tags: o.tags, chapters: o.chapters,
                        })
                    }
                } catch (e) { }
            }

            let res = await this.fetchPage(`detail ${id}`, `${this.base}/manga/${id}/`)
            let doc = new HtmlDocument(res.body)
            // 标题会成为下载文件夹名，同样要清洗掉 Windows 非法字符
            let title = this.sanitizeName(doc.querySelector(".post-title h1")?.text?.trim(), 200) || id
            // 六级兜底，绝不空串 —— 空封面是下载炸 relative URL 的头号成因
            let cover = this.pickCover(doc, res.body)
            let desc = doc.querySelector(".summary__content")?.text?.trim()
                || doc.querySelector(".manga-excerpt")?.text?.trim() || ""
            let authors = doc.querySelectorAll(".author-content a").map(a => a.text.trim())
            let tags = doc.querySelectorAll(".genres-content a").map(a => a.text.trim())
            let status = doc.querySelector(".post-status .summary-content")?.text?.trim()
            doc.dispose()

            let mangaId = await this.extractMangaId(res.body, res.headers)
            let chapters = await this.getChaptersByMangaId(mangaId)
            if (!chapters.size) throw "未解析到章节列表"

            let tagsObj = { "作者": authors, "状态": status ? [status] : [], "标签": tags }
            this.saveData(cacheKey, JSON.stringify({
                t: Date.now(), title, cover, description: desc,
                tags: tagsObj, chapters: Object.fromEntries(chapters),
            }))

            return new ComicDetails({
                id, title, cover, description: desc,
                tags: tagsObj, chapters,
            })
        },

        loadEp: async (comicId, epId) => {
            // 章节图 URL 带 6 小时 TTL：站点换图床后能自动跟上，不会永远下载旧 URL 404
            let cacheKey = "ep_" + comicId + "_" + epId
            let cached = this.loadData(cacheKey)
            if (cached) {
                try {
                    let o = JSON.parse(cached)
                    if (Array.isArray(o.images) && o.images.length
                        && o.t && (Date.now() - o.t) < this.EP_CACHE_TTL) {
                        return { images: o.images }
                    }
                } catch (e) { }
            }

            let res = await this.fetchPage(`ep ${comicId}/${epId}`, `${this.base}/manga/${comicId}/${epId}/`)
            let doc = new HtmlDocument(res.body)
            let images = this.extractChapterImages(doc)
            doc.dispose()
            if (!images.length) throw "未解析到图片"
            this.saveData(cacheKey, JSON.stringify({ t: Date.now(), images }))
            this.trackEpKey(cacheKey)
            return { images }
        },

        // 章节图：带 Referer 让 CF 视作同页内嵌加载 + 全局串行节流压并发 + URL 规整兜底
        onImageLoad: async (image, comicId, epId) => {
            let referer = `${this.base}/manga/${comicId}/${epId}/`
            // ⚠️ 用 tryAbs 不是 absImageUrl：本地阅读图可能是 file:// 路径，不能补 base
            let net = this.tryAbs(image)
            await this.throttleImage()
            let cfg = {
                headers: this.imgHeaders(referer),
            }
            // 只在确实是网络地址时才改写 url；本地路径原样透传（详见 tryAbs 注释）
            if (net) cfg.url = net
            // 单张失败降级：换 base Referer 再试一次，不让一张图断掉整章下载
            cfg.onLoadFailed = () => ({
                headers: this.imgHeaders(this.base + "/"),
            })
            return cfg
        },

        // 下载管理页/列表缩略图走这个钩子，带 Referer 让 CF 视作同页内嵌加载。
        //
        // ⚠️ 这个钩子必须【同步】返回 —— 仓库里 _template_.js / goda.js / comick.js /
        // hitomi.js 全是同步写法，只有 onImageLoad 允许 async。写成 async 会返回
        // Promise，app 直接报 `function onThumbnailLoad return invalid data`。
        // 缩略图并发量不大（列表一次十几张），节流交给 onImageLoad 就够。
        onThumbnailLoad: (url) => {
            // ⚠️ 关键：只在 http(s) 时才写 url 字段。
            // `cover.webp` 这类本地封面相对路径必须【原样透传】—— 一旦补成
            // https://{站名}/cover.webp，app 的 `startsWith('cover.')` 判定就失效，
            // 本地漫画的详情页封面会一直加载不出来（详见 tryAbs 注释）。
            let net = this.tryAbs(url)
            let cfg = {
                headers: this.imgHeaders(),
            }
            if (net) {
                cfg.url = net
                // 只对网络地址挂降级：缩略图挂了才退一步试去尺寸段的大图
                let big = this.stripThumbSize(net)
                if (big && big !== net) {
                    cfg.onLoadFailed = () => ({ url: big, headers: this.imgHeaders() })
                }
            }
            return cfg
        },
    }

    // ============ 设置：刷新 + 清缓存 ============
    settings = {
        refresh_list: {
            title: "刷新漫画列表",
            type: "callback",
            buttonText: "立即重新拉取全站列表",
            callback: () => {
                this.deleteData("all_slugs")
                return this.allSlugs().then(n => `✅ 已刷新，共 ${n.length} 本`)
            }
        },
        clear_ep_cache: {
            title: "清空章节图缓存",
            type: "callback",
            buttonText: "清除（下载异常时用）",
            callback: () => {
                let n = this.clearEpCache()
                return `✅ 已清除 ${n} 条章节图缓存，下次阅读将重新解析`
            }
        }
    }

    // 清空所有 ep_ 前缀缓存。Venera 的 loadData 无枚举 API，
    // 用"已登记 key 清单"来精确清理，避免误删封面/详情缓存
    clearEpCache() {
        let list = []
        try {
            list = JSON.parse(this.loadData("ep_keys") || "[]")
        } catch (e) { }
        let n = 0
        list.forEach(k => {
            try { this.deleteData(k); n++ } catch (e) { }
        })
        this.saveData("ep_keys", "[]")
        return n
    }

    // 登记 ep 缓存 key，供"清空章节图缓存"精确清理
    trackEpKey(k) {
        let list = []
        try {
            list = JSON.parse(this.loadData("ep_keys") || "[]")
        } catch (e) { }
        if (!list.includes(k)) {
            list.push(k)
            // 只留最近 500 条，避免无限膨胀
            if (list.length > 500) list = list.slice(-500)
            this.saveData("ep_keys", JSON.stringify(list))
        }
    }
}
