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

export default function NowPlaying({ track, queue, currentIdx, onClose, onNext, onOpenFloat }) {
  const [pos, setPos] = useState(0);
  const [dur, setDur] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(playerState.volume);
  const [muted, setMuted] = useState(playerState.muted);
  const audioRef = useRef(null);
  const trackIdRef = useRef(null);
  const [liked, setLiked] = useState(false);
  const { t } = useLanguage();

  const handleLike = async () => {
    if (!track?.id) return;
    const newLiked = !liked;
    setLiked(newLiked);
    try {
      await fetch(`/api/song/like/${track.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ liked: newLiked }),
      });
    } catch {
      setLiked(!newLiked); // revert on failure
    }
  };

  // Sync volume from playerState
  useEffect(() => playerState.subscribe(data => {
    if (data.type === 'volume') setVolume(data.volume);
    if (data.type === 'mute') setMuted(data.muted);
  }), []);

  // Cleanup on unmount
  useEffect(() => () => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
  }, []);

  // Auto-play when track changes
  useEffect(() => {
    if (!track?.id) return;
    if (track.id === trackIdRef.current) return;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setPlaying(false); setPos(0); setDur(0);
    const a = playerState.create(track.id, track);
    if (!a) return;
    a.volume = playerState.muted ? 0 : playerState.volume;
    audioRef.current = a;
    trackIdRef.current = track.id;

    const onPlay = () => setPlaying(true);
    const onPause = () => {
      if (!a.ended) setPlaying(false);
    };
    const onEnd = () => {
      setPlaying(false); setPos(0);
      if (onNext) onNext(1);
    };
    const onTime = () => setPos(a.currentTime);
    const onDur = () => setDur(a.duration || 0);
    const onErr = () => setPlaying(false);

    a.addEventListener('play', onPlay);
    a.addEventListener('pause', onPause);
    a.addEventListener('ended', onEnd);
    a.addEventListener('timeupdate', onTime);
    a.addEventListener('loadedmetadata', onDur);
    a.addEventListener('error', onErr);

    a.play().catch(() => setPlaying(false));
  }, [track?.id]);

  if (!track) return null;

  const toggle = () => {
    playClick();
    const a = audioRef.current;
    if (!a) return;
    if (playing) { a.pause(); }
    else { a.play().catch(() => {}); }
  };

  const progressPct = dur > 0 ? (pos / dur) * 100 : 0;

  return (
    <div className="fixed bottom-28 inset-x-0 z-40 px-4">
      <div className="max-w-lg mx-auto">
        <div className="flex flex-col gap-1 p-3 rounded-2xl bg-[var(--color-cyber-surface)]/95 backdrop-blur-xl border border-[var(--color-cyber-purple)]/20"
          style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.5), 0 0 20px rgba(179,0,255,0.1)' }}>
          {/* Row 1: track info + controls */}
          <div className="flex items-center gap-2">
            {track.cover ? (
              <img src={track.cover} alt="" className="w-10 h-10 rounded-lg object-cover border border-[var(--color-cyber-purple)]/20" />
            ) : (
              <div className="w-10 h-10 rounded-lg bg-[var(--color-cyber-card)] flex items-center justify-center text-lg">🎵</div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[var(--color-cyber-text)] truncate">{track.name}</p>
              <p className="text-xs text-[var(--color-cyber-muted)] truncate font-mono">{track.artist}</p>
            </div>
            {/* Volume */}
            <button onClick={() => { playerState.muted = !muted; setMuted(!muted); }}
              className="w-6 h-6 rounded flex items-center justify-center text-[var(--color-cyber-muted)]">
              {muted ? (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="11,5 6,9 2,9 2,15 6,15 11,19"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>
              ) : (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="11,5 6,9 2,9 2,15 6,15 11,19"/><path d="M15.54 8.46a5 5 0 010 7.07"/></svg>
              )}
            </button>
            <input type="range" min="0" max="1" step="0.05" value={muted ? 0 : volume}
              onChange={e => { playerState.volume = +e.target.value; playerState.muted = false; setVolume(+e.target.value); setMuted(false); }}
              className="w-12 h-1 accent-[var(--color-cyber-purple)] cursor-pointer" />
            {/* Time */}
            <span className="text-[10px] text-[var(--color-cyber-muted)] font-mono w-16 text-right tabular-nums">{fmtTime(pos)} / {fmtTime(dur)}</span>
            {/* Play/Pause */}
            <button onClick={toggle}
              className="w-8 h-8 rounded-lg bg-[var(--color-cyber-purple)]/10 hover:bg-[var(--color-cyber-purple)]/25 border border-[var(--color-cyber-purple)]/20 flex items-center justify-center transition-all">
              {playing ? (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="var(--color-cyber-purple)"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
              ) : (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="var(--color-cyber-purple)"><polygon points="5,3 19,12 5,21"/></svg>
              )}
            </button>
            {/* Heart / Like */}
            <button onClick={handleLike}
              className="w-7 h-7 rounded-lg hover:bg-[var(--color-cyber-pink)]/10 border border-transparent hover:border-[var(--color-cyber-pink)]/20 flex items-center justify-center transition-all"
              title={liked ? 'Unlike' : 'Like on NetEase'}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill={liked ? 'var(--color-cyber-pink)' : 'none'} stroke={liked ? 'var(--color-cyber-pink)' : 'var(--color-cyber-muted)'} strokeWidth="2">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
              </svg>
            </button>
            {/* Expand to floating player */}
            <button onClick={() => { if (onOpenFloat) onOpenFloat(); }}
              className="w-7 h-7 rounded-lg bg-[var(--color-cyber-cyan)]/5 hover:bg-[var(--color-cyber-cyan)]/15 border border-[var(--color-cyber-cyan)]/10 flex items-center justify-center transition-all"
              title="Expand player">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--color-cyber-cyan)" strokeWidth="2"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>
            </button>
            {/* Close */}
            <button onClick={() => {
              playerState.stop();
              onClose();
            }}
              className="w-7 h-7 rounded-lg hover:bg-white/5 flex items-center justify-center">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--color-cyber-muted)" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
          {/* Progress */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-[var(--color-cyber-muted)]/60 font-mono w-9 text-right">{fmtTime(pos)}</span>
            <div className="flex-1 h-1 rounded-full bg-[var(--color-cyber-card)] overflow-hidden">
              <div className="h-full rounded-full transition-all duration-200"
                style={{ width: `${progressPct}%`, background: 'linear-gradient(to right, var(--color-cyber-purple), var(--color-cyber-cyan))' }} />
            </div>
            <span className="text-[10px] text-[var(--color-cyber-muted)]/60 font-mono w-9">{fmtTime(dur)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
