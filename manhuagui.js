/** @type {import('./_venera_.js')} */
class NewComicSource extends ComicSource {
  // Note: The fields which are marked as [Optional] should be removed if not used

  // name of the source
  name = "漫画柜";

  // unique id of the source
  key = "ManHuaGui";

  version = "1.0.0";

  minAppVersion = "1.4.0";

  // update url
  url =
    "https://cdn.jsdelivr.net/gh/venera-app/venera-configs@main/manhuagui.js";

  baseUrl = "https://www.manhuagui.com";
  async getHtml(url) {
    let headers = {
      accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
      "accept-language": "zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6",
      "cache-control": "no-cache",
      pragma: "no-cache",
      priority: "u=0, i",
      "sec-ch-ua":
        '"Microsoft Edge";v="137", "Chromium";v="137", "Not/A)Brand";v="24"',
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": '"Windows"',
      "sec-fetch-dest": "document",
      "sec-fetch-mode": "navigate",
      "sec-fetch-site": "same-origin",
      "sec-fetch-user": "?1",
      "upgrade-insecure-requests": "1",
      cookie: "country=US",
      Referer: "https://www.manhuagui.com/",
      "Referrer-Policy": "strict-origin-when-cross-origin",
    };
    let res = await Network.get(url, headers);
    if (res.status !== 200) {
      throw "Invalid status code: " + res.status;
    }
    let document = new HtmlDocument(res.body);
    return document;
  }
  parseSimpleComic(e) {
    let url = e.querySelector(".ell > a").attributes["href"];
    let id = url.split("/")[2];
    let title = e.querySelector(".ell > a").text.trim();
    let cover = e.querySelector("img").attributes["src"];
    if (!cover) {
      cover = e.querySelector("img").attributes["data-src"];
    }
    cover = `https:${cover}`;
    let description = e.querySelector(".tt").text.trim();
    return new Comic({
      id,
      title,
      cover,
      description,
    });
  }

