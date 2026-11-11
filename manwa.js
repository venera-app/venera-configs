/** @type {import('./_venera_.js')} */
class ManWa extends ComicSource {
  name = "漫蛙"

  key = "manwa"

  version = "1.6.5"

  minAppVersion = "1.5.0"

  url = "https://cdn.jsdelivr.net/gh/venera-app/venera-configs@main/manwa.js"

  // 可用线路：前四为大陆区，最后为非大陆区
  static LINES = [
    "manwaue.cc",
    "manwaub.cc",
    "manwaua.cc",
    "manwaud.cc",
    "manwa.me",
  ]

  settings = {
    line: {
      title: "线路",
      type: "select",
      options: [
        { value: "manwaue.cc", text: "线路1 manwaue.cc（大陆）" },
        { value: "manwaub.cc", text: "线路2 manwaub.cc（大陆）" },
        { value: "manwaua.cc", text: "线路3 manwaua.cc（大陆）" },
        { value: "manwaud.cc", text: "线路4 manwaud.cc（大陆）" },
        { value: "manwa.me", text: "线路5 manwa.me（非大陆）" },
      ],
      default: "manwaue.cc",
    },
    imageHost: {
      title: "章节图源",
      type: "select",
      options: [
        { value: "newmwtuyuan27.cc", text: "图源1 newmwtuyuan27.cc（推荐）" },
        { value: "mwfimsvfast40.cc", text: "图源2 mwfimsvfast40.cc" },
        { value: "newmwtuyuan26.cc", text: "图源3 newmwtuyuan26.cc" },
      ],
      default: "newmwtuyuan27.cc",
    },
    welfareAuto: {
      title: "打开发现页自动领福利",
      type: "switch",
      default: true,
    },
    welfareNow: {
      title: "手动领福利",
      type: "callback",
      buttonText: "立即领取",
      callback: async () => {
        try {
          await this.autoWelfare(true)
        } catch (e) {
          try { UI.showMessage("漫蛙福利领取失败：" + e) } catch (x) {}
        }
      },
    },
  }

  _base = null

  get baseUrl() {
    if (this._base) return this._base
    let line = "manwaue.cc"
    try { line = this.loadSetting("line") || "manwaue.cc" } catch (e) {}
    return "https://" + line
  }

  get webHeaders() {
    return {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
      "Sec-Fetch-Dest": "document",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Site": "none",
      "Upgrade-Insecure-Requests": "1",
    }
  }

  // 依次尝试各线路抓取 HTML，任一成功即返回 {base, body}
  async fetchHtml(path) {
    let cur = this.baseUrl
    let order = [cur]
    for (let l of ManWa.LINES) {
      let u = "https://" + l
      if (order.indexOf(u) < 0) order.push(u)
    }
    let lastErr = null
    for (let base of order) {
      try {
        let headers = Object.assign({}, this.webHeaders, { Referer: base + "/" })
        let res = await Network.get(base + path, headers)
        if (!res || res.status !== 200) {
          lastErr = "HTTP " + (res ? res.status : "无响应")
          continue
        }
        let body = res.body || ""
        if (body.length < 300) {
          lastErr = "空页面"
          continue
        }
        this._base = base
        return { base: base, body: body }
      } catch (e) {
        lastErr = String(e && e.message ? e.message : e)
      }
    }
    throw "所有线路均无法访问：" + lastErr
  }

  // 章节图（/static/upload/ 路径）在 mwappimgs.cc 上会超时，需换到可用图床域名
  fixImageUrl(url) {
    if (!url) return url
    if (url.indexOf("/static/upload/") >= 0) {
      let host = "newmwtuyuan27.cc"
      try { host = this.loadSetting("imageHost") || "newmwtuyuan27.cc" } catch (e) {}
      return url.replace(/^https?:\/\/[^\/]+/, "https://" + host)
    }
    return url
  }

