import cv from '../.tools/browser-cv/opencv.cjs';
import {readFileSync,writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {allowedImageUrl} from '../catalog.mjs';
import './engine.js';
await new Promise(resolve=>{if(cv.Mat)resolve();else cv.onRuntimeInitialized=()=>resolve();});
const index=JSON.parse(readFileSync(new URL('../visual/data/index.json',import.meta.url)));
const build=JSON.parse(readFileSync(new URL('../visual/data/build-report.json',import.meta.url)));
const anchors=['FR:base1-1','FR:sv03.5-009','EN:swsh3-1','EN:swsh3-2','JP:SV2a-003','JP:SV-P-010'];
const cards=anchors.map(id=>({card:index.entries.find(e=>e.card.id===`tcgdex:${id}`).card,absent:false}));
for(const language of ['FR','EN','JP'])cards.push({card:build.holdouts.find(c=>c.language===language),absent:true});
const report={createdAt:new Date().toISOString(),method:'Same JS/WASM engine as browser. Public reference queries, not independent camera accuracy. One query per card. Three held-out references. No images persisted.',cases:[],failures:[]};
for(const {card,absent} of cards){
  let image;
  for(const source of card.images){if(!allowedImageUrl(source.url))continue;try{const r=await fetch(source.url,{redirect:'error',signal:AbortSignal.timeout(12000)});if(!r.ok)continue;const parts=[];let size=0;for await(const chunk of r.body){size+=chunk.length;if(size>4*1048576)throw Error('Oversize');parts.push(Buffer.from(chunk));}image=Buffer.concat(parts);break;}catch{}}
  if(!image){report.failures.push({id:card.id,error:'Reference unavailable'});continue;}
  let engine;
  try{
    const decoded=spawnSync(fileURLToPath(new URL('../.tools/visual-env/Scripts/python.exe',import.meta.url)),['-c','import cv2,sys,json,base64; import numpy as np; im=cv2.imdecode(np.frombuffer(sys.stdin.buffer.read(),dtype=np.uint8),cv2.IMREAD_COLOR); im=cv2.cvtColor(im,cv2.COLOR_BGR2RGBA); print(json.dumps({"width":im.shape[1],"height":im.shape[0],"rgba":base64.b64encode(im.tobytes()).decode()}))'],{input:image,windowsHide:true,encoding:'utf8',maxBuffer:32*1048576});
    if(decoded.status!==0)throw Error('Decode failed');
    const query=JSON.parse(decoded.stdout);query.data=Uint8Array.from(Buffer.from(query.rgba,'base64')).buffer;delete query.rgba;
    const local=JSON.parse(readFileSync(new URL(`dist/index-${card.language}.json`,import.meta.url)));engine=new TcgPhone.Engine(cv,local,card.language);
    const result=engine.recognize(query);new Uint8Array(query.data).fill(0);
    const ok=absent?result.candidates.length===0:result.candidates[0]?.card.id===card.id;
    report.cases.push({id:card.id,absent,ok,...result});console.log(`${card.id} ${absent?'absent':'indexed'} ${ok?'OK':'FAIL'} ${result.milliseconds} ms`);
  }catch(error){report.failures.push({id:card.id,error:error.message});}finally{image.fill(0);engine?.close();}
}
writeFileSync(new URL('reference-report.json',import.meta.url),JSON.stringify(report,null,2));
if(report.failures.length||report.cases.some(c=>!c.ok))process.exitCode=1;
