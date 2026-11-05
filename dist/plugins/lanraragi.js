class Lanraragi extends ComicSource {
    constructor(...e) {
        super(...e), this.name = "Lanraragi", this.key = "lanraragi", this.version = "1.2.7",
        this.minAppVersion = "1.4.0", this.url = resolvePluginUpdateUrl("lanraragi.js"),
        this.settings = {
            api: {
                title: "API",
                type: "input",
                default: "http://lrr.tvc-16.science"
            },
            apiKey: {
                title: "APIKEY",
                type: "input",
                default: ""
            }
        }, this.account = {
            loginWithCookies: {
                fields: [ "apiKey" ],
                validate: function(e) {
                    var t = e && e.length > 0 ? e[0] : "";
                    return !!(t && t.length > 0);
                }
            },
            logout: function() {
                this.deleteData("account");
            }
        }, this.explore = [ {
            title: "Latest",
            type: "multiPageComicList",
            load: e => this._loadArchivePage(e, "explore_start", {
                sortby: "date_added",
                order: "desc",
                groupby_tanks: "true"
            }, !1)
        }, {
            title: "New",
            type: "multiPageComicList",
            load: e => this._loadArchivePage(e, "explore_new", {
                sortby: "date_added",
                order: "desc",
                newonly: "true",
                groupby_tanks: "true"
            }, !1)
        }, {
            title: "Recently read",
            type: "multiPageComicList",
            load: e => this._loadArchivePage(e, "explore_read", {
                sortby: "lastread",
                order: "desc",
                groupby_tanks: "false"
            }, !1)
        }, {
            title: "Random",
            type: "multiPageComicList",
            load: () => this._loadRandomExplore()
        } ], this.category = {
            title: "Lanraragi",
            parts: [ {
                name: "ALL",
                type: "dynamic",
                loader: () => {
                    const e = this._loadScopedList("categories");
                    if (!Array.isArray(e) || 0 === e.length) throw "Please check your API settings or categories.";
                    const t = [];
                    for (const i of e) {
                        var r, a, o;
                        if (!i) continue;
                        const e = null != (r = null != (a = i.id) ? a : i._id) ? r : i.name, s = null != (o = i.name) ? o : String(e);
                        try {
                            t.push({
                                label: s,
                                target: new PageJumpTarget({
                                    page: "category",
                                    attributes: {
                                        category: e,
                                        param: null
                                    }
                                })
                            });
                        } catch (r) {
                            t.push({
                                label: s,
                                target: {
                                    page: "category",
                                    attributes: {
                                        category: e,
                                        param: null
                                    }
                                }
                            });
                        }
                    }
                    return t;
                }
            } ],
            enableRankingPage: !1
        }, this.categoryComics = {
            load: async (e, t, r, a) => await this._loadArchivePage(a, `category_start_${String(e || "")}`, {
                category: e || "",
                sortby: "date_added",
                order: "desc"
            }, !0)
        }, this.search = {
            load: async (e, t, r = 1) => {
                const a = e => t && t[e];
                return await this._loadArchivePage(r, "search", {
                    filter: String(e || "").trim(),
                    sortby: lrrChoice(a(0), "title", LRR_SORT_KEYS),
                    order: lrrChoice(a(1), "asc", LRR_ORDERS),
                    newonly: lrrChoice(a(2), "false", LRR_BOOLS),
                    untaggedonly: lrrChoice(a(3), "false", LRR_BOOLS),
                    groupby_tanks: lrrChoice(a(4), "true", LRR_BOOLS)
                }, !1);
            },
            loadNext: async (e, t, r) => {
                const a = "number" == typeof r && r > 0 ? r : 1;
                return await this.search.load(e, t, a);
            },
            optionList: [ {
                type: "select",
                options: [ "title-按标题", "date_added-最新添加", "lastread-最近阅读" ],
                label: "sortby",
                default: "title"
            }, {
                type: "select",
                options: [ "asc-升序", "desc-降序" ],
                label: "order",
                default: "asc"
            }, {
                type: "select",
                options: [ "false-全部", "true-仅新" ],
                label: "newonly",
                default: "false"
            }, {
                type: "select",
                options: [ "false-全部", "true-仅未打标签" ],
                label: "untaggedonly",
                default: "false"
            }, {
                type: "select",
                options: [ "true-启用", "false-禁用" ],
                label: "groupby_tanks",
                default: "true"
            } ],
            enableTagsSuggestions: !1
        }, this.favorites = {
            multiFolder: !0,
            singleFolderForSingleComic: !1,
            addOrDelFavorite: async (e, t, r, a) => {
                if (isLrrTankId(e)) throw "Cannot favorite a LANraragi tankoubon";
                const o = this.headers || {};
                if (!o || 0 === Object.keys(o).length) throw "API token required to modify favorites";
                if (!t || "-1" === String(t)) throw "Invalid folder id";
                const i = buildSelfHostedUrlFromSource(this, LRR_ROUTES.categoryArchivePath(t, e));
                let s;
                if (s = r ? await Network.put(i, o) : await Network.delete(i, o), 200 !== s.status && 204 !== s.status) throw `Invalid status code: ${s.status}`;
                return "ok";
            },
            loadFolders: async e => {
                const t = this._loadScopedList("favorites"), r = {};
                if (Array.isArray(t)) for (const e of t) {
                    var a, o, i;
                    if (!e) continue;
                    const t = null != (a = null != (o = e.id) ? o : e._id) ? a : e.name, s = null != (i = e.name) ? i : String(t);
                    r[String(t)] = s;
                }
                const s = [];
                if (e) try {
                    const t = await this.comic.loadInfo(e);
                    try {
                        if (t && (!0 === t.isFavorite || "true" === t.isFavorite)) {
                            const e = Array.isArray(t.folders) ? t.folders.map(e => String(e)) : null, a = new Set(s);
                            if (e && e.length > 0) for (const t of e) for (const [e, o] of Object.entries(r)) t !== e && t !== o || a.add(e);
                            s.length = 0;
                            for (const e of a) s.push(e);
                        }
                    } catch (e) {}
                    const a = t.tags || {}, o = Object.keys(a);
                    for (const e of o) if ("category" === String(e).toLowerCase()) {
                        const t = a[e];
                        if (Array.isArray(t)) for (const e of t) for (const [t, a] of Object.entries(r)) String(e) !== t && String(e) !== a || s.includes(t) || s.push(t);
                    }
                } catch (e) {}
                return {
                    folders: r,
                    favorited: s
                };
            },
            loadComics: async (e, t) => {
                const r = "number" == typeof e && e > 0 ? e : 1;
                return await this._loadArchivePage(r, `favorites_start_${String(t || "")}`, {
                    category: t || "",
                    sortby: "date_added",
                    order: "desc"
                }, !1);
            }
        }, this.comic = {
            loadInfo: async e => {
                if (isLrrTankId(e)) return await this._loadTankInfo(e);
                if (isLrrArchiveId(e)) try {
                    await this._ensureTankIndex();
                    const t = this._memberTank && this._memberTank[String(e).toLowerCase()];
                    if (isLrrTankId(t)) return await this._loadTankInfo(t);
                } catch (e) {
                    if (e === LRR_TANK_INDEX_INCOMPLETE) throw e;
                }
                const t = buildSelfHostedUrlFromSource(this, LRR_ROUTES.archiveMetadataPath(e)), r = await Network.get(t, this.headers);
                if (200 !== r.status) throw `Invalid status code: ${r.status}`;
                const a = JSON.parse(r.body), o = buildSelfHostedUrlFromSource(this, LRR_ROUTES.archiveThumbnailPath(e));
                let i = toSelfHostedTagArray(a.tags);
                const s = extractSelfHostedTagValue(i, LRR_TAG_PREFIXES.rating);
                i = removeSelfHostedTagsByPrefix(i, [ LRR_TAG_PREFIXES.rating ]);
                let n = null;
                const l = extractSelfHostedTagValue(i, LRR_TAG_PREFIXES.dateAdded);
                l && (n = l, i = removeSelfHostedTagsByPrefix(i, [ LRR_TAG_PREFIXES.dateAdded ]));
                const u = new Map, c = [];
                for (const e of i) {
                    const t = e.indexOf(":");
                    if (t > 0) {
                        const r = e.slice(0, t), a = e.slice(t + 1);
                        u.has(r) || u.set(r, []), u.get(r).push(a);
                    } else c.push(e);
                }
                const d = {};
                for (const [e, t] of u.entries()) if ("__proto__" !== e && "constructor" !== e && "prototype" !== e) d[e] = t; else for (const e of t) c.push(e);
                d.Tags = c, d.Pages = [ String(a.pagecount) ], d.Extension = [ a.extension ];
                const p = extractSelfHostedUrlEntriesFromTagMap(d, {
                    sourceNamespace: "source",
                    sourceScheme: "https",
                    skipKeys: [ "Extension", "Pages" ]
                });
                let h = a.summary || "";
                p.length && (h && (h += "\n"), h += "关联：" + p.join(", "));
                let g = !1, f = [];
                try {
                    const t = buildSelfHostedUrlFromSource(this, LRR_ROUTES.archiveCategoriesPath(e)), r = await Network.get(t, this.headers);
                    if (200 === r.status) {
                        let t = [];
                        try {
                            t = JSON.parse(r.body);
                        } catch (e) {
                            t = [];
                        }
                        if (t && "object" == typeof t && (Array.isArray(t.categories) ? t = t.categories : Array.isArray(t.data) ? t = t.data : Array.isArray(t) || (t = [])),
                        Array.isArray(t) && t.length > 0) {
                            const r = [];
                            for (const a of t) {
                                const t = Array.isArray(a.archives) ? a.archives : [];
                                Array.isArray(t) && t.some(t => String(t) === String(e)) && r.push(a);
                            }
                            r.length > 0 && (g = !0, f = r.map(e => {
                                var t, r, a;
                                return String(null != (t = null != (r = null != (a = e.id) ? a : e._id) ? r : e.name) ? t : e);
                            }));
                        }
                    }
                } catch (e) {}
                const y = {};
                y[e] = a.title || "Local manga";
                let m = this._toStarsFromValue(s);
                return null == m && (m = 0), {
                    title: a.title || a.filename || e,
                    cover: o,
                    description: h,
                    uploadTime: n,
                    tags: d,
                    stars: m,
                    chapters: y,
                    isFavorite: g,
                    folders: f
                };
            },
            loadThumbnails: async (e, t) => {
                if (isLrrTankId(e)) {
                    const t = await this._loadTankInfo(e);
                    return {
                        thumbnails: Object.keys(t.chapters || {}).map(e => buildSelfHostedUrlFromSource(this, LRR_ROUTES.archiveThumbnailPath(e))),
                        next: null
                    };
                }
                const r = buildSelfHostedUrlFromSource(this, LRR_ROUTES.archiveMetadataPath(e)), a = await Network.get(r, this.headers);
                if (200 !== a.status) throw `Invalid status code: ${a.status}`;
                const o = JSON.parse(a.body).pagecount || 1, i = [];
                for (let t = 1; t <= o; t++) i.push(buildSelfHostedUrlFromSource(this, LRR_ROUTES.archiveThumbnailPath(e), {
                    page: t
                }));
                return {
                    thumbnails: i,
                    next: null
                };
            },
            starRating: async (e, t) => {
                if (isLrrTankId(e)) throw "Cannot rate a LANraragi tankoubon";
                const r = this.headers || {};
                if (!r || 0 === Object.keys(r).length) throw "API token required to submit rating";
                const a = buildSelfHostedUrlFromSource(this, LRR_ROUTES.archiveMetadataPath(e)), o = await Network.get(a, r);
                if (200 !== o.status) throw `Invalid status code: ${o.status}`;
                let i = {};
                try {
                    i = JSON.parse(o.body);
                } catch (e) {
                    i = {};
                }
                let s = toSelfHostedTagArray(i.tags);
                s = removeSelfHostedTagsByPrefix(s, [ LRR_TAG_PREFIXES.rating ], {
                    caseSensitive: !1
                }), t > 0 && s.push(buildSelfHostedEmojiRatingTag(t, {
                    prefix: LRR_TAG_PREFIXES.rating,
                    symbol: "⭐"
                }));
                const n = s.join(", "), l = `tags=${encodeURIComponent(n)}`, u = buildSelfHostedUrlFromSource(this, LRR_ROUTES.archiveMetadataPath(e)), c = await Network.put(u, Object.assign({}, r, {
                    "Content-Type": "application/x-www-form-urlencoded"
                }), l);
                if (200 !== c.status && 204 !== c.status) throw `Invalid status code: ${c.status}`;
                return "ok";
            },
            loadEp: async (e, t) => {
                const r = String(e || ""), a = String(t || "");
                let o = "";
                if (isLrrTankId(r)) {
                    if (!isLrrArchiveId(a)) throw "LANraragi tankoubon has no chapters.";
                    if (o = a.toLowerCase(), !this._imageBelongs(r, o, o)) throw "LANraragi page belongs to another archive.";
                } else {
                    if (!isLrrArchiveId(r)) throw "Invalid LANraragi archive ID.";
                    if (isLrrArchiveId(a) && a.toLowerCase() !== r.toLowerCase()) throw "LANraragi archive has no chapters.";
                    o = r.toLowerCase();
                }
                const i = String(this.baseUrl || "").replace(/\/$/, ""), s = buildSelfHostedUrlFromSource(this, LRR_ROUTES.archiveFilesPath(o), {
                    force: "false"
                }), n = await Network.get(s, this.headers);
                if (200 !== n.status) throw `Invalid status code: ${n.status}`;
                const l = JSON.parse(n.body), u = l && Array.isArray(l.pages) ? l.pages : null;
                if (!u || 0 === u.length) throw "LANraragi archive has no pages yet.";
                if (u.length > 1e4) throw "Invalid LANraragi page list.";
                const c = [];
                for (const e of u) {
                    if ("string" != typeof e) throw "Invalid LANraragi page URL.";
                    c.push(lrrPageKey(o, e, i));
                }
                return {
                    images: c
                };
            },
            onImageLoad: (e, t, r) => {
                const a = String(e || "");
                let o = "", i = "";
                if (a.startsWith("lrr-page:")) {
                    const e = /^lrr-page:([a-f0-9]{40}):/i.exec(a);
                    if (!e) throw "Invalid LANraragi image key.";
                    o = e[1].toLowerCase(), i = lrrResolvePageKey(a, this.baseUrl);
                } else {
                    const e = isLrrArchiveId(r) ? String(r).toLowerCase() : isLrrArchiveId(t) ? String(t).toLowerCase() : "";
                    if (!e) throw "Invalid LANraragi image key.";
                    o = e, i = lrrResolvePageKey(lrrPageKey(e, a, this.baseUrl), this.baseUrl);
                }
                if (!this._imageBelongs(t, r, o)) throw "LANraragi page belongs to another archive.";
                return {
                    url: i,
                    headers: this._authHeaders()
                };
            },
            onThumbnailLoad: e => {
                const t = String(e || ""), r = String(this.baseUrl || "").replace(/\/+$/, "");
                return t.startsWith(r + "/") ? {
                    headers: this._authHeaders()
                } : {
                    headers: {}
                };
            },
            onClickTag: (e, t) => {
                const r = e ? String(e) : "", a = r.toLowerCase();
                if ("pages" === a || "extension" === a) return null;
                let o = String(t);
                return o.includes(" ") && (o = `"${o}"`), {
                    action: "search",
                    keyword: r ? `${r}:${o}` : o,
                    param: null
                };
            },
            enableTagsTranslate: !0
        }, this.translation = {
            zh_CN: {
                language: "语言",
                artist: "画师",
                male: "男性",
                female: "女性",
                mixed: "混合",
                other: "其它",
                parody: "原作",
                character: "角色",
                group: "团队",
                cosplayer: "Coser",
                reclass: "重新分类",
                uploader: "上传者",
                Languages: "语言",
                Artists: "画师",
                Characters: "角色",
                Groups: "团队",
                Tags: "标签",
                Parodies: "原作",
                Categories: "分类",
                Category: "分类",
                series: "系列",
                Series: "系列",
                Pages: "页数",
                Extension: "文件类型"
            },
            en_US: {
                language: "Language",
                artist: "Artist",
                male: "Male",
                female: "Female",
                mixed: "Mixed",
                other: "Other",
                parody: "Parody",
                character: "Character",
                group: "Group",
                cosplayer: "Cosplayer",
                reclass: "Reclass",
                uploader: "Uploader",
                Languages: "Languages",
                Artists: "Artists",
                Characters: "Characters",
                Groups: "Groups",
                Tags: "Tags",
                Parodies: "Parodies",
                Categories: "Categories",
                Category: "Category",
                series: "Series",
                Series: "Series",
                Pages: "Pages",
                Extension: "Extension"
            }
        };
    }
    get baseUrl() {
        return this._identity().baseUrl;
    }
    _identity() {
        const e = this.loadSetting("api"), t = this.loadSetting("apiKey"), r = this._identityCache;
        if (r && r.rawApi === e && r.rawKey === t) return r;
        const a = resolveLrrBaseUrl(e, this.settings.api.default), o = String(t || "").trim();
        if (o.length > 512 || /[\r\n\u0000-\u001f\u007f]/.test(o)) throw "Invalid LANraragi API Key.";
        const i = o ? `Bearer ${encodeLrrBearer(o)}` : "", s = i ? {
            Authorization: i
        } : {}, n = i ? {
            Accept: "application/json",
            Authorization: i
        } : {
            Accept: "application/json"
        }, l = {
            rawApi: e,
            rawKey: t,
            baseUrl: a,
            key: o,
            stamp: lrrFingerprint(`${a}\n${o}`),
            authHeaders: s,
            headers: n
        };
        return this._identityCache = l, l;
    }
    _apiKey() {
        return this._identity().key;
    }
    _serverStamp() {
        return this._identity().stamp;
    }
    _authHeaders() {
        const e = this._identity().authHeaders;
        return e.Authorization ? {
            Authorization: e.Authorization
        } : {};
    }
    get headers() {
        const e = this._identity().headers;
        return Object.assign({}, e);
    }
    _loadScopedList(e) {
        if (this.loadData(`${e}_server`) !== this._serverStamp()) return [];
        const t = this.loadData(e);
        return Array.isArray(t) ? t : [];
    }
    _saveScopedList(e, t, r) {
        this.saveData(e, r), this.saveData(`${e}_server`, t);
    }
    _toAbsoluteBaseUrl(e) {
        const t = String(e || "").trim();
        return t ? resolveLrrBaseUrl(t, "") : "";
    }
    _mapArchiveComic(e, t) {
        const r = this._toAbsoluteBaseUrl(t), a = isLrrTankId(e && e.arcid) ? "" : buildSelfHostedUrl(r, LRR_ROUTES.archiveThumbnailPath(e.arcid)), o = this._extractRatingFromTags(e.tags), i = this._toStarsFromValue(null != o ? o : null), s = e && null != e.pagecount ? String(e.pagecount).trim() : "", n = [ s ? s + "p" : "", !e || !0 !== e.isnew && "true" !== e.isnew && "1" !== e.isnew ? "" : "new" ].filter(Boolean).join(" · ");
        return new Comic({
            id: e.arcid,
            title: e.title || e.filename || e.arcid,
            subTitle: n,
            cover: a,
            tags: this._cleanListTags(e.tags),
            description: "",
            stars: i
        });
    }
    _acceptTankPage(e) {
        return !e || "object" != typeof e || Array.isArray(e) || !Array.isArray(e.result) || e.result.length > 1e3 || !Number.isSafeInteger(Number(e.total)) || Number(e.total) < 0 || Number(e.total) > 1e5 ? null : e;
    }
    async _fetchTankPage(e, t, r) {
        try {
            const a = buildSelfHostedUrl(e, "/api/tankoubons", {
                page: String(r)
            }), o = await Network.get(a, t);
            return o && 200 === o.status ? this._acceptTankPage(JSON.parse(o.body)) : null;
        } catch (e) {
            return null;
        }
    }
    async _fetchTankPageBatch(e, t, r, a) {
        const o = new Array(a);
        let i = 0;
        const s = async () => {
            for (;i < a; ) {
                const a = i;
                i += 1, o[a] = await this._fetchTankPage(e, t, r + a);
            }
        }, n = Math.min(4, a), l = [];
        for (let e = 0; e < n; e++) l.push(s());
        return await Promise.all(l), o;
    }
    _absorbTankPage(e, t, r, a, o) {
        for (const i of e.result) {
            if (!i || "object" != typeof i || Array.isArray(i)) continue;
            if (!isLrrTankId(i.id) || !Array.isArray(i.archives)) continue;
            if (i.archives.length > 2e3) continue;
            const e = [], s = Object.create(null);
            for (const t of i.archives) {
                if ("string" != typeof t || !isLrrArchiveId(t)) continue;
                const r = t.toLowerCase();
                s[r] || (s[r] = !0, e.push(r));
            }
            if (e.length) {
                r[i.id] = e[0], "string" == typeof i.name && i.name.trim() && (a[i.id] = i.name.trim().slice(0, 300));
                for (const r of e) {
                    if (o[r]) continue;
                    const e = t[r];
                    e && e !== i.id ? (delete t[r], o[r] = !0) : t[r] = i.id;
                }
            }
        }
    }
    async _ensureTankIndex() {
        const e = this._identity(), t = e.baseUrl, r = e.key;
        if (this._tankServer === t && this._tankAuth === r && this._memberTank) return;
        if (this._tankIndexPromise && this._tankIndexBase === t && this._tankIndexAuth === r) return await this._tankIndexPromise;
        const a = (this._tankGeneration || 0) + 1;
        this._tankGeneration = a;
        const o = this._loadTankIndex(t, r, Object.assign({}, e.headers), a);
        this._tankIndexPromise = o, this._tankIndexBase = t, this._tankIndexAuth = r;
        try {
            await o;
        } finally {
            this._tankIndexPromise === o && (this._tankIndexPromise = null);
        }
    }
    async _loadTankIndex(e, t, r, a) {
        const o = Object.create(null), i = Object.create(null), s = Object.create(null), n = Object.create(null), l = await this._fetchTankPage(e, r, 1);
        let u = 0, c = 0;
        l && l.result.length > 0 && (this._absorbTankPage(l, o, i, s, n), u = l.result.length,
        c = Number(l.total));
        let d = 2;
        for (;l && d <= 100 && u < c; ) {
            const t = Math.min(4, 100 - d + 1), a = await this._fetchTankPageBatch(e, r, d, t);
            let l = !1;
            for (let e = 0; e < a.length; e++) {
                const t = a[e];
                if (!t || 0 === t.result.length) {
                    l = !0;
                    break;
                }
                if (this._absorbTankPage(t, o, i, s, n), u += t.result.length, c = Number(t.total),
                d += 1, u >= c) {
                    l = !0;
                    break;
                }
            }
            if (l) break;
        }
        if (l && u < c) throw LRR_TANK_INDEX_INCOMPLETE;
        this._tankGeneration === a && this._identity().baseUrl === e && this._identity().key === t && (this._memberTank = o,
        this._tankCover = i, this._tankName = s, this._tankServer = e, this._tankAuth = t);
    }
    _tankListComic(e, t, r) {
        const a = this._tankCover && this._tankCover[e], o = this._tankName && this._tankName[e], i = isLrrArchiveId(a) ? buildSelfHostedUrl(this._toAbsoluteBaseUrl(this.baseUrl), LRR_ROUTES.archiveThumbnailPath(String(a).toLowerCase())) : "", s = r && "object" == typeof r ? r : {};
        return new Comic({
            id: e,
            title: o || t || e,
            subTitle: s.subTitle || "",
            cover: i,
            tags: s.tags || [],
            description: s.description || "",
            stars: null == s.stars ? null : s.stars
        });
    }
    async _fetchTankCard(e) {
        try {
            const t = buildSelfHostedUrlFromSource(this, `/api/tankoubons/${e}`), r = await Network.get(t, this.headers);
            if (!r || 200 !== r.status) return null;
            const a = JSON.parse(r.body);
            if (!a || "object" != typeof a || Array.isArray(a)) return null;
            const o = Array.isArray(a.archives) ? a.archives : [];
            let i = "";
            for (const e of o) if (isLrrArchiveId(e)) {
                i = String(e).toLowerCase();
                break;
            }
            return {
                name: "string" == typeof a.name ? a.name.trim().slice(0, 300) : "",
                cover: i
            };
        } catch (e) {
            return null;
        }
    }
    async _fillListedTanks(e) {
        const t = this._serverStamp();
        this._tankCards && this._tankCards.stamp === t || (this._tankCards = {
            stamp: t,
            byId: Object.create(null)
        });
        const r = [];
        for (const t of e) this._tankCards.byId[t] || r.push(t);
        if (!r.length) return;
        const a = new Array(r.length);
        let o = 0;
        const i = async () => {
            for (;o < r.length; ) {
                const e = o;
                o += 1, a[e] = await this._fetchTankCard(r[e]);
            }
        }, s = Math.min(4, r.length), n = [];
        for (let e = 0; e < s; e++) n.push(i());
        if (await Promise.all(n), this._tankCards && this._tankCards.stamp === t) for (let e = 0; e < r.length; e++) a[e] && (this._tankCards.byId[r[e]] = a[e]);
    }
    _tankListComicFromCard(e, t) {
        const r = isLrrArchiveId(t && t.cover) ? buildSelfHostedUrl(this._toAbsoluteBaseUrl(this.baseUrl), LRR_ROUTES.archiveThumbnailPath(t.cover)) : e.cover || "";
        return new Comic({
            id: e.id,
            title: t && t.name || e.title || e.id,
            subTitle: e.subTitle || "",
            cover: r,
            tags: e.tags || [],
            description: e.description || "",
            stars: null == e.stars ? null : e.stars
        });
    }
    async _decorateListedComics(e) {
        const t = Array.isArray(e) ? e : [], r = [], a = Object.create(null);
        for (const e of t) e && isLrrTankId(e.id) && !a[e.id] && (a[e.id] = !0, r.push(e.id));
        if (!r.length) return t;
        const o = this._identity(), i = this._tankServer === o.baseUrl && this._tankAuth === o.key && this._memberTank;
        if (!i) try {
            await this._fillListedTanks(r);
        } catch (e) {
            return t;
        }
        const s = !i && this._tankCards && this._tankCards.stamp === this._serverStamp() ? this._tankCards.byId : null;
        return t.map(e => {
            if (!e || !isLrrTankId(e.id)) return e;
            if (i) return this._tankListComic(e.id, e.title, e);
            const t = s && s[e.id];
            return t ? this._tankListComicFromCard(e, t) : e;
        });
    }
    async _loadRandomExplore() {
        const e = buildSelfHostedUrlFromSource(this, `${LRR_ROUTES.searchPath}/random`, {
            count: String(20),
            groupby_tanks: "true"
        }), t = await Network.get(e, this.headers);
        if (!t || 200 !== t.status) throw `Invalid status code: ${t ? t.status : 0}`;
        let r;
        try {
            r = JSON.parse(t.body);
        } catch (e) {
            throw "Invalid LANraragi search response.";
        }
        const a = r && Array.isArray(r.data) ? r.data : [], o = [];
        for (const e of a) e && "object" == typeof e && !Array.isArray(e) && e.arcid && o.push(this._mapArchiveComic(e, this.baseUrl));
        return {
            comics: await this._decorateListedComics(o),
            maxPage: 1
        };
    }
    async _collapseTankItems(e) {
        const t = Array.isArray(e) ? e : [];
        try {
            await this._ensureTankIndex();
        } catch (e) {
            if (e === LRR_TANK_INDEX_INCOMPLETE) throw e;
        }
        const r = [], a = {};
        for (const e of t) {
            if (!e || "object" != typeof e || Array.isArray(e)) continue;
            if (isLrrTankId(e.arcid)) {
                if (a[e.arcid]) continue;
                a[e.arcid] = !0, r.push(this._tankListComic(e.arcid, e.title || e.filename));
                continue;
            }
            const t = String(e.arcid || "");
            if (!isLrrArchiveId(t)) {
                r.push(this._mapArchiveComic(e, this.baseUrl));
                continue;
            }
            const o = this._memberTank && this._memberTank[t.toLowerCase()];
            isLrrTankId(o) ? a[o] || (a[o] = !0, r.push(this._tankListComic(o, e.title || e.filename))) : r.push(this._mapArchiveComic(e, this.baseUrl));
        }
        return r;
    }
    _lrrSearchScope(e, t) {
        const r = t && "object" == typeof t ? t : {}, a = [ "filter", "sortby", "order", "newonly", "untaggedonly", "groupby_tanks", "category" ], o = [ String(e || "") ];
        for (const e of a) o.push(null == r[e] ? "" : String(r[e]));
        return o.join("");
    }
    _lrrPageSizeKey(e) {
        return `lrr_page_size_${this._serverStamp()}_${e}`;
    }
    _readLrrPageSize(e) {
        if ("function" != typeof this.loadData) return null;
        const t = Number(this.loadData(this._lrrPageSizeKey(e)));
        return Number.isInteger(t) && t >= 1 ? t : null;
    }
    _storeLrrPageSize(e, t) {
        "function" == typeof this.saveData && (!Number.isInteger(t) || t < 1 || this.saveData(this._lrrPageSizeKey(e), t));
    }
    _fullLrrPageSize(e, t, r) {
        return t > 0 && "number" == typeof r && e + t < r ? t : null;
    }
    _lrrMaxPage(e, t, r, a) {
        return 0 === r ? 1 : "number" == typeof r && Number.isInteger(a) && a >= 1 ? Math.max(1, Math.ceil(r / a)) : "number" == typeof r ? 1 : t > 0 ? e + 1 : Math.max(1, e > 1 ? e - 1 : 1);
    }
    async _fetchLrrSearch(e, t) {
        const r = buildSelfHostedUrlFromSource(this, LRR_ROUTES.searchPath, Object.assign({}, e, {
            start: String(t)
        })), a = await Network.get(r, this.headers);
        if (!a || 200 !== a.status) throw `Invalid status code: ${a ? a.status : 0}`;
        let o;
        try {
            o = JSON.parse(a.body);
        } catch (e) {
            throw "Invalid LANraragi search response.";
        }
        return o && "object" == typeof o && !Array.isArray(o) || (o = {}), {
            data: o,
            list: Array.isArray(o.data) ? o.data : [],
            total: "number" == typeof o.recordsFiltered && o.recordsFiltered >= 0 ? o.recordsFiltered : null
        };
    }
    async _packArchivePage(e, t, r) {
        if (!t) {
            const t = e.list.map(e => this._mapArchiveComic(e, this.baseUrl));
            return {
                comics: await this._decorateListedComics(t),
                maxPage: r
            };
        }
        return {
            comics: await this._collapseTankItems(e.list),
            maxPage: r
        };
    }
    async _loadArchivePage(e, t, r, a) {
        const o = Number(e), i = Number.isInteger(o) && o >= 1 ? o : 1, s = this._lrrSearchScope(t, r);
        let n = this._readLrrPageSize(s);
        if (i > 1 && !n) {
            const e = await this._fetchLrrSearch(r, 0), t = this._fullLrrPageSize(0, e.list.length, e.total);
            if (!t) return this._packArchivePage({
                data: e.data,
                list: []
            }, a, 1);
            if (this._storeLrrPageSize(s, t), n = t, (i - 1) * n >= e.total) return this._packArchivePage({
                data: e.data,
                list: []
            }, a, Math.max(1, Math.ceil(e.total / n)));
        }
        const l = i <= 1 ? 0 : (i - 1) * n;
        let u = await this._fetchLrrSearch(r, l);
        const c = this._fullLrrPageSize(l, u.list.length, u.total);
        if (c && c !== n) {
            if (this._storeLrrPageSize(s, c), n && i > 1) {
                const e = (i - 1) * c;
                if (e !== l) {
                    u = await this._fetchLrrSearch(r, e);
                    const t = this._fullLrrPageSize(e, u.list.length, u.total);
                    t && t !== c && this._storeLrrPageSize(s, t);
                }
            }
            n = c;
        } else c && (this._storeLrrPageSize(s, c), n = c);
        return this._packArchivePage(u, a, this._lrrMaxPage(i, u.list.length, u.total, n));
    }
    _toStarsFromValue(e) {
        if (null == e) return null;
        const t = String(e).trim();
        if (0 === t.length) return null;
        if (t.includes("⭐") || t.includes("★")) {
            const e = (t.match(/⭐/g) || t.match(/★/g) || []).length;
            if (e >= 0) return Math.max(0, Math.min(5, e));
        }
        if (t.includes("/")) {
            const e = t.split("/"), r = parseFloat(e[0]), a = parseFloat(e[1]) || 10;
            if (!isNaN(r) && !isNaN(a) && a > 0) {
                const e = r / a * 5;
                return Math.round(2 * e) / 2;
            }
        }
        if (t.includes("%")) {
            const e = parseFloat(t.replace("%", ""));
            if (!isNaN(e)) {
                const t = e / 100 * 5;
                return Math.round(2 * t) / 2;
            }
        }
        const r = parseFloat(t);
        if (isNaN(r)) return null;
        if (r > 5) {
            const e = r / 2;
            return Math.round(2 * e) / 2;
        }
        return Math.round(2 * r) / 2;
    }
    _extractRatingFromTags(e) {
        return parseSelfHostedRatingValueFromTags(e, {
            prefix: LRR_TAG_PREFIXES.rating,
            caseSensitive: !1,
            starSymbols: [ "⭐", "★" ]
        });
    }
    _tagsToArray(e) {
        return toSelfHostedTagArray(e);
    }
    _cleanListTags(e) {
        return filterSelfHostedDisplayTags(e, {
            blockedPrefixes: LRR_TAG_FILTER_PREFIXES,
            caseSensitive: !1,
            excludeUrlLike: !0
        });
    }
    async init() {
        let e = "";
        try {
            e = this._serverStamp();
            const t = buildSelfHostedUrlFromSource(this, LRR_ROUTES.categoriesPath()), r = await Network.get(t, this.headers);
            if (this._serverStamp() !== e) return;
            if (200 !== r.status) return this._saveScopedList("categories", e, []), void this._saveScopedList("favorites", e, []);
            let a = [];
            try {
                a = JSON.parse(r.body);
            } catch (e) {
                a = [];
            }
            Array.isArray(a) || (a = []), this._saveScopedList("categories", e, a), this.saveData("categories_ts", Date.now());
            const o = a.filter(e => e && ("" === e.search || null === e.search || void 0 === e.search));
            this._saveScopedList("favorites", e, o), this.saveData("favorites_ts", Date.now());
        } catch (t) {
            e && this._serverStamp() === e && (this._saveScopedList("categories", e, []), this._saveScopedList("favorites", e, []));
        }
    }
    async _loadTankInfo(e) {
        const t = String(e || "");
        if (!isLrrTankId(t)) throw "Invalid LANraragi tankoubon ID.";
        const r = buildSelfHostedUrlFromSource(this, `/api/tankoubons/${t}`), a = await Network.get(r, this.headers);
        if (200 !== a.status) throw `Invalid status code: ${a.status}`;
        const o = JSON.parse(a.body), i = o && Array.isArray(o.archives) ? o.archives : [], s = [], n = {};
        for (const e of i) {
            if (!isLrrArchiveId(e)) continue;
            const t = String(e).toLowerCase();
            if (!Object.prototype.hasOwnProperty.call(n, t) && (n[t] = !0, s.push(t), s.length >= 2e3)) break;
        }
        if (!s.length) throw "LANraragi tankoubon has no chapters.";
        this._tankChapters || (this._tankChapters = Object.create(null)), this._tankChapters[t] = s;
        const l = {}, u = s.slice(0, 40);
        await Promise.all(u.map(async (e, t) => {
            l[e] = "Chapter " + (t + 1);
            try {
                const t = buildSelfHostedUrlFromSource(this, LRR_ROUTES.archiveMetadataPath(e)), r = await Network.get(t, this.headers);
                if (200 !== r.status) return;
                const a = JSON.parse(r.body);
                a && "string" == typeof a.title && a.title.trim() && (l[e] = a.title.trim().slice(0, 300));
            } catch (e) {}
        }));
        const c = {};
        for (let e = 0; e < s.length; e++) {
            const t = s[e];
            c[t] = l[t] || "Chapter " + (e + 1);
        }
        const d = buildSelfHostedUrlFromSource(this, LRR_ROUTES.archiveThumbnailPath(s[0]));
        return {
            title: o && (o.name || o.title) || t,
            cover: d,
            description: o && o.summary || "",
            tags: {},
            stars: 0,
            chapters: c,
            isFavorite: !1,
            folders: []
        };
    }
    _imageBelongs(e, t, r) {
        const a = String(r || "").toLowerCase(), o = String(t || ""), i = String(e || "");
        if (isLrrArchiveId(o) && o.toLowerCase() !== a) return !1;
        if (isLrrArchiveId(i)) return i.toLowerCase() === a;
        if (!isLrrTankId(i)) return !1;
        const s = this._tankChapters && this._tankChapters[i];
        if (s) return s.indexOf(a) >= 0;
        const n = this._memberTank && this._memberTank[a];
        if (n) return n === i;
        const l = this._tankCover && this._tankCover[i];
        return l ? l === a : isLrrArchiveId(o) && o.toLowerCase() === a;
    }
}

