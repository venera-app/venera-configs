class JM extends ComicSource {
    // Note: The fields which are marked as [Optional] should be removed if not used

    // name of the source
    name = "禁漫天堂"

    // unique id of the source
    key = "jm"

    version = "1.0.1"

    minAppVersion = "1.0.2"

    // update url
    url = "https://raw.githubusercontent.com/venera-app/venera-configs/refs/heads/main/jm.js"

    static apiDomains = [
        "https://www.jmapiproxyxxx.vip",
        "https://www.cdnblackmyth.club",
        "https://www.cdnmhws.cc",
        "https://www.cdnxxx-proxy.co"
    ];

    static imageUrls = [
        "https://cdn-msp.jmapiproxy3.cc",
        "https://cdn-msp3.jmapiproxy3.cc",
        "https://cdn-msp2.jmapiproxy1.cc",
        "https://cdn-msp3.jmapiproxy3.cc",
    ];

    get baseUrl() {
        let index = parseInt(this.loadSetting('apiDomain')) - 1
        return JM.apiDomains[index]
    }

    isNum(str) {
        return /^\d+$/.test(str)
    }

    get imageUrl() {
        let stream = this.loadSetting('imageStream')
        let index = parseInt(stream) - 1
        return JM.imageUrls[index]
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
        const jmVersion = "1.7.5"
        const jmAuthKey = "18comicAPPContent"
        let token = Convert.md5(Convert.encodeUtf8(`${time}${jmAuthKey}`))

        return {
            "token": Convert.hexEncode(token),
            "tokenparam": `${time},${jmVersion}`,
            "accept-encoding": "gzip",
        }
    }

    /**
     *
     * @param input {string}
     * @param time {number}
     * @returns {string}
     */
    convertData(input, time) {
        let secret = '185Hcomic3PAPP7R'
        let key = Convert.encodeUtf8(Convert.hexEncode(Convert.md5(Convert.encodeUtf8(`${time}${secret}`))))
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
        return this.convertData(data, time)
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
        }
    }

    // [Optional] translations for the strings in this config
    translation = {
        'zh_CN': {
            'Api Domain': 'Api域名',
            'Image Stream': '图片分流',
        },
        'zh_TW': {
            'Api Domain': 'Api域名',
            'Image Stream': '圖片分流',
        },
    }
}
