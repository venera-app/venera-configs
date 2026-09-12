/** @type {import('./_venera_.js')} */

/**
 * 嗶哩漫畫 (www.bilimanga.net)
 *
 * 圖片本身是明文 AVIF（i.motiezw.com），沒有加密。
 * 但閱讀頁服務器會根據請求頭判斷是否為"移動端瀏覽器"：
 * 必須帶上 sec-ch-ua-mobile: ?1 等移動端 Client Hints 才會返回圖片 <img> 標籤，
 * 否則只返回"章節不支持桌面電腦端瀏覽器顯示"的佔位符。
 *
 * 頁面結構（移動版）：
 * - 首頁 "/"：多個 .book-li 卡片（a[href="/detail/{id}.html"] + img data-src + .book-title）
 * - 詳情頁 "/detail/{id}.html"：.book-title / .book-cover / .authorname / .tag-small / #bookSummary
 * - 目錄頁 "/read/{id}/catalog"：li.chapter-li a[href*="/read/"] 全部章節
 * - 閱讀頁 "/read/{mangaid}/{chapterid}.html"：#acontentz 下的 img data-src（motiezw.com）
 * - 分類 "/filter/"：標籤 tagid 1..51，分頁 /filter/lastupdate_{tagid}_0_0_0_0_0_0_{page}_0_0_0.html
 * - 搜索 "/search.html"（站點有反爬 guard，非瀏覽器環境可能返回空）
 */

class BiliManga extends ComicSource {
  name = "嗶哩漫畫";
  key = "bilimanga";
  version = "1.1.0";
  minAppVersion = "1.6.0";

  // 更新链接，请替换为你自己的托管地址
  url = "";

  get baseUrl() {
    return "https://www.bilimanga.net";
  }

  // 關鍵：帶移動端 Client Hints + night=0 cookie，閱讀頁才會返回圖片
  pageHeaders() {
    return {
      "User-Agent":
        "Mozilla/5.0 (Linux; Android 10; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36",
      "Accept":
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      "Accept-Language": "zh-TW,zh;q=0.9,en;q=0.8",
      "sec-ch-ua": '"Chromium";v="125", "Not.A/Brand";v="24"',
      "sec-ch-ua-mobile": "?1",
      "sec-ch-ua-platform": '"Android"',
    };
  }

  init() {
    // 阅读页必须带 night=0 cookie 才返回图片；通过引擎 cookie 罐保存，
    // 避免手动 Cookie 头覆盖后续 WebView 登录产生的登录 cookie。
    try {
      Network.setCookies(this.baseUrl, [
        new Cookie({ name: "night", value: "0", domain: "www.bilimanga.net" }),
      ]);
    } catch (e) {}
  }

  // 账号登录（登录页有 Cloudflare 人机验证，必须走 WebView 真实浏览器）
  account = {
    loginWithWebview: {
      url: "https://www.bilimanga.net/login.php",
      checkStatus: (url, title) => {
        return (
          url.indexOf("bilimanga.net") !== -1 &&
          url.indexOf("/login.php") === -1
        );
      },
    },
    logout: () => {
      Network.deleteCookies("https://www.bilimanga.net/");
      try {
        Network.setCookies("https://www.bilimanga.net/", [
          new Cookie({ name: "night", value: "0", domain: "www.bilimanga.net" }),
        ]);
      } catch (e) {}
    },
    registerWebsite: "https://www.bilimanga.net/register.php",
  };

  async fetchBody(label, url) {
    let res = await Network.get(url, this.pageHeaders());
    if (res.status !== 200) throw label + " 请求失败: " + res.status;
    return res.body;
  }

  // 解析 .book-li 漫画卡片
  parseBookLi(el) {
    let a = el.querySelector('a[href*="/detail/"]');
    if (!a) return null;
    let href = a.attributes["href"] || "";
    let m = href.match(/\/detail\/(\d+)\.html/);
    if (!m) return null;
    let id = m[1];

    let img = el.querySelector("img");
    let cover = img
      ? img.attributes["data-src"] || img.attributes["src"] || ""
      : "";
    let title = img
      ? img.attributes["alt"] || ""
      : "";
    if (!title) {
      let titleEl = el.querySelector(".book-title");
      if (titleEl) title = titleEl.text.trim();
    }
    if (!title) title = id;

    let subTitle = "";
    let authorEl = el.querySelector(".book-author");
    if (authorEl) subTitle = authorEl.text.trim();

    return new Comic({
      id: id,
      title: title,
      subTitle: subTitle,
      cover: cover,
    });
  }

