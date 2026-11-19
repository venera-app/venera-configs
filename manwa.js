/** @type {import('./_venera_.js')} */
class ManWa extends ComicSource {
  name = "漫蛙"

  key = "manwa"

  version = "1.8.0"

  minAppVersion = "1.5.0"

  url = "https://cdn.jsdelivr.net/gh/venera-app/venera-configs@main/manwa.js"

  // 可用线路：前四为大陆区，最后为非大陆区
  static LINES = [
    "manwaub.cc",
    "manwaua.cc",
    "manwauf.cc",
    "manwaud.cc",
    "manwaug.cc",
    "manwa.me",
  ]

  get settings() {
    let lineOpts = [
      { value: "manwaub.cc", text: "线路1 manwaub.cc（大陆，推荐）" },
      { value: "manwaua.cc", text: "线路2 manwaua.cc（大陆）" },
      { value: "manwauf.cc", text: "线路3 manwauf.cc（大陆）" },
      { value: "manwaud.cc", text: "线路4 manwaud.cc（大陆）" },
      { value: "manwaug.cc", text: "线路5 manwaug.cc（大陆）" },
      { value: "manwa.me", text: "线路6 manwa.me（非大陆）" },
    ]
    try { let cur = this.loadSetting("line"); if (cur && !lineOpts.some((o) => o.value === cur)) lineOpts.unshift({ value: cur, text: String(cur) }) } catch (e) {}
    let imgOpts = [
      { value: "newmwtuyuan27.cc", text: "图源1 newmwtuyuan27.cc（推荐）" },
      { value: "mwfimsvfast40.cc", text: "图源2 mwfimsvfast40.cc" },
      { value: "newmwtuyuan26.cc", text: "图源3 newmwtuyuan26.cc" },
      { value: "mwappimgs.cc", text: "图源4 mwappimgs.cc" },
    ]
    try { let cur = this.loadSetting("imageHost"); if (cur && !imgOpts.some((o) => o.value === cur)) imgOpts.unshift({ value: cur, text: String(cur) }) } catch (e) {}
    return {
    autoConfig: {
      title: "一键设置线路与图源",
      type: "callback",
      buttonText: "自动测速设置",
      callback: async () => {
        try {
          let msg = await this.autoConfig()
          try { UI.showMessage("漫蛙一键设置完成：" + msg) } catch (e) {}
        } catch (e) {
          try { UI.showMessage("漫蛙一键设置失败：" + e) } catch (x) {}
        }
      },
    },
    line: {
      title: "线路",
      type: "select",
      options: lineOpts,
      default: "manwaub.cc",
    },
    imageHost: {
      title: "章节图源",
      type: "select",
      options: imgOpts,
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
    favoriteSort: {
      title: "收藏排序",
      type: "select",
      options: [
        { value: "0-0", text: "收藏时间（最新在前）" },
        { value: "0-1", text: "收藏时间（最早在前）" },
        { value: "1-0", text: "更新时间（最新在前）" },
        { value: "1-1", text: "更新时间（最早在前）" },
      ],
      default: "1-0",
    },
    }
  }

  _base = null

  get baseUrl() {
    if (this._base) return this._base
    let line = "manwaub.cc"
    try { line = this.loadSetting("line") || "manwaub.cc" } catch (e) {}
    // 旧域名已失效（如 manwaue.cc），或不在有效线路列表里，自动迁移到 manwaub.cc
    if (line === "manwaue.cc" || ManWa.LINES.indexOf(line) < 0) line = "manwaub.cc"
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
  // 写 Venera 设置项（设置存在 data.settings，不是 data 顶层）
  _saveSetting(key, value) {
    try { let st = this.loadData("settings") || {}; st[key] = value; this.saveData("settings", st); } catch (e) {}
  }

  // 测一个域名 /static/upload2/11.png 是否可访问 + 耗时（线路与图源通用）
  _probeHost(host) {
    let t0 = Date.now()
    return Network.fetchBytes("GET", "https://" + host + "/static/upload2/11.png?t=" + Date.now(), this.webHeaders)
      .then((res) => {
        let ms = Date.now() - t0
        let nb = res && res.body ? (res.body.byteLength !== undefined ? res.body.byteLength : res.body.length) : 0
        if (res && res.status === 200 && nb > 0) return { ok: 1, ms: ms }
        return { ok: 0, ms: ms }
      })
      .catch((e) => ({ ok: 0, ms: Date.now() - t0 }))
  }

  // 一键：抓线路列表 + 图源列表，实测各域名速度/可用性，把最快可用的写进设置
  async autoConfig() {
    // 1) 抓线路：fuwbp.cc/mw666 里 atob(base64) 是线路 URL 数组
    let lines = []
    try {
      let r = await Network.get("https://fuwbp.cc/mw666", this.webHeaders)
      let m = r && r.body ? r.body.match(/atob\('([^']+)'\)/) : null
      if (m) {
        let arr = JSON.parse(Convert.decodeUtf8(Convert.decodeBase64(m[1])))
        lines = arr.map((u) => String(u).replace(/^https?:\/\//, "").replace(/\/.*$/, "")).filter(Boolean)
      }
    } catch (e) {}
    lines = lines.concat((ManWa.LINES || []).slice())
    lines = lines.filter((h, i, a) => a.indexOf(h) === i)

    // 2) 各线路测速
    let lineRes = await Promise.all(lines.map(async (h) => { let p = await this._probeHost(h); return { host: h, ok: p.ok, ms: p.ms } }))
    let okLines = lineRes.filter((x) => x.ok).sort((a, b) => a.ms - b.ms)
    if (!okLines.length) throw "所有线路均无法连接"
    let bestLine = okLines[0]

    // 3) 用最优线路抓一个章节页的 data-img-hosts（base64 图源域名列表）
    let imgHosts = []
    try {
      let base = "https://" + bestLine.host
      let h1 = await Network.get(base + "/", this.webHeaders)
      let bid = h1 && h1.body ? (h1.body.match(/\/book\/(\d+)/) || [])[1] : null
      if (bid) {
        let h2 = await Network.get(base + "/book/" + bid, this.webHeaders)
        let cid = h2 && h2.body ? (h2.body.match(/\/chapter\/(\d+)/) || [])[1] : null
        if (cid) {
          let h3 = await Network.get(base + "/chapter/" + cid, this.webHeaders)
          let mm = h3 && h3.body ? h3.body.match(/data-img-hosts="([^"]+)"/) : null
          if (mm) {
            let s = Convert.decodeUtf8(Convert.decodeBase64(mm[1]))
            imgHosts = s.split(",").map((x) => x.trim()).filter(Boolean)
          }
        }
      }
    } catch (e) {}
    imgHosts = imgHosts.concat(["newmwtuyuan27.cc", "mwappimgs.cc", "newmwtuyuan26.cc", "mwfimsvfast40.cc"])
    imgHosts = imgHosts.filter((h, i, a) => a.indexOf(h) === i)

    // 4) 各图源测速
    let imgRes = await Promise.all(imgHosts.map(async (h) => { let p = await this._probeHost(h); return { host: h, ok: p.ok, ms: p.ms } }))
    let okImgs = imgRes.filter((x) => x.ok).sort((a, b) => a.ms - b.ms)
    let bestImg = okImgs.length ? okImgs[0] : { host: imgHosts[0], ms: 0 }

    // 5) 写设置
    this._saveSetting("line", bestLine.host)
    this._saveSetting("imageHost", bestImg.host)
    this._base = null

    // 6) 报告
    let extraLine = okLines.slice(1, 3).map((x) => x.host + "(" + x.ms + "ms)").join("、")
    return "线路 " + bestLine.host + "(" + bestLine.ms + "ms)" + (extraLine ? "，备选 " + extraLine : "") + "；图源 " + bestImg.host + "(" + bestImg.ms + "ms)"
  }

  // B方案：收藏/登录请求固定用「登录线」（避免切到不共享会话的线路如 manwauf/manwaug 看不了收藏）
  get _favBase() {
    try { let b = this.loadSetting("line"); if (b) return "https://" + b } catch (e) {}
    return this.baseUrl
  }

  // A方案：把「登录线」的 cookie 同步到所有线路域，让各线路都带登录态
  _syncCookies() {
    let src = null
    try { src = this.loadData("loginBase") } catch (e) {}
    if (!src) { try { src = "https://" + (this.loadSetting("line") || "manwaub.cc") } catch (e) { src = "https://manwaub.cc" } }
    let cks = null
    try { cks = Network.getCookies(src) } catch (e) {}
    if (!cks || !cks.length) return
    let str = cks.filter((c) => c && c.name && c.value).map((c) => c.name + "=" + c.value).join("; ")
    if (!str) return
    try {
      if (typeof ManWa !== "undefined" && ManWa.LINES) {
        for (let l of ManWa.LINES) {
          try { Network.setCookies("https://" + l, str) } catch (e) {}
        }
      }
    } catch (e) {}
  }

  authCookie() {
    try { this._syncCookies() } catch (e) {}
    let seen = {}
    let parts = []
    let domains = [this._favBase]
    try {
      if (typeof ManWa !== "undefined" && ManWa.LINES) {
        for (let l of ManWa.LINES) domains.push("https://" + l)
      }
    } catch (e) {}
    for (let d of domains) {
      try {
        let cookies = Network.getCookies(d)
        if (cookies && cookies.length) {
          for (let c of cookies) {
            if (c && c.name && c.value && !seen[c.name]) {
              seen[c.name] = 1
              parts.push(c.name + "=" + c.value)
            }
          }
        }
      } catch (e) {}
    }
    if (parts.length) return parts.join("; ")
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
    let base = this._favBase
    let headers = Object.assign({}, this.webHeaders, { Referer: base + "/", "cache-time": "no" })
    let ck = this.authCookie()
    if (ck) headers["Cookie"] = ck
    let res = await Network.get(base + path, headers)
    if (!res || res.status !== 200) throw "HTTP " + (res ? res.status : "无响应")
    return { base: base, body: res.body || "" }
  }

  // 表单 POST（用于收藏），返回解析后的 JSON
  async postForm(path, obj) {
    let base = this._favBase
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
    let base = this._favBase
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
    // 从福利页 HTML 读取真实状态：签到（打开页即自动签到，页面渲染"已签到"）、广告进度 X/5、广告奖励是否已领取
    let readState = (body) => {
      let m = body.match(/ad-item-content-item-number[^>]*>\s*(\d+)\s*\/\s*5/)
      return {
        adCount: m ? parseInt(m[1]) : 0,
        claimed: /ad-bonus[^>]*value="已领取"/.test(body),
        signed: /已签到/.test(body),
      }
    }
    // 1) 首次打开福利页（这一步本身会触发服务端签到），同时读状态
    let res1 = await Network.get(base + "/users/welfare", h)
    let netOK = !!(res1 && res1.status === 200)
    if (!netOK) {
      let failMsg = "签到失败，广告奖励领取失败"
      if (showStatus) { try { UI.showMessage("漫蛙福利：" + failMsg + "（打开福利页失败，网络或反爬）") } catch (e) {} }
      return failMsg
    }
    let r1 = readState(res1.body || "")
    // 2) 点广告补足 5 次
    if (r1.adCount < 5) {
      let link = encodeURIComponent("https://s.zlinkc.com/d.php?z=4833772")
      for (let i = r1.adCount; i < 5; i++) {
        try { await Network.get(base + "/ad_click?task=1&group=ad_wawaweise&link=" + link, h) } catch (e) {}
      }
    }
    // 3) 领取广告奖励
    if (!r1.claimed) {
      try {
        let h2 = Object.assign({}, h, { "Content-Type": "application/x-www-form-urlencoded" })
        await Network.post(base + "/users/welfare", h2, "action=ad_bonus")
      } catch (e) {}
    }
    // 4) 重新拉一次福利页，核对真实结果（不信任发请求就算成功）
    let res2 = await Network.get(base + "/users/welfare", h)
    let r2 = (res2 && res2.status === 200) ? readState(res2.body || "") : r1
    // 5) 合并展示：签到状态 + 广告状态
    let signPart = r2.signed ? "已签到" : "签到失败"
    let adOK = r2.adCount >= 5 && r2.claimed
    let adPart = adOK ? ("广告奖励已领取(" + r2.adCount + "/5)") : "广告奖励领取失败"
    let msg = signPart + "，" + adPart
    if (showStatus) { try { UI.showMessage("漫蛙福利：" + msg) } catch (e) {} }
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
    doc.dispose()
    return comics
  }

  // 搜索页解析：ul.book-list > li > .book-list-cover > a[href="/book/{id}"][title] > img
  parseSearchList(body) {
    let doc = new HtmlDocument(body)
    let comics = []
    let seen = {}
    for (let e of doc.querySelectorAll(".book-list-cover")) {
      let a = e.querySelector("a")
      let img = e.querySelector("img")
      if (!a || !a.attributes) continue
      let href = a.attributes["href"] || ""
      let id = href ? href.split("/").pop() : ""
      if (!id) continue
      let title = a.attributes["title"] || ""
      if (!title) {
        try { title = (a.text || "").trim() } catch (err) {}
      }
      let cover = ""
      if (img && img.attributes) {
        cover = img.attributes["data-original"] || img.attributes["src"] || ""
      }
      if (title && !seen[id]) {
        seen[id] = 1
        comics.push(new Comic({ id: id, title: title, cover: cover }))
      }
    }
    doc.dispose()
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
      // 搜索页用的是 .book-list 结构（不是发现页的 .manga-list-2-cover）
      let comics = this.parseSearchList(r.body)
      let maxPage = null
      if (comics.length > 0 && r.body.indexOf("pagination2") >= 0) maxPage = p + 1
      return { comics: comics, maxPage: maxPage }
    },
    optionList: [],
  }

  category = {
    title: "漫蛙",
    parts: [
      {
        name: "更新表",
        type: "fixed",
        categories: ["周一", "周二", "周三", "周四", "周五", "周六", "周日"],
        categoryParams: ["w:1", "w:2", "w:3", "w:4", "w:5", "w:6", "w:7"],
        itemType: "category",
      },
      {
        name: "向",
        type: "fixed",
        categories: ["全部", "一般向", "BL向", "禁漫", "TL向", "GL向"],
        categoryParams: ["g:-1", "g:2", "g:0", "g:1", "g:3", "g:4"],
        itemType: "category",
      },
      {
        name: "地区",
        type: "fixed",
        categories: ["全部", "韩国", "日漫", "国漫", "台漫", "其他", "未分类"],
        categoryParams: ["a:", "a:2", "a:3", "a:4", "a:5", "a:6", "a:1"],
        itemType: "category",
      },
      {
        name: "状态",
        type: "fixed",
        categories: ["全部", "连载中", "完结"],
        categoryParams: ["e:", "e:2", "e:1"],
        itemType: "category",
      },
      {
        name: "版本",
        type: "fixed",
        categories: ["全部", "高清清水版", "未删减完整版"],
        categoryParams: ["f:", "f:1", "f:2"],
        itemType: "category",
      },
      {
        name: "排序",
        type: "fixed",
        categories: ["最新", "最旧", "收藏", "新漫"],
        categoryParams: ["s:-1", "s:0", "s:1", "s:2"],
        itemType: "category",
      },
      {
        name: "标签",
        type: "fixed",
        categories: ["中文", "巨乳", "中出", "口交", "19R", "透视", "全彩", "日漫", "群交", "校服", "日文", "女性向", "乳交", "韩漫", "肛交", "熟女", "马尾", "强暴", "3D", "调教", "C100", "泳装", "校园", "萝莉", "乱伦", "C101", "完整版", "黑肉", "纯爱", "人妻", "束缚", "项圈", "NTR", "眼镜", "出轨", "职场", "催眠", "露出", "手套", "年下", "怀孕", "处女", "乳汁", "扶他", "恋爱", "内衣", "手淫", "百合", "巨尻", "多毛", "会员专区", "年龄差", "野炮", "都市", "触手", "女仆", "遮眼", "腹黑攻", "后宫", "青梅竹马", "魔法/奇幻", "贫乳", "穿刺", "辣妹", "滑稽搞笑", "三角关系", "拍摄", "傲娇受", "出汗", "高颜值", "超乳", "足交", "妖精", "执著攻", "热血", "办公室恋情", "CG", "非H", "同居", "自慰", "OL", "穿越", "兽耳", "忠犬攻", "原神", "援交", "甜文", "剧情", "ABO", "15R", "抖S", "古风", "重逢", "搞笑", "和服", "师生", "少女", "性感", "放尿", "教师", "药物", "丰满", "猎奇", "玄幻", "剧情向", "无码", "3P/多P", "偶像", "日常", "女装", "猫女", "短裤", "单恋", "黑道", "本子", "旧情复燃", "堕落", "诱受‧袭受", "溺爱", "奇幻", "睡奸", "美人受", "人外", "色气受", "冒险", "同人", "童贞", "反差", "掰弯", "颜射", "潮吹", "体型差", "手交", "C99", "过膝袜", "虐心", "兽人", "乳贴", "出产", "虐杀", "拘束", "玩具", "上司·部下", "勾引", "小说改编", "制服", "修女", "SM/BDSM", "国漫", "狐娘", "吸奶", "重生", "一见钟情", "完结", "宅系", "爱情", "治愈", "台版", "兽娘", "幻想", "美人攻", "巨屌", "强攻", "壮受", "奴隶", "可爱受", "大女主", "大叔", "凌辱", "其他", "转化", "诱受·袭受", "魔幻", "兽交", "排泄", "重口", "巨根", "虐待", "非现代", "母子", "大尺度", "豪门", "连载中", "戏剧", "巫女", "黑皮", "前辈·后辈", "醉酒", "初体验", "性转", "禁断·背德", "筋肉", "短篇合集", "动作", "护士", "生活", "主仆关系", "初恋", "画册", "惊悚/悬疑", "一夜情", "眼罩", "肌肉", "围裙", "娱乐圈", "无口", "抹油", "年下男子", "伪娘", "同级生", "温柔攻", "花嫁", "附身", "固执受", "强受", "母亲", "复仇", "皮物", "魅魔", "旗袍", "夹腿", "鬼族", "男公关", "窒息", "邻居", "逆袭", "总裁", "痴汉", "悬疑", "异世界", "淫纹", "硬派攻", "肉食系", "监禁", "正妹", "轻熟女", "科幻", "酷刑", "变态", "双马尾", "连载", "傲娇", "人妖", "深情攻", "阿黑颜", "职业女性", "病娇", "医生", "忠犬受", "吸血鬼", "男孕", "无修正", "张口", "少男", "浪漫", "C97", "上班族", "灌肠", "多CP", "动图", "宫廷", "COSPLAY", "青春", "放屁", "正太", "女王受", "契约关系", "内射", "排尿", "饮精", "警察", "美漫", "寡妇", "唯美", "短篇集", "台漫", "战斗", "王族·贵族", "伦理", "疯批攻", "股交", "王子", "青年漫", "傲娇攻", "出版", "灵异", "抖M", "恶魔", "暴力", "傲慢攻", "壁尻", "单行本", "女警", "双向暗恋", "病娇攻", "丸吞", "恐怖", "系统", "女巫", "犬娘", "新娘", "幽灵", "强奸", "女性支配", "骨科/伪骨科", "肉欲", "武侠", "重口味", "淫荡", "异种族", "产卵", "见本", "妈妈", "天然受", "雀斑", "淫乱", "腹黑", "连裤袜", "换身", "浴衣", "相亲·联谊", "寄生", "改编", "C96", "少年", "爆笑", "拳交", "欲望", "侄女", "强制", "御姐", "天然系", "忠犬", "失忆", "痴女", "异能", "健气受", "淫荡受", "FF39", "NP", "惊悚", "天使", "办公室", "微码", "C95", "寡默攻", "野外", "瘙痒", "YAOI", "纯情少女", "恋爱生活", "条漫", "和风", "霸总", "格斗", "耽美", "喝尿", "双子", "修真", "架空", "后悔攻", "年上男子", "性玩具", "C94", "鼻钩", "生子", "呆萌受", "怪物女孩", "微虐", "菁英", "萌系", "轮奸", "育儿", "长条", "心机攻", "女学生", "大小姐", "执事", "黑白", "火影", "恋尸", "绿帽", "富二代", "热血机战", "魔法奇幻", "美食", "直男受", "逆后宫", "丝袜", "霸道攻", "有夫之妇", "真人", "偷情", "推理", "纯情受", "电击", "扶她", "科幻未来", "女大学生", "舔阴", "追妻火葬场", "知音漫客", "昆虫", "冰释前嫌", "漫画家·作家", "C92", "哭包攻", "推理悬疑", "小说", "禁漫汉化组", "诱惑", "召唤", "励志", "架空历史", "纯情攻", "超能力", "连续高潮", "财阀", "兄妹", "异国之恋", "橘味", "跟踪狂", "不伦", "长篇", "丧尸", "SM", "多攻", "体育竞技", "情趣用品", "军服", "舔足", "纯真受", "天然攻", "互攻", "兔女郎", "王公贵族", "创伤受", "家教", "毛绒绒", "鬼怪", "接吻", "性爱", "恐怖惊悚", "假期性爱系列", "暗恋", "怯懦攻", "PIXIV", "脑洞", "JK", "绝伦攻", "办公女郎", "古装", "粪便", "媚药", "狼女", "洗脑", "FOCUS", "血腥", "枷刑", "契约", "新作", "执着攻", "捆绑", "石化", "大乳晕", "马娘", "C93", "偏执攻", "虐文", "动画化", "C86", "耽美人生", "鞭打", "黑人", "魔法", "高甜", "强迫", "C90", "装逼", "渣攻", "C91", "敌对关系", "转生", "春药", "吊带袜", "伤疤", "鬼畜", "不良", "平凡受", "不良少年", "女高中生", "踩踏", "轻浮受", "浪漫爱情", "C88", "游戏", "战争", "炮友", "婊子受", "妄想系", "性勒索", "道具", "淫乱受", "扩张", "可爱攻", "不伦/劈腿", "女扮男装", "3P", "特殊职业", "精灵", "运动", "彩虹", "好友", "日生佑稀", "高潮", "女大生", "长腿", "姐妹", "模特儿", "狂攻系列", "恶役千金", "成人", "直男攻", "禁断", "AV男优", "修仙", "S", "软萌受", "占有欲", "女神", "本崎月子", "极力推荐", "风俗", "神鬼", "上司", "兄弟情", "虫洞", "强制爱", "老师", "假小子", "按摩", "姐弟", "面瘫攻", "FF40", "妹妹", "外国人", "连体衣", "宫斗", "自卑受", "硬派受", "惊奇", "淫魔", "竞技", "C89", "腹黑受", "黑丝", "源一実", "近亲", "异种奸", "蛇女", "漫客栈", "女恶魔", "兄弟丼", "背叛", "上流社会", "非人", "鬼畜攻", "C87", "母狗", "性欲", "紧缚", "教授", "兄弟", "双胞胎", "英文", "养成", "年上", "木马", "秘书", "淫魔·魅魔", "绷带", "姫屋", "RYONA", "历史", "通奸", "发交", "漫画", "婊子", "帅气女", "魔法少女", "哭包受", "团藤さや", "堕胎", "疗愈", "律师", "姐姐", "单纯受", "鲨鱼", "性奴", "年下攻", "山本ともみつ", "口交脸", "圈养", "格差", "下克上", "山口ねね", "C78", "报仇", "父女", "CG杂图", "连裤丝袜", "AI作画", "深喉", "短篇", "生肉", "伪娘哲学", "情趣内衣", "肛内中出", "19r", "偶像梦幻祭", "妹妹系", "无H内容", "短发", "萌", "女高中生(JK)", "运动服", "学校泳装 / 死库水", "晒黑/日烧", "百合花园", "禁书目录", "C108", "扶他乐园", "project sekai", "汗水", "东方", "C104", "东方: 妖梦", "湿身", "蔚蓝档案", "骑乘", "无职转生", "阿嘿颜", "非人类", "女王", "乳头刺激", "横切面", "蹦坏脸", "幼驯染", "野外 / 露出", "阿姨", "姐姐系", "15r", "小说漫改", "异世界穿越", "社畜", "BL", "TL", "男不洁", "三角恋情", "友情", "罗曼史", "喜剧", "幽默搞笑", "直播", "奇幻冒险", "已婚", "大乳头", "AI绘图", "乳牛装", "机翻", "学生", "口爆", "浴室"],
        categoryParams: ["t:中文", "t:巨乳", "t:中出", "t:口交", "t:19R", "t:透视", "t:全彩", "t:日漫", "t:群交", "t:校服", "t:日文", "t:女性向", "t:乳交", "t:韩漫", "t:肛交", "t:熟女", "t:马尾", "t:强暴", "t:3D", "t:调教", "t:C100", "t:泳装", "t:校园", "t:萝莉", "t:乱伦", "t:C101", "t:完整版", "t:黑肉", "t:纯爱", "t:人妻", "t:束缚", "t:项圈", "t:NTR", "t:眼镜", "t:出轨", "t:职场", "t:催眠", "t:露出", "t:手套", "t:年下", "t:怀孕", "t:处女", "t:乳汁", "t:扶他", "t:恋爱", "t:内衣", "t:手淫", "t:百合", "t:巨尻", "t:多毛", "t:会员专区", "t:年龄差", "t:野炮", "t:都市", "t:触手", "t:女仆", "t:遮眼", "t:腹黑攻", "t:后宫", "t:青梅竹马", "t:魔法/奇幻", "t:贫乳", "t:穿刺", "t:辣妹", "t:滑稽搞笑", "t:三角关系", "t:拍摄", "t:傲娇受", "t:出汗", "t:高颜值", "t:超乳", "t:足交", "t:妖精", "t:执著攻", "t:热血", "t:办公室恋情", "t:CG", "t:非H", "t:同居", "t:自慰", "t:OL", "t:穿越", "t:兽耳", "t:忠犬攻", "t:原神", "t:援交", "t:甜文", "t:剧情", "t:ABO", "t:15R", "t:抖S", "t:古风", "t:重逢", "t:搞笑", "t:和服", "t:师生", "t:少女", "t:性感", "t:放尿", "t:教师", "t:药物", "t:丰满", "t:猎奇", "t:玄幻", "t:剧情向", "t:无码", "t:3P/多P", "t:偶像", "t:日常", "t:女装", "t:猫女", "t:短裤", "t:单恋", "t:黑道", "t:本子", "t:旧情复燃", "t:堕落", "t:诱受‧袭受", "t:溺爱", "t:奇幻", "t:睡奸", "t:美人受", "t:人外", "t:色气受", "t:冒险", "t:同人", "t:童贞", "t:反差", "t:掰弯", "t:颜射", "t:潮吹", "t:体型差", "t:手交", "t:C99", "t:过膝袜", "t:虐心", "t:兽人", "t:乳贴", "t:出产", "t:虐杀", "t:拘束", "t:玩具", "t:上司·部下", "t:勾引", "t:小说改编", "t:制服", "t:修女", "t:SM/BDSM", "t:国漫", "t:狐娘", "t:吸奶", "t:重生", "t:一见钟情", "t:完结", "t:宅系", "t:爱情", "t:治愈", "t:台版", "t:兽娘", "t:幻想", "t:美人攻", "t:巨屌", "t:强攻", "t:壮受", "t:奴隶", "t:可爱受", "t:大女主", "t:大叔", "t:凌辱", "t:其他", "t:转化", "t:诱受·袭受", "t:魔幻", "t:兽交", "t:排泄", "t:重口", "t:巨根", "t:虐待", "t:非现代", "t:母子", "t:大尺度", "t:豪门", "t:连载中", "t:戏剧", "t:巫女", "t:黑皮", "t:前辈·后辈", "t:醉酒", "t:初体验", "t:性转", "t:禁断·背德", "t:筋肉", "t:短篇合集", "t:动作", "t:护士", "t:生活", "t:主仆关系", "t:初恋", "t:画册", "t:惊悚/悬疑", "t:一夜情", "t:眼罩", "t:肌肉", "t:围裙", "t:娱乐圈", "t:无口", "t:抹油", "t:年下男子", "t:伪娘", "t:同级生", "t:温柔攻", "t:花嫁", "t:附身", "t:固执受", "t:强受", "t:母亲", "t:复仇", "t:皮物", "t:魅魔", "t:旗袍", "t:夹腿", "t:鬼族", "t:男公关", "t:窒息", "t:邻居", "t:逆袭", "t:总裁", "t:痴汉", "t:悬疑", "t:异世界", "t:淫纹", "t:硬派攻", "t:肉食系", "t:监禁", "t:正妹", "t:轻熟女", "t:科幻", "t:酷刑", "t:变态", "t:双马尾", "t:连载", "t:傲娇", "t:人妖", "t:深情攻", "t:阿黑颜", "t:职业女性", "t:病娇", "t:医生", "t:忠犬受", "t:吸血鬼", "t:男孕", "t:无修正", "t:张口", "t:少男", "t:浪漫", "t:C97", "t:上班族", "t:灌肠", "t:多CP", "t:动图", "t:宫廷", "t:COSPLAY", "t:青春", "t:放屁", "t:正太", "t:女王受", "t:契约关系", "t:内射", "t:排尿", "t:饮精", "t:警察", "t:美漫", "t:寡妇", "t:唯美", "t:短篇集", "t:台漫", "t:战斗", "t:王族·贵族", "t:伦理", "t:疯批攻", "t:股交", "t:王子", "t:青年漫", "t:傲娇攻", "t:出版", "t:灵异", "t:抖M", "t:恶魔", "t:暴力", "t:傲慢攻", "t:壁尻", "t:单行本", "t:女警", "t:双向暗恋", "t:病娇攻", "t:丸吞", "t:恐怖", "t:系统", "t:女巫", "t:犬娘", "t:新娘", "t:幽灵", "t:强奸", "t:女性支配", "t:骨科/伪骨科", "t:肉欲", "t:武侠", "t:重口味", "t:淫荡", "t:异种族", "t:产卵", "t:见本", "t:妈妈", "t:天然受", "t:雀斑", "t:淫乱", "t:腹黑", "t:连裤袜", "t:换身", "t:浴衣", "t:相亲·联谊", "t:寄生", "t:改编", "t:C96", "t:少年", "t:爆笑", "t:拳交", "t:欲望", "t:侄女", "t:强制", "t:御姐", "t:天然系", "t:忠犬", "t:失忆", "t:痴女", "t:异能", "t:健气受", "t:淫荡受", "t:FF39", "t:NP", "t:惊悚", "t:天使", "t:办公室", "t:微码", "t:C95", "t:寡默攻", "t:野外", "t:瘙痒", "t:YAOI", "t:纯情少女", "t:恋爱生活", "t:条漫", "t:和风", "t:霸总", "t:格斗", "t:耽美", "t:喝尿", "t:双子", "t:修真", "t:架空", "t:后悔攻", "t:年上男子", "t:性玩具", "t:C94", "t:鼻钩", "t:生子", "t:呆萌受", "t:怪物女孩", "t:微虐", "t:菁英", "t:萌系", "t:轮奸", "t:育儿", "t:长条", "t:心机攻", "t:女学生", "t:大小姐", "t:执事", "t:黑白", "t:火影", "t:恋尸", "t:绿帽", "t:富二代", "t:热血机战", "t:魔法奇幻", "t:美食", "t:直男受", "t:逆后宫", "t:丝袜", "t:霸道攻", "t:有夫之妇", "t:真人", "t:偷情", "t:推理", "t:纯情受", "t:电击", "t:扶她", "t:科幻未来", "t:女大学生", "t:舔阴", "t:追妻火葬场", "t:知音漫客", "t:昆虫", "t:冰释前嫌", "t:漫画家·作家", "t:C92", "t:哭包攻", "t:推理悬疑", "t:小说", "t:禁漫汉化组", "t:诱惑", "t:召唤", "t:励志", "t:架空历史", "t:纯情攻", "t:超能力", "t:连续高潮", "t:财阀", "t:兄妹", "t:异国之恋", "t:橘味", "t:跟踪狂", "t:不伦", "t:长篇", "t:丧尸", "t:SM", "t:多攻", "t:体育竞技", "t:情趣用品", "t:军服", "t:舔足", "t:纯真受", "t:天然攻", "t:互攻", "t:兔女郎", "t:王公贵族", "t:创伤受", "t:家教", "t:毛绒绒", "t:鬼怪", "t:接吻", "t:性爱", "t:恐怖惊悚", "t:假期性爱系列", "t:暗恋", "t:怯懦攻", "t:PIXIV", "t:脑洞", "t:JK", "t:绝伦攻", "t:办公女郎", "t:古装", "t:粪便", "t:媚药", "t:狼女", "t:洗脑", "t:FOCUS", "t:血腥", "t:枷刑", "t:契约", "t:新作", "t:执着攻", "t:捆绑", "t:石化", "t:大乳晕", "t:马娘", "t:C93", "t:偏执攻", "t:虐文", "t:动画化", "t:C86", "t:耽美人生", "t:鞭打", "t:黑人", "t:魔法", "t:高甜", "t:强迫", "t:C90", "t:装逼", "t:渣攻", "t:C91", "t:敌对关系", "t:转生", "t:春药", "t:吊带袜", "t:伤疤", "t:鬼畜", "t:不良", "t:平凡受", "t:不良少年", "t:女高中生", "t:踩踏", "t:轻浮受", "t:浪漫爱情", "t:C88", "t:游戏", "t:战争", "t:炮友", "t:婊子受", "t:妄想系", "t:性勒索", "t:道具", "t:淫乱受", "t:扩张", "t:可爱攻", "t:不伦/劈腿", "t:女扮男装", "t:3P", "t:特殊职业", "t:精灵", "t:运动", "t:彩虹", "t:好友", "t:日生佑稀", "t:高潮", "t:女大生", "t:长腿", "t:姐妹", "t:模特儿", "t:狂攻系列", "t:恶役千金", "t:成人", "t:直男攻", "t:禁断", "t:AV男优", "t:修仙", "t:S", "t:软萌受", "t:占有欲", "t:女神", "t:本崎月子", "t:极力推荐", "t:风俗", "t:神鬼", "t:上司", "t:兄弟情", "t:虫洞", "t:强制爱", "t:老师", "t:假小子", "t:按摩", "t:姐弟", "t:面瘫攻", "t:FF40", "t:妹妹", "t:外国人", "t:连体衣", "t:宫斗", "t:自卑受", "t:硬派受", "t:惊奇", "t:淫魔", "t:竞技", "t:C89", "t:腹黑受", "t:黑丝", "t:源一実", "t:近亲", "t:异种奸", "t:蛇女", "t:漫客栈", "t:女恶魔", "t:兄弟丼", "t:背叛", "t:上流社会", "t:非人", "t:鬼畜攻", "t:C87", "t:母狗", "t:性欲", "t:紧缚", "t:教授", "t:兄弟", "t:双胞胎", "t:英文", "t:养成", "t:年上", "t:木马", "t:秘书", "t:淫魔·魅魔", "t:绷带", "t:姫屋", "t:RYONA", "t:历史", "t:通奸", "t:发交", "t:漫画", "t:婊子", "t:帅气女", "t:魔法少女", "t:哭包受", "t:团藤さや", "t:堕胎", "t:疗愈", "t:律师", "t:姐姐", "t:单纯受", "t:鲨鱼", "t:性奴", "t:年下攻", "t:山本ともみつ", "t:口交脸", "t:圈养", "t:格差", "t:下克上", "t:山口ねね", "t:C78", "t:报仇", "t:父女", "t:CG杂图", "t:连裤丝袜", "t:AI作画", "t:深喉", "t:短篇", "t:生肉", "t:伪娘哲学", "t:情趣内衣", "t:肛内中出", "t:19r", "t:偶像梦幻祭", "t:妹妹系", "t:无H内容", "t:短发", "t:萌", "t:女高中生(JK)", "t:运动服", "t:学校泳装 / 死库水", "t:晒黑/日烧", "t:百合花园", "t:禁书目录", "t:C108", "t:扶他乐园", "t:project sekai", "t:汗水", "t:东方", "t:C104", "t:东方: 妖梦", "t:湿身", "t:蔚蓝档案", "t:骑乘", "t:无职转生", "t:阿嘿颜", "t:非人类", "t:女王", "t:乳头刺激", "t:横切面", "t:蹦坏脸", "t:幼驯染", "t:野外 / 露出", "t:阿姨", "t:姐姐系", "t:15r", "t:小说漫改", "t:异世界穿越", "t:社畜", "t:BL", "t:TL", "t:男不洁", "t:三角恋情", "t:友情", "t:罗曼史", "t:喜剧", "t:幽默搞笑", "t:直播", "t:奇幻冒险", "t:已婚", "t:大乳头", "t:AI绘图", "t:乳牛装", "t:机翻", "t:学生", "t:口爆", "t:浴室"],
        itemType: "category",
      },
    ],
    enableRankingPage: false,
  }

  // 计算本周指定星期几的日期（1=周一 ... 7=周日），更新表用
  _weekDate(dayN) {
    let now = new Date()
    let cur = now.getDay() || 7
    let d = new Date(now.getTime() + (dayN - cur) * 86400000)
    let mm = String(d.getMonth() + 1).padStart(2, "0")
    let dd = String(d.getDate()).padStart(2, "0")
    return d.getFullYear() + "-" + mm + "-" + dd
  }

  categoryComics = {
    load: async (category, param, options, page) => {
      let p = page && page > 0 ? page : 1
      let raw = (param === null || param === undefined) ? "" : String(param)
      let ci = raw.indexOf(":")
      let kind = ci >= 0 ? raw.slice(0, ci) : ""
      let val = ci >= 0 ? raw.slice(ci + 1) : raw
      if (kind === "w") {
        let dayN = parseInt(val) || 1
        let date = this._weekDate(dayN)
        let r = await Network.get(this.baseUrl + "/getUpdate?page=" + (p - 1) + "&date=" + date, {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
          "Accept": "application/json",
          "X-Requested-With": "XMLHttpRequest",
        })
        let json = null
        try { json = JSON.parse(r.body) } catch (e) {}
        let comics = []
        let maxPage = null
        if (json && json.books) {
          for (let b of json.books) {
            let cu = b.cover_url || ""
            let cover = cu.indexOf("http") === 0 ? cu : ("https://mwappimgs.cc" + cu)
            comics.push(new Comic({ id: String(b.param || b.id), title: b.book_name, cover: cover }))
          }
          let total = json.total || 0
          if (total > (p - 1) * (json.books.length || 20) + comics.length) maxPage = p + 1
        }
        return { comics: comics, maxPage: maxPage }
      }
      let q = "gender=-1"
      if (kind === "g") q = "gender=" + encodeURIComponent(val)
      else if (kind === "a") { q = val ? ("gender=-1&area=" + encodeURIComponent(val)) : "gender=-1" }
      else if (kind === "e") { q = val ? ("gender=-1&end=" + encodeURIComponent(val)) : "gender=-1" }
      else if (kind === "f") { q = val ? ("gender=-1&has_full=" + encodeURIComponent(val)) : "gender=-1" }
      else if (kind === "s") q = "gender=-1&sort=" + encodeURIComponent(val)
      else if (kind === "t") { q = val ? ("gender=-1&tag=" + encodeURIComponent(val)) : "gender=-1" }
      let r = await this.fetchHtml(`/booklist?page=${p}&${q}`)
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
        this.account.loginWithWebview.url = "https://" + (this.loadSetting("line") || "manwaub.cc") + "/login.html"
      }
    } catch (e) {}
  }

  account = {
    // 站点登录需要图片验证码：先取验证码图片二进制，弹窗让用户看图输入，再提交登录
    login: async (account, pwd) => {
      let base = "https://" + (this.loadSetting("line") || "manwaub.cc")
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
      try { this.saveData("loginBase", base) } catch (e) {}
      return "ok"
    },
    loginWithWebview: {
      url: "https://manwaub.cc/login.html",
      checkStatus: (url, title) => {
        return (url || "").indexOf("/ucenter") >= 0
      },
      onLoginSuccess: async () => {
        try { let _lb = "https://" + (this.loadSetting("line") || "manwaub.cc"); this.saveData("loginBase", _lb); this._syncCookies() } catch (e) {}
      },
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
      if (json && json.err == 1) {
        let msg = json.msg || ""
        // 只有真正"未登录"才抛 Login expired（触发 App 重新登录）；
        // 其它 err==1（如"收藏数已达上限"）是普通业务错误，直接抛出提示，不能误判为登录过期
        if (msg.indexOf("未登录") >= 0) throw "Login expired"
        throw msg || "收藏操作失败"
      }
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
      // 用详情页收藏按钮的 data-val 判断是否已收藏（1=已收藏，0=未收藏）；不遍历任何收藏夹
      let favorited = []
      if (comicId) {
        try {
          let rd = await this.fetchHtmlOne("/book/" + comicId)
          let el = (rd.body || "").match(/<a[^>]*id="addfavor"[^>]*>/i)
          let dv = el ? (el[0].match(/data-val="(-?\d+)"/) || [])[1] : null
          if (dv === "1") favorited = ["0"] // 已收藏（具体夹不细分，用“全部收藏”占位，使详情页显示已收藏、可移除）
        } catch (e) {}
      }
      return { folders: folders, favorited: favorited }
    },
    loadComics: async (page, folder) => {
      let p = page && page > 0 ? page : 1
      // 注意：/getfavors 的 page 参数其实是「起始偏移 offset」（1-based），每页固定 15 本，不是页码。
      // Venera 传的是页码 1/2/3，需换算成 offset：1/16/31...
      let offset = (p - 1) * 15 + 1
      let fid = folder === null || folder === undefined || String(folder) === "" ? "0" : String(folder)
      // 排序：读设置（格式 "order-orderType"，默认 1-0=更新时间最新在前；order 0=收藏时间 1=更新时间，order_type 0=降序 1=升序）
      let sortVal = "1-0"
      try { sortVal = this.loadSetting("favoriteSort") || "1-0" } catch (e) {}
      let sortParts = String(sortVal).split("-")
      let orderField = parseInt(sortParts[0]) || 0
      let orderDir = sortParts.length > 1 ? (parseInt(sortParts[1]) || 0) : 0
      let json = await this.getJson("/getfavors", {
        page: offset,
        showOnlyUpdated: -1,
        isEnd: -1,
        isFullVersion: -1,
        order: orderField,
        order_type: orderDir,
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
      let cd = new ComicDetails({
        title: title,
        subTitle: author,
        cover: cover,
        description: description,
        tags: tags,
        chapters: chapters,
        updateTime: updateTime ? updateTime : undefined,
      })
      doc.dispose()
      return cd
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
      doc.dispose()
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
