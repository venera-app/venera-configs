class JM extends ComicSource {
    name = "禁漫天堂"
    key = "jm"
    version = "1.3.3"
    minAppVersion = "1.5.0"

    static jmVersion = "2.0.11"
    static jmPkgName = "com.example.app"
    url = "https://cdn.jsdelivr.net/gh/rksk102/venera-configs@main/jm.js"

    static fallbackServers = [
        "www.cdntwice.org",
        "www.cdnsha.org",
        "www.cdnaspa.cc",
        "www.cdnntr.cc",
    ];

    static imageUrl = "https://cdn-msp.jmapinodeudzn.net"
    static ua = "Mozilla/5.0 (Linux; Android 10; K; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/130.0.0.0 Mobile Safari/537.36"

    get ua() { return JM.ua; }

    get baseUrl() {
    let index = parseInt(this.loadSetting('apiDomain')) - 1;
    if (isNaN(index) || index < 0 || !JM.apiDomains || !JM.apiDomains[index]) {
        return `https://${JM.fallbackServers[0]}`; 
    }
    return `https://${JM.apiDomains[index]}`;
}

    get imageUrl() { return JM.imageUrl; }

    overwriteApiDomains(domains) {
        if (domains && domains.length !== 0) JM.apiDomains = domains;
    }

    overwriteImgUrl(url) {
        if (url && url.length !== 0) JM.imageUrl = url;
    }

    isNum(str) { return /^\d+$/.test(str); }

    get baseHeaders() {
        return {
            "Accept": "*/*",
            "Accept-Encoding": "gzip, deflate, br, zstd",
            "Accept-Language": "zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7",
            "Connection": "keep-alive",
            "Origin": "https://localhost",
            "Referer": "https://localhost/",
            "Sec-Fetch-Dest": "empty",
            "Sec-Fetch-Mode": "cors",
            "Sec-Fetch-Site": "cross-site",
            "X-Requested-With": JM.jmPkgName,
        };
    }

    getApiHeaders(time) {
        const jmAuthKey = "18comicAPPContent";
        let token = Convert.md5(Convert.encodeUtf8(`${time}${jmAuthKey}`));
        return {
            ...this.baseHeaders,
            "Authorization": "Bearer",
            "Sec-Fetch-Storage-Access": "active",
            "token": Convert.hexEncode(token),
            "tokenparam": `${time},${JM.jmVersion}`,
            "User-Agent": this.ua,
        };
    }

    getImgHeaders() {
        return {
            ...this.baseHeaders,
            "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
            "Referer": this.baseUrl + "/",
            "Sec-Fetch-Dest": "image",
            "Sec-Fetch-Mode": "no-cors",
            "User-Agent": this.ua,
        };
    }

    getCoverUrl(id) { return `${this.imageUrl}/media/albums/${id}_3x4.jpg`; }

    getImageUrl(id, imageName) { return `${this.imageUrl}/media/photos/${id}/${imageName}`; }

    getAvatarUrl(imageName) { return `${this.imageUrl}/media/users/${imageName}`; }

    async init() {
        if (this.loadSetting('refreshDomainsOnStart')) await this.refreshApiDomains(false);
        await this.refreshImgUrl(false);
    }

    async refreshApiDomains(showConfirmDialog) {
        const url = "https://rup4a04-c02.tos-cn-hongkong.bytepluses.com/newsvr-2025.txt";
        const domainSecret = "diosfjckwpqpdfjkvnqQjsik";
        let title = "Update Failed", message = `Using built-in domains:\n\n`, servers = [], domains = [];
        
        try {
            let res = await fetch(url, { headers: this.baseHeaders });
            if (res?.status === 200) {
                let data = this.convertData(await res.text(), domainSecret);
                let json = JSON.parse(data);
                if (json?.Server) {
                    title = "Update Success";
                    message = "\n";
                    servers = json.Server.slice(0, 4);
                }
            }
        } catch (e) { console.log("Refresh Domains Error: " + e); }

        if (servers.length === 0) servers = JM.fallbackServers;

        servers.forEach((srv, i) => {
            message += `線路${i + 1}:  ${srv}\n\n`;
            domains.push(srv);
        });

        if (showConfirmDialog) {
            UI.showDialog(title, message, [
                { text: "Cancel", callback: () => {} },
                { text: "Apply", callback: () => { this.overwriteApiDomains(domains); this.refreshImgUrl(true); } }
            ]);
        } else {
            this.overwriteApiDomains(domains);
        }
    }

    async refreshImgUrl(showMessage) {
        try {
            let index = this.loadSetting('imageStream');
            let res = await this.get(`${this.baseUrl}/setting?app_img_shunt=${index}?express=`);
            let setting = JSON.parse(res);
            if (setting?.img_host) {
                if (showMessage) UI.showMessage(`Image Stream ${index}:\n${setting.img_host}`);
                this.overwriteImgUrl(setting.img_host);
            }
        } catch (e) { console.log("Refresh Image URL Error: " + e); }
    }

    parseComic(comic) {
        if (!comic) return null;
        const id = (comic.id || "").toString();
        if (!id) return null;

        const tags = [];
        if (comic.category?.title) tags.push(comic.category.title);
        if (comic.category_sub?.title) tags.push(comic.category_sub.title);

        return new Comic({
            id: id,
            title: comic.name || "Unknown",
            subTitle: (comic.author || "").trim() || "禁漫天堂",
            cover: this.getCoverUrl(id),
            tags: tags,
            description: comic.description ?? ""
        });
    }

    convertData(input, secret) {  
    const key = Convert.encodeUtf8(Convert.hexEncode(Convert.md5(Convert.encodeUtf8(secret))));
    const data = Convert.decodeBase64(input);
    const decrypted = Convert.decryptAesEcb(data, key);
    const res = Convert.decodeUtf8(decrypted);
    
    let start = 0;
    while (start < res.length && res[start] !== '{' && res[start] !== '[') {
        start++;
    }
    let end = res.length - 1;
    while (end > start && res[end] !== '}' && res[end] !== ']') {
        end--;
    }
    
    if (start >= res.length || end <= start) return res;
    return res.substring(start, end + 1);
}

    async get(url) {
        const time = Math.floor(Date.now() / 1000);
        const kJmSecret = "185Hcomic3PAPP7R";
        const res = await Network.get(url, this.getApiHeaders(time));
        if (res.status !== 200) {
            const msg = res.status === 401 ? (JSON.parse(res.body)?.errorMsg || "Login expired") : `Status ${res.status}`;
            throw msg;
        }
        const json = JSON.parse(res.body);
        if (typeof json.data !== 'string') throw 'Invalid Data';
        return this.convertData(json.data, `${time}${kJmSecret}`);
    }

    async post(url, body) {
        const time = Math.floor(Date.now() / 1000);
        const kJmSecret = "185Hcomic3PAPP7R";
        const res = await Network.post(url, {
            ...this.getApiHeaders(time),
            "Content-Type": "application/x-www-form-urlencoded"
        }, body);
        if (res.status !== 200) throw `Status ${res.status}`;
        const json = JSON.parse(res.body);
        if (typeof json.data !== 'string') throw 'Invalid Data';
        return this.convertData(json.data, `${time}${kJmSecret}`);
    }

    account = {
        login: async (account, pwd) => {
            await this.post(`${this.baseUrl}/login`, `username=${encodeURIComponent(account)}&password=${encodeURIComponent(pwd)}`);
            return "ok";
        },
        logout: () => {
            JM.apiDomains.forEach(url => Network.deleteCookies(url));
        },
        registerWebsite: null
    }

    explore = [
        {
            title: "禁漫天堂",
            type: "multiPartPage",
            load: async (page) => {
                const res = await this.get(`${this.baseUrl}/promote?$baseData&page=0`);
                const data = JSON.parse(res);
                if (!Array.isArray(data)) return [];

                return data.filter(e => e.type !== 'library').map(e => ({
                    title: e.title,
                    comics: (e.content || []).map(c => this.parseComic(c)).filter(Boolean),
                    viewMore: `category:${e.title}@${e.type === 'category_id' ? e.slug : e.id}`
                }));
            },
        }
    ]

    category = {
        title: "禁漫天堂",
        parts: [
            { name: "每週必看", type: "fixed", categories: ["每週必看"], itemType: "category" },
            { 
                name: "成人A漫", type: "fixed", itemType: "category",
                categories: ["最新A漫", "同人", "單本", "短篇", "其他類", "韓漫", "美漫", "Cosplay", "3D", "禁漫漢化組"],
                categoryParams: ["0", "doujin", "single", "short", "another", "hanman", "meiman", "another_cosplay", "3D", "禁漫漢化組"]
            },
            {
                name: "主題A漫", type: "fixed", itemType: "search",
                categories: ['無修正', '劇情向', '青年漫', '校服', '純愛', '人妻', '教師', '百合', 'Yaoi', '性轉', 'NTR', '女裝', '癡女', '全彩', '女性向', '完結', '純愛', '禁漫漢化組']
            },
            {
                name: "角色扮演", type: "fixed", itemType: "search",
                categories: ['御姐', '熟女', '巨乳', '貧乳', '女性支配', '教師', '女僕', '護士', '泳裝', '眼鏡', '連褲襪', '其他制服', '兔女郎']
            },
            {
                name: "特殊PLAY", type: "fixed", itemType: "search",
                categories: ['群交', '足交', '束縛', '肛交', '阿黑顏', '藥物', '扶他', '調教', '野外露出', '催眠', '自慰', '觸手', '獸交', '亞人', '怪物女孩', '皮物', 'ryona', '騎大車']
            },
            {
                name: "特殊PLAY", type: "fixed", itemType: "search",
                categories: ['CG', '重口', '獵奇', '非H', '血腥暴力', '站長推薦']
            }
        ],
        enableRankingPage: true,
    }

    categoryComics = {
        load: async (category, param, options, page) => {
            let url = category !== "每週必看" 
                ? `${this.baseUrl}/categories/filter?o=${options[0]}&c=${encodeURIComponent(param || category)}&page=${page}`
                : `${this.baseUrl}/week/filter?id=${options[0]}&page=1&type=${options[1]}&page=0`;
            
            const res = await this.get(url);
            const data = JSON.parse(res);
            const list = data.content || data.list || [];
            return {
                comics: list.map(e => this.parseComic(e)).filter(Boolean),
                maxPage: data.total ? Math.ceil(data.total / 80) : 1
            };
        },
        optionLoader: async (category, param) => {
            if (category !== "每週必看") {
                return [{
                    label: "排序",
                    options: ["mr-最新", "mv-總排行", "mv_m-月排行", "mv_w-周排行", "mv_t-日排行", "mp-最多圖片", "tf-最多喜歡"]
                }];
            }
            const res = await this.get(`${this.baseUrl}/week`);
            const data = JSON.parse(res);
            return [
                { label: "時間", options: (data.categories || []).map(e => `${e.id}-${e.time}`) },
                { label: "類型", options: ["manga-日漫", "hanman-韓漫", "another-其他"] }
            ];
        },
        ranking: {
            options: ["mv-總排行", "mv_m-月排行", "mv_w-周排行", "mv_t-日排行"],
            load: async (option, page) => this.categoryComics.load("總排行", "0", [option], page)
        }
    }

    search = {
        load: async (keyword, options, page) => {
            const query = encodeURIComponent(keyword.trim()).replace(/%20/g, '+').replace(/\s+/g, '+');
            let url = `${this.baseUrl}/search?search_query=${query}&o=${options[0]}`;
            if (page > 1) url += `&page=${page}`;
            const res = await this.get(url);
            const data = JSON.parse(res);
            return {
                comics: (data.content || []).map(e => this.parseComic(e)).filter(Boolean),
                maxPage: Math.ceil((data.total || 0) / 80)
            };
        },
        optionList: [{ type: "select", label: "排序", options: ["mr-最新", "mv-總排行", "mv_m-月排行", "mv_w-周排行", "mv_t-日排行", "mp-最多圖片", "tf-最多喜歡"] }],
    }

    favorites = {
        multiFolder: true,
        addOrDelFavorite: async (comicId, folderId, isAdding) => {
            await this.post(`${this.baseUrl}/favorite`, `aid=${comicId}`);
            if (isAdding) await this.post(`${this.baseUrl}/favorite_folder`, `type=move&folder_id=${folderId}&aid=${comicId}`);
        },
        loadFolders: async (comicId) => {
            const res = await this.get(`${this.baseUrl}/favorite`);
            const json = JSON.parse(res);
            const folders = { "0": this.translate("All") };
            (json.folder_list || []).forEach(e => { folders[e.FID.toString()] = e.name; });
            return { folders, favorited: [] };
        },
        addFolder: async (name) => this.post(`${this.baseUrl}/favorite_folder`, `type=add&folder_name=${encodeURIComponent(name)}`),
        deleteFolder: async (folderId) => this.post(`${this.baseUrl}/favorite_folder`, `type=del&folder_id=${folderId}`),
        loadComics: async (page, folder) => {
            const order = this.loadSetting('favoriteOrder');
            const res = await this.get(`${this.baseUrl}/favorite?folder_id=${folder}&page=${page}&o=${order}`);
            const json = JSON.parse(res);
            return {
                comics: (json.list || []).map(e => this.parseComic(e)).filter(Boolean),
                maxPage: Math.ceil((json.total || 0) / 20)
            };
        },
        singleFolderForSingleComic: true,
    }

    comic = {
        loadInfo: async (id) => {
            const realId = id.startsWith('jm') ? id.substring(2) : id;
            const res = await this.get(`${this.baseUrl}/album?id=${realId}`);
            const data = JSON.parse(res);
            
            const chapters = new Map();
            (data.series || []).sort((a, b) => a.sort - b.sort).forEach(e => {
                let name = (e.name || "").trim() || `第${e.sort}話`;
                chapters.set(e.id.toString(), name);
            });
            if (chapters.size === 0) chapters.set(realId, '第1話');

            const related = (data.related_list || []).map(e => new Comic({
                id: e.id.toString(),
                title: e.name,
                subTitle: e.author || "",
                cover: this.getCoverUrl(e.id),
                description: e.description ?? ""
            }));

            const date = new Date((data.addtime || 0) * 1000);
            return new ComicDetails({
                title: data.name,
                cover: this.getCoverUrl(realId),
                description: data.description,
                likesCount: Number(data.likes || 0),
                chapters: chapters,
                tags: { "作者": data.author || [], "標籤": data.tags || [] },
                related: related,
                isFavorite: data.is_favorite ?? false,
                updateTime: `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`,
            });
        },
        loadEp: async (comicId, epId) => {
            const res = await this.get(`${this.baseUrl}/chapter?&id=${epId}`);
            const data = JSON.parse(res);
            return { images: (data.images || []).map(e => this.getImageUrl(epId, e)) };
        },
        onImageLoad: (url, comicId, epId) => {
            const scrambleId = 220980;
            const pictureName = url.substring(url.lastIndexOf('/') + 1, url.length - 5);
            const numEpId = Number(epId);
            let num = 0;

            if (numEpId < scrambleId) num = 0;
            else if (numEpId < 268850) num = 10;
            else {
                const hashStr = Convert.hexEncode(Convert.md5(Convert.encodeUtf8(numEpId + pictureName)));
                const remainder = hashStr.charCodeAt(hashStr.length - 1) % (numEpId > 421926 ? 8 : 10);
                num = remainder * 2 + 2;
            }

            if (num <= 1) return { headers: this.getImgHeaders() };
            return {
                headers: this.getImgHeaders(),
                modifyImage: url.endsWith(".gif") ? null : `
                    let modifyImage = (image) => {
                        const num = ${num};
                        let blockSize = Math.floor(image.height / num);
                        let remainder = image.height % num;
                        let res = Image.empty(image.width, image.height);
                        let y = 0;
                        for(let i = num - 1; i >= 0; i--) {
                            let h = blockSize + (i === num - 1 ? remainder : 0);
                            res.fillImageRangeAt(0, y, image, 0, i * blockSize, image.width, h);
                            y += h;
                        }
                        return res;
                    }
                `,
            };
        },
        onThumbnailLoad: (url) => ({ headers: this.getImgHeaders() }),
        loadComments: async (comicId, subId, page) => {
            const res = await this.get(`${this.baseUrl}/forum?mode=manhua&aid=${comicId}&page=${page}`);
            const json = JSON.parse(res);
            return {
                comments: (json.list || []).map(e => new Comment({
                    avatar: this.getAvatarUrl(e.photo),
                    userName: e.username,
                    time: e.addtime,
                    content: e.content.replace(/<[^>]*>/g, ''),
                })),
                maxPage: Math.floor((json.total || 0) / 6) + 1
            };
        },
        sendComment: async (comicId, subId, content) => {
            const res = await this.post(`${this.baseUrl}/comment`, `aid=${comicId}&comment=${encodeURIComponent(content)}&status=undefined`);
            const json = JSON.parse(res);
            if (json.status === "fail") throw json.msg || 'Failed';
            return "ok";
        },
        idMatch: "^(\\d+|jm\\d+)$",
        onClickTag: (ns, tag) => ({ action: 'search', keyword: tag }),
    }

    settings = {
        refreshDomains: { title: "Refresh Domain List", type: "callback", buttonText: "Refresh", callback: () => this.refreshApiDomains(true) },
        refreshDomainsOnStart: { title: "Refresh Domain List on Startup", type: "switch", default: true },
        apiDomain: { title: "Api Domain", type: "select", options: [{value:'1'},{value:'2'},{value:'3'},{value:'4'}], default: "1" },
        imageStream: { title: "Image Stream", type: "select", options: [{value:'1'},{value:'2'},{value:'3'},{value:'4'}], default: "1" },
        favoriteOrder: { title: "Favorite Order", type: "select", options: [{value:'mr',text:'Add Time'},{value:'mp',text:'Update Time'}], default: 'mr' }
    }

    translation = {
        'zh_CN': { 'Refresh Domain List': '刷新域名列表', 'Refresh': '刷新', 'Refresh Domain List on Startup': '启动时刷新域名列表', 'Api Domain': 'Api域名', 'Image Stream': '图片分流', 'Favorite Order': '收藏夹排序', 'Add Time': '添加时间', 'Update Time': '更新时间', 'All': '全部' },
        'zh_TW': { 'Refresh Domain List': '刷新域名列表', 'Refresh': '刷新', 'Refresh Domain List on Startup': '啟動時刷新域名列表', 'Api Domain': 'Api域名', 'Image Stream': '圖片分流', 'Favorite Order': '收藏夾排序', 'Add Time': '添加時間', 'Update Time': '更新時間', 'All': '全部' }
    }
}
