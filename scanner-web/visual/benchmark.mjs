import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { allowedImageUrl } from '../catalog.mjs';
import { createVisualBridge } from './bridge.mjs';

const bytes = readFileSync(new URL('data/index.json', import.meta.url));
const index = JSON.parse(bytes), build = JSON.parse(readFileSync(new URL('data/build-report.json', import.meta.url)));
const old = new Set(JSON.parse(readFileSync(new URL('data/index-before-2000.json', import.meta.url))).entries.map(e => e.card.id));
const anchors = ['FR:base1-1', 'FR:sv03.5-009', 'EN:swsh3-1', 'EN:swsh3-2', 'JP:SV2a-003', 'JP:SV-P-010'];
const cards = anchors.map(id => index.entries.find(e => e.card.id === `tcgdex:${id}`).card);
// Deterministic new references, spread across each language's additions.
for (const language of ['FR', 'EN', 'JP']) {
  const pool = index.entries.filter(e => e.card.language === language && !old.has(e.card.id));
  for (const fraction of [.15, .45, .75, .95]) cards.push(pool[Math.floor((pool.length - 1) * fraction)].card);
}
const report = { createdAt: new Date().toISOString(), indexSha256: createHash('sha256').update(bytes).digest('hex'),
  engineSha256: createHash('sha256').update(readFileSync(new URL('engine.py', import.meta.url))).digest('hex'),
  indexed: index.entries.length, method: 'Original reference-derived JPEG queries; 3 synthetic variants. Swap only the target reference to WebP Q50. OpenCV encoder, effort not configured; not an exact Squoosh reproduction. Not a phone accuracy benchmark.',
  cases: [], failures: [] };
const engine = createVisualBridge({ script: 'benchmark.py' });
try {
  await engine.request('status');
  for (const [card, absent] of [...cards.map(c => [c, false]), ...build.holdouts.map(c => [c, true])]) {
    let image;
    for (const source of card.images) {
      if (!allowedImageUrl(source.url)) continue;
      try {
        const response = await fetch(source.url, { redirect: 'error', signal: AbortSignal.timeout(12000) });
        if (!response.ok || !/^image\/(png|jpeg|webp)/.test(response.headers.get('content-type') || '')) continue;
        const parts = []; let size = 0;
        for await (const part of response.body) { size += part.length; if (size > 3 * 1024 * 1024) throw new Error('Image too large'); parts.push(Buffer.from(part)); }
        image = Buffer.concat(parts); break;
      } catch { /* Try only recorded alternatives. */ }
    }
    if (!image) { report.failures.push({ id: card.id, error: 'Reference unavailable' }); continue; }
    try {
      const result = await engine.request('case', { card, absent, sourceBytes: image.length, image: image.toString('base64') });
      report.cases.push(result);
      console.log(`${card.id} ${absent ? 'ABSENT' : 'indexed'}: ${result.queries.map(q => absent ? q.original.rejected ? 'refused' : 'FALSE MATCH' : `${q.original.top1 ? 'ok' : 'miss'}/${q.webp50.top1 ? 'webp ok' : 'webp miss'}`).join(' · ')}`);
    } catch (error) { report.failures.push({ id: card.id, error: error.message }); }
    finally { image.fill(0); }
    writeFileSync(new URL('data/benchmark-report.json', import.meta.url), JSON.stringify(report, null, 2));
  }
  const present = report.cases.filter(c => !c.absent), negatives = report.cases.filter(c => c.absent).flatMap(c => c.queries);
  const stats = (key, onlyPilot = false) => {
    const rows = present.flatMap(c => c.queries.filter(q => !onlyPilot || q.pilot411).map(q => q[key]).filter(Boolean)), ms = rows.map(q => q.ms).sort((a, b) => a-b);
    return { queries: rows.length, top1: rows.filter(q => q.top1).length, top3: rows.filter(q => q.top3).length,
      p50ms: ms[Math.floor(ms.length * .5)], p95ms: ms[Math.min(ms.length - 1, Math.floor(ms.length * .95))] };
  };
  report.summary = { original: stats('original'), webp50: stats('webp50'), pilot411: stats('pilot411'), expandedSamePilot: stats('original', true),
    absentQueries: negatives.length, falseMatches: negatives.filter(q => !q.original.rejected).length,
    sourceBytes: present.reduce((n,c) => n+c.sourceBytes,0), webp50Bytes: present.reduce((n,c) => n+c.webp50Bytes,0) };
  writeFileSync(new URL('data/benchmark-report.json', import.meta.url), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report.summary));
} finally { engine.close(); }
