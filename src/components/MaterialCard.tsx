import React from 'react';
import {
  FileText, File, Link as LinkIcon, ExternalLink, Download, Trash2, Presentation, Share2, Edit2, Move,
  Bookmark, BookmarkCheck, ArrowLeft, BookOpen, BadgeCheck, AlertTriangle, Eye, History, Layers, CircleCheck, Circle, BookMarked,
} from 'lucide-react';
import { formatDistanceToNow } from '../lib/i18n';
import { Material } from '../types';
import { auth, db } from '../firebase';
import { doc, serverTimestamp } from 'firebase/firestore';
import { deleteDoc, updateDoc } from '../lib/firestoreWrites';
import { motion, useMotionValue, useSpring, useMotionTemplate } from 'motion/react';
import { getRank } from '../lib/ranks';
import { cn } from '../lib/utils';
import { firebaseErrorMessage, recordOpen, toggleSave } from '../lib/engagement';
import UserAvatar from './UserAvatar';
import SubjectBadge from './SubjectBadge';
import SubjectMark from './SubjectMark';
import { subjectStyle, visibleTags, withAlpha } from '../lib/subjects';
import { kindById, levelById } from '../lib/materialKinds';
import { useAppData } from '../context/AppData';

import { t } from '../lib/i18n';
interface MaterialCardProps {
  key?: React.Key;
  material: Material;
  onAuthorClick?: (id: string, name: string, photoUrl?: string) => void;
  onCardClick?: (material: Material) => void;
  onEditClick?: (material: Material) => void;
  onMoveClick?: (material: Material) => void;
  userRole?: string | null;
  /** Impact score of the author, used for the rank label. */
  authorImpact?: number;
  isSaved?: boolean;
  isInTrash?: boolean;
  onRestore?: (material: Material) => void;
  isSelected?: boolean;
  onSelect?: (e: React.MouseEvent) => void;
  onDragStart?: () => void;
  /** e.g. "Inherited · 2025/26" for materials from an earlier school year. */
  inheritedLabel?: string;
}

export function linkStatusLabel(status?: string | null): string | null {
  if (status === 'broken') return 'Link broken';
  if (status === 'restricted') return 'Link needs permission';
  return null;
}

/** Monogram for a material without a subject: its format. */
function formatMark(type: string): string {
  switch (type) {
    case 'pdf': return 'Pd';
    case 'word': return 'Dc';
    case 'canva': return 'Sl';
    case 'link': return 'Ln';
    default: return '·';
  }
}

