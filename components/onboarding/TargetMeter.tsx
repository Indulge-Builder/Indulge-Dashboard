"use client";

/**
 * components/onboarding/TargetMeter.tsx
 *
 * "Monthly Target" — Apple-Watch-style activity ring for the revenue team's
 * monthly closure target. Sits in the center column above ConversionLedger;
 * the two cards split the slot the ledger alone filled before 2026-07-03.
 *
 * The full circle = MONTHLY_CLOSURE_TARGET closures. Each agent's won deals
 * this IST month (OnboardingAgentRow.totalConverted) fill the ring as a
 * colored arc — cumulative arcs drawn back-to-front so the color joints get
 * the same rounded caps as the ring ends. Center shows the team total over
 * the target and the days left in the month; a legend lists each contributing
 * agent with their count in their arc color.
 *
 * ── Depth is structural, never emissive (redesign 2026-09-13) ───────────────
 * The ring used to render every arc through an SVG Gaussian blur (`tmGlow`),
 * so each arc bled a saturated halo — and because the arcs stack, the halos
 * added up and the whole dial bloomed on the TV. The dot, the legend swatches
 * and the center numeral each carried their own glow on top of that.
 *
 * All of it is gone. The ring now reads bright the way a real Apple activity
 * ring does — from contrast and thickness, not emission:
 *   · a genuinely recessed track (warm lip catching light over a black well)
 *   · a top-lit gradient across each band, so it reads as a physical ribbon
 *   · rounded caps and a restrained leading marker, no bloom
 * Do NOT reintroduce feGaussianBlur / box-shadow glow here. Beyond the look,
 * the old filter re-rasterized every frame under an infinite pulse — a 24/7
 * cost on the TV, the same class the 2026-06 perf pass removed elsewhere.
 */

import { useMemo } from "react";
import { motion } from "framer-motion";
import { useScreenActive } from "@/hooks/useScreenActive";
import { usePulseOnChange } from "@/hooks/usePulseOnChange";
import { istToday } from "@/lib/istDate";
import type { OnboardingAgentRow } from "@/lib/onboardingTypes";
import {
  ONBOARDING_LEDGER_TITLE_FONT,
  ONBOARDING_LEDGER_CELL_FONT,
} from "./utils";

/** The revenue team's shared monthly closure goal (full ring = this many). */
export const MONTHLY_CLOSURE_TARGET = 50;

/**
 * Arc palette, assigned to contributing agents by rank (most closures first).
 *
 * Gold leads — it is the brand, and the top contributor earns it. The rest are
 * luminance-matched and held well below full chroma so no single arc jumps
 * forward and the set reads as one designed family rather than a pie chart.
 * Ordered so neighbouring ranks always contrast (warm / cool / warm).
 *
 * There is deliberately no red: red means overdue everywhere else on this
 * dashboard (see OverdueTicker), so an agent's closures must never wear it.
 */
const ARC_COLORS = [
  "#E8B54B", // gold — brand, rank 1
  "#7FA8E0", // dusty blue
  "#6FC49A", // sage
  "#BCA0DC", // muted violet
  "#D9A38A", // clay (replaced #f87171 — red is reserved for overdue)
  "#8FBFC9", // teal
] as const;

/** Deals in the month total that no roster agent name matched. */
const UNATTRIBUTED_COLOR = "#8C8578";

const R = 41; // ring radius in the 100×100 viewBox
const STROKE = 11.5; // Apple-Watch-thick

/**
 * The two lines under the hero numeral ("of 50" and the days-left caption).
 *
 * Sized to sit alongside the agent cards' "Leads (This Month)" labels
 * (`clamp(1.35rem, 1.9cqw, 2.3rem)` in AgentColumn) — note those resolve cqw
 * against the agent card, which declares `container-type: size`, while nothing
 * above this card does, so here cq units resolve against the VIEWPORT (see the
 * note in lib/tvScale.ts). Matching therefore means matching rendered pixels,
 * not copying the expression: the old 1.6rem / 1.3rem caps bound long before
 * the fluid term did, which is why these two read as fine print on the TV
 * while the numeral above them ran to 7.5rem.
 *
 * The floor keeps laptop-sized viewports where they already were; the raised
 * cap is what the 4K stage actually gains.
 */
