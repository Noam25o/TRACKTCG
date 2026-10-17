// Exact collector identifiers only: no O/0 guessing, no species-name inference.
import { titleInk } from './ocr.mjs';
const clean = value => String(value || '').normalize('NFKC').toUpperCase().trim();
export const normalizeSet = value => clean(value).replace(/[\s.-]/g, '');
export function normalizeNumber(value) {
  const match = /^([A-Z]{0,5})(\d{1,4})$/.exec(clean(value));
  return match ? `${match[1]}${Number(match[2])}` : null;
}
export function parseCollector(value) {
  const text = clean(value);
  if (text.length > 32) return null;
  const match = /^([A-Z]{0,5}\d{1,4})(?:\s*\/\s*(\d{1,4}|[A-Z]{1,4}-P|[A-Z]{1,5}\d{1,4}))?$/.exec(text);
  if (!match) return null;
  const number = normalizeNumber(match[1]);
  // A numeric denominator is NOT a set identifier. GG/TG denominators also
  // describe a subset, not a catalogue set code. Never infer the extension.
  const set = match[2]?.endsWith('-P') ? normalizeSet(match[2]) : null;
  return { number, set, label: text, key: `${number}/${match[2] || ''}` };
}
export function collectorFromTsv(tsv) {
  if (typeof tsv !== 'string' || tsv.length > 200000) return null;
  const lines = new Map();
  for (const line of tsv.split('\n').slice(1)) {
    const columns = line.split('\t');
    if (columns[0] !== '5') continue;
    const key = columns.slice(1,5).join(':');
    if (!lines.has(key)) lines.set(key, []);
    // Keep low-confidence words as separators, so they cannot manufacture a
    // fraction by disappearing between two otherwise confident words.
    lines.get(key).push(Number(columns[10]) >= 55 ? columns[11] : '|');
  }
  const found = new Map();
  for (const words of lines.values()) {
    const text = clean(words.join(' '));
    for (const match of text.matchAll(/(?<![A-Z0-9])([A-Z]{0,5}\d{1,4}\s*\/\s*(?:[A-Z]{1,4}-P|[A-Z]{0,5}\d{1,4}))(?![A-Z0-9])/g)) {
      const reference = parseCollector(match[1]);
      if (reference) found.set(reference.key, reference);
    }
  }
  // Bare numbers (HP, dates, artist credits) never count as OCR evidence.
  return found.size === 1 ? [...found.values()][0] : null;
}
export function refineRanking(ranking, text, extension = '') {
  const reference = text.trim() ? parseCollector(text) : null;
  const set = normalizeSet(extension) || reference?.set;
  if (text.trim() && !reference) return { ranking, matches: 0, invalid: true };
  if (!reference && !set) return { ranking, matches: 0, reset: true };
  if (set && reference?.set && set !== reference.set) return { ranking, matches: 0, invalid: true };
  const matches = ranking.filter(({ reference: { card } }) =>
    (!reference || normalizeNumber(card.number) === reference.number) && (!set || normalizeSet(card.setCode) === set));
  // Preserve all visual proposals, even when the OCR/manual number conflicts.
  return { ranking: [...matches, ...ranking.filter(item => !matches.includes(item))], matches: matches.length };
}

export async function readCollector(engine, card, signal) {
  return readRegions(engine, card, [{ y: .83, height: .16 }, { y: .90, height: .095 }], signal);
}

export async function readCollectorFooter(engine, footer, signal) {
  // Wide context is more stable than a magnified TSV word box: small glyphs
  // and rarity symbols can be merged into that box. Do not whitelist letters
  // here: forcing a vocabulary can turn surrounding text into fake numbers.
  return readRegions(engine, footer, [{ y: 0, height: 1 },
    { y: .5, height: .5, outputWidth: 1000 },
    { y: .5, height: .5, outputWidth: 1000, ink: true }], signal);
}

async function readRegions(engine, card, regions, signal) {
  const crop = document.createElement('canvas'), ctx = crop.getContext('2d', {willReadFrequently:true});
  const readings = [];
  try {
    for (const region of regions) {
      if (signal?.aborted) throw new DOMException('Annulé', 'AbortError');
      const x = region.x ?? .02, width = region.width ?? .96, outputWidth = region.outputWidth || 1500;
      crop.width = outputWidth + 20;
      crop.height = Math.round(card.height * region.height / (card.width * width) * outputWidth) + 20;
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, crop.width, crop.height);
      ctx.drawImage(card, card.width * x, card.height * region.y, card.width * width,
        card.height * region.height, 10, 10, outputWidth, crop.height - 20);
      if (region.ink) {
        const pixels=ctx.getImageData(0,0,crop.width,crop.height);
        titleInk(pixels.data); ctx.putImageData(pixels,0,0);
      }
      const reading = await engine.read(crop, { pageMode: '6' });
      if (signal?.aborted) throw new DOMException('Annulé', 'AbortError');
      const reference = collectorFromTsv(reading.wordData);
      if (reference) {
        if (readings.some(previous=>previous.key !== reference.key)) return null;
        readings.push(reference);
        if (readings.length === 2) return reference;
      }
    }
    // Agreement of two crops of ONE capture, not two independent observations.
    return null;
  } finally { ctx.clearRect(0,0,crop.width,crop.height); crop.width = crop.height = 0; }
}
