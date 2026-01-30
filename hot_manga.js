/** @type {import('./_venera_.js')} */

/**
 * 修改自 https://github.com/venera-app/venera-configs/blob/main/copy_manga.js 38ec0f2aa14fe6dbb6a768c838297d609ea611d4
 */

class HotManga extends ComicSource {

    name = "热辣漫画"

    key = "hot_manga"

    version = "1.0.0"

    minAppVersion = "1.6.0"

    url = "https://cdn.jsdelivr.net/gh/venera-app/venera-configs@main/hot_manga.js";

    static defaultImageQuality = "1500"

    static defaultApiUrl = 'api.2024manga.com'

    get headers() {
        return {
            "Authorization": this.loadData('token') ? `Token ${this.loadData('token')}` : '',
            "Accept": "application/json",
            "webp": "1",
            "platform": "3",
            "version": "2024.04.28",
            "X-Requested-With": "com.manga2020.app",
        }
    }

    get apiUrl() {
        return `https://${this.loadSetting('base_url')}`
    }

    get imageQuality() {
        return this.loadSetting('image_quality') || HotManga.defaultImageQuality
    }

    init() {
        this.author_path_word_dict = {}
    }

    account = {
        login: async (account, pwd) => {
            let salt = randomInt(1000, 9999)
            let base64 = Convert.encodeBase64(Convert.encodeUtf8(`${pwd}-${salt}`))
            let res = await Network.post(
                `${this.apiUrl}/api/v3/login`,
                {
                    "Content-Type": "application/x-www-form-urlencoded;charset=utf-8"
                },
                `username=${account}&password=${base64}&salt=${salt}&source=Official&version=2.2.0&platform=3`
            );
            if (res.status === 200) {
                let data = JSON.parse(res.body)
                let token = data.results.token
                this.saveData('token', token)
                return "ok"
            } else {
                throw `Invalid Status Code ${res.status}`
            }
        },

        logout: () => {
            this.deleteData('token')
        },

        registerWebsite: "https://www.manga2026.com/web/login/loginByAccount"
    }

