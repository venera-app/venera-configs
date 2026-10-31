/** @type {import('./_venera_.js')} */
const LRR_ROUTES = createSelfHostedRouteHelpers();
const LRR_TAG_PREFIXES = {
  rating: "rating:",
  dateAdded: "date_added:",
  source: "source:",
};
const LRR_TAG_FILTER_PREFIXES = [
  LRR_TAG_PREFIXES.rating,
  LRR_TAG_PREFIXES.dateAdded,
  LRR_TAG_PREFIXES.source,
];
const LRR_SORT_KEYS = ["title", "date_added", "lastread"];
const LRR_ORDERS = ["asc", "desc"];
const LRR_BOOLS = ["true", "false"];

// Venera-Next may pass a select value as a JSON string ("false"). LANraragi
// rejects that quoted token: its OpenAPI booleans accept true/false only.
function unwrapLrrOption(value, fallback) {
  let v = value;
  if (typeof v === "string") {
    const trimmed = v.trim();
    if (
      trimmed.length >= 2 &&
      trimmed.startsWith('"') &&
      trimmed.endsWith('"')
    ) {
      try {
        const parsed = JSON.parse(trimmed);
        if (
          typeof parsed === "string" ||
          typeof parsed === "boolean" ||
          typeof parsed === "number"
        ) {
          v = parsed;
        }
      } catch (_) {
        v = trimmed.slice(1, -1);
      }
    }
    if (typeof v === "string") {
      const idx = v.indexOf("-");
      if (idx > 0) v = v.slice(0, idx);
    }
  }
  if (v === true) return "true";
  if (v === false) return "false";
  if (v === undefined || v === null || v === "") return fallback;
  return String(v);
}

function lrrChoice(value, fallback, allowed) {
  const token = unwrapLrrOption(value, fallback);
  return allowed.indexOf(token) >= 0 ? token : fallback;
}

function isLrrTankId(value) {
  return /^TANK_[0-9]{10}$/.test(String(value || ""));
}

function isLrrArchiveId(value) {
  return /^[a-f0-9]{40}$/i.test(String(value || ""));
}

class Lanraragi extends ComicSource {
  name = "Lanraragi";
  key = "lanraragi";
  version = "1.2.1";
  minAppVersion = "1.4.0";
  url = resolvePluginUpdateUrl("lanraragi.js");

  settings = {
    api: { title: "API", type: "input", default: "http://lrr.tvc-16.science" },
    apiKey: { title: "APIKEY", type: "input", default: "" },
  };

  get baseUrl() {
    return resolveSelfHostedBaseUrl(
      this.loadSetting("api"),
      this.settings.api.default,
    );
  }

  get headers() {
    const raw = this.loadSetting("apiKey");
    if (!raw) {
      return {};
    }
    return withBearer({}, encodeSelfHostedToken(raw));
  }

  // 临时的折中手段，app 尚不支持 api token 形式的授权判断（isLogged）
  account = {
    loginWithCookies: {
      fields: ["apiKey"],
      validate: function (cookies) {
        var provided = cookies && cookies.length > 0 ? cookies[0] : "";
        if (provided && provided.length > 0) {
          return true;
        }
        return false;
      },
    },
    logout: function () {
      this.deleteData("account");
    },
  };

  _toAbsoluteBaseUrl(baseUrl) {
    let base = String(baseUrl || "").trim().replace(/\/+$/, "");
    if (!base) {
      return "";
    }
    if (!/^https?:\/\//i.test(base)) {
      base = `http://${base.replace(/^\/+/, "")}`;
    }
    return base;
  }

  _mapArchiveComic(item, baseUrl) {
    const base = this._toAbsoluteBaseUrl(baseUrl);
    // A grouped tank is not an archive. /api/archives/TANK_… returns 400.
    const cover = isLrrTankId(item && item.arcid)
      ? ""
      : buildSelfHostedUrl(base, LRR_ROUTES.archiveThumbnailPath(item.arcid));
    const tagRating = this._extractRatingFromTags(item.tags);
    const stars = this._toStarsFromValue(tagRating ?? null);
    return new Comic({
      id: item.arcid,
      title: item.title || item.filename || item.arcid,
      subTitle: "",
      cover,
      tags: this._cleanListTags(item.tags),
      description:
        "页数: " +
        (item.pagecount || "") +
        " | 新: " +
        (item.isnew || "") +
        " | 扩展: " +
        (item.extension || ""),
      stars,
    });
  }

