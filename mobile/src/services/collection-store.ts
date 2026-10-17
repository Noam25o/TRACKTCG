import type { CardCondition, CardFinish, CollectionEntry, TcgCard } from '../types/card';

export type AddCardInput = { card: TcgCard; condition: CardCondition; finish: CardFinish; purchasePrice?: number };
export interface KeyValueStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}
const KEY = 'tracktcg.collection.v1';
const conditions = ['NM', 'EX', 'GD', 'LP', 'PL'];
const finishes = ['Normale', 'Holo', 'Reverse'];

function validCard(card: TcgCard) {
  return card && ['id', 'name', 'number', 'setName', 'rarity', 'symbol'].every((key) => typeof card[key as keyof TcgCard] === 'string')
    && ['FR', 'EN', 'JP'].includes(card.language)
    && (card.marketPrice === null || (Number.isFinite(card.marketPrice) && card.marketPrice >= 0))
    && (card.dayChangePercent === null || Number.isFinite(card.dayChangePercent))
    && Array.isArray(card.accent) && card.accent.length === 2 && card.accent.every((color) => typeof color === 'string')
    && (card.finishes === undefined || (Array.isArray(card.finishes) && card.finishes.every((finish) => finishes.includes(finish))));
}

export function decodeCollection(raw: string | null): CollectionEntry[] {
  if (raw === null) return [];
  const data = JSON.parse(raw);
  if (data?.version !== 1 || !Array.isArray(data.entries) || !data.entries.every((entry: CollectionEntry) =>
    entry && typeof entry.id === 'string' && validCard(entry.card)
    && Number.isInteger(entry.quantity) && entry.quantity > 0
    && conditions.includes(entry.condition) && finishes.includes(entry.finish)
    && typeof entry.addedAt === 'string' && Number.isFinite(Date.parse(entry.addedAt))
    && (entry.purchasePrice === undefined || (Number.isFinite(entry.purchasePrice) && entry.purchasePrice >= 0))
  )) throw new Error('Sauvegarde locale illisible. Elle a été conservée sans modification.');
  return data.entries;
}

export function addToCollection(entries: CollectionEntry[], input: AddCardInput): CollectionEntry[] {
  const { card, condition, finish, purchasePrice } = input;
  if (!validCard(card) || !conditions.includes(condition) || !finishes.includes(finish)
    || (card.finishes?.length && !card.finishes.includes(finish))
    || (purchasePrice !== undefined && (!Number.isFinite(purchasePrice) || purchasePrice < 0))) {
    throw new Error('Les informations de la carte sont invalides.');
  }
  const existing = entries.find((entry) => entry.card.id === card.id && entry.card.language === card.language
    && entry.condition === condition && entry.finish === finish && entry.purchasePrice === purchasePrice);
  if (existing) return entries.map((entry) => entry.id === existing.id ? { ...entry, quantity: entry.quantity + 1 } : entry);
  return [{ id: `${card.id}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`, card, condition, finish, purchasePrice,
    quantity: 1, addedAt: new Date().toISOString() }, ...entries];
}

export function collectionTotals(entries: CollectionEntry[]) {
  const realEntries = entries.filter((entry) => entry.card.source === 'tcgdex');
  return {
    totalCards: entries.reduce((sum, entry) => sum + entry.quantity, 0),
    totalValue: realEntries.reduce((sum, entry) => sum + (entry.card.marketPrice ?? 0) * entry.quantity, 0),
    investedValue: realEntries.reduce((sum, entry) => sum + (entry.purchasePrice ?? 0) * entry.quantity, 0),
    unpricedCards: realEntries.reduce((sum, entry) => sum + (entry.card.marketPrice === null ? entry.quantity : 0), 0),
    demoCards: entries.filter((entry) => entry.card.source !== 'tcgdex').reduce((sum, entry) => sum + entry.quantity, 0),
  };
}

export function createCollectionStore(storage: KeyValueStorage) {
  let entries: CollectionEntry[] = [];
  let ready = false;
  let queue: Promise<unknown> = Promise.resolve();
  return {
    async load() {
      entries = decodeCollection(await storage.getItem(KEY));
      ready = true;
      return entries;
    },
    add(input: AddCardInput): Promise<CollectionEntry[]> {
      const operation = queue.then(async () => {
        if (!ready) throw new Error('La collection est en cours de chargement.');
        const next = addToCollection(entries, input);
        await storage.setItem(KEY, JSON.stringify({ version: 1, entries: next }));
        entries = next;
        return entries;
      });
      queue = operation.catch(() => undefined);
      return operation;
    },
  };
}
