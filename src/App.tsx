import React, { useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, signInWithGoogle, logOut, db } from './firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { BookOpen, LogOut, Plus, LogIn } from 'lucide-react';
import MaterialList from './components/MaterialList';
import UploadModal from './components/UploadModal';
import CursorGlow from './components/CursorGlow';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setIsAuthReady(true);

      if (currentUser) {
        // Create user profile in Firestore if it doesn't exist
        const userRef = doc(db, 'users', currentUser.uid);
        try {
          const userSnap = await getDoc(userRef);
          if (!userSnap.exists()) {
            const newUser = {
              uid: currentUser.uid,
              email: currentUser.email,
              displayName: currentUser.displayName,
              photoURL: currentUser.photoURL,
              role: 'user', // Default role
              createdAt: serverTimestamp()
            };
            await setDoc(userRef, newUser);
            setUserRole('user');
          } else {
            setUserRole(userSnap.data()?.role || 'user');
          }
        } catch (error) {
          console.error('Error checking/creating user profile:', error);
          setUserRole('user'); // Fallback
        }
      } else {
        setUserRole(null);
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
              {user ? (
                <>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setIsUploadModalOpen(true)}
                    className="luxury-button bg-white/5 text-white border border-white/10 hover:border-luxury-gold/50 transition-all"
                  >
                    <div className="flex items-center gap-2">
                      <Plus className="h-4 w-4" />
                      <span className="hidden sm:inline">Add Material</span>
                    </div>
                  </motion.button>
                  <div className="flex items-center gap-4 border-l border-white/10 pl-6">
                    <motion.div 
                      whileHover={{ scale: 1.1 }}
                      className="relative group cursor-pointer"
                    >
                      <img
                        className="h-9 w-9 rounded-full border border-white/20 p-0.5 transition-transform group-hover:border-luxury-gold/50"
                        src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}`}
                        alt={user.displayName || 'User'}
                        referrerPolicy="no-referrer"
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
              {"The Archive".split("").map((char, index) => (
                <motion.span
                  key={index}
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

        <MaterialList userRole={userRole} />
      </main>

      {/* Modals */}
      <UploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
      />
    </div>
  );
}
