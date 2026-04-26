import { 
  Sparkles, 
  BookOpen, 
  Award, 
  Crown, 
  ShieldCheck, 
  Star, 
  Zap,
  Flame,
  Globe,
  Feather
} from 'lucide-react';
import { ReactNode } from 'react';

export interface Badge {
  id: string;
  name: string;
  description: string;
  count: number;
  icon: any;
  color: string;
  bgClass: string;
  borderClass: string;
  glowClass: string;
}

export const BADGES: Badge[] = [
  {
    id: 'first_manuscript',
    name: 'Initiate Scholar',
    description: 'Shared your first manuscript with the Archive.',
    count: 1,
    icon: Feather,
    color: 'text-gray-300',
    bgClass: 'bg-white/5',
    borderClass: 'border-white/10',
    glowClass: 'group-hover:shadow-[0_0_15px_rgba(255,255,255,0.1)]'
  },
  {
    id: 'contributor_5',
    name: 'Adept Researcher',
    description: 'Contributed 5 valuable assets to the collection.',
    count: 5,
    icon: BookOpen,
    color: 'text-emerald-400',
    bgClass: 'bg-emerald-400/5',
    borderClass: 'border-emerald-400/20',
    glowClass: 'group-hover:shadow-[0_0_15px_rgba(52,211,153,0.2)]'
  },
  {
    id: 'contributor_10',
    name: 'Archive Sentinel',
    description: 'Shared 10 manuscripts, securing the history of the fleet.',
    count: 10,
    icon: ShieldCheck,
    color: 'text-blue-400',
    bgClass: 'bg-blue-400/5',
    borderClass: 'border-blue-400/20',
    glowClass: 'group-hover:shadow-[0_0_15px_rgba(96,165,250,0.2)]'
  },
  {
    id: 'contributor_25',
    name: 'Master Scribe',
    description: 'Recognized for 25 high-quality contributions.',
    count: 25,
    icon: Award,
    color: 'text-purple-400',
    bgClass: 'bg-purple-400/5',
    borderClass: 'border-purple-400/20',
    glowClass: 'group-hover:shadow-[0_0_15px_rgba(192,132,252,0.2)]'
  },
  {
    id: 'contributor_50',
    name: 'Celestial Curator',
    description: '50 manuscripts archived. Your name is etched in light.',
    count: 50,
    icon: Crown,
    color: 'text-orange-400',
    bgClass: 'bg-orange-400/5',
    borderClass: 'border-orange-400/20',
    glowClass: 'group-hover:shadow-[0_0_15px_rgba(251,146,60,0.2)]'
  },
  {
    id: 'contributor_100',
    name: 'The Chronos Guardian',
    description: '100+ contributions. You are the architect of time itself.',
    count: 100,
    icon: Sparkles,
    color: 'text-luxury-gold',
    bgClass: 'bg-luxury-gold/5',
    borderClass: 'border-luxury-gold/20',
    glowClass: 'group-hover:shadow-[0_0_30px_rgba(212,175,55,0.4)]'
  }
];

export function getUnlockedBadges(contributionCount: number): string[] {
  return BADGES.filter(badge => contributionCount >= badge.count).map(badge => badge.id);
}
