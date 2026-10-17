const amount = (value) => typeof value === 'number' && Number.isFinite(value) && value > 0 && value < 10000000 ? value : null;
function date(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(value)) return null;
  const time = Date.parse(value); return Number.isFinite(time) ? new Date(time).toISOString() : null;
}

// An aggregate market quote is NOT a language/condition-qualified valuation.
// Never substitute an international price for a Japanese-only printing.
export function normalizePricing(pricing, language, variants = {}) {
  if (!pricing || language === 'JP') return [];
  const quotes = [];
  const cm = pricing.cardmarket;
  if (cm?.unit === 'EUR') {
    for (const [suffix, finish, label] of [['', 'Normale', 'Non brillante'], ['-holo', 'Brillante', 'Brillante · holo / reverse non séparées']]) {
      if (suffix === '' && variants.normal === false) continue;
      if (suffix && variants.holo === false && variants.reverse === false) continue;
      const trend = amount(cm[`trend${suffix}`]), low = amount(cm[`low${suffix}`]), average30 = amount(cm[`avg30${suffix}`]);
      if (trend === null && low === null && average30 === null) continue;
      quotes.push({ provider: 'Cardmarket', via: 'TCGdex', currency: 'EUR', finish, label,
        updatedAt: date(cm.updated), trend, low, average30, high: null,
        scope: 'Langue et état non filtrés. Correspondance marketplace à vérifier.' });
    }
  }
  const tp = pricing.tcgplayer;
  if (tp?.unit === 'USD') {
    for (const [key, finish, label] of [
      ['normal', 'Normale', 'Normale'], ['holofoil', 'Holo', 'Holo'], ['reverse-holofoil', 'Reverse', 'Reverse'],
      ['holo', 'Holo', 'Holo'], ['reverse', 'Reverse', 'Reverse'],
      ['1st-edition', 'Normale', '1re édition · non brillante'], ['1st-edition-holofoil', 'Holo', '1re édition · holo'],
      ['unlimited', 'Normale', 'Unlimited · non brillante'], ['unlimited-holofoil', 'Holo', 'Unlimited · holo'],
    ]) {
      const variant = tp[key]; if (!variant) continue;
      const trend = amount(variant.marketPrice), low = amount(variant.lowPrice), high = amount(variant.highPrice);
      if (trend === null && low === null && high === null) continue;
      quotes.push({ provider: 'TCGplayer', via: 'TCGdex', currency: 'USD', finish, label,
        updatedAt: date(tp.updated), trend, low, high, average30: null,
        scope: 'Marché américain, sans filtre de langue ou état. Pas de conversion en euros.' });
    }
  }
  return quotes;
}
