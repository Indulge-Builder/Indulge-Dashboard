"use client";

/**
 * components/ResolveStopwatch.tsx
 *
 * "Time Since Last Resolved" — a big digital stopwatch counting up from the
 * Queendom's most recent ticket resolution (QueenStats.lastResolvedAtMs,
 * maintained monotonically by useDashboardData). When a ticket turns terminal
 * the anchor jumps forward, the digits snap back to 00:00 and the card
 * flashes a sage surge. The composition (plinth pill, digits, dot, flanking
 * rules, units caption) shifts hue with age using the neumorphic semantic
 * colors: accent-deep (healthy) → danger-deep at 30 min → danger-deep on a
 * danger-washed plinth at 1 h (PHASE_STYLES).
 *
 * TV-grade clock discipline (dry-audit H3/H4): the 1-second tick runs only
 * while this card is actually visible — useScreenActive() is false when the
 * concierge screen is faded out. Elapsed time derives from the wall clock, so
 * pause/resume never drifts.
 */

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useScreenActive } from "@/hooks/useScreenActive";
import { surgeBgVariants } from "@/lib/motionPresets";

interface ResolveStopwatchProps {
  /** UTC ms of the most recent resolution; null until one is seen. */
  lastResolvedAtMs?: number | null;
}

// ── Age phases: the longer since the last resolve, the hotter the warning ────
// < 30 min healthy → < 1 h attention → 1 h+ overdue. Class strings are
// verbatim literals so Tailwind JIT emits them.
const PHASE_AGING_MS = 30 * 60_000;
const PHASE_OVERDUE_MS = 60 * 60_000;

// Neumorphic phases: the digits sit on a raised honey-gold plinth pill with a
// breathing status dot. Hue escalates with age — accent-deep (healthy) →
// danger-deep at 30 min → danger-deep + danger-washed plinth at 1 h.
const PHASE_STYLES = {
  healthy: {
    digits: "text-neu-accent-deep",
    units: "text-neu-t2",
    ruleColor: "var(--neu-sage-deep)",
    dotColor: "var(--neu-sage-deep)",
    plinthWash: "var(--neu-accent)",
  },
  attention: {
    digits: "text-neu-danger-deep",
    units: "text-neu-danger-deep",
    ruleColor: "var(--neu-danger-deep)",
    dotColor: "var(--neu-danger-deep)",
    plinthWash: "var(--neu-accent)",
  },
  overdue: {
    digits: "text-neu-danger-deep font-extrabold",
    units: "text-neu-danger-deep",
    ruleColor: "var(--neu-danger-deep)",
    dotColor: "var(--neu-danger-deep)",
    plinthWash: "var(--neu-danger)",
  },
} as const;

function phaseFor(elapsedMs: number): (typeof PHASE_STYLES)[keyof typeof PHASE_STYLES] {
  if (elapsedMs >= PHASE_OVERDUE_MS) return PHASE_STYLES.overdue;
  if (elapsedMs >= PHASE_AGING_MS) return PHASE_STYLES.attention;
  return PHASE_STYLES.healthy;
}

function formatElapsed(ms: number): { digits: string; units: string } {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0
    ? { digits: `${pad(h)}:${pad(m)}:${pad(s)}`, units: "hrs · min · sec" }
    : { digits: `${pad(m)}:${pad(s)}`, units: "min · sec" };
}

