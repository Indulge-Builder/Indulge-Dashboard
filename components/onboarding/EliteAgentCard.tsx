"use client";

/**
 * components/onboarding/EliteAgentCard.tsx
 *
 * TCG-style full-art portrait card for a single onboarding sales agent.
 *
 * Wrapped in React.memo so the portrait never repaints when a new ledger row
 * arrives in OnboardingPanel — only re-renders when agent data or shimmerStamp
 * changes. This is the primary performance boundary for the Onboarding screen.
 *
 * Layout (flex-col):
 *   ┌────────────────────────┐
 *   │  Portrait photo        │  flex-1 (fills available vertical space)
 *   ├────────────────────────┤
 *   │  Name badge            │  shrink-0
 *   │  Attempted · Closures · Leads  │  shrink-0
 *   └────────────────────────┘
 */

import { memo } from "react";
import { gpuStyle } from "@/lib/motionPresets";
import AnimatedCounter from "@/components/AnimatedCounter";
import type { OnboardingAgentRow } from "@/lib/onboardingTypes";
import {
  ONBOARDING_CARD_TITLE_FONT,
  ONBOARDING_AGENT_NAME_FONT,
  ONBOARDING_METRIC_VALUE_FONT,
  ONBOARDING_METRIC_SUBTITLE_FONT,
  ONBOARDING_METRIC_SUBTITLE_CLASS,
  agentPortraitSrc,
} from "./utils";

// ── Props ─────────────────────────────────────────────────────────────────────
export interface EliteAgentCardProps {
  agent:               OnboardingAgentRow;
  /** Non-zero means a closure was just detected — triggers card-win-shimmer CSS animation. */
  shimmerStamp:        number;
  prefersReducedMotion: boolean;
  /** Milliseconds of stagger delay before this card's counters start animating. */
  metricStaggerBase:   number;
}

