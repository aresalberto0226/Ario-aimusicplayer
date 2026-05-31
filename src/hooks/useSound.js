/**
 * Web Audio API synthesized sound effects.
 * No external files needed — all sounds generated programmatically.
 * Volume kept low (0.08-0.15) for subtle, premium feel.
 */

let ctx = null;
function getCtx() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

/** Hover sound — disabled (too noisy) */
export function playHover() { /* muted */ }

/** Low-pulse click for button presses */
export function playClick() {
  try {
    const c = getCtx();
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(400, c.currentTime);
    osc.frequency.exponentialRampToValueAtTime(200, c.currentTime + 0.08);
    gain.gain.setValueAtTime(0.12, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.1);
    osc.connect(gain).connect(c.destination);
    osc.start(c.currentTime);
    osc.stop(c.currentTime + 0.1);
  } catch { /* audio not available */ }
}

/** Rising arpeggio for radio start — 3 ascending notes */
export function playStart() {
  try {
    const c = getCtx();
    const freqs = [440, 554, 659]; // A4, C#5, E5
    freqs.forEach((freq, i) => {
      const osc = c.createOscillator();
      const gain = c.createGain();
      const t = c.currentTime + i * 0.1;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.08, t + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
      osc.connect(gain).connect(c.destination);
      osc.start(t);
      osc.stop(t + 0.22);
    });
  } catch { /* audio not available */ }
}

/** Frequency sweep for next track */
export function playNext() {
  try {
    const c = getCtx();
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(600, c.currentTime);
    osc.frequency.exponentialRampToValueAtTime(200, c.currentTime + 0.12);
    gain.gain.setValueAtTime(0.06, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.15);
    osc.connect(gain).connect(c.destination);
    osc.start(c.currentTime);
    osc.stop(c.currentTime + 0.15);
  } catch { /* audio not available */ }
}
