import React from 'react';
import { BADGES, Badge } from '../lib/badges';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';
import { HelpCircle, Lock } from 'lucide-react';

interface AchievementBadgesProps {
  unlockedBadgeIds: string[];
  contributionCount: number;
  compact?: boolean;
}

export default function AchievementBadges({ unlockedBadgeIds, contributionCount, compact = false }: AchievementBadgesProps) {
  return (
    <div className={cn("grid gap-4", compact ? "grid-cols-3 sm:grid-cols-6" : "grid-cols-2 sm:grid-cols-3")}>
      {BADGES.map((badge) => {
        const isUnlocked = unlockedBadgeIds.includes(badge.id);
        const Icon = badge.icon;
        
        return (
          <motion.div
            key={badge.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              "group relative flex flex-col items-center justify-center p-4 rounded-2xl border transition-all duration-500",
              isUnlocked 
                ? cn(badge.bgClass, badge.borderClass, badge.glowClass, "opacity-100 scale-100") 
                : "bg-white/2 border-white/5 opacity-40 grayscale blur-[0.5px] scale-95"
            )}
          >
            {/* Tooltip / Description for non-compact view */}
            {!compact && isUnlocked && (
              <div className="absolute inset-0 z-10 opacit-0 hover:opacity-100 bg-luxury-black/90 p-4 rounded-2xl flex flex-col items-center justify-center text-center transition-opacity">
                <p className="text-[10px] font-bold text-luxury-gold uppercase tracking-widest mb-1">{badge.name}</p>
                <p className="text-[9px] text-white/60 leading-tight">{badge.description}</p>
              </div>
            )}

            <div className={cn(
              "w-10 h-10 rounded-full flex items-center justify-center mb-2",
              isUnlocked ? "bg-white/10" : "bg-white/5"
            )}>
              <Icon className={cn("w-5 h-5", isUnlocked ? badge.color : "text-white/20")} />
            </div>

            {!compact && (
              <div className="text-center">
                <p className={cn(
                  "text-[10px] font-bold uppercase tracking-widest",
                  isUnlocked ? "text-white" : "text-white/20"
                )}>
                  {badge.name}
                </p>
                <p className="text-[8px] text-white/30 uppercase tracking-[0.2em] mt-1">
                  {isUnlocked ? "Unlocked" : `${badge.count} Contributions`}
                </p>
              </div>
            )}
            
            {/* Lock indicator */}
            {!isUnlocked && (
              <div className="absolute top-2 right-2">
                <Lock className="w-2 h-2 text-white/20" />
              </div>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}
