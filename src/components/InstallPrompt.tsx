import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Share, PlusSquare, MoreVertical, X, Download, Check } from 'lucide-react';
import {
  canInstall, detectInstalledApp, hasInstallPrompt, installPlatform, isPhoneOrTablet, markInstalled,
  markSuggestedToday, onInstallChange, promptInstall, suggestedToday, type InstallPlatform,
} from '../lib/install';
import { t } from '../lib/i18n';

/** The few taps needed on browsers without an install window of their own. */
export function InstallSteps({ platform }: { platform: InstallPlatform }) {
  const step = (n: number, body: React.ReactNode) => (
    <li className="flex items-center gap-3">
      <span className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center shrink-0 text-xs font-bold text-white">{n}</span>
      <span>{body}</span>
    </li>
  );
  if (platform === 'mac-safari') {
    return (
      <ol className="space-y-3 text-sm text-white/80">
        {step(1, <>{t("In the Safari menu bar, open File.")}</>)}
        {step(2, <>{t("Choose \"Add to Dock\".")}</>)}
      </ol>
    );
  }
  if (platform === 'android-firefox') {
    return (
      <ol className="space-y-3 text-sm text-white/80">
        {step(1, <>{t("Open the menu")} <MoreVertical className="inline w-4 h-4 -mt-0.5" /></>)}
        {step(2, <>{t("Choose \"Install\".")}</>)}
      </ol>
    );
  }
  return (
    <ol className="space-y-3 text-sm text-white/80">
      {step(1, <>{t("Tap Share")} <Share className="inline w-4 h-4 mx-0.5 -mt-1" /> {t("in the browser bar.")}</>)}
      {step(2, <>{t("Choose \"Add to Home Screen\"")} <PlusSquare className="inline w-4 h-4 mx-0.5 -mt-1" /></>)}
      {step(3, <>{t("Tap \"Add\". SchoolHub appears among your apps.")}</>)}
    </ol>
  );
}

/**
 * Once per day the app is opened, and never once it is installed: a small
 * card suggesting to install SchoolHub. A bottom sheet on phones, a corner
 * card on computers.
 */
export default function InstallPrompt() {
  const [open, setOpen] = useState(false);
  const [showSteps, setShowSteps] = useState(false);
  const [, rerender] = useState(0);
  const platform = installPlatform();
  const phone = isPhoneOrTablet();

  useEffect(() => onInstallChange(() => {
    rerender(n => n + 1);
    if (!canInstall()) setOpen(false);
  }), []);

  useEffect(() => {
    if (suggestedToday()) return;
    let cancelled = false;
    let attempts = 0;
    let timer: number;

    const tryShow = async () => {
      if (cancelled) return;
      await detectInstalledApp();
      if (cancelled || suggestedToday() || !canInstall()) return;
      // Never on top of another window (sign-up, a material…): try again shortly.
      if (document.querySelector('[role="dialog"]')) {
        if (++attempts < 24) timer = window.setTimeout(tryShow, 5000);
        return;
      }
      markSuggestedToday();
      setOpen(true);
    };

    // Give the browser time to offer installation and the page time to settle.
    timer = window.setTimeout(tryShow, 4000);
    // Chrome may offer installation later; try again when it does.
    const off = onInstallChange(() => {
      if (!suggestedToday() && canInstall()) {
        window.clearTimeout(timer);
        timer = window.setTimeout(tryShow, 1500);
      }
    });
    return () => { cancelled = true; window.clearTimeout(timer); off(); };
  }, []);

  const install = async () => {
    if (hasInstallPrompt()) {
      const outcome = await promptInstall();
      if (outcome !== 'dismissed') setOpen(false);
    } else {
      setShowSteps(true);
    }
  };

  const benefit = phone
    ? t("Open it from your Home Screen like an app: full screen, faster, and materials you already opened work without a connection.")
    : t("Its own window, one click away in the taskbar or Dock, without hunting through browser tabs.");

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="install-prompt"
          role="status"
          aria-live="polite"
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 40 }}
          transition={{ type: 'spring', damping: 26, stiffness: 260 }}
          className={
            phone
              ? 'fixed inset-x-3 bottom-3 z-[150] pb-[env(safe-area-inset-bottom)]'
              : 'fixed bottom-6 right-6 z-[150] w-[24rem] max-w-[calc(100vw-3rem)]'
          }
        >
          <div className="rounded-[1.75rem] border border-white/15 bg-luxury-black/95 backdrop-blur-2xl shadow-[0_30px_80px_-10px_rgba(0,0,0,0.9)] p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <img src="/icons/icon-192.png" alt="" className="w-12 h-12 rounded-2xl shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-white font-semibold text-sm">
                  {phone ? t("Put SchoolHub on your Home Screen") : t("Install SchoolHub on this computer")}
                </p>
                <p className="text-white/55 text-xs mt-1 leading-relaxed">{benefit}</p>
              </div>
              <button onClick={() => setOpen(false)} aria-label={t("Close")} className="p-2 -m-1 rounded-full text-white/40 hover:text-white hover:bg-white/10 shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>

            {showSteps ? (
              <div className="mt-4 space-y-4">
                <InstallSteps platform={platform} />
                <div className="flex gap-2">
                  <button onClick={() => { markInstalled(); setOpen(false); }} className="flex-1 py-3 rounded-full border border-white/15 text-xs font-semibold text-white/70 hover:text-white flex items-center justify-center gap-1.5">
                    <Check className="w-3.5 h-3.5" /> {t("Already installed")}
                  </button>
                  <button onClick={() => setOpen(false)} className="flex-1 py-3 rounded-full bg-white text-luxury-black text-xs font-bold">
                    {t("Got it")}
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-4 flex gap-2">
                <button onClick={() => setOpen(false)} className="px-5 py-3 rounded-full text-xs font-semibold text-white/50 hover:text-white">
                  {t("Not now")}
                </button>
                <button onClick={install} className="flex-1 py-3 rounded-full bg-luxury-gold text-luxury-black text-xs font-bold tracking-wide flex items-center justify-center gap-2">
                  <Download className="w-4 h-4" />
                  {hasInstallPrompt() ? t("Install") : t("Show me how")}
                </button>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
