"use client";

/**
 * components/onboarding/ConversionLedger.tsx
 *
 * The "Conversion Ledger" section of the Onboarding screen.
 *
 * Layout:
 *   ┌─────────────────────────────────┐
 *   │  "Conversion Ledger"            │  decorative heading + gold rules
 *   ├─────────────────────────────────┤
 *   │  Client │ Date │ Agent          │  sticky column header
 *   ├─────────────────────────────────┤
 *   │  scrolling rows (rAF ticker)    │  flex-1; rows duplicated for seamless loop
 *   └─────────────────────────────────┘
 *
 * Scroll mechanism — rAF-based pixel ticker (NOT CSS @keyframes):
 *   - Translates the track by an incrementally-growing px offset each frame.
 *   - When offset reaches the height of the primary row block, it wraps back
 *     by exactly that amount — pixel-perfect, zero visual flash.
 *   - On new row prepended: scroll position is compensated by one avg-row height
 *     so visible content stays put — no jarring snap-to-top on a TV display.
 *   - primaryH is cached in a ref (updated via useLayoutEffect) so the rAF hot
 *     path never triggers a forced layout recalc each frame.
 *   - dt is capped at 100 ms so a tab-switch pause never produces a jump.
 *
 * When prefers-reduced-motion is active the rAF loop is skipped and the
 * duplicate rows are omitted — a static, accessible list is rendered instead.
 *
 * Accepts `rows` pre-sorted newest-first by OnboardingPanel (sortLedgerNewestFirst).
 * The `scrollDuration` is derived in the parent and used to set scroll speed.
 */

import { useEffect, useLayoutEffect, useRef } from "react";
import type { CSSProperties } from "react";
import type { OnboardingLedgerRow } from "@/lib/onboardingTypes";
import {
  ONBOARDING_LEDGER_TITLE_FONT,
  ONBOARDING_LEDGER_HEADER_FONT,
  ONBOARDING_LEDGER_CELL_FONT,
  formatLedgerDate,
} from "./utils";

// ── Department accent tokens ───────────────────────────────────────────────────
const DEPT_ACCENT = {
  concierge: {
    border: "rgba(212,175,55,0.38)",
    gradient:
      "linear-gradient(to right, rgba(212,175,55,0.065) 0%, transparent 42%)",
  },
  shop: {
    border: "rgba(125,211,252,0.42)",
    gradient:
      "linear-gradient(to right, rgba(125,211,252,0.065) 0%, transparent 42%)",
  },
} as const;

// ── Single row ────────────────────────────────────────────────────────────────
function ConversionLedgerRow({
  row,
  ariaHidden,
}: {
  row: OnboardingLedgerRow;
  ariaHidden?: boolean;
}) {
  const cell = { fontSize: ONBOARDING_LEDGER_CELL_FONT } as CSSProperties;
  const accent = DEPT_ACCENT[row.department ?? "concierge"];

  return (
    <div
      className="relative grid grid-cols-3 items-center gap-x-1 border-b border-gold-500/[0.07] py-[clamp(10px,min(1.6vmin,1.8vh),22px)] sm:gap-x-2 md:gap-x-4"
      style={{
        borderLeft: `2px solid ${accent.border}`,
        paddingLeft: "clamp(6px,1vmin,10px)",
      }}
      aria-hidden={ariaHidden}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: accent.gradient }}
      />
      <span
        className="relative min-w-0 truncate px-1 text-center font-inter font-medium leading-none text-champagne"
        style={cell}
      >
        {row.clientName}
      </span>
      <span
        className="relative min-w-0 truncate px-1 text-center font-inter font-medium leading-none text-champagne/90"
        style={cell}
      >
        {formatLedgerDate(row.recordedAt)}
      </span>
      <span
        className="relative min-w-0 truncate px-1 text-center font-inter font-semibold leading-none text-champagne"
        style={cell}
      >
        {row.agentName}
      </span>
    </div>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────
export interface ConversionLedgerProps {
  /** Pre-sorted newest-first. Passed directly from OnboardingPanel's useMemo. */
  rows: OnboardingLedgerRow[];
  /** CSS duration string e.g. "48s". Converted to px/s speed inside the rAF loop. */
  scrollDuration: string;
  prefersReducedMotion: boolean;
}

