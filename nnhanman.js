/** @type {import('./_venera_.js')} */
// 鸟鸟韩漫 (nnhanman.net)
// 图源参考: yckceo 图源合集内异次元规则
class NiaoNiao extends ComicSource {
  name = "鸟鸟韩漫";

  key = "nnhanman";

  version = "1.0.0";

  minAppVersion = "1.4.0";

  url = "https://cdn.jsdelivr.net/gh/venera-app/venera-configs@main/nnhanman.js";

  baseUrl = "https://nnhanman.net";

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
    for (const li of doc.querySelectorAll("li")) {
      const link = li.querySelector("a.txtA[href*='/comic/']");
      if (!link) {
        continue;
      }
      const href = link.attributes["href"];
      const title = (link.attributes["title"] || link.text || "")
        .replace(/\s+/g, " ")
        .trim();
      if (!href || !title || seen[href]) {
        continue;
      }
      const img = li.querySelector("img");
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
    load: async (keyword) => {
      const doc = await this.getDoc(
        `/catalog.php?key=${encodeURIComponent(keyword)}`
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
      let title = doc.querySelector("h1")?.text?.replace(/\s+/g, " ").trim() || "";
      title = title.replace(/^《/, "").replace(/》$/, "");

      const cover = this.fixUrl(
        doc.querySelector(".pic img")?.attributes["src"] || ""
      );
      let description =
        doc.querySelector(".txtDesc")?.text?.replace(/\s+/g, " ").trim() || "";
      description = description.replace(/^介绍[:：]/, "").trim();

      const tags = {};
      const info = doc.querySelector(".sub_r")?.text || "";
      const authorMatch = info.match(/作者[:：]\s*([^\s]+)/);
      if (authorMatch) {
        tags["作者"] = [authorMatch[1]];
      }

      const chapters = {};
      const chapterList = [];
      const seen = {};
      for (const a of doc.querySelectorAll("#mh-chapter-list-ol-0 li a")) {
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
        .querySelectorAll("img[data-index][data-src]")
        .map((img) => img.attributes["data-src"])
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
          Referer: "https://nnhanman.net/",
        },
      };
    },
  };
}
