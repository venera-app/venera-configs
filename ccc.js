/** @type {import('./_venera_.js')} */
class CCC extends ComicSource {
    // Note: The fields which are marked as [Optional] should be removed if not used

    // name of the source
    name = "CCC追漫台"

    // unique id of the source
    key = "ccc"

    version = "1.0.1"

    minAppVersion = "1.6.0"

    // update url
    url = "https://git.nyne.dev/nyne/venera-configs/raw/branch/main/ccc.js"

    apiUrl = "https://api.creative-comic.tw"

    processToken(body) {
        const result = JSON.parse(body);
        if (result.code != 0) {
            throw "登錄失敗";
        }
        this.saveData("expireTime", Math.floor(Date.now() / 1000) + result.expires_in);
        this.saveData("refreshToken", result.refresh_token);
        this.saveData("token", result.access_token);
    }

    async getApiHeaders(login = false) {
        let token = this.loadData("token");
        if (!login && token) {
            if (Math.floor(Date.now() / 1000) > this.loadData("expireTime")) {
                const res = await Network.post(`${this.apiUrl}/token`, {
                    device: "web_desktop",
                    uuid: "null"
                }, {
                    "grant_type": "refresh_token",
                    "client_id": "2",
                    "client_secret": "9eAhsCX3VWtyqTmkUo5EEaoH4MNPxrn6ZRwse7tE",
                    "refresh_token": this.loadData("refreshToken")
                });
                if (res.body.search("Token has been revoked") == -1) {
                    this.processToken(res.body);
                } else {
                    const accountData = this.loadData("account");
                    if (accountData) {
                        await this.account.login(accountData[0], accountData[1]);
                    } else {
                        throw "請重新登錄";
                    }
                }
                token = this.loadData("token");
            }
            return {
                device: "web_desktop",
                Authorization: `Bearer ${token}`
            }
        }
        return {
            device: "web_desktop",
            uuid: "null"
        }
    }

    base64ToArrayBuffer(base64) {
        const base64Data = base64.split(',')[1] || base64;
        return Convert.decodeBase64(base64Data);
    }

    async parseComics(url) {
        const res = await Network.get(url, await this.getApiHeaders());
        const result = [];
        const jsonData = JSON.parse(res.body)["data"];
        for (let c of jsonData["data"]) {
            const tags = [];
            for (let a of c["author"]) {
                tags.push(a["name"]);
            }
            if (typeof (c["type"]) == "object") {
                tags.push(c["type"]["name"]);
            }
            result.push({
                id: (("book_id" in c) ? c["book_id"] : c["id"]).toString(),
                title: c["name"],
                subtitle: c["brief"],
                description: c["description"],
                cover: c["image1"]??c["image2"]??c["image3"],
                tags: tags
            });
        }
        return { comics: result, maxPage: Math.ceil(jsonData["total"] / 20) };
    }

