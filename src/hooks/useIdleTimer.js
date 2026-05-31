import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * useIdleTimer — tracks user idle time.
 * Returns `isIdle` when user hasn't interacted for `timeout` ms.
 * Resets on mouse move, click, keypress, or touch.
 */
export default function useIdleTimer(timeout = 120000, enabled = true) {
  const [isIdle, setIsIdle] = useState(false);
  const timerRef = useRef(null);
  const enabledRef = useRef(enabled);

  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  const reset = useCallback(() => {
    setIsIdle(false);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (enabledRef.current) {
      timerRef.current = setTimeout(() => setIsIdle(true), timeout);
    }
  }, [timeout]);

  const stop = useCallback(() => {
    setIsIdle(false);
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
  }, []);

  useEffect(() => {
    if (!enabled) {
      stop();
      return;
    }
    // Start timer
    timerRef.current = setTimeout(() => setIsIdle(true), timeout);

    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'wheel'];
    events.forEach(e => window.addEventListener(e, reset, { passive: true }));

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      events.forEach(e => window.removeEventListener(e, reset));
    };
  }, [timeout, enabled, reset, stop]);

  return { isIdle, reset, stop };
}
