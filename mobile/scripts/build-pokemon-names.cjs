// Small local dictionary of species names, not a runtime translation service.
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const source = 'https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/pokemon_species_names.csv';

function parseCsv(csv) {
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < csv.length; i++) {
    const character = csv[i];
    if (character === '"') {
      if (quoted && csv[i + 1] === '"') { field += '"'; i++; }
      else quoted = !quoted;
    } else if (character === ',' && !quoted) { row.push(field); field = ''; }
    else if (character === '\n' && !quoted) { row.push(field.replace(/\r$/, '')); rows.push(row); row = []; field = ''; }
    else field += character;
  }
  if (quoted) throw new Error('Unclosed CSV quote');
  if (field || row.length) { row.push(field.replace(/\r$/, '')); rows.push(row); }
  return rows;
}
function buildNames(csv) {
  const [header, ...rows] = parseCsv(csv);
  if (header?.slice(0, 3).join(',') !== 'pokemon_species_id,local_language_id,name') throw new Error('Unexpected Pokémon names schema');
  const species = new Map();
  for (const [id, locale, name] of rows) {
    if (!['1', '5', '9'].includes(locale)) continue;
    if (!/^\d+$/.test(id) || !name) throw new Error('Invalid species name');
    if (!species.has(id)) species.set(id, {});
    const language = { 1: 'JP', 5: 'FR', 9: 'EN' }[locale];
    const item = species.get(id);
    if (item[language] && item[language] !== name) throw new Error('Conflicting species names');
    item[language] = name;
  }
  return [...species].map(([id, names]) => {
    if (!names.FR || !names.EN || !names.JP) throw new Error(`Missing translation for ${id}`);
    return [Number(id), names.FR, names.EN, names.JP];
  }).sort((a, b) => a[0] - b[0]);
}
async function main() {
  const response = await fetch(source, { signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const csv = await response.text();
  const entries = buildNames(csv);
  if (entries.length < 1025) throw new Error('Incomplete Pokémon dictionary; existing file preserved');
  const output = { generatedAt: new Date().toISOString(), source, license: 'BSD-3-Clause; see docs/third-party/POKEAPI_LICENSE.txt',
    licenseNotice: fs.readFileSync(path.resolve(__dirname, '../../docs/third-party/POKEAPI_LICENSE.txt'), 'utf8'),
    sourceSha256: createHash('sha256').update(csv).digest('hex'), entries };
  const destination = path.resolve(__dirname, '../src/data/pokemon-names.json');
  fs.writeFileSync(destination, JSON.stringify(output) + '\n');
  console.log(JSON.stringify({ species: entries.length, bytes: fs.statSync(destination).size, sourceSha256: output.sourceSha256 }));
}
module.exports = { parseCsv, buildNames };
if (require.main === module) main().catch((error) => { console.error(error); process.exitCode = 1; });
