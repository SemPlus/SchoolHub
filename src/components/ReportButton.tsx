import React, { useEffect, useState } from 'react';
import { Flag, Check } from 'lucide-react';
import { useAppData } from '../context/AppData';
import { firebaseErrorMessage } from '../lib/engagement';
import { hasReported, NOTE_MAX, REASON_LABELS, REPORT_REASONS, ReportReason, ReportTarget, submitReport } from '../lib/moderation';
import { cn } from '../lib/utils';
import Modal from './Modal';

import { t } from '../lib/i18n';

interface ReportButtonProps {
  target: ReportTarget;
  /** What is being reported, shown in the window ("Appunti sul Rinascimento"). */
  label: string;
  /** The owner of the content: they never see the button. */
  ownerId: string;
  /** Stacking level of the window (above the window the button sits in). */
  level?: 1 | 2 | 3;
  /** "icon" for a round icon button, "text" for a small text link. */
  variant?: 'icon' | 'text';
  className?: string;
}

/**
 * "Segnala": one report per person per content, with a reason and an
 * optional note. The school sees the reasons and notes, never who reported.
 */
export default function ReportButton({ target, label, ownerId, level = 2, variant = 'icon', className }: ReportButtonProps) {
  const { user, userRole } = useAppData();
  const [open, setOpen] = useState(false);
  const [already, setAlready] = useState<boolean | null>(null);
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<null | { hidden: boolean }>(null);

  useEffect(() => {
    if (!open || !user) return;
    setReason(null);
    setNote('');
    setError(null);
    setSent(null);
    setAlready(null);
    let cancelled = false;
    hasReported(target, user.uid)
      .then(done => { if (!cancelled) setAlready(done); })
      .catch(() => { if (!cancelled) setAlready(false); });
    return () => { cancelled = true; };
  }, [open]);

  if (!user || user.uid === ownerId) return null;

  const send = async () => {
    if (!reason) return;
    setBusy(true);
    setError(null);
    try {
      const hidden = await submitReport({
        target,
        reason,
        note,
        reporter: { uid: user.uid, name: user.displayName || 'Student' },
        canHideAtOnce: userRole === 'teacher' || userRole === 'admin',
      });
      setSent({ hidden });
    } catch (err: any) {
      setError(err?.code === 'not-found'
        ? t("This content no longer exists.")
        : firebaseErrorMessage(err, t("Could not send the report.")));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {variant === 'icon' ? (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setOpen(true); }}
          className={cn('flex items-center justify-center px-4 py-3 rounded-full border bg-white/5 border-white/10 text-white/40 hover:text-white transition-all', className)}
          title={t("Report")}
          aria-label={t("Report")}
        >
          <Flag className="w-4 h-4" />
        </button>
      ) : (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setOpen(true); }}
          className={cn('p-1 text-white/25 hover:text-white', className)}
          title={t("Report")}
          aria-label={t("Report")}
        >
          <Flag className="w-3.5 h-3.5" />
        </button>
      )}

      <Modal
        isOpen={open}
        onClose={() => setOpen(false)}
        size="sm"
        level={level}
        title={t("Report")}
        subtitle={label}
        icon={<Flag className="w-5 h-5 text-luxury-gold" />}
        footer={sent || already ? (
          <button onClick={() => setOpen(false)} className="w-full py-4 rounded-full bg-white text-luxury-black font-bold hover:bg-luxury-gold transition-all">
            {t("Close")}
          </button>
        ) : (
          <div className="space-y-3">
            {error && <p className="text-xs text-red-400">{error}</p>}
            <button
              onClick={send}
              disabled={!reason || busy || already === null}
              className="w-full py-4 rounded-full bg-white text-luxury-black font-bold hover:bg-luxury-gold disabled:opacity-30 transition-all"
            >
              {busy ? t("Sending…") : t("Send the report")}
            </button>
          </div>
        )}
      >
        {sent ? (
          <div className="space-y-3 text-center py-4">
            <div className="w-12 h-12 mx-auto rounded-full bg-luxury-gold/10 border border-luxury-gold/30 flex items-center justify-center">
              <Check className="w-6 h-6 text-luxury-gold" />
            </div>
            <p className="text-white">{t("Thank you: the school will see it.")}</p>
            <p className="text-sm text-white/50">
              {sent.hidden ? t("It is hidden from everyone until the school decides.") : t("After 3 reports it is hidden until the school decides.")}
              {' '}{t("Whoever shared it will not know it was you.")}
            </p>
          </div>
        ) : already ? (
          <p className="text-sm text-white/60 py-4">{t("You have already reported this. The school will decide.")}</p>
        ) : (
          <div className="space-y-5">
            <div className="space-y-2" role="radiogroup" aria-label={t("Reason")}>
              {REPORT_REASONS.map(r => (
                <button
                  key={r}
                  type="button"
                  role="radio"
                  aria-checked={reason === r}
                  onClick={() => setReason(r)}
                  className={cn(
                    'w-full text-left px-4 py-3 rounded-2xl border text-sm transition-all',
                    reason === r ? 'border-luxury-gold/60 bg-luxury-gold/10 text-white' : 'border-white/10 bg-white/[0.03] text-white/65 hover:text-white',
                  )}
                >
                  {t(REASON_LABELS[r])}
                </button>
              ))}
            </div>
            <div className="space-y-2">
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={NOTE_MAX}
                placeholder={t("A note for the school (optional)")}
                className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-3 text-sm text-white placeholder:text-white/25 focus:outline-none focus:ring-2 focus:ring-luxury-gold/30 h-20 resize-none"
              />
              <p className="text-[11px] text-white/35">{t("Whoever shared it will not know it was you.")}</p>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
