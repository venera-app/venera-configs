class Picacg extends ComicSource {
    name = "Picacg"

    key = "picacg"

    version = "1.0.2"

    minAppVersion = "1.0.0"

    url = "https://cdn.jsdelivr.net/gh/venera-app/venera-configs@main/picacg.js"

    api = "https://picaapi.picacomic.com"

    apiKey = "C69BAF41DA5ABD1FFEDC6D2FEA56B";

    createSignature(path, nonce, time, method) {
        let data = path + time + nonce + method + this.apiKey
        let key = '~d}$Q7$eIni=V)9\\RK/P.RM4;9[7|@/CA}b~OW!3?EV`:<>M7pddUBL5n|0/*Cn'
        let s = Convert.encodeUtf8(key)
        let h = Convert.encodeUtf8(data.toLowerCase())
        return Convert.hmacString(s, h, 'sha256')
    }

    buildHeaders(method, path, token) {
        let uuid = createUuid()
        let nonce = uuid.replace(/-/g, '')
        let time = (new Date().getTime() / 1000).toFixed(0)
        let signature = this.createSignature(path, nonce, time, method.toUpperCase())
        return {
            "api-key": "C69BAF41DA5ABD1FFEDC6D2FEA56B",
            "accept": "application/vnd.picacomic.com.v1+json",
            "app-channel": this.loadSetting('appChannel'),
            "authorization": token ?? "",
            "time": time,
            "nonce": nonce,
            "app-version": "2.2.1.3.3.4",
            "app-uuid": "defaultUuid",
            "image-quality": this.loadSetting('imageQuality'),
            "app-platform": "android",
            "app-build-version": "45",
            "Content-Type": "application/json; charset=UTF-8",
            "user-agent": "okhttp/3.8.1",
            "version": "v1.4.1",
            "Host": "picaapi.picacomic.com",
            "signature": signature,
        }
    }

    account = {
        reLogin: async () => {
            if(!this.isLogged) {
                throw new Error('Not logged in');
            }
            let account = this.loadData('account')
            if(!Array.isArray(account)) {
                throw new Error('Failed to reLogin: Invalid account data');
            }
            let username = account[0]
            let password = account[1]
            return await this.account.login(username, password)
        },
        login: async (account, pwd) => {
            let res = await Network.post(
                `${this.api}/auth/sign-in`,
                this.buildHeaders('POST', 'auth/sign-in'),
                {
                    email: account,
                    password: pwd
                })

            if (res.status === 200) {
                let json = JSON.parse(res.body)
                if (!json.data?.token) {
                    throw 'Failed to get token\nResponse: ' + res.body
                }
                this.saveData('token', json.data.token)
                return 'ok'
            }

            throw 'Failed to login'
        },

        logout: () => {
            this.deleteData('token')
        },

        registerWebsite: "https://manhuabika.com/pregister/?"
    }

    parseComic(comic) {
        let tags = []
        tags.push(...(comic.tags ?? []))
        tags.push(...(comic.categories ?? []))
        return new Comic({
            id: comic._id,
            title: comic.title,
            subTitle: comic.author,
            cover: comic.thumb.fileServer + '/static/' + comic.thumb.path,
            tags: tags,
            description: `${comic.totalLikes ?? comic.likesCount} likes`,
            maxPage: comic.pagesCount,
        })
    }

    explore = [
        {
            title: "Picacg Random",
            type: "multiPageComicList",
            load: async (page) => {
                if (!this.isLogged) {
                    throw 'Not logged in'
                }
                let res = await Network.get(
                    `${this.api}/comics/random`,
                    this.buildHeaders('GET', 'comics/random', this.loadData('token'))
                )
                if(res.status === 401) {
                    await this.account.reLogin()
                    res = await Network.get(
                        `${this.api}/comics/random`,
                        this.buildHeaders('GET', 'comics/random', this.loadData('token'))
                    )
                }
                if (res.status !== 200) {
                    throw 'Invalid status code: ' + res.status
                }
                let data = JSON.parse(res.body)
                let comics = []
                data.data.comics.forEach(c => {
                    comics.push(this.parseComic(c))
                })
                return {
                    comics: comics
                }
            }
        },
        {
            title: "Picacg Latest",
            type: "multiPageComicList",
            load: async (page) => {
                if (!this.isLogged) {
                    throw 'Not logged in'
                }
                let res = await Network.get(
                    `${this.api}/comics?page=${page}&s=dd`,
                    this.buildHeaders('GET', `comics?page=${page}&s=dd`, this.loadData('token'))
                )
                if(res.status === 401) {
                    await this.account.reLogin()
                    res = await Network.get(
                        `${this.api}/comics?page=${page}&s=dd`,
                        this.buildHeaders('GET', `comics?page=${page}&s=dd`, this.loadData('token'))
                    )
                }
                if (res.status !== 200) {
                    throw 'Invalid status code: ' + res.status
                }
                let data = JSON.parse(res.body)
                let comics = []
                data.data.comics.docs.forEach(c => {
                    comics.push(this.parseComic(c))
                })
                return {
                    comics: comics
                }
            }
        }
    ]

    /// 分类页面
    /// 一个漫画源只能有一个分类页面, 也可以没有, 设置为null禁用分类页面
    category = {
        /// 标题, 同时为标识符, 不能与其他漫画源的分类页面重复
        title: "Picacg",
        parts: [
            {
                name: "主题",
                type: "fixed",
                categories: [
                    "大家都在看",
                    "大濕推薦",
                    "那年今天",
                    "官方都在看",
                    "嗶咔漢化",
                    "全彩",
                    "長篇",
                    "同人",
                    "短篇",
                    "圓神領域",
                    "碧藍幻想",
                    "CG雜圖",
                    "英語 ENG",
                    "生肉",
                    "純愛",
                    "百合花園",
                    "耽美花園",
                    "偽娘哲學",
                    "後宮閃光",
                    "扶他樂園",
                    "單行本",
                    "姐姐系",
                    "妹妹系",
                    "SM",
                    "性轉換",
                    "足の恋",
                    "人妻",
                    "NTR",
                    "強暴",
                    "非人類",
                    "艦隊收藏",
                    "Love Live",
                    "SAO 刀劍神域",
                    "Fate",
                    "東方",
                    "WEBTOON",
                    "禁書目錄",
                    "歐美",
                    "Cosplay",
                    "重口地帶"
                ],
                itemType: "category",
            }
        ],
        enableRankingPage: true,
    }

    /// 分类漫画页面, 即点击分类标签后进入的页面
    categoryComics = {
        load: async (category, param, options, page) => {
            let type = param ?? 'c'
            let res = await Network.get(
                `${this.api}/comics?page=${page}&${type}=${encodeURIComponent(category)}&s=${options[0]}`,
                this.buildHeaders('GET', `comics?page=${page}&${type}=${encodeURIComponent(category)}&s=${options[0]}`, this.loadData('token'))
            )
            if(res.status === 401) {
                await this.account.reLogin()
                res = await Network.get(
                    `${this.api}/comics?page=${page}&${type}=${encodeURIComponent(category)}&s=${options[0]}`,
                    this.buildHeaders('GET', `comics?page=${page}&${type}=${encodeURIComponent(category)}&s=${options[0]}`, this.loadData('token'))
                )
            }
            if (res.status !== 200) {
                throw 'Invalid status code: ' + res.status
            }
            let data = JSON.parse(res.body)
            let comics = []
            data.data.comics.docs.forEach(c => {
                comics.push(this.parseComic(c))
            })
            return {
                comics: comics,
                maxPage: data.data.comics.pages
            }
        },
        // 提供选项
        optionList: [
            {
                options: [
                    "dd-New to old",
                    "da-Old to new",
                    "ld-Most likes",
                    "vd-Most nominated",
                ],
            }
        ],
        ranking: {
            options: [
                "H24-Day",
                "D7-Week",
                "D30-Month",
            ],
            load: async (option, page) => {
                let res = await Network.get(
                    `${this.api}/comics/leaderboard?tt=${option}&ct=VC`,
                    this.buildHeaders('GET', `comics/leaderboard?tt=${option}&ct=VC`, this.loadData('token'))
                )
                if(res.status === 401) {
                    await this.account.reLogin()
                    res = await Network.get(
                        `${this.api}/comics/leaderboard?tt=${option}&ct=VC`,
                        this.buildHeaders('GET', `comics/leaderboard?tt=${option}&ct=VC`, this.loadData('token'))
                    )
                }
                if (res.status !== 200) {
                    throw 'Invalid status code: ' + res.status
                }
                let data = JSON.parse(res.body)
                let comics = []
                data.data.comics.forEach(c => {
                    comics.push(this.parseComic(c))
                })
                return {
                    comics: comics,
                    maxPage: 1
                }
            }
        }
    }

    /// 搜索
    search = {
        load: async (keyword, options, page) => {
            let res = await Network.post(
                `${this.api}/comics/advanced-search?page=${page}`,
                this.buildHeaders('POST', `comics/advanced-search?page=${page}`, this.loadData('token')),
                JSON.stringify({
                    keyword: keyword,
                    sort: options[0],
                })
            )
            if(res.status === 401) {
                await this.account.reLogin()
                res = await Network.post(
                    `${this.api}/comics/advanced-search?page=${page}`,
                    this.buildHeaders('POST', `comics/advanced-search?page=${page}`, this.loadData('token')),
                    JSON.stringify({
                        keyword: keyword,
                        sort: options[0],
                    })
                )
            }
            if (res.status !== 200) {
                throw 'Invalid status code: ' + res.status
            }
            let data = JSON.parse(res.body)
            let comics = []
            data.data.comics.docs.forEach(c => {
                comics.push(this.parseComic(c))
            })
            return {
                comics: comics,
                maxPage: data.data.comics.pages
            }
        },
        optionList: [
            {
                options: [
                    "dd-New to old",
                    "da-Old to new",
                    "ld-Most likes",
                    "vd-Most nominated",
                ],
                label: "Sort"
            }
        ]
    }

    /// 收藏
    favorites = {
        multiFolder: false,
        /// 添加或者删除收藏
        addOrDelFavorite: async (comicId, folderId, isAdding) => {
            let res = await Network.post(
                `${this.api}/comics/${comicId}/favourite`,
                this.buildHeaders('POST', `comics/${comicId}/favourite`, this.loadData('token')),
                '{}'
            )
            if(res.status === 401) {
                throw `Login expired`
            }
            if(res.status !== 200) {
                throw 'Invalid status code: ' + res.status
            }
            return 'ok'
        },
        /// 加载漫画
        loadComics: async (page, folder) => {
            let sort = this.loadSetting('favoriteSort')
            let res = await Network.get(
                `${this.api}/users/favourite?page=${page}&s=${sort}`,
                this.buildHeaders('GET', `users/favourite?page=${page}&s=${sort}`, this.loadData('token'))
            )
            if(res.status === 401) {
                throw `Login expired`
            }
            if (res.status !== 200) {
                throw 'Invalid status code: ' + res.status
            }
            let data = JSON.parse(res.body)
            let comics = []
            data.data.comics.docs.forEach(c => {
                comics.push(this.parseComic(c))
            })
            return {
                comics: comics,
                maxPage: data.data.comics.pages
            }
        }
    }

    /// 单个漫画相关
    comic = {
        // 加载漫画信息
        loadInfo: async (id) => {
            let infoLoader = async () => {
                let res = await Network.get(
                    `${this.api}/comics/${id}`,
                    this.buildHeaders('GET', `comics/${id}`, this.loadData('token'))
                )
                if (res.status !== 200) {
                    throw 'Invalid status code: ' + res.status
                }
                let data = JSON.parse(res.body)
                return data.data.comic
            }
            let epsLoader = async () => {
                let eps = new Map();
                let i = 1;
                let j = 1;
                let allEps = [];
                while (true) {
                    let res = await Network.get(
                        `${this.api}/comics/${id}/eps?page=${i}`,
                        this.buildHeaders('GET', `comics/${id}/eps?page=${i}`, this.loadData('token'))
                    );
                    if (res.status !== 200) {
                        throw 'Invalid status code: ' + res.status;
                    }
                    let data = JSON.parse(res.body);
                    allEps.push(...data.data.eps.docs);
                    if (data.data.eps.pages === i) {
                        break;
                    }
                    i++;
                }
                allEps.sort((a, b) => a.order - b.order);
                allEps.forEach(e => {
                    eps.set(j.toString(), e.title);
                    j++;
                });
                return eps;
            }
            let relatedLoader = async () => {
                let res = await Network.get(
                    `${this.api}/comics/${id}/recommendation`,
                    this.buildHeaders('GET', `comics/${id}/recommendation`, this.loadData('token'))
                )
                if (res.status !== 200) {
                    throw 'Invalid status code: ' + res.status
                }
                let data = JSON.parse(res.body)
                let comics = []
                data.data.comics.forEach(c => {
                    comics.push(this.parseComic(c))
                })
                return comics
            }
            let info, eps, related
            try {
                [info, eps, related] = await Promise.all([infoLoader(), epsLoader(), relatedLoader()])
            }
            catch (e) {
                if (e === 'Invalid status code: 401') {
                    await this.account.reLogin();
                    [info, eps, related] = await Promise.all([infoLoader(), epsLoader(), relatedLoader()]);
                }
                throw e
            }
            let tags = {}
            if(info.author) {
                tags['Author'] = [info.author];
            }
            if(info.chineseTeam) {
                tags['Chinese Team'] = [info.chineseTeam];
            }
            let updateTime = new Date(info.updated_at)
            let formattedDate = updateTime.getFullYear() + '-' + (updateTime.getMonth() + 1) + '-' + updateTime.getDate()
            return new ComicDetails({
                title: info.title,
                cover: info.thumb.fileServer + '/static/' + info.thumb.path,
                description: info.description,
                tags: {
                    ...tags,
                    'Categories': info.categories,
                    'Tags': info.tags,
                },
                chapters: eps,
                isFavorite: info.isFavourite ?? false,
                isLiked: info.isLiked ?? false,
                recommend: related,
                commentCount: info.commentsCount,
                likesCount: info.likesCount,
                uploader: info._creator.name,
                updateTime: formattedDate,
            })
        },
        // 获取章节图片
        loadEp: async (comicId, epId) => {
            let images = []
            let i = 1
            while(true) {
                let res = await Network.get(
                    `${this.api}/comics/${comicId}/order/${epId}/pages?page=${i}`,
                    this.buildHeaders('GET', `comics/${comicId}/order/${epId}/pages?page=${i}`, this.loadData('token'))
                )
                if (res.status !== 200) {
                    throw 'Invalid status code: ' + res.status
                }
                let data = JSON.parse(res.body)
                data.data.pages.docs.forEach(p => {
                    images.push(p.media.fileServer + '/static/' + p.media.path)
                })
                if(data.data.pages.pages === i) {
                    break
                }
                i++
            }
            return {
                images: images
            }
        },
        likeComic: async (id, isLike) =>  {
            var res = await Network.post(
                `${this.api}/comics/${id}/like`,
                this.buildHeaders('POST', `comics/${id}/like`, this.loadData('token')),
                {}
            );
            if (res.status !== 200) {
                throw 'Invalid status code: ' + res.status
            }
            return 'ok'
        },
        // 加载评论
        loadComments: async (comicId, subId, page, replyTo) => {
            function parseComment(c) {
                return new Comment({
                    userName: c._user.name,
                    avatar: c._user.avatar ? c._user.avatar.fileServer + '/static/' + c._user.avatar.path : undefined,
                    id: c._id,
                    content: c.content,
                    isLiked: c.isLiked,
                    score: c.likesCount ?? 0,
                    replyCount: c.commentsCount,
                    time: c.created_at,
                })
            }
            let comments = []

            let maxPage = 1

            if(replyTo) {
                let res = await Network.get(
                    `${this.api}/comments/${replyTo}/childrens?page=${page}`,
                    this.buildHeaders('GET', `comments/${replyTo}/childrens?page=${page}`, this.loadData('token'))
                )
                if (res.status !== 200) {
                    throw 'Invalid status code: ' + res.status
                }
                let data = JSON.parse(res.body)
                data.data.comments.docs.forEach(c => {
                    comments.push(parseComment(c))
                })
                maxPage = data.data.comments.pages
            } else {
                let res = await Network.get(
                    `${this.api}/comics/${comicId}/comments?page=${page}`,
                    this.buildHeaders('GET', `comics/${comicId}/comments?page=${page}`, this.loadData('token'))
                )
                if (res.status !== 200) {
                    throw 'Invalid status code: ' + res.status
                }
                let data = JSON.parse(res.body)
                data.data.comments.docs.forEach(c => {
                    comments.push(parseComment(c))
                })
                maxPage = data.data.comments.pages
            }
            return {
                comments: comments,
                maxPage: maxPage
            }
        },
        // 发送评论, 返回任意值表示成功
        sendComment: async (comicId, subId, content, replyTo) => {
            if(replyTo) {
                let res = await Network.post(
                    `${this.api}/comments/${replyTo}`,
                    this.buildHeaders('POST', `/comments/${replyTo}`, this.loadData('token')),
                    JSON.stringify({
                        content: content
                    })
                )
                if (res.status !== 200) {
                    throw 'Invalid status code: ' + res.status
                }
            } else {
                let res = await Network.post(
                    `${this.api}/comics/${comicId}/comments`,
                    this.buildHeaders('POST', `/comics/${comicId}/comments`, this.loadData('token')),
                    JSON.stringify({
                        content: content
                    })
                )
                if (res.status !== 200) {
                    throw 'Invalid status code: ' + res.status
                }
            }
            return 'ok'
        },
        likeComment: async (comicId, subId, commentId, isLike) => {
            let res = await Network.post(
                `${this.api}/comments/${commentId}/like`,
                this.buildHeaders('POST', `/comments/${commentId}/like`, this.loadData('token')),
                '{}'
            )
            if (res.status !== 200) {
                throw 'Invalid status code: ' + res.status
            }
            return 'ok'
        },
        onClickTag: (namespace, tag) => {
            if(namespace === 'Author') {
                return {
                    action: 'category',
                    keyword: tag,
                    param: 'a',
                }
            } else if (namespace === 'Categories') {
                return {
                    action: 'category',
                    keyword: tag,
                    param: 'c',
                }
            } else {
                return {
                    action: 'search',
                    keyword: tag,
                }
            }
        }
    }

    settings = {
        'imageQuality': {
            type: 'select',
            title: 'Image quality',
            options: [
                {
                    value: 'original',
                },
                {
                    value: 'medium'
                },
                {
                    value: 'low'
                }
            ],
            default: 'original',
        },
        'appChannel': {
            type: 'select',
            title: 'App channel',
            options: [
                {
                    value: '1',
                },
                {
                    value: '2'
                },
                {
                    value: '3'
                }
            ],
            default: '3',
        },
        'favoriteSort': {
            type: 'select',
            title: 'Favorite sort',
            options: [
                {
                    value: 'dd',
                    text: 'New to old'
                },
                {
                    value: 'da',
                    text: 'Old to new'
                },
            ],
            default: 'dd',
        }
    }

    translation = {
        'zh_CN': {
            'Picacg Random': "哔咔随机",
            'Picacg Latest': "哔咔最新",
            'New to old': "新到旧",
            'Old to new': "旧到新",
            'Most likes': "最多喜欢",
            'Most nominated': "最多指名",
            'Day': "日",
            'Week': "周",
            'Month': "月",
            'Author': "作者",
            'Chinese Team': "汉化组",
            'Categories': "分类",
            'Tags': "标签",
            'Image quality': "图片质量",
            'App channel': "分流",
            'Favorite sort': "收藏排序",
            'Sort': "排序",
        },
        'zh_TW': {
            'Picacg Random': "哔咔隨機",
            'Picacg Latest': "哔咔最新",
            'New to old': "新到舊",
            'Old to new': "舊到新",
            'Most likes': "最多喜歡",
            'Most nominated': "最多指名",
            'Day': "日",
            'Week': "周",
            'Month': "月",
            'Author': "作者",
            'Chinese Team': "漢化組",
            'Categories': "分類",
            'Tags': "標籤",
            'Image quality': "圖片質量",
            'App channel': "分流",
            'Favorite sort': "收藏排序",
            'Sort': "排序",
        },
    }
}