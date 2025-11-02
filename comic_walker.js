class ComicWalker extends ComicSource {
  name = "カドコミ";
  key = "comic_walker";
  version = "1.0.0";
  minAppVersion = "1.6.0";
  url =
    "https://git.nyne.dev/nyne/venera-configs/raw/branch/main/comic_walker.js";

  api_key = "ytBrdQ2ZYdRQguqEusVLxQVUgakNnVht";

  latestVersion = "1.4.13";

  api_base = "https://mobileapp.comic-walker.com";

  get headers() {
    const headers = {
      "X-API-Environment-Key": this.api_key,
      "User-Agent": `BookWalkerApp/${this.latestVersion} (Android 13)`,
      "Host": "mobileapp.comic-walker.com",
      "Content-Type": "application/json"
    };
    const token = this.loadData("token");
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    return headers;
  }

  async refreshToken() {
    const res = await this.request(
      `${this.api_base}/v1/users`,
      this.headers,
      "POST",
    );

    this.saveData("token", res.resources.access_token);
    return res.resources.access_token;
  }

  async request(url, headers, method = "GET", data) {
    let response;
    if (method === "GET") {
      response = await Network.get(url, headers);
    } else if (method === "POST") {
      response = await Network.post(url, headers, data);
    } else {
      throw new Error(`Unsupported method: ${method}`);
    }
    if (
      response.status === 204
    ) {
      return response;
    }
    response = JSON.parse(response.body);
    if (
      response.code === "invalid_request_parameter" ||
      response.code === "free_daily_reward_quota_exceeded" ||
      response.code === "unauthorized"
    ) {
      await this.refreshToken();
      if (method === "GET") {
        response = await Network.get(url, this.headers);
      } else if (method === "POST") {
        response = await Network.post(url, this.headers, data);
      } else {
        throw new Error(`Unsupported method: ${method}`);
      }
      if (
        response.status === 204
      ) {
        return response;
      }
      response = JSON.parse(response.body);
    }
    return response;
  }

  async init() {
    const itunes_api = "https://itunes.apple.com/lookup?bundleId=jp.co.bookwalker.cwapp.ios&country=jp";

    const resp = await Network.get(itunes_api);

    if (resp.status == 200) {
      response = JSON.parse(resp.body);
      this.latestVersion = response.version;
    }

    await this.refreshToken();
  }

  explore = [
    {
      title: "カドコミ",
      type: "singlePageWithMultiPart",
      load: async () => {
        const res = await this.request(
          `${this.api_base}/v2/screens/home`,
          this.headers,
        );

        const result = {};

        const newArrivals = res.resources.new_arrival_comics.map((item) =>
          new Comic({
            id: item.id,
            title: item.title,
            cover: item.thumbnail_1x1 || "",
            tags: item.comic_labels?.map((l) => l.name) || [],
          }),
        );
        result["今日の更新"] = newArrivals;

        const attention = res.resources.attention_comics.map((item) =>
          new Comic({
            id: item.comic_id,
            title: item.title,
            cover: item.image_url || "",
            tags: item.comic_labels?.map((l) => l.name) || [],
          }),
        );
        result["注目作品"] = attention;

        for (const pickup of res.resources.pickup_comics) {
            const comics = pickup.comics.map((item) =>
                new Comic({
                    id: item.id,
                    title: item.title,
                    cover: item.thumbnail_1x1 || "",
                    tags: item.comic_labels?.map((l) => l.name) || [],
                }),
            );
            result[pickup.name] = comics;
        }

        const newSerialization = res.resources.new_serialization_comics.map((item) =>
            new Comic({
                id: item.id,
                title: item.title,
                cover: item.thumbnail_1x1 || "",
                tags: item.comic_labels?.map((l) => l.name) || [],
            }),
        );
        result["新連載"] = newSerialization;


        return result;
      },
    },
  ];

  search = {
    load: async (keyword, _, page) => {
      const res = await this.request(
        `${this.api_base}/v1/search/comics?keyword=${keyword}&limit=20&offset=${
          (page - 1) * 20
        }`,
        this.headers,
      );

      const comics = res.resources.map((item) =>
        new Comic({
          id: item.id,
          title: item.title,
          cover: item.thumbnail_1x1 || "",
          tags: [
            ...(item.authors?.map((a) => a.name) || []),
            ...(item.comic_labels?.map((l) => l.name) || []),
          ],
        })
      );
      const pageInfo = {
        hasNextPage: res.resources.length === 20,
        endCursor: null,
      };

      return {
        comics,
        maxPage: pageInfo.hasNextPage ? (page || 1) + 1 : (page || 1),
        endCursor: pageInfo.endCursor,
      };
    },
  };

  comic = {
    loadInfo: async (id) => {
      const res = await this.request(
        `${this.api_base}/v2/screens/comics/${id}`,
        this.headers,
      );
      const detail = res.resources.detail;

      const totalCount = res.resources.episode_total_count || 0;
      let episodes = { resources: [] };
      for (let offset = 0; offset < totalCount; offset += 100) {
        const chunk = await this.request(
          `${this.api_base}/v1/comics/${id}/episodes?offset=${offset}&limit=100&sort=asc`,
          this.headers,
        );
        episodes.resources.push(...(chunk.resources || []));
      }

      const tags = new Map();

      if (detail.authors) {
        detail.authors.forEach((a) => {
          if (!tags.has(a.role)) tags.set(a.role, []);
          tags.get(a.role).push(a.name);
        });
      }

      if (detail.comic_labels) {
        detail.comic_labels.forEach((l) => {
          if (!tags.has("Labels")) tags.set("Labels", []);
          tags.get("Labels").push(l.name);
        });
      }

      if (detail.tags) {
        detail.tags.forEach((t) => {
          if (!tags.has(t.type)) tags.set(t.type, []);
          tags.get(t.type).push(t.name);
        });
      }

      const chapters = new Map();
      for (const ep of episodes.resources) {
        let canRent = false;
        const plans = (ep.plans || []).filter((plan) =>
      plan.type !== "paid"
        );
        if (Array.isArray(plans) && plans.length > 0) {
      canRent = true;
        }
        const title = canRent ? ep.title : `❌ ${ep.title}`;
        chapters.set(ep.id, title);
      }

      return new ComicDetails({
        title: detail.title,
        subtitle: detail.authors?.map((a) => a.name).join("・") || "",
        cover: detail.thumbnail_1x1 || "",
        description: detail.story?.replace(/<br\s*\/?>/gi, "\n") || "",
        tags,
        chapters,
        updateTime: detail.next_update_at,
        url: detail.share_url,
        maxPage: totalCount,
      });
    },

    loadEp: async (comicId, epId) => {
      let detail = await this.request(
        `${this.api_base}/v1/episodes/${epId}`,
        this.headers,
      );
      const plans = (detail.plans || []).filter((plan) =>
        // plan.type !== "daily_video_free" &&
        plan.type !== "paid"
      );
      if (
        !Array.isArray(plans) ||
        plans.length === 0
      ) {
        throw new Error("No available rental plans after filtering");
      }
      console.log(plans);
      const freePlan = plans.find((plan) => plan.type === "free");
      if (!freePlan) {
        const plan = plans[randomInt(0, plans.length - 1)];
        await this.request(
          `${this.api_base}/v1/users/me/rental_episodes`,
          this.headers,
          "POST",
          { episode_id: epId, reading_method: plan.type },
        );
      }
      let res = await this.request(
        `${this.api_base}/v1/screens/comics/${comicId}/episodes/${epId}/viewer`,
        this.headers,
      );
      const manuscripts = res.resources.manuscripts || [];
      return {
        images: manuscripts.map((m) =>
          `${m.drm_image_url}&drm_hash=${m.drm_hash}`
        ),
      };
    },

    onImageLoad: (url) => {
      let drm_hash = null;
      let cleanUrl = url;
      const drmHashMatch = url.match(/[?&]drm_hash=([^&]+)/);
      if (drmHashMatch) {
        drm_hash = decodeURIComponent(drmHashMatch[1]);
        cleanUrl = url.replace(/([?&])drm_hash=[^&]+(&)?/, (match, p1, p2) => {
          if (p2) return p1;
          return "";
        }).replace(/[?&]$/, "");
      }
      cleanUrl = cleanUrl.replace(/([?&])weight=[^&]+(&)?/, (match, p1, p2) => {
        if (p2) return p1;
        return "";
      }).replace(/[?&]$/, "");

      cleanUrl = cleanUrl.replace(/([?&])height=[^&]+(&)?/, (match, p1, p2) => {
        if (p2) return p1;
        return "";
      }).replace(/[?&]$/, "");

      if (drm_hash.length < 2) {
        throw new Error(
          "drm_hash must be at least 2 characters long",
        );
      }
      var version = drm_hash.slice(0, 2);
      if (version !== "01") {
        throw new Error("Unsupported version: " + version);
      }
      var key_part = drm_hash.slice(2);
      if (key_part.length < 16) {
        throw new Error(
          "Key part must be 16 characters long (8 hex numbers)",
        );
      }
      var key = [];
      for (var i = 0; i < 8; i++) {
        key.push(parseInt(key_part.slice(i * 2, i * 2 + 2), 16));
      }

      const keyArray = key;
      const onResponseScript = `
        function onResponse(buffer) {
          var key = [${keyArray.join(',')}];
          var view = new Uint8Array(buffer);
          for (var i = 0; i < view.length; i++) {
        view[i] ^= key[i % key.length];
          }
          return buffer;
        }
        onResponse;
      `;
      return {
        url: cleanUrl,
        headers: this.headers,
        onResponse: async (buffer)  => {
          return await compute(onResponseScript, buffer);
        }
      };
    },

    onClickTag: (namespace, tag) => {
      if (
        namespace === "漫画" || namespace === "原作" ||
        namespace === "キャラクター原案" || namespace === "著者"
      ) {
        return {
          action: "search",
          keyword: tag,
          param: null,
        };
      }
      throw "未支持此类Tag检索";
    },
  };
}
