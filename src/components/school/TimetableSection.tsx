import React, { useMemo, useRef, useState } from 'react';
import { doc, serverTimestamp } from 'firebase/firestore';
import { Upload, Download, PencilLine, Plus, Minus } from 'lucide-react';
import { db } from '../../firebase';
import { setDoc } from '../../lib/firestoreWrites';
import { SUBJECTS, subjectStyle, withAlpha } from '../../lib/subjects';
import {
  buildGrid, DAYS, defaultPeriod, emptyDay, guessSubject, lessonCount, MAX_PERIODS, parseTimetableFile, readTimetableFile,
  templateCsv, TimetableParseError, type Period, type RawLesson, type Timetable, type TimetableGrid, type TimetableSource,
} from '../../lib/timetable';
import { firebaseErrorMessage } from '../../lib/engagement';
import { format, t } from '../../lib/i18n';
import { cn } from '../../lib/utils';

const heading = 'text-[10px] uppercase tracking-widest text-white/50';
const button = 'flex items-center gap-2 px-4 py-2.5 rounded-full border border-white/15 text-xs text-white/75 hover:text-white disabled:opacity-40';

interface Draft {
  source: TimetableSource;
  periods: Period[];
  /** Lessons read from a file (empty when editing the saved timetable by hand). */
  lessons: RawLesson[];
  subjects: { label: string; short: string }[];
  mapping: Record<string, string>;
  /** The saved grid, when editing it by hand. */
  base: TimetableGrid;
  /** Cells changed by hand: "4G|1|0" → subject ('' = free). */
  edits: Record<string, string>;
  skipped: string[];
  noBells: boolean;
}

const dayLabel = (d: number) => [t("Mon"), t("Tue"), t("Wed"), t("Thu"), t("Fri"), t("Sat")][d - 1];

/**
 * The class timetable in the school panel: upload the file exported by the
 * timetable program (or our CSV template), match the school's subject names,
 * check bell times and the grid of each class, save. Classroom mode then
 * opens the subject of the current hour by itself.
 */
