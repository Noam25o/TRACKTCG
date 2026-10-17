/* Classic worker, standalone static files; never sends pixels over the network. */
let currentId=null;
self.addEventListener('unhandledrejection',event=>self.postMessage({id:currentId,error:String(event.reason).slice(0,500)}));
importScripts('./opencv.js','./engine.js','./asset-cache.js');
let engine=null;
const ready=new Promise(resolve=>{if(cv.Mat)resolve();else cv.then(()=>resolve());});
self.onmessage=async({data:message})=>{
  try{
    currentId=message.id;
    self.postMessage({id:message.id,progress:message.action==='init'?'Initialisation WebAssembly…':'Comparaison locale des références…'});
    await ready;
    if(message.action==='init'){
      if(!['FR','EN','JP'].includes(message.language))throw Error('Langue invalide');
      engine?.close();engine=null;
      self.postMessage({id:message.id,progress:'Vérification des références locales…'});
      const cached=await TcgReferenceCache.read(message.asset,message.language);
      engine=new TcgPhone.Engine(cv,cached.index,message.language);
      self.postMessage({id:message.id,result:{indexed:engine.entries.length,wasmBytes:cv.HEAPU8?.buffer.byteLength||null,referenceSource:cached.source,cacheAvailable:cached.cacheAvailable,referenceBytes:cached.bytes}});
    }else if(message.action==='scan'){
      if(!engine)throw Error('Charger le moteur');
      self.postMessage({id:message.id,result:engine.recognize(message)});
    }else throw Error('Action inconnue');
  }catch(error){self.postMessage({id:message.id,error:typeof error==='number'?`Erreur OpenCV (${error})`:error.message});}
};
