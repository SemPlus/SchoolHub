import React from 'react';
import { getRank } from '../lib/ranks';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';

interface UserAvatarProps {
  photoUrl?: string;
  name: string;
  contributionCount: number;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  isClickable?: boolean;
  onClick?: (e: React.MouseEvent) => void;
  customColor?: string;
}

export default function UserAvatar({ 
  photoUrl, 
  name, 
  contributionCount, 
  size = 'md', 
  className,
  isClickable,
  onClick,
  customColor
}: UserAvatarProps) {
  const rank = getRank(contributionCount);
  
  const sizeClasses = {
    sm: 'w-6 h-6',
    md: 'w-10 h-10',
    lg: 'w-16 h-16',
    xl: 'w-24 h-24'
  };

  const fallbackUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random&color=fff`;

  const auraStyle = customColor ? {
    boxShadow: `0 0 25px ${customColor}80`, // 80 is roughly 50% opacity in hex
    backgroundColor: `${customColor}20` // 20 is low opacity for the background
  } : undefined;

  const borderStyle = customColor ? {
    borderColor: customColor,
    boxShadow: `inset 0 0 10px ${customColor}40`
  } : undefined;

  const ringStyle = customColor ? { color: customColor } : undefined;

  return (
    <motion.div 
      whileHover={isClickable ? { scale: 1.05 } : {}}
      whileTap={isClickable ? { scale: 0.95 } : {}}
      onClick={onClick}
      className={cn(
        "relative rounded-full flex items-center justify-center overflow-visible",
        isClickable && "cursor-pointer",
        className
      )}
    >
      {/* Visual Aura/Glow */}
      {(rank.auraClass || customColor) && (
        <div 
          className={cn(
            "absolute inset-0 rounded-full animate-pulse blur-md opacity-60",
            !customColor && rank.auraClass
          )}
          style={auraStyle}
        />
      )}
      
      {/* Decorative Outer Ring for high levels or Customized */}
      {(rank.level >= 4 || customColor) && (
        <svg className="absolute -inset-2 w-[calc(100%+16px)] h-[calc(100%+16px)] animate-spin-slow opacity-30">
          <circle
            cx="50%"
            cy="50%"
            r="45%"
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
            strokeDasharray="4 8"
            className={!customColor ? rank.color : undefined}
            style={ringStyle}
          />
        </svg>
      )}

      {/* Main Avatar Image */}
      <div 
        className={cn(
          "relative rounded-full overflow-hidden border p-0.5 bg-luxury-black transition-all duration-500",
          sizeClasses[size],
          !customColor && rank.borderClass
        )}
        style={borderStyle}
      >
        <img
          src={photoUrl || fallbackUrl}
          alt={name}
          className="w-full h-full rounded-full object-cover"
          onError={(e) => {
            (e.target as HTMLImageElement).src = fallbackUrl;
          }}
        />
      </div>

      {/* Level Indicator Badge */}
      <div className={cn(
        "absolute -bottom-1 -right-1 flex items-center justify-center rounded-full border border-white/10 bg-luxury-black/90 px-1 py-0.5",
        rank.color
      )}>
        <span className="text-[6px] font-black tracking-tighter uppercase whitespace-nowrap">
          {rank.grade}
        </span>
      </div>
    </motion.div>
  );
}