  // Parse various rating string/number formats and convert to 0-5 scale with 0.5 step
  _toStarsFromValue(v) {
    if (v === null || v === undefined) return null;
    const s = String(v).trim();
    if (s.length === 0) return null;

    // Support emoji star formats like '⭐⭐⭐' or '★★★' used by some Lanraragi setups
    if (s.includes("⭐") || s.includes("★")) {
      const count = (s.match(/⭐/g) || s.match(/★/g) || []).length;
      if (count >= 0) return Math.max(0, Math.min(5, count));
    }

    // fraction like 7/10 or 3/5
    if (s.includes("/")) {
      const parts = s.split("/");
      const num = parseFloat(parts[0]);
      const den = parseFloat(parts[1]) || 10;
      if (!isNaN(num) && !isNaN(den) && den > 0) {
        const scaled = (num / den) * 5;
        return Math.round(scaled * 2) / 2;
      }
    }

    // percentage like 78%
    if (s.includes("%")) {
      const num = parseFloat(s.replace("%", ""));
      if (!isNaN(num)) {
        const scaled = (num / 100) * 5;
        return Math.round(scaled * 2) / 2;
      }
    }

    // plain number
    const n = parseFloat(s);
    if (isNaN(n)) return null;
    // if number > 5 assume 10-point scale
    if (n > 5) {
      const scaled = n / 2;
      return Math.round(scaled * 2) / 2;
    }
    // else already 5-point or smaller
    return Math.round(n * 2) / 2;
  }

  // Extract rating value from tags (tags can be comma-separated string or array)
  _extractRatingFromTags(tags) {
    return parseSelfHostedRatingValueFromTags(tags, {
      prefix: LRR_TAG_PREFIXES.rating,
      caseSensitive: false,
      starSymbols: ["⭐", "★"],
    });
  }

  // Convert tags input (string comma-separated or array) to array of trimmed strings
  _tagsToArray(tags) {
    return toSelfHostedTagArray(tags);
  }

  // Clean tags for list display: remove rating:, date_added:, URL-like and source: entries
  _cleanListTags(tags) {
    return filterSelfHostedDisplayTags(tags, {
      blockedPrefixes: LRR_TAG_FILTER_PREFIXES,
      caseSensitive: false,
      excludeUrlLike: true,
    });
  }

  async init() {
    try {
      const url = buildSelfHostedUrlFromSource(this, LRR_ROUTES.categoriesPath());
      const res = await Network.get(url, this.headers);
      if (res.status !== 200) {
        this.saveData("categories", []);
        return;
      }
      let data = [];
      try {
        data = JSON.parse(res.body);
      } catch (_) {
        data = [];
      }
      if (!Array.isArray(data)) data = [];
      // Save full categories list
      this.saveData("categories", data);
      this.saveData("categories_ts", Date.now());

      if (Array.isArray(data)) {
        const favorites = Array.isArray(data)
          ? data.filter(
              (c) =>
                c &&
                (c.search === "" ||
                  c.search === null ||
                  typeof c.search === "undefined"),
            )
          : [];
        this.saveData("favorites", favorites);
        this.saveData("favorites_ts", Date.now());
      } else {
        this.saveData("favorites", []);
      }
    } catch (_) {
      this.saveData("categories", []);
    }
  }

  explore = [
    {
      title: "Lanraragi",
      type: "multiPageComicList",
      load: async (page = 1) => {
        const runSearch = createOffsetSearchLoader({
          path: LRR_ROUTES.searchPath,
          getOffsetKey: () => "explore_start",
          buildQuery: (_input, start) => ({
            sortby: "date_added",
            order: "desc",
            start: String(start),
          }),
          mapComic: (item, context) =>
            this._mapArchiveComic(item, context.base),
        });
        const result = await runSearch(this, { page });
        return { comics: result.comics, maxPage: result.maxPage };
      },
    },
  ];

  category = {
    title: "Lanraragi",
    parts: [
      {
        name: "ALL",
        type: "dynamic",
        loader: () => {
          const data = this.loadData("categories");
          if (!Array.isArray(data) || data.length === 0)
            throw "Please check your API settings or categories.";
          const items = [];
          for (const cat of data) {
            if (!cat) continue;
            const id = cat.id ?? cat._id ?? cat.name;
            const label = cat.name ?? String(id);
            try {
              items.push({
                label,
                target: new PageJumpTarget({
                  page: "category",
                  attributes: { category: id, param: null },
                }),
              });
            } catch (_) {
              items.push({
                label,
                target: {
                  page: "category",
                  attributes: { category: id, param: null },
                },
              });
            }
          }
          return items;
        },
      },
    ],
    enableRankingPage: false,
  };

