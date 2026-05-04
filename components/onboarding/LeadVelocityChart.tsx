"use client";

/**
 * components/onboarding/LeadVelocityChart.tsx
 *
 * Bloomberg-grade dual-series comparison chart.
 * Shows team-level "leads attended" (status != New) over 14 IST days:
 *   - Onboarding team (gold)
 *   - Shop team (sky)
 */

import { useMemo } from "react";
import { motion } from "framer-motion";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import type { TeamAttendedDay } from "@/lib/onboardingTypes";

// ── SVG coordinate system ─────────────────────────────────────────────────────
//
// Fixed logical pixel space. SVG is stretched to fill its container via
// viewBox + preserveAspectRatio meet — no JS resize listeners needed.

const VB_W = 460;
const VB_H = 164;
const MARGIN_L = 24;
const MARGIN_T = 28;
const CHART_W = VB_W - 48; // viewBoxW - 48
const CHART_H = VB_H - 56; // viewBoxH - 56
const BOTTOM = MARGIN_T + CHART_H;

const GOLD = "#d4af37";
const SKY = "#7dd3fc";

// ── Coordinate mapping ────────────────────────────────────────────────────────

interface Point {
  x: number;
  y: number;
}

function toSvgX(i: number, n: number) {
  return MARGIN_L + (i / Math.max(n - 1, 1)) * CHART_W;
}

function toSvgY(v: number, maxVal: number) {
  return MARGIN_T + CHART_H - (v / maxVal) * CHART_H;
}

// ── Smooth cubic bezier path (Catmull-Rom → cubic bezier) ────────────────────
//
// Each segment uses the neighbouring points as "virtual" control points,
// scaled by `tension`. tension=0 → straight lines, tension=0.35 → smooth.

const TENSION = 0.35;

function smoothLinePath(pts: Point[]): string {
  if (pts.length === 0) return "";
  if (pts.length === 1) return `M ${pts[0].x},${pts[0].y}`;
  if (pts.length === 2)
    return `M ${pts[0].x},${pts[0].y} L ${pts[1].x},${pts[1].y}`;

  let d = `M ${pts[0].x.toFixed(2)},${pts[0].y.toFixed(2)}`;

  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(i - 1, 0)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(i + 2, pts.length - 1)];

    const cp1x = p1.x + (p2.x - p0.x) * TENSION;
    const cp1y = p1.y + (p2.y - p0.y) * TENSION;
    const cp2x = p2.x - (p3.x - p1.x) * TENSION;
    const cp2y = p2.y - (p3.y - p1.y) * TENSION;

    d += ` C ${cp1x.toFixed(2)},${cp1y.toFixed(2)} ${cp2x.toFixed(2)},${cp2y.toFixed(2)} ${p2.x.toFixed(2)},${p2.y.toFixed(2)}`;
  }
  return d;
}

