/**
 * 神奇漫画 (shenqimanhua.net)
 *
 * 站点是 Next.js SSR：
 * - 列表页 /comics?sort=update|total&tag=...&page=N 直接输出漫画卡片
 * - 详情页 /comic/{id} 的 RSC 数据里包含完整章节列表
 * - 阅读页 /read/{comicId}/{chapterId} 的 RSC 数据里包含本章图片
 */

class ShenQiManHua extends ComicSource {
  name = "神奇漫画"
  key = "shenqimanhua"
  version = "1.0.0"
  minAppVersion = "1.6.0"
  url = "https://cdn.jsdelivr.net/gh/venera-app/venera-configs@main/shenqimanhua.js"

  base = "https://shenqimanhua.net"

  get headers() {
    return {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      "Accept-Language": "zh-CN,zh;q=0.9",
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
    let links = doc.querySelectorAll('a[href^="/comic/"]')
    for (let a of links) {
      let href = a.attributes["href"] || ""
      let m = href.match(/^\/comic\/([a-z0-9]+)/)
      if (!m || seen[m[1]]) continue
      let img = a.querySelector("img")
      if (!img) continue

      let title = (img.attributes["alt"] || "").trim()
      title = title.replace(/^《/, "").replace(/》封面$/, "").replace(/》$/, "")
      if (!title) {
        let textEl = a.querySelector(".line-clamp-1")
        if (textEl) title = textEl.text.trim()
      }
      if (!title) title = m[1]

      seen[m[1]] = true
      comics.push(
        new Comic({
          id: m[1],
          title: title,
          cover: this.absUrl(img.attributes["src"] || ""),
        }),
      )
    }

    let maxPage = 1
    let pageLinks = doc.querySelectorAll('a[href*="page="]')
    for (let a of pageLinks) {
      let href = a.attributes["href"] || ""
      let pm = href.match(/page=(\d+)/)
      if (pm) maxPage = Math.max(maxPage, parseInt(pm[1]))
    }
    doc.dispose()
    return { comics: comics, maxPage: maxPage }
  }

  async loadList(params, page) {
    let url = this.base + "/comics?sort=" + params.sort
    if (params.tag) url += "&tag=" + encodeURIComponent(params.tag)
    url += "&page=" + page
    let res = await Network.get(url, this.headers)
    if (res.status !== 200) throw "请求失败: " + res.status
    let data = this.parseList(res.body)
    if (page > 1 && data.comics.length === 0) data.maxPage = page
    return data
  }

  explore = [
    {
      title: "最近更新",
      type: "multiPageComicList",
      load: (page) => this.loadList({ sort: "update" }, page),
    },
    {
      title: "人气",
      type: "multiPageComicList",
      load: (page) => this.loadList({ sort: "total" }, page),
    },
    ...[
      "校园",
      "奇幻",
      "恋爱",
      "热血",
      "冒险",
      "搞笑",
      "战斗",
      "悬疑",
    ].map((tag) => ({
      title: tag,
      type: "multiPageComicList",
      load: (page) => this.loadList({ sort: "total", tag: tag }, page),
    })),
  ]

  search = {
    load: async (keyword, options, page) => {
      let url =
        this.base +
        "/search?query=" + encodeURIComponent(keyword) +
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

  decodeRsc(body) {
    // Next.js 的 RSC payload 在 HTML 中是 \" 转义形式
    return body.replace(/\\"/g, '"')
  }

  async loadInfo(id) {
    let res = await Network.get(this.base + "/comic/" + id, this.headers)
    if (res.status !== 200) throw "请求失败: " + res.status
    let doc = new HtmlDocument(res.body)

    let titleEl = doc.querySelector('h1[itemprop="name"]')
    let title = titleEl ? titleEl.text.trim() : ""

    let cover = ""
    let coverMeta = doc.querySelector('meta[property="og:comic:cover"]')
    if (coverMeta) cover = coverMeta.attributes["content"] || ""
    if (!cover) {
      let img = doc.querySelector('img[alt*="封面"]')
      if (img) cover = img.attributes["src"] || ""
    }

    let authors = []
    let authorEls = doc.querySelectorAll('a[itemprop="author"] span[itemprop="name"]')
    for (let a of authorEls) {
      let t = a.text.trim()
      if (t) authors.push(t)
    }

    let tags = []
    let tagEls = doc.querySelectorAll('[itemprop="genre"] a')
    for (let a of tagEls) {
      let t = a.text.trim()
      if (t && tags.indexOf(t) === -1) tags.push(t)
    }

    let status = ""
    let statusMeta = doc.querySelector('meta[property="og:comic:status"]')
    if (statusMeta) {
      let s = statusMeta.attributes["content"] || ""
      status = s === "ongoing" ? "连载中" : s === "completed" ? "已完结" : s
    }

    let description = ""
    let descMeta = doc.querySelector('meta[name="description"]')
    if (descMeta) {
      description = descMeta.attributes["content"] || ""
      description = description
        .replace(/^《.*?》免费在线阅读。漫画剧情简介：/, "")
        .replace(/^《.*?》.*?简介：/, "")
    }

    let decoded = this.decodeRsc(res.body)
    let chapters = {}
    let start = decoded.indexOf('"chapters":[')
    if (start !== -1) {
      let end = decoded.indexOf("]", start)
      let block = decoded.substring(start, end + 1)
      let chapterMatches = block.match(
        /\{"id":"([a-z0-9]+)","title":"([^"]+)","number":(\d+)/g,
      )
      if (chapterMatches) {
        for (let item of chapterMatches) {
          let m = item.match(/\{"id":"([a-z0-9]+)","title":"([^"]+)","number":(\d+)/)
          if (m) chapters[m[1]] = m[2]
        }
      }
    }
    doc.dispose()

    return new ComicDetails({
      title: title,
      subtitle: authors.join(" / "),
      cover: this.absUrl(cover),
      description: description,
      tags: tags,
      status: status,
      url: this.base + "/comic/" + id,
      chapters: chapters,
    })
  }

  // ---------- 阅读 ----------

  async loadEp(comicId, epId) {
    let res = await Network.get(
      this.base + "/read/" + comicId + "/" + epId,
      this.headers,
    )
    if (res.status !== 200) throw "请求失败: " + res.status

    let decoded = this.decodeRsc(res.body)
    let images = []
    let block = decoded.match(/"images":\[(.*?)\]/)
    if (block) {
      let matches = block[1].match(/"url":"(\/image\/[^"]+)"/g)
      if (matches) {
        let seen = {}
        for (let item of matches) {
          let m = item.match(/"url":"([^"]+)"/)
          if (m && !seen[m[1]]) {
            seen[m[1]] = true
            images.push(this.absUrl(m[1]))
          }
        }
      }
    }

    if (images.length === 0) {
      // 兜底：直接扫描符合图片目录规则的 URL
      let matches = decoded.match(/\/image\/[^"\\]+\/img\/\d+\.(?:webp|jpg|jpeg|png)/g)
      if (matches) {
        let seen = {}
        for (let u of matches) {
          if (!seen[u]) {
            seen[u] = true
            images.push(this.absUrl(u))
          }
        }
      }
    }

    if (images.length === 0) throw "未找到图片"
    return { images: images }
  }
}
