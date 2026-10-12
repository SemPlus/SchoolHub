import React from 'react';
import { BADGES } from '../lib/badges';
import type { UserStats } from '../lib/stats';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';
import { Lock } from 'lucide-react';

interface AchievementBadgesProps {
  stats: UserStats;
  compact?: boolean;
}

export default function AchievementBadges({ stats, compact = false }: AchievementBadgesProps) {
  return (
    <div className={cn("grid gap-4", compact ? "grid-cols-3 sm:grid-cols-7" : "grid-cols-2 sm:grid-cols-4")}>
      {BADGES.map((badge) => {
        const progress = stats[badge.metric] || 0;
        const isUnlocked = progress >= badge.count;
        const Icon = badge.icon;

        return (
          <motion.div
            key={badge.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            title={badge.description}
            className={cn(
              "group relative flex flex-col items-center justify-center p-4 rounded-2xl border transition-all duration-500 text-center",
              isUnlocked
                ? cn(badge.bgClass, badge.borderClass, badge.glowClass)
                : "bg-white/[0.02] border-white/5 opacity-50 grayscale"
            )}
          >
            <div className={cn("w-10 h-10 rounded-full flex items-center justify-center mb-2", isUnlocked ? "bg-white/10" : "bg-white/5")}>
              <Icon className={cn("w-5 h-5", isUnlocked ? badge.color : "text-white/30")} />
            </div>

            {!compact && (
              <>
                <p className={cn("text-[10px] font-bold uppercase tracking-widest", isUnlocked ? "text-white" : "text-white/40")}>
                  {badge.name}
                </p>
                <p className="text-[9px] text-white/40 leading-tight mt-1">{badge.description}</p>
                {!isUnlocked && badge.count > 1 && (
                  <p className="text-[8px] text-white/30 uppercase tracking-[0.2em] mt-2">
                    {Math.min(progress, badge.count)} / {badge.count}
                  </p>
                )}
              </>
            )}

            {!isUnlocked && (
              <div className="absolute top-2 right-2">
                <Lock className="w-2.5 h-2.5 text-white/30" />
              </div>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}