function runtimeGet(e, t) {
    return Network.get(e, t);
}

async function getRuntimeJson(e, t, r) {
    const a = await runtimeGet(e, t);
    return assertRuntimeStatus(a, 200, r || e), parseRuntimeJsonBody(a, r || e);
}

async function getRuntimeDocument(e, t, r) {
    const a = await runtimeGet(e, t);
    return assertRuntimeStatus(a, 200, r || e), new HtmlDocument(a.body);
}

async function getSelfHostedJson(e, t, r, a) {
    if (!e || "object" != typeof e) throw new Error("getSelfHostedJson requires plugin source");
    const o = a && "object" == typeof a && !Array.isArray(a) ? a : {}, i = o.headers || e.headers, s = await Network.get(e.buildUrl(t, r), i);
    return ensureSelfHostedHttpOk(s, o), parseSelfHostedJsonBody(s.body);
}

async function postSelfHostedJson(e, t, r, a, o) {
    if (!e || "object" != typeof e) throw new Error("postSelfHostedJson requires plugin source");
    const i = o && "object" == typeof o && !Array.isArray(o) ? o : {}, s = i.headers || e.headers, n = await Network.post(e.buildUrl(t, r), s, a);
    return ensureSelfHostedHttpOk(n, i), {
        body: parseSelfHostedJsonBody(n.body),
        headers: n.headers || {}
    };
}

