/** @type {import('./_venera_.js')} */

const JCOMIC_BASE = "https://jcomic.net";
const JCOMIC_REFERER = JCOMIC_BASE + "/";

function trimTitle(raw) {
  if (!raw) return "";
  const idx = raw.lastIndexOf(" (");
  if (idx > 0) return raw.slice(0, idx).trim();
  return raw.trim();
}

function parseIdFromHref(href) {
  if (!href) return null;
  try {
    const u = href.split("?")[0];
    const parts = u.split("/").filter(Boolean); // 过滤空字符串
    if (parts.length >= 2) {
      return decodeURIComponent(parts[1]);
    }
    return decodeURIComponent(parts[parts.length - 1]);
  } catch {
    return null;
  }
}

function parseEpIdFromHref(href) {
  if (!href) return null;
  const u = href.split("?")[0];
  const parts = u.split("/").filter(Boolean);
  if (parts.length >= 3) {
    return decodeURIComponent(parts[2]);
  }
  return null;
}

/**
 * 解析作品卡片 -> Comic
 * @param {Element} card
 */
function parseComicCard(card) {
  try {
    const link = card.querySelector('a[href^="/eps/"], a[href^="/page/"]');
    if (!link) return null;
    const href = link.attributes["href"];
    const id = parseIdFromHref(href);
    if (!id) return null;

    const img = card.querySelector("img.comic-thumb");
    const cover = img ? img.attributes["src"] : "";

    const titleEl = card.querySelector("p.comic-title");
    const rawTitle = titleEl ? titleEl.text.trim() : id;
    const title = trimTitle(rawTitle);

    // 作者
    const authorButtons = card.querySelectorAll('a[href^="/author/"] button');
    const authors = Array.from(authorButtons).map((b) => b.text.trim());
    const subTitle = authors.join(" ");

    // 分类标签
    const catButtons = card.querySelectorAll('a[href^="/cat/"] button');
    let tags = [];
    if (catButtons.length) {
        tags = Array.from(catButtons).map((b) => b.text.trim());
    } else {
    // 有些结构是 a[href^="/cat/..."] 包着文字
    const catAnchors = card.querySelectorAll('a[href^="/cat/"]');
    tags = Array.from(catAnchors)
    .map((a) => a.text.trim())
    .filter(Boolean);
}   

    // 最后更新
    const dateEl = card.querySelector("p.comic-date");
    const description = dateEl ? dateEl.text.trim() : "";

    return new Comic({
      id,
      title,
      subTitle,
      cover,
      tags,
      language: "zh-Hant",
      description,
    });
  } catch (e) {
    return null;
  }
}

/**
 * 通用：解析分页最大页数
 * @param {HtmlDocument} doc
 */
function parseMaxPage(doc) {
  const pag = doc.querySelector("ul.pagination");
  if (!pag) return 1;
  const as = pag.querySelectorAll("a");
  let max = 1;
  as.forEach((a) => {
    const t = a.text.trim();
    const n = parseInt(t, 10);
    if (!Number.isNaN(n) && n > max) max = n;
  });
  return max;
}

/**
 * 通用：解析列表页所有作品
 * @param {HtmlDocument} doc
 */
function parseComicList(doc) {
  const cards = doc.querySelectorAll(
    'div.row.col-lg-4.col-md-6.col-xs-12, div.row.col-md-6.col-xs-12'
  );
  const result = [];
  cards.forEach((card) => {
    const c = parseComicCard(card);
    if (c) result.push(c);
  });
  return result;
}

class JComic extends ComicSource {
  name = "jcomic.net";
  key = "jcomic";

  version = "1.0.0";
  minAppVersion = "1.4.6";

  url =
    "https://cdn.jsdelivr.net/gh/venera-app/venera-configs@main/jcomic.js";

  currentComic = null;

  _buildUrl(path) {
    if (path.startsWith("http://") || path.startsWith("https://")) return path;
    if (!path.startsWith("/")) path = "/" + path;
    return JCOMIC_BASE + path;
  }

  /**
   * [Optional] init
   */
  init() {}

