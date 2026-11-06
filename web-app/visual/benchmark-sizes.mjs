import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createVisualBridge } from './bridge.mjs';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const indexFile = new URL('data/index.json', import.meta.url);
const indexBytes = readFileSync(indexFile), index = JSON.parse(indexBytes);
const selected = ['FR:base1-1', 'FR:base1-14', 'FR:base1-2', 'FR:base1-58',
  'EN:base1-4', 'EN:base1-9', 'EN:base1-15', 'EN:base1-58',
  'JP:SV2a-003', 'JP:SV2a-006', 'JP:SV2a-025', 'JP:SV2a-040'];
const formats = ['highPng', 'highWebp', 'lowWebp'];
const report = { createdAt: new Date().toISOString(), indexed: index.entries.length,
  indexSha256: sha(indexBytes), engineSha256: sha(readFileSync(new URL('engine.py', import.meta.url))),
  method: 'Actual TCGdex high.png, high.webp, low.webp. 12 cards (4/language), Base Set FR/EN and SV2a JP only. Three identical high-PNG-derived synthetic queries per card. Replace only the target reference in memory; other index entries unchanged. Rotate format order across cards. No phone scans, unknown-card evaluation or full low-resolution index.',
  selected, cases: [], failures: [] };
const output = new URL('data/benchmark-sizes-report.json', import.meta.url);
async function download(url) {
  const parsed = new URL(url);
  if (parsed.origin !== 'https://assets.tcgdex.net' || !/\/(high\.(png|webp)|low\.webp)$/.test(parsed.pathname))
    throw new Error('Unexpected source');
  const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(12000) });
  if (!response.ok || !/^image\/(png|webp)/.test(response.headers.get('content-type') || ''))
    throw new Error(`Unavailable image: ${response.status}`);
  const parts = []; let size = 0;
  for await (const part of response.body) {
    size += part.length;
    if (size > 3 * 1024 * 1024) throw new Error('Image exceeds limit');
    parts.push(Buffer.from(part));
  }
  return Buffer.concat(parts);
}
const worker = createVisualBridge({ script: 'benchmark_sizes.py' });
try {
  await worker.request('status');
  for (const [position, id] of selected.entries()) {
    const buffers = {};
    try {
      const card = index.entries.find(e => e.card.id === `tcgdex:${id}`)?.card;
      const originalUrl = card?.images.find(s => s.url.startsWith('https://assets.tcgdex.net/') && s.url.endsWith('/high.png'))?.url;
      if (!originalUrl) throw new Error('No recorded TCGdex high.png source');
      // Documented quality/format alternatives on the exact recorded card path.
      const urls = { highPng: originalUrl, highWebp: originalUrl.replace(/high\.png$/, 'high.webp'),
        lowWebp: originalUrl.replace(/high\.png$/, 'low.webp') };
      const sources = {};
      for (const key of formats) {
        buffers[key] = await download(urls[key]);
        sources[key] = { url: urls[key], bytes: buffers[key].length, sha256: sha(buffers[key]) };
      }
      const order = [...formats.slice(position % 3), ...formats.slice(0, position % 3)];
      const result = await worker.request('case', { card, order,
        images: Object.fromEntries(formats.map(key => [key, buffers[key].toString('base64')])) });
      report.cases.push({ ...result, sources, order });
      console.log(`${id}: ${formats.map(key => `${key} ${result.queries.filter(q => q[key].top1).length}/3, ${Math.round(sources[key].bytes/1000)} kB`).join(' · ')}`);
    } catch (error) {
      report.failures.push({ id, error: error.message });
      console.log(`${id}: FAIL ${error.message}`);
    } finally {
      for (const buffer of Object.values(buffers)) buffer.fill(0);
      writeFileSync(output, JSON.stringify(report, null, 2));
    }
  }
  const percentile = (values, fraction) => values.length ? [...values].sort((a,b) => a-b)[Math.min(values.length-1, Math.floor(values.length*fraction))] : null;
  report.summary = Object.fromEntries(formats.map(key => {
    const rows = report.cases.flatMap(c => c.queries.map(q => q[key]));
    return [key, { cards: report.cases.length, queries: rows.length,
      top1: rows.filter(q => q.top1).length, top3: rows.filter(q => q.top3).length,
      rejected: rows.filter(q => q.rejected).length, incorrectAccepted: rows.filter(q => !q.rejected && !q.top1).length,
      p50ms: percentile(rows.map(q => q.ms), .5), p95ms: percentile(rows.map(q => q.ms), .95),
      medianTop1Inliers: percentile(rows.filter(q => q.top1).map(q => q.candidates[0].inliers), .5),
      totalBytes: report.cases.reduce((n,c) => n+c.sources[key].bytes, 0) }];
  }));
  report.indexUnchanged = report.indexSha256 === sha(readFileSync(indexFile));
  report.finishedAt = new Date().toISOString();
  writeFileSync(output, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ summary: report.summary, failures: report.failures, indexUnchanged: report.indexUnchanged }));
  if (report.failures.length || !report.indexUnchanged) process.exitCode = 1;
} finally { worker.close(); }
