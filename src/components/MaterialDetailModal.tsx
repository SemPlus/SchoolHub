import React from 'react';
import { X, ExternalLink, Download, FileText, File, Presentation, Link as LinkIcon, Calendar, User, Tag, Trash2, Bookmark, BookmarkCheck, Share2 } from 'lucide-react';
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
}

export default function MaterialDetailModal({ material, isOpen, onClose, onAuthorClick, authorContributionCount = 0, userRole }: MaterialDetailModalProps) {
  const [authorProfile, setAuthorProfile] = React.useState<UserType | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [isSaved, setIsSaved] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

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
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-luxury-black/90 backdrop-blur-xl"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="glass-panel w-full max-w-4xl relative overflow-hidden flex flex-col md:flex-row rounded-[2.5rem] border-white/10 shadow-[0_50px_100px_-20px_rgba(0,0,0,0.5)] z-10 max-h-[90vh]"
          >
            {/* Background Decorative Glow */}
            <div className="absolute -top-48 -right-48 w-96 h-96 bg-luxury-gold/5 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute -bottom-48 -left-48 w-96 h-96 bg-white/5 rounded-full blur-[120px] pointer-events-none" />

            {/* Close Button */}
            <div className="absolute top-6 right-6 flex items-center gap-2 z-20">
              <button
                onClick={handleShare}
                className={cn(
                  "transition-all p-2 rounded-full flex items-center justify-center min-w-[40px] backdrop-blur-md",
                  copied ? "bg-luxury-gold/20 text-luxury-gold" : "text-white/20 hover:text-white hover:bg-white/5"
                )}
                title="Copy Link"
              >
                {copied ? <span className="text-[10px] font-bold tracking-tighter uppercase">Copied</span> : <Share2 className="w-5 h-5" />}
              </button>
              {auth.currentUser && (
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className={cn(
                    "text-white/20 hover:text-luxury-gold transition-colors p-2 hover:bg-white/5 rounded-full",
                    isSaved && "text-luxury-gold"
                  )}
                  title={isSaved ? "Unsave" : "Save"}
                >
                  {isSaving ? (
                    <div className="w-5 h-5 border-2 border-luxury-gold/30 border-t-luxury-gold rounded-full animate-spin" />
                  ) : isSaved ? (
                    <BookmarkCheck className="w-6 h-6" />
                  ) : (
                    <Bookmark className="w-6 h-6" />
                  )}
                </button>
              )}
              <button
                onClick={onClose}
                className="text-white/20 hover:text-white transition-colors p-2 hover:bg-white/5 rounded-full"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Left Section: Visual & Quick Info */}
            <div className="w-full md:w-1/3 p-10 flex flex-col items-center bg-white/[0.02] border-b md:border-b-0 md:border-r border-white/5">
              <motion.div
                initial={{ rotate: -10, scale: 0.8, opacity: 0 }}
                animate={{ rotate: 0, scale: 1, opacity: 1 }}
                transition={{ delay: 0.2, duration: 0.5 }}
                className="w-32 h-32 border border-white/10 rounded-[2rem] flex items-center justify-center bg-white/5 mb-8 shadow-2xl"
              >
                {getIcon()}
              </motion.div>

              <div className="space-y-6 w-full">
                <div className="flex items-center gap-4 group cursor-pointer" onClick={() => onAuthorClick?.(material.authorId, material.authorName, material.authorPhotoUrl)}>
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
                      <p className="text-[10px] uppercase tracking-widest text-white/40">Contributor</p>
                      <span className={`text-[8px] px-1.5 py-0.5 rounded border border-white/10 bg-white/5 font-bold tracking-widest ${rank.color}`}>
                        {authorProfile?.customBadge || rank.label}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-white group-hover:text-luxury-gold transition-colors">{material.authorName}</p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center border border-white/5">
                    <Calendar className="w-4 h-4 text-luxury-gold" />
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-white/40 mb-0.5">Recorded on</p>
                    <p className="text-sm font-medium text-white">
                      {material.createdAt ? new Date(material.createdAt).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Unknown Date'}
                    </p>
                  </div>
                </div>

                {!isExternalLink && (
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center border border-white/5">
                      <Download className="w-4 h-4 text-luxury-gold" />
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-widest text-white/40 mb-0.5">Retrieved</p>
                      <p className="text-sm font-medium text-white">{material.downloadCount || 0} times</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right Section: Details & Action */}
            <div className="flex-grow p-10 flex flex-col h-full bg-transparent overflow-y-auto">
              <div>
                <motion.div
                  initial={{ x: 20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.3 }}
                >
                  <span className="text-[10px] uppercase tracking-[0.4em] text-luxury-gold font-semibold mb-4 block">Archive Entry</span>
                  <h2 className="text-4xl md:text-5xl font-serif text-white mb-6 leading-tight">{material.title}</h2>
                </motion.div>

                {material.tags && material.tags.length > 0 && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.4 }}
                    className="flex flex-wrap gap-2 mb-8"
                  >
                    {material.tags.map((tag, i) => (
                      <span key={i} className="flex items-center gap-1.5 px-3 py-1 bg-white/5 border border-white/10 rounded-full text-[9px] uppercase tracking-widest text-white/60">
                        <Tag className="w-2 h-2 text-luxury-gold/50" />
                        {tag}
                      </span>
                    ))}
                  </motion.div>
                )}

                <motion.div 
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  className="mb-10"
                >
                  <h4 className="text-[10px] uppercase tracking-[0.2em] text-white/20 mb-4 font-bold">Manuscript Description</h4>
                  <div className="p-6 bg-white/[0.03] border border-white/5 rounded-2xl italic font-light leading-loose text-white/70">
                    <p className="text-lg">"{material.description || 'No description provided for this entry.'}"</p>
                  </div>
                </motion.div>
              </div>

              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="mt-auto pt-6 border-t border-white/5 flex gap-4"
              >
                {canDelete && (
                  <button
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="flex items-center justify-center gap-3 px-6 py-4 bg-red-400/10 text-red-400 font-medium hover:bg-red-400/20 transition-all rounded-full disabled:opacity-50"
                  >
                    {isDeleting ? (
                      <div className="w-5 h-5 border-2 border-red-400/30 border-t-red-400 rounded-full animate-spin" />
                    ) : (
                      <Trash2 className="w-5 h-5" />
                    )}
                    <span>Expunge</span>
                  </button>
                )}
                <a
                  href={material.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-grow flex items-center justify-center gap-3 py-4 bg-white text-luxury-black font-medium hover:bg-luxury-gold transition-all rounded-full group"
                >
                  {isExternalLink ? (
                    <>
                      <span>Access Entry</span>
                      <ExternalLink className="w-5 h-5 group-hover:scale-110 transition-transform" />
                    </>
                  ) : (
                    <>
                      <span>Retrieve Manuscript</span>
                      <Download className="w-5 h-5 group-hover:scale-110 transition-transform" />
                    </>
                  )}
                </a>
              </motion.div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
