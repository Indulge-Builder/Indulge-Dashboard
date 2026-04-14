"use client";

/**
 * components/onboarding/ConversionLedger.tsx
 *
 * The "Live Conversion Ledger" section of the Onboarding screen.
 *
 * Layout:
 *   ┌─────────────────────────────────┐
 *   │  "Live Conversion Ledger"       │  decorative heading + gold rules
 *   ├─────────────────────────────────┤
 *   │  Client │ Amount │ Date │ Agent │  sticky column header
 *   ├─────────────────────────────────┤
 *   │  scrolling rows (marquee)       │  flex-1; rows duplicated for seamless loop
 *   └─────────────────────────────────┘
 *
 * When prefers-reduced-motion is active the marquee class is removed and
 * the duplicate rows are omitted — a static, accessible list is rendered instead.
 *
 * Accepts `rows` pre-sorted newest-first by OnboardingPanel (sortLedgerNewestFirst).
 * The `scrollDuration` is also derived in the parent so this component stays pure.
 */

import type { CSSProperties } from "react";
import type { OnboardingLedgerRow } from "@/lib/onboardingTypes";
import {
  ONBOARDING_LEDGER_TITLE_FONT,
  ONBOARDING_LEDGER_HEADER_FONT,
  ONBOARDING_LEDGER_CELL_FONT,
  formatAmountLakh,
  formatLedgerDate,
} from "./utils";

// ── Single row (internal — not exported) ─────────────────────────────────────
function ConversionLedgerRow({
  row,
  ariaHidden,
}: {
  row:        OnboardingLedgerRow;
  ariaHidden?: boolean;
}) {
  const cell = { fontSize: ONBOARDING_LEDGER_CELL_FONT } as CSSProperties;
  return (
    <div
      className="grid grid-cols-4 items-center gap-x-1 border-b border-gold-500/[0.07] py-[clamp(10px,min(1.6vmin,1.8vh),22px)] sm:gap-x-2 md:gap-x-4"
      aria-hidden={ariaHidden}
    >
      <span
        className="min-w-0 truncate px-1 text-center font-inter font-medium leading-none text-champagne"
        style={cell}
      >
        {row.clientName}
      </span>
      <span
        className="min-w-0 truncate px-1 text-center font-edu tabular-nums leading-none text-emerald-400"
        style={cell}
      >
        {formatAmountLakh(row.amount)}
      </span>
      <span
        className="min-w-0 truncate px-1 text-center font-inter font-medium leading-none text-champagne/90"
        style={cell}
      >
        {formatLedgerDate(row.recordedAt)}
      </span>
      <span
        className="min-w-0 truncate px-1 text-center font-inter font-semibold leading-none text-champagne"
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
  rows:                 OnboardingLedgerRow[];
  /** CSS duration string e.g. "48s". Derived from row count in OnboardingPanel. */
  scrollDuration:       string;
  prefersReducedMotion: boolean;
}

// ── ConversionLedger ──────────────────────────────────────────────────────────
export function ConversionLedger({
  rows,
  scrollDuration,
  prefersReducedMotion,
}: ConversionLedgerProps) {
  return (
    <div
      className="glass gold-border-glow relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl"
      style={{
        padding:
          "clamp(0.85rem, min(2.1vh, 2.4vmin), 2rem) clamp(0.75rem, min(2.5vmin, 3.2vw), 2.5rem)",
      }}
    >
      {/* Subtle gradient overlay */}
      <div className="pointer-events-none absolute inset-0 rounded-3xl bg-gradient-to-br from-gold-500/[0.03] to-transparent" />

      {/* ── Section heading ── */}
      <div className="relative mb-[1.8vh] flex w-full flex-shrink-0 items-center justify-center text-center">
        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gold-500/30 to-gold-500/50" />
        <p
          className="font-cinzel flex-shrink-0 px-[clamp(0.5rem,2vmin,1.5rem)] font-bold uppercase leading-none tracking-[0.28em] text-gold-400 queen-name-glow"
          style={{ fontSize: ONBOARDING_LEDGER_TITLE_FONT }}
        >
          Live Conversion Ledger
        </p>
        <div className="h-px flex-1 bg-gradient-to-l from-transparent via-gold-500/30 to-gold-500/50" />
      </div>

      {/* ── Column headers ── */}
      <div className="relative border-b border-gold-500/10 pb-3 text-center">
        <div
          className="grid grid-cols-4 gap-x-1 font-inter font-semibold uppercase tracking-[0.2em] text-champagne sm:gap-x-2 md:gap-x-4"
          style={{ fontSize: ONBOARDING_LEDGER_HEADER_FONT }}
        >
          <span className="min-w-0 truncate px-1 text-center">Client</span>
          <span className="min-w-0 truncate px-1 text-center">Amount</span>
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
            <div
              className={
                prefersReducedMotion
                  ? "flex flex-col text-center"
                  : "onboarding-ledger-track flex flex-col text-center"
              }
              style={
                prefersReducedMotion
                  ? undefined
                  : ({
                      "--onboarding-ledger-duration": scrollDuration,
                    } as CSSProperties)
              }
            >
              {/* Primary pass */}
              {rows.map((row) => (
                <ConversionLedgerRow key={row.id} row={row} />
              ))}
              {/* Duplicate pass for seamless CSS marquee loop */}
              {!prefersReducedMotion &&
                rows.map((row) => (
                  <ConversionLedgerRow
                    key={`${row.id}-dup`}
                    row={row}
                    ariaHidden
                  />
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
