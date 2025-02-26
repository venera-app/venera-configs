class Ehentai extends ComicSource {
    // Note: The fields which are marked as [Optional] should be removed if not used

    // name of the source
    name = "ehentai"

    // unique id of the source
    key = "ehentai"

    version = "1.1.3"

    minAppVersion = "1.0.0"

    // update url
    url = "https://cdn.jsdelivr.net/gh/venera-app/venera-configs@main/ehentai.js"

    /**
     * cached api key
     * @type {string | null}
     */
    apiKey = null

    /**
     * cached uid key
     * @type {string | null}
     */
    uid = null

    /**
     * @param url
     * @returns {{id: string, token: string}}
     */
    parseUrl(url) {
        let segments = url.split("/")
        let id = segments[4]
        let token = segments[5]
        return {
            id: id,
            token: token
        }
    }

    // [Optional] account related
    account = {

        /**
         * [Optional] login with webview
         */
        loginWithWebview: {
            url: "https://forums.e-hentai.org/index.php?act=Login&CODE=00",
            /**
             * check login status
             * @param url {string} - current url
             * @param title {string} - current title
             * @returns {boolean} - return true if login success
             */
            checkStatus: (url, title) => {
                return title === "E-Hentai Forums";
            },
            onLoginSuccess: async () => {
                let cookies = await Network.getCookies("https://forums.e-hentai.org")
                cookies.forEach((cookie) => {
                    cookie.domain = ".exhentai.org"
                })
                Network.setCookies("https://exhentai.org", cookies)
            },
        },

        loginWithCookies: {
            fields: [
                "ipb_member_id",
                "ipb_pass_hash",
                "igneous",
                "star",
            ],
            /**
             * Validate cookies, return false if cookies are invalid.
             *
             * Use `Network.setCookies` to set cookies before validate.
             * @param values {string[]} - same order as `fields`
             * @returns {Promise<boolean>}
             */
            validate: async (values) => {
                if (values.length !== 4) {
                    return false
                }
                if (values[0].length === 0 || values[1].length === 0) {
                    return false
                }
                let cookies = []
                for (let i = 0; i < values.length; i++) {
                    cookies.push(new Cookie({
                        name: this.account.loginWithCookies.fields[i],
                        value: values[i],
                        domain: ".e-hentai.org"
                    }))
                    cookies.push(new Cookie({
                        name: this.account.loginWithCookies.fields[i],
                        value: values[i],
                        domain: ".exhentai.org"
                    }))
                }
                Network.deleteCookies('https://e-hentai.org')
                Network.setCookies('https://e-hentai.org', cookies)
                let res = await Network.get(
                    "https://forums.e-hentai.org/",
                    {
                        "referer": "https://forums.e-hentai.org/index.php?",
                        "accept":
                            "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
                        "accept-encoding": "gzip, deflate, br",
                        "accept-language": "zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7"
                    });
                if (res.status !== 200) {
                    return false
                }
                let document = new HtmlDocument(res.body)
                let name = document.querySelector("div#userlinks > p.home > b > a");
                document.dispose()
                return name != null
            }
        },

        /**
         * logout function, clear account related data
         */
        logout: () => {
            Network.deleteCookies("https://e-hentai.org");
            Network.deleteCookies("https://forums.e-hentai.org");
            Network.deleteCookies("https://exhentai.org");
        },

        // {string?} - register url
        registerWebsite: null
    }

    get baseUrl() {
        return 'https://' + this.loadSetting("domain");
    }

    get apiUrl() {
        return this.baseUrl.includes("exhentai") ? "https://exhentai.org/api.php" : "https://api.e-hentai.org/api.php"
    }

    getStarsFromPosition(position) {
        let i = 0;
        while (position[i] !== ";") {
            i++;
            if (i === position.length) {
                break;
            }
        }
        switch (position.substring(0, i)) {
            case "background-position:0px -1px":
                return 5;
            case "background-position:0px -21px":
                return 4.5;
            case "background-position:-16px -1px":
                return 4;
            case "background-position:-16px -21px":
                return 3.5;
            case "background-position:-32px -1px":
                return 3;
            case "background-position:-32px -21px":
                return 2.5;
            case "background-position:-48px -1px":
                return 2;
            case "background-position:-48px -21px":
                return 1.5;
            case "background-position:-64px -1px":
                return 1;
            case "background-position:-64px -21px":
                return 0.5;
        }
        return 0.5;
    }

    async onLoadFailed() {
        let cookies = await Network.getCookies('https://e-hentai.org')
        cookies.forEach((c) => {
            c.domain = '.exhentai.org'
        })
        cookies.filter((item) => item.name !== 'igneous')
        Network.deleteCookies('https://exhentai.org')
        Network.setCookies('https://exhentai.org', cookies)
        throw `You may not have permission to access this page. Please check your network or try to login again.`
    }

    /**
     *
     * @param url {string}
     * @param isLeaderBoard {boolean}
     * @returns {Promise<{comics: Comic[], next: string?}>}
     */
    async getGalleries(url, isLeaderBoard) {
        let t = isLeaderBoard ? 1 : 0;
        let res
        try {
            res = await Network.get(url, {});
        }
        catch (e) {
            if(e.toString().toLowerCase().includes("redirect")) {
                await this.onLoadFailed()
            }
            throw e
        }
        if (res.status !== 200) {
            throw `Invalid status code: ${res.status}`
        }
        if(res.body.trim().length === 0) {
            await this.onLoadFailed()
        }
        if(res.body[0] !== '<') {
            if(res.body.includes("IP")) {
                throw "Your IP address has been banned"
            }
            throw "Failed to load page"
        }
        let document = new HtmlDocument(res.body);
        let galleries = [];

        // compact mode
        for (let item of document.querySelectorAll("table.itg.gltc > tbody > tr")) {
            try {
                let type = item.children[0 + t].children[0].text;
                let time = item.children[1 + t].children[2].children[0].text;
                let stars = this.getStarsFromPosition(item.children[1 + t].children[2].children[1].attributes["style"])
                let cover = item.children[1 + t].children[1].children[0].children[0].attributes["src"];
                if (cover[0] === 'd') {
                    cover = item.children[1 + t].children[1].children[0].children[0].attributes["data-src"];
                }
                let title = item.children[2 + t].children[0].children[0].text;
                let link = item.children[2 + t].children[0].attributes["href"];
                let uploader = "";
                let pages = 0;
                try {
                    if (url.includes("/favorites.php")) {
                        pages = Number(item.children[1 + t].children[1].children[1].children[1].children[1].text.match(/\d+/)[0]);
                    } else {
                        pages = Number(item.children[3 + t].children[1].text.match(/\d+/)[0]);
                        uploader = item.children[3 + t].children[0].children[0].text;
                    }
                } catch(e) {}
                let tags = [];
                let language = null
                for (let node of item.children[2 + t].children[0].children[1].children) {
                    let tag = node.attributes["title"]
                    if (tag.startsWith("language:")) {
                        let l = tag.split(":")[1].trim()
                        language = l === 'translated' ? language : l
                        continue
                    }
                    tags.push(tag)
                }
                galleries.push(new Comic({
                    id: link,
                    title: title,
                    subTitle: uploader,
                    cover: cover,
                    tags: tags,
                    description: time,
                    stars: stars,
                    maxPage: pages,
                    language: language
                }));
            } catch(e) {
            }
        }

        // Thumbnail mode
        for (let item of document.querySelectorAll("div.gl1t")) {
            try {
                let title = item.querySelector("a")?.text ?? "Unknown";
                let type =
                    item.querySelector("div.gl5t > div > div.cs")?.text ?? "Unknown";
                let time = item.querySelectorAll("div.gl5t > div > div").find((element) => !isNaN(Date.parse(element.text)))?.text;
                let coverPath = item.querySelector("img")?.attributes["src"] ?? "";
                let stars = this.getStarsFromPosition(item.querySelector("div.gl5t > div > div.ir")?.attributes["style"] ?? "");
                let link = item.querySelector("a")?.attributes["href"] ?? "";
                let pages = Number(item.querySelectorAll("div.gl5t > div > div").find((element) => element.text.includes("page"))?.text.match(/\d+/)[0] ?? "0");
                galleries.push(new Comic({
                    id: link,
                    title: title,
                    cover: coverPath,
                    description: time,
                    stars: stars,
                    maxPage: pages,
                }));
            } catch (e) {
                //忽视
            }
        }

        // Extended mode
        for (let item of document.querySelectorAll("table.itg.glte > tbody > tr")) {
            try {
                let title = item.querySelector("td.gl2e > div > a > div > div.glink")?.text ?? "Unknown";
                let type = item.querySelector("td.gl2e > div > div.gl3e > div.cn")?.text ?? "Unknown";
                let time = item.querySelectorAll("td.gl2e > div > div.gl3e > div").find((element) => !isNaN(Date.parse(element.text)))?.text ?? "Unknown";
                let uploader = item.querySelector("td.gl2e > div > div.gl3e > div > a")?.text ?? "Unknown";
                let coverPath = item.querySelector("td.gl1e > div > a > img")?.attributes["src"] ?? "";
                let stars = this.getStarsFromPosition(item.querySelector("td.gl2e > div > div.gl3e > div.ir")?.attributes["style"] ?? "");
                let link = item.querySelector("td.gl1e > div > a")?.attributes["href"] ?? "";
                let tags = item.querySelectorAll('div.gt, div.gtl').map((e) => e.attributes["title"] ?? "");
                let pages = Number(item.querySelectorAll("td.gl2e > div > div.gl3e > div").find((element) => element.text.includes("page"))?.text.match(/\d+/)[0] ?? "");
                let language = tags.find((e) => e.startsWith("language:") && !e.includes('translated'))?.split(":")[1].trim() ?? null;
                galleries.push(new Comic({
                    id: link,
                    title: title,
                    subTitle: uploader,
                    cover: coverPath,
                    tags: tags,
                    description: time,
                    stars: stars,
                    maxPage: pages,
                    language: language
                }))
            } catch (e) {
                //忽视
            }
        }

        // minimal mode
        for (let item of document.querySelectorAll("table.itg.gltm > tbody > tr")) {
            try {
                let title = item.querySelector("td.gl3m > a > div.glink")?.text ?? "Unknown";
                let type = item.querySelector("td.gl1m > div.cs")?.text ?? "Unknown";
                let time = item.querySelectorAll("td.gl2m > div").find((element) => !isNaN(Date.parse(element.text)))?.text ?? "Unknown";
                let uploader = item.querySelector("td.gl5m > div > a")?.text ?? "Unknown";
                let coverPath = item.querySelector("td.gl2m > div > div > img")?.attributes["src"];
                if (coverPath[0] === 'd') {
                    coverPath = item.querySelector("td.gl2m > div > div > img")?.attributes["data-src"];
                }
                let stars = this.getStarsFromPosition(item.querySelector("td.gl4m > div.ir")?.attributes["style"] ?? "");
                let link = item.querySelector("td.gl3m > a")?.attributes["href"] ?? "";
                galleries.push(new Comic({
                    id: link,
                    title: title,
                    subTitle: uploader,
                    cover: coverPath,
                    description: time,
                    stars: stars,
                }))
            } catch (e) {
                //忽视
            }
        }

        let nextButton = document.querySelector("a#dnext");
        let next = nextButton?.attributes["href"]

        return {
            comics: galleries,
            next: next
        }
    }

    // explore page list
    explore = [
        {
            // title of the page.
            // title is used to identify the page, it should be unique
            title: "eh latest",

            /// multiPartPage or multiPageComicList or mixed
            type: "multiPageComicList",

            loadNext: (next) => {
                return this.getGalleries(next ?? this.baseUrl, false);
            }
        },
        {
            // title of the page.
            // title is used to identify the page, it should be unique
            title: "eh popular",

            /// multiPartPage or multiPageComicList or mixed
            type: "multiPageComicList",

            loadNext: (next) => {
                return this.getGalleries(next ?? `${this.baseUrl}/popular`, false);
            }
        },
    ]

    // categories
    category = {
        /// title of the category page, used to identify the page, it should be unique
        title: "ehentai",
        parts: [],
        // enable ranking page
        enableRankingPage: true,
    }

    /// category comic loading related
    categoryComics = {
        ranking: {
            // For a single option, use `-` to separate the value and text, left for value, right for text
            options: [
                "15-yesterday",
                "13-month",
                "12-year",
                "11-all"
            ],
            /**
             * load ranking comics
             * @param option {string} - option from optionList
             * @param page {number} - page number
             * @returns {Promise<{comics: Comic[], maxPage: number}>}
             */
            load: async (option, page) => {
                let res = await this.getGalleries(`https://e-hentai.org/toplist.php?tl=${option}&p=${page-1}`, true);
                let comics = res.comics
                if(this.loadSetting('domain') === 'exhentai.org') {
                    comics.forEach((e) => {
                        e.id = e.id.replace('e-hentai', 'exhentai')
                    })
                }
                return {
                    comics: comics,
                    maxPage: 200,
                }
            }
        }
    }

    /// search related
    search = {
        /**
         * load search result with next page token
         * @param keyword {string}
         * @param options {(string)[]} - options from optionList
         * @param next {string | null}
         * @returns {Promise<{comics: Comic[], maxPage: number}>}
         */
        loadNext: async (keyword, options, next) => {
            let category = JSON.parse(options[0]);
            let stars = options[1];
            let language = options[2];
            let fcats = 1023
            for(let c of category) {
                fcats -= 1 << Number(c)
            }
            if(language && !keyword.includes("language:")) {
                keyword += ` language:${language}`
            }
            let url = `${this.baseUrl}/?f_search=${encodeURIComponent(keyword)}`
            if(fcats) {
                url += `&f_cats=${fcats}`
            }
            if(stars) {
                url += `&f_srdd=${stars}`
            }
            return this.getGalleries(next ?? url, false);
        },

        // provide options for search
        optionList: [
            {
                // type: select, multi-select, dropdown
                type: "multi-select",
                // For a single option, use `-` to separate the value and text, left for value, right for text
                options: [
                    "0-Misc",
                    "1-Doujinshi",
                    "2-Manga",
                    "3-Artist CG",
                    "4-Game CG",
                    "5-Image Set",
                    "6-Cosplay",
                    "7-Asian Porn",
                    "8-Non-H",
                    "9-Western",
                ],
                // option label
                label: "Category",
                // default selected options
                default: ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"],
            },
            {
                // type: select, multi-select, dropdown
                // For select, there is only one selected value
                // For multi-select, there are multiple selected values or none. The `load` function will receive a json string which is an array of selected values
                // For dropdown, there is one selected value at most. If no selected value, the `load` function will receive a null
                type: "dropdown",
                // For a single option, use `-` to separate the value and text, left for value, right for text
                options: [
                    "-<none>",
                    "0-0",
                    "1-1",
                    "2-2",
                    "3-3",
                    "4-4",
                    "5-5",
                ],
                // option label
                label: "Min Stars",
            },
            {
                // type: select, multi-select, dropdown
                type: "dropdown",
                // For a single option, use `-` to separate the value and text, left for value, right for text
                options: [
                    "-<none>",
                    "chinese-Chinese",
                    "english-English",
                    "japanese-Japanese",
                ],
                // option label
                label: "Language",
            },
        ],

        // enable tags suggestions
        enableTagsSuggestions: true,
    }

    // favorite related
    favorites = {
        // whether support multi folders
        multiFolder: true,
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
            let parsed = this.parseUrl(comicId)
            let id = parsed.id
            let token = parsed.token
            if(isAdding) {
                let res = await Network.post(
                    `${this.baseUrl}/gallerypopups.php?gid=${id}&t=${token}&act=addfav`,
                    {
                        "Content-Type": "application/x-www-form-urlencoded",
                    },
                    `favcat=${folderId}&favnote=&apply=Add+to+Favorites&update=1`
                );
                if (res.status !== 200 || res.body.length === 0 || res.body[0] !== "<") {
                    throw "Failed to add favorite"
                }
                return "ok"
            } else {
                let res = await Network.post(
                    `${this.baseUrl}/gallerypopups.php?gid=${id}&t=${token}&act=addfav`,
                    {
                        "Content-Type": "application/x-www-form-urlencoded",
                    },
                    `favcat=favdel&favnote=&apply=Apply+Changes&update=1`
                );
                if (res.status !== 200 || res.body.length === 0 || res.body[0] !== "<") {
                    throw "Failed to delete favorite"
                }
                return "ok"
            }
        },
        /**
         * load favorite folders.
         * throw `Login expired` to indicate login expired, App will automatically re-login retry.
         * if comicId is not null, return favorite folders which contains the comic.
         * @param comicId {string?}
         * @returns {Promise<{folders: {[p: string]: string}, favorited: string[]}>} - `folders` is a map of folder id to folder name, `favorited` is a list of folder id which contains the comic
         */
        loadFolders: async (comicId) => {
            let res = await Network.get(`${this.baseUrl}/favorites.php`, {});
            if (res.status !== 200) {
                throw `Invalid status code: ${res.status}`
            }
            let document = new HtmlDocument(res.body);
            let folders = new Map();
            folders.set("-1", "All")
            let sum = 0;
            for (let item of document.querySelectorAll("div.fp")) {
                if (item.text === "Show All Favorites") continue;
                let name = item.children[2]?.text ?? `Favorite ${folders.size}`
                let length = item.children[0]?.text;
                if(length) {
                    name += ` (${length})`
                    sum += +length
                }
                folders.set((folders.size-1).toString(), name)
            }
            folders.set("-1", `All (${sum})`)
            document.dispose()
            let favorited = []
            if(comicId) {
                let comic = await this.comic.loadInfo(comicId)
                if(comic.isFavorite) {
                    favorited.push(comic.folder)
                }
            }
            return {
                folders: folders,
                favorited: favorited
            }
        },
        loadNext: async (next, folder) => {
            let url = `${this.baseUrl}/favorites.php`;
            if(folder !== '-1') {
                url += `?favcat=${folder}`
            }
            return this.getGalleries(next ?? url, false);
        }
    }

    /// single comic related
    comic = {
        /**
         * load comic info
         * @param id {string}
         * @returns {Promise<ComicDetails>}
         */
        loadInfo: async (id) => {
            let res = await Network.get(id, {
                'cookie': 'nw=1'
            });
            if (res.status !== 200) {
                throw `Invalid status code: ${res.status}`
            }
            if(res.body.trim().length === 0) {
                throw `Exception: empty data\nYou may not have permission to access this page.`
            }
            let document = new HtmlDocument(res.body);

            let tags = new Map();
            for(let tr of document.querySelectorAll("div#taglist > table > tbody > tr")) {
                tags.set(
                    tr.children[0].text.substring(0, tr.children[0].text.length - 1),
                    tr.children[1].children.map((e) =>
                        e.children[0]
                        .attributes["onclick"]
                        .split(":")[1]
                        .split("'")[0]
                    )
                )
            }

            let maxPage = "1"
            for(let element of document.querySelectorAll("td.gdt2")) {
                if (element.text.includes("page")) {
                    maxPage = element.text.match(/\d+/)[0];
                }
            }

            let isFavorited = true;
            if(document.querySelector("a#favoritelink")?.text === " Add to Favorites") {
                isFavorited = false;
            }
            let folder = null
            if(isFavorited) {
                let position = document
                    .querySelector("div#fav")
                    .children[0]
                    .attributes["style"]
                    .split("background-position:0px -")[1]
                    .split("px;")[0];
                folder = (Number(position-2) / 19).toString()
            }

            let coverPath = document.querySelector("div#gleft > div#gd1 > div").attributes["style"];
            coverPath = RegExp("https?://([-a-zA-Z0-9.]+(/\\S*)?\\.(?:jpg|jpeg|gif|png|webp))").exec(coverPath)[0];

            let uploader = document.getElementById("gdn")?.children[0]?.text

            let stars = Number(document.getElementById("rating_label")?.text?.split(':')?.at(1)?.trim());

            let category = document.querySelector("div.cs").text;
            tags.set("Category", [category])

            let time = document.querySelector("div#gdd > table > tbody > tr > td.gdt2").text

            let script = document.querySelectorAll("script").find((e) => e.text.includes("var token"));
            let reg = RegExp("var\\s+(\\w+)\\s*=\\s*(.*?);", "g");
            let variables = new Map();
            for(let match of script.text.matchAll(reg)) {
                variables.set(match[1], match[2]);
            }

            let title = document.querySelector("h1#gn").text;
            let subtitle = document.querySelector("h1#gj")?.text;
            if(subtitle != null && subtitle.trim() === "") {
                subtitle = null;
            }
            let comments = this.comic.parseComments(document)

            let comic = new ComicDetails({
                id: id,
                title: title,
                subTitle: subtitle,
                cover: coverPath,
                tags: tags,
                stars: stars,
                maxPage: Number(maxPage),
                isFavorite: isFavorited,
                uploader: uploader,
                uploadTime: time,
                url: id,
                comments: comments.comments,
            })

            comic.folder = folder
            comic.token = variables.get("token")
            this.apikey = variables.get("apikey")
            if(this.apikey[0] === '"') {
                this.apikey = this.apikey.substring(1, this.apikey.length - 1)
            }
            this.uid = variables.get("apiuid")

            document.dispose()

            return comic;
        },
        /**
         * [Optional] load thumbnails of a comic
         * @param id {string}
         * @param next {string?} - next page token, null for first page
         * @returns {Promise<{thumbnails: string[], next: string?, urls: string[]}>} - `next` is next page token, null for no more
         */
        loadThumbnails: async (id, next) => {
            let url = id
            if(next != null) {
                url += `?p=${next}`
            }
            let res = await Network.get(url, {
                'cache-time': 'long',
                'prevent-parallel': 'true',
                'cookie': 'nw=1'
            });
            if(res.status !== 200) {
                throw `Invalid status code: ${res.status}`
            }
            let document = new HtmlDocument(res.body);
            /**
             * @param e {HtmlElement}
             */
            let parseImageUrl = (e) => {
                let style = e.attributes['style'];
                let width = Number(style.split('width:')[1].split('px')[0])
                let height = Number(style.split('height:')[1].split('px')[0])
                let r = style.split("background:transparent url(")[1]
                let url = r.split(")")[0]
                let range = '';
                if(r.includes('px')) {
                    let position = Number(r.split(') -')[1].split('px')[0])
                    range += `x=${position}-${position + width}`
                }
                if (height)  range += `${range ? "&" : ""}y=0-${height}`;
                if (range)  url += `@${range}`;
                return url;
            };
            let images = document.querySelectorAll("div.gdtm > div").map((e) => {
                return parseImageUrl(e)
            });
            images.push(...document.querySelectorAll("div.gdtl > a > img").map((e) => e.attributes["src"]))
            if(images.length === 0) {
                for(let e of document.querySelectorAll("div.gt100 > a > div")
                    .map(e => e.children.length === 0 ? e : e.children[0])) {
                    images.push(parseImageUrl(e))
                }
                for(let e of document.querySelectorAll("div.gt200 > a > div")
                    .map(e => e.children.length === 0 ? e : e.children[0])) {
                    images.push(parseImageUrl(e))
                }
            }
            let urls = document.querySelectorAll("table.ptb > tbody > tr > td > a").map((e) => e.attributes["href"])
            let pageNumbers = urls.map((e) => {
                let n = Number(e.split("=")[1])
                if(isNaN(n)) {
                    return 0
                }
                return n
            })
            let maxPage = Math.max(...pageNumbers)
            let current = 0
            if(next) {
                current = Number(next)
            }
            current += 1
            if(current > maxPage) {
                current = null
            } else {
                current = current.toString()
            }
            let _urls = document.querySelectorAll("div#gdt a").map((e) => e.attributes["href"])
            document.dispose()
            return {
                thumbnails: images,
                urls: _urls,
                next: current
            }
        },

        /**
         * rate a comic
         * @param id
         * @param rating {number} - [0-10] app use 5 stars, 1 rating = 0.5 stars,
         * @returns {Promise<any>}
         */
        starRating: async (id, rating) => {
            let res = await Network.post(this.apiUrl, {
                'Content-Type': 'application/json'
            }, {
                'gid': this.parseUrl(id).id,
                'token': this.parseUrl(id).token,
                'method': 'rategallery',
                'rating': rating,
                'apikey': this.apikey,
                'apiuid': this.uid,
            })
            if(res.status !== 200) {
                throw `Invalid status code: ${res.status}`
            }
            return 'ok'
        },

        getKey: async (url) => {
            let res = await Network.get(url, {
                'cache-time': 'long',
                'prevent-parallel': 'true',
            })
            let document = new HtmlDocument(res.body)
            let script = document.querySelectorAll("script").find((e) => e.text.includes("showkey"));
            if(script) {
                let reg = RegExp("showkey=\"(.*?)\"", "g");
                let match = reg.exec(script.text)
                return {
                    'showkey': match[1]
                }
            }
            script = document.querySelectorAll("script").find((e) => e.text.includes("mpvkey"))?.text;
            document.dispose()
            if(script) {
                let mpvkey = script.split(';').find((e) => e.includes("mpvkey")).replaceAll(' ', '').split('=')[1].replaceAll('"', '');
                let imageList = script.split(';').find((e) => e.includes("imagelist")).replaceAll(' ', '').split('=')[1];
                return {
                    'mpvkey': mpvkey,
                    'imageKeys': JSON.parse(imageList).map((e) => e["k"])
                }
            }
            throw "Failed to get key"
        },
        /**
         * load images of a chapter
         * @param comicId {string}
         * @param epId {string?}
         * @returns {Promise<{images: string[]}>}
         */
        loadEp: async (comicId, epId) => {
            let comic = await this.comic.loadInfo(comicId)
            return {
                images: Array.from({length: comic.maxPage}, (_, i) => i.toString())
            }
        },
        /**
         * [Optional] provide configs for an image loading
         * @param image
         * @param comicId
         * @param epId
         * @param nl
         * @returns {{}}
         */
        onImageLoad: async (image, comicId, epId, nl) => {
            let first = await this.comic.loadThumbnails(comicId)
            console.log(first)
            let key = await this.comic.getKey(first.urls[0])
            let page = Number(image)

            let getImageFromApi = async (nl) => {
                if(key.mpvkey) {
                    let res = await Network.post(this.apiUrl, {
                        'Content-Type': 'application/json',
                    }, {
                        'gid': this.parseUrl(comicId).id,
                        "imgkey": key.imageKeys[page],
                        "method": "imagedispatch",
                        "page": Number(image) + 1,
                        "mpvkey": key.mpvkey,
                        "nl": nl,
                    })
                    let json = JSON.parse(res.body)
                    return {
                        url: json.i.toString(),
                        nl: json.s.toString()
                    }
                } else {
                    let parseImageKeyFromUrl = (url) => {
                        return url.split("/")[4]
                    }

                    let url = ''
                    if(page < first.thumbnails.length) {
                        url = first.urls[page]
                    } else {
                        let onePageLength = first.thumbnails.length
                        let shouldLoadPage = Math.floor(page / onePageLength)
                        let index = page % onePageLength
                        let thumbnails =
                            await this.comic.loadThumbnails(comicId, shouldLoadPage.toString())
                        url = thumbnails.urls[index]
                    }

                    let res = await Network.post(this.apiUrl, {
                        'Content-Type': 'application/json',
                    }, {
                        'gid': this.parseUrl(comicId).id,
                        "imgkey": parseImageKeyFromUrl(url),
                        "method": "showpage",
                        "page": page + 1,
                        "showkey": key.showkey,
                        "nl": nl,
                    })
                    let json = JSON.parse(res.body)
                    let i6 = json.i6
                    let reg = RegExp("nl\\('(.+?)'\\)").exec(i6)
                    nl = reg[1]
                    let image = json.i3
                    image = image.substring(image.indexOf("src=\"") + 5, image.indexOf("\" style"))
                    return {
                        url: image,
                        nl: nl
                    }
                }
            }

            let res = await getImageFromApi(nl)

            let onLoadFailed = null

            if(res.nl) {
                onLoadFailed = async () => {
                    return this.comic.onImageLoad(image, comicId, epId, res.nl)
                }
            }

            return {
                url: res.url,
                headers: {
                    'referer': this.baseUrl,
                },
                onLoadFailed: onLoadFailed,
            }
        },
        /**
         * [Optional] provide configs for a thumbnail loading
         * @param url {string}
         * @returns {{}}
         */
        onThumbnailLoad: (url) => {
            if(url.includes('s.exhentai.org')) {
                url = url.replace("s.exhentai.org", "ehgt.org")
            }
            return {
                url: url,
                headers: {
                    'referer': this.baseUrl,
                }
            }
        },
        parseComments: (document) => {
            let comments = []
            for(let c of document.querySelectorAll('div.c1')) {
                let name = c.querySelector('div.c3 > a')?.text ?? ""
                let time = c.querySelector('div.c3')?.text?.split("Posted on")?.at(1)?.split('by')?.at(0)?.trim() ?? 'unknown'
                let content = ''
                if(typeof appVersion) {
                    // since 1.0.6, [appVersion] field is available and rich comment is supported
                    content = c.querySelector('div.c6').innerHTML
                } else {
                    content = c.querySelector('div.c6').text
                }
                let score = Number(c.querySelector('div.c5 > span')?.text)
                if(isNaN(score)) {
                    score = null
                }
                let id = c.previousElementSibling?.attributes['name']?.match(/\d+/)[0] ?? '0'
                let isUp = c.querySelector(`a#comment_vote_up_${id}`)?.attributes['style']?.length > 0
                let isDown = c.querySelector(`a#comment_vote_down_${id}`)?.attributes['style']?.length > 0

                comments.push(new Comment({
                    id: id,
                    content: content,
                    time: time,
                    userName: name,
                    score: score,
                    voteStatus: isUp ? 1 : isDown ? -1 : 0,
                }))
            }

            return {
                comments: comments,
                maxPage: 1
            }
        },
        /**
         * [Optional] load comments
         * @param comicId {string}
         * @param subId {string?} - ComicDetails.subId
         * @param page {number}
         * @param replyTo {string?} - commentId to reply, not null when reply to a comment
         * @returns {Promise<{comments: Comment[], maxPage: number?}>}
         */
        loadComments: async (comicId, subId, page, replyTo) => {
            let res = await Network.get(`${comicId}?hc=1`, {
                'cookie': 'nw=1'
            });
            if(res.status !== 200) {
                throw `Invalid status code: ${res.status}`
            }
            let document = new HtmlDocument(res.body)
            let result = this.comic.parseComments(document)
            document.dispose()
            return result
        },
        /**
         * [Optional] send a comment, return any value to indicate success
         * @param comicId {string}
         * @param subId {string?} - ComicDetails.subId
         * @param content {string}
         * @param replyTo {string?} - commentId to reply, not null when reply to a comment
         * @returns {Promise<any>}
         */
        sendComment: async (comicId, subId, content, replyTo) => {
            let res = await Network.post(comicId, {
                'Content-Type': 'application/x-www-form-urlencoded',
                'referer': comicId,
            }, `commenttext_new=${encodeURIComponent(content)}`)
            if(res.status >= 400) {
                throw `Invalid status code: ${res.status}`
            }
            let document = new HtmlDocument(res.body)
            if(document.querySelector('p.br')) {
                throw document.querySelector('p.br').text
            }
            return 'ok'
        },
        /**
         * [Optional] vote a comment
         * @param id {string} - comicId
         * @param subId {string?} - ComicDetails.subId
         * @param commentId {string} - commentId
         * @param isUp {boolean} - true for up, false for down
         * @param isCancel {boolean} - true for cancel, false for vote
         * @returns {Promise<number>} - new score
         */
        voteComment: async (id, subId, commentId, isUp, isCancel) => {
            if(this.apikey == null || this.uid == null) {
                throw "Login required"
            }

            let res = await Network.post(this.apiUrl, {
                'Content-Type': 'application/json'
            }, {
                'gid': this.parseUrl(id).id,
                'token': this.parseUrl(id).token,
                'method': 'votecomment',
                'comment_id': commentId,
                'comment_vote': isUp ? 1 : -1,
                'apikey': this.apikey,
                'apiuid': this.uid,
            })

            let json = JSON.parse(res.body)

            if(json.error) {
                throw json.error
            }

            return json.comment_score
        },
        archive: {
            getArchives: async (cid) => {
                let comicInfo = await this.comic.loadInfo(cid)
                let urlParseResult = this.parseUrl(cid)
                let gid = urlParseResult.id
                let token = urlParseResult.token
                let res = await Network.get(`${this.baseUrl}/archiver.php?gid=${gid}&token=${token}`, {})
                if(res.status !== 200) {
                    throw `Invalid status code: ${res.status}`
                }
                let document = new HtmlDocument(res.body)
                let body = document.querySelector("div#db")
                let index = this.baseUrl.includes("exhentai") ? 1 : 3
                let origin = body.children[index].children[0];
                let originCost = origin.querySelector("div > strong").text;
                let originSize = origin.querySelector("p > strong").text;
                let resample = body.children[index].children[1];
                let resampleCost = resample.querySelector("div > strong").text;
                let resampleSize = resample.querySelector("p > strong").text;
                return [
                    {
                        id: '0',
                        title: 'Original',
                        description: `Cost: ${originCost}, Size: ${originSize}`,
                    },
                    {
                        id: '1',
                        title: 'Resample',
                        description: `Cost: ${resampleCost}, Size: ${resampleSize}`,
                    }
                ]
            },
            getDownloadUrl: async (cid, aid) => {
                let data = aid === '0'
                    ? "dltype=org&dlcheck=Download+Original+Archive"
                    : "dltype=res&dlcheck=Download+Resample+Archive"
                let urlParseResult = this.parseUrl(cid)
                let gid = urlParseResult.id
                let token = urlParseResult.token
                let res = await Network.post(`${this.baseUrl}/archiver.php?gid=${gid}&token=${token}`, {
                    "Content-Type": "application/x-www-form-urlencoded",
                }, data)
                if (res.status !== 200) {
                    throw `Invalid status code: ${res.status}`
                }
                let document = new HtmlDocument(res.body)
                let link = document.querySelector("a")?.attributes["href"]
                if(!link) {
                    throw "Failed to get download link"
                }
                let res2 = await Network.get(link, {
                    'http_client': 'dart:io' // The server is uncomfortable with the default client
                })
                document.dispose()
                document = new HtmlDocument(res2.body)
                let link2 = document.querySelector("a")?.attributes["href"]
                document.dispose()
                function getHost(url) {
                    const regex = /^(?:https?:\/\/)?(?:www\.)?([^\/]+)/i;
                    const match = url.match(regex);
                    return match ? match[1] : null;
                }
                let host = getHost(link)
                let resultLink = "https://" + host + link2
                let test = await Network.sendRequest('HEAD', resultLink, {
                    'http_client': 'dart:io',
                }, null)
                if(test.status === 410) {
                    throw "IP quota exhausted."
                }
                return resultLink
            },
        },
        /**
         * [Optional] Handle tag click event
         * @param namespace {string}
         * @param tag {string}
         * @returns {{action: string, keyword: string, param: string?}}
         */
        onClickTag: (namespace, tag) => {
            if(tag.includes(' ')) {
                tag = `"${tag}"`
            }
            return {
                // 'search' or 'category'
                action: 'search',
                keyword: `${namespace}:${tag}`,
                // {string?} only for category action
                param: null,
            }
        },
        /**
         * [Optional] Handle links
         */
        link: {
            /**
             * set accepted domains
             */
            domains: [
                'e-hentai.org',
                'exhentai.org'
            ],
            /**
             * parse url to comic id
             * @param url {string}
             * @returns {string | null}
             */
            linkToId: (url) => {
                if(url.includes('?')) {
                    url = url.split('?')[0]
                }
                let reg = RegExp("https?://(e-|ex)hentai.org/g/(\\d+)/(\\w+)/")
                let match = reg.exec(url)
                if(match) {
                    return `${this.baseUrl}/g/${match[2]}/${match[3]}/`
                }
                return null
            }
        },
        enableTagsTranslate: true,
    }


    /*
    [Optional] settings related
    Use this.loadSetting to load setting
    ```
    let setting1Value = this.loadSetting('setting1')
    console.log(setting1Value)
    ```
     */
    settings = {
        domain: {
            // title
            title: "domain",
            // type: input, select, switch
            type: "select",
            // options
            options: [
                {
                    value: 'e-hentai.org',
                },
                {
                    value: 'exhentai.org',
                },
            ],
            default: 'e-hentai.org',
        },
    }

    // [Optional] translations for the strings in this config
    translation = {
        'zh_CN': {
            "domain": "域名",
            "language": "语言",
            "artist": "画师",
            "male": "男性",
            "female": "女性",
            "mixed": "混合",
            "other": "其它",
            "parody": "原作",
            "character": "角色",
            "group": "团队",
            "cosplayer": "Coser",
            "reclass": "重新分类",
            "Languages": "语言",
            "Artists": "画师",
            "Characters": "角色",
            "Groups": "团队",
            "Tags": "标签",
            "Parodies": "原作",
            "Categories": "分类",
            "Category": "分类",
            "Min Stars": "最少星星",
            "Language": "语言",
        },
        'zh_TW': {
            'domain': '域名',
            "language": "語言",
            "artist": "畫師",
            "male": "男性",
            "female": "女性",
            "mixed": "混合",
            "other": "其他",
            "parody": "原作",
            "character": "角色",
            "group": "團隊",
            "cosplayer": "Coser",
            "reclass": "重新分類",
            "Languages": "語言",
            "Artists": "畫師",
            "Characters": "角色",
            "Groups": "團隊",
            "Tags": "標籤",
            "Parodies": "原作",
            "Categories": "分類",
            "Category": "分類",
            "Min Stars": "最少星星",
            "Language": "語言",
        },
    }
}