  /// explore
  explore = [
    {
      title: "JComic",
      type: "multiPageComicList",
      load: async (page) => {
        if (!page) page = 1;
        const cat = "最近更新";
        const encoded = encodeURI(cat);
        const path = page === 1 ? `/cat/${encoded}` : `/cat/${encoded}/${page}`;
        const url = this._buildUrl(path);

        const resp = await Network.get(url, { referer: JCOMIC_REFERER });
        if (resp.status !== 200) throw new Error(resp.status);

        const doc = new HtmlDocument(resp.body);
        const comics = parseComicList(doc);
        const maxPage = parseMaxPage(doc);

        return { comics, maxPage };
      },
      loadNext(next) {},
    },
  ];

  // 分类列表
  category = {
    title: "jcomic.net",
    parts: [
      {
        name: "分類",
        type: "fixed",
        categories: [
          "最近更新",
          "隨機",
          "全彩",
          "長篇",
          "單行本",
          "同人",
          "短篇",
          "Cosplay",
          "歐美",
          "WEBTOON",
          "圓神領域",
          "碧藍幻想",
          "CG雜圖",
          "英語 ENG",
          "生肉",
          "純愛",
          "百合花園",
          "耽美花園",
          "偽娘哲學",
          "後宮閃光",
          "扶他樂園",
          "姐姐系",
          "妹妹系",
          "SM",
          "性轉換",
          "足の恋",
          "重口地帶",
          "人妻",
          "NTR",
          "強暴",
          "非人類",
          "艦隊收藏",
          "Love Live",
          "SAO 刀劍神域",
          "Fate",
          "東方",
          "禁書目錄",
        ],
        itemType: "category",
        categoryParams: [
          "最近更新",
          "隨機",
          "全彩",
          "長篇",
          "單行本",
          "同人",
          "短篇",
          "Cosplay",
          "歐美",
          "WEBTOON",
          "圓神領域",
          "碧藍幻想",
          "CG雜圖",
          "英語 ENG",
          "生肉",
          "純愛",
          "百合花園",
          "耽美花園",
          "偽娘哲學",
          "後宮閃光",
          "扶他樂園",
          "姐姐系",
          "妹妹系",
          "SM",
          "性轉換",
          "足の恋",
          "重口地帶",
          "人妻",
          "NTR",
          "強暴",
          "非人類",
          "艦隊收藏",
          "Love Live",
          "SAO 刀劍神域",
          "Fate",
          "東方",
          "禁書目錄",
        ],
      },
    ],
    enableRankingPage: false,
  };

  categoryComics = {
    /**
     * @param category {string}
     * @param param {string} 
     * @param options {string[]}
     * @param page {number}
     */
    load: async (category, param, options, page) => {
      if (!page) page = 1;
      const encoded = encodeURI(param);
      const path = page === 1 ? `/cat/${encoded}` : `/cat/${encoded}/${page}`;
      const url = this._buildUrl(path);

      const resp = await Network.get(url, { referer: JCOMIC_REFERER });
      if (resp.status !== 200) throw new Error(resp.status);

      const doc = new HtmlDocument(resp.body);
      const comics = parseComicList(doc);
      const maxPage = parseMaxPage(doc);

      return { comics, maxPage };
    },
    optionList: [],
    ranking: null,
  };

  /// 搜索
  search = {
    /**
     * @param keyword {string}
     * @param options {string[]}
     * @param page {number}
     */
    load: async (keyword, options, page) => {
      if (!page) page = 1;
      const kw = (keyword || "").trim();
      if (!kw) {
        return { comics: [], maxPage: 1 };
      }
      const encoded = encodeURIComponent(kw);
      const path = page === 1 ? `/search/${encoded}` : `/search/${encoded}/${page}`;
      const url = this._buildUrl(path);

      const resp = await Network.get(url, { referer: JCOMIC_REFERER });
      if (resp.status !== 200) throw new Error(resp.status);

      const doc = new HtmlDocument(resp.body);
      const comics = parseComicList(doc);
      const maxPage = parseMaxPage(doc);

      return { comics, maxPage };
    },
    loadNext: async (keyword, options, next) => {},
    optionList: [
      {
        type: "select",
        options: ["0-Default"],
        label: "sort",
        default: null,
      },
    ],
    enableTagsSuggestions: false,
  };

