/** @type {import('./_venera_.js')} */

/**
 * 如漫画 (www.rumanhua.org)
 *
 * 章节阅读页的图片列表被 AES-128-CBC 加密后放在页面里的 `params` 变量里：
 *   key = "9S8$vJnU2ANeSRoF" (AES-128)
 *   IV  = params base64 解码后的前 16 字节
 *   密文 = base64 解码后第 16 字节往后的部分，PKCS7 填充
 * 解密后得到 JSON: { host, source_id, images: [...] }
 * 本源的图片 URL 是明文 webp（source_id=15，直接加载，无需二次解密）。
 *
 * 页面结构（PC 版）：
 * - 首页 "/"：多个 .item 卡片（a[href="/news/{id}"] + img.cover + .title/.msg）
 * - 详情页 "/news/{id}"：封面 .comicInfo .cover img，标题/作者/状态/简介 .comicInfo .info，
 *   章节 a[href="/show/{id}.html"]
 * - 章节页 "/show/{id}.html"：加密的 params 变量
 * - 分类 "/category"：进度 /category/finish/{1|2}、标签 /category/tags/{id}、
 *   排序 /category/order/{addtime|hits}，分页 /category/.../page/{n}
 * - 搜索 "/index.php/search?key={keyword}"（站点搜索当前返回空，仅作兼容）
 */

// ---- 纯 JS AES-128-CBC 实现（仅解密） ----

const AES_SBOX = [
  0x63,0x7c,0x77,0x7b,0xf2,0x6b,0x6f,0xc5,0x30,0x01,0x67,0x2b,0xfe,0xd7,0xab,0x76,
  0xca,0x82,0xc9,0x7d,0xfa,0x59,0x47,0xf0,0xad,0xd4,0xa2,0xaf,0x9c,0xa4,0x72,0xc0,
  0xb7,0xfd,0x93,0x26,0x36,0x3f,0xf7,0xcc,0x34,0xa5,0xe5,0xf1,0x71,0xd8,0x31,0x15,
  0x04,0xc7,0x23,0xc3,0x18,0x96,0x05,0x9a,0x07,0x12,0x80,0xe2,0xeb,0x27,0xb2,0x75,
  0x09,0x83,0x2c,0x1a,0x1b,0x6e,0x5a,0xa0,0x52,0x3b,0xd6,0xb3,0x29,0xe3,0x2f,0x84,
  0x53,0xd1,0x00,0xed,0x20,0xfc,0xb1,0x5b,0x6a,0xcb,0xbe,0x39,0x4a,0x4c,0x58,0xcf,
  0xd0,0xef,0xaa,0xfb,0x43,0x4d,0x33,0x85,0x45,0xf9,0x02,0x7f,0x50,0x3c,0x9f,0xa8,
  0x51,0xa3,0x40,0x8f,0x92,0x9d,0x38,0xf5,0xbc,0xb6,0xda,0x21,0x10,0xff,0xf3,0xd2,
  0xcd,0x0c,0x13,0xec,0x5f,0x97,0x44,0x17,0xc4,0xa7,0x7e,0x3d,0x64,0x5d,0x19,0x73,
  0x60,0x81,0x4f,0xdc,0x22,0x2a,0x90,0x88,0x46,0xee,0xb8,0x14,0xde,0x5e,0x0b,0xdb,
  0xe0,0x32,0x3a,0x0a,0x49,0x06,0x24,0x5c,0xc2,0xd3,0xac,0x62,0x91,0x95,0xe4,0x79,
  0xe7,0xc8,0x37,0x6d,0x8d,0xd5,0x4e,0xa9,0x6c,0x56,0xf4,0xea,0x65,0x7a,0xae,0x08,
  0xba,0x78,0x25,0x2e,0x1c,0xa6,0xb4,0xc6,0xe8,0xdd,0x74,0x1f,0x4b,0xbd,0x8b,0x8a,
  0x70,0x3e,0xb5,0x66,0x48,0x03,0xf6,0x0e,0x61,0x35,0x57,0xb9,0x86,0xc1,0x1d,0x9e,
  0xe1,0xf8,0x98,0x11,0x69,0xd9,0x8e,0x94,0x9b,0x1e,0x87,0xe9,0xce,0x55,0x28,0xdf,
  0x8c,0xa1,0x89,0x0d,0xbf,0xe6,0x42,0x68,0x41,0x99,0x2d,0x0f,0xb0,0x54,0xbb,0x16
];
const AES_RCON = [0x8d,0x01,0x02,0x04,0x08,0x10,0x20,0x40,0x80,0x1b,0x36];
const AES_RSBOX = (function () {
  let r = new Array(256);
  for (let i = 0; i < 256; i++) r[AES_SBOX[i]] = i;
  return r;
})();

