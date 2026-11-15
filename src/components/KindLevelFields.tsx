import React from 'react';
import { KINDS, LEVELS } from '../lib/materialKinds';
import { cn } from '../lib/utils';

import { t } from '../lib/i18n';
interface KindLevelFieldsProps {
  kind: string;
  level: string;
  onKindChange: (kind: string) => void;
  onLevelChange: (level: string) => void;
  /** Hide the level row (it lives under "More options" in the add window). */
  showLevel?: boolean;
  showKind?: boolean;
}

/** One tap to say what a material is; tapping again clears it. */
export default function KindLevelFields({ kind, level, onKindChange, onLevelChange, showLevel = true, showKind = true }: KindLevelFieldsProps) {
  const label = 'block text-[10px] uppercase tracking-[0.2em] text-white/40 font-medium ml-1';
  return (
    <div className="space-y-6">
      {showKind && (
        <div className="space-y-2">
          <p className={label}>{t("What is it?")}</p>
          <div className="flex flex-wrap gap-2">
            {KINDS.map(k => {
              const active = kind === k.id;
              return (
                <button
                  key={k.id}
                  type="button"
                  onClick={() => onKindChange(active ? '' : k.id)}
                  className={cn(
                    'px-3 py-2 rounded-xl border text-xs flex items-center gap-1.5 transition-all',
                    active ? 'border-luxury-gold bg-luxury-gold/10 text-luxury-gold' : 'border-white/10 text-white/60 hover:text-white'
                  )}
                >
                  {t(k.label)}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {showLevel && (
        <div className="space-y-2">
          <p className={label}>{t("Level (optional)")}</p>
          <div className="flex flex-wrap gap-2">
            {LEVELS.map(l => {
              const active = level === l.id;
              return (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => onLevelChange(active ? '' : l.id)}
                  className={cn(
                    'px-3 py-2 rounded-xl border text-xs transition-all',
                    active ? 'border-luxury-gold bg-luxury-gold/10 text-luxury-gold' : 'border-white/10 text-white/60 hover:text-white'
                  )}
                >
                  {t(l.label)} <span className="text-white/30">· {l.hint}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
