import { readFileSync } from 'node:fs';
import { normalizePricing } from './pricing.mjs';

const dataRoot = new URL('../expo-app/src/data/', import.meta.url);
const readData = (name) => JSON.parse(readFileSync(new URL(name, dataRoot), 'utf8'));
const dictionary = readData('pokemon-names.json');
const malie = readData('card-image-index.json').entries;
const japanese = readData('japanese-image-index.json').entries;
export const languages = { FR: 'fr', EN: 'en', JP: 'ja' };
export const PAGE_SIZE = 24;
export const MAX_PAGES = 3;

export function normalizeName(value) {
  return value.normalize('NFKC').toLocaleLowerCase('fr-FR').normalize('NFD')
    .replace(/([a-z])[\u0300-\u036f]+/g, '$1').normalize('NFC')
    .replace(/[’‘]/g, "'").replace(/\s+/g, ' ').trim();
}
const names = dictionary.entries.map((entry) => ({
  FR: entry[1], EN: entry[2], JP: entry[3], aliases: entry.slice(1).map(normalizeName),
}));
export function translateQuery(input, language) {
  const normalized = normalizeName(input);
  const exact = names.filter((name) => name.aliases.includes(normalized));
  const matches = exact.length ? exact : normalized.length >= 3
    ? names.filter((name) => name.aliases.some((alias) => alias.startsWith(normalized))) : [];
  return matches.length === 1 ? matches[0][language] : input.trim();
}

const official = {
  'sm7.5-3': ['3', 'SM75/SM75_FR_3.png'],
  'sm115-9': ['9', 'SM115/SM115_FR_9.png'],
  'mep-023': ['023', 'MEP/MEP_FR_23.png'],
  'mep-029': ['029', 'MEP/MEP_FR_29.png'],
  'mep-030': ['030', 'MEP/MEP_FR_30.png'],
};

export function imageSources(card, language) {
  const images = [];
  if (typeof card.image === 'string' && card.image.startsWith('https://assets.tcgdex.net/')) {
    images.push({ url: `${card.image}/high.png`, source: 'TCGdex' });
  }
  const key = `${language}:${card.id}`;
  const index = language === 'JP' ? japanese : malie;
  const entry = Object.hasOwn(index, key) ? index[key] : undefined;
  if (entry && entry[0] === card.name && entry[1] === card.localId) {
    images.push({ url: language === 'JP'
      ? `https://tcgplayer-cdn.tcgplayer.com/product/${entry[2]}`
      : `https://cdn.malie.io/file/malie-io/${entry[2]}`,
    source: language === 'JP' ? 'TCGplayer JP' : 'Malie' });
  }
  const fallback = Object.hasOwn(official, card.id) ? official[card.id] : undefined;
  if (language === 'FR' && fallback?.[0] === card.localId) {
    images.push({ url: `https://assets.pokemon.com/static-assets/content-assets/cms2-fr-fr/img/cards/web/${fallback[1]}`,
      source: 'Pokémon officiel' });
  }
  return images.filter(({ url }) => allowedImageUrl(url));
}

// Never act as a general URL proxy. Redirects are also refused by the server.
export function allowedImageUrl(input) {
  try {
    const url = new URL(input);
    if (url.protocol !== 'https:' || url.username || url.password || url.port
      || url.search || url.hash || /%|\\/.test(url.pathname)) return false;
    if (url.hostname === 'assets.tcgdex.net') return /^\/[\w./-]+\/(high|low)\.(png|webp|jpg)$/.test(url.pathname);
    if (url.hostname === 'cdn.malie.io') return /^\/file\/malie-io\/[\w./-]+\.png$/.test(url.pathname);
    if (url.hostname === 'tcgplayer-cdn.tcgplayer.com') return /^\/product\/\d+_in_400x400\.jpg$/.test(url.pathname);
    return url.hostname === 'assets.pokemon.com'
      && /^\/static-assets\/content-assets\/cms2-fr-fr\/img\/cards\/web\/[A-Z0-9]+\/[A-Z0-9_]+\.png$/.test(url.pathname);
  } catch { return false; }
}

