import React, { useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, signInWithGoogle, logOut } from './firebase';
import { BookOpen, LogOut, Plus, LogIn } from 'lucide-react';
import MaterialList from './components/MaterialList';
import UploadModal from './components/UploadModal';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  if (!isAuthReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-luxury-black font-sans text-white/90 selection:bg-luxury-gold/30">
      {/* Navigation */}
      <nav className="border-b border-white/5 sticky top-0 z-40 bg-luxury-black/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-20">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 border border-white/20 rounded-full flex items-center justify-center">
                <BookOpen className="h-5 w-5 text-luxury-gold" />
              </div>
              <span className="text-2xl font-serif tracking-widest uppercase text-white">
                SchoolHub
              </span>
            </div>
            
            <div className="flex items-center gap-6">
              {user ? (
                <>
                  <button
                    onClick={() => setIsUploadModalOpen(true)}
                    className="luxury-button bg-white/5 text-white"
                  >
                    <div className="flex items-center gap-2">
                      <Plus className="h-4 w-4" />
                      <span className="hidden sm:inline">Add Material</span>
                    </div>
                  </button>
                  <div className="flex items-center gap-4 border-l border-white/10 pl-6">
                    <div className="relative group">
                      <img
                        className="h-9 w-9 rounded-full border border-white/20 p-0.5 transition-transform group-hover:scale-105"
                        src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}`}
                        alt={user.displayName || 'User'}
                      />
                    </div>
                    <button
                      onClick={logOut}
                      className="text-white/40 hover:text-white transition-colors"
                      title="Sign out"
                    >
                      <LogOut className="h-5 w-5" />
                    </button>
                  </div>
                </>
              ) : (
                <button
                  onClick={signInWithGoogle}
                  className="luxury-button bg-white text-luxury-black font-medium"
                >
                  <div className="flex items-center gap-2">
                    <LogIn className="h-4 w-4" />
                    Sign in
                  </div>
                </button>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-16 text-center">
          <h1 className="text-6xl md:text-7xl font-serif font-light text-white mb-4 tracking-tight">
            The Archive
          </h1>
          <div className="w-24 h-px bg-luxury-gold/50 mx-auto mb-6"></div>
          <p className="text-white/50 font-light tracking-wide max-w-lg mx-auto uppercase text-xs">
            A curated collection of academic excellence and shared knowledge.
          </p>
        </div>

        <MaterialList />
      </main>

      {/* Modals */}
      <UploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
      />
    </div>
  );
}
