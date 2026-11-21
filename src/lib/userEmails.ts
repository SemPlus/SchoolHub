import { collection, deleteField, doc, getDocs, query, serverTimestamp, where } from 'firebase/firestore';
import { db } from '../firebase';
import type { User } from '../types';
import { setDoc, updateDoc } from './firestoreWrites';

// E-mail addresses are private (decided 2026-11-21): profiles (users/{uid})
// are public for author cards, so the address lives in userEmails/{uid},
// readable by the person, the founder and, for teachers, the admins of their
// school. It also carries the profile's school and account type, which the
// rules use to decide who may read it.

const SIGNATURE_KEY = 'schoolhub.userEmail.';

/**
 * Keeps userEmails/{uid} in step with the profile and removes the e-mail
 * left on old public profiles. Cheap: writes only when something changed.
 */
export async function syncUserEmail(profile: User, email: string | null, emailVerified: boolean): Promise<void> {
  if (!email || !emailVerified) return;
  const entry = {
    email: email.toLowerCase(),
    schoolId: profile.schoolId || '',
    accountType: profile.accountType || '',
  };
  const signature = JSON.stringify(entry);
  const key = SIGNATURE_KEY + profile.uid;
  let known: string | null = null;
  try { known = window.localStorage.getItem(key); } catch { /* storage blocked */ }
  if (known !== signature) {
    await setDoc(doc(db, 'userEmails', profile.uid), { ...entry, updatedAt: serverTimestamp() });
    try { window.localStorage.setItem(key, signature); } catch { /* ignore */ }
  }
  if ('email' in profile && (profile as any).email != null) {
    await updateDoc(doc(db, 'users', profile.uid), { email: deleteField() });
  }
}

export function forgetUserEmailSignature(uid: string): void {
  try { window.localStorage.removeItem(SIGNATURE_KEY + uid); } catch { /* ignore */ }
}

/** E-mails by uid: teachers of a school (school admins), or everyone (founder). */
export async function loadUserEmails(schoolId?: string): Promise<Map<string, string>> {
  const q = schoolId
    ? query(collection(db, 'userEmails'), where('schoolId', '==', schoolId), where('accountType', '==', 'teacher'))
    : query(collection(db, 'userEmails'));
  const snapshot = await getDocs(q);
  return new Map(snapshot.docs.map(d => [d.id, d.data().email as string]));
}
