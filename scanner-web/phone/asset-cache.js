/* Only immutable reference catalogues enter this cache. Never camera pixels. */
(() => {
  const PREFIX='tracktcg-phone-references-v1-';
  function validate(asset,language,base){
    if(!['FR','EN','JP'].includes(language)||!asset||!/^[a-f0-9]{64}$/.test(asset.sha256)||asset.file!==`index-${language}.${asset.sha256}.json`||!Number.isInteger(asset.bytes)||asset.bytes<1||asset.bytes>30*1048576)throw Error('Version des références invalide');
    return new URL('./'+asset.file,base).href;
  }
  async function verified(response,asset,crypto){
    if(!response?.ok||!response.body)throw Error('Références indisponibles');
    const reader=response.body.getReader(),parts=[];let length=0;
    try{while(true){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>asset.bytes)throw Error('Références trop volumineuses');parts.push(value);}}
    finally{await reader.cancel();reader.releaseLock();}
    if(length!==asset.bytes)throw Error('Références incomplètes');
    const bytes=new Uint8Array(length);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.length;}
    const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join('');
    if(digest!==asset.sha256)throw Error('Références corrompues ou obsolètes');
    return bytes;
  }
  async function read(asset,language,{base=globalThis.location.href,fetch=globalThis.fetch.bind(globalThis),storage=globalThis.caches,crypto=globalThis.crypto}={}){
    const url=validate(asset,language,base);let cache=null,source='network',cacheAvailable=false,bytes;
    try{cache=await storage?.open(PREFIX+language);cacheAvailable=Boolean(cache);}catch{}
    if(cache){
      try{const response=await cache.match(url);if(response){bytes=await verified(response,asset,crypto);source='cache';}}
      catch{try{await cache.delete(url);}catch{}}
    }
    if(!bytes){
      bytes=await verified(await fetch(url,{cache:'no-store',credentials:'same-origin',redirect:'error'}),asset,crypto);
      if(cache){
        try{
          await cache.put(url,new Response(bytes,{headers:{'Content-Type':'application/json'}}));
          // Keep one release per language. Do not touch unrelated caches.
          for(const old of await cache.keys())if(old.url!==url)await cache.delete(old);
        }catch{cacheAvailable=false;}
      }
    }
    return {index:JSON.parse(new TextDecoder().decode(bytes)),source,cacheAvailable,bytes:bytes.length};
  }
  globalThis.TcgReferenceCache={read,validate};
})();
