class Komiic extends ComicSource {

    // 此漫画源的名称
    name = "Komiic"

    // 唯一标识符
    key = "Komiic"

    version = "1.0.2"

    minAppVersion = "1.0.0"

    // 更新链接
    url = "https://cdn.jsdelivr.net/gh/venera-app/venera-configs@main/komiic.js"

    get headers() {
        let token = this.loadData('token')
        let headers = {
            'Referer': 'https://komiic.com/',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Content-Type': 'application/json'
        }
        if (token) {
            headers['Authorization'] = `Bearer ${token}`
        }
        return headers
    }

    async queryJson(query) {
        let operationName = query["operationName"]

        let res = await Network.post(
            'https://komiic.com/api/query',
            this.headers,
            query
        )

        if (res.status !== 200) {
            throw `Invalid Status Code ${res.status}`
        }

        let json = JSON.parse(res.body)

        if (json.errors != undefined) {
            if(json.errors[0].message.toString().indexOf('token is expired') >= 0){
                throw 'Login expired'
            }
            throw json.errors[0].message
        }

        return json
    }

    async queryComics(query) {
        let operationName = query["operationName"]
        let json = await this.queryJson(query)

        function parseComic(comic) {
            let author = ''
            if (comic.authors.length > 0) {
                author = comic.authors[0].name
            }
            let tags = []
            comic.categories.forEach((c) => {
                tags.push(c.name)
            })

            function getTimeDifference(date) {
                const now = new Date();
                const timeDifference = now - date;

                const millisecondsPerHour = 1000 * 60 * 60;
                const millisecondsPerDay = millisecondsPerHour * 24;

                if (timeDifference < millisecondsPerHour) {
                    return '剛剛更新';
                } else if (timeDifference < millisecondsPerDay) {
                    const hours = Math.floor(timeDifference / millisecondsPerHour);
                    return `${hours}小時前更新`;
                } else {
                    const days = Math.floor(timeDifference / millisecondsPerDay);
                    return `${days}天前更新`;
                }
            }

            let updateTime = new Date(comic.dateUpdated)
            let description = getTimeDifference(updateTime)
            let formatedTime = `${updateTime.getFullYear()}-${updateTime.getMonth() + 1}-${updateTime.getDate()}`

            return {
                id: comic.id,
                title: comic.title,
                subTitle: author,
                cover: comic.imageUrl,
                tags: tags,
                description: description,
                updateTime: formatedTime
            }
        }

        return {
            comics: json.data[operationName].map(parseComic),
            // 没找到最大页数的接口
            maxPage: null
        }
    }

    /// 账号
    /// 设置为null禁用账号功能
    account = {
        /// 登录
        /// 返回任意值表示登录成功
        login: async (account, pwd) => {
            let res = await Network.post(
                'https://komiic.com/api/login',
                this.headers,
                {
                    email: account,
                    password: pwd
                }
            )

            if (res.status === 200) {
                this.saveData('token', JSON.parse(res.body).token)
                return 'ok'
            }

            throw 'Failed to login'
        },

        // 退出登录时将会调用此函数
        logout: () => {
            this.deleteData('token')
        },

        registerWebsite: "https://komiic.com/register"
    }

    /// 探索页面
    /// 一个漫画源可以有多个探索页面
    explore = [
        {
            /// 标题
            /// 标题同时用作标识符, 不能重复
            title: "Komiic",

            /// singlePageWithMultiPart 或者 multiPageComicList
            type: "multiPageComicList",

            load: async (page) => {
                return await this.queryComics({ "operationName": "recentUpdate", "variables": { "pagination": { "limit": 20, "offset": (page - 1) * 20, "orderBy": "DATE_UPDATED", "status": "", "asc": true } }, "query": "query recentUpdate($pagination: Pagination!) {\n  recentUpdate(pagination: $pagination) {\n    id\n    title\n    status\n    year\n    imageUrl\n    authors {\n      id\n      name\n      __typename\n    }\n    categories {\n      id\n      name\n      __typename\n    }\n    dateUpdated\n    monthViews\n    views\n    favoriteCount\n    lastBookUpdate\n    lastChapterUpdate\n    __typename\n  }\n}" })
            }
        }
    ]