function defaultManagedDomainKey(e) {
    try {
        return new URL(String(e || "")).hostname || "default";
    } catch (e) {
        return "default";
    }
}

function defaultManagedDispatch(e, t, r, a) {
    return "GET" === e ? Network.get(t, r) : "POST" === e ? Network.post(t, r, a) : Network.sendRequest(e, t, r, a);
}

function defaultManagedRequestError(e, t, r) {
    return e && "function" == typeof e.formatRequestError ? e.formatRequestError(t, r) : `${t}: ${String(r)}`;
}

function defaultManagedResponseError(e, t, r) {
    return e && "function" == typeof e.formatResponseError ? e.formatResponseError(t, r) : `${t}: status=${r && r.status}`;
}

function normalizeManagedRequestHooks(e) {
    return e && "object" == typeof e && !Array.isArray(e) ? e : {};
}

function ManagedRequestClient(e, t) {
    if (!e || "object" != typeof e) throw new Error("ManagedRequestClient requires plugin source");
    if (!e.requestState || "object" != typeof e.requestState) throw new Error("ManagedRequestClient requires source.requestState");
    this.source = e, this.hooks = normalizeManagedRequestHooks(t);
}

function createManagedRequestClient(e, t) {
    return new ManagedRequestClient(e, t);
}

function parseRuntimeJsonBody(e, t) {
    try {
        return JSON.parse(e.body);
    } catch (e) {
        throw "Invalid JSON response" + (t ? ` (${t})` : "");
    }
}

function ensureSelfHostedHttpOk(e, t) {
    const r = t && "object" == typeof t && !Array.isArray(t) ? t : {}, a = r.unauthorizedMessage || "Login expired", o = r.requestFailedMessage || "请求失败";
    if (!e) throw o;
    if (401 === e.status || 403 === e.status) throw a;
    if (e.status < 200 || e.status >= 300) throw `${o}: ${e.status}`;
}

function parseSelfHostedJsonBody(e) {
    return e ? JSON.parse(e) : null;
}

function hasNonWhitespaceText(e) {
    const t = String(e || "");
    for (let e = 0; e < t.length; e += 1) {
        const r = t.charCodeAt(e);
        if (32 !== r && 9 !== r && 10 !== r && 13 !== r) return !0;
    }
    return !1;
}

function defaultRequestKey(e, t, r, a) {
    return a ? null : `${e}:${t}`;
}

function createDomainQueue(e, t, r) {
    const a = (e.queues.get(t) || Promise.resolve()).then(r, r), o = a.then(() => {}, () => {});
    return e.queues.set(t, o), o.finally(() => {
        e.queues.get(t) === o && e.queues.delete(t);
    }), a;
}

function markCooldown(e, t, r) {
    e.cooldownUntil.set(t, Date.now() + r);
}

ManagedRequestClient.prototype.get = function(e, t, r) {
    return this.send("GET", e, t || {}, null, r || {});
}, ManagedRequestClient.prototype.post = function(e, t, r, a) {
    return this.send("POST", e, t || {}, null == r ? null : r, a || {});
}, ManagedRequestClient.prototype.head = function(e, t, r) {
    return this.send("HEAD", e, t || {}, null, r || {});
}, ManagedRequestClient.prototype.send = async function(e, t, r, a, o) {
    const i = this.source, s = o && "object" == typeof o && !Array.isArray(o) ? o : {}, n = null == s.mutation ? "GET" !== e : !0 === s.mutation, l = s.requestKey || defaultRequestKey(e, t, a, n), u = "function" == typeof this.hooks.domainKeyResolver ? this.hooks.domainKeyResolver : defaultManagedDomainKey, c = {
        action: s.action || `${e} ${t}`,
        requestKey: l,
        domainKey: s.domainKey || u(t, e, a, s, i, this),
        expectedStatus: null == s.expectedStatus ? 200 : s.expectedStatus,
        maxRetries: null == s.maxRetries ? "GET" === e ? 1 : 0 : s.maxRetries,
        cooldownMs: null == s.cooldownMs ? 6e4 : s.cooldownMs,
        classifyBody: null == s.classifyBody || s.classifyBody,
        mutation: n,
        allowDedup: null == s.allowDedup ? !n : s.allowDedup
    }, d = i.requestState.cooldownUntil.get(c.domainKey);
    if (d && d > Date.now()) throw `${c.action} blocked: temporary cooldown in effect`;
    const p = this._resolveHeaders(e, t, r || {}, c), h = c.requestKey;
    if (c.allowDedup && h && i.requestState.inflight.has(h)) return i.requestState.inflight.get(h);
    const g = createDomainQueue(i.requestState, c.domainKey, () => this._sendWithRetry(e, t, p, a, c));
    c.allowDedup && h && i.requestState.inflight.set(h, g);
    try {
        return await g;
    } finally {
        c.allowDedup && h && i.requestState.inflight.delete(h);
    }
}, ManagedRequestClient.prototype._resolveHeaders = function(e, t, r, a) {
    return "function" == typeof this.hooks.buildHeaders ? this.hooks.buildHeaders(e, t, r, a, this.source, this) : this.source && "function" == typeof this.source.buildRequestHeaders ? this.source.buildRequestHeaders(e, t, r || {}, a || {}) : r || {};
}, ManagedRequestClient.prototype._sendWithRetry = async function(e, t, r, a, o) {
    let i = 0;
    const s = Math.max(0, o.maxRetries) + 1;
    for (;i < s; ) {
        let n;
        i += 1;
        try {
            n = await this._dispatch(e, t, r, a, o);
        } catch (e) {
            if (i >= s) throw defaultManagedRequestError(this.source, o.action, e);
            continue;
        }
        if (this._shouldCooldown(n, o)) throw this._markCooldown(o.domainKey, o.cooldownMs),
        defaultManagedResponseError(this.source, o.action, n);
        if (n.status === o.expectedStatus) return n;
        if (i >= s || o.mutation) throw defaultManagedResponseError(this.source, o.action, n);
    }
    throw `${o.action} failed after retries`;
}, ManagedRequestClient.prototype._dispatch = function(e, t, r, a, o) {
    return "function" == typeof this.hooks.dispatch ? this.hooks.dispatch(e, t, r, a, o, this.source, this) : defaultManagedDispatch(e, t, r, a);
}, ManagedRequestClient.prototype._shouldCooldown = function(e, t) {
    if (403 === e.status || 429 === e.status) return !0;
    if (!t.classifyBody) return !1;
    const r = String(e && e.body || "");
    return !!hasNonWhitespaceText(r) && ("function" == typeof this.hooks.shouldCooldown ? this.hooks.shouldCooldown(e, t, this.source, this) : !(!this.source || "function" != typeof this.source.isAbuseResponseBody) && this.source.isAbuseResponseBody(r));
}, ManagedRequestClient.prototype._markCooldown = function(e, t) {
    markCooldown(this.source.requestState, e, t);
}, "undefined" != typeof module && module && module.exports && (module.exports = {
    runtimeGet,
    getRuntimeJson,
    getRuntimeDocument,
    getSelfHostedJson,
    postSelfHostedJson,
    ManagedRequestClient,
    createManagedRequestClient
}), "undefined" != typeof module && module && module.exports && (module.exports = {
    parseRuntimeJsonBody,
    ensureSelfHostedHttpOk,
    parseSelfHostedJsonBody
}), "undefined" != typeof module && module && module.exports && (module.exports = {
    hasNonWhitespaceText,
    defaultRequestKey,
    createDomainQueue,
    markCooldown
});

const httpRequestApi = {
    runtimeGet,
    getRuntimeJson,
    getRuntimeDocument,
    getSelfHostedJson,
    postSelfHostedJson,
    ManagedRequestClient,
    createManagedRequestClient
}, httpResponseApi = {
    parseRuntimeJsonBody,
    ensureSelfHostedHttpOk,
    parseSelfHostedJsonBody
}, httpCooldownApi = {
    hasNonWhitespaceText,
    defaultRequestKey,
    createDomainQueue,
    markCooldown
}, httpSupportApi = {
    ...httpRequestApi,
    ...httpResponseApi,
    ...httpCooldownApi
};

function withAuthorization(e, t, r) {
    const a = {
        ...e || {}
    };
    return r ? (a.Authorization = `${t} ${r}`, a) : a;
}

function withBearer(e, t) {
    return withAuthorization(e, "Bearer", t);
}

function withBasic(e, t) {
    return withAuthorization(e, "Basic", t);
}

function encodeSelfHostedToken(e) {
    const t = String(e || "");
    if (!t) return "";
    const r = Convert.encodeBase64(Convert.encodeUtf8(t));
    return "string" == typeof r ? r : Convert.decodeUtf8(r);
}

function normalizeCookieUrl(e) {
    return String(e || "").trim().replace(/\/+$/, "");
}

function redactSecretValue(e) {
    const t = String(e || "");
    return t.length <= 4 ? t ? "****" : "" : `${t.slice(0, 2)}****${t.slice(-2)}`;
}

"undefined" != typeof module && module && module.exports && (module.exports = {
    runtimeGet,
    getRuntimeJson,
    getRuntimeDocument,
    getSelfHostedJson,
    postSelfHostedJson,
    ManagedRequestClient,
    createManagedRequestClient,
    parseRuntimeJsonBody,
    ensureSelfHostedHttpOk,
    parseSelfHostedJsonBody,
    hasNonWhitespaceText,
    defaultRequestKey,
    createDomainQueue,
    markCooldown,
    httpRequestApi,
    httpResponseApi,
    httpCooldownApi,
    httpSupportApi
}), "undefined" != typeof module && module && module.exports && (module.exports = {
    withAuthorization,
    withBearer,
    withBasic,
    encodeSelfHostedToken
}), "undefined" != typeof module && module && module.exports && (module.exports = {
    normalizeCookieUrl
}), "undefined" != typeof module && module && module.exports && (module.exports = {
    redactSecretValue
});

const securitySecretsApi = {
    withAuthorization,
    withBearer,
    withBasic,
    encodeSelfHostedToken
}, securityCookiesApi = {
    normalizeCookieUrl
}, securityRedactionApi = {
    redactSecretValue
}, securitySupportApi = {
    ...securitySecretsApi,
    ...securityCookiesApi,
    ...securityRedactionApi
};

function buildOffsetByPage(e, t) {
    return ((Number.isFinite(Number(e)) ? Math.max(1, Number(e)) : 1) - 1) * (Number.isFinite(Number(t)) ? Math.max(1, Number(t)) : 1);
}

function normalizeStarOption(e) {
    return String(null == e ? "" : e).replace("*", "-");
}

function normalizeStarOptions(e) {
    return Array.isArray(e) ? e.map(e => normalizeStarOption(e)) : [];
}

function stripSelfHostedTrailingSlash(e) {
    return String(e || "").replace(/\/+$/, "");
}

function normalizeSelfHostedPathRoot(e, t) {
    const r = String(e || t || "").trim();
    return r ? `/${r.replace(/^\/+/, "").replace(/\/+$/, "")}` : "";
}

function normalizeSelfHostedPathSegment(e) {
    return String(null == e ? "" : e).replace(/^\/+|\/+$/g, "");
}

function joinSelfHostedPath(e, t) {
    const r = normalizeSelfHostedPathRoot(e, "/"), a = Array.isArray(t) ? t : [];
    let o = r;
    for (const e of a) {
        const t = normalizeSelfHostedPathSegment(e);
        t && (o = `${o}/${t}`);
    }
    return o;
}

function createSelfHostedRouteHelpers(e) {
    const t = e && "object" == typeof e && !Array.isArray(e) ? e : {}, r = normalizeSelfHostedPathRoot(t.apiRoot, "/api"), a = normalizeSelfHostedPathRoot(t.archivesRoot, `${r}/archives`), o = normalizeSelfHostedPathRoot(t.categoriesRoot, `${r}/categories`), i = normalizeSelfHostedPathRoot(t.searchPath, `${r}/search`);
    return {
        apiRoot: r,
        archivesRoot: a,
        categoriesRoot: o,
        searchPath: i,
        categoriesPath: () => o,
        categoryArchivePath: (e, t) => joinSelfHostedPath(o, [ e, t ]),
        archivePath: e => joinSelfHostedPath(a, [ e ]),
        archiveMetadataPath: e => joinSelfHostedPath(a, [ e, "metadata" ]),
        archiveThumbnailPath: e => joinSelfHostedPath(a, [ e, "thumbnail" ]),
        archiveCategoriesPath: e => joinSelfHostedPath(a, [ e, "categories" ]),
        archiveFilesPath: e => joinSelfHostedPath(a, [ e, "files" ])
    };
}

