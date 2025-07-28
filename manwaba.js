/** @type {import('./_venera_.js')} */
class ManWaBa extends ComicSource {
  // Note: The fields which are marked as [Optional] should be removed if not used

  // name of the source
  name = "漫蛙";

  // unique id of the source
  key = "manwaba";

  version = "1.0.0";

  minAppVersion = "1.4.0";

  // update url
  url = "https://cdn.jsdelivr.net/gh/venera-app/venera-configs@main/manwaba.js";

  baseUrl = "https://www.manwaba.com";

  init() {
    /**
     * Sends an HTTP request.
     * @param {string} url - The URL to send the request to.
     * @param {Object} headers - The headers to include in the request.
     * @returns {Promise<{status: number, headers: {}, body: string}>} The response from the request.
     */
    this.getJson = async ({ url, headers }) => {
      let res = await Network.get(url, headers);
      if (res.status !== 200) {
        throw `Invalid status code: ${res.status}, body: ${res.body}`;
      }
      let json = JSON.parse(res.body);
      if (json.code !== 200) {
        throw `Invalid response code: ${json.code}, msg: ${json.msg}`;
      }
      return json.data;
    };

    /**
     * Sends a POST request.
     * @param {string} url - The URL to send the request to.
     * @param {Record<string, string>} headers - The headers to include in the request.
     * @param {String} data - The data to send with the request.
     * @returns {Promise<{status: number, headers: {}, body: string}>} The response from the request.
     */
    this.postJson = async ({ url, headers, data }) => {
      // data 转换为 json 字符串,原生
      let res = await Network.post(url, headers, data);
      if (res.status !== 200) {
        throw `Invalid status code: ${res.status}, body: ${res.body}`;
      }
      let json = JSON.parse(res.body);
      if (json.code !== 200) {
        throw `Invalid response code: ${json.code}, msg: ${json.msg}`;
      }
      return json.data;
    };

    /**
     * fetch html from url
     * @param url {string}
     * @param headers {Record<string, string>}
     * @returns {Promise<HtmlDocument>}
     */
    this.fetchHtml = async (url, headers = {}) => {
      let res = await Network.get(url, headers);
      if (res.status !== 200) {
        throw `Invalid status code: ${res.status}, body: ${res.body}`;
      }
      let document = new HtmlDocument(res.body);
      return document;
    };
    /**
     * 参数字典转换为字符串
     * @param dict {Record<string, string>}
     * @returns {string}
     */
    this.dictToQueryString = (dict) => {
      return Object.keys(dict)
        .map((key) => `${key}=${dict[key]}`)
        .join("&");
    };
  }

