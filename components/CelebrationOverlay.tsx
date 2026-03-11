"use client";

import { useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CelebrationOverlayProps {
  agentName: string | null;
  onComplete: () => void;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  alpha: number;
  trailLength: number;
  color: string;
  width: number;
  decay: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

// Warm-gold luminescent palette — no saturated colours, only refined light
const PARTICLE_COLORS = [
  "#D4AF37", // gold-400
  "#ECC96A", // gold-300
  "#F7E7CE", // champagne
  "#FDF9EF", // gold-50
  "#FFFCF5", // near-white warm
  "#F5E0A9", // gold-200
  "#B08B30", // gold-600
];

// ─── Utility ──────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  const parts = name.trim().split(" ");
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();
}

// ─── Web Audio chime ──────────────────────────────────────────────────────────
// Three-note ascending C-major arpeggio (C5 → E5 → G5) rendered as pure sine
// waves with a fast attack and natural exponential decay. Kept deliberately
// quiet and short so it feels like a premium notification, not an alarm.

function playSuccessSound() {
  try {
    const ctx = new (window.AudioContext ||
      (window as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext!)();

    const master = ctx.createGain();
    master.gain.setValueAtTime(0.14, ctx.currentTime);
    master.connect(ctx.destination);

    const freqs = [523.25, 659.25, 783.99]; // C5, E5, G5
    freqs.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, ctx.currentTime);

      const start = ctx.currentTime + i * 0.13;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.38, start + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.65);

      osc.connect(gain);
      gain.connect(master);
      osc.start(start);
      osc.stop(start + 0.7);
    });
  } catch {
    // AudioContext unavailable (server-side or permissions blocked)
  }
}

// ─── Canvas Particle Engine ───────────────────────────────────────────────────
// Renders luminescent gold flares that burst outward from the avatar centre.
// Three sequential bursts add temporal depth without visual noise.
// Gravity gently curves the streaks downward for a physical, grounded feel.

interface CelebrationCanvasProps {
  active: boolean;
}

