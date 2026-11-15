import React from 'react';
import { ExternalLink, AlertTriangle, Flame, HelpCircle, School as SchoolIcon } from 'lucide-react';
import type { Material, MaterialRequest } from '../../types';
import SubjectBadge from '../SubjectBadge';
import { formatDistanceToNow, t } from '../../lib/i18n';
import { cn } from '../../lib/utils';

const count = (n: number, one: string, many: string) => (n === 1 ? t(one) : t(many, n));

const panel = 'glass-panel rounded-[1.5rem] p-4 sm:p-5 border-white/5 space-y-4 min-w-0';
const heading = 'text-[10px] uppercase tracking-widest text-white/50';

// ------------------------------------------------------------------ funnel

export interface FunnelStep { label: string; value: number; hint?: string }

/** Where people stop: each step as a bar, with its share of all sign-ups. */
export function Funnel({ steps }: { steps: FunnelStep[] }) {
  const base = Math.max(1, steps[0]?.value ?? 1);
  return (
    <div className={panel}>
      <p className={heading}>{t("From sign-up to coming back")}</p>
      <ol className="space-y-3">
        {steps.map((s, i) => {
          const share = s.value / base;
          const prev = i > 0 ? steps[i - 1].value : null;
          const kept = prev ? Math.round((s.value / prev) * 100) : null;
          return (
            <li key={s.label} className="space-y-1.5">
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="text-white/80 min-w-0 truncate">{s.label}</span>
                <span className="shrink-0 tabular-nums text-white">
                  {s.value}
                  <span className="text-white/40 text-xs"> · {Math.round(share * 100)}%</span>
                </span>
              </div>
              <div className="h-2.5 rounded-full bg-white/[0.06] overflow-hidden">
                <div className="h-full rounded-full bg-luxury-gold/90" style={{ width: `${Math.max(share > 0 ? 2 : 0, share * 100)}%` }} />
              </div>
              {(kept !== null || s.hint) && (
                <p className="text-[10px] text-white/35">
                  {kept !== null ? t("{0}% of the step before", kept) : ''}{kept !== null && s.hint ? ' · ' : ''}{s.hint || ''}
                </p>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

// ------------------------------------------------------------------ schools

export interface SchoolRow {
  id: string;
  name: string;
  city: string;
  users: number;
  teachers: number;
  materials: number;
  classes: number;
  lastActivity: Date | null;
}

function status(last: Date | null): { label: string; className: string } {
  const days = last ? (Date.now() - last.getTime()) / 86_400_000 : Infinity;
  if (days <= 7) return { label: t("Active"), className: 'text-emerald-300 border-emerald-400/30 bg-emerald-400/10' };
  if (days <= 30) return { label: t("Quiet"), className: 'text-amber-200 border-amber-400/30 bg-amber-400/10' };
  return { label: t("Asleep"), className: 'text-white/50 border-white/15 bg-white/5' };
}

/** Every school using SchoolHub: who is there, what they share, how recently. */
export function SchoolsTable({ rows }: { rows: SchoolRow[] }) {
  return (
    <div className={panel}>
      <div className="flex items-baseline justify-between gap-3">
        <p className={heading}>{t("Schools and classes")}</p>
        <p className="text-[10px] text-white/35">{rows.length === 1 ? t('1 school') : t('{0} schools', rows.length)}</p>
      </div>
      {rows.length === 0 ? <p className="text-xs text-white/40">{t("No school yet.")}</p> : (
        <div className="divide-y divide-white/5">
          <div className="hidden md:grid grid-cols-[minmax(0,2.4fr)_repeat(4,minmax(0,0.7fr))_minmax(0,1.2fr)] gap-3 pb-2 text-[10px] uppercase tracking-widest text-white/35">
            <span>{t("School")}</span><span className="text-right">{t("Users")}</span><span className="text-right">{t("Teachers")}</span>
            <span className="text-right">{t("Materials")}</span><span className="text-right">{t("Classes")}</span><span className="text-right">{t("Last activity")}</span>
          </div>
          {rows.map(r => {
            const st = status(r.lastActivity);
            return (
              <div key={r.id} className="py-3 grid grid-cols-[minmax(0,1fr)_auto] md:grid-cols-[minmax(0,2.4fr)_repeat(4,minmax(0,0.7fr))_minmax(0,1.2fr)] gap-x-3 gap-y-1.5 items-center text-sm">
                <div className="min-w-0">
                  <p className="text-white/85 truncate flex items-center gap-1.5"><SchoolIcon className="w-3.5 h-3.5 text-white/30 shrink-0" />{r.name}</p>
                  {r.city && <p className="text-[11px] text-white/35 truncate">{r.city}</p>}
                </div>
                <span className={cn('md:hidden justify-self-end px-2 py-0.5 rounded-full border text-[10px] font-semibold', st.className)}>{st.label}</span>
                {/* Phones: one line of figures under the name */}
                <p className="md:hidden col-span-2 text-[11px] text-white/50 tabular-nums">
                  {[
                    count(r.users, '1 user', '{0} users'),
                    count(r.teachers, '1 teacher', '{0} teachers'),
                    count(r.materials, '1 material', '{0} materials'),
                    count(r.classes, '1 class', '{0} classes'),
                  ].join(' · ')}
                  {r.lastActivity ? ` · ${formatDistanceToNow(r.lastActivity, { addSuffix: true })}` : ''}
                </p>
                <span className="hidden md:block text-right tabular-nums text-white/70">{r.users}</span>
                <span className="hidden md:block text-right tabular-nums text-white/70">{r.teachers}</span>
                <span className="hidden md:block text-right tabular-nums text-white/70">{r.materials}</span>
                <span className="hidden md:block text-right tabular-nums text-white/70">{r.classes}</span>
                <span className="hidden md:flex justify-end items-center gap-2 text-[11px] text-white/50">
                  {r.lastActivity ? formatDistanceToNow(r.lastActivity, { addSuffix: true }) : '–'}
                  <span className={cn('px-2 py-0.5 rounded-full border text-[10px] font-semibold', st.className)}>{st.label}</span>
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ content & demand

export interface SubjectDemand { subject: string; openRequests: number; materials: number }

const openLink = (id: string) => `/?material=${encodeURIComponent(id)}`;

export function ContentDemand({
  topOpened, demand, waiting, broken,
}: {
  topOpened: Material[];
  demand: SubjectDemand[];
  waiting: MaterialRequest[];
  broken: Material[];
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
      <div className={panel}>
        <p className={cn(heading, 'flex items-center gap-1.5')}><Flame className="w-3.5 h-3.5" /> {t("Most opened materials")}</p>
        {topOpened.length === 0 ? <p className="text-xs text-white/40">{t("Nothing opened yet.")}</p> : (
          <ol className="space-y-2.5">
            {topOpened.map((m, i) => (
              <li key={m.id} className="flex items-center gap-3 text-sm">
                <span className="w-5 text-right text-[11px] text-white/30 tabular-nums shrink-0">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <a href={openLink(m.id)} className="text-white/85 hover:text-luxury-gold truncate block">{m.title}</a>
                  <p className="text-[11px] text-white/35 truncate">{[m.className, m.schoolName, m.authorName].filter(Boolean).join(' · ')}</p>
                </div>
                <span className="shrink-0 text-[11px] text-white/60 tabular-nums text-right">
                  {count(m.downloadCount || 0, '1 open', '{0} opens')}<br /><span className="text-white/35">{count(m.saveCount || 0, '1 save', '{0} saves')}</span>
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>

      <div className={panel}>
        <p className={heading}>{t("What people ask for vs what exists")}</p>
        {demand.length === 0 ? <p className="text-xs text-white/40">{t("No open requests.")}</p> : (
          <div className="space-y-2">
            <div className="grid grid-cols-[minmax(0,1fr)_4.5rem_4.5rem] gap-3 text-[10px] uppercase tracking-widest text-white/35">
              <span>{t("Subject")}</span><span className="text-right">{t("Asked")}</span><span className="text-right">{t("Shared")}</span>
            </div>
            {demand.map(d => {
              const gap = d.openRequests > 0 && d.materials < 3;
              return (
                <div key={d.subject} className="grid grid-cols-[minmax(0,1fr)_4.5rem_4.5rem] gap-3 items-center text-sm">
                  <span className="min-w-0 flex items-center gap-2">
                    <SubjectBadge subject={d.subject} />
                    {gap && <span className="text-[10px] text-amber-200 flex items-center gap-1"><AlertTriangle className="w-3 h-3" />{t("gap")}</span>}
                  </span>
                  <span className="text-right tabular-nums text-white/80">{d.openRequests}</span>
                  <span className="text-right tabular-nums text-white/50">{d.materials}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className={panel}>
        <p className={cn(heading, 'flex items-center gap-1.5')}><HelpCircle className="w-3.5 h-3.5" /> {t("Requests waiting longest")}</p>
        {waiting.length === 0 ? <p className="text-xs text-white/40">{t("No open requests.")}</p> : (
          <ul className="space-y-2.5">
            {waiting.map(r => (
              <li key={r.id} className="flex items-center justify-between gap-3 text-sm">
                <div className="min-w-0">
                  <p className="text-white/85 truncate">{r.title}</p>
                  <p className="text-[11px] text-white/35 truncate">{[r.subject ? t(r.subject) : null, r.className, r.schoolName].filter(Boolean).join(' · ')}</p>
                </div>
                <span className="shrink-0 text-[11px] text-white/50">{formatDistanceToNow(r.createdAt, { addSuffix: true })}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className={panel}>
        <p className={cn(heading, 'flex items-center gap-1.5')}><AlertTriangle className="w-3.5 h-3.5" /> {t("Broken or private links")}</p>
        {broken.length === 0 ? <p className="text-xs text-white/40">{t("All links work.")}</p> : (
          <ul className="space-y-2.5">
            {broken.map(m => (
              <li key={m.id} className="flex items-center justify-between gap-3 text-sm">
                <div className="min-w-0">
                  <p className="text-white/85 truncate">{m.title}</p>
                  <p className="text-[11px] text-white/35 truncate">
                    {m.linkStatus === 'restricted' ? t("Private link") : t("Broken link")} · {m.authorName}
                  </p>
                </div>
                <a href={openLink(m.id)} className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-full border border-white/15 text-[11px] text-white/70 hover:text-white">
                  {t("Fix")} <ExternalLink className="w-3 h-3" />
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
