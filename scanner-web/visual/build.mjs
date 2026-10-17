import { readFileSync, writeFileSync, existsSync, copyFileSync } from 'node:fs';
import { imageSources, allowedImageUrl } from '../catalog.mjs';
import { createVisualBridge } from './bridge.mjs';

// Explicit CLI only. References decoded in RAM; no image corpus written.
// A bounded first benchmark pack. --all is an explicit, larger follow-up.
const entries = { ...JSON.parse(readFileSync(new URL('../../mobile/src/data/card-image-index.json', import.meta.url))).entries,
  ...JSON.parse(readFileSync(new URL('../../mobile/src/data/japanese-image-index.json', import.meta.url))).entries };
const groups = ['FR:base1-', 'EN:base1-', 'FR:sv03.5-', 'EN:swsh3-', 'JP:SV-P-', 'JP:SV2a-'];
const targetOption = process.argv.find((arg) => arg.startsWith('--target='));
const target = targetOption ? Number(targetOption.split('=')[1]) : null;
if (target !== null && (!Number.isInteger(target) || target < 411 || target > 5000)) throw new Error('Cible attendue : entier de 411 à 5000.');
const report = { target, startedAt: new Date().toISOString(), failures: [], downloadedBytes: 0, added: 0 };
const holdouts = ['FR', 'EN', 'JP'].flatMap((language) => Object.keys(entries)
  .filter((key) => key.startsWith(`${language}:`)).sort((a, b) => a.localeCompare(b, 'en', { numeric: true })).slice(-3));
const remote = new Map();
// Old EN/FR sets and JP 151 are not in the fallback image indexes. Use exact
// TCGdex metadata/URLs, never construct an artwork URL by guessing a set path.
async function tcgdex(language, path) {
  const code = { FR: 'fr', EN: 'en', JP: 'ja' }[language];
  const response = await fetch(`https://api.tcgdex.net/v2/${code}/${path}`, { redirect: 'error', signal: AbortSignal.timeout(12000) });
  if (!response.ok) throw new Error('Source catalogue indisponible');
  return response.json();
}
for (const [language, set] of [['FR', 'base1'], ['EN', 'base1'], ['JP', 'SV2a']]) {
  try {
    const catalog = await tcgdex(language, `sets/${set}`);
    for (const brief of catalog.cards.slice(0, 60)) {
      const key = `${language}:${brief.id}`;
      entries[key] = [brief.name, brief.localId]; remote.set(key, brief);
    }
  } catch { console.log(`Métadonnées indisponibles : ${language} ${set}`); }
}
// Round-robin across sets avoids filling the whole pilot with a single series.
const buckets = new Map();
for (const key of Object.keys(entries).sort((a, b) => a.localeCompare(b, 'en', { numeric: true }))) {
  if (holdouts.includes(key)) continue;
  const set = key.slice(0, key.lastIndexOf('-'));
  if (!buckets.has(set)) buckets.set(set, []);
  buckets.get(set).push(key);
}
const diverse = [];
for (let i = 0; [...buckets.values()].some((cards) => cards.length > i); i++)
  for (const cards of buckets.values()) if (cards[i]) diverse.push(cards[i]);
const selected = target ? diverse : process.argv.includes('--all') ? Object.keys(entries) : groups.flatMap((prefix) =>
  Object.keys(entries).filter((key) => key.startsWith(prefix)).sort((a, b) => a.localeCompare(b, 'en', { numeric: true })).slice(0, 60));
