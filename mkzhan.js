/** @type {import('../venera-configs-main/_venera_.js')} */

/**
 * 漫客栈
 * 搜索(HTML) / 章节(API) / 图片(API)
 */
class Mkzhan extends ComicSource {
  name = "漫客栈";
  key = "mkzhan";
  version = "1.0.1";
  minAppVersion = "1.0.0";
  url = "https://cdn.jsdelivr.net/gh/Souitou-iop/venerax-configs-enhanced@main/mkzhan.js";

  static webBase = "https://www.mkzhan.com";
  static apiBase = "https://comic.mkzcdn.com";
  static headers = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    Accept: "text/html,application/json,*/*",
  };

  static https(url) {
    if (!url) return "";
    return String(url).replace(/^http:/i, "https:");
  }

  static cover(url) {
    let u = Mkzhan.https(url);
    if (!u) return u;
    if (u.includes("!cover-")) return u;
    return u.replace(/\.(jpg|jpeg|png|webp)(\?.*)?$/i, ".$1!cover-400");
  }

  static parseList(jsonText) {
    let data = JSON.parse(jsonText);
    if (String(data.code) !== "200") {
      throw data.message || "API error";
    }
    return data.data;
  }

  explore = [
    {
      title: "漫客栈",
      type: "multiPageComicList",
      load: async (page) => {
        page = page || 1;
        let res = await Network.get(
          `${Mkzhan.apiBase}/search/filter/?order=1&page_num=${page}&page_size=20`,
          Mkzhan.headers
        );
        if (res.status !== 200) throw `Invalid status: ${res.status}`;
        let data = Mkzhan.parseList(res.body);
        let list = data.list || [];
        let comics = list.map(
          (item) =>
            new Comic({
              id: String(item.comic_id),
              title: item.title,
              cover: Mkzhan.cover(item.cover),
              description: item.chapter_title || "",
              tags: item.finish == 2 || item.finish === "2" ? ["完结"] : ["连载"],
            })
        );
        return {
          comics,
          maxPage: Math.max(1, Math.ceil((data.total || list.length * page) / 20)),
        };
      },
    },
  ];

  search = {
    load: async (keyword, options, page) => {
      page = page || 1;
      let url = `${Mkzhan.webBase}/search/?keyword=${encodeURIComponent(
        keyword
      )}&page=${page}`;
      let res = await Network.get(url, Mkzhan.headers);
      if (res.status !== 200) throw `Invalid status: ${res.status}`;
      let document = new HtmlDocument(res.body);
      let comics = [];
      for (let item of document.querySelectorAll(".common-comic-item")) {
        let a = item.querySelector("a");
        let titleA = item.querySelector(".comic__title a") || a;
        let img = item.querySelector("img");
        if (!a || !titleA) continue;
        let href = a.attributes["href"] || "";
        let m = href.match(/\/(\d+)\/?/);
        if (!m) continue;
        let cover = "";
        if (img) {
          cover = img.attributes["data-src"] || img.attributes["src"] || "";
        }
        comics.push(
          new Comic({
            id: m[1],
            title: titleA.text.trim(),
            cover: Mkzhan.cover(cover),
          })
        );
      }
      return {
        comics,
        maxPage: comics.length > 0 ? page + 1 : page,
      };
    },
    optionList: [],
  };

  comic = {
    loadInfo: async (id) => {
      id = String(id);
      let chRes = await Network.get(
        `${Mkzhan.apiBase}/chapter/v1/?comic_id=${id}`,
        Mkzhan.headers
      );
      if (chRes.status !== 200) throw `Invalid status: ${chRes.status}`;
      let chData = Mkzhan.parseList(chRes.body);
      if (!Array.isArray(chData)) {
        chData = chData.list || chData.chapters || [];
      }

      let detailRes = await Network.get(
        `${Mkzhan.webBase}/${id}/`,
        Mkzhan.headers
      );
      let title = id;
      let cover = "";
      let description = "";
      let author = "";
      if (detailRes.status === 200) {
        let doc = new HtmlDocument(detailRes.body);
        let h1 = doc.querySelector("h1, .comic-title, .j-comic-title");
        if (h1) title = h1.text.trim() || title;
        let img = doc.querySelector(".comic-cover img, #Cover img, .cover img, img");
        if (img) {
          cover = Mkzhan.cover(
            img.attributes["data-src"] || img.attributes["src"] || ""
          );
        }
        let intro = doc.querySelector(".comic-intro, .intro, .desc, .j-intro");
        if (intro) description = intro.text.trim();
        let authorEl = doc.querySelector(".author a, .comic-author a, .name a");
        if (authorEl) author = authorEl.text.trim();
      }

      let chapters = new Map();
      let sorted = chData.slice().sort((a, b) => {
        let na = parseInt(a.number || a.sort || 0);
        let nb = parseInt(b.number || b.sort || 0);
        if (a.number && b.number) return na - nb;
        return nb - na;
      });
      for (let c of sorted) {
        let cid = String(c.chapter_id);
        let name = c.title || c.title_alias || cid;
        if (String(c.is_vip) === "1") name += " [VIP]";
        chapters.set(cid, name);
      }

      let tags = {};
      if (author) tags["作者"] = [author];

      return new ComicDetails({
        title: title,
        cover: cover,
        description: description,
        subtitle: author,
        tags: tags,
        chapters: chapters,
      });
    },

    loadEp: async (comicId, epId) => {
      let res = await Network.get(
        `${Mkzhan.apiBase}/chapter/content/?comic_id=${comicId}&chapter_id=${epId}`,
        Mkzhan.headers
      );
      if (res.status !== 200) throw `Invalid status: ${res.status}`;
      let data = Mkzhan.parseList(res.body);
      if (!Array.isArray(data)) data = data.list || [];
      let images = data
        .map((p) => Mkzhan.https(p.image || p.url || ""))
        .filter((u) => !!u);
      if (images.length === 0) throw "No images";
      return { images };
    },

    onImageLoad: (url, comicId, epId) => {
      return {
        headers: {
          Referer: Mkzhan.webBase + "/",
          "User-Agent": Mkzhan.headers["User-Agent"],
        },
      };
    },
  };
}
