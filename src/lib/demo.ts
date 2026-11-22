import type { Collection, Material, User } from '../types';
import type { SchoolActivation } from './aula';
import type { SchoolOption } from './schools';
import type { SchoolWeek } from './schoolPanel';
import { weekDate, weekIndex } from './schoolPanel';
import { schoolYearStart } from './schoolYear';
import type { Timetable } from './timetable';

// The demo school ("Liceo Demo") for principals: a classroom link that works
// (/aula/LICEODEMO-4A) and a school panel with example numbers (/scuole/demo).
// Everything lives here, in the app: nothing is written to the database, so
// the demo never shows up in the real archive or in anyone's numbers.
// The example works open small presentations in public/demo/.

export const DEMO_SCHOOL: SchoolOption = {
  id: 'LICEODEMO',
  name: 'Liceo Demo',
  type: 'Liceo',
  city: 'Roma',
  province: 'RM',
  grade: 2,
};

export const DEMO_CLASS = '4A';
export const DEMO_AULA_PATH = `/aula/${DEMO_SCHOOL.id}-${DEMO_CLASS}`;
export const DEMO_PANEL_PATH = '/scuole/demo';

export function isDemoSchool(schoolId: string | null | undefined): boolean {
  return schoolId === DEMO_SCHOOL.id;
}

const DAY = 86_400_000;
const DOMAIN = 'scuola.example';

/** Classes of the demo school and their students with an account. */
const CLASS_SIZES: Record<string, number> = { '1A': 27, '2A': 25, '3A': 24, '4A': 22, '5A': 21 };

