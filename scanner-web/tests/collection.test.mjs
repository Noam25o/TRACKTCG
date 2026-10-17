import test from 'node:test';
import assert from 'node:assert/strict';
import { addEntries, removeOne, mergeBackup, encodeBackup, decodeBackup, normalizeCard,
  parsePurchasePrice, collectionTotals, matchesCollection, MAX_BYTES } from '../public/collection.mjs';

export const card = { id: 'tcgdex:JP:SM6a-003', sourceId: 'SM6a-003', source: 'tcgdex', name: 'リザードン', language: 'JP',
  number: '003/053', localNumber: '003', setName: 'Dragon Storm', setCode: 'SM6a', rarity: 'Rare',
  finishes: ['Holo', 'Reverse'], images: [{ url: 'https://tcgplayer-cdn.tcgplayer.com/product/573717_in_400x400.jpg', source: 'TCGplayer JP' }],
  searchNames: ['Dracaufeu', 'Charizard', 'リザードン'], marketPrice: null };
const input = (changes = {}) => ({ card, quantity: 1, finish: 'Holo', condition: 'NM', purchasePriceCents: null, ...changes });
const make = (changes, id = 'lot-1') => addEntries([], input(changes), () => id);

test('purchase prices accept comma or point, keep missing distinct from zero', () => {
  for (const [value, cents] of [['', null], ['0', 0], ['12,50', 1250], ['12.5', 1250], ['0,01', 1]]) assert.equal(parsePurchasePrice(value), cents);
  for (const value of ['-1', '1.234', 'NaN', 'Infinity', '1e4', '12,3.4', '1000001']) assert.throws(() => parsePurchasePrice(value));
});
test('duplicates group by identity/finish/condition/unit-cost, quantities remain exact', () => {
  let entries = make({ quantity: 2, purchasePriceCents: 1050 });
  entries = addEntries(entries, input({ quantity: 3, purchasePriceCents: 1050 }));
  assert.equal(entries.length, 1); assert.equal(entries[0].quantity, 5);
  entries = addEntries(entries, input({ finish: 'Reverse' }), () => 'reverse');
  entries = addEntries(entries, input({ condition: 'EX' }), () => 'ex');
  entries = addEntries(entries, input({ purchasePriceCents: 0 }), () => 'free');
  entries = addEntries(entries, input({ card: { ...card, id: 'tcgdex:EN:SM6a-003', language: 'EN' } }), () => 'english');
  assert.equal(entries.length, 5); assert.equal(collectionTotals(entries).cards, 9);
});
test('invalid variant, quantity, cost or identity never mutates the input', () => {
  const entries = make();
  for (const changes of [{ quantity: 0 }, { quantity: 1.5 }, { quantity: 10000 }, { finish: 'Normale' },
    { condition: 'oops' }, { purchasePriceCents: -1 }, { card: { ...card, language: 'FR' } }]) assert.throws(() => addEntries(entries, input(changes)));
  assert.equal(entries[0].quantity, 1);
  assert.throws(() => addEntries(make({ quantity: 9999 }), input()));
});
test('backup roundtrip and repeated import are idempotent, existing quantities never overwritten', () => {
  const entries = make({ quantity: 2, purchasePriceCents: 0 });
  const backup = decodeBackup(encodeBackup(entries)); assert.deepEqual(backup, entries);
  let merged = mergeBackup(entries, [...make({ quantity: 99 }), ...make({ quantity: 3 }, 'lot-2')]);
  assert.equal(merged.length, 2); assert.equal(merged.find((entry) => entry.id === 'lot-1').quantity, 2);
  assert.deepEqual(mergeBackup(merged, backup), merged);
  assert.throws(() => decodeBackup(JSON.stringify({ version: 1, entries })));
  assert.throws(() => decodeBackup(encodeBackup(entries).replace('"version": 1', '"version": 2')));
  assert.throws(() => decodeBackup('x'.repeat(MAX_BYTES + 1)));
});
test('imports reject duplicate IDs/malformed entries, strip prices and unknown fields, constrain image URLs', () => {
  const entries = make();
  assert.throws(() => encodeBackup([...entries, ...entries]));
  assert.throws(() => encodeBackup([{ ...entries[0], quantity: -1 }]));
  assert.throws(() => normalizeCard({ ...card, images: [{ url: 'https://evil.test/camera.png', source: 'TCGdex' }] }));
  const safe = normalizeCard({ ...card, marketPrice: 5000, html: '<script>alert(1)</script>' });
  assert.equal(safe.marketPrice, null); assert.equal(safe.html, undefined);
});
test('collection has costs, not invented market values; French search works offline on JP cards', () => {
  const entries = [...make({ quantity: 2, purchasePriceCents: 1250 }), ...make({ quantity: 3 }, 'missing')];
  assert.deepEqual(collectionTotals(entries), { cards: 5, lots: 2, costCents: 2500, withoutCost: 3 });
  for (const query of ['dracaufeu', 'Charizard', 'リザードン', 'SM6a', '003']) assert.equal(matchesCollection(entries[0], query), true);
  assert.equal(matchesCollection(entries[0], 'raichu'), false);
  assert.equal(removeOne(entries, entries[0].id)[0].quantity, 1);
  assert.equal(removeOne(make(), 'lot-1').length, 0);
});