  categoryComics = {
    load: async (category, param, options, page) => {
      const runSearch = createOffsetSearchLoader({
        path: LRR_ROUTES.searchPath,
        getOffsetKey: (input) => `category_start_${String(input.category || "")}`,
        buildQuery: (input, start) => ({
          category: input.category || "",
          sortby: "date_added",
          order: "desc",
          start: String(start),
        }),
        mapComic: (item, context) =>
          this._mapArchiveComic(item, context.base),
      });
      const result = await runSearch(this, { page, category });
      return { comics: result.comics, maxPage: result.maxPage };
    },
  };

  search = {
    load: async (keyword, options, page = 1) => {
      const raw = (key) => options && options[key];
      const sortby = lrrChoice(raw(0), "title", LRR_SORT_KEYS);
      const order = lrrChoice(raw(1), "asc", LRR_ORDERS);
      const newonly = lrrChoice(raw(2), "false", LRR_BOOLS);
      const untaggedonly = lrrChoice(raw(3), "false", LRR_BOOLS);
      const groupby = lrrChoice(raw(4), "true", LRR_BOOLS);

      const runSearch = createOffsetSearchLoader({
        path: LRR_ROUTES.searchPath,
        getOffsetKey: (input) =>
          `search_start_${encodeURIComponent(String(input.keyword || ""))}`,
        buildQuery: (input, start) => ({
          filter: String(input.keyword || "").trim(),
          sortby: input.sortby,
          order: input.order,
          newonly: input.newonly,
          untaggedonly: input.untaggedonly,
          groupby_tanks: input.groupby,
          start: String(start),
        }),
        mapComic: (item, context) =>
          this._mapArchiveComic(item, context.base),
      });
      const result = await runSearch(this, {
        page,
        keyword,
        sortby,
        order,
        newonly,
        untaggedonly,
        groupby,
      });
      return { comics: result.comics, maxPage: result.maxPage };
    },
    loadNext: async (keyword, options, next) => {
      const page = typeof next === "number" && next > 0 ? next : 1;
      return await this.search.load(keyword, options, page);
    },
    optionList: [
      {
        type: "select",
        options: ["title-按标题", "date_added-最新添加", "lastread-最近阅读"],
        label: "sortby",
        default: "title",
      },
      {
        type: "select",
        options: ["asc-升序", "desc-降序"],
        label: "order",
        default: "asc",
      },
      {
        type: "select",
        options: ["false-全部", "true-仅新"],
        label: "newonly",
        default: "false",
      },
      {
        type: "select",
        options: ["false-全部", "true-仅未打标签"],
        label: "untaggedonly",
        default: "false",
      },
      {
        type: "select",
        options: ["true-启用", "false-禁用"],
        label: "groupby_tanks",
        default: "true",
      },
    ],
    enableTagsSuggestions: false,
  };

