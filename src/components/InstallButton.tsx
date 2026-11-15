import React, { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import Modal from './Modal';
import { InstallSteps } from './InstallPrompt';
import { canInstall, hasInstallPrompt, installPlatform, isPhoneOrTablet, onInstallChange, promptInstall } from '../lib/install';
import { t } from '../lib/i18n';

/**
 * "Install" in the navigation bar, for whoever wants it before (or after) the
 * daily suggestion. Hidden once SchoolHub is installed.
 */
export default function InstallButton() {
  const [, rerender] = useState(0);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => onInstallChange(() => rerender(n => n + 1)), []);

  if (!canInstall()) return null;

  const install = async () => {
    if (hasInstallPrompt()) await promptInstall();
    else setShowHelp(true);
  };

  return (
    <>
      <button
        onClick={install}
        className="flex items-center gap-1.5 px-3 py-2 rounded-full border border-white/15 text-[10px] uppercase tracking-widest text-white/70 hover:text-white hover:border-white/30 shrink-0"
        title={t("Install SchoolHub on this device")}
        aria-label={t("Install SchoolHub on this device")}
      >
        <Download className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">{t("Install")}</span>
      </button>

      <Modal
        isOpen={showHelp}
        onClose={() => setShowHelp(false)}
        title={isPhoneOrTablet() ? t("Put SchoolHub on your Home Screen") : t("Install SchoolHub on this computer")}
        size="sm"
        level={3}
      >
        <InstallSteps platform={installPlatform()} />
      </Modal>
    </>
  );
}
