import { useState, useEffect } from 'react';
import { playerState } from '../hooks/PlayerContext.jsx';

export default function GlobalPlayer({ onExpand }) {
  const [track, setTrack] = useState(playerState.track);
  const [playing, setPlaying] = useState(playerState.isPlaying);

  useEffect(() => playerState.subscribe(data => {
    if (data.type === 'track') setTrack(data.track);
    if (data.type === 'play') setPlaying(true);
    if (data.type === 'pause' || data.type === 'end' || data.type === 'stop') setPlaying(false);
  }), []);

  if (!track) return null;

  return (
    <div className="fixed bottom-16 inset-x-0 z-50 px-4 pointer-events-none">
      <div className="max-w-lg mx-auto pointer-events-auto">
        <div className="flex items-center gap-2 p-2 rounded-xl bg-[var(--color-cyber-surface)]/95 backdrop-blur-xl border border-[var(--color-cyber-purple)]/20"
          style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.5)' }}>
          {track.cover ? (
            <img src={track.cover} alt="" className="w-8 h-8 rounded-lg object-cover" />
          ) : (
            <div className="w-8 h-8 rounded-lg bg-[var(--color-cyber-card)] flex items-center justify-center text-sm">🎵</div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-[var(--color-cyber-text)] truncate">{track.name}</p>
            <p className="text-[10px] text-[var(--color-cyber-muted)] truncate font-mono">{track.artist}</p>
          </div>
          <button onClick={() => playerState.toggle()}
            className="w-7 h-7 rounded-lg bg-[var(--color-cyber-purple)]/15 flex items-center justify-center">
            {playing ? (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="var(--color-cyber-purple)"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
            ) : (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="var(--color-cyber-purple)"><polygon points="5,3 19,12 5,21"/></svg>
            )}
          </button>
          {onExpand && (
            <button onClick={onExpand}
              className="w-6 h-6 rounded flex items-center justify-center text-[var(--color-cyber-cyan)]">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
