import { SUBJECTS } from './subjects';

// The class timetable ("orario"): uploaded once a year by the school's
// admins from the file their timetable program exports (aSc Orari XML,
// Untis GPU001.TXT) or from our CSV template. Stored in timetables/{schoolId}
// and public, because the classroom screen reads it without a sign-in, so it
// holds only class, day, period, subject and bell times: no teacher names
// and no rooms, even when the file has them.

export interface Period { start: string; end: string }

/** Class label ("4G") → day ("1" = Monday … "6" = Saturday) → subject per period ('' = free). */
export type TimetableGrid = Record<string, Record<string, string[]>>;

export type TimetableSource = 'asc' | 'untis' | 'csv' | 'manual';

export interface Timetable {
  periods: Period[];
  grid: TimetableGrid;
  /** The school's own subject names → SchoolHub subjects, remembered for the next upload. */
  subjectMap: Record<string, string>;
  source: TimetableSource;
  updatedAt: Date | null;
}

export const DAYS = [1, 2, 3, 4, 5, 6] as const;
export const MAX_PERIODS = 12;

/** One lesson read from a file, before its subject is matched. */
export interface RawLesson { classLabel: string; day: number; period: number; subject: string }

export interface ParsedTimetable {
  source: Exclude<TimetableSource, 'manual'>;
  periods: Period[];
  lessons: RawLesson[];
  /** The school's subject names, with their short code when the file has one. */
  subjects: { label: string; short: string }[];
  /** Class names in the file that are not of the form "4G". */
  skippedClasses: string[];
}

export class TimetableParseError extends Error {}

// ------------------------------------------------------------------ helpers

/** "8:05" → "08:05"; anything else → ''. */
export function normalizeTime(value: string | undefined | null): string {
  const match = /^\s*(\d{1,2})[:.](\d{2})/.exec(value || '');
  if (!match) return '';
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 23 || m > 59) return '';
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

const ROMAN: Record<string, number> = { I: 1, II: 2, III: 3, IV: 4, V: 5 };

/** "4G", "4^G", "4 G liceo", "IV G", "1A_SC" → "4G" … ; null when it is not a class. */
export function normalizeClassLabel(name: string): string | null {
  const s = name.toUpperCase().trim();
  const arabic = /^([1-5])\s*[°^ª]?\s*([A-Z]{1,3})(?![A-Z])/.exec(s);
  if (arabic) return arabic[1] + arabic[2];
  const roman = /^(V|IV|III|II|I)\s*[°^ª]?\s*([A-Z]{1,3})(?![A-Z])/.exec(s);
  if (roman) return ROMAN[roman[1]] + roman[2];
  return null;
}

const DAY_NAMES: Record<string, number> = {
  lun: 1, lunedi: 1, mon: 1, monday: 1, lu: 1, mo: 1,
  mar: 2, martedi: 2, tue: 2, tuesday: 2, ma: 2, tu: 2,
  mer: 3, mercoledi: 3, wed: 3, wednesday: 3, me: 3, we: 3,
  gio: 4, giovedi: 4, thu: 4, thursday: 4, gi: 4, th: 4,
  ven: 5, venerdi: 5, fri: 5, friday: 5, ve: 5, fr: 5,
  sab: 6, sabato: 6, sat: 6, saturday: 6, sa: 6,
};

