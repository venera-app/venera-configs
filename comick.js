class Comick extends ComicSource {
    name = "comick"
    key = "comick"
    version = "1.1.1"
    minAppVersion = "1.4.0"
    // update url
    url = "https://git.nyne.dev/nyne/venera-configs/raw/branch/main/comick.js"

    settings = {
        domains: {
            title: "主页源",
            type: "select",
            options: [
                {value: "comick.io"},
                {value: "preview.comick.io"}
            ],
            default: "preview.comick.io"
        },
        lang_len: {
            title: "最大语言数量(不建议大于5)",
            type: "select",
            options: [
                {value: "1"},
                {value: "2"},
                {value: "3"},
                {value: "4"},
                {value: "5"},
                {value: "8"},
                {value: "10"},
                {value: "15"},
                {value: "20"},
            ],
            default: "3"
        },
    }

    get baseUrl() {
        let domain = this.loadSetting('domains') || this.settings.domains.default;
        return `https://${domain}`;
    }

    static comic_status = {
        "1": "连载",
        "2": "完结",
        "3": "休刊",
        "4": "暂停更新",
    }
    static category_param_dict = {
        "romance": "浪漫",
        "comedy": "喜剧",
        "drama": "剧情",
        "fantasy": "奇幻",
        "slice-of-life": "日常",
        "action": "动作",
        "adventure": "冒险",
        "psychological": "心理",
        "mystery": "悬疑",
        "historical": "历史",
        "tragedy": "悲剧",
        "sci-fi": "科幻",
        "horror": "恐怖",
        "isekai": "异世界",
        "sports": "运动",
        "thriller": "惊悚",
        "mecha": "机甲",
        "philosophical": "哲学",
        "wuxia": "武侠",
        "medical": "医疗",
        "magical-girls": "魔法少女",
        "superhero": "超级英雄",
        "shounen-ai": "少年爱",
        "mature": "成年",
        "gender-bender": "性转",
        "shoujo-ai": "少女爱",
        "oneshot": "单篇",
        "web-comic": "网络漫画",
        "doujinshi": "同人志",
        "full-color": "全彩",
        "long-strip": "长条",
        "adaptation": "改编",
        "anthology": "选集",
        "4-koma": "四格",
        "user-created": "用户创作",
        "award-winning": "获奖",
        "official-colored": "官方上色",
        "fan-colored": "粉丝上色",
        "school-life": "校园生活",
        "supernatural": "超自然",
        "magic": "魔法",
        "monsters": "怪物",
        "martial-arts": "武术",
        "animals": "动物",
        "demons": "恶魔",
        "harem": "后宫",
        "reincarnation": "转生",
        "office-workers": "上班族",
        "survival": "生存",
        "military": "军事",
        "crossdressing": "女装",
        "loli": "萝莉",
        "shota": "正太",
        "yuri": "百合",
        "yaoi": "耽美",
        "video-games": "电子游戏",
        "monster-girls": "魔物娘",
        "delinquents": "不良少年",
        "ghosts": "幽灵",
        "time-travel": "时间旅行",
        "cooking": "烹饪",
        "police": "警察",
        "aliens": "外星人",
        "music": "音乐",
        "mafia": "黑帮",
        "vampires": "吸血鬼",
        "samurai": "武士",
        "post-apocalyptic": "后末日",
        "gyaru": "辣妹",
        "villainess": "恶役千金",
        "reverse-harem": "逆后宫",
        "ninja": "忍者",
        "zombies": "僵尸",
        "traditional-games": "传统游戏",
        "virtual-reality": "虚拟现实",
        "adult": "成人",
        "ecchi": "情色",
        "sexual-violence": "性暴力",
        "smut": "肉欲",
    }
    static reversed_category_param_dict = {
    "浪漫": "romance",
    "喜剧": "comedy",
    "剧情": "drama",
    "奇幻": "fantasy",
    "日常": "slice-of-life",
    "动作": "action",
    "冒险": "adventure",
    "心理": "psychological",
    "悬疑": "mystery",
    "历史": "historical",
    "悲剧": "tragedy",
    "科幻": "sci-fi",
    "恐怖": "horror",
    "异世界": "isekai",
    "运动": "sports",
    "惊悚": "thriller",
    "机甲": "mecha",
    "哲学": "philosophical",
    "武侠": "wuxia",
    "医疗": "medical",
    "魔法少女": "magical-girls",
    "超级英雄": "superhero",
    "少年爱": "shounen-ai",
    "成年": "mature",
    "性转": "gender-bender",
    "少女爱": "shoujo-ai",
    "单篇": "oneshot",
    "网络漫画": "web-comic",
    "同人志": "doujinshi",
    "全彩": "full-color",
    "长条": "long-strip",
    "改编": "adaptation",
    "选集": "anthology",
    "四格": "4-koma",
    "用户创作": "user-created",
    "获奖": "award-winning",
    "官方上色": "official-colored",
    "粉丝上色": "fan-colored",
    "校园生活": "school-life",
    "超自然": "supernatural",
    "魔法": "magic",
    "怪物": "monsters",
    "武术": "martial-arts",
    "动物": "animals",
    "恶魔": "demons",
    "后宫": "harem",
    "转生": "reincarnation",
    "上班族": "office-workers",
    "生存": "survival",
    "军事": "military",
    "女装": "crossdressing",
    "萝莉": "loli",
    "正太": "shota",
    "百合": "yuri",
    "耽美": "yaoi",
    "电子游戏": "video-games",
    "魔物娘": "monster-girls",
    "不良少年": "delinquents",
    "幽灵": "ghosts",
    "时间旅行": "time-travel",
    "烹饪": "cooking",
    "警察": "police",
    "外星人": "aliens",
    "音乐": "music",
    "黑帮": "mafia",
    "吸血鬼": "vampires",
    "武士": "samurai",
    "后末日": "post-apocalyptic",
    "辣妹": "gyaru",
    "恶役千金": "villainess",
    "逆后宫": "reverse-harem",
    "忍者": "ninja",
    "僵尸": "zombies",
    "传统游戏": "traditional-games",
    "虚拟现实": "virtual-reality",
    "成人": "adult",
    "情色": "ecchi",
    "性暴力": "sexual-violence",
    "肉欲": "smut"
    }
    static language_dict = {
        'en': '英文',
        'pt-br': '巴西葡萄牙文',
        'es-419': '拉丁美洲西班牙文',
        'ru': '俄文',
        'vi': '越南文',
        'fr': '法文',
        'pl': '波兰文',
        'id': '印度尼西亚文',
        'tr': '土耳其文',
        'it': '意大利文',
        'es': '西班牙文',
        'uk': '乌克兰文',
        'ar': '阿拉伯文',
        'zh-hk': '繁体中文',
        'hu': '匈牙利文',
        'zh': '中文',
        'de': '德文',
        'ko': '韩文',
        'th': '泰文',
        'bg': '保加利亚文',
        'ca': '加泰罗尼亚文',
        'fa': '波斯文',
        'ro': '罗马尼亚文',
        'cs': '捷克文',
        'mn': '蒙古文',
        'he': '希伯来文',
        'pt': '葡萄牙文',
        'hi': '印地文',
        'tl': '他加禄文',
        'fi': '芬兰文',
        'ms': '马来文',
        'eu': '巴斯克文',
        'kk': '哈萨克文',
        'sr': '塞尔维亚文',
        'my': '缅甸文',
        'el': '希腊文',
        'nl': '荷兰文',
        'ja': '日文',
        'uz': '乌兹别克文',
        'eo': '世界语',
        'bn': '孟加拉文',
        'lt': '立陶宛文',
        'ka': '格鲁吉亚文',
        'da': '丹麦文',
        'ta': '泰米尔文',
        'sv': '瑞典文',
        'be': '白俄罗斯文',
        'cv': '楚瓦什文',
        'hr': '克罗地亚文',
        'la': '拉丁文',
        'ne': '尼泊尔文',
        'ur': '乌尔都文',
        'gl': '加利西亚文',
        'no': '挪威文',
        'sq': '阿尔巴尼亚文',
        'ga': '爱尔兰文',
        'te': '泰卢固文',
        'jv': '爪哇文',
        'sl': '斯洛文尼亚文',
        'et': '爱沙尼亚文',
        'az': '阿塞拜疆文',
        'sk': '斯洛伐克文',
        'af': '南非荷兰文',
        'lv': '拉脱维亚文'
    }
    static reversed_language_dict = {
        '英文': 'en',
        '巴西葡萄牙文': 'pt-br',
        '拉丁美洲西班牙文': 'es-419',
        '俄文': 'ru',
        '越南文': 'vi',
        '法文': 'fr',
        '波兰文': 'pl',
        '印度尼西亚文': 'id',
        '土耳其文': 'tr',
        '意大利文': 'it',
        '西班牙文': 'es',
        '乌克兰文': 'uk',
        '阿拉伯文': 'ar',
        '香港繁体中文': 'zh-hk',
        '匈牙利文': 'hu',
        '中文': 'zh',
        '德文': 'de',
        '韩文': 'ko',
        '泰文': 'th',
        '保加利亚文': 'bg',
        '加泰罗尼亚文': 'ca',
        '波斯文': 'fa',
        '罗马尼亚文': 'ro',
        '捷克文': 'cs',
        '蒙古文': 'mn',
        '希伯来文': 'he',
        '葡萄牙文': 'pt',
        '印地文': 'hi',
        '菲律宾文/他加禄文': 'tl',
        '芬兰文': 'fi',
        '马来文': 'ms',
        '巴斯克文': 'eu',
        '哈萨克文': 'kk',
        '塞尔维亚文': 'sr',
        '缅甸文': 'my',
        '希腊文': 'el',
        '荷兰文': 'nl',
        '日文': 'ja',
        '乌兹别克文': 'uz',
        '世界语': 'eo',
        '孟加拉文': 'bn',
        '立陶宛文': 'lt',
        '格鲁吉亚文': 'ka',
        '丹麦文': 'da',
        '泰米尔文': 'ta',
        '瑞典文': 'sv',
        '白俄罗斯文': 'be',
        '楚瓦什文': 'cv',
        '克罗地亚文': 'hr',
        '拉丁文': 'la',
        '尼泊尔文': 'ne',
        '乌尔都文': 'ur',
        '加利西亚文': 'gl',
        '挪威文': 'no',
        '阿尔巴尼亚文': 'sq',
        '爱尔兰文': 'ga',
        '泰卢固文': 'te',
        '爪哇文': 'jv',
        '斯洛文尼亚文': 'sl',
        '爱沙尼亚文': 'et',
        '阿塞拜疆文': 'az',
        '斯洛伐克文': 'sk',
        '南非荷兰文': 'af',
        '拉脱维亚文': 'lv'
    }

    static getRandomHeaders() {
        const userAgents = [
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
            "Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1",
            "Mozilla/5.0 (Linux; Android 10; SM-G973F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Mobile Safari/537.36",
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
        ];

        return {
            "User-Agent": userAgents[Math.floor(Math.random() * userAgents.length)],
            "Accept": "application/json, text/plain, */*",
            "Accept-Language": "en-US,en;q=0.9",
            "Connection": "keep-alive"
        };
    }

    transReformBookList(bookList, descriptionPrefix = "更新至：") {
        return bookList.map(book => ({
            id: `${book.relates?.slug || 'unknown'}//${book.relates?.title || '未知标题'}`,
            title: book.relates?.title || '未知标题',
            cover: book.relates?.md_covers?.[0]?.b2key
                ? `https://meo.comick.pictures/${book.relates.md_covers[0].b2key}`
                : 'w7xqzd.jpg',
        }));
    }

    transformBookList(bookList, descriptionPrefix = "更新至：") {
        return bookList.map(book => ({
            id: `${book.slug || 'unknown'}//${book.title || '未知标题'}`,
            title: book.title || '未知标题',
            cover: book.md_covers?.[0]?.b2key
                ? `https://meo.comick.pictures/${book.md_covers[0].b2key}`
                : 'w7xqzd.jpg',
            tags: [],
            description: `${descriptionPrefix}${book.last_chapter || "未知"}`
        }));
    }

    getFormattedManga(manga) {
        return {
            id: `${manga.slug || 'unknown'}//${manga.title || '未知标题'}`,
            title: manga.title || "无标题",
            cover: manga.md_covers?.[0]?.b2key
                ? `https://meo.comick.pictures/${manga.md_covers[0].b2key}`
                : 'w7xqzd.jpg',
            tags: [
                `更新时间: ${manga.uploaded_at ? new Date(manga.uploaded_at).toISOString().split('T')[0] : ''}`
            ],
            description: manga.desc || "暂无描述"
        };
    }

    explore = [{
        title: "comick",
        type: "singlePageWithMultiPart",
        load: async () => {
            let url = this.baseUrl === "https://comick.io"
                ? "https://comick.io/home2"
                : this.baseUrl;

            let res = await Network.get(url);
            if (res.status !== 200) throw "Request Error: " + res.status;

            let document = new HtmlDocument(res.body);
            let jsonData = JSON.parse(document.getElementById('__NEXT_DATA__').text);
            let mangaData = jsonData.props.pageProps.data;

            // 使用统一函数转换数据
            const result = {
                "最近更新": this.transformBookList(mangaData.extendedNews),
                "最近上传": this.transformBookList(mangaData.news),
                "最近热门": this.transformBookList(mangaData.recentRank),
                "总热门": this.transformBookList(mangaData.rank),
                "完结": this.transformBookList(mangaData.completions),
            };

            return result;
        }
    }]

    // categories
    category = {
        title: "comick",
        parts: [{
            name: "类型",
            type: "fixed",
            categories: Object.values(Comick.category_param_dict), // 使用上方的字典
            itemType: "category",
            categoryParams: Object.keys(Comick.category_param_dict),
        }],
        enableRankingPage: false,
    }

    categoryComics = {
        load: async (category, param, options, page) => {
            // 基础URL
            let url = "https://api.comick.io/v1.0/search?";
            let params = [
                `genres=${encodeURIComponent(param)}`,
                `page=${encodeURIComponent(page)}`
            ];

            if (options[0]) {
                params.push(`sort=${encodeURIComponent(options[0].split("-")[0])}`);
            }

            if (options[1] && options[1] !== "-全部") {
                params.push(`country=${encodeURIComponent(options[1].split("-")[0])}`);
            }

            if (options[2]) {
                params.push(`status=${encodeURIComponent(options[2].split("-")[0])}`);
            }

            url += params.join('&');

            let res = await Network.get(url);
            if (res.status !== 200) throw "Request Error: " + res.status;

            let mangaList = JSON.parse(res.body);
            if (!Array.isArray(mangaList)) throw "Invalid data format";

            return {
                comics: mangaList.map(this.getFormattedManga),
                maxPage: 50
            };
        },
        optionList: [
            {options: ["uploaded-更新排序","user_follow_count-关注排序", "rating-评分排序", "created_at-创建排序"]},
            {options: ["-全部", "cn-国漫", "jp-日本", "kr-韩国", "others-欧美"]},
            {options: ["1-连载", "2-完结", "3-休刊", "4-暂停更新"]}
        ]
    }

    /// search related
    search = {
        load: async (keyword, options, page) => {
            let url = `https://api.comick.io/v1.0/search?q=${keyword}&limit=49&page=${page}`;
            let res = await Network.get(url);
            if (res.status !== 200) throw "Request Error: " + res.status;

            let mangaList = JSON.parse(res.body);
            if (!Array.isArray(mangaList)) throw "Invalid data format";

            return {
                comics: mangaList.map(this.getFormattedManga),
                maxPage: 1
            };
        },
        optionList: []
    }

    /// single comic related
    comic = {
        id: null,
        buildId: null,
    
        loadInfo: async (id) => {
            let headers = Comick.getRandomHeaders();


            const [cId, cTitle] = id.split("//");
            if (!cId) {
                throw "ID error: ";
            }

            let res = await Network.get(`${this.baseUrl}/comic/${cId}`, { headers });
            if (res.status !== 200) {
                throw "Invalid status code: " + res.status
            }


            // 加载漫画信息
            let load_chapter = async (firstChapters, comicData, buildId, id) => {
                // 1. 按 lang 聚合首个有效 {hid,vol,chap}
                const langMap = firstChapters.reduce((map, chapter) => {
                    const { lang, hid, vol, chap } = chapter;
                    if (!map[lang]) {
                        // 第一次见该语言，先记录
                        map[lang] = { hid, vol, chap };
                    } else if (
                        // 如果当前已记录的 vol/chap 都为 null，且新的有任意一个不为 null，则用新记录替换
                        map[lang].vol == null && map[lang].chap == null &&
                        (vol != null || chap != null)
                    ) {
                        map[lang] = { hid, vol, chap };
                    }
                    return map;
                }, {});

                let lang_min_len = Math.min(firstChapters.length, parseInt(this.loadSetting("lang_len"))|| parseInt(this.settings.lang_len.default));

                // 2. 取前 lang_min_len 个语言
                const langs = Object.keys(langMap).slice(0, lang_min_len);
                const result = {};
                let updateTime = "";
                let i = 1;
            


                for (const lang of langs) {
                    // 随机生成请求头
                    let headers = Comick.getRandomHeaders();

                    let first = langMap[lang];
                    if (first.vol == null && first.chap == null) {
                        const chapters = new Map();
                        chapters.set(`${first.hid || 'unknown'}//no//-1//${first.lang || 'unknown'}`, '无标卷');
                        result[Comick.language_dict[lang] || lang] = chapters;
                        continue;
                    }

                    // 3. 构造章节请求 URL
                    const url =
                    `${this.baseUrl}/_next/data/${buildId}/comic/${id}/${first.hid || 'unknown'}` +
                    (first.chap != null
                        ? `-chapter-${first.chap}`
                        : `-volume-${first.vol}`) +
                    `-${lang}.json?slug=${id}&` +
                    (first.chap != null
                        ? `chapter=${first.hid || 'unknown'}`
                        : `volume=${first.hid || 'unknown'}`) 
                    +
                    (first.chap != null
                        ? `-chapter-${first.chap}`
                        : `-volume-${first.vol}`) + `-${lang}`
                    ;

                    const res = await Network.get(url, { headers });
                    if (res.status !== 200) {
                        throw `Invalid status code: ${res.status}`;
                    }
                    const raw = JSON.parse(res.body);
                    if(i==1){
                        //获得更新时间：
                        updateTime = raw.pageProps?.chapter?.updated_at
                            ? raw.pageProps.chapter.updated_at.split('T')[0] : comicData?.last_chapter
                                ? `第${comicData.last_chapter}话`: " ";
                    }
                    i++;
                    const list = (raw.pageProps.chapters || []).reverse();
                    

                    // 4. 构建章节 Map
                    const chapters = new Map();
                    list.forEach(ch => {
                        let key, label;
                        if (ch.chap == null && ch.vol == null) {
                            key = `${ch.hid || 'unknown'}//no//-1//${first.lang || 'unknown'}`;
                            label = '无标卷';
                        } else if (ch.chap != null) {
                            key = `${ch.hid || 'unknown'}//chapter//${ch.chap}//${first.lang || 'unknown'}`;
                            label = `第${ch.chap}话`;
                        } else {
                            key = `${ch.hid || 'unknown'}//volume//${ch.vol}//${first.lang || 'unknown'}`;
                            label = `第${ch.vol}卷`;
                        }
                        chapters.set(key, label);
                    });

                    result[Comick.language_dict[lang] || lang] = chapters;

                    }
                // 5. 返回 Map<语言, Map<章节Key, 章节名称>>
                return [new Map(Object.entries(result)), updateTime];
            };

            //填充文章id：
            this.comic.id = id;
            let document = new HtmlDocument(res.body)
            let jsonData = JSON.parse(document.getElementById('__NEXT_DATA__').text);
            let comicData = jsonData.props?.pageProps?.comic;
            let authorData = jsonData.props?.pageProps?.authors || [];
            let title = cTitle || comicData?.title || "未知标题";
            let status = comicData?.status || "1"; // 默认连载
            let cover = comicData?.md_covers?.[0]?.b2key ? `https://meo.comick.pictures/${comicData.md_covers[0].b2key}` : 'w7xqzd.jpg';
            let author = authorData[0]?.name || "未知作者";

            // 提取标签的slug数组的代码
            let extractSlugs = (comicData) => {
                try {
                    // 获取md_comic_md_genres数组
                    const genres = comicData?.md_comic_md_genres;
                    if (!genres || !Array.isArray(genres)) {
                        return [];
                    }
                    // 使用map提取每个md_genres中的slug
                    const slugs = genres.map(genre => genre?.md_genres?.slug).filter(slug => slug != null);
                    return slugs;
                } catch (error) {
                    return []; // 返回空数组作为容错处理
                }
            };

            let tags = extractSlugs(comicData);
            // 转换 tags 数组，如果找不到对应值则保留原值
            const translatedTags = tags.map(tag => {
                return Comick.category_param_dict[tag] || tag; // 如果字典里没有，就返回原值
            });
            let description = comicData?.desc || "暂无描述";

            //处理推荐列表
            let recommends = this.transReformBookList(comicData?.recommendations || []);
            //只要recommends数组前面十个，不够十个则就是recommends的长度
            recommends = recommends.slice(0, Math.min(recommends.length, 10));

            //处理空漫画
            let firstChapters = jsonData.props?.pageProps?.firstChapters || [];

            if((comicData?.chapter_count == 0 || !comicData?.chapter_count) && firstChapters.length == 0){
                let chapters = new Map()
                return {
                    title: title,
                    cover: cover,
                    description: description,
                    tags: {
                        "语言": [],
                        "作者": [author],
                        "更新": ["暂无更新"],
                        "标签": translatedTags,
                        "状态": [Comick.comic_status[status]]
                    },
                    chapters: chapters,
                }
            }

           // let updateTime = comicData.last_chapter ? "第" + comicData.last_chapter + "话" : " "; //这里目前还无法实现更新时间
            let buildId = jsonData?.buildId;
            let slug = jsonData?.query?.slug;
            let firstChapter = firstChapters.length > 0 ? firstChapters[0] : null;
            
            // 处理无章节的情况
            if (!firstChapter) {
                let chapters = new Map();
                let updateTime = comicData?.last_chapter ? "第" + comicData.last_chapter + "话" : "暂无更新";
                return {
                    title: title,
                    cover: cover,
                    description: description,
                    tags: {
                        "作者": [author],
                        "更新": [updateTime],
                        "标签": translatedTags,
                        "状态": [Comick.comic_status[status]]
                    },
                    chapters: chapters,
                    recommend: recommends || []
                }
            }
            
            // 处理无标卷和无标话的情况
            if(firstChapter.vol == null && firstChapter.chap == null){
                for(let i = 0; i < firstChapters.length; i++) {
                    if(firstChapters[i].vol != null || firstChapters[i].chap != null){
                        firstChapter = firstChapters[i];
                        break;
                    }
                }
                // 如果处理完成之后依然章节没有卷和话信息，直接返回无标卷
                if(firstChapter.vol == null && firstChapter.chap == null){
                    let chapters = new Map()
                    let updateTime = comicData?.last_chapter ? "第" + comicData.last_chapter + "话" : "暂无更新";
                    chapters.set((firstChapter.hid || 'unknown') + "//no//-1//" + (firstChapter.lang || 'unknown'), "无标卷")
                    return {
                        title: title,
                        cover: cover,
                        description: description,
                        tags: {
                            "作者": [author],
                            "更新": [updateTime],
                            "标签": translatedTags,
                            "状态": [Comick.comic_status[status]]
                        },
                        chapters: chapters,
                        recommend: recommends || []
                    }
                }
            }

            //获取章节
            let temp = await load_chapter(firstChapters, comicData, buildId, cId);
            let chapters = temp[0];
            let updateTime = temp[1];

            return {
                title: title,
                cover: cover,
                description: description,
                tags: {
                    "作者": [author],
                    "更新": [updateTime],
                    "标签": translatedTags,
                    "状态": [Comick.comic_status[status]],
                },
                chapters: chapters,
                recommend: recommends || []
            }
        },
        loadEp: async (comicId, epId) => {
            const [cId, cTitle] = comicId.split("//");
            if (!cId) {
                throw "ID error: ";
            }

            const images = [];
            const [hid, type, chapter, lang] = epId.split("//");

            // 检查分割结果是否有效
            if (!hid || !type || !chapter || !lang) {
                console.error("Invalid epId format. Expected 'hid//chapter'");
                return {images};  // 返回空数组
            }

            let url = " ";
            if(type=="no"){
                // 如果是无标卷, 只看第一个
                url = `${this.baseUrl}/comic/${cId}/${hid}`;
            }else{
                url = `${this.baseUrl}/comic/${cId}/${hid}-${type}-${chapter}-${lang}`;
            }

            let maxAttempts = 100;

            while (maxAttempts > 0) {
                const res = await Network.get(url);
                if (res.status !== 200) break;

                let document = new HtmlDocument(res.body)

                let jsonData = JSON.parse(document.getElementById('__NEXT_DATA__').text); //json解析方式
                let imagesData = jsonData.props?.pageProps?.chapter?.md_images;

                // 检查图片数据是否存在
                if (!imagesData || !Array.isArray(imagesData)) {
                    break;
                }

                // 解析当前页图片
                imagesData.forEach(image => {
                    if (image?.b2key) {
                        // 处理图片链接
                        let imageUrl = `https://meo.comick.pictures/${image.b2key}`;
                        images.push(imageUrl);
                    }
                });

                // 查找下一页链接
                const nextLink = document.querySelector("a#next-chapter");
                if (nextLink?.text?.match(/下一页|下一頁/)) {
                    const nextUrl = nextLink.attributes?.['href'];
                    if (nextUrl) {
                        url = nextUrl;
                    } else {
                        break;
                    }
                } else {
                    break;
                }
                maxAttempts--;
            }
            return {images};
        },
        onClickTag: (namespace, tag) => {
            if (namespace === "标签") {
                let r_tag = Comick.reversed_category_param_dict[tag] || tag;
                return {
                    action: 'category',
                    keyword: `${tag}`,
                    param: r_tag,
                }
            }
            throw "Click Tag Error"
        },
    }
}