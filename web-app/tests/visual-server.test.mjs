import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createScannerServer } from '../server.mjs';

test('opt-in visual endpoint authenticates and bounds JPEG uploads; old routes remain read-only', async (t) => {
  const packets = [];
  const visual = { close() {}, async request(action, payload) {
    if (action === 'status') return { indexed: 12, counts: { FR: 12 }, ids: ['private-internal-id'] };
    packets.push(payload); return { candidates: [], indexed: 12, milliseconds: 1 };
  } };
  const { server } = createScannerServer({ token: 'test-access', visual, fetchImpl: () => assert.fail('no upstream requests during recognition') });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => { server.closeAllConnections(); server.close(); });
  const base = `http://127.0.0.1:${server.address().port}`, route = `${base}/api/visual/recognize?language=FR`;
  const headers = { Cookie: 'scanner_access=test-access', Origin: base, 'Content-Type': 'image/jpeg' };
  const body = new Uint8Array([255, 216, 255, 217]); // API contract only, Python validates actual images.
  assert.equal((await fetch(route, { method: 'POST', headers: { Origin: base, 'Content-Type': 'image/jpeg' }, body })).status, 401);
  assert.equal((await fetch(route, { method: 'POST', headers: { ...headers, Origin: 'https://evil.test' }, body })).status, 403);
  assert.equal((await fetch(route, { method: 'POST', headers: { Cookie: headers.Cookie, 'Content-Type': 'image/jpeg' }, body })).status, 403);
  assert.equal((await fetch(route, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: '{}' })).status, 415);
  assert.equal((await fetch(route, { method: 'POST', headers, body: new Uint8Array(3 * 1024 * 1024 + 1) })).status, 413);
  assert.equal((await fetch(route, { method: 'POST', headers, body: 'not a JPEG' })).status, 400);
  assert.equal((await fetch(`${base}/api/reference`, { method: 'POST', headers, body })).status, 405);
  assert.equal(packets.length, 0);
  const response = await fetch(route, { method: 'POST', headers, body });
  assert.equal(response.status, 200); assert.equal(packets.length, 1); assert.equal(packets[0].language, 'FR');
  assert.equal(Buffer.from(packets[0].image, 'base64').length, 4);
  assert.equal(packets[0].withVerification, false);
  assert.equal(packets[0].forceVerification, false);
  await fetch(`${route}&verify=1`, {method:'POST',headers,body});
  assert.equal(packets[1].forceVerification,false,'diagnostic forcing unavailable in normal server');
  assert.equal(packets[1].withVerification,false,'unvalidated OCR cannot delay normal scans');
  const status = await (await fetch(`${base}/api/visual/status`, { headers })).json();
  assert.equal(status.indexed, 12); assert.equal(status.ids, undefined);
});

test('experimental number verification is restricted to local diagnostics, never tunnels', async (t) => {
  for (const allowTunnel of [false, true]) {
    const packets = [];
    const visual = { close() {}, async request(action,payload) {
      if (action === 'status') return {indexed:12,counts:{FR:12}};
      packets.push(payload); return {candidates:[]};
    } };
    const {server} = createScannerServer({token:'test-access',visual,diagnostics:true,allowTunnel});
    server.listen(0,'127.0.0.1'); await once(server,'listening');
    t.after(()=>{server.closeAllConnections();server.close();});
    const base=`http://127.0.0.1:${server.address().port}`;
    const response=await fetch(`${base}/api/visual/recognize?language=FR&verify=1`,{
      method:'POST',headers:{Cookie:'scanner_access=test-access',Origin:base,'Content-Type':'image/jpeg'},
      body:new Uint8Array([255,216,255,217])});
    assert.equal(response.status,200);
    assert.equal(packets[0].withVerification,!allowTunnel);
    assert.equal(packets[0].forceVerification,!allowTunnel);
  }
});

test('uploads remain disabled unless a local visual engine is explicitly enabled', async (t) => {
  const { server } = createScannerServer({ token: 'test-access' });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => { server.closeAllConnections(); server.close(); });
  const base = `http://127.0.0.1:${server.address().port}`, headers = { Cookie: 'scanner_access=test-access' };
  assert.equal((await fetch(`${base}/api/visual/recognize?language=FR`, { method: 'POST', headers, body: 'image' })).status, 405);
  assert.equal((await (await fetch(`${base}/api/visual/status`, { headers })).json()).indexed, 0);
});
