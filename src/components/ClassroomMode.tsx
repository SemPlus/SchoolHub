import React, { useEffect, useMemo, useState } from 'react';
import { collection, doc, getDocs, limit, onSnapshot, query, where } from 'firebase/firestore';
import qrcode from 'qrcode-generator';
import { Search, X, ExternalLink, Crown } from 'lucide-react';
import { db } from '../firebase';
import type { Collection, Material } from '../types';
import { mapCollectionDoc, mapMaterialDoc } from '../lib/mappers';
import { isModHidden } from '../lib/moderation';
import { findSchoolById, type SchoolOption } from '../lib/schools';
import { formatSchoolYear, schoolYearStart } from '../lib/schoolYear';
import { worksIn } from '../lib/collections';
import { isActive, loadActivation, parseAulaPath, presentUrlFor, recordAulaVisit } from '../lib/aula';
import { matchesAllWords, searchToken } from '../lib/search';
import { authorsLine, isClosed, isLot, keptWorks, retiredMaterialIds } from '../lib/lots';
import { subjectStyle, withAlpha } from '../lib/subjects';
import { format, t } from '../lib/i18n';
import { cn, toDate } from '../lib/utils';
import { currentSlot, mapTimetableDoc, type Timetable } from '../lib/timetable';

type Status = 'loading' | 'active' | 'inactive' | 'invalid';

/** A lot (collection) with its works and its last activity. */
interface Lot {
  collection: Collection;
  works: Material[];
  lastActivity: Date;
}

const label = 'text-[11px] sm:text-xs uppercase tracking-[0.25em] text-white/45';

/**
 * Classroom mode: what the LIM or classroom PC shows from the class link.
 * No sign-in and no personal actions: open a work, present it, done.
 */