function plain(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

/** "lunedì", "Mon", "1" → 1 … 6; 0 when unknown. */
export function parseDay(value: string): number {
  const v = plain(value).replace(/\.$/, '');
  if (/^[1-6]$/.test(v)) return Number(v);
  return DAY_NAMES[v] ?? 0;
}

// ---------------------------------------------------------- subject matching

// Order matters: the more specific names come first.
const SUBJECT_RULES: [RegExp, string][] = [
  [/storia dell.?arte|^st\.? ?arte|disegno|arte|^dis$|^art$/, 'Art & Art History'],
  [/scienze umane|psicolog|pedagog|^scu$/, 'Human Sciences'],
  [/motori|educazione fisica|ed\.? ?fis|sport|^edf$|^sms$|^smo$/, 'Physical Education'],
  [/civic|cittadinanza/, 'Civic Education'],
  [/religion|^irc$|^rel$|alternativa/, 'Religion'],
  [/geostoria|storia e geo/, 'History'],
  [/storia|^sto$/, 'History'],
  [/geograf|^geo$/, 'Geography'],
  [/filosof|^fil$/, 'Philosophy'],
  [/matemat|^mat$/, 'Mathematics'],
  [/fisica|^fis$/, 'Physics'],
  [/chimic|^chi$/, 'Chemistry'],
  [/scienze|biolog|^sci$|^scn$/, 'Natural Sciences'],
  [/informatic|^inf$/, 'Computer Science'],
  [/latin|^lat$/, 'Latin'],
  [/grec|^gre$|^gr$/, 'Ancient Greek'],
  [/ingles|english|^ing$|^eng$/, 'English'],
  [/frances|^fra$/, 'French'],
  [/spagnol|^spa$/, 'Spanish'],
  [/tedesc|^ted$/, 'German'],
  [/italian|^ita$/, 'Italian'],
  [/music|^mus$/, 'Music'],
  [/tecnolog|^tec$/, 'Technology'],
  [/diritto|econom|^dir$|^eco$/, 'Law & Economics'],
  [/aziendal/, 'Business'],
];

/** Best guess of the SchoolHub subject for a school's subject name or code; '' when unsure. */
export function guessSubject(label: string, short = ''): string {
  for (const text of [label, short]) {
    const v = plain(text);
    if (!v) continue;
    // English names of our own list match directly.
    const own = SUBJECTS.find(s => plain(s) === v);
    if (own) return own;
    for (const [re, subject] of SUBJECT_RULES) if (re.test(v)) return subject;
  }
  return '';
}

// ------------------------------------------------------------- aSc Orari XML

function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}

/** All elements with a given tag, as attribute maps (aSc files use attributes only). */
function elements(xml: string, tag: string): Record<string, string>[] {
  const out: Record<string, string>[] = [];
  const re = new RegExp(`<${tag}\\b([^>]*?)\\/?>`, 'gi');
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    const attrs: Record<string, string> = {};
    const attrRe = /([\w:-]+)\s*=\s*("([^"]*)"|'([^']*)')/g;
    let a: RegExpExecArray | null;
    while ((a = attrRe.exec(m[1]))) attrs[a[1].toLowerCase()] = decodeEntities(a[3] ?? a[4] ?? '');
    out.push(attrs);
  }
  return out;
}

/** Days of a card: "10000" (one flag per day), or a day number. */
function cardDays(card: Record<string, string>, dayDefs: Map<string, string>): number[] {
  let flags = card.days || '';
  if (!flags && card.daysdefid) flags = dayDefs.get(card.daysdefid) || '';
  if (/^[01]+$/.test(flags)) return [...flags].flatMap((f, i) => (f === '1' && i < 6 ? [i + 1] : []));
  const n = Number(card.day ?? flags);
  return Number.isInteger(n) && n >= 0 && n < 6 ? [n + 1] : [];
}

export function parseAsc(xml: string): ParsedTimetable {
  if (!/<timetable\b/i.test(xml)) throw new TimetableParseError('not-asc');
  const periodRows = elements(xml, 'period')
    .map(p => ({ n: Number(p.period ?? p.name), start: normalizeTime(p.starttime), end: normalizeTime(p.endtime) }))
    .filter(p => Number.isInteger(p.n) && p.n >= 1 && p.n <= MAX_PERIODS);
  const subjects = new Map(elements(xml, 'subject').map(s => [s.id, { label: (s.name || s.short || '').trim(), short: (s.short || '').trim() }]));
  const classes = new Map(elements(xml, 'class').map(c => [c.id, (c.name || c.short || '').trim()]));
  const lessons = new Map(elements(xml, 'lesson').map(l => [l.id, l]));
  const dayDefs = new Map(elements(xml, 'daysdef').map(d => [d.id, d.days || '']));

  const out: RawLesson[] = [];
  const skipped = new Set<string>();
  for (const card of elements(xml, 'card')) {
    const lesson = lessons.get(card.lessonid);
    if (!lesson) continue;
    const subject = subjects.get(lesson.subjectid);
    if (!subject?.label) continue;
    const start = Number(card.period);
    const span = Math.max(1, Number(lesson.periodspercard) || 1);
    const days = cardDays(card, dayDefs);
    for (const classId of (lesson.classids || '').split(',').map(s => s.trim()).filter(Boolean)) {
      const name = classes.get(classId);
      if (!name) continue;
      const label = normalizeClassLabel(name);
      if (!label) { skipped.add(name); continue; }
      for (const day of days) {
        for (let p = start; p < start + span; p++) {
          if (p >= 1 && p <= MAX_PERIODS) out.push({ classLabel: label, day, period: p, subject: subject.label });
        }
      }
    }
  }
  const used = new Set(out.map(l => l.subject));
  return {
    source: 'asc',
    periods: periodsFrom(periodRows, out),
    lessons: out,
    subjects: [...new Map([...subjects.values()].filter(s => used.has(s.label)).map(s => [s.label, s])).values()],
    skippedClasses: [...skipped],
  };
}