export default function MaterialCard({
  material,
  onAuthorClick,
  onCardClick,
  onEditClick,
  onMoveClick,
  userRole,
  authorImpact = 0,
  isSaved = false,
  isInTrash = false,
  onRestore,
  isSelected = false,
  onSelect,
  onDragStart,
  inheritedLabel,
}: MaterialCardProps) {
  const { studied, toggleStudied, user: viewer } = useAppData();
  const isOwner = viewer?.uid === material.authorId;
  const isAdmin = userRole === 'admin';
  const canEdit = isOwner || isAdmin;
  const isAuthenticated = !!viewer;
  const isStudied = studied.has(material.id);
  const rank = getRank(authorImpact);
  const isExternalLink = material.type === 'link' || material.type === 'canva';
  const linkWarning = linkStatusLabel(material.linkStatus);

  const [isDeleting, setIsDeleting] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);

  const handleContainerClick = (e: React.MouseEvent) => {
    if (onSelect && (e.ctrlKey || e.metaKey || e.shiftKey)) {
      e.stopPropagation();
      onSelect(e);
      return;
    }
    onCardClick?.(material);
  };

  // Spotlight effect
  const mouseXRaw = useMotionValue(0);
  const mouseYRaw = useMotionValue(0);
  const mouseX = useSpring(mouseXRaw, { stiffness: 500, damping: 50 });
  const mouseY = useSpring(mouseYRaw, { stiffness: 500, damping: 50 });
  function handleMouseMove({ currentTarget, clientX, clientY }: React.MouseEvent) {
    const { left, top } = currentTarget.getBoundingClientRect();
    mouseXRaw.set(clientX - left);
    mouseYRaw.set(clientY - top);
  }
  const background = useMotionTemplate`radial-gradient(350px circle at ${mouseX}px ${mouseY}px, rgba(212, 175, 55, 0.1), transparent 80%)`;

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(`https://school-hub-iota.vercel.app/?material=${material.id}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy: ', err);
    }
  };

  const handleOpen = (e: React.MouseEvent) => {
    e.stopPropagation();
    recordOpen(material);
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isInTrash) {
      if (!confirm(t("Permanently delete \"{0}\"? This cannot be undone.", material.title))) return;
      setIsDeleting(true);
      try {
        await deleteDoc(doc(db, 'materials', material.id));
      } catch (error) {
        alert(firebaseErrorMessage(error, t("Could not delete this material.")));
      } finally {
        setIsDeleting(false);
      }
      return;
    }

    setIsDeleting(true);
    try {
      await updateDoc(doc(db, 'materials', material.id), {
        isDeleted: true,
        deletedAt: serverTimestamp()
      });
    } catch (error) {
      alert(firebaseErrorMessage(error, t("Could not move this material to Trash.")));
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRestore = (e: React.MouseEvent) => {
    e.stopPropagation();
    onRestore?.(material);
  };

  const getDaysRemaining = () => {
    if (!material.deletedAt) return 30;
    const expiryTime = material.deletedAt.getTime() + (30 * 24 * 60 * 60 * 1000);
    return Math.max(0, Math.ceil((expiryTime - Date.now()) / (24 * 60 * 60 * 1000)));
  };

  const handleSave = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsSaving(true);
    try {
      await toggleSave(material, isSaved);
    } catch (error) {
      alert(firebaseErrorMessage(error, isSaved ? t("Could not remove this save.") : t("Could not save this material.")));
    } finally {
      setIsSaving(false);
    }
  };

  const handleAuthorClickInternal = (e: React.MouseEvent) => {
    e.stopPropagation();
    onAuthorClick?.(material.authorId, material.authorName, material.authorPhotoUrl);
  };

  const actionButton = "transition-all p-2 rounded-xl flex items-center justify-center min-w-[36px] backdrop-blur-md opacity-100 pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100";
  const subject = material.subject ? subjectStyle(material.subject) : null;
  const tags = visibleTags(material);
  const kind = kindById(material.kind);
  const level = levelById(material.level);

  return (
    <motion.div
      onMouseMove={handleMouseMove}
      onClick={handleContainerClick}
      draggable={canEdit && !isInTrash}
      onDragStart={onDragStart}
      whileHover={{ y: -4 }}
      className={cn(
        "glass-panel rounded-[1.5rem] sm:rounded-[2rem] p-4 sm:p-8 hover:bg-white/[0.08] group flex flex-col h-full relative overflow-hidden hover:shadow-[0_40px_80px_-20px_rgba(0,0,0,0.5)] hover:border-white/30 transition-all duration-500 cursor-pointer select-none",
        isSelected && "ring-2 ring-luxury-gold bg-luxury-gold/5 border-luxury-gold/20"
      )}
    >
      {/* Subject colour stripe; gold while selected */}
      <div className="absolute inset-x-0 top-0 h-1" style={{ background: isSelected ? '#D4AF37' : subject ? subject.color : 'transparent' }} />
      <motion.div
        className="pointer-events-none absolute -inset-px rounded-[2rem] opacity-0 transition duration-500 group-hover:opacity-100"
        style={{ background }}
      />
      <div className="absolute -top-12 -right-12 w-24 h-24 bg-luxury-gold/5 rounded-full blur-2xl group-hover:bg-luxury-gold/20 transition-all duration-500 group-hover:scale-150"></div>

      <div className="flex items-start justify-between mb-3 sm:mb-6 relative z-10">
        <SubjectMark subject={material.subject} text={material.subject ? undefined : formatMark(material.type)} />
        <div className="flex flex-wrap justify-end gap-1">
          {isInTrash && (
            <div className="px-2 py-1 bg-red-500/10 border border-red-500/20 rounded-md">
              <span className="text-[9px] font-bold text-red-400 uppercase tracking-tighter">
                {t("Deleted for good in ")}{getDaysRemaining()} {t(" days")}</span>
            </div>
          )}
          {isInTrash ? (
            <button
              onClick={handleRestore}
              className="transition-all p-2 rounded-xl flex items-center justify-center min-w-[36px] bg-luxury-gold/20 text-luxury-gold hover:bg-luxury-gold hover:text-luxury-black"
              title={t("Restore")}
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          ) : (
            <>
              {isAuthenticated && (
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className={cn(actionButton, isSaved ? "text-luxury-gold bg-luxury-gold/10 pointer-fine:opacity-100" : "text-white/40 hover:text-luxury-gold hover:bg-white/10")}
                  title={isSaved ? t("Remove from saved") : t("Save")}
                >
                  {isSaving ? (
                    <div className="w-4 h-4 border-2 border-luxury-gold/30 border-t-luxury-gold rounded-full animate-spin" />
                  ) : isSaved ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
                </button>
              )}
              <button
                onClick={handleShare}
                className={cn(actionButton, copied ? 'bg-luxury-gold/20 text-luxury-gold sm:opacity-100' : 'text-white/40 hover:text-white hover:bg-white/10')}
                title={t("Copy link")}
              >
                {copied ? <span className="text-[10px] font-bold tracking-tighter uppercase">{t("Copied")}</span> : <Share2 className="w-4 h-4" />}
              </button>
              {canEdit && (
                <>
                  <button
                    onClick={(e) => { e.stopPropagation(); onMoveClick?.(material); }}
                    className={cn(actionButton, "text-white/40 hover:text-luxury-gold hover:bg-white/10")}
                    title={t("Move")}
                  >
                    <Move className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); onEditClick?.(material); }}
                    className={cn(actionButton, "text-white/40 hover:text-luxury-gold hover:bg-white/10")}
                    title={t("Edit")}
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                </>
              )}
            </>
          )}
          {canEdit && (
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className={cn(
                actionButton,
                "disabled:opacity-50",
                isInTrash ? "text-red-500 hover:bg-red-500/10 sm:opacity-100" : "text-white/40 hover:text-red-400 hover:bg-red-400/10"
              )}
              title={isInTrash ? t("Delete forever") : t("Move to Trash")}
            >
              {isDeleting ? <div className="w-4 h-4 border-2 border-red-400/30 border-t-red-400 rounded-full animate-spin" /> : <Trash2 className="w-4 h-4" />}
            </button>
          )}
        </div>
      </div>

      <h3 className="font-serif text-xl sm:text-2xl text-white mb-2 line-clamp-2 leading-tight group-hover:text-luxury-gold transition-colors relative z-10">
        {material.title}
      </h3>

      <div className="flex flex-wrap gap-1.5 sm:gap-2 mb-3 sm:mb-4 relative z-10">
        {material.verifiedBy && (
          <span className="flex items-center gap-1 bg-purple-400/10 border border-purple-400/30 px-2 py-0.5 rounded-full text-[8px] uppercase tracking-widest text-purple-300 font-medium">
            <BadgeCheck className="w-3 h-3" />
            {t("Verified")}{material.verifiedByName ? t(" by {0}", material.verifiedByName) : ''}
          </span>
        )}
        {inheritedLabel && (
          <span className="flex items-center gap-1 bg-sky-400/10 border border-sky-400/30 px-2 py-0.5 rounded-full text-[8px] uppercase tracking-widest text-sky-300 font-medium">
            <History className="w-3 h-3" />
            {inheritedLabel}
          </span>
        )}
        {(material.schoolName || material.className) && (
          <span className="flex items-center gap-1 bg-luxury-gold/10 border border-luxury-gold/20 px-2 py-0.5 rounded-full text-[8px] uppercase tracking-widest text-luxury-gold font-medium max-w-full">
            <span className="truncate">{[material.className, material.schoolName].filter(Boolean).join(' · ')}</span>
          </span>
        )}
        <SubjectBadge subject={material.subject} />
        {kind && (
          <span className="flex items-center gap-1 bg-white/5 border border-white/15 px-2 py-0.5 rounded-full text-[8px] uppercase tracking-widest text-white/75 font-medium">
            {t(kind.label)}
          </span>
        )}
        {level && (
          <span className="px-2 py-0.5 rounded-full text-[8px] uppercase tracking-widest border border-white/10 text-white/50" title={level.hint}>
            {t(level.label)}
          </span>
        )}
        {material.bookTitle && (
          <span className="flex items-center gap-1 bg-white/5 border border-white/10 px-2 py-0.5 rounded-full text-[8px] uppercase tracking-widest text-white/60 font-medium max-w-full" title={material.isbn || undefined}>
            <BookMarked className="w-3 h-3 shrink-0" /> <span className="truncate">{material.bookTitle}</span>
          </span>
        )}
        {material.improvesId && (
          <span className="flex items-center gap-1 bg-emerald-400/10 border border-emerald-400/30 px-2 py-0.5 rounded-full text-[8px] uppercase tracking-widest text-emerald-300 font-medium">
            {t("Improved version")}</span>
        )}
        {material.collectionId && (
          <span className="flex items-center gap-1 bg-white/5 border border-white/10 px-2 py-0.5 rounded-full text-[8px] uppercase tracking-widest text-white/60 font-medium">
            <Layers className="w-3 h-3" /> {t(" In a collection")}</span>
        )}
        {linkWarning && (
          <span className="flex items-center gap-1 bg-amber-400/10 border border-amber-400/30 px-2 py-0.5 rounded-full text-[8px] uppercase tracking-widest text-amber-300 font-medium">
            <AlertTriangle className="w-3 h-3" />
            {linkWarning}
          </span>
        )}
      </div>

      {tags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4 relative z-10">
          {tags.map((tag, index) => (
            <span
              key={index}
              className="text-[8px] uppercase tracking-widest px-2 py-0.5 border border-white/5 bg-white/5 text-white/40 rounded-full"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {material.description && (
        <p className="text-white/50 text-sm font-light leading-relaxed line-clamp-2 sm:line-clamp-3 mb-4 sm:mb-6 flex-grow relative z-10">
          {material.description}
        </p>
      )}

      <div className="mt-auto pt-4 sm:pt-6 border-t border-white/5 flex flex-wrap items-center justify-between gap-x-3 gap-y-3 relative z-10">
        <div className="flex items-center gap-3 min-w-0">
          <UserAvatar
            name={material.authorName}
            photoUrl={material.authorPhotoUrl}
            contributionCount={authorImpact}
            size="md"
            isClickable
            onClick={handleAuthorClickInternal}
            showRank={false}
          />
          <div className="flex flex-col min-w-0">
            <button
              onClick={handleAuthorClickInternal}
              className="py-2 -my-2 text-[10px] uppercase tracking-widest text-white/60 font-medium hover:text-luxury-gold transition-colors text-left truncate"
            >
              {material.authorName}
            </button>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <span className="text-[10px] uppercase tracking-widest text-white/30">
                {formatDistanceToNow(material.createdAt, { addSuffix: true })}
              </span>
              <span className="text-white/10">•</span>
              <span className="text-[10px] uppercase tracking-widest text-white/40 flex items-center gap-1" title={t("Opened by other students")}>
                <Eye className="w-2.5 h-2.5" />
                {(material.downloadCount || 0) === 1 ? t('1 open') : t('{0} opens', material.downloadCount || 0)}
              </span>
              {(material.saveCount || 0) > 0 && (
                <span className="text-[10px] uppercase tracking-widest text-white/40 flex items-center gap-1" title={t("Saved by other students")}>
                  <Bookmark className="w-2.5 h-2.5" />
                  {material.saveCount === 1 ? t('1 save') : t('{0} saves', material.saveCount)}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 ml-auto shrink-0">
        {!isInTrash && isAuthenticated && (
          <button
            onClick={(e) => { e.stopPropagation(); toggleStudied(material.id).catch(err => alert(firebaseErrorMessage(err, t("Could not update.")))); }}
            className={cn(
              'shrink-0 flex items-center gap-1.5 pl-2 pr-3 py-1.5 rounded-full border text-[10px] font-semibold uppercase tracking-widest transition-all',
              isStudied ? 'border-emerald-400/50 bg-emerald-400/15 text-emerald-300' : 'border-white/10 text-white/35 hover:text-white'
            )}
            title={isStudied ? t("Studied (tap to undo)") : t("Mark as studied")}
            aria-label={isStudied ? t("Studied") : t("Mark as studied")}
          >
            {isStudied ? <CircleCheck className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
            <span>{isStudied ? t("Studied") : t("Studied?")}</span>
          </button>
        )}
        {!isInTrash && (
          <a
            href={material.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={handleOpen}
            className="shrink-0 flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] font-bold text-luxury-black bg-white px-4 py-2 rounded-full hover:bg-luxury-gold transition-all shadow-lg shadow-white/5"
          >
            <span>{t("Open file")}</span>
            {isExternalLink ? <ExternalLink className="w-3 h-3" /> : <Download className="w-3 h-3" />}
          </a>
        )}
        </div>
      </div>
    </motion.div>
  );
}
