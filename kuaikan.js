/** @type {import('./_venera_.js')} */
// 快看漫画 (kuaikanmanhua.com)
// 图源参考: yckceo 异次元图源 id=334（T004 规则解密失败, 改为直接解析站点 API/Nuxt 数据）
class KuaiKan extends ComicSource {
  name = "快看漫画";

  key = "kuaikan";

  version = "1.0.0";

  minAppVersion = "1.4.0";

  url = "https://cdn.jsdelivr.net/gh/venera-app/venera-configs@main/kuaikan.js";

  baseUrl = "https://www.kuaikanmanhua.com";

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

  // 页面把首屏数据序列化成 __NUXT__=(function(...){...})(...)
  // 直接在 JS 引擎里执行, 取出 __NUXT__
  evalNuxt(html) {
    const match = html.match(/__NUXT__=([\s\S]*?)<\/script>/);
    if (!match) {
      throw "Nuxt data not found";
    }
    const expression = match[1].trim().replace(/;+\s*$/, "");
    // eslint-disable-next-line no-eval
    const nuxt = eval(expression);
    return nuxt || globalThis.__NUXT__;
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
    return new Comic({
      id: String(item.id),
      title: (item.title || "").replace(/\s+/g, " ").trim(),
      cover: this.fixUrl(
        item.vertical_image_url || item.cover_image_url || ""
      ),
      subTitle:
        item.comics_count != null ? `${item.comics_count} 话` : "",
    });
  }

  search = {
    load: async (keyword, options, page) => {
      const since = ((page || 1) - 1) * 48;
      const body = await this.getText(
        `/v1/search/topic?q=${encodeURIComponent(
          keyword
        )}&since=${since}&count=48&f=3`
      );
      const json = JSON.parse(body);
      const data = json.data || {};
      const list =
        data.hit ||
        data.topics ||
        (data.rank_info && data.rank_info.topics) ||
        [];
      const total = data.total != null ? data.total : json.total || list.length;
      return {
        comics: list.map((item) => this.parseComic(item)),
        maxPage: Math.max(1, Math.ceil(total / 48)),
      };
    },

    enableTagsSuggestions: false,
  };

  explore = [
    {
      title: "热门漫画",
      type: "multiPageComicList",
      load: async (page) => {
        // 搜索接口不接受空关键词, 用「漫画」作为发现页的宽泛关键词
        const body = await this.getText(
          `/v1/search/topic?q=${encodeURIComponent("漫画")}&since=${
            ((page || 1) - 1) * 48
          }&count=48&f=3`
        );
        const json = JSON.parse(body);
        const data = json.data || {};
        const list = data.hit || data.topics || [];
        const total = data.total != null ? data.total : list.length;
        return {
          comics: list.map((item) => this.parseComic(item)),
          maxPage: Math.max(1, Math.ceil(total / 48)),
        };
      },
    },
  ];

  comic = {
    loadInfo: async (id) => {
      const html = await this.getText(`/web/topic/${id}/`);
      const nuxt = this.evalNuxt(html);
      const info =
        nuxt.data[0].res.data.topic_info || nuxt.data[0].res.data.data;
      if (!info) {
        throw "Topic info not found";
      }

      const tags = {};
      if (Array.isArray(info.tags) && info.tags.length > 0) {
        tags["标签"] = info.tags;
      }

      const chapters = {};
      const comics = Array.isArray(info.comics) ? info.comics : [];
      const list = comics.map((comic) => [
        String(comic.id),
        (comic.title || "").replace(/\s+/g, " ").trim(),
      ]);
      const chapterNo = (name) => {
        const match = name.match(/(\d+)/);
        return match ? parseInt(match[1], 10) : null;
      };
      list.sort((a, b) => {
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
      for (const [comicId, name] of list) {
        chapters[comicId] = name;
      }

      return {
        title: (info.title || "").replace(/\s+/g, " ").trim(),
        cover: this.fixUrl(
          info.cover_image_url || info.vertical_image_url || ""
        ),
        description: (info.description || "").replace(/\s+/g, " ").trim(),
        tags: tags,
        chapters: chapters,
      };
    },

    loadEp: async (comicId, epId) => {
      const html = await this.getText(`/web/comic/${epId}/`);
      const nuxt = this.evalNuxt(html);
      const info =
        nuxt.data[0].res.data.comic_info || nuxt.data[0].res.data.data;
      if (!info || !Array.isArray(info.comic_images)) {
        throw "Comic images not found";
      }
      const images = info.comic_images
        .map((image) => image.url1280 || image.url)
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
          Referer: "https://www.kuaikanmanhua.com/",
        },
      };
    },
  };
}