  // explore page list
  explore = [
    {
      // title of the page.
      // title is used to identify the page, it should be unique
      title: this.name,

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
        let params = {
          page: 1,
          pageSize: 6,
          type: "",
          flag: false,
        };
        const url = `${this.baseUrl}/api/v1/json/home?${this.dictToQueryString(
          params
        )}`;
        const res = await this.getJson({ url });
        let data = {
          热门: res.comicList,
          古风: res.gufengList,
          玄幻: res.xuanhuanList,
          校园: res.xiaoyuanList,
        };
        function parseComic(comic) {
          return new Comic({
            id: comic.id.toString(),
            title: comic.title,
            subTitle: comic.author,
            cover: comic.pic,
            tags: comic.tags.split(","),
          });
        }
        let result = {};
        for (let key in data) {
          result[key] = data[key].map(parseComic);
        }
        return result;
      },
    },
  ];

  // categories
  category = {
    /// title of the category page, used to identify the page, it should be unique
    title: this.name,
    parts: [
      {
        // title of the part
        name: "类型",

        // fixed or random or dynamic
        // if random, need to provide `randomNumber` field, which indicates the number of comics to display at the same time
        // if dynamic, need to provide `loader` field, which indicates the function to load comics
        type: "fixed",

        // Remove this if type is dynamic
        categories: [
          "全部",
          "热血",
          "玄幻",
          "恋爱",
          "冒险",
          "古风",
          "都市",
          "穿越",
          "奇幻",
          "其他",
          "搞笑",
          "少男",
          "战斗",
          "重生",
          "逆袭",
          "爆笑",
          "少年",
          "后宫",
          "系统",
          "BL",
          "韩漫",
          "完整版",
          "19r",
          "台版",
        ],

        itemType: "category",
        categoryParams: [
          "",
          "热血",
          "玄幻",
          "恋爱",
          "冒险",
          "古风",
          "都市",
          "穿越",
          "奇幻",
          "其他",
          "搞笑",
          "少男",
          "战斗",
          "重生",
          "逆袭",
          "爆笑",
          "少年",
          "后宫",
          "系统",
          "BL",
          "韩漫",
          "完整版",
          "19r",
          "台版",
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
      let url = `https://www.manwaba.com/api/v1/json/cate`;
      let payload = JSON.stringify({
        page: {
          page: page,
          pageSize: 10,
        },
        category: "comic",
        sort: parseInt(options[2]),
        comic: {
          status: parseInt(options[0] == "2" ? -1 : options[0]),
          day: parseInt(options[1]),
          tag: param,
        },
        video: {
          year: 0,
          typeId: 0,
          typeId1: 0,
          area: "",
          lang: "",
          status: -1,
          day: 0,
        },
        novel: {
          status: -1,
          day: 0,
          sortId: 0,
        },
      });

      let res = await this.postJson({
        url,
        data: payload,
      });

      function parseComic(comic) {
        return new Comic({
          id: comic.url.split("/").pop(),
          title: comic.title,
          subTitle: comic.author,
          cover: comic.pic,
          tags: comic.tags.split(","),
          description: comic.intro,
          status: comic.status == 0 ? "连载中" : "已完结",
        });
      }
      return {
        comics: res.map(parseComic),
        maxPage: 100,
      };
    },
    // provide options for category comic loading
    optionList: [
      {
        options: ["2-全部", "0-连载中", "1-已完结"],
      },
      {
        options: [
          "0-全部",
          "1-周一",
          "2-周二",
          "3-周三",
          "4-周四",
          "5-周五",
          "6-周六",
          "7-周日",
        ],
      },
      {
        options: ["0-更新", "1-新作", "2-畅销", "3-热门", "4-收藏"],
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
      const pageSize = 20;
      let url = `${this.baseUrl}api/v1/json/search?keyword=${keyword}&type=mh&page=${page}&pageSize=${pageSize}`;
      let res = await this.getJson({
        url,
      });
      let total = res.total;
      let comics = res.list.map((item) => {
        return new Comic({
          id: item.id,
          title: item.title,
          subTitle: item.author,
          cover: item.cover,
          tags: item.tags.split(","),
          description: item.description,
          status: item.status == 0 ? "连载中" : "已完结",
        });
      });
      let maxPage = Math.ceil(total / pageSize);
      return {
        comics,
        maxPage,
      };
    },
  };

  // favorite related
  favorites = {
    // whether support multi folders
    multiFolder: false,
    /**
     * add or delete favorite.
     * throw `Login expired` to indicate login expired, App will automatically re-login and re-add/delete favorite
     * @param comicId {string}
     * @param folderId {string}
     * @param isAdding {boolean} - true for add, false for delete
     * @param favoriteId {string?} - [Comic.favoriteId]
     * @returns {Promise<any>} - return any value to indicate success
     */
    addOrDelFavorite: async (comicId, folderId, isAdding, favoriteId) => {
      /*
            ```
            let res = await Network.post('...')
            if (res.status === 401) {
                throw `Login expired`;
            }
            return 'ok'
            ```
            */
    },
    /**
     * load favorite folders.
     * throw `Login expired` to indicate login expired, App will automatically re-login retry.
     * if comicId is not null, return favorite folders which contains the comic.
     * @param comicId {string?}
     * @returns {Promise<{folders: {[p: string]: string}, favorited: string[]}>} - `folders` is a map of folder id to folder name, `favorited` is a list of folder id which contains the comic
     */
    loadFolders: async (comicId) => {
      /*
            ```
            let data = JSON.parse((await Network.get('...')).body)

            let folders = {}

            data.folders.forEach((f) => {
                folders[f.id] = f.name
            })

            return {
                folders: folders,
                favorited: data.favorited
            }
            ```
            */
    },
    /**
     * add a folder
     * @param name {string}
     * @returns {Promise<any>} - return any value to indicate success
     */
    addFolder: async (name) => {
      /*
            ```
            let res = await Network.post('...')
            if (res.status === 401) {
                throw `Login expired`;
            }
            return 'ok'
            ```
            */
    },
    /**
     * delete a folder
     * @param folderId {string}
     * @returns {Promise<void>} - return any value to indicate success
     */
    deleteFolder: async (folderId) => {
      /*
            ```
            let res = await Network.delete('...')
            if (res.status === 401) {
                throw `Login expired`;
            }
            return 'ok'
            ```
            */
    },
    /**
     * load comics in a folder
     * throw `Login expired` to indicate login expired, App will automatically re-login retry.
     * @param page {number}
     * @param folder {string?} - folder id, null for non-multi-folder
     * @returns {Promise<{comics: Comic[], maxPage: number}>}
     */
    loadComics: async (page, folder) => {
      /*
            ```
            let data = JSON.parse((await Network.get('...')).body)
            let maxPage = data.maxPage

            function parseComic(comic) {
                // ...

                return new Comic{
                    id: id,
                    title: title,
                    subTitle: author,
                    cover: cover,
                    tags: tags,
                    description: description
                }
            }

            return {
                comics: data.list.map(parseComic),
                maxPage: maxPage
            }
            ```
            */
    },
    /**
     * load comics with next page token
     * @param next {string | null} - next page token, null for first page
     * @param folder {string}
     * @returns {Promise<{comics: Comic[], next: string?}>}
     */
    loadNext: async (next, folder) => {},
    /**
     * If the comic source only allows one comic in one folder, set this to true.
     */
    singleFolderForSingleComic: false,
  };

  /// single comic related
  comic = {
    /**
     * load comic info
     * @param id {string}
     * @returns {Promise<ComicDetails>}
     */
    loadInfo: async (id) => {},
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
     * rate a comic
     * @param id
     * @param rating {number} - [0-10] app use 5 stars, 1 rating = 0.5 stars,
     * @returns {Promise<any>} - return any value to indicate success
     */
    starRating: async (id, rating) => {},

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
    /**
     * [Optional] like or unlike a comic
     * @param id {string}
     * @param isLike {boolean} - true for like, false for unlike
     * @returns {Promise<void>}
     */
    likeComic: async (id, isLike) => {},
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
      /*
            ```
            // ...

            return {
                comments: data.results.list.map(e => {
                    return new Comment({
                        // string
                        userName: e.user_name,
                        // string
                        avatar: e.user_avatar,
                        // string
                        content: e.comment,
                        // string?
                        time: e.create_at,
                        // number?
                        replyCount: e.count,
                        // string
                        id: e.id,
                    })
                }),
                // number
                maxPage: data.results.maxPage,
            }
            ```
            */
    },
    /**
     * [Optional] send a comment, return any value to indicate success
     * @param comicId {string}
     * @param subId {string?} - ComicDetails.subId
     * @param content {string}
     * @param replyTo {string?} - commentId to reply, not null when reply to a comment
     * @returns {Promise<any>}
     */
    sendComment: async (comicId, subId, content, replyTo) => {},
    /**
     * [Optional] like or unlike a comment
     * @param comicId {string}
     * @param subId {string?} - ComicDetails.subId
     * @param commentId {string}
     * @param isLike {boolean} - true for like, false for unlike
     * @returns {Promise<void>}
     */
    likeComment: async (comicId, subId, commentId, isLike) => {},
    /**
     * [Optional] vote a comment
     * @param id {string} - comicId
     * @param subId {string?} - ComicDetails.subId
     * @param commentId {string} - commentId
     * @param isUp {boolean} - true for up, false for down
     * @param isCancel {boolean} - true for cancel, false for vote
     * @returns {Promise<number>} - new score
     */
    voteComment: async (id, subId, commentId, isUp, isCancel) => {},
    // {string?} - regex string, used to identify comic id from user input
    idMatch: null,
    /**
     * [Optional] Handle tag click event
     * @param namespace {string}
     * @param tag {string}
     * @returns {PageJumpTarget}
     */
    onClickTag: (namespace, tag) => {
      /*
            ```
            return new PageJumpTarget({
                page: 'search',
                keyword: tag,
            })
            ```
             */
    },
    /**
     * [Optional] Handle links
     */
    link: {
      /**
       * set accepted domains
       */
      domains: ["example.com"],
      /**
       * parse url to comic id
       * @param url {string}
       * @returns {string | null}
       */
      linkToId: (url) => {},
    },
    // enable tags translate
    enableTagsTranslate: false,
  };
}
