/**
 * components/skeletons/ConciergeSkeleton.tsx
 *
 * Structural mirror of ConciergeScreen — the same shell padding, strip, and
 * column rhythm, with every data region replaced by .skeleton-block shimmer
 * placeholders so the layout is pixel-stable when the real screen fades in.
 *
 * Sections per column mirror QueendomColumn: renewals card → leaderboard
 * card (header, rows, 2 × 3 special-dates grid) → band.
 */

import { Fragment } from "react";
import { Sk } from "./Sk";
import { GoldGlassCard } from "@/components/ui/GoldGlassCard";
import { QUEENDOM_IDS } from "@/lib/queendom";
import { fh, fw } from "@/lib/tvScale";
import {
  COLUMN_GAP,
  ColumnSeparator,
  SHELL_PADDING,
  STRIP_GAP,
} from "@/components/concierge/ConciergeScreen";
import {
  METRIC_GRID_COLUMNS,
  VISIBLE_METRIC_TILES,
} from "@/components/concierge/ScoreboardStrip";

function StripCell({ delay }: { delay: number }) {
  return (
    <div className="flex min-w-0 flex-col items-center" style={{ gap: fh(26) }}>
      <Sk className="rounded-full" style={{ width: "46%", height: fw(78), animationDelay: `${delay}s` }} />
      <div className="flex w-full justify-center" style={{ gap: fw(18) }}>
        {[0, 1, 2].map((i) => (
          <Sk
            key={i}
            className="rounded-full"
            style={{ width: "26%", height: fh(68), animationDelay: `${delay + 0.05 * i}s` }}
          />
        ))}
      </div>
      <div
        className="grid w-full"
        style={{ gridTemplateColumns: METRIC_GRID_COLUMNS, gap: fw(18) }}
      >
        {VISIBLE_METRIC_TILES.map((_, i) => (
          <Sk
            key={i}
            className="rounded-xl"
            style={{ height: fh(196), animationDelay: `${delay + 0.08 * i}s` }}
          />
        ))}
      </div>
    </div>
  );
}

function ColumnSkeleton({ delay }: { delay: number }) {
  return (
    <div className="relative flex min-h-0 min-w-0 flex-1 basis-0 flex-col overflow-hidden">
      {/* Renewals card */}
      <GoldGlassCard
        className="flex flex-shrink-0 items-stretch"
        style={{ padding: `${fh(34)} ${fw(40)}`, gap: fw(30), marginBottom: fh(40) }}
      >
        <Sk className="shrink-0 rounded-xl" style={{ width: fw(200), height: fh(190), animationDelay: `${delay}s` }} />
        {[0, 1].map((i) => (
          <div key={i} className="flex min-w-0 flex-1 flex-col items-center justify-center" style={{ gap: fh(18) }}>
            <Sk className="rounded-full" style={{ width: "60%", height: fh(40), animationDelay: `${delay + 0.1}s` }} />
            <Sk className="w-full rounded-lg" style={{ height: fh(38), animationDelay: `${delay + 0.18}s` }} />
          </div>
        ))}
      </GoldGlassCard>

      {/* Leaderboard + special dates card */}
      <GoldGlassCard
        className="flex min-h-0 flex-1 flex-col"
        overlayClass="bg-gradient-to-br from-gold-500/[0.03] to-transparent"
        style={{ padding: `${fh(40)} ${fw(43)}` }}
      >
        <div className="relative z-10 flex min-h-0 flex-1 flex-col" style={{ gap: fh(30) }}>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div
              className="flex items-center border-b border-gold-500/20"
              style={{ gap: fw(30), padding: `0 ${fw(14)} ${fh(24)}` }}
            >
              <Sk className="shrink-0 rounded-lg" style={{ width: fw(72), height: fh(44) }} />
              {["flex-[2]", "flex-1", "flex-1", "flex-[1.1]"].map((cls, i) => (
                <Sk key={i} className={`${cls} rounded-lg`} style={{ height: fh(44), animationDelay: `${i * 0.09}s` }} />
              ))}
            </div>
            <div style={{ paddingTop: fh(14) }}>
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center" style={{ gap: fw(30), padding: `${fh(20)} ${fw(14)}` }}>
                  <Sk className="shrink-0 rounded-full" style={{ width: fw(66), height: fw(66), animationDelay: `${delay + i * 0.12}s` }} />
                  <Sk className="flex-[2] rounded-lg" style={{ height: fh(54), animationDelay: `${delay + i * 0.12 + 0.08}s` }} />
                  {[0.16, 0.24, 0.32].map((d, j) => (
                    <Sk key={j} className="flex-1 rounded-lg" style={{ height: fh(66), animationDelay: `${delay + i * 0.12 + d}s` }} />
                  ))}
                </div>
              ))}
            </div>
          </div>
          <div className="flex flex-shrink-0 flex-col border-t border-gold-500/20" style={{ paddingTop: fh(30) }}>
            <Sk className="mx-auto rounded-full" style={{ width: "40%", height: fh(38), marginBottom: fh(24) }} />
            <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: `${fh(18)} ${fw(22)}` }}>
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <Sk key={i} className="w-full rounded-xl" style={{ height: fh(130), animationDelay: `${delay + i * 0.07}s` }} />
              ))}
            </div>
          </div>
        </div>
      </GoldGlassCard>

      {/* Band */}
      <GoldGlassCard
        className="flex flex-shrink-0"
        overlayClass="bg-gradient-to-br from-gold-500/[0.03] to-transparent"
        style={{ padding: `${fh(30)} ${fw(43)}`, height: fh(346, 0.28), marginTop: fh(40), gap: fw(30) }}
      >
        <Sk className="rounded-xl" style={{ flex: "0 0 42%", animationDelay: `${delay}s` }} />
        <Sk className="flex-1 rounded-xl" style={{ animationDelay: `${delay + 0.1}s` }} />
      </GoldGlassCard>
    </div>
  );
}

export default function ConciergeSkeleton() {
  const columns = QUEENDOM_IDS.map(() => "minmax(0,1fr)").join(" 1px ");
  return (
    <section
      className="relative flex h-full w-full flex-col overflow-hidden bg-obsidian"
      style={{ padding: SHELL_PADDING }}
    >
      <div className="ambient-glow-center pointer-events-none absolute inset-0" />

      <GoldGlassCard className="flex-shrink-0" style={{ padding: `${fh(44)} var(--pad-card)` }}>
        <div className="relative grid items-stretch" style={{ gridTemplateColumns: columns, gap: "var(--pad-card)" }}>
          {QUEENDOM_IDS.map((id, i) => (
            <Fragment key={id}>
              {i > 0 && <div className="w-px self-stretch bg-gold-500/20" aria-hidden />}
              <StripCell delay={i * 0.15} />
            </Fragment>
          ))}
        </div>
      </GoldGlassCard>

      <div className="flex min-h-0 flex-1 items-stretch" style={{ marginTop: STRIP_GAP, gap: COLUMN_GAP }}>
        {QUEENDOM_IDS.map((id, i) => (
          <Fragment key={id}>
            {i > 0 && <ColumnSeparator />}
            <ColumnSkeleton delay={i * 0.15} />
          </Fragment>
        ))}
      </div>
    </section>
  );
}
