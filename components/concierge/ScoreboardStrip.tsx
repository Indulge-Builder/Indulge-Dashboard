"use client";

/**
 * components/concierge/ScoreboardStrip.tsx
 *
 * The full-width scoreboard across the top of the concierge screen (handoff
 * 1c §A): one cell per queendom — name, the three membership pills, and the
 * five ticket metrics (Today · Received · Resolved · Pending · Spoiled).
 * Cells are separated by vertical gold hairlines. The Spoiled tile is
 * currently hidden behind SHOW_SPOILED_TILE (see below).
 *
 * Every number is the same QueenStats field the old per-panel header and
 * hero row showed; only the arrangement changed. Counters use AnimatedCounter
 * with slideOnChange; entrance delays keep the old 800…1200 ms stagger per
 * queendom on top of a 0 / 150 / 300 ms base left → right.
 */

import { Fragment, type CSSProperties, type ReactNode } from "react";
import { motion } from "framer-motion";
import AnimatedCounter from "@/components/AnimatedCounter";
import { GoldGlassCard } from "@/components/ui/GoldGlassCard";
import { StatCard } from "@/components/ui/StatCard";
import { safeNum } from "@/lib/format";
import { fh, fw } from "@/lib/tvScale";
import type { QueenStats } from "@/lib/types";
import type { QueendomView } from "@/types";
import { QUEENDOM_ENTRANCE_DELAY_MS, queendomItemVariants } from "./motion";

// ─── Stage-pinned sizes (handoff §A) ──────────────────────────────────────────
const CELL_GAP = fh(26);
const NAME_STYLE: CSSProperties = { fontSize: fw(78), letterSpacing: "0.28em" };
const QUEENDOM_WORD_STYLE: CSSProperties = { fontSize: fw(34), letterSpacing: "0.42em" };
const PILL_STYLE: CSSProperties = { padding: `${fh(14)} ${fw(30)}`, gap: fw(18) };
const PILL_LABEL_STYLE: CSSProperties = { fontSize: fw(32), letterSpacing: "0.22em" };
const PILL_VALUE_STYLE: CSSProperties = { fontSize: fw(40), letterSpacing: "0.1em" };
const METRIC_LABEL_STYLE: CSSProperties = {
  fontSize: fw(34),
  letterSpacing: "0.22em",
  marginBottom: fh(10),
};

/** White readout with a soft gold aura — the unpaid pills (Celebrity / To Be Revived). */
const UNPAID_VALUE_CLASS =
  "font-montserrat font-bold leading-none tabular-nums text-white [text-shadow:0_0_12px_rgba(212,175,55,0.42),0_0_26px_rgba(212,175,55,0.2)]";
const PAID_VALUE_CLASS =
  "font-montserrat font-bold leading-none tabular-nums text-gold-300 gold-glow";

function MembershipPill({
  label,
  value,
  delay,
  paid = false,
}: {
  label: string;
  value: number;
  delay: number;
  paid?: boolean;
}) {
  return (
    <div
      className="flex min-w-0 items-center rounded-full border border-gold-500/20 bg-black/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
      style={PILL_STYLE}
    >
      <span
        className="font-cinzel font-semibold uppercase leading-none text-champagne whitespace-nowrap"
        style={PILL_LABEL_STYLE}
      >
        {label}
      </span>
      <AnimatedCounter
        value={value}
        className={paid ? PAID_VALUE_CLASS : UNPAID_VALUE_CLASS}
        style={PILL_VALUE_STYLE}
        delay={delay}
        slideOnChange
      />
    </div>
  );
}

// ─── Metric tile ──────────────────────────────────────────────────────────────
type Tone = "today" | "received" | "resolved" | "pending" | "spoiled";

/**
 * Spoiled (Joker accepted count) is HIDDEN for now — user decision 2026-09-05:
 * the number will return later, so the tile, its tone and its data path stay
 * intact; only this flag removes it from the row and lets the remaining four
 * tiles share the width. Flip to true to bring it back.
 */
export const SHOW_SPOILED_TILE = false;

/** The metric row, in order, with each tile's grid weight (Today is the anchor). */
const METRIC_TILES: ReadonlyArray<{ tone: Tone; label: string; weight: number; show: boolean }> = [
  { tone: "today",    label: "Today",    weight: 1.15, show: true },
  { tone: "received", label: "Received", weight: 1,    show: true },
  { tone: "resolved", label: "Resolved", weight: 1,    show: true },
  { tone: "pending",  label: "Pending",  weight: 1,    show: true },
  { tone: "spoiled",  label: "Spoiled",  weight: 1,    show: SHOW_SPOILED_TILE },
];

export const VISIBLE_METRIC_TILES = METRIC_TILES.filter((t) => t.show);

/** `grid-template-columns` for the visible tiles — shared with the skeleton. */
export const METRIC_GRID_COLUMNS = VISIBLE_METRIC_TILES.map((t) => `${t.weight}fr`).join(" ");

/** QueenStats field each tile reads. */
function metricValue(stats: QueenStats, tone: Tone): number {
  switch (tone) {
    case "today":    return safeNum(stats.tickets.solvedToday);
    case "received": return safeNum(stats.tickets.totalReceived);
    case "resolved": return safeNum(stats.tickets.resolvedThisMonth);
    case "pending":  return safeNum(stats.tickets.pendingToResolve);
    case "spoiled":  return safeNum(stats.joker?.acceptedCount);
  }
}

