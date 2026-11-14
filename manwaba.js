const MANWABA_IMAGE_KEY = "0B6666A0-BB59-1381-B746-a0E4C9AC";

// 数据源实例引用：settings 的 callback / onResponse 等回调被调用时，
// this 不保证指向数据源，用它兜底。
let __manwabaSelf = null;

// 站点校验请求 UA，统一常量，避免各处重复长字符串。
const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

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

  version = "1.2.1";

  minAppVersion = "1.5.0";

  // update url
  url = "https://cdn.jsdelivr.net/gh/venera-app/venera-configs@main/manwaba.js";

  // 线路：manwadz.cc（默认，登录/收藏可用）/ manwaxu.cc（内容全但登录 405）/ manwaze.cc（备用）
  // 实际取值由 settings.line 决定，见 init()。
  base = "https://manwadz.cc";
  api = "https://manwadz.cc/api";
  accountBase = "https://manwadz.cc";
  // 章节图源：mwtuwu.cc 可用，vip.mwtuwu.cc 超时
  imageBase = "https://38.246.114.12:8067";

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
      title: "图床地址",
      type: "input",
      // 站点会不定期更换图床，做成可输入：站点换域名时直接在这里改即可。
      // 只接受 http(s) 开头的地址，末尾斜杠会被自动去掉。
      validator: "^https?://.+",
      default: "https://38.246.114.12:8067",
      description: "留空则用默认。站点换图床时可在此填新地址，如 https://1.2.3.4:8067",
    },
    refreshRoutes: {
      title: "刷新可用线路",
      type: "callback",
      buttonText: "检测",
      // 点击后：抓站点当前线路 -> 逐条测活 -> 弹窗展示，可一键采用某条可用线路
      callback: () => {
        const self = __manwabaSelf;
        if (!self) { UI.showMessage("源未就绪，请重新打开本页面"); return; }
        return self.refreshImageRoutes();
      },
    },
    sortMode: {
      title: "收藏排序",
      type: "select",
      options: [
        { value: "update_time_desc", text: "更新时间：新→旧（默认）" },
        { value: "update_time_asc", text: "更新时间：旧→新" },
        { value: "collection_time_desc", text: "收藏时间：新→旧" },
        { value: "collection_time_asc", text: "收藏时间：旧→新" },
      ],
      default: "update_time_desc",
    },
    autoCheckin: {
      title: "自动签到",
      type: "switch",
      default: true,
      description: "打开源时自动签到（需先登录）。已签到则跳过。",
    },
    checkinButton: {
      title: "立即签到",
      type: "callback",
      buttonText: "签到",
      // callback 会被 func([]) 直接调用，this 不保证指向数据源，
      // 所以用 init() 保存的实例引用。异常必须在此捕获，宿主不会提示。
      callback: () => {
        const self = __manwabaSelf;
        if (!self || !self.doCheckin) { UI.showMessage("源未就绪，请重新打开本页面"); return; }
        return self.doCheckin()
          .then((r) => { UI.showMessage("[漫蛙吧] " + r.text); })
          .catch((e) => { UI.showMessage("[漫蛙吧] 签到失败：" + (e && e.message ? e.message : e)); });
      },
    },
  };

  init() {
    let line = "manwadz.cc";
    try { line = this.loadSetting("line") || "manwadz.cc"; } catch (e) {}
    this.base = "https://" + line;
    this.api = this.base + "/api";
    // 登录接口只有 manwadz.cc / manwaze.cc 可用；manwaxu.cc 会 405。
    this.accountBase = line === "manwaxu.cc" ? "https://manwadz.cc" : this.base;
    // 图床地址可自定义：去空白、去尾部斜杠，非法值回退到默认。
    const DEFAULT_IMAGE_BASE = "https://38.246.114.12:8067";
    try {
      let img = String(this.loadSetting("imageLine") || "").trim().replace(/\/+$/, "");
      if (!/^https?:\/\/./.test(img)) img = DEFAULT_IMAGE_BASE;
      this.imageBase = img;
    } catch (e) {
      this.imageBase = DEFAULT_IMAGE_BASE;
    }

    // 收藏排序：服务端支持 sort_by=update_time / collection_time + sort_order
    try {
      this.sortMode = this.loadSetting("sortMode") || "update_time_desc";
    } catch (e) {
      this.sortMode = "update_time_desc";
    }
    // 保存实例引用：部分回调被调用时 this 不一定指向数据源。
    __manwabaSelf = this;
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

    // 自动签到：只做一次，不阻塞主流程（失败静默）。
    // 用成功/失败标记判断，不靠文案（文案改动会让判断失效）。
    if (this.loadSetting("autoCheckin") !== false) {
      const token = this.loadData("token");
      const today = new Date().toDateString();
      if (token && this.loadData("lastCheckinDay") !== today) {
        this.doCheckin()
          .then((r) => {
            this.logger.info("自动签到: " + r.text);
            if (r.ok) this.saveData("lastCheckinDay", today);
          })
          .catch(() => {});
      }
    }
  }

  // ---------- account ----------
  account = {
    login: async (account, pwd) => {
      // 登录域名不可用时依次尝试（manwaxu.cc 的登录接口固定 405，不列入）。
      const hosts = [this.accountBase, "https://manwadz.cc", "https://manwaze.cc"];
      const tried = [];
      let lastErr = null;
      let json = null;

      for (const host of hosts) {
        if (tried.indexOf(host) >= 0) continue;
        tried.push(host);
        try {
          const res = await Network.sendRequest(
            "POST",
            `${host}/api/user/login`,
            { "Content-Type": "application/json" },
            JSON.stringify({ username: account, password: pwd })
          );
          if (res.status === 404 || res.status === 405) {
            lastErr = `HTTP ${res.status}`;
            continue; // 这个域名没有登录接口，换下一个
          }
          if (res.status !== 200) {
            lastErr = `HTTP ${res.status}`;
            continue;
          }
          json = JSON.parse(res.body);
          break;
        } catch (e) {
          lastErr = String(e && e.message ? e.message : e);
        }
      }

      if (!json) {
        throw `Login failed: ${lastErr || "no available host"}`;
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

  // ---------- 每日签到 ----------
  // 实测接口（浏览器抓包）：
  //   查状态 GET  /api/user/checkin/status  -> {has_signed_in, points_added, current_rank}
  //   签到   POST /api/user/checkin  body {"checkin_type":"fixed"} -> {code:200,msg}
  //   记录   GET  /api/user/checkin/calendar?year=&month= -> {signedDays,totalSignedThisMonth,continuousDays}
  // 需要登录令牌；全部请求带 cache-time:no 避免命中本地缓存读到旧状态。
  checkin = {
    // 查询今天是否已签
    status: async () => {
      const res = await Network.sendRequest(
        "GET",
        `${this.base}/api/user/checkin/status`,
        { Authorization: "Bearer " + (this.loadData("token") || ""), "cache-time": "no" }
      );
      if (res.status !== 200) throw `HTTP ${res.status}`;
      const json = JSON.parse(res.body);
      if (json.code !== 200) throw json.msg || "查询失败";
      return json.data || {};
    },
    // 执行签到
    sign: async (type) => {
      const res = await Network.sendRequest(
        "POST",
        `${this.base}/api/user/checkin`,
        { Authorization: "Bearer " + (this.loadData("token") || ""), "Content-Type": "application/json", "cache-time": "no" },
        JSON.stringify({ checkin_type: type || "fixed" })
      );
      // 注意：重复签到等服务端错误也是 HTTP 200，必须看 body 里的 code，
      // 实测「今天已经签到过了」返回 {code:400, msg:...}。
      let json = null;
      try { json = JSON.parse(res.body); } catch (e) { json = null; }
      if (res.status !== 200) throw `HTTP ${res.status}`;
      if (!json) throw "签到返回异常";
      if (json.code !== 200) throw json.msg || "签到失败";
      return json;
    },
  };

  // 供设置页按钮和自动签到调用：返回 {ok, text}
  // ok=true 表示「今天已经签到了」这一事实已确认（含原本就签过），自动签到据此记录日期。
  doCheckin = async () => {
    const token = this.loadData("token");
    if (!token) return { ok: false, text: "未登录，请先登录后再签到" };

    const signedText = (d) =>
      `今日已签到（+${d.points_added || 0} 积分${d.current_rank ? "，当前第 " + d.current_rank + " 名" : ""}）`;

    try {
      // 1) 先问服务端今天签没签，已签直接返回，不再发签到请求
      const st = await this.checkin.status();
      if (st.has_signed_in) return { ok: true, text: signedText(st) };

      // 2) 未签则签到
      const r = await this.checkin.sign("fixed");
      const msg = r.msg || "签到成功";

      // 3) 签完复核一次，顺带取回积分/名次；查不到也不影响签到结果
      try {
        const after = await this.checkin.status();
        if (after && after.has_signed_in) {
          return { ok: true, text: `${msg}（+${after.points_added || 0} 积分${after.current_rank ? "，当前第 " + after.current_rank + " 名" : ""}）` };
        }
      } catch (e) { /* 复核失败不影响结果 */ }
      return { ok: true, text: msg };
    } catch (e) {
      if (isAuthError(e)) {
        this.deleteData("token");
        return { ok: false, text: "登录已失效，请重新登录" };
      }
      // 服务端说「已经签到过了」：今天确实已签，算成功
      const m = String(e && e.message ? e.message : e);
      if (/已经签到/.test(m)) return { ok: true, text: "今日已签到" };
      return { ok: false, text: "签到失败：" + m };
    }
  };

  // ---------- 图床线路检测 ----------
  // 从站点详情页读 window.IMAGE_ROUTES（站点自己维护的线路表），
  // 再用某一话的前几张图逐条探测，判断哪条线路当前可用。
  // 全程只读，不改任何数据；用户点"采用"才写入 imageLine 设置。

  // 抓取站点当前声明的图床线路
  fetchImageRoutes = async () => {
    const res = await Network.sendRequest("GET", `${this.base}/comic/1`, {
      "User-Agent": BROWSER_UA,
      Referer: `${this.base}/`,
      "cache-time": "no",
    });
    if (res.status !== 200) throw `详情页 HTTP ${res.status}`;
    const m = String(res.body).match(/IMAGE_ROUTES\s*=\s*(\[[\s\S]*?\])\s*;/);
    if (!m) throw "站点页面里未找到线路表（可能已改版）";
    const arr = JSON.parse(m[1]);
    return arr
      .map((x) => ({ name: x.Name || "线路", url: String(x.Url || "").trim().replace(/\/+$/, "") }))
      .filter((x) => x.url);
  };

  // 用某条线路探测一话前几张图是否可下载
  probeImageRoute = async (base, epId, n) => {
    const api = `${this.base}/api/comic/image/${epId}?page=1&page_size=${n}&image_source=${encodeURIComponent(base)}`;
    const r = await Network.sendRequest("GET", api, { "User-Agent": BROWSER_UA, "cache-time": "no" });
    if (r.status !== 200) return { okCount: 0, total: 0, error: "接口 HTTP " + r.status };
    let data;
    try { data = JSON.parse(r.body); } catch (e) { return { okCount: 0, total: 0, error: "接口返回异常" }; }
    const urls = ((data.data && data.data.images) || []).map((x) => x.url);
    if (!urls.length) return { okCount: 0, total: 0, error: "接口未返回图片" };
    let ok = 0;
    for (const u of urls) {
      try {
        // 图片是二进制，必须用 fetchBytes（body 为 ArrayBuffer）判断真实字节数；
        // sendRequest 返回的是 UTF-8 文本，会被解码破坏、长度不可信。
        const res = await Network.fetchBytes("GET", u, { "User-Agent": BROWSER_UA, Referer: `${this.base}/` });
        const nbytes = res && res.body ? (res.body.byteLength !== undefined ? res.body.byteLength : res.body.length) : 0;
        if (res.status === 200 && nbytes > 1000) ok++;
      } catch (e) { /* 单张失败忽略 */ }
    }
    return { okCount: ok, total: urls.length };
  };

  // 设置页"检测"按钮入口
  refreshImageRoutes = async () => {
    let routes, epId;
    try {
      routes = await this.fetchImageRoutes();
      // 取一章用于探测。探测用的漫画要选图片较稳定的样本，
      // 换多本多话尝试，直到找到有章节的。
      let ch = null;
      const probeComics = [137419, 94399, 112156];
      for (const cid of probeComics) {
        try {
          const r = await Network.sendRequest(
            "GET", `${this.base}/api/comic/chapter?comicId=${cid}&page=1&page_size=2`,
            { "User-Agent": BROWSER_UA, "cache-time": "no" });
          const j = JSON.parse(r.body);
          if (j && j.data && j.data.length) { ch = j; break; }
        } catch (e) { /* 换下一本 */ }
      }
      epId = ch && ch.data && ch.data[0] && ch.data[0].id;
    } catch (e) {
      UI.showMessage("读取线路失败：" + (e && e.message ? e.message : e));
      return;
    }
    if (!epId) { UI.showMessage("未取到测试章节，无法检测"); return; }

    // 逐条测活
    const results = [];
    for (const r of routes) {
      let pr;
      try { pr = await this.probeImageRoute(r.url, epId, 5); }
      catch (e) { pr = { okCount: 0, total: 0, error: String(e && e.message ? e.message : e) }; }
      results.push({ name: r.name, url: r.url, okCount: pr.okCount, total: pr.total, error: pr.error, usable: pr.okCount > 0 });
    }

    // 每条线路一行，格式：「✅ 线路1 4/5 · 38.246.114.12:8067」，
    // 当前使用的那条末尾加标记，一眼能分辨。
    const options = results.map((r) => {
      const mark = r.usable ? "✅" : "❌";
      const detail = r.total ? `${r.okCount}/${r.total}` : "无响应";
      const cur = r.url === this.imageBase ? "（当前）" : "";
      return `${mark} ${r.name} ${detail} · ${r.url}${cur}`;
    });

    // 默认选中：优先当前线路，否则第一条可用线路
    let initial = results.findIndex((r) => r.url === this.imageBase);
    if (initial < 0) initial = results.findIndex((r) => r.usable);

    // 没有可用线路时直接提示，不弹选择框
    if (!results.some((r) => r.usable)) {
      UI.showMessage(`没有可用线路（共 ${results.length} 条均失败），可稍后再试`);
      return;
    }

    const idx = await UI.showSelectDialog("选择图床线路（✅可用 ❌不可用）", options, initial >= 0 ? initial : 0);
    if (idx === null || idx === undefined || idx < 0 || idx >= results.length) return; // 用户取消

    const picked = results[idx];
    if (!picked.usable) {
      UI.showMessage(picked.name + " 当前不可用（" + (picked.total ? picked.okCount + "/" + picked.total : "无响应") + "），未切换");
      return;
    }
    this.saveData("imageLine", picked.url);
    this.imageBase = picked.url;
    UI.showMessage("已切换到 " + picked.name + "：" + picked.url);
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
      // 引擎不提供 URLSearchParams，手工拼查询串。
      const qs = [`page=${encodeURIComponent(page)}`];
      if (status !== "2") qs.push(`status=${encodeURIComponent(status)}`);
      if (day !== "0") qs.push(`day=${encodeURIComponent(day)}`);
      const url = `${this.base}${path}?${qs.join("&")}`;

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

      // 章节列表：服务端把 page_size 硬限制为 20（传 50/100 都只回 20 条），
      // 所以必须逐页翻，页数由 pagination.total 推出来。
      const chapterApi = `${this.base}/api/comic/chapter`;
      const pageSize = 20;
      const first = await this.fetchJson(chapterApi, {
        params: { comicId: data.id, page: 1, page_size: pageSize },
      });
      const total = (first.pagination && first.pagination.total) || 0;
      const pageCount = Math.max(1, Math.ceil(total / pageSize));

      const chapters = new Map();
      const addChapters = (list) => {
        (list || []).forEach((item) => {
          chapters.set(item.id.toString(), item.title.toString());
        });
      };
      addChapters(first.data);
      for (let page = 2; page <= pageCount; page++) {
        const res = await this.fetchJson(chapterApi, {
          params: { comicId: data.id, page: page, page_size: pageSize },
        });
        addChapters(res.data);
        if (!res.data || res.data.length === 0) break;
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

      // 收藏排序（服务端支持）。只有 update_time / collection_time 两种维度，
      // 传其它值服务端会忽略并退回默认，所以这里做白名单。
      const modeMap = {
        update_time_desc: ["update_time", "desc"],
        update_time_asc: ["update_time", "asc"],
        collection_time_desc: ["collection_time", "desc"],
        collection_time_asc: ["collection_time", "asc"],
      };
      const sortCfg = modeMap[this.sortMode] || modeMap.update_time_desc;
      params.sort_by = sortCfg[0];
      params.sort_order = sortCfg[1];
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
