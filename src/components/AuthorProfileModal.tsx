import React from 'react';
import { X, BookOpen, ExternalLink, Download, FileText, File, Link as LinkIcon } from 'lucide-react';
import { Material } from '../types';
import { formatDistanceToNow } from 'date-fns';
import { doc, updateDoc, increment } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { motion, AnimatePresence } from 'motion/react';
import { OperationType } from '../types';

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

interface AuthorProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  authorName: string;
  authorPhotoUrl?: string;
  materials: Material[];
}

export default function AuthorProfileModal({ isOpen, onClose, authorName, authorPhotoUrl, materials }: AuthorProfileModalProps) {
  const getIcon = (type: string) => {
    switch (type) {
      case 'pdf': return <FileText className="w-4 h-4 text-red-400" />;
      case 'word': return <File className="w-4 h-4 text-blue-400" />;
      case 'canva': return <BookOpen className="w-4 h-4 text-purple-400" />;
      case 'link': return <LinkIcon className="w-4 h-4 text-emerald-400" />;
      default: return <File className="w-4 h-4 text-gray-400" />;
    }
  };

  const handleDownload = async (material: Material) => {
    if (material.type !== 'link' && material.type !== 'canva') {
      try {
        await updateDoc(doc(db, 'materials', material.id), {
          downloadCount: increment(1)
        });
      } catch (error) {
        try {
          handleFirestoreError(error, OperationType.UPDATE, `materials/${material.id}`);
        } catch (e) {
          console.error('Error incrementing download count: ', error);
        }
      }
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-luxury-black/95 backdrop-blur-2xl p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="glass-panel rounded-[2.5rem] shadow-[0_50px_100px_-20px_rgba(0,0,0,0.5)] w-full max-w-4xl overflow-hidden flex flex-col max-h-[85vh] border-white/20 relative"
          >
            {/* Decorative background element */}
            <div className="absolute -top-48 -right-48 w-96 h-96 bg-luxury-gold/10 rounded-full blur-[120px] pointer-events-none"></div>
            <div className="absolute -bottom-48 -left-48 w-96 h-96 bg-white/5 rounded-full blur-[120px] pointer-events-none"></div>

            {/* Header */}
            <div className="relative p-10 border-b border-white/10 bg-white/[0.02] z-10">
              <button 
                onClick={onClose} 
                className="absolute top-8 right-8 text-white/20 hover:text-white transition-colors p-2 hover:bg-white/5 rounded-full z-20"
              >
                <X className="w-6 h-6" />
              </button>

              <div className="flex flex-col md:flex-row items-center gap-8">
                <motion.div 
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 }}
                  className="relative"
                >
                  <div className="absolute inset-0 bg-luxury-gold/20 rounded-full blur-2xl animate-pulse"></div>
                  <img 
                    src={authorPhotoUrl || `https://ui-avatars.com/api/?name=${authorName}&background=random&color=fff`} 
                    alt={authorName}
                    className="w-32 h-32 rounded-full border-2 border-luxury-gold/30 p-1 relative z-10 object-cover shadow-2xl"
                    referrerPolicy="no-referrer"
                  />
                </motion.div>
                <div className="text-center md:text-left">
                  <motion.h2 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="text-5xl font-serif text-white mb-2 tracking-tight"
                  >
                    {authorName}
                  </motion.h2>
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="flex items-center justify-center md:justify-start gap-4"
                  >
                    <span className="text-[10px] uppercase tracking-[0.3em] text-luxury-gold font-semibold">Contributor</span>
                    <div className="w-1 h-1 bg-white/20 rounded-full"></div>
                    <span className="text-[10px] uppercase tracking-[0.3em] text-white/40">{materials.length} Manuscripts Shared</span>
                  </motion.div>
                </div>
              </div>
            </div>

            {/* Materials List */}
            <div className="flex-grow overflow-y-auto p-10 custom-scrollbar bg-luxury-black/20">
              <motion.h3 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="text-[10px] uppercase tracking-[0.3em] text-white/20 mb-8 font-bold"
              >
                Academic Portfolio
              </motion.h3>
              
              {materials.length === 0 ? (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.6 }}
                  className="text-center py-20 border border-white/5 rounded-3xl"
                >
                  <p className="text-white/40 font-light italic">No public records found for this author.</p>
                </motion.div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {materials.map((material, index) => (
                    <motion.div 
                      key={material.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.6 + index * 0.05 }}
                      whileHover={{ y: -5, scale: 1.02 }}
                      className="glass-panel p-6 rounded-2xl hover:bg-white/5 transition-all group border-white/5 relative overflow-hidden"
                    >
                      <div className="absolute inset-0 bg-gradient-to-br from-luxury-gold/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                      
                      <div className="flex items-start justify-between mb-4 relative z-10">
                        <div className="w-10 h-10 border border-white/5 rounded-xl flex items-center justify-center bg-white/5 group-hover:border-luxury-gold/30 transition-colors">
                          {getIcon(material.type)}
                        </div>
                        <a 
                          href={material.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          download={material.type !== 'link' && material.type !== 'canva' ? `${material.title}.${material.type === 'pdf' ? 'pdf' : material.type === 'word' ? 'docx' : 'file'}` : undefined}
                          onClick={() => handleDownload(material)}
                          className="text-white/20 hover:text-luxury-gold transition-colors p-2 hover:bg-white/5 rounded-lg"
                        >
                          {material.type === 'link' || material.type === 'canva' ? <ExternalLink className="w-4 h-4" /> : <Download className="w-4 h-4" />}
                        </a>
                      </div>
                      <h4 className="text-lg font-serif text-white mb-2 line-clamp-1 group-hover:text-luxury-gold transition-colors relative z-10">
                        {material.title}
                      </h4>
                      <div className="flex items-center justify-between mt-4 relative z-10">
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] uppercase tracking-widest text-white/20">
                            {formatDistanceToNow(material.createdAt, { addSuffix: true })}
                          </span>
                          {material.type !== 'link' && material.type !== 'canva' && (
                            <>
                              <span className="text-white/10 text-[9px]">•</span>
                              <span className="text-[9px] uppercase tracking-widest text-white/40 flex items-center gap-1">
                                <Download className="w-2.5 h-2.5" />
                                {material.downloadCount || 0}
                              </span>
                            </>
                          )}
                        </div>
                        <div className="flex gap-1">
                          {material.tags?.slice(0, 2).map((tag, i) => (
                            <span key={i} className="text-[7px] uppercase tracking-tighter px-1.5 py-0.5 bg-white/5 text-white/30 rounded-md border border-white/5">
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
