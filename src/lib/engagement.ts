import { doc, getDoc, increment, serverTimestamp, updateDoc, writeBatch } from 'firebase/firestore';
import { auth, db } from '../firebase';
import type { Material } from '../types';

// Opens and saves are counted together with a per-user record in one batch.
// The security rules only accept the counter change when that record is
// created (or removed) in the same write, so each user counts at most once
// and signed-out visitors or the author never count.

const openId = (uid: string, materialId: string) => `${uid}_${materialId}`;
const saveId = (uid: string, materialId: string) => `${uid}_${materialId}`;

/** Records a unique open. Never throws: opening the link must not depend on it. */
export async function recordOpen(material: Material): Promise<void> {
  const user = auth.currentUser;
  if (!user || user.uid === material.authorId || material.isDeleted) return;
  try {
    const openRef = doc(db, 'opens', openId(user.uid, material.id));
    const existing = await getDoc(openRef);
    if (existing.exists()) return;
    const batch = writeBatch(db);
    batch.set(openRef, {
      userId: user.uid,
      materialId: material.id,
      createdAt: serverTimestamp(),
    });
    batch.update(doc(db, 'materials', material.id), { downloadCount: increment(1) });
    await batch.commit();
  } catch (error) {
    console.warn('Could not record open:', error);
  }
}

/** Saves or unsaves a material for the signed-in user. Throws on failure. */
export async function toggleSave(material: Material, currentlySaved: boolean): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error('Sign in to save materials.');
  const saveRef = doc(db, 'saves', saveId(user.uid, material.id));
  const materialRef = doc(db, 'materials', material.id);
  const batch = writeBatch(db);

  if (!currentlySaved) {
    const counted = user.uid !== material.authorId;
    batch.set(saveRef, {
      userId: user.uid,
      materialId: material.id,
      counted,
      createdAt: serverTimestamp(),
    });
    if (counted) batch.update(materialRef, { saveCount: increment(1) });
  } else {
    const existing = await getDoc(saveRef);
    if (!existing.exists()) return;
    batch.delete(saveRef);
    if (existing.data()?.counted === true) batch.update(materialRef, { saveCount: increment(-1) });
  }

  await batch.commit();
}

/** Teacher or admin verification. Pass verify=false to remove it. */
export async function setVerified(material: Material, verify: boolean): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error('Sign in first.');
  await updateDoc(doc(db, 'materials', material.id), verify
    ? { verifiedBy: user.uid, verifiedByName: user.displayName || 'Teacher', verifiedAt: serverTimestamp() }
    : { verifiedBy: null, verifiedByName: null, verifiedAt: null });
}

/** Readable message for a Firebase error. */
export function firebaseErrorMessage(error: any, fallback: string): string {
  const code: string | undefined = error?.code;
  if (code === 'permission-denied') return `${fallback} You do not have permission for this action.`;
  if (code === 'unavailable') return `${fallback} The database could not be reached. Check your connection.`;
  return `${fallback} ${error?.message || ''}`.trim();
}
