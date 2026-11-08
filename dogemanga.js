/** @type {import('./_venera_.js')} */
// 漫畫狗 / Doge Manga (dogemanga.com)
// 图源参考: yckceo 异次元图源 id=664（解密后规则）
class DogeManga extends ComicSource {
  name = "漫畫狗";

  key = "dogemanga";

  version = "1.0.0";

  minAppVersion = "1.4.0";

  url = "https://cdn.jsdelivr.net/gh/venera-app/venera-configs@main/dogemanga.js";

  baseUrl = "https://dogemanga.com";

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
    return url;
  }

  parseComic(card) {
    const link =
      card.querySelector("a[href*='/m/']") ||
      card.querySelector("a.site-card__link");
    const img = card.querySelector("img.card-img-top, img");
    return new Comic({
      id: link?.attributes["href"] || "",
      title:
        card
          .querySelector(".site-card__manga-title, h5, .card-title")
          ?.text?.replace(/\s+/g, " ")
          .trim() || "",
      cover: this.fixUrl(
        img?.attributes["src"] || img?.attributes["data-src"] || ""
      ),
      subTitle:
        card
          .querySelector("h4.text-muted, .text-muted")
          ?.text?.replace(/\s+/g, " ")
          .trim() || "",
    });
  }

  parseList(doc) {
    const comics = [];
    const seen = {};
    let cards = doc.querySelectorAll(".site-scroll__list .site-card");
    if (cards.length === 0) {
      cards = doc.querySelectorAll(".site-card");
    }
    for (const card of cards) {
      const comic = this.parseComic(card);
      if (!comic.id || !comic.title || !comic.id.includes("/m/") || seen[comic.id]) {
        continue;
      }
      seen[comic.id] = true;
      comics.push(comic);
    }
    return comics;
  }

  search = {
    load: async (keyword, options, page) => {
      const offset = ((page || 1) - 1) * 12;
      const url = `/?q=${encodeURIComponent(keyword)}&o=${offset}`;
      const res = await Network.get(this.baseUrl + url, this.headers);
      if (res.status !== 200) {
        throw `Invalid status code: ${res.status}`;
      }
      const doc = new HtmlDocument(res.body);
      let maxPage = 1;
      const count = res.body.match(/\((\d+)\s+results?\)/i);
      if (count) {
        maxPage = Math.max(1, Math.ceil(parseInt(count[1], 10) / 12));
      } else {
        for (const a of doc.querySelectorAll("a")) {
          const href = a.attributes["href"] || "";
          const match = href.match(/[?&]o=(\d+)/);
          if (match) {
            maxPage = Math.max(maxPage, Math.floor(parseInt(match[1], 10) / 12) + 1);
          }
        }
      }
      return { comics: this.parseList(doc), maxPage: maxPage };
    },

    enableTagsSuggestions: false,
  };

  explore = [
    {
      title: "熱門漫畫",
      type: "multiPageComicList",
      load: async () => {
        const doc = await this.getDoc("/");
        return { comics: this.parseList(doc), maxPage: 1 };
      },
    },
  ];

  comic = {
    loadInfo: async (id) => {
      const doc = await this.getDoc(id);
      const title =
        doc
          .querySelector(".site-card__manga-title")
          ?.text?.replace(/\s+/g, " ")
          .trim() || "";
      const cover = this.fixUrl(
        doc.querySelector("img.site-manga__cover-image")?.attributes["src"] ||
          ""
      );
      const author = doc
        .querySelector("h4.text-muted a, h4.text-muted")
        ?.text?.replace(/\s+/g, " ")
        .trim();
      const description =
        doc
          .querySelector(".site-card__brief")
          ?.text?.replace(/\s+/g, " ")
          .trim() || "";

      const tags = {};
      if (author) {
        tags["作者"] = [author];
      }

      const chapters = {};
      const chapterList = [];
      const seen = {};
      for (const option of doc.querySelectorAll(
        "select.site-selector option[value]"
      )) {
        const href = option.attributes["value"];
        if (!href || seen[href]) {
          continue;
        }
        let name = option.text.replace(/\s+/g, " ").trim();
        if (!name || name.indexOf("Select chapter") >= 0) {
          continue;
        }
        seen[href] = true;
        chapterList.push([href, name]);
      }
      const chapterNo = (name) => {
        const match = name.match(/(\d+)/);
        return match ? parseInt(match[1], 10) : null;
      };
      const isMainChapter = (name) => /^第\s*\d+\s*[话話回]/.test(name);
      chapterList.sort((a, b) => {
        const ma = isMainChapter(a[1]);
        const mb = isMainChapter(b[1]);
        if (ma !== mb) {
          return ma ? -1 : 1;
        }
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
        .querySelectorAll("img.site-reader__image")
        .map((img) => img.attributes["data-page-image-url"])
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
          Referer: "https://dogemanga.com/",
        },
      };
    },
  };
}
