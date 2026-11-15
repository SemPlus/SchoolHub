import type { Material } from '../types';

// Fixed list so subjects can be grouped, filtered and coloured reliably.
export const SUBJECTS = [
  'Italian',
  'Latin',
  'Ancient Greek',
  'English',
  'French',
  'Spanish',
  'German',
  'History',
  'Geography',
  'Philosophy',
  'Mathematics',
  'Physics',
  'Chemistry',
  'Natural Sciences',
  'Computer Science',
  'Art & Art History',
  'Music',
  'Technology',
  'Law & Economics',
  'Business',
  'Human Sciences',
  'Physical Education',
  'Religion',
  'Civic Education',
  'Technical Subjects',
  'Other',
] as const;

export type Subject = typeof SUBJECTS[number];

export interface SubjectStyle {
  /** Muted enamel colour used for marks, chips and the card hairline. */
  color: string;
  /** Two-letter monogram shown in the subject's roundel, per language. */
  mark: { it: string; en: string };
}

// Colours are deliberately muted (enamel, ink, patina) so they sit next to
// the gold without looking like a default UI palette.
const STYLES: Record<string, SubjectStyle> = {
  'Italian': { color: '#8FA8CF', mark: { it: 'It', en: 'It' } },
  'Latin': { color: '#B39BCB', mark: { it: 'La', en: 'La' } },
  'Ancient Greek': { color: '#A39CCB', mark: { it: 'Gr', en: 'Gr' } },
  'English': { color: '#C99AAE', mark: { it: 'In', en: 'En' } },
  'French': { color: '#C9959A', mark: { it: 'Fr', en: 'Fr' } },
  'Spanish': { color: '#CFA07E', mark: { it: 'Sp', en: 'Sp' } },
  'German': { color: '#CDBB82', mark: { it: 'Te', en: 'De' } },
  'History': { color: '#BFA27A', mark: { it: 'St', en: 'Hi' } },
  'Geography': { color: '#86B5AA', mark: { it: 'Ge', en: 'Ge' } },
  'Philosophy': { color: '#BC9CC0', mark: { it: 'Fl', en: 'Ph' } },
  'Mathematics': { color: '#8DAFCB', mark: { it: 'Ma', en: 'Ma' } },
  'Physics': { color: '#9EA3CF', mark: { it: 'Fs', en: 'Py' } },
  'Chemistry': { color: '#8EBBA3', mark: { it: 'Ch', en: 'Ch' } },
  'Natural Sciences': { color: '#9DBA8E', mark: { it: 'Sn', en: 'Ns' } },
  'Computer Science': { color: '#86B6C2', mark: { it: 'If', en: 'Cs' } },
  'Art & Art History': { color: '#CDA676', mark: { it: 'Ar', en: 'Ar' } },
  'Music': { color: '#C493AC', mark: { it: 'Mu', en: 'Mu' } },
  'Technology': { color: '#A6ADB6', mark: { it: 'Tc', en: 'Te' } },
  'Law & Economics': { color: '#AFB77F', mark: { it: 'De', en: 'Le' } },
  'Business': { color: '#C9AC74', mark: { it: 'Ea', en: 'Bu' } },
  'Human Sciences': { color: '#C3A8C6', mark: { it: 'Su', en: 'Hs' } },
  'Physical Education': { color: '#C79090', mark: { it: 'Sm', en: 'Pe' } },
  'Religion': { color: '#CFC39C', mark: { it: 'Re', en: 'Re' } },
  'Civic Education': { color: '#8DB8AE', mark: { it: 'Ec', en: 'Ce' } },
  'Technical Subjects': { color: '#AFB5BC', mark: { it: 'Mt', en: 'Ts' } },
  'Other': { color: '#A3A3A3', mark: { it: 'Al', en: 'Ot' } },
};

const FALLBACK: SubjectStyle = { color: '#A3A3A3', mark: { it: '·', en: '·' } };

export function subjectStyle(subject?: string | null): SubjectStyle {
  return (subject && STYLES[subject]) || FALLBACK;
}

/** Hex colour with an alpha channel, e.g. withAlpha('#60A5FA', 0.15). */
export function withAlpha(hex: string, alpha: number): string {
  const a = Math.round(Math.min(1, Math.max(0, alpha)) * 255).toString(16).padStart(2, '0');
  return `${hex}${a}`;
}

/**
 * Subjects that actually have materials, most recently used first. Used by
 * the subject menu so it never offers empty subjects.
 */
export function subjectsInUse(materials: Material[]): string[] {
  const latest = new Map<string, number>();
  for (const m of materials) {
    if (!m.subject || m.isDeleted) continue;
    const time = m.createdAt.getTime();
    if ((latest.get(m.subject) ?? 0) < time) latest.set(m.subject, time);
  }
  return [...latest.entries()].sort((a, b) => b[1] - a[1]).map(([subject]) => subject);
}

/** Tags that only repeat the subject add nothing; hide them. */
export function visibleTags(material: Pick<Material, 'tags' | 'subject'>): string[] {
  const subject = material.subject?.trim().toLowerCase();
  return (material.tags || []).filter(tag => tag.trim().toLowerCase() !== subject);
}
