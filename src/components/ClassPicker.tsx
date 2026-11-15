import React from 'react';
import { cn } from '../lib/utils';
import { sanitizeSection } from '../lib/schoolYear';

import { t } from '../lib/i18n';
interface ClassPickerProps {
  classYear?: number;
  classSection?: string;
  /** 3 for lower-secondary schools, 5 for upper-secondary schools. */
  maxYear: number;
  onChange: (value: { classYear?: number; classSection?: string }) => void;
  disabled?: boolean;
}

const COMMON_SECTIONS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

/**
 * Grade buttons plus a section field that only accepts capital letters, so a
 * class is always stored in the same form ("3B", never "3 b" or "III B").
 */
export default function ClassPicker({ classYear, classSection = '', maxYear, onChange, disabled }: ClassPickerProps) {
  const years = Array.from({ length: maxYear }, (_, i) => i + 1);

  return (
    <div className={cn('space-y-4', disabled && 'opacity-40 pointer-events-none')}>
      <div className="space-y-2">
        <p className="text-[10px] uppercase tracking-[0.2em] text-white/40 font-medium">{t("Year")}</p>
        <div className="flex gap-2">
          {years.map(year => (
            <button
              key={year}
              type="button"
              onClick={() => onChange({ classYear: year, classSection })}
              className={cn(
                'w-11 h-11 rounded-xl border text-sm font-semibold transition-all',
                classYear === year ? 'bg-luxury-gold text-luxury-black border-luxury-gold' : 'border-white/10 text-white/60 hover:bg-white/5'
              )}
            >
              {year}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-[10px] uppercase tracking-[0.2em] text-white/40 font-medium">{t("Section")}</p>
        <div className="flex flex-wrap items-center gap-2">
          {COMMON_SECTIONS.map(letter => (
            <button
              key={letter}
              type="button"
              onClick={() => onChange({ classYear, classSection: letter })}
              className={cn(
                'w-11 h-11 rounded-xl border text-sm font-semibold transition-all',
                classSection === letter ? 'bg-luxury-gold text-luxury-black border-luxury-gold' : 'border-white/10 text-white/60 hover:bg-white/5'
              )}
            >
              {letter}
            </button>
          ))}
          <input
            type="text"
            inputMode="text"
            autoCapitalize="characters"
            value={COMMON_SECTIONS.includes(classSection) ? '' : classSection}
            onChange={(e) => onChange({ classYear, classSection: sanitizeSection(e.target.value) })}
            placeholder={t("Other")}
            maxLength={3}
            className="w-20 h-11 bg-white/5 border border-white/10 rounded-xl px-3 text-sm text-center text-white uppercase placeholder:text-white/20 placeholder:normal-case focus:outline-none focus:ring-2 focus:ring-luxury-gold/30"
            title={t("Section letters, for example AS")}
          />
        </div>
      </div>
    </div>
  );
}