  // 从响应头里取某个 cookie 的值（VeneraX 的 Network 不自动存 cookie，需要手动管理）
  extractCookie(headers, name) {
    if (!headers) return ""
    let sc = headers["set-cookie"] || headers["Set-Cookie"] || ""
    let m = sc.match(new RegExp(name + "=([^;,\\s]+)", "i"))
    return m ? m[1] : ""
  }

  // 需要登录的请求手动带上的 Cookie 头（带齐 cookie 库里的所有字段，收藏接口只认完整会话）
  authCookie() {
    try {
      let cookies = Network.getCookies(this.baseUrl)
      if (cookies && cookies.length) {
        let parts = []
        for (let c of cookies) {
          if (c && c.name && c.value) parts.push(c.name + "=" + c.value)
        }
        if (parts.length) return parts.join("; ")
      }
    } catch (e) {}
    // 回退到 login 保存的凭证
    try {
      let s = this.loadData("phpsessid")
      return s ? "PHPSESSID=" + s : ""
    } catch (e) {
      return ""
    }
  }

  // 登录态相关请求必须固定用当前线路（登录 cookie 只存在当前线路的域下），不能多线路切换
  async fetchHtmlOne(path) {
    let base = this.baseUrl
    let headers = Object.assign({}, this.webHeaders, { Referer: base + "/", "cache-time": "no" })
    let ck = this.authCookie()
    if (ck) headers["Cookie"] = ck
    let res = await Network.get(base + path, headers)
    if (!res || res.status !== 200) throw "HTTP " + (res ? res.status : "无响应")
    return { base: base, body: res.body || "" }
  }

