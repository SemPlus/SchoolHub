import React, { useState } from 'react';
import { doc, serverTimestamp } from 'firebase/firestore';
import { ScrollText } from 'lucide-react';
import { db } from '../firebase';
import { updateDoc } from '../lib/firestoreWrites';
import { TERMS_VERSION } from '../lib/legal';
import { firebaseErrorMessage } from '../lib/engagement';
import { t } from '../lib/i18n';
import Modal from './Modal';

/** The fields saved when someone accepts the terms. */
export function termsAcceptance() {
  return { termsAcceptedAt: serverTimestamp(), termsVersion: TERMS_VERSION };
}

const link = (slug: string, text: string) => (
  <a href={`/legal/${slug}`} target="_blank" rel="noopener noreferrer" className="text-luxury-gold underline underline-offset-2">{text}</a>
);

/** "I am at least 14 and accept…" with links to the pages. */
export function TermsCheckbox({ checked, onChange }: { checked: boolean; onChange: (value: boolean) => void }) {
  const links = [link('termini', t("Terms of use")), link('regole', t("Content rules")), link('privacy', t("Privacy notice"))];
  const parts = t("I am at least 14 and accept the {0} and the {1}. I have read the {2}.").split(/\{(\d)\}/);
  return (
    <div className="space-y-2 text-left">
      <p className="text-[11px] text-white/45 leading-relaxed">
        {t("Your name, photo, school and class appear next to the works you share, which everyone can see. Your e-mail stays private.")}
      </p>
      <label className="flex items-start gap-2.5 text-xs text-white/75 leading-relaxed">
        <input
          type="checkbox"
          checked={checked}
          onChange={e => onChange(e.target.checked)}
          className="mt-0.5 shrink-0"
          style={{ accentColor: '#D4AF37' }}
        />
        <span>{parts.map((p, i) => (i % 2 ? <React.Fragment key={i}>{links[Number(p)]}</React.Fragment> : p))}</span>
      </label>
    </div>
  );
}

/** For people who signed up before the terms existed (or before a new version). */
export function TermsModal({ uid }: { uid: string }) {
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accept = async () => {
    setBusy(true);
    setError(null);
    try {
      await updateDoc(doc(db, 'users', uid), termsAcceptance());
    } catch (err) {
      setError(firebaseErrorMessage(err, t("Could not save.")));
      setBusy(false);
    }
  };

  return (
    <Modal
      isOpen
      dismissible={false}
      level={3}
      size="sm"
      icon={<ScrollText className="w-5 h-5 text-luxury-gold" />}
      title={t("Before you continue")}
      subtitle={t("SchoolHub has terms of use and a privacy notice")}
      footer={
        <div className="space-y-3">
          {error && <p className="text-xs text-red-400">{error}</p>}
          <button
            onClick={accept}
            disabled={!checked || busy}
            className="w-full bg-white text-luxury-black font-bold py-4 rounded-full disabled:opacity-20 transition-all"
          >
            {t("Continue")}
          </button>
        </div>
      }
    >
      <TermsCheckbox checked={checked} onChange={setChecked} />
    </Modal>
  );
}
