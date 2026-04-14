/**
 * components/skeletons/QueendomSkeleton.tsx
 *
 * Structural mirror of QueendomPanel — same flex/grid layout, same padding,
 * same section proportions — but every data region replaced with .skeleton-block
 * shimmer placeholders.
 *
 * When the real QueendomPanel fades in over the top of this skeleton the layout
 * stays perfectly stable: no reflow, no size change, no flash.
 *
 * CSS tokens consumed (Step 1):
 *   .skeleton-block  — gold-shimmer via foil-shimmer keyframe
 *   --surface-card   — skeleton block base
 *   --surface-elevated — skeleton shoulder
 *   .glass           — section wrappers (matches QueendomPanel)
 *   .gold-border-glow
 *   .ambient-glow-left / .ambient-glow-right
 *
 * Props:
 *   side  — "left" | "right": selects the correct ambient glow variant
 */

import type { CSSProperties } from "react";

// ── Reusable building blocks ──────────────────────────────────────────────────

/** A single shimmer placeholder block. className controls size; style allows clamp overrides. */
function Sk({ className = "", style }: { className?: string; style?: CSSProperties }) {
  return <div className={`skeleton-block ${className}`} style={style} aria-hidden />;
}

/** A full-width horizontal row of N equal skeleton blocks. */
function SkRow({
  count,
  height,
  gap = "gap-2 sm:gap-3 lg:gap-4",
}: {
  count: number;
  height: string;
  gap?: string;
}) {
  return (
    <div className={`flex w-full ${gap}`}>
      {Array.from({ length: count }, (_, i) => (
        <Sk
          key={i}
          className="flex-1 rounded-xl"
          style={{
            height,
            animationDelay: `${i * 0.18}s`,
          }}
        />
      ))}
    </div>
  );
}

