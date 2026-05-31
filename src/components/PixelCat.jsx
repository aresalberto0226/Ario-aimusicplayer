/**
 * Pixel cat paw — tapping while loading.
 */
export default function PixelCat({ size = 60 }) {
  const s = size;
  return (
    <div className="relative inline-flex flex-col items-center" style={{ width: s * 1.4, height: s * 1.4 }}>
      {/* Main paw pad */}
      <div className="absolute"
        style={{
          left: '50%', top: '58%', transform: 'translateX(-50%)',
          width: s * 0.55, height: s * 0.45,
          background: '#D4894A',
          borderRadius: '50% 50% 45% 45%',
          animation: 'pawPress 0.8s ease-in-out infinite',
        }}>
        {/* Toe beans */}
        <div className="absolute flex justify-between" style={{ left: '12%', top: '-25%', width: '76%' }}>
          <div className="rounded-full" style={{ width: s * 0.15, height: s * 0.22, background: '#E8A87C', animation: 'beanSquish 0.8s ease-in-out 0.1s infinite' }} />
          <div className="rounded-full" style={{ width: s * 0.15, height: s * 0.22, background: '#E8A87C', animation: 'beanSquish 0.8s ease-in-out 0.25s infinite' }} />
          <div className="rounded-full" style={{ width: s * 0.15, height: s * 0.22, background: '#E8A87C', animation: 'beanSquish 0.8s ease-in-out 0.15s infinite' }} />
        </div>
        {/* Main pad */}
        <div className="absolute"
          style={{
            left: '50%', top: '48%', transform: 'translateX(-50%)',
            width: s * 0.28, height: s * 0.22,
            background: '#E8A87C',
            borderRadius: '45%',
            animation: 'beanSquish 0.8s ease-in-out 0.05s infinite',
          }} />
      </div>

      {/* Bouncing dots */}
      <div className="absolute flex gap-1.5" style={{ left: '50%', top: s * 0.1, transform: 'translateX(-50%)' }}>
        {[0, 1, 2].map(i => (
          <div key={i} className="rounded-full bg-[var(--color-cyber-purple)]"
            style={{
              width: s * 0.1, height: s * 0.1,
              animation: `pawPress 0.6s ease-in-out ${i * 0.15}s infinite`,
            }} />
        ))}
      </div>

      <style>{`
        @keyframes pawPress {
          0%, 100% { transform: translateX(-50%) translateY(0) scale(1); }
          40% { transform: translateX(-50%) translateY(-6px) scale(1.1); }
          70% { transform: translateX(-50%) translateY(-2px) scale(1.03); }
        }
        @keyframes beanSquish {
          0%, 100% { transform: scaleY(1); }
          50% { transform: scaleY(0.75); }
        }
      `}</style>
    </div>
  );
}
