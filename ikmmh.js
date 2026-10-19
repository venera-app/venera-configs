/** @type {import('./_venera_.js')} */

function getValidatorCookie(htmlString) {
  const cookieRegex = /document\.cookie\s*=\s*(["'])([\s\S]*?)\1/;
  const match = htmlString.match(cookieRegex);

  if (!match) {
    return null;
  }

  const cookieSetting = match[2]
    .replace(/\\x([0-9a-f]{2})/gi, (_, value) =>
      String.fromCharCode(parseInt(value, 16))
    )
    .replace(/\\u([0-9a-f]{4})/gi, (_, value) =>
      String.fromCharCode(parseInt(value, 16))
    )
    .replace(/\\([\\"'])/g, "$1");
  const cookies = cookieSetting.split(';');
  if (cookies.length === 0) {
    return null
  }
  const nameValuePart = cookies[0].trim();
  const equalsIndex = nameValuePart.indexOf('=');
  if (equalsIndex <= 0) {
    return null;
  }

  const name = nameValuePart.substring(0, equalsIndex);
  const value = nameValuePart.substring(equalsIndex + 1);

  const domain = Ikm.baseUrl.replace(/^https?:\/\//i, "").split("/")[0];
  return new Cookie({ name, value, domain })
}

async function validatorGet(url, headers) {
  let res = await Network.get(url, headers);
  assertSiteAccessible(res, url);
  for (let retry = 0; retry < 2 && needPassValidator(res.body); retry++) {
    res = await Network.get(url, headers);
    assertSiteAccessible(res, url);
  }
  return res;
}

async function validatorPost(url, headers, body) {
  let res = await Network.post(url, headers, body);
  assertSiteAccessible(res, url);
  for (let retry = 0; retry < 2 && needPassValidator(res.body); retry++) {
    res = await Network.post(url, headers, body);
    assertSiteAccessible(res, url);
  }
  return res;
}

function assertSiteAccessible(res, url) {
  const body = String(res.body || "");
  if (
    Number(res.status) === 403 &&
    /the\s+region\s+has\s+been\s+denied/i.test(body)
  ) {
    throw new Error(
      `爱看漫拒绝了当前地区的访问（403）。请在漫画源设置中填写本机可直接访问的官方域名；Cookie 或 User-Agent 无法解除地区封锁。地址：${url}`
    );
  }
  if (Number(res.status) === 403) {
    throw new Error(`爱看漫反爬校验未通过（403）：${url}`);
  }
  if (res.status && (Number(res.status) < 200 || Number(res.status) >= 400)) {
    throw new Error(`爱看漫请求失败（HTTP ${res.status}）：${url}`);
  }
}

function absoluteUrl(url, baseUrl = Ikm.baseUrl) {
  if (!url) return "";
  let value = String(url)
    .trim()
    .replace(/^['"]|['"]$/g, "")
    .replace(/&amp;/gi, "&")
    .replace(/&#x2f;|&#47;/gi, "/")
    .replace(/\\u002f|\\x2f/gi, "/")
    .replace(/\\\//g, "/");
  if (!value || value.startsWith("data:") || value.startsWith("blob:")) {
    return "";
  }
  if (value.startsWith("//")) return `https:${value}`;
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith("/")) return `${Ikm.baseUrl}${value}`;
  const base = String(baseUrl || Ikm.baseUrl).split("#")[0].split("?")[0];
  const originMatch = base.match(/^https?:\/\/[^/]+/i);
  const origin = originMatch ? originMatch[0] : Ikm.baseUrl;
  const basePath = base.substring(origin.length, base.lastIndexOf("/") + 1);
  const resolved = [];
  `${basePath}${value}`.split("/").forEach((part) => {
    if (!part || part === ".") return;
    if (part === "..") resolved.pop();
    else resolved.push(part);
  });
  return `${origin}/${resolved.join("/")}`;
}

function parseJsonResponse(res, label) {
  try {
    return JSON.parse(res.body);
  } catch (_) {
    const preview = String(res.body || "").trim().slice(0, 80);
    throw new Error(`${label}返回的不是 JSON：${preview || "空响应"}`);
  }
}

function decodeImageUrl(value) {
  if (!value) return "";
  let url = String(value)
    .trim()
    .replace(/^['"]|['"]$/g, "")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&amp;/gi, "&")
    .replace(/\\u([0-9a-f]{4})/gi, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16))
    )
    .replace(/\\x([0-9a-f]{2})/gi, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16))
    )
    .replace(/\\\//g, "/");
  if (/%[0-9a-f]{2}/i.test(url)) {
    try {
      url = decodeURIComponent(url);
    } catch (_) {}
  }
  return url;
}

function isBlockedImage(url) {
  if (!url) return true;
  const lower = decodeImageUrl(url).toLowerCase();
  if (!/\.(?:jpe?g|png|webp|gif)(?:[?#].*)?$/i.test(lower)) return true;
  if (/\/cover\/|\/bl\.gif(?:[?#].*)?$/.test(lower)) return true;
  return /(?:^|[._/-])(logo|loading|load|lazy|placeholder|placehold|blank|black|transparent|spacer|pixel|1x1|default|noimage|nopic|notfound|404|error|avatar|icon|banner|ad|qrcode)(?:[._/-]|$)/i.test(lower);
}

function addImageUrl(images, rawUrl, baseUrl) {
  if (String(rawUrl || "").startsWith(CANDIDATE_URL_PREFIX)) {
    if (!images.includes(rawUrl)) images.push(rawUrl);
    return;
  }
  const imageUrl = absoluteUrl(decodeImageUrl(rawUrl), baseUrl);
  if (!isBlockedImage(imageUrl) && !images.includes(imageUrl)) {
    images.push(imageUrl);
  }
}

function addImageFromSrcset(images, rawSrcset, baseUrl) {
  String(rawSrcset || "")
    .split(",")
    .map((item) => item.trim().split(/\s+/)[0])
    .forEach((url) => addImageUrl(images, url, baseUrl));
}

function collectImagesFromElements(document, baseUrl, strictOnly = true) {
  const strictSelectors = [
    ".reader-pic-slot img",
    ".reader-pic-list img",
    ".reader-pic img",
    ".reader-main img",
    ".reader-content img",
    ".chapter-content img",
    ".chapter__content img",
    ".chapter-reader img",
    ".comic-reader img",
    ".comicpage img",
    ".comic-page img",
    ".read-content img",
    ".reader img",
    ".manga-reader img",
    ".mh-content img",
    ".article-content img",
    "#chapter-content img",
    "#readerarea img",
    "#readerArea img",
    "#manga img",
    "div.chapter img",
    "article.chapter img",
    "article img",
  ];
  const fallbackSelectors = [
    "img.lazy",
    "img",
    "amp-img",
    "[data-src]",
    "[data-original]",
  ];
  const selectors = strictOnly
    ? strictSelectors
    : strictSelectors.concat(fallbackSelectors);
  const attrs = [
    "data-original",
    "data-url",
    "data-lazy-src",
    "data-echo",
    "data-cfsrc",
    "data-src",
    "src",
  ];
  const images = [];
  const seenElements = [];
  selectors.forEach((selector) => {
    document.querySelectorAll(selector).forEach((e) => {
      if (seenElements.includes(e)) return;
      seenElements.push(e);
      const nodeAttrs = e.attributes || {};
      attrs.forEach((attr) => addImageUrl(images, nodeAttrs[attr], baseUrl));
      addImageFromSrcset(images, nodeAttrs["data-srcset"], baseUrl);
      addImageFromSrcset(images, nodeAttrs["srcset"], baseUrl);
    });
  });
  return images;
}

function collectImagesFromScripts(html, baseUrl) {
  const images = [];
  const text = decodeImageUrl(html);
  const readerBlockPattern =
    /(?:chapter|reader|read|pages?|pics?|images?|imgs?|manga|comic)[\w$-]{0,40}\s*[:=]\s*(\[[\s\S]{0,20000}?\])/gi;
  let blockMatch;
  while ((blockMatch = readerBlockPattern.exec(text)) !== null) {
    const block = blockMatch[1];
    const imagePattern =
      /(?:https?:)?\/{2}[^"'\s<>,\]]+?\.(?:jpe?g|png|webp|gif)(?:\?[^"'\s<>,\]]*)?|\/[^"'\s<>,\]]+?\.(?:jpe?g|png|webp|gif)(?:\?[^"'\s<>,\]]*)?/gi;
    (block.match(imagePattern) || []).forEach((url) =>
      addImageUrl(images, url, baseUrl)
    );
  }

  const quotedPattern =
    /(?:chapter|reader|read|pages?|pics?|images?|imgs?|manga|comic)[\w$-]{0,40}\s*[:=]\s*["']((?:\\.|[^"'\\])*?\.(?:jpe?g|png|webp|gif)(?:\?[^"'\\]*)?)["']/gi;
  let match;
  while ((match = quotedPattern.exec(text)) !== null) {
    addImageUrl(images, match[1], baseUrl);
  }
  return images;
}

function collectImagesFromText(text, baseUrl) {
  const images = [];
  const decoded = decodeImageUrl(text);
  const lineImagePattern =
    /(?:https?:)?\/{2}[^\r\n"'<>,\]]+?\.(?:jpe?g|png|webp|gif)(?:\?[^"'<>,\]\s]*)?/gi;
  (decoded.match(lineImagePattern) || []).forEach((url) =>
    addImageUrl(images, url, baseUrl)
  );

  const textWithoutAbsoluteUrls = decoded.replace(lineImagePattern, " ");
  const imagePattern =
    /\/[^/"'\s<>,\]][^"'\s<>,\]]*?\.(?:jpe?g|png|webp|gif)(?:\?[^"'\s<>,\]]*)?/gi;
  (textWithoutAbsoluteUrls.match(imagePattern) || []).forEach((url) =>
    addImageUrl(images, url, baseUrl)
  );
  return images;
}

function collectImagesFromAny(value, baseUrl) {
  const images = [];
  const visit = (item) => {
    if (item == null) return;
    if (typeof item === "string") {
      collectImagesFromText(item, baseUrl).forEach((url) =>
        addImageUrl(images, url, baseUrl)
      );
      return;
    }
    if (Array.isArray(item)) {
      item.forEach(visit);
      return;
    }
    if (typeof item === "object") {
      Object.keys(item).forEach((key) => visit(item[key]));
    }
  };
  visit(value);
  return images;
}

function extractReadConfig(html) {
  const match = String(html || "").match(/\bread\s*=\s*\{([\s\S]*?)\}\s*;?/);
  if (!match) return null;
  const config = {};
  const body = match[1];
  const itemPattern =
    /([a-zA-Z_$][\w$]*)\s*:\s*'([^']*)'|([a-zA-Z_$][\w$]*)\s*:\s*([0-9.]+)/g;
  let item;
  while ((item = itemPattern.exec(body)) !== null) {
    const key = item[1] || item[3];
    const value = item[2] != null ? item[2] : item[4];
    config[key] = value;
  }
  return config.aid && (config.apiCid || config.cid)
    ? config
    : null;
}

function readConfigFromChapterUrl(epId) {
  const match = String(epId || "").match(/\/chapter\/(\d+)\/(\d+)(?:\.html)?/i);
  if (!match) return null;
  return {
    aid: match[1],
    cid: match[2],
    apiCid: match[2],
  };
}

function readConfigFromIds(comicId, epId) {
  const fromChapterUrl = readConfigFromChapterUrl(epId);
  if (fromChapterUrl) return fromChapterUrl;

  const comicMatch = String(comicId || "").match(/\/book\/(\d+)\/?|(?:^|[^\d])(\d+)(?:[^\d]|$)/i);
  const epMatch = String(epId || "").match(/(\d+)/);
  const aid = comicMatch ? (comicMatch[1] || comicMatch[2]) : "";
  const cid = epMatch ? epMatch[1] : "";
  return aid && cid
    ? {
        aid,
        cid,
        apiCid: cid,
      }
    : null;
}

function parseReadApiImages(res, epId) {
  const body = String(res.body || "");
  let images = [];
  try {
    const data = JSON.parse(body);
    images = collectImagesFromAny(data, epId);
  } catch (_) {
    images = collectImagesFromText(body, epId);
  }
  return images.filter((url, index, list) => url && list.indexOf(url) === index);
}

function shouldUseReadPicsApi(config) {
  if (!config || !config.cover || !(config.cid || config.apiCid) || !config.aid) {
    return false;
  }
  const cover = String(config.cover || "");
  const isDm5Cover = /\/\d+\/(\d+)\/\1_b\.(?:jpe?g|png|webp)(?:[?#].*)?$/i.test(cover);
  const isOhmanhuaCover = /\/cover\/co\d+\.[a-z0-9]+(?:[?#].*)?$/i.test(cover);
  return !isDm5Cover && !isOhmanhuaCover;
}

function parseReadPicsImages(res, epId) {
  try {
    const data = JSON.parse(String(res.body || "{}"));
    const pics = data && data.data && Array.isArray(data.data.pic)
      ? data.data.pic
      : [];
    const images = [];
    pics.forEach((item) => {
      const pic = item && (item.pic || item.url || item.src);
      if (pic) addImageUrl(images, pic, epId);
    });
    return {
      images,
      total: parseInt(data && data.data && data.data.total, 10) || 0,
      limit: parseInt(data && data.data && data.data.limit, 10) || pics.length || 0,
      ok: parseInt(data && data.code, 10) === 1,
    };
  } catch (_) {
    return { images: [], total: 0, limit: 0, ok: false };
  }
}

async function fetchReadPicsImages(config, epId) {
  if (!shouldUseReadPicsApi(config)) return [];
  const chapterId = config.apiCid || config.cid;
  const expected = parseInt(config.picCount || config.pageCount || config.count || 0, 10) || 0;
  const images = [];
  const limit = 10;
  let offset = 0;
  let total = expected;
  for (let guard = 0; guard < 80; guard++) {
    if (total > 0 && offset >= total) break;
    if (expected > 0 && offset >= expected) break;
    const res = await validatorPost(
      `${Ikm.baseUrl}/api/comic/read/pics`,
      {
        ...Ikm.jsonHead,
        "referer": epId,
      },
      `id=${encodeURIComponent(chapterId)}&aid=${encodeURIComponent(config.aid)}&offset=${offset}&limit=${limit}`
    );
    const parsed = parseReadPicsImages(res, epId);
    if (!parsed.ok || parsed.images.length === 0) break;
    parsed.images.forEach((url) => addImageUrl(images, url, epId));
    if (parsed.total > 0) total = parsed.total;
    offset += parsed.images.length;
    if (parsed.images.length < (parsed.limit || limit)) break;
  }
  return images;
}

const CANDIDATE_URL_PREFIX = "ikmmh-candidates:";

function makeCandidateImageUrl(candidates) {
  const urls = candidates.filter((url, index, list) => url && list.indexOf(url) === index);
  if (urls.length <= 1) return urls[0] || "";
  return `${CANDIDATE_URL_PREFIX}${encodeURIComponent(JSON.stringify(urls))}`;
}

function parseCandidateImageUrl(url) {
  const value = String(url || "");
  if (!value.startsWith(CANDIDATE_URL_PREFIX)) {
    return [url];
  }
  try {
    const parsed = JSON.parse(decodeURIComponent(value.slice(CANDIDATE_URL_PREFIX.length)));
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [url];
  } catch (_) {
    return [url];
  }
}

function canBuildImagesFromReadConfig(config) {
  return !!(
    config &&
    config.cover &&
    config.articlename &&
    config.chaptername &&
    config.picCount &&
    config.order
  );
}

function findChapterNameInChapterList(value, cid) {
  const target = String(cid || "");
  let found = "";
  const visit = (item) => {
    if (found || item == null) return;
    if (Array.isArray(item)) {
      item.forEach(visit);
      return;
    }
    if (typeof item === "object") {
      const id = String(item.id || "");
      const url = String(item.url || "");
      if (
        target &&
        (id === target || url.indexOf(`/${target}.html`) >= 0)
      ) {
        found = String(item.name || item.cname || "").trim();
        return;
      }
      Object.keys(item).forEach((key) => visit(item[key]));
    }
  };
  visit(value);
  return found;
}

async function fetchCanonicalChapterName(config, epId) {
  if (!config || !config.aid || !(config.cid || config.apiCid)) return "";
  try {
    const referer = config.url
      ? absoluteUrl(config.url, epId)
      : `${Ikm.baseUrl}/book/${config.aid}/`;
    const res = await validatorGet(
      `${Ikm.baseUrl}/api/comic/zyz/chapterlink?id=${encodeURIComponent(config.aid)}`,
      {
        ...Ikm.jsonHead,
        "referer": referer,
      }
    );
    return findChapterNameInChapterList(
      JSON.parse(String(res.body || "{}")),
      config.cid || config.apiCid
    );
  } catch (_) {
    return "";
  }
}

function buildImagesFromReadConfig(config) {
  if (!config || !config.cover) {
    return [];
  }
  const count = parseInt(config.picCount || config.pageCount || config.count || 80, 10);
  const orderNo = parseInt(config.order, 10);
  if (!Number.isFinite(count) || count <= 0) {
    return [];
  }
  const cover = absoluteUrl(config.cover);

  const dm5CoverMatch = cover.match(/^(https?:\/\/[^/]+\/\d+\/(\d+)\/)\2_b\.(?:jpe?g|png|webp)(?:[?#].*)?$/i);
  if (dm5CoverMatch && (config.cid || config.apiCid)) {
    const root = `${dm5CoverMatch[1]}${config.cid || config.apiCid}`;
    const urls = [];
    for (let i = 1; i <= count; i++) {
      urls.push(`${root}/${i}.jpg`);
    }
    return urls;
  }

  if (!config.articlename || !config.chaptername || !Number.isFinite(orderNo) || orderNo <= 0) {
    const genericCoverMatch = cover.match(/^(https?:\/\/.+\/)[^/]+\.(?:jpe?g|png|webp)(?:[?#].*)?$/i);
    if (genericCoverMatch && (config.cid || config.apiCid)) {
      const baseRoot = genericCoverMatch[1].replace(/\/+$/, "");
      const cid = config.cid || config.apiCid;
      const chapterName = String(config.chaptername || "").trim();
      const orderDir = Number.isFinite(orderNo)
        ? `${String(orderNo).padStart(4, "0")} ${chapterName}`.trim()
        : "";
      const urls = [];
      for (let i = 1; i <= count; i++) {
        const page3 = String(i).padStart(3, "0");
        urls.push(makeCandidateImageUrl([
          chapterName ? `${baseRoot}/${chapterName}/${page3}.jpg` : "",
          chapterName ? `${baseRoot}/${chapterName}/${i}.jpg` : "",
          orderDir ? `${baseRoot}/${orderDir}/${page3}.jpg` : "",
          orderDir ? `${baseRoot}/${orderDir}/${i}.jpg` : "",
          `${baseRoot}/${cid}/${page3}.jpg`,
          `${baseRoot}/${cid}/${i}.jpg`,
          `${baseRoot}/${page3}.jpg`,
          `${baseRoot}/${i}.jpg`,
        ]));
      }
      return urls;
    }
    return [];
  }
  const coverMatch = cover.match(/\/cover\/co(\d+)\.[a-z0-9]+(?:[?#].*)?$/i);
  if (!coverMatch) {
    const genericCoverMatch = cover.match(/^(https?:\/\/.+\/)[^/]+\.(?:jpe?g|png|webp)(?:[?#].*)?$/i);
    if (genericCoverMatch && (config.cid || config.apiCid)) {
      const baseRoot = genericCoverMatch[1].replace(/\/+$/, "");
      const cid = config.cid || config.apiCid;
      const chapterName = String(config.chaptername || "").trim();
      const orderDir = Number.isFinite(orderNo)
        ? `${String(orderNo).padStart(4, "0")} ${chapterName}`.trim()
        : "";
      const urls = [];
      for (let i = 1; i <= count; i++) {
        const page3 = String(i).padStart(3, "0");
        urls.push(makeCandidateImageUrl([
          chapterName ? `${baseRoot}/${chapterName}/${page3}.jpg` : "",
          chapterName ? `${baseRoot}/${chapterName}/${i}.jpg` : "",
          orderDir ? `${baseRoot}/${orderDir}/${page3}.jpg` : "",
          orderDir ? `${baseRoot}/${orderDir}/${i}.jpg` : "",
          `${baseRoot}/${cid}/${page3}.jpg`,
          `${baseRoot}/${cid}/${i}.jpg`,
          `${baseRoot}/${page3}.jpg`,
          `${baseRoot}/${i}.jpg`,
        ]));
      }
      return urls;
    }
    return [];
  }
  const comicCode = coverMatch[1];
  const root = cover.slice(0, coverMatch.index);
  const chapterDir = `${String(orderNo).padStart(4, "0")} ${config.chaptername}`;
  const bookDir = `${comicCode} ${config.articlename}`;
  const urls = [];
  for (let i = 1; i <= count; i++) {
    urls.push(
      `${root}/${bookDir}/${chapterDir}/${comicCode}-${orderNo}-${String(i).padStart(3, "0")}.jpg`
    );
  }
  return urls;
}

function alternateReaderImageUrl(url) {
  const decoded = decodeImageUrl(url);
  const paddedPageMatch = decoded.match(/^(https?:\/\/.+\/)0*(\d+)\.(jpe?g|png|webp)([?#].*)?$/i);
  if (paddedPageMatch && paddedPageMatch[2].length < decoded.split("/").pop().split(".")[0].length) {
    return `${paddedPageMatch[1]}${paddedPageMatch[2]}.${paddedPageMatch[3]}${paddedPageMatch[4] || ""}`;
  }
  const dm5Match = decoded.match(/^(https?:\/\/[^/]+\/\d+\/\d+)\/\d+\/(\d+\.(?:jpe?g|png|webp)(?:[?#].*)?)$/i);
  if (dm5Match) {
    return `${dm5Match[1]}/${dm5Match[2]}`;
  }
  const segments = decoded.split("/");
  if (segments.length < 2) return "";
  const chapterIndex = segments.length - 2;
  const chapterDir = segments[chapterIndex];
  let altChapterDir = "";
  let match = chapterDir.match(/^(\d{4}\s+第\d+话)\s+(.+)$/);
  if (match) {
    altChapterDir = `${match[1]}${match[2]}`;
  } else {
    match = chapterDir.match(/^(\d{4}\s+第\d+话)(\S.+)$/);
    if (match) {
      altChapterDir = `${match[1]} ${match[2]}`;
    }
  }
  if (!altChapterDir || altChapterDir === chapterDir) return "";
  segments[chapterIndex] = altChapterDir;
  return segments.join("/");
}

function extractScriptText(document, html) {
  const chunks = document
    .querySelectorAll("script")
    .map((e) => e.text || "")
    .filter((text) => text.trim());
  const scriptPattern = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = scriptPattern.exec(String(html || ""))) !== null) {
    if (match[1].trim()) chunks.push(match[1]);
  }
  return chunks.join("\n");
}

function isNonReaderImage(url, html) {
  const normalizedUrl = decodeImageUrl(url);
  const haystack = decodeImageUrl(html || "");
  const variants = [
    normalizedUrl,
    normalizedUrl.replace(/^https?:/, ""),
    normalizedUrl.replace(Ikm.baseUrl, ""),
  ].filter((value, index, list) => value && list.indexOf(value) === index);

  return variants.some((variant) => {
    const index = haystack.indexOf(variant);
    if (index < 0) return false;
    const before = haystack.slice(0, index).toLowerCase();
    const inScript = before.lastIndexOf("<script") > before.lastIndexOf("</script>");
    if (inScript) {
      const prefix = haystack.slice(Math.max(0, index - 100), index).toLowerCase();
      return /(?:cover|bookhero|recommend|thumb|thumbnail|avatar|banner|qrcode)[\w-]{0,40}\s*[:=]\s*["'\[]?\s*$/.test(prefix);
    }
    const radius = inScript ? 100 : 260;
    const start = Math.max(0, index - radius);
    const end = Math.min(haystack.length, index + variant.length + radius);
    const context = haystack.slice(start, end).toLowerCase();
    return /og:image|twitter:image|cover|book-hero|module-guess|recommend|thumb|thumbnail|avatar|banner|qrcode/.test(context);
  });
}

function filterReaderImages(images, html) {
  return images.filter((url) => !isNonReaderImage(url, html));
}

function looksLikeReaderSet(images, source) {
  if (images.length >= 4) return true;
  return false;
}

function countLockedReaderPlaceholders(html) {
  const text = String(html || "");
  const matches = text.match(/(?:src|data-src)\s*=\s*["'][^"']*\/static\/msnot_vip\.png["']/gi);
  return matches ? matches.length : 0;
}

function encodeImageRequestUrl(url) {
  try {
    return encodeURI(url);
  } catch (_) {
    return url;
  }
}

function buildImageLoadConfig(candidates, index, comicId, epId) {
  const currentUrl = absoluteUrl(candidates[index] || candidates[0], epId);
  const imageUrl = encodeImageRequestUrl(currentUrl);
  const chapterReferer = epId || comicId || `${Ikm.baseUrl}/`;
  const imageHost = imageUrl.match(/^https?:\/\/([^/]+)/i)?.[1] || "";
  const siteHost = Ikm.baseUrl.match(/^https?:\/\/([^/]+)/i)?.[1] || "";
  const nextCandidate = candidates[index + 1] || alternateReaderImageUrl(currentUrl);
  const nextCandidates = candidates
    .concat(nextCandidate || "")
    .filter((url, pos, list) => url && list.indexOf(url) === pos);
  const config = {
    url: imageUrl,
    method: "GET",
    headers: {
      ...Ikm.imageHeaders,
      "Referer": index === 0 ? chapterReferer : `${Ikm.baseUrl}/`,
      "Sec-Fetch-Site": imageHost === siteHost ? "same-origin" : "cross-site",
    },
  };
  if (nextCandidates[index + 1] && nextCandidates[index + 1] !== currentUrl) {
    config.onLoadFailed = () =>
      buildImageLoadConfig(
        nextCandidates,
        index + 1,
        comicId,
        epId
      );
  } else if (index === 0) {
    config.onLoadFailed = () => ({
      url: imageUrl,
      method: "GET",
      headers: {
        ...Ikm.imageHeaders,
        "Referer": `${Ikm.baseUrl}/`,
        "Sec-Fetch-Site": imageHost === siteHost ? "same-origin" : "cross-site",
      },
    });
  }
  return config;
}

function needPassValidator(htmlString) {
  var cookie = getValidatorCookie(htmlString)
  if (cookie != null) {
    Network.setCookies(Ikm.baseUrl, [cookie])
    return true
  }
  return false
}

class Ikm extends ComicSource {
  // 基础配置
  name = "爱看漫";
  key = "ikmmh";
  version = "1.0.6";
  minAppVersion = "1.0.0";
  url = "https://cdn.jsdelivr.net/gh/venera-app/venera-configs@main/ikmmh.js";
  // 常量定义
  static baseUrl = "https://www.ikmmh.com";
  static Mobile_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1";
  static webHeaders = {
    "User-Agent": Ikm.Mobile_UA,
    "Accept":
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    "Cache-Control": "no-cache",
    "Pragma": "no-cache",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
    "Upgrade-Insecure-Requests": "1",
  };
  static imageHeaders = {
    "User-Agent": Ikm.Mobile_UA,
    "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    "Cache-Control": "no-cache",
    "Pragma": "no-cache",
    "Sec-Fetch-Dest": "image",
    "Sec-Fetch-Mode": "no-cors",
  };
  static jsonHead = {
    "User-Agent": Ikm.Mobile_UA,
    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    "Accept": "application/json, text/javascript, */*; q=0.01",
    "Accept-Encoding": "gzip",
    "X-Requested-With": "XMLHttpRequest",
  };
  settings = {
    base_url: {
      title: "站点地址（必须能在本机浏览器直接访问）",
      type: "input",
      validator: "^https?://[^/]+/?$",
      default: "https://www.ikmmh.com",
    },
  };
  init() {
    let baseUrl = this.loadSetting("base_url") || this.settings.base_url.default;
    Ikm.baseUrl = String(baseUrl).trim().replace(/\/+$/, "");
  }
  // 统一缩略图加载配置
  static thumbConfig = (url) => ({
    headers: {
      ...Ikm.webHeaders,
      "referer": Ikm.baseUrl,
    },
  });
  // 账号系统
  account = {
    login: async (account, pwd) => {
      try {
        let res = await Network.post(
          `${Ikm.baseUrl}/api/user/userarr/login`,
          Ikm.jsonHead,
          `user=${account}&pass=${pwd}`
        );
        if (res.status !== 200)
          throw new Error(`登录失败，状态码：${res.status}`);

        if (needPassValidator(res.body)) {
          res = await Network.post(
            `${Ikm.baseUrl}/api/user/userarr/login`,
            Ikm.jsonHead,
            `user=${account}&pass=${pwd}`
          );
        }

        let data = JSON.parse(res.body);
        if (data.code !== 0)
          throw new Error(data.msg || "登录异常");

        return "ok";
      } catch (err) {
        throw new Error(`登录失败：${err.message}`);
      }
    },
    logout: () => Network.deleteCookies("www.ikmmh.com"),
    registerWebsite: `${Ikm.baseUrl}/user/register/`,
  };
  // 探索页面
  explore = [
    {
      title: this.name,
      type: "singlePageWithMultiPart",
      load: async () => {
        try {
          let res = await Network.get(`${Ikm.baseUrl}/`, Ikm.webHeaders);
          if (res.status !== 200)
            throw new Error(`加载探索页面失败，状态码：${res.status}`);

          if (needPassValidator(res.body)) {
            res = await Network.get(`${Ikm.baseUrl}/`, Ikm.webHeaders);
          }

          let document = new HtmlDocument(res.body);
          let parseComic = (e) => {
            let title = e.querySelector("div.title").text.split("~")[0];
            let cover = e.querySelector("div.thumb_img").attributes["data-src"];
            let link = `${Ikm.baseUrl}${
              e.querySelector("a").attributes["href"]
            }`;
            return {
              title,
              cover,
              id: link,
            };
          };
          return {
            "本周推荐": document
              .querySelectorAll("div.module-good-fir > div.item")
              .map(parseComic),
            "今日更新": document
              .querySelectorAll("div.module-day-fir > div.item")
              .map(parseComic),
          };
        } catch (err) {
          throw new Error(`探索页面加载失败：${err.message}`);
        }
      },
      onThumbnailLoad: Ikm.thumbConfig,
    },
  ];
  // 分类页面
  category = {
    title: "爱看漫",
    parts: [
      {
        name: "更新",
        type: "fixed",
        categories: [
          "星期一",
          "星期二",
          "星期三",
          "星期四",
          "星期五",
          "星期六",
          "星期日",
        ],
        itemType: "category",
        categoryParams: ["1", "2", "3", "4", "5", "6", "7"],
      },
      {
        name: "分类",
        // fixed 或者 random
        // random用于分类数量相当多时, 随机显示其中一部分
        type: "fixed",
        // 如果类型为random, 需要提供此字段, 表示同时显示的数量
        // randomNumber: 5,
        categories: [
          "全部",
          "长条",
          "大女主",
          "百合",
          "耽美",
          "纯爱",
          "後宫",
          "韩漫",
          "奇幻",
          "轻小说",
          "生活",
          "悬疑",
          "格斗",
          "搞笑",
          "伪娘",
          "竞技",
          "职场",
          "萌系",
          "冒险",
          "治愈",
          "都市",
          "霸总",
          "神鬼",
          "侦探",
          "爱情",
          "古风",
          "欢乐向",
          "科幻",
          "穿越",
          "性转换",
          "校园",
          "美食",
          "悬疑",
          "剧情",
          "热血",
          "节操",
          "励志",
          "异世界",
          "历史",
          "战争",
          "恐怖",
          "霸总"
        ],
        // category或者search
        // 如果为category, 点击后将进入分类漫画页面, 使用下方的`categoryComics`加载漫画
        // 如果为search, 将进入搜索页面
        itemType: "category",
      }
    ],
    enableRankingPage: false,
  };
  // 分类漫画加载
  categoryComics = {
    load: async (category, param, options, page) => {
      try {
        let res;
        if (param) {
          res = await Network.get(
            `${Ikm.baseUrl}/update/${param}.html`,
            Ikm.webHeaders
          );
          if (res.status !== 200)
            throw new Error(`分类请求失败，状态码：${res.status}`);

          if (needPassValidator(res.body)) {
            res = await Network.get(
              `${Ikm.baseUrl}/update/${param}.html`,
              Ikm.webHeaders
            );
          }

          let document = new HtmlDocument(res.body);
          let comics = document.querySelectorAll("li.comic-item").map((e) => ({
            title: e.querySelector("p.title").text.split("~")[0],
            cover: e.querySelector("img").attributes["src"],
            id: `${Ikm.baseUrl}${e.querySelector("a").attributes["href"]}`,
            subTitle: e.querySelector("span.chapter").text,
          }));
          return {
            comics,
            maxPage: 1
          };
        } else {
          res = await Network.post(
            `${Ikm.baseUrl}/api/comic/index/lists`,
            Ikm.jsonHead,
            `area=${options[1]}&tags=${encodeURIComponent(category)}&full=${
              options[0]
            }&page=${page}`
          );

          if (needPassValidator(res.body)) {
            res = await Network.post(
              `${Ikm.baseUrl}/api/comic/index/lists`,
              Ikm.jsonHead,
              `area=${options[1]}&tags=${encodeURIComponent(category)}&full=${options[0]
              }&page=${page}`
            );
          }

          let resData = JSON.parse(res.body);
          return {
            comics: resData.data.map((e) => ({
              id: `${Ikm.baseUrl}${e.info_url}`,
              title: e.name.split("~")[0],
              subTitle: e.author,
              cover: e.cover,
              tags: e.tags,
              description: e.lastchapter,
            })),
            maxPage: resData.end || 1,
          };
        }
      } catch (err) {
        throw new Error(`分类加载失败：${err.message}`);
      }
    },
    onThumbnailLoad: Ikm.thumbConfig,
    optionList: [
      {
        options: ["3-全部", "4-连载中", "1-已完结"],
        notShowWhen: [
          "星期一",
          "星期二",
          "星期三",
          "星期四",
          "星期五",
          "星期六",
          "星期日",
        ],
        showWhen: null,
      },
      {
        options: [
          "9-全部",
          "1-日漫",
          "2-港台",
          "3-美漫",
          "4-国漫",
          "5-韩漫",
          "6-未分类",
        ],
        notShowWhen: [
          "星期一",
          "星期二",
          "星期三",
          "星期四",
          "星期五",
          "星期六",
          "星期日",
        ],
        showWhen: null,
      },
    ],
  };
  // 搜索功能
  search = {
    load: async (keyword, options, page) => {
      try {
        let res = await Network.get(
          `${Ikm.baseUrl}/search?searchkey=${encodeURIComponent(keyword)}`,
          Ikm.webHeaders
        );

        if (needPassValidator(res.body)) {
          res = await Network.get(
            `${Ikm.baseUrl}/search?searchkey=${encodeURIComponent(keyword)}`,
            Ikm.webHeaders
          );
        }

        let document = new HtmlDocument(res.body);
        return {
          comics: document.querySelectorAll("li.comic-item").map((e) => ({
            title: e.querySelector("p.title").text.split("~")[0],
            cover: e.querySelector("img").attributes["src"],
            id: `${Ikm.baseUrl}${e.querySelector("a").attributes["href"]}`,
            subTitle: e.querySelector("span.chapter").text,
          })),
          maxPage: 1,
        };
      } catch (err) {
        throw new Error(`搜索失败：${err.message}`);
      }
    },
    onThumbnailLoad: Ikm.thumbConfig,
    optionList: [],
  };
  // 收藏功能
  favorites = {
    multiFolder: false,
    addOrDelFavorite: async (comicId, folderId, isAdding) => {
      try {
        let id = comicId.match(/\d+/)[0];
        if (isAdding) {
          let infoRes = await Network.get(comicId, Ikm.webHeaders);

          if (needPassValidator(infoRes.body)) {
            infoRes = await Network.get(comicId, Ikm.webHeaders);
          }

          let name = new HtmlDocument(infoRes.body).querySelector(
            "meta[property='og:title']"
          ).attributes["content"];
          let res = await Network.post(
            `${Ikm.baseUrl}/api/user/bookcase/add`,
            Ikm.jsonHead,
            `articleid=${id}&articlename=${encodeURIComponent(name)}`
          );
          let data = JSON.parse(res.body);
          if (data.code !== "0") throw new Error(data.msg || "收藏失败");
          return "ok";
        } else {
          let res = await Network.post(
            `${Ikm.baseUrl}/api/user/bookcase/del`,
            Ikm.jsonHead,
            `articleid=${id}`
          );

          if (needPassValidator(res.body)) {
            res = await Network.post(
              `${Ikm.baseUrl}/api/user/bookcase/del`,
              Ikm.jsonHead,
              `articleid=${id}`
            );
          }

          let data = JSON.parse(res.body);
          if (data.code !== "0") throw new Error(data.msg || "取消收藏失败");
          return "ok";
        }
      } catch (err) {
        throw new Error(`收藏操作失败：${err.message}`);
      }
    },
    loadComics: async (page, folder) => {
      let res = await Network.get(
        `${Ikm.baseUrl}/user/bookcase`,
        Ikm.webHeaders
      );
      if (res.status !== 200) {
        throw "加载收藏失败：" + res.status;
      }

      if (needPassValidator(res.body)) {
        res = await Network.get(
          `${Ikm.baseUrl}/user/bookcase`,
          Ikm.webHeaders
        );
      }

      let document = new HtmlDocument(res.body);
      return {
        comics: document.querySelectorAll("div.bookrack-item").map((e) => ({
          title: e.querySelector("h3").text.split("~")[0],
          subTitle: e.querySelector("p.desc").text,
          cover: e.querySelector("img").attributes["src"],
          id: `${Ikm.baseUrl}/book/${e.attributes["data-id"]}/`,
        })),
        maxPage: 1,
      };
    },
    onThumbnailLoad: Ikm.thumbConfig,
  };
  // 漫画详情
  comic = {
    loadInfo: async (id) => {
      let isFavorite = false;
      try {
        let favorites = await this.favorites.loadComics(1, null);
        isFavorite = favorites.comics.some((comic) => comic.id === id);
      } catch (error) {
        console.error("加载收藏页失败:", error);
      }
      let res = await validatorGet(id, Ikm.webHeaders);

      let document = new HtmlDocument(res.body);
      let comicId = id.match(/\d+/)[0];
      let epRes = await validatorGet(
        `${Ikm.baseUrl}/api/comic/zyz/chapterlink?id=${comicId}`,
        {
          ...Ikm.jsonHead,
          "referer": id,
        }
      );
      let epData = parseJsonResponse(epRes, "章节接口");
      let eps = new Map();
      let chapterGroups = Array.isArray(epData.data)
        ? epData.data
        : epData.data
          ? [epData.data]
          : [];
      chapterGroups.forEach((group) => {
        let list = Array.isArray(group) ? group : group.list || group.chapters || [];
        list.forEach((e) => {
          let chapterUrl = absoluteUrl(e.url || e.link || e.href);
          if (chapterUrl) eps.set(chapterUrl, e.name || e.title || "未命名章节");
        });
      });
      if (eps.size === 0) {
        throw new Error(`章节数据格式异常`);
      }

      let title = document.querySelector(
        "div.book-hero__detail > div.title"
      ).text;
      let escapedTitle = title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      let thumb =
        document
          .querySelector("div.coverimg")
          .attributes["style"].match(/\((.*?)\)/)?.[1] || "";
      let desc = document
        .querySelector("article.book-container__detail")
        .text.match(
          new RegExp(
            `漫画名：${escapedTitle}(?:(?:[^。]*?(?:简介|漫画简介)\\s*[:：]?\\s*)|(?:[^。]*?))([\\s\\S]+?)\\.\\.\\.。`
          )
        );
      let intro = desc?.[1]?.trim().replace(/\s+/g, " ") || "";

      return {
        title: title.split("~")[0],
        cover: thumb,
        description: intro,
        tags: {
          "作者": [
            document
              .querySelector("div.book-container__author")
              .text.split("作者：")[1],
          ],
          "更新": [document.querySelector("div.update > a > em").text],
          "标签": document
            .querySelectorAll("div.book-hero__detail > div.tags > a")
            .map((e) => e.text.trim())
            .filter((text) => text),
        },
        chapters: eps,
        recommend: document
          .querySelectorAll("div.module-guessu > div.item")
          .map((e) => ({
            title: e.querySelector("div.title").text.split("~")[0],
            cover: e.querySelector("div.thumb_img").attributes["data-src"],
            id: `${Ikm.baseUrl}${e.querySelector("a").attributes["href"]}`,
          })),
        isFavorite: isFavorite,
      };
    },
    onThumbnailLoad: Ikm.thumbConfig,
    loadEp: async (comicId, epId) => {
      try {
        let chapterHeaders = {
          ...Ikm.webHeaders,
          "referer": comicId || Ikm.baseUrl,
        };
        let res = await validatorGet(epId, chapterHeaders);

        let document = new HtmlDocument(res.body);
        const lockedPlaceholderCount = countLockedReaderPlaceholders(res.body);
        let strictImages = filterReaderImages(
          collectImagesFromElements(document, epId, true),
          res.body
        );
        let images = strictImages.slice();
        let scriptImages = collectImagesFromScripts(
          extractScriptText(document, res.body),
          epId
        );
        scriptImages.forEach((url) => addImageUrl(images, url, epId));
        images = filterReaderImages(images, res.body);
        let readApiDebug = "read api not tried";

        if (strictImages.length === 0 && !looksLikeReaderSet(images, "fallback")) {
          let fallbackImages = filterReaderImages(
            collectImagesFromElements(document, epId, false),
            res.body
          );
          fallbackImages.forEach((url) => addImageUrl(images, url, epId));
          images = filterReaderImages(images, res.body);
        }

        if (!looksLikeReaderSet(images, "fallback")) {
          const readConfig = extractReadConfig(res.body) || readConfigFromIds(comicId, epId);
          if (readConfig) {
            readApiDebug = `read api try id=${readConfig.apiCid || readConfig.cid}, aid=${readConfig.aid}`;
            if (shouldUseReadPicsApi(readConfig)) {
              const readPicsImages = await fetchReadPicsImages(readConfig, epId);
              readApiDebug += `; readPics=${readPicsImages.length}`;
              readPicsImages.forEach((url) =>
                addImageUrl(images, url, epId)
              );
              images = filterReaderImages(images, res.body);
            }
          }
        }

        if (!looksLikeReaderSet(images, "fallback")) {
          const readConfig = extractReadConfig(res.body) || readConfigFromIds(comicId, epId);
          if (readConfig) {
            if (readApiDebug === "read api not tried") {
              readApiDebug = `read api try id=${readConfig.apiCid || readConfig.cid}, aid=${readConfig.aid}`;
            }
            const readRes = await validatorPost(
              `${Ikm.baseUrl}/api/comic/read/index`,
              {
                ...Ikm.jsonHead,
                "referer": epId,
              },
              `id=${encodeURIComponent(readConfig.apiCid || readConfig.cid)}&aid=${encodeURIComponent(readConfig.aid)}`
            );
            const apiImages = parseReadApiImages(readRes, epId);
            readApiDebug += `; status=${readRes.status || "?"}; apiImages=${apiImages.length}; preview=${String(readRes.body || "").slice(0, 120)}`;
            apiImages.forEach((url) =>
              addImageUrl(images, url, epId)
            );
            images = filterReaderImages(images, res.body);
            if (!looksLikeReaderSet(images, "fallback")) {
              if (lockedPlaceholderCount >= 3) {
                throw new Error(
                  `该章节页面没有下发正文图片，只返回了 ${lockedPlaceholderCount} 张未解锁/VIP 占位图（/static/msnot_vip.png）。这不是图片地址规则问题，脚本不能凭空获取未下发的正文图。`
                );
              }
              const canonicalChapterName = canBuildImagesFromReadConfig(readConfig)
                ? await fetchCanonicalChapterName(readConfig, epId)
                : "";
              const generatorConfig = canonicalChapterName
                ? { ...readConfig, chaptername: canonicalChapterName }
                : readConfig;
              const generatedImages = buildImagesFromReadConfig(generatorConfig);
              readApiDebug += `; canonical=${canonicalChapterName || "-"}; generated=${generatedImages.length}`;
              generatedImages.forEach((url) =>
                addImageUrl(images, url, epId)
              );
              images = filterReaderImages(images, res.body);
            }
          } else {
            readApiDebug = `read api skipped; comicId=${String(comicId || "").slice(0, 80)}; epId=${String(epId || "").slice(0, 80)}; html=${String(res.body || "").slice(0, 120)}`;
          }
        }

        if (
          strictImages.length === 0 &&
          !looksLikeReaderSet(images, "fallback")
        ) {
          throw new Error(`没有找到可靠的正文漫画图片；候选 ${images.length} 张；${readApiDebug}`);
        }

        if (
          strictImages.length === 0 &&
          !looksLikeReaderSet(images, "fallback")
        ) {
          throw new Error(`页面中没有找到可靠的正文漫画图片；已排除封面、推荐图、占位图和少量杂图（候选 ${images.length} 张）`);
        }
        return {
          images,
        };
      } catch (err) {
        throw new Error(`加载章节失败：${err.message}`);
      }
    },
    onImageLoad: (url, comicId, epId) => {
      return buildImageLoadConfig(parseCandidateImageUrl(url), 0, comicId, epId);
    },
  };
}