  favorites = {
    multiFolder: true,
    singleFolderForSingleComic: false,

    addOrDelFavorite: async (comicId, folderId, isAdding, favoriteId) => {
      const hdrs = this.headers || {};
      if (!hdrs || Object.keys(hdrs).length === 0) {
        throw "API token required to modify favorites";
      }

      if (!folderId || String(folderId) === "-1") {
        throw "Invalid folder id";
      }

      const url = buildSelfHostedUrlFromSource(
        this,
        LRR_ROUTES.categoryArchivePath(folderId, comicId),
      );

      let res;
      if (isAdding) {
        res = await Network.put(url, hdrs);
      } else {
        // remove
        res = await Network.delete(url, hdrs);
      }

      if (res.status !== 200 && res.status !== 204)
        throw `Invalid status code: ${res.status}`;
      return "ok";
    },

    loadFolders: async (comicId) => {
      const data = this.loadData("favorites");
      const folders = {};
      if (Array.isArray(data)) {
        for (const cat of data) {
          if (!cat) continue;
          const id = cat.id ?? cat._id ?? cat.name;
          const label = cat.name ?? String(id);
          folders[String(id)] = label;
        }
      }

      const favorited = [];
      if (comicId) {
        try {
          const info = await this.comic.loadInfo(comicId);

          try {
            if (
              info &&
              (info.isFavorite === true || info.isFavorite === "true")
            ) {
              // Prefer explicit folders array if provided by loadInfo
              const infoFolders = Array.isArray(info.folders)
                ? info.folders.map((f) => String(f))
                : null;
              const added = new Set(favorited);
              if (infoFolders && infoFolders.length > 0) {
                for (const f of infoFolders) {
                  for (const [fid, fname] of Object.entries(folders)) {
                    if (f === fid || f === fname) {
                      added.add(fid);
                    }
                  }
                }
              }
              // assign deduped results back to favorited
              favorited.length = 0;
              for (const v of added) favorited.push(v);
            }
          } catch (_) {}

          const tags = info.tags || {};
          const possibleKeys = Object.keys(tags);
          for (const k of possibleKeys) {
            if (String(k).toLowerCase() === "category") {
              const vals = tags[k];
              if (Array.isArray(vals)) {
                for (const v of vals) {
                  // try to match category id or name
                  for (const [fid, fname] of Object.entries(folders)) {
                    if (String(v) === fid || String(v) === fname) {
                      if (!favorited.includes(fid)) favorited.push(fid);
                    }
                  }
                }
              }
            }
          }
        } catch (_) {}
      }

      return { folders: folders, favorited: favorited };
    },

    loadComics: async (page, folder) => {
      return await this.categoryComics.load(
        folder,
        null,
        [],
        typeof page === "number" && page > 0 ? page : 1,
      );
    },
  };

  async _loadTankInfo(id) {
    const tankId = String(id || "");
    if (!isLrrTankId(tankId)) throw "Invalid LANraragi tankoubon ID.";
    const url = buildSelfHostedUrlFromSource(this, `/api/tankoubons/${tankId}`);
    const res = await Network.get(url, this.headers);
    if (res.status !== 200) throw `Invalid status code: ${res.status}`;
    const data = JSON.parse(res.body);
    const rawArchives = data && Array.isArray(data.archives) ? data.archives : [];
    const archives = [];
    const seen = {};
    for (const raw of rawArchives) {
      if (!isLrrArchiveId(raw)) continue;
      const archiveId = String(raw).toLowerCase();
      if (Object.prototype.hasOwnProperty.call(seen, archiveId)) continue;
      seen[archiveId] = true;
      archives.push(archiveId);
      if (archives.length >= 2000) break;
    }
    if (!archives.length) throw "LANraragi tankoubon has no chapters.";

    const titles = {};
    const titled = archives.slice(0, 40);
    await Promise.all(
      titled.map(async (archiveId, index) => {
        titles[archiveId] = "Chapter " + (index + 1);
        try {
          const metaUrl = buildSelfHostedUrlFromSource(
            this,
            LRR_ROUTES.archiveMetadataPath(archiveId),
          );
          const metaRes = await Network.get(metaUrl, this.headers);
          if (metaRes.status !== 200) return;
          const meta = JSON.parse(metaRes.body);
          if (meta && typeof meta.title === "string" && meta.title.trim()) {
            titles[archiveId] = meta.title.trim().slice(0, 300);
          }
        } catch (_) {}
      }),
    );
    const chapters = {};
    for (let i = 0; i < archives.length; i++) {
      const archiveId = archives[i];
      chapters[archiveId] = titles[archiveId] || "Chapter " + (i + 1);
    }
    const cover = buildSelfHostedUrlFromSource(
      this,
      LRR_ROUTES.archiveThumbnailPath(archives[0]),
    );
    return {
      title: (data && (data.name || data.title)) || tankId,
      cover,
      description: (data && data.summary) || "",
      tags: {},
      stars: 0,
      chapters,
      isFavorite: false,
      folders: [],
    };
  }

