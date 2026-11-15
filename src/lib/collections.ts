import { collection as fsCollection, serverTimestamp } from 'firebase/firestore';
import { addDoc } from './firestoreWrites';
import { auth, db } from '../firebase';
import type { Collection, Material, User } from '../types';
import { classIdFor, formatClassName } from './schoolYear';
import type { PickedSchool } from '../components/SchoolPicker';

import { t } from './i18n';
export interface NewCollectionInput {
  title: string;
  description?: string;
  subject?: string;
  school: PickedSchool | null;
  classYear?: number;
  classSection?: string;
  /** Hand-in deadline (teachers). */
  dueAt?: Date | null;
}

export async function createCollection(input: NewCollectionInput): Promise<string> {
  const user = auth.currentUser;
  if (!user) throw new Error(t("Sign in first."));
  const hasClass = !!input.school && !!input.classYear && !!input.classSection;
  const ref = await addDoc(fsCollection(db, 'collections'), {
    title: input.title.trim(),
    description: input.description?.trim() || null,
    subject: input.subject || null,
    schoolId: input.school?.id || null,
    schoolName: input.school?.name || null,
    classYear: hasClass ? input.classYear : null,
    classSection: hasClass ? input.classSection : null,
    className: hasClass ? formatClassName(input.classYear, input.classSection) : null,
    classId: hasClass ? classIdFor(input.school?.id, input.classYear, input.classSection) : null,
    createdBy: user.uid,
    createdByName: user.displayName || 'Student',
    createdAt: serverTimestamp(),
    isDeleted: false,
    isHandIn: !!input.dueAt,
    dueAt: input.dueAt || null,
  });
  return ref.id;
}

/** Works in a collection, newest last so the order reads like a gallery. */
export function worksIn(collectionId: string, materials: Material[]): Material[] {
  return materials
    .filter(m => m.collectionId === collectionId && !m.isDeleted)
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
}

/**
 * How close something is to the viewer: 0 = one of my classes this year,
 * 1 = my grade at my school, 2 = my school, 3 = elsewhere. Used to show the
 * viewer's own class first.
 */
export function relevanceTier(
  item: { schoolId?: string | null; classYear?: number | null; classSection?: string | null },
  profile: User | null,
  myClassLabels: string[]
): number {
  if (!profile?.schoolId || item.schoolId !== profile.schoolId) return 3;
  const label = item.classYear && item.classSection ? `${item.classYear}${item.classSection}` : '';
  if (label && myClassLabels.includes(label)) return 0;
  const myYears = myClassLabels.map(l => Number(l[0]));
  if (item.classYear && myYears.includes(item.classYear)) return 1;
  return 2;
}

export function sortCollectionsForViewer(collections: Collection[], profile: User | null, myClassLabels: string[]): Collection[] {
  return [...collections].sort((a, b) =>
    relevanceTier(a, profile, myClassLabels) - relevanceTier(b, profile, myClassLabels) ||
    b.createdAt.getTime() - a.createdAt.getTime()
  );
}

/** True when a work was added after the hand-in deadline. */
export function isLate(work: Material, collection: Collection): boolean {
  return !!collection.dueAt && work.createdAt.getTime() > collection.dueAt.getTime();
}
