/** @type {import('./_venera_.js')} */

/**
 * 51漫画 (m.51manga.com)
 *
 * 章节阅读页的图片列表被 AES-128-CBC 加密后放在页面里的 `params` 变量里，
 * 已逆向出算法: key = "9S8$vJnU2ANeSRoF" (AES-128)，IV = 密文 base64 解码后的前 16 字节，
 * 真正密文 = 解码后第 16 字节往后的部分，PKCS7 填充。
 * 这里内置了一份不依赖任何第三方库的纯 JS AES 实现来完成解密。
 *
 * 主要页面结构（手机版 m.51manga.com）：
 * - 首页 "/"：多个 .panel 分区（国产漫画/日本漫画/韩国漫画/欧美漫画），每个 .comic-item 是一本漫画
 * - 详情页 "/mh/{id}"：标题 .comic_name h1.name，封面 .comic_cover 的 background-image，
 *   简介 .metas-desc p，章节 .chapter-list a[href*="/show/"]
 * - 章节页 "/show/{epId}.html"：加密的 params 变量
 * - 分类页 "/category"：地区 /category/list/{n}、标签 /category/tags/{id}、进度 /category/finish/{n}，
 *   分页 /category/.../page/{n}
 * - 搜索 "/search?key={keyword}"，分页 /search/{keyword}/{page}
 */

// ---- 纯 JS AES-128-CBC 实现（仅用于解密） ----

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

// 记录最近一次实际访问的章节页 URL，供 onImageLoad 组装精确的 Referer
let lastChapterPageUrl = "";

// 解密页面里的 `params` 变量，返回解析后的 JSON 对象
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

class Manga51 extends ComicSource {
  name = "51漫画";
  key = "manga51";
  version = "1.1.0";
  minAppVersion = "1.6.0";

  // 更新链接，请替换为你自己的托管地址
  url = "";

  get baseUrl() {
    return "https://m.51manga.com";
  }

  get headers() {
    return {
      "User-Agent":
        "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
    };
  }

  // 从 .comic-item 的 <a href="/mh/xxx"> 中解析漫画信息
  parseComic(e) {
    let href = e.attributes["href"] || "";
    let m = href.match(/\/mh\/([A-Za-z0-9]+)/);
    if (!m) return null;
    let id = m[1];

    let img = e.querySelector("img");
    let cover = img
      ? img.attributes["src"] ||
        img.attributes["lay-src"] ||
        img.attributes["data-src"] ||
        ""
      : "";

    let title = "";
    let titleEl = e.querySelector(".title");
    if (titleEl) title = titleEl.text.trim();
    if (!title && img) title = img.attributes["alt"] || "";
    if (!title) title = e.attributes["title"] || id;

    let subTitle = "";
    let txtEl = e.querySelector(".txt");
    if (txtEl) subTitle = txtEl.text.trim();

    return new Comic({
      id: id,
      title: title,
      subTitle: subTitle,
      cover: cover,
    });
  }

  // 解析页面里所有 /mh/ 链接并去重
  parseComicList(html) {
    let document = new HtmlDocument(html);
    let seen = {};
    let comics = [];
    for (let e of document.querySelectorAll('a[href*="/mh/"]')) {
      let c = this.parseComic(e);
      if (!c || seen[c.id]) continue;
      seen[c.id] = true;
      comics.push(c);
    }
    return comics;
  }

  // 从分页标记 <cite>当前页/总页数</cite> 中解析总页数
  parseMaxPage(html, fallback) {
    let m = html.match(/<cite>\d+\/(\d+)<\/cite>/);
    if (m) {
      let n = parseInt(m[1]);
      if (!isNaN(n)) return n;
    }
    return fallback;
  }

