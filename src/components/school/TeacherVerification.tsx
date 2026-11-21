import { useState } from 'react';
import { doc, serverTimestamp } from 'firebase/firestore';
import { Plus, X } from 'lucide-react';
import { db } from '../../firebase';
import { updateDoc } from '../../lib/firestoreWrites';
import { isActive, type SchoolActivation } from '../../lib/aula';
import { firebaseErrorMessage } from '../../lib/engagement';
import { t } from '../../lib/i18n';
import {
  addTeacherEmails, domainProblem, MAX_TEACHER_DOMAINS, normalizeDomain, parseEmails, removeTeacherEmail,
} from '../../lib/teacherVerification';

const heading = 'text-[10px] uppercase tracking-widest text-white/50';
const chipButton = 'p-1 rounded-full text-white/40 hover:text-white disabled:opacity-40';

/**
 * Teachers confirmed by their school e-mail: the staff domains and the list
 * of teachers' e-mails. Only while the school's licence is active.
 */
export default function TeacherVerification({ schoolId, activation, emails, onChanged }: {
  schoolId: string;
  activation: SchoolActivation | null;
  emails: string[];
  onChanged: () => Promise<void>;
}) {
  const [domainInput, setDomainInput] = useState('');
  const [pasted, setPasted] = useState('');
  const [showList, setShowList] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const active = isActive(activation);
  const domains = activation?.teacherDomains ?? [];

  const run = async (key: string, action: () => Promise<unknown>, fallback: string) => {
    setBusy(key);
    setError(null);
    setNotice(null);
    try {
      await action();
      await onChanged();
      return true;
    } catch (err) {
      setError(firebaseErrorMessage(err, fallback));
      return false;
    } finally {
      setBusy(null);
    }
  };

  const saveDomains = (next: string[]) => run('domains', () => updateDoc(doc(db, 'schools', schoolId), {
    teacherDomains: next,
    updatedAt: serverTimestamp(),
  }), t("Could not save the domains."));

  const addDomain = async () => {
    const domain = normalizeDomain(domainInput);
    if (!domain) return;
    const problem = domainProblem(domain);
    if (problem === 'invalid') return setError(t("This is not a domain, e.g. docenti.liceo.edu.it"));
    if (problem === 'public') return setError(t("{0} is a public e-mail service: anyone can have an address there.", domain));
    if (domains.includes(domain)) return setDomainInput('');
    if (await saveDomains([...domains, domain])) setDomainInput('');
  };

  const addEmails = async () => {
    const { emails: found, invalid } = parseEmails(pasted);
    const fresh = found.filter(e => !emails.includes(e));
    if (!found.length) return setError(t("No e-mail address found in the text."));
    const ok = fresh.length
      ? await run('emails', () => addTeacherEmails(schoolId, fresh), t("Could not save the e-mails."))
      : true;
    if (!ok) return;
    setPasted('');
    setNotice([
      t("{0} added", fresh.length),
      found.length - fresh.length ? t("{0} already on the list", found.length - fresh.length) : null,
      invalid.length ? t("{0} not valid: {1}", invalid.length, invalid.slice(0, 3).join(', ')) : null,
    ].filter(Boolean).join(' · '));
  };

  return (
    <div className="glass-panel rounded-[1.5rem] p-4 sm:p-5 border-white/5 space-y-5 min-w-0">
      <div className="space-y-1">
        <p className={heading}>{t("Teachers confirmed by e-mail")}</p>
        <p className="text-xs text-white/50">
          {t("Whoever signs up as a teacher of this school with one of these addresses is confirmed at once. Others wait for your confirmation above.")}
        </p>
      </div>

      {!active && <p className="text-xs text-amber-200">{t("Available while the school's licence is active.")}</p>}
      {error && <p className="text-xs text-red-400">{error}</p>}
      {notice && <p className="text-xs text-white/60">{notice}</p>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 lg:gap-8">
        {/* Staff domains */}
        <div className="space-y-3 min-w-0">
          <p className="text-sm text-white">{t("Staff domains")} <span className="text-white/35 tabular-nums">{domains.length}/{MAX_TEACHER_DOMAINS}</span></p>
          {domains.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {domains.map(d => (
                <span key={d} className="flex items-center gap-1 pl-3 pr-1 py-1 rounded-full border border-white/10 bg-white/[0.03] text-xs text-white/80 max-w-full">
                  <span className="truncate">@{d}</span>
                  <button
                    onClick={() => saveDomains(domains.filter(x => x !== d))}
                    disabled={!active || !!busy}
                    className={chipButton}
                    aria-label={t("Remove {0}", d)}
                    title={t("Remove {0}", d)}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </span>
              ))}
            </div>
          )}
          {domains.length < MAX_TEACHER_DOMAINS && (
            <div className="flex gap-2">
              <input
                value={domainInput}
                onChange={e => setDomainInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addDomain(); }}
                disabled={!active}
                placeholder={t("e.g. docenti.liceo.edu.it")}
                className="flex-1 min-w-0 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-sm text-white placeholder:text-white/30 outline-none disabled:opacity-40"
              />
              <button
                onClick={addDomain}
                disabled={!active || !!busy || !domainInput.trim()}
                className="shrink-0 px-3 py-2 rounded-full border border-white/15 text-white/60 hover:text-white disabled:opacity-40"
                aria-label={t("Add domain")}
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          )}
          <p className="text-[11px] text-amber-200/80 leading-relaxed">
            {t("Add a domain only if students have no address on it. If students and teachers share the school's domain, use the list of e-mails instead.")}
          </p>
        </div>

        {/* Teachers' e-mails */}
        <div className="space-y-3 min-w-0">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-sm text-white">{t("Teachers' e-mails")} <span className="text-white/35 tabular-nums">{emails.length}</span></p>
            {emails.length > 0 && (
              <button onClick={() => setShowList(v => !v)} className="text-[10px] uppercase tracking-widest text-white/45 hover:text-luxury-gold">
                {showList ? t("Hide the list") : t("Show the list")}
              </button>
            )}
          </div>
          <textarea
            value={pasted}
            onChange={e => setPasted(e.target.value)}
            disabled={!active}
            rows={3}
            placeholder={t("Paste the teachers' e-mails, one per line or separated by commas")}
            className="w-full px-4 py-3 rounded-2xl bg-white/5 border border-white/10 text-sm text-white placeholder:text-white/30 outline-none resize-y disabled:opacity-40"
          />
          <button
            onClick={addEmails}
            disabled={!active || !!busy || !pasted.trim()}
            className="px-4 py-2 rounded-full border border-white/15 text-[11px] uppercase tracking-widest text-white/70 hover:text-white disabled:opacity-40"
          >
            {busy === 'emails' ? t("Saving…") : t("Add to the list")}
          </button>
          {showList && (
            <ul className="max-h-60 overflow-y-auto divide-y divide-white/5 rounded-xl border border-white/5">
              {emails.map(email => (
                <li key={email} className="flex items-center justify-between gap-2 pl-3 pr-1 py-1.5 text-xs text-white/75">
                  <span className="truncate">{email}</span>
                  <button
                    onClick={() => run(email, () => removeTeacherEmail(schoolId, email), t("Could not remove the e-mail."))}
                    disabled={!active || !!busy}
                    className={chipButton}
                    aria-label={t("Remove {0}", email)}
                    title={t("Remove {0}", email)}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="text-[11px] text-white/35">{t("Only the school's admins and SchoolHub see this list.")}</p>
        </div>
      </div>
    </div>
  );
}
