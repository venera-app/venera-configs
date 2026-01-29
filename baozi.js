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
      options: [{ value: "cn", text: "简体" }, { value: "tw", text: "繁體" }],
      default: "cn",
    },
    domains: {
      title: "主域名",
      type: "select",
      options: [{ value: "bzmgcn.com" }, { value: "baozimhcn.com" }, { value: "webmota.com" }, { value: "kukuc.co" }, { value: "twmanga.com" }, { value: "dinnerku.com" }],
      default: "bzmgcn.com",
    },
    image_quality: {
      title: "图片质量",
      type: "select",
      options: [{ value: "/w640", text: "640p" }, { value: "", text: "原图" }],
      default: "/w640",
    },
  };

  get lang() { return this.loadSetting("language") || "cn"; }
  get baseUrl() {
    let domain = this.loadSetting("domains") || "bzmgcn.com";
    return `https://${this.lang}.${domain}`;
  }
  parseComic(e) {
    try {
      let a = e.querySelector("a");
      let h3 = e.querySelector("h3");
      let img = e.querySelector("amp-img");
      if (!a || !h3) return null;

      let id = (a.attributes["href"] || "").split("/").pop() || "";
      let title = h3.text.trim() || "未知标题";
      let cover = img?.attributes["src"] || "";
      let tags = e.querySelectorAll("div.tabs > span").map((t) => t.text.trim()).filter(Boolean);
      let description = e.querySelector("small")?.text?.trim() || "";

      if (!id) return null;

      return new Comic({
        id: id,
        title: title,
        cover: cover,
        tags: tags,
        description: description,
      });
    } catch (err) { return null; }
  }

  parseJsonComic(e) {
    return new Comic({
      id: (e.comic_id || "").toString(),
      title: e.name || "未知",
      subTitle: e.author || "",
      cover: `https://static-tw.baozimh.com/cover/${e.topic_img}?w=285&h=375&q=100`,
      tags: e.type_names || [],
    });
  }

  explore = [
    {
      title: "包子漫画",
      type: "singlePageWithMultiPart",
      load: async () => {
        let res = await Network.get(this.baseUrl);
        if (res.status !== 200) throw "网络错误: " + res.status;
        let document = new HtmlDocument(res.body);
        let parts = document.querySelectorAll("div.index-recommend-items");
        
        let result = {};
        for (let part of parts) {
          let titleNode = part.querySelector("div.catalog-title");
          if (!titleNode) continue;
          
          let title = titleNode.text.trim();
          let comics = part.querySelectorAll("div.comics-card")
                           .map((e) => this.parseComic(e))
                           .filter(Boolean); // 彻底过滤掉 null
          
          if (comics.length > 0) {
            result[title] = comics;
          }
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
      let json = JSON.parse(res.body);
      let items = (json.items || []).map((e) => this.parseJsonComic(e)).filter(Boolean);
      return {
        comics: items,
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
      let document = new HtmlDocument(res.body);
      let comics = document.querySelectorAll("div.comics-card")
                           .map((e) => this.parseComic(e))
                           .filter(Boolean);
      return { comics: comics, maxPage: 1 };
    },
    optionList: [],
  };

  favorites = {
    multiFolder: false,
    addOrDelFavorite: async (comicId, folderId, isAdding) => {
      let op = isAdding ? "set_bookmark" : "del_bookmark";
      await Network.post(`${this.baseUrl}/user/operation_v2?op=${op}&comic_id=${comicId}${isAdding ? '&chapter_slot=0' : ''}`);
      return "ok";
    },
    loadComics: async () => {
      let res = await Network.get(`${this.baseUrl}/user/my_bookshelf`);
      let document = new HtmlDocument(res.body);
      let comics = document.querySelectorAll("div.bookshelf-items").map((e) => {
        let a = e.querySelector("h4 > a");
        if (!a) return null;
        return new Comic({
          id: (a.attributes["href"] || "").split("/").pop(),
          title: a.text.trim(),
          subTitle: e.querySelector("div.info > ul")?.children[1]?.text?.split("：")[1]?.trim() || "",
          cover: e.querySelector("amp-img")?.attributes["src"] || "",
        });
      }).filter(Boolean);
      return { comics, maxPage: 1 };
    },
  };

  comic = {
    loadInfo: async (id) => {
      let res = await Network.get(`${this.baseUrl}/comic/${id}`);
      let document = new HtmlDocument(res.body);

      let title = document.querySelector("h1.comics-detail__title")?.text?.trim() || "未知标题";
      let cover = document.querySelector("div.l-content amp-img")?.attributes["src"] || "";
      let author = document.querySelector("h2.comics-detail__author")?.text?.trim() || "未知作者";
      let description = document.querySelector("p.comics-detail__desc")?.text?.trim() || "";
      
      let chapters = new Map();
      let spans = document.querySelectorAll(".comics-chapters > a > div > span");
      if (spans.length > 0) {
        spans.forEach((s, i) => chapters.set(i.toString(), s.text.trim()));
      } else {
        chapters.set("0", "开始阅读");
      }

      let recommend = document.querySelectorAll("div.recommend--item").map(c => {
        let a = c.querySelector("a");
        if (!a) return null;
        return new Comic({
          id: a.attributes["href"].split("/").pop(),
          title: c.querySelector("span")?.text?.trim() || "推荐",
          cover: c.querySelector("amp-img")?.attributes["src"] || "",
        });
      }).filter(Boolean);

      return new ComicDetails({
        title, cover, description,
        tags: { "作者": [author], "标签": [] },
        chapters,
        related: recommend,
      });
    },
    loadEp: async (comicId, epId) => {
      let url = `https://appcn.baozimh.com/baozimhapp/comic/chapter/${comicId}/0_${epId}.html`;
      let res = await Network.get(url);
      let doc = new HtmlDocument(res.body);
      let images = doc.querySelectorAll(".comic-contain__item").map(img => {
        let src = img.attributes["data-src"] || img.attributes["src"];
        if (src && (src.includes("baozimh.com") || src.includes("webmota.com"))) {
          return `https://as.baozimh.com${this.loadSetting("image_quality") || ""}${src.replace(/^https?:\/\/[^\/]+/, "")}`;
        }
        return src;
      }).filter(Boolean);
      return { images };
    },
  };
        }
