/** @type {import('./_venera_.js')} */
class Baihehui extends ComicSource {
    // Note: The fields which are marked as [Optional] should be removed if not used

    // name of the source
    name = "百合会"

    // unique id of the source
    key = "baihehui"

    version = "1.0.0"

    minAppVersion = "1.4.0"

    // update url
    url = "https://git.nyne.dev/nyne/venera-configs/raw/branch/main/baihehui.js"

    settings = {
        domains: {
            title: "主页源",
            type: "select",
            options: [
                { value: "yamibo.com" },
            ],
            default: "yamibo.com"
        },
    }

    get baseUrl() {
        return `https://www.${this.loadSetting('domains')}`;
    }

    /**
     * [Optional] init function
     */
    init() {

    }

    account = {
        login: async (username, password) => {
            Network.deleteCookies("https://www.yamibo.com");
            // 1. GET 登录页，保存 PHPSESSID 和 _csrf-frontend
            let resGet = await Network.get("https://www.yamibo.com/user/login", {
                headers: { "User-Agent": "Mozilla/5.0" }
            });
            if (resGet.status !== 200) throw "无法打开登录页";

            // 1.1 提取并保存 GET 返回的 Set-Cookie
            let sc1 = resGet.headers["set-cookie"] || resGet.headers["Set-Cookie"] || [];
            let initialCookies = [];
            for (let line of Array.isArray(sc1) ? sc1 : [sc1]) {
                let [pair] = line.split(";");
                let [name, value] = pair.split("=");
                name = name.trim(); value = value.trim();
                if (name === "PHPSESSID" || name === "_csrf-frontend") {
                    initialCookies.push(new Cookie({ name, value, domain: "www.yamibo.com" }));
                }
            }
            Network.setCookies("https://www.yamibo.com", initialCookies);

            // 2. 解析 CSRF token
            let doc = new HtmlDocument(resGet.body);
            let csrf = doc
                .querySelector('meta[name="csrf-token"]')
                .attributes.content;
            doc.dispose();

            // 3. 构造编码后的表单
            let form = [
                `_csrf-frontend=${encodeURIComponent(csrf)}`,
                `LoginForm%5Busername%5D=${encodeURIComponent(username)}`,
                `LoginForm%5Bpassword%5D=${encodeURIComponent(password)}`,
                'LoginForm%5BrememberMe%5D=0',
                'LoginForm%5BrememberMe%5D=1',
                `login-button=${encodeURIComponent("登录")}`
            ].join("&");

            // 4. POST 登录（会自动带上刚才的 Cookie）
            let resPost = await Network.post(
                "https://www.yamibo.com/user/login",
                {
                    "Content-Type": "application/x-www-form-urlencoded",
                    "Referer": "https://www.yamibo.com/user/login",
                    "User-Agent": "Mozilla/5.0"
                },
                form
            );
            if (resPost.status === 400) throw "登录失败";
            Network.deleteCookies("https://www.yamibo.com");

            // …account.login 中 POST 后提取 Cookie 部分…
            let raw = resPost.headers["set-cookie"] || resPost.headers["Set-Cookie"];
            if (!raw) throw "未收到任何 Cookie";

            // 1. 将单条字符串按“逗号+Cookie名=”拆分
            let parts = Array.isArray(raw)
                ? raw
                : raw.split(/,(?=\s*(?:PHPSESSID|_identity-frontend|_csrf-frontend)=)/);

            // 2. 提取目标 Cookie
            const names = ["PHPSESSID", "_identity-frontend", "_csrf-frontend"];
            let cookies = parts.map(line => {
                let [pair] = line.split(";");
                let [k, v] = pair.split("=");
                k = k.trim(); v = v.trim();
                if (names.includes(k)) return new Cookie({ name: k, value: v, domain: "www.yamibo.com" });
            }).filter(Boolean);

            // 3. 验证并保存
            if (cookies.length !== names.length) {
                throw "登录未返回完整 Cookie，实际：" + cookies.map(c => c.name).join(",");
            }
            Network.setCookies("https://www.yamibo.com", cookies);

            return true;
        },

        logout: () => {
            Network.deleteCookies("https://www.yamibo.com");
        },

        registerWebsite: "https://www.yamibo.com/user/signup"
    }


