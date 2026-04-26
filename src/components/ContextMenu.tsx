import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trash2, Move, Edit, Share2, Info, CheckCircle, RotateCcw } from 'lucide-react';

interface ContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  items: {
    label: string;
    icon: React.ReactNode;
    onClick: () => void;
    variant?: 'danger' | 'default';
  }[];
}

export default function ContextMenu({ x, y, onClose, items }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  // Adjust position if menu goes off screen
  const [adjustedPos, setAdjustedPos] = useState({ x, y });

  useEffect(() => {
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      let nextX = x;
      let nextY = y;

      if (x + rect.width > window.innerWidth) nextX = x - rect.width;
      if (y + rect.height > window.innerHeight) nextY = y - rect.height;

      setAdjustedPos({ x: nextX, y: nextY });
    }
  }, [x, y]);

  return (
    <motion.div
      ref={menuRef}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      style={{ left: adjustedPos.x, top: adjustedPos.y }}
      className="fixed z-[200] min-w-[200px] bg-luxury-black/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl p-2"
    >
      {items.map((item, index) => (
        <button
          key={index}
          onClick={(e) => {
            e.stopPropagation();
            item.onClick();
            onClose();
          }}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs uppercase tracking-widest transition-all ${
            item.variant === 'danger' 
              ? 'text-red-400 hover:bg-red-400/10' 
              : 'text-white/60 hover:text-white hover:bg-white/5'
          }`}
        >
          {item.icon}
          <span className="font-bold">{item.label}</span>
        </button>
      ))}
    </motion.div>
  );
}
