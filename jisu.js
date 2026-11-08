/** @type {import('./_venera_.js')} */
// 极速漫画 (1kkk.com)
// 图源参考: yckceo 异次元图源 id=944 的 R002 解密结果
//
// 图片接口逆向:
//   章节页给出 DM5_CID / DM5_MID / DM5_IMAGE_COUNT / DM5_VIEWSIGN(_DT)
//   GET chapterfun.ashx?cid=...&page=N&key=...&_cid=...&_mid=...&_dt=...&_sign=...
//   返回一段 Dean Edwards packer 的 JS, 解包后包含 pix / key / pvalue,
//   图片地址 = pix + pvalue[i] + "?cid=...&key=..."
class JisuManga extends ComicSource {
  name = "极速漫画";

  key = "jisu";

  version = "1.0.0";

  minAppVersion = "1.4.0";

  url = "https://cdn.jsdelivr.net/gh/venera-app/venera-configs@main/jisu.js";

  baseUrl = "https://www.1kkk.com";

  get headers() {
    return {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
      Referer: this.baseUrl + "/",
    };
  }

  async getDoc(path) {
    const url = path.startsWith("http") ? path : this.baseUrl + path;
    const res = await Network.get(url, this.headers);
    if (res.status !== 200) {
      throw `Invalid status code: ${res.status}`;
    }
    return new HtmlDocument(res.body);
  }

