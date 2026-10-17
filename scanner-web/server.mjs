import http from 'node:http';
import https from 'node:https';
import { readFileSync } from 'node:fs';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { allowedImageUrl, searchCards, getCardDetail } from './catalog.mjs';
import { ocrAssets } from './ocr-assets.mjs';
import { createVisualBridge } from './visual/bridge.mjs';

const staticFiles = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/style.css', ['style.css', 'text/css; charset=utf-8']],
  ['/app.mjs', ['app.mjs', 'text/javascript; charset=utf-8']],
  ['/vision.mjs', ['vision.mjs', 'text/javascript; charset=utf-8']],
  ['/candidates.mjs', ['candidates.mjs', 'text/javascript; charset=utf-8']],
  ['/collector.mjs', ['collector.mjs', 'text/javascript; charset=utf-8']],
  ['/automatic.mjs', ['automatic.mjs', 'text/javascript; charset=utf-8']],
  ['/web.mjs', ['web.mjs', 'text/javascript; charset=utf-8']],
  ['/collection.mjs', ['collection.mjs', 'text/javascript; charset=utf-8']],
  ['/storage.mjs', ['storage.mjs', 'text/javascript; charset=utf-8']],
  ['/ocr.mjs', ['ocr.mjs', 'text/javascript; charset=utf-8']],
  ['/ocr-notices.txt', ['ocr-notices.txt', 'text/plain; charset=utf-8']],
]);
const headers = {
  'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Permissions-Policy': 'camera=(self), microphone=(), geolocation=()',
  'Content-Security-Policy': "default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self'; style-src 'self'; img-src 'self' blob:; media-src 'self' blob:; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
};
function equals(a, b) {
  const left = Buffer.from(a || ''), right = Buffer.from(b || '');
  return left.length === right.length && timingSafeEqual(left, right);
}
export function allowedHost(host, allowTunnel = false) {
  return host === 'localhost' || host === '127.0.0.1' || host === '[::1]'
    || /^192\.168\.\d{1,3}\.\d{1,3}$/.test(host) || /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)
    || /^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(host)
    || (allowTunnel && /^[a-z0-9-]+\.trycloudflare\.com$/.test(host));
}

