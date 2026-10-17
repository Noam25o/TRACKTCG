import { cards } from '@/data/cards';
import type { ScanCandidate } from '@/types/card';

export type ScannerState = 'idle' | 'framing' | 'stable' | 'recognizing' | 'matched' | 'uncertain';

export interface CardRecognitionEngine {
  readonly mode: 'mock' | 'on-device';
  identifyFrame(frameUri: string): Promise<ScanCandidate[]>;
}

class DevelopmentRecognitionEngine implements CardRecognitionEngine {
  readonly mode = 'mock' as const;

  async identifyFrame(_frameUri: string): Promise<ScanCandidate[]> {
    await new Promise((resolve) => setTimeout(resolve, 650));

    return [
      {
        card: cards[0],
        confidence: 0.994,
        evidence: {
          visual: 0.989,
          collectorNumber: true,
          language: true,
        },
      },
      {
        card: cards[4],
        confidence: 0.711,
        evidence: {
          visual: 0.744,
          collectorNumber: false,
          language: true,
        },
      },
    ];
  }
}

export const recognitionEngine: CardRecognitionEngine = new DevelopmentRecognitionEngine();
