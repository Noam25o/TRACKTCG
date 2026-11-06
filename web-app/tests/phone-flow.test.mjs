import test from 'node:test';
import assert from 'node:assert/strict';

test('phone app auto-capture lifecycle with synthetic camera and worker',async t=>{
  const originals=new Map(),elements=new Map(),events=new Map(),timers=new Map();
  let now=0,timerId=0,stops=0,scans=0,track=null,permission=null,activeWorker=null;
  const rgba=Uint8ClampedArray.from({length:64*88*4},(_,i)=>i%4===3?255:(Math.floor(i/4)%2?220:30));
  const context={drawImage(){},clearRect(){},getImageData(x,y,w,h){return {width:w,height:h,data:w===64?rgba:new Uint8ClampedArray(w*h*4)};}};
  const node=()=>({hidden:false,disabled:false,value:'',textContent:'',dataset:{},width:0,height:0,files:[],children:[],replaceChildren(){this.children=[];},append(child){this.children.push(child);},getContext(){return context;},async play(){},readyState:2,videoWidth:1280,videoHeight:720});
  for(const id of ['photo','camera','video','preview','capture','stop','load','scan','status','results','metrics','language','guide','guide-status','camera-stage','camera-help','auto','retry-auto','auto-diagnostics','cache-info'])elements.set(id,node());
  elements.get('language').value='JP';elements.get('auto').checked=true;
  function override(key,value){originals.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,configurable:true,writable:true});}
  override('document',{hidden:false,getElementById:id=>elements.get(id),createElement:()=>node(),addEventListener:(name,fn)=>events.set(name,fn)});
  override('window',{addEventListener:(name,fn)=>events.set(name,fn)});
  override('navigator',{userAgent:'synthetic-test',mediaDevices:{async getUserMedia(){if(permission)return permission;track={stop(){stops++;}};return {getTracks:()=>[track]};}}});
  override('performance',{now:()=>now});
  override('fetch',async()=>({ok:true,json:async()=>({cacheVersion:1,assets:{worker:{file:'worker.'+'a'.repeat(64)+'.js'}},languages:{JP:{file:'index-JP.'+'b'.repeat(64)+'.json',sha256:'b'.repeat(64)}}})}));
  override('setTimeout',(fn,delay)=>{const id=++timerId;timers.set(id,{fn,delay});return id;});
  override('clearTimeout',id=>timers.delete(id));
  override('Worker',class {
    constructor(){activeWorker=this;this.terminated=false;}
    terminate(){this.terminated=true;}
    postMessage(data){
      if(data.action==='scan'){scans++;this.pending=data;return;}
      queueMicrotask(()=>this.onmessage({data:{id:data.id,result:{indexed:666,wasmBytes:134217728}}}));
    }
    finish(found=true){const data=this.pending;this.onmessage({data:{id:data.id,result:{candidates:found?[{card:{name:'Pikachu',number:'001',setCode:'SV-P',language:'JP'}}]:[],milliseconds:500,indexed:666}}});}
  });
  t.after(()=>{for(const [key,descriptor] of originals){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}});
  const {mountPhoneScanner}=await import('../phone/app.js');
  const el=id=>elements.get(id),flush=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
  async function tick(delay){const entry=[...timers].find(([,timer])=>timer.delay===delay);assert.ok(entry,'timer '+delay+' exists');timers.delete(entry[0]);now+=delay;void entry[1].fn();await flush();}

  await t.test('auto starts without stability gating, accepts a match then closes the camera',async()=>{
    await el('load').onclick();await el('camera').onclick();
    await tick(1000);assert.equal(scans,1);assert.equal(stops,0,'camera stays live until a result');
    assert.equal(activeWorker.pending.width,443);assert.equal(activeWorker.pending.height,619);
    assert.equal(activeWorker.pending.framed,true);
    await el('scan').onclick();assert.equal(scans,1,'only one inference at a time');
    activeWorker.finish();await flush();
    assert.equal(stops,1);assert.equal(el('camera-stage').hidden,true);
    assert.equal(el('results').children.length,1);assert.match(el('metrics').textContent,/Auto/);
    assert.equal(el('preview').width,0);assert.equal(timers.size,0);
  });
  await t.test('an unknown frame retries the full sensor then waits before the next attempt',async()=>{
    await el('camera').onclick();await tick(1000);const before=scans;
    activeWorker.finish(false);await flush();
    assert.equal(scans,before+1);assert.equal(activeWorker.pending.width,1280);assert.equal(activeWorker.pending.height,720);
    assert.equal(activeWorker.pending.framed,false);
    activeWorker.finish(false);await flush();
    assert.equal(el('camera-stage').hidden,false);assert.ok([...timers.values()].some(v=>v.delay===900));
    await tick(900);activeWorker.finish();await flush();
    assert.equal(el('camera-stage').hidden,true);assert.equal(timers.size,0);
  });
  await t.test('manual analysis retains full-sensor fallback and stops tracks immediately',async()=>{
    el('auto').checked=false;await el('camera').onclick();const before=stops;
    const pending=el('scan').onclick();assert.equal(stops,before+1);
    activeWorker.finish(false);await flush();assert.equal(activeWorker.pending.width,1280);
    activeWorker.finish();await pending;
    assert.match(el('metrics').textContent,/cadre puis image complète/);assert.equal(timers.size,0);
  });
  await t.test('background cancels an in-flight job and ignores a late response',async()=>{
    el('auto').checked=true;await el('camera').onclick();await tick(1000);
    document.hidden=true;events.get('visibilitychange')();await flush();
    assert.equal(activeWorker.terminated,true);assert.equal(el('capture').hidden,true);
    activeWorker.finish();await flush();assert.equal(timers.size,0);document.hidden=false;
  });
  await t.test('late permission after stop closes its stream without opening preview',async()=>{
    await el('load').onclick();let resolve;permission=new Promise(r=>{resolve=r;});
    const opening=el('camera').onclick();el('stop').onclick();const before=stops;
    resolve({getTracks:()=>[{stop(){stops++;}}]});await opening;permission=null;
    assert.equal(stops,before+1);assert.equal(el('camera-stage').hidden,true);
  });
  await t.test('unknown scenes stop after ten attempts and expose explicit retry',async()=>{
    await el('load').onclick();await el('camera').onclick();
    for(let i=0;i<10;i++){
      await tick(i===0?1000:900);
      activeWorker.finish(false);await flush();activeWorker.finish(false);await flush();
    }
    assert.equal(el('retry-auto').hidden,false);assert.equal(timers.size,0);
    el('retry-auto').onclick();assert.equal(el('retry-auto').hidden,true);
    el('language').onchange();assert.equal(timers.size,0);
  });
  await t.test('missing video times out and a pixel read failure stops the camera',async()=>{
    await el('load').onclick();await el('camera').onclick();el('video').readyState=1;
    await tick(1000);now+=25001;await tick(250);
    assert.equal(el('retry-auto').hidden,false);
    el('video').readyState=2;el('retry-auto').onclick();
    const read=context.getImageData;context.getImageData=()=>{throw Error('synthetic pixel read failure');};
    await tick(1000);context.getImageData=read;
    assert.equal(el('camera-stage').hidden,true);assert.match(el('auto-diagnostics').textContent,/synthetic pixel read failure/);
    assert.equal(timers.size,0);el('stop').onclick();
  });
  await t.test('embedded scanner isolates its controls and opens the exact proposed card',async()=>{
    const selected=[],cameraStates=[];
    for(const id of [...elements.keys()])elements.set('phone-'+id,node());
    el('phone-language').value='EN';el('phone-auto').checked=true;
    // The manifest is shared at the origin root so cached index URLs survive
    // the move from the lab to the integrated application.
    const previousFetch=globalThis.fetch;
    globalThis.fetch=async()=>({ok:true,json:async()=>({cacheVersion:1,assets:{worker:{file:'worker.'+'a'.repeat(64)+'.js'}},languages:{EN:{file:'index-EN.'+'b'.repeat(64)+'.json',sha256:'b'.repeat(64)}}})});
    const scanner=mountPhoneScanner({prefix:'phone-',onFound:card=>selected.push(card.id),onCameraChange:active=>cameraStates.push(active),manifestUrl:new URL('https://scanner.example/manifest.json')});
    await scanner.openCamera();await tick(1000);
    const job=activeWorker.pending;
    activeWorker.onmessage({data:{id:job.id,result:{candidates:[{card:{id:'tcgdex:EN:swsh3-2',name:'Butterfree VMAX',number:'2',setCode:'swsh3',language:'EN'}}],milliseconds:1200,indexed:667}}});
    await flush();
    assert.equal(el('phone-results').children.length,0);
    assert.equal(el('phone-camera-stage').hidden,true);
    assert.deepEqual(selected,['tcgdex:EN:swsh3-2']);
    assert.deepEqual(cameraStates.slice(0,2),[true,false]);
    await el('phone-camera').onclick();await tick(1000);scanner.stop();activeWorker.finish();await flush();
    assert.equal(activeWorker.terminated,true);assert.equal(el('phone-capture').hidden,true);assert.equal(timers.size,0);
    globalThis.fetch=previousFetch;
  });
});
