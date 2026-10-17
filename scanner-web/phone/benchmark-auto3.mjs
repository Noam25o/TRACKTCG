// AUTO 3's two-pass recognition on synthetic camera scenes. Not an accuracy
// estimate: public digital references are also used to build the index.
import cv from '../.tools/browser-cv/opencv.cjs';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {allowedImageUrl} from '../catalog.mjs';
import {guideRect} from './framing.js';
import './engine.js';
await new Promise(resolve=>{if(cv.Mat)resolve();else cv.onRuntimeInitialized=resolve;});
const sha=file=>createHash('sha256').update(readFileSync(new URL(file,import.meta.url))).digest('hex');
const index=JSON.parse(readFileSync(new URL('../visual/data/index.json',import.meta.url)));
const build=JSON.parse(readFileSync(new URL('../visual/data/build-report.json',import.meta.url)));
const anchors=['FR:base1-1','FR:sv03.5-009','EN:swsh3-1','EN:swsh3-2','JP:SV2a-003','JP:SV-P-010'];
const cards=anchors.map(id=>({card:index.entries.find(e=>e.card.id===`tcgdex:${id}`).card,absent:false}));
for(const language of ['FR','EN','JP']){
  const card=build.holdouts.find(c=>c.language===language);
  if(!card||index.entries.some(e=>e.card.id===card.id))throw Error('Invalid held-out reference');
  cards.push({card,absent:true});
}
const report={createdAt:new Date().toISOString(),method:'Windows Node/WASM, AUTO 3 guide + full-sensor fallback. Six known digital references, three held-out references, three synthetic layouts per card. Not physical photos, iPhone timing, or a general accuracy estimate. Pixels decoded locally, never persisted.',hashes:{engine:sha('./engine.js'),framing:sha('./framing.js'),app:sha('./app.js'),index:sha('../visual/data/index.json')},cases:[],failures:[]};
function copy(mat){const out=new cv.Mat();try{mat.copyTo(out);return out.data.slice().buffer;}finally{out.delete();}}
function scan(engine,scene){
  const region=guideRect(scene.cols,scene.rows),roi=scene.roi(new cv.Rect(Math.floor(region.x),Math.floor(region.y),Math.floor(region.width),Math.floor(region.height)));
  let first;
  try{first=engine.recognize({width:roi.cols,height:roi.rows,data:copy(roi),framed:true});}finally{roi.delete();}
  if(first.candidates.length)return {...first,path:'guide'};
  const second=engine.recognize({width:scene.cols,height:scene.rows,data:copy(scene),framed:false});
  return {...second,milliseconds:first.milliseconds+second.milliseconds,path:'guide+full'};
}
async function download(card){
  for(const source of card.images){
    if(!allowedImageUrl(source.url))continue;
    try{
      const response=await fetch(source.url,{redirect:'error',signal:AbortSignal.timeout(12000)});if(!response.ok)continue;
      const reader=response.body.getReader(),chunks=[];let length=0;
      try{while(true){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>4*1048576)throw Error('Reference exceeds 4 MiB');chunks.push(Buffer.from(value));}}
      finally{await reader.cancel();reader.releaseLock();}
      return {bytes:Buffer.concat(chunks),url:source.url};
    }catch{}
  }
  throw Error('Reference unavailable');
}
function decode(bytes){
  const result=spawnSync(fileURLToPath(new URL('../.tools/visual-env/Scripts/python.exe',import.meta.url)),['-c','import cv2,sys,json,base64; import numpy as np; im=cv2.imdecode(np.frombuffer(sys.stdin.buffer.read(),dtype=np.uint8),cv2.IMREAD_COLOR); im=cv2.cvtColor(im,cv2.COLOR_BGR2RGBA); print(json.dumps({"width":im.shape[1],"height":im.shape[0],"rgba":base64.b64encode(im.tobytes()).decode()}))'],{input:bytes,windowsHide:true,encoding:'utf8',maxBuffer:32*1048576});
  if(result.status!==0)throw Error('Local decode failed');
  const image=JSON.parse(result.stdout);return cv.matFromArray(image.height,image.width,cv.CV_8UC4,Buffer.from(image.rgba,'base64'));
}
function sceneFor(photo,width,height,tilted){
  const box=guideRect(width,height,.75,0),{x,y}=box,w=box.width,h=box.height;
  const points=tilted?[x+w*.03,y+h*.025,x+w*.99,y+h*.07,x+w*.94,y+h*.98,x-w*.02,y+h*.94]:[x,y,x+w,y,x+w,y+h,x,y+h];
  const from=cv.matFromArray(4,1,cv.CV_32FC2,[0,0,photo.cols-1,0,photo.cols-1,photo.rows-1,0,photo.rows-1]);
  const to=cv.matFromArray(4,1,cv.CV_32FC2,points),transform=cv.getPerspectiveTransform(from,to),scene=new cv.Mat();
  try{cv.warpPerspective(photo,scene,transform,new cv.Size(width,height),cv.INTER_LINEAR,cv.BORDER_CONSTANT,new cv.Scalar(45,65,55,255));return scene;}
  catch(error){scene.delete();throw error;}finally{from.delete();to.delete();transform.delete();}
}
for(const language of ['FR','EN','JP']){
  const engine=new TcgPhone.Engine(cv,JSON.parse(readFileSync(new URL(`dist/index-${language}.json`,import.meta.url))),language);
  try{
    for(const {card,absent} of cards.filter(c=>c.card.language===language)){
      let photo,downloaded;
      try{
        downloaded=await download(card);photo=decode(downloaded.bytes);
        for(const [layout,width,height,tilted] of [['portrait',720,1280,false],['landscape',1280,720,false],['perspective',720,1280,true]]){
          const scene=sceneFor(photo,width,height,tilted);
          try{
            const result=scan(engine,scene),ok=absent?result.candidates.length===0:result.candidates[0]?.card.id===card.id;
            report.cases.push({id:card.id,language,source:downloaded.url,absent,layout,ok,...result});
            console.log(`${card.id} ${layout} ${absent?'absent':'indexed'} ${ok?'OK':'FAIL'} ${result.path} ${result.milliseconds} ms`);
          }finally{scene.delete();}
        }
      }catch(error){report.failures.push({id:card.id,error:error.message});}
      finally{downloaded?.bytes.fill(0);photo?.delete();}
    }
    for(const value of [0,128,255]){
      const scene=new cv.Mat(1280,720,cv.CV_8UC4,new cv.Scalar(value,value,value,255));
      try{const result=scan(engine,scene);report.cases.push({id:`blank-${value}`,language,absent:true,layout:'blank',ok:result.candidates.length===0,...result});}finally{scene.delete();}
    }
  }finally{engine.close();}
}
report.summary={total:report.cases.length,passed:report.cases.filter(c=>c.ok).length,failed:report.cases.filter(c=>!c.ok).length,unavailable:report.failures.length,negative:report.cases.filter(c=>c.absent).length,ambiguousPositive:report.cases.filter(c=>!c.absent&&c.ambiguous).length};
writeFileSync(new URL('auto3-report.json',import.meta.url),JSON.stringify(report,null,2));
console.log(JSON.stringify(report.summary));
if(report.failures.length||report.cases.some(c=>!c.ok)||report.cases.length!==36)process.exitCode=1;
