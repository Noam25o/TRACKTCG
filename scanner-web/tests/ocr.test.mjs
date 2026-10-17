import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolveOcrName, createNameGate, createOcrBridge, titleWords, titleInk, readCardTitle } from '../public/ocr.mjs';
import { readCardSuffix, suffixSearchQuery, normalizeCardSuffix } from '../public/vision.mjs';
const dictionary = JSON.parse(readFileSync(new URL('../../mobile/src/data/pokemon-names.json', import.meta.url)));

test('OCR resolves native names only, with longest Japanese match and no multi-Pokémon guessing', () => {
  for (const [text, lang, expected] of [['Raichu 120 PV', 'FR', 'Raichu'], ['Évoli', 'FR', 'Évoli'],
    ['Charizard ex HP330', 'EN', 'Charizard'], ['リザードンex HP330', 'JP', 'リザードン'],
    ['Parasect HP90', 'EN', 'Parasect']]) {
    assert.equal(resolveOcrName(text, lang, dictionary)?.name, expected, text);
  }
  for (const [text, lang] of [['Pas une carte', 'FR'], ['Charizard & Braixen GX', 'EN'], ['Raichu Pikachu', 'FR'],
    ['Raichu', 'JP'], ['Raichux', 'FR'], ['Nidoran', 'FR']]) assert.equal(resolveOcrName(text, lang, dictionary), null, text);
});
test('title extraction rejects low-confidence/small evolution names and joins Japanese word fragments', () => {
  const header = 'level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext\n';
  const row = (word, height, confidence) => `5\t1\t1\t1\t1\t1\t0\t0\t80\t${height}\t${confidence}\t${word}`;
  assert.equal(titleWords(header + [row('Pikachu', 15, 95), row('Raichu', 50, 95), row('NIVEAU', 30, 95), row('noise', 60, 20)].join('\n'), 'FR'), 'Raichu');
  assert.equal(titleWords(header + [row('リザー', 45, 95), row('ドン', 50, 95)].join('\n'), 'JP'), 'リザードン');
  assert.equal(titleWords(header + [row('Evolves', 43, 95), row('from', 43, 95), row('Charizard', 43, 95), row('V', 20, 95)].join('\n'), 'EN'), '');
});

test('titles preserve ex, VMAX, VSTAR, GX and glued suffixes across FR/EN/JP without guessing', () => {
  for (const [text, language, species, suffix] of [
    ['Dracaufeu-ex 330 PV', 'FR', 'Dracaufeu', 'ex'], ['Dracaufeu EX', 'FR', 'Dracaufeu', 'ex'],
    ['Évoliex', 'FR', 'Évoli', 'ex'], ['CharizardVMAX', 'EN', 'Charizard', 'VMAX'],
    ['Charizard V MAX HP330', 'EN', 'Charizard', 'VMAX'], ['Charizard VSTAR', 'EN', 'Charizard', 'VSTAR'],
    ['Raichu-GX', 'EN', 'Raichu', 'GX'], ['Pikachu V-UNION', 'EN', 'Pikachu', 'V-UNION'],
    ['リザードンｅｘ', 'JP', 'リザードン', 'ex'], ['ピカチュウVMAX', 'JP', 'ピカチュウ', 'VMAX'],
    ['リザードン V', 'JP', 'リザードン', 'V'], ['Raichu', 'FR', 'Raichu', null],
  ]) {
    const read = resolveOcrName(text, language, dictionary);
    assert.equal(read?.name, species, text); assert.equal(read.suffix, suffix, text);
  }
  assert.equal(resolveOcrName('Charizardextra', 'EN', dictionary), null);
  assert.equal(readCardSuffix('Raichu\nex', 'Raichu'), null);
  assert.equal(readCardSuffix('Raichu exercise', 'Raichu'), null);
  assert.equal(readCardSuffix('Charizard VMAX', 'Charizard'), 'VMAX');
  assert.equal(readCardSuffix('Charizard VSTAR', 'Charizard'), 'VSTAR');
  assert.equal(normalizeCardSuffix('constructor'), null);
  assert.equal(suffixSearchQuery('リザードン', 'ex'), 'リザードン ex|リザードン-ex|リザードンex');
  assert.ok(suffixSearchQuery('a'.repeat(60), 'VMAX').length <= 80);
});

