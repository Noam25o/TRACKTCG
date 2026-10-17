import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto,createHash} from 'node:crypto';
import {once} from 'node:events';
import {readFileSync,existsSync} from 'node:fs';
import {createPhoneServer,encodingFor} from '../phone/serve.mjs';
import '../phone/asset-cache.js';
const base='https://scanner.example/phone/worker.js';
function fixture(value=1,language='JP'){
  const bytes=Buffer.from(JSON.stringify({value})),sha256=createHash('sha256').update(bytes).digest('hex');
  return {bytes,asset:{file:`index-${language}.${sha256}.json`,bytes:bytes.length,sha256}};
}
function memory(){
  const stores=new Map();
  return {stores,async open(name){if(!stores.has(name))stores.set(name,new Map());const data=stores.get(name);return {
    async match(key){return data.get(key)?.clone();},async put(key,response){data.set(key,response.clone());},
    async keys(){return [...data.keys()].map(url=>({url}));},async delete(key){return data.delete(typeof key==='string'?key:key.url);}
  };}};
}
test('reference cache avoids a second download and verifies content',async()=>{
  const {bytes,asset}=fixture(),storage=memory();let requests=0;
  const options={base,storage,crypto:webcrypto,fetch:async()=>{requests++;return new Response(bytes);}};
  const cold=await TcgReferenceCache.read(asset,'JP',options),warm=await TcgReferenceCache.read(asset,'JP',options);
  assert.equal(cold.source,'network');assert.equal(warm.source,'cache');assert.equal(requests,1);assert.deepEqual(warm.index,{value:1});
});
test('new version replaces only the old version of the same language',async()=>{
  const storage=memory();let requests=0;
  for(const [value,language] of [[1,'JP'],[1,'FR'],[2,'JP']]){
    const {bytes,asset}=fixture(value,language);
    await TcgReferenceCache.read(asset,language,{base,storage,crypto:webcrypto,fetch:async()=>{requests++;return new Response(bytes);}});
  }
  assert.equal(requests,3);assert.equal(storage.stores.size,2);
  assert.equal(storage.stores.get('tracktcg-phone-references-v1-JP').size,1);
  assert.equal(storage.stores.get('tracktcg-phone-references-v1-FR').size,1);
});
test('damaged cache is redownloaded, corrupt or unauthorized network data is refused',async()=>{
  const {bytes,asset}=fixture(),storage=memory(),url=new URL('./'+asset.file,base).href;
  const cache=await storage.open('tracktcg-phone-references-v1-JP');await cache.put(url,new Response('bad'));
  let requests=0;const result=await TcgReferenceCache.read(asset,'JP',{base,storage,crypto:webcrypto,fetch:async()=>{requests++;return new Response(bytes);}});
  assert.equal(result.source,'network');assert.equal(requests,1);
  for(const response of [new Response(Buffer.alloc(bytes.length,0)),new Response('denied',{status:401}),new Response('x'.repeat(bytes.length+1))]){
    await assert.rejects(TcgReferenceCache.read(asset,'JP',{base,storage:memory(),crypto:webcrypto,fetch:async()=>response}));
  }
});
test('disabled storage or quota exhaustion does not prevent recognition loading',async()=>{
  const {bytes,asset}=fixture();
  for(const storage of [{open(){throw Error('SecurityError');}},{async open(){return {async match(){},async put(){throw Error('QuotaExceededError');}};}}]){
    const result=await TcgReferenceCache.read(asset,'JP',{base,storage,crypto:webcrypto,fetch:async()=>new Response(bytes)});
    assert.equal(result.cacheAvailable,false);assert.deepEqual(result.index,{value:1});
  }
});
test('only exact versioned index names are accepted, never photos or remote URLs',async()=>{
  const {asset}=fixture();
  for(const file of ['photo.jpg','https://other.example/index.json','../index-JP.json','index-FR.'+asset.sha256+'.json']){
    await assert.rejects(TcgReferenceCache.read({...asset,file},'JP',{base,fetch:()=>assert.fail('must not fetch')}));
  }
});
test('encoding negotiation respects explicit refusal and quality order',()=>{
  assert.equal(encodingFor('gzip, br'),'br');assert.equal(encodingFor('br;q=0, gzip'),'gzip');
  assert.equal(encodingFor('br;q=0.2,gzip;q=0.8'),'gzip');assert.equal(encodingFor('identity'),null);
  assert.equal(encodingFor('br;q=0,gzip;q=0,*;q=1'),null);
});
test('versioned static files are authenticated, compressed and safely cacheable',async t=>{
  if(!existsSync(new URL('../phone/dist/manifest.json',import.meta.url)))return t.skip('Build required');
  const manifest=JSON.parse(readFileSync(new URL('../phone/dist/manifest.json',import.meta.url)));
  if(manifest.cacheVersion!==1)return t.skip('New build required');
  const {server}=createPhoneServer({token:'cache-test'});server.listen(0,'127.0.0.1');await once(server,'listening');
  t.after(()=>{server.closeAllConnections();server.close();});
  const root=`http://127.0.0.1:${server.address().port}/`,headers={Cookie:'phone_access=cache-test'};
  const runtime=manifest.assets.runtime;
  assert.equal((await fetch(root+runtime.file)).status,401);
  for(const encoding of ['br','gzip','identity']){
    const response=await fetch(root+runtime.file,{headers:{...headers,'Accept-Encoding':encoding}});
    assert.equal(response.headers.get('content-encoding'),encoding==='identity'?null:encoding);
    assert.match(response.headers.get('cache-control'),/private.*immutable/);
    assert.equal(createHash('sha256').update(Buffer.from(await response.arrayBuffer())).digest('hex'),runtime.sha256);
    const notModified=await fetch(root+runtime.file,{headers:{...headers,'Accept-Encoding':encoding,'If-None-Match':response.headers.get('etag')}});
    assert.equal(notModified.status,304);
  }
  const index=await fetch(root+manifest.languages.JP.file,{method:'HEAD',headers:{...headers,'Accept-Encoding':'br'}});
  assert.equal(index.headers.get('content-length'),String(manifest.languages.JP.brBytes));assert.match(index.headers.get('cache-control'),/no-store/);
  assert.match((await fetch(root+'manifest.json',{headers})).headers.get('cache-control'),/no-store/);
  assert.equal((await fetch(root+runtime.file+'.br',{headers})).status,404);
});
