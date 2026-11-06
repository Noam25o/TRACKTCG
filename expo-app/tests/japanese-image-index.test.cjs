const { test } = require('node:test');
const assert = require('node:assert/strict');
const { normalizeName, normalizeNumber, safeImagePath, matchJapanese, validateRefresh } = require('../scripts/build-japanese-image-index.cjs');
const index = require('../src/data/japanese-image-index.json');
const load = require('./load-typescript.cjs');
const { getCardImages, nextCardImage } = load('src/services/card-images.ts');
const { mapCard, mapSummary } = load('src/services/catalog.ts');
const url = 'https://tcgplayer-cdn.tcgplayer.com/product/573717_in_400x400.jpg';
const record = { s: 'SM6a', num: '003', n: 'リザードン', img: url };
const summary = { id: 'SM6a-003', name: 'リザードン', localId: '003' };
const card = { id: 'tcgdex:JP:SM6a-003', name: 'リザードン', language: 'JP', number: '003/053' };

test('Japanese normalization retains meaningful names and number prefixes', () => {
  assert.equal(normalizeNumber('003'), normalizeNumber('3'));
  assert.notEqual(normalizeNumber('S-P003'), normalizeNumber('003'));
  assert.notEqual(normalizeName('リザードン'), normalizeName('リザードンGX'));
  assert.notEqual(normalizeName('ニドラン♀'), normalizeName('ニドラン♂'));
  assert.notEqual(normalizeName('ニャビー'), normalizeName('ニャヒー'));
  assert.notEqual(normalizeName('レシラム&リザードンGX'), normalizeName('レシラムリザードンGX'));
});

test('Japanese matching requires exact set, number, name and a reviewed image origin', () => {
  assert.deepEqual(matchJapanese([record, record], [summary]).entries['JP:SM6a-003'], ['リザードン', '003', '573717_in_400x400.jpg']);
  for (const change of [
    { s: 'SM6' }, { s: 'sm6a' }, { num: '004' }, { n: 'Charizard' }, { n: 'リザードンGX' },
    { img: 'https://assets.tcgdex.net/ja/SM/SM6a/003' },
    { img: 'https://tcgplayer-cdn.tcgplayer.com.evil.invalid/product/573717_in_400x400.jpg' },
  ]) assert.deepEqual(matchJapanese([{ ...record, ...change }], [summary]).entries, {});
  assert.equal(matchJapanese([{ ...record, num: '3' }], [summary]).stats.matched, 1);
});

test('ambiguous artwork and product links reused for another printing are refused', () => {
  let result = matchJapanese([record, { ...record, img: url.replace('573717', '573718') }], [summary]);
  assert.equal(result.stats.ambiguous, 1);
  assert.deepEqual(result.entries, {});
  result = matchJapanese([record, { ...record, s: 'SM8b' }], [summary]);
  assert.equal(result.stats.reusedProduct, 1);
  assert.deepEqual(result.entries, {});
});

test('bundled Japanese links are compact, language-isolated and safe', () => {
  assert.match(index.feedSha256, /^[a-f0-9]{64}$/);
  for (const [key, entry] of Object.entries(index.entries)) {
    assert.ok(key.startsWith('JP:'), key);
    assert.equal(entry.length, 3);
    assert.ok(entry[0] && entry[1]);
    assert.equal(safeImagePath('https://tcgplayer-cdn.tcgplayer.com/product/' + entry[2]), entry[2], key);
  }
  for (const unsafe of [url + '?x=1', url.replace('/product/', '/product/../'), url.replace('https:', 'http:'), url.replace('.jpg', '.html')]) {
    assert.equal(safeImagePath(unsafe), null);
  }
});

test('refresh cannot silently replace the working index with a collapsed catalog', () => {
  assert.throws(() => validateRefresh({}), /preserved/);
  const entries = Object.fromEntries(Array.from({ length: 100 }, (_, i) => [String(i), []]));
  assert.throws(() => validateRefresh(entries, 1000), /preserved/);
  assert.doesNotThrow(() => validateRefresh(entries, 100));
});

test('Japanese fallback works in summaries, details and existing collection snapshots', () => {
  const detail = { ...summary, set: { name: 'ドラゴンストーム', cardCount: { official: 53 } } };
  for (const mapped of [mapSummary(summary, 'JP'), mapCard(detail, 'JP'), JSON.parse(JSON.stringify(card))]) {
    const before = JSON.stringify(mapped);
    assert.deepEqual(getCardImages(mapped), [{ url, source: 'TCGplayer JP' }]);
    assert.equal(JSON.stringify(mapped), before);
  }
});

test('TCGdex is still primary; Japanese load failure advances and then exhausts', () => {
  const primary = 'https://assets.tcgdex.net/ja/SM/SM6a/003/high.png';
  const images = getCardImages({ ...card, imageUrl: primary });
  assert.deepEqual(images.map((image) => image.source), ['TCGdex', 'TCGplayer JP']);
  assert.equal(nextCardImage(images, []), images[0]);
  assert.equal(nextCardImage(images, [primary]), images[1]);
  assert.equal(nextCardImage(images, [primary, url]), undefined);
});

test('Japanese fallback never replaces another language, name, set or number', () => {
  for (const change of [
    { language: 'FR' }, { language: 'EN' }, { id: 'tcgdex:FR:SM6a-003' }, { id: 'demo' },
    { name: 'Charizard' }, { name: 'リザードンGX' }, { number: '004/053' },
    { id: 'tcgdex:JP:SM6-003' }, { id: 'tcgdex:JP:PMCG1-001', name: 'フシギダネ', number: '001' },
  ]) assert.deepEqual(getCardImages({ ...card, ...change }), []);
});