const TONE: Record<
  Tone,
  { surface: string; label: string; value: string; valuePx: number; padX: number }
> = {
  today: {
    surface: "surface-luxe-hero",
    label: "text-emerald-300",
    value: "text-foil-emerald emerald-glow-hero",
    valuePx: 118,
    padX: 16,
  },
  received: { surface: "surface-luxe", label: "text-champagne", value: "text-champagne", valuePx: 96, padX: 12 },
  resolved: { surface: "surface-luxe", label: "text-green-400", value: "text-green-400", valuePx: 96, padX: 12 },
  pending:  { surface: "surface-luxe", label: "text-red-400",   value: "text-red-400",   valuePx: 96, padX: 12 },
  spoiled:  { surface: "surface-luxe", label: "text-champagne", value: "text-foil-gold", valuePx: 104, padX: 12 },
};

function MetricTile({
  tone,
  label,
  value,
  delay,
}: {
  tone: Tone;
  label: ReactNode;
  value: number;
  delay: number;
}) {
  const t = TONE[tone];
  return (
    <StatCard
      surfaceClass={`${t.surface} rounded-xl flex flex-col items-center justify-center text-center min-w-0`}
      style={{ padding: `${fh(22)} ${fw(t.padX)}` }}
      labelClass={`font-cinzel font-semibold uppercase leading-[1.15] ${t.label}`}
      label={<span style={METRIC_LABEL_STYLE}>{label}</span>}
    >
      <AnimatedCounter
        value={value}
        className={`font-montserrat font-bold leading-none tracking-[-0.01em] tabular-nums ${t.value}`}
        style={{ fontSize: fw(t.valuePx) }}
        delay={delay}
        slideOnChange
      />
    </StatCard>
  );
}

// ─── One queendom's cell ──────────────────────────────────────────────────────
function QueendomScoreCell({
  name,
  stats,
  delayMs,
}: {
  name: string;
  stats: QueenStats;
  delayMs: number;
}) {
  return (
    <div className="flex min-w-0 flex-col" style={{ gap: CELL_GAP }}>
      {/* Identity row — crown tier + section tier, side by side */}
      <div
        className="flex flex-wrap items-center justify-center"
        style={{ gap: fw(34) }}
      >
        <h2
          className="font-cinzel font-bold uppercase leading-none text-gold-400 queen-name-glow whitespace-nowrap"
          style={NAME_STYLE}
        >
          {name}
        </h2>
        <span
          className="font-cinzel font-semibold uppercase leading-none text-gold-300 gold-glow"
          style={QUEENDOM_WORD_STYLE}
        >
          Queendom
        </span>
      </div>

      {/* Membership pills */}
      <div className="flex flex-wrap items-center justify-center" style={{ gap: fw(18) }}>
        <MembershipPill label="Paid" value={safeNum(stats.members.total)} delay={delayMs + 400} paid />
        <MembershipPill
          label="Celebrity"
          value={safeNum(stats.members.celebrityActive)}
          delay={delayMs + 520}
        />
        <MembershipPill
          label="To Be Revived"
          value={safeNum(stats.members.toBeRevived)}
          delay={delayMs + 640}
        />
      </div>

      {/* Ticket metrics — Today is the lit emerald anchor; the 800…1200 ms
          entrance stagger runs left → right over whichever tiles are visible */}
      <div
        className="grid flex-1 items-stretch"
        style={{ gridTemplateColumns: METRIC_GRID_COLUMNS, gap: fw(18) }}
      >
        {VISIBLE_METRIC_TILES.map((tile, i) => (
          <MetricTile
            key={tile.tone}
            tone={tile.tone}
            label={tile.label}
            value={metricValue(stats, tile.tone)}
            delay={delayMs + 800 + 100 * i}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Strip ────────────────────────────────────────────────────────────────────
export default function ScoreboardStrip({ queendoms }: { queendoms: QueendomView[] }) {
  // "1fr 1px 1fr 1px 1fr" — a hairline track between every pair of cells.
  const columns = queendoms.map(() => "minmax(0,1fr)").join(" 1px ");
  return (
    <motion.div className="flex-shrink-0" variants={queendomItemVariants}>
      <GoldGlassCard
        className="elevate-hero engrave-frame"
        style={{ padding: `${fh(44)} var(--pad-card)` }}
      >
        <div
          className="relative grid items-stretch"
          style={{ gridTemplateColumns: columns, gap: "var(--pad-card)" }}
        >
          {queendoms.map((q, i) => (
            <Fragment key={q.id}>
              {i > 0 && (
                <div
                  className="w-px self-stretch bg-gradient-to-b from-transparent via-gold-400/35 to-transparent"
                  aria-hidden
                />
              )}
              <QueendomScoreCell
                name={q.name}
                stats={q.stats}
                delayMs={QUEENDOM_ENTRANCE_DELAY_MS * i}
              />
            </Fragment>
          ))}
        </div>
      </GoldGlassCard>
    </motion.div>
  );
}
