import { useState, useRef, useCallback } from 'react';

/**
 * Simple audio playback hook.
 * Manages playing state for a single track.
 */
export function useAudio() {
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef(null);

  const play = useCallback((url) => {
    // Stop any currently playing audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    if (!url) return;

    const audio = new Audio(url);
    audioRef.current = audio;

    audio.onplay = () => setPlaying(true);
    audio.onpause = () => setPlaying(false);
    audio.onended = () => {
      setPlaying(false);
      audioRef.current = null;
    };
    audio.onerror = () => {
      setPlaying(false);
      audioRef.current = null;
    };

    audio.play().catch(() => {
      // Autoplay might be blocked — that's okay
      setPlaying(false);
    });
  }, []);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setPlaying(false);
  }, []);

  return { playing, play, stop };
}
