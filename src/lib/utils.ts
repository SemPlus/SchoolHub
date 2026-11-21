import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Normalises a Firestore Timestamp, a plain {seconds} object, a Date, a
 * string or a number into a Date. Returns null for empty or invalid input.
 */
export function toDate(value: unknown): Date | null {
  if (value === null || value === undefined || value === "") return null;

  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === "object") {
    const maybeTimestamp = value as { toDate?: () => Date; seconds?: number };
    if (typeof maybeTimestamp.toDate === "function") {
      return maybeTimestamp.toDate();
    }
    if (typeof maybeTimestamp.seconds === "number") {
      return new Date(maybeTimestamp.seconds * 1000);
    }
    return null;
  }

  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    return isNaN(parsed.getTime()) ? null : parsed;
  }

  return null;
}

/** The app's public address: change it here when SchoolHub moves to its own domain. */
export const APP_ORIGIN = 'https://school-hub-iota.vercel.app';

/** Link that opens a material in SchoolHub. */
export function materialLink(materialId: string): string {
  return `${APP_ORIGIN}/?material=${encodeURIComponent(materialId)}`;
}

/** Google Classroom's public "share to Classroom" page (no Google permissions needed). */
export function classroomShareUrl(url: string, title?: string): string {
  const params = new URLSearchParams({ url });
  if (title) params.set('title', title);
  return `https://classroom.google.com/share?${params.toString()}`;
}