  parseCover(style) {
    const match = (style || "").match(/url\((.*?)\)/);
    return match ? match[1].replace(/['"]/g, "").trim() : "";
  }

  parseComic(item) {
    const link = item.querySelector(".title a") || item.querySelector("a");
    const title =
      link?.attributes["title"] || link?.text || "";
    const coverImg = item.querySelector(".cover img, .mh-cover img, img");
    const coverStyle = item.querySelector(".mh-cover")?.attributes["style"];
    let cover =
      coverImg?.attributes["src"] ||
      coverImg?.attributes["data-src"] ||
      this.parseCover(coverStyle) ||
      "";
    if (cover.startsWith("//")) {
      cover = "https:" + cover;
    }
    return new Comic({
      id: link?.attributes["href"] || "",
      title: title.replace(/\s+/g, " ").trim(),
      cover: cover,
      subTitle:
        item
          .querySelector(".chapter a, .tip, .subtitle")
          ?.text?.replace(/\s+/g, " ")
          .trim() || "",
    });
  }

  parseList(doc) {
    const comics = [];
    const seen = {};
    for (const item of doc.querySelectorAll(
      ".banner_detail_form, .mh-list li"
    )) {
      const comic = this.parseComic(item);
      if (!comic.id || !comic.title || seen[comic.id]) {
        continue;
      }
      seen[comic.id] = true;
      comics.push(comic);
    }
    return comics;
  }

  parseMaxPage(doc, pattern) {
    let max = 1;
    for (const a of doc.querySelectorAll("a")) {
      const href = a.attributes["href"] || "";
      const match = href.match(pattern);
      if (match) {
        max = Math.max(max, parseInt(match[1], 10));
      }
    }
    return max;
  }

  // Dean Edwards packer 解包
  unpackPacker(script) {
    const match = script.match(
      /}\('([\s\S]*?)',(\d+),(\d+),'([\s\S]*?)'\.split\('\|'\)/
    );
    if (!match) {
      return script;
    }
    let p = match[1];
    const a = parseInt(match[2], 10);
    let c = parseInt(match[3], 10);
    const k = match[4].split("|");
    const e = (n) => {
      const base = n < a ? "" : e(parseInt(n / a, 10));
      const rest = n % a;
      return (
        base +
        (rest > 35 ? String.fromCharCode(rest + 29) : rest.toString(36))
      );
    };
    while (c--) {
      if (k[c]) {
        p = p.replace(new RegExp("\\b" + e(c) + "\\b", "g"), k[c]);
      }
    }
    return p;
  }

  async loadImages(cid, mid, page, signDt, sign, key) {
    const query =
      `cid=${cid}&page=${page}&key=${encodeURIComponent(key || "")}` +
      `&language=1&gtk=6&_cid=${cid}&_mid=${mid}` +
      `&_dt=${encodeURIComponent(signDt)}&_sign=${sign}`;
    const res = await Network.get(
      `${this.baseUrl}/chapterfun.ashx?${query}`,
      {
        ...this.headers,
        Referer: `${this.baseUrl}/ch${page}-${cid}/`,
      }
    );
    if (res.status !== 200) {
      return [];
    }
    const plain = this.unpackPacker(res.body).replace(/\\'/g, "'");
    const keyMatch = plain.match(/var key=['"]([^'"]*)['"]/);
    const pixMatch = plain.match(/var pix=["']([^"']+)["']/);
    const listMatch = plain.match(/var pvalue=(\[[\s\S]*?\])/);
    if (!pixMatch || !listMatch) {
      return [];
    }
    const imageKey = keyMatch ? keyMatch[1] : key || "";
    let list = [];
    try {
      list = JSON.parse(listMatch[1].replace(/'/g, '"'));
    } catch (e) {
      return [];
    }
    const images = [];
    for (const p of list) {
      if (!p) {
        continue;
      }
      let url = /^https?:\/\//i.test(p) ? p : pixMatch[1] + p;
      if (url.startsWith("//")) {
        url = "https:" + url;
      }
      if (!/^https?:\/\//i.test(p)) {
        url += `?cid=${cid}&key=${encodeURIComponent(imageKey)}`;
      }
      images.push(url);
    }
    return images;
  }

  explore = [
    {
      title: "全部",
      type: "multiPageComicList",
      load: async (page) => {
        const doc = await this.getDoc(`/manhua-list-p${page || 1}`);
        return {
          comics: this.parseList(doc),
          maxPage: this.parseMaxPage(doc, /manhua-list-p(\d+)/),
        };
      },
    },
    {
      title: "连载",
      type: "multiPageComicList",
      load: async (page) => {
        const doc = await this.getDoc(`/manhua-list-st1-p${page || 1}`);
        return {
          comics: this.parseList(doc),
          maxPage: this.parseMaxPage(doc, /manhua-list-st1-p(\d+)/),
        };
      },
    },
    {
      title: "完结",
      type: "multiPageComicList",
      load: async (page) => {
        const doc = await this.getDoc(`/manhua-list-st2-p${page || 1}`);
        return {
          comics: this.parseList(doc),
          maxPage: this.parseMaxPage(doc, /manhua-list-st2-p(\d+)/),
        };
      },
    },
  ];

  search = {
    load: async (keyword, options, page) => {
      const doc = await this.getDoc(
        `/search?title=${encodeURIComponent(keyword)}&language=1&page=${
          page || 1
        }`
      );
      return {
        comics: this.parseList(doc),
        maxPage: this.parseMaxPage(doc, /[?&]page=(\d+)/),
      };
    },

    enableTagsSuggestions: false,
  };

  comic = {
    loadInfo: async (id) => {
      const doc = await this.getDoc(id);
      const info = doc.querySelector(".banner_detail_form") || doc;
      let title = info.querySelector(".info .title")?.text || "";
      title = title
        .replace(/\s+/g, " ")
        .trim()
        .replace(/\s*\d+(\.\d+)?分\s*$/, "")
        .trim();

      const cover =
        info.querySelector(".cover img")?.attributes["src"] || "";

      const subtitle =
        info.querySelector(".subtitle")?.text?.replace(/\s+/g, " ").trim() ||
        "";
      const author = subtitle.replace(/^作者：/, "").trim();

      const tags = {};
      if (author) {
        tags["作者"] = [author];
      }
      const status =
        info.querySelector(".tip .block")?.text?.replace(/\s+/g, " ").trim();
      if (status) {
        tags["状态"] = [status.replace(/^状态：/, "").trim()];
      }

      const description =
        info
          .querySelector(".info .content")
          ?.text?.replace(/\s+/g, " ")
          .trim() || "";

      const chapterList = [];
      const chapterSeen = {};
      for (const li of doc.querySelectorAll(".detail-list-select li")) {
        const a = li.querySelector("a");
        const href = a?.attributes["href"];
        if (!href || chapterSeen[href]) {
          continue;
        }
        const name =
          a.attributes["title"]?.replace(/\s+/g, " ").trim() ||
          a.text.replace(/\s+/g, " ").trim();
        if (name) {
          chapterSeen[href] = true;
          chapterList.push([href, name]);
        }
      }
      // 详情页默认是倒序, 按章节号升序排列, 番外等放在最后
      const chapterNo = (name) => {
        const match = name.match(/第\s*(\d+)\s*[话話回]/);
        return match ? parseInt(match[1], 10) : null;
      };
      chapterList.sort((a, b) => {
        const na = chapterNo(a[1]);
        const nb = chapterNo(b[1]);
        if (na === null && nb === null) {
          return 0;
        }
        if (na === null) {
          return 1;
        }
        if (nb === null) {
          return -1;
        }
        return na - nb;
      });
      const chapters = {};
      for (const [href, name] of chapterList) {
        chapters[href] = name;
      }

      return {
        title: title,
        cover: cover,
        description: description,
        tags: tags,
        chapters: chapters,
      };
    },

    loadEp: async (comicId, epId) => {
      const url = epId.startsWith("http") ? epId : this.baseUrl + epId;
      const res = await Network.get(url, this.headers);
      if (res.status !== 200) {
        throw `Invalid status code: ${res.status}`;
      }
      const html = res.body;
      const pick = (re) => {
        const m = html.match(re);
        return m ? m[1] : "";
      };
      const cid = pick(/DM5_CID\s*=\s*(\d+)/);
      const mid = pick(/DM5_MID\s*=\s*(\d+)/);
      const count = parseInt(pick(/DM5_IMAGE_COUNT\s*=\s*(\d+)/), 10);
      const signDt = pick(/DM5_VIEWSIGN_DT\s*=\s*"([^"]+)"/);
      const sign = pick(/DM5_VIEWSIGN\s*=\s*"([^"]+)"/);
      const key = pick(/id=["']dm5_key["'][^>]*value=["']([^"']*)["']/);
      if (!cid || !mid || !count || !sign) {
        throw "Failed to parse chapter page";
      }

      const images = [];
      for (let page = 1; page <= count; page++) {
        const pageImages = await this.loadImages(
          cid,
          mid,
          page,
          signDt,
          sign,
          key
        );
        images.push(...pageImages);
      }
      if (images.length === 0) {
        throw "No images found";
      }
      return { images: images };
    },

    onImageLoad: (url, comicId, epId) => {
      return {
        url: url,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
          Referer: "https://www.1kkk.com/",
        },
      };
    },
  };
}