const engine = createVisualBridge(); let skipped = 0, added = 0;
try {
  const initial = await engine.request('status');
  const indexed = new Set(initial.ids), counts = { ...initial.counts };
  const quotas = target ? { FR: Math.ceil(target / 3), EN: Math.ceil(target / 3), JP: target - 2 * Math.ceil(target / 3) } : null;
  if (target) {
    const backup = new URL(`data/index-before-${target}.json`, import.meta.url);
    if (!existsSync(backup)) copyFileSync(new URL('data/index.json', import.meta.url), backup);
    report.holdouts = holdouts.filter((key) => !indexed.has(`tcgdex:${key}`)).map((key) => {
      const [language, id] = key.split(':'), [name, number] = entries[key];
      return { id: `tcgdex:${key}`, name, number, language, setCode: id.slice(0, id.lastIndexOf('-')),
        images: imageSources({ id, name, localId: number }, language) };
    });
  }
  // Refresh metadata without downloading images, including retained pilot extras.
  for (const cardId of indexed) {
    const entry = entries[cardId.slice('tcgdex:'.length)];
    if (entry) await engine.request('metadata', { cardId, name: entry[0], number: entry[1] });
  }
  async function downloadCard(key) {
    const [language, id] = key.split(':'), [name, number] = entries[key];
    let metadata = remote.get(key) || { id, name, localId: number };
    if (remote.has(key) && !metadata.image) {
      try { metadata = await tcgdex(language, `cards/${id}`); } catch { /* skip missing image */ }
    }
    const card = { id: `tcgdex:${language}:${id}`, name, number, language,
      setCode: id.slice(0, id.lastIndexOf('-')), images: imageSources(metadata, language) };
    for (const source of card.images) {
      if (!allowedImageUrl(source.url)) continue;
      try {
        const response = await fetch(source.url, { redirect: 'error', signal: AbortSignal.timeout(12000) });
        if (!response.ok || !/^image\/(png|jpeg|webp)/.test(response.headers.get('content-type') || '')) continue;
        if (Number(response.headers.get('content-length')) > 3 * 1024 * 1024) continue;
        const parts = []; let size = 0;
        for await (const part of response.body) { size += part.length; if (size > 3 * 1024 * 1024) throw new Error('Oversize'); parts.push(Buffer.from(part)); }
        // The actually decoded source is also the first result thumbnail.
        card.images = [source, ...card.images.filter((item) => item.url !== source.url)];
        report.downloadedBytes += size;
        return { card, image: Buffer.concat(parts).toString('base64') };
      } catch { /* Missing image stays missing, not a guessed replacement. */ }
    }
    return { card, image: null };
  }
  let cursor = 0;
  while (cursor < selected.length) {
    if (target && (Object.keys(quotas).every((lang) => counts[lang] >= quotas[lang]) || added + skipped >= target * 2)) break;
    const batch = [];
    while (cursor < selected.length && batch.length < 4) {
      const key = selected[cursor++], language = key.split(':')[0];
      if (indexed.has(`tcgdex:${key}`) || (quotas && counts[language] >= quotas[language])) continue;
      batch.push(downloadCard(key));
    }
    // Four bounded downloads, one ordered descriptor worker; base64/decoder
    // allocations add overhead to the 12 MiB maximum of raw downloaded images.
    for (const item of await Promise.all(batch)) {
      const { card, image } = item;
      if (quotas && counts[card.language] >= quotas[card.language]) continue;
      let succeeded = false;
      if (image) try {
        await engine.request('add', item); succeeded = true;
        added++; indexed.add(card.id); counts[card.language]++;
      } catch { /* Decode failure is reported, never replaced by another card. */ }
      if (!succeeded) { skipped++; report.failures.push(card.id); }
    }
    if (batch.length && (added + skipped) % 40 < 4) {
      const result = await engine.request('save');
      console.log(`${result.indexed} empreintes · ${skipped} références absentes/inexploitables · objectif ${target || selected.length}`);
    }
  }
  const result = await engine.request('save');
  if (target) writeFileSync(new URL('data/build-report.json', import.meta.url), JSON.stringify({ ...report, added,
    finishedAt: new Date().toISOString(), counts: result.counts, indexed: result.indexed }, null, 2));
  console.log(JSON.stringify({ counts: result.counts, indexed: result.indexed, skipped, imageFilesStored: 0 }));
} finally { engine.close(); }
