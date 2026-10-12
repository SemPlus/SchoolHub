import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { collection, doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import type { Material, MaterialRequest, User } from '../types';
import { mapMaterialDoc, mapRequestDoc } from '../lib/mappers';
import { computeStats, EMPTY_STATS, UserStats } from '../lib/stats';

const ADMIN_EMAIL = 'sem.gk01@gmail.com';

interface AppDataValue {
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
  statsByUser: Record<string, UserStats>;
  getStats: (uid: string | undefined | null) => UserStats;
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

  const statsByUser = useMemo(() => computeStats(materials, requests), [materials, requests]);

  const value = useMemo<AppDataValue>(() => ({
    user,
    isAuthReady,
    profile,
    isProfileLoaded,
    userRole: user ? (profile?.role ?? (user.email === ADMIN_EMAIL ? 'admin' : 'user')) : null,
    materials,
    isMaterialsLoading,
    materialsError,
    requests,
    statsByUser,
    getStats: (uid) => (uid && statsByUser[uid]) || EMPTY_STATS,
  }), [user, isAuthReady, profile, isProfileLoaded, materials, isMaterialsLoading, materialsError, requests, statsByUser]);

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData(): AppDataValue {
  const value = useContext(AppDataContext);
  if (!value) throw new Error('useAppData must be used inside AppDataProvider');
  return value;
}
