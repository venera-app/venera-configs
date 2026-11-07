/** @type {import('./_venera_.js')} */
// 污漫天堂 (wmtt5.com)
// 图源参考: yckceo 异次元图源 id=854
// 站点为传统 HTML 页面, 无需登录; 搜索/详情/章节均为服务端渲染。
class WMtt5 extends ComicSource {
  name = "污漫天堂";

  key = "wmtt5";

  version = "1.0.0";

  minAppVersion = "1.4.0";

  url = "https://cdn.jsdelivr.net/gh/venera-app/venera-configs@main/wmtt5.js";

  baseUrl = "https://wmtt5.com";

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
    const img = item.querySelector("img");
    let cover =
      img?.attributes["data-original"] || img?.attributes["src"] || "";
    if (cover.startsWith("//")) {
      cover = "https:" + cover;
    }
    const title =
      item.attributes["title"] || img?.attributes["alt"] || "";
    return new Comic({
      id: item.attributes["href"] || "",
      title: title.replace(/\s+/g, " ").trim(),
      cover: cover,
      subTitle:
        item
          .querySelector(".module-item-note")
          ?.text?.replace(/\s+/g, " ")
          .trim() || "",
    });
  }

  parseList(doc) {
    return doc
      .querySelectorAll("a.module-poster-item")
      .map((item) => this.parseComic(item))
      .filter((comic) => comic.id && comic.title);
  }

  async loadList(path) {
    const doc = await this.getDoc(path);
    return { comics: this.parseList(doc), maxPage: 1 };
  }

  explore = [
    {
      title: "最近更新",
      type: "multiPageComicList",
      load: async () => this.loadList("/newmanga"),
    },
    {
      title: "日榜",
      type: "multiPageComicList",
      load: async () => this.loadList("/mangarank/daily"),
    },
    {
      title: "周榜",
      type: "multiPageComicList",
      load: async () => this.loadList("/mangarank"),
    },
    {
      title: "月榜",
      type: "multiPageComicList",
      load: async () => this.loadList("/mangarank/monthly"),
    },
    {
      title: "总榜",
      type: "multiPageComicList",
      load: async () => this.loadList("/mangarank/all"),
    },
  ];

  search = {
    load: async (keyword) => {
      const doc = await this.getDoc(
        `/cata.php?key=${encodeURIComponent(keyword)}`
      );
      return { comics: this.parseList(doc), maxPage: 1 };
    },

    enableTagsSuggestions: false,
  };

  comic = {
    loadInfo: async (id) => {
      const doc = await this.getDoc(id);
      let title = doc.querySelector("h1")?.text?.trim() || "";
      title = title.replace(/^《/, "").replace(/》$/, "");

      let cover =
        doc.querySelector(".module-info-poster img")?.attributes[
          "data-original"
        ] || "";
      if (cover.startsWith("//")) {
        cover = "https:" + cover;
      }

      const description =
        doc
          .querySelector(".module-info-introduction-content")
          ?.text?.replace(/\s+/g, " ")
          .trim() || "";

      const tags = {};
      let author = "";
      for (const item of doc.querySelectorAll(".module-info-item")) {
        const label = item.querySelector(".module-info-item-title")?.text || "";
        if (label.includes("作者")) {
          author =
            item
              .querySelector(".module-info-item-content")
              ?.text?.replace(/\s+/g, " ")
              .replace(/[\/\s]+$/, "")
              .trim() || "";
          break;
        }
      }
      if (author) {
        tags["作者"] = [author];
      }
      const genres = doc
        .querySelectorAll(".module-info-tag-link a")
        .map((a) => a.text.trim())
        .filter((name) => name.length > 0);
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
          Referer: "https://wmtt5.com/",
        },
      };
    },
  };
}
