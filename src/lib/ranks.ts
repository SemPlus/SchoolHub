// Ranks follow the archive theme and are earned through impact (see
// lib/stats.ts), not through the number of uploads.

export interface RankInfo {
  /** Roman numeral shown on the avatar. */
  grade: string;
  label: string;
  color: string;
  minImpact: number;
  level: number;
  auraClass?: string;
  borderClass?: string;
  canCustomize?: boolean;
}

export const RANKS: RankInfo[] = [
  {
    grade: 'VII',
    label: 'Keeper of the Archive',
    color: 'text-luxury-gold',
    minImpact: 600,
    level: 6,
    auraClass: 'shadow-[0_0_25px_rgba(212,175,55,0.6)]',
    borderClass: 'border-luxury-gold shadow-[inset_0_0_10px_rgba(212,175,55,0.4)]',
    canCustomize: true
  },
  {
    grade: 'VI',
    label: 'Master Archivist',
    color: 'text-orange-400',
    minImpact: 300,
    level: 5,
    auraClass: 'shadow-[0_0_20px_rgba(251,146,60,0.5)]',
    borderClass: 'border-orange-400/50',
    canCustomize: true
  },
  {
    grade: 'V',
    label: 'Archivist',
    color: 'text-purple-400',
    minImpact: 150,
    level: 4,
    auraClass: 'shadow-[0_0_15px_rgba(192,132,252,0.4)]',
    borderClass: 'border-purple-400/50',
    canCustomize: true
  },
  {
    grade: 'IV',
    label: 'Curator',
    color: 'text-blue-400',
    minImpact: 75,
    level: 3,
    auraClass: 'shadow-[0_0_10px_rgba(96,165,250,0.3)]',
    borderClass: 'border-blue-400/50',
    canCustomize: true
  },
  {
    grade: 'III',
    label: 'Scholar',
    color: 'text-emerald-400',
    minImpact: 30,
    level: 2,
    borderClass: 'border-emerald-400/30'
  },
  {
    grade: 'II',
    label: 'Contributor',
    color: 'text-gray-300',
    minImpact: 10,
    level: 1,
    borderClass: 'border-white/20'
  },
  {
    grade: 'I',
    label: 'Reader',
    color: 'text-white/40',
    minImpact: 0,
    level: 0,
    borderClass: 'border-white/10'
  },
];

export function getRank(impact: number): RankInfo {
  return RANKS.find(r => impact >= r.minImpact) || RANKS[RANKS.length - 1];
}

/** The next rank up and how much impact is still needed, or null at the top. */
export function getNextRank(impact: number): { rank: RankInfo; missing: number } | null {
  const higher = [...RANKS].reverse().find(r => r.minImpact > impact);
  return higher ? { rank: higher, missing: higher.minImpact - impact } : null;
}
