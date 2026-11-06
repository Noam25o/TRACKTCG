import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { IDBFactory } from 'fake-indexeddb';
import { createBrowserStore } from '../public/storage.mjs';
import { decodeBackup } from '../public/collection.mjs';

// Controller tests with a minimal DOM, not a Safari/layout/recognition test.
test('web UI preserves the data contract while using compact controls', async (t) => {
  const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(new Set(ids).size, ids.length, 'no duplicate DOM IDs');
  class Element {
    constructor() {
      this.value = ''; this.children = []; this.dataset = {}; this.attributes = {}; this.handlers = new Map(); this.disabled = false;
      const classes = new Set(); this.classList = { add: (v) => classes.add(v), remove: (v) => classes.delete(v),
        toggle: (v, on) => on ? classes.add(v) : classes.delete(v), contains: (v) => classes.has(v) };
    }
    addEventListener(name, callback) { const handlers = this.handlers.get(name) || []; handlers.push(callback); this.handlers.set(name, handlers); }
    dispatchEvent(event) { for (const callback of this.handlers.get(event.type) || []) callback(event); }
    async fire(name) { for (const callback of this.handlers.get(name) || []) await callback({ type: name, preventDefault() {} }); }
    click() { this.dispatchEvent(new Event('click')); }
    setAttribute(name, value) { this.attributes[name] = value; }
    replaceChildren(...children) { this.children = children; }
    append(...children) { this.children.push(...children); }
    showModal() { this.open = true; }
    close() { this.open = false; this.dispatchEvent(new Event('close')); }
    scrollIntoView() { this.scrolled = true; }
    blur() { this.blurred = true; }
    reportValidity() { return get('add-verified').checked && Number(get('add-quantity').value) >= 1; }
  }
  const nodes = new Map(ids.map((id) => [id, new Element()]));
  const get = (id) => { assert.ok(nodes.has(id), `markup retains ${id}`); return nodes.get(id); };
  get('browse-language').value = get('language').value = 'FR'; get('browse-field').value = 'name';
  get('query').value = 'Raichu'; get('export-backup').disabled = true;
  const segments = [...html.matchAll(/data-language-target="([^"]+)" data-language="([^"]+)"/g)]
    .map((match) => { const element = new Element(); element.dataset = { languageTarget: match[1], language: match[2] }; return element; });
  assert.equal(segments.length, 6);
  const events = [], docHandlers = new Map(), languageLabels = new Map(['browse-language', 'language'].map((target) => [target, new Element()]));
  const document = { hidden: false, getElementById: get, createElement: () => new Element(), createElementNS: () => new Element(),
    querySelector: (selector) => languageLabels.get(/for="([^"]+)"/.exec(selector)[1]),
    querySelectorAll: (selector) => selector === '[data-language-target]' ? segments
      : segments.filter((button) => button.dataset.languageTarget === /="([^"]+)"/.exec(selector)[1]),
    addEventListener(name, callback) { const handlers = docHandlers.get(name) || []; handlers.push(callback); docHandlers.set(name, handlers); },
    dispatchEvent(event) { events.push(event); for (const callback of docHandlers.get(event.type) || []) callback(event); },
  };
  const window = { scrollY: 0, scrollTo({ top }) { this.scrollY = top; }, addEventListener() {} };
  const globals = ['document', 'window', 'indexedDB', 'fetch'].map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]);
  const factory = new IDBFactory(), store = createBrowserStore(factory);
  const fixture = decodeBackup(readFileSync(new URL('./fixtures/backup-v1.json', import.meta.url), 'utf8'));
  await store.update(() => fixture);
  t.after(async () => {
    await store.close();
    for (const [name, descriptor] of globals) { if (descriptor) Object.defineProperty(globalThis, name, descriptor); else delete globalThis[name]; }
  });
  for (const [name, value] of [['document', document], ['window', window], ['indexedDB', factory]]) Object.defineProperty(globalThis, name, { configurable: true, value });
  const requests = [];
  let priceFailure = false;
  const marketQuotes = [{ provider: 'Cardmarket', via: 'TCGdex', currency: 'EUR', finish: 'Brillante', label: 'Brillante',
    trend: 25, low: 10, high: null, average30: 20, updatedAt: '2026-10-02T09:52:46.106Z', scope: 'Langue et état non filtrés.' },
    { provider: 'TCGplayer', via: 'TCGdex', currency: 'USD', finish: 'Normale', label: 'Normale',
      trend: 5, low: 1, high: 12, average30: null, updatedAt: null, scope: 'Marché américain.' }];
  globalThis.fetch = async (url, options) => {
    assert.equal(options.body, undefined); requests.push(url);
    if (url.startsWith('/api/card') && priceFailure) throw new TypeError('offline');
    return new Response(JSON.stringify(url.startsWith('/api/card') ? { ...fixture[0].card, quotes: marketQuotes }
      : { cards: [], query: '', hasMore: false }), { headers: { 'content-type': 'application/json' } });
  };
  const until = async (check) => { for (let n = 0; n < 30; n++) { if (check()) return; await new Promise(setImmediate); } assert.ok(check()); };
  await import('../public/web.mjs'); await until(() => !get('export-backup').disabled);
  await t.test('existing collection loads without changing stored lots', async () => {
    assert.equal(get('total-cards').textContent, '1'); assert.equal(get('nav-count').dataset.empty, 'false');
    assert.deepEqual(await store.load(), fixture);
  });
  await t.test('language segments change the real select, expose selection and avoid duplicate requests', async () => {
    const button = segments.find((item) => item.dataset.languageTarget === 'browse-language' && item.dataset.language === 'JP');
    await button.fire('click'); await until(() => requests.some((url) => url.includes('language=JP')));
    assert.equal(get('browse-language').value, 'JP'); assert.equal(button.attributes['aria-pressed'], 'true');
    const count = requests.length; await button.fire('click'); assert.equal(requests.length, count);
    await get('browse-form').fire('submit'); assert.equal(get('browse-query').blurred, true);
  });
  await t.test('scanner language emits the original change event', async () => {
    let changed = 0; get('language').addEventListener('change', () => changed++);
    await segments.find((item) => item.dataset.languageTarget === 'language' && item.dataset.language === 'EN').fire('click');
    assert.equal(changed, 1); assert.equal(get('language').value, 'EN');
  });
  await t.test('navigation preserves each screen scroll position and camera-stop signal', async () => {
    window.scrollY = 240; await get('nav-collection').fire('click');
    assert.equal(window.scrollY, 0); assert.equal(get('screen-catalog').hidden, true);
    assert.equal(events.at(-1).detail, 'collection');
    window.scrollY = 80; await get('nav-catalog').fire('click'); assert.equal(window.scrollY, 240);
    await get('nav-collection').fire('click'); assert.equal(window.scrollY, 80);
  });
  await t.test('help and backup are explicit dialogs, their opening stops the camera', async () => {
    await get('help-open').fire('click'); assert.equal(get('help-dialog').open, true); assert.equal(events.at(-1).detail, 'help');
    await get('help-close').fire('click'); assert.equal(get('help-dialog').open, false);
    await get('backup-shortcut').fire('click'); assert.equal(get('backup-dialog').open, true);
    await get('backup-close').fire('click'); assert.equal(get('backup-dialog').open, false);
  });
  await t.test('quantity controls stay within limits and opening detail resets optional inputs', async () => {
    document.dispatchEvent(new CustomEvent('tracktcg:open-card', { detail: { id: fixture[0].card.id } }));
    await until(() => !get('detail-content').hidden);
    assert.equal(get('add-finish').value, 'Non précisée'); assert.equal(get('add-verified').checked, false);
    assert.equal(get('purchase-options').open, false);
    await get('quantity-minus').fire('click'); assert.equal(get('add-quantity').value, '1');
    await get('quantity-plus').fire('click'); assert.equal(get('add-quantity').value, '2');
    get('add-quantity').value = '9999'; await get('quantity-plus').fire('click'); assert.equal(get('add-quantity').value, '9999');
  });
  await t.test('unchecked verification cannot add a card; acknowledged addition remains atomic', async () => {
    get('add-quantity').value = '1'; await get('add-form').fire('submit'); assert.deepEqual(await store.load(), fixture);
    get('add-verified').checked = true; await get('add-form').fire('submit');
    assert.equal(get('total-cards').textContent, '2'); assert.equal((await store.load()).length, 2);
    assert.equal(get('detail-status').classList.contains('notice'), true); assert.equal(get('add-verified').checked, false);
    await get('detail-close').fire('click');
  });
  await t.test('a scan opens the quick result and returns to the live scanner after adding', async () => {
    document.dispatchEvent(new CustomEvent('tracktcg:open-card', { detail: { id: fixture[0].card.id, source: 'scanner' } }));
    await until(() => !get('detail-content').hidden);
    assert.equal(get('card-dialog').classList.contains('scan-result'), true);
    assert.equal(get('scan-result-summary').hidden, false);
    assert.equal(get('scan-result-name').textContent, fixture[0].card.name);
    assert.match(get('scan-result-version').textContent, /14\/102/);
    assert.match(get('scan-result-price').textContent, /25/);
    assert.equal(get('add-verified').checked, true);
    await get('add-form').fire('submit');
    assert.equal(get('card-dialog').open, false);
    assert.equal(get('total-cards').textContent, '3');
    assert.equal(events.at(-1).detail, 'scanner');
  });
  await t.test('scan result exposes rarity, details, rescan flow and catalogue exit', async () => {
    document.dispatchEvent(new CustomEvent('tracktcg:open-card', { detail: { id: fixture[0].card.id, source: 'scanner' } }));
    await until(() => !get('detail-content').hidden);
    assert.equal(get('scan-result-rarity').textContent, fixture[0].card.rarity);
    assert.equal(get('scan-result-language').textContent, '🇫🇷');
    await get('scan-result-details').fire('click');
    assert.equal(get('card-dialog').classList.contains('scan-result'), false);
    assert.equal(get('scan-result-summary').hidden, true);
    assert.equal(get('detail-content').hidden, false);
    await get('detail-close').fire('click');
    assert.equal(events.at(-1).detail, 'scanner');

    document.dispatchEvent(new CustomEvent('tracktcg:open-card', { detail: { id: fixture[0].card.id, source: 'scanner' } }));
    await until(() => get('scan-result-name').textContent === fixture[0].card.name);
    await get('scan-result-home').fire('click');
    assert.equal(get('card-dialog').open, false);
    assert.equal(events.at(-1).detail, 'catalog');
  });
  await t.test('market quotes show distinct currencies/variants, never mutate snapshots, and fail explicitly', async () => {
    const before = await store.load();
    document.dispatchEvent(new CustomEvent('tracktcg:open-card', { detail: { id: fixture[0].card.id } }));
    await until(() => !get('detail-content').hidden);
    assert.equal(get('market-quotes').children.length, 2); assert.equal(get('market-warning').hidden, false);
    get('add-finish').value = 'Reverse'; await get('add-finish').fire('change');
    assert.equal(get('market-quotes').children.length, 1); assert.match(get('market-quotes').children[0].children[0].textContent, /Cardmarket/);
    get('add-condition').value = 'PL'; await get('add-condition').fire('change');
    assert.match(get('market-status').textContent, /pas de correction/);
    assert.deepEqual(await store.load(), before);
    priceFailure = true; await get('market-refresh').fire('click');
    assert.equal(get('market-quotes').children.length, 0); assert.match(get('market-status').textContent, /indisponibles/);
    assert.equal(get('add-submit').disabled, false, 'offline prices do not block adding a locally saved card');
    assert.deepEqual(await store.load(), before); priceFailure = false; await get('detail-close').fire('click');
  });
  await t.test('import closes the sheet, previews only, preserves existing entries and rejects malformed files', async () => {
    const before = await store.load(), raw = readFileSync(new URL('./fixtures/backup-v1.json', import.meta.url), 'utf8');
    get('backup-dialog').open = true; get('backup-file').files = [{ name: 'backup.json', size: raw.length, text: async () => raw }];
    await get('backup-file').fire('change'); assert.equal(get('backup-dialog').open, false);
    assert.equal(get('import-preview').hidden, false); assert.equal(get('import-preview').scrolled, true);
    assert.equal(get('import-confirm').disabled, true); assert.deepEqual(await store.load(), before);
    get('backup-file').files = [{ name: 'bad.json', size: 3, text: async () => 'bad' }];
    await get('backup-file').fire('change'); assert.equal(get('collection-status').classList.contains('error'), true);
    assert.deepEqual(await store.load(), before);
  });
});
