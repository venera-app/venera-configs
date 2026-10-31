class MXS extends ComicSource {
    // 漫画源基本信息
    name = "漫小肆";
    key = "mxs";
    version = "1.0.0";
    minAppVersion = "1.5.0";
    url = "https://cdn.jsdelivr.net/gh/venera-app/venera-configs@main/mxs.js";

    // 漫画源设置项
    settings = {
        // 域名选择功能
        domains: {
            title: "选择域名",
            type: "select",
            options: [
                { value: "https://www.mxshm.top", text: "mxshm.top" },
                { value: "https://www.jjmhw1.top", text: "jjmhw1.top" },
                { value: "https://www.jjmh.top", text: "jjmh.top" },
                { value: "https://www.jjmh.cc", text: "jjmh.cc" },
                { value: "https://www.wzd1.cc", text: "wzd1.cc" },
                { value: "https://www.wzdhm1.cc", text: "wzdhm1.cc" },
                { value: "https://www.ikanwzd.cc", text: "ikanwzd.cc" }
            ],
            default: "https://www.mxshm.top"
        },
        
        // 域名检测功能
        domainCheck: {
            title: "检测当前域名",
            type: "callback",
            buttonText: "检测",
            callback: () => {
                const currentDomain = this.loadSetting("domains");
                const startTime = Date.now();
                let isCompleted = false;
                
                // 显示加载对话框
                const loadingId = UI.showLoading(() => {
                    UI.showMessage("检测已取消");
                    isCompleted = true;
                });
                
                // 10秒超时检测
                setTimeout(() => {
                    if (!isCompleted) {
                        UI.cancelLoading(loadingId);
                        UI.showMessage("❌ 连接超时，可能需要 🚀");
                        isCompleted = true;
                    }
                }, 10000);
                
                // 测试网络连接
                Network.get(currentDomain).then(res => {
                    if (isCompleted) return;
                    const delay = Date.now() - startTime;
                    UI.cancelLoading(loadingId);
                    UI.showMessage(`✅ 连接正常，延迟: ${delay}ms`);
                    isCompleted = true;
                }).catch(() => {
                    if (isCompleted) return;
                    UI.cancelLoading(loadingId);
                    UI.showMessage("❌ 连接失败，可能需要 🚀");
                    isCompleted = true;
                });
            }
        }
    };

    // 获取基础URL
    get baseUrl() {
        return this.loadSetting("domains");
    }

    // 解析普通漫画列表
    parseComicList(items) {
        const comics = [];
        
        for (let item of items) {
            // 提取漫画ID
            const linkElem = item.querySelector("a[href^='/book/']");
            const id = linkElem.attributes.href.split("/").pop();
            
            // 提取标题和作者
            const title = item.querySelector(".title a")?.text?.trim();
            const author = item.querySelector("span a")?.text?.trim();
            
            // 提取描述信息
            const description = item.querySelector(".chapter")?.text?.replace(/^更新/, "")?.replace(/\s+/g, " ")?.trim() || item.querySelector(".zl")?.text?.trim();

            // 验证必要字段并创建漫画对象
            if (id && title) {
                comics.push(new Comic({
                    id: id,
                    title: title,
                    subTitle: author,
                    cover: `${this.baseUrl}/static/upload/book/${id}/cover.jpg`,
                    description: description
                }));
            }
        }
        
        return comics;
    }

    // 解析热门漫画列表
    parseHotComicList(items) {
        const comics = [];
        
        for (let item of items) {
            // 提取漫画ID
            const linkElem = item.querySelector(".cover a[href^='/book/']");
            const id = linkElem.attributes.href.split("/").pop();
            
            // 提取标题、作者和点击量
            const title = item.querySelector(".info .title a")?.text?.trim();
            const author = item.querySelector(".info .desc")?.text?.trim();
            const clickCount = item.querySelector(".info .subtitle span a")?.text?.trim();

            // 提取标签信息
            const tags = [];
            const tagElems = item.querySelectorAll(".info .tag a");
            for (let tagElem of tagElems) {
                if (tagElem.text) tags.push(tagElem.text.trim());
            }

            // 验证必要字段并创建漫画对象
            if (id && title) {
                comics.push(new Comic({
                    id: id,
                    title: title,
                    subTitle: author,
                    cover: `${this.baseUrl}/static/upload/book/${id}/cover.jpg`,
                    tags: tags,
                    description: `热度: 🔥${clickCount}`
                }));
            }
        }
        
        return comics;
    }

    // 解析评论列表
    parseCommentList(items) {
        const comments = [];
        
        for (let item of items) {
            // 提取评论信息
            const userName = item.querySelector(".title")?.text?.trim();
            const content = item.querySelector(".content")?.text?.trim();
            const time = item.querySelector(".bottom")?.text?.match(/\d{4}-\d{2}-\d{2}/)?.[0]?.trim();
            const avatar = item.querySelector(".cover img")?.attributes?.src;

            // 验证必要字段并创建评论对象
            if (userName && content) {
                comments.push(new Comment({
                    userName: userName,
                    avatar: `${this.baseUrl}${avatar}`,
                    content: content,
                    time: time
                }));
            }
        }
        
        return comments;
    }

    // 执行网络请求并返回HTML文档对象
    async fetchDocument(url) {
        const res = await Network.get(url, {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        });
        
        if (res.status !== 200) {
            throw `请求失败: ${res.status}`;
        }
        
        return new HtmlDocument(res.body);
    }

    // === 探索页面配置 ===
    explore = [
        {
            title: "漫小肆",
            type: "multiPartPage",
            load: async (page) => {
                const doc = await this.fetchDocument(this.baseUrl);

                // 最近更新部分
                const updateSection = {
                    title: "最近更新",
                    comics: this.parseComicList(doc.querySelectorAll(".index-manga .mh-item")),
                    viewMore: {
                        page: "category",
                        attributes: { category: "最近更新" }
                    }
                };

                // 热门漫画部分
                const hotSection = {
                    title: "热门漫画",
                    comics: this.parseHotComicList(doc.querySelectorAll(".index-original .index-original-list li")),
                    viewMore: {
                        page: "category", 
                        attributes: { category: "排行榜" }
                    }
                };

                // 完结优选部分
                const endSection = {
                    title: "完结优选",
                    comics: this.parseComicList(doc.querySelectorAll(".box-body .mh-item")),
                    viewMore: {
                        page: "category",
                        attributes: { category: "全部漫画" }
                    }
                };

                doc.dispose();
                return [updateSection, hotSection, endSection];
            }
        }
    ];

    // === 分类页面配置 ===
    category = {
        title: "漫小肆",
        parts: [
            {
                name: "推荐",
                type: "fixed",
                categories: ["最近更新", "排行榜", "全部漫画"],
                itemType: "category"
            },
            {
                name: "题材",
                type: "fixed",
                categories: [
                    "都市", "校园", "青春", "性感", "长腿", "多人", "御姐", "巨乳",
                    "新婚", "媳妇", "暧昧", "清纯", "调教", "少妇", "风骚", "同居", 
                    "淫乱", "好友", "女神", "诱惑", "偷情", "出轨", "正妹", "家教"
                ],
                itemType: "category"
            }
        ],
        enableRankingPage: false
    };

    // === 分类漫画加载配置 ===
    categoryComics = {
        // 加载分类漫画
        load: async (category, param, options, page) => {
            // 根据分类构建不同的请求URL
            let url;
            if (category === "最近更新") {
                url = `${this.baseUrl}/update?page=${page}`;
            } else if (category === "排行榜") {
                url = `${this.baseUrl}/rank`;
            } else {
                const tag = (category !== "全部漫画") ? category : "全部";
                const area = options[0] || "-1";
                const end = options[1] || "-1";
                url = `${this.baseUrl}/booklist?tag=${encodeURIComponent(tag)}&area=${area}&end=${end}&page=${page}`;
            }

            const doc = await this.fetchDocument(url);
            let comics = [];

            // 排行榜特殊处理
            if (category === "排行榜") {
                const selectedRank = options[0] || "new";
                const rankMapping = {
                    "new": "新书榜",
                    "popular": "人气榜", 
                    "end": "完结榜",
                    "recommend": "推荐榜"
                };

                // 查找对应的排行榜列表
                const rankLists = doc.querySelectorAll(".mh-list.col3.top-cat li");
                let targetList = null;

                for (let list of rankLists) {
                    const titleElem = list.querySelector(".title");
                    if (titleElem) {
                        const title = titleElem.text.trim();
                        if (title === rankMapping[selectedRank]) {
                            targetList = list;
                            break;
                        }
                    }
                }

                if (!targetList) {
                    doc.dispose();
                    throw "未找到对应的排行榜";
                }

                comics = this.parseComicList(targetList.querySelectorAll(".mh-item.horizontal, .mh-itme-top"));
            } else {
                // 普通分类处理
                comics = this.parseComicList(doc.querySelectorAll(".mh-list.col7 .mh-item"));
            }

            // 解析最大页数（排行榜不分页）
            let maxPage = 1;
            if (category !== "排行榜") {
                const pageLinks = doc.querySelectorAll(".pagination a[href*='page=']");
                for (let link of pageLinks) {
                    const match = link.attributes.href.match(/page=(\d+)/);
                    if (match) {
                        const pageNum = parseInt(match[1]);
                        if (!isNaN(pageNum) && pageNum > maxPage) {
                            maxPage = pageNum;
                        }
                    }
                }
            }

            doc.dispose();
            return { comics, maxPage };
        },

        // 动态加载分类选项
        optionLoader: async (category, param) => {
            if (category === "最近更新") {
                return [];
            } else if (category === "排行榜") {
                return [{
                    options: [
                        "new-新书榜",
                        "popular-人气榜", 
                        "end-完结榜",
                        "recommend-推荐榜"
                    ]
                }];
            } else {
                return [
                    {
                        label: "地区",
                        options: [
                            "-全部",
                            "1-韩国", 
                            "2-日本",
                            "3-台湾"
                        ]
                    },
                    {
                        label: "状态",
                        options: [
                            "-全部",
                            "0-连载",
                            "1-完结"
                        ]
                    }
                ];
            }
        }
    };

    // === 搜索功能配置 ===
    search = {
        // 搜索漫画
        load: async (keyword, options, page) => {
            const url = `${this.baseUrl}/search?keyword=${encodeURIComponent(keyword)}`;
            const doc = await this.fetchDocument(url);
            const comics = this.parseComicList(doc.querySelectorAll(".mh-item"));
            
            doc.dispose();
            return {
                comics: comics,
                maxPage: 1
            };
        },
        enableTagsSuggestions: false
    };

    // === 漫画详情和阅读功能配置 ===
    comic = {
        // 加载漫画详情
        loadInfo: async (id) => {
            const url = `${this.baseUrl}/book/${id}`;
            const doc = await this.fetchDocument(url);

            // 提取标题信息
            const title = doc.querySelector(".info h1")?.text?.trim();

            // 提取副标题信息（别名和作者）
            let author = "";
            let subTitle = "";
            const subTitleElems = doc.querySelectorAll(".info .subtitle");
            for (let elem of subTitleElems) {
                const text = elem.text;
                if (text.includes("别名：")) subTitle = text.replace("别名：", "").trim();
                if (text.includes("作者：")) author = text.replace("作者：", "").trim();
            }
            const authors = author ? author.split("&").map(a => a.trim()).filter(a => a) : [];

            // 提取其他信息（状态、地区、更新时间、点击量和描述信息）
            let status = "";
            let area = "";
            let updateTime = "";
            let clickCount = "";
            const tipElems = doc.querySelectorAll(".info .tip span");
            for (let elem of tipElems) {
                const text = elem.text;
                if (text.includes("状态：")) status = elem.querySelector("span")?.text?.trim();
                if (text.includes("地区：")) area = elem.querySelector("a")?.text?.trim();
                if (text.includes("更新时间：")) updateTime = elem.text.replace("更新时间：", "").trim();
                if (text.includes("点击：")) clickCount = elem.text.replace("点击：", "").trim();
            }
            const description = doc.querySelector(".info .content")?.text?.trim();

            // 提取标签信息
            const tagList = [];
            const tagElems = doc.querySelectorAll(".info .tip a[href*='tag=']");
            for (let elem of tagElems) {
                const tagName = elem.text?.trim();
                if (tagName) tagList.push(tagName);
            }

            // 提取章节列表
            const chapters = {};
            const chapterElems = doc.querySelectorAll("#detail-list-select li a");
            for (let elem of chapterElems) {
                const chapterUrl = elem.attributes?.href;
                const chapterTitle = elem.text?.trim();
                if (chapterUrl && chapterTitle) {
                    const chapterId = chapterUrl.split("/").pop();
                    if (chapterId) chapters[chapterId] = chapterTitle;
                }
            }

            // 提取评论和推荐漫画
            const comments = this.parseCommentList(doc.querySelectorAll(".view-comment-main .postlist li.dashed"));
            const recommend = this.parseComicList(doc.querySelectorAll(".index-manga .mh-item"));

            doc.dispose();
            
            // 创建并返回漫画详情对象
            return new ComicDetails({
                title: title,
                subTitle: subTitle,
                cover: `${this.baseUrl}/static/upload/book/${id}/cover.jpg`,
                description: description,
                tags: {
                    "作者": authors,
                    "题材": tagList,
                    "地区": [area],
                    "状态": [status],
                    "热度": [`🔥${clickCount}`]
                },
                chapters: chapters,
                recommend: recommend,
                commentCount: comments.length,
                updateTime: updateTime,
                url: url,
                comments: comments
            });
        },

        // 加载章节图片
        loadEp: async (comicId, epId) => {
            const url = `${this.baseUrl}/chapter/${epId}`;
            const doc = await this.fetchDocument(url);

            // 提取懒加载图片
            const images = [];
            const imageElems = doc.querySelectorAll("img.lazy");
            for (let img of imageElems) {
                const src = img.attributes?.["data-original"];
                const image = src.replace(/https?:\/\/[^\/]+/, this.baseUrl);
                if (image) images.push(image);
            }

            if (images.length === 0) {
                doc.dispose();
                throw "本章中未找到图片";
            }

            doc.dispose();
            return {
                images: images
            };
        },

        // 加载评论列表
        loadComments: async (comicId, subId, page, replyTo) => {
            const url = `${this.baseUrl}/book/${comicId}`;
            const doc = await this.fetchDocument(url);

            const comments = this.parseCommentList(doc.querySelectorAll(".view-comment-main .postlist li.dashed"));

            doc.dispose();
            return {
                comments: comments,
                maxPage: 1
            };
        },

        // 处理标签点击事件
        onClickTag: (namespace, tag) => {
            // 作者标签跳转到搜索页面
            if (namespace === "作者") {
                return {
                    page: "search",
                    attributes: {
                        keyword: tag
                    }
                };
            }
            // 题材标签跳转到分类页面
            else if (namespace === "题材") {
                return {
                    page: "category",
                    attributes: {
                        category: tag
                    }
                };
            }
        },
        enableTagsTranslate: false
    };
}