    static category_types = {
        "全部作品": "manga/list@a@?",
        "原创": "manga/list?q=4@a@&",
        "同人": "manga/list?q=6@a@&",
    }

    static article_types = {
        "翻页漫画": "search/type?type=3&tag=@b@翻页漫画",
        "条漫": "search/type?type=3&tag=@b@条漫",
        "四格": "search/type?type=3&tag=@b@四格",
        "绘本": "search/type?type=3&tag=@b@绘本",
        "杂志": "search/type?type=3&tag=@b@杂志",
        "合志": "search/type?type=3&tag=@b@合志",
    }

    static relate_types = {
        "编辑推荐": "manga/rcmds?type=3012@c@&",
        "最近更新": "manga/latest@c@?",
        "原创推荐": "manga/rcmds?type=3014@c@&",
        "同人推荐": "manga/rcmds?type=3015@c@&",
    }




// explore page list
explore = [
    {
        title: "百合会",
        type: "singlePageWithMultiPart",
        load: async (page) => {
                // 1. 拿到 HTML
                let res = await Network.get("https://www.yamibo.com/site/manga");
                if (res.status !== 200) {
                    throw `Invalid status code: ${res.status}`;
                }

                // 2. 解析文档
                let doc = new HtmlDocument(res.body);

                // 3. 通用解析单元函数
                function parseItem(el) {
                    let a = el.querySelector(".media-img") || el.querySelector("a.media-img");
                    let href = a.attributes.href;
                    let id = href.match(/\/manga\/(\d+)/)[1];
                    // 从 style 中提取 url
                    let style = a.attributes.style || "";
                    let cover = `https://www.yamibo.com/coverm/000/000/${id}.jpg`;
                    let title = el.querySelector("h3 a").text.trim();
                    return new Comic({ id, title, cover });
                }

                // 4. 抓「编辑推荐」
                let editor = [];
                let editorEls = doc.querySelectorAll(".recommend-list .media-cell.horizontal");
                for (let el of editorEls) {
                    editor.push(parseItem(el));
                }

                // 5. 抓「最近更新」
                let latest = [];
                // 找到标题元素，再拿其后面的 <ul> 下的 .media-cell.vertical
                let latestTitle = doc.querySelectorAll("h2.module-title")
                    .find(e => e.text.includes("最近更新"));
                if (latestTitle) {
                    let ul = latestTitle.nextElementSibling;
                    if (ul) {
                        let items = ul.querySelectorAll(".media-cell.vertical");
                        for (let el of items) latest.push(parseItem(el));
                    }
                }

                // 原创推荐
                let original = [];
                let originalTitle = doc.querySelectorAll("h2.module-title")
                    .find(e => e.text.includes("原创推荐"));
                if (originalTitle) {
                    let ul = originalTitle.nextElementSibling;
                    if (ul) {
                        let items = ul.querySelectorAll(".media-cell.vertical");
                        for (let el of items) original.push(parseItem(el));
                    }
                }

                // 6. 抓「同人推荐」
                let fan = [];
                let fanTitle = doc.querySelectorAll("h2.module-title")
                    .find(e => e.text.includes("同人推荐"));
                if (fanTitle) {
                    let ul = fanTitle.nextElementSibling;
                    if (ul) {
                        let items = ul.querySelectorAll(".media-cell.vertical");
                        for (let el of items) fan.push(parseItem(el));
                    }
                }

                // 7. 清理并返回
                doc.dispose();
                return {
                    "编辑推荐": editor,
                    "最近更新": latest,
                    "原创推荐": original,
                    "同人推荐": fan
                };
            }
    }
];

    // categories
    category = {
        /// title of the category page, used to identify the page, it should be unique
        title: "百合会",
        parts: [
            {
                name: "分类",
                type: "fixed",
                categories: Object.keys(Baihehui.category_types),
                itemType: "category",
                categoryParams: Object.values(Baihehui.category_types),
            },
            {
                name: "作品类型（需要登陆）",
                type: "fixed",
                categories: Object.keys(Baihehui.article_types),
                itemType: "category",
                categoryParams: Object.values(Baihehui.article_types),
            },
            {
                name: "更多推荐",
                type: "fixed",
                categories: Object.keys(Baihehui.relate_types),
                itemType: "category",
                categoryParams: Object.values(Baihehui.relate_types),
            },
        ],
        // enable ranking page
        enableRankingPage: false,
    }

