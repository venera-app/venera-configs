class CopyManga extends ComicSource {

    name = "拷贝漫画v2"

    key = "copy_manga"

    version = "1.3.6"

    minAppVersion = "1.2.1"

    url = "https://git.nyne.dev/nyne/venera-configs/raw/branch/main/copy_mangav2.js"

    get headers() {
        let token = this.loadData("token");
        if (!token) {
            token = "";
        } else {
            token = " " + token;
        }
        const userAgents = [
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/114.0",
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:110.0) Gecko/20100101 Firefox/115.0",
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36"
        ];
        const randomUA = userAgents[Math.floor(Math.random() * userAgents.length)];
        
        return {
            "User-Agent": randomUA,
            "Origin": "https://www.2025copy.com/",
            "Accept": "application/json",
            "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
            "Accept-Encoding": "gzip, deflate, br",
            "Connection": "keep-alive",
            "authorization": `Token${token}`,
        }
    }
    static defaultCopyRegion = "1"
    static defaultImageQuality = "1500"
    static defaultApiUrl = 'mapi.copy20.com'
    static searchApi = "/api/kb/web/searchb/comics"
    get apiUrl() {
        return `https://${this.loadSetting('base_url')}`
    }

    get copyRegion() {
        return this.loadSetting('region') || this.defaultCopyRegion
    }

    get imageQuality() {
        return this.loadSetting('image_quality') || this.defaultImageQuality
    }

    get requestDelay() {
        return parseInt(this.loadSetting('request_delay')) || 1000
    }

    init() {
        this.author_path_word_dict = {}
        this.refreshSearchApi()
    }


    account = {
        login: async (account, pwd) => {
            let salt = randomInt(1000, 9999)
            let base64 = Convert.encodeBase64(Convert.encodeUtf8(`${pwd}-${salt}`))
            let res = await Network.post(
                `${this.apiUrl}/api/v3/login`,
                {
                    ...this.headers,
                    "Content-Type": "application/x-www-form-urlencoded;charset=utf-8"
                },
                `username=${account}&password=${base64}\n&salt=${salt}&authorization=Token+`
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
        registerWebsite: null
    }

    explore = [
        {
            title: "拷贝漫画V2",
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
        title: "拷贝漫画V2",
        parts: [
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
            let web_url;
            if (category === "排行" || param === "ranking") {
                web_url = `https://www.2025copy.com/rank?audience_type=${options[0]}&date_type=${options[1]}&offset=${(page - 1) * 50}&limit=50`;
            } else {
                if (category !== undefined && category !== null) {
                    param = CopyManga.category_param_dict[category] || "";
                }
                options = options.map(e => e.replace("*", "-"));
                let ordering = options[1] || "-datetime_updated";
                web_url = `https://www.2025copy.com/comics?theme=${param}&region=${options[0]}&ordering=${ordering}&status=${options[2]}&offset=${(page - 1) * 50}&limit=50`;
            }

            let res = await Network.get(
                web_url,
                {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
                    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
                    "Accept-Encoding": "gzip, deflate, br",
                    "Connection": "keep-alive",
                    "Cache-Control": "max-age=0",
                    "Upgrade-Insecure-Requests": "1",
                }
            )

            if (res.status !== 200) {
                throw `error request: ${res.status}`;
            }

            const htmlContent = res.body;
            
            let comicListMatch = htmlContent.match(/list="(.*?)"/);
            if (!comicListMatch || !comicListMatch[1]) {
                const scriptMatch = htmlContent.match(/const free_list = (.*?);/);
                if (scriptMatch && scriptMatch[1]) {
                    comicListMatch = [null, scriptMatch[1]];
                } else {
                    throw "error to get content";
                }
            }
            
            let comicListStr = comicListMatch[1]
                .replace(/&#x27;/g, "'")
                .replace(/&quot;/g, '"');
            
            try {
                let fixedStr = comicListStr
                    .replace(/'/g, '"')              
                    .replace(/\\\\/g, '\\')         
                    .replace(/\\"/g, '"')            
                    .replace(/([,{])\s*([a-zA-Z0-9_]+):/g, '$1"$2":') 
                    .replace(/:\s*([a-zA-Z0-9_]+)([,}])/g, ':"$1"$2') 
                    .replace(/,\s*}/g, '}');     
                
                let comicList;
                try {
                    comicList = JSON.parse(fixedStr);
                } catch (e) {
                    comicList = eval('(' + comicListStr + ')');
                }
                
                if (!Array.isArray(comicList)) {
                    throw new Error("JSON ERROR");
                }
                
                let totalPagesMatch = htmlContent.match(/page-total">\/([\d]+)<\/li>/);
                let totalPages = totalPagesMatch ? parseInt(totalPagesMatch[1]) : 1;
                
                let totalComicsMatch = htmlContent.match(/total="([\d]+)"/);
                let totalComics = totalComicsMatch ? parseInt(totalComicsMatch[1]) : 0;
                
                let comics = comicList.map(comic => {
                    let author = null;
                    let author_num = 0;
                    
                    if (Array.isArray(comic.author) && comic.author.length > 0) {
                        author = comic.author[0].name;
                        author_num = comic.author.length;
                        
                        comic.author.forEach(a => {
                            if (a.name && a.path_word) {
                                this.author_path_word_dict[a.name] = a.path_word;
                            }
                        });
                    }
                    
                    const statusMap = {
                        0: "连载中",
                        1: "已完结",
                        2: "单话"
                    };
                    
                    return {
                        id: comic.path_word,
                        title: comic.name,
                        subTitle: author,
                        cover: comic.cover,
                        tags: [], 
                        description: author_num > 1 ? `${author} 等${author_num}位` : author,
                        status: statusMap[comic.status] || "未知"
                    };
                });
                
                return {
                    comics: comics,
                    maxPage: totalPages,
                    total: totalComics
                };
            } catch (error) {
                throw ` ${error.message}`;
            }
        },
        optionList: [
            {
                options: [
                    "-全部",
                    "0-日漫",
                    "1-韩漫",
                    "2-美漫",
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
                    "-全部",
                    "0-连载",
                    "1-完结",
                    "2-短篇"
                ],
                notShowWhen: null,
                showWhen: Object.keys(CopyManga.category_param_dict)
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
            if (author) {
                let path_word = encodeURIComponent(author);
                let search_url = this.loadSetting('search_api') === "webAPI"
                    ? `https://www.2025copy.com${CopyManga.searchApi}`
                    : `${this.apiUrl}/api/v3/search/comic`
                res = await Network.get(
                    `${search_url}?limit=30&offset=${(page - 1) * 30}&ordering=-datetime_updated&q=${path_word}&q_type=author`,
                    this.headers
                )
            }
            else {
                let q_type = "";
                if (options && options[0]) {
                    q_type = options[0];
                }
                keyword = encodeURIComponent(keyword)
                let search_url = this.loadSetting('search_api') === "webAPI"
                    ? `https://www.2025copy.com${CopyManga.searchApi}`
                    : `${this.apiUrl}/api/v3/search/comic`
                res = await Network.get(
                    `${search_url}?limit=30&offset=${(page - 1) * 30}&q=${keyword}&q_type=${q_type}`,
                    this.headers
                )
            }
            if (res.status !== 200) {
                throw `Invalid status code: ${res.status}// ${res.body}`;
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


    comic = {
        loadInfo: async (id) => {
            let getChapters = async (id, groups) => {

                let fetchSingle = async (id, path) => {
                    const randomDelay = Math.floor(Math.random() * (3000 - 2234 + 1)) + 2234;
                    setTimeout(() => {
                        console.log(`${randomDelay / 1000}`);
                    }, randomDelay);
                    let res = await Network.get(`https://mapi.copy20.com/api/v3/comic/${id}/group/${path}/chapters?limit=500&offset=0`, this.headers);
                    if (res.status !== 200) {
                        throw `${res.status}// ${res.body}`;
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
                            const randomDelay = Math.floor(Math.random() * (3000 - 2234 + 1)) + 2234;
                            setTimeout(() => {
                                console.log(`${randomDelay / 1000}`);
                            }, randomDelay);
                            
                            res = await fetchWithRetry(
                                `${this.apiUrl}/api/v3/comic/${id}/group/${path}/chapters?limit=500&offset=${offset}`
                            );
                            
                            data = JSON.parse(res.body);
                            data.results.list.forEach((e) => {
                                let title = e.name;
                                let id = e.uuid;
                                eps.set(id, title);
                            });
                            offset += 500;
                        }
                    }
                    return eps;
                };
                let keys = Object.keys(groups);
                let result = {};
                for (let group of keys) {
                    let path = groups[group]["path_word"];
                    console.log(`Loading chapters for group: ${groups[group]["name"]}`);
                    result[group] = await fetchSingle(id, path);
                }
                if (this.isAppVersionAfter("1.3.0")) {
                    let sortedResult = new Map();
                    for (let key of keys) {
                        let name = groups[key]["name"];
                        sortedResult.set(name, result[key]);
                    }
                    return sortedResult;
                } else {
                    let merged = new Map();
                    for (let key of keys) {
                        for (let [k, v] of result[key]) {
                            merged.set(k, v);
                        }
                    }
                    return merged;
                }
            }

            let results = await Network.get(`https://mapi.copy20.com/api/v3/comic2/${id}`, this.headers);

            if (results.status !== 200) {
                throw `${results.status}// ${results.body}`;
            }

            let data = JSON.parse(results.body).results;
            let comicData = data.comic;
            if (!comicData) {
                throw(data)
            }

            let title = comicData.name;
            let cover = comicData.cover;
            let authors = comicData.author.map(e => e.name);
            if (Object.keys(this.author_path_word_dict).length > 100) {
                this.author_path_word_dict = {};
            }
            comicData.author.forEach(e => (this.author_path_word_dict[e.name] = e.path_word));
            let tags = comicData.theme.map(e => e?.name).filter(name => name !== undefined && name !== null);
            let updateTime = comicData.datetime_updated ? comicData.datetime_updated : "";
            let description = comicData.brief;
            let status = comicData.status.display;
            const randomDelay = Math.floor(Math.random() * (3000 - 2234 + 1)) + 2234;
            setTimeout(() => {
                console.log(`${randomDelay / 1000}`);
            }, randomDelay);
            let chapters = await getChapters(id, data.groups);
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
                    if (attempt > 0) {
                        let baseDelay = this.requestDelay;
                        let delay = Math.random() * baseDelay + baseDelay * 0.5; 
                        await new Promise((resolve) => setTimeout(resolve, delay));
                    }                   
                    res = await Network.get(
                        `${this.apiUrl}/api/v3/comic/${comicId}/chapter2/${epId}`,
                        {
                            ...this.headers
                        }
                    );
                    if (res.status === 210) {
                        let waitTime = 40000; 
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
                        let randomExtra = Math.random() * 10000; 
                        waitTime += randomExtra;
                        
                        console.log(`Chapter${epId} access too frequent, waiting ${Math.ceil(waitTime / 1000)}s`);
                        await new Promise((resolve) => setTimeout(resolve, waitTime));
                        attempt++;
                        continue;
                    }

                    if (res.status !== 200) {
                        throw `Invalid status code: ${res.status}`;
                    }

                    data = JSON.parse(res.body);
                    let imagesUrls = data.results.chapter.contents.map((e) => e.url);
                    let orders = data.results.chapter.words;
                    let hdImagesUrls = imagesUrls.map((url) =>
                        url.replace(/([./])c\d+x\.[a-zA-Z]+$/, `$1c${this.imageQuality}x.webp`)
                    )

                    let images = new Array(hdImagesUrls.length).fill(""); // Initialize an array with the same length as imagesUrls
                    for (let i = 0; i < hdImagesUrls.length; i++) {
                        images[orders[i]] = hdImagesUrls[i];
                    }

                    return {
                        images: images,
                    };
                } catch (error) {
                    if (error === "Retry" || res?.status === 210) {
                        attempt++;
                        if (attempt >= maxAttempts) {
                            throw `Max retry attempts reached for chapter ${epId}`;
                        }
                        continue;
                    }
                    throw error;
                }
            }
        },
        loadComments: async (comicId, subId, page, replyTo) => {
            let url = `${this.apiUrl}/api/v3/comments?comic_id=${subId}&limit=20&offset=${(page - 1) * 20}`;
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
                `${this.apiUrl}/api/v3/member/comment`,
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
                throw `Invalid status code: ${res.status}// ${res.body}`;
            } else {
                return "ok"
            }
        },
        onClickTag: (namespace, tag) => {
            if (namespace === "标签") {
                return {
                    action: 'category',
                    keyword: `${tag}`,
                    param: null,
                }
            }
            if (namespace === "作者") {
                return {
                    action: 'search',
                    keyword: `${namespace}:${tag}`,
                    param: null,
                }
            }
            throw "未支持此类Tag检索"
        }
    }

    settings = {
        region: {
            title: "CDN线路",
            type: "select",
            options: [
                {
                    value: "1",
                    text: '大陆线路'
                },
                {
                    value: "0",
                    text: '海外线路'
                },
            ],
            default: CopyManga.defaultCopyRegion,
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
            default: CopyManga.defaultImageQuality,
        },
        search_api: {
            title: "搜索方式",
            type: "select",
            options: [
               {
                   value: 'webAPI',
                   text: '网页端API'
               }
            ],
            default: 'webAPI'
        },
        base_url: {
            title: "API地址",
            type: "input",
            validator: '^(?!:\\/\\/)(?=.{1,253})([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\\.)+[a-zA-Z]{2,}$',
            default: CopyManga.defaultApiUrl,
        },
        request_delay: {
            title: "EP请求延迟(毫秒)",
            type: "input",
            validator: '^[0-9]{1,5}$',
            default: '1000',
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

    async refreshSearchApi() {
        let url = "https://www.2025copy.com/search"
        let res = await fetch(url)
        let searchApi = ""
        if (res.status === 200) {
            let text = await res.text()
            let match = text.match(/const countApi = "([^"]+)"/)
            if (match && match[1]) {
                CopyManga.searchApi = match[1]
            }
        }
    }
}
