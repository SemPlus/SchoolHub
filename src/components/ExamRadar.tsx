import React, { useMemo, useState } from 'react';
import { CalendarClock, ChevronDown, Radar } from 'lucide-react';
import { differenceInCalendarDays, format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import type { Material, User } from '../types';
import { formatClassName } from '../lib/schoolYear';
import { cn } from '../lib/utils';

interface ExamRadarProps {
  materials: Material[];
  profile: User | null;
  onOpenMaterial: (material: Material) => void;
}

const WINDOW_DAYS = 14;

function relativeDay(date: Date): string {
  const days = differenceInCalendarDays(date, new Date());
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days < 7) return format(date, 'EEEE');
  return format(date, 'EEE d MMM');
}

/**
 * "Your History test is Thursday – here are 6 resources." Groups the class's
 * materials that carry an upcoming test date by day and subject.
 */
export default function ExamRadar({ materials, profile, onOpenMaterial }: ExamRadarProps) {
  const [expanded, setExpanded] = useState<string | null>(null);

  const groups = useMemo(() => {
    if (!profile?.schoolId || !profile.classYear || !profile.classSection) return [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const limit = today.getTime() + WINDOW_DAYS * 24 * 60 * 60 * 1000;

    const byKey = new Map<string, { key: string; date: Date; subject: string; items: Material[] }>();
    for (const m of materials) {
      if (m.isDeleted || !m.examDate) continue;
      if (m.schoolId !== profile.schoolId || m.classYear !== profile.classYear || m.classSection !== profile.classSection) continue;
      const time = m.examDate.getTime();
      if (time < today.getTime() || time > limit) continue;
      const subject = m.subject || 'Test';
      const key = `${format(m.examDate, 'yyyy-MM-dd')}|${subject}`;
      if (!byKey.has(key)) byKey.set(key, { key, date: m.examDate, subject, items: [] });
      byKey.get(key)!.items.push(m);
    }
    return [...byKey.values()].sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [materials, profile?.schoolId, profile?.classYear, profile?.classSection]);

  if (!profile?.classYear) return null;

  const className = formatClassName(profile.classYear, profile.classSection);

  return (
    <div className="glass-panel rounded-[1.5rem] sm:rounded-[2rem] p-4 sm:p-6 border-white/5">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-red-400/10 rounded-xl">
          <Radar className="w-4 h-4 text-red-300" />
        </div>
        <div>
          <h3 className="text-base font-serif text-white">Test radar · {className}</h3>
          <p className="text-[10px] uppercase tracking-widest text-white/30">Next {WINDOW_DAYS} days</p>
        </div>
      </div>

      {groups.length === 0 ? (
        <p className="text-xs text-white/40 leading-relaxed">
          No tests coming up for {className}. When you add a material, set its test date and it appears here for your whole class.
        </p>
      ) : (
        <div className="space-y-2">
          {groups.map(group => {
            const isOpen = expanded === group.key;
            const days = differenceInCalendarDays(group.date, new Date());
            return (
              <div key={group.key} className="rounded-2xl border border-white/5 bg-white/[0.02] overflow-hidden">
                <button
                  onClick={() => setExpanded(isOpen ? null : group.key)}
                  className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-white/5 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <CalendarClock className={cn('w-4 h-4 shrink-0', days <= 2 ? 'text-red-300' : 'text-luxury-gold')} />
                    <p className="text-sm text-white truncate">
                      <span className="font-medium">{group.subject}</span>
                      <span className="text-white/40"> · {relativeDay(group.date)}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] uppercase tracking-widest text-white/50">
                      {group.items.length} {group.items.length === 1 ? 'resource' : 'resources'}
                    </span>
                    <ChevronDown className={cn('w-4 h-4 text-white/30 transition-transform', isOpen && 'rotate-180')} />
                  </div>
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.ul
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden border-t border-white/5"
                    >
                      {group.items.map(item => (
                        <li key={item.id}>
                          <button
                            onClick={() => onOpenMaterial(item)}
                            className="w-full text-left px-4 py-2.5 text-sm text-white/70 hover:text-luxury-gold hover:bg-white/5 transition-colors truncate"
                          >
                            {item.title}
                            <span className="text-white/30 text-xs"> · {item.authorName}</span>
                          </button>
                        </li>
                      ))}
                    </motion.ul>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
