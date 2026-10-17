import test from 'node:test';
import assert from 'node:assert/strict';
import { WIDTH, HEIGHT, describe, distance, coverCrop, rankReferences, qualityIssue, createStabilityGate, assessSnapshot } from '../public/vision.mjs';

function fixture(offset = 0, colour = false) {
  const data = new Uint8ClampedArray(WIDTH * HEIGHT * 4);
  for (let y = 0; y < HEIGHT; y++) for (let x = 0; x < WIDTH; x++) {
    const p = (y * WIDTH + x) * 4;
    const value = 50 + ((x * 7 + y * 13) % 160);
    data[p] = value + offset; data[p + 1] = colour ? 60 : value + offset;
    data[p + 2] = colour ? 220 - value / 2 : value + offset; data[p + 3] = 255;
  }
  return data;
}
const quality = describe(fixture()).quality;
const item = (id, score) => ({ reference: { card: { id } }, distance: score });

test('captured image assessed once; poor quality and lookalikes are never declared a confident match', () => {
  assert.equal(assessSnapshot([item('a', .08)], quality).ready, true);
  assert.equal(assessSnapshot([item('a', .08), item('b', .09)], quality).ambiguous, true);
  assert.equal(assessSnapshot([item('a', .2)], quality).ready, false);
  assert.equal(assessSnapshot([], quality).ready, false);
  assert.equal(assessSnapshot([item('a', .08)], { ...quality, mean: 0 }).ready, false);
});

test('identical images have zero distance, brightness shift is tolerated', () => {
  const base = describe(fixture());
  assert.ok(distance(base, base) < 1e-7);
  assert.ok(distance(base, describe(fixture(15))) < 0.005);
  assert.ok(distance(base, describe(fixture(0, true))) > 0.05);
});
test('ranking uses actual descriptors, not demo identities', () => {
  const a = describe(fixture()), b = describe(fixture(0, true));
  assert.equal(rankReferences(b, [{ card: { id: 'a' }, descriptor: a }, { card: { id: 'b' }, descriptor: b }])[0].reference.card.id, 'b');
});
test('quality gate refuses black, white and featureless frames', () => {
  for (const value of [0, 255, 100]) {
    const pixels = new Uint8ClampedArray(WIDTH * HEIGHT * 4).fill(value);
    assert.ok(qualityIssue(describe(pixels).quality));
  }
  assert.equal(qualityIssue(quality), null);
});
test('object-fit cover crop maps central guide to the sensor in landscape and portrait', () => {
  const landscape = coverCrop(1280, 720, 360, 400, { x: 90, y: 74, width: 180, height: 252 });
  assert.ok(Math.abs(landscape.x - 478) < 0.01);
  assert.ok(Math.abs(landscape.width - 324) < 0.01);
  const portrait = coverCrop(720, 1280, 360, 400, { x: 90, y: 74, width: 180, height: 252 });
  assert.equal(portrait.x, 180); assert.equal(portrait.y, 388);
});
test('invalid/overflowing frame dimensions are refused', () => {
  assert.throws(() => coverCrop(0, 720, 360, 400, { x: 0, y: 0, width: 180, height: 252 }));
  assert.throws(() => coverCrop(720, 1280, 360, 400, { x: -400, y: 0, width: 180, height: 252 }));
  assert.throws(() => describe(new Uint8Array(7)));
});
test('four consecutive good frames required; uncertainty and poor quality reset', () => {
  const gate = createStabilityGate(); const ranking = [item('a', 0.08), item('b', 0.2)];
  for (let i = 1; i <= 4; i++) { const result = gate.update(ranking, quality); assert.equal(result.count, i); assert.equal(result.ready, i === 4); }
  assert.equal(gate.update([item('a', 0.3)], quality).count, 0);
  assert.equal(gate.update(ranking, quality).count, 1);
  assert.equal(gate.update(ranking, { ...quality, mean: 0 }).count, 0);
  gate.reset(); assert.equal(gate.update(ranking, quality).count, 1);
});
test('lookalike references stay ambiguous; changing identity resets stability', () => {
  const gate = createStabilityGate();
  assert.equal(gate.update([item('a', 0.08), item('b', 0.09)], quality).ambiguous, true);
  gate.update([item('a', 0.08)], quality);
  assert.equal(gate.update([item('b', 0.08)], quality).count, 1);
  assert.equal(gate.update([], quality).ready, false);
});
