import React, { useEffect, useMemo, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { Users, X, Plus } from 'lucide-react';
import { db } from '../firebase';
import { useAppData } from '../context/AppData';
import { schoolYearStart } from '../lib/schoolYear';
import { matchesAllWords } from '../lib/search';
import { cn } from '../lib/utils';
import { t } from '../lib/i18n';

export interface CoAuthor { uid: string; name: string }

export const MAX_CO_AUTHORS = 5;

interface Classmate { uid: string; name: string; photoURL?: string | null }

/**
 * Add classmates to a group work. Only people of the same class who already
 * have an account appear (they are in the class directory).
 */
export default function CoAuthorPicker({ schoolId, classYear, classSection, value, onChange }: {
  schoolId?: string | null;
  classYear?: number | null;
  classSection?: string | null;
  value: CoAuthor[];
  onChange: (next: CoAuthor[]) => void;
}) {
  const { user, profile } = useAppData();
  const [classmates, setClassmates] = useState<Classmate[] | null>(null);
  const [error, setError] = useState(false);
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState('');

  const hasClass = !!schoolId && !!classYear && !!classSection;
  // The directory can only be read for your own school.
  const ownSchool = !!profile?.schoolId && profile.schoolId === schoolId;

  useEffect(() => {
    setClassmates(null);
    setError(false);
    if (!user || !hasClass || !ownSchool) return;
    let cancelled = false;
    getDocs(query(
      collection(db, 'directory'),
      where('schoolId', '==', schoolId),
      where('classYear', '==', classYear),
      where('classSection', '==', classSection),
    ))
      .then(snapshot => {
        if (cancelled) return;
        const year = schoolYearStart();
        setClassmates(snapshot.docs
          .map(d => d.data() as any)
          .filter(d => d.uid !== user.uid && d.accountType !== 'teacher' && (!d.schoolYear || d.schoolYear === year))
          .map(d => ({ uid: d.uid, name: d.displayName || t("Unnamed"), photoURL: d.photoURL }))
          .sort((a, b) => a.name.localeCompare(b.name)));
      })
      .catch(err => {
        console.warn('Could not load classmates:', err);
        if (!cancelled) setError(true);
      });
    return () => { cancelled = true; };
  }, [user?.uid, schoolId, classYear, classSection, ownSchool]);

  const chosen = new Set(value.map(v => v.uid));
  const shown = useMemo(
    () => (classmates || []).filter(c => !chosen.has(c.uid) && matchesAllWords(term, c.name)),
    [classmates, term, value],
  );
  const full = value.length >= MAX_CO_AUTHORS;

  const label = 'block text-[10px] uppercase tracking-[0.2em] text-white/40 font-medium ml-1';

  return (
    <div className="space-y-2">
      <label className={label}>{t("Made with classmates (optional)")}</label>

      {value.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {value.map(v => (
            <span key={v.uid} className="flex items-center gap-1.5 pl-3 pr-1.5 py-1.5 rounded-full border border-luxury-gold/30 bg-luxury-gold/10 text-xs text-luxury-gold">
              {v.name}
              <button type="button" onClick={() => onChange(value.filter(x => x.uid !== v.uid))} className="p-0.5 rounded-full hover:bg-white/10" aria-label={t("Remove {0}", v.name)}>
                <X className="w-3.5 h-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}

      {!hasClass ? (
        <p className="text-[11px] text-white/35 ml-1">{t("Choose school and class first.")}</p>
      ) : !ownSchool ? (
        <p className="text-[11px] text-white/35 ml-1">{t("You can add classmates only for your own school.")}</p>
      ) : error ? (
        <p className="text-[11px] text-white/35 ml-1">{t("Classmates are not available right now.")}</p>
      ) : !open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          disabled={full}
          className="flex items-center gap-2 px-4 py-2.5 rounded-full border border-white/10 bg-white/5 text-xs text-white/70 hover:text-white disabled:opacity-40"
        >
          <Users className="w-4 h-4" /> {full ? t("Up to {0} classmates", MAX_CO_AUTHORS) : t("Add classmates")}
        </button>
      ) : (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 space-y-2">
          <input
            autoFocus
            value={term}
            onChange={e => setTerm(e.target.value)}
            placeholder={t("Search a name…")}
            className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-3 text-sm text-white placeholder:text-white/25 outline-none"
          />
          {classmates === null ? (
            <p className="text-xs text-white/40 p-1">{t("Loading…")}</p>
          ) : classmates.length === 0 ? (
            <p className="text-xs text-white/40 p-1">{t("No classmate has an account yet.")}</p>
          ) : (
            <div className="max-h-48 overflow-y-auto custom-scrollbar space-y-1">
              {shown.map(c => (
                <button
                  key={c.uid}
                  type="button"
                  disabled={full}
                  onClick={() => { onChange([...value, { uid: c.uid, name: c.name }]); setTerm(''); }}
                  className={cn('w-full flex items-center gap-3 p-2 rounded-xl text-left hover:bg-white/5 disabled:opacity-40')}
                >
                  {c.photoURL
                    ? <img src={c.photoURL} alt="" className="w-7 h-7 rounded-full object-cover" referrerPolicy="no-referrer" />
                    : <span className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-[11px] text-white/60">{c.name[0]}</span>}
                  <span className="flex-1 text-sm text-white truncate">{c.name}</span>
                  <Plus className="w-4 h-4 text-luxury-gold" />
                </button>
              ))}
              {shown.length === 0 && <p className="text-xs text-white/40 p-1">{t("No one else to add.")}</p>}
            </div>
          )}
          <button type="button" onClick={() => setOpen(false)} className="text-[10px] uppercase tracking-widest text-white/40 hover:text-white">
            {t("Done")}
          </button>
        </div>
      )}
      <p className="text-[10px] text-white/30 ml-1">{t("Only classmates who already have an account. The work appears in their space too.")}</p>
    </div>
  );
}
