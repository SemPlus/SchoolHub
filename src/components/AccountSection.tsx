import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { useAppData } from '../context/AppData';
import { deleteMyAccount, type DeletionStep } from '../lib/accountDeletion';
import { LEGAL_PAGES } from '../lib/legal';
import { firebaseErrorMessage } from '../lib/engagement';
import { t } from '../lib/i18n';

/** Bottom of one's own profile: legal pages and "Delete my account". */
export default function AccountSection() {
  const { isFounder } = useAppData();
  const [open, setOpen] = useState(false);
  const [understood, setUnderstood] = useState(false);
  const [step, setStep] = useState<DeletionStep | null>(null);
  const [error, setError] = useState<string | null>(null);

  const stepLabel: Record<DeletionStep, string> = {
    signin: t("Confirm with Google…"),
    works: t("Removing your works…"),
    activity: t("Removing comments, votes and activity…"),
    profile: t("Removing your profile…"),
    done: t("Account deleted."),
  };

  const run = async () => {
    setError(null);
    try {
      await deleteMyAccount(setStep);
    } catch (err: any) {
      setStep(null);
      setError(err?.code === 'auth/popup-closed-by-user' || err?.code === 'auth/cancelled-popup-request'
        ? t("Deletion cancelled: nothing was removed.")
        : firebaseErrorMessage(err, t("Could not delete the account. Try again: what was already removed stays removed.")));
    }
  };

  return (
    <div className="p-6 sm:p-10 border-t border-white/5 space-y-5">
      <div className="flex flex-wrap gap-x-5 gap-y-2 text-[10px] uppercase tracking-widest text-white/40">
        {LEGAL_PAGES.map(p => (
          <a key={p.slug} href={`/legal/${p.slug}`} target="_blank" rel="noopener noreferrer" className="hover:text-luxury-gold">
            {t(p.title)}
          </a>
        ))}
      </div>

      {!isFounder && (
        !open ? (
          <button
            onClick={() => setOpen(true)}
            className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-red-300/60 hover:text-red-300"
          >
            <Trash2 className="w-3.5 h-3.5" /> {t("Delete my account")}
          </button>
        ) : (
          <div className="rounded-2xl border border-red-400/20 bg-red-400/[0.04] p-4 sm:p-5 space-y-3 max-w-xl">
            <p className="text-sm text-white">{t("Delete my account")}</p>
            <ul className="text-xs text-white/60 space-y-1.5 list-disc pl-4">
              <li>{t("Works you made alone are deleted. Group works stay with your classmates, without your name.")}</li>
              <li>{t("Comments, votes, requests, folders, saved works and your activity are deleted.")}</li>
              <li>{t("Themes and lots you created stay for the classes, signed \"Account eliminato\".")}</li>
              <li>{t("Your files stay in your Google Drive.")}</li>
              <li>{t("It cannot be undone.")}</li>
            </ul>
            <label className="flex items-start gap-2 text-xs text-white/70">
              <input
                type="checkbox"
                checked={understood}
                onChange={e => setUnderstood(e.target.checked)}
                className="mt-0.5"
                style={{ accentColor: '#f87171' }}
              />
              {t("I understand, delete everything")}
            </label>
            {error && <p className="text-xs text-red-400">{error}</p>}
            {step && <p className="text-xs text-white/60">{stepLabel[step]}</p>}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={run}
                disabled={!understood || !!step}
                className="px-4 py-2 rounded-full bg-red-500/80 text-white text-[10px] uppercase tracking-widest font-bold disabled:opacity-30"
              >
                {t("Delete permanently")}
              </button>
              <button
                onClick={() => { setOpen(false); setUnderstood(false); setError(null); }}
                disabled={!!step}
                className="px-4 py-2 rounded-full border border-white/15 text-[10px] uppercase tracking-widest text-white/60 hover:text-white disabled:opacity-30"
              >
                {t("Cancel")}
              </button>
            </div>
          </div>
        )
      )}
    </div>
  );
}
