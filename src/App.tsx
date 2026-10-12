import React, { useEffect, useState } from 'react';
import { signInWithGoogle, logOut } from './firebase';
import { BookOpen, LogOut, LogIn, Library, User as UserIcon, Trash2, HandHelping } from 'lucide-react';
import MaterialList from './components/MaterialList';
import RequestBoard from './components/RequestBoard';
import CursorGlow from './components/CursorGlow';
import UserAvatar from './components/UserAvatar';
import OnboardingModal from './components/OnboardingModal';
import AuthorProfileModal from './components/AuthorProfileModal';
import { motion, useScroll, useTransform } from 'motion/react';
import { useAppData } from './context/AppData';
import { isProfileComplete } from './lib/schoolYear';
import { cn } from './lib/utils';

type Tab = 'archive' | 'requests' | 'personal' | 'trash';

const TITLES: Record<Tab, string> = {
  archive: 'The Archive',
  requests: 'Requests',
  personal: 'My Space',
  trash: 'Trash',
};

export default function App() {
  const { user, isAuthReady, profile, isProfileLoaded, userRole, getStats } = useAppData();
  const [activeTab, setActiveTab] = useState<Tab>('archive');
  const [isOwnProfileOpen, setIsOwnProfileOpen] = useState(false);

  const { scrollY } = useScroll();
  const titleOpacity = useTransform(scrollY, [0, 200], [1, 0]);
  const titleScale = useTransform(scrollY, [0, 250], [1, 0.8]);
  const titleFilter = useTransform(scrollY, [0, 200], ["blur(0px)", "blur(10px)"]);
  const titleY = useTransform(scrollY, [0, 250], [0, -40]);

  useEffect(() => {
    // Reset scroll when switching tabs so the title appears
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [activeTab]);

  useEffect(() => {
    // My Space and Trash are only reachable while signed in.
    if (isAuthReady && !user && (activeTab === 'personal' || activeTab === 'trash')) setActiveTab('archive');
    if (!user) setIsOwnProfileOpen(false);
  }, [user, isAuthReady, activeTab]);

  if (!isAuthReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-luxury-black">
        <div className="w-16 h-16 border-t-2 border-luxury-gold rounded-full animate-spin" />
      </div>
    );
  }

  const tabs: { id: Tab; label: string; icon: React.ReactNode; signedInOnly: boolean }[] = [
    { id: 'archive', label: 'Archive', icon: <Library className="w-3.5 h-3.5 sm:w-4 sm:h-4" />, signedInOnly: false },
    { id: 'requests', label: 'Requests', icon: <HandHelping className="w-3.5 h-3.5 sm:w-4 sm:h-4" />, signedInOnly: false },
    { id: 'personal', label: 'My Space', icon: <UserIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />, signedInOnly: true },
    { id: 'trash', label: 'Trash', icon: <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />, signedInOnly: true },
  ];
  const visibleTabs = tabs.filter(t => !t.signedInOnly || user);

  const tabClass = (id: Tab) => cn(
    'flex items-center justify-center gap-1.5 sm:gap-2 rounded-full transition-all uppercase font-medium',
    activeTab === id
      ? id === 'trash' ? 'bg-red-400 text-luxury-black shadow-lg shadow-red-400/20' : 'bg-luxury-gold text-luxury-black shadow-lg shadow-luxury-gold/20'
      : 'text-white/40 hover:text-white'
  );

  const needsOnboarding = !!user && isProfileLoaded && !!profile && !isProfileComplete(profile);
  const myImpact = getStats(user?.uid).impact;

  return (
    <div className="min-h-screen bg-luxury-black font-sans text-white/90 selection:bg-luxury-gold/30 overflow-x-hidden">
      <CursorGlow />

      <motion.nav
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ type: "spring", damping: 20, stiffness: 100 }}
        className="sticky top-0 z-40 bg-luxury-black/60 backdrop-blur-2xl border-b border-white/10"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-20">
            <button onClick={() => setActiveTab('archive')} className="flex items-center gap-3 sm:gap-4">
              <div className="w-10 h-10 border border-white/20 rounded-full flex items-center justify-center bg-white/5">
                <BookOpen className="h-5 w-5 text-luxury-gold" />
              </div>
              <span className="text-xl sm:text-2xl font-serif tracking-widest uppercase text-white">SchoolHub</span>
            </button>

            <div className="flex items-center gap-4 sm:gap-6">
              <div className="hidden md:flex items-center bg-white/5 rounded-full p-1 border border-white/10">
                {visibleTabs.map(tab => (
                  <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={cn(tabClass(tab.id), 'px-5 py-2 text-[10px] tracking-[0.2em]')}>
                    {tab.icon}
                    {tab.label}
                  </button>
                ))}
              </div>

              {user ? (
                <div className="flex items-center gap-4">
                  <button onClick={() => setIsOwnProfileOpen(true)} title="Your profile">
                    <UserAvatar
                      name={user.displayName || 'User'}
                      photoUrl={user.photoURL || undefined}
                      contributionCount={myImpact}
                      customColor={profile?.customColor}
                      size="md"
                      isClickable
                    />
                  </button>
                  <button onClick={logOut} className="text-white/40 hover:text-white transition-colors" title="Sign out">
                    <LogOut className="h-5 w-5" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={signInWithGoogle}
                  className="luxury-button bg-white text-luxury-black font-medium shadow-xl shadow-white/5"
                >
                  <span className="flex items-center gap-2">
                    <LogIn className="h-4 w-4" />
                    Sign in
                  </span>
                </button>
              )}
            </div>
          </div>
        </div>
      </motion.nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-32">
        <div className="relative h-[20vh] sm:h-[25vh] flex items-center justify-center pointer-events-none">
          <motion.div
            style={{ opacity: titleOpacity, scale: titleScale, y: titleY, filter: titleFilter }}
            className="fixed top-[11vh] sm:top-[12vh] left-0 right-0 z-0 text-center px-4"
          >
            <div className="overflow-hidden mb-4">
              <h1 className="text-5xl sm:text-6xl md:text-8xl font-serif font-light text-white tracking-tight flex justify-center flex-wrap">
                {TITLES[activeTab].split("").map((char, index) => (
                  <motion.span
                    key={`${activeTab}-${index}`}
                    initial={{ y: 100, opacity: 0, filter: "blur(10px)" }}
                    animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
                    transition={{ duration: 1.2, delay: 0.3 + index * 0.05, ease: [0.22, 1, 0.36, 1] }}
                    className={char === " " ? "mr-4" : ""}
                  >
                    {char}
                  </motion.span>
                ))}
              </h1>
            </div>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: 120 }}
              transition={{ delay: 1.2, duration: 1.5, ease: "easeInOut" }}
              className="h-px bg-luxury-gold/50 mx-auto mb-6"
            />
            <motion.p
              initial={{ opacity: 0, letterSpacing: "0.5em" }}
              animate={{ opacity: 1, letterSpacing: "0.3em" }}
              transition={{ delay: 1.8, duration: 1.5 }}
              className="text-luxury-gold font-light max-w-lg mx-auto uppercase text-[10px]"
            >
              By Samuel K.
            </motion.p>
          </motion.div>
        </div>

        {/* Phone tab bar */}
        <div className="md:hidden flex justify-center mb-6 relative z-20">
          <div className="flex items-center bg-white/5 rounded-full p-1 border border-white/10 w-full max-w-md">
            {visibleTabs.map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={cn(tabClass(tab.id), 'flex-1 py-3 text-[9px] tracking-[0.08em]')}>
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="relative z-10 bg-luxury-black pt-0 shadow-[0_-50px_100px_rgba(0,0,0,0.9)]">
          {activeTab === 'requests' ? (
            <RequestBoard />
          ) : (
            <MaterialList userRole={userRole} view={activeTab} onViewChange={(v) => setActiveTab(v)} />
          )}
        </div>
      </main>

      {isOwnProfileOpen && user && (
        <AuthorProfileModal
          isOpen
          onClose={() => setIsOwnProfileOpen(false)}
          authorId={user.uid}
          authorName={user.displayName || 'You'}
          authorPhotoUrl={user.photoURL || undefined}
          userRole={userRole}
        />
      )}

      {needsOnboarding && profile && <OnboardingModal profile={profile} mode="setup" />}
    </div>
  );
}
