class Zaimanhua extends ComicSource {
  // 基础信息
  name = "再漫画";
  key = "zaimanhuachange";
  version = "1.0.4";
  minAppVersion = "1.0.0";
  url =
    "https://cdn.jsdelivr.net/gh/venera-app/venera-configs@main/zaimanhua.js";

  // 初始化请求头
  init() {
    this.headers = {
      "User-Agent": "Mozilla/5.0 (Linux; Android 10; K; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/130.0.0.0 Mobile Safari/537.36",
      "authorization": `Bearer ${this.loadData("token") || ""}`,
    };
  }
  // 构建 URL
  buildUrl(path) {
    this.signTask();
    return `https://v4api.zaimanhua.com/app/v1/${path}`;
  }
  // 每日签到
  async signTask() {
    if (!this.isLogged) {
      return;
    }
    if (!this.loadSetting("signTask")) {
      return;
    }
    const lastSign = this.loadData("lastSign");
    const newTime = new Date().toISOString().split("T")[0];
    if (lastSign == newTime) {
      return;
    }
    const res = await Network.post("https://i.zaimanhua.com/lpi/v1/task/sign_in", this.headers);
    if (res.status !== 200) {
      return;
    }
    this.saveData("lastSign", newTime);
    if (JSON.parse(res.body)["errno"] == 0) {
      UI.showMessage("签到成功");
    }
  }

  //账户管理
  account = {
    login: async (username, password) => {
      try {
        const encryptedPwd = Convert.hexEncode(
          Convert.md5(Convert.encodeUtf8(password))
        );
        const res = await Network.post(
          "https://account-api.zaimanhua.com/v1/login/passwd",
          { "Content-Type": "application/x-www-form-urlencoded;charset=utf-8" },
          `username=${username}&passwd=${encryptedPwd}`
        );

        const data = JSON.parse(res.body);
        if (data.errno !== 0) throw new Error(data.errmsg);

        this.saveData("token", data.data.user.token);
        this.headers.authorization = `Bearer ${data.data.user.token}`;
        return true;
      } catch (e) {
        UI.showMessage(`登录失败: ${e.message}`);
        throw e;
      }
    },
    logout: () => {
      this.deleteData("token");
    },
  };

  // 状态检查
  checkResponseStatus(res) {
    if (res.status === 401) {
      throw new Error("登录失效");
    }
    if (res.status !== 200) {
      throw new Error(`请求失败: ${res.status}`);
    }
  }

  // 漫画解析
  parseComic(comic) {
    // const safeString = (value) => (value || "").toString().trim();
    const safeString = (value) => (value != null ? value.toString() : "");
    const resolveId = () =>
      [comic.comic_id, comic.id].find((id) => id && id !== "0") || "";
    const resolveTags = () =>
      [comic.status, ...safeString(comic.types).split("/")].filter(Boolean);
    const resolveDescription = () => {
      const candidates = [
        comic.description,
        comic.last_update_chapter_name,
        comic.last_name,
      ];
      return candidates.find((text) => text) || "";
    };

    return {
      id: safeString(resolveId()),
      title: comic.title || comic.name,
      subTitle: comic.authors,
      cover: comic.cover,
      tags: resolveTags(),
      description: resolveDescription(),
    };
  }

  //探索页面
  explore = [
    {
      title: "再漫画 更新",
      type: "multiPageComicList",
      load: async (page) => {
        const res = await Network.get(
          this.buildUrl(`comic/update/list/0/${page}`),
          this.headers
        );
        const data = JSON.parse(res.body).data;
        return {
          comics: data.map((item) => this.parseComic(item)),
        };
      },
    },
  ];

  static categoryParamMap = {
    "全部": "0",
    "冒险": "4",
    "欢乐向": "5",
    "格斗": "6",
    "科幻": "7",
    "爱情": "8",
    "侦探": "9",
    "竞技": "10",
    "魔法": "11",
    "神鬼": "12",
    "校园": "13",
    "惊悚": "14",
    "其他": "16",
    "四格": "17",
    "亲情": "3242",
    "百合": "3243",
    "秀吉": "3244",
    "悬疑": "3245",
    "纯爱": "3246",
    "热血": "3248",
    "泛爱": "3249",
    "历史": "3250",
    "战争": "3251",
    "萌系": "3252",
    "宅系": "3253",
    "治愈": "3254",
    "励志": "3255",
    "武侠": "3324",
    "机战": "3325",
    "音乐舞蹈": "3326",
    "美食": "3327",
    "职场": "3328",
    "西方魔幻": "3365",
    "高清单行": "4459",
    "TS": "4518",
    "东方": "5077",
    "魔幻": "5806",
    "奇幻": "5848",
    "节操": "6219",
    "轻小说": "6316",
    "颜艺": "6437",
    "搞笑": "7568",
    "仙侠": "23388",
    "舰娘": "7900",
    "动画": "13627",
    "AA": "17192",
    "福瑞": "18522",
    "生存": "23323",
    "日常": "23388",
    "画集": "30788",
    "C100": "31137",
  };