  comic = {
    loadInfo: async (id) => {
      if (isLrrTankId(id)) return await this._loadTankInfo(id);
      const url = buildSelfHostedUrlFromSource(this, LRR_ROUTES.archiveMetadataPath(id));
      const res = await Network.get(url, this.headers);
      if (res.status !== 200) throw `Invalid status code: ${res.status}`;
      const data = JSON.parse(res.body);
      const cover = buildSelfHostedUrlFromSource(
        this,
        LRR_ROUTES.archiveThumbnailPath(id),
      );
      let flatTags = toSelfHostedTagArray(data.tags);
      const rating = extractSelfHostedTagValue(flatTags, LRR_TAG_PREFIXES.rating);
      flatTags = removeSelfHostedTagsByPrefix(flatTags, [LRR_TAG_PREFIXES.rating]);

      let uploadTime = null;
      const dateTag = extractSelfHostedTagValue(flatTags, LRR_TAG_PREFIXES.dateAdded);
      if (dateTag) {
        uploadTime = dateTag;
        flatTags = removeSelfHostedTagsByPrefix(flatTags, [
          LRR_TAG_PREFIXES.dateAdded,
        ]);
      }

      const nsMap = new Map();
      const nonNs = [];
      for (const t of flatTags) {
        const idx = t.indexOf(":");
        if (idx > 0) {
          const ns = t.slice(0, idx);
          const val = t.slice(idx + 1);
          if (!nsMap.has(ns)) nsMap.set(ns, []);
          nsMap.get(ns).push(val);
        } else {
          nonNs.push(t);
        }
      }

      const tagsObj = {};
      for (const [k, v] of nsMap.entries()) {
        tagsObj[k] = v;
      }
      tagsObj["Tags"] = nonNs;
      // Preserve special metadata fields
      tagsObj["Pages"] = [String(data.pagecount)];
      tagsObj["Extension"] = [data.extension];

      const urlEntries = extractSelfHostedUrlEntriesFromTagMap(tagsObj, {
        sourceNamespace: "source",
        sourceScheme: "https",
        skipKeys: ["Extension", "Pages"],
      });

      let summary = data.summary || "";
      if (urlEntries.length) {
        if (summary) summary += "\n";
        summary += "关联：" + urlEntries.join(", ");
      }

      let isFavorite = false;
      let folders = [];
      try {
        const catUrl = buildSelfHostedUrlFromSource(
          this,
          LRR_ROUTES.archiveCategoriesPath(id),
        );
        const catRes = await Network.get(catUrl, this.headers);
        if (catRes.status === 200) {
          let catData = [];
          try {
            catData = JSON.parse(catRes.body);
          } catch (_) {
            catData = [];
          }

          // Normalize common response shapes. Prefer explicit `categories` array.
          if (catData && typeof catData === "object") {
            if (Array.isArray(catData.categories)) catData = catData.categories;
            else if (Array.isArray(catData.data)) catData = catData.data;
            else if (!Array.isArray(catData)) catData = [];
          }

          if (Array.isArray(catData) && catData.length > 0) {
            // Find categories that actually contain this archive id in their `archives` list
            const matched = [];
            for (const c of catData) {
              const archives = Array.isArray(c.archives) ? c.archives : [];
              if (
                Array.isArray(archives) &&
                archives.some((a) => String(a) === String(id))
              ) {
                matched.push(c);
              }
            }

            if (matched.length > 0) {
              isFavorite = true;
              folders = matched.map((c) =>
                String(c.id ?? c._id ?? c.name ?? c),
              );
            }
          }
        }
      } catch (_) {
        /* ignore category detection errors */
      }

      const chapters = {};
      chapters[id] = data.title || "Local manga";
      let stars = this._toStarsFromValue(rating);
      // Ensure details page always has a numeric star value (0 if no rating),
      // otherwise UI may not allow submitting a rating.
      if (stars === null || stars === undefined) stars = 0;
      return {
        title: data.title || data.filename || id,
        cover,
        description: summary,
        uploadTime: uploadTime,
        tags: tagsObj,
        stars,
        chapters,
        isFavorite: isFavorite,
        folders: folders,
      };
    },
    loadThumbnails: async (id, next) => {
      if (isLrrTankId(id)) {
        const info = await this._loadTankInfo(id);
        const thumbnails = Object.keys(info.chapters || {}).map((archiveId) =>
          buildSelfHostedUrlFromSource(
            this,
            LRR_ROUTES.archiveThumbnailPath(archiveId),
          ),
        );
        return { thumbnails, next: null };
      }
      const metaUrl = buildSelfHostedUrlFromSource(
        this,
        LRR_ROUTES.archiveMetadataPath(id),
      );
      const res = await Network.get(metaUrl, this.headers);
      if (res.status !== 200) throw `Invalid status code: ${res.status}`;
      const data = JSON.parse(res.body);
      const pagecount = data.pagecount || 1;
      const thumbnails = [];
      for (let i = 1; i <= pagecount; i++)
        thumbnails.push(
          buildSelfHostedUrlFromSource(this, LRR_ROUTES.archiveThumbnailPath(id), {
            page: i,
          }),
        );
      return { thumbnails, next: null };
    },
    starRating: async (id, rating) => {
      // Only allow when API token (headers) is provided
      const hdrs = this.headers || {};
      if (!hdrs || Object.keys(hdrs).length === 0) {
        throw "API token required to submit rating";
      }

      // Fetch current metadata to preserve other tags
      const metaUrl = buildSelfHostedUrlFromSource(
        this,
        LRR_ROUTES.archiveMetadataPath(id),
      );
      const getRes = await Network.get(metaUrl, hdrs);
      if (getRes.status !== 200) throw `Invalid status code: ${getRes.status}`;
      let data = {};
      try {
        data = JSON.parse(getRes.body);
      } catch (_) {
        data = {};
      }

      let tagsArr = toSelfHostedTagArray(data.tags);
      tagsArr = removeSelfHostedTagsByPrefix(tagsArr, [LRR_TAG_PREFIXES.rating], {
        caseSensitive: false,
      });

      // if rating > 0, add emoji rating tag
      if (rating > 0) {
        tagsArr.push(buildSelfHostedEmojiRatingTag(rating, {
          prefix: LRR_TAG_PREFIXES.rating,
          symbol: "⭐",
        }));
      }

      const tagsStr = tagsArr.join(", ");
      const body = `tags=${encodeURIComponent(tagsStr)}`;
      const putUrl = buildSelfHostedUrlFromSource(
        this,
        LRR_ROUTES.archiveMetadataPath(id),
      );
      const putRes = await Network.put(
        putUrl,
        Object.assign({}, hdrs, {
          "Content-Type": "application/x-www-form-urlencoded",
        }),
        body,
      );
      if (putRes.status !== 200 && putRes.status !== 204)
        throw `Invalid status code: ${putRes.status}`;
      return "ok";
    },
    loadEp: async (comicId, epId) => {
      const archiveId = isLrrArchiveId(epId)
        ? String(epId).toLowerCase()
        : isLrrArchiveId(comicId)
          ? String(comicId).toLowerCase()
          : "";
      if (!archiveId) throw "Invalid LANraragi archive ID.";
      const base = (this.baseUrl || "").replace(/\/$/, "");
      const url = buildSelfHostedUrlFromSource(this, LRR_ROUTES.archiveFilesPath(archiveId), {
        force: "false",
      });
      const res = await Network.get(url, this.headers);
      if (res.status !== 200) throw `Invalid status code: ${res.status}`;
      const data = JSON.parse(res.body);
      const images = (data.pages || [])
        .map((p) => {
          if (!p) return null;
          const s = String(p);
          if (/^https?:\/\//i.test(s)) return s;
          return `${base}${s.startsWith("/") ? s : "/" + s}`;
        })
        .filter(Boolean);
      return { images };
    },
    onImageLoad: (url, comicId, epId) => {
      return {
        headers: this.headers,
      };
    },
    onThumbnailLoad: (url) => {
      return {
        headers: this.headers,
      };
    },
    // likeComic: async (id, isLike) => {},
    // loadComments: async (comicId, subId, page, replyTo) => {},
    // sendComment: async (comicId, subId, content, replyTo) => {},
    // likeComment: async (comicId, subId, commentId, isLike) => {},
    // voteComment: async (id, subId, commentId, isUp, isCancel) => {},
    // idMatch: null,
    onClickTag: (namespace, tag) => {
      // Pages 和 Extension 不可点击
      const ns = namespace ? String(namespace) : "";
      const nsLower = ns.toLowerCase();
      if (nsLower === "pages" || nsLower === "extension") return null;

      // always return a search for namespace:tag; if namespace missing, just tag
      let t = String(tag);
      if (t.includes(" ")) t = `"${t}"`;
      const keyword = ns ? `${ns}:${t}` : t;
      return { action: "search", keyword: keyword, param: null };
    },
    // link: { domains: ['example.com'], linkToId: (url) => null },
    enableTagsTranslate: true,
  };

  translation = {
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
      Extension: "文件类型",
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
      Extension: "Extension",
    },
  };
}
