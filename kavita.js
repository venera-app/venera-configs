/** @type {import('./_venera_.js')} */
class Komga extends ComicSource {
    name = "Kavita"

    key = "kavita"

    version = "1.0.0"

    minAppVersion = "1.4.0"

    url = "https://cdn.jsdelivr.net/gh/venera-app/venera-configs@main/kavita.js"

    settings = {
        base_url: {
            title: "服务器地址",
            type: "input",
            default: "https://demo.kavita.org",
            validator: "^(https?:\\/\\/).+$"
        },
    }

    get baseUrl() {
        let raw = this.loadSetting('base_url')
        if (typeof raw !== 'string' || !raw.trim()) {
            raw = this.settings.base_url.default
        }
        let value = raw.trim()
        if (!/^https?:\/\//i.test(value)) {
            value = `https://${value}`
        }
        return value.replace(/\/$/, '')
    }

    get headers() {
        const headers = { "Accept": "application/json" }
        const token = this.loadData('token')
        if (token) headers["Authorization"] = `Bearer ${token}`
        return headers
    }

    async init() {
        try {
            await this.refreshReferenceData(false)
        } catch (_) {
        }
    }

    FilterComparison = {
        Equals: 0,
        GreaterThan: 1,
        GreaterThanEqual: 2,
        LessThan: 3,
        LessThanEqual: 4,
        Contains: 5,
        MustContains: 6,
        Matches: 7,
        NotContains: 8,
        NotEqual: 9,
        BeginsWith: 10,
        EndsWith: 11,
        IsBefore: 12,
        IsAfter: 13,
        IsInLast: 14,
        IsNotInLast: 15,
        IsEmpty: 16
    }

    FilterField = {
        Summary: 0,
        SeriesName: 1,
        PublicationStatus: 2,
        Languages: 3,
        AgeRating: 4,
        UserRating: 5,
        Tags: 6,
        CollectionTags: 7,
        Translators: 8,
        Publisher: 10,
        Editor: 11,
        CoverArtist: 12,
        Letterer: 13,
        Colorist: 14,
        Inker: 15,
        Penciller: 16,
        Writers: 17,
        Genres: 18,
        Libraries: 19,
        ReadProgress: 20,
        Formats: 21,
        ReleaseYear: 22,
        ReadTime: 23,
        Path: 24,
        FilePath: 25,
        WantToRead: 26,
        ReadingDate: 27,
        AverageRating: 28,
        Imprint: 29,
        Team: 30,
        Location: 31,
        ReadLast: 32,
        FileSize: 33
    };

    // [Optional] account related
    account = {
        /**
         * [Optional] login with account and password, return any value to indicate success
         * @param account {string}
         * @param pwd {string}
         * @returns {Promise<any>}
         */
        login: async (account, pwd) => {
            if (!account || !pwd) {
                throw '账号或密码不能为空'
            }
            const res = await Network.post(
                this.buildUrl('/api/Account/login'),
                this.headers,
                {
                    username: account,
                    password: pwd
                }
            )
            if (res.status === 401) {
                throw '账号或密码错误'
            }
            if (res.status !== 200) {
                throw `登录失败: ${res.status}`
            }
            if (res.status === 200) {
                this.saveData('token', JSON.parse(res.body).token)
                this.saveData('apiKey', JSON.parse(res.body).apiKey)
                await this.refreshReferenceData(true)
                return account
            }
        },

        /**
         * logout function, clear account related data
         */
        logout: () => {
            this.deleteData('token')
            this.deleteData('apiKey')
            this.deleteData('kavita_libraries')
            this.deleteData('kavita_genres')
            this.deleteData('kavita_authors')
            this.deleteData('kavita_meta_ts')
        },

        // {string?} - register url
        registerWebsite: null
    }

    // explore page list
    explore = [
        {
            title: "Kavita",
            type: "singlePageWithMultiPart",
            load: async () => {
                await this.refreshReferenceData(false)
                const feeds = {}
                const data = {
                    id: 0,
                    name: "",
                    statements: [],
                    combination: 0,
                    sortOptions: {
                        sortField: 4,
                        isAscending: false
                    },
                    limitTo: 0
                }
                const latest = await this.fetchSeriesList(`/api/Series/v2`, { PageNumber: 0, PageSize: 12 }, data)
                if (latest.comics.length) feeds["最新上架"] = latest.comics
                return feeds
            },
        }
    ]

