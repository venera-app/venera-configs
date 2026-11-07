/** @type {import('./_venera_.js')} */
// 大古漫画 (dgmh123.com)
// 图源参考: yckceo 图源合集内异次元规则
//
// 章节页只放一个「点击阅读」链接, 真正的图片在大哥漫画 (idagemanhua.com)
// 的阅读页 select option[jhc-data] 里。
class DaGuManHua extends ComicSource {
  name = "大古漫画";

  key = "dagumanhua";

  version = "1.0.0";

  minAppVersion = "1.4.0";

  url = "https://cdn.jsdelivr.net/gh/venera-app/venera-configs@main/dagumanhua.js";

  baseUrl = "https://www.dgmh123.com";

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

  search = {
    // 站点搜索接口当前总是返回“没有搜索到相关的内容”
    load: async () => {
      throw "站点搜索接口不可用，请从发现页浏览";
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
        for (const li of doc.querySelectorAll(".cy_new_list li")) {
          const a = li.querySelector("b a") || li.querySelector("a");
          const href = a?.attributes["href"];
          if (!href || seen[href]) {
            continue;
          }
          const title = (a.attributes["title"] || a.text || "")
            .replace(/\s+/g, " ")
            .trim();
          if (!title) {
            continue;
          }
          seen[href] = true;
          comics.push(
            new Comic({
              id: this.fixUrl(href),
              title: title,
            })
          );
        }
        return { comics: comics, maxPage: 1 };
      },
    },
  ];

  comic = {
    loadInfo: async (id) => {
      const doc = await this.getDoc(id);
      const title =
        doc.querySelector(".cy_title h1, h1")?.text?.replace(/\s+/g, " ").trim() ||
        "";
      const cover = this.fixUrl(
        doc.querySelector(".cy_info_cover img")?.attributes["src"] || ""
      );
      const description =
        doc
          .querySelector("#comic-description")
          ?.text?.replace(/\s+/g, " ")
          .trim() || "";

      const tags = {};
      let author = "";
      let status = "";
      for (const span of doc.querySelectorAll(".cy_xinxi span")) {
        const text = span.text.replace(/\s+/g, " ").trim();
        if (text.startsWith("作者：") || text.startsWith("作者:")) {
          author = text.substring(3).trim();
        } else if (text.startsWith("状态：") || text.startsWith("状态:")) {
          status = text.substring(3).trim();
        }
      }
      if (author) {
        tags["作者"] = [author];
      }
      if (status) {
        tags["状态"] = [status];
      }

      const chapters = {};
      const chapterList = [];
      const seen = {};
      for (const a of doc.querySelectorAll("#play_0 li a")) {
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
      // 章节页上的「点击阅读」跳转到真正的阅读页
      const match = html.match(
        /<a[^>]*href="([^"]+)"[^>]*>\s*点击阅读[^<]*<\/a>/
      );
      if (!match) {
        throw "阅读链接不存在";
      }
      const readerUrl = this.fixUrl(match[1].replace(/&amp;/g, "&"));
      const reader = await Network.get(readerUrl, {
        ...this.headers,
        Referer: epId,
      });
      if (reader.status !== 200) {
        throw `Invalid reader status: ${reader.status}`;
      }

      const images = [];
      const optionRe = /<option[^>]*jhc-data="([^"]+)"/g;
      let m;
      while ((m = optionRe.exec(reader.body)) !== null) {
        images.push(m[1].replace(/&amp;/g, "&"));
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
          Referer: "https://www.idagemanhua.com/",
        },
      };
    },
  };
}
