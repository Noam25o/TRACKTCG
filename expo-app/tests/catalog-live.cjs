const assert = require('node:assert/strict');
const load = require('./load-typescript.cjs');
const { searchCatalog, getCatalogCard } = load('src/services/catalog.ts');

(async () => {
  for (const [language, query] of [['FR', 'Dracaufeu'], ['EN', 'Pikachu'], ['JP', 'ピカチュウ']]) {
    const results = await searchCatalog(query, language, 'name');
    assert.ok(results.length > 0, `No ${language} results`);
    const card = await getCatalogCard(results[0].id);
    assert.equal(card.language, language);
    assert.equal(card.marketPrice, null);
    console.log(`${language}: ${results.length} results; detail ${card.name} (${card.number}) OK`);
  }
  const bySet = await searchCatalog('Flammes Obsidiennes', 'FR', 'set');
  assert.ok(bySet.length > 0);
  const byNumber = await searchCatalog('125', 'FR', 'number');
  assert.ok(byNumber.length > 0);
  const page2 = await searchCatalog('Dracaufeu', 'FR', 'name', 2);
  assert.ok(page2.length > 0);
  console.log('Set, number and pagination OK');
})().catch((error) => { console.error(error); process.exitCode = 1; });
