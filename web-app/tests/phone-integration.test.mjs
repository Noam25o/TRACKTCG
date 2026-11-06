import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {readFileSync,existsSync} from 'node:fs';
import {createScannerServer} from '../server.mjs';
import {loadManifest} from '../phone/loading.js';

test('embedded manifest resolves worker at the manifest origin and keeps the verified index identity',async t=>{
  const original=globalThis.fetch;let requested;
  t.after(()=>globalThis.fetch=original);
  const worker='worker.'+'a'.repeat(64)+'.js',sha256='b'.repeat(64);
  const asset={file:`index-EN.${sha256}.json`,sha256};
  globalThis.fetch=async url=>{requested=String(url);return {ok:true,json:async()=>({cacheVersion:1,assets:{worker:{file:worker}},languages:{EN:asset}})};};
  const version=await loadManifest('EN',undefined,new URL('https://scanner.example/manifest.json'));
  assert.equal(requested,'https://scanner.example/manifest.json');
  assert.equal(version.worker,'https://scanner.example/'+worker);assert.deepEqual(version.asset,asset);
});

test('main app serves the phone runtime behind its own authentication without enabling uploads',async t=>{
  if(!existsSync(new URL('../phone/dist/manifest.json',import.meta.url)))return t.skip('Build required');
  const {server}=createScannerServer({token:'integrated-test',fetchImpl:()=>assert.fail('no upstream required')});
  server.listen(0,'127.0.0.1');await once(server,'listening');
  t.after(()=>{server.closeAllConnections();server.close();});
  const base=`http://127.0.0.1:${server.address().port}`,headers={Cookie:'scanner_access=integrated-test'};
  const manifest=JSON.parse(readFileSync(new URL('../phone/dist/manifest.json',import.meta.url)));
  for(const path of ['/phone/app.js','/phone/loading.js','/manifest.json','/'+manifest.assets.worker.file,'/'+manifest.languages.EN.file]){
    assert.equal((await fetch(base+path)).status,401,path);
    const response=await fetch(base+path,{headers});assert.equal(response.status,200,path);
    assert.match(response.headers.get('content-security-policy'),/wasm-unsafe-eval/);
  }
  const compressed=await fetch(base+'/phone/'+manifest.languages.EN.file,{method:'HEAD',headers:{...headers,'Accept-Encoding':'br'}});
  assert.equal(compressed.status,200);assert.equal(compressed.headers.get('content-length'),String(manifest.languages.EN.brBytes));
  for(const path of ['/phone/serve.mjs','/phone/build.mjs','/phone/.env','/phone/'+manifest.languages.EN.file+'.br']){
    assert.equal((await fetch(base+path,{headers})).status,404,path);
  }
  assert.equal((await fetch(base+'/api/visual/recognize',{method:'POST',headers,body:'pixels'})).status,405);
  assert.equal((await fetch(base+'/phone/app.js',{method:'POST',headers,body:'pixels'})).status,405);
});
