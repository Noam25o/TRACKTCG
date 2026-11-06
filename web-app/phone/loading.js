export async function loadManifest(language,signal,manifestUrl=new URL('./manifest.json',import.meta.url)){
  const response=await fetch(manifestUrl,{cache:'no-store',credentials:'same-origin',signal});
  if(!response.ok)throw Error('Version du scanner indisponible. Vérifie le lien et la connexion.');
  const manifest=await response.json(),asset=manifest.languages?.[language],worker=manifest.assets?.worker;
  if(manifest.cacheVersion!==1||!worker||!/^worker\.[a-f0-9]{64}\.js$/.test(worker.file)||!asset||asset.file!==`index-${language}.${asset.sha256}.json`)throw Error('Version incompatible. Recharge la page.');
  return {worker:new URL('./'+worker.file,manifestUrl).href,asset};
}
