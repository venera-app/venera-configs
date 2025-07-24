class ShonenJumpPlus extends ComicSource {
  name = "少年ジャンプ＋";
  key = "shonen_jump_plus";
  version = "1.0.1";
  minAppVersion = "1.2.1";
  url =
    "https://git.nyne.dev/nyne/venera-configs/raw/branch/main/shonen_jump_plus.js";

  deviceId = this.generateDeviceId();
  bearerToken = null;
  userAccountId = null;
  tokenExpiry = 0;

  get headers() {
    return {
      "Origin": "https://shonenjumpplus.com",
      "Referer": "https://shonenjumpplus.com/",
      "X-Giga-Device-Id": this.deviceId,
      "User-Agent": "ShonenJumpPlus-Android/4.0.19",
    };
  }

  apiBase = `https://shonenjumpplus.com/api/v1`;
  generateDeviceId() {
    let result = "";
    const chars = "0123456789abcdef";
    for (let i = 0; i < 16; i++) {
      result += chars[randomInt(0, chars.length - 1)];
    }
    return result;
  }

  init() { }

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
        const dailyRankingSection = sections.find((section) =>
          section.__typename === "DailyRankingSection"
        );

        if (!dailyRankingSection || !dailyRankingSection.dailyRankings) {
          throw "Cannot fetch daily ranking data";
        }

        const dailyRanking = dailyRankingSection.dailyRankings.find((ranking) =>
          ranking.ranking && ranking.ranking.__typename === "DailyRanking"
        );

        if (
          !dailyRanking || !dailyRanking.ranking ||
          !dailyRanking.ranking.items || !dailyRanking.ranking.items.edges
        ) {
          throw "Cannot fetch ranking data structure";
        }

        const rankingItems = dailyRanking.ranking.items.edges.map((edge) =>
          edge.node
        ).filter((node) =>
          node.__typename === "DailyRankingValidItem" && node.product
        );

        function parseComic(item) {
          const series = item.product.series;
          if (!series) return null;

          const cover = series.squareThumbnailUriTemplate ||
            series.horizontalThumbnailUriTemplate;

          return {
            id: series.databaseId,
            title: series.title || "",
            cover: cover
              ? cover.replace("{height}", "500").replace("{width}", "500")
              : "",
            tags: [],
            description: `Ranking: ${item.rank} · Views: ${item.viewCount || "Unknown"
              }`,
          };
        }

        const comics = rankingItems.map(parseComic).filter((comic) =>
          comic !== null
        );

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

      const comics = edges.map(({ node }) => {
        const cover = node.latestIssue?.thumbnailUriTemplate ||
          node.thumbnailUriTemplate;
        if (node.__typename === "Series") {
          return new Comic({
            id: node.databaseId,
            title: node.title || "",
            cover: this.replaceCoverUrl(cover),
            extra: {
              author: node.author?.name || "",
            },
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
      }).filter(Boolean);

      return {
        comics,
        maxPage: pageInfo.hasNextPage ? (page || 1) + 1 : (page || 1),
        endCursor: pageInfo.endCursor,
      };
    },
  };

  comic = {
    loadInfo: async (id) => {
      await this.ensureAuth();
      const seriesData = await this.fetchSeriesDetail(id);
      const chapters = await this.fetchEpisodes(id);

      return new ComicDetails({
        title: seriesData.title || "",
        subtitle: seriesData.author?.name || "",
        cover: this.replaceCoverUrl(seriesData.thumbnailUriTemplate),
        description: seriesData.descriptionBanner?.text || "",
        tags: {
          "Author": [seriesData.author?.name || ""],
        },
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

  async ensureAuth() {
    if (!this.bearerToken || Date.now() > this.tokenExpiry) {
      await this.fetchBearerToken();
    }
  }

  async graphqlRequest(operationName, variables) {
    const payload = {
      operationName,
      variables,
      query: GraphQLQueries[operationName],
    };
    const response = await Network.post(
      `${this.apiBase}/graphql?opname=${operationName}`,
      {
        ...this.headers,
        "Authorization": `Bearer ${this.bearerToken}`,
        "Accept": "application/json",
        "X-APOLLO-OPERATION-NAME": operationName,
        "Content-Type": "application/json",
      },
      JSON.stringify(payload),
    );

    if (response.status !== 200) throw `Invalid status: ${response.status}`;
    return JSON.parse(response.body);
  }

  normalizeEpisodeId(epId) {
    if (typeof epId === "object") return epId.id;
    if (typeof epId === "string" && epId.includes("/")) {
      return epId.split("/").pop();
    }
    return epId;
  }

  replaceCoverUrl(url) {
    return (url || "").replace("{height}", "1500").replace(
      "{width}",
      "1500",
    ) || "";
  }

  async fetchBearerToken() {
    const response = await Network.post(
      `${this.apiBase}/user_account/access_token`,
      this.headers,
      "",
    );
    const { access_token, user_account_id } = JSON.parse(
      response.body,
    );
    this.bearerToken = access_token;
    this.userAccountId = user_account_id;
    this.tokenExpiry = Date.now() + 3600000;
  }

  async fetchSeriesDetail(id) {
    const response = await this.graphqlRequest("SeriesDetail", { id });
    return response?.data?.series || {};
  }

  async fetchEpisodes(id) {
    const response = await this.graphqlRequest(
      "SeriesDetailEpisodeList",
      { id, episodeOffset: 0, episodeFirst: 1500, episodeSort: "NUMBER_ASC" },
    );
    const episodes = response?.data?.series?.episodes?.edges || [];
    return episodes.reduce((chapters, { node }) => ({
      ...chapters,
      [node.databaseId]: node.title || "",
    }), {});
  }

  async fetchEpisodePages(episodeId) {
    const response = await this.graphqlRequest(
      "EpisodeViewerConditionallyCacheable",
      { episodeID: episodeId },
    );
    return response?.data?.episode || {};
  }

  isEpisodeAccessible({ purchaseInfo }) {
    return purchaseInfo?.isFree || purchaseInfo?.hasPurchased ||
      purchaseInfo?.hasRented;
  }

  async handleEpisodePurchase(episodeData) {
    const { id, purchaseInfo } = episodeData;
    const { purchasableViaOnetimeFree, rentable, unitPrice } = purchaseInfo ||
      {};

    if (purchasableViaOnetimeFree) await this.consumeOnetimeFree(id);
    if (rentable) await this.rentChapter(id, unitPrice);
  }

  buildImageUrls({ pageImages, pageImageToken }) {
    const validImages = pageImages.edges.flatMap((edge) => edge.node?.src)
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

const GraphQLQueries = {
  "SearchResult": `query SearchResult($after: String, $keyword: String!) {
        search(after: $after, first: 50, keyword: $keyword, types: [SERIES,MAGAZINE_LABEL]) {
            pageInfo { hasNextPage endCursor }
            edges {
                node {
                    __typename
                    ... on Series { id databaseId title thumbnailUriTemplate author { name } }
                    ... on MagazineLabel { id databaseId title thumbnailUriTemplate latestIssue { thumbnailUriTemplate } }
                }
            }
        }
    }`,
  "SeriesDetail": `query SeriesDetail($id: String!) {
        series(databaseId: $id) {
            id databaseId title thumbnailUriTemplate
            author { name } descriptionBanner { text }
            hashtags serialUpdateScheduleLabel
        }
    }`,
  "SeriesDetailEpisodeList":
    `query SeriesDetailEpisodeList($id: String!, $episodeOffset: Int, $episodeFirst: Int, $episodeSort: ReadableProductSorting) {
        series(databaseId: $id) {
            episodes: readableProducts(types: [EPISODE,SPECIAL_CONTENT], first: $episodeFirst, offset: $episodeOffset, sort: $episodeSort) {
                edges { node { databaseId title } }
            }
        }
    }`,
  "EpisodeViewerConditionallyCacheable":
    `query EpisodeViewerConditionallyCacheable($episodeID: String!) {
        episode(databaseId: $episodeID) {
            id pageImages { edges { node { src } } } pageImageToken
            purchaseInfo {
                isFree hasPurchased hasRented
                purchasableViaOnetimeFree rentable unitPrice
            }
        }
    }`,
  "ConsumeOnetimeFree":
    `mutation ConsumeOnetimeFree($input: ConsumeOnetimeFreeInput!) {
        consumeOnetimeFree(input: $input) { isSuccess }
    }`,
  "Rent": `mutation Rent($input: RentInput!) {
        rent(input: $input) {
            userAccount { databaseId }
        }
    }`,
  "AddUserDevice": `mutation AddUserDevice($input: AddUserDeviceInput!) {
        addUserDevice(input: $input) { isSuccess }
    }`,
  "HomeCacheable": `query HomeCacheable {
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
