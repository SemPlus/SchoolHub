import React, { useEffect, useMemo, useState } from 'react';
import { collection, doc, getDocsFromServer, serverTimestamp } from 'firebase/firestore';
import qrcode from 'qrcode-generator';
import { Copy, Check, QrCode, Plus, Presentation } from 'lucide-react';
import { db } from '../../firebase';
import { setDoc, updateDoc } from '../../lib/firestoreWrites';
import type { Collection, Material, User } from '../../types';
import { aulaUrl, endOfSchoolYear, isActive, mapActivationDoc, type SchoolActivation, type SchoolPlan } from '../../lib/aula';
import { formatClassName, parseClassLabel, sanitizeSection } from '../../lib/schoolYear';
import { toDate } from '../../lib/utils';
import { format, formatDistanceToNow, t } from '../../lib/i18n';
import { cn } from '../../lib/utils';
import SchoolPicker, { type PickedSchool } from '../SchoolPicker';

const panel = 'glass-panel rounded-[1.5rem] p-4 sm:p-5 border-white/5 space-y-4 min-w-0';
const heading = 'text-[10px] uppercase tracking-widest text-white/50';

/**
 * Founder only (until schools have their own panel): activate schools and
 * hand out the classroom links, one per class, to set once a year.
 */
export default function AulePanel({ users, materials, collections }: {
  users: User[];
  materials: Material[];
  collections: Collection[];
}) {
  const [schools, setSchools] = useState<SchoolActivation[]>([]);
  const [visits, setVisits] = useState<Map<string, Date>>(new Map());
  const [unavailable, setUnavailable] = useState(false);
  const [picked, setPicked] = useState<PickedSchool | null>(null);
  const [plan, setPlan] = useState<SchoolPlan>('private');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    const [s, v] = await Promise.allSettled([
      getDocsFromServer(collection(db, 'schools')),
      getDocsFromServer(collection(db, 'aulaVisits')),
    ]);
    if (s.status === 'fulfilled') {
      setSchools(s.value.docs.map(d => mapActivationDoc(d.id, d.data())).sort((a, b) => a.name.localeCompare(b.name)));
      setUnavailable(false);
    } else {
      setUnavailable(true);
    }
    if (v.status === 'fulfilled') {
      setVisits(new Map(v.value.docs.map(d => [d.id, toDate(d.data().lastSeenAt)]).filter((e): e is [string, Date] => !!e[1])));
    }
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
    updatedAt: serverTimestamp(),
  }).then(() => setPicked(null)));

  return (
    <div className={panel}>
      <div className="flex items-baseline justify-between gap-3">
        <p className={cn(heading, 'flex items-center gap-1.5')}><Presentation className="w-3.5 h-3.5" /> {t("Activated schools and classrooms")}</p>
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
            <SchoolRooms
              key={s.id}
              school={s}
              users={users}
              materials={materials}
              collections={collections}
              visits={visits}
              busy={busy}
              onToggle={() => run(() => updateDoc(doc(db, 'schools', s.id), {
                activated: !isActive(s),
                activatedUntil: endOfSchoolYear(),
                updatedAt: serverTimestamp(),
              }))}
              onAddClass={(label) => run(() => updateDoc(doc(db, 'schools', s.id), {
                extraClasses: [...new Set([...s.extraClasses, label])].sort(),
                updatedAt: serverTimestamp(),
              }))}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SchoolRooms({ school, users, materials, collections, visits, busy, onToggle, onAddClass }: {
  school: SchoolActivation;
  users: User[];
  materials: Material[];
  collections: Collection[];
  visits: Map<string, Date>;
  busy: boolean;
  onToggle: () => void;
  onAddClass: (label: string) => void;
}) {
  const active = isActive(school);
  const [newClass, setNewClass] = useState('');
  const [copied, setCopied] = useState<string | null>(null);
  const [qrFor, setQrFor] = useState<string | null>(null);

  // Classes known from students, teachers, materials and lots, plus the ones added by hand.
  const classes = useMemo(() => {
    const set = new Set<string>(school.extraClasses);
    for (const u of users) {
      if (u.schoolId !== school.id) continue;
      if (u.classYear && u.classSection) set.add(formatClassName(u.classYear, u.classSection));
      (u.teacherClasses || []).forEach(c => set.add(c));
    }
    for (const x of [...materials, ...collections]) {
      if (x.schoolId === school.id && x.classYear && x.classSection) set.add(formatClassName(x.classYear, x.classSection));
    }
    return [...set].filter(c => parseClassLabel(c)).sort((a, b) => a.localeCompare(b, 'it', { numeric: true }));
  }, [school, users, materials, collections]);

  const addClass = () => {
    const match = /^([1-5])\s*([A-Za-z]{1,3})$/.exec(newClass.trim());
    if (!match) return;
    onAddClass(`${match[1]}${sanitizeSection(match[2])}`);
    setNewClass('');
  };

  const copy = async (label: string) => {
    try {
      await navigator.clipboard.writeText(aulaUrl(school.id, label));
      setCopied(label);
      window.setTimeout(() => setCopied(null), 1500);
    } catch { /* clipboard blocked */ }
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

      {classes.length === 0 ? (
        <p className="text-xs text-white/40">{t("No class known yet. Add one below.")}</p>
      ) : (
        <div className="divide-y divide-white/5">
          {classes.map(label => {
            const lastUse = visits.get(`${school.id}_${label}`);
            return (
              <div key={label} className="py-2.5 space-y-2">
                <div className="grid grid-cols-[3rem_minmax(0,1fr)_auto] sm:grid-cols-[3rem_minmax(0,1fr)_8rem_auto] gap-3 items-center">
                  <span className="font-serif text-xl text-white">{label}</span>
                  <a href={aulaUrl(school.id, label)} target="_blank" rel="noreferrer" className="text-xs text-white/55 hover:text-luxury-gold truncate">
                    {aulaUrl(school.id, label).replace(/^https?:\/\//, '')}
                  </a>
                  <span className="hidden sm:block text-[11px] text-white/40 text-right">
                    {lastUse ? formatDistanceToNow(lastUse, { addSuffix: true }) : t("never used")}
                  </span>
                  <span className="flex gap-1">
                    <button onClick={() => copy(label)} className="p-2 rounded-full border border-white/10 text-white/60 hover:text-luxury-gold" title={t("Copy link")} aria-label={t("Copy link")}>
                      {copied === label ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                    <button onClick={() => setQrFor(qrFor === label ? null : label)} className="p-2 rounded-full border border-white/10 text-white/60 hover:text-luxury-gold" title={t("QR code")} aria-label={t("QR code")}>
                      <QrCode className="w-3.5 h-3.5" />
                    </button>
                  </span>
                </div>
                {qrFor === label && <RoomQr url={aulaUrl(school.id, label)} />}
              </div>
            );
          })}
        </div>
      )}

      <div className="flex gap-2">
        <input
          value={newClass}
          onChange={e => setNewClass(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') addClass(); }}
          placeholder={t("Add a class, e.g. 4G")}
          className="w-40 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-sm text-white placeholder:text-white/30 outline-none"
        />
        <button onClick={addClass} disabled={busy} className="px-3 py-2 rounded-full border border-white/15 text-white/60 hover:text-white disabled:opacity-40" aria-label={t("Add class")}>
          <Plus className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function RoomQr({ url }: { url: string }) {
  const svg = useMemo(() => {
    const qr = qrcode(0, 'M');
    qr.addData(url);
    qr.make();
    return qr.createSvgTag({ cellSize: 6, margin: 1, scalable: true });
  }, [url]);
  return <div className="w-36 h-36 bg-white rounded-xl p-2 [&>svg]:w-full [&>svg]:h-full" dangerouslySetInnerHTML={{ __html: svg }} />;
}
