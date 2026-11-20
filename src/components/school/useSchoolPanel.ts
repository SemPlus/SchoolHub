import { useCallback, useEffect, useMemo, useState } from 'react';
import { collection, doc, getDocFromServer, getDocsFromServer, query, where } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAppData } from '../../context/AppData';
import type { Collection, Material, User } from '../../types';
import { loadActivation, type SchoolActivation } from '../../lib/aula';
import { mapCollectionDoc, mapMaterialDoc } from '../../lib/mappers';
import { isClosed, isLot, keptWorks, retiredMaterialIds } from '../../lib/lots';
import { formatClassName, parseClassLabel, schoolYearStart } from '../../lib/schoolYear';
import { mapSchoolWeek, studentsActive, weekDate, weekIndex, type SchoolWeek } from '../../lib/schoolPanel';
import { toDate } from '../../lib/utils';
import { mapTimetableDoc, type Timetable } from '../../lib/timetable';

export interface ClassRow {
  label: string;
  /** Students of this class with an account this school year. */
  enrolled: number;
  activeThisWeek: number;
  /** Average students active per week this school year (weeks the school used SchoolHub). */
  averageActive: number;
  works: number;
  lots: number;
  lastAula: Date | null;
}

export interface InheritedWork { work: Material; collection: Collection }

const DAY = 86_400_000;

/**
 * Everything the school panel and the annual report show, for one school.
 * Numbers only: per class, per subject, per week. Nothing about a single
 * student; teachers are named only in the list of sign-ups to confirm.
 */