export default function TimetableSection({ schoolId, classes, timetable, onSaved }: {
  schoolId: string;
  classes: string[];
  timetable: Timetable | null;
  onSaved: () => Promise<void> | void;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [classLabel, setClassLabel] = useState<string | null>(null);

  const subjectOptions = useMemo(
    () => SUBJECTS.filter(s => s !== 'Other').map(s => ({ value: s, label: t(s) })).sort((a, b) => a.label.localeCompare(b.label)),
    // Re-sorted when the language changes (the panel re-renders).
    [t('Mathematics')],
  );

  const openFile = async (file: File) => {
    setError(null);
    try {
      const parsed = parseTimetableFile(await readTimetableFile(file));
      const remembered = timetable?.subjectMap ?? {};
      setDraft({
        source: parsed.source,
        periods: parsed.periods,
        lessons: parsed.lessons,
        subjects: parsed.subjects.sort((a, b) => a.label.localeCompare(b.label)),
        mapping: Object.fromEntries(parsed.subjects.map(s => [s.label, remembered[s.label] ?? guessSubject(s.label, s.short)])),
        base: {},
        edits: {},
        skipped: parsed.skippedClasses,
        noBells: parsed.source === 'untis',
      });
      setClassLabel(null);
    } catch (err) {
      setError(err instanceof TimetableParseError
        ? t("This file is not recognised. Use the XML export of aSc Orari, the GPU001.TXT file of Untis or the CSV template.")
        : t("Could not read the file."));
    }
  };

  const editByHand = () => {
    setError(null);
    setDraft({
      source: timetable?.source === 'manual' || !timetable ? 'manual' : timetable.source,
      periods: timetable?.periods.length ? timetable.periods : Array.from({ length: 6 }, (_, i) => defaultPeriod(i + 1)),
      lessons: [],
      subjects: [],
      mapping: {},
      base: timetable?.grid ?? {},
      edits: {},
      skipped: [],
      noBells: false,
    });
    setClassLabel(null);
  };

  const downloadTemplate = () => {
    const url = URL.createObjectURL(new Blob([templateCsv()], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'orario-schoolhub.csv';
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  // The grid as it will be saved.
  const grid = useMemo<TimetableGrid>(() => {
    if (!draft) return {};
    const n = draft.periods.length;
    const out: TimetableGrid = {};
    const source = draft.lessons.length ? buildGrid(draft.lessons, draft.mapping, n) : draft.base;
    for (const [cls, days] of Object.entries(source)) {
      out[cls] = {};
      for (const [day, row] of Object.entries(days)) out[cls][day] = Array.from({ length: n }, (_, i) => row[i] || '');
    }
    for (const [key, subject] of Object.entries(draft.edits)) {
      const [cls, day, index] = key.split('|');
      if (Number(index) >= n) continue;
      const days = (out[cls] ||= {});
      (days[day] ||= emptyDay(n))[Number(index)] = subject;
    }
    return out;
  }, [draft]);

  const gridClasses = useMemo(
    () => [...new Set([...Object.keys(grid), ...classes])].sort((a, b) => a.localeCompare(b, 'it', { numeric: true })),
    [grid, classes],
  );
  const shownClass = classLabel && gridClasses.includes(classLabel) ? classLabel : gridClasses[0] ?? null;
  const unmatched = draft ? draft.subjects.filter(s => !draft.mapping[s.label]).length : 0;

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    setError(null);
    try {
      // Only classes and days with at least one lesson.
      const clean: TimetableGrid = {};
      for (const [cls, days] of Object.entries(grid)) {
        for (const [day, row] of Object.entries(days)) {
          if (row.some(Boolean)) (clean[cls] ||= {})[day] = row;
        }
      }
      const subjectMap = { ...(timetable?.subjectMap ?? {}) };
      for (const [label, subject] of Object.entries(draft.mapping)) {
        if (!label.trim() || /^__.*__$/.test(label)) continue;
        if (subject) subjectMap[label] = subject; else delete subjectMap[label];
      }
      await setDoc(doc(db, 'timetables', schoolId), {
        periods: draft.periods,
        grid: clean,
        subjectMap,
        source: draft.source,
        updatedAt: serverTimestamp(),
      });
      setDraft(null);
      await onSaved();
    } catch (err) {
      setError(firebaseErrorMessage(err, t("Could not save the timetable.")));
    } finally {
      setSaving(false);
    }
  };

  const setPeriod = (i: number, key: keyof Period, value: string) =>
    setDraft(d => d && { ...d, periods: d.periods.map((p, j) => (j === i ? { ...p, [key]: value } : p)) });
  const addPeriod = () => setDraft(d => d && d.periods.length < MAX_PERIODS ? { ...d, periods: [...d.periods, defaultPeriod(d.periods.length + 1)] } : d);
  const removePeriod = () => setDraft(d => d && d.periods.length > 1 ? { ...d, periods: d.periods.slice(0, -1) } : d);
  const setCell = (cls: string, day: number, index: number, subject: string) =>
    setDraft(d => d && { ...d, edits: { ...d.edits, [`${cls}|${day}|${index}`]: subject } });

  return (
    <div className="space-y-4">
      <input
        ref={fileInput}
        type="file"
        accept=".xml,.txt,.csv,text/xml,text/csv,text/plain"
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) openFile(f); }}
      />

      {!draft ? (
        <>
          <p className="text-xs text-white/55">
            {timetable && lessonCount(timetable.grid) > 0
              ? t("Updated on {0} · {1} classes · {2} lessons a week", timetable.updatedAt ? format(timetable.updatedAt, 'd MMM yyyy') : '–', Object.keys(timetable.grid).length, lessonCount(timetable.grid))
              : t("No timetable yet. With it, each classroom opens the subject of the current hour by itself.")}
          </p>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => fileInput.current?.click()} className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-luxury-gold text-luxury-black text-xs font-bold uppercase tracking-widest">
              <Upload className="w-4 h-4" /> {timetable ? t("Upload a new file") : t("Upload the timetable")}
            </button>
            <button onClick={editByHand} className={button}><PencilLine className="w-4 h-4" /> {timetable ? t("Edit") : t("Fill in by hand")}</button>
            <button onClick={downloadTemplate} className={button}><Download className="w-4 h-4" /> {t("CSV template")}</button>
          </div>
          <p className="text-[10px] text-white/30">{t("Files: the XML export of aSc Orari, GPU001.TXT of Untis, or the CSV template filled in with Excel or Google Sheets. Only class, day, period and subject are saved: no teacher names or rooms.")}</p>
        </>
      ) : (
        <div className="space-y-6">
          {(draft.skipped.length > 0 || draft.noBells) && (
            <div className="space-y-1 text-xs text-amber-200">
              {draft.skipped.length > 0 && <p>{t("Not read as classes: {0}", draft.skipped.slice(0, 8).join(', ') + (draft.skipped.length > 8 ? '…' : ''))}</p>}
              {draft.noBells && <p>{t("This file has no bell times: check them below.")}</p>}
            </div>
          )}

          {/* 1. School subject names → SchoolHub subjects */}
          {draft.subjects.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-baseline justify-between gap-3">
                <p className={heading}>{t("1 · Match the subjects")}</p>
                <p className={cn('text-[10px]', unmatched ? 'text-amber-200' : 'text-white/35')}>
                  {unmatched ? t("{0} to match", unmatched) : t("all matched")}
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {draft.subjects.map(s => {
                  const value = draft.mapping[s.label] || '';
                  return (
                    <label key={s.label} className={cn('flex items-center gap-3 p-2.5 rounded-xl border', value ? 'border-white/5 bg-white/[0.03]' : 'border-amber-300/30 bg-amber-300/5')}>
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm text-white truncate">{s.label}</span>
                        {s.short && s.short !== s.label && <span className="block text-[10px] text-white/35">{s.short}</span>}
                      </span>
                      <select
                        value={value}
                        onChange={e => setDraft(d => d && { ...d, mapping: { ...d.mapping, [s.label]: e.target.value } })}
                        className="w-40 shrink-0 bg-luxury-black border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white"
                      >
                        <option value="">{t("— not used")}</option>
                        {subjectOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </label>
                  );
                })}
              </div>
            </section>
          )}

          {/* 2. Bell times */}
          <section className="space-y-3">
            <p className={heading}>{draft.subjects.length ? t("2 · Bell times") : t("Bell times")}</p>
            <div className="flex flex-wrap gap-2">
              {draft.periods.map((p, i) => (
                <div key={i} className="flex items-center gap-1.5 pl-3 pr-2 py-1.5 rounded-full border border-white/10 bg-white/[0.03]">
                  <span className="font-serif text-sm text-luxury-gold w-6">{t("{0}.", i + 1)}</span>
                  <input type="time" value={p.start} onChange={e => setPeriod(i, 'start', e.target.value)} className="bg-transparent text-xs text-white [color-scheme:dark]" aria-label={t("Start of period {0}", i + 1)} />
                  <span className="text-white/30">–</span>
                  <input type="time" value={p.end} onChange={e => setPeriod(i, 'end', e.target.value)} className="bg-transparent text-xs text-white [color-scheme:dark]" aria-label={t("End of period {0}", i + 1)} />
                </div>
              ))}
              <button onClick={addPeriod} disabled={draft.periods.length >= MAX_PERIODS} className="p-2.5 rounded-full border border-white/10 text-white/60 hover:text-white disabled:opacity-30" aria-label={t("Add a period")}><Plus className="w-3.5 h-3.5" /></button>
              <button onClick={removePeriod} disabled={draft.periods.length <= 1} className="p-2.5 rounded-full border border-white/10 text-white/60 hover:text-white disabled:opacity-30" aria-label={t("Remove the last period")}><Minus className="w-3.5 h-3.5" /></button>
            </div>
          </section>

          {/* 3. Grid of each class */}
          <section className="space-y-3">
            <p className={heading}>{draft.subjects.length ? t("3 · Check each class") : t("Each class")}</p>
            {gridClasses.length === 0 ? (
              <p className="text-xs text-white/40">{t("No class yet: add one in Classrooms below.")}</p>
            ) : (
              <>
                <div className="flex flex-wrap gap-1.5">
                  {gridClasses.map(c => (
                    <button
                      key={c}
                      onClick={() => setClassLabel(c)}
                      className={cn('px-3 py-1.5 rounded-full border font-serif text-sm', c === shownClass ? 'border-luxury-gold text-luxury-gold bg-luxury-gold/10' : grid[c] ? 'border-white/15 text-white/70' : 'border-white/5 text-white/30')}
                    >
                      {c}
                    </button>
                  ))}
                </div>
                {shownClass && (
                  <div className="overflow-x-auto -mx-1 px-1">
                    <table className="w-full min-w-[40rem] border-separate border-spacing-1">
                      <thead>
                        <tr>
                          <th />
                          {DAYS.map(d => <th key={d} className="text-[9px] uppercase tracking-widest text-white/40 font-normal">{dayLabel(d)}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {draft.periods.map((p, i) => (
                          <tr key={i}>
                            <th className="text-left pr-1 font-normal whitespace-nowrap">
                              <span className="font-serif text-sm text-luxury-gold">{t("{0}.", i + 1)}</span>
                              <span className="block text-[9px] text-white/30 tabular-nums">{p.start}</span>
                            </th>
                            {DAYS.map(d => {
                              const subject = grid[shownClass]?.[String(d)]?.[i] || '';
                              const color = subject ? subjectStyle(subject).color : undefined;
                              return (
                                <td key={d}>
                                  <select
                                    value={subject}
                                    onChange={e => setCell(shownClass, d, i, e.target.value)}
                                    className="w-full bg-luxury-black border rounded-lg px-1.5 py-2 text-[11px] truncate"
                                    style={subject ? { color, borderColor: withAlpha(color!, 0.4), backgroundColor: withAlpha(color!, 0.08) } : { color: 'rgba(255,255,255,0.3)', borderColor: 'rgba(255,255,255,0.08)' }}
                                    aria-label={`${shownClass} · ${dayLabel(d)} · ${t("{0}.", i + 1)}`}
                                  >
                                    <option value="">–</option>
                                    {subjectOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                  </select>
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </section>

          {error && <p className="text-xs text-red-400">{error}</p>}
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={save} disabled={saving} className="px-5 py-2.5 rounded-full bg-luxury-gold text-luxury-black text-xs font-bold uppercase tracking-widest disabled:opacity-40">
              {t("Save the timetable")}
            </button>
            <button onClick={() => setDraft(null)} disabled={saving} className={button}>{t("Cancel")}</button>
            <span className="text-[10px] text-white/35">{t("{0} lessons a week", lessonCount(grid))}</span>
          </div>
        </div>
      )}
      {!draft && error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