    // [Optional] account related
    account = {
        /**
         * [Optional] login with account and password, return any value to indicate success
         * @param account {string}
         * @param pwd {string}
         * @returns {Promise<any>}
         */
        login: async (account, pwd) => {
            let res = await Network.get(`${this.apiUrl}/recaptcha#${randomInt(0, 999)}`, await this.getApiHeaders(true)); //使用隨機fragment來強制url重新加載
            const captcha = JSON.parse(res.body);
            if (captcha.message != "ok") {
                throw "登錄失敗";
            }
            const captcha_code = await UI.showInputDialog("驗證碼", null, this.base64ToArrayBuffer(captcha.result.img));
            res = await Network.post(`${this.apiUrl}/token`, await this.getApiHeaders(true), {
                "grant_type": "password",
                "client_id": "2",
                "client_secret": "9eAhsCX3VWtyqTmkUo5EEaoH4MNPxrn6ZRwse7tE",
                "username": account,
                "password": pwd,
                "key": captcha.result.key,
                "captcha": captcha_code
            })
            this.processToken(res.body);
            return "ok";
        },

        /**
         * [Optional] login with webview
         */
        loginWithWebview: {
            url: "https://www.creative-comic.tw/zh/login",
            /**
             * check login status.
             * After successful login, the cookie will be automatically saved, and the localstorage can be retrieved using this.loadData("_localStorage").
             * @param url {string} - current url
             * @param title {string} - current title
             * @returns {boolean} - return true if login success
             */
            checkStatus: (url, title) => {
                return (title == "CCC追漫台");
            },
            /**
             * [Optional] Callback when login success
             */
            onLoginSuccess: () => {
                const localStorage = this.loadData("_localStorage");
                if (localStorage) {
                    const token = localStorage["accessToken"];
                    let base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
                    base64 = base64 + '='.repeat((4 - base64.length % 4) % 4);
                    const jsonPayload = decodeURIComponent(
                        Convert.decodeUtf8(Convert.decodeBase64(base64))
                            .split('')
                            .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
                            .join('')
                    );
                    this.saveData("expireTime", JSON.parse(jsonPayload)["exp"]);
                    this.saveData("refreshToken", localStorage["refreshToken"]);
                    this.saveData("token", token);
                }
            },
        },

        /**
         * logout function, clear account related data
         */
        logout: () => {
            this.deleteData("expireTime");
            this.deleteData("refreshToken");
            this.deleteData("token");
        },

        // {string?} - register url
        registerWebsite: "https://www.creative-comic.tw/zh/signup"
    }

    // explore page list
    explore = [
        {
            // title of the page.
            // title is used to identify the page, it should be unique
            title: "CCC追漫台",

            /// multiPartPage or multiPageComicList or mixed
            type: "singlePageWithMultiPart",

            /**
             * load function
             * @param page {number | null} - page number, null for `singlePageWithMultiPart` type
             * @returns {{}}
             * - for `multiPartPage` type, return [{title: string, comics: Comic[], viewMore: string?}]
             * - for `multiPageComicList` type, for each page(1-based), return {comics: Comic[], maxPage: number}
             * - for `mixed` type, use param `page` as index. for each index(0-based), return {data: [], maxPage: number?}, data is an array contains Comic[] or {title: string, comics: Comic[], viewMore: string?}
             */
            load: async () => {
                const res = await Network.get(`${this.apiUrl}/public/home_v2`, await this.getApiHeaders());
                const result = {};
                const jsonData = JSON.parse(res.body)["data"];
                let curTitle = null;
                for (let data of jsonData["templates"]) {
                    if ([4, 5].indexOf(data["type"]) != -1) {
                        continue;
                    }
                    const comics = [];
                    for (let c of data["list"]) {
                        comics.push({
                            id: c["value"],
                            title: c["name"],
                            cover: c["image1"]??c["image2"]??c["image3"],
                            tags: [c["book_type"]["name"]],
                            subtitle: c["brief"]
                        });
                    }
                    if (data["title"]) {
                        curTitle = data["title"];
                        result[curTitle] = comics;
                    } else {
                        result[curTitle] = result[curTitle].concat(comics);
                    }
                }
                return result;
            }
        }
    ]

    // categories
    category = {
        /// title of the category page, used to identify the page, it should be unique
        title: "CCC追漫台",
        parts: [
            {
                name: "CCC追漫台",
                type: "fixed",
                categories: ["排行榜"],
                itemType: "category",
                categoryParams: ["top"]
            }
        ],
        // enable ranking page
        enableRankingPage: false,
    }

