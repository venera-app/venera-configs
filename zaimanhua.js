/** @type {import('./_venera_.js')} */
class ZaiManHua extends ComicSource {
  // Note: The fields which are marked as [Optional] should be removed if not used

  // name of the source
  name = "再漫画";

  // unique id of the source
  key = "zaimanhua";

  version = "1.0.0";

  minAppVersion = "1.4.0";

  // update url
  url = "https://git.nyne.dev/nyne/venera-configs/raw/branch/main/zaimanhua.js";

  /**
   * fetch html content
   * @param url {string}
   * @param headers {object?}
   * @returns {Promise<{document:HtmlDocument}>}
   */
  async fetchHtml(url, headers = {}) {
    let res = await Network.get(url, headers);
    if (res.status !== 200) {
      throw "Invalid status code: " + res.status;
    }
    let document = new HtmlDocument(res.body);

    return document;
  }

  /**
   * fetch json content
   * @param url {string}
   * @param headers {object?}
   * @returns {Promise<{data:object}>}
   */
  async fetchJson(url, headers = {}) {
    let res = await Network.get(url, headers);
    return JSON.parse(res.body).data;
  }

  /**
   * parse comic from html element
   * @param comic {HtmlElement}
   * @returns {Comic}
   */
  parseCoverComic(comic) {
    let title = comic.querySelector("p > a").text.trim();
    let url = comic.querySelector("p > a").attributes["href"];
    let id = url.split("/").pop().split(".")[0];
    let cover = comic.querySelector("img").attributes["src"];
    let subtitle = comic.querySelector(".auth")?.text.trim();
    if (!subtitle) {
      subtitle = comic
        .querySelector(".con_author")
        ?.text.replace("作者：", "")
        .trim();
    }
    let description = comic.querySelector(".tip")?.text.trim();

    return new Comic({ title, id, subtitle, url, cover, description });
  }

  /**
   * parse json content
   * @param e object
   * @returns {Comic}
   */
  parseJsonComic(e) {
    let cover = e.cover;
    let title = e.name;
    let id = e.comic_py;

    let subtitle = e.authors;

    let classify = e.types.split("/");
    let description = e.last_update_chapter_name;

    return new Comic({
      title,
      id,
      subtitle,
      tags: classify,
      cover,
      description,
    });
  }

  /**
   * [Optional] init function
   */
  init() {
    this.domain = "https://www.zaimanhua.com";
    this.imgBase = "https://images.zaimanhua.com";
    this.baseUrl = "https://manhua.zaimanhua.com";
  }