    // categories
    category = {
        /// title of the category page, used to identify the page, it should be unique
        title: "Kavita",
        parts: [
            {
                name: "常用",
                type: "dynamic",
                loader: () => (
                    [
                        {
                            label: "all",
                            target: {
                                page: 'category',
                                attributes: {
                                    category: '全部',
                                    param: null,
                                },
                            },
                        }
                    ]
                )
            },
            {
                name: "书库",
                type: "dynamic",
                loader: () => {
                    const libraries = this.loadData('kavita_libraries')
                    if (!Array.isArray(libraries) || !libraries.length) {
                        return []
                    }
                    return libraries.map((library) => ({
                        label: library.name,
                        target: {
                            page: 'category',
                            attributes: {
                                category: library.name,
                                param: `library:${library.id}`,
                            },
                        },
                    }))
                }
            },
            {
                name: "作者",
                type: "dynamic",
                loader: () => {
                    const authors = this.loadData('kavita_authors')
                    if (!Array.isArray(authors) || !authors.length) {
                        return []
                    }
                    return authors.map((author) => ({
                        label: author.name,
                        target: {
                            page: 'category',
                            attributes: {
                                category: author.name,
                                param: `author:${author.id}`,
                            },
                        },
                    }))
                }
            },
            {
                name: "题材",
                type: "dynamic",
                loader: () => {
                    const genres = this.loadData('kavita_genres')
                    if (!Array.isArray(genres) || !genres.length) {
                        return []
                    }
                    return genres.map((genre) => ({
                        label: genre.title,
                        target: {
                            page: 'category',
                            attributes: {
                                category: genre.title,
                                param: `genre:${genre.id}`,
                            },
                        },
                    }))
                }
            },
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
            await this.refreshReferenceData(false)
            const pageSize = 30
            const data = {
                statements: [],
                combination: 0,
                sortOptions: {
                    sortField: 4,
                    isAscending: false
                },
                limitTo: 0
            }

            /*
            * sortField : 排序枚举类型：
            * 1 按系列名称排序,2 创建时间,3 最后修改时间,4 最近添加章节时间,5 阅读时长,6 发布年份,7 阅读进度,8 平均评分,9 随机,10 用户评分
            */

            if (options && options.length) {
                const [sortField, isAscending] = options[0].split(',')
                data.sortOptions.sortField = parseInt(sortField)
                data.sortOptions.isAscending = isAscending === 'true'
            }

            const params = param.split(":")
            if (params[0] === 'library' && params[1]) {
                const libraryId = params[1]
                data.statements.push({
                    comparison: this.FilterComparison.Equals,
                    field: this.FilterField.Libraries,
                    value: libraryId
                })
            }

            if (params[0] === 'genre' && params[1]) {
                const genreId = params[1]
                data.statements.push({
                    comparison: this.FilterComparison.Equals,
                    field: this.FilterField.Genres,
                    value: genreId
                })
            }

            if (params[0] === 'author' && params[1]) {
                const authorId = params[1]
                data.statements.push({
                    comparison: this.FilterComparison.Equals,
                    field: this.FilterField.Writers,
                    value: authorId
                })
            }

            const allowedCategories = ['全部', 'library', 'genre', 'author']
            if (allowedCategories.includes(params[0])) {
                const { comics, totalPages } = await this.fetchSeriesList(`/api/Series/v2`, { PageNumber: page, PageSize: pageSize }, data)
                return {
                    comics: comics,
                    maxPage: totalPages
                }
            }
        },
        optionList: [
            {
                options: [
                    "4,false-最近添加",
                    "1,true-名称[升序]",
                    "1,false-名称[降序]",
                    "2,false-创建时间[降序]",
                    "2,true-创建时间[升序]",
                    "3,false-修改时间[降序]",
                    "3,true-修改时间[升序]",
                ],
                notShowWhen: null,
                showWhen: null
            }
        ],
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
            const pageSize = 30
            const data = {
                statements: [],
                combination: 0,
                sortOptions: {
                    sortField: 4,
                    isAscending: false
                },
                limitTo: 0
            }

            if (options && options.length) {
                const type = options[0]
                if (type === 'FilePath') {
                    data.statements.push({
                        comparison: this.FilterComparison.Matches,
                        field: this.FilterField.FilePath,
                        value: keyword
                    })
                } else if (type === 'SeriesName') {
                    data.statements.push({
                        comparison: this.FilterComparison.Matches,
                        field: this.FilterField.SeriesName,
                        value: keyword
                    })
                } else { // all
                    data.statements.push({
                        comparison: this.FilterComparison.Matches,
                        field: this.FilterField.SeriesName,
                        value: keyword
                    }, {
                        comparison: this.FilterComparison.Matches,
                        field: this.FilterField.Summary,
                        value: keyword
                    }, {
                        comparison: this.FilterComparison.Matches,
                        field: this.FilterField.FilePath,
                        value: keyword
                    })
                }
            }

            const { comics, totalPages } = await this.fetchSeriesList(`/api/Series/v2`, { PageNumber: page, PageSize: pageSize }, data)
            return {
                comics: comics,
                maxPage: totalPages
            }

            /*
            const data = await this.getJson('/api/Search/search', { queryString: keyword, includeChapterAndFiles: false })
            const series = Array.isArray(data?.series) ? data.series : []
            const token = this.loadData('token')
            const comics = series.map((item) => this.parseSeries(item, token)).filter(Boolean)
            return { comics: comics, maxPage: 1 }
            */
        },

