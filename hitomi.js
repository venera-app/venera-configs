/** @type {import('./_venera_.js')} */

const domain2 = "gold-usergeneratedcontent.net";
const domain = "ltn." + domain2;

const nozomiextension = ".nozomi";

const separator = "-";
const extension = ".html";
const galleriesdir = "galleries";
const index_dir = "tagindex";
const galleries_index_dir = "galleriesindex";
const languages_index_dir = "languagesindex";
const nozomiurl_index_dir = "nozomiurlindex";
const max_node_size = 464;
const B = 16;
const compressed_nozomi_prefix = "n";
const tag_index_domain = `tagindex.hitomi.la`;

const namespaces = [
  "artist",
  "character",
  "female",
  "group",
  "language",
  "male",
  "series",
  "tag",
  "type",
];

const refererUrl = "https://hitomi.la/";
let galleries_index_version = "";
let gg = undefined;

/**
 * 求交集
 * @param arrays
 * @returns
 */
function intersectAll(arrays) {
  if (!arrays.length) return [];
  if (arrays.length === 1) return arrays[0];

  return arrays.reduce((acc, curr) => {
    const set = new Set(curr);
    return acc.filter((x) => set.has(x));
  });
}

/**
 * 求差集(A - B)
 * @param arrA
 * @param arrB
 * @returns
 */
function subtract(arrA, arrB) {
  const setB = new Set(arrB);
  return arrA.filter((x) => !setB.has(x));
}

/**
 * 求并集
 * @param arrays 数组列表
 * @returns 返回一个包含所有唯一元素的数组
 */
function unionAll(arrays) {
  return Array.from(new Set(arrays.flat()));
}

/**
 * 将一个数组随机排序
 * @param arr
 * @returns
 */
function shuffleArray(arr) {
  const array = arr.slice(); // 创建副本以避免修改原数组
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1)); // 从 0 到 i 之间随机选择索引
    [array[i], array[j]] = [array[j], array[i]]; // 交换元素
  }
  return array;
}

function toISO8601(s) {
  // 1. 空格换成 T
  // 2. 如果末尾只有 ±HH，就补上 ":00"
  return s.replace(" ", "T").replace(/([+-]\d{2})$/, "$1:00");
}

function formatDate(date) {
  if (typeof date === "string") {
    date = toISO8601(date);
    date = new Date(date);
  }
  // 辅助：不足两位则前面补 '0'
  function pad(n) {
    return n < 10 ? "0" + n : n;
  }
  const year = date.getFullYear(); // 本地年
  const month = pad(date.getMonth() + 1); // 月份从 0 开始，+1
  const day = pad(date.getDate()); // 日
  const hour = pad(date.getHours()); // 时
  const minute = pad(date.getMinutes()); // 分

  return `${year}-${month}-${day} ${hour}:${minute}`;
}

const hash_term = function (term) {
  return new Uint8Array(Convert.sha256(Convert.encodeUtf8(term))).slice(0, 4);
};

function getUint64(view, byteOffset, littleEndian = false) {
  const left = view.getUint32(byteOffset, littleEndian);
  const right = view.getUint32(byteOffset + 4, littleEndian);
  const combined = littleEndian
    ? left + 2 ** 32 * right
    : 2 ** 32 * left + right;

  if (!Number.isSafeInteger(combined)) {
    console.warn(
      `${combined} exceeds MAX_SAFE_INTEGER – precision may be lost`
    );
  }
  return combined;
}

function decode_node(data) {
  let node = {
    keys: [],
    datas: [],
    subnode_addresses: [],
  };

  let view = new DataView(data.buffer);
  let pos = 0;

  const number_of_keys = view.getInt32(pos, false /* big-endian */);
  pos += 4;

  let keys = [];
  for (let i = 0; i < number_of_keys; i++) {
    const key_size = view.getInt32(pos, false /* big-endian */);
    if (!key_size || key_size > 32) {
      throw new Error("fatal: !key_size || key_size > 32");
    }
    pos += 4;

    keys.push(data.slice(pos, pos + key_size));
    pos += key_size;
  }

  const number_of_datas = view.getInt32(pos, false /* big-endian */);
  pos += 4;

  let datas = [];
  for (let i = 0; i < number_of_datas; i++) {
    const offset = getUint64(view, pos, false /* big-endian */);
    pos += 8;

    const length = view.getInt32(pos, false /* big-endian */);
    pos += 4;

    datas.push([offset, length]);
  }

  const number_of_subnode_addresses = B + 1;
  let subnode_addresses = [];
  for (let i = 0; i < number_of_subnode_addresses; i++) {
    let subnode_address = getUint64(view, pos, false /* big-endian */);
    pos += 8;

    subnode_addresses.push(subnode_address);
  }

  node.keys = keys;
  node.datas = datas;
  node.subnode_addresses = subnode_addresses;

  return node;
}

async function get_url_at_range(url, range) {
  const headers = { referer: refererUrl };
  if (range) headers.range = `bytes=${range[0]}-${range[1]}`;
  const res = await Network.fetchBytes("GET", url, headers);
  if (res.status !== 200 && res.status !== 206) {
    throw new Error("get_url_at_range: " + res.status);
  }
  return new Uint8Array(res.body);
}