export default function ResolveStopwatch({ lastResolvedAtMs }: ResolveStopwatchProps) {
  const active = useScreenActive();
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (!active || lastResolvedAtMs == null) return;
    // Resync immediately on resume/reset so the first visible frame is current.
    setNowMs(Date.now());
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [active, lastResolvedAtMs]);

  // Emerald surge when the anchor moves forward (a fresh resolution) — but not
  // on the first data arrival after mount, which is just the initial fetch.
  const prevAnchorRef = useRef<number | null>(lastResolvedAtMs ?? null);
  const [pulseKey, setPulseKey] = useState(0);
  useEffect(() => {
    const prev = prevAnchorRef.current;
    prevAnchorRef.current = lastResolvedAtMs ?? null;
    if (lastResolvedAtMs != null && prev != null && lastResolvedAtMs > prev) {
      setPulseKey((k) => k + 1);
    }
  }, [lastResolvedAtMs]);

  const elapsedMs =
    lastResolvedAtMs == null ? null : Math.max(0, nowMs - lastResolvedAtMs);
  const elapsed = elapsedMs == null ? null : formatElapsed(elapsedMs);
  const phase = phaseFor(elapsedMs ?? 0);

  // The wrapper is its own size container, so the digits scale off ITS height
  // and width (cqh/cqw below are wrapper-relative) and always fill the column
  // under the title. The width cap depends on the glyph count: MM:SS
  // (5 glyphs) may run larger than HH:MM:SS (8 glyphs) before touching the
  // edges. leading-none (not tighter) — a sub-1 line box lets the numeral ink
  // poke above it and get clipped against the title by overflow-hidden.
  // No surface/background — the timer sits directly on the band glass,
  // blended under its SectionDivider title.
  const digitsSizeClass =
    elapsed && elapsed.digits.length > 5
      ? "text-[min(50cqh,16cqw)]"
      : "text-[min(50cqh,26cqw)]";

  return (
    <div className="relative flex h-full w-full min-h-0 flex-col items-center justify-center [container-type:size]">
      {pulseKey > 0 && (
        <motion.div
          key={pulseKey}
          className="pointer-events-none absolute inset-0 rounded-neu-tile"
          style={{
            background:
              "linear-gradient(to bottom, color-mix(in srgb, var(--neu-sage) 32%, transparent), transparent)",
          }}
          initial={surgeBgVariants.initial}
          animate={surgeBgVariants.animate}
          transition={surgeBgVariants.transition}
        />
      )}

      {/* Digits on a raised honey-gold plinth pill, flanked by hairline rules:
          the rules flex-fill whatever width the current format leaves free, so
          a short MM:SS never floats — and they recede as HH:MM:SS grows. */}
      <div className="flex w-full items-center justify-center gap-[2cqw] px-[4cqw]">
        <span
          className="h-px min-w-0 flex-1"
          style={{
            background: `linear-gradient(to right, transparent, color-mix(in srgb, ${phase.ruleColor} 40%, transparent))`,
          }}
          aria-hidden
        />
        <span
          className="flex items-center gap-[1.2cqw] rounded-full border border-neu-edge shadow-neu px-[3cqw] py-[3cqh]"
          style={{
            background: `linear-gradient(145deg, color-mix(in srgb, ${phase.plinthWash} 20%, var(--neu-surface)), color-mix(in srgb, ${phase.plinthWash} 8%, var(--neu-surface)))`,
          }}
        >
          <span
            className="neu-anim-breathe inline-block flex-shrink-0 rounded-full"
            style={{
              width: "min(8cqh,1.4cqw)",
              height: "min(8cqh,1.4cqw)",
              background: phase.dotColor,
            }}
            aria-hidden
          />
          <span
            className={`font-montserrat font-bold ${digitsSizeClass} leading-none tracking-[0.08em] tabular-nums ${
              elapsed == null ? "text-neu-t3" : phase.digits
            }`}
          >
            {elapsed?.digits ?? "--:--"}
          </span>
        </span>
        <span
          className="h-px min-w-0 flex-1"
          style={{
            background: `linear-gradient(to left, transparent, color-mix(in srgb, ${phase.ruleColor} 40%, transparent))`,
          }}
          aria-hidden
        />
      </div>
      {elapsed != null && (
        <span
          className={`mt-[2cqh] font-cinzel font-semibold uppercase leading-none tracking-[0.4em] text-[min(14cqh,3rem)] ${phase.units}`}
        >
          {elapsed.units}
        </span>
      )}
    </div>
  );
}
