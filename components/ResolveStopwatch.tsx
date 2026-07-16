"use client";

/**
 * components/ResolveStopwatch.tsx
 *
 * "Time Since Last Resolved" — a big digital stopwatch counting up from the
 * Queendom's most recent ticket resolution (QueenStats.lastResolvedAtMs,
 * re-derived by useDashboardData from tickets that are terminal right now —
 * NOT monotonic, so a resolve-then-revert un-resets it). When a ticket turns
 * terminal the anchor jumps forward, the digits snap back to 00:00 and the
 * card flashes an emerald surge; if that resolution is reverted the anchor
 * falls back and the digits jump back up. The composition (digits, hero glow, flanking
 * rules, units caption) shifts hue with age, reusing the dashboard's ticket
 * status colors: emerald → pending red (red-400 foil) at 30 min → overdue
 * neon red (error-overdue-glow, the leaderboard Overdue count) at 1 h
 * (PHASE_STYLES).
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
// < 30 min emerald (healthy) → < 1 h pending red (attention — the red-400 the
// Pending counts use) → 1 h+ overdue neon red (error-overdue-glow, exactly the
// leaderboard's Overdue count). Class strings are verbatim literals so
// Tailwind JIT emits them.
const PHASE_AGING_MS = 30 * 60_000;
const PHASE_OVERDUE_MS = 60 * 60_000;

const PHASE_STYLES = {
  healthy: {
    digits: "text-foil-emerald emerald-glow-hero",
    units: "text-emerald-200/75",
    rule: "via-emerald-300/20 to-emerald-300/45",
  },
  attention: {
    digits: "text-foil-red red-glow-hero",
    units: "text-red-200/75",
    rule: "via-red-400/25 to-red-400/50",
  },
  overdue: {
    digits: "error-overdue-glow",
    units: "text-red-400/85",
    rule: "via-red-600/30 to-red-600/60",
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
      ? "text-[min(68cqh,19cqw)]"
      : "text-[min(68cqh,31cqw)]";

  // No overflow-hidden: with the plinth gone there is nothing to clip, and the
  // 68+16+3cqh stack leaves real headroom — the digits can never be cut
  // against the title again (the band itself still clips as the outer guard).
  return (
    <div className="relative flex h-full w-full min-h-0 flex-col items-center justify-center [container-type:size]">
      {pulseKey > 0 && (
        <motion.div
          key={pulseKey}
          className="pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-b from-emerald-400/25 via-emerald-500/10 to-transparent"
          initial={surgeBgVariants.initial}
          animate={surgeBgVariants.animate}
          transition={surgeBgVariants.transition}
        />
      )}

      {/* Digits flanked by hairline rules (the design system's divider device):
          the rules flex-fill whatever width the current format leaves free, so
          a short MM:SS never floats in an empty plinth — and they recede as
          HH:MM:SS grows into the space. */}
      <div className="flex w-full items-center justify-center gap-[3cqw] px-[4cqw]">
        <span
          className={`h-px min-w-0 flex-1 bg-gradient-to-r from-transparent ${phase.rule}`}
          aria-hidden
        />
        <span
          className={`font-montserrat font-bold ${digitsSizeClass} leading-none tracking-[0.1em] tabular-nums ${
            elapsed == null ? "text-champagne/35" : phase.digits
          }`}
        >
          {elapsed?.digits ?? "--:--"}
        </span>
        <span
          className={`h-px min-w-0 flex-1 bg-gradient-to-l from-transparent ${phase.rule}`}
          aria-hidden
        />
      </div>
      {elapsed != null && (
        <span
          className={`mt-[3cqh] font-cinzel font-semibold uppercase leading-none tracking-[0.4em] text-[min(16cqh,3rem)] ${phase.units}`}
        >
          {elapsed.units}
        </span>
      )}
    </div>
  );
}
