"use client";

import { memo, useEffect, useMemo } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { getInitials } from "@/lib/format";
import { EASE_LUXURY } from "@/lib/motionPresets";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CelebrationOverlayProps {
  agentName: string | null;
  onComplete: () => void;
}

// ─── Web Audio chime ───────────────────────────────────────────────────────────
// Module-level singleton AudioContext (dry-audit H1): Chromium caps concurrent
// contexts (~6), so creating one per celebration leaks audio threads over
// multi-day uptime until construction starts throwing and the chime dies.
// Create once, resume() on use (contexts start suspended without a gesture).
let sharedAudioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  try {
    if (!sharedAudioCtx) {
      const Ctor =
        window.AudioContext ||
        (window as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!Ctor) return null;
      sharedAudioCtx = new Ctor();
    }
    if (sharedAudioCtx.state === "suspended") void sharedAudioCtx.resume();
    return sharedAudioCtx;
  } catch {
    return null;
  }
}

function playSuccessSound() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
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

// ─── Plinth pop spring — the card lands like a set-down object ────────────────
const plinthSpring = {
  type: "spring" as const,
  stiffness: 260,
  damping: 20,
  mass: 0.9,
};

const backdropVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0, transition: { duration: 0.8 } },
};

// Staged card reveal: crown/disc first, then the label, name, point line.
const cardContainerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.14, delayChildren: 0.1 } },
};

const cardRiseVariants = {
  hidden: { opacity: 0, y: 22, scale: 0.97 },
  visible: { opacity: 1, y: 0, scale: 1, transition: plinthSpring },
};

// Reduced motion: same stagger tree, opacity-only targets.
const cardFadeVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.3 } },
};

// ─── Pastel confetti (CSS neu-confetti-fall — transform/opacity only) ─────────
const CONFETTI_COUNT = 48;
const CONFETTI_COLORS = [
  "var(--neu-accent)",
  "var(--neu-sage)",
  "var(--neu-powder)",
  "var(--neu-butter)",
  "var(--neu-lilac)",
  "var(--neu-peach)",
  "var(--neu-danger)",
] as const;

const PastelConfetti = memo(function PastelConfetti() {
  const pieces = useMemo(
    () =>
      Array.from({ length: CONFETTI_COUNT }, (_, i) => ({
        left: `${(Math.random() * 100).toFixed(1)}%`,
        width: `${(6 + Math.random() * 9).toFixed(1)}px`,
        height: `${(9 + Math.random() * 14).toFixed(1)}px`,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        radius: Math.random() < 0.4 ? "50%" : "2px",
        sway: `${((Math.random() - 0.5) * 12).toFixed(1)}vw`,
        duration: `${(2.2 + Math.random() * 1.6).toFixed(2)}s`,
        delay: `${(Math.random() * 0.7).toFixed(2)}s`,
      })),
    [],
  );

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
      {pieces.map((p, i) => (
        <div
          key={i}
          className="absolute top-0"
          style={{
            left: p.left,
            width: p.width,
            height: p.height,
            background: p.color,
            borderRadius: p.radius,
            ["--sway" as string]: p.sway,
            animation: `neu-confetti-fall ${p.duration} cubic-bezier(0.25,0.4,0.6,1) ${p.delay} both`,
          }}
        />
      ))}
    </div>
  );
});

// ─── Agent Card — plinth with crown, initials disc, name, caption ─────────────
const AgentCard = memo(function AgentCard({
  agentName,
  reducedMotion,
}: {
  agentName: string;
  reducedMotion: boolean;
}) {
  const rise = reducedMotion ? cardFadeVariants : cardRiseVariants;
  return (
    <motion.div
      className="relative z-10 select-none flex flex-col items-center gap-8 neu-raised rounded-neu-card shadow-neu-lg px-[clamp(3rem,6cqw,9rem)] py-[clamp(2.5rem,5cqh,7rem)]"
      variants={cardContainerVariants}
      initial="hidden"
      animate="visible"
      style={{ willChange: "transform, opacity" }}
    >
      {/* Floating crown */}
      <motion.span
        className="leading-none text-neu-accent-deep neu-letterpress text-[clamp(2.5rem,3.4cqw,5rem)]"
        variants={rise}
        aria-hidden
      >
        <span className="inline-block neu-anim-crown-float">♛</span>
      </motion.span>

      {/* Initials disc on the accent gradient */}
      <motion.div
        className="relative flex items-center justify-center rounded-full"
        variants={rise}
        style={{
          width: "var(--size-celebration-avatar)",
          height: "var(--size-celebration-avatar)",
          background: "var(--neu-accent-gradient)",
          border: "1px solid rgba(255,255,255,0.3)",
          boxShadow: "var(--neu-shadow-raised)",
          willChange: "transform, opacity",
        }}
      >
        <span
          className="font-cinzel font-extrabold text-8xl tracking-[0.2em]"
          style={{ color: "var(--neu-accent-fg)", transform: "translate3d(0,0,0)" }}
        >
          {getInitials(agentName)}
        </span>
      </motion.div>

      {/* Name block — each line arrives on its own beat */}
      <div className="relative flex flex-col items-center gap-4">
        <motion.p
          className="font-montserrat font-bold text-3xl sm:text-4xl tracking-[0.4em] uppercase text-neu-t2"
          variants={rise}
          style={{ willChange: "transform, opacity" }}
        >
          Ticket Resolved
        </motion.p>
        <motion.h2
          className="font-cinzel font-bold text-8xl sm:text-9xl tracking-[0.15em] uppercase text-neu-t1 neu-letterpress text-center"
          variants={rise}
          style={{ willChange: "transform, opacity" }}
        >
          {agentName}
        </motion.h2>
        <motion.div
          className="flex items-center gap-[clamp(0.75rem,1cqw,1.5rem)]"
          variants={rise}
          style={{ willChange: "transform, opacity" }}
        >
          <span className="neu-rule-l h-px w-[clamp(3rem,4cqw,6rem)]" aria-hidden />
          <span className="font-montserrat font-bold text-3xl sm:text-4xl tracking-[0.35em] uppercase text-neu-accent-deep">
            + 1 Point
          </span>
          <span className="neu-rule-r h-px w-[clamp(3rem,4cqw,6rem)]" aria-hidden />
        </motion.div>
      </div>
    </motion.div>
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

  const exitTransition = reducedMotion
    ? { duration: 0.2 }
    : { duration: 0.4, ease: EASE_LUXURY };

  return (
    <AnimatePresence>
      {isVisible && agentName && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center"
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
          {/* Cream scrim — 62% canvas wash (charcoal wash after dark) */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: "color-mix(in srgb, var(--neu-canvas) 62%, transparent)",
              transform: "translate3d(0,0,0)",
            }}
          />

          {/* Pastel confetti — skipped under reduced motion */}
          {!reducedMotion && <PastelConfetti key={agentName} />}

          {/* Plinth card — pops in on a spring; quick drift-up on exit */}
          <motion.div
            className="relative flex flex-col items-center"
            style={{
              willChange: "transform, opacity",
              transform: "translate3d(0, 0, 0)",
            }}
            initial={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
            animate={reducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1 }}
            exit={{
              opacity: 0,
              y: -20,
              transition: exitTransition,
            }}
            transition={reducedMotion ? { duration: 0.25 } : plinthSpring}
            layout={false}
          >
            <AgentCard agentName={agentName} reducedMotion={reducedMotion ?? false} />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

const CelebrationOverlay = memo(CelebrationOverlayInner);
CelebrationOverlay.displayName = "CelebrationOverlay";
export default CelebrationOverlay;
