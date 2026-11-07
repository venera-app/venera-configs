/** @type {import('./_venera_.js')} */
// 知音漫客 (m.zymk.cn)
// 图源参考: yckceo 异次元图源 id=713（H006 解密后规则, 站点已改为 SPA + API）
class ZhiYinManKe extends ComicSource {
  name = "知音漫客";

  key = "zymk";

  version = "1.0.0";

  minAppVersion = "1.4.0";

  url = "https://cdn.jsdelivr.net/gh/venera-app/venera-configs@main/zymk.js";

  baseUrl = "https://m.zymk.cn";

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

  coverUrl(id) {
    const padded = String(id).padStart(9, "0");
    const path = `${padded.substring(0, 3)}/${padded.substring(
      3,
      6
    )}/${padded.substring(6, 9)}`;
    return `https://chapter-cover.yyhao.com/file/cover/${path}.jpg-300x400`;
  }

  parseApiComic(item) {
    return new Comic({
      id: String(item.comic_id),
      title: (item.comic_name || "").replace(/\s+/g, " ").trim(),
      cover: this.coverUrl(item.comic_id),
      subTitle:
        item.last_chapter && item.last_chapter.name
          ? String(item.last_chapter.name).replace(/\s+/g, " ").trim()
          : "",
    });
  }

  search = {
    load: async (keyword, options, page) => {
      const body = await this.getText(
        `/apinew/getsortlist_new?key=${encodeURIComponent(
          keyword
        )}&page=${page || 1}&sort=click`
      );
      const json = JSON.parse(body);
      const pageData = json.data && json.data.page;
      if (!pageData) {
        throw "Search API error";
      }
      return {
        comics: (pageData.comic_list || []).map((item) =>
          this.parseApiComic(item)
        ),
        maxPage: pageData.total_page || 1,
      };
    },

    enableTagsSuggestions: false,
  };

  explore = [
    {
      title: "热门",
      type: "multiPageComicList",
      load: async (page) => {
        const body = await this.getText(
          `/apinew/getsortlist_new?key=&page=${page || 1}&sort=click`
        );
        const json = JSON.parse(body);
        const pageData = json.data && json.data.page;
        if (!pageData) {
          throw "Explore API error";
        }
        return {
          comics: (pageData.comic_list || []).map((item) =>
            this.parseApiComic(item)
          ),
          maxPage: pageData.total_page || 1,
        };
      },
    },
  ];

  comic = {
    loadInfo: async (id) => {
      const html = await this.getText(`/${id}/`);
      const doc = new HtmlDocument(html);

      const title =
        doc.querySelector(".comic-info h1.name")?.text?.replace(/\s+/g, " ").trim() ||
        "";
      const cover =
        doc.querySelector(".comic-info .thumbnail")?.attributes["data-src"] ||
        doc.querySelector(".comic-info .thumbnail")?.attributes["src"] ||
        "";
      const author =
        doc.querySelector(".comic-info .author")?.text?.replace(/\s+/g, " ").trim() ||
        "";
      const description =
        doc
          .querySelector(".comic-detail .content")
          ?.text?.replace(/\s+/g, " ")
          .trim() || "";
      const genres = doc
        .querySelectorAll(".tags-box .tags")
        .map((tag) => tag.text.replace(/\s+/g, " ").trim())
        .filter((name) => name.length > 0);

      const tags = {};
      if (author) {
        tags["作者"] = [author];
      }
      if (genres.length > 0) {
        tags["类型"] = genres;
      }

      const chapters = {};
      const chapterList = [];
      const seen = {};
      for (const a of doc.querySelectorAll(".chapterlist li a.chapterBtn")) {
        const href = a.attributes["href"];
        if (!href || seen[href]) {
          continue;
        }
        const name =
          a.attributes["title"]?.replace(/\s+/g, " ").trim() ||
          a.text.replace(/\s+/g, " ").trim();
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
        chapters[`/${id}/${href.replace(/^\/+/, "")}`] = name;
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
      const pick = (re) => {
        const match = html.match(re);
        return match ? match[1] : "";
      };
      const price = parseInt(pick(/price:(\d+)/), 10);
      if (price > 0) {
        throw "该章节为付费章节";
      }
      const addr = pick(/chapter_addr_original:"([^"]*)"/);
      const start = parseInt(pick(/start_var:(\d+)/), 10);
      const end = parseInt(pick(/end_var:(\d+)/), 10);
      const size = pick(/comic_size:"([^"]*)"/) || "";
      const domain = pick(/domain:"([^"]*)"/) || "yyhao.com";
      if (!addr || !start || !end) {
        throw "Failed to parse chapter";
      }

      const images = [];
      for (let i = start; i <= end; i++) {
        const url = `https://mhpic.${domain}/comic/${addr}${i}.jpg${size}`;
        images.push(encodeURI(url));
      }
      return { images: images };
    },

    onImageLoad: (url, comicId, epId) => {
      return {
        url: url,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
          Referer: "https://m.zymk.cn/",
        },
      };
    },
  };
}