// ── Component ─────────────────────────────────────────────────────────────────
export const EliteAgentCard = memo(function EliteAgentCard({
  agent,
  shimmerStamp,
  prefersReducedMotion,
  metricStaggerBase,
}: EliteAgentCardProps) {
  const slide = !prefersReducedMotion;
  const d0    = metricStaggerBase;
  const d1    = metricStaggerBase + 140;
  const d2    = metricStaggerBase + 280;

  return (
    <div className="relative flex h-full min-h-0 w-full min-w-0 max-w-none flex-col">
      <div
        className="relative flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden rounded-2xl border-2 border-gold-500/35 bg-[#0a0a0a]"
        style={{
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06), 0 22px 56px rgba(0,0,0,0.55)",
          ...gpuStyle,
        }}
      >
        {/* Win shimmer — CSS keyframe animation, keyed on stamp to restart on each win */}
        {shimmerStamp > 0 && (
          <div key={shimmerStamp} className="card-win-shimmer rounded-2xl" aria-hidden />
        )}

        {/* ── Portrait region — fills remaining vertical space above the stats ── */}
        <div className="relative z-0 min-h-0 flex-1 overflow-hidden bg-[#0a0a0a]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={agentPortraitSrc(agent)}
            alt=""
            className="absolute inset-0 h-full w-full scale-[1.02] select-none object-cover object-[50%_22%]"
          />

          {/* Film-grain noise overlay */}
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.06]"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E")`,
            }}
          />

          {/* Radial gold halo at top of portrait */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse 85% 55% at 50% 28%, rgba(212,175,55,0.08), transparent 50%)",
            }}
          />

          {/* Inner-border ring frame */}
          <div
            className="pointer-events-none absolute rounded-lg ring-1 ring-gold-400/35 ring-inset sm:rounded-[0.85rem]"
            style={{ inset: "clamp(4px, min(0.65vmin, 0.8vh), 12px)" }}
          />
        </div>

        {/* ── Stats panel — solid surface below the portrait ── */}
        <div
          className="relative z-10 shrink-0 border-t border-gold-500/25 bg-[#0a0a0a]"
          style={{
            padding:
              "clamp(0.45rem, min(1.1vmin, 1.4vh), 1.25rem) clamp(0.4rem, min(1vmin, 1.2vh), 1rem)",
          }}
        >
          <div
            className="flex w-full flex-col"
            style={{ gap: "clamp(0.35rem, min(0.9vmin, 1.1vh), 0.9rem)" }}
          >
            {/* Agent name badge */}
            <div className="rounded-lg border border-gold-500/35 bg-black/45 px-[clamp(0.35rem,1vmin,0.65rem)] py-[clamp(0.35rem,0.9vmin,0.65rem)] text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-md">
              <h3
                className="font-cinzel font-bold uppercase leading-none tracking-[0.24em] text-gold-300 queen-name-glow line-clamp-2"
                style={{ fontSize: ONBOARDING_AGENT_NAME_FONT }}
              >
                {agent.name}
              </h3>
            </div>

            {/* 3-metric grid */}
            <div className="grid w-full grid-cols-3 items-stretch gap-[clamp(4px,0.85vmin,12px)]">

              {/* Attempted (This Month) */}
              <div
                className="flex min-h-0 min-w-0 flex-col items-center justify-center rounded-lg border border-gold-500/25 bg-black/50 py-[clamp(6px,1vmin,14px)] text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-sm"
                style={{
                  paddingLeft:  "clamp(6px, 0.8vw, 14px)",
                  paddingRight: "clamp(6px, 0.8vw, 14px)",
                }}
              >
                <div className="mb-[clamp(4px,0.6vmin,10px)] flex min-w-0 flex-col items-center gap-[0.15em]">
                  <p
                    className="font-cinzel font-bold uppercase leading-none tracking-[0.22em] text-champagne"
                    style={{ fontSize: ONBOARDING_CARD_TITLE_FONT }}
                  >
                    Attempted
                  </p>
                  <p
                    className={`text-champagne/80 ${ONBOARDING_METRIC_SUBTITLE_CLASS}`}
                    style={{ fontSize: ONBOARDING_METRIC_SUBTITLE_FONT }}
                  >
                    (This Month)
                  </p>
                </div>
                <span className="inline-block leading-none" style={{ fontSize: ONBOARDING_METRIC_VALUE_FONT }}>
                  <AnimatedCounter
                    value={agent.totalAttempted}
                    delay={d0}
                    slideOnChange={slide}
                    className="font-edu leading-none text-champagne tabular-nums"
                  />
                </span>
              </div>

              {/* Closures (Last 30 Days) */}
              <div
                className="flex min-h-0 min-w-0 flex-col items-center justify-center rounded-lg border border-gold-500/25 bg-black/50 py-[clamp(6px,1vmin,14px)] text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-sm"
                style={{
                  paddingLeft:  "clamp(6px, 0.8vw, 14px)",
                  paddingRight: "clamp(6px, 0.8vw, 14px)",
                }}
              >
                <div className="mb-[clamp(4px,0.6vmin,10px)] flex min-w-0 flex-col items-center gap-[0.15em]">
                  <p
                    className="font-cinzel font-bold uppercase leading-none tracking-[0.22em] text-green-400"
                    style={{ fontSize: ONBOARDING_CARD_TITLE_FONT }}
                  >
                    Closures
                  </p>
                  <p
                    className={`text-green-400/90 ${ONBOARDING_METRIC_SUBTITLE_CLASS}`}
                    style={{ fontSize: ONBOARDING_METRIC_SUBTITLE_FONT }}
                  >
                    (Last 30 Days)
                  </p>
                </div>
                <span className="inline-block leading-none" style={{ fontSize: ONBOARDING_METRIC_VALUE_FONT }}>
                  <AnimatedCounter
                    value={agent.totalConverted}
                    delay={d1}
                    slideOnChange={slide}
                    className="font-edu leading-none tabular-nums text-green-400"
                  />
                </span>
              </div>

              {/* Leads (Today) */}
              <div
                className="flex min-h-0 min-w-0 flex-col items-center justify-center rounded-lg border border-gold-500/25 bg-black/50 py-[clamp(6px,1vmin,14px)] text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-sm"
                style={{
                  paddingLeft:  "clamp(4px, 0.6vw, 10px)",
                  paddingRight: "clamp(4px, 0.6vw, 10px)",
                }}
              >
                <div className="mb-[clamp(4px,0.6vmin,10px)] flex min-w-0 flex-col items-center gap-[0.15em]">
                  <p
                    className="font-cinzel font-bold uppercase leading-none tracking-[0.22em] text-sky-300"
                    style={{ fontSize: ONBOARDING_CARD_TITLE_FONT }}
                  >
                    Leads
                  </p>
                  <p
                    className={`text-sky-200 ${ONBOARDING_METRIC_SUBTITLE_CLASS}`}
                    style={{ fontSize: ONBOARDING_METRIC_SUBTITLE_FONT }}
                  >
                    (Today)
                  </p>
                </div>
                <span className="inline-block leading-none" style={{ fontSize: ONBOARDING_METRIC_VALUE_FONT }}>
                  <AnimatedCounter
                    value={agent.leadsAttendToday}
                    delay={d2}
                    slideOnChange={slide}
                    className="font-edu leading-none tabular-nums text-sky-200"
                  />
                </span>
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
});
