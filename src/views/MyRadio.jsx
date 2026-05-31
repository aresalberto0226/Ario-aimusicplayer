import { useState, useRef, useCallback, useEffect } from 'react';
import WaveBars from '../components/WaveBars.jsx';
import PlaylistCard from '../components/PlaylistCard.jsx';
import GlitchText from '../components/GlitchText.jsx';
import { playerState } from '../hooks/PlayerContext.jsx';
import { radioState } from '../hooks/radioState.js';
import { useLanguage } from '../hooks/LanguageContext.jsx';
import useSpeech from '../hooks/useSpeech.js';

import { playHover, playClick, playStart, playNext } from '../hooks/useSound.js';

function fmtTime(s) {
  if (!s || isNaN(s) || !isFinite(s)) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

function parseLrc(raw) {
  if (!raw) return [];
  const result = [];
  let offset = 0;

  // Parse offset tag: [offset:+/-ms]
  const offsetMatch = raw.match(/\[offset:\s*([+-]?\d+)\]/i);
  if (offsetMatch) offset = parseInt(offsetMatch[1]) / 1000;

  // Parse lyric lines — handles [mm:ss.xx], [mm:ss.xxx], and [mm:ss]
  const re = /\[(\d+):(\d+)(?:\.(\d+))?\](.*)/g;
  let m;
  while ((m = re.exec(raw)) !== null) {
    const ms = m[3] ? +m[3] / (m[3].length === 2 ? 100 : 1000) : 0;
    const t = +m[1] * 60 + +m[2] + ms + offset;
    const text = m[4].trim();
    // Only skip truly empty lines and pure metadata tags
    if (!text) continue;
    if (/^(作词|作曲|编曲|制作人|混音|母带|录音|和声|吉他|钢琴|鼓|贝斯|弦乐|编程|监制|出品|发行|词曲|演唱)\s*[:：]/.test(text)) continue;
    if (/^(by|prod|mix|master|record|written)\b/i.test(text)) continue;
    result.push({ time: Math.max(0, t), text });
  }
  return result.sort((a, b) => a.time - b.time);
}

export default function MyRadio() {
  const [phase, setPhase] = useState('idle');
  const [djMessage, setDjMessage] = useState('');
  const [tracks, setTracks] = useState([]);
  const [currentTrack, setCurrentTrack] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [error, setError] = useState('');
  const [moodText, setMoodText] = useState('');
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(playerState.volume);
  const [muted, setMuted] = useState(playerState.muted);
  const [lyrics, setLyrics] = useState([]);
  const [activeLyric, setActiveLyric] = useState(-1);
  const [liked, setLiked] = useState(false);
  const [speechOn, setSpeechOn] = useState(true);
  const { t, lang } = useLanguage();
  const { speak, stop: stopSpeech, unlock } = useSpeech(lang);
  const audioRef = useRef(null);
  const progressRef = useRef(null);
  const lyricsRef = useRef(null);
  const isSeeking = useRef(false);
  const retryCount = useRef(0);
  const trackIdRef = useRef(null);
  const cleanupRef = useRef(null);
  const tracksRef = useRef([]);
  const currentIndexRef = useRef(0);
  const sendRequestRef = useRef(null);
  const songEndedRef = useRef(false);

  // Save state before unmounting (tab switch)
  useEffect(() => {
    return () => {
      radioState.save({
        phase, djMessage, tracks, currentTrack, currentIndex,
      });
    };
  }, [phase, djMessage, tracks, currentTrack, currentIndex]);

  // Restore state on mount
  useEffect(() => {
    const saved = radioState.load();
    const a = playerState.audio;
    if (!a || a.paused || !playerState.trackId) {
      // No audio playing — restore UI state only if we were playing
      if (saved?.phase === 'playing' && saved.tracks?.length > 0 && saved.currentTrack) {
        setPhase('playing');
        setTracks(saved.tracks);
        setCurrentTrack(saved.currentTrack);
        setCurrentIndex(saved.currentIndex ?? 0);
        setDjMessage(saved.djMessage || '');
        // Audio is gone, just show the UI
        setPlaying(false);
      }
      return;
    }
    // Audio is still playing — restore full state
    audioRef.current = a;
    trackIdRef.current = playerState.trackId;
    setPlaying(true);
    setDuration(a.duration || 0);
    setCurrentTime(a.currentTime || 0);
    if (saved?.phase === 'playing' && saved.tracks?.length > 0) {
      setPhase('playing');
      setTracks(saved.tracks);
      setCurrentTrack(saved.currentTrack || saved.tracks[0]);
      setCurrentIndex(saved.currentIndex ?? 0);
      setDjMessage(saved.djMessage || '');
    } else {
      setPhase('playing');
    }
  }, []);

  // ===== Create audio via global singleton =====
  const createAudio = useCallback((trackId, trackObj) => {
    if (cleanupRef.current) { cleanupRef.current(); cleanupRef.current = null; }

    const a = playerState.create(trackId, trackObj);
    if (!a) return null;
    a.volume = muted ? 0 : volume;
    audioRef.current = a;
    trackIdRef.current = trackId;
    retryCount.current = 0;

    const onTime = () => {
      if (!isSeeking.current) setCurrentTime(a.currentTime);
      // Fallback near-end detection — fires if browser 'ended' event is unreliable
      // Skip during seeking to avoid false triggers
      if (!isSeeking.current && a.duration && isFinite(a.duration) && !nearEndFiredRef.current && !songEndedRef.current) {
        if (a.currentTime >= a.duration - 1.0) {
          nearEndFiredRef.current = true;
          setPlaying(false);
        }
      }
    };
    const onDur = () => { if (a.duration && isFinite(a.duration)) setDuration(a.duration); };
    const onPlay = () => setPlaying(true);
    const onPause = () => {
      // Don't set playing=false if the audio ended naturally —
      // let the onEnd handler trigger the state transition instead.
      // This prevents the pause event from consuming the playing→!playing
      // transition before the ended event gets a chance to fire.
      if (!a.ended) setPlaying(false);
    };
    const onEnd = () => {
      songEndedRef.current = true;
      setPlaying(false);
    };
    const onErr = async () => {
      if (retryCount.current > 2 || !trackIdRef.current) return;
      retryCount.current++;
      const pos = a.currentTime || 0;
      try {
        // Fetch a fresh CDN URL (Vercel-compatible), fall back to stream proxy
        const urlRes = await fetch(`/api/song/url/${trackIdRef.current}`);
        const urlData = await urlRes.json();
        a.src = urlData.url || `/api/song/stream/${trackIdRef.current}?_=${Date.now()}`;
        await new Promise(r => { a.oncanplay = r; });
        if (pos > 0) a.currentTime = pos;
        await a.play(); retryCount.current = 0; setPlaying(true);
      } catch {}
    };

    a.addEventListener('timeupdate', onTime);
    a.addEventListener('loadedmetadata', onDur);
    a.addEventListener('durationchange', onDur);
    a.addEventListener('play', onPlay);
    a.addEventListener('pause', onPause);
    a.addEventListener('ended', onEnd);
    a.addEventListener('error', onErr);

    cleanupRef.current = () => {
      a.removeEventListener('timeupdate', onTime);
      a.removeEventListener('loadedmetadata', onDur);
      a.removeEventListener('durationchange', onDur);
      a.removeEventListener('play', onPlay);
      a.removeEventListener('pause', onPause);
      a.removeEventListener('ended', onEnd);
      a.removeEventListener('error', onErr);
      a.pause(); a.src = '';
    };

    return a;
  }, [volume, muted]);

  // Volume sync: keep audio element in sync with local state
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = muted ? 0 : volume;
  }, [volume, muted]);

  // Subscribe to global playerState for volume/muted changes from other pages
  useEffect(() => {
    const unsub = playerState.subscribe(data => {
      if (data.type === 'volume') setVolume(data.volume);
      if (data.type === 'mute') setMuted(data.muted);
    });
    return unsub;
  }, []);

  // ===== Lyrics sync — direct audio.currentTime via rAF =====
  const lyricsRefCache = useRef([]);
  useEffect(() => { lyricsRefCache.current = lyrics; }, [lyrics]);

  useEffect(() => {
    if (!lyrics.length) return;
    let raf;
    let prevIdx = -1;
    const tick = () => {
      const a = audioRef.current;
      if (!a) { raf = requestAnimationFrame(tick); return; }
      const t = a.currentTime;
      if (!isFinite(t)) { raf = requestAnimationFrame(tick); return; }

      // Find active line
      const lrc = lyricsRefCache.current;
      let idx = -1;
      for (let i = 0; i < lrc.length; i++) {
        if (t >= lrc[i].time) idx = i;
        else break;
      }

      if (idx !== prevIdx) {
        prevIdx = idx;
        setActiveLyric(idx);
        const container = lyricsRef.current;
        if (idx >= 0 && container?.children[idx]) {
          const child = container.children[idx];
          // offsetTop is relative to offsetParent (now the container itself)
          const lineTop = child.offsetTop;
          const lineCenter = lineTop + child.clientHeight / 2;
          const containerCenter = container.clientHeight / 2;
          container.scrollTo({ top: Math.max(0, lineCenter - containerCenter), behavior: 'smooth' });
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [lyrics.length]); // re-create when lyrics array changes

  // ===== Fetch lyrics =====
  useEffect(() => {
    if (!currentTrack?.id) { setLyrics([]); setActiveLyric(-1); return; }
    setLyrics([]); setActiveLyric(-1);
    fetch(`/api/song/lyric/${currentTrack.id}`)
      .then(r => r.json()).then(d => setLyrics(parseLrc(d.lrc))).catch(() => {});
  }, [currentTrack?.id]);

  // ===== Seek =====
  // ===== Playback =====
  const stopAudio = useCallback(() => {
    if (cleanupRef.current) { cleanupRef.current(); cleanupRef.current = null; }
    audioRef.current = null;
    setPlaying(false); setCurrentTime(0); setDuration(0);
    retryCount.current = 0;
  }, []);

  const playTrack = useCallback(async (track, startTime = 0) => {
    if (!track?.id) return;
    if (trackIdRef.current === track.id && audioRef.current && startTime === 0) {
      try { await audioRef.current.play(); setPlaying(true); } catch {} return;
    }
    stopAudio();
    const a = createAudio(track.id, track);
    if (startTime > 0) {
      if (a.readyState < 3) {
        await new Promise(r => { a.oncanplay = r; });
      }
      a.currentTime = startTime;
    }
    try { await a.play(); setPlaying(true); } catch { setPlaying(false); }
  }, [stopAudio, createAudio]);

  const togglePlay = useCallback(async () => {
    const a = audioRef.current;
    if (!a) { if (currentTrack) await playTrack(currentTrack); return; }
    if (playing) {
      a.pause();
      setPlaying(false);
      return;
    }
    // Resume: try play() first, if fails re-create from position
    const savedPos = a.currentTime || 0;
    try {
      await a.play();
      setPlaying(true);
    } catch {
      await playTrack(currentTrack, savedPos);
    }
  }, [playing, currentTrack, playTrack]);

  const handleLike = useCallback(async () => {
    if (!currentTrack?.id) return;
    const newLiked = !liked;
    setLiked(newLiked);
    try {
      await fetch(`/api/song/like/${currentTrack.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ liked: newLiked }),
      });
    } catch {
      setLiked(!newLiked);
    }
  }, [currentTrack?.id, liked]);

  // ===== Seek =====
  const doSeek = useCallback((clientX) => {
    const audio = audioRef.current;
    const bar = progressRef.current;
    if (!bar || !audio || !audio.duration || !isFinite(audio.duration)) return;
    const rect = bar.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const t = pct * audio.duration;
    audio.currentTime = t;
    setCurrentTime(t);
  }, []);

  const onProgressDown = useCallback((e) => {
    e.preventDefault();
    isSeeking.current = true;
    doSeek(e.clientX);
    const onMove = (ev) => doSeek(ev.clientX);
    const onUp = () => {
      isSeeking.current = false;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [doSeek]);

  // Auto-play next track when current one ends
  const prevPlayingRef = useRef(false);
  const playTrackRef = useRef(playTrack);
  const nearEndFiredRef = useRef(false);

  // Sync playTrack to ref so effect doesn't re-run on volume changes
  useEffect(() => { playTrackRef.current = playTrack; }, [playTrack]);

  const advanceToNext = useCallback(() => {
    const t = tracksRef.current;
    const ci = currentIndexRef.current;
    if (t.length === 0) return;
    const nextIdx = (ci + 1) % t.length;
    setCurrentIndex(nextIdx);
    setCurrentTrack(t[nextIdx]);
    setTimeout(() => {
      playTrackRef.current(t[nextIdx]);
      if (nextIdx === 0 && sendRequestRef.current) sendRequestRef.current();
    }, 300);
  }, []);

  useEffect(() => {
    const wasPlaying = prevPlayingRef.current;
    prevPlayingRef.current = playing;

    // Primary: song ended event
    if (wasPlaying && !playing && songEndedRef.current && phase === 'playing') {
      songEndedRef.current = false;
      nearEndFiredRef.current = false;
      advanceToNext();
      return;
    }

    // Fallback: near-end detection via timeupdate (handles cases where
    // the browser doesn't fire 'ended' reliably for streamed audio)
    if (wasPlaying && !playing && nearEndFiredRef.current && phase === 'playing') {
      nearEndFiredRef.current = false;
      advanceToNext();
    }
  }, [playing, phase, advanceToNext]);

  // ===== Send =====
  const sendRequest = useCallback(async (customMessage) => {
    const msg = customMessage || t('radio.defaultMsg');
    if (customMessage) playClick(); else playStart();
    unlock();      // unlock Web Speech API
    stopSpeech();  // stop any previous speech
    stopAudio(); setPhase('loading'); setError('');
    try {
      const res = await fetch('/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, mode: 'playlist', lang }),
      });
      const data = await res.json();
      // Speak the DJ message if voice is enabled
      if (data.say && speechOn) speak(data.say);
      if (data.play?.length > 0) {
        setDjMessage(data.say); setTracks(data.play);
        setCurrentIndex(0); setCurrentTrack(data.play[0]);
        setPhase('playing');
        setTimeout(() => playTrack(data.play[0]), 400);
      } else {
        setDjMessage(data.say || 'No matches found in your playlist.');
        setPhase('idle');
      }
    } catch { setError('Signal lost'); setPhase('idle'); }
  }, [stopAudio, playTrack, t, lang, unlock, stopSpeech, speak, speechOn]);

  const changeTrack = useCallback((idx) => {
    if (!tracks.length) return;
    setCurrentIndex(idx); setCurrentTrack(tracks[idx]);
    setTimeout(() => playTrack(tracks[idx]), 200);
  }, [tracks, playTrack]);

  // Keep refs in sync (must be after all function declarations)
  useEffect(() => { tracksRef.current = tracks; }, [tracks]);
  useEffect(() => { currentIndexRef.current = currentIndex; }, [currentIndex]);
  useEffect(() => { sendRequestRef.current = sendRequest; }, [sendRequest]);

  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="flex flex-col" style={{ height: '100%' }}>
      <div className="overflow-y-auto" style={{ flex: '1 1 0', minHeight: 0, paddingBottom: '10rem', WebkitOverflowScrolling: 'touch' }}>
        {/* IDLE */}
        {phase === 'idle' && (
          <div className="flex flex-col items-center justify-center text-center px-4 space-y-8 pt-12" style={{ minHeight: '100%' }}>
            {/* Show DJ message if AI responded but had no songs */}
            {djMessage && (
              <div className="w-full max-w-sm px-4 py-3 rounded-xl bg-[var(--color-cyber-surface)] border border-[var(--color-cyber-purple)]/15 text-sm text-[var(--color-cyber-text)] cyber-card">
                <span className="text-[var(--color-cyber-cyan)] font-mono text-xs">{'> '}</span>{djMessage}
              </div>
            )}
            <GlitchText className="text-3xl font-black glow-purple" style={{ fontFamily: 'var(--font-display)' }}>{t('radio.title')}</GlitchText>
            <div className="w-48 h-48 rounded-3xl bg-[var(--color-cyber-card)] border border-[var(--color-cyber-purple)]/20 flex items-center justify-center text-6xl"
              style={{ boxShadow: '0 0 30px rgba(179,0,255,0.15)' }}>📻</div>

            {/* Descriptive text — differentiates from Ario FM */}
            <div className="space-y-2 max-w-xs">
              <p className="text-[var(--color-cyber-text)] text-sm font-semibold font-mono">
                🎲 {t('radio.subtitle')}
              </p>
              <p className="text-[var(--color-cyber-muted)] text-xs leading-relaxed">
                {t('radio.desc')}
              </p>
              <div className="flex items-center justify-center gap-2 pt-1">
                <span className="text-[10px] text-[var(--color-cyber-gold)]/70 font-mono">{t('radio.source')}</span>
              </div>
            </div>

            <button onClick={() => sendRequest()} onMouseEnter={playHover}
              className="cyber-btn px-10 py-4 rounded-xl font-black text-lg"
              style={{ fontFamily: 'var(--font-display)', background: 'linear-gradient(135deg, var(--color-cyber-purple), #7b00cc)', color: '#fff', border: '1px solid var(--color-cyber-purple)' }}>
              ▶ {t('radio.start')}
            </button>
            {error && <p className="text-[var(--color-cyber-pink)] text-xs font-mono">{error}</p>}
          </div>
        )}

        {/* LOADING */}
        {phase === 'loading' && (
          <div className="flex flex-col items-center justify-center space-y-6" style={{ minHeight: '100%' }}>
            <div className="w-16 h-16 rounded-full border-2 border-[var(--color-cyber-purple)]/20 border-t-[var(--color-cyber-purple)] animate-spin"
              style={{ boxShadow: '0 0 15px rgba(179,0,255,0.2)' }} />
            <p className="text-[var(--color-cyber-muted)] text-sm font-mono">{'>'} {t('radio.loading')}</p>
          </div>
        )}

        {/* PLAYING */}
        {phase === 'playing' && currentTrack && (
          <div className="flex flex-col items-center px-4 pt-6 pb-4 space-y-4 w-full animate-slide-up">
            {djMessage && (
              <div className="w-full max-w-sm px-4 py-2 rounded-xl bg-[var(--color-cyber-surface)] border border-[var(--color-cyber-purple)]/15 text-xs text-[var(--color-cyber-text)] cyber-card">
                <span className="text-[var(--color-cyber-cyan)] font-mono">{'> '}</span>{djMessage}
              </div>
            )}

            {/* Big cover */}
            <div className="rounded-2xl overflow-hidden border-2 border-[var(--color-cyber-purple)]/30"
              style={{
                width: 'min(260px, 65vw)',
                height: 'min(260px, 65vw)',
                boxShadow: '0 0 40px rgba(179,0,255,0.25), 0 15px 40px rgba(0,0,0,0.6)',
              }}>
              {currentTrack.cover ? (
                <img src={currentTrack.cover} alt={currentTrack.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-[var(--color-cyber-card)] flex items-center justify-center text-6xl">🎵</div>
              )}
            </div>

            <div className="text-center space-y-0.5">
              <h2 className="text-lg font-bold text-[var(--color-cyber-text)]">{currentTrack.name}</h2>
              <p className="text-sm text-[var(--color-cyber-cyan)] font-mono">{currentTrack.artist}</p>
            </div>

            <WaveBars active={playing} count={20} barWidth={3} gap={3} analyser={playerState.analyser} />

            {/* Lyrics */}
            <div ref={lyricsRef}
              className="w-full max-w-sm overflow-y-auto text-center space-y-1 relative"
              style={{
                maxHeight: '10rem',
                maskImage: 'linear-gradient(to bottom, transparent 0%, black 10%, black 90%, transparent 100%)',
                WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 10%, black 90%, transparent 100%)',
              }}>
              {lyrics.length > 0 ? lyrics.map((line, i) => (
                <p key={i}
                  onClick={() => {
                    const a = audioRef.current;
                    if (a?.duration) { a.currentTime = line.time; setCurrentTime(line.time); }
                  }}
                  className={`cursor-pointer transition-all duration-200 ${
                    i === activeLyric
                      ? 'text-[var(--color-cyber-purple)] font-bold text-base glow-purple py-0.5'
                      : 'text-[var(--color-cyber-muted)] text-sm opacity-50'
                  }`}>
                  {line.text}
                </p>
              )) : (
                <div className="text-[var(--color-cyber-muted)]/30 font-mono text-xs py-4">♪ {t('radio.instrumental')}</div>
              )}
            </div>

            {/* Progress */}
            <div className="w-full max-w-sm space-y-1 select-none">
              <div ref={progressRef}
                onMouseDown={onProgressDown}
                onTouchStart={(e) => onProgressDown(e.touches[0])}
                className="w-full h-3 rounded-full bg-[var(--color-cyber-card)] cursor-pointer relative group">
                <div className="absolute inset-y-0 left-0 rounded-full"
                  style={{ width: `${progressPct}%`, background: 'linear-gradient(to right, var(--color-cyber-purple), var(--color-cyber-cyan))' }} />
                <div className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white shadow-lg border-2 border-[var(--color-cyber-purple)]"
                  style={{ left: `calc(${progressPct}% - 8px)` }} />
              </div>
              <div className="flex justify-between text-xs text-[var(--color-cyber-muted)] font-mono">
                <span>{fmtTime(currentTime)}</span>
                <span>{fmtTime(duration)}</span>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-center gap-2">
              <button onClick={() => { const m = !muted; setMuted(m); playerState.muted = m; }}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--color-cyber-muted)] hover:text-[var(--color-cyber-text)] transition-colors">
                {muted || volume === 0 ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="11,5 6,9 2,9 2,15 6,15 11,19"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="11,5 6,9 2,9 2,15 6,15 11,19"/><path d="M15.54 8.46a5 5 0 010 7.07"/></svg>
                )}
              </button>
              <input type="range" min="0" max="1" step="0.05" value={muted ? 0 : volume}
                onChange={e => { const v = +e.target.value; setVolume(v); setMuted(false); playerState.volume = v; playerState.muted = false; }}
                className="w-14 h-1 accent-[var(--color-cyber-purple)] cursor-pointer" />
              <button onClick={() => { playClick(); changeTrack((currentIndex - 1 + tracks.length) % tracks.length); }}
                onMouseEnter={playHover}
                className="w-9 h-9 rounded-full bg-[var(--color-cyber-surface)] border border-white/5 hover:border-white/20 flex items-center justify-center transition-all">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="19,20 9,12 19,4"/></svg>
              </button>
              <button onClick={togglePlay} onMouseEnter={playHover}
                className="w-14 h-14 rounded-full flex items-center justify-center transition-all hover:scale-105 active:scale-95 animate-pulse-purple"
                style={{ background: 'linear-gradient(135deg, var(--color-cyber-purple), #7b00cc)' }}>
                {playing ? (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className="text-white"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                ) : (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className="text-white ml-0.5"><polygon points="5,3 19,12 5,21"/></svg>
                )}
              </button>
              <button onClick={() => { playNext(); changeTrack((currentIndex + 1) % tracks.length); if (currentIndex + 1 >= tracks.length) sendRequest(); }}
                onMouseEnter={playHover}
                className="w-9 h-9 rounded-full bg-[var(--color-cyber-surface)] border border-white/5 hover:border-white/20 flex items-center justify-center transition-all">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5,4 15,12 5,20"/><polygon points="13,5 21,12 13,19"/></svg>
              </button>
              <button onClick={() => { playClick(); sendRequest(); }} onMouseEnter={playHover}
                className="w-9 h-9 rounded-full bg-[var(--color-cyber-surface)] border border-[var(--color-cyber-cyan)]/20 hover:border-[var(--color-cyber-cyan)]/50 flex items-center justify-center transition-all">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-cyber-cyan)" strokeWidth="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
              </button>
              <button onClick={handleLike} onMouseEnter={playHover}
                className="w-9 h-9 rounded-full bg-[var(--color-cyber-surface)] border border-[var(--color-cyber-pink)]/10 hover:border-[var(--color-cyber-pink)]/40 flex items-center justify-center transition-all">
                <svg width="14" height="14" viewBox="0 0 24 24" fill={liked ? 'var(--color-cyber-pink)' : 'none'} stroke={liked ? 'var(--color-cyber-pink)' : 'var(--color-cyber-muted)'} strokeWidth="2">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                </svg>
              </button>
            </div>

            {/* Up next */}
            {tracks.slice(currentIndex + 1, currentIndex + 4).length > 0 && (
              <div className="w-full max-w-sm space-y-1.5">
                <p className="text-xs text-[var(--color-cyber-muted)] font-mono">{'>'} {t('radio.upNext')} [{tracks.length - currentIndex - 1}]</p>
                {tracks.slice(currentIndex + 1, currentIndex + 4).map((track, i) => (
                  <PlaylistCard key={i} track={track}
                    onPlay={() => { playClick(); changeTrack(currentIndex + 1 + i); }} />
                ))}
              </div>
            )}

            <p className="text-xs text-[var(--color-cyber-muted)] font-mono">
              {t('track.count')} {currentIndex + 1}{t('track.of')}{tracks.length} &nbsp;|&nbsp; {playing ? '▶' : '⏸'}
            </p>
          </div>
        )}
      </div>

      {/* Mood input */}
      <form onSubmit={(e) => { e.preventDefault(); const t = moodText.trim(); if (t) { sendRequest(t); setMoodText(''); } }}
        className="fixed bottom-16 inset-x-0 z-40 bg-gradient-to-t from-[var(--color-cyber-bg)] to-transparent pt-6 pb-3 px-4">
        <div className="flex items-center gap-2 max-w-lg mx-auto">
          <input type="text" value={moodText} onChange={e => setMoodText(e.target.value)}
            placeholder={t('radio.placeholder')}
            className="flex-1 px-5 py-3.5 rounded-xl bg-[var(--color-cyber-surface)] border border-[var(--color-cyber-purple)]/20 text-[var(--color-cyber-text)] placeholder:text-[var(--color-cyber-muted)]/50 focus:outline-none focus:border-[var(--color-cyber-purple)]/60 transition-all text-sm font-mono"
            autoComplete="off" />
          <button type="submit" disabled={!moodText.trim()}
            className="w-12 h-12 rounded-xl bg-[var(--color-cyber-purple)]/20 disabled:bg-[var(--color-cyber-card)] disabled:opacity-30 border border-[var(--color-cyber-purple)]/30 text-[var(--color-cyber-purple)] flex items-center justify-center transition-all hover:scale-105">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M22 2L11 13"/><path d="M22 2L15 22L11 13L2 9L22 2Z"/></svg>
          </button>
        </div>
      </form>
      {/* AI Voice toggle — persistent bottom-right */}
      <div className="fixed bottom-36 right-4 z-45">
        <button
          onClick={() => { setSpeechOn(!speechOn); if (!speechOn) unlock(); }}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all backdrop-blur-md ${
            speechOn
              ? 'bg-[var(--color-cyber-purple)]/25 text-[var(--color-cyber-purple)] border border-[var(--color-cyber-purple)]/50 shadow-[0_0_16px_rgba(179,0,255,0.3)]'
              : 'bg-[var(--color-cyber-surface)]/90 text-[var(--color-cyber-muted)] border border-[var(--color-cyber-purple)]/15 hover:border-[var(--color-cyber-purple)]/30'
          }`}
        >
          <span className={`w-2 h-2 rounded-full ${speechOn ? 'bg-[var(--color-cyber-purple)] animate-pulse-purple' : 'bg-[var(--color-cyber-muted)]/40'}`} />
          AI VOICE
          <span className="text-[10px] opacity-60">{speechOn ? 'ON' : 'OFF'}</span>
        </button>
      </div>
    </div>
  );
}
