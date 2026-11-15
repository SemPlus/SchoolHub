import React, { useEffect, useMemo, useState } from 'react';
import { collection, doc, getDocsFromServer } from 'firebase/firestore';
import { LayoutDashboard, Users, FileText, School, Layers, AlertTriangle, UserX, HandHelping, Activity, RefreshCw, Search } from 'lucide-react';
import { format, formatDistanceToNow, t } from '../lib/i18n';
import { db } from '../firebase';
import type { Collection, Material, MaterialRequest, User } from '../types';
import { toDate } from '../lib/utils';
import { mapCollectionDoc, mapMaterialDoc, mapRequestDoc } from '../lib/mappers';
import { keywordsFor, keywordsStale } from '../lib/search';
import { updateDoc } from '../lib/firestoreWrites';
import PendingTeachers from './PendingTeachers';
import ViewAsPanel from './ViewAsPanel';
import WeeklyBars, { countByWeek, lastWeeks, weekStart } from './dashboard/WeeklyBars';
import { ContentDemand, Funnel, SchoolsTable, type SchoolRow, type SubjectDemand } from './dashboard/DashboardSections';

const DAY = 24 * 60 * 60 * 1000;
const WEEK = 7 * DAY;

type DashboardUser = User & { createdAtDate: Date | null; lastSeenDate: Date | null };
interface ActivityEvent { userId: string; at: Date | null }

