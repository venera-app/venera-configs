const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
function source(file, extras = {}) {
  class ComicSource { loadData() { return null; } loadSetting(k) { return this.settings?.[k]?.default; } saveData() {} deleteData() {} }
  const ctx = {ComicSource, APP:{version:'1.6.0',locale:'zh_CN'}, console, Network:{}, ...extras};
  vm.createContext(ctx);
  const text = fs.readFileSync(path.join(__dirname,'..',file),'utf8');
  const name = text.match(/class (\w+) extends ComicSource/)[1];
  vm.runInContext(text + `;globalThis.source=new ${name}();globalThis.Source=${name};`,ctx);
  return ctx;
}
test('CopyManga preserves retry loop and upstream request lifecycle',async()=>{
  let attempts=0; const c=source('copy_manga.js',{Network:{get:async()=>{attempts++;if(attempts===1)throw Error('transient');return {status:200};}}});
  let cleaned=0;c.source.afterRequest=()=>cleaned++;
  assert.equal((await c.source.getWithRetry('https://example.com', {})).status,200);
  assert.equal(attempts,2);assert.equal(cleaned,2);
  assert.equal(c.source.settings.auto_clear_device_info.default,false);
});
test('CopyManga retains validated discovery instead of overwriting setting shape',async()=>{
  const calls=[];const c=source('copy_manga.js',{fetch:async(url,opts)=>{calls.push([url,opts]);return url.includes('/system/network2')?{status:200,json:async()=>({results:{api:[['unrelated.example'],['api.copy-manga.com']]}})}:{status:200,json:async()=>({code:200})};}});
  Object.defineProperty(c.source,'headers',{value:{'User-Agent':'fixture',Authorization:'fixture-private'}});
  let cleaned=0;c.source.afterRequest=()=>cleaned++;
  await c.source.refreshAppApi();
  assert.equal(calls.length,2);assert.equal(calls[1][0],'https://api.copy-manga.com/api/v3/h5/homeIndex');
  assert.equal(calls[0][1],undefined);
  assert.equal(calls[1][1],undefined);
  assert.equal(c.source.settings.base_url.default,'api.copy-manga.com');
  assert.equal(typeof c.source.settings.base_url,'object');assert.equal(cleaned,1);
});
test('ComicWalker retains fork app-version parsing and upstream deferred token error',async()=>{
  const c=source('comic_walker.js',{Network:{get:async()=>({status:200,body:JSON.stringify({results:[{version:'1.8.0'}]})})}});
  c.source.refreshToken=async()=>{throw Error('offline fixture');};
  await c.source.init();assert.equal(c.source.latestVersion,'1.8.0');
  c.Network.get=async()=>({status:200,body:JSON.stringify({results:[{version:'1.0.0'}]})});
  await c.source.init();assert.equal(c.source.latestVersion,'1.8.0');
});
test('Wnacg combines dynamic upstream options with fork domain customizations',()=>{
  const c=source('wnacg.js');
  assert.equal(c.Source.domains[0],'www.wn10.cfd');
  assert.equal(c.source.settings.domain0.default,'www.wn06.cfd');
  c.Source.domains.push('fixture.example');
  const options=c.source.settings.domainSelection.options;
  assert.equal(options.length,c.Source.domains.length+1);
  assert.equal(options.at(-1).text,'fixture.example');
});
test('Merged source index keeps removals, gains two upstream sources, and matches versions',()=>{
  const index=JSON.parse(fs.readFileSync(path.join(__dirname,'..','index.json'),'utf8'));
  assert.equal(index.some(x=>x.key==='happy'),false);
  for(const key of ['mycomic','copy_manga_multi_accounts'])assert.ok(index.some(x=>x.key===key));
  for(const file of ['comic_walker.js','copy_manga.js','wnacg.js','manwaba.js','jcomic.js'])assert.equal(source(file).source.version,index.find(x=>x.fileName===file).version);
});
