import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import {
  collection, doc, documentId, getDoc, getDocs, limit, onSnapshot, orderBy, query, serverTimestamp, startAfter, where,
  updateDoc as updateDocUnguarded, setDoc as setDocUnguarded,
  type Query, type QueryConstraint, type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { deleteDoc, setDoc } from '../lib/firestoreWrites';
import { auth, db } from '../firebase';
import type { Collection, Material, MaterialRequest, User } from '../types';
import { mapCollectionDoc, mapMaterialDoc, mapRequestDoc } from '../lib/mappers';
import { computeStats, EMPTY_STATS, UserStats } from '../lib/stats';
import { loadSimulation, saveSimulation, setSimulationActive, SIMULATION_OFF, type Simulation } from '../lib/simulation';
import { schoolYearStart } from '../lib/schoolYear';
import { toDate } from '../lib/utils';
import { isAuthorOf, retiredMaterialIds, themeKey } from '../lib/lots';
import { isModHidden } from '../lib/moderation';
import { loadAdminSchoolId, recordWeeklyActivity } from '../lib/schoolPanel';

// The founder's account always has full admin rights, whatever its stored role.
export const ADMIN_EMAIL = 'sem.gk01@gmail.com';

/** Materials from other schools load this many at a time. */
const FEED_PAGE = 30;
/** Latest requests and collections from every school, kept live. */
const RECENT_REQUESTS = 100;
const RECENT_COLLECTIONS = 60;
/** A one-off fetch is not repeated within this time. */
const FETCH_FRESH_MS = 60_000;

export interface FeedState {
  /** The first page was asked for. */
  started: boolean;
  loading: boolean;
  hasMore: boolean;
}

interface AppDataValue {
  /** Who the app shows: the signed-in user, or nobody while the founder views as a visitor. */
  user: FirebaseUser | null;
  isAuthReady: boolean;
  /** The signed-in user's profile document, live. */
  profile: User | null;
  isProfileLoaded: boolean;
  userRole: string | null;
  /**
   * Materials loaded so far, including trashed ones. Live: the user's own and
   * their school's. On demand: pages from every school, search results,
   * saved materials, folders, books, authors and collections opened.
   */
  materials: Material[];
  isMaterialsLoading: boolean;
  materialsError: string | null;
  /** Pages of materials from every school, newest first. */
  feed: FeedState;
  loadMoreFeed: () => Promise<void>;
  /** Loads the materials matching a query once (repeat calls within a minute do nothing). */
  fetchMaterials: (key: string, ...constraints: QueryConstraint[]) => Promise<void>;
  /** Loads materials by id that are not loaded yet. */
  ensureMaterials: (ids: Iterable<string>) => Promise<void>;
  /** The user's and their school's requests, plus the latest from everywhere. */
  requests: MaterialRequest[];
  /** Shared themes and projects, excluding deleted ones (same reach as requests). */
  collections: Collection[];
  ensureCollection: (id: string) => Promise<void>;
  /** Lot works that have left the archive; their authors still see them in My Space. */
  retiredIds: Set<string>;
  /** Materials the signed-in user marked as studied (private). */
  studied: Set<string>;
  toggleStudied: (materialId: string) => Promise<void>;
  /** Impact from what is loaded; exact for the user's school, partial elsewhere (see useUserStats). */
  getStats: (uid: string | undefined | null) => UserStats;
  /** The founder's own account (true even while viewing as someone else). */
  isFounder: boolean;
  /** The school this user administers (principal, vice-principal, digital lead), if any. */
  adminSchoolId: string | null;
  /** Founder-only "view as"; display only, writes are refused while on. */
  simulation: Simulation;
  setSimulation: (simulation: Simulation) => void;
}

const AppDataContext = createContext<AppDataValue | null>(null);

type Sources<T> = Record<string, T[]>;

/** One list from several sources; earlier sources win (live ones go first). */
function merge<T extends { id: string; createdAt: Date }>(sources: Sources<T>, first: string[]): T[] {
  const byId = new Map<string, T>();
  const keys = [...first, ...Object.keys(sources).filter(k => !first.includes(k))];
  for (const key of keys) for (const item of sources[key] || []) if (!byId.has(item.id)) byId.set(item.id, item);
  return [...byId.values()].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

/** Keeps several live and one-off lists of the same kind, by key. */
function useSources<T>() {
  const [sources, setSources] = useState<Sources<T>>({});
  const set = useCallback((key: string, list: T[]) => setSources(prev => ({ ...prev, [key]: list })), []);
  const add = useCallback((key: string, list: T[]) => setSources(prev => ({ ...prev, [key]: [...(prev[key] || []), ...list] })), []);
  return [sources, set, add] as const;
}

/**
 * Live query feeding one source. `dep` names what the query depends on
 * (e.g. the school id); null means no query, and the source is emptied.
 */
function useLiveSource<T>(
  key: string,
  dep: string | null,
  build: () => Query,
  map: (id: string, data: any) => T,
  set: (key: string, list: T[]) => void,
  onFirst?: () => void,
) {
  useEffect(() => {
    if (dep === null) {
      set(key, []);
      onFirst?.();
      return;
    }
    const unsubscribe = onSnapshot(build(), snapshot => {
      set(key, snapshot.docs.map(d => map(d.id, d.data())));
      onFirst?.();
    }, error => {
      console.error(`Live ${key} error:`, error);
      onFirst?.();
    });
    return () => unsubscribe();
  }, [dep]);
}

export function AppDataProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [profile, setProfile] = useState<User | null>(null);
  const [isProfileLoaded, setIsProfileLoaded] = useState(false);
  const [materialsError, setMaterialsError] = useState<string | null>(null);
  const [studied, setStudied] = useState<Set<string>>(new Set());
  const [simulation, setSimulationState] = useState<Simulation>(loadSimulation);

  // Auth state and the signed-in user's profile.
  useEffect(() => {
    let unsubProfile: (() => void) | null = null;

    const unsubAuth = onAuthStateChanged(auth, (currentUser) => {
      unsubProfile?.();
      unsubProfile = null;
      setUser(currentUser);
      setIsAuthReady(true);
      setProfile(null);
      setIsProfileLoaded(false);

      if (!currentUser) return;

      const userRef = doc(db, 'users', currentUser.uid);
      unsubProfile = onSnapshot(userRef, (snapshot) => {
        if (snapshot.exists()) {
          setProfile({ uid: snapshot.id, ...(snapshot.data() as any) } as User);
          setIsProfileLoaded(true);
          return;
        }
        // First sign-in: create the profile. The snapshot fires again once it exists.
        setDoc(userRef, {
          uid: currentUser.uid,
          // The security rules require email to be a string.
          email: currentUser.email ?? '',
          displayName: currentUser.displayName,
          photoURL: currentUser.photoURL,
          role: currentUser.email === ADMIN_EMAIL ? 'admin' : 'user',
          createdAt: serverTimestamp(),
        }).catch(error => {
          console.error('Error creating user profile:', error);
          setIsProfileLoaded(true);
        });
      }, (error) => {
        console.error('Profile snapshot error:', error);
        setIsProfileLoaded(true);
      });
    });

    return () => {
      unsubAuth();
      unsubProfile?.();
    };
  }, []);

  // ------------------------------------------------------------ view-as

  const isFounder = !!user && user.email === ADMIN_EMAIL;
  const effectiveSimulation = isFounder ? simulation : SIMULATION_OFF;
  const simulating = effectiveSimulation.mode !== 'off';
  // Set during render so the write guard is on before any child can write.
  setSimulationActive(simulating);

  const viewUser = effectiveSimulation.mode === 'visitor' ? null : user;
  const viewProfile = useMemo<User | null>(() => {
    if (!profile || !simulating) return profile;
    const s = effectiveSimulation;
    if (s.mode === 'visitor') return null;
    const school = { schoolId: s.schoolId, schoolName: s.schoolName, schoolCity: s.schoolCity, schoolGrade: s.schoolGrade, profileSchoolYear: schoolYearStart() };
    if (s.mode === 'teacher') {
      return { ...profile, ...school, role: 'teacher', accountType: 'teacher', teacherClasses: s.teacherClasses || [], teacherSubjects: s.teacherSubjects || [], classYear: undefined, classSection: undefined };
    }
    return { ...profile, ...school, role: 'user', accountType: 'student', classYear: s.classYear, classSection: s.classSection, teacherClasses: undefined, teacherSubjects: undefined };
  }, [profile, simulating, effectiveSimulation]);
  const viewRole = !viewUser ? null
    : simulating ? (effectiveSimulation.mode === 'teacher' ? 'teacher' : 'user')
    : user!.email === ADMIN_EMAIL ? 'admin' : (profile?.role ?? 'user');

  // Whose data loads live: the viewed user and the viewed school.
  const uid = viewUser?.uid ?? null;
  const schoolId = viewProfile?.schoolId ?? null;
  const profileSettled = isAuthReady && (!user || isProfileLoaded);

  // ------------------------------------------------------------ materials

  const [materialSources, setMaterialSource, addMaterials] = useSources<Material>();
  const [schoolLoadedFor, setSchoolLoadedFor] = useState<string | null>(null);

  useLiveSource('mine', uid, () => query(collection(db, 'materials'), where('authorId', '==', uid)), mapMaterialDoc, setMaterialSource);
  // Group works where a classmate added this user.
  useLiveSource('coauthored', uid, () => query(collection(db, 'materials'), where('coAuthorIds', 'array-contains', uid)), mapMaterialDoc, setMaterialSource);
  useLiveSource(
    'school',
    schoolId,
    () => query(collection(db, 'materials'), where('schoolId', '==', schoolId)),
    mapMaterialDoc,
    setMaterialSource,
    () => setSchoolLoadedFor(schoolId),
  );

  const allMaterials = useMemo(() => merge(materialSources, ['mine', 'coauthored', 'school']), [materialSources]);
  const loadedIds = useRef(new Set<string>());
  loadedIds.current = new Set(allMaterials.map(m => m.id));

  // Pages from every school, newest first.
  const feedCursor = useRef<QueryDocumentSnapshot | null>(null);
  const feedBusy = useRef(false);
  const [feed, setFeed] = useState<FeedState>({ started: false, loading: false, hasMore: true });
  const loadMoreFeed = useCallback(async () => {
    if (feedBusy.current) return;
    feedBusy.current = true;
    setFeed(f => ({ ...f, started: true, loading: true }));
    try {
      const page = await getDocs(query(
        collection(db, 'materials'),
        orderBy('createdAt', 'desc'),
        ...(feedCursor.current ? [startAfter(feedCursor.current)] : []),
        limit(FEED_PAGE),
      ));
      if (page.docs.length) feedCursor.current = page.docs[page.docs.length - 1];
      addMaterials('feed', page.docs.map(d => mapMaterialDoc(d.id, d.data())));
      setFeed({ started: true, loading: false, hasMore: page.docs.length === FEED_PAGE });
      setMaterialsError(null);
    } catch (error: any) {
      console.error('Feed error:', error);
      setMaterialsError(error?.message || String(error));
      setFeed(f => ({ ...f, loading: false }));
    } finally {
      feedBusy.current = false;
    }
  }, [addMaterials]);

  // Without a school there is nothing live to show, so the first page loads at once.
  useEffect(() => {
    if (profileSettled && !schoolId && !feed.started) loadMoreFeed();
  }, [profileSettled, schoolId, feed.started, loadMoreFeed]);

  const fetchedAt = useRef(new Map<string, number>());
  const fetchMaterials = useCallback(async (key: string, ...constraints: QueryConstraint[]) => {
    const last = fetchedAt.current.get(key);
    if (last && Date.now() - last < FETCH_FRESH_MS) return;
    fetchedAt.current.set(key, Date.now());
    try {
      const snapshot = await getDocs(query(collection(db, 'materials'), ...constraints));
      setMaterialSource(key, snapshot.docs.map(d => mapMaterialDoc(d.id, d.data())));
    } catch (error) {
      fetchedAt.current.delete(key);
      console.error(`Could not load materials (${key}):`, error);
    }
  }, [setMaterialSource]);

  const ensureMaterials = useCallback(async (ids: Iterable<string>) => {
    const missing = [...new Set(ids)].filter(id => id && !loadedIds.current.has(id));
    for (let i = 0; i < missing.length; i += 30) {
      const chunk = missing.slice(i, i + 30);
      chunk.forEach(id => loadedIds.current.add(id));
      try {
        const snapshot = await getDocs(query(collection(db, 'materials'), where(documentId(), 'in', chunk)));
        addMaterials('ids', snapshot.docs.map(d => mapMaterialDoc(d.id, d.data())));
      } catch (error) {
        chunk.forEach(id => loadedIds.current.delete(id));
        console.error('Could not load materials by id:', error);
      }
    }
  }, [addMaterials]);

  const isMaterialsLoading = !profileSettled || (schoolId ? schoolLoadedFor !== schoolId : !feed.started || (feed.loading && allMaterials.length === 0));

  // ------------------------------------------------------------ requests & collections

  const [requestSources, setRequestSource] = useSources<MaterialRequest>();
  useLiveSource('mine', uid, () => query(collection(db, 'requests'), where('authorId', '==', uid)), mapRequestDoc, setRequestSource);
  useLiveSource('school', schoolId, () => query(collection(db, 'requests'), where('schoolId', '==', schoolId)), mapRequestDoc, setRequestSource);
  useLiveSource('recent', 'all', () => query(collection(db, 'requests'), orderBy('createdAt', 'desc'), limit(RECENT_REQUESTS)), mapRequestDoc, setRequestSource);
  // Requests hidden after reports are shown only to their authors.
  const requests = useMemo(
    () => merge(requestSources, ['mine', 'school']).filter(r => !isModHidden(r) || r.authorId === uid),
    [requestSources, uid],
  );

  const [collectionSources, setCollectionSource, addCollections] = useSources<Collection>();
  useLiveSource('mine', uid, () => query(collection(db, 'collections'), where('createdBy', '==', uid)), mapCollectionDoc, setCollectionSource);
  useLiveSource('school', schoolId, () => query(collection(db, 'collections'), where('schoolId', '==', schoolId)), mapCollectionDoc, setCollectionSource);
  useLiveSource('recent', 'all', () => query(collection(db, 'collections'), orderBy('createdAt', 'desc'), limit(RECENT_COLLECTIONS)), mapCollectionDoc, setCollectionSource);
  const collections = useMemo(
    () => merge(collectionSources, ['mine', 'school']).filter(c => !c.isDeleted),
    [collectionSources],
  );
  const collectionIds = useRef(new Set<string>());
  collectionIds.current = new Set(merge(collectionSources, []).map(c => c.id));
  const ensureCollection = useCallback(async (id: string) => {
    if (!id || collectionIds.current.has(id)) return;
    collectionIds.current.add(id);
    try {
      const snapshot = await getDoc(doc(db, 'collections', id));
      if (snapshot.exists()) addCollections('ids', [mapCollectionDoc(snapshot.id, snapshot.data())]);
    } catch (error) {
      collectionIds.current.delete(id);
      console.error('Could not load collection:', error);
    }
  }, [addCollections]);

  // Lots decide which works stay in the archive, so the lots of loaded works
  // (from any school) and the other years of their themes are loaded too.
  const requestedCollections = useRef(new Set<string>());
  useEffect(() => {
    const missing = [...new Set(allMaterials.map(m => m.collectionId).filter((id): id is string =>
      !!id && !collectionIds.current.has(id) && !requestedCollections.current.has(id)))];
    if (missing.length === 0) return;
    missing.forEach(id => requestedCollections.current.add(id));
    (async () => {
      for (let i = 0; i < missing.length; i += 30) {
        const chunk = missing.slice(i, i + 30);
        try {
          const snapshot = await getDocs(query(collection(db, 'collections'), where(documentId(), 'in', chunk)));
          addCollections('ids', snapshot.docs.map(d => mapCollectionDoc(d.id, d.data())));
        } catch (error) {
          chunk.forEach(id => requestedCollections.current.delete(id));
          console.error('Could not load collections:', error);
        }
      }
    })();
  }, [allMaterials, addCollections]);

  const requestedThemes = useRef(new Set<string>());
  useEffect(() => {
    const themes = [...new Set(collections.filter(c => c.isLot).map(themeKey))].filter(k => !requestedThemes.current.has(k));
    if (themes.length === 0) return;
    themes.forEach(k => requestedThemes.current.add(k));
    (async () => {
      for (let i = 0; i < themes.length; i += 30) {
        const chunk = themes.slice(i, i + 30);
        try {
          const snapshot = await getDocs(query(collection(db, 'collections'), where('themeId', 'in', chunk)));
          addCollections('themes', snapshot.docs.map(d => mapCollectionDoc(d.id, d.data())));
        } catch (error) {
          chunk.forEach(k => requestedThemes.current.delete(k));
          console.error('Could not load themes:', error);
        }
      }
    })();
  }, [collections, addCollections]);

  // Works that left the archive, or that were hidden after reports, are shown only to their authors.
  const retiredIds = useMemo(() => retiredMaterialIds(collections, allMaterials), [collections, allMaterials]);
  const materials = useMemo(
    () => allMaterials.filter(m => (!retiredIds.has(m.id) && !isModHidden(m)) || isAuthorOf(m, uid)),
    [allMaterials, retiredIds, uid],
  );

  // ------------------------------------------------------------ studied & last seen

  // Private study checklist: users/{uid}/studied/{materialId}.
  useEffect(() => {
    if (!user) {
      setStudied(new Set());
      return;
    }
    const unsubscribe = onSnapshot(collection(db, 'users', user.uid, 'studied'), (snapshot) => {
      setStudied(new Set(snapshot.docs.map(d => d.id)));
    }, (error) => console.error('Studied snapshot error:', error));
    return () => unsubscribe();
  }, [user?.uid]);

  const statsByUser = useMemo(() => computeStats(materials, requests, collections), [materials, requests, collections]);

  // Class directory entry, so classmates can add this user to a group work.
  // Written only when it changes (remembered on this device).
  useEffect(() => {
    if (!user || !profile || simulating || !profile.schoolId) return;
    const entry = {
      uid: user.uid,
      displayName: (profile.displayName || user.displayName || '').slice(0, 100),
      photoURL: profile.photoURL || user.photoURL || null,
      schoolId: profile.schoolId,
      classYear: profile.classYear ?? null,
      classSection: profile.classSection ?? null,
      schoolYear: profile.profileSchoolYear ?? null,
      accountType: profile.accountType ?? null,
    };
    const signature = JSON.stringify(entry);
    const key = 'schoolhub.directory.' + user.uid;
    try { if (window.localStorage.getItem(key) === signature) return; } catch { /* storage blocked */ }
    setDocUnguarded(doc(db, 'directory', user.uid), { ...entry, updatedAt: serverTimestamp() })
      .then(() => { try { window.localStorage.setItem(key, signature); } catch { /* ignore */ } })
      .catch(error => console.warn('Could not update the class directory:', error));
  }, [user?.uid, profile?.schoolId, profile?.classYear, profile?.classSection, profile?.profileSchoolYear, profile?.accountType, profile?.displayName, simulating]);

  // Counted once a week as active for the school panel (totals per class only).
  useEffect(() => {
    if (!user || !profile?.schoolId || simulating) return;
    recordWeeklyActivity(user.uid, profile).catch(error => console.warn('Could not record weekly activity:', error));
  }, [user?.uid, profile?.schoolId, profile?.accountType, profile?.classYear, profile?.classSection, simulating]);

  // School admins are named by the founder, by e-mail.
  const [adminSchoolId, setAdminSchoolId] = useState<string | null>(null);
  useEffect(() => {
    setAdminSchoolId(null);
    if (!user?.email) return;
    let cancelled = false;
    loadAdminSchoolId(user.email)
      .then(id => { if (!cancelled) setAdminSchoolId(id); })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [user?.uid, user?.email]);

  // "Last seen" for the founder dashboard: at most one small write per day.
  const lastSeenWrittenFor = useRef<string | null>(null);
  useEffect(() => {
    if (!user || !profile || simulating || lastSeenWrittenFor.current === user.uid) return;
    const last = toDate(profile.lastSeenAt);
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    if (last && last >= startOfToday) return;
    lastSeenWrittenFor.current = user.uid;
    updateDocUnguarded(doc(db, 'users', user.uid), { lastSeenAt: serverTimestamp() })
      .catch(error => console.warn('Could not update last seen:', error));
  }, [user?.uid, profile?.uid, profile?.lastSeenAt, simulating]);

  const value = useMemo<AppDataValue>(() => ({
    user: viewUser,
    isAuthReady,
    profile: viewProfile,
    isProfileLoaded,
    userRole: viewRole,
    materials,
    isMaterialsLoading,
    materialsError,
    feed,
    loadMoreFeed,
    fetchMaterials,
    ensureMaterials,
    requests,
    collections,
    ensureCollection,
    retiredIds,
    studied: viewUser ? studied : new Set<string>(),
    toggleStudied: async (materialId: string) => {
      if (!viewUser) return;
      const ref = doc(db, 'users', viewUser.uid, 'studied', materialId);
      if (studied.has(materialId)) await deleteDoc(ref);
      else await setDoc(ref, { createdAt: serverTimestamp() });
    },
    getStats: (id) => (id && statsByUser[id]) || EMPTY_STATS,
    isFounder,
    adminSchoolId: simulating ? null : adminSchoolId,
    simulation: effectiveSimulation,
    setSimulation: (next: Simulation) => {
      saveSimulation(next);
      setSimulationState(next);
    },
  }), [viewUser, isAuthReady, viewProfile, isProfileLoaded, viewRole, materials, isMaterialsLoading, materialsError, feed, loadMoreFeed, fetchMaterials, ensureMaterials, requests, collections, ensureCollection, retiredIds, studied, statsByUser, isFounder, adminSchoolId, simulating, effectiveSimulation]);

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData(): AppDataValue {
  const value = useContext(AppDataContext);
  if (!value) throw new Error("useAppData must be used inside AppDataProvider");
  return value;
}
