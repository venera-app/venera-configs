class WeebCentral extends ComicSource {
    name = "WeebCentral"
    key = "weebcentral"
    version = "1.0.0"
    minAppVersion = "1.0.0"
    // update url
    url = "https://cdn.jsdelivr.net/gh/yelongyue197-svg/venera-sources@main/weebcentral.js"

    get baseUrl() {
        return "https://weebcentral.com";
    }

    static getHeaders() {
        return {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
            "Referer": "https://weebcentral.com/",
        };
    }

    buildListUrl(params, page) {
        const qs = [];
        qs.push("text=" + encodeURIComponent(params.text || ""));
        if (params.sort) qs.push("sort=" + encodeURIComponent(params.sort));
        if (params.order) qs.push("order=" + encodeURIComponent(params.order));
        if (params.included_type) qs.push("included_type=" + encodeURIComponent(params.included_type));
        if (params.included_status) qs.push("included_status=" + encodeURIComponent(params.included_status));
        qs.push("limit=32");
        qs.push("offset=" + ((page - 1) * 32));
        qs.push("display_mode=" + encodeURIComponent("Full Display"));
        return this.baseUrl + "/search/data?" + qs.join("&");
    }

    parseComics(doc) {
        const comics = [];
        const links = doc.querySelectorAll("article > section > a[href*='/series/']");
        for (const a of links) {
            const href = (a.attributes["href"] || "").trim();
            if (!href) continue;
            const titleEl = a.querySelector("div.text-ellipsis");
            let title = titleEl ? titleEl.text.trim() : "";
            if (!title) {
                const img = a.querySelector("img[alt]");
                if (img && img.attributes["alt"]) {
                    title = img.attributes["alt"].replace(/ cover$/i, "").trim();
                }
            }
            let cover = "";
            const sourceEl = a.querySelector("source");
            if (sourceEl && sourceEl.attributes["srcset"]) {
                cover = String(sourceEl.attributes["srcset"]).trim().split(/\s+/)[0];
            }
            if (!cover) {
                const img = a.querySelector("img");
                if (img && img.attributes["src"]) cover = img.attributes["src"];
            }
            comics.push({
                id: href,
                title: title || "Unknown",
                subtitle: "",
                cover: cover,
                tags: [],
                description: "",
            });
        }
        return comics;
    }

    async loadList(params, page) {
        const url = this.buildListUrl(params, page);
        const res = await Network.get(url, WeebCentral.getHeaders());
        if (res.status !== 200) throw "Request Error: " + res.status;
        const doc = new HtmlDocument(res.body);
        const comics = this.parseComics(doc);
        const hasNext = doc.querySelector("button") != null;
        return {
            comics: comics,
            maxPage: hasNext ? page + 1 : page,
        };
    }

    explore = [
        {
            title: "热门",
            type: "multiPageComicList",
            load: async (page) => {
                return this.loadList({ text: "", sort: "Popularity" }, page);
            },
        },
        {
            title: "最新更新",
            type: "multiPageComicList",
            load: async (page) => {
                return this.loadList({ text: "", sort: "Latest Updates" }, page);
            },
        },
        {
            title: "最近添加",
            type: "multiPageComicList",
            load: async (page) => {
                return this.loadList({ text: "", sort: "Recently Added" }, page);
            },
        },
    ]

    category = {
        title: "WeebCentral",
        parts: [
            {
                name: "类型",
                type: "fixed",
                categories: ["全部", "Manga", "Manhwa", "Manhua", "OEL"],
                itemType: "category",
                categoryParams: ["type:", "type:Manga", "type:Manhwa", "type:Manhua", "type:OEL"],
            },
            {
                name: "状态",
                type: "fixed",
                categories: ["全部", "连载中", "已完结", "休刊", "已取消"],
                itemType: "category",
                categoryParams: ["status:", "status:Ongoing", "status:Complete", "status:Hiatus", "status:Canceled"],
            },
        ],
        enableRankingPage: false,
    }

    categoryComics = {
        load: async (category, param, options, page) => {
            const params = { text: "", sort: "Popularity" };
            if (param) {
                if (param.startsWith("type:")) {
                    params.included_type = param.substring(5);
                } else if (param.startsWith("status:")) {
                    params.included_status = param.substring(7);
                }
            }
            if (options[0]) {
                params.sort = options[0].split("-")[0];
            }
            return this.loadList(params, page);
        },
        optionList: [
            {
                label: "排序",
                options: [
                    "Popularity-Popularity",
                    "Best Match-Best Match",
                    "Alphabet-Alphabet",
                    "Subscribers-Subscribers",
                    "Recently Added-Recently Added",
                    "Latest Updates-Latest Updates",
                ],
                default: "Popularity",
            },
        ],
    }

    search = {
        load: async (keyword, options, page) => {
            let sort = "Best Match";
            if (options[0]) sort = options[0].split("-")[0];
            return this.loadList({ text: keyword, sort: sort }, page);
        },
        optionList: [
            {
                label: "排序",
                options: [
                    "Best Match-Best Match",
                    "Popularity-Popularity",
                    "Alphabet-Alphabet",
                    "Subscribers-Subscribers",
                    "Recently Added-Recently Added",
                    "Latest Updates-Latest Updates",
                ],
                default: "Best Match",
            },
        ],
        enableTagsSuggestions: false,
    }

    comic = {
        loadInfo: async (id) => {
            let url = id;
            if (!/^https?:\/\//.test(url)) url = this.baseUrl + url;
            const res = await Network.get(url, WeebCentral.getHeaders());
            if (res.status !== 200) throw "Request Error: " + res.status;
            const doc = new HtmlDocument(res.body);

            const titleEl = doc.querySelector("h1");
            const title = titleEl ? titleEl.text.trim() : "Unknown";

            let cover = "";
            const sourceEl = doc.querySelector("picture source");
            if (sourceEl && sourceEl.attributes["srcset"]) {
                cover = String(sourceEl.attributes["srcset"]).trim().split(/\s+/)[0];
            }
            if (!cover) {
                const img = doc.querySelector("picture img");
                if (img && img.attributes["src"]) cover = img.attributes["src"];
            }

            const descEl = doc.querySelector("p.whitespace-pre-wrap");
            const description = descEl ? descEl.text.trim() : "";

            const authorEls = doc.querySelectorAll("a[href*='author=']");
            const authors = [];
            for (const el of authorEls) {
                const t = el.text.trim();
                if (t) authors.push(t);
            }

            const tagEls = doc.querySelectorAll("a[href*='included_tag=']");
            const tags = [];
            for (const el of tagEls) {
                const t = el.text.trim();
                if (t) tags.push(t);
            }

            const typeEl = doc.querySelector("a[href*='included_type=']");
            const type = typeEl ? typeEl.text.trim() : "";
            const statusEl = doc.querySelector("a[href*='included_status=']");
            const status = statusEl ? statusEl.text.trim() : "";

            const seriesMatch = url.match(/\/series\/([^/]+)/);
            const chapters = new Map();
            let updateTime = "";
            if (seriesMatch) {
                const clUrl = this.baseUrl + "/series/" + seriesMatch[1] + "/full-chapter-list";
                const clRes = await Network.get(clUrl, WeebCentral.getHeaders());
                if (clRes.status === 200) {
                    const clDoc = new HtmlDocument(clRes.body);
                    const els = clDoc.querySelectorAll("a[href*='/chapters/']");
                    if (els.length > 0) {
                        const newest = els[0].querySelector("time");
                        if (newest && newest.attributes["datetime"]) {
                            updateTime = String(newest.attributes["datetime"]).slice(0, 10);
                        }
                    }
                    for (let i = els.length - 1; i >= 0; i--) {
                        const a = els[i];
                        const href = (a.attributes["href"] || "").trim();
                        if (!href) continue;
                        const chapterUrl = href.startsWith("http") ? href : this.baseUrl + href;
                        const nameEl = a.querySelector("span.flex > span");
                        let name = nameEl ? nameEl.text.trim() : "";
                        if (!name) name = "Chapter";
                        const img = a.querySelector("img");
                        if (img && img.attributes["src"] && String(img.attributes["src"]).indexOf("official") >= 0) {
                            name += " [Official]";
                        }
                        chapters.set(chapterUrl, name);
                    }
                }
            }

            const tagsMap = {};
            if (authors.length > 0) tagsMap["作者"] = authors;
            if (type) tagsMap["类型"] = [type];
            if (status) tagsMap["状态"] = [status];
            if (tags.length > 0) tagsMap["标签"] = tags;
            if (updateTime) tagsMap["更新"] = [updateTime];

            return {
                title: title,
                cover: cover,
                description: description,
                tags: tagsMap,
                chapters: chapters,
                url: url,
            };
        },

        loadEp: async (comicId, epId) => {
            const url = epId + "/images?is_prev=False&reading_style=long_strip";
            const res = await Network.get(url, WeebCentral.getHeaders());
            if (res.status !== 200) throw "Request Error: " + res.status;
            const doc = new HtmlDocument(res.body);
            const imgs = doc.querySelectorAll("section img");
            const images = [];
            for (const img of imgs) {
                if (img.attributes["src"]) images.push(img.attributes["src"]);
            }
            return { images: images };
        },

        onImageLoad: (url, comicId, epId) => {
            return {
                url: url,
                method: "GET",
                headers: {
                    "Referer": "https://weebcentral.com/",
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
                },
                onLoadFailed: () => ({ url: url }),
            };
        },

        onThumbnailLoad: (url) => {
            return {
                url: url,
                method: "GET",
                headers: {
                    "Referer": "https://weebcentral.com/",
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
                },
                onLoadFailed: () => ({ url: url }),
            };
        },

        idMatch: "weebcentral\\.com\\/(series\\/[^/]+\\/[^/?]+|chapters\\/[^/?]+)",

        link: {
            domains: ["weebcentral.com"],
            linkToId: (url) => {
                const m = url.match(/weebcentral\.com\/(series\/[^/]+\/[^/?]+|chapters\/[^/?]+)/);
                return m ? "https://" + m[0] : null;
            },
        },
    }
}