/** Founder-only overview: growth, the sign-up funnel, schools, content and demand. */
export default function FounderDashboard() {
  // The app only keeps one school loaded; the dashboard reads every school.
  const [materials, setMaterials] = useState<Material[]>([]);
  const [requests, setRequests] = useState<MaterialRequest[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [indexing, setIndexing] = useState<{ done: number; failed: number; total: number } | null>(null);
  const [users, setUsers] = useState<DashboardUser[]>([]);
  const [opens, setOpens] = useState<ActivityEvent[]>([]);
  const [saves, setSaves] = useState<ActivityEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [opensError, setOpensError] = useState(false);

  const [loadedAt, setLoadedAt] = useState<Date | null>(null);
  const [loading, setLoading] = useState(false);

  // One-off reads, not live listeners: listing users, opens and saves is
  // founder-only, and live listeners on refused queries can crash Firestore's
  // client when they are started and stopped quickly.
  const load = async () => {
    setLoading(true);
    const [u, o, s, m, r, c] = await Promise.allSettled([
      getDocsFromServer(collection(db, 'users')),
      getDocsFromServer(collection(db, 'opens')),
      getDocsFromServer(collection(db, 'saves')),
      getDocsFromServer(collection(db, 'materials')),
      getDocsFromServer(collection(db, 'requests')),
      getDocsFromServer(collection(db, 'collections')),
    ]);
    if (m.status === 'fulfilled') setMaterials(m.value.docs.map(d => mapMaterialDoc(d.id, d.data())));
    if (r.status === 'fulfilled') setRequests(r.value.docs.map(d => mapRequestDoc(d.id, d.data())));
    if (c.status === 'fulfilled') setCollections(c.value.docs.map(d => mapCollectionDoc(d.id, d.data())).filter(x => !x.isDeleted));
    if (u.status === 'fulfilled') {
      setUsers(u.value.docs.map(d => {
        const data = d.data() as any;
        return { uid: d.id, ...data, createdAtDate: toDate(data.createdAt), lastSeenDate: toDate(data.lastSeenAt) } as DashboardUser;
      }));
      setError(null);
    } else {
      setError((u.reason as Error)?.message || String(u.reason));
    }
    if (o.status === 'fulfilled') {
      setOpens(o.value.docs.map(d => ({ userId: d.data().userId, at: toDate(d.data().createdAt) })));
      setOpensError(false);
    } else {
      setOpensError(true);
    }
    if (s.status === 'fulfilled') {
      setSaves(s.value.docs.map(d => ({ userId: d.data().userId, at: toDate(d.data().createdAt) })));
    }
    setLoadedAt(new Date());
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  // Materials shared before search across schools existed have no keywords.
  const unindexed = useMemo(() => materials.filter(m => keywordsStale(m)), [materials]);
  const rebuildIndex = async () => {
    const list = unindexed;
    let done = 0;
    let failed = 0;
    setIndexing({ done, failed, total: list.length });
    for (let i = 0; i < list.length; i += 20) {
      const results = await Promise.allSettled(list.slice(i, i + 20).map(m =>
        updateDoc(doc(db, 'materials', m.id), { keywords: keywordsFor(m) })));
      for (const result of results) {
        if (result.status === 'fulfilled') done += 1;
        else { failed += 1; console.warn('Could not index material:', result.reason); }
      }
      setIndexing({ done, failed, total: list.length });
    }
    await load();
  };

  const data = useMemo(() => {
    const now = Date.now();
    const live = materials.filter(m => !m.isDeleted);
    const uploaders = new Set(live.map(m => m.authorId));
    const openers = new Set(opens.map(o => o.userId));

    // Everything a person did, with its date: opens, saves, uploads, requests, last visit.
    const events: ActivityEvent[] = [
      ...opens,
      ...saves,
      ...live.map(m => ({ userId: m.authorId, at: m.createdAt })),
      ...requests.map(r => ({ userId: r.authorId, at: r.createdAt })),
      ...users.map(u => ({ userId: u.uid, at: u.lastSeenDate })),
    ];
    const lastActive = new Map<string, number>();
    for (const e of events) {
      if (!e.at) continue;
      const time = e.at.getTime();
      if (time > (lastActive.get(e.userId) ?? 0)) lastActive.set(e.userId, time);
    }
    const activeWithin = (ms: number) => [...lastActive.values()].filter(time => now - time < ms).length;

    // --- growth, 12 weeks
    const weeks = lastWeeks(12);
    const activePerWeek = weeks.map(() => new Set<string>());
    const first = weeks[0].getTime();
    for (const e of events) {
      if (!e.at) continue;
      const index = Math.floor((weekStart(e.at).getTime() - first) / WEEK);
      if (index >= 0 && index < weeks.length) activePerWeek[index].add(e.userId);
    }

    // --- funnel
    const setupDone = (u: DashboardUser) => !!u.schoolId && (!!u.classYear || (u.teacherClasses?.length ?? 0) > 0);
    const cameBack = (u: DashboardUser) => {
      const created = u.createdAtDate?.getTime();
      if (!created) return false;
      return (lastActive.get(u.uid) ?? 0) >= created + WEEK;
    };
    const oldEnough = users.filter(u => u.createdAtDate && now - u.createdAtDate.getTime() >= WEEK);
    const funnel = [
      { label: t("Signed up"), value: users.length },
      { label: t("Finished setup (school and class)"), value: users.filter(setupDone).length },
      { label: t("Opened a material"), value: users.filter(u => openers.has(u.uid)).length },
      { label: t("Shared a material"), value: users.filter(u => uploaders.has(u.uid)).length },
      {
        label: t("Came back after the first week"),
        value: users.filter(cameBack).length,
        hint: t("{0} of {1} who signed up over a week ago", oldEnough.filter(cameBack).length, oldEnough.length),
      },
    ];

    // --- schools
    const schools = new Map<string, SchoolRow & { classSet: Set<string> }>();
    const schoolOf = (id: string, name?: string, city?: string) => {
      let row = schools.get(id);
      if (!row) {
        row = { id, name: name || id, city: city || '', users: 0, teachers: 0, materials: 0, classes: 0, lastActivity: null, classSet: new Set() };
        schools.set(id, row);
      }
      if (name && row.name === id) row.name = name;
      if (city && !row.city) row.city = city;
      return row;
    };
    const touch = (row: SchoolRow, at: Date | null | undefined) => {
      if (at && (!row.lastActivity || at > row.lastActivity)) row.lastActivity = at;
    };
    for (const u of users) {
      if (!u.schoolId) continue;
      const row = schoolOf(u.schoolId, u.schoolName, u.schoolCity);
      row.users += 1;
      if (u.accountType === 'teacher') {
        row.teachers += 1;
        (u.teacherClasses || []).forEach(c => row.classSet.add(c));
      } else if (u.classYear && u.classSection) {
        row.classSet.add(`${u.classYear}${u.classSection}`);
      }
      touch(row, u.lastSeenDate);
    }
    for (const m of live) {
      if (!m.schoolId) continue;
      const row = schoolOf(m.schoolId, m.schoolName, m.schoolCity);
      row.materials += 1;
      if (m.className) row.classSet.add(m.className);
      touch(row, m.createdAt);
    }
    const schoolRows: SchoolRow[] = [...schools.values()]
      .map(({ classSet, ...row }) => ({ ...row, classes: classSet.size }))
      .sort((a, b) => b.materials - a.materials || b.users - a.users);

    // --- content & demand
    const topOpened = [...live].filter(m => (m.downloadCount || 0) > 0)
      .sort((a, b) => (b.downloadCount || 0) - (a.downloadCount || 0)).slice(0, 8);
    const open = requests.filter(r => r.status === 'open');
    const bySubject = new Map<string, SubjectDemand>();
    for (const r of open) {
      if (!r.subject) continue;
      const row = bySubject.get(r.subject) ?? { subject: r.subject, openRequests: 0, materials: 0 };
      row.openRequests += 1;
      bySubject.set(r.subject, row);
    }
    for (const m of live) {
      const row = m.subject ? bySubject.get(m.subject) : undefined;
      if (row) row.materials += 1;
    }
    const demand = [...bySubject.values()].sort((a, b) => b.openRequests - a.openRequests || a.materials - b.materials);
    const waiting = [...open].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()).slice(0, 6);
    const broken = live.filter(m => m.linkStatus === 'broken' || m.linkStatus === 'restricted');

    const silent = users
      .filter(u => !uploaders.has(u.uid))
      .sort((a, b) => (b.createdAtDate?.getTime() ?? 0) - (a.createdAtDate?.getTime() ?? 0));

    return {
      weeks,
      signUpsPerWeek: countByWeek(weeks, users.map(u => u.createdAtDate)),
      uploadsPerWeek: countByWeek(weeks, live.map(m => m.createdAt)),
      opensPerWeek: countByWeek(weeks, opens.map(o => o.at)),
      activePerWeek: activePerWeek.map(s => s.size),
      funnel,
      schoolRows,
      topOpened, demand, waiting, broken,
      tiles: {
        users: users.length,
        newUsers: users.filter(u => u.createdAtDate && now - u.createdAtDate.getTime() < WEEK).length,
        teachers: users.filter(u => u.accountType === 'teacher').length,
        noSchool: users.filter(u => !u.schoolId).length,
        active7: activeWithin(WEEK),
        active30: activeWithin(30 * DAY),
        materials: live.length,
        newMaterials: live.filter(m => now - m.createdAt.getTime() < WEEK).length,
        schools: schoolRows.length,
        classes: schoolRows.reduce((sum, s) => sum + s.classes, 0),
        collections: collections.length,
        openRequests: open.length,
        withoutSubject: live.filter(m => !m.subject).length,
      },
      silent,
    };
  }, [materials, collections, requests, users, opens, saves]);

  const tile = (icon: React.ReactNode, label: string, value: number, note?: string) => (
    <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-4 min-w-0">
      <p className="flex items-center gap-1.5 text-[9px] uppercase tracking-widest text-white/40">{icon}<span className="truncate">{label}</span></p>
      <p className="text-2xl font-serif text-white mt-1 tabular-nums">{value}</p>
      {note && <p className="text-[10px] text-white/35">{note}</p>}
    </div>
  );
  const s = data.tiles;

  return (
    <div className="space-y-6">
      <div className="glass-panel rounded-[1.5rem] sm:rounded-[2.5rem] p-5 sm:p-8 border-white/5 space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-luxury-gold/10 rounded-xl"><LayoutDashboard className="w-5 h-5 text-luxury-gold" /></div>
          <div className="min-w-0 flex-1">
            <h2 className="text-2xl font-serif text-white">{t("Founder dashboard")}</h2>
            <p className="text-xs text-white/40">
              {t("Only you can see this.")}{loadedAt ? ' ' + t("Updated at {0}.", format(loadedAt, 'HH:mm')) : ''}
            </p>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-full border border-white/15 text-xs text-white/70 hover:text-white disabled:opacity-50"
          >
            <RefreshCw className={loading ? 'w-3.5 h-3.5 animate-spin' : 'w-3.5 h-3.5'} />
            <span className="hidden sm:inline">{t("Refresh")}</span>
          </button>
        </div>
        {error && <p className="text-xs text-red-400">{t("Could not load users: ")}{error}</p>}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {tile(<Users className="w-3.5 h-3.5" />, t("Users"), s.users, t("+{0} this week · {1} teachers", s.newUsers, s.teachers))}
          {tile(<Activity className="w-3.5 h-3.5" />, t("Active this week"), s.active7, t("{0} in the last 30 days", s.active30))}
          {tile(<FileText className="w-3.5 h-3.5" />, t("Materials"), s.materials, t("+{0} this week", s.newMaterials))}
          {tile(<School className="w-3.5 h-3.5" />, t("Active schools"), s.schools, (s.classes === 1 ? t("1 class") : t("{0} classes", s.classes)))}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {tile(<Layers className="w-3.5 h-3.5" />, t("Collections"), s.collections, t("{0} open requests", s.openRequests))}
          {tile(<UserX className="w-3.5 h-3.5" />, t("Signed up, never shared"), data.silent.length, t("{0} never finished setup", s.noSchool))}
          {tile(<AlertTriangle className="w-3.5 h-3.5" />, t("Broken or private links"), data.broken.length)}
          {tile(<HandHelping className="w-3.5 h-3.5" />, t("Materials without subject"), s.withoutSubject)}
        </div>

        {(unindexed.length > 0 || indexing) && (
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-2xl border border-white/10 p-4">
            <Search className="w-4 h-4 text-white/40 shrink-0" />
            <p className="flex-1 text-xs text-white/60">
              {indexing
                ? t("Search index: {0} of {1} done", indexing.done, indexing.total) + (indexing.failed ? ' · ' + t("{0} failed", indexing.failed) : '')
                : t("{0} materials cannot be found by search from other schools yet.", unindexed.length)}
            </p>
            {unindexed.length > 0 && (
              <button
                onClick={rebuildIndex}
                disabled={!!indexing && indexing.done + indexing.failed < indexing.total}
                className="shrink-0 px-4 py-2.5 rounded-full border border-white/15 text-xs text-white/80 hover:text-white disabled:opacity-50"
              >
                {t("Update search index")}
              </button>
            )}
          </div>
        )}

        <PendingTeachers />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-6">
        <WeeklyBars title={t("Sign-ups")} weeks={data.weeks} values={data.signUpsPerWeek} />
        <WeeklyBars title={t("Active users")} weeks={data.weeks} values={data.activePerWeek} />
        <WeeklyBars title={t("Materials shared")} weeks={data.weeks} values={data.uploadsPerWeek} />
        <WeeklyBars
          title={t("Materials opened")}
          weeks={data.weeks}
          values={data.opensPerWeek}
          unavailable={opensError ? t("Available once the new database rules are deployed.") : undefined}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] gap-4 sm:gap-6">
        <Funnel steps={data.funnel} />
        <SchoolsTable rows={data.schoolRows} />
      </div>

      <ContentDemand topOpened={data.topOpened} demand={data.demand} waiting={data.waiting} broken={data.broken} />

      <div className="glass-panel rounded-[1.5rem] p-5 border-white/5 space-y-3">
        <p className="text-[10px] uppercase tracking-widest text-white/40">{t("Recent sign-ups who never shared")}</p>
        {data.silent.length === 0 ? <p className="text-xs text-white/40">{t("Everyone has shared something.")}</p> : data.silent.slice(0, 10).map(u => (
          <div key={u.uid} className="flex items-center justify-between gap-3 text-sm">
            <span className="text-white/80 truncate">{u.displayName || t("Unnamed")}<span className="text-white/35"> · {u.schoolName || t("no school yet")}</span></span>
            <span className="text-[11px] text-white/40 shrink-0">{u.createdAtDate ? formatDistanceToNow(u.createdAtDate, { addSuffix: true }) : ''}</span>
          </div>
        ))}
      </div>

      <ViewAsPanel />
    </div>
  );
}