  // explore page list
  explore = [
    {
      // title of the page.
      // title is used to identify the page, it should be unique
      title: this.name,

      /// TODO multiPartPage
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
        let result = {};
        let document = await this.fetchHtml(this.domain);
        // 推荐
        let recommend_title = document.querySelector(
          ".new_recommend_l h2"
        )?.text;
        let recommend_comics = document
          .querySelectorAll(".new_recommend_l li")
          .map(this.parseCoverComic);
        result[recommend_title] = recommend_comics;
        // 更新
        let update_title = document.querySelector(".new_update_l h2")?.text;
        let update_comics = document
          .querySelectorAll(".new_update_l li")
          .map(this.parseCoverComic);
        result[update_title] = update_comics;
        // 少男漫画
        // 少女漫画
        // 冒险，搞笑，奇幻
        return result;
      },
    },
  ];

  // categories
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
          "冒险",
          "搞笑",
          "格斗",
          "科幻",
          "爱情",
          "侦探",
          "竞技",
          "魔法",
          "校园",
          "百合",
          "耽美",
          "历史",
          "战争",
          "宅系",
          "治愈",
          "仙侠",
          "武侠",
          "职场",
          "神鬼",
          "奇幻",
          "生活",
          "其他",
        ],
        itemType: "category",
        categoryParams: [
          "0",
          "1",
          "2",
          "3",
          "4",
          "5",
          "6",
          "7",
          "8",
          "9",
          "11",
          "13",
          "14",
          "15",
          "16",
          "17",
          "18",
          "19",
          "20",
          "21",
          "22",
          "23",
          "24",
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
      let fil = `${this.baseUrl}/api/v1/comic1/filter`;
      let params = {
        timestamp: Date.now(),
        sortType: 0,
        page: page,
        size: 20,
        status: options[1],
        audience: options[0],
        theme: param,
        cate: options[2],
      };
      //   拼接url
      let params_str = Object.keys(params)
        .map((key) => `${key}=${params[key]}`)
        .join("&");
      //   log("error", "再漫画", params_str);
      let url = `${fil}?${params_str}&firstLetter`;
      //   log("error", "再漫画", url);

      const json = await this.fetchJson(url);
      let comics = json.comicList.map((e) => this.parseJsonComic(e));
      let maxPage = Math.ceil(json.totalNum / params.size);
      //   log("error", "再漫画", comics);
      return {
        comics,
        maxPage,
      };
    },
    // provide options for category comic loading
    optionList: [
      {
        options: ["0-全部", "3262-少年", "3263-少女", "3264-青年"],
      },
      {
        options: ["0-全部", "1-故事漫画", "2-四格多格"],
      },
      {
        options: ["0-全部", "1-连载", "2-完结"],
      },
    ],
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
      let url = `${this.baseUrl}/app/v1/search/index?keyword=${keyword}&source=0&page=${page}&size=20`;
      const json = await this.fetchJson(url);
      let comics = json.comicList.map((e) => this.parseJsonComic(e));
      let maxPage = Math.ceil(json.totalNum / params.size);
      //   log("error", "再漫画", comics);
      return {
        comics,
        maxPage,
      };
    },

    // provide options for search
    optionList: [],
  };

  /// single comic related
  comic = {
    /**
     * load comic info
     * @param id {string}
     * @returns {Promise<ComicDetails>}
     */
    loadInfo: async (id) => {
      const api = `${this.domain}/api/v1/comic1/comic/detail`;
      let params = {
        channel: "pc",
        app_name: "zmh",
        version: "1.0.0",
        timestamp: Date.now(),
        uid: 0,
        comic_py: id,
      };
      let params_str = Object.keys(params)
        .map((key) => `${key}=${params[key]}`)
        .join("&");
      let url = `${api}?${params_str}`;
      const json = await this.fetchJson(url);
      const info = json.comicInfo;
      const comic_id = info.id;
      let title = info.title;
      let author = info.authorInfo.authorName;
      let lastUpdateTime = new Date(info.lastUpdateTime);
      let updateTime = `${lastUpdateTime.getFullYear()}-${
        lastUpdateTime.getMonth() + 1
      }-${lastUpdateTime.getDate()}`;
      let description = info.description;
      let cover = info.cover;

      let chapters = new Map();
      info.chapterList.data.forEach((e) => {
        chapters.set(e.chapter_id, e.chapter_title);
      });

      // &uid=0&comic_id=69500
      const api2 = `${this.baseUrl}/api/v1/comic1/comic/same_list`;
      let params2 = {
        channel: "pc",
        app_name: "zmh",
        version: "1.0.0",
        timestamp: Date.now(),
        uid: 0,
        comic_id: comic_id,
      };
      let params2_str = Object.keys(params2)
        .map((key) => `${key}=${params2[key]}`)
        .join("&");
      let url2 = `${api2}?${params2_str}`;
      const json2 = await this.fetchJson(url2);
      let recommend = json2.comicList.map((e) => this.parseJsonComic(e));
      return new ComicDetails({
        title,
        subtitle: author,
        cover,
        description,
        tags: {
          状态: [info.status],
          类型: [info.readerGroup, ...info.types.split("/")],
        },
        chapters,
        recommend,
        updateTime,
      });
    },
    /**
     * [Optional] load thumbnails of a comic
     *
     * To render a part of an image as thumbnail, return `${url}@x=${start}-${end}&y=${start}-${end}`
     * - If width is not provided, use full width
     * - If height is not provided, use full height
     * @param id {string}
     * @param next {string?} - next page token, null for first page
     * @returns {Promise<{thumbnails: string[], next: string?}>} - `next` is next page token, null for no more
     */
    loadThumbnails: async (id, next) => {
      /*
            ```
            let data = JSON.parse((await Network.get('...')).body)

            return {
                thumbnails: data.list,
                next: next,
            }
            ```
            */
    },

    /**
     * load images of a chapter
     * @param comicId {string}
     * @param epId {string?}
     * @returns {Promise<{images: string[]}>}
     */
    loadEp: async (comicId, epId) => {
      /*
            ```
            return {
                // string[]
                images: images
            }
            ```
            */
    },
    /**
     * [Optional] provide configs for an image loading
     * @param url
     * @param comicId
     * @param epId
     * @returns {ImageLoadingConfig | Promise<ImageLoadingConfig>}
     */
    onImageLoad: (url, comicId, epId) => {
      return {};
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
      return {};
    },
  };
}
