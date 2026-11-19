const MANWABA_IMAGE_KEY = "0B6666A0-BB59-1381-B746-a0E4C9AC";

// 数据源实例引用：settings 的 callback / onResponse 等回调被调用时，
// this 不保证指向数据源，用它兜底。
let __manwabaSelf = null;

// 站点校验请求 UA，统一常量，避免各处重复长字符串。
const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

// 站点"走失页"（发布页）：站点换域名时在这里公布最新线路，可动态解析。
const MANWABA_LOST_PAGE = "https://manwami.cc/";
// 走失页解析失败时的兜底候选线路（2026-11-19 实测均为直连可用）
const MANWABA_FALLBACK_LINES = [
  "manwauu.cc",
  "manwarr.cc",
  "www.manwamm.cc",
  "manwayy.cc",
  "www.manwawz.cc",
];
// 默认线路（走失页"漫蛙地址一"）
const MANWABA_DEFAULT_LINE = "manwauu.cc";
// 已知会 301 跳转/已失效的旧线路，读到这些值自动迁移到默认线路
const MANWABA_DEAD_LINES = ["manwadz.cc", "manwaxu.cc", "manwaze.cc"];
// 图床兜底列表（IMAGE_ROUTES 与图片 URL 都拿不到时使用）
const MANWABA_FALLBACK_IMAGE_HOSTS = [
  "https://52.128.238.250:5367",
  "https://38.147.106.154:8088",
  "https://38.246.114.12:8067",
  "https://mwtusi.cc",
  "https://tu.mwzu.cc",
];

