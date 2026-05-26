import React from 'react';
import { X, ExternalLink, Download, FileText, File, Presentation, Link as LinkIcon, Calendar, User, Tag, Trash2, Bookmark, BookmarkCheck, Share2, Home } from 'lucide-react';
import { Material } from '../types';
import { formatDistanceToNow } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { getRank } from '../lib/ranks';
import { doc, getDoc, deleteDoc, updateDoc, setDoc, query, where, collection, getDocs, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { User as UserType, OperationType } from '../types';
import { cn } from '../lib/utils';

const handleFirestoreError = (error: any, operationType: OperationType, path: string | null) => {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
};

import UserAvatar from './UserAvatar';

interface MaterialDetailModalProps {
  material: Material | null;
  isOpen: boolean;
  onClose: () => void;
  onAuthorClick?: (id: string, name: string, photoUrl?: string) => void;
  authorContributionCount?: number;
  userRole?: string | null;
  isDeepLink?: boolean;
}

export default function MaterialDetailModal({ material, isOpen, onClose, onAuthorClick, authorContributionCount = 0, userRole, isDeepLink }: MaterialDetailModalProps) {
  const [authorProfile, setAuthorProfile] = React.useState<UserType | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [isSaved, setIsSaved] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
      document.documentElement.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
      document.documentElement.style.overflow = 'unset';
    };
  }, [isOpen]);

  const handleClose = () => {
    // Clear URL query param if present
    const url = new URL(window.location.href);
    if (url.searchParams.has('material')) {
      url.searchParams.delete('material');
      window.history.replaceState({}, '', url.toString());
    }
    onClose();
  };

  const handleShare = async () => {
    if (!material) return;
    try {
      const shareUrl = `https://school-hub-iota.vercel.app/?material=${material.id}`;
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy: ', err);
    }
  };
  
  const isOwner = auth.currentUser?.uid === material?.authorId;
  const isAdmin = userRole === 'admin';
  const canDelete = isOwner || isAdmin;

  React.useEffect(() => {
    if (isOpen && material?.id && auth.currentUser) {
      const q = query(
        collection(db, 'saves'),
        where('userId', '==', auth.currentUser.uid),
        where('materialId', '==', material.id)
      );
      
      const unsubscribe = onSnapshot(q, (snapshot) => {
        setIsSaved(!snapshot.empty);
      }, (error) => {
        console.error("Material save status snapshot error:", error);
      });
      
      return () => unsubscribe();
    }
  }, [isOpen, material?.id]);

  const handleDelete = async () => {
    if (!material) return;
    if (confirm(`Move "${material.title}" to Trash?`)) {
      setIsDeleting(true);
      try {
        await updateDoc(doc(db, 'materials', material.id), {
          isDeleted: true,
          deletedAt: serverTimestamp()
        });
        onClose();
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `materials/${material.id}`);
      } finally {
        setIsDeleting(false);
      }
    }
  };
  
  React.useEffect(() => {
    if (isOpen && material?.authorId) {
      const fetchAuthor = async () => {
        try {
          const userDoc = await getDoc(doc(db, 'users', material.authorId));
          if (userDoc.exists()) {
            setAuthorProfile(userDoc.data() as UserType);
          }
        } catch (error) {
          console.error('Error fetching author profile:', error);
        }
      };
      fetchAuthor();
    }
  }, [isOpen, material?.authorId]);

  const handleSave = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!auth.currentUser || !material) return;
    
    setIsSaving(true);
    try {
      if (isSaved) {
        const q = query(
          collection(db, 'saves'),
          where('userId', '==', auth.currentUser.uid),
          where('materialId', '==', material.id)
        );
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
          await deleteDoc(doc(db, 'saves', snapshot.docs[0].id));
        }
      } else {
        const saveId = `${auth.currentUser.uid}_${material.id}`;
        await setDoc(doc(db, 'saves', saveId), {
          userId: auth.currentUser.uid,
          materialId: material.id,
          createdAt: serverTimestamp()
        });
      }
    } catch (error) {
       console.error('Failed to toggle save:', error);
    } finally {
      setIsSaving(false);
    }
  };

  if (!material) return null;

  const rank = getRank(authorContributionCount);

  const getIcon = () => {
    switch (material.type) {
      case 'pdf': return <FileText className="w-12 h-12 text-red-500" />;
      case 'word': return <File className="w-12 h-12 text-blue-500" />;
      case 'canva': return <Presentation className="w-12 h-12 text-purple-500" />;
      case 'link': return <LinkIcon className="w-12 h-12 text-green-500" />;
      default: return <File className="w-12 h-12 text-gray-500" />;
    }
  };

  const isExternalLink = material.type === 'link' || material.type === 'canva';

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          {/* Backdrop with touch block */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="absolute inset-0 bg-luxury-black/95 backdrop-blur-xl touch-none"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 30 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="glass-panel w-full max-w-4xl relative overflow-hidden flex flex-col md:flex-row rounded-[2rem] sm:rounded-[2.5rem] border-white/10 shadow-[0_50px_100px_-20px_rgba(0,0,0,0.5)] z-10 max-h-[85vh] h-full md:h-auto md:max-h-[90vh]"
          >
            {/* Background Decorative Glow */}
            <div className="absolute -top-48 -right-48 w-96 h-96 bg-luxury-gold/5 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute -bottom-48 -left-48 w-96 h-96 bg-white/5 rounded-full blur-[120px] pointer-events-none" />

            {/* Close Button */}
            <div className="absolute top-4 right-4 sm:top-6 sm:right-6 z-20">
              <button
                onClick={handleClose}
                className="text-white/40 hover:text-white transition-colors p-2 hover:bg-white/5 rounded-full backdrop-blur-md border border-white/5"
              >
                <X className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
            </div>

            {/* Left Section: Visual & Quick Info */}
            <div className="w-full md:w-1/3 p-4 sm:p-10 shrink-0 flex flex-col items-center bg-white/[0.02] border-b md:border-b-0 md:border-r border-white/5 z-10">
              <motion.div
                initial={{ rotate: -10, scale: 0.8, opacity: 0 }}
                animate={{ rotate: 0, scale: 1, opacity: 1 }}
                transition={{ delay: 0.2, duration: 0.5 }}
                className="hidden md:flex w-24 h-24 sm:w-32 sm:h-32 border border-white/10 rounded-[2rem] items-center justify-center bg-white/5 mb-6 sm:mb-8 shadow-2xl"
              >
                {getIcon()}
              </motion.div>

              <div className="flex flex-row md:flex-col items-center md:items-start justify-center gap-6 w-full overflow-x-auto pb-1 md:pb-0 scrollbar-none py-1 md:py-0">
                <div className="flex items-center gap-3 sm:gap-4 group cursor-pointer shrink-0" onClick={() => onAuthorClick?.(material.authorId, material.authorName, material.authorPhotoUrl)}>
                  <UserAvatar
                    name={material.authorName}
                    photoUrl={material.authorPhotoUrl}
                    contributionCount={authorContributionCount}
                    size="md"
                    className="group-hover:scale-110 transition-transform"
                    customColor={authorProfile?.customColor}
                  />
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-[8px] sm:text-[10px] uppercase tracking-widest text-white/40 font-semibold">Contributor</p>
                      <span className={`text-[7px] sm:text-[8px] px-1.5 py-0.5 rounded border border-white/10 bg-white/5 font-bold tracking-widest ${rank.color}`}>
                        {authorProfile?.customBadge || rank.label}
                      </span>
                    </div>
                    <p className="text-xs sm:text-sm font-medium text-white group-hover:text-luxury-gold transition-colors truncate max-w-[100px] sm:max-w-none">{material.authorName}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 sm:gap-4 shrink-0">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-white/5 flex items-center justify-center border border-white/5">
                    <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-luxury-gold" />
                  </div>
                  <div>
                    <p className="text-[8px] sm:text-[10px] uppercase tracking-widest text-white/40 mb-0.5 font-semibold">Recorded</p>
                    <p className="text-xs sm:text-sm font-medium text-white">
                      {material.createdAt ? new Date(material.createdAt).toLocaleDateString('en-US', { day: 'numeric', month: 'short' }) : '---'}
                    </p>
                  </div>
                </div>

                {!isExternalLink && (
                  <div className="flex items-center gap-3 sm:gap-4 shrink-0">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-white/5 flex items-center justify-center border border-white/5">
                      <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-luxury-gold" />
                    </div>
                    <div>
                      <p className="text-[8px] sm:text-[10px] uppercase tracking-widest text-white/40 mb-0.5 font-semibold">Retrieved</p>
                      <p className="text-xs sm:text-sm font-medium text-white">{material.downloadCount || 0}x</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right Section: Split into Scrollable Content and Sticky Action Footer */}
            <div className="flex-grow flex flex-col min-h-0 bg-transparent overflow-hidden">
              {/* Scrollable details */}
              <div className="flex-grow p-5 sm:p-10 overflow-y-auto min-h-0 scrollbar-none">
                <div className="mb-2">
                  <motion.div
                    initial={{ x: 20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: 0.3 }}
                  >
                    <span className="text-[8px] sm:text-[10px] uppercase tracking-[0.4em] text-luxury-gold font-semibold mb-2 sm:mb-4 block">Archive Entry</span>
                    <h2 className="text-2xl sm:text-3xl md:text-5xl font-serif text-white mb-4 sm:mb-6 leading-tight break-words">{material.title}</h2>
                  </motion.div>

                  {material.tags && material.tags.length > 0 && (
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.4 }}
                      className="flex flex-wrap gap-1.5 sm:gap-2 mb-6 sm:mb-8"
                    >
                      {material.tags.map((tag, i) => (
                        <span key={i} className="flex items-center gap-1.5 px-3 py-1 bg-white/5 border border-white/10 rounded-full text-[8.5px] uppercase tracking-widest text-white/60">
                          <Tag className="w-2.5 h-2.5 text-luxury-gold/50" />
                          {tag}
                        </span>
                      ))}
                    </motion.div>
                  )}

                  <motion.div 
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.5 }}
                    className="mb-4"
                  >
                    <h4 className="text-[8px] sm:text-[10px] uppercase tracking-[0.2em] text-white/20 mb-3 sm:mb-4 font-bold">Manuscript Description</h4>
                    <div className="p-4 sm:p-6 bg-white/[0.03] border border-white/5 rounded-2xl italic font-light leading-relaxed sm:leading-loose text-white/70">
                      <p className="text-sm sm:text-lg">"{material.description || 'No description provided for this entry.'}"</p>
                    </div>
                  </motion.div>
                </div>
              </div>

              {/* Sticky footer actions - always visible without scroll */}
              <motion.div 
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.55 }}
                className="mt-auto p-4 sm:p-6 border-t border-white/5 bg-luxury-black/95 backdrop-blur-md flex flex-col sm:flex-row gap-4 shrink-0 z-10"
              >
                <div className="flex gap-2 justify-between sm:justify-start w-full sm:w-auto">
                  <button
                    onClick={handleClose}
                    className="flex-grow sm:flex-grow-0 flex items-center justify-center gap-2 px-4 sm:px-6 py-3 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white rounded-full transition-all border border-white/10 backdrop-blur-md group"
                    title="Return to Library"
                  >
                    <Home className="w-4 h-4 text-luxury-gold group-hover:scale-110 transition-transform" />
                    <span className="text-[9px] uppercase tracking-widest font-bold">Home</span>
                  </button>

                  <button
                    onClick={handleShare}
                    className={cn(
                      "flex-grow sm:flex-grow-0 flex items-center justify-center gap-2 px-4 sm:px-6 py-3 rounded-full transition-all border backdrop-blur-md group",
                      copied ? "bg-luxury-gold/20 border-luxury-gold text-luxury-gold" : "bg-white/5 border-white/10 text-white/60 hover:text-white hover:bg-white/10"
                    )}
                    title="Copy Link"
                  >
                    {copied ? (
                      <span className="text-[9px] font-bold tracking-widest uppercase">Copied</span>
                    ) : (
                      <>
                        <Share2 className="w-4 h-4 group-hover:scale-110 transition-transform" />
                        <span className="text-[9px] uppercase tracking-widest font-bold">Share</span>
                      </>
                    )}
                  </button>

                  {auth.currentUser && (
                    <button
                      onClick={handleSave}
                      disabled={isSaving}
                      className={cn(
                        "flex-grow sm:flex-grow-0 flex items-center justify-center gap-2 px-4 sm:px-6 py-3 rounded-full transition-all border backdrop-blur-md group",
                        isSaved ? "bg-luxury-gold/10 border-luxury-gold/50 text-luxury-gold" : "bg-white/5 border-white/10 text-white/60 hover:text-white hover:bg-white/10"
                      )}
                      title={isSaved ? "Unsave" : "Save"}
                    >
                      {isSaving ? (
                        <div className="w-4 h-4 border-2 border-luxury-gold/30 border-t-luxury-gold rounded-full animate-spin" />
                      ) : isSaved ? (
                        <>
                          <BookmarkCheck className="w-4 h-4 text-luxury-gold group-hover:scale-110 transition-transform" />
                          <span className="text-[9px] uppercase tracking-widest font-bold hidden sm:inline">Saved</span>
                        </>
                      ) : (
                        <>
                          <Bookmark className="w-4 h-4 group-hover:scale-110 transition-transform" />
                          <span className="text-[9px] uppercase tracking-widest font-bold hidden sm:inline">Save</span>
                        </>
                      )}
                    </button>
                  )}
                </div>

                <div className="flex gap-4 flex-grow w-full">
                  {canDelete && (
                    <button
                      onClick={handleDelete}
                      disabled={isDeleting}
                      className="flex items-center justify-center gap-2 px-4 py-3 bg-red-400/10 text-red-400 font-medium hover:bg-red-400/20 transition-all rounded-full border border-red-400/20 disabled:opacity-50"
                    >
                      {isDeleting ? (
                        <div className="w-4 h-4 border-2 border-red-400/30 border-t-red-400 rounded-full animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                      <span className="hidden sm:inline text-[9px] uppercase tracking-widest font-bold font-sans">Expunge</span>
                    </button>
                  )}
                  <a
                    href={material.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-grow flex items-center justify-center gap-2 py-3 bg-white text-luxury-black hover:bg-luxury-gold transition-all rounded-full group shadow-lg shadow-white/5"
                  >
                    {isExternalLink ? (
                      <>
                        <span className="uppercase tracking-[0.2em] text-xs font-bold font-sans">Open Link</span>
                        <ExternalLink className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform text-luxury-black" />
                      </>
                    ) : (
                      <>
                        <span className="uppercase tracking-[0.2em] text-xs font-bold font-sans">Open Manuscript</span>
                        <Download className="w-4 h-4 group-hover:translate-y-0.5 transition-transform text-luxury-black" />
                      </>
                    )}
                  </a>
                </div>
              </motion.div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
