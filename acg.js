/**
 * ACG漫画网 (acgmhaa.com，原 acgmhn.com)
 *
 * 站点是服务端渲染的图库式漫画站：
 * - 列表 / 、/index-2.html ...，每页 ul#list > li
 * - 详情/阅读 /h/{id}.html，每页一张图，分页 /h/{id}-{page}.html
 * - 图片文件名通常连续（xxx_1.webp / xxx_2.webp），可以批量生成
 */

class ACGManga extends ComicSource {
  name = "ACG漫画网"
  key = "acgmanga"
  version = "1.0.1"
  minAppVersion = "1.6.0"
  url = "https://cdn.jsdelivr.net/gh/venera-app/venera-configs@main/acg.js"

  base = "https://www.acgmhaa.com"

  get headers() {
    return {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      "Accept-Language": "zh-CN,zh;q=0.9",
      "Referer": this.base + "/",
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
    let items = doc.querySelectorAll("ul#list > li")
    for (let li of items) {
      let a = li.querySelector("a.thumb")
      if (!a) continue
      let href = a.attributes["href"] || ""
      let m = href.match(/\/h\/(\d+)\.html/)
      if (!m || seen[m[1]]) continue
      let img = li.querySelector("img")
      let title = a.attributes["title"] || ""
      if (!title) {
        let t = li.querySelector("span.title a")
        if (t) title = t.text.trim()
      }
      if (!title && img) title = img.attributes["alt"] || ""
      if (!title) title = "漫画 " + m[1]

      seen[m[1]] = true
      comics.push(
        new Comic({
          id: m[1],
          title: title.trim(),
          cover: img ? this.absUrl(img.attributes["src"] || "") : "",
        }),
      )
    }
    doc.dispose()
    return comics
  }

  async loadPage(page, hot) {
    let url = hot ? this.base + "/hot/" : this.base + "/"
    if (!hot && page > 1) url = this.base + "/index-" + page + ".html"
    let res = await Network.get(url, this.headers)
    if (res.status !== 200) throw "请求失败: " + res.status
    let comics = this.parseList(res.body)
    return {
      comics: comics,
      maxPage: hot ? 1 : comics.length > 0 ? page + 1 : page,
    }
  }

  explore = [
    {
      title: "最新",
      type: "multiPageComicList",
      load: (page) => this.loadPage(page, false),
    },
    {
      title: "最热",
      type: "multiPageComicList",
      load: (page) => this.loadPage(page, true),
    },
  ]

  search = {
    load: async (keyword, options, page) => {
      let url =
        this.base + "/?q=" + encodeURIComponent(keyword) +
        (page > 1 ? "&page=" + page : "")
      let res = await Network.get(url, this.headers)
      if (res.status !== 200) throw "请求失败: " + res.status
      let comics = this.parseList(res.body)
      return {
        comics: comics,
        maxPage: comics.length > 0 ? page + 1 : page,
      }
    },
    optionList: [],
  }

  // ---------- 详情 ----------

  async loadInfo(id) {
    let url = this.base + "/h/" + id + ".html"
    let res = await Network.get(url, this.headers)
    if (res.status !== 200) throw "请求失败: " + res.status
    let doc = new HtmlDocument(res.body)

    let titleEl = doc.querySelector("h1.title")
    let title = titleEl ? titleEl.text.trim() : ""

    let img = doc.querySelector("p.manga-picture img")
    let cover = img ? this.absUrl(img.attributes["src"] || "") : ""

    let tags = []
    let tagEls = doc.querySelectorAll(".summary a")
    for (let a of tagEls) {
      let t = a.text.trim()
      if (t && tags.indexOf(t) === -1) tags.push(t)
    }

    let description = ""
    let infoEls = doc.querySelectorAll(".info span")
    let info = []
    for (let s of infoEls) {
      let t = s.text.trim()
      if (t) info.push(t)
    }
    if (info.length > 0) description = info.join(" · ")

    let maxPage = 1
    let pageEls = doc.querySelectorAll("#pages a")
    for (let a of pageEls) {
      let href = a.attributes["href"] || ""
      let m = href.match(/-(\d+)\.html$/)
      if (m) maxPage = Math.max(maxPage, parseInt(m[1]))
    }
    doc.dispose()

    return new ComicDetails({
      title: title,
      subtitle: "",
      cover: cover,
      description: description,
      tags: tags,
      url: url,
      chapters: { "1": "全一话（共" + maxPage + "页）" },
    })
  }

  // ---------- 阅读 ----------

  async fetchPageImage(id, page) {
    let url =
      this.base + "/h/" + id + (page > 1 ? "-" + page : "") + ".html"
    let res = await Network.get(url, this.headers)
    if (res.status !== 200) return ""
    let m = res.body.match(/<p class="manga-picture">[\s\S]*?<img[^>]+src="([^"]+)"/)
    return m ? this.absUrl(m[1]) : ""
  }

  splitImageUrl(url) {
    let m = url.match(/^(.*?)(\d+)(\.[A-Za-z0-9]+)$/)
    if (!m) return null
    return {
      prefix: m[1],
      number: m[2],
      ext: m[3],
    }
  }

  async loadEp(comicId, epId) {
    let first = await this.fetchPageImage(comicId, 1)
    if (!first) throw "未找到图片"

    // 从阅读页分页中取总页数
    let res = await Network.get(this.base + "/h/" + comicId + ".html", this.headers)
    let maxPage = 1
    if (res.status === 200) {
      let doc = new HtmlDocument(res.body)
      let pageEls = doc.querySelectorAll("#pages a")
      for (let a of pageEls) {
        let href = a.attributes["href"] || ""
        let m = href.match(/-(\d+)\.html$/)
        if (m) maxPage = Math.max(maxPage, parseInt(m[1]))
      }
      doc.dispose()
    }

    if (maxPage <= 1) return { images: [first] }

    // 验证文件名是否连续，连续则直接生成，避免逐页请求
    let firstParts = this.splitImageUrl(first)
    let second = await this.fetchPageImage(comicId, 2)
    let secondParts = second ? this.splitImageUrl(second) : null

    if (
      firstParts && secondParts &&
      firstParts.prefix === secondParts.prefix &&
      firstParts.ext === secondParts.ext &&
      parseInt(secondParts.number) === parseInt(firstParts.number) + 1
    ) {
      let images = []
      let pad = firstParts.number.length
      let start = parseInt(firstParts.number)
      for (let i = 0; i < maxPage; i++) {
        let n = start + i
        let num = String(n)
        while (num.length < pad) num = "0" + num
        images.push(firstParts.prefix + num + firstParts.ext)
      }
      return { images: images }
    }

    // 文件名不规律时逐页抓取
    let images = [first]
    for (let p = 2; p <= maxPage; p++) {
      let img = await this.fetchPageImage(comicId, p)
      if (img) images.push(img)
    }
    return { images: images }
  }

  comic = {
    loadInfo: (id) => this.loadInfo(id),
    loadEp: (comicId, epId) => this.loadEp(comicId, epId),
  }
}
