import { useEffect, useRef } from 'react';

/**
 * Audio visualizer — real equalizer with varied bar heights.
 * Uses power-curve compression on raw frequency data with
 * frequency-dependent sensitivity. Bars capped at 70% max.
 */
export default function WaveBars({ active = true, count = 20, barWidth = 3, gap = 3, analyser = null }) {
  const containerRef = useRef(null);
  const animRef = useRef(null);
  const heightsRef = useRef([]);
  const binMapRef = useRef([]);

  useEffect(() => {
    if (!active) {
      if (animRef.current) { cancelAnimationFrame(animRef.current); animRef.current = null; }
      if (containerRef.current) {
        Array.from(containerRef.current.children).forEach(el => { el.style.height = '8%'; el.style.opacity = '0.2'; });
      }
      return;
    }

    const bars = containerRef.current?.children;
    if (!bars) return;

    if (!heightsRef.current.length) {
      heightsRef.current = Array.from({ length: Math.min(count, bars.length) }, () => 0.05);
    }

    let dataArray = null;
    let bufferLength = 0;
    if (analyser) {
      bufferLength = analyser.frequencyBinCount;
      dataArray = new Uint8Array(bufferLength);

      // Pre-compute log-scale bin mapping once
      if (!binMapRef.current.length || binMapRef.current.length !== count) {
        binMapRef.current = Array.from({ length: count }, (_, i) => {
          const freq = 30 * Math.pow(16000 / 30, i / (count - 1));
          return Math.max(0, Math.min(bufferLength - 1, Math.round(freq / 22050 * bufferLength)));
        });
      }
    }

    // Frequency-dependent sensitivity multipliers
    // index 0..count-1 maps from bass to treble
    const getSensitivity = (i) => {
      const f = i / count;
      if (f < 0.15) return 0.6;   // deep bass: moderate
      if (f < 0.35) return 0.9;   // upper bass: sensitive
      if (f < 0.65) return 1.15;  // mids (vocals): most sensitive — most variation
      if (f < 0.85) return 0.85;  // lower treble
      return 0.55;                 // high treble: less sensitive (quieter in most music)
    };

    const animate = () => {
      if (analyser && dataArray && binMapRef.current.length) {
        analyser.getByteFrequencyData(dataArray);
        const h = heightsRef.current;

        for (let i = 0; i < Math.min(count, bars.length); i++) {
          const binIdx = binMapRef.current[i];

          // Sample ±1 bin and take max
          let maxVal = 0;
          for (let b = Math.max(0, binIdx - 1); b < Math.min(bufferLength, binIdx + 2); b++) {
            if (dataArray[b] > maxVal) maxVal = dataArray[b];
          }

          // Normalize 0-255 to 0-1
          const raw = maxVal / 255;

          // Apply power curve: exponent 2.5–3.5 creates strong contrast
          // Higher exponent = more difference between loud and quiet
          const power = 2.5 + (i / count) * 1.0; // 2.5 (bass) → 3.5 (treble)
          let value = Math.pow(raw, power);

          // Apply frequency-dependent sensitivity
          value = Math.min(1, value * getSensitivity(i));

          // Cap at 70% so bars never hit the ceiling — always room to breathe
          value = Math.min(0.70, value);

          // Minimum 3% so even silent frequency bands show a tiny nub
          const target = Math.max(0.03, value);

          // Smooth animation — fast up, slower down
          const speed = target > h[i] ? 0.55 : 0.28;
          h[i] = h[i] + (target - h[i]) * speed;

          bars[i].style.height = `${h[i] * 100}%`;
          bars[i].style.opacity = 0.18 + target * 1.15;
        }
      } else {
        // Fallback: gentle random walk
        const h = heightsRef.current;
        for (let i = 0; i < Math.min(count, bars.length); i++) {
          const target = Math.random() * 0.55 + 0.06;
          h[i] = h[i] + (target - h[i]) * 0.2;
          bars[i].style.height = `${h[i] * 100}%`;
          bars[i].style.opacity = Math.max(0.2, h[i] + 0.15);
        }
      }
      animRef.current = requestAnimationFrame(animate);
    };
    animate();

    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [active, count, analyser]);

  const colors = ['var(--color-cyber-purple)', 'var(--color-cyber-cyan)', 'var(--color-cyber-pink)'];

  return (
    <div ref={containerRef} className="flex items-end justify-center" style={{ height: 36, gap }}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="rounded-sm"
          style={{
            width: barWidth, height: '8%',
            background: `linear-gradient(to top, transparent, ${colors[i % 3]})`,
            boxShadow: active ? `0 0 4px ${colors[i % 3]}66` : 'none',
            opacity: 0.2,
          }} />
      ))}
    </div>
  );
}
