/** @type {import('./_venera_.js')} */
// MangaRead (mangaread.org)
// 图源参考: yckceo 图源合集内的异次元规则（解密/翻译为 CSS 选择器）
class MangaRead extends ComicSource {
  name = "MangaRead";

  key = "mangaread";

  version = "1.0.0";

  minAppVersion = "1.4.0";

  url = "https://cdn.jsdelivr.net/gh/venera-app/venera-configs@main/mangaread.js";

  baseUrl = "https://www.mangaread.org";

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

  parseComic(card) {
    const link = card.querySelector("a[href*='/manga/']");
    const img = card.querySelector("img");
    return new Comic({
      id: link?.attributes["href"] || "",
      title:
        link?.attributes["title"]?.replace(/\s+/g, " ").trim() ||
        img?.attributes["alt"]?.replace(/\s+/g, " ").trim() ||
        "",
      cover: img?.attributes["src"] || "",
    });
  }

  parseList(doc) {
    const comics = [];
    const seen = {};
    for (const card of doc.querySelectorAll(
      ".c-tabs-item__content, .page-item-detail"
    )) {
      const comic = this.parseComic(card);
      if (!comic.id || !comic.title || seen[comic.id]) {
        continue;
      }
      seen[comic.id] = true;
      comics.push(comic);
    }
    return comics;
  }

  parseMaxPage(doc) {
    let max = 1;
    for (const a of doc.querySelectorAll("a.page-numbers")) {
      const text = a.text.trim();
      const page = parseInt(text, 10);
      if (!isNaN(page)) {
        max = Math.max(max, page);
      }
    }
    return max;
  }

  search = {
    load: async (keyword, options, page) => {
      const doc = await this.getDoc(
        `/?s=${encodeURIComponent(keyword)}&post_type=wp-manga${
          page > 1 ? `&paged=${page}` : ""
        }`
      );
      return { comics: this.parseList(doc), maxPage: this.parseMaxPage(doc) };
    },

    enableTagsSuggestions: false,
  };

  explore = [
    {
      title: "热门漫画",
      type: "multiPageComicList",
      load: async (page) => {
        const doc = await this.getDoc(
          `/manga/page/${page || 1}/?m_orderby=views`
        );
        return { comics: this.parseList(doc), maxPage: this.parseMaxPage(doc) };
      },
    },
  ];

  comic = {
    loadInfo: async (id) => {
      const doc = await this.getDoc(id);
      const title = doc.querySelector("h1")?.text?.replace(/\s+/g, " ").trim() || "";
      const cover =
        doc.querySelector(".summary_image img")?.attributes["src"] || "";
      const description =
        doc
          .querySelector(".summary__content")
          ?.text?.replace(/\s+/g, " ")
          .trim() || "";

      const tags = {};
      const genres = doc
        .querySelectorAll(".genres-content a, .tags-content a")
        .map((a) => a.text.trim())
        .filter((name) => name.length > 0);
      if (genres.length > 0) {
        tags["类型"] = genres;
      }
      const author = doc
        .querySelector(".author-content a")
        ?.text?.replace(/\s+/g, " ")
        .trim();
      if (author) {
        tags["作者"] = [author];
      }

      const chapters = {};
      const chapterList = [];
      const seen = {};
      for (const a of doc.querySelectorAll(".wp-manga-chapter a")) {
        const href = a.attributes["href"];
        if (!href || seen[href]) {
          continue;
        }
        const name = a.text.replace(/\s+/g, " ").trim();
        if (!name) {
          continue;
        }
        seen[href] = true;
        chapterList.push([href, name]);
      }
      // 默认倒序, 按章节号升序
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
        .querySelectorAll("img.wp-manga-chapter-img, .page-break img")
        .map((img) => (img.attributes["src"] || "").trim())
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
          Referer: "https://www.mangaread.org/",
        },
      };
    },
  };
}
