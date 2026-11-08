/** @type {import('./_venera_.js')} */
// 漫画屋 (mhua5.com)
// 图源参考: yckceo 异次元图源 id=631
// 站点为传统 HTML 页面, 无需登录; 章节图片直接放在 img.lazy-read[data-original]。
class MHua5 extends ComicSource {
  name = "漫画屋";

  key = "mhua5";

  version = "1.0.0";

  minAppVersion = "1.4.0";

  url = "https://cdn.jsdelivr.net/gh/venera-app/venera-configs@main/mhua5.js";

  baseUrl = "https://www.mhua5.com";

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

  fixUrl(url) {
    if (!url) {
      return "";
    }
    if (url.startsWith("//")) {
      return "https:" + url;
    }
    // 站点封面 CDN 使用 http, 但同一地址也支持 https, 避免 Android 明文限制。
    if (url.startsWith("http://")) {
      return "https://" + url.substring(7);
    }
    return url;
  }

  parseSearchComic(item) {
    const link = item.querySelector("a.cover");
    const img = item.querySelector("img");
    return new Comic({
      id: link?.attributes["href"] || "",
      title:
        item
          .querySelector(".comic__title a")
          ?.text?.replace(/\s+/g, " ")
          .trim() || "",
      cover: this.fixUrl(
        img?.attributes["data-original"] || img?.attributes["src"] || ""
      ),
      subTitle:
        item
          .querySelector(".comic-update")
          ?.text?.replace(/\s+/g, " ")
          .trim() || "",
    });
  }

  parseHomeComic(item) {
    const link =
      item.querySelector(".cover a") || item.querySelector(".comic__title a");
    const img = item.querySelector("img");
    return new Comic({
      id: link?.attributes["href"] || "",
      title:
        item
          .querySelector(".comic__title a")
          ?.text?.replace(/\s+/g, " ")
          .trim() || "",
      cover: this.fixUrl(
        img?.attributes["data-original"] || img?.attributes["src"] || ""
      ),
      subTitle:
        item
          .querySelector(".cover__tag")
          ?.text?.replace(/\s+/g, " ")
          .trim() || "",
    });
  }

  parseList(doc, selector, parser) {
    return doc
      .querySelectorAll(selector)
      .map((item) => parser.call(this, item))
      .filter((comic) => comic.id && comic.title);
  }

  async loadList(path, selector, parser) {
    const doc = await this.getDoc(path);
    return { comics: this.parseList(doc, selector, parser), maxPage: 1 };
  }

  explore = [
    {
      title: "最近更新",
      type: "multiPageComicList",
      load: async () =>
        this.loadList(
          "/index.php/custom/update",
          ".common-comic-item",
          this.parseSearchComic
        ),
    },
    {
      title: "首页推荐",
      type: "multiPageComicList",
      load: async () =>
        this.loadList("/", ".in-comic--type-a", this.parseHomeComic),
    },
  ];

  search = {
    load: async (keyword) => {
      const doc = await this.getDoc(
        `/index.php/search?key=${encodeURIComponent(keyword)}`
      );
      return {
        comics: this.parseList(
          doc,
          ".common-comic-item",
          this.parseSearchComic
        ),
        maxPage: 1,
      };
    },

    enableTagsSuggestions: false,
  };

  comic = {
    loadInfo: async (id) => {
      const doc = await this.getDoc(id);
      const title =
        doc.querySelector(".j-comic-title")?.text?.replace(/\s+/g, " ").trim() ||
        "";
      const cover = this.fixUrl(
        doc.querySelector(".de-info__cover img")?.attributes["src"] || ""
      );
      const description =
        doc
          .querySelector(".comic-intro .intro-total")
          ?.text?.replace(/\s+/g, " ")
          .trim() ||
        doc
          .querySelector(".comic-intro .intro")
          ?.text?.replace(/\s+/g, " ")
          .trim() ||
        "";

      const tags = {};
      const author = doc
        .querySelector(".comic-author .name a")
        ?.text?.replace(/\s+/g, " ")
        .trim();
      if (author) {
        tags["作者"] = [author];
      }
      const genres = doc
        .querySelectorAll(".comic-status .text b a")
        .map((a) => a.text.trim())
        .filter((name) => name.length > 0);
      if (genres.length > 0) {
        tags["类型"] = genres;
      }

      const chapters = {};
      for (const a of doc.querySelectorAll(
        ".chapter__list .j-chapter-link"
      )) {
        const href = a.attributes["href"];
        if (!href || chapters[href]) {
          continue;
        }
        let name = a.text.replace(/\s+/g, " ").trim();
        if (/^\d+$/.test(name)) {
          name = `第${parseInt(name, 10)}话`;
        }
        if (!name) {
          continue;
        }
        chapters[href] = name;
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
        .querySelectorAll("img.lazy-read[data-original]")
        .map((img) => img.attributes["data-original"])
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
          Referer: "https://www.mhua5.com/",
        },
      };
    },
  };
}
