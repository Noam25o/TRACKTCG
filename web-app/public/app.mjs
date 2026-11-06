import { WIDTH, HEIGHT, coverCrop, describe, rankReferences, createStabilityGate, qualityIssue, createNameGate, assessSnapshot,
  scannedNameLabel, suffixSearchQuery, readCardSuffix } from './vision.mjs';
import { renderCandidates } from './candidates.mjs';
import { resolveAutomatically, resolutionMessage } from './automatic.mjs';

const $ = (id) => document.getElementById(id);
const video = $('video'), guide = $('guide'), viewfinder = $('viewfinder');
const canvas = document.createElement('canvas');
canvas.width = WIDTH; canvas.height = HEIGHT;
const context = canvas.getContext('2d', { willReadFrequently: true });
const gate = createStabilityGate();
let references = [], stream = null, cameraGeneration = 0, catalogGeneration = 0;
let cameraPending = false, catalogAbort = null, frameHandle = null, frames = 0, lastAnalysis = 0, lastVideoTime = -1;
let recentRanking = [], prepared = false;
let autoSession = null;
let automaticAvailable = null;
let visualAvailable = false, visualCounts = {}, visualBusy = false, visualAbort = null;
const visualMode = () => $('scan-mode').value === 'visual';
const autoMode = () => $('scan-mode').value === 'auto';
const scannerAvailable = () => visualMode() ? visualAvailable && visualCounts[$('language').value] > 0 : autoMode() ? automaticAvailable === true : prepared;
const nameGate = createNameGate();
const titleCanvas = document.createElement('canvas');
titleCanvas.width = 900; titleCanvas.height = 135;
const titleContext = titleCanvas.getContext('2d', { willReadFrequently: true });
const still = $('scan-still'), stillContext = still.getContext('2d', { willReadFrequently: true });
const workingCard = document.createElement('canvas');
workingCard.width = 1080; workingCard.height = Math.round(1080 * HEIGHT / WIDTH);
const workingContext = workingCard.getContext('2d', { willReadFrequently: true });
let snapshotProcessing = false;

function status(id, message, error = false) {
  $(id).textContent = message; $(id).classList.toggle('error', error);
}
function controls() {
  $('start').disabled = !scannerAvailable() || Boolean(stream) || cameraPending || snapshotProcessing;
  $('stop').disabled = !stream && !cameraPending && !snapshotProcessing;
  $('start').textContent = cameraPending ? 'Autorise la caméra…' : !still.hidden ? 'Recadrer' : 'Scanner';
  $('capture').hidden = !stream;
  $('capture').disabled = !stream || video.readyState < 2 || Boolean(autoSession?.loading) || visualBusy;
  $('capture').textContent = visualMode() ? (visualBusy ? 'Analyse en cours…' : 'Analyser la carte') : 'Figer et analyser';
  $('camera-privacy').textContent = visualMode() ? 'Capture analysée sur ton PC · via Cloudflare' : 'L’image reste sur ton téléphone';
}
function resetCandidates() { gate.reset(); recentRanking = []; $('inspect').hidden = true; }
function cancelFrame() {
  if (frameHandle === null) return;
  if (video.cancelVideoFrameCallback) video.cancelVideoFrameCallback(frameHandle);
  else cancelAnimationFrame(frameHandle);
  frameHandle = null;
}
function stopCamera(message = 'Caméra en pause.') {
  visualAbort?.abort(); visualAbort = null; visualBusy = false;
  cameraGeneration++; cameraPending = false; cancelFrame(); resetCandidates();
  if (autoSession) { autoSession.abort.abort(); autoSession.engine?.terminate(); autoSession = null; }
  nameGate.reset(); titleContext.clearRect(0, 0, titleCanvas.width, titleCanvas.height);
  snapshotProcessing = false; still.hidden = true;
  stillContext.clearRect(0, 0, still.width, still.height); still.width = still.height = 0;
  workingContext.clearRect(0, 0, workingCard.width, workingCard.height);
  // Cancel an automatically loading lot too: a late fetch must not revive it.
  catalogGeneration++; catalogAbort?.abort(); catalogAbort = null; $('prepare').disabled = false; $('progress').hidden = true;
  if (stream) { for (const track of stream.getTracks()) track.stop(); stream = null; }
  video.pause(); video.srcObject = null; context.clearRect(0, 0, WIDTH, HEIGHT);
  $('camera-placeholder').hidden = false; $('camera-state').textContent = 'EN PAUSE';
  controls(); status('scan-status', message);
}
function invalidateLot() {
  catalogGeneration++; catalogAbort?.abort(); catalogAbort = null;
  prepared = false; references = []; $('metric-index').textContent = '0';
  $('reference-details').hidden = true; $('reference-list').replaceChildren();
  $('progress').hidden = true; $('results').hidden = true; $('prepare').disabled = false;
  stopCamera(visualMode() ? 'Prêt · active la caméra et cadre la carte entière.'
    : autoMode() ? 'Prêt à lire une nouvelle carte.' : 'Le lot a changé : charge les nouvelles références.');
  status('catalog-status', autoMode() ? 'Le nom sera lu sur la carte.' : 'Charge les références pour la langue et le nom sélectionnés.');
  if (visualMode()) {
    $('metric-index').textContent = String(visualCounts[$('language').value] || 0);
    status('catalog-status', `Index de validation · ${visualCounts[$('language').value] || 0} références · carte entière, sans lecture obligatoire du nom.`);
  }
}
for (const id of ['query', 'language']) $(id).addEventListener(id === 'query' ? 'input' : 'change', invalidateLot);
$('scan-mode').addEventListener('change', () => {
  $('manual-setup').hidden = $('scan-mode').value !== 'manual'; invalidateLot();
  if (autoMode() && automaticAvailable === false) status('scan-status', 'Mise à jour du serveur requise pour l’OCR. Utilise la recherche manuelle.', true);
});

