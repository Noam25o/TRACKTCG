import {guideRect} from './framing.js';
import {loadManifest} from './loading.js';
const $=id=>document.getElementById(id);
let worker=null,stream=null,loaded=false,pixels=null,sequence=0,generation=0,analyzing=false;
let autoTimer=null,cameraSession=0;
let manifestController=null;
const jobs=new Map();
function busy(value){$('photo').disabled=value;$('camera').disabled=value;}
function stopAutomatic(){clearTimeout(autoTimer);autoTimer=null;$('guide').dataset.state='';$('retry-auto').hidden=true;}
function stopCamera(){cameraSession++;stopAutomatic();stream?.getTracks().forEach(t=>t.stop());stream=null;$('video').srcObject=null;$('video').hidden=true;$('camera-stage').hidden=true;$('camera-help').hidden=true;}
function clearPixels(){pixels=null;$('preview').width=$('preview').height=0;$('preview').hidden=true;$('photo').value='';}
function stop(){generation++;manifestController?.abort();manifestController=null;worker?.terminate();worker=null;loaded=false;analyzing=false;stopCamera();clearPixels();busy(false);for(const job of jobs.values()){clearTimeout(job.timer);job.reject(Error('Analyse arrêtée'));}jobs.clear();$('capture').hidden=true;$('stop').hidden=true;$('load').disabled=false;$('scan').disabled=true;}
function request(action,data={},transfer=[]){return new Promise((resolve,reject)=>{const id=++sequence;const timer=setTimeout(()=>{stop();$('status').textContent='Délai dépassé. Le moteur a été arrêté.';},60000);jobs.set(id,{resolve,reject,timer});worker.postMessage({id,action,...data},transfer);});}
$('load').onclick=async()=>{
  stop();const run=generation,start=performance.now();$('results').replaceChildren();$('metrics').textContent='';$('load').disabled=true;$('stop').hidden=false;$('status').textContent='Chargement local du moteur et de l’index…';
  try{
    const language=$('language').value,controller=new AbortController();manifestController=controller;
    const timer=setTimeout(()=>controller.abort(),15000);let version;
    try{version=await loadManifest(language,controller.signal);}finally{clearTimeout(timer);}
    if(run!==generation)return;manifestController=null;
    worker=new Worker(version.worker);worker.onerror=event=>{if(run!==generation)return;stop();$('status').textContent='Initialisation impossible : '+(event.message||'WebAssembly indisponible');};worker.onmessage=({data})=>{if(run!==generation)return;const job=jobs.get(data.id);if(!job)return;if(data.progress){$('status').textContent=data.progress;return;}jobs.delete(data.id);clearTimeout(job.timer);data.error?job.reject(Error(data.error)):job.resolve(data.result);};
    const result=await request('init',{language,asset:version.asset});if(run!==generation)return;
    loaded=true;$('capture').hidden=false;$('status').textContent=result.indexed+' références prêtes. La photo restera ici.';$('metrics').textContent='Chargement : '+Math.round(performance.now()-start)+' ms\nMémoire WASM réservée : '+(result.wasmBytes?Math.round(result.wasmBytes/1048576)+' Mio':'non mesurée')+' (pas la mémoire totale)\n'+navigator.userAgent;
    $('cache-info').textContent=result.referenceSource==='cache'?'Références '+language+' : cache local vérifié, aucun téléchargement de l’index.':result.cacheAvailable?'Références '+language+' téléchargées et conservées pour les prochaines visites.':'Références chargées. Cache indisponible : prochain téléchargement nécessaire.';
    $('metrics').textContent+='\nRéférences : '+(result.referenceSource==='cache'?'cache local vérifié':'réseau')+' · CACHE 1';
  }catch(error){if(run===generation){stop();$('status').textContent=error.message;}}
};
$('language').onchange=()=>{stop();$('results').replaceChildren();$('status').textContent='Recharge le moteur pour cette langue.';};
$('stop').onclick=()=>{stop();$('status').textContent='Caméra et moteur arrêtés.';};
function startAutomatic(){
  stopAutomatic();if(!stream||!loaded||analyzing)return;
  if(!$('auto').checked){$('guide-status').textContent='Aligne la carte puis appuie sur Analyser';$('auto-diagnostics').textContent='AUTO 3 · mode manuel';return;}
  const session=cameraSession,started=performance.now();let attempts=0;
  function pause(){
    stopAutomatic();$('guide-status').textContent='Aucune proposition · ajuste la carte puis Relancer';
    $('retry-auto').hidden=false;$('auto-diagnostics').textContent+=' · recherche en pause';
  }
  async function tick(){
    if(session!==cameraSession||!stream||!loaded||!$('auto').checked||document.hidden)return;
    if(attempts>=10||performance.now()-started>=25000){pause();return;}
    const video=$('video');
    if(analyzing||video.readyState<2||!video.videoWidth||!video.videoHeight){
      $('guide-status').textContent='Attente de l’image caméra…';autoTimer=setTimeout(tick,250);return;
    }
    attempts++;$('guide-status').textContent='Recherche sur le téléphone · essai '+attempts+'/10';
    $('auto-diagnostics').textContent='AUTO 3 · essai '+attempts+'/10 · cadre 63:88 · aucun seuil de stabilité';
    await analyze(true);
    if(session!==cameraSession||!stream||!loaded||!$('auto').checked||document.hidden)return;
    if(attempts>=10||performance.now()-started>=25000){pause();return;}
    $('guide-status').textContent='Ajuste la carte dans le cadre · nouvel essai…';
    autoTimer=setTimeout(tick,900);
  }
  $('guide-status').textContent='Aligne les quatre bords sur le cadre';
  $('auto-diagnostics').textContent='AUTO 3 · premier essai dans 1 seconde';autoTimer=setTimeout(tick,1000);
}
$('auto').onchange=startAutomatic;
$('retry-auto').onclick=startAutomatic;
$('camera').onclick=async()=>{
  if(!loaded||analyzing)return;
  const run=generation;busy(true);$('scan').disabled=true;
  try{
    stopCamera();clearPixels();$('results').replaceChildren();
    const camera=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:'environment'},width:{ideal:1920},height:{ideal:1080}}});
    if(run!==generation){camera.getTracks().forEach(t=>t.stop());return;}
    stream=camera;$('video').srcObject=stream;$('video').hidden=false;$('camera-stage').hidden=false;$('camera-help').hidden=false;
    await $('video').play();if(run!==generation)return;
    $('camera-stage').scrollIntoView?.({block:'start',behavior:'smooth'});
    $('scan').disabled=false;$('status').textContent='Place une seule carte dans le cadre. Aucun nom à saisir.';
    startAutomatic();
  }catch(error){if(run===generation){stopCamera();$('status').textContent='Caméra indisponible : '+error.message;}}
  finally{if(run===generation)busy(false);}
};
function capture(source,width,height,rect={x:0,y:0,width,height},show=true){
  if(!(rect.width>0&&rect.height>0))throw Error('Attends que la caméra soit prête.');
  const scale=Math.min(1,Math.sqrt(5000000/(rect.width*rect.height))),canvas=show?$('preview'):document.createElement('canvas');canvas.width=Math.floor(rect.width*scale);canvas.height=Math.floor(rect.height*scale);
  const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(source,rect.x,rect.y,rect.width,rect.height,0,0,canvas.width,canvas.height);const image=ctx.getImageData(0,0,canvas.width,canvas.height);if(show)canvas.hidden=false;return image;
}
$('photo').onchange=async()=>{
  const file=$('photo').files[0],run=generation;if(!file||analyzing)return;
  stopCamera();busy(true);$('scan').disabled=true;
  try{
    if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>12*1048576)throw Error('Choisis un JPEG, PNG ou WebP de moins de 12 Mio.');
    const bitmap=await createImageBitmap(file);try{if(run!==generation)return;if(bitmap.width*bitmap.height>5000000)throw Error('Photo trop grande : limite de 5 mégapixels pour cet essai.');pixels=capture(bitmap,bitmap.width,bitmap.height);}finally{bitmap.close();}
    $('scan').disabled=!loaded;$('status').textContent='Photo chargée en mémoire, prête à analyser.';
  }catch(error){if(run===generation){clearPixels();$('scan').disabled=true;$('status').textContent=error.message;}}
  finally{if(run===generation)busy(false);}
};
async function analyze(automatic=false){
  if(analyzing||!loaded)return;
  const run=generation;analyzing=true;if(!automatic)stopAutomatic();busy(true);$('scan').disabled=true;
  let fallback=null,guided=false;
  try{
    if(stream){
      const video=$('video'),stage=$('camera-stage');
      const aspect=stage.clientWidth&&stage.clientHeight?stage.clientWidth/stage.clientHeight:3/4;
      pixels=capture(video,video.videoWidth,video.videoHeight,guideRect(video.videoWidth,video.videoHeight,aspect),!automatic);
      guided=true;
      // Keep the pre-guide full-sensor path as a bounded fallback, locally only.
      fallback=capture(video,video.videoWidth,video.videoHeight,undefined,false);
      if(!automatic)stopCamera();
    }
    if(!pixels)throw Error('Choisis une photo ou ouvre la caméra.');
    $('results').replaceChildren();$('status').textContent=automatic?'Recherche automatique sur cet appareil…':'Analyse sur cet appareil…';
    const start=performance.now();let engineMs=0,usedFallback=false;
    async function recognize(image,framed=false){
      const data=image.data.buffer;
      const result=await request('scan',{width:image.width,height:image.height,data,framed},[data]);
      engineMs+=result.milliseconds;return result;
    }
    let image=pixels;pixels=null;let result=await recognize(image,guided);image=null;
    if(run!==generation)return;
    if(!result.candidates.length&&fallback){
      usedFallback=true;result=await recognize(fallback);if(run!==generation)return;
    }
    fallback=null;
    const found=result.candidates.length>0;
    if(found)stopCamera();
    $('status').textContent=found?'Vérifie la bonne référence ci-dessous.':automatic?'Pas encore de proposition : rapproche la carte et évite les reflets.':'Aucune correspondance fiable. Réessaie sans reflets ; cette carte peut aussi manquer à l’index.';
    for(const {card} of result.candidates){const li=document.createElement('li');li.textContent=card.name+' — '+(card.setName||card.setCode)+' · '+card.number+' ('+card.language+')';$('results').append(li);}
    $('metrics').textContent+='\n'+(automatic?'Auto · ':'')+'Analyse moteur : '+engineMs+' ms · total : '+Math.round(performance.now()-start)+' ms · '+(usedFallback?'cadre puis image complète':'zone cadrée ou photo importée')+' · '+result.indexed+' références';
    if(found||!automatic)$('camera').textContent='Scanner une autre carte';
  }catch(error){
    if(run===generation){stopCamera();$('status').textContent=error.message;$('auto-diagnostics').textContent='AUTO 3 · erreur : '+String(error.message).slice(0,160);}
  }finally{
    fallback=null;
    if(run===generation){clearPixels();analyzing=false;busy(false);$('scan').disabled=!stream;}
  }
}
$('scan').onclick=()=>analyze();
document.addEventListener('visibilitychange',()=>{if(document.hidden){stop();$('status').textContent='Arrêt automatique en arrière-plan. Recharge pour reprendre.';}});
window.addEventListener('pagehide',stop);