test('small Latin suffixes retained beside the title, including JP and fragmented V MAX, but not evolution captions', () => {
  const header = 'level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext\n';
  const row = (text, left, top, width, height, line = 1, confidence = 95) => `5\t1\t1\t1\t${line}\t1\t${left}\t${top}\t${width}\t${height}\t${confidence}\t${text}`;
  for (const [base, lang] of [['Charizard', 'EN'], ['Dracaufeu', 'FR'], ['リザードン', 'JP']]) {
    const text = titleWords(header + [row(base, 10, 10, 250, 50), row('ex', 270, 30, 40, 20),
      row('HP', 500, 0, 80, 60)].join('\n'), lang);
    assert.equal(resolveOcrName(text, lang, dictionary)?.suffix, 'ex', text);
    const fragments = titleWords(header + [row(base, 10, 10, 250, 50), row('V', 270, 30, 18, 20),
      row('MAX', 295, 30, 50, 20)].join('\n'), lang);
    assert.equal(resolveOcrName(fragments, lang, dictionary)?.suffix, 'VMAX', fragments);
    assert.equal((fragments.match(/V/g) || []).length, 1, 'overlapping suffix runs must not duplicate tokens');
    const wrongLine = titleWords(header + [row(base, 10, 100, 250, 50), row('ex', 270, 0, 40, 20, 2)].join('\n'), lang);
    assert.equal(resolveOcrName(wrongLine, lang, dictionary)?.suffix, null);
  }
});
test('two consecutive name readings required; a miss or different Pokémon resets the gate', () => {
  const gate = createNameGate(), a = { key: 26, name: 'Raichu' }, b = { key: 25, name: 'Pikachu' };
  assert.equal(gate.update(a), null); assert.equal(gate.update(a), a);
  gate.update(null); assert.equal(gate.update(a), null); assert.equal(gate.update(b), null); assert.equal(gate.update(b), b);
  gate.reset(); assert.equal(gate.update(b), null);
  gate.reset(); assert.equal(gate.update({ ...a, suffix: 'V' }), null);
  assert.equal(gate.update({ ...a, suffix: 'VMAX' }), null);
  assert.equal(gate.update({ ...a, suffix: 'VMAX' }).suffix, 'VMAX');
  assert.equal(gate.update(a), null, 'unread suffix must not confirm the previous VMAX reading');
});

test('Japanese fragments retain moderate-confidence kana without huge Latin HP removing the title', () => {
  const header = 'level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext\n';
  const row = (word, height, confidence, line = 1) => `5\t1\t1\t1\t${line}\t1\t0\t0\t80\t${height}\t${confidence}\t${word}`;
  const text = titleWords(header + [row('ピカ', 30, 35), row('チュウ', 35, 90), row('HP', 70, 95), row('たね', 10, 95)].join('\n'), 'JP');
  assert.equal(text, 'ピカチュウ');
  assert.equal(resolveOcrName(text, 'JP', dictionary)?.name, 'ピカチュウ');
  assert.equal(titleWords(header + [row('ピカ', 30, 95), row('チュウ', 30, 95, 2)].join('\n'), 'JP'), 'ピカ\nチュウ');
  assert.equal(resolveOcrName('ピカ\nチュウ', 'JP', dictionary), null);
  assert.equal(titleWords(header + row('ピカチュウ', 30, 5), 'JP'), '');
});
test('worker bridge forwards progress and data; close cancels pending initialization and late packets', async () => {
  const handlers = new Map(), packets = [], progress = [];
  const worker = { addEventListener: (type, callback) => handlers.set(type, callback),
    postMessage: (packet) => packets.push(packet), terminate() { this.stopped = true; } };
  const bridge = createOcrBridge(worker, (value) => progress.push(value));
  const pending = bridge.request('load', { options: {} });
  handlers.get('message')({ data: { jobId: packets[0].jobId, status: 'progress', data: { progress: .5 } } });
  assert.equal(progress[0].progress, .5);
  handlers.get('message')({ data: { jobId: packets[0].jobId, status: 'resolve', data: { loaded: true } } });
  assert.deepEqual(await pending, { loaded: true });
  const next = bridge.request('loadLanguage', {}); bridge.close();
  await assert.rejects(next, /arrêtée/); assert.equal(worker.stopped, true);
  handlers.get('message')({ data: { jobId: packets[1].jobId, status: 'resolve', data: {} } });
  await assert.rejects(bridge.request('recognize', {}));
});
test('worker errors and timeouts reject rather than leaving camera work hanging', async () => {
  const handlers = new Map(), worker = { addEventListener: (type, fn) => handlers.set(type, fn), postMessage() {}, terminate() {} };
  const bridge = createOcrBridge(worker); const pending = bridge.request('load', {});
  handlers.get('error')(); await assert.rejects(pending, /indisponible/);
  await assert.rejects(createOcrBridge(worker).request('load', {}, 10), /trop long/);
});

