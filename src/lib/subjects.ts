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
  /** Hex colour used for chips, accents and the card stripe. */
  color: string;
  /** Two-letter monogram shown in the subject's seal, per language. */
  mark: { it: string; en: string };
}

const STYLES: Record<string, SubjectStyle> = {
  'Italian': { color: '#60A5FA', mark: { it: 'It', en: 'It' } },
  'Latin': { color: '#C084FC', mark: { it: 'La', en: 'La' } },
  'Ancient Greek': { color: '#A78BFA', mark: { it: 'Gr', en: 'Gr' } },
  'English': { color: '#F472B6', mark: { it: 'In', en: 'En' } },
  'French': { color: '#FB7185', mark: { it: 'Fr', en: 'Fr' } },
  'Spanish': { color: '#F97316', mark: { it: 'Sp', en: 'Sp' } },
  'German': { color: '#FACC15', mark: { it: 'Te', en: 'De' } },
  'History': { color: '#D4AF37', mark: { it: 'St', en: 'Hi' } },
  'Geography': { color: '#2DD4BF', mark: { it: 'Ge', en: 'Ge' } },
  'Philosophy': { color: '#E879F9', mark: { it: 'Fl', en: 'Ph' } },
  'Mathematics': { color: '#38BDF8', mark: { it: 'Ma', en: 'Ma' } },
  'Physics': { color: '#818CF8', mark: { it: 'Fs', en: 'Py' } },
  'Chemistry': { color: '#34D399', mark: { it: 'Ch', en: 'Ch' } },
  'Natural Sciences': { color: '#4ADE80', mark: { it: 'Sn', en: 'Ns' } },
  'Computer Science': { color: '#22D3EE', mark: { it: 'If', en: 'Cs' } },
  'Art & Art History': { color: '#F59E0B', mark: { it: 'Ar', en: 'Ar' } },
  'Music': { color: '#EC4899', mark: { it: 'Mu', en: 'Mu' } },
  'Technology': { color: '#94A3B8', mark: { it: 'Tc', en: 'Te' } },
  'Law & Economics': { color: '#A3E635', mark: { it: 'De', en: 'Le' } },
  'Business': { color: '#FBBF24', mark: { it: 'Ea', en: 'Bu' } },
  'Human Sciences': { color: '#F0ABFC', mark: { it: 'Su', en: 'Hs' } },
  'Physical Education': { color: '#F87171', mark: { it: 'Sm', en: 'Pe' } },
  'Religion': { color: '#FDE68A', mark: { it: 'Re', en: 'Re' } },
  'Civic Education': { color: '#5EEAD4', mark: { it: 'Ec', en: 'Ce' } },
  'Technical Subjects': { color: '#CBD5E1', mark: { it: 'Mt', en: 'Ts' } },
  'Other': { color: '#9CA3AF', mark: { it: 'Al', en: 'Ot' } },
};

const FALLBACK: SubjectStyle = { color: '#9CA3AF', mark: { it: '·', en: '·' } };

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