// --------------------------------------------------------------- CSV & Untis

/** Splits one CSV line (comma or semicolon, double quotes). */
function splitCsvLine(line: string, sep: string): string[] {
  const out: string[] = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === sep) { out.push(cur.trim()); cur = ''; }
    else cur += ch;
  }
  out.push(cur.trim());
  return out;
}

function csvRows(text: string): string[][] {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter(l => l.trim());
  if (lines.length === 0) return [];
  const first = lines[0];
  const sep = (first.match(/;/g) || []).length >= (first.match(/,/g) || []).length ? ';' : ',';
  return lines.map(l => splitCsvLine(l, sep));
}

const HEADER: Record<string, 'class' | 'day' | 'period' | 'subject' | 'start' | 'end'> = {
  classe: 'class', class: 'class', giorno: 'day', day: 'day', ora: 'period', period: 'period', hour: 'period',
  materia: 'subject', subject: 'subject', inizio: 'start', start: 'start', fine: 'end', end: 'end',
};

/** Our template: classe;giorno;ora;materia[;inizio;fine]. */
export function parseTemplateCsv(text: string): ParsedTimetable {
  const rows = csvRows(text);
  const head = (rows[0] || []).map(h => HEADER[plain(h)]);
  if (!head.includes('class') || !head.includes('day') || !head.includes('period') || !head.includes('subject')) {
    throw new TimetableParseError('not-template');
  }
  const col = (name: string) => head.indexOf(name as any);
  const [ci, di, pi, si, bi, ei] = ['class', 'day', 'period', 'subject', 'start', 'end'].map(col);
  const lessons: RawLesson[] = [];
  const skipped = new Set<string>();
  const times: { n: number; start: string; end: string }[] = [];
  for (const row of rows.slice(1)) {
    const name = row[ci] || '';
    const label = normalizeClassLabel(name);
    const day = parseDay(row[di] || '');
    const period = Number(row[pi]);
    const subject = (row[si] || '').trim();
    if (bi >= 0 && Number.isInteger(period)) times.push({ n: period, start: normalizeTime(row[bi]), end: normalizeTime(row[ei]) });
    if (!name.trim() && !subject) continue;
    if (!label) { if (name.trim()) skipped.add(name.trim()); continue; }
    if (!day || !Number.isInteger(period) || period < 1 || period > MAX_PERIODS || !subject) continue;
    lessons.push({ classLabel: label, day, period, subject });
  }
  return {
    source: 'csv',
    periods: periodsFrom(times, lessons),
    lessons,
    subjects: [...new Set(lessons.map(l => l.subject))].map(label => ({ label, short: '' })),
    skippedClasses: [...skipped],
  };
}

/**
 * Untis GPU001.TXT (timetable export): lesson number, class, teacher,
 * subject, room, day (1 = Monday), period, …; no header, no bell times.
 */
export function parseUntis(text: string): ParsedTimetable {
  const rows = csvRows(text).filter(r => r.length >= 7);
  const valid = rows.filter(r => /^\d+$/.test(r[5]) && /^\d+$/.test(r[6]));
  if (rows.length === 0 || valid.length < rows.length * 0.8) throw new TimetableParseError('not-untis');
  const lessons: RawLesson[] = [];
  const skipped = new Set<string>();
  for (const r of valid) {
    const day = Number(r[5]);
    const period = Number(r[6]);
    const subject = r[3].trim();
    if (day < 1 || day > 6 || period < 1 || period > MAX_PERIODS || !subject) continue;
    // A lesson can list several classes ("4G 4H").
    for (const name of r[1].split(/[\s,]+/).filter(Boolean)) {
      const label = normalizeClassLabel(name);
      if (!label) { skipped.add(name); continue; }
      lessons.push({ classLabel: label, day, period, subject });
    }
  }
  return {
    source: 'untis',
    periods: periodsFrom([], lessons),
    lessons,
    subjects: [...new Set(lessons.map(l => l.subject))].map(label => ({ label, short: label })),
    skippedClasses: [...skipped],
  };
}

