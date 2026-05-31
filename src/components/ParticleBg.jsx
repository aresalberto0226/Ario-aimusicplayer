import { useEffect, useRef } from 'react';

/**
 * Cyberpunk particle background — floating particles, line connections,
 * data streams, and large slow-drifting nebula/aurora blobs for a cosmic feel.
 */
export default function ParticleBg() {
  const canvasRef = useRef(null);

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

    // Small floating particles
    const particles = Array.from({ length: 50 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 1.8 + 0.4,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      hue: [280, 190, 320, 140][Math.floor(Math.random() * 4)],
      opacity: Math.random() * 0.45 + 0.1,
      pulse: Math.random() * Math.PI * 2,
      pulseSpeed: Math.random() * 0.015 + 0.004,
    }));

    // Vertical data streams
    const streams = Array.from({ length: 8 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      length: Math.random() * 50 + 25,
      speed: Math.random() * 1.2 + 0.5,
      hue: [190, 280][Math.floor(Math.random() * 2)],
      opacity: Math.random() * 0.2 + 0.04,
      width: Math.random() * 1.2 + 0.4,
    }));

    // Large nebula blobs — slow-drifting aurora-like soft glows
    const nebulaBlobs = Array.from({ length: 4 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      radius: Math.random() * 300 + 150,
      vx: (Math.random() - 0.5) * 0.15,
      vy: (Math.random() - 0.5) * 0.1,
      hue: [280, 190, 260, 200][Math.floor(Math.random() * 4)],
      opacity: Math.random() * 0.08 + 0.03,
      pulsePhase: Math.random() * Math.PI * 2,
      pulseSpeed: Math.random() * 0.003 + 0.001,
    }));

    let frame;
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw nebula blobs first (soft background glow)
      nebulaBlobs.forEach(b => {
        b.x += b.vx;
        b.y += b.vy;
        b.pulsePhase += b.pulseSpeed;

        // Wrap slowly around screen
        if (b.x < -b.radius) b.x = canvas.width + b.radius;
        if (b.x > canvas.width + b.radius) b.x = -b.radius;
        if (b.y < -b.radius) b.y = canvas.height + b.radius;
        if (b.y > canvas.height + b.radius) b.y = -b.radius;

        const pulse = 0.7 + 0.3 * Math.sin(b.pulsePhase);
        const alpha = b.opacity * pulse;

        const gradient = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.radius);
        gradient.addColorStop(0, `hsla(${b.hue}, 100%, 50%, ${alpha})`);
        gradient.addColorStop(0.4, `hsla(${b.hue}, 100%, 40%, ${alpha * 0.6})`);
        gradient.addColorStop(0.7, `hsla(${b.hue}, 100%, 30%, ${alpha * 0.2})`);
        gradient.addColorStop(1, 'transparent');
        ctx.fillStyle = gradient;
        ctx.fillRect(b.x - b.radius, b.y - b.radius, b.radius * 2, b.radius * 2);
      });

      // Data streams
      streams.forEach(s => {
        s.y -= s.speed;
        if (s.y + s.length < 0) {
          s.y = canvas.height + Math.random() * 100;
          s.x = Math.random() * canvas.width;
        }
        const gradient = ctx.createLinearGradient(s.x, s.y, s.x, s.y + s.length);
        gradient.addColorStop(0, `hsla(${s.hue}, 100%, 60%, ${s.opacity})`);
        gradient.addColorStop(1, 'transparent');
        ctx.strokeStyle = gradient;
        ctx.lineWidth = s.width;
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(s.x, s.y + s.length);
        ctx.stroke();
      });

      // Small particles
      particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.pulse += p.pulseSpeed;
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;

        const pulseFactor = 0.7 + 0.3 * Math.sin(p.pulse);
        const currentOpacity = p.opacity * pulseFactor;

        // Glow
        const glowR = p.r * 5;
        const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, glowR);
        glow.addColorStop(0, `hsla(${p.hue}, 100%, 65%, ${currentOpacity * 0.2})`);
        glow.addColorStop(1, 'transparent');
        ctx.fillStyle = glow;
        ctx.beginPath(); ctx.arc(p.x, p.y, glowR, 0, Math.PI * 2); ctx.fill();

        // Core
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${p.hue}, 100%, 80%, ${currentOpacity})`;
        ctx.fill();
      });

      // Connections between nearby particles
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 70) {
            const alpha = (1 - dist / 70) * 0.06;
            ctx.strokeStyle = `hsla(${particles[i].hue}, 100%, 60%, ${alpha})`;
            ctx.lineWidth = 0.4;
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
          }
        }
      }

      frame = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0"
      style={{ opacity: 0.85 }}
    />
  );
}
