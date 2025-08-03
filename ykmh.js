/** @type {import('./_venera_.js')} */
class YKMHSource extends ComicSource {
    name = "优酷漫画"
    key = "ykmh"
    version = "1.0.0"
    minAppVersion = "1.4.0"
    url = "https://git.nyne.dev/nyne/venera-configs/raw/branch/main/ykmh.js"

    get baseUrl() {
        return "https://www.ykmh.net";
    }

    explore = [
        {
            title: "优酷漫画",
            type: "multiPartPage",

            load: async (page) => {
                let res = await Network.get("https://www.ykmh.net")

                if (res.status !== 200) {
                    throw `Invalid status code: ${res.status}`
                }

                function parseHotCarousel(html) {
                    let hotComics = []
                    let carouselPattern = /<div class="sub-item">\s*<a href="([^"]+)" target="_blank"><img src="([^"]+)" alt="[^"]*"><\/a>\s*<div class="carousel-caption">\s*([^<]+)\s*<\/div>/g
                    let match
                    while ((match = carouselPattern.exec(html)) !== null) {
                        let cover = match[2]
                        if (!cover.startsWith('http')) {
                            cover = 'https://www.ykmh.net' + (cover.startsWith('/') ? cover : '/' + cover)
                        }
                        
                        hotComics.push(new Comic({
                            id: match[1], 
                            title: match[3].trim(), 
                            cover: cover, 
                            tags: [`热门推荐`],
                            description: "热门推荐漫画"
                        }))
                    }
                    if (hotComics.length === 0) {
                        let keywordPattern = /<li data-key="(\d+)"><a href="(https:\/\/www\.ykmh\.net\/manhua\/[^"]+)"[^>]*>([^<]+)<\/a><\/li>/g
                        while ((match = keywordPattern.exec(html)) !== null) {
                            hotComics.push(new Comic({
                                id: match[2], 
                                title: match[3],
                                cover: "https://www.ykmh.net/images/default/cover.png", 
                                tags: [`热门关键词`],
                                description: ""
                            }))
                        }
                    }
                    
                    return hotComics.slice(0, 10) 
                }

