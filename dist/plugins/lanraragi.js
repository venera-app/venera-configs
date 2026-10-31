class Lanraragi extends ComicSource {
    constructor(...e) {
        super(...e), this.name = "Lanraragi", this.key = "lanraragi", this.version = "1.2.1",
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
            title: "Lanraragi",
            type: "multiPageComicList",
            load: async (e = 1) => {
                const t = createOffsetSearchLoader({
                    path: LRR_ROUTES.searchPath,
                    getOffsetKey: () => "explore_start",
                    buildQuery: (e, t) => ({
                        sortby: "date_added",
                        order: "desc",
                        start: String(t)
                    }),
                    mapComic: (e, t) => this._mapArchiveComic(e, t.base)
                }), r = await t(this, {
                    page: e
                });
                return {
                    comics: r.comics,
                    maxPage: r.maxPage
                };
            }
        } ], this.category = {
            title: "Lanraragi",
            parts: [ {
                name: "ALL",
                type: "dynamic",
                loader: () => {
                    const e = this.loadData("categories");
                    if (!Array.isArray(e) || 0 === e.length) throw "Please check your API settings or categories.";
                    const t = [];
                    for (const i of e) {
                        var r, o, a;
                        if (!i) continue;
                        const e = null != (r = null != (o = i.id) ? o : i._id) ? r : i.name, n = null != (a = i.name) ? a : String(e);
                        try {
                            t.push({
                                label: n,
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
                                label: n,
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
            load: async (e, t, r, o) => {
                const a = createOffsetSearchLoader({
                    path: LRR_ROUTES.searchPath,
                    getOffsetKey: e => `category_start_${String(e.category || "")}`,
                    buildQuery: (e, t) => ({
                        category: e.category || "",
                        sortby: "date_added",
                        order: "desc",
                        start: String(t)
                    }),
                    mapComic: (e, t) => this._mapArchiveComic(e, t.base)
                }), i = await a(this, {
                    page: o,
                    category: e
                });
                return {
                    comics: i.comics,
                    maxPage: i.maxPage
                };
            }
        }, this.search = {
            load: async (e, t, r = 1) => {
                const o = e => t && t[e], a = lrrChoice(o(0), "title", LRR_SORT_KEYS), i = lrrChoice(o(1), "asc", LRR_ORDERS), n = lrrChoice(o(2), "false", LRR_BOOLS), s = lrrChoice(o(3), "false", LRR_BOOLS), l = lrrChoice(o(4), "true", LRR_BOOLS), u = createOffsetSearchLoader({
                    path: LRR_ROUTES.searchPath,
                    getOffsetKey: e => `search_start_${encodeURIComponent(String(e.keyword || ""))}`,
                    buildQuery: (e, t) => ({
                        filter: String(e.keyword || "").trim(),
                        sortby: e.sortby,
                        order: e.order,
                        newonly: e.newonly,
                        untaggedonly: e.untaggedonly,
                        groupby_tanks: e.groupby,
                        start: String(t)
                    }),
                    mapComic: (e, t) => this._mapArchiveComic(e, t.base)
                }), c = await u(this, {
                    page: r,
                    keyword: e,
                    sortby: a,
                    order: i,
                    newonly: n,
                    untaggedonly: s,
                    groupby: l
                });
                return {
                    comics: c.comics,
                    maxPage: c.maxPage
                };
            },
            loadNext: async (e, t, r) => {
                const o = "number" == typeof r && r > 0 ? r : 1;
                return await this.search.load(e, t, o);
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
            addOrDelFavorite: async (e, t, r, o) => {
                const a = this.headers || {};
                if (!a || 0 === Object.keys(a).length) throw "API token required to modify favorites";
                if (!t || "-1" === String(t)) throw "Invalid folder id";
                const i = buildSelfHostedUrlFromSource(this, LRR_ROUTES.categoryArchivePath(t, e));
                let n;
                if (n = r ? await Network.put(i, a) : await Network.delete(i, a), 200 !== n.status && 204 !== n.status) throw `Invalid status code: ${n.status}`;
                return "ok";
            },
            loadFolders: async e => {
                const t = this.loadData("favorites"), r = {};
                if (Array.isArray(t)) for (const e of t) {
                    var o, a, i;
                    if (!e) continue;
                    const t = null != (o = null != (a = e.id) ? a : e._id) ? o : e.name, n = null != (i = e.name) ? i : String(t);
                    r[String(t)] = n;
                }
                const n = [];
                if (e) try {
                    const t = await this.comic.loadInfo(e);
                    try {
                        if (t && (!0 === t.isFavorite || "true" === t.isFavorite)) {
                            const e = Array.isArray(t.folders) ? t.folders.map(e => String(e)) : null, o = new Set(n);
                            if (e && e.length > 0) for (const t of e) for (const [e, a] of Object.entries(r)) t !== e && t !== a || o.add(e);
                            n.length = 0;
                            for (const e of o) n.push(e);
                        }
                    } catch (e) {}
                    const o = t.tags || {}, a = Object.keys(o);
                    for (const e of a) if ("category" === String(e).toLowerCase()) {
                        const t = o[e];
                        if (Array.isArray(t)) for (const e of t) for (const [t, o] of Object.entries(r)) String(e) !== t && String(e) !== o || n.includes(t) || n.push(t);
                    }
                } catch (e) {}
                return {
                    folders: r,
                    favorited: n
                };
            },
            loadComics: async (e, t) => await this.categoryComics.load(t, null, [], "number" == typeof e && e > 0 ? e : 1)
        }, this.comic = {
            loadInfo: async e => {
                if (isLrrTankId(e)) return await this._loadTankInfo(e);
                const t = buildSelfHostedUrlFromSource(this, LRR_ROUTES.archiveMetadataPath(e)), r = await Network.get(t, this.headers);
                if (200 !== r.status) throw `Invalid status code: ${r.status}`;
                const o = JSON.parse(r.body), a = buildSelfHostedUrlFromSource(this, LRR_ROUTES.archiveThumbnailPath(e));
                let i = toSelfHostedTagArray(o.tags);
                const n = extractSelfHostedTagValue(i, LRR_TAG_PREFIXES.rating);
                i = removeSelfHostedTagsByPrefix(i, [ LRR_TAG_PREFIXES.rating ]);
                let s = null;
                const l = extractSelfHostedTagValue(i, LRR_TAG_PREFIXES.dateAdded);
                l && (s = l, i = removeSelfHostedTagsByPrefix(i, [ LRR_TAG_PREFIXES.dateAdded ]));
                const u = new Map, c = [];
                for (const e of i) {
                    const t = e.indexOf(":");
                    if (t > 0) {
                        const r = e.slice(0, t), o = e.slice(t + 1);
                        u.has(r) || u.set(r, []), u.get(r).push(o);
                    } else c.push(e);
                }
                const d = {};
                for (const [e, t] of u.entries()) d[e] = t;
                d.Tags = c, d.Pages = [ String(o.pagecount) ], d.Extension = [ o.extension ];
                const p = extractSelfHostedUrlEntriesFromTagMap(d, {
                    sourceNamespace: "source",
                    sourceScheme: "https",
                    skipKeys: [ "Extension", "Pages" ]
                });
                let h = o.summary || "";
                p.length && (h && (h += "\n"), h += "关联：" + p.join(", "));
                let y = !1, f = [];
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
                            for (const o of t) {
                                const t = Array.isArray(o.archives) ? o.archives : [];
                                Array.isArray(t) && t.some(t => String(t) === String(e)) && r.push(o);
                            }
                            r.length > 0 && (y = !0, f = r.map(e => {
                                var t, r, o;
                                return String(null != (t = null != (r = null != (o = e.id) ? o : e._id) ? r : e.name) ? t : e);
                            }));
                        }
                    }
                } catch (e) {}
                const g = {};
                g[e] = o.title || "Local manga";
                let m = this._toStarsFromValue(n);
                return null == m && (m = 0), {
                    title: o.title || o.filename || e,
                    cover: a,
                    description: h,
                    uploadTime: s,
                    tags: d,
                    stars: m,
                    chapters: g,
                    isFavorite: y,
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
                const r = buildSelfHostedUrlFromSource(this, LRR_ROUTES.archiveMetadataPath(e)), o = await Network.get(r, this.headers);
                if (200 !== o.status) throw `Invalid status code: ${o.status}`;
                const a = JSON.parse(o.body).pagecount || 1, i = [];
                for (let t = 1; t <= a; t++) i.push(buildSelfHostedUrlFromSource(this, LRR_ROUTES.archiveThumbnailPath(e), {
                    page: t
                }));
                return {
                    thumbnails: i,
                    next: null
                };
            },
            starRating: async (e, t) => {
                const r = this.headers || {};
                if (!r || 0 === Object.keys(r).length) throw "API token required to submit rating";
                const o = buildSelfHostedUrlFromSource(this, LRR_ROUTES.archiveMetadataPath(e)), a = await Network.get(o, r);
                if (200 !== a.status) throw `Invalid status code: ${a.status}`;
                let i = {};
                try {
                    i = JSON.parse(a.body);
                } catch (e) {
                    i = {};
                }
                let n = toSelfHostedTagArray(i.tags);
                n = removeSelfHostedTagsByPrefix(n, [ LRR_TAG_PREFIXES.rating ], {
                    caseSensitive: !1
                }), t > 0 && n.push(buildSelfHostedEmojiRatingTag(t, {
                    prefix: LRR_TAG_PREFIXES.rating,
                    symbol: "⭐"
                }));
                const s = n.join(", "), l = `tags=${encodeURIComponent(s)}`, u = buildSelfHostedUrlFromSource(this, LRR_ROUTES.archiveMetadataPath(e)), c = await Network.put(u, Object.assign({}, r, {
                    "Content-Type": "application/x-www-form-urlencoded"
                }), l);
                if (200 !== c.status && 204 !== c.status) throw `Invalid status code: ${c.status}`;
                return "ok";
            },
            loadEp: async (e, t) => {
                const r = isLrrArchiveId(t) ? String(t).toLowerCase() : isLrrArchiveId(e) ? String(e).toLowerCase() : "";
                if (!r) throw "Invalid LANraragi archive ID.";
                const o = (this.baseUrl || "").replace(/\/$/, ""), a = buildSelfHostedUrlFromSource(this, LRR_ROUTES.archiveFilesPath(r), {
                    force: "false"
                }), i = await Network.get(a, this.headers);
                if (200 !== i.status) throw `Invalid status code: ${i.status}`;
                return {
                    images: (JSON.parse(i.body).pages || []).map(e => {
                        if (!e) return null;
                        const t = String(e);
                        return /^https?:\/\//i.test(t) ? t : `${o}${t.startsWith("/") ? t : "/" + t}`;
                    }).filter(Boolean)
                };
            },
            onImageLoad: (e, t, r) => ({
                headers: this.headers
            }),
            onThumbnailLoad: e => ({
                headers: this.headers
            }),
            onClickTag: (e, t) => {
                const r = e ? String(e) : "", o = r.toLowerCase();
                if ("pages" === o || "extension" === o) return null;
                let a = String(t);
                return a.includes(" ") && (a = `"${a}"`), {
                    action: "search",
                    keyword: r ? `${r}:${a}` : a,
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
        return resolveSelfHostedBaseUrl(this.loadSetting("api"), this.settings.api.default);
    }
    get headers() {
        const e = this.loadSetting("apiKey");
        return e ? withBearer({}, encodeSelfHostedToken(e)) : {};
    }
    _toAbsoluteBaseUrl(e) {
        let t = String(e || "").trim().replace(/\/+$/, "");
        return t ? (/^https?:\/\//i.test(t) || (t = `http://${t.replace(/^\/+/, "")}`),
        t) : "";
    }
    _mapArchiveComic(e, t) {
        const r = this._toAbsoluteBaseUrl(t), o = isLrrTankId(e && e.arcid) ? "" : buildSelfHostedUrl(r, LRR_ROUTES.archiveThumbnailPath(e.arcid)), a = this._extractRatingFromTags(e.tags), i = this._toStarsFromValue(null != a ? a : null);
        return new Comic({
            id: e.arcid,
            title: e.title || e.filename || e.arcid,
            subTitle: "",
            cover: o,
            tags: this._cleanListTags(e.tags),
            description: "页数: " + (e.pagecount || "") + " | 新: " + (e.isnew || "") + " | 扩展: " + (e.extension || ""),
            stars: i
        });
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
            const e = t.split("/"), r = parseFloat(e[0]), o = parseFloat(e[1]) || 10;
            if (!isNaN(r) && !isNaN(o) && o > 0) {
                const e = r / o * 5;
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
        try {
            const e = buildSelfHostedUrlFromSource(this, LRR_ROUTES.categoriesPath()), t = await Network.get(e, this.headers);
            if (200 !== t.status) return void this.saveData("categories", []);
            let r = [];
            try {
                r = JSON.parse(t.body);
            } catch (e) {
                r = [];
            }
            if (Array.isArray(r) || (r = []), this.saveData("categories", r), this.saveData("categories_ts", Date.now()),
            Array.isArray(r)) {
                const e = Array.isArray(r) ? r.filter(e => e && ("" === e.search || null === e.search || void 0 === e.search)) : [];
                this.saveData("favorites", e), this.saveData("favorites_ts", Date.now());
            } else this.saveData("favorites", []);
        } catch (e) {
            this.saveData("categories", []);
        }
    }
    async _loadTankInfo(e) {
        const t = String(e || "");
        if (!isLrrTankId(t)) throw "Invalid LANraragi tankoubon ID.";
        const r = buildSelfHostedUrlFromSource(this, `/api/tankoubons/${t}`), o = await Network.get(r, this.headers);
        if (200 !== o.status) throw `Invalid status code: ${o.status}`;
        const a = JSON.parse(o.body), i = a && Array.isArray(a.archives) ? a.archives : [], n = [], s = {};
        for (const e of i) {
            if (!isLrrArchiveId(e)) continue;
            const t = String(e).toLowerCase();
            if (!Object.prototype.hasOwnProperty.call(s, t) && (s[t] = !0, n.push(t), n.length >= 2e3)) break;
        }
        if (!n.length) throw "LANraragi tankoubon has no chapters.";
        const l = {}, u = n.slice(0, 40);
        await Promise.all(u.map(async (e, t) => {
            l[e] = "Chapter " + (t + 1);
            try {
                const t = buildSelfHostedUrlFromSource(this, LRR_ROUTES.archiveMetadataPath(e)), r = await Network.get(t, this.headers);
                if (200 !== r.status) return;
                const o = JSON.parse(r.body);
                o && "string" == typeof o.title && o.title.trim() && (l[e] = o.title.trim().slice(0, 300));
            } catch (e) {}
        }));
        const c = {};
        for (let e = 0; e < n.length; e++) {
            const t = n[e];
            c[t] = l[t] || "Chapter " + (e + 1);
        }
        const d = buildSelfHostedUrlFromSource(this, LRR_ROUTES.archiveThumbnailPath(n[0]));
        return {
            title: a && (a.name || a.title) || t,
            cover: d,
            description: a && a.summary || "",
            tags: {},
            stars: 0,
            chapters: c,
            isFavorite: !1,
            folders: []
        };
    }
}

function runtimeGet(e, t) {
    return Network.get(e, t);
}

async function getRuntimeJson(e, t, r) {
    const o = await runtimeGet(e, t);
    return assertRuntimeStatus(o, 200, r || e), parseRuntimeJsonBody(o, r || e);
}

async function getRuntimeDocument(e, t, r) {
    const o = await runtimeGet(e, t);
    return assertRuntimeStatus(o, 200, r || e), new HtmlDocument(o.body);
}

async function getSelfHostedJson(e, t, r, o) {
    if (!e || "object" != typeof e) throw new Error("getSelfHostedJson requires plugin source");
    const a = o && "object" == typeof o && !Array.isArray(o) ? o : {}, i = a.headers || e.headers, n = await Network.get(e.buildUrl(t, r), i);
    return ensureSelfHostedHttpOk(n, a), parseSelfHostedJsonBody(n.body);
}

async function postSelfHostedJson(e, t, r, o, a) {
    if (!e || "object" != typeof e) throw new Error("postSelfHostedJson requires plugin source");
    const i = a && "object" == typeof a && !Array.isArray(a) ? a : {}, n = i.headers || e.headers, s = await Network.post(e.buildUrl(t, r), n, o);
    return ensureSelfHostedHttpOk(s, i), {
        body: parseSelfHostedJsonBody(s.body),
        headers: s.headers || {}
    };
}

function defaultManagedDomainKey(e) {
    try {
        return new URL(String(e || "")).hostname || "default";
    } catch (e) {
        return "default";
    }
}

function defaultManagedDispatch(e, t, r, o) {
    return "GET" === e ? Network.get(t, r) : "POST" === e ? Network.post(t, r, o) : Network.sendRequest(e, t, r, o);
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
    const r = t && "object" == typeof t && !Array.isArray(t) ? t : {}, o = r.unauthorizedMessage || "Login expired", a = r.requestFailedMessage || "请求失败";
    if (!e) throw a;
    if (401 === e.status || 403 === e.status) throw o;
    if (e.status < 200 || e.status >= 300) throw `${a}: ${e.status}`;
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

function defaultRequestKey(e, t, r, o) {
    return o ? null : `${e}:${t}`;
}

function createDomainQueue(e, t, r) {
    const o = (e.queues.get(t) || Promise.resolve()).then(r, r), a = o.then(() => {}, () => {});
    return e.queues.set(t, a), a.finally(() => {
        e.queues.get(t) === a && e.queues.delete(t);
    }), o;
}

function markCooldown(e, t, r) {
    e.cooldownUntil.set(t, Date.now() + r);
}

ManagedRequestClient.prototype.get = function(e, t, r) {
    return this.send("GET", e, t || {}, null, r || {});
}, ManagedRequestClient.prototype.post = function(e, t, r, o) {
    return this.send("POST", e, t || {}, null == r ? null : r, o || {});
}, ManagedRequestClient.prototype.head = function(e, t, r) {
    return this.send("HEAD", e, t || {}, null, r || {});
}, ManagedRequestClient.prototype.send = async function(e, t, r, o, a) {
    const i = this.source, n = a && "object" == typeof a && !Array.isArray(a) ? a : {}, s = null == n.mutation ? "GET" !== e : !0 === n.mutation, l = n.requestKey || defaultRequestKey(e, t, o, s), u = "function" == typeof this.hooks.domainKeyResolver ? this.hooks.domainKeyResolver : defaultManagedDomainKey, c = {
        action: n.action || `${e} ${t}`,
        requestKey: l,
        domainKey: n.domainKey || u(t, e, o, n, i, this),
        expectedStatus: null == n.expectedStatus ? 200 : n.expectedStatus,
        maxRetries: null == n.maxRetries ? "GET" === e ? 1 : 0 : n.maxRetries,
        cooldownMs: null == n.cooldownMs ? 6e4 : n.cooldownMs,
        classifyBody: null == n.classifyBody || n.classifyBody,
        mutation: s,
        allowDedup: null == n.allowDedup ? !s : n.allowDedup
    }, d = i.requestState.cooldownUntil.get(c.domainKey);
    if (d && d > Date.now()) throw `${c.action} blocked: temporary cooldown in effect`;
    const p = this._resolveHeaders(e, t, r || {}, c), h = c.requestKey;
    if (c.allowDedup && h && i.requestState.inflight.has(h)) return i.requestState.inflight.get(h);
    const y = createDomainQueue(i.requestState, c.domainKey, () => this._sendWithRetry(e, t, p, o, c));
    c.allowDedup && h && i.requestState.inflight.set(h, y);
    try {
        return await y;
    } finally {
        c.allowDedup && h && i.requestState.inflight.delete(h);
    }
}, ManagedRequestClient.prototype._resolveHeaders = function(e, t, r, o) {
    return "function" == typeof this.hooks.buildHeaders ? this.hooks.buildHeaders(e, t, r, o, this.source, this) : this.source && "function" == typeof this.source.buildRequestHeaders ? this.source.buildRequestHeaders(e, t, r || {}, o || {}) : r || {};
}, ManagedRequestClient.prototype._sendWithRetry = async function(e, t, r, o, a) {
    let i = 0;
    const n = Math.max(0, a.maxRetries) + 1;
    for (;i < n; ) {
        let s;
        i += 1;
        try {
            s = await this._dispatch(e, t, r, o, a);
        } catch (e) {
            if (i >= n) throw defaultManagedRequestError(this.source, a.action, e);
            continue;
        }
        if (this._shouldCooldown(s, a)) throw this._markCooldown(a.domainKey, a.cooldownMs),
        defaultManagedResponseError(this.source, a.action, s);
        if (s.status === a.expectedStatus) return s;
        if (i >= n || a.mutation) throw defaultManagedResponseError(this.source, a.action, s);
    }
    throw `${a.action} failed after retries`;
}, ManagedRequestClient.prototype._dispatch = function(e, t, r, o, a) {
    return "function" == typeof this.hooks.dispatch ? this.hooks.dispatch(e, t, r, o, a, this.source, this) : defaultManagedDispatch(e, t, r, o);
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
    const o = {
        ...e || {}
    };
    return r ? (o.Authorization = `${t} ${r}`, o) : o;
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
    const r = normalizeSelfHostedPathRoot(e, "/"), o = Array.isArray(t) ? t : [];
    let a = r;
    for (const e of o) {
        const t = normalizeSelfHostedPathSegment(e);
        t && (a = `${a}/${t}`);
    }
    return a;
}

function createSelfHostedRouteHelpers(e) {
    const t = e && "object" == typeof e && !Array.isArray(e) ? e : {}, r = normalizeSelfHostedPathRoot(t.apiRoot, "/api"), o = normalizeSelfHostedPathRoot(t.archivesRoot, `${r}/archives`), a = normalizeSelfHostedPathRoot(t.categoriesRoot, `${r}/categories`), i = normalizeSelfHostedPathRoot(t.searchPath, `${r}/search`);
    return {
        apiRoot: r,
        archivesRoot: o,
        categoriesRoot: a,
        searchPath: i,
        categoriesPath: () => a,
        categoryArchivePath: (e, t) => joinSelfHostedPath(a, [ e, t ]),
        archivePath: e => joinSelfHostedPath(o, [ e ]),
        archiveMetadataPath: e => joinSelfHostedPath(o, [ e, "metadata" ]),
        archiveThumbnailPath: e => joinSelfHostedPath(o, [ e, "thumbnail" ]),
        archiveCategoriesPath: e => joinSelfHostedPath(o, [ e, "categories" ]),
        archiveFilesPath: e => joinSelfHostedPath(o, [ e, "files" ])
    };
}

function normalizeWebSourceBaseUrl(e, t) {
    const r = t && "object" == typeof t && !Array.isArray(t) ? t : {}, o = "string" == typeof r.defaultScheme ? r.defaultScheme.trim() : "";
    let a = String(e || "").trim();
    return a ? (o && !/^https?:\/\//i.test(a) && (a = `${o.replace(/:$/, "")}://${a}`),
    a.replace(/\/+$/, "")) : "";
}

function normalizeWebSourcePath(e, t) {
    const r = String(null == e ? t || "" : e).trim();
    return r ? /^https?:\/\//i.test(r) || r.startsWith("//") || r.startsWith("/") ? r : `/${r}` : "";
}

function joinWebSourcePath(e, t) {
    const r = normalizeWebSourcePath(e, "/"), o = Array.isArray(t) ? t : [];
    let a = r;
    for (const e of o) {
        const t = String(null == e ? "" : e).trim().replace(/^\/+|\/+$/g, "");
        t && (a = `${a}/${t}`);
    }
    return a;
}

function buildWebSourceQuery(e) {
    if (!e || "object" != typeof e) return "";
    const t = [];
    for (const r of Object.keys(e)) {
        const o = e[r];
        if (null != o && "" !== o) if (Array.isArray(o)) for (const e of o) null != e && "" !== e && t.push(`${encodeURIComponent(r)}=${encodeURIComponent(String(e))}`); else t.push(`${encodeURIComponent(r)}=${encodeURIComponent(String(o))}`);
    }
    return t.join("&");
}

function buildWebSourceUrl(e, t, r) {
    const o = normalizeWebSourceBaseUrl(e || ""), a = normalizeWebSourcePath(t, "");
    let i = a;
    /^https?:\/\//i.test(a) || a.startsWith("//") || (i = a ? `${o}${a.startsWith("/") ? "" : "/"}${a}` : o);
    const n = buildWebSourceQuery(r);
    return n ? `${i}${i.includes("?") ? "&" : "?"}${n}` : i;
}

function toWebSourceAbsoluteUrl(e, t) {
    const r = String(e || "").trim();
    return r ? /^https?:\/\//i.test(r) ? r : r.startsWith("//") ? `${normalizeWebSourceBaseUrl(t || "", {
        defaultScheme: "https"
    }).startsWith("http://") ? "http:" : "https:"}${r}` : buildWebSourceUrl(t, r) : "";
}

function replaceWebSourceBaseUrl(e, t, r) {
    const o = String(e || "").trim(), a = normalizeWebSourceBaseUrl(t || ""), i = normalizeWebSourceBaseUrl(r || "");
    return o && a && i ? o === a ? i : o.startsWith(`${a}/`) ? `${i}${o.slice(a.length)}` : o : o;
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
    const o = r.replace(/\/+$/, "");
    return o.startsWith("/") ? o : `/${o}`;
}

function joinSelfHostedRoutePath(e, t) {
    const r = normalizeSelfHostedRoutePath(e, "/"), o = Array.isArray(t) ? t : [];
    let a = r;
    for (const e of o) {
        const t = String(null == e ? "" : e).trim().replace(/^\/+|\/+$/g, "");
        t && (a = `${a}/${t}`);
    }
    return a;
}

function createKomgaRouteHelpers(e) {
    const t = e && "object" == typeof e && !Array.isArray(e) ? e : {}, r = normalizeSelfHostedRoutePath(t.apiV1Root, "/api/v1"), o = normalizeSelfHostedRoutePath(t.apiV2Root, "/api/v2"), a = normalizeSelfHostedRoutePath(t.seriesWebRoot, "/series"), i = normalizeSelfHostedRoutePath(t.booksWebRoot, "/books"), n = joinSelfHostedRoutePath(r, [ "series" ]), s = joinSelfHostedRoutePath(r, [ "books" ]), l = joinSelfHostedRoutePath(r, [ "collections" ]);
    return {
        apiV1Root: r,
        apiV2Root: o,
        seriesWebRoot: a,
        booksWebRoot: i,
        librariesPath: () => joinSelfHostedRoutePath(r, [ "libraries" ]),
        seriesTagsPath: () => joinSelfHostedRoutePath(r, [ "tags", "series" ]),
        languagesPath: () => joinSelfHostedRoutePath(r, [ "languages" ]),
        collectionsPath: () => l,
        genresPath: () => joinSelfHostedRoutePath(r, [ "genres" ]),
        currentUserPath: () => joinSelfHostedRoutePath(o, [ "users", "me" ]),
        seriesPath: () => n,
        latestSeriesPath: () => joinSelfHostedRoutePath(n, [ "latest" ]),
        updatedSeriesPath: () => joinSelfHostedRoutePath(n, [ "updated" ]),
        collectionSeriesPath: e => joinSelfHostedRoutePath(l, [ e, "series" ]),
        seriesDetailsPath: e => joinSelfHostedRoutePath(n, [ e ]),
        seriesBooksPath: e => joinSelfHostedRoutePath(n, [ e, "books" ]),
        seriesThumbnailPath: e => joinSelfHostedRoutePath(n, [ e, "thumbnail" ]),
        seriesWebPath: e => joinSelfHostedRoutePath(a, [ e ]),
        bookDetailsPath: e => joinSelfHostedRoutePath(s, [ e ]),
        bookThumbnailPath: e => joinSelfHostedRoutePath(s, [ e, "thumbnail" ]),
        bookPagesPath: e => joinSelfHostedRoutePath(s, [ e, "pages" ]),
        bookPageImagePath: (e, t) => joinSelfHostedRoutePath(s, [ e, "pages", t ]),
        bookWebPath: e => joinSelfHostedRoutePath(i, [ e ])
    };
}

function createKavitaRouteHelpers(e) {
    const t = e && "object" == typeof e && !Array.isArray(e) ? e : {}, r = normalizeSelfHostedRoutePath(t.apiRoot, "/api"), o = normalizeSelfHostedRoutePath(t.libraryRoot, `${r}/Library`), a = normalizeSelfHostedRoutePath(t.metadataRoot, `${r}/Metadata`), i = normalizeSelfHostedRoutePath(t.metadataLegacyRoot, `${r}/metadata`), n = normalizeSelfHostedRoutePath(t.accountRoot, `${r}/Account`), s = normalizeSelfHostedRoutePath(t.seriesRoot, `${r}/Series`), l = normalizeSelfHostedRoutePath(t.imageRoot, `${r}/Image`), u = normalizeSelfHostedRoutePath(t.readerRoot, `${r}/Reader`), c = normalizeSelfHostedRoutePath(t.searchRoot, `${r}/Search`);
    return {
        apiRoot: r,
        libraryRoot: o,
        metadataRoot: a,
        metadataLegacyRoot: i,
        accountRoot: n,
        seriesRoot: s,
        imageRoot: l,
        readerRoot: u,
        searchRoot: c,
        librariesPath: () => joinSelfHostedRoutePath(o, [ "libraries" ]),
        genresPath: () => joinSelfHostedRoutePath(a, [ "genres" ]),
        peopleByRolePath: () => joinSelfHostedRoutePath(i, [ "people-by-role" ]),
        loginPath: () => joinSelfHostedRoutePath(n, [ "login" ]),
        seriesV2Path: () => joinSelfHostedRoutePath(s, [ "v2" ]),
        seriesDetailsPath: e => joinSelfHostedRoutePath(s, [ e ]),
        seriesMetadataPath: () => joinSelfHostedRoutePath(s, [ "metadata" ]),
        seriesVolumesPath: () => joinSelfHostedRoutePath(s, [ "volumes" ]),
        seriesCoverPath: () => joinSelfHostedRoutePath(l, [ "series-cover" ]),
        chapterPath: () => joinSelfHostedRoutePath(s, [ "chapter" ]),
        readerImagePath: () => joinSelfHostedRoutePath(u, [ "image" ]),
        searchPath: () => joinSelfHostedRoutePath(c, [ "search" ])
    };
}

function resolveSelfHostedBaseUrl(e, t, r) {
    const o = r && "object" == typeof r && !Array.isArray(r) ? r : {}, a = "string" == typeof t ? t : "";
    let i = normalizeSelfHostedBaseUrl("string" == typeof e && e.trim() ? e.trim() : a);
    if (!i) return i;
    const n = "string" == typeof o.defaultScheme ? o.defaultScheme.trim() : "";
    return n && !/^https?:\/\//i.test(i) && (i = `${n.replace(/:$/, "")}://${i}`), normalizeSelfHostedBaseUrl(i);
}

function buildSelfHostedQuery(e) {
    if (!e) return "";
    const t = [];
    for (const r of Object.keys(e)) {
        const o = e[r];
        if (null != o) if (Array.isArray(o)) for (const e of o) null != e && t.push(`${encodeURIComponent(r)}=${encodeURIComponent(String(e))}`); else t.push(`${encodeURIComponent(r)}=${encodeURIComponent(String(o))}`);
    }
    return t.join("&");
}

function buildSelfHostedUrl(e, t, r) {
    let o = t;
    /^https?:\/\//i.test(t) || (o = `${normalizeSelfHostedBaseUrl(e || "")}${String(t).startsWith("/") ? "" : "/"}${t}`);
    const a = buildSelfHostedQuery(r);
    return a ? `${o}?${a}` : o;
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
    const o = Number(e.loadData(t) || 0);
    e.saveData(t, o + (r || 0));
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
    const o = r && "object" == typeof r && !Array.isArray(r) ? r : {}, a = null == o.namespace ? "标签" : String(o.namespace);
    if (String(e) !== a) throw o.unsupportedMessage || "Unsupported tag namespace";
    const i = o.mapping && "object" == typeof o.mapping ? o.mapping : {}, n = String(null == t ? "" : t), s = i[n], l = "function" == typeof o.keywordFormatter ? o.keywordFormatter(n, s, e) : n, u = "function" == typeof o.paramFormatter ? o.paramFormatter(n, s, e) : String(s);
    return {
        action: o.action || "category",
        keyword: l,
        param: u
    };
}

function createMappedCategoryTagActionResolver(e) {
    return (t, r) => resolveMappedCategoryTagAction(t, r, e);
}

function createSelfHostedReferenceCacheFeature(e) {
    const t = e && "object" == typeof e && !Array.isArray(e) ? e : {}, r = Number(t.ttlMs || 3e5), o = String(t.metaTimestampKey || ""), a = t.resetData && "object" == typeof t.resetData ? t.resetData : {}, i = "function" == typeof t.hasToken ? t.hasToken : () => !1, n = "function" == typeof t.loadPayload ? t.loadPayload : null, s = "function" == typeof t.savePayload ? t.savePayload : null, l = "function" == typeof t.shouldRethrow ? t.shouldRethrow : null;
    if (!o || !n || !s) throw new Error("Invalid createSelfHostedReferenceCacheFeature options");
    const u = e => {
        for (const [t, r] of Object.entries(a)) Array.isArray(r) ? e.saveData(t, r.slice()) : r && "object" == typeof r ? e.saveData(t, {
            ...r
        }) : e.saveData(t, r);
    };
    return async function(e, t) {
        if (!e || "object" != typeof e) throw new Error("refreshSelfHostedReferenceData requires plugin source");
        if (!i(e)) return void u(e);
        const a = Date.now(), c = Number(e.loadData(o) || 0);
        if (!(!t && c > 0 && a - c < r)) try {
            const t = await n(e);
            await s(e, t, a), e.saveData(o, a);
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

function createStaticCategoryPart(e, t, r, o) {
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
                        param: null == o ? null : o
                    }
                }
            } ];
        }
    };
}

function createStoredCategoryPart(e) {
    const t = e && "object" == typeof e && !Array.isArray(e) ? e : {}, r = String(t.partName || ""), o = String(t.storageKey || ""), a = "function" == typeof t.getLabel ? t.getLabel : null, i = "function" == typeof t.getCategory ? t.getCategory : null, n = "function" == typeof t.getParam ? t.getParam : null, s = !0 === t.usePageJumpTarget, l = "function" == typeof t.getSource ? t.getSource : null;
    if (!(r && o && a && i && n)) throw new Error("Invalid createStoredCategoryPart options");
    return {
        name: r,
        type: "dynamic",
        loader: function() {
            const e = l ? l() : this, t = e && "function" == typeof e.loadData ? e.loadData(o) : null;
            if (!Array.isArray(t) || !t.length) return [];
            const r = [];
            for (const e of t) {
                const t = a(e), o = i(e), l = n(e);
                if (!t || !o) continue;
                const u = {
                    category: o,
                    param: null == l ? null : l
                };
                let c;
                c = s && "function" == typeof PageJumpTarget ? new PageJumpTarget({
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
    const t = e && "object" == typeof e && !Array.isArray(e) ? e : {}, r = String(t.path || "/api/search"), o = "function" == typeof t.getOffsetKey ? t.getOffsetKey : null, a = "function" == typeof t.buildQuery ? t.buildQuery : null, i = "function" == typeof t.mapComic ? t.mapComic : null, n = "function" == typeof t.onResponse ? t.onResponse : null, s = String(t.statusErrorPrefix || "Invalid status code");
    if (!o || !a || !i) throw new Error("Invalid createOffsetSearchLoader options");
    return async function(e, t) {
        if (!e || "object" != typeof e) throw new Error("runOffsetSearch requires plugin source");
        const l = t && "object" == typeof t && !Array.isArray(t) ? t : {}, u = Number(l.page || 1), c = stripSelfHostedTrailingSlash(e.baseUrl), d = o(l), p = readSelfHostedOffset(e, d, u), h = buildSelfHostedQueryFromSource(a(l, p)), y = h ? `${c}${r}?${h}` : `${c}${r}`, f = await Network.get(y, e.headers);
        if (200 !== f.status) throw `${s}: ${f.status}`;
        const g = parseSelfHostedJsonBody(f.body) || {}, m = Array.isArray(g.data) ? g.data : [], C = m.map(t => i(t, {
            source: e,
            base: c,
            input: l
        })), S = m.length;
        updateSelfHostedOffset(e, d, S);
        const L = "number" == typeof g.recordsFiltered && g.recordsFiltered >= 0 ? g.recordsFiltered : p + S, k = S || 1, P = Math.max(1, Math.ceil(L / k));
        return n && n({
            source: e,
            input: l,
            start: p,
            returned: S,
            data: g,
            list: m,
            comics: C
        }), {
            comics: C,
            maxPage: P,
            data: g
        };
    };
}

function toSelfHostedTagArray(e, t) {
    const r = t && "object" == typeof t && !Array.isArray(t) ? t : {}, o = "string" == typeof r.delimiter ? r.delimiter : ",", a = "function" == typeof r.normalizeTag ? r.normalizeTag : e => String(e).trim();
    return e ? Array.isArray(e) ? e.map(e => a(e)).filter(Boolean) : String(e).split(o).map(e => a(e)).filter(Boolean) : [];
}

function startsWithSelfHostedTagPrefix(e, t, r) {
    const o = String(e || ""), a = String(t || "");
    return !!a && (!1 === r ? o.toLowerCase().startsWith(a.toLowerCase()) : o.startsWith(a));
}

function extractSelfHostedTagValue(e, t, r) {
    const o = r && "object" == typeof r && !Array.isArray(r) ? r : {}, a = !1 !== o.caseSensitive, i = "function" == typeof o.transform ? o.transform : e => e, n = toSelfHostedTagArray(e, o), s = String(t || "");
    for (const e of n) if (startsWithSelfHostedTagPrefix(e, s, a)) return i(String(e).slice(s.length).trim(), e);
    return null;
}

function removeSelfHostedTagsByPrefix(e, t, r) {
    const o = r && "object" == typeof r && !Array.isArray(r) ? r : {}, a = !1 !== o.caseSensitive, i = toSelfHostedTagArray(e, o), n = Array.isArray(t) ? t.map(e => String(e)) : [ String(t || "") ];
    return i.filter(e => !n.some(t => startsWithSelfHostedTagPrefix(e, t, a)));
}

function filterSelfHostedDisplayTags(e, t) {
    const r = t && "object" == typeof t && !Array.isArray(t) ? t : {}, o = Array.isArray(r.blockedPrefixes) ? r.blockedPrefixes : [], a = !0 === r.caseSensitive, i = !1 !== r.excludeUrlLike, n = "function" == typeof r.extraFilter ? r.extraFilter : null, s = toSelfHostedTagArray(e, r), l = [];
    for (const e of s) o.some(t => startsWithSelfHostedTagPrefix(e, t, a)) || i && String(e).includes("://") || n && !n(e) || l.push(e);
    return l;
}

function parseSelfHostedRatingValueFromTags(e, t) {
    const r = t && "object" == typeof t && !Array.isArray(t) ? t : {}, o = String(r.prefix || "rating:"), a = Array.isArray(r.starSymbols) ? r.starSymbols : [ "⭐", "★" ], i = extractSelfHostedTagValue(e, o, {
        caseSensitive: !0 === r.caseSensitive
    });
    if (!i) return null;
    if (a.some(e => String(i).includes(e))) {
        let e = 0;
        for (const t of a) {
            const r = String(t).replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&"), o = String(i).match(new RegExp(r, "g"));
            if (o && o.length > 0) {
                e = o.length;
                break;
            }
        }
        return String(e);
    }
    return String(i).trim();
}

function extractSelfHostedUrlEntriesFromTagMap(e, t) {
    const r = t && "object" == typeof t && !Array.isArray(t) ? t : {}, o = String(r.sourceNamespace || "source").toLowerCase(), a = String(r.sourceScheme || "https").replace(/:$/, ""), i = new Set(Array.isArray(r.skipKeys) ? r.skipKeys.map(e => String(e)) : []), n = [];
    if (!e || "object" != typeof e) return n;
    for (const t of Object.keys(e)) {
        if (i.has(t)) continue;
        const r = e[t];
        if (!Array.isArray(r)) continue;
        const s = [];
        for (const e of r) if ("string" == typeof e) if (e.includes("://")) n.push(e); else {
            if (String(t).toLowerCase() === o) {
                let t = e;
                t.startsWith("//") ? t = `${a}:${t}` : /^https?:\/\//i.test(t) || (t = `${a}://${t}`),
                n.push(t);
                continue;
            }
            s.push(e);
        } else s.push(e);
        e[t] = s;
    }
    return n;
}

function buildSelfHostedEmojiRatingTag(e, t) {
    const r = t && "object" == typeof t && !Array.isArray(t) ? t : {}, o = String(r.prefix || "rating:"), a = String(r.symbol || "⭐"), i = Number(e) / 2;
    return `${o}${a.repeat(i)}`;
}

function unwrapCopyLikeComic(e) {
    return e && null != e.comic ? e.comic : e || {};
}

function readCopyLikePath(e, t, r) {
    if (!Array.isArray(t) || 0 === t.length) return e;
    let o = e;
    for (const e of t) {
        if (null == o || "object" != typeof o || !(e in o)) return r;
        o = o[e];
    }
    return o;
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
    const o = e && null != e.sort ? e.sort : null;
    if (null == o) return null;
    const a = e.rise_sort || 0;
    return `${o} ${a > 0 ? "▲" : a < 0 ? "▽" : "-"}\n${r > 1 ? `${t} 等${r}位` : t}\n🔥${(Number(e.popular || 0) / 1e4).toFixed(1)}W`;
}

function computeCopyLikeMaxPage(e, t) {
    const r = Number.isFinite(Number(t)) && Number(t) > 0 ? Number(t) : 21, o = Number.isFinite(Number(e)) ? Number(e) : 0;
    return Math.floor((o - o % r) / r) + 1;
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
        const r = unwrapCopyLikeComic(e), o = parseCopyLikePrimaryAuthor(r), a = parseCopyLikeAuthorCount(r), i = {
            id: r.path_word,
            title: r.name,
            subTitle: o,
            cover: r.cover,
            tags: parseCopyLikeThemeTags(r)
        };
        if (t.includeRankingDescription) {
            const t = formatCopyLikeRankingDescription(e, o, a);
            if (null != t) return i.description = t, i;
        }
        if (t.includeUpdateDescription && (i.description = r.datetime_updated), "function" == typeof t.describe) {
            const n = t.describe({
                sourceComic: e,
                comic: r,
                author: o,
                authorCount: a
            });
            null != n && (i.description = n);
        }
        return i;
    };
}

function normalizeCopyLikeBaseUrl(e, t) {
    const r = String(t || "").trim().replace(/^https?:\/\//i, "").replace(/\/+$/, "");
    let o = String(e || "").trim();
    if (!o) return r;
    o = o.replace(/^https?:\/\//i, "").replace(/\/+$/, "");
    const a = o.indexOf("/");
    return a >= 0 && (o = o.slice(0, a)), o || r;
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
    const r = String(e || "").replace(/\/+$/, ""), o = String(t || "");
    return o ? o.startsWith("http://") || o.startsWith("https://") ? o : o.startsWith("/") ? `${r}${o}` : `${r}/${o}` : r;
}

function buildCopyLikeQueryString(e) {
    const t = [];
    for (const r of e || []) {
        if (!Array.isArray(r) || r.length < 2) continue;
        const e = r[0], o = r[1];
        null != e && null != o && t.push(`${String(e)}=${String(o)}`);
    }
    return t.join("&");
}

function buildCopyLikeUrlWithQuery(e, t, r) {
    const o = buildCopyLikeEndpointUrl(e, t), a = buildCopyLikeQueryString(r);
    return a ? `${o}?${a}` : o;
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
    const t = e || {}, r = null == t.limit ? 20 : t.limit, o = null == t.keyword ? "" : encodeURIComponent(String(t.keyword));
    return buildCopyLikeUrlWithQuery(t.apiUrl, t.endpointPath || COPY_LIKE_ENDPOINT_PATHS.SEARCH_COMIC, [ [ "platform", t.platform ], [ "q", o ], [ "limit", r ], [ "offset", null == t.offset ? buildOffsetByPage(t.page, r) : t.offset ], [ "free_type", t.freeType ], [ "_update", t.update ], [ "q_type", t.queryType ] ]);
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
    const r = t || {}, o = r.authorNamespace || "作者", a = r.updateNamespace || "更新", i = r.tagNamespace || "标签", n = r.statusNamespace || "状态", s = e && e.datetime_updated ? e.datetime_updated : "", l = e && e.status && e.status.display ? e.status.display : "";
    return {
        [o]: parseCopyLikeDetailAuthors(e),
        [a]: [ s ],
        [i]: parseCopyLikeDetailTags(e),
        [n]: [ l ]
    };
}

function resolveCopyLikeTagAction(e, t, r) {
    const o = r || {}, a = o.categoryNamespace || "标签", i = o.authorNamespace || "作者", n = o.unsupportedError || "未支持此类Tag检索";
    if (e === a) return {
        action: "category",
        keyword: `${t}`,
        param: null
    };
    if (e === i) return {
        action: "search",
        keyword: `${e}:${t}`,
        param: null
    };
    throw n;
}

function buildCopyLikeHomeSections(e, t, r) {
    const o = {};
    for (const a of t || []) {
        const t = readCopyLikePath(e, a.path, []);
        o[a.title] = Array.isArray(t) ? t.map(r) : [];
    }
    return o;
}

async function loadCopyLikeHomeSectionsModule(e) {
    return buildCopyLikeHomeSections(await getRuntimeJson(`${e.apiUrl}${e.endpoint || "/api/v3/h5/homeIndex"}`, e.headers, e.context || "copy_like home"), e.sections || [], e.parseComic);
}

async function loadCopyLikeListModule(e) {
    const t = await getRuntimeJson(e.requestUrl, e.headers, e.context || "copy_like list"), r = readCopyLikePath(t, e.listPath || [ "results", "list" ], []), o = readCopyLikePath(t, e.totalPath || [ "results", "total" ], 0);
    return {
        comics: Array.isArray(r) ? r.map(e.parseComic) : [],
        maxPage: computeCopyLikeMaxPage(o, e.maxPageDivisor || 21)
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
    return async (t, r, o, a) => loadCopyLikeListModule({
        requestUrl: e.buildRequestUrl({
            category: t,
            param: r,
            options: o,
            page: a
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
    return async (t, r, o) => loadCopyLikeSearchModule({
        keyword: t,
        options: r,
        page: o,
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
    return ({category: t, param: r, options: o, page: a}) => {
        const i = Array.isArray(o) ? o : [], n = !1 === e.normalizeOptions ? i : normalizeStarOptions(i), s = e.getApiUrl();
        if ("function" == typeof e.isRankingCategory && e.isRankingCategory(t, r)) return buildCopyLikeRankingUrl({
            apiUrl: s,
            page: a,
            limit: null == e.rankingLimit ? 30 : e.rankingLimit,
            freeType: e.rankingFreeType,
            audienceType: null == e.rankingAudienceOptionIndex ? void 0 : i[e.rankingAudienceOptionIndex],
            region: null == e.rankingRegionOptionIndex ? void 0 : i[e.rankingRegionOptionIndex],
            dateType: null == e.rankingDateOptionIndex ? void 0 : i[e.rankingDateOptionIndex]
        });
        if ("function" == typeof e.isHomepageCategory && e.isHomepageCategory(t, r)) return buildCopyLikeHomeIndexComicsUrl({
            apiUrl: s,
            page: a,
            limit: null == e.homepageLimit ? 20 : e.homepageLimit,
            top: r,
            ordering: null == e.homepageOrderingOptionIndex ? void 0 : i[e.homepageOrderingOptionIndex]
        });
        const l = normalizeCopyLikeCategoryParam(t, e.categoryParamMap, r);
        return buildCopyLikeComicsUrl({
            apiUrl: s,
            page: a,
            limit: null == e.themedLimit ? 30 : e.themedLimit,
            freeType: e.themedFreeType,
            ordering: null == e.themedOrderingOptionIndex ? void 0 : n[e.themedOrderingOptionIndex],
            theme: l || "",
            top: null == e.themedTopOptionIndex ? void 0 : n[e.themedTopOptionIndex]
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
        buildKeywordRequestUrl: ({keyword: t, options: r, page: o}) => {
            const a = Array.isArray(r) ? r : [], i = null == e.queryTypeOptionIndex ? e.queryTypeDefault : null != a[e.queryTypeOptionIndex] ? a[e.queryTypeOptionIndex] : e.queryTypeDefault;
            return buildCopyLikeSearchUrl({
                apiUrl: e.getApiUrl(),
                endpointPath: "function" == typeof e.getKeywordEndpointPath ? e.getKeywordEndpointPath() : e.keywordEndpointPath,
                page: o,
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
    const r = String(e || "").replace(/\/+$/, ""), o = String(t || "").trim();
    return o ? o.startsWith("http://") || o.startsWith("https://") ? o : o.startsWith("/") ? `${r}${o}` : `${r}/${o}` : r;
}

function buildMhLikeApiBaseUrl(e, t) {
    return buildMhLikeRelativeUrl(buildMhLikeBaseUrl(e), normalizeMhLikePath(t, "/api"));
}

function buildMhLikeCategoryUrl(e) {
    const t = e || {}, r = String(t.categoryPath || "").replace(/\/+$/, ""), o = normalizeMhLikePath(t.pageSegment, MH_LIKE_ENDPOINT_PATHS.CATEGORY_PAGE_SEGMENT);
    return buildMhLikeRelativeUrl(t.baseUrl, `${r}${o}/${t.page}`);
}

function buildMhLikeSearchUrl(e) {
    const t = e || {}, r = normalizeMhLikePath(t.searchPath, MH_LIKE_ENDPOINT_PATHS.SEARCH), o = encodeURIComponent(String(null == t.keyword ? "" : t.keyword));
    return buildMhLikeRelativeUrl(t.baseUrl, `${r}/${o}?page=${t.page}`);
}

function buildMhLikeChapterListUrl(e) {
    const t = e || {}, r = normalizeMhLikePath(t.chapterListPath, MH_LIKE_ENDPOINT_PATHS.CHAPTER_LIST), o = null == t.mode ? "all" : t.mode, a = null == t.timestamp ? Date.now() : t.timestamp;
    return buildMhLikeRelativeUrl(t.baseUrl, `${r}?mid=${t.mangaId}&mode=${o}&t=${a}`);
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
        buildChapterListUrl: ({mangaId: e, timestamp: r, mode: o}) => buildMhLikeChapterListUrl({
            baseUrl: t.baseUrl,
            mangaId: e,
            timestamp: r,
            mode: o,
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
    } ], o = e.querySelector(".pb-unit-md");
    if (o) for (let e of o.querySelectorAll(".slicarda")) r[0].comics.push(new Comic({
        id: e.attributes.href,
        title: e.querySelector("h3").text,
        cover: e.querySelector("img").attributes.src
    }));
    const a = e.querySelectorAll(".cardlist"), i = e.querySelectorAll(".hometitle");
    for (let e = 0; e < i.length; e += 1) {
        const o = i[e].querySelector("h2");
        r.push({
            title: o.text,
            comics: t(a[e]),
            viewMore: {
                page: "category",
                attributes: {
                    category: o.text,
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
    return async (t, r, o, a) => loadMhLikePagedComicsFromUrl({
        requestUrl: e.buildRequestUrl ? e.buildRequestUrl({
            category: t,
            params: r,
            options: o,
            page: a
        }) : buildMhLikeCategoryUrl({
            baseUrl: e.getBaseUrl(),
            categoryPath: r,
            page: a,
            pageSegment: e.categoryPageSegment
        }),
        headers: e.getHeaders(),
        parseComics: e.parseComics,
        context: e.context || "mh_like category"
    });
}

function createMhLikeSearchLoadFeature(e) {
    return async (t, r, o) => loadMhLikePagedComicsFromUrl({
        requestUrl: e.buildRequestUrl ? e.buildRequestUrl({
            keyword: t,
            options: r,
            page: o
        }) : buildMhLikeSearchUrl({
            baseUrl: e.getBaseUrl(),
            keyword: t,
            page: o,
            searchPath: e.searchPath
        }),
        headers: e.getHeaders(),
        parseComics: e.parseComics,
        context: e.context || "mh_like search"
    });
}

async function loadMhLikeBaseComicInfo(e) {
    const t = await getRuntimeDocument(e.detailUrl, e.headers, e.context || "mh_like comic detail"), r = t.querySelector(".text-xl").text.trim().split("   ")[0], o = t.querySelector(".object-cover").attributes.src, a = t.querySelector("p.text-medium").text;
    return {
        document: t,
        title: r,
        cover: o,
        description: a,
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
        buildChapterListRequestUrl: ({mangaId: e, timestamp: r, mode: o}) => buildMhLikeChapterListUrl({
            baseUrl: t.getBaseUrl(),
            mangaId: e,
            timestamp: r,
            mode: o,
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
    const r = "string" == typeof t ? String(t).trim() : "", o = "string" == typeof e && e.trim() ? e.trim() : r;
    return String(o || "").replace(/\/+$/, "");
}

function buildPicacgEndpointUrl(e, t) {
    const r = normalizePicacgBaseUrl(e), o = String(t || "").replace(/^\/+/, "");
    return r ? o ? `${r}/${o}` : r : o;
}

function buildPicacgQueryString(e) {
    const t = [];
    for (const r of e || []) {
        if (!Array.isArray(r) || r.length < 2) continue;
        const e = r[0], o = r[1];
        null != e && null != o && t.push(`${String(e)}=${String(o)}`);
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
    const o = r && "object" == typeof r && !Array.isArray(r) ? r : {}, a = o.authorNamespace || PICACG_TAG_NAMESPACES.AUTHOR, i = o.categoryNamespace || PICACG_TAG_NAMESPACES.CATEGORIES;
    return e === a ? {
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
        categoryComicsRequest: ({page: e, type: t, category: r, sort: o}) => createPicacgRequest(buildPicacgPathWithQuery(PICACG_ENDPOINT_PATHS.COMICS, [ [ "page", e ], [ t || "c", r ], [ "s", o ] ])),
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
    const o = String(null == e ? "" : e).trim() || t;
    return r ? o.replace(/^\/+|\/+$/g, "") : o;
}

function resolvePluginUpdateUrl(e) {
    const t = __veneraGetRuntimeGlobal(), r = t.__VENERA_RELEASE_AUTHORITY__ && "object" == typeof t.__VENERA_RELEASE_AUTHORITY__ ? t.__VENERA_RELEASE_AUTHORITY__ : {}, o = __veneraNormalizeAuthorityPart(r.cdnOrigin, "https://cdn.jsdelivr.net", !1).replace(/\/+$/, ""), a = __veneraNormalizeAuthorityPart(r.providerPath, "gh", !0), i = __veneraNormalizeAuthorityPart(r.repository, "mythic3011/venera-configs", !0), n = __veneraNormalizeAuthorityPart(r.releaseRef, "main", !1), s = __veneraNormalizeAuthorityPart(r.artifactPathPrefix, "dist/plugins", !0), l = String(e || "").replace(/^\/+/, "");
    if (!l) return `${o}/${a}/${i}@${n}`;
    const u = s ? `${s}/${l}` : l;
    return `${o}/${a}/${i}@${n}/${l.startsWith(`${s}/`) ? l : u}`;
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
}, LRR_TAG_FILTER_PREFIXES = [ LRR_TAG_PREFIXES.rating, LRR_TAG_PREFIXES.dateAdded, LRR_TAG_PREFIXES.source ], LRR_SORT_KEYS = [ "title", "date_added", "lastread" ], LRR_ORDERS = [ "asc", "desc" ], LRR_BOOLS = [ "true", "false" ];

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
    const o = unwrapLrrOption(e, t);
    return r.indexOf(o) >= 0 ? o : t;
}

function isLrrTankId(e) {
    return /^TANK_[0-9]{10}$/.test(String(e || ""));
}

function isLrrArchiveId(e) {
    return /^[a-f0-9]{40}$/i.test(String(e || ""));
}
