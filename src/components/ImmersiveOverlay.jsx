import { useEffect, useRef } from 'react';
import { playerState } from '../hooks/PlayerContext.jsx';

const DEFAULT_PALETTE = [
  { r: 179, g: 0, b: 255 },
  { r: 0, g: 200, b: 255 },
  { r: 255, g: 50, b: 120 },
  { r: 255, g: 180, b: 0 },
];

/**
 * ImmersiveOverlay — Audio-reactive particle galaxy.
 * Reacts to song changes: reloads cover, re-extracts palette.
 * Particles emit from rotating cover edge. Speed follows bass energy.
 * Click anywhere to dismiss.
 */
export default function ImmersiveOverlay({ active, onDismiss }) {
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const particlesRef = useRef([]);
  const coverImgRef = useRef(null);
  const paletteRef = useRef(DEFAULT_PALETTE);
  const mouseRef = useRef({ x: -9999, y: -9999 });
  const elapsedRef = useRef(0);
  const coverUrlRef = useRef('');

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    let W, H, cx, cy, coverR;
    const resize = () => {
      W = canvas.width = window.innerWidth;
      H = canvas.height = window.innerHeight;
      cx = W / 2;
      cy = H / 2;
      coverR = Math.min(W, H) * 0.13;
    };
    resize();
    window.addEventListener('resize', resize);

    const onMove = (e) => { mouseRef.current = { x: e.clientX, y: e.clientY }; };
    window.addEventListener('mousemove', onMove, { passive: true });

    // ── Load cover + palette ──
    function loadCoverAndPalette(url) {
      if (!url || url === coverUrlRef.current) return;
      coverUrlRef.current = url;
      coverImgRef.current = null;
      paletteRef.current = urlToPalette(url);

      // Load for palette (crossOrigin may fail on some CDNs)
      const imgCors = new Image();
      imgCors.crossOrigin = 'anonymous';
      imgCors.src = url;
      imgCors.onload = () => {
        paletteRef.current = extractPaletteSafe(imgCors, url);
      };
      // Load for display (no CORS needed — we only drawImage, no getImageData)
      const imgDisplay = new Image();
      imgDisplay.src = url;
      imgDisplay.onload = () => {
        coverImgRef.current = imgDisplay;
      };
    }
    // Initial load
    const track = playerState.track;
    if (track?.cover) loadCoverAndPalette(track.cover);

    // Background stars
    const stars = Array.from({ length: 50 }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      r: Math.random() * 1 + 0.2,
      twinkle: Math.random() * Math.PI * 2,
      speed: Math.random() * 0.01 + 0.003,
      opacity: Math.random() * 0.3 + 0.08,
    }));

    particlesRef.current = [];
    let smoothEnergy = 0.06;

    const animate = () => {
      elapsedRef.current++;
      const t = elapsedRef.current;

      // Audio energy
      let rawEnergy = 0.06;
      const analyser = playerState.analyser;
      if (analyser) {
        const buf = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(buf);
        let sum = 0;
        const bassBins = Math.floor(buf.length * 0.12);
        for (let i = 0; i < bassBins; i++) sum += buf[i];
        rawEnergy = sum / bassBins / 255;
      }
      smoothEnergy += (rawEnergy - smoothEnergy) * 0.04;
      const energy = Math.max(0.06, smoothEnergy);

      ctx.clearRect(0, 0, W, H);

      // Deep space bg
      const bg = ctx.createRadialGradient(cx, cy, coverR * 0.6, cx, cy, Math.max(W, H));
      bg.addColorStop(0, 'rgba(5,2,16,0.3)');
      bg.addColorStop(0.5, 'rgba(2,1,8,0.8)');
      bg.addColorStop(1, 'rgba(0,0,3,1)');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      // Stars
      stars.forEach(s => {
        s.twinkle += s.speed;
        ctx.fillStyle = `rgba(150,150,210,${s.opacity * (0.3 + 0.7 * Math.sin(s.twinkle))})`;
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
      });

      // ── Check for track change every frame ──
      const currentTrack = playerState.track;
      if (currentTrack?.cover && currentTrack.cover !== coverUrlRef.current) {
        loadCoverAndPalette(currentTrack.cover);
      }

      // ── Emit from cover edge ──
      const palette = paletteRef.current;
      const emitCount = Math.floor(3 + energy * 18);
      for (let i = 0; i < emitCount; i++) {
        const angle = Math.random() * Math.PI * 2;
        const edgeX = cx + Math.cos(angle) * coverR;
        const edgeY = cy + Math.sin(angle) * coverR;
        const speed = (0.04 + energy * 1.5) * (0.7 + Math.random() * 0.6);
        const col = palette[Math.floor(Math.random() * palette.length)];
        particlesRef.current.push({
          x: edgeX, y: edgeY,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 1, decay: 0.002 + Math.random() * 0.004,
          r: col.r, g: col.g, b: col.b,
          size: 0.6 + Math.random() * 2,
        });
      }
      while (particlesRef.current.length > 2500) particlesRef.current.shift();

      // ── Draw particles ──
      ctx.globalCompositeOperation = 'lighter';
      const mouse = mouseRef.current;
      for (let i = particlesRef.current.length - 1; i >= 0; i--) {
        const p = particlesRef.current[i];
        p.life -= p.decay;
        if (p.life <= 0) { particlesRef.current.splice(i, 1); continue; }

        const dx = p.x - mouse.x, dy = p.y - mouse.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 160 && dist > 0) {
          const f = (1 - dist / 160) * 1.2;
          p.vx += (dx / dist) * f * 0.08;
          p.vy += (dy / dist) * f * 0.08;
        }
        p.x += p.vx; p.y += p.vy;
        p.vx *= 0.996; p.vy *= 0.996;

        const alpha = p.life * 0.65;
        const size = p.size * p.life;
        const gr = size * 7;
        const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, gr);
        glow.addColorStop(0, `rgba(${p.r},${p.g},${p.b},${alpha * 0.55})`);
        glow.addColorStop(0.3, `rgba(${p.r},${p.g},${p.b},${alpha * 0.15})`);
        glow.addColorStop(1, 'transparent');
        ctx.fillStyle = glow;
        ctx.beginPath(); ctx.arc(p.x, p.y, gr, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = `rgba(255,255,255,${alpha * 0.7})`;
        ctx.beginPath(); ctx.arc(p.x, p.y, size * 0.5, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';

      // ── Center cover ──
      const coverImg = coverImgRef.current || playerState.track?.cover;
      if (coverImg) {
        const p0 = palette[0];
        const halo = ctx.createRadialGradient(cx, cy, coverR * 0.7, cx, cy, coverR * 1.8);
        halo.addColorStop(0, 'transparent');
        halo.addColorStop(0.4, `rgba(${p0.r},${p0.g},${p0.b},0.12)`);
        halo.addColorStop(1, 'transparent');
        ctx.fillStyle = halo;
        ctx.beginPath(); ctx.arc(cx, cy, coverR * 1.8, 0, Math.PI * 2); ctx.fill();

        ctx.strokeStyle = `rgba(${p0.r},${p0.g},${p0.b},${0.15 + energy * 0.3})`;
        ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.arc(cx, cy, coverR + 3, 0, Math.PI * 2); ctx.stroke();

        ctx.save();
        ctx.beginPath(); ctx.arc(cx, cy, coverR, 0, Math.PI * 2); ctx.clip();
        ctx.translate(cx, cy);
        ctx.rotate(t * 0.004);
        // Handle both Image objects and URL strings
        if (typeof coverImg === 'string') {
          // Draw URL string — already in an Image, need to use the ref
          // This path shouldn't normally be hit; fallback to just the glow
        } else {
          ctx.drawImage(coverImg, -coverR, -coverR, coverR * 2, coverR * 2);
        }
        ctx.restore();
      }

      animRef.current = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', onMove);
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, []);

  const track = playerState.track;
  const p0 = paletteRef.current[0];

  return (
    <div onClick={onDismiss} style={{
      position: 'fixed', inset: 0, zIndex: 30,
      opacity: active ? 1 : 0,
      pointerEvents: active ? 'auto' : 'none',
      transition: 'opacity 1.8s ease-in-out',
      background: '#010006', cursor: 'none',
    }}>
      <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0 }} />
      {track && active && (
        <div style={{
          position: 'absolute', bottom: '6%', left: '50%',
          transform: 'translateX(-50%)', textAlign: 'center',
        }}>
          <p style={{
            fontFamily: 'var(--font-display)', fontSize: '15px', fontWeight: 900,
            letterSpacing: '0.22em', textTransform: 'uppercase', color: '#fff',
            textShadow: `0 0 20px rgb(${p0.r},${p0.g},${p0.b}), 0 0 40px rgba(${p0.r},${p0.g},${p0.b},0.35)`,
            margin: 0,
          }}>{track.name}</p>
          <p style={{
            fontFamily: 'var(--font-mono)', fontSize: '10px',
            letterSpacing: '0.18em', color: 'rgba(255,255,255,0.45)', marginTop: 4,
          }}>{track.artist}</p>
          <p style={{
            fontFamily: 'var(--font-mono)', fontSize: '7px',
            letterSpacing: '0.12em', color: 'rgba(255,255,255,0.12)', marginTop: 14,
          }}>tap anywhere to exit immersion</p>
        </div>
      )}
    </div>
  );
}