// ── ConversionLedger ──────────────────────────────────────────────────────────
export function ConversionLedger({
  rows,
  scrollDuration,
  prefersReducedMotion,
}: ConversionLedgerProps) {
  // ── Refs for the rAF ticker (mutated directly — no re-renders needed) ──────
  const trackRef = useRef<HTMLDivElement>(null);
  const primaryRef = useRef<HTMLDivElement>(null);
  const posRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);
  const durationRef = useRef(48); // seconds for one full primary-block scroll

  // Cached primary-block pixel height — written after layout, read in the rAF
  // hot path so we never trigger a forced layout recalc every frame.
  const primaryHRef = useRef(0);

  // Tracks the id of the first (newest) row seen on the previous render, used
  // to distinguish a single prepend from a full data reload.
  const prevFirstIdRef = useRef(rows[0]?.id ?? "");

  // Keep durationRef in sync with the prop without triggering rAF restarts
  useEffect(() => {
    const match = scrollDuration.match(/^(\d+(?:\.\d+)?)s$/);
    durationRef.current = match ? parseFloat(match[1]) : 48;
  }, [scrollDuration]);

  // Re-measure primary-block height after layout whenever row count changes.
  // useLayoutEffect fires before useEffect, so primaryHRef is fresh when the
  // rows-change effect below reads it.
  useLayoutEffect(() => {
    if (primaryRef.current) {
      primaryHRef.current = primaryRef.current.offsetHeight;
    }
  }, [rows.length]);

  // Handle row set changes.
  //   • Empty state / initial hydration  → snap to top (newest row visible).
  //   • Single new row prepended          → nudge scroll by one avg-row height
  //                                         so the currently visible content
  //                                         stays put on the TV screen.
  //   • Full reload with same leading row → no action needed.
  useEffect(() => {
    const currFirstId = rows[0]?.id ?? "";
    const prevFirstId = prevFirstIdRef.current;
    prevFirstIdRef.current = currFirstId;

    if (rows.length === 0 || prevFirstId === "") {
      posRef.current = 0;
      lastTimeRef.current = null;
      if (trackRef.current) {
        trackRef.current.style.transform = "translate3d(0,0,0)";
      }
      return;
    }

    if (currFirstId !== prevFirstId && primaryHRef.current > 0) {
      // Compensate: the new row shifted everything down by one row height.
      // Adding that amount keeps the currently visible rows stationary.
      posRef.current += primaryHRef.current / rows.length;
    }
    // Same leading row (refetch with no newer entry) — leave position as-is.
  }, [rows]);

  // ── rAF ticker ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (prefersReducedMotion || rows.length === 0) return;

    const tick = (time: number) => {
      const track = trackRef.current;
      const primary = primaryRef.current;

      if (!track || !primary) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      if (lastTimeRef.current !== null) {
        // Cap dt at 100 ms — prevents a large jump when the tab was hidden
        const dt = Math.min((time - lastTimeRef.current) / 1000, 0.1);
        const primaryH = primaryHRef.current; // cached — no forced layout recalc

        if (primaryH > 0) {
          const speed = primaryH / durationRef.current; // px per second
          posRef.current += speed * dt;

          // Seamless wrap: subtract exactly one primary-block height
          // The clone below is pixel-identical, so this is invisible
          if (posRef.current >= primaryH) {
            posRef.current -= primaryH;
          }

          track.style.transform = `translate3d(0,${-posRef.current}px,0)`;
        }
      }

      lastTimeRef.current = time;
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      lastTimeRef.current = null;
    };
  }, [prefersReducedMotion, rows.length]);

  return (
    <div
      className="relative flex min-h-0 flex-1 flex-col overflow-hidden"
      style={{
        padding:
          "clamp(0.85rem, min(2.1vh, 2.4vmin), 2rem) clamp(0.75rem, min(2.5vmin, 3.2vw), 2.5rem)",
      }}
    >
      {/* ── Section heading ── */}
      <div className="relative mb-[1.8vh] flex w-full flex-shrink-0 flex-col items-center gap-y-[0.55vh] text-center">
        <div className="flex w-full items-center justify-center">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gold-500/30 to-gold-500/50" />
          <p
            className="font-cinzel flex-shrink-0 px-[clamp(0.5rem,2vmin,1.5rem)] font-bold uppercase leading-none tracking-[0.28em] text-gold-400 queen-name-glow"
            style={{ fontSize: ONBOARDING_LEDGER_TITLE_FONT }}
          >
            Conversion Ledger
          </p>
          <div className="h-px flex-1 bg-gradient-to-l from-transparent via-gold-500/30 to-gold-500/50" />
        </div>
      </div>

      {/* ── Column headers ── */}
      <div className="relative border-b border-gold-500/10 pb-3 text-center">
        <div
          className="grid grid-cols-3 gap-x-1 font-inter font-semibold uppercase tracking-[0.2em] text-champagne sm:gap-x-2 md:gap-x-4"
          style={{ fontSize: ONBOARDING_LEDGER_HEADER_FONT }}
        >
          <span className="min-w-0 truncate px-1 text-center">Client</span>
          <span className="min-w-0 truncate px-1 text-center">Date</span>
          <span className="min-w-0 truncate px-1 text-center">Agent</span>
        </div>
      </div>

      {/* ── Scrolling body ── */}
      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden pt-3">
        {rows.length === 0 ? (
          <p
            className="py-10 text-center font-inter text-gold-500/50"
            style={{ fontSize: ONBOARDING_LEDGER_CELL_FONT }}
          >
            Awaiting conversions…
          </p>
        ) : (
          <div className="relative min-h-0 flex-1 overflow-hidden">
            {/*
             * Track — translated by the rAF loop.
             * No CSS animation class; transform is set imperatively on the DOM node.
             * will-change: transform keeps it on the GPU compositor layer.
             */}
            <div
              ref={trackRef}
              className="flex flex-col text-center"
              style={{ willChange: "transform" }}
            >
              {/* Primary block — its offsetHeight is the loop reset point */}
              <div ref={primaryRef}>
                {rows.map((row) => (
                  <ConversionLedgerRow key={row.id} row={row} />
                ))}
              </div>

              {/* Clone block — pixel-identical duplicate; hidden from AT */}
              {!prefersReducedMotion && (
                <div aria-hidden="true">
                  {rows.map((row) => (
                    <ConversionLedgerRow
                      key={`${row.id}-dup`}
                      row={row}
                      ariaHidden
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