function CelebrationCanvas({ active }: CelebrationCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<number>(0);
  const particlesRef = useRef<Particle[]>([]);

  const spawnBurst = useCallback((canvas: HTMLCanvasElement) => {
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const count = 72;

    for (let i = 0; i < count; i++) {
      // Evenly distribute angles then add small jitter to avoid spoke-pattern
      const angle =
        (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.25;
      const speed = 1.8 + Math.random() * 5.2;

      particlesRef.current.push({
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        alpha: 0.85 + Math.random() * 0.15,
        trailLength: 10 + Math.random() * 28,
        color:
          PARTICLE_COLORS[
            Math.floor(Math.random() * PARTICLE_COLORS.length)
          ],
        width: 0.7 + Math.random() * 1.8,
        decay: 0.010 + Math.random() * 0.016,
      });
    }
  }, []);

  useEffect(() => {
    if (!active) {
      cancelAnimationFrame(frameRef.current);
      particlesRef.current = [];
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Match canvas logical size to its CSS-rendered size
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    // Three staggered bursts — immediate, then +550ms, then +1100ms
    spawnBurst(canvas);
    const t2 = setTimeout(() => spawnBurst(canvas), 550);
    const t3 = setTimeout(() => spawnBurst(canvas), 1100);

    function animate() {
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Remove fully faded particles
      particlesRef.current = particlesRef.current.filter(
        (p) => p.alpha > 0.01,
      );

      for (const p of particlesRef.current) {
        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = p.width;
        ctx.lineCap = "round";
        // Soft halo around each streak
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 8;

        // Draw streak: current position → behind it in the direction of travel
        const tailX = p.x - p.vx * (p.trailLength / 5);
        const tailY = p.y - p.vy * (p.trailLength / 5);
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(tailX, tailY);
        ctx.stroke();
        ctx.restore();

        // Physics: advance position, apply gentle gravity + drag
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.04;   // gravity
        p.vx *= 0.988;  // lateral drag
        p.vy *= 0.988;
        p.alpha -= p.decay;
      }

      frameRef.current = requestAnimationFrame(animate);
    }

    animate();

    return () => {
      cancelAnimationFrame(frameRef.current);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [active, spawnBurst]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
    />
  );
}

// ─── Celebration Overlay (exported) ───────────────────────────────────────────

export default function CelebrationOverlay({
  agentName,
  onComplete,
}: CelebrationOverlayProps) {
  const isVisible = agentName !== null;

  // Fire sound and schedule auto-dismiss on each new appearance
  useEffect(() => {
    if (!isVisible) return;
    playSuccessSound();
    const timer = setTimeout(onComplete, 4000);
    return () => clearTimeout(timer);
  // agentName in deps ensures retriggering if a different agent resolves
  // while the overlay is still mounted (edge case)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVisible, agentName]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.55, ease: [0.25, 0.46, 0.45, 0.94] }}
        >
          {/* ── Glassmorphism backdrop ── */}
          <div className="absolute inset-0 celebration-backdrop" />

          {/* ── Ambient vignette to focus the eye on centre ── */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "radial-gradient(ellipse 55% 55% at 50% 50%, transparent 20%, rgba(4,3,2,0.55) 100%)",
            }}
          />

          {/* ── Canvas particle layer — full screen ── */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <CelebrationCanvas active={isVisible} />
          </div>

          {/* ── Content card ── */}
          <div className="relative flex flex-col items-center gap-9 z-10 select-none">

            {/* Avatar circle */}
            <motion.div
              className="relative"
              initial={{ scale: 0.25, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.85, opacity: 0 }}
              transition={{
                duration: 0.75,
                // Slight settle (1.08 peak) — grounded, NOT a bounce
                ease: [0.34, 1.08, 0.64, 1],
                delay: 0.08,
              }}
            >
              {/* Breathing outer halo ring */}
              <div
                className="absolute inset-0 rounded-full animate-halo-breathe"
                style={{
                  boxShadow:
                    "0 0 0 1px rgba(212,175,55,0.35), " +
                    "0 0 55px 18px rgba(212,175,55,0.22), " +
                    "0 0 110px 36px rgba(212,175,55,0.10)",
                }}
              />

              {/* Avatar face */}
              <div
                className="celebration-avatar-glow relative flex items-center justify-center w-[110px] h-[110px] sm:w-[140px] sm:h-[140px] md:w-[168px] md:h-[168px]"
                style={{
                  borderRadius: "50%",
                  background:
                    "radial-gradient(circle at 38% 35%, #3A2910 0%, #1E1208 55%, #0E0905 100%)",
                  border: "1.5px solid rgba(212,175,55,0.45)",
                }}
              >
                {/* Inner ring accent */}
                <div
                  className="absolute inset-[6px] rounded-full pointer-events-none"
                  style={{ border: "1px solid rgba(212,175,55,0.12)" }}
                />
                <span
                  className="font-playfair text-[clamp(2.2rem,3.5vw,3.8rem)] text-gold-300 tracking-widest"
                  style={{
                    textShadow:
                      "0 0 18px rgba(212,175,55,0.85), " +
                      "0 0 40px rgba(212,175,55,0.40)",
                  }}
                >
                  {agentName ? getInitials(agentName) : ""}
                </span>
              </div>
            </motion.div>

            {/* Text block — delayed slide-up */}
            <motion.div
              className="flex flex-col items-center gap-3"
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              transition={{
                duration: 0.70,
                ease: [0.25, 0.46, 0.45, 0.94],
                delay: 0.42,
              }}
            >
              {/* Eyebrow label */}
              <p className="font-inter text-[13px] tracking-[0.65em] uppercase text-gold-500/70">
                Ticket Resolved
              </p>

              {/* Hero name — shimmer gradient */}
              <h2 className="celebration-shimmer-text font-playfair text-[clamp(2rem,4vw,3.6rem)] tracking-[0.15em] leading-none">
                {agentName}
              </h2>

              {/* Score badge */}
              <div className="flex items-center gap-5 mt-1">
                <div className="h-px w-24 bg-gradient-to-r from-transparent to-gold-500/45" />
                <span className="font-inter text-[13px] tracking-[0.5em] uppercase text-gold-400/65">
                  + 1 Point
                </span>
                <div className="h-px w-24 bg-gradient-to-l from-transparent to-gold-500/45" />
              </div>
            </motion.div>
          </div>

          {/* ── Subtle bottom fade ── */}
          <div
            className="absolute bottom-0 left-0 right-0 h-32 pointer-events-none"
            style={{
              background:
                "linear-gradient(to top, rgba(4,3,2,0.50), transparent)",
            }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
