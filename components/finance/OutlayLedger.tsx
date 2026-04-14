"use client";

/**
 * components/finance/OutlayLedger.tsx
 *
 * The scrolling outlay table inside the Finance widget.
 *
 * Layout:
 *   ┌───────────────────────────────┐
 *   │ Client │ Task │ Amount        │  sticky column header
 *   ├───────────────────────────────┤
 *   │ scrolling rows (CSS marquee)  │  flex-1; rows duplicated for seamless loop
 *   └───────────────────────────────┘
 *
 * Rows arriving with `pending: false` are shown with an emerald background
 * for PAID_EXIT_MS before being removed by the parent (ActiveOutlays).
 *
 * When prefers-reduced-motion is active the marquee class is omitted and
 * the duplicate rows are not rendered.
 */

import type { CSSProperties } from "react";
import type { DisplayOutlay } from "@/types";
import {
  FINANCES_LEDGER_HEADER_LABEL_CLASS,
  FINANCES_LEDGER_CELL_FONT,
} from "./utils";

// ── Single row (internal — not exported) ─────────────────────────────────────
function OutlayLedgerRow({
  o,
  ariaHidden,
}: {
  o:           DisplayOutlay;
  ariaHidden?: boolean;
}) {
  const cell = { fontSize: FINANCES_LEDGER_CELL_FONT } as CSSProperties;
  return (
    <div
      className={`grid min-w-0 grid-cols-3 items-center gap-x-2 border-b border-gold-500/[0.07] py-[clamp(8px,min(1.4vmin,1.5vh),18px)] sm:gap-x-3 ${
        o.pending ? "" : "bg-emerald-500/[0.08]"
      }`}
      aria-hidden={ariaHidden}
    >
      <span
        className="min-w-0 justify-self-center truncate px-1 text-center font-inter font-semibold uppercase leading-none tracking-[0.1em] text-champagne"
        style={cell}
      >
        {o.client_name}
      </span>
      <span
        className="min-w-0 justify-self-center truncate px-1 text-center font-inter font-medium leading-none text-champagne/90"
        style={cell}
      >
        {o.task}
      </span>
      <span
        className={`min-w-0 justify-self-center truncate px-1 text-center font-cinzel font-semibold tabular-nums leading-none ${
          o.pending ? "text-amber-300" : "text-emerald-300"
        }`}
        style={cell}
      >
        ₹
        {o.amount.toLocaleString("en-IN", {
          minimumFractionDigits: 0,
          maximumFractionDigits: 2,
        })}
      </span>
    </div>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────
export interface OutlayLedgerProps {
  outlays:              DisplayOutlay[];
  /** CSS duration string e.g. "48s". Derived from outlays.length in parent. */
  scrollDuration:       string;
  prefersReducedMotion: boolean;
}

// ── OutlayLedger ─────────────────────────────────────────────────────────────
export function OutlayLedger({
  outlays,
  scrollDuration,
  prefersReducedMotion,
}: OutlayLedgerProps) {
  return (
    <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-gold-500/20 bg-black/25 shadow-[0_0_0_1px_rgba(201,168,76,0.06)]">

      {/* ── Column headers ── */}
      <div className="relative border-b border-gold-500/15 bg-gradient-to-b from-gold-500/[0.06] to-transparent px-2 py-3">
        <div
          className={`grid grid-cols-3 items-center gap-x-1 sm:gap-x-2 md:gap-x-4 ${FINANCES_LEDGER_HEADER_LABEL_CLASS}`}
        >
          <span className="min-w-0 justify-self-center truncate px-1 text-center">
            Client
          </span>
          <span className="min-w-0 justify-self-center truncate px-1 text-center">
            Task
          </span>
          <span className="min-w-0 justify-self-center truncate px-1 text-center">
            Amount
          </span>
        </div>
      </div>

      {/* ── Scrolling body ── */}
      <div className="relative min-h-0 flex-1 overflow-hidden">
        {outlays.length === 0 ? (
          <p className="py-8 text-center font-inter font-semibold text-[clamp(1.425rem,2.325vw,2.925rem)] text-champagne/40">
            No pending items
          </p>
        ) : (
          <div
            className={
              prefersReducedMotion
                ? "flex flex-col"
                : "onboarding-ledger-track flex flex-col"
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
            {outlays.map((o) => (
              <OutlayLedgerRow key={o.id} o={o} />
            ))}
            {/* Duplicate pass for seamless CSS marquee loop */}
            {!prefersReducedMotion &&
              outlays.map((o) => (
                <OutlayLedgerRow key={`${o.id}-dup`} o={o} ariaHidden />
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
