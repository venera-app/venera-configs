class NoyAcgSource extends ComicSource {
    name = "NoyAcg"
    key = "noyacg"
    version = "1.0.0"
    minAppVersion = "1.0.0"
    url = "https://cdn.jsdelivr.net/gh/falling7down/pica_configs@main/noyacg.js"

    init() {
        Date.prototype.format = function () {
            let padLeft = function (str, length) {
                str = str.toString();
                if (str.length >= length) {
                    return str;
                }
                for (let i = 0; i < length - str.length; i++) {
                    str = "0" + str;
                }
                return str;
            }
            return `${padLeft(this.getFullYear(), 4)}-${padLeft(this.getMonth() + 1, 2)}-${padLeft(this.getDate(), 2)}`;
        }
    }

    parseComic = function (comic) {
        let formatNum = function (num) {
            if (num <= 999) {
                return num.toString();
            }
            return (num / 1000).toFixed(2).toString() + "k";
        }
        let title = `${comic.Bookname}`;
        if (comic.Len) {
            title = `[${comic.Len}P]${comic.Bookname}`;
        }
        return {
            id: `${comic.Bid}#${comic.Len}`,
            title: title,
            subTitle: comic.Author,
            cover: `https://img.noy.asia/${comic.Bid}/1.webp`,
            tags: (comic.Ptag || "").split(" "),
            description: `${new Date(comic.Time * 1000).format()}`
        }
    };

    post = async function (url, data) {
        let headers = {
            "Content-Type": "application/x-www-form-urlencoded"
        }
        let res = await Network.post(url, headers, data);
        if (res.status != 200) {
            throw `Invalid status code: ${res.status}`
        }
        let resp = JSON.parse(res.body);
        if ("status" in resp && resp.status != 'ok') {
            throw resp.status;
        }
        return resp;
    }

    searchComic = async function ({ info, type, sort, page }) {
        let data = await this.post("https://noy1.top/api/search_v2", `info=${info}&type=${type}&sort=${sort}&page=${page}`);
        let maxPage = Math.ceil(data.len / 20);
        return {
            comics: data.Info.map(this.parseComic),
            maxPage: maxPage
        }
    }

    getThumbnails = function (comicId, length) {
        let images = [];
        for (let i = 1; i <= parseInt(length); i++) {
            images.push(`https://img.noy.asia/${comicId}/${i}.webp`);
        }
        return images;
    };

    /// 账号
    /// 设置为null禁用账号功能
    account = {
        /// 登录
        /// 返回任意值表示登录成功
        login: async (user, pass) => {
            let data = await this.post('https://noy1.top/api/login', `user=${user}&pass=${pass}`)
            const { status } = data;
            if (status !== 'ok') {
                throw 'Failed to login';
            }
            return 'ok';
        },
        // 退出登录时将会调用此函数
        logout: () => {
            Network.deleteCookies('https://noy1.top');
        },
        registerWebsite: "https://noy1.top/#/reg"
    }
    explore = [
        {
            title: "NoyAcg",
            type: "singlePageWithMultiPart",
            load: async () => {
                let data = await this.post("https://noy1.top/api/home")
                let comics = {}
                let size = 18;
                comics["阅读榜"] = data["readDay"].slice(0, size).map(this.parseComic)
                comics["收藏榜"] = data["favDay"].slice(0, size).map(this.parseComic)
                // 高质量榜都是0P
                comics["高质量榜"] = data["proportion"].slice(0, size).map(this.parseComic)
                comics["收藏推荐"] = data["fs"].slice(0, size).map(this.parseComic)
                return comics;
            }
        }
    ]

    category = {
        title: "NoyAcg",
        parts: [
            {
                name: "标签",
                type: "fixed",
                categories: ["纯爱", "全彩", "NTR", "伪娘", "扶她", "姐妹", "后宫", "重口", "束缚", "性转换", "无修正", "单行本", "强奸", "萝莉", "东方", "原神", "舰C", "原创"],
                itemType: "category",
                categoryParams: ["純愛", "全彩", "NTR", "偽娘", "扶她", "姐妹", "多人運動", "重 口", "束縛", "性轉換", "無修正", "單行本", "強姦", "蘿莉", "東方Project", "原神", "艦隊Collection", "原創"]
            }
        ],
        enableRankingPage: false,
    }

    categoryComics = {
        load: async (category, param, options, page) => {
            return await this.searchComic({
                info: param,
                type: 'tag',
                sort: options[0],
                page: page
            })
        },
        optionList: [
            {
                options: [
                    "bid-时间排序",
                    "views-阅读量排序",
                    "favorites-收藏排序"
                ],
                notShowWhen: null,
                showWhen: null
            }
        ],
        ranking: {
            options: [
                "day-日",
                "week-周"
            ],
            load: async (option, page) => {

            }
        }
    }

    /// 搜索
    search = {
        load: async (keyword, options, page) => {
            return await this.searchComic({
                info: keyword,
                type: options[0],
                sort: options[1],
                page: page
            });
        },
        // 提供选项
        optionList: [
            {
                options: [
                    "de-综合",
                    "tag-标签",
                    "author-作者"
                ],
                label: "搜索设置"
            },
            {
                // 使用-分割, 左侧用于数据加载, 右侧显示给用户
                options: [
                    "bid-时间排序",
                    "views-阅读量排序",
                    "favorites-收藏排序"
                ],
                // 标签
                label: "排序"
            }
        ]
    }

    /// 收藏
    favorites = {
        /// 是否为多收藏夹
        multiFolder: false,
        /// 添加或者删除收藏
        addOrDelFavorite: async (id, folderId, isAdding) => {
            let [comicId] = id.split("#");
            let res = await Network.post("https://noy1.top/api/adfavorites", {
                "Content-Type": "application/x-www-form-urlencoded"
            }, `bid=${comicId}`)
            let data = res.body;
            if (data === 'ok') {
                return 'ok';
            }
            throw data;
        },
        // 加载收藏夹, 仅当multiFolder为true时有效
        // 当comicId不为null时, 需要同时返回包含该漫画的收藏夹
        loadFolders: async (comicId) => {
            /*
            ```
            let data = JSON.parse((await Network.get('...')).body)

            let folders = {}

            data.folders.forEach((f) => {
                folders[f.id] = f.name
            })

            return {
                // map<string, string> key为收藏夹id, value为收藏夹名称, id用于收藏夹相关内容的加载
                folders: folders,
                // string[]?, 包含comicId的收藏夹, 若comicId为空, 则此字段为空
                favorited: data.favorited
            }
            ```
            */
        },
        /// 加载漫画
        loadComics: async (page, folder) => {
            let data = await this.post("https://noy1.top/api/favoriteslist_v2", `page=${page}`);
            return {
                comics: data.info.map(this.parseComic),
                maxPage: Math.ceil(data.len / 20)
            }
        }
    }

    /// 单个漫画相关
    comic = {
        // 加载漫画信息
        loadInfo: async (id) => {
            let [comicId, length] = id.split("#");
            let data = await this.post('https://noy1.top/api/getbookinfo', `bid=${comicId}`);
            let comic = {
                // string 标题
                title: data.Bookname,
                // string 封面url
                cover: `https://img.noy.asia/${comicId}/m1.webp`,
                // string
                // description: `${data.Len}P`,
                // Map<string, string[]> | object 标签
                tags: {
                    "作者": [data.Author],
                    "角色": (data.Pname || "").split(" "),
                    "标签": (data.Ptag || "").split(" "),
                    "其他": (data.Otag || "").split(" "),
                    "页数": [`${data.Len}P`],
                    "日期": [new Date(data.Time * 1000).format()]
                },
                // Map<string, string>? | object, key为章节id, value为章节名称
                // 注意: 为了保证章节顺序, 最好使用Map, 使用object不能保证顺序
                chapters: {},
                // bool 注意, 如果是多收藏式的网络收藏, 将此项设置为null, 从而可以在漫画详情页面, 对每个单独的收藏夹执行收藏或者取消收藏操作
                isFavorite: data.F,
                // thumbnails: this.getThumbnails(comicId, length)
            };
            return comic;
        },
        // 获取章节图片
        loadEp: async (id, epId) => {
            let [comicId, len] = id.split("#");
            return {
                images: this.getThumbnails(comicId, len)
            }
        },
        // 可选, 调整图片加载的行为; 如不需要, 删除此字段
        onImageLoad: (url, comicId, epId) => {
            return {
                headers: {
                    'Referer': 'https://noy1.top/',
                },
            }
        },
        // [v3.1.4添加] 可选, 调整缩略图(封面, 预览, 头像等)加载的行为; 如不需要, 删除此字段
        onThumbnailLoad: (url) => {
            return {
                headers: {
                    'Referer': 'https://noy1.top/',
                },
            }
        },
        // 加载评论
        loadComments: async (id, subId, page, replyTo) => {
            let [comicId] = id.split("#");
            let data = await this.post("https://noy1.top/api/getComment", `bid=${comicId}&page=${page}`);
            let over = data.over;
            let getReplyCount = function (cid) {
                return data.info.filter(c => c.reply == cid).length
            }
            let comments = data.info;
            let maxPage = over ? page : page + 1
            if (replyTo) {
                comments = comments.filter(c => c.reply == replyTo);
            }
            return {
                comments: comments.map(c => {
                    return {
                        userName: c.username,
                        avatar: `https://bucket.noy.asia/${c.avatarUrl}`,
                        content: c.content,
                        time: new Date(c.time * 1000).format(),
                        replyCount: getReplyCount(c.cid),
                        id: c.cid
                    }
                }),
                maxPage: maxPage
            }
        },
        // 发送评论, 返回任意值表示成功
        sendComment: async (id, subId, content, replyTo) => {
            if (!replyTo) {
                replyTo = -1;
            }
            let [comicId] = id.split("#");
            let data = await this.post("https://noy1.top/api/sendComment", `bid=${comicId}&platform=web&content=${content}&reply=${replyTo}`);
            if (data.status === 'ok') {
                return "ok";
            }
            throw data.status;
        }
    }
}
