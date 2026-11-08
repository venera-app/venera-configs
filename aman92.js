/** @type {import('./_venera_.js')} */
// A漫 (aman92.com, aman8.org 跳转)
// 图源参考: yckceo 异次元图源 id=870
// 站点为传统 HTML 页面, 无需登录; 章节图片直接放在 img[data-index][data-src]。
class AMan92 extends ComicSource {
  name = "A漫";

  key = "aman92";

  version = "1.0.0";

  minAppVersion = "1.4.0";

  url = "https://cdn.jsdelivr.net/gh/venera-app/venera-configs@main/aman92.js";

  baseUrl = "https://aman92.com";

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
    const link =
      item.querySelector("a.hl-item-thumb") || item.querySelector("a");
    const img = item.querySelector("img");
    let cover =
      link?.attributes["data-original"] ||
      img?.attributes["data-original"] ||
      img?.attributes["data-src"] ||
      img?.attributes["src"] ||
      "";
    if (cover.startsWith("//")) {
      cover = "https:" + cover;
    }
    const title =
      link?.attributes["title"] ||
      item.querySelector(".hl-item-title a")?.text ||
      "";
    return new Comic({
      id: link?.attributes["href"] || "",
      title: title.replace(/\s+/g, " ").trim(),
      cover: cover,
      subTitle:
        item
          .querySelector(".hl-item-sub")
          ?.text?.replace(/\s+/g, " ")
          .trim() || "",
    });
  }

  parseList(doc, selector) {
    return doc
      .querySelectorAll(selector)
      .map((item) => this.parseComic(item))
      .filter((comic) => comic.id && comic.title);
  }

  parseMaxPage(doc) {
    let max = 1;
    for (const a of doc.querySelectorAll("a")) {
      const href = a.attributes["href"] || "";
      const match = href.match(/\/page\/(\d+)/);
      if (match) {
        max = Math.max(max, parseInt(match[1], 10));
      }
    }
    return max;
  }

  async loadCata(name, page) {
    const path = `/bookcata/${encodeURIComponent(
      name
    )}/ob/time/st/all/page/${page}`;
    const doc = await this.getDoc(path);
    return {
      comics: this.parseList(doc, "ul.hl-vod-list li"),
      maxPage: this.parseMaxPage(doc),
    };
  }

  explore = [
    {
      title: "韩漫",
      type: "multiPageComicList",
      load: async (page) => this.loadCata("韩漫", page || 1),
    },
    {
      title: "日漫",
      type: "multiPageComicList",
      load: async (page) => this.loadCata("日漫", page || 1),
    },
    {
      title: "3D漫画",
      type: "multiPageComicList",
      load: async (page) => this.loadCata("3D漫画", page || 1),
    },
  ];

  search = {
    load: async (keyword, options, page) => {
      const path =
        page <= 1
          ? `/cata.php?key=${encodeURIComponent(keyword)}`
          : `/findbook/${encodeURIComponent(keyword)}/page/${page}`;
      const doc = await this.getDoc(path);
      return {
        comics: this.parseList(doc, "ul.hl-vod-list li"),
        maxPage: this.parseMaxPage(doc),
      };
    },

    enableTagsSuggestions: false,
  };

  comic = {
    loadInfo: async (id) => {
      const doc = await this.getDoc(id);
      const title =
        doc.querySelector("h1.hl-dc-title")?.text?.replace(/\s+/g, " ").trim() ||
        "";
      let cover =
        doc.querySelector(".hl-dc-pic span")?.attributes["data-original"] || "";
      if (cover.startsWith("//")) {
        cover = "https:" + cover;
      }

      const tags = {};
      let author = "";
      let description = "";
      let genres = [];
      for (const li of doc.querySelectorAll("li")) {
        const label =
          li.querySelector("em")?.text?.replace(/\s+/g, "").trim() || "";
        if (label.startsWith("作者")) {
          author =
            li
              .querySelector("a")
              ?.text?.replace(/\s+/g, " ")
              .trim() || "";
        } else if (label.startsWith("TAG")) {
          genres = li
            .querySelectorAll("a")
            .map((a) => a.text.trim())
            .filter((name) => name.length > 0);
        } else if (label.startsWith("简介")) {
          const text = li.text.replace(/\s+/g, " ").trim();
          const index = text.indexOf("简介：");
          description =
            index >= 0 ? text.substring(index + 3).trim() : text;
        }
      }
      if (author) {
        tags["作者"] = [author];
      }
      if (genres.length > 0) {
        tags["类型"] = genres;
      }

      const chapters = {};
      for (const a of doc.querySelectorAll("a.module-play-list-link")) {
        const href = a.attributes["href"];
        if (!href || chapters[href]) {
          continue;
        }
        const name =
          a.attributes["title"]?.replace(/\s+/g, " ").trim() ||
          a.text.replace(/\s+/g, " ").trim();
        if (name) {
          chapters[href] = name;
        }
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
        .querySelectorAll("img[data-index]")
        .map((img) => img.attributes["data-src"] || img.attributes["src"])
        .filter((url) => !!url);
      if (images.length === 0) {
        throw "No images found";
      }
      return { images: images };
    },

    onImageLoad: (url, comicId, epId) => {
      return {
        url: url,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
          Referer: "https://aman92.com/",
        },
      };
    },
  };
}