function aesKeyExpansion(key) {
  const Nk = 4, Nr = 10, Nb = 4;
  const w = new Array(Nb * (Nr + 1) * 4);
  for (let i = 0; i < 4 * Nk; i++) w[i] = key[i];
  const temp = new Array(4);
  for (let i = Nk; i < Nb * (Nr + 1); i++) {
    for (let j = 0; j < 4; j++) temp[j] = w[(i - 1) * 4 + j];
    if (i % Nk === 0) {
      const t0 = temp[0];
      temp[0] = AES_SBOX[temp[1]] ^ AES_RCON[i / Nk];
      temp[1] = AES_SBOX[temp[2]];
      temp[2] = AES_SBOX[temp[3]];
      temp[3] = AES_SBOX[t0];
    }
    for (let j = 0; j < 4; j++) w[i * 4 + j] = w[(i - Nk) * 4 + j] ^ temp[j];
  }
  return w;
}

function gmul(a, b) {
  let p = 0;
  for (let i = 0; i < 8; i++) {
    if (b & 1) p ^= a;
    const hi = a & 0x80;
    a = (a << 1) & 0xff;
    if (hi) a ^= 0x1b;
    b >>= 1;
  }
  return p;
}

function aesAddRoundKey(state, w, round) {
  for (let c = 0; c < 4; c++)
    for (let r = 0; r < 4; r++) state[r][c] ^= w[round * 16 + c * 4 + r];
}

function aesInvSubBytes(state) {
  for (let r = 0; r < 4; r++)
    for (let c = 0; c < 4; c++) state[r][c] = AES_RSBOX[state[r][c]];
}

function aesInvShiftRows(state) {
  for (let r = 1; r < 4; r++) {
    const row = state[r].slice();
    for (let c = 0; c < 4; c++) state[r][c] = row[(c - r + 4) % 4];
  }
}

function aesInvMixColumns(state) {
  for (let c = 0; c < 4; c++) {
    const a0 = state[0][c], a1 = state[1][c], a2 = state[2][c], a3 = state[3][c];
    state[0][c] = gmul(a0,0x0e) ^ gmul(a1,0x0b) ^ gmul(a2,0x0d) ^ gmul(a3,0x09);
    state[1][c] = gmul(a0,0x09) ^ gmul(a1,0x0e) ^ gmul(a2,0x0b) ^ gmul(a3,0x0d);
    state[2][c] = gmul(a0,0x0d) ^ gmul(a1,0x09) ^ gmul(a2,0x0e) ^ gmul(a3,0x0b);
    state[3][c] = gmul(a0,0x0b) ^ gmul(a1,0x0d) ^ gmul(a2,0x09) ^ gmul(a3,0x0e);
  }
}

function aesDecryptBlock(inputBytes, w) {
  const Nr = 10;
  const state = [[], [], [], []];
  for (let i = 0; i < 16; i++) state[i % 4][Math.floor(i / 4)] = inputBytes[i];

  aesAddRoundKey(state, w, Nr);
  for (let round = Nr - 1; round >= 1; round--) {
    aesInvShiftRows(state);
    aesInvSubBytes(state);
    aesAddRoundKey(state, w, round);
    aesInvMixColumns(state);
  }
  aesInvShiftRows(state);
  aesInvSubBytes(state);
  aesAddRoundKey(state, w, 0);

  const out = new Array(16);
  for (let i = 0; i < 16; i++) out[i] = state[i % 4][Math.floor(i / 4)];
  return out;
}

