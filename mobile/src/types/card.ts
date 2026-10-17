export type CardCondition = 'NM' | 'EX' | 'GD' | 'LP' | 'PL';
export type CardFinish = 'Normale' | 'Holo' | 'Reverse';
export type CardLanguage = 'FR' | 'EN' | 'JP';

export type TcgCard = {
  id: string;
  name: string;
  setName: string;
  number: string;
  rarity: string;
  language: CardLanguage;
  marketPrice: number | null;
  dayChangePercent: number | null;
  source?: 'demo' | 'tcgdex';
  sourceId?: string;
  imageUrl?: string;
  finishes?: CardFinish[];
  accent: [string, string];
  symbol: string;
};

export type CollectionEntry = {
  id: string;
  card: TcgCard;
  quantity: number;
  condition: CardCondition;
  finish: CardFinish;
  purchasePrice?: number;
  addedAt: string;
};

export type ScanCandidate = {
  card: TcgCard;
  confidence: number;
  evidence: {
    visual: number;
    collectorNumber: boolean;
    language: boolean;
  };
};
