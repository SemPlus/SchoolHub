import React, { useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, signInWithGoogle, logOut, db } from './firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { BookOpen, LogOut, Plus, LogIn, Library, User as UserIcon, Trash2 } from 'lucide-react';
import MaterialList from './components/MaterialList';
import CursorGlow from './components/CursorGlow';
import UserAvatar from './components/UserAvatar';
import { motion, AnimatePresence } from 'motion/react';
import { collection, query, where, getDocs, onSnapshot } from 'firebase/firestore';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userContributions, setUserContributions] = useState(0);
  const [userCustomColor, setUserCustomColor] = useState<string | undefined>();
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [activeTab, setActiveTab] = useState<'archive' | 'personal' | 'trash'>('archive');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setIsAuthReady(true);

      if (currentUser) {
        // Create/Update user profile and subscribe to changes
        const userRef = doc(db, 'users', currentUser.uid);
        
        // Real-time user profile for customization
        const unsubProfile = onSnapshot(userRef, (doc) => {
          if (doc.exists()) {
            const data = doc.data();
            setUserRole(data.role || 'user');
            setUserCustomColor(data.customColor);
          } else {
            // Create user profile if it doesn't exist
            const role = currentUser.email === 'sem.gk01@gmail.com' ? 'admin' : 'user';
            const newUser = {
              uid: currentUser.uid,
              email: currentUser.email,
              displayName: currentUser.displayName,
              photoURL: currentUser.photoURL,
              role: role,
              createdAt: serverTimestamp()
            };
            setDoc(userRef, newUser).catch(err => console.error("Error setting user profile:", err));
            setUserRole(role);
          }
        }, (error) => {
          console.error("Profile snapshot error:", error);
        });

        // Real-time material count for rank
        const q = query(collection(db, 'materials'), where('authorId', '==', currentUser.uid));
        const unsubMaterials = onSnapshot(q, (snapshot) => {
          setUserContributions(snapshot.size);
        }, (error) => {
          console.error("Material count snapshot error:", error);
        });

        return () => {
          unsubProfile();
          unsubMaterials();
        };
      } else {
        setUserRole(null);
        setUserContributions(0);
        setUserCustomColor(undefined);
      }
    });
    return () => unsubscribe();
  }, []);

  if (!isAuthReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-luxury-black">
        <motion.div 
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative"
        >
          <div className="absolute inset-0 bg-luxury-gold/20 rounded-full blur-3xl animate-pulse"></div>
          <div className="w-16 h-16 border-t-2 border-luxury-gold rounded-full animate-spin relative z-10"></div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-luxury-black font-sans text-white/90 selection:bg-luxury-gold/30 overflow-x-hidden">
      <CursorGlow />
      {/* Navigation */}
      <motion.nav 
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ type: "spring", damping: 20, stiffness: 100 }}
        className="sticky top-0 z-40 bg-luxury-black/60 backdrop-blur-2xl border-b border-white/10 shadow-[0_4px_30px_rgba(0,0,0,0.1)]"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-20">
            <motion.div 
              whileHover={{ scale: 1.02 }}
              className="flex items-center gap-4 cursor-pointer"
            >
              <div className="w-10 h-10 border border-white/20 rounded-full flex items-center justify-center bg-white/5">
                <BookOpen className="h-5 w-5 text-luxury-gold" />
              </div>
              <span className="text-2xl font-serif tracking-widest uppercase text-white">
                SchoolHub
              </span>
            </motion.div>
            
            <div className="flex items-center gap-6">
              {user && (
                <div className="flex items-center bg-white/5 rounded-full p-1 border border-white/10 hidden md:flex">
                  <button
                    onClick={() => setActiveTab('archive')}
                    className={`flex items-center gap-2 px-6 py-2 rounded-full transition-all text-[10px] uppercase tracking-[0.2em] font-medium ${activeTab === 'archive' ? 'bg-luxury-gold text-luxury-black shadow-lg shadow-luxury-gold/20' : 'text-white/40 hover:text-white'}`}
                  >
                    <Library className="w-3.5 h-3.5" />
                    Archive
                  </button>
                  <button
                    onClick={() => setActiveTab('personal')}
                    className={`flex items-center gap-2 px-6 py-2 rounded-full transition-all text-[10px] uppercase tracking-[0.2em] font-medium ${activeTab === 'personal' ? 'bg-luxury-gold text-luxury-black shadow-lg shadow-luxury-gold/20' : 'text-white/40 hover:text-white'}`}
                  >
                    <UserIcon className="w-3.5 h-3.5" />
                    Personal
                  </button>
                  <button
                    onClick={() => setActiveTab('trash')}
                    className={`flex items-center gap-2 px-6 py-2 rounded-full transition-all text-[10px] uppercase tracking-[0.2em] font-medium ${activeTab === 'trash' ? 'bg-red-400 text-luxury-black shadow-lg shadow-red-400/20' : 'text-white/40 hover:text-white'}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Trash
                  </button>
                </div>
              )}
              
              <div className="flex items-center gap-6">
                {user ? (
                <>
                  <div className="flex items-center gap-4">
                    <motion.div 
                      whileHover={{ scale: 1.1 }}
                      className="relative group cursor-pointer"
                    >
                      <UserAvatar
                        name={user.displayName || 'User'}
                        photoUrl={user.photoURL || undefined}
                        contributionCount={userContributions}
                        customColor={userCustomColor}
                        size="md"
                      />
                    </motion.div>
                    <motion.button
                      whileHover={{ scale: 1.1, color: '#fff' }}
                      onClick={logOut}
                      className="text-white/40 transition-colors"
                      title="Sign out"
                    >
                      <LogOut className="h-5 w-5" />
                    </motion.button>
                  </div>
                </>
              ) : (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={signInWithGoogle}
                  className="luxury-button bg-white text-luxury-black font-medium shadow-xl shadow-white/5"
                >
                  <div className="flex items-center gap-2">
                    <LogIn className="h-4 w-4" />
                    Sign in
                  </div>
                </motion.button>
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-16 text-center"
        >
          <div className="overflow-hidden mb-4">
            <motion.h1 
              className="text-6xl md:text-8xl font-serif font-light text-white tracking-tight flex justify-center flex-wrap"
            >
              {(activeTab === 'archive' ? "The Archive" : activeTab === 'personal' ? "Personal Space" : "The Depths").split("").map((char, index) => (
                <motion.span
                  key={`${activeTab}-${index}`}
                  initial={{ y: 100, opacity: 0, filter: "blur(10px)" }}
                  animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
                  transition={{
                    duration: 1.2,
                    delay: 0.3 + index * 0.05,
                    ease: [0.22, 1, 0.36, 1]
                  }}
                  className={char === " " ? "mr-4" : ""}
                >
                  {char}
                </motion.span>
              ))}
            </motion.h1>
          </div>
          
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: 120 }}
            transition={{ delay: 1.2, duration: 1.5, ease: "easeInOut" }}
            className="h-px bg-luxury-gold/50 mx-auto mb-6"
          ></motion.div>
          
          <motion.p 
            initial={{ opacity: 0, letterSpacing: "0.5em" }}
            animate={{ opacity: 1, letterSpacing: "0.3em" }}
            transition={{ delay: 1.8, duration: 1.5 }}
            className="text-luxury-gold font-light max-w-lg mx-auto uppercase text-[10px]"
          >
            By Samuel K.
          </motion.p>
        </motion.div>

        <MaterialList userRole={userRole} view={activeTab} onViewChange={setActiveTab} />
      </main>
    </div>
  );
}
