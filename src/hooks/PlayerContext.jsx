import { API_BASE } from '../api.js';

// Single global audio singleton — one audio instance for the entire app.
let audio = null;
let currentTrackId = null;
let currentTrackData = null; // the full track object { id, name, artist, cover, ... }
let _vol = 0.3;
let _muted = false;
let listeners = new Set();

// Web Audio API analysis for reactive visualization
let audioCtx = null;
let analyserNode = null;
let mediaSource = null;

function getAnalyzerContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

function notify(data) { listeners.forEach(fn => fn(data)); }

function destroyAudio() {
  // Disconnect Web Audio graph
  if (mediaSource) {
    try { mediaSource.disconnect(); } catch {}
    mediaSource = null;
  }
  analyserNode = null;

  // Kill our tracked audio
  if (audio) {
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
    audio.onplay = audio.onpause = audio.onended = audio.ontimeupdate = audio.onerror = audio.onloadedmetadata = null;
    audio = null;
  }
  // Also kill any leaked audio elements in the DOM (safety net)
  document.querySelectorAll('audio').forEach(el => {
    if (el !== audio) {
      el.pause();
      el.removeAttribute('src');
      el.load();
    }
  });
  currentTrackId = null;
  currentTrackData = null;
}

export const playerState = {
  get audio() { return audio; },
  get trackId() { return currentTrackId; },
  get track() { return currentTrackData; },
  get isPlaying() { return audio && !audio.paused; },

  get volume() { return _vol; },
  set volume(v) { _vol = v; if (audio) audio.volume = _muted ? 0 : v; notify({ type: 'volume', volume: v }); },

  get muted() { return _muted; },
  set muted(m) { _muted = m; if (audio) audio.volume = m ? 0 : _vol; notify({ type: 'mute', muted: m }); },

  get analyser() { return analyserNode; },
  subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },

  /** Get or create the singleton audio for a track. NEVER creates duplicates. */
  create(trackId, trackData = null) {
    console.log(`[GlobalAudio] create() called — trackId: ${trackId}, existing audio: ${!!audio}, existing trackId: ${currentTrackId}`);
    // Same track already playing — reuse
    if (audio && currentTrackId === trackId) {
      console.log('[GlobalAudio] Reusing existing audio for same track');
      if (trackData) { currentTrackData = trackData; notify({ type: 'track', track: trackData }); }
      return audio;
    }
    // Different track — destroy old one first
    console.log('[GlobalAudio] Destroying old audio, creating new one');
    destroyAudio();
    if (!trackId) return null;

    // Use direct CDN URL from track data if available, else fall back to stream proxy
    const audioUrl = trackData?.url || `${API_BASE}/api/song/stream/${trackId}`;
    const a = new Audio(audioUrl);

    // Connect to Web Audio analyser for reactive visualization
    try {
      const ctx = getAnalyzerContext();
      // Use crossOrigin to avoid CORS issues with the audio stream
      a.crossOrigin = 'anonymous';
      mediaSource = ctx.createMediaElementSource(a);
      analyserNode = ctx.createAnalyser();
      analyserNode.fftSize = 256;
      analyserNode.smoothingTimeConstant = 0.65;
      mediaSource.connect(analyserNode);
      analyserNode.connect(ctx.destination);
    } catch (e) {
      console.warn('Audio analyser setup failed, using fallback:', e.message);
      analyserNode = null;
    }

    a.volume = _muted ? 0 : _vol;
    audio = a;
    currentTrackId = trackId;
    currentTrackData = trackData;
    if (trackData) notify({ type: 'track', track: trackData });

    a.onplay = () => notify({ type: 'play' });
    a.onpause = () => notify({ type: 'pause' });
    a.onended = () => notify({ type: 'end' });
    a.ontimeupdate = () => notify({ type: 'time', time: a.currentTime });
    a.onerror = () => notify({ type: 'error' });
    return a;
  },

  play(trackId, trackData) {
    const a = this.create(trackId, trackData);
    if (a) a.play().catch(() => notify({ type: 'error' }));
    return a;
  },

  stop() { destroyAudio(); notify({ type: 'stop' }); },

  toggle() {
    if (!audio) return;
    if (audio.paused) audio.play().catch(() => {});
    else audio.pause();
  },

  seek(t) { if (audio && audio.duration) audio.currentTime = t; },
};