test('title ink pass keeps neutral dark strokes, removes colourful background and is local only', () => {
  const data = new Uint8ClampedArray([20, 22, 19, 255, 10, 40, 160, 255, 230, 230, 230, 255]);
  assert.equal(titleInk(data), data);
  assert.deepEqual([...data], [0, 0, 0, 255, 255, 255, 255, 255, 255, 255, 255, 255]);
});

test('captured title retries are bounded, stop at an exact name and always clear scratch pixels', async (t) => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'document');
  t.after(() => { if (previous) Object.defineProperty(globalThis, 'document', previous); else delete globalThis.document; });
  const canvas = { width: 0, height: 0, getContext: () => ({ fillRect() {}, drawImage() {}, clearRect() {},
    getImageData: () => ({ data: new Uint8ClampedArray([20, 20, 20, 255]) }), putImageData() {} }) };
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { createElement: () => canvas } });
  let reads = 0;
  const engine = { async read(_, options) { reads++; assert.ok(['6', '7'].includes(options.pageMode));
    return { name: reads === 2 ? { key: 25, name: 'ピカチュウ', suffix: 'ex' } : null }; } };
  assert.equal((await readCardTitle(engine, { width: 1080, height: 1508 }, 'JP')).name.name, 'ピカチュウ');
  assert.equal(reads, 3, 'JP suffix verified in a wide crop rather than trusting a possibly clipped V'); assert.equal(canvas.width, 0);
  reads = 0; await readCardTitle({ async read() { reads++; return { name: null }; } }, { width: 1080, height: 1508 }, 'JP');
  assert.equal(reads, 3); assert.equal(canvas.height, 0);
  reads = 0;
  const verified = await readCardTitle({ async read() { reads++;
    return { name: { key: 25, name: 'ピカチュウ', suffix: reads === 1 ? 'V' : 'VMAX' } }; }
  }, { width: 1080, height: 1508 }, 'JP');
  assert.equal(reads, 2, 'skip optional ink pass after a name is read, but verify wide');
  assert.equal(verified.name.suffix, 'VMAX');
  reads = 0;
  const conflict = await readCardTitle({ async read() { reads++; return { name: { key: reads === 1 ? 25 : 26 } }; }
  }, { width: 1080, height: 1508 }, 'JP');
  assert.equal(conflict.name, null);
  reads = 0;
  await readCardTitle({ async read() { reads++; return { name: null }; } }, { width: 1080, height: 1508 }, 'FR');
  assert.equal(reads, 4, 'Latin title retries stay bounded');
  const hypothesis = { key: 6, name: 'Dracaufeu', suffix: 'ex' };
  reads = 0;
  const recovered = await readCardTitle({ async read() { reads++; return { name: null,
    titleHypothesis: reads === 2 || reads === 3 ? hypothesis : null }; }
  }, { width: 1080, height: 1508 }, 'FR');
  assert.equal(recovered.name, hypothesis); assert.equal(recovered.hypothesis, true); assert.equal(reads, 3);
  reads = 0;
  const uncorroborated = await readCardTitle({ async read() { reads++; return { name: null,
    titleHypothesis: reads === 2 ? hypothesis : { ...hypothesis, suffix: 'V' } }; }
  }, { width: 1080, height: 1508 }, 'FR');
  assert.equal(uncorroborated.name, null, 'one low-confidence title or different suffixes cannot confirm a hypothesis');
  await assert.rejects(readCardTitle({ async read() { throw new Error('Cancelled'); } }, { width: 1080, height: 1508 }, 'FR'));
  assert.equal(canvas.width, 0);
});