                function parseLatestComics(html) {
                    let latestComics = []
                    let comicPattern = /<li data-key="(\d+)"><a class="image-link" href="([^"]+)" title="([^"]+)"><img src="([^"]+)"[^>]*><span class="tip"><p>([^<]*)<\/p><\/span><\/a><p><a href="[^"]*" title="[^"]*">([^<]+)<\/a><\/p>/g
                    let match
                    while ((match = comicPattern.exec(html)) !== null) {
                        let cover = match[4]
                        if (!cover.startsWith('http')) {
                            cover = 'https://www.ykmh.net' + (cover.startsWith('/') ? cover : '/' + cover)
                        }
                        
                        latestComics.push(new Comic({
                            id: match[2], 
                            title: match[3], 
                            cover: cover, 
                            tags: [match[5]], 
                            description: `更新至：${match[5]}`
                        }))
                    }
                    return latestComics.slice(0, 15) 
                }

                let hotComics = parseHotCarousel(res.body)
                let latestComics = parseLatestComics(res.body)

                return [
                    {
                        title: "热门推荐",
                        comics: hotComics
                    },
                    {
                        title: "最新更新",
                        comics: latestComics
                    }
                ]
            }
        }
    ]

        static category_param_dict = {
        "全部": "",
        "爱情": "aiqing",
        "剧情": "juqing",
        "欢乐向": "huanlexiang",
        "格斗": "gedou",
        "科幻": "kehuan",
        "伪娘": "weiniang",
        "节操": "jiecao",
        "恐怖": "kongbu",
        "悬疑": "xuanyi",
        "冒险": "maoxian",
        "校园": "xiaoyuan",
        "治愈": "zhiyu",
        "恋爱": "lianai",
        "奇幻": "qihuan",
        "热血": "rexue",
        "限制级": "xianzhiji",
        "魔法": "mofa",
        "后宫": "hougong",
        "魔幻": "mohuan",
        "轻小说": "qingxiaoshuo",
        "震撼": "zhenhan",
        "纯爱": "chunai",
        "少女": "shaonv",
        "战争": "zhanzheng",
        "武侠": "wuxia",
        "搞笑": "gaoxiao",
        "神鬼": "shengui",
        "竞技": "jingji",
        "幻想": "huanxiang",
        "神魔": "shenmo",
        "灵异": "lingyi",
        "百合": "baihe",
        "运动": "yundong",
        "体育": "tiyu",
        "惊悚": "jingsong",
        "日常": "richang",
        "绅士": "shenshi",
        "颜艺": "yanyi",
        "生活": "shenghuo",
        "四格": "sige",
        "萌系": "mengxi",
        "都市": "dushi",
        "同人": "tongren",
        "推理": "tuili",
        "耽美": "danmei",
        "卖肉": "mairou",
        "职场": "zhichang",
        "侦探": "zhentan",
        "战斗": "zhandou",
        "爆笑": "baoxiao",
        "总裁": "zongcai",
        "美食": "meishi",
        "性转换": "xingzhuanhuan",
        "励志": "lizhi",
        "西方魔幻": "xifangmohuan",
        "改编": "gaibian",
        "其他": "qita",
        "宅系": "zhaixi",
        "机战": "jizhan",
        "乙女": "yinv",
        "秀吉": "xiuji",
        "舰娘": "jianniang",
        "历史": "lishi",
        "猎奇": "lieqi",
        "社会": "shehui",
        "青春": "qingchun",
        "高清单行": "gaoqingdanxing",
        "东方": "dongfang",
        "橘味": "juwei",
        "音乐舞蹈": "yinyuewudao",
        "家庭": "jiating",
        "ゆり": "unknown",
        "彩虹": "caihong",
        "少年": "shaonian",
        "泡泡": "paopao",
        "宫斗": "gongdou",
        "动作": "dongzuo",
        "青年": "qingnian",
        "虐心": "nuexin",
        "泛爱": "fanai",
        "机甲": "jijia",
        "装逼": "zhuangbi",
        "#愛情": "aiqing2",
        "#長條": "zhangtiao",
        "#穿越": "chuanyue",
        "#生活": "shenghuo2",
        "TS": "TS",
        "#耽美": "danmei2",
        "#后宫": "hougong2",
        "#节操": "jiecao2",
        "#轻小说": "qingxiaoshuo2",
        "#奇幻": "qihuan2",
        "#悬疑": "xuanyi2",
        "#校园": "xiaoyuan2",
        "#爱情": "aiqing3",
        "#百合": "baihe2",
        "#长条": "changtiao",
        "#冒险": "maoxian2",
        "#搞笑": "gaoxiao2",
        "#欢乐向": "huanlexiang2",
        "#职场": "zhichang2",
        "#神鬼": "shengui2",
        "#生存": "shengcun",
        "#治愈": "zhiyu2",
        "#竞技": "jingji2",
        "#美食": "meishi2",
        "#其他": "qita2",
        "#机战": "jizhan2",
        "#战争": "zhanzheng2",
        "#科幻": "kehuan2",
        "#四格": "sige2",
        "#武侠": "wuxia2",
        "#重生": "zhongsheng",
        "#性转换": "xingzhuanhuan2",
        "#热血": "rexue2",
        "#伪娘": "weiniang2",
        "#异世界": "yishijie",
        "#萌系": "mengxi2",
        "#格斗": "gedou2",
        "#励志": "lizhi2",
        "#都市": "dushi2",
        "#惊悚": "jingsong2",
        "#侦探": "zhentan2",
        "#舰娘": "jianniang2",
        "#音乐舞蹈": "yinyuewudao2",
        "#TL": "TL",
        "#AA": "AA",
        "#转生": "zhuansheng",
        "#魔幻": "mohuan2",
        "---": "unknown2",
        "#彩色": "caise",
        "福瑞": "furui",
        "#FATE": "FATE",
        "西幻": "xihuan",
        "#C99": "C99",
        "#C101": "C101",
        "#历史": "lishi2",
        "#C102": "C102",
        "#无修正": "wuxiuzheng",
        "#C103": "C103",
        "#东方": "dongfang2",
        "栏目": "lanmu",
        "异世界": "yishijie2",
        "恶搞": "egao",
        "霸总": "bazong",
        "古风": "gufeng",
        "穿越": "chuanyue2",
        "玄幻": "xuanhuan",
        "日更": "rigeng",
        "吸血": "xixie",
        "萝莉": "luoli",
        "漫改": "mangai",
        "唯美": "weimei",
        "宅男腐女": "zhainanfunv",
        "老师": "laoshi",
        "诱惑": "youhuo",
        "杂志": "zazhi",
        "脑洞": "naodong",
        "其它": "qita3",
        "#恐怖": "kongbu2",
        "#C105": "C105",
        "权谋": "quanmou",
        "大陆": "dalu",
        "日本": "riben",
        "香港": "hongkong",
        "台湾": "taiwan",
        "欧美": "oumei",
        "韩国": "hanguo",
        "其它": "qita",
        "儿童漫画": "ertong",
        "少年漫画": "shaonian",
        "少女漫画": "shaonv",
        "青年漫画": "qingnian",
        "已完结": "wanjie",
        "连载中": "lianzai"
    }

    static comic_status = {
        "连载中": "ongoing",
        "已完结": "completed", 
        "暂停": "paused",
        "完结": "completed",
        "连载": "ongoing",
        "休刊": "paused",
        "未知状态": "unknown"
    }

    category = {
        title: "优酷漫画",
        parts: [
            {
                name: "主题",
                type: "fixed",
                categories: Object.keys(YKMHSource.category_param_dict),
                itemType: "category",
                categoryParams: Object.values(YKMHSource.category_param_dict),
            }
        ],
        enableRankingPage: false,
    }

    categoryComics = {
        load: async (category, param, options, page) => {
            let sort = "";
            temp = options[1].split("-")[0]
            if(temp==0){sort=""}else{sort="-"}
            sort = sort + options[0].split("-")[0]
            let url;
            if (param === "" || param === undefined) {
                url = `https://www.ykmh.net/list/${sort}/?page=${page}`;
            } else {
                url = `https://www.ykmh.net/list/${param}/${sort}/${page}/`;
            }

            let res = await Network.get(url);

            if (res.status !== 200) {
                throw `Invalid status code: ${res.status}`;
            }
            function parseComicsList(html) {
                let comics = []
                let comicPattern = /<li class="list-comic" data-key="(\d+)">\s*<a class="comic_img"\s+href="([^"]+)"><img src="([^"]+)" alt="([^"]*)"[^>]*><\/a>\s*<span class="comic_list_det"[^>]*>\s*<h3><a href="[^"]*">([^<]+)<\/a><\/h3>/g
                
                let match
                while ((match = comicPattern.exec(html)) !== null) {
                    let cover = match[3]
                    if (!cover.startsWith('http')) {
                        cover = 'https://www.ykmh.net' + (cover.startsWith('/') ? cover : '/' + cover)
                    }
                    
                    comics.push(new Comic({
                        id: match[2],
                        title: match[5] || match[4], 
                        cover: cover,
                        tags: [],
                        description: ""
                    }))
                }
                
                return comics
            }

            let comics = parseComicsList(res.body)

            let maxPage = 1
            let pagePattern = /<li class="last"><a href="[^"]*\/(\d+)\/" data-page="\d+">尾页<\/a><\/li>/
            let pageMatch = res.body.match(pagePattern)
            if (pageMatch) {
                maxPage = parseInt(pageMatch[1])
            } else {
                let altPagePattern = /<li class="last"><a href="[^"]*" data-page="(\d+)">尾页<\/a><\/li>/
                let altMatch = res.body.match(altPagePattern)
                if (altMatch) {
                    maxPage = parseInt(altMatch[1]) + 1 
                }
            }

            return {
                comics: comics,
                maxPage: maxPage
            };
        },
        optionList: [
                {options:[
                    "update-更新时间",
                    "post-发布时间",
                    "click-点击量"
                ]},
                {options:[
                    "0-降序",
                    "1-升序"
                ]},
        ]
    }

    /// search related
    search = {
        load: async (keyword, options, page) => {
            let encodedKeyword = encodeURIComponent(keyword);
            let url;
            if (page && page > 1) {
                url = `https://www.ykmh.net/search/?keywords=${encodedKeyword}&page=${page}`;
            } else {
                url = `https://www.ykmh.net/search/?keywords=${encodedKeyword}`;
            }
            
            let res = await Network.get(url);
            if (res.status !== 200) {
                throw `Request Error: ${res.status}`;
            }
            function parseSearchResults(html) {
                let comics = []
                let comicPattern = /<li class="list-comic" data-key="(\d+)"><a class="image-link"\s+href="([^"]+)"\s+title="([^"]+)"><img src="([^"]+)"[^>]*><\/a>\s*<p><a href="[^"]*"[^>]*>([^<]+)<\/a><\/p>\s*<p class="auth"><a href="[^"]*">([^<]*)<\/a><\/p>\s*<p class="newPage">([^<]*)<\/p>/g
                
                let match
                while ((match = comicPattern.exec(html)) !== null) {
                    let cover = match[4]
                    if (!cover.startsWith('http')) {
                        cover = 'https://www.ykmh.net' + (cover.startsWith('/') ? cover : '/' + cover)
                    }
                    comics.push(new Comic({
                        id: match[2], 
                        title: match[3], 
                        cover: cover, 
                        tags: [match[6] || "未知作者", match[7] || ""], 
                        description: `作者：${match[6] || "未知作者"} | 更新至：${match[7] || "未知"}`
                    }))
                }
                
                return comics
            }

            let comics = parseSearchResults(res.body)
            let maxPage = 1
            let pagePattern = /<li class="last"><a href="[^"]*page=(\d+)"[^>]*>尾页<\/a><\/li>/
            let pageMatch = res.body.match(pagePattern)
            if (pageMatch) {
                maxPage = parseInt(pageMatch[1])
            } else {
                let altPagePattern = /<a href="[^"]*page=(\d+)"[^>]*>\s*(\d+)\s*<\/a>/g
                let matches = [...res.body.matchAll(altPagePattern)]
                if (matches.length > 0) {
                    maxPage = Math.max(...matches.map(m => parseInt(m[2])))
                }
            }

            return {
                comics: comics,
                maxPage: maxPage
            };
        },
        optionList: []
    }

    /// single comic related
    comic = {
        id: null,
        buildId: null,
    
        loadInfo: async (id) => {
            if (!id || typeof id !== 'string') {
                throw "ID不能为空";
            }
            let targetUrl = id;
            if (id.startsWith('https://www.ykmh.net/')) {
                targetUrl = id.replace('https://www.ykmh.net/', 'https://m.ykmh.net/');
            } 
            else if (id.startsWith('/')) {
                targetUrl = 'https://m.ykmh.net' + id;
            } 
            else {
                targetUrl = 'https://m.ykmh.net/' + id;
            }
            
            if (!targetUrl.endsWith('/')) {
                targetUrl += '/';
            }

            let res = await Network.get(targetUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36 Edg/139.0.0.0'
                }
            });
            if (res.status !== 200) {
                throw `请求失败，状态码: ${res.status}，URL: ${targetUrl}`;
            }

            function parseComicInfo(html) {
                try {
                    if (!html || typeof html !== 'string') {
                        return {
                            title: "未知标题",
                            cover: "https://m.ykmh.net/images/default/cover.png",
                            author: "未知作者",
                            status: "未知状态",
                            tags: [],
                            description: "暂无描述"
                        };
                    }
                    let title = "未知标题";
                    try {
                        let titleMatch = html.match(/<div class="BarTit" id="comicName">([^<]+)<\/div>/);
                        if (titleMatch && titleMatch[1]) {
                            title = titleMatch[1].trim();
                        }
                    } catch (e) {
                        console.warn("解析标题失败:", e);
                    }

                    let cover = "https://m.ykmh.net/images/default/cover.png";
                    try {
                        let coverMatch = html.match(/<div class="pic" id="Cover">\s*<mip-img src="([^"]+)"/);
                        if (coverMatch && coverMatch[1]) {
                            cover = coverMatch[1];
                        } else {
                            let backupMatch = html.match(/<mip-img src="([^"]+)"/);
                            if (backupMatch && backupMatch[1]) {
                                cover = backupMatch[1];
                            }
                        }
                    } catch (e) {
                        console.warn("解析封面失败:", e);
                    }
                    let author = "未知作者";
                    try {
                        let authorMatch = html.match(/<p class="txtItme">\s*<span class="icon icon01"><\/span>\s*<a href="[^"]*">([^<]+)<\/a>\s*<\/p>/);
                        if (authorMatch && authorMatch[1]) {
                            author = authorMatch[1].trim();
                        } else {
                            let authorMatch2 = html.match(/<span class="icon icon01"><\/span>\s*<a href="[^"]*">([^<]+)<\/a>/);
                            if (authorMatch2 && authorMatch2[1]) {
                                author = authorMatch2[1].trim();
                            }
                        }
                        console.log("解析到作者:", author);
                    } catch (e) {
                        console.warn("解析作者失败:", e);
                    }
                    let status = "未知状态";
                    let tags = [];
                    try {
                        let txtItems = html.match(/<p class="txtItme">[\s\S]*?<\/p>/g);
                        if (txtItems) {
                            console.log("找到txtItme元素数量:", txtItems.length);
                            for (let item of txtItems) {
                                if (item.includes('icon icon02')) {
                                    let tagMatches = item.matchAll(/<a href="[^"]*\/list\/[^"]*\/">([^<]+)<\/a>/g);
                                    if (tagMatches) {
                                        for (let tagMatch of tagMatches) {
                                            if (tagMatch && tagMatch[1]) {
                                                let tagText = tagMatch[1].trim();
                                                if (tagText && !tags.includes(tagText)) {
                                                    tags.push(tagText);
                                                    if (tagText === '连载中' || tagText === '已完结' || tagText === '完结' || 
                                                        tagText === '连载' || tagText === '暂停' || tagText === '休刊') {
                                                        status = tagText;
                                                        console.log("找到状态标签:", tagText);
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                        
                        console.log("解析到状态:", status, "标签:", tags);
                    } catch (e) {
                        console.warn("解析标签失败:", e);
                        tags = [];
                    }
                    let description = "暂无描述";
                    try {
                        let descMatch = html.match(/<mip-showmore[^>]*id="showmore-des">\s*([^<]+(?:<[^>]+>[^<]*<\/[^>]+>[^<]*)*?)\s*<\/mip-showmore>/);
                        if (descMatch && descMatch[1]) {
                            description = descMatch[1].replace(/<[^>]+>/g, '').replace(/^\s*介绍:\s*/, '').trim();
                        }
                    } catch (e) {
                        console.warn("解析描述失败:", e);
                    }

                    return {
                        title: title || "未知标题",
                        cover: cover || "https://m.ykmh.net/images/default/cover.png",
                        author: author || "未知作者",
                        status: status || "未知状态",
                        tags: tags || [],
                        description: description || "暂无描述"
                    };
                } catch (error) {
                    console.error("parseComicInfo 总体错误:", error);
                    return {
                        title: "未知标题",
                        cover: "https://m.ykmh.net/images/default/cover.png",
                        author: "未知作者",
                        status: "未知状态",
                        tags: [],
                        description: "暂无描述"
                    };
                }
            }

            function parseChapters(html) {
                let allChaptersMap = new Map(); 
                let groupedChapters = new Map();
                
                try {
                    if (!html || typeof html !== 'string') {
                        return allChaptersMap;
                    }

                    let chapterGroupsPattern = /<div class="comic-chapters">[\s\S]*?<span class="Title">([^<]+)<\/span>[\s\S]*?<ul id="chapter-list-(\d+)"[^>]*>([\s\S]*?)<\/ul>/g;
                    
                    let groupMatch;
                    while ((groupMatch = chapterGroupsPattern.exec(html)) !== null) {
                        try {
                            if (groupMatch && groupMatch[1] && groupMatch[3]) {
                                let groupTitle = groupMatch[1].trim();
                                let groupContent = groupMatch[3];
                                let groupChapters = new Map();
                                
                                let chapterPattern = /<li>\s*<a href="([^"]+)"[^>]*>\s*<span>([^<]+)<\/span>\s*<\/a>\s*<\/li>/g;
                                
                                let chapterMatch;
                                while ((chapterMatch = chapterPattern.exec(groupContent)) !== null) {
                                    try {
                                        if (chapterMatch && chapterMatch[1] && chapterMatch[2]) {
                                            let chapterUrl = chapterMatch[1];
                                            let chapterTitle = chapterMatch[2].trim();                                    
                                            if (!chapterUrl.startsWith('http')) {
                                                chapterUrl = 'https://m.ykmh.net' + (chapterUrl.startsWith('/') ? chapterUrl : '/' + chapterUrl);
                                            }
                                            groupChapters.set(chapterUrl, chapterTitle);
                                            let finalChapterTitle = chapterTitle;
                                            if (groupTitle !== "连载列表") {
                                                finalChapterTitle = `[${groupTitle}] ${chapterTitle}`;
                                            }
                                            allChaptersMap.set(chapterUrl, finalChapterTitle);
                                        }
                                    } catch (e) {
                                        console.warn("解析单个章节失败:", e);
                                        continue;
                                    }
                                }
                                if (groupChapters.size > 0) {
                                    groupedChapters.set(groupTitle, groupChapters);
                                }
                            }
                        } catch (e) {
                            console.warn("解析章节组别失败:", e);
                            continue;
                        }
                    }
                
                    if (allChaptersMap.size === 0) {
                        console.warn("使用备用章节解析方法");
                        let allChapterPattern = /<li>\s*<a href="([^"]+)"[^>]*>\s*<span>([^<]+)<\/span>\s*<\/a>\s*<\/li>/g;
                        
                        let match;
                        while ((match = allChapterPattern.exec(html)) !== null) {
                            try {
                                if (match && match[1] && match[2]) {
                                    let chapterUrl = match[1];
                                    let chapterTitle = match[2].trim();
                                    if (!chapterUrl.startsWith('http')) {
                                        chapterUrl = 'https://m.ykmh.net' + (chapterUrl.startsWith('/') ? chapterUrl : '/' + chapterUrl);
                                    }
                                    
                                    allChaptersMap.set(chapterUrl, chapterTitle);
                                }
                            } catch (e) {
                                console.warn("解析单个章节失败:", e);
                                continue;
                            }
                        }
                    }
                    if (groupedChapters.size > 1) {
                        console.log("使用多分组模式");
                        return groupedChapters;
                    }
                    console.log("使用合并模式");
                    return allChaptersMap;
                    
                } catch (error) {
                    console.error("parseChapters 总体错误:", error);
                }
                
                return allChaptersMap;
            }
            function parseRecommends(html) {
                let recommends = [];
                try {
                    if (!html || typeof html !== 'string') {
                        return recommends;
                    }

                    let recommendPattern = /<li class="list-comic" data-key="[^"]*">\s*<a class="ImgA" href="([^"]+)"><mip-img src="([^"]+)"[^>]*alt="([^"]*)"[^>]*><\/mip-img><\/a>\s*<a class="txtA" href="[^"]+">([^<]+)<\/a>/g;
                    
                    let match;
                    let count = 0;
                    while ((match = recommendPattern.exec(html)) !== null && count < 10) {
                        try {
                            if (match && match[1] && match[2]) {
                                let recUrl = match[1];
                                let recCover = match[2];
                                let recTitle = (match[4] && match[4].trim()) || (match[3] && match[3].trim()) || "未知标题";              
                                recommends.push(new Comic({
                                    id: recUrl,
                                    title: recTitle,
                                    cover: recCover
                                }));
                                count++;
                            }
                        } catch (e) {
                            console.warn("解析单个推荐漫画失败:", e);
                            continue;
                        }
                    }
                } catch (error) {
                    console.error("parseRecommends 总体错误:", error);
                }
                
                return recommends;
            }

            try {
                this.comic.id = id;
                if (!res.body || typeof res.body !== 'string') {
                    throw "响应内容为空或格式错误";
                }
                
                let comicInfo = parseComicInfo(res.body);
                let chapters = parseChapters(res.body);
                let recommends = parseRecommends(res.body);
                comicInfo = comicInfo || {};
                if (!comicInfo.title) comicInfo.title = "未知标题";
                if (!comicInfo.author) comicInfo.author = "未知作者";
                if (!comicInfo.status) comicInfo.status = "未知状态";
                if (!comicInfo.description) comicInfo.description = "暂无描述";
                if (!comicInfo.cover) comicInfo.cover = "https://m.ykmh.net/images/default/cover.png";
                if (!comicInfo.tags || !Array.isArray(comicInfo.tags)) comicInfo.tags = [];
                let updateInfo = "暂无更新";
                try {
                    if (chapters && chapters.size > 0) {
                        let latestChapter = null;
                        let firstValue = Array.from(chapters.values())[0];
                        if (firstValue instanceof Map) {
                            for (let groupChapters of chapters.values()) {
                                if (groupChapters.size > 0) {
                                    latestChapter = Array.from(groupChapters.values())[0];
                                    break;
                                }
                            }
                        } else {
                            latestChapter = firstValue;
                        }
                        
                        if (latestChapter) {
                            updateInfo = `更新至：${latestChapter}`;
                        }
                    }
                } catch (e) {
                    console.warn("获取更新信息失败:", e);
                }
                let mappedStatus = comicInfo.status;
                try {
                    if (YKMHSource.comic_status && comicInfo.status) {
                        mappedStatus = YKMHSource.comic_status[comicInfo.status];
                        if (!mappedStatus) {
                            if (comicInfo.status.includes('连载')) {
                                mappedStatus = "ongoing";
                            } else if (comicInfo.status.includes('完结')) {
                                mappedStatus = "completed";
                            } else if (comicInfo.status.includes('暂停') || comicInfo.status.includes('休刊')) {
                                mappedStatus = "paused";
                            } else {
                                mappedStatus = comicInfo.status; // 保持原状态
                            }
                        }
                    }
                } catch (e) {
                    console.warn("状态映射失败:", e);
                    mappedStatus = comicInfo.status;
                }

                return {
                    title: comicInfo.title,
                    cover: comicInfo.cover,
                    description: comicInfo.description,
                    tags: {
                        "作者": [comicInfo.author],
                        "状态": [mappedStatus],
                        "更新": [updateInfo],
                        "标签": comicInfo.tags
                    },
                    chapters: chapters || new Map(),
                    recommend: recommends || []
                };
                
            } catch (error) {
                console.error("loadInfo详细错误:", error);
                throw `解析漫画信息失败: ${error.message || error}`;
            }
        },
        loadEp: async (comicId, epId) => {
            if (!comicId || typeof comicId !== 'string') {
                throw "漫画ID不能为空";
            }
            
            if (!epId || typeof epId !== 'string') {
                throw "章节ID不能为空";
            }
            let chapterUrl = epId;
            if (!chapterUrl.startsWith('http')) {
                chapterUrl = 'https://m.ykmh.net' + (chapterUrl.startsWith('/') ? chapterUrl : '/' + chapterUrl);
            } else if (chapterUrl.startsWith('https://www.ykmh.net/')) {
                chapterUrl = chapterUrl.replace('https://www.ykmh.net/', 'https://m.ykmh.net/');
            }
            let res = await Network.get(chapterUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1'
                }
            });
            if (res.status !== 200) {
                throw `请求章节失败，状态码: ${res.status}`;
            }
            function parseChapterImages(html) {
                let images = [];
                let scriptMatch = html.match(/var\s+chapterImages\s*=\s*(\[.*?\]);/);
                if (scriptMatch) {
                    try {
                        let imageList = JSON.parse(scriptMatch[1]);
                        images = imageList.map(img => {
                            if (!img.startsWith('http')) {
                                return 'https://m.ykmh.net' + (img.startsWith('/') ? img : '/' + img);
                            }
                            return img;
                        });
                    } catch (e) {
                    }
                }
                if (images.length === 0) {
                    let imgPattern = /<img[^>]+src="([^"]+)"[^>]*>/g;
                    let match;
                    while ((match = imgPattern.exec(html)) !== null) {
                        let imgSrc = match[1];
                        if (imgSrc.includes('cover') || imgSrc.includes('avatar') || 
                            imgSrc.includes('logo') || imgSrc.includes('icon') ||
                            imgSrc.includes('banner')) {
                            continue;
                        }
                        
                        if (!imgSrc.startsWith('http')) {
                            imgSrc = 'https://m.ykmh.net' + (imgSrc.startsWith('/') ? imgSrc : '/' + imgSrc);
                        }
                        
                        images.push(imgSrc);
                    }
                }
                if (images.length === 0) {
                    let containerPattern = /<div[^>]*class="[^"]*chapter[^"]*"[^>]*>(.*?)<\/div>/gs;
                    let containerMatch = html.match(containerPattern);
                    
                    if (containerMatch) {
                        let containerHtml = containerMatch[1];
                        let imgPattern = /<img[^>]+src="([^"]+)"/g;
                        let match;
                        while ((match = imgPattern.exec(containerHtml)) !== null) {
                            let imgSrc = match[1];
                            if (!imgSrc.startsWith('http')) {
                                imgSrc = 'https://m.ykmh.net' + (imgSrc.startsWith('/') ? imgSrc : '/' + imgSrc);
                            }
                            images.push(imgSrc);
                        }
                    }
                }
                
                return images;
            }

            try {
                let images = parseChapterImages(res.body);
                if (images.length === 0) {
                    console.warn("未找到章节图片，可能需要进一步的页面解析");
                }
                
                return { images: images || [] };
                
            } catch (error) {
                throw `解析章节图片失败: ${error.message || error}`;
            }
        },
        onClickTag: (namespace, tag) => {
            if (namespace === "标签") {
                let r_tag = YKMHSource.category_param_dict[tag];
                return {
                    action: 'category',
                    keyword: `${tag}`,
                    param: `${r_tag}`,
                }
            }
            throw "未支持此类Tag检索"
        }
    }
}
