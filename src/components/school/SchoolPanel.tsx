import React, { useState } from 'react';
import { doc, serverTimestamp } from 'firebase/firestore';
import { Check, FileText } from 'lucide-react';
import { db } from '../../firebase';
import { updateDoc } from '../../lib/firestoreWrites';
import { isActive } from '../../lib/aula';
import { formatSchoolYear } from '../../lib/schoolYear';
import { firebaseErrorMessage } from '../../lib/engagement';
import { format, formatDistanceToNow, t, tc } from '../../lib/i18n';
import { cn } from '../../lib/utils';
import type { User } from '../../types';
import SubjectMark from '../SubjectMark';
import WeeklyBars from '../dashboard/WeeklyBars';
import Classrooms from './Classrooms';
import TimetableSection from './TimetableSection';
import SchoolReport from './SchoolReport';
import ModerationQueue from './ModerationQueue';
import TeacherVerification from './TeacherVerification';
import { onStaffDomain, removeTeacher } from '../../lib/teacherVerification';
import { useSchoolPanel } from './useSchoolPanel';

const panel = 'glass-panel rounded-[1.5rem] p-4 sm:p-5 border-white/5 space-y-4 min-w-0';
const heading = 'text-[10px] uppercase tracking-widest text-white/50';

/**
 * The school panel: what the principal buys with the licence. Numbers per
 * class and per subject only, the teachers to confirm, the classroom links
 * and the annual report.
 */
