/**
 * 章节图片解码器 — 移植自 keiyoushi/extensions-source (PR #16898)
 *
 * /api/v2/chapter/getinfo 接口返回的图片列表是混淆后的字符串，而非普通数组。
 * 此解码器将该字符串还原为原始 JSON 图片数组。
 *
 * 解码流程：去除 "J7r" 前缀 / "nQ" 后缀 → 按 "kD" 和 "W4s" 标记拆分为 3 段
 * → 重新排序为 段3+段1+段2 → 每隔一个 7 字符块反转 → 将自定义字母表映射回
 * 标准 base64url → base64 解码 → UTF-8 JSON。
 */
const STD = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
const CUSTOM = "_-9876543210abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
const DECODE_PREFIX = "J7r";
const DECODE_MARKER1 = "kD";
const DECODE_MARKER2 = "W4s";
const DECODE_SUFFIX = "nQ";
const DECODE_GROUP = 7;

// 预计算的查找表：自定义字母表字符码 → 标准 base64url 字符码（-1 表示无效）
const DECODE_TABLE = new Array(128).fill(-1);
for (let i = 0; i < CUSTOM.length; i++) {
    DECODE_TABLE[CUSTOM.charCodeAt(i)] = STD.charCodeAt(i);
}

function decodeChapterImages(input) {
    if (typeof input !== "string" || !input.startsWith(DECODE_PREFIX) || !input.endsWith(DECODE_SUFFIX)) {
        throw "未知的章节数据格式";
    }
    const body = input.substring(DECODE_PREFIX.length, input.length - DECODE_SUFFIX.length);
    const payloadLen = body.length - DECODE_MARKER1.length - DECODE_MARKER2.length;
    if (payloadLen <= 0) {
        throw "未知的章节数据格式";
    }

    const aLen = Math.floor(payloadLen / 3);
    const bLen = Math.floor((payloadLen - aLen) / 2);
    const cLen = payloadLen - aLen - bLen;

    const part1 = body.substring(0, bLen);
    const marker1 = body.substring(bLen, bLen + DECODE_MARKER1.length);
    const part2 = body.substring(bLen + DECODE_MARKER1.length, bLen + DECODE_MARKER1.length + cLen);
    const marker2 = body.substring(bLen + DECODE_MARKER1.length + cLen, bLen + DECODE_MARKER1.length + cLen + DECODE_MARKER2.length);
    const part3 = body.substring(bLen + DECODE_MARKER1.length + cLen + DECODE_MARKER2.length);

    if (marker1 !== DECODE_MARKER1 || marker2 !== DECODE_MARKER2 || part3.length !== aLen) {
        throw "未知的章节数据格式";
    }

    // 重新排序：段3 + 段1 + 段2
    const reordered = part3 + part1 + part2;

    // 去锯齿：每隔一个 GROUP 长度的块做反转
    let unzigzagged = "";
    for (let i = 0, block = 0; i < reordered.length; i += DECODE_GROUP, block++) {
        const chunk = reordered.substring(i, Math.min(i + DECODE_GROUP, reordered.length));
        unzigzagged += (block % 2 === 1) ? chunk.split('').reverse().join('') : chunk;
    }

    // 将自定义字母表映射为标准 base64url
    let standard = "";
    for (let i = 0; i < unzigzagged.length; i++) {
        const code = unzigzagged.charCodeAt(i);
        const mapped = code < DECODE_TABLE.length ? DECODE_TABLE[code] : -1;
        if (mapped < 0) {
            throw "无效的章节数据字符";
        }
        standard += String.fromCharCode(mapped);
    }

    // Base64 解码（纯 JS 实现，venera 运行时不支持 atob）。先将 base64url 转为标准 base64。
    const standardBase64 = standard.replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeBase64(standardBase64);
    return JSON.parse(json);
}

/**
 * 纯 JavaScript base64 解码器（venera 运行时缺少 atob）。
 * 将 base64 解码为字节字符，供 JSON 解析使用。
 */