  parseComic(e) {
    let simple = this.parseSimpleComic(e);
    let sl = e.querySelector(".sl");
    let status = sl ? "连载" : "完结";
    // 如果能够找到 <span class="updateon">更新于：2020-03-31<em>3.9</em></span> 解析 更新和评分
    let tmp = e.querySelector(".updateon").childNodes;
    let update = tmp[0].replace("更新于：", "").trim();
    let tags = [status, update];

    return new Comic({
      id: simple.id,
      title: simple.title,
      cover: simple.cover,
      description: simple.description,
      tags,
      author,
    });
  }
  /**
   * [Optional] init function
   */
  init() {
    var LZString = (function () {
      var f = String.fromCharCode;
      var keyStrBase64 =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
      var baseReverseDic = {};
      function getBaseValue(alphabet, character) {
        if (!baseReverseDic[alphabet]) {
          baseReverseDic[alphabet] = {};
          for (var i = 0; i < alphabet.length; i++) {
            baseReverseDic[alphabet][alphabet.charAt(i)] = i;
          }
        }
        return baseReverseDic[alphabet][character];
      }
      var LZString = {
        decompressFromBase64: function (input) {
          if (input == null) return "";
          if (input == "") return null;
          return LZString._0(input.length, 32, function (index) {
            return getBaseValue(keyStrBase64, input.charAt(index));
          });
        },
        _0: function (length, resetValue, getNextValue) {
          var dictionary = [],
            next,
            enlargeIn = 4,
            dictSize = 4,
            numBits = 3,
            entry = "",
            result = [],
            i,
            w,
            bits,
            resb,
            maxpower,
            power,
            c,
            data = {
              val: getNextValue(0),
              position: resetValue,
              index: 1,
            };
          for (i = 0; i < 3; i += 1) {
            dictionary[i] = i;
          }
          bits = 0;
          maxpower = Math.pow(2, 2);
          power = 1;
          while (power != maxpower) {
            resb = data.val & data.position;
            data.position >>= 1;
            if (data.position == 0) {
              data.position = resetValue;
              data.val = getNextValue(data.index++);
            }
            bits |= (resb > 0 ? 1 : 0) * power;
            power <<= 1;
          }
          switch ((next = bits)) {
            case 0:
              bits = 0;
              maxpower = Math.pow(2, 8);
              power = 1;
              while (power != maxpower) {
                resb = data.val & data.position;
                data.position >>= 1;
                if (data.position == 0) {
                  data.position = resetValue;
                  data.val = getNextValue(data.index++);
                }
                bits |= (resb > 0 ? 1 : 0) * power;
                power <<= 1;
              }
              c = f(bits);
              break;
            case 1:
              bits = 0;
              maxpower = Math.pow(2, 16);
              power = 1;
              while (power != maxpower) {
                resb = data.val & data.position;
                data.position >>= 1;
                if (data.position == 0) {
                  data.position = resetValue;
                  data.val = getNextValue(data.index++);
                }
                bits |= (resb > 0 ? 1 : 0) * power;
                power <<= 1;
              }
              c = f(bits);
              break;
            case 2:
              return "";
          }
          dictionary[3] = c;
          w = c;
          result.push(c);
          while (true) {
            if (data.index > length) {
              return "";
            }
            bits = 0;
            maxpower = Math.pow(2, numBits);
            power = 1;
            while (power != maxpower) {
              resb = data.val & data.position;
              data.position >>= 1;
              if (data.position == 0) {
                data.position = resetValue;
                data.val = getNextValue(data.index++);
              }
              bits |= (resb > 0 ? 1 : 0) * power;
              power <<= 1;
            }
            switch ((c = bits)) {
              case 0:
                bits = 0;
                maxpower = Math.pow(2, 8);
                power = 1;
                while (power != maxpower) {
                  resb = data.val & data.position;
                  data.position >>= 1;
                  if (data.position == 0) {
                    data.position = resetValue;
                    data.val = getNextValue(data.index++);
                  }
                  bits |= (resb > 0 ? 1 : 0) * power;
                  power <<= 1;
                }
                dictionary[dictSize++] = f(bits);
                c = dictSize - 1;
                enlargeIn--;
                break;
              case 1:
                bits = 0;
                maxpower = Math.pow(2, 16);
                power = 1;
                while (power != maxpower) {
                  resb = data.val & data.position;
                  data.position >>= 1;
                  if (data.position == 0) {
                    data.position = resetValue;
                    data.val = getNextValue(data.index++);
                  }
                  bits |= (resb > 0 ? 1 : 0) * power;
                  power <<= 1;
                }
                dictionary[dictSize++] = f(bits);
                c = dictSize - 1;
                enlargeIn--;
                break;
              case 2:
                return result.join("");
            }
            if (enlargeIn == 0) {
              enlargeIn = Math.pow(2, numBits);
              numBits++;
            }
            if (dictionary[c]) {
              entry = dictionary[c];
            } else {
              if (c === dictSize) {
                entry = w + w.charAt(0);
              } else {
                return null;
              }
            }
            result.push(entry);
            dictionary[dictSize++] = w + entry.charAt(0);
            enlargeIn--;
            w = entry;
            if (enlargeIn == 0) {
              enlargeIn = Math.pow(2, numBits);
              numBits++;
            }
          }
        },
      };
      return LZString;
    })();

    function splitParams(str) {
      let params = [];
      let currentParam = "";
      let stack = [];

      for (let i = 0; i < str.length; i++) {
        const char = str[i];

        if (char === "(" || char === "[" || char === "{") {
          stack.push(char);
          currentParam += char;
        } else if (char === ")" && stack[stack.length - 1] === "(") {
          stack.pop();
          currentParam += char;
        } else if (char === "]" && stack[stack.length - 1] === "[") {
          stack.pop();
          currentParam += char;
        } else if (char === "}" && stack[stack.length - 1] === "{") {
          stack.pop();
          currentParam += char;
        } else if (char === "," && stack.length === 0) {
          params.push(currentParam.trim());
          currentParam = "";
        } else {
          currentParam += char;
        }
      }

      if (currentParam) {
        params.push(currentParam.trim());
      }

      return params;
    }

    function extractParams(str) {
      let params_part = str.split("}(")[1].split("))")[0];
      let params = splitParams(params_part);
      params[5] = {};
      params[3] = LZString.decompressFromBase64(params[3].split("'")[1]).split(
        "|"
      );
      return params;
    }

    function formatData(p, a, c, k, e, d) {
      e = function (c) {
        return (
          (c < a ? "" : e(parseInt(c / a))) +
          ((c = c % a) > 35 ? String.fromCharCode(c + 29) : c.toString(36))
        );
      };
      if (!"".replace(/^/, String)) {
        while (c--) d[e(c)] = k[c] || e(c);
        k = [
          function (e) {
            return d[e];
          },
        ];
        e = function () {
          return "\\w+";
        };
        c = 1;
      }
      while (c--)
        if (k[c]) p = p.replace(new RegExp("\\b" + e(c) + "\\b", "g"), k[c]);
      return p;
    }
    function extractFields(text) {
      // 创建一个对象存储提取的结果
      const result = {};

      // 提取files数组
      const filesMatch = text.match(/"files":\s*\[(.*?)\]/);
      if (filesMatch && filesMatch[1]) {
        // 提取所有文件名并去除引号和空格
        result.files = filesMatch[1]
          .split(",")
          .map((file) => file.trim().replace(/"/g, ""));
      }

      // 提取path
      const pathMatch = text.match(/"path":\s*"([^"]+)"/);
      if (pathMatch && pathMatch[1]) {
        result.path = pathMatch[1];
      }

      // 提取len
      const lenMatch = text.match(/"len":\s*(\d+)/);
      if (lenMatch && lenMatch[1]) {
        result.len = parseInt(lenMatch[1], 10);
      }

      // 提取sl对象
      const slMatch = text.match(/"sl":\s*({[^}]+})/);
      if (slMatch && slMatch[1]) {
        try {
          // 将提取的字符串转换为对象
          result.sl = JSON.parse(slMatch[1].replace(/(\w+):/g, '"$1":'));
        } catch (e) {
          console.error("解析sl字段失败:", e);
          result.sl = null;
        }
      }

      return result;
    }
    this.getImgInfos = function (script) {
      let params = extractParams(script);
      let imgData = formatData(...params);
      let imgInfos = extractFields(imgData);
      return imgInfos;
    };
  }

