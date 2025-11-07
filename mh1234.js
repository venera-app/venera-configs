class MH1234 extends ComicSource {
    // name of the source
    name = "漫画1234"

    // unique id of the source
    key = "mh1234"

    version = "1.0.0"

    minAppVersion = "1.4.0"

    // update url
    url = "https://git.nyne.dev/nyne/venera-configs/raw/branch/main/mh1234.js"

    settings = {
        domains: {
            title: "域名",
            type: "input",
            default: "amh1234.com"
        }
    }

    get baseUrl() {
        return `https://b.${this.loadSetting('domains')}`;
    }

    // explore page list
    explore = [{
        title: "漫画1234",
        type: "singlePageWithMultiPart",
        load: async () => {
            const result = {};
            const res = await Network.get(this.baseUrl);
            if (res.status !== 200) {
                throw `Invalid status code: ${res.status}`;
            }
            const doc = new HtmlDocument(res.body);
            const mangaLists = doc.querySelectorAll("div.imgBox");
            for (let list of mangaLists) {
                const tabTitle = list.querySelector(".Title").text;
                const items = [];
                for (let item of list.querySelectorAll("li.list-comic")) {
                    const info = item.querySelectorAll("a")[1];
                    items.push(new Comic({
                        id: item.attributes["data-key"],
                        title: item.querySelector("a.txtA").text,
                        cover: item.querySelector("img").attributes["src"]
                    }));
                }
                result[tabTitle] = items;
            }
            return result;
        }
    }];

    // categories
    category = {
        /// title of the category page, used to identify the page, it should be unique
        title: "漫画1234",
        parts: [
            {
                name: "题材",
                type: "fixed",
                categories: [
                    "全部", "少年热血", "武侠格斗", "科幻魔幻", "竞技体育", "爆笑喜剧", "侦探推理", "恐怖灵异", "耽美人生",
                    "少女爱情", "恋爱生活", "生活漫画", "战争漫画", "故事漫画", "其他漫画", "爱情", "唯美", "武侠", "玄幻",
                    "后宫", "治愈", "励志", "古风", "校园", "虐心", "魔幻", "冒险", "欢乐向", "节操", "悬疑", "历史", "职场",
                    "神鬼", "明星", "穿越", "百合", "西方魔幻", "纯爱", "音乐舞蹈", "轻小说", "侦探", "伪娘", "仙侠", "四格",
                    "剧情", "萌系", "东方", "性转换", "宅系", "美食", "脑洞", "惊险", "爆笑", "都市", "蔷薇", "恋爱", "格斗",
                    "科幻", "魔法", "奇幻", "热血", "其他", "搞笑", "生活", "恐怖", "架空", "竞技", "战争", "搞笑喜剧", "青春",
                    "浪漫", "爽流", "神话", "轻松", "日常", "家庭", "婚姻", "动作", "战斗", "异能", "内涵", "同人", "惊奇",
                    "正剧", "推理", "宠物", "温馨", "异世界", "颜艺", "惊悚", "舰娘","机战", "彩虹", "耽美", "轻松搞笑",
                    "修真恋爱架空", "复仇", "霸总", "段子", "逆袭", "烧脑", "娱乐圈", "纠结", "感动", "豪门", "体育", "机甲",
                    "末世", "灵异", "僵尸", "宫廷", "权谋", "未来", "科技", "商战", "乡村", "震撼", "游戏", "重口味", "血腥",
                    "逗比", "丧尸", "神魔", "修真", "社会", "召唤兽", "装逼", "新作", "漫改", "真人", "运动", "高智商", "悬疑推理",
                    "机智", "史诗", "萝莉", "宫斗", "御姐", "恶搞", "精品", "日更", "小说改编", "防疫", "吸血", "暗黑", "总裁",
                    "重生", "大女主", "系统", "神仙", "末日", "怪物", "妖怪", "修仙", "宅斗", "神豪", "高甜", "电竞", "豪快",
                    "猎奇", "多世界", "性转", "少女", "改编", "女生", "乙女", "男生", "兄弟情", "智斗", "少男", "连载", "奇幻冒险",
                    "古风穿越", "浪漫爱情", "古装", "幽默搞笑", "偶像", "小僵尸", "BL", "少年", "橘味", "情感", "经典",
                    "腹黑", "都市大女主", "致郁", "美少女", "少儿", "暖萌", "长条", "限制级", "知音漫客", "氪金", "独家",
                    "亲情", "现代", "武侠仙侠", "西幻", "超级英雄", "女神", "幻想", "欧风", "养成", "动作冒险", "GL", "橘调",
                    "悬疑灵异", "古代宫廷", "欧式宫廷", "游戏竞技", "橘系", "奇幻爱情", "架空世界", "ゆり", "福瑞", "秀吉", "现代言情",
                    "古代言情", "豪门总裁", "现言萌宝", "玄幻言情", "虐渣", "团宠", "古言萌宝", "现言甜宠", "古言脑洞", "AA", "金手指",
                    "玄幻脑洞", "都市脑洞", "甜宠", "伦理", "生存", "TL", "悬疑脑洞", "黑暗", "独特", "成长", "幻想言情", "直播",
                    "游戏体育", "现言脑洞", "音乐", "双男主", "迪化", "LGBTQ+", "正能量", "军事", "ABO", "悬疑恐怖",
                    "玄幻科幻", "投稿", "种田", "经营", "反套路", "无节操", "强强", "克苏鲁", "无敌流", "冒险热血", "畅销",
                    "大人系", "宅向", "萌娃", "宠兽", "异形", "撒糖", "诡异", "言情", "西方", "滑稽搞笑", "同居", "人外",
                    "白切黑", "并肩作战", "救赎", "戏精", "美强惨", "非人类", "原创", "黑白漫", "无限流",
                    "升级", "爽", "轻橘", "女帝", "偏执", "自由", "星际", "可盐可甜", "反差萌", "聪颖", "智商在线",
                    "倔强", "狼人", "欢喜冤家", "吸血鬼", "萌宠", "学校", "台湾作品", "彩色", "武术", "短篇", "契约", "魔王",
                    "无敌", "美女", "暧昧", "网游", "宅男", "追逐梦想", "冒险奇幻", "疯批", "中二", "召唤", "法宝", "钓系", "鬼怪",
                    "占有欲", "阳光", "元气", "强制爱", "黑道", "马甲", "阴郁", "忧郁", "哲理", "病娇", "喜剧", "江湖恩怨",
                    "相爱相杀", "萌", "SM", "精选", "生子", "年下", "18+限制", "日久生情", "梦想", "多攻", "竹马", "骨科", "gnbq"
                  ],
                itemType: "category",
                categoryParams: [
                    "", "shaonianrexue", "wuxiagedou", "kehuanmohuan", "jingjitiyu", "baoxiaoxiju", "zhentantuili", "kongbulingyi",
                    "danmeirensheng", "shaonvaiqing", "lianaishenghuo", "shenghuomanhua", "zhanzhengmanhua", "gushimanhua",
                    "qitamanhua", "aiqing", "weimei", "wuxia", "xuanhuan", "hougong", "zhiyu", "lizhi", "gufeng", "xiaoyuan", "nuexin",
                    "mohuan", "maoxian", "huanlexiang", "jiecao", "xuanyi", "lishi", "zhichang", "shengui", "mingxing", "chuanyue",
                    "baihe", "xifangmohuan", "chunai", "yinyuewudao", "qingxiaoshuo", "zhentan", "weiniang", "xianxia", "sige", "juqing",
                    "mengxi", "dongfang", "xingzhuanhuan", "zhaixi", "meishi", "naodong", "jingxian", "baoxiao", "dushi", "qiangwei",
                    "lianai", "gedou", "kehuan", "mofa", "qihuan", "rexue", "qita", "gaoxiao", "shenghuo", "kongbu", "jiakong", "jingji",
                    "zhanzheng", "gaoxiaoxiju", "qingchun", "langman", "shuangliu", "shenhua", "qingsong", "richang", "jiating", "hunyin",
                    "dongzuo", "zhandou", "yineng", "neihan", "tongren", "jingqi", "zhengju", "tuili", "chongwu", "wenxin", "yishijie",
                    "yanyi", "jingsong", "jianniang", "jizhan", "caihong", "danmei", "qingsonggaoxiao", "xiuzhenlianaijiakong", "fuchou",
                    "bazong", "duanzi", "nixi", "shaonao", "yulequan", "jiujie", "gandong", "haomen", "tiyu", "jijia", "moshi", "lingyi",
                    "jiangshi", "gongting", "quanmou", "weilai", "keji", "shangzhan", "xiangcun", "zhenhan", "youxi",
                    "zhongkouwei", "xuexing", "doubi", "sangshi", "shenmo", "xiuzhen", "shehui", "zhaohuanshou", "zhuangbi",
                    "xinzuo", "mangai", "zhenren", "yundong", "gaozhishang", "xuanyituili", "jizhi", "shishi", "luoli","gongdou",
                    "yujie", "egao", "jingpin", "rigeng", "xiaoshuogaibian", "fangyi", "xixie", "anhei", "zongcai", "zhongsheng",
                    "danvzhu", "xitong", "shenxian", "mori", "guaiwu", "yaoguai", "xiuxian", "zhaidou", "shenhao", "gaotian",
                    "dianjing", "haokuai", "lieqi", "duoshijie", "xingzhuan", "shaonv", "gaibian", "nvsheng", "yinv", "nansheng",
                    "xiongdiqing", "zhidou", "shaonan", "lianzai", "qihuanmaoxian", "gufengchuanyue", "langmanaiqing", "guzhuang",
                    "youmogaoxiao", "ouxiang", "xiaojiangshi", "BL", "shaonian", "juwei", "qinggan", "jingdian",
                    "fuhei", "dushidanvzhu", "zhiyu2", "meishaonv", "shaoer", "nuanmeng", "changtiao", "xianzhiji", "zhiyinmanke",
                    "kejin", "dujia", "qinqing", "xiandai", "wuxiaxianxia", "xihuan", "chaojiyingxiong", "nvshen", "huanxiang",
                    "oufeng", "yangcheng", "dongzuomaoxian", "GL", "judiao", "xuanyilingyi", "gudaigongting", "oushigongting",
                    "youxijingji", "juxi", "qihuanaiqing", "jiakongshijie", "unknown", "furui", "xiuji", "xiandaiyanqing", "gudaiyanqing",
                    "haomenzongcai", "xianyanmengbao", "xuanhuanyanqing", "nuezha", "tuanchong", "guyanmengbao", "xianyantianchong",
                    "guyannaodong", "AA", "jinshouzhi", "xuanhuannaodong", "dushinaodong", "tianchong", "lunli", "shengcun", "TL",
                    "xuanyinaodong", "heian", "dute", "chengzhang", "huanxiangyanqing", "zhibo", "youxitiyu", "xianyannaodong",
                    "yinyue", "shuangnanzhu", "dihua", "LGBTQ", "zhengnengliang", "junshi", "ABO", "xuanyikongbu", "xuanhuankehuan", "tougao",
                    "zhongtian", "jingying", "fantaolu", "wujiecao", "qiangqiang", "kesulu", "wudiliu", "maoxianrexue", "changxiao",
                    "darenxi", "zhaixiang", "mengwa", "chongshou", "yixing", "satang", "guiyi", "yanqing", "xifang", "huajigaoxiao", "tongju",
                    "renwai", "baiqiehei", "bingjianzuozhan", "jiushu", "xijing", "meiqiangcan", "feirenlei", "yuanchuang", "heibaiman",
                    "wuxianliu", "shengji", "shuang", "qingju", "nvdi", "pianzhi", "ziyou", "xingji", "keyanketian", "fanchameng", "congying",
                    "zhishangzaixian", "juejiang", "langren", "huanxiyuanjia", "xixiegui", "mengchong", "xuexiao", "taiwanzuopin", "caise",
                    "wushu", "duanpian", "qiyue", "mowang", "wudi", "meinv", "aimei", "wangyou", "zhainan", "zhuizhumengxiang", "maoxianqihuan",
                    "fengpi", "zhonger", "zhaohuan", "fabao", "diaoxi", "guiguai", "zhanyouyu", "yangguang", "yuanqi", "qiangzhiai", "heidao",
                    "majia", "yinyu", "youyu", "zheli", "bingjiao", "xiju", "jianghuenyuan", "xiangaixiangsha", "meng", "SM", "jingxuan", "shengzi",
                    "nianxia", "18xianzhi", "rijiushengqing", "mengxiang", "duogong", "zhuma", "guke", "gnbq"
                ],
            }
        ],
        // enable ranking page
        enableRankingPage: false,
    }

    parseComics(html, onePage = false) {
        const doc = new HtmlDocument(html);
        const comics = [];
        for (let comic of doc.querySelectorAll(".itemBox")) {
            comics.push(new Comic({
                id: comic.attributes["data-key"],
                title: comic.querySelector(".title").text,
                cover: comic.querySelector("img").attributes["src"]
            }));
        }
        return {comics: comics, maxPage: onePage ? 1 : parseInt(doc.querySelector("#total-page").attributes["value"])};
    }

    parseList(doc) {
        const comics = [];
        for (let comic of doc.querySelectorAll(".list-comic")) {
            comics.push(new Comic({
                id: comic.attributes["data-key"],
                title: comic.querySelector(".txtA").text,
                cover: comic.querySelector("img").attributes["src"]
            }));
        }
        return comics;
    }

    /// category comic loading related
    categoryComics = {
        load: async (category, params, options, page) => {
            if (params.endsWith(".html")) {
                const res = await Network.get(`${this.baseUrl}${params}`);
                if (res.status !== 200) {
                    throw `Invalid status code: ${res.status}`;
                }
                return this.parseComics(res.body, true);
            } else {
                const res = await Network.get(`${this.baseUrl}/list/?filter=${params}-${options[0]}-${options[1]}-${options[2]}&sort=${options[3]}&page=${page}`);
                console.warn(`${this.baseUrl}/list/?filter=${params}-${options[0]}-${options[1]}-${options[2]}&sort=${options[3]}&page=${page}`)
                if (res.status !== 200) {
                    throw `Invalid status code: ${res.status}`;
                }
                const doc = new HtmlDocument(res.body);
                return {comics: this.parseList(doc),
                    maxPage: parseInt(doc.querySelector("#total-page").attributes["value"])};
            }
        },
        optionLoader: async (category, params) => {
            if (!params.endsWith(".html")) {
                return [
                    {
                        options: [
                            "-全部",
                            "ertong-儿童漫画",
                            "shaonian-少年漫画",
                            "shaonv-少女漫画",
                            "qingnian-青年漫画",
                            "bailingmanhua-白领漫画",
                            "tongrenmanhua-同人漫画"
                        ]
                    },
                    {
                        options: [
                            "-全部",
                            "wanjie-已完结",
                            "lianzai-连载中",
                        ]
                    },
                    {
                        options: [
                            "-全部",
                            "rhmh-日韩",
                            "dlmh-大陆",
                            "gtmh-港台",
                            "taiwan-台湾",
                            "ommh-欧美",
                            "hanguo-韩国",
                            "qtmg-其他",
                        ]
                    },
                    {
                        options: [
                            "update-更新",
                            "post-发布",
                            "click-点击",
                        ]
                    },
                ];
            }
            return [];
        }
    }

    /// search related
    search = {
        load: async (keyword, options, page) => {
            const res = await Network.get(`${this.baseUrl}/search/?keywords=${keyword}&sort=${options[0]}&page=${page}`);
            if (res.status !== 200) {
                throw `Invalid status code: ${res.status}`;
            }
            return this.parseComics(res.body);
        },

        // provide options for search
        optionList: [
            {
                options: [
                    "update-更新",
                    "post-发布",
                    "click-点击",
                ],
                label: "排序"
            }
        ],

        // enable tags suggestions
        enableTagsSuggestions: false,
    }

    /// single comic related
    comic = {
        loadInfo: async (id) => {
            const res = await Network.get(`${this.baseUrl}/comic/${id}.html`);
            if (res.status !== 200) {
                throw `Invalid status code: ${res.status}`;
            }
            const doc = new HtmlDocument(res.body);
            const title = doc.querySelector(".BarTit").text;
            const cover = doc.querySelector(".pic").querySelector("img").attributes["src"];
            const description = doc.querySelector("#full-des")?.text;
            const infos = doc.querySelectorAll(".txtItme");
            const tags = [];
            for (let tag of doc.querySelector(".sub_r").querySelectorAll("a")) {
                const tag_name = tag.text;
                if (tag_name.length > 0) {
                    tags.push(tag_name);
                }
            }
            const chapters = {};
            const chapterElements = doc.querySelector(".chapter-warp")?.querySelectorAll("li");
            if (chapterElements) {
                for (let ch of chapterElements) {
                    const id = ch.querySelector("a").attributes["href"].replace("/comic/", "").replace(".html", "").split("/").join("_");
                    chapters[id] = ch.querySelector("span").text;
                }
            }
            return {
                title: title,
                cover: cover,
                description: description,
                tags: {
                    "作者": [infos[0].text.replaceAll("\n", "").replaceAll("\r", "").trim()],
                    "更新": [infos[3].querySelector(".date").text],
                    "标签": tags.slice(0,-1)
                },
                chapters: chapters,
                recommend: this.parseList(doc)
            };

        },

        loadEp: async (comicId, epId) => {
            const ids = epId.split("_");
            const res = await Network.get(`${this.baseUrl}/comic/${ids[0]}/${ids[1]}.html`);
            if (res.status !== 200) {
                throw `Invalid status code: ${res.status}`;
            }
            const html = res.body;
            const start = html.search(`var chapterImages = `) + 22;
            const end = html.search(`;var chapterPath = `) - 2;
            const end2 = html.search(`;var chapterPrice`) - 1;
            const images = html.substring(start, end).split(`","`);
            const cpath = html.substring(end + 22, end2);
            for (let i = 0; i < images.length; i++) {
                images[i] = "https://gmh1234.wszwhg.net/" + cpath + images[i].replaceAll("\\", "");
                images[i] = images[i].replaceAll("//", "/");
            }
            return { images };
        },

        // enable tags translate
        enableTagsTranslate: false,
    }
}