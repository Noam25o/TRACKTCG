/* Browser-only ORB baseline. Scores are NOT probabilities. No network here. */
(() => {
  const W=450,H=630,MIN=24;
  const bytes = value => Uint8Array.from(atob(value), c=>c.charCodeAt(0));
  const distance = (a,b) => a.reduce((n,v,i)=>n+(Boolean(v)!==Boolean(b[i])),0);
  function unpack(index, language) {
    if(index.format!=='tracktcg.orb.v1'||!Array.isArray(index.entries)||index.entries.length>1000) throw Error('Index incompatible');
    const ids=new Set();
    return index.entries.map(item=>{
      if(item.card?.language!==language || typeof item.card.id!=='string' || ids.has(item.card.id)) throw Error('Identité invalide');
      ids.add(item.card.id);
      const points=bytes(item.points),descriptors=bytes(item.descriptors);
      if(!points.length || points.length%8 || descriptors.length!==points.length*4 || points.length>8000
        || item.hash?.length!==63 || item.hash.some(x=>typeof x!=='boolean')) throw Error('Empreinte invalide');
      const positions=new Float32Array(points.buffer);
      if(positions.some(x=>!Number.isFinite(x)||x<0||x>630)) throw Error('Coordonnées invalides');
      return {card:item.card,points:positions,descriptors,hash:item.hash};
    });
  }
  // Orthonormal 32x32 DCT: OpenCV.js does not export cv.dct.
  const cos=Array.from({length:8},(_,u)=>Float64Array.from({length:32},(_,x)=>Math.cos(Math.PI*(2*x+1)*u/64)*(u===0?Math.sqrt(1/32):.25)));
  function phash(gray) {
    const horizontal=new Float64Array(32*8),coeff=[];
    for(let y=0;y<32;y++)for(let u=0;u<8;u++)for(let x=0;x<32;x++) horizontal[y*8+u]+=gray[y*32+x]*cos[u][x];
    for(let v=0;v<8;v++)for(let u=0;u<8;u++){
      let sum=0;for(let y=0;y<32;y++)sum+=horizontal[y*8+u]*cos[v][y];
      if(v||u)coeff.push(sum);
    }
    const median=[...coeff].sort((a,b)=>a-b)[31]; return coeff.map(x=>x>median);
  }
  function scope(fn) {const list=[];const own=x=>(list.push(x),x);try{return fn(own);}finally{for(const x of list.reverse())x.delete();}}
  function orderedQuad(data) {
    const points=Array.from({length:4},(_,i)=>[data[i*2],data[i*2+1]]);
    const extreme=(f,last=false)=>[...points].sort((a,b)=>f(a)-f(b))[last?3:0];
    const p=[extreme(p=>p[0]+p[1]),extreme(p=>p[1]-p[0]),extreme(p=>p[0]+p[1],true),extreme(p=>p[1]-p[0],true)];
    if(new Set(p.map(p=>p.join(','))).size!==4)return null;
    const d=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
    const ratio=(d(p[0],p[1])+d(p[2],p[3]))/(d(p[0],p[3])+d(p[1],p[2]));
    return ratio>.5&&ratio<.9?p.flat():null;
  }
  function prepare(cv,input,out,own) {
    const gray=own(new cv.Mat()),edges=own(new cv.Mat()),contours=own(new cv.MatVector()),hierarchy=own(new cv.Mat());
    cv.cvtColor(input,gray,cv.COLOR_RGBA2GRAY);cv.Canny(gray,edges,60,160);
    cv.findContours(edges,contours,hierarchy,cv.RETR_LIST,cv.CHAIN_APPROX_SIMPLE);
    const all=Array.from({length:contours.size()},(_,i)=>{const c=contours.get(i);try{return {i,area:cv.contourArea(c)};}finally{c.delete();}}).sort((a,b)=>b.area-a.area).slice(0,20);
    for(const {i,area} of all){
      if(area<input.rows*input.cols*.35)continue;
      const contour=contours.get(i),poly=new cv.Mat();
      try{
        cv.approxPolyDP(contour,poly,.02*cv.arcLength(contour,true),true);
        if(poly.rows!==4||!cv.isContourConvex(poly))continue;
        const p=orderedQuad(poly.data32S);if(!p)continue;
        const source=own(cv.matFromArray(4,1,cv.CV_32FC2,p)),target=own(cv.matFromArray(4,1,cv.CV_32FC2,[0,0,449,0,449,629,0,629]));
        const transform=own(cv.getPerspectiveTransform(source,target));
        cv.warpPerspective(input,out,transform,new cv.Size(W,H));return;
      }finally{contour.delete();poly.delete();}
    }
    cv.resize(input,out,new cv.Size(W,H),0,0,cv.INTER_AREA);
  }
  class Engine {
    constructor(cv,index,language){
      this.cv=cv;this.entries=unpack(index,language);
      this.orb=new cv.ORB();this.orb.setMaxFeatures(600);this.orb.setFastThreshold(12);
    }
    close(){this.orb?.delete();this.orb=null;this.entries=[];}
    recognize({width,height,data,framed=false}){
      if(!this.orb)throw Error('Moteur arrêté');
      if(!Number.isInteger(width)||!Number.isInteger(height)||width<32||height<32||width*height>5000000||data.byteLength!==width*height*4)throw Error('Image invalide (maximum 5 MP)');
      const cv=this.cv,start=performance.now();
      return scope(own=>{
        const src=own(cv.matFromArray(height,width,cv.CV_8UC4,new Uint8Array(data))),crop=own(new cv.Mat()),gray=own(new cv.Mat());
        if(framed)cv.resize(src,crop,new cv.Size(W,H),0,0,cv.INTER_AREA);
        else prepare(cv,src,crop,own);
        cv.cvtColor(crop,gray,cv.COLOR_RGBA2GRAY);
        const kp=own(new cv.KeyPointVector()),des=own(new cv.Mat()),empty=own(new cv.Mat());
        this.orb.detectAndCompute(gray,empty,kp,des);
        if(des.rows<20)return {candidates:[],milliseconds:Math.round(performance.now()-start),indexed:this.entries.length,reason:'Image sans détails suffisants'};
        const small=own(new cv.Mat());cv.resize(gray,small,new cv.Size(32,32));
        const hash=phash(small.data),pool=this.entries.map(e=>({e,d:distance(e.hash,hash)})).sort((a,b)=>a.d-b.d).slice(0,80);
        const matcher=own(new cv.BFMatcher(cv.NORM_HAMMING,false)),candidates=[];
        for(const {e} of pool)scope(keep=>{
          const refs=keep(cv.matFromArray(e.descriptors.length/32,32,cv.CV_8U,e.descriptors)),pairs=keep(new cv.DMatchVectorVector());
          matcher.knnMatch(refs,des,pairs,2);
          const unique=new Map();
          for(let i=0;i<pairs.size();i++){
            const pair=pairs.get(i);
            try{if(pair.size()!==2)continue;const a=pair.get(0),b=pair.get(1);
              if(a.distance<.75*b.distance&&(!unique.has(a.trainIdx)||a.distance<unique.get(a.trainIdx).distance))unique.set(a.trainIdx,a);
            }finally{pair.delete();}
          }
          const good=[...unique.values()];if(good.length<MIN)return;
          const from=[],to=[];
          for(const m of good){from.push(e.points[m.queryIdx*2],e.points[m.queryIdx*2+1]);const p=kp.get(m.trainIdx).pt;to.push(p.x,p.y);}
          const a=keep(cv.matFromArray(good.length,1,cv.CV_32FC2,from)),b=keep(cv.matFromArray(good.length,1,cv.CV_32FC2,to)),mask=keep(new cv.Mat());
          const matrix=keep(cv.findHomography(a,b,cv.RANSAC,4,mask));if(matrix.empty())return;
          const accepted=[];let inliers=0;
          for(let i=0;i<good.length;i++)if(mask.data[i]){inliers++;accepted.push(from[i*2],from[i*2+1]);}
          if(inliers<MIN||inliers/good.length<.4)return;
          const acceptedMat=keep(cv.matFromArray(inliers,1,cv.CV_32FC2,accepted)),hull=keep(new cv.Mat());cv.convexHull(acceptedMat,hull);
          const area=cv.contourArea(hull)/(W*H);if(area<.08)return;
          const corners=keep(cv.matFromArray(4,1,cv.CV_32FC2,[0,0,449,0,449,629,0,629])),projected=keep(new cv.Mat());
          cv.perspectiveTransform(corners,projected,matrix);
          if(projected.data32F.some(x=>!Number.isFinite(x)||x< -180||x>810)||!cv.isContourConvex(projected))return;
          const size=Math.abs(cv.contourArea(projected))/(W*H);if(size<.25||size>1.8)return;
          candidates.push({card:e.card,inliers,score:inliers*Math.min(1,area*3)});
        });
        candidates.sort((a,b)=>b.score-a.score);
        return {candidates:candidates.slice(0,3),milliseconds:Math.round(performance.now()-start),indexed:this.entries.length,ambiguous:candidates.length>1&&candidates[1].score>candidates[0].score*.8};
      });
    }
  }
  globalThis.TcgPhone={Engine,unpack,phash,distance};
})();