async function get_node_at_address(field, address) {
  if (!galleries_index_version)
    throw new Error("galleries_index_version is not set");
  const url =
    "https://" +
    domain +
    "/" +
    "galleriesindex/galleries." +
    galleries_index_version +
    ".index";
  const data = await get_url_at_range(url, [
    address,
    address + max_node_size - 1,
  ]);
  return decode_node(data);
}

async function get_galleryids_from_data(data) {
  let url =
    "https://" +
    domain +
    "/" +
    galleries_index_dir +
    "/galleries." +
    galleries_index_version +
    ".data";
  let [offset, length] = data;
  if (length > 100000000 || length <= 0) {
    throw new Error("length " + length + " is too long");
  }
  const inbuf = await get_url_at_range(url, [offset, offset + length - 1]);
  let galleryids = [];

  let pos = 0;
  let view = new DataView(inbuf.buffer);
  let number_of_galleryids = view.getInt32(pos, false /* big-endian */);
  pos += 4;

  let expected_length = number_of_galleryids * 4 + 4;

  if (number_of_galleryids > 10000000 || number_of_galleryids <= 0) {
    throw new Error(
      "number_of_galleryids " + number_of_galleryids + " is too long"
    );
  } else if (inbuf.byteLength !== expected_length) {
    throw new Error(
      "inbuf.byteLength " +
        inbuf.byteLength +
        " !== expected_length " +
        expected_length
    );
  }

  for (let i = 0; i < number_of_galleryids; ++i) {
    galleryids.push(view.getInt32(pos, false /* big-endian */));
    pos += 4;
  }

  return galleryids;
}

async function B_search(field, key, node) {
  const compare_arraybuffers = function (dv1, dv2) {
    const top = Math.min(dv1.length, dv2.length);
    for (let i = 0; i < top; i++) {
      if (dv1[i] < dv2[i]) {
        return -1;
      } else if (dv1[i] > dv2[i]) {
        return 1;
      }
    }
    return 0;
  };
  const locate_key = function (key, node) {
    let cmp_result = -1;
    let i;
    for (i = 0; i < node.keys.length; i++) {
      cmp_result = compare_arraybuffers(key, node.keys[i]);
      if (cmp_result <= 0) {
        break;
      }
    }
    return [!cmp_result, i];
  };

  const is_leaf = function (node) {
    for (let i = 0; i < node.subnode_addresses.length; i++) {
      if (node.subnode_addresses[i]) {
        return false;
      }
    }
    return true;
  };

  if (!node || !node.keys.length) {
    return;
  }

  let [there, where] = locate_key(key, node);
  if (there) {
    return node.datas[where];
  } else if (is_leaf(node)) {
    return;
  }

  if (node.subnode_addresses[where] == 0) {
    console.error("non-root node address 0");
    return;
  }

  //it's in a subnode
  const subnode = await get_node_at_address(
    field,
    node.subnode_addresses[where]
  );
  return await B_search(field, key, subnode);
}

async function get_galleryids_for_query_without_namespace(query) {
  query = query.replace(/_/g, " ");

  const key = hash_term(query);

  const field = "galleries";
  const node = await get_node_at_address(field, 0);

  const data = await B_search(field, key, node);
  if (!data) {
    return [];
  } else {
    return await get_galleryids_from_data(data);
  }
}

/**
 * 根据当前状态生成Nozomi地址
 * @param state 当前状态
 * @param with_prefix 是否包含前缀("n")
 * @returns 返回Nozomi地址
 */
function nozomi_address_from_state(state, with_prefix) {
  if (state.orderby !== "date" || state.orderbykey === "published") {
    if (state.area === "all")
      //ltn.hitomi.la/popular/year-all.nozomi
      return (
        "https://" +
        domain +
        "/" +
        (with_prefix ? compressed_nozomi_prefix + "/" : "") +
        [state.orderby, [state.orderbykey, state.language].join("-")].join(
          "/"
        ) +
        nozomiextension
      );
    //ltn.hitomi.la/tag/popular/week/female:sole%20female-czech.nozomi
    return (
      "https://" +
      domain +
      "/" +
      (with_prefix ? compressed_nozomi_prefix + "/" : "") +
      [
        state.area,
        state.orderby,
        state.orderbykey,
        [encodeURI(state.tag), state.language].join("-"),
      ].join("/") +
      nozomiextension
    );
  }

  if (state.area === "all")
    return (
      "https://" +
      domain +
      "/" +
      (with_prefix ? compressed_nozomi_prefix + "/" : "") +
      [[encodeURI(state.tag), state.language].join("-")].join("/") +
      nozomiextension
    );
  return (
    "https://" +
    domain +
    "/" +
    (with_prefix ? compressed_nozomi_prefix + "/" : "") +
    [state.area, [encodeURI(state.tag), state.language].join("-")].join("/") +
    nozomiextension
  );
}

/**
 * 获取指定HMState的gallery IDs
 * @param state
 * @returns
 */
async function get_galleryids_from_state(state) {
  const url = nozomi_address_from_state(state, true);
  const data = await get_url_at_range(url);
  var nozomi = [];
  var view = new DataView(data.buffer);
  var total = view.byteLength / 4;
  for (var i = 0; i < total; i++) {
    nozomi.push(view.getInt32(i * 4, false /* big-endian */));
  }
  return nozomi;
}

