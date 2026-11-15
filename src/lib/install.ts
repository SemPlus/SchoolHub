// Installing SchoolHub as an app.
//
// The browser's install offer ("beforeinstallprompt", Chrome / Edge /
// Android / Samsung) fires once and early, so it is captured here at start-up
// and shared by the header button and the daily suggestion. Browsers without
// that offer (iPhone, Safari on Mac, Firefox on Android) get short steps.

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export type InstallPlatform = 'ios' | 'android' | 'android-firefox' | 'mac-safari' | 'desktop' | 'other';

const INSTALLED_KEY = 'schoolhub.installed';
const DAY_KEY = 'schoolhub.installSuggestedOn';

let deferred: BeforeInstallPromptEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();

function read(key: string): string | null {
  try { return window.localStorage.getItem(key); } catch { return null; }
}
function write(key: string, value: string) {
  try { window.localStorage.setItem(key, value); } catch { /* storage blocked */ }
}
function emit() {
  listeners.forEach(fn => fn());
}

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(display-mode: standalone)').matches
    || window.matchMedia?.('(display-mode: window-controls-overlay)').matches
    || (navigator as any).standalone === true;
}

/** Remembers that SchoolHub is installed on this device, so it is never suggested again. */
export function markInstalled() {
  installed = true;
  deferred = null;
  write(INSTALLED_KEY, '1');
  emit();
}

export function isInstalled(): boolean {
  return installed || isStandalone() || read(INSTALLED_KEY) === '1';
}

export function hasInstallPrompt(): boolean {
  return !!deferred;
}

export function onInstallChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferred = event as BeforeInstallPromptEvent;
    emit();
  });
  window.addEventListener('appinstalled', markInstalled);
  if (isStandalone()) markInstalled();
}

/** Opens the browser's own install window. */
export async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  const event = deferred;
  if (!event) return 'unavailable';
  await event.prompt();
  const { outcome } = await event.userChoice;
  deferred = null;
  if (outcome === 'accepted') markInstalled();
  else emit();
  return outcome;
}

/** Chrome can tell whether this web app is already installed (see manifest related_applications). */
export async function detectInstalledApp(): Promise<boolean> {
  const nav = navigator as any;
  if (typeof nav.getInstalledRelatedApps !== 'function') return false;
  try {
    const apps = await nav.getInstalledRelatedApps();
    if (Array.isArray(apps) && apps.length > 0) {
      markInstalled();
      return true;
    }
  } catch {
    // Not allowed here
  }
  return false;
}

export function installPlatform(): InstallPlatform {
  const ua = navigator.userAgent;
  const iPadAsMac = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
  if (/iPhone|iPad|iPod/i.test(ua) || iPadAsMac) return 'ios';
  if (/Android/i.test(ua)) return /Firefox/i.test(ua) ? 'android-firefox' : 'android';
  if (/Macintosh/.test(ua) && /Safari/.test(ua) && !/Chrome|Chromium|Edg|Firefox|OPR/.test(ua)) return 'mac-safari';
  if (/Mobi/i.test(ua)) return 'other';
  return 'desktop';
}

export function isPhoneOrTablet(): boolean {
  const p = installPlatform();
  return p === 'ios' || p === 'android' || p === 'android-firefox' || (p === 'other' && /Mobi/i.test(navigator.userAgent));
}

/** True when this browser can install SchoolHub (with its own window or with steps). */
export function canInstall(): boolean {
  if (isInstalled()) return false;
  if (deferred) return true;
  const p = installPlatform();
  return p === 'ios' || p === 'mac-safari' || p === 'android-firefox';
}

function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** The suggestion appears at most once per day the app is opened. */
export function suggestedToday(): boolean {
  return read(DAY_KEY) === today();
}

export function markSuggestedToday() {
  write(DAY_KEY, today());
}