async function getJson(url, signal) {
  const response = await fetch(url, { signal, cache: 'no-store' });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Source inaccessible. Réessaie.');
  return data;
}
const referenceUrl = (source) => `/api/reference?${new URLSearchParams({ url: source })}`;

async function decodeBlob(blob, signal) {
  if (signal.aborted) throw new DOMException('Annulé', 'AbortError');
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(blob);
    if (signal.aborted) { bitmap.close(); throw new DOMException('Annulé', 'AbortError'); }
    return { image: bitmap, release: () => bitmap.close() };
  }
  const url = URL.createObjectURL(blob), image = new Image();
  try {
    await new Promise((resolve, reject) => {
      const cleanup = () => { clearTimeout(timer); signal.removeEventListener('abort', abort); };
      const abort = () => { cleanup(); image.src = ''; reject(new DOMException('Annulé', 'AbortError')); };
      const timer = setTimeout(() => { cleanup(); reject(new Error('Décodage trop long.')); }, 10000);
      signal.addEventListener('abort', abort, { once: true });
      image.onload = () => { cleanup(); resolve(); };
      image.onerror = () => { cleanup(); reject(new Error('Image inexploitable.')); };
      image.src = url;
    });
    return { image, release: () => URL.revokeObjectURL(url) };
  } catch (error) { URL.revokeObjectURL(url); throw error; }
}

async function indexReference(card, signal) {
  for (const source of card.images) {
    let decoded;
    try {
      const url = referenceUrl(source.url);
      const response = await fetch(url, { signal, cache: 'no-store' });
      if (!response.ok) continue;
      decoded = await decodeBlob(await response.blob(), signal);
      if (signal.aborted) throw new DOMException('Annulé', 'AbortError');
      const scratch = document.createElement('canvas'); scratch.width = WIDTH; scratch.height = HEIGHT;
      const ctx = scratch.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(decoded.image, 0, 0, WIDTH, HEIGHT);
      const descriptor = describe(ctx.getImageData(0, 0, WIDTH, HEIGHT).data);
      ctx.clearRect(0, 0, WIDTH, HEIGHT);
      return { card, descriptor, url, source: source.source };
    } catch (error) { if (signal.aborted) throw error; }
    finally { decoded?.release(); }
  }
  return null;
}