const SUBLINE_FONT = "clamp(1.35rem, min(2.2cqmin, 2.6cqh), 2.9rem)";

// ── Band shading ─────────────────────────────────────────────────────────────
// Each arc is stroked with a gradient that runs light at the top of the dial
// to dark at the bottom, so the ring reads as a machined band lit from above.
// Kept gentle — this is dimension, not decoration.

/** Mixes a #rrggbb toward `to` by `t` (0–1) and returns an rgb() string. */
function mixHex(hex: string, to: readonly [number, number, number], t: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255] as const;
  const m = ch.map((c, i) => Math.round(c + (to[i]! - c) * t));
  return `rgb(${m[0]}, ${m[1]}, ${m[2]})`;
}
const lighten = (hex: string, t: number) => mixHex(hex, [255, 255, 255], t);
const darken = (hex: string, t: number) => mixHex(hex, [0, 0, 0], t);

/** DOM-id-safe suffix for a per-arc gradient (hex colors carry a `#`). */
const gradId = (color: string) => `tmBand-${color.replace("#", "")}`;

interface TargetMeterProps {
  /** Full revenue roster (concierge + shop) — contributions read from totalConverted. */
  agents: OnboardingAgentRow[];
  /** Authoritative team total: leadMonthStats.dealsClosedThisMonth. */
  totalClosed: number;
  /** IST day ("YYYY-MM-DD") from useOnboardingPanelData; falls back to istToday(). */
  todayDate?: string;
  prefersReducedMotion?: boolean;
}

