import React, { useEffect, useState } from 'react';
import { Layers, CalendarClock } from 'lucide-react';
import Modal from './Modal';
import ClassificationFields, { ClassificationValue } from './ClassificationFields';
import { useAppData } from '../context/AppData';
import { createCollection } from '../lib/collections';
import { classLabelsOf, isTeacherAccount, parseClassLabel } from '../lib/schoolYear';
import { firebaseErrorMessage } from '../lib/engagement';
import { cn } from '../lib/utils';

interface CreateCollectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Called with the new collection id, e.g. to open it straight away. */
  onCreated?: (collectionId: string) => void;
  /** Preselected class label such as "3B". */
  defaultClassLabel?: string | null;
}

function toLocalInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * Start a shared theme or project. Teachers can add a deadline, which turns
 * it into a hand-in box that shows who handed in and who was late.
 */
export default function CreateCollectionModal({ isOpen, onClose, onCreated, defaultClassLabel }: CreateCollectionModalProps) {
  const { profile } = useAppData();
  const isTeacher = isTeacherAccount(profile);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [classification, setClassification] = useState<ClassificationValue>({ school: null, subject: '' });
  const [hasDeadline, setHasDeadline] = useState(false);
  const [dueAt, setDueAt] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const parsed = parseClassLabel(defaultClassLabel || classLabelsOf(profile)[0] || '');
    setClassification({
      school: profile?.schoolId
        ? { id: profile.schoolId, name: profile.schoolName || profile.schoolId, city: profile.schoolCity || '', grade: profile.schoolGrade }
        : null,
      classYear: parsed?.classYear,
      classSection: parsed?.classSection,
      subject: isTeacher ? profile?.teacherSubjects?.[0] || '' : '',
    });
    setTitle('');
    setDescription('');
    setHasDeadline(false);
    // Default deadline: one week from now, end of the day.
    const inAWeek = new Date();
    inAWeek.setDate(inAWeek.getDate() + 7);
    inAWeek.setHours(23, 59, 0, 0);
    setDueAt(toLocalInput(inAWeek));
    setError(null);
  }, [isOpen]);

  const handleCreate = async () => {
    if (title.trim().length < 2) {
      setError('Give it a title.');
      return;
    }
    const deadline = hasDeadline && dueAt ? new Date(dueAt) : null;
    if (deadline && (isNaN(deadline.getTime()) || deadline.getTime() < Date.now())) {
      setError('Pick a deadline in the future.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const id = await createCollection({
        title,
        description,
        subject: classification.subject,
        school: classification.school,
        classYear: classification.classYear,
        classSection: classification.classSection,
        dueAt: deadline,
      });
      onClose();
      onCreated?.(id);
    } catch (err) {
      setError(firebaseErrorMessage(err, 'Could not create the collection.'));
    } finally {
      setBusy(false);
    }
  };

  const inputClass = 'w-full bg-white/5 border border-white/10 rounded-2xl py-3.5 px-4 text-sm text-white placeholder:text-white/25 focus:outline-none focus:ring-2 focus:ring-luxury-gold/30';
  const label = 'block text-[10px] uppercase tracking-[0.2em] text-white/40 font-medium ml-1';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="New collection"
      subtitle="Group works on the same theme, project or exam"
      icon={<Layers className="w-5 h-5 text-luxury-gold" />}
      size="md"
      level={2}
      footer={
        <div className="space-y-3">
          {error && <p className="text-xs text-red-400">{error}</p>}
          <button
            onClick={handleCreate}
            disabled={busy}
            className="w-full bg-white text-luxury-black font-bold py-4 rounded-full hover:bg-luxury-gold disabled:opacity-30 transition-all"
          >
            {busy ? 'Creating…' : hasDeadline ? 'Create hand-in' : 'Create collection'}
          </button>
        </div>
      }
    >
      <div className="space-y-7">
        <div className="space-y-2">
          <label className={label}>Title</label>
          <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} className={inputClass} placeholder="e.g. Renaissance presentations" />
        </div>

        <ClassificationFields
          value={classification}
          onChange={setClassification}
          quickClasses={isTeacher ? profile?.teacherClasses || [] : []}
          preferredSubjects={isTeacher ? profile?.teacherSubjects || [] : []}
        />

        <div className="space-y-2">
          <label className={label}>Instructions (optional)</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={1000}
            className={`${inputClass} h-24 resize-none`}
            placeholder="What should each group add?"
          />
        </div>

        {isTeacher && (
          <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <input type="checkbox" checked={hasDeadline} onChange={(e) => setHasDeadline(e.target.checked)} className="w-4 h-4 accent-[#D4AF37]" />
              <span className="text-sm text-white flex items-center gap-2"><CalendarClock className="w-4 h-4 text-luxury-gold" /> Hand-in with a deadline</span>
            </label>
            <div className={cn('space-y-2', !hasDeadline && 'opacity-40 pointer-events-none')}>
              <input
                type="datetime-local"
                value={dueAt}
                onChange={(e) => setDueAt(e.target.value)}
                className={`${inputClass} [color-scheme:dark]`}
              />
              <p className="text-[10px] text-white/35">Students see the deadline. Works added later are marked "late".</p>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
