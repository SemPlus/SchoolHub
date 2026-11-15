import React, { useMemo, useState } from 'react';
import { Layers, Plus, Check, X } from 'lucide-react';
import { useAppData } from '../context/AppData';
import { createCollection, sortCollectionsForViewer } from '../lib/collections';
import { classLabelsOf } from '../lib/schoolYear';
import { firebaseErrorMessage } from '../lib/engagement';
import { subjectStyle } from '../lib/subjects';
import { cn } from '../lib/utils';
import type { PickedSchool } from './SchoolPicker';

import { t } from '../lib/i18n';
interface CollectionPickerProps {
  value: string | null;
  onChange: (collectionId: string | null) => void;
  /** Used for new collections and to list the right ones first. */
  school: PickedSchool | null;
  classYear?: number;
  classSection?: string;
  subject?: string;
}

/**
 * "Is this part of a group project or theme?" Lists the class's collections
 * first and lets anyone start a new one with just a title.
 */
export default function CollectionPicker({ value, onChange, school, classYear, classSection, subject }: CollectionPickerProps) {
  const { collections, profile } = useAppData();
  const [isCreating, setIsCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const targetLabel = classYear && classSection ? `${classYear}${classSection}` : '';
  const options = useMemo(() => {
    const labels = targetLabel ? [targetLabel] : classLabelsOf(profile);
    const viewer = school ? { ...(profile || ({} as any)), schoolId: school.id } : profile;
    return sortCollectionsForViewer(
      collections.filter(c => !school || c.schoolId === school.id),
      viewer,
      labels
    ).slice(0, 12);
  }, [collections, profile, school, targetLabel]);

  const selected = collections.find(c => c.id === value);

  const handleCreate = async () => {
    if (title.trim().length < 2) return;
    setBusy(true);
    setError(null);
    try {
      const id = await createCollection({ title, subject, school, classYear, classSection });
      onChange(id);
      setIsCreating(false);
      setTitle('');
    } catch (err) {
      setError(firebaseErrorMessage(err, t("Could not create the collection.")));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-[10px] uppercase tracking-[0.2em] text-white/40 font-medium ml-1 flex items-center gap-2">
        <Layers className="w-3.5 h-3.5" /> {t(" Part of a group project or theme? (optional)")}</p>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onChange(null)}
          className={cn(
            'px-3 py-2 rounded-xl border text-xs transition-all',
            !value ? 'border-luxury-gold bg-luxury-gold/10 text-luxury-gold' : 'border-white/10 text-white/50 hover:text-white'
          )}
        >
          {t("No")}</button>
        {options.map(c => {
          const color = subjectStyle(c.subject).color;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => onChange(c.id)}
              className={cn(
                'px-3 py-2 rounded-xl border text-xs transition-all flex items-center gap-2 max-w-full',
                value === c.id ? 'border-luxury-gold bg-luxury-gold/10 text-white' : 'border-white/10 text-white/60 hover:text-white'
              )}
            >
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
              <span className="truncate">{c.title}</span>
              {c.className && <span className="text-white/30 shrink-0">{c.className}</span>}
              {value === c.id && <Check className="w-3.5 h-3.5 text-luxury-gold shrink-0" />}
            </button>
          );
        })}
        {selected && !options.some(o => o.id === selected.id) && (
          <span className="px-3 py-2 rounded-xl border border-luxury-gold bg-luxury-gold/10 text-xs text-white">{selected.title}</span>
        )}
        {!isCreating && (
          <button
            type="button"
            onClick={() => setIsCreating(true)}
            className="px-3 py-2 rounded-xl border border-dashed border-white/20 text-xs text-white/60 hover:text-white flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" /> {t(" New")}</button>
        )}
      </div>

      {isCreating && (
        <div className="flex items-center gap-2">
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleCreate(); } }}
            placeholder={t("e.g. Renaissance presentations")}
            maxLength={120}
            className="flex-1 min-w-0 bg-white/5 border border-white/10 rounded-xl py-2.5 px-3 text-sm text-white placeholder:text-white/25 focus:outline-none focus:ring-2 focus:ring-luxury-gold/30"
          />
          <button
            type="button"
            disabled={busy || title.trim().length < 2}
            onClick={handleCreate}
            className="px-4 py-2.5 rounded-xl bg-luxury-gold text-luxury-black text-xs font-bold disabled:opacity-30"
          >
            {busy ? '…' : t("Create")}
          </button>
          <button type="button" onClick={() => { setIsCreating(false); setTitle(''); }} className="p-2 text-white/40 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
