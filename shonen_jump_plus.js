class ShonenJumpPlus extends ComicSource {
  name = "少年ジャンプ＋";
  key = "shonen_jump_plus";
  version = "1.1.2"; // 升级源版本号
  minAppVersion = "1.2.1";
  url =
    "https://cdn.jsdelivr.net/gh/venera-app/venera-configs@main/shonen_jump_plus.js";

  deviceId = this.generateDeviceId();
  bearerToken = null;
  userAccountId = null;
  tokenExpiry = 0;
  latestVersion = "4.3.0"; // 备用版本（建议定期更新）
  _retryCount = 0; // 重试计数器

  get headers() {
    return {
      Origin: "https://shonenjumpplus.com",
      Referer: "https://shonenjumpplus.com/",
      "X-Giga-Device-Id": this.deviceId,
      "User-Agent": `ShonenJumpPlus-Android/${this.latestVersion}`,
    };
  }

  apiBase = `https://shonenjumpplus.com/api/v1`;

  generateDeviceId() {
    let result = "";
    const chars = "0123456789abcdef";
    for (let i = 0; i < 16; i++) {
      result += chars[Math.floor(Math.random() * chars.length)];
    }
    return result;
  }

  // 初始化：获取最新版本号
  async init() {
    try {
      // 使用 iTunes Lookup API
      const url = "https://itunes.apple.com/jp/lookup?id=875750302";
      const resp = await Network.get(url);
      if (resp.status !== 200) throw new Error(`HTTP ${resp.status}`);
      const data = JSON.parse(resp.body);
      if (data.results && data.results.length > 0) {
        const version = data.results[0].version;
        if (version) {
          this.latestVersion = version;
          console.log(`[ShonenJumpPlus] 获取到最新版本: ${version}`);
          return;
        }
      }
      throw new Error("无法从 iTunes 解析版本号");
    } catch (e) {
      console.warn("[ShonenJumpPlus] 获取版本失败，使用备用版本", e);
      // 备用版本保持不变（已初始化）
    }
  }

  explore = [
    {
      title: "少年ジャンプ＋",
      type: "singlePageWithMultiPart",
      load: async () => {
        await this.ensureAuth();

        const response = await this.graphqlRequest("HomeCacheable", {});

        if (!response || !response.data || !response.data.homeSections) {
          throw "Cannot fetch home sections";
        }

        const sections = response.data.homeSections;
        const dailyRankingSection = sections.find(
          (section) => section.__typename === "DailyRankingSection",
        );

        if (!dailyRankingSection || !dailyRankingSection.dailyRankings) {
          throw "Cannot fetch daily ranking data";
        }

        const dailyRanking = dailyRankingSection.dailyRankings.find(
          (ranking) =>
            ranking.ranking && ranking.ranking.__typename === "DailyRanking",
        );

        if (
          !dailyRanking ||
          !dailyRanking.ranking ||
          !dailyRanking.ranking.items ||
          !dailyRanking.ranking.items.edges
        ) {
          throw "Cannot fetch ranking data structure";
        }

        const rankingItems = dailyRanking.ranking.items.edges
          .map((edge) => edge.node)
          .filter(
            (node) =>
              node.__typename === "DailyRankingValidItem" && node.product,
          );

        function parseComic(item) {
          const series = item.product.series;
          if (!series) return null;

          const cover =
            series.squareThumbnailUriTemplate ||
            series.horizontalThumbnailUriTemplate;

          return {
            id: series.databaseId,
            title: series.title || "",
            cover: cover
              ? cover.replace("{height}", "500").replace("{width}", "500")
              : "",
            tags: [],
            description: `Ranking: ${item.rank} · Views: ${
              item.viewCount || "Unknown"
            }`,
          };
        }

        const comics = rankingItems
          .map(parseComic)
          .filter((comic) => comic !== null);

        const result = {};
        result["Daily Ranking"] = comics;
        return result;
      },
    },
  ];

  search = {
    load: async (keyword, _, page) => {
      if (!this.bearerToken || Date.now() > this.tokenExpiry) {
        await this.fetchBearerToken();
      }

      const operationName = "SearchResult";

      const response = await this.graphqlRequest(operationName, {
        keyword,
      });
      const edges = response?.data?.search?.edges || [];
      const pageInfo = response?.data?.search?.pageInfo || {};

      const comics = edges
        .map(({ node }) => {
          const authors = (node.author?.name || "")
            .split(/\s*\/\s*/)
            .filter(Boolean);
          const cover =
            node.latestIssue?.thumbnailUriTemplate || node.thumbnailUriTemplate;
          if (node.__typename === "Series") {
            return new Comic({
              id: node.databaseId,
              title: node.title || "",
              cover: this.replaceCoverUrl(cover),
              description: node.description || "",
              tags: authors,
            });
          }
          if (node.__typename === "MagazineLabel") {
            return new Comic({
              id: node.databaseId,
              title: node.title || "",
              cover: this.replaceCoverUrl(cover),
            });
          }
          return null;
        })
        .filter(Boolean);

      return {
        comics,
        maxPage: pageInfo.hasNextPage ? (page || 1) + 1 : page || 1,
        endCursor: pageInfo.endCursor,
      };
    },
  };

  comic = {
    loadInfo: async (id) => {
      await this.ensureAuth();
      const seriesData = await this.fetchSeriesDetail(id);
      const episodes = await this.fetchEpisodes(id);

      const { chapters, latestPublishAt } = episodes.reduce(
        (acc, ep) => ({
          chapters: {
            ...acc.chapters,
            [ep.databaseId]: ep.title || "",
          },
          latestPublishAt:
            ep.publishedAt && ep.publishedAt > acc.latestPublishAt
              ? ep.publishedAt
              : acc.latestPublishAt,
        }),
        { chapters: {}, latestPublishAt: "" },
      );

      const maxDate =
        latestPublishAt > seriesData.openAt
          ? latestPublishAt
          : seriesData.openAt;
      const updateDate = new Date(new Date(maxDate) - 60 * 60 * 1000);
      const authors = (seriesData.author?.name || "")
        .split(/\s*\/\s*/)
        .filter(Boolean);

      return new ComicDetails({
        title: seriesData.title || "",
        subtitle: authors.join(" / "),
        cover: this.replaceCoverUrl(seriesData.thumbnailUriTemplate),
        description: seriesData.description || "",
        tags: {
          Author: authors,
          Update: [updateDate.toISOString().slice(0, 10)],
        },
        url: `https://shonenjumpplus.com/app/episode/${seriesData.publisherId}`,
        chapters,
      });
    },

    loadEp: async (comicId, epId) => {
      await this.ensureAuth();
      const episodeId = this.normalizeEpisodeId(epId);
      const episodeData = await this.fetchEpisodePages(episodeId);

      if (!this.isEpisodeAccessible(episodeData)) {
        await this.handleEpisodePurchase(episodeData);
        return this.comic.loadEp(comicId, epId);
      }

      return this.buildImageUrls(episodeData);
    },

    onImageLoad: (url) => {
      const [cleanUrl, token] = url.split("?token=");
      return {
        url: cleanUrl,
        headers: { "X-Giga-Page-Image-Auth": token },
      };
    },

    onClickTag: (namespace, tag) => {
      if (namespace === "Author") {
        return {
          action: "search",
          keyword: `${tag}`,
          param: null,
        };
      }
      throw "Unsupported tag namespace: " + namespace;
    },
  };

  // ---------- 辅助方法 ----------
  async ensureAuth() {
    if (!this.bearerToken || Date.now() > this.tokenExpiry) {
      await this.fetchBearerToken();
    }
  }

  // 封装 graphql 请求，自动处理 410 并重试
  async graphqlRequest(operationName, variables, retry = true) {
    try {
      const payload = {
        operationName,
        variables,
        query: GraphQLQueries[operationName],
      };
      const response = await Network.post(
        `${this.apiBase}/graphql?opname=${operationName}`,
        {
          ...this.headers,
          Authorization: `Bearer ${this.bearerToken}`,
          Accept: "application/json",
          "X-APOLLO-OPERATION-NAME": operationName,
          "Content-Type": "application/json",
        },
        JSON.stringify(payload),
      );

      if (response.status === 410) {
        if (retry && this._retryCount < 3) {
          this._retryCount++;
          console.warn("[ShonenJumpPlus] 收到 410，尝试更新版本并重试");
          await this.init(); // 重新获取版本
          // 重新获取 token（因为可能失效）
          await this.fetchBearerToken();
          // 重试请求（不再次重试，防止死循环）
          return this.graphqlRequest(operationName, variables, false);
        } else {
          throw new Error(`GraphQL 请求失败，状态码 410，版本可能需要手动更新`);
        }
      }

      if (response.status !== 200) throw `Invalid status: ${response.status}`;
      return JSON.parse(response.body);
    } catch (e) {
      console.error("[ShonenJumpPlus] graphqlRequest 异常:", e);
      throw e;
    }
  }

  normalizeEpisodeId(epId) {
    if (typeof epId === "object") return epId.id;
    if (typeof epId === "string" && epId.includes("/")) {
      return epId.split("/").pop();
    }
    return epId;
  }

  replaceCoverUrl(url) {
    return (
      (url || "").replace("{height}", "1500").replace("{width}", "1500") || ""
    );
  }

  // 获取 bearer token，处理 410
  async fetchBearerToken(retry = true) {
    try {
      const response = await Network.post(
        `${this.apiBase}/user_account/access_token`,
        this.headers,
        "",
      );

      if (response.status === 410) {
        if (retry && this._retryCount < 3) {
          this._retryCount++;
          console.warn("[ShonenJumpPlus] token 请求收到 410，尝试更新版本并重试");
          await this.init();
          // 重新请求（不再重试）
          return this.fetchBearerToken(false);
        } else {
          throw new Error("获取 access_token 失败，状态码 410，版本过旧");
        }
      }

      if (response.status !== 200) {
        throw new Error(`获取 access_token 失败，状态码 ${response.status}`);
      }

      const { access_token, user_account_id } = JSON.parse(response.body);
      this.bearerToken = access_token;
      this.userAccountId = user_account_id;
      this.tokenExpiry = Date.now() + 3600000;
      this._retryCount = 0; // 重置重试计数
    } catch (e) {
      console.error("[ShonenJumpPlus] fetchBearerToken 异常:", e);
      throw e;
    }
  }

  async fetchSeriesDetail(id) {
    const response = await this.graphqlRequest("SeriesDetail", { id });
    return response?.data?.series || {};
  }

  async fetchEpisodes(id) {
    const response = await this.graphqlRequest("SeriesDetailEpisodeList", {
      id,
      episodeOffset: 0,
      episodeFirst: 1500,
      episodeSort: "NUMBER_ASC",
    });
    const episodes = (response?.data?.series?.episodes?.edges || []).map(
      (edge) => edge.node,
    );
    return episodes;
  }

  async fetchEpisodePages(episodeId) {
    const response = await this.graphqlRequest(
      "EpisodeViewerConditionallyCacheable",
      { episodeID: episodeId },
    );
    return response?.data?.episode || {};
  }

  isEpisodeAccessible({ purchaseInfo }) {
    return (
      purchaseInfo?.isFree ||
      purchaseInfo?.hasPurchased ||
      purchaseInfo?.hasRented
    );
  }

  async handleEpisodePurchase(episodeData) {
    const { id, purchaseInfo } = episodeData;
    const { purchasableViaOnetimeFree, rentable, unitPrice } =
      purchaseInfo || {};

    if (purchasableViaOnetimeFree) await this.consumeOnetimeFree(id);
    if (rentable) await this.rentChapter(id, unitPrice);
  }

  buildImageUrls({ pageImages, pageImageToken }) {
    const validImages = pageImages.edges
      .flatMap((edge) => edge.node?.src)
      .filter(Boolean);
    return {
      images: validImages.map((url) => `${url}?token=${pageImageToken}`),
    };
  }

  async consumeOnetimeFree(episodeId) {
    const response = await this.graphqlRequest("ConsumeOnetimeFree", {
      input: { id: episodeId },
    });
    return response?.data?.consumeOnetimeFree?.isSuccess;
  }

  async rentChapter(episodeId, unitPrice, retryCount = 0) {
    if (retryCount > 3) {
      throw "Failed to rent chapter after multiple attempts.";
    }
    const response = await this.graphqlRequest("Rent", {
      input: { id: episodeId, unitPrice },
    });

    if (response.errors?.[0]?.extensions?.code === "FAILED_TO_USE_POINT") {
      await this.refreshAccount();
      return this.rentChapter(episodeId, unitPrice, retryCount + 1);
    }

    this.userAccountId = response?.data?.rent?.userAccount?.databaseId;
    return true;
  }

  async refreshAccount() {
    this.deviceId = this.generateDeviceId();
    this.bearerToken = this.userAccountId = null;
    this.tokenExpiry = 0;
    await this.fetchBearerToken();
    await this.addUserDevice();
  }

  async addUserDevice() {
    await this.graphqlRequest("AddUserDevice", {
      input: {
        deviceName: `Android ${21 + Math.floor(Math.random() * 14)}`,
        modelName: `Device-${Math.random().toString(36).slice(2, 10)}`,
        osName: `Android ${9 + Math.floor(Math.random() * 6)}`,
      },
    });
    this.addUserDeviceCalled = true;
  }
}