  // explore page list
  explore = [
    {
      // title of the page.
      // title is used to identify the page, it should be unique
      title: "漫画柜",

      /// multiPartPage or multiPageComicList or mixed
      type: "singlePageWithMultiPart",

      /**
       * load function
       * @param page {number | null} - page number, null for `singlePageWithMultiPart` type
       * @returns {{}}
       * - for `multiPartPage` type, return [{title: string, comics: Comic[], viewMore: PageJumpTarget}]
       * - for `multiPageComicList` type, for each page(1-based), return {comics: Comic[], maxPage: number}
       * - for `mixed` type, use param `page` as index. for each index(0-based), return {data: [], maxPage: number?}, data is an array contains Comic[] or {title: string, comics: Comic[], viewMore: string?}
       */
      load: async (page) => {
        let document = await this.getHtml(this.baseUrl);
        // log("info", this.name, `获取主页成功`);
        let tabs = document.querySelectorAll("#cmt-tab li");
        // log("info", this.name, tabs);
        let parts = document.querySelectorAll("#cmt-cont ul");
        // log("info", this.name, parts);
        let result = {};
        // tabs len = parts len
        for (let i = 0; i < tabs.length; i++) {
          let title = tabs[i].text.trim();
          let comics = parts[i]
            .querySelectorAll("li")
            .map((e) => this.parseSimpleComic(e));
          result[title] = comics;
        }
        // log("info", this.name, result);
        return result;
      },

      /**
       * Only use for `multiPageComicList` type.
       * `loadNext` would be ignored if `load` function is implemented.
       * @param next {string | null} - next page token, null if first page
       * @returns {Promise<{comics: Comic[], next: string?}>} - next is null if no next page.
       */
      loadNext(next) {},
    },
  ];