export function createScannerServer({ token = randomBytes(24).toString('hex'),
  fetchImpl = fetch, tls, allowTunnel = false, diagnostics = false, visual = null } = {}) {
  const visualStatus = visual ? visual.request('status').then(({ ids, ...status }) => status).catch(() => null) : Promise.resolve(null);
  let activeRequests = 0;
  const waiting = [];
  const cache = new Map();
  let cacheBytes = 0;
  async function acquire() {
    if (activeRequests < 6) { activeRequests++; return; }
    if (waiting.length >= 48) throw new Error('Trop de requêtes simultanées. Réessaie.');
    await new Promise((resolve, reject) => {
      const entry = { resolve: () => { clearTimeout(timer); resolve(); } };
      const timer = setTimeout(() => {
        const index = waiting.indexOf(entry); if (index >= 0) waiting.splice(index, 1);
        reject(new Error('Les références mettent trop de temps à charger. Réessaie.'));
      }, 15000);
      waiting.push(entry);
    });
  }
  function release() { if (waiting.length) waiting.shift().resolve(); else activeRequests--; }
  async function download(url, image = false, emptyOn404 = true) {
    if (image && cache.has(url)) return cache.get(url);
    await acquire();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      if (image && cache.has(url)) return cache.get(url);
      const response = await fetchImpl(url, { redirect: 'error', signal: controller.signal,
        headers: { Accept: image ? 'image/png,image/jpeg,image/webp' : 'application/json' } });
      if (!image && response.status === 404 && emptyOn404) return { bytes: Buffer.from('[]'), type: 'application/json' };
      if (response.status === 404) throw new Error('Fiche ou image introuvable dans cette source.');
      if (!response.ok) throw new Error('Source momentanément indisponible.');
      const type = (response.headers.get('content-type') || '').split(';')[0];
      if (image ? !['image/png', 'image/jpeg', 'image/webp'].includes(type) : type !== 'application/json') {
        throw new Error('Format de référence non autorisé.');
      }
      const maxBytes = image ? 4 * 1024 * 1024 : 1024 * 1024;
      if (Number(response.headers.get('content-length')) > maxBytes) throw new Error('Référence trop volumineuse.');
      const parts = []; let size = 0;
      for await (const part of response.body) {
        size += part.length;
        if (size > maxBytes) { controller.abort(); throw new Error('Référence trop volumineuse.'); }
        parts.push(Buffer.from(part));
      }
      const result = { bytes: Buffer.concat(parts), type };
      if (image) {
        if (cache.has(url)) cacheBytes -= cache.get(url).bytes.length;
        while (cacheBytes + size > 24 * 1024 * 1024 && cache.size) {
          const key = cache.keys().next().value; cacheBytes -= cache.get(key).bytes.length; cache.delete(key);
        }
        cache.set(url, result); cacheBytes += size;
      }
      return result;
    } finally { clearTimeout(timer); release(); }
  }
  const handler = async (req, res) => {
    for (const [key, value] of Object.entries(headers)) res.setHeader(key, value);
    const json = (status, value) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(value)); };
    try {
      const host = req.headers.host || '';
      const base = new URL(`http://${host}`);
      if (!allowedHost(base.hostname, allowTunnel)) return json(403, { error: 'Hôte refusé.' });
      const url = new URL(req.url, base);
      if (req.method !== 'GET' && !(visual && req.method === 'POST' && url.pathname === '/api/visual/recognize')) return json(405, { error: 'Méthode refusée pour cette route.' });
      if (url.pathname === '/' && equals(url.searchParams.get('access'), token)) {
        const secure = Boolean(req.socket.encrypted) || (allowTunnel && base.hostname.endsWith('.trycloudflare.com'));
        res.writeHead(303, { Location: '/', 'Set-Cookie': `scanner_access=${token}; HttpOnly; SameSite=Lax; Path=/${secure ? '; Secure' : ''}` });
        return res.end();
      }
      if (req.headers['sec-fetch-site'] === 'cross-site'
        || (req.headers.origin && new URL(req.headers.origin).host !== host)) return json(403, { error: 'Origine refusée.' });
      const cookie = (req.headers.cookie || '').split(';').map((item) => item.trim())
        .find((item) => item.startsWith('scanner_access='))?.slice('scanner_access='.length);
      if (!equals(cookie, token)) return json(401, { error: 'Ouvre le lien complet affiché dans le terminal du scanner.' });
      if (url.pathname === '/api/visual/status') {
        const status = await visualStatus;
        return json(200, status || { indexed: 0, counts: {}, available: false });
      }
      if (visual && url.pathname === '/api/visual/recognize' && req.method === 'POST') {
        // Sole upload route, opt-in server only. Same-origin cookie + Origin
        // required, JPEG only, bounded body, no persistence or request logging.
        if (!req.headers.origin || new URL(req.headers.origin).host !== host) return json(403, { error: 'Origine refusée.' });
        const language = url.searchParams.get('language');
        if (!['FR', 'EN', 'JP'].includes(language)) return json(400, { error: 'Langue invalide.' });
        if (req.headers['content-type'] !== 'image/jpeg') return json(415, { error: 'Image JPEG requise.' });
        const max = 3 * 1024 * 1024;
        if (Number(req.headers['content-length']) > max) return json(413, { error: 'Image trop volumineuse.' });
        req.setTimeout(10000, () => req.destroy());
        const parts = []; let size = 0, image;
        try {
          for await (const part of req) {
            size += part.length;
            if (size > max) { part.fill(0); return json(413, { error: 'Image trop volumineuse.' }); }
            parts.push(part);
          }
          req.setTimeout(0);
          image = Buffer.concat(parts);
          if (image[0] !== 0xff || image[1] !== 0xd8) return json(400, { error: 'Image invalide.' });
          return json(200, await visual.request('recognize', { language, image: image.toString('base64'),
            // OCR rectification is not yet reliable in browser trials. Keep it
            // in local diagnostics, without slowing down public phone scans.
            withVerification: diagnostics && !allowTunnel,
            forceVerification: diagnostics && !allowTunnel && url.searchParams.get('verify') === '1' }));
        } finally {
          req.setTimeout(0); image?.fill(0); for (const part of parts) part.fill(0);
        }
      }
      if (diagnostics && !allowTunnel && ['localhost', '127.0.0.1', '[::1]'].includes(base.hostname)
        && ['/ocr-check', '/ocr-check.mjs', '/visual-check', '/visual-check.mjs'].includes(url.pathname)) {
        const script = url.pathname.endsWith('.mjs');
        const test = url.pathname.startsWith('/visual') ? 'browser-visual' : 'browser-ocr';
        res.writeHead(200, { 'Content-Type': script ? 'text/javascript' : 'text/html' });
        return res.end(readFileSync(new URL(`tests/${test}.${script ? 'mjs' : 'html'}`, import.meta.url)));
      }
      if (ocrAssets.has(url.pathname)) {
        const [file, type] = ocrAssets.get(url.pathname);
        res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'private, max-age=86400' });
        return res.end(readFileSync(new URL(`node_modules/${file}`, import.meta.url)));
      }
      if (url.pathname === '/pokemon-names.json') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(readFileSync(new URL('../mobile/src/data/pokemon-names.json', import.meta.url)));
      }
      if (staticFiles.has(url.pathname)) {
        const [file, type] = staticFiles.get(url.pathname);
        res.writeHead(200, { 'Content-Type': type });
        return res.end(readFileSync(new URL(`public/${file}`, import.meta.url)));
      }
      if (url.pathname === '/api/catalog') {
        const result = await searchCards(url.searchParams, async (source) => JSON.parse((await download(source)).bytes.toString('utf8')));
        return json(200, result);
      }
      if (url.pathname === '/api/card') {
        return json(200, await getCardDetail(url.searchParams.get('id'), async (source) =>
          JSON.parse((await download(source, false, false)).bytes.toString('utf8'))));
      }
      if (url.pathname === '/api/reference') {
        const source = url.searchParams.get('url');
        if (!allowedImageUrl(source)) return json(400, { error: 'URL de référence refusée.' });
        const result = await download(source, true);
        res.writeHead(200, { 'Content-Type': result.type }); return res.end(result.bytes);
      }
      return json(404, { error: 'Route introuvable.' });
    } catch (error) {
      return json(502, { error: error.name === 'AbortError' ? 'La source ne répond pas. Réessaie.' : error.message });
    }
  };
  const server = tls ? https.createServer(tls, handler) : http.createServer(handler);
  server.on('close', () => visual?.close());
  return { server, token };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const cert = process.env.SCAN_TLS_CERT, key = process.env.SCAN_TLS_KEY;
  if (Boolean(cert) !== Boolean(key)) throw new Error('SCAN_TLS_CERT et SCAN_TLS_KEY doivent être configurés ensemble.');
  const tls = cert ? { cert: readFileSync(cert), key: readFileSync(key) } : undefined;
  const host = process.argv.includes('--lan') ? '0.0.0.0' : '127.0.0.1';
  const port = Number(process.env.SCAN_PORT || (tls ? 8443 : 8787));
  const tokenOverride = process.env.SCAN_ACCESS_TOKEN;
  if (tokenOverride && !/^[a-f0-9]{48}$/.test(tokenOverride)) throw new Error('Clé de reprise invalide.');
  const { server, token } = createScannerServer({ tls, token: tokenOverride, allowTunnel: process.env.SCAN_ALLOW_TUNNEL === 'true', diagnostics: process.argv.includes('--ocr-check'), visual: process.env.SCAN_VISUAL_PC === 'true' ? createVisualBridge() : null });
  server.listen(port, host, () => {
    console.log(`Scanner : ${tls ? 'https' : 'http'}://localhost:${port}/?access=${token}`);
    console.log(host === '0.0.0.0' ? 'LAN actif : remplace localhost par l’adresse IPv4 du PC.' : 'Accès limité au PC.');
    console.log(tls ? 'iPhone : certificat racine de confiance requis. Ne partage jamais la clé privée.'
      : 'HTTP localhost sert au test PC. Sur iPhone, HTTPS est obligatoire. Aucun tunnel lancé.');
  });
  server.on('error', (error) => { console.error(`Démarrage impossible : ${error.message}`); process.exitCode = 1; });
}