function normalizeWebSourceBaseUrl(e, t) {
    const r = t && "object" == typeof t && !Array.isArray(t) ? t : {}, a = "string" == typeof r.defaultScheme ? r.defaultScheme.trim() : "";
    let o = String(e || "").trim();
    return o ? (a && !/^https?:\/\//i.test(o) && (o = `${a.replace(/:$/, "")}://${o}`),
    o.replace(/\/+$/, "")) : "";
}

function normalizeWebSourcePath(e, t) {
    const r = String(null == e ? t || "" : e).trim();
    return r ? /^https?:\/\//i.test(r) || r.startsWith("//") || r.startsWith("/") ? r : `/${r}` : "";
}

function joinWebSourcePath(e, t) {
    const r = normalizeWebSourcePath(e, "/"), a = Array.isArray(t) ? t : [];
    let o = r;
    for (const e of a) {
        const t = String(null == e ? "" : e).trim().replace(/^\/+|\/+$/g, "");
        t && (o = `${o}/${t}`);
    }
    return o;
}

function buildWebSourceQuery(e) {
    if (!e || "object" != typeof e) return "";
    const t = [];
    for (const r of Object.keys(e)) {
        const a = e[r];
        if (null != a && "" !== a) if (Array.isArray(a)) for (const e of a) null != e && "" !== e && t.push(`${encodeURIComponent(r)}=${encodeURIComponent(String(e))}`); else t.push(`${encodeURIComponent(r)}=${encodeURIComponent(String(a))}`);
    }
    return t.join("&");
}

function buildWebSourceUrl(e, t, r) {
    const a = normalizeWebSourceBaseUrl(e || ""), o = normalizeWebSourcePath(t, "");
    let i = o;
    /^https?:\/\//i.test(o) || o.startsWith("//") || (i = o ? `${a}${o.startsWith("/") ? "" : "/"}${o}` : a);
    const s = buildWebSourceQuery(r);
    return s ? `${i}${i.includes("?") ? "&" : "?"}${s}` : i;
}

function toWebSourceAbsoluteUrl(e, t) {
    const r = String(e || "").trim();
    return r ? /^https?:\/\//i.test(r) ? r : r.startsWith("//") ? `${normalizeWebSourceBaseUrl(t || "", {
        defaultScheme: "https"
    }).startsWith("http://") ? "http:" : "https:"}${r}` : buildWebSourceUrl(t, r) : "";
}

function replaceWebSourceBaseUrl(e, t, r) {
    const a = String(e || "").trim(), o = normalizeWebSourceBaseUrl(t || ""), i = normalizeWebSourceBaseUrl(r || "");
    return a && o && i ? a === o ? i : a.startsWith(`${o}/`) ? `${i}${a.slice(o.length)}` : a : a;
}

function ensureWebSourceTrailingSlash(e) {
    const t = String(e || "").trim();
    return t ? t.endsWith("/") ? t : `${t}/` : t;
}

function normalizeSelfHostedBaseUrl(e) {
    const t = String(e || "").trim();
    return t ? t.replace(/\/+$/, "") : "";
}

function normalizeSelfHostedRoutePath(e, t) {
    const r = String(null == e ? t || "" : e).trim();
    if (!r) return "";
    const a = r.replace(/\/+$/, "");
    return a.startsWith("/") ? a : `/${a}`;
}

function joinSelfHostedRoutePath(e, t) {
    const r = normalizeSelfHostedRoutePath(e, "/"), a = Array.isArray(t) ? t : [];
    let o = r;
    for (const e of a) {
        const t = String(null == e ? "" : e).trim().replace(/^\/+|\/+$/g, "");
        t && (o = `${o}/${t}`);
    }
    return o;
}

function createKomgaRouteHelpers(e) {
    const t = e && "object" == typeof e && !Array.isArray(e) ? e : {}, r = normalizeSelfHostedRoutePath(t.apiV1Root, "/api/v1"), a = normalizeSelfHostedRoutePath(t.apiV2Root, "/api/v2"), o = normalizeSelfHostedRoutePath(t.seriesWebRoot, "/series"), i = normalizeSelfHostedRoutePath(t.booksWebRoot, "/books"), s = joinSelfHostedRoutePath(r, [ "series" ]), n = joinSelfHostedRoutePath(r, [ "books" ]), l = joinSelfHostedRoutePath(r, [ "collections" ]);
    return {
        apiV1Root: r,
        apiV2Root: a,
        seriesWebRoot: o,
        booksWebRoot: i,
        librariesPath: () => joinSelfHostedRoutePath(r, [ "libraries" ]),
        seriesTagsPath: () => joinSelfHostedRoutePath(r, [ "tags", "series" ]),
        languagesPath: () => joinSelfHostedRoutePath(r, [ "languages" ]),
        collectionsPath: () => l,
        genresPath: () => joinSelfHostedRoutePath(r, [ "genres" ]),
        currentUserPath: () => joinSelfHostedRoutePath(a, [ "users", "me" ]),
        seriesPath: () => s,
        latestSeriesPath: () => joinSelfHostedRoutePath(s, [ "latest" ]),
        updatedSeriesPath: () => joinSelfHostedRoutePath(s, [ "updated" ]),
        collectionSeriesPath: e => joinSelfHostedRoutePath(l, [ e, "series" ]),
        seriesDetailsPath: e => joinSelfHostedRoutePath(s, [ e ]),
        seriesBooksPath: e => joinSelfHostedRoutePath(s, [ e, "books" ]),
        seriesThumbnailPath: e => joinSelfHostedRoutePath(s, [ e, "thumbnail" ]),
        seriesWebPath: e => joinSelfHostedRoutePath(o, [ e ]),
        bookDetailsPath: e => joinSelfHostedRoutePath(n, [ e ]),
        bookThumbnailPath: e => joinSelfHostedRoutePath(n, [ e, "thumbnail" ]),
        bookPagesPath: e => joinSelfHostedRoutePath(n, [ e, "pages" ]),
        bookPageImagePath: (e, t) => joinSelfHostedRoutePath(n, [ e, "pages", t ]),
        bookWebPath: e => joinSelfHostedRoutePath(i, [ e ])
    };
}

function createKavitaRouteHelpers(e) {
    const t = e && "object" == typeof e && !Array.isArray(e) ? e : {}, r = normalizeSelfHostedRoutePath(t.apiRoot, "/api"), a = normalizeSelfHostedRoutePath(t.libraryRoot, `${r}/Library`), o = normalizeSelfHostedRoutePath(t.metadataRoot, `${r}/Metadata`), i = normalizeSelfHostedRoutePath(t.metadataLegacyRoot, `${r}/metadata`), s = normalizeSelfHostedRoutePath(t.accountRoot, `${r}/Account`), n = normalizeSelfHostedRoutePath(t.seriesRoot, `${r}/Series`), l = normalizeSelfHostedRoutePath(t.imageRoot, `${r}/Image`), u = normalizeSelfHostedRoutePath(t.readerRoot, `${r}/Reader`), c = normalizeSelfHostedRoutePath(t.searchRoot, `${r}/Search`);
    return {
        apiRoot: r,
        libraryRoot: a,
        metadataRoot: o,
        metadataLegacyRoot: i,
        accountRoot: s,
        seriesRoot: n,
        imageRoot: l,
        readerRoot: u,
        searchRoot: c,
        librariesPath: () => joinSelfHostedRoutePath(a, [ "libraries" ]),
        genresPath: () => joinSelfHostedRoutePath(o, [ "genres" ]),
        peopleByRolePath: () => joinSelfHostedRoutePath(i, [ "people-by-role" ]),
        loginPath: () => joinSelfHostedRoutePath(s, [ "login" ]),
        seriesV2Path: () => joinSelfHostedRoutePath(n, [ "v2" ]),
        seriesDetailsPath: e => joinSelfHostedRoutePath(n, [ e ]),
        seriesMetadataPath: () => joinSelfHostedRoutePath(n, [ "metadata" ]),
        seriesVolumesPath: () => joinSelfHostedRoutePath(n, [ "volumes" ]),
        seriesCoverPath: () => joinSelfHostedRoutePath(l, [ "series-cover" ]),
        chapterPath: () => joinSelfHostedRoutePath(n, [ "chapter" ]),
        readerImagePath: () => joinSelfHostedRoutePath(u, [ "image" ]),
        searchPath: () => joinSelfHostedRoutePath(c, [ "search" ])
    };
}

function resolveSelfHostedBaseUrl(e, t, r) {
    const a = r && "object" == typeof r && !Array.isArray(r) ? r : {}, o = "string" == typeof t ? t : "";
    let i = normalizeSelfHostedBaseUrl("string" == typeof e && e.trim() ? e.trim() : o);
    if (!i) return i;
    const s = "string" == typeof a.defaultScheme ? a.defaultScheme.trim() : "";
    return s && !/^https?:\/\//i.test(i) && (i = `${s.replace(/:$/, "")}://${i}`), normalizeSelfHostedBaseUrl(i);
}

function buildSelfHostedQuery(e) {
    if (!e) return "";
    const t = [];
    for (const r of Object.keys(e)) {
        const a = e[r];
        if (null != a) if (Array.isArray(a)) for (const e of a) null != e && t.push(`${encodeURIComponent(r)}=${encodeURIComponent(String(e))}`); else t.push(`${encodeURIComponent(r)}=${encodeURIComponent(String(a))}`);
    }
    return t.join("&");
}

function buildSelfHostedUrl(e, t, r) {
    let a = t;
    /^https?:\/\//i.test(t) || (a = `${normalizeSelfHostedBaseUrl(e || "")}${String(t).startsWith("/") ? "" : "/"}${t}`);
    const o = buildSelfHostedQuery(r);
    return o ? `${a}?${o}` : a;
}

function buildSelfHostedUrlFromSource(e, t, r) {
    if (!e || "object" != typeof e) throw new Error("buildSelfHostedUrlFromSource requires plugin source");
    return buildSelfHostedUrl(e.baseUrl, t, r);
}

function buildSelfHostedQueryFromSource(e) {
    return buildSelfHostedQuery(e);
}

function readSelfHostedOffset(e, t, r) {
    if (!e || "object" != typeof e) throw new Error("readSelfHostedOffset requires plugin source");
    return Number(r || 1) <= 1 ? (e.saveData(t, 0), 0) : Number(e.loadData(t) || 0);
}

function updateSelfHostedOffset(e, t, r) {
    if (!e || "object" != typeof e) throw new Error("updateSelfHostedOffset requires plugin source");
    const a = Number(e.loadData(t) || 0);
    e.saveData(t, a + (r || 0));
}

"undefined" != typeof module && module && module.exports && (module.exports = {
    withAuthorization,
    withBearer,
    withBasic,
    encodeSelfHostedToken,
    normalizeCookieUrl,
    redactSecretValue,
    securitySecretsApi,
    securityCookiesApi,
    securityRedactionApi,
    securitySupportApi
}), "undefined" != typeof module && module && module.exports && (module.exports = {
    buildOffsetByPage,
    normalizeStarOption,
    normalizeStarOptions
}), "undefined" != typeof module && module && module.exports && (module.exports = {
    stripSelfHostedTrailingSlash,
    normalizeSelfHostedPathRoot,
    normalizeSelfHostedPathSegment,
    joinSelfHostedPath,
    createSelfHostedRouteHelpers
}), "undefined" != typeof module && module && module.exports && (module.exports = {
    normalizeWebSourceBaseUrl,
    normalizeWebSourcePath,
    joinWebSourcePath,
    buildWebSourceQuery,
    buildWebSourceUrl,
    toWebSourceAbsoluteUrl,
    replaceWebSourceBaseUrl,
    ensureWebSourceTrailingSlash
}), "undefined" != typeof module && module && module.exports && (module.exports = {
    normalizeSelfHostedBaseUrl,
    normalizeSelfHostedRoutePath,
    joinSelfHostedRoutePath,
    createKomgaRouteHelpers,
    createKavitaRouteHelpers,
    resolveSelfHostedBaseUrl,
    buildSelfHostedQuery,
    buildSelfHostedUrl
}), "undefined" != typeof module && module && module.exports && (module.exports = {
    buildSelfHostedUrlFromSource,
    buildSelfHostedQueryFromSource,
    readSelfHostedOffset,
    updateSelfHostedOffset
});

const pluginSourcePagingApi = {
    buildOffsetByPage,
    normalizeStarOption,
    normalizeStarOptions
}, pluginSourceWebApi = {
    normalizeWebSourceBaseUrl,
    normalizeWebSourcePath,
    joinWebSourcePath,
    buildWebSourceQuery,
    buildWebSourceUrl,
    toWebSourceAbsoluteUrl,
    replaceWebSourceBaseUrl,
    ensureWebSourceTrailingSlash
}, pluginSourceSelfHostedPathApi = {
    stripSelfHostedTrailingSlash,
    normalizeSelfHostedPathRoot,
    normalizeSelfHostedPathSegment,
    joinSelfHostedPath,
    createSelfHostedRouteHelpers
}, pluginSourceSelfHostedRouteApi = {
    normalizeSelfHostedBaseUrl,
    normalizeSelfHostedRoutePath,
    joinSelfHostedRoutePath,
    createKomgaRouteHelpers,
    createKavitaRouteHelpers,
    resolveSelfHostedBaseUrl,
    buildSelfHostedQuery,
    buildSelfHostedUrl,
    buildSelfHostedUrlFromSource,
    buildSelfHostedQueryFromSource,
    readSelfHostedOffset,
    updateSelfHostedOffset
}, pluginSourceContractApi = {
    ...pluginSourcePagingApi,
    ...pluginSourceWebApi,
    ...pluginSourceSelfHostedPathApi,
    ...pluginSourceSelfHostedRouteApi
};

function resolveMappedCategoryTagAction(e, t, r) {
    const a = r && "object" == typeof r && !Array.isArray(r) ? r : {}, o = null == a.namespace ? "标签" : String(a.namespace);
    if (String(e) !== o) throw a.unsupportedMessage || "Unsupported tag namespace";
    const i = a.mapping && "object" == typeof a.mapping ? a.mapping : {}, s = String(null == t ? "" : t), n = i[s], l = "function" == typeof a.keywordFormatter ? a.keywordFormatter(s, n, e) : s, u = "function" == typeof a.paramFormatter ? a.paramFormatter(s, n, e) : String(n);
    return {
        action: a.action || "category",
        keyword: l,
        param: u
    };
}

function createMappedCategoryTagActionResolver(e) {
    return (t, r) => resolveMappedCategoryTagAction(t, r, e);
}

function createSelfHostedReferenceCacheFeature(e) {
    const t = e && "object" == typeof e && !Array.isArray(e) ? e : {}, r = Number(t.ttlMs || 3e5), a = String(t.metaTimestampKey || ""), o = t.resetData && "object" == typeof t.resetData ? t.resetData : {}, i = "function" == typeof t.hasToken ? t.hasToken : () => !1, s = "function" == typeof t.loadPayload ? t.loadPayload : null, n = "function" == typeof t.savePayload ? t.savePayload : null, l = "function" == typeof t.shouldRethrow ? t.shouldRethrow : null;
    if (!a || !s || !n) throw new Error("Invalid createSelfHostedReferenceCacheFeature options");
    const u = e => {
        for (const [t, r] of Object.entries(o)) Array.isArray(r) ? e.saveData(t, r.slice()) : r && "object" == typeof r ? e.saveData(t, {
            ...r
        }) : e.saveData(t, r);
    };
    return async function(e, t) {
        if (!e || "object" != typeof e) throw new Error("refreshSelfHostedReferenceData requires plugin source");
        if (!i(e)) return void u(e);
        const o = Date.now(), c = Number(e.loadData(a) || 0);
        if (!(!t && c > 0 && o - c < r)) try {
            const t = await s(e);
            await n(e, t, o), e.saveData(a, o);
        } catch (t) {
            if (u(e), l && l(t, e)) throw t;
        }
    };
}

function createSafeInitFeature(e) {
    if ("function" != typeof e) throw new Error("createSafeInitFeature requires refresher");
    return async function(t) {
        try {
            await e(t, !1);
        } catch (e) {}
    };
}

function createStaticCategoryPart(e, t, r, a) {
    return {
        name: e,
        type: "dynamic",
        loader: function() {
            return [ {
                label: t,
                target: {
                    page: "category",
                    attributes: {
                        category: r,
                        param: null == a ? null : a
                    }
                }
            } ];
        }
    };
}

function createStoredCategoryPart(e) {
    const t = e && "object" == typeof e && !Array.isArray(e) ? e : {}, r = String(t.partName || ""), a = String(t.storageKey || ""), o = "function" == typeof t.getLabel ? t.getLabel : null, i = "function" == typeof t.getCategory ? t.getCategory : null, s = "function" == typeof t.getParam ? t.getParam : null, n = !0 === t.usePageJumpTarget, l = "function" == typeof t.getSource ? t.getSource : null;
    if (!(r && a && o && i && s)) throw new Error("Invalid createStoredCategoryPart options");
    return {
        name: r,
        type: "dynamic",
        loader: function() {
            const e = l ? l() : this, t = e && "function" == typeof e.loadData ? e.loadData(a) : null;
            if (!Array.isArray(t) || !t.length) return [];
            const r = [];
            for (const e of t) {
                const t = o(e), a = i(e), l = s(e);
                if (!t || !a) continue;
                const u = {
                    category: a,
                    param: null == l ? null : l
                };
                let c;
                c = n && "function" == typeof PageJumpTarget ? new PageJumpTarget({
                    page: "category",
                    attributes: u
                }) : {
                    page: "category",
                    attributes: u
                }, r.push({
                    label: t,
                    target: c
                });
            }
            return r;
        }
    };
}

