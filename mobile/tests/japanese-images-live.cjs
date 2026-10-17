const assert = require('node:assert/strict');
const load = require('./load-typescript.cjs');
const { getCatalogCard } = load('src/services/catalog.ts');
const { getCardImages } = load('src/services/card-images.ts');

// Sample several sets/species, including a card with an existing TCGdex image.
const samples = ['SM6a-003', 'SM8b-001', 'SM10-007', 'SM3H-011', 'SM12-001', 'SM4S-001'];
(async () => {
  for (const id of samples) {
    const card = await getCatalogCard(`tcgdex:JP:${id}`);
    const image = getCardImages(card).find((image) => image.source === 'TCGplayer JP');
    assert.ok(image, `No Japanese fallback for ${id}`);
    const response = await fetch(image.url, { method: 'HEAD', signal: AbortSignal.timeout(15000) });
    assert.equal(response.status, 200, image.url);
    assert.match(response.headers.get('content-type'), /^image\/jpeg/);
    console.log(`${id} ${card.name}: Japanese image OK (${image.url})`);
  }
  const primary = await getCatalogCard('tcgdex:JP:SV2a-001');
  assert.equal(getCardImages(primary)[0]?.source, 'TCGdex');
  assert.ok(getCardImages(primary).every((image) => image.source !== 'Malie'));
  console.log('TCGdex priority and Japanese language isolation OK');
})().catch((error) => { console.error(error); process.exitCode = 1; });
