import {
  BookOpenText, ScrollText, Amphora, Languages, Hourglass, Earth, Brain, Sigma, Atom, FlaskConical, Leaf,
  CodeXml, Palette, Music, Cpu, Scale, Briefcase, Users, Dumbbell, Sparkles, Landmark, Wrench, Shapes,
  type LucideIcon,
} from 'lucide-react';
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
  icon: LucideIcon;
}

const STYLES: Record<string, SubjectStyle> = {
  'Italian': { color: '#60A5FA', icon: BookOpenText },
  'Latin': { color: '#C084FC', icon: ScrollText },
  'Ancient Greek': { color: '#A78BFA', icon: Amphora },
  'English': { color: '#F472B6', icon: Languages },
  'French': { color: '#FB7185', icon: Languages },
  'Spanish': { color: '#F97316', icon: Languages },
  'German': { color: '#FACC15', icon: Languages },
  'History': { color: '#D4AF37', icon: Hourglass },
  'Geography': { color: '#2DD4BF', icon: Earth },
  'Philosophy': { color: '#E879F9', icon: Brain },
  'Mathematics': { color: '#38BDF8', icon: Sigma },
  'Physics': { color: '#818CF8', icon: Atom },
  'Chemistry': { color: '#34D399', icon: FlaskConical },
  'Natural Sciences': { color: '#4ADE80', icon: Leaf },
  'Computer Science': { color: '#22D3EE', icon: CodeXml },
  'Art & Art History': { color: '#F59E0B', icon: Palette },
  'Music': { color: '#EC4899', icon: Music },
  'Technology': { color: '#94A3B8', icon: Cpu },
  'Law & Economics': { color: '#A3E635', icon: Scale },
  'Business': { color: '#FBBF24', icon: Briefcase },
  'Human Sciences': { color: '#F0ABFC', icon: Users },
  'Physical Education': { color: '#F87171', icon: Dumbbell },
  'Religion': { color: '#FDE68A', icon: Sparkles },
  'Civic Education': { color: '#5EEAD4', icon: Landmark },
  'Technical Subjects': { color: '#CBD5E1', icon: Wrench },
  'Other': { color: '#9CA3AF', icon: Shapes },
};

const FALLBACK: SubjectStyle = { color: '#9CA3AF', icon: Shapes };

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
