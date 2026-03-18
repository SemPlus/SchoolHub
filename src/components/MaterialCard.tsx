import React from 'react';
import { FileText, File, Link as LinkIcon, ExternalLink, Download, Trash2, Presentation, Share2, HardDrive } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Material } from '../types';
import { auth, db } from '../firebase';
import { doc, deleteDoc, updateDoc, increment } from 'firebase/firestore';
import { motion, useMotionValue, useSpring, useMotionTemplate } from 'motion/react';

interface MaterialCardProps {
  key?: React.Key;
  material: Material;
  onAuthorClick?: (id: string, name: string, photoUrl?: string) => void;
}

export default function MaterialCard({ material, onAuthorClick }: MaterialCardProps) {
  const isOwner = auth.currentUser?.uid === material.authorId;

  const [isDeleting, setIsDeleting] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  // Mouse tracking for spotlight effect
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  function handleMouseMove({ currentTarget, clientX, clientY }: React.MouseEvent) {
    const { left, top } = currentTarget.getBoundingClientRect();
    mouseX.set(clientX - left);
    mouseY.set(clientY - top);
  }

  const background = useMotionTemplate`radial-gradient(400px circle at ${mouseX}px ${mouseY}px, rgba(212, 175, 55, 0.15), transparent 70%)`;

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(material.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy: ', err);
    }
  };

  const handleDownload = async () => {
    if (!isExternalLink) {
      try {
        await updateDoc(doc(db, 'materials', material.id), {
          downloadCount: increment(1)
        });
      } catch (error) {
        console.error('Error incrementing download count: ', error);
      }
    }
  };

  const handleDelete = async () => {
    if (isDeleting) {
      try {
        await deleteDoc(doc(db, 'materials', material.id));
      } catch (error) {
        console.error('Error deleting document: ', error);
        alert('Failed to delete material.');
      }
    } else {
      setIsDeleting(true);
      setTimeout(() => setIsDeleting(false), 3000);
    }
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
      case 'drive':
        return <HardDrive className="w-8 h-8 text-luxury-gold" />;
      default:
        return <File className="w-8 h-8 text-gray-500" />;
    }
  };

  const isExternalLink = material.type === 'link' || material.type === 'canva' || material.type === 'drive';

  return (
    <motion.div 
      onMouseMove={handleMouseMove}
      whileHover={{ y: -12, scale: 1.03 }}
      className="glass-panel rounded-[2rem] p-8 hover:bg-white/[0.08] transition-all group flex flex-col h-full relative overflow-hidden hover:shadow-[0_40px_80px_-20px_rgba(0,0,0,0.5)] hover:border-white/30"
    >
      {/* Spotlight effect */}
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
          <button
            onClick={handleShare}
            className={`transition-all p-2 rounded-xl flex items-center justify-center min-w-[36px] backdrop-blur-md ${copied ? 'bg-luxury-gold/20 text-luxury-gold' : 'text-white/20 hover:text-white hover:bg-white/10 opacity-0 group-hover:opacity-100'}`}
            title="Copy Link"
          >
            {copied ? <span className="text-[10px] font-bold tracking-tighter uppercase">Copied</span> : <Share2 className="w-4 h-4" />}
          </button>
          {isOwner && (
            <button
              onClick={handleDelete}
              className={`transition-all p-2 rounded-xl flex items-center justify-center min-w-[36px] backdrop-blur-md ${isDeleting ? 'text-red-400 font-bold text-[10px] bg-red-400/10 uppercase tracking-tighter' : 'text-white/20 hover:text-red-400 hover:bg-red-400/10 opacity-0 group-hover:opacity-100'}`}
              title="Delete Material"
            >
              {isDeleting ? 'Confirm' : <Trash2 className="w-4 h-4" />}
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
        <div className="flex flex-col">
          <button 
            onClick={() => onAuthorClick?.(material.authorId, material.authorName, material.authorPhotoUrl)}
            className="text-[10px] uppercase tracking-widest text-white/60 font-medium hover:text-luxury-gold transition-colors text-left"
          >
            {material.authorName}
          </button>
          <div className="flex items-center gap-2 mt-1">
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
        
        <motion.a
          href={material.url}
          target="_blank"
          rel="noopener noreferrer"
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
