import {mountPhoneScanner} from '/phone/app.js';

export function connectPhoneScanner(){
  const root=document.getElementById('phone-scanner');
  const legacy=document.getElementById('legacy-scanner');
  let scannerScreen=false,opening=0;
  const cameraError=document.getElementById('phone-camera-error');
  async function openScanner(){
    const attempt=++opening;
    cameraError.hidden=true;
    document.body.classList.add('scanner-camera-active');
    const opened=await scanner.openCamera();
    if(attempt!==opening||!scannerScreen)return;
    cameraError.hidden=opened;
  }
  const scanner=mountPhoneScanner({
    prefix:'phone-',manifestUrl:new URL('/manifest.json',window.location.href),
    onFound:card=>document.dispatchEvent(new CustomEvent('tracktcg:open-card',{detail:{id:card.id,source:'scanner'}})),
  });
  // Prepare the cached engine while the catalogue is visible. Opening the
  // scanner still requests the camera immediately if preparation is ongoing.
  void scanner.load();
  document.addEventListener('tracktcg:navigate',event=>{
    scannerScreen=event.detail==='scanner';
    if(scannerScreen){root.hidden=false;void openScanner();}
    else {opening++;document.body.classList.remove('scanner-camera-active');scanner.stop();}
  });
  document.getElementById('phone-camera-retry').addEventListener('click',()=>{scanner.stop();void openScanner();});
  // Only one scanner can own the camera. Opening or closing the fallback
  // stops both controllers through the existing navigation lifecycle.
  legacy.addEventListener('toggle',()=>{
    root.hidden=legacy.open;
    document.dispatchEvent(new CustomEvent('tracktcg:navigate',{detail:'scanner-mode-change'}));
    if(!legacy.open)void scanner.openCamera();
  });
  document.getElementById('phone-language').addEventListener('change',()=>{
    if(!root.hidden)void scanner.openCamera();
  });
  return scanner;
}
connectPhoneScanner();
