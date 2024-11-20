class CopyManga extends ComicSource {

    name = "拷贝漫画"

    key = "copy_manga"

    version = "1.0.2"

    minAppVersion = "1.0.0"

    url = "https://raw.githubusercontent.com/venera-app/venera-configs/refs/heads/main/copy_manga.js"

    headers = {}

    static copyVersion = "2.2.0"

    init() {
        let token = this.loadData("token");
        if (!token) {
            token = "";
        } else {
            token = " " + token;
        }
        this.headers = {
            "User-Agent": "COPY/" + CopyManga.copyVersion,
            "Accept": "*/*",
            "Accept-Encoding": "gzip",
            "source": "copyApp",
            "webp": "1",
            "region": "1",
            "version": CopyManga.copyVersion,
            "authorization": `Token${token}`,
            "platform": "3",
        }
    }

    /// account
    /// set this to null to desable account feature
    account = {
        /// login func
        login: async (account, pwd) => {
            let salt = randomInt(1000, 9999)
            let base64 = Convert.encodeBase64(Convert.encodeUtf8(`${pwd}-${salt}`))
            let res = await Network.post(
                "https://api.copymanga.tv/api/v3/login?platform=3",
                {
                    ...this.headers,
                    "Content-Type": "application/x-www-form-urlencoded;charset=utf-8"
                },
                `username=${account}&password=${base64}\n&salt=${salt}&platform=3&authorization=Token+&version=1.4.4&source=copyApp&region=1&webp=1`
            );
            if (res.status === 200) {
                let data = JSON.parse(res.body)
                let token = data.results.token
                this.saveData('token', token)
                this.headers = {
                    "User-Agent": "COPY/" + CopyManga.copyVersion,
                    "Accept": "*/*",
                    "Accept-Encoding": "gzip",
                    "source": "copyApp",
                    "webp": "1",
                    "region": "1",
                    "version": CopyManga.copyVersion,
                    "authorization": `Token ${token}`,
                    "platform": "3",
                }
                return "ok"
            } else {
                throw `Invalid Status Code ${res.status}`
            }
        },
        // callback when user log out
        logout: () => {
            this.deleteData('token')
        },
        registerWebsite: "https://www.copymanga.site/web/login/loginByAccount"
    }

    /// explore pages
    explore = [
        {
            title: "拷贝漫画",
            type: "singlePageWithMultiPart",
            load: async () => {
                let dataStr = await Network.get(
                    "https://api.copymanga.tv/api/v3/h5/homeIndex?platform=3",
                    this.headers
                )

                if (dataStr.status !== 200) {
                    throw `Invalid status code: ${dataStr.status}`
                }

                let data = JSON.parse(dataStr.body)

                function parseComic(comic) {
                    if (comic["comic"] !== null && comic["comic"] !== undefined) {
                        comic = comic["comic"]
                    }
                    let tags = []
                    if (comic["theme"] !== null && comic["theme"] !== undefined) {
                        tags = comic["theme"].map(t => t["name"])
                    }
                    let author = null

                    if (Array.isArray(comic["author"]) && comic["author"].length > 0) {
                        author = comic["author"][0]["name"]
                    }

                    return {
                        id: comic["path_word"],
                        title: comic["name"],
                        subTitle: author,
                        cover: comic["cover"],
                        tags: tags
                    }
                }

                let res = {}
                res["推荐"] = data["results"]["recComics"]["list"].map(parseComic)
                res["热门"] = data["results"]["hotComics"].map(parseComic)
                res["最新"] = data["results"]["newComics"].map(parseComic)
                res["完结"] = data["results"]["finishComics"]["list"].map(parseComic)
                res["今日排行"] = data["results"]["rankDayComics"]["list"].map(parseComic)
                res["本周排行"] = data["results"]["rankWeekComics"]["list"].map(parseComic)
                res["本月排行"] = data["results"]["rankMonthComics"]["list"].map(parseComic)

                return res
            }
        }
    ]

    category = {
        title: "拷贝漫画",
        parts: [
            {
                name: "主题",
                type: "fixed",
                categories: ["全部", "爱情", "欢乐向", "冒险", "奇幻", "百合", "校园", "科幻", "东方", "耽美", "生活", "格斗", "轻小说", "悬疑",
                    "其它", "神鬼", "职场", "TL", "萌系", "治愈", "长条", "四格", "节操", "伪娘", "性转换", "异世界"],
                itemType: "category",
                categoryParams: ["", "aiqing", "huanlexiang", "maoxian", "qihuan", "baihe", "xiaoyuan", "kehuan", "dongfang", "danmei", "shenghuo", "gedou", "qingxiaoshuo", "xuanyi",
                    "qita", "shengui", "zhichang", "teenslove", "mengxi", "zhiyu", "changtiao", "sige", "jiecao", "weiniang", "xingzhuanhuan", "yishijie"]
            }
        ]
    }

    categoryComics = {
        load: async (category, param, options, page) => {
            options = options.map(e => e.replace("*", "-"))
            let res = await Network.get(
                `https://api.copymanga.tv/api/v3/comics?limit=21&offset=${(page - 1) * 21}&ordering=${options[1]}&theme=${param}&top=${options[0]}&platform=3`,
                this.headers
            )
            if (res.status !== 200) {
                throw `Invalid status code: ${res.status}`
            }

            let data = JSON.parse(res.body)

            function parseComic(comic) {
                if (comic["comic"] !== null && comic["comic"] !== undefined) {
                    comic = comic["comic"]
                }
                let tags = []
                if (comic["theme"] !== null && comic["theme"] !== undefined) {
                    tags = comic["theme"].map(t => t["name"])
                }
                let author = null

                if (Array.isArray(comic["author"]) && comic["author"].length > 0) {
                    author = comic["author"][0]["name"]
                }

                return {
                    id: comic["path_word"],
                    title: comic["name"],
                    subTitle: author,
                    cover: comic["cover"],
                    tags: tags,
                    description: comic["datetime_updated"]
                }
            }

            return {
                comics: data["results"]["list"].map(parseComic),
                maxPage: (data["results"]["total"] - (data["results"]["total"] % 21)) / 21 + 1
            }
        },
        optionList: [
            {
                options: [
                    "-全部",
                    "japan-日漫",
                    "korea-韩漫",
                    "west-美漫",
                    "finish-已完结"
                ],
                notShowWhen: null,
                showWhen: null
            },
            {
                options: [
                    "*datetime_updated-时间倒序",
                    "datetime_updated-时间正序",
                    "*popular-热度倒序",
                    "popular-热度正序",
                ],
                notShowWhen: null,
                showWhen: null
            }
        ]
    }

    search = {
        load: async (keyword, options, page) => {
            keyword = encodeURIComponent(keyword)
            var res = await Network.get(
                `https://api.copymanga.tv/api/v3/search/comic?limit=21&offset=${(page - 1) * 21}&q=${keyword}&q_type=&platform=3`,
                this.headers
            )
            if (res.status !== 200) {
                throw `Invalid status code: ${res.status}`
            }

            let data = JSON.parse(res.body)

            function parseComic(comic) {
                if (comic["comic"] !== null && comic["comic"] !== undefined) {
                    comic = comic["comic"]
                }
                let tags = []
                if (comic["theme"] !== null && comic["theme"] !== undefined) {
                    tags = comic["theme"].map(t => t["name"])
                }
                let author = null

                if (Array.isArray(comic["author"]) && comic["author"].length > 0) {
                    author = comic["author"][0]["name"]
                }

                return {
                    id: comic["path_word"],
                    title: comic["name"],
                    subTitle: author,
                    cover: comic["cover"],
                    tags: tags,
                    description: comic["datetime_updated"]
                }
            }

            return {
                comics: data["results"]["list"].map(parseComic),
                maxPage: (data["results"]["total"] - (data["results"]["total"] % 21)) / 21 + 1
            }
        },
        /*
        optionList: [
            {
                options: [
                    "0-time",
                    "1-popular"
                ],
                label: "sort"
            }
        ]
        */
        optionList: []
    }

    favorites = {
        multiFolder: false,
        addOrDelFavorite: async (comicId, folderId, isAdding) => {
            let is_collect = isAdding ? 1 : 0
            let token = this.loadData("token");
            let comicData = await Network.get(
                `https://api.copymanga.tv/api/v3/comic2/${comicId}?platform=3`,
                this.headers
            )
            if (comicData.status !== 200) {
                throw `Invalid status code: ${comicData.status}`
            }
            let comic_id = JSON.parse(comicData.body).results.comic.uuid
            let res = await Network.post(
                "https://api.copymanga.tv/api/v3/member/collect/comic?platform=3",
                {
                    ...this.headers,
                    "Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
                },
                `comic_id=${comic_id}&is_collect=${is_collect}&authorization=Token+${token}`
            )
            if (res.status === 401) {
                throw `Login expired`;
            }
            if (res.status !== 200) {
                throw `Invalid status code: ${res.status}`
            }
            return "ok"
        },
        loadComics: async (page, folder) => {
            var res = await Network.get(
                `https://api.copymanga.tv/api/v3/member/collect/comics?limit=21&offset=${(page - 1) * 21}&free_type=1&ordering=-datetime_updated&platform=3`,
                this.headers
            )

            if (res.status === 401) {
                throw `Login expired`
            }

            if (res.status !== 200) {
                throw `Invalid status code: ${res.status}`
            }

            let data = JSON.parse(res.body)

            function parseComic(comic) {
                if (comic["comic"] !== null && comic["comic"] !== undefined) {
                    comic = comic["comic"]
                }
                let tags = []
                if (comic["theme"] !== null && comic["theme"] !== undefined) {
                    tags = comic["theme"].map(t => t["name"])
                }
                let author = null

                if (Array.isArray(comic["author"]) && comic["author"].length > 0) {
                    author = comic["author"][0]["name"]
                }

                return {
                    id: comic["path_word"],
                    title: comic["name"],
                    subTitle: author,
                    cover: comic["cover"],
                    tags: tags,
                    description: comic["datetime_updated"]
                }
            }

            return {
                comics: data["results"]["list"].map(parseComic),
                maxPage: (data["results"]["total"] - (data["results"]["total"] % 21)) / 21 + 1
            }
        }
    }

    comic = {
        loadInfo: async (id) => {
            async function getChapters(id) {
                var res = await Network.get(
                    `https://api.copymanga.tv/api/v3/comic/${id}/group/default/chapters?limit=500&offset=0&platform=3`,
                    this.headers
                );
                if (res.status !== 200) {
                    throw `Invalid status code: ${res.status}`;
                }
                let data = JSON.parse(res.body);
                let eps = new Map();
                data.results.list.forEach((e) => {
                    let title = e.name;
                    let id = e.uuid;
                    eps.set(id, title);
                });
                let maxChapter = data.results.total;
                if (maxChapter > 500) {
                    let offset = 500;
                    while (offset < maxChapter) {
                        res = await Network.get(
                            `https://api.copymanga.tv/api/v3/comic/chongjingchengweimofashaonv/group/default/chapters?limit=500&offset=${offset}&platform=3`,
                            this.headers
                        );
                        if (res.status !== 200) {
                            throw `Invalid status code: ${res.status}`;
                        }
                        data = JSON.parse(res.body);
                        data.results.list.forEach((e) => {
                            let title = e.name;
                            let id = e.uuid;
                            eps.set(id, title)
                        });
                        offset += 500;
                    }
                }
                return eps;
            }

            async function getFavoriteStatus(id) {
                let res = await Network.get(`https://api.copymanga.tv/api/v3/comic2/${id}/query?platform=3`, this.headers);
                if (res.status !== 200) {
                    throw `Invalid status code: ${res.status}`;
                }
                return JSON.parse(res.body).results.collect != null;
            }

            let results = await Promise.all([
                Network.get(
                    `https://api.copymanga.tv/api/v3/comic2/${id}?platform=3`,
                    this.headers
                ),
                getChapters.bind(this)(id),
                getFavoriteStatus.bind(this)(id)
            ])

            if (results[0].status !== 200) {
                throw `Invalid status code: ${res.status}`;
            }

            let comicData = JSON.parse(results[0].body).results.comic;

            let title = comicData.name;
            let cover = comicData.cover;
            let authors = comicData.author.map(e => e.name);
            let tags = comicData.theme.map(e => e.name);
            let updateTime = comicData.datetime_updated;
            let description = comicData.brief;


            return {
                title: title,
                cover: cover,
                description: description,
                tags: {
                    "作者": authors,
                    "更新": [updateTime],
                    "标签": tags
                },
                chapters: results[1],
                isFavorite: results[2],
                subId: comicData.uuid
            }
        },
        loadEp: async (comicId, epId) => {
            let res = await Network.get(
                `https://api.copymanga.tv/api/v3/comic/${comicId}/chapter2/${epId}?platform=3`,
                this.headers
            );

            if (res.status !== 200){
                throw `Invalid status code: ${res.status}`;
            }

            let data = JSON.parse(res.body);

            let imagesUrls = data.results.chapter.contents.map(e => e.url)

            let orders = data.results.chapter.words

            let images = imagesUrls.map(e => "")

            for(let i=0; i < imagesUrls.length; i++){
                images[orders[i]] = imagesUrls[i]
            }

            return {
                images: images
            }
        },
        loadComments: async (comicId, subId, page, replyTo) => {
            let url = `https://api.copymanga.tv/api/v3/comments?comic_id=${subId}&limit=20&offset=${(page-1)*20}`;
            if(replyTo){
                url = url + `&reply_id=${replyTo}&_update=true`;
            }
            let res = await Network.get(
                url,
                this.headers,
            );

            if (res.status !== 200){
                throw `Invalid status code: ${res.status}`;
            }

            let data = JSON.parse(res.body);

            let total = data.results.total;

            return {
                comments: data.results.list.map(e => {
                    return {
                        userName: e.user_name,
                        avatar: e.user_avatar,
                        content: e.comment,
                        time: e.create_at,
                        replyCount: e.count,
                        id: e.id,
                    }
                }),
                maxPage: (total - (total % 20)) / 20 + 1,
            }
        },
        sendComment: async (comicId, subId, content, replyTo) => {
            let token = this.loadData("token");
            if(!token){
                throw "未登录"
            }
            if(!replyTo){
                replyTo = '';
            }
            let res = await Network.post(
                `https://api.copymanga.tv/api/v3/member/comment`,
                {
                    ...this.headers,
                    "Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
                },
                `comic_id=${subId}&comment=${encodeURIComponent(content)}&reply_id=${replyTo}`,
            );

            if (res.status === 401){
                error(`Login expired`);
                return;
            }

            if (res.status !== 200){
                throw `Invalid status code: ${res.status}`;
            } else {
                return "ok"
            }
        }
    }
}
