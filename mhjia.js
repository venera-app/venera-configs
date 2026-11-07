/** @type {import('./_venera_.js')} */
// 漫画家 (mhjia.com)
// 图源参考: https://www.yckceo.com/yiciyuan/tuyuan/content/id/944.html 同站的异次元规则
// 站点为传统 HTML 页面, 无需登录; 章节图片直接放在 img.comic_img[data-original] 上。
class ManHuaJia extends ComicSource {
  name = "漫画家";

  key = "mhjia";

  version = "1.0.0";

  minAppVersion = "1.4.0";

  url = "https://cdn.jsdelivr.net/gh/venera-app/venera-configs@main/mhjia.js";

  baseUrl = "https://mhjia.com";

  get headers() {
    return {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
      Referer: this.baseUrl + "/",
    };
  }

  async getDoc(path) {
    const url = path.startsWith("http") ? path : this.baseUrl + path;
    const res = await Network.get(url, this.headers);
    if (res.status !== 200) {
      throw `Invalid status code: ${res.status}`;
    }
    return new HtmlDocument(res.body);
  }

  parseComic(item) {
    const link = item.querySelector("a");
    const img = item.querySelector("img");
    let title =
      link?.attributes["title"] || item.querySelector("h3")?.text || "";
    title = title.trim();
    let cover =
      img?.attributes["src"] || img?.attributes["data-src"] || "";
    if (cover.startsWith("//")) {
      cover = "https:" + cover;
    }
    const status =
      item.querySelector(".tt-status a")?.text?.replace(/\s+/g, " ").trim() ||
      "";
    return new Comic({
      id: link?.attributes["href"] || "",
      title: title,
      cover: cover,
      subTitle: status,
    });
  }

  parseList(doc) {
    return doc
      .querySelectorAll(".home-truyendecu")
      .map((item) => this.parseComic(item))
      .filter((comic) => comic.id && comic.title);
  }

  parseMaxPage(doc, section) {
    let max = 1;
    const re = new RegExp(`${section}/index_(\\d+)\\.html`);
    for (const a of doc.querySelectorAll("a")) {
      const href = a.attributes["href"] || "";
      const match = href.match(re);
      if (match) {
        max = Math.max(max, parseInt(match[1], 10));
      }
    }
    return max;
  }

  async loadList(section, page) {
    const path = page <= 1 ? `/${section}/` : `/${section}/index_${page}.html`;
    const doc = await this.getDoc(path);
    return {
      comics: this.parseList(doc),
      maxPage: this.parseMaxPage(doc, section),
    };
  }

  // 发现页
  explore = [
    {
      title: "最近更新",
      type: "multiPageComicList",
      load: async (page) => this.loadList("latest", page || 1),
    },
    {
      title: "热门排行",
      type: "multiPageComicList",
      load: async (page) => this.loadList("popular", page || 1),
    },
    {
      title: "完本漫画",
      type: "multiPageComicList",
      load: async (page) => this.loadList("completed", page || 1),
    },
  ];

  search = {
    load: async (keyword, options, page) => {
      const doc = await this.getDoc(
        `/e/search/index.php?keyboard=${encodeURIComponent(
          keyword
        )}&show=title,writer,byr&searchget=1`
      );
      return {
        comics: this.parseList(doc),
        maxPage: 1,
      };
    },

    enableTagsSuggestions: false,
  };

  comic = {
    loadInfo: async (id) => {
      const doc = await this.getDoc(id);
      const title = doc.querySelector("h3.title")?.text?.trim() || "";
      let cover = doc.querySelector(".book img")?.attributes["src"] || "";
      if (cover.startsWith("//")) {
        cover = "https:" + cover;
      }
      const description =
        doc.querySelector(".desc-text")?.text?.replace(/\s+/g, " ").trim() ||
        "";

      const tags = {};
      const author = doc
        .querySelector(".info-chitiet a[itemprop='author']")
        ?.text?.trim();
      if (author) {
        tags["作者"] = [author];
      }
      const genres = doc
        .querySelectorAll(".info-chitiet a[itemprop='genre']")
        .map((a) => a.text.trim())
        .filter((name) => name.length > 0);
      if (genres.length > 0) {
        tags["类型"] = genres;
      }

      // #list-chapter 是完整章节列表(升序), #chaplist 只是"最新话",
      // 只取前者可以避免重复章节。
      const chapters = {};
      for (const li of doc.querySelectorAll("#list-chapter .list-chapter li")) {
        const a = li.querySelector("a");
        const href = a?.attributes["href"];
        if (!href) {
          continue;
        }
        chapters[href] = a.text.replace(/\s+/g, " ").trim();
      }

      return {
        title: title,
        cover: cover,
        description: description,
        tags: tags,
        chapters: chapters,
      };
    },

    loadEp: async (comicId, epId) => {
      const doc = await this.getDoc(epId);
      const images = doc
        .querySelectorAll("img.comic_img")
        .map((img) => img.attributes["data-original"])
        .filter((url) => !!url);
      if (images.length === 0) {
        throw "No images found";
      }
      return { images };
    },

    onImageLoad: (url, comicId, epId) => {
      return {
        url: url,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
          Referer: "https://mhjia.com/",
        },
      };
    },
  };
}
