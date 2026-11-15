import React, { useMemo } from 'react';
import { GraduationCap } from 'lucide-react';
import { useAppData } from '../context/AppData';
import { formatClassName, isTeacherAccount, schoolYearStart } from '../lib/schoolYear';
import { subjectStyle } from '../lib/subjects';

import { t } from '../lib/i18n';
/**
 * Private study progress for a student: per subject, how many of this year's
 * class materials they have marked as studied.
 */
export default function StudyProgress() {
  const { profile, materials, studied } = useAppData();

  const rows = useMemo(() => {
    if (!profile?.schoolId || !profile.classYear || !profile.classSection || isTeacherAccount(profile)) return [];
    const year = schoolYearStart();
    const bySubject = new Map<string, { total: number; done: number }>();
    for (const m of materials) {
      if (m.isDeleted || !m.subject) continue;
      if (m.schoolId !== profile.schoolId || m.classYear !== profile.classYear || m.classSection !== profile.classSection) continue;
      if (schoolYearStart(m.createdAt) !== year) continue;
      const row = bySubject.get(m.subject) ?? { total: 0, done: 0 };
      row.total += 1;
      if (studied.has(m.id)) row.done += 1;
      bySubject.set(m.subject, row);
    }
    return [...bySubject.entries()]
      .map(([subject, r]) => ({ subject, ...r }))
      .sort((a, b) => (a.done / a.total) - (b.done / b.total) || b.total - a.total);
  }, [materials, studied, profile]);

  if (rows.length === 0) return null;

  const total = rows.reduce((a, r) => a + r.total, 0);
  const done = rows.reduce((a, r) => a + r.done, 0);

  return (
    <div className="glass-panel rounded-[1.5rem] sm:rounded-[2rem] p-5 sm:p-6 border-white/5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-luxury-gold/10 rounded-xl"><GraduationCap className="w-4 h-4 text-luxury-gold" /></div>
          <div>
            <h3 className="text-base font-serif text-white">{t("Study progress · ")}{formatClassName(profile?.classYear, profile?.classSection)}</h3>
            <p className="text-[10px] uppercase tracking-widest text-white/35">{t("Only you see this · tick \"Studied\" on a material")}</p>
          </div>
        </div>
        <span className="text-sm text-white/70 shrink-0">{done} / {total}</span>
      </div>
      <div className="space-y-2.5">
        {rows.map(r => {
          const { color, icon: Icon } = subjectStyle(r.subject);
          const pct = Math.round((r.done / r.total) * 100);
          return (
            <div key={r.subject} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-white/75"><Icon className="w-3.5 h-3.5" style={{ color }} /> {t(r.subject)}</span>
                <span className="text-white/45">{r.done} / {r.total}</span>
              </div>
              <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: color }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
