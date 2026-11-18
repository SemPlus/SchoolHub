import type { Collection, Material } from '../types';
import { schoolYearStart } from './schoolYear';
import { wordsOf } from './search';

// Lots ("lotti"): a teacher's collection where the class hands in works.
//  - "same" topic: the teacher chooses the best work; only that one stays.
//  - "different" topics: every work is its own topic and stays, except the
//    ones the teacher takes out before closing the lot.
// Seven days after a lot closes, the works that were not kept leave the class
// archive, the national archive and the classroom screen. Their authors (and
// co-authors) still see them in My Space; the files stay in their Drive.
// Each theme (the same lot repeated over the years) keeps its latest five
// closed lots; older ones leave the archive the same way.
// Collections created before lots existed (isLot unset) are not affected.

export const RETIRE_AFTER_MS = 7 * 24 * 60 * 60 * 1000;
export const THEME_KEEP = 5;

export type LotType = 'same' | 'different';

export function isLot(c: Collection | null | undefined): boolean {
  return !!c && c.isLot === true;
}

/** Lots repeated over the years share a theme: the id of the first one. */
export function themeKey(c: Collection): string {
  return c.themeId || c.id;
}

export function isClosed(c: Collection): boolean {
  return isLot(c) && !!c.closedAt;
}

/** When the works that were not kept leave the archive. */
export function retireDate(c: Collection): Date | null {
  return isClosed(c) ? new Date(c.closedAt!.getTime() + RETIRE_AFTER_MS) : null;
}

/** Works a closed lot passes on to the classes that come after. */
export function keptWorks(c: Collection, works: Material[]): Material[] {
  if (!isClosed(c)) return works;
  if ((c.lotType || 'same') === 'same') return works.filter(w => w.id === c.winnerMaterialId);
  const removed = new Set(c.removedMaterialIds || []);
  return works.filter(w => !removed.has(w.id));
}

/** Works that have left the archive (visible only to their authors). */
export function retiredMaterialIds(collections: Collection[], materials: Material[], now = Date.now()): Set<string> {
  const retired = new Set<string>();
  const lots = collections.filter(c => isLot(c) && !c.isDeleted);
  if (lots.length === 0) return retired;

  const worksBy = new Map<string, Material[]>();
  for (const m of materials) {
    if (!m.collectionId || m.isDeleted) continue;
    const list = worksBy.get(m.collectionId);
    if (list) list.push(m); else worksBy.set(m.collectionId, [m]);
  }

  // Works not kept, once the grace period is over.
  for (const c of lots) {
    const at = retireDate(c);
    if (!at || now < at.getTime()) continue;
    const works = worksBy.get(c.id) || [];
    const kept = new Set(keptWorks(c, works).map(w => w.id));
    works.forEach(w => { if (!kept.has(w.id)) retired.add(w.id); });
  }

  // Each theme keeps its latest THEME_KEEP closed lots.
  const themes = new Map<string, Collection[]>();
  for (const c of lots) {
    if (!isClosed(c)) continue;
    const key = themeKey(c);
    const list = themes.get(key);
    if (list) list.push(c); else themes.set(key, [c]);
  }
  for (const list of themes.values()) {
    if (list.length <= THEME_KEEP) continue;
    list.sort((a, b) => b.closedAt!.getTime() - a.closedAt!.getTime());
    for (const old of list.slice(THEME_KEEP)) (worksBy.get(old.id) || []).forEach(w => retired.add(w.id));
  }
  return retired;
}

/** True for the person who published a work and the classmates added to it. */
export function isAuthorOf(m: Material, uid: string | null | undefined): boolean {
  return !!uid && (m.authorId === uid || (m.coAuthorIds || []).includes(uid));
}

/** "Giulia R., Marco T. and Sara L." */
export function authorsLine(m: Material, and: string): string {
  const names = [m.authorName, ...(m.coAuthorNames || [])].filter(Boolean);
  if (names.length <= 1) return names[0] || '';
  return `${names.slice(0, -1).join(', ')} ${and} ${names[names.length - 1]}`;
}

/**
 * Lots of earlier school years that look like the same theme as a new one:
 * same school, same class year and subject, ranked by words in common.
 * One suggestion per theme (its most recent lot).
 */
export function themeSuggestions(
  collections: Collection[],
  draft: { schoolId?: string | null; classYear?: number | null; subject?: string | null; title: string },
  limit = 3,
): Collection[] {
  if (!draft.schoolId || !draft.classYear) return [];
  const year = schoolYearStart();
  const words = new Set(wordsOf(draft.title).filter(w => w.length >= 4));
  const latestPerTheme = new Map<string, Collection>();
  for (const c of collections) {
    if (!isLot(c) || c.isDeleted || c.schoolId !== draft.schoolId || c.classYear !== draft.classYear) continue;
    if (draft.subject && c.subject !== draft.subject) continue;
    if (schoolYearStart(c.createdAt) >= year) continue;
    const key = themeKey(c);
    const current = latestPerTheme.get(key);
    if (!current || c.createdAt > current.createdAt) latestPerTheme.set(key, c);
  }
  const score = (c: Collection) => wordsOf(c.title).filter(w => words.has(w)).length;
  return [...latestPerTheme.values()]
    .map(c => ({ c, s: score(c) }))
    .filter(x => words.size === 0 || x.s > 0)
    .sort((a, b) => b.s - a.s || b.c.createdAt.getTime() - a.c.createdAt.getTime())
    .slice(0, limit)
    .map(x => x.c);
}