export function TargetMeter({
  agents,
  totalClosed,
  todayDate,
  prefersReducedMotion = false,
}: TargetMeterProps) {
  const active = useScreenActive();
  // A single soft pop when a closure lands — motion marks change, it does not
  // decorate. (The old build pulsed the dot forever: burn-in on a 24/7 panel.)
  const closedPulse = usePulseOnChange(totalClosed);

  const { arcs, progressFrac, legend } = useMemo(() => {
    const contributors = agents
      .filter((a) => (a.totalConverted ?? 0) > 0)
      .sort((a, b) => (b.totalConverted ?? 0) - (a.totalConverted ?? 0))
      .map((a, i) => ({
        name: a.name,
        count: a.totalConverted ?? 0,
        color: ARC_COLORS[i % ARC_COLORS.length]!,
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

  // Days remaining in the IST month — the caption under the numeral, so
  // "7 of 50" carries how much of the month is left to earn the rest.
  // The day comes from IST (invariant 1) — never from a UTC-derived date.
  //
  // A matching notch on the track (marking today's position round the ring, so
  // the arc could be read as ahead or behind pace) was built and removed on
  // 2026-09-14: nobody could tell what the mark meant without being told, and
  // drawing it across the band made the ring look divided rather than
  // annotated. Don't re-add it without a label outside the ring.
  const daysLeft = useMemo(() => {
    const day = todayDate ?? istToday().day;
    const [y, m, d] = day.split("-").map(Number);
    if (!y || !m || !d) return 0;
    const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
    return Math.max(daysInMonth - d, 0);
  }, [todayDate]);

  // Leading-edge position (ring starts at 12 o'clock, clockwise).
  const tipAngle = progressFrac * 2 * Math.PI - Math.PI / 2;
  const tipX = 50 + R * Math.cos(tipAngle);
  const tipY = 50 + R * Math.sin(tipAngle);

  const uniqueArcColors = Array.from(new Set(arcs.map((a) => a.color)));
  const drawDuration = prefersReducedMotion ? 0 : 1.4;

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
          <svg viewBox="0 0 100 100" className="h-full w-full">
            <defs>
              {/* One band gradient per arc color. `gradientTransform` cancels
                  the group's -90° rotation, so the light stays at the top of
                  the dial in screen space rather than rotating with the ring. */}
              {uniqueArcColors.map((color) => (
                <linearGradient
                  key={color}
                  id={gradId(color)}
                  gradientUnits="userSpaceOnUse"
                  x1="50"
                  y1="4"
                  x2="50"
                  y2="96"
                  gradientTransform="rotate(90 50 50)"
                >
                  <stop offset="0%" stopColor={lighten(color, 0.16)} />
                  <stop offset="52%" stopColor={color} />
                  <stop offset="100%" stopColor={darken(color, 0.17)} />
                </linearGradient>
              ))}
            </defs>

            {/* Track — a machined groove: a warm lip catching light around a
                black well. The 1.5-unit difference in stroke width is what
                reads as the recess; no shadow or glow is involved. */}
            <circle
              cx="50"
              cy="50"
              r={R}
              fill="none"
              stroke="rgba(212,175,55,0.14)"
              strokeWidth={STROKE}
            />
            <circle
              cx="50"
              cy="50"
              r={R}
              fill="none"
              stroke="#080808"
              strokeWidth={STROKE - 1.5}
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
                  stroke={`url(#${gradId(a.color)})`}
                  strokeWidth={STROKE}
                  strokeLinecap="round"
                  pathLength={1}
                  initial={{ strokeDasharray: "0.0001 1" }}
                  animate={{ strokeDasharray: `${Math.max(a.endFrac, 0.0001)} 1` }}
                  transition={{
                    duration: drawDuration,
                    delay: prefersReducedMotion ? 0 : 0.3 + (arcs.length - 1 - i) * 0.12,
                    ease: [0.4, 0, 0.2, 1],
                  }}
                />
              ))}
            </g>

            {/* Leading edge — a small solid marker, no bloom. It says "you are
                here"; the center number is the focal point, not this. */}
            {progressFrac > 0 && (
              <motion.circle
                cx={tipX}
                cy={tipY}
                r={STROKE / 2 - 3.4}
                fill="#F7F2E6"
                initial={{ opacity: 0 }}
                animate={{ opacity: closedPulse && active && !prefersReducedMotion ? 0.95 : 0.5 }}
                transition={{ duration: prefersReducedMotion ? 0 : 0.32, ease: "easeOut" }}
              />
            )}
          </svg>

          {/* Center readout. The 18 % side padding keeps the stack inside the
              ring's inner circle (the band's inner edge sits at 70.5 % of the
              box), so a long line wraps rather than crossing the arcs. */}
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-[18%] text-center">
            <motion.span
              className="font-montserrat font-bold leading-none tabular-nums"
              style={{
                fontSize: "clamp(2.2rem, min(11cqmin, 13cqh), 7.5rem)",
                // Presence comes from weight, size and tracking — large type
                // wants negative tracking; the old 28px text-shadow was doing
                // this job with a halo and lit the whole card.
                letterSpacing: "-0.02em",
                color: targetMet ? "#6FC49A" : "#E8B54B",
              }}
              animate={{ scale: closedPulse && active && !prefersReducedMotion ? 1.05 : 1 }}
              transition={{ duration: prefersReducedMotion ? 0 : 0.45, ease: [0.34, 1.4, 0.64, 1] }}
            >
              {totalClosed}
            </motion.span>
            {/* Both sub-lines share one size token (SUBLINE_FONT) so they read
                as a pair, at the scale of the agent cards' "Leads (This Month)"
                labels. Hierarchy under the hero numeral comes from colour and
                weight, not from making either line smaller than the other. */}
            <span
              className="mt-[0.5cqh] font-montserrat font-semibold uppercase tracking-[0.22em]"
              style={{
                fontSize: SUBLINE_FONT,
                lineHeight: 1.15,
                color: "rgba(255,255,255,0.55)",
              }}
            >
              of {MONTHLY_CLOSURE_TARGET}
            </span>
            <span
              className="mt-[0.7cqh] font-cinzel font-semibold uppercase tracking-[0.24em]"
              style={{
                fontSize: SUBLINE_FONT,
                lineHeight: 1.15,
                color: targetMet ? "rgba(111,196,154,0.9)" : "rgba(232,181,75,0.75)",
              }}
            >
              {targetMet
                ? "Target Met"
                : daysLeft === 0
                  ? "Last Day"
                  : `${daysLeft} Day${daysLeft === 1 ? "" : "s"} Left`}
            </span>
          </div>
        </div>

        {/* Legend — one row per contributing agent. The swatch is a band, not a
            dot: it echoes the shape of the arc it stands for. */}
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
                    width: "clamp(14px, 2cqmin, 28px)",
                    height: "clamp(6px, 0.85cqmin, 12px)",
                    background: `linear-gradient(180deg, ${lighten(l.color, 0.16)}, ${darken(l.color, 0.17)})`,
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
