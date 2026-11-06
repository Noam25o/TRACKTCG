const { test } = require('node:test');
const assert = require('node:assert/strict');
const load = require('./load-typescript.cjs');
const { getCardImages, nextCardImage } = load('src/services/card-images.ts');
const { mapCard, mapSummary } = load('src/services/catalog.ts');
const card = { id: 'tcgdex:FR:sm7.5-3', name: 'Dracaufeu', language: 'FR', number: '3/70' };

test('missing primary image uses Malie then the verified official French printing', () => {
  const images = getCardImages(card);
  assert.deepEqual(images.map((image) => image.source), ['Malie', 'Pokémon officiel']);
  assert.match(images[0].url, /fr_FR-DM-003-dracaufeu\.png$/);
  assert.match(images[1].url, /SM75\/SM75_FR_3\.png$/);
});

test('primary is preferred; load errors advance once and stop when exhausted', () => {
  const images = getCardImages({ ...card, imageUrl: 'https://assets.tcgdex.net/fr/sm/sm7.5/3/high.png' });
  assert.deepEqual(images.map((image) => image.source), ['TCGdex', 'Malie', 'Pokémon officiel']);
  assert.equal(nextCardImage(images, []), images[0]);
  assert.equal(nextCardImage(images, [images[0].url]), images[1]);
  assert.equal(nextCardImage(images, [images[0].url, images[1].url]), images[2]);
  assert.equal(nextCardImage(images, images.map((image) => image.url)), undefined);
  assert.equal(nextCardImage(images, []), images[0]); // Manual retry.
});

test('never substitute another language, set, number, or demo identity', () => {
  for (const change of [
    { language: 'EN' }, { language: 'JP' }, { number: '4/70' },
    { id: 'tcgdex:EN:sm7.5-3' }, { id: 'tcgdex:FR:sm7.5-4' },
    { id: 'tcgdex:FR:sm3-3' }, { id: 'demo' },
    { id: 'tcgdex:FR:30th-c-001' },
    { id: 'tcgdex:FR:2024sv-1' },
  ]) assert.deepEqual(getCardImages({ ...card, ...change }), []);
});

test('catalog summaries, details and old saved cards resolve without changing metadata', () => {
  const fixture = { id: 'sm7.5-3', name: 'Dracaufeu', localId: '3', set: { name: 'Majesté Des Dragons', cardCount: { official: 70 } } };
  const summary = mapSummary(fixture, 'FR');
  const detail = mapCard(fixture, 'FR');
  const snapshot = JSON.stringify(detail);
  assert.deepEqual(getCardImages(summary), getCardImages(detail));
  assert.deepEqual(getCardImages(JSON.parse(snapshot)), getCardImages(card));
  assert.equal(JSON.stringify(detail), snapshot);
  assert.equal(detail.imageUrl, undefined);
});

test('verified promos retain their exact padded identity but official URL uses unpadded number', () => {
  for (const number of ['023', '029', '030']) {
    const image = getCardImages({ id: `tcgdex:FR:mep-${number}`, language: 'FR', number }).find((image) => image.source === 'Pokémon officiel');
    assert.ok(image.url.endsWith(`/MEP/MEP_FR_${Number(number)}.png`));
  }
  assert.ok(getCardImages({ id: 'tcgdex:FR:sm115-9', language: 'FR', number: '9/68' })[0].url.endsWith('/SM115/SM115_FR_9.png'));
});

test('unverified cards keep placeholders; unsafe origins and inherited keys are ignored', () => {
  const primary = 'https://assets.tcgdex.net/en/sv/sv03/125/high.png';
  assert.deepEqual(getCardImages({ id: 'tcgdex:EN:sv03-125', language: 'EN', number: '125/197', imageUrl: primary }), [{ url: primary, source: 'TCGdex' }]);
  assert.deepEqual(getCardImages({ id: 'constructor', language: 'FR', number: '3', imageUrl: 'https://assets.tcgdex.net.evil.invalid/a.png' }), []);
  assert.equal(nextCardImage([], []), undefined);
});

test('other Pokémon and English cards receive their own exact fallback', () => {
  for (const [language, id, name, number] of [
    ['FR', 'mep-001', 'Méganium', '001'], ['FR', 'mep-002', 'Lézargus', '002'],
    ['FR', 'mep-003', 'Alakazam', '003'], ['EN', 'det1-1', 'Bulbasaur', '1'],
    ['FR', 'det1-5', 'Dracaufeu', '5/18'],
  ]) {
    const [image] = getCardImages({ id: `tcgdex:${language}:${id}`, language, name, number });
    assert.equal(image.source, 'Malie');
    assert.match(image.url, new RegExp(language === 'FR' ? '/fr(?:_FR)?/' : '/en(?:_US)?/'));
  }
  assert.deepEqual(getCardImages({ id: 'tcgdex:FR:mep-001', language: 'FR', name: 'Alakazam', number: '001' }), []);
});
