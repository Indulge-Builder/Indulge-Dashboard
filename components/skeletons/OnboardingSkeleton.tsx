/**
 * components/skeletons/OnboardingSkeleton.tsx
 *
 * Structural mirror of OnboardingPanel — same flex layout, same padding, same
 * flex-[3] / flex-[2] section proportions — but every data region replaced with
 * .skeleton-block shimmer placeholders.
 *
 * CSS tokens consumed (Step 1):
 *   .skeleton-block  — gold-shimmer via foil-shimmer keyframe
 *   .glass           — section wrapper (matches OnboardingPanel)
 *   .gold-border-glow
 *   .ambient-glow-center — same glow used in OnboardingPanel shell
 */

import type { CSSProperties } from "react";

// ── Reusable building blocks ──────────────────────────────────────────────────

function Sk({ className = "", style }: { className?: string; style?: CSSProperties }) {
  return <div className={`skeleton-block ${className}`} style={style} aria-hidden />;
}

/** Agent portrait card skeleton — mirrors EliteAgentCard's layout. */
function SkAgentCard({ delay = 0 }: { delay?: number }) {
  return (
    <div
      className="relative flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden rounded-2xl border-2 border-gold-500/[0.12]"
      style={{ background: "var(--surface-card)" }}
    >
      {/* Portrait region — flex-1 */}
      <Sk
        className="flex-1 min-h-0 w-full rounded-none"
        style={{ animationDelay: `${delay}s`, borderRadius: 0, minHeight: "clamp(120px,18vh,260px)" }}
      />

      {/* Stats panel — shrink-0, below portrait */}
      <div
        className="shrink-0 border-t border-gold-500/[0.12] flex flex-col gap-[clamp(4px,0.7vmin,10px)]"
        style={{
          background: "var(--surface-card)",
          padding: "clamp(6px,1.1vmin,14px) clamp(5px,0.9vmin,12px)",
        }}
      >
        {/* Name badge */}
        <Sk
          className="w-full rounded-lg"
          style={{ height: "clamp(22px,2.8vmin,38px)", animationDelay: `${delay + 0.08}s` }}
        />
        {/* 3 metric boxes */}
        <div className="grid grid-cols-3 gap-[clamp(4px,0.7vmin,10px)]">
          {[0.14, 0.22, 0.30].map((d, i) => (
            <Sk
              key={i}
              className="rounded-lg"
              style={{ height: "clamp(44px,6vmin,72px)", animationDelay: `${delay + d}s` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/** A single ledger row placeholder: 4 equal-width cell blocks. */
function SkLedgerRow({ delay = 0 }: { delay?: number }) {
  return (
    <div className="grid grid-cols-4 gap-x-1 sm:gap-x-2 md:gap-x-4 py-[clamp(8px,min(1.4vmin,1.5vh),18px)] border-b border-gold-500/[0.07]">
      {[0, 0.07, 0.14, 0.21].map((d, i) => (
        <Sk
          key={i}
          className="rounded-lg h-[clamp(18px,2.4vmin,32px)]"
          style={{ animationDelay: `${delay + d}s` }}
        />
      ))}
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function OnboardingSkeleton() {
  return (
    <section
      className="relative flex h-full min-h-0 w-full flex-1 flex-col overflow-x-hidden overflow-y-auto bg-obsidian md:overflow-y-hidden"
      style={{
        padding:
          "clamp(0.75rem, min(2vh, 2.5vmin), 2rem) clamp(0.75rem, min(3vmin, 4vw), 3rem)",
      }}
    >
      {/* Ambient glow — matches OnboardingPanel shell */}
      <div className="ambient-glow-center absolute inset-0 pointer-events-none" />

      {/* ── Header: rule + title skeleton + rule ── */}
      <div className="relative mb-[1.8vh] flex flex-shrink-0 flex-col items-center gap-[0.9vh]">
        <div className="mb-[0.9vh] flex w-full items-center gap-3">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gold-500/25 to-gold-500/40" />
          <div className="h-px flex-1 bg-gradient-to-l from-transparent via-gold-500/25 to-gold-500/40" />
        </div>
        <Sk
          className="rounded-full mx-auto"
          style={{ width: "clamp(140px,22vw,260px)", height: "clamp(28px,4vh,48px)" }}
        />
        <div className="flex w-full items-center gap-3">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gold-500/22 to-gold-500/38" />
          <div className="h-px flex-1 bg-gradient-to-l from-transparent via-gold-500/22 to-gold-500/38" />
        </div>
      </div>

      {/* ── Section A: 3 agent portrait cards (flex-[3]) ── */}
      <div className="relative mb-[1.6vh] flex min-h-0 w-full min-w-0 flex-[3] flex-col">
        <div
          className="glass gold-border-glow relative flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden rounded-3xl"
          style={{
            padding:
              "clamp(0.65rem, min(1.6vh, 1.8vmin), 1.75rem) clamp(0.65rem, min(2.8vmin, 3.8vw), 3rem) clamp(0.65rem, min(1.5vh, 1.7vmin), 1.75rem)",
          }}
        >
          <div className="pointer-events-none absolute inset-0 rounded-3xl bg-gradient-to-br from-gold-500/[0.04] to-transparent" />
          <div className="relative grid h-full min-h-0 flex-1 auto-rows-fr grid-cols-1 items-stretch gap-[clamp(0.65rem,min(1.4vmin,1.8vh),2rem)] overflow-hidden max-md:min-h-[min(34vmin,46svh)] md:grid-cols-3">
            <SkAgentCard delay={0} />
            <SkAgentCard delay={0.1} />
            <SkAgentCard delay={0.2} />
          </div>
        </div>
      </div>

      {/* ── Section B: Live Conversion Ledger (flex-[2]) ── */}
      <div className="relative flex min-h-0 flex-[2] flex-col">
        <div
          className="glass gold-border-glow relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl"
          style={{
            padding:
              "clamp(0.85rem, min(2.1vh, 2.4vmin), 2rem) clamp(0.75rem, min(2.5vmin, 3.2vw), 2.5rem)",
          }}
        >
          <div className="pointer-events-none absolute inset-0 rounded-3xl bg-gradient-to-br from-gold-500/[0.03] to-transparent" />

          {/* Ledger title row */}
          <div className="relative mb-[1.8vh] flex w-full flex-shrink-0 items-center gap-3">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gold-500/25 to-gold-500/40" />
            <Sk
              className="shrink-0 rounded-full px-[clamp(0.5rem,2vmin,1.5rem)]"
              style={{ width: "clamp(200px,32vw,380px)", height: "clamp(20px,3vmin,36px)" }}
            />
            <div className="h-px flex-1 bg-gradient-to-l from-transparent via-gold-500/25 to-gold-500/40" />
          </div>

          {/* Column headers */}
          <div className="relative border-b border-gold-500/10 pb-3">
            <div className="grid grid-cols-4 gap-x-1 sm:gap-x-2 md:gap-x-4">
              {[0, 0.06, 0.12, 0.18].map((d, i) => (
                <Sk
                  key={i}
                  className="rounded-lg h-[clamp(14px,2vmin,24px)]"
                  style={{ animationDelay: `${d}s` }}
                />
              ))}
            </div>
          </div>

          {/* Ledger rows */}
          <div className="flex flex-col pt-3">
            {[0, 0.08, 0.16, 0.24, 0.32].map((d, i) => (
              <SkLedgerRow key={i} delay={d} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
