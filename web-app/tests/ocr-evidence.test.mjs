import test from 'node:test';
import assert from 'node:assert/strict';
import { fractionFromLines, assess } from '../visual/ocr-evidence.mjs';
const read = (text, score=.99) => fractionFromLines([{text,score}]);
test('CPU bench extracts fractions without knowing expected identity', () => {
  assert.equal(read('PROMO 001/SV-P').key, '1/SV-P');
  assert.equal(read('003/165').number, '3');
  assert.equal(read('0015v.e'), null);
  assert.equal(read('HP60 2022'), null);
  assert.equal(read('OO1/SV-P').number, 'OO1'); // Never silently convert O to 0.
  assert.equal(assess(read('OO1/SV-P'),{number:'1',set:'SVP'}),'conflict');
});
test('CPU bench rejects weak or conflicting number evidence', () => {
  assert.equal(read('001/SV-P',.79), null);
  assert.equal(fractionFromLines([{text:'001/SV-P',score:.99},{text:'002/SV-P',score:.99}]), null);
  assert.equal(assess(read('001/SV-P'),{number:'2',set:'SVP'}),'conflict');
  assert.equal(assess(read('001/165'),{number:'1',set:'SVP'}),'conflict');
  assert.equal(assess(read('001/165'),{number:'1',set:null}),'number-match-only');
});
test('CPU bench keeps attached rarity letters and invalid scores unresolved', () => {
  assert.equal(read('003/165RR'), null);
  assert.equal(read('001/SV-P',NaN), null);
  assert.equal(read(null), null);
});
