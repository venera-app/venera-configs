/** @type {import('./_venera_.js')} */
class ManHuaGui extends ComicSource {
  name = "漫画柜";

  key = "ManHuaGui";

  version = "1.1.1";

  minAppVersion = "1.4.0";

  url = "https://git.nyne.dev/nyne/venera-configs/raw/branch/main/manhuagui.js";

  baseUrl = "https://www.manhuagui.com";

  account = {
    login: async (username, password) => {
      let headers = {
        'content-type': 'application/x-www-form-urlencoded',
        'accept': 'application/json, text/javascript, */*; q=0.01',
        'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'cache-control': 'no-cache',
        'pragma': 'no-cache',
        'x-requested-with': 'XMLHttpRequest',
        'origin': this.baseUrl,
        'referer': `${this.baseUrl}/`,
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36'
      };
      let body = `txtUserName=${encodeURIComponent(username)}&txtPassword=${encodeURIComponent(password)}`;
      let res = await Network.post(`${this.baseUrl}/tools/submit_ajax.ashx?action=user_login`, headers, body);
      if (res.status !== 200) {
        throw "Invalid status code: " + res.status;
      }

      let setCookieHeader = res.headers['set-cookie'];
      if (!setCookieHeader) {
        throw "Set-Cookie header not found";
      }

      let cookies = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
      let myCookie = null;

      for (let cookie of cookies) {
        let match = cookie.match(/my=([^;]+)/);
        if (match) {
          myCookie = match[1];
          break;
        }
      }

      if (!myCookie) {
        throw "my cookie not found in Set-Cookie header";
      }

      this.saveData('mhg_cookie', "my="+myCookie);
      return "ok";
    },

    logout: function() {
      this.deleteData('mhg_cookie');
    },

    registerWebsite: "https://www.manhuagui.com/user/register"

  };

  isAppVersionAfter(target) {
    if (!APP || !APP.version) return false;
    let current = APP.version;
    let targetArr = target.split('.');
    let currentArr = current.split('.');
    for (let i = 0; i < 3; i++) {
      if (parseInt(currentArr[i]) < parseInt(targetArr[i])) {
        return false;
      }
    }
    return true;
  }

