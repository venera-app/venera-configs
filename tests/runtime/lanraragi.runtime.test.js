const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { createVeneraHostShim } = require("../../scripts/runtime/venera-host-shim");

test("lanraragi artifact boots under runtime shim", () => {
  const repoRoot = path.resolve(__dirname, "../..");
  const manifestPath = path.join(repoRoot, ".generated", "build-manifest.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const plugin = manifest.plugins.find((entry) => entry.id === "lanraragi");
  assert.ok(plugin, "lanraragi is missing from build manifest");
  const source = fs.readFileSync(path.join(repoRoot, plugin.outputPath), "utf8");
  const context = createVeneraHostShim();
  vm.runInContext(`${source}\nthis.__Ctor__=Lanraragi;`, context, { filename: plugin.outputPath });
  const instance = new context.__Ctor__();
  assert.equal(instance.key, "lanraragi");
  assert.equal(instance.version, "1.2.7");
});

test("lanraragi search sends bare booleans and tanks are not archives", async () => {
  const repoRoot = path.resolve(__dirname, "../..");
  const source = fs.readFileSync(path.join(repoRoot, "dist/plugins/lanraragi.js"), "utf8");
  const calls = [];
  const tank = "TANK_1793486619";
  const archive = "a".repeat(40);
  const context = createVeneraHostShim({
    Network: {
      get: async (url) => {
        calls.push(String(url));
        if (String(url).includes("/api/search")) {
          return {
            status: 200,
            body: JSON.stringify({
              data: [{ arcid: tank, title: "Grouped", tags: "" }],
              recordsFiltered: 1,
              draw: 1,
            }),
          };
        }
        if (String(url).includes("/api/tankoubons/" + tank)) {
          return {
            status: 200,
            body: JSON.stringify({
              id: tank,
              name: "Grouped",
              archives: [archive],
              summary: "",
              tags: "",
            }),
          };
        }
        if (String(url).includes("/metadata")) {
          return { status: 200, body: JSON.stringify({ title: "Chapter a", tags: "" }) };
        }
        if (String(url).includes("/files")) {
          return {
            status: 200,
            body: JSON.stringify({
              pages: ["./api/archives/" + archive + "/page?path=1.jpg"],
            }),
          };
        }
        return { status: 200, body: "{}" };
      },
    },
  });
  vm.runInContext(`${source}\nthis.__Ctor__=Lanraragi;`, context, {
    filename: "dist/plugins/lanraragi.js",
  });
  const instance = new context.__Ctor__();
  instance.loadSetting = () => "http://10.0.0.102:3000";
  const listed = await instance.search.load("nest", {
    0: '"title"',
    1: '"asc"',
    2: '"false"',
    3: '"false"',
    4: '"true"',
  }, 1);
  const searchUrl = calls.find((url) => url.includes("/api/search"));
  assert.equal(
    searchUrl,
    "http://10.0.0.102:3000/api/search?filter=nest&sortby=title&order=asc&newonly=false&untaggedonly=false&groupby_tanks=true&start=0",
  );
  assert.equal(listed.comics[0].id, tank);
  assert.equal(
    listed.comics[0].cover,
    "http://10.0.0.102:3000/api/archives/" + archive + "/thumbnail",
  );
  assert.equal(calls.some((url) => url.includes("/api/tankoubons?")), false);
  assert.equal(calls.some((url) => url.includes("/api/archives/" + tank)), false);

  const info = await instance.comic.loadInfo(tank);
  assert.equal(info.chapters[archive], "Chapter a");
  assert.equal(info.chapters instanceof Map, false);
  assert.equal(calls.some((url) => url.includes("/api/archives/" + tank)), false);

  const episode = await instance.comic.loadEp(tank, archive);
  assert.equal(episode.images.length, 1);
  assert.equal(episode.images[0], "lrr-page:" + archive + ":1.jpg");
  const loaded = instance.comic.onImageLoad(episode.images[0], tank, archive);
  assert.equal(
    loaded.url,
    "http://10.0.0.102:3000/api/archives/" + archive + "/page?path=1.jpg",
  );
  assert.equal(loaded.headers.Authorization, instance.headers.Authorization);
  assert.throws(
    () => instance.comic.onImageLoad(
      "https://attacker.invalid/api/archives/" + archive + "/page?path=1.jpg",
      tank,
      archive,
    ),
    /origin/,
  );
  assert.throws(
    () => instance.comic.onImageLoad(
      "./api/archives/" + archive + "/page?path=..%2Fsecret",
      tank,
      archive,
    ),
    /filename/,
  );
  assert.ok(calls.some((url) => url.includes("/api/archives/" + archive + "/files")));
  assert.equal(calls.some((url) => url.includes("/api/archives/" + tank)), false);
});

test("lanraragi groups category members and never requests tank archive urls", async () => {
  const repoRoot = path.resolve(__dirname, "../..");
  const source = fs.readFileSync(path.join(repoRoot, "dist/plugins/lanraragi.js"), "utf8");
  const calls = [];
  const tank = "TANK_1793486766";
  const first = "a".repeat(40);
  const second = "b".repeat(40);
  const context = createVeneraHostShim({
    Network: {
      get: async (url) => {
        const target = String(url);
        calls.push(target);
        if (target.includes("/api/search")) {
          return {
            status: 200,
            body: JSON.stringify({
              data: [
                { arcid: first, title: "Chapter 1", tags: "" },
                { arcid: second, title: "Chapter 2", tags: "" },
              ],
              recordsFiltered: 2,
            }),
          };
        }
        if (target.includes("/api/tankoubons?")) {
          return {
            status: 200,
            body: JSON.stringify({
              result: [{ id: tank, name: "Grouped Series", archives: [first, second] }],
              total: 1,
            }),
          };
        }
        if (target.includes("/api/tankoubons/" + tank)) {
          return {
            status: 200,
            body: JSON.stringify({
              id: tank,
              name: "Grouped Series",
              archives: [first, second],
            }),
          };
        }
        if (target.includes("/metadata")) {
          return { status: 200, body: JSON.stringify({ title: "Chapter", tags: "" }) };
        }
        return { status: 200, body: "{}" };
      },
    },
  });
  vm.runInContext(`${source}\nthis.__Ctor__=Lanraragi;`, context, {
    filename: "dist/plugins/lanraragi.js",
  });
  const instance = new context.__Ctor__();
  instance.loadSetting = () => "http://10.0.0.102:3000";

  const explored = await instance.explore[0].load(1);
  const exploreUrl = calls.find((url) => url.includes("/api/search"));
  assert.equal(
    exploreUrl,
    "http://10.0.0.102:3000/api/search?sortby=date_added&order=desc&groupby_tanks=true&start=0",
  );
  assert.equal(explored.comics.length, 2);

  calls.length = 0;
  const listed = await instance.categoryComics.load("SET_0000000001", null, [], 1);
  assert.equal(listed.comics.length, 1);
  assert.equal(listed.comics[0].id, tank);
  assert.equal(listed.comics[0].title, "Grouped Series");
  assert.equal(
    listed.comics[0].cover,
    "http://10.0.0.102:3000/api/archives/" + first + "/thumbnail",
  );
  assert.equal(calls.some((url) => url.includes("/api/archives/" + tank)), false);

  const info = await instance.comic.loadInfo(first);
  assert.equal(info.title, "Grouped Series");
  assert.equal(info.chapters[first], "Chapter");
  assert.equal(calls.some((url) => url.includes("/api/archives/" + tank)), false);
});

test("lanraragi accepts a bare LAN host and ignores another server's categories", async () => {
  const repoRoot = path.resolve(__dirname, "../..");
  const source = fs.readFileSync(path.join(repoRoot, "dist/plugins/lanraragi.js"), "utf8");
  const calls = [];
  const context = createVeneraHostShim({
    Network: {
      get: async (url, headers) => {
        calls.push({ url: String(url), headers });
        return {
          status: 200,
          body: JSON.stringify({ data: [], recordsFiltered: 0 }),
        };
      },
    },
  });
  vm.runInContext(`${source}\nthis.__Ctor__=Lanraragi;`, context, {
    filename: "dist/plugins/lanraragi.js",
  });
  const instance = new context.__Ctor__();
  const store = new Map();
  instance.loadData = (key) => (store.has(key) ? store.get(key) : null);
  instance.saveData = (key, value) => store.set(key, value);
  let api = "10.0.0.102:3000";
  instance.loadSetting = (key) => (key === "apiKey" ? "secret" : api);

  assert.equal(instance.baseUrl, "http://10.0.0.102:3000");
  assert.equal(instance.headers.Accept, "application/json");
  assert.equal(instance.headers.Authorization, "Bearer c2VjcmV0");
  assert.equal(instance.comic.onThumbnailLoad("http://10.0.0.102:3000/cover").headers.Accept, undefined);
  assert.equal(
    instance.comic.onThumbnailLoad("http://10.0.0.102:3000/cover").headers.Authorization,
    "Bearer c2VjcmV0",
  );
  assert.equal(
    instance.comic.onThumbnailLoad("https://attacker.invalid/cover").headers.Authorization,
    undefined,
  );
  assert.throws(() => {
    api = "http://10.0.0.102:70000";
    return instance.baseUrl;
  }, /port/);
  assert.throws(() => {
    api = "http://bad-userinfo@10.0.0.102:3000";
    return instance.baseUrl;
  }, /API URL/);

  api = "10.0.0.102:3000";
  const stamp = instance._serverStamp();
  instance._saveScopedList("categories", stamp, [{ id: "SET_0000000001", name: "Shelf" }]);
  const shown = instance.category.parts[0].loader();
  assert.equal(shown[0].label, "Shelf");

  api = "192.168.1.20:3000";
  assert.throws(() => instance.category.parts[0].loader(), /API settings/);

  await instance.search.load("nest", {}, 1);
  assert.equal(
    calls[0].url,
    "http://192.168.1.20:3000/api/search?filter=nest&sortby=title&order=asc&newonly=false&untaggedonly=false&groupby_tanks=true&start=0",
  );
  assert.equal(calls[0].headers.Accept, "application/json");
  assert.equal(calls[0].headers.Authorization, "Bearer c2VjcmV0");
});

test("lanraragi loads later tank pages before grouping a category", async () => {
  const repoRoot = path.resolve(__dirname, "../..");
  const source = fs.readFileSync(path.join(repoRoot, "dist/plugins/lanraragi.js"), "utf8");
  const calls = [];
  const tankA = "TANK_1793486766";
  const tankB = "TANK_1793486767";
  const first = "a".repeat(40);
  const second = "b".repeat(40);
  const context = createVeneraHostShim({
    Network: {
      get: async (url) => {
        const target = String(url);
        calls.push(target);
        if (target.includes("/api/search")) {
          return {
            status: 200,
            body: JSON.stringify({
              data: [
                { arcid: first, title: "Chapter 1", tags: "" },
                { arcid: second, title: "Chapter 2", tags: "" },
              ],
              recordsFiltered: 2,
            }),
          };
        }
        if (target.includes("page=1")) {
          return {
            status: 200,
            body: JSON.stringify({
              result: [{ id: tankA, name: "First", archives: [first] }],
              total: 2,
            }),
          };
        }
        if (target.includes("page=2")) {
          return {
            status: 200,
            body: JSON.stringify({
              result: [{ id: tankB, name: "Second", archives: [second] }],
              total: 2,
            }),
          };
        }
        return { status: 200, body: "{}" };
      },
    },
  });
  vm.runInContext(`${source}\nthis.__Ctor__=Lanraragi;`, context, {
    filename: "dist/plugins/lanraragi.js",
  });
  const instance = new context.__Ctor__();
  instance.loadSetting = () => "http://10.0.0.102:3000";
  const listed = await instance.categoryComics.load("SET_0000000001", null, [], 1);
  const ids = Array.from(listed.comics, (comic) => String(comic.id));
  assert.equal(ids.length, 2);
  assert.equal(ids[0], tankA);
  assert.equal(ids[1], tankB);
  assert.equal(calls.filter((url) => url.includes("/api/tankoubons")).length >= 2, true);
  assert.equal(calls.some((url) => url.includes("/api/archives/" + tankA)), false);
});

test("lanraragi explore feeds stay on the search api", async () => {
  const repoRoot = path.resolve(__dirname, "../..");
  const source = fs.readFileSync(path.join(repoRoot, "dist/plugins/lanraragi.js"), "utf8");
  const calls = [];
  const tank = "TANK_1793486619";
  const archive = "c".repeat(40);
  const context = createVeneraHostShim({
    Network: {
      get: async (url) => {
        const target = String(url);
        calls.push(target);
        if (target.includes("/api/tankoubons/" + tank)) {
          return {
            status: 200,
            body: JSON.stringify({ id: tank, name: "Grouped", archives: [archive] }),
          };
        }
        return {
          status: 200,
          body: JSON.stringify({
            data: [
              { arcid: archive, title: "One", tags: "", pagecount: 12, isnew: "true" },
              { arcid: tank, title: "Grouped", tags: "" },
            ],
            recordsFiltered: 2,
            recordsTotal: 2,
          }),
        };
      },
    },
  });
  vm.runInContext(`${source}\nthis.__Ctor__=Lanraragi;`, context, {
    filename: "dist/plugins/lanraragi.js",
  });
  const instance = new context.__Ctor__();
  instance.loadSetting = () => "http://10.0.0.102:3000";
  const titles = Array.from(instance.explore, (page) => page.title);
  assert.equal(titles.join(","), "Latest,New,Recently read,Random");

  const latest = await instance.explore[0].load(1);
  assert.equal(
    calls[0],
    "http://10.0.0.102:3000/api/search?sortby=date_added&order=desc&groupby_tanks=true&start=0",
  );
  assert.equal(String(latest.comics[0].subTitle), "12p · new");
  assert.equal(String(latest.comics[1].cover), "http://10.0.0.102:3000/api/archives/" + archive + "/thumbnail");
  assert.equal(calls.some((url) => url.includes("/api/tankoubons?")), false);

  calls.length = 0;
  await instance.explore[1].load(1);
  assert.equal(
    calls[0],
    "http://10.0.0.102:3000/api/search?sortby=date_added&order=desc&newonly=true&groupby_tanks=true&start=0",
  );

  calls.length = 0;
  await instance.explore[2].load(1);
  assert.equal(
    calls[0],
    "http://10.0.0.102:3000/api/search?sortby=lastread&order=desc&groupby_tanks=false&start=0",
  );

  calls.length = 0;
  const random = await instance.explore[3].load(2);
  assert.equal(random.maxPage, 1);
  assert.equal(
    calls[0],
    "http://10.0.0.102:3000/api/search/random?count=20&groupby_tanks=true",
  );
  assert.equal(calls.some((url) => url.includes("start=")), false);
});

test("lanraragi page jumps use the learned page size and a new query starts over", async () => {
  const repoRoot = path.resolve(__dirname, "../..");
  const source = fs.readFileSync(path.join(repoRoot, "dist/plugins/lanraragi.js"), "utf8");
  const calls = [];
  const context = createVeneraHostShim({
    Network: {
      get: async (url) => {
        calls.push(String(url));
        return {
          status: 200,
          body: JSON.stringify({
            data: [
              { arcid: "a".repeat(40), title: "A", tags: "" },
              { arcid: "b".repeat(40), title: "B", tags: "" },
            ],
            recordsFiltered: 6,
          }),
        };
      },
    },
  });
  vm.runInContext(`${source}\nthis.__Ctor__=Lanraragi;`, context, {
    filename: "dist/plugins/lanraragi.js",
  });
  const instance = new context.__Ctor__();
  const store = new Map();
  instance.loadSetting = () => "http://10.0.0.102:3000";
  instance.loadData = (key) => (store.has(key) ? store.get(key) : null);
  instance.saveData = (key, value) => store.set(key, value);

  await instance.explore[0].load(1);
  calls.length = 0;
  await instance.explore[0].load(3);
  assert.equal(calls.length, 1);
  assert.equal(
    calls[0],
    "http://10.0.0.102:3000/api/search?sortby=date_added&order=desc&groupby_tanks=true&start=4",
  );

  calls.length = 0;
  await instance.search.load("nest", { 0: "date_added", 1: "desc" }, 2);
  assert.equal(
    calls[0],
    "http://10.0.0.102:3000/api/search?filter=nest&sortby=date_added&order=desc&newonly=false&untaggedonly=false&groupby_tanks=true&start=0",
  );
  assert.equal(calls[1].includes("start=2"), true);
});

test("lanraragi refuses to favorite a tank", async () => {
  const repoRoot = path.resolve(__dirname, "../..");
  const source = fs.readFileSync(path.join(repoRoot, "dist/plugins/lanraragi.js"), "utf8");
  const calls = [];
  const context = createVeneraHostShim({
    Network: {
      get: async () => ({ status: 200, body: "{}" }),
      put: async (url) => {
        calls.push(String(url));
        return { status: 200, body: "" };
      },
      delete: async (url) => {
        calls.push(String(url));
        return { status: 200, body: "" };
      },
    },
  });
  vm.runInContext(`${source}\nthis.__Ctor__=Lanraragi;`, context, {
    filename: "dist/plugins/lanraragi.js",
  });
  const instance = new context.__Ctor__();
  instance.loadSetting = (key) => (key === "apiKey" ? "secret" : "http://10.0.0.102:3000");
  await assert.rejects(
    () => instance.favorites.addOrDelFavorite("TANK_1793486619", "SET_0000000001", true),
    /Cannot favorite a LANraragi tankoubon/,
  );
  assert.equal(calls.length, 0);
});

test("lanraragi refuses a truncated tank index", async () => {
  const repoRoot = path.resolve(__dirname, "../..");
  const source = fs.readFileSync(path.join(repoRoot, "dist/plugins/lanraragi.js"), "utf8");
  const context = createVeneraHostShim({
    Network: {
      get: async (url) => {
        const target = String(url);
        if (target.includes("/api/search")) {
          return {
            status: 200,
            body: JSON.stringify({
              data: [{ arcid: "a".repeat(40), title: "Chapter", tags: "" }],
              recordsFiltered: 1,
            }),
          };
        }
        if (target.includes("page=1")) {
          return {
            status: 200,
            body: JSON.stringify({
              result: [{ id: "TANK_1793486766", name: "Partial", archives: ["a".repeat(40)] }],
              total: 3,
            }),
          };
        }
        return { status: 200, body: JSON.stringify({ result: [], total: 3 }) };
      },
    },
  });
  vm.runInContext(`${source}\nthis.__Ctor__=Lanraragi;`, context, {
    filename: "dist/plugins/lanraragi.js",
  });
  const instance = new context.__Ctor__();
  instance.loadSetting = () => "http://10.0.0.102:3000";
  await assert.rejects(
    () => instance.categoryComics.load("SET_0000000001", null, [], 1),
    /tank index is incomplete/,
  );
});
