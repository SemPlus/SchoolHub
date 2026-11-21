import { deleteUser, GoogleAuthProvider, reauthenticateWithPopup } from 'firebase/auth';
import {
  collection, collectionGroup, doc, getDocs, query, serverTimestamp, where,
  type DocumentReference, type Query,
} from 'firebase/firestore';
import { auth, db } from '../firebase';
import { deleteDoc, updateDoc } from './firestoreWrites';
import { forgetUserEmailSignature } from './userEmails';

// "Elimina il mio account" (decided 2026-11-21, see legal/01-informativa-privacy.md):
//   - works made alone are deleted; group works pass to the first co-author,
//     without the person's name; their name comes off other people's group works;
//   - comments, votes, answers, requests, folders, saves, opens, "studied"
//     marks, activity markers, the class directory entry and the private
//     e-mail are deleted;
//   - themes and lots they created stay for the classes, signed "Account eliminato";
//   - reports they made stay up to 12 months (moderation record);
//   - files stay in their own Google Drive.
// The profile gets `deletingAt` first: the rules then let the person remove
// records that are otherwise kept (opens, counted saves, fulfilled requests,
// activity markers). The profile and the sign-in account go last.

/** Name shown on themes and lots whose creator deleted the account. */
export const DELETED_ACCOUNT_NAME = 'Account eliminato';

let running = false;

/** True while an account deletion runs (the app must not recreate the profile). */
export function isAccountDeletionRunning(): boolean {
  return running;
}

export type DeletionStep = 'signin' | 'works' | 'activity' | 'profile' | 'done';

async function each(q: Query, action: (ref: DocumentReference, data: any) => Promise<unknown>): Promise<void> {
  const snapshot = await getDocs(q);
  await Promise.all(snapshot.docs.map(d => action(d.ref, d.data())));
}

export async function deleteMyAccount(onStep: (step: DeletionStep) => void = () => {}): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error('not-signed-in');
  const uid = user.uid;

  // Firebase deletes an account only after a recent sign-in.
  onStep('signin');
  await reauthenticateWithPopup(user, new GoogleAuthProvider());

  running = true;
  try {
    await updateDoc(doc(db, 'users', uid), { deletingAt: serverTimestamp() });

    onStep('works');
    const materials = collection(db, 'materials');
    // Own works: group works pass to the first co-author, the rest are deleted.
    await each(query(materials, where('authorId', '==', uid)), async (ref, m) => {
      const ids: string[] = m.coAuthorIds || [];
      const names: string[] = m.coAuthorNames || [];
      if (ids.length && names[0]) {
        try {
          await updateDoc(ref, {
            authorId: ids[0],
            authorName: names[0],
            authorPhotoUrl: null,
            coAuthorIds: ids.slice(1),
            coAuthorNames: names.slice(1),
          });
          return;
        } catch { /* falls back to deleting it */ }
      }
      await deleteDoc(ref);
    });
    // Other people's group works: take the name off.
    await each(query(materials, where('coAuthorIds', 'array-contains', uid)), (ref, m) => {
      const ids: string[] = m.coAuthorIds || [];
      const names: string[] = m.coAuthorNames || [];
      const i = ids.indexOf(uid);
      return updateDoc(ref, {
        coAuthorIds: ids.filter(id => id !== uid),
        coAuthorNames: names.filter((_, j) => j !== i),
      });
    });
    await each(query(collection(db, 'collections'), where('createdBy', '==', uid)),
      ref => updateDoc(ref, { createdByName: DELETED_ACCOUNT_NAME }));
    await each(query(collection(db, 'folders'), where('authorId', '==', uid)), ref => deleteDoc(ref));
    await each(query(collection(db, 'requests'), where('authorId', '==', uid)), ref => deleteDoc(ref));

    onStep('activity');
    await each(query(collectionGroup(db, 'feedback'), where('userId', '==', uid)), ref => deleteDoc(ref));
    await each(query(collectionGroup(db, 'votes'), where('userId', '==', uid)), ref => deleteDoc(ref));
    await each(query(collectionGroup(db, 'answers'), where('userId', '==', uid)), ref => deleteDoc(ref));
    await each(query(collection(db, 'saves'), where('userId', '==', uid)), ref => deleteDoc(ref));
    await each(query(collection(db, 'opens'), where('userId', '==', uid)), ref => deleteDoc(ref));
    await each(query(collection(db, 'activity'), where('userId', '==', uid)), ref => deleteDoc(ref));
    await each(query(collection(db, 'users', uid, 'studied')), ref => deleteDoc(ref));

    onStep('profile');
    await deleteDoc(doc(db, 'directory', uid));
    await deleteDoc(doc(db, 'userEmails', uid));
    await deleteDoc(doc(db, 'users', uid));
    forgetUserEmailSignature(uid);
    try {
      for (const key of Object.keys(window.localStorage)) {
        if (key.startsWith('schoolhub.')) window.localStorage.removeItem(key);
      }
    } catch { /* storage blocked */ }
    await deleteUser(user);
    onStep('done');
  } catch (error) {
    running = false;
    throw error;
  }
}
