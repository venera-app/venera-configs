class Baozi extends ComicSource {
  // 此漫画源的名称
  name = "包子漫画";

  // 唯一标识符
  key = "baozi";

  version = "1.1.7";

  minAppVersion = "1.0.0";

  // 更新链接
  url = "https://cdn.jsdelivr.net/gh/venera-app/venera-configs@main/baozi.js";

  // 运行时解析出的可用线路（首次请求时探测，之后复用）
  _base = null;

  // 缓存的登录凭证值（TSID）。收藏相关请求会直接带在 header 上，
  // 不依赖宿主 cookie 库的域匹配与异步写入时序。
  _tsid = null;

  // 路由 id -> 服务端认可的裸 comic_id 映射
  _idMap = null;

  // 收藏 id 列表缓存（收藏/取消后清空）
  _favIdsCache = null;

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
        { value: "twmanga.com" },
        { value: "bzmgcn.com" },
        { value: "kukuc.co" },
        { value: "dinnerku.com" },
        { value: "baozimhcn.com" },
      ],
      default: "twmanga.com",
    },
    cdn_domains: {
      title: "图片资源站域名",
      type: "select",
      options: [
        { value: "as-rsa1-usla.baozicdn.com" },
        { value: "ascn-a3.bzcdn.net" },
        { value: "asgb-a3.bzcdn.net" },
        { value: "as.baozimh.com" },
        { value: "s1.baozicdn.com" },
        { value: "", text: "默认" },
      ],
      default: "",
    },
    image_quality: {
      title: "图片质量",
      type: "select",
      options: [
        {
          value: "/w640",
          text: "640p"
        },
        {
          value: "",
          text: "原图"
        }
      ],
      default: "/w640",
    },
  };

  get lang() {
    return this.loadSetting("language") || this.settings.language.default;
  }

  get baseUrl() {
    if (this._base) {
      return this._base;
    }
    let domain = this.loadSetting("domains") || this.settings.domains.default;
    return `https://${this.lang}.${domain}`;
  }

  // 登录页特征：请求被重定向到登录页时，body 里会出现这些标记
  isSigninPage(body) {
    if (!body) return false;
    return (
      body.indexOf("登入賬號") >= 0 ||
      body.indexOf("登录账号") >= 0 ||
      body.indexOf("signin.min.js") >= 0
    );
  }

  // 探测可用线路。
  // 站点各语言子域会不定时失效（如 cn.bzmgcn.com 已 302 到带反爬的主站），
  // 这里按「用户设置优先，再依次降级」的顺序探测，避免整套功能一起挂掉。
  async ensureBase() {
    if (this._base) return this._base;
    let domain = this.loadSetting("domains") || this.settings.domains.default;
    let preferred = `${this.lang}.${domain}`;
    let list = [
      preferred,
      "cn.twmanga.com",
      "tw.bzmgcn.com",
      "tw.twmanga.com",
      "cn.dinnerku.com",
      "cn.kukuc.co",
    ];
    for (let i = 0; i < list.length; i++) {
      let host = list[i];
      let base = `https://${host}`;
      try {
        let r = await Network.get(
          `${base}/api/bzmhq/amp_comic_list?type=all&region=all&state=all&filter=%2a&page=1&limit=1`
        );
        if (r && r.status === 200 && r.body && r.body.indexOf("comic_id") >= 0) {
          this._base = base;
          return base;
        }
      } catch (e) {
        // 该线路不可用，继续试下一个
      }
    }
    this._base = `https://${preferred}`;
    return this._base;
  }

  // 取登录凭证值（TSID）。优先当前线路，取不到就从旧别名域搬过来。
  // 返回凭证字符串；没有则返回 null；宿主完全不支持读 cookie 时返回 "UNKNOWN"。
  async ensureCookie() {
    if (this._tsid) return this._tsid;
    let base = this.baseUrl;
    let cur;
    try {
      cur = await Network.getCookies(base);
    } catch (e) {
      return "UNKNOWN";
    }
    let found = null;
    if (cur && cur.length) {
      for (let i = 0; i < cur.length; i++) {
        if (cur[i] && cur[i].name === "TSID" && cur[i].value) { found = cur[i].value; break; }
      }
    }
    if (!found) {
      let hosts = [
        "https://twmanga.com",
        "https://bzmgcn.com",
        "https://baozimhcn.com",
        "https://cn.webmota.com",
        "https://webmota.com",
        "https://kukuc.co",
        "https://dinnerku.com",
      ];
      for (let i = 0; i < hosts.length && !found; i++) {
        let olds;
        try {
          olds = await Network.getCookies(hosts[i]);
        } catch (e) {
          olds = [];
        }
        if (!olds) continue;
        for (let j = 0; j < olds.length; j++) {
          let c = olds[j];
          if (c && c.name === "TSID" && c.value) { found = c.value; break; }
        }
      }
      if (found) {
        // 顺手写回当前线路，供浏览/详情等其它请求使用
        try {
          Network.setCookies(base, [new Cookie({ name: "TSID", value: found })]);
        } catch (e) {}
      }
    }
    this._tsid = found;
    return found;
  }

  // 从收藏页 HTML 里取出所有漫画 id
  extractIds(body) {
    let out = [];
    let parts = (body || "").split('class="bookshelf-items"');
    for (let i = 1; i < parts.length; i++) {
      // 优先用条目里「删除」链接带的 comic_id（这是服务端认可的裸 id）
      let m = parts[i].match(/[?&]comic_id=([^&"']+)/);
      if (m) {
        out.push(decodeURIComponent(m[1]));
        continue;
      }
      let m2 = parts[i].match(/href="\/comic\/([^"]+)"/);
      if (m2) out.push(m2[1]);
    }
    return out;
  }

  // 把任意路由 id 解析成服务端认可的裸 comic_id。
  // 站点在列表页给的是带随机后缀的 id（形如 xxx_rjogsq），这种 id 打开详情页会自动
  // 302 到带后缀版本，但收藏/取消收藏只认裸 id；这里从详情页的收藏按钮链接直接取。
  async resolveBareId(id) {
    this._idMap = this._idMap || {};
    if (this._idMap[id]) return this._idMap[id];
    let base = await this.ensureBase();
    try {
      let res = await Network.get(`${base}/comic/${id}`);
      let body = res && res.body ? res.body : "";
      let m =
        body.match(/op=(?:set|del)_bookmark&(?:amp;)?comic_id=([^&"'\s]+)/) ||
        body.match(/comic_id=([^&"'\s]+)/);
      if (m) {
        let v = m[1];
        try {
          v = decodeURIComponent(v);
        } catch (e) {}
        if (v && v.indexOf("/") < 0 && v.length > 0) {
          this._idMap[id] = v;
          return v;
        }
      }
    } catch (e) {}
    return id;
  }

  // 取当前账号的收藏 id 列表（带缓存）
  async getFavIds() {
    if (this._favIdsCache) return this._favIdsCache;
    let base = await this.ensureBase();
    let tsid = await this.ensureCookie();
    if (!tsid || tsid === "UNKNOWN") return [];
    // cache-time:no 绕过宿主的 URL 响应缓存，否则可能读到旧页面
    let res = await Network.get(`${base}/user/my_bookshelf`, { cookie: "TSID=" + tsid, "cache-time": "no" });
    if (!res || res.status !== 200 || this.isSigninPage(res.body)) return [];
    this._favIdsCache = this.extractIds(res.body);
    return this._favIdsCache;
  }

  /// 账号
  account = {
    /// 登录
    login: async (account, pwd) => {
      let base = await this.ensureBase();
      let boundary = "----WebKitFormBoundaryFUNUxpOwyUaDop8s";
      let payload =
        `--${boundary}\r\nContent-Disposition: form-data; name="username"\r\n\r\n${account}\r\n` +
        `--${boundary}\r\nContent-Disposition: form-data; name="password"\r\n\r\n${pwd}\r\n` +
        `--${boundary}--\r\n`;
      let res = await Network.post(
        `${base}/api/bui/signin`,
        { "content-type": `multipart/form-data; boundary=${boundary}` },
        payload
      );
      if (!res || res.status !== 200) {
        throw "登录接口异常: " + (res ? res.status : "无响应");
      }
      let json;
      try {
        json = JSON.parse(res.body);
      } catch (e) {
        throw "登录响应无法解析，可能线路已被重定向";
      }
      // 服务端失败时返回 {result:false, code:"ERR_..."}，旧版忽略这一步会假装登录成功
      if (!json || json.result !== true || !json.data) {
        throw "登录失败: " + (json && json.code ? json.code : "账号或密码错误");
      }
      // 不指定 domain：让 cookie 绑定在当前线路的 host 上。
      // 站点网页端把 cookie 域硬编码成 .baozimh.com，而镜像域（bzmgcn.com 等）与之不同域，
      // 指定裸域名容易在宿主侧匹配不上，hostOnly 最稳。
      Network.setCookies(base, [new Cookie({ name: "TSID", value: json.data })]);
      this._tsid = json.data;
      // 验证服务端是否真的认这个登录态
      let check = await Network.get(`${base}/user/my_bookshelf`, { "cache-time": "no" });
      if (check && check.status === 200 && this.isSigninPage(check.body)) {
        throw "登录未生效: 站点未接受登录状态，请在设置里换一个主域名后重试";
      }
      return "ok";
    },

    // 退出登录时将会调用此函数
    logout: () => {
      let domain = this.loadSetting("domains") || this.settings.domains.default;
      Network.deleteCookies(`https://${this.lang}.${domain}`);
      this._base = null;
      this._tsid = null;
    },

    get registerWebsite() {
      return `${this.baseUrl}/user/signup`;
    },
  };

  /// 解析漫画列表
  parseComic(e) {
    let url = e.querySelector("a").attributes["href"];
    let id = url.split("/").pop();
    let title = e.querySelector("h3").text.trim();
    let cover = e.querySelector("a > amp-img").attributes["src"];
    let tags = e.querySelectorAll("div.tabs > span").map((e) => e.text.trim());
    let description = e.querySelector("small").text.trim();
    return {
      id: id,
      title: title,
      cover: cover,
      tags: tags,
      description: description,
    };
  }

  parseJsonComic(e) {
    return {
      id: e.comic_id,
      title: e.name,
      subTitle: e.author,
      cover: `https://static-tw.baozimh.com/cover/${e.topic_img}?w=285&h=375&q=100`,
      tags: e.type_names,
    };
  }

  /// 探索页面
  explore = [
    {
      title: "包子漫画",

      type: "singlePageWithMultiPart",

      load: async () => {
        let base = await this.ensureBase();
        var res = await Network.get(base);
        if (res.status !== 200) {
          throw "Invalid status code: " + res.status;
        }
        let document = new HtmlDocument(res.body);
        let parts = document.querySelectorAll("div.index-recommend-items");
        let result = {};
        for (let part of parts) {
          let title = part.querySelector("div.catalog-title").text.trim();
          let comics = part
            .querySelectorAll("div.comics-card")
            .map((e) => this.parseComic(e));
          if (comics.length > 0) {
            result[title] = comics;
          }
        }
        return result;
      },
    },
  ];

  /// 分类页面
  category = {
    title: "包子漫画",
    parts: [
      {
        name: "类型",

        type: "fixed",

        categories: [
          "全部",
          "恋爱",
          "纯爱",
          "古风",
          "异能",
          "悬疑",
          "剧情",
          "科幻",
          "奇幻",
          "玄幻",
          "穿越",
          "冒险",
          "推理",
          "武侠",
          "格斗",
          "战争",
          "热血",
          "搞笑",
          "大女主",
          "都市",
          "总裁",
          "后宫",
          "日常",
          "韩漫",
          "少年",
          "其它",
        ],

        itemType: "category",

        categoryParams: [
          "all",
          "lianai",
          "chunai",
          "gufeng",
          "yineng",
          "xuanyi",
          "juqing",
          "kehuan",
          "qihuan",
          "xuanhuan",
          "chuanyue",
          "mouxian",
          "tuili",
          "wuxia",
          "gedou",
          "zhanzheng",
          "rexie",
          "gaoxiao",
          "danuzhu",
          "dushi",
          "zongcai",
          "hougong",
          "richang",
          "hanman",
          "shaonian",
          "qita",
        ],
      },
    ],
    enableRankingPage: false,
  };

  /// 分类漫画页面
  categoryComics = {
    load: async (category, param, options, page) => {
      let base = await this.ensureBase();
      let res = await Network.get(
        `${base}/api/bzmhq/amp_comic_list?type=${param}&region=${options[0]}&state=${options[1]}&filter=%2a&page=${page}&limit=36&language=${this.lang}&__amp_source_origin=${base}`
      );
      if (res.status !== 200) {
        throw "Invalid status code: " + res.status;
      }
      let maxPage = null;
      let json = JSON.parse(res.body);
      if (!json.next) {
        maxPage = page;
      }
      return {
        comics: json.items.map((e) => this.parseJsonComic(e)),
        maxPage: maxPage,
      };
    },
    optionList: [
      {
        options: ["all-全部", "cn-国漫", "jp-日本", "kr-韩国", "en-欧美"],
      },
      {
        options: ["all-全部", "serial-连载中", "pub-已完结"],
      },
    ],
  };

  /// 搜索
  search = {
    load: async (keyword, options, page) => {
      let base = await this.ensureBase();
      let res = await Network.get(`${base}/search?q=${keyword}`);
      if (res.status !== 200) {
        throw "Invalid status code: " + res.status;
      }
      let document = new HtmlDocument(res.body);
      let comics = document
        .querySelectorAll("div.comics-card")
        .map((e) => this.parseComic(e));
      return {
        comics: comics,
        maxPage: 1,
      };
    },

    optionList: [],
  };

  /// 收藏
  favorites = {
    multiFolder: false,

    /// 添加或者删除收藏
    addOrDelFavorite: async (comicId, folderId, isAdding) => {
      let base = await this.ensureBase();
      let tsid = await this.ensureCookie();
      if (!tsid || tsid === "UNKNOWN") {
        throw "未登录: 请先在账号里登录后再收藏";
      }
      let ch = "TSID=" + tsid;
      // 站点只认裸 comic_id，列表页给的是带随机后缀的 id，这里先解析成裸 id
      let bareId = await this.resolveBareId(comicId);

      // 候选 id：先裸 id，再原始 id（兜底）
      let cands = [bareId];
      if (comicId !== bareId) cands.push(comicId);

      let diag = { st: "-", tmp: "-", sg: "-", favN: "-", ids0: "-" };

      // GET/POST × 裸id/原id 依次尝试，任何一次复核通过即成功
      for (let m = 0; m < 2; m++) {
        for (let c = 0; c < cands.length; c++) {
          let id = cands[c];
          let query = isAdding
            ? `op=set_bookmark&comic_id=${encodeURIComponent(id)}&chapter_slot=0`
            : `op=del_bookmark&comic_id=${encodeURIComponent(id)}`;
          let url = `${base}/user/operation_v2?${query}`;
          let hh = { cookie: ch, "cache-time": "no" };
          let res;
          try {
            res = m === 0 ? await Network.get(url, hh) : await Network.post(url, hh);
          } catch (e) {
            continue;
          }
          if (!res) continue;
          diag.st = res.status;
          let body = res.body || "";
          diag.tmp = body.indexOf("臨時書架") >= 0 || body.indexOf("临时书架") >= 0 ? "Y" : "N";
          diag.sg = this.isSigninPage(body) ? "Y" : "N";
          if (res.status >= 400) continue;

          let verify = await Network.get(`${base}/user/my_bookshelf`, { cookie: ch, "cache-time": "no" });
          if (!verify || verify.status !== 200) continue;
          if (this.isSigninPage(verify.body)) {
            throw "登录已失效，请重新登录账号";
          }
          let ids = this.extractIds(verify.body);
          diag.favN = ids.length;
          diag.ids0 = ids.length ? ids[0].slice(0, 24) : "-";
          let present = false;
          for (let i = 0; i < ids.length; i++) {
            if (ids[i] === id || ids[i].indexOf(id) >= 0 || id.indexOf(ids[i]) >= 0) {
              present = true;
              break;
            }
          }
          if ((isAdding && present) || (!isAdding && !present)) {
            this._favIdsCache = null;
            return "ok";
          }
        }
      }
      throw "收藏操作未生效[diag base=" + base + " in=" + comicId + " bare=" + bareId + " tsidLen=" + tsid.length +
        " st=" + diag.st + " tmp=" + diag.tmp + " sg=" + diag.sg + " favN=" + diag.favN + " ids0=" + diag.ids0 + "]";
    },

    loadFolders: null,

    /// 加载收藏列表
    loadComics: async (page, folder) => {
      let base = await this.ensureBase();
      let tsid = await this.ensureCookie();
      let h = tsid && tsid !== "UNKNOWN" ? { cookie: "TSID=" + tsid, "cache-time": "no" } : { "cache-time": "no" };
      let res = await Network.get(`${base}/user/my_bookshelf`, h);
      if (!res) {
        throw "收藏页无响应";
      }
      if (res.status !== 200) {
        throw "Invalid status code: " + res.status;
      }
      let body = res.body || "";
      // 未登录时站点会 302 到登录页；宿主跟随重定向后状态码仍是 200，
      // 旧版直接解析会得到空列表，看起来像「收藏是空的」。
      if (this.isSigninPage(body)) {
        throw "未登录或登录已失效，请重新登录账号";
      }

      let document = new HtmlDocument(body);
      let nodes = document.querySelectorAll(".bookshelf-items");
      let comics = [];
      for (let i = 0; i < nodes.length; i++) {
        let e = nodes[i];
        let linkEl = e.querySelector("h4 > a");
        if (!linkEl) continue;
        let href =
          linkEl.attributes && linkEl.attributes["href"]
            ? linkEl.attributes["href"]
            : "";
        let id = "";
        // 优先从条目里「删除」链接拿服务端认可的裸 comic_id，
        // 这样详情页拿到的 id 与收藏用的 id 一致（否则详情页会误显示“未收藏”）
        if (e.querySelectorAll) {
          let anchors = e.querySelectorAll("a");
          for (let k = 0; k < anchors.length; k++) {
            let ah = anchors[k].attributes && anchors[k].attributes["href"] ? anchors[k].attributes["href"] : "";
            let am = ah.match(/[?&]comic_id=([^&"']+)/);
            if (am) { id = decodeURIComponent(am[1]); break; }
          }
        }
        if (!id) id = href ? href.split("/").pop() : "";
        if (!id) continue;

        // 作者、最新章节都从条目里按内容找，不依赖固定下标（站点会增删 li）
        let author = "";
        let description = "";
        let ul = e.querySelector("div.info > ul");
        if (ul && ul.children) {
          for (let j = 0; j < ul.children.length; j++) {
            let t = (ul.children[j].text || "").trim();
            if (!author && t.indexOf("作者") >= 0) {
              let parts = t.split(/[：:]/);
              author = parts.length > 1 ? parts[parts.length - 1].trim() : t;
            }
            if (!description && t.indexOf("最新章节") >= 0) {
              description = t;
            }
          }
        }

        let cover = "";
        let img = e.querySelector("amp-img");
        if (img && img.attributes && img.attributes["src"]) {
          cover = img.attributes["src"];
        }

        comics.push({
          id: id,
          title: (linkEl.text || "").trim(),
          subTitle: author,
          description: description,
          cover: cover,
        });
      }

      return {
        comics: comics,
        maxPage: 1,
      };
    },
  };

  /// 单个漫画相关
  comic = {
    // 加载漫画信息
    loadInfo: async (id) => {
      let base = await this.ensureBase();
      // 详情页的“是否已收藏”由 Venera 读取本字段判断，必须主动算出来
      let bareId = await this.resolveBareId(id);
      let favIds = await this.getFavIds();
      let isFav = false;
      for (let i = 0; i < favIds.length; i++) {
        if (favIds[i].indexOf(bareId) >= 0 || bareId.indexOf(favIds[i]) >= 0) {
          isFav = true;
          break;
        }
      }
      // 用裸 id 打开详情页，保证与收藏一致
      let res = await Network.get(`${base}/comic/${bareId}`);
      if (res.status !== 200) {
        throw "Invalid status code: " + res.status;
      }
      let document = new HtmlDocument(res.body);

      let title = document.querySelector("h1.comics-detail__title").text.trim();
      let cover = document.querySelector("div.l-content > div > div > amp-img")
        .attributes["src"];
      let author = document
        .querySelector("h2.comics-detail__author")
        .text.trim();
      let tags = document
        .querySelectorAll("div.tag-list > span")
        .map((e) => e.text.trim());
      tags = [...tags.filter((e) => e !== "")];
      let updateTime = document
        .querySelector("div.supporting-text > div > span > em")
        ?.text.trim()
        .replace("(", "")
        .replace(")", "");
      if (!updateTime) {
        const getLastChapterText = () => {
          const containers = [
            ...document.querySelectorAll(
              "#chapter-items, #chapters_other_list"
            ),
          ];
          let allChapters = [];
          containers.forEach((container) => {
            const chapters = container.querySelectorAll(".comics-chapters > a");
            allChapters.push(...Array.from(chapters));
          });
          const lastChapter = allChapters[allChapters.length - 1];
          return (
            lastChapter?.querySelector("div > span")?.text.trim() ||
            "暂无更新信息"
          );
        };
        updateTime = getLastChapterText();
      }
      let description = document
        .querySelector("p.comics-detail__desc")
        .text.trim();
      let chapters = new Map();
      let i = 0;
      for (let c of document.querySelectorAll(
        "div#chapter-items > div.comics-chapters > a > div > span"
      )) {
        chapters.set(i.toString(), c.text.trim());
        i++;
      }
      for (let c of document.querySelectorAll(
        "div#chapters_other_list > div.comics-chapters > a > div > span"
      )) {
        chapters.set(i.toString(), c.text.trim());
        i++;
      }
      if (i === 0) {
        // 将倒序的最新章节反转
        const spans = Array.from(
          document.querySelectorAll("div.comics-chapters > a > div > span")
        ).reverse();
        for (let c of spans) {
          chapters.set(i.toString(), c.text.trim());
          i++;
        }
      }
      let recommend = [];
      for (let c of document.querySelectorAll("div.recommend--item")) {
        if (c.querySelectorAll("div.tag-comic").length > 0) {
          let title = c.querySelector("span").text.trim();
          let cover = c.querySelector("amp-img").attributes["src"];
          let url = c.querySelector("a").attributes["href"];
          let id = url.split("/").pop();
          recommend.push({
            id: id,
            title: title,
            cover: cover,
          });
        }
      }
      // updateTime 将 Y年 M月 D日 转化为 Y-M-D
      let updateDate = updateTime
        .replace(/年/g, "-")
        .replace(/月/g, "-")
        .replace(/日/g, "");

      return new ComicDetails({
        title: title,
        cover: cover,
        description: description,
        tags: {
          作者: [author],
          标签: tags,
        },
        chapters: chapters,
        recommend: recommend,
        updateTime: updateDate,
        isFavorite: isFav,
      });
    },
    loadEp: async (comicId, epId) => {
      const images = [];

      // App版链接
      let currentPageUrl = `https://appcn.baozimh.com/baozimhapp/comic/chapter/${comicId}/0_${epId}.html`;

      const res = await Network.get(currentPageUrl);
      if (res.status !== 200) {
        throw `Invalid status code: ${res.status}`;
      }

      const doc = new HtmlDocument(res.body);

      // 解析当前页图片(App 版)
      const imageNodes = doc.querySelectorAll(".comic-contain > .chapter-img");
      imageNodes.forEach((imgNode) => {
        let imgUrl = imgNode.querySelector(".comic-contain__item")?.attributes?.["data-src"];
        if (imgUrl) {
          const match = imgUrl.match(/^(https?:\/\/)?([^/\s:]+)(:\d+)?(\/[a-z]comic\/.*)/);
          if (match) {
            const domain = this.loadSetting("cdn_domains") === "" ? match[2] : this.loadSetting("cdn_domains");
            imgUrl = `${match[1]}${domain}${this.loadSetting("image_quality")}${match[4]}`;
          }
          images.push(imgUrl);
        }
      });
      return { images: images };
    },
  };
}
