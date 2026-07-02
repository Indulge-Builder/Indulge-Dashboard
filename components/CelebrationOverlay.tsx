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

// ─── Staged card reveal ────────────────────────────────────────────────────────
// The card no longer arrives as one block: avatar lands first (heavier spring),
// then "Ticket Resolved", then the name (timed with the CSS gold sweep at
// 0.7s), then "+ 1 Point". Variants propagate through plain DOM wrappers via
// Framer context, so the memo'd AgentCard participates in the parent stagger.
const cardContainerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.16, delayChildren: 0.1 } },
};

const cardRiseVariants = {
  hidden: { opacity: 0, y: 26, scale: 0.96 },
  visible: { opacity: 1, y: 0, scale: 1, transition: luxurySpring },
};

const avatarPopVariants = {
  hidden: { opacity: 0, scale: 0.7 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { ...luxurySpring, stiffness: 95 },
  },
};

// Reduced motion: same stagger tree, opacity-only targets.
const cardFadeVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.3 } },
};

// ─── Shockwave rings — two expanding gold circles under the card ─────────────
// Runs once per celebration; scale + opacity only (compositor-safe).
const SHOCKWAVE_DELAYS = [0.12, 0.32];

const Shockwave = memo(function Shockwave() {
  return (
    <div
      className="absolute inset-0 flex items-center justify-center pointer-events-none"
      aria-hidden
    >
      {SHOCKWAVE_DELAYS.map((delay, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            width: "min(44vmin, 540px)",
            height: "min(44vmin, 540px)",
            border: "1px solid rgba(212, 175, 55, 0.6)",
            boxShadow:
              "0 0 40px rgba(212, 175, 55, 0.25), inset 0 0 40px rgba(212, 175, 55, 0.12)",
            willChange: "transform, opacity",
          }}
          initial={{ scale: 0.35, opacity: 0 }}
          animate={{ scale: 2.4, opacity: [0, 0.7, 0] }}
          transition={{ duration: 1.2, delay, ease: [0.22, 1, 0.36, 1] }}
        />
      ))}
    </div>
  );
});

// ─── Gold Dust Particles (GPU: transform only, unmount via AnimatePresence) ───
const GOLD_DUST_COUNT = 18;
const GOLD_COLORS = ["#D4AF37", "#ECC96A", "#F9E27E", "#F7E7CE"];

const GoldDustParticles = memo(function GoldDustParticles() {
  const particles = useMemo(
    () =>
      Array.from({ length: GOLD_DUST_COUNT }, (_, i) => {
        const angle =
          (Math.PI * 2 * i) / GOLD_DUST_COUNT + (Math.random() - 0.5) * 0.4;
        // Wider, more varied burst than the original 80–140px ring — reads as
        // an eruption instead of a stamp; timed to ride the first shockwave.
        const distance = 90 + Math.random() * 100;
        const tx = Math.cos(angle) * distance;
        const ty = Math.sin(angle) * distance;
        const delay = 0.15 + Math.random() * 0.3;
        const duration = 0.7 + Math.random() * 0.4;
        const size = 4 + Math.random() * 7;
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
    // No overflow-hidden: this layer is anchored to the avatar circle, and the
    // burst must fly well past its bounds (html/body already clip the page).
    <div className="absolute inset-0 pointer-events-none" aria-hidden>
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
  reducedMotion,
}: {
  agentName: string;
  reducedMotion: boolean;
}) {
  const rise = reducedMotion ? cardFadeVariants : cardRiseVariants;
  const pop = reducedMotion ? cardFadeVariants : avatarPopVariants;
  return (
    <motion.div
      className="relative flex flex-col items-center gap-10 z-10 select-none"
      variants={cardContainerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Agent Icon — circular, gold drop-shadow; lands first, heaviest spring.
          The shockwave rings + gold dust are anchored HERE (absolute inset-0 of
          this wrapper = the circle's box), so the burst erupts from the icon
          itself, not the screen center — the card's text block below used to
          pull the geometric center away from the circle. Source order keeps
          the effects painted beneath the disc. */}
      <div className="relative flex-shrink-0">
        {!reducedMotion && <Shockwave />}
        <GoldDustParticles />
        <motion.div
          className="relative flex items-center justify-center rounded-full"
          variants={pop}
          style={{
            width: "var(--size-celebration-avatar)",
            height: "var(--size-celebration-avatar)",
            boxShadow:
              "0 0 0 1px rgba(212,175,55,0.4), " +
              "0 0 40px 12px rgba(212,175,55,0.35), " +
              "0 0 80px 24px rgba(212,175,55,0.15)",
            background:
              "radial-gradient(circle at 38% 35%, #3A2910 0%, #1E1208 55%, #0E0905 100%)",
            border: "1.5px solid rgba(212,175,55,0.5)",
            willChange: "transform, opacity",
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
        </motion.div>
      </div>

      {/* Name block — each line arrives on its own beat */}
      <div className="relative flex flex-col items-center gap-4">
        <motion.p
          className="font-montserrat text-3xl sm:text-4xl tracking-[0.4em] uppercase text-gold-500/80"
          variants={rise}
          style={{ willChange: "transform, opacity" }}
        >
          Ticket Resolved
        </motion.p>
        <motion.div
          className="relative overflow-hidden rounded-xl px-12 py-4"
          variants={rise}
          style={{ willChange: "transform, opacity" }}
        >
          {/* Gold flash sweep — diagonal gradient, runs once (CSS delay 0.7s
              is timed to this element's stagger slot) */}
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
        </motion.div>
        <motion.span
          className="font-montserrat text-3xl sm:text-4xl tracking-[0.35em] uppercase text-gold-400/70"
          variants={rise}
          style={{ willChange: "transform, opacity" }}
        >
          + 1 Point
        </motion.span>
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

          {/* Rotating gold light rays — behind everything, slow turn, fades in.
              Skipped under reduced motion (continuous movement). */}
          {!reducedMotion && (
            <motion.div
              className="celebration-rays absolute pointer-events-none"
              style={{
                width: "150vmin",
                height: "150vmin",
                left: "50%",
                top: "50%",
                marginLeft: "-75vmin",
                marginTop: "-75vmin",
              }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.55 }}
              transition={{ duration: 0.9, ease: "easeOut", delay: 0.15 }}
              aria-hidden
            />
          )}

          {/* Shockwave rings + gold dust live INSIDE AgentCard now, anchored to
              the avatar circle — screen-centered here they burst around the
              name text, visibly off the icon. Still unmounted with the overlay
              (AnimatePresence). */}

          {/* Agent card — children stagger in (avatar → label → name → point);
              quick ease-out drift up on exit. The exit transition must live
              INSIDE the exit target — `exit:` is not a valid key of the
              `transition` prop, so the old spread silently ran the exit on the
              heavy spring. */}
          <motion.div
            className="relative flex flex-col items-center"
            style={{
              willChange: "transform, opacity",
              transform: "translate3d(0, 0, 0)",
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{
              opacity: 0,
              y: -20,
              transition: exitTransition,
            }}
            transition={{ duration: 0.25, ease: "easeOut" }}
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