    /// category comic loading related
    categoryComics = {
        load: async (category, params, options, page) => {
            let param = params.split('@')[0];
            let type = params.split('@')[1];
            let type_options = params.split('@')[2];
            let url = ""
            if (type == "b") {
                url = `${this.baseUrl}/${param}${encodeURIComponent(type_options)}&sort=updated_at`;
                url += `&page=${page}&per-page=50`;
            } else {
                url = `${this.baseUrl}/${param}${type_options}sort=updated_at`;
                url += `&page=${page}&per-page=50`;
            }

            // 发起请求
            let res = await Network.get(url, {
                headers: { "User-Agent": "Mozilla/5.0" }
            });
            if (res.status !== 200) {
                throw `Invalid status code: ${res.status}`;
            }


            // 解析 HTML
            let document = new HtmlDocument(res.body);

            // 获取最大页数
            let lastPageElement = document.querySelector('li.last > a');
            let maxPage = lastPageElement ? parseInt(lastPageElement.attributes['data-page']) + 1 : 1;


            // 分类解析、
            if (type == "a") {
                let mangaList = [];
                // 获取所有漫画行
                let rows = document.querySelectorAll('tr[data-key]');

                rows.forEach(row => {
                    // 提取信息
                    let href = row.querySelector('a').attributes['href'];
                    // 提取最后的数字作为 id
                    let rawId = href.match(/\/manga\/(\d+)$/)[1];

                    // 补零处理 - 确保id是3位数
                    let id = rawId.padStart(3, '0');
                    let title = row.querySelector('a').text;
                    let author = row.querySelectorAll('td')[2].text;

                    // 获取标签
                    let tags = [
                        row.querySelectorAll('td')[4].text, // 作品分类(原创/同人)
                        row.querySelectorAll('td')[5].text  // 连载状态
                    ];

                    // 获取更新时间作为描述
                    let updateTime = row.querySelectorAll('td')[8].text;

                    // 构建漫画对象
                    let manga = {
                        id: id,
                        title: title,
                        cover: `https://www.yamibo.com/coverm/000/000/${id}.jpg`, // 默认封面
                        tags: tags,
                        description: `更新于: ${updateTime}`
                    };

                    mangaList.push(manga);
                });

                return {
                    comics: mangaList,
                    maxPage: maxPage // 从分页信息可以看出总共5页
                };
            } else if (type == "b") {
                let mangaList = [];
                // 获取所有漫画行
                let rows = document.querySelectorAll('tr[data-key]');
                rows.forEach(row => {
                    // 提取信息
                    let href = row.querySelector('a').attributes['href'];
                    // 提取最后的数字作为 id
                    let rawId = href.match(/\/manga\/(\d+)$/)[1];
                    // 补零处理 - 确保id是3位数
                    let id = rawId.padStart(3, '0');
                    let title = row.querySelector('a').text;
                    let author = row.querySelectorAll('td')[2].text;

                    // 获取标签
                    let tags = [
                        row.querySelectorAll('td')[3].text.replace(/\[|\]/g, ''), // 作品分类 (去掉方括号)
                        row.querySelectorAll('td')[4].text // 连载状态
                    ];

                    // 获取更新时间作为描述
                    let updateTime = row.querySelectorAll('td')[6].text;

                    // 构建封面 URL
                    let cover = `https://www.yamibo.com/coverm/000/000/${id}.jpg`;

                    // 构建漫画对象
                    let manga = {
                        id: id,
                        title: title,
                        cover: cover, // 使用有效封面或默认封面
                        tags: tags,
                        description: `${updateTime}`
                    };

                    mangaList.push(manga);
                });

                return {
                    comics: mangaList,
                    maxPage: maxPage // 从分页信息可以看出总共8页
                };
            } else {
                let mangaList = [];
                // 获取所有漫画行
                let rows = document.querySelectorAll('tr[data-key]');
                rows.forEach(row => {
                    // 提取信息
                    let href = row.querySelector('a').attributes['href'];
                    // 提取最后的数字作为 id
                    let rawId = href.match(/\/manga\/(\d+)$/)[1];
                    // 补零处理 - 确保id是3位数
                    let id = rawId.padStart(3, '0');
                    let title = row.querySelector('a').text;

                    // 获取更新时间作为描述
                    let updateTime = row.querySelector('td:last-child').text.trim();

                    // 构建封面 URL
                    let cover = `https://www.yamibo.com/coverm/000/000/${id}.jpg`;

                    // 构建漫画对象
                    let manga = {
                        id: id,
                        title: title,
                        cover: cover, // 使用有效封面或默认封面
                        tags: [],
                        description: `更新于: ${updateTime}`
                    };

                    mangaList.push(manga);
                });

                return {
                    comics: mangaList,
                    maxPage: maxPage // 从分页信息可以看出总共8页
                };
            }
        }
    }

