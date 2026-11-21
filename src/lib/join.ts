// Class poster links: https://…/?join=RMPS12345X-3B
// The invitation is remembered for the session, so it survives the Google
// sign-in popup and prefills the school and class during setup.

import { APP_ORIGIN } from './utils';

const KEY = 'schoolhub.join';
const PATTERN = /^([A-Z0-9]{10})-([1-5][A-Z]{1,3})$/;

export interface JoinInvite {
  schoolId: string;
  classLabel: string;
}

export function joinLinkFor(schoolId: string, classLabel: string): string {
  return `${APP_ORIGIN}/?join=${encodeURIComponent(`${schoolId}-${classLabel}`)}`;
}

/** Reads ?join= from the address bar (once) or from this session. */
export function readJoinInvite(): JoinInvite | null {
  try {
    const url = new URL(window.location.href);
    const raw = url.searchParams.get('join')?.toUpperCase();
    if (raw) {
      url.searchParams.delete('join');
      window.history.replaceState({}, '', url.toString());
      const match = PATTERN.exec(raw);
      if (match) {
        const invite = { schoolId: match[1], classLabel: match[2] };
        window.sessionStorage.setItem(KEY, JSON.stringify(invite));
        return invite;
      }
    }
    const stored = window.sessionStorage.getItem(KEY);
    return stored ? (JSON.parse(stored) as JoinInvite) : null;
  } catch {
    return null;
  }
}

export function clearJoinInvite(): void {
  try { window.sessionStorage.removeItem(KEY); } catch { /* ignore */ }
}
