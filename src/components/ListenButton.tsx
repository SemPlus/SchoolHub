import { useEffect, useRef, useState } from 'react';
import { Volume2, Square } from 'lucide-react';
import { canSpeak, speak, useReadability } from '../lib/readability';
import { t } from '../lib/i18n';

/** "Listen": reads the text aloud. Shown only to who turned it on in Readability. */
export default function ListenButton({ text }: { text: string }) {
  const [{ listen }] = useReadability();
  const [playing, setPlaying] = useState(false);
  const stop = useRef<(() => void) | null>(null);

  // Stop reading when the window closes or the text changes.
  useEffect(() => () => { stop.current?.(); }, [text]);

  if (!listen || !canSpeak() || !text.trim()) return null;

  const toggle = () => {
    if (playing) {
      stop.current?.();
      stop.current = null;
      setPlaying(false);
      return;
    }
    setPlaying(true);
    stop.current = speak(text, () => { stop.current = null; setPlaying(false); });
  };

  return (
    <button
      onClick={toggle}
      aria-pressed={playing}
      className="flex items-center gap-2 px-4 py-2 rounded-full border border-luxury-gold/40 text-luxury-gold text-[10px] uppercase tracking-widest hover:bg-luxury-gold/10"
    >
      {playing ? <Square className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
      {playing ? t("Stop") : t("Listen")}
    </button>
  );
}
