import { renderCandidates } from '/candidates.mjs';
import { resolveAutomatically, resolutionMessage } from '/automatic.mjs';
import { createLocalOcr, titleInk } from '/ocr.mjs';
import { collectorFromTsv, readCollectorFooter } from '/collector.mjs';
const $ = (id) => document.getElementById(id);
async function compareCrops(engine, footer, signal) {
  const canvas=document.createElement('canvas'), ctx=canvas.getContext('2d',{willReadFrequently:true});
  try {
    for (const [label,x,width] of [['entier',.02,.96],['gauche',.02,.48],['droite',.5,.48]]) {
      for (const ink of [false,true]) {
        if(signal.aborted) throw new DOMException('Annulé','AbortError');
        canvas.width=1020;canvas.height=Math.round(footer.height*.5/(footer.width*width)*1000)+20;
        ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);
        ctx.drawImage(footer,footer.width*x,footer.height*.5,footer.width*width,footer.height*.5,10,10,1000,canvas.height-20);
        if(ink){const pixels=ctx.getImageData(0,0,canvas.width,canvas.height);titleInk(pixels.data);ctx.putImageData(pixels,0,0);}
        $('number-debug').textContent+=`\nESSAI ${label} ${ink?'encre':'couleur'}\n`;
        const result=await engine.read(canvas,{pageMode:'6'});
        $('number-debug').textContent+=`FRACTION ${JSON.stringify(collectorFromTsv(result.wordData))}\n`;
      }
    }
    return null; // This comparison never affects card ranking.
  } finally {canvas.width=canvas.height=0;}
}
let analysis = null;
window.addEventListener('pagehide', () => analysis?.abort());
document.addEventListener('visibilitychange', () => { if (document.hidden) analysis?.abort(); });
$('run').addEventListener('click', async () => {
  analysis?.abort(); const controller = new AbortController(); analysis = controller;
  $('number-debug').textContent = '';
  $('number-crops').replaceChildren();
  $('candidates').replaceChildren(); $('result-notice').textContent = '';
  $('run').disabled = true; $('result').textContent = 'Chargement de la référence publique…';
  try {
    const key = $('example').value, language = key.split(':')[0], id = `tcgdex:${key}`;
    const photo=$('photo').files?.[0]; let bitmap,card;
    if(photo){
      if(photo.type!=='image/jpeg'||photo.size>3*1024*1024)throw new Error('JPEG ≤3 Mio requis.');
      bitmap=await createImageBitmap(photo);
    }else{
      const cardResponse = await fetch(`/api/card?${new URLSearchParams({ id })}`);
      if (!cardResponse.ok) throw new Error('Fiche indisponible');
      card = await cardResponse.json();
      for (const source of card.images) {
        const image = await fetch(`/api/reference?${new URLSearchParams({ url: source.url })}`);
        if (image.ok) { bitmap = await createImageBitmap(await image.blob()); break; }
      }
    }
    if (!bitmap) throw new Error('Image indisponible');
    if(bitmap.width*bitmap.height>5000000){bitmap.close();throw new Error('Photo limitée à 5 mégapixels.');}
    const sourceSize=`${bitmap.width} × ${bitmap.height}`, original=photo&&$('original').checked;
    const canvas = $('input'), ctx = canvas.getContext('2d'); canvas.width = original?bitmap.width:900; canvas.height = original?bitmap.height:1257;
    ctx.fillStyle = '#777'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.save(); ctx.translate(canvas.width/2, canvas.height/2); if(!photo){ctx.rotate(.018); ctx.filter = 'blur(0.4px)';}
    ctx.drawImage(bitmap, -canvas.width/2, -canvas.height/2, canvas.width, canvas.height); ctx.restore(); bitmap.close();
    const blob = original ? photo : await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', photo ? .9 : .82));
    $('result').textContent = 'Comparaison visuelle, sans lire le nom…';
    const response = await fetch(`/api/visual/recognize?${new URLSearchParams({ language, verify: '1' })}`, { method: 'POST', headers: { 'Content-Type': 'image/jpeg' }, body: blob, signal: controller.signal });
    const result = await response.json(); if (!response.ok) throw new Error(result.error);
    const ocrStarted=performance.now();let observed=null;
    const verified = await resolveAutomatically(result, { signal: controller.signal,
      timeoutMs: $('experiments').checked ? 30000 : 8000,
      read: $('experiments').checked ? compareCrops : async (...args)=>observed=await readCollectorFooter(...args),
      onProgress: text => { $('result').textContent = text; },
      createEngine: async signal => {
        const engine = await createLocalOcr('EN', () => {}, signal), read = engine.read.bind(engine);
        engine.read = async (...args) => {
          const preview = document.createElement('canvas'); preview.width=args[0].width; preview.height=args[0].height;
          preview.getContext('2d').drawImage(args[0],0,0); $('number-crops').append(preview);
          const result = await read(...args);
          if (!signal.aborted) $('number-debug').textContent += `${result.rawText}\n${result.wordData}\n`;
          return result;
        };
        return engine;
      } });
    if (controller.signal.aborted) return;
    renderCandidates($('candidates'), verified.candidates.map(({card})=>({reference:{card,
      url:`/api/reference?${new URLSearchParams({url:card.images[0].url})}`}})), {
      visual:true, ambiguous:verified.ambiguous, onSelect: id => { $('result').textContent = `Sélection explicite : ${id} · diagnostic, aucun ajout.`; }});
    $('result-notice').textContent = resolutionMessage(verified.resolution);
    const inputLabel=photo?`Photo importée ${sourceSize}, analysée ${canvas.width} × ${canvas.height}`:`Attendu : ${card.name} (${id})`;
    $('result').textContent = `${inputLabel} · premier candidat : ${verified.candidates[0]?.card.name || 'aucun'} (${verified.candidates[0]?.card.id||'—'}) ${photo?'':`· bonne référence : ${verified.candidates[0]?.card.id === id ? 'oui' : 'non'}`} · ${result.indexed} références ${language} · moteur PC ${result.milliseconds} ms. Contrôle OCR forcé dans ce diagnostic local seulement : ${verified.resolution} · numéro lu : ${observed?.label || 'non confirmé'} · OCR + démarrage ${Math.round(performance.now()-ocrStarted)} ms.`;
  } catch (error) { $('result').textContent = `Échec : ${error.message}`; }
  finally { $('run').disabled = false; }
});
