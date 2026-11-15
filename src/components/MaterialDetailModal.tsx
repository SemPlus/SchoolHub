import React from 'react';
import {
  ExternalLink, Download, Tag, Trash2, Bookmark, BookmarkCheck, Share2, BookOpen, BadgeCheck, AlertTriangle,
  Calendar, Eye, Edit2, Layers, Maximize2, Sparkles, CornerDownRight, BookMarked,
} from 'lucide-react';
import { format } from '../lib/i18n';
import { Material, User as UserType } from '../types';
import { getRank } from '../lib/ranks';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { cn } from '../lib/utils';
import { firebaseErrorMessage, recordOpen, setVerified, toggleSave } from '../lib/engagement';
import { previewUrlFor } from '../lib/drive';
import { subjectStyle, visibleTags, withAlpha } from '../lib/subjects';
import { kindById, levelById } from '../lib/materialKinds';
import { useAppData } from '../context/AppData';
import { linkStatusLabel } from './MaterialCard';
import Modal from './Modal';
import SubjectBadge from './SubjectBadge';
import UserAvatar from './UserAvatar';

import { t } from '../lib/i18n';
interface MaterialDetailModalProps {
  material: Material | null;
  isOpen: boolean;
  onClose: () => void;
  onAuthorClick?: (id: string, name: string, photoUrl?: string) => void;
  onEditClick?: (material: Material) => void;
  onCollectionClick?: (collectionId: string) => void;
  /** Start an improved version of this material. */
  onImprove?: (material: Material) => void;
  /** Open another material (e.g. the original or an improved version). */
  onOpenMaterial?: (material: Material) => void;
  /** Impact score of the author. */
  authorImpact?: number;
  userRole?: string | null;
  isSaved?: boolean;
  /** Higher stacking level when opened from inside another window. */
  level?: 1 | 2;
}

