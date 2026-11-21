// Mixed search, one ordered list (decided 2026-11-21): while someone searches,
// results come from everywhere and are grouped
//   1. the viewer's class (this year's works, plus those inherited from the
//      same grade in earlier years),
//   2. the viewer's school,
//   3. other schools,
// and ordered inside each group by how well they match, then by quality.
import { IT } from './i18n.it';
import { schoolYearStart } from './schoolYear';
import { normalizeText, wordsOf } from './search';

export type SearchGroup = 'class' | 'school' | 'other';
export const SEARCH_GROUPS: SearchGroup[] = ['class', 'school', 'other'];

/** How many works from other schools show before "Mostra altri". */
export const OTHER_SCHOOLS_PAGE = 12;

export interface RankedWork {
  id: string;
  title: string;
  description?: string | null;
  subject?: string | null;
  tags?: string[] | null;
  bookTitle?: string | null;
  className?: string | null;
  schoolName?: string | null;
  schoolId?: string | null;
  classYear?: number | null;
  classSection?: string | null;
  createdAt: Date;
  downloadCount?: number;
  saveCount?: number;
  verifiedBy?: string | null;
}

export interface SearchViewer {
  schoolId?: string | null;
  /** The viewer's classes ("4G"; a teacher has several). */
  classLabels: string[];
  /** Start year of the current school year, e.g. 2026. */
  schoolYear: number;
}

export function searchGroup(m: RankedWork, viewer: SearchViewer): SearchGroup {
  if (!viewer.schoolId || m.schoolId !== viewer.schoolId) return 'other';
  if (m.classYear && viewer.classLabels.length) {
    const year = schoolYearStart(m.createdAt);
    const label = m.classSection ? `${m.classYear}${m.classSection}` : '';
    // This year: the viewer's own class.
    if (year === viewer.schoolYear && viewer.classLabels.includes(label)) return 'class';
    // Earlier years: inherited by the same grade.
    const grades = viewer.classLabels.map(l => Number.parseInt(l, 10));
    if (year < viewer.schoolYear && grades.includes(m.classYear)) return 'class';
  }
  return 'school';
}

/**
 * 0: every word in the title; 1: every word in title, subject, tags, book or
 * class; 2: only with the description or the school's name.
 */
export function matchTier(term: string, m: RankedWork): 0 | 1 | 2 {
  const words = wordsOf(term);
  if (!words.length) return 0;
  const has = (text: string) => {
    const n = normalizeText(text);
    return words.every(w => n.includes(w));
  };
  if (has(m.title)) return 0;
  const subject = m.subject ? `${m.subject} ${IT[m.subject] || ''}` : '';
  if (has([m.title, subject, ...(m.tags || []), m.bookTitle || '', m.className || ''].join(' '))) return 1;
  return 2;
}

/** Best work chosen by a teacher in a lot, or verified: 1; otherwise 0. */
export function isRecognised(m: RankedWork, bestIds: Set<string>): boolean {
  return bestIds.has(m.id) || !!m.verifiedBy;
}

export function popularity(m: RankedWork): number {
  return (m.downloadCount || 0) + 2 * (m.saveCount || 0);
}

/** The order inside a group when no other order is chosen. */
export function compareBySearch(term: string, bestIds: Set<string>) {
  const tiers = new Map<string, number>();
  const tier = (m: RankedWork) => {
    let v = tiers.get(m.id);
    if (v === undefined) { v = matchTier(term, m); tiers.set(m.id, v); }
    return v;
  };
  return (a: RankedWork, b: RankedWork) =>
    tier(a) - tier(b) ||
    Number(isRecognised(b, bestIds)) - Number(isRecognised(a, bestIds)) ||
    popularity(b) - popularity(a) ||
    b.createdAt.getTime() - a.createdAt.getTime();
}

/** Splits an already sorted list into the three groups, keeping the order. */
export function groupResults<T extends RankedWork>(sorted: T[], viewer: SearchViewer): Record<SearchGroup, T[]> {
  const out: Record<SearchGroup, T[]> = { class: [], school: [], other: [] };
  for (const m of sorted) out[searchGroup(m, viewer)].push(m);
  return out;
}
