/**
 * Cyberpunk glitch text — flickers with color separation on hover.
 * Props: { children, className, style }
 */
export default function GlitchText({ children, className = '', style }) {
  return (
    <span className={`inline-block relative group ${className}`} style={style}>
      {/* Main text */}
      <span className="relative z-10 group-hover:animate-glitch">
        {children}
      </span>
      {/* Red shadow (offset left) */}
      <span
        className="absolute inset-0 z-0 text-[var(--color-cyber-pink)] opacity-0 group-hover:opacity-70 transition-opacity duration-75"
        style={{ transform: 'translate(-1.5px, 0)' }}
        aria-hidden
      >
        {children}
      </span>
      {/* Cyan shadow (offset right) */}
      <span
        className="absolute inset-0 z-0 text-[var(--color-cyber-cyan)] opacity-0 group-hover:opacity-70 transition-opacity duration-75"
        style={{ transform: 'translate(1.5px, 0)' }}
        aria-hidden
      >
        {children}
      </span>
    </span>
  );
}
