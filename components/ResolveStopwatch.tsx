"use client";

/**
 * components/ResolveStopwatch.tsx
 *
 * "Since Last Resolve" — a big digital stopwatch counting up from the
 * Queendom's most recent ticket resolution (QueenStats.lastResolvedAtMs,
 * maintained monotonically by useDashboardData). When a ticket turns terminal
 * the anchor jumps forward, the digits snap back to 00:00 and the plinth
 * flashes an emerald surge.
 *
 * TV-grade clock discipline (dry-audit H3/H4): the 1-second tick runs only
 * while this card is actually visible — useScreenActive() is false when the
 * concierge screen is faded out AND when the band has rotated to the charts
 * view (RotatingViews nests the same context). Elapsed time derives from the
 * wall clock, so pause/resume never drifts.
 */

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useScreenActive } from "@/hooks/useScreenActive";
import { surgeBgVariants } from "@/lib/motionPresets";

interface ResolveStopwatchProps {
  /** UTC ms of the most recent resolution; null until one is seen. */
  lastResolvedAtMs?: number | null;
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

  const elapsed =
    lastResolvedAtMs == null ? null : formatElapsed(nowMs - lastResolvedAtMs);

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
          className="h-px min-w-0 flex-1 bg-gradient-to-r from-transparent via-emerald-300/20 to-emerald-300/45"
          aria-hidden
        />
        <span
          className={`font-montserrat font-bold ${digitsSizeClass} leading-none tracking-[0.1em] tabular-nums ${
            elapsed == null
              ? "text-champagne/35"
              : "text-foil-emerald emerald-glow-hero"
          }`}
        >
          {elapsed?.digits ?? "--:--"}
        </span>
        <span
          className="h-px min-w-0 flex-1 bg-gradient-to-l from-transparent via-emerald-300/20 to-emerald-300/45"
          aria-hidden
        />
      </div>
      {elapsed != null && (
        <span className="mt-[3cqh] font-cinzel font-semibold uppercase leading-none tracking-[0.4em] text-[min(16cqh,3rem)] text-emerald-200/75">
          {elapsed.units}
        </span>
      )}
    </div>
  );
}