  async getHtml(url) {
    let mhg_cookie = this.loadData("mhg_cookie");
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
      Referer: "https://www.manhuagui.com/",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      cookie: mhg_cookie
    };
    let res = await Network.get(url, headers);
    if (res.status !== 200) {
      throw "Invalid status code: " + res.status;
    }
    let document = new HtmlDocument(res.body);
    return document;
  }
  parseSimpleComic(e) {
    let urlElement = e.querySelector(".ell > a");
    if (!urlElement) {
      console.warn("parseSimpleComic: Missing .ell > a element");
      return null;
    }
    let url = urlElement.attributes["href"];
    let id = url.split("/")[2];
    let title = urlElement.text.trim();

    let imgElement = e.querySelector("img");
    if (!imgElement) {
      console.warn("parseSimpleComic: Missing img element");
      return null;
    }
    let cover = imgElement.attributes["src"] || imgElement.attributes["data-src"];
    if (!cover) {
      console.warn("parseSimpleComic: Missing cover attribute");
      return null;
    }
    cover = `https:${cover}`;

    let descriptionElement = e.querySelector(".tt");
    let description = descriptionElement ? descriptionElement.text.trim() : "";

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
      title: "漫画柜",
      type: "multiPartPage",
      /**
       * 参考 manhuagui_explore.html，抓取“热门漫画最新更新”与 tab 板块
       */
      load: async (page) => {
        let document = await this.getHtml(this.baseUrl);
        let parts = [];

        // 1. 热门漫画最新更新
        let updateSection = document.querySelector(".update-cont");
        if (updateSection) {
          let updateComics = [];
          let uls = updateSection.querySelectorAll("ul");
          for (let ul of uls) {
            let comics = ul.querySelectorAll("li").map(e => this.parseSimpleComic(e)).filter(c => c);
            updateComics.push(...comics);
          }
          if (updateComics.length > 0) {
            parts.push({ title: "热门漫画最新更新", comics: updateComics });
          }
        }

        // 2. tab 板块（热门连载漫画、经典完结漫画、最新上架漫画、2020新番漫画）
        let tabTitles = document.querySelectorAll("#cmt-tab li");
        let tabParts = document.querySelectorAll("#cmt-cont ul.cover-list");
        for (let i = 0; i < tabTitles.length; i++) {
          let title = tabTitles[i].text.trim();
          let comics = tabParts[i].querySelectorAll("li").map(e => this.parseSimpleComic(e)).filter(c => c);
          if (comics.length > 0) {
            parts.push({ title, comics });
          }
        }

        return parts;
      },
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
      let sort = options[3] || "index";
      // log(
      //   "info",
      //   this.name,
      //   ` 加载分类漫画: ${area} | ${genre} | ${age} | ${status}`
      // );
      // 字符串之间用“_”连接，空字符串除外
      let params = [area, genre, age, status].filter((e) => e != "").join("_");

      let url = `${this.baseUrl}/list/${params}/${sort}_p${page}.html`;

      let document = await this.getHtml(url);
      let maxPage = document
        .querySelector(".result-count")
        .querySelectorAll("strong")[1].text;
      maxPage = parseInt(maxPage);
      let comics = document
        .querySelectorAll("#contList > li")
        .map((e) => this.parseSimpleComic(e))
        .filter((comic) => comic !== null); // 过滤掉 null 值
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
      {
        options: ["update-最新更新", "index-最新发布", "view-人气最旺", "rate-评分最高"],
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

  /**
   * 专门解析搜索结果页面中的漫画信息
   * @param {HTMLElement} item - 搜索结果中的单个漫画项
   * @returns {Comic} - 解析后的漫画对象
   */
  parseSearchComic(item) {
    try {
      // 获取漫画链接和ID
      let linkElement = item.querySelector(".book-detail dl dt a");
      if (!linkElement) return null;
      
      let url = linkElement.attributes["href"];
      let id = url.split("/")[2];
      let title = linkElement.text.trim();
      
      // 获取封面图片
      let coverElement = item.querySelector(".book-cover .bcover img");
      let cover = coverElement ? coverElement.attributes["src"] : null;
      if (cover) {
        cover = cover.startsWith("//") ? `https:${cover}` : cover;
      }
      
      // 获取更新状态和描述
      let statusElement = item.querySelector(".tags.status span .red");
      let status = statusElement ? statusElement.text.trim() : "";
      
      let updateElement = item.querySelector(".tags.status span .red:nth-child(2)");
      let updateTime = updateElement ? updateElement.text.trim() : "";
      
      // 获取评分信息
      let scoreElement = item.querySelector(".book-score .score-avg strong");
      let score = scoreElement ? scoreElement.text.trim() : "";
      
      // 获取作者信息
      let authorElements = item.querySelectorAll(".tags a[href*='/author/']");
      let author = authorElements.length > 0 
        ? authorElements.map(a => a.text.trim()).join(", ") 
        : "";
      
      // 获取类型信息
      let typeElements = item.querySelectorAll(".tags a[href*='/list/']");
      let types = typeElements.length > 0 
        ? typeElements.map(a => a.text.trim())
        : [];
      
      // 获取简介
      let introElement = item.querySelector(".intro span");
      let description = introElement ? introElement.text.replace("简介：", "").trim() : "";
      
      // 如果简介为空，使用更新状态作为描述
      if (!description && status) {
        description = `状态: ${status}`;
        if (updateTime) description += `, 更新: ${updateTime}`;
      }
      
      return new Comic({
        id,
        title,
        cover,
        description,
        tags: [...types, status],
        author,
        score
      });
    } catch (error) {
      console.error("解析搜索结果项时出错:", error);
      return null;
    }
  }

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
      let url = ""
      if (options[0]) {
        let type = options[0].split("-")[0];
          if (type == '0') {
              url = `${this.baseUrl}/s/${keyword}_p${page}.html`;
          } else{
            url = `${this.baseUrl}/s/${keyword}_o${type}_p${page}.html`;
          }
      }else{
          url = `${this.baseUrl}/s/${keyword}_p${page}.html`;
      }
      let document = await this.getHtml(url);
      
      // 检查是否有结果计数元素
      let resultCount = document.querySelector(".result-count");
      if (!resultCount) {
        // 没有搜索结果或页面结构不同
        return {
          comics: [],
          maxPage: 1
        };
      }
      
      let comicNum = resultCount.querySelectorAll("strong")[1].text;
      comicNum = parseInt(comicNum);
      // 每页10个
      let maxPage = Math.ceil(comicNum / 10);

      // 在搜索结果页面中，漫画列表位于 .book-result ul 下
      let comicList = document.querySelector(".book-result ul");
      if (!comicList) {
        return {
          comics: [],
          maxPage: maxPage || 1
        };
      }
      
      // 使用专门的搜索解析函数解析每个漫画项
      let comics = comicList.querySelectorAll("li.cf")
        .map(item => this.parseSearchComic(item))
        .filter(comic => comic !== null); // 过滤掉解析失败的项
      
      return {
        comics,
        maxPage,
      };
    },

    optionList: [
      {
        type: "select",
        options: ["0-最新更新", "1-最近最热","2-最新上架", "3-评分最高"],
        label: "sort",
        default: null,
      },
    ],

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
      // 支持多分组
      let chaptersMap = new Map();
      
      // 查找所有章节分组标题
      let chapterGroups = document.querySelectorAll(".chapter h4 span");
      
      // 处理每个分组
      for (let i = 0; i < chapterGroups.length; i++) {
        let groupName = chapterGroups[i].text.trim();
        let groupChapters = new Map();
        
        let chapterList = document.querySelectorAll(".chapter-list")[i];
        if (chapterList) {
          let lis = chapterList.querySelectorAll("li");
          for (let li of lis) {
            let a = li.querySelector("a");
            let id = a.attributes["href"].split("/").pop().replace(".html", "");
            let title = a.querySelector("span").text.trim();
            groupChapters.set(id, title);
          }
          
          groupChapters = new Map([...groupChapters].sort((a, b) => a[0] - b[0]));
          
          chaptersMap.set(groupName, groupChapters);
        }
      }
      
      let chapters;
      if (this.isAppVersionAfter && this.isAppVersionAfter("1.3.0")) {
        chapters = chaptersMap;
      } else {
        chapters = new Map();
        for (let [_, groupChapters] of chaptersMap) {
          for (let [id, title] of groupChapters) {
            chapters.set(id, title);
          }
        }
        chapters = new Map([...chapters].sort((a, b) => a[0] - b[0]));
      }

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

      let imgDomain = `https://us.hamreus.com`;
      let images = [];
      for (let f of infos.files) {
        let imgUrl =
          imgDomain + infos.path + f + `?e=${infos.sl.e}&m=${infos.sl.m}`;
        images.push(imgUrl);
      }
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
    
    /**
     * [Optional] load comments
     *
     * Since app version 1.0.6, rich text is supported in comments.
     * Following html tags are supported: ['a', 'b', 'i', 'u', 's', 'br', 'span', 'img'].
     * span tag supports style attribute, but only support font-weight, font-style, text-decoration.
     * All images will be placed at the end of the comment.
     * Auto link detection is enabled, but only http/https links are supported.
     * @param comicId {string}
     * @param subId {string?} - ComicDetails.subId
     * @param page {number}
     * @param replyTo {string?} - commentId to reply, not null when reply to a comment
     * @returns {Promise<{comments: Comment[], maxPage: number?}>}
     */
    loadComments: async (comicId, subId, page, replyTo) => {
      if(replyTo){
        page = replyTo.split('//')[1]; 
        replyTo = replyTo.split('//')[0]; 
      }

      let url = `${this.baseUrl}/tools/submit_ajax.ashx?action=comment_list&book_id=${comicId}&page_index=${page}`;

      let headers = {
        accept: "application/json, text/javascript, */*; q=0.01",
        "accept-language": "zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6",
        "cache-control": "no-cache",
        pragma: "no-cache",
        "sec-ch-ua": '"Microsoft Edge";v="137", "Chromium";v="137", "Not/A)Brand";v="24"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"Windows"',
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-origin",
        "x-requested-with": "XMLHttpRequest",
        Referer: `${this.baseUrl}/comic/${comicId}/`,
        "Referrer-Policy": "strict-origin-when-cross-origin",
      };

      let res = await Network.get(url, headers);

      if (res.status !== 200) {
        throw `获取评论失败，状态码: ${res.status}`;
      }

      let data = JSON.parse(res.body);

      const replyChains = new Map(); 
      const isSubReply = new Set(); 
      const replyToMap = new Map(); 
      
      if (data.commentIds && data.commentIds.length > 0) {
        for (let commentIdString of data.commentIds) {
          const commentIds = commentIdString.split(',');
          if (commentIds.length > 1) {
            const mainCommentId = commentIds[commentIds.length - 1];
      
            if (!replyChains.has(mainCommentId)) {
              replyChains.set(mainCommentId, []);
            }
            
            for (let i = 0; i < commentIds.length - 1; i++) {
              const replyId = commentIds[i];
              isSubReply.add(replyId); // 标记为子回复
              
              if (!replyChains.get(mainCommentId).includes(replyId)) {
                replyChains.get(mainCommentId).push(replyId);
              }
              
              const targetId = (i === 0) ? mainCommentId : commentIds[i + 1];
              replyToMap.set(replyId, targetId);
            }
          }
        }
      }
      
      const commentList = [];
      
      if (data.comments) {
        if (replyTo) {
          const replies = [...(replyChains.get(replyTo) || [])].reverse();
          
          for (let replyId of replies) {
            const comment = data.comments[replyId];
            if (comment) {
              const directReplyToId = replyToMap.get(replyId);
              let replyUserName = "";
              if (directReplyToId && directReplyToId !== replyTo && data.comments[directReplyToId]) {
                replyUserName = data.comments[directReplyToId].user_name || "匿名用户";
              }
              
              commentList.push(new Comment({
                id: `${comment.id}//${page}`,
                userName: replyUserName ? 
                  `${comment.user_name || "匿名用户"} ☞ ${replyUserName}` : 
                  comment.user_name || "匿名用户",
                avatar: comment.avatar ? `https:${comment.avatar}` : "https://cf.mhgui.com/images/default.png",
                content: comment.content ? comment.content : "已隐藏评论",
                time: comment.add_time,
                replyCount: 0, // 回复的回复暂不支持
              }));
            }
          }
        } else {
          const mainComments = [];
          for (const [id, comment] of Object.entries(data.comments)) {
            if (!isSubReply.has(id)) {
              const replyCount = replyChains.has(id) ? replyChains.get(id).length : (comment.reply_count || 0);
              mainComments.push(new Comment({
                id: `${comment.id}//${page}`,
                userName: comment.user_name || "匿名用户", 
                avatar: comment.avatar ? `https:${comment.avatar}` : "https://cf.mhgui.com/images/default.png",
                content: comment.content ? comment.content : "已隐藏评论",
                time: comment.add_time,
                replyCount: replyCount,
              }));
            }
          }
          commentList.push(...mainComments.reverse());
        }
      }
      
      return {
        comments: commentList,
        maxPage: replyTo ? 1 : (Math.ceil(data.total / 10) || 1)
      };
    },

    sendComment: async (comicId, subId, content, replyTo) => {
      let mhg_cookie = this.loadData("mhg_cookie");
      if (!mhg_cookie) {
          throw "请先登录漫画柜账号";
      }
      let url = `${this.baseUrl}/tools/submit_ajax.ashx?action=comment_add`;

      let headers = {
        accept: "application/json, text/javascript, */*; q=0.01",
        "accept-language": "zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6",
        "cache-control": "no-cache",
        pragma: "no-cache",
        "sec-ch-ua": '"Microsoft Edge";v="137", "Chromium";v="137", "Not/A)Brand";v="24"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"Windows"',
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-origin",
        "x-requested-with": "XMLHttpRequest",
        Referer: `${this.baseUrl}/comic/${comicId}/`,
        "Referrer-Policy": "strict-origin-when-cross-origin", 
        cookie: mhg_cookie,
        dnt:1,
        origin: 'https://www.manhuagui.com',
        'content-type': 'application/x-www-form-urlencoded; charset=UTF-8'
      };

      let bodyParams = ''
      bodyParams += `book_id=${comicId}&`;
      // double-encode to match site submission behaviour
      bodyParams += `txtContent=${encodeURIComponent(encodeURIComponent(content))}&`;
      if (replyTo) {
          bodyParams += `to_comment_id=${replyTo.split('//')[0]}`;
      }else{
          bodyParams += `to_comment_id=0`;
      }

      let res = await Network.post(url, headers, bodyParams);

      if (res.status === 401) {
          error(`Login expired`);
          return;
      }
      if (res.status !== 200) {
        throw `发送评论失败，状态码: ${res.status}`;
      }


      // 获取post请求的响应的json
      let data = JSON.parse(res.body);
      if (data.status !== 1) {
        throw `发送评论失败: ${data.msg}`;
      }

      return 'ok';
    },
    
    /**
     * 处理标签点击事件
     * @param namespace {string} 标签命名空间
     * @param tag {string} 标签名称
     * @returns {Object} 跳转操作
     */
    onClickTag: (namespace, tag) => {
      // 点击类型标签时，跳转到对应的分类页面
      if (namespace === "类型") {
        // 根据标签查找对应的参数值
        const categoryPart = this.category.parts.find(part => part.name === "类型");
        if (categoryPart) {
          const index = categoryPart.categories.findIndex(cat => cat === tag);
          if (index !== -1) {
            const param = categoryPart.categoryParams[index];
            return {
              action: 'category',
              keyword: tag,
              param: param
            };
          }
        }
      }
      if (namespace === "作者") {
        return {
          action: 'search',
          keyword: tag,
          param: tag
        };
      }
      
      // 默认返回null，表示不处理此类标签点击
      return null;
    },
  };
  /// favorites related
  favorites = {
    multiFolder: false,
    /**
     * load comics of the favorites
     * @param page {number} - page number
     * @param folder {string?} - folder name, unused for now
     * @returns {Promise<{comics: Comic[], maxPage: number}>}
     */
    loadComics: async (page, folder) => {
        let mhg_cookie = this.loadData("mhg_cookie");
        if (!mhg_cookie) {
            throw "请先登录漫画柜账号";
        }
        let url = `${this.baseUrl}/user/book/shelf/${page}`;
        let document = await this.getHtml(url);
        let comicElements = document.querySelectorAll('.dy_content_li');
        let comics = [];
        for (let el of comicElements) {
            let a = el.querySelector('.dy_img a');
            if (!a) continue;
            let href = a.attributes['href'];
            let id = href.split('/')[2];
            let img = a.querySelector('img');
            let cover = img ? (img.attributes['src'] || img.attributes['data-src']) : '';
            if (cover && !cover.startsWith('http')) cover = 'https:' + cover;
            // dy_r 解析详细信息
            let dy_r = el.querySelector('.dy_r');
            let title = '';
            let updateTitle = '';
            let updateChapter = '';
            let updateDate = '';
            let lastReadChapter = '';
            let lastReadDate = '';
            if (dy_r) {
                // 标题
                let h3 = dy_r.querySelector('h3');
                if (h3) {
                    let h3a = h3.querySelector('a');
                    if (h3a) title = h3a.text.trim();
                }
                // 更新内容
                let pList = dy_r.querySelectorAll('p');
                if (pList.length > 0) {
                    let updateP = pList[0];
                    let updateEm = updateP.querySelectorAll('em');
                    if (updateEm.length > 0) {
                        let chapterA = updateEm[0].querySelector('a');
                        if (chapterA) updateChapter = chapterA.text.trim();
                        updateDate = updateEm.length > 1 ? updateEm[1].text.trim() : '';
                    }
                    updateTitle = updateP.text.replace(/更新内容：/, '').trim();
                }
                // 最近阅读
                if (pList.length > 1) {
                    let readP = pList[1];
                    let readEm = readP.querySelectorAll('em');
                    if (readEm.length > 0) {
                        let lastA = readEm[0].querySelector('a');
                        if (lastA) lastReadChapter = lastA.text.trim();
                        lastReadDate = readEm.length > 1 ? readEm[1].text.trim() : '';
                    }
                }
            }
            // 兼容无dy_r时的title
            if (!title) {
                if (a.attributes['title']) {
                    title = a.attributes['title'];
                } else {
                    title = a.text.trim();
                }
            }
            // tags 信息
            let tags = [];
            if (updateChapter) tags.push(`更新：${updateChapter}`);
            if (updateDate) tags.push(`更新日期：${updateDate}`);
            if (lastReadChapter) tags.push(`最近阅读：${lastReadChapter}`);
            if (lastReadDate) tags.push(`最近阅读时间：${lastReadDate}`);
            comics.push(new Comic({
                id,
                title,
                subTitle: updateChapter || updateTitle || '',
                cover,
                description: '',
                tags,
            }));
        }
        // 页码信息
        let maxPage = 1;
        // 优先用“共N记录”计算
        let recordInfo = document.querySelector('.flickr.right span');
        if (recordInfo) {
            let match = recordInfo.text.match(/共(\d+)记录/);
            if (match) {
                let total = parseInt(match[1], 10);
                maxPage = Math.ceil(total / 20);
            }
        } else {
            // 兼容旧逻辑
            let pageBtns = document.querySelectorAll('.page-btns a');
            for (let btn of pageBtns) {
                let num = parseInt(btn.text.trim(), 10);
                if (!isNaN(num) && num > maxPage) maxPage = num;
            }
        }
        return {
            comics,
            maxPage
        };
    },
    addOrDelFavorite: async (comicId, folderId, isAdding, favoriteId) => {
        if (!isAdding) {
            throw '暂不支持取消收藏';
        }
        let mhg_cookie = this.loadData("mhg_cookie");
        if (!mhg_cookie) {
            throw "请先登录漫画柜账号";
        }
        let url = `${this.baseUrl}/tools/submit_ajax.ashx?action=user_book_shelf_add`;
        let headers = {
            'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'x-requested-with': 'XMLHttpRequest',
            'referer': `${this.baseUrl}/comic/${comicId}/`,
            cookie: mhg_cookie,
        };
        let body = `book_id=${encodeURIComponent(comicId)}`;
        let res = await Network.post(url, headers, body);
        if (res.status !== 200) {
            throw `添加收藏失败，状态码: ${res.status}`;
        }
        let data = {};
        try {
            data = JSON.parse(res.body);
        } catch (e) {}
        if (data.state !== true && data.state !== 1) {
            throw data.msg || '添加收藏失败';
        }
        return 'ok';
    },
  };
}
