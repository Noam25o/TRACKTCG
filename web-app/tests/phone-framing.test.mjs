import test from 'node:test';
import assert from 'node:assert/strict';
import {StabilityGate,visibleRect,guideRect} from '../phone/framing.js';
const frame=(invert=false)=>Uint8ClampedArray.from({length:64*88*4},(_,i)=>i%4===3?255:(((Math.floor(i/4)%64)%2===0)!==invert?220:30));
test('guide uses true card proportions and maps inside landscape/portrait sensors',()=>{
  for(const [width,height,aspect] of [[1280,720,.75],[720,1280,.75],[1080,1920,350/467]]){
    const card=guideRect(width,height,aspect,0),padded=guideRect(width,height,aspect);
    assert.ok(Math.abs(card.width/card.height-63/88)<1e-9);
    assert.ok(padded.x>=0&&padded.y>=0&&padded.x+padded.width<=width&&padded.y+padded.height<=height);
    assert.ok(padded.width>card.width&&padded.height>card.height);
    assert.equal(card.x+card.width/2,width/2);assert.equal(card.y+card.height/2,height/2);
  }
});
test('framing matches the portrait object-fit cover crop without stretching',()=>{
  assert.deepEqual(visibleRect(1280,720),{x:370,y:0,width:540,height:720});
  assert.deepEqual(visibleRect(720,1280),{x:0,y:160,width:720,height:960});
  assert.deepEqual(visibleRect(750,1000),{x:0,y:0,width:750,height:1000});
  assert.throws(()=>visibleRect(0,0));
});
test('auto capture requires sustained stability, never its first frame',()=>{
  const gate=new StabilityGate();let state;
  for(const time of [0,250,500,750,1000]){state=gate.update(frame(),64,88,time);assert.equal(state.ready,false);}
  assert.equal(gate.update(frame(),64,88,1250).ready,true);
  gate.reset();assert.equal(gate.update(frame(),64,88,1500).ready,false);
});
test('blank and flat frames cannot trigger auto capture',()=>{
  for(const value of [0,128,255]){const gate=new StabilityGate();for(let time=0;time<5000;time+=250)assert.equal(gate.update(new Uint8Array(64*88*4).fill(value),64,88,time).ready,false);}
});
test('motion and gaps reset stability instead of capturing a stale frame',()=>{
  const gate=new StabilityGate();
  for(let time=0;time<3000;time+=250)assert.equal(gate.update(frame(time%500===0),64,88,time).ready,false);
  gate.reset();gate.update(frame(),64,88,0);gate.update(frame(),64,88,250);
  assert.equal(gate.update(frame(),64,88,2000).ready,false);
  assert.equal(gate.update(frame(),64,88,2250).ready,false);
  assert.throws(()=>gate.update(new Uint8Array(3),64,88,2500));
});
const cardLike=(shift=0,exposure=0)=>Uint8ClampedArray.from({length:64*88*4},(_,i)=>{
  if(i%4===3)return 255;
  const x=Math.max(0,i/4%64|0)-shift,y=Math.floor(i/4/64);
  return 125+40*Math.sin(x*.35)+30*Math.cos(y*.28)+exposure;
});
test('modest exposure changes and one-pixel jitter no longer prevent a capture',()=>{
  for(const frames of [[cardLike(),cardLike(0,6)],[cardLike(),cardLike(1)],[cardLike(),cardLike(1,6)]]){
    const gate=new StabilityGate();let result;
    for(let time=0;time<=1500;time+=250)result=gate.update(frames[time/250%2],64,88,time);
    assert.equal(result.ready,true);assert.ok(result.motion<=6);
  }
});
test('large exposure changes and persistent movement are not aligned away',()=>{
  for(const frames of [[cardLike(),cardLike(0,40)],[cardLike(),cardLike(5)]]){
    const gate=new StabilityGate();
    for(let time=0;time<=2500;time+=250)assert.equal(gate.update(frames[time/250%2],64,88,time).ready,false);
  }
});
