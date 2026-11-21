import React, { useEffect, useState } from 'react';
import { collection, doc, getDocsFromServer, serverTimestamp } from 'firebase/firestore';
import { Presentation, X, ChevronDown } from 'lucide-react';
import { db } from '../../firebase';
import { deleteDoc, setDoc, updateDoc } from '../../lib/firestoreWrites';
import { endOfSchoolYear, isActive, mapActivationDoc, type SchoolActivation, type SchoolPlan } from '../../lib/aula';
import { adminKey, MAX_SCHOOL_ADMINS, type SchoolAdmin } from '../../lib/schoolPanel';
import { format, t } from '../../lib/i18n';
import { cn } from '../../lib/utils';
import SchoolPicker, { type PickedSchool } from '../SchoolPicker';
import SchoolPanel from '../school/SchoolPanel';

const panel = 'glass-panel rounded-[1.5rem] p-4 sm:p-5 border-white/5 space-y-4 min-w-0';
const heading = 'text-[10px] uppercase tracking-widest text-white/50';

/**
 * Founder only: activate schools, name up to three school admins each
 * (principal, vice-principal, digital lead) and open any school's panel.
 * The classroom links live in the school panel.
 */
export default function AulePanel() {
  const [schools, setSchools] = useState<SchoolActivation[]>([]);
  const [admins, setAdmins] = useState<SchoolAdmin[]>([]);
  const [unavailable, setUnavailable] = useState(false);
  const [picked, setPicked] = useState<PickedSchool | null>(null);
  const [plan, setPlan] = useState<SchoolPlan>('private');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openPanel, setOpenPanel] = useState<string | null>(null);

  const load = async () => {
    const [s, a] = await Promise.allSettled([
      getDocsFromServer(collection(db, 'schools')),
      getDocsFromServer(collection(db, 'schoolAdmins')),
    ]);
    if (s.status === 'fulfilled') {
      setSchools(s.value.docs.map(d => mapActivationDoc(d.id, d.data())).sort((x, y) => x.name.localeCompare(y.name)));
    }
    if (a.status === 'fulfilled') {
      setAdmins(a.value.docs.map(d => ({ email: d.id, schoolId: d.data().schoolId, schoolName: d.data().schoolName || '' })));
    }
    setUnavailable(s.status === 'rejected' || a.status === 'rejected');
  };
  useEffect(() => { load(); }, []);

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      await load();
    } catch (err: any) {
      setError(err?.message || String(err));
    } finally {
      setBusy(false);
    }
  };

  const activate = () => picked && run(() => setDoc(doc(db, 'schools', picked.id), {
    activated: true,
    plan,
    name: picked.name,
    city: picked.city || '',
    activatedUntil: endOfSchoolYear(),
    extraClasses: schools.find(s => s.id === picked.id)?.extraClasses ?? [],
    teacherDomains: schools.find(s => s.id === picked.id)?.teacherDomains ?? [],
    updatedAt: serverTimestamp(),
  }).then(() => setPicked(null)));

  return (
    <div className={panel}>
      <div className="flex items-baseline justify-between gap-3">
        <p className={cn(heading, 'flex items-center gap-1.5')}><Presentation className="w-3.5 h-3.5" /> {t("Activated schools")}</p>
        <p className="text-[10px] text-white/35">{t("Valid until {0}", format(endOfSchoolYear(), 'd MMM yyyy'))}</p>
      </div>

      {unavailable && <p className="text-xs text-amber-200">{t("Available once the new database rules are deployed.")}</p>}

      {/* Activate a school */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_auto_auto] gap-3 items-start">
        <SchoolPicker value={picked} onChange={setPicked} clearable placeholder={t("Activate a school – search by name or city")} />
        <div className="flex rounded-full border border-white/10 p-1">
          {(['private', 'partner'] as SchoolPlan[]).map(p => (
            <button
              key={p}
              onClick={() => setPlan(p)}
              className={cn('px-3 py-2 rounded-full text-[11px] uppercase tracking-widest', plan === p ? 'bg-luxury-gold text-luxury-black' : 'text-white/50')}
            >
              {p === 'private' ? t("Private · licence") : t("State · partner")}
            </button>
          ))}
        </div>
        <button
          onClick={activate}
          disabled={!picked || busy}
          className="px-5 py-2.5 rounded-full bg-white text-luxury-black text-xs font-bold uppercase tracking-widest disabled:opacity-40"
        >
          {t("Activate")}
        </button>
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}

      {schools.length === 0 && !unavailable ? (
        <p className="text-xs text-white/40">{t("No school activated yet.")}</p>
      ) : (
        <div className="space-y-4">
          {schools.map(s => (
            <SchoolCard
              key={s.id}
              school={s}
              admins={admins.filter(a => a.schoolId === s.id)}
              busy={busy}
              panelOpen={openPanel === s.id}
              onTogglePanel={() => setOpenPanel(openPanel === s.id ? null : s.id)}
              onToggle={() => run(() => updateDoc(doc(db, 'schools', s.id), {
                activated: !isActive(s),
                activatedUntil: endOfSchoolYear(),
                updatedAt: serverTimestamp(),
              }))}
              onAddAdmin={(email) => run(() => setDoc(doc(db, 'schoolAdmins', adminKey(email)), {
                schoolId: s.id,
                schoolName: s.name,
                addedAt: serverTimestamp(),
              }))}
              onRemoveAdmin={(email) => run(() => deleteDoc(doc(db, 'schoolAdmins', email)))}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SchoolCard({ school, admins, busy, panelOpen, onTogglePanel, onToggle, onAddAdmin, onRemoveAdmin }: {
  school: SchoolActivation;
  admins: SchoolAdmin[];
  busy: boolean;
  panelOpen: boolean;
  onTogglePanel: () => void;
  onToggle: () => void;
  onAddAdmin: (email: string) => void;
  onRemoveAdmin: (email: string) => void;
}) {
  const active = isActive(school);
  const [email, setEmail] = useState('');
  const valid = /^[^\s@/]+@[^\s@/]+\.[^\s@/]+$/.test(email.trim());
  const full = admins.length >= MAX_SCHOOL_ADMINS;

  const add = () => {
    if (!valid || full) return;
    onAddAdmin(email);
    setEmail('');
  };

  return (
    <div className="rounded-2xl border border-white/10 p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <p className="font-serif text-xl text-white min-w-0 truncate">{school.name}</p>
        <span className="text-[10px] uppercase tracking-widest text-white/40">{school.city}</span>
        <span className={cn('px-2 py-0.5 rounded-full border text-[10px] uppercase tracking-widest',
          school.plan === 'partner' ? 'border-sky-300/30 text-sky-200' : 'border-luxury-gold/40 text-luxury-gold')}>
          {school.plan === 'partner' ? t("State · partner") : t("Private · licence")}
        </span>
        <span className={cn('text-[10px] uppercase tracking-widest', active ? 'text-emerald-300' : 'text-white/40')}>
          {active ? t("Active") : t("Not active")}
        </span>
        <button onClick={onToggle} disabled={busy} className="ml-auto px-3 py-1.5 rounded-full border border-white/15 text-[11px] text-white/60 hover:text-white disabled:opacity-40">
          {active ? t("Deactivate") : t("Reactivate")}
        </button>
      </div>

      {/* School admins */}
      <div className="space-y-2">
        <p className="text-[10px] uppercase tracking-widest text-white/40">{t("School admins ({0} of {1})", admins.length, MAX_SCHOOL_ADMINS)}</p>
        {admins.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {admins.map(a => (
              <span key={a.email} className="flex items-center gap-1.5 pl-3 pr-1.5 py-1.5 rounded-full border border-luxury-gold/30 bg-luxury-gold/10 text-xs text-luxury-gold max-w-full">
                <span className="truncate">{a.email}</span>
                <button onClick={() => onRemoveAdmin(a.email)} disabled={busy} className="p-0.5 rounded-full hover:bg-white/10 disabled:opacity-40" aria-label={t("Remove {0}", a.email)}>
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            ))}
          </div>
        )}
        {!full && (
          <div className="flex gap-2">
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') add(); }}
              placeholder={t("Google e-mail of the principal, vice-principal or digital lead")}
              className="flex-1 min-w-0 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-sm text-white placeholder:text-white/30 outline-none"
            />
            <button onClick={add} disabled={!valid || busy} className="px-4 py-2 rounded-full border border-white/15 text-xs text-white/70 hover:text-white disabled:opacity-40">
              {t("Add")}
            </button>
          </div>
        )}
      </div>

      <button onClick={onTogglePanel} className="flex items-center gap-1.5 text-[11px] uppercase tracking-widest text-white/50 hover:text-luxury-gold">
        <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', panelOpen && 'rotate-180')} />
        {panelOpen ? t("Close the school panel") : t("Open the school panel")}
      </button>
      {panelOpen && <SchoolPanel schoolId={school.id} />}
    </div>
  );
}
