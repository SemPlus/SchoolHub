import React, { useState } from 'react';
import { format, t } from '../../lib/i18n';

const DAY = 24 * 60 * 60 * 1000;

/** Monday 00:00 (local time) of the week containing `date`. */
export function weekStart(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const offset = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - offset);
  return d;
}

/** The last `count` week starts, oldest first, ending with the current week. */
export function lastWeeks(count: number, now = new Date()): Date[] {
  const current = weekStart(now).getTime();
  return Array.from({ length: count }, (_, i) => new Date(current - (count - 1 - i) * 7 * DAY));
}

/** Counts dates per week; dates outside the range are ignored. */
export function countByWeek(weeks: Date[], dates: (Date | null | undefined)[]): number[] {
  const counts = weeks.map(() => 0);
  const first = weeks[0].getTime();
  for (const d of dates) {
    if (!d) continue;
    const index = Math.floor((weekStart(d).getTime() - first) / (7 * DAY));
    if (index >= 0 && index < counts.length) counts[index] += 1;
  }
  return counts;
}

interface WeeklyBarsProps {
  title: string;
  weeks: Date[];
  values: number[];
  /** Shown instead of the chart, e.g. while data is not available. */
  unavailable?: string;
}

/**
 * One measure over the last weeks. The headline is this week's value (or the
 * hovered week's); bars are gold, anchored to the baseline, with 2px gaps.
 */
export default function WeeklyBars({ title, weeks, values, unavailable }: WeeklyBarsProps) {
  const [hover, setHover] = useState<number | null>(null);
  const last = values.length - 1;
  const shown = hover ?? last;
  const previous = shown > 0 ? values[shown - 1] : null;
  const delta = previous === null ? null : values[shown] - previous;
  const max = Math.max(1, ...values);

  const W = 300;
  const H = 96;
  const gap = 2;
  const barW = (W - gap * (values.length - 1)) / values.length;
  const radius = Math.min(4, barW / 2);

  const bar = (value: number, i: number) => {
    const h = value === 0 ? 0 : Math.max(3, (value / max) * H);
    const x = i * (barW + gap);
    const y = H - h;
    const r = Math.min(radius, h);
    // Rounded top, square bottom on the baseline.
    const d = h === 0 ? '' : `M${x},${H} V${y + r} Q${x},${y} ${x + r},${y} H${x + barW - r} Q${x + barW},${y} ${x + barW},${y + r} V${H} Z`;
    const dim = hover !== null && hover !== i;
    return (
      <g key={i}>
        {d && <path d={d} fill="#D4AF37" opacity={dim ? 0.35 : 0.9} />}
        {/* Hit target: the whole column, taller than the bar */}
        <rect
          x={x - gap / 2} y={0} width={barW + gap} height={H} fill="transparent"
          onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
          onClick={() => setHover(hover === i ? null : i)}
        />
      </g>
    );
  };

  return (
    <div className="glass-panel rounded-[1.5rem] p-4 sm:p-5 border-white/5 space-y-3 min-w-0">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[10px] uppercase tracking-widest text-white/50">{title}</p>
        <p className="text-[10px] text-white/35">{t("12 weeks")}</p>
      </div>
      {unavailable ? (
        <p className="text-xs text-white/40 py-6">{unavailable}</p>
      ) : (
        <>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-serif text-white tabular-nums">{values[shown]}</span>
            <span className="text-[11px] text-white/45">
              {shown === last ? t("this week") : t("week of {0}", format(weeks[shown], 'd MMM'))}
            </span>
            {delta !== null && delta !== 0 && (
              <span className="text-[11px] text-white/60 tabular-nums">{delta > 0 ? '▲' : '▼'} {Math.abs(delta)}</span>
            )}
          </div>
          <svg viewBox={`0 0 ${W} ${H + 1}`} className="w-full h-24 touch-manipulation" role="img" aria-label={t("{0}, last 12 weeks", title)}>
            <line x1={0} x2={W} y1={H + 0.5} y2={H + 0.5} stroke="rgba(255,255,255,0.12)" />
            {values.map(bar)}
          </svg>
          <div className="flex justify-between text-[10px] text-white/30">
            <span>{format(weeks[0], 'd MMM')}</span>
            <span>{t("max {0}", max)}</span>
            <span>{format(weeks[last], 'd MMM')}</span>
          </div>
          <table className="sr-only">
            <caption>{title}</caption>
            <tbody>
              {weeks.map((w, i) => (
                <tr key={i}><th scope="row">{format(w, 'd MMM yyyy')}</th><td>{values[i]}</td></tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
