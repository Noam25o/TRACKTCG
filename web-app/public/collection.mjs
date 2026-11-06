export const FORMAT = 'tracktcg.web-collection';
export const MAX_BYTES = 2 * 1024 * 1024;
export const MAX_ENTRIES = 5000;
export const conditions = ['NM', 'EX', 'GD', 'LP', 'PL'];
export const finishes = ['Normale', 'Holo', 'Reverse', 'Non précisée'];
const sources = ['TCGdex', 'Malie', 'Pokémon officiel', 'TCGplayer JP'];
const fail = () => { throw new Error('Sauvegarde invalide ou incompatible. Les données existantes ne sont pas modifiées.'); };
const text = (value, max = 200) => typeof value === 'string' && value.length > 0 && value.length <= max;

function safeImage(input) {
  try {
    const url = new URL(input);
    if (url.protocol !== 'https:' || url.username || url.password || url.port || url.search || url.hash) return false;
    return (url.hostname === 'assets.tcgdex.net' && /^\/[\w./-]+\/(high|low)\.(png|webp|jpg)$/.test(url.pathname))
      || (url.hostname === 'cdn.malie.io' && /^\/file\/malie-io\/[\w./-]+\.png$/.test(url.pathname))
      || (url.hostname === 'tcgplayer-cdn.tcgplayer.com' && /^\/product\/\d+_in_400x400\.jpg$/.test(url.pathname))
      || (url.hostname === 'assets.pokemon.com' && /^\/static-assets\/content-assets\/cms2-fr-fr\/img\/cards\/web\/[A-Z0-9]+\/[A-Z0-9_]+\.png$/.test(url.pathname));
  } catch { return false; }
}
export function normalizeCard(card) {
  if (!card || !['FR', 'EN', 'JP'].includes(card.language) || card.source !== 'tcgdex'
    || !text(card.sourceId, 100) || !/^[\w.-]+$/.test(card.sourceId) || card.id !== `tcgdex:${card.language}:${card.sourceId}`
    || !['name', 'number', 'localNumber', 'setName', 'setCode', 'rarity'].every((key) => text(card[key]))
    || !Array.isArray(card.finishes) || card.finishes.length > 3 || card.finishes.some((finish) => !finishes.slice(0, 3).includes(finish))
    || !Array.isArray(card.images) || card.images.length > 4
    || card.images.some((image) => !image || !sources.includes(image.source) || !text(image.url, 1000) || !safeImage(image.url))
    || (card.searchNames !== undefined && (!Array.isArray(card.searchNames) || card.searchNames.length > 30 || card.searchNames.some((name) => !text(name))))) fail();
  // Only whitelisted fields survive imports. Never import valuations/HTML/URLs
  // for a frame, and never treat an imported price as a verified market quote.
  return Object.fromEntries([
    ...['id', 'sourceId', 'source', 'language', 'name', 'number', 'localNumber', 'setName', 'setCode', 'rarity']
      .map((key) => [key, card[key]]),
    ['finishes', [...new Set(card.finishes)]], ['images', card.images.map(({ url, source }) => ({ url, source }))],
    ['searchNames', [...new Set(card.searchNames || [])]], ['marketPrice', null],
  ]);
}
function validPrice(value) { return value === null || (Number.isSafeInteger(value) && value >= 0 && value <= 100000000); }
export function parsePurchasePrice(input) {
  const value = String(input).trim().replace(',', '.');
  if (!value) return null;
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(value)) throw new Error('Prix d’achat invalide : utilise un montant positif avec deux décimales maximum.');
  const [whole, decimals = ''] = value.split('.');
  const cents = Number(whole) * 100 + Number(decimals.padEnd(2, '0'));
  if (!validPrice(cents)) throw new Error('Prix d’achat trop élevé.');
  return cents;
}
export function validateEntries(entries) {
  if (!Array.isArray(entries) || entries.length > MAX_ENTRIES) fail();
  const ids = new Set();
  return entries.map((entry) => {
    if (!entry || !text(entry.id, 150) || ids.has(entry.id)
      || !Number.isInteger(entry.quantity) || entry.quantity < 1 || entry.quantity > 9999
      || !conditions.includes(entry.condition) || !finishes.includes(entry.finish)
      || !validPrice(entry.purchasePriceCents) || !text(entry.addedAt, 40) || !Number.isFinite(Date.parse(entry.addedAt))) fail();
    ids.add(entry.id);
    return { id: entry.id, card: normalizeCard(entry.card), quantity: entry.quantity,
      condition: entry.condition, finish: entry.finish, purchasePriceCents: entry.purchasePriceCents, addedAt: entry.addedAt };
  });
}
export function encodeBackup(entries, now = new Date().toISOString()) {
  const backup = { format: FORMAT, version: 1, exportedAt: now, entries: validateEntries(entries) };
  const raw = JSON.stringify(backup, null, 2);
  if (new TextEncoder().encode(raw).byteLength > MAX_BYTES) throw new Error('Collection trop volumineuse pour cette version. Aucune écriture effectuée.');
  return raw;
}
export function decodeBackup(raw) {
  if (typeof raw !== 'string' || new TextEncoder().encode(raw).byteLength > MAX_BYTES) fail();
  let payload; try { payload = JSON.parse(raw); } catch { fail(); }
  if (!payload || payload.format !== FORMAT || payload.version !== 1) fail();
  return validateEntries(payload.entries);
}
export function decodeStored(payload) {
  if (payload === undefined) return [];
  if (!payload || payload.format !== FORMAT || payload.version !== 1) fail();
  return validateEntries(payload.entries);
}
export function addEntries(entries, input, uuid = () => crypto.randomUUID()) {
  const card = normalizeCard(input.card), quantity = Number(input.quantity);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 9999 || !conditions.includes(input.condition)
    || !finishes.includes(input.finish) || !validPrice(input.purchasePriceCents)
    || (card.finishes.length && input.finish !== 'Non précisée' && !card.finishes.includes(input.finish))) {
    throw new Error('Quantité, état, finition ou prix invalide.');
  }
  const existing = entries.find((entry) => entry.card.id === card.id && entry.condition === input.condition
    && entry.finish === input.finish && entry.purchasePriceCents === input.purchasePriceCents);
  if (existing && existing.quantity + quantity > 9999) throw new Error('Ce lot dépasserait 9 999 exemplaires.');
  const next = existing ? entries.map((entry) => entry.id === existing.id ? { ...entry, quantity: entry.quantity + quantity } : entry)
    : [{ id: uuid(), card, quantity, condition: input.condition, finish: input.finish,
      purchasePriceCents: input.purchasePriceCents, addedAt: new Date().toISOString() }, ...entries];
  encodeBackup(next); return next;
}
export function removeOne(entries, id) {
  return entries.flatMap((entry) => entry.id !== id ? [entry]
    : entry.quantity > 1 ? [{ ...entry, quantity: entry.quantity - 1 }] : []);
}
export function mergeBackup(entries, imported) {
  const existing = new Set(entries.map((entry) => entry.id));
  const next = [...validateEntries(imported).filter((entry) => !existing.has(entry.id)), ...entries];
  encodeBackup(next); return next;
}
export function collectionTotals(entries) {
  return entries.reduce((total, entry) => ({
    cards: total.cards + entry.quantity, lots: total.lots + 1,
    costCents: total.costCents + (entry.purchasePriceCents ?? 0) * entry.quantity,
    withoutCost: total.withoutCost + (entry.purchasePriceCents === null ? entry.quantity : 0),
  }), { cards: 0, lots: 0, costCents: 0, withoutCost: 0 });
}
export function matchesCollection(entry, input) {
  const query = input.normalize('NFKC').toLocaleLowerCase('fr-FR').normalize('NFD')
    .replace(/([a-z])[\u0300-\u036f]+/g, '$1').normalize('NFC').trim();
  return `${entry.card.name} ${entry.card.setName} ${entry.card.setCode} ${entry.card.number} ${(entry.card.searchNames || []).join(' ')}`
    .normalize('NFKC').toLocaleLowerCase('fr-FR').normalize('NFD')
    .replace(/([a-z])[\u0300-\u036f]+/g, '$1').normalize('NFC').includes(query);
}
