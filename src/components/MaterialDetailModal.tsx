import React from 'react';
import {
  X, ExternalLink, Download, FileText, File, Presentation, Link as LinkIcon, Calendar, Tag, Trash2,
  Bookmark, BookmarkCheck, Share2, BookOpen, BadgeCheck, AlertTriangle, CalendarClock, Eye,
} from 'lucide-react';
import { format } from 'date-fns';
import { Material } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { getRank } from '../lib/ranks';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { User as UserType } from '../types';
import { cn } from '../lib/utils';
import { firebaseErrorMessage, recordOpen, setVerified, toggleSave } from '../lib/engagement';
import { useAppData } from '../context/AppData';
import { linkStatusLabel } from './MaterialCard';
import UserAvatar from './UserAvatar';

interface MaterialDetailModalProps {
  material: Material | null;
  isOpen: boolean;
  onClose: () => void;
  onAuthorClick?: (id: string, name: string, photoUrl?: string) => void;
  /** Impact score of the author. */
  authorImpact?: number;
  userRole?: string | null;
  isSaved?: boolean;
  isDeepLink?: boolean;
}

export default function MaterialDetailModal({ material, isOpen, onClose, onAuthorClick, authorImpact = 0, userRole, isSaved = false }: MaterialDetailModalProps) {
  const { profile } = useAppData();
  const [authorProfile, setAuthorProfile] = React.useState<UserType | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isVerifying, setIsVerifying] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    const value = isOpen ? 'hidden' : '';
    document.body.style.overflow = value;
    document.documentElement.style.overflow = value;
    return () => {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    };
  }, [isOpen]);

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
  const canDelete = isOwner || isAdmin;
  // Teachers verify materials from their own school, never their own uploads.
  const canVerify = !!uid && !isOwner && (isAdmin || (userRole === 'teacher' && !!profile?.schoolId && profile.schoolId === material.schoolId));
  const rank = getRank(authorImpact);
  const isExternalLink = material.type === 'link' || material.type === 'canva';
  const linkWarning = linkStatusLabel(material.linkStatus);

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
    if (!confirm(`Move "${material.title}" to Trash?`)) return;
    setIsDeleting(true);
    try {
      await updateDoc(doc(db, 'materials', material.id), {
        isDeleted: true,
        deletedAt: serverTimestamp()
      });
      handleClose();
    } catch (error) {
      alert(firebaseErrorMessage(error, 'Could not move this material to Trash.'));
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await toggleSave(material, isSaved);
    } catch (error) {
      alert(firebaseErrorMessage(error, 'Could not update your saved materials.'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleVerify = async () => {
    setIsVerifying(true);
    try {
      await setVerified(material, !material.verifiedBy);
    } catch (error) {
      alert(firebaseErrorMessage(error, 'Could not change the verification.'));
    } finally {
      setIsVerifying(false);
    }
  };

  const getIcon = () => {
    switch (material.type) {
      case 'pdf': return <FileText className="w-12 h-12 text-red-500" />;
      case 'word': return <File className="w-12 h-12 text-blue-500" />;
      case 'canva': return <Presentation className="w-12 h-12 text-purple-500" />;
      case 'link': return <LinkIcon className="w-12 h-12 text-green-500" />;
      default: return <File className="w-12 h-12 text-gray-500" />;
    }
  };

  const infoRow = (icon: React.ReactNode, label: string, value: React.ReactNode) => (
    <div className="flex items-center gap-3 sm:gap-4 shrink-0">
      <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-white/5 flex items-center justify-center border border-white/5">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[8px] sm:text-[10px] uppercase tracking-widest text-white/40 mb-0.5 font-semibold">{label}</p>
        <div className="text-xs sm:text-sm font-medium text-white truncate max-w-[180px]">{value}</div>
      </div>
    </div>
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="absolute inset-0 bg-luxury-black/95 backdrop-blur-xl touch-none"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 30 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="glass-panel w-full max-w-4xl relative overflow-hidden flex flex-col md:flex-row rounded-[2rem] sm:rounded-[2.5rem] border-white/10 shadow-[0_50px_100px_-20px_rgba(0,0,0,0.5)] z-10 max-h-[88vh] h-full md:h-auto md:max-h-[90vh]"
          >
            <div className="absolute top-4 right-4 sm:top-6 sm:right-6 z-20">
              <button
                onClick={handleClose}
                className="text-white/40 hover:text-white transition-colors p-2 hover:bg-white/5 rounded-full backdrop-blur-md border border-white/5"
                title="Close"
              >
                <X className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
            </div>

            {/* Left: quick info */}
            <div className="w-full md:w-1/3 p-4 sm:p-10 shrink-0 flex flex-col items-center bg-white/[0.02] border-b md:border-b-0 md:border-r border-white/5 z-10">
              <div className="hidden md:flex w-32 h-32 border border-white/10 rounded-[2rem] items-center justify-center bg-white/5 mb-8 shadow-2xl">
                {getIcon()}
              </div>

              <div className="flex flex-row md:flex-col items-center md:items-start justify-start gap-6 w-full overflow-x-auto pb-1 md:pb-0 scrollbar-none py-1 md:py-0">
                <div
                  className="flex items-center gap-3 sm:gap-4 group cursor-pointer shrink-0"
                  onClick={() => onAuthorClick?.(material.authorId, material.authorName, material.authorPhotoUrl)}
                >
                  <UserAvatar
                    name={material.authorName}
                    photoUrl={material.authorPhotoUrl}
                    contributionCount={authorImpact}
                    size="md"
                    className="group-hover:scale-110 transition-transform"
                    customColor={authorProfile?.customColor}
                  />
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-[8px] sm:text-[10px] uppercase tracking-widest text-white/40 font-semibold">Shared by</p>
                      <span className={`text-[7px] sm:text-[8px] px-1.5 py-0.5 rounded border border-white/10 bg-white/5 font-bold tracking-widest ${rank.color}`}>
                        {authorProfile?.customBadge || rank.label}
                      </span>
                    </div>
                    <p className="text-xs sm:text-sm font-medium text-white group-hover:text-luxury-gold transition-colors truncate max-w-[120px] sm:max-w-none">{material.authorName}</p>
                  </div>
                </div>

                {(material.schoolName || material.className) && infoRow(
                  <BookOpen className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-luxury-gold" />,
                  'School & class',
                  [material.className, material.schoolName].filter(Boolean).join(' · ')
                )}

                {material.examDate && infoRow(
                  <CalendarClock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-red-300" />,
                  'Test date',
                  format(material.examDate, 'EEEE d MMMM')
                )}

                {infoRow(
                  <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-luxury-gold" />,
                  'Added',
                  format(material.createdAt, 'd MMM yyyy')
                )}

                {infoRow(
                  <Eye className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-luxury-gold" />,
                  'Opened / saved by',
                  `${material.downloadCount || 0} / ${material.saveCount || 0} students`
                )}
              </div>
            </div>

            {/* Right: details and actions */}
            <div className="flex-grow flex flex-col min-h-0 bg-transparent overflow-hidden">
              <div className="flex-grow p-5 sm:p-10 overflow-y-auto min-h-0 scrollbar-none">
                <span className="text-[8px] sm:text-[10px] uppercase tracking-[0.4em] text-luxury-gold font-semibold mb-2 sm:mb-4 block">
                  {material.subject || 'Material'}
                </span>
                <h2 className="text-2xl sm:text-3xl md:text-5xl font-serif text-white mb-4 sm:mb-6 leading-tight break-words pr-10">{material.title}</h2>

                <div className="flex flex-wrap gap-2 mb-6">
                  {material.verifiedBy && (
                    <span className="flex items-center gap-1.5 px-3 py-1 bg-purple-400/10 border border-purple-400/30 rounded-full text-[9px] uppercase tracking-widest text-purple-300">
                      <BadgeCheck className="w-3.5 h-3.5" />
                      Verified by {material.verifiedByName || 'a teacher'}
                    </span>
                  )}
                  {linkWarning && (
                    <span className="flex items-center gap-1.5 px-3 py-1 bg-amber-400/10 border border-amber-400/30 rounded-full text-[9px] uppercase tracking-widest text-amber-300">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      {linkWarning}
                    </span>
                  )}
                  {material.tags?.map((tag, i) => (
                    <span key={i} className="flex items-center gap-1.5 px-3 py-1 bg-white/5 border border-white/10 rounded-full text-[9px] uppercase tracking-widest text-white/60">
                      <Tag className="w-2.5 h-2.5 text-luxury-gold/50" />
                      {tag}
                    </span>
                  ))}
                </div>

                <h4 className="text-[8px] sm:text-[10px] uppercase tracking-[0.2em] text-white/30 mb-3 font-bold">Description</h4>
                <div className="p-4 sm:p-6 bg-white/[0.03] border border-white/5 rounded-2xl font-light leading-relaxed text-white/70">
                  <p className="text-sm sm:text-base whitespace-pre-line">{material.description || 'No description.'}</p>
                </div>

                {linkWarning && (
                  <p className="mt-4 text-xs text-amber-300/80">
                    The weekly link check could not open this link{material.linkStatus === 'restricted' ? ' without signing in' : ''}. It may have been moved or made private.
                  </p>
                )}
              </div>

              <div className="mt-auto p-4 sm:p-6 border-t border-white/5 bg-luxury-black/95 backdrop-blur-md flex flex-col sm:flex-row gap-3 shrink-0 z-10">
                <div className="flex gap-2 w-full sm:w-auto">
                  <button
                    onClick={handleShare}
                    className={cn(
                      "flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-3 rounded-full transition-all border",
                      copied ? "bg-luxury-gold/20 border-luxury-gold text-luxury-gold" : "bg-white/5 border-white/10 text-white/60 hover:text-white hover:bg-white/10"
                    )}
                  >
                    <Share2 className="w-4 h-4" />
                    <span className="text-[9px] uppercase tracking-widest font-bold">{copied ? 'Copied' : 'Share'}</span>
                  </button>

                  {auth.currentUser && (
                    <button
                      onClick={handleSave}
                      disabled={isSaving}
                      className={cn(
                        "flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-3 rounded-full transition-all border",
                        isSaved ? "bg-luxury-gold/10 border-luxury-gold/50 text-luxury-gold" : "bg-white/5 border-white/10 text-white/60 hover:text-white hover:bg-white/10"
                      )}
                    >
                      {isSaving
                        ? <div className="w-4 h-4 border-2 border-luxury-gold/30 border-t-luxury-gold rounded-full animate-spin" />
                        : isSaved ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
                      <span className="text-[9px] uppercase tracking-widest font-bold">{isSaved ? 'Saved' : 'Save'}</span>
                    </button>
                  )}

                  {canVerify && (
                    <button
                      onClick={handleVerify}
                      disabled={isVerifying}
                      className={cn(
                        "flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-3 rounded-full transition-all border disabled:opacity-50",
                        material.verifiedBy ? "bg-purple-400/15 border-purple-400/40 text-purple-200" : "bg-white/5 border-white/10 text-white/60 hover:text-white hover:bg-white/10"
                      )}
                      title={material.verifiedBy ? 'Remove verification' : 'Mark as correct'}
                    >
                      <BadgeCheck className="w-4 h-4" />
                      <span className="text-[9px] uppercase tracking-widest font-bold">{material.verifiedBy ? 'Unverify' : 'Verify'}</span>
                    </button>
                  )}

                  {canDelete && (
                    <button
                      onClick={handleDelete}
                      disabled={isDeleting}
                      className="flex items-center justify-center gap-2 px-4 py-3 bg-red-400/10 text-red-400 hover:bg-red-400/20 transition-all rounded-full border border-red-400/20 disabled:opacity-50"
                      title="Move to Trash"
                    >
                      {isDeleting
                        ? <div className="w-4 h-4 border-2 border-red-400/30 border-t-red-400 rounded-full animate-spin" />
                        : <Trash2 className="w-4 h-4" />}
                    </button>
                  )}
                </div>

                <a
                  href={material.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => recordOpen(material)}
                  className="flex-grow flex items-center justify-center gap-2 py-3 bg-white text-luxury-black hover:bg-luxury-gold transition-all rounded-full shadow-lg shadow-white/5"
                >
                  <span className="uppercase tracking-[0.2em] text-xs font-bold">Open</span>
                  {isExternalLink ? <ExternalLink className="w-4 h-4" /> : <Download className="w-4 h-4" />}
                </a>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
