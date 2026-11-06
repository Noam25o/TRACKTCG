import * as dictionary from '../data/pokemon-names.json';
import type { CardLanguage } from '../types/card';

export type PokemonName = { dexId: number; FR: string; EN: string; JP: string };
const pokemon: readonly PokemonName[] = dictionary.entries.map(([id, fr, en, jp]) => ({
  dexId: id as number, FR: fr as string, EN: en as string, JP: jp as string,
}));

export function normalizeSearch(value: string): string {
  // Remove Latin accents, but keep Japanese kana voicing and gender symbols.
  return value.normalize('NFKC').toLocaleLowerCase('fr-FR').normalize('NFD')
    .replace(/([a-z])[\u0300-\u036f]+/g, '$1').normalize('NFC')
    .replace(/[’‘]/g, "'").replace(/\s+/g, ' ').trim();
}

const names = pokemon.map((item) => ({ pokemon: item,
  aliases: [...new Set([item.FR, item.EN, item.JP].map(normalizeSearch))],
}));

export function resolvePokemonName(input: string, language: CardLanguage) {
  const query = input.trim();
  const normalized = normalizeSearch(query);
  if (!normalized) return { query, candidates: [] as PokemonName[] };
  const exact = names.filter((item) => item.aliases.includes(normalized));
  const matches = exact.length ? exact : normalized.length >= 2
    ? names.filter((item) => item.aliases.some((name) => name.startsWith(normalized))) : [];
  // Never silently choose among several species (e.g. Draco / Dracolosse).
  const selected = matches.length === 1 && (exact.length || normalized.length >= 3)
    ? matches[0].pokemon : undefined;
  return { query: selected ? selected[language] : query, pokemon: selected,
    candidates: matches.map((item) => item.pokemon) };
}

type SearchableCard = { name: string; setName: string; number: string; language: CardLanguage };

// Compile once per input. Saved cards keep their original language and identity.
export function createCollectionSearch(input: string): (card: SearchableCard) => boolean {
  const normalized = normalizeSearch(input);
  if (!normalized) return () => true;
  const { candidates } = resolvePokemonName(input, 'FR');
  const translated = Object.fromEntries((['FR', 'EN', 'JP'] as const).map((language) => [
    language, candidates.map((item) => normalizeSearch(item[language])),
  ])) as Record<CardLanguage, string[]>;
  return (card) => normalizeSearch(`${card.name} ${card.setName} ${card.number}`).includes(normalized)
    || translated[card.language].some((name) => normalizeSearch(card.name).includes(name));
}
