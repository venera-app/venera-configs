const MANWABA_IMAGE_KEY = "0B6666A0-BB59-1381-B746-a0E4C9AC";

// 判断是否为鉴权类错误（HTTP 401/403）。fetchJson 抛的是字符串模板错误。
function isAuthError(e) {
  const msg = String(e && e.message ? e.message : e);
  return /status code: (401|403)/.test(msg) || /Unauthorized/i.test(msg) || /Forbidden/i.test(msg);
}

// 不同线路返回的字段大小写不一致（如 categories 的 Id / id），统一用 pick() 兼容。


// 图片解密：站点所有 /en_images 图片都是 IV(16B) + AES-256-CBC 包裹，已是图片则原样返回。
function manwabaDecryptImage(bytes) {
  const input = new Uint8Array(bytes);
  const isImage = (d) =>
    (d[0] === 0xff && d[1] === 0xd8) ||
    (d[0] === 0x89 && d[1] === 0x50) ||
    (d[0] === 0x47 && d[1] === 0x49) ||
    (d[0] === 0x52 && d[1] === 0x49) ||
    (d[0] === 0x57 && d[1] === 0x45 && d[2] === 0x42 && d[3] === 0x50) ||
    (d[0] === 0x42 && d[1] === 0x4d);
  if (isImage(input)) return bytes;
  if (input.length < 32 || (input.length - 16) % 16 !== 0) return bytes;
  const iv = new Uint8Array(input.slice(0, 16));
  const ciphertext = new Uint8Array(input.slice(16));
  let padded;
  try {
    const key = Convert.encodeUtf8(MANWABA_IMAGE_KEY);
    padded = Convert.decryptAesCbc(ciphertext.buffer, key, iv.buffer);
  } catch (e) {
    return bytes;
  }
  if (!padded) return bytes;
  let plain = new Uint8Array(padded);
  const padding = plain[plain.length - 1];
  if (padding >= 1 && padding <= 16 && padding <= plain.length) {
    let valid = true;
    for (let i = plain.length - padding; i < plain.length; i++) {
      if (plain[i] !== padding) { valid = false; break; }
    }
    if (valid) plain = plain.slice(0, plain.length - padding);
  }
  if (!isImage(plain)) return bytes;
  return plain.buffer;
}

function pick(obj, name) {
  if (obj === null || obj === undefined) return undefined;
  if (obj[name] !== undefined) return obj[name];
  const lower = name.charAt(0).toLowerCase() + name.slice(1);
  if (obj[lower] !== undefined) return obj[lower];
  const upper = name.charAt(0).toUpperCase() + name.slice(1);
  if (obj[upper] !== undefined) return obj[upper];
  return undefined;
}

/** @type {import('./_venera_.js')} */
class ManWaBa extends ComicSource {
  // name of the source
  name = "漫蛙吧";

  // unique id of the source
  key = "manwaba";

  version = "1.0.5";

  minAppVersion = "1.5.0";

  // update url
  url = "https://cdn.jsdelivr.net/gh/venera-app/venera-configs@main/manwaba.js";

  // 线路：manwadz.cc（默认，登录/收藏可用）/ manwaxu.cc（内容全但登录 405）/ manwaze.cc（备用）
  // 实际取值由 settings.line 决定，见 init()。
  base = "https://manwadz.cc";
  api = "https://manwadz.cc/api";
  accountBase = "https://manwadz.cc";
  // 章节图源：mwtuwu.cc 可用，vip.mwtuwu.cc 超时
  imageBase = "https://mwtuwu.cc";

  // 默认存入哪个收藏夹（0=未分类；可在详情页面板里选择具体收藏夹）
  settings = {
    line: {
      title: "线路",
      type: "select",
      options: [
        { value: "manwadz.cc", text: "线路1 manwadz.cc（推荐，登录/收藏可用）" },
        { value: "manwaxu.cc", text: "线路2 manwaxu.cc（内容全，但无法登录）" },
        { value: "manwaze.cc", text: "线路3 manwaze.cc（备用）" },
      ],
      default: "manwadz.cc",
    },
    imageLine: {
      title: "图床线路",
      type: "select",
      options: [
        { value: "https://mwtuwu.cc", text: "图床1 mwtuwu.cc（推荐）" },
        { value: "https://vip.mwtuwu.cc", text: "图床2 vip.mwtuwu.cc（部分网络超时）" },
      ],
      default: "https://mwtuwu.cc",
    },
  };

