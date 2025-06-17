class Comick extends ComicSource {
    name = "comick"
    key = "comick"
    version = "1.0.0"
    minAppVersion = "1.4.0"
    // update url
    url = "https://cdn.jsdelivr.net/gh/venera-app/venera-configs@main/comick.js"

    settings = {
        domains: {
            title: "主页源",
            type: "select",
            options: [
                {value: "comick.io"},
                {value: "preview.comick.io"}
            ],
            default: "preview.comick.io"
        }
    }

    get baseUrl() {
        let domain = this.loadSetting('domains') || this.settings.domains.default;
        return `https://${domain}`;
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

    transformBookList(bookList, descriptionPrefix = "更新至：") {
        return bookList.map(book => ({
            id: book.slug,
            title: book.title,
            cover: book.md_covers?.[0]?.b2key
                ? `https://meo.comick.pictures/${book.md_covers[0].b2key}`
                : 'w7xqzd.jpg',
            tags: [],
            description: `${descriptionPrefix}${book.last_chapter || "未知"}`
        }));
    }

    getFormattedManga(manga) {
        return {
            id: manga.slug,
            title: manga.title || "无标题",
            cover: manga.md_covers?.[0]?.b2key
                ? `https://meo.comick.pictures/${manga.md_covers[0].b2key}`
                : 'w7xqzd.jpg',
            tags: [],
            description: manga.desc || "暂无描述"
        };
    }

    // 测试通过
    explore = [{
        title: "comick",
        type: "singlePageWithMultiPart",
        load: async () => {
            let url = this.baseUrl === "https://comick.io"
                ? "https://comick.io/home2"
                : this.baseUrl;

            let res = await Network.get(url);
            if (res.status !== 200) throw "请求失败: " + res.status;

            let document = new HtmlDocument(res.body);
            let jsonData = JSON.parse(document.getElementById('__NEXT_DATA__').text);
            let mangaData = jsonData.props.pageProps.data;

            // 使用统一函数转换数据
            const result = {
                "最近热门": this.transformBookList(mangaData.recentRank),
                "总热门": this.transformBookList(mangaData.rank),
                "最近上传": this.transformBookList(mangaData.news),
                "最近更新": this.transformBookList(mangaData.extendedNews),
                "完结": this.transformBookList(mangaData.completions)
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
        }
        ],
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

            if (options[0] && options[0] !== "-全部") {
                params.push(`country=${encodeURIComponent(options[0].split("-")[0])}`);
            }

            if (options[1]) {
                params.push(`status=${encodeURIComponent(options[1].split("-")[0])}`);
            }

            url += params.join('&');

            let res = await Network.get(url);
            if (res.status !== 200) throw "请求失败: " + res.status;

            let mangaList = JSON.parse(res.body);
            if (!Array.isArray(mangaList)) throw "数据格式无效";

            return {
                comics: mangaList.map(this.getFormattedManga),
                maxPage: 50
            };
        },
        optionList: [
            {options: ["-全部", "cn-国漫", "jp-日本", "kr-韩国", "others-欧美"]},
            {options: ["1-连载", "2-完结", "3-休刊", "4-暂停更新"]}
        ]
    }

    /// search related
    search = {
        load: async (keyword, options, page) => {
            let url = `https://api.comick.io/v1.0/search?q=${keyword}&limit=49&page=${page}`;
            let res = await Network.get(url);
            if (res.status !== 200) throw "请求失败: " + res.status;

            let mangaList = JSON.parse(res.body);
            if (!Array.isArray(mangaList)) throw "数据格式无效";

            return {
                comics: mangaList.map(this.getFormattedManga),
                maxPage: 1
            };
        },
        optionList: []
    }

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
        loadNext: async (next, folder) => {

        },
        /**
         * If the comic source only allows one comic in one folder, set this to true.
         */
        singleFolderForSingleComic: false,
    }

    /// single comic related
    comic = {
        // 加载漫画信息
        loadInfo: async (id) => {
            let res = await Network.get(`${this.baseUrl}/comic/${id}`)
            if (res.status !== 200) {
                throw "Invalid status code: " + res.status
            }

            let document = new HtmlDocument(res.body)
            let jsonData = JSON.parse(document.getElementById('__NEXT_DATA__').text);
            let comicData = jsonData.props.pageProps.comic;
            let authorData = jsonData.props.pageProps.authors;

            let title = comicData?.title || "未知标题"; //测试通过

            let cover = comicData.md_covers?.[0]?.b2key ? `https://meo.comick.pictures/${comicData.md_covers[0].b2key}` : 'w7xqzd.jpg';

            let author = authorData[0]?.name || "未知作者"; //测试通过

            // 提取标签的slug数组的代码
            let extractSlugs = (comicData) => {
                try {
                    // 获取md_comic_md_genres数组
                    const genres = comicData.md_comic_md_genres;
                    // 使用map提取每个md_genres中的slug
                    const slugs = genres.map(genre => genre.md_genres.slug);
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
            let description = comicData.desc || "暂无描述";
            if(comicData.chapter_count == 0){
                let chapters = new Map()
                return {
                    title: title,
                    cover: cover,
                    description: description,
                    tags: {
                        "作者": [author],
                        "更新": ["暂无更新"],
                        "标签": translatedTags
                    },
                    chapters: chapters,
                }
            }

            let updateTime = comicData.last_chapter ? "第" + comicData.last_chapter + "话" : " "; //这里目前还无法实现更新时间
            let buildId = jsonData.buildId;
            let slug = jsonData.query.slug;
            let firstChapter = jsonData.props.pageProps.firstChapters[0];
            let firstChapters = jsonData.props.pageProps.firstChapters;

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
                    chapters.set(firstChapters.hid + "//no//-1", "无标卷")
                    return {
                        title: title,
                        cover: cover,
                        description: description,
                        tags: {
                            "作者": [author],
                            "更新": [updateTime],
                            "标签": translatedTags
                        },
                        chapters: chapters,
                    }
                }
            }

            let chapters_url = `https://preview.comick.io/_next/data/${buildId}/comic/${id}/${firstChapter.hid}${
                firstChapter.chap != null 
                    ? `-chapter-${firstChapter.chap}` 
                    : `-volume-${firstChapter.vol}`
            }-en.json`;
            let list_res = await Network.get(chapters_url)
            if (list_res.status !== 200) {
                throw "Invalid status code: " + res.status
            }
            let chapters_raw = JSON.parse(list_res.body);
            let chapters = new Map()
            // 剩余解析章节信息
            let chaptersList = chapters_raw.pageProps.chapters || ["sss"];
            let chapters_next = chaptersList.reverse();
            chapters_next.forEach((chapter, index) => {
                if(chapter.chap==null && chapter.vol==null) {
                    let chapNum = "无标卷";
                    chapters.set(chapter.hid + "//no//-1", chapNum);
                }else if(chapter.chap!=null && chapter.vol==null){
                    let chapNum =  "第" + chapter.chap + "话" ;
                    chapters.set(chapter.hid + "//chapter//" + chapter.chap, chapNum);
                }else if(chapter.chap==null && chapter.vol!==null){
                    let chapNum =  "第" + chapter.vol + "卷" ;
                    chapters.set(chapter.hid + "//volume//" + chapter.vol, chapNum);
                }else{
                    let chapNum =  "第" + chapter.chap + "话" ;
                    chapters.set(chapter.hid + "//chapter//" + chapter.chap, chapNum);
                }

            });

            return {
                title: title,
                cover: cover,
                description: description,
                tags: {
                    "作者": [author],
                    "更新": [updateTime],
                    "标签": translatedTags
                },
                chapters: chapters,
            }
        },
        loadEp: async (comicId, epId) => {
            const images = [];
            const [hid, type, chapter] = epId.split("//");

            // 检查分割结果是否有效
            if (!hid || !type || !chapter) {
                console.error("Invalid epId format. Expected 'hid//chapter'");
                return {images};  // 返回空数组
            }

            let url = " ";
            if(type=="no"){
                // 如果是无标卷, 只看第一个
                url = "https://preview.comick.io/comic/" + comicId + "/" + hid;
            }else{
                url = "https://preview.comick.io/comic/" + comicId + "/" + hid + "-" + type + "-" + chapter + "-en.json";
            }

            let maxAttempts = 100;

            while (maxAttempts > 0) {
                const res = await Network.get(url);
                if (res.status !== 200) break;

                let document = new HtmlDocument(res.body)

                let jsonData = JSON.parse(document.getElementById('__NEXT_DATA__').text); //json解析方式
                let imagesData = jsonData.props.pageProps.chapter.md_images;

                // 解析当前页图片
                imagesData.forEach(image => {
                    // 处理图片链接
                    let imageUrl = `https://meo.comick.pictures/${image.b2key}`;
                    images.push(imageUrl);
                });

                // 查找下一页链接
                const nextLink = document.querySelector("a#next-chapter");
                if (nextLink?.text?.match(/下一页|下一頁/)) {
                    url = nextLink.attributes['href'];
                } else {
                    break;
                }
                maxAttempts--;
            }
            return {images};
        }
    }
}