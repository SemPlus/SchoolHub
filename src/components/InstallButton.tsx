import React, { useEffect, useState } from 'react';
import { Download, Share, PlusSquare } from 'lucide-react';
import Modal from './Modal';

import { t } from '../lib/i18n';
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function isStandalone(): boolean {
  return window.matchMedia?.('(display-mode: standalone)').matches || (navigator as any).standalone === true;
}

function isIos(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) && !/crios|fxios/i.test(navigator.userAgent);
}

/**
 * "Install" in the navigation bar. Chrome and Android show the system
 * prompt; iPhone gets the two steps for Safari's Share menu.
 */
export default function InstallButton() {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosHelp, setShowIosHelp] = useState(false);
  const [installed, setInstalled] = useState(isStandalone());

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPromptEvent(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setInstalled(true);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (installed || (!promptEvent && !isIos())) return null;

  const install = async () => {
    if (promptEvent) {
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      if (choice.outcome === 'accepted') setInstalled(true);
      setPromptEvent(null);
    } else {
      setShowIosHelp(true);
    }
  };

  return (
    <>
      <button
        onClick={install}
        className="flex items-center gap-1.5 px-3 py-2 rounded-full border border-white/15 text-[10px] uppercase tracking-widest text-white/70 hover:text-white hover:border-white/30"
        title={t("Install SchoolHub on this device")}
      >
        <Download className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">{t("Install")}</span>
      </button>

      <Modal isOpen={showIosHelp} onClose={() => setShowIosHelp(false)} title={t("Add SchoolHub to your Home Screen")} size="sm" level={3}>
        <ol className="space-y-4 text-sm text-white/80">
          <li className="flex items-center gap-3">
            <span className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center shrink-0">1</span>
            <span>{t("Tap the Share button ")}<Share className="inline w-4 h-4 mx-1 -mt-1" /> {t(" at the bottom of Safari.")}</span>
          </li>
          <li className="flex items-center gap-3">
            <span className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center shrink-0">2</span>
            <span>{t("Choose \"Add to Home Screen\" ")}<PlusSquare className="inline w-4 h-4 mx-1 -mt-1" />.</span>
          </li>
        </ol>
      </Modal>
    </>
  );
}
