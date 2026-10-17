// Offline inference; public reference downloads are GET-only. No image reports.
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { createWorker } from 'tesseract.js';
import { allowedImageUrl } from '../catalog.mjs';
import { collectorFromTsv, normalizeNumber } from '../public/collector.mjs';
import { fractionFromLines, assess } from './ocr-evidence.mjs';

const photoPath = process.argv.find(arg => arg.startsWith('--photo='))?.slice(8);
if (!photoPath) throw new Error('Pass --photo=<local JPEG path>; no photo is copied.');
const child = spawn(fileURLToPath(new URL('../.tools/ocr-cpu-env/Scripts/python.exe', import.meta.url)),
  [fileURLToPath(new URL('ocr_cpu_worker.py', import.meta.url))],
  { windowsHide: true, stdio: ['pipe', 'pipe', 'inherit'] });
const jobs = new Map(); let sequence = 0;
function stop(error = new Error('CPU worker stopped')) {
  child.kill();
  for (const job of jobs.values()) { clearTimeout(job.timer); job.reject(error); }
  jobs.clear();
}
child.on('error', stop); child.on('exit', () => stop()); child.stdin.on('error', stop);
createInterface({ input: child.stdout }).on('line', line => {
  if (!line.startsWith('@ocr@')) return;
  const packet = JSON.parse(line.slice(5)), job = jobs.get(packet.id);
  if (!job) return;
  jobs.delete(packet.id); clearTimeout(job.timer);
  if (packet.error) job.reject(new Error(packet.error)); else job.resolve(packet.result);
});
function request(action, data = {}) {
  const id = ++sequence;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => stop(new Error(`Timeout: ${action}`)), action === 'init' ? 900000 : 60000);
    jobs.set(id, { resolve, reject, timer }); child.stdin.write(`${JSON.stringify({ id, action, ...data })}\n`);
  });
}
const indexBytes = readFileSync(new URL('data/index.json', import.meta.url));
const index = JSON.parse(indexBytes);
const anchors = ['FR:base1-14', 'EN:swsh3-20', 'JP:SV2a-003'];
const cards = anchors.map(id => ({ ...index.entries.find(e => e.card.id === `tcgdex:${id}`).card, group: 'prior-tuning' }));
// Deterministic additional references, not selected using OCR outcomes. Still
// reference-derived, NOT a held-out dataset of independent phone photographs.
for (const language of ['FR', 'EN', 'JP']) {
  const pool = index.entries.filter(e => e.card.language === language && !cards.some(c => c.id === e.card.id));
  cards.push({ ...pool[Math.floor(pool.length * .57)].card, group: 'additional-reference' });
}
const report = { createdAt: new Date().toISOString(), method: 'CPU only; one shared bottom-20% crop, white padding, no rectification. One first read + 3 warm reads per case. Raw single-reading evidence, NOT production acceptance. Same PNG bytes for both engines. No pixels saved.',
  indexSha256: createHash('sha256').update(indexBytes).digest('hex'), models: {}, cases: [], failures: [] };
let tesseract;
const inputs = [];
const save = () => writeFileSync(new URL('data/ocr-cpu-report.json', import.meta.url), JSON.stringify(report, null, 2));
const median = values => [...values].sort((a,b) => a-b)[Math.floor(values.length/2)];
async function addInput(id, group, bytes, expected, widths) {
  try {
    for (const width of widths) {
      const crop = await request('prepare', { image: bytes.toString('base64'), width });
      const row = { id, group, requestedWidth: width, width: crop.width, height: crop.height, expected, results: {} };
      report.cases.push(row); inputs.push({ row, image: crop.image });
    }
  } finally { bytes.fill(0); }
}
try {
  await addInput('user-photo-pikachu', 'real-screen-photo', readFileSync(photoPath), { number:'1', set:'SVP' }, [900,1500]);
  for (const card of cards) {
    let bytes;
    for (const source of card.images) {
      if (!allowedImageUrl(source.url)) continue;
      try {
        const response = await fetch(source.url, { redirect: 'error', signal: AbortSignal.timeout(15000) });
        if (!response.ok || !/^image\/(png|jpeg|webp)/.test(response.headers.get('content-type') || '')) continue;
        const parts = []; let size = 0;
        for await (const part of response.body) { size += part.length; if (size > 3*1024*1024) throw new Error('Oversize'); parts.push(Buffer.from(part)); }
        bytes = Buffer.concat(parts); break;
      } catch { /* Only recorded, allowlisted alternatives. */ }
    }
    if (!bytes) { report.failures.push({ id:card.id, error:'Reference unavailable' }); continue; }
    await addInput(card.id, card.group, bytes, { number:normalizeNumber(card.number), set:null }, [1500]);
  }
  const started = performance.now();
  tesseract = await createWorker('eng', 1, {
    langPath: fileURLToPath(new URL('../node_modules/@tesseract.js-data/eng/4.0.0_best_int', import.meta.url)),
    cacheMethod:'none', gzip:true });
  await tesseract.setParameters({ tessedit_pageseg_mode:'6', user_defined_dpi:'300' });
  report.models.tesseract = { version:'7.0.0', model:'eng/4.0.0_best_int', runtime:'Node WASM CPU', initMs:Math.round(performance.now()-started) };
  for (const {row,image} of inputs) {
    const runs = [], png = Buffer.from(image, 'base64');
    try {
      for (let n=0; n<4; n++) {
        const start = performance.now();
        const {data} = await tesseract.recognize(png, {}, {text:true,tsv:true});
        const reference = collectorFromTsv(data.tsv);
        runs.push({ ms:Math.round(performance.now()-start), text:data.text, reference, assessment:assess(reference,row.expected) });
      }
    } finally { png.fill(0); }
    row.results.tesseract = { first:runs[0], warm:runs.slice(1), medianMs:median(runs.slice(1).map(r=>r.ms)) };
    console.log(`${row.id}/${row.width} Tesseract: ${runs[0].assessment}`); save();
  }
  await tesseract.terminate(); tesseract = null;
  for (const model of ['PP-OCRv5_server_rec', 'en_PP-OCRv5_mobile_rec']) {
    report.models[model] = { detection:'PP-OCRv5_mobile_det', cpuThreads:4, ...(await request('init', {model})) }; save();
    for (const {row,image} of inputs) {
      const runs = [];
      for (let n=0; n<4; n++) {
        const result = await request('read', {image});
        const reference = fractionFromLines(result.lines);
        runs.push({ ...result, reference, assessment:assess(reference,row.expected) });
      }
      row.results[model] = { first:runs[0], warm:runs.slice(1), medianMs:median(runs.slice(1).map(r=>r.ms)) };
      console.log(`${row.id}/${row.width} ${model}: ${runs[0].assessment}, ${row.results[model].medianMs} ms`); save();
    }
  }
} catch (error) { report.failures.push({ error:error.message }); save(); throw error; }
finally { if (tesseract) await tesseract.terminate(); for(const input of inputs) input.image=''; stop(); }