        // provide options for search
        optionList: [
            {
                type: 'select',
                options: [
                    'All-全部',
                    'SeriesName-名称',
                    'FilePath-文件名',
                ],
                label: '搜索选项'
            }
        ],

        enableTagsSuggestions: false,
        // [Optional] handle tag suggestion click
        onTagSuggestionSelected: (namespace, tag) => {
            // return the text to insert into search box
            return `${namespace}:${tag}`
        },
    }

    /// single comic related
    comic = {
        /**
         * load comic info
         * @param id {string}
         * @returns {Promise<ComicDetails>}
         */
        loadInfo: async (id) => {
            const data = await this.getJson(`/api/Series/${id}`)
            const metadata = await this.getJson(`/api/Series/metadata`, { seriesId: id })
            const volume = await this.getJson(`/api/Series/volumes`, { seriesId: id })
            const chapters = volume
                .flatMap(item => item.chapters || [])
                .reduce((map, { id, titleName, files }) => {
                    let title = titleName
                    if (!title) {
                        title = files[0].filePath.split('/').pop()
                    }
                    map[id] = title;
                    return map;
                }, {});
            const authors = metadata.writers.map(item => item.name)
            const apiKey = this.loadData('apiKey')
            const tagSections = {}
            const isReadable = this.isReadable(data.format)
            console.log(data)
            if (authors.length) tagSections['作者'] = authors
            if (metadata.genres.length) tagSections['类型'] = metadata.genres.map(item => item.title)
            if (metadata.tags.length) tagSections['标签'] = metadata.tags.map(item => item.title)
            if (!isReadable) tagSections['提示'] = ['该系列包含的项目暂不支持阅读']
            const info = new ComicDetails({
                title: data.name,
                subtitle: authors.join(', '),
                cover: this.buildUrl(`/api/Image/series-cover`, { seriesId: id, apiKey: apiKey }),
                description: metadata.summary || '暂无简介',
                tags: tagSections,
                chapters,
                updateTime: data.lastChapterAdded,
                uploadTime: data.created,
                url: this.buildUrl(`/api/Series/${id}`)
            })
            return info
        },


        /**
         * rate a comic
         * @param id
         * @param rating {number} - [0-10] app use 5 stars, 1 rating = 0.5 stars,
         * @returns {Promise<any>} - return any value to indicate success
         */
        starRating: async (id, rating) => {

        },

        /**
         * load images of a chapter
         * @param comicId {string}
         * @param epId {string?}
         * @returns {Promise<{images: string[]}>}
         */
        loadEp: async (comicId, epId) => {
            const data = await this.getJson(`/api/Series/chapter`, { chapterId: epId })
            const page = data.pages
            const isReadable = this.isReadable(data.format)
            if (!isReadable) {
                throw '该项目暂不支持阅读'
            }
            const apiKey = this.loadData('apiKey')
            const extractPdf = data.format === 4
            return { images: Array.from({ length: page }, (_, i) => this.buildUrl(`/api/Reader/image`, { chapterId: epId, page: i, apiKey: apiKey, extractPdf })) }
        },

        /**
         * [Optional] Handle tag click event
         * @param namespace {string}
         * @param tag {string}
         * @returns {{action: string, keyword: string, param: string?}}
         */
        onClickTag: (namespace, tag) => {
            if (namespace === '类型') {
                const genres = this.loadData('kavita_genres')
                const genreId = genres.find(item => item.title === tag)?.id
                if (genreId) {
                    return {
                        action: 'category',
                        keyword: tag,
                        param: `genre:${genreId}`
                    }
                }
            }
            if (namespace === '作者') {
                const authors = this.loadData('kavita_authors')
                const authorId = authors.find(item => item.name === tag)?.id
                if (authorId) {
                    return {
                        action: 'category',
                        keyword: tag,
                        param: `author:${authorId}`
                    }
                }
            }
            UI.showMessage(`不支持的标签类型: ${namespace}:${tag}`)
        },

        // enable tags translate
        enableTagsTranslate: false,
    }

    async refreshReferenceData(force) {
        const token = this.loadData('token')
        if (!token) {
            this.saveData('kavita_libraries', [])
            this.saveData('kavita_genres', [])
            this.saveData('kavita_authors', [])
            return
        }
        const now = Date.now()
        const last = this.loadData('kavita_meta_ts')
        if (!force && last && now - last < 5 * 60 * 1000) return
        try {
            const [libraries, genres, authors] = await Promise.all([
                this.getJson('/api/Library/libraries'),
                this.getJson('/api/Metadata/genres'),
                this.getJson('/api/metadata/people-by-role?role=3')
            ])
            const libraryList = Array.isArray(libraries) ? libraries.filter((library) => library && library.id) : []
            this.saveData('kavita_libraries', libraryList.map(item => ({ id: item.id, name: item.name })))
            this.saveData('kavita_genres', Array.isArray(genres) ? genres : [])
            this.saveData('kavita_authors', Array.isArray(authors) ? authors.map(item => ({ id: item.id, name: item.name })) : [])
            this.saveData('kavita_meta_ts', now)
        } catch (error) {
            this.saveData('kavita_libraries', [])
            this.saveData('kavita_genres', [])
            this.saveData('kavita_authors', [])
            if (String(error) === 'Login expired') throw error
        }
    }

    async fetchSeriesList(path, query, data) {
        const { content, page } = await this.postJson(path, query, data)
        const series = Array.isArray(content) ? content : []
        const apiKey = this.loadData('apiKey')
        const comics = series.map((item) => this.parseSeries(item, apiKey)).filter(Boolean)
        return {
            comics,
            totalPages: page.totalPages
        }
    }

    parseSeries(series, apiKey) {
        if (!series) return null
        const id = series.id || series.seriesId
        const title = series.name
        return new Comic({
            id: `${id}`,
            title,
            cover: this.buildUrl(`/api/Image/series-cover`, { seriesId: id, apiKey: apiKey }),
        })
    }

    isReadable(format) {
        const readableFormats = [0, 1, 4] // 0 图片, 1 档案, 2 Epub, 4 PDF 
        return readableFormats.includes(format)
    }

    async getJson(path, query) {
        const res = await Network.get(this.buildUrl(path, query), this.headers)
        this.ensureOk(res)
        const text = res.body
        if (!text) return null
        return JSON.parse(text)
    }

    async postJson(path, query, data) {
        const res = await Network.post(this.buildUrl(path, query), this.headers, data)
        this.ensureOk(res)
        const text = res.body
        if (!text) return null
        return {
            content: JSON.parse(text),
            page: JSON.parse(res.headers.pagination)
        }
    }

    ensureOk(res) {
        if (!res) throw '请求失败'
        if (res.status === 401 || res.status === 403) throw 'Login expired'
        if (res.status < 200 || res.status >= 300) throw `请求失败: ${res.status}`
    }

    buildUrl(path, query) {
        let url = path
        if (!/^https?:\/\//i.test(path)) {
            url = `${this.baseUrl}${path.startsWith('/') ? '' : '/'}${path}`
        }
        const qs = this.buildQuery(query)
        return qs ? `${url}?${qs}` : url
    }

    buildQuery(query) {
        if (!query) return ''
        const parts = []
        for (const key of Object.keys(query)) {
            const value = query[key]
            if (value === undefined || value === null) continue
            if (Array.isArray(value)) {
                for (const item of value) {
                    if (item === undefined || item === null) continue
                    parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(item))}`)
                }
            } else {
                parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
            }
        }
        return parts.join('&')
    }

    formatDate(value) {
        if (!value) return null
        try {
            const date = new Date(value)
            if (Number.isNaN(date.getTime())) return null
            return date.toISOString().split('T')[0]
        } catch (_) {
            return null
        }
    }
}