export default function MaterialDetailModal({
  material, isOpen, onClose, onAuthorClick, onEditClick, onCollectionClick, onImprove, onOpenMaterial, authorImpact = 0, userRole, isSaved = false, level = 1,
}: MaterialDetailModalProps) {
  const { profile, collections, materials } = useAppData();
  const [authorProfile, setAuthorProfile] = React.useState<UserType | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isVerifying, setIsVerifying] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const [showPreview, setShowPreview] = React.useState(true);

  React.useEffect(() => {
    // Clear the previous author so their badge and colour are not shown on a
    // different author's material while the new profile loads.
    setAuthorProfile(null);
    if (!isOpen || !material?.authorId) return;
    let cancelled = false;
    getDoc(doc(db, 'users', material.authorId))
      .then(snapshot => {
        if (!cancelled && snapshot.exists()) setAuthorProfile(snapshot.data() as UserType);
      })
      .catch(error => console.error('Error fetching author profile:', error));
    return () => { cancelled = true; };
  }, [isOpen, material?.authorId]);

  const handleClose = () => {
    // Drop a ?material= deep link from the URL.
    const url = new URL(window.location.href);
    if (url.searchParams.has('material')) {
      url.searchParams.delete('material');
      window.history.replaceState({}, '', url.toString());
    }
    onClose();
  };

  if (!material) return null;

  const uid = auth.currentUser?.uid;
  const isOwner = uid === material.authorId;
  const isAdmin = userRole === 'admin';
  const canEdit = isOwner || isAdmin;
  // Teachers verify materials from their own school, never their own uploads.
  const canVerify = !!uid && !isOwner && (isAdmin || (userRole === 'teacher' && !!profile?.schoolId && profile.schoolId === material.schoolId));
  const rank = getRank(authorImpact);
  const isExternalLink = material.type === 'link' || material.type === 'canva';
  const linkWarning = linkStatusLabel(material.linkStatus);
  const preview = previewUrlFor(material.url);
  const { color } = subjectStyle(material.subject);
  const tags = visibleTags(material);
  const kind = kindById(material.kind);
  const materialLevel = levelById(material.level);
  const parentCollection = material.collectionId ? collections.find(c => c.id === material.collectionId) : undefined;
  const original = material.improvesId ? materials.find(m => m.id === material.improvesId && !m.isDeleted) : undefined;
  const improvements = materials.filter(m => m.improvesId === material.id && !m.isDeleted);

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(`https://school-hub-iota.vercel.app/?material=${material.id}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy: ', err);
    }
  };

  const handleDelete = async () => {
    if (!confirm(t("Move \"{0}\" to Trash?", material.title))) return;
    setIsDeleting(true);
    try {
      await updateDoc(doc(db, 'materials', material.id), { isDeleted: true, deletedAt: serverTimestamp() });
      handleClose();
    } catch (error) {
      alert(firebaseErrorMessage(error, t("Could not move this material to Trash.")));
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await toggleSave(material, isSaved);
    } catch (error) {
      alert(firebaseErrorMessage(error, t("Could not update your saved materials.")));
    } finally {
      setIsSaving(false);
    }
  };

  const handleVerify = async () => {
    setIsVerifying(true);
    try {
      await setVerified(material, !material.verifiedBy);
    } catch (error) {
      alert(firebaseErrorMessage(error, t("Could not change the verification.")));
    } finally {
      setIsVerifying(false);
    }
  };

  const infoItem = (icon: React.ReactNode, label: string, value: React.ReactNode) => (
    <div className="flex items-center gap-3 min-w-0 p-3 rounded-2xl bg-white/[0.03] border border-white/5">
      <div className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center shrink-0">{icon}</div>
      <div className="min-w-0">
        <p className="text-[9px] uppercase tracking-widest text-white/40 font-semibold">{label}</p>
        <div className="text-sm text-white truncate">{value}</div>
      </div>
    </div>
  );

  const secondaryButton = 'flex items-center justify-center gap-2 px-4 py-3 rounded-full border transition-all text-[10px] uppercase tracking-widest font-bold';

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      size="lg"
      level={level}
      title={material.title}
      subtitle={[material.subject ? t(material.subject) : null, material.className, material.schoolName].filter(Boolean).join(' · ') || t('Material')}
      footer={
        <div className="flex flex-col gap-3">
          <a
            href={material.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => recordOpen(material)}
            className="flex items-center justify-center gap-2 py-4 bg-white text-luxury-black hover:bg-luxury-gold transition-all rounded-full"
          >
            <span className="uppercase tracking-[0.2em] text-xs font-bold">{t("Open")}</span>
            {isExternalLink ? <ExternalLink className="w-4 h-4" /> : <Download className="w-4 h-4" />}
          </a>
          <div className="flex flex-wrap gap-2">
            {auth.currentUser && (
              <button
                onClick={handleSave}
                disabled={isSaving}
                className={cn(secondaryButton, 'flex-1', isSaved ? 'bg-luxury-gold/10 border-luxury-gold/50 text-luxury-gold' : 'bg-white/5 border-white/10 text-white/60 hover:text-white')}
              >
                {isSaved ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
                {isSaved ? t("Saved") : t("Save")}
              </button>
            )}
            <button
              onClick={handleShare}
              className={cn(secondaryButton, 'flex-1', copied ? 'bg-luxury-gold/20 border-luxury-gold text-luxury-gold' : 'bg-white/5 border-white/10 text-white/60 hover:text-white')}
            >
              <Share2 className="w-4 h-4" />
              {copied ? t("Copied") : t("Share")}
            </button>
            {auth.currentUser && onImprove && (
              <button onClick={() => onImprove(material)} className={cn(secondaryButton, 'flex-1 bg-white/5 border-white/10 text-white/60 hover:text-white')} title={t("Upload a corrected or extended version")}>
                <Sparkles className="w-4 h-4" /> {t(" Improve")}</button>
            )}
            {canEdit && onEditClick && (
              <button onClick={() => onEditClick(material)} className={cn(secondaryButton, 'flex-1 bg-white/5 border-white/10 text-white/60 hover:text-white')}>
                <Edit2 className="w-4 h-4" /> {t(" Edit")}</button>
            )}
            {canVerify && (
              <button
                onClick={handleVerify}
                disabled={isVerifying}
                className={cn(secondaryButton, 'flex-1 disabled:opacity-50', material.verifiedBy ? 'bg-purple-400/15 border-purple-400/40 text-purple-200' : 'bg-white/5 border-white/10 text-white/60 hover:text-white')}
              >
                <BadgeCheck className="w-4 h-4" />
                {material.verifiedBy ? t("Unverify") : t("Verify")}
              </button>
            )}
            {canEdit && (
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className={cn(secondaryButton, 'bg-red-400/10 border-red-400/20 text-red-400 hover:bg-red-400/20 disabled:opacity-50')}
                title={t("Move to Trash")}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      }
    >
      <div className="space-y-6">
        <div className="h-1 rounded-full" style={{ background: `linear-gradient(90deg, ${color}, ${withAlpha(color, 0)})` }} />

        <div className="flex flex-wrap gap-2">
          <SubjectBadge subject={material.subject} size="md" />
          {kind && (
            <span className="flex items-center gap-1.5 px-3 py-1 bg-white/5 border border-white/15 rounded-full text-[10px] uppercase tracking-widest text-white/80">
              <kind.icon className="w-3.5 h-3.5" /> {t(kind.label)}
            </span>
          )}
          {material.bookTitle && (
            <span className="flex items-center gap-1.5 px-3 py-1 bg-white/5 border border-white/10 rounded-full text-[10px] uppercase tracking-widest text-white/70 max-w-full" title={material.isbn || undefined}>
              <BookMarked className="w-3.5 h-3.5 shrink-0" /> <span className="truncate">{material.bookTitle}</span>
            </span>
          )}
          {materialLevel && (
            <span className="px-3 py-1 border border-white/10 rounded-full text-[10px] uppercase tracking-widest text-white/55">
              {t(materialLevel.label)} · {materialLevel.hint}
            </span>
          )}
          {material.verifiedBy && (
            <span className="flex items-center gap-1.5 px-3 py-1 bg-purple-400/10 border border-purple-400/30 rounded-full text-[10px] uppercase tracking-widest text-purple-300">
              <BadgeCheck className="w-3.5 h-3.5" /> {t(" Verified by ")}{material.verifiedByName || t("a teacher")}
            </span>
          )}
          {linkWarning && (
            <span className="flex items-center gap-1.5 px-3 py-1 bg-amber-400/10 border border-amber-400/30 rounded-full text-[10px] uppercase tracking-widest text-amber-300">
              <AlertTriangle className="w-3.5 h-3.5" /> {linkWarning}
            </span>
          )}
          {tags.map((tag, i) => (
            <span key={i} className="flex items-center gap-1.5 px-3 py-1 bg-white/5 border border-white/10 rounded-full text-[10px] uppercase tracking-widest text-white/60">
              <Tag className="w-3 h-3 text-luxury-gold/50" /> {tag}
            </span>
          ))}
        </div>

        {parentCollection && (
          <button
            onClick={() => onCollectionClick?.(parentCollection.id)}
            className="w-full flex items-center gap-3 p-3 rounded-2xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] text-left transition-colors"
          >
            <Layers className="w-4 h-4 text-luxury-gold shrink-0" />
            <span className="text-sm text-white/80 truncate">{t("Part of ")}<span className="text-white">{parentCollection.title}</span></span>
          </button>
        )}

        {(original || improvements.length > 0) && (
          <div className="space-y-2">
            {original && (
              <button
                onClick={() => onOpenMaterial?.(original)}
                className="w-full flex items-center gap-3 p-3 rounded-2xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] text-left"
              >
                <CornerDownRight className="w-4 h-4 text-white/50 shrink-0" />
                <span className="text-sm text-white/70 truncate">{t("Improves ")}<span className="text-white">{original.title}</span> {t(" by ")}{original.authorName}</span>
              </button>
            )}
            {improvements.map(v => (
              <button
                key={v.id}
                onClick={() => onOpenMaterial?.(v)}
                className="w-full flex items-center gap-3 p-3 rounded-2xl border border-emerald-400/20 bg-emerald-400/5 hover:bg-emerald-400/10 text-left"
              >
                <Sparkles className="w-4 h-4 text-emerald-300 shrink-0" />
                <span className="text-sm text-white/70 truncate">{t("Improved version: ")}<span className="text-white">{v.title}</span> {t(" by ")}{v.authorName}</span>
              </button>
            ))}
          </div>
        )}

        {preview && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[10px] uppercase tracking-[0.2em] text-white/30 font-bold">{t("Preview")}</p>
              <button onClick={() => setShowPreview(v => !v)} className="text-[10px] uppercase tracking-widest text-white/40 hover:text-white flex items-center gap-1">
                <Maximize2 className="w-3 h-3" /> {showPreview ? t("Hide") : t("Show")}
              </button>
            </div>
            {showPreview && (
              <div className="relative w-full aspect-[4/3] sm:aspect-video rounded-2xl overflow-hidden border border-white/10 bg-white/5">
                <iframe
                  key={preview}
                  src={preview}
                  title={t("Preview of {0}", material.title)}
                  className="absolute inset-0 w-full h-full"
                  loading="lazy"
                  allow="autoplay; fullscreen"
                  referrerPolicy="no-referrer"
                />
              </div>
            )}
          </div>
        )}

        {material.description && (
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-white/30 mb-2 font-bold">{t("Description")}</p>
            <p className="text-sm sm:text-base text-white/75 font-light leading-relaxed whitespace-pre-line">{material.description}</p>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <button
            onClick={() => onAuthorClick?.(material.authorId, material.authorName, material.authorPhotoUrl)}
            className="flex items-center gap-3 min-w-0 p-3 rounded-2xl bg-white/[0.03] border border-white/5 hover:bg-white/[0.06] text-left"
          >
            <UserAvatar
              name={material.authorName}
              photoUrl={material.authorPhotoUrl}
              contributionCount={authorImpact}
              size="sm"
              customColor={authorProfile?.customColor}
            />
            <div className="min-w-0">
              <p className="text-[9px] uppercase tracking-widest text-white/40 font-semibold flex items-center gap-1.5">
                {t("Shared by ")}<span className={rank.color}>{t(authorProfile?.customBadge || rank.label)}</span>
              </p>
              <p className="text-sm text-white truncate">{material.authorName}</p>
            </div>
          </button>
          {(material.schoolName || material.className) && infoItem(
            <BookOpen className="w-4 h-4 text-luxury-gold" />,
            t("School & class"),
            [material.className, material.schoolName].filter(Boolean).join(' · ')
          )}
          {infoItem(<Calendar className="w-4 h-4 text-luxury-gold" />, t("Added"), format(material.createdAt, 'd MMM yyyy'))}
          {infoItem(<Eye className="w-4 h-4 text-luxury-gold" />, t("Opened / saved by"), t("{0} / {1} students", material.downloadCount || 0, material.saveCount || 0))}
        </div>

        {linkWarning && (
          <p className="text-xs text-amber-300/80">
            {t("The weekly link check could not open this link")}{material.linkStatus === 'restricted' ? t(" without signing in") : ''}. It may have been moved or made private.
          </p>
        )}
      </div>
    </Modal>
  );
}