// 判断是否为鉴权类错误（HTTP 401/403）。
// Venera 的 Dio 抛错文本形如 "Invalid Status Code: 401. The Request is unauthorized."，
// 也可能带 "status code of 401" / "HTTP 401"，这里全部兼容。
function isAuthError(e) {
  const msg = String(e && e.message ? e.message : e);
  return (
    /(status\s*code|invalid\s*status\s*code)[^0-9]{0,12}(401|403)/i.test(msg) ||
    /\bHTTP\s*(401|403)\b/i.test(msg) ||
    /Unauthorized/i.test(msg) ||
    /Forbidden/i.test(msg)
  );
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

  version = "1.3.1";

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
  // 动态选项缓存（由 discoverDynamicOptions / _applyDynamicOptions 填充）
  _lineOptsCache = null;
  _imageOptsCache = null;

  // settings 用 getter：每次被读取（Venera 渲染设置页时）都重新生成，
  // 并用 loadSetting 取「保存的值」确保它一定在选项里——
  // 否则 Venera 渲染 select 时 firstWhere 找不到会抛异常，整个设置项消失。
  get settings() {
    let lineOpts = (this._lineOptsCache || [
      { value: "manwauu.cc", text: "manwauu.cc" },
      { value: "manwarr.cc", text: "manwarr.cc" },
      { value: "manwayy.cc", text: "manwayy.cc" },
    ]).map((o) => ({ value: o.value, text: o.text }));
    try {
      const cur = this.loadSetting("line");
      if (cur && !lineOpts.some((o) => o.value === cur)) lineOpts.unshift({ value: cur, text: cur });
    } catch (e) {}

    let imgOpts = (this._imageOptsCache || [
      { value: "https://52.128.238.250:5367", text: "52.128.238.250:5367" },
      { value: "https://38.147.106.154:8088", text: "38.147.106.154:8088" },
    ]).map((o) => ({ value: o.value, text: o.text }));
    try {
      const cur = this.loadSetting("imageLine");
      if (cur && !imgOpts.some((o) => o.value === cur)) {
        imgOpts.unshift({ value: cur, text: String(cur).replace(/^https?:\/\//, "") });
      }
    } catch (e) {}

    return {
      line: {
        title: "线路",
        type: "select",
        options: lineOpts,
        default: "manwauu.cc",
      },
      imageLine: {
        title: "图床",
        type: "select",
        options: imgOpts,
        default: "https://52.128.238.250:5367",
      },
      autoSetup: {
        title: "线路与图床一键设置",
        type: "callback",
        buttonText: "检测并设置",
        callback: () => {
          const self = __manwabaSelf;
          if (!self || !self.setupLineAndImage) { UI.showMessage("源未就绪"); return; }
          return self.setupLineAndImage().catch((e) => {
            UI.showMessage("检测失败：" + (e && e.message ? e.message : e));
          });
        },
      },
      commentSort: {
        title: "评论排序",
        type: "select",
        options: [
          { value: "time", text: "按时间（最新优先）" },
          { value: "hot", text: "按热度" },
        ],
        default: "time",
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
        callback: () => {
          const self = __manwabaSelf;
          if (!self || !self.doCheckin) { UI.showMessage("源未就绪"); return; }
          return self.doCheckin()
            .then((r) => { UI.showMessage(r.text); })
            .catch((e) => { UI.showMessage("签到失败：" + (e && e.message ? e.message : e)); });
        },
      },
    };
  }

  init() {
    let line = MANWABA_DEFAULT_LINE;
    try { line = String(this.loadSetting("line") || "").trim() || MANWABA_DEFAULT_LINE; } catch (e) {}
    // 旧线路（已 301 跳转/失效）自动迁移到默认线路，避免老用户升级后签到/收藏全挂。
    if (MANWABA_DEAD_LINES.indexOf(line) >= 0) {
      line = MANWABA_DEFAULT_LINE;
      try { this._saveSetting("line", line); } catch (e) {}
    }
    this.base = "https://" + line;
    this.api = this.base + "/api";
    // 现各线路均支持登录，直接用当前 base。
    this.accountBase = this.base;
    // 图床地址可自定义：去空白、去尾部斜杠，非法值回退到默认。
    const DEFAULT_IMAGE_BASE = "https://52.128.238.250:5367";
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

    // 评论排序：站点支持 sort=time（按时间）/ hot（按热度）
    try {
      this.commentSort = this.loadSetting("commentSort") || "time";
    } catch (e) {
      this.commentSort = "time";
    }
    // 保存实例引用：部分回调被调用时 this 不一定指向数据源。
    __manwabaSelf = this;
    this.fetchJson = async (url, { method = "GET", params, headers, payload, withAuth = false, noCache = false } = {}) => {
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
      // 缓存纪律：带认证的 GET（收藏/评论/用户信息等个人数据）必须读最新，
      // 否则会显示缓存旧快照，把真实的 401/失败掩盖成"看着正常"。
      if (noCache || (withAuth && method === "GET")) h["cache-time"] = "no";
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

    // 后台发现最新线路/图床并刷新下拉选项（不阻塞启动）。
    this.discoverDynamicOptions().catch(() => {});

    // 自动线路跟随：后台校验当前线路是否可用，失效则自动切换（不阻塞、失败静默）。
    this.autoFollowLine().catch(() => {});

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
        // 401/403：可能是登录过期，也可能是线路跳转导致凭证丢失。
        // 不直接删 token（避免误删有效凭证），提示用户先重新登录/换线路。
        return { ok: false, text: "登录已失效或线路异常：请重新登录；若仍失败请用「线路与图床一键设置」" };
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
  // 写"设置项"的值：Venera 设置项存在 data.settings，不是 data 顶层（saveData 存的是顶层，读不到）
  _saveSetting = (key, value) => {
    try {
      const st = this.loadData("settings") || {};
      st[key] = value;
      this.saveData("settings", st);
    } catch (e) {}
  };

  // 单张图下载判定。加 http_client: dart:io 换原生客户端，绕过 Venera 的
  // CloudflareInterceptor（它会把正常图片响应误判成 Cloudflare 挑战而抛错）。
  _probeImage = (u) => {
    const t0 = Date.now();
    return Network.fetchBytes("GET", u, {
      "User-Agent": BROWSER_UA,
      Referer: `${this.base}/`,
      "http_client": "dart:io",
    })
      .then((res) => {
        const ms = Date.now() - t0;
        const nb = res && res.body ? (res.body.byteLength !== undefined ? res.body.byteLength : res.body.length) : 0;
        if (res.status === 200 && nb > 1000) return { ok: 1, ms: ms };
        return { ok: 0, err: "HTTP" + res.status + "/" + nb + "B", ms: ms };
      })
      .catch((e) => ({ ok: 0, err: String(e && e.message ? e.message : e).slice(0, 50), ms: Date.now() - t0 }));
  };;

  probeImageRoute = async (base, epId, n) => {
    const take = Math.max(1, n || 3);
    const api = `${this.base}/api/comic/image/${epId}?page=1&page_size=${take}&image_source=${encodeURIComponent(base)}`;
    const r = await Network.sendRequest("GET", api, { "User-Agent": BROWSER_UA, "cache-time": "no" });
    if (r.status !== 200) return { okCount: 0, total: 0, error: "HTTP " + r.status, avgMs: 0 };
    let data;
    try { data = JSON.parse(r.body); } catch (e) { return { okCount: 0, total: 0, error: "返回异常", avgMs: 0 }; }
    const urls = ((data.data && data.data.images) || []).map((x) => x.url).slice(0, take);
    if (!urls.length) return { okCount: 0, total: 0, error: "无图片", avgMs: 0 };
    const marks = await Promise.all(urls.map((u) => this._probeImage(u)));
    const ok = marks.reduce((a, b) => a + (b.ok ? 1 : 0), 0);
    const errs = marks.filter((m) => !m.ok && m.err).map((m) => m.err);
    const okMs = marks.filter((m) => m.ok).map((m) => m.ms || 0);
    const avgMs = okMs.length ? Math.round(okMs.reduce((a, b) => a + b, 0) / okMs.length) : 0;
    return { okCount: ok, total: urls.length, error: ok === 0 ? (errs[0] || "") : "", avgMs: avgMs };
  };;

  // 找一章用于探测（并发取候选漫画，首个有章节的即用）
  findProbeEpisode = async () => {
    for (const cid of [137419, 94399, 112156]) {
      try {
        const r = await Network.sendRequest(
          "GET",
          `${this.base}/api/comic/chapter?comicId=${cid}&page=1&page_size=2`,
          { "User-Agent": BROWSER_UA, "cache-time": "no" }
        );
        const j = JSON.parse(r.body);
        if (j && j.data && j.data.length) return j.data[0].id;
      } catch (e) { /* 换下一本 */ }
    }
    return null;
  };

  // 图床列表（三层兜底）：① IMAGE_ROUTES ② 从实际图片 URL 提取 ③ 写死兜底
  fetchImageRouteList = async () => {
    let list = null;
    try {
      const routes = await this.fetchImageRoutes();
      if (routes && routes.length) list = routes;
    } catch (e) { /* 往下兜底 */ }
    if (!list) {
      try {
        const ex = await this.extractImageHostsFromUrls();
        if (ex.length) list = ex;
      } catch (e) { /* 往下兜底 */ }
    }
    if (!list) list = MANWABA_FALLBACK_IMAGE_HOSTS.map((u) => ({ name: u.replace(/^https?:\/\//, ""), url: u }));
    // 按 url 去重（IMAGE_ROUTES 可能有重复条目）
    const seen = {};
    return list.filter((r) => {
      if (!r || !r.url || seen[r.url]) return false;
      seen[r.url] = 1;
      return true;
    });
  };

  // 从实际图片地址反推图床域名（首页封面 + 章节图），能发现 IMAGE_ROUTES 未列出的
  extractImageHostsFromUrls = async () => {
    const hostOf = (u) => { const m = String(u || "").match(/^https?:\/\/([^\/?#]+)/i); return m ? m[1] : null; };
    const found = [];
    const add = (u) => { const h = hostOf(u); if (h && found.indexOf(h) < 0) found.push(h); };
    try {
      const r = await Network.sendRequest(
        "GET",
        `${this.base}/api/home?page=1&pageSize=3&type=&flag=false`,
        { "User-Agent": BROWSER_UA, "cache-time": "no" }
      );
      const j = JSON.parse(r.body);
      ((j.data && j.data.comicList) || []).forEach((c) => add(c.pic));
    } catch (e) {}
    try {
      const epId = await this.findProbeEpisode();
      if (epId) {
        const r = await Network.sendRequest(
          "GET",
          `${this.base}/api/comic/image/${epId}?page=1&page_size=1`,
          { "User-Agent": BROWSER_UA, "cache-time": "no" }
        );
        const j = JSON.parse(r.body);
        ((j.data && j.data.images) || []).forEach((x) => add(x.url));
      }
    } catch (e) {}
    return found.map((h) => ({ name: h, url: "https://" + h }));
  };

  // 检测所有图床（并发），每条测 2 张
  detectImageHosts = async () => {
    const routes = await this.fetchImageRouteList();
    const epId = await this.findProbeEpisode();
    if (!epId) throw "未取到测试章节";
    const results = [];
    for (const r of routes) {
      let pr;
      try { pr = await this.probeImageRoute(r.url, epId, 3); }
      catch (e) { pr = { okCount: 0, total: 0, error: String(e && e.message ? e.message : e), avgMs: 0 }; }
      results.push({ name: r.name, url: r.url, okCount: pr.okCount, total: pr.total, error: pr.error, avgMs: pr.avgMs, usable: pr.okCount > 0 });
    }
    return results;
  };;

  // 后台发现最新线路/图床并刷新下拉选项（不阻塞启动）
  discoverDynamicOptions = async () => {
    try {
      const hosts = await this.fetchLineCandidates();
      if (hosts && hosts.length) this._lineOptsCache = hosts.map((h) => ({ value: h, text: h }));
    } catch (e) {}
    try {
      const routes = await this.fetchImageRouteList();
      if (routes && routes.length) {
        this._imageOptsCache = routes.map((r) => ({
          value: r.url,
          text: (r.name ? r.name + " " : "") + r.url.replace(/^https?:\/\//, ""),
        }));
      }
    } catch (e) {}
  };;

  // 单独刷新图床（保留旧按钮能力）
  // 纯 JS base64 解码（不依赖引擎 API，用于 mwmw.cc 里加密的线路列表）
  _b64decode = (str) => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
    let out = "", bc = 0, bs, buffer;
    str = String(str).replace(/=+$/, "");
    for (let i = 0; i < str.length; i++) {
      buffer = chars.indexOf(str.charAt(i));
      if (buffer === -1) continue;
      bs = bc % 4 ? bs * 64 + buffer : buffer;
      if (bc++ % 4) out += String.fromCharCode(255 & (bs >> ((-2 * bc) & 6)));
    }
    return out;
  };

  // 获取候选线路：① mwmw.cc 永久地址的 base64 列表（最全）② 走失页 manwami.cc ③ 兜底
  fetchLineCandidates = async () => {
    const hostOf = (u) => { const m = String(u || "").match(/^https?:\/\/([^\/?#]+)/i); return m ? m[1] : null; };
    const push = (arr, h) => {
      if (h && MANWABA_DEAD_LINES.indexOf(h) < 0 && arr.indexOf(h) < 0) arr.push(h);
    };
    // ① mwmw.cc（永久地址）
    try {
      const res = await Network.sendRequest("GET", "https://mwmw.cc/", { "User-Agent": BROWSER_UA, "cache-time": "no" });
      if (res.status === 200) {
        const m = String(res.body).match(/const e=\[([\s\S]*?)\]\.map/);
        if (m) {
          const hosts = [];
          (m[1].match(/"[A-Za-z0-9+/=]+"/g) || []).forEach((q) => {
            try { push(hosts, hostOf(this._b64decode(q.slice(1, -1)))); } catch (e) {}
          });
          if (hosts.length) return hosts;
        }
      }
    } catch (e) {}
    // ② 走失页
    try {
      const res = await Network.sendRequest("GET", MANWABA_LOST_PAGE, { "User-Agent": BROWSER_UA, "cache-time": "no" });
      if (res.status === 200) {
        const html = String(res.body);
        const hosts = [];
        const linkRe = /<a\s+([^>]*)>/gi;
        let m;
        while ((m = linkRe.exec(html))) {
          const attrs = m[1];
          if (!/testable/i.test(attrs)) continue;
          const hm = attrs.match(/href="(https?:\/\/[^"]+)"/i);
          if (hm) push(hosts, hostOf(hm[1]));
        }
        if (hosts.length) return hosts;
      }
    } catch (e) {}
    // ③ 兜底
    return MANWABA_FALLBACK_LINES.slice();
  };

  // 测单条线路：有 token 用 /api/user/info（同时验证直连 + 凭证有效），否则用 /api/home。
  probeLineHost = async (host) => {
    const token = this.loadData("token");
    const hasToken = !!token;
    const url = hasToken
      ? `https://${host}/api/user/info`
      : `https://${host}/api/home?page=1&pageSize=1&type=&flag=false`;
    const h = { "User-Agent": BROWSER_UA, "cache-time": "no" };
    if (hasToken) h["Authorization"] = "Bearer " + token;
    const t0 = Date.now();
    try {
      const r = await Network.sendRequest("GET", url, h);
      const ms = Date.now() - t0;
      if (r.status === 200) {
        let j = null;
        try { j = JSON.parse(r.body); } catch (e) { j = null; }
        if (j && j.code === 200) return { ok: true, detail: hasToken ? "直连正常" : "可访问", ms: ms };
        return { ok: false, detail: (j && j.msg) || "接口异常", ms: ms };
      }
      return { ok: false, detail: "HTTP " + r.status, ms: ms };
    } catch (e) {
      const msg = String(e && e.message ? e.message : e);
      const sm = msg.match(/\b(401|403|404|5\d\d)\b/);
      return { ok: false, detail: sm ? "HTTP " + sm[1] : msg.slice(0, 40), ms: Date.now() - t0 };
    }
  };;

  refreshImageRoutes = async () => {
    let lid = null;
    try { const im = this.loadSetting("imageLine"); if (im) this.imageBase = im; } catch (e) {}
    let results;
    try { lid = await UI.showLoading(null); results = await this.detectImageHosts(); }
    catch (e) { if (lid !== null) UI.cancelLoading(lid); UI.showMessage("图床检测失败：" + (e && e.message ? e.message : e)); return; }
    if (lid !== null) UI.cancelLoading(lid);
    if (!results.some((r) => r.usable)) { UI.showMessage("无可用图床"); return; }
    const options = results.map((r) => {
      const detail = r.total ? `${r.okCount}/${r.total}` : "-";
      const err = !r.usable && r.error ? " (" + r.error + ")" : "";
      return (r.usable ? "✅ " : "❌ ") + detail + " " + r.url.replace(/^https?:\/\//, "") + err;
    });
    let initial = results.findIndex((r) => r.url === this.imageBase);
    if (initial < 0) initial = results.findIndex((r) => r.usable);
    const idx = await UI.showSelectDialog("图床", options, initial >= 0 ? initial : 0);
    if (idx === null || idx === undefined || idx < 0 || idx >= results.length) return;
    if (!results[idx].usable) { UI.showMessage("该图床不可用"); return; }
    this._saveSetting("imageLine", results[idx].url);
    this.imageBase = results[idx].url;
    UI.showMessage("已切换");
  };

  // 保存后同步刷新下拉选项，让设置页立刻反映
  _applyDynamicOptions = (lineRes, curLine, imgRes, curImg) => {
    try {
      this._lineOptsCache = lineRes.filter((r) => r.ok).map((r) => ({ value: r.host, text: r.host }));
    } catch (e) {}
    try {
      this._imageOptsCache = imgRes.filter((r) => r.usable).map((r) => ({ value: r.url, text: r.url.replace(/^https?:\/\//, "") }));
    } catch (e) {}
  };

  // 一键设置：检测线路(并发) -> 选线路 -> 检测图床(并发) -> 选图床 -> 一次保存
  setupLineAndImage = async () => {
    let lid = null;
    try {
      const l = this.loadSetting("line");
      if (l) { this.base = "https://" + l; this.api = this.base + "/api"; this.accountBase = this.base; }
      const im = this.loadSetting("imageLine");
      if (im) this.imageBase = im;
    } catch (e) {}
    // 1) 检测线路（带速度）
    let hosts;
    try {
      lid = await UI.showLoading(null);
      hosts = await this.fetchLineCandidates();
    } catch (e) { hosts = MANWABA_FALLBACK_LINES.slice(); }
    const lineRes = await Promise.all(
      hosts.map(async (host) => {
        try { const p = await this.probeLineHost(host); return { host: host, ok: p.ok, detail: p.detail, ms: p.ms || 0 }; }
        catch (e) { return { host: host, ok: false, detail: "失败", ms: 99999 }; }
      })
    );
    if (lid !== null) UI.cancelLoading(lid);
    // 自动选：可用里延迟最低
    const usableLines = lineRes.filter((r) => r.ok).sort((a, b) => a.ms - b.ms);
    if (!usableLines.length) { UI.showMessage("线路均不可用"); return; }
    const bestLine = usableLines[0];

    // 2) 检测图床（用最优线路）
    const oldBase = this.base;
    this.base = "https://" + bestLine.host;
    this.api = this.base + "/api";
    this.accountBase = this.base;
    let imgRes;
    try {
      lid = await UI.showLoading(null);
      imgRes = await this.detectImageHosts();
    } catch (e) {
      this.base = oldBase;
      if (lid !== null) UI.cancelLoading(lid);
      UI.showMessage("图床检测失败：" + (e && e.message ? e.message : e));
      return;
    }
    if (lid !== null) UI.cancelLoading(lid);
    // 自动选：可用率最高，其次平均耗时最低
    const usableImgs = imgRes.filter((r) => r.usable).sort((a, b) => {
      const ra = a.total ? a.okCount / a.total : 0;
      const rb = b.total ? b.okCount / b.total : 0;
      if (rb !== ra) return rb - ra;
      return (a.avgMs || 99999) - (b.avgMs || 99999);
    });
    if (!usableImgs.length) {
      this.base = oldBase;
      this._saveSetting("line", bestLine.host);
      this._applyDynamicOptions(lineRes, bestLine.host, imgRes, null);
      UI.showMessage("线路已设为 " + bestLine.host + "（" + bestLine.ms + "ms），无可用图床");
      return;
    }
    const bestImg = usableImgs[0];

    // 3) 保存
    this._saveSetting("line", bestLine.host);
    this._saveSetting("imageLine", bestImg.url);
    this.imageBase = bestImg.url;
    this._applyDynamicOptions(lineRes, bestLine.host, imgRes, bestImg.url);
    UI.showMessage(
      "已选最优：" + bestLine.host + "（" + bestLine.ms + "ms）｜" +
      bestImg.url.replace(/^https?:\/\//, "") + "（" + bestImg.okCount + "/" + bestImg.total + "，" + bestImg.avgMs + "ms）"
    );
  };;;

  // 自动线路跟随：登录状态下后台校验当前线路，失效则自动切到可用线路（不阻塞启动）。
  // 未登录时无法准确判断"是否跨域跳转丢凭证"，故只在有 token 时做。
  autoFollowLine = async () => {
    const token = this.loadData("token");
    if (!token) return;
    const cur = String(this.base || "").replace(/^https?:\/\//, "");
    const p = await this.probeLineHost(cur);
    if (p.ok) return;
    let hosts = MANWABA_FALLBACK_LINES.slice();
    try { hosts = await this.fetchLineCandidates(); } catch (e) {}
    for (const h of hosts) {
      if (h === cur) continue;
      const q = await this.probeLineHost(h);
      if (q.ok) {
        this.base = "https://" + h;
        this.api = this.base + "/api";
        this.accountBase = this.base;
        try { this._saveSetting("line", h); } catch (e) {}
        this.logger.info("线路自动切换: " + cur + " -> " + h);
        return;
      }
    }
  };;

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
    // 漫画评论区（replyTo 为空：正常列表；非空：查看该评论的回复）
    loadComments: async (id, subId, page, replyTo) => {
      try {
        if (replyTo) {
          const replies = await this._loadReplies(id, null, replyTo, this.commentSort);
          return { comments: replies, maxPage: null };
        }
        const r = await this._fetchComments(id, null, page, this.commentSort);
        return { comments: r.comments, maxPage: r.maxPage };
      } catch (e) {
        if (isAuthError(e)) return { comments: [], maxPage: null };
        throw e;
      }
    },

    // 章节评论区（按 chapter_id 过滤）
    loadChapterComments: async (comicId, epId, page, replyTo) => {
      if (replyTo) {
        const replies = await this._loadReplies(comicId, epId, replyTo, this.commentSort);
        return { comments: replies, maxPage: null };
      }
      const r = await this._fetchComments(comicId, epId, page, this.commentSort);
      return { comments: r.comments, maxPage: r.maxPage };
    },

    sendComment: async (id, subId, content, replyTo) => {
      return await this._sendComment(id, content, replyTo, null);
    },

    sendChapterComment: async (comicId, epId, content, replyTo) => {
      return await this._sendComment(comicId, content, replyTo, epId);
    },

    // 点赞/取消赞；App 自身维护计数，这里只要成功即可
    likeComment: async (id, subId, commentId, isLiking) => {
      const token = this.loadData("token");
      if (!token) throw "请先登录后再点赞";
      const action = isLiking ? "like" : "unlike";
      const res = await this.fetchJson(
        `${this.base}/api/comment/${encodeURIComponent(commentId)}/${action}?type=0`,
        { method: "POST", headers: { "Content-Type": "application/json" }, withAuth: true }
      );
      if (!res || res.code !== 200) throw (res && res.msg) || "操作失败";
      return true;
    },

  };

  // ---------- 评论辅助（放在实例级别：comic 里的箭头函数 this 指向实例）----------
  // 站点接口（免登录可读，登录后可看点赞态/发评论/点赞）：
  //   列表 GET  /api/comments?comic_id=&page=&page_size=&sort=(time|hot)[&chapter_id=]
  //   发送 POST /api/comment  body {comic_id, content, parent_id, reply_to_id}
  //   点赞 POST /api/comment/{id}/like?type=0   取消 POST /api/comment/{id}/unlike?type=0
  // 站点没有"按评论 id 单独拉回复"的接口，回复随父评论的 replies 一起返回，
  // 这里把回复拼进正文直接展示；replyCount 仍给真实数量，点开时翻页找父评论取回复。

  // 站点评论对象 -> Venera Comment JSON
  _mapComment = (c) => {
    const u = (c && c.user) || {};
    const replies = c && Array.isArray(c.replies) ? c.replies : [];
    let content = c && c.content != null ? String(c.content) : "";
    if (replies.length) {
      const lines = replies.map((r) => {
        const ru = (r && r.user) || {};
        const rp = r && r.reply_user;
        const who = ru.nickname || ru.username || "匿名";
        const to = rp && (rp.nickname || rp.username) ? " 回复 " + (rp.nickname || rp.username) : "";
        return "　↳ " + who + to + "：" + (r && r.content != null ? String(r.content) : "");
      });
      content += "\n\n── 回复 ──\n" + lines.join("\n");
    }
    return {
      userName: u.nickname || u.username || "匿名",
      avatar: u.avatar ? u.avatar : undefined,
      content: content,
      time: c && c.created_at ? String(c.created_at) : undefined,
      id: String(c && c.id),
      score: c && c.likes != null ? Number(c.likes) : 0,
      isLiked: !!(c && c.is_liked),
      replyCount: replies.length,
    };
  };

  // 拉一页评论（chapterId 为空表示整本）
  _fetchComments = async (comicId, chapterId, page, sort) => {
    const pageSize = 20;
    const params = { comic_id: comicId, page: page || 1, page_size: pageSize, sort: sort || "time" };
    if (chapterId) params.chapter_id = chapterId;
    const res = await this.fetchJson(`${this.base}/api/comments`, { params, withAuth: true });
    if (!res || res.code !== 200) throw (res && res.msg) || "加载评论失败";
    const data = res.data || {};
    const rawList = Array.isArray(data.list) ? data.list : [];
    const total = Number(data.total || 0);
    return {
      comments: rawList.map((c) => this._mapComment(c)),
      maxPage: total > pageSize ? Math.ceil(total / pageSize) : 1,
      rawList: rawList,
    };
  };

  // 楼中楼：无单独接口，翻页找父评论取其 replies（最多翻 10 页）
  _loadReplies = async (comicId, chapterId, parentId, sort) => {
    const target = String(parentId);
    for (let p = 1; p <= 10; p++) {
      const r = await this._fetchComments(comicId, chapterId, p, sort);
      const hit = r.rawList.find((c) => String(c.id) === target);
      if (hit) {
        const replies = Array.isArray(hit.replies) ? hit.replies : [];
        return replies.map((x) => this._mapComment(x));
      }
      if (!r.rawList.length || p >= r.maxPage) break;
    }
    return [];
  };

  // 统一发送（replyTo 为空是发表新评论，非空是回复某条）
  _sendComment = async (comicId, content, replyTo, chapterId) => {
    const token = this.loadData("token");
    if (!token) throw "请先登录后再评论";
    if (!content || !String(content).trim()) throw "评论内容不能为空";
    const body = {
      comic_id: Number(comicId) || comicId,
      content: String(content).trim(),
      parent_id: replyTo ? Number(replyTo) || replyTo : 0,
      reply_to_id: replyTo ? Number(replyTo) || replyTo : "",
    };
    if (chapterId) body.chapter_id = Number(chapterId) || chapterId;
    const res = await this.fetchJson(`${this.base}/api/comment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      payload: JSON.stringify(body),
      withAuth: true,
    });
    if (!res || res.code !== 200) throw (res && (res.msg || res.message)) || "评论失败";
    return true;
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