  //分类页面
  category = {
    title: "再漫画",
    parts: [
      {
        name: "排行榜",
        type: "fixed",
        categories: ["日排行", "周排行", "月排行", "总排行"],
        itemType: "category",
        categoryParams: ["0", "1", "2", "3"],
      },
      {
        name: "分类",
        type: "fixed",
        categories: Object.keys(Zaimanhua.categoryParamMap),
        categoryParams: Object.values(Zaimanhua.categoryParamMap),
        itemType: "category",
      },
    ],
  };

  //分类漫画加载
  categoryComics = {
    load: async (category, param, options, page) => {
      if (category.includes("排行")) {
        let res = await Network.get(
          this.buildUrl(
            `comic/rank/list?page=${page}&rank_type=${options}&by_time=${param}`
          ),
          this.headers
        );
        return {
          comics: JSON.parse(res.body).data.map((item) =>
            this.parseComic(item)
          ),
          maxPage: 10,
        };
      } else {
        param = Zaimanhua.categoryParamMap[category] || "0";
        let res = await Network.get(
          this.buildUrl(
            `comic/filter/list?status=${options[2]}&theme=${param}&zone=${options[3]}&cate=${options[1]}&sortType=${options[0]}&page=${page}&size=20`
          ),
          this.headers
        );
        const data = JSON.parse(res.body).data;
        return {
          comics: data.comicList.map((item) => this.parseComic(item)),
          maxPage: Math.ceil(data.totalNum / 20),
        };
      }
    },
    optionList: [
      {
        options: ["1-更新", "2-人气"],
        notShowWhen: null,
        showWhen: Object.keys(Zaimanhua.categoryParamMap),
      },
      {
        options: [
          "0-全部",
          "3262-少年漫画",
          "3263-少女漫画",
          "3264-青年漫画",
          "13626-女青漫画",
        ],
        notShowWhen: null,
        showWhen: Object.keys(Zaimanhua.categoryParamMap),
      },
      {
        options: ["0-全部", "2309-连载中", "2310-已完结", "29205-短篇"],
        notShowWhen: null,
        showWhen: Object.keys(Zaimanhua.categoryParamMap),
      },
      {
        options: [
          "0-全部",
          "2304-日本",
          "2305-韩国",
          "2306-欧美",
          "2307-港台",
          "2308-内地",
          "8435-其他",
        ],
        notShowWhen: null,
        showWhen: Object.keys(Zaimanhua.categoryParamMap),
      },
      {
        options: ["0-人气", "1-吐槽", "2-订阅"],
        notshowWhen: null,
        showWhen: ["日排行", "周排行", "月排行", "总排行"],
      },
    ],
  };

  //搜索
  search = {
    load: async (keyword, options, page) => {
      // 检测是否是纯数字 ID
      const trimmed = keyword.trim();
      if (/^\d+$/.test(trimmed)) {
        try {
          const id = trimmed;
          const res = await Network.get(
            this.buildUrl(`comic/detail/${id}?channel=android`),
            this.headers
          );
          this.checkResponseStatus(res);
          const response = JSON.parse(res.body);
          if (response.errno !== 0) throw new Error(response.errmsg || "加载失败");
          const data = response.data.data;

          // 构造与搜索列表项结构一致的对象
          const comicItem = {
            id: id,
            title: data.title,
            cover: data.cover,
            // 作者转为逗号分隔的字符串
            authors: (data.authors || []).map(a => a.tag_name).join(','),
            // 状态和标签转为斜杠分隔的字符串，以便 parseComic 正确拆分
            status: (data.status || []).map(s => s.tag_name).join('/'),
            types: (data.types || []).map(t => t.tag_name).join('/'),
            description: data.description,
          };
          const parsed = this.parseComic(comicItem);
          return { comics: [parsed] };
        } catch (e) {
          UI.showMessage(`查找失败: ${e.message}`);
          return { comics: [] };
        }
      }

      // 原有的关键词搜索逻辑
      const res = await Network.get(
        this.buildUrl(
          `search/index?keyword=${encodeURIComponent(
            keyword
          )}&page=${page}&sort=0&size=20`
        ),
        this.headers
      );
      const data = JSON.parse(res.body).data.list;
      return {
        comics: data.map((item) => this.parseComic(item)),
      };
    },
    optionList: [],
  };

