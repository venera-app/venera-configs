/** @type {import('./_venera_.js')} */

function getValidatorCookie(htmlString) {
  // 正则表达式匹配 document.cookie 设置语句
  const cookieRegex = /document\.cookie\s*=\s*"([^"]+)"/;
  const match = htmlString.match(cookieRegex);

  if (!match) {
    return null; // 没有找到 cookie 设置语句
  }

  const cookieSetting = match[1];
  const cookies = cookieSetting.split(';');
  if (cookies.length === 0) {
    return null
  }
  const nameValuePart = cookies[0].trim();
  const equalsIndex = nameValuePart.indexOf('=');

  const name = nameValuePart.substring(0, equalsIndex);
  const value = nameValuePart.substring(equalsIndex + 1);

  return new Cookie({ name, value, domain: "www.ikmmh.com" })
}

function needPassValidator(htmlString) {
  var cookie = getValidatorCookie(htmlString)
  if (cookie != null) {
    Network.setCookies(Ikm.baseUrl, [cookie])
    return true
  }
  return false
}

class Ikm extends ComicSource {
  // 基础配置
  name = "爱看漫";
  key = "ikmmh";
  version = "1.0.5";
  minAppVersion = "1.0.0";
  url = "https://cdn.jsdelivr.net/gh/venera-app/venera-configs@main/ikmmh.js";
  // 常量定义
  static baseUrl = "https://www.ikmmh.com";
  static Mobile_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1 Edg/140.0.0.0";
  static webHeaders = {
    "User-Agent": Ikm.Mobile_UA,
    "Accept":
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
  };
  static jsonHead = {
    "User-Agent": Ikm.Mobile_UA,
    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    "Accept": "application/json, text/javascript, */*; q=0.01",
    "Accept-Encoding": "gzip",
    "X-Requested-With": "XMLHttpRequest",
  };
  // 统一缩略图加载配置
  static thumbConfig = (url) => ({
    headers: {
      ...Ikm.webHeaders,
      "referer": Ikm.baseUrl,
    },
  });
  // 账号系统
  account = {
    login: async (account, pwd) => {
      try {
        let res = await Network.post(
          `${Ikm.baseUrl}/api/user/userarr/login`,
          Ikm.jsonHead,
          `user=${account}&pass=${pwd}`
        );
        if (res.status !== 200)
          throw new Error(`登录失败，状态码：${res.status}`);

        if (needPassValidator(res.body)) {
          // rePost
          res = await Network.post(
            `${Ikm.baseUrl}/api/user/userarr/login`,
            Ikm.jsonHead,
            `user=${account}&pass=${pwd}`
          );
        }

        let data = JSON.parse(res.body);
        if (data.code !== 0)
          throw new Error(data.msg || "登录异常");

        return "ok";
      } catch (err) {
        throw new Error(`登录失败：${err.message}`);
      }
    },
    logout: () => Network.deleteCookies("www.ikmmh.com"),
    registerWebsite: `${Ikm.baseUrl}/user/register/`,
  };
  // 探索页面
  explore = [
    {
      title: this.name,
      type: "singlePageWithMultiPart",
      load: async () => {
        try {
          let res = await Network.get(`${Ikm.baseUrl}/`, Ikm.webHeaders);
          if (res.status !== 200)
            throw new Error(`加载探索页面失败，状态码：${res.status}`);

          if (needPassValidator(res.body)) {
            // rePost
            res = await Network.get(`${Ikm.baseUrl}/`, Ikm.webHeaders);
          }

          let document = new HtmlDocument(res.body);
          let parseComic = (e) => {
            let title = e.querySelector("div.title").text.split("~")[0];
            let cover = e.querySelector("div.thumb_img").attributes["data-src"];
            let link = `${Ikm.baseUrl}${
              e.querySelector("a").attributes["href"]
            }`;
            return {
              title,
              cover,
              id: link,
            };
          };
          return {
            "本周推荐": document
              .querySelectorAll("div.module-good-fir > div.item")
              .map(parseComic),
            "今日更新": document
              .querySelectorAll("div.module-day-fir > div.item")
              .map(parseComic),
          };
        } catch (err) {
          throw new Error(`探索页面加载失败：${err.message}`);
        }
      },
      onThumbnailLoad: Ikm.thumbConfig,
    },
  ];
  // 分类页面
  category = {
    title: "爱看漫",
    parts: [
      {
        name: "更新",
        type: "fixed",
        categories: [
          "星期一",
          "星期二",
          "星期三",
          "星期四",
          "星期五",
          "星期六",
          "星期日",
        ],
        itemType: "category",
        categoryParams: ["1", "2", "3", "4", "5", "6", "7"],
      },
      {
        name: "分类",
        // fixed 或者 random
        // random用于分类数量相当多时, 随机显示其中一部分
        type: "fixed",
        // 如果类型为random, 需要提供此字段, 表示同时显示的数量
        // randomNumber: 5,
        categories: [
          "全部",
          "长条",
          "大女主",
          "百合",
          "耽美",
          "纯爱",
          "後宫",
          "韩漫",
          "奇幻",
          "轻小说",
          "生活",
          "悬疑",
          "格斗",
          "搞笑",
          "伪娘",
          "竞技",
          "职场",
          "萌系",
          "冒险",
          "治愈",
          "都市",
          "霸总",
          "神鬼",
          "侦探",
          "爱情",
          "古风",
          "欢乐向",
          "科幻",
          "穿越",
          "性转换",
          "校园",
          "美食",
          "悬疑",
          "剧情",
          "热血",
          "节操",
          "励志",
          "异世界",
          "历史",
          "战争",
          "恐怖",
          "霸总"
        ],
        // category或者search
        // 如果为category, 点击后将进入分类漫画页面, 使用下方的`categoryComics`加载漫画
        // 如果为search, 将进入搜索页面
        itemType: "category",
      }
    ],
    enableRankingPage: false,
  };
  // 分类漫画加载
  categoryComics = {
    load: async (category, param, options, page) => {
      try {
        let res;
        if (param) {
          res = await Network.get(
            `${Ikm.baseUrl}/update/${param}.html`,
            Ikm.webHeaders
          );
          if (res.status !== 200)
            throw new Error(`分类请求失败，状态码：${res.status}`);

          if (needPassValidator(res.body)) {
            // rePost
            res = await Network.get(
              `${Ikm.baseUrl}/update/${param}.html`,
              Ikm.webHeaders
            );
          }

          let document = new HtmlDocument(res.body);
          let comics = document.querySelectorAll("li.comic-item").map((e) => ({
            title: e.querySelector("p.title").text.split("~")[0],
            cover: e.querySelector("img").attributes["src"],
            id: `${Ikm.baseUrl}${e.querySelector("a").attributes["href"]}`,
            subTitle: e.querySelector("span.chapter").text,
          }));
          return {
            comics,
            maxPage: 1
          };
        } else {
          res = await Network.post(
            `${Ikm.baseUrl}/api/comic/index/lists`,
            Ikm.jsonHead,
            `area=${options[1]}&tags=${encodeURIComponent(category)}&full=${
              options[0]
            }&page=${page}`
          );

          if (needPassValidator(res.body)) {
            // rePost
            res = await Network.post(
              `${Ikm.baseUrl}/api/comic/index/lists`,
              Ikm.jsonHead,
              `area=${options[1]}&tags=${encodeURIComponent(category)}&full=${options[0]
              }&page=${page}`
            );
          }

          let resData = JSON.parse(res.body);
          return {
            comics: resData.data.map((e) => ({
              id: `${Ikm.baseUrl}${e.info_url}`,
              title: e.name.split("~")[0],
              subTitle: e.author,
              cover: e.cover,
              tags: e.tags,
              description: e.lastchapter,
            })),
            maxPage: resData.end || 1,
          };
        }
      } catch (err) {
        throw new Error(`分类加载失败：${err.message}`);
      }
    },
    onThumbnailLoad: Ikm.thumbConfig,
    optionList: [
      {
        // 对于单个选项, 使用-分割, 左侧为用于数据加载的值, 即传给load函数的options参数; 右侧为显示给用户的文本

        options: ["3-全部", "4-连载中", "1-已完结"],
        notShowWhen: [
          "星期一",
          "星期二",
          "星期三",
          "星期四",
          "星期五",
          "星期六",
          "星期日",
        ],
        showWhen: null,
      },
      {
        options: [
          "9-全部",
          "1-日漫",
          "2-港台",
          "3-美漫",
          "4-国漫",
          "5-韩漫",
          "6-未分类",
        ],
        notShowWhen: [
          "星期一",
          "星期二",
          "星期三",
          "星期四",
          "星期五",
          "星期六",
          "星期日",
        ],
        showWhen: null,
      },
    ],
  };
  // 搜索功能
  search = {
    load: async (keyword, options, page) => {
      try {
        let res = await Network.get(
          `${Ikm.baseUrl}/search?searchkey=${encodeURIComponent(keyword)}`,
          Ikm.webHeaders
        );

        if (needPassValidator(res.body)) {
          // rePost
          res = await Network.get(
            `${Ikm.baseUrl}/search?searchkey=${encodeURIComponent(keyword)}`,
            Ikm.webHeaders
          );
        }

        let document = new HtmlDocument(res.body);
        return {
          comics: document.querySelectorAll("li.comic-item").map((e) => ({
            title: e.querySelector("p.title").text.split("~")[0],
            cover: e.querySelector("img").attributes["src"],
            id: `${Ikm.baseUrl}${e.querySelector("a").attributes["href"]}`,
            subTitle: e.querySelector("span.chapter").text,
          })),
          maxPage: 1,
        };
      } catch (err) {
        throw new Error(`搜索失败：${err.message}`);
      }
    },
    onThumbnailLoad: Ikm.thumbConfig,
    optionList: [],
  };
  // 收藏功能
  favorites = {
    multiFolder: false,
    addOrDelFavorite: async (comicId, folderId, isAdding) => {
      try {
        let id = comicId.match(/\d+/)[0];
        if (isAdding) {
          // 获取漫画信息
          let infoRes = await Network.get(comicId, Ikm.webHeaders);

          if (needPassValidator(infoRes.body)) {
            // rePost
            infoRes = await Network.get(comicId, Ikm.webHeaders);
          }

          let name = new HtmlDocument(infoRes.body).querySelector(
            "meta[property='og:title']"
          ).attributes["content"];
          // 添加收藏
          let res = await Network.post(
            `${Ikm.baseUrl}/api/user/bookcase/add`,
            Ikm.jsonHead,
            `articleid=${id}&articlename=${encodeURIComponent(name)}`
          );
          let data = JSON.parse(res.body);
          if (data.code !== "0") throw new Error(data.msg || "收藏失败");
          return "ok";
        } else {
          // 删除收藏
          let res = await Network.post(
            `${Ikm.baseUrl}/api/user/bookcase/del`,
            Ikm.jsonHead,
            `articleid=${id}`
          );

          if (needPassValidator(res.body)) {
            // rePost
            res = await Network.post(
              `${Ikm.baseUrl}/api/user/bookcase/del`,
              Ikm.jsonHead,
              `articleid=${id}`
            );
          }

          let data = JSON.parse(res.body);
          if (data.code !== "0") throw new Error(data.msg || "取消收藏失败");
          return "ok";
        }
      } catch (err) {
        throw new Error(`收藏操作失败：${err.message}`);
      }
    },
    //加载收藏
    loadComics: async (page, folder) => {
      let res = await Network.get(
        `${Ikm.baseUrl}/user/bookcase`,
        Ikm.webHeaders
      );
      if (res.status !== 200) {
        throw "加载收藏失败：" + res.status;
      }

      if (needPassValidator(res.body)) {
        // rePost
        res = await Network.get(
          `${Ikm.baseUrl}/user/bookcase`,
          Ikm.webHeaders
        );
      }

      let document = new HtmlDocument(res.body);
      return {
        comics: document.querySelectorAll("div.bookrack-item").map((e) => ({
          title: e.querySelector("h3").text.split("~")[0],
          subTitle: e.querySelector("p.desc").text,
          cover: e.querySelector("img").attributes["src"],
          id: `${Ikm.baseUrl}/book/${e.attributes["data-id"]}/`,
        })),
        maxPage: 1,
      };
    },
    onThumbnailLoad: Ikm.thumbConfig,
  };
  // 漫画详情
  comic = {
    loadInfo: async (id) => {
      // 加载收藏页并判断是否收藏
      let isFavorite = false;
      try {
        let favorites = await this.favorites.loadComics(1, null);
        isFavorite = favorites.comics.some((comic) => comic.id === id);
      } catch (error) {
        console.error("加载收藏页失败:", error);
      }
      let res = await Network.get(id, Ikm.webHeaders);

      if (needPassValidator(res.body)) {
        // rePost
        res = await Network.get(id, Ikm.webHeaders);
      }

      let document = new HtmlDocument(res.body);
      let comicId = id.match(/\d+/)[0];
      // 获取章节数据
      let epRes = await Network.get(
        `${Ikm.baseUrl}/api/comic/zyz/chapterlink?id=${comicId}`,
        {
          ...Ikm.jsonHead,
          "referer": id,
        }
      );
      let epData = JSON.parse(epRes.body);
      let eps = new Map();
      if (epData.data && epData.data.length > 0 && epData.data[0].list) {
        epData.data[0].list.forEach((e) => {
          let title = e.name;
          let id = `${Ikm.baseUrl}${e.url}`;
          eps.set(id, title);
        });
      } else {
        throw new Error(`章节数据格式异常`);
      }

      let title = document.querySelector(
        "div.book-hero__detail > div.title"
      ).text;
      let escapedTitle = title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      let thumb =
        document
          .querySelector("div.coverimg")
          .attributes["style"].match(/\((.*?)\)/)?.[1] || "";
      let desc = document
        .querySelector("article.book-container__detail")
        .text.match(
          new RegExp(
            `漫画名：${escapedTitle}(?:(?:[^。]*?(?:简介|漫画简介)\\s*[:：]?\\s*)|(?:[^。]*?))([\\s\\S]+?)\\.\\.\\.。`
          )
        );
      let intro = desc?.[1]?.trim().replace(/\s+/g, " ") || "";

      return {
        title: title.split("~")[0],
        cover: thumb,
        description: intro,
        tags: {
          "作者": [
            document
              .querySelector("div.book-container__author")
              .text.split("作者：")[1],
          ],
          "更新": [document.querySelector("div.update > a > em").text],
          "标签": document
            .querySelectorAll("div.book-hero__detail > div.tags > a")
            .map((e) => e.text.trim())
            .filter((text) => text),
        },
        chapters: eps,
        recommend: document
          .querySelectorAll("div.module-guessu > div.item")
          .map((e) => ({
            title: e.querySelector("div.title").text.split("~")[0],
            cover: e.querySelector("div.thumb_img").attributes["data-src"],
            id: `${Ikm.baseUrl}${e.querySelector("a").attributes["href"]}`,
          })),
        isFavorite: isFavorite,
      };
    },
    onThumbnailLoad: Ikm.thumbConfig,
    loadEp: async (comicId, epId) => {
      try {
        let res = await Network.get(epId, Ikm.webHeaders);

        if (needPassValidator(res.body)) {
          // rePost
          res = await Network.get(epId, Ikm.webHeaders);
        }

        let document = new HtmlDocument(res.body);
        return {
          images: document
            .querySelectorAll("img.lazy")
            .map((e) => e.attributes["data-src"]),
        };
      } catch (err) {
        throw new Error(`加载章节失败：${err.message}`);
      }
    },
    onImageLoad: (url, comicId, epId) => {
      return {
        url,
        headers: {
          ...Ikm.webHeaders,
          "referer": epId,
        },
      };
    },
  };
}
