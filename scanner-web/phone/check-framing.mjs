// Actual WASM engine on synthetic camera layouts, not a physical iPhone test.
// Decodes the supplied photo locally; keeps all pixels in memory only.
import cv from '../.tools/browser-cv/opencv.cjs';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {guideRect,visibleRect} from './framing.js';
import './engine.js';
await new Promise(resolve=>{if(cv.Mat)resolve();else cv.onRuntimeInitialized=resolve;});
const file=process.argv[2];if(!file)throw Error('Local photo required');
const decoded=spawnSync(fileURLToPath(new URL('../.tools/visual-env/Scripts/python.exe',import.meta.url)),['-c',
  'import cv2,sys,json,base64; import numpy as np; im=cv2.imdecode(np.fromfile(sys.argv[1],dtype=np.uint8),cv2.IMREAD_COLOR); im=cv2.cvtColor(im,cv2.COLOR_BGR2RGBA); print(json.dumps({"width":im.shape[1],"height":im.shape[0],"rgba":base64.b64encode(im.tobytes()).decode()}))',file],{windowsHide:true,encoding:'utf8',maxBuffer:32*1024*1024});
if(decoded.status!==0)throw Error('Local decode failed');
const image=JSON.parse(decoded.stdout),photo=cv.matFromArray(image.height,image.width,cv.CV_8UC4,Buffer.from(image.rgba,'base64'));
const engine=new TcgPhone.Engine(cv,JSON.parse(readFileSync(new URL('dist/index-JP.json',import.meta.url))),'JP');
const rect=r=>new cv.Rect(Math.floor(r.x),Math.floor(r.y),Math.floor(r.width),Math.floor(r.height));
try{
  for(const [width,height,offset] of [[1280,720,0],[720,1280,0],[720,1280,.025]]){
    const guide=guideRect(width,height,.75,0),scene=new cv.Mat(height,width,cv.CV_8UC4,new cv.Scalar(45,65,55,255)),card=new cv.Mat();
    const target=rect({...guide,x:guide.x+width*offset}),roi=scene.roi(target);
    try{
      cv.resize(photo,card,new cv.Size(target.width,target.height),0,0,cv.INTER_AREA);card.copyTo(roi);
      assert.ok(Buffer.from(copy(roi)).equals(Buffer.from(card.data)),'fixture pixels copied exactly');
      for(const [name,region] of [['old viewport',visibleRect(width,height)],['aligned guide',guideRect(width,height,.75,0)],['padded guide',guideRect(width,height)]]){
        const cropped=scene.roi(rect(region));
        try{
          if(name==='aligned guide'&&offset===0)assert.ok(Buffer.from(copy(cropped)).equals(Buffer.from(card.data)));
          const result=engine.recognize({width:cropped.cols,height:cropped.rows,data:copy(cropped),framed:name!=='old viewport'});
          console.log(JSON.stringify({width,height,offset,path:name,id:result.candidates[0]?.card.id||null,milliseconds:result.milliseconds}));
          assert.equal(result.candidates[0]?.card.id,'tcgdex:JP:SV-P-001');
        }finally{cropped.delete();}
      }
    }finally{roi.delete();card.delete();scene.delete();}
  }
  for(const framed of [false,true]){
    const blank=engine.recognize({width:450,height:630,data:new Uint8Array(450*630*4).fill(255).buffer,framed});
    assert.equal(blank.candidates.length,0);console.log(JSON.stringify({blankRejected:true,framed}));
  }
}finally{engine.close();photo.delete();}
function copy(mat){const contiguous=new cv.Mat();try{mat.copyTo(contiguous);return contiguous.data.slice().buffer;}finally{contiguous.delete();}}
