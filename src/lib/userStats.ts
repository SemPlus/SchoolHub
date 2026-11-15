import { useEffect, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { mapCollectionDoc, mapMaterialDoc, mapRequestDoc } from './mappers';
import { computeStats, EMPTY_STATS, type UserStats } from './stats';

// The app only keeps the user's own school loaded, so impact computed from
// it misses work done elsewhere. This reads one person's full record with
// three small queries, cached for a few minutes. (With server code from
// February, impact can be stored on the profile instead.)

const CACHE_MS = 5 * 60_000;
const cache = new Map<string, { at: number; version: unknown; stats: UserStats }>();

async function loadStats(uid: string): Promise<UserStats> {
  const [materials, requests, collections] = await Promise.all([
    getDocs(query(collection(db, 'materials'), where('authorId', '==', uid))),
    getDocs(query(collection(db, 'requests'), where('acceptedUserId', '==', uid))),
    getDocs(query(collection(db, 'collections'), where('winnerAuthorId', '==', uid))),
  ]);
  const stats = computeStats(
    materials.docs.map(d => mapMaterialDoc(d.id, d.data())),
    requests.docs.map(d => mapRequestDoc(d.id, d.data())),
    collections.docs.map(d => mapCollectionDoc(d.id, d.data())).filter(c => !c.isDeleted),
  );
  return stats[uid] || EMPTY_STATS;
}

/**
 * One person's full impact record, or null while loading. Pass a `version`
 * that changes when their record may have changed to read it again.
 */
export function useUserStats(uid: string | null | undefined, version?: unknown): UserStats | null {
  const cached = uid ? cache.get(uid) : undefined;
  const fresh = cached && Date.now() - cached.at < CACHE_MS && cached.version === version;
  const [stats, setStats] = useState<UserStats | null>(fresh ? cached!.stats : null);

  useEffect(() => {
    if (!uid) { setStats(null); return; }
    const hit = cache.get(uid);
    if (hit && Date.now() - hit.at < CACHE_MS && hit.version === version) {
      setStats(hit.stats);
      return;
    }
    if (hit) setStats(hit.stats);
    let cancelled = false;
    loadStats(uid)
      .then(result => {
        cache.set(uid, { at: Date.now(), version, stats: result });
        if (!cancelled) setStats(result);
      })
      .catch(error => console.error('Could not load impact:', error));
    return () => { cancelled = true; };
  }, [uid, version]);

  return stats;
}
