"use client";

/**
 * components/OverdueTicker.tsx
 *
 * Bottom marquee of OPEN escalated tickets (same definition as the
 * leaderboard's Overdue count). Handoff 1c §C: the red alarm icon becomes an
 * OVERDUE-AGE BADGE — hours/days since the ticket went overdue
 * (`overdueSince` = the SLA deadline it breached, not its creation time).
 * Always red (overdue is an error); neon red from 24 h. Age is computed at
 * render; it refreshes with the existing 5-minute poll / realtime refetch —
 * no per-second timer, no tweened colour (Law 1: tier is a static class swap).
 */

import { memo, useState, useCallback } from "react";
import { fh, fw } from "@/lib/tvScale";
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

// ─── Age badge ────────────────────────────────────────────────────────────────
// Every overdue ticket is an error, so the badge is always red — only the
// intensity steps up with age (user decision 2026-09-04): standard red under
// 24 h, neon red from 24 h on. No emerald / "fresh" tier.
type AgeTier = "red" | "neon";

const NEON_FROM_H = 24;

interface TierStyle {
  color: string;
  textShadow: string;
  border: string;
  background: string;
  caption: string;
}

const TIER: Record<AgeTier, TierStyle> = {
  red: {
    color: "#f87171",
    textShadow: "0 0 16px rgba(248,113,113,0.45)",
    border: "rgba(248,113,113,0.45)",
    background: "rgba(30,14,14,0.85)",
    caption: "rgba(254,202,202,0.7)",
  },
  neon: {
    color: "#ff0000",
    textShadow: "0 0 6px #ff0000, 0 0 12px rgba(255,0,0,0.5)",
    border: "rgba(255,0,0,0.6)",
    background: "rgba(36,8,8,0.9)",
    caption: "rgba(255,120,120,0.8)",
  },
};

interface TicketAge {
  tier: AgeTier;
  /** "7h" under a day, otherwise "3d". */
  label: string;
}

/**
 * How long a ticket has been overdue at `nowMs`, counted from `overdueSince`
 * (its breached SLA deadline). null when the timestamp is missing/unparseable;
 * a deadline still in the future clamps to "0h".
 */
export function ticketAge(overdueSince: string | null, nowMs: number): TicketAge | null {
  if (!overdueSince) return null;
  const since = Date.parse(overdueSince);
  if (Number.isNaN(since)) return null;
  const hours = Math.max(0, (nowMs - since) / 3.6e6);
  const tier: AgeTier = hours >= NEON_FROM_H ? "neon" : "red";
  const label = hours < 24 ? `${Math.floor(hours)}h` : `${Math.floor(hours / 24)}d`;
  return { tier, label };
}

const BADGE_STYLE = {
  minWidth: fw(110),
  height: fh(72),
  padding: `0 ${fw(18)}`,
  borderRadius: fw(12),
};

function AgeBadge({ age }: { age: TicketAge | null }) {
  const t = TIER[age?.tier ?? "red"];
  return (
    <div
      className="flex flex-shrink-0 flex-col items-center justify-center"
      style={{ ...BADGE_STYLE, border: `1px solid ${t.border}`, background: t.background }}
      aria-label={age ? `Overdue for ${age.label}` : "Overdue"}
    >
      <span
        className="font-montserrat font-bold leading-none tabular-nums"
        style={{ fontSize: fw(40), color: t.color, textShadow: t.textShadow }}
      >
        {age?.label ?? "—"}
      </span>
      <span
        className="font-cinzel font-semibold uppercase leading-none"
        style={{ fontSize: fw(16), letterSpacing: "0.22em", marginTop: fh(6), color: t.caption }}
      >
        Overdue
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Single ticker item — [AGE] [SUBJECT] · #[TICKET ID] · [AGENT]
// Memoized by ticket identity + display fields + age string (tier follows).
// ─────────────────────────────────────────────────────────────────────────────
interface TickerItemProps {
  item: OverdueTicketItem;
  age: TicketAge | null;
  isLast: boolean;
}

function tickerItemPropsAreEqual(prev: TickerItemProps, next: TickerItemProps) {
  return (
    prev.item.id === next.item.id &&
    prev.item.subject === next.item.subject &&
    prev.item.agentName === next.item.agentName &&
    prev.age?.tier === next.age?.tier &&
    prev.age?.label === next.age?.label &&
    prev.isLast === next.isLast
  );
}

const TickerItem = memo(function TickerItem({ item, age, isLast }: TickerItemProps) {
  return (
    <>
      <div className="ticker-item flex flex-shrink-0 items-center" style={{ gap: fw(21.6) }}>
        <AgeBadge age={age} />
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          <span className="font-cinzel font-semibold text-[clamp(1.7rem,2.8cqw,3.3rem)] tracking-wide text-champagne truncate max-w-[24ch] sm:max-w-[34ch]">
            {item.subject}
          </span>
          <span className="text-gold-400/60 font-cinzel text-[clamp(1.4rem,2.1cqw,2.5rem)]">·</span>
          <span
            className="font-cinzel font-semibold text-[clamp(1.5rem,2.4cqw,2.9rem)] tracking-wide whitespace-nowrap"
            style={{ color: OVERDUE_COLOR }}
          >
            #{item.id}
          </span>
          <span className="text-gold-400/60 font-cinzel text-[clamp(1.4rem,2.1cqw,2.5rem)]">·</span>
          <span className="font-cinzel font-semibold text-[clamp(1.6rem,2.6cqw,3.1rem)] text-white/95 tracking-wide whitespace-nowrap">
            {item.agentName}
          </span>
        </div>
      </div>
      {!isLast && <div className="w-px flex-shrink-0 bg-white/15" style={{ height: fh(50) }} aria-hidden />}
    </>
  );
}, tickerItemPropsAreEqual);

// ─────────────────────────────────────────────────────────────────────────────
// Overdue Ticker — escalated tickets only; data from parent (no fetch/Supabase)
// ─────────────────────────────────────────────────────────────────────────────
function OverdueTickerInner({ overdueTickets }: { overdueTickets: OverdueTicketItem[] }) {
  const [isPaused, setIsPaused] = useState(false);
  const repeats = repeatsPerHalf(overdueTickets.length);
  // Age is derived once per render pass (the list only re-renders on the
  // 5-minute poll or a realtime refetch), never on a timer.
  const nowMs = Date.now();
  const withAge = overdueTickets.map((item) => ({ item, age: ticketAge(item.overdueSince, nowMs) }));
  const half: typeof withAge = [];
  for (let r = 0; r < repeats; r++) half.push(...withAge);
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
        <p className="font-cinzel text-center text-gold-500/60 text-[clamp(1.4rem,2cqw,2.2rem)] tracking-widest uppercase">
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
          {doubledForScroll.map(({ item, age }, i) => (
            <TickerItem
              key={`${item.id}-${i}`}
              item={item}
              age={age}
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
