import {
  NotebookPen, FileText, PencilRuler, CircleCheck, ClipboardList, Network, Presentation, Clapperboard, FlaskRound,
  Rocket, Shapes, type LucideIcon,
} from 'lucide-react';
import type { Material } from '../types';

// What a material IS, chosen with one tap. Tags stay free for the topic or
// chapter, and the subject has its own field.
export interface MaterialKind {
  id: string;
  label: string;
  icon: LucideIcon;
}

export const KINDS: MaterialKind[] = [
  { id: 'notes', label: 'Notes', icon: NotebookPen },
  { id: 'summary', label: 'Summary', icon: FileText },
  { id: 'exercises', label: 'Exercises', icon: PencilRuler },
  { id: 'solutions', label: 'Solutions', icon: CircleCheck },
  { id: 'past-test', label: 'Past test', icon: ClipboardList },
  { id: 'mind-map', label: 'Mind map', icon: Network },
  { id: 'slides', label: 'Slides', icon: Presentation },
  { id: 'video', label: 'Video', icon: Clapperboard },
  { id: 'lab-report', label: 'Lab report', icon: FlaskRound },
  { id: 'project', label: 'Project', icon: Rocket },
  { id: 'other', label: 'Other', icon: Shapes },
];

export interface MaterialLevel {
  id: string;
  label: string;
  /** The Italian school term, so students recognise it. */
  hint: string;
}

export const LEVELS: MaterialLevel[] = [
  { id: 'revision', label: 'Revision', hint: 'ripasso' },
  { id: 'extra', label: 'Going further', hint: 'approfondimento' },
  { id: 'catch-up', label: 'Catch-up', hint: 'recupero' },
];

export function kindById(id?: string | null): MaterialKind | undefined {
  return KINDS.find(k => k.id === id);
}

export function levelById(id?: string | null): MaterialLevel | undefined {
  return LEVELS.find(l => l.id === id);
}

/** Kinds that actually have materials, most used first. */
export function kindsInUse(materials: Material[]): MaterialKind[] {
  const counts = new Map<string, number>();
  for (const m of materials) {
    if (m.kind && !m.isDeleted) counts.set(m.kind, (counts.get(m.kind) || 0) + 1);
  }
  return KINDS.filter(k => counts.has(k.id)).sort((a, b) => (counts.get(b.id) || 0) - (counts.get(a.id) || 0));
}
