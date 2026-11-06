import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePricing } from '../pricing.mjs';
import { normalizeCard } from '../public/collection.mjs';
import { readFileSync } from 'node:fs';
const updated = '2026-10-02T09:52:46.106Z';
test('prices retain provider, source date, currency and distinct variant without certifying language/condition', () => {
  const result = normalizePricing({ cardmarket: { updated, unit: 'EUR', trend: 12, low: 9, 'trend-holo': 20 },
    tcgplayer: { updated, unit: 'USD', 'reverse-holofoil': { marketPrice: 18, highPrice: 29 } } }, 'FR');
  assert.equal(result.length, 3); assert.equal(result[0].trend, 12); assert.equal(result[0].updatedAt, updated);
  assert.equal(result[1].finish, 'Brillante'); assert.equal(result[2].currency, 'USD'); assert.equal(result[2].finish, 'Reverse');
  assert.match(result[0].scope, /non filtrés/); assert.equal(result[2].low, null);
});
test('missing/invalid/zero data stay unavailable; no Japanese or currency substitution', () => {
  assert.deepEqual(normalizePricing(undefined, 'FR'), []);
  assert.deepEqual(normalizePricing({ cardmarket: { unit: 'USD', trend: 100 } }, 'FR'), []);
  assert.deepEqual(normalizePricing({ tcgplayer: { unit: 'USD', normal: { marketPrice: 20 } } }, 'JP'), []);
  assert.deepEqual(normalizePricing({ cardmarket: { unit: 'EUR', trend: -1, low: '12', avg30: 0 } }, 'FR'), []);
  const [quote] = normalizePricing({ cardmarket: { unit: 'EUR', updated: 'bad', 'trend-holo': 3, trend: 40 } }, 'FR', { normal: false });
  assert.equal(quote.updatedAt, null); assert.equal(quote.trend, 3);
});
test('quotes are transient and cannot enter imported or persisted collection snapshots', () => {
  const card = JSON.parse(readFileSync(new URL('./fixtures/backup-v1.json', import.meta.url))).entries[0].card;
  const normalized = normalizeCard({ ...card, quotes: [{ trend: 999999 }], marketPrice: 999999 });
  assert.equal(normalized.marketPrice, null); assert.equal(Object.hasOwn(normalized, 'quotes'), false);
});