function createOffsetSearchLoader(e) {
    const t = e && "object" == typeof e && !Array.isArray(e) ? e : {}, r = String(t.path || "/api/search"), a = "function" == typeof t.getOffsetKey ? t.getOffsetKey : null, o = "function" == typeof t.buildQuery ? t.buildQuery : null, i = "function" == typeof t.mapComic ? t.mapComic : null, s = "function" == typeof t.onResponse ? t.onResponse : null, n = String(t.statusErrorPrefix || "Invalid status code");
    if (!a || !o || !i) throw new Error("Invalid createOffsetSearchLoader options");
    return async function(e, t) {
        if (!e || "object" != typeof e) throw new Error("runOffsetSearch requires plugin source");
        const l = t && "object" == typeof t && !Array.isArray(t) ? t : {}, u = Number(l.page || 1), c = stripSelfHostedTrailingSlash(e.baseUrl), d = a(l), p = readSelfHostedOffset(e, d, u), h = buildSelfHostedQueryFromSource(o(l, p)), g = h ? `${c}${r}?${h}` : `${c}${r}`, f = await Network.get(g, e.headers);
        if (200 !== f.status) throw `${n}: ${f.status}`;
        const y = parseSelfHostedJsonBody(f.body) || {}, m = Array.isArray(y.data) ? y.data : [], S = m.map(t => i(t, {
            source: e,
            base: c,
            input: l
        })), C = m.length;
        updateSelfHostedOffset(e, d, C);
        const L = "number" == typeof y.recordsFiltered && y.recordsFiltered >= 0 ? y.recordsFiltered : p + C, k = C || 1, b = Math.max(1, Math.ceil(L / k));
        return s && s({
            source: e,
            input: l,
            start: p,
            returned: C,
            data: y,
            list: m,
            comics: S
        }), {
            comics: S,
            maxPage: b,
            data: y
        };
    };
}

function toSelfHostedTagArray(e, t) {
    const r = t && "object" == typeof t && !Array.isArray(t) ? t : {}, a = "string" == typeof r.delimiter ? r.delimiter : ",", o = "function" == typeof r.normalizeTag ? r.normalizeTag : e => String(e).trim();
    return e ? Array.isArray(e) ? e.map(e => o(e)).filter(Boolean) : String(e).split(a).map(e => o(e)).filter(Boolean) : [];
}

function startsWithSelfHostedTagPrefix(e, t, r) {
    const a = String(e || ""), o = String(t || "");
    return !!o && (!1 === r ? a.toLowerCase().startsWith(o.toLowerCase()) : a.startsWith(o));
}

function extractSelfHostedTagValue(e, t, r) {
    const a = r && "object" == typeof r && !Array.isArray(r) ? r : {}, o = !1 !== a.caseSensitive, i = "function" == typeof a.transform ? a.transform : e => e, s = toSelfHostedTagArray(e, a), n = String(t || "");
    for (const e of s) if (startsWithSelfHostedTagPrefix(e, n, o)) return i(String(e).slice(n.length).trim(), e);
    return null;
}

function removeSelfHostedTagsByPrefix(e, t, r) {
    const a = r && "object" == typeof r && !Array.isArray(r) ? r : {}, o = !1 !== a.caseSensitive, i = toSelfHostedTagArray(e, a), s = Array.isArray(t) ? t.map(e => String(e)) : [ String(t || "") ];
    return i.filter(e => !s.some(t => startsWithSelfHostedTagPrefix(e, t, o)));
}

function filterSelfHostedDisplayTags(e, t) {
    const r = t && "object" == typeof t && !Array.isArray(t) ? t : {}, a = Array.isArray(r.blockedPrefixes) ? r.blockedPrefixes : [], o = !0 === r.caseSensitive, i = !1 !== r.excludeUrlLike, s = "function" == typeof r.extraFilter ? r.extraFilter : null, n = toSelfHostedTagArray(e, r), l = [];
    for (const e of n) a.some(t => startsWithSelfHostedTagPrefix(e, t, o)) || i && String(e).includes("://") || s && !s(e) || l.push(e);
    return l;
}

function parseSelfHostedRatingValueFromTags(e, t) {
    const r = t && "object" == typeof t && !Array.isArray(t) ? t : {}, a = String(r.prefix || "rating:"), o = Array.isArray(r.starSymbols) ? r.starSymbols : [ "⭐", "★" ], i = extractSelfHostedTagValue(e, a, {
        caseSensitive: !0 === r.caseSensitive
    });
    if (!i) return null;
    if (o.some(e => String(i).includes(e))) {
        let e = 0;
        for (const t of o) {
            const r = String(t).replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&"), a = String(i).match(new RegExp(r, "g"));
            if (a && a.length > 0) {
                e = a.length;
                break;
            }
        }
        return String(e);
    }
    return String(i).trim();
}

function extractSelfHostedUrlEntriesFromTagMap(e, t) {
    const r = t && "object" == typeof t && !Array.isArray(t) ? t : {}, a = String(r.sourceNamespace || "source").toLowerCase(), o = String(r.sourceScheme || "https").replace(/:$/, ""), i = new Set(Array.isArray(r.skipKeys) ? r.skipKeys.map(e => String(e)) : []), s = [];
    if (!e || "object" != typeof e) return s;
    for (const t of Object.keys(e)) {
        if (i.has(t)) continue;
        const r = e[t];
        if (!Array.isArray(r)) continue;
        const n = [];
        for (const e of r) if ("string" == typeof e) if (e.includes("://")) s.push(e); else {
            if (String(t).toLowerCase() === a) {
                let t = e;
                t.startsWith("//") ? t = `${o}:${t}` : /^https?:\/\//i.test(t) || (t = `${o}://${t}`),
                s.push(t);
                continue;
            }
            n.push(e);
        } else n.push(e);
        e[t] = n;
    }
    return s;
}

function buildSelfHostedEmojiRatingTag(e, t) {
    const r = t && "object" == typeof t && !Array.isArray(t) ? t : {}, a = String(r.prefix || "rating:"), o = String(r.symbol || "⭐"), i = Number(e) / 2;
    return `${a}${o.repeat(i)}`;
}

function unwrapCopyLikeComic(e) {
    return e && null != e.comic ? e.comic : e || {};
}

function readCopyLikePath(e, t, r) {
    if (!Array.isArray(t) || 0 === t.length) return e;
    let a = e;
    for (const e of t) {
        if (null == a || "object" != typeof a || !(e in a)) return r;
        a = a[e];
    }
    return a;
}

function parseCopyLikeThemeTags(e) {
    return e && Array.isArray(e.theme) ? e.theme.map(e => e && e.name).filter(e => null != e) : [];
}

function parseCopyLikePrimaryAuthor(e) {
    return e && Array.isArray(e.author) && 0 !== e.author.length && e.author[0] && e.author[0].name ? e.author[0].name : null;
}

function parseCopyLikeAuthorCount(e) {
    return e && Array.isArray(e.author) ? e.author.length : 0;
}

function formatCopyLikeRankingDescription(e, t, r) {
    const a = e && null != e.sort ? e.sort : null;
    if (null == a) return null;
    const o = e.rise_sort || 0;
    return `${a} ${o > 0 ? "▲" : o < 0 ? "▽" : "-"}\n${r > 1 ? `${t} 等${r}位` : t}\n🔥${(Number(e.popular || 0) / 1e4).toFixed(1)}W`;
}

function computeCopyLikeMaxPage(e, t) {
    const r = Number.isFinite(Number(t)) && Number(t) > 0 ? Number(t) : 21, a = Number.isFinite(Number(e)) ? Number(e) : 0;
    return Math.floor((a - a % r) / r) + 1;
}

function createHtmlDocument(e) {
    return new HtmlDocument(e);
}

"undefined" != typeof module && module && module.exports && (module.exports = {
    buildOffsetByPage,
    normalizeStarOption,
    normalizeStarOptions,
    stripSelfHostedTrailingSlash,
    normalizeSelfHostedPathRoot,
    normalizeSelfHostedPathSegment,
    joinSelfHostedPath,
    createSelfHostedRouteHelpers,
    buildSelfHostedUrlFromSource,
    buildSelfHostedQueryFromSource,
    normalizeWebSourceBaseUrl,
    normalizeWebSourcePath,
    joinWebSourcePath,
    buildWebSourceQuery,
    buildWebSourceUrl,
    toWebSourceAbsoluteUrl,
    replaceWebSourceBaseUrl,
    ensureWebSourceTrailingSlash,
    normalizeSelfHostedBaseUrl,
    normalizeSelfHostedRoutePath,
    joinSelfHostedRoutePath,
    createKomgaRouteHelpers,
    createKavitaRouteHelpers,
    resolveSelfHostedBaseUrl,
    buildSelfHostedQuery,
    buildSelfHostedUrl,
    readSelfHostedOffset,
    updateSelfHostedOffset,
    pluginSourcePagingApi,
    pluginSourceWebApi,
    pluginSourceSelfHostedPathApi,
    pluginSourceSelfHostedRouteApi,
    pluginSourceContractApi
}), "undefined" != typeof module && module && module.exports && (module.exports = {
    resolveMappedCategoryTagAction,
    createMappedCategoryTagActionResolver
}), "undefined" != typeof module && module && module.exports && (module.exports = {
    createSelfHostedReferenceCacheFeature,
    createSafeInitFeature,
    createStaticCategoryPart,
    createStoredCategoryPart,
    createOffsetSearchLoader,
    toSelfHostedTagArray,
    startsWithSelfHostedTagPrefix,
    extractSelfHostedTagValue,
    removeSelfHostedTagsByPrefix,
    filterSelfHostedDisplayTags,
    parseSelfHostedRatingValueFromTags,
    extractSelfHostedUrlEntriesFromTagMap,
    buildSelfHostedEmojiRatingTag
}), "undefined" != typeof module && module && module.exports && (module.exports = {
    unwrapCopyLikeComic,
    readCopyLikePath
}), "undefined" != typeof module && module && module.exports && (module.exports = {
    parseCopyLikeThemeTags,
    parseCopyLikePrimaryAuthor,
    parseCopyLikeAuthorCount,
    formatCopyLikeRankingDescription,
    computeCopyLikeMaxPage
}), "undefined" != typeof module && module && module.exports && (module.exports = {
    createHtmlDocument
});

const parserCopyLikeApi = {
    unwrapCopyLikeComic,
    readCopyLikePath,
    parseCopyLikeThemeTags,
    parseCopyLikePrimaryAuthor,
    parseCopyLikeAuthorCount,
    formatCopyLikeRankingDescription,
    computeCopyLikeMaxPage,
    createCopyLikeComicParser
}, parserHtmlApi = {
    createHtmlDocument
}, parserSupportApi = {
    ...parserCopyLikeApi,
    ...parserHtmlApi
};

function createCopyLikeComicParser(e) {
    const t = e || {};
    return e => {
        const r = unwrapCopyLikeComic(e), a = parseCopyLikePrimaryAuthor(r), o = parseCopyLikeAuthorCount(r), i = {
            id: r.path_word,
            title: r.name,
            subTitle: a,
            cover: r.cover,
            tags: parseCopyLikeThemeTags(r)
        };
        if (t.includeRankingDescription) {
            const t = formatCopyLikeRankingDescription(e, a, o);
            if (null != t) return i.description = t, i;
        }
        if (t.includeUpdateDescription && (i.description = r.datetime_updated), "function" == typeof t.describe) {
            const s = t.describe({
                sourceComic: e,
                comic: r,
                author: a,
                authorCount: o
            });
            null != s && (i.description = s);
        }
        return i;
    };
}

