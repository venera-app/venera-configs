/** @type {import('./_venera_.js')} */
// 如漫画 (rumanhua2.com)
// 图源参考: yckceo 异次元图源 id=... 的 <js> 规则
//
// 章节图片逆向:
//   1. 章节页里有一段 Dean Edwards packer 的 JS, 解包后得到
//      var __c0rst96="...";  (base64)
//   2. .readerContainer[data-id] 作为下标, 从固定 key 表取 base64 key
//   3. base64 解码 __c0rst96 与 key, 逐字节 XOR
//   4. XOR 结果仍是一段 base64, 解码后 JSON.parse 得到图片 URL 列表
class RuManHua2 extends ComicSource {
  name = "如漫画";

  key = "rumanhua2";

  version = "1.0.0";

  minAppVersion = "1.4.0";

  url = "https://cdn.jsdelivr.net/gh/venera-app/venera-configs@main/rumanhua2.js";

  baseUrl = "http://rumanhua2.com";

  // 与旧图源规则中的 arr 完全一致
  keys = [
    "c21raHkyNTg=",
    "c21rZDk1ZnY=",
    "bWQ0OTY5NTI=",
    "Y2Rjc2R3cQ==",
    "dmJmc2EyNTY=",
    "Y2F3ZjE1MWM=",
    "Y2Q1NmN2ZGE=",
    "OGtpaG50OQ==",
    "ZHNvMTV0bG8=",
    "NWtvNnBsaHk=",
  ];

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

  fixUrl(url) {
    if (!url) {
      return "";
    }
    if (url.startsWith("//")) {
      return "http:" + url;
    }
    return url;
  }

  // Dean Edwards packer 解包 (payload 的字典下标是十进制数字)
  unpackPacker(script) {
    const match = script.match(
      /eval\(function\(p,a,c,k,e,d\)\{[\s\S]*?\}\('([\s\S]*?)',(\d+),(\d+),'([\s\S]*?)'\.split\('\|'\),0,\{\}\)\)/
    );
    if (!match) {
      return "";
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

  decodeImages(html) {
    const doc = new HtmlDocument(html);
    const reader = doc.querySelector(".readerContainer");
    const id = parseInt(reader?.attributes["data-id"] || "0", 10);
    if (!this.keys[id]) {
      throw "Unknown image key";
    }

    const script = html.match(
      /eval\(function\(p,a,c,k,e,d\)[\s\S]*?\}\('[\s\S]*?'\.split\('\|'\),0,\{\}\)\)/
    );
    if (!script) {
      throw "Packer not found";
    }
    const unpacked = this.unpackPacker(script[0]);
    const encrypted = unpacked.match(/__c0rst96\s*=\s*"([^"]+)"/);
    if (!encrypted) {
      throw "Cipher text not found";
    }

    const data = new Uint8Array(Convert.decodeBase64(encrypted[1]));
    const key = new Uint8Array(Convert.decodeBase64(this.keys[id]));
    for (let i = 0; i < data.length; i++) {
      data[i] = data[i] ^ key[i % key.length];
    }
    const base64 = Convert.decodeUtf8(data.buffer);
    const json = Convert.decodeUtf8(Convert.decodeBase64(base64));
    return JSON.parse(json);
  }

  // 站点搜索接口 (/s?k=) 目前对任何关键词都返回"小于2个字", 无法使用;
  // 保留 search 字段以满足解析器要求, 实际通过发现页浏览。
  search = {
    load: async () => {
      throw "站点搜索接口已关闭，请从发现页浏览";
    },

    enableTagsSuggestions: false,
  };

  explore = [
    {
      title: "最近更新",
      type: "multiPageComicList",
      load: async () => {
        const doc = await this.getDoc("/");
        const comics = [];
        const seen = {};
        for (const a of doc.querySelectorAll("a[title]")) {
          if (!a.querySelector(".card-title")) {
            continue;
          }
          const href = a.attributes["href"] || "";
          if (!href.startsWith("/") || seen[href]) {
            continue;
          }
          const img = a.querySelector("img");
          const ps = a.querySelectorAll("p");
          comics.push(
            new Comic({
              id: href,
              title: (a.attributes["title"] || "").replace(/\s+/g, " ").trim(),
              cover: this.fixUrl(
                img?.attributes["data-src"] || img?.attributes["src"] || ""
              ),
              subTitle:
                ps.length > 1
                  ? ps[ps.length - 1].text.replace(/\s+/g, " ").trim()
                  : "",
            })
          );
          seen[href] = true;
        }
        return { comics: comics, maxPage: 1 };
      },
    },
  ];

  comic = {
    loadInfo: async (id) => {
      const doc = await this.getDoc(id);
      const comicId = id.replace(/^\/|\/$/g, "");

      const title =
        doc.querySelector(".book-name h1.name")?.text?.replace(/\s+/g, " ").trim() ||
        doc.querySelector("h1.name")?.text?.replace(/\s+/g, " ").trim() ||
        "";
      const cover = this.fixUrl(
        doc.querySelector(".book-cover img")?.attributes["data-src"] ||
          doc.querySelector(".book-cover img")?.attributes["src"] ||
          ""
      );

      let author = "";
      for (const p of doc.querySelectorAll(".comic-info-detail p")) {
        const text = p.text.replace(/\s+/g, " ").trim();
        if (text.startsWith("作者：")) {
          author = text.substring(3).trim();
          break;
        }
      }
      const tags = {};
      if (author) {
        tags["作者"] = [author];
      }
      const genres = doc
        .querySelectorAll(".comic-tags span")
        .map((s) => s.text.trim())
        .filter((s) => s.length > 0);
      if (genres.length > 0) {
        tags["类型"] = genres;
      }

      const description =
        doc
          .querySelector(".cartoon-introduction")
          ?.text?.replace(/\s+/g, " ")
          .trim() || "";

      const chapterMap = {};
      const addChapter = (href, name) => {
        if (!href || chapterMap[href]) {
          return;
        }
        chapterMap[href] = name.replace(/\s+/g, " ").trim();
      };

      for (const a of doc.querySelectorAll(".chaplist-box a")) {
        const href = a.attributes["href"];
        if (!href) {
          continue;
        }
        addChapter(href, a.text);
      }

      // 详情页只显示最近 20 多话, 更早的章节通过 morechapter 接口获取
      try {
        const res = await Network.post(
          `${this.baseUrl}/morechapter`,
          {
            "content-type": "application/x-www-form-urlencoded",
            ...this.headers,
          },
          `id=${encodeURIComponent(comicId)}`
        );
        if (res.status === 200) {
          const data = JSON.parse(res.body);
          if (data.code === "200" && Array.isArray(data.data)) {
            for (const item of data.data) {
              addChapter(
                `/${comicId}/${item.chapterid}.html`,
                String(item.chaptername || "")
              );
            }
          }
        }
      } catch (e) {
        // 没有更多章节时接口会返回错误, 忽略即可
      }

      // 按章节序号升序排列 (章节名形如 "168秘境树海")
      const chapters = {};
      Object.keys(chapterMap)
        .sort((a, b) => {
          const na = parseInt(chapterMap[a], 10);
          const nb = parseInt(chapterMap[b], 10);
          if (isNaN(na) || isNaN(nb)) {
            return 0;
          }
          return na - nb;
        })
        .forEach((href) => {
          chapters[href] = chapterMap[href];
        });

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
      return { images: this.decodeImages(res.body) };
    },

    onImageLoad: (url, comicId, epId) => {
      return {
        url: url,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
          Referer: "http://rumanhua2.com/",
        },
      };
    },
  };
}
