const assert = require('node:assert/strict');
const load = require('./load-typescript.cjs');
const { searchCatalog, CATALOG_PAGE_SIZE } = load('src/services/catalog.ts');

(async () => {
  for (const [query, language, native] of [
    ['Dracaufeu', 'JP', 'リザードン'], ['Dracaufeu', 'EN', 'Charizard'],
    ['Évoli', 'JP', 'イーブイ'], ['Bulbizarre', 'EN', 'Bulbasaur'],
    ['M. Mime', 'JP', 'バリヤード'],
  ]) {
    const cards = await searchCatalog(query, language, 'name');
    assert.ok(cards.length > 0, `${query} ${language}`);
    assert.ok(cards.every((card) => card.language === language && card.id.startsWith(`tcgdex:${language}:`) && card.name.includes(native)));
    console.log(`${query} → ${language}: ${cards.length} cards (${cards[0].name})`);
  }
  const first = await searchCatalog('Dracaufeu', 'JP', 'name', 1);
  const second = await searchCatalog('Dracaufeu', 'JP', 'name', 2);
  assert.equal(first.length, CATALOG_PAGE_SIZE);
  assert.ok(second.length > 0);
  assert.ok(second.every((card) => !first.some((previous) => previous.id === card.id)));
  const native = await searchCatalog('リザードン', 'JP', 'name');
  assert.deepEqual(native.map((card) => card.id), first.map((card) => card.id));
  console.log('Pagination and native Japanese search OK');
})().catch((error) => { console.error(error); process.exitCode = 1; });