async function prepareReferences(input, language, automatic = false, suffix = null) {
  catalogGeneration++; catalogAbort?.abort(); resetCandidates(); references = []; prepared = false;
  const generation = catalogGeneration;
  const controller = new AbortController(); catalogAbort = controller;
  $('prepare').disabled = true;
  const started = performance.now();
  const searchInput = suffix ? suffixSearchQuery(input, suffix) : input;
  const label = suffix ? `${input} ${suffix}` : input;
  try {
    status('catalog-status', 'Recherche des fiches TCGdex…');
    const cards = []; let query = input, capped = false;
    for (let page = 1; page <= 3; page++) {
      const result = await getJson(`/api/catalog?${new URLSearchParams({ query: searchInput, language, page })}`, controller.signal);
      if (generation !== catalogGeneration) return;
      cards.push(...result.cards); query = suffix ? label : result.query; capped = result.limitReached;
      if (!result.hasMore) break;
    }
    const unique = [...new Map(cards.map((card) => [card.id, card])).values()]
      .filter((card) => !suffix || readCardSuffix(card.name, input) === suffix);
    if (!unique.length) throw new Error(suffix ? `Aucune référence pour ${label}. Suffixe lu à vérifier ; essaie la recherche manuelle.`
      : 'Aucune fiche trouvée. Essaie un nom complet comme Dracaufeu ou Évoli.');
    $('progress').hidden = false; $('progress').max = unique.length; $('progress').value = 0;
    let next = 0, completed = 0;
    const indexed = new Array(unique.length);
    // At most three reference downloads/decodes at once; no image corpus on disk.
    await Promise.all(Array.from({ length: Math.min(3, unique.length) }, async () => {
      while (next < unique.length && !controller.signal.aborted) {
        const index = next++; indexed[index] = await indexReference(unique[index], controller.signal);
        if (generation !== catalogGeneration) return;
        completed++; $('progress').value = completed;
        status('catalog-status', `${label}${!suffix && query !== input ? ` → ${query}` : ''} · préparation ${completed}/${unique.length}`);
      }
    }));
    if (generation !== catalogGeneration) return;
    references = indexed.filter(Boolean); prepared = references.length > 0;
    $('metric-index').textContent = String(references.length);
    const missing = unique.length - references.length;
    status('catalog-status', `${references.length}/${unique.length} références · ${((performance.now() - started) / 1000).toFixed(1)} s` +
      (missing ? ` · ${missing} image(s) manquante(s)` : '') + (suffix ? ` · suffixe ${suffix}` : query !== input ? ` · ${input} → ${query}` : '') +
      (capped ? '. Lot limité à 72 fiches.' : '') +
      (!prepared ? ' Essaie un autre Pokémon.' : ''), !prepared);
    $('reference-count').textContent = `Voir les ${references.length} références`;
    $('reference-details').hidden = !prepared;
    $('reference-list').replaceChildren(...references.map(({ card }) => {
      const item = document.createElement('p'); item.textContent = `${card.name} · ${card.setCode} ${card.number} · ${card.language}`; return item;
    }));
    status('scan-status', prepared ? (automatic ? 'Nom lu. Comparaison de ta carte…' : 'Prêt. Cadre ta carte, puis scanne.') : 'Aucune référence exploitable.');
    return prepared;
  } catch (error) {
    if (generation === catalogGeneration && !controller.signal.aborted) status('catalog-status', error.message, true);
    return false;
  } finally {
    if (generation === catalogGeneration) { $('prepare').disabled = false; $('progress').hidden = true; catalogAbort = null; controls(); }
  }
}
$('catalog-form').addEventListener('submit', async (event) => {
  event.preventDefault(); $('query').blur(); invalidateLot();
  await prepareReferences($('query').value.trim(), $('language').value);
});

function cameraCrop() {
  const view = viewfinder.getBoundingClientRect(), frame = guide.getBoundingClientRect();
  return coverCrop(video.videoWidth, video.videoHeight, viewfinder.clientWidth, viewfinder.clientHeight,
    { x: frame.left - view.left - viewfinder.clientLeft, y: frame.top - view.top - viewfinder.clientTop,
      width: frame.width, height: frame.height });
}

function freezeCard(source, crop) {
  still.width = workingCard.width; still.height = workingCard.height;
  if (crop) stillContext.drawImage(source, crop.x, crop.y, crop.width, crop.height, 0, 0, still.width, still.height);
  else stillContext.drawImage(source, 0, 0, still.width, still.height);
  context.drawImage(still, 0, 0, WIDTH, HEIGHT);
  const descriptor = describe(context.getImageData(0, 0, WIDTH, HEIGHT).data);
  context.clearRect(0, 0, WIDTH, HEIGHT);
  const issue = qualityIssue(descriptor.quality);
  if (issue) { still.width = still.height = 0; status('scan-status', issue, true); return null; }
  cancelFrame();
  if (stream) { const capturedStream = stream; stream = null; capturedStream.getTracks().forEach((track) => track.stop()); }
  video.pause(); video.srcObject = null; still.hidden = false;
  $('camera-placeholder').hidden = true; $('camera-state').textContent = 'IMAGE FIGÉE';
  snapshotProcessing = true; controls();
  status('scan-status', 'Image gardée sur ce téléphone · tu peux bouger. Analyse en cours…');
  return descriptor;
}

