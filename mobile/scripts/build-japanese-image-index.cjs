// Build a Japanese fallback link index. No card images are downloaded.
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const source = 'https://github.com/posmap-japan/p-collector-card-db';
const feedUrl = 'https://raw.githubusercontent.com/posmap-japan/p-collector-card-db/main/card_db/card_db_jp.json';
const imageBase = 'https://tcgplayer-cdn.tcgplayer.com/product/';

function normalizeName(value) {
  // Keep punctuation, kana voicing marks, genders and ex/GX/V suffixes.
  return typeof value === 'string' ? value.normalize('NFKC').trim() : '';
}
function normalizeNumber(value) {
  if (typeof value !== 'string') return '';
  const number = value.trim();
  return /^\d+$/.test(number) ? number.replace(/^0+(?=\d)/, '') : number;
}
function safeImagePath(url) {
  if (typeof url !== 'string' || !url.startsWith(imageBase)) return null;
  const suffix = url.slice(imageBase.length);
  return /^\d+_in_400x400\.jpg$/.test(suffix) ? suffix : null;
}
function identity(set, number, name) {
  if (typeof set !== 'string' || !/^[A-Za-z0-9.-]+$/.test(set)
    || !normalizeNumber(number) || !normalizeName(name)) return null;
  return JSON.stringify([set, normalizeNumber(number), normalizeName(name)]);
}
function matchJapanese(records, cards) {
  if (!Array.isArray(records) || !Array.isArray(cards)) throw new Error('Invalid Japanese catalog');
  const candidates = new Map();
  const productPrintings = new Map();
  for (const record of records) {
    if (!record || typeof record !== 'object') continue;
    const key = identity(record.s, record.num, record.n);
    const suffix = safeImagePath(record.img);
    if (!key || !suffix) continue;
    if (!candidates.has(key)) candidates.set(key, new Set());
    candidates.get(key).add(suffix);
    // A product link reused for different set/number identities is unsafe.
    if (!productPrintings.has(suffix)) productPrintings.set(suffix, new Set());
    productPrintings.get(suffix).add(JSON.stringify([record.s, normalizeNumber(record.num)]));
  }
  const entries = {};
  const stats = { catalogCards: cards.length, sourceRecords: records.length,
    matched: 0, missingPrimary: 0, unmatched: 0, ambiguous: 0, reusedProduct: 0, bySet: {} };
  for (const card of cards) {
    if (!card || typeof card.id !== 'string') throw new Error('Invalid TCGdex card');
    const split = card.id.lastIndexOf('-');
    const set = card.id.slice(0, split);
    const key = identity(set, card.localId, card.name);
    const urls = key ? candidates.get(key) : undefined;
    if (!urls?.size) { stats.unmatched++; continue; }
    if (urls.size !== 1) { stats.ambiguous++; continue; }
    const suffix = [...urls][0];
    if (productPrintings.get(suffix).size !== 1) { stats.reusedProduct++; continue; }
    entries[`JP:${card.id}`] = [card.name, card.localId, suffix];
    stats.matched++;
    if (!card.image) stats.missingPrimary++;
    stats.bySet[set] = (stats.bySet[set] ?? 0) + 1;
  }
  return { entries, stats };
}
function validateRefresh(entries, previousCount = 0) {
  const count = Object.keys(entries).length;
  if (count < 100 || (previousCount && count < previousCount * 0.8)) {
    throw new Error('Japanese image coverage shrank unexpectedly; existing index preserved. Review the source before refreshing.');
  }
}
async function request(url) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
      return await response.text();
    } catch (error) {
      if (attempt === 2) throw error;
      await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
    }
  }
}
async function main() {
  const [feed, catalog] = await Promise.all([request(feedUrl), request('https://api.tcgdex.net/v2/ja/cards')]);
  const { entries, stats } = matchJapanese(JSON.parse(feed), JSON.parse(catalog));
  const destination = path.resolve(__dirname, '../src/data/japanese-image-index.json');
  const previous = fs.existsSync(destination) ? JSON.parse(fs.readFileSync(destination, 'utf8')) : null;
  validateRefresh(entries, previous ? Object.keys(previous.entries).length : 0);
  const output = { generatedAt: new Date().toISOString(), source, feedUrl,
    feedSha256: createHash('sha256').update(feed).digest('hex'),
    entries: Object.fromEntries(Object.entries(entries).sort(([a], [b]) => a.localeCompare(b))) };
  const serialized = JSON.stringify(output) + '\n';
  const report = { generatedAt: output.generatedAt, source, feedUrl, feedSha256: output.feedSha256,
    bytes: Buffer.byteLength(serialized), ...stats };
  // Mechanically generated metadata only; no artwork is stored here.
  fs.writeFileSync(destination, serialized);
  fs.writeFileSync(path.resolve(__dirname, '../src/data/japanese-image-index-report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ ...report, bySet: `${Object.keys(stats.bySet).length} sets` }));
}

module.exports = { normalizeName, normalizeNumber, safeImagePath, matchJapanese, validateRefresh };
if (require.main === module) main().catch((error) => { console.error(error); process.exitCode = 1; });
