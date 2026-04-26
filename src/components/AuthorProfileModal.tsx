import React from 'react';
import { X, BookOpen, ExternalLink, Download, FileText, File, Link as LinkIcon, Edit2, Folder as FolderIcon, ChevronLeft, Trash2 } from 'lucide-react';
import { Material, Folder } from '../types';
import { formatDistanceToNow } from 'date-fns';
import { doc, updateDoc, increment, getDoc, query, collection, where, orderBy, getDocs, deleteDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { motion, AnimatePresence } from 'motion/react';
import { OperationType, User } from '../types';
import { getRank } from '../lib/ranks';
import AchievementBadges from './AchievementBadges';
import ProfileCustomization from './ProfileCustomization';

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

interface AuthorProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  authorId: string;
  authorName: string;
  authorPhotoUrl?: string;
  onMaterialClick?: (material: Material) => void;
  onEditClick?: (material: Material) => void;
  userRole?: string | null;
}

export default function AuthorProfileModal({ isOpen, onClose, authorId, authorName, authorPhotoUrl, onMaterialClick, onEditClick, userRole }: AuthorProfileModalProps) {
  const [authorProfile, setAuthorProfile] = React.useState<User | null>(null);
  const [personalMaterials, setPersonalMaterials] = React.useState<Material[]>([]);
  const [totalManuscriptsCount, setTotalManuscriptsCount] = React.useState(0);
  const [publicFolders, setPublicFolders] = React.useState<Folder[]>([]);
  const [currentFolderId, setCurrentFolderId] = React.useState<string | null>(null);
  const [folderPath, setFolderPath] = React.useState<Folder[]>([]);
  const [isLoadingProfile, setIsLoadingProfile] = React.useState(true);
  const [isLoadingMaterials, setIsLoadingMaterials] = React.useState(true);
  const [isLoadingFolders, setIsLoadingFolders] = React.useState(true);
  
  const rank = getRank(totalManuscriptsCount);
  const isCurrentUser = auth.currentUser?.uid === authorId;
  const canCustomize = rank.canCustomize && isCurrentUser;

  const fetchProfile = async () => {
    if (!authorId) return;
    setIsLoadingProfile(true);
    try {
      const userDoc = await getDoc(doc(db, 'users', authorId));
      if (userDoc.exists()) {
        setAuthorProfile(userDoc.data() as User);
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
    } finally {
      setIsLoadingProfile(false);
    }
  };

  const fetchMaterials = async () => {
    if (!authorId) return;
    setIsLoadingMaterials(true);
    try {
      const q = query(
        collection(db, 'materials'),
        where('authorId', '==', authorId)
      );
      
      const snapshot = await getDocs(q);
      const allMaterialsList = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate() || new Date(),
        } as Material;
      });

      // Sort in memory
      allMaterialsList.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      setTotalManuscriptsCount(allMaterialsList.length);

      const filteredList = allMaterialsList.filter(material => {
        if (currentFolderId === null) {
          return !material.folderId;
        }
        return material.folderId === currentFolderId;
      });

      setPersonalMaterials(filteredList);
    } catch (error) {
      console.error('Error fetching author materials:', error);
    } finally {
      setIsLoadingMaterials(false);
    }
  };

  const fetchFolders = async () => {
    if (!authorId) return;
    setIsLoadingFolders(true);
    try {
      let q;
      if (userRole === 'admin') {
        q = query(
          collection(db, 'folders'),
          where('authorId', '==', authorId),
          where('parentId', '==', currentFolderId)
        );
      } else {
        q = query(
          collection(db, 'folders'),
          where('authorId', '==', authorId),
          where('parentId', '==', currentFolderId),
          where('isPublic', '==', true)
        );
      }
      
      const snapshot = await getDocs(q);
      const foldersList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...(doc.data() as any)
      })) as Folder[];
      // Sort in memory
      foldersList.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setPublicFolders(foldersList);
    } catch (error) {
      console.error('Error fetching author folders:', error);
    } finally {
      setIsLoadingFolders(false);
    }
  };

  React.useEffect(() => {
    if (isOpen && authorId) {
      fetchProfile();
      fetchFolders();
      fetchMaterials();
    }
  }, [isOpen, authorId, currentFolderId]);

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

  const handleDelete = async (e: React.MouseEvent, material: Material) => {
    e.stopPropagation();
    if (confirm(`Are you sure you want to delete "${material.title}"?`)) {
      try {
        await deleteDoc(doc(db, 'materials', material.id));
        setPersonalMaterials(prev => prev.filter(m => m.id !== material.id));
        setTotalManuscriptsCount(prev => prev - 1);
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `materials/${material.id}`);
      }
    }
  };

  const handleFolderDelete = async (e: React.MouseEvent, folder: Folder) => {
    e.stopPropagation();
    if (confirm(`Are you sure you want to delete folder "${folder.name}"?`)) {
      try {
        await deleteDoc(doc(db, 'folders', folder.id));
        setPublicFolders(prev => prev.filter(f => f.id !== folder.id));
      } catch (error) {
        try {
          handleFirestoreError(error, OperationType.DELETE, `folders/${folder.id}`);
        } catch (e) {
          console.error('Failed to delete folder:', e);
          alert('Failed to delete folder. You may not have sufficient permissions.');
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
                >
                    <UserAvatar
                      name={authorName}
                      photoUrl={authorPhotoUrl}
                      contributionCount={totalManuscriptsCount}
                      size="xl"
                      className="mb-4 md:mb-0"
                      customColor={authorProfile?.customColor}
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
                      className="flex flex-wrap items-center justify-center md:justify-start gap-4"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] uppercase tracking-[0.3em] text-luxury-gold font-semibold">Contributor</span>
                        <span className={`text-[9px] px-2 py-0.5 rounded border border-white/10 bg-white/5 font-bold tracking-widest ${rank.color}`}>
                          {authorProfile?.customBadge || rank.label} ({rank.grade})
                        </span>
                      </div>
                      <div className="w-1 h-1 bg-white/20 rounded-full hidden md:block"></div>
                      <span className="text-[10px] uppercase tracking-[0.3em] text-white/40">{totalManuscriptsCount} Manuscripts Shared</span>
                    </motion.div>
                  </div>
                </div>

              {canCustomize && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  className="mt-8 max-w-md mx-auto md:mx-0"
                >
                  <ProfileCustomization 
                    currentUserId={authorId}
                    customColor={authorProfile?.customColor}
                    customBadge={authorProfile?.customBadge}
                    unlockedBadges={authorProfile?.unlockedBadges}
                    onUpdate={fetchProfile}
                  />
                </motion.div>
              )}
            </div>

            {/* Badges Section */}
            <div className="p-10 bg-white/[0.01] border-b border-white/5 relative z-10">
              <h3 className="text-[10px] uppercase tracking-[0.3em] text-white/20 font-bold mb-6">Hall of Achievements</h3>
              <AchievementBadges 
                unlockedBadgeIds={authorProfile?.unlockedBadges || []} 
                contributionCount={totalManuscriptsCount} 
              />
            </div>

            {/* Materials List */}
            <div className="flex-grow overflow-y-auto p-10 custom-scrollbar bg-luxury-black/20">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                  {currentFolderId && (
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => {
                        const newPath = [...folderPath];
                        const lastFolder = newPath.pop();
                        setFolderPath(newPath);
                        setCurrentFolderId(newPath.length > 0 ? newPath[newPath.length - 1].id : null);
                      }}
                      className="p-2 bg-white/5 border border-white/10 rounded-full text-white/40 hover:text-white"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </motion.button>
                  )}
                  <motion.h3 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}
                    className="text-[10px] uppercase tracking-[0.3em] text-white/20 font-bold"
                  >
                    Archive {folderPath.length > 0 ? `> ${folderPath.map(f => f.name).join(' > ')}` : 'Portfolio'}
                  </motion.h3>
                </div>
              </div>
              
              {isLoadingMaterials || isLoadingFolders ? (
                <div className="flex justify-center py-20">
                  <div className="w-8 h-8 border-2 border-luxury-gold/30 border-t-luxury-gold rounded-full animate-spin"></div>
                </div>
              ) : (publicFolders.length === 0 && personalMaterials.length === 0) ? (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.6 }}
                  className="text-center py-20 border border-white/5 rounded-3xl"
                >
                  <p className="text-white/40 font-light italic">No public records found in this directory.</p>
                </motion.div>
              ) : (
                <div className="space-y-8">
                  {publicFolders.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                      {publicFolders.map((folder, index) => (
                        <motion.div
                          key={folder.id}
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: 0.6 + index * 0.05 }}
                          whileHover={{ scale: 1.02, y: -2 }}
                          onClick={() => {
                            setFolderPath([...folderPath, folder]);
                            setCurrentFolderId(folder.id);
                          }}
                          className="glass-panel p-4 rounded-xl hover:bg-white/5 border-white/5 flex items-center gap-4 cursor-pointer group"
                        >
                          <div className="flex items-center justify-between w-full">
                            <div className="flex items-center gap-4">
                              <div className="p-3 bg-luxury-gold/5 rounded-lg group-hover:bg-luxury-gold/20 transition-colors">
                                <FolderIcon className="w-5 h-5 text-luxury-gold" />
                              </div>
                              <div>
                                <p className="text-sm font-serif text-white group-hover:text-luxury-gold transition-colors">{folder.name}</p>
                                <p className="text-[8px] uppercase tracking-widest text-white/20">Public Directory</p>
                              </div>
                            </div>
                            {(auth.currentUser?.uid === folder.authorId || userRole === 'admin') && (
                              <button
                                onClick={(e) => handleFolderDelete(e, folder)}
                                className="opacity-0 group-hover:opacity-100 transition-opacity p-2 hover:bg-red-400/10 rounded-lg text-white/20 hover:text-red-400"
                                title="Delete Folder"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}

                  {personalMaterials.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {personalMaterials.map((material, index) => (
                        <motion.div 
                          key={material.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.7 + index * 0.05 }}
                          whileHover={{ y: -5, scale: 1.02 }}
                          onClick={() => onMaterialClick?.(material)}
                          className="glass-panel p-6 rounded-2xl hover:bg-white/5 transition-all group border-white/5 relative overflow-hidden cursor-pointer"
                        >
                          <div className="absolute inset-0 bg-gradient-to-br from-luxury-gold/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                          
                          <div className="flex items-start justify-between mb-4 relative z-10">
                            <div className="w-10 h-10 border border-white/5 rounded-xl flex items-center justify-center bg-white/5 group-hover:border-luxury-gold/30 transition-colors">
                              {getIcon(material.type)}
                            </div>
                            <div className="flex gap-2">
                              {(auth.currentUser?.uid === material.authorId || userRole === 'admin') && (
                              <>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onEditClick?.(material);
                                  }}
                                  className="text-white/20 hover:text-luxury-gold transition-colors p-2 hover:bg-white/5 rounded-lg"
                                  title="Edit"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={(e) => handleDelete(e, material)}
                                  className="text-white/20 hover:text-red-400 transition-colors p-2 hover:bg-red-400/10 rounded-lg"
                                  title="Delete"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </>
                            )}
                              <a 
                                href={material.url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                download={material.type !== 'link' && material.type !== 'canva' ? `${material.title}.${material.type === 'pdf' ? 'pdf' : material.type === 'word' ? 'docx' : 'file'}` : undefined}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDownload(material);
                                }}
                                className="text-white/20 hover:text-luxury-gold transition-colors p-2 hover:bg-white/5 rounded-lg"
                              >
                                {material.type === 'link' || material.type === 'canva' ? <ExternalLink className="w-4 h-4" /> : <Download className="w-4 h-4" />}
                              </a>
                            </div>
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
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