  // categories
  category = {
    /// title of the category page, used to identify the page, it should be unique
    title: "漫画柜",
    parts: [
      {
        name: "类型",
        type: "fixed",
        itemType: "category",
        categories: [
          "全部",
          "热血",
          "冒险",
          "魔幻",
          "神鬼",
          "搞笑",
          "萌系",
          "爱情",
          "科幻",
          "魔法",
          "格斗",
          "武侠",
          "机战",
          "战争",
          "竞技",
          "体育",
          "校园",
          "生活",
          "励志",
          "历史",
          "伪娘",
          "宅男",
          "腐女",
          "耽美",
          "百合",
          "后宫",
          "治愈",
          "美食",
          "推理",
          "悬疑",
          "恐怖",
          "四格",
          "职场",
          "侦探",
          "社会",
          "音乐",
          "舞蹈",
          "杂志",
          "黑道",
        ],
        categoryParams: [
          "",
          "rexue",
          "maoxian",
          "mohuan",
          "shengui",
          "gaoxiao",
          "mengxi",
          "aiqing",
          "kehuan",
          "mofa",
          "gedou",
          "wuxia",
          "jizhan",
          "zhanzheng",
          "jingji",
          "tiyu",
          "xiaoyuan",
          "shenghuo",
          "lizhi",
          "lishi",
          "weiniang",
          "zhainan",
          "funv",
          "danmei",
          "baihe",
          "hougong",
          "zhiyu",
          "meishi",
          "tuili",
          "xuanyi",
          "kongbu",
          "sige",
          "zhichang",
          "zhentan",
          "shehui",
          "yinyue",
          "wudao",
          "zazhi",
          "heidao",
        ],
      },
    ],
    // enable ranking page
    enableRankingPage: false,
  };

  /// category comic loading related
  categoryComics = {
    /**
     * load comics of a category
     * @param category {string} - category name
     * @param param {string?} - category param
     * @param options {string[]} - options from optionList
     * @param page {number} - page number
     * @returns {Promise<{comics: Comic[], maxPage: number}>}
     */
    load: async (category, param, options, page) => {
      let area = options[0];
      let genre = param;
      let age = options[1];
      let status = options[2];
      // log(
      //   "info",
      //   this.name,
      //   ` 加载分类漫画: ${area} | ${genre} | ${age} | ${status}`
      // );
      // 字符串之间用“_”连接，空字符串除外
      let params = [area, genre, age, status].filter((e) => e != "").join("_");

      let url = `${this.baseUrl}/list/${params}/index_p${page}.html`;

      let document = await this.getHtml(url);
      let maxPage = document
        .querySelector(".result-count")
        .querySelectorAll("strong")[1].text;
      maxPage = parseInt(maxPage);
      let comics = document
        .querySelectorAll("#contList > li")
        .map((e) => this.parseSimpleComic(e));
      return {
        comics,
        maxPage,
      };
    },
    // provide options for category comic loading
    optionList: [
      {
        options: [
          "-全部",
          "japan-日本",
          "hongkong-港台",
          "other-其它",
          "europe-欧美",
          "china-内地",
          "korea-韩国",
        ],
      },
      {
        options: [
          "-全部",
          "shaonv-少女",
          "shaonian-少年",
          "qingnian-青年",
          "ertong-儿童",
          "tongyong-通用",
        ],
      },
      {
        options: ["-全部", "lianzai-连载", "wanjie-完结"],
      },
    ],
    ranking: {
      // 对于单个选项，使用“-”分隔值和文本，左侧为值，右侧为文本
      options: [
        "-最新发布",
        "update-最新更新",
        "view-人气最旺",
        "rate-评分最高",
      ],
      /**
       * 加载排行榜漫画
       * @param option {string} - 来自optionList的选项
       * @param page {number} - 页码
       * @returns {Promise<{comics: Comic[], maxPage: number}>}
       */
      load: async (option, page) => {
        let url = `${this.baseUrl}/list/${option}_p${page}.html`;
        let document = await this.getHtml(url);
        let maxPage = document
          .querySelector(".result-count")
          .querySelectorAll("strong")[1].text;
        maxPage = parseInt(maxPage);
        let comics = document
          .querySelector("#contList")
          .querySelectorAll("li")
          .map((e) => this.parseComic(e));
        return {
          comics,
          maxPage,
        };
      },
    },
  };

