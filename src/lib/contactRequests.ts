import { collection, doc, getDocsFromServer, limit, orderBy, query, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { addDoc, deleteDoc } from './firestoreWrites';
import { toDate } from './utils';

// Requests from the page for schools (/scuole): a principal or a teacher asks
// for a meeting. Written without signing in; only the founder reads them
// (database rules). Kept 24 months (legal/01-informativa-privacy.md).

export type ContactRole = 'principal' | 'teacher' | 'other';

export const CONTACT_ROLES: { id: ContactRole; label: string }[] = [
  { id: 'principal', label: 'Dirigente scolastico' },
  { id: 'teacher', label: 'Docente' },
  { id: 'other', label: 'Altro (segreteria, referente digitale…)' },
];

export const CONTACT_MAX = { name: 100, school: 200, email: 200, message: 2000 } as const;

export interface ContactInput {
  name: string;
  role: ContactRole;
  school: string;
  email: string;
  message: string;
}

export interface ContactRequest extends ContactInput {
  id: string;
  createdAt: Date | null;
}

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** What is wrong with the form, in Italian (the page is in Italian), or null. */
export function contactProblem(input: ContactInput): string | null {
  if (input.name.trim().length < 2) return 'Scrivi nome e cognome.';
  if (input.school.trim().length < 2) return 'Scrivi il nome della scuola.';
  if (!EMAIL.test(input.email.trim())) return 'Controlla l’indirizzo email.';
  if (input.name.length > CONTACT_MAX.name || input.school.length > CONTACT_MAX.school ||
      input.email.length > CONTACT_MAX.email || input.message.length > CONTACT_MAX.message) return 'Il testo è troppo lungo.';
  return null;
}

export async function sendContactRequest(input: ContactInput): Promise<void> {
  await addDoc(collection(db, 'contactRequests'), {
    name: input.name.trim(),
    role: input.role,
    school: input.school.trim(),
    email: input.email.trim().toLowerCase(),
    message: input.message.trim(),
    createdAt: serverTimestamp(),
  });
}

/** Founder only. */
export async function loadContactRequests(): Promise<ContactRequest[]> {
  const snapshot = await getDocsFromServer(query(collection(db, 'contactRequests'), orderBy('createdAt', 'desc'), limit(100)));
  return snapshot.docs.map(d => {
    const data = d.data();
    return {
      id: d.id,
      name: data.name || '',
      role: (['principal', 'teacher', 'other'].includes(data.role) ? data.role : 'other') as ContactRole,
      school: data.school || '',
      email: data.email || '',
      message: data.message || '',
      createdAt: toDate(data.createdAt),
    };
  });
}

export function deleteContactRequest(id: string): Promise<void> {
  return deleteDoc(doc(db, 'contactRequests', id));
}
