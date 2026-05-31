import VinylPlayer from './VinylPlayer.jsx';

export default function ChatBubble({ message, reason, segue }) {
  return (
    <div className="flex gap-3 items-start">
      <div className="flex-shrink-0 mt-1">
        <VinylPlayer size={34} spinning glowColor="var(--color-cyber-purple)" />
      </div>
      <div className="flex-1 space-y-2">
        <div className="px-4 py-3 rounded-2xl rounded-tl-md bg-[var(--color-cyber-surface)] border border-[var(--color-cyber-purple)]/15 text-[var(--color-cyber-text)] cyber-card">
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{message}</p>
        </div>
        {reason && (
          <p className="text-xs text-[var(--color-cyber-pink)] ml-1 font-mono">
            {'>'} {reason}
          </p>
        )}
        {segue && (
          <p className="text-xs text-[var(--color-cyber-cyan)] ml-1 font-mono">
            {'>'} {segue}
          </p>
        )}
      </div>
    </div>
  );
}
