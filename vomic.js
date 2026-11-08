/**
 * vomic漫 (vomicmh.com)
 *
 * 站点前端是 Next.js，数据来自 https://api.vomicmh.com/pics_new/pics。
 * API 有自定义签名（t + s），算法参考 Keiyoushi 的 Vomic 扩展：
 *   payload = 非空查询参数按 key 排序后拼成 k=v&k=v
 *   data    = base64(payload + t + SALT)
 *   s       = 自定义 32 位滚动哈希
 *
 * 注意：章节图片接口需要登录，未登录只能浏览列表和详情。
 */

class Vomic extends ComicSource {
  name = "vomic漫"
  key = "vomic"
  version = "1.0.1"
  minAppVersion = "1.6.0"
  url = "https://cdn.jsdelivr.net/gh/venera-app/venera-configs@main/vomic.js"

  base = "https://www.vomicmh.com"
  api = "https://api.vomicmh.com/pics_new/pics"

  SALT = "hhhasda"
  INITIAL_HASH = 2654435769

  get commonHeaders() {
    return {
      "User-Agent": "Dart/3.13 (dart:io)",
      platform: "android",
      "hide-content": "0",
      name: "pics",
      version: "1.2.1",
    }
  }

  // ---------- 签名 ----------

  utf8Bytes(str) {
    let bytes = []
    for (let i = 0; i < str.length; i++) {
      let c = str.charCodeAt(i)
      if (c < 0x80) {
        bytes.push(c)
      } else if (c < 0x800) {
        bytes.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f))
      } else if (c >= 0xd800 && c <= 0xdbff && i + 1 < str.length) {
        let c2 = str.charCodeAt(i + 1)
        if (c2 >= 0xdc00 && c2 <= 0xdfff) {
          let cp = 0x10000 + ((c - 0xd800) << 10) + (c2 - 0xdc00)
          bytes.push(
            0xf0 | (cp >> 18),
            0x80 | ((cp >> 12) & 0x3f),
            0x80 | ((cp >> 6) & 0x3f),
            0x80 | (cp & 0x3f),
          )
          i++
          continue
        }
        bytes.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f))
      } else {
        bytes.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f))
      }
    }
    return bytes
  }

  rotateLeft(x, n) {
    return ((x << n) | (x >>> (32 - n))) >>> 0
  }

  sign(params, timestamp) {
    let keys = Object.keys(params).sort()
    let parts = []
    for (let k of keys) {
      let v = params[k]
      if (v === undefined || v === null || v === "") continue
      parts.push(k + "=" + v)
    }
    let payload = parts.join("&")
    let encoded = Convert.encodeBase64(
      Convert.encodeUtf8(payload + timestamp + this.SALT),
    )

    let key = this.utf8Bytes(this.SALT)
    let hash = this.INITIAL_HASH

    for (let b of key) {
      hash = this.rotateLeft(hash ^ b, 7)
    }

    let data = this.utf8Bytes(encoded + timestamp + this.SALT)
    for (let i = 0; i < data.length; i++) {
      let k = key[i % key.length]
      let mix = i % 2 === 0 ? k * 8 : k >> 1
      hash = this.rotateLeft(hash ^ data[i], 5) ^ mix
      hash = hash >>> 0
    }

    for (let b of key) {
      hash = this.rotateLeft(hash ^ ((b * 16) >>> 0), 9)
    }

    let hex = hash.toString(16)
    while (hex.length < 8) hex = "0" + hex
    return hex
  }

  buildHeaders(params, withAuth) {
    let t = String(Math.floor(Date.now() / 1000))
    let s = this.sign(params, t)
    let headers = Object.assign({}, this.commonHeaders, { t: t, s: s })
    if (withAuth) {
      let token = this.loadData("token")
      if (token) headers["Authorization"] = "Bearer " + token
    }
    return headers
  }

  async apiGet(path, params, withAuth) {
    let keys = Object.keys(params)
    let query = []
    for (let k of keys) {
      let v = params[k]
      if (v === undefined || v === null || v === "") continue
      query.push(encodeURIComponent(k) + "=" + encodeURIComponent(v))
    }
    let url = this.api + path + (query.length ? "?" + query.join("&") : "")
    let res = await Network.get(url, this.buildHeaders(params, withAuth))
    return this.parseResult(res, path)
  }

  parseResult(res, label) {
    if (res.status === 401) throw "Login expired"
    let data
    try {
      data = JSON.parse(res.body)
    } catch (e) {
      throw label + " 返回异常"
    }
    if (data && data.message === "Unauthenticated.") throw "请先登录（在源设置中登录 vomic 账号）"
    if (!data || data.code !== 200) {
      throw label + " 失败: " + ((data && (data.message || data.code)) || res.status)
    }
    return data.data
  }

  // ---------- 账号 ----------

  account = {
    login: async (account, pwd) => {
      let params = {}
      let headers = this.buildHeaders(params, false)
      headers["Content-Type"] = "application/json"
      let res = await Network.post(
        this.api + "/login",
        headers,
        JSON.stringify({ identity: account, password: pwd }),
      )
      let data = this.parseResult(res, "登录")
      if (!data || !data.token) throw "登录失败"
      this.saveData("token", data.token)
      return "ok"
    },
    logout: () => {
      this.deleteData("token")
    },
    registerWebsite: "https://www.vomicmh.com",
  }

  // ---------- 列表 ----------

  parseComic(item) {
    let tags = []
    try {
      for (let c of item.cat || []) tags.push(c.name)
      for (let t of item.tag || []) tags.push(t.name)
    } catch (e) {}
    if (item.tags) {
      for (let t of String(item.tags).split(/\s+/)) {
        if (t) tags.push(t)
      }
    }
    return new Comic({
      id: String(item.id),
      title: item.name || "",
      cover: item.cover || "",
      tags: tags,
      description: item.intro || "",
      subTitle: item.author || "",
    })
  }

  async loadList(params, page, limit) {
    let p = Object.assign({ page: page, limit: limit }, params)
    let list = await this.apiGet("/c/getCartoonList", p, false)
    return {
      comics: (list || []).map((x) => this.parseComic(x)),
      maxPage: (list || []).length >= limit ? page + 1 : page,
    }
  }

  explore = [
    {
      title: "热门",
      type: "multiPageComicList",
      load: (page) => this.loadList({ sort: "hot_value" }, page, 20),
    },
    {
      title: "最新",
      type: "multiPageComicList",
      load: async (page) => {
        let list = await this.apiGet(
          "/c/getUpdateBook",
          { page: page, limit: 15 },
          false,
        )
        return {
          comics: (list || []).map((x) => this.parseComic(x)),
          maxPage: (list || []).length >= 15 ? page + 1 : page,
        }
      },
    },
    ...[
      ["4", "冒险"],
      ["5", "搞笑"],
      ["37", "恋爱"],
      ["12", "校园"],
      ["13", "百合"],
      ["22", "神鬼"],
      ["8", "爱情"],
      ["7", "科幻"],
    ].map(([id, name]) => ({
      title: name,
      type: "multiPageComicList",
      load: (page) => this.loadList({ cat_id: id }, page, 20),
    })),
  ]

  search = {
    load: (keyword, options, page) => {
      return this.loadList({ keyword: keyword }, page, 10)
    },
    optionList: [],
  }

  // ---------- 详情 ----------

  async loadInfo(id) {
    let data = await this.apiGet(
      "/c/getCartoonInfoV1",
      { car_id: id },
      false,
    )

    let tags = []
    for (let c of data.cat || []) tags.push(c.name)
    for (let t of data.tag || []) tags.push(t.name)
    if (data.tags) {
      for (let t of String(data.tags).split(/\s+/)) {
        if (t) tags.push(t)
      }
    }

    let chapters = {}
    for (let group of data.chapter_list || []) {
      for (let ep of group.values || []) {
        chapters[String(ep.id)] = ep.name || String(ep.id)
      }
    }

    let views = data.view_num || 0
    let likes = data.likes_num || 0
    let description =
      "👁️ " + views + " - ❤️ " + likes + "\n\n" + (data.intro || "")

    return new ComicDetails({
      title: data.name || "",
      subtitle: data.author || "",
      cover: data.cover || "",
      description: description,
      tags: tags,
      status: data.process || "",
      url: this.base + "/detail/" + id,
      chapters: chapters,
    })
  }

  // ---------- 阅读 ----------

  async loadEp(comicId, epId) {
    let data = await this.apiGet(
      "/c/getChapterInfo",
      { c_id: epId },
      true,
    )
    let images = []
    for (let img of data.img_list || []) {
      if (img && img.url) images.push(img.url)
    }
    if (images.length === 0) throw "未找到图片（可能需要登录或该章节受限）"
    return { images: images }
  }

  comic = {
    loadInfo: (id) => this.loadInfo(id),
    loadEp: (comicId, epId) => this.loadEp(comicId, epId),
  }
}
