import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, ExternalLink, Info, Layers, Plus, Pencil, Trash2, Users, CalendarClock, Clock, Trophy } from 'lucide-react';
import { doc, serverTimestamp } from 'firebase/firestore';
import { updateDoc } from '../lib/firestoreWrites';
import { format, formatDistanceToNow } from '../lib/i18n';
import { db, auth } from '../firebase';
import type { Collection, Material } from '../types';
import { useAppData } from '../context/AppData';
import { isLate, worksIn } from '../lib/collections';
import { previewUrlFor } from '../lib/drive';
import { firebaseErrorMessage, recordOpen } from '../lib/engagement';
import { subjectStyle, withAlpha } from '../lib/subjects';
import { cn } from '../lib/utils';
import Modal from './Modal';
import SubjectBadge from './SubjectBadge';
import WorkFeedback from './WorkFeedback';
import { announceWinner, castVote, leadingWork, useCollectionVotes, withdrawVote } from '../lib/useCollectionVotes';

import { t } from '../lib/i18n';
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
  const { counts, myVote } = useCollectionVotes(isOpen && collection ? collection.id : null);
  const [voteBusy, setVoteBusy] = useState(false);

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
  const dueAt = collection.dueAt || null;
  const isPastDue = !!dueAt && dueAt.getTime() < Date.now();
  const lateCount = works.filter(w => isLate(w, collection)).length;
  const iHandedIn = !!user && works.some(w => w.authorId === user.uid);
  const winner = collection.winnerMaterialId ? works.find(w => w.id === collection.winnerMaterialId) : undefined;
  const votingOpen = !collection.winnerMaterialId && works.length >= 2;
  const leader = leadingWork(works, counts);
  const totalVotes = [...counts.values()].reduce((a, b) => a + b, 0);

  const vote = async (work: Material) => {
    setVoteBusy(true);
    try {
      if (myVote === work.id) await withdrawVote(collection.id);
      else await castVote(collection.id, work, !!myVote);
    } catch (error) {
      alert(firebaseErrorMessage(error, t("Could not save your vote.")));
    } finally {
      setVoteBusy(false);
    }
  };

  const announce = async () => {
    if (!leader) return;
    if (!confirm(t("Announce \"{0}\" by {1} as the best work? Voting closes.", leader.title, leader.authorName))) return;
    setVoteBusy(true);
    try {
      await announceWinner(collection, leader);
    } catch (error) {
      alert(firebaseErrorMessage(error, t("Could not announce the best work.")));
    } finally {
      setVoteBusy(false);
    }
  };

  const rename = async () => {
    const title = prompt(t("Rename collection"), collection.title)?.trim();
    if (!title || title === collection.title) return;
    setBusy(true);
    try {
      await updateDoc(doc(db, 'collections', collection.id), { title: title.slice(0, 120), updatedAt: serverTimestamp() });
    } catch (error) {
      alert(firebaseErrorMessage(error, t("Could not rename the collection.")));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!confirm(t("Delete the collection \"{0}\"? The works inside stay in the archive.", collection.title))) return;
    setBusy(true);
    try {
      await updateDoc(doc(db, 'collections', collection.id), { isDeleted: true, updatedAt: serverTimestamp() });
      onClose();
    } catch (error) {
      alert(firebaseErrorMessage(error, t("Could not delete the collection.")));
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
      subtitle={`${works.length === 1 ? t('1 work') : t('{0} works', works.length)}${collection.className ? ` · ${collection.className}` : ''}${collection.schoolName ? ` · ${collection.schoolName}` : ''}`}
      icon={<Layers className="w-5 h-5" style={{ color }} />}
      bare
      footer={
        <div className="flex flex-wrap gap-2">
          {user && (
            <button
              onClick={() => onAddWork(collection)}
              className="flex-1 min-w-[10rem] flex items-center justify-center gap-2 py-3.5 rounded-full bg-luxury-gold text-luxury-black text-xs font-bold uppercase tracking-widest"
            >
              <Plus className="w-4 h-4" /> {dueAt ? (iHandedIn ? t("Add another file") : isPastDue ? t("Hand in late") : t("Hand in my work")) : t("Add my work")}
            </button>
          )}
          {canManage && (
            <>
              <button disabled={busy} onClick={rename} className="px-4 py-3.5 rounded-full bg-white/5 border border-white/10 text-white/60 hover:text-white" title={t("Rename")}>
                <Pencil className="w-4 h-4" />
              </button>
              <button disabled={busy} onClick={remove} className="px-4 py-3.5 rounded-full bg-red-400/10 border border-red-400/20 text-red-400" title={t("Delete collection")}>
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      }
    >
      {(dueAt || collection.description) && (
        <div className="px-5 sm:px-6 pt-4 space-y-3">
          {dueAt && (
            <div className={cn(
              'flex flex-wrap items-center gap-x-4 gap-y-1 p-3 rounded-2xl border text-sm',
              isPastDue ? 'border-red-400/30 bg-red-400/5 text-red-200' : 'border-luxury-gold/30 bg-luxury-gold/5 text-white'
            )}>
              <span className="flex items-center gap-2">
                <CalendarClock className="w-4 h-4 shrink-0" />
                {isPastDue ? t("Deadline passed") : t("Hand in by")} {format(dueAt, 'EEE d MMM, HH:mm')}
              </span>
              {!isPastDue && <span className="text-white/50 text-xs">{formatDistanceToNow(dueAt, { addSuffix: true })}</span>}
              <span className="text-white/50 text-xs ml-auto">
                {works.length} {t(" handed in")}{lateCount ? t(" · {0} late", lateCount) : ''}{iHandedIn ? t(" · yours is in") : ''}
              </span>
            </div>
          )}
          {collection.description && <p className="text-sm text-white/60 whitespace-pre-line">{collection.description}</p>}
        </div>
      )}

      {(winner || (canManage && votingOpen)) && (
        <div className="px-5 sm:px-6 pt-4">
          {winner ? (
            <button
              onClick={() => setIndex(works.indexOf(winner))}
              className="w-full flex items-center gap-3 p-3 rounded-2xl border border-amber-300/30 bg-amber-300/5 text-left"
            >
              <Trophy className="w-5 h-5 text-amber-300 shrink-0" />
              <span className="text-sm text-white min-w-0 truncate">
                {t("Best work: ")}<span className="font-semibold">{winner.title}</span> <span className="text-white/50">{t("by ")}{winner.authorName}</span>
              </span>
            </button>
          ) : (
            <div className="flex flex-wrap items-center gap-3 p-3 rounded-2xl border border-white/10 bg-white/[0.03]">
              <Trophy className="w-5 h-5 text-amber-300 shrink-0" />
              <span className="text-sm text-white/70 flex-1 min-w-[10rem]">
                {totalVotes === 1 ? t('1 vote so far') : t('{0} votes so far', totalVotes)}{leader ? t(" · leading: {0}", leader.title) : ''}
              </span>
              <button
                onClick={announce}
                disabled={voteBusy || !leader}
                className="px-4 py-2 rounded-full bg-amber-300/20 text-amber-100 text-[10px] uppercase tracking-widest font-bold disabled:opacity-30"
              >
                {t("Announce best work")}</button>
            </div>
          )}
        </div>
      )}

      {works.length === 0 ? (
        <div className="px-6 py-16 text-center space-y-3">
          <Users className="w-12 h-12 text-white/10 mx-auto" />
          <p className="text-white/60">{t("No works yet.")}</p>
          <p className="text-xs text-white/35">{t("Each group adds its own work with \"Add my work\".")}</p>
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
                  {(work.id === collection.winnerMaterialId || (counts.get(work.id) || 0) > 0) && (
                    <span className="inline-flex items-center gap-1 mt-1 mr-2 text-[9px] uppercase tracking-widest text-amber-300">
                      <Trophy className="w-3 h-3" /> {work.id === collection.winnerMaterialId ? t("Best") : counts.get(work.id)}
                    </span>
                  )}
                  {isLate(work, collection) && (
                    <span className="inline-flex items-center gap-1 mt-1 text-[9px] uppercase tracking-widest text-red-300"><Clock className="w-3 h-3" /> {t(" Late")}</span>
                  )}
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
                    {isLate(current, collection) && <span className="text-red-300"> {t(" · handed in late")}</span>}
                  </p>
                </div>
                <SubjectBadge subject={current.subject} />
              </div>

              {preview ? (
                <div className="relative w-full aspect-[4/3] sm:aspect-video rounded-2xl overflow-hidden border border-white/10 bg-white/5">
                  <iframe
                    key={preview}
                    src={preview}
                    title={t("Preview of {0}", current.title)}
                    className="absolute inset-0 w-full h-full"
                    loading="lazy"
                    allow="autoplay; fullscreen"
                    referrerPolicy="no-referrer"
                  />
                </div>
              ) : (
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center text-sm text-white/50">
                  {t("This link cannot be previewed here. Use Open to see it.")}</div>
              )}

              {current.description && <p className="text-sm text-white/70 whitespace-pre-line">{current.description}</p>}

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIndex(i => Math.max(0, i - 1))}
                  disabled={index === 0}
                  className="p-3 rounded-full bg-white/5 border border-white/10 text-white disabled:opacity-20"
                  aria-label={t("Previous work")}
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
                  {t("Open ")}<ExternalLink className="w-4 h-4" />
                </a>
                <button
                  onClick={() => onShowDetails(current)}
                  className="p-3 rounded-full bg-white/5 border border-white/10 text-white/70 hover:text-white"
                  aria-label={t("Details")}
                  title={t("Details")}
                >
                  <Info className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setIndex(i => Math.min(works.length - 1, i + 1))}
                  disabled={index >= works.length - 1}
                  className="p-3 rounded-full bg-white/5 border border-white/10 text-white disabled:opacity-20"
                  aria-label={t("Next work")}
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>

              {votingOpen && user && user.uid !== current.authorId && (
                <button
                  onClick={() => vote(current)}
                  disabled={voteBusy}
                  className={cn(
                    'w-full flex items-center justify-center gap-2 py-3 rounded-full border text-xs font-bold uppercase tracking-widest transition-all disabled:opacity-40',
                    myVote === current.id ? 'border-amber-300 bg-amber-300/15 text-amber-200' : 'border-white/10 bg-white/5 text-white/70 hover:text-white'
                  )}
                >
                  <Trophy className="w-4 h-4" />
                  {myVote === current.id ? t("Your vote for best work (tap to remove)") : myVote ? t("Move my vote here") : t("Vote as best work")}
                </button>
              )}

              <WorkFeedback work={current} />
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
