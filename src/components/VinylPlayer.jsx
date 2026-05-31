/**
 * Premium vinyl record player — Netease-style with detailed grooves,
 * realistic shimmer, and a movable tonearm.
 * Props: { cover, spinning, size, glowColor }
 */
export default function VinylPlayer({ cover, spinning = true, size = 200, glowColor = 'var(--color-cyber-purple)' }) {
  const grooveCount = 8;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      {/* Outer glow ring */}
      <div
        className="absolute rounded-full animate-pulse-purple"
        style={{
          inset: '-8%',
          background: 'transparent',
          boxShadow: spinning
            ? `0 0 20px ${glowColor}, 0 0 40px ${glowColor}44`
            : `0 0 10px ${glowColor}44`,
          transition: 'box-shadow 0.5s ease',
        }}
      />

      {/* Vinyl disc */}
      <div
        className={`absolute rounded-full ${spinning ? 'animate-spin-vinyl' : ''}`}
        style={{
          inset: '2%',
          background: `radial-gradient(circle at 50% 50%,
            #1a1a2e 0%,
            #111122 15%,
            #0d0d1d 30%,
            #0a0a18 45%,
            #080812 60%,
            #060610 75%,
            #040408 100%)`,
          border: '1px solid #1a1a3e',
          boxShadow: `inset 0 0 15px rgba(0,0,0,0.5), 0 0 8px ${glowColor}33`,
        }}
      >
        {/* Grooves */}
        {Array.from({ length: grooveCount }, (_, i) => (
          <div
            key={i}
            className="absolute rounded-full"
            style={{
              inset: `${(i + 2) * 5.5}%`,
              border: '1px solid rgba(255,255,255,0.04)',
            }}
          />
        ))}

        {/* Light reflection arc */}
        <div
          className="absolute rounded-full"
          style={{
            inset: '12%',
            background: 'conic-gradient(from 30deg, transparent 0deg, rgba(255,255,255,0.03) 40deg, transparent 80deg, transparent 360deg)',
          }}
        />

        {/* Center label */}
        <div
          className="absolute rounded-full flex flex-col items-center justify-center"
          style={{
            inset: '32%',
            background: `radial-gradient(circle, ${glowColor}33, #0a0a18)`,
            border: `1px solid ${glowColor}44`,
            boxShadow: `0 0 8px ${glowColor}44`,
          }}
        >
          {/* Cover image (if provided) */}
          {cover ? (
            <img
              src={cover}
              alt="Album cover"
              className="absolute inset-0 rounded-full object-cover opacity-90"
            />
          ) : (
            <span
              className="text-[10px] font-black"
              style={{
                fontFamily: 'var(--font-display)',
                color: glowColor,
                textShadow: `0 0 6px ${glowColor}`,
                fontSize: `${size * 0.07}px`,
              }}
            >
              ARIO
            </span>
          )}
        </div>
      </div>

      {/* Tonearm */}
      {size >= 100 && (
        <div className="absolute top-0 right-0" style={{ width: '35%', height: '55%' }}>
          {/* Base pivot */}
          <div
            className="absolute top-0 right-0 w-[14%] h-[12%] rounded-full"
            style={{ background: '#333', boxShadow: '0 0 4px rgba(0,0,0,0.5)' }}
          />
          {/* Arm */}
          <div
            className="absolute top-[5%] right-[5%] w-[3%] origin-top-right rounded-full"
            style={{
              height: '75%',
              background: 'linear-gradient(to bottom, #555, #333)',
              transform: spinning ? 'rotate(12deg)' : 'rotate(-25deg)',
              transition: 'transform 0.6s ease',
              boxShadow: '1px 0 2px rgba(0,0,0,0.4)',
            }}
          />
          {/* Headshell */}
          <div
            className="absolute rounded-full"
            style={{
              width: '10%',
              height: '5%',
              background: '#444',
              bottom: '18%',
              right: '2%',
              transform: spinning ? 'rotate(12deg)' : 'rotate(-25deg)',
              transition: 'transform 0.6s ease',
              transformOrigin: 'top right',
            }}
          />
        </div>
      )}
    </div>
  );
}
