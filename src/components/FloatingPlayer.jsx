import { useState, useRef, useEffect } from 'react';
import { playerState } from '../hooks/PlayerContext.jsx';
import { playClick } from '../hooks/useSound.js';
import { useLanguage } from '../hooks/LanguageContext.jsx';

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
  const om = raw.match(/\[offset:\s*([+-]?\d+)\]/i);
  if (om) offset = parseInt(om[1]) / 1000;
  const re = /\[(\d+):(\d+)(?:\.(\d+))?\](.*)/g;
  let m;
  while ((m = re.exec(raw)) !== null) {
    const ms = m[3] ? +m[3] / (m[3].length === 2 ? 100 : 1000) : 0;
    const t = +m[1] * 60 + +m[2] + ms + offset;
    const text = m[4].trim();
    if (!text) continue;
    if (/^(作词|作曲|编曲|制作人|混音|母带|录音|和声|吉他|钢琴|鼓|贝斯|弦乐|编程|监制|出品|发行|词曲|演唱)\s*[:：]/.test(text)) continue;
    result.push({ time: Math.max(0, t), text });
  }
  return result.sort((a, b) => a.time - b.time);
}

export default function FloatingPlayer({ track: propTrack, queue, currentIdx, onClose, onNext }) {
  // Always prefer the global player's track — reflects playback from any page
  const track = playerState.track || propTrack;
  const [pos, setPos] = useState(playerState.audio?.currentTime || 0);
  const [dur, setDur] = useState(playerState.audio?.duration || 0);
  const [playing, setPlaying] = useState(playerState.isPlaying);
  const [volume, setVolume] = useState(playerState.volume);
  const [muted, setMuted] = useState(playerState.muted);
  const [lyrics, setLyrics] = useState([]);
  const [activeLyric, setActiveLyric] = useState(-1);
  const lyricsRef = useRef(null);
  const progressRef = useRef(null);
  const isDragging = useRef(false);
  const [winPos, setWinPos] = useState(null); // null = default bottom-right
  const dragRef = useRef({ startX: 0, startY: 0, startWinX: 0, startWinY: 0 });
  const { t } = useLanguage();

  // ===== Sync state from playerState and audio =====
  useEffect(() => {
    const unsub = playerState.subscribe(data => {
      if (data.type === 'play') setPlaying(true);
      if (data.type === 'pause' || data.type === 'end') setPlaying(false);
      if (data.type === 'volume') setVolume(data.volume);
      if (data.type === 'mute') setMuted(data.muted);
    });
    return unsub;
  }, []);

  // ===== Progress tracking via rAF (reads audio.currentTime directly) =====
  useEffect(() => {
    let raf;
    const tick = () => {
      const a = playerState.audio;
      if (a && !isDragging.current) {
        setPos(a.currentTime || 0);
        if (a.duration && isFinite(a.duration)) setDur(a.duration);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // ===== Lyrics =====
  useEffect(() => {
    if (!track?.id) return;
    setLyrics([]); setActiveLyric(-1);
    fetch(`/api/song/lyric/${track.id}`).then(r => r.json()).then(d => setLyrics(parseLrc(d.lrc))).catch(() => {});
  }, [track?.id]);

  // ===== Lyrics auto-scroll =====
  useEffect(() => {
    if (!lyrics.length) return;
    let raf, prev = -1;
    const tick = () => {
      const a = playerState.audio;
      const t = a?.currentTime || 0;
      let idx = -1;
      for (let i = 0; i < lyrics.length; i++) { if (t >= lyrics[i].time) idx = i; else break; }
      if (idx !== prev) {
        prev = idx; setActiveLyric(idx);
        const c = lyricsRef.current;
        if (idx >= 0 && c?.children[idx]) {
          const child = c.children[idx];
          c.scrollTo({ top: Math.max(0, child.offsetTop - c.clientHeight / 2 + child.clientHeight / 2), behavior: 'smooth' });
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [lyrics]);

  // ===== Seek =====
  const seekTo = (clientX) => {
    const a = playerState.audio;
    const bar = progressRef.current;
    if (!a || !bar || !a.duration || !isFinite(a.duration)) return;
    const rect = bar.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    a.currentTime = pct * a.duration;
    setPos(a.currentTime);
  };

  const onProgressDown = (e) => {
    e.preventDefault();
    isDragging.current = true;
    seekTo(e.clientX);
    const onMove = (ev) => seekTo(ev.clientX);
    const onUp = () => {
      isDragging.current = false;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  const toggle = () => { playClick(); playerState.toggle(); };

  const progressPct = dur > 0 ? (pos / dur) * 100 : 0;

  if (!track) return null;

  const onDragStart = (e) => {
    e.preventDefault();
    const ev = e.touches ? e.touches[0] : e;
    dragRef.current = {
      startX: ev.clientX,
      startY: ev.clientY,
      startWinX: winPos?.x ?? window.innerWidth - 410,
      startWinY: winPos?.y ?? Math.max(20, window.innerHeight - 520),
    };
    const onMove = (me) => {
      const m = me.touches ? me.touches[0] : me;
      setWinPos({
        x: Math.max(0, Math.min(window.innerWidth - 400, dragRef.current.startWinX + m.clientX - dragRef.current.startX)),
        y: Math.max(0, Math.min(window.innerHeight - 100, dragRef.current.startWinY + m.clientY - dragRef.current.startY)),
      });
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    document.addEventListener('touchmove', onMove);
    document.addEventListener('touchend', onUp);
  };

  const defaultX = window.innerWidth - 410;
  const defaultY = Math.max(20, window.innerHeight - 520);

  return (
    <div className="fixed inset-0 z-50 pointer-events-none">
      <div className="pointer-events-auto absolute rounded-2xl bg-[var(--color-cyber-surface)]/98 border border-[var(--color-cyber-purple)]/30 w-[380px] max-w-[95vw] max-h-[85vh] overflow-y-auto"
        style={{
          left: winPos?.x ?? defaultX,
          top: winPos?.y ?? defaultY,
          boxShadow: '0 0 50px rgba(179,0,255,0.3), 0 20px 60px rgba(0,0,0,0.7)',
        }}>
        {/* Header — draggable */}
        <div
          onMouseDown={onDragStart}
          onTouchStart={onDragStart}
          className="flex items-center justify-between p-3 border-b border-[var(--color-cyber-purple)]/10 cursor-grab active:cursor-grabbing select-none">
          <span className="text-xs font-mono text-[var(--color-cyber-cyan)]">▶ {t('float.title')}</span>
          <button onClick={onClose}
            className="w-6 h-6 rounded-lg hover:bg-white/5 flex items-center justify-center">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-cyber-muted)" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Big cover — centered, no waveform */}
          <div className="flex justify-center">
            <div className="relative" style={{ width: 180, height: 180 }}>
              {/* Vinyl disc background */}
              <div className="absolute inset-0 rounded-full"
                style={{
                  background: 'radial-gradient(circle at 50% 50%, #1a1a2e 0%, #0d0d1d 45%, #060610 100%)',
                  border: '1px solid rgba(179,0,255,0.15)',
                  boxShadow: '0 0 25px rgba(179,0,255,0.2), inset 0 0 20px rgba(0,0,0,0.4)',
                  animation: playing ? 'spin 3s linear infinite' : 'none',
                }}>
                {/* Groove rings */}
                {Array.from({ length: 6 }, (_, i) => (
                  <div key={i} className="absolute rounded-full border border-white/[0.03]"
                    style={{ inset: `${(i + 2) * 7}%` }} />
                ))}
                {/* Center label with big cover */}
                <div className="absolute rounded-full overflow-hidden"
                  style={{ inset: '18%', border: '1px solid rgba(179,0,255,0.2)' }}>
                  {track.cover ? (
                    <img src={track.cover} alt={track.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-[var(--color-cyber-card)] flex items-center justify-center text-3xl">🎵</div>
                  )}
                </div>
              </div>
              {/* Tonearm */}
              <div className="absolute top-0 right-0" style={{ width: '30%', height: '50%' }}>
                <div className="absolute top-0 right-1 w-2.5 h-2.5 rounded-full bg-gray-600" />
                <div className="absolute top-1 right-[5px] w-[2px] origin-top rounded-full bg-gray-500"
                  style={{ height: '65%', transform: playing ? 'rotate(10deg)' : 'rotate(-22deg)', transition: 'transform 0.5s ease' }} />
              </div>
            </div>
          </div>

          {/* Track info */}
          <div className="text-center">
            <h3 className="text-sm font-bold text-[var(--color-cyber-text)]">{track.name}</h3>
            <p className="text-xs text-[var(--color-cyber-cyan)] font-mono">{track.artist}</p>
          </div>

          {/* Progress bar — draggable */}
          <div className="space-y-1 select-none">
            <div ref={progressRef} onMouseDown={onProgressDown} onTouchStart={e => onProgressDown(e.touches[0])}
              className="w-full h-2.5 rounded-full bg-[var(--color-cyber-card)] cursor-pointer relative group">
              <div className="absolute inset-y-0 left-0 rounded-full"
                style={{ width: `${progressPct}%`, background: 'linear-gradient(to right, var(--color-cyber-purple), var(--color-cyber-cyan))', transition: isDragging.current ? 'none' : 'width 0.1s linear' }} />
              <div className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white shadow-lg border-2 border-[var(--color-cyber-purple)]"
                style={{ left: `calc(${progressPct}% - 8px)` }} />
            </div>
            <div className="flex justify-between text-[10px] text-[var(--color-cyber-muted)] font-mono">
              <span>{fmtTime(pos)}</span><span>{fmtTime(dur)}</span>
            </div>
          </div>

          {/* Lyrics */}
          <div ref={lyricsRef} className="relative max-h-28 overflow-y-auto text-center space-y-1"
            style={{ maskImage: 'linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%)', WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%)' }}>
            {lyrics.length > 0 ? lyrics.map((line, i) => (
              <p key={i} onClick={() => { const a = playerState.audio; if (a?.duration) { a.currentTime = line.time; setPos(line.time); } }}
                className={`cursor-pointer transition-all duration-200 ${i === activeLyric ? 'text-[var(--color-cyber-purple)] font-bold text-sm glow-purple py-0.5' : 'text-[var(--color-cyber-muted)] text-sm opacity-50'}`}>
                {line.text}
              </p>
            )) : <p className="text-[var(--color-cyber-muted)]/30 text-xs py-2">♪ instrumental</p>}
          </div>

          {/* Controls */}
          <div className="flex items-center justify-center gap-3">
            <button onClick={() => { playerState.muted = !playerState.muted; setMuted(!muted); }}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--color-cyber-muted)] hover:text-[var(--color-cyber-text)]">
              {muted ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="11,5 6,9 2,9 2,15 6,15 11,19"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="11,5 6,9 2,9 2,15 6,15 11,19"/><path d="M15.54 8.46a5 5 0 010 7.07"/></svg>
              )}
            </button>
            <input type="range" min="0" max="1" step="0.05" value={muted ? 0 : volume}
              onChange={e => { playerState.volume = +e.target.value; playerState.muted = false; setVolume(+e.target.value); setMuted(false); }}
              className="w-16 h-1 accent-[var(--color-cyber-purple)] cursor-pointer" />
            <button onClick={() => onNext?.(-1)}
              className="w-8 h-8 rounded-full bg-[var(--color-cyber-surface)] border border-white/5 flex items-center justify-center">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="19,20 9,12 19,4"/></svg>
            </button>
            <button onClick={toggle}
              className="w-12 h-12 rounded-full flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, var(--color-cyber-purple), #7b00cc)' }}>
              {playing ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="text-white"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="text-white ml-0.5"><polygon points="5,3 19,12 5,21"/></svg>
              )}
            </button>
            <button onClick={() => onNext?.(1)}
              className="w-8 h-8 rounded-full bg-[var(--color-cyber-surface)] border border-white/5 flex items-center justify-center">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5,4 15,12 5,20"/><polygon points="13,5 21,12 13,19"/></svg>
            </button>
          </div>

          {queue && queue.length > 1 && (
            <div className="text-[10px] text-[var(--color-cyber-muted)] font-mono text-center">
              {currentIdx + 1} / {queue.length} in queue
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
