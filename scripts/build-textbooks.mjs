// Builds public/textbooks/ from the Ministry of Education open data on
// adopted textbooks ("Adozioni libri di testo", one CSV per region):
// https://dati.istruzione.it/opendata/opendata/catalogo/elements1/?area=Adozioni%20libri%20di%20testo
//
// Usage, once per school year (after build-schools.mjs):
//   node scripts/build-textbooks.mjs ALT*.csv
//
// Output:
//   public/textbooks/catalog.json   every adopted book once: [isbn, title, subject, volume, publisher]
//   public/textbooks/<PR>.json      per province (first two letters of the school code):
//                                   { schoolCode: { "3A": [catalogIndex, ...] } }
// Only schools present in public/schools.json (upper secondary) are kept.
import { createReadStream, mkdirSync, readFileSync, writeFileSync, readdirSync, unlinkSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const schools = new Set(JSON.parse(readFileSync(path.join(root, 'public', 'schools.json'), 'utf8')).schools.map(s => s[0]));

function parseLine(line) {
  const out = []; let field = ''; let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"') { if (line[i + 1] === '"') { field += '"'; i++; } else q = false; }
      else field += c;
    } else if (c === '"') q = true;
    else if (c === ',') { out.push(field); field = ''; }
    else field += c;
  }
  out.push(field);
  return out;
}

const SMALL = new Set(['di', 'e', 'ed', 'del', 'della', 'delle', 'dei', 'degli', 'per', 'la', 'il', 'lo', 'le', 'gli', 'in', 'a', 'al', 'alla', 'da', 'con', 'the', 'and', 'of']);
function titleCase(text) {
  return text.trim().replace(/\s+/g, ' ').toLowerCase().split(' ')
    .map((w, i) => (i > 0 && SMALL.has(w)) ? w : w.replace(/(^|['(\-/.])([a-zàèéìòù])/g, (_, a, b) => a + b.toUpperCase()))
    .join(' ');
}

const catalog = [];
const catalogIndex = new Map();
const byProvince = new Map();

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error('Pass the ALT*.csv files as arguments.');
  process.exit(1);
}

for (const file of files) {
  const rl = createInterface({ input: createReadStream(file, 'utf8'), crlfDelay: Infinity });
  let head = null;
  for await (const line of rl) {
    if (!line) continue;
    const cols = parseLine(line);
    if (!head) { head = Object.fromEntries(cols.map((c, i) => [c, i])); continue; }
    const school = cols[head.CODICESCUOLA]?.trim().toUpperCase();
    if (!school || !schools.has(school)) continue;
    const isbn = (cols[head.CODICEISBN] || '').replace(/[^0-9X]/gi, '');
    if (!/^97[89]\d{10}$/.test(isbn)) continue;
    const year = Number(cols[head.ANNOCORSO]);
    const section = (cols[head.SEZIONEANNO] || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3);
    if (!(year >= 1 && year <= 5) || !section) continue;

    let idx = catalogIndex.get(isbn);
    if (idx === undefined) {
      const volume = (cols[head.VOLUME] || '').trim();
      idx = catalog.length;
      catalog.push([
        isbn,
        titleCase(cols[head.TITOLO] || ''),
        titleCase(cols[head.DISCIPLINA] || ''),
        volume && volume !== 'ND' && volume !== 'U' ? volume : '',
        titleCase(cols[head.EDITORE] || ''),
      ]);
      catalogIndex.set(isbn, idx);
    }

    const province = school.slice(0, 2);
    if (!byProvince.has(province)) byProvince.set(province, {});
    const p = byProvince.get(province);
    p[school] ??= {};
    const label = `${year}${section}`;
    p[school][label] ??= [];
    if (!p[school][label].includes(idx)) p[school][label].push(idx);
  }
}

const outDir = path.join(root, 'public', 'textbooks');
mkdirSync(outDir, { recursive: true });
for (const f of readdirSync(outDir)) if (f.endsWith('.json')) unlinkSync(path.join(outDir, f));
writeFileSync(path.join(outDir, 'catalog.json'), JSON.stringify(catalog));
let total = 0;
for (const [province, data] of byProvince) {
  const json = JSON.stringify(data);
  total += json.length;
  writeFileSync(path.join(outDir, `${province}.json`), json);
}
console.log(`Catalog: ${catalog.length} books. Provinces: ${byProvince.size} files, ${(total / 1e6).toFixed(1)} MB.`);
