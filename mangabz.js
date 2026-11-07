/**
 * Mangabz (mangabz.com)
 *
 * - 列表 /manga-list-pN/、最近更新 /manga-list-0-0-2-pN/
 * - 详情 /{id}bz/（例如 /54bz/），章节 /m{chapterId}/
 * - 阅读页本身不直接给图片，每页图片由
 *   /m{cid}/chapterimage.ashx?cid={cid}&page={page}
 *   返回一段 Dean Edwards packed JS，解包后得到 pix、路径数组和查询串。
 */

class Mangabz extends ComicSource {
  name = "Mangabz"
  key = "mangabz"
  version = "1.0.0"
  minAppVersion = "1.6.0"
  url = "https://cdn.jsdelivr.net/gh/venera-app/venera-configs@main/mangabz.js"

  base = "https://www.mangabz.com"

  get headers() {
    return {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0",
      "Accept-Language": "zh-CN,zh;q=0.9",
      Referer: this.base + "/",
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
    let items = doc.querySelectorAll(".mh-item")
    for (let item of items) {
      let a = item.querySelector(".title a") || item.querySelector("a")
      if (!a) continue
      let href = a.attributes["href"] || ""
      let m = href.match(/^\/([0-9]+bz)\//)
      if (!m || seen[m[1]]) continue
      let img = item.querySelector("img.mh-cover") || item.querySelector("img")
      let title = a.text.trim() || a.attributes["title"] || m[1]
      seen[m[1]] = true
      comics.push(
        new Comic({
          id: m[1],
          title: title,
          cover: img ? this.absUrl(img.attributes["src"] || "") : "",
        }),
      )
    }

    let maxPage = 1
    let pageEls = doc.querySelectorAll(".page-pagination a")
    for (let a of pageEls) {
      let idx = parseInt(a.attributes["data-index"] || "")
      if (!isNaN(idx)) maxPage = Math.max(maxPage, idx)
    }
    doc.dispose()
    return { comics: comics, maxPage: maxPage }
  }

  async loadList(path, page) {
    let url = this.base + path
    let res = await Network.get(url, this.headers)
    if (res.status !== 200) throw "请求失败: " + res.status
    let data = this.parseList(res.body)
    if (data.comics.length === 0) data.maxPage = page
    return data
  }

  explore = [
    {
      title: "漫画大全",
      type: "multiPageComicList",
      load: (page) =>
        this.loadList(page === 1 ? "/manga-list/" : "/manga-list-p" + page + "/", page),
    },
    {
      title: "最近更新",
      type: "multiPageComicList",
      load: (page) => this.loadList("/manga-list-0-0-2-p" + page + "/", page),
    },
  ]

  search = {
    load: async (keyword, options, page) => {
      let url =
        this.base + "/search?title=" + encodeURIComponent(keyword) +
        "&page=" + page
      let res = await Network.get(url, this.headers)
      if (res.status !== 200) throw "请求失败: " + res.status
      let data = this.parseList(res.body)
      if (data.comics.length === 0) data.maxPage = page
      return data
    },
    optionList: [],
  }

  // ---------- 详情 ----------

  async loadInfo(id) {
    let url = this.base + "/" + id + "/"
    let res = await Network.get(url, this.headers)
    if (res.status !== 200) throw "请求失败: " + res.status
    let doc = new HtmlDocument(res.body)

    let titleEl = doc.querySelector(".detail-info-title")
    let title = titleEl ? titleEl.text.trim() : id

    let coverEl = doc.querySelector(".detail-info-cover")
    let cover = coverEl ? this.absUrl(coverEl.attributes["src"] || "") : ""

    let author = ""
    let authorEl = doc.querySelector(".detail-info-tip a")
    if (authorEl) author = authorEl.text.trim()

    let status = ""
    let tipEls = doc.querySelectorAll(".detail-info-tip span")
    for (let s of tipEls) {
      let t = s.text.trim()
      if (t.indexOf("狀態") === 0 || t.indexOf("状态") === 0) {
        status = t.replace(/^[^：:]*[：:]/, "").trim()
      }
    }

    let tags = []
    let tagEls = doc.querySelectorAll(".detail-info-tip .item")
    for (let s of tagEls) {
      let t = s.text.trim()
      if (t) tags.push(t)
    }

    let descEl = doc.querySelector(".detail-info-content")
    let description = descEl ? descEl.text.trim() : ""

    let chapters = {}
    let chapterEls = doc.querySelectorAll("#chapterlistload a")
    for (let a of chapterEls) {
      let href = a.attributes["href"] || ""
      if (!/^\/m\d+\//.test(href)) continue
      let name = a.text.replace(/（\d+P）/g, "").trim()
      if (!name) name = href
      chapters[href] = name
    }
    doc.dispose()

    return new ComicDetails({
      title: title,
      subtitle: author,
      cover: cover,
      description: description,
      tags: tags,
      status: status,
      url: url,
      chapters: chapters,
    })
  }

  // ---------- 阅读 ----------

  unpack(source) {
    let m = source.match(/\}\('([\s\S]*?)',(\d+),(\d+),'([\s\S]*?)'\.split\('\|'\)/)
    if (!m) return ""

    let p = m[1]
    let a = parseInt(m[2])
    let c = parseInt(m[3])
    let k = m[4].split("|")
    let d = {}

    let e = function (c) {
      return (
        (c < a ? "" : e(parseInt(c / a))) +
        ((c = c % a) > 35
          ? String.fromCharCode(c + 29)
          : c.toString(36))
      )
    }

    while (c--) {
      if (k[c]) d[e(c)] = k[c]
    }

    return p.replace(/\b\w+\b/g, function (w) {
      return d[w] !== undefined ? d[w] : w
    })
  }

  parseImageScript(body) {
    let code = this.unpack(body)
    if (!code) return []
    code = code.replace(/\\"/g, '"').replace(/\\'/g, "'")

    let pixMatch = code.match(/pix="([^"]+)"/)
    let pathMatch = code.match(/pvalue=\["([^\]]*)"\]/)
    let queryMatch = code.match(/\+\\?'(\?[^'\\]+)/)
    if (!pixMatch || !pathMatch) return []

    let pix = pixMatch[1]
    let query = queryMatch ? queryMatch[1] : ""
    let paths = []
    let pathRaw = pathMatch[1]

    // pathMatch 的捕获从第一个路径开始（不含开头引号），路径之间用 "," 分隔
    for (let part of pathRaw.split('","')) {
      let s = part.replace(/^"|"$/g, "").trim()
      if (s) paths.push(s)
    }

    return paths.map((p) => this.absUrl(pix + p + query))
  }