    /// category comic loading related
    categoryComics = {
        /**
         * load comics of a category
         * @param category {string} - category name
         * @param param {string?} - category param
         * @param options {string[]} - options from optionList
         * @param page {number} - page number
         * @returns {Promise<{comics: Comic[], maxPage: number}>}
         */
        load: async (category, param, options, page) => {
            if (options == null) {
                options = ["", "read"];
            }
            const type = options[0] ? `&type=${options[0]}` : "";
            const url = `${this.apiUrl}/rank?page=${page}&rows_per_page=20&rank=${options[1]}&class=2${type}`;
            return await this.parseComics(url);
        },
        /**
         * [Optional] load options dynamically. If `optionList` is provided, this will be ignored.
         * @param category {string}
         * @param param {string?}
         * @return {Promise<{options: string[], label?: string}[]>} - return a list of option group, each group contains a list of options
         */
        optionList: [
            {
                label: "分類",
                // For a single option, use `-` to separate the value and text, left for value, right for text
                options: [
                    "-全部",
                    "2-劇情",
                    "6-愛情",
                    "5-青春成長",
                    "3-幽默搞笑",
                    "10-歷史古裝",
                    "7-奇幻架空",
                    "4-溫馨療癒",
                    "9-冒險動作",
                    "8-恐怖驚悚",
                    "12-新感覺推薦",
                    "11-推理懸疑",
                    "13-活動"
                ]
            },
            {
                label: "排行榜",
                // For a single option, use `-` to separate the value and text, left for value, right for text
                options: [
                    "read-人氣榜",
                    "buy-銷售榜",
                    "donate-斗内榜",
                    "collect-收藏榜"
                ]
            }
        ]
    }

    /// search related
    search = {
        /**
         * load search result
         * @param keyword {string}
         * @param options {(string | null)[]} - options from optionList
         * @param page {number}
         * @returns {Promise<{comics: Comic[], maxPage: number}>}
         */
        load: async (keyword, options, page) => {
            options[0] = "&sort_by=" + options[0];
            if (options[1]) {
                options[1] = "&type=" + options[1];
            }
            if (options[2]) {
                options[2] = "&serial=" + options[2];
            }
            if (options[3]) {
                options[3] = "&updated_at=" + options[3];
            }
            if (options[4]) {
                options[4] = "&literature_form=" + options[4];
            }
            if (options[5]) {
                options[5] = "&comic_type=" + options[5];
            }
            if (options[6]) {
                options[6] = "&publisher=" + options[6];
            }
            const url = `https://api.creative-comic.tw/book?page=${page}&rows_per_page=20&keyword=${keyword}&class=2${options.join("")}`;
            return await this.parseComics(url);
        },

        // provide options for search
        optionList: [
            {
                type: "select",
                // For a single option, use `-` to separate the value and text, left for value, right for text
                options: [
                    "updated_at-最新",
                    "read_count-閲覽",
                    "like_count-推薦",
                    "collect_count-收藏"
                ],
                // option label
                label: "排序"
            },
            {
                type: "select",
                // For a single option, use `-` to separate the value and text, left for value, right for text
                options: [
                    "-全部",
                    "2-劇情",
                    "6-愛情",
                    "5-青春成長",
                    "3-幽默搞笑",
                    "10-歷史古裝",
                    "7-奇幻架空",
                    "4-溫馨療癒",
                    "9-冒險動作",
                    "8-恐怖驚悚",
                    "12-新感覺推薦",
                    "11-推理懸疑",
                    "13-活動"
                ],
                // option label
                label: "分類"
            },
            {
                type: "select",
                // For a single option, use `-` to separate the value and text, left for value, right for text
                options: [
                    "-全部",
                    "2-已完結",
                    "0-連載中"
                ],
                // option label
                label: "連載狀態"
            },
            {
                type: "select",
                // For a single option, use `-` to separate the value and text, left for value, right for text
                options: [
                    "-全部",
                    "month-本月",
                    "week-本周"
                ],
                // option label
                label: "更新日期"
            },
            {
                type: "select",
                // For a single option, use `-` to separate the value and text, left for value, right for text
                options: [
                    "-全部",
                    "1-短篇",
                    "2-中篇",
                    "3-長篇"
                ],
                // option label
                label: "作品篇幅"
            },
            {
                type: "select",
                // For a single option, use `-` to separate the value and text, left for value, right for text
                options: [
                    "-全部",
                    "3-條漫",
                    "2-格漫",
                ],
                // option label
                label: "作品形式"
            },
            {
                type: "dropdown",
                options: [
                    "-全部",
                    "44-MOJOIN",
                    "37-目宿媒體股份有限公司",
                    "4-大辣出版",
                    "18-MarsCat火星貓科技",
                    "2-CCC創作集",
                    "23-海穹文化",
                    "11-國立歷史博物館",
                    "6-未來數位",
                    "34-虎尾建國眷村再造協會",
                    "24-鏡文學股份有限公司",
                    "43-Taiwan Comic City",
                    "42-聯經出版事業股份有限公司",
                    "48-東立出版社有限公司",
                    "9-留守番工作室",
                    "16-獨步文化",
                    "21-尖端媒體集團",
                    "29-相之丘tōkhiu books",
                    "7-威向文化",
                    "54-白範出版工作室",
                    "22-時報文化出版企業股份有限公司",
                    "20-國立臺灣工藝研究發展中心",
                    "17-獨立出版",
                    "51-大寬文化工作室",
                    "32-金繪國際有限公司",
                    "47-前衛出版社",
                    "36-奇異果文創",
                    "14-綺影映畫",
                    "53-彰化縣政府",
                    "31-艾德萊娛樂",
                    "8-特有生物研究保育中心",
                    "39-聚場文化",
                    "38-XPG",
                    "52-陌上商行有限公司",
                    "49-國際合製｜臺漫新視界",
                    "40-KADOKAWA",
                    "10-國立臺灣美術館",
                    "26-金漫獎",
                    "5-台灣東販",
                    "45-國立國父紀念館",
                    "35-國立臺灣歷史博物館",
                    "15-蓋亞文化",
                    "1-長鴻出版社",
                    "19-柒拾陸號原子",
                    "33-台灣角川",
                    "28-一顆星工作室",
                    "46-好人出版",
                    "27-澄波藝術文化股份有限公司",
                    "12-黑白文化",
                    "13-慢工文化 Slowork Publishing",
                    "30-經濟部智慧財產局",
                    "50-Contents Lab. Blue TOKYO",
                    "3-大塊文化",
                    "25-目色出版",
                    "41-文化內容策進院"
                ],
                label: "出版社"
            }
        ],
    }