  /// search related
  search = {
    /**
     * load search result
     * @param keyword {string}
     * @param options {string[]} - options from optionList
     * @param page {number}
     * @returns {Promise<{comics: Comic[], maxPage: number}>}
     */
    load: async (keyword, options, page) => {
      let url = `${this.baseUrl}/s/${keyword}_p${page}.html`;
      let document = await this.getHtml(url);
      let comicNum = document
        .querySelector(".result-count")
        .querySelectorAll("strong")[1].text;
      comicNum = parseInt(comicNum);
      // 每页10个
      let maxPage = Math.ceil(comicNum / 10);

      let bookshelf = document
        .querySelector("#contList")
        .querySelectorAll("li");
      let comics = bookshelf.map((e) => this.parseComic(e));
      return {
        comics,
        maxPage,
      };
    },

    // provide options for search
    optionList: [
      {
        // [Optional] default is `select`
        // type: select, multi-select, dropdown
        // For select, there is only one selected value
        // For multi-select, there are multiple selected values or none. The `load` function will receive a json string which is an array of selected values
        // For dropdown, there is one selected value at most. If no selected value, the `load` function will receive a null
        type: "select",
        // For a single option, use `-` to separate the value and text, left for value, right for text
        options: ["0-time", "1-popular"],
        // option label
        label: "sort",
        // default selected options. If not set, use the first option as default
        default: null,
      },
    ],

    // enable tags suggestions
    enableTagsSuggestions: false,
  };

