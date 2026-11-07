/** @type {import('./_venera_.js')} */
// 動漫戲說 (comic.acgn.cc)
// 图源参考: yckceo 异次元图源 id=...（解密后规则）
//
// 站点没有可用的搜索接口（搜索走 Google CSE），只能从首页/分类浏览。
class AcgnComic extends ComicSource {
  name = "動漫戲說";

  key = "acgn";

  version = "1.0.0";

  minAppVersion = "1.4.0";

  url = "https://cdn.jsdelivr.net/gh/venera-app/venera-configs@main/acgn.js";

  baseUrl = "https://comic.acgn.cc";

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

  parseComic(item) {
    const link =
      item.querySelector("a[href*='manhua-']") ||
      item.querySelectorAll("a")[1] ||
      item.querySelector("a");
    const img = item.querySelector("img");
    let title =
      link?.attributes["title"] || item.querySelector("a[title]")?.attributes["title"] || "";
    title = title.replace(/\s+/g, " ").trim();
    return new Comic({
      id: this.fixUrl(link?.attributes["href"] || ""),
      title: title,
      cover: this.fixUrl(
        img?.attributes["src"] || img?.attributes["data-src"] || ""
      ),
    });
  }

  search = {
    // 站点搜索由 Google CSE 提供，无法在 App 内使用
    load: async () => {
      throw "该站点没有可用的搜索接口，请从发现页浏览";
    },

    enableTagsSuggestions: false,
  };

  explore = [
    {
      title: "最近更新",
      type: "multiPageComicList",
      load: async () => {
        const doc = await this.getDoc("/");
        const comics = [];
        const seen = {};
        for (const item of doc.querySelectorAll(".tabs-panel li")) {
          const comic = this.parseComic(item);
          if (!comic.id || !comic.title || seen[comic.id]) {
            continue;
          }
          seen[comic.id] = true;
          comics.push(comic);
        }
        return { comics: comics, maxPage: 1 };
      },
    },
  ];

  comic = {
    loadInfo: async (id) => {
      const doc = await this.getDoc(id);
      const title =
        doc.querySelector("h3 a, h3")?.text?.replace(/\s+/g, " ").trim() || "";
      const cover = this.fixUrl(
        doc.querySelector(".gameshows dd img")?.attributes["src"] || ""
      );

      const tags = {};
      let description = "";
      for (const li of doc.querySelectorAll(".m .mss")) {
        const text = li.text.replace(/\s+/g, " ").trim();
        const index = text.indexOf("：");
        if (index < 0) {
          continue;
        }
        const label = text.substring(0, index);
        const value = text.substring(index + 1).trim();
        if (!value) {
          continue;
        }
        if (label.indexOf("作者") >= 0) {
          tags["作者"] = [value];
        } else if (label.indexOf("狀態") >= 0 || label.indexOf("状态") >= 0) {
          tags["狀態"] = [value];
        } else if (label.indexOf("類型") >= 0 || label.indexOf("类型") >= 0) {
          tags["類型"] = [value];
        }
      }

      const chapters = {};
      const chapterList = [];
      const seen = {};
      for (const a of doc.querySelectorAll("#comic_chapter li a")) {
        let href = a.attributes["href"] || "";
        if (!href) {
          continue;
        }
        if (!href.startsWith("http")) {
          href = href.startsWith("/") ? href : "/" + href;
        }
        if (seen[href]) {
          continue;
        }
        seen[href] = true;
        chapterList.push([
          href,
          a.text.replace(/\s+/g, " ").trim() || a.attributes["title"] || "",
        ]);
      }
      // 章节默认倒序, 按话数升序
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
        .querySelectorAll(".pic[_src]")
        .map((div) => div.attributes["_src"])
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
          Referer: "https://comic.acgn.cc/",
        },
      };
    },
  };
}
