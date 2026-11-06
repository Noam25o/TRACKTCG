import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { allowedImageUrl, imageSources, searchCards, translateQuery, getCardDetail } from '../catalog.mjs';
const require = createRequire(import.meta.url);
const loadTS = require('../../expo-app/tests/load-typescript.cjs');
const mobileSearch = loadTS('src/services/pokemon-search.ts');
const mobileImages = loadTS('src/services/card-images.ts');

test('French/EN/JP translation matches mobile without a translation API', () => {
  for (const input of ['Dracaufeu', 'dracauf', 'Évoli', 'Nidoran♀', 'Nidoran♂', 'バリヤード', 'Drac', 'Type:0', 'Draco', 'Dracaufeu-ex']) {
    for (const lang of ['FR', 'EN', 'JP']) assert.equal(translateQuery(input, lang), mobileSearch.resolvePokemonName(input, lang).query);
  }
});
test('reference fallbacks use the same exact-language/name/number identities as mobile', () => {
  for (const [id, name, number, language] of [
    ['sm7.5-3', 'Dracaufeu', '3', 'FR'], ['det1-5', 'Dracaufeu', '5', 'FR'],
    ['SM6a-003', 'リザードン', '003', 'JP'], ['SM6a-003', 'Dracaufeu', '003', 'JP'],
  ]) {
    assert.deepEqual(imageSources({ id, name, localId: number }, language),
      mobileImages.getCardImages({ id: `tcgdex:${language}:${id}`, name, number, language }));
  }
});
test('proxy URL validation blocks SSRF, credentials, ports, alternate hosts and unsafe paths', () => {
  for (const url of ['http://127.0.0.1/secret', 'https://assets.tcgdex.net.evil.test/a/high.png',
    'https://user:pass@assets.tcgdex.net/a/high.png', 'https://assets.tcgdex.net:8787/a/high.png',
    'https://cdn.malie.io/file/malie-io/a.png?redirect=evil', 'https://assets.tcgdex.net/a/%2fsecret/high.png',
    'file:///a/high.png', 'https://tcgplayer-cdn.tcgplayer.com/product/not-an-id.jpg']) assert.equal(allowedImageUrl(url), false, url);
  assert.equal(allowedImageUrl('https://assets.tcgdex.net/fr/swsh/swsh3/136/high.png'), true);
  assert.equal(allowedImageUrl('https://tcgplayer-cdn.tcgplayer.com/product/573717_in_400x400.jpg'), true);
});
test('search requests translated name, capped page size; keeps native identity', async () => {
  let requested;
  const result = await searchCards(new URLSearchParams({ language: 'JP', query: 'Dracaufeu', page: '1' }), async (url) => {
    requested = new URL(url); return [{ id: 'SM6a-003', name: 'リザードン', localId: '003' }];
  });
  assert.equal(requested.searchParams.get('name'), 'リザードン');
  assert.equal(requested.searchParams.get('pagination:itemsPerPage'), '24');
  assert.equal(result.cards[0].id, 'tcgdex:JP:SM6a-003');
  assert.equal(result.cards[0].name, 'リザードン'); assert.equal(result.hasMore, false);
});
test('invalid language/page/short query cannot reach upstream', async () => {
  for (const fields of [{ language: 'constructor', query: 'Evoli' }, { language: 'FR', query: 'x' }, { language: 'FR', query: 'Evoli', page: '4' }]) {
    await assert.rejects(searchCards(new URLSearchParams(fields), () => assert.fail('must not fetch')));
  }
});
test('catalog pagination is not limited to the scanner lot; number/set fields are never translated', async () => {
  let requested;
  await searchCards(new URLSearchParams({ scope: 'catalog', field: 'number', language: 'FR', query: '3', page: '4' }), async (url) => { requested = new URL(url); return []; });
  assert.equal(requested.searchParams.get('localId'), '3'); assert.equal(requested.searchParams.get('pagination:page'), '4');
  await searchCards(new URLSearchParams({ scope: 'catalog', field: 'set', language: 'JP', query: 'Dracaufeu' }), async (url) => { requested = new URL(url); return []; });
  assert.equal(requested.searchParams.get('set.name'), 'Dracaufeu');
  await searchCards(new URLSearchParams({ scope: 'catalog', language: 'FR', query: '' }), async (url) => { requested = new URL(url); return []; });
  assert.equal(requested.searchParams.has('name'), false);
});
test('detail validates printing/language, retains native metadata and ignores unqualified prices', async () => {
  const raw = { id: 'SM6a-003', name: 'リザードン', localId: '003', set: { id: 'SM6a', name: 'Dragon Storm', cardCount: { official: 53 } }, variants: { holo: true }, pricing: { madeUp: 999 } };
  const detail = await getCardDetail('tcgdex:JP:SM6a-003', async (url) => { assert.equal(url, 'https://api.tcgdex.net/v2/ja/cards/SM6a-003'); return raw; });
  assert.equal(detail.number, '003/53'); assert.equal(detail.language, 'JP'); assert.equal(detail.marketPrice, null);
  assert.deepEqual(detail.finishes, ['Holo']); assert.ok(detail.searchNames.includes('Dracaufeu'));
  await assert.rejects(getCardDetail('tcgdex:JP:SM6a-003', async () => ({ ...raw, id: 'SM6a-004' })));
  await assert.rejects(getCardDetail('constructor', async () => assert.fail('must not fetch')));
});
