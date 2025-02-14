class NewComicSource extends ComicSource {  // 首行必须为class...

    // 此漫画源的名称
    name = "爱看漫"

    // 唯一标识符
    key = "ikmmh"

    version = "1.0.0"

    minAppVersion = "1.0.0"

    // 更新链接
    url = "https://cdn.jsdelivr.net/gh/venera-app/venera-configs@main/ikmmh.js"

    /// APP启动时或者添加/更新漫画源时执行此函数
    init() {

    }

    /// 账号
    /// 设置为null禁用账号功能
    account = {
        /// 登录
        /// 返回任意值表示登录成功
        login: async (account, pwd) => {
            let res = await Network.post("https://ymcdnyfqdapp.ikmmh.com/api/user/userarr/login", {
                "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"
            }, `user=${account}&pass=${pwd}`)

            let data = JSON.parse(res.body)

            if (res.status !== 200) {
                throw "Invalid status code: " + res.status
            } else if (data["code"] !== 0) {
                throw "Invalid response: " + data["msg"]
            } else {
                return 'ok'
            }

        },

        // 退出登录时将会调用此函数
        logout: () => {
            Network.deleteCookies("ymcdnyfqdapp.ikmmh.com")
        },

        registerWebsite: "https://ymcdnyfqdapp.ikmmh.com/user/register/"
    }

    /// 探索页面
    /// 一个漫画源可以有多个探索页面
    explore = [
        {
            /// 标题
            /// 标题同时用作标识符, 不能重复
            title: this.name,

            /// singlePageWithMultiPart 或者 multiPageComicList
            type: "singlePageWithMultiPart",

            /*
            加载漫画
            如果类型为multiPageComicList, load方法应当接收一个page参数, 并且返回漫画列表
            ```
            load: async (page) => {
                let res = await Network.get("https://example.com")

                if (res.status !== 200) {
                    throw `Invalid status code: ${res.status}`
                }

                let data = JSON.parse(res.body)

                function parseComic(comic) {
                    // ...

                    return {
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
                    maxPage: data.maxPage
                }
            }
            ```
            */
            load: async () => {
                let res = await Network.get("https://ymcdnyfqdapp.ikmmh.com/", {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"
                })
                if (res.status !== 200) {
                    throw "Invalid status code: " + res.status
                }
                let document = new HtmlDocument(res.body)
                function parseComicDom(comicDom) {
                    let title = comicDom.querySelector("h4").text
                    let cover = comicDom.querySelector("img").attributes["data-src"]
                    let tags = []
                    let tagDoms = comicDom.querySelectorAll("div.tag-wrap > p")
                    for (let j = 0; j < tagDoms.length; j++) {
                        tags.push(tagDoms[j].text.trim())
                    }
                    tagDoms = comicDom.querySelectorAll("div.anime-mask > p")
                    for (let j = 0; j < tagDoms.length; j++) {
                        tags.push(tagDoms[j].text.trim())
                    }
                    let link = comicDom.querySelector("a").attributes["href"]
                    link = "https://ymcdnyfqdapp.ikmmh.com" + link
                    return {
                        title: title,
                        cover: cover,
                        tags: tags,
                        id: link
                    };
                }

                let data = {
                    "海量精品漫画": document.querySelectorAll("ul.panel-comic-r > li").map(parseComicDom),
                    "热门人气新番": document.querySelectorAll("ul.list-anime > li").map(parseComicDom),
                }
                
                return data
            }
        }
    ]

    /// 分类页面
    /// 一个漫画源只能有一个分类页面, 也可以没有, 设置为null禁用分类页面
    category = {
        /// 标题, 同时为标识符, 不能与其他漫画源的分类页面重复
        title: "爱看漫",
        parts: [
            {
                name: "分类",

                // fixed 或者 random
                // random用于分类数量相当多时, 随机显示其中一部分
                type: "fixed",

                // 如果类型为random, 需要提供此字段, 表示同时显示的数量
                // randomNumber: 5,

                categories: ["全部", "长条", "大女主", "百合", "耽美", "纯爱", "後宫", "韩漫", "奇幻", "轻小说", "生活", "悬疑", "格斗", "搞笑", "伪娘", "竞技", "职场", "萌系", "冒险", "治愈", "都市", "霸总", "神鬼", "侦探", "爱情", "古风", "欢乐向", "科幻", "穿越", "性转换", "校园", "美食", "悬疑", "剧情", "热血", "节操", "励志", "异世界", "历史", "战争", "恐怖", "霸总", "全部", "连载中", "已完结", "全部", "日漫", "港台", "美漫", "国漫", "韩漫", "未分类",],

                // category或者search
                // 如果为category, 点击后将进入分类漫画页面, 使用下方的`categoryComics`加载漫画
                // 如果为search, 将进入搜索页面
                itemType: "category",
            },
            {
                name: "更新",
                type: "fixed",
                categories: ["星期一", "星期二", "星期三", "星期四", "星期五", "星期六", "星期日"],
                itemType: "category",
                categoryParams: ['1', '2', '3', '4', '5', '6', '7']
            }
        ],
        enableRankingPage: false,
    }

    /// 分类漫画页面, 即点击分类标签后进入的页面
    categoryComics = {
        load: async (category, param, options, page) => {
            category = encodeURIComponent(category)
            let url = ""
            if (param !== undefined && param !== null) {
                url = `https://ymcdnyfqdapp.ikmmh.com/update/${param}.html`
            } else {
                url = `https://ymcdnyfqdapp.ikmmh.com/booklists/${options[1]}/${category}/${options[0]}/${page}.html`
            }
            let res = await Network.get(url, {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"
            })
            if (res.status !== 200) {
                throw "Invalid status code: " + res.status
            }
            let document = new HtmlDocument(res.body)

            function parseComic(element) {
                let title = element.querySelector("h2").text
                let cover = element.querySelector("img").attributes["data-src"]
                let tags = []
                let tagDoms = element.querySelectorAll("div.tag-list > p")
                for (let j = 0; j < tagDoms.length; j++) {
                    tags.push(tagDoms[j].text.trim())
                }
                let link = element.querySelector("a").attributes["href"]
                link = "https://ymcdnyfqdapp.ikmmh.com" + link
                let updateInfo = element.querySelector("p.process").text
                return {
                    title: title,
                    cover: cover,
                    tags: tags,
                    id: link,
                    subTitle: updateInfo
                };
            }

            let maxPage = 1
            if (param === undefined || param === null) {
                maxPage = document.querySelectorAll("ul.list-page > li > a").pop().text
                maxPage = parseInt(maxPage)
            }
            return {
                comics: document.querySelectorAll("ul.list-comic-book > li").map(parseComic),
                maxPage: maxPage
            }
        },
        // 提供选项
        optionList: [
            {
                // 对于单个选项, 使用-分割, 左侧为用于数据加载的值, 即传给load函数的options参数; 右侧为显示给用户的文本
                options: [
                    "3-全部",
                    "4-连载中",
                    "1-已完结",
                ],
                // 提供[]string, 当分类名称位于此数组中时, 禁用此选项
                notShowWhen: ["星期一", "星期二", "星期三", "星期四", "星期五", "星期六", "星期日"],
                // 提供[]string, 当分类名称没有位于此数组中时, 禁用此选项
                showWhen: null
            },
            {
                // 对于单个选项, 使用-分割, 左侧为用于数据加载的值, 即传给load函数的options参数; 右侧为显示给用户的文本
                options: [
                    "9-全部",
                    "1-日漫",
                    "2-港台",
                    "3-美漫",
                    "4-国漫",
                    "5-韩漫",
                    "6-未分类"
                ],
                // 提供[]string, 当分类名称位于此数组中时, 禁用此选项
                notShowWhen: ["星期一", "星期二", "星期三", "星期四", "星期五", "星期六", "星期日"],
                // 提供[]string, 当分类名称没有位于此数组中时, 禁用此选项
                showWhen: null
            },
        ],
    }

    /// 搜索
    search = {
        load: async (keyword, options, page) => {
            let res = await Network.get(`https://ymcdnyfqdapp.ikmmh.com/search?searchkey=${encodeURIComponent(keyword)}`, {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"
            })
            if (res.status !== 200) {
                throw "Invalid status code: " + res.status
            }
            let document = new HtmlDocument(res.body)

            function parseComic(element) {
                let title = element.querySelector("a").text
                let cover = element.querySelector("img").attributes["data-src"]
                let link = element.querySelector("a").attributes["href"]
                link = "https://ymcdnyfqdapp.ikmmh.com" + link
                let updateInfo = element.querySelector("p.describe > a").text
                return {
                    title: title,
                    cover: cover,
                    id: link,
                    subTitle: updateInfo
                };
            }

            return {
                comics: document.querySelectorAll("div.classification").map(parseComic),
                maxPage: 1
            }
        },

        // 提供选项
        optionList: []
    }

    /// 收藏
    favorites = {
        /// 是否为多收藏夹
        multiFolder: false,
        /// 添加或者删除收藏
        addOrDelFavorite: async (comicId, folderId, isAdding) => {
            let id = comicId.split("/")[4]
            if (isAdding) {
                let comicInfoRes = await Network.get(comicId, {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"
                });
                if (comicInfoRes.status !== 200) {
                    throw "Invalid status code: " + res.status
                }
                let document = new HtmlDocument(comicInfoRes.body)
                let name = document.querySelector("h1").text;
                let res = await Network.post("https://ymcdnyfqdapp.ikmmh.com/api/user/bookcase/add", {
                    "Content-Type": "application/x-www-form-urlencoded",
                }, `articleid=${id}&articlename=${name}`)
                if (res.status !== 200) {
                    throw "Invalid status code: " + res.status
                }
                let json = JSON.parse(res.body)
                if (json["code"] === "0" || json["code"] === 0) {
                    return 'ok'
                } else if (json["code"] === 1) {
                    throw "Login expired"
                } else {
                    throw json["msg"].toString()
                }
            } else {
                let res = await Network.post("https://ymcdnyfqdapp.ikmmh.com/api/user/bookcase/del", {
                    "Content-Type": "application/x-www-form-urlencoded",
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"
                }, `articleid=${id}`)
                if (res.status !== 200) {
                    error("Invalid status code: " + res.status)
                    return;
                }
                let json = JSON.parse(res.body)
                if (json["code"] === "0" || json["code"] === 0) {
                    success("ok")
                } else if (json["code"] === 1) {
                    error("Login expired")
                } else {
                    error(json["msg"].toString())
                }
            }
        },
        /// 加载漫画
        loadComics: async (page, folder) => {
            let res = await Network.post("https://ymcdnyfqdapp.ikmmh.com/api/user/bookcase/ajax", {
                "Content-Type": "application/x-www-form-urlencoded",
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"
            }, `page=${page}`)
            if (res.status !== 200) {
                throw "Invalid status code: " + res.status
            }
            let json = JSON.parse(res.body)
            if (json["code"] === 1) {
                throw "Login expired"
            }
            if (json["code"] !== "0" && json["code"] !== 0) {
                throw "Invalid response: " + json["code"]
            }
            let comics = json["data"].map(e => {
                return {
                    title: e["name"],
                    subTitle: e["author"],
                    cover: e["cover"],
                    id: "https://ymcdnyfqdapp.ikmmh.com" + e["info_url"]
                }
            })
            let maxPage = json["end"]
            return {
                comics: comics,
                maxPage: maxPage
            }
        }
    }

    /// 单个漫画相关
    comic = {
        // 加载漫画信息
        loadInfo: async (id) => {
            let res = await Network.get(id, {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"
            })
            if (res.status !== 200) {
                throw "Invalid status code: " + res.status
            }
            let document = new HtmlDocument(res.body)
            let title = document.querySelector("h1.detail-title").text
            let cover = document.querySelector("div.banner-img > img").attributes["data-src"]
            let author = document.querySelector("p.author").text
            let tags = document.querySelectorAll("p.ui-tag > a").map(e => e.text.trim())
            let description = document.querySelector("div.detail-desc").text
            let updateTime = document.querySelector("div.detail-info > div > span > b").text
            let eps = {}
            document.querySelectorAll("ol.chapter-list > li").forEach(element => {
                let title = element.querySelector("a").attributes["title"]
                let id = element.attributes["data-chapter"]
                eps[id] = title
            })
            let comics = document.querySelectorAll("div.mod-vitem-comic").map(element => {
                let title = element.querySelector("h4").text
                let cover = element.querySelector("img").attributes["data-src"]
                let link = element.querySelector("a").attributes["href"]
                link = "https://ymcdnyfqdapp.ikmmh.com" + link
                return {
                    title: title,
                    cover: cover,
                    id: link
                }
            })
            return {
                title: title,
                cover: cover,
                description: description,
                tags: {
                    "作者": [author],
                    "更新": [updateTime],
                    "标签": tags
                },
                chapters: eps,
                suggestions: comics
            }
        },
        // 获取章节图片
        loadEp: async (comicId, epId) => {
            if (comicId.includes("https://")) {
                comicId = comicId.split("/")[4]
            }
            let res = await Network.get(
                `https://ymcdnyfqdapp.ikmmh.com/chapter/${comicId}/${epId}.html`,
                {
                    "Referer": `https://ymcdnyfqdapp.ikmmh.com/book/${comicId}.html`,
                    "User-Agent": "Mozilla/5.0 (Linux; Android 10; SM-G9600) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.181 Mobile Safari/537.36"
                }
            )
            if (res.status !== 200) {
                throw "Invalid status code: " + res.status
            }
            let document = new HtmlDocument(res.body)
            return {
                images: document.querySelectorAll("img.lazy").map(e => e.attributes["data-src"])
            }
        },
        /// 警告: 这是历史遗留问题, 对于新的漫画源, 不应当使用此字段, 在选取漫画id时, 不应当出现特殊字符
        matchBriefIdRegex: "https://ymcdnyfqdapp.ikmmh.com/book/(\\d+)/"
    }
}
