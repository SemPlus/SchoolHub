import React, { useState } from 'react';
import { X, FolderPlus, Globe, Lock } from 'lucide-react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { motion, AnimatePresence } from 'motion/react';

interface CreateFolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  parentId?: string | null;
}

export default function CreateFolderModal({ isOpen, onClose, parentId }: CreateFolderModalProps) {
  const [name, setName] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    if (!auth.currentUser) return;

    setIsCreating(true);
    setError('');

    try {
      await addDoc(collection(db, 'folders'), {
        name: name.trim(),
        authorId: auth.currentUser.uid,
        authorName: auth.currentUser.displayName || 'Anonymous',
        parentId: parentId || null,
        isPublic: isPublic,
        createdAt: serverTimestamp(),
        isDeleted: false,
      });
      setName('');
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create folder');
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
                  <h3 className="text-xl font-serif text-white">New Directory</h3>
                  <p className="text-[10px] uppercase tracking-widest text-white/40 font-light">Categorize your Archive</p>
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
                <label className="block text-[10px] uppercase tracking-[0.2em] text-white/40 font-medium ml-1">Directory Name</label>
                <input
                  autoFocus
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-transparent border-b border-white/10 py-3 px-0 focus:border-luxury-gold outline-none transition-all font-light tracking-wide text-lg text-white"
                  placeholder="e.g. Ancient Wisdom"
                  required
                />
              </div>

              <div className="space-y-3">
                <label className="block text-[10px] uppercase tracking-[0.2em] text-white/40 font-medium ml-1">Visibility</label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => setIsPublic(true)}
                    className={`flex items-center justify-center gap-3 p-4 rounded-2xl border transition-all ${isPublic ? 'border-luxury-gold bg-luxury-gold/5 text-luxury-gold' : 'border-white/5 bg-white/[0.02] text-white/40 hover:bg-white/5'}`}
                  >
                    <Globe className="w-4 h-4" />
                    <div className="text-left">
                      <p className="text-xs font-medium">Public</p>
                      <p className="text-[8px] uppercase tracking-wider opacity-60">Global Feed</p>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsPublic(false)}
                    className={`flex items-center justify-center gap-3 p-4 rounded-2xl border transition-all ${!isPublic ? 'border-luxury-gold bg-luxury-gold/5 text-luxury-gold' : 'border-white/5 bg-white/[0.02] text-white/40 hover:bg-white/5'}`}
                  >
                    <Lock className="w-4 h-4" />
                    <div className="text-left">
                      <p className="text-xs font-medium">Private</p>
                      <p className="text-[8px] uppercase tracking-wider opacity-60">Personal Only</p>
                    </div>
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isCreating}
                className="w-full luxury-button bg-white text-luxury-black font-semibold py-4 rounded-full shadow-2xl hover:scale-[1.02] active:scale-[0.98] disabled:opacity-20 transition-all"
              >
                {isCreating ? 'Creating Directory...' : 'Create Directory'}
              </button>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
