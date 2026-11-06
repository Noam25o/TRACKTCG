// Generates a compact index of remote image links; never downloads card images.
const fs = require('node:fs');
const path = require('node:path');
const base = 'https://cdn.malie.io/file/malie-io/';
const tcglSets = {
  me1: 'me01', me2: 'me02', 'me2-5': 'me02.5', me3: 'me03', me4: 'me04', me5: 'me05',
  'me5-5': '30th', 'me5-5c': '30th-c', mebsp: 'mep', mee: 'mee',
  sv1: 'sv01', sv2: 'sv02', sv3: 'sv03', 'sv3-5': 'sv03.5', sv4: 'sv04',
  'sv4-5': 'sv04.5', sv5: 'sv05', sv6: 'sv06', 'sv6-5': 'sv06.5', sv7: 'sv07',
  sv8: 'sv08', 'sv8-5': 'sv08.5', sv9: 'sv09', sv10: 'sv10',
  'rsv10-5': 'sv10.5w', 'zsv10-5': 'sv10.5b', svbsp: 'svp', sve: 'sve',
};
// Explicit set mappings, including separate galleries in the same Malie listing.
// Trainer kits, alternate-art collections and unsupported sets are not guessed.
const legacySets = {
  ...Object.fromEntries(Array.from({ length: 4 }, (_, n) => [`HGSS${n + 1}`, [`hgss${n + 1}`]])),
  COL: ['col1'], Promo_HGSS: ['hgssp'],
  ...Object.fromEntries(Array.from({ length: 11 }, (_, n) => [`BW${n + 1}`, [`bw${n + 1}`]])),
  BW11: ['bw11', 'rc'], DV: ['dv1'], Promo_BW: ['bwp'],
  ...Object.fromEntries(Array.from({ length: 13 }, (_, n) => [`XY${n}`, [`xy${n}`]])),
  TATM: ['dc1'], TwentiethAnn: ['g1'], Promo_XY: ['xyp'],
  ...Object.fromEntries(Array.from({ length: 12 }, (_, n) => [`SM${n + 1}`, [`sm${n + 1}`]])),
  SL: ['sm3.5'], DM: ['sm7.5'], HF: ['sm115', 'sma'], GUM: ['det1'], Promo_SM: ['smp'],
  ...Object.fromEntries(Array.from({ length: 12 }, (_, n) => [`SWSH${n + 1}`, [`swsh${n + 1}`]])),
  SWSH9: ['swsh9', 'swsh9tg'], SWSH10: ['swsh10', 'swsh10tg'],
  SWSH11: ['swsh11', 'swsh11tg'], SWSH12: ['swsh12', 'swsh12tg'],
  CP: ['swsh3.5'], SF: ['swsh4.5', 'swsh4.5sv'], PGO: ['swsh10.5'],
  Ann25th: ['cel25'], Ann25thR: ['cel25cc'], CZ: ['swsh12.5', 'swsh12.5gg'], Promo_SWSH: ['swshp'],
};

function normalizeNumber(value) {
  if (typeof value !== 'string') return '';
  const match = /^([a-z]*)(\d+)$/i.exec(value.trim());
  return match ? `${match[1].toUpperCase()}${Number(match[2])}` : value.trim();
}
function normalizeName(value) {
  return typeof value === 'string' ? value.normalize('NFKD').replace(/\p{M}/gu, '')
    .toLowerCase().replace(/[^\p{L}\p{N}♀♂]/gu, '') : '';
}
function safeImagePath(url, language, kind) {
  if (typeof url !== 'string' || !url.startsWith(base)) return null;
  const suffix = url.slice(base.length);
  const folder = kind === 'tcgl' ? `tcgl/cards/png/${language === 'FR' ? 'fr' : 'en'}/` : `art/cards/png/${language === 'FR' ? 'fr_FR' : 'en_US'}/`;
  if (!suffix.startsWith(folder) || !suffix.endsWith('.png') || /[?#\\]|\.\./.test(suffix)) return null;
  return suffix;
}
function decode(value) {
  return value.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
}
function parseLegacy(html, code) {
  const headers = [...html.matchAll(/<li>\s*([^<\s]+)\s+#([^\s<]+)\s+([^<]+)\s*<ul class="img_type_list">/g)];
  const records = [];
  for (let i = 0; i < headers.length; i++) {
    const header = headers[i];
    if (header[1] !== code) continue;
    const section = html.slice(header.index, headers[i + 1]?.index ?? html.length);
    const images = {};
    for (const link of section.matchAll(/<a href="([^"]+)">(fr_FR|en_US)<\/a>/g)) {
      const language = link[2] === 'fr_FR' ? 'FR' : 'EN';
      const suffix = safeImagePath(decode(link[1]), language, 'legacy');
      if (suffix) (images[language] ??= new Set()).add(suffix);
    }
    records.push({ number: header[2], name: decode(header[3].trim()), images });
  }
  return records;
}
function matchTcgl(records, cards, language) {
  const result = new Map();
  const locale = language === 'FR' ? 'fr-FR' : 'en-US';
  for (const card of cards) {
    const urls = new Set(records.filter((record) => record.lang === locale && record.size === 'STANDARD'
      && normalizeNumber(record.collector_number?.numerator) === normalizeNumber(card.localId)
      && normalizeName(record.name) === normalizeName(card.name))
      .map((record) => safeImagePath(record.images?.tcgl?.png?.front, language, 'tcgl')).filter(Boolean));
    // Multiple foils may reuse one front. Different fronts require review.
    if (urls.size === 1) result.set(card.id, [...urls][0]);
  }
  return result;
}

async function request(url, json = true) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
      if (!response.ok) throw new Error(`${response.status} ${url}`);
      return json ? await response.json() : await response.text();
    } catch (error) {
      if (attempt === 2) throw error;
      await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
    }
  }
}
async function pool(items, callback) {
  let cursor = 0;
  await Promise.all(Array.from({ length: 3 }, async () => {
    while (cursor < items.length) { const item = items[cursor++]; await callback(item); }
  }));
}