  async fetchPageScript(epId, cid, page) {
    let url = this.base + epId + "chapterimage.ashx?cid=" + cid + "&page=" + page
    let res = await Network.get(url, this.headers)
    if (res.status !== 200) return []
    return this.parseImageScript(res.body)
  }

  async loadEp(comicId, epId) {
    let res = await Network.get(this.base + epId, this.headers)
    if (res.status !== 200) throw "请求失败: " + res.status

    let cidMatch = res.body.match(/var\s+MANGABZ_CID\s*=\s*(\d+)/)
    let countMatch = res.body.match(/var\s+MANGABZ_IMAGE_COUNT\s*=\s*(\d+)/)
    if (!cidMatch || !countMatch) throw "无法解析章节信息"

    let cid = cidMatch[1]
    let count = parseInt(countMatch[1])
    let images = []
    let seen = {}

    // 每个 page 返回 2 张（page 1 -> 1,2；page 2 -> 2,3），先取奇数页
    for (let p = 1; p <= count; p += 2) {
      let list = await this.fetchPageScript(epId, cid, p)
      for (let img of list) {
        if (!seen[img]) {
          seen[img] = true
          images.push(img)
        }
      }
      if (images.length >= count) break
    }

    // 如果数量不足，再补偶数页
    if (images.length < count) {
      for (let p = 2; p <= count; p += 2) {
        let list = await this.fetchPageScript(epId, cid, p)
        for (let img of list) {
          if (!seen[img]) {
            seen[img] = true
            images.push(img)
          }
        }
        if (images.length >= count) break
      }
    }

    if (images.length === 0) throw "未找到图片"
    return { images: images.slice(0, count) }
  }

  onImageLoad(url) {
    return {
      url: url,
      headers: { Referer: this.base + "/" },
    }
  }
}