/** Leaderboard row placeholder: circle icon + name bar + 3 metric bars. */
function SkAgentRow({ delay = 0 }: { delay?: number }) {
  return (
    <div className="flex items-center gap-3 sm:gap-4 px-2 py-[1vh]">
      {/* Circle icon */}
      <Sk
        className="shrink-0 rounded-full"
        style={{ width: "clamp(44px,5.5vw,72px)", height: "clamp(44px,5.5vw,72px)", animationDelay: `${delay}s` }}
      />
      {/* Name bar */}
      <Sk className="flex-[2] rounded-lg h-[clamp(18px,2vh,28px)]" style={{ animationDelay: `${delay + 0.08}s` }} />
      {/* Three metric bars */}
      {[0.16, 0.24, 0.32].map((d, i) => (
        <Sk
          key={i}
          className="flex-1 rounded-lg h-[clamp(22px,2.5vh,34px)]"
          style={{ animationDelay: `${delay + d}s` }}
        />
      ))}
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function QueendomSkeleton({ side }: { side: "left" | "right" }) {
  const glowClass = side === "left" ? "ambient-glow-left" : "ambient-glow-right";

  return (
    <section
      className="relative flex min-h-[85svh] flex-1 flex-col overflow-y-auto overflow-x-hidden md:min-h-0 bg-obsidian"
      style={{ padding: "2vh clamp(12px, 3vw, 40px)" }}
    >
      {/* Ambient radial glow — same token as real panel */}
      <div className={`${glowClass} absolute inset-0 pointer-events-none`} />

      {/* ── Header: rule + name pill + subtitle + rule ── */}
      <div className="relative mb-[1.6vh] flex flex-shrink-0 flex-col items-center gap-[0.8vh]">
        <div className="mb-[1.1vh] flex w-full items-center gap-3">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gold-500/20 to-gold-500/30" />
          <div className="h-px flex-1 bg-gradient-to-l from-transparent via-gold-500/20 to-gold-500/30" />
        </div>
        {/* Queen name block */}
        <Sk
          className="rounded-full mx-auto"
          style={{ width: "clamp(140px,28vw,320px)", height: "clamp(32px,4.5vh,56px)" }}
        />
        {/* "Queendom" subtitle */}
        <Sk
          className="rounded-full mx-auto"
          style={{ width: "clamp(80px,14vw,160px)", height: "clamp(18px,2.2vh,28px)", animationDelay: "0.1s" }}
        />
        <div className="flex w-full items-center gap-3">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gold-500/18 to-gold-500/28" />
          <div className="h-px flex-1 bg-gradient-to-l from-transparent via-gold-500/18 to-gold-500/28" />
        </div>
      </div>

      {/* ── 5-Metric Hero Row ── */}
      <div className="flex-shrink-0 mb-[1.6vh]">
        <div
          className="glass gold-border-glow rounded-2xl relative overflow-hidden"
          style={{ padding: "1.6vh clamp(10px, 2vw, 28px)" }}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-gold-500/[0.04] to-transparent pointer-events-none rounded-2xl" />
          <SkRow
            count={5}
            height="clamp(88px,10.5vh,136px)"
            gap="gap-2 sm:gap-3 lg:gap-4"
          />
        </div>
      </div>

      {/* ── Renewals Panel ── */}
      <div className="flex-shrink-0 mb-[1.6vh]">
        <Sk
          className="w-full rounded-2xl"
          style={{ height: "clamp(56px,7.5vh,96px)", animationDelay: "0.2s" }}
        />
      </div>

      {/* ── Main content: Leaderboard + Special Dates + Joker + Finances ── */}
      <div
        className="relative flex min-h-0 flex-1 flex-col gap-4 overflow-hidden rounded-2xl glass gold-border-glow"
        style={{ padding: "1.6vh clamp(10px, 2vw, 28px)" }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-gold-500/[0.03] to-transparent pointer-events-none rounded-2xl" />
        <div className="relative z-10 flex min-h-0 flex-1 flex-col gap-4">

          {/* Leaderboard header row */}
          <div className="flex items-center gap-3 sm:gap-4 px-2 border-b border-gold-500/20 pb-[0.9vh]">
            <Sk className="shrink-0 rounded-lg" style={{ width: "clamp(44px,5.5vw,72px)", height: "clamp(14px,1.8vh,22px)" }} />
            {["flex-[2]","flex-1","flex-1","flex-1"].map((cls, i) => (
              <Sk key={i} className={`${cls} rounded-lg h-[clamp(14px,1.8vh,22px)]`} style={{ animationDelay: `${i * 0.09}s` }} />
            ))}
          </div>

          {/* Agent rows */}
          <div className="flex min-h-0 w-full flex-col md:flex-row md:items-start md:gap-8 lg:gap-10">
            {/* Leaderboard column */}
            <div className="min-h-0 min-w-0 w-full flex-shrink-0 md:flex-1">
              {[0, 0.12, 0.24, 0.36].map((delay, i) => (
                <SkAgentRow key={i} delay={delay} />
              ))}
            </div>

            {/* Special dates column */}
            <div className="flex w-full min-h-0 flex-shrink-0 flex-col gap-3 border-t border-gold-500/20 pt-4 md:w-[clamp(360px,46vw,680px)] md:border-l md:border-t-0 md:pt-0 md:pl-8 lg:pl-10">
              {/* "Special Dates" heading */}
              <Sk className="mx-auto rounded-full" style={{ width: "60%", height: "clamp(18px,2.2vh,28px)" }} />
              {/* Date rows */}
              {[0.1, 0.2, 0.3, 0.4, 0.5].map((d, i) => (
                <Sk key={i} className="w-full rounded-xl" style={{ height: "clamp(40px,5vh,64px)", animationDelay: `${d}s` }} />
              ))}
            </div>
          </div>

          {/* Joker strip */}
          <div className="w-full border-t border-gold-500/20 pt-4">
            <Sk
              className="w-full rounded-xl"
              style={{ height: "clamp(48px,6.5vh,80px)", animationDelay: "0.15s" }}
            />
          </div>

          {/* Finances area */}
          <div className="flex w-full min-h-0 flex-1 flex-col gap-3">
            {/* "Finances" heading bar */}
            <Sk className="mx-auto rounded-full" style={{ width: "40%", height: "clamp(18px,2.4vh,30px)", animationDelay: "0.1s" }} />
            {/* Scorecard + ledger row */}
            <div className="flex gap-3 md:gap-4 flex-1">
              <Sk
                className="shrink-0 rounded-xl"
                style={{ width: "clamp(120px,22%,220px)", height: "clamp(80px,10vh,128px)", animationDelay: "0.18s" }}
              />
              <Sk className="flex-1 rounded-xl" style={{ height: "clamp(80px,10vh,128px)", animationDelay: "0.26s" }} />
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