export default function ClassroomMode() {
  const target = useMemo(() => parseAulaPath(window.location.pathname), []);
  // Local preview only: ?dev skips the activation check, which needs the deployed rules.
  const devBypass = import.meta.env.DEV && new URLSearchParams(window.location.search).has('dev');

  const [status, setStatus] = useState<Status>(target ? 'loading' : 'invalid');
  const [school, setSchool] = useState<SchoolOption | null>(null);
  const [schoolMaterials, setSchoolMaterials] = useState<Material[]>([]);
  // Works of the open lot, by lot: some may have been shared without this school set.
  const [lotWorks, setLotWorks] = useState<Material[]>([]);
  const materials = useMemo(() => {
    const byId = new Map(schoolMaterials.map(m => [m.id, m]));
    lotWorks.forEach(m => byId.set(m.id, m));
    return [...byId.values()];
  }, [schoolMaterials, lotWorks]);
  const [collections, setCollections] = useState<Collection[]>([]);
  // A subject chosen by hand lasts until the next hour of the timetable.
  const [manual, setManual] = useState<{ subject: string; slot: string } | null>(null);
  const [timetable, setTimetable] = useState<Timetable | null>(null);
  const [lotId, setLotId] = useState<string | null>(null);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    document.title = target ? `${t("Classroom")} ${target.classLabel} · SchoolHub` : 'SchoolHub';
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  // School name and activation.
  useEffect(() => {
    if (!target) return;
    findSchoolById(target.schoolId).then(setSchool).catch(() => setSchool(null));
    loadActivation(target.schoolId)
      .then(activation => setStatus(isActive(activation) || devBypass ? 'active' : 'inactive'))
      .catch(error => {
        console.warn('Could not check activation:', error);
        setStatus(devBypass ? 'active' : 'inactive');
      });
  }, []);

  // The school's materials and lots, live, once the school is active.
  useEffect(() => {
    if (!target || status !== 'active') return;
    recordAulaVisit(target);
    const unsubMaterials = onSnapshot(query(collection(db, 'materials'), where('schoolId', '==', target.schoolId)), snapshot => {
      setSchoolMaterials(snapshot.docs.map(d => mapMaterialDoc(d.id, d.data())).filter(m => !m.isDeleted && !isModHidden(m)));
    }, error => console.error('Classroom materials error:', error));
    const unsubCollections = onSnapshot(query(collection(db, 'collections'), where('schoolId', '==', target.schoolId)), snapshot => {
      setCollections(snapshot.docs.map(d => mapCollectionDoc(d.id, d.data())).filter(c => !c.isDeleted));
    }, error => console.error('Classroom collections error:', error));
    // The school's timetable (public, no teacher names).
    const unsubTimetable = onSnapshot(doc(db, 'timetables', target.schoolId), snapshot => {
      setTimetable(snapshot.exists() ? mapTimetableDoc(snapshot.data(), toDate) : null);
    }, error => console.warn('Classroom timetable error:', error));
    return () => { unsubMaterials(); unsubCollections(); unsubTimetable(); };
  }, [status]);

  const year = schoolYearStart();

  const data = useMemo(() => {
    if (!target) return null;
    const isClass = (x: { classYear?: number | null; classSection?: string | null }) =>
      x.classYear === target.classYear && x.classSection === target.classSection;
    // Lot works not kept have left the archive.
    const retired = retiredMaterialIds(collections, materials);
    const visible = materials.filter(m => !retired.has(m.id));
    const lotOf = (c: Collection): Lot => {
      const works = worksIn(c.id, visible);
      const last = works.reduce((max, w) => (w.createdAt > max ? w.createdAt : max), c.createdAt);
      return { collection: c, works, lastActivity: last };
    };

    // This year's lots of this class, most recently active first.
    const lots = collections
      .filter(c => isClass(c) && schoolYearStart(c.createdAt) === year)
      .map(lotOf)
      .sort((a, b) => b.lastActivity.getTime() - a.lastActivity.getTime());

    // Earlier years, same grade (any section): closed lots pass on what was kept;
    // older collections (before lots) pass on their best work.
    const inherited = collections
      .filter(c => c.classYear === target.classYear && schoolYearStart(c.createdAt) < year)
      .flatMap(c => {
        const works = isLot(c)
          ? (isClosed(c) ? keptWorks(c, worksIn(c.id, visible)) : [])
          : visible.filter(m => m.id === c.winnerMaterialId);
        return works.map(work => ({ collection: c, work }));
      })
      .sort((a, b) => b.collection.createdAt.getTime() - a.collection.createdAt.getTime());

    // Class materials of this year that are not part of a lot.
    const loose = visible
      .filter(m => isClass(m) && !m.collectionId && schoolYearStart(m.createdAt) === year)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    // Subjects in use, the most recently active first.
    const activity = new Map<string, number>();
    const touch = (s: string | null | undefined, at: Date) => {
      if (s && at.getTime() > (activity.get(s) ?? 0)) activity.set(s, at.getTime());
    };
    lots.forEach(l => touch(l.collection.subject, l.lastActivity));
    loose.forEach(m => touch(m.subject, m.createdAt));
    inherited.forEach(i => touch(i.collection.subject, new Date(0)));
    const subjects = [...activity.entries()].sort((a, b) => b[1] - a[1]).map(([s]) => s);

    return { lots, inherited, loose, subjects, visible, retired };
  }, [target, materials, collections, year]);

  // The lesson going on now opens by itself; without a timetable (or in a free
  // hour), the subject of the most recently active lot.
  const slot = target ? currentSlot(timetable, target.classLabel, now) : null;
  const slotKey = slot?.key ?? 'none';
  // A new hour (or the end of one) brings back the timetable's subject.
  useEffect(() => { setManual(null); }, [slotKey]);
  const subjects = slot && data && !data.subjects.includes(slot.subject) ? [slot.subject, ...data.subjects] : data?.subjects ?? [];
  const chosen = manual && manual.slot === slotKey && subjects.includes(manual.subject) ? manual.subject : null;
  const activeSubject = chosen ?? slot?.subject ?? subjects[0] ?? null;
  // Open lots first, then the most recently active.
  const subjectLots = (data?.lots.filter(l => (l.collection.subject || null) === activeSubject) ?? [])
    .map((l, i) => ({ l, i, open: !l.collection.winnerMaterialId && !isClosed(l.collection) }))
    .sort((a, b) => Number(b.open) - Number(a.open) || a.i - b.i)
    .map(x => x.l);
  const lot = subjectLots.find(l => l.collection.id === lotId) ?? subjectLots[0] ?? null;
  const inheritedHere = (data?.inherited ?? []).filter(i => (i.collection.subject || null) === activeSubject).slice(0, 6);
  const looseHere = (data?.loose ?? []).filter(m => (m.subject || null) === activeSubject);

  const openLotId = lot?.collection.id ?? null;
  useEffect(() => {
    if (!openLotId) { setLotWorks([]); return; }
    return onSnapshot(query(collection(db, 'materials'), where('collectionId', '==', openLotId)), snapshot => {
      setLotWorks(snapshot.docs.map(d => mapMaterialDoc(d.id, d.data())).filter(m => !m.isDeleted && !isModHidden(m)));
    }, error => console.error('Classroom lot error:', error));
  }, [openLotId]);

  if (status === 'invalid') {
    return <Notice title={t("Classroom not found")} body={t("This classroom link is not valid. Ask your school for the link of your class.")} />;
  }
  if (status === 'inactive') {
    return (
      <Notice
        title={t("Activate SchoolHub for your school")}
        body={t("Classroom mode is available in schools that use SchoolHub. Students can still use the archive for free.")}
        action={{ href: '/', label: t("Open the archive") }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-luxury-black text-white/90 font-sans">
      {/* Class header */}
      <header className="border-b border-white/10 bg-luxury-black/80 backdrop-blur-xl sticky top-0 z-20">
        <div className="max-w-[1600px] mx-auto px-5 sm:px-10 py-4 flex items-center gap-4">
          <span className="relative w-11 h-11 rounded-full border border-luxury-gold/60 bg-white/5 flex items-center justify-center font-serif italic text-2xl text-luxury-gold leading-none shrink-0">
            <span className="absolute inset-[3px] rounded-full border border-luxury-gold/20" />
            <span className="relative -mt-0.5">S</span>
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="font-serif text-2xl sm:text-3xl text-white leading-tight">{t("Classroom")} {target!.classLabel}</h1>
            <p className={cn(label, 'truncate')}>{school ? `${school.name} · ${school.city}` : target!.schoolId} · {formatSchoolYear(year)}</p>
          </div>
          <div className="text-right shrink-0">
            {slot && activeSubject === slot.subject ? (
              <p className={cn(label, 'text-luxury-gold')}>{t("Period {0}", slot.period)} · {t(slot.subject)} · {t("until {0}", slot.end)}</p>
            ) : activeSubject && <p className={cn(label, 'text-luxury-gold')}>{t(activeSubject)}</p>}
            <p className="font-serif text-2xl text-white/80 tabular-nums">{format(now, 'HH:mm')}</p>
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-5 sm:px-10 py-6 sm:py-8 space-y-8">
        {/* Subjects and search */}
        <div className="flex flex-wrap items-center gap-2">
          {subjects.map(s => {
            const { color } = subjectStyle(s);
            const on = s === activeSubject;
            return (
              <button
                key={s}
                onClick={() => { setManual({ subject: s, slot: slotKey }); setLotId(null); }}
                className="px-4 py-2.5 rounded-full border text-xs sm:text-sm uppercase tracking-widest transition-colors"
                style={on ? { color, borderColor: color, backgroundColor: withAlpha(color, 0.12) } : { color: 'rgba(255,255,255,0.55)', borderColor: 'rgba(255,255,255,0.12)' }}
              >
                {t(s)}
              </button>
            );
          })}
          <div className="w-full lg:w-auto lg:ml-auto">
            <SearchEverywhere target={target!} materials={data?.visible ?? materials} retired={data?.retired} />
          </div>
        </div>

        {status === 'loading' ? (
          <div className="py-24 flex justify-center"><div className="w-12 h-12 border-t-2 border-luxury-gold rounded-full animate-spin" /></div>
        ) : !activeSubject ? (
          <div className="glass-panel rounded-[2rem] p-10 text-center space-y-2">
            <p className="font-serif text-3xl text-white/70">{t("Nothing for {0} yet", target!.classLabel)}</p>
            <p className="text-white/45">{t("Works shared for this class appear here, ready to present.")}</p>
          </div>
        ) : (
          <>
            {/* Current lot */}
            <section className="space-y-4">
              {lot ? (
                <>
                  <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
                    <div className="min-w-0">
                      <p className={label}>
                        {lot.collection.winnerMaterialId || isClosed(lot.collection) ? t("Lot closed") : t("Current lot")}
                        {' · '}{lot.works.length === 1 ? t('1 work') : t('{0} works', lot.works.length)}
                        {lot.collection.dueAt ? ` · ${t("due {0}", format(lot.collection.dueAt, 'd MMM'))}` : ''}
                      </p>
                      <h2 className="font-serif text-4xl sm:text-5xl text-white leading-tight">{lot.collection.title}</h2>
                    </div>
                    {subjectLots.length > 1 && (
                      <div className="flex flex-wrap gap-2 sm:ml-auto">
                        {subjectLots.map(l => (
                          <button
                            key={l.collection.id}
                            onClick={() => setLotId(l.collection.id)}
                            className={cn('px-3 py-2 rounded-full border text-xs', l.collection.id === lot.collection.id ? 'border-luxury-gold text-luxury-gold' : 'border-white/10 text-white/50 hover:text-white')}
                          >
                            {l.collection.title}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                    {lot.works.map(w => (
                      <WorkTile key={w.id} work={w} chosen={w.id === lot.collection.winnerMaterialId} />
                    ))}
                    {!lot.collection.winnerMaterialId && !isClosed(lot.collection) && <AddFromPhone collectionId={lot.collection.id} />}
                  </div>
                </>
              ) : (
                <p className="text-white/45">{t("No lot for this subject this year.")}</p>
              )}
            </section>

            {/* Inherited */}
            {inheritedHere.length > 0 && (
              <section className="space-y-4">
                <p className={label}>{t("Inherited · the best of earlier years")}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  {inheritedHere.map(({ collection: c, work }) => (
                    <WorkTile
                      key={work.id}
                      work={work}
                      chosen
                      kicker={`${formatSchoolYear(schoolYearStart(c.createdAt))} · ${c.title}`}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Other class materials */}
            {looseHere.length > 0 && (
              <section className="space-y-4">
                <p className={label}>{t("Other materials of the class")}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                  {looseHere.slice(0, 8).map(m => <WorkTile key={m.id} work={m} />)}
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function present(work: Material) {
  window.open(presentUrlFor(work.url), '_blank', 'noopener');
}

function WorkTile({ work, chosen = false, kicker }: { work: Material; chosen?: boolean; kicker?: string }) {
  const { color } = subjectStyle(work.subject);
  return (
    <button
      onClick={() => present(work)}
      className={cn(
        'glass-panel group text-left rounded-[1.75rem] p-5 sm:p-6 flex flex-col gap-3 min-h-[11rem] transition-colors hover:bg-white/[0.08]',
        chosen ? 'border-luxury-gold/40' : 'border-white/10'
      )}
    >
      {(kicker || chosen) && (
        <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.2em] text-luxury-gold">
          {chosen && <Crown className="w-3.5 h-3.5 shrink-0" />}
          <span className="truncate">{kicker || t("Chosen by the teacher")}</span>
        </p>
      )}
      <p className="font-serif text-2xl sm:text-[1.7rem] text-white leading-snug line-clamp-3">{work.title}</p>
      <p className="text-sm text-white/45 truncate">
        {authorsLine(work, t("and"))}
        {work.subject && <span style={{ color }}> · {t(work.subject)}</span>}
      </p>
      <span className="mt-auto self-start flex items-center gap-2 px-4 py-2 rounded-full border border-luxury-gold/50 text-luxury-gold text-[11px] uppercase tracking-[0.2em] group-hover:bg-luxury-gold group-hover:text-luxury-black transition-colors">
        {t("Present")} <ExternalLink className="w-3.5 h-3.5" />
      </span>
    </button>
  );
}

/** QR to open the lot on a phone and add a work there, signed in on the phone, never on the school PC. */
function AddFromPhone({ collectionId }: { collectionId: string }) {
  const svg = useMemo(() => {
    const qr = qrcode(0, 'M');
    qr.addData(`${window.location.origin}/?collection=${encodeURIComponent(collectionId)}`);
    qr.make();
    return qr.createSvgTag({ cellSize: 6, margin: 1, scalable: true });
  }, [collectionId]);
  return (
    <div className="rounded-[1.75rem] border border-dashed border-white/20 p-5 flex flex-col items-center justify-center gap-3 min-h-[11rem] text-center">
      <div className="w-28 h-28 bg-white rounded-xl p-1.5 [&>svg]:w-full [&>svg]:h-full" dangerouslySetInnerHTML={{ __html: svg }} />
      <p className="text-xs text-white/55 max-w-[12rem]">{t("Add your work from your phone")}</p>
    </div>
  );
}

/** Search in this school first, then in every school (keyword index). */
function SearchEverywhere({ target, materials, retired }: { target: NonNullable<ReturnType<typeof parseAulaPath>>; materials: Material[]; retired?: Set<string> }) {
  const [term, setTerm] = useState('');
  const [remote, setRemote] = useState<Material[]>([]);

  useEffect(() => {
    const token = searchToken(term);
    if (!token) { setRemote([]); return; }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      getDocs(query(collection(db, 'materials'), where('keywords', 'array-contains', token), limit(60)))
        .then(snapshot => {
          if (!cancelled) setRemote(snapshot.docs.map(d => mapMaterialDoc(d.id, d.data())).filter(m => !m.isDeleted && !isModHidden(m)));
        })
        .catch(error => console.warn('Search failed:', error));
    }, 350);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [term]);

  const results = useMemo(() => {
    if (!term.trim()) return [];
    const byId = new Map<string, Material>();
    [...materials, ...remote].forEach(m => { if (!retired?.has(m.id)) byId.set(m.id, m); });
    const rank = (m: Material) =>
      m.schoolId === target.schoolId && m.classYear === target.classYear ? 0 // this class and its inheritance
      : m.schoolId === target.schoolId ? 1 // this school
      : 2; // everywhere else
    return [...byId.values()]
      .filter(m => matchesAllWords(term, [m.title, m.description, m.subject, m.subject ? t(m.subject) : '', m.bookTitle, ...(m.tags || [])].filter(Boolean).join(' ')))
      .sort((a, b) => rank(a) - rank(b) || b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 12);
  }, [term, materials, remote, target, retired]);

  return (
    <div className="relative w-full lg:w-[26rem]">
      <div className="flex items-center gap-2 px-4 py-2.5 rounded-full border border-white/12 bg-white/5">
        <Search className="w-4 h-4 text-white/40 shrink-0" />
        <input
          value={term}
          onChange={e => setTerm(e.target.value)}
          placeholder={t("Search in every school…")}
          className="flex-1 min-w-0 bg-transparent text-sm text-white placeholder:text-white/35 outline-none"
        />
        {term && <button onClick={() => setTerm('')} aria-label={t("Clear")}><X className="w-4 h-4 text-white/50" /></button>}
      </div>
      {term.trim() && (
        <div className="absolute right-0 left-0 lg:left-auto lg:w-[34rem] mt-2 z-30 glass-panel rounded-[1.5rem] p-2 max-h-[60vh] overflow-auto custom-scrollbar bg-[#0c0c0c]">
          {results.length === 0 ? (
            <p className="p-4 text-sm text-white/45">{t("No works found.")}</p>
          ) : results.map(m => (
            <button key={m.id} onClick={() => present(m)} className="w-full text-left flex items-center gap-3 p-3 rounded-2xl hover:bg-white/5">
              <div className="min-w-0 flex-1">
                <p className="text-white truncate">{m.title}</p>
                <p className="text-[11px] text-white/40 truncate">{[m.className, m.schoolName, m.subject ? t(m.subject) : null].filter(Boolean).join(' · ')}</p>
              </div>
              <ExternalLink className="w-4 h-4 text-luxury-gold shrink-0" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Notice({ title, body, action }: { title: string; body: string; action?: { href: string; label: string } }) {
  return (
    <div className="min-h-screen bg-luxury-black flex items-center justify-center p-6">
      <div className="glass-panel rounded-[2rem] p-8 sm:p-12 max-w-lg text-center space-y-4">
        <span className="relative mx-auto w-14 h-14 rounded-full border border-luxury-gold/60 bg-white/5 flex items-center justify-center font-serif italic text-3xl text-luxury-gold leading-none">
          <span className="absolute inset-[3px] rounded-full border border-luxury-gold/20" />
          <span className="relative -mt-0.5">S</span>
        </span>
        <h1 className="font-serif text-3xl text-white">{title}</h1>
        <p className="text-white/55">{body}</p>
        {action && (
          <a href={action.href} className="inline-block mt-2 px-6 py-3 rounded-full bg-luxury-gold text-luxury-black text-xs font-bold uppercase tracking-widest">
            {action.label}
          </a>
        )}
      </div>
    </div>
  );
}
