// Textbooks adopted by each class, from the Ministry of Education open data
// (built by scripts/build-textbooks.mjs). A material tagged with a book's ISBN
// is useful to every class in Italy that uses the same book.

export interface Textbook {
  isbn: string;
  title: string;
  /** The Ministry's subject name, e.g. "Lingua e Letteratura Italiana". */
  discipline: string;
  volume: string;
  publisher: string;
  /** The matching SchoolHub subject, when there is one. */
  subject?: string;
}

let catalogPromise: Promise<Textbook[]> | null = null;
const provinceCache = new Map<string, Promise<Record<string, Record<string, number[]>>>>();

const DISCIPLINE_RULES: [RegExp, string][] = [
  [/scienze naturali|scienze integrate|biologia|scienze della terra/i, 'Natural Sciences'],
  [/italian/i, 'Italian'],
  [/latin/i, 'Latin'],
  [/grec/i, 'Ancient Greek'],
  [/inglese/i, 'English'],
  [/francese/i, 'French'],
  [/spagnol/i, 'Spanish'],
  [/tedesc/i, 'German'],
  [/storia dell.arte|disegno|arte|discipline pittoriche|discipline plastiche/i, 'Art & Art History'],
  [/musica|teoria, analisi|esecuzione/i, 'Music'],
  [/filosofia/i, 'Philosophy'],
  [/matematica/i, 'Mathematics'],
  [/fisica/i, 'Physics'],
  [/chimica/i, 'Chemistry'],
  [/informatica/i, 'Computer Science'],
  [/economia aziendale|tecniche amministrative|marketing/i, 'Business'],
  [/diritto|economia/i, 'Law & Economics'],
  [/scienze umane|psicologia|pedagogia|sociologia|antropologia/i, 'Human Sciences'],
  [/motorie|sportive/i, 'Physical Education'],
  [/religione/i, 'Religion'],
  [/educazione civica|cittadinanza/i, 'Civic Education'],
  [/geografia/i, 'Geography'],
  [/storia/i, 'History'],
  [/tecnologi|laboratori|elettr|meccanic|costruzion|navigazione|enogastronom|alimentazione/i, 'Technical Subjects'],
];

export function subjectForDiscipline(discipline: string): string | undefined {
  return DISCIPLINE_RULES.find(([re]) => re.test(discipline))?.[1];
}

export function loadCatalog(): Promise<Textbook[]> {
  if (!catalogPromise) {
    catalogPromise = fetch('/textbooks/catalog.json')
      .then(r => {
        if (!r.ok) throw new Error(`Could not load textbooks (HTTP ${r.status}).`);
        return r.json() as Promise<[string, string, string, string, string][]>;
      })
      .then(rows => rows.map(([isbn, title, discipline, volume, publisher]) => ({
        isbn, title, discipline, volume, publisher, subject: subjectForDiscipline(discipline),
      })))
      .catch(error => {
        catalogPromise = null;
        throw error;
      });
  }
  return catalogPromise;
}

function loadProvince(province: string) {
  if (!provinceCache.has(province)) {
    provinceCache.set(province, fetch(`/textbooks/${province}.json`)
      .then(r => (r.ok ? r.json() : {}))
      .catch(() => {
        provinceCache.delete(province);
        return {};
      }));
  }
  return provinceCache.get(province)!;
}

/** Books adopted by a class, e.g. booksForClass('RMPS12345X', '3B'). */
export async function booksForClass(schoolId: string, classLabel: string): Promise<Textbook[]> {
  if (!schoolId || !classLabel) return [];
  const [catalog, province] = await Promise.all([loadCatalog(), loadProvince(schoolId.slice(0, 2).toUpperCase())]);
  const indexes = province[schoolId]?.[classLabel] || [];
  return indexes.map(i => catalog[i]).filter(Boolean);
}

/** Short label for chips: "Title · vol. 2". */
export function bookLabel(book: Pick<Textbook, 'title' | 'volume'>): string {
  return book.volume ? `${book.title} · vol. ${book.volume}` : book.title;
}
