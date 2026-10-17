import test from 'node:test';
import assert from 'node:assert/strict';
import { WIDTH, HEIGHT } from '../public/vision.mjs';

// Exercise the real app module with synthetic pixels/DOM and an explicit fake
// camera. This is a lifecycle test, NOT proof of recognition accuracy on iPhone.
test('camera lifecycle and in-memory analysis through the real app module', async (t) => {
  const pixels = new Uint8ClampedArray(WIDTH * HEIGHT * 4);
  for (let i = 0; i < WIDTH * HEIGHT; i++) {
    const value = 50 + ((i * 17) % 160);
    pixels.set([value, value, value, 255], i * 4);
  }
  const ctx = { drawImage() {}, getImageData: () => ({ data: pixels.slice() }), clearRect() {}, fillRect() {}, putImageData() {} };
  class Element {
    constructor() { this.handlers = new Map(); this.classList = { toggle() {} }; this.hidden = false; this.disabled = false; this.children = []; }
    addEventListener(name, callback) { this.handlers.set(name, callback); }
    fire(name) { return this.handlers.get(name)?.({ preventDefault() {} }); }
    replaceChildren(...items) { this.children = items; }
    append(...items) { this.children.push(...items); }
    setAttribute(name, value) { this[name] = value; }
    getContext() { return ctx; }
    focus() {} blur() {} scrollIntoView() {}
  }
  const elements = new Map(); const get = (id) => { if (!elements.has(id)) elements.set(id, new Element()); return elements.get(id); };
  const document = { hidden: false, handlers: new Map(), getElementById: get,
    createElement: () => new Element(), addEventListener(name, fn) { this.handlers.set(name, fn); } };
  const window = { isSecureContext: true, handlers: new Map(), addEventListener(name, fn) { this.handlers.set(name, fn); } };
  const oldGlobals = new Map(['document', 'window', 'navigator', 'fetch', 'createImageBitmap', 'matchMedia', 'Worker'].map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
  t.after(() => { window.handlers.get('pagehide')?.(); for (const [name, descriptor] of oldGlobals) { if (descriptor) Object.defineProperty(globalThis, name, descriptor); else delete globalThis[name]; } });
  Object.defineProperty(globalThis, 'document', { configurable: true, value: document });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: window });
  globalThis.matchMedia = () => ({ matches: true });
  globalThis.createImageBitmap = async () => ({ close() {} });
  const workers = [];
  let heldRecognition = false, recognizedName = 'Raichu';
  class FakeWorker {
    constructor() { this.handlers = new Map(); workers.push(this); }
    addEventListener(name, callback) { this.handlers.set(name, callback); }
    terminate() { this.stopped = true; }
    postMessage(packet) {
      if (packet.action === 'recognize' && heldRecognition) { this.held = packet; return; }
      queueMicrotask(() => { if (!this.stopped) this.handlers.get('message')({ data: {
      jobId: packet.jobId, status: 'resolve', data: packet.action === 'recognize' ? { text: recognizedName, confidence: 95,
        tsv: `level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext\n5\t1\t1\t1\t1\t1\t0\t0\t80\t30\t95\t${recognizedName}` } : {},
    } }); }); }
  }
  globalThis.Worker = FakeWorker;
  Element.prototype.toBlob = function(callback) { callback(new Blob(['synthetic frame'])); };
  const until = async (check) => { for (let n = 0; n < 40; n++) { if (check()) return; await new Promise(setImmediate); }
    assert.ok(check(), `${get('scan-status').textContent} / ${get('catalog-status').textContent}`); };
  let permission, captureCalls = 0, requests = 0, pendingCatalog = null, catalogCards = null;
  const requestedUrls = [];
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { mediaDevices: {
    getUserMedia: async (constraints) => { assert.equal(constraints.audio, false); assert.equal(constraints.video.facingMode.ideal, 'environment'); captureCalls++; return new Promise((resolve) => { permission = resolve; }); },
  } } });
  globalThis.fetch = async (url, options) => {
    requestedUrls.push(url);
    requests++; assert.equal(options.method, undefined); assert.equal(options.body, undefined);
    if (url === '/pokemon-names.json') return new Response(JSON.stringify({ entries: [[26, 'Raichu', 'Raichu', 'ライチュウ']] }));
    if (url.startsWith('/api/catalog')) {
      if (pendingCatalog) await pendingCatalog;
      if (options.signal.aborted) throw new DOMException('Annulé', 'AbortError');
      return new Response(JSON.stringify({ cards: catalogCards || [{ id: 'tcgdex:FR:test-1', name: 'Test', setCode: 'test', number: '1', language: 'FR', images: [{ url: 'https://assets.tcgdex.net/fr/test/1/high.png', source: 'TCGdex' }] }], query: 'Dracaufeu', hasMore: false }), { headers: { 'content-type': 'application/json' } });
    }
    return new Response(new Blob(['reference'], { type: 'image/png' }));
  };
  get('query').value = 'Dracaufeu'; get('language').value = 'FR'; get('scan-mode').value = 'manual';
  const video = get('video'); video.pause = () => {}; video.play = async () => {};
  video.videoWidth = 1280; video.videoHeight = 720; video.readyState = 2;
  let callback; video.requestVideoFrameCallback = (fn) => { callback = fn; return 1; };
  video.cancelVideoFrameCallback = () => { callback = null; };
  const view = get('viewfinder'); view.clientWidth = 360; view.clientHeight = 400; view.clientLeft = 1; view.clientTop = 1;
  view.getBoundingClientRect = () => ({ left: 0, top: 0 });
  get('guide').getBoundingClientRect = () => ({ left: 91, top: 75, width: 180, height: 252 });
  const camera = () => {
    const track = { stopped: false, stop() { this.stopped = true; }, addEventListener() {} };
    return { track, getTracks: () => [track], getVideoTracks: () => [track] };
  };
  await import('../public/app.mjs');
  await t.test('prepares references, then cancels a pending permission safely', async () => {
    await get('catalog-form').fire('submit'); assert.equal(get('metric-index').textContent, '1');
    const pending = get('start').fire('click'); assert.equal(get('stop').disabled, false);
    get('stop').fire('click'); const late = camera(); permission(late); await pending;
    assert.equal(late.track.stopped, true); assert.equal(video.srcObject, null); assert.equal(get('start').disabled, false);
  });
  await t.test('four synthetic video frames yield candidates without network traffic', async () => {
    const pending = get('start').fire('click'), incoming = camera(); permission(incoming); await pending;
    const before = requests;
    for (let i = 1; i <= 4; i++) { assert.ok(callback); callback(i * 500); }
    assert.equal(requests, before); assert.equal(incoming.track.stopped, true);
    assert.equal(get('metric-frames').textContent, '4'); assert.equal(get('results').hidden, false);
    assert.equal(get('candidate-list').children.length, 1);
  });
  await t.test('background stops all tracks and does not restart automatically', async () => {
    const pending = get('start').fire('click'), incoming = camera(); permission(incoming); await pending;
    document.hidden = true; document.handlers.get('visibilitychange')();
    assert.equal(incoming.track.stopped, true); assert.equal(callback, null);
    const calls = captureCalls; document.hidden = false; document.handlers.get('visibilitychange')(); assert.equal(captureCalls, calls);
  });
  await t.test('changing language invalidates references and pagehide stops camera', async () => {
    const pending = get('start').fire('click'), incoming = camera(); permission(incoming); await pending;
    get('language').value = 'JP'; get('language').fire('change');
    assert.equal(incoming.track.stopped, true); assert.equal(get('metric-index').textContent, '0'); assert.equal(get('start').disabled, true);
    window.handlers.get('pagehide')(); assert.equal(video.srcObject, null);
  });
  await t.test('leaving the scanner cancels camera permission but keeps prepared references', async () => {
    await get('catalog-form').fire('submit');
    const pending = get('start').fire('click');
    document.handlers.get('tracktcg:navigate')({ detail: 'collection' });
    const late = camera(); permission(late); await pending;
    assert.equal(late.track.stopped, true); assert.equal(get('metric-index').textContent, '1');
    const next = get('start').fire('click'), incoming = camera(); permission(incoming); await next;
    document.handlers.get('tracktcg:navigate')({ detail: 'detail' });
    assert.equal(incoming.track.stopped, true); assert.equal(callback, null);
  });
  await t.test('automatic mode reads two names then freezes the matching frame before reference loading', async () => {
    get('scan-mode').value = 'auto'; get('scan-mode').fire('change');
    assert.equal(get('start').disabled, false); assert.equal(get('manual-setup').hidden, true);
    get('language').value = 'FR';
    const pending = get('start').fire('click'), incoming = camera(); permission(incoming); await pending;
    callback(500); await until(() => /Nom lu/.test(get('scan-status').textContent));
    assert.equal(get('metric-index').textContent, '0');
    callback(1600); await until(() => get('metric-index').textContent === '1');
    assert.equal(incoming.track.stopped, true, 'camera is stopped; comparison no longer requires holding the phone');
    await until(() => workers.at(-1).stopped);
    assert.equal(callback, null); assert.equal(get('results').hidden, false);
    assert.equal(get('scan-still').width, 0, 'captured pixels released after proposals');
    assert.equal(get('metric-frames').textContent, '2', 'a still frame is not replayed as temporal consensus');
  });
  await t.test('explicit capture stops camera before OCR and uses only GET reference requests', async () => {
    const pending = get('start').fire('click'), incoming = camera(); permission(incoming); await pending;
    await until(() => workers.length === 2);
    let release;
    pendingCatalog = new Promise((resolve) => { release = resolve; });
    get('capture').fire('click');
    assert.equal(incoming.track.stopped, true); assert.equal(callback, null);
    assert.equal(get('scan-still').hidden, false); assert.equal(get('scan-still').width, 1080);
    assert.equal(get('start').disabled, true); assert.equal(get('stop').disabled, false);
    await until(() => workers.at(-1).stopped);
    release(); pendingCatalog = null;
    await until(() => !get('results').hidden);
    assert.equal(get('scan-still').width, 0);
  });
  await t.test('cancelling a captured reference request discards the frame and ignores its late response', async () => {
    const previousWorkers = workers.length;
    const pending = get('start').fire('click'), incoming = camera(); permission(incoming); await pending;
    await until(() => workers.length === previousWorkers + 1);
    let release; pendingCatalog = new Promise((resolve) => { release = resolve; });
    get('capture').fire('click'); await until(() => workers.at(-1).stopped);
    document.handlers.get('tracktcg:navigate')({ detail: 'collection' });
    assert.equal(get('scan-still').width, 0); assert.equal(get('scan-still').hidden, true);
    release(); pendingCatalog = null; await new Promise(setImmediate);
    assert.equal(get('results').hidden, true); assert.equal(get('metric-index').textContent, '0');
  });
  await t.test('automatic OCR is terminated when leaving the scanner, even during initialization', async () => {
    const previousWorkers = workers.length;
    const pending = get('start').fire('click'), incoming = camera(); permission(incoming); await pending;
    await until(() => workers.length === previousWorkers + 1);
    document.handlers.get('tracktcg:navigate')({ detail: 'collection' });
    assert.equal(workers.at(-1).stopped, true); assert.equal(incoming.track.stopped, true);
    await new Promise(setImmediate); assert.equal(callback, null); assert.equal(get('metric-index').textContent, '0');
  });
  await t.test('capturing during a live OCR discards that answer and serializes the captured job', async () => {
    heldRecognition = true;
    const pending = get('start').fire('click'), incoming = camera(); permission(incoming); await pending;
    callback(500); await until(() => workers.at(-1).held);
    const worker = workers.at(-1); get('capture').fire('click');
    assert.equal(incoming.track.stopped, true); assert.equal(get('scan-still').hidden, false);
    heldRecognition = false;
    worker.handlers.get('message')({ data: { jobId: worker.held.jobId, status: 'resolve', data: { text: 'incorrect late reading', tsv: '' } } });
    await until(() => !get('results').hidden);
    assert.equal(worker.stopped, true); assert.equal(get('scan-still').width, 0);
  });
  await t.test('unreadable captured name leaves a recapture path and clears pixels on navigation', async () => {
    recognizedName = '';
    const pending = get('start').fire('click'), incoming = camera(); permission(incoming); await pending;
    get('capture').fire('click');
    await until(() => /Nom non reconnu/.test(get('scan-status').textContent));
    assert.equal(get('start').disabled, false); assert.equal(get('start').textContent, 'Recadrer');
    assert.equal(get('scan-still').hidden, false); assert.equal(get('results').hidden, true);
    document.handlers.get('tracktcg:navigate')({ detail: 'catalog' });
    assert.equal(get('scan-still').width, 0); recognizedName = 'Raichu';
  });
  await t.test('captured suffix reaches the real search URL and incompatible reference variants are excluded', async () => {
    recognizedName = 'RaichuVMAX';
    catalogCards = ['Raichu VMAX', 'Raichu V', 'Raichu'].map((name, index) => ({
      id: `tcgdex:FR:test-${index}`, name, number: `${index}`, language: 'FR', setCode: 'test',
      images: [{ source: 'TCGdex', url: `https://assets.tcgdex.net/fr/test/${index}/high.png` }],
    }));
    const pending = get('start').fire('click'), incoming = camera(); permission(incoming); await pending;
    get('capture').fire('click'); await until(() => !get('results').hidden);
    const url = new URL(requestedUrls.filter((url) => url.startsWith('/api/catalog')).at(-1), 'http://localhost');
    assert.equal(url.searchParams.get('query'), 'Raichu VMAX|Raichu-VMAX|RaichuVMAX');
    assert.equal(get('metric-index').textContent, '1'); assert.equal(get('candidate-list').children.length, 1);
    assert.match(get('candidate-list').children[0].children[1].children[0].textContent, /Raichu VMAX/);
    catalogCards = [{ ...catalogCards[1] }];
    const next = get('start').fire('click'), another = camera(); permission(another); await next;
    get('capture').fire('click'); await until(() => /Aucune référence exploitable/.test(get('scan-status').textContent));
    assert.equal(get('results').hidden, true, 'do not silently fall back from VMAX to ordinary V');
    assert.equal(get('metric-index').textContent, '0');
    assert.match(get('catalog-status').textContent, /Suffixe lu à vérifier/);
    get('stop').fire('click'); recognizedName = 'Raichu'; catalogCards = null;
  });
  await t.test('visual PC mode uploads one captured image without waiting for a name, keeps preview live and ignores a cancelled answer', async () => {
    const oldFetch = globalThis.fetch; let resolveAnalysis, uploads = 0;
    globalThis.fetch = async (url, options = {}) => {
      if (url === '/api/visual/status') return new Response(JSON.stringify({ indexed: 12, counts: { FR: 12 } }));
      if (url.startsWith('/api/visual/recognize')) {
        uploads++; assert.equal(options.method, 'POST'); assert.equal(options.headers['Content-Type'], 'image/jpeg');
        assert.ok(options.body instanceof Blob);
        return new Promise((resolve) => { resolveAnalysis = () => resolve(new Response(JSON.stringify({
          candidates: [{ card: { id: 'tcgdex:FR:visual-test', name: 'Visual test', number: '1', language: 'FR', setCode: 'test',
            images: [{ url: 'https://assets.tcgdex.net/fr/test/1/high.png' }] } }], milliseconds: 12,
        }))); });
      }
      return oldFetch(url, options);
    };
    const app = await import(`../public/app.mjs?visual-test=${Date.now()}`);
    await until(() => get('scan-mode').value === 'visual');
    const beforeWorkers = workers.length;
    const pending = get('start').fire('click'), incoming = camera(); permission(incoming); await pending;
    get('capture').fire('click'); await until(() => uploads === 1);
    assert.equal(incoming.track.stopped, false, 'preview remains live during analysis');
    assert.equal(get('capture').disabled, true); assert.equal(workers.length, beforeWorkers, 'no OCR/name precondition');
    get('capture').fire('click'); assert.equal(uploads, 1, 'duplicate taps do not queue extra photos');
    document.handlers.get('tracktcg:navigate')({ detail: 'catalog' });
    resolveAnalysis(); await new Promise(setImmediate);
    assert.equal(incoming.track.stopped, true); assert.equal(get('results').hidden, true, 'late answer cannot reopen results');
    const next = get('start').fire('click'), another = camera(); permission(another); await next;
    get('capture').fire('click'); await until(() => uploads === 2); resolveAnalysis();
    await until(() => !get('results').hidden);
    assert.match(get('candidate-list').children[0].children[1].children[0].textContent, /Visual test/);
    assert.match(get('result-notice').textContent, /Proposition visuelle/);
    assert.equal(workers.length, beforeWorkers, 'clear visual results do not wait for number OCR');
    document.handlers.get('tracktcg:navigate')({ detail: 'catalog' });
    assert.equal(another.track.stopped, true); globalThis.fetch = oldFetch;
  });
});
