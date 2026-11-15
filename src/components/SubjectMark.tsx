import React from 'react';
import { subjectStyle, withAlpha } from '../lib/subjects';
import { getLanguage, t } from '../lib/i18n';
import { cn } from '../lib/utils';

interface SubjectMarkProps {
  subject?: string | null;
  /** Shown instead of the subject monogram, e.g. a folder's initial. */
  text?: string;
  /** Colour when there is no subject (defaults to gold). */
  color?: string;
  size?: 'sm' | 'md';
  className?: string;
}

/**
 * A monogram in a hairline roundel, like a stamp on a binder: "La" for
 * Latin, "Ma" for Mathematics. Replaces icon tiles on cards.
 */
export default function SubjectMark({ subject, text, color, size = 'md', className }: SubjectMarkProps) {
  const style = subjectStyle(subject);
  const tone = subject ? style.color : (color || '#D4AF37');
  const label = text ?? (subject ? style.mark[getLanguage()] : '·');
  return (
    <span
      className={cn(
        'relative inline-flex items-center justify-center shrink-0 rounded-full border font-serif italic leading-none select-none',
        size === 'sm' ? 'w-9 h-9 text-base' : 'w-10 h-10 sm:w-12 sm:h-12 text-lg sm:text-xl',
        className,
      )}
      style={{ color: tone, borderColor: withAlpha(tone, 0.55) }}
      title={subject ? t(subject) : undefined}
      aria-hidden={!subject}
    >
      {/* Inner hairline, as on an embossed seal */}
      <span className="absolute inset-[3px] rounded-full border" style={{ borderColor: withAlpha(tone, 0.18) }} />
      <span className="relative -mt-px">{label}</span>
    </span>
  );
}
