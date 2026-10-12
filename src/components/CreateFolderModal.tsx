import React, { useState } from 'react';
import { X, FolderPlus } from 'lucide-react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { motion, AnimatePresence } from 'motion/react';
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

  if (!isOpen) return null;

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
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-luxury-black/90 backdrop-blur-xl"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 30 }}
            className="glass-panel w-full max-w-md relative overflow-hidden rounded-[2.5rem] shadow-2xl z-10"
          >
            <div className="p-8 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-luxury-gold/10 rounded-xl">
                  <FolderPlus className="w-5 h-5 text-luxury-gold" />
                </div>
                <div>
                  <h3 className="text-xl font-serif text-white">New folder</h3>
                  <p className="text-[10px] uppercase tracking-widest text-white/40 font-light">Visible to everyone</p>
                </div>
              </div>
              <button onClick={onClose} className="text-white/20 hover:text-white transition-colors p-2 hover:bg-white/5 rounded-full">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-8 space-y-6">
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
                  className="w-full bg-transparent border-b border-white/10 py-3 px-0 focus:border-luxury-gold outline-none transition-all font-light tracking-wide text-lg text-white"
                  placeholder="e.g. History – Term 1"
                  maxLength={100}
                  required
                />
              </div>

              <button
                type="submit"
                disabled={isCreating}
                className="w-full luxury-button bg-white text-luxury-black font-semibold py-4 rounded-full shadow-2xl hover:scale-[1.02] active:scale-[0.98] disabled:opacity-20 transition-all"
              >
                {isCreating ? 'Creating…' : 'Create folder'}
              </button>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
