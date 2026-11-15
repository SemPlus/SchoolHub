import React, { useState, useEffect } from 'react';
import { Sparkles, Check } from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { cn } from '../lib/utils';
import type { Badge } from '../lib/badges';
import { firebaseErrorMessage } from '../lib/engagement';

import { t } from '../lib/i18n';
interface ProfileCustomizationProps {
  currentUserId: string;
  customColor?: string;
  customBadge?: string;
  /** Badges this user has earned. Only these can be shown as a title. */
  earnedBadges: Badge[];
}

const PRESET_COLORS = [
  { name: 'Gold', value: '#D4AF37' },
  { name: 'Crimson', value: '#DC2626' },
  { name: 'Emerald', value: '#059669' },
  { name: 'Sapphire', value: '#2563EB' },
  { name: 'Amethyst', value: '#9333EA' },
  { name: 'Rose', value: '#E11D48' },
];

export default function ProfileCustomization({ currentUserId, customColor, customBadge, earnedBadges }: ProfileCustomizationProps) {
  const [selectedColor, setSelectedColor] = useState(customColor || '#D4AF37');
  const [title, setTitle] = useState(customBadge || '');
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // The profile may load after this panel mounts. Keep the form in sync with
  // the stored values so saving never overwrites them with the defaults.
  useEffect(() => {
    setSelectedColor(customColor || '#D4AF37');
  }, [customColor]);

  useEffect(() => {
    setTitle(customBadge || '');
  }, [customBadge]);

  const handleSave = async () => {
    if (!auth.currentUser || auth.currentUser.uid !== currentUserId) return;
    // Titles come from earned badges only, so nobody can display a rank or
    // badge they do not have.
    const validTitle = earnedBadges.some(b => b.name === title) ? title : '';
    setIsSaving(true);
    setMessage(null);
    try {
      await updateDoc(doc(db, 'users', currentUserId), {
        customColor: selectedColor,
        customBadge: validTitle,
      });
      setMessage(t("Saved."));
    } catch (error) {
      setMessage(firebaseErrorMessage(error, t("Could not save.")));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 p-6 bg-white/[0.02] border border-white/5 rounded-3xl">
      <div className="flex items-center gap-3">
        <Sparkles className="w-5 h-5 text-luxury-gold" />
        <h4 className="text-xl font-serif text-white">{t("Customize your profile")}</h4>
      </div>

      <div className="space-y-3">
        <p className="text-[10px] uppercase tracking-[0.2em] text-white/40 font-medium">{t("Avatar colour")}</p>
        <div className="flex flex-wrap gap-3">
          {PRESET_COLORS.map((color) => (
            <button
              key={color.value}
              onClick={() => setSelectedColor(color.value)}
              className={cn(
                "w-8 h-8 rounded-full border-2 transition-all relative",
                selectedColor === color.value ? "border-white scale-110 shadow-[0_0_15px_rgba(255,255,255,0.3)]" : "border-transparent hover:scale-105"
              )}
              style={{ backgroundColor: color.value }}
              title={color.name}
            >
              {selectedColor === color.value && <Check className="w-4 h-4 text-white absolute inset-0 m-auto" />}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-[10px] uppercase tracking-[0.2em] text-white/40 font-medium">{t("Title shown next to your name")}</p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setTitle('')}
            className={cn(
              "px-3 py-1.5 rounded-full text-[9px] uppercase tracking-widest font-bold transition-all border",
              title === '' ? "bg-luxury-gold/20 border-luxury-gold text-luxury-gold" : "bg-white/5 border-white/10 text-white/40 hover:text-white"
            )}
          >
            {t("Your rank")}</button>
          {earnedBadges.map((badge) => (
            <button
              key={badge.id}
              onClick={() => setTitle(badge.name)}
              className={cn(
                "px-3 py-1.5 rounded-full text-[9px] uppercase tracking-widest font-bold transition-all border flex items-center gap-2",
                title === badge.name ? "bg-luxury-gold/20 border-luxury-gold text-luxury-gold" : "bg-white/5 border-white/10 text-white/40 hover:text-white"
              )}
            >
              <badge.icon className="w-3 h-3" />
              {t(badge.name)}
            </button>
          ))}
        </div>
        {earnedBadges.length === 0 && (
          <p className="text-[10px] text-white/30">{t("Earn badges to unlock more titles.")}</p>
        )}
      </div>

      <button
        onClick={handleSave}
        disabled={isSaving}
        className="w-full py-3 bg-white text-luxury-black rounded-full text-xs uppercase tracking-widest font-bold hover:bg-luxury-gold transition-all disabled:opacity-20"
      >
        {isSaving ? t("Saving…") : t("Save")}
      </button>
      {message && <p className="text-xs text-white/50 text-center">{message}</p>}
    </div>
  );
}
