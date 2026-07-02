"use client";

/**
 * components/onboarding/TargetMeter.tsx
 *
 * "Monthly Target" — Apple-Watch-style activity ring for the revenue team's
 * monthly closure target (replaced ConversionLedger in the center column,
 * 2026-07-03; the ledger lives in components/_unmounted/).
 *
 * The full circle = MONTHLY_CLOSURE_TARGET closures. Each agent's won deals
 * this IST month (OnboardingAgentRow.totalConverted) fill the ring as a
 * colored arc — cumulative arcs drawn back-to-front so the color joints get
 * the same rounded caps as the ring ends. A glowing dot rides the leading
 * edge. Center shows the team total over the target; a legend lists each
 * contributing agent with their count in their arc color.
 *
 * Ring style is deliberately bold (thick stroke, vivid fills, dark amber
 * track on the card's near-black surface) — not the thin translucent line
 * style of the band charts.
 */

import { useMemo } from "react";
import { motion } from "framer-motion";
import { useScreenActive } from "@/hooks/useScreenActive";
import type { OnboardingAgentRow } from "@/lib/onboardingTypes";
import {
  ONBOARDING_LEDGER_TITLE_FONT,
  ONBOARDING_LEDGER_CELL_FONT,
} from "./utils";

/** The revenue team's shared monthly closure goal (full ring = this many). */
export const MONTHLY_CLOSURE_TARGET = 15;

// Arc palette, assigned to contributing agents by rank (most closures first).
// First three echo the Performance tiles (amber / blue / emerald).
const ARC_COLORS = [
  "#FFB020",
  "#6B8FFF",
  "#34d399",
  "#a78bfa",
  "#7dd3fc",
  "#f87171",
] as const;

/** Deals in the month total that no roster agent name matched. */
const UNATTRIBUTED_COLOR = "rgba(247,231,206,0.45)";

const R = 41; // ring radius in the 100×100 viewBox
const STROKE = 11.5; // Apple-Watch-thick

interface TargetMeterProps {
  /** Full revenue roster (concierge + shop) — contributions read from totalConverted. */
  agents: OnboardingAgentRow[];
  /** Authoritative team total: leadMonthStats.dealsClosedThisMonth. */
  totalClosed: number;
}

