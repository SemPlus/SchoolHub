import React, { useEffect, useMemo, useState } from 'react';
import { collection, doc, getDoc, getDocs, onSnapshot, query, where } from 'firebase/firestore';
import { ExternalLink, EyeOff, Flag, MessageSquare, FileText, HandHelping } from 'lucide-react';
import { db } from '../../firebase';
import { useAppData } from '../../context/AppData';
import { firebaseErrorMessage } from '../../lib/engagement';
import { format, t } from '../../lib/i18n';
import { mapFeedbackDoc, mapMaterialDoc, mapRequestDoc } from '../../lib/mappers';
import {
  closeMissing, HIDE_AFTER, isModHidden, keepContent, mapModerationDoc, ModerationItem, REASON_SHORT,
  REPORT_REASONS, removeContent,
} from '../../lib/moderation';
import { cn } from '../../lib/utils';
import type { Material, MaterialRequest, WorkFeedback } from '../../types';

/** What the queue shows of the reported content. */
type Loaded =
  | { kind: 'material'; material: Material }
  | { kind: 'comment'; comment: WorkFeedback; work: Material | null }
  | { kind: 'request'; request: MaterialRequest }
  | { kind: 'missing' };

function wasFixed(m: Material): boolean {
  return !!m.modFixedAt && (!m.modAt || m.modFixedAt > m.modAt);
}

async function loadTarget(item: ModerationItem): Promise<Loaded> {
  if (item.kind === 'material') {
    const s = await getDoc(doc(db, 'materials', item.targetId));
    return s.exists() ? { kind: 'material', material: mapMaterialDoc(s.id, s.data()) } : { kind: 'missing' };
  }
  if (item.kind === 'request') {
    const s = await getDoc(doc(db, 'requests', item.targetId));
    return s.exists() ? { kind: 'request', request: mapRequestDoc(s.id, s.data()) } : { kind: 'missing' };
  }
  const [c, w] = await Promise.all([
    getDoc(doc(db, 'materials', item.targetId, 'feedback', item.commentUserId || '')),
    getDoc(doc(db, 'materials', item.targetId)),
  ]);
  return c.exists()
    ? { kind: 'comment', comment: mapFeedbackDoc(c.id, c.data()), work: w.exists() ? mapMaterialDoc(w.id, w.data()) : null }
    : { kind: 'missing' };
}

interface ModerationQueueProps {
  /** The school's reports; without it, every school's (founder). */
  schoolId?: string;
  /** Founder only: the names of who reported. */
  showReporters?: boolean;
}

/**
 * "Segnalazioni": reported content waiting for a decision. The school's
 * admins see reasons and notes, never who reported.
 */
