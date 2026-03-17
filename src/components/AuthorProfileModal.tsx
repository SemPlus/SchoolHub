import React from 'react';
import { X, BookOpen, ExternalLink, Download, FileText, File, Link as LinkIcon } from 'lucide-react';
import { Material } from '../types';
import { formatDistanceToNow } from 'date-fns';

interface AuthorProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  authorName: string;
  authorPhotoUrl?: string;
  materials: Material[];
}

export default function AuthorProfileModal({ isOpen, onClose, authorName, authorPhotoUrl, materials }: AuthorProfileModalProps) {
  if (!isOpen) return null;

  const getIcon = (type: string) => {
    switch (type) {
      case 'pdf': return <FileText className="w-4 h-4 text-red-400" />;
      case 'word': return <File className="w-4 h-4 text-blue-400" />;
      case 'canva': return <BookOpen className="w-4 h-4 text-purple-400" />;
      case 'link': return <LinkIcon className="w-4 h-4 text-emerald-400" />;
      default: return <File className="w-4 h-4 text-gray-400" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-luxury-black/95 backdrop-blur-xl p-4">
      <div className="glass-panel rounded-[2.5rem] shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[85vh] border-white/5">
        {/* Header */}
        <div className="relative p-10 border-b border-white/5 bg-white/[0.02]">
          <button 
            onClick={onClose} 
            className="absolute top-8 right-8 text-white/20 hover:text-white transition-colors p-2 hover:bg-white/5 rounded-full"
          >
            <X className="w-6 h-6" />
          </button>

          <div className="flex flex-col md:flex-row items-center gap-8">
            <div className="relative">
              <div className="absolute inset-0 bg-luxury-gold/20 rounded-full blur-2xl"></div>
              <img 
                src={authorPhotoUrl || `https://ui-avatars.com/api/?name=${authorName}&background=random&color=fff`} 
                alt={authorName}
                className="w-32 h-32 rounded-full border-2 border-luxury-gold/30 p-1 relative z-10 object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="text-center md:text-left">
              <h2 className="text-5xl font-serif text-white mb-2 tracking-tight">{authorName}</h2>
              <div className="flex items-center justify-center md:justify-start gap-4">
                <span className="text-[10px] uppercase tracking-[0.3em] text-luxury-gold font-semibold">Contributor</span>
                <div className="w-1 h-1 bg-white/20 rounded-full"></div>
                <span className="text-[10px] uppercase tracking-[0.3em] text-white/40">{materials.length} Manuscripts Shared</span>
              </div>
            </div>
          </div>
        </div>

        {/* Materials List */}
        <div className="flex-grow overflow-y-auto p-10 custom-scrollbar bg-luxury-black/20">
          <h3 className="text-[10px] uppercase tracking-[0.3em] text-white/20 mb-8 font-bold">Academic Portfolio</h3>
          
          {materials.length === 0 ? (
            <div className="text-center py-20 border border-white/5 rounded-3xl">
              <p className="text-white/40 font-light italic">No public records found for this author.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {materials.map((material) => (
                <div key={material.id} className="glass-panel p-6 rounded-2xl hover:bg-white/5 transition-all group border-white/5">
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-10 h-10 border border-white/5 rounded-xl flex items-center justify-center bg-white/5">
                      {getIcon(material.type)}
                    </div>
                    <a 
                      href={material.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-white/20 hover:text-luxury-gold transition-colors"
                    >
                      {material.type === 'link' || material.type === 'canva' ? <ExternalLink className="w-4 h-4" /> : <Download className="w-4 h-4" />}
                    </a>
                  </div>
                  <h4 className="text-lg font-serif text-white mb-2 line-clamp-1 group-hover:text-luxury-gold transition-colors">
                    {material.title}
                  </h4>
                  <div className="flex items-center justify-between mt-4">
                    <span className="text-[9px] uppercase tracking-widest text-white/20">
                      {formatDistanceToNow(material.createdAt, { addSuffix: true })}
                    </span>
                    <div className="flex gap-1">
                      {material.tags?.slice(0, 2).map((tag, i) => (
                        <span key={i} className="text-[7px] uppercase tracking-tighter px-1.5 py-0.5 bg-white/5 text-white/30 rounded-md border border-white/5">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
