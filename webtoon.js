/** @type {import('./_venera_.js')} */
// WEBTOON 繁中 (us.webtoons.com)
// 图源参考: yckceo 异次元图源 id=943（解密后规则）
class Webtoon extends ComicSource {
  name = "WEBTOON";

  key = "webtoon";

  version = "1.0.0";

  minAppVersion = "1.4.0";

  url = "https://cdn.jsdelivr.net/gh/venera-app/venera-configs@main/webtoon.js";

  baseUrl = "https://us.webtoons.com";

  get headers() {
    return {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
      Referer: this.baseUrl + "/zh-hant/",
      Cookie: "locale=zh_TW;pagGDPR=true",
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
    return url;
  }

  parseComic(item) {
    const link = item.querySelector("a._card_item, a.link, a");
    const img = item.querySelector("img");
    return new Comic({
      id: link?.attributes["href"] || "",
      title:
        item
          .querySelector("strong.title, .title, .subj")
          ?.text?.replace(/\s+/g, " ")
          .trim() || "",
      cover: this.fixUrl(img?.attributes["src"] || ""),
      subTitle:
        item
          .querySelector(".author")
          ?.text?.replace(/\s+/g, " ")
          .trim() || "",
    });
  }

  parseList(doc) {
    const comics = [];
    const seen = {};
    for (const item of doc.querySelectorAll(".webtoon_list li")) {
      const comic = this.parseComic(item);
      if (!comic.id || !comic.title || seen[comic.id]) {
        continue;
      }
      seen[comic.id] = true;
      comics.push(comic);
    }
    return comics;
  }

  search = {
    load: async (keyword) => {
      const doc = await this.getDoc(
        `/zh-hant/search?keyword=${encodeURIComponent(keyword)}`
      );
      return { comics: this.parseList(doc), maxPage: 1 };
    },

    enableTagsSuggestions: false,
  };

  explore = [
    {
      title: "熱門漫畫",
      type: "multiPageComicList",
      load: async () => {
        // 搜索接口需要关键词, 用「漫畫」作为发现页关键词
        const doc = await this.getDoc(
          `/zh-hant/search?keyword=${encodeURIComponent("漫畫")}`
        );
        return { comics: this.parseList(doc), maxPage: 1 };
      },
    },
  ];

  comic = {
    loadInfo: async (id) => {
      const doc = await this.getDoc(id);
      const title = doc.querySelector("h1")?.text?.replace(/\s+/g, " ").trim() || "";
      const cover = this.fixUrl(
        doc.querySelector('meta[property="og:image"]')?.attributes["content"] ||
          ""
      );
      const description =
        doc
          .querySelector(".summary")
          ?.text?.replace(/\s+/g, " ")
          .trim() || "";

      const tags = {};
      const author =
        doc.querySelector(".author")?.text?.replace(/\s+/g, " ").trim() || "";
      if (author) {
        tags["作者"] = [author];
      }

      const chapters = {};
      const chapterList = [];
      const seen = {};
      for (const a of doc.querySelectorAll("#_listUl li a.detail_list_link")) {
        const href = a.attributes["href"];
        if (!href || seen[href]) {
          continue;
        }
        const name =
          a
            .querySelector(".subj")
            ?.text?.replace(/\s+/g, " ")
            .trim() ||
          a.querySelector("img")?.attributes["alt"] ||
          "";
        if (!name) {
          continue;
        }
        seen[href] = true;
        chapterList.push([href, name]);
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
        .querySelectorAll("#_imageList img[data-url]")
        .map((img) => img.attributes["data-url"])
        .filter(
          (url) =>
            !!url &&
            !url.includes("/thumb_") &&
            !url.includes("warning") &&
            !url.includes("type=f160")
        );
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
          Referer: "https://us.webtoons.com/",
        },
      };
    },
  };
}
