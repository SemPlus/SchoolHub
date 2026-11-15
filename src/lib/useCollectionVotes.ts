import { useEffect, useMemo, useState } from 'react';
import { collection as fsCollection, deleteDoc, doc, onSnapshot, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import type { Collection, CollectionVote, Material } from '../types';
import { toDate } from './utils';

import { t } from './i18n';
/**
 * Live votes for the best work in a collection. One vote per person (the
 * document id is their uid); changing your mind moves your vote.
 */
export function useCollectionVotes(collectionId: string | null) {
  const [votes, setVotes] = useState<CollectionVote[]>([]);

  useEffect(() => {
    setVotes([]);
    if (!collectionId) return;
    const unsubscribe = onSnapshot(fsCollection(db, 'collections', collectionId, 'votes'), (snapshot) => {
      setVotes(snapshot.docs.map(d => ({ id: d.id, ...(d.data() as any), createdAt: toDate(d.data().createdAt) ?? new Date() })));
    }, (error) => console.error('Votes snapshot error:', error));
    return () => unsubscribe();
  }, [collectionId]);

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const v of votes) map.set(v.materialId, (map.get(v.materialId) || 0) + 1);
    return map;
  }, [votes]);

  const myVote = votes.find(v => v.userId === auth.currentUser?.uid)?.materialId ?? null;

  return { votes, counts, myVote };
}

export async function castVote(collectionId: string, material: Material, hasVoted: boolean): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error(t("Sign in to vote."));
  const ref = doc(db, 'collections', collectionId, 'votes', user.uid);
  if (hasVoted) {
    await updateDoc(ref, { materialId: material.id });
  } else {
    await setDoc(ref, { userId: user.uid, materialId: material.id, createdAt: serverTimestamp() });
  }
}

export async function withdrawVote(collectionId: string): Promise<void> {
  const user = auth.currentUser;
  if (!user) return;
  await deleteDoc(doc(db, 'collections', collectionId, 'votes', user.uid));
}

/** Most votes wins; a tie goes to the work handed in first. */
export function leadingWork(works: Material[], counts: Map<string, number>): Material | null {
  let best: Material | null = null;
  let bestCount = 0;
  for (const work of works) {
    const count = counts.get(work.id) || 0;
    if (count > bestCount) {
      best = work;
      bestCount = count;
    }
  }
  return best;
}

export async function announceWinner(collection: Collection, winner: Material): Promise<void> {
  await updateDoc(doc(db, 'collections', collection.id), {
    winnerMaterialId: winner.id,
    winnerAuthorId: winner.authorId,
    winnerAuthorName: winner.authorName.slice(0, 100),
    updatedAt: serverTimestamp(),
  });
}
