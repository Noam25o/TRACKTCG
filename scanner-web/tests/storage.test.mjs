import test from 'node:test';
import assert from 'node:assert/strict';
import { IDBFactory } from 'fake-indexeddb';
import { createBrowserStore } from '../public/storage.mjs';
import { addEntries, encodeBackup, mergeBackup, decodeBackup, FORMAT } from '../public/collection.mjs';

const card = { id: 'tcgdex:FR:base1-4', sourceId: 'base1-4', source: 'tcgdex', name: 'Dracaufeu', language: 'FR',
  number: '4/102', localNumber: '4', setName: 'Set de Base', setCode: 'base1', rarity: 'Rare', finishes: ['Holo'], images: [], marketPrice: null };
const input = { card, quantity: 1, condition: 'NM', finish: 'Holo', purchasePriceCents: 1000 };
test('empty store is honest; an acknowledged write survives closing and reopening', async () => {
  const factory = new IDBFactory(), first = createBrowserStore(factory, 'persist');
  assert.deepEqual(await first.load(), []);
  const saved = await first.update((current) => addEntries(current, input, () => 'one'));
  await first.close(); const reopened = createBrowserStore(factory, 'persist');
  assert.deepEqual(await reopened.load(), saved); await reopened.close();
});
test('simultaneous writes across tabs are atomic and cannot lose increments', async () => {
  const factory = new IDBFactory(), one = createBrowserStore(factory, 'atomic'), two = createBrowserStore(factory, 'atomic');
  await Promise.all([one.load(), two.load()]);
  await Promise.all(Array.from({ length: 12 }, (_, i) => (i % 2 ? one : two).update((current) => addEntries(current, input, () => 'one'))));
  assert.equal((await one.load())[0].quantity, 12); await one.close(); await two.close();
});
test('a failed mutation aborts without replacing existing data; next valid write still works', async () => {
  const store = createBrowserStore(new IDBFactory(), 'rollback');
  const initial = await store.update((current) => addEntries(current, input, () => 'one'));
  await assert.rejects(store.update(() => { throw new Error('Invalid import'); }), /Invalid import/);
  assert.deepEqual(await store.load(), initial);
  await assert.rejects(store.update(() => [{ bad: true }])); assert.deepEqual(await store.load(), initial);
  const restored = await store.update((current) => mergeBackup(current, decodeBackup(encodeBackup(initial))));
  assert.deepEqual(restored, initial); await store.close();
});
test('corrupt or future stored versions block writes and stay untouched', async () => {
  const factory = new IDBFactory(), name = 'corrupt';
  const db = await new Promise((resolve, reject) => {
    const request = factory.open(name, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('state'); request.onerror = () => reject(request.error); request.onsuccess = () => resolve(request.result);
  });
  const bad = { format: FORMAT, version: 99, entries: [{ original: 'preserve' }] };
  await new Promise((resolve, reject) => { const tx = db.transaction('state', 'readwrite'); tx.objectStore('state').put(bad, 'collection'); tx.oncomplete = resolve; tx.onabort = reject; });
  const store = createBrowserStore(factory, name);
  await assert.rejects(store.load()); await assert.rejects(store.update(() => []));
  const raw = await new Promise((resolve) => { const req = db.transaction('state').objectStore('state').get('collection'); req.onsuccess = () => resolve(req.result); });
  assert.deepEqual(raw, bad); await store.close(); db.close();
});
test('unavailable browser storage fails closed, without an in-memory fake success', async () => {
  const store = createBrowserStore(null);
  await assert.rejects(store.load(), /Stockage indisponible/); await assert.rejects(store.update(() => []));
});