  // 解析页面上所有 .book-li
  parseBookList(html) {
    let doc = new HtmlDocument(html);
    let seen = {};
    let comics = [];
    for (let el of doc.querySelectorAll(".book-li")) {
      let c = this.parseBookLi(el);
      if (!c || seen[c.id]) continue;
      seen[c.id] = true;
      comics.push(c);
    }
    doc.dispose();
    return comics;
  }

  // 从分页链接中提取最大页数
  extractMaxPage(html, fallback) {
    let doc = new HtmlDocument(html);
    let max = 1;
    for (let a of doc.querySelectorAll("a")) {
      let href = a.attributes["href"] || "";
      let text = a.text ? a.text.trim() : "";
      if (href.indexOf("/filter/") !== -1 && /^\d+$/.test(text)) {
        let n = parseInt(text);
        if (n > max) max = n;
      }
    }
    doc.dispose();
    return max > 1 ? max : fallback;
  }

  // 发现页
  explore = [
    {
      title: "嗶哩漫畫-最近更新",
      type: "multiPageComicList",
      load: async (page) => {
        let url =
          this.baseUrl +
          `/filter/postdate_0_0_0_0_0_0_0_${page}_0_0_0.html`;
        let body = await this.fetchBody("home", url);
        let comics = this.parseBookList(body);
        let maxPage = this.extractMaxPage(body, 54);
        if (maxPage < 1) maxPage = 1;
        return { comics: comics, maxPage: maxPage };
      },
    },
    {
      title: "嗶哩漫畫-排行榜",
      type: "mixed",
      load: async (page) => {
        let ranks = [
          { key: "monthvisit", title: "月點擊榜" },
          { key: "weekvisit", title: "週點擊榜" },
          { key: "monthvote", title: "月推薦榜" },
          { key: "weekvote", title: "週推薦榜" },
          { key: "monthflower", title: "月鮮花榜" },
          { key: "weekflower", title: "週鮮花榜" },
          { key: "monthegg", title: "月雞蛋榜" },
          { key: "weekegg", title: "週雞蛋榜" },
          { key: "lastupdate", title: "最近更新" },
          { key: "postdate", title: "最新入庫" },
          { key: "goodnum", title: "收藏榜" },
          { key: "newhot", title: "新書榜" },
        ];
        let parts = [];
        await Promise.all(
          ranks.map(async (r) => {
            try {
              let body = await this.fetchBody(
                "top-" + r.key,
                this.baseUrl + "/top/" + r.key + "/1.html"
              );
              parts.push({
                title: r.title,
                comics: this.parseBookList(body),
                viewMore: null,
              });
            } catch (e) {
              parts.push({ title: r.title, comics: [], viewMore: null });
            }
          })
        );
        return { data: parts, maxPage: 1 };
      },
    },
  ];

  // 分类页
  category = {
    title: "嗶哩漫畫",
    parts: [
      {
        name: "主題",
        type: "fixed",
        itemType: "category",
        categories: [
          "奇幻", "冒險", "異世界", "龍傲天", "魔法", "仙俠", "戰爭", "熱血",
          "戰鬥", "競技", "懸疑", "驚悚", "獵奇", "神鬼", "偵探", "校園",
          "日常", "JK", "JC", "青梅竹馬", "妹妹", "大小姐", "女兒", "戀愛",
          "耽美", "百合", "NTR", "後宮", "職場", "經營", "犯罪", "旅行",
          "群像", "女性視角", "歷史", "武俠", "東方", "勵志", "宅系", "科幻",
          "機戰", "遊戲", "異能", "腦洞", "病嬌", "人外", "復仇", "鬥智",
          "惡役", "間諜", "治癒",
        ],
        categoryParams: [
          "1", "2", "3", "4", "5", "6", "7", "8",
          "9", "10", "11", "12", "13", "14", "15", "16",
          "17", "18", "19", "20", "21", "22", "23", "24",
          "25", "26", "27", "28", "29", "30", "31", "32",
          "33", "34", "35", "36", "37", "38", "39", "40",
          "41", "42", "43", "44", "45", "46", "47", "48",
          "49", "50", "51",
        ],
      },
    ],
    enableRankingPage: false,
  };

  // 分类漫画加载
  categoryComics = {
    load: async (category, param, options, page) => {
      let tagid = param || "0";
      let url =
        this.baseUrl +
        `/filter/lastupdate_${tagid}_0_0_0_0_0_0_${page}_0_0_0.html`;

      let body = await this.fetchBody("categoryComics", url);
      let comics = this.parseBookList(body);
      let maxPage = this.extractMaxPage(body, comics.length > 0 ? page : 1);
      if (maxPage < 1) maxPage = 1;

      return { comics: comics, maxPage: maxPage };
    },
    optionList: [],
  };

