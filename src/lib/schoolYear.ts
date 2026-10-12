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
export function isProfileComplete(profile: User | null): boolean {
  if (!profile) return false;
  if (!profile.schoolId) return false;
  // Teachers teach many classes, so they only need a school.
  if (profile.role === 'teacher') return true;
  if (!profile.classYear || !profile.classSection) return false;
  return (profile.profileSchoolYear ?? 0) >= schoolYearStart();
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