export default function SchoolPanel({ schoolId }: { schoolId: string }) {
  const data = useSchoolPanel(schoolId);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const a = data.activation;

  const run = async (key: string, action: () => Promise<unknown>, fallback: string) => {
    setBusy(key);
    setError(null);
    try {
      await action();
      await data.reload();
    } catch (err) {
      setError(firebaseErrorMessage(err, fallback));
    } finally {
      setBusy(null);
    }
  };

  const confirmTeacher = (u: User) => run(u.uid, () => updateDoc(doc(db, 'users', u.uid), { role: 'teacher' }), t("Could not confirm this teacher."));
  const unconfirmTeacher = (u: User) => {
    const name = u.displayName || t("Unnamed");
    const onList = !!u.email && data.teacherEmails.includes(u.email.toLowerCase());
    const message = onStaffDomain(u.email, a)
      ? t("Remove the teacher confirmation from {0}? Their address is on a staff domain of the school: they will be confirmed again at their next visit, unless you remove the domain.", name)
      : onList
        ? t("Remove the teacher confirmation from {0}? Their e-mail is also removed from the list of teachers.", name)
        : t("Remove the teacher confirmation from {0}?", name);
    if (!window.confirm(message)) return;
    run(u.uid, () => removeTeacher(schoolId, u, onList), t("Could not change the role."));
  };
  const addClass = (label: string) => a && run('class', () => updateDoc(doc(db, 'schools', a.id), {
    extraClasses: [...new Set([...a.extraClasses, label])].sort(),
    updatedAt: serverTimestamp(),
  }), t("Could not add the class."));

  if (data.loading) {
    return <div className="py-24 flex justify-center"><div className="w-10 h-10 border-t-2 border-luxury-gold rounded-full animate-spin" /></div>;
  }

  const share = data.enrolled ? Math.round((data.studentsActiveNow / data.enrolled) * 100) : null;
  const tile = (label: string, value: React.ReactNode, note: string) => (
    <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-4 min-w-0">
      <p className="text-[9px] uppercase tracking-widest text-white/40 truncate">{label}</p>
      <p className="text-3xl font-serif text-white mt-1 tabular-nums">{value}</p>
      <p className="text-[10px] text-white/35">{note}</p>
    </div>
  );
  const fewest = data.subjects.slice(0, 5);
  const maxSubject = Math.max(1, ...data.subjects.map(s => s.count));

  return (
    <div className="space-y-6">
      <div className="glass-panel rounded-[1.5rem] sm:rounded-[2.5rem] p-5 sm:p-8 border-white/5 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <SubjectMark text={data.schoolName[0]} className="!w-14 !h-14 !text-2xl" />
          <div className="flex-1 min-w-0">
            <h2 className="font-serif text-2xl sm:text-3xl text-white leading-tight">{data.schoolName}</h2>
            <p className="text-[10px] uppercase tracking-widest text-white/45 mt-1">
              {data.schoolCity ? `${data.schoolCity} · ` : ''}
              {a?.plan === 'partner' ? t("Partner school") : t("Licence")}
              {' · '}
              {isActive(a)
                ? (a?.activatedUntil ? t("active until {0}", format(a.activatedUntil, 'd MMM yyyy')) : t("Active"))
                : <span className="text-amber-200">{t("not active")}</span>}
            </p>
          </div>
          <button
            onClick={() => setReportOpen(true)}
            className="shrink-0 flex items-center justify-center gap-2 px-5 py-3 rounded-full border border-luxury-gold/40 text-luxury-gold text-[11px] uppercase tracking-widest hover:bg-luxury-gold/10"
          >
            <FileText className="w-4 h-4" /> {t("Report {0}", formatSchoolYear(data.year))}
          </button>
        </div>

        {!isActive(a) && (
          <p className="text-xs text-amber-200">{t("The school's licence is not active: classroom links and the panel's numbers stop updating. Write to SchoolHub to renew it.")}</p>
        )}
        {data.unavailable && <p className="text-xs text-amber-200">{t("Some numbers are available once the new database rules are deployed.")}</p>}
        {error && <p className="text-xs text-red-400">{error}</p>}

        {/* The numbers of the year */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {tile(t("Active students"), data.studentsActiveNow, share === null ? t("this week") : t("this week · {0}% of those with an account", share))}
          {tile(t("Works shared"), data.worksYear, t("this school year · {0} in all", data.worksTotal))}
          {tile(t("Inherited"), data.inherited.length, t("best works passed on to the next classes"))}
          {tile(t("Classrooms in use"), <>{data.classesInUse}<span className="text-white/35 text-xl">/{data.classes.length}</span></>, t("in the last 7 days"))}
        </div>
      </div>

      <ModerationQueue schoolId={schoolId} />

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.8fr)] gap-4 sm:gap-6 items-start">
        <WeeklyBars title={t("Active students")} weeks={data.last12.weeks} values={data.last12.values} />

        {/* Classes: numbers only */}
        <div className={panel}>
          <div className="flex items-baseline justify-between gap-3">
            <p className={heading}>{t("Classes")}</p>
            <p className="text-[10px] text-white/35">{t("numbers only, no personal data")}</p>
          </div>
          {data.classes.length === 0 ? (
            <p className="text-xs text-white/40">{t("No class yet: they appear as students sign in.")}</p>
          ) : (
            <div className="overflow-x-auto -mx-1">
              <table className="w-full text-sm min-w-[22rem]">
                <thead>
                  <tr className="text-[9px] uppercase tracking-widest text-white/35 text-left">
                    <th className="font-normal px-1 pb-2">{t("Class")}</th>
                    <th className="font-normal px-1 pb-2 text-right">{tc("students", "Active")}</th>
                    <th className="font-normal px-1 pb-2 text-right">{t("Lots")}</th>
                    <th className="font-normal px-1 pb-2 text-right">{t("Works")}</th>
                    <th className="font-normal px-1 pb-2 text-right">{t("Classroom")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {data.classes.map(c => {
                    const idle = c.enrolled > 0 && c.activeThisWeek === 0;
                    return (
                      <tr key={c.label}>
                        <td className="px-1 py-2 font-serif text-lg text-white">{c.label}</td>
                        <td className={cn('px-1 py-2 text-right tabular-nums', idle ? 'text-amber-200' : 'text-white')}>
                          {c.activeThisWeek}<span className="text-white/35">/{c.enrolled}</span>
                        </td>
                        <td className="px-1 py-2 text-right tabular-nums text-white/80">{c.lots}</td>
                        <td className="px-1 py-2 text-right tabular-nums text-white/80">{c.works}</td>
                        <td className="px-1 py-2 text-right text-[11px] text-white/45 whitespace-nowrap">
                          {c.lastAula ? formatDistanceToNow(c.lastAula, { addSuffix: true }) : t("never used")}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-[10px] text-white/30">{t("Active: students who opened SchoolHub this week, out of those with an account.")}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 items-start">
        {/* Teachers to confirm */}
        <div className={panel}>
          <div className="flex items-baseline justify-between gap-3">
            <p className={heading}>{t("Teachers to confirm")}</p>
            <p className="text-[10px] text-white/35">{t("{0} confirmed", data.confirmedTeachers)}</p>
          </div>
          {data.pendingTeachers.length === 0 ? (
            <p className="text-xs text-white/40">{t("Nobody is waiting.")}</p>
          ) : data.pendingTeachers.map(u => (
            <div key={u.uid} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/5">
              <div className="min-w-0">
                <p className="text-sm text-white truncate">{u.displayName || t("Unnamed")}</p>
                <p className="text-[10px] text-white/40 truncate">
                  {[u.email, (u.teacherClasses || []).join(', '), (u.teacherSubjects || []).map(s => t(s)).join(', ')].filter(Boolean).join(' · ')}
                </p>
              </div>
              <button
                onClick={() => confirmTeacher(u)}
                disabled={busy === u.uid}
                className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-full bg-luxury-gold text-luxury-black text-[10px] uppercase tracking-widest font-bold disabled:opacity-40"
              >
                <Check className="w-3.5 h-3.5" /> {t("Confirm")}
              </button>
            </div>
          ))}
          {data.teacherList.length > 0 && (
            <div className="space-y-2 pt-1">
              <p className="text-[10px] uppercase tracking-widest text-white/35">{t("Confirmed")}</p>
              <ul className="max-h-64 overflow-y-auto divide-y divide-white/5">
                {data.teacherList.map(u => (
                  <li key={u.uid} className="flex items-center justify-between gap-3 py-2">
                    <div className="min-w-0">
                      <p className="text-sm text-white/85 truncate">{u.displayName || t("Unnamed")}</p>
                      <p className="text-[10px] text-white/35 truncate">{u.email}</p>
                    </div>
                    <button
                      onClick={() => unconfirmTeacher(u)}
                      disabled={busy === u.uid}
                      className="shrink-0 px-3 py-1.5 rounded-full border border-white/10 text-[10px] uppercase tracking-widest text-white/50 hover:text-white hover:border-white/25 disabled:opacity-40"
                    >
                      {t("Remove")}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="text-[10px] text-white/30">{t("Confirmed teachers can verify materials and choose the best work of their lots.")}</p>
        </div>

        {/* Subjects with fewer works */}
        <div className={panel}>
          <div className="flex items-baseline justify-between gap-3">
            <p className={heading}>{t("Subjects with fewer works")}</p>
            <p className="text-[10px] text-white/35">{t("this school year")}</p>
          </div>
          {fewest.length === 0 ? (
            <p className="text-xs text-white/40">{t("No subject yet.")}</p>
          ) : (
            <ul className="space-y-3">
              {fewest.map(s => (
                <li key={s.subject} className="flex items-center gap-3">
                  <SubjectMark subject={s.subject} size="sm" />
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="text-white/80 truncate">{t(s.subject)}</span>
                      <span className="tabular-nums text-white">{s.count}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                      <div className="h-full rounded-full bg-luxury-gold/80" style={{ width: `${(s.count / maxSubject) * 100}%` }} />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <TeacherVerification schoolId={schoolId} activation={a} emails={data.teacherEmails} onChanged={data.reload} />

      {/* Timetable */}
      <div className={panel}>
        <p className={heading}>{t("Class timetable")}</p>
        <TimetableSection schoolId={schoolId} classes={data.classes.map(c => c.label)} timetable={data.timetable} onSaved={data.reload} />
      </div>

      {/* Classrooms */}
      <div className={panel}>
        <div className="flex items-baseline justify-between gap-3">
          <p className={heading}>{t("Classrooms")}</p>
          <p className="text-[10px] text-white/35">{t("{0} used this school year", data.classesUsedThisYear)}</p>
        </div>
        <p className="text-xs text-white/50">{t("Set each link once a year as the start page of the classroom PC or LIM. No sign-in is needed there.")}</p>
        <Classrooms
          schoolId={schoolId}
          classes={data.classes.map(c => c.label)}
          visits={data.visits}
          busy={busy === 'class'}
          onAddClass={addClass}
        />
      </div>

      {reportOpen && <SchoolReport data={data} onClose={() => setReportOpen(false)} />}
    </div>
  );
}
