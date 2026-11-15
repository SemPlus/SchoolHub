import React from 'react';
import { Layers } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { Collection } from '../types';
import { subjectStyle, withAlpha } from '../lib/subjects';
import SubjectBadge from './SubjectBadge';

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
      <div className="absolute inset-x-6 top-0 h-6 rounded-t-[1.5rem] border border-white/5" style={{ backgroundColor: withAlpha(color, 0.08) }} />
      <div className="absolute inset-x-3 top-1.5 h-6 rounded-t-[1.75rem] border border-white/5" style={{ backgroundColor: withAlpha(color, 0.12) }} />

      <div
        className="relative h-full rounded-[2rem] p-6 sm:p-7 border bg-[#0d0d0d] flex flex-col gap-4 transition-all group-hover:bg-[#121212]"
        style={{ borderColor: withAlpha(color, 0.35) }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0" style={{ backgroundColor: withAlpha(color, 0.15) }}>
            <Layers className="w-6 h-6" style={{ color }} />
          </div>
          <span className="text-[10px] uppercase tracking-widest font-semibold px-3 py-1 rounded-full" style={{ color, backgroundColor: withAlpha(color, 0.1) }}>
            {workCount} {workCount === 1 ? 'work' : 'works'}
          </span>
        </div>

        <div className="space-y-2">
          <p className="text-[9px] uppercase tracking-[0.25em] text-white/40">Collection</p>
          <h3 className="font-serif text-2xl text-white leading-tight line-clamp-2">{collection.title}</h3>
          <div className="flex flex-wrap gap-2">
            <SubjectBadge subject={collection.subject} />
            {collection.className && (
              <span className="px-2 py-0.5 rounded-full text-[8px] uppercase tracking-widest bg-luxury-gold/10 border border-luxury-gold/20 text-luxury-gold">
                {collection.className}
              </span>
            )}
          </div>
        </div>

        <p className="mt-auto pt-4 border-t border-white/5 text-[10px] uppercase tracking-widest text-white/35 truncate">
          {people.length > 0 ? `${people.slice(0, 3).join(', ')}${people.length > 3 ? ` +${people.length - 3}` : ''}` : 'No works yet'}
          {lastActivity ? ` · ${formatDistanceToNow(lastActivity, { addSuffix: true })}` : ''}
        </p>
      </div>
    </button>
  );
}