export function TargetMeter({ agents, totalClosed }: TargetMeterProps) {
  const active = useScreenActive();

  const { arcs, progressFrac, legend } = useMemo(() => {
    const contributors = agents
      .filter((a) => (a.totalConverted ?? 0) > 0)
      .sort((a, b) => (b.totalConverted ?? 0) - (a.totalConverted ?? 0))
      .map((a, i) => ({
        name: a.name,
        count: a.totalConverted ?? 0,
        color: ARC_COLORS[i % ARC_COLORS.length],
      }));

    const attributed = contributors.reduce((s, c) => s + c.count, 0);
    const unattributed = Math.max(0, totalClosed - attributed);
    const slices = unattributed
      ? [...contributors, { name: "Other", count: unattributed, color: UNATTRIBUTED_COLOR }]
      : contributors;

    // Cumulative end-fraction per slice (of the TARGET, capped at one lap).
    let cum = 0;
    const arcList = slices.map((s) => {
      cum += s.count;
      return { ...s, endFrac: Math.min(cum / MONTHLY_CLOSURE_TARGET, 1) };
    });

    return {
      // Drawn back-to-front: longest cumulative arc first, so each shorter
      // arc paints over it and every color joint gets a rounded cap.
      arcs: [...arcList].reverse(),
      progressFrac: Math.min(cum / MONTHLY_CLOSURE_TARGET, 1),
      legend: slices,
    };
  }, [agents, totalClosed]);

  const targetMet = totalClosed >= MONTHLY_CLOSURE_TARGET;

  // Leading-edge dot position (ring starts at 12 o'clock, clockwise).
  const tipAngle = progressFrac * 2 * Math.PI - Math.PI / 2;
  const tipX = 50 + R * Math.cos(tipAngle);
  const tipY = 50 + R * Math.sin(tipAngle);
  const tipColor = legend.length ? legend[legend.length - 1].color : ARC_COLORS[0];

  return (
    <div
      className="relative flex h-full min-h-0 w-full flex-col overflow-hidden rounded-2xl"
      style={{
        background: "rgba(10,10,10,0.88)",
        border: "1px solid rgba(255,255,255,0.14)",
        boxShadow:
          "0 0 0 1px rgba(255,255,255,0.03) inset, 0 16px 40px rgba(0,0,0,0.45)",
        padding: "clamp(0.55rem,1.1cqmin,1.5rem)",
      }}
    >
      <div
        className="pointer-events-none absolute inset-0 rounded-2xl"
        style={{
          background:
            "linear-gradient(135deg, transparent 45%, rgba(255,176,32,0.018) 100%)",
        }}
      />

      {/* ── Section heading — same device as the old ledger heading ── */}
      <div className="relative flex w-full flex-shrink-0 items-center justify-center gap-0 pt-[0.5cqh]" style={{ marginBottom: "0.8cqh" }}>
        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gold-500/30 to-gold-500/50" />
        <p
          className="font-cinzel flex-shrink-0 px-[clamp(0.5rem,2cqmin,1.5rem)] font-bold uppercase leading-none tracking-[0.28em] text-gold-400 queen-name-glow"
          style={{ fontSize: ONBOARDING_LEDGER_TITLE_FONT }}
        >
          Monthly Target
        </p>
        <div className="h-px flex-1 bg-gradient-to-l from-transparent via-gold-500/30 to-gold-500/50" />
      </div>

      {/* ── Ring + legend ── */}
      <div className="relative flex min-h-0 w-full flex-1 items-center justify-center gap-[clamp(0.75rem,2.5cqmin,3rem)]">
        {/* Ring — square, sized by the card's free height */}
        <div className="relative aspect-square h-full max-h-full min-h-0 max-w-[60%]">
          <svg viewBox="0 0 100 100" className="h-full w-full overflow-visible">
            <defs>
              <filter id="tmGlow" x="-40%" y="-40%" width="180%" height="180%">
                <feGaussianBlur stdDeviation="1.6" result="b" />
                <feMerge>
                  <feMergeNode in="b" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Track — dark amber-tinted full circle (Apple-Watch recessed look) */}
            <circle
              cx="50"
              cy="50"
              r={R}
              fill="none"
              stroke="rgba(255,176,32,0.10)"
              strokeWidth={STROKE}
            />
            <circle
              cx="50"
              cy="50"
              r={R}
              fill="none"
              stroke="rgba(0,0,0,0.35)"
              strokeWidth={STROKE - 2}
            />

            {/* Cumulative agent arcs — normalized pathLength, start at 12 o'clock */}
            <g transform="rotate(-90 50 50)">
              {arcs.map((a, i) => (
                <motion.circle
                  key={`${a.name}-${a.color}`}
                  cx="50"
                  cy="50"
                  r={R}
                  fill="none"
                  stroke={a.color}
                  strokeWidth={STROKE}
                  strokeLinecap="round"
                  pathLength={1}
                  filter="url(#tmGlow)"
                  initial={{ strokeDasharray: "0.0001 1" }}
                  animate={{ strokeDasharray: `${Math.max(a.endFrac, 0.0001)} 1` }}
                  transition={{
                    duration: 1.4,
                    delay: 0.3 + (arcs.length - 1 - i) * 0.12,
                    ease: [0.4, 0, 0.2, 1],
                  }}
                />
              ))}
            </g>

            {/* Leading-edge dot — pulses while the screen is visible */}
            {progressFrac > 0 && (
              <motion.circle
                cx={tipX}
                cy={tipY}
                r={STROKE / 2 - 1.4}
                fill="#fff"
                fillOpacity="0.9"
                filter="url(#tmGlow)"
                initial={{ opacity: 0 }}
                animate={
                  active
                    ? { opacity: [0.9, 0.45, 0.9] }
                    : { opacity: 0.9 }
                }
                transition={
                  active
                    ? { duration: 2.4, repeat: Infinity, ease: "easeInOut", delay: 1.8 }
                    : { duration: 0.3 }
                }
              />
            )}
          </svg>

          {/* Center readout */}
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
            <span
              className="font-montserrat font-bold leading-none tabular-nums"
              style={{
                fontSize: "clamp(2.2rem, min(11cqmin, 13cqh), 7.5rem)",
                color: targetMet ? "#34d399" : "#FFB020",
                textShadow: targetMet
                  ? "0 0 28px rgba(52,211,153,0.5)"
                  : "0 0 28px rgba(255,176,32,0.45)",
              }}
            >
              {totalClosed}
            </span>
            <span
              className="mt-[0.5cqh] font-montserrat font-semibold uppercase leading-none tracking-[0.22em]"
              style={{
                fontSize: "clamp(0.8rem, min(2.2cqmin, 2.6cqh), 1.6rem)",
                color: "rgba(255,255,255,0.45)",
              }}
            >
              of {MONTHLY_CLOSURE_TARGET}
            </span>
            <span
              className="mt-[0.7cqh] font-cinzel font-semibold uppercase leading-none tracking-[0.3em]"
              style={{
                fontSize: "clamp(0.7rem, min(1.7cqmin, 2cqh), 1.3rem)",
                color: targetMet ? "rgba(52,211,153,0.8)" : "rgba(255,176,32,0.55)",
              }}
            >
              {targetMet ? "Target Met" : "Closures"}
            </span>
          </div>
        </div>

        {/* Legend — one row per contributing agent */}
        <div
          className="flex min-w-0 max-w-[38%] flex-shrink flex-col justify-center"
          style={{ gap: "clamp(0.4rem, 1.2cqmin, 1.2rem)" }}
        >
          {legend.length === 0 ? (
            <p
              className="font-montserrat text-gold-500/50"
              style={{ fontSize: ONBOARDING_LEDGER_CELL_FONT }}
            >
              Awaiting closures…
            </p>
          ) : (
            legend.map((l) => (
              <div key={`${l.name}-${l.color}`} className="flex min-w-0 items-center gap-[clamp(0.4rem,0.9cqmin,0.9rem)]">
                <span
                  className="flex-shrink-0 rounded-full"
                  style={{
                    width: "clamp(10px, 1.4cqmin, 20px)",
                    height: "clamp(10px, 1.4cqmin, 20px)",
                    background: l.color,
                    boxShadow: `0 0 10px ${l.color}`,
                  }}
                />
                <span
                  className="min-w-0 truncate font-montserrat font-medium text-champagne"
                  style={{ fontSize: ONBOARDING_LEDGER_CELL_FONT }}
                >
                  {l.name}
                </span>
                <span
                  className="ml-auto flex-shrink-0 font-montserrat font-bold tabular-nums"
                  style={{ fontSize: ONBOARDING_LEDGER_CELL_FONT, color: l.color }}
                >
                  {l.count}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
