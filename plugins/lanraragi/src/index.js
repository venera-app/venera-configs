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
const LRR_TANK_INDEX_PAGES = 20;
const LRR_TANK_PAGE_FETCHES = 4;
const LRR_EXPLORE_RANDOM_COUNT = 20;

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

function lrrPagePath(value) {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > 4096 ||
    /[\u0000-\u001f\u007f\\?#]/.test(value) ||
    value.charAt(0) === "/" ||
    value.split("/").some((part) => !part || part === "." || part === "..") ||
    /%(?:2e|2f|5c|00)/i.test(value)
  ) {
    throw "Unsafe LANraragi image filename.";
  }
  return value;
}

// LANraragi documents both page?path= and page&path=. The reader stores a
// local key and only turns it back into a URL on this server.
function lrrPageKey(archiveId, rawValue, baseUrl) {
  const id = String(archiveId || "").toLowerCase();
  if (!isLrrArchiveId(id)) throw "Invalid LANraragi archive ID.";
  if (typeof rawValue !== "string" || rawValue.length > 8192) {
    throw "Invalid LANraragi page URL.";
  }
  let raw = rawValue;
  if (/^https?:\/\//i.test(raw)) {
    const base = String(baseUrl || "").replace(/\/+$/, "");
    if (!raw.startsWith(base + "/")) throw "Unexpected LANraragi page origin.";
    raw = raw.slice(base.length + 1);
  }
  raw = raw.replace(/^\.\//, "").replace(/^\//, "");
  const match = /^api\/archives\/([a-f0-9]{40})\/page[?&]path=([^&#]+)$/i.exec(raw);
  if (!match || match[1].toLowerCase() !== id) {
    throw "Unexpected LANraragi page URL format.";
  }
  let filename;
  try {
    filename = decodeURIComponent(match[2].replace(/\+/g, " "));
  } catch (_) {
    throw "Invalid LANraragi image filename encoding.";
  }
  return "lrr-page:" + id + ":" + encodeURIComponent(lrrPagePath(filename));
}

function lrrResolvePageKey(key, baseUrl) {
  const match = /^lrr-page:([a-f0-9]{40}):(.+)$/i.exec(String(key || ""));
  if (!match) throw "Invalid LANraragi image key.";
  const id = match[1].toLowerCase();
  let filename;
  try {
    filename = decodeURIComponent(match[2]);
  } catch (_) {
    throw "Invalid LANraragi image key encoding.";
  }
  const base = String(baseUrl || "").replace(/\/+$/, "");
  return (
    base +
    "/api/archives/" +
    id +
    "/page?path=" +
    encodeURIComponent(lrrPagePath(filename))
  );
}

function lrrFingerprint(value) {
  let hash = 2166136261;
  const text = String(value || "");
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

// Thumbnail callbacks are synchronous. Convert.encodeBase64 is a host bridge
// and is not guaranteed to return a string in that callback.
function encodeLrrBearer(value) {
  const escaped = encodeURIComponent(String(value));
  const bytes = [];
  for (let i = 0; i < escaped.length; i++) {
    if (escaped.charAt(i) === "%") {
      bytes.push(parseInt(escaped.slice(i + 1, i + 3), 16));
      i += 2;
    } else {
      bytes.push(escaped.charCodeAt(i));
    }
  }
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const c = i + 2 < bytes.length ? bytes[i + 2] : 0;
    out += chars.charAt(a >> 2);
    out += chars.charAt(((a & 3) << 4) | (b >> 4));
    out += i + 1 < bytes.length ? chars.charAt(((b & 15) << 2) | (c >> 6)) : "=";
    out += i + 2 < bytes.length ? chars.charAt(c & 63) : "=";
  }
  return out;
}

// A LAN box is often entered as 10.0.0.102:3000. Plain HTTP stays allowed:
// the default server is HTTP, and LANraragi on a private network usually is too.
function resolveLrrBaseUrl(rawValue, fallbackValue) {
  let value = String(rawValue || "").trim();
  if (!value) value = String(fallbackValue || "").trim();
  if (!value || value.length > 2048 || /[\s\\\u0000-\u001f\u007f]/.test(value)) {
    throw "Set a valid LANraragi API URL.";
  }
  if (!/^https?:\/\//i.test(value)) {
    value = `http://${value.replace(/^\/+/, "")}`;
  }
  value = value.replace(/\/+$/, "");
  const match = /^(https?):\/\/([^/?#]+)(\/[^?#]*)?$/i.exec(value);
  if (
    !match ||
    /[@%]/.test(match[2]) ||
    !/^(?:[A-Za-z0-9._-]+(?::[0-9]{1,5})?|\[[0-9a-fA-F:.]+\](?::[0-9]{1,5})?)$/.test(
      match[2],
    )
  ) {
    throw "Set a valid LANraragi API URL.";
  }
  const port = /:([0-9]{1,5})$/.exec(match[2]);
  if (port && (Number(port[1]) < 1 || Number(port[1]) > 65535)) {
    throw "Invalid LANraragi server port.";
  }
  const path = match[3] || "";
  if (
    path &&
    (path.indexOf("//") >= 0 ||
      /%2f|%5c|%2e|%00/i.test(path) ||
      path.split("/").some((part) => part === "." || part === ".."))
  ) {
    throw "Unsafe LANraragi base path.";
  }
  return value;
}

class Lanraragi extends ComicSource {
  name = "Lanraragi";
  key = "lanraragi";
  version = "1.2.6";
  minAppVersion = "1.4.0";
  url = resolvePluginUpdateUrl("lanraragi.js");

  settings = {
    api: { title: "API", type: "input", default: "http://lrr.tvc-16.science" },
    apiKey: { title: "APIKEY", type: "input", default: "" },
  };

  get baseUrl() {
    return this._identity().baseUrl;
  }

  _identity() {
    const rawApi = this.loadSetting("api");
    const rawKey = this.loadSetting("apiKey");
    const cached = this._identityCache;
    if (cached && cached.rawApi === rawApi && cached.rawKey === rawKey) {
      return cached;
    }
    const baseUrl = resolveLrrBaseUrl(rawApi, this.settings.api.default);
    const key = String(rawKey || "").trim();
    if (key.length > 512 || /[\r\n\u0000-\u001f\u007f]/.test(key)) {
      throw "Invalid LANraragi API Key.";
    }
    const authorization = key ? `Bearer ${encodeLrrBearer(key)}` : "";
    const authHeaders = authorization ? { Authorization: authorization } : {};
    const headers = authorization
      ? { Accept: "application/json", Authorization: authorization }
      : { Accept: "application/json" };
    const next = {
      rawApi,
      rawKey,
      baseUrl,
      key,
      stamp: lrrFingerprint(`${baseUrl}\n${key}`),
      authHeaders,
      headers,
    };
    this._identityCache = next;
    return next;
  }

  _apiKey() {
    return this._identity().key;
  }

  _serverStamp() {
    return this._identity().stamp;
  }

  _authHeaders() {
    const headers = this._identity().authHeaders;
    return headers.Authorization ? { Authorization: headers.Authorization } : {};
  }

  get headers() {
    const headers = this._identity().headers;
    return Object.assign({}, headers);
  }

  _loadScopedList(name) {
    if (this.loadData(`${name}_server`) !== this._serverStamp()) return [];
    const data = this.loadData(name);
    return Array.isArray(data) ? data : [];
  }

  _saveScopedList(name, stamp, data) {
    this.saveData(name, data);
    this.saveData(`${name}_server`, stamp);
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
    const raw = String(baseUrl || "").trim();
    if (!raw) return "";
    return resolveLrrBaseUrl(raw, "");
  }

  _mapArchiveComic(item, baseUrl) {
    const base = this._toAbsoluteBaseUrl(baseUrl);
    // TANK_ ids are not archives. /api/archives/TANK_…/thumbnail and /metadata
    // return 400. The member-archive cover is filled in after the tank index.
    const cover = isLrrTankId(item && item.arcid)
      ? ""
      : buildSelfHostedUrl(base, LRR_ROUTES.archiveThumbnailPath(item.arcid));
    const tagRating = this._extractRatingFromTags(item.tags);
    const stars = this._toStarsFromValue(tagRating ?? null);
    const pageCount =
      item && item.pagecount != null ? String(item.pagecount).trim() : "";
    const markedNew =
      item && (item.isnew === true || item.isnew === "true" || item.isnew === "1");
    const subTitle = [pageCount ? pageCount + "p" : "", markedNew ? "new" : ""]
      .filter(Boolean)
      .join(" · ");
    return new Comic({
      id: item.arcid,
      title: item.title || item.filename || item.arcid,
      subTitle,
      cover,
      tags: this._cleanListTags(item.tags),
      description: "",
      stars,
    });
  }

  _acceptTankPage(response) {
    if (
      !response ||
      typeof response !== "object" ||
      Array.isArray(response) ||
      !Array.isArray(response.result) ||
      response.result.length > 1000 ||
      !Number.isSafeInteger(Number(response.total)) ||
      Number(response.total) < 0 ||
      Number(response.total) > 100000
    ) {
      return null;
    }
    return response;
  }

  async _fetchTankPage(base, headers, page) {
    try {
      const url = buildSelfHostedUrl(base, "/api/tankoubons", {
        page: String(page),
      });
      const res = await Network.get(url, headers);
      if (!res || res.status !== 200) return null;
      return this._acceptTankPage(JSON.parse(res.body));
    } catch (_) {
      return null;
    }
  }

  async _fetchTankPageBatch(base, headers, startPage, count) {
    const out = new Array(count);
    let next = 0;
    const worker = async () => {
      while (next < count) {
        const index = next;
        next += 1;
        out[index] = await this._fetchTankPage(base, headers, startPage + index);
      }
    };
    const width = Math.min(LRR_TANK_PAGE_FETCHES, count);
    const workers = [];
    for (let i = 0; i < width; i++) workers.push(worker());
    await Promise.all(workers);
    return out;
  }

  _absorbTankPage(response, memberTank, covers, names, ambiguous) {
    for (const item of response.result) {
      if (!item || typeof item !== "object" || Array.isArray(item)) continue;
      if (!isLrrTankId(item.id) || !Array.isArray(item.archives)) continue;
      if (item.archives.length > 2000) continue;
      const members = [];
      const local = Object.create(null);
      for (const raw of item.archives) {
        if (typeof raw !== "string" || !isLrrArchiveId(raw)) continue;
        const archive = raw.toLowerCase();
        if (local[archive]) continue;
        local[archive] = true;
        members.push(archive);
      }
      if (!members.length) continue;
      covers[item.id] = members[0];
      if (typeof item.name === "string" && item.name.trim()) {
        names[item.id] = item.name.trim().slice(0, 300);
      }
      for (const archive of members) {
        if (ambiguous[archive]) continue;
        const existing = memberTank[archive];
        if (existing && existing !== item.id) {
          delete memberTank[archive];
          ambiguous[archive] = true;
          continue;
        }
        memberTank[archive] = item.id;
      }
    }
  }

  async _ensureTankIndex() {
    const idn = this._identity();
    const base = idn.baseUrl;
    const auth = idn.key;
    if (this._tankServer === base && this._tankAuth === auth && this._memberTank) {
      return;
    }
    if (
      this._tankIndexPromise &&
      this._tankIndexBase === base &&
      this._tankIndexAuth === auth
    ) {
      return await this._tankIndexPromise;
    }
    const generation = (this._tankGeneration || 0) + 1;
    this._tankGeneration = generation;
    const load = this._loadTankIndex(base, auth, Object.assign({}, idn.headers), generation);
    this._tankIndexPromise = load;
    this._tankIndexBase = base;
    this._tankIndexAuth = auth;
    try {
      await load;
    } finally {
      if (this._tankIndexPromise === load) this._tankIndexPromise = null;
    }
  }

  async _loadTankIndex(base, auth, headers, generation) {
    const memberTank = Object.create(null);
    const covers = Object.create(null);
    const names = Object.create(null);
    const ambiguous = Object.create(null);
    const first = await this._fetchTankPage(base, headers, 1);
    let seen = 0;
    let total = 0;
    if (first && first.result.length > 0) {
      this._absorbTankPage(first, memberTank, covers, names, ambiguous);
      seen = first.result.length;
      total = Number(first.total);
    }
    let page = 2;
    while (first && page <= LRR_TANK_INDEX_PAGES && seen < total) {
      const count = Math.min(LRR_TANK_PAGE_FETCHES, LRR_TANK_INDEX_PAGES - page + 1);
      const batch = await this._fetchTankPageBatch(base, headers, page, count);
      let stop = false;
      for (let i = 0; i < batch.length; i++) {
        const response = batch[i];
        if (!response || response.result.length === 0) {
          stop = true;
          break;
        }
        this._absorbTankPage(response, memberTank, covers, names, ambiguous);
        seen += response.result.length;
        total = Number(response.total);
        page += 1;
        if (seen >= total) {
          stop = true;
          break;
        }
      }
      if (stop) break;
    }
    if (
      this._tankGeneration !== generation ||
      this._identity().baseUrl !== base ||
      this._identity().key !== auth
    ) {
      return;
    }
    this._memberTank = memberTank;
    this._tankCover = covers;
    this._tankName = names;
    this._tankServer = base;
    this._tankAuth = auth;
  }

  _tankListComic(tankId, fallbackTitle, extras) {
    const coverArchive = this._tankCover && this._tankCover[tankId];
    const name = this._tankName && this._tankName[tankId];
    const cover = isLrrArchiveId(coverArchive)
      ? buildSelfHostedUrl(
          this._toAbsoluteBaseUrl(this.baseUrl),
          LRR_ROUTES.archiveThumbnailPath(String(coverArchive).toLowerCase()),
        )
      : "";
    const extra = extras && typeof extras === "object" ? extras : {};
    return new Comic({
      id: tankId,
      title: name || fallbackTitle || tankId,
      subTitle: extra.subTitle || "",
      cover,
      tags: extra.tags || [],
      description: extra.description || "",
      stars: extra.stars == null ? null : extra.stars,
    });
  }

  async _fetchTankCard(tankId) {
    try {
      const url = buildSelfHostedUrlFromSource(this, `/api/tankoubons/${tankId}`);
      const res = await Network.get(url, this.headers);
      if (!res || res.status !== 200) return null;
      const data = JSON.parse(res.body);
      if (!data || typeof data !== "object" || Array.isArray(data)) return null;
      const archives = Array.isArray(data.archives) ? data.archives : [];
      let cover = "";
      for (const raw of archives) {
        if (!isLrrArchiveId(raw)) continue;
        cover = String(raw).toLowerCase();
        break;
      }
      const name = typeof data.name === "string" ? data.name.trim().slice(0, 300) : "";
      return { name, cover };
    } catch (_) {
      return null;
    }
  }

  async _fillListedTanks(ids) {
    const stamp = this._serverStamp();
    if (!this._tankCards || this._tankCards.stamp !== stamp) {
      this._tankCards = { stamp, byId: Object.create(null) };
    }
    const missing = [];
    for (const id of ids) {
      if (!this._tankCards.byId[id]) missing.push(id);
    }
    if (!missing.length) return;
    const cards = new Array(missing.length);
    let next = 0;
    const worker = async () => {
      while (next < missing.length) {
        const index = next;
        next += 1;
        cards[index] = await this._fetchTankCard(missing[index]);
      }
    };
    const width = Math.min(LRR_TANK_PAGE_FETCHES, missing.length);
    const workers = [];
    for (let i = 0; i < width; i++) workers.push(worker());
    await Promise.all(workers);
    if (!this._tankCards || this._tankCards.stamp !== stamp) return;
    for (let i = 0; i < missing.length; i++) {
      if (cards[i]) this._tankCards.byId[missing[i]] = cards[i];
    }
  }

  _tankListComicFromCard(comic, card) {
    const cover = isLrrArchiveId(card && card.cover)
      ? buildSelfHostedUrl(
          this._toAbsoluteBaseUrl(this.baseUrl),
          LRR_ROUTES.archiveThumbnailPath(card.cover),
        )
      : comic.cover || "";
    return new Comic({
      id: comic.id,
      title: (card && card.name) || comic.title || comic.id,
      subTitle: comic.subTitle || "",
      cover,
      tags: comic.tags || [],
      description: comic.description || "",
      stars: comic.stars == null ? null : comic.stars,
    });
  }

  async _decorateListedComics(comics) {
    const list = Array.isArray(comics) ? comics : [];
    const ids = [];
    const seen = Object.create(null);
    for (const comic of list) {
      if (!comic || !isLrrTankId(comic.id) || seen[comic.id]) continue;
      seen[comic.id] = true;
      ids.push(comic.id);
    }
    if (!ids.length) return list;
    const idn = this._identity();
    const indexed =
      this._tankServer === idn.baseUrl &&
      this._tankAuth === idn.key &&
      this._memberTank;
    if (!indexed) {
      try {
        await this._fillListedTanks(ids);
      } catch (_) {
        return list;
      }
    }
    const cards =
      !indexed && this._tankCards && this._tankCards.stamp === this._serverStamp()
        ? this._tankCards.byId
        : null;
    return list.map((comic) => {
      if (!comic || !isLrrTankId(comic.id)) return comic;
      if (indexed) return this._tankListComic(comic.id, comic.title, comic);
      const card = cards && cards[comic.id];
      if (!card) return comic;
      return this._tankListComicFromCard(comic, card);
    });
  }

  async _loadRandomExplore() {
    const url = buildSelfHostedUrlFromSource(this, `${LRR_ROUTES.searchPath}/random`, {
      count: String(LRR_EXPLORE_RANDOM_COUNT),
      groupby_tanks: "true",
    });
    const res = await Network.get(url, this.headers);
    if (!res || res.status !== 200) {
      throw `Invalid status code: ${res ? res.status : 0}`;
    }
    let data;
    try {
      data = JSON.parse(res.body);
    } catch (_) {
      throw "Invalid LANraragi search response.";
    }
    const rows = data && Array.isArray(data.data) ? data.data : [];
    const comics = [];
    for (const item of rows) {
      if (!item || typeof item !== "object" || Array.isArray(item) || !item.arcid) {
        continue;
      }
      comics.push(this._mapArchiveComic(item, this.baseUrl));
    }
    return {
      comics: await this._decorateListedComics(comics),
      maxPage: 1,
    };
  }

  async _collapseTankItems(items) {
    const list = Array.isArray(items) ? items : [];
    try {
      await this._ensureTankIndex();
    } catch (_) {}
    const comics = [];
    const shown = {};
    for (const item of list) {
      if (!item || typeof item !== "object" || Array.isArray(item)) continue;
      if (isLrrTankId(item.arcid)) {
        if (shown[item.arcid]) continue;
        shown[item.arcid] = true;
        comics.push(this._tankListComic(item.arcid, item.title || item.filename));
        continue;
      }
      const rawId = String(item.arcid || "");
      if (!isLrrArchiveId(rawId)) {
        comics.push(this._mapArchiveComic(item, this.baseUrl));
        continue;
      }
      const tank = this._memberTank && this._memberTank[rawId.toLowerCase()];
      if (!isLrrTankId(tank)) {
        comics.push(this._mapArchiveComic(item, this.baseUrl));
        continue;
      }
      if (shown[tank]) continue;
      shown[tank] = true;
      comics.push(this._tankListComic(tank, item.title || item.filename));
    }
    return comics;
  }

  async _loadArchivePage(page, offsetKey, query, collapse) {
    const runSearch = createOffsetSearchLoader({
      path: LRR_ROUTES.searchPath,
      getOffsetKey: () => `${offsetKey}_${this._serverStamp()}`,
      buildQuery: (_input, start) => Object.assign({}, query, { start: String(start) }),
      mapComic: (item, context) => this._mapArchiveComic(item, context.base),
    });
    const result = await runSearch(this, { page });
    if (!collapse) {
      return {
        comics: await this._decorateListedComics(result.comics),
        maxPage: result.maxPage,
      };
    }
    const raw =
      result.data && Array.isArray(result.data.data) ? result.data.data : [];
    return {
      comics: await this._collapseTankItems(raw),
      maxPage: result.maxPage,
    };
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
    let stamp = "";
    try {
      stamp = this._serverStamp();
      const url = buildSelfHostedUrlFromSource(this, LRR_ROUTES.categoriesPath());
      const res = await Network.get(url, this.headers);
      if (this._serverStamp() !== stamp) return;
      if (res.status !== 200) {
        this._saveScopedList("categories", stamp, []);
        this._saveScopedList("favorites", stamp, []);
        return;
      }
      let data = [];
      try {
        data = JSON.parse(res.body);
      } catch (_) {
        data = [];
      }
      if (!Array.isArray(data)) data = [];
      this._saveScopedList("categories", stamp, data);
      this.saveData("categories_ts", Date.now());
      const favorites = data.filter(
        (c) =>
          c &&
          (c.search === "" || c.search === null || typeof c.search === "undefined"),
      );
      this._saveScopedList("favorites", stamp, favorites);
      this.saveData("favorites_ts", Date.now());
    } catch (_) {
      if (stamp && this._serverStamp() === stamp) {
        this._saveScopedList("categories", stamp, []);
        this._saveScopedList("favorites", stamp, []);
      }
    }
  }

  explore = [
    {
      title: "Latest",
      type: "multiPageComicList",
      load: (page) =>
        this._loadArchivePage(
          page,
          "explore_start",
          {
            sortby: "date_added",
            order: "desc",
            groupby_tanks: "true",
          },
          false,
        ),
    },
    {
      title: "New",
      type: "multiPageComicList",
      load: (page) =>
        this._loadArchivePage(
          page,
          "explore_new",
          {
            sortby: "date_added",
            order: "desc",
            newonly: "true",
            groupby_tanks: "true",
          },
          false,
        ),
    },
    {
      title: "Recently read",
      type: "multiPageComicList",
      load: (page) =>
        this._loadArchivePage(
          page,
          "explore_read",
          {
            sortby: "lastread",
            order: "desc",
            groupby_tanks: "false",
          },
          false,
        ),
    },
    {
      title: "Random",
      type: "multiPageComicList",
      load: () => this._loadRandomExplore(),
    },
  ];

  category = {
    title: "Lanraragi",
    parts: [
      {
        name: "ALL",
        type: "dynamic",
        loader: () => {
          const data = this._loadScopedList("categories");
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
      // Static categories list member archives. Server-side grouping hides
      // them, so collapse unique members onto their tank after the search.
      return await this._loadArchivePage(
        page,
        `category_start_${String(category || "")}`,
        {
          category: category || "",
          sortby: "date_added",
          order: "desc",
        },
        true,
      );
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
          `search_start_${this._serverStamp()}_${encodeURIComponent(String(input.keyword || ""))}`,
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
      return {
        comics: await this._decorateListedComics(result.comics),
        maxPage: result.maxPage,
      };
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
      const data = this._loadScopedList("favorites");
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
      const n = typeof page === "number" && page > 0 ? page : 1;
      return await this._loadArchivePage(
        n,
        `favorites_start_${String(folder || "")}`,
        {
          category: folder || "",
          sortby: "date_added",
          order: "desc",
        },
        false,
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
    if (!this._tankChapters) this._tankChapters = Object.create(null);
    this._tankChapters[tankId] = archives;

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

  _imageBelongs(comicId, epId, archiveId) {
    const archive = String(archiveId || "").toLowerCase();
    const episode = String(epId || "");
    const comic = String(comicId || "");
    if (isLrrArchiveId(episode) && episode.toLowerCase() !== archive) return false;
    if (isLrrArchiveId(comic)) return comic.toLowerCase() === archive;
    if (!isLrrTankId(comic)) return false;
    const chapters = this._tankChapters && this._tankChapters[comic];
    if (chapters) return chapters.indexOf(archive) >= 0;
    const mapped = this._memberTank && this._memberTank[archive];
    if (mapped) return mapped === comic;
    const cover = this._tankCover && this._tankCover[comic];
    if (cover) return cover === archive;
    return isLrrArchiveId(episode) && episode.toLowerCase() === archive;
  }

  comic = {
    loadInfo: async (id) => {
      if (isLrrTankId(id)) return await this._loadTankInfo(id);
      if (isLrrArchiveId(id)) {
        try {
          await this._ensureTankIndex();
          const parent =
            this._memberTank && this._memberTank[String(id).toLowerCase()];
          if (isLrrTankId(parent)) return await this._loadTankInfo(parent);
        } catch (_) {}
      }
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
        if (k === "__proto__" || k === "constructor" || k === "prototype") {
          for (const item of v) nonNs.push(item);
          continue;
        }
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
      if (isLrrTankId(id)) throw "Cannot rate a LANraragi tankoubon";
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
      const comic = String(comicId || "");
      const episode = String(epId || "");
      let archiveId = "";
      if (isLrrTankId(comic)) {
        if (!isLrrArchiveId(episode)) throw "LANraragi tankoubon has no chapters.";
        archiveId = episode.toLowerCase();
        if (!this._imageBelongs(comic, archiveId, archiveId)) {
          throw "LANraragi page belongs to another archive.";
        }
      } else if (isLrrArchiveId(comic)) {
        if (isLrrArchiveId(episode) && episode.toLowerCase() !== comic.toLowerCase()) {
          throw "LANraragi archive has no chapters.";
        }
        archiveId = comic.toLowerCase();
      } else {
        throw "Invalid LANraragi archive ID.";
      }
      const base = String(this.baseUrl || "").replace(/\/$/, "");
      const url = buildSelfHostedUrlFromSource(this, LRR_ROUTES.archiveFilesPath(archiveId), {
        force: "false",
      });
      const res = await Network.get(url, this.headers);
      if (res.status !== 200) throw `Invalid status code: ${res.status}`;
      const data = JSON.parse(res.body);
      const pages = data && Array.isArray(data.pages) ? data.pages : null;
      if (!pages || pages.length === 0) throw "LANraragi archive has no pages yet.";
      if (pages.length > 10000) throw "Invalid LANraragi page list.";
      const images = [];
      for (const page of pages) {
        if (typeof page !== "string") throw "Invalid LANraragi page URL.";
        images.push(lrrPageKey(archiveId, page, base));
      }
      return { images };
    },
    onImageLoad: (url, comicId, epId) => {
      const value = String(url || "");
      let archiveId = "";
      let resolved = "";
      if (value.startsWith("lrr-page:")) {
        const match = /^lrr-page:([a-f0-9]{40}):/i.exec(value);
        if (!match) throw "Invalid LANraragi image key.";
        archiveId = match[1].toLowerCase();
        resolved = lrrResolvePageKey(value, this.baseUrl);
      } else {
        const owner = isLrrArchiveId(epId)
          ? String(epId).toLowerCase()
          : isLrrArchiveId(comicId)
            ? String(comicId).toLowerCase()
            : "";
        if (!owner) throw "Invalid LANraragi image key.";
        const key = lrrPageKey(owner, value, this.baseUrl);
        archiveId = owner;
        resolved = lrrResolvePageKey(key, this.baseUrl);
      }
      if (!this._imageBelongs(comicId, epId, archiveId)) {
        throw "LANraragi page belongs to another archive.";
      }
      return {
        url: resolved,
        headers: this._authHeaders(),
      };
    },
    onThumbnailLoad: (url) => {
      const value = String(url || "");
      const base = String(this.baseUrl || "").replace(/\/+$/, "");
      if (!value.startsWith(base + "/")) return { headers: {} };
      return {
        headers: this._authHeaders(),
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
