import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
// Ahead-of-time materialization of trusted, SHA-pinned Emscripten factories.
// Build process only: no user pixels or text enter these factories. The browser
// never compiles strings, and no unsafe-eval permission is needed.
export async function cspRuntime(source){
  const NativeFunction=globalThis.Function,factories=new Map();
  const record=args=>{const strings=args.map(String);factories.set(JSON.stringify(strings),strings);};
  globalThis.Function=new Proxy(NativeFunction,{
    construct(target,args,newTarget){record(args);return Reflect.construct(target,args,newTarget);},
    apply(target,thisArg,args){record(args);return Reflect.apply(target,thisArg,args);},
  });
  try{
    const cv=require('@techstark/opencv-js');
    await new Promise(resolve=>{if(cv.Mat)resolve();else cv.onRuntimeInitialized=()=>resolve();});
  }finally{globalThis.Function=NativeFunction;}
  if(factories.size<10)throw Error('OpenCV factory collection incomplete; run build in a fresh process');
  const cases=[...factories].map(([key,args])=>`case ${JSON.stringify(key)}: return function(${args.slice(0,-1).join(',')}){${args.at(-1)}};`).join('\n');
  const shim=`var Function=(function(){function StaticFunction(){switch(JSON.stringify(Array.prototype.map.call(arguments,String))){${cases}\ndefault:throw new Error("OpenCV: factory not precompiled");}}Object.defineProperty(StaticFunction,"name",{value:"Function"});StaticFunction.prototype=globalThis.Function.prototype;return StaticFunction;})();\n`;
  const marker='var cv = (function() {';
  if(source.indexOf(marker)<0||source.indexOf(marker)!==source.lastIndexOf(marker))throw Error('Unexpected OpenCV layout');
  return {source:'/* Modified by TRACKTCG, 2026-10-09: Emscripten JavaScript factories precompiled for strict CSP. Original WASM unchanged. Apache-2.0; see OpenCV-LICENSE.txt. */\n'+source.replace(marker,shim+marker),factoryCount:factories.size};
}