function compareStill(descriptor, generation) {
  if (generation !== cameraGeneration) return;
  snapshotProcessing = false;
  const ranking = rankReferences(descriptor, references), result = assessSnapshot(ranking, descriptor.quality);
  recentRanking = result.ambiguous ? ranking : []; $('inspect').hidden = !result.ambiguous;
  status('scan-status', result.message, !result.ready && !result.ambiguous); controls();
  if (result.ready) showCandidates(ranking);
}

async function finishSnapshot(session, descriptor, generation, knownName = null) {
  if (session.processing) return;
  session.processing = true;
  const started = performance.now();
  try {
    const engine = await session.ready;
    if (session !== autoSession || generation !== cameraGeneration) return;
    // The live JP crop can clip a suffix. Never keep its partial V if the
    // captured wide-title verification cannot resolve the suffix.
    let name = knownName && $('language').value === 'JP' ? { ...knownName, suffix: null } : knownName;
    // One still is not temporal consensus. Bounded alternate crops/ink pass;
    // exact native-name matching, then visual comparison + human confirmation.
    if (!name || $('language').value === 'JP') {
      const read = await engine.readCard(still);
      if (session !== autoSession || generation !== cameraGeneration) return;
      if (name && read.name && read.name.key !== name.key) name = null;
      else name = read.name || name;
    }
    titleContext.clearRect(0, 0, titleCanvas.width, titleCanvas.height);
    engine.terminate(); session.engine = null;
    if (!name) {
      status('scan-status', 'Nom non reconnu sur cette image. Recadre ou passe en recherche manuelle.', true); return;
    }
    status('scan-status', `Titre lu : ${scannedNameLabel(name)} · comparaison de l’image figée…`);
    session.loading = true;
    const loaded = await prepareReferences(name.name, $('language').value, true, name.suffix);
    if (session !== autoSession || generation !== cameraGeneration) return;
    session.loading = false; session.loaded = loaded;
    $('metric-ms').textContent = `${((performance.now() - started) / 1000).toFixed(1)} s · image figée`;
    if (loaded) compareStill(descriptor, generation);
    else status('scan-status', 'Aucune référence exploitable. Recadre ou utilise la recherche manuelle.', true);
  } catch (error) {
    if (session === autoSession && generation === cameraGeneration) status('scan-status', `${error.message} Recadre ou utilise la recherche manuelle.`, true);
  } finally {
    if (session === autoSession && generation === cameraGeneration) {
      session.engine?.terminate(); session.engine = null; session.processing = false; snapshotProcessing = false; controls();
    }
  }
}

function captureFrame() {
  if (visualMode()) { void captureVisual(); return; }
  if (!stream || video.readyState < 2 || autoSession?.loading) return;
  try {
    const descriptor = freezeCard(video, cameraCrop());
    if (!descriptor) return;
    if (!autoMode()) { compareStill(descriptor, cameraGeneration); return; }
    const session = autoSession;
    session.snapshot = descriptor;
    // If a live OCR is still running, discard its answer and serialize the
    // captured analysis behind it. Never send concurrent jobs to one worker.
    if (!session.busy) void finishSnapshot(session, descriptor, cameraGeneration);
  } catch (error) { stopCamera(`Capture interrompue : ${error.message}`); }
}

