
export interface RankInfo {
  grade: string;
  label: string;
  color: string;
  minContributions: number;
  level: number;
  auraClass?: string;
  borderClass?: string;
  canCustomize?: boolean;
}

export const RANKS: RankInfo[] = [
  { 
    grade: 'O-10', 
    label: 'General', 
    color: 'text-luxury-gold', 
    minContributions: 100, 
    level: 6,
    auraClass: 'shadow-[0_0_25px_rgba(212,175,55,0.6)]',
    borderClass: 'border-luxury-gold shadow-[inset_0_0_10px_rgba(212,175,55,0.4)]',
    canCustomize: true
  },
  { 
    grade: 'O-6', 
    label: 'Colonel', 
    color: 'text-orange-400', 
    minContributions: 50, 
    level: 5,
    auraClass: 'shadow-[0_0_20px_rgba(251,146,60,0.5)]',
    borderClass: 'border-orange-400/50',
    canCustomize: true
  },
  { 
    grade: 'O-4', 
    label: 'Major', 
    color: 'text-purple-400', 
    minContributions: 25, 
    level: 4,
    auraClass: 'shadow-[0_0_15px_rgba(192,132,252,0.4)]',
    borderClass: 'border-purple-400/50',
    canCustomize: true
  },
  { 
    grade: 'O-3', 
    label: 'Captain', 
    color: 'text-blue-400', 
    minContributions: 10, 
    level: 3,
    auraClass: 'shadow-[0_0_10px_rgba(96,165,250,0.3)]',
    borderClass: 'border-blue-400/50',
    canCustomize: true
  },
  { 
    grade: 'O-2', 
    label: 'Lieutenant', 
    color: 'text-emerald-400', 
    minContributions: 5, 
    level: 2,
    borderClass: 'border-emerald-400/30'
  },
  { 
    grade: 'E-5', 
    label: 'Sergeant', 
    color: 'text-gray-300', 
    minContributions: 2, 
    level: 1,
    borderClass: 'border-white/20'
  },
  { 
    grade: 'E-1', 
    label: 'Private', 
    color: 'text-white/40', 
    minContributions: 0, 
    level: 0,
    borderClass: 'border-white/10'
  },
];

export function getRank(contributionCount: number): RankInfo {
  return RANKS.find(r => contributionCount >= r.minContributions) || RANKS[RANKS.length - 1];
}
