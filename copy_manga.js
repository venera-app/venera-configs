class CopyManga extends ComicSource {

    name = "拷贝漫画"

    key = "copy_manga"

    version = "1.1.4"

    minAppVersion = "1.2.1"

    url = "https://cdn.jsdelivr.net/gh/venera-app/venera-configs@main/copy_manga.js"

    headers = {}

    static copyVersion = "2.2.6"

    static apiUrl = "https://api.mangacopy.com"

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
        // 用于储存 { 作者名 : 英文参数 }
        this.author_path_word_dict = {}
    }

    /// account
    /// set this to null to desable account feature
    account = {
        /// login func
        login: async (account, pwd) => {
            let salt = randomInt(1000, 9999)
            let base64 = Convert.encodeBase64(Convert.encodeUtf8(`${pwd}-${salt}`))
            let res = await Network.post(
                `${CopyManga.apiUrl}/api/v3/login?platform=3`,
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
        registerWebsite: "https://www.mangacopy.com/web/login/loginByAccount"
    }

    /// explore pages
    explore = [
        {
            title: "拷贝漫画",
            type: "singlePageWithMultiPart",
            load: async () => {
                let dataStr = await Network.get(
                    `${CopyManga.apiUrl}/api/v3/h5/homeIndex?platform=3`,
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

    static category_param_dict = {
        "全部": "",
        "愛情": "aiqing",
        "歡樂向": "huanlexiang",
        "冒險": "maoxian",
        "奇幻": "qihuan",
        "百合": "baihe",
        "校园": "xiaoyuan",
        "科幻": "kehuan",
        "東方": "dongfang",
        "耽美": "danmei",
        "生活": "shenghuo",
        "格鬥": "gedou",
        "轻小说": "qingxiaoshuo",
        "悬疑": "xuanyi",
        "其他": "qita",
        "神鬼": "shengui",
        "职场": "zhichang",
        "TL": "teenslove",
        "萌系": "mengxi",
        "治愈": "zhiyu",
        "長條": "changtiao",
        "四格": "sige",
        "节操": "jiecao",
        "舰娘": "jianniang",
        "竞技": "jingji",
        "搞笑": "gaoxiao",
        "伪娘": "weiniang",
        "热血": "rexue",
        "励志": "lizhi",
        "性转换": "xingzhuanhuan",
        "彩色": "COLOR",
        "後宮": "hougong",
        "美食": "meishi",
        "侦探": "zhentan",
        "AA": "aa",
        "音乐舞蹈": "yinyuewudao",
        "魔幻": "mohuan",
        "战争": "zhanzheng",
        "历史": "lishi",
        "异世界": "yishijie",
        "惊悚": "jingsong",
        "机战": "jizhan",
        "都市": "dushi",
        "穿越": "chuanyue",
        "恐怖": "kongbu",
        "C100": "comiket100",
        "重生": "chongsheng",
        "C99": "comiket99",
        "C101": "comiket101",
        "C97": "comiket97",
        "C96": "comiket96",
        "生存": "shengcun",
        "宅系": "zhaixi",
        "武侠": "wuxia",
        "C98": "C98",
        "C95": "comiket95",
        "FATE": "fate",
        "转生": "zhuansheng",
        "無修正": "Uncensored",
        "仙侠": "xianxia",
        "LoveLive": "loveLive"
    }

    category = {
        title: "拷贝漫画",
        parts: [
            {
                name: "拷贝漫画",
                type: "fixed",
                categories: ["排行"],
                categoryParams: ["ranking"],
                itemType: "category"
            },
            {
                name: "主题",
                type: "fixed",
                categories: Object.keys(CopyManga.category_param_dict),
                categoryParams: Object.values(CopyManga.category_param_dict),
                itemType: "category"
            }
        ]
    }

    categoryComics = {
        load: async (category, param, options, page) => {
            let category_url;
            // 分类-排行
            if (category === "排行" || param === "ranking") {
                category_url = `${CopyManga.apiUrl}/api/v3/ranks?limit=21&offset=${(page - 1) * 21}&_update=true&type=1&audience_type=${options[0]}&date_type=${options[1]}`
            } else {
                // 分类-主题
                if (category !== undefined && category !== null) {
                    // 若传入category，则转化为对应param
                    param = CopyManga.category_param_dict[category] || "";
                }
                options = options.map(e => e.replace("*", "-"))
                category_url = `${CopyManga.apiUrl}/api/v3/comics?limit=21&offset=${(page - 1) * 21}&ordering=${options[1]}&theme=${param}&top=${options[0]}&platform=3`
            }


            let res = await Network.get(
                category_url,
                this.headers
            )
            if (res.status !== 200) {
                throw `Invalid status code: ${res.status}`
            }

            let data = JSON.parse(res.body)

            function parseComic(comic) {
                //判断是否是漫画排名格式
                let sort = null
                let popular = 0
                let rise_sort = 0;
                if (comic["sort"] !== null && comic["sort"] !== undefined) {
                    sort = comic["sort"]
                    rise_sort = comic["rise_sort"]
                    popular = comic["popular"]
                }

                if (comic["comic"] !== null && comic["comic"] !== undefined) {
                    comic = comic["comic"]
                }
                let tags = []
                if (comic["theme"] !== null && comic["theme"] !== undefined) {
                    tags = comic["theme"].map(t => t["name"])
                }
                let author = null
                let author_num = 0
                if (Array.isArray(comic["author"]) && comic["author"].length > 0) {
                    author = comic["author"][0]["name"]
                    author_num = comic["author"].length
                }

                //如果是漫画排名，则描述为 排名(+升降箭头)+作者+人气
                if (sort !== null) {
                    return {
                        id: comic["path_word"],
                        title: comic["name"],
                        subTitle: author,
                        cover: comic["cover"],
                        tags: tags,
                        description: `${sort} ${rise_sort > 0 ? '▲' : rise_sort < 0 ? '▽' : '-'}\n` +
                            `${author_num > 1 ? `${author} 等${author_num}位` : author}\n` +
                            `🔥${(popular / 10000).toFixed(1)}W`
                    }
                    //正常情况的描述为更新时间
                } else {
                    return {
                        id: comic["path_word"],
                        title: comic["name"],
                        subTitle: author,
                        cover: comic["cover"],
                        tags: tags,
                        description: comic["datetime_updated"]
                    }
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
                showWhen: Object.keys(CopyManga.category_param_dict)
            },
            {
                options: [
                    "*datetime_updated-时间倒序",
                    "datetime_updated-时间正序",
                    "*popular-热度倒序",
                    "popular-热度正序",
                ],
                notShowWhen: null,
                showWhen: Object.keys(CopyManga.category_param_dict)
            },
            {
                options: [
                    "male-男频",
                    "female-女频"
                ],
                notShowWhen: null,
                showWhen: ["排行"]
            },
            {
                options: [
                    "day-上升最快",
                    "week-最近7天",
                    "month-最近30天",
                    "total-總榜單"
                ],
                notShowWhen: null,
                showWhen: ["排行"]
            }
        ]
    }

    search = {
        load: async (keyword, options, page) => {
            let author;
            if (keyword.startsWith("作者:")) {
                author = keyword.substring("作者:".length).trim();
            }
            let res;
            // 通过onClickTag传入时有"作者:"前缀，处理这种情况
            if (author && author in this.author_path_word_dict) {
                let path_word = encodeURIComponent(this.author_path_word_dict[author]);
                res = await Network.get(
                    `${CopyManga.apiUrl}/api/v3/comics?limit=21&offset=${(page - 1) * 21}&ordering=-datetime_updated&author=${path_word}&platform=3`,
                    this.headers
                )
            }
            // 一般的搜索情况
            else {
                let q_type = "";
                if (options && options[0]) {
                    q_type = options[0];
                }
                keyword = encodeURIComponent(keyword)
                let search_url = this.loadSetting('search_api') === "webAPI" ? "https://www.mangacopy.com/api/kb/web/searchbd/comics" : `${CopyManga.apiUrl}/api/v3/search/comic`
                res = await Network.get(
                    `${search_url}?limit=21&offset=${(page - 1) * 21}&q=${keyword}&q_type=${q_type}&platform=3`,
                    this.headers
                )
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
        },
        optionList: [
            {
                type: "select",
                options: [
                    "-全部",
                    "name-名称",
                    "author-作者",
                    "local-汉化组"
                ],
                label: "搜索选项"
            }
        ]
    }

    favorites = {
        multiFolder: false,
        addOrDelFavorite: async (comicId, folderId, isAdding) => {
            let is_collect = isAdding ? 1 : 0
            let token = this.loadData("token");
            let comicData = await Network.get(
                `${CopyManga.apiUrl}/api/v3/comic2/${comicId}?platform=3`,
                this.headers
            )
            if (comicData.status !== 200) {
                throw `Invalid status code: ${comicData.status}`
            }
            let comic_id = JSON.parse(comicData.body).results.comic.uuid
            let res = await Network.post(
                `${CopyManga.apiUrl}/api/v3/member/collect/comic?platform=3`,
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
                `${CopyManga.apiUrl}/api/v3/member/collect/comics?limit=21&offset=${(page - 1) * 21}&free_type=1&ordering=-datetime_updated&platform=3`,
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
            let getChapters = async (id, groups) => {
                let fetchSingle = async (id, path) => {
                    let res = await Network.get(
                        `${CopyManga.apiUrl}/api/v3/comic/${id}/group/${path}/chapters?limit=500&offset=0&platform=3`,
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
                                `${CopyManga.apiUrl}/api/v3/comic/chongjingchengweimofashaonv/group/${path}/chapters?limit=500&offset=${offset}&platform=3`,
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
                };
                let keys = Object.keys(groups);
                let result = {};
                let futures = [];
                for (let group of keys) {
                    let path = groups[group]["path_word"];
                    futures.push((async () => {
                        result[group] = await fetchSingle(id, path);
                    })());
                }
                await Promise.all(futures);
                if (this.isAppVersionAfter("1.3.0")) {
                    // 支持多分组
                    let sortedResult = new Map();
                    for (let key of keys) {
                        let name = groups[key]["name"];
                        sortedResult.set(name, result[key]);
                    }
                    return sortedResult;
                } else {
                    // 合并所有分组
                    let merged = new Map();
                    for (let key of keys) {
                        for (let [k, v] of result[key]) {
                            merged.set(k, v);
                        }
                    }
                    return merged;
                }
            }

            let getFavoriteStatus = async (id) => {
                let res = await Network.get(`${CopyManga.apiUrl}/api/v3/comic2/${id}/query?platform=3`, this.headers);
                if (res.status !== 200) {
                    throw `Invalid status code: ${res.status}`;
                }
                return JSON.parse(res.body).results.collect != null;
            }

            let results = await Promise.all([
                Network.get(
                    `${CopyManga.apiUrl}/api/v3/comic2/${id}?platform=3`,
                    this.headers
                ),
                getFavoriteStatus.bind(this)(id)
            ])

            if (results[0].status !== 200) {
                throw `Invalid status code: ${res.status}`;
            }

            let data = JSON.parse(results[0].body).results;
            let comicData = data.comic;

            let title = comicData.name;
            let cover = comicData.cover;
            let authors = comicData.author.map(e => e.name);
            // author_path_word_dict长度限制为最大100
            if (Object.keys(this.author_path_word_dict).length > 100) {
                this.author_path_word_dict = {};
            }
            // 储存author对应的path_word
            comicData.author.forEach(e => (this.author_path_word_dict[e.name] = e.path_word));
            let tags = comicData.theme.map(e => e?.name).filter(name => name !== undefined && name !== null);
            let updateTime = comicData.datetime_updated ? comicData.datetime_updated : "";
            let description = comicData.brief;
            let chapters = await getChapters(id, data.groups);
            let status = comicData.status.display;

            return {
                title: title,
                cover: cover,
                description: description,
                tags: {
                    "作者": authors,
                    "更新": [updateTime],
                    "标签": tags,
                    "状态": [status],
                },
                chapters: chapters,
                isFavorite: results[1],
                subId: comicData.uuid
            }
        },
        loadEp: async (comicId, epId) => {
            let attempt = 0;
            const maxAttempts = 5;
            let res;
            let data;

            while (attempt < maxAttempts) {
                try {
                    res = await Network.get(
                        `${CopyManga.apiUrl}/api/v3/comic/${comicId}/chapter2/${epId}?platform=3`,
                        this.headers
                    );

                    if (res.status === 210) {
                        // 210 indicates too frequent access, extract wait time
                        let waitTime = 40000; // Default wait time 40s
                        try {
                            let responseBody = JSON.parse(res.body);
                            if (
                                responseBody.message &&
                                responseBody.message.includes("Expected available in")
                            ) {
                                let match = responseBody.message.match(/(\d+)\s*seconds/);
                                if (match && match[1]) {
                                    waitTime = parseInt(match[1]) * 1000;
                                }
                            }
                        } catch (e) {
                            console.log(
                                "Unable to parse wait time, using default wait time 40s"
                            );
                        }
                        console.log(`Chapter${epId} access too frequent, waiting ${waitTime / 1000}s`);
                        await new Promise((resolve) => setTimeout(resolve, waitTime));
                        throw "Retry";
                    }

                    if (res.status !== 200) {
                        throw `Invalid status code: ${res.status}`;
                    }

                    data = JSON.parse(res.body);
                    // console.log(data.results.chapter);
                    // Handle image link sorting
                    let imagesUrls = data.results.chapter.contents.map((e) => e.url);
                    let orders = data.results.chapter.words;

                    let images = new Array(imagesUrls.length).fill(""); // Initialize an array with the same length as imagesUrls

                    // Arrange images according to orders
                    for (let i = 0; i < imagesUrls.length; i++) {
                        images[orders[i]] = imagesUrls[i];
                    }

                    return {
                        images: images,
                    };
                } catch (error) {
                    if (error !== "Retry") {
                        throw error;
                    }
                    attempt++;
                    if (attempt >= maxAttempts) {
                        throw error;
                    }
                }
            }
        },
        loadComments: async (comicId, subId, page, replyTo) => {
            let url = `${CopyManga.apiUrl}/api/v3/comments?comic_id=${subId}&limit=20&offset=${(page - 1) * 20}`;
            if (replyTo) {
                url = url + `&reply_id=${replyTo}&_update=true`;
            }
            let res = await Network.get(
                url,
                this.headers,
            );

            if (res.status !== 200) {
                if(res.status === 210){
                    throw "210：注冊用戶一天可以發5條評論"
                }
                throw `Invalid status code: ${res.status}`;
            }

            let data = JSON.parse(res.body);

            let total = data.results.total;

            return {
                comments: data.results.list.map(e => {
                    return {
                        userName: replyTo ? `${e.user_name}  👉  ${e.parent_user_name}` : e.user_name, // 拷贝的回复页并没有楼中楼（所有回复都在一个response中），但会显示谁回复了谁。所以加上👉显示。
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
            if (!token) {
                throw "未登录"
            }
            if (!replyTo) {
                replyTo = '';
            }
            let res = await Network.post(
                `${CopyManga.apiUrl}/api/v3/member/comment`,
                {
                    ...this.headers,
                    "Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
                },
                `comic_id=${subId}&comment=${encodeURIComponent(content)}&reply_id=${replyTo}`,
            );

            if (res.status === 401) {
                error(`Login expired`);
                return;
            }

            if (res.status !== 200) {
                throw `Invalid status code: ${res.status}`;
            } else {
                return "ok"
            }
        },
        onClickTag: (namespace, tag) => {
            if (namespace === "标签") {
                return {
                    // 'search' or 'category'
                    action: 'category',
                    keyword: `${tag}`,
                    // {string?} only for category action
                    param: null,
                }
            }
            if (namespace === "作者") {
                return {
                    // 'search' or 'category'
                    action: 'search',
                    keyword: `${namespace}:${tag}`,
                    // {string?} only for category action
                    param: null,
                }
            }
            throw "未支持此类Tag检索"
        }
    }

    settings = {
        search_api: {
            // title
            title: "搜索方式",
            // type: input, select, switch
            type: "select",
            // options
            options: [
                {
                    value: 'baseAPI',
                    text: '基础API'
                },
                {
                    value: 'webAPI',
                    text: '网页端API（可搜屏蔽作）'
                }
            ],
            default: 'baseAPI'
        }
    }

    /**
     * Check if the current app version is after the target version
     * @param target {string} target version
     * @returns {boolean} true if the current app version is after the target version
     */
    isAppVersionAfter(target) {
        let current = APP.version
        let targetArr = target.split('.')
        let currentArr = current.split('.')
        for (let i = 0; i < 3; i++) {
            if (parseInt(currentArr[i]) < parseInt(targetArr[i])) {
                return false
            }
        }
        return true
    }
}
