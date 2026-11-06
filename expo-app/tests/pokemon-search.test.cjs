const { test } = require('node:test');
const assert = require('node:assert/strict');
const load = require('./load-typescript.cjs');
const { normalizeSearch, resolvePokemonName, createCollectionSearch } = load('src/services/pokemon-search.ts');
const { searchUrl, searchCatalog } = load('src/services/catalog.ts');
const { parseCsv, buildNames } = require('../scripts/build-pokemon-names.cjs');
const dictionary = require('../src/data/pokemon-names.json');

test('French species names resolve to the selected card language', () => {
  for (const [input, language, expected] of [
    ['Dracaufeu', 'JP', 'リザードン'], ['Dracaufeu', 'EN', 'Charizard'],
    ['Dracaufeu', 'FR', 'Dracaufeu'], ['Bulbizarre', 'JP', 'フシギダネ'],
    ['Évoli', 'EN', 'Eevee'], ['evoli', 'JP', 'イーブイ'], ['FLABEBE', 'JP', 'フラベベ'],
    ['  meganium  ', 'EN', 'Meganium'], ['M. Mime', 'JP', 'バリヤード'],
    ['Type:0', 'EN', 'Type: Null'], ['Nidoran♀', 'JP', 'ニドラン♀'],
    ['Nidoran♂', 'JP', 'ニドラン♂'],
  ]) assert.equal(resolvePokemonName(input, language).query, expected, input);
});

test('original English and Japanese names still work without changing the card language', () => {
  assert.equal(resolvePokemonName('Charizard', 'JP').query, 'リザードン');
  assert.equal(resolvePokemonName('リザードン', 'JP').query, 'リザードン');
  assert.equal(resolvePokemonName('リザードン', 'FR').query, 'Dracaufeu');
  assert.equal(resolvePokemonName('ニャビー', 'JP').query, 'ニャビー');
  assert.notEqual(normalizeSearch('ニャビー'), normalizeSearch('ニャヒー'));
});

test('unique partial names resolve; ambiguous names offer choices without selecting a species', () => {
  assert.equal(resolvePokemonName('dracauf', 'JP').query, 'リザードン');
  const partial = resolvePokemonName('drac', 'JP');
  assert.equal(partial.query, 'drac');
  assert.equal(partial.pokemon, undefined);
  assert.ok(partial.candidates.some((item) => item.FR === 'Dracaufeu'));
  assert.ok(partial.candidates.some((item) => item.FR === 'Dracolosse'));
  assert.equal(resolvePokemonName('Draco', 'JP').pokemon.FR, 'Draco');
  assert.equal(resolvePokemonName('Nidoran', 'JP').pokemon, undefined);
  assert.equal(resolvePokemonName('Nidoran', 'JP').candidates.length, 2);
  assert.equal(resolvePokemonName('d', 'JP').pokemon, undefined);
});

test('unknown names and trainer text remain literal rather than guessed translations', () => {
  for (const input of ['Carte inconnue', 'Super Bonbon', 'Dracaufeux', 'Dracaufeu-ex', 'SM6a', '123']) {
    assert.equal(resolvePokemonName(input, 'JP').query, input);
  }
  assert.equal(resolvePokemonName('   ', 'JP').query, '');
});

test('only name searches translate; pagination, numbers and sets are preserved', () => {
  const jp = new URL(searchUrl('Dracaufeu', 'JP', 'name', 2));
  assert.equal(jp.pathname, '/v2/ja/cards');
  assert.equal(jp.searchParams.get('name'), 'リザードン');
  assert.equal(jp.searchParams.get('pagination:page'), '2');
  assert.equal(jp.searchParams.get('pagination:itemsPerPage'), '24');
  assert.equal(new URL(searchUrl('Dracaufeu', 'EN', 'name', 1)).searchParams.get('name'), 'Charizard');
  assert.equal(new URL(searchUrl('Évoli', 'JP', 'set', 1)).searchParams.get('set.name'), 'Évoli');
  assert.equal(new URL(searchUrl('003', 'JP', 'number', 1)).searchParams.get('localId'), '003');
});

test('translation adds no network request and never rewrites catalog card metadata', async (t) => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async (url) => {
    calls++;
    assert.equal(new URL(url).searchParams.get('name'), 'リザードン');
    return new Response(JSON.stringify([{ id: 'SM6a-003', name: 'リザードン', localId: '003' }]));
  });
  const cards = await searchCatalog('Dracaufeu', 'JP', 'name');
  assert.equal(calls, 1);
  assert.equal(cards[0].name, 'リザードン');
  assert.equal(cards[0].language, 'JP');
  assert.equal(cards[0].id, 'tcgdex:JP:SM6a-003');
});

test('French collection search finds foreign versions offline and keeps set/number searches', () => {
  const card = { name: 'リザードンGX', language: 'JP', setName: '闘う虹を見たか', number: '011/051' };
  const before = JSON.stringify(card);
  assert.equal(createCollectionSearch('Dracaufeu')(card), true);
  assert.equal(createCollectionSearch('drac')(card), true);
  assert.equal(createCollectionSearch('Charizard')(card), true);
  assert.equal(createCollectionSearch('011')(card), true);
  assert.equal(createCollectionSearch('闘う')(card), true);
  assert.equal(createCollectionSearch('Pikachu')(card), false);
  assert.equal(createCollectionSearch('')(card), true);
  assert.equal(createCollectionSearch('Dracaufeu')({ ...card, name: 'Charizard ex', language: 'EN' }), true);
  assert.equal(createCollectionSearch('Nidoran♀')({ ...card, name: 'ニドラン♂' }), false);
  assert.equal(JSON.stringify(card), before);
});

test('dictionary covers every bundled species in each language and has source provenance', () => {
  assert.equal(dictionary.entries.length, 1025);
  assert.match(dictionary.sourceSha256, /^[a-f0-9]{64}$/);
  assert.equal(new Set(dictionary.entries.map(([id]) => id)).size, dictionary.entries.length);
  for (const [id, fr, en, jp] of dictionary.entries) {
    for (const name of [fr, en, jp]) {
      const resolution = resolvePokemonName(name, 'JP');
      assert.equal(resolution.pokemon?.dexId, id, name);
      assert.equal(resolution.query, jp, name);
    }
  }
});

test('CSV import handles quoted names, rejects malformed input and incomplete translations', () => {
  assert.deepEqual(parseCsv('id,name\n1,"a,b"\n2,"a""b"'), [['id', 'name'], ['1', 'a,b'], ['2', 'a"b']]);
  assert.throws(() => parseCsv('"unclosed'), /quote/);
  assert.throws(() => buildNames('wrong,header\n'), /schema/);
  assert.throws(() => buildNames('pokemon_species_id,local_language_id,name,genus\n6,5,Dracaufeu,Flamme\n'), /Missing/);
});