function aes128CbcDecrypt(cipherBytes, keyBytes, ivBytes) {
  const w = aesKeyExpansion(keyBytes);
  const out = [];
  let prevBlock = ivBytes;
  for (let off = 0; off < cipherBytes.length; off += 16) {
    const block = cipherBytes.slice(off, off + 16);
    const decrypted = aesDecryptBlock(block, w);
    for (let i = 0; i < 16; i++) out.push(decrypted[i] ^ prevBlock[i]);
    prevBlock = block;
  }
  const padLen = out[out.length - 1];
  if (padLen > 0 && padLen <= 16) out.length -= padLen;
  return out;
}

function base64ToBytes(b64) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  b64 = b64.replace(/=+$/, "");
  const bytes = [];
  let buffer = 0,
    bits = 0;
  for (let i = 0; i < b64.length; i++) {
    const idx = chars.indexOf(b64[i]);
    if (idx < 0) continue;
    buffer = (buffer << 6) | idx;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 0xff);
    }
  }
  return bytes;
}

function utf8BytesToString(bytes) {
  let str = "";
  for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i]);
  return decodeURIComponent(escape(str));
}

const AES_KEY_STR = "9S8$vJnU2ANeSRoF";

// 解密章节页里的 `params` 变量，返回解析后的 JSON 对象
function decryptParams(paramsB64) {
  const allBytes = base64ToBytes(paramsB64);
  const iv = allBytes.slice(0, 16);
  const ciphertext = allBytes.slice(16);
  const keyBytes = [];
  for (let i = 0; i < AES_KEY_STR.length; i++) {
    keyBytes.push(AES_KEY_STR.charCodeAt(i));
  }
  const plainBytes = aes128CbcDecrypt(ciphertext, keyBytes, iv);
  const plainStr = utf8BytesToString(plainBytes);
  return JSON.parse(plainStr);
}

// ---- 源定义 ----

class RuManhua extends ComicSource {
  name = "如漫画";
  key = "rumanhua";
  version = "1.0.0";
  minAppVersion = "1.6.0";

  // 更新链接，请替换为你自己的托管地址
  url = "";

  get baseUrl() {
    return "https://www.rumanhua.org";
  }

  pageHeaders() {
    return {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
      "Accept":
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
      "Referer": this.baseUrl + "/",
    };
  }

  async fetchBody(label, url) {
    let res = await Network.get(url, this.pageHeaders());
    if (res.status !== 200) throw label + " 请求失败: " + res.status;
    return res.body;
  }

  // 从 .item 卡片解析漫画
  parseComicItem(el) {
    let a = el.querySelector('a[href*="/news/"]');
    if (!a) return null;
    let href = a.attributes["href"] || "";
    let m = href.match(/\/news\/(\d+)/);
    if (!m) return null;
    let id = m[1];

    let img = el.querySelector("img");
    let cover = img ? img.attributes["src"] || "" : "";
    // 无封面的条目（如首页底部总排行榜 top30）直接跳过
    if (!cover) return null;

    let title = "";
    let titleEl = el.querySelector(".title a");
    if (titleEl) title = titleEl.text.trim();
    if (!title && img) title = img.attributes["alt"] || img.attributes["title"] || "";
    if (!title) title = a.attributes["title"] || id;

    let subTitle = "";
    let tipEl = el.querySelector(".msg, .op.tip");
    if (tipEl) subTitle = tipEl.text.trim();

    return new Comic({
      id: id,
      title: title,
      subTitle: subTitle,
      cover: cover,
    });
  }

  // 解析页面里所有 .item 卡片
  parseItemList(html) {
    let doc = new HtmlDocument(html);
    let seen = {};
    let comics = [];
    for (let el of doc.querySelectorAll(".item")) {
      let c = this.parseComicItem(el);
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
      let m = href.match(/\/page\/(\d+)/);
      if (m) {
        let n = parseInt(m[1]);
        if (n > max) max = n;
      }
    }
    doc.dispose();
    return max > 1 ? max : fallback;
  }

  // 发现页
  explore = [
    {
      title: "如漫画-首页",
      type: "singlePageWithMultiPart",
      load: async (page) => {
        let body = await this.fetchBody("home", this.baseUrl + "/");
        let comics = this.parseItemList(body);
        let res = {};
        res["首页"] = comics;
        return res;
      },
    },
    {
      title: "如漫画-最新更新",
      type: "multiPageComicList",
      load: async (page) => {
        if (page > 1) return { comics: [], maxPage: 1 };
        let body = await this.fetchBody("update", this.baseUrl + "/custom/update");
        return { comics: this.parseItemList(body), maxPage: 1 };
      },
    },
  ];