  // 发现页
  explore = [
    {
      title: "51漫画-首页",
      type: "multiPartPage",
      load: async (page) => {
        let res = await Network.get(`${this.baseUrl}/`, this.headers);
        if (res.status !== 200) {
          throw `Invalid status code: ${res.status}`;
        }
        let document = new HtmlDocument(res.body);
        let parts = [];

        // 首页分区标题 → 对应分类页的地区参数
        let regionMap = {
          国产漫画: "list/1",
          日本漫画: "list/2",
          韩国漫画: "list/3",
          欧美漫画: "list/4",
        };

        for (let panel of document.querySelectorAll(".panel")) {
          let heading = panel.querySelector(".panel-heading h2");
          if (!heading) continue;
          let title = heading.text.trim();
          let comics = [];
          for (let item of panel.querySelectorAll(".comic-item")) {
            let a = item.querySelector('a[href*="/mh/"]');
            if (!a) continue;
            let c = this.parseComic(a);
            if (c) comics.push(c);
          }
          if (comics.length > 0) {
            let part = { title: title, comics: comics };
            let regionParam = regionMap[title];
            if (regionParam) {
              part.viewMore = {
                page: "category",
                attributes: {
                  category: title,
                  param: regionParam,
                },
              };
            }
            parts.push(part);
          }
        }

        if (parts.length === 0) {
          parts.push({ title: "全部", comics: this.parseComicList(res.body) });
        }
        return parts;
      },
    },
    {
      title: "51漫画-最新更新",
      type: "multiPageComicList",
      load: async (page) => {
        if (page > 1) {
          return { comics: [], maxPage: 1 };
        }
        let res = await Network.get(`${this.baseUrl}/custom/update`, this.headers);
        if (res.status !== 200) {
          throw `Invalid status code: ${res.status}`;
        }
        return { comics: this.parseComicList(res.body), maxPage: 1 };
      },
    },
  ];

  // 分类页
  category = {
    title: "51漫画",
    parts: [
      {
        name: "地区",
        type: "fixed",
        itemType: "category",
        categories: ["全部", "国产漫画", "日本漫画", "韩国漫画", "欧美漫画"],
        categoryParams: ["", "list/1", "list/2", "list/3", "list/4"],
      },
      {
        name: "题材",
        type: "fixed",
        itemType: "category",
        categories: [
          "全部",
          "科幻",
          "后宫",
          "机甲",
          "都市",
          "恋爱生活",
          "恋爱",
          "恋爱(2)",
          "其他",
          "推理悬疑",
          "魔法",
          "奇幻",
        ],
        categoryParams: [
          "",
          "tags/867",
          "tags/868",
          "tags/869",
          "tags/870",
          "tags/871",
          "tags/872",
          "tags/873",
          "tags/874",
          "tags/875",
          "tags/876",
          "tags/877",
        ],
      },
      {
        name: "进度",
        type: "fixed",
        itemType: "category",
        categories: ["全部", "连载中", "已完结"],
        categoryParams: ["", "finish/1", "finish/2"],
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

      let res = await Network.get(`${this.baseUrl}${path}`, this.headers);
      if (res.status !== 200) {
        throw `Invalid status code: ${res.status}`;
      }

      let comics = this.parseComicList(res.body);
      let maxPage = this.parseMaxPage(res.body, comics.length > 0 ? page : 1);
      if (maxPage < 1) maxPage = 1;

      return { comics: comics, maxPage: maxPage };
    },
    optionList: [],
  };

  // 搜索
  search = {
    load: async (keyword, options, page) => {
      let kw = encodeURIComponent(keyword);
      let url;
      if (!page || page <= 1) {
        url = `${this.baseUrl}/search?key=${kw}`;
      } else {
        url = `${this.baseUrl}/search/${kw}/${page}`;
      }

      let res = await Network.get(url, this.headers);
      if (res.status !== 200) {
        throw `Invalid status code: ${res.status}`;
      }

      let comics = this.parseComicList(res.body);
      let maxPage = this.parseMaxPage(res.body, comics.length > 0 ? page : 1);
      if (maxPage < 1) maxPage = 1;

      return { comics: comics, maxPage: maxPage };
    },
    optionList: [],
    enableTagsSuggestions: false,
  };

  // 单本漫画
  comic = {
    loadInfo: async (id) => {
      let res = await Network.get(`${this.baseUrl}/mh/${id}`, this.headers);
      if (res.status !== 200) {
        throw `Invalid status code: ${res.status}`;
      }
      let html = res.body;
      let document = new HtmlDocument(html);

      let titleEl =
        document.querySelector(".comic_name h1.name") ||
        document.querySelector("h1");
      let title = titleEl ? titleEl.text.trim() : id;

      // 简介：优先 .metas-desc 下的直接 <p>，其次 meta description
      let description = "";
      let descEl = document.querySelector(".metas-desc > p");
      if (descEl) description = descEl.text.trim();
      if (!description) {
        let m = html.match(/<meta name="description" content="([^"]*)"/);
        if (m) description = m[1];
      }

      // 来源/作者：.comic_hot（如“飞卢小说网”）
      let hotEl = document.querySelector(".comic_hot");
      let source = hotEl ? hotEl.text.trim() : "";

      // 标签（部分漫画详情页可能没有标签）
      let tags = [];
      for (let a of document.querySelectorAll('a[href*="/category/tags/"]')) {
        let t = a.text ? a.text.trim() : "";
        if (t) tags.push(t);
      }

      // 封面：<div class="comic_cover" style="background-image: url('...')">
      let cover = "";
      let coverMatch = html.match(
        /class="comic_cover"[^>]*style="[^"]*background-image:\s*url\(['"]?([^'")]+)['"]?\)/
      );
      if (coverMatch) cover = coverMatch[1];

      // 章节：.chapter-list 下的 /show/ 链接
      let chapters = new Map();
      let chapterLinks = document.querySelectorAll(
        '.chapter-list a[href*="/show/"]'
      );
      if (chapterLinks.length === 0) {
        chapterLinks = document.querySelectorAll('a[href*="/show/"]');
      }
      for (let a of chapterLinks) {
        let href = a.attributes["href"] || "";
        let m = href.match(/\/show\/([A-Za-z0-9]+)\.html/);
        if (!m) continue;
        let chTitle = a.text ? a.text.trim() : "";
        if (!chTitle) continue;
        chapters.set(m[1], chTitle);
      }

      // 更新时间
      let updateTime = "";
      let timeEl = document.querySelector(".zuixin time");
      if (timeEl) updateTime = timeEl.text.trim();

      return new ComicDetails({
        title: title,
        subtitle: source,
        cover: cover,
        description: description,
        tags: tags.length > 0 ? { 标签: tags } : {},
        chapters: chapters,
        updateTime: updateTime,
      });
    },

