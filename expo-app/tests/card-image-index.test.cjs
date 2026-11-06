const { test } = require('node:test');
const assert = require('node:assert/strict');
const { normalizeNumber, normalizeName, safeImagePath, parseLegacy, matchTcgl } = require('../scripts/build-card-image-index.cjs');
const index = require('../src/data/card-image-index.json');

test('number matching tolerates numeric padding but keeps gallery and promo prefixes', () => {
  assert.equal(normalizeNumber('001'), normalizeNumber('1'));
  assert.notEqual(normalizeNumber('TG01'), normalizeNumber('1'));
  assert.notEqual(normalizeNumber('SM115'), normalizeNumber('115'));
  assert.notEqual(normalizeName('Nidoran♀'), normalizeName('Nidoran♂'));
});

test('TCGL rejects different languages, names, jumbo cards and ambiguous artworks', () => {
  const url = 'https://cdn.malie.io/file/malie-io/tcgl/cards/png/fr/mebsp/mebsp_fr_001_std.png';
  const record = { lang: 'fr-FR', name: 'Méganium', size: 'STANDARD', collector_number: { numerator: '001' }, images: { tcgl: { png: { front: url } } } };
  const card = { id: 'mep-001', name: 'Méganium', localId: '001' };
  assert.equal(matchTcgl([record, record], [card], 'FR').get(card.id), url.split('/file/malie-io/')[1]);
  for (const change of [{ lang: 'en-US' }, { name: 'Alakazam' }, { size: 'JUMBO' }, { collector_number: { numerator: '002' } }]) {
    assert.equal(matchTcgl([{ ...record, ...change }], [card], 'FR').size, 0);
  }
  const different = { ...record, images: { tcgl: { png: { front: url.replace('_std', '_alt') } } } };
  assert.equal(matchTcgl([record, different], [card], 'FR').size, 0);
});

test('legacy parser assigns links to their own card, language and requested set', () => {
  const html = '<li>GUM #5 Charizard<ul class="img_type_list"><li><a href="https://cdn.malie.io/file/malie-io/art/cards/png/fr_FR/SM/GUM-DET/fr_FR-GUM-005-dracaufeu.png">fr_FR</a></li></ul></li>'
    + '<li>GUM #6 Arcanine<ul class="img_type_list"><a href="https://cdn.malie.io/file/malie-io/art/cards/png/en_US/SM/GUM-DET/en_US-GUM-006-arcanine.png">en_US</a></ul></li>';
  const records = parseLegacy(html, 'GUM');
  assert.equal(records.length, 2);
  assert.equal(records[0].name, 'Charizard');
  assert.equal(records[0].images.FR.size, 1);
  assert.equal(records[0].images.EN, undefined);
  assert.equal(records[1].images.FR, undefined);
  assert.deepEqual(parseLegacy(html, 'DM'), []);
});

test('bundled links stay on the reviewed CDN and match the encoded language', () => {
  for (const [key, entry] of Object.entries(index.entries)) {
    const language = key.split(':')[0];
    assert.ok(['FR', 'EN'].includes(language));
    assert.equal(entry.length, 3);
    assert.ok(entry[0] && entry[1]);
    assert.ok(safeImagePath('https://cdn.malie.io/file/malie-io/' + entry[2], language, entry[2].startsWith('tcgl/') ? 'tcgl' : 'legacy'), key);
  }
  assert.equal(safeImagePath('https://cdn.malie.io.evil.invalid/file/malie-io/tcgl/cards/png/fr/a.png', 'FR', 'tcgl'), null);
  assert.equal(safeImagePath('https://cdn.malie.io/file/malie-io/tcgl/cards/png/en/a.png', 'FR', 'tcgl'), null);
});
