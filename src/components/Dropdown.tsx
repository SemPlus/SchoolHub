import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

export interface DropdownOption {
  value: string;
  label: string;
  /** Optional colour dot, e.g. a subject colour. */
  color?: string;
}

interface DropdownProps {
  options: DropdownOption[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
  icon?: React.ReactNode;
  /** Accessible name for the button. */
  label?: string;
}

const MENU_WIDTH = 220;

export default function Dropdown({ options, value, onChange, className = '', icon, label }: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [alignRight, setAlignRight] = useState(false);
  const [openUp, setOpenUp] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find(opt => opt.value === value) || options[0];

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) setIsOpen(false);
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleKey);
    };
  }, [isOpen]);

  // Open toward the side with room, so the menu never runs off the screen.
  useLayoutEffect(() => {
    if (!isOpen || !dropdownRef.current) return;
    const rect = dropdownRef.current.getBoundingClientRect();
    const width = Math.max(rect.width, MENU_WIDTH);
    setAlignRight(rect.left + width > window.innerWidth - 8);
    setOpenUp(rect.bottom + 300 > window.innerHeight && rect.top > 320);
  }, [isOpen]);

  return (
    <div className={cn('relative', className)} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={label}
        className="w-full flex items-center justify-between gap-3 py-2 px-2 text-sm font-light tracking-wide cursor-pointer border-b border-white/10 hover:border-luxury-gold transition-all min-w-0 text-left"
      >
        <span className="flex items-center gap-2 min-w-0">
          {icon}
          {selectedOption?.color && <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: selectedOption.color }} />}
          <span className="truncate">{selectedOption?.label}</span>
        </span>
        <ChevronDown className={cn('w-4 h-4 text-white/30 shrink-0 transition-transform duration-300', isOpen && 'rotate-180')} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: openUp ? -6 : 6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: openUp ? -6 : 6, scale: 0.97 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            role="listbox"
            className={cn(
              'absolute z-[150] min-w-full w-max max-w-[min(18rem,calc(100vw-1.5rem))] max-h-72 overflow-y-auto custom-scrollbar',
              'bg-[#101010] border border-white/10 rounded-2xl shadow-2xl py-2',
              alignRight ? 'right-0' : 'left-0',
              openUp ? 'bottom-full mb-2' : 'top-full mt-2'
            )}
          >
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={value === option.value}
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className={cn(
                  'w-full flex items-center gap-2.5 text-left px-4 py-3 text-xs uppercase tracking-widest transition-colors hover:bg-white/5',
                  value === option.value ? 'text-luxury-gold bg-white/5' : 'text-white/60'
                )}
              >
                {option.color && <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: option.color }} />}
                <span className="flex-1 truncate">{option.label}</span>
                {value === option.value && <Check className="w-3.5 h-3.5 shrink-0" />}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