  //收藏
  favorites = {
    multiFolder: false,
    addOrDelFavorite: async (comicId, folderId, isAdding) => {
      const path = isAdding ? "add" : "del";
      const res = await Network.get(
        this.buildUrl(`comic/sub/${path}?comic_id=${comicId}`),
        this.headers
      );
      const data = JSON.parse(res.body);
      if (data.errno !== 0) {
        throw new Error(data.errmsg || "操作失败");
      }
      return "ok";
    },
    loadComics: async (page) => {
      try {
        const res = await Network.get(
          this.buildUrl(`comic/sub/list?status=0&page=${page}&size=20`),
          this.headers
        );
        const data = JSON.parse(res.body).data;
        return {
          comics: data.subList.map((item) => this.parseComic(item)) ?? [],
          maxPage: Math.ceil(data.total / 20),
        };
      } catch (e) {
        console.error("加载收藏失败:", e);
        return { comics: [], maxPage: null };
      }
    },
  };

  // 时间戳转换
  formatTimestamp(ts) {
    const date = new Date(ts * 1000);
    return date.toISOString().split("T")[0];
  }

  comic = {
    loadInfo: async (id) => {
      const getFavoriteStatus = async (id) => {
        let res = await Network.get(
          this.buildUrl(`comic/sub/checkIsSub?objId=${id}&source=1`),
          this.headers
        );
        this.checkResponseStatus(res);
        return JSON.parse(res.body).data.isSub;
      };
      let results = await Promise.all([
        Network.get(
          this.buildUrl(`comic/detail/${id}?channel=android`),
          this.headers
        ),
        getFavoriteStatus.bind(this)(id),
      ]);
      const response = JSON.parse(results[0].body);
      if (response.errno !== 0) throw new Error(response.errmsg || "加载失败");
      const data = response.data.data;

      function processChapters(groups) {
        return (groups || []).reduce((result, group) => {
          const groupTitle = group.title || "默认";
          const chapters = (group.data || [])
            .reverse()
            .map((ch) => [
              String(ch.chapter_id),
              `${ch.chapter_title.replace(
                /^(?:连载版?)?(\d+\.?\d*)([话卷])?$/,
                (_, n, t) => `第${n}${t || "话"}`
              )}`,
            ]);
          result.set(groupTitle, new Map(chapters));
          return result;
        }, new Map());
      }
      const { authors, status, types } = data;
      const tagMapper = (arr) => arr.map((t) => t.tag_name);
      return {
        title: data.title,
        cover: data.cover,
        description: data.description,
        tags: {
          "作者": tagMapper(authors),
          "状态": [...tagMapper(status), data.last_update_chapter_name],
          "标签": tagMapper(types),
        },
        updateTime: this.formatTimestamp(data.last_updatetime),
        chapters: processChapters(data.chapters),
        isFavorite: results[1],
        subId: id,
      };
    },

    loadEp: async (comicId, epId) => {
      const res = await Network.get(
        this.buildUrl(`comic/chapter/${comicId}/${epId}`),
        this.headers
      );
      const data = JSON.parse(res.body).data.data;
      return { images: data.page_url_hd || data.page_url };
    },

    // ========== 章节评论（用户名格式：用户+ID） ==========
    loadChapterComments: async (comicId, epId, page, replyTo) => {
      try {
        const url = this.buildUrl(
          `viewpoint/list?comicId=${comicId}&chapterId=${epId}`
        );
        const res = await Network.get(url, this.headers);
        this.checkResponseStatus(res);

        const response = JSON.parse(res.body);
        const data = response.data;

        if (!data || !data.list || data.list.length === 0) {
          return { comments: [], maxPage: 0 };
        }
        const comments = data.list.map((item, index) => {
          // 根据日志结构：倒数第二个元素为用户ID，最后一个为内容
          const userId = item.length >= 2 ? String(item[item.length - 2]) : "";
          const content = item[item.length - 1] || "";
          // 生成伪唯一评论ID（章节ID + 用户ID + 索引）
          const commentId = `${epId}_${userId}_${index}`;
          return new Comment({
            userName: userId ? `用户${userId}` : "匿名用户",   // 恢复“用户”前缀
            avatar: "",                                       // 接口不提供头像
            content: content,
            time: "",                                         // 接口无时间
            replyCount: 0,
            score: 0,
            id: commentId,                                    // 唯一ID，防止刷新混乱
            parentId: null,
          });
        });
        // 该接口一次返回所有评论，不支持分页，设置 maxPage=1 防止循环请求
        return { comments: comments, maxPage: 1 };
      } catch (e) {
        console.error("章节评论加载失败:", e);
        return { comments: [], maxPage: 0 };
      }
    },

    // ========== 发送章节评论 ==========
    sendChapterComment: async (comicId, epId, content, replyTo) => {
      const res = await Network.post(
        this.buildUrl(`viewpoint/add`),
        {
          ...this.headers,
          "Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
        },
        `comicId=${comicId}&chapterId=${epId}&content=${encodeURIComponent(content)}`
      );
      this.checkResponseStatus(res);
      const response = JSON.parse(res.body);
      if (response.errno !== 0) throw new Error(response.errmsg || "发送失败");
      return "ok";
    },

    // ========== 原有：作品评论 ==========
    loadComments: async (comicId, subId, page, replyTo) => {
      try {
        const url = this.buildUrl(
          `comment/list?page=${page}&size=30&type=4&objId=${subId || comicId
          }&sortBy=1`
        );
        const res = await Network.get(url, this.headers);
        this.checkResponseStatus(res);

        const response = JSON.parse(res.body);
        const data = response.data;

        if (!data || !data.commentIdList || !data.commentList) {
          UI.showMessage("暂时没有评论，快来发表第一条吧~");
          return { comments: [], maxPage: 0 };
        }

        const rawIds = Array.isArray(data.commentIdList)
          ? data.commentIdList
          : [];
        const allCommentIds = rawIds
          .map((idStr) => `${idStr || ""}`.split(","))
          .flat()
          .filter((id) => id.trim() !== "");

        const processComments = () => {
          const validIds = [...new Set(allCommentIds)].filter((id) =>
            data.commentList.hasOwnProperty(id)
          );
          const filteredIds = replyTo
            ? validIds.filter(
              (id) => data.commentList[id]?.to_comment_id == replyTo
            )
            : validIds;

          return filteredIds.map((id) => {
            const comment = data.commentList[id];
            return new Comment({
              userName: comment.nickname || "匿名用户",
              avatar: comment.photo || "",
              content: comment.content || "[内容已删除]",
              time: this.formatTimestamp(comment.create_time),
              replyCount: comment.reply_amount || 0,
              score: comment.like_amount || 0,
              id: String(id),
              parentId: comment.to_comment_id || null,
            });
          });
        };

        const comments = processComments();
        if (comments.length === 0) {
          UI.showMessage(replyTo ? "该评论暂无回复" : "这里还没有评论哦~");
        }

        return {
          comments: comments,
          maxPage: Math.ceil((data.total || 0) / 30),
        };
      } catch (e) {
        console.error("评论加载失败:", e);
        UI.showMessage(`加载评论失败: ${e.message}`);
        return { comments: [], maxPage: 0 };
      }
    },

    sendComment: async (comicId, subId, content, replyTo) => {
      if (!replyTo) replyTo = 0;
      let res = await Network.post(
        this.buildUrl(`comment/add`),
        {
          ...this.headers,
          "Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
        },
        `obj_id=${subId}&content=${encodeURIComponent(
          content
        )}&to_comment_id=${replyTo}&type=4`
      );
      this.checkResponseStatus(res);
      let response = JSON.parse(res.body);
      if (response.errno !== 0) throw new Error(response.errmsg || "加载失败");
      return "ok";
    },

    likeComment: async (comicId, subId, commentId, isLike) => {
      let res = await Network.post(
        this.buildUrl(`comment/addLike`),
        {
          ...this.headers,
          "Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
        },
        `commentId=${commentId}&type=4`
      );
      this.checkResponseStatus(res);
      return "ok";
    },

    // ========== 新增：ID 匹配规则（支持纯数字 ID 快速打开） ==========
    idMatch: "^\\d+$",
  };

  settings = {
    signTask: {
      title: "每日签到",
      type: "switch",
      default: false
    }
  };
}