  init() {
    let line = "manwadz.cc";
    try { line = this.loadSetting("line") || "manwadz.cc"; } catch (e) {}
    this.base = "https://" + line;
    this.api = this.base + "/api";
    // 登录接口只有 manwadz.cc / manwaze.cc 可用；manwaxu.cc 会 405。
    this.accountBase = line === "manwaxu.cc" ? "https://manwadz.cc" : this.base;
    try { this.imageBase = this.loadSetting("imageLine") || "https://mwtuwu.cc"; } catch (e) {}
    // 保存实例引用：部分回调被调用时 this 不一定指向数据源。
    this.fetchJson = async (url, { method = "GET", params, headers, payload, withAuth = false } = {}) => {
      if (params) {
        const qs = Object.keys(params)
          .filter((k) => params[k] !== undefined && params[k] !== null)
          .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`)
          .join("&");
        if (qs) url += (url.includes("?") ? "&" : "?") + qs;
      }
      const h = { ...(headers || {}) };
      if (withAuth) {
        const token = this.loadData("token");
        if (token) h["Authorization"] = "Bearer " + token;
      }
      const res = await Network.sendRequest(method, url, h, payload);
      if (res.status !== 200) {
        // 只保留状态码：完整 body 可能很大，且会被风控误判
        throw `Invalid status code: ${res.status}`;
      }
      return JSON.parse(res.body);
    };
    this.logger = {
      error: (msg) => log("error", this.name, msg),
      info: (msg) => log("info", this.name, msg),
      warn: (msg) => log("warning", this.name, msg),
    };
  }

  // ---------- account ----------
  account = {
    login: async (account, pwd) => {
      const res = await Network.sendRequest(
        "POST",
        `${this.accountBase}/api/user/login`,
        { "Content-Type": "application/json" },
        JSON.stringify({ username: account, password: pwd })
      );
      if (res.status !== 200) throw `Login failed: HTTP ${res.status}`;
      let json;
      try {
        json = JSON.parse(res.body);
      } catch (e) {
        throw `Login failed: unexpected response`;
      }
      if (json.code !== 200 || !json.data || !json.data.token) {
        throw json.msg || "Login failed";
      }
      this.saveData("token", json.data.token);
      this.saveData("userId", json.data.userId);
      return "ok";
    },
    logout: () => {
      this.deleteData("token");
      this.deleteData("userId");
    },
    registerWebsite: null,
  };

  // explore page list
  explore = [
    {
      title: this.name,
      type: "singlePageWithMultiPart",
      load: async (page) => {
        const params = { page: 1, pageSize: 6, type: "", flag: false };
        const data = await this.fetchJson(`${this.api}/home`, { params }).then((res) => res.data);
        const groupList = {
          热门: data.comicList,
          最新完整版: data.gufengList,
          最新更新: data.xuanhuanList,
          热门收藏: data.xiaoyuanList,
        };
        const parseComic = (comic) =>
          new Comic({
            id: comic.id.toString(),
            title: comic.title,
            subTitle: comic.author,
            cover: comic.pic,
            tags: (comic.tags || "").split(",").filter((t) => t),
          });
        const result = {};
        for (const key in groupList) {
          result[key] = (groupList[key] || []).map(parseComic);
        }
        return result;
      },
    },
  ];

  // categories
  category = {
    title: this.name,
    parts: [
      {
        name: "类型",
        type: "fixed",
        categories: [
          "全部", "热血", "玄幻", "恋爱", "冒险", "古风", "都市", "穿越", "奇幻", "其他",
          "搞笑", "少男", "战斗", "重生", "逆袭", "爆笑", "少年", "后宫", "系统", "BL",
          "韩漫", "完整版", "19r", "台版",
        ],
        itemType: "category",
        categoryParams: [
          "", "热血", "玄幻", "恋爱", "冒险", "古风", "都市", "穿越", "奇幻", "其他",
          "搞笑", "少男", "战斗", "重生", "逆袭", "爆笑", "少年", "后宫", "系统", "BL",
          "韩漫", "完整版", "19r", "台版",
        ],
      },
    ],
    enableRankingPage: false,
  };

  /// 分类列表是服务端渲染的 HTML（/api/cate 返回 405），因此从页面解析。
  categoryComics = {
    load: async (category, param, options, page) => {
      const pathMap = {
        "": "/cate",
        热血: "/cate/hotblooded",
        玄幻: "/cate/xuanhuan",
        恋爱: "/cate/romance",
        冒险: "/cate/adventure",
        古风: "/cate/historical",
        都市: "/cate/urban",
        穿越: "/cate/transmigration",
        奇幻: "/cate/fantasy",
        搞笑: "/cate/comedy",
        少男: "/cate/shounen",
        战斗: "/cate/action",
        重生: "/cate/rebirth",
        逆袭: "/cate/counterattack",
        爆笑: "/cate/hilarious",
        少年: "/cate/youth",
        系统: "/cate/system",
        BL: "/cate/bl",
        韩漫: "/cate/manhwa",
        完整版: "/cate/fullversion",
        "19r": "/cate/19plus",
        台版: "/cate/taiwanver",
      };
      const path = pathMap[param] || "/cate";
      const status = options && options[0] !== undefined ? options[0] : "2";
      const day = options && options[1] !== undefined ? options[1] : "0";
      const q = new URLSearchParams();
      q.set("page", String(page));
      if (status !== "2") q.set("status", status);
      if (day !== "0") q.set("day", day);
      const url = `${this.base}${path}?${q.toString()}`;

      const res = await Network.sendRequest("GET", url, {});
      if (res.status !== 200) throw `Invalid status code: ${res.status}`;
      const doc = new HtmlDocument(res.body);
      const comics = doc.querySelectorAll("#dataList section .item").map((el) => {
        const link = el.querySelector("a");
        const href = (link && link.attributes && link.attributes.href) || "";
        const id = (href.match(/\/comic\/(\d+)/) || [])[1] || href.split("/").pop();
        const coverEl = el.querySelector(".thumb_img");
        const cover = coverEl && coverEl.attributes ? coverEl.attributes["data-src"] || coverEl.attributes["src"] : "";
        const titleEl = el.querySelector(".title");
        const descEl = el.querySelector(".desc");
        const tagsEl = el.querySelector(".badge");
        const tags = tagsEl
          ? tagsEl.querySelectorAll("span").map((s) => s.text).filter((t) => t && t !== "暂无")
          : [];
        return new Comic({
          id: String(id),
          title: titleEl ? titleEl.text.trim() : "",
          cover: cover || "",
          tags,
          description: descEl ? descEl.text.trim() : "",
        });
      });
      let maxPage = 1000;
      const m = res.body.match(/totalPages:\s*(\d+)/);
      if (m) maxPage = parseInt(m[1]);
      doc.dispose();
      return { comics, maxPage };
    },
    optionList: [
      { options: ["2-全部", "0-连载中", "1-已完结"] },
      { options: ["0-全部", "1-周一", "2-周二", "3-周三", "4-周四", "5-周五", "6-周六", "7-周日"] },
      { options: ["0-更新", "1-新作", "2-畅销", "3-热门", "4-收藏"] },
    ],
  };

  /// search related
  search = {
    load: async (keyword, options, page) => {
      const pageSize = 20;
      const params = { keyword, page, page_size: pageSize };
      const data = await this.fetchJson(`${this.api}/search`, { params }).then((res) => res.data);
      const total = data.total || 0;
      const comics = (data.list || []).map(
        (item) =>
          new Comic({
            id: item.id.toString(),
            title: item.title,
            subTitle: item.author,
            cover: item.cover,
            tags: (item.tags || "").split(",").filter((t) => t),
            description: item.description,
            status: item.status == 0 ? "连载中" : "已完结",
          })
      );
      return { comics, maxPage: Math.max(1, Math.ceil(total / pageSize)) };
    },
  };

  /// single comic related
  comic = {
    loadInfo: async (id) => {
      const data = await this.fetchJson(`${this.base}/api/comic/${id}`).then((res) => res.data);

      let chapterApi = `${this.base}/api/comic/chapter`;
      let pageRes = await this.fetchJson(chapterApi, {
        params: { comicId: data.id, page: 1, page_size: 1 },
      });
      const total = (pageRes.pagination && pageRes.pagination.total) || 0;

      let chapters = new Map();
      if (total > 0) {
        const chapterRes = await this.fetchJson(chapterApi, {
          params: { comicId: data.id, page: 1, page_size: total },
        });
        (chapterRes.data || []).forEach((item) => {
          chapters.set(item.id.toString(), item.title.toString());
        });
      }

      return new ComicDetails({
        title: data.title.toString(),
        subTitle: data.author.toString(),
        cover: data.cover,
        tags: {
          类型: (data.tags || "").split(",").filter((t) => t),
          状态: data.status == 0 ? "连载中" : "已完结",
        },
        chapters,
        description: data.intro,
        updateTime: data.editTime ? new Date(data.editTime * 1000).toLocaleDateString() : undefined,
      });
    },

    loadEp: async (comicId, epId) => {
      if (epId === undefined || epId === null || epId === "" || epId === "null" || epId === "undefined") {
        throw "章节 id 无效（当前漫画没有可用章节）";
      }
      const imgApi = `${this.base}/api/comic/image/${epId}`;
      const params = { page: 1, page_size: 1, image_source: this.imageBase };
      const pageNum = await this.fetchJson(imgApi, { params }).then((res) => res.data.pagination.total);
      const imageRes = await this.fetchJson(imgApi, {
        params: { ...params, page_size: pageNum },
      }).then((res) => res.data.images);
      return { images: (imageRes || []).map((item) => item.url) };
    },

    // 章节大图：IV(16B) + AES-256-CBC，解密走 manwabaDecryptImage()。
    onImageLoad: (url, comicId, epId) => ({
      headers: {
        Referer: comicId && epId ? `${this.base}/comic/${comicId}/${epId}` : `${this.base}/`,
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      },
      onResponse: (bytes) => manwabaDecryptImage(bytes),
    }),

    // 封面/缩略图走这里（Venera 的缩略图不经过 onImageLoad），所以解密要再做一份。
    onThumbnailLoad: (url) => ({
      headers: {
        Referer: `${this.base}/`,
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      },
      onResponse: (bytes) => manwabaDecryptImage(bytes),
    }),
  };

  // ============ 收藏（网站账号的云端收藏） ============
  // 参数名大小写不统一：查询过滤用 categoryId（驼峰），加收藏 body 用 category_id（下划线）。
  //   列表   GET  /api/user/favorites?page&page_size[&categoryId=]
  //   加收藏 POST /api/user/favorite/add     form: comic_id&category_id
  //   取消   POST /api/user/favorite/delete  form: comic_id
  //   分类   GET  /api/user/favorites/categories
  favorites = {
    multiFolder: true,
    singleFolderForSingleComic: false,

    addOrDelFavorite: async (comicId, folderId, isAdding) => {
      try {
        if (isAdding) {
          const cat = folderId && String(folderId) !== "" ? String(folderId) : "0";
          await this.fetchJson(`${this.base}/api/user/favorite/add`, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            payload: `comic_id=${encodeURIComponent(comicId)}&category_id=${encodeURIComponent(cat)}`,
            withAuth: true,
          });
        } else {
          await this.fetchJson(`${this.base}/api/user/favorite/delete`, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            payload: `comic_id=${encodeURIComponent(comicId)}`,
            withAuth: true,
          });
        }
        return "ok";
      } catch (e) {
        if (isAuthError(e)) throw `Login expired`;
        throw e;
      }
    },

    // 收藏夹列表；comicId 非空时返回该漫画所在的夹 id 数组
    loadFolders: async (comicId) => {
      let folderMap = {};
      try {
        const res = await this.fetchJson(`${this.base}/api/user/favorites/categories`, { withAuth: true });
        const data = (res && res.data) || {};
        (pick(data, "list") || []).forEach((c) => {
          const id = pick(c, "id");
          const name = pick(c, "name");
          const count = pick(c, "count");
          if (id !== undefined && id !== null) {
            folderMap[String(id)] = count !== undefined && count !== null ? `${name} (${count})` : String(name);
          }
        });
        const unc = pick(data, "uncategorized");
        if (unc !== undefined && Number(unc) > 0) {
          folderMap = Object.assign({ "0": `未分类 (${unc})` }, folderMap);
        }
      } catch (e) {
        if (isAuthError(e)) throw `Login expired`;
      }
      if (Object.keys(folderMap).length === 0) folderMap["0"] = "未分类";

          let favorited = [];
      if (comicId) {
        for (const fid of Object.keys(folderMap)) {
          if (fid === "0") continue; // 未分类不作为"在某个命名夹"的判定
          try {
            const r = await this.fetchJson(`${this.base}/api/user/favorites`, {
              params: { page: 1, page_size: 200, categoryId: fid },
              withAuth: true,
            });
            const list = pick((r && r.data) || {}, "list") || [];
            if (list.some((x) => String(pick(x, "comic_id")) === String(comicId))) {
              favorited.push(fid);
            }
          } catch (e) {
            if (isAuthError(e)) throw `Login expired`;
          }
        }
      }
      return { folders: folderMap, favorited };
    },

    loadComics: async (page, folder) => {
      const params = { page: page || 1, page_size: 20 };
          const fid = folder === null || folder === undefined ? "" : String(folder);
      if (fid !== "" && fid !== "0") params.categoryId = fid;
      let res;
      try {
        res = await this.fetchJson(`${this.base}/api/user/favorites`, { params, withAuth: true });
      } catch (e) {
        if (isAuthError(e)) throw `Login expired`;
        return { comics: [], maxPage: 1 };
      }
      const data = (res && res.data) || {};
      const list = pick(data, "list") || [];
      const comics = list
        .map((item) => {
          const id = pick(item, "comic_id");
          if (id === undefined || id === null || id === "") return null;
          const read = pick(item, "read_chapter");
          const latest = pick(item, "latest_chapter");
          const desc = [
            read && read !== "未读" ? `读到：${read}` : null,
            latest ? `最新：${latest}` : null,
          ].filter(Boolean).join(" / ") || undefined;
          return new Comic({
            id: String(id),
            title: pick(item, "title") || "",
            cover: pick(item, "cover") || "",
            description: desc,
          });
        })
        .filter((c) => c !== null);
      const maxPage = Number(pick(data, "total_page") || 1) || 1;
      return { comics, maxPage };
    },
  };
}
