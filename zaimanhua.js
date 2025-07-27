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
   * parse json content
   * @param e object
   * @returns {Comic}
   */
  parseJsonComic(e) {
    let id = e.comic_py;
    if (!id) {
      id = id.comicPy;
    }
    let title = e?.name;
    if (!title) {
      title = e?.title;
    }
    return new Comic({
      id: id.toString(),
      title: title.toString(),
      subtitle: e?.authors,
      tags: e?.types?.split("/"),
      cover: e?.cover,
      description: e?.last_update_chapter_name.toString(),
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
        // https://manhua.zaimanhua.com/api/v1/comic1/recommend/list?
        // channel=pc&app_name=zmh&version=1.0.0&timestamp=1753547675981&uid=0
        let api = `${this.baseUrl}/api/v1/comic1/recommend/list`;
        let params = {
          channel: "pc",
          app_name: "zmh",
          version: "1.0.0",
          timestamp: Date.now(),
          uid: 0,
        };
        let params_str = Object.keys(params)
          .map((key) => `${key}=${params[key]}`)
          .join("&");
        let url = `${api}?${params_str}`;
        const json = await this.fetchJson(url);
        let data = json.list;
        data.shift(); // 去掉第一个
        data.pop(); // 去掉最后一个
        data.map((arr) => {
          let title = arr.name;
          let comic_list = arr.list.map((item) => this.parseJsonComic(item));
          result[title] = comic_list;
        });

        log("error", "再看漫画", result);
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

      // 修复时间戳转换问题
      let lastUpdateTime = new Date(info.lastUpdateTime * 1000);
      let updateTime = `${lastUpdateTime.getFullYear()}-${
        lastUpdateTime.getMonth() + 1
      }-${lastUpdateTime.getDate()}`;

      let description = info.description;
      let cover = info.cover;

      let chapters = new Map();
      info.chapterList[0].data.forEach((e) => {
        chapters.set(e.chapter_id.toString(), e.chapter_title);
      });
      //   chapters 按照key排序
      let chaptersSorted = new Map([...chapters].sort((a, b) => a[0] - b[0]));

      // 获取推荐漫画
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
      let recommend = json2.data.comicList.map((e) => this.parseJsonComic(e));
      let tags = {
        状态: [info.status],
        类型: [info.readerGroup, ...info.types.split("/")],
        点击: [info.hitNumStr.toString()],
        订阅: [info.subNumStr],
      };

      return new ComicDetails({
        title,
        subtitle: author,
        cover,
        description,
        tags,
        chapters: chaptersSorted,
        recommend,
        updateTime,
      });
    },

    /**
     * load images of a chapter
     * @param comicId {string}
     * @param epId {string?}
     * @returns {Promise<{images: string[]}>}
     */
    loadEp: async (comicId, epId) => {
      const api_ = `${this.domain}/api/v1/comic1/comic/detail`;
      //   log("error", "再漫画", id);
      let params_ = {
        channel: "pc",
        app_name: "zmh",
        version: "1.0.0",
        timestamp: Date.now(),
        uid: 0,
        comic_py: comicId,
      };
      let params_str_ = Object.keys(params_)
        .map((key) => `${key}=${params_[key]}`)
        .join("&");
      let url_ = `${api_}?${params_str_}`;
      const json_ = await this.fetchJson(url_);
      const info_ = json_.comicInfo;
      const comic_id = info_.id;

      const api = `${this.baseUrl}/api/v1/comic1/chapter/detail`;
      // comic_id=18114&chapter_id=36227
      let params = {
        channel: "pc",
        app_name: "zmh",
        version: "1.0.0",
        timestamp: Date.now(),
        uid: 0,
        comic_id: comic_id,
        chapter_id: epId,
      };
      let params_str = Object.keys(params)
        .map((key) => `${key}=${params[key]}`)
        .join("&");
      let url = `${api}?${params_str}`;
      const json = await this.fetchJson(url);
      const info = json.chapterInfo;
      return {
        images: info.page_url,
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
