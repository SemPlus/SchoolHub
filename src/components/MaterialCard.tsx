import React from 'react';
import { FileText, File, Link as LinkIcon, ExternalLink, Download, Trash2, Presentation, Share2, Edit2, Move, Bookmark, BookmarkCheck, ArrowLeft } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Material } from '../types';
import { auth, db } from '../firebase';
import { doc, deleteDoc, updateDoc, increment, setDoc, serverTimestamp, collection, getDocs, query, where } from 'firebase/firestore';
import { motion, useMotionValue, useSpring, useMotionTemplate } from 'motion/react';
import { OperationType } from '../types';
import { getRank } from '../lib/ranks';
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

interface MaterialCardProps {
  key?: React.Key;
  material: Material;
  onAuthorClick?: (id: string, name: string, photoUrl?: string) => void;
  onCardClick?: (material: Material) => void;
  onEditClick?: (material: Material) => void;
  onMoveClick?: (material: Material) => void;
  userRole?: string | null;
  authorContributionCount?: number;
  isSaved?: boolean;
  isInTrash?: boolean;
  onRestore?: (material: Material) => void;
  isSelected?: boolean;
  onSelect?: (e: React.MouseEvent) => void;
  onDragStart?: () => void;
}

export default function MaterialCard({ 
  material, 
  onAuthorClick, 
  onCardClick, 
  onEditClick, 
  onMoveClick, 
  userRole, 
  authorContributionCount = 0, 
  isSaved = false, 
  isInTrash = false, 
  onRestore,
  isSelected = false,
  onSelect,
  onDragStart
}: MaterialCardProps) {
  const isOwner = auth.currentUser?.uid === material.authorId;
  const isAdmin = userRole === 'admin';
  const canEdit = isOwner || isAdmin;
  const canDelete = isOwner || isAdmin;
  const isAuthenticated = !!auth.currentUser;

  const rank = getRank(authorContributionCount);

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

  // Mouse tracking for spotlight effect with spring for smoothness
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
      await navigator.clipboard.writeText(material.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy: ', err);
    }
  };

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isExternalLink) {
      try {
        await updateDoc(doc(db, 'materials', material.id), {
          downloadCount: increment(1)
        });
      } catch (error) {
        try {
          handleFirestoreError(error, OperationType.UPDATE, `materials/${material.id}`);
        } catch (e) {}
      }
    }
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isInTrash) {
      setIsDeleting(true);
      try {
        await deleteDoc(doc(db, 'materials', material.id));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `materials/${material.id}`);
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
      handleFirestoreError(error, OperationType.UPDATE, `materials/${material.id}`);
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
    const deletedTime = material.deletedAt.getTime();
    const expiryTime = deletedTime + (30 * 24 * 60 * 60 * 1000);
    const remaining = Math.ceil((expiryTime - Date.now()) / (24 * 60 * 60 * 1000));
    return Math.max(0, remaining);
  };

  const handleSave = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!auth.currentUser) return;
    
    setIsSaving(true);
    try {
      if (isSaved) {
        // Unsave: Delete the save document
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
        // Save: Create a save document
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

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEditClick?.(material);
  };

  const handleAuthorClickInternal = (e: React.MouseEvent) => {
    e.stopPropagation();
    onAuthorClick?.(material.authorId, material.authorName, material.authorPhotoUrl);
  };

  const getIcon = () => {
    switch (material.type) {
      case 'pdf':
        return <FileText className="w-8 h-8 text-red-500" />;
      case 'word':
        return <File className="w-8 h-8 text-blue-500" />;
      case 'canva':
        return <Presentation className="w-8 h-8 text-purple-500" />;
      case 'link':
        return <LinkIcon className="w-8 h-8 text-green-500" />;
      default:
        return <File className="w-8 h-8 text-gray-500" />;
    }
  };

  const isExternalLink = material.type === 'link' || material.type === 'canva';

  return (
    <motion.div 
      onMouseMove={handleMouseMove}
      onClick={handleContainerClick}
      draggable={canEdit && !isInTrash}
      onDragStart={onDragStart}
      whileHover={{ y: -8, scale: 1.02 }}
      className={cn(
        "glass-panel rounded-[2rem] p-8 hover:bg-white/[0.08] group flex flex-col h-full relative overflow-hidden hover:shadow-[0_40px_80px_-20px_rgba(0,0,0,0.5)] hover:border-white/30 transition-all duration-500 cursor-pointer select-none",
        isSelected && "ring-2 ring-luxury-gold bg-luxury-gold/5 border-luxury-gold/20"
      )}
    >
      <div className="absolute inset-x-0 top-0 h-1 bg-luxury-gold opacity-0 transition-opacity" style={{ opacity: isSelected ? 1 : 0 }} />
      <motion.div
        className="pointer-events-none absolute -inset-px rounded-[2rem] opacity-0 transition duration-500 group-hover:opacity-100"
        style={{ background }}
      />

      {/* Decorative background element */}
      <div className="absolute -top-12 -right-12 w-24 h-24 bg-luxury-gold/5 rounded-full blur-2xl group-hover:bg-luxury-gold/20 transition-all duration-500 group-hover:scale-150"></div>
      <div className="absolute -bottom-12 -left-12 w-24 h-24 bg-white/5 rounded-full blur-2xl group-hover:bg-white/10 transition-all duration-500 group-hover:scale-150"></div>
      
      <div className="flex items-start justify-between mb-8 relative z-10">
        <motion.div 
          whileHover={{ rotate: 5, scale: 1.1 }}
          className="w-12 h-12 border border-white/10 rounded-2xl flex items-center justify-center bg-white/5 group-hover:border-luxury-gold/30 transition-colors backdrop-blur-sm"
        >
          {getIcon()}
        </motion.div>
        <div className="flex gap-2">
          {isInTrash && (
            <div className="px-2 py-1 bg-red-500/10 border border-red-500/20 rounded-md">
              <span className="text-[9px] font-bold text-red-400 uppercase tracking-tighter">
                Permanently deleted in {getDaysRemaining()} days
              </span>
            </div>
          )}
          {isInTrash ? (
            <button
              onClick={handleRestore}
              className="transition-all p-2 rounded-xl flex items-center justify-center min-w-[36px] bg-luxury-gold/20 text-luxury-gold hover:bg-luxury-gold hover:text-luxury-black opacity-100"
              title="Restore Manuscript"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          ) : (
            <>
              {isAuthenticated && (
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className={cn(
                    "transition-all p-2 rounded-xl flex items-center justify-center min-w-[36px] backdrop-blur-md opacity-0 group-hover:opacity-100",
                    isSaved ? "text-luxury-gold bg-luxury-gold/10" : "text-white/20 hover:text-luxury-gold hover:bg-white/10"
                  )}
                  title={isSaved ? "Unsave Manuscript" : "Save Manuscript"}
                >
                  {isSaving ? (
                    <div className="w-4 h-4 border-2 border-luxury-gold/30 border-t-luxury-gold rounded-full animate-spin" />
                  ) : isSaved ? (
                    <BookmarkCheck className="w-4 h-4" />
                  ) : (
                    <Bookmark className="w-4 h-4" />
                  )}
                </button>
              )}
              <button
                onClick={handleShare}
                className={`transition-all p-2 rounded-xl flex items-center justify-center min-w-[36px] backdrop-blur-md ${copied ? 'bg-luxury-gold/20 text-luxury-gold' : 'text-white/20 hover:text-white hover:bg-white/10 opacity-0 group-hover:opacity-100'}`}
                title="Copy Link"
              >
                {copied ? <span className="text-[10px] font-bold tracking-tighter uppercase">Copied</span> : <Share2 className="w-4 h-4" />}
              </button>
              {canEdit && (
                <>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onMoveClick?.(material);
                    }}
                    className="transition-all p-2 rounded-xl flex items-center justify-center min-w-[36px] backdrop-blur-md text-white/20 hover:text-luxury-gold hover:bg-white/10 opacity-0 group-hover:opacity-100"
                    title="Move Material"
                  >
                    <Move className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handleEdit}
                    className="transition-all p-2 rounded-xl flex items-center justify-center min-w-[36px] backdrop-blur-md text-white/20 hover:text-luxury-gold hover:bg-white/10 opacity-0 group-hover:opacity-100"
                    title="Edit Material"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                </>
              )}
            </>
          )}
          {canDelete && (
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className={cn(
                "transition-all p-2 rounded-xl flex items-center justify-center min-w-[36px] backdrop-blur-md opacity-0 group-hover:opacity-100 disabled:opacity-50",
                isInTrash ? "text-red-500 hover:bg-red-500/10 opacity-100" : "text-white/20 hover:text-red-400 hover:bg-red-400/10"
              )}
              title={isInTrash ? "Delete Permanently" : "Delete Material"}
            >
              {isDeleting ? <div className="w-4 h-4 border-2 border-red-400/30 border-t-red-400 rounded-full animate-spin" /> : <Trash2 className="w-4 h-4" />}
            </button>
          )}
        </div>
      </div>
      
      <h3 className="font-serif text-2xl text-white mb-3 line-clamp-2 leading-tight group-hover:text-luxury-gold transition-colors relative z-10">
        {material.title}
      </h3>

      {material.tags && material.tags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4 relative z-10">
          {material.tags.map((tag, index) => (
            <motion.span 
              key={index} 
              whileHover={{ scale: 1.1, backgroundColor: 'rgba(255,255,255,0.1)' }}
              className="text-[8px] uppercase tracking-widest px-2 py-0.5 border border-white/5 bg-white/5 text-white/40 rounded-full backdrop-blur-sm"
            >
              {tag}
            </motion.span>
          ))}
        </div>
      )}
      
      {material.description && (
        <p className="text-white/40 text-sm font-light leading-relaxed line-clamp-3 mb-8 flex-grow italic relative z-10">
          "{material.description}"
        </p>
      )}
      
      <div className="mt-auto pt-6 border-t border-white/5 flex items-center justify-between relative z-10">
        <div className="flex items-center gap-3">
          <UserAvatar
            name={material.authorName}
            photoUrl={material.authorPhotoUrl}
            contributionCount={authorContributionCount}
            size="md"
            isClickable
            onClick={handleAuthorClickInternal}
          />
          <div className="flex flex-col">
            <button 
              onClick={handleAuthorClickInternal}
              className="text-[10px] uppercase tracking-widest text-white/60 font-medium hover:text-luxury-gold transition-colors text-left flex items-center gap-2"
            >
              {material.authorName}
            </button>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`text-[8px] font-bold ${rank.color} uppercase tracking-tighter`}>
                {rank.label}
              </span>
              <span className="text-white/10">•</span>
              <span className="text-[10px] uppercase tracking-widest text-white/20">
                {material.createdAt ? formatDistanceToNow(material.createdAt, { addSuffix: true }) : 'Just now'}
              </span>
              {!isExternalLink && (
                <>
                  <span className="text-white/10">•</span>
                  <span className="text-[10px] uppercase tracking-widest text-white/40 flex items-center gap-1">
                    <Download className="w-2.5 h-2.5" />
                    {material.downloadCount || 0}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
        
        <motion.a
          href={material.url}
          target="_blank"
          rel="noopener noreferrer"
          download={!isExternalLink ? `${material.title}.${material.type === 'pdf' ? 'pdf' : material.type === 'word' ? 'docx' : 'file'}` : undefined}
          onClick={handleDownload}
          whileHover={{ x: 5 }}
          className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] font-medium text-white/80 hover:text-luxury-gold transition-colors"
        >
          {isExternalLink ? (
            <>
              <span>Access</span>
              <ExternalLink className="w-3 h-3" />
            </>
          ) : (
            <>
              <span>Retrieve</span>
              <Download className="w-3 h-3" />
            </>
          )}
        </motion.a>
      </div>
    </motion.div>
  );
}
