import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCollector, collectorFromTsv, refineRanking, readCollector, readCollectorFooter } from '../public/collector.mjs';

const tsv = (words, confidence = 95) => 'header\n' + words.map((word, i) => `5\t1\t1\t1\t1\t${i+1}\t0\t0\t20\t10\t${confidence}\t${word}`).join('\n');
test('exact collector numbers preserve prefixes and do not guess set from denominator', () => {
  assert.equal(parseCollector('001/165').number, '1');
  assert.equal(parseCollector('001/165').set, null);
  assert.equal(parseCollector('001/SV-P').set, 'SVP');
  assert.equal(parseCollector('GG01/GG70').number, 'GG1');
  assert.equal(parseCollector('SWSH001').number, 'SWSH1');
  assert.equal(parseCollector('O01/165').number, 'O1', 'O is not silently replaced by zero');
  assert.equal(parseCollector('14/102 extra'), null);
});
test('OCR requires one confident fraction, not copyright, HP or conflicting numbers', () => {
  assert.equal(collectorFromTsv(tsv(['14', '/', '102'])).number, '14');
  assert.equal(collectorFromTsv(tsv(['001/SV-P'])).set, 'SVP');
  assert.equal(collectorFromTsv(tsv(['©2026', '140'])), null);
  assert.equal(collectorFromTsv(tsv(['14/102', '9/102'])), null);
  assert.equal(collectorFromTsv(tsv(['14/102'], 40)), null);
  assert.equal(collectorFromTsv(tsv(['14/102junk'])), null);
});
test('refinement ranks exact compatible proposals first without removing or selecting any', () => {
  const ranking = [['a','9','base1'], ['b','014','base1'], ['c','14','base2']].map(([id,number,setCode]) => ({reference:{card:{id,number,setCode}}}));
  const refined = refineRanking(ranking, '14/102');
  assert.equal(refined.matches, 2); assert.deepEqual(refined.ranking.map(r=>r.reference.card.id), ['b','c','a']);
  assert.equal(refineRanking(ranking,'14','base2').matches, 1);
  assert.deepEqual(refineRanking(ranking, '99').ranking, ranking);
  assert.equal(refineRanking(ranking, '001/SV-P', 'S-P').invalid, true);
  assert.equal(refineRanking(ranking, '').reset, true);
  assert.equal(ranking[0].reference.card.id, 'a', 'original order untouched');
});
test('two crops of the same capture must agree and the temporary canvas is cleared', async () => {
  const previous = globalThis.document; let canvas;
  globalThis.document = { createElement: () => canvas = { getContext: () => ({ fillRect(){}, drawImage(){}, clearRect(){} }) } };
  try {
    const readings = ['14/102','14/102'];
    const engine = { read: async () => ({ wordData: tsv([readings.shift()]) }) };
    assert.equal((await readCollector(engine, {width:600,height:825})).number,'14');
    assert.equal(canvas.width,0); assert.equal(canvas.height,0);
    readings.push('14/102','9/102');
    assert.equal(await readCollector(engine,{width:600,height:825}),null);
    const controller = new AbortController(); controller.abort();
    await assert.rejects(readCollector(engine,{width:600,height:825},controller.signal), { name:'AbortError' });
  } finally { globalThis.document = previous; }
});

test('rectified footer keeps context at bounded scales and stops after two agreements', async () => {
  const previous = globalThis.document, draws=[];let reads=0;
  globalThis.document={createElement:()=>({getContext:()=>({fillRect(){},clearRect(){},drawImage(...args){draws.push(args);}})})};
  try {
    const wordData='header\n5\t1\t1\t1\t1\t1\t1360\t307\t150\t35\t90\t14/102';
    const engine={read:async(canvas,options)=>{reads++;assert.equal(options.pageMode,'6');if(reads===2){assert.equal(canvas.width,1020);}return{wordData};}};
    assert.equal((await readCollectorFooter(engine,{width:900,height:252})).number,'14');
    assert.equal(reads,2);
    assert.equal(draws[1][1],18);
    assert.equal(draws[1][2],126);
    assert.equal(draws[1][3],864,'keep surrounding text instead of magnifying a noisy word box');
  } finally {globalThis.document=previous;}
});

test('ink fallback needs two confident readings; conflict, low confidence and cancellation refuse', async () => {
  const previous=globalThis.document; let canvas, reads;
  globalThis.document={createElement:()=>canvas={getContext:()=>({fillRect(){},clearRect(){},drawImage(){},
    getImageData:()=>({data:new Uint8ClampedArray([80,80,80,255])}),putImageData(){}})}};
  try {
    for (const [words,expected,count] of [
      [[null,'020/189','020/189'],'20',3],
      [['14/102','9/102','14/102'],null,2],
      [[null,null,'14/102'],null,3],
      [[null,null,null],null,3],
      [[null,'001/SV-P','001/SV-P'],'1',3],
    ]) {
      reads=0;
      const engine={read:async()=>({wordData:words[reads++]?tsv([words[reads-1]]):tsv(['14/102'],40)})};
      assert.equal((await readCollectorFooter(engine,{width:900,height:252}))?.number??null,expected);
      assert.equal(reads,count); assert.equal(canvas.width,0);
    }
    const controller=new AbortController();
    await assert.rejects(readCollectorFooter({read:async()=>{controller.abort();return{wordData:tsv(['14/102'])};}},
      {width:900,height:252},controller.signal),{name:'AbortError'});
    assert.equal(canvas.width,0);
  } finally {globalThis.document=previous;}
});
