import { useEffect, useRef } from 'react';

/**
 * CursorTrail — Glowing cyberpunk particles that follow the mouse WHILE MOVING.
 * No particles spawn when the mouse is stationary.
 * Canvas-based, pointer-events: none, z-index: 2.
 */
export default function CursorTrail() {
  const canvasRef = useRef(null);
  const particlesRef = useRef([]);
  const mouseRef = useRef({ x: -100, y: -100 });
  const lastSpawnRef = useRef({ x: -100, y: -100 });
  const animRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const onMove = (e) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener('mousemove', onMove, { passive: true });

    const spawn = () => {
      const { x, y } = mouseRef.current;
      const last = lastSpawnRef.current;
      if (x < 0 || y < 0) return;

      // Only spawn if mouse has actually moved since last spawn
      const dx = x - last.x;
      const dy = y - last.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 3) return; // stationary — no trail

      lastSpawnRef.current = { x, y };

      // Spawn count proportional to movement speed
      const count = Math.min(4, Math.floor(dist / 6) + 1);
      for (let s = 0; s < count; s++) {
        const t = s / count;
        const px = last.x + dx * t + (Math.random() - 0.5) * 4;
        const py = last.y + dy * t + (Math.random() - 0.5) * 4;
        particlesRef.current.push({
          x: px,
          y: py,
          life: 1,
          hue: [280, 190, 320, 195][Math.floor(Math.random() * 4)],
          size: 1.5 + Math.random() * 3,
        });
      }

      while (particlesRef.current.length > 30) {
        particlesRef.current.shift();
      }
    };

    const spawnInterval = setInterval(spawn, 25);

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const particles = particlesRef.current;

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life -= 0.035;

        if (p.life <= 0) {
          particles.splice(i, 1);
          continue;
        }

        const alpha = p.life * 0.65;
        const radius = p.size * p.life;

        // Outer glow
        const glowR = radius * 3.5;
        const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, glowR);
        glow.addColorStop(0, `hsla(${p.hue}, 100%, 65%, ${alpha * 0.3})`);
        glow.addColorStop(0.5, `hsla(${p.hue}, 100%, 60%, ${alpha * 0.1})`);
        glow.addColorStop(1, 'transparent');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(p.x, p.y, glowR, 0, Math.PI * 2);
        ctx.fill();

        // Mid glow
        const midR = radius * 1.5;
        ctx.fillStyle = `hsla(${p.hue}, 100%, 75%, ${alpha * 0.45})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, midR, 0, Math.PI * 2);
        ctx.fill();

        // Bright core
        ctx.fillStyle = `hsla(${p.hue}, 100%, 85%, ${alpha})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, radius * 0.6, 0, Math.PI * 2);
        ctx.fill();
      }

      animRef.current = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', onMove);
      clearInterval(spawnInterval);
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2,
        pointerEvents: 'none',
      }}
    />
  );
}