    explore = [
        {
            title: "热辣漫画",
            type: "singlePageWithMultiPart",
            load: async () => {
                let dataStr = await Network.get(
                    `${this.apiUrl}/api/v3/h5/homeIndex`,
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
                res["推荐漫画"] = data["results"]["recComics"]["list"].map(parseComic)
                res["每周免费漫画排行"] = data["results"]["rankWeeklyFreeComics"]["list"].map(parseComic)
                res["每周付费漫画排行"] = data["results"]["rankWeeklyChargeComics"]["list"].map(parseComic)
                res["付费漫画更新"] = data["results"]["updateWeeklyChargeComics"]["list"].map(parseComic)
                res["免费漫画更新"] = data["results"]["updateWeeklyFreeComics"]["list"].map(parseComic)
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
        "其他": "qita",
        "悬疑": "xuanyi",
        "TL": "teenslove",
        "萌系": "mengxi",
        "神鬼": "shengui",
        "职场": "zhichang",
        "治愈": "zhiyu",
        "节操": "jiecao",
        "四格": "sige",
        "長條": "changtiao",
        "舰娘": "jianniang",
        "搞笑": "gaoxiao",
        "竞技": "jingji",
        "伪娘": "weiniang",
        "魔幻": "mohuan",
        "热血": "rexue",
        "性转换": "xingzhuanhuan",
        "美食": "meishi",
        "励志": "lizhi",
        "彩色": "COLOR",
        "後宮": "hougong",
        "侦探": "zhentan",
        "惊悚": "jingsong",
        "AA": "aa",
        "音乐舞蹈": "yinyuewudao",
        "异世界": "yishijie",
        "战争": "zhanzheng",
        "历史": "lishi",
        "机战": "jizhan",
        "都市": "dushi",
        "穿越": "chuanyue",
        "恐怖": "kongbu",
        "生存": "shengcun",
        "武侠": "wuxia",
        "宅系": "zhaixi",
        "转生": "zhuansheng",
        "無修正": "Uncensored",
        "仙侠": "xianxia",
        "LoveLive": "loveLive",

        // Comiket
        "C95": "comiket95",
        "C96": "comiket96",
        "C97": "comiket97",
        "C98": "C98",
        "C99": "comiket99",
        "C100": "comiket100",
        "C101": "comiket101",
        "C102": "comiket102",
        "C103": "comiket103",
        "C104": "comiket104",
        "C105": "comiket105",

        // 其他
        "玄幻": "xuanhuan",
        "異能": "yineng",
        "遊戲": "youxi",
        "真人": "zhenren",
        "雜誌附贈寫真集": "zazhifuzengxiezhenji",
        "FATE": "fate"
    }

    static homepage_param_dict = {
        "全彩": "color",
        "韩漫": "korea",
        "单行本": "volume",
        "已完结": "finish",
        "同志": "yaoi"
    }

    category = {
        title: "热辣漫画",
        parts: [
            {
                name: "免费漫画排行",
                type: "fixed",
                categories: ["排行"],
                categoryParams: ["ranking"],
                itemType: "category"
            },
            {
                name: "免费漫画主题",
                type: "fixed",
                categories: Object.keys(HotManga.category_param_dict),
                categoryParams: Object.values(HotManga.category_param_dict),
                itemType: "category"
            },
            {
                name: "主页",
                type: "fixed",
                categories: Object.keys(HotManga.homepage_param_dict),
                categoryParams: Object.values(HotManga.homepage_param_dict),
                itemType: "category"
            }
        ]
    }

    categoryComics = {
        load: async (category, param, options, page) => {
            let category_url;
            // 分类-排行
            if (category === "排行" || param === "ranking") {
                category_url = `${this.apiUrl}/api/v3/ranks?free_type=1&limit=30&offset=${(page - 1) * 30}&_update=true&type=1&region=${options[0]}&date_type=${options[1]}`
            } else if (Object.keys(HotManga.homepage_param_dict).includes(category)) {
                // 主页
                category_url = `${this.apiUrl}/api/v3/h5/homeIndex/comics?limit=20&offset=${(page - 1) * 20}&top=${param}&ordering=${options[0]}`
            } else {
                // 分类-主题
                if (category !== undefined && category !== null) {
                    // 若传入category，则转化为对应param
                    param = HotManga.category_param_dict[category] || "";
                }
                options = options.map(e => e.replace("*", "-"))
                category_url = `${this.apiUrl}/api/v3/comics?free_type=1&limit=30&offset=${(page - 1) * 30}&ordering=${options[0]}&theme=${param}`
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
                    "-非韩漫",
                    "1-韩漫",
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
            },
            {
                options: [
                    "*datetime_updated-时间倒序",
                    "datetime_updated-时间正序",
                    "*popular-热度倒序",
                    "popular-热度正序",
                ],
                notShowWhen: null,
                showWhen: Object.keys(HotManga.category_param_dict)
            },
            {
                options: [
                    "*datetime_updated-时间倒序",
                    "datetime_updated-时间正序",
                    "*popular-热度倒序",
                    "popular-热度正序",
                ],
                notShowWhen: null,
                showWhen: Object.keys(HotManga.homepage_param_dict)
            },
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
                    `${this.apiUrl}/api/v3/comics?limit=30&offset=${(page - 1) * 30}&ordering=-datetime_updated&author=${path_word}`,
                    this.headers
                )
            } else {
                res = await Network.get(
                    `${this.apiUrl}/api/v3/search/comic?platform=3&q=${encodeURIComponent(keyword)}&limit=20&offset=${(page - 1) * 20}&free_type=1&_update=true`,
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

    }

    favorites = {
        multiFolder: false,
        addOrDelFavorite: async (comicId, folderId, isAdding) => {
            let is_collect = isAdding ? 1 : 0
            let token = this.loadData("token");

            let comicData = await Network.get(
                `${this.apiUrl}/api/v3/comic2/${comicId}?in_mainland=true&platform=3`,
                this.headers
            )
            if (comicData.status !== 200) {
                throw `Invalid status code: ${comicData.status}`
            }
            let comic_id = JSON.parse(comicData.body).results.comic.uuid
            let res = await Network.post(
                `${this.apiUrl}/api/v3/member/collect/comic`,
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
            let ordering = this.loadSetting('favorites_ordering') || '-datetime_updated';
            var res = await Network.get(
                `${this.apiUrl}/api/v3/member/collect/comics?limit=30&offset=${(page - 1) * 30}&free_type=1&ordering=${ordering}`,
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
                        `${this.apiUrl}/api/v3/comic/${id}/group/${path}/chapters?limit=100&offset=0`,
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
                    if (maxChapter > 100) {
                        let offset = 100;
                        while (offset < maxChapter) {
                            res = await Network.get(
                                `${this.apiUrl}/api/v3/comic/${id}/group/${path}/chapters?limit=100&offset=${offset}`,
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
                            offset += 100;
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
                let res = await Network.get(`${this.apiUrl}/api/v3/comic2/${id}/query`, this.headers);
                if (res.status !== 200) {
                    throw `Invalid status code: ${res.status}`;
                }
                return JSON.parse(res.body).results.collect != null;
            }

            let results = await Promise.all([
                Network.get(
                    `${this.apiUrl}/api/v3/comic2/${id}?in_mainland=true&platform=3`,
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
                        `${this.apiUrl}/api/v3/comic/${comicId}/chapter/${epId}?platform=3&_update=true`,
                        {
                            ...this.headers
                        }
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

                    // Replace origin images urls to selected quality images urls
                    let hdImagesUrls = imagesUrls.map((url) =>
                        url.replace(
                            /\.jpg\.h\d+x\.jpg$/,
                            `.jpg.h${this.imageQuality}x.jpg`
                        )
                    )

                    return {
                        images: hdImagesUrls,
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
        favorites_ordering: {
            title: "收藏排序方式",
            type: "select",
            options: [
                {
                    value: '-datetime_updated',
                    text: '更新时间'
                },
                {
                    value: '-datetime_modifier',
                    text: '收藏时间'
                },
                {
                    value: '-datetime_browse',
                    text: '阅读时间'
                }
            ],
            default: '-datetime_updated',
        },

        image_quality: {
            title: "图片质量",
            type: "select",
            options: [
                {
                    value: '800',
                    text: '低 (800)'
                },
                {
                    value: '1200',
                    text: '中 (1200)'
                },
                {
                    value: '1500',
                    text: '高 (1500)'
                }
            ],
            default: HotManga.defaultImageQuality,
        },

        base_url: {
            title: "API地址",
            type: "input",
            validator: '^(?!:\\/\\/)(?=.{1,253})([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\\.)+[a-zA-Z]{2,}$',
            default: HotManga.defaultApiUrl,
        },

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