async function main() {
  const [index, fr, en] = await Promise.all([
    request(`${base}tcgl/export/index.json`), request('https://api.tcgdex.net/v2/fr/cards'), request('https://api.tcgdex.net/v2/en/cards'),
  ]);
  if (!Array.isArray(fr) || !Array.isArray(en)) throw new Error('Invalid TCGdex catalog');
  const catalogs = { FR: fr, EN: en };
  const bySet = { FR: new Map(), EN: new Map() };
  for (const language of ['FR', 'EN']) for (const card of catalogs[language]) {
    const set = card.id.slice(0, card.id.lastIndexOf('-'));
    if (!bySet[language].has(set)) bySet[language].set(set, []);
    bySet[language].get(set).push(card);
  }
  const entries = {};
  const stats = { tcgl: {}, legacy: {}, missingPrimary: {} };
  const jobs = [];
  for (const language of ['FR', 'EN']) {
    const locale = language === 'FR' ? 'fr-FR' : 'en-US';
    for (const [key, set] of Object.entries(tcglSets)) {
      const source = index[locale]?.[key];
      const cards = bySet[language].get(set);
      if (source?.num && cards?.length) jobs.push({ language, key, set, source, cards });
    }
  }
  console.log(`TCGL: ${jobs.length} language/set files`);
  await pool(jobs, async ({ language, key, set, source, cards }) => {
    if (!/^v[\d.]+\/[a-z0-9.-]+\.(fr-FR|en-US)\.json$/.test(source.path)) throw new Error('Unexpected export path');
    const records = await request(`${base}tcgl/export/${source.path}`);
    if (!Array.isArray(records)) throw new Error('Invalid Malie export');
    const matches = matchTcgl(records, cards, language);
    for (const card of cards) if (matches.has(card.id)) entries[`${language}:${card.id}`] = [card.name, card.localId, matches.get(card.id)];
    stats.tcgl[`${language}:${set}`] = matches.size;
    console.log(`${language} ${set} (${key}): ${matches.size}/${cards.length}`);
  });
  const legacyJobs = Object.entries(legacySets).filter(([, sets]) => sets.some((set) => bySet.EN.has(set)));
  console.log(`PTCGO: ${legacyJobs.length} shared listings`);
  await pool(legacyJobs, async ([code, sets]) => {
    const records = parseLegacy(await request(`https://malie.io/static/listings/${code}.html`, false), code);
    if (!records.length) throw new Error(`No records found in ${code}`);
    for (const language of ['FR', 'EN']) {
      let count = 0;
      for (const set of sets) for (const card of bySet[language].get(set) ?? []) {
        // Legacy listings use English headings. Cross-check the same printing
        // against its English catalog record before using its French link.
        const english = (bySet.EN.get(set) ?? []).find((item) => item.id === card.id);
        if (!english || normalizeNumber(english.localId) !== normalizeNumber(card.localId)) continue;
        const matches = records.filter((record) => normalizeNumber(record.number) === normalizeNumber(card.localId)
          && normalizeName(record.name) === normalizeName(english.name));
        const urls = new Set(matches.flatMap((record) => [...(record.images[language] ?? [])]));
        if (urls.size !== 1) continue;
        const id = `${language}:${card.id}`;
        if (!entries[id]) { entries[id] = [card.name, card.localId, [...urls][0]]; count++; }
      }
      stats.legacy[`${language}:${code}`] = count;
    }
    console.log(`${code}: FR ${stats.legacy[`FR:${code}`]}, EN ${stats.legacy[`EN:${code}`]}`);
  });
  for (const language of ['FR', 'EN']) stats.missingPrimary[language] = catalogs[language].filter((card) => !card.image && entries[`${language}:${card.id}`]).length;
  const sorted = Object.fromEntries(Object.entries(entries).sort(([a], [b]) => a.localeCompare(b)));
  const output = { generatedAt: new Date().toISOString(), source: 'https://malie.io/', entries: sorted };
  // This file is a mechanically generated link index, not an image archive.
  const destination = path.resolve(__dirname, '../src/data/card-image-index.json');
  fs.writeFileSync(destination, JSON.stringify(output) + '\n');
  const report = { generatedAt: output.generatedAt, entries: Object.keys(entries).length, languages: Object.fromEntries(['FR', 'EN'].map((lang) => [lang, Object.keys(entries).filter((key) => key.startsWith(lang + ':')).length])), bytes: fs.statSync(destination).size, ...stats };
  fs.writeFileSync(path.resolve(__dirname, '../src/data/card-image-index-report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ entries: report.entries, languages: report.languages, bytes: report.bytes, missingPrimary: report.missingPrimary }));
}

module.exports = { normalizeNumber, normalizeName, safeImagePath, parseLegacy, matchTcgl };
if (require.main === module) main().catch((error) => { console.error(error); process.exitCode = 1; });
