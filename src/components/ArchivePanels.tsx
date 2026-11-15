import React, { useMemo } from 'react';
import { AlarmClock, CalendarClock, ChevronRight, GraduationCap, LayoutDashboard, Trophy, ExternalLink, Sparkles, QrCode } from 'lucide-react';
import { differenceInCalendarDays, format, formatDistanceToNow } from 'date-fns';
import type { Collection, Material, User } from '../types';
import { worksIn } from '../lib/collections';
import { parseClassLabel, schoolYearStart } from '../lib/schoolYear';
import { subjectStyle } from '../lib/subjects';

const DAY = 24 * 60 * 60 * 1000;

function dueText(due: Date): string {
  const days = differenceInCalendarDays(due, new Date());
  if (due.getTime() < Date.now()) return `was due ${formatDistanceToNow(due, { addSuffix: true })}`;
  if (days === 0) return `due today at ${format(due, 'HH:mm')}`;
  if (days === 1) return `due tomorrow at ${format(due, 'HH:mm')}`;
  return `due ${format(due, 'EEE d MMM')}`;
}

// ------------------------------------------------------------------ students

/** Hand-ins for my class that close within 3 days (or just closed) and that I have not handed in. */
export function HandInReminders({ profile, uid, collections, materials, onOpen }: {
  profile: User | null;
  uid?: string;
  collections: Collection[];
  materials: Material[];
  onOpen: (collectionId: string) => void;
}) {
  const due = useMemo(() => {
    if (!uid || !profile?.schoolId || !profile.classYear || !profile.classSection) return [];
    const now = Date.now();
    return collections
      .filter(c => c.dueAt && c.schoolId === profile.schoolId && c.classYear === profile.classYear && c.classSection === profile.classSection)
      .filter(c => c.dueAt!.getTime() - now < 3 * DAY && now - c.dueAt!.getTime() < DAY)
      .filter(c => !worksIn(c.id, materials).some(w => w.authorId === uid))
      .sort((a, b) => a.dueAt!.getTime() - b.dueAt!.getTime());
  }, [profile, uid, collections, materials]);

  if (due.length === 0) return null;

  return (
    <div className="space-y-2">
      {due.map(c => {
        const late = c.dueAt!.getTime() < Date.now();
        return (
          <button
            key={c.id}
            onClick={() => onOpen(c.id)}
            className={`w-full flex items-center gap-3 p-4 rounded-2xl border text-left transition-colors ${late ? 'border-red-400/40 bg-red-400/10 hover:bg-red-400/15' : 'border-luxury-gold/40 bg-luxury-gold/10 hover:bg-luxury-gold/15'}`}
          >
            <AlarmClock className={`w-5 h-5 shrink-0 ${late ? 'text-red-300' : 'text-luxury-gold'}`} />
            <span className="flex-1 min-w-0">
              <span className="block text-sm text-white truncate">{c.title}</span>
              <span className="block text-xs text-white/60">You haven't handed in yet · {dueText(c.dueAt!)}</span>
            </span>
            <ChevronRight className="w-4 h-4 text-white/40 shrink-0" />
          </button>
        );
      })}
    </div>
  );
}

// ------------------------------------------------------------------ teachers

