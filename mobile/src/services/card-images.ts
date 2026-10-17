import type { TcgCard } from '../types/card';
import * as imageIndex from '../data/card-image-index.json';
import * as japaneseIndex from '../data/japanese-image-index.json';

export type CardImage = { url: string; source: 'TCGdex' | 'Malie' | 'Pokémon officiel' | 'TCGplayer JP' };
type ImageCard = Pick<TcgCard, 'id' | 'name' | 'language' | 'number' | 'imageUrl'>;
const malieImages: Readonly<Record<string, readonly string[]>> = imageIndex.entries;
const malieBase = 'https://cdn.malie.io/file/malie-io/';
const japaneseImages: Readonly<Record<string, readonly string[]>> = japaneseIndex.entries;
const japaneseBase = 'https://tcgplayer-cdn.tcgplayer.com/product/';

// Exact, visually checked French printings only. Never infer a URL from a name
// or generalize these exceptions to a whole set. See docs/CARD_IMAGES.md.
const officialImages = new Map<string, { number: string; path: string }>([
  ['tcgdex:FR:sm7.5-3', { number: '3', path: 'SM75/SM75_FR_3.png' }],
  ['tcgdex:FR:sm115-9', { number: '9', path: 'SM115/SM115_FR_9.png' }],
  ['tcgdex:FR:mep-023', { number: '023', path: 'MEP/MEP_FR_23.png' }],
  ['tcgdex:FR:mep-029', { number: '029', path: 'MEP/MEP_FR_29.png' }],
  ['tcgdex:FR:mep-030', { number: '030', path: 'MEP/MEP_FR_30.png' }],
]);
const officialBase = 'https://assets.pokemon.com/static-assets/content-assets/cms2-fr-fr/img/cards/web/';

export function getCardImages(card: ImageCard): CardImage[] {
  const images: CardImage[] = [];
  if (card.imageUrl?.startsWith('https://assets.tcgdex.net/')) {
    images.push({ url: card.imageUrl, source: 'TCGdex' });
  }
  if (card.id.startsWith(`tcgdex:${card.language}:`) && (card.language === 'FR' || card.language === 'EN')) {
    const key = card.id.slice('tcgdex:'.length);
    const entry = Object.hasOwn(malieImages, key) ? malieImages[key] : undefined;
    if (entry && entry[0] === card.name && entry[1] === card.number.split('/')[0]) {
      images.push({ url: malieBase + entry[2], source: 'Malie' });
    }
  }
  if (card.language === 'JP' && card.id.startsWith('tcgdex:JP:')) {
    const key = card.id.slice('tcgdex:'.length);
    const entry = Object.hasOwn(japaneseImages, key) ? japaneseImages[key] : undefined;
    if (entry && entry[0] === card.name && entry[1] === card.number.split('/')[0]
      && /^\d+_in_400x400\.jpg$/.test(entry[2])) {
      images.push({ url: japaneseBase + entry[2], source: 'TCGplayer JP' });
    }
  }
  const official = officialImages.get(card.id);
  if (official && card.language === 'FR' && card.number.split('/')[0] === official.number) {
    images.push({ url: officialBase + official.path, source: 'Pokémon officiel' });
  }
  return images;
}

export function nextCardImage(images: readonly CardImage[], failedUrls: readonly string[]) {
  return images.find((image) => !failedUrls.includes(image.url));
}
