import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Printer, X } from 'lucide-react';
import { formatSchoolYear } from '../../lib/schoolYear';
import { format, formatDistanceToNow, t } from '../../lib/i18n';
import type { SchoolPanelData } from './useSchoolPanel';

// Gold that still reads on white paper.
const GOLD = '#A8862B';

/**
 * The annual report, as a page to print or save as PDF from the browser
 * (Print → Save as PDF). For the teachers' board, the school's
 * self-assessment report or the open day. Numbers only: no student names.
 */
export default function SchoolReport({ data, onClose }: { data: SchoolPanelData; onClose: () => void }) {
  // While open, printing shows only the report (see .print-report in index.css).
  useEffect(() => {
    document.body.classList.add('printing-report');
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.classList.remove('printing-report');
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const classes = [...data.classes].sort((x, y) => y.works - x.works || x.label.localeCompare(y.label, 'it', { numeric: true }));
  const subjects = [...data.subjects].filter(s => s.count > 0).sort((x, y) => y.count - x.count);
  const maxSubject = Math.max(1, ...subjects.map(s => s.count));

  const figure = (label: string, value: React.ReactNode, note?: string) => (
    <div className="border-t pt-3" style={{ borderColor: GOLD }}>
      <p className="text-[9px] uppercase tracking-[0.2em] text-neutral-500">{label}</p>
      <p className="font-serif text-3xl text-neutral-900 tabular-nums mt-1">{value}</p>
      {note && <p className="text-[10px] text-neutral-500">{note}</p>}
    </div>
  );
  const section = 'space-y-3 break-inside-avoid';
  const sectionTitle = 'font-serif text-xl text-neutral-900 border-b border-neutral-200 pb-1';

  return createPortal(
    <div className="print-report fixed inset-0 z-[100] overflow-y-auto bg-neutral-900/80 backdrop-blur-sm">
      {/* Toolbar (not printed) */}
      <div className="no-print sticky top-0 z-10 flex justify-center gap-2 p-3">
        <button onClick={() => window.print()} className="flex items-center gap-2 px-5 py-3 rounded-full bg-luxury-gold text-luxury-black text-[11px] uppercase tracking-widest font-bold shadow-xl">
          <Printer className="w-4 h-4" /> {t("Print or save as PDF")}
        </button>
        <button onClick={onClose} className="p-3 rounded-full bg-white/10 text-white hover:bg-white/20" aria-label={t("Close")}>
          <X className="w-4 h-4" />
        </button>
      </div>

      <article className="report-page mx-auto mb-10 w-full max-w-[210mm] bg-white text-neutral-800 px-6 sm:px-12 py-10 sm:py-14 space-y-8 shadow-2xl">
        {/* Heading */}
        <header className="flex items-start justify-between gap-6">
          <div className="space-y-2 min-w-0">
            <p className="text-[10px] uppercase tracking-[0.3em]" style={{ color: GOLD }}>{t("Report of the school year {0}", formatSchoolYear(data.year))}</p>
            <h1 className="font-serif text-3xl sm:text-4xl text-neutral-900 leading-tight">{data.schoolName}</h1>
            <p className="text-xs text-neutral-500">{[data.schoolCity, t("updated on {0}", format(new Date(), 'd MMMM yyyy'))].filter(Boolean).join(' · ')}</p>
          </div>
          <span className="shrink-0 relative w-12 h-12 rounded-full border flex items-center justify-center font-serif italic text-2xl" style={{ borderColor: GOLD, color: GOLD }}>
            <span className="absolute inset-[3px] rounded-full border" style={{ borderColor: `${GOLD}55` }} />
            <span className="relative -mt-0.5">S</span>
          </span>
        </header>

        {/* The year in numbers */}
        <section className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-5 break-inside-avoid">
          {figure(t("Students with an account"), data.enrolled)}
          {figure(t("Active per week"), data.averageActive, t("on average · peak {0}", data.peakActive))}
          {figure(t("Works shared"), data.worksYear, t("{0} lots", data.lotsYear))}
          {figure(t("Inherited"), data.inheritedYear.length, t("best works kept this year"))}
        </section>

        {/* Weekly activity */}
        <section className={section}>
          <h2 className={sectionTitle}>{t("Students active each week")}</h2>
          {data.weekly.length === 0 ? (
            <p className="text-xs text-neutral-500">{t("No week recorded yet.")}</p>
          ) : (
            <WeekChart weeks={data.weekly} />
          )}
        </section>

        {/* Classes */}
        <section className={section}>
          <h2 className={sectionTitle}>{t("Classes")}</h2>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-[9px] uppercase tracking-widest text-neutral-500 text-left">
                <th className="font-normal py-1">{t("Class")}</th>
                <th className="font-normal py-1 text-right">{t("With an account")}</th>
                <th className="font-normal py-1 text-right">{t("Active per week")}</th>
                <th className="font-normal py-1 text-right">{t("Works")}</th>
                <th className="font-normal py-1 text-right">{t("Lots")}</th>
                <th className="font-normal py-1 text-right">{t("Classroom")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {classes.map(c => (
                <tr key={c.label}>
                  <td className="py-1.5 font-serif text-sm text-neutral-900">{c.label}</td>
                  <td className="py-1.5 text-right tabular-nums">{c.enrolled}</td>
                  <td className="py-1.5 text-right tabular-nums">{c.averageActive}</td>
                  <td className="py-1.5 text-right tabular-nums">{c.works}</td>
                  <td className="py-1.5 text-right tabular-nums">{c.lots}</td>
                  <td className="py-1.5 text-right text-neutral-500">{c.lastAula && c.lastAula.getTime() >= new Date(data.year, 8, 1).getTime() ? formatDistanceToNow(c.lastAula, { addSuffix: true }) : '–'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-[10px] text-neutral-500">
            {t("Classrooms used this school year: {0} of {1}.", data.classesUsedThisYear, data.classes.length)}
          </p>
        </section>

        {/* Subjects */}
        {subjects.length > 0 && (
          <section className={section}>
            <h2 className={sectionTitle}>{t("Works by subject")}</h2>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2">
              {subjects.map(s => (
                <li key={s.subject} className="space-y-1">
                  <div className="flex justify-between text-xs"><span>{t(s.subject)}</span><span className="tabular-nums text-neutral-900">{s.count}</span></div>
                  <div className="h-1.5 bg-neutral-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${(s.count / maxSubject) * 100}%`, backgroundColor: GOLD }} />
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Inherited works */}
        <section className={section}>
          <h2 className={sectionTitle}>{t("Best works passed on to the next classes")}</h2>
          {data.inheritedYear.length === 0 ? (
            <p className="text-xs text-neutral-500">{t("None yet this year: teachers choose them when they close a lot.")}</p>
          ) : (
            <ul className="divide-y divide-neutral-100 text-xs">
              {data.inheritedYear.slice(0, 20).map(({ work, collection }) => (
                <li key={work.id} className="py-1.5 flex justify-between gap-4">
                  <span className="min-w-0"><span className="text-neutral-900">{work.title}</span><span className="text-neutral-500"> · {collection.title}</span></span>
                  <span className="shrink-0 text-neutral-500">{[collection.className, work.subject ? t(work.subject) : ''].filter(Boolean).join(' · ')}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <footer className="pt-4 border-t border-neutral-200 flex justify-between gap-4 text-[9px] uppercase tracking-[0.2em] text-neutral-400">
          <span>{t("Numbers only: no personal data of students.")}</span>
          <span>SchoolHub</span>
        </footer>
      </article>
    </div>,
    document.body,
  );
}

/** Students active per week this school year: gold bars on the baseline, 2px gaps. */
function WeekChart({ weeks }: { weeks: { date: Date; students: number }[] }) {
  const W = 600;
  const H = 120;
  const gap = 2;
  const max = Math.max(1, ...weeks.map(w => w.students));
  const barW = Math.max(2, (W - gap * (weeks.length - 1)) / weeks.length);
  return (
    <div className="space-y-1">
      <svg viewBox={`0 0 ${W} ${H + 1}`} className="w-full h-32" role="img" aria-label={t("Students active each week")}>
        <line x1={0} x2={W} y1={H + 0.5} y2={H + 0.5} stroke="#E5E5E5" />
        {weeks.map((w, i) => {
          const h = w.students === 0 ? 0 : Math.max(3, (w.students / max) * H);
          const x = i * (barW + gap);
          const y = H - h;
          const r = Math.min(4, barW / 2, h);
          return h === 0 ? null : (
            <path key={i} fill={GOLD} d={`M${x},${H} V${y + r} Q${x},${y} ${x + r},${y} H${x + barW - r} Q${x + barW},${y} ${x + barW},${y + r} V${H} Z`}>
              <title>{`${format(w.date, 'd MMM')}: ${w.students}`}</title>
            </path>
          );
        })}
      </svg>
      <div className="flex justify-between text-[10px] text-neutral-500">
        <span>{format(weeks[0].date, 'd MMM')}</span>
        <span>{t("max {0}", max)}</span>
        <span>{format(weeks[weeks.length - 1].date, 'd MMM')}</span>
      </div>
    </div>
  );
}
