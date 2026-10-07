/** @type {import('./_venera_.js')} */

// 神奇漫画 (shenqimanhua.net)
class ShenqiManga extends ComicSource {
  name = "神奇漫画";
  key = "shenqimanhua";
  version = "1.0.0";
  minAppVersion = "1.0.0";
  url = "https://cdn.jsdelivr.net/gh/venera-app/venera-configs@main/shenqimanhua.js";

  static baseUrl = "https://shenqimanhua.net";
  static TAG = "[神奇漫画]";

  // 日志输出
  static log(...args) {
    console.log(ShenqiManga.TAG, ...args);
  }

  static warn(...args) {
    console.warn(ShenqiManga.TAG, "[警告]", ...args);
  }

  static error(...args) {
    console.error(ShenqiManga.TAG, "[错误]", ...args);
  }

  // 请求标头
  static headers = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept":
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
  };

  // 缩略图配置
  static thumbConfig = (url) => ({
    headers: {
      ...ShenqiManga.headers,
      "Referer": ShenqiManga.baseUrl,
    },
  });

  // URL 补全
  static fixUrl(url) {
    if (!url) return "";
    let clean = String(url).trim();
    if (clean.startsWith("//")) return `https:${clean}`;
    if (clean.startsWith("/")) return `${ShenqiManga.baseUrl}${clean}`;
    return clean;
  }

  // 标题清洗
  static cleanTitle(raw) {
    if (!raw) return "";
    let t = String(raw).trim();
    t = t.replace(/\s*封面\s*$/i, "");
    t = t.replace(/^[《〈【\[(（]/, "").replace(/[》〉】\])）]$/, "");
    t = t.replace(/\s*封面\s*$/i, "");
    return t.split("|")[0].split("_")[0].trim();
  }

  // 解析漫画卡片
  static parseComicCards(document, rawHtml) {
    let comics = [];
    let seen = new Set();
    let html = rawHtml || (document && document.html) || "";

    if (!html) return comics;

    // 正则提取
    try {
      let regex = /<a[^>]*href=["'](\/comic\/[a-zA-Z0-9]+)["'][^>]*>([\s\S]*?)<\/a>/gi;
      let match;
      while ((match = regex.exec(html)) !== null) {
        let href = match[1];
        if (!seen.has(href)) {
          let inner = match[2];
          let imgMatch = inner.match(/<img[^>]*src=["']([^"']+)["'][^>]*/i) ||
                         inner.match(/src=["']([^"']+)["']/i);
          let altMatch = inner.match(/alt=["']([^"']+)["']/i);
          let titleMatch = inner.match(/<div[^>]*class=["'][^"']*line-clamp-1[^"']*["'][^>]*>([^<]+)<\/div>/i);

          if (imgMatch) {
            seen.add(href);
            let cover = imgMatch[1];
            let rawTitle = titleMatch ? titleMatch[1] : (altMatch ? altMatch[1] : href.replace("/comic/", ""));
            let title = ShenqiManga.cleanTitle(rawTitle);

            comics.push({
              id: ShenqiManga.fixUrl(href),
              title: title,
              subTitle: "",
              cover: ShenqiManga.fixUrl(cover),
            });
          }
        }
      }
    } catch (e) {
      ShenqiManga.warn("正则卡片提取产生异常:", e.message);
    }

    // DOM 兜底
    if (comics.length === 0 && document && typeof document.querySelectorAll === "function") {
      try {
        let allLinks = document.querySelectorAll("a");
        allLinks.forEach((a) => {
          let href = a.attributes["href"] || "";
          if (href.includes("/comic/") && !seen.has(href)) {
            let img = a.querySelector("img");
            if (img) {
              seen.add(href);
              let title =
                img.attributes["alt"] ||
                (a.querySelector("h2") && a.querySelector("h2").text) ||
                (a.querySelector("h3") && a.querySelector("h3").text) ||
                a.text.trim();

              let cover =
                img.attributes["src"] ||
                img.attributes["data-src"] ||
                "";

              comics.push({
                id: ShenqiManga.fixUrl(href),
                title: ShenqiManga.cleanTitle(title),
                subTitle: "",
                cover: ShenqiManga.fixUrl(cover),
              });
            }
          }
        });
      } catch (domErr) {
        ShenqiManga.warn("DOM 备用提取异常:", domErr.message);
      }
    }

    return comics;
  }

  // 探索推荐
  explore = [
    {
      title: this.name,
      type: "singlePageWithMultiPart",
      load: async () => {
        ShenqiManga.log("开始加载探索推荐页...");
        try {
          let res = await Network.get(ShenqiManga.baseUrl + "/", ShenqiManga.headers);
          if (res.status !== 200) {
            throw new Error(`首页 HTTP 状态码异常: ${res.status}`);
          }

          let document = new HtmlDocument(res.body);
          let comics = ShenqiManga.parseComicCards(document, res.body);

          ShenqiManga.log(`探索页加载成功，共抓取到 ${comics.length} 本推荐作品`);

          if (comics.length === 0) {
            ShenqiManga.warn("探索页漫画列表为空，请检查网络或网站结构");
          }

          let mid = Math.ceil(comics.length / 2);
          return {
            "热门精选": comics.slice(0, mid),
            "最新更新": comics.slice(mid),
          };
        } catch (err) {
          ShenqiManga.error("加载探索页面失败:", err.message);
          throw new Error(`探索加载失败: ${err.message}`);
        }
      },
      onThumbnailLoad: ShenqiManga.thumbConfig,
    },
  ];

  // 分类配置
  category = {
    title: "神奇漫画",
    parts: [
      {
        name: "题材",
        type: "fixed",
        categories: [
          "全部",
          "热血",
          "逆袭",
          "穿越",
          "奇幻",
          "复仇",
          "都市",
          "科幻",
          "恋爱",
          "悬疑",
          "暗黑",
          "校园",
          "武侠",
          "治愈",
          "进阶",
          "轻松",
        ],
        itemType: "category",
        categoryParams: [
          "全部",
          "热血",
          "逆袭",
          "穿越",
          "奇幻",
          "复仇",
          "都市",
          "科幻",
          "恋爱",
          "悬疑",
          "暗黑",
          "校园",
          "武侠",
          "治愈",
          "进阶",
          "轻松",
        ],
      },
    ],
    enableRankingPage: false,
  };

  // 分类漫画加载
  categoryComics = {
    load: async (category, param, options, page) => {
      let tag = param || "全部";
      let sort = options && options[0] ? options[0] : "latest";
      let requestUrl = `${ShenqiManga.baseUrl}/comics?tag=${encodeURIComponent(
        tag
      )}&sort=${sort}&page=${page}`;

      ShenqiManga.log(`加载分类: tag="${tag}", sort=${sort}, page=${page}, url=${requestUrl}`);

      try {
        let res = await Network.get(requestUrl, ShenqiManga.headers);
        if (res.status !== 200) {
          throw new Error(`分类请求失败，HTTP 状态码: ${res.status}`);
        }

        let document = new HtmlDocument(res.body);
        let comics = ShenqiManga.parseComicCards(document, res.body);

        let maxPage = 100;
        let pageLinks = document.querySelectorAll("a");
        pageLinks.forEach((a) => {
          let href = a.attributes["href"] || "";
          let match = href.match(/page=(\d+)/);
          if (match) {
            let p = parseInt(match[1], 10);
            if (p > maxPage) maxPage = p;
          }
        });

        ShenqiManga.log(`分类加载完成: 本页共 ${comics.length} 本，总估算页数: ${maxPage}`);
        return {
          comics,
          maxPage: comics.length === 0 ? page : maxPage,
        };
      } catch (err) {
        ShenqiManga.error("分类漫画加载失败:", err.message);
        throw new Error(`分类加载失败: ${err.message}`);
      }
    },
    onThumbnailLoad: ShenqiManga.thumbConfig,
    optionList: [
      {
        options: ["latest-最新更新", "total-总排行榜"],
      },
    ],
  };

  // 搜索
  search = {
    load: async (keyword, options, page) => {
      let searchUrl = `${ShenqiManga.baseUrl}/search?query=${encodeURIComponent(
        keyword
      )}`;
      ShenqiManga.log(`执行搜索: keyword="${keyword}", url=${searchUrl}`);

      try {
        let res = await Network.get(searchUrl, ShenqiManga.headers);
        if (res.status !== 200) {
          throw new Error(`搜索请求异常，状态码: ${res.status}`);
        }

        let comics = ShenqiManga.parseComicCards(null, res.body);

        ShenqiManga.log(`搜索完成: 关键词 "${keyword}" 共检索到 ${comics.length} 本漫画`);
        return {
          comics,
          maxPage: 1,
        };
      } catch (err) {
        ShenqiManga.error("搜索漫画失败:", err.message);
        throw new Error(`搜索失败: ${err.message}`);
      }
    },
    onThumbnailLoad: ShenqiManga.thumbConfig,
    optionList: [],
  };

  // 漫画详情
  comic = {
    loadInfo: async (id) => {
      let comicUrl = ShenqiManga.fixUrl(id);
      ShenqiManga.log(`加载漫画详情: ${comicUrl}`);

      try {
        let res = await Network.get(comicUrl, ShenqiManga.headers);
        if (res.status !== 200) {
          throw new Error(`详情页面请求失败，HTTP 状态码: ${res.status}`);
        }

        let document = new HtmlDocument(res.body);

        // 提取 meta 标签
        let getMeta = (prop) => {
          let reg1 = new RegExp(`(?:property|name)=["']${prop}["'][^>]*content=["']([^"']+)["']`, "i");
          let reg2 = new RegExp(`content=["']([^"']+)["'][^>]*(?:property|name)=["']${prop}["']`, "i");
          let m = res.body.match(reg1) || res.body.match(reg2);
          return m ? m[1] : "";
        };

        // 标题
        let titleEl = document.querySelector("h1");
        let title = titleEl ? titleEl.text.trim() : "";
        if (!title) {
          title = getMeta("og:title") || getMeta("og:comic:title");
          if (title) {
            title = title.replace(/《|》|高清.*|免费.*/g, "").trim();
          }
        }
        if (!title) {
          let tMatch = res.body.match(/<title>([^<_\-]+)/i);
          if (tMatch) title = tMatch[1].replace(/《|》/g, "").trim();
        }
        if (!title) title = "未知漫画";

        // 封面
        let cover = getMeta("og:image");
        if (!cover) {
          let coverImg =
            document.querySelector("img[src*='comicsStore']") ||
            document.querySelector("img[src*='Store']") ||
            document.querySelector("div.cover img");
          if (coverImg) cover = coverImg.attributes["src"] || "";
        }
        cover = ShenqiManga.fixUrl(cover);

        // 简介
        let intro = getMeta("og:description") || getMeta("description");

        // 作者
        let author = getMeta("book:author") || getMeta("og:comic:author") || "未知";

        // 章节目录
        let eps = new Map();
        let comicId = id.replace(/.*\/comic\//, "").replace(/\?.*/, "").trim();

        // 解析 Next.js 流数据中的章节
        let jsonMatch = res.body.match(/\\*"chapters\\*":\s*(\[\s*\\*\{[\s\S]*?\\*\}\s*\])/);
        if (jsonMatch) {
          try {
            let rawJson = jsonMatch[1].replace(/\\"/g, '"');
            let chapsList = JSON.parse(rawJson);
            chapsList.forEach((item) => {
              if (item && item.id) {
                let epUrl = `${ShenqiManga.baseUrl}/read/${comicId}/${item.id}`;
                let epTitle = item.title ? item.title.trim() : `第${item.number || ""}话`;
                eps.set(epUrl, epTitle);
              }
            });
            ShenqiManga.log(`[章节解析] 通过 Next.js 数据流解析出 ${eps.size} 个章节`);
          } catch (jsonErr) {
            ShenqiManga.warn("[章节解析] 数据流 JSON 解析异常:", jsonErr.message);
          }
        }

        // 正则兜底解析
        if (eps.size === 0) {
          ShenqiManga.log("[章节解析] 触发 DOM 与源码正则兜底解析...");
          let reg = new RegExp(`/read/${comicId}/([a-zA-Z0-9]+)`, "g");
          let m;
          while ((m = reg.exec(res.body)) !== null) {
            let epId = m[1];
            let epUrl = `${ShenqiManga.baseUrl}/read/${comicId}/${epId}`;
            if (!eps.has(epUrl)) {
              eps.set(epUrl, `第 ${eps.size + 1} 话`);
            }
          }
          ShenqiManga.log(`[章节解析] 兜底解析出 ${eps.size} 个章节`);
        }

        if (eps.size === 0) {
          throw new Error("未解析到任何有效章节，可能需要登录或页面结构已改变");
        }

        ShenqiManga.log(`漫画详情解析成功: 《${title}》, 封面=${cover ? "有效" : "无"}, 章节数=${eps.size}`);

        return {
          title,
          cover,
          description: intro,
          tags: {
            作者: [author],
          },
          chapters: eps,
        };
      } catch (err) {
        ShenqiManga.error(`漫画详情 (${id}) 加载失败:`, err.message);
        throw new Error(`漫画详情加载失败: ${err.message}`);
      }
    },
    onThumbnailLoad: ShenqiManga.thumbConfig,

    // 加载章节正文图片
    loadEp: async (comicId, epId) => {
      let epUrl = ShenqiManga.fixUrl(epId);
      ShenqiManga.log(`开始加载章节图片: ${epUrl}`);

      try {
        let res = await Network.get(epUrl, ShenqiManga.headers);
        if (res.status !== 200) {
          throw new Error(`章节页面请求异常，状态码: ${res.status}`);
        }

        let document = new HtmlDocument(res.body);
        let images = [];
        let seenImgs = new Set();

        // DOM 提取
        try {
          let allImgs = document.querySelectorAll("img");
          allImgs.forEach((img) => {
            let src = img.attributes["src"] || img.attributes["data-src"] || "";
            if (
              src &&
              (src.includes("/image/crawl") || src.includes(".webp") || src.includes(".jpg") || src.includes(".png")) &&
              !src.includes("Store") &&
              !src.includes("avatar") &&
              !src.includes("logo")
            ) {
              let fullImgUrl = ShenqiManga.fixUrl(src);
              if (!seenImgs.has(fullImgUrl)) {
                seenImgs.add(fullImgUrl);
                images.push(fullImgUrl);
              }
            }
          });
        } catch (domErr) {
          ShenqiManga.warn("DOM 图片提取异常:", domErr.message);
        }

        // 正则兜底提取
        if (images.length === 0) {
          ShenqiManga.log("触发源码正则全量提取图片直链...");
          let regex = /src=["'](\/image\/crawl[^\s"']+\.(?:webp|jpg|png))["']/gi;
          let m;
          while ((m = regex.exec(res.body)) !== null) {
            let fullImgUrl = ShenqiManga.fixUrl(m[1]);
            if (!seenImgs.has(fullImgUrl)) {
              seenImgs.add(fullImgUrl);
              images.push(fullImgUrl);
            }
          }
        }

        if (images.length === 0) {
          throw new Error("未能解析出章节正文图片，请检查网络或网站状态");
        }

        ShenqiManga.log(`章节图片解析成功，共 ${images.length} 张图片`);
        return {
          images,
        };
      } catch (err) {
        ShenqiManga.error(`加载章节 (${epId}) 失败:`, err.message);
        throw new Error(`加载章节失败: ${err.message}`);
      }
    },

    // 图片请求配置
    onImageLoad: (url, comicId, epId) => {
      return {
        url,
        headers: {
          ...ShenqiManga.headers,
          "Referer": ShenqiManga.baseUrl,
        },
      };
    },
  };
}

// 测试环境导出
if (typeof module !== "undefined" && module.exports) {
  module.exports = ShenqiManga;
}
