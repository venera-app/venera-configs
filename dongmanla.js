/** @type {import('./_venera_.js')} */
// 动漫啦 / 漫啦 (m.dongman.la)
// 图源参考: yckceo 图源合集内异次元规则（站点已改版, 选择器/图片路径重新适配）
class DongManLa extends ComicSource {
  name = "动漫啦";

  key = "dongmanla";

  version = "1.0.0";

  minAppVersion = "1.4.0";

  url = "https://cdn.jsdelivr.net/gh/venera-app/venera-configs@main/dongmanla.js";

  baseUrl = "https://m.dongman.la";

  get headers() {
    return {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
      Referer: this.baseUrl + "/",
    };
  }

  async getText(path) {
    const url = path.startsWith("http") ? path : this.baseUrl + path;
    const res = await Network.get(url, this.headers);
    if (res.status !== 200) {
      throw `Invalid status code: ${res.status}`;
    }
    return res.body;
  }

  async getDoc(path) {
    return new HtmlDocument(await this.getText(path));
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

  cleanTitle(title) {
    return (title || "")
      .replace(/\s+/g, " ")
      .replace(/漫画$/, "")
      .trim();
  }

  parseList(doc) {
    const comics = [];
    const seen = {};
    for (const a of doc.querySelectorAll("a[href*='/manhua/detail/']")) {
      const href = a.attributes["href"] || "";
      if (!href || seen[href]) {
        continue;
      }
      const title = this.cleanTitle(
        a.attributes["title"] ||
          a.querySelector("h2, h3")?.text ||
          ""
      );
      if (!title) {
        continue;
      }
      const img = a.querySelector("img");
      seen[href] = true;
      comics.push(
        new Comic({
          id: this.fixUrl(href),
          title: title,
          cover: this.fixUrl(img?.attributes["src"] || ""),
        })
      );
    }
    return comics;
  }

  search = {
    load: async (keyword, options, page) => {
      const doc = await this.getDoc(
        `/manhua/so/${encodeURIComponent(keyword)}/${page || 1}.html`
      );
      return { comics: this.parseList(doc), maxPage: 1 };
    },

    enableTagsSuggestions: false,
  };

  explore = [
    {
      title: "最近更新",
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
      const title = this.cleanTitle(
        doc.querySelector("h1")?.text || ""
      );
      const cover = this.fixUrl(
        doc.querySelector(".comic-cover img, article img")?.attributes["src"] ||
          ""
      );
      const description =
        doc
          .querySelector(".detail-description")
          ?.text?.replace(/\s+/g, " ")
          .trim() || "";

      const tags = {};
      const genres = doc
        .querySelectorAll(".detail-meta a, a[href*='/manhua/class/']")
        .map((a) => a.text.trim())
        .filter((name) => name.length > 0);
      if (genres.length > 0) {
        tags["类型"] = genres;
      }

      const chapters = {};
      const chapterList = [];
      const seen = {};
      for (const a of doc.querySelectorAll("#chapterList a")) {
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
      const html = await this.getText(epId);
      const firstMatch = html.match(/"contentUrl"\s*:\s*"([^"]+)"/);
      if (!firstMatch) {
        throw "No images found";
      }
      const first = firstMatch[1].replace(/\\\//g, "/");

      // 总页数: "第 1 / 29 页"
      let total = 1;
      const totalMatch =
        html.match(/第\s*\d+\s*\/\s*(\d+)\s*页/) ||
        html.match(/\d+\s*<\s*(\d+)/);
      if (totalMatch) {
        total = parseInt(totalMatch[1], 10);
      }

      const queryIndex = first.indexOf("?");
      const path = queryIndex >= 0 ? first.substring(0, queryIndex) : first;
      const query = queryIndex >= 0 ? first.substring(queryIndex) : "";
      const slash = path.lastIndexOf("/");
      const base = path.substring(0, slash + 1);

      const images = [];
      for (let i = 1; i <= total; i++) {
        images.push(base + String(i).padStart(4, "0") + ".jpg" + query);
      }
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
          Referer: "https://m.dongman.la/",
        },
      };
    },
  };
}