// ── URL-based color palette (works without CORS, instant) ──
function urlToPalette(url) {
  // Generate deterministic hue from URL hash
  let hash = 0;
  for (let i = 0; i < url.length; i++) {
    hash = ((hash << 5) - hash) + url.charCodeAt(i);
    hash |= 0;
  }
  const baseHue = Math.abs(hash) % 360;
  return [
    hslToRgb(baseHue, 80, 55),
    hslToRgb((baseHue + 40) % 360, 75, 60),
    hslToRgb((baseHue + 140) % 360, 70, 50),
    hslToRgb((baseHue + 200) % 360, 85, 58),
  ];
}

function hslToRgb(h, s, l) {
  s /= 100; l /= 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else { r = c; b = x; }
  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
  };
}

// ── Safe palette extraction (handles CORS) ──
function extractPaletteSafe(img, fallbackUrl) {
  try {
    const c = document.createElement('canvas');
    c.width = c.height = 80;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0, 80, 80);
    const data = ctx.getImageData(0, 0, 80, 80).data;

    const pixels = [];
    for (let i = 0; i < data.length; i += 16) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const br = (r + g + b) / 3;
      if (br > 25 && br < 235) pixels.push({ r, g, b });
    }
    if (pixels.length < 10) return urlToPalette(fallbackUrl);

    // K-means clustering
    const K = 4, clusters = [];
    for (let k = 0; k < K; k++) {
      const p = pixels[Math.floor(Math.random() * pixels.length)];
      clusters.push({ r: p.r, g: p.g, b: p.b, count: 0, sr: 0, sg: 0, sb: 0 });
    }
    for (let iter = 0; iter < 3; iter++) {
      clusters.forEach(c => { c.count = 0; c.sr = 0; c.sg = 0; c.sb = 0; });
      for (const p of pixels) {
        let best = 0, bestD = Infinity;
        for (let k = 0; k < K; k++) {
          const dr = p.r - clusters[k].r, dg = p.g - clusters[k].g, db = p.b - clusters[k].b;
          const d = dr * dr + dg * dg + db * db;
          if (d < bestD) { bestD = d; best = k; }
        }
        clusters[best].count++; clusters[best].sr += p.r; clusters[best].sg += p.g; clusters[best].sb += p.b;
      }
      for (const c of clusters) {
        if (c.count > 0) { c.r = Math.round(c.sr / c.count); c.g = Math.round(c.sg / c.count); c.b = Math.round(c.sb / c.count); }
      }
    }
    return clusters.filter(c => c.count > 0).map(c => {
      const max = Math.max(c.r, c.g, c.b);
      if (max < 220 && max > 0) {
        const s = 230 / max;
        return { r: Math.min(255, Math.round(c.r * s)), g: Math.min(255, Math.round(c.g * s)), b: Math.min(255, Math.round(c.b * s)) };
      }
      return { r: c.r, g: c.g, b: c.b };
    });
  } catch {
    return urlToPalette(fallbackUrl);
  }
}