async function get_galleryids_and_count({ range, state }) {
  const headers = { referer: refererUrl };
  if (range) headers.range = range;
  const resp = await Network.fetchBytes(
    "GET",
    nozomi_address_from_state(state, false),
    headers
  );
  if (resp.status !== 200 && resp.status !== 206) {
    throw `failed fetch: ${resp.status}`;
  }
  let itemCount = 0;
  const temp = parseInt(
    resp.headers["content-range"]?.replace(/^[Bb]ytes \d+-\d+\//, "")
  );
  if (!isNaN(temp) && temp > 0) {
    itemCount = temp / 4;
  }

  const arrayBuffer = resp.body;
  const nozomi = [];
  if (arrayBuffer) {
    const view = new DataView(arrayBuffer);
    const total = view.byteLength / 4;
    for (let i = 0; i < total; i++) {
      nozomi.push(view.getInt32(i * 4, false /* big-endian */));
    }
  }
  return { galleryids: nozomi, count: itemCount };
}

async function get_single_galleryblock(gid) {
  const url = "https://" + domain + "/" + `galleryblock/${gid}.html`;
  const res = await Network.get(url, { referer: refererUrl });
  return parseGalleryBlockInfo(res.body);
}

async function get_galleryblocks(gids) {
  if (gids.length > 25) throw new Error("Be careful: too many blocks");
  return await Promise.all(gids.map((n) => get_single_galleryblock(n)));
}

/**
 * 获取索引版本号
 * @param name 索引名称，默认为 "galleriesindex"
 * @returns 返回索引版本号
 */
async function get_index_version(name = "galleriesindex") {
  const url =
    "https://" + domain + "/" + name + "/version?_=" + new Date().getTime();
  const resp = await Network.get(url, { referer: refererUrl });
  if (resp.status === 200) {
    return resp.body;
  } else {
    throw new Error(resp.status);
  }
}

async function update_galleries_index_version() {
  galleries_index_version = await get_index_version();
}

async function get_image_srcs(files) {
  const resp = await Network.get(
    "https://" + domain + "/" + "gg.js?_=" + new Date().getTime(),
    {
      referer: refererUrl,
    }
  );
  if (resp.status >= 400) {
    throw new Error(resp.status);
  }

  eval(resp.body);
  if (!gg.b) throw new Error();

  const subdomain_from_url = (url, base, dir) => {
    var retval = "";
    if (!base) {
      if (dir === "webp") {
        retval = "w";
      } else if (dir === "avif") {
        retval = "a";
      }
    }

    var b = 16;

    var r = /\/[0-9a-f]{61}([0-9a-f]{2})([0-9a-f])/;
    var m = r.exec(url);
    if (!m) {
      return retval;
    }

    var g = parseInt(m[2] + m[1], b);
    if (!isNaN(g)) {
      if (base) {
        retval = String.fromCharCode(97 + gg.m(g)) + base;
      } else {
        retval = retval + (1 + gg.m(g));
      }
    }
    return retval;
  };

  const url_from_url = (url, base, dir) => {
    return url.replace(
      /\/\/..?\.(?:gold-usergeneratedcontent\.net|hitomi\.la)\//,
      "//" + subdomain_from_url(url, base, dir) + "." + domain2 + "/"
    );
  };

  const url_from_url_from_hash = (galleryid, image, dir, ext, base) => {
    if ("tn" === base) {
      return url_from_url(
        "https://a." +
          domain2 +
          "/" +
          dir +
          "/" +
          real_full_path_from_hash(image.hash) +
          "." +
          ext,
        base
      );
    }
    return url_from_url(url_from_hash(galleryid, image, dir, ext), base, dir);
  };

  const url_from_hash = (galleryid, image, dir, ext) => {
    ext = ext || dir || image.name.split(".").pop();
    if (dir === "webp" || dir === "avif") {
      dir = "";
    } else {
      dir += "/";
    }

    return (
      "https://a." +
      domain2 +
      "/" +
      dir +
      full_path_from_hash(image.hash) +
      "." +
      ext
    );
  };

  const full_path_from_hash = (hash) => {
    return gg.b + gg.s(hash) + "/" + hash;
  };

  const real_full_path_from_hash = (hash) => {
    return hash.replace(/^.*(..)(.)$/, "$2/$1/" + hash);
  };
  return files.map((image) => url_from_url_from_hash(0, image, "avif"));
}

/**
 * 构建缩略图（small / big）URL
 * @param {string} hash 64 位文件哈希
 * @param {boolean} bigTn 是否返回大缩略图
 * @returns {string}
 */
function get_thumbnail_url_from_hash(hash, bigTn) {
  return (
    "https://atn." +
    domain2 +
    "/" +
    `${bigTn ? "avifbigtn" : "avifsmalltn"}/${hash.slice(-1)}/${hash.slice(
      -3,
      -1
    )}/${hash}.avif`
  );
}

async function get_gallery_detail(gid) {
  const resp = await Network.get(
    "https://" + domain + "/" + `galleries/${gid}.js`,
    { referer: refererUrl }
  );
  if (resp.status !== 200) {
    throw new Error(resp.status);
  }
  return parseGalleryDetail(resp.body);
}

function parseQuery(query) {
  const positive_terms = [];
  const negative_terms = [];
  let or_terms = [[]];
  const terms = query.toLowerCase().trim().split(/\s+/);
  terms.forEach((term, i) => {
    if (term === "or") return;

    let namespace = undefined;
    let value = "";
    if (term.split("").filter((n) => n === ":").length > 1) {
      throw new Error("不合法的标签，请使用namespace:tag的格式");
    }
    if (term.includes(":")) {
      const splits = term.split(":");
      const left = splits[0].replace(/^-/, "");
      if (namespaces.includes(left)) {
        namespace = left;
      } else {
        throw new Error("不合法的namespace");
      }
      if (!splits[1]) throw new Error("不合法，标签为空");
      value = splits[1].replace(/_/g, " ");
    } else {
      value = term.replace(/_/g, " ");
    }

    const or_previous = i > 0 && terms[i - 1] === "or";
    const or_next = i + 1 < terms.length && terms[i + 1] === "or";
    if (or_previous || or_next) {
      if (term.match(/^-/))
        throw new Error("不合法，或搜索中只能使用正向关键词");
      or_terms[or_terms.length - 1].push({ namespace, value });
      if (!or_next) {
        or_terms.push([]);
      }
      return;
    }

    if (term.match(/^-/)) {
      negative_terms.push({ namespace, value });
    } else {
      positive_terms.push({ namespace, value });
    }
  });

  or_terms
    .filter((n) => n.length === 1)
    .forEach((n) => {
      positive_terms.push(n[0]);
    });
  or_terms = or_terms.filter((n) => n.length > 1);
  if (
    (or_terms.length > 0 || negative_terms.length > 0) &&
    positive_terms.length === 0
  ) {
    positive_terms.push({ value: "" });
  }
  return {
    positive_terms,
    negative_terms,
    or_terms,
  };
}

async function getSingleTagSearchPage({ state, page }) {
  return await get_galleryids_and_count({
    state,
    range: "bytes=" + `${page * 100}-${(page + 1) * 100 - 1}`,
  });
}

async function multiTagSearch(options) {
  const getPromise = (n) => {
    if (!n.value) {
      const state = {
        area: "all",
        tag: "index",
        language: "all",
        orderby: options.orderby,
        orderbykey: options.orderbykey,
        orderbydirection: options.orderbydirection,
      };
      return get_galleryids_from_state(state);
    } else if (!n.namespace) {
      return get_galleryids_for_query_without_namespace(n.value);
    } else if (n.namespace === "language") {
      const state = {
        area: "all",
        tag: "index",
        language: n.value,
        orderby: options.orderby,
        orderbykey: options.orderbykey,
        orderbydirection: options.orderbydirection,
      };
      return get_galleryids_from_state(state);
    } else {
      const state = {
        area:
          n.namespace === "female" || n.namespace === "male"
            ? "tag"
            : n.namespace,
        tag:
          n.namespace === "female"
            ? "female:" + n.value
            : n.namespace === "male"
            ? "male:" + n.value
            : n.value,
        language: "all",
        orderby: options.orderby,
        orderbykey: options.orderbykey,
        orderbydirection: options.orderbydirection,
      };
      return get_galleryids_from_state(state);
    }
  };
  const parsed = parseQuery(options.term);
  const promises = [
    ...parsed.positive_terms.map((n) => getPromise(n)),
    ...parsed.negative_terms.map((n) => getPromise(n)),
    ...parsed.or_terms.flat().map((n) => getPromise(n)),
  ];
  const result = await Promise.all(promises);
  const lp = parsed.positive_terms.length;
  const ln = parsed.negative_terms.length;
  let r = intersectAll(result.slice(0, lp));
  for (let i = lp; i < lp + ln; i++) {
    r = subtract(r, result[i]);
  }
  let i = lp + ln;
  for (const or_term of parsed.or_terms) {
    const length = or_term.length;
    r = intersectAll([r, unionAll(result.slice(i, i + length))]);
    i += length;
  }

  return r;
}

async function search(options) {
  const parsed = parseQuery(options.term);
  if (!options.term.trim() && options.orderbydirection === "desc") {
    const state = {
      area: "all",
      tag: "index",
      language: "all",
      orderby: options.orderby,
      orderbykey: options.orderbykey,
      orderbydirection: options.orderbydirection,
    };
    const { galleryids, count } = await getSingleTagSearchPage({
      state,
      page: 0,
    });
    return {
      type: "single",
      gids: galleryids,
      count,
      state,
    };
  } else if (
    parsed.negative_terms.length === 0 &&
    parsed.or_terms.length === 0 &&
    parsed.positive_terms.length === 1 &&
    parsed.positive_terms[0].namespace &&
    options.orderbydirection === "desc"
  ) {
    const state = {
      area: "all",
      tag: "index",
      language: "all",
      orderby: options.orderby,
      orderbykey: options.orderbykey,
      orderbydirection: options.orderbydirection,
    };
    const n = parsed.positive_terms[0];
    if (!n.namespace) throw new Error("");
    if (n.namespace === "language") {
      state.language = n.value;
    } else {
      state.area =
        n.namespace === "female" || n.namespace === "male"
          ? "tag"
          : n.namespace;
      state.tag =
        n.namespace === "female"
          ? "female:" + n.value
          : n.namespace === "male"
          ? "male:" + n.value
          : n.value;
    }

    const { galleryids, count } = await getSingleTagSearchPage({
      state,
      page: 0,
    });
    return {
      type: "single",
      gids: galleryids,
      count,
      state,
    };
  } else {
    await update_galleries_index_version();
    const gids = await multiTagSearch(options);
    const rgids =
      options.orderbydirection === "random"
        ? shuffleArray(gids)
        : options.orderbydirection === "asc"
        ? gids.toReversed()
        : gids;
    return {
      type: "all",
      gids: rgids,
      count: rgids.length,
    };
  }
}

function parseGalleryBlockInfo(body) {
  const mangaEl = new HtmlDocument(body);

  // 标题和详情页链接
  const titleLink = mangaEl.querySelector("h1.lillie > a");
  const gid = /-(\d+)\.html$/.exec(titleLink.attributes["href"]).at(1);
  const title = titleLink.text;

  // 封面图URL
  const thumbnail_hashs = [];
  const srcs = Array.from(mangaEl.querySelectorAll("img")).map((a) =>
    a.attributes["data-src"].trim()
  );
  srcs.forEach((src) => {
    const r = /\/(\w{64})\./.exec(src);
    if (r) {
      const hash = r[1];
      thumbnail_hashs.push(hash);
    }
  });

  // 作者列表
  const artists = Array.from(mangaEl.querySelectorAll(".artist-list li a")).map(
    (a) => a.text.trim()
  );

  let language = undefined;
  let series = [];
  let type = undefined;
  // 描述表格：Series / Type / Language
  const rows = mangaEl.querySelectorAll(".dj-desc tr");
  rows.forEach((row) => {
    const key = row.children[0].text.trim().toLowerCase();
    const valueCell = row.children[1];
    switch (key) {
      case "series": {
        const text = valueCell.text.trim();
        if (text !== "N/A") {
          const as = valueCell.querySelectorAll("a");
          as.forEach((a) => series.push(a.text.trim()));
        }
        break;
      }
      case "type": {
        type = valueCell.text.trim();
        break;
      }
      case "language": {
        if (valueCell.querySelector("a")) {
          const href = valueCell.querySelector("a").attributes["href"];
          const r = /\/index-(\w+)\.html/.exec(href);
          if (r) {
            language = r[1];
          }
        }
        break;
      }
    }
  });

  // 标签列表
  const females = [];
  const males = [];
  const others = [];
  Array.from(mangaEl.querySelectorAll(".relatedtags li a")).map((a) => {
    const text = a.text.trim();
    if (text.endsWith(" ♀")) {
      females.push(text.slice(0, -2));
    } else if (text.endsWith(" ♂")) {
      males.push(text.slice(0, -2));
    } else {
      others.push(text);
    }
  });

  // 发布日期（原始字符串）
  const postedRaw = mangaEl.querySelector(".date").text.trim();
  const posted_time = new Date(toISO8601(postedRaw));

  return {
    gid,
    title,
    type,
    language,
    artists,
    series,
    females,
    males,
    others,
    thumbnail_hashs,
    posted_time,
  };
}

function parseGalleryDetail(text) {
  const data = JSON.parse(text.slice(18));
  const artists = [];
  const groups = [];
  const series = [];
  const characters = [];
  const females = [];
  const males = [];
  const others = [];
  const translations = [];
  const related_gids = [];
  if (
    "artists" in data &&
    Array.isArray(data.artists) &&
    data.artists.length > 0
  ) {
    data.artists.forEach((n) => artists.push(n.artist));
  }
  if (
    "groups" in data &&
    Array.isArray(data.groups) &&
    data.groups.length > 0
  ) {
    data.groups.forEach((n) => groups.push(n.group));
  }
  if (
    "parodys" in data &&
    Array.isArray(data.parodys) &&
    data.parodys.length > 0
  ) {
    data.parodys.forEach((n) => series.push(n.parody));
  }
  if (
    "characters" in data &&
    Array.isArray(data.characters) &&
    data.characters.length > 0
  ) {
    data.characters.forEach((n) => characters.push(n.character));
  }
  if ("tags" in data && Array.isArray(data.tags) && data.tags.length > 0) {
    data.tags
      .filter((n) => n.female === "1")
      .forEach((n) => females.push(n.tag));
    data.tags.filter((n) => n.male === "1").forEach((n) => males.push(n.tag));
    data.tags
      .filter((n) => !n.male && !n.female)
      .forEach((n) => others.push(n.tag));
  }
  if (
    "languages" in data &&
    Array.isArray(data.languages) &&
    data.languages.length > 0
  ) {
    data.languages.forEach((n) => {
      translations.push({
        gid: n.galleryid,
        language: n.name,
      });
    });
  }
  if (
    "related" in data &&
    Array.isArray(data.related) &&
    data.related.length > 0
  ) {
    data.related.forEach((n) => related_gids.push(n));
  }

  return {
    gid: parseInt(data.id),
    title: data.title,
    url: "https://hitomi.la" + data.galleryurl,
    type: data.type,
    length: data.files.length,
    language: "language" in data && data.language ? data.language : undefined,
    artists,
    groups,
    series,
    characters,
    females,
    males,
    others,
    thumbnail_hash: data.files[0].hash,
    files: data.files,
    posted_time: new Date(toISO8601(data.date)),
    translations,
    related_gids,
  };
}

class Hitomi extends ComicSource {
  // Note: The fields which are marked as [Optional] should be removed if not used

  // name of the source
  name = "hitomi.la";

  // unique id of the source
  key = "hitomi";

  version = "1.1.2";

  minAppVersion = "1.4.6";

  // update url
  url = "https://git.nyne.dev/nyne/venera-configs/raw/branch/main/hitomi.js";

  galleryCache = [];
  categoryResultCache = undefined;
  searchResultCaches = new Map();

  _mapGalleryBlockInfoToComic(n) {
    return new Comic({
      id: n.gid,
      title: n.title,
      subTitle: n.artists.length ? n.artists.join(" ") : "",
      cover: get_thumbnail_url_from_hash(n.thumbnail_hashs[0], true),
      tags: [
        ...n.series,
        ...n.females.map((m) => "f:" + m),
        ...n.males.map((m) => "m:" + m),
        ...n.others.map((m) => "f:" + m),
      ],
      language: n.language,
      description: n.type
        ? n.type + "\n" + formatDate(n.posted_time)
        : n.posted_time,
    });
  }

  /**
   * [Optional] init function
   */
  init() {}

  // explore page list
  explore = [
    {
      // title of the page.
      // title is used to identify the page, it should be unique
      title: "hitomi.la",

      /// multiPartPage or multiPageComicList or mixed
      type: "multiPageComicList",

      /**
       * load function
       * @param page {number | null} - page number, null for `singlePageWithMultiPart` type
       * @returns {{}}
       * - for `multiPartPage` type, return [{title: string, comics: Comic[], viewMore: PageJumpTarget}]
       * - for `multiPageComicList` type, for each page(1-based), return {comics: Comic[], maxPage: number}
       * - for `mixed` type, use param `page` as index. for each index(0-based), return {data: [], maxPage: number?}, data is an array contains Comic[] or {title: string, comics: Comic[], viewMore: string?}
       */
      load: async (page) => {
        if (!page) page = 1;
        const result = await getSingleTagSearchPage({
          state: {
            area: "all",
            tag: "index",
            language: "all",
            orderby: "date",
            orderbykey: "added",
            orderbydirection: "desc",
          },
          page: page - 1,
        });

        const comics = (await get_galleryblocks(result.galleryids)).map((n) =>
          this._mapGalleryBlockInfoToComic(n)
        );

        return {
          comics,
          maxPage: Math.ceil(result.count / 25),
        };
      },

      /**
       * Only use for `multiPageComicList` type.
       * `loadNext` would be ignored if `load` function is implemented.
       * @param next {string | null} - next page token, null if first page
       * @returns {Promise<{comics: Comic[], next: string?}>} - next is null if no next page.
       */
      loadNext(next) {},
    },
  ];

  // categories
  category = {
    /// title of the category page, used to identify the page, it should be unique
    title: "hitomi.la",
    parts: [
      {
        name: "语言",
        type: "fixed",
        categories: ["汉语", "英语"],
        itemType: "category",
        categoryParams: ["language:chinese", "language:english"],
      },
      {
        name: "类别",
        type: "fixed",
        categories: ["同人志", "漫画", "画师CG", "游戏CG", "图集", "动画"],
        itemType: "category",
        categoryParams: [
          "type:doujinshi",
          "type:manga",
          "type:artistcg",
          "type:gamecg",
          "type:imageset",
          "type:anime",
        ],
      },
    ],
    // enable ranking page
    enableRankingPage: true,
  };

  /// category comic loading related
  categoryComics = {
    /**
     * load comics of a category
     * @param category {string} - category name
     * @param param {string?} - category param
     * @param options {string[]} - options from optionList
     * @param page {number} - page number
     * @returns {Promise<{comics: Comic[], maxPage: number}>}
     */
    load: async (category, param, options, page) => {
      const term = param;
      if (!term.includes(":"))
        throw new Error("不合法的标签，请使用namespace:tag的格式");
      if (page === 1) {
        const option = parseInt(options[0]);
        const searchOptions = {
          term,
          orderby: "date",
          orderbykey: "added",
          orderbydirection: "desc",
        };

        switch (option) {
          case 1:
            searchOptions.orderbykey = "published";
            break;
          case 2:
            searchOptions.orderby = "popular";
            searchOptions.orderbykey = "today";
            break;
          case 3:
            searchOptions.orderby = "popular";
            searchOptions.orderbykey = "week";
            break;
          case 4:
            searchOptions.orderby = "popular";
            searchOptions.orderbykey = "month";
            break;
          case 5:
            searchOptions.orderby = "popular";
            searchOptions.orderbykey = "year";
            break;
          case 6:
            searchOptions.orderbydirection = "random";
            break;
          default:
            break;
        }
        const result = await search(searchOptions);
        if (result.type === "single") {
          const comics = (await get_galleryblocks(result.gids)).map((n) =>
            this._mapGalleryBlockInfoToComic(n)
          );
          this.categoryResultCache = {
            type: "single",
            state: result.state,
            count: result.count,
          };
          return {
            comics,
            maxPage: Math.ceil(result.count / 25),
          };
        } else {
          const comics = (
            await get_galleryblocks(
              result.gids.slice(25 * page - 25, 25 * page)
            )
          ).map((n) => this._mapGalleryBlockInfoToComic(n));
          this.categoryResultCache = {
            type: "all",
            gids: result.gids,
            count: result.count,
          };
          return {
            comics,
            maxPage: Math.ceil(result.count / 25),
          };
        }
      } else {
        if (this.categoryResultCache.type === "single") {
          const result = await getSingleTagSearchPage({
            state: this.categoryResultCache.state,
            page: page - 1,
          });
          const comics = (await get_galleryblocks(result.galleryids)).map((n) =>
            this._mapGalleryBlockInfoToComic(n)
          );
          return {
            comics,
            maxPage: Math.ceil(this.categoryResultCache.count / 25),
          };
        } else {
          const comics = (
            await get_galleryblocks(
              this.categoryResultCache.gids.slice(25 * page - 25, 25 * page)
            )
          ).map((n) => this._mapGalleryBlockInfoToComic(n));
          return {
            comics,
            maxPage: Math.ceil(this.categoryResultCache.count / 25),
          };
        }
      }
    },
    // provide options for category comic loading
    optionList: [
      {
        // For a single option, use `-` to separate the value and text, left for value, right for text
        options: [
          "0-Date Added",
          "1-Date Published",
          "2-Popular:Today",
          "3-Popular:Week",
          "4-Popular:Month",
          "5-Popular:Year",
          "6-Random",
        ],
        // [Optional] {string[]} - show this option only when the value not in the list
        notShowWhen: null,
        // [Optional] {string[]} - show this option only when the value in the list
        showWhen: null,
      },
    ],
    ranking: {
      // For a single option, use `-` to separate the value and text, left for value, right for text
      options: ["today-Today", "week-Week", "month-Month", "year-Year"],
      /**
       * load ranking comics
       * @param option {string} - option from optionList
       * @param page {number} - page number
       * @returns {Promise<{comics: Comic[], maxPage: number}>}
       */
      load: async (option, page) => {
        if (!page) page = 1;
        const result = await getSingleTagSearchPage({
          state: {
            area: "all",
            tag: "index",
            language: "all",
            orderby: "popular",
            orderbykey: option,
            orderbydirection: "desc",
          },
          page: page - 1,
        });

        const comics = (await get_galleryblocks(result.galleryids)).map((n) =>
          this._mapGalleryBlockInfoToComic(n)
        );

        return {
          comics,
          maxPage: Math.ceil(result.count / 25),
        };
      },
    },
  };

  /// search related
  search = {
    /**
     * load search result
     * @param keyword {string}
     * @param options {string[]} - options from optionList
     * @param page {number}
     * @returns {Promise<{comics: Comic[], maxPage: number}>}
     */
    load: async (keyword, options, page) => {
      const cacheKey = (keyword || "") + "|" + options.join(",");
      if (page === 1) {
        const option = parseInt(options[0]);
        const term = keyword;
        const searchOptions = {
          term,
          orderby: "date",
          orderbykey: "added",
          orderbydirection: "desc",
        };

        switch (option) {
          case 1:
            searchOptions.orderbykey = "published";
            break;
          case 2:
            searchOptions.orderby = "popular";
            searchOptions.orderbykey = "today";
            break;
          case 3:
            searchOptions.orderby = "popular";
            searchOptions.orderbykey = "week";
            break;
          case 4:
            searchOptions.orderby = "popular";
            searchOptions.orderbykey = "month";
            break;
          case 5:
            searchOptions.orderby = "popular";
            searchOptions.orderbykey = "year";
            break;
          case 6:
            searchOptions.orderbydirection = "random";
            break;
          default:
            break;
        }
        const result = await search(searchOptions);
        if (result.type === "single") {
          const comics = (await get_galleryblocks(result.gids)).map((n) =>
            this._mapGalleryBlockInfoToComic(n)
          );
          this.searchResultCaches.set(cacheKey, {
            type: "single",
            state: result.state,
            count: result.count,
          });
          return {
            comics,
            maxPage: Math.ceil(result.count / 25),
          };
        } else {
          const comics = (
            await get_galleryblocks(
              result.gids.slice(25 * page - 25, 25 * page)
            )
          ).map((n) => this._mapGalleryBlockInfoToComic(n));
          this.searchResultCaches.set(cacheKey, {
            type: "all",
            gids: result.gids,
            count: result.count,
          });
          return {
            comics,
            maxPage: Math.ceil(result.count / 25),
          };
        }
      } else {
        const searchResultCache = this.searchResultCaches.get(cacheKey);
        if (searchResultCache.type === "single") {
          const result = await getSingleTagSearchPage({
            state: searchResultCache.state,
            page: page - 1,
          });
          const comics = (await get_galleryblocks(result.galleryids)).map((n) =>
            this._mapGalleryBlockInfoToComic(n)
          );
          return {
            comics,
            maxPage: Math.ceil(searchResultCache.count / 25),
          };
        } else {
          const comics = (
            await get_galleryblocks(
              searchResultCache.gids.slice(25 * page - 25, 25 * page)
            )
          ).map((n) => this._mapGalleryBlockInfoToComic(n));
          return {
            comics,
            maxPage: Math.ceil(searchResultCache.count / 25),
          };
        }
      }
    },

    /**
     * load search result with next page token.
     * The field will be ignored if `load` function is implemented.
     * @param keyword {string}
     * @param options {(string)[]} - options from optionList
     * @param next {string | null}
     * @returns {Promise<{comics: Comic[], maxPage: number}>}
     */
    loadNext: async (keyword, options, next) => {},

    // provide options for search
    optionList: [
      {
        // [Optional] default is `select`
        // type: select, multi-select, dropdown
        // For select, there is only one selected value
        // For multi-select, there are multiple selected values or none. The `load` function will receive a json string which is an array of selected values
        // For dropdown, there is one selected value at most. If no selected value, the `load` function will receive a null
        type: "select",
        // For a single option, use `-` to separate the value and text, left for value, right for text
        options: [
          "0-Date Added",
          "1-Date Published",
          "2-Popular:Today",
          "3-Popular:Week",
          "4-Popular:Month",
          "5-Popular:Year",
          "6-Random",
        ],
        // option label
        label: "sort",
        // default selected options. If not set, use the first option as default
        default: null,
      },
    ],

    // enable tags suggestions
    enableTagsSuggestions: true,
    onTagSuggestionSelected: (namespace, tag) => {
      let fixedNamespace = undefined;
      switch (namespace) {
        case "reclass":
          fixedNamespace = "type";
          break;
        case "parody":
          fixedNamespace = "series";
          break;
        case "other":
          fixedNamespace = "tag";
          break;
        case "mixed":
          fixedNamespace = "tag";
          break;
        case "temp":
          fixedNamespace = "tag";
          break;
        case "cosplayer":
          fixedNamespace = "tag";
          break;
        default:
          fixedNamespace = namespace;
          break;
      }
      // return the text to insert into search box
      return `${fixedNamespace}:${tag.replaceAll(" ", "_")}`;
    },
  };

  /// single comic related
  comic = {
    /**
     * load comic info
     * @param id {string}
     * @returns {Promise<ComicDetails>}
     */
    loadInfo: async (id) => {
      const data = await get_gallery_detail(id);

      const tags = new Map();
      if ("type" in data && data.type) tags.set("type", [data.type]);
      if (data.groups.length) tags.set("groups", data.groups);
      if (data.artists.length) tags.set("artists", data.artists);
      if ("language" in data && data.language)
        tags.set("language", [data.language]);
      if (data.series.length) tags.set("series", data.series);
      if (data.characters.length) tags.set("characters", data.characters);
      if (data.females.length) tags.set("females", data.females);
      if (data.males.length) tags.set("males", data.males);
      if (data.others.length) tags.set("others", data.others);

      let recommend = undefined;
      if (data.related_gids.length) {
        recommend = (await get_galleryblocks(data.related_gids)).map((n) =>
          this._mapGalleryBlockInfoToComic(n)
        );
      }

      this.galleryCache = data;

      return new ComicDetails({
        title: data.title,
        cover: get_thumbnail_url_from_hash(data.thumbnail_hash, true),
        tags,
        maxPage: data.files.length,
        thumbnails: data.files.map((n) => get_thumbnail_url_from_hash(n.hash)),
        uploadTime: formatDate(data.posted_time),
        url: data.url,
        recommend,
      });
    },
    /**
     * load images of a chapter
     * @param comicId {string}
     * @param epId {string?}
     * @returns {Promise<{images: string[]}>}
     */
    loadEp: async (comicId, epId) => {
      const data = this.galleryCache;
      if (data.type === "anime") throw new Error("不支持视频浏览");
      const images = await get_image_srcs(data.files);
      return { images };
    },
    /**
     * [Optional] provide configs for an image loading
     * @param url
     * @param comicId
     * @param epId
     * @returns {ImageLoadingConfig | Promise<ImageLoadingConfig>}
     */
    onImageLoad: (url, comicId, epId) => {
      return {
        url,
        headers: {
          referer: refererUrl,
        },
      };
    },
    /**
     * [Optional] provide configs for a thumbnail loading
     * @param url {string}
     * @returns {ImageLoadingConfig | Promise<ImageLoadingConfig>}
     *
     * `ImageLoadingConfig.modifyImage` and `ImageLoadingConfig.onLoadFailed` will be ignored.
     * They are not supported for thumbnails.
     */
    onThumbnailLoad: (url) => {
      return {
        url,
        headers: {
          referer: refererUrl,
        },
      };
    },
    onClickTag: (namespace, tag) => {
      let fixedNamespace = undefined;
      switch (namespace) {
        case "type":
          fixedNamespace = "type";
          break;
        case "groups":
          fixedNamespace = "group";
          break;
        case "artists":
          fixedNamespace = "artist";
          break;
        case "language":
          fixedNamespace = "language";
          break;
        case "series":
          fixedNamespace = "series";
          break;
        case "characters":
          fixedNamespace = "character";
          break;
        case "females":
          fixedNamespace = "female";
          break;
        case "males":
          fixedNamespace = "male";
          break;
        case "others":
          fixedNamespace = "tag";
          break;
        default:
          break;
      }
      if (!fixedNamespace) {
        throw new Error("不支持的标签命名空间: " + namespace);
      }
      const keyword = fixedNamespace + ":" + tag.replaceAll(" ", "_");
      return {
        page: "search",
        attributes: {
          keyword,
        },
      };
    },
    /**
     * [Optional] Handle links
     */
    link: {
      /**
       * set accepted domains
       */
      domains: ["hitomi.la"],
      /**
       * parse url to comic id
       * @param url {string}
       * @returns {string | null}
       */
      linkToId: (url) => {
        const reg = /https:\/\/hitomi\.la\/\w+\/[^\/]+-(\d+)\.html/;
        const r = reg.exec(url);
        if (r) {
          return r[1];
        } else {
          throw new Error("Invalid gallery url of hitomi.la");
        }
      },
    },
    // enable tags translate
    enableTagsTranslate: true,
  };
}