  // 表单 POST（用于收藏），返回解析后的 JSON
  async postForm(path, obj) {
    let base = this.baseUrl
    let body = Object.keys(obj)
      .map((k) => encodeURIComponent(k) + "=" + encodeURIComponent(obj[k]))
      .join("&")
    let headers = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
      "Accept": "application/json, text/javascript, */*; q=0.01",
      "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "X-Requested-With": "XMLHttpRequest",
      "Origin": base,
      "Referer": base + "/",
    }
    let ck = this.authCookie()
    if (ck) headers["Cookie"] = ck
    let res = await Network.post(base + path, headers, body)
    if (!res) throw "请求无响应"
    let json
    try { json = JSON.parse(res.body) } catch (e) { throw "响应无法解析: " + res.status }
    return json
  }

  // 带登录 cookie 的 JSON GET（收藏等接口）
  async getJson(path, params) {
    let base = this.baseUrl
    let qs = Object.keys(params || {})
      .map((k) => encodeURIComponent(k) + "=" + encodeURIComponent(params[k]))
      .join("&")
    let url = base + path + (qs ? "?" + qs : "")
    let headers = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
      "Accept": "application/json, text/javascript, */*; q=0.01",
      "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
      "X-Requested-With": "XMLHttpRequest",
      "Referer": base + "/bookshelf",
      "cache-time": "no",
    }
    let ck = this.authCookie()
    if (ck) headers["Cookie"] = ck
    let res = await Network.get(url, headers)
    if (!res || res.status !== 200) return null
    try { return JSON.parse(res.body) } catch (e) { return null }
  }

  // 福利中心自动化：直接调 manwa.me 的接口完成「点击广告任务」并领奖励，不打开广告页
  // 两站共享会话（同一 PHPSESSID 对 manwaue.cc 与 manwa.me 都有效），用当前登录 cookie 即可
  async autoWelfare(showStatus) {
    let ck = this.authCookie()
    if (!ck) {
      if (showStatus) { try { UI.showMessage("漫蛙福利：请先登录账号") } catch (e) {} }
      return "未登录"
    }
    // 在本线路(manwaue.cc)上做福利，不用 manwa.me（会被 Cloudflare 拦）；且必须带全套 cookie（只 PHPSESSID 会被当未登录）
    let base = this.baseUrl
    let h = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
      "Cookie": ck,
      "Referer": base + "/users/welfare",
      "X-Requested-With": "XMLHttpRequest",
      "cache-time": "no",
    }
    let res = await Network.get(base + "/users/welfare", h)
    if (!res || res.status !== 200) {
      if (showStatus) { try { UI.showMessage("漫蛙福利：打开福利页失败（网络或反爬）") } catch (e) {} }
      return "失败"
    }
    let body = res.body || ""
    // 广告任务进度 X/5（数字在 ad-item-content-item-number 元素里）
    let m = body.match(/ad-item-content-item-number[^>]*>\s*(\d+)\s*\/\s*5/)
    let adCount = m ? parseInt(m[1]) : 0
    let claimed = /ad-bonus[^>]*value="已领取"/.test(body)
    let acts = []
    if (adCount < 5) {
      let link = encodeURIComponent("https://s.zlinkc.com/d.php?z=4833772")
      for (let i = adCount; i < 5; i++) {
        try { await Network.get(base + "/ad_click?task=1&group=ad_wawaweise&link=" + link, h) } catch (e) {}
      }
      acts.push("点广告" + (5 - adCount) + "次")
    }
    if (!claimed) {
      try {
        let h2 = Object.assign({}, h, { "Content-Type": "application/x-www-form-urlencoded" })
        await Network.post(base + "/users/welfare", h2, "action=ad_bonus")
        acts.push("领广告奖励")
      } catch (e) {}
    }
    let msg = acts.length ? ("漫蛙福利已完成：" + acts.join("、")) : "漫蛙福利：今日任务已完成"
    if (acts.length || showStatus) {
      try { UI.showMessage(msg) } catch (e) {}
    }
    return msg
  }

  // 从一张 .manga-list-2-cover 卡片解析漫画
  parseCover(e) {
    let a = e.querySelector("a")
    let img = e.querySelector("img")
    if (!a || !a.attributes) return null
    let href = a.attributes["href"] || ""
    let id = href ? href.split("/").pop() : ""
    if (!id) return null
    let title = a.attributes["title"] || ""
    if (!title) {
      try { title = (a.text || "").trim() } catch (err) {}
    }
    // 首页封面是懒加载：真实地址在 data-home-src，src 只是占位图 imagecover_s.png
    let cover = ""
    if (img && img.attributes) {
      cover = img.attributes["data-home-src"] || ""
      if (!cover) {
        let s = img.attributes["src"] || ""
        if (s && s.indexOf("imagecover") < 0) cover = s
      }
      if (!cover) cover = img.attributes["data-src"] || img.attributes["data-original"] || ""
      if (cover && cover.indexOf("imagecover") >= 0) cover = ""
    }
    return { id: id, title: title, cover: cover }
  }

  parseList(body) {
    let doc = new HtmlDocument(body)
    let comics = []
    let seen = {}
    for (let e of doc.querySelectorAll(".manga-list-2-cover")) {
      let c = this.parseCover(e)
      if (c && !seen[c.id]) {
        seen[c.id] = 1
        comics.push(new Comic({ id: c.id, title: c.title, cover: c.cover }))
      }
    }
    return comics
  }

  explore = [
    {
      title: "漫蛙",
      type: "singlePageWithMultiPart",
      load: async () => {
        // 打开发现页时自动完成福利中心任务（可在设置里关闭）
        try { if (this.loadSetting("welfareAuto")) await this.autoWelfare() } catch (e) {}
        let r = await this.fetchHtml("/")
        let body = r.body || ""
        let result = {}
        // 按 .manga-list-2 列表切分，每块前面最近的「XX 更多」标题即分区名（不依赖父容器，较稳）
        let parts = body.split(/<ul class="manga-list-2[^"]*"/)
        for (let i = 1; i < parts.length; i++) {
          let before = parts[i - 1]
          let tm = [...before.matchAll(/<div class="manga-list-title[^"]*">\s*([^<]+?)\s*<a/g)]
          let title = tm.length ? tm[tm.length - 1][1].trim() : ("分区" + i)
          let ulHtml = '<ul class="manga-list-2"' + parts[i].split("</ul>")[0] + "</ul>"
          let doc = new HtmlDocument(ulHtml)
          let comics = []
          for (let card of doc.querySelectorAll(".manga-list-2-cover")) {
            let c = this.parseCover(card)
            if (c) comics.push(new Comic({ id: c.id, title: c.title, cover: c.cover }))
          }
          doc.dispose()
          if (comics.length) result[title] = comics
        }
        if (Object.keys(result).length === 0) {
          return { "首页推荐": this.parseList(body) }
        }
        return result
      },
    },
  ]

  search = {
    load: async (keyword, options, page) => {
      let p = page && page > 0 ? page : 1
      let r = await this.fetchHtml(`/search?keyword=${encodeURIComponent(keyword)}&page=${p}`)
      let comics = this.parseList(r.body)
      let maxPage = null
      if (comics.length > 0 && r.body.indexOf("下一页") >= 0) maxPage = p + 1
      return { comics: comics, maxPage: maxPage }
    },
    optionList: [],
  }

  category = {
    title: "漫蛙",
    parts: [
      {
        name: "分类",
        type: "fixed",
        categories: ["全部", "一般向", "BL向", "禁漫", "TL向", "GL向"],
        categoryParams: ["-1", "2", "0", "1", "3", "4"],
        itemType: "category",
      },
    ],
    enableRankingPage: false,
  }

  categoryComics = {
    load: async (category, param, options, page) => {
      let p = page && page > 0 ? page : 1
      let r = await this.fetchHtml(`/booklist/?page=${p}&gender=${encodeURIComponent(param)}`)
      let comics = this.parseList(r.body)
      let maxPage = null
      if (comics.length > 0 && r.body.indexOf("下一页") >= 0) maxPage = p + 1
      return { comics: comics, maxPage: maxPage }
    },
    optionList: [],
  }

  // 登录：站点登录带图片验证码，无法纯程序化完成；用内置浏览器让用户手动登录，cookie 自动保存
  init() {
    try {
      if (this.account && this.account.loginWithWebview) {
        this.account.loginWithWebview.url = this.baseUrl + "/login.html"
      }
    } catch (e) {}
  }

  account = {
    // 站点登录需要图片验证码：先取验证码图片二进制，弹窗让用户看图输入，再提交登录
    login: async (account, pwd) => {
      let base = this.baseUrl
      // 取验证码图片（VeneraX 的 Network 不自动存 cookie，需从响应头手动取 PHPSESSID）
      let cap = await Network.fetchBytes("GET", base + "/captcha?rnd=" + randomInt(0, 999999), this.webHeaders)
      if (!cap || cap.status !== 200 || !cap.body) throw "获取验证码失败"
      let sessid = this.extractCookie(cap.headers, "PHPSESSID")
      // 让用户看图输入验证码
      let code = await UI.showInputDialog("请输入验证码", null, cap.body)
      if (code === null || code === undefined || String(code).length === 0) throw "已取消登录"
      let headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
        "Accept": "application/json, text/javascript, */*; q=0.01",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "X-Requested-With": "XMLHttpRequest",
        "Origin": base,
        "Referer": base + "/login.html",
      }
      if (sessid) headers["Cookie"] = "PHPSESSID=" + sessid
      let body = "username=" + encodeURIComponent(account) + "&password=" + encodeURIComponent(pwd) + "&captcha=" + encodeURIComponent(code)
      let res = await Network.post(base + "/login", headers, body)
      let json
      try { json = JSON.parse(res.body) } catch (e) { throw "登录响应异常: HTTP " + res.status }
      if (json.err !== 0) throw json.msg || "登录失败"
      // 登录成功后服务端可能下发新的 PHPSESSID，取最新的保存
      let newSess = this.extractCookie(res.headers, "PHPSESSID")
      if (newSess) sessid = newSess
      this.saveData("phpsessid", sessid)
      return "ok"
    },
    loginWithWebview: {
      url: "https://manwaue.cc/login.html",
      checkStatus: (url, title) => {
        return (url || "").indexOf("/ucenter") >= 0
      },
      onLoginSuccess: async () => {},
    },
    logout: () => {
      try { this.deleteData("phpsessid") } catch (e) {}
      Network.deleteCookies("https://manwaue.cc")
    },
    registerWebsite: null,
  }

  // 收藏：POST /addfavor  data: book_id, val, folder_id
  // val 传当前状态：0=未收藏（服务端执行收藏）、1=已收藏（服务端执行取消）
  favorites = {
    multiFolder: true,
    singleFolderForSingleComic: false,
    addOrDelFavorite: async (comicId, folderId, isAdding) => {
      let val = isAdding ? 0 : 1
      // folderId 为具体收藏夹 id（纯数字且非 0）才用，否则收藏到默认 0
      let fid = "0"
      if (folderId !== null && folderId !== undefined && /^\d+$/.test(String(folderId)) && String(folderId) !== "0") {
        fid = String(folderId)
      }
      let json = await this.postForm("/addfavor", { book_id: comicId, val: val, folder_id: fid })
      if (json && json.err == 1) throw "Login expired"
      return "ok"
    },
    loadFolders: async (comicId) => {
      // 返回 { folders: {id: name}, favorited }；"0"=全部收藏，"-3"=未分类，其余为账户自定义收藏夹
      let folders = { "0": "全部收藏", "-3": "未分类" }
      try {
        let r = await this.fetchHtmlOne("/bookshelf")
        let m = r.body.match(/folder_list:\s*JSON\.parse\('([^']+)'\)/)
        if (m) {
          let arr = JSON.parse(m[1])
          for (let f of arr) {
            if (f && f.id !== undefined && f.id !== null) {
              folders[String(f.id)] = f.title || ("收藏夹" + f.id)
            }
          }
        }
      } catch (e) {}
      return { folders: folders, favorited: [] }
    },
    loadComics: async (page, folder) => {
      let p = page && page > 0 ? page : 1
      let fid = folder === null || folder === undefined || String(folder) === "" ? "0" : String(folder)
      let json = await this.getJson("/getfavors", {
        page: p,
        showOnlyUpdated: -1,
        isEnd: -1,
        isFullVersion: -1,
        order: 0,
        order_type: 0,
        folder_id: fid,
      })
      if (!json || json.err !== 0) return { comics: [], maxPage: null }
      let books = json.books || []
      let comics = []
      for (let b of books) {
        let cover = b.cover_url || ""
        if (cover && cover.indexOf("http") !== 0) cover = "https://mwappimgs.cc" + cover
        let sub = b.last_chapter ? (b.last_chapter.chapter_name || "") : ""
        comics.push({
          id: String(b.param || b.id),
          title: b.book_name || "",
          cover: cover,
          subTitle: sub,
        })
      }
      // 满页说明可能还有下一页；不足一页即最后一页
      let maxPage = books.length >= 15 ? p + 1 : null
      return { comics: comics, maxPage: maxPage }
    },
  }

  comic = {
    loadInfo: async (id) => {
      let r = await this.fetchHtml(`/book/${id}`)
      let doc = new HtmlDocument(r.body)
      let titleEl = doc.querySelector("h1.detail-main-info-title")
      let title = titleEl ? (titleEl.text || "").trim() : ""
      let descEl = doc.querySelector(".detail-desc")
      let description = descEl ? (descEl.text || "").trim() : ""
      let author = ""
      let status = ""
      for (let e of doc.querySelectorAll(".detail-main-info-author")) {
        let t = (e.text || "").trim()
        if (!author && t.indexOf("作者") >= 0) author = t.replace(/^作者[：:]\s*/, "").trim()
        if (!status && t.indexOf("更新状态") >= 0) status = t.replace(/^更新状态[：:]\s*/, "").trim()
      }
      let cover = ""
      for (let im of doc.querySelectorAll("img")) {
        let s = im.attributes ? (im.attributes["data-original"] || im.attributes["src"] || "") : ""
        if (s && (s.indexOf("/book/id/") >= 0 || s.indexOf("cover") >= 0)) {
          cover = s
          break
        }
      }
      let updateTime = ""
      let upEl = doc.querySelector(".buy-manga-author")
      if (upEl) updateTime = (upEl.text || "").trim()
      let chapters = new Map()
      let i = 0
      for (let a of doc.querySelectorAll("a")) {
        let href = a.attributes ? (a.attributes["href"] || "") : ""
        if (href.indexOf("/chapter/") < 0) continue
        let epId = href.split("/").pop()
        let name = (a.text || "").trim()
        if (!epId || !name) continue
        if (chapters.has(epId)) continue
        chapters.set(epId, name)
        i++
      }
      let tags = {}
      if (status) tags["状态"] = [status]
      return new ComicDetails({
        title: title,
        subTitle: author,
        cover: cover,
        description: description,
        tags: tags,
        chapters: chapters,
        updateTime: updateTime ? updateTime : undefined,
      })
    },

    loadEp: async (comicId, epId) => {
      if (!epId) throw "章节 id 无效"
      let r = await this.fetchHtml(`/chapter/${epId}`)
      let doc = new HtmlDocument(r.body)
      let images = []
      for (let im of doc.querySelectorAll("img.content-img")) {
        let s = im.attributes ? (im.attributes["data-r-src"] || im.attributes["data-original"] || "") : ""
        if (!s || s.indexOf("http") !== 0) continue
        if (s.indexOf("imagecover") >= 0) continue
        images.push(this.fixImageUrl(s))
      }
      return { images: images }
    },

    onImageLoad: (url) => ({
      headers: {
        "Referer": this.baseUrl + "/",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
        "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
        "cache-time": "no",
      },
      // 章节图是 AES-128-CBC 加密的：key=iv=固定16字节串，Pkcs7 填充，密文即整个文件（无IV前缀）
      onResponse: (bytes) => {
        try {
          let keyBytes = Convert.encodeUtf8("my" + "2ecret" + "782ec" + "ret")
          let dec = Convert.decryptAesCbc(bytes, keyBytes, keyBytes)
          let plain = new Uint8Array(dec)
          // 去掉 PKCS7 填充（仅当长度仍为 16 的倍数，即尚未去填充时）
          if (plain.length >= 1 && plain.length % 16 === 0) {
            let pad = plain[plain.length - 1]
            if (pad >= 1 && pad <= 16 && pad <= plain.length) {
              let valid = true
              for (let i = plain.length - pad; i < plain.length; i++) {
                if (plain[i] !== pad) { valid = false; break }
              }
              if (valid) plain = plain.slice(0, plain.length - pad)
            }
          }
          let isImg =
            (plain[0] === 0xff && plain[1] === 0xd8) ||
            (plain[0] === 0x89 && plain[1] === 0x50) ||
            (plain[0] === 0x52 && plain[1] === 0x49) ||
            (plain[0] === 0x47 && plain[1] === 0x49) ||
            (plain[0] === 0x42 && plain[1] === 0x4d)
          if (!isImg) return bytes
          return plain.buffer
        } catch (e) {
          return bytes
        }
      },
    }),

    onThumbnailLoad: (url) => ({
      headers: {
        "Referer": this.baseUrl + "/",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
        "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
        "cache-time": "no",
      },
    }),
  }
}
