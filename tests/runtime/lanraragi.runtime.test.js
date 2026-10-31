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
  assert.equal(instance.version, "1.2.1");
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
          return { status: 200, body: JSON.stringify({ pages: ["/page/1.jpg"] }) };
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
  assert.equal(listed.comics[0].cover, "");
  assert.equal(calls.some((url) => url.includes("/api/archives/" + tank)), false);

  const info = await instance.comic.loadInfo(tank);
  assert.equal(info.chapters[archive], "Chapter a");
  assert.equal(info.chapters instanceof Map, false);
  assert.equal(calls.some((url) => url.includes("/api/archives/" + tank)), false);

  const episode = await instance.comic.loadEp(tank, archive);
  assert.equal(episode.images.length, 1);
  assert.ok(calls.some((url) => url.includes("/api/archives/" + archive + "/files")));
});
