"use client";

import { memo, useState, useCallback } from "react";
import { AlertTriangle } from "lucide-react";
import type { OverdueTicketItem } from "@/types";

const TICKER_DURATION_S = 40; // seconds for one 3×-list half-cycle — slow, calm scroll

/**
 * The loop animation slides the track by -50%, so the track must be two
 * identical halves. Each half needs enough items to span the widest TV
 * viewport (4K) — but no more: every extra copy inflates the always-animating
 * compositor layer that old TV GPUs pay for on every frame.
 *
 * MIN_ITEMS_PER_HALF (10) comfortably exceeds 4K width at this item size.
 * The scroll duration scales with the repeat count so px/s speed is identical
 * to the original 3×-list / 40s tuning for any list length.
 */
const MIN_ITEMS_PER_HALF = 10;

function repeatsPerHalf(count: number): number {
  if (count === 0) return 0;
  return Math.max(1, Math.ceil(MIN_ITEMS_PER_HALF / count));
}

// Overdue red — bright enough for 15ft TV visibility.
const OVERDUE_COLOR = "#F1948A";
const OVERDUE_BORDER = "rgba(241, 148, 138, 0.6)";

// ─────────────────────────────────────────────────────────────────────────────
// Single ticker item — ⚠ [SUBJECT] · #[TICKET ID] · [AGENT]
// Memoized by ticket identity + display fields.
// ─────────────────────────────────────────────────────────────────────────────
function tickerItemPropsAreEqual(
  prev: { item: OverdueTicketItem; isLast: boolean },
  next: { item: OverdueTicketItem; isLast: boolean },
) {
  return (
    prev.item.id === next.item.id &&
    prev.item.subject === next.item.subject &&
    prev.item.agentName === next.item.agentName &&
    prev.isLast === next.isLast
  );
}

const TickerItem = memo(function TickerItem({
  item,
  isLast,
}: {
  item: OverdueTicketItem;
  isLast: boolean;
}) {
  return (
    <>
      <div className="ticker-item flex items-center gap-4 sm:gap-6 flex-shrink-0">
        <div
          className="flex-shrink-0 w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center"
          style={{
            border: `2px solid ${OVERDUE_BORDER}`,
            background: "rgba(5, 5, 5, 0.85)",
          }}
        >
          <AlertTriangle
            className="w-8 h-8 sm:w-10 sm:h-10"
            style={{ color: OVERDUE_COLOR }}
            strokeWidth={2.5}
          />
        </div>
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          <span className="font-baskerville font-semibold text-[clamp(1.7rem,2.8vw,3.3rem)] tracking-wide text-champagne truncate max-w-[24ch] sm:max-w-[34ch]">
            {item.subject}
          </span>
          <span className="text-gold-400/60 font-cinzel text-[clamp(1.4rem,2.1vw,2.5rem)]">
            ·
          </span>
          <span
            className="font-cinzel font-semibold text-[clamp(1.5rem,2.4vw,2.9rem)] tracking-wide whitespace-nowrap"
            style={{ color: OVERDUE_COLOR }}
          >
            #{item.id}
          </span>
          <span className="text-gold-400/60 font-cinzel text-[clamp(1.4rem,2.1vw,2.5rem)]">
            ·
          </span>
          <span className="font-cinzel font-semibold text-[clamp(1.6rem,2.6vw,3.1rem)] text-white/95 tracking-wide whitespace-nowrap">
            {item.agentName}
          </span>
        </div>
      </div>
      {!isLast && (
        <div
          className="flex-shrink-0 w-px h-10 sm:h-14 bg-white/15"
          aria-hidden
        />
      )}
    </>
  );
}, tickerItemPropsAreEqual);

// ─────────────────────────────────────────────────────────────────────────────
// Overdue Ticker — escalated tickets only; data from parent (no fetch/Supabase)
// ─────────────────────────────────────────────────────────────────────────────
function OverdueTickerInner({
  overdueTickets,
}: {
  overdueTickets: OverdueTicketItem[];
}) {
  const [isPaused, setIsPaused] = useState(false);
  const repeats = repeatsPerHalf(overdueTickets.length);
  const half: OverdueTicketItem[] = [];
  for (let r = 0; r < repeats; r++) half.push(...overdueTickets);
  const doubledForScroll = half.length > 0 ? [...half, ...half] : [];
  // Same px/s as the original tuning (3 copies per half over 40s).
  const durationS = (TICKER_DURATION_S * repeats) / 3;

  const handleMouseEnter = useCallback(() => setIsPaused(true), []);
  const handleMouseLeave = useCallback(() => setIsPaused(false), []);

  if (overdueTickets.length === 0) {
    return (
      <div
        className="relative w-full flex-shrink-0 py-4 overflow-hidden"
        style={{
          borderTop: "1px solid rgba(212, 175, 55, 0.2)",
          borderBottom: "1px solid rgba(212, 175, 55, 0.2)",
          background: "rgba(5, 5, 5, 0.92)",
        }}
      >
        <p className="font-cinzel text-center text-gold-500/60 text-[clamp(1.4rem,2vw,2.2rem)] tracking-widest uppercase">
          No overdue tickets
        </p>
      </div>
    );
  }

  return (
    <div
      role="region"
      aria-label="Overdue tickets"
      aria-live="polite"
      className="relative w-full flex-shrink-0 overflow-hidden"
      style={{
        borderTop: "1px solid rgba(212, 175, 55, 0.2)",
        borderBottom: "1px solid rgba(212, 175, 55, 0.2)",
        // No backdrop-filter: at 92% opaque over an almost-black screen the
        // blur is invisible, but it forces a full-width GPU pass every frame.
        background: "rgba(5, 5, 5, 0.92)",
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Scrolling track — CSS animation for smooth 60fps, mask-image fade at edges */}
      <div
        className="relative overflow-hidden"
        style={{
          maskImage:
            "linear-gradient(to right, transparent 0%, black 12%, black 88%, transparent 100%)",
          WebkitMaskImage:
            "linear-gradient(to right, transparent 0%, black 12%, black 88%, transparent 100%)",
        }}
      >
        <div
          className={`ticker-track flex items-center ${isPaused ? "ticker-paused" : ""}`}
          style={{
            willChange: "transform",
            animation: `ticker-scroll ${durationS}s linear infinite`,
          }}
        >
          {doubledForScroll.map((item, i) => (
            <TickerItem
              key={`${item.id}-${i}`}
              item={item}
              isLast={i === doubledForScroll.length - 1}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

const OverdueTicker = memo(OverdueTickerInner);
OverdueTicker.displayName = "OverdueTicker";

export default OverdueTicker;
