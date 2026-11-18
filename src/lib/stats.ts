import type { Collection, Material, MaterialRequest } from '../types';

/**
 * Impact rewards help, not volume. Every input is protected by the security
 * rules: opens and saves only count once per other user, accepted answers
 * need the requester's approval, and only teachers can verify.
 */
export const IMPACT_POINTS = {
  open: 1,
  save: 2,
  acceptedAnswer: 5,
  verified: 10,
  bestWork: 15,
} as const;

export interface UserStats {
  uploads: number;
  opensReceived: number;
  savesReceived: number;
  answersAccepted: number;
  verified: number;
  /** Works voted best in a collection. */
  bestWorks: number;
  impact: number;
}

export const EMPTY_STATS: UserStats = {
  uploads: 0,
  opensReceived: 0,
  savesReceived: 0,
  answersAccepted: 0,
  verified: 0,
  bestWorks: 0,
  impact: 0,
};

export function computeStats(materials: Material[], requests: MaterialRequest[], collections: Collection[] = []): Record<string, UserStats> {
  const stats: Record<string, UserStats> = {};
  const get = (uid: string) => (stats[uid] ??= { ...EMPTY_STATS });

  for (const material of materials) {
    if (material.isDeleted || !material.authorId) continue;
    // Group works count for every member of the group.
    for (const uid of new Set([material.authorId, ...(material.coAuthorIds || [])])) {
      const s = get(uid);
      s.uploads += 1;
      s.opensReceived += material.downloadCount || 0;
      s.savesReceived += material.saveCount || 0;
      if (material.verifiedBy) s.verified += 1;
    }
  }

  for (const request of requests) {
    if (request.status === 'fulfilled' && request.acceptedUserId && request.acceptedUserId !== request.authorId) {
      get(request.acceptedUserId).answersAccepted += 1;
    }
  }

  for (const c of collections) {
    if (c.winnerAuthorId && c.winnerAuthorId !== c.createdBy) get(c.winnerAuthorId).bestWorks += 1;
  }

  for (const s of Object.values(stats)) {
    s.impact =
      s.opensReceived * IMPACT_POINTS.open +
      s.savesReceived * IMPACT_POINTS.save +
      s.answersAccepted * IMPACT_POINTS.acceptedAnswer +
      s.verified * IMPACT_POINTS.verified +
      s.bestWorks * IMPACT_POINTS.bestWork;
  }

  return stats;
}
