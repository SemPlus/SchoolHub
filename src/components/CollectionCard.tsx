import React from 'react';
import { CalendarClock } from 'lucide-react';
import { format, formatDistanceToNow } from '../lib/i18n';
import type { Collection } from '../types';
import { subjectStyle, withAlpha } from '../lib/subjects';
import SubjectBadge from './SubjectBadge';
import SubjectMark from './SubjectMark';

import { t } from '../lib/i18n';
interface CollectionCardProps {
  key?: React.Key;
  collection: Collection;
  workCount: number;
  authorNames: string[];
  lastActivity?: Date;
  onOpen: () => void;
}

/** A stacked card standing for a whole shared theme or project. */
export default function CollectionCard({ collection, workCount, authorNames, lastActivity, onOpen }: CollectionCardProps) {
  const { color } = subjectStyle(collection.subject);
  const people = [...new Set(authorNames)];

  return (
    <button onClick={onOpen} className="relative w-full h-full text-left group pt-3">
      {/* The stack behind the card */}
      <div className="absolute inset-x-6 top-0 h-6 rounded-t-[1rem] border border-white/[0.08] bg-[#0a0a0a]" />
      <div className="absolute inset-x-3 top-1.5 h-6 rounded-t-[1.1rem] border border-white/[0.08] bg-[#0b0b0b]" />

      <div
        className="relative h-full rounded-[1.25rem] p-6 sm:p-7 border bg-[#0c0c0c] flex flex-col gap-4 transition-colors group-hover:bg-[#111]"
        style={{ borderColor: withAlpha(color, 0.3) }}
      >
        <div className="flex items-start justify-between gap-3">
          <SubjectMark subject={collection.subject} />
          <span className="text-[10px] uppercase tracking-[0.2em] pt-1" style={{ color }}>
            {workCount === 1 ? t('1 work') : t('{0} works', workCount)}
          </span>
        </div>

        <div className="space-y-2">
          <p className="text-[9px] uppercase tracking-[0.25em] text-white/40">{collection.dueAt ? t("Hand-in") : t("Collection")}</p>
          <h3 className="font-serif text-2xl text-white leading-tight line-clamp-2">{collection.title}</h3>
          <div className="flex flex-wrap gap-2">
            <SubjectBadge subject={collection.subject} />
            {collection.dueAt && (
              <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[8px] uppercase tracking-widest border ${collection.dueAt.getTime() < Date.now() ? 'border-red-400/30 bg-red-400/10 text-red-300' : 'border-luxury-gold/30 bg-luxury-gold/10 text-luxury-gold'}`}>
                <CalendarClock className="w-3 h-3" />
                {collection.dueAt.getTime() < Date.now() ? t("Past due") : t("Due {0}", format(collection.dueAt, 'EEE d MMM'))}
              </span>
            )}
            {collection.className && (
              <span className="px-2 py-0.5 rounded-full text-[8px] uppercase tracking-widest bg-luxury-gold/10 border border-luxury-gold/20 text-luxury-gold">
                {collection.className}
              </span>
            )}
          </div>
        </div>

        <p className="mt-auto pt-4 border-t border-white/5 text-[10px] uppercase tracking-widest text-white/35 truncate">
          {people.length > 0 ? `${people.slice(0, 3).join(', ')}${people.length > 3 ? ` +${people.length - 3}` : ''}` : t("No works yet")}
          {lastActivity ? ` · ${formatDistanceToNow(lastActivity, { addSuffix: true })}` : ''}
        </p>
      </div>
    </button>
  );
}
