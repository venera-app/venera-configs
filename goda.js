/** @type {import('./_venera_.js')} */
class Goda extends ComicSource {
  // Note: The fields which are marked as [Optional] should be removed if not used

  // name of the source
  name = "GoDa漫画"

  // unique id of the source
  key = "goda"

  version = "1.1.0"

  minAppVersion = "1.4.0"

  // update url
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
      default: "api-get-v3.mgsearcher.com"
    },
    image: {
      title: "图片域名",
      type: "input",
      default: "t40-1-4.g-mh.online"
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
    console.warn(doc)
    const result = [];
    for (let item of doc.querySelectorAll(".pb-2")) {
      result.push(new Comic({
        id: item.querySelector("a").attributes["href"],
        title: item.querySelector("h3").text,
        cover: item.querySelector("img").attributes["src"]
      }))
    }
    return result;
  }

  // explore page list
  explore = [
    {
      // title of the page.
      // title is used to identify the page, it should be unique
      title: this.name,

      /// multiPartPage or multiPageComicList or mixed
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

  // categories
  category = {
    /// title of the category page, used to identify the page, it should be unique
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
    // enable ranking page
    enableRankingPage: false,
  }

  /// category comic loading related
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
      } catch (_) {
        maxPage = 1;
      }
      return {
        comics: this.parseComics(document),
        maxPage: maxPage
      };
    }
  }

  /// search related
  search = {
    load: async (keyword, options, page) => {
      const res = await Network.get(`${this.baseUrl}/s/${keyword}?page=${page}`);
      if (res.status !== 200) {
        throw `Invalid status code: ${res.status}`;
      }
      const document = new HtmlDocument(res.body);
      let maxPage = null;
      try {
        maxPage = parseInt(document.querySelectorAll("button.text-small").pop().text.replaceAll("\n", "").replaceAll(" ", ""));
      } catch (_) {
        maxPage = 1;
      }
      return {
        comics: this.parseComics(document),
        maxPage: maxPage
      };
    },
    // enable tags suggestions
    enableTagsSuggestions: false,
  }

  /// single comic related
  comic = {
    onThumbnailLoad: (url) => {
      return {
        headers: this.headers
      }
    },
    loadInfo: async (id) => {
      const res = await Network.get(this.baseUrl + id);
      if (res.status !== 200) {
        throw `Invalid status code: ${res.status}`;
      }
      const document = new HtmlDocument(res.body);
      const title = document.querySelector(".text-xl").text.trim().split("   ")[0]
      const cover = document.querySelector(".object-cover").attributes["src"];
      const description = document.querySelector("p.text-medium").text;
      const infos = document.querySelectorAll("div.py-1");
      const tags = { "作者": [], "类型": [], "标签": [] };
      for (let author of infos[0].querySelectorAll("a > span")) {
        let author_name = author.text.trim();
        if (author_name.endsWith(",")) {
          author_name = author_name.slice(0, -1).trim();
        }
        tags["作者"].push(author_name);
      }
      for (let category of infos[1].querySelectorAll("a > span")) {
        let category_name = category.text.trim();
        if (category_name.endsWith(",")) {
          category_name = category_name.slice(0, -1).trim();
        }
        tags["类型"].push(category_name);
      }
      for (let tag of infos[2].querySelectorAll("a")) {
        tags["标签"].push(tag.text.replace("\n", "").replaceAll(" ", "").replace("#", ""));
      }
      const mangaId = document.querySelector("#mangachapters").attributes["data-mid"];
      const jsonRes = await Network.get(`${this.apiUrl}/manga/get?mid=${mangaId}&mode=all&t=${Date.now()}`, this.headers);
      const jsonData = JSON.parse(jsonRes.body);
      const chapters = {};
      for (let ch of jsonData["data"]["chapters"]) {
        chapters[`${mangaId}@${ch["id"]}`] = ch["attributes"]["title"];
      }
      const recommend = [];
      for (let item of document.querySelectorAll("div.cardlist > div.pb-2")) {
        recommend.push(new Comic({
          id: item.querySelector("a").attributes["href"],
          title: item.querySelector("h3").text,
          cover: item.querySelector("img").attributes["src"]
        }));
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
      const ids = epId.split("@");
      const res = await Network.get(`${this.apiUrl}/chapter/getinfo?m=${ids[0]}&c=${ids[1]}`, this.headers);
      if (res.status !== 200) {
        throw `Invalid status code: ${res.status}`;
      }
      const jsonData = JSON.parse(res.body);
      const images = [];
      const decodeImagesData = this.decodeCipherText(jsonData["data"]["info"]["images"]["images"])
      for (let i of decodeImagesData) {
        images.push(this.imageUrl + i["url"]);
      }
      return { images };
    },

    // enable tags translate
    enableTagsTranslate: false,
  }
  /**
   * decode images data
   * @param {string} cipherText 
   * @returns string
   */
  decodeCipherText(cipherText) {
    /**
     * 输入字符串
     *   ↓
     * 检查前缀 J7r 和后缀 nQ
     *   ↓
     * 拆分 body，验证中间标记 kD、W4s
     *   ↓
     * 重新拼接被打乱的片段
     *   ↓
     * 每 7 个字符一组，奇数组反转
     *   ↓
     * 字符表替换
     *   ↓
     * Base64URL 解码
     *   ↓
     * TextDecoder 解 UTF-8
     *   ↓
     * JSON.parse()
     */
    const BASE64URL_ALPHABET =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

    const SUBSTITUTION_ALPHABET =
      "_-9876543210abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

    const PREFIX = "J7r";
    const MARKER_1 = "kD";
    const MARKER_2 = "W4s";
    const SUFFIX = "nQ";
    const CHUNK_SIZE = 7;

    if (
      typeof cipherText !== "string" ||
      !cipherText.startsWith(PREFIX) ||
      !cipherText.endsWith(SUFFIX)
    ) {
      throw new Error("invalid format");
    }

    const body = cipherText.slice(PREFIX.length, -SUFFIX.length);

    const payloadLength = body.length - MARKER_1.length - MARKER_2.length;

    if (payloadLength <= 0) {
      throw new Error("invalid payload length");
    }

    const part3Length = Math.floor(payloadLength / 3);
    const part1Length = Math.floor((payloadLength - part3Length) / 2);
    const part2Length = payloadLength - part3Length - part1Length;

    const part1 = body.slice(0, part1Length);
    const marker1 = body.slice(part1Length, part1Length + MARKER_1.length);

    const part2Start = part1Length + MARKER_1.length;
    const part2 = body.slice(part2Start, part2Start + part2Length);

    const marker2Start = part2Start + part2Length;
    const marker2 = body.slice(marker2Start, marker2Start + MARKER_2.length);

    const part3 = body.slice(marker2Start + MARKER_2.length);

    if (marker1 !== MARKER_1 || marker2 !== MARKER_2 || part3.length !== part3Length) {
      throw new Error("invalid markers");
    }

    const reordered = part3 + part1 + part2;

    let unshuffled = "";

    for (let i = 0, chunkIndex = 0; i < reordered.length; i += CHUNK_SIZE, chunkIndex++) {
      const chunk = reordered.slice(i, i + CHUNK_SIZE);

      unshuffled += chunkIndex % 2 === 0
        ? chunk
        : chunk.split("").reverse().join("");
    }

    let base64url = "";

    for (const ch of unshuffled) {
      const index = SUBSTITUTION_ALPHABET.indexOf(ch);

      if (index === -1) {
        throw new Error("invalid character");
      }

      base64url += BASE64URL_ALPHABET[index];
    }

    const padding = base64url.length % 4
      ? "=".repeat(4 - (base64url.length % 4))
      : "";

    const base64 = (base64url + padding)
      .replace(/-/g, "+")
      .replace(/_/g, "/");

    let jsonText;

    if (typeof Buffer !== "undefined") {
      jsonText = Buffer.from(base64, "base64").toString("utf8");
    } else {
      const binary = this.atobPolyfill(base64);

      // 理论上应该都是ASCII字符用不用解码成uft-8都一样，
      // quickjs这也没有那也没有，动不动polyfill好烦
      // const bytes = new Uint8Array(binary.length);

      // for (let i = 0; i < binary.length; i++) {
      //   bytes[i] = binary.charCodeAt(i);
      // }

      // jsonText = new TextDecoder().decode(bytes);
      
      jsonText = binary;
    }

    return JSON.parse(jsonText);
  }

  atobPolyfill = (asc) => {
    const b64ch =
        'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
    const b64chs = Array.prototype.slice.call(b64ch);
    const b64re =
    /^(?:[A-Za-z\d+\/]{4})*?(?:[A-Za-z\d+\/]{2}(?:==)?|[A-Za-z\d+\/]{3}=?)?$/;
    const b64tab = ((a) => {
      let tab = {};
      a.forEach((c, i) => tab[c] = i);
      return tab;
    })(b64chs);
    const _fromCC = String.fromCharCode.bind(String);
    // console.log('polyfilled');
    asc = asc.replace(/\s+/g, '');
    if (!b64re.test(asc)) throw new TypeError('malformed base64.');
    asc += '=='.slice(2 - (asc.length & 3));
    let u24, r1, r2;
    let binArray = []; // use array to avoid minor gc in loop
    for (let i = 0; i < asc.length;) {
        u24 = b64tab[asc.charAt(i++)] << 18
            | b64tab[asc.charAt(i++)] << 12
            | (r1 = b64tab[asc.charAt(i++)]) << 6
            | (r2 = b64tab[asc.charAt(i++)]);
        if (r1 === 64) {
            binArray.push(_fromCC(u24 >> 16 & 255));
        } else if (r2 === 64) {
            binArray.push(_fromCC(u24 >> 16 & 255, u24 >> 8 & 255));
        } else {
            binArray.push(_fromCC(u24 >> 16 & 255, u24 >> 8 & 255, u24 & 255));
        }
    }
    return binArray.join('');
  };
}
