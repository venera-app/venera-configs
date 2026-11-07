/** @type {import('./_venera_.js')} */
// 开心看漫画 (kxkmh.top)
// 图源参考: yckceo 图源合集内异次元规则
class Kxkmh extends ComicSource {
  name = "开心看漫画";

  key = "kxkmh";

  version = "1.0.0";

  minAppVersion = "1.4.0";

  url = "https://cdn.jsdelivr.net/gh/venera-app/venera-configs@main/kxkmh.js";

  baseUrl = "https://kxkmh.top";

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
    if (url.startsWith("/")) {
      return this.baseUrl + url;
    }
    return url;
  }

  parseList(doc) {
    const comics = [];
    const seen = {};
    for (const item of doc.querySelectorAll(".product__item")) {
      const link = item.querySelector(".product__item__text h6 a, h6 a");
      const pic = item.querySelector(".product__item__pic");
      const href = link?.attributes["href"];
      const title = (link?.text || "").replace(/\s+/g, " ").trim();
      if (!href || !title || seen[href]) {
        continue;
      }
      seen[href] = true;
      comics.push(
        new Comic({
          id: this.fixUrl(href),
          title: title,
          cover: this.fixUrl(pic?.attributes["data-setbg"] || ""),
        })
      );
    }
    return comics;
  }

  search = {
    load: async (keyword, options, page) => {
      const doc = await this.getDoc(
        `/manga/search?keyword=${encodeURIComponent(keyword)}&page=${
          page || 1
        }`
      );
      return { comics: this.parseList(doc), maxPage: 1 };
    },

    enableTagsSuggestions: false,
  };

  explore = [
    {
      title: "最近更新",
      type: "multiPageComicList",
      load: async (page) => {
        const doc = await this.getDoc(
          `/manga/library?page=${page || 1}&ranktype=1&count=24`
        );
        return { comics: this.parseList(doc), maxPage: 1 };
      },
    },
  ];

  comic = {
    loadInfo: async (id) => {
      const doc = await this.getDoc(id);
      const title = doc.querySelector("h3")?.text?.replace(/\s+/g, " ").trim() || "";
      const cover = this.fixUrl(
        doc.querySelector(".anime__details__pic")?.attributes["data-setbg"] || ""
      );

      const tags = {};
      let author = "";
      for (const span of doc.querySelectorAll(".anime__details__title span")) {
        const text = span.text.replace(/\s+/g, " ").trim();
        if (text.startsWith("作者：") || text.startsWith("作者:")) {
          author = text.substring(3).trim();
          break;
        }
      }
      if (author) {
        tags["作者"] = [author];
      }

      const description =
        doc
          .querySelector(".anime__details__text > p")
          ?.text?.replace(/\s+/g, " ")
          .trim() || "";

      const chapters = {};
      const chapterList = [];
      const seen = {};
      for (const a of doc.querySelectorAll(".chapter_list a")) {
        const href = a.attributes["href"];
        if (!href || seen[href]) {
          continue;
        }
        const name = a.text.replace(/\s+/g, " ").trim();
        if (!name) {
          continue;
        }
        seen[href] = true;
        chapterList.push([this.fixUrl(href), name]);
      }
      const chapterNo = (name) => {
        const match = name.match(/(\d+)/);
        return match ? parseInt(match[1], 10) : null;
      };
      chapterList.sort((a, b) => {
        const na = chapterNo(a[1]);
        const nb = chapterNo(b[1]);
        if (na === null && nb === null) {
          return 0;
        }
        if (na === null) {
          return 1;
        }
        if (nb === null) {
          return -1;
        }
        return na - nb;
      });
      for (const [href, name] of chapterList) {
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
        .querySelectorAll("img[src*='/webtoon/content/']")
        .map((img) => img.attributes["src"])
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
          Referer: "https://kxkmh.top/",
        },
      };
    },
  };
}