    // favorite related
    favorites = {
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
            if (!this.isLogged) {
                throw "請先登錄";
            }
            const res = await Network.put(`${this.apiUrl}/book/${comicId}/collect`, await this.getApiHeaders(), { "is_collected": isAdding });
            if (JSON.parse(res.body)["message"] != "ok") {
                throw `${isAdding ? "添加" : "移除"}收藏失敗`;
            }
            return "ok";
        },
        /**
         * load comics in a folder
         * throw `Login expired` to indicate login expired, App will automatically re-login retry.
         * @param page {number}
         * @param folder {string?} - folder id, null for non-multi-folder
         * @returns {Promise<{comics: Comic[], maxPage: number}>}
         */
        loadComics: async (page, folder) => {
            return this.parseComics(`${this.apiUrl}/bookcase/collections?page=${page}&rows_per_page=20&sort_by=updated_at&class=2`);
        },
        singleFolderForSingleComic: true,
    }

    /// single comic related
    comic = {
        freeRead: (data) => {
            let free_read = true;
            if (!data["is_free"]) {
                if (data["sales_plan"] != 0) {
                    if ((data["is_coin_buy"] || data["is_point_buy"]) && !data["is_buy"]) {
                        if ((data["is_coin_rent"] || data["is_point_rent"]) && !data["is_rent"]) {
                            free_read = false;
                        }
                    }
                }
            }
            return free_read;
        },
        /**
         * load comic info
         * @param id {string}
         * @returns {Promise<ComicDetails>}
         */
        loadInfo: async (id) => {
            const res = await Network.get(`${this.apiUrl}/book/${id}/info`, await this.getApiHeaders());
            const jsonData = JSON.parse(res.body)["data"];
            const authors = [];
            for (let a of jsonData["author"]) {
                authors.push(a["name"]);
            }
            const tags = [];
            for (let t of jsonData["tags"]) {
                tags.push(t["name"]);
            }
            const chapter_res = await Network.get(`${this.apiUrl}/book/${id}/chapter`, await this.getApiHeaders());
            const chapterData = JSON.parse(chapter_res.body)["data"];
            const chapters = {};
            for (let c of chapterData["chapters"]) {
                chapters[c["id"].toString()] = `${!this.comic.freeRead(c) ? "[付費]" : ""}${c["vol_name"]}-${c["name"]}`;
            }
            const recommend_res = await Network.get(`${this.apiUrl}/book/${id}/recommend`, await this.getApiHeaders());
            const recommendData = JSON.parse(recommend_res.body)["data"];
            const recommends = [];
            for (let r of recommendData["hot"]) {
                recommends.push({
                    title: r["name"],
                    cover: r["image1"]??r["image2"]??r["image3"],
                    id: r["id"].toString(),
                    subtitle: r["brief"]
                });
            }
            for (let r of recommendData["history"]) {
                recommends.push({
                    title: r["name"],
                    cover: r["image1"]??r["image2"]??r["image3"],
                    id: r["id"].toString()
                });
            }
            for (let r of recommendData["also_buy"]) {
                recommends.push({
                    title: r["name"],
                    cover: r["image1"]??r["image2"]??r["image3"],
                    id: r["id"].toString()
                });
            }
            return new ComicDetails({
                title: jsonData["name"],
                subtitle: jsonData["brief"],
                cover: jsonData["image1"]??jsonData["image2"]??jsonData["image3"],
                description: jsonData["description"],
                likesCount: jsonData["like_count_only_uuid"],
                chapters: chapters,
                tags: {
                    "作者": authors,
                    "分類": [jsonData["type"]["name"]],
                    "標籤": tags,
                },
                isFavorite: (jsonData["is_collected"] == 1),
                updateTime: jsonData["updated_at"],
                recommend: recommends
            })
        },
        /**
         * load images of a chapter
         * @param comicId {string}
         * @param epId {string?}
         * @returns {Promise<{images: string[]}>}
         */
        loadEp: async (comicId, epId) => {
            const res = await Network.get(`${this.apiUrl}/book/chapter/${epId}`, await this.getApiHeaders());
            if (res.status == 403) {
                UI.showDialog("提示", "該章節需付費后閲讀", [
                    {
                        text: "取消",
                        callback: () => { }
                    },
                    {
                        text: "去購買",
                        callback: () => {
                            UI.launchUrl(`https://www.creative-comic.tw/zh/book/${comicId}/content`);
                        }
                    }
                ]);
                return { images: [] };
            }
            const jsonData = JSON.parse(res.body)["data"];
            const images = [];
            for (let img of jsonData["chapter"]["proportion"]) {
                images.push(img["id"].toString());
            }
            return {
                images: images
            }
        },
        /**
         * [Optional] provide configs for an image loading
         * @param url
         * @param comicId
         * @param epId
         * @returns {{} | Promise<{}>}
         */
        onImageLoad: async (url, comicId, epId) => {
            const res = await Network.get(`${this.apiUrl}/book/chapter/image/${url}`, await this.getApiHeaders());
            const encryptedKey = Convert.decodeBase64(JSON.parse(res.body)["data"]["key"]);
            let token = this.loadData("token");
            if (token == null) {
                token = "freeforccc2020reading";
            }
            const hashArray = Convert.sha512(Convert.encodeUtf8(token));
            const pageKey = hashArray.slice(0, 32);
            const pageIv = hashArray.slice(15, 31);
            const decryptedKey = new Uint8Array(Convert.decryptAesCbc(encryptedKey, pageKey, pageIv));
            const padLen = decryptedKey[decryptedKey.length - 1];
            const [key, iv] = Convert.decodeUtf8(decryptedKey.slice(0, decryptedKey.length - padLen).buffer).split(":");
            return {
                url: `https://storage.googleapis.com/ccc-www/fs/chapter_content/encrypt/${url}/2`,
                onResponse: function (buffer) {
                    function hexToBytes(hex) {
                        if (hex.length % 2 !== 0) {
                            throw new Error("Invalid hex string");
                        }
                        const bytes = new Uint8Array(hex.length / 2);
                        for (let i = 0; i < hex.length; i += 2) {
                            bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
                        }
                        return bytes.buffer;
                    }
                    const decrypted = new Uint8Array(Convert.decryptAesCbc(buffer, hexToBytes(key), hexToBytes(iv)));
                    const padLen_ = decrypted[decrypted.length - 1];
                    const base64 = Convert.decodeUtf8(decrypted.slice(0, decrypted.length - padLen_).buffer);
                    const base64Data = base64.split(',')[1] || base64;
                    return Convert.decodeBase64(base64Data);
                }
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
            const res = await Network.get(`${this.apiUrl}/book/${comicId}/reply?page=${page}&rows_per_page=20&sort_by=created_at&descending=true#${randomInt(0, 999)}`,
                //使用隨機fragment來强制url重新加載
                await this.getApiHeaders());
            const jsonData = JSON.parse(res.body)["data"];
            let maxPage = 0;
            const comments = [];
            if (replyTo) {
                for (let c of jsonData["data"]) {
                    if (c["id"].toString() == replyTo) {
                        for (let c_ of c["replies"]) {
                            comments.push({
                                userName: c_["member"]["name"] ? c_["member"]["name"] : c_["member"]["nickname"],
                                avatar: c_["member"]["avatar"],
                                content: c_["content"],
                                time: c_["created_at"],
                                id: c_["id"].toString(),
                                isLiked: (c_["is_like"] == 1),
                            });
                        }
                        break;
                    }
                }
            } else {
                for (let c of jsonData["data"]) {
                    comments.push({
                        userName: c["member"]["name"] ? c["member"]["name"] : c["member"]["nickname"],
                        avatar: c["member"]["avatar"],
                        content: c["content"],
                        time: c["created_at"],
                        replyCount: c["reply_count"],
                        id: c["id"].toString(),
                        isLiked: (c["is_like"] == 1),
                        score: c["like_count"]
                    });
                }
                maxPage = Math.ceil(jsonData["total"] / 20);
            }
            return {
                comments: comments,
                maxPage: maxPage
            };
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
            if (!this.isLogged) {
                throw "請先登錄";
            }
            let url = null;
            if (replyTo) {
                url = `${this.apiUrl}/book/reply/${replyTo}/reply`;
            } else {
                url = `${this.apiUrl}/book/${comicId}/reply`;
            }
            const boundary = "----geckoformboundary" + Math.random().toString(16).replace(".", "a") + Math.random().toString(16).replace(".", "a");
            const body = `--${boundary}\r\n` +
                `Content-Disposition: form-data; name="content"\r\n\r\n${content}\r\n` +
                `--${boundary}\r\n` +
                `Content-Disposition: form-data; name="is_spoiled"\r\n\r\n0\r\n` +
                `--${boundary}--\r\n`;
            const headers = await this.getApiHeaders();
            headers["Content-Type"] = `multipart/form-data; boundary=${boundary}`;
            const res = await Network.post(url, headers, body);
            if (JSON.parse(res.body)["message"] != "ok") {
                throw "評論失敗";
            }
            return "ok";
        },
        likeComment: async (comicId, subId, commentId, isLike) => {
            if (commentId.endsWith("@")) {
                throw "不支持點贊";
            }
            const res = await Network.put(`${this.apiUrl}/book/reply/${commentId.split("@")[0]}/like`,
                await this.getApiHeaders(), { "is_like": isLike ? 1 : 0 });
            if (JSON.parse(res.body)["message"] != "ok") {
                throw "點贊失敗";
            }
            return "ok";
        },
        /**
         * [Optional] Handle tag click event
         * @param namespace {string}
         * @param tag {string}
         * @returns {{action: string, keyword: string, param: string?}}
         */
        onClickTag: (namespace, tag) => {
            return {
                action: 'search',
                keyword: tag
            }
        },
    }

}
