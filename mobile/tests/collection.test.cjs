const { test } = require('node:test');
const assert = require('node:assert/strict');
const load = require('./load-typescript.cjs');
const { addToCollection, collectionTotals, createCollectionStore, decodeCollection } = load('src/services/collection-store.ts');
const card = { id: 'tcgdex:FR:sv03-125', name: 'Dracaufeu-ex', source: 'tcgdex', number: '125/197', setName: 'Flammes Obsidiennes', rarity: 'Double rare', symbol: '◇', language: 'FR', marketPrice: null, dayChangePercent: null, accent: ['#000', '#fff'], finishes: ['Holo'] };
const input = { card, condition: 'NM', finish: 'Holo', purchasePrice: 12.5 };

test('duplicates merge only within the same language, condition, finish and purchase cost', () => {
  let entries = addToCollection([], input);
  entries = addToCollection(entries, input);
  assert.equal(entries.length, 1); assert.equal(entries[0].quantity, 2);
  entries = addToCollection(entries, { ...input, card: { ...card, id: 'tcgdex:EN:sv03-125', language: 'EN' } });
  entries = addToCollection(entries, { ...input, condition: 'EX' });
  entries = addToCollection(entries, { ...input, purchasePrice: 20 });
  assert.equal(entries.length, 4);
  assert.equal(collectionTotals(entries).investedValue, 70);
});

test('unknown valuations are counted separately; demo values never inflate portfolio', () => {
  let entries = addToCollection([], input);
  entries = addToCollection(entries, { ...input, card: { ...card, id: 'demo', source: 'demo', marketPrice: 999 } });
  assert.deepEqual(collectionTotals(entries), { totalCards: 2, totalValue: 0, investedValue: 12.5, unpricedCards: 1, demoCards: 1 });
});

test('unsupported finishes, invalid costs and corrupt persistence are rejected', () => {
  assert.throws(() => addToCollection([], { ...input, finish: 'Reverse' }));
  assert.throws(() => addToCollection([], { ...input, purchasePrice: -1 }));
  assert.throws(() => addToCollection([], { ...input, purchasePrice: Infinity }));
  assert.deepEqual(decodeCollection(null), []);
  assert.throws(() => decodeCollection('{broken'));
  assert.throws(() => decodeCollection('{"version":2,"entries":[]}'));
  assert.throws(() => decodeCollection(JSON.stringify({ version: 1, entries: [{ ...addToCollection([], input)[0], quantity: -1 }] })));
});

test('concurrent saves are serialized and survive a new store instance', async () => {
  let persisted = null;
  const storage = { getItem: async () => persisted, setItem: async (_key, value) => { await new Promise((resolve) => setTimeout(resolve, 5)); persisted = value; } };
  const store = createCollectionStore(storage);
  await store.load();
  await Promise.all([store.add(input), store.add(input), store.add(input)]);
  const restarted = createCollectionStore(storage);
  const entries = await restarted.load();
  assert.equal(entries[0].quantity, 3);
  assert.equal(entries[0].purchasePrice, 12.5);
});

test('failed saves do not commit memory; the queue can recover', async () => {
  let fail = true;
  const storage = { getItem: async () => null, setItem: async () => { if (fail) throw new Error('disk full'); } };
  const store = createCollectionStore(storage); await store.load();
  await assert.rejects(store.add(input), /disk full/);
  fail = false;
  assert.equal((await store.add(input))[0].quantity, 1);
});

test('failed hydration never overwrites a corrupt save', async () => {
  let writes = 0;
  const store = createCollectionStore({ getItem: async () => 'invalid', setItem: async () => { writes++; } });
  await assert.rejects(store.load());
  await assert.rejects(store.add(input), /chargement/);
  assert.equal(writes, 0);
});