function decodeBase64(str) {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    str = str.replace(/=+$/, "");

    let result = "";
    let i = 0;
    while (i < str.length) {
        const enc1 = chars.indexOf(str.charAt(i));
        const enc2 = chars.indexOf(str.charAt(i + 1));
        const enc3 = str.charAt(i + 2) ? chars.indexOf(str.charAt(i + 2)) : -1;
        const enc4 = str.charAt(i + 3) ? chars.indexOf(str.charAt(i + 3)) : -1;

        if (enc1 < 0 || enc2 < 0) {
            throw "Invalid base64 character";
        }

        result += String.fromCharCode((enc1 << 2) | (enc2 >> 4));
        if (enc3 >= 0) {
            result += String.fromCharCode(((enc2 & 15) << 4) | (enc3 >> 2));
        }
        if (enc4 >= 0) {
            result += String.fromCharCode(((enc3 & 3) << 6) | enc4);
        }

        i += 4;
    }
    return result;
}

/** @type {import('./_venera_.js')} */
class Goda extends ComicSource {
  // 注意：标记为 [可选] 的字段如果不使用，应将其删除

  // 源名称
  name = "GoDa漫画"

  // 源唯一标识
  key = "goda"

  version = "1.2.1"

  minAppVersion = "1.4.0"

  // 更新地址
  url = "https://cdn.jsdelivr.net/gh/venera-app/venera-configs@main/goda.js"

  settings = {
    domains: {
      title: "域名",
      type: "input",
      default: "godamh.com"
    },
    api: {
      title: "API域名",
      type: "input",
      default: "v2.apikk.top"
    },
    image: {
      title: "图片域名",
      type: "input",
      default: "c-nd3-1.6wm.top"
    }
  }

  get baseUrl() {
    return `https://${this.loadSetting("domains")}`;
  }

  get apiUrl() {
    return `https://${this.loadSetting("api")}/api/v2`;
  }

  get imageUrl() {
    return `https://${this.loadSetting("image")}`;
  }

