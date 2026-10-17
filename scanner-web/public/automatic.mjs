import { readCollectorFooter, normalizeNumber, normalizeSet } from './collector.mjs';

export function reconcileNumber(result, reference) {
  if (!reference) return { ...result, ambiguous: true, resolution: 'unreadable' };
  const matches = result.candidates.filter(({card}) => normalizeNumber(card.number) === reference.number
    && (!reference.set || normalizeSet(card.setCode) === reference.set));
  if (!matches.length) return { ...result, ambiguous: true, resolution: 'conflict' };
  return { ...result, candidates: [...matches, ...result.candidates.filter(c=>!matches.includes(c))],
    ambiguous: matches.length > 1, resolution: matches.length > 1 ? 'ambiguous' : 'number-supported' };
}

async function decodeFooter(encoded) {
  if (typeof encoded !== 'string' || encoded.length > 933336 || !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)) throw new Error('Invalid footer');
  const bytes = Uint8Array.from(atob(encoded), char => char.charCodeAt(0));
  try {
    const blob = new Blob([bytes], {type:'image/png'});
    if (typeof createImageBitmap === 'function') {
      const bitmap = await createImageBitmap(blob);
      return { image: bitmap, release: () => bitmap.close() };
    }
    const url = URL.createObjectURL(blob), image = new Image();
    try {
      await new Promise((resolve,reject) => {
        const timer = setTimeout(() => { image.src=''; reject(new Error('Decode timeout')); }, 5000);
        image.onload = () => { clearTimeout(timer); resolve(); };
        image.onerror = () => { clearTimeout(timer); reject(new Error('Decode failed')); }; image.src = url;
      });
      return {image, release: () => {image.src=''; URL.revokeObjectURL(url);}};
    } catch (error) { URL.revokeObjectURL(url); throw error; }
  } finally { bytes.fill(0); }
}

// No form, click-to-OCR, persistent photo or silent card selection. The capture
// is already on the PC; only its rectified footer returns for local OCR.
export async function resolveAutomatically(result, { signal, onProgress = () => {}, timeoutMs = 8000,
  createEngine = async signal => (await import('./ocr.mjs')).createLocalOcr('EN', () => {}, signal),
  decode = decodeFooter, read = readCollectorFooter } = {}) {
  let encoded = result.verification?.footer;
  const required = result.verification?.required === true;
  // Strip image data before any UI callback or returned result.
  if (result.verification) delete result.verification.footer;
  if (signal?.aborted) throw new DOMException('Annulé','AbortError');
  if (!result.candidates.length || !required) return {...result, resolution:'visual'};
  if (!encoded) return {...result, ambiguous:true, resolution:'unreadable'};
  const controller = new AbortController();
  const cancel = () => controller.abort(); signal?.addEventListener('abort', cancel, {once:true});
  const timer = setTimeout(cancel, timeoutMs);
  let worker = null, decoded = null;
  const aborted = new Promise((_,reject) => controller.signal.addEventListener('abort',
    () => reject(new DOMException('Annulé','AbortError')), {once:true}));
  onProgress('Vérification automatique du numéro… Tu peux bouger le téléphone.');
  const work = (async () => {
    try {
      worker = await createEngine(controller.signal);
      if (controller.signal.aborted) throw new DOMException('Annulé','AbortError');
      decoded = await decode(encoded); encoded = null;
      if (controller.signal.aborted) throw new DOMException('Annulé','AbortError');
      const reference = await read(worker, decoded.image, controller.signal);
      if (controller.signal.aborted) throw new DOMException('Annulé','AbortError');
      return reconcileNumber(result, reference);
    } finally { decoded?.release(); decoded = null; worker?.terminate(); worker = null; encoded = null; }
  })();
  try { return await Promise.race([work, aborted]); }
  catch {
    if (signal?.aborted) throw new DOMException('Annulé','AbortError');
    return {...result, ambiguous:true, resolution:'unreadable'};
  } finally {
    clearTimeout(timer); signal?.removeEventListener('abort',cancel);
    controller.abort(); worker?.terminate(); encoded = null;
  }
}

export function resolutionMessage(resolution) {
  return ({
    'number-supported': 'Numéro compatible avec la proposition principale. Confirme la carte et sa finition.',
    ambiguous: 'Plusieurs impressions restent possibles. Confirme visuellement ou recadre le bas de la carte.',
    conflict: 'Le numéro lu ne correspond pas aux propositions. Recadre le bas de la carte avant de confirmer.',
    unreadable: 'Le numéro reste illisible. Recadre le bas de la carte ou confirme une proposition visuellement.',
    visual: 'Proposition visuelle à confirmer. Vérifie la carte et sa finition.',
  })[resolution] || 'Confirme visuellement la carte.';
}