/** Reads any supported file; throws TimetableParseError when it is none of them. */
export function parseTimetableFile(text: string): ParsedTimetable {
  const parsed = /^\s*(<\?xml|<timetable)/i.test(text)
    ? parseAsc(text)
    : (() => {
        try { return parseTemplateCsv(text); } catch { return parseUntis(text); }
      })();
  if (parsed.lessons.length === 0) throw new TimetableParseError('empty');
  return parsed;
}

/** Text of an uploaded file: UTF-8, or the Windows encoding older programs use. */
export async function readTimetableFile(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    return new TextDecoder('windows-1252').decode(buffer);
  }
}

// ------------------------------------------------------------- periods & grid

/** Hourly from 08:00 when the file has no bell times. */
export function defaultPeriod(n: number): Period {
  const pad = (h: number) => `${String(h).padStart(2, '0')}:00`;
  return { start: pad(7 + n), end: pad(8 + n) };
}

function periodsFrom(rows: { n: number; start: string; end: string }[], lessons: RawLesson[]): Period[] {
  const count = Math.min(MAX_PERIODS, Math.max(5, ...lessons.map(l => l.period), ...rows.map(r => r.n)));
  return Array.from({ length: count }, (_, i) => {
    const row = rows.find(r => r.n === i + 1 && r.start && r.end);
    return row ? { start: row.start, end: row.end } : defaultPeriod(i + 1);
  });
}

/** Lessons with matched subjects → grid. The first lesson of a slot wins (e.g. split groups). */
export function buildGrid(lessons: RawLesson[], mapping: Record<string, string>, periodCount: number): TimetableGrid {
  const grid: TimetableGrid = {};
  for (const l of lessons) {
    const subject = mapping[l.subject];
    if (!subject || l.period > periodCount) continue;
    const days = (grid[l.classLabel] ||= {});
    const row = (days[String(l.day)] ||= Array(periodCount).fill(''));
    if (!row[l.period - 1]) row[l.period - 1] = subject;
  }
  return grid;
}

export function emptyDay(periodCount: number): string[] {
  return Array(periodCount).fill('');
}

/** Number of lessons with a subject in a grid. */
export function lessonCount(grid: TimetableGrid): number {
  return Object.values(grid).reduce((sum, days) => sum + Object.values(days).reduce((s, row) => s + row.filter(Boolean).length, 0), 0);
}

export function mapTimetableDoc(data: any, toDate: (v: unknown) => Date | null): Timetable {
  return {
    periods: Array.isArray(data?.periods) ? data.periods.map((p: any) => ({ start: normalizeTime(p.start), end: normalizeTime(p.end) })) : [],
    grid: data?.grid && typeof data.grid === 'object' ? data.grid : {},
    subjectMap: data?.subjectMap && typeof data.subjectMap === 'object' ? data.subjectMap : {},
    source: ['asc', 'untis', 'csv', 'manual'].includes(data?.source) ? data.source : 'manual',
    updatedAt: toDate(data?.updatedAt),
  };
}

// ------------------------------------------------------------- current hour

export interface Slot {
  /** 1-based period number. */
  period: number;
  subject: string;
  start: string;
  end: string;
  /** Identifies the slot, so a manual choice lasts until the next hour. */
  key: string;
}

/** The lesson going on now in a class, if any. */
export function currentSlot(timetable: Timetable | null, classLabel: string, now: Date): Slot | null {
  if (!timetable) return null;
  const day = now.getDay();
  if (day < 1 || day > 6) return null;
  const row = timetable.grid[classLabel]?.[String(day)];
  if (!row) return null;
  const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const index = timetable.periods.findIndex(p => p.start && p.end && p.start <= hhmm && hhmm < p.end);
  if (index < 0 || !row[index]) return null;
  const p = timetable.periods[index];
  return { period: index + 1, subject: row[index], start: p.start, end: p.end, key: `${day}-${index + 1}` };
}

/** The CSV template, ready for Excel (semicolons, UTF-8 with BOM). */
export function templateCsv(): string {
  return '﻿' + [
    'classe;giorno;ora;materia;inizio;fine',
    '4G;lunedì;1;Italiano;08:00;09:00',
    '4G;lunedì;2;Latino;09:00;10:00',
    '4G;lunedì;3;Matematica;10:00;11:00',
    '4G;martedì;1;Storia;08:00;09:00',
  ].join('\r\n') + '\r\n';
}