/** Area fill = line path closed back to the X-axis baseline */
function areaFillPath(pts: Point[]): string {
  if (pts.length < 2) return "";
  const line = smoothLinePath(pts);
  const lastX = pts[pts.length - 1].x.toFixed(2);
  const firstX = pts[0].x.toFixed(2);
  return `${line} L ${lastX},${BOTTOM} L ${firstX},${BOTTOM} Z`;
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface LeadVelocityChartProps {
  data: TeamAttendedDay[];
}

// ── Component ─────────────────────────────────────────────────────────────────

export function LeadVelocityChart({ data }: LeadVelocityChartProps) {
  const reduced = usePrefersReducedMotion();

  const { onboardingPoints, shopPoints, maxVal, dateLabels, isEmpty } =
    useMemo(() => {
      const pts = data.map((d, i) => ({
        x: i,
        onboarding: d.onboarding,
        shop: d.shop,
        date: d.date,
      }));

      const maxVal = Math.max(
        1,
        ...pts.map((p) => Math.max(p.onboarding, p.shop)),
      );

      const onboardingPoints: Point[] = pts.map((p) => ({
        x: toSvgX(p.x, pts.length),
        y: toSvgY(p.onboarding, maxVal),
      }));

      const shopPoints: Point[] = pts.map((p) => ({
        x: toSvgX(p.x, pts.length),
        y: toSvgY(p.shop, maxVal),
      }));

      const isEmpty =
        pts.length === 0 ||
        pts.every((p) => p.onboarding === 0 && p.shop === 0);

      return {
        onboardingPoints,
        shopPoints,
        maxVal,
        dateLabels: pts.map((p) => p.date),
        isEmpty,
      };
    }, [data]);

  const onboardingLineD = useMemo(
    () => smoothLinePath(onboardingPoints),
    [onboardingPoints],
  );
  const onboardingAreaD = useMemo(
    () => areaFillPath(onboardingPoints),
    [onboardingPoints],
  );
  const shopLineD = useMemo(() => smoothLinePath(shopPoints), [shopPoints]);
  const shopAreaD = useMemo(() => areaFillPath(shopPoints), [shopPoints]);

  const onboardingMinY = useMemo(
    () => Math.min(BOTTOM, ...onboardingPoints.map((p) => p.y), BOTTOM),
    [onboardingPoints],
  );
  const shopMinY = useMemo(
    () => Math.min(BOTTOM, ...shopPoints.map((p) => p.y), BOTTOM),
    [shopPoints],
  );

  const xLabelIdxs = useMemo(() => {
    if (dateLabels.length === 0) return [];
    const mid = Math.floor((dateLabels.length - 1) / 2);
    return Array.from(new Set([0, mid, dateLabels.length - 1]));
  }, [dateLabels.length]);

  const fmtX = (s: string) => {
    // "YYYY-MM-DD" → "MM-DD" (muted, TV legible)
    return s?.length >= 10 ? s.slice(5) : s;
  };

  const transition = reduced
    ? { duration: 0 }
    : { duration: 0.9, ease: [0.16, 1, 0.32, 1] as const };

  return (
    <svg
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      preserveAspectRatio="xMidYMid meet"
      width="100%"
      height="100%"
      role="img"
      aria-label="Lead velocity over the last 14 days"
      style={{ display: "block", overflow: "visible" }}
    >
      <style>
        {`
          @keyframes lvc-pulse {
            0%, 100% { opacity: 0.4; }
            50%      { opacity: 1;   }
          }
        `}
      </style>
      <defs>
        <filter id="lvc-glow-dot" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur
            in="SourceGraphic"
            stdDeviation="2.25"
            result="blur"
          />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        <linearGradient
          id="lvc-area-gold"
          x1="0"
          y1={onboardingMinY}
          x2="0"
          y2={BOTTOM}
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="rgba(212,175,55,0.18)" />
          <stop offset="100%" stopColor="rgba(212,175,55,0)" />
        </linearGradient>

        <linearGradient
          id="lvc-area-sky"
          x1="0"
          y1={shopMinY}
          x2="0"
          y2={BOTTOM}
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="rgba(125,211,252,0.14)" />
          <stop offset="100%" stopColor="rgba(125,211,252,0)" />
        </linearGradient>
      </defs>

      {/* ── Grid (4 horizontal reference lines) ── */}
      {[0.2, 0.4, 0.6, 0.8].map((f) => (
        <line
          key={f}
          x1={MARGIN_L}
          y1={MARGIN_T + f * CHART_H}
          x2={MARGIN_L + CHART_W}
          y2={MARGIN_T + f * CHART_H}
          stroke="rgba(255,255,255,0.06)"
          strokeWidth="1"
        />
      ))}

      {isEmpty ? (
        <>
          <text
            x={VB_W / 2}
            y={VB_H / 2}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="rgba(255,255,255,0.25)"
            fontSize="14"
            fontFamily="var(--font-inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial)"
          >
            Collecting data…
          </text>
        </>
      ) : (
        <>
          {/* Areas */}
          <path d={onboardingAreaD} fill="url(#lvc-area-gold)" />
          <path d={shopAreaD} fill="url(#lvc-area-sky)" />

          {/* Lines (animate d on updates) */}
          <motion.path
            d={onboardingLineD}
            animate={{ d: onboardingLineD }}
            transition={transition}
            fill="none"
            stroke={GOLD}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <motion.path
            d={shopLineD}
            animate={{ d: shopLineD }}
            transition={transition}
            fill="none"
            stroke={SKY}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Terminal dots */}
          {onboardingPoints.length > 0 &&
            (() => {
              const last = onboardingPoints[onboardingPoints.length - 1]!;
              return (
                <>
                  <circle
                    cx={last.x}
                    cy={last.y}
                    r="8"
                    fill={GOLD}
                    fillOpacity="0.40"
                    style={{
                      opacity: reduced ? 1 : undefined,
                      animation: reduced
                        ? undefined
                        : "lvc-pulse 2s ease-in-out infinite",
                      willChange: "opacity",
                    }}
                  />
                  <circle
                    cx={last.x}
                    cy={last.y}
                    r="4"
                    fill={GOLD}
                    filter="url(#lvc-glow-dot)"
                  />
                </>
              );
            })()}

          {shopPoints.length > 0 &&
            (() => {
              const last = shopPoints[shopPoints.length - 1]!;
              return (
                <>
                  <circle
                    cx={last.x}
                    cy={last.y}
                    r="8"
                    fill={SKY}
                    fillOpacity="0.40"
                    style={{
                      opacity: reduced ? 1 : undefined,
                      animation: reduced
                        ? undefined
                        : "lvc-pulse 2s ease-in-out infinite",
                      animationDelay: reduced ? undefined : "0.5s",
                      willChange: "opacity",
                    }}
                  />
                  <circle
                    cx={last.x}
                    cy={last.y}
                    r="4"
                    fill={SKY}
                    filter="url(#lvc-glow-dot)"
                  />
                </>
              );
            })()}
        </>
      )}

      {/* ── X-axis day labels ── */}
      {!isEmpty &&
        xLabelIdxs.map((i) => {
          const x = toSvgX(i, dateLabels.length);
          const label = fmtX(dateLabels[i] ?? "");
          return (
            <text
              key={i}
              x={x}
              y={BOTTOM + 10}
              textAnchor="middle"
              dominantBaseline="hanging"
              fill="rgba(255,255,255,0.35)"
              fontSize="10"
              fontFamily="var(--font-inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial)"
              style={{ fontSize: "clamp(14px, 0.9vmin, 0.85rem)" }}
            >
              {label}
            </text>
          );
        })}

      {/* ── Inline legend (top-right) ── */}
      {!isEmpty && (
        <g>
          <circle
            cx={VB_W - 140}
            cy={18}
            r="4"
            fill={GOLD}
            fillOpacity="0.95"
          />
          <text
            x={VB_W - 132}
            y={18}
            dominantBaseline="middle"
            fill="rgba(255,255,255,0.72)"
            fontFamily="var(--font-inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial)"
            style={{ fontSize: "clamp(14px, 0.85vmin, 0.8rem)" }}
          >
            Onboarding
          </text>

          <circle cx={VB_W - 56} cy={18} r="4" fill={SKY} fillOpacity="0.95" />
          <text
            x={VB_W - 48}
            y={18}
            dominantBaseline="middle"
            fill="rgba(255,255,255,0.72)"
            fontFamily="var(--font-inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial)"
            style={{ fontSize: "clamp(14px, 0.85vmin, 0.8rem)" }}
          >
            Shop
          </text>
        </g>
      )}

      {/* (No y-axis labels — clean TV aesthetic) */}
    </svg>
  );
}