  // 分类页
  category = {
    title: "如漫画",
    parts: [
      {
        name: "进度",
        type: "fixed",
        itemType: "category",
        categories: ["全部", "连载", "完结"],
        categoryParams: ["", "finish/1", "finish/2"],
      },
      {
        name: "标签",
        type: "fixed",
        itemType: "category",
        categories: [
          "奇幻", "搞笑", "都市", "热血", "穿越", "纯爱", "机甲", "竞技",
          "病娇", "腹黑", "疯批", "颜控", "反差萌", "反派", "编剧", "双女主",
          "玄幻", "修仙", "校园", "治愈", "科幻", "美少女", "冒险", "战斗",
          "古风", "复仇", "修真", "少年", "系统", "大女主", "动作", "悬疑",
          "武侠", "宫斗", "励志", "撒糖", "秀吉", "狗血", "娱乐圈", "影帝",
          "占有欲", "古灵精怪", "大小姐", "少女", "爱情", "欢乐向", "重生", "异能",
          "恋爱", "同人", "生活", "恐怖", "非人类", "日常", "其它", "泛爱",
          "格斗", "日漫", "异世界", "历史", "江湖", "古代", "魔幻", "萌系",
          "耽美", "剧情", "学生", "龙傲天", "姐姐", "打工人", "装逼", "爽",
          "欧风", "宫廷", "长条", "轻小说", "无节操", "扮猪吃虎", "纨绔", "架空",
          "美强惨", "女强", "御姐", "忠犬", "魔女", "百合", "逆袭", "偶像",
          "青春", "唯美", "浪漫", "连载中", "惊奇", "彩虹", "友情", "智商在线",
          "暧昧", "反差", "修罗场", "职场",
        ],
        categoryParams: [
          "tags/2569", "tags/2570", "tags/2571", "tags/2572", "tags/2573", "tags/2574", "tags/2575", "tags/2576",
          "tags/2577", "tags/2578", "tags/2579", "tags/2580", "tags/2581", "tags/2582", "tags/2583", "tags/2584",
          "tags/2585", "tags/2586", "tags/2587", "tags/2588", "tags/2589", "tags/2590", "tags/2591", "tags/2592",
          "tags/2593", "tags/2594", "tags/2595", "tags/2596", "tags/2597", "tags/2598", "tags/2599", "tags/2600",
          "tags/2601", "tags/2602", "tags/2603", "tags/2604", "tags/2605", "tags/2606", "tags/2607", "tags/2608",
          "tags/2609", "tags/2610", "tags/2611", "tags/2612", "tags/2613", "tags/2614", "tags/2615", "tags/2616",
          "tags/2617", "tags/2618", "tags/2619", "tags/2620", "tags/2621", "tags/2622", "tags/2623", "tags/2624",
          "tags/2625", "tags/2626", "tags/2627", "tags/2628", "tags/2629", "tags/2630", "tags/2631", "tags/2632",
          "tags/2633", "tags/2634", "tags/2635", "tags/2636", "tags/2637", "tags/2638", "tags/2639", "tags/2640",
          "tags/2641", "tags/2642", "tags/2643", "tags/2644", "tags/2645", "tags/2646", "tags/2647", "tags/2648",
          "tags/2649", "tags/2650", "tags/2651", "tags/2652", "tags/2653", "tags/2654", "tags/2655", "tags/2656",
          "tags/2657", "tags/2658", "tags/2659", "tags/2660", "tags/2661", "tags/2662", "tags/2663", "tags/2664",
          "tags/2665", "tags/2666", "tags/2667", "tags/2668",
        ],
      },
      {
        name: "排序",
        type: "fixed",
        itemType: "category",
        categories: ["更新时间", "热门人气"],
        categoryParams: ["order/addtime", "order/hits"],
      },
    ],
    enableRankingPage: false,
  };

  // 分类漫画加载
  categoryComics = {
    load: async (category, param, options, page) => {
      let path = "/category";
      if (param) path += "/" + param;
      if (page && page > 1) path += `/page/${page}`;

      let body = await this.fetchBody("categoryComics", this.baseUrl + path);
      let comics = this.parseItemList(body);
      let maxPage = this.extractMaxPage(body, comics.length > 0 ? page : 1);
      if (maxPage < 1) maxPage = 1;

      return { comics: comics, maxPage: maxPage };
    },
    optionList: [],
  };

