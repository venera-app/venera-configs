// Offline regression tests. Run: node --test tests/source-regressions.cjs
const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const crypto = require('node:crypto');
const path = require('node:path');
function load(file, network = {}) {
  class ComicSource {
    loadSetting(key) { return this.settings?.[key]?.default; }
    loadData() { return null; }
    saveData() {}
  }
  class Model { constructor(data) { Object.assign(this, data); } }
  const context = {ComicSource, Comic: Model, ComicDetails: Model,
    Network: network, randomInt: (a) => a, APP: {version: '1.6.0', locale: 'zh_CN'}, log() {}, console,
    Convert: {
      encodeUtf8: (value) => new Uint8Array(Buffer.from(value, 'utf8')),
      hmacString: (key, data, algorithm) => crypto.createHmac(algorithm, Buffer.from(key)).update(Buffer.from(data)).digest('hex'),
      decodeBase64: (value) => new Uint8Array(Buffer.from(value, 'base64')),
      decodeUtf8: (value) => Buffer.from(value).toString('utf8'),
    }};
  vm.createContext(context);
  const code = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  const className = code.match(/class (\w+) extends ComicSource/)[1];
  vm.runInContext(code + `;globalThis.source = new ${className}();`, context);
  return context;
}

test('Manwaba sends real pagination/filter payload and uses server totals', async () => {
  const calls = [];
  const c = load('manwaba.js', {sendRequest: async (...args) => {
    calls.push(args);
    return {status: 200, body: JSON.stringify({code: 200, data: {total: 73, list: [
      {url: '/comic/123', title: 'Fixture', pic: 'https://example.com/cover.jpg', tags: '热血,奇幻'},
    ]}})};
  }});
  c.source.init();
  let result = await c.source.categoryComics.load('热血', '热血', ['1', '2', '3'], 2);
  assert.equal(calls[0][0], 'POST');
  assert.equal(calls[0][1], 'https://manwaxu.cc/api/cate/hotblooded');
  assert.equal(calls[0][2]['Content-Type'], 'application/json');
  const p = JSON.parse(calls[0][3]);
  assert.deepEqual(p.page, {page: 2, pageSize: 36});
  assert.deepEqual(p.comic, {status: 1, day: 2, tag: '热血', level: 0, areaId: 0});
  assert.equal(p.sort, 3);
  assert.equal(result.maxPage, 3);
  assert.equal(result.comics[0].id, '123');
  assert.deepEqual(Array.from(result.comics[0].tags), ['热血', '奇幻']);
  await c.source.categoryComics.load('全部', '', ['2', '0', '0'], 1);
  assert.equal(JSON.parse(calls[1][3]).comic.status, -1);
  assert.equal(calls[1][1], 'https://manwaxu.cc/api/cate');
});

test('Manwaba surfaces API failures instead of parsing a missing list', async () => {
  const c = load('manwaba.js', {sendRequest: async () => ({status: 200, body: '{"code":503,"message":"fixture unavailable"}'})});
  c.source.init();
  await assert.rejects(c.source.categoryComics.load('', '', [], 1), /fixture unavailable/);
});

test('JComic decodes the public lazy-image format while preserving plain URLs', async () => {
  const c = load('jcomic.js', {get: async () => ({status: 200, body: 'fixture'})});
  const url = 'https://example.com/page.jpg?expires=123&signature=fixture';
  const locked = 'JCOMIC_TRAPS_' + Buffer.from(url).toString('base64').split('').reverse().join('');
  const attrs = [{src: 'https://example.com/plain.jpg'}, {src: '', 'data-locked': locked}];
  c.HtmlDocument = class { querySelectorAll() { return attrs.map(attributes => ({attributes})); } };
  const images = (await c.source.comic.loadEp('fixture', '1')).images;
  assert.deepEqual(Array.from(images), ['https://example.com/plain.jpg', url]);
  attrs[1]['data-locked'] = 'JCOMIC_TRAPS_' + Buffer.from('javascript:fixture').toString('base64').split('').reverse().join('');
  await assert.rejects(c.source.comic.loadEp('fixture', '1'), /章节图片地址解析失败/);
});

