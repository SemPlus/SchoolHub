import { format as dfFormat, formatDistanceToNow as dfFormatDistanceToNow, type Locale } from 'date-fns';
import { it as itLocale, enGB } from 'date-fns/locale';
import { IT } from './i18n.it';

// Interface language. The English text in the code is the key; Italian comes
// from the dictionary in i18n.it.ts and falls back to English when missing.
// Placeholders: t('Move "{0}" to Trash?', title).

export type Language = 'it' | 'en';

const STORAGE_KEY = 'schoolhub.language';

function initialLanguage(): Language {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === 'it' || stored === 'en') return stored;
  } catch {
    // Storage unavailable
  }
  // SchoolHub is for Italian schools: Italian by default, English on request.
  return 'it';
}

let current: Language = typeof window !== 'undefined' ? initialLanguage() : 'it';
const listeners = new Set<(lang: Language) => void>();

export function getLanguage(): Language {
  return current;
}

export function setLanguage(lang: Language): void {
  current = lang;
  try { window.localStorage.setItem(STORAGE_KEY, lang); } catch { /* ignore */ }
  document.documentElement.lang = lang;
  listeners.forEach(fn => fn(lang));
}

export function onLanguageChange(fn: (lang: Language) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Translate an English interface text. {0}, {1}… are replaced by the extra arguments. */
export function t(text: string, ...args: unknown[]): string {
  let template = text;
  if (current === 'it') {
    // Keys are looked up without surrounding spaces; the spaces are kept.
    const match = /^(\s*)([\s\S]*?)(\s*)$/.exec(text)!;
    const core = match[2];
    template = match[1] + (IT[core] ?? core) + match[3];
  }
  return args.length === 0 ? template : template.replace(/\{(\d+)\}/g, (match, i) => {
    const value = args[Number(i)];
    return value === undefined || value === null ? '' : String(value);
  });
}

/**
 * Like t(), for words whose translation depends on where they appear
 * ("Open" the button vs "Open" the status). Looks up "context|text" first.
 */
export function tc(context: string, text: string, ...args: unknown[]): string {
  const key = `${context}|${text}`;
  return current === 'it' && key in IT ? t(key, ...args) : t(text, ...args);
}

export function dateLocale(): Locale {
  return current === 'it' ? itLocale : enGB;
}

/** date-fns format in the interface language. */
export function format(date: Date | number, pattern: string): string {
  return dfFormat(date, pattern, { locale: dateLocale() });
}

/** date-fns formatDistanceToNow in the interface language. */
export function formatDistanceToNow(date: Date | number, options: { addSuffix?: boolean } = {}): string {
  return dfFormatDistanceToNow(date, { ...options, locale: dateLocale() });
}
