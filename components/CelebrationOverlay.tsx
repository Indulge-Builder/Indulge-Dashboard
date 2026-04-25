"use client";

import { memo, useEffect, useMemo } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CelebrationOverlayProps {
  agentName: string | null;
  onComplete: () => void;
}

function getInitials(name: string): string {
  const parts = name.trim().split(" ");
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();
}

// ─── Web Audio chime (unchanged) ───────────────────────────────────────────────
function playSuccessSound() {
  try {
    const ctx = new (
      window.AudioContext ||
      (window as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext!
    )();
    const master = ctx.createGain();
    master.gain.setValueAtTime(0.14, ctx.currentTime);
    master.connect(ctx.destination);
    const freqs = [523.25, 659.25, 783.99];
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
    /* AudioContext unavailable */
  }
}

// ─── Golden Ratio Spring — weighted luxury feel ──────────────────────────────
const luxurySpring = {
  type: "spring" as const,
  stiffness: 80,
  damping: 15,
  mass: 1.2,
};

const backdropVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0, transition: { duration: 0.8 } },
};

// ─── Gold Dust Particles (GPU: transform only, unmount via AnimatePresence) ───
const GOLD_DUST_COUNT = 12;
const GOLD_COLORS = ["#D4AF37", "#ECC96A", "#F9E27E", "#F7E7CE"];

const GoldDustParticles = memo(function GoldDustParticles() {
  const particles = useMemo(
    () =>
      Array.from({ length: GOLD_DUST_COUNT }, (_, i) => {
        const angle =
          (Math.PI * 2 * i) / GOLD_DUST_COUNT + (Math.random() - 0.5) * 0.4;
        const distance = 80 + Math.random() * 60;
        const tx = Math.cos(angle) * distance;
        const ty = Math.sin(angle) * distance;
        const delay = 0.1 + Math.random() * 0.15;
        const duration = 0.6 + Math.random() * 0.2;
        const size = 4 + Math.random() * 6;
        return {
          tx,
          ty,
          delay,
          duration,
          size,
          color: GOLD_COLORS[i % GOLD_COLORS.length],
        };
      }),
    [],
  );

  return (
    <div
      className="absolute inset-0 pointer-events-none overflow-hidden"
      aria-hidden
    >
      {particles.map((p, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            left: "50%",
            top: "50%",
            width: p.size,
            height: p.size,
            marginLeft: -p.size / 2,
            marginTop: -p.size / 2,
            background: p.color,
            boxShadow: `0 0 ${p.size}px ${p.color}`,
            willChange: "transform",
            transform: "translate3d(0,0,0)",
          }}
          initial={{ opacity: 0, scale: 0, x: 0, y: 0 }}
          animate={{
            opacity: [0, 0.9, 0],
            scale: [0, 1, 0.5],
            x: p.tx,
            y: p.ty,
          }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            ease: "easeOut",
          }}
        />
      ))}
    </div>
  );
});

// ─── Agent Card (memo'd inner) ─────────────────────────────────────────────────
const AgentCard = memo(function AgentCard({
  agentName,
}: {
  agentName: string;
}) {
  return (
    <div className="relative flex flex-col items-center gap-10 z-10 select-none">
      {/* Agent Icon — circular, gold drop-shadow */}
      <div
        className="relative flex items-center justify-center rounded-full flex-shrink-0"
        style={{
          width: 220,
          height: 220,
          boxShadow:
            "0 0 0 1px rgba(212,175,55,0.4), " +
            "0 0 40px 12px rgba(212,175,55,0.35), " +
            "0 0 80px 24px rgba(212,175,55,0.15)",
          background:
            "radial-gradient(circle at 38% 35%, #3A2910 0%, #1E1208 55%, #0E0905 100%)",
          border: "1.5px solid rgba(212,175,55,0.5)",
          transform: "translate3d(0,0,0)",
        }}
      >
        <span
          className="font-cinzel text-8xl tracking-[0.2em] text-gold-300"
          style={{
            textShadow: "0 0 20px rgba(212,175,55,0.8)",
            transform: "translate3d(0,0,0)",
          }}
        >
          {getInitials(agentName)}
        </span>
      </div>

      {/* Name card with gold flash sweep */}
      <div className="relative flex flex-col items-center gap-4">
        <p className="font-inter text-3xl sm:text-4xl tracking-[0.4em] uppercase text-gold-500/80">
          Ticket Resolved
        </p>
        <div className="relative overflow-hidden rounded-xl px-12 py-4">
          {/* Gold flash sweep — diagonal gradient, runs once */}
          <div
            className="celebration-name-flash absolute inset-0 pointer-events-none"
            style={{ transform: "translate3d(0,0,0)" }}
            aria-hidden
          />
          <h2
            className="font-cinzel text-8xl sm:text-9xl tracking-[0.15em] text-gold-300 relative z-10"
            style={{
              textShadow: "0 0 24px rgba(212,175,55,0.5)",
              transform: "translate3d(0,0,0)",
            }}
          >
            {agentName}
          </h2>
        </div>
        <span className="font-inter text-3xl sm:text-4xl tracking-[0.35em] uppercase text-gold-400/70">
          + 1 Point
        </span>
      </div>
    </div>
  );
});

// ─── Celebration Overlay (memo'd, GPU-optimized) ───────────────────────────────

function CelebrationOverlayInner({
  agentName,
  onComplete,
}: CelebrationOverlayProps) {
  const reducedMotion = useReducedMotion();
  const isVisible = agentName !== null;

  useEffect(() => {
    if (!isVisible) return;
    playSuccessSound();
    const timer = setTimeout(onComplete, 3000);
    return () => clearTimeout(timer);
  }, [isVisible, agentName, onComplete]);

  // Reduced motion: simpler, shorter animation
  const springIn = reducedMotion
    ? { type: "tween" as const, duration: 0.3 }
    : luxurySpring;

  const exitTransition = reducedMotion
    ? { duration: 0.2 }
    : { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] };

  return (
    <AnimatePresence>
      {isVisible && agentName && (
        <motion.div
          className="celebration-container fixed inset-0 z-50 flex items-center justify-center"
          style={{
            willChange: "transform, opacity",
            transform: "translate3d(0, 0, 0)",
            backfaceVisibility: "hidden",
          }}
          variants={backdropVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          layout={false}
        >
          {/* Backdrop — radial gradient black to transparent */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "radial-gradient(ellipse 60% 60% at 50% 50%, transparent 15%, rgba(5,5,5,0.7) 70%, rgba(0,0,0,0.92) 100%)",
              transform: "translate3d(0,0,0)",
            }}
          />

          {/* Gold dust particles — fully unmounted when overlay exits (AnimatePresence) */}
          <GoldDustParticles />

          {/* Agent card — scale in with spring, drift up on exit (GPU: transform/opacity only) */}
          <motion.div
            className="relative flex flex-col items-center"
            style={{
              willChange: "transform, opacity",
              transform: "translate3d(0, 0, 0)",
            }}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{
              scale: 1,
              opacity: 0,
              y: -20,
            }}
            transition={{
              ...springIn,
              exit: exitTransition,
            }}
            layout={false}
          >
            <AgentCard agentName={agentName} />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

const CelebrationOverlay = memo(CelebrationOverlayInner);
CelebrationOverlay.displayName = "CelebrationOverlay";
export default CelebrationOverlay;
