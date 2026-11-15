import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { collection, doc, onSnapshot, serverTimestamp, updateDoc as updateDocUnguarded } from 'firebase/firestore';
import { deleteDoc, setDoc } from '../lib/firestoreWrites';
import { auth, db } from '../firebase';
import type { Collection, Material, MaterialRequest, User } from '../types';
import { mapCollectionDoc, mapMaterialDoc, mapRequestDoc } from '../lib/mappers';
import { computeStats, EMPTY_STATS, UserStats } from '../lib/stats';
import { loadSimulation, saveSimulation, setSimulationActive, SIMULATION_OFF, type Simulation } from '../lib/simulation';
import { schoolYearStart } from '../lib/schoolYear';
import { toDate } from '../lib/utils';

// The founder's account always has full admin rights, whatever its stored role.
export const ADMIN_EMAIL = 'sem.gk01@gmail.com';

interface AppDataValue {
  /** Who the app shows: the signed-in user, or nobody while the founder views as a visitor. */
  user: FirebaseUser | null;
  isAuthReady: boolean;
  /** The signed-in user's profile document, live. */
  profile: User | null;
  isProfileLoaded: boolean;
  userRole: string | null;
  /** Every material, including trashed ones. Views filter as needed. */
  materials: Material[];
  isMaterialsLoading: boolean;
  materialsError: string | null;
  requests: MaterialRequest[];
  /** Shared themes and projects, excluding deleted ones. */
  collections: Collection[];
  /** Materials the signed-in user marked as studied (private). */
  studied: Set<string>;
  toggleStudied: (materialId: string) => Promise<void>;
  statsByUser: Record<string, UserStats>;
  getStats: (uid: string | undefined | null) => UserStats;
  /** The founder's own account (true even while viewing as someone else). */
  isFounder: boolean;
  /** Founder-only "view as"; display only, writes are refused while on. */
  simulation: Simulation;
  setSimulation: (simulation: Simulation) => void;
}

const AppDataContext = createContext<AppDataValue | null>(null);

export function AppDataProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [profile, setProfile] = useState<User | null>(null);
  const [isProfileLoaded, setIsProfileLoaded] = useState(false);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [isMaterialsLoading, setIsMaterialsLoading] = useState(true);
  const [materialsError, setMaterialsError] = useState<string | null>(null);
  const [requests, setRequests] = useState<MaterialRequest[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
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

  // One listener for all materials, shared by every view (materials are public).
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'materials'), (snapshot) => {
      const list = snapshot.docs.map(d => mapMaterialDoc(d.id, d.data()));
      list.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      setMaterials(list);
      setMaterialsError(null);
      setIsMaterialsLoading(false);
    }, (error) => {
      console.error('Materials snapshot error:', error);
      setMaterialsError(error.message);
      setIsMaterialsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Requests are public too; they feed both the request board and the ranks.
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'requests'), (snapshot) => {
      const list = snapshot.docs.map(d => mapRequestDoc(d.id, d.data()));
      list.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      setRequests(list);
    }, (error) => {
      console.error('Requests snapshot error:', error);
    });
    return () => unsubscribe();
  }, []);

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

  // Collections are public; the archive groups works by them.
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'collections'), (snapshot) => {
      const list = snapshot.docs.map(d => mapCollectionDoc(d.id, d.data())).filter(c => !c.isDeleted);
      list.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      setCollections(list);
    }, (error) => {
      console.error('Collections snapshot error:', error);
    });
    return () => unsubscribe();
  }, []);

  const statsByUser = useMemo(() => computeStats(materials, requests, collections), [materials, requests, collections]);

  const isFounder = !!user && user.email === ADMIN_EMAIL;
  const effectiveSimulation = isFounder ? simulation : SIMULATION_OFF;
  const simulating = effectiveSimulation.mode !== 'off';
  // Set during render so the write guard is on before any child can write.
  setSimulationActive(simulating);

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

  const value = useMemo<AppDataValue>(() => ({
    user: viewUser,
    isAuthReady,
    profile: viewProfile,
    isProfileLoaded,
    userRole: viewRole,
    materials,
    isMaterialsLoading,
    materialsError,
    requests,
    collections,
    studied: viewUser ? studied : new Set<string>(),
    toggleStudied: async (materialId: string) => {
      if (!viewUser) return;
      const ref = doc(db, 'users', user.uid, 'studied', materialId);
      if (studied.has(materialId)) await deleteDoc(ref);
      else await setDoc(ref, { createdAt: serverTimestamp() });
    },
    statsByUser,
    getStats: (uid) => (uid && statsByUser[uid]) || EMPTY_STATS,
    isFounder,
    simulation: effectiveSimulation,
    setSimulation: (next: Simulation) => {
      saveSimulation(next);
      setSimulationState(next);
    },
  }), [viewUser, isAuthReady, viewProfile, isProfileLoaded, viewRole, materials, isMaterialsLoading, materialsError, requests, collections, studied, statsByUser, isFounder, effectiveSimulation]);

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData(): AppDataValue {
  const value = useContext(AppDataContext);
  if (!value) throw new Error("useAppData must be used inside AppDataProvider");
  return value;
}