  get headers() {
    return {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:144.0) Gecko/20100101 Firefox/144.0",
      "Referer": this.baseUrl
    };
  }

  parseComics(doc) {
    const result = [];
    for (let item of doc.querySelectorAll(".pb-2")) {
      const link = item.querySelector("a");
      const titleEl = item.querySelector("h3");
      const img = item.querySelector("img");
      if (link && titleEl && img && link.attributes["href"] && img.attributes["src"]) {
        result.push(new Comic({
          id: link.attributes["href"],
          title: titleEl.text,
          cover: img.attributes["src"]
        }));
      }
    }
    return result;
  }

  // 发现页列表
  explore = [
    {
      // 页面标题
      // title 用于标识页面，必须唯一
      title: this.name,

      /// multiPartPage 或 multiPageComicList 或 mixed
      type: "multiPartPage",

      load: async () => {
        const res = await Network.get(this.baseUrl, this.headers);
        const document = new HtmlDocument(res.body);
        const result = [{ title: "近期更新", comics: [], viewMore: null }];
        for (let item of document.querySelector(".pb-unit-md").querySelectorAll(".slicarda")) {
          result[0].comics.push(new Comic({
            id: item.attributes["href"],
            title: item.querySelector("h3").text,
            cover: item.querySelector("img").attributes["src"]
          }))
        }
        const cardlists = document.querySelectorAll(".cardlist");
        const hometitles = document.querySelectorAll(".hometitle");
        for (let i = 0; i < hometitles.length; i++) {
          result.push({
            title: hometitles[i].querySelector("h2").text,
            comics: this.parseComics(cardlists[i]),
            viewMore: {
              page: "category",
              attributes: {
                category: hometitles[i].querySelector("h2").text,
                param: hometitles[i].attributes["href"]
              },
            }
          });
        }
        return result;
      }
    }
  ]

  // 分类
  category = {
    /// 分类页标题，用于标识页面，必须唯一
    title: this.name,
    parts: [
      {
        name: "类型",
        type: "fixed",
        categories: [
          "全部",
          "韩漫",
          "热门漫画",
          "国漫",
          "其他",
          "日漫",
          "欧美"
        ],
        itemType: "category",
        categoryParams: [
          "/manga",
          "/manga-genre/kr",
          "/manga-genre/hots",
          "/manga-genre/cn",
          "/manga-genre/qita",
          "/manga-genre/jp",
          "/manga-genre/ou-mei"
        ],
      },
      {
        name: "标签",
        type: "fixed",
        categories: [
          "复仇",
          "古风",
          "奇幻",
          "逆袭",
          "异能",
          "宅向",
          "穿越",
          "热血",
          "纯爱",
          "系统",
          "重生",
          "冒险",
          "灵异",
          "大女主",
          "剧情",
          "恋爱",
          "玄幻",
          "女神",
          "科幻",
          "魔幻",
          "推理",
          "猎奇",
          "治愈",
          "都市",
          "异形",
          "青春",
          "末日",
          "悬疑",
          "修仙",
          "战斗"
        ],
        itemType: "category",
        categoryParams: [
          "/manga-tag/fuchou",
          "/manga-tag/gufeng",
          "/manga-tag/qihuan",
          "/manga-tag/nixi",
          "/manga-tag/yineng",
          "/manga-tag/zhaixiang",
          "/manga-tag/chuanyue",
          "/manga-tag/rexue",
          "/manga-tag/chunai",
          "/manga-tag/xitong",
          "/manga-tag/zhongsheng",
          "/manga-tag/maoxian",
          "/manga-tag/lingyi",
          "/manga-tag/danvzhu",
          "/manga-tag/juqing",
          "/manga-tag/lianai",
          "/manga-tag/xuanhuan",
          "/manga-tag/nvshen",
          "/manga-tag/kehuan",
          "/manga-tag/mohuan",
          "/manga-tag/tuili",
          "/manga-tag/lieqi",
          "/manga-tag/zhiyu",
          "/manga-tag/doushi",
          "/manga-tag/yixing",
          "/manga-tag/qingchun",
          "/manga-tag/mori",
          "/manga-tag/xuanyi",
          "/manga-tag/xiuxian",
          "/manga-tag/zhandou"
        ],
      }
    ],
    // 是否启用排行榜页面
    enableRankingPage: false,
  }

  /// 分类漫画加载
  categoryComics = {
    load: async (category, params, options, page) => {
      const res = await Network.get(`${this.baseUrl}${params}/page/${page}`, this.headers);
      if (res.status !== 200) {
        throw `Invalid status code: ${res.status}`;
      }
      const document = new HtmlDocument(res.body);
      let maxPage = null;
      try {
        maxPage = parseInt(document.querySelectorAll("button.text-small").pop().text.replaceAll("\n", "").replaceAll(" ", ""));
      } catch(_) {
        maxPage = 1;
      }
      return {
        comics: this.parseComics(document),
        maxPage: maxPage
      };
    }
  }

  /// 搜索相关
  search = {
    load: async (keyword, options, page) => {
      const res = await Network.get(`${this.baseUrl}/s/${keyword}?page=${page}`, this.headers);
      if (res.status !== 200) {
        throw `Invalid status code: ${res.status}`;
      }
      const document = new HtmlDocument(res.body);
      let maxPage = null;
      try {
        maxPage = parseInt(document.querySelectorAll("button.text-small").pop().text.replaceAll("\n", "").replaceAll(" ", ""));
      } catch(_) {
        maxPage = 1;
      }
      return {
        comics: this.parseComics(document),
        maxPage: maxPage
      };
    },
    // 是否启用标签建议
    enableTagsSuggestions: false,
  }

  /// 单部漫画相关
  comic = {
    onThumbnailLoad: (url) => {
      return {
        headers: this.headers
      }
    },
    loadInfo: async (id) => {
      const res = await Network.get(this.baseUrl + id, this.headers);
      if (res.status !== 200) {
        throw `Invalid status code: ${res.status}`;
      }
      const document = new HtmlDocument(res.body);

      const titleEl = document.querySelector(".text-xl");
      const title = titleEl ? (titleEl.text || "").trim().split("   ")[0] : "";

      const coverEl = document.querySelector(".object-cover");
      const cover = (coverEl && coverEl.attributes && coverEl.attributes["src"]) || "";

      const descEl = document.querySelector("p.text-medium");
      const description = descEl ? (descEl.text || "") : "";

      const infos = document.querySelectorAll("div.py-1");
      const tags = { "作者": [], "类型": [], "标签": [] };
      if (infos && infos.length >= 3) {
        if (infos[0]) {
          for (let author of infos[0].querySelectorAll("a > span")) {
            let author_name = (author.text || "").trim();
            if (author_name.endsWith(",")) {
              author_name = author_name.slice(0, -1).trim();
            }
            if (author_name) tags["作者"].push(author_name);
          }
        }
        if (infos[1]) {
          for (let category of infos[1].querySelectorAll("a > span")) {
            let category_name = (category.text || "").trim();
            if (category_name.endsWith(",")) {
              category_name = category_name.slice(0, -1).trim();
            }
            if (category_name) tags["类型"].push(category_name);
          }
        }
        if (infos[2]) {
          for (let tag of infos[2].querySelectorAll("a")) {
            const tagText = (tag.text || "").replace("\n", "").replaceAll(" ", "").replace("#", "");
            if (tagText) tags["标签"].push(tagText);
          }
        }
      }

      const mangaEl = document.querySelector("#mangachapters");
      const mangaId = mangaEl && mangaEl.attributes ? mangaEl.attributes["data-mid"] : null;
      if (!mangaId) {
        throw "无法获取漫画ID";
      }

      const chapters = {};
      const jsonRes = await Network.get(`${this.apiUrl}/manga/get?mid=${mangaId}&mode=all&t=${Date.now()}`, this.headers);
      if (jsonRes.status !== 200) {
        throw `Invalid status code: ${jsonRes.status}`;
      }
      try {
        const jsonData = JSON.parse(jsonRes.body);
        if (jsonData && jsonData["data"] && jsonData["data"]["chapters"]) {
          for (let ch of jsonData["data"]["chapters"]) {
            if (ch["id"] != null && ch["attributes"] && ch["attributes"]["title"] != null) {
              chapters[`${mangaId}@${ch["id"]}`] = ch["attributes"]["title"];
            }
          }
        }
      } catch (e) {
        throw "章节数据解析失败";
      }

      const recommend = [];
      for (let item of document.querySelectorAll("div.cardlist > div.pb-2")) {
        const recLink = item.querySelector("a");
        const recTitle = item.querySelector("h3");
        const recImg = item.querySelector("img");
        if (recLink && recTitle && recImg && recLink.attributes["href"] && recImg.attributes["src"]) {
          recommend.push(new Comic({
            id: recLink.attributes["href"],
            title: recTitle.text,
            cover: recImg.attributes["src"]
          }));
        }
      }
      return new ComicDetails({
        title: title,
        cover: cover,
        description: description,
        tags: tags,
        chapters: chapters,
        recommend: recommend,
      });
    },

    loadEp: async (comicId, epId) => {
      if (!epId || !epId.includes("@")) {
        throw "无效的章节ID";
      }
      const ids = epId.split("@");
      const res = await Network.get(`${this.apiUrl}/chapter/getinfo?m=${ids[0]}&c=${ids[1]}`, this.headers);
      if (res.status !== 200) {
        throw `Invalid status code: ${res.status}`;
      }
      let jsonData;
      try {
        jsonData = JSON.parse(res.body);
      } catch (e) {
        throw "章节数据解析失败";
      }

      // 空值安全检查：防止 API 返回异常数据结构导致崩溃
      if (!jsonData || !jsonData["data"] || !jsonData["data"]["info"]
          || !jsonData["data"]["info"]["images"]) {
        throw "章节图片数据为空";
      }
      const imagesRaw = jsonData["data"]["info"]["images"]["images"];

      let imagesList;
      if (typeof imagesRaw === "string") {
        // v2 API：混淆字符串 — 解码还原为 JSON 数组
        imagesList = decodeChapterImages(imagesRaw);
      } else if (Array.isArray(imagesRaw)) {
        // v1 API（向后兼容）：{url: "...", order: N} 数组
        imagesList = imagesRaw;
      } else {
        // 未知格式的图片数据
        throw "未知的图片数据格式";
      }

      const images = [];
      for (let i of imagesList) {
        if (i && i["url"]) {
          images.push(this.imageUrl + i["url"]);
        }
      }
      return { images };
    },

    // 是否启用标签翻译
    enableTagsTranslate: false,
  }
}
