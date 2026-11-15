import React, { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { LayoutDashboard, Users, FileText, School, Layers, AlertTriangle, UserX, HandHelping } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { db } from '../firebase';
import type { User } from '../types';
import { useAppData } from '../context/AppData';
import { toDate } from '../lib/utils';
import PendingTeachers from './PendingTeachers';

const WEEK = 7 * 24 * 60 * 60 * 1000;

type DashboardUser = User & { createdAtDate: Date | null };

/** Founder-only overview: growth, activity and where people get stuck. */
export default function FounderDashboard() {
  const { materials, collections, requests } = useAppData();
  const [users, setUsers] = useState<DashboardUser[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Listing users is allowed for the founder only (see firestore.rules).
    const unsubscribe = onSnapshot(collection(db, 'users'), (snapshot) => {
      setUsers(snapshot.docs.map(d => {
        const data = d.data() as any;
        return { uid: d.id, ...data, createdAtDate: toDate(data.createdAt) } as DashboardUser;
      }));
    }, (err) => setError(err.message));
    return () => unsubscribe();
  }, []);

  const stats = useMemo(() => {
    const now = Date.now();
    const live = materials.filter(m => !m.isDeleted);
    const uploaders = new Set(live.map(m => m.authorId));
    const schools = new Map<string, { name: string; count: number; week: number }>();
    for (const m of live) {
      if (!m.schoolId) continue;
      const s = schools.get(m.schoolId) ?? { name: m.schoolName || m.schoolId, count: 0, week: 0 };
      s.count += 1;
      if (now - m.createdAt.getTime() < WEEK) s.week += 1;
      schools.set(m.schoolId, s);
    }
    const classes = new Set(live.filter(m => m.classId).map(m => m.classId));
    const silent = users
      .filter(u => !uploaders.has(u.uid))
      .sort((a, b) => (b.createdAtDate?.getTime() ?? 0) - (a.createdAtDate?.getTime() ?? 0));
    return {
      users: users.length,
      newUsers: users.filter(u => u.createdAtDate && now - u.createdAtDate.getTime() < WEEK).length,
      teachers: users.filter(u => u.accountType === 'teacher').length,
      noSchool: users.filter(u => !u.schoolId).length,
      materials: live.length,
      newMaterials: live.filter(m => now - m.createdAt.getTime() < WEEK).length,
      schools: schools.size,
      classes: classes.size,
      collections: collections.length,
      openRequests: requests.filter(r => r.status === 'open').length,
      brokenLinks: live.filter(m => m.linkStatus === 'broken' || m.linkStatus === 'restricted').length,
      withoutSubject: live.filter(m => !m.subject).length,
      topSchools: [...schools.values()].sort((a, b) => b.count - a.count).slice(0, 8),
      silent,
    };
  }, [materials, collections, requests, users]);

  const tile = (icon: React.ReactNode, label: string, value: number, note?: string) => (
    <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-4">
      <p className="flex items-center gap-1.5 text-[9px] uppercase tracking-widest text-white/40">{icon}{label}</p>
      <p className="text-2xl font-serif text-white mt-1">{value}</p>
      {note && <p className="text-[10px] text-white/35">{note}</p>}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="glass-panel rounded-[1.5rem] sm:rounded-[2.5rem] p-5 sm:p-8 border-white/5 space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-luxury-gold/10 rounded-xl"><LayoutDashboard className="w-5 h-5 text-luxury-gold" /></div>
          <div>
            <h2 className="text-2xl font-serif text-white">Founder dashboard</h2>
            <p className="text-xs text-white/40">Only you can see this.</p>
          </div>
        </div>
        {error && <p className="text-xs text-red-400">Could not load users: {error}</p>}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {tile(<Users className="w-3.5 h-3.5" />, 'Users', stats.users, `+${stats.newUsers} this week · ${stats.teachers} teachers`)}
          {tile(<FileText className="w-3.5 h-3.5" />, 'Materials', stats.materials, `+${stats.newMaterials} this week`)}
          {tile(<School className="w-3.5 h-3.5" />, 'Active schools', stats.schools, `${stats.classes} classes`)}
          {tile(<Layers className="w-3.5 h-3.5" />, 'Collections', stats.collections, `${stats.openRequests} open requests`)}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {tile(<UserX className="w-3.5 h-3.5" />, 'Signed up, never shared', stats.silent.length, `${stats.noSchool} never finished setup`)}
          {tile(<AlertTriangle className="w-3.5 h-3.5" />, 'Broken or private links', stats.brokenLinks)}
          {tile(<HandHelping className="w-3.5 h-3.5" />, 'Materials without subject', stats.withoutSubject)}
        </div>

        <PendingTeachers />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="glass-panel rounded-[1.5rem] p-5 border-white/5 space-y-3">
          <p className="text-[10px] uppercase tracking-widest text-white/40">Most active schools</p>
          {stats.topSchools.length === 0 ? <p className="text-xs text-white/40">No school yet.</p> : stats.topSchools.map(s => (
            <div key={s.name} className="flex items-center justify-between gap-3 text-sm">
              <span className="text-white/80 truncate">{s.name}</span>
              <span className="text-white/50 shrink-0">{s.count}{s.week ? <span className="text-emerald-300"> +{s.week}</span> : null}</span>
            </div>
          ))}
        </div>
        <div className="glass-panel rounded-[1.5rem] p-5 border-white/5 space-y-3">
          <p className="text-[10px] uppercase tracking-widest text-white/40">Recent sign-ups who never shared</p>
          {stats.silent.slice(0, 10).map(u => (
            <div key={u.uid} className="flex items-center justify-between gap-3 text-sm">
              <span className="text-white/80 truncate">{u.displayName || 'Unnamed'}<span className="text-white/35"> · {u.schoolName || 'no school yet'}</span></span>
              <span className="text-[11px] text-white/40 shrink-0">{u.createdAtDate ? formatDistanceToNow(u.createdAtDate, { addSuffix: true }) : ''}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