async function captureVisual() {
  if (!stream || video.readyState < 2 || visualBusy) return;
  const generation = cameraGeneration, controller = new AbortController(); visualAbort = controller; visualBusy = true; controls();
  const image = document.createElement('canvas'); image.width = 900; image.height = 1257;
  try {
    const crop = cameraCrop();
    image.getContext('2d').drawImage(video, crop.x, crop.y, crop.width, crop.height, 0, 0, image.width, image.height);
    const blob = await new Promise((resolve) => image.toBlob(resolve, 'image/jpeg', .9));
    image.width = image.height = 0;
    if (!blob || generation !== cameraGeneration || controller.signal.aborted) return;
    status('scan-status', 'Capture envoyée à ton PC · tu peux bouger. Recherche visuelle…');
    const response = await fetch(`/api/visual/recognize?${new URLSearchParams({ language: $('language').value })}`, {
      method: 'POST', headers: { 'Content-Type': 'image/jpeg' }, body: blob, signal: controller.signal, cache: 'no-store',
    });
    const result = await response.json();
    if (generation !== cameraGeneration || controller.signal.aborted) return;
    if (!response.ok) throw new Error(result.error || 'Analyse indisponible.');
    $('metric-ms').textContent = `${result.milliseconds} ms · moteur PC`;
    frames++; $('metric-frames').textContent = String(frames);
    if (!result.candidates.length) {
      status('scan-status', 'Pas de correspondance vérifiable dans cet index de test. Réessaie ou cherche dans le catalogue.', true); return;
    }
    const verified = await resolveAutomatically(result, { signal: controller.signal,
      onProgress: message => { if (generation === cameraGeneration) status('scan-status', message); } });
    if (generation !== cameraGeneration || controller.signal.aborted) return;
    const ranking = verified.candidates.map(({ card }) => ({ reference: { card, url: referenceUrl(card.images[0].url) } }));
    showCandidates(ranking, { visual: true, ambiguous: verified.ambiguous, resolution: verified.resolution });
  } catch (error) {
    if (generation === cameraGeneration && !controller.signal.aborted) status('scan-status', error.message, true);
  } finally {
    image.width = image.height = 0;
    if (generation === cameraGeneration) { visualBusy = false; visualAbort = null; controls(); }
  }
}

async function readName(crop, generation, now) {
  const session = autoSession;
  if (!session || session.busy || session.loaded || session.loading || now - session.lastRead < 1000) return;
  session.busy = true; session.lastRead = now;
  try {
    const engine = await session.ready;
    if (session !== autoSession || generation !== cameraGeneration) return;
    if (session.snapshot) return;
    workingContext.drawImage(video, crop.x, crop.y, crop.width, crop.height, 0, 0, workingCard.width, workingCard.height);
    // Read only the title strip, not attacks/evolution names or the whole card.
    const title = $('language').value === 'JP' ? { x: .14, y: .025, width: .56 } : { x: .06, y: .035, width: .84 };
    titleCanvas.height = Math.round(titleCanvas.width * (workingCard.height * .075) / (workingCard.width * title.width));
    titleContext.drawImage(workingCard, workingCard.width * title.x, workingCard.height * title.y,
      workingCard.width * title.width, workingCard.height * .075, 0, 0, titleCanvas.width, titleCanvas.height);
    const started = performance.now(), { name } = await engine.read(titleCanvas);
    if (session !== autoSession || generation !== cameraGeneration) return;
    if (session.snapshot) return;
    titleContext.clearRect(0, 0, titleCanvas.width, titleCanvas.height);
    $('metric-ms').textContent = `${Math.round(performance.now() - started)} ms OCR`;
    const confirmed = nameGate.update(name);
    status('scan-status', name ? `Nom lu : ${scannedNameLabel(name)}${confirmed ? ' · recherche des cartes…' : ' · garde la carte immobile'}`
      : 'Lecture du nom… rapproche la carte, droite et sans reflet.');
    if (confirmed) {
      const descriptor = freezeCard(workingCard);
      if (descriptor) { session.snapshot = descriptor; await finishSnapshot(session, descriptor, generation, confirmed); }
    }
  } catch (error) {
    if (session === autoSession && generation === cameraGeneration) {
      stopCamera(); status('scan-status', `${error.message || 'OCR indisponible.'} La recherche manuelle reste disponible.`, true);
    }
  } finally {
    session.busy = false;
    if (session === autoSession && session.snapshot && !session.processing && snapshotProcessing)
      void finishSnapshot(session, session.snapshot, generation);
  }
}