function normalizeCopyLikeBaseUrl(e, t) {
    const r = String(t || "").trim().replace(/^https?:\/\//i, "").replace(/\/+$/, "");
    let a = String(e || "").trim();
    if (!a) return r;
    a = a.replace(/^https?:\/\//i, "").replace(/\/+$/, "");
    const o = a.indexOf("/");
    return o >= 0 && (a = a.slice(0, o)), a || r;
}

function buildCopyLikeApiUrl(e, t) {
    return `https://${normalizeCopyLikeBaseUrl(e, t)}`;
}

function buildCopyLikePageUrl(e, t) {
    const r = Number(t) > 1 ? `?page=${t}` : "";
    return `${normalizeCopyLikeBaseUrl(e)}${r}`;
}

function buildCopyLikeTokenHeader(e) {
    return "Token" + (e ? ` ${e}` : "");
}

function buildCopyLikeBearerTokenHeader(e) {
    return e ? `Token ${e}` : "";
}

function buildCopyLikeRequestSigningMeta(e) {
    const t = new Date(null == e ? Date.now() : e);
    return {
        dt: `${t.getFullYear()}.${String(t.getMonth() + 1).padStart(2, "0")}.${String(t.getDate()).padStart(2, "0")}`,
        ts: String(Math.floor(t.getTime() / 1e3))
    };
}

function buildCopyLikeHmacSignature(e, t) {
    return Convert.hmacString(Convert.decodeBase64(e), Convert.encodeUtf8(String(t || "")), "sha256");
}

"undefined" != typeof module && module && module.exports && (module.exports = {
    unwrapCopyLikeComic,
    readCopyLikePath,
    parseCopyLikeThemeTags,
    parseCopyLikePrimaryAuthor,
    parseCopyLikeAuthorCount,
    formatCopyLikeRankingDescription,
    computeCopyLikeMaxPage,
    createCopyLikeComicParser,
    createHtmlDocument,
    parserCopyLikeApi,
    parserHtmlApi,
    parserSupportApi
});

const COPY_LIKE_ENDPOINT_PATHS = {
    LOGIN: "/api/v3/login",
    RANKS: "/api/v3/ranks",
    COMICS: "/api/v3/comics",
    SEARCH_COMIC: "/api/v3/search/comic",
    HOME_INDEX_COMICS: "/api/v3/h5/homeIndex/comics",
    FAVORITE_COMICS: "/api/v3/member/collect/comics",
    FAVORITE_COMIC_ACTION: "/api/v3/member/collect/comic",
    COMMENTS: "/api/v3/comments",
    COMMENT_ACTION: "/api/v3/member/comment",
    ROASTS: "/api/v3/roasts",
    ROAST_ACTION: "/api/v3/member/roast",
    COMIC_DETAIL_PREFIX: "/api/v3/comic2/",
    COMIC_GROUP_PREFIX: "/api/v3/comic/"
}, COPY_LIKE_FORM_URLENCODED_CONTENT_TYPE = "application/x-www-form-urlencoded;charset=utf-8";

function withCopyLikeFormHeaders(e) {
    return {
        ...e || {},
        "Content-Type": COPY_LIKE_FORM_URLENCODED_CONTENT_TYPE
    };
}

function buildCopyLikeEndpointUrl(e, t) {
    const r = String(e || "").replace(/\/+$/, ""), a = String(t || "");
    return a ? a.startsWith("http://") || a.startsWith("https://") ? a : a.startsWith("/") ? `${r}${a}` : `${r}/${a}` : r;
}

function buildCopyLikeQueryString(e) {
    const t = [];
    for (const r of e || []) {
        if (!Array.isArray(r) || r.length < 2) continue;
        const e = r[0], a = r[1];
        null != e && null != a && t.push(`${String(e)}=${String(a)}`);
    }
    return t.join("&");
}

function buildCopyLikeUrlWithQuery(e, t, r) {
    const a = buildCopyLikeEndpointUrl(e, t), o = buildCopyLikeQueryString(r);
    return o ? `${a}?${o}` : a;
}

function buildCopyLikeRankingUrl(e) {
    const t = e || {};
    return buildCopyLikeUrlWithQuery(t.apiUrl, COPY_LIKE_ENDPOINT_PATHS.RANKS, [ [ "free_type", t.freeType ], [ "limit", null == t.limit ? 30 : t.limit ], [ "offset", null == t.offset ? buildOffsetByPage(t.page, null == t.limit ? 30 : t.limit) : t.offset ], [ "_update", null == t.update || t.update ], [ "type", null == t.type ? 1 : t.type ], [ "audience_type", t.audienceType ], [ "region", t.region ], [ "date_type", t.dateType ] ]);
}

function buildCopyLikeComicsUrl(e) {
    const t = e || {}, r = null == t.limit ? 30 : t.limit;
    return buildCopyLikeUrlWithQuery(t.apiUrl, t.endpointPath || COPY_LIKE_ENDPOINT_PATHS.COMICS, [ [ "free_type", t.freeType ], [ "limit", r ], [ "offset", null == t.offset ? buildOffsetByPage(t.page, r) : t.offset ], [ "ordering", t.ordering ], [ "theme", t.theme ], [ "top", t.top ], [ "author", t.author ], [ "q", t.keyword ], [ "q_type", t.queryType ], [ "platform", t.platform ], [ "_update", t.update ] ]);
}

function buildCopyLikeSearchUrl(e) {
    const t = e || {}, r = null == t.limit ? 20 : t.limit, a = null == t.keyword ? "" : encodeURIComponent(String(t.keyword));
    return buildCopyLikeUrlWithQuery(t.apiUrl, t.endpointPath || COPY_LIKE_ENDPOINT_PATHS.SEARCH_COMIC, [ [ "platform", t.platform ], [ "q", a ], [ "limit", r ], [ "offset", null == t.offset ? buildOffsetByPage(t.page, r) : t.offset ], [ "free_type", t.freeType ], [ "_update", t.update ], [ "q_type", t.queryType ] ]);
}

function buildCopyLikeHomeIndexComicsUrl(e) {
    const t = e || {}, r = null == t.limit ? 20 : t.limit;
    return buildCopyLikeUrlWithQuery(t.apiUrl, t.endpointPath || COPY_LIKE_ENDPOINT_PATHS.HOME_INDEX_COMICS, [ [ "limit", r ], [ "offset", null == t.offset ? buildOffsetByPage(t.page, r) : t.offset ], [ "top", t.top ], [ "ordering", t.ordering ] ]);
}

function buildCopyLikeFavoriteComicsUrl(e) {
    const t = e || {}, r = null == t.limit ? 30 : t.limit;
    return buildCopyLikeUrlWithQuery(t.apiUrl, t.endpointPath || COPY_LIKE_ENDPOINT_PATHS.FAVORITE_COMICS, [ [ "limit", r ], [ "offset", null == t.offset ? buildOffsetByPage(t.page, r) : t.offset ], [ "free_type", t.freeType ], [ "ordering", t.ordering ] ]);
}

function buildCopyLikeComicDetailUrl(e) {
    const t = e || {};
    return buildCopyLikeUrlWithQuery(t.apiUrl, `${COPY_LIKE_ENDPOINT_PATHS.COMIC_DETAIL_PREFIX}${t.id}`, [ [ "in_mainland", t.inMainland ], [ "request_id", t.requestId ], [ "platform", t.platform ] ]);
}

function buildCopyLikeComicQueryUrl(e) {
    const t = e || {};
    return buildCopyLikeEndpointUrl(t.apiUrl, `${COPY_LIKE_ENDPOINT_PATHS.COMIC_DETAIL_PREFIX}${t.id}/query`);
}

function buildCopyLikeGroupChaptersUrl(e) {
    const t = e || {};
    return buildCopyLikeUrlWithQuery(t.apiUrl, `${COPY_LIKE_ENDPOINT_PATHS.COMIC_GROUP_PREFIX}${t.id}/group/${t.groupPath}/chapters`, [ [ "limit", null == t.limit ? 100 : t.limit ], [ "offset", null == t.offset ? 0 : t.offset ], [ "in_mainland", t.inMainland ], [ "request_id", t.requestId ] ]);
}

function buildCopyLikeChapterUrl(e) {
    const t = e || {}, r = t.chapterEndpoint || "chapter2";
    return buildCopyLikeUrlWithQuery(t.apiUrl, `${COPY_LIKE_ENDPOINT_PATHS.COMIC_GROUP_PREFIX}${t.comicId}/${r}/${t.chapterId}`, [ [ "in_mainland", t.inMainland ], [ "request_id", t.requestId ], [ "platform", t.platform ], [ "_update", t.update ] ]);
}

function normalizeCopyLikeCategoryParam(e, t, r) {
    return null == e ? r : (t || {})[e] || "";
}

function parseCopyLikeDetailAuthors(e) {
    return e && Array.isArray(e.author) ? e.author.map(e => e && e.name).filter(e => null != e) : [];
}

function parseCopyLikeDetailTags(e) {
    return e && Array.isArray(e.theme) ? e.theme.map(e => e && e.name).filter(e => null != e) : [];
}

function buildCopyLikeDetailTagMap(e, t) {
    const r = t || {}, a = r.authorNamespace || "作者", o = r.updateNamespace || "更新", i = r.tagNamespace || "标签", s = r.statusNamespace || "状态", n = e && e.datetime_updated ? e.datetime_updated : "", l = e && e.status && e.status.display ? e.status.display : "";
    return {
        [a]: parseCopyLikeDetailAuthors(e),
        [o]: [ n ],
        [i]: parseCopyLikeDetailTags(e),
        [s]: [ l ]
    };
}

function resolveCopyLikeTagAction(e, t, r) {
    const a = r || {}, o = a.categoryNamespace || "标签", i = a.authorNamespace || "作者", s = a.unsupportedError || "未支持此类Tag检索";
    if (e === o) return {
        action: "category",
        keyword: `${t}`,
        param: null
    };
    if (e === i) return {
        action: "search",
        keyword: `${e}:${t}`,
        param: null
    };
    throw s;
}

function buildCopyLikeHomeSections(e, t, r) {
    const a = {};
    for (const o of t || []) {
        const t = readCopyLikePath(e, o.path, []);
        a[o.title] = Array.isArray(t) ? t.map(r) : [];
    }
    return a;
}

async function loadCopyLikeHomeSectionsModule(e) {
    return buildCopyLikeHomeSections(await getRuntimeJson(`${e.apiUrl}${e.endpoint || "/api/v3/h5/homeIndex"}`, e.headers, e.context || "copy_like home"), e.sections || [], e.parseComic);
}

async function loadCopyLikeListModule(e) {
    const t = await getRuntimeJson(e.requestUrl, e.headers, e.context || "copy_like list"), r = readCopyLikePath(t, e.listPath || [ "results", "list" ], []), a = readCopyLikePath(t, e.totalPath || [ "results", "total" ], 0);
    return {
        comics: Array.isArray(r) ? r.map(e.parseComic) : [],
        maxPage: computeCopyLikeMaxPage(a, e.maxPageDivisor || 21)
    };
}

function parseCopyLikeAuthorKeyword(e) {
    const t = String(e || "");
    return t.startsWith("作者:") ? t.substring(3).trim() : null;
}

async function loadCopyLikeSearchModule(e) {
    const t = parseCopyLikeAuthorKeyword(e.keyword), r = t ? e.resolveAuthorPathWord(t) : null;
    return loadCopyLikeListModule({
        requestUrl: r ? e.buildAuthorRequestUrl({
            pathWord: encodeURIComponent(r),
            page: e.page,
            keyword: e.keyword,
            options: e.options
        }) : e.buildKeywordRequestUrl({
            page: e.page,
            keyword: e.keyword,
            options: e.options
        }),
        headers: e.headers,
        parseComic: e.parseComic,
        context: e.context || "copy_like search",
        listPath: e.listPath,
        totalPath: e.totalPath,
        maxPageDivisor: e.maxPageDivisor
    });
}

function createCopyLikeExploreFeature(e) {
    return {
        title: e.title,
        type: "singlePageWithMultiPart",
        load: async () => loadCopyLikeHomeSectionsModule({
            apiUrl: e.getApiUrl(),
            headers: e.getHeaders(),
            parseComic: e.parseComic,
            sections: e.sections,
            endpoint: e.endpoint,
            context: e.context
        })
    };
}

function createCopyLikeCategoryLoadFeature(e) {
    return async (t, r, a, o) => loadCopyLikeListModule({
        requestUrl: e.buildRequestUrl({
            category: t,
            param: r,
            options: a,
            page: o
        }),
        headers: e.getHeaders(),
        parseComic: e.parseComic,
        context: e.context,
        listPath: e.listPath,
        totalPath: e.totalPath,
        maxPageDivisor: e.maxPageDivisor
    });
}

function createCopyLikeSearchLoadFeature(e) {
    return async (t, r, a) => loadCopyLikeSearchModule({
        keyword: t,
        options: r,
        page: a,
        headers: e.getHeaders(),
        parseComic: e.parseComic,
        resolveAuthorPathWord: e.resolveAuthorPathWord,
        buildAuthorRequestUrl: e.buildAuthorRequestUrl,
        buildKeywordRequestUrl: e.buildKeywordRequestUrl,
        context: e.context,
        listPath: e.listPath,
        totalPath: e.totalPath,
        maxPageDivisor: e.maxPageDivisor
    });
}

function createCopyLikeCategoryRequestUrlBuilder(e) {
    return ({category: t, param: r, options: a, page: o}) => {
        const i = Array.isArray(a) ? a : [], s = !1 === e.normalizeOptions ? i : normalizeStarOptions(i), n = e.getApiUrl();
        if ("function" == typeof e.isRankingCategory && e.isRankingCategory(t, r)) return buildCopyLikeRankingUrl({
            apiUrl: n,
            page: o,
            limit: null == e.rankingLimit ? 30 : e.rankingLimit,
            freeType: e.rankingFreeType,
            audienceType: null == e.rankingAudienceOptionIndex ? void 0 : i[e.rankingAudienceOptionIndex],
            region: null == e.rankingRegionOptionIndex ? void 0 : i[e.rankingRegionOptionIndex],
            dateType: null == e.rankingDateOptionIndex ? void 0 : i[e.rankingDateOptionIndex]
        });
        if ("function" == typeof e.isHomepageCategory && e.isHomepageCategory(t, r)) return buildCopyLikeHomeIndexComicsUrl({
            apiUrl: n,
            page: o,
            limit: null == e.homepageLimit ? 20 : e.homepageLimit,
            top: r,
            ordering: null == e.homepageOrderingOptionIndex ? void 0 : i[e.homepageOrderingOptionIndex]
        });
        const l = normalizeCopyLikeCategoryParam(t, e.categoryParamMap, r);
        return buildCopyLikeComicsUrl({
            apiUrl: n,
            page: o,
            limit: null == e.themedLimit ? 30 : e.themedLimit,
            freeType: e.themedFreeType,
            ordering: null == e.themedOrderingOptionIndex ? void 0 : s[e.themedOrderingOptionIndex],
            theme: l || "",
            top: null == e.themedTopOptionIndex ? void 0 : s[e.themedTopOptionIndex]
        });
    };
}

function createCopyLikeSearchRequestUrlBuilders(e) {
    return {
        buildAuthorRequestUrl: ({pathWord: t, page: r}) => buildCopyLikeComicsUrl({
            apiUrl: e.getApiUrl(),
            page: r,
            limit: null == e.authorLimit ? 30 : e.authorLimit,
            ordering: e.authorOrdering || "-datetime_updated",
            author: t
        }),
        buildKeywordRequestUrl: ({keyword: t, options: r, page: a}) => {
            const o = Array.isArray(r) ? r : [], i = null == e.queryTypeOptionIndex ? e.queryTypeDefault : null != o[e.queryTypeOptionIndex] ? o[e.queryTypeOptionIndex] : e.queryTypeDefault;
            return buildCopyLikeSearchUrl({
                apiUrl: e.getApiUrl(),
                endpointPath: "function" == typeof e.getKeywordEndpointPath ? e.getKeywordEndpointPath() : e.keywordEndpointPath,
                page: a,
                limit: null == e.keywordLimit ? 20 : e.keywordLimit,
                keyword: t,
                queryType: i,
                platform: e.keywordPlatform,
                freeType: e.keywordFreeType,
                update: e.keywordUpdate
            });
        }
    };
}

function createCopyLikeDetailTagMapper(e) {
    const t = e || {};
    return e => buildCopyLikeDetailTagMap(e, t);
}

function createCopyLikeTagClickActionHandler(e) {
    const t = e || {};
    return (e, r) => resolveCopyLikeTagAction(e, r, t);
}

function createCopyLikeExploreSectionsFeature(e) {
    return createCopyLikeExploreFeature({
        title: e.title,
        sections: e.sections,
        endpoint: e.endpoint,
        parseComic: e.parseComic,
        context: e.context,
        getApiUrl: e.getApiUrl,
        getHeaders: e.getHeaders
    });
}

function createCopyLikeCategoryLoaderFeature(e) {
    return createCopyLikeCategoryLoadFeature(e);
}

function createCopyLikeSearchLoaderFeature(e) {
    return createCopyLikeSearchLoadFeature(e);
}

"undefined" != typeof module && module && module.exports && (module.exports = {
    normalizeCopyLikeBaseUrl,
    buildCopyLikeApiUrl,
    buildCopyLikePageUrl,
    buildCopyLikeTokenHeader,
    buildCopyLikeBearerTokenHeader,
    buildCopyLikeRequestSigningMeta,
    buildCopyLikeHmacSignature,
    COPY_LIKE_ENDPOINT_PATHS,
    COPY_LIKE_FORM_URLENCODED_CONTENT_TYPE,
    withCopyLikeFormHeaders,
    buildCopyLikeEndpointUrl,
    buildCopyLikeQueryString,
    buildCopyLikeUrlWithQuery,
    buildCopyLikeRankingUrl,
    buildCopyLikeComicsUrl,
    buildCopyLikeSearchUrl,
    buildCopyLikeHomeIndexComicsUrl,
    buildCopyLikeFavoriteComicsUrl,
    buildCopyLikeComicDetailUrl,
    buildCopyLikeComicQueryUrl,
    buildCopyLikeGroupChaptersUrl,
    buildCopyLikeChapterUrl,
    normalizeCopyLikeCategoryParam,
    parseCopyLikeDetailAuthors,
    parseCopyLikeDetailTags,
    buildCopyLikeDetailTagMap,
    resolveCopyLikeTagAction,
    buildCopyLikeHomeSections,
    loadCopyLikeHomeSectionsModule,
    loadCopyLikeListModule,
    parseCopyLikeAuthorKeyword,
    loadCopyLikeSearchModule
}), "undefined" != typeof module && module && module.exports && (module.exports = {
    createCopyLikeExploreFeature,
    createCopyLikeCategoryLoadFeature,
    createCopyLikeSearchLoadFeature,
    createCopyLikeCategoryRequestUrlBuilder,
    createCopyLikeSearchRequestUrlBuilders,
    createCopyLikeDetailTagMapper,
    createCopyLikeTagClickActionHandler,
    createCopyLikeExploreSectionsFeature,
    createCopyLikeCategoryLoaderFeature,
    createCopyLikeSearchLoaderFeature
});

const MH_LIKE_USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:144.0) Gecko/20100101 Firefox/144.0", MH_LIKE_ENDPOINT_PATHS = {
    CATEGORY_PAGE_SEGMENT: "/page",
    SEARCH: "/s",
    CHAPTER_LIST: "/manga/get",
    CHAPTER_INFO: "/chapter/getinfo",
    CHAPTER_CONTENT: "/chapter/getcontent"
};

function normalizeMhLikeId(e) {
    return String(e || "").trim();
}

