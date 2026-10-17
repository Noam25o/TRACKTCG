// Specialized OCR only. All assets are served by this prototype, not a CDN.
import { normalizeCardSuffix, readCardSuffix } from './vision.mjs';
export { createNameGate } from './vision.mjs';
export function normalizeOcr(value) {
  return String(value).normalize('NFKC').toLowerCase().normalize('NFD')
    .replace(/([a-z])[\u0300-\u036f]+/g, '$1').normalize('NFC')
    .replace(/[’‘]/g, "'").replace(/\s+/g, ' ').trim();
}

export function resolveOcrName(text, language, dictionary) {
  const column = { FR: 1, EN: 2, JP: 3 }[language];
  if (!column || typeof text !== 'string' || text.length > 500) return null;
  const input = normalizeOcr(text);
  const matches = dictionary.entries.filter((entry) => {
    const name = normalizeOcr(entry[column]);
    if (language === 'JP') return input.includes(name);
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(^|[^a-z])${escaped}(?=$|[^a-z]|(?:vmax|vstar|v-union|break|gx|ex|lv\\.?x|v)(?:$|[^a-z]))`, 'u').test(input);
  });
  // リザード must not steal リザードン; multi-Pokémon titles remain ambiguous.
  const unique = matches.filter((entry) => !matches.some((other) => other !== entry
    && normalizeOcr(other[column]).includes(normalizeOcr(entry[column]))));
  if (unique.length !== 1) return null;
  const suffix = readCardSuffix(text.split(/\r?\n/).map(normalizeOcr).join('\n'), normalizeOcr(unique[0][column]));
  return { key: unique[0][0], name: unique[0][column], french: unique[0][1], suffix };
}

// Ignore small evolution captions. On old cards “Évolution de Pikachu” is
// printed just above “Raichu”; reading both would identify the wrong Pokémon.
export function titleWords(tsv, language, minimumConfidence = language === 'JP' ? 20 : 45) {
  if (typeof tsv !== 'string') return '';
  const japanese = /[\p{Script=Katakana}\p{Script=Hiragana}\p{Script=Han}]/u;
  let allWords = tsv.split('\n').slice(1).map((line) => line.split('\t'))
    .filter((columns) => columns[0] === '5' && Number(columns[10]) >= minimumConfidence
      && /\p{L}/u.test(columns[11] || '') && Number(columns[9]) > 5);
  const lineTexts = new Map();
  for (const word of allWords) {
    const key = word.slice(1, 5).join(':');
    lineTexts.set(key, `${lineTexts.get(key) || ''} ${word[11]}`);
  }
  const captions = new Set([...lineTexts].filter(([, text]) => /\bevolves?\s+from\b|\bevolution\s+de\b|\bevolue\s+de\b/.test(normalizeOcr(text)))
    .map(([key]) => key));
  allWords = allWords.filter((word) => !captions.has(word.slice(1, 5).join(':')));
  const words = language === 'JP' ? allWords.filter((word) => japanese.test(word[11])) : allWords;
  const maxHeight = Math.max(0, ...words.map((columns) => Number(columns[9])));
  const selected = words.filter((word) => Number(word[9]) >= maxHeight * .65);
  const kept = new Set(selected);
  // Smaller Latin suffixes are meaningful in Japanese too. Preserve only
  // bounded suffix tokens just to the right of a large title word, on its row.
  for (let i = 0; i < allWords.length; i++) {
    for (let size = 1; size <= 3 && i + size <= allWords.length; size++) {
      const run = allWords.slice(i, i + size);
      if (!normalizeCardSuffix(run.map((word) => word[11]).join(''))) continue;
      if (run.some((word) => word.slice(1, 5).join(':') !== run[0].slice(1, 5).join(':')
        || Number(word[10]) < 45 || Number(word[9]) < maxHeight * .25)) continue;
      const left = Number(run[0][6]), top = Math.min(...run.map((word) => Number(word[7])));
      const bottom = Math.max(...run.map((word) => Number(word[7]) + Number(word[9])));
      const anchor = selected.find((word) => {
        const gap = left - (Number(word[6]) + Number(word[8]));
        const overlap = Math.min(bottom, Number(word[7]) + Number(word[9])) - Math.max(top, Number(word[7]));
        return gap >= -5 && gap <= maxHeight * 2 && overlap >= Math.min(bottom - top, Number(word[9])) * .35;
      });
      if (anchor) for (const word of run) {
        if (!kept.has(word)) { selected.push([...word.slice(0, 1), ...anchor.slice(1, 5), ...word.slice(5)]); kept.add(word); }
      }
    }
  }
  selected.sort((a, b) => Number(a[7]) - Number(b[7]) || Number(a[6]) - Number(b[6]));
  const lines = new Map();
  for (const columns of selected) {
    // Keep separate lines separate: joining Japanese evolution/title lines can
    // manufacture a name that was never printed. Only join word fragments.
    const key = columns.slice(1, 5).join(':');
    if (!lines.has(key)) lines.set(key, []);
    lines.get(key).push(columns);
  }
  return [...lines.values()].map((words) => words.sort((a, b) => Number(a[6]) - Number(b[6]))
    .map((word) => word[11]).join(language === 'JP' ? '' : ' ')).join('\n');
}

// Dark title strokes over the full-art background of Japanese promo cards.
// This is an alternate bounded pass, not a guessed or translated OCR answer.
export function titleInk(rgba) {
  for (let i = 0; i < rgba.length; i += 4) {
    const red = rgba[i], green = rgba[i + 1], blue = rgba[i + 2];
    const dark = .299 * red + .587 * green + .114 * blue < 95
      && Math.max(red, green, blue) - Math.min(red, green, blue) < 65;
    rgba[i] = rgba[i + 1] = rgba[i + 2] = dark ? 0 : 255; rgba[i + 3] = 255;
  }
  return rgba;
}

export async function readCardTitle(engine, card, language) {
  const crop = document.createElement('canvas'), ctx = crop.getContext('2d', { willReadFrequently: true });
  const regions = language === 'JP'
    ? [{ x: .14, y: .025, width: .56, height: .075, pageMode: '7' },
      { x: .14, y: .025, width: .56, height: .075, pageMode: '7', ink: true },
      { x: .025, y: .005, width: .88, height: .18, pageMode: '6' }]
    : [{ x: .06, y: .035, width: .84, height: .075, pageMode: '6' },
      { x: .15, y: .037, width: .55, height: .052, pageMode: '7' },
      { x: .15, y: .037, width: .55, height: .052, pageMode: '7', ink: true },
      { x: .025, y: .005, width: .88, height: .18, pageMode: '6' }];
  try {
    let result, best = null, targetedHypothesis = null;
    for (const region of regions) {
      if (best && region.ink) continue;
      crop.width = 920;
      crop.height = Math.round(900 * card.height * region.height / (card.width * region.width)) + 20;
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, crop.width, crop.height);
      ctx.drawImage(card, card.width * region.x, card.height * region.y, card.width * region.width,
        card.height * region.height, 10, 10, 900, crop.height - 20);
      if (region.ink) {
        const pixels = ctx.getImageData(0, 0, crop.width, crop.height);
        titleInk(pixels.data); ctx.putImageData(pixels, 0, 0);
      }
      result = await engine.read(crop, { pageMode: region.pageMode });
      // Stylized Latin suffix logos can lower confidence for the whole glued
      // title. Use it only as a search hypothesis if the tight original AND
      // its ink extraction agree on an exact dictionary name + known suffix.
      // No fuzzy correction, no wider/evolution text, no claimed probability.
      if (!result.name && language !== 'JP' && region.width < .8 && result.titleHypothesis?.suffix) {
        const hypothesis = result.titleHypothesis;
        if (!region.ink) targetedHypothesis = hypothesis;
        else if (targetedHypothesis?.key === hypothesis.key && targetedHypothesis.suffix === hypothesis.suffix) {
          return { ...result, name: hypothesis, hypothesis: true };
        }
      }
      if (result.name) {
        if (best && result.name.key !== best.name.key) return { ...result, name: null };
        // The narrow JP crop may cut “VMAX” after “V”. Only the wide pass is
        // allowed to supply a suffix for the final captured search.
        best = language === 'JP' && region.width < .8
          ? { ...result, name: { ...result.name, suffix: null } } : result;
        if (language !== 'JP' || region.width > .8) return best;
      }
    }
    return best || result;
  } finally { ctx.clearRect(0, 0, crop.width, crop.height); crop.width = crop.height = 0; }
}

// Small cancellable bridge to the PINNED v7 Tesseract worker protocol.
// Owning the worker lets us terminate even during model download/initialization.
export function createOcrBridge(worker, onProgress = () => {}) {
  const jobs = new Map(); let next = 0, closed = false;
  function close(error = new Error('Lecture arrêtée.')) {
    if (closed) return; closed = true; worker.terminate();
    for (const job of jobs.values()) { clearTimeout(job.timer); job.reject(error); }
    jobs.clear();
  }
  worker.addEventListener('error', () => close(new Error('Moteur OCR indisponible. Utilise la recherche manuelle.')));
  worker.addEventListener('message', ({ data }) => {
    const job = jobs.get(data.jobId); if (!job) return;
    if (data.status === 'progress') { onProgress(data.data); return; }
    jobs.delete(data.jobId); clearTimeout(job.timer);
    if (data.status === 'resolve') job.resolve(data.data);
    else job.reject(new Error('Lecture OCR impossible. Réessaie ou utilise la recherche manuelle.'));
  });
  return {
    close,
    request(action, payload, timeout = 45000) {
      if (closed) return Promise.reject(new Error('Lecture arrêtée.'));
      const jobId = `tracktcg-${++next}`;
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => close(new Error('Chargement OCR trop long. Vérifie la connexion puis réessaie.')), timeout);
        jobs.set(jobId, { resolve, reject, timer });
        worker.postMessage({ workerId: 'tracktcg', jobId, action, payload });
      });
    },
  };
}

export async function createLocalOcr(language, onProgress = () => {}, signal) {
  const code = { FR: 'fra', EN: 'eng', JP: 'jpn' }[language];
  if (!code) throw new Error('Langue OCR invalide.');
  const response = await fetch('/pokemon-names.json', { signal });
  if (!response.ok) throw new Error('Dictionnaire indisponible.');
  const dictionary = await response.json();
  if (signal?.aborted) throw new DOMException('Annulé', 'AbortError');
  const bridge = createOcrBridge(new Worker('/ocr-assets/worker.min.js'), onProgress);
  const cancel = () => bridge.close(); signal?.addEventListener('abort', cancel, { once: true });
  const terminate = () => { signal?.removeEventListener('abort', cancel); bridge.close(); };
  try {
    await bridge.request('load', { options: { lstmOnly: true, corePath: '/ocr-assets/core' } });
    await bridge.request('loadLanguage', { langs: [code], options: { langPath: '/ocr-assets/lang',
      gzip: true, lstmOnly: true, cachePath: 'tracktcg.ocr.v1', cacheMethod: 'write' } });
    await bridge.request('initialize', { langs: [code], oem: 1, config: {} });
    await bridge.request('setParameters', { params: { tessedit_pageseg_mode: language === 'JP' ? '7' : '6', user_defined_dpi: '300' } });
  } catch (error) { terminate(); throw error; }
  const engine = {
    async read(canvas, { pageMode = language === 'JP' ? '7' : '6' } = {}) {
      if (!['6', '7'].includes(pageMode)) throw new Error('Mode OCR invalide.');
      await bridge.request('setParameters', { params: { tessedit_pageseg_mode: pageMode } });
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error('Image du flux illisible.');
      const data = await bridge.request('recognize', { image: new Uint8Array(await blob.arrayBuffer()),
        options: {}, output: { text: true, tsv: true } }, 15000);
      const text = titleWords(data.tsv, language);
      return { name: resolveOcrName(text, language, dictionary),
        titleHypothesis: language === 'JP' ? null : resolveOcrName(titleWords(data.tsv, language, 0), language, dictionary),
        text, rawText: data.text, wordData: data.tsv, confidence: data.confidence };
    },
    terminate,
  };
  engine.readCard = (card) => readCardTitle(engine, card, language);
  return engine;
}
