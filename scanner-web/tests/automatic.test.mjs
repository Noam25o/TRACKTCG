import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveAutomatically, reconcileNumber } from '../public/automatic.mjs';
import { parseCollector } from '../public/collector.mjs';

const result = required => ({ candidates: [
  {card:{id:'a',number:'9',setCode:'base1'}}, {card:{id:'b',number:'014',setCode:'base1'}}],
  ambiguous:true, verification:{required,footer:required ? 'test' : undefined} });
test('clear visual result never initializes OCR or retains image data', async () => {
  let calls=0; const input=result(false);
  const output=await resolveAutomatically(input,{createEngine:async()=>{calls++;}});
  assert.equal(calls,0); assert.equal(output.resolution,'visual');
  assert.equal('footer' in output.verification,false);
});
test('automatic verification reorders compatible candidates without selecting/removing them', async () => {
  let terminated=0,released=0; const input=result(true);
  const output=await resolveAutomatically(input,{
    createEngine:async()=>({terminate(){terminated++;}}),
    decode:async()=>({image:{},release(){released++;}}), read:async()=>parseCollector('14/102')});
  assert.equal(output.resolution,'number-supported'); assert.equal(output.ambiguous,false);
  assert.deepEqual(output.candidates.map(c=>c.card.id),['b','a']);
  assert.equal(input.candidates[0].card.id,'a'); assert.equal(terminated,1);assert.equal(released,1);
  assert.equal('footer' in input.verification,false);
});
test('unreadable, contradictory and shared numbers never become an exact-print claim', () => {
  assert.equal(reconcileNumber(result(true),null).resolution,'unreadable');
  const conflict=reconcileNumber(result(true),parseCollector('99/102'));
  assert.equal(conflict.resolution,'conflict');assert.equal(conflict.ambiguous,true);
  assert.equal(conflict.candidates.length,2);
  const shared=result(true);shared.candidates[0].card.number='14';
  assert.equal(reconcileNumber(shared,parseCollector('14/102')).resolution,'ambiguous');
});
test('timeout and navigation cancel initialization; late workers are terminated', async () => {
  let ready, stopped=false;
  const output=await resolveAutomatically(result(true),{timeoutMs:5,
    createEngine:()=>new Promise(resolve=>{ready=resolve;})});
  assert.equal(output.resolution,'unreadable');
  ready({terminate(){stopped=true;}});await new Promise(setImmediate);assert.equal(stopped,true);
  const controller=new AbortController(); let began;
  const pending=resolveAutomatically(result(true),{signal:controller.signal,
    createEngine:signal=>new Promise((_,reject)=>{began=true;signal.addEventListener('abort',()=>reject(new Error('cancel')));})});
  assert.equal(began,true);controller.abort();await assert.rejects(pending,{name:'AbortError'});
});
