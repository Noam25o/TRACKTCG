import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createScannerServer, allowedHost } from '../server.mjs';

async function fixture(t, fetchImpl = () => assert.fail('unexpected upstream request')) {
  const { server } = createScannerServer({ token: 'test-access', fetchImpl });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => { server.closeAllConnections(); server.close(); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const headers = { Cookie: 'scanner_access=test-access' };
  return { base, headers };
}
test('access link becomes HttpOnly cookie; static root cannot expose workspace', async (t) => {
  const { base, headers } = await fixture(t);
  assert.equal((await fetch(base)).status, 401);
  const login = await fetch(`${base}/?access=test-access`, { redirect: 'manual', headers: { 'Sec-Fetch-Site': 'cross-site' } });
  assert.equal(login.status, 303); assert.match(login.headers.get('set-cookie'), /HttpOnly; SameSite=Lax/);
  const page = await fetch(base, { headers }); assert.equal(page.status, 200);
  assert.match(await page.text(), /Collection & scanner/);
  for (const route of ['/server.mjs', '/.env', '/mobile/src/data/pokemon-names.json', '/LICENSE', '/favicon.ico']) {
    assert.equal((await fetch(base + route, { headers })).status, 404);
  }
});
test('server accepts no uploads, blocks cross-origin proxy calls and applies privacy headers', async (t) => {
  const { base, headers } = await fixture(t);
  assert.equal((await fetch(base + '/api/reference', { method: 'POST', headers, body: 'camera frame' })).status, 405);
  assert.equal((await fetch(base + '/api/catalog', { headers: { ...headers, Origin: 'https://evil.test' } })).status, 403);
  const page = await fetch(base, { headers });
  assert.equal(page.headers.get('cache-control'), 'no-store');
  assert.match(page.headers.get('permissions-policy'), /microphone=\(\)/);
  assert.match(page.headers.get('content-security-policy'), /connect-src 'self'/);
  assert.equal((await fetch(base + '/api/reference?url=http://127.0.0.1:8081/', { headers })).status, 400);
});
test('reference downloads are allowlisted, redirects disabled and cache memory-only', async (t) => {
  let calls = 0;
  const { base, headers } = await fixture(t, async (url, options) => {
    assert.equal(url, 'https://tcgplayer-cdn.tcgplayer.com/product/573717_in_400x400.jpg');
    assert.equal(options.redirect, 'error'); calls++;
    return new Response(new Uint8Array([1, 2, 3]), { headers: { 'content-type': 'image/jpeg' } });
  });
  const route = `${base}/api/reference?${new URLSearchParams({ url: 'https://tcgplayer-cdn.tcgplayer.com/product/573717_in_400x400.jpg' })}`;
  for (let i = 0; i < 2; i++) { const response = await fetch(route, { headers }); assert.equal(response.status, 200); assert.equal((await response.arrayBuffer()).byteLength, 3); }
  assert.equal(calls, 1);
});
test('non-images and oversized reference bodies are rejected', async (t) => {
  const { base, headers } = await fixture(t, async () => new Response('bad', { headers: { 'content-type': 'text/html' } }));
  const route = '/api/reference?url=https%3A%2F%2Ftcgplayer-cdn.tcgplayer.com%2Fproduct%2F573717_in_400x400.jpg';
  assert.equal((await fetch(base + route, { headers })).status, 502);
  const large = await fixture(t, async () => new Response('bad', { headers: { 'content-type': 'image/jpeg', 'content-length': String(5 * 1024 * 1024) } }));
  assert.equal((await fetch(large.base + route, { headers: large.headers })).status, 502);
});
test('public tunnel hostnames are refused unless explicitly enabled', () => {
  assert.equal(allowedHost('example.trycloudflare.com'), false);
  assert.equal(allowedHost('example.trycloudflare.com', true), true);
  assert.equal(allowedHost('example.trycloudflare.com.evil.test', true), false);
  assert.equal(allowedHost('evil.test'), false);
});
test('local OCR assets are authenticated and exactly allowlisted, with WASM permission only', async (t) => {
  const { base, headers } = await fixture(t);
  for (const route of ['/ocr.mjs', '/pokemon-names.json', '/ocr-assets/worker.min.js', '/ocr-assets/core/tesseract-core-simd-lstm.wasm', '/ocr-assets/lang/fra.traineddata.gz']) {
    assert.equal((await fetch(base + route)).status, 401);
    const response = await fetch(base + route, { headers }); assert.equal(response.status, 200);
    await response.arrayBuffer();
  }
  for (const route of ['/node_modules/tesseract.js/package.json', '/ocr-assets/core/package.json', '/ocr-assets/lang/../../server.mjs']) assert.equal((await fetch(base + route, { headers })).status, 404);
  const csp = (await fetch(base, { headers })).headers.get('content-security-policy');
  assert.match(csp, /worker-src 'self'/); assert.match(csp, /'wasm-unsafe-eval'/); assert.doesNotMatch(csp, /'unsafe-eval'|'unsafe-inline'/);
});

test('card detail route preserves exact identity and exposes the web modules', async (t) => {
  const { base, headers } = await fixture(t, async (url) => {
    assert.equal(url, 'https://api.tcgdex.net/v2/fr/cards/base1-14');
    return new Response(JSON.stringify({ id: 'base1-14', name: 'Raichu', localId: '14', rarity: 'Rare',
      set: { id: 'base1', name: 'Set de Base', cardCount: { official: 102 } }, variants: { holo: true } }),
    { headers: { 'content-type': 'application/json' } });
  });
  const response = await fetch(`${base}/api/card?id=tcgdex:FR:base1-14`, { headers });
  assert.equal(response.status, 200);
  const card = await response.json(); assert.equal(card.number, '14/102'); assert.equal(card.marketPrice, null);
  assert.equal(card.id, 'tcgdex:FR:base1-14'); assert.ok(card.searchNames.includes('Raichu'));
  for (const module of ['web', 'storage', 'collection']) assert.equal((await fetch(`${base}/${module}.mjs`, { headers })).status, 200);
});

test('a missing detail is an error rather than an empty fabricated card', async (t) => {
  const { base, headers } = await fixture(t, async () => new Response('missing', { status: 404 }));
  const response = await fetch(`${base}/api/card?id=tcgdex:FR:base1-14`, { headers });
  assert.equal(response.status, 502); assert.match((await response.json()).error, /introuvable/);
});

test('thumbnail bursts are queued with at most six upstream requests', async (t) => {
  let active = 0, peak = 0;
  const { base, headers } = await fixture(t, async () => {
    active++; peak = Math.max(peak, active);
    await new Promise((resolve) => setTimeout(resolve, 20)); active--;
    return new Response(new Uint8Array([1]), { headers: { 'content-type': 'image/jpeg' } });
  });
  const responses = await Promise.all(Array.from({ length: 18 }, (_, index) => fetch(`${base}/api/reference?${new URLSearchParams({
    url: `https://tcgplayer-cdn.tcgplayer.com/product/${573700 + index}_in_400x400.jpg`,
  })}`, { headers })));
  assert.ok(responses.every((response) => response.status === 200)); assert.equal(peak, 6);
});
