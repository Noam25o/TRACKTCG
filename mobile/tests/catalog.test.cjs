const { test } = require('node:test');
const assert = require('node:assert/strict');
const load = require('./load-typescript.cjs');
const { mapCard, mapSummary, searchUrl, parseCatalogId, searchCatalog, getCatalogCard } = load('src/services/catalog.ts');
const fixture = {
  id: 'sv03-125', name: 'Dracaufeu-ex', localId: '125', rarity: 'Double rare',
  image: 'https://assets.tcgdex.net/fr/sv/sv03/125',
  set: { name: 'Flammes Obsidiennes', cardCount: { official: 197, total: 230 } },
  variants: { holo: true, normal: false, reverse: false },
  pricing: { cardmarket: { trend: 3.61 } },
};

test('real catalog identity preserves language and available finishes; unqualified prices are not used', () => {
  const fr = mapCard(fixture, 'FR');
  const en = mapCard(fixture, 'EN');
  assert.notEqual(fr.id, en.id);
  assert.equal(fr.number, '125/197');
  assert.deepEqual(fr.finishes, ['Holo']);
  assert.equal(fr.marketPrice, null);
  assert.equal(fr.dayChangePercent, null);
  assert.equal(fr.imageUrl, 'https://assets.tcgdex.net/fr/sv/sv03/125/high.png');
});

test('missing image is supported, invalid records and unsafe image origins are rejected', () => {
  assert.equal(mapSummary({ id: 'sv03-125', localId: '125', name: 'Dracaufeu' }, 'FR').imageUrl, undefined);
  assert.equal(mapCard({ ...fixture, image: 'https://malicious.invalid/card' }, 'FR').imageUrl, undefined);
  assert.throws(() => mapCard({ id: 'broken' }, 'FR'));
  assert.equal(parseCatalogId('tcgdex:FR:../../file'), null);
  assert.deepEqual(parseCatalogId('tcgdex:JP:SV2a-001'), { language: 'JP', sourceId: 'SV2a-001' });
});

test('search encodes user input, paginates and maps Japanese to ja', () => {
  const url = new URL(searchUrl('Écarlate & Violet', 'JP', 'set', 2));
  assert.equal(url.pathname, '/v2/ja/cards');
  assert.equal(url.searchParams.get('set.name'), 'Écarlate & Violet');
  assert.equal(url.searchParams.get('pagination:page'), '2');
  assert.equal(url.searchParams.get('pagination:itemsPerPage'), '24');
  assert.equal(new URL(searchUrl('125', 'FR', 'number', 1)).searchParams.get('localId'), '125');
});

test('empty search, malformed responses and HTTP failures remain distinct', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response(null, { status: 404 }));
  assert.deepEqual(await searchCatalog('absent', 'FR', 'name'), []);
  globalThis.fetch = async () => new Response('{}', { status: 200 });
  await assert.rejects(searchCatalog('test', 'FR', 'name'), /invalide/);
  globalThis.fetch = async () => new Response(null, { status: 503 });
  await assert.rejects(searchCatalog('test', 'FR', 'name'), /indisponible/);
});

test('detail refuses a different identity and does not fall back to a demo card', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify(fixture)));
  await assert.rejects(getCatalogCard('tcgdex:FR:sv03-126'), /ne correspond pas/);
  await assert.rejects(getCatalogCard('missing'), /invalide/);
});

test('cancellation propagates to the request', async (t) => {
  t.mock.method(globalThis, 'fetch', async (_url, { signal }) => {
    signal.throwIfAborted();
    return new Response('[]');
  });
  const controller = new AbortController(); controller.abort();
  await assert.rejects(searchCatalog('pikachu', 'FR', 'name', 1, controller.signal), { name: 'AbortError' });
});