/** What happened in the class a teacher is viewing. */
export function TeacherClassOverview({ profile, classLabel, uid, collections, materials, onOpenCollection, onFilterSubject, onPoster }: {
  profile: User | null;
  classLabel: string;
  uid?: string;
  collections: Collection[];
  materials: Material[];
  onOpenCollection: (collectionId: string) => void;
  onFilterSubject: (subject: string) => void;
  onPoster?: () => void;
}) {
  const data = useMemo(() => {
    const parsed = parseClassLabel(classLabel);
    if (!parsed || !profile?.schoolId) return null;
    const inClass = (x: { schoolId?: string | null; classYear?: number | null; classSection?: string | null }) =>
      x.schoolId === profile.schoolId && x.classYear === parsed.classYear && x.classSection === parsed.classSection;
    const year = schoolYearStart();
    const classMaterials = materials.filter(m => !m.isDeleted && inClass(m));
    const thisYear = classMaterials.filter(m => schoolYearStart(m.createdAt) === year);
    const thisWeek = classMaterials.filter(m => Date.now() - m.createdAt.getTime() < 7 * DAY);
    const subjects = profile.teacherSubjects || [];
    const gaps = subjects.filter(s => !thisYear.some(m => m.subject === s));
    const handIns = collections
      .filter(c => c.dueAt && inClass(c))
      .filter(c => c.createdBy === uid || c.dueAt!.getTime() > Date.now() - 7 * DAY)
      .sort((a, b) => a.dueAt!.getTime() - b.dueAt!.getTime())
      .map(c => {
        const works = worksIn(c.id, materials);
        return { c, count: new Set(works.map(w => w.authorId)).size, late: works.filter(w => w.createdAt > c.dueAt!).length };
      });
    return { thisWeek: thisWeek.length, thisYear: thisYear.length, gaps, handIns };
  }, [profile, classLabel, uid, collections, materials]);

  if (!data) return null;

  return (
    <div className="glass-panel rounded-[1.5rem] sm:rounded-[2rem] p-5 sm:p-6 border-white/5 space-y-4">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-luxury-gold/10 rounded-xl"><LayoutDashboard className="w-4 h-4 text-luxury-gold" /></div>
        <div>
          <h3 className="text-base font-serif text-white">Class {classLabel}</h3>
          <p className="text-[10px] uppercase tracking-widest text-white/35">
            {data.thisWeek} new this week · {data.thisYear} this school year
          </p>
        </div>
        {onPoster && (
          <button onClick={onPoster} className="ml-auto shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-full bg-white/5 border border-white/10 text-[10px] uppercase tracking-widest text-white/60 hover:text-white">
            <QrCode className="w-3.5 h-3.5" /> Class poster
          </button>
        )}
      </div>

      {data.handIns.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] uppercase tracking-widest text-white/40">Hand-ins</p>
          {data.handIns.map(({ c, count, late }) => (
            <button
              key={c.id}
              onClick={() => onOpenCollection(c.id)}
              className="w-full flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/5 hover:bg-white/[0.06] text-left"
            >
              <CalendarClock className="w-4 h-4 text-luxury-gold shrink-0" />
              <span className="flex-1 min-w-0">
                <span className="block text-sm text-white truncate">{c.title}</span>
                <span className="block text-[11px] text-white/50">{dueText(c.dueAt!)} · {count} handed in{late ? ` · ${late} late` : ''}</span>
              </span>
              {c.winnerMaterialId && <Trophy className="w-4 h-4 text-amber-300 shrink-0" />}
              <ChevronRight className="w-4 h-4 text-white/30 shrink-0" />
            </button>
          ))}
        </div>
      )}

      {data.gaps.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] uppercase tracking-widest text-white/40">Your subjects with nothing for {classLabel} yet this year</p>
          <div className="flex flex-wrap gap-2">
            {data.gaps.map(s => {
              const { color, icon: Icon } = subjectStyle(s);
              return (
                <button key={s} onClick={() => onFilterSubject(s)} className="px-3 py-1.5 rounded-full border text-xs flex items-center gap-1.5" style={{ borderColor: `${color}55`, color }}>
                  <Icon className="w-3.5 h-3.5" /> {s}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------- final exam

/** Year 5: everything for the final exam (Esame di Stato) in one place. */
export function FinalExamPanel({ profile, classLabel, materials, onShowYear, onFilterSubject }: {
  profile: User | null;
  classLabel: string;
  materials: Material[];
  onShowYear: () => void;
  onFilterSubject: (subject: string) => void;
}) {
  const subjects = useMemo(() => {
    if (!profile?.schoolId) return [];
    const counts = new Map<string, number>();
    for (const m of materials) {
      if (m.isDeleted || m.schoolId !== profile.schoolId || m.classYear !== 5 || !m.subject) continue;
      counts.set(m.subject, (counts.get(m.subject) || 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [materials, profile?.schoolId]);

  const month = new Date().getMonth();
  const examSeason = month >= 1 && month <= 5; // February to June

  return (
    <div className={`rounded-[1.5rem] sm:rounded-[2rem] p-5 sm:p-6 border space-y-4 ${examSeason ? 'border-luxury-gold/40 bg-luxury-gold/[0.06]' : 'border-white/5 bg-white/[0.02]'}`}>
      <div className="flex items-center gap-3">
        <div className="p-2 bg-luxury-gold/15 rounded-xl"><GraduationCap className="w-5 h-5 text-luxury-gold" /></div>
        <div className="min-w-0">
          <h3 className="text-base sm:text-lg font-serif text-white">Final exam · Maturità {schoolYearStart() + 1}</h3>
          <p className="text-[10px] uppercase tracking-widest text-white/40">
            {examSeason ? 'Exam season: everything for year 5 in one place' : `Year-5 materials of your school · ${classLabel}`}
          </p>
        </div>
      </div>

      {subjects.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {subjects.map(([s, n]) => {
            const { color, icon: Icon } = subjectStyle(s);
            return (
              <button key={s} onClick={() => onFilterSubject(s)} className="px-3 py-1.5 rounded-full border text-xs flex items-center gap-1.5" style={{ borderColor: `${color}55`, color }}>
                <Icon className="w-3.5 h-3.5" /> {s} <span className="text-white/40">{n}</span>
              </button>
            );
          })}
        </div>
      ) : (
        <p className="text-xs text-white/45">No year-5 materials at your school yet. Share your summaries: next year's class inherits them.</p>
      )}

      <div className="flex flex-wrap gap-2">
        <button onClick={onShowYear} className="px-4 py-2 rounded-full bg-white text-luxury-black text-[10px] uppercase tracking-widest font-bold flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5" /> All year-5 materials, every year
        </button>
        <a
          href="https://www.istruzione.it/esame_di_stato/"
          target="_blank"
          rel="noopener noreferrer"
          className="px-4 py-2 rounded-full bg-white/5 border border-white/10 text-white/70 hover:text-white text-[10px] uppercase tracking-widest font-bold flex items-center gap-1.5"
        >
          Official exam papers <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>
    </div>
  );
}
