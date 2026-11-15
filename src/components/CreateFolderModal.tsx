import React, { useState } from 'react';
import { X, FolderPlus } from 'lucide-react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../firebase';
import Modal from './Modal';
import { useAppData } from '../context/AppData';
import { classIdFor, formatClassName } from '../lib/schoolYear';
import { firebaseErrorMessage } from '../lib/engagement';

interface CreateFolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  parentId?: string | null;
}

export default function CreateFolderModal({ isOpen, onClose, parentId }: CreateFolderModalProps) {
  const { profile } = useAppData();
  const [name, setName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !auth.currentUser) return;

    setIsCreating(true);
    setError('');

    const className = formatClassName(profile?.classYear, profile?.classSection);
    try {
      await addDoc(collection(db, 'folders'), {
        name: name.trim(),
        authorId: auth.currentUser.uid,
        authorName: auth.currentUser.displayName || 'Anonymous',
        parentId: parentId || null,
        // Everything in the archive is visible to everyone.
        isPublic: true,
        createdAt: serverTimestamp(),
        isDeleted: false,
        schoolId: profile?.schoolId || null,
        schoolName: profile?.schoolName || null,
        className: className || null,
        classId: classIdFor(profile?.schoolId, profile?.classYear, profile?.classSection) || null,
      });
      setName('');
      onClose();
    } catch (err: any) {
      setError(firebaseErrorMessage(err, 'Could not create the folder.'));
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="New folder"
      subtitle="Visible to everyone"
      icon={<FolderPlus className="w-5 h-5 text-luxury-gold" />}
      size="sm"
      level={2}
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl">
            <p className="text-xs text-red-400">{error}</p>
          </div>
        )}
        <div className="space-y-2">
          <label className="block text-[10px] uppercase tracking-[0.2em] text-white/40 font-medium ml-1">Folder name</label>
          <input
            autoFocus
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-2xl py-3.5 px-4 text-base text-white placeholder:text-white/25 focus:outline-none focus:ring-2 focus:ring-luxury-gold/30"
            placeholder="e.g. History – Term 1"
            maxLength={100}
            required
          />
        </div>
        <button
          type="submit"
          disabled={isCreating}
          className="w-full bg-white text-luxury-black font-bold py-4 rounded-full hover:bg-luxury-gold disabled:opacity-20 transition-all"
        >
          {isCreating ? 'Creating…' : 'Create folder'}
        </button>
      </form>
    </Modal>
  );
}