// GraphQL 查询（保持不变）
const GraphQLQueries = {
  SearchResult: `query SearchResult($after: String, $keyword: String!) {
        search(after: $after, first: 50, keyword: $keyword, types: [SERIES,MAGAZINE_LABEL]) {
            pageInfo { hasNextPage endCursor }
            edges {
                node {
                    __typename
                    ... on Series { id databaseId title thumbnailUriTemplate author { name } description }
                    ... on MagazineLabel { id databaseId title thumbnailUriTemplate latestIssue { thumbnailUriTemplate } }
                }
            }
        }
    }`,
  SeriesDetail: `query SeriesDetail($id: String!) {
        series(databaseId: $id) {
            id databaseId title thumbnailUriTemplate
            author { name }
            description
            hashtags serialUpdateScheduleLabel
            openAt
            publisherId
        }
    }`,
  SeriesDetailEpisodeList: `query SeriesDetailEpisodeList($id: String!, $episodeOffset: Int, $episodeFirst: Int, $episodeSort: ReadableProductSorting) {
        series(databaseId: $id) {
            episodes: readableProducts(types: [EPISODE], first: $episodeFirst, offset: $episodeOffset, sort: $episodeSort) {
                edges { node { databaseId title publishedAt } }
            }
        }
    }`,
  EpisodeViewerConditionallyCacheable: `query EpisodeViewerConditionallyCacheable($episodeID: String!) {
        episode(databaseId: $episodeID) {
            id pageImages { edges { node { src } } } pageImageToken
            purchaseInfo {
                isFree hasPurchased hasRented
                purchasableViaOnetimeFree rentable unitPrice
            }
        }
    }`,
  ConsumeOnetimeFree: `mutation ConsumeOnetimeFree($input: ConsumeOnetimeFreeInput!) {
        consumeOnetimeFree(input: $input) { isSuccess }
    }`,
  Rent: `mutation Rent($input: RentInput!) {
        rent(input: $input) {
            userAccount { databaseId }
        }
    }`,
  AddUserDevice: `mutation AddUserDevice($input: AddUserDeviceInput!) {
        addUserDevice(input: $input) { isSuccess }
    }`,
  HomeCacheable: `query HomeCacheable {
    homeSections {
      __typename
      ...DailyRankingSection
    }
  }
  fragment DesignSectionImage on DesignSectionImage {
    imageUrl width height
  }
  fragment SerialInfoIcon on SerialInfo {
    isOriginal isIndies
  }
  fragment DailyRankingSeries on Series {
    id databaseId publisherId title
    horizontalThumbnailUriTemplate: subThumbnailUri(type: HORIZONTAL_WITH_LOGO)
    squareThumbnailUriTemplate: subThumbnailUri(type: SQUARE_WITHOUT_LOGO)
    isNewOngoing supportsOnetimeFree
    serialInfo {
      __typename ...SerialInfoIcon
      status isTrial
    }
    jamEpisodeWorkType
  }
  fragment DailyRankingItem on DailyRankingItem {
    __typename
    ... on DailyRankingValidItem {
      product {
        __typename
        ... on Episode {
          id databaseId publisherId commentCount
          series {
            __typename ...DailyRankingSeries
          }
        }
        ... on SpecialContent {
          publisherId linkUrl
          series {
            __typename ...DailyRankingSeries
          }
        }
      }
      badge { name label }
      label rank viewCount
    }
    ... on DailyRankingInvalidItem {
      publisherWorkId
    }
  }
  fragment DailyRanking on DailyRanking {
    date firstPositionSeriesId
    items {
      edges {
        node {
          __typename ...DailyRankingItem
        }
      }
    }
  }
  fragment DailyRankingSection on DailyRankingSection {
    title
    titleImage {
      __typename ...DesignSectionImage
    }
    dailyRankings {
      ranking {
        __typename ...DailyRanking
      }
    }
  }`,
};
