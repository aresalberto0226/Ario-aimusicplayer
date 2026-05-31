export default function VinylSpinner({ size = 60, spinning = true }) {
  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      {/* Vinyl disc */}
      <div
        className={`absolute inset-0 rounded-full bg-gradient-to-br from-gray-800 via-gray-900 to-black border-2 border-gray-700 ${spinning ? 'animate-spin-vinyl' : ''}`}
        style={{
          boxShadow: '0 0 20px rgba(232, 62, 140, 0.3), inset 0 0 10px rgba(0,0,0,0.5)',
        }}
      >
        {/* Grooves */}
        {Array.from({ length: 4 }, (_, i) => (
          <div
            key={i}
            className="absolute rounded-full border border-white/10"
            style={{
              inset: `${(i + 2) * 7}%`,
            }}
          />
        ))}
        {/* Center label */}
        <div
          className="absolute rounded-full bg-[var(--color-ario-neon)] flex items-center justify-center"
          style={{
            inset: '30%',
            boxShadow: '0 0 10px rgba(232, 62, 140, 0.5)',
          }}
        >
          <span
            className="text-[8px] font-black text-white"
            style={{ fontFamily: 'var(--font-display)', fontSize: `${size * 0.09}px` }}
          >
            ARIO
          </span>
        </div>
      </div>
      {/* Tonearm */}
      {size >= 60 && (
        <div
          className="absolute -top-1 -right-1 w-[40%] h-[3%] bg-gray-400 rounded-full origin-right"
          style={{
            transform: 'rotate(-30deg)',
            boxShadow: '0 0 2px rgba(0,0,0,0.3)',
          }}
        />
      )}
    </div>
  );
}
