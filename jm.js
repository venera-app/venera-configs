class JM extends ComicSource {
    // Note: The fields which are marked as [Optional] should be removed if not used

    // name of the source
    name = "禁漫天堂"

    // unique id of the source
    key = "jm"

    version = "1.1.3"

    minAppVersion = "1.2.5"

    // update url
    url = "https://cdn.jsdelivr.net/gh/venera-app/venera-configs@main/jm.js"

    static apiDomains = [
        "www.jmapiproxyxxx.vip",
        "www.cdnblackmyth.club",
        "www.cdnmhws.cc",
        "www.cdnmhwscc.org"
    ];

    static imageUrl = "https://cdn-msp.jmapinodeudzn.net"

    static apiUa = "Mozilla/5.0 (Linux; Android 10; K; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/130.0.0.0 Mobile Safari/537.36"

    static imgUa = "okhttp/3.12.1"

    get baseUrl() {
        let index = parseInt(this.loadSetting('apiDomain')) - 1
        return `https://${JM.apiDomains[index]}`
    }

    get imageUrl() {
        return JM.imageUrl
    }

    overwriteApiDomains(domains) {
        if (domains.length != 0) JM.apiDomains = domains
    }

    overwriteImgUrl(url) {
        if (url.length != 0) JM.imageUrl = url
    }

    isNum(str) {
        return /^\d+$/.test(str)
    }

    get apiUa() {
        return JM.apiUa;
    }

    get imgUa() {
        return JM.imgUa;
    }

    getCoverUrl(id) {
        return `${this.imageUrl}/media/albums/${id}_3x4.jpg`
    }

    getImageUrl(id, imageName) {
        return `${this.imageUrl}/media/photos/${id}/${imageName}`
    }

    getAvatarUrl(imageName) {
        return `${this.imageUrl}/media/users/${imageName}`
    }

    async init() {
        if (this.loadSetting('refreshDomainsOnStart')) await this.refreshApiDomains(false)
        this.refreshImgUrl(false)
    }

    /**
     *
     * @param showConfirmDialog {boolean}
     */
    async refreshApiDomains(showConfirmDialog) {
        let today = new Date();
        let url = "https://jmappc01-1308024008.cos.ap-guangzhou.myqcloud.com/server-2024.txt"
        let domainSecret = "diosfjckwpqpdfjkvnqQjsik"
        let title = ""
        let message = ""
        let domains = []
        let res = await fetch(
            `${url}?time=${today.getFullYear()}${today.getMonth() + 1}${today.getDate()}`,
            {headers: {"User-Agent": this.imgUa}}
        )
        if (res.status === 200) {
            let data = this.convertData(await res.text(), domainSecret)
            let json = JSON.parse(data)
            if (json["Server"]) {
                title = "Update Success"
                message = "New domains:\n\n"
                domains = json["Server"]
            }
        }
        if (domains.length === 0) {
            title = "Update Failed"
            message = `Using built-in domains:\n\n`
            domains = JM.apiDomains
        }
        for (let i = 0; i < domains.length; i++) {
            message = message + `Stream ${i + 1}: ${domains[i]}\n`
        }
        if (showConfirmDialog) {
            UI.showDialog(
                title,
                message,
                [
                    {
                        text: "Cancel",
                        callback: () => {}
                    },
                    {
                        text: "Apply",
                        callback: () => {
                            this.overwriteApiDomains(domains)
                            this.refreshImgUrl(true)
                        }
                    }
                ]
            )
        } else {
            this.overwriteApiDomains(domains)
        }
    }

    /**
     *
     * @param showMessage {boolean}
     */
    async refreshImgUrl(showMessage) {
        let index = this.loadSetting('imageStream')
        let res = await this.get(
            `${this.baseUrl}/setting?app_img_shunt=${index}`
        )
        let setting = JSON.parse(res)
        if (setting["img_host"]) {
            if (showMessage) {
                UI.showMessage(`Image Stream ${index}:\n${setting["img_host"]}`)
            }
            this.overwriteImgUrl(setting["img_host"])
        }
    }

    /**
     *
     * @param comic {object}
     * @returns {Comic}
     */
    parseComic(comic) {
        let id = comic.id.toString()
        let author = comic.author
        let title = comic.name
        let description = comic.description ?? ""
        let cover = this.getCoverUrl(id)
        let tags =[]
        if(comic["category"]["title"]) {
            tags.push(comic["category"]["title"])
        }
        if(comic["category_sub"]["title"]) {
            tags.push(comic["category_sub"]["title"])
        }
        return new Comic({
            id: id,
            title: title,
            subTitle: author,
            cover: cover,
            tags: tags,
            description: description
        })
    }

    getHeaders(time) {
        const jmVersion = "1.7.6"
        const jmAuthKey = "18comicAPPContent"
        let token = Convert.md5(Convert.encodeUtf8(`${time}${jmAuthKey}`))

        return {
            "token": Convert.hexEncode(token),
            "tokenparam": `${time},${jmVersion}`,
            "Accept-Encoding": "gzip",
            "User-Agent": this.apiUa,
        }
    }

    /**
     *
     * @param input {string}
     * @param secret {string}
     * @returns {string}
     */
    convertData(input, secret) {  
        let key = Convert.encodeUtf8(Convert.hexEncode(Convert.md5(Convert.encodeUtf8(secret))))
        let data = Convert.decodeBase64(input)
        let decrypted = Convert.decryptAesEcb(data, key)
        let res = Convert.decodeUtf8(decrypted)
        let i = res.length - 1
        while(res[i] !== '}' && res[i] !== ']' && i > 0) {
            i--
        }
        return res.substring(0, i + 1)
    }

    /**
     *
     * @param url {string}
     * @returns {Promise<string>}
     */
    async get(url) {
        let time = Math.floor(Date.now() / 1000)
        let kJmSecret = "185Hcomic3PAPP7R"
        let res = await Network.get(url, this.getHeaders(time))
        if(res.status !== 200) {
            if(res.status === 401) {
                let json = JSON.parse(res.body)
                let message = json.errorMsg
                if(message === "請先登入會員" && this.isLogged) {
                    throw 'Login expired'
                }
                throw message ?? 'Invalid Status Code: ' + res.status
            }
            throw 'Invalid Status Code: ' + res.status
        }
        let json = JSON.parse(res.body)
        let data = json.data
        if(typeof data !== 'string') {
            throw 'Invalid Data'
        }
        return this.convertData(data, `${time}${kJmSecret}`)
    }

    async post(url, body) {
        let time = Math.floor(Date.now() / 1000)
        let kJmSecret = "185Hcomic3PAPP7R"
        let res = await Network.post(url, {
            ...this.getHeaders(time),
            "Content-Type": "application/x-www-form-urlencoded"
        }, body)
        if(res.status !== 200) {
            if(res.status === 401) {
                let json = JSON.parse(res.body)
                let message = json.errorMsg
                if(message === "請先登入會員" && this.isLogged) {
                    throw 'Login expired'
                }
                throw message ?? 'Invalid Status Code: ' + res.status
            }
            throw 'Invalid Status Code: ' + res.status
        }
        let json = JSON.parse(res.body)
        let data = json.data
        if(typeof data !== 'string') {
            throw 'Invalid Data'
        }
        return this.convertData(data, `${time}${kJmSecret}`)
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
            let time = Math.floor(Date.now() / 1000)
            await this.post(
                `${this.baseUrl}/login`,
                `username=${encodeURIComponent(account)}&password=${encodeURIComponent(pwd)}`
            )
            return "ok"
        },

        /**
         * logout function, clear account related data
         */
        logout: () => {
            for (let url of JM.apiDomains) {
                Network.deleteCookies(url)
            }
        },

        // {string?} - register url
        registerWebsite: null
    }

    // explore page list
    explore = [
        {
            // title of the page.
            // title is used to identify the page, it should be unique
            title: "禁漫天堂",

            /// multiPartPage or multiPageComicList or mixed
            type: "multiPartPage",

            /**
             * load function
             * @param page {number | null} - page number, null for `singlePageWithMultiPart` type
             * @returns {{}}
             * - for `multiPartPage` type, return [{title: string, comics: Comic[], viewMore: string?}]
             * - for `multiPageComicList` type, for each page(1-based), return {comics: Comic[], maxPage: number}
             * - for `mixed` type, use param `page` as index. for each index(0-based), return {data: [], maxPage: number?}, data is an array contains Comic[] or {title: string, comics: Comic[], viewMore: string?}
             */
            load: async (page) => {
                let res = await this.get(`${this.baseUrl}/promote?$baseData&page=0`)
                let result = []

                for(let e of JSON.parse(res)) {
                    let title = e["title"]
                    let type = e.type
                    let id = e.id.toString()
                    if (type === 'category_id') {
                        id = e.slug
                    }
                    if (type === 'library') {
                        continue
                    }
                    let comics = e.content.map((e) => this.parseComic(e))
                    result.push({
                        title: e.title,
                        comics: comics,
                        viewMore: `category:${title}@${id}`
                    })
                }

                return result
            },
        }
    ]

    // categories
    category = {
        /// title of the category page, used to identify the page, it should be unique
        title: "禁漫天堂",
        parts: [
            {
                name: "成人A漫",
                type: "fixed",
                categories: ["最新A漫", "同人", "單本", "短篇", "其他類", "韓漫", "美漫", "Cosplay", "3D", "禁漫漢化組"],
                itemType: "category",
                categoryParams: [
                    "0",
                    "doujin",
                    "single",
                    "short",
                    "another",
                    "hanman",
                    "meiman",
                    "another_cosplay",
                    "3D",
                    "禁漫漢化組"
                ],
            },
            {
                name: "主題A漫",
                type: "fixed",
                categories: [
                    '無修正',
                    '劇情向',
                    '青年漫',
                    '校服',
                    '純愛',
                    '人妻',
                    '教師',
                    '百合',
                    'Yaoi',
                    '性轉',
                    'NTR',
                    '女裝',
                    '癡女',
                    '全彩',
                    '女性向',
                    '完結',
                    '純愛',
                    '禁漫漢化組'
                ],
                itemType: "search",
            },
            {
                name: "角色扮演",
                type: "fixed",
                categories: [
                    '御姐',
                    '熟女',
                    '巨乳',
                    '貧乳',
                    '女性支配',
                    '教師',
                    '女僕',
                    '護士',
                    '泳裝',
                    '眼鏡',
                    '連褲襪',
                    '其他制服',
                    '兔女郎'
                ],
                itemType: "search",
            },
            {
                name: "特殊PLAY",
                type: "fixed",
                categories: [
                    '群交',
                    '足交',
                    '束縛',
                    '肛交',
                    '阿黑顏',
                    '藥物',
                    '扶他',
                    '調教',
                    '野外露出',
                    '催眠',
                    '自慰',
                    '觸手',
                    '獸交',
                    '亞人',
                    '怪物女孩',
                    '皮物',
                    'ryona',
                    '騎大車'
                ],
                itemType: "search",
            },
            {
                name: "特殊PLAY",
                type: "fixed",
                categories: ['CG', '重口', '獵奇', '非H', '血腥暴力', '站長推薦'],
                itemType: "search",
            },
        ],
        // enable ranking page
        enableRankingPage: true,
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
            param ??= category
            param = encodeURIComponent(param)
            let res = await this.get(`${this.baseUrl}/categories/filter?o=${options[0]}&c=${param}&page=${page}`)
            let data = JSON.parse(res)
            let total = data.total
            let maxPage = Math.ceil(total / 80)
            let comics = data.content.map((e) => this.parseComic(e))
            return {
                comics: comics,
                maxPage: maxPage
            }
        },
        // provide options for category comic loading
        optionList: [
            {
                // For a single option, use `-` to separate the value and text, left for value, right for text
                options: [
                    "mr-最新",
                    "mv-總排行",
                    "mv_m-月排行",
                    "mv_w-周排行",
                    "mv_t-日排行",
                    "mp-最多圖片",
                    "tf-最多喜歡",
                ],
            }
        ],
        ranking: {
            // For a single option, use `-` to separate the value and text, left for value, right for text
            options: [
                "mv-總排行",
                "mv_m-月排行",
                "mv_w-周排行",
                "mv_t-日排行",
            ],
            /**
             * load ranking comics
             * @param option {string} - option from optionList
             * @param page {number} - page number
             * @returns {Promise<{comics: Comic[], maxPage: number}>}
             */
            load: async (option, page) => {
                return this.categoryComics.load("總排行", "0", [option], page)
            }
        }
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
            keyword = keyword.trim()
            keyword = encodeURIComponent(keyword)
            keyword = keyword.replace(/%20/g, '+')
            let url = `${this.baseUrl}/search?search_query=${keyword}&o=${options[0]}`
            if(page > 1) {
                url += `&page=${page}`
            }
            let res = await this.get(url)
            let data = JSON.parse(res)
            let total = data.total
            let maxPage = Math.ceil(total / 80)
            let comics = data.content.map((e) => this.parseComic(e))
            return {
                comics: comics,
                maxPage: maxPage
            }
        },

        // provide options for search
        optionList: [
            {
                type: "select",
                // For a single option, use `-` to separate the value and text, left for value, right for text
                options: [
                    "mr-最新",
                    "mv-總排行",
                    "mv_m-月排行",
                    "mv_w-周排行",
                    "mv_t-日排行",
                    "mp-最多圖片",
                    "tf-最多喜歡",
                ],
                // option label
                label: "排序",
            }
        ],
    }

    // favorite related
    favorites = {
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
            if (isAdding) {
                await this.post(`${this.baseUrl}/favorite`, `aid=${comicId}`)
                await this.post(`${this.baseUrl}/favorite_folder`, `type=move&folder_id=${folderId}&aid=${comicId}`)
            } else {
                await this.post(`${this.baseUrl}/favorite`, `aid=${comicId}`)
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
            let res = await this.get(`${this.baseUrl}/favorite`)
            let folders = {
                "0": this.translate("All")
            }
            let json = JSON.parse(res)
            for (let e of json.folder_list) {
                folders[e.FID.toString()] = e.name
            }
            return {
                folders: folders,
                favorited: []
            }
        },
        /**
         * add a folder
         * @param name {string}
         * @returns {Promise<any>} - return any value to indicate success
         */
        addFolder: async (name) => {
            await this.post(`${this.baseUrl}/favorite_folder`, `type=add&folder_name=${name}`)
        },
        /**
         * delete a folder
         * @param folderId {string}
         * @returns {Promise<void>} - return any value to indicate success
         */
        deleteFolder: async (folderId) => {
            await this.post(`${this.baseUrl}/favorite_folder`, `type=del&folder_id=${folderId}`)
        },
        /**
         * load comics in a folder
         * throw `Login expired` to indicate login expired, App will automatically re-login retry.
         * @param page {number}
         * @param folder {string?} - folder id, null for non-multi-folder
         * @returns {Promise<{comics: Comic[], maxPage: number}>}
         */
        loadComics: async (page, folder) => {
            let order = this.loadSetting('favoriteOrder')
            let res = await this.get(`${this.baseUrl}/favorite?folder_id=${folder}&page=${page}&o=${order}`)
            let json = JSON.parse(res)
            let total = json.total
            let maxPage = Math.ceil(total / 20)
            let comics = json.list.map((e) => this.parseComic(e))
            return {
                comics: comics,
                maxPage: maxPage
            }
        },
        singleFolderForSingleComic: true,
    }

    /// single comic related
    comic = {
        /**
         * load comic info
         * @param id {string}
         * @returns {Promise<ComicDetails>}
         */
        loadInfo: async (id) => {
            if (id.startsWith('jm')) {
                id = id.substring(2)
            }
            let res = await this.get(`${this.baseUrl}/album?comicName=&id=${id}`);
            let data = JSON.parse(res)
            let author = data.author ?? []
            let chapters = new Map()
            let series = (data.series ?? []).sort((a, b) => a.sort - b.sort)
            for(let e of series) {
                let title = e.name ?? ''
                title = title.trim()
                if(title.length === 0) {
                    title = `第${e["sort"]}話`
                }
                let id = e.id.toString()
                chapters.set(id, title)
            }
            if(chapters.size === 0) {
                chapters.set(id, '第1話')
            }
            let tags = data.tags ?? []
            let related = data["related_list"].map((e) => new Comic({
                id: e.id.toString(),
                title: e.name,
                subtitle: e.author ?? "",
                cover: this.getCoverUrl(e.id),
                description: e.description ?? ""
            }))
            let updateTimeStamp = data["addtime"];
            let date = new Date(updateTimeStamp * 1000)
            let updateDate = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;

            return new ComicDetails({
                title: data.name,
                cover: this.getCoverUrl(id),
                description: data.description,
                likesCount: Number(data.likes),
                chapters: chapters,
                tags: {
                    "作者": author,
                    "標籤": tags,
                },
                related: related,
                isFavorite: data.is_favorite ?? false,
                updateTime: updateDate,
            })
        },
        /**
         * load images of a chapter
         * @param comicId {string}
         * @param epId {string?}
         * @returns {Promise<{images: string[]}>}
         */
        loadEp: async (comicId, epId) => {
            let res = await this.get(`${this.baseUrl}/chapter?&id=${epId}`);
            let data = JSON.parse(res)
            let images = data.images.map((e) => this.getImageUrl(epId, e))
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
        onImageLoad: (url, comicId, epId) => {
            const scrambleId = 220980
            let pictureName = "";
            for (let i = url.length - 1; i >= 0; i--) {
                if (url[i] === '/') {
                    pictureName = url.substring(i + 1, url.length - 5);
                    break;
                }
            }
            epId = Number(epId);
            let num = 0
            if(epId < scrambleId) {
                num = 0
            } else if (epId < 268850) {
                num = 10
            } else if (epId > 421926) {
                let str = epId.toString() + pictureName
                let bytes = Convert.encodeUtf8(str)
                let hash = Convert.md5(bytes)
                let hashStr = Convert.hexEncode(hash)
                let charCode = hashStr.charCodeAt(hashStr.length-1)
                let remainder = charCode % 8
                num = remainder * 2 + 2
            } else {
                let str = epId.toString() + pictureName
                let bytes = Convert.encodeUtf8(str)
                let hash = Convert.md5(bytes)
                let hashStr = Convert.hexEncode(hash)
                let charCode = hashStr.charCodeAt(hashStr.length-1)
                let remainder = charCode % 10
                num = remainder * 2 + 2
            }
            if (num <= 1) {
                return {}
            }
            return {
                headers: {
                    "Accept-Encoding": "gzip",
                    "User-Agent": this.imgUa,
                },
                modifyImage: `
                    let modifyImage = (image) => {
                        const num = ${num}
                        let blockSize = Math.floor(image.height / num)
                        let remainder = image.height % num
                        let blocks = []
                        for(let i = 0; i < num; i++) {
                            let start = i * blockSize
                            let end = start + blockSize + (i !== num - 1 ? 0 : remainder)
                            blocks.push({
                                start: start,
                                end: end
                            })
                        }
                        let res = Image.empty(image.width, image.height)
                        let y = 0
                        for(let i = blocks.length - 1; i >= 0; i--) {
                            let block = blocks[i]
                            let currentHeight = block.end - block.start
                            res.fillImageRangeAt(0, y, image, 0, block.start, image.width, currentHeight)
                            y += currentHeight
                        }
                        return res
                    }
                `,
            }
        },
        /**
         * [Optional] provide configs for a thumbnail loading
         * @param url {string}
         * @returns {{}}
         */
        onThumbnailLoad: (url) => {
            return {
                headers: {
                    "Accept-Encoding": "gzip",
                    "User-Agent": this.imgUa,
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
            let res = await this.get(`${this.baseUrl}/forum?mode=manhua&aid=${comicId}&page=${page}`)
            let json = JSON.parse(res)
            return {
                comments: json.list.map((e) => new Comment({
                    avatar: this.getAvatarUrl(e.photo),
                    userName: e.username,
                    time: e.addtime,
                    content: e.content.substring(e.content.indexOf('>') + 1, e.content.lastIndexOf('<')),
                })),
                maxPage: Number(json.total.toString())
            }
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
            let res = await this.post(`${this.baseUrl}/comment`, `aid=${comicId}&comment=${encodeURIComponent(content)}&status=undefined`)
            let json = JSON.parse(res)
            if (json.status === "fail") {
                throw json.msg ?? 'Failed to send comment'
            }
            return "ok"
        },
        // {string?} - regex string, used to identify comic id from user input
        idMatch: "^(\\d+|jm\\d+)$",
        /**
         * [Optional] Handle tag click event
         * @param namespace {string}
         * @param tag {string}
         * @returns {{action: string, keyword: string, param: string?}}
         */
        onClickTag: (namespace, tag) => {
            return {
                action: 'search',
                keyword: tag,
            }
        },
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
        refreshDomains: {
            title: "Refresh Domain List",
            type: "callback",
            buttonText: "Refresh",
            callback: () => this.refreshApiDomains(true)
        },
        refreshDomainsOnStart: {
            title: "Refresh Domain List on Startup",
            type: "switch",
            default: true,
        },
        apiDomain: {
            title: "Api Domain",
            type: "select",
            options: [
                {
                    value: '1',
                },
                {
                    value: '2',
                },
                {
                    value: '3',
                },
                {
                    value: '4',
                },
            ],
            default: "1",
        },
        imageStream: {
            title: "Image Stream",
            type: "select",
            options: [
                {
                    value: '1',
                },
                {
                    value: '2',
                },
                {
                    value: '3',
                },
                {
                    value: '4',
                },
            ],
            default: "1",
        },
        favoriteOrder: {
            title: "Favorite Order",
            type: "select",
            options: [
                {
                    value: 'mr',
                    text: 'Add Time',
                },
                {
                    value: 'mp',
                    text: 'Update Time',
                }
            ],
            default: 'mr'
        }
    }

    // [Optional] translations for the strings in this config
    translation = {
        'zh_CN': {
            'Refresh Domain List': '刷新域名列表',
            'Refresh': '刷新',
            'Refresh Domain List on Startup': '启动时刷新域名列表',
            'Api Domain': 'Api域名',
            'Image Stream': '图片分流',
            'Favorite Order': '收藏夹排序',
            'Add Time': '添加时间',
            'Update Time': '更新时间',
            'All': '全部',
        },
        'zh_TW': {
            'Refresh Domain List': '刷新域名列表',
            'Refresh': '刷新',
            'Refresh Domain List on Startup': '啟動時刷新域名列表',
            'Api Domain': 'Api域名',
            'Image Stream': '圖片分流',
            'Favorite Order': '收藏夾排序',
            'Add Time': '添加時間',
            'Update Time': '更新時間',
            'All': '全部',
        },
    }
}
