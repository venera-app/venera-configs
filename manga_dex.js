/** @type {import('./_venera_.js')} */
class MangaDex extends ComicSource {
    // Note: The fields which are marked as [Optional] should be removed if not used

    // name of the source
    name = "MangaDex"

    // unique id of the source
    key = "manga_dex"

    version = "1.0.0"

    minAppVersion = "1.4.0"

    // update url
    url = "https://git.nyne.dev/nyne/venera-configs/raw/branch/main/manga_dex.js"

    comicsPerPage = 20

    api = {
        parseComic: (data) => {
            let id = data['id']
            let titles = {}
            let mainTitles = data['attributes']['title']
            for (let lang of Object.keys(mainTitles)) {
                titles[lang] = mainTitles[lang]
            }
            for (let at of data['attributes']['altTitles']) {
                for (let lang of Object.keys(at)) {
                    if (titles[lang] === undefined) {
                        titles[lang] = at[lang]
                    }
                }
            }
            let locale = APP.locale
            let mainTitle = ''
            let firstTitle = titles[Object.keys(titles)[0]]
            if (locale.startsWith('en')) {
                mainTitle = titles['en'] || titles['ja'] || firstTitle
            } else if (locale.startsWith('zh_CN')) {
                mainTitle = titles['zh'] || titles['zh-hk'] || titles['zh-tw'] || titles['ja'] || firstTitle
            } else if (locale.startsWith('zh_TW')) {
                mainTitle = titles['zh-hk'] || titles['zh-tw'] || titles['zh'] || titles['ja'] || firstTitle
            }
            let tags = []
            for (let tag of data['attributes']['tags']) {
                tags.push(tag['attributes']['name']['en'])
            }
            let cover = data['relationships'].find((e) => e['type'] === 'cover_art')?.['attributes']['fileName']
            if (cover) {
                cover = `https://mangadex.org/covers/${id}/${cover}.256.jpg`
            } else {
                cover = ""
            }
            let description = data['attributes']['description']['en']
            let createTime = data['attributes']['createdAt']
            let updateTime = data['attributes']['updatedAt']
            let status = data['attributes']['status']
            let authors = []
            let artists = []
            for (let rel of data['relationships']) {
                if (rel['type'] === 'author') {
                    let name = rel['attributes']['name'];
                    let id = rel['id']
                    authors.push(name)
                    this.authors[name] = id
                } else if (rel['type'] === 'artist') {
                    let name = rel['attributes']['name'];
                    let id = rel['id']
                    artists.push(name)
                    this.artists[name] = id
                }
            }

            return {
                id: id,
                title: mainTitle,
                subtitle: authors.at(0),
                titles: titles,
                cover: cover,
                tags: tags,
                description: description,
                createTime: createTime,
                updateTime: updateTime,
                status: status,
                authors: authors,
                artists: artists,
            }
        },
        getPopular: async (page) => {
            let time = new Date()
            time = new Date(time.getTime() - 30 * 24 * 60 * 60 * 1000)
            let popularUrl = `https://api.mangadex.org/manga?` +
                `includes[]=cover_art&` +
                `includes[]=artist&` +
                `includes[]=author&` +
                `order[followedCount]=desc&` +
                `hasAvailableChapters=true&` +
                `createdAtSince=${time.toISOString().substring(0, 19)}&` +
                `limit=${this.comicsPerPage}`
            if (page && page > 1) {
                popularUrl += `&offset=${(page - 1) * this.comicsPerPage}`
            }
            let res = await fetch(popularUrl)
            let data = await res.json()
            let total = data['total']
            let maxPage = Math.ceil(total / this.comicsPerPage)
            let comics = []
            for (let comic of data['data']) {
                comics.push(this.api.parseComic(comic))
            }
            return {
                comics: comics,
                maxPage: maxPage
            }
        },
        getRecent: async (page) => {
            let recentUrl = `https://api.mangadex.org/manga?` +
                `includes[]=cover_art&` +
                `includes[]=artist&` +
                `includes[]=author&` +
                `order[createdAt]=desc&` +
                `hasAvailableChapters=true&` +
                `limit=${this.comicsPerPage}`
            if (page && page > 1) {
                recentUrl += `&offset=${(page - 1) * this.comicsPerPage}`
            }
            let res = await fetch(recentUrl)
            let data = await res.json()
            let total = data['total']
            let maxPage = Math.ceil(total / this.comicsPerPage)
            let comics = []
            for (let comic of data['data']) {
                comics.push(this.api.parseComic(comic))
            }
            return {
                comics: comics,
                maxPage: maxPage
            }
        },
        getUpdated: async (page) => {
            let updatedUrl = `https://api.mangadex.org/manga?` +
                `includes[]=cover_art&` +
                `includes[]=artist&` +
                `includes[]=author&` +
                `order[latestUploadedChapter]=desc&` +
                `contentRating[]=safe&` +
                `contentRating[]=suggestive&` +
                `hasAvailableChapters=true&` +
                `limit=${this.comicsPerPage}`
            if (page && page > 1) {
                updatedUrl += `&offset=${(page - 1) * this.comicsPerPage}`
            }
            let res = await fetch(updatedUrl)
            let data = await res.json()
            let total = data['total']
            let maxPage = Math.ceil(total / this.comicsPerPage)
            let comics = []
            for (let comic of data['data']) {
                comics.push(this.api.parseComic(comic))
            }
            return {
                comics: comics,
                maxPage: maxPage
            }
        }
    }

