import { collection, doc, getDoc, increment, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import type { User } from '../types';
import { isActive, loadActivation } from './aula';

// The school panel ("pannello della scuola"): what a principal sees for their
// own school. Only numbers per class and per subject, never what a single
// student did. Up to three school admins per school, named by the founder.

/** schoolAdmins/{email}: one school per admin e-mail (lower case). */
export const MAX_SCHOOL_ADMINS = 3;

export interface SchoolAdmin {
  email: string;
  schoolId: string;
  schoolName: string;
}

export function adminKey(email: string): string {
  return email.trim().toLowerCase();
}

/** The school this e-mail administers, if any. */
export async function loadAdminSchoolId(email: string | null | undefined): Promise<string | null> {
  if (!email) return null;
  const snapshot = await getDoc(doc(db, 'schoolAdmins', adminKey(email)));
  return snapshot.exists() ? (snapshot.data().schoolId as string) || null : null;
}

// ------------------------------------------------------------ weekly activity

// Weeks are numbered from Monday 5 January 1970 (UTC), the same way the
// database rules compute them, so a count can only go to the current week.
const FIRST_MONDAY_MS = 4 * 86_400_000;
const WEEK_MS = 7 * 86_400_000;

export function weekIndex(date: Date | number = Date.now()): number {
  const ms = typeof date === 'number' ? date : date.getTime();
  return Math.floor((ms - FIRST_MONDAY_MS) / WEEK_MS);
}

/** Monday of a week, for labels. */
export function weekDate(week: number): Date {
  return new Date(FIRST_MONDAY_MS + week * WEEK_MS);
}

/**
 * Where an active person is counted: their class ("4G"), "teachers", or
 * "other" for a student without a class. Must match the database rules.
 */
export function activityBucket(profile: User): string {
  if (profile.accountType === 'teacher') return 'teachers';
  if (typeof profile.classYear === 'number' && typeof profile.classSection === 'string' && profile.classSection) {
    return `${profile.classYear}${profile.classSection}`;
  }
  return 'other';
}

/** schoolWeeks/{schoolId}_{week}: counts only, e.g. { total: 40, n_4G: 21, n_teachers: 3 }. */
export interface SchoolWeek {
  week: number;
  total: number;
  counts: Record<string, number>;
}

export function mapSchoolWeek(data: any): SchoolWeek {
  const counts: Record<string, number> = {};
  for (const [key, value] of Object.entries(data || {})) {
    if (key.startsWith('n_') && typeof value === 'number') counts[key.slice(2)] = value;
  }
  return { week: Number(data.week), total: Number(data.total) || 0, counts };
}

/** Students active in a week (everyone counted except teachers). */
export function studentsActive(week: SchoolWeek | undefined): number {
  if (!week) return 0;
  return Math.max(0, week.total - (week.counts.teachers || 0));
}

const ACTIVITY_KEY = 'schoolhub.activity.';

/**
 * Counts this user once a week for their school, if the school is activated.
 * A private marker (activity/{week}_{uid}, readable only by the user) makes
 * sure nobody is counted twice; the school only sees the totals.
 */
export async function recordWeeklyActivity(uid: string, profile: User): Promise<void> {
  if (!profile.schoolId) return;
  const week = weekIndex();
  const key = ACTIVITY_KEY + uid;
  try {
    if (window.localStorage.getItem(key) === String(week)) return;
  } catch { /* storage blocked: the marker still stops double counting */ }
  const remember = () => { try { window.localStorage.setItem(key, String(week)); } catch { /* ignore */ } };

  const activation = await loadActivation(profile.schoolId).catch(() => null);
  if (!isActive(activation)) return remember();

  const bucket = activityBucket(profile);
  const batch = writeBatch(db);
  batch.set(doc(db, 'activity', `${week}_${uid}`), {
    userId: uid,
    schoolId: profile.schoolId,
    week,
    bucket,
    createdAt: serverTimestamp(),
  });
  batch.set(doc(collection(db, 'schoolWeeks'), `${profile.schoolId}_${week}`), {
    schoolId: profile.schoolId,
    week,
    total: increment(1),
    [`n_${bucket}`]: increment(1),
    updatedAt: serverTimestamp(),
  }, { merge: true });
  try {
    await batch.commit();
  } catch (error: any) {
    // Already counted this week from another device: the marker exists.
    if (error?.code !== 'permission-denied') throw error;
  }
  remember();
}
