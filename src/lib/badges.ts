import {
  Feather,
  Bookmark,
  HeartHandshake,
  BadgeCheck,
  Eye,
  Users,
  Landmark,
  Trophy,
} from 'lucide-react';
import type { UserStats } from './stats';

// Badges are computed from protected activity on every render instead of
// being stored on the user profile, where users could write them themselves.

export type BadgeMetric = keyof UserStats;

export interface Badge {
  id: string;
  name: string;
  description: string;
  metric: BadgeMetric;
  count: number;
  icon: any;
  color: string;
  bgClass: string;
  borderClass: string;
  glowClass: string;
}

export const BADGES: Badge[] = [
  {
    id: 'first_upload',
    name: 'First Contribution',
    description: 'Shared a first material with the archive.',
    metric: 'uploads',
    count: 1,
    icon: Feather,
    color: 'text-gray-300',
    bgClass: 'bg-white/5',
    borderClass: 'border-white/10',
    glowClass: 'group-hover:shadow-[0_0_15px_rgba(255,255,255,0.1)]'
  },
  {
    id: 'bookmarked',
    name: 'Bookmarked',
    description: 'Another student saved one of your materials.',
    metric: 'savesReceived',
    count: 1,
    icon: Bookmark,
    color: 'text-emerald-400',
    bgClass: 'bg-emerald-400/5',
    borderClass: 'border-emerald-400/20',
    glowClass: 'group-hover:shadow-[0_0_15px_rgba(52,211,153,0.2)]'
  },
  {
    id: 'helping_hand',
    name: 'Helping Hand',
    description: 'One of your materials fulfilled a request.',
    metric: 'answersAccepted',
    count: 1,
    icon: HeartHandshake,
    color: 'text-blue-400',
    bgClass: 'bg-blue-400/5',
    borderClass: 'border-blue-400/20',
    glowClass: 'group-hover:shadow-[0_0_15px_rgba(96,165,250,0.2)]'
  },
  {
    id: 'teacher_approved',
    name: 'Teacher Approved',
    description: 'A teacher verified one of your materials.',
    metric: 'verified',
    count: 1,
    icon: BadgeCheck,
    color: 'text-purple-400',
    bgClass: 'bg-purple-400/5',
    borderClass: 'border-purple-400/20',
    glowClass: 'group-hover:shadow-[0_0_15px_rgba(192,132,252,0.2)]'
  },
  {
    id: 'widely_read',
    name: 'Widely Read',
    description: 'Your materials were opened by 50 other students.',
    metric: 'opensReceived',
    count: 50,
    icon: Eye,
    color: 'text-orange-400',
    bgClass: 'bg-orange-400/5',
    borderClass: 'border-orange-400/20',
    glowClass: 'group-hover:shadow-[0_0_15px_rgba(251,146,60,0.2)]'
  },
  {
    id: 'go_to_helper',
    name: 'Go-To Helper',
    description: 'Fulfilled 10 requests from other students.',
    metric: 'answersAccepted',
    count: 10,
    icon: Users,
    color: 'text-sky-400',
    bgClass: 'bg-sky-400/5',
    borderClass: 'border-sky-400/20',
    glowClass: 'group-hover:shadow-[0_0_15px_rgba(56,189,248,0.2)]'
  },
  {
    id: 'best_work',
    name: 'Best of the Class',
    description: 'Your work was voted the best in a collection.',
    metric: 'bestWorks',
    count: 1,
    icon: Trophy,
    color: 'text-amber-300',
    bgClass: 'bg-amber-300/5',
    borderClass: 'border-amber-300/20',
    glowClass: 'group-hover:shadow-[0_0_15px_rgba(252,211,77,0.25)]'
  },
  {
    id: 'pillar',
    name: 'Pillar of the Archive',
    description: 'Reached 300 impact by helping other students.',
    metric: 'impact',
    count: 300,
    icon: Landmark,
    color: 'text-luxury-gold',
    bgClass: 'bg-luxury-gold/5',
    borderClass: 'border-luxury-gold/20',
    glowClass: 'group-hover:shadow-[0_0_30px_rgba(212,175,55,0.4)]'
  }
];

export function getEarnedBadges(stats: UserStats): Badge[] {
  return BADGES.filter(badge => (stats[badge.metric] || 0) >= badge.count);
}