export default function ModerationQueue({ schoolId, showReporters = false }: ModerationQueueProps) {
  const { user } = useAppData();
  const [items, setItems] = useState<ModerationItem[] | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [targets, setTargets] = useState<Record<string, { version: number; loaded: Loaded }>>({});
  const [reporters, setReporters] = useState<Record<string, string[]>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setItems(null);
    setUnavailable(false);
    const q = schoolId ? query(collection(db, 'moderation'), where('schoolId', '==', schoolId)) : collection(db, 'moderation');
    return onSnapshot(q, snapshot => {
      setItems(snapshot.docs.map(d => mapModerationDoc(d.id, d.data())));
    }, err => {
      console.error('Moderation snapshot error:', err);
      setUnavailable(true);
      setItems([]);
    });
  }, [schoolId]);

  // Load the content of the entries that may need a decision, again whenever the entry changes.
  useEffect(() => {
    if (!items) return;
    for (const item of items) {
      if (item.status === 'kept' || (item.status === 'removed' && item.kind !== 'material')) continue;
      const version = item.updatedAt?.getTime() ?? 0;
      if (targets[item.key]?.version === version) continue;
      loadTarget(item)
        .then(loaded => setTargets(prev => ({ ...prev, [item.key]: { version, loaded } })))
        .catch(err => console.error('Could not load reported content:', err));
      if (showReporters && item.status === 'open') {
        getDocs(query(collection(db, 'reports'), where('targetKey', '==', item.key)))
          .then(s => setReporters(prev => ({ ...prev, [item.key]: s.docs.map(d => String(d.data().reporterName || '')) })))
          .catch(err => console.error('Could not load reporters:', err));
      }
    }
  }, [items]);

  // Waiting for a decision: open reports, and removed works the author corrected.
  const pending = useMemo(() => (items ?? []).filter(item => {
    if (item.status === 'open') return item.count > 0;
    if (item.status !== 'removed' || item.kind !== 'material') return false;
    const loaded = targets[item.key]?.loaded;
    return loaded?.kind === 'material' && loaded.material.modStatus === 'removed' && wasFixed(loaded.material);
  }).sort((a, b) => (b.updatedAt?.getTime() ?? 0) - (a.updatedAt?.getTime() ?? 0)), [items, targets]);

  const moderatorName = user?.displayName || 'SchoolHub';

  const decide = async (item: ModerationItem, action: 'keep' | 'remove' | 'close') => {
    if (action === 'remove' && item.kind !== 'material' &&
      !confirm(item.kind === 'comment' ? t("The comment will be deleted for good. Continue?") : t("The request will be deleted for good. Continue?"))) return;
    setBusy(item.key);
    setError(null);
    try {
      if (action === 'keep') await keepContent(item, moderatorName);
      else if (action === 'remove') await removeContent(item, moderatorName);
      else await closeMissing(item, moderatorName);
    } catch (err) {
      setError(firebaseErrorMessage(err, t("Could not save the decision.")));
    } finally {
      setBusy(null);
    }
  };

  const chip = 'flex items-center gap-1 px-2 py-0.5 rounded-full text-[8px] uppercase tracking-widest border';
  const button = 'flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-full text-[10px] uppercase tracking-widest font-bold transition-all disabled:opacity-40';

  return (
    <div className="glass-panel rounded-[1.5rem] p-4 sm:p-5 border-white/5 space-y-4 min-w-0">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] uppercase tracking-widest text-white/50 flex items-center gap-2">
          <Flag className="w-3.5 h-3.5" /> {t("Reports")}
        </p>
        {pending.length > 0 && (
          <span className="px-2.5 py-0.5 rounded-full bg-amber-400/15 border border-amber-400/30 text-amber-200 text-xs tabular-nums">{pending.length}</span>
        )}
      </div>

      {items === null ? (
        <div className="h-10 rounded-xl bg-white/[0.03] animate-pulse" />
      ) : unavailable ? (
        <p className="text-xs text-amber-200">{t("Available once the new database rules are deployed.")}</p>
      ) : pending.length === 0 ? (
        <p className="text-xs text-white/40">
          {t("Nothing to look at.")} {t("With {0} reports (or 1 from a teacher for copyright) the content hides itself until you decide.", HIDE_AFTER)}
        </p>
      ) : (
        <ul className="space-y-3">
          {pending.map(item => {
            const loaded = targets[item.key]?.loaded;
            const reasons = REPORT_REASONS.filter(r => item.reasons[r]).map(r => `${t(REASON_SHORT[r])} ×${item.reasons[r]}`);
            const material = loaded?.kind === 'material' ? loaded.material : null;
            const hidden = loaded && loaded.kind !== 'missing' &&
              isModHidden(loaded.kind === 'material' ? loaded.material : loaded.kind === 'comment' ? loaded.comment : loaded.request);
            const fixed = material && wasFixed(material);
            const reReview = item.status === 'removed';
            const Icon = item.kind === 'material' ? FileText : item.kind === 'comment' ? MessageSquare : HandHelping;
            const who = reporters[item.key]?.filter(Boolean);
            return (
              <li key={item.key} className="p-4 rounded-2xl border border-white/10 bg-white/[0.03] space-y-3 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={cn(chip, 'bg-white/5 border-white/10 text-white/60')}>
                    <Icon className="w-3 h-3" />
                    {item.kind === 'material' ? t("Work") : item.kind === 'comment' ? t("Comment") : t("Request")}
                  </span>
                  {loaded?.kind === 'missing' ? (
                    <span className={cn(chip, 'bg-white/5 border-white/10 text-white/40')}>{t("No longer exists")}</span>
                  ) : reReview ? (
                    <span className={cn(chip, 'bg-amber-400/10 border-amber-400/30 text-amber-300')}>{t("Removed · corrected by the author")}</span>
                  ) : hidden ? (
                    <span className={cn(chip, 'bg-amber-400/10 border-amber-400/30 text-amber-300')}><EyeOff className="w-3 h-3" /> {t("Hidden")}</span>
                  ) : (
                    <span className={cn(chip, 'bg-white/5 border-white/10 text-white/50')}>{t("Visible · {0}/{1} reports", item.count, HIDE_AFTER)}</span>
                  )}
                  {material?.isDeleted && <span className={cn(chip, 'bg-white/5 border-white/10 text-white/40')}>{t("In the author's trash")}</span>}
                </div>

                {loaded && loaded.kind !== 'missing' && (
                  <div className="min-w-0">
                    {loaded.kind === 'material' && <p className="font-serif text-lg text-white break-words">{loaded.material.title}</p>}
                    {loaded.kind === 'request' && <p className="font-serif text-lg text-white break-words">{loaded.request.title}</p>}
                    {loaded.kind === 'comment' && <p className="text-sm text-white/80 whitespace-pre-line break-words">“{loaded.comment.comment}”</p>}
                    <p className="text-[10px] uppercase tracking-widest text-white/35 mt-1 break-words">
                      {loaded.kind === 'material' && [loaded.material.authorName, loaded.material.className, !schoolId && loaded.material.schoolName].filter(Boolean).join(' · ')}
                      {loaded.kind === 'request' && [loaded.request.authorName, loaded.request.className, !schoolId && loaded.request.schoolName].filter(Boolean).join(' · ')}
                      {loaded.kind === 'comment' && <>{loaded.comment.userName}{loaded.work ? <> · {t("on “{0}”", loaded.work.title)}</> : null}</>}
                    </p>
                    {loaded.kind === 'request' && loaded.request.details && (
                      <p className="text-sm text-white/55 mt-2 whitespace-pre-line break-words">{loaded.request.details}</p>
                    )}
                  </div>
                )}

                {reasons.length > 0 && <p className="text-xs text-white/65">{reasons.join(' · ')}</p>}
                {item.notes.length > 0 && (
                  <ul className="space-y-1">
                    {item.notes.map((n, i) => <li key={i} className="text-xs text-white/50 italic break-words">“{n}”</li>)}
                  </ul>
                )}
                {showReporters && who && who.length > 0 && (
                  <p className="text-[10px] text-white/35">{t("Reported by {0}", who.join(', '))}</p>
                )}
                {fixed && material?.modFixedAt && (
                  <p className="text-xs text-emerald-300/80">{t("Corrected by the author on {0}", format(material.modFixedAt, 'd MMM yyyy'))}</p>
                )}

                <div className="flex flex-wrap gap-2">
                  {loaded?.kind === 'material' && (
                    <a href={loaded.material.url} target="_blank" rel="noopener noreferrer" className={cn(button, 'bg-white/5 border border-white/10 text-white/70 hover:text-white')}>
                      <ExternalLink className="w-3.5 h-3.5" /> {t("Open")}
                    </a>
                  )}
                  {loaded?.kind === 'missing' ? (
                    <button disabled={busy === item.key} onClick={() => decide(item, 'close')} className={cn(button, 'bg-white/5 border border-white/10 text-white/70 hover:text-white')}>
                      {t("Close")}
                    </button>
                  ) : loaded && (
                    <>
                      <button disabled={busy === item.key} onClick={() => decide(item, 'keep')} className={cn(button, 'bg-white text-luxury-black hover:bg-luxury-gold')}>
                        {reReview ? t("Fine, put it back") : t("Fine")}
                      </button>
                      <button disabled={busy === item.key} onClick={() => decide(item, 'remove')} className={cn(button, 'bg-red-400/10 border border-red-400/20 text-red-300 hover:bg-red-400/20')}>
                        {reReview ? t("Keep it removed") : t("Remove")}
                      </button>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