  /// single comic related
  comic = {
    /**
     * load comic info
     * @param id {string}
     * @returns {Promise<ComicDetails>}
     */
    loadInfo: async (id) => {
      let url = `${this.baseUrl}/comic/${id}/`;
      let document = await this.getHtml(url);
      // ANCHOR 基本信息
      let book = document.querySelector(".book-cont");
      let title = book
        .querySelector(".book-title")
        .querySelector("h1")
        .text.trim();
      let subtitle = book
        .querySelector(".book-title")
        .querySelector("h2")
        .text.trim();
      let cover = book.querySelector(".hcover").querySelector("img").attributes[
        "src"
      ];
      cover = `https:${cover}`;
      let description = book
        .querySelector("#intro-all")
        .querySelectorAll("p")
        .map((e) => e.text.trim())
        .join("\n");
      //   log("warn", this.name, { title, subtitle, cover, description });

      let detail_list = book.querySelectorAll(".detail-list span");

      function parseDetail(idx) {
        let ele = detail_list[idx].querySelectorAll("a");
        if (ele.length > 0) {
          return ele.map((e) => e.text.trim());
        }
        return [""];
      }
      let createYear = parseDetail(0);
      let area = parseDetail(1);
      let genre = parseDetail(3);
      let author = parseDetail(4);
      // let alias = parseDetail(5);

      //   let lastChapter = parseDetail(6);
      let status = detail_list[7].text.trim();

      let tags = {
        年代: createYear,
        状态: [status],
        作者: author,
        地区: area,
        类型: genre,
      };
      let updateTime = detail_list[8].text.trim();

      // ANCHOR 章节信息
      let chapters = new Map();
      let chapter_list = document.querySelector("#chapter-list-1");
      if (!chapter_list) {
        chapter_list = document.querySelector("#chapter-list-0");
      }
      let lis = chapter_list.querySelectorAll("li");
      for (let li of lis) {
        let a = li.querySelector("a");
        let i = a.attributes["href"].split("/").pop().replace(".html", "");
        let title = a.querySelector("span").text.trim();
        chapters.set(i, title);
      }
      // chapters 升序
      chapters = new Map([...chapters].sort((a, b) => a[0] - b[0]));

      //ANCHOR - 推荐
      let recommend = [];
      let similar = document.querySelector(".similar-list");
      if (similar) {
        let similar_list = similar.querySelectorAll("li");
        for (let li of similar_list) {
          let comic = this.parseSimpleComic(li);
          recommend.push(comic);
        }
      }

      return new ComicDetails({
        title,
        subtitle,
        cover,
        description,
        tags,
        updateTime,
        chapters,
        recommend,
      });
    },

    /**
     * load images of a chapter
     * @param comicId {string}
     * @param epId {string?}
     * @returns {Promise<{images: string[]}>}
     */
    loadEp: async (comicId, epId) => {
      let url = `${this.baseUrl}/comic/${comicId}/${epId}.html`;
      let document = await this.getHtml(url);
      let script = document.querySelectorAll("script")[4].innerHTML;
      let infos = this.getImgInfos(script);

      // https://us.hamreus.com/ps3/y/yiquanchaoren/第190话重制版/003.jpg.webp?e=1754143606&m=DPpelwkhr-pS3OXJpS6VkQ
      let imgDomain = `https://us.hamreus.com`;
      let images = [];
      for (let f of infos.files) {
        let imgUrl =
          imgDomain + infos.path + f + `?e=${infos.sl.e}&m=${infos.sl.m}`;
        images.push(imgUrl);
      }
      // log("warning", this.name, images);
      return {
        images,
      };
    },
    /**
     * [Optional] provide configs for an image loading
     * @param url
     * @param comicId
     * @param epId
     * @returns {ImageLoadingConfig | Promise<ImageLoadingConfig>}
     */
    onImageLoad: (url, comicId, epId) => {
      return {
        headers: {
          accept:
            "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
          "accept-language": "zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6",
          "cache-control": "no-cache",
          pragma: "no-cache",
          priority: "i",
          "sec-ch-ua":
            '"Microsoft Edge";v="137", "Chromium";v="137", "Not/A)Brand";v="24"',
          "sec-ch-ua-mobile": "?0",
          "sec-ch-ua-platform": '"Windows"',
          "sec-fetch-dest": "image",
          "sec-fetch-mode": "no-cors",
          "sec-fetch-site": "cross-site",
          "sec-fetch-storage-access": "active",
          Referer: "https://www.manhuagui.com/",
          "Referrer-Policy": "strict-origin-when-cross-origin",
        },
      };
    },
    /**
     * [Optional] provide configs for a thumbnail loading
     * @param url {string}
     * @returns {ImageLoadingConfig | Promise<ImageLoadingConfig>}
     *
     * `ImageLoadingConfig.modifyImage` and `ImageLoadingConfig.onLoadFailed` will be ignored.
     * They are not supported for thumbnails.
     */
    onThumbnailLoad: (url) => {
      let headers = {
        accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
        "accept-language": "zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6",
        "cache-control": "no-cache",
        pragma: "no-cache",
        priority: "u=0, i",
        "sec-ch-ua":
          '"Microsoft Edge";v="137", "Chromium";v="137", "Not/A)Brand";v="24"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"Windows"',
        "sec-fetch-dest": "document",
        "sec-fetch-mode": "navigate",
        "sec-fetch-site": "none",
        "sec-fetch-user": "?1",
        "upgrade-insecure-requests": "1",
        "Referrer-Policy": "strict-origin-when-cross-origin",
      };

      return {
        headers,
      };
    },
  };
}
