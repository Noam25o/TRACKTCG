import type { CardFinish, CardLanguage, TcgCard } from '../types/card';
import { resolvePokemonName } from './pokemon-search';

export type SearchField = 'name' | 'number' | 'set';
export type CatalogSummary = Pick<TcgCard, 'id' | 'name' | 'number' | 'language' | 'imageUrl'> & { setCode: string };
export const CATALOG_PAGE_SIZE = 24;
const API = 'https://api.tcgdex.net/v2';
const languages = { FR: 'fr', EN: 'en', JP: 'ja' } as const;
const detailCache = new Map<string, TcgCard>();

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Réponse du catalogue invalide.');
  return value as Record<string, unknown>;
}

function text(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error('Fiche du catalogue incomplète.');
  return value;
}

function imageUrl(value: unknown): string | undefined {
  return typeof value === 'string' && value.startsWith('https://assets.tcgdex.net/')
    ? `${value}/high.png` : undefined;
}

export function catalogId(language: CardLanguage, sourceId: string) {
  return `tcgdex:${language}:${sourceId}`;
}

export function parseCatalogId(id: string): { language: CardLanguage; sourceId: string } | null {
  const match = /^tcgdex:(FR|EN|JP):([a-zA-Z0-9.-]+)$/.exec(id);
  return match ? { language: match[1] as CardLanguage, sourceId: match[2] } : null;
}

export function searchUrl(query: string, language: CardLanguage, field: SearchField, page: number): string {
  const key = { name: 'name', number: 'localId', set: 'set.name' }[field];
  const params = new URLSearchParams({
    [key]: field === 'name' ? resolvePokemonName(query, language).query : query.trim(),
    'pagination:page': String(page), 'pagination:itemsPerPage': String(CATALOG_PAGE_SIZE),
  });
  return `${API}/${languages[language]}/cards?${params.toString()}`;
}

async function request(url: string, signal?: AbortSignal, emptyOn404 = false): Promise<unknown> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  if (signal?.aborted) controller.abort();
  const timer = setTimeout(abort, 12000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (response.status === 404 && emptyOn404) return [];
    if (!response.ok) throw new Error(response.status === 404 ? 'Carte introuvable dans cette langue.' : 'Le catalogue est momentanément indisponible. Réessayez.');
    return await response.json();
  } catch (error) {
    if (signal?.aborted) throw error;
    if (controller.signal.aborted) throw new Error('Le catalogue met trop de temps à répondre. Réessayez.');
    if (error instanceof TypeError) throw new Error('Connexion impossible. Vérifiez votre accès à Internet.');
    throw error;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }
}

export function mapSummary(value: unknown, language: CardLanguage): CatalogSummary {
  const item = record(value);
  const sourceId = text(item.id);
  return {
    id: catalogId(language, sourceId), name: text(item.name), number: text(item.localId), language,
    setCode: sourceId.slice(0, sourceId.lastIndexOf('-')), imageUrl: imageUrl(item.image),
  };
}

export function mapCard(value: unknown, language: CardLanguage): TcgCard {
  const item = record(value);
  const set = record(item.set);
  const count = record(set.cardCount);
  const variants = item.variants ? record(item.variants) : {};
  const finishes: CardFinish[] = [];
  if (variants.normal === true) finishes.push('Normale');
  if (variants.holo === true) finishes.push('Holo');
  if (variants.reverse === true) finishes.push('Reverse');
  const sourceId = text(item.id);
  return {
    id: catalogId(language, sourceId), source: 'tcgdex', sourceId,
    name: text(item.name), setName: text(set.name),
    number: `${text(item.localId)}${typeof count.official === 'number' && count.official > 0 ? `/${count.official}` : ''}`,
    rarity: typeof item.rarity === 'string' ? item.rarity : 'Non renseignée', language,
    imageUrl: imageUrl(item.image), finishes,
    // Prices require their own provider with language/finish/condition provenance.
    marketPrice: null, dayChangePercent: null, accent: ['#215B48', '#172D41'], symbol: '◇',
  };
}

export async function searchCatalog(query: string, language: CardLanguage, field: SearchField, page = 1, signal?: AbortSignal) {
  const data = await request(searchUrl(query, language, field, page), signal, true);
  if (!Array.isArray(data)) throw new Error('Réponse du catalogue invalide.');
  return data.map((item) => mapSummary(item, language));
}

export async function getCatalogCard(id: string, signal?: AbortSignal): Promise<TcgCard> {
  const identity = parseCatalogId(id);
  if (!identity) throw new Error('Identifiant de carte invalide.');
  const cached = detailCache.get(id);
  if (cached) return cached;
  const data = await request(`${API}/${languages[identity.language]}/cards/${encodeURIComponent(identity.sourceId)}`, signal);
  const card = mapCard(data, identity.language);
  if (card.id !== id) throw new Error('La fiche reçue ne correspond pas à la carte demandée.');
  if (detailCache.size >= 80) detailCache.delete(detailCache.keys().next().value!);
  detailCache.set(id, card);
  return card;
}
