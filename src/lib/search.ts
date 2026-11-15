import { IT } from './i18n.it';

// Search across schools without a search service: every material stores the
// prefixes of the words in its title, tags, subject and textbook
// (`keywords`), so one `array-contains` query finds it while someone types.

/** Longest prefix stored per word; longer typed words are cut to this. */
const MAX_PREFIX = 15;
/** Shortest prefix stored (and searched). */
const MIN_PREFIX = 3;
/** Rules allow up to 300 entries; title words come first so they survive the cut. */
const MAX_KEYWORDS = 300;

/** Lower case, without accents: "Perché" → "perche". */
export function normalizeText(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** Words of two or more letters or digits. */
export function wordsOf(text: string | null | undefined): string[] {
  if (!text) return [];
  return normalizeText(text).split(/[^a-z0-9]+/).filter(w => w.length >= 2);
}

export interface Searchable {
  title: string;
  tags?: string[] | null;
  subject?: string | null;
  bookTitle?: string | null;
  className?: string | null;
}

/** The `keywords` field for a material. */
export function keywordsFor(m: Searchable): string[] {
  const out = new Set<string>();
  const add = (text: string | null | undefined) => {
    for (const w of wordsOf(text)) {
      const word = w.slice(0, MAX_PREFIX);
      for (let i = Math.min(MIN_PREFIX, word.length); i <= word.length; i++) out.add(word.slice(0, i));
    }
  };
  add(m.title);
  (m.tags || []).forEach(add);
  add(m.subject);
  if (m.subject) add(IT[m.subject]);
  add(m.bookTitle);
  add(m.className);
  return [...out].slice(0, MAX_KEYWORDS);
}

/** True when the stored keywords are missing or out of date. */
export function keywordsStale(m: Searchable & { keywords?: string[] | null }): boolean {
  const want = keywordsFor(m);
  const have = m.keywords || [];
  return want.length !== have.length || want.some((k, i) => have[i] !== k);
}

/** The word to send to the database: the longest one typed, or null if too short. */
export function searchToken(term: string): string | null {
  const words = wordsOf(term).sort((a, b) => b.length - a.length);
  const best = words[0];
  if (!best || best.length < MIN_PREFIX) return null;
  return best.slice(0, MAX_PREFIX);
}

/** Every typed word appears somewhere in the text (accents and case ignored). */
export function matchesAllWords(term: string, haystack: string): boolean {
  const words = wordsOf(term);
  if (words.length === 0) return true;
  const text = normalizeText(haystack);
  return words.every(w => text.includes(w));
}
