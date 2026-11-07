/**
 * HentaiEra (hentaiera.com)
 *
 * 站点为服务端渲染的图库站：
 * - 列表 /?page=N、分类 /category/{name}/?page=N、搜索 /search/?q=...
 * - 详情 /gallery/{id}/，总页数在 #load_pages 中
 * - 阅读 /view/{id}/{page}/，图片在 img[data-src]，文件名通常连续
 */

class HentaiEra extends ComicSource {
  name = "HentaiEra"
  key = "hentaiera"
  version = "1.0.0"
  minAppVersion = "1.6.0"
  url = "https://cdn.jsdelivr.net/gh/venera-app/venera-configs@main/hentaiera.js"

  base = "https://hentaiera.com"

  get headers() {
    return {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      "Accept-Language": "en-US,en;q=0.9",
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
    let items = doc.querySelectorAll(".galleries .thumb")
    for (let item of items) {
      let a = item.querySelector('a[href*="/gallery/"]')
      if (!a) continue
      let href = a.attributes["href"] || ""
      let m = href.match(/\/gallery\/(\d+)/)
      if (!m || seen[m[1]]) continue
      let img = item.querySelector("img")
      let titleEl = item.querySelector(".gallery_title a")
      let title = titleEl ? titleEl.text.trim() : ""
      if (!title && img) title = img.attributes["alt"] || ""
      if (!title) title = "Gallery " + m[1]

      seen[m[1]] = true
      comics.push(
        new Comic({
          id: m[1],
          title: title,
          cover: img
            ? this.absUrl(img.attributes["data-src"] || img.attributes["src"] || "")
            : "",
        }),
      )
    }
    doc.dispose()
    return comics
  }

  async loadList(path, page) {
    let sep = path.indexOf("?") === -1 ? "?" : "&"
    let url = this.base + path + sep + "page=" + page
    let res = await Network.get(url, this.headers)
    if (res.status !== 200) throw "请求失败: " + res.status
    let comics = this.parseList(res.body)
    return {
      comics: comics,
      maxPage: comics.length > 0 ? page + 1 : page,
    }
  }

  explore = [
    {
      title: "最新",
      type: "multiPageComicList",
      load: (page) => this.loadList("/", page),
    },
    ...[
      ["doujinshi", "同人志"],
      ["artist-cg", "Artist CG"],
      ["western", "Western"],
      ["image-set", "Image Set"],
    ].map(([slug, name]) => ({
      title: name,
      type: "multiPageComicList",
      load: (page) => this.loadList("/category/" + slug + "/", page),
    })),
  ]

  search = {
    load: async (keyword, options, page) => {
      let url =
        this.base + "/search/?q=" + encodeURIComponent(keyword) +
        "&page=" + page
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
    let url = this.base + "/gallery/" + id + "/"
    let res = await Network.get(url, this.headers)
    if (res.status !== 200) throw "请求失败: " + res.status
    let doc = new HtmlDocument(res.body)

    let titleEl = doc.querySelector(".gallery_first h1")
    let title = titleEl ? titleEl.text.trim() : "Gallery " + id

    let img = doc.querySelector(".left_cover img")
    let cover = img
      ? this.absUrl(img.attributes["data-src"] || img.attributes["src"] || "")
      : ""

    let tags = []
    let tagEls = doc.querySelectorAll(".info_tags .item_name")
    for (let a of tagEls) {
      let t = a.text.trim()
      if (t && tags.indexOf(t) === -1) tags.push(t)
    }

    let pageCount = 1
    let pageInput = doc.querySelector("#load_pages")
    if (pageInput) {
      let n = parseInt(pageInput.attributes["value"] || "1")
      if (!isNaN(n) && n > 0) pageCount = n
    }
    doc.dispose()

    return new ComicDetails({
      title: title,
      subtitle: "",
      cover: cover,
      description: "",
      tags: tags,
      url: url,
      chapters: { "1": "全一话（共" + pageCount + "页）" },
    })
  }

  // ---------- 阅读 ----------

  async fetchViewImage(id, page) {
    let url = this.base + "/view/" + id + "/" + page + "/"
    let res = await Network.get(url, this.headers)
    if (res.status !== 200) return ""
    let m = res.body.match(/id="gimg"[^>]*data-src="([^"]+)"/)
    if (m) return this.absUrl(m[1])
    m = res.body.match(/<img[^>]+data-src="([^"]+)"[^>]*class="[^"]*image_/)
    return m ? this.absUrl(m[1]) : ""
  }

  splitImageUrl(url) {
    let m = url.match(/^(.*?)(\d+)(\.[A-Za-z0-9]+)$/)
    if (!m) return null
    return { prefix: m[1], number: m[2], ext: m[3] }
  }

  async loadEp(comicId, epId) {
    let first = await this.fetchViewImage(comicId, 1)
    if (!first) throw "未找到图片"

    let res = await Network.get(this.base + "/gallery/" + comicId + "/", this.headers)
    let pageCount = 1
    if (res.status === 200) {
      let m = res.body.match(/id="load_pages"[^>]*value="(\d+)"/)
      if (m) pageCount = parseInt(m[1])
    }
    if (pageCount <= 1) return { images: [first] }

    let firstParts = this.splitImageUrl(first)
    let second = await this.fetchViewImage(comicId, 2)
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
      for (let i = 0; i < pageCount; i++) {
        let num = String(start + i)
        while (num.length < pad) num = "0" + num
        images.push(firstParts.prefix + num + firstParts.ext)
      }
      return { images: images }
    }

    let images = [first]
    for (let p = 2; p <= pageCount; p++) {
      let img = await this.fetchViewImage(comicId, p)
      if (img) images.push(img)
    }
    return { images: images }
  }
}
