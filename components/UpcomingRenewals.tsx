"use client";

/**
 * components/UpcomingRenewals.tsx
 *
 * "Renewals Due" — clients whose membership expires this IST month
 * (clients.latest_subscription_end), ranked soonest-first, so the Queendom
 * knows who to spoil before the date hits. Data from GET /api/clients/expiring
 * via useDashboardData (QueenStats.renewalsDue) — no fetch here.
 *
 * When the list overflows the short band it becomes a seamless vertical
 * marquee: the ticker-scroll-y keyframe slides a doubled track by -50%
 * (same contract as OverdueTicker's horizontal loop, same GPU-only transform).
 * The animation pauses via .ticker-paused whenever the card is not visible —
 * band rotated away or concierge screen faded out (dry-audit H3).
 *
 * Date states are computed at render against istToday(); live stats updates
 * re-render this card far more often than midnight passes, so passed/today
 * styling stays fresh without its own midnight timer.
 */

import { useScreenActive } from "@/hooks/useScreenActive";
import { istToday } from "@/lib/istDate";
import { fh, fw } from "@/lib/tvScale";
import type { RenewalDueClient } from "@/types";

// ─── Stage-pinned sizes (handoff 1c §B3) ──────────────────────────────────────
const ROW_GAP = fh(26);
const DAY_STYLE = { fontSize: fw(52) };
const RULE_STYLE = { height: fh(44) };
const NAME_STYLE = { fontSize: fw(46) };
const TYPE_STYLE = { fontSize: fw(28), letterSpacing: "0.22em" };

interface UpcomingRenewalsProps {
  /** Renewals due this month, ranked by endDate ascending (server-sorted). */
  clients: RenewalDueClient[];
}

/** List scrolls whenever it can overflow the band viewport (~1–2 rows tall at
 *  leaderboard-scale text) — only a single name renders as a static row. */
const SCROLL_MIN_ITEMS = 2;
/** Seconds of scroll per row in a half-track — slow enough to read from 15 ft. */
const SCROLL_S_PER_ROW = 5.5;
const SCROLL_MIN_S = 22;

function RenewalRow({ item, todayIst }: { item: RenewalDueClient; todayIst: string }) {
  const isPast = item.endDate < todayIst;
  const isDueToday = item.endDate === todayIst;
  // Day-of-month anchor: the whole card is scoped to the current month.
  const dayNum = item.endDate.slice(8, 10);
  return (
    <li className="flex w-full min-w-0 items-center" style={{ gap: fw(18) }}>
      <span
        className={`w-[2ch] flex-shrink-0 text-right font-montserrat font-bold tabular-nums leading-none ${
          isDueToday
            ? "text-foil-gold gold-glow"
            : isPast
              ? "text-red-400/85"
              : "text-champagne/95"
        }`}
        style={DAY_STYLE}
      >
        {dayNum}
      </span>
      <span className="w-px flex-shrink-0 bg-gold-500/25" style={RULE_STYLE} aria-hidden />
      <span
        className={`min-w-0 flex-1 truncate font-cinzel font-semibold tracking-[0.025em] leading-[1.25] ${
          isPast ? "text-champagne/55" : "text-champagne"
        }`}
        style={NAME_STYLE}
      >
        {item.name}
      </span>
      {item.membershipType && (
        <span
          className="hidden min-[900px]:inline flex-shrink-0 font-cinzel font-semibold uppercase text-gold-400/75"
          style={TYPE_STYLE}
        >
          {item.membershipType}
        </span>
      )}
    </li>
  );
}

export default function UpcomingRenewals({ clients }: UpcomingRenewalsProps) {
  const active = useScreenActive();
  const todayIst = istToday().day;

  if (clients.length === 0) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <span
          className="font-cinzel font-semibold uppercase tracking-[0.22em] text-champagne/40"
          style={{ fontSize: fw(34) }}
        >
          No renewals due this month
        </span>
      </div>
    );
  }

  const rows = (keyPrefix: string) => (
    <ul
      className="flex w-full flex-col"
      style={{ gap: ROW_GAP, paddingBottom: ROW_GAP }}
      aria-hidden={keyPrefix === "b" || undefined}
    >
      {clients.map((item, i) => (
        <RenewalRow key={`${keyPrefix}-${item.name}-${item.endDate}-${i}`} item={item} todayIst={todayIst} />
      ))}
    </ul>
  );

  // Short list — no marquee, just a centered static list.
  if (clients.length < SCROLL_MIN_ITEMS) {
    return (
      <div className="flex h-full w-full min-h-0 flex-col justify-center overflow-hidden px-1">
        {rows("a")}
      </div>
    );
  }

  const durationS = Math.max(SCROLL_MIN_S, clients.length * SCROLL_S_PER_ROW);

  return (
    <div
      className="relative h-full w-full min-h-0 overflow-hidden px-1"
      role="list"
      aria-label="Renewals due this month"
      style={{
        maskImage:
          "linear-gradient(to bottom, transparent 0%, black 14%, black 86%, transparent 100%)",
        WebkitMaskImage:
          "linear-gradient(to bottom, transparent 0%, black 14%, black 86%, transparent 100%)",
      }}
    >
      {/* Doubled track: two identical halves so translateY(-50%) loops seamlessly. */}
      <div
        className={`ticker-track flex w-full flex-col ${active ? "" : "ticker-paused"}`}
        style={{
          willChange: "transform",
          animation: `ticker-scroll-y ${durationS}s linear infinite`,
        }}
      >
        {rows("a")}
        {rows("b")}
      </div>
    </div>
  );
}
