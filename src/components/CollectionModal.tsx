import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, ExternalLink, Info, Layers, Plus, Pencil, Trash2, Users } from 'lucide-react';
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { formatDistanceToNow } from 'date-fns';
import { db, auth } from '../firebase';
import type { Collection, Material } from '../types';
import { useAppData } from '../context/AppData';
import { worksIn } from '../lib/collections';
import { previewUrlFor } from '../lib/drive';
import { firebaseErrorMessage, recordOpen } from '../lib/engagement';
import { subjectStyle, withAlpha } from '../lib/subjects';
import { cn } from '../lib/utils';
import Modal from './Modal';
import SubjectBadge from './SubjectBadge';

interface CollectionModalProps {
  collection: Collection | null;
  isOpen: boolean;
  onClose: () => void;
  onAddWork: (collection: Collection) => void;
  onShowDetails: (material: Material) => void;
}

/**
 * One window for a shared theme or project: every group's work side by side,
 * with a preview and next/previous buttons to move between them.
 */
export default function CollectionModal({ collection, isOpen, onClose, onAddWork, onShowDetails }: CollectionModalProps) {
  const { materials, user, userRole } = useAppData();
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);

  const works = useMemo(() => (collection ? worksIn(collection.id, materials) : []), [collection, materials]);

  useEffect(() => {
    setIndex(0);
  }, [collection?.id]);

  useEffect(() => {
    if (index > works.length - 1) setIndex(Math.max(0, works.length - 1));
  }, [works.length]);

  // Arrow keys move between works.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'ArrowRight') setIndex(i => Math.min(works.length - 1, i + 1));
      if (e.key === 'ArrowLeft') setIndex(i => Math.max(0, i - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, works.length]);

  if (!collection) return null;

  const current = works[index];
  const preview = current ? previewUrlFor(current.url) : null;
  const { color } = subjectStyle(collection.subject);
  const canManage = !!user && (user.uid === collection.createdBy || userRole === 'admin');

  const rename = async () => {
    const title = prompt('Rename collection', collection.title)?.trim();
    if (!title || title === collection.title) return;
    setBusy(true);
    try {
      await updateDoc(doc(db, 'collections', collection.id), { title: title.slice(0, 120), updatedAt: serverTimestamp() });
    } catch (error) {
      alert(firebaseErrorMessage(error, 'Could not rename the collection.'));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!confirm(`Delete the collection "${collection.title}"? The works inside stay in the archive.`)) return;
    setBusy(true);
    try {
      await updateDoc(doc(db, 'collections', collection.id), { isDeleted: true, updatedAt: serverTimestamp() });
      onClose();
    } catch (error) {
      alert(firebaseErrorMessage(error, 'Could not delete the collection.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="xl"
      title={collection.title}
      subtitle={`${works.length} ${works.length === 1 ? 'work' : 'works'}${collection.className ? ` · ${collection.className}` : ''}${collection.schoolName ? ` · ${collection.schoolName}` : ''}`}
      icon={<Layers className="w-5 h-5" style={{ color }} />}
      bare
      footer={
        <div className="flex flex-wrap gap-2">
          {auth.currentUser && (
            <button
              onClick={() => onAddWork(collection)}
              className="flex-1 min-w-[10rem] flex items-center justify-center gap-2 py-3.5 rounded-full bg-luxury-gold text-luxury-black text-xs font-bold uppercase tracking-widest"
            >
              <Plus className="w-4 h-4" /> Add my work
            </button>
          )}
          {canManage && (
            <>
              <button disabled={busy} onClick={rename} className="px-4 py-3.5 rounded-full bg-white/5 border border-white/10 text-white/60 hover:text-white" title="Rename">
                <Pencil className="w-4 h-4" />
              </button>
              <button disabled={busy} onClick={remove} className="px-4 py-3.5 rounded-full bg-red-400/10 border border-red-400/20 text-red-400" title="Delete collection">
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      }
    >
      {works.length === 0 ? (
        <div className="px-6 py-16 text-center space-y-3">
          <Users className="w-12 h-12 text-white/10 mx-auto" />
          <p className="text-white/60">No works yet.</p>
          <p className="text-xs text-white/35">Each group adds its own work with "Add my work".</p>
        </div>
      ) : (
        <div className="flex flex-col md:flex-row min-h-0">
          {/* Works list: a strip on phones, a column on larger screens */}
          <div className="md:w-64 shrink-0 border-b md:border-b-0 md:border-r border-white/5">
            <div className="flex md:flex-col gap-2 p-3 overflow-x-auto md:overflow-x-visible md:max-h-[60dvh] md:overflow-y-auto no-scrollbar">
              {works.map((work, i) => (
                <button
                  key={work.id}
                  onClick={() => setIndex(i)}
                  className={cn(
                    'shrink-0 w-44 md:w-auto text-left p-3 rounded-2xl border transition-all',
                    i === index ? 'bg-white/10 border-white/20' : 'bg-white/[0.02] border-white/5 hover:bg-white/5'
                  )}
                  style={i === index ? { borderColor: withAlpha(color, 0.6) } : undefined}
                >
                  <p className="text-[9px] uppercase tracking-widest text-white/40 mb-1">{i + 1} / {works.length}</p>
                  <p className="text-sm text-white line-clamp-2">{work.title}</p>
                  <p className="text-[10px] text-white/40 truncate mt-1">{work.authorName}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Current work */}
          {current && (
            <div className="flex-1 min-w-0 p-4 sm:p-6 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h4 className="text-xl sm:text-2xl font-serif text-white leading-tight">{current.title}</h4>
                  <p className="text-[10px] uppercase tracking-widest text-white/40 mt-1">
                    {current.authorName} · {formatDistanceToNow(current.createdAt, { addSuffix: true })}
                  </p>
                </div>
                <SubjectBadge subject={current.subject} />
              </div>

              {preview ? (
                <div className="relative w-full aspect-[4/3] sm:aspect-video rounded-2xl overflow-hidden border border-white/10 bg-white/5">
                  <iframe
                    key={preview}
                    src={preview}
                    title={`Preview of ${current.title}`}
                    className="absolute inset-0 w-full h-full"
                    loading="lazy"
                    allow="autoplay; fullscreen"
                    referrerPolicy="no-referrer"
                  />
                </div>
              ) : (
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center text-sm text-white/50">
                  This link cannot be previewed here. Use Open to see it.
                </div>
              )}

              {current.description && <p className="text-sm text-white/70 whitespace-pre-line">{current.description}</p>}

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIndex(i => Math.max(0, i - 1))}
                  disabled={index === 0}
                  className="p-3 rounded-full bg-white/5 border border-white/10 text-white disabled:opacity-20"
                  aria-label="Previous work"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <a
                  href={current.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => recordOpen(current)}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-full bg-white text-luxury-black text-xs font-bold uppercase tracking-widest"
                >
                  Open <ExternalLink className="w-4 h-4" />
                </a>
                <button
                  onClick={() => onShowDetails(current)}
                  className="p-3 rounded-full bg-white/5 border border-white/10 text-white/70 hover:text-white"
                  aria-label="Details"
                  title="Details"
                >
                  <Info className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setIndex(i => Math.min(works.length - 1, i + 1))}
                  disabled={index >= works.length - 1}
                  className="p-3 rounded-full bg-white/5 border border-white/10 text-white disabled:opacity-20"
                  aria-label="Next work"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
