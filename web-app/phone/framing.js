// Pure helpers shared by the UI and tests. Stability is not card identification.
export function visibleRect(width,height,aspect=3/4){
  if(!(width>0&&height>0))throw Error('Image caméra pas encore prête.');
  const w=Math.min(width,height*aspect),h=w/aspect;
  return {x:(width-w)/2,y:(height-h)/2,width:w,height:h};
}
// Same geometry as #guide: 76% viewport width, centred, card ratio 63:88.
export function guideRect(width,height,aspect=3/4,padding=.04){
  const view=visibleRect(width,height,aspect),cardWidth=view.width*.76,cardHeight=cardWidth*88/63;
  const w=Math.min(view.width,cardWidth*(1+2*padding)),h=Math.min(view.height,cardHeight*(1+2*padding));
  return {x:view.x+(view.width-w)/2,y:view.y+(view.height-h)/2,width:w,height:h};
}
export class StabilityGate {
  constructor(){this.reset();}
  reset(){this.previous=null;this.mean=null;this.since=null;this.last=null;}
  update(rgba,width,height,now){
    if(width<2||height<2||rgba.length!==width*height*4||!Number.isFinite(now))throw Error('Échantillon invalide');
    const gray=new Float32Array(width*height);let sum=0,squares=0,edge=0,delta=0;
    for(let i=0;i<gray.length;i++){
      const v=(rgba[i*4]+rgba[i*4+1]+rgba[i*4+2])/3;gray[i]=v;sum+=v;squares+=v*v;
      if(i%width)edge+=Math.abs(v-gray[i-1]);
      if(i>=width)edge+=Math.abs(v-gray[i-width]);
      if(this.previous?.length===gray.length)delta+=Math.abs(v-this.previous[i]);
    }
    const mean=sum/gray.length,contrast=Math.sqrt(Math.max(0,squares/gray.length-mean**2));
    const detail=edge/(height*(width-1)+width*(height-1)),textured=contrast>=18&&detail>=4;
    const comparable=this.previous?.length===gray.length;
    const brightness=comparable?mean-this.mean:0,rawMotion=comparable?delta/gray.length:null;
    let motion=null;
    // Compensate modest exposure shifts and <=1 sample-pixel hand movement.
    // Raw-motion and exposure caps prevent large changes being aligned away.
    if(comparable){
      motion=Infinity;
      const radius=width>4&&height>4&&rawMotion<=35?1:0;
      for(let dy=-radius;dy<=radius;dy++)for(let dx=-radius;dx<=radius;dx++){
        let difference=0,count=0;
        for(let y=1;y<height-1;y++)for(let x=1;x<width-1;x++){
          difference+=Math.abs(gray[y*width+x]-this.previous[(y+dy)*width+x+dx]-brightness);count++;
        }
        if(count)motion=Math.min(motion,difference/count);
      }
    }
    const stable=textured&&comparable&&Math.abs(brightness)<=20&&rawMotion<=35&&motion<=6&&this.last!==null&&now-this.last<=1000&&now>=this.last;
    if(!stable)this.since=null;
    else if(this.since===null)this.since=now;
    this.previous=gray;this.mean=mean;this.last=now;
    const progress=this.since===null?0:Math.min(1,(now-this.since)/900);
    return {ready:stable&&progress===1,progress,textured,stable,motion:Number.isFinite(motion)?motion:null,contrast,detail,brightness};
  }
}
