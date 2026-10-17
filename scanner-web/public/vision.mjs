// Specialised, classical image retrieval. Not a trained model or a calibrated
// probability. The small reference pool and manual alignment are deliberate.
export const WIDTH = 63;
export const HEIGHT = 88;

const suffixPattern = '(v[\\s-]*max|v[\\s-]*star|v[\\s-]*union|break|gx|ex|lv\\.?[\\s-]*x|v)';
export function normalizeCardSuffix(value) {
  const compact = String(value || '').normalize('NFKC').toLowerCase().replace(/[\s.-]/g, '');
  const values = { ex: 'ex', gx: 'GX', v: 'V', vmax: 'VMAX', vstar: 'VSTAR', vunion: 'V-UNION',
    break: 'BREAK', lvx: 'LV.X' };
  return Object.hasOwn(values, compact) ? values[compact] : null;
}

export function readCardSuffix(title, baseName) {
  const name = String(baseName).normalize('NFKC').toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Same title line, immediately after the species, not in attacks or HP.
  const suffixes = String(title).split(/\r?\n/).map((line) => {
    const match = line.normalize('NFKC').toLowerCase().match(new RegExp(`${name}[\\s-]*${suffixPattern}(?=$|[^\\p{L}])`, 'u'));
    return match ? normalizeCardSuffix(match[1]) : null;
  }).filter(Boolean);
  const unique = [...new Set(suffixes)];
  return unique.length === 1 ? unique[0] : null;
}

export function scannedNameLabel(name) {
  return `${name.name}${name.suffix ? ` ${name.suffix}` : ''}`;
}

export function suffixSearchQuery(baseName, suffix) {
  const value = normalizeCardSuffix(suffix);
  if (!value) return baseName;
  // TCGdex name alternatives: no guess at a printing or a translated suffix.
  const forms = [`${baseName} ${value}`, `${baseName}-${value}`, `${baseName}${value}`];
  const query = forms.join('|');
  return query.length <= 80 ? query : forms[0];
}

export function createNameGate() {
  let previous = null, count = 0;
  return {
    reset() { previous = null; count = 0; },
    update(name) {
      if (!name) { this.reset(); return null; }
      const identity = `${name.key}:${name.suffix || ''}`;
      count = identity === previous ? count + 1 : 1; previous = identity;
      return count >= 2 ? name : null;
    },
  };
}

export function coverCrop(videoWidth, videoHeight, viewWidth, viewHeight, guide) {
  if (![videoWidth, videoHeight, viewWidth, viewHeight, guide.width, guide.height]
    .every((value) => Number.isFinite(value) && value > 0)) throw new Error('Dimensions caméra invalides.');
  const scale = Math.max(viewWidth / videoWidth, viewHeight / videoHeight);
  const offsetX = (videoWidth * scale - viewWidth) / 2;
  const offsetY = (videoHeight * scale - viewHeight) / 2;
  const x = (guide.x + offsetX) / scale;
  const y = (guide.y + offsetY) / scale;
  const width = guide.width / scale;
  const height = guide.height / scale;
  if (x < 0 || y < 0 || x + width > videoWidth + 0.01 || y + height > videoHeight + 0.01) {
    throw new Error('Le cadre sort de la caméra.');
  }
  return { x, y, width, height };
}

