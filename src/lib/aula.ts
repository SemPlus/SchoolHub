import { doc, getDoc, serverTimestamp } from 'firebase/firestore';
import { setDoc } from './firestoreWrites';
import { db } from '../firebase';
import { schoolYearStart } from './schoolYear';
import { toDate } from './utils';

// Classroom mode ("modalità aula"): a fixed link per class, set once a year
// as the start page of the classroom PC or LIM. It opens the class archive
// with no sign-in, so it also works on PCs that wipe themselves on restart.
// Only schools activated by the founder (paying private schools and the
// three state partner schools) can use it.

export const AULA_PREFIX = '/aula/';

export interface AulaTarget {
  schoolId: string;
  classLabel: string;
  classYear: number;
  classSection: string;
}

/** "/aula/RMPC12000X-4G" → school and class, or null if the link is malformed. */
export function parseAulaPath(pathname: string): AulaTarget | null {
  if (!pathname.startsWith(AULA_PREFIX)) return null;
  const slug = decodeURIComponent(pathname.slice(AULA_PREFIX.length)).replace(/\/+$/, '').toUpperCase();
  const match = /^([A-Z0-9]{6,16})-([1-5])([A-Z]{1,3})$/.exec(slug);
  if (!match) return null;
  return { schoolId: match[1], classLabel: `${match[2]}${match[3]}`, classYear: Number(match[2]), classSection: match[3] };
}

export function aulaPath(schoolId: string, classLabel: string): string {
  return `${AULA_PREFIX}${schoolId.toUpperCase()}-${classLabel.toUpperCase()}`;
}

export function aulaUrl(schoolId: string, classLabel: string): string {
  return `${window.location.origin}${aulaPath(schoolId, classLabel)}`;
}

export type SchoolPlan = 'private' | 'partner';

/** schools/{schoolId}: written by the founder only. */
export interface SchoolActivation {
  id: string;
  activated: boolean;
  plan: SchoolPlan;
  name: string;
  city?: string;
  activatedUntil: Date | null;
  /** Classes added by hand, e.g. ["1A", "4G"]. */
  extraClasses: string[];
  /** Staff e-mail domains: teachers signing up with them are confirmed at once (max 3). */
  teacherDomains: string[];
}

export function mapActivationDoc(id: string, data: any): SchoolActivation {
  return {
    id,
    activated: data.activated === true,
    plan: data.plan === 'partner' ? 'partner' : 'private',
    name: data.name || id,
    city: data.city || '',
    activatedUntil: toDate(data.activatedUntil),
    extraClasses: Array.isArray(data.extraClasses) ? data.extraClasses : [],
    teacherDomains: Array.isArray(data.teacherDomains) ? data.teacherDomains : [],
  };
}

export function isActive(activation: SchoolActivation | null): boolean {
  if (!activation?.activated) return false;
  return !activation.activatedUntil || activation.activatedUntil.getTime() > Date.now();
}

/** 31 August at the end of the current school year. */
export function endOfSchoolYear(): Date {
  return new Date(schoolYearStart() + 1, 7, 31, 23, 59, 59);
}

export async function loadActivation(schoolId: string): Promise<SchoolActivation | null> {
  const snapshot = await getDoc(doc(db, 'schools', schoolId));
  return snapshot.exists() ? mapActivationDoc(snapshot.id, snapshot.data()) : null;
}

const VISIT_KEY = 'schoolhub.aulaVisit';
const VISIT_EVERY_MS = 60 * 60 * 1000;

/** "Last used" for the school's classroom list: at most one small write an hour per device. */
export function recordAulaVisit(target: AulaTarget): void {
  const key = `${VISIT_KEY}.${target.schoolId}-${target.classLabel}`;
  try {
    const last = Number(window.localStorage.getItem(key) || 0);
    if (Date.now() - last < VISIT_EVERY_MS) return;
    window.localStorage.setItem(key, String(Date.now()));
  } catch {
    // Storage may be blocked on school PCs; then every load counts, which is fine.
  }
  setDoc(doc(db, 'aulaVisits', `${target.schoolId}_${target.classLabel}`), {
    schoolId: target.schoolId,
    classLabel: target.classLabel,
    lastSeenAt: serverTimestamp(),
  }).catch(error => console.warn('Could not record classroom visit:', error));
}

/** The link to present a file full screen: Slides in presentation mode, other files in preview. */
export function presentUrlFor(url: string): string {
  try {
    const u = new URL(url);
    if (u.hostname === 'docs.google.com') {
      const slides = /^\/presentation\/d\/([^/]+)/.exec(u.pathname)?.[1];
      if (slides) return `https://docs.google.com/presentation/d/${slides}/present`;
      const docMatch = /^\/(document|spreadsheets)\/d\/([^/]+)/.exec(u.pathname);
      if (docMatch) return `https://docs.google.com/${docMatch[1]}/d/${docMatch[2]}/preview`;
    }
    if (u.hostname === 'drive.google.com') {
      const id = /^\/file\/d\/([^/]+)/.exec(u.pathname)?.[1] || u.searchParams.get('id');
      if (id) return `https://drive.google.com/file/d/${id}/preview`;
    }
  } catch {
    // Not a URL: open as it is.
  }
  return url;
}
