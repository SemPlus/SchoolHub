// Builds public/schools.json from the Ministry of Education open-data
// registry (https://dati.istruzione.it/opendata/opendata/catalogo/elements1/?area=Scuole).
//
// Usage, once per school year:
//   node scripts/build-schools.mjs SCUANAGRAFESTAT*.csv SCUANAGRAFEPAR*.csv \
//        SCUANAAUTSTAT*.csv SCUANAAUTPAR*.csv
//
// Only lower- and upper-secondary schools are kept. Each school is identified
// by its official code (codice meccanografico), so a school can never be
// entered twice under different spellings.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

function parseCsv(text) {
  const rows = []; let row = []; let field = ''; let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; }
      else field += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c !== '\r') field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

const ROMAN = /^(?=[MDCLXVI])M*(C[MD]|D?C{0,3})(X[CL]|L?X{0,3})(I[XV]|V?I{0,3})$/;
const NOT_ROMAN = new Set(['DI', 'MI', 'CI', 'LI', 'DICI', 'DIVI']);
const ACRONYMS = new Set(['IC', 'IIS', 'IISS', 'ISIS', 'ISISS', 'IS', 'ISS', 'ITIS', 'ITI', 'ITC', 'ITCG', 'ITG', 'ITT', 'ITE', 'ITET', 'ITAS', 'ITA', 'ITSET', 'IPSIA', 'IPSAR', 'IPSSAR', 'IPSEOA', 'IPC', 'IPS', 'IPSS', 'CFP', 'ISA', 'CPIA', 'SMS', 'CTP']);
const LOWER = new Set(['di', 'del', 'della', 'delle', 'dei', 'degli', 'e', 'ed', 'per', 'la', 'il', 'lo', 'le', 'gli', 'in', 'a', 'al', 'alla', 'da', 'con']);

function titleCase(input) {
  const cleaned = input
    .replace(/["“”]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[-,\s]+|[-,\s]+$/g, '');
  return cleaned
    .split(' ')
    .map((word, index, all) => {
      // Treat each part of a hyphenated name on its own (Giovanni XXIII-Capozzi).
      if (/[A-Z]-[A-Z]/i.test(word)) return word.split('-').map(part => part ? titleCase(part) : part).join('-');
      const bare = word.replace(/[^A-Z]/gi, '').toUpperCase();
      // Keep school acronyms such as IIS, ITIS or I.T.C. in capitals.
      if (ACRONYMS.has(bare) && /^[A-Z.]+$/i.test(word)) return word.toUpperCase();
      // A lone I after a lowercase connective is the Italian article, not a numeral.
      if (bare === 'I' && index > 0 && LOWER.has(all[index - 1].toLowerCase())) return 'i';
      if (ROMAN.test(bare) && !NOT_ROMAN.has(bare) && bare.length > 0) return word.toUpperCase();
      const lower = word.toLowerCase();
      if (index > 0 && LOWER.has(lower)) return lower;
      // Elided articles: l'Agricoltura, dell'Arte, d'Azeglio
      const elided = lower.match(/^(l|d|dell|all|nell|sull|un)'(.+)$/);
      if (index > 0 && elided) return elided[1] + "'" + elided[2].charAt(0).toUpperCase() + elided[2].slice(1);
      // Capitalise the first letter and any letter after ' . - " ( /
      return lower.replace(/(^|['.\-(/])([a-zàèéìòù])/g, (_, sep, ch) => sep + ch.toUpperCase());
    })
    .join(' ');
}

function gradeOf(type) {
  if (/PRIMARIA|INFANZIA|COMPRENSIVO|CENTRO TERRITORIALE|CRIA|CONVITTO|EDUCANDATO|ISTITUTO SUPERIORE|Non Disponibile/i.test(type)) return 0;
  if (/PRIMO GRADO/.test(type)) return 1;
  return 2;
}

function typeLabel(type) {
  if (type === 'SCUOLA PRIMO GRADO') return 'Scuola Secondaria di I Grado';
  if (type === 'SCUOLA SEC. PRIMO GRADO NON STATALE') return 'Scuola Secondaria di I Grado (paritaria)';
  if (type === 'SCUOLA SEC. SECONDO GRADO NON STATALE') return 'Scuola Secondaria di II Grado (paritaria)';
  return titleCase(type.replace(/^IST PROF /, 'ISTITUTO PROFESSIONALE ').replace(/^IST TEC(NICO)? /, 'ISTITUTO TECNICO '));
}

const includeMiddle = process.argv.includes('--include-middle');
const files = process.argv.slice(2).filter(a => !a.startsWith('--'));
if (files.length === 0) {
  console.error('Pass the registry CSV files as arguments.');
  process.exit(1);
}

const types = [];
const provinces = [];
const indexOf = (list, value) => {
  let i = list.indexOf(value);
  if (i === -1) { list.push(value); i = list.length - 1; }
  return i;
};

const schools = new Map();
let schoolYear = '';
for (const file of files) {
  const [head, ...rows] = parseCsv(readFileSync(file, 'utf8'));
  const col = (name) => head.indexOf(name);
  const cCode = col('CODICESCUOLA'), cName = col('DENOMINAZIONESCUOLA'), cType = col('DESCRIZIONETIPOLOGIAGRADOISTRUZIONESCUOLA');
  const cCity = col('DESCRIZIONECOMUNE'), cProv = col('PROVINCIA'), cParent = col('DENOMINAZIONEISTITUTORIFERIMENTO');
  const cYear = col('ANNOSCOLASTICO');
  for (const r of rows) {
    if (r.length <= cType) continue;
    const grade = gradeOf(r[cType]);
    // SchoolHub is for upper-secondary students. Pass --include-middle to also
    // keep lower-secondary schools.
    if (grade === 0 || (grade === 1 && !includeMiddle)) continue;
    const code = r[cCode].trim().toUpperCase();
    if (!/^[A-Z0-9]{10}$/.test(code) || schools.has(code)) continue;
    if (!schoolYear && cYear >= 0) schoolYear = r[cYear];
    const name = titleCase(r[cName]);
    const parent = cParent >= 0 && r[cParent] && r[cParent] !== 'Non Disponibile' ? titleCase(r[cParent]) : '';
    const entry = [code, name, indexOf(types, typeLabel(r[cType])), titleCase(r[cCity]), indexOf(provinces, titleCase(r[cProv])), grade];
    if (parent && parent.toLowerCase() !== name.toLowerCase()) entry.push(parent);
    schools.set(code, entry);
  }
}

const out = {
  // Compact format: [code, name, typeIndex, city, provinceIndex, grade(1|2), parentInstitute?]
  source: 'Ministero dell\'Istruzione e del Merito - Anagrafe scuole (open data)',
  schoolYear,
  types,
  provinces,
  schools: [...schools.values()].sort((a, b) => a[1].localeCompare(b[1], 'it')),
};

const target = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'schools.json');
writeFileSync(target, JSON.stringify(out));
console.log(`Wrote ${out.schools.length} schools (${schoolYear}) to ${target}`);
