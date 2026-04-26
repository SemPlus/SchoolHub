import React from 'react';
import { Folder as FolderIcon, MoreVertical, Trash2, Edit2, Move, ArrowLeft } from 'lucide-react';
import { Folder } from '../types';
import { motion } from 'motion/react';
import { auth } from '../firebase';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '../lib/utils';

interface FolderCardProps {
  folder: Folder;
  onClick: (folder: Folder) => void;
  onDeleteClick?: (folder: Folder) => void;
  onMoveClick?: (folder: Folder) => void;
  userRole?: string | null;
  isInTrash?: boolean;
  onRestore?: (folder: Folder) => void;
  isSelected?: boolean;
  onSelect?: (e: React.MouseEvent) => void;
  onDragStart?: () => void;
  onDrop?: () => void;
}

export default function FolderCard({ 
  folder, 
  onClick, 
  onDeleteClick, 
  onMoveClick, 
  userRole, 
  isInTrash = false, 
  onRestore,
  isSelected = false,
  onSelect,
  onDragStart,
  onDrop
}: FolderCardProps) {
  const isOwner = auth.currentUser?.uid === folder.authorId;
  const isAdmin = userRole === 'admin';
  const canModify = isOwner || isAdmin;

  const [isOver, setIsOver] = React.useState(false);

  const getDaysRemaining = () => {
    if (!folder.deletedAt) return 30;
    const deletedTime = folder.deletedAt.getTime();
    const expiryTime = deletedTime + (30 * 24 * 60 * 60 * 1000);
    const remaining = Math.ceil((expiryTime - Date.now()) / (24 * 60 * 60 * 1000));
    return Math.max(0, remaining);
  };

  const handleContainerClick = (e: React.MouseEvent) => {
    if (onSelect && (e.ctrlKey || e.metaKey || e.shiftKey)) {
      e.stopPropagation();
      onSelect(e);
      return;
    }
    onClick(folder);
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (isInTrash) return;
    e.preventDefault();
    setIsOver(true);
  };

  const handleDragLeave = () => {
    setIsOver(false);
  };

  const handleLocalDrop = (e: React.DragEvent) => {
    if (isInTrash) return;
    e.preventDefault();
    setIsOver(false);
    onDrop?.();
  };

  return (
    <motion.div
      whileHover={{ y: -5, scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={handleContainerClick}
      draggable={canModify && !isInTrash}
      onDragStart={onDragStart}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleLocalDrop}
      className={cn(
        "glass-panel p-6 rounded-3xl hover:bg-white/5 transition-all group border-white/5 relative overflow-hidden cursor-pointer h-full flex flex-col justify-between select-none",
        isSelected && "ring-2 ring-luxury-gold bg-luxury-gold/5 border-luxury-gold/20",
        isOver && "ring-2 ring-luxury-gold bg-luxury-gold/20 scale-[1.05]"
      )}
    >
      <div className="absolute inset-x-0 top-0 h-1 bg-luxury-gold opacity-0 transition-opacity" style={{ opacity: isSelected ? 1 : 0 }} />
      
      <div className="absolute inset-0 bg-gradient-to-br from-luxury-gold/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-4">
          <div className="w-12 h-12 border border-white/5 rounded-2xl flex items-center justify-center bg-white/5 group-hover:border-luxury-gold/30 transition-colors">
            <FolderIcon className="w-6 h-6 text-luxury-gold" />
          </div>
          
          {canModify && (
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              {isInTrash ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRestore?.(folder);
                  }}
                  className="p-2 hover:bg-white/10 rounded-lg text-luxury-gold opacity-100"
                  title="Restore Folder"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
              ) : (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onMoveClick?.(folder);
                  }}
                  className="p-2 hover:bg-white/10 rounded-lg text-white/40 hover:text-luxury-gold"
                  title="Move Folder"
                >
                  <Move className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteClick?.(folder);
                }}
                className={cn(
                  "p-2 hover:bg-white/10 rounded-lg opacity-100",
                  isInTrash ? "text-red-500 hover:text-red-400" : "text-white/40 hover:text-red-400"
                )}
                title={isInTrash ? "Delete Permanently" : "Delete Folder"}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
        
        <h3 className="text-xl font-serif text-white mb-1 line-clamp-1 group-hover:text-luxury-gold transition-colors">
          {folder.name}
        </h3>
        {isInTrash && (
          <p className="text-[10px] font-bold text-red-400/80 mb-2">
            Expires in {getDaysRemaining()} days
          </p>
        )}
        <p className="text-[10px] uppercase tracking-widest text-white/40 font-medium">
          Directory
        </p>
      </div>

      <div className="mt-6 pt-4 border-t border-white/5 relative z-10 flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-widest text-white/20">
          Created {folder.createdAt ? formatDistanceToNow(folder.createdAt, { addSuffix: true }) : 'Recently'}
        </span>
        <span className="text-[10px] uppercase tracking-widest text-luxury-gold/40">
          {folder.authorName}
        </span>
      </div>
    </motion.div>
  );
}
