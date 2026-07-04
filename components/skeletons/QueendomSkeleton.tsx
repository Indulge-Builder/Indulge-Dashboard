/**
 * components/skeletons/QueendomSkeleton.tsx
 *
 * Structural mirror of QueendomPanel — same flex/grid layout, same padding,
 * same section proportions — but every data region replaced with .skeleton-block
 * shimmer placeholders so the layout is pixel-stable when the real panel fades in.
 *
 * Sections:
 *   1. Header     — WingspanHeader 3-col grid (pill | name | pill) + "Queendom" sub
 *   2. Hero row   — 5 metric boxes (grid-cols-5)
 *   3. Renewals   — counter | latest renewals | divider | latest members
 *   4. Bottom card — leaderboard (flex-1) | special dates (right col), then joker strip
 *
 * Props:
 *   side — "left" | "right": selects the correct ambient glow variant
 */

import { Sk } from "./Sk";
import { GoldGlassCard } from "@/components/ui/GoldGlassCard";
import { SectionDivider } from "@/components/ui/SectionDivider";
import { SPECIAL_DATES_COL_WIDTH_CLASS } from "@/components/QueendomPanel";

// ── Component ─────────────────────────────────────────────────────────────────

export default function QueendomSkeleton({ side }: { side: "left" | "right" }) {
  const glowClass =
    side === "left" ? "ambient-glow-left" : "ambient-glow-right";

  return (
    <section
      className="relative flex h-full w-full flex-col overflow-hidden bg-obsidian"
      style={{ padding: "2cqh var(--pad-panel)" }}
    >
      {/* Ambient radial glow */}
      <div className={`${glowClass} absolute inset-0 pointer-events-none`} />

      {/* ── 1. Header: WingspanHeader + "Queendom" subtitle ── */}
      <div className="relative mb-[1.6cqh] flex flex-shrink-0 flex-col items-center gap-[0.8cqh]">
        {/* Top rule */}
        <SectionDivider
          className="mb-[1.1cqh]"
          leftRuleClass="bg-gradient-to-r from-transparent via-gold-500/25 to-gold-500/40"
          rightRuleClass="bg-gradient-to-l from-transparent via-gold-500/25 to-gold-500/40"
        />

        {/* WingspanHeader — 3-col: pill | name | pill */}
        <div className="w-full px-2 min-[500px]:px-4 sm:px-5">
          <div
            className="grid w-full items-center"
            style={{
              gridTemplateColumns: "minmax(0,1fr) auto minmax(0,1fr)",
              gap: "clamp(8px,1cqw,20px)",
            }}
          >
            {/* Left pill (Paid) */}
            <div className="flex justify-end">
              <Sk
                className="rounded-full"
                style={{
                  width: "clamp(120px,22cqw,260px)",
                  height: "clamp(44px,6cqh,72px)",
                  animationDelay: "0s",
                }}
              />
            </div>

            {/* Center name */}
            <Sk
              className="rounded-full"
              style={{
                width: "clamp(100px,14cqw,200px)",
                height: "clamp(52px,7.5cqh,88px)",
                animationDelay: "0.06s",
              }}
            />

            {/* Right pill (Celebrity) */}
            <div className="flex justify-start">
              <Sk
                className="rounded-full"
                style={{
                  width: "clamp(120px,22cqw,260px)",
                  height: "clamp(44px,6cqh,72px)",
                  animationDelay: "0.04s",
                }}
              />
            </div>
          </div>
        </div>

        {/* "Queendom" subtitle */}
        <Sk
          className="rounded-full mx-auto"
          style={{
            width: "clamp(80px,14cqw,180px)",
            height: "clamp(20px,2.6cqh,34px)",
            animationDelay: "0.1s",
          }}
        />

        {/* Bottom rule */}
        <div className="flex w-full items-center gap-3">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gold-500/18 to-gold-500/28" />
          <div className="h-px flex-1 bg-gradient-to-l from-transparent via-gold-500/18 to-gold-500/28" />
        </div>
      </div>

      {/* ── 2. 5-Metric Hero Row ── */}
      <div className="flex-shrink-0 mb-[1.6cqh]">
        <GoldGlassCard style={{ padding: "1.6cqh var(--pad-card)" }}>
          <div
            className="grid w-full"
            style={{
              gridTemplateColumns: "repeat(5, 1fr)",
              gap: "var(--gap-metric)",
            }}
          >
            {[0, 0.1, 0.2, 0.3, 0.4].map((d, i) => (
              <Sk
                key={i}
                className="rounded-xl"
                style={{
                  height: "clamp(88px,10.5cqh,136px)",
                  animationDelay: `${d}s`,
                }}
              />
            ))}
          </div>
        </GoldGlassCard>
      </div>

      {/* ── 3. Renewals Panel — counter | renewals list | divider | members list ── */}
      <div className="flex-shrink-0 mb-[1.6cqh]">
        <GoldGlassCard
          className="flex items-stretch"
          style={{
            gap: "var(--gap-metric)",
            padding: "clamp(12px, 1.5cqw, 40px)",
          }}
        >
          {/* Counter (left) */}
          <Sk
            className="shrink-0 rounded-xl"
            style={{
              width: "clamp(120px,16cqw,200px)",
              height: "clamp(72px,10cqh,116px)",
              animationDelay: "0.05s",
            }}
          />

          {/* Renewals list (center) */}
          <div className="flex flex-1 min-w-0 flex-col items-center gap-[1.2cqh]">
            <Sk
              className="rounded-full"
              style={{
                width: "60%",
                height: "clamp(16px,2.2cqh,26px)",
                animationDelay: "0.1s",
              }}
            />
            {[0.15, 0.22].map((d, i) => (
              <Sk
                key={i}
                className="w-full rounded-lg"
                style={{
                  height: "clamp(24px,3cqh,38px)",
                  animationDelay: `${d}s`,
                }}
              />
            ))}
          </div>

          {/* Vertical divider */}
          <div
            className="shrink-0 self-stretch w-px"
            style={{ background: "rgba(212,175,55,0.20)" }}
          />

          {/* Members list (right) */}
          <div className="flex flex-1 min-w-0 flex-col items-center gap-[1.2cqh]">
            <Sk
              className="rounded-full"
              style={{
                width: "60%",
                height: "clamp(16px,2.2cqh,26px)",
                animationDelay: "0.12s",
              }}
            />
            {[0.18, 0.25].map((d, i) => (
              <Sk
                key={i}
                className="w-full rounded-lg"
                style={{
                  height: "clamp(24px,3cqh,38px)",
                  animationDelay: `${d}s`,
                }}
              />
            ))}
          </div>
        </GoldGlassCard>
      </div>

      {/* ── 4. Bottom card — leaderboard + special dates + joker strip ── */}
      <GoldGlassCard
        className="flex min-h-0 flex-1 flex-col gap-[var(--gap-card)]"
        overlayClass="bg-gradient-to-br from-gold-500/[0.03] to-transparent"
        style={{ padding: "1.6cqh clamp(10px, 2cqw, 28px)" }}
      >
        <div className="relative z-10 flex min-h-0 flex-1 flex-col gap-[var(--gap-card)]">
          {/* Leaderboard header row */}
          <div className="flex items-center gap-3 sm:gap-4 px-2 border-b border-gold-500/20 pb-[0.9cqh]">
            <Sk
              className="shrink-0 rounded-lg"
              style={{
                width: "clamp(44px,5.5cqw,72px)",
                height: "clamp(14px,1.8cqh,22px)",
              }}
            />
            {["flex-[2]", "flex-1", "flex-1", "flex-1"].map((cls, i) => (
              <Sk
                key={i}
                className={`${cls} rounded-lg h-[clamp(14px,1.8cqh,22px)]`}
                style={{ animationDelay: `${i * 0.09}s` }}
              />
            ))}
          </div>

          {/* Leaderboard rows + Special Dates column */}
          <div className="flex min-h-0 w-full flex-col md:flex-row md:items-start md:gap-[var(--gap-section)]">
            {/* Leaderboard column */}
            <div className="min-h-0 min-w-0 w-full flex-shrink-0 md:flex-1">
              {[0, 0.12, 0.24, 0.36].map((delay, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 sm:gap-4 px-2 py-[1cqh]"
                >
                  <Sk
                    className="shrink-0 rounded-full"
                    style={{
                      width: "clamp(44px,5.5cqw,72px)",
                      height: "clamp(44px,5.5cqw,72px)",
                      animationDelay: `${delay}s`,
                    }}
                  />
                  <Sk
                    className="flex-[2] rounded-lg h-[clamp(18px,2cqh,28px)]"
                    style={{ animationDelay: `${delay + 0.08}s` }}
                  />
                  {[0.16, 0.24, 0.32].map((d, j) => (
                    <Sk
                      key={j}
                      className="flex-1 rounded-lg h-[clamp(22px,2.5cqh,34px)]"
                      style={{ animationDelay: `${delay + d}s` }}
                    />
                  ))}
                </div>
              ))}
            </div>

            {/* Special Dates column — width shared with the live panel (dry-audit A9) */}
            <div
              className={`flex w-full min-h-0 flex-shrink-0 flex-col gap-[var(--gap-list)] border-t border-gold-500/20 pt-4 ${SPECIAL_DATES_COL_WIDTH_CLASS} md:border-l md:border-t-0 md:pt-0 md:pl-[var(--gap-section)]`}
            >
              <Sk
                className="mx-auto rounded-full"
                style={{ width: "60%", height: "clamp(18px,2.2cqh,28px)" }}
              />
              {[0.1, 0.2, 0.3, 0.4, 0.5].map((d, i) => (
                <Sk
                  key={i}
                  className="w-full rounded-xl"
                  style={{
                    height: "clamp(40px,5cqh,64px)",
                    animationDelay: `${d}s`,
                  }}
                />
              ))}
            </div>
          </div>

          {/* Joker strip — full-width, border-t */}
          <div className="w-full border-t border-gold-500/20 pt-[var(--gap-card)]">
            <Sk
              className="w-full rounded-xl"
              style={{
                height: "clamp(48px,6.5cqh,80px)",
                animationDelay: "0.15s",
              }}
            />
          </div>
        </div>
      </GoldGlassCard>
    </section>
  );
}