/** A small deterministic "random" so the numbers stay the same at every visit. */
function noise(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

export interface DemoData {
  activation: SchoolActivation;
  materials: Material[];
  collections: Collection[];
  timetable: Timetable;
  directory: any[];
  teachers: User[];
  teacherEmails: string[];
  weeks: SchoolWeek[];
  visits: Map<string, Date>;
}

let cached: { at: number; data: DemoData } | null = null;

/** The demo school's data, with dates around today (rebuilt at most once an hour). */
export function demoData(now = Date.now()): DemoData {
  if (cached && now - cached.at < 3_600_000) return cached.data;
  const data = build(now);
  cached = { at: now, data };
  return data;
}

function build(now: number): DemoData {
  const year = schoolYearStart(new Date(now));
  const yearStart = new Date(year, 8, 1).getTime();
  /** n days ago, but never before this school year started. */
  const ago = (days: number, hours = 0) => new Date(Math.max(now - days * DAY - hours * 3_600_000, yearStart + 12 * 3_600_000 + days * 60_000));
  /** A date in the previous school year. */
  const lastYear = (month: number, day: number) => new Date(month >= 8 ? year - 1 : year, month, day, 10);

  const school = { schoolId: DEMO_SCHOOL.id, schoolName: DEMO_SCHOOL.name, schoolCity: DEMO_SCHOOL.city };
  const cls = (label: string) => ({ classYear: Number(label[0]), classSection: label.slice(1), className: label, classId: `${DEMO_SCHOOL.id}-${label}` });

  let n = 0;
  const work = (w: Partial<Material> & { title: string; deck?: string; subject: string; label: string; authorName: string; createdAt: Date }): Material => {
    n += 1;
    const { deck, label, ...rest } = w;
    return {
      id: `demo-m${n}`,
      type: 'link' as Material['type'],
      url: `/demo/${deck || 'esempio'}.html`,
      authorId: `demo-u${n}`,
      tags: [],
      downloadCount: 3 + Math.round(noise(n) * 30),
      rightsConfirmed: true,
      kind: 'slides',
      ...school,
      ...cls(label),
      ...rest,
    } as Material;
  };
  const lot = (c: Partial<Collection> & { id: string; title: string; subject: string; label: string; createdByName: string; createdAt: Date }): Collection => {
    const { label, ...rest } = c;
    return {
      createdBy: `demo-t-${c.id}`,
      isLot: true,
      lotType: 'same',
      ...school,
      ...cls(label),
      ...rest,
    } as Collection;
  };

  const collections: Collection[] = [
    // 4A, this year: an open History lot (the classroom opens it first).
    lot({ id: 'demo-lot-rinascimento', title: 'Il Rinascimento a Firenze', subject: 'History', label: '4A', createdByName: 'Prof. Marco Valli', createdAt: ago(12), dueAt: new Date(now + 5 * DAY) }),
    // 4A, this year: a closed Philosophy lot with the best work chosen.
    lot({ id: 'demo-lot-cartesio', title: 'Cartesio', subject: 'Philosophy', label: '4A', createdByName: 'Prof.ssa Chiara Fontana', createdAt: ago(20), closedAt: ago(2), winnerMaterialId: 'demo-m4' }),
    // Last year's 4th classes: the best works passed on.
    lot({ id: 'demo-lot-riforma', title: 'La Riforma protestante', subject: 'History', label: '4B', createdByName: 'Prof. Marco Valli', createdAt: lastYear(2, 2), closedAt: lastYear(2, 20), winnerMaterialId: 'demo-m6' }),
    lot({ id: 'demo-lot-sonetto', title: 'Il sonetto', subject: 'Italian', label: '4A', createdByName: 'Prof.ssa Anna Ricci', createdAt: lastYear(10, 10), closedAt: lastYear(10, 28), winnerMaterialId: 'demo-m7' }),
    // Other classes, this year.
    lot({ id: 'demo-lot-guerra', title: 'La Grande Guerra', subject: 'History', label: '5A', createdByName: 'Prof. Marco Valli', createdAt: ago(9) }),
    lot({ id: 'demo-lot-coniche', title: 'Le coniche', subject: 'Mathematics', label: '3A', createdByName: 'Prof. Paolo Conti', createdAt: ago(15), closedAt: ago(4), winnerMaterialId: 'demo-m13' }),
  ];

  const materials: Material[] = [
    // 1–3: the open lot of 4A.
    work({ title: 'Firenze e i Medici', deck: 'medici', subject: 'History', label: '4A', authorName: 'Giulia Rinaldi', createdAt: ago(6), collectionId: 'demo-lot-rinascimento',
      description: 'Come una famiglia di banchieri ha guidato Firenze e finanziato gli artisti del Quattrocento.' }),
    work({ title: 'Leonardo, ingegnere e artista', deck: 'leonardo', subject: 'History', label: '4A', authorName: 'Marco Testa', coAuthorNames: ['Sara Lombardi'], coAuthorIds: ['demo-u-sara'], createdAt: ago(4), collectionId: 'demo-lot-rinascimento',
      description: 'Le macchine, gli studi e i quadri: un solo metodo, osservare.' }),
    work({ title: 'La stampa cambia l’Europa', deck: 'stampa', subject: 'History', label: '4A', authorName: 'Luca Bassi', createdAt: ago(1, 3), collectionId: 'demo-lot-rinascimento',
      description: 'Gutenberg, i caratteri mobili e la diffusione dei libri.' }),
    // 4: the best work of the closed Philosophy lot.
    work({ title: 'Cartesio e il dubbio metodico', deck: 'cartesio', subject: 'Philosophy', label: '4A', authorName: 'Davide Ferri', createdAt: ago(8), collectionId: 'demo-lot-cartesio',
      description: 'Dal dubbio al "penso, dunque sono", in sei passaggi.' }),
    // 5: a Physics material of the class, verified by the teacher.
    work({ title: 'Il moto parabolico', deck: 'parabolico', subject: 'Physics', label: '4A', authorName: 'Prof.ssa Laura Gatti', createdAt: ago(10), kind: 'notes',
      verifiedBy: 'demo-teacher-physics', verifiedByName: 'Prof.ssa Laura Gatti', verifiedAt: ago(10),
      description: 'Lancio di un oggetto: le due componenti del moto, la gittata, un esempio svolto.' }),
    // 6–7: inherited from last year.
    work({ title: 'Lutero e le 95 tesi', deck: 'riforma', subject: 'History', label: '4B', authorName: 'Elena Costa', createdAt: lastYear(2, 12), collectionId: 'demo-lot-riforma',
      description: 'Perché un monaco tedesco ha diviso la Chiesa d’Occidente.' }),
    work({ title: 'Il sonetto in sei slide', deck: 'sonetto', subject: 'Italian', label: '4A', authorName: 'Tommaso Greco', createdAt: lastYear(10, 20), collectionId: 'demo-lot-sonetto',
      description: 'Quattordici versi, due quartine e due terzine: come si legge un sonetto.' }),
    // Other classes (they count in the panel; they open a short example page).
    work({ title: 'La guerra di trincea', subject: 'History', label: '5A', authorName: 'Irene Marchi', createdAt: ago(3), collectionId: 'demo-lot-guerra' }),
    work({ title: 'Dieci date della Grande Guerra', subject: 'History', label: '5A', authorName: 'Pietro Sala', createdAt: ago(2), collectionId: 'demo-lot-guerra' }),
    work({ title: 'Pirandello e le maschere', subject: 'Italian', label: '5A', authorName: 'Alice Moretti', createdAt: ago(16) }),
    work({ title: 'L’induzione elettromagnetica', subject: 'Physics', label: '5A', authorName: 'Nicola Villa', createdAt: ago(11) }),
    work({ title: 'Catullo, il poeta dell’amore', subject: 'Latin', label: '3A', authorName: 'Martina De Luca', createdAt: ago(13) }),
    work({ title: 'Le coniche: parabola ed ellisse', subject: 'Mathematics', label: '3A', authorName: 'Riccardo Fabbri', createdAt: ago(7), collectionId: 'demo-lot-coniche' }),
    work({ title: 'Chaucer and the pilgrims', subject: 'English', label: '3A', authorName: 'Sofia Bruno', createdAt: ago(5) }),
    work({ title: 'La cellula in una mappa', subject: 'Natural Sciences', label: '2A', authorName: 'Gabriele Rizzi', createdAt: ago(9) }),
    work({ title: 'I promessi sposi, capitoli 1–8', subject: 'Italian', label: '2A', authorName: 'Beatrice Longo', createdAt: ago(14) }),
    work({ title: 'Achille e l’ira', subject: 'Italian', label: '1A', authorName: 'Emma Ferrara', createdAt: ago(6) }),
  ];

  // Timetable: 4A only has the subjects with works, so the classroom always has something to open.
  const periods = [
    { start: '08:00', end: '08:55' }, { start: '08:55', end: '09:50' }, { start: '09:50', end: '10:45' },
    { start: '11:00', end: '11:55' }, { start: '11:55', end: '12:50' }, { start: '12:50', end: '13:45' },
  ];
  const H = 'History', P = 'Philosophy', F = 'Physics', I = 'Italian', M = 'Mathematics', E = 'English', L = 'Latin', S = 'Natural Sciences';
  const grid: Timetable['grid'] = {
    '4A': { '1': [I, I, H, P, F, F], '2': [P, H, I, F, I, H], '3': [F, F, P, H, I, I], '4': [H, I, I, P, P, F], '5': [I, P, F, H, H, I] },
    '5A': { '1': [M, F, I, I, H, E], '2': [L, L, P, F, M, M], '3': [I, H, E, S, F, P], '4': [M, M, I, L, H, E], '5': [F, P, S, I, I, M] },
    '3A': { '1': [L, M, M, E, I, S], '2': [I, I, H, P, F, L], '3': [M, E, L, I, S, H], '4': [P, F, M, M, I, E], '5': [S, L, I, H, M, F] },
    '2A': { '1': [I, I, M, E, L, S], '2': [M, L, I, S, E, H], '3': [E, M, L, I, I, S], '4': [L, I, S, M, H, E], '5': [M, H, E, L, I, I] },
    '1A': { '1': [M, I, I, L, E, S], '2': [L, M, S, I, H, E], '3': [I, E, M, L, S, I], '4': [H, L, I, M, E, M], '5': [S, I, L, E, M, I] },
  };
  const timetable: Timetable = { periods, grid, subjectMap: {}, source: 'asc', updatedAt: new Date(yearStart + 10 * DAY) };

  // Students with an account (numbers only, as in the real panel).
  const directory = Object.entries(CLASS_SIZES).flatMap(([label, size]) =>
    Array.from({ length: size }, () => ({ accountType: 'student', classYear: Number(label[0]), classSection: label.slice(1), schoolYear: year })));

  const teacher = (uid: string, name: string, subjects: string[], classes: string[], role: User['role'] = 'teacher'): User => ({
    uid, displayName: name, email: `${name.split(' ').slice(-2).join('.').toLowerCase().replace(/[^a-z.]/g, '')}@${DOMAIN}`,
    photoURL: null, role, accountType: 'teacher', schoolId: DEMO_SCHOOL.id, teacherSubjects: subjects, teacherClasses: classes, createdAt: null,
  });
  const teachers: User[] = [
    teacher('demo-t1', 'Prof. Marco Valli', ['History', 'Philosophy'], ['4A', '5A']),
    teacher('demo-t2', 'Prof.ssa Chiara Fontana', ['Philosophy', 'History'], ['3A', '4A']),
    teacher('demo-t3', 'Prof.ssa Anna Ricci', ['Italian', 'Latin'], ['4A', '5A']),
    teacher('demo-t4', 'Prof.ssa Laura Gatti', ['Physics', 'Mathematics'], ['4A', '5A']),
    teacher('demo-t5', 'Prof. Paolo Conti', ['Mathematics', 'Physics'], ['1A', '2A', '3A']),
    teacher('demo-t6', 'Prof.ssa Giorgia Neri', ['English'], ['1A', '2A', '3A', '4A', '5A']),
    teacher('demo-t7', 'Prof. Stefano Riva', ['Natural Sciences'], ['1A', '2A', '3A']),
    teacher('demo-t8', 'Prof. Andrea Serra', ['Italian', 'Latin'], ['1A', '2A', '3A']),
    // Waiting for the school to confirm.
    teacher('demo-t9', 'Prof.ssa Elisa Monti', ['Art & Art History'], ['3A', '4A', '5A'], 'user'),
  ];
  const teacherEmails = teachers.slice(0, 4).map(x => x.email!).sort();

  // Weekly active students: none in the summer and at Christmas, growing over the year.
  const thisWeek = weekIndex(now);
  const weeks: SchoolWeek[] = [];
  for (let w = thisWeek - 40; w <= thisWeek; w++) {
    const date = weekDate(w);
    const month = date.getMonth();
    const closed = month === 6 || month === 7 || (month === 11 && date.getDate() > 22) || (month === 0 && date.getDate() < 6) || (month === 8 && date.getDate() < 12);
    if (closed) continue;
    const progress = Math.min(1, (w - (thisWeek - 40)) / 40);
    const counts: Record<string, number> = {};
    let total = 0;
    Object.entries(CLASS_SIZES).forEach(([label, size], i) => {
      const share = 0.42 + 0.38 * progress + (noise(w * 7 + i) - 0.5) * 0.18;
      const value = Math.max(0, Math.min(size, Math.round(size * share)));
      counts[label] = value;
      total += value;
    });
    counts.teachers = 5 + Math.round(noise(w) * 3);
    total += counts.teachers;
    weeks.push({ week: w, total, counts });
  }

  const visits = new Map<string, Date>([
    ['4A', new Date(now - 40 * 60_000)],
    ['5A', new Date(now - 1 * DAY - 2 * 3_600_000)],
    ['3A', new Date(now - 2 * DAY)],
    ['2A', new Date(now - 6 * DAY)],
  ]);

  const activation: SchoolActivation = {
    id: DEMO_SCHOOL.id,
    activated: true,
    plan: 'private',
    name: DEMO_SCHOOL.name,
    city: DEMO_SCHOOL.city,
    activatedUntil: new Date(year + 1, 7, 31, 23, 59, 59),
    extraClasses: [],
    teacherDomains: [DOMAIN],
  };

  return { activation, materials, collections, timetable, directory, teachers, teacherEmails, weeks, visits };
}
