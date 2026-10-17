import { createLocalOcr } from '/ocr.mjs';
import { scannedNameLabel, suffixSearchQuery, readCardSuffix } from '/vision.mjs';
const $ = (id) => document.getElementById(id);
let engine;
$('run').addEventListener('click', async () => {
  $('run').disabled = true; const started = performance.now(), selection = $('language').value;
  const language = selection.split('-')[0];
  try {
    const sourceId = { FR: 'base1-14', 'FR-ex': 'sv03.5-006', EN: 'base1-4', 'EN-vmax': 'swsh3-20',
      JP: 'SV-P-001', 'JP-charizard': 'SV2a-006' }[selection];
    const response = await fetch(`/api/card?${new URLSearchParams({ id: `tcgdex:${language}:${sourceId}` })}`);
    if (!response.ok) throw new Error('Référence indisponible.');
    const card = await response.json(); let image;
    for (const source of card.images) {
      const result = await fetch(`/api/reference?${new URLSearchParams({ url: source.url })}`);
      if (!result.ok) continue;
      image = await createImageBitmap(await result.blob()); break;
    }
    if (!image) throw new Error('Pas d’image de référence.');
    const canvas = $('title-crop'); canvas.width = 900; canvas.height = Math.round(900 * image.height * .075 / (image.width * .84));
    canvas.getContext('2d').drawImage(image, image.width * .06, image.height * .035, image.width * .84, image.height * .075, 0, 0, canvas.width, canvas.height);
    const cardCanvas = document.createElement('canvas'); cardCanvas.width = image.width; cardCanvas.height = image.height;
    cardCanvas.getContext('2d').drawImage(image, 0, 0); image.close();
    engine = await createLocalOcr(language, (data) => { $('result').textContent = `${data.status} · ${Math.round((data.progress || 0) * 100)} %`; });
    const passes = [], readPass = engine.read.bind(engine);
    engine.read = async (...args) => {
      const result = await readPass(...args);
      passes.push({ text: result.text, rawText: result.rawText, name: result.name, words: result.wordData });
      return result;
    };
    const read = await engine.readCard(cardCanvas);
    $('result').dataset.passes = JSON.stringify(passes);
    cardCanvas.width = cardCanvas.height = 0;
    let suffixResult = '';
    if (read.name?.suffix) {
      const query = suffixSearchQuery(read.name.name, read.name.suffix);
      const lookup = await fetch(`/api/catalog?${new URLSearchParams({ language, query })}`);
      if (!lookup.ok) throw new Error('Recherche du suffixe indisponible.');
      const cards = (await lookup.json()).cards.filter((item) => readCardSuffix(item.name, read.name.name) === read.name.suffix);
      suffixResult = ` · références du suffixe : ${cards.length} · carte test dans la page : ${cards.some((item) => item.id === card.id) ? 'oui' : 'non'}`;
    }
    $('result').textContent = `${language} · attendu : ${card.name} · lu : ${read.name ? scannedNameLabel(read.name) : 'non résolu'} · suffixe : ${read.name?.suffix || 'non lu'}${suffixResult} · texte : ${read.text.trim()} · brut : ${read.rawText.trim()} · score OCR interne : ${Math.round(read.confidence)} · total ${((performance.now() - started) / 1000).toFixed(1)} s (réseau + démarrage + OCR, sur PC)`;
    $('result').dataset.words = read.wordData;
  } catch (error) { $('result').textContent = `Échec : ${error.message}`; }
  finally { engine?.terminate(); engine = null; $('run').disabled = false; }
});
window.addEventListener('pagehide', () => engine?.terminate());
