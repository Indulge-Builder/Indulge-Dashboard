"use client";

import { memo, useState, useCallback } from "react";
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

// ─────────────────────────────────────────────────────────────────────────────
// Single ticker item — a luggage-tag stub:
//   [⚠ subject · #id] —tie— [◦ agent tab]  (tab swings ±3°, staggered)
// Memoized by ticket identity + display fields.
// ─────────────────────────────────────────────────────────────────────────────
function tickerItemPropsAreEqual(
  prev: { item: OverdueTicketItem; swingDelayS: number },
  next: { item: OverdueTicketItem; swingDelayS: number },
) {
  return (
    prev.item.id === next.item.id &&
    prev.item.subject === next.item.subject &&
    prev.item.agentName === next.item.agentName &&
    prev.swingDelayS === next.swingDelayS
  );
}

const TickerItem = memo(function TickerItem({
  item,
  swingDelayS,
}: {
  item: OverdueTicketItem;
  swingDelayS: number;
}) {
  return (
    <div className="flex items-center flex-shrink-0 pr-[clamp(1rem,1.2cqw,2.2rem)]">
      {/* Subject card — raised chip */}
      <div className="flex items-center gap-3 sm:gap-4 min-w-0 neu-raised-sm rounded-neu-chip px-[clamp(0.9rem,1.1cqw,2rem)] py-[clamp(0.3rem,0.55cqh,0.8rem)]">
        <span
          className="flex-shrink-0 leading-none text-[clamp(1.5rem,2.4cqw,2.9rem)] text-neu-danger-deep"
          aria-hidden
        >
          ⚠
        </span>
        <span className="font-cinzel font-semibold text-[clamp(1.7rem,2.8cqw,3.3rem)] tracking-wide text-neu-t1 truncate max-w-[24ch] sm:max-w-[34ch]">
          {item.subject}
        </span>
        <span className="font-montserrat font-semibold text-[clamp(1.5rem,2.4cqw,2.9rem)] tracking-wide whitespace-nowrap tabular-nums text-neu-t3">
          #{item.id}
        </span>
      </div>

      {/* Tie string */}
      <span
        className="flex-shrink-0 h-[2px] w-[clamp(0.6rem,0.7cqw,1.3rem)]"
        style={{
          background: "color-mix(in srgb, var(--neu-accent-deep) 45%, transparent)",
        }}
        aria-hidden
      />

      {/* Agent tab — accent-washed stub with punched eyelet, swinging from
          the tie point (transform-only keyframe, staggered per item) */}
      <div
        className="neu-anim-tag-swing flex items-center gap-[clamp(0.5rem,0.6cqw,1.1rem)] rounded-neu-chip border border-neu-edge shadow-neu-sm px-[clamp(0.7rem,0.9cqw,1.6rem)] py-[clamp(0.25rem,0.45cqh,0.65rem)]"
        style={{
          background: "color-mix(in srgb, var(--neu-accent) 26%, var(--neu-surface))",
          animationDelay: `${swingDelayS}s`,
        }}
      >
        {/* Punched eyelet */}
        <span
          className="flex-shrink-0 rounded-full bg-neu-well shadow-neu-pressed"
          style={{ width: "clamp(8px,0.5cqw,14px)", height: "clamp(8px,0.5cqw,14px)" }}
          aria-hidden
        />
        <span className="font-montserrat font-bold uppercase tracking-[0.12em] text-[clamp(1.6rem,2.6cqw,3.1rem)] text-neu-accent-deep whitespace-nowrap">
          {item.agentName}
        </span>
      </div>
    </div>
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
      <div className="relative w-full flex-shrink-0 py-4 overflow-hidden rounded-full bg-neu-well shadow-neu-inset mx-[0.6cqw] my-[0.4cqh]">
        <p className="font-cinzel text-center text-neu-t3 text-[clamp(1.4rem,2cqw,2.2rem)] tracking-widest uppercase">
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
      className="relative flex-shrink-0 overflow-hidden rounded-full bg-neu-well shadow-neu-inset mx-[0.6cqw] my-[0.4cqh] py-[0.6cqh]"
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
              swingDelayS={Number(((i % 6) * 0.7).toFixed(1))}
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
