import { useRef, useCallback, useEffect, useState } from 'react';

const VOICE_KEY = 'ario_voice';
const DEFAULT_VOICE = 'Microsoft Brian Online (Natural) - English (United States)';

/**
 * useSpeech — Web Speech API queue for AI DJ narration.
 * Splits text into sentences at punctuation, queues them,
 * and plays sequentially. Supports user-selected voice from Settings.
 *
 * Must be unlocked by a user gesture first (call unlock() on click).
 */

/** Get all available voices (English + Chinese), memoized */
let _voiceCache = [];
export function getAvailableVoices() {
  if (!window.speechSynthesis) return [];
  const all = window.speechSynthesis.getVoices();
  if (all.length === 0) return _voiceCache;
  // Filter: only major English locales + Chinese, sort by language then name
  const allowed = ['en-US', 'en-GB', 'en-CA', 'en-AU', 'en-IE'];
  _voiceCache = all
    .filter(v =>
      allowed.includes(v.lang) ||
      v.lang.startsWith('zh')
    )
    .sort((a, b) => a.lang.localeCompare(b.lang) || a.name.localeCompare(b.name));
  return _voiceCache;
}

export default function useSpeech(lang = 'en') {
  const queueRef = useRef([]);
  const speakingRef = useRef(false);
  const enabledRef = useRef(true);
  const unlockedRef = useRef(false);
  const [voicesReady, setVoicesReady] = useState(false);

  // Preload voices
  useEffect(() => {
    const loadVoices = () => {
      getAvailableVoices();
      setVoicesReady(true);
    };
    if (window.speechSynthesis) {
      loadVoices();
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
    return () => {
      window.speechSynthesis?.cancel();
    };
  }, []);

  // Unlock speech (must be called from a user gesture like click)
  const unlock = useCallback(() => {
    if (unlockedRef.current || !window.speechSynthesis) return;
    const u = new SpeechSynthesisUtterance('');
    u.volume = 0;
    u.rate = 2;
    window.speechSynthesis.speak(u);
    unlockedRef.current = true;
  }, []);

  // Pick the voice to use: check saved preference first, then auto-detect
  const pickVoice = useCallback(() => {
    if (!window.speechSynthesis) return null;
    const voices = getAvailableVoices();
    if (!voices.length) return null;

    // Check for user's saved voice preference
    try {
      const savedName = localStorage.getItem(VOICE_KEY);
      if (savedName) {
        const saved = voices.find(v => v.name === savedName);
        if (saved) return saved;
      }
    } catch {}
    // Default to Brian when no preference saved
    const brian = voices.find(v => v.name === DEFAULT_VOICE);
    if (brian) return brian;

    // Auto-pick by language
    const langPrefix = lang === 'zh' ? 'zh' : 'en';
    const prefs = lang === 'zh'
      ? ['zh-CN', 'zh-TW', 'zh-HK']
      : ['en-US', 'en-GB', 'en-CA', 'en-AU', 'en-IE'];

    for (const pref of prefs) {
      const match = voices.find(v =>
        v.lang.startsWith(pref) &&
        (v.name.includes('Natural') || v.name.includes('Premium') ||
         v.name.includes('Enhanced') || v.name.includes('Wavenet') ||
         v.name.includes('Neural'))
      );
      if (match) return match;
      const any = voices.find(v => v.lang.startsWith(pref));
      if (any) return any;
    }
    return voices[0];
  }, [lang]);

  // Speak next sentence in queue
  const speakNext = useCallback(() => {
    if (!window.speechSynthesis || !enabledRef.current) {
      speakingRef.current = false;
      return;
    }
    if (speakingRef.current || queueRef.current.length === 0) return;

    speakingRef.current = true;
    const item = queueRef.current.shift();
    const utterance = new SpeechSynthesisUtterance(item.text);

    utterance.lang = lang === 'zh' ? 'zh-CN' : 'en-US';
    utterance.rate = 1.10;
    utterance.pitch = 1.05;
    utterance.volume = 0.35;

    const voice = pickVoice();
    if (voice) utterance.voice = voice;

    utterance.onend = () => {
      speakingRef.current = false;
      setTimeout(() => speakNext(), item.pause);
    };

    utterance.onerror = (e) => {
      if (e.error !== 'interrupted' && e.error !== 'canceled') {
        console.warn('Speech error:', e.error);
      }
      speakingRef.current = false;
      if (e.error !== 'synthesis-unavailable' && e.error !== 'not-allowed') {
        setTimeout(() => speakNext(), item.pause);
      }
    };

    window.speechSynthesis.speak(utterance);
  }, [lang, pickVoice]);

  // Add text to speech queue
  const speak = useCallback((text) => {
    if (!text || !window.speechSynthesis) return;
    // Split at punctuation, tag each phrase with pause duration
    // Period/exclamation/question → 200ms  |  Comma/semicolon/colon → 80ms
    const raw = text.split(/(?<=[。！？，,;:：.!?\n])\s*/);
    for (const s of raw) {
      const trimmed = s.trim();
      if (!trimmed.length) continue;
      const last = trimmed.slice(-1);
      const isLongPause = /[。！？.!?]/.test(last);
      const pause = 60;
      queueRef.current.push({ text: trimmed, pause });
    }
    if (!speakingRef.current) speakNext();
  }, [speakNext]);

  const stop = useCallback(() => {
    queueRef.current = [];
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    speakingRef.current = false;
  }, []);

  const setEnabled = useCallback((enabled) => {
    enabledRef.current = enabled;
    if (!enabled) stop();
  }, [stop]);

  return { speak, stop, unlock, setEnabled, enabledRef, voicesReady };
}
