// Founder-only "view as": see SchoolHub as a student of any class, a teacher
// with chosen classes and subjects, or a signed-out visitor. Display only:
// the real profile is never changed, and every database write is refused
// while a simulation is on (see firestoreWrites.ts).

import { t } from './i18n';

export type SimulationMode = 'off' | 'student' | 'teacher' | 'visitor';

export interface Simulation {
  mode: SimulationMode;
  schoolId?: string;
  schoolName?: string;
  schoolCity?: string;
  schoolGrade?: 1 | 2;
  classYear?: number;
  classSection?: string;
  /** Teacher classes as labels such as "3B". */
  teacherClasses?: string[];
  teacherSubjects?: string[];
}

export const SIMULATION_OFF: Simulation = { mode: 'off' };

const KEY = 'schoolhub.simulation';
let active = false;

export function loadSimulation(): Simulation {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return SIMULATION_OFF;
    const parsed = JSON.parse(raw) as Simulation;
    return parsed && ['off', 'student', 'teacher', 'visitor'].includes(parsed.mode) ? parsed : SIMULATION_OFF;
  } catch {
    return SIMULATION_OFF;
  }
}

export function saveSimulation(simulation: Simulation) {
  try {
    if (simulation.mode === 'off') window.localStorage.removeItem(KEY);
    else window.localStorage.setItem(KEY, JSON.stringify(simulation));
  } catch {
    // Storage blocked: the simulation lasts until reload.
  }
}

/** Set by AppData: true only while the founder is viewing as someone else. */
export function setSimulationActive(value: boolean) {
  active = value;
}

export function isSimulationActive(): boolean {
  return active;
}

export class SimulationWriteError extends Error {
  code = 'simulation/read-only';
  constructor() {
    super(t("View-as is on: nothing is saved. Turn it off to make changes."));
  }
}

/** Throws while a simulation is on. Called before every database write. */
export function guardWrite() {
  if (active) throw new SimulationWriteError();
}

export function describeSimulation(s: Simulation): string {
  if (s.mode === 'visitor') return t("Signed-out visitor");
  if (s.mode === 'teacher') {
    const classes = (s.teacherClasses || []).join(', ') || t("no class");
    return t("Teacher · {0}", classes) + (s.schoolName ? ` · ${s.schoolName}` : '');
  }
  if (s.mode === 'student') {
    const cls = s.classYear ? `${s.classYear}${s.classSection || ''}` : t("no class");
    return t("Student · {0}", cls) + (s.schoolName ? ` · ${s.schoolName}` : '');
  }
  return '';
}