  // 搜索（站点搜索当前返回空，仅做兼容；按站点自己的端点实现）
  search = {
    load: async (keyword, options, page) => {
      let kw = encodeURIComponent(keyword);
      let url;
      if (!page || page <= 1) {
        url = `${this.baseUrl}/index.php/search?key=${kw}`;
      } else {
        url = `${this.baseUrl}/search/${kw}/${page}`;
      }
      let body = await this.fetchBody("search", url);
      let comics = this.parseItemList(body);
      return { comics: comics, maxPage: comics.length > 0 ? page : 1 };
    },
    optionList: [],
    enableTagsSuggestions: false,
  };

  // 单本漫画
  comic = {
    loadInfo: async (id) => {
      let body = await this.fetchBody("detail", this.baseUrl + "/news/" + id);
      let doc = new HtmlDocument(body);

      // 封面与标题
      let cover = "";
      let title = "";
      let coverImg = doc.querySelector(".comicInfo .cover img");
      if (coverImg) {
        cover = coverImg.attributes["src"] || "";
        title = coverImg.attributes["alt"] || coverImg.attributes["title"] || "";
      }
      if (!title) {
        let titleEl = doc.querySelector(".comicInfo .info .title");
        if (titleEl) {
          title = titleEl.text.trim().replace(/^\d+(\.\d+)?分/, "").trim();
        }
      }
      if (!title) title = id;

      // 作者、状态
      let author = "";
      let status = "";
      for (let sp of doc.querySelectorAll(".comicInfo .info span")) {
        let text = sp.text.trim();
        if (text.startsWith("作  者：")) {
          author = text.replace("作  者：", "").trim();
        } else if (text.startsWith("状  态：")) {
          status = text.replace("状  态：", "").trim();
        }
      }

      // 简介
      let description = "";
      let descEl = doc.querySelector(".comicInfo .info .content");
      if (descEl) description = descEl.text.trim();

      // 标签
      let tags = [];
      for (let a of doc.querySelectorAll('a[href*="/category/tags/"]')) {
        let t = a.text ? a.text.trim() : "";
        if (t) tags.push(t);
      }

      // 章节
      let chapters = new Map();
      for (let a of doc.querySelectorAll('a[href*="/show/"]')) {
        let href = a.attributes["href"] || "";
        let m = href.match(/\/show\/([A-Za-z0-9]+)\.html/);
        if (!m) continue;
        let chTitle = a.text ? a.text.trim() : "";
        if (!chTitle) continue;
        chapters.set(m[1], chTitle);
      }

      doc.dispose();

      if (chapters.size === 0) throw "未解析到章节列表";

      let tagMap = {};
      if (author) tagMap["作者"] = [author];
      if (status) tagMap["状态"] = [status];
      if (tags.length) tagMap["标签"] = tags;

      return new ComicDetails({
        title: title,
        subtitle: author,
        cover: cover,
        description: description,
        tags: tagMap,
        chapters: chapters,
      });
    },

    loadEp: async (comicId, epId) => {
      let body = await this.fetchBody("ep", this.baseUrl + "/show/" + epId + ".html");
      let m = body.match(/params\s*=\s*'([^']+)'/);
      if (!m) {
        throw "未找到加密参数(params)，页面结构可能已变化";
      }
      let data;
      try {
        data = decryptParams(m[1]);
      } catch (e) {
        throw `解密章节数据失败: ${e.message || e}`;
      }
      let images = data.images || [];
      if (images.length === 0) {
        throw "章节图片列表为空";
      }
      return { images: images };
    },

    onImageLoad: (url) => {
      return {
        url: url,
        headers: {
          Referer: "https://www.rumanhua.org/",
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
          Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
          "Accept-Language": "zh-CN,zh;q=0.9",
        },
      };
    },

    // 从外部链接识别漫画 id，如 https://www.rumanhua.org/news/524238
    link: {
      domains: ["rumanhua.org"],
      linkToId: (url) => {
        let m = url.match(/\/news\/(\d+)/);
        return m ? m[1] : null;
      },
    },
  };
}
