import React, { useState } from 'react';
import { Palette, Shield, Sparkles, Check, Crown } from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';
import { BADGES } from '../lib/badges';

interface ProfileCustomizationProps {
  currentUserId: string;
  customColor?: string;
  customBadge?: string;
  unlockedBadges?: string[];
  onUpdate: () => void;
}

const PRESET_COLORS = [
  { name: 'Gold', value: '#D4AF37' },
  { name: 'Crimson', value: '#DC2626' },
  { name: 'Emerald', value: '#059669' },
  { name: 'Sapphire', value: '#2563EB' },
  { name: 'Amethyst', value: '#9333EA' },
  { name: 'RoseGold', value: '#E11D48' },
];

export default function ProfileCustomization({ currentUserId, customColor, customBadge, unlockedBadges = [], onUpdate }: ProfileCustomizationProps) {
  const [selectedColor, setSelectedColor] = useState(customColor || '#D4AF37');
  const [badgeText, setBadgeText] = useState(customBadge || '');
  const [isSaving, setIsSaving] = useState(false);

  const earnedBadges = BADGES.filter(b => unlockedBadges.includes(b.id));

  const handleSave = async () => {
    if (!auth.currentUser || auth.currentUser.uid !== currentUserId) return;
    
    setIsSaving(true);
    try {
      const userRef = doc(db, 'users', currentUserId);
      await updateDoc(userRef, {
        customColor: selectedColor,
        customBadge: badgeText.trim(),
      });
      onUpdate();
    } catch (error) {
      console.error('Failed to update customization:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleBadgeSelect = (name: string) => {
    setBadgeText(name);
  };

  return (
    <div className="space-y-8 p-6 bg-white/[0.02] border border-white/5 rounded-3xl">
      <div className="flex items-center gap-3 mb-2">
        <Sparkles className="w-5 h-5 text-luxury-gold" />
        <h4 className="text-xl font-serif text-white">Honorary Customization</h4>
      </div>

      <div className="space-y-4">
        <label className="block text-[10px] uppercase tracking-[0.2em] text-white/40 font-medium">Aura Signature (Color)</label>
        <div className="flex flex-wrap gap-3">
          {PRESET_COLORS.map((color) => (
            <button
              key={color.value}
              onClick={() => setSelectedColor(color.value)}
              className={cn(
                "w-8 h-8 rounded-full border-2 transition-all relative group",
                selectedColor === color.value ? "border-white scale-110 shadow-[0_0_15px_rgba(255,255,255,0.3)]" : "border-transparent hover:scale-105"
              )}
              style={{ backgroundColor: color.value }}
            >
              {selectedColor === color.value && <Check className="w-4 h-4 text-white absolute inset-0 m-auto" />}
              <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-luxury-black/90 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-20">
                {color.name}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <label className="block text-[10px] uppercase tracking-[0.2em] text-white/40 font-medium">Honorary Designation (Badge)</label>
        
        {earnedBadges.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {earnedBadges.map((badge) => (
              <button
                key={badge.id}
                onClick={() => handleBadgeSelect(badge.name)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-[8px] uppercase tracking-widest font-bold transition-all border flex items-center gap-2",
                  badgeText === badge.name 
                    ? "bg-luxury-gold/20 border-luxury-gold text-luxury-gold shadow-[0_0_10px_rgba(212,175,55,0.2)]" 
                    : "bg-white/5 border-white/10 text-white/40 hover:text-white"
                )}
              >
                <badge.icon className="w-3 h-3" />
                {badge.name}
              </button>
            ))}
          </div>
        )}

        <div className="relative">
          <Shield className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
          <input
            type="text"
            value={badgeText}
            onChange={(e) => setBadgeText(e.target.value.slice(0, 20))}
            placeholder="e.g. Master Scribe"
            className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-12 pr-4 text-sm text-white placeholder:text-white/10 outline-none focus:border-luxury-gold/50 transition-all font-light"
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[8px] text-white/20 tracking-tighter">
            {badgeText.length}/20
          </span>
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={isSaving}
        className="w-full py-3 bg-white text-luxury-black rounded-full text-xs uppercase tracking-widest font-bold hover:bg-luxury-gold transition-all disabled:opacity-20 active:scale-[0.98]"
      >
        {isSaving ? 'Sealing Signature...' : 'Apply Customization'}
      </button>
    </div>
  );
}
