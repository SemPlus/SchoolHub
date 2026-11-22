import { useEffect, useState } from 'react';
import { getLanguage } from './i18n';

// Readability options for students with dyslexia or other specific learning
// disorders (DSA), and for anyone who reads better this way. Each person turns
// them on in their own profile; they are saved on the device, not in the
// database, and applied as classes on <html> (styles in index.css).

export interface Readability {
  /** High-readability font (Atkinson Hyperlegible) instead of Inter and Cormorant. */
  font: boolean;
  /** Larger text, including the small labels. */
  large: boolean;
  /** More space between lines, letters and words. */
  spacing: boolean;
  /** "Listen" button that reads a work's title and description aloud. */
  listen: boolean;
}

const KEY = 'schoolhub.readability';
const NONE: Readability = { font: false, large: false, spacing: false, listen: false };
const listeners = new Set<(r: Readability) => void>();

export function loadReadability(): Readability {
  try {
    const saved = JSON.parse(window.localStorage.getItem(KEY) || '{}');
    return {
      font: saved.font === true,
      large: saved.large === true,
      spacing: saved.spacing === true,
      listen: saved.listen === true,
    };
  } catch {
    return { ...NONE };
  }
}

export function applyReadability(r: Readability): void {
  const classes = document.documentElement.classList;
  classes.toggle('rd-font', r.font);
  classes.toggle('rd-large', r.large);
  classes.toggle('rd-spacing', r.spacing);
}

export function saveReadability(r: Readability): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(r));
  } catch {
    // Storage blocked: the choice lasts until the page is reloaded.
  }
  applyReadability(r);
  listeners.forEach(fn => fn(r));
}

/** The current options, updated everywhere when they change. */
export function useReadability(): [Readability, (patch: Partial<Readability>) => void] {
  const [value, setValue] = useState<Readability>(loadReadability);
  useEffect(() => {
    listeners.add(setValue);
    return () => { listeners.delete(setValue); };
  }, []);
  const update = (patch: Partial<Readability>) => saveReadability({ ...loadReadability(), ...patch });
  return [value, update];
}

export function canSpeak(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
}

/**
 * Reads a text aloud with the browser's own voice (nothing is sent to us).
 * Italian voice in Italian, English in English. Returns a function that stops it.
 */
export function speak(text: string, onEnd: () => void): () => void {
  const synth = window.speechSynthesis;
  synth.cancel();
  const lang = getLanguage() === 'en' ? 'en' : 'it';
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang === 'en' ? 'en-GB' : 'it-IT';
  const voice = synth.getVoices().find(v => v.lang.toLowerCase().startsWith(lang));
  if (voice) utterance.voice = voice;
  utterance.rate = 0.95;
  utterance.onend = onEnd;
  utterance.onerror = onEnd;
  synth.speak(utterance);
  return () => synth.cancel();
}