function showCandidates(ranking, { visual = false, ambiguous = false, resolution = 'visual' } = {}) {
  const snapshot = [...ranking];
  stopCamera('Analyse arrêtée pour vérifier les candidats.');
  $('result-title').textContent = visual ? (ambiguous ? 'Plusieurs cartes à vérifier' : 'Meilleure correspondance') : 'Tu reconnais ta carte ?';
  renderCandidates($('candidate-list'), snapshot, { visual, ambiguous,
    onSelect: (id) => document.dispatchEvent(new CustomEvent('tracktcg:open-card', { detail: { id } })) });
  $('result-notice').textContent = visual ? resolutionMessage(resolution) : 'Vérifie le numéro, la langue et la finition.';
  $('resume').textContent = visual && ambiguous ? 'Recadrer la carte' : 'Scanner une autre carte';
  $('results').hidden = false; $('result-title').focus({ preventScroll: true });
  $('results').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
}

function scheduleFrame(generation) {
  if (!stream || generation !== cameraGeneration) return;
  const callback = (now) => {
    frameHandle = null;
    if (!stream || generation !== cameraGeneration || document.hidden) return;
    if (now - lastAnalysis >= 400 && video.readyState >= 2 && !video.paused
      && (video.requestVideoFrameCallback || video.currentTime !== lastVideoTime)) {
      lastAnalysis = now;
      lastVideoTime = video.currentTime;
      try {
        const before = performance.now();
        const crop = cameraCrop();
        controls();
        context.drawImage(video, crop.x, crop.y, crop.width, crop.height, 0, 0, WIDTH, HEIGHT);
        const descriptor = describe(context.getImageData(0, 0, WIDTH, HEIGHT).data);
        if (visualMode()) {
          context.clearRect(0, 0, WIDTH, HEIGHT);
          const issue = qualityIssue(descriptor.quality);
          if (!visualBusy && issue) status('scan-status', issue);
          scheduleFrame(generation); return;
        }
        if (autoMode() && !autoSession?.loaded) {
          context.clearRect(0, 0, WIDTH, HEIGHT);
          frames++; $('metric-frames').textContent = String(frames);
          // One OCR task at a time; loading references leaves the preview live.
          const issue = qualityIssue(descriptor.quality);
          if (issue) { nameGate.reset(); status('scan-status', issue); }
          else void readName(crop, generation, now);
          scheduleFrame(generation); return;
        }
        const ranking = rankReferences(descriptor, references);
        const result = gate.update(ranking, descriptor.quality);
        frames++; $('metric-frames').textContent = String(frames);
        $('metric-ms').textContent = `${(performance.now() - before).toFixed(1)} ms`;
        status('scan-status', result.message);
        recentRanking = result.ambiguous ? ranking : [];
        $('inspect').hidden = !result.ambiguous;
        context.clearRect(0, 0, WIDTH, HEIGHT);
        if (result.ready) { showCandidates(ranking); return; }
      } catch (error) { stopCamera(`Analyse interrompue : ${error.message}`); return; }
    }
    scheduleFrame(generation);
  };
  frameHandle = video.requestVideoFrameCallback ? video.requestVideoFrameCallback(callback) : requestAnimationFrame(callback);
}

