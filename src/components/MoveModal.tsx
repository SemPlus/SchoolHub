import React, { useState, useEffect } from 'react';
import { X, Folder as FolderIcon, ChevronRight, Check, Move } from 'lucide-react';
import { collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Folder } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

interface MoveModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetItems: { materials: string[], folders: string[] };
  onSuccess?: () => void;
}

export default function MoveModal({ isOpen, onClose, targetItems, onSuccess }: MoveModalProps) {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [currentParentId, setCurrentParentId] = useState<string | null>(null);
  const [history, setHistory] = useState<(string | null)[]>([]);
  const [isMoving, setIsMoving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setCurrentParentId(null);
      setHistory([]);
      setError(null);
      return;
    }

    const uid = auth.currentUser?.uid;
    if (!uid) {
      setFolders([]);
      setError('You must be signed in to move items.');
      return;
    }

    // Only the signed-in user's own directories are valid move targets.
    // Scoping the query by authorId is also required by the Firestore rules:
    // an unscoped query on `folders` is rejected for non-admin users.
    const q = query(
      collection(db, 'folders'),
      where('authorId', '==', uid),
      where('parentId', '==', currentParentId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const foldersList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Folder[];

      // Hide trashed directories and the folders being moved, so a folder can
      // never be dropped into itself. Because the selected folders are never
      // listed, their descendants are unreachable too.
      const selectable = foldersList
        .filter(f => !f.isDeleted && !targetItems.folders.includes(f.id))
        .sort((a, b) => a.name.localeCompare(b.name));

      setFolders(selectable);
      setError(null);
    }, (err) => {
      console.error('Failed to load directories for move:', err);
      setFolders([]);
      setError('Could not load your directories.');
    });

    return () => unsubscribe();
  }, [isOpen, currentParentId, targetItems.folders]);

  if (!isOpen) return null;

  const handleNavigate = (folderId: string | null) => {
    setHistory([...history, currentParentId]);
    setCurrentParentId(folderId);
  };

  const handleBack = () => {
    const newHistory = [...history];
    const prev = newHistory.pop();
    setHistory(newHistory);
    setCurrentParentId(prev !== undefined ? prev : null);
  };

  const handleMove = async () => {
    setIsMoving(true);
    setError(null);
    try {
      const promises = [
        ...targetItems.materials.map(id => updateDoc(doc(db, 'materials', id), { folderId: currentParentId })),
        ...targetItems.folders.map(id => updateDoc(doc(db, 'folders', id), { parentId: currentParentId }))
      ];

      await Promise.all(promises);
      onSuccess?.();
      onClose();
    } catch (err: any) {
      console.error('Failed to move items:', err);
      setError(err?.message || 'Failed to move the selected items.');
    } finally {
      setIsMoving(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
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
            className="glass-panel w-full max-w-md relative overflow-hidden rounded-[2.5rem] shadow-2xl z-10 flex flex-col max-h-[80vh]"
          >
            <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
              <div className="flex items-center gap-3">
                 <div className="p-2 bg-luxury-gold/10 rounded-xl">
                  <Move className="w-5 h-5 text-luxury-gold" />
                </div>
                <div>
                  <h3 className="text-lg font-serif text-white">Translocate Records</h3>
                  <p className="text-[10px] uppercase tracking-widest text-white/40 font-light">Moving {targetItems.materials.length + targetItems.folders.length} selected items</p>
                </div>
              </div>
              <button onClick={onClose} className="text-white/20 hover:text-white transition-colors p-2 hover:bg-white/5 rounded-full">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 bg-white/[0.02] border-b border-white/5 flex items-center gap-2 overflow-x-auto no-scrollbar">
              <button
                onClick={() => {
                  setCurrentParentId(null);
                  setHistory([]);
                }}
                className={cn(
                  "text-[10px] uppercase tracking-widest px-3 py-1.5 rounded-full transition-all",
                  currentParentId === null ? "bg-luxury-gold text-luxury-black font-bold" : "text-white/40 hover:text-white"
                )}
              >
                Root
              </button>
              {history.length > 0 && (
                <>
                  <ChevronRight className="w-3 h-3 text-white/10" />
                  <button
                    onClick={handleBack}
                    className="text-[10px] uppercase tracking-widest text-white/40 hover:text-white"
                  >
                    ...
                  </button>
                </>
              )}
            </div>

            {error && (
              <div className="mx-4 mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                <p className="text-xs text-red-400">{error}</p>
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
              <div className="space-y-1">
                {folders.length === 0 ? (
                  <div className="py-12 text-center">
                    <p className="text-white/20 text-xs font-light italic">No sub-directories here</p>
                  </div>
                ) : (
                  folders.map((folder) => (
                    <button
                      key={folder.id}
                      onClick={() => handleNavigate(folder.id)}
                      className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-white/5 text-left transition-colors group"
                    >
                      <div className="flex items-center gap-3">
                        <FolderIcon className="w-4 h-4 text-luxury-gold/50 group-hover:text-luxury-gold transition-colors" />
                        <span className="text-sm text-white/60 group-hover:text-white transition-colors line-clamp-1">{folder.name}</span>
                      </div>
                      <ChevronRight className="w-4 h-4 text-white/10 group-hover:text-luxury-gold transition-colors" />
                    </button>
                  ))
                )}
              </div>
            </div>

            <div className="p-6 border-t border-white/5 bg-white/[0.02]">
              <button
                onClick={handleMove}
                disabled={isMoving || !auth.currentUser}
                className="w-full luxury-button bg-white text-luxury-black font-semibold py-4 rounded-full shadow-2xl hover:scale-[1.02] active:scale-[0.98] disabled:opacity-20 transition-all flex items-center justify-center gap-2"
              >
                {isMoving ? 'Translocating...' : (
                  <>
                    <Check className="w-4 h-4" />
                    Place Here
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
