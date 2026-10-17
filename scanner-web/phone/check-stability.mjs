// Local diagnostic only: no image upload or persisted copy.
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {StabilityGate} from './framing.js';
const file=process.argv[2];if(!file)throw Error('Provide a local test photo path');
const decoded=spawnSync(fileURLToPath(new URL('../.tools/visual-env/Scripts/python.exe',import.meta.url)),['-c',
  'import cv2,sys,base64; import numpy as np; im=cv2.imdecode(np.fromfile(sys.argv[1],dtype=np.uint8),cv2.IMREAD_COLOR); im=cv2.cvtColor(cv2.resize(im,(64,88),interpolation=cv2.INTER_AREA),cv2.COLOR_BGR2RGBA); print(base64.b64encode(im.tobytes()).decode())',file],{windowsHide:true,encoding:'utf8'});
if(decoded.status!==0)throw Error('Local decoding failed');
const rgba=Uint8ClampedArray.from(Buffer.from(decoded.stdout.trim(),'base64'));
const brightness=(offset)=>Uint8ClampedArray.from(rgba,(v,i)=>i%4===3?v:v+offset);
const shift=()=>{const out=rgba.slice();for(let y=0;y<88;y++)for(let x=1;x<64;x++)for(let c=0;c<4;c++)out[(y*64+x)*4+c]=rgba[(y*64+x-1)*4+c];return out;};
for(const [name,frames] of [['still',[rgba]],['exposure ±6',[rgba,brightness(6)]],['shift 1 pixel',[rgba,shift()]]]){
  const gate=new StabilityGate();let triggered=false,last;
  for(let time=0;time<=3000;time+=250){last=gate.update(frames[(time/250)%frames.length],64,88,time);triggered ||=last.ready;}
  console.log(JSON.stringify({name,triggered,last}));
}
