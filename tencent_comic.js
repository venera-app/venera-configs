class TencentComicSource extends ComicSource {
    name = "腾讯漫画📱"
    key = "tencent_comic"
    version = "1.0.0"
    minAppVersion = "1.0.0"
    url = "https://m.ac.qq.com"

    // 不需要init函数，除非有特殊初始化需求

    // 搜索功能
    search = {
        load: async (keyword, options, page) => {
            // 构建搜索URL
            const searchUrl = `https://m.ac.qq.com/search/result?word=${encodeURIComponent(keyword)}&page=${page}`;
            
            try {
                // 使用Network API获取数据
                const html = await Network.get(searchUrl);
                
                // 解析HTML获取漫画列表
                const parser = new DOMParser();
                const doc = parser.parseFromString(html, "text/html");
                
                const comics = [];
                const items = doc.querySelectorAll(".comic-link, .lst_searchResult li, #list_update li");
                
                for (const item of items) {
                    const comic = new Comic();
                    
                    // 获取漫画标题
                    const titleElem = item.querySelector(".comic-title");
                    if (titleElem) {
                        comic.title = titleElem.textContent.trim();
                    }
                    
                    // 获取漫画链接和ID
                    const linkElem = item.querySelector("a");
                    if (linkElem && linkElem.href) {
                        comic.id = linkElem.href.match(/\/comic\/index\/id\/(\d+)/)?.[1] || 
                                  linkElem.href.match(/id=(\d+)/)?.[1] ||
                                  linkElem.href;
                        comic.url = linkElem.href;
                    }
                    
                    // 获取封面
                    const imgElem = item.querySelector(".comic-cover img, img");
                    if (imgElem && imgElem.src) {
                        comic.cover = imgElem.src;
                    }
                    
                    // 获取作者和标签
                    const tagElem = item.querySelector(".comic-tag");
                    if (tagElem) {
                        comic.author = tagElem.textContent.trim();
                    }
                    
                    // 获取最新章节
                    const chapterElem = item.querySelector(".chapter, .comic-update");
                    if (chapterElem) {
                        comic.latestChapter = chapterElem.textContent.trim().replace(/更新/, "");
                    }
                    
                    if (comic.title && comic.id) {
                        comics.push(comic);
                    }
                }
                
                // 返回结果（需要估算最大页数）
                return {
                    comics: comics,
                    maxPage: 10 // 这里应该根据实际分页信息计算
                };
                
            } catch (error) {
                console.error("搜索失败:", error);
                return { comics: [], maxPage: 0 };
            }
        },
        
        optionList: []
    }

    // 探索页面（分类）
    explore = [
        {
            title: "腾讯漫画分类",
            type: "multiPartPage",
            
            load: async (page) => {
                // 定义各个分类
                const categories = [
                    {
                        title: "条漫",
                        comics: await this.loadCategory("tm", "upt", 1)
                    },
                    {
                        title: "独家",
                        comics: await this.loadCategory("dj", "upt", 1)
                    },
                    {
                        title: "完结",
                        comics: await this.loadCategory("wj", "upt", 1)
                    },
                    // 可以添加更多分类...
                    {
                        title: "飙升榜",
                        viewMore: "ranking/rise"
                    },
                    {
                        title: "畅销榜", 
                        viewMore: "ranking/pay"
                    }
                ];
                
                return categories;
            }
        }
    ]

    // 漫画详情
    comic = {
        loadInfo: async (id) => {
            const url = `https://m.ac.qq.com/comic/index/id/${id}`;
            const html = await Network.get(url);
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, "text/html");
            
            const details = new ComicDetails();
            details.id = id;
            
            // 解析标题
            const titleElem = doc.querySelector(".head-title-tags h1");
            if (titleElem) {
                details.title = titleElem.textContent.trim();
            }
            
            // 解析作者
            const authorElem = doc.querySelector(".head-info-author");
            if (authorElem) {
                details.author = authorElem.textContent.trim().replace(/作者：/, "");
            }
            
            // 解析简介
            const descElem = doc.querySelector(".head-info-desc");
            if (descElem) {
                details.description = descElem.textContent.trim();
            }
            
            // 解析封面
            const coverElem = doc.querySelector(".head-info-cover img");
            if (coverElem && coverElem.src) {
                details.cover = coverElem.src;
            }
            
            // 解析章节列表
            const chapters = [];
            const chapterElems = doc.querySelectorAll(".chapter-wrap-list.normal > li");
            
            for (const elem of chapterElems) {
                const link = elem.querySelector("a");
                if (link) {
                    const chapter = new Chapter();
                    chapter.title = link.textContent.trim()
                        .replace(/chapter-link/g, '')
                        .replace(/\s/g, '')
                        .replace(/lock/g, '💲');
                    chapter.id = link.href.match(/cid=(\d+)/)?.[1] || link.href;
                    chapter.url = link.href;
                    chapters.push(chapter);
                }
            }
            
            details.chapters = chapters;
            
            // 解析标签
            const tagElems = doc.querySelectorAll(".head-title-tags .tag");
            const tags = [];
            for (const tagElem of tagElems) {
                const tag = tagElem.textContent.trim();
                if (tag) {
                    tags.push({ namespace: "分类", tag: tag });
                }
            }
            details.tags = tags;
            
            // 获取最新章节
            const latestElem = doc.querySelector(".mod-chapter-title span");
            if (latestElem) {
                details.latestChapter = latestElem.textContent.trim().replace(/，/, "");
            }
            
            return details;
        },
        
        loadEp: async (comicId, epId) => {
            // 这里是图片解密的复杂部分
            // 需要重写原来的JavaScript解密代码
            
            const url = epId.includes("http") ? epId : `https://m.ac.qq.com/comic/chapter/id/${comicId}/cid/${epId}`;
            const html = await Network.get(url);
            
            // 提取加密的数据
            const dataMatch = html.match(/data:\s*'(.*?)'/);
            const nonceMatch = html.match(/<script>window\.nonce\s*=\s*(.*?)<\/script>/);
            
            if (!dataMatch || !nonceMatch) {
                throw new Error("无法解析图片数据");
            }
            
            let data = dataMatch[1];
            let nonce = eval(nonceMatch[1]); // 执行nonce计算
            
            // 解密逻辑（参考原来的代码）
            const N = String(nonce).match(/\d+\w+/g);
            if (N) {
                let jlen = N.length;
                while (jlen) {
                    jlen -= 1;
                    const jlocate = parseInt(N[jlen].match(/(\d+)/)[0]) & 255;
                    const jstr = N[jlen].replace(/\d+/g, '');
                    data = data.substring(0, parseInt(jlocate)) + 
                           data.substring(parseInt(jlocate) + jstr.length, data.length);
                }
            }
            
            // Base64解码
            const decoded = atob(data);
            const picListMatch = decoded.match(/"picture":(\[{"url".*\])/);
            
            if (!picListMatch) {
                throw new Error("无法解析图片列表");
            }
            
            const picList = JSON.parse(picListMatch[1]);
            const images = picList.map(pic => pic.url);
            
            return { images: images };
        },
        
        // 支持链接解析
        link: {
            domains: ['ac.qq.com', 'm.ac.qq.com'],
            
            linkToId: (url) => {
                // 从URL中提取漫画ID
                const idMatch = url.match(/\/comic\/index\/id\/(\d+)/) || 
                               url.match(/id=(\d+)/);
                return idMatch ? idMatch[1] : null;
            }
        }
    }

    // 辅助函数：加载分类
    async loadCategory(type, rank, page) {
        const url = `https://m.ac.qq.com/category/listAll?type=${type}&rank=${rank}&pageSize=30&page=${page}`;
        const html = await Network.get(url);
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, "text/html");
        
        const comics = [];
        const items = doc.querySelectorAll(".comic-link");
        
        for (const item of items.slice(0, 10)) { // 只取前10个
            const comic = new Comic();
            
            const titleElem = item.querySelector(".comic-title");
            if (titleElem) {
                comic.title = titleElem.textContent.trim();
            }
            
            const linkElem = item.querySelector("a");
            if (linkElem && linkElem.href) {
                comic.id = linkElem.href.match(/\/comic\/index\/id\/(\d+)/)?.[1] || linkElem.href;
                comic.url = linkElem.href;
            }
            
            const imgElem = item.querySelector(".comic-cover img");
            if (imgElem && imgElem.src) {
                comic.cover = imgElem.src;
            }
            
            if (comic.title && comic.id) {
                comics.push(comic);
            }
        }
        
        return comics;
    }
}

// 注册源
registerSource(TencentComicSource);