    /// search related
    search = {
        /**
         * load search result
         * @param keyword {string}
         * @param options {string[]} - options from optionList
         * @param page {number}
         * @returns {Promise<{comics: Comic[], maxPage: number}>}
         */
        load: async (keyword, options, page) => {
            let url = `https://www.yamibo.com/search/manga?SearchForm%5Bkeyword%5D=${encodeURIComponent(keyword)}&page=${page}`;
    let res = await Network.get(url, {
        headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/114.0"
        }
    });

    if (res.status !== 200) {
        throw `Invalid status code: ${res.status}`;
    }

    let document = new HtmlDocument(res.body);
    // 获取最大页数
    let lastPageElement = document.querySelector('li.last > a');
    let maxPage = lastPageElement ? parseInt(lastPageElement.attributes['data-page']) + 1 : 1;
    // 提取漫画列表
    let mangaList = [];
                // 获取所有漫画行
                let rows = document.querySelectorAll('tr[data-key]');
                rows.forEach(row => {
                    // 提取信息
                    let href = row.querySelector('a').attributes['href'];
                    // 提取最后的数字作为 id
                    let rawId = href.match(/\/manga\/(\d+)$/)[1];
                    // 补零处理 - 确保id是3位数
                    let id = rawId.padStart(3, '0');
                    let title = row.querySelector('a').text;

                    // 获取更新时间作为描述
                    let updateTime = row.querySelector('td:last-child').text.trim();

                    // 构建封面 URL
                    let cover = `https://www.yamibo.com/coverm/000/000/${id}.jpg`;

                    // 构建漫画对象
                    let manga = {
                        id: id,
                        title: title,
                        cover: cover, // 使用有效封面或默认封面
                        tags: [],
                        description: `更新于: ${updateTime}`
                    };

                    mangaList.push(manga);
                });

                return {
                    comics: mangaList,
                    maxPage: maxPage // 从分页信息可以看出总共8页
                };
        },

        /**
         * load search result with next page token.
         * The field will be ignored if `load` function is implemented.
         * @param keyword {string}
         * @param options {(string)[]} - options from optionList
         * @param next {string | null}
         * @returns {Promise<{comics: Comic[], maxPage: number}>}
         */
        loadNext: async (keyword, options, next) => {

        },

        // provide options for search
        optionList: [],

