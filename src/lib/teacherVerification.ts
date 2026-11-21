import { collection, doc, getDoc, getDocsFromServer, query, serverTimestamp, where } from 'firebase/firestore';
import { db } from '../firebase';
import type { User } from '../types';
import { isActive, loadActivation, type SchoolActivation } from './aula';
import { updateDoc, writeBatch } from './firestoreWrites';

// Teachers verified by their school's e-mail (decided 2026-11-21). Someone
// who signs up as a teacher of an active school is confirmed at once when
// their Google address is
//   - on one of the school's staff domains (schools.teacherDomains, max 3),
//     to be used only where students have no address on that domain, or
//   - on the school's list of teachers' e-mails (teacherEmails/{schoolId}_{email}).
// The school's admins (or the founder) set both in the school panel. The
// database rules check the same conditions (isStaffEmailOf).

export const MAX_TEACHER_DOMAINS = 3;

/** Must match isStaffDomain in firestore.rules. */
export const PUBLIC_MAIL_DOMAINS = new Set([
  'gmail.com', 'googlemail.com', 'outlook.com', 'outlook.it', 'hotmail.com', 'hotmail.it',
  'live.com', 'live.it', 'msn.com', 'yahoo.com', 'yahoo.it', 'icloud.com', 'me.com', 'libero.it',
  'virgilio.it', 'alice.it', 'tiscali.it', 'tin.it', 'fastwebnet.it', 'email.it', 'proton.me',
  'protonmail.com', 'pec.it', 'aruba.it',
]);

const DOMAIN_RE = /^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/;
const EMAIL_RE = /^[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/;

/** "@Docenti.Liceo.edu.it " → "docenti.liceo.edu.it" (an e-mail gives its domain). */
export function normalizeDomain(input: string): string {
  const s = input.trim().toLowerCase();
  return s.includes('@') ? s.slice(s.lastIndexOf('@') + 1) : s;
}

export type DomainProblem = 'invalid' | 'public' | null;

export function domainProblem(domain: string): DomainProblem {
  if (!DOMAIN_RE.test(domain) || domain.length > 100) return 'invalid';
  if (PUBLIC_MAIL_DOMAINS.has(domain)) return 'public';
  return null;
}

export function emailDomain(email: string | null | undefined): string {
  if (!email || !email.includes('@')) return '';
  return email.slice(email.lastIndexOf('@') + 1).toLowerCase();
}

/** The e-mails in pasted text (lines, commas, semicolons, "Name <e-mail>"), lower case, once each. */
export function parseEmails(text: string): { emails: string[]; invalid: string[] } {
  const emails = new Set<string>();
  const invalid: string[] = [];
  for (const raw of text.split(/[\s,;]+/)) {
    const token = raw.replace(/^[<("']+|[>)"'.]+$/g, '').toLowerCase();
    if (!token) continue;
    if (EMAIL_RE.test(token) && token.length <= 200) emails.add(token);
    else if (token.includes('@')) invalid.push(raw);
  }
  return { emails: [...emails], invalid };
}

export function teacherEmailId(schoolId: string, email: string): string {
  return `${schoolId}_${email.toLowerCase()}`;
}

/** Would this address be confirmed for this school? (The list check is done by the caller.) */
export function onStaffDomain(email: string | null | undefined, activation: SchoolActivation | null): boolean {
  const domain = emailDomain(email);
  return !!domain && !!activation && activation.teacherDomains.includes(domain);
}

/**
 * Confirms the signed-in user as a teacher if they signed up as a teacher of
 * an active school with a staff address. Returns true when it did.
 */
export async function verifyTeacherByEmail(profile: User, email: string | null, emailVerified: boolean): Promise<boolean> {
  if (!email || !emailVerified || !profile.schoolId) return false;
  if (profile.accountType !== 'teacher' || profile.role !== 'user') return false;
  const activation = await loadActivation(profile.schoolId).catch(() => null);
  if (!isActive(activation)) return false;
  let staff = onStaffDomain(email, activation);
  if (!staff) {
    const entry = await getDoc(doc(db, 'teacherEmails', teacherEmailId(profile.schoolId, email))).catch(() => null);
    staff = !!entry?.exists();
  }
  if (!staff) return false;
  await updateDoc(doc(db, 'users', profile.uid), { role: 'teacher' });
  return true;
}

// ------------------------------------------------------------ the school's list

export async function loadTeacherEmails(schoolId: string): Promise<string[]> {
  const snapshot = await getDocsFromServer(query(collection(db, 'teacherEmails'), where('schoolId', '==', schoolId)));
  return snapshot.docs.map(d => d.data().email as string).sort();
}

/** Adds e-mails to the school's list (batches of 400). */
export async function addTeacherEmails(schoolId: string, emails: string[]): Promise<void> {
  for (let i = 0; i < emails.length; i += 400) {
    const batch = writeBatch(db);
    for (const email of emails.slice(i, i + 400)) {
      batch.set(doc(db, 'teacherEmails', teacherEmailId(schoolId, email)), { schoolId, email, addedAt: serverTimestamp() });
    }
    await batch.commit();
  }
}

/**
 * Removes a teacher's confirmation, and their e-mail from the school's list
 * (otherwise they would be confirmed again at their next visit).
 */
export async function removeTeacher(schoolId: string, teacher: User, onList: boolean): Promise<void> {
  const batch = writeBatch(db);
  batch.update(doc(db, 'users', teacher.uid), { role: 'user' });
  if (onList && teacher.email) batch.delete(doc(db, 'teacherEmails', teacherEmailId(schoolId, teacher.email)));
  await batch.commit();
}

export async function removeTeacherEmail(schoolId: string, email: string): Promise<void> {
  const batch = writeBatch(db);
  batch.delete(doc(db, 'teacherEmails', teacherEmailId(schoolId, email)));
  await batch.commit();
}
