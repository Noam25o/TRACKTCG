import { parseCollector } from '../public/collector.mjs';

// Bench-only evidence extraction, deliberately no OCR character substitutions.
// Paddle confidence is NOT calibrated to Tesseract's confidence scale.
export function fractionFromLines(lines) {
  const found = new Map();
  for (const { text, score } of lines) {
    if (typeof text !== 'string' || text.length > 2000 || !Number.isFinite(score) || score < .8) continue;
    for (const match of text.normalize('NFKC').toUpperCase().matchAll(/(?<![A-Z0-9])([A-Z]{0,5}\d{1,4}\s*\/\s*(?:[A-Z]{1,4}-P|[A-Z]{0,5}\d{1,4}))(?![A-Z0-9])/g)) {
      const reference = parseCollector(match[1]);
      if (reference) found.set(reference.key, reference);
    }
  }
  return found.size === 1 ? [...found.values()][0] : null;
}
export function assess(reference, expected) {
  if (!reference) return 'unreadable';
  if (reference.number !== expected.number || (expected.set && reference.set !== expected.set)) return 'conflict';
  return expected.set ? 'number-and-promo-match' : 'number-match-only';
}
