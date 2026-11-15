import React, { useMemo } from 'react';
import { Trophy, Medal, Users } from 'lucide-react';
import { useAppData } from '../context/AppData';
import { formatSchoolYear, schoolYearStart } from '../lib/schoolYear';
import { IMPACT_POINTS } from '../lib/stats';
import { cn } from '../lib/utils';

import { t } from '../lib/i18n';
interface SchoolRow {
  schoolId: string;
  name: string;
  city: string;
  score: number;
  contributors: number;
  materials: number;
}

/**
 * School-versus-school league for the current school year. Points come from
 * the same protected signals as personal impact (unique opens, saves,
 * teacher verifications, best works), earned by materials shared this year.
 */
export default function LeagueBoard() {
  const { materials, collections, profile } = useAppData();
  const year = schoolYearStart();

  const rows = useMemo(() => {
    const bySchool = new Map<string, SchoolRow & { authors: Set<string> }>();
    const thisYear = materials.filter(m => !m.isDeleted && m.schoolId && schoolYearStart(m.createdAt) === year);
    const materialSchool = new Map(thisYear.map(m => [m.id, m.schoolId!]));
    for (const m of thisYear) {
      const row = bySchool.get(m.schoolId!) ?? {
        schoolId: m.schoolId!, name: m.schoolName || m.schoolId!, city: m.schoolCity || '', score: 0, contributors: 0, materials: 0, authors: new Set<string>(),
      };
      row.materials += 1;
      row.authors.add(m.authorId);
      row.score += (m.downloadCount || 0) * IMPACT_POINTS.open + (m.saveCount || 0) * IMPACT_POINTS.save + (m.verifiedBy ? IMPACT_POINTS.verified : 0);
      bySchool.set(m.schoolId!, row);
    }
    for (const c of collections) {
      const school = c.winnerMaterialId ? materialSchool.get(c.winnerMaterialId) : undefined;
      if (school && bySchool.has(school)) bySchool.get(school)!.score += IMPACT_POINTS.bestWork;
    }
    return [...bySchool.values()]
      .map(({ authors, ...r }) => ({ ...r, contributors: authors.size }))
      .sort((a, b) => b.score - a.score || b.contributors - a.contributors);
  }, [materials, collections, year]);

  const myIndex = profile?.schoolId ? rows.findIndex(r => r.schoolId === profile.schoolId) : -1;
  const top = rows.slice(0, 25);

  return (
    <div className="space-y-6">
      <div className="glass-panel rounded-[1.5rem] sm:rounded-[2.5rem] p-5 sm:p-8 border-white/5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-amber-300/10 rounded-xl"><Trophy className="w-5 h-5 text-amber-300" /></div>
          <div>
            <h2 className="text-2xl font-serif text-white">{t("School league · ")}{formatSchoolYear(year)}</h2>
            <p className="text-xs text-white/45 mt-1">
              {t("Points for materials shared this school year: ")}{IMPACT_POINTS.open} {t(" per student who opens one, ")}{IMPACT_POINTS.save} {t(" per save,")}{' '}{IMPACT_POINTS.verified} {t(" per teacher verification, ")}{IMPACT_POINTS.bestWork} {t(" per best work.")}</p>
          </div>
        </div>
        {myIndex >= 0 && (
          <p className="mt-4 text-sm text-white/80">
            {t("Your school is ")}<span className="text-luxury-gold font-semibold">#{myIndex + 1}</span> {t(" of ")}{rows.length} {t(" with ")}{rows[myIndex].score} {t(" points.")}</p>
        )}
      </div>

      {rows.length === 0 ? (
        <div className="text-center py-20 glass-panel rounded-[2.5rem] border-white/5">
          <Medal className="w-14 h-14 text-white/10 mx-auto mb-4" />
          <p className="text-white/50">{t("No school has scored yet this year. Share something useful and put yours on the board.")}</p>
        </div>
      ) : (
        <ol className="space-y-2">
          {top.map((r, i) => (
            <li
              key={r.schoolId}
              className={cn(
                'flex items-center gap-4 p-4 rounded-2xl border',
                r.schoolId === profile?.schoolId ? 'border-luxury-gold/50 bg-luxury-gold/[0.07]' : 'border-white/5 bg-white/[0.02]'
              )}
            >
              <span className={cn('w-9 h-9 rounded-full flex items-center justify-center font-serif text-lg shrink-0',
                i === 0 ? 'bg-amber-300/20 text-amber-200' : i === 1 ? 'bg-slate-300/15 text-slate-200' : i === 2 ? 'bg-orange-400/15 text-orange-300' : 'bg-white/5 text-white/50')}>
                {i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white truncate">{r.name}</p>
                <p className="text-[10px] uppercase tracking-widest text-white/40 truncate flex items-center gap-1.5">
                  {r.city && <>{r.city} · </>}<Users className="w-3 h-3" /> {r.contributors} · {r.materials === 1 ? t("1 material") : t("{0} materials", r.materials)}</p>
              </div>
              <span className="text-lg font-serif text-luxury-gold shrink-0">{r.score}</span>
            </li>
          ))}
          {myIndex >= 25 && (
            <li className="flex items-center gap-4 p-4 rounded-2xl border border-luxury-gold/50 bg-luxury-gold/[0.07]">
              <span className="w-9 h-9 rounded-full flex items-center justify-center bg-white/5 text-white/60 font-serif shrink-0">{myIndex + 1}</span>
              <p className="flex-1 min-w-0 text-sm text-white truncate">{rows[myIndex].name}</p>
              <span className="text-lg font-serif text-luxury-gold shrink-0">{rows[myIndex].score}</span>
            </li>
          )}
        </ol>
      )}
    </div>
  );
}
