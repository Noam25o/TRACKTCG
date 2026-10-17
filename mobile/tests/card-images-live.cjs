const assert = require('node:assert/strict');
const load = require('./load-typescript.cjs');
const { getCatalogCard } = load('src/services/catalog.ts');
const { getCardImages } = load('src/services/card-images.ts');

const samples = [
  ['FR', 'mep-001'], ['FR', 'mep-002'], ['FR', 'mep-003'], ['FR', 'mep-023'],
  ['FR', 'det1-5'], ['FR', 'det1-1'], ['FR', 'sm7.5-3'], ['FR', 'sm115-9'],
  ['FR', 'sv03-125'], ['FR', 'swsh1-1'], ['FR', 'xy1-1'], ['FR', 'bw1-1'],
  ['EN', 'mep-001'], ['EN', 'det1-1'], ['EN', 'sv03-125'], ['EN', 'xy1-1'],
];
(async () => {
  for (const [language, id] of samples) {
    const card = await getCatalogCard(`tcgdex:${language}:${id}`);
    const image = getCardImages(card).find((image) => image.source === 'Malie');
    assert.ok(image, `No Malie match for ${language}:${id}`);
    const response = await fetch(image.url, { method: 'HEAD', signal: AbortSignal.timeout(15000) });
    assert.equal(response.status, 200, image.url);
    assert.match(response.headers.get('content-type'), /^image\/png/);
    console.log(`${language} ${id} ${card.name}: Malie image OK`);
  }
  const japanese = await getCatalogCard('tcgdex:JP:SV2a-001');
  assert.ok(getCardImages(japanese).every((image) => image.source !== 'Malie'));
  console.log('Japanese language isolation OK');
})().catch((error) => { console.error(error); process.exitCode = 1; });