test('CopyManga exposes HTTP status and denial message, not an undefined res', async () => {
  const c = load('copy_manga.js', {get: async (url) => url.endsWith('/query')
    ? {status: 200, body: '{"results":{"collect":null}}'}
    : {status: 210, body: '{"message":"fixture restriction"}'}});
  c.source.getReqID = async () => '';
  await assert.rejects(c.source.comic.loadInfo('fixture'), err => String(err).includes('210') && String(err).includes('fixture restriction') && !String(err).includes('ReferenceError'));
});

test('Index versions agree with all repaired sources', () => {
  const index = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'index.json'), 'utf8'));
  for (const file of ['manwaba.js', 'jcomic.js', 'copy_manga.js']) {
    assert.equal(load(file).source.version, index.find(x => x.fileName === file).version);
  }
});

test('Manga1234 follows the current site, parses comic IDs, and reads new reader chapters', async () => {
  const calls = [];
  const c = load('mh1234.js', {get: async url => {
    calls.push(url);
    return {status: 200, body: url.includes('reader.hqread.cc') ? 'reader' : 'fixture'};
  }});
  c.HtmlDocument = class {
    constructor(html) { this.html = html; }
    querySelectorAll(selector) {
      if (this.html === 'reader' && selector === 'img.reader-image') {
        return [{attributes: {'data-src': 'https://cdn.example/page.jpg?sig=abc'}}];
      }
      return [];
    }
    querySelector() { return null; }
  };
  assert.equal(c.source.baseUrl, 'https://www.wmh1234.com');
  const card = {
    attributes: {},
    querySelector(selector) {
      if (selector === "a[href*='/comic/']" || selector === 'a') return {attributes: {href: '/comic/9683.html'}};
      if (selector === 'img') return {attributes: {'data-original': 'https://cdn.example/cover.jpg'}};
      if (selector === '.comic-title' || selector === 'h3') return {text: '测试漫画'};
      return null;
    },
  };
  const comics = c.source.parseList({querySelectorAll: selector => selector === '.comic-card' ? [card] : []});
  assert.equal(comics[0].id, '9683');
  assert.equal(comics[0].title, '测试漫画');
  assert.equal(comics[0].cover, 'https://cdn.example/cover.jpg');
  const images = await c.source.comic.loadEp('9683', 'go:chapter-token');
  assert.deepEqual(Array.from(images.images), ['https://cdn.example/page.jpg?sig=abc']);
  assert.equal(calls[0], 'https://reader.hqread.cc/r/chapter-token');
});

test('Manga1234 search uses the redesigned site endpoint and encodes its keyword', async () => {
  const calls = [];
  const c = load('mh1234.js', {get: async url => {
    calls.push(url);
    return {status: 200, body: 'fixture'};
  }});
  c.HtmlDocument = class { querySelectorAll() { return []; } querySelector() { return null; } };
  await c.source.search.load('斗罗 大陆', [], 2);
  assert.equal(calls[0], 'https://www.wmh1234.com/index.php/search?key=%E6%96%97%E7%BD%97%20%E5%A4%A7%E9%99%86&page=2');
});

test('Baozi defaults to a live compatible mirror and keeps source/index versions aligned', async () => {
  const calls = [];
  const c = load('baozi.js', {get: async url => {
    calls.push(url);
    return {status: 200, body: JSON.stringify({items: [{comic_id: '42', name: 'fixture', topic_img: 'cover.jpg'}], next: false})};
  }});
  assert.equal(c.source.baseUrl, 'https://cn.webmota.com');
  const result = await c.source.categoryComics.load('全部', 'all', ['all', 'all'], 1);
  assert.match(calls[0], /^https:\/\/cn\.webmota\.com\/api\/bzmhq\/amp_comic_list/);
  assert.equal(result.comics[0].id, '42');
  const index = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'index.json'), 'utf8'));
  assert.equal(c.source.version, index.find(x => x.fileName === 'baozi.js').version);
});
