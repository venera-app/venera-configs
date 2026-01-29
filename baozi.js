class Baozi extends ComicSource {
  name = "包子漫画";
  key = "baozi";
  version = "1.1.5";
  minAppVersion = "1.0.0";
  url = "https://cdn.jsdelivr.net/gh/venera-app/venera-configs@main/baozi.js";

  settings = {
    language: {
      title: "简繁切换",
      type: "select",
      options: [
        { value: "cn", text: "简体" },
        { value: "tw", text: "繁體" },
      ],
      default: "cn",
    },
    domains: {
      title: "主域名",
      type: "select",
      options: [
        { value: "bzmgcn.com" },
        { value: "baozimhcn.com" },
        { value: "webmota.com" },
        { value: "kukuc.co" },
        { value: "twmanga.com" },
        { value: "dinnerku.com" },
      ],
      default: "bzmgcn.com",
    },
    image_quality: {
      title: "图片质量",
      type: "select",
      options: [
        { value: "/w640", text: "640p" },
        { value: "", text: "原图" }
      ],
      default: "/w640",
    },
  };

  get lang() {
    return this.loadSetting("language") || "cn";
  }
  
  get baseUrl() {
    let domain = this.loadSetting("domains") || "bzmgcn.com";
    return `https://${this.lang}.${domain}`;
  }

  account = {
    login: async (account, pwd) => {
      const boundary = "----WebKitFormBoundaryFUNUxpOwyUaDop8s";
      let res = await Network.post(
        `${this.baseUrl}/api/bui/signin`,
        { "content-type": `multipart/form-data; boundary=${boundary}` },
        `--${boundary}\r\nContent-Disposition: form-data; name="username"\r\n\r\n${account}\r\n--${boundary}\r\nContent-Disposition: form-data; name="password"\r\n\r\n${pwd}\r\n--${boundary}--\r\n`
      );
      if (res.status !== 200) throw `Login Failed: ${res.status}`;
      let json = JSON.parse(res.body);
      if (!json.data) throw "Login failed: No token received";
      
      Network.setCookies(this.baseUrl, [
        new Cookie({
          name: "TSID",
          value: json.data,
          domain: this.loadSetting("domains") || "bzmgcn.com",
        }),
      ]);
      return "ok";
    },

    logout: () => {
      Network.deleteCookies(this.loadSetting("domains") || "bzmgcn.com");
    },

    registerWebsite: `${this.baseUrl}/user/signup`
  };

  parseComic(e) {
    try {
      let link = e.querySelector("a")?.attributes["href"] || "";
      let id = link.split("/").pop();
      let title = e.querySelector("h3")?.text?.trim() || "Unknown";
      let cover = e.querySelector("a > amp-img")?.attributes["src"] || "";
      let tags = e.querySelectorAll("div.tabs > span").map((i) => i.text.trim());
      let description = e.querySelector("small")?.text?.trim() || "";
      return { id, title, cover, tags, description };
    } catch (err) { return null; }
  }

  parseJsonComic(e) {
    return {
      id: e.comic_id,
      title: e.name,
      subTitle: e.author,
      cover: `https://static-tw.baozimh.com/cover/${e.topic_img}?w=285&h=375&q=100`,
      tags: e.type_names || [],
    };
  }

  explore = [
    {
      title: "包子漫画",
      type: "singlePageWithMultiPart",
      load: async () => {
        let res = await Network.get(this.baseUrl);
        if (res.status !== 200) throw `Error: ${res.status}`;
        let document = new HtmlDocument(res.body);
        let parts = document.querySelectorAll("div.index-recommend-items");
        let result = {};
        for (let part of parts) {
          let title = part.querySelector("div.catalog-title")?.text?.trim() || "推荐";
          let comics = part.querySelectorAll("div.comics-card")
                           .map((e) => this.parseComic(e))
                           .filter(Boolean);
          if (comics.length > 0) result[title] = comics;
        }
        return result;
      },
    },
  ];

  category = {
    title: "包子漫画",
    parts: [
      {
        name: "类型",
        type: "fixed",
        categories: ["全部", "恋爱", "纯爱", "古风", "异能", "悬疑", "剧情", "科幻", "奇幻", "玄幻", "穿越", "冒险", "推理", "武侠", "格斗", "战争", "热血", "搞笑", "大女主", "都市", "总裁", "后宫", "日常", "韩漫", "少年", "其它"],
        itemType: "category",
        categoryParams: ["all", "lianai", "chunai", "gufeng", "yineng", "xuanyi", "juqing", "kehuan", "qihuan", "xuanhuan", "chuanyue", "mouxian", "tuili", "wuxia", "gedou", "zhanzheng", "rexie", "gaoxiao", "danuzhu", "dushi", "zongcai", "hougong", "richang", "hanman", "shaonian", "qita"],
      },
    ],
    enableRankingPage: false,
  };

  categoryComics = {
    load: async (category, param, options, page) => {
      let res = await Network.get(
        `${this.baseUrl}/api/bzmhq/amp_comic_list?type=${param}&region=${options[0]}&state=${options[1]}&filter=%2a&page=${page}&limit=36&language=${this.lang}&__amp_source_origin=${this.baseUrl}`
      );
      if (res.status !== 200) throw `Error: ${res.status}`;
      let json = JSON.parse(res.body);
      return {
        comics: (json.items || []).map((e) => this.parseJsonComic(e)),
        maxPage: json.next ? null : page,
      };
    },
    optionList: [
      { options: ["all-全部", "cn-国漫", "jp-日本", "kr-韩国", "en-欧美"] },
      { options: ["all-全部", "serial-连载中", "pub-已完结"] },
    ],
  };

  search = {
    load: async (keyword) => {
      let res = await Network.get(`${this.baseUrl}/search?q=${encodeURIComponent(keyword)}`);
      if (res.status !== 200) throw `Error: ${res.status}`;
      let document = new HtmlDocument(res.body);
      let comics = document.querySelectorAll("div.comics-card")
                           .map((e) => this.parseComic(e))
                           .filter(Boolean);
      return { comics, maxPage: 1 };
    },
    optionList: [],
  };

  favorites = {
    multiFolder: false,
    addOrDelFavorite: async (comicId, folderId, isAdding) => {
      let op = isAdding ? "set_bookmark" : "del_bookmark";
      let res = await Network.post(`${this.baseUrl}/user/operation_v2?op=${op}&comic_id=${comicId}${isAdding ? '&chapter_slot=0' : ''}`);
      if (res.status >= 400) throw `Error: ${res.status}`;
      return "ok";
    },
    loadComics: async () => {
      let res = await Network.get(`${this.baseUrl}/user/my_bookshelf`);
      if (res.status !== 200) throw `Error: ${res.status}`;
      let document = new HtmlDocument(res.body);
      let comics = document.querySelectorAll("div.bookshelf-items").map((e) => {
        let link = e.querySelector("h4 > a");
        return {
          id: link?.attributes["href"]?.split("/").pop(),
          title: link?.text?.trim(),
          subTitle: e.querySelector("div.info > ul")?.children[1]?.text?.split("：")[1]?.trim(),
          description: e.querySelector("div.info > ul")?.children[4]?.text?.trim(),
          cover: e.querySelector("amp-img")?.attributes["src"],
        };
      }).filter(c => c.id);
      return { comics, maxPage: 1 };
    },
  };

  comic = {
    loadInfo: async (id) => {
      let res = await Network.get(`${this.baseUrl}/comic/${id}`);
      if (res.status !== 200) throw `Error: ${res.status}`;
      let document = new HtmlDocument(res.body);

      let title = document.querySelector("h1.comics-detail__title")?.text?.trim();
      let cover = document.querySelector("div.l-content amp-img")?.attributes["src"];
      let author = document.querySelector("h2.comics-detail__author")?.text?.trim();
      let tags = document.querySelectorAll("div.tag-list > span").map((e) => e.text.trim()).filter(Boolean);
      let description = document.querySelector("p.comics-detail__desc")?.text?.trim();
      
      let chapters = new Map();
      let chapterElements = document.querySelectorAll(".comics-chapters > a > div > span");
      
      if (chapterElements.length > 0) {
        chapterElements.forEach((el, index) => {
          chapters.set(index.toString(), el.text.trim());
        });
      }

      let recommend = document.querySelectorAll("div.recommend--item").map(c => {
        let link = c.querySelector("a");
        if (!link) return null;
        return {
          id: link.attributes["href"].split("/").pop(),
          title: c.querySelector("span")?.text?.trim(),
          cover: c.querySelector("amp-img")?.attributes["src"],
        };
      }).filter(Boolean);

      return new ComicDetails({
        title, cover, description,
        tags: { "作者": [author], "标签": tags },
        chapters, recommend,
        updateTime: ""
      });
    },
    loadEp: async (comicId, epId) => {
      const images = [];
      let currentPageUrl = `https://appcn.baozimh.com/baozimhapp/comic/chapter/${comicId}/0_${epId}.html`;
      const res = await Network.get(currentPageUrl);
      if (res.status !== 200) throw `Error: ${res.status}`;

      const doc = new HtmlDocument(res.body);
      const imageNodes = doc.querySelectorAll(".comic-contain__item");
      
      imageNodes.forEach((imgNode) => {
        let imgUrl = imgNode.attributes?.["data-src"] || imgNode.attributes?.["src"];
        if (imgUrl) {
          if (imgUrl.includes("baozimh.com") || imgUrl.includes("webmota.com")) {
            const path = imgUrl.replace(/^https?:\/\/[^\/]+/, "");
            const quality = this.loadSetting("image_quality") || "";
            imgUrl = `https://as.baozimh.com${quality}${path}`;
          }
          images.push(imgUrl);
        }
      });
      return { images };
    },
  };
          }