    // Account feature is not implemented yet
    // TODO: implement account feature
    // account = {}

    // explore page list
    explore = [
        {
            // title of the page.
            // title is used to identify the page, it should be unique
            title: "Manga Dex",

            /// multiPartPage or multiPageComicList or mixed
            type: "multiPartPage",

            load: async (page) => {
                let res = await Promise.all([
                    this.api.getPopular(page),
                    this.api.getRecent(page),
                    this.api.getUpdated(page)
                ])
                let titles = ["Popular", "Recent", "Updated"]
                let viewMore = [
                    {
                        page: "search",
                        attributes: {
                            options: ["popular", "any", "any"],
                        },
                    },
                    {
                        page: "search",
                        attributes: {
                            options: ["recent", "any", "any"],
                        },
                    },
                    {
                        page: "search",
                        attributes: {
                            options: ["updated", "any", "any"],
                        },
                    }
                ]
                let parts = []
                for (let i = 0; i < res.length; i++) {
                    let part = res[i]
                    parts.push({
                        title: titles[i],
                        comics: part.comics,
                        viewMore: viewMore[i]
                    })
                }
                return parts
            },
        }
    ]

    // categories
    category = {
        /// title of the category page, used to identify the page, it should be unique
        title: "MangaDex",
        parts: [
            {
                // title of the part
                name: "Tags",

                // fixed or random or dynamic
                // if random, need to provide `randomNumber` field, which indicates the number of comics to display at the same time
                // if dynamic, need to provide `loader` field, which indicates the function to load comics
                type: "dynamic",

                // number of comics to display at the same time
                // randomNumber: 5,

                // load function for dynamic type
                loader: () => {
                    let categories = []
                    for (let tag of Object.keys(this.tags)) {
                        categories.push({
                            label: tag,
                            target: {
                                page: "search",
                                attributes: {
                                    keyword: `tag:${tag}`,
                                },
                            }
                        })
                    }
                    return categories
                }
            }
        ],
        // enable ranking page
        enableRankingPage: false,
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
            let order = ""
            if (options[0] !== "any") {
                order = {
                    "popular": `order[followedCount]=desc&`,
                    "recent": `order[createdAt]=desc&`,
                    "updated": `order[latestUploadedChapter]=desc&`,
                    "rating": `order[rating]=desc&`,
                    "follows": `order[followedCount]=desc&`
                }[options[0]]
            }
            let contentRating = ""
            if (options[1] !== "any") {
                contentRating = `contentRating[]=${options[1]}&`
            }
            let status = ""
            if (options[2] !== "any") {
                status = `status[]=${options[2]}&`
            }
            let url = `https://api.mangadex.org/manga?` +
                `includes[]=cover_art&` +
                `includes[]=artist&` +
                `includes[]=author&` +
                order +
                contentRating +
                status +
                `hasAvailableChapters=true&` +
                `limit=${this.comicsPerPage}`
            if (page && page > 1) {
                url += `&offset=${(page - 1) * this.comicsPerPage}`
            }
            if (keyword) {
                let splits = keyword.split(" ")
                let reformated = []
                for (let s of splits) {
                    if (s === "") {
                        continue
                    }
                    if (s.startsWith('tag:')) {
                        let tag = s.substring(4)
                        tag = tag.replaceAll('_', ' ')
                        let id = this.tags[tag]
                        if (id !== undefined) {
                            url += `&includedTags[]=${id}`
                        } else {
                            reformated.push(s)
                        }
                    } else if (s.startsWith('author:')) {
                        let author = s.substring(7)
                        author = author.replaceAll('_', ' ')
                        let id = this.authors[author]
                        if (id !== undefined) {
                            url += `&authorOrArtist=${id}`
                        } else {
                            reformated.push(s)
                        }
                    } else if (s.startsWith('artist:')) {
                        let artist = s.substring(7)
                        artist = artist.replaceAll('_', ' ')
                        let id = this.artists[artist]
                        if (id !== undefined) {
                            url += `&authorOrArtist=${id}`
                        } else {
                            reformated.push(s)
                        }
                    } else {
                        reformated.push(s)
                    }
                }
                keyword = reformated.join(" ")
                if (keyword !== "")
                    url += `&title=${keyword}`
            }
            let res = await fetch(url)
            if (!res.ok) {
                throw new Error("Network response was not ok")
            }
            let data = await res.json()
            let total = data['total']
            let maxPage = Math.ceil(total / this.comicsPerPage)
            let comics = []
            for (let comic of data['data']) {
                comics.push(this.api.parseComic(comic))
            }
            return {
                comics: comics,
                maxPage: maxPage
            }
        },

