"use client";

/**
 * components/onboarding/TargetMeter.tsx
 *
 * "Monthly Target" — activity ring for the revenue team's monthly closure
 * target. Sits BESIDE ConversionLedger (36% / 64% split of the center
 * column's bottom slot — OnboardingLayout).
 *
 * The full circle = MONTHLY_CLOSURE_TARGET closures. Each agent's won deals
 * this IST month (OnboardingAgentRow.totalConverted) fill the ring as a
 * colored arc — cumulative arcs drawn back-to-front so the color joints get
 * the same rounded caps as the ring ends. A pulsing halo + dot rides the
 * leading edge. Center shows the team total over the target; a legend lists
 * each contributing agent with their count in their arc color.
 *
 * Neumorphic: putty track on the raised card, rank palette from the pastel
 * support family (accent → powder → sage → lilac → peach → danger → butter),
 * no glow filters.
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
// Deep pastel family — matches the specimen's rank order.
const ARC_COLORS = [
  "var(--neu-accent-deep)",
  "var(--neu-powder-deep)",
  "var(--neu-sage-deep)",
  "var(--neu-lilac-deep)",
  "var(--neu-peach-deep)",
  "var(--neu-danger-deep)",
  "var(--neu-butter-deep)",
] as const;

/** Deals in the month total that no roster agent name matched. */
const UNATTRIBUTED_COLOR = "var(--neu-text-tertiary)";

const R = 41; // ring radius in the 100×100 viewBox
const STROKE = 11.5;

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
      className="relative flex h-full min-h-0 w-full flex-col overflow-hidden neu-raised rounded-neu-tile"
      style={{ padding: "clamp(0.55rem,1.1cqmin,1.5rem)" }}
    >
      {/* ── Section heading — inline-size container so the title divides the
             card's actual width ("Monthly Target" ≈ 12.6em at 0.28em tracking)
             instead of clipping in the 36% slot ── */}
      <div className="relative w-full flex-shrink-0 pt-[0.5cqh] [container-type:inline-size]" style={{ marginBottom: "0.8cqh" }}>
        <div className="flex w-full items-center justify-center gap-0">
          <div className="neu-rule-l h-px flex-1" />
          <p
            className="font-cinzel flex-shrink-0 px-[clamp(0.5rem,2cqmin,1.5rem)] font-bold uppercase leading-none tracking-[0.28em] text-neu-t1 neu-letterpress whitespace-nowrap"
            style={{ fontSize: `min(${ONBOARDING_LEDGER_TITLE_FONT}, calc((100cqi - 3rem) / 12.6))` }}
          >
            Monthly Target
          </p>
          <div className="neu-rule-r h-px flex-1" />
        </div>
      </div>

      {/* ── Ring + legend ── */}
      <div className="relative flex min-h-0 w-full flex-1 items-center justify-center gap-[clamp(0.75rem,2.5cqmin,3rem)]">
        {/* Ring — square, sized by the card's free height */}
        <div className="relative aspect-square h-full max-h-full min-h-0 max-w-[60%]">
          <svg viewBox="0 0 100 100" className="h-full w-full overflow-visible">
            {/* Track — recessed putty circle */}
            <circle
              cx="50"
              cy="50"
              r={R}
              fill="none"
              stroke="color-mix(in srgb, var(--neu-text-tertiary) 28%, transparent)"
              strokeWidth={STROKE}
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
                  initial={{ strokeDasharray: "0.0001 1" }}
                  animate={{ strokeDasharray: `${Math.max(a.endFrac, 0.0001)} 1` }}
                  transition={{
                    duration: 1.4,
                    delay: 0.3 + (arcs.length - 1 - i) * 0.12,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                />
              ))}
            </g>

            {/* Leading edge — pulsing halo + dot */}
            {progressFrac > 0 && (
              <>
                <motion.circle
                  cx={tipX}
                  cy={tipY}
                  r={STROKE / 2 + 1.5}
                  fill={tipColor}
                  initial={{ opacity: 0 }}
                  animate={
                    active ? { opacity: [0.25, 0.08, 0.25] } : { opacity: 0.2 }
                  }
                  transition={
                    active
                      ? { duration: 2.4, repeat: Infinity, ease: "easeInOut", delay: 1.8 }
                      : { duration: 0.3 }
                  }
                />
                <circle
                  cx={tipX}
                  cy={tipY}
                  r={STROKE / 2 - 2}
                  fill={tipColor}
                  stroke="var(--neu-surface)"
                  strokeWidth="1.4"
                />
              </>
            )}
          </svg>

          {/* Center readout */}
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
            <span
              className="font-montserrat font-bold leading-none tabular-nums"
              style={{
                fontSize: "clamp(2.2rem, min(11cqmin, 13cqh), 7.5rem)",
                color: targetMet ? "var(--neu-sage-deep)" : "var(--neu-text-primary)",
              }}
            >
              {totalClosed}
            </span>
            <span
              className="mt-[0.5cqh] font-montserrat font-bold uppercase leading-none tracking-[0.22em] text-neu-t3"
              style={{ fontSize: "clamp(0.8rem, min(2.2cqmin, 2.6cqh), 1.6rem)" }}
            >
              of {MONTHLY_CLOSURE_TARGET}
            </span>
            <span
              className="mt-[0.7cqh] font-cinzel font-semibold uppercase leading-none tracking-[0.3em]"
              style={{
                fontSize: "clamp(0.7rem, min(1.7cqmin, 2cqh), 1.3rem)",
                color: targetMet ? "var(--neu-sage-deep)" : "var(--neu-accent-deep)",
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
              className="min-w-0 truncate font-montserrat text-neu-t3"
              style={{ fontSize: ONBOARDING_LEDGER_CELL_FONT }}
            >
              Awaiting closures…
            </p>
          ) : (
            legend.map((l) => (
              <div key={`${l.name}-${l.color}`} className="flex min-w-0 items-center gap-[clamp(0.4rem,0.9cqmin,0.9rem)]">
                <span
                  className="flex-shrink-0 rounded-full shadow-neu-sm"
                  style={{
                    width: "clamp(10px, 1.4cqmin, 20px)",
                    height: "clamp(10px, 1.4cqmin, 20px)",
                    background: l.color,
                  }}
                />
                <span
                  className="min-w-0 truncate font-montserrat font-semibold text-neu-t1"
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