async function startCamera() {
  if (!scannerAvailable() || stream || cameraPending) return;
  if (snapshotProcessing) return;
  if (!still.hidden) stopCamera('Prêt à recadrer.');
  if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
    status('scan-status', 'Caméra indisponible : ouvre ce prototype en HTTPS dans Safari. Une adresse http://192.168… ne suffit pas sur iPhone.', true); return;
  }
  const generation = ++cameraGeneration;
  cameraPending = true; controls(); resetCandidates(); $('results').hidden = true;
  status('scan-status', 'Autorise uniquement la caméra dans Safari. Aucun microphone demandé.');
  try {
    const incoming = await navigator.mediaDevices.getUserMedia({ audio: false,
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } } });
    if (generation !== cameraGeneration || document.hidden) { incoming.getTracks().forEach((track) => track.stop()); return; }
    stream = incoming; video.srcObject = incoming;
    for (const track of incoming.getVideoTracks()) track.addEventListener('ended', () => {
      if (stream === incoming) stopCamera('La caméra a été interrompue. Tu peux la réactiver.');
    });
    await video.play();
    if (generation !== cameraGeneration || document.hidden) return;
    cameraPending = false; controls(); frames = 0; lastAnalysis = 0; lastVideoTime = -1;
    $('metric-frames').textContent = '0'; $('metric-ms').textContent = '—';
    $('camera-placeholder').hidden = true; $('camera-state').textContent = 'EN DIRECT';
    status('scan-status', visualMode() ? 'Cadre la carte entière, puis « Analyser la carte ». La capture sera analysée sur ton PC.'
      : 'Cadre la carte entière, puis « Figer et analyser ». Tu peux ensuite bouger.'); scheduleFrame(generation);
    if (autoMode()) {
      references = []; prepared = false; $('metric-index').textContent = '0'; nameGate.reset();
      $('reference-details').hidden = true; $('reference-list').replaceChildren();
      const session = { abort: new AbortController(), busy: false, loaded: false, loading: false, lastRead: -Infinity, engine: null };
      autoSession = session;
      status('catalog-status', 'Chargement du moteur OCR local… premier lancement plus long.');
      session.ready = import('./ocr.mjs').then(({ createLocalOcr }) => createLocalOcr($('language').value, (progress) => {
        if (autoSession === session && progress.status !== 'recognizing text') status('catalog-status',
          `Moteur OCR local · ${Math.round((progress.progress || 0) * 100)} %`);
      }, session.abort.signal)).then((engine) => {
        if (autoSession !== session) { engine.terminate(); throw new Error('Lecture arrêtée.'); }
        session.engine = engine; status('catalog-status', 'Moteur prêt · cadre le nom en haut de la carte.'); return engine;
      });
      // Handle initialization failure even before the first usable video frame.
      session.ready.catch((error) => {
        if (autoSession === session) { stopCamera(); status('scan-status', `${error.message || 'OCR indisponible.'} Utilise la recherche manuelle.`, true); }
      });
    }
  } catch (error) {
    if (generation !== cameraGeneration) return;
    stopCamera();
    const messages = { NotAllowedError: 'Accès caméra refusé. Autorise la caméra pour ce site dans Safari, puis réessaie.',
      NotFoundError: 'Aucune caméra disponible.', NotReadableError: 'Caméra occupée. Ferme les autres applications caméra et réessaie.' };
    status('scan-status', messages[error.name] || `Caméra inaccessible : ${error.message}`, true);
  }
}
$('start').addEventListener('click', startCamera);
$('capture').addEventListener('click', captureFrame);
$('stop').addEventListener('click', () => stopCamera());
$('inspect').addEventListener('click', () => { if (recentRanking.length) showCandidates(recentRanking); });
$('resume').addEventListener('click', () => { $('results').hidden = true; startCamera(); viewfinder.scrollIntoView({ block: 'center' }); });
document.addEventListener('visibilitychange', () => { if (document.hidden) stopCamera('Caméra arrêtée en arrière-plan. Réactive-la pour reprendre.'); });
window.addEventListener('pagehide', () => { stopCamera(); catalogAbort?.abort(); });
window.addEventListener('resize', resetCandidates);
document.addEventListener('tracktcg:navigate', (event) => { if (event.detail !== 'scanner') stopCamera('Caméra arrêtée en quittant le scanner.'); });
if (!window.isSecureContext) status('scan-status', 'Sur iPhone, ouvre une adresse HTTPS de confiance pour activer la caméra.', true);
controls();
// Static files can be updated before a rolling server restart. Keep the old
// manual scanner usable until the server exposes the new, allowlisted assets.
fetch('/ocr.mjs', { cache: 'no-store' }).then((response) => {
  automaticAvailable = response.ok;
  if (!response.ok && autoMode()) {
    $('scan-mode').value = 'manual'; $('manual-setup').hidden = false;
    status('catalog-status', 'Mise à jour serveur en attente · recherche manuelle disponible.');
  }
  controls();
}).catch(() => {
  automaticAvailable = false; controls();
  status('scan-status', 'Connexion au prototype impossible. Recharge la page ou utilise la recherche manuelle.', true);
});
fetch('/api/visual/status', { cache: 'no-store' }).then(async (response) => {
  if (!response.ok) return;
  const info = await response.json();
  if (!info.indexed) return;
  visualAvailable = true; visualCounts = info.counts;
  $('visual-option').hidden = false;
  if ($('scan-mode').value === 'auto' && !stream && !cameraPending && !snapshotProcessing) {
    $('scan-mode').value = 'visual'; $('manual-setup').hidden = true; invalidateLot(); controls();
  }
}).catch(() => {}); // The legacy scanner remains available without a PC engine.