        // provide options for search
        optionList: [
            {
                label: "Sort By",
                type: "select",
                options: [
                    "any-Any",
                    "popular-Popular",
                    "recent-Recent",
                    "updated-Updated",
                    "rating-Rating",
                    "follows-Follows",
                ],
            },
            {
                label: "Content Rating",
                type: "select",
                options: [
                    "any-Any",
                    "safe-Safe",
                    "suggestive-Suggestive",
                    "erotica-Erotica",
                ]
            },
            {
                label: "Status",
                type: "select",
                options: [
                    "any-Any",
                    "ongoing-Ongoing",
                    "completed-Completed",
                    "hiatus-Hiatus",
                    "cancelled-Cancelled",
                ]
            },
        ],

        // enable tags suggestions
        enableTagsSuggestions: false,
    }

    /// single comic related
    comic = {
        getComic: async (id) => {
            let res = await fetch(`https://api.mangadex.org/manga/${id}?includes[]=cover_art&includes[]=artist&includes[]=author`)
            if (!res.ok) {
                throw new Error("Network response was not ok")
            }
            let data = await res.json()
            return this.api.parseComic(data['data'])

        },
        getChapters: async (id) => {
            let res = await fetch(`https://api.mangadex.org/manga/${id}/feed?limit=500&translatedLanguage[]=en&order[chapter]=asc`)
            if (!res.ok) {
                throw new Error("Network response was not ok")
            }
            let data = await res.json()
            let chapters = new Map()
            for (let chapter of data['data']) {
                let id = chapter['id']
                let chapterId = chapter['attributes']['chapter']
                let title = chapter['attributes']['title']
                if (title) {
                    title = `${chapterId}: ${title}`
                } else {
                    title = chapterId
                }
                let volume = chapter['attributes']['volume']
                if (volume) {
                    volume = `Volume ${volume}`
                } else {
                    volume = "No Volume"
                }
                if (chapters.get(volume) === undefined) {
                    chapters.set(volume, new Map())
                }
                chapters.get(volume).set(id, title)
            }
            return chapters
        },
        getStats: async (id) => {
            let res = await fetch(`https://api.mangadex.org/statistics/manga/${id}`)
            if (!res.ok) {
                throw new Error("Network response was not ok")
            }
            let data = await res.json()
            return {
                comments: data['statistics'][id]['comments']?.['repliesCount'] || 0,
                follows: data['statistics'][id]['follows'] || 0,
                rating: data['statistics'][id]['rating']['average'] || 0,
            }
        },
        /**
         * load comic info
         * @param id {string}
         * @returns {Promise<ComicDetails>}
         */
        loadInfo: async (id) => {
            let res = await Promise.all([
                this.comic.getComic(id),
                this.comic.getChapters(id),
                this.comic.getStats(id)
            ])
            let comic = res[0]
            let chapters = res[1]
            let stats = res[2]

            return new ComicDetails({
                id: comic.id,
                title: comic.title,
                subtitle: comic.subtitle,
                cover: comic.cover,
                tags: {
                    "Tags": comic.tags,
                    "Status": comic.status,
                    "Authors": comic.authors,
                    "Artists": comic.artists,
                },
                description: comic.description,
                updateTime: comic.updateTime,
                uploadTime: comic.createTime,
                status: comic.status,
                chapters: chapters,
                stars: (stats.rating || 0) / 2,
                url: `https://mangadex.org/title/${comic.id}`,
            })
        },

        /**
         * rate a comic
         * @param id
         * @param rating {number} - [0-10] app use 5 stars, 1 rating = 0.5 stars,
         * @returns {Promise<any>} - return any value to indicate success
         */
        starRating: async (id, rating) => {
            // TODO: implement star rating
        },

        /**
         * load images of a chapter
         * @param comicId {string}
         * @param epId {string?}
         * @returns {Promise<{images: string[]}>}
         */
        loadEp: async (comicId, epId) => {
            if (!epId) {
                throw new Error("No chapter id provided")
            }
            let res = await fetch(`https://api.mangadex.org/at-home/server/${epId}`)
            if (!res.ok) {
                throw new Error("Network response was not ok")
            }
            let data = await res.json()
            let baseUrl = data['baseUrl']
            let images = []
            for (let image of data['chapter']['data']) {
                images.push(`${baseUrl}/data/${data['chapter']['hash']}/${image}`)
            }
            return {
                images: images
            }
        },
        /**
         * [Optional] load comments
         *
         * Since app version 1.0.6, rich text is supported in comments.
         * Following html tags are supported: ['a', 'b', 'i', 'u', 's', 'br', 'span', 'img'].
         * span tag supports style attribute, but only support font-weight, font-style, text-decoration.
         * All images will be placed at the end of the comment.
         * Auto link detection is enabled, but only http/https links are supported.
         * @param comicId {string}
         * @param subId {string?} - ComicDetails.subId
         * @param page {number}
         * @param replyTo {string?} - commentId to reply, not null when reply to a comment
         * @returns {Promise<{comments: Comment[], maxPage: number?}>}
         */
        loadComments: async (comicId, subId, page, replyTo) => {
            throw new Error("Not implemented")
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
            throw new Error("Not implemented")
        },
        /**
         * [Optional] Handle tag click event
         * @param namespace {string}
         * @param tag {string}
         * @returns {PageJumpTarget}
         */
        onClickTag: (namespace, tag) => {
            tag = tag.replaceAll(' ', '_')
            let keyword = tag
            if (namespace === "Tags") {
                keyword = `tag:${tag}`
            } else if (namespace === "Authors") {
                keyword = `author:${tag}`
            } else if (namespace === "Artists") {
                keyword = `artist:${tag}`
            }
            return {
                page: "search",
                attributes: {
                    'keyword': keyword,
                },
            }
        },
    }

    settings = {}

    // [Optional] translations for the strings in this config
    translation = {
        'zh_CN': {},
        'zh_TW': {},
        'en': {}
    }

    tags = {"Oneshot":"0234a31e-a729-4e28-9d6a-3f87c4966b9e","Thriller":"07251805-a27e-4d59-b488-f0bfbec15168","Award Winning":"0a39b5a1-b235-4886-a747-1d05d216532d","Reincarnation":"0bc90acb-ccc1-44ca-a34a-b9f3a73259d0","Sci-Fi":"256c8bd9-4904-4360-bf4f-508a76d67183","Time Travel":"292e862b-2d17-4062-90a2-0356caa4ae27","Genderswap":"2bd2e8d0-f146-434a-9b51-fc9ff2c5fe6a","Loli":"2d1f5d56-a1e5-4d0d-a961-2193588b08ec","Traditional Games":"31932a7e-5b8e-49a6-9f12-2afa39dc544c","Official Colored":"320831a8-4026-470b-94f6-8353740e6f04","Historical":"33771934-028e-4cb3-8744-691e866a923e","Monsters":"36fd93ea-e8b8-445e-b836-358f02b3d33d","Action":"391b0423-d847-456f-aff0-8b0cfc03066b","Demons":"39730448-9a5f-48a2-85b0-a70db87b1233","Psychological":"3b60b75c-a2d7-4860-ab56-05f391bb889c","Ghosts":"3bb26d85-09d5-4d2e-880c-c34b974339e9","Animals":"3de8c75d-8ee3-48ff-98ee-e20a65c86451","Long Strip":"3e2b8dae-350e-4ab8-a8ce-016e844b9f0d","Romance":"423e2eae-a7a2-4a8b-ac03-a8351462d71d","Ninja":"489dd859-9b61-4c37-af75-5b18e88daafc","Comedy":"4d32cc48-9f00-4cca-9b5a-a839f0764984","Mecha":"50880a9d-5440-4732-9afb-8f457127e836","Anthology":"51d83883-4103-437c-b4b1-731cb73d786c","Boys' Love":"5920b825-4181-4a17-beeb-9918b0ff7a30","Incest":"5bd0e105-4481-44ca-b6e7-7544da56b1a3","Crime":"5ca48985-9a9d-4bd8-be29-80dc0303db72","Survival":"5fff9cde-849c-4d78-aab0-0d52b2ee1d25","Zombies":"631ef465-9aba-4afb-b0fc-ea10efe274a8","Reverse Harem":"65761a2a-415e-47f3-bef2-a9dababba7a6","Sports":"69964a64-2f90-4d33-beeb-f3ed2875eb4c","Superhero":"7064a261-a137-4d3a-8848-2d385de3a99c","Martial Arts":"799c202e-7daa-44eb-9cf7-8a3c0441531e","Fan Colored":"7b2ce280-79ef-4c09-9b58-12b7c23a9b78","Samurai":"81183756-1453-4c81-aa9e-f6e1b63be016","Magical Girls":"81c836c9-914a-4eca-981a-560dad663e73","Mafia":"85daba54-a71c-4554-8a28-9901a8b0afad","Adventure":"87cc87cd-a395-47af-b27a-93258283bbc6","Self-Published":"891cf039-b895-47f0-9229-bef4c96eccd4","Virtual Reality":"8c86611e-fab7-4986-9dec-d1a2f44acdd5","Office Workers":"92d6d951-ca5e-429c-ac78-451071cbf064","Video Games":"9438db5a-7e2a-4ac0-b39e-e0d95a34b8a8","Post-Apocalyptic":"9467335a-1b83-4497-9231-765337a00b96","Sexual Violence":"97893a4c-12af-4dac-b6be-0dffb353568e","Crossdressing":"9ab53f92-3eed-4e9b-903a-917c86035ee3","Magic":"a1f53773-c69a-4ce5-8cab-fffcd90b1565","Girls' Love":"a3c67850-4684-404e-9b7f-c69850ee5da6","Harem":"aafb99c1-7f60-43fa-b75f-fc9502ce29c7","Military":"ac72833b-c4e9-4878-b9db-6c8a4a99444a","Wuxia":"acc803a4-c95a-4c22-86fc-eb6b582d82a2","Isekai":"ace04997-f6bd-436e-b261-779182193d3d","4-Koma":"b11fda93-8f1d-4bef-b2ed-8803d3733170","Doujinshi":"b13b2a48-c720-44a9-9c77-39c9979373fb","Philosophical":"b1e97889-25b4-4258-b28b-cd7f4d28ea9b","Gore":"b29d6a3d-1569-4e7a-8caf-7557bc92cd5d","Drama":"b9af3a63-f058-46de-a9a0-e0c13906197a","Medical":"c8cbe35b-1b2b-4a3f-9c37-db84c4514856","School Life":"caaa44eb-cd40-4177-b930-79d3ef2afe87","Horror":"cdad7e68-1419-41dd-bdce-27753074a640","Fantasy":"cdc58593-87dd-415e-bbc0-2ec27bf404cc","Villainess":"d14322ac-4d6f-4e9b-afd9-629d5f4d8a41","Vampires":"d7d1730f-6eb0-4ba6-9437-602cac38664c","Delinquents":"da2d50ca-3018-4cc0-ac7a-6b7d472a29ea","Monster Girls":"dd1f77c5-dea9-4e2b-97ae-224af09caf99","Shota":"ddefd648-5140-4e5f-ba18-4eca4071d19b","Police":"df33b754-73a3-4c54-80e6-1a74a8058539","Web Comic":"e197df38-d0e7-43b5-9b09-2842d0c326dd","Slice of Life":"e5301a23-ebd9-49dd-a0cb-2add944c7fe9","Aliens":"e64f6742-c834-471d-8d72-dd51fc02b835","Cooking":"ea2bc92d-1c26-4930-9b7c-d5c0dc1b6869","Supernatural":"eabc5b4c-6aff-42f3-b657-3e90cbd00b75","Mystery":"ee968100-4191-4968-93d3-f82d72be7e46","Adaptation":"f4122d1c-3b44-44d0-9936-ff7502c39ad3","Music":"f42fbf9e-188a-447b-9fdc-f19dc1e4d685","Full Color":"f5ba408b-0e7a-484d-8d49-4e9125ac96de","Tragedy":"f8f62932-27da-4fe4-8ee1-6779a8c5edba","Gyaru":"fad12b5e-68ba-460e-b933-9ae8318f5b65"}

    // [authors] and [artists] are dynamic map
    authors = {}
    artists = {}
}