/**
 * Rawkuma (rawkuma.net)
 *
 * 站点使用 WordPress + NatsuId 主题：
 * - 列表/详情可以通过 WP REST API 获取：/wp-json/wp/v2/manga?slug[]=...&_embed
 * - 搜索可以直接使用 WP REST 的 search 参数
 * - 热门列表走 admin-ajax 的 advanced_search，需要先取 nonce
 * - 章节列表走 admin-ajax 的 chapter_list
 * - 阅读页图片在 section[data-image-data] 下的 img 中
 */

class Rawkuma extends ComicSource {
  name = "Rawkuma"
  key = "rawkuma"
  version = "1.0.0"
  minAppVersion = "1.6.0"
  url = "https://cdn.jsdelivr.net/gh/venera-app/venera-configs@main/rawkuma.js"

  base = "https://rawkuma.net"
  api = "https://rawkuma.net/wp-json/wp/v2"

  get headers() {
    return {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      "Accept-Language": "en-US,en;q=0.9",
    }
  }

  get ajaxHeaders() {
    return {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
      "X-Requested-With": "XMLHttpRequest",
      "Referer": this.base + "/",
    }
  }

  // ---------- utils ----------

  stripHtml(html) {
    if (!html) return ""
    return html
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&#8217;/g, "'")
      .replace(/&#8216;/g, "'")
      .replace(/&#8220;/g, '"')
      .replace(/&#8221;/g, '"')
      .replace(/&#8211;/g, "-")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'")
      .replace(/&hellip;/g, "...")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  }

  getCover(item) {
    try {
      let media = item._embedded["wp:featuredmedia"]
      if (media && media.length > 0) {
        return media[0].source_url || ""
      }
    } catch (e) {}
    return ""
  }

  getTerms(item, taxonomy) {
    let result = []
    try {
      let groups = item._embedded["wp:term"] || []
      for (let group of groups) {
        for (let term of group) {
          if (term.taxonomy === taxonomy) result.push(term.name)
        }
      }
    } catch (e) {}
    return result
  }

  parseComic(item) {
    return new Comic({
      id: item.slug,
      title: this.stripHtml(item.title.rendered),
      cover: this.getCover(item),
    })
  }

  async getMangaList(url, page) {
    let res = await Network.get(url, this.headers)
    if (res.status !== 200) throw "请求失败: " + res.status
    let data = JSON.parse(res.body)

    let maxPage = page + (data.length >= 24 ? 1 : 0)
    try {
      let total = res.headers["x-wp-totalpages"] || res.headers["X-WP-TotalPages"]
      let n = parseInt(total)
      if (!isNaN(n) && n > 0) maxPage = n
    } catch (e) {}

    return {
      comics: data.map((x) => this.parseComic(x)),
      maxPage: maxPage,
    }
  }

  // ---------- 热门 / 搜索 ----------

  cachedNonce = null

  async getNonce() {
    if (this.cachedNonce) return this.cachedNonce
    let res = await Network.get(
      this.base + "/wp-admin/admin-ajax.php?type=search_form&action=get_nonce",
      this.ajaxHeaders,
    )
    if (res.status !== 200) throw "获取 nonce 失败"
    let m = res.body.match(/name=['"]search_nonce['"]\s+value=['"]([^'"]+)/)
    if (!m) throw "无法解析 nonce"
    this.cachedNonce = m[1]
    return this.cachedNonce
  }

  async advancedSearch(page, orderby, query) {
    let nonce = await this.getNonce()
    let body =
      "nonce=" + encodeURIComponent(nonce) +
      "&inclusion=OR&exclusion=OR" +
      "&page=" + page +
      "&genre=[]&genre_exclude=[]&author=[]&artist=[]" +
      "&project=0&type=[]&status=[]" +
      "&order=desc&orderby=" + encodeURIComponent(orderby) +
      "&query=" + encodeURIComponent(query || "")

    let res = await Network.post(
      this.base + "/wp-admin/admin-ajax.php?action=advanced_search",
      this.ajaxHeaders,
      body,
    )
    if (res.status !== 200) throw "请求失败: " + res.status

    let doc = new HtmlDocument(res.body)
    let comics = []
    let seen = {}
    let links = doc.querySelectorAll('a[href*="/manga/"]')
    for (let a of links) {
      let href = a.attributes["href"] || ""
      let m = href.match(/\/manga\/([^\/?#]+)\//)
      if (!m || seen[m[1]]) continue
      let img = a.querySelector("img")
      if (!img) continue
      seen[m[1]] = true
      comics.push(
        new Comic({
          id: m[1],
          title: (img.attributes["alt"] || m[1]).trim(),
          cover:
            img.attributes["src"] ||
            img.attributes["data-src"] ||
            "",
        }),
      )
    }
    let hasNext = false
    let pageBtns = res.body.match(/\]\('page',\s*'(\d+)'/g)
    if (pageBtns) {
      for (let item of pageBtns) {
        let pm = item.match(/'(\d+)'/)
        if (pm && parseInt(pm[1]) > page) hasNext = true
      }
    }
    doc.dispose()
    return { comics: comics, maxPage: hasNext ? page + 1 : page }
  }

  // ---------- 分类 ----------

  genres = null

  async getGenres() {
    if (this.genres) return this.genres
    let res = await Network.get(
      this.api + "/genre?per_page=100&orderby=count&order=desc",
      this.headers,
    )
    if (res.status !== 200) throw "获取分类失败"
    let list = JSON.parse(res.body)
    let map = {}
    for (let g of list) map[g.slug] = g.id
    this.genres = map
    return map
  }

  async loadGenre(slug, page) {
    let map = await this.getGenres()
    let id = map[slug]
    if (!id) throw "分类不存在: " + slug
    return await this.getMangaList(
      this.api + "/manga?genre=" + id + "&page=" + page + "&per_page=24&_embed",
      page,
    )
  }

  // ---------- 发现页 ----------

  explore = [
    {
      title: "最近更新",
      type: "multiPageComicList",
      load: (page) => {
        return this.getMangaList(
          this.api +
            "/manga?page=" + page +
            "&per_page=24&orderby=date&order=desc&_embed",
          page,
        )
      },
    },
    {
      title: "热门",
      type: "multiPageComicList",
      load: (page) => {
        return this.advancedSearch(page, "popular", "")
      },
    },
    ...[
      ["action", "Action"],
      ["adventure", "Adventure"],
      ["comedy", "Comedy"],
      ["drama", "Drama"],
      ["fantasy", "Fantasy"],
      ["horror", "Horror"],
      ["isekai", "Isekai"],
      ["romance", "Romance"],
      ["sci-fi", "Sci-Fi"],
      ["slice-of-life", "Slice of Life"],
      ["supernatural", "Supernatural"],
      ["thriller", "Thriller"],
    ].map(([slug, name]) => ({
      title: name,
      type: "multiPageComicList",
      load: (page) => this.loadGenre(slug, page),
    })),
  ]

  search = {
    load: (keyword, options, page) => {
      return this.getMangaList(
        this.api +
          "/manga?search=" + encodeURIComponent(keyword) +
          "&page=" + page +
          "&per_page=24&orderby=date&order=desc&_embed",
        page,
      )
    },
    optionList: [],
  }

  // ---------- 详情 ----------

  async loadInfo(id) {
    let res = await Network.get(
      this.api + "/manga?slug[]=" + encodeURIComponent(id) + "&_embed",
      this.headers,
    )
    if (res.status !== 200) throw "请求失败: " + res.status
    let list = JSON.parse(res.body)
    if (!list || list.length === 0) throw "漫画不存在"
    let item = list[0]

    let authors = this.getTerms(item, "series-author")
    let artists = this.getTerms(item, "artist")
    let genres = this.getTerms(item, "genre")
    let status = this.getTerms(item, "status")[0] || ""
    let type = this.getTerms(item, "type")[0] || ""

    let tags = genres.slice()
    if (type) tags.push(type)

    let meta = item.meta || {}
    let alt = meta.alternative_title || ""
    let description = this.stripHtml(item.content.rendered)
    if (alt) description = "别名: " + alt + "\n\n" + description

    let chapters = await this.loadChapters(item.id)
    return new ComicDetails({
      title: this.stripHtml(item.title.rendered),
      subtitle: authors.join(" / "),
      cover: this.getCover(item),
      description: description,
      tags: tags,
      status: status,
      url: item.link,
      chapters: chapters,
    })
  }

  async loadChapters(mangaId) {
    let res = await Network.get(
      this.base +
        "/wp-admin/admin-ajax.php?manga_id=" + mangaId +
        "&page=" + Math.floor(Math.random() * 9000 + 1000) +
        "&action=chapter_list",
      this.ajaxHeaders,
    )
    if (res.status !== 200) throw "获取章节失败"
    let doc = new HtmlDocument(res.body)
    let chapters = {}
    let links = doc.querySelectorAll('a[href*="/chapter-"]')
    for (let a of links) {
      let href = a.attributes["href"] || ""
      if (!href) continue
      let nameEl = a.querySelector("span")
      let name = nameEl ? nameEl.text.trim() : href.split("/").slice(-2, -1)[0]
      if (!name) continue
      chapters[href] = name
    }
    doc.dispose()
    return chapters
  }

  // ---------- 阅读 ----------

  async loadEp(comicId, epId) {
    let url = epId.indexOf("http") === 0 ? epId : this.base + epId
    let res = await Network.get(url, this.headers)
    if (res.status !== 200) throw "请求失败: " + res.status
    let doc = new HtmlDocument(res.body)
    let images = []
    let imgs = doc.querySelectorAll("section[data-image-data] img")
    for (let img of imgs) {
      let src = img.attributes["src"] || img.attributes["data-src"] || ""
      if (src) images.push(src)
    }
    doc.dispose()
    if (images.length === 0) throw "未找到图片"
    return { images: images }
  }

  onImageLoad(url) {
    return { url: url }
  }
}
