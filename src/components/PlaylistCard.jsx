import { playHover } from '../hooks/useSound.js';

export default function PlaylistCard({ track, onPlay }) {
  return (
    <button
      onClick={onPlay}
      onMouseEnter={playHover}
      className="w-full flex items-center gap-3 p-2.5 rounded-xl bg-[var(--color-cyber-card)]/60 hover:bg-[var(--color-cyber-card)] border border-[var(--color-cyber-purple)]/10 hover:border-[var(--color-cyber-purple)]/30 transition-all duration-200 text-left group"
    >
      <div className="flex-shrink-0 w-10 h-10 rounded-lg overflow-hidden bg-[var(--color-cyber-surface)] border border-[var(--color-cyber-purple)]/10">
        {track.cover ? (
          <img src={track.cover} alt={track.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-base">🎵</div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[var(--color-cyber-text)] truncate group-hover:text-[var(--color-cyber-cyan)] transition-colors">
          {track.name}
        </p>
        <p className="text-xs text-[var(--color-cyber-muted)] truncate font-mono">
          {track.artist}
        </p>
      </div>

      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[var(--color-cyber-purple)]/10 group-hover:bg-[var(--color-cyber-purple)]/20 flex items-center justify-center transition-all group-hover:scale-110">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="var(--color-cyber-purple)">
          <polygon points="5,3 19,12 5,21" />
        </svg>
      </div>
    </button>
  );
}
