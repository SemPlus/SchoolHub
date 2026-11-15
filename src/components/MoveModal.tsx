import React, { useState, useEffect } from 'react';
import { X, Folder as FolderIcon, ChevronRight, Check, Move } from 'lucide-react';
import { collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Folder } from '../types';
import Modal from './Modal';
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
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Move items"
      subtitle={`${targetItems.materials.length + targetItems.folders.length} selected · pick a folder`}
      icon={<Move className="w-5 h-5 text-luxury-gold" />}
      size="sm"
      level={2}
      bare
      footer={
        <button
          onClick={handleMove}
          disabled={isMoving || !auth.currentUser}
          className="w-full bg-white text-luxury-black font-bold py-4 rounded-full hover:bg-luxury-gold disabled:opacity-20 transition-all flex items-center justify-center gap-2"
        >
          {isMoving ? 'Moving…' : (<><Check className="w-4 h-4" /> Move here</>)}
        </button>
      }
    >
      <div className="px-5 sm:px-8 py-3 border-b border-white/5 flex items-center gap-2 overflow-x-auto no-scrollbar">
        <button
          onClick={() => { setCurrentParentId(null); setHistory([]); }}
          className={cn(
            'text-[10px] uppercase tracking-widest px-3 py-1.5 rounded-full transition-all whitespace-nowrap',
            currentParentId === null ? 'bg-luxury-gold text-luxury-black font-bold' : 'text-white/40 hover:text-white'
          )}
        >
          Top level
        </button>
        {history.length > 0 && (
          <>
            <ChevronRight className="w-3 h-3 text-white/10" />
            <button onClick={handleBack} className="text-[10px] uppercase tracking-widest text-white/40 hover:text-white">Back</button>
          </>
        )}
      </div>

      {error && (
        <div className="mx-5 sm:mx-8 mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
          <p className="text-xs text-red-400">{error}</p>
        </div>
      )}

      <div className="px-3 sm:px-5 py-3 space-y-1">
        {folders.length === 0 ? (
          <p className="py-12 text-center text-white/30 text-xs">No folders here</p>
        ) : folders.map((folder) => (
          <button
            key={folder.id}
            onClick={() => handleNavigate(folder.id)}
            className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-white/5 text-left transition-colors group"
          >
            <span className="flex items-center gap-3 min-w-0">
              <FolderIcon className="w-4 h-4 text-luxury-gold/60 group-hover:text-luxury-gold shrink-0" />
              <span className="text-sm text-white/70 group-hover:text-white truncate">{folder.name}</span>
            </span>
            <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-luxury-gold shrink-0" />
          </button>
        ))}
      </div>
    </Modal>
  );
}