    category = {
        title: "Komiic",
        enableRankingPage: true,
        parts: [
            {
                name: "主题",

                type: "fixed",

                categories: ['全部', '愛情', '神鬼', '校園', '搞笑', '生活', '懸疑', '冒險', '職場', '魔幻', '後宮', '魔法', '格鬥', '宅男', '勵志', '耽美', '科幻', '百合', '治癒', '萌系', '熱血', '競技', '推理', '雜誌', '偵探', '偽娘', '美食', '恐怖', '四格', '社會', '歷史', '戰爭', '舞蹈', '武俠', '機戰', '音樂', '體育', '黑道'],

                itemType: "category",

                // 若提供, 数量需要和`categories`一致, `categoryComics.load`方法将会收到此参数
                categoryParams: ['0', '1', '3', '4', '5', '6', '7', '8', '10', '11', '2', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21', '22', '23', '24', '25', '26', '27', '9', '28', '31', '32', '33', '34', '35', '36', '37', '40', '42']
            }
        ]
    }

    /// 分类漫画页面, 即点击分类标签后进入的页面
    categoryComics = {
        load: async (category, param, options, page) => {
          let variables = {
              pagination: {
                  limit: 30,
                  offset: (page - 1) * 30,
                  orderBy: options[0],
                  asc: false,
                  status: options[1]
              }
          };
          
          if (param !== '0') {
              variables.categoryId = [param];
          } else {
              variables.categoryId = [];
          }

          return await this.queryComics({ 
              "operationName": "comicByCategories",
              "variables": variables,
              "query": `query comicByCategories($categoryId: [ID!]!, $pagination: Pagination!) {
                  comicByCategories(categoryId: $categoryId, pagination: $pagination) {
                      id
                      title
                      status
                      year
                      imageUrl
                      authors { id name __typename }
                      categories { id name __typename }
                      dateUpdated
                      monthViews
                      views
                      favoriteCount
                      lastBookUpdate
                      lastChapterUpdate
                      __typename
                  }
              }`
          })
        },
        // 提供选项
        optionList: [
            {
                options: [
                    "DATE_UPDATED-更新",
                    "VIEWS-觀看數",
                    "FAVORITE_COUNT-喜愛數",
                ],
                notShowWhen: null,
                showWhen: null
            },
            {
                options: [
                    "-全部",
                    "ONGOING-連載中",
                    "END-完結",
                ],
                notShowWhen: null,
                showWhen: null
            },
        ],
        ranking: {
            options: [
                "MONTH_VIEWS-月",
                "VIEWS-綜合"
            ],
            load: async (option, page) => {
                return this.queryComics({ "operationName": "hotComics", "variables": { "pagination": { "limit": 20, "offset": (page - 1) * 20, "orderBy": option, "status": "", "asc": true } }, "query": "query hotComics($pagination: Pagination!) {\n  hotComics(pagination: $pagination) {\n    id\n    title\n    status\n    year\n    imageUrl\n    authors {\n      id\n      name\n      __typename\n    }\n    categories {\n      id\n      name\n      __typename\n    }\n    dateUpdated\n    monthViews\n    views\n    favoriteCount\n    lastBookUpdate\n    lastChapterUpdate\n    __typename\n  }\n}" })
            }
        }
    }

    /// 搜索
    search = {
        load: async (keyword, options, page) => {
            let json = await this.queryJson({ "operationName": "searchComicAndAuthorQuery", "variables": { "keyword": keyword }, "query": "query searchComicAndAuthorQuery($keyword: String!) {\n  searchComicsAndAuthors(keyword: $keyword) {\n    comics {\n      id\n      title\n      status\n      year\n      imageUrl\n      authors {\n        id\n        name\n        __typename\n      }\n      categories {\n        id\n        name\n        __typename\n      }\n      dateUpdated\n      monthViews\n      views\n      favoriteCount\n      lastBookUpdate\n      lastChapterUpdate\n      __typename\n    }\n    authors {\n      id\n      name\n      chName\n      enName\n      wikiLink\n      comicCount\n      views\n      __typename\n    }\n    __typename\n  }\n}" })

            function parseComic(comic) {
                let author = ''
                if (comic.authors.length > 0) {
                    author = comic.authors[0].name
                }
                let tags = []
                comic.categories.forEach((c) => {
                    tags.push(c.name)
                })

                function getTimeDifference(date) {
                    const now = new Date();
                    const timeDifference = now - date;

                    const millisecondsPerHour = 1000 * 60 * 60;
                    const millisecondsPerDay = millisecondsPerHour * 24;

                    if (timeDifference < millisecondsPerHour) {
                        return '剛剛更新';
                    } else if (timeDifference < millisecondsPerDay) {
                        const hours = Math.floor(timeDifference / millisecondsPerHour);
                        return `${hours}小時前更新`;
                    } else {
                        const days = Math.floor(timeDifference / millisecondsPerDay);
                        return `${days}天前更新`;
                    }
                }

                let updateTime = new Date(comic.dateUpdated)
                let description = getTimeDifference(updateTime)

                return {
                    id: comic.id,
                    title: comic.title,
                    subTitle: author,
                    cover: comic.imageUrl,
                    tags: tags,
                    description: description
                }
            }

            return {
                comics: json.data.searchComicsAndAuthors.comics.map(parseComic),
                // 没找到最大页数的接口
                maxPage: 1
            }
        },

        optionList: []
    }

    /// 收藏
    favorites = {
        /// 是否为多收藏夹
        multiFolder: true,
        /// 添加或者删除收藏
        addOrDelFavorite: async (comicId, folderId, isAdding) => {
            let query = {}
            if (isAdding) {
                query = { "operationName": "addComicToFolder", "variables": { "comicId": comicId, "folderId": folderId }, "query": "mutation addComicToFolder($comicId: ID!, $folderId: ID!) {\n  addComicToFolder(comicId: $comicId, folderId: $folderId)\n}" }
            } else {
                query = { "operationName": "removeComicToFolder", "variables": { "comicId": comicId, "folderId": folderId }, "query": "mutation removeComicToFolder($comicId: ID!, $folderId: ID!) {\n  removeComicToFolder(comicId: $comicId, folderId: $folderId)\n}" }
            }
            await this.queryJson(query)
            return "ok"
        },
        // 加载收藏夹, 仅当multiFolder为true时有效
        // 当comicId不为null时, 需要同时返回包含该漫画的收藏夹
        loadFolders: async (comicId) => {
            let json = await this.queryJson({ "operationName": "myFolder", "variables": {}, "query": "query myFolder {\n  folders {\n    id\n    key\n    name\n    views\n    comicCount\n    dateCreated\n    dateUpdated\n    __typename\n  }\n}" })
            let folders = {}
            json.data.folders.forEach((f) => {
                folders[f.id] = f.name
            })
            let favorited = null
            if (comicId) {
                let json2 = await this.queryJson({ "operationName": "comicInAccountFolders", "variables": { "comicId": comicId }, "query": "query comicInAccountFolders($comicId: ID!) {\n  comicInAccountFolders(comicId: $comicId)\n}" })
                favorited = json2.data.comicInAccountFolders
            }
            return {
                folders: folders,
                favorited: favorited
            }
        },
        /// 创建收藏夹
        addFolder: async (name) => {
            let json = await this.queryJson({ "operationName": "createFolder", "variables": { "name": name }, "query": "mutation createFolder($name: String!) {\n  createFolder(name: $name) {\n    id\n    key\n    name\n    account {\n      id\n      nickname\n      __typename\n    }\n    comicCount\n    views\n    dateCreated\n    dateUpdated\n    __typename\n  }\n}" })
            return "ok"
        },
        deleteFolder: async (id) => {
            let json = await this.queryJson({ "operationName": "removeFolder", "variables": { "folderId": id }, "query": "mutation removeFolder($folderId: ID!) {\n  removeFolder(folderId: $folderId)\n}" })
            return "ok"
        },
        /// 加载漫画
        loadComics: async (page, folder) => {
            let json = await this.queryJson({ "operationName": "folderComicIds", "variables": { "folderId": folder, "pagination": { "limit": 30, "offset": (page - 1) * 30, "orderBy": "DATE_UPDATED", "status": "", "asc": true } }, "query": "query folderComicIds($folderId: ID!, $pagination: Pagination!) {\n  folderComicIds(folderId: $folderId, pagination: $pagination) {\n    folderId\n    key\n    comicIds\n    __typename\n  }\n}" })
            let ids = json.data.folderComicIds.comicIds
            if (ids.length == 0) {
                return {
                    comics: [],
                    maxPage: 1
                }
            }
            return this.queryComics({ "operationName": "comicByIds", "variables": { "comicIds": ids }, "query": "query comicByIds($comicIds: [ID]!) {\n  comicByIds(comicIds: $comicIds) {\n    id\n    title\n    status\n    year\n    imageUrl\n    authors {\n      id\n      name\n      __typename\n    }\n    categories {\n      id\n      name\n      __typename\n    }\n    dateUpdated\n    monthViews\n    views\n    favoriteCount\n    lastBookUpdate\n    lastChapterUpdate\n    __typename\n  }\n}" })
        }
    }

    /// 单个漫画相关
    comic = {
        // 加载漫画信息
        loadInfo: async (id) => {
            let json1 = await this.queryJson({ "operationName": "recommendComicById", "variables": { "comicId": id }, "query": "query recommendComicById($comicId: ID!) {\n  recommendComicById(comicId: $comicId)\n}" })
            let recommend = json1.data.recommendComicById
            recommend.push(id)

            let getFavoriteStatus = async () => {
                let token = this.loadData('token')
                if (!token) {
                    return false
                }
                let json = await this.queryJson({ "operationName": "comicInAccountFolders", "variables": { "comicId": id }, "query": "query comicInAccountFolders($comicId: ID!) {\n  comicInAccountFolders(comicId: $comicId)\n}" })
                let folders = json.data.comicInAccountFolders
                return folders.length !== 0
            }

            let getChapter = async () => {
                let json = await this.queryJson({ "operationName": "chapterByComicId", "variables": { "comicId": id }, "query": "query chapterByComicId($comicId: ID!) {\n  chaptersByComicId(comicId: $comicId) {\n    id\n    serial\n    type\n    dateCreated\n    dateUpdated\n    size\n    __typename\n  }\n}" })
                let all = json.data.chaptersByComicId
                let books = [], chapters = []
                all.forEach((c) => {
                    if(c.type === 'book') {
                        books.push(c)
                    } else {
                        chapters.push(c)
                    }
                })
                let res = new Map()
                books.forEach((c) => {
                    let name = '卷' + c.serial
                    res.set(c.id, name)
                })
                chapters.forEach((c) => {
                    let name = c.serial
                    res.set(c.id, name)
                })
                return res
            }

            let results = await Promise.all([
                this.queryComics({ "operationName": "comicByIds", "variables": { "comicIds": recommend }, "query": "query comicByIds($comicIds: [ID]!) {\n  comicByIds(comicIds: $comicIds) {\n    id\n    title\n    status\n    year\n    imageUrl\n    authors {\n      id\n      name\n      __typename\n    }\n    categories {\n      id\n      name\n      __typename\n    }\n    dateUpdated\n    monthViews\n    views\n    favoriteCount\n    lastBookUpdate\n    lastChapterUpdate\n    __typename\n  }\n}" }),
                getChapter.call()
            ])

            let info = results[0].comics.pop()

            return {
                // string 标题
                title: info.title,
                // string 封面url
                cover: info.cover,
                // map<string, string[]> 标签
                tags: {
                    "作者": [info.subTitle],
                    "标签": info.tags
                },
                // map<string, string>?, key为章节id, value为章节名称
                chapters: results[1],
                recommend: results[0].comics,
                updateTime: info.updateTime,
            }
        },
        // 获取章节图片
        loadEp: async (comicId, epId) => {
            let json = await this.queryJson({ "operationName": "imagesByChapterId", "variables": { "chapterId": epId }, "query": "query imagesByChapterId($chapterId: ID!) {\n  imagesByChapterId(chapterId: $chapterId) {\n    id\n    kid\n    height\n    width\n    __typename\n  }\n}" })
            return {
                images: json.data.imagesByChapterId.map((i) => {
                    return `https://komiic.com/api/image/${i.kid}`
                })
            }
        },
        // 可选, 调整图片加载的行为
        onImageLoad: (url, comicId, epId) => {
            return {
                headers: {
                    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                    'referer': `https://komiic.com/comic/${comicId}/chapter/${epId}/images/all`
                }
            }
        },
        // 加载评论
        loadComments: async (comicId, subId, page, replyTo) => {
            let operationName = replyTo ? "messageChan" : "getMessagesByComicId"
            let promise = replyTo
                ? this.queryJson({ "operationName": "messageChan", "variables": { "messageId": replyTo }, "query": "query messageChan($messageId: ID!) {\n  messageChan(messageId: $messageId) {\n    id\n    comicId\n    account {\n      id\n      nickname\n      profileText\n      profileTextColor\n      profileBackgroundColor\n      profileImageUrl\n      __typename\n    }\n    message\n    replyTo {\n      id\n      __typename\n    }\n    upCount\n    downCount\n    dateUpdated\n    dateCreated\n    __typename\n  }\n}" })
                : this.queryJson({ "operationName": "getMessagesByComicId", "variables": { "comicId": comicId, "pagination": { "limit": 100, "offset": (page - 1) * 100, "orderBy": "DATE_UPDATED", "asc": true } }, "query": "query getMessagesByComicId($comicId: ID!, $pagination: Pagination!) {\n  getMessagesByComicId(comicId: $comicId, pagination: $pagination) {\n    id\n    comicId\n    account {\n      id\n      nickname\n      profileText\n      profileTextColor\n      profileBackgroundColor\n      profileImageUrl\n      __typename\n    }\n    message\n    replyTo {\n      id\n      message\n      account {\n        id\n        nickname\n        profileText\n        profileTextColor\n        profileBackgroundColor\n        profileImageUrl\n        __typename\n      }\n      __typename\n    }\n    upCount\n    downCount\n    dateUpdated\n    dateCreated\n    __typename\n  }\n}" })
            let json = await promise
            return {
                comments: json.data[operationName].map(e => {
                    return {
                        // string
                        userName: e.account.nickname,
                        // string
                        avatar: e.account.profileImageUrl,
                        // string
                        content: e.message,
                        // string?
                        time: e.dateUpdated,
                        // number?
                        // TODO: 没有数量信息, 但是设为null会禁用回复功能
                        replyCount: 0,
                        // string
                        id: e.id,
                    }
                }),
                maxPage: null,
            }
        },
        // 发送评论, 返回任意值表示成功
        sendComment: async (comicId, subId, content, replyTo) => {
            if (!replyTo) {
                replyTo = "0"
            }
            let json = await this.queryJson({ "operationName": "addMessageToComic", "variables": { "comicId": comicId, "message": content, "replyToId": replyTo }, "query": "mutation addMessageToComic($comicId: ID!, $replyToId: ID!, $message: String!) {\n  addMessageToComic(message: $message, comicId: $comicId, replyToId: $replyToId) {\n    id\n    message\n    comicId\n    account {\n      id\n      nickname\n      __typename\n    }\n    replyTo {\n      id\n      message\n      account {\n        id\n        nickname\n        profileText\n        profileTextColor\n        profileBackgroundColor\n        profileImageUrl\n        __typename\n      }\n      __typename\n    }\n    dateCreated\n    dateUpdated\n    __typename\n  }\n}" })
            return "ok"
        }
    }
}