export function describe(rgba, width = WIDTH, height = HEIGHT) {
  if (rgba.length !== width * height * 4 || width < 8 || height < 8) throw new Error('Image invalide.');
  const luminance = new Float32Array(width * height);
  let sum = 0, square = 0, clipped = 0, edge = 0;
  for (let i = 0; i < luminance.length; i++) {
    const p = i * 4;
    const v = (0.299 * rgba[p] + 0.587 * rgba[p + 1] + 0.114 * rgba[p + 2]) / 255;
    luminance[i] = v; sum += v; square += v * v;
    if (v > 0.98 || v < 0.02) clipped++;
    if (i % width && i >= width) edge += Math.abs(v - luminance[i - 1]) + Math.abs(v - luminance[i - width]);
  }
  const mean = sum / luminance.length;
  const contrast = Math.sqrt(Math.max(0, square / luminance.length - mean * mean));
  const values = [], colours = [];
  // Ignore outer border (wear/sleeve). Spatial grids keep layout/art information.
  for (let gy = 0; gy < 16; gy++) for (let gx = 0; gx < 12; gx++) {
    const x0 = Math.floor((0.06 + gx * 0.88 / 12) * width);
    const x1 = Math.max(x0 + 1, Math.floor((0.06 + (gx + 1) * 0.88 / 12) * width));
    const y0 = Math.floor((0.04 + gy * 0.92 / 16) * height);
    const y1 = Math.max(y0 + 1, Math.floor((0.04 + (gy + 1) * 0.92 / 16) * height));
    let l = 0, red = 0, blue = 0, n = 0;
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const i = y * width + x, p = i * 4;
      l += luminance[i]; red += (rgba[p] - rgba[p + 1]) / 255;
      blue += (rgba[p + 2] - rgba[p + 1]) / 255; n++;
    }
    values.push((l / n - mean) / Math.max(contrast, 0.03));
    colours.push(red / n, blue / n);
  }
  return { values, colours, quality: { mean, contrast, edge: edge / luminance.length,
    clipped: clipped / luminance.length } };
}

export function qualityIssue(quality) {
  if (quality.mean < 0.12) return 'Plus de lumière, sans reflet direct.';
  if (quality.mean > 0.91 || quality.clipped > 0.55) return 'Évite les reflets et la surexposition.';
  if (quality.contrast < 0.06 || quality.edge < 0.012) return 'Aligne la carte et attends la mise au point.';
  return null;
}

export function distance(a, b) {
  let dot = 0, aa = 0, bb = 0, chroma = 0;
  for (let i = 0; i < a.values.length; i++) {
    dot += a.values[i] * b.values[i]; aa += a.values[i] ** 2; bb += b.values[i] ** 2;
  }
  for (let i = 0; i < a.colours.length; i++) chroma += Math.abs(a.colours[i] - b.colours[i]);
  const correlation = dot / Math.max(0.00001, Math.sqrt(aa * bb));
  return 0.8 * (1 - Math.max(-1, Math.min(1, correlation))) / 2
    + 0.2 * chroma / a.colours.length;
}

export function rankReferences(descriptor, references) {
  return references.map((reference) => ({ reference,
    distance: distance(descriptor, reference.descriptor) })).sort((a, b) => a.distance - b.distance).slice(0, 3);
}

// A still image is assessed once: replaying it is NOT four independent frames.
// Candidates remain proposals requiring the user's printing/number check.
export function assessSnapshot(ranking, quality, { maxDistance = .15, minMargin = .025 } = {}) {
  const issue = qualityIssue(quality);
  if (issue || !ranking[0] || ranking[0].distance > maxDistance) {
    return { ready: false, message: issue || 'Pas de correspondance nette. Recadre ou utilise la recherche manuelle.' };
  }
  if (ranking[1] && ranking[1].distance - ranking[0].distance < minMargin) {
    return { ready: false, ambiguous: true, message: 'Visuels proches sur cette image : vérifie les cartes proposées.' };
  }
  return { ready: true, message: 'Image analysée · impression à confirmer.' };
}

export function createStabilityGate({ maxDistance = 0.15, minMargin = 0.025, required = 4 } = {}) {
  let lastId = null, count = 0;
  return {
    reset() { lastId = null; count = 0; },
    update(ranking, quality) {
      const issue = qualityIssue(quality);
      const best = ranking[0];
      if (issue || !best || best.distance > maxDistance) {
        lastId = null; count = 0;
        return { count, ready: false, message: issue || 'Aucune correspondance nette dans ce lot.' };
      }
      if (ranking[1] && ranking[1].distance - best.distance < minMargin) {
        lastId = null; count = 0;
        return { count, ready: false, ambiguous: true, message: 'Visuels proches : numéro et impression à vérifier.' };
      }
      const id = best.reference.card.id;
      count = id === lastId ? count + 1 : 1; lastId = id;
      return { count, ready: count >= required, message: `Maintiens la carte immobile · ${Math.min(count, required)}/${required}` };
    },
  };
}
