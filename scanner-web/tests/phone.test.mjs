import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {readFileSync,existsSync} from 'node:fs';
import {createPhoneServer} from '../phone/serve.mjs';
import '../phone/engine.js';
test('phone index validates language, duplicate identities and descriptor lengths',()=>{
  const item={card:{id:'example',language:'JP'},points:Buffer.from(new Float32Array([10,20]).buffer).toString('base64'),descriptors:Buffer.alloc(32).toString('base64'),hash:Array(63).fill(false)};
  const index={format:'tracktcg.orb.v1',entries:[item]};
  assert.equal(TcgPhone.unpack(index,'JP').length,1);
  assert.throws(()=>TcgPhone.unpack(index,'FR'));
  assert.throws(()=>TcgPhone.unpack({...index,entries:[item,item]},'JP'));
  assert.throws(()=>TcgPhone.unpack({...index,entries:[{...item,descriptors:''}]},'JP'));
});
test('phone hash has 63 bits and zero self distance',()=>{
  const hash=TcgPhone.phash(Uint8Array.from({length:1024},(_,i)=>(i*17)%251));
  assert.equal(hash.length,63);assert.equal(TcgPhone.distance(hash,hash),0);
  assert.equal(TcgPhone.distance(hash,hash.map(x=>!x)),63);
});
test('phone preview is authenticated, static-only and never accepts an upload',async t=>{
  const {server}=createPhoneServer({token:'test-phone'});server.listen(0,'127.0.0.1');await once(server,'listening');
  t.after(()=>{server.closeAllConnections();server.close();});
  const base=`http://127.0.0.1:${server.address().port}`,headers={Cookie:'phone_access=test-phone'};
  assert.equal((await fetch(base)).status,401);
  const login=await fetch(base+'/?access=test-phone',{redirect:'manual'});assert.equal(login.status,303);assert.match(login.headers.get('set-cookie'),/HttpOnly; SameSite=Lax/);
  for(const path of ['/api/visual/recognize','/engine.py','/../.env','/visual/data/index.json'])assert.equal((await fetch(base+path,{headers})).status,404);
  assert.equal((await fetch(base,{method:'POST',headers,body:'image'})).status,405);
  const response=await fetch(base,{headers});
  if(existsSync(new URL('../phone/dist/index.html',import.meta.url))){assert.equal(response.status,200);assert.match(await response.text(),/Scanner sans serveur/);}
  else {assert.equal(response.status,503);assert.match(await response.text(),/phone:build/);}
  assert.doesNotMatch(response.headers.get('content-security-policy'),/'unsafe-eval'/);
});
test('phone code has no photo upload, fallback to PC, or photo persistence',()=>{
  const worker=readFileSync(new URL('../phone/worker.js',import.meta.url),'utf8'),app=readFileSync(new URL('../phone/app.js',import.meta.url),'utf8');
  assert.doesNotMatch(app+worker,/\/api\/|sendBeacon|localStorage|indexedDB|method\s*:\s*['"]POST/);
  assert.match(app,/worker\?\.terminate\(\)/);assert.match(app,/visibilitychange/);assert.match(app,/getTracks\(\)\.forEach\(t=>t.stop\(\)\)/);
});