  /// 单本漫画
  comic = {
    /**
     * 载入漫画信息和章节列表
     * @param id {string} - 原始标题字符串
     * @returns {Promise<ComicDetails>}
     */
    loadInfo: async (id) => {
      const encodedId = encodeURI(id);
      const url = this._buildUrl(`/eps/${encodedId}`);
      const resp = await Network.get(url, { referer: JCOMIC_REFERER });
      if (resp.status !== 200) throw new Error(resp.status);

      const doc = new HtmlDocument(resp.body);

      const infoBlock = doc.querySelector(
        'div.row.col-md-6.col-xs-12'
      );
      if (!infoBlock) {
        throw new Error("failed to parse comic info");
      }

      // 标题和总页数
      const titleEl = infoBlock.querySelector("p.comic-title");
      const rawTitle = titleEl ? titleEl.text.trim() : id;
      const title = trimTitle(rawTitle);
      let totalPages = 1;
      const pageMatch = /\((\d+)\)/.exec(rawTitle);
      if (pageMatch) {
        totalPages = parseInt(pageMatch[1], 10) || 1;
      }

      // 封面
      const img = infoBlock.querySelector("img.comic-thumb");
      const cover = img ? img.attributes["src"] : "";

      // 作者
      const authorButtons = infoBlock.querySelectorAll(
        'a[href^="/author/"] button'
      );
      const authors = Array.from(authorButtons).map((b) => b.text.trim());

      // 分类标签
      const catButtons = infoBlock.querySelectorAll('a[href^="/cat/"] button');
      const categories = Array.from(catButtons).map((b) => b.text.trim());

      // 更新时间
      const dateEl = infoBlock.querySelector("p.comic-date");
      const uploadTime = dateEl ? dateEl.text.trim() : "";

      // 章节列表
      const allPageLinks = doc.querySelectorAll('a[href^="/page/"]');
      let eps = [];
      
      allPageLinks.forEach((a) => {
        const href = a.attributes["href"];
        // 检查这个链接是否属于当前漫画
        const linkComicId = parseIdFromHref(href);
        if (linkComicId === id) {
          const epId = parseEpIdFromHref(href);
          if (epId) {
            let text = a.text.trim();
            if (!text) {
              const btn = a.querySelector("button");
              if (btn) text = btn.text.trim();
            }
            eps.push({
              id: epId,
              title: text || `第${epId}話`,
            });
          }
        }
      });

      // tags Map
      const tags = new Map();
      if (authors.length) tags.set("authors", authors);
      if (categories.length) tags.set("categories", categories);

      // 构建 chapters Map
      const chapters = new Map();
      eps.forEach((ep) => {
        chapters.set(ep.id, ep.title);
      });

      this.currentComic = {
        id,
        title,
        cover,
        authors,
        categories,
        eps,
      };

      return new ComicDetails({
        title,
        cover,
        tags,
        chapters,
        maxPage: totalPages,
        thumbnails: [cover],
        uploadTime,
        url: url,
        recommend: undefined,
      });
    },

    /**
     * 载入章节图片
     * @param comicId {string}
     * @param epId {string}
     * @returns {Promise<{images: string[]}>}
     */
    loadEp: async (comicId, epId) => {
      const encodedComicId = encodeURI(comicId);
      let path = `/page/${encodedComicId}`;
      if (epId) {
        // epId 里可能有 11.5、14.2 等，直接当原始字符串 encode 一下
        path += "/" + encodeURIComponent(epId);
      }
      const url = JCOMIC_BASE + path;

      const resp = await Network.get(url, { referer: JCOMIC_REFERER });
      if (resp.status !== 200) throw new Error(resp.status);

      const doc = new HtmlDocument(resp.body);
      const imgs = doc.querySelectorAll("img.comic-thumb");
      const images = Array.from(imgs).map((img) => img.attributes["src"]);

      return { images };
    },

    onImageLoad: (url, comicId, epId) => {
      return {
        url,
        headers: {
          referer: JCOMIC_REFERER,
        },
      };
    },

    onThumbnailLoad: (url) => {
      return {
        url,
        headers: {
          referer: JCOMIC_REFERER,
        },
      };
    },

    onClickTag: (namespace, tag) => {
      const keyword = tag; 
      return {
        page: "category",
        attributes: {
          category: "分類",
          param: keyword,
        },
      };
    },

    link: {
      domains: ["jcomic.net"],
      linkToId: (url) => {
        const reg = /https?:\/\/jcomic\.net\/(?:eps|page)\/([^\/?#]+)(?:\/[^\/?#]+)?/;
        const m = reg.exec(url);
        if (!m) throw new Error("Invalid jcomic url");
        return decodeURIComponent(m[1]);
      },
    },
  };
}