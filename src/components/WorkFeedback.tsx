import React, { useEffect, useMemo, useState } from 'react';
import { collection, deleteDoc, doc, onSnapshot, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { formatDistanceToNow } from 'date-fns';
import { Star, MessageSquare, Trash2 } from 'lucide-react';
import { db } from '../firebase';
import type { Material, WorkFeedback as Feedback } from '../types';
import { useAppData } from '../context/AppData';
import { mapFeedbackDoc } from '../lib/mappers';
import { firebaseErrorMessage } from '../lib/engagement';
import { cn } from '../lib/utils';

interface WorkFeedbackProps {
  work: Material;
}

function Stars({ value, onChange, size = 'md' }: { value: number; onChange?: (v: number) => void; size?: 'sm' | 'md' }) {
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  const cls = size === 'sm' ? 'w-3.5 h-3.5' : 'w-6 h-6';
  return (
    <div className="flex items-center gap-0.5" onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          disabled={!onChange}
          onClick={() => onChange?.(n === value ? 0 : n)}
          onMouseEnter={() => onChange && setHover(n)}
          className={cn('p-0.5', onChange ? 'cursor-pointer' : 'cursor-default')}
          aria-label={`${n} star${n > 1 ? 's' : ''}`}
        >
          <Star className={cn(cls, n <= shown ? 'fill-luxury-gold text-luxury-gold' : 'text-white/20')} />
        </button>
      ))}
    </div>
  );
}

/**
 * Classmates' stars and comments on one work, shown inside a collection.
 * One review per person per work; nobody reviews their own work. Reviews do
 * not count towards impact, so there is no reason to game them.
 */
export default function WorkFeedback({ work }: WorkFeedbackProps) {
  const { user, userRole } = useAppData();
  const [items, setItems] = useState<Feedback[]>([]);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    setItems([]);
    const unsubscribe = onSnapshot(collection(db, 'materials', work.id, 'feedback'), (snapshot) => {
      const list = snapshot.docs.map(d => mapFeedbackDoc(d.id, d.data()));
      list.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      setItems(list);
    }, (err) => console.error('Feedback snapshot error:', err));
    return () => unsubscribe();
  }, [work.id]);

  const mine = useMemo(() => items.find(i => i.userId === user?.uid), [items, user?.uid]);

  useEffect(() => {
    setRating(mine?.rating || 0);
    setComment(mine?.comment || '');
    setEditing(false);
    setError(null);
  }, [mine?.id, work.id]);

  const ratings = items.map(i => i.rating || 0).filter(r => r > 0);
  const average = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;
  const canReview = !!user && user.uid !== work.authorId;
  const showForm = canReview && (!mine || editing);

  const save = async () => {
    if (!user) return;
    if (!rating && !comment.trim()) {
      setError('Add stars or a comment.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const ref = doc(db, 'materials', work.id, 'feedback', user.uid);
      if (mine) {
        await updateDoc(ref, {
          rating: rating || null,
          comment: comment.trim() || null,
          updatedAt: serverTimestamp(),
        });
      } else {
        await setDoc(ref, {
          userId: user.uid,
          userName: user.displayName || 'Student',
          rating: rating || null,
          comment: comment.trim() || null,
          createdAt: serverTimestamp(),
        });
      }
      setEditing(false);
    } catch (err) {
      setError(firebaseErrorMessage(err, 'Could not save your feedback.'));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (item: Feedback) => {
    if (!confirm('Delete this feedback?')) return;
    try {
      await deleteDoc(doc(db, 'materials', work.id, 'feedback', item.id));
    } catch (err) {
      alert(firebaseErrorMessage(err, 'Could not delete the feedback.'));
    }
  };

  return (
    <div className="space-y-4 border-t border-white/5 pt-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] uppercase tracking-[0.2em] text-white/40 font-bold flex items-center gap-2">
          <MessageSquare className="w-3.5 h-3.5" /> Feedback
        </p>
        {ratings.length > 0 && (
          <div className="flex items-center gap-2">
            <Stars value={Math.round(average)} size="sm" />
            <span className="text-xs text-white/50">{average.toFixed(1)} · {ratings.length}</span>
          </div>
        )}
      </div>

      {showForm && (
        <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <Stars value={rating} onChange={setRating} />
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            maxLength={500}
            placeholder="What was good? What could be better?"
            className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-3 text-sm text-white placeholder:text-white/25 focus:outline-none focus:ring-2 focus:ring-luxury-gold/30 h-20 resize-none"
          />
          {error && <p className="text-xs text-red-400">{error}</p>}
          <div className="flex gap-2">
            <button onClick={save} disabled={busy} className="px-5 py-2.5 rounded-full bg-white text-luxury-black text-xs font-bold disabled:opacity-30">
              {busy ? 'Saving…' : mine ? 'Update' : 'Send feedback'}
            </button>
            {editing && (
              <button onClick={() => setEditing(false)} className="px-4 py-2.5 rounded-full text-xs text-white/50 hover:text-white">Cancel</button>
            )}
          </div>
        </div>
      )}

      {!user && <p className="text-xs text-white/35">Sign in to leave feedback.</p>}

      {items.length === 0 ? (
        !showForm && <p className="text-xs text-white/35">No feedback yet.</p>
      ) : (
        <ul className="space-y-2">
          {items.map(item => (
            <li key={item.id} className="p-3 rounded-xl bg-white/[0.03] border border-white/5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-white/80 truncate">
                  {item.userName}
                  <span className="text-white/30"> · {formatDistanceToNow(item.updatedAt || item.createdAt, { addSuffix: true })}</span>
                </p>
                <div className="flex items-center gap-1 shrink-0">
                  {!!item.rating && <Stars value={item.rating} size="sm" />}
                  {item.userId === user?.uid && !editing && (
                    <button onClick={() => setEditing(true)} className="text-[10px] uppercase tracking-widest text-white/40 hover:text-white px-1">Edit</button>
                  )}
                  {(item.userId === user?.uid || userRole === 'admin') && (
                    <button onClick={() => remove(item)} className="p-1 text-white/30 hover:text-red-400" aria-label="Delete feedback">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
              {item.comment && <p className="text-sm text-white/65 mt-1 whitespace-pre-line">{item.comment}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