        // enable tags suggestions
        enableTagsSuggestions: false,
    }

    /// single comic related
    comic = {
        /**
         * load comic info
         * @param id {string}
         * @returns {Promise<ComicDetails>}
         */
        loadInfo: async (id) => {
            let res = await Network.get(`${this.baseUrl}/manga/${id}`);
            if (res.status !== 200) {
                throw `Invalid status code: ${res.status}`;
            }

            let document = new HtmlDocument(res.body);

            // 提取漫画标题
            let title = document.querySelector("h3.col-md-12").text.trim();

            // 提取封面图片
            let cover = "https://www.yamibo.com/coverm/000/000/" + id + ".jpg";

            // 提取作者信息
            let author = "";
            document.querySelectorAll("p").forEach(p => {
                if (p.text.includes("作者：")) {
                    author = p.text.replace("作者：", "").trim();
                }
            });

            // 提取标签
            let tags = [];
            document.querySelectorAll("a.label.label-ntype").forEach(tag => {
                tags.push(tag.text.trim());
            });

            // 提取更新时间
            let updateTime = "";
            document.querySelectorAll("p").forEach(p => {
                if (p.text.includes("更新时间：")) {
                    updateTime = p.text.replace("更新时间：", "").trim();
                }
            });

            // 提取简介
            //let description = document.querySelector("div.panel-body > div.panel-collapse > div.panel-body").text.trim();
            let description = "";

            // 提取章节信息
            let chapters = new Map();
            document.querySelectorAll("div[data-key]").forEach(chapter => {
                let chapterKey = chapter.attributes['data-key']; // 获取 data-key 值
                let chapterTitle = chapter.querySelector("a").text.trim(); // 获取章节标题
                chapters.set(chapterKey, chapterTitle); // 将 data-key 和章节标题存入 Map
            });

            return {
                title: title,
                cover: cover,
                description: description,
                tags: {
                    "作者": [author],
                    "更新": [updateTime],
                    "标签": tags
                },
                chapters: chapters
            };

        },
        loadComments: async (comicId, subId, page, replyTo) => {
            let url = `${this.baseUrl}/manga/${comicId}?dp-1-page=${page}`;
            let res = await Network.get(url, {
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/114.0"
                }
            });

            if (res.status !== 200) {
                throw `Invalid status code: ${res.status}`;
            }

            let document = new HtmlDocument(res.body);

            // 提取评论总数
            let totalCommentsMatch = document.querySelector("div.panel-body").text.match(/共(\d+)篇/);
            let totalComments = totalCommentsMatch ? parseInt(totalCommentsMatch[1]) : 0;

            // 提取评论列表
            let comments = [];
            document.querySelectorAll("div.post.row").forEach(post => {
                let userName = post.querySelector("span.cmt-username > a").text.trim();
                let avatar = "https://www.yamibo.com/" + post.querySelector("a > img.cmt-avatar").attributes['src'];
                let content = post.querySelector("div.row > p").text.trim();
                let time = post.querySelector("span.description").text.replace("在 ", "").trim();
                let replyCountMatch = post.querySelector("a.btn.btn-sm").text.match(/(\d+) 条回复/);
                let replyCount = replyCountMatch ? parseInt(replyCountMatch[1]) : 0;
                let id = post.querySelector("button.btn_reply").attributes['pid'];

                comments.push({
                    userName: userName,
                    avatar: avatar,
                    content: content,
                    time: time,
                    replyCount: replyCount,
                    id: id
                });
            });

            // 计算最大页数
            let maxPageElement = document.querySelector("li.last > a");
            let maxPage = maxPageElement ? parseInt(maxPageElement.attributes['data-page']) + 1 : 1;

            return {
                comments: comments,
                totalComments: totalComments,
                maxPage: maxPage
            };
        },

        loadEp: async (comicId, epId) => {
            let baseUrl = `https://www.yamibo.com/manga/view-chapter?id=${epId}`;
    let res = await Network.get(`${baseUrl}&page=1`, {
        headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/114.0"
        }
    });

    if (res.status !== 200) {
        throw `Invalid status code: ${res.status}`;
    }

    let document = new HtmlDocument(res.body);

    // 提取最大页数
    let lastPageElement = document.querySelector("li.last > a");
    let maxPage = lastPageElement ? parseInt(lastPageElement.attributes['data-page']) + 1 : 1;

    let images = [];

    // 循环抓取所有页面的图片
    for (let page = 1; page <= maxPage; page++) {
        let pageUrl = `${baseUrl}&page=${page}`;
        let pageRes = await Network.get(pageUrl, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/114.0"
            }
        });

        if (pageRes.status !== 200) {
            throw `Invalid status code on page ${page}: ${pageRes.status}`;
        }

        let pageDocument = new HtmlDocument(pageRes.body);

        // 提取图片 URL
        let imageElement = pageDocument.querySelector("img#imgPic");
        if (!imageElement) {
            throw `Image not found on page ${page}.`;
        }
        let imageUrl = imageElement.attributes['src'];
        images.push(imageUrl);
    }

    return {
        images: images, // 所有页面的图片 URL
        maxPage: maxPage
    };
        },

        // enable tags translate
        enableTagsTranslate: false,
    }
}