function normalizeMhLikeDomain(e) {
    return String(e || "").trim().replace(/^https?:\/\//i, "").replace(/\/+$/, "");
}

function buildMhLikeBaseUrl(e) {
    return `https://${normalizeMhLikeDomain(e)}`;
}

function buildMhLikeHeaders(e) {
    return {
        "User-Agent": MH_LIKE_USER_AGENT,
        Referer: String(e || "")
    };
}

function normalizeMhLikePath(e, t) {
    let r = String(null == e ? t || "" : e).trim();
    return r || (r = String(t || "")), r ? (r = r.replace(/\/+$/, ""), r.startsWith("/") || (r = `/${r}`),
    r) : "";
}

function buildMhLikeRelativeUrl(e, t) {
    const r = String(e || "").replace(/\/+$/, ""), a = String(t || "").trim();
    return a ? a.startsWith("http://") || a.startsWith("https://") ? a : a.startsWith("/") ? `${r}${a}` : `${r}/${a}` : r;
}

function buildMhLikeApiBaseUrl(e, t) {
    return buildMhLikeRelativeUrl(buildMhLikeBaseUrl(e), normalizeMhLikePath(t, "/api"));
}

function buildMhLikeCategoryUrl(e) {
    const t = e || {}, r = String(t.categoryPath || "").replace(/\/+$/, ""), a = normalizeMhLikePath(t.pageSegment, MH_LIKE_ENDPOINT_PATHS.CATEGORY_PAGE_SEGMENT);
    return buildMhLikeRelativeUrl(t.baseUrl, `${r}${a}/${t.page}`);
}

function buildMhLikeSearchUrl(e) {
    const t = e || {}, r = normalizeMhLikePath(t.searchPath, MH_LIKE_ENDPOINT_PATHS.SEARCH), a = encodeURIComponent(String(null == t.keyword ? "" : t.keyword));
    return buildMhLikeRelativeUrl(t.baseUrl, `${r}/${a}?page=${t.page}`);
}

function buildMhLikeChapterListUrl(e) {
    const t = e || {}, r = normalizeMhLikePath(t.chapterListPath, MH_LIKE_ENDPOINT_PATHS.CHAPTER_LIST), a = null == t.mode ? "all" : t.mode, o = null == t.timestamp ? Date.now() : t.timestamp;
    return buildMhLikeRelativeUrl(t.baseUrl, `${r}?mid=${t.mangaId}&mode=${a}&t=${o}`);
}

function buildMhLikeChapterEndpointUrl(e) {
    const t = e || {}, r = normalizeMhLikePath(t.chapterPath, "");
    return buildMhLikeRelativeUrl(t.baseUrl, `${r}?m=${t.mangaId}&c=${t.chapterId}`);
}

function buildMhLikeChapterInfoUrl(e) {
    const t = e || {};
    return buildMhLikeChapterEndpointUrl({
        baseUrl: t.baseUrl,
        chapterPath: null == t.chapterPath ? MH_LIKE_ENDPOINT_PATHS.CHAPTER_INFO : t.chapterPath,
        mangaId: t.mangaId,
        chapterId: t.chapterId
    });
}

function buildMhLikeChapterContentUrl(e) {
    const t = e || {};
    return buildMhLikeChapterEndpointUrl({
        baseUrl: t.baseUrl,
        chapterPath: null == t.chapterPath ? MH_LIKE_ENDPOINT_PATHS.CHAPTER_CONTENT : t.chapterPath,
        mangaId: t.mangaId,
        chapterId: t.chapterId
    });
}

function createMhLikeRouteHelpers(e) {
    const t = e || {};
    return {
        buildCategoryUrl: ({categoryPath: e, page: r}) => buildMhLikeCategoryUrl({
            baseUrl: t.baseUrl,
            categoryPath: e,
            page: r,
            pageSegment: t.categoryPageSegment
        }),
        buildSearchUrl: ({keyword: e, page: r}) => buildMhLikeSearchUrl({
            baseUrl: t.baseUrl,
            keyword: e,
            page: r,
            searchPath: t.searchPath
        }),
        buildChapterListUrl: ({mangaId: e, timestamp: r, mode: a}) => buildMhLikeChapterListUrl({
            baseUrl: t.baseUrl,
            mangaId: e,
            timestamp: r,
            mode: a,
            chapterListPath: t.chapterListPath
        }),
        buildChapterInfoUrl: ({mangaId: e, chapterId: r}) => buildMhLikeChapterInfoUrl({
            baseUrl: t.baseUrl,
            mangaId: e,
            chapterId: r,
            chapterPath: t.chapterInfoPath
        }),
        buildChapterContentUrl: ({mangaId: e, chapterId: r}) => buildMhLikeChapterContentUrl({
            baseUrl: t.baseUrl,
            mangaId: e,
            chapterId: r,
            chapterPath: t.chapterContentPath
        })
    };
}

function parseMhLikeComicCards(e) {
    const t = [];
    if (!e) return t;
    for (let r of e.querySelectorAll(".pb-2")) t.push(new Comic({
        id: r.querySelector("a").attributes.href,
        title: r.querySelector("h3").text,
        cover: r.querySelector("img").attributes.src
    }));
    return t;
}

function parseMhLikeHomeSections(e, t) {
    const r = [ {
        title: "近期更新",
        comics: [],
        viewMore: null
    } ], a = e.querySelector(".pb-unit-md");
    if (a) for (let e of a.querySelectorAll(".slicarda")) r[0].comics.push(new Comic({
        id: e.attributes.href,
        title: e.querySelector("h3").text,
        cover: e.querySelector("img").attributes.src
    }));
    const o = e.querySelectorAll(".cardlist"), i = e.querySelectorAll(".hometitle");
    for (let e = 0; e < i.length; e += 1) {
        const a = i[e].querySelector("h2");
        r.push({
            title: a.text,
            comics: t(o[e]),
            viewMore: {
                page: "category",
                attributes: {
                    category: a.text,
                    param: i[e].attributes.href
                }
            }
        });
    }
    return r;
}

function parseMhLikeMaxPage(e) {
    try {
        return parseInt(e.querySelectorAll("button.text-small").pop().text.replaceAll("\n", "").replaceAll(" ", ""), 10);
    } catch (e) {
        return 1;
    }
}

function parseMhLikeDetailTags(e) {
    const t = e.querySelectorAll("div.py-1"), r = {
        作者: [],
        类型: [],
        标签: []
    };
    for (let e of t[0].querySelectorAll("a > span")) {
        let t = e.text.trim();
        t.endsWith(",") && (t = t.slice(0, -1).trim()), r["作者"].push(t);
    }
    for (let e of t[1].querySelectorAll("a > span")) {
        let t = e.text.trim();
        t.endsWith(",") && (t = t.slice(0, -1).trim()), r["类型"].push(t);
    }
    for (let e of t[2].querySelectorAll("a")) r["标签"].push(e.text.replace("\n", "").replaceAll(" ", "").replace("#", ""));
    return r;
}

function parseMhLikeRecommendComics(e) {
    const t = [];
    for (let r of e.querySelectorAll("div.cardlist > div.pb-2")) t.push(new Comic({
        id: r.querySelector("a").attributes.href,
        title: r.querySelector("h3").text,
        cover: r.querySelector("img").attributes.src
    }));
    return t;
}

async function loadMhLikePagedComicsFromUrl(e) {
    const t = await getRuntimeDocument(e.requestUrl, e.headers, e.context);
    return {
        comics: e.parseComics(t),
        maxPage: parseMhLikeMaxPage(t)
    };
}

function createMhLikeExploreFeature(e) {
    return {
        title: e.title,
        type: "multiPartPage",
        load: async () => parseMhLikeHomeSections(await getRuntimeDocument(e.getBaseUrl(), e.getHeaders(), e.context || "mh_like home"), e.parseComics)
    };
}

function createMhLikeCategoryLoadFeature(e) {
    return async (t, r, a, o) => loadMhLikePagedComicsFromUrl({
        requestUrl: e.buildRequestUrl ? e.buildRequestUrl({
            category: t,
            params: r,
            options: a,
            page: o
        }) : buildMhLikeCategoryUrl({
            baseUrl: e.getBaseUrl(),
            categoryPath: r,
            page: o,
            pageSegment: e.categoryPageSegment
        }),
        headers: e.getHeaders(),
        parseComics: e.parseComics,
        context: e.context || "mh_like category"
    });
}

function createMhLikeSearchLoadFeature(e) {
    return async (t, r, a) => loadMhLikePagedComicsFromUrl({
        requestUrl: e.buildRequestUrl ? e.buildRequestUrl({
            keyword: t,
            options: r,
            page: a
        }) : buildMhLikeSearchUrl({
            baseUrl: e.getBaseUrl(),
            keyword: t,
            page: a,
            searchPath: e.searchPath
        }),
        headers: e.getHeaders(),
        parseComics: e.parseComics,
        context: e.context || "mh_like search"
    });
}

async function loadMhLikeBaseComicInfo(e) {
    const t = await getRuntimeDocument(e.detailUrl, e.headers, e.context || "mh_like comic detail"), r = t.querySelector(".text-xl").text.trim().split("   ")[0], a = t.querySelector(".object-cover").attributes.src, o = t.querySelector("p.text-medium").text;
    return {
        document: t,
        title: r,
        cover: a,
        description: o,
        tags: parseMhLikeDetailTags(t),
        recommend: parseMhLikeRecommendComics(t),
        mangaId: t.querySelector("#mangachapters").attributes["data-mid"]
    };
}

function createMhLikeCategoryRequestUrlBuilder(e) {
    const t = e || {};
    return ({params: e, page: r}) => buildMhLikeCategoryUrl({
        baseUrl: t.getBaseUrl(),
        categoryPath: e,
        page: r,
        pageSegment: t.categoryPageSegment
    });
}

function createMhLikeSearchRequestUrlBuilder(e) {
    const t = e || {};
    return ({keyword: e, page: r}) => buildMhLikeSearchUrl({
        baseUrl: t.getBaseUrl(),
        keyword: e,
        page: r,
        searchPath: t.searchPath
    });
}

function createMhLikeChapterRequestUrlBuilders(e) {
    const t = e || {};
    return {
        buildChapterListRequestUrl: ({mangaId: e, timestamp: r, mode: a}) => buildMhLikeChapterListUrl({
            baseUrl: t.getBaseUrl(),
            mangaId: e,
            timestamp: r,
            mode: a,
            chapterListPath: t.chapterListPath
        }),
        buildChapterInfoRequestUrl: ({mangaId: e, chapterId: r}) => buildMhLikeChapterInfoUrl({
            baseUrl: t.getBaseUrl(),
            mangaId: e,
            chapterId: r,
            chapterPath: t.chapterInfoPath
        }),
        buildChapterContentRequestUrl: ({mangaId: e, chapterId: r}) => buildMhLikeChapterContentUrl({
            baseUrl: t.getBaseUrl(),
            mangaId: e,
            chapterId: r,
            chapterPath: t.chapterContentPath
        })
    };
}

function buildMhLikeChapterUrl(e, t) {
    return `${String(e || "").replace(/\/+$/, "")}/${normalizeMhLikeId(t)}`;
}

function createMhLikeExplorePageFeature(e) {
    return createMhLikeExploreFeature(e);
}

function createMhLikeCategoryLoaderFeature(e) {
    return createMhLikeCategoryLoadFeature(e);
}

function createMhLikeSearchLoaderFeature(e) {
    return createMhLikeSearchLoadFeature(e);
}

function loadMhLikeBaseComicInfoFeature(e) {
    return loadMhLikeBaseComicInfo(e);
}

"undefined" != typeof module && module && module.exports && (module.exports = {
    MH_LIKE_USER_AGENT,
    MH_LIKE_ENDPOINT_PATHS,
    normalizeMhLikeId,
    normalizeMhLikeDomain,
    buildMhLikeBaseUrl,
    buildMhLikeHeaders,
    normalizeMhLikePath,
    buildMhLikeRelativeUrl,
    buildMhLikeApiBaseUrl,
    buildMhLikeCategoryUrl,
    buildMhLikeSearchUrl,
    buildMhLikeChapterListUrl,
    buildMhLikeChapterEndpointUrl,
    buildMhLikeChapterInfoUrl,
    buildMhLikeChapterContentUrl,
    createMhLikeRouteHelpers,
    parseMhLikeComicCards,
    parseMhLikeHomeSections,
    parseMhLikeMaxPage,
    parseMhLikeDetailTags,
    parseMhLikeRecommendComics,
    loadMhLikePagedComicsFromUrl,
    createMhLikeExploreFeature,
    createMhLikeCategoryLoadFeature,
    createMhLikeSearchLoadFeature,
    loadMhLikeBaseComicInfo,
    createMhLikeCategoryRequestUrlBuilder,
    createMhLikeSearchRequestUrlBuilder,
    createMhLikeChapterRequestUrlBuilders,
    buildMhLikeChapterUrl,
    createMhLikeExplorePageFeature,
    createMhLikeCategoryLoaderFeature,
    createMhLikeSearchLoaderFeature,
    loadMhLikeBaseComicInfoFeature
});

const PICACG_ENDPOINT_PATHS = {
    AUTH_SIGN_IN: "auth/sign-in",
    COMICS: "comics",
    COMICS_RANDOM: "comics/random",
    COMICS_LEADERBOARD: "comics/leaderboard",
    COMICS_ADVANCED_SEARCH: "comics/advanced-search",
    USERS_FAVOURITE: "users/favourite",
    COMMENTS: "comments"
}, PICACG_RANKING_CATEGORY = "VC", PICACG_TAG_NAMESPACES = {
    AUTHOR: "Author",
    CATEGORIES: "Categories"
};

function normalizePicacgBaseUrl(e, t) {
    const r = "string" == typeof t ? String(t).trim() : "", a = "string" == typeof e && e.trim() ? e.trim() : r;
    return String(a || "").replace(/\/+$/, "");
}

function buildPicacgEndpointUrl(e, t) {
    const r = normalizePicacgBaseUrl(e), a = String(t || "").replace(/^\/+/, "");
    return r ? a ? `${r}/${a}` : r : a;
}

function buildPicacgQueryString(e) {
    const t = [];
    for (const r of e || []) {
        if (!Array.isArray(r) || r.length < 2) continue;
        const e = r[0], a = r[1];
        null != e && null != a && t.push(`${String(e)}=${String(a)}`);
    }
    return t.join("&");
}

function buildPicacgPathWithQuery(e, t) {
    const r = buildPicacgQueryString(t);
    return r ? `${String(e || "")}?${r}` : String(e || "");
}

function createPicacgRequest(e, t) {
    const r = String(e || "");
    return {
        path: r,
        signaturePath: null == t ? r : String(t || "")
    };
}

function resolvePicacgTagAction(e, t, r) {
    const a = r && "object" == typeof r && !Array.isArray(r) ? r : {}, o = a.authorNamespace || PICACG_TAG_NAMESPACES.AUTHOR, i = a.categoryNamespace || PICACG_TAG_NAMESPACES.CATEGORIES;
    return e === o ? {
        action: "category",
        keyword: t,
        param: "a"
    } : e === i ? {
        action: "category",
        keyword: t,
        param: "c"
    } : {
        action: "search",
        keyword: t
    };
}

function createPicacgRouteHelpers(e) {
    const t = (e && "object" == typeof e && !Array.isArray(e) ? e : {}).rankingCategory || "VC";
    return {
        authSignInRequest: () => createPicacgRequest(PICACG_ENDPOINT_PATHS.AUTH_SIGN_IN),
        randomComicsRequest: () => createPicacgRequest(PICACG_ENDPOINT_PATHS.COMICS_RANDOM),
        latestComicsRequest: ({page: e, sort: t}) => createPicacgRequest(buildPicacgPathWithQuery(PICACG_ENDPOINT_PATHS.COMICS, [ [ "page", e ], [ "s", t ] ])),
        leaderboardRequest: ({option: e, categoryType: r}) => createPicacgRequest(buildPicacgPathWithQuery(PICACG_ENDPOINT_PATHS.COMICS_LEADERBOARD, [ [ "tt", e ], [ "ct", null == r ? t : r ] ])),
        categoryComicsRequest: ({page: e, type: t, category: r, sort: a}) => createPicacgRequest(buildPicacgPathWithQuery(PICACG_ENDPOINT_PATHS.COMICS, [ [ "page", e ], [ t || "c", r ], [ "s", a ] ])),
        advancedSearchRequest: ({page: e}) => createPicacgRequest(buildPicacgPathWithQuery(PICACG_ENDPOINT_PATHS.COMICS_ADVANCED_SEARCH, [ [ "page", e ] ])),
        comicFavoriteRequest: ({comicId: e}) => createPicacgRequest(`${PICACG_ENDPOINT_PATHS.COMICS}/${e}/favourite`),
        userFavoritesRequest: ({page: e, sort: t}) => createPicacgRequest(buildPicacgPathWithQuery(PICACG_ENDPOINT_PATHS.USERS_FAVOURITE, [ [ "page", e ], [ "s", t ] ])),
        comicInfoRequest: ({comicId: e}) => createPicacgRequest(`${PICACG_ENDPOINT_PATHS.COMICS}/${e}`),
        comicEpsRequest: ({comicId: e, page: t}) => createPicacgRequest(buildPicacgPathWithQuery(`${PICACG_ENDPOINT_PATHS.COMICS}/${e}/eps`, [ [ "page", t ] ])),
        comicRecommendationRequest: ({comicId: e}) => createPicacgRequest(`${PICACG_ENDPOINT_PATHS.COMICS}/${e}/recommendation`),
        comicEpPagesRequest: ({comicId: e, epId: t, page: r}) => createPicacgRequest(buildPicacgPathWithQuery(`${PICACG_ENDPOINT_PATHS.COMICS}/${e}/order/${t}/pages`, [ [ "page", r ] ])),
        comicLikeRequest: ({comicId: e}) => createPicacgRequest(`${PICACG_ENDPOINT_PATHS.COMICS}/${e}/like`),
        commentChildrenRequest: ({replyTo: e, page: t}) => createPicacgRequest(buildPicacgPathWithQuery(`${PICACG_ENDPOINT_PATHS.COMMENTS}/${e}/childrens`, [ [ "page", t ] ])),
        comicCommentsRequest: ({comicId: e, page: t}) => createPicacgRequest(buildPicacgPathWithQuery(`${PICACG_ENDPOINT_PATHS.COMICS}/${e}/comments`, [ [ "page", t ] ])),
        commentReplyRequest: ({replyTo: e}) => createPicacgRequest(`${PICACG_ENDPOINT_PATHS.COMMENTS}/${e}`, `/${PICACG_ENDPOINT_PATHS.COMMENTS}/${e}`),
        comicCommentRequest: ({comicId: e}) => createPicacgRequest(`${PICACG_ENDPOINT_PATHS.COMICS}/${e}/comments`, `/${PICACG_ENDPOINT_PATHS.COMICS}/${e}/comments`),
        commentLikeRequest: ({commentId: e}) => createPicacgRequest(`${PICACG_ENDPOINT_PATHS.COMMENTS}/${e}/like`, `/${PICACG_ENDPOINT_PATHS.COMMENTS}/${e}/like`)
    };
}

"undefined" != typeof module && module && module.exports && (module.exports = {
    PICACG_ENDPOINT_PATHS,
    PICACG_TAG_NAMESPACES,
    normalizePicacgBaseUrl,
    buildPicacgEndpointUrl,
    buildPicacgQueryString,
    buildPicacgPathWithQuery,
    createPicacgRouteHelpers,
    resolvePicacgTagAction
});

const pluginFeatureGenericApi = {
    resolveMappedCategoryTagAction,
    createMappedCategoryTagActionResolver,
    createSelfHostedReferenceCacheFeature,
    createSafeInitFeature,
    createStaticCategoryPart,
    createStoredCategoryPart,
    createOffsetSearchLoader,
    toSelfHostedTagArray,
    startsWithSelfHostedTagPrefix,
    extractSelfHostedTagValue,
    removeSelfHostedTagsByPrefix,
    filterSelfHostedDisplayTags,
    parseSelfHostedRatingValueFromTags,
    extractSelfHostedUrlEntriesFromTagMap,
    buildSelfHostedEmojiRatingTag
}, pluginFeatureCopyLikeApi = {
    normalizeCopyLikeBaseUrl,
    buildCopyLikeApiUrl,
    buildCopyLikePageUrl,
    buildCopyLikeTokenHeader,
    buildCopyLikeBearerTokenHeader,
    buildCopyLikeRequestSigningMeta,
    buildCopyLikeHmacSignature,
    COPY_LIKE_ENDPOINT_PATHS,
    COPY_LIKE_FORM_URLENCODED_CONTENT_TYPE,
    withCopyLikeFormHeaders,
    buildCopyLikeEndpointUrl,
    buildCopyLikeQueryString,
    buildCopyLikeUrlWithQuery,
    buildCopyLikeRankingUrl,
    buildCopyLikeComicsUrl,
    buildCopyLikeSearchUrl,
    buildCopyLikeHomeIndexComicsUrl,
    buildCopyLikeFavoriteComicsUrl,
    buildCopyLikeComicDetailUrl,
    buildCopyLikeComicQueryUrl,
    buildCopyLikeGroupChaptersUrl,
    buildCopyLikeChapterUrl,
    normalizeCopyLikeCategoryParam,
    parseCopyLikeDetailAuthors,
    parseCopyLikeDetailTags,
    buildCopyLikeDetailTagMap,
    resolveCopyLikeTagAction,
    buildCopyLikeHomeSections,
    loadCopyLikeHomeSectionsModule,
    loadCopyLikeListModule,
    parseCopyLikeAuthorKeyword,
    loadCopyLikeSearchModule,
    createCopyLikeExploreFeature,
    createCopyLikeCategoryLoadFeature,
    createCopyLikeSearchLoadFeature,
    createCopyLikeCategoryRequestUrlBuilder,
    createCopyLikeSearchRequestUrlBuilders,
    createCopyLikeDetailTagMapper,
    createCopyLikeTagClickActionHandler,
    createCopyLikeExploreSectionsFeature,
    createCopyLikeCategoryLoaderFeature,
    createCopyLikeSearchLoaderFeature
}, pluginFeatureMhLikeApi = {
    MH_LIKE_USER_AGENT,
    MH_LIKE_ENDPOINT_PATHS,
    normalizeMhLikeId,
    normalizeMhLikeDomain,
    buildMhLikeBaseUrl,
    buildMhLikeHeaders,
    normalizeMhLikePath,
    buildMhLikeRelativeUrl,
    buildMhLikeApiBaseUrl,
    buildMhLikeCategoryUrl,
    buildMhLikeSearchUrl,
    buildMhLikeChapterListUrl,
    buildMhLikeChapterEndpointUrl,
    buildMhLikeChapterInfoUrl,
    buildMhLikeChapterContentUrl,
    createMhLikeRouteHelpers,
    parseMhLikeComicCards,
    parseMhLikeHomeSections,
    parseMhLikeMaxPage,
    parseMhLikeDetailTags,
    parseMhLikeRecommendComics,
    loadMhLikePagedComicsFromUrl,
    createMhLikeExploreFeature,
    createMhLikeCategoryLoadFeature,
    createMhLikeSearchLoadFeature,
    loadMhLikeBaseComicInfo,
    createMhLikeCategoryRequestUrlBuilder,
    createMhLikeSearchRequestUrlBuilder,
    createMhLikeChapterRequestUrlBuilders,
    buildMhLikeChapterUrl,
    createMhLikeExplorePageFeature,
    createMhLikeCategoryLoaderFeature,
    createMhLikeSearchLoaderFeature,
    loadMhLikeBaseComicInfoFeature
}, pluginFeaturePicacgApi = {
    PICACG_ENDPOINT_PATHS,
    PICACG_TAG_NAMESPACES,
    normalizePicacgBaseUrl,
    buildPicacgEndpointUrl,
    buildPicacgQueryString,
    buildPicacgPathWithQuery,
    createPicacgRouteHelpers,
    resolvePicacgTagAction
}, pluginFeatureContractApi = {
    ...pluginFeatureGenericApi,
    ...pluginFeatureCopyLikeApi,
    ...pluginFeatureMhLikeApi,
    ...pluginFeaturePicacgApi
};

function __veneraGetRuntimeGlobal() {
    return "object" == typeof globalThis && null !== globalThis ? globalThis : {};
}

function __veneraNormalizeAuthorityPart(e, t, r) {
    const a = String(null == e ? "" : e).trim() || t;
    return r ? a.replace(/^\/+|\/+$/g, "") : a;
}

function resolvePluginUpdateUrl(e) {
    const t = __veneraGetRuntimeGlobal(), r = t.__VENERA_RELEASE_AUTHORITY__ && "object" == typeof t.__VENERA_RELEASE_AUTHORITY__ ? t.__VENERA_RELEASE_AUTHORITY__ : {}, a = __veneraNormalizeAuthorityPart(r.cdnOrigin, "https://cdn.jsdelivr.net", !1).replace(/\/+$/, ""), o = __veneraNormalizeAuthorityPart(r.providerPath, "gh", !0), i = __veneraNormalizeAuthorityPart(r.repository, "mythic3011/venera-configs", !0), s = __veneraNormalizeAuthorityPart(r.releaseRef, "main", !1), n = __veneraNormalizeAuthorityPart(r.artifactPathPrefix, "dist/plugins", !0), l = String(e || "").replace(/^\/+/, "");
    if (!l) return `${a}/${o}/${i}@${s}`;
    const u = n ? `${n}/${l}` : l;
    return `${a}/${o}/${i}@${s}/${l.startsWith(`${n}/`) ? l : u}`;
}

"undefined" != typeof module && module && module.exports && (module.exports = {
    resolveMappedCategoryTagAction,
    createMappedCategoryTagActionResolver,
    createSelfHostedReferenceCacheFeature,
    createSafeInitFeature,
    createStaticCategoryPart,
    createStoredCategoryPart,
    createOffsetSearchLoader,
    toSelfHostedTagArray,
    startsWithSelfHostedTagPrefix,
    extractSelfHostedTagValue,
    removeSelfHostedTagsByPrefix,
    filterSelfHostedDisplayTags,
    parseSelfHostedRatingValueFromTags,
    extractSelfHostedUrlEntriesFromTagMap,
    buildSelfHostedEmojiRatingTag,
    normalizeCopyLikeBaseUrl,
    buildCopyLikeApiUrl,
    buildCopyLikePageUrl,
    buildCopyLikeTokenHeader,
    buildCopyLikeBearerTokenHeader,
    buildCopyLikeRequestSigningMeta,
    buildCopyLikeHmacSignature,
    COPY_LIKE_ENDPOINT_PATHS,
    COPY_LIKE_FORM_URLENCODED_CONTENT_TYPE,
    withCopyLikeFormHeaders,
    buildCopyLikeEndpointUrl,
    buildCopyLikeQueryString,
    buildCopyLikeUrlWithQuery,
    buildCopyLikeRankingUrl,
    buildCopyLikeComicsUrl,
    buildCopyLikeSearchUrl,
    buildCopyLikeHomeIndexComicsUrl,
    buildCopyLikeFavoriteComicsUrl,
    buildCopyLikeComicDetailUrl,
    buildCopyLikeComicQueryUrl,
    buildCopyLikeGroupChaptersUrl,
    buildCopyLikeChapterUrl,
    normalizeCopyLikeCategoryParam,
    parseCopyLikeDetailAuthors,
    parseCopyLikeDetailTags,
    buildCopyLikeDetailTagMap,
    resolveCopyLikeTagAction,
    buildCopyLikeHomeSections,
    loadCopyLikeHomeSectionsModule,
    loadCopyLikeListModule,
    parseCopyLikeAuthorKeyword,
    loadCopyLikeSearchModule,
    createCopyLikeExploreFeature,
    createCopyLikeCategoryLoadFeature,
    createCopyLikeSearchLoadFeature,
    createCopyLikeCategoryRequestUrlBuilder,
    createCopyLikeSearchRequestUrlBuilders,
    createCopyLikeDetailTagMapper,
    createCopyLikeTagClickActionHandler,
    createCopyLikeExploreSectionsFeature,
    createCopyLikeCategoryLoaderFeature,
    createCopyLikeSearchLoaderFeature,
    MH_LIKE_USER_AGENT,
    MH_LIKE_ENDPOINT_PATHS,
    normalizeMhLikeId,
    normalizeMhLikeDomain,
    buildMhLikeBaseUrl,
    buildMhLikeHeaders,
    normalizeMhLikePath,
    buildMhLikeRelativeUrl,
    buildMhLikeApiBaseUrl,
    buildMhLikeCategoryUrl,
    buildMhLikeSearchUrl,
    buildMhLikeChapterListUrl,
    buildMhLikeChapterEndpointUrl,
    buildMhLikeChapterInfoUrl,
    buildMhLikeChapterContentUrl,
    createMhLikeRouteHelpers,
    parseMhLikeComicCards,
    parseMhLikeHomeSections,
    parseMhLikeMaxPage,
    parseMhLikeDetailTags,
    parseMhLikeRecommendComics,
    loadMhLikePagedComicsFromUrl,
    createMhLikeExploreFeature,
    createMhLikeCategoryLoadFeature,
    createMhLikeSearchLoadFeature,
    loadMhLikeBaseComicInfo,
    createMhLikeCategoryRequestUrlBuilder,
    createMhLikeSearchRequestUrlBuilder,
    createMhLikeChapterRequestUrlBuilders,
    buildMhLikeChapterUrl,
    createMhLikeExplorePageFeature,
    createMhLikeCategoryLoaderFeature,
    createMhLikeSearchLoaderFeature,
    loadMhLikeBaseComicInfoFeature,
    PICACG_ENDPOINT_PATHS,
    PICACG_TAG_NAMESPACES,
    normalizePicacgBaseUrl,
    buildPicacgEndpointUrl,
    buildPicacgQueryString,
    buildPicacgPathWithQuery,
    createPicacgRouteHelpers,
    resolvePicacgTagAction,
    pluginFeatureGenericApi,
    pluginFeatureCopyLikeApi,
    pluginFeatureMhLikeApi,
    pluginFeaturePicacgApi,
    pluginFeatureContractApi
}), "undefined" != typeof module && module && module.exports && (module.exports = {
    resolvePluginUpdateUrl
});

"use strict";

const LRR_ROUTES = createSelfHostedRouteHelpers(), LRR_TAG_PREFIXES = {
    rating: "rating:",
    dateAdded: "date_added:",
    source: "source:"
}, LRR_TAG_FILTER_PREFIXES = [ LRR_TAG_PREFIXES.rating, LRR_TAG_PREFIXES.dateAdded, LRR_TAG_PREFIXES.source ], LRR_SORT_KEYS = [ "title", "date_added", "lastread" ], LRR_ORDERS = [ "asc", "desc" ], LRR_BOOLS = [ "true", "false" ], LRR_TANK_INDEX_PAGES = 100, LRR_TANK_INDEX_INCOMPLETE = "LANraragi tank index is incomplete.", LRR_TANK_PAGE_FETCHES = 4, LRR_EXPLORE_RANDOM_COUNT = 20;

function unwrapLrrOption(e, t) {
    let r = e;
    if ("string" == typeof r) {
        const e = r.trim();
        if (e.length >= 2 && e.startsWith('"') && e.endsWith('"')) try {
            const t = JSON.parse(e);
            "string" != typeof t && "boolean" != typeof t && "number" != typeof t || (r = t);
        } catch (t) {
            r = e.slice(1, -1);
        }
        if ("string" == typeof r) {
            const e = r.indexOf("-");
            e > 0 && (r = r.slice(0, e));
        }
    }
    return !0 === r ? "true" : !1 === r ? "false" : null == r || "" === r ? t : String(r);
}

function lrrChoice(e, t, r) {
    const a = unwrapLrrOption(e, t);
    return r.indexOf(a) >= 0 ? a : t;
}

function isLrrTankId(e) {
    return /^TANK_[0-9]{10}$/.test(String(e || ""));
}

function isLrrArchiveId(e) {
    return /^[a-f0-9]{40}$/i.test(String(e || ""));
}

function lrrPagePath(e) {
    if ("string" != typeof e || 0 === e.length || e.length > 4096 || /[\u0000-\u001f\u007f\\?#]/.test(e) || "/" === e.charAt(0) || e.split("/").some(e => !e || "." === e || ".." === e) || /%(?:2e|2f|5c|00)/i.test(e)) throw "Unsafe LANraragi image filename.";
    return e;
}

function lrrPageKey(e, t, r) {
    const a = String(e || "").toLowerCase();
    if (!isLrrArchiveId(a)) throw "Invalid LANraragi archive ID.";
    if ("string" != typeof t || t.length > 8192) throw "Invalid LANraragi page URL.";
    let o = t;
    if (/^https?:\/\//i.test(o)) {
        const e = String(r || "").replace(/\/+$/, "");
        if (!o.startsWith(e + "/")) throw "Unexpected LANraragi page origin.";
        o = o.slice(e.length + 1);
    }
    o = o.replace(/^\.\//, "").replace(/^\//, "");
    const i = /^api\/archives\/([a-f0-9]{40})\/page[?&]path=([^&#]+)$/i.exec(o);
    if (!i || i[1].toLowerCase() !== a) throw "Unexpected LANraragi page URL format.";
    let s;
    try {
        s = decodeURIComponent(i[2].replace(/\+/g, " "));
    } catch (e) {
        throw "Invalid LANraragi image filename encoding.";
    }
    return "lrr-page:" + a + ":" + encodeURIComponent(lrrPagePath(s));
}

function lrrResolvePageKey(e, t) {
    const r = /^lrr-page:([a-f0-9]{40}):(.+)$/i.exec(String(e || ""));
    if (!r) throw "Invalid LANraragi image key.";
    const a = r[1].toLowerCase();
    let o;
    try {
        o = decodeURIComponent(r[2]);
    } catch (e) {
        throw "Invalid LANraragi image key encoding.";
    }
    return String(t || "").replace(/\/+$/, "") + "/api/archives/" + a + "/page?path=" + encodeURIComponent(lrrPagePath(o));
}

function lrrFingerprint(e) {
    let t = 2166136261;
    const r = String(e || "");
    for (let e = 0; e < r.length; e++) t ^= r.charCodeAt(e), t = Math.imul(t, 16777619);
    return (t >>> 0).toString(16);
}

function encodeLrrBearer(e) {
    const t = encodeURIComponent(String(e)), r = [];
    for (let e = 0; e < t.length; e++) "%" === t.charAt(e) ? (r.push(parseInt(t.slice(e + 1, e + 3), 16)),
    e += 2) : r.push(t.charCodeAt(e));
    const a = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let o = "";
    for (let e = 0; e < r.length; e += 3) {
        const t = r[e], i = e + 1 < r.length ? r[e + 1] : 0, s = e + 2 < r.length ? r[e + 2] : 0;
        o += a.charAt(t >> 2), o += a.charAt((3 & t) << 4 | i >> 4), o += e + 1 < r.length ? a.charAt((15 & i) << 2 | s >> 6) : "=",
        o += e + 2 < r.length ? a.charAt(63 & s) : "=";
    }
    return o;
}

function resolveLrrBaseUrl(e, t) {
    let r = String(e || "").trim();
    if (r || (r = String(t || "").trim()), !r || r.length > 2048 || /[\s\\\u0000-\u001f\u007f]/.test(r)) throw "Set a valid LANraragi API URL.";
    /^https?:\/\//i.test(r) || (r = `http://${r.replace(/^\/+/, "")}`), r = r.replace(/\/+$/, "");
    const a = /^(https?):\/\/([^/?#]+)(\/[^?#]*)?$/i.exec(r);
    if (!a || /[@%]/.test(a[2]) || !/^(?:[A-Za-z0-9._-]+(?::[0-9]{1,5})?|\[[0-9a-fA-F:.]+\](?::[0-9]{1,5})?)$/.test(a[2])) throw "Set a valid LANraragi API URL.";
    const o = /:([0-9]{1,5})$/.exec(a[2]);
    if (o && (Number(o[1]) < 1 || Number(o[1]) > 65535)) throw "Invalid LANraragi server port.";
    const i = a[3] || "";
    if (i && (i.indexOf("//") >= 0 || /%2f|%5c|%2e|%00/i.test(i) || i.split("/").some(e => "." === e || ".." === e))) throw "Unsafe LANraragi base path.";
    return r;
}