    loadEp: async (comicId, epId) => {
      let url = `${this.baseUrl}/show/${epId}.html`;
      lastChapterPageUrl = url;
      let res = await Network.get(url, this.headers);
      if (res.status !== 200) {
        throw `Invalid status code: ${res.status}`;
      }
      let html = res.body;
      let m = html.match(/params\s*=\s*'([^']+)'/);
      if (!m) {
        throw "未找到加密参数(params)，页面结构可能已变化";
      }
      let data;
      try {
        data = decryptParams(m[1]);
      } catch (e) {
        throw `解密章节数据失败: ${e.message || e}`;
      }
      let images = (data.images || []).map((src) => {
        if (/^https?:\/\//.test(src)) return src;
        if (String(data.source_id) === "12") {
          return "https://img1.baipiaoguai.org" + src;
        }
        return src;
      });
      if (images.length === 0) {
        throw "章节图片列表为空";
      }
      return { images: images };
    },

    onImageLoad: (url) => {
      return {
        url: url,
        headers: {
          Referer: lastChapterPageUrl || "https://www.51manga.com/",
          "User-Agent": this.headers["User-Agent"],
          Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
          "Accept-Language": "zh-CN,zh;q=0.9",
        },
      };
    },

    onThumbnailLoad: (url) => {
      return {
        url: url,
        headers: {
          Referer: "https://www.51manga.com/",
          "User-Agent": this.headers["User-Agent"],
          Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
          "Accept-Language": "zh-CN,zh;q=0.9",
        },
      };
    },

    // 从外部链接识别漫画 id，如 https://www.51manga.com/mh/xxx 或 https://m.51manga.com/mh/xxx
    link: {
      domains: ["51manga.com"],
      linkToId: (url) => {
        let m = url.match(/\/mh\/([A-Za-z0-9]+)/);
        return m ? m[1] : null;
      },
    },
  };
}
