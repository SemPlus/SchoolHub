// Reports and school moderation.
//
// Anyone signed in can report a work, a comment or a request (once each).
// - reports/{targetKey}_{uid}: the report itself, readable only by its author
//   and the founder (the school never sees who reported).
// - The target keeps a public reportCount and, once hidden, modStatus.
// - moderation/{targetKey}: what the school's admins see, counts per reason
//   and the notes, without names.
// Three reports from different people hide the content until someone decides;
// one copyright report from a teacher hides it at once. All three writes go in
// one transaction and the database rules check each other's numbers.
import { arrayUnion, doc, getDoc, increment, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { runTransaction, writeBatch } from './firestoreWrites';
import { toDate } from './utils';

export const REPORT_REASONS = ['copyright', 'offensive', 'personal', 'broken', 'other'] as const;
export type ReportReason = typeof REPORT_REASONS[number];

/** English keys for t(). */
export const REASON_LABELS: Record<ReportReason, string> = {
  copyright: 'Copyright (a book or protected material)',
  offensive: 'Offensive or inappropriate',
  personal: 'Personal data of someone',
  broken: 'Broken link or wrong file',
  other: 'Other',
};

export const REASON_SHORT: Record<ReportReason, string> = {
  copyright: 'copyright',
  offensive: 'offensive',
  personal: 'personal data',
  broken: 'broken link',
  other: 'other',
};

export const HIDE_AFTER = 3;
export const NOTE_MAX = 300;
export const NOTES_MAX = 50;

export type ModStatus = 'hidden' | 'removed';

/** The moderation fields every reportable document can carry. */
export interface Moderated {
  reportCount?: number;
  modStatus?: ModStatus | null;
  modReason?: ReportReason | null;
}

export type ReportTarget =
  | { kind: 'material'; materialId: string }
  | { kind: 'comment'; materialId: string; commentUserId: string }
  | { kind: 'request'; requestId: string };

export function targetKey(target: ReportTarget): string {
  if (target.kind === 'material') return `m_${target.materialId}`;
  if (target.kind === 'request') return `r_${target.requestId}`;
  return `c_${target.materialId}_${target.commentUserId}`;
}

function targetRef(target: ReportTarget) {
  if (target.kind === 'material') return doc(db, 'materials', target.materialId);
  if (target.kind === 'request') return doc(db, 'requests', target.requestId);
  return doc(db, 'materials', target.materialId, 'feedback', target.commentUserId);
}

function targetId(target: ReportTarget): string {
  return target.kind === 'request' ? target.requestId : target.materialId;
}

export function isModHidden(item: Moderated | null | undefined): boolean {
  return item?.modStatus === 'hidden' || item?.modStatus === 'removed';
}

/** Has this user already reported the target? */
export async function hasReported(target: ReportTarget, uid: string): Promise<boolean> {
  const snapshot = await getDoc(doc(db, 'reports', `${targetKey(target)}_${uid}`));
  return snapshot.exists();
}

/**
 * Files one report. `canHideAtOnce` is true for confirmed teachers.
 * Returns true when the content is now hidden.
 */
export async function submitReport(params: {
  target: ReportTarget;
  reason: ReportReason;
  note: string;
  reporter: { uid: string; name: string };
  canHideAtOnce: boolean;
}): Promise<boolean> {
  const { target, reason, reporter, canHideAtOnce } = params;
  const key = targetKey(target);
  const note = params.note.trim().slice(0, NOTE_MAX);

  const attempt = (withNote: boolean) => runTransaction(db, async tx => {
    const ref = targetRef(target);
    const snapshot = await tx.get(ref);
    if (!snapshot.exists()) throw Object.assign(new Error('not-found'), { code: 'not-found' });
    const data = snapshot.data();
    const count = (typeof data.reportCount === 'number' ? data.reportCount : 0) + 1;
    // The school that moderates it: for a comment, the school of the work.
    const owner = target.kind === 'comment' ? (await tx.get(doc(db, 'materials', target.materialId))).data() : data;
    const schoolId = typeof owner?.schoolId === 'string' ? owner.schoolId : '';
    const hide = !data.modStatus && (count >= HIDE_AFTER || (reason === 'copyright' && canHideAtOnce));

    tx.set(doc(db, 'reports', `${key}_${reporter.uid}`), {
      kind: target.kind,
      targetId: targetId(target),
      ...(target.kind === 'comment' ? { commentUserId: target.commentUserId } : {}),
      targetKey: key,
      reason,
      note: withNote ? note : '',
      reporterId: reporter.uid,
      reporterName: (reporter.name || 'Student').slice(0, 100),
      createdAt: serverTimestamp(),
    });
    tx.update(ref, {
      reportCount: count,
      ...(hide ? { modStatus: 'hidden', modReason: reason } : {}),
    });
    tx.set(doc(db, 'moderation', key), {
      kind: target.kind,
      targetId: targetId(target),
      ...(target.kind === 'comment' ? { commentUserId: target.commentUserId } : {}),
      schoolId,
      count: increment(1),
      reasons: { [reason]: increment(1) },
      ...(withNote && note ? { notes: arrayUnion(note) } : {}),
      status: 'open',
      updatedAt: serverTimestamp(),
    }, { merge: true });
    return hide;
  });

  try {
    return await attempt(true);
  } catch (error: any) {
    // The notes list is full (or the same note is already there): file the report without it.
    if (note && error?.code === 'permission-denied') return attempt(false);
    throw error;
  }
}

// ------------------------------------------------------------- the queue

export interface ModerationItem {
  key: string;
  kind: ReportTarget['kind'];
  targetId: string;
  commentUserId?: string;
  schoolId: string;
  count: number;
  reasons: Partial<Record<ReportReason, number>>;
  notes: string[];
  status: 'open' | 'kept' | 'removed';
  updatedAt: Date | null;
  decidedByName?: string | null;
}

export function mapModerationDoc(id: string, data: any): ModerationItem {
  return {
    key: id,
    kind: data.kind,
    targetId: data.targetId,
    commentUserId: data.commentUserId,
    schoolId: data.schoolId || '',
    count: typeof data.count === 'number' ? data.count : 0,
    reasons: data.reasons || {},
    notes: Array.isArray(data.notes) ? data.notes : [],
    status: data.status || 'open',
    updatedAt: toDate(data.updatedAt),
    decidedByName: data.decidedByName ?? null,
  };
}

export function itemTarget(item: ModerationItem): ReportTarget {
  if (item.kind === 'material') return { kind: 'material', materialId: item.targetId };
  if (item.kind === 'request') return { kind: 'request', requestId: item.targetId };
  return { kind: 'comment', materialId: item.targetId, commentUserId: item.commentUserId || '' };
}

/** The reason most reported (ties: the order of REPORT_REASONS). */
export function topReason(reasons: Partial<Record<ReportReason, number>>): ReportReason {
  let best: ReportReason = 'other';
  let most = 0;
  for (const r of REPORT_REASONS) {
    if ((reasons[r] || 0) > most) { best = r; most = reasons[r] || 0; }
  }
  return best;
}

/**
 * "Va bene": the content is visible again and its reports start from zero.
 */
export async function keepContent(item: ModerationItem, moderatorName: string) {
  const target = itemTarget(item);
  const batch = writeBatch(db);
  batch.update(targetRef(target), {
    reportCount: 0,
    modStatus: null,
    modReason: null,
    ...(target.kind === 'material' ? { modAt: serverTimestamp() } : {}),
  });
  batch.update(doc(db, 'moderation', item.key), {
    count: 0,
    reasons: {},
    notes: [],
    status: 'kept',
    updatedAt: serverTimestamp(),
    decidedByName: moderatorName.slice(0, 100),
  });
  await batch.commit();
}

/**
 * "Rimuovi": a work stays hidden for good (the author keeps it in My Space and
 * the file stays in their Drive); a comment or a request is deleted.
 */
export async function removeContent(item: ModerationItem, moderatorName: string) {
  const target = itemTarget(item);
  const batch = writeBatch(db);
  if (target.kind === 'material') {
    batch.update(targetRef(target), { modStatus: 'removed', modReason: topReason(item.reasons), modAt: serverTimestamp() });
  } else {
    batch.delete(targetRef(target));
  }
  batch.update(doc(db, 'moderation', item.key), {
    status: 'removed',
    updatedAt: serverTimestamp(),
    decidedByName: moderatorName.slice(0, 100),
  });
  await batch.commit();
}


/** The content no longer exists (its author deleted it): close the entry. */
export async function closeMissing(item: ModerationItem, moderatorName: string) {
  const batch = writeBatch(db);
  batch.update(doc(db, 'moderation', item.key), {
    status: 'removed',
    updatedAt: serverTimestamp(),
    decidedByName: moderatorName.slice(0, 100),
  });
  await batch.commit();
}
