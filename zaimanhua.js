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
   * @returns {Promise<{body: string, status: number, headers: object}>}
   */
  async fetchHtml(url, headers = {}) {
    let res = await Network.get(url, headers);
    return res;
  }

  /**
   * fetch json content
   * @param url {string}
   * @param headers {object?}
   * @returns {Promise<{errno:number,errmsg:string,data:object}>}
   */
  async fetchJson(url, headers = {}) {
    let res = await Network.get(url, headers);
    return JSON.parse(res.body);
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
   * parse comic from html element
   * @param comic {HtmlElement}
   * @returns {Comic}
   */
  parseListComic(comic) {
    let cover = comic.querySelector("img").attributes["src"];
    let title = comic.querySelector("h3 > a").text.trim();
    let url = comic.querySelector("h3 > a").attributes["href"];
    let id = url.split("/").pop().split(".")[0];

    let infos = comic.querySelectorAll("p");

    let subtitle = infos[0]?.text.replace("作者：", "").trim();
    let classify = infos[1]?.text.replace("类型：", "").trim().split("/");
    let status = infos[2]?.text.replace("状态：", "").trim();
    let description = infos[3]?.text.replace("最新：", "").trim();
    let tags = {
      类型: classify,
      状态: status,
    };

    return new Comic({
      title,
      id,
      subtitle,
      tags,
      url,
      cover,
      description,
    });
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
    let url = `https://www.zaimanhua.com/info/${e.id}.html`;

    let subtitle = e.authors;

    let classify = e.types;
    let status = e.status;
    let description = e.last_update_chapter_name;
    let tags = {
      类型: classify,
      状态: status,
    };

    return new Comic({
      title,
      id,
      subtitle,
      tags,
      url,
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
        let res = await this.fetchHtml(this.domain);
        if (res.status !== 200) {
          throw `Invalid status code: ${res.status}`;
        }
        let document = new HtmlDocument(res.body);
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
    category = {
        /// title of the category page, used to identify the page, it should be unique
        title: "",
        parts: [
            {
                // title of the part
                name: "Theme",

                // fixed or random or dynamic
                // if random, need to provide `randomNumber` field, which indicates the number of comics to display at the same time
                // if dynamic, need to provide `loader` field, which indicates the function to load comics
                type: "fixed",

                // Remove this if type is dynamic
                categories: [
                    {
                        label: "Category1",
                        /**
                         * @type {PageJumpTarget}
                         */
                        target: {
                            page: "category",
                            attributes: {
                                category: "category1",
                                param: null,
                            },
                        },
                    },
                ]

                // number of comics to display at the same time
                // randomNumber: 5,

                // load function for dynamic type
                // loader: async () => {
                //     return [
                //          // ...
                //     ]
                // }
            }
        ],
        // enable ranking page
        enableRankingPage: false,
    }

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
            /*
            ```
            let data = JSON.parse((await Network.get('...')).body)
            let maxPage = data.maxPage

            function parseComic(comic) {
                // ...

                return new Comic({
                    id: id,
                    title: title,
                    subTitle: author,
                    cover: cover,
                    tags: tags,
                    description: description
                })
            }

            return {
                comics: data.list.map(parseComic),
                maxPage: maxPage
            }
            ```
            */
        },
        // provide options for category comic loading
        optionList: [
            {
                // For a single option, use `-` to separate the value and text, left for value, right for text
                options: [
                    "newToOld-New to Old",
                    "oldToNew-Old to New"
                ],
                // [Optional] {string[]} - show this option only when the value not in the list
                notShowWhen: null,
                // [Optional] {string[]} - show this option only when the value in the list
                showWhen: null
            }
        ],
        ranking: {
            // For a single option, use `-` to separate the value and text, left for value, right for text
            options: [
                "day-Day",
                "week-Week"
            ],
            /**
             * load ranking comics
             * @param option {string} - option from optionList
             * @param page {number} - page number
             * @returns {Promise<{comics: Comic[], maxPage: number}>}
             */
            load: async (option, page) => {
                /*
                ```
                let data = JSON.parse((await Network.get('...')).body)
                let maxPage = data.maxPage

                function parseComic(comic) {
                    // ...

                    return new Comic({
                        id: id,
                        title: title,
                        subTitle: author,
                        cover: cover,
                        tags: tags,
                        description: description
                    })
                }

                return {
                    comics: data.list.map(parseComic),
                    maxPage: maxPage
                }
                ```
                */
            }
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
      /*
            ```
            let data = JSON.parse((await Network.get('...')).body)
            let maxPage = data.maxPage

            function parseComic(comic) {
                // ...

                return new Comic({
                    id: id,
                    title: title,
                    subTitle: author,
                    cover: cover,
                    tags: tags,
                    description: description
                })
            }

            return {
                comics: data.list.map(parseComic),
                maxPage: maxPage
            }
            ```
            */
    },

    /**
     * load search result with next page token.
     * The field will be ignored if `load` function is implemented.
     * @param keyword {string}
     * @param options {(string)[]} - options from optionList
     * @param next {string | null}
     * @returns {Promise<{comics: Comic[], maxPage: number}>}
     */
    loadNext: async (keyword, options, next) => {},

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