  // 搜索（站点有 guard，非浏览器环境可能返回空结果）
  search = {
    load: async (keyword, options, page) => {
      let kw = encodeURIComponent(keyword);
      let body = await this.fetchBody(
        "search",
        `${this.baseUrl}/search.html?key=${kw}`
      );
      let comics = this.parseBookList(body);
      return { comics: comics, maxPage: 1 };
    },
    optionList: [],
    enableTagsSuggestions: false,
  };

  // 单本漫画
  comic = {
    loadInfo: async (id) => {
      let detail = await this.fetchBody("detail", this.baseUrl + "/detail/" + id + ".html");
      let doc = new HtmlDocument(detail);

      let title = "";
      let titleEl = doc.querySelector(".book-title");
      if (titleEl) title = titleEl.text.trim();

      let cover = "";
      let coverImg = doc.querySelector(".book-cover");
      if (coverImg) {
        cover = coverImg.attributes["src"] || coverImg.attributes["data-src"] || "";
      }

      let authors = [];
      for (let a of doc.querySelectorAll(".authorname a, .illname a")) {
        let t = a.text ? a.text.trim() : "";
        if (t && authors.indexOf(t) === -1) authors.push(t);
      }

      let tags = [];
      for (let a of doc.querySelectorAll(".tag-small-group.origin-left a.tag-small")) {
        let t = a.text ? a.text.trim() : "";
        if (t) tags.push(t);
      }

      let description = "";
      let summary = doc.querySelector("#bookSummary content");
      if (summary) description = summary.text.trim();
      doc.dispose();

      // 章節目錄
      let chapters = new Map();
      let catalog = await this.fetchBody(
        "catalog",
        this.baseUrl + "/read/" + id + "/catalog"
      );
      let cdoc = new HtmlDocument(catalog);
      for (let a of cdoc.querySelectorAll('li.chapter-li a[href*="/read/"]')) {
        let href = a.attributes["href"] || "";
        let m = href.match(/\/read\/\d+\/(\d+)\.html/);
        if (!m) continue;
        let chTitle = a.text ? a.text.trim() : "";
        if (!chTitle) continue;
        chapters.set(m[1], chTitle);
      }
      cdoc.dispose();

      if (chapters.size === 0) throw "未解析到章節列表";

      let tagMap = {};
      if (authors.length) tagMap["作者"] = authors;
      if (tags.length) tagMap["標籤"] = tags;

      return new ComicDetails({
        title: title || id,
        cover: cover,
        description: description,
        tags: tagMap,
        chapters: chapters,
      });
    },

    loadEp: async (comicId, epId) => {
      let body = await this.fetchBody(
        "ep",
        this.baseUrl + "/read/" + comicId + "/" + epId + ".html"
      );
      let doc = new HtmlDocument(body);
      let images = [];
      let content = doc.querySelector("#acontentz") || doc;
      for (let img of content.querySelectorAll("img")) {
        let src =
          img.attributes["data-src"] || img.attributes["src"] || "";
        if (!src) continue;
        if (src.indexOf("motiezw.com") === -1) continue;
        if (images.indexOf(src) === -1) images.push(src);
      }
      doc.dispose();
      if (images.length === 0) {
        throw "未解析到圖片（可能需要移動端環境，或章節為 VIP）";
      }
      return { images: images };
    },

    onImageLoad: (url) => {
      return {
        url: url,
        headers: {
          Referer: "https://www.bilimanga.net/",
          "User-Agent":
            "Mozilla/5.0 (Linux; Android 10; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36",
          Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
          "Accept-Language": "zh-TW,zh;q=0.9,en;q=0.8",
        },
      };
    },

    onThumbnailLoad: (url) => {
      return {
        url: url,
        headers: {
          Referer: "https://www.bilimanga.net/",
          "User-Agent":
            "Mozilla/5.0 (Linux; Android 10; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36",
          Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
          "Accept-Language": "zh-TW,zh;q=0.9,en;q=0.8",
        },
      };
    },

    // 从外部链接识别漫画 id，如 https://www.bilimanga.net/detail/1601.html
    link: {
      domains: ["bilimanga.net", "www.bilimanga.net"],
      linkToId: (url) => {
        let m = url.match(/\/detail\/(\d+)\.html/);
        return m ? m[1] : null;
      },
    },
  };
}