export async function searchCards(params, fetchJson) {
  const language = params.get('language');
  const input = (params.get('query') || '').trim();
  const page = Number(params.get('page') || '1');
  const scope = params.get('scope') || 'scanner';
  const field = params.get('field') || 'name';
  const fields = { name: 'name', number: 'localId', set: 'set.name' };
  const minLength = scope === 'catalog' ? (field === 'number' ? 1 : 2) : 2;
  if (!Object.hasOwn(languages, language) || !Object.hasOwn(fields, field)
    || !['scanner', 'catalog'].includes(scope) || input.length > 80
    || (input.length < minLength && !(scope === 'catalog' && input === ''))
    || (scope === 'scanner' && field !== 'name')
    || !Number.isInteger(page) || page < 1 || page > (scope === 'catalog' ? 500 : MAX_PAGES)) {
    throw new Error('Recherche invalide : langue FR/EN/JP, nom de 2 à 80 caractères, page 1 à 3.');
  }
  const query = field === 'name' && input ? translateQuery(input, language) : input;
  const search = new URLSearchParams({ 'pagination:page': String(page),
    'pagination:itemsPerPage': String(PAGE_SIZE) });
  if (query) search.set(fields[field], query);
  const raw = await fetchJson(`https://api.tcgdex.net/v2/${languages[language]}/cards?${search}`);
  if (!Array.isArray(raw)) throw new Error('Réponse du catalogue invalide.');
  const cards = raw.slice(0, PAGE_SIZE).filter((card) => card && typeof card.name === 'string'
    && /^[\w.-]+$/.test(card.id) && typeof card.localId === 'string').map((card) => ({
    id: `tcgdex:${language}:${card.id}`, sourceId: card.id, name: card.name,
    number: card.localId, language, setCode: card.id.slice(0, card.id.lastIndexOf('-')),
    images: imageSources(card, language),
  }));
  return { cards, query, input, language, page, hasMore: raw.length >= PAGE_SIZE,
    limitReached: page === (scope === 'catalog' ? 500 : MAX_PAGES) && raw.length >= PAGE_SIZE };
}

export async function getCardDetail(id, fetchJson) {
  const match = /^tcgdex:(FR|EN|JP):([a-zA-Z0-9.-]+)$/.exec(id || '');
  if (!match) throw new Error('Identifiant de carte invalide.');
  const [, language, sourceId] = match;
  const card = await fetchJson(`https://api.tcgdex.net/v2/${languages[language]}/cards/${encodeURIComponent(sourceId)}`);
  if (!card || card.id !== sourceId || typeof card.name !== 'string' || typeof card.localId !== 'string'
    || !card.set || typeof card.set.name !== 'string') throw new Error('La fiche reçue ne correspond pas à la carte demandée.');
  const official = card.set.cardCount?.official;
  const variants = card.variants || {};
  const normalized = normalizeName(card.name);
  const searchNames = [...new Set(names.filter((species) => normalized.includes(normalizeName(species[language])))
    .flatMap((species) => [species.FR, species.EN, species.JP]))].slice(0, 30);
  return {
    id, sourceId, source: 'tcgdex', language, name: card.name, localNumber: card.localId,
    number: `${card.localId}${Number.isInteger(official) && official > 0 ? `/${official}` : ''}`,
    setCode: card.set.id || sourceId.slice(0, sourceId.lastIndexOf('-')), setName: card.set.name,
    rarity: typeof card.rarity === 'string' ? card.rarity : 'Non renseignée',
    finishes: [['normal', 'Normale'], ['holo', 'Holo'], ['reverse', 'Reverse']]
      .filter(([key]) => variants[key] === true).map(([, finish]) => finish),
    images: imageSources(card, language), searchNames, marketPrice: null,
    quotes: normalizePricing(card.pricing, language, variants),
  };
}
