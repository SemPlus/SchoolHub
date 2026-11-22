import { useEffect, useMemo } from 'react';
import { DEMO_AULA_PATH, DEMO_SCHOOL, demoData } from '../lib/demo';
import { buildSchoolPanel } from './school/useSchoolPanel';
import { SchoolPanelView } from './school/SchoolPanel';
import { t } from '../lib/i18n';

/** /scuole/demo: the school panel of the demo school, with example numbers. */
export default function DemoPanelPage() {
  const data = useMemo(() => {
    const d = demoData();
    return buildSchoolPanel({
      schoolId: DEMO_SCHOOL.id,
      materials: d.materials,
      collections: d.collections,
      directory: d.directory,
      teachers: d.teachers,
      weeks: d.weeks,
      visits: d.visits,
      timetable: d.timetable,
      teacherEmails: d.teacherEmails,
      activation: d.activation,
      loading: false,
      unavailable: false,
      reload: async () => {},
    });
  }, []);

  useEffect(() => {
    document.title = `${t("School panel")} · ${DEMO_SCHOOL.name} · SchoolHub`;
  }, []);

  return (
    <div className="min-h-screen bg-luxury-black text-white">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-8 py-6 sm:py-10 space-y-6">
        <nav className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[10px] uppercase tracking-widest text-white/45">
          <a href="/scuole" className="font-serif normal-case tracking-normal text-xl text-white hover:text-luxury-gold mr-auto">SchoolHub</a>
          <a href="/scuole" className="hover:text-white">{t("For schools")}</a>
          <a href={DEMO_AULA_PATH} className="hover:text-white">{t("Demo classroom")}</a>
        </nav>
        <p className="text-xs text-luxury-gold/90 border border-luxury-gold/25 bg-luxury-gold/[0.05] rounded-2xl px-4 py-3">
          {t("Demo school: example numbers, no real data. Links and the report work; changes are not saved.")}
        </p>
        <SchoolPanelView schoolId={DEMO_SCHOOL.id} data={data} demo />
      </div>
    </div>
  );
}
