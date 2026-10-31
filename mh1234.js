class MH1234 extends ComicSource {
    // name of the source
    name = "漫画1234"

    // unique id of the source
    key = "mh1234"

    version = "1.1.0"

    minAppVersion = "1.4.0"

    // update url
    url = "https://cdn.jsdelivr.net/gh/venera-app/venera-configs@main/mh1234.js"

    settings = {
        domains: {
            title: "域名",
            type: "input",
            default: "wmh1234.com"
        }
    }

    get baseUrl() {
        let domain = this.loadSetting('domains') || this.settings.domains.default;
        // Migrate the original default, which now serves a parked-domain page.
        if (domain === "amh1234.com" || domain === "b.amh1234.com") domain = "wmh1234.com";
        return `https://${domain.startsWith("www.") ? domain : `www.${domain}`}`;
    }

    // explore page list
    explore = [{
        title: "漫画1234",
        type: "singlePageWithMultiPart",
        load: async () => {
            const res = await Network.get(this.baseUrl);
            if (res.status !== 200) throw `Invalid status code: ${res.status}`;
            const doc = new HtmlDocument(res.body);
            const result = {};
            const discover = this.parseList(doc, ".mint-discover-card");
            const updates = this.parseList(doc, ".mint-update-card");
            if (discover.length) result["发现好故事"] = discover;
            if (updates.length) result["最近更新"] = updates;
            if (!discover.length && !updates.length) {
                const oldLists = doc.querySelectorAll("div.imgBox");
                for (const list of oldLists) {
                    const title = list.querySelector(".Title")?.text || "推荐";
                    const comics = this.parseList(list, "li.list-comic");
                    if (comics.length) result[title] = comics;
                }
            }
            return result;
        }
    }];

    // categories
    category = {
        title: "漫画分类",
        parts: [{
            name: "分类",
            type: "fixed",
            categories: ["全部", "国漫"],
            itemType: "category",
            categoryParams: ["", "cn"],
        }],
        enableRankingPage: false,
    }

    parseComics(html, onePage = false) {
        const doc = new HtmlDocument(html);
        const comics = this.parseList(doc);
        let maxPage = onePage ? 1 : null;
        const total = doc.querySelector("#total-page")?.attributes?.["value"];
        if (!onePage && total) maxPage = parseInt(total);
        if (!onePage && !maxPage) {
            for (const link of doc.querySelectorAll(".pagination a")) {
                const page = parseInt((link.text || "").trim());
                if (!Number.isNaN(page)) maxPage = Math.max(maxPage || 1, page);
            }
        }
        return {comics, maxPage: maxPage || 1};
    }

    parseList(doc, selector) {
        const selectors = selector ? [selector] : [".itemBox", ".list-comic", ".comic-card", ".common-comic-item", ".mint-discover-card", ".mint-update-card"];
        const seen = {};
        const comics = [];
        for (const query of selectors) {
            for (const item of doc.querySelectorAll(query)) {
                const anchor = item.querySelector("a[href*='/comic/']") || item.querySelector("a");
                const href = anchor?.attributes?.["href"] || "";
                const idMatch = href.match(/\/comic\/([^/?#]+)/);
                const id = item.attributes?.["data-key"] || (idMatch && idMatch[1].replace(/\.html$/, ""));
                const image = item.querySelector("img");
                const cover = image?.attributes?.["data-original"] || image?.attributes?.["data-src"] || image?.attributes?.["src"];
                const title = item.querySelector(".title")?.text || item.querySelector(".comic-title")?.text || item.querySelector("h3")?.text || item.querySelector("h2")?.text || anchor?.attributes?.["title"] || image?.attributes?.["alt"];
                if (!id || !title || seen[id]) continue;
                seen[id] = true;
                comics.push(new Comic({id, title: title.trim(), cover}));
            }
        }
        return comics;
    }

    /// category comic loading related
    categoryComics = {
        load: async (category, params, options, page) => {
            const path = params ? `/lists/${params}` : "/category/";
            const res = await Network.get(`${this.baseUrl}${path}?page=${page}`);
            if (res.status !== 200) throw `Invalid status code: ${res.status}`;
            return this.parseComics(res.body);
        },
        optionLoader: async () => [],
    }

    /// search related
    search = {
        load: async (keyword, options, page) => {
            const res = await Network.get(`${this.baseUrl}/index.php/search?key=${encodeURIComponent(keyword)}&page=${page}`);
            if (res.status !== 200) throw `Invalid status code: ${res.status}`;
            return this.parseComics(res.body);
        },
        optionList: [],
        enableTagsSuggestions: false,
    }

    /// single comic related
    comic = {
        loadInfo: async (id) => {
            const res = await Network.get(`${this.baseUrl}/comic/${id}.html`);
            if (res.status !== 200) throw `Invalid status code: ${res.status}`;
            const doc = new HtmlDocument(res.body);
            const title = doc.querySelector("[data-comic-name]")?.text || doc.querySelector(".BarTit")?.text || "";
            const cover = doc.querySelector("[data-comic-cover]")?.attributes?.["src"] || doc.querySelector(".pic img")?.attributes?.["src"];
            const description = doc.querySelector(".mint-detail-description")?.text || doc.querySelector("#full-des")?.text || "";
            const meta = doc.querySelectorAll(".mint-detail-meta span");
            let author = "";
            let tags = [];
            if (meta.length) {
                author = (meta[0].text || "").replace(/^作者：/, "").trim();
                if (meta.length > 2) tags = (meta[2].text || "").trim().split(/\s+/).filter(Boolean);
            } else {
                const tagNodes = doc.querySelector(".sub_r")?.querySelectorAll("a") || [];
                tags = tagNodes.map(tag => tag.text).filter(Boolean);
                const infos = doc.querySelectorAll(".txtItme");
                author = infos[0]?.text?.replaceAll("\n", "").replaceAll("\r", "").trim() || "";
            }
            const chapters = {};
            const newChapterLinks = doc.querySelectorAll(".mint-chapters a[href*='/go/']");
            for (const link of newChapterLinks) {
                const href = link.attributes?.["href"] || "";
                const token = href.match(/\/go\/([^/?#]+)/)?.[1];
                if (token) chapters[`go:${token}`] = link.attributes?.["title"] || link.text.trim();
            }
            if (!newChapterLinks.length) {
                for (const ch of doc.querySelector(".chapter-warp")?.querySelectorAll("li") || []) {
                    const link = ch.querySelector("a");
                    const href = link?.attributes?.["href"] || "";
                    const cid = href.replace("/comic/", "").replace(".html", "").split("/").join("_");
                    if (cid) chapters[cid] = ch.querySelector("span")?.text || link.text;
                }
            }
            const recommendations = this.parseList(doc);
            return {
                title,
                cover,
                description,
                tags: {"作者": author ? [author] : [], "标签": tags},
                chapters,
                recommend: recommendations,
            };
        },

        loadEp: async (comicId, epId) => {
            if (epId.startsWith("go:")) {
                const token = epId.slice(3);
                const res = await Network.get(`https://reader.hqread.cc/r/${token}`);
                if (res.status !== 200) throw `Invalid status code: ${res.status}`;
                const doc = new HtmlDocument(res.body);
                const images = [];
                for (const node of doc.querySelectorAll("img.reader-image")) {
                    const url = node.attributes?.["data-src"] || node.attributes?.["src"];
                    if (url && !url.includes("placeholder.svg")) images.push(url);
                }
                if (!images.length) throw "章节图片解析失败";
                return {images};
            }
            const ids = epId.split("_");
            const res = await Network.get(`${this.baseUrl}/comic/${ids[0]}/${ids[1]}.html`);
            if (res.status !== 200) throw `Invalid status code: ${res.status}`;
            const html = res.body;
            const start = html.search(`var chapterImages = `) + 22;
            const end = html.search(`;var chapterPath = `) - 2;
            const end2 = html.search(`;var chapterPrice`) - 1;
            if (start < 22 || end < 0 || end2 < 0) throw "章节图片解析失败";
            const images = html.substring(start, end).split(`\",\"`);
            const cpath = html.substring(end + 22, end2);
            for (let i = 0; i < images.length; i++) {
                images[i] = `https://gmh1234.wszwhg.net/${cpath}${images[i].replaceAll("\\", "")}`.replaceAll("//", "/").replace("https:/", "https://");
            }
            return {images};
        },
        enableTagsTranslate: false,
    }
}
