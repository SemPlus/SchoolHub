import React, { useState } from 'react';
import { Eye, EyeOff, GraduationCap, School as SchoolIcon, UserRound, Plus, X, Check } from 'lucide-react';
import SchoolPicker, { PickedSchool } from './SchoolPicker';
import ClassPicker from './ClassPicker';
import { useAppData } from '../context/AppData';
import { SUBJECTS, subjectStyle, withAlpha } from '../lib/subjects';
import { describeSimulation, type Simulation, type SimulationMode } from '../lib/simulation';
import { cn } from '../lib/utils';
import { t } from '../lib/i18n';

/**
 * Founder-only developer settings: see SchoolHub as a student, a teacher or
 * a signed-out visitor. Nothing is written while it is on.
 */
export default function ViewAsPanel() {
  const { profile, simulation, setSimulation } = useAppData();
  const [draft, setDraft] = useState<Simulation>(() => simulation.mode !== 'off' ? simulation : {
    mode: 'teacher',
    schoolId: profile?.schoolId,
    schoolName: profile?.schoolName,
    schoolCity: profile?.schoolCity,
    schoolGrade: profile?.schoolGrade,
    classYear: profile?.classYear,
    classSection: profile?.classSection,
    teacherClasses: profile?.classYear && profile?.classSection ? [`${profile.classYear}${profile.classSection}`] : [],
    teacherSubjects: [],
  });
  const [draftYear, setDraftYear] = useState<number | undefined>();
  const [draftSection, setDraftSection] = useState('');

  const school: PickedSchool | null = draft.schoolId
    ? { id: draft.schoolId, name: draft.schoolName || draft.schoolId, city: draft.schoolCity || '', grade: draft.schoolGrade }
    : null;
  const maxYear = draft.schoolGrade === 1 ? 3 : 5;
  const draftLabel = draftYear && draftSection ? `${draftYear}${draftSection}` : '';
  const classes = draft.teacherClasses || [];
  const subjects = draft.teacherSubjects || [];

  const ready = draft.mode === 'visitor'
    || (draft.mode === 'student' && !!draft.schoolId && !!draft.classYear && !!draft.classSection)
    || (draft.mode === 'teacher' && !!draft.schoolId && classes.length > 0 && subjects.length > 0);

  const modes: { id: Exclude<SimulationMode, 'off'>; label: string; icon: React.ElementType }[] = [
    { id: 'teacher', label: t("Teacher"), icon: GraduationCap },
    { id: 'student', label: t("Student"), icon: UserRound },
    { id: 'visitor', label: t("Visitor"), icon: EyeOff },
  ];
  const label = 'text-[10px] uppercase tracking-[0.2em] text-white/40 font-medium';

  return (
    <div className="glass-panel rounded-[1.5rem] p-5 border-white/5 space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-white font-semibold flex items-center gap-2"><Eye className="w-4 h-4 text-luxury-gold" /> {t("Developer settings · View as")}</p>
          <p className="text-xs text-white/45 mt-1">{t("See the app exactly as someone else would. Only on this device; nothing is saved while it is on.")}</p>
        </div>
        {simulation.mode !== 'off' && (
          <button onClick={() => setSimulation({ mode: 'off' })} className="shrink-0 px-4 py-2 rounded-full bg-white text-luxury-black text-[11px] font-bold">
            {t("Turn off")}
          </button>
        )}
      </div>

      {simulation.mode !== 'off' && (
        <p className="text-xs text-amber-200 bg-amber-400/10 border border-amber-400/25 rounded-xl px-3 py-2">
          {t("On now: {0}", describeSimulation(simulation))}
        </p>
      )}

      <div className="grid grid-cols-3 gap-2">
        {modes.map(m => (
          <button
            key={m.id}
            onClick={() => setDraft({ ...draft, mode: m.id })}
            className={cn(
              'flex flex-col sm:flex-row items-center justify-center gap-1.5 py-3 rounded-2xl border text-xs font-semibold transition-all',
              draft.mode === m.id ? 'border-luxury-gold bg-luxury-gold/10 text-white' : 'border-white/10 text-white/55 hover:text-white'
            )}
          >
            <m.icon className="w-4 h-4" /> {m.label}
          </button>
        ))}
      </div>

      {draft.mode !== 'visitor' && (
        <div className="space-y-2">
          <p className={label}><SchoolIcon className="inline w-3 h-3 mr-1 -mt-0.5" />{t("School")}</p>
          <SchoolPicker
            value={school}
            onChange={(s) => setDraft({ ...draft, schoolId: s?.id, schoolName: s?.name, schoolCity: s?.city, schoolGrade: s?.grade })}
          />
        </div>
      )}

      {draft.mode === 'student' && (
        <div className={cn('space-y-2', !school && 'opacity-40 pointer-events-none')}>
          <p className={label}>{t("Class")}</p>
          <ClassPicker
            classYear={draft.classYear}
            classSection={draft.classSection}
            maxYear={maxYear}
            onChange={({ classYear, classSection }) => setDraft({ ...draft, classYear, classSection })}
          />
        </div>
      )}

      {draft.mode === 'teacher' && (
        <>
          <div className={cn('space-y-3', !school && 'opacity-40 pointer-events-none')}>
            <p className={label}>{t("Classes you teach")}</p>
            {classes.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {classes.map(c => (
                  <span key={c} className="flex items-center gap-1.5 pl-3 pr-1.5 py-1.5 rounded-xl bg-luxury-gold/10 border border-luxury-gold/30 text-sm text-white">
                    {c}
                    <button type="button" onClick={() => setDraft({ ...draft, teacherClasses: classes.filter(x => x !== c) })} className="p-1 text-white/40 hover:text-white" aria-label={t("Remove {0}", c)}>
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <ClassPicker
              classYear={draftYear}
              classSection={draftSection}
              maxYear={maxYear}
              onChange={({ classYear, classSection }) => { setDraftYear(classYear); setDraftSection(classSection || ''); }}
            />
            <button
              type="button"
              onClick={() => { setDraft({ ...draft, teacherClasses: [...classes, draftLabel] }); setDraftYear(undefined); setDraftSection(''); }}
              disabled={!draftLabel || classes.includes(draftLabel)}
              className="w-full py-3 rounded-xl border border-dashed border-white/20 text-sm text-white/70 hover:text-white flex items-center justify-center gap-2 disabled:opacity-30"
            >
              <Plus className="w-4 h-4" /> {draftLabel ? t("Add class {0}", draftLabel) : t("Pick a year and section, then add")}
            </button>
          </div>
          <div className="space-y-3">
            <p className={label}>{t("Subjects you teach")}</p>
            <div className="flex flex-wrap gap-2">
              {SUBJECTS.map(s => {
                const { color } = subjectStyle(s);
                const active = subjects.includes(s);
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setDraft({ ...draft, teacherSubjects: active ? subjects.filter(x => x !== s) : [...subjects, s] })}
                    className="px-3 py-2 rounded-xl border text-xs flex items-center gap-1.5 transition-all"
                    style={active
                      ? { borderColor: color, backgroundColor: withAlpha(color, 0.15), color }
                      : { borderColor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.55)' }}
                  >
                    {active ? <Check className="w-3.5 h-3.5" /> : <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: color }} />}
                    {t(s)}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}

      <button
        onClick={() => { setSimulation(draft); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
        disabled={!ready}
        className="w-full py-4 rounded-full bg-luxury-gold text-luxury-black text-sm font-bold disabled:opacity-40"
      >
        {t("View the app as: {0}", describeSimulation(draft))}
      </button>
    </div>
  );
}