export function useSchoolPanel(schoolId: string) {
  const { profile, materials: liveMaterials, collections: liveCollections } = useAppData();
  // The user's own school is already loaded live; another school (the founder) is fetched.
  const own = profile?.schoolId === schoolId;

  const [activation, setActivation] = useState<SchoolActivation | null>(null);
  const [fetched, setFetched] = useState<{ materials: Material[]; collections: Collection[] } | null>(null);
  const [directory, setDirectory] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<User[]>([]);
  const [weeks, setWeeks] = useState<SchoolWeek[]>([]);
  const [visits, setVisits] = useState<Map<string, Date>>(new Map());
  const [timetable, setTimetable] = useState<Timetable | null>(null);
  const [loading, setLoading] = useState(true);
  /** Some lists were refused (the database rules for the panel are not deployed yet). */
  const [unavailable, setUnavailable] = useState(false);

  const reload = useCallback(async () => {
    const bySchool = (name: string, ...more: ReturnType<typeof where>[]) =>
      getDocsFromServer(query(collection(db, name), where('schoolId', '==', schoolId), ...more));
    const [a, d, tch, w, v, m, c, tt] = await Promise.allSettled([
      loadActivation(schoolId),
      bySchool('directory'),
      bySchool('users', where('accountType', '==', 'teacher')),
      bySchool('schoolWeeks'),
      bySchool('aulaVisits'),
      own ? Promise.resolve(null) : bySchool('materials'),
      own ? Promise.resolve(null) : bySchool('collections'),
      getDocFromServer(doc(db, 'timetables', schoolId)),
    ]);
    if (tt.status === 'fulfilled') setTimetable(tt.value.exists() ? mapTimetableDoc(tt.value.data(), toDate) : null);
    if (a.status === 'fulfilled') setActivation(a.value);
    if (d.status === 'fulfilled') setDirectory(d.value.docs.map(x => x.data()));
    if (tch.status === 'fulfilled') setTeachers(tch.value.docs.map(x => ({ uid: x.id, ...(x.data() as any) } as User)));
    if (w.status === 'fulfilled') setWeeks(w.value.docs.map(x => mapSchoolWeek(x.data())));
    if (v.status === 'fulfilled') {
      setVisits(new Map(v.value.docs
        .map(x => [x.data().classLabel as string, toDate(x.data().lastSeenAt)] as const)
        .filter((e): e is readonly [string, Date] => !!e[1])
        .map(([k, date]) => [k, date])));
    }
    if (m.status === 'fulfilled' && c.status === 'fulfilled' && m.value && c.value) {
      setFetched({
        materials: m.value.docs.map(x => mapMaterialDoc(x.id, x.data())),
        collections: c.value.docs.map(x => mapCollectionDoc(x.id, x.data())),
      });
    }
    setUnavailable([d, tch, w, v].some(r => r.status === 'rejected'));
    setLoading(false);
  }, [schoolId, own]);

  useEffect(() => {
    setLoading(true);
    reload();
  }, [reload]);

  return useMemo(() => {
    const year = schoolYearStart();
    const yearStart = new Date(year, 8, 1);
    const thisWeek = weekIndex();

    const sourceMaterials = own ? liveMaterials : fetched?.materials ?? [];
    const sourceCollections = own ? liveCollections : fetched?.collections ?? [];
    const schoolCollections = sourceCollections.filter(c => c.schoolId === schoolId && !c.isDeleted);
    const retired = retiredMaterialIds(schoolCollections, sourceMaterials);
    // Works in the archive (trashed and retired ones left out).
    const schoolMaterials = sourceMaterials.filter(m => m.schoolId === schoolId && !m.isDeleted && !retired.has(m.id));
    const thisYear = (d: Date) => schoolYearStart(d) === year;
    const yearMaterials = schoolMaterials.filter(m => thisYear(m.createdAt));
    const yearLots = schoolCollections.filter(c => isLot(c) && thisYear(c.createdAt));
    const labelOf = (x: { classYear?: number; classSection?: string }) => formatClassName(x.classYear, x.classSection);

    // Best works passed on to the next classes (all years).
    const worksIn = (id: string) => schoolMaterials.filter(m => m.collectionId === id);
    const inherited: InheritedWork[] = schoolCollections
      .flatMap(c => {
        const works = isLot(c)
          ? (isClosed(c) ? keptWorks(c, worksIn(c.id)) : [])
          : schoolMaterials.filter(m => m.id === c.winnerMaterialId);
        return works.map(work => ({ work, collection: c }));
      })
      .sort((a, b) => b.collection.createdAt.getTime() - a.collection.createdAt.getTime());

    // Students with an account this school year, by class.
    const students = directory.filter(e => e.accountType !== 'teacher' && (!e.schoolYear || e.schoolYear === year));
    const enrolledBy = new Map<string, number>();
    for (const e of students) {
      const label = labelOf(e);
      if (label) enrolledBy.set(label, (enrolledBy.get(label) || 0) + 1);
    }

    // Weeks of this school year (the weeks the school used SchoolHub).
    const firstWeek = weekIndex(yearStart);
    const yearWeeks = weeks.filter(w => w.week >= firstWeek && w.week <= thisWeek).sort((a, b) => a.week - b.week);
    const current = weeks.find(w => w.week === thisWeek);

    const classSet = new Set<string>(activation?.extraClasses ?? []);
    enrolledBy.forEach((_, label) => classSet.add(label));
    for (const tch of teachers) (tch.teacherClasses || []).forEach(l => classSet.add(l));
    Object.keys(timetable?.grid ?? {}).forEach(l => classSet.add(l));
    for (const x of [...yearMaterials, ...yearLots]) { const l = labelOf(x); if (l) classSet.add(l); }
    const classes: ClassRow[] = [...classSet]
      .filter(l => parseClassLabel(l))
      .sort((a, b) => a.localeCompare(b, 'it', { numeric: true }))
      .map(label => ({
        label,
        enrolled: enrolledBy.get(label) || 0,
        activeThisWeek: current?.counts[label] || 0,
        averageActive: yearWeeks.length
          ? Math.round(yearWeeks.reduce((sum, w) => sum + (w.counts[label] || 0), 0) / yearWeeks.length)
          : 0,
        works: yearMaterials.filter(m => labelOf(m) === label).length,
        lots: yearLots.filter(c => labelOf(c) === label).length,
        lastAula: visits.get(label) || null,
      }));

    // Subjects: the ones taught here (teachers' subjects) and the ones with works this year.
    const subjectCount = new Map<string, number>();
    for (const tch of teachers) (tch.teacherSubjects || []).forEach(s => subjectCount.set(s, 0));
    for (const m of yearMaterials) if (m.subject) subjectCount.set(m.subject, (subjectCount.get(m.subject) || 0) + 1);
    subjectCount.delete('Other');
    const subjects = [...subjectCount.entries()]
      .map(([subject, count]) => ({ subject, count }))
      .sort((a, b) => a.count - b.count || a.subject.localeCompare(b.subject));

    const studentsActiveNow = studentsActive(current);
    const weekly = yearWeeks.map(w => ({ date: weekDate(w.week), students: studentsActive(w) }));
    const last12 = Array.from({ length: 12 }, (_, i) => thisWeek - 11 + i);

    return {
      loading,
      unavailable,
      activation,
      reload,
      year,
      // Before activation the name comes from the school's works.
      schoolName: activation?.name || schoolMaterials.find(m => m.schoolName)?.schoolName || schoolId,
      schoolCity: activation?.city || schoolMaterials.find(m => m.schoolCity)?.schoolCity || '',
      enrolled: students.length,
      studentsActiveNow,
      teachersActiveNow: current?.counts.teachers || 0,
      averageActive: weekly.length ? Math.round(weekly.reduce((s, w) => s + w.students, 0) / weekly.length) : 0,
      peakActive: weekly.reduce((max, w) => Math.max(max, w.students), 0),
      weekly,
      last12: {
        weeks: last12.map(weekDate),
        values: last12.map(w => studentsActive(weeks.find(x => x.week === w))),
      },
      worksYear: yearMaterials.length,
      worksTotal: schoolMaterials.length,
      lotsYear: yearLots.length,
      inherited,
      inheritedYear: inherited.filter(x => thisYear(x.collection.createdAt)),
      classes,
      classesInUse: classes.filter(c => c.lastAula && Date.now() - c.lastAula.getTime() < 7 * DAY).length,
      classesUsedThisYear: classes.filter(c => c.lastAula && c.lastAula >= yearStart).length,
      subjects,
      visits,
      timetable,
      pendingTeachers: teachers.filter(tch => tch.role === 'user'),
      confirmedTeachers: teachers.filter(tch => tch.role === 'teacher' || tch.role === 'admin').length,
    };
  }, [own, liveMaterials, liveCollections, fetched, schoolId, directory, teachers, weeks, visits, timetable, activation, loading, unavailable, reload]);
}

export type SchoolPanelData = ReturnType<typeof useSchoolPanel>;
