import type { User } from '../types';

/**
 * Italian school years start in September. Returns the start year of the
 * school year a date falls in: 12 Oct 2026 -> 2026, 10 Mar 2027 -> 2026.
 */
export function schoolYearStart(date: Date = new Date()): number {
  return date.getMonth() >= 8 ? date.getFullYear() : date.getFullYear() - 1;
}

/** 2026 -> "2026/27" */
export function formatSchoolYear(start: number): string {
  return `${start}/${String((start + 1) % 100).padStart(2, '0')}`;
}

export function maxClassYear(schoolGrade?: number): number {
  return schoolGrade === 1 ? 3 : 5;
}

export function formatClassName(classYear?: number, classSection?: string): string {
  if (!classYear || !classSection) return '';
  return `${classYear}${classSection}`;
}

export function classIdFor(schoolId?: string, classYear?: number, classSection?: string): string {
  if (!schoolId || !classYear || !classSection) return '';
  return `${schoolId}-${classYear}${classSection}`;
}

/** Section letters: 1 to 3 capital letters, e.g. "B" or "AS". */
export const SECTION_PATTERN = /^[A-Z]{1,3}$/;

export function sanitizeSection(value: string): string {
  return value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3);
}

/** True when the profile has a school and a class for the current school year. */
/** Teacher account, either chosen at sign-up or granted earlier by the founder. */
export function isTeacherAccount(profile: User | null | undefined): boolean {
  return profile?.accountType === 'teacher' || (!profile?.accountType && profile?.role === 'teacher');
}

/** "3B" -> { classYear: 3, classSection: "B" } */
export function parseClassLabel(label: string): { classYear: number; classSection: string } | null {
  const match = /^([1-5])([A-Z]{1,3})$/.exec(label);
  return match ? { classYear: Number(match[1]), classSection: match[2] } : null;
}

/** Classes the user belongs to or teaches, as labels such as "3B". */
export function classLabelsOf(profile: User | null | undefined): string[] {
  if (!profile) return [];
  if (isTeacherAccount(profile)) return (profile.teacherClasses || []).filter(l => parseClassLabel(l));
  const own = formatClassName(profile.classYear, profile.classSection);
  return own ? [own] : [];
}

/** True when the profile has what the app needs for the current school year. */
export function isProfileComplete(profile: User | null): boolean {
  if (!profile) return false;
  if (!profile.schoolId) return false;
  if ((profile.profileSchoolYear ?? 0) < schoolYearStart()) return false;
  if (isTeacherAccount(profile)) {
    return (profile.teacherClasses?.length ?? 0) > 0 && (profile.teacherSubjects?.length ?? 0) > 0;
  }
  return !!profile.classYear && !!profile.classSection;
}

/**
 * The class to suggest when a new school year starts: one grade up, capped
 * at the last grade of the school.
 */
export function suggestedClassYear(profile: User | null): number | undefined {
  if (!profile?.classYear) return undefined;
  const yearsPassed = Math.max(0, schoolYearStart() - (profile.profileSchoolYear ?? schoolYearStart()));
  return Math.min(profile.classYear + yearsPassed, maxClassYear(profile.schoolGrade));
}
