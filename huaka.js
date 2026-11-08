/**
 * 花咔漫画 (app.huakacomic.com)
 *
 * 站点是 Next.js：
 * - 首页 /zh-CN、最新 /zh-CN/latest 直接输出卡片
 * - 搜索走 /api/bff/comic-search?query=...，用 nextPageToken 翻页
 * - 详情 /zh-CN/comics/{huaCode}，章节链接形如
 *   /zh-CN/comics/{internalId}/episodes/{episodeId}
 * - 阅读页的图片在 cdn.huakacomic.com/pica-media/comic-pages/..._read.webp
 */

class HuaKa extends ComicSource {
  name = "花咔漫画"
  key = "huaka"
  version = "1.0.1"
  minAppVersion = "1.6.0"
  url = "https://cdn.jsdelivr.net/gh/venera-app/venera-configs@main/huaka.js"

  base = "https://app.huakacomic.com"
  webBase = "https://huakacomic.com"

  get headers() {
    return {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      "Accept-Language": "zh-CN,zh;q=0.9",
      Referer: this.base + "/zh-CN",
    }
  }

  absUrl(url) {
    if (!url) return ""
    if (url.indexOf("http") === 0) return url
    return this.base + (url[0] === "/" ? "" : "/") + url
  }

  // ---------- 列表 ----------

  parseList(body) {
    let doc = new HtmlDocument(body)
    let comics = []
    let seen = {}
    let links = doc.querySelectorAll('a[href*="/zh-CN/comics/HC"]')
    for (let a of links) {
      let href = a.attributes["href"] || ""
      let m = href.match(/\/comics\/(HC[0-9]+)/)
      if (!m || seen[m[1]]) continue
      let img = a.querySelector("img")
      if (!img) continue
      seen[m[1]] = true
      comics.push(
        new Comic({
          id: m[1],
          title: (img.attributes["alt"] || m[1]).trim(),
          cover: this.absUrl(img.attributes["src"] || ""),
        }),
      )
    }
    doc.dispose()
    return comics
  }

  async loadList(path) {
    let res = await Network.get(this.base + path, this.headers)
    if (res.status !== 200) throw "请求失败: " + res.status
    return { comics: this.parseList(res.body), maxPage: 1 }
  }

  explore = [
    {
      title: "首页推荐",
      type: "multiPageComicList",
      load: () => this.loadList("/zh-CN"),
    },
    {
      title: "最新",
      type: "multiPageComicList",
      load: () => this.loadList("/zh-CN/latest"),
    },
  ]

  // ---------- 搜索 ----------

  searchTokens = {}
  searchKeyword = ""

  search = {
    load: async (keyword, options, page) => {
      if (this.searchKeyword !== keyword) {
        this.searchKeyword = keyword
        this.searchTokens = {}
      }
      let token = this.searchTokens[page] || ""
      let url =
        this.base + "/api/bff/comic-search?query=" + encodeURIComponent(keyword) +
        "&pageSize=20"
      if (token) url += "&pageToken=" + encodeURIComponent(token)

      let res = await Network.get(url, {
        "User-Agent": this.headers["User-Agent"],
        "Accept-Language": "zh-CN,zh;q=0.9",
        Referer: this.base + "/zh-CN/search?keyword=" + encodeURIComponent(keyword),
      })
      if (res.status !== 200) throw "请求失败: " + res.status
      let json = JSON.parse(res.body)
      if (!json || json.statusCode !== 200) {
        throw "搜索失败: " + ((json && json.message) || res.status)
      }

      let data = json.data || {}
      let comics = []
      for (let item of data.comics || []) {
        comics.push(
          new Comic({
            id: item.huaCode || item.id || "",
            title: item.title || "",
            cover: item.thumbnailUrl || "",
            tags: (item.tags || []).slice(),
            description: item.description || "",
            subTitle: (item.authors || []).join(" / "),
          }),
        )
      }

      if (data.nextPageToken) this.searchTokens[page + 1] = data.nextPageToken
      return {
        comics: comics,
        maxPage: data.nextPageToken ? page + 1 : page,
      }
    },
    optionList: [],
  }

  // ---------- 详情 ----------

  async loadInfo(id) {
    let url = this.base + "/zh-CN/comics/" + id
    let res = await Network.get(url, this.headers)
    if (res.status !== 200) throw "请求失败: " + res.status

    let doc = new HtmlDocument(res.body)

    let titleEl = doc.querySelector("h1")
    let title = titleEl ? titleEl.text.trim() : id

    // 封面：详情页第一张 pica-media/comics 缩略图
    let cover = ""
    let coverMatch = res.body.match(
      /https:\/\/cdn\.huakacomic\.com\/pica-media\/comics\/[^"'\\ ]+_thumb\.webp/,
    )
    if (coverMatch) cover = coverMatch[0]

    let authors = []
    let authorEls = doc.querySelectorAll('a[href*="/zh-CN/authors/"]')
    for (let a of authorEls) {
      let t = a.text.trim()
      if (t && authors.indexOf(t) === -1) authors.push(t)
    }

    let tags = []
    let tagEls = doc.querySelectorAll(
      'a[href*="/zh-CN/tags/"], a[href*="/zh-CN/categories/"]',
    )
    for (let a of tagEls) {
      let t = a.text.trim()
      if (t && tags.indexOf(t) === -1) tags.push(t)
    }

    let chapters = {}
    let epEls = doc.querySelectorAll('a[href*="/episodes/"]')
    for (let a of epEls) {
      let href = a.attributes["href"] || ""
      if (!href || href.indexOf("/episodes/") === -1) continue
      let name = a.text.trim()
      if (!name) name = href.split("/").pop()
      chapters[href] = name
    }
    doc.dispose()

    return new ComicDetails({
      title: title,
      subtitle: authors.join(" / "),
      cover: cover,
      description: "",
      tags: tags,
      url: url,
      chapters: chapters,
    })
  }

  // ---------- 阅读 ----------

  async loadEp(comicId, epId) {
    let url = epId.indexOf("http") === 0 ? epId : this.absUrl(epId)
    let res = await Network.get(url, this.headers)
    if (res.status !== 200) throw "请求失败: " + res.status

    let images = []
    let seen = {}
    let re = /https:\/\/cdn\.huakacomic\.com\/pica-media\/comic-pages\/[^"'\\ ]+/g
    let m
    while ((m = re.exec(res.body)) !== null) {
      let u = m[0]
      if (u.indexOf("_read.") === -1 && u.indexOf("/comic-pages/") === -1) continue
      if (!seen[u]) {
        seen[u] = true
        images.push(u)
      }
    }

    if (images.length === 0) throw "未找到图片"
    return { images: images }
  }

  comic = {
    loadInfo: (id) => this.loadInfo(id),
    loadEp: (comicId, epId) => this.loadEp(comicId, epId),
  }
}
