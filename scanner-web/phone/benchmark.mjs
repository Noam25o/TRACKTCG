// Executes the identical browser engine under Node/WASM. Not an iPhone test.
import cv from '../.tools/browser-cv/opencv.cjs';
import {readFileSync,writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import './engine.js';
await new Promise(resolve=>{if(cv.Mat)resolve();else cv.onRuntimeInitialized=resolve;});
const file=process.argv.find(x=>x.startsWith('--photo='))?.slice(8);
if(!file)throw Error('Provide --photo=local-file');
const decoded=spawnSync(fileURLToPath(new URL('../.tools/visual-env/Scripts/python.exe',import.meta.url)),['-c',
  'import cv2,sys,json,base64; import numpy as np; im=cv2.imdecode(np.fromfile(sys.argv[1],dtype=np.uint8),cv2.IMREAD_COLOR); im=cv2.cvtColor(im,cv2.COLOR_BGR2RGBA); print(json.dumps({"width":im.shape[1],"height":im.shape[0],"rgba":base64.b64encode(im.tobytes()).decode()}))',file],{windowsHide:true,encoding:'utf8',maxBuffer:32*1024*1024});
if(decoded.status!==0)throw Error('Local image decode failed');
const photo=JSON.parse(decoded.stdout);photo.data=Uint8Array.from(Buffer.from(photo.rgba,'base64')).buffer;delete photo.rgba;
const index=JSON.parse(readFileSync(new URL('dist/index-JP.json',import.meta.url))),engine=new TcgPhone.Engine(cv,index,'JP');
try{
  const cases=[];for(let i=0;i<3;i++){const result=engine.recognize(photo);cases.push({run:i+1,...result});console.log(JSON.stringify(result));}
  const blank=engine.recognize({width:450,height:630,data:new Uint8Array(450*630*4).fill(255).buffer});
  const report={createdAt:new Date().toISOString(),runtime:'OpenCV.js WASM on Windows/Node, NOT iPhone',cases,blank,wasmBytes:cv.HEAPU8.buffer.byteLength};
  writeFileSync(new URL('node-report.json',import.meta.url),JSON.stringify(report,null,2));
  if(cases.some(r=>r.candidates[0]?.card.id!=='tcgdex:JP:SV-P-001')||blank.candidates.length)process.exitCode=1;
}finally{engine.close();new Uint8Array(photo.data).fill(0);}
