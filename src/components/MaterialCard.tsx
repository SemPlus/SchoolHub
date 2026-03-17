import React from 'react';
import { FileText, File, Link as LinkIcon, ExternalLink, Download, Trash2, Presentation, Share2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Material } from '../types';
import { auth, db } from '../firebase';
import { doc, deleteDoc } from 'firebase/firestore';

interface MaterialCardProps {
  key?: React.Key;
  material: Material;
  onAuthorClick?: (id: string, name: string, photoUrl?: string) => void;
}

export default function MaterialCard({ material, onAuthorClick }: MaterialCardProps) {
  const isOwner = auth.currentUser?.uid === material.authorId;

  const [isDeleting, setIsDeleting] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(material.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy: ', err);
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
      default:
        return <File className="w-8 h-8 text-gray-500" />;
    }
  };

  const isExternalLink = material.type === 'link' || material.type === 'canva';

  return (
    <div className="glass-panel rounded-3xl p-8 hover:bg-white/10 transition-all group flex flex-col h-full relative overflow-hidden">
      {/* Decorative background element */}
      <div className="absolute -top-12 -right-12 w-24 h-24 bg-luxury-gold/5 rounded-full blur-2xl group-hover:bg-luxury-gold/10 transition-colors"></div>
      
      <div className="flex items-start justify-between mb-8">
        <div className="w-12 h-12 border border-white/10 rounded-2xl flex items-center justify-center bg-white/5 group-hover:border-luxury-gold/30 transition-colors">
          {getIcon()}
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleShare}
            className={`transition-all p-2 rounded-xl flex items-center justify-center min-w-[36px] ${copied ? 'bg-luxury-gold/20 text-luxury-gold' : 'text-white/20 hover:text-white hover:bg-white/5 opacity-0 group-hover:opacity-100'}`}
            title="Copy Link"
          >
            {copied ? <span className="text-[10px] font-bold tracking-tighter uppercase">Copied</span> : <Share2 className="w-4 h-4" />}
          </button>
          {isOwner && (
            <button
              onClick={handleDelete}
              className={`transition-all p-2 rounded-xl flex items-center justify-center min-w-[36px] ${isDeleting ? 'text-red-400 font-bold text-[10px] bg-red-400/10 uppercase tracking-tighter' : 'text-white/20 hover:text-red-400 hover:bg-red-400/5 opacity-0 group-hover:opacity-100'}`}
              title="Delete Material"
            >
              {isDeleting ? 'Confirm' : <Trash2 className="w-4 h-4" />}
            </button>
          )}
        </div>
      </div>
      
      <h3 className="font-serif text-2xl text-white mb-3 line-clamp-2 leading-tight group-hover:text-luxury-gold transition-colors">
        {material.title}
      </h3>

      {material.tags && material.tags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {material.tags.map((tag, index) => (
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
        <p className="text-white/40 text-sm font-light leading-relaxed line-clamp-3 mb-8 flex-grow italic">
          "{material.description}"
        </p>
      )}
      
      <div className="mt-auto pt-6 border-t border-white/5 flex items-center justify-between">
        <div className="flex flex-col">
          <button 
            onClick={() => onAuthorClick?.(material.authorId, material.authorName, material.authorPhotoUrl)}
            className="text-[10px] uppercase tracking-widest text-white/60 font-medium hover:text-luxury-gold transition-colors text-left"
          >
            {material.authorName}
          </button>
          <span className="text-[10px] uppercase tracking-widest text-white/20 mt-1">
            {material.createdAt ? formatDistanceToNow(material.createdAt, { addSuffix: true }) : 'Just now'}
          </span>
        </div>
        
        <a
          href={material.url}
          target="_blank"
          rel="noopener noreferrer"
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
        </a>
      </div>
    </div>
  );
}
