import React, { useEffect, useState } from 'react';
import { collection, doc, onSnapshot, query, updateDoc, where } from 'firebase/firestore';
import { GraduationCap, Check } from 'lucide-react';
import { db } from '../firebase';
import type { User } from '../types';
import { firebaseErrorMessage } from '../lib/engagement';

/**
 * Founder-only list of people who signed up as teachers but are not confirmed
 * yet. Confirming gives them the right to verify materials of their school.
 */
export default function PendingTeachers() {
  const [pending, setPending] = useState<User[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'users'), where('accountType', '==', 'teacher'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setPending(snapshot.docs
        .map(d => ({ uid: d.id, ...(d.data() as any) } as User))
        .filter(u => u.role === 'user'));
    }, (err) => setError(firebaseErrorMessage(err, 'Could not load teacher sign-ups.')));
    return () => unsubscribe();
  }, []);

  const confirmTeacher = async (user: User) => {
    setBusyId(user.uid);
    setError(null);
    try {
      await updateDoc(doc(db, 'users', user.uid), { role: 'teacher' });
    } catch (err) {
      setError(firebaseErrorMessage(err, 'Could not confirm this teacher.'));
    } finally {
      setBusyId(null);
    }
  };

  if (pending.length === 0 && !error) return null;

  return (
    <div className="mt-8 rounded-2xl border border-purple-400/20 bg-purple-400/5 p-4 space-y-3">
      <p className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-purple-200">
        <GraduationCap className="w-4 h-4" /> Teachers waiting for confirmation ({pending.length})
      </p>
      {error && <p className="text-xs text-red-400">{error}</p>}
      {pending.map(u => (
        <div key={u.uid} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/5">
          <div className="min-w-0">
            <p className="text-sm text-white truncate">{u.displayName || 'Unnamed'}</p>
            <p className="text-[10px] text-white/40 truncate">
              {u.email}{u.schoolName ? ` · ${u.schoolName}` : ''}{u.teacherClasses?.length ? ` · ${u.teacherClasses.join(', ')}` : ''}
            </p>
          </div>
          <button
            onClick={() => confirmTeacher(u)}
            disabled={busyId === u.uid}
            className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-full bg-purple-400/20 text-purple-100 text-[10px] uppercase tracking-widest font-bold disabled:opacity-40"
          >
            <Check className="w-3.5 h-3.5" /> Confirm
          </button>
        </div>
      ))}
      <p className="text-[10px] text-white/30">Check the school e-mail address or ask the school before confirming.</p>
    </div>
  );
}
