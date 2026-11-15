import React from 'react';
import { subjectStyle, withAlpha } from '../lib/subjects';
import { cn } from '../lib/utils';
import { t } from '../lib/i18n';

interface SubjectBadgeProps {
  subject?: string | null;
  size?: 'sm' | 'md';
  className?: string;
}

/** Hairline chip with the subject's name. Renders nothing without a subject. */
export default function SubjectBadge({ subject, size = 'sm', className }: SubjectBadgeProps) {
  if (!subject) return null;
  const { color } = subjectStyle(subject);
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border font-semibold uppercase tracking-widest whitespace-nowrap',
        size === 'sm' ? 'px-2 py-0.5 text-[8px]' : 'px-3 py-1 text-[10px]',
        className
      )}
      style={{ color, borderColor: withAlpha(color, 0.4) }}
    >
      {t(subject)}
    </span>
  );
}
