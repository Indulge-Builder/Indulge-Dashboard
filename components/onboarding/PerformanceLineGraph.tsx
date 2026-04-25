"use client";

/**
 * PerformanceLineGraph.tsx
 *
 * Four smooth lines — one per Indulge business vertical — showing daily
 * new-lead volume for the current IST calendar month (day 1 → last day).
 * Lines only render up to today; future days are blank.
 *
 * Visual hierarchy (highest → lowest expected volume):
 *   Indulge Global  — soft blue    #6B8FFF
 *   Indulge Shop    — warm gold    #FFB020
 *   Indulge House   — emerald      #34D399
 *   Indulge Legacy  — lavender     #C084FC
 *
 * Event burst system — when a new lead fires from any team:
 *   1. Line surge — entire vertical's line briefly ignites
 *   2. Bloom corona + rings + spark + stardust at terminal dot
 */

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import type { VerticalTrendPoint } from "@/lib/onboardingTypes";

// ── SVG coordinate system ─────────────────────────────────────────────────────

const VB_W    = 460;
const VB_H    = 240;
const ML      = 36;
const MT      = 18;
const MR      = 12;
const MB      = 26;
const CHART_W = VB_W - ML - MR;
const CHART_H = VB_H - MT - MB;
const BOTTOM  = MT + CHART_H;

// ── Vertical color palette ────────────────────────────────────────────────────

export const VERTICAL_COLORS = {
  "Indulge Global":  { line: "#6B8FFF", ring: "#5A7FFF", label: "Global"  },
  "Indulge Shop":    { line: "#FFB020", ring: "#E09A30", label: "Shop"    },
  "Indulge House":   { line: "#34D399", ring: "#22C585", label: "House"   },
  "Indulge Legacy":  { line: "#C084FC", ring: "#A855F7", label: "Legacy"  },
} as const;

export type VerticalKey = keyof typeof VERTICAL_COLORS;
export const VERTICALS = Object.keys(VERTICAL_COLORS) as VerticalKey[];

// Y-axis grid fractions (0 = maxVal top … 1 = zero bottom)
const Y_FRACS = [0, 0.25, 0.5, 0.75, 1] as const;

// Stardust — 6 particles at 60° intervals
const DUST: [number, number][] = [
  [15,  0], [7,  13], [-8,  13],
  [-15, 0], [-8,-13], [ 7, -13],
];

// ── Pulse event type ──────────────────────────────────────────────────────────

export interface PulseEvent {
  id:   string;
  team: "onboarding" | "shop";
}

// ── Geometry helpers ──────────────────────────────────────────────────────────

interface Pt { x: number; y: number }

function svgX(i: number, n: number) { return ML + (i / Math.max(n - 1, 1)) * CHART_W; }
function svgY(v: number, maxV: number) { return MT + CHART_H - (v / Math.max(maxV, 1)) * CHART_H; }

const T = 0.35;

function smoothPath(pts: Pt[]): string {
  if (pts.length === 0) return "";
  if (pts.length === 1) return `M ${pts[0]!.x},${pts[0]!.y}`;
  if (pts.length === 2) return `M ${pts[0]!.x},${pts[0]!.y} L ${pts[1]!.x},${pts[1]!.y}`;

  let d = `M ${pts[0]!.x.toFixed(2)},${pts[0]!.y.toFixed(2)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(i - 1, 0)]!;
    const p1 = pts[i]!;
    const p2 = pts[i + 1]!;
    const p3 = pts[Math.min(i + 2, pts.length - 1)]!;
    const cp1x = p1.x + (p2.x - p0.x) * T;
    const cp1y = p1.y + (p2.y - p0.y) * T;
    const cp2x = p2.x - (p3.x - p1.x) * T;
    const cp2y = p2.y - (p3.y - p1.y) * T;
    d += ` C ${cp1x.toFixed(2)},${cp1y.toFixed(2)} ${cp2x.toFixed(2)},${cp2y.toFixed(2)} ${p2.x.toFixed(2)},${p2.y.toFixed(2)}`;
  }
  return d;
}

function areaPath(pts: Pt[]): string {
  if (pts.length < 2) return "";
  const line = smoothPath(pts);
  return `${line} L ${pts[pts.length - 1]!.x.toFixed(2)},${BOTTOM} L ${pts[0]!.x.toFixed(2)},${BOTTOM} Z`;
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface PerformanceLineGraphProps {
  data:         VerticalTrendPoint[];
  pulseEvents?: PulseEvent[];
  /** ISO date string "YYYY-MM-DD" for today in IST — lines stop here. If omitted, inferred from data. */
  todayDate?:   string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function PerformanceLineGraph({ data, pulseEvents = [], todayDate }: PerformanceLineGraphProps) {
  const reduced = usePrefersReducedMotion();
  const [showAllLabels, setShowAllLabels] = useState(false);

  // ── Geometry ───────────────────────────────────────────────────────────────

  const geo = useMemo(() => {
    const n = data.length; // total days in month (28-31)
    if (n === 0) {
      return {
        verticals: {} as Record<VerticalKey, { d: string; area: string; term: Pt | null; topY: number }>,
        xLabels: [] as { x: number; label: string }[],
        isEmpty: true,
        maxVal: 0,
        todayIdx: -1,
      };
    }

    // Determine today's index — last day that is not in the future
    const istToday = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric", month: "2-digit", day: "2-digit",
    }).format(new Date());
    const effectiveToday = todayDate ?? istToday;
    const todayIdx = data.reduce((last, d, i) => d.date <= effectiveToday ? i : last, -1);

    // Only the populated slice (days 0..todayIdx) drives the y-scale
    const populatedData = todayIdx >= 0 ? data.slice(0, todayIdx + 1) : [];

    const maxVal = Math.max(
      50,
      ...populatedData.flatMap((d) => VERTICALS.map((v) => d[v])),
    );

    const isEmpty = populatedData.length === 0 || populatedData.every((d) => VERTICALS.every((v) => d[v] === 0));

    const verticals = Object.fromEntries(
      VERTICALS.map((v) => {
        // Only draw points up to today
        const pts = populatedData.map((d, i) => ({
          x:   svgX(i, n),
          y:   svgY(d[v], maxVal),
          val: d[v],
        }));
        return [
          v,
          {
            d:    smoothPath(pts),
            area: areaPath(pts),
            term: pts[pts.length - 1] ?? null,
            topY: pts.length ? Math.min(...pts.map((p) => p.y)) : MT,
            pts,
          },
        ];
      }),
    ) as unknown as Record<VerticalKey, { d: string; area: string; term: Pt | null; topY: number; pts: Array<{ x: number; y: number; val: number }> }>;

    // X-axis: 5 evenly-spaced ticks (first, 3 midpoints, last)
    // Format: "M-D" e.g. "4-1", "4-15"
    const tickIndices = [0, Math.round(n / 4), Math.round(n / 2), Math.round((3 * n) / 4), n - 1];
    const xLabels = Array.from(new Set(tickIndices)).map((i) => {
      const d = data[i]!;
      const parts = d.date.split("-");
      const month = parseInt(parts[1] ?? "1", 10);
      const day   = parseInt(parts[2] ?? "1", 10);
      return { x: svgX(i, n), label: `${month}-${day}` };
    });

    return { verticals, xLabels, isEmpty, maxVal, todayIdx };
  }, [data, todayDate]);

  // ── Draw-in gate ───────────────────────────────────────────────────────────
  const [drawn, setDrawn] = useState(false);
  useEffect(() => {
    if (reduced) { setDrawn(true); return; }
    const t = setTimeout(() => setDrawn(true), 1700);
    return () => clearTimeout(t);
  }, [reduced]);

  const updateTx = reduced ? { duration: 0 } : { duration: 0.9, ease: [0.16, 1, 0.32, 1] as const };

  const Line = (id: string, d: string, color: string, drawIdx: number) => {
    if (drawn) {
      return (
        <motion.path key={`${id}-u`} d={d} animate={{ d }} transition={updateTx}
          fill="none" stroke={color} strokeWidth={1.4}
          strokeLinecap="round" strokeLinejoin="round"
          filter="url(#plg-glow)" vectorEffect="non-scaling-stroke" />
      );
    }
    return (
      <motion.path key={`${id}-i`} d={d} fill="none" stroke={color}
        strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round"
        filter="url(#plg-glow)" vectorEffect="non-scaling-stroke"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={reduced ? { duration: 0 } : {
          pathLength: { duration: 1.1, delay: drawIdx * 0.12, ease: "easeInOut" as const },
          opacity:    { duration: 0.2, delay: drawIdx * 0.12 },
        }} />
    );
  };

  // ── Event burst renderer ───────────────────────────────────────────────────
  const Burst = (event: PulseEvent) => {
    // Map pulse team → vertical key (onboarding = Global, shop = Shop for burst targeting)
    const vertKey: VerticalKey = event.team === "onboarding" ? "Indulge Global" : "Indulge Shop";
    const vGeo  = geo.verticals[vertKey];
    const color = VERTICAL_COLORS[vertKey].line;
    if (!vGeo?.term || !vGeo.d) return null;
    const term = vGeo.term;

    return (
      <g key={event.id} style={{ pointerEvents: "none" }}>
        <path d={vGeo.d} fill="none" stroke={color} strokeWidth={2}
          strokeLinecap="round" strokeLinejoin="round"
          filter="url(#plg-glow)" vectorEffect="non-scaling-stroke"
          style={{ animation: "plg-surge 0.9s ease-out forwards" }} />

        <g transform={`translate(${term.x.toFixed(2)}, ${term.y.toFixed(2)})`}>
          <circle r="22" fill={color} filter="url(#plg-bloom)" className="plg-ev"
            style={{ animation: "plg-aura 2.0s ease-out forwards" }} />
          <circle r="6" fill="none" stroke={color} strokeWidth="0.9" className="plg-ev"
            style={{ animation: "plg-ring-b 1.1s ease-out forwards" }} />
          <circle r="6" fill="none" stroke={color} strokeWidth="0.55" className="plg-ev"
            style={{ animation: "plg-ring-b 1.1s ease-out 0.22s forwards" }} />
          <circle r="4.5" fill={color} filter="url(#plg-dot)" className="plg-ev"
            style={{ animation: "plg-spark-b 0.55s ease-out forwards" }} />
          {DUST.map(([dx, dy], i) => (
            <circle key={i} cx="0" cy="0" r="1.6" fill={color} className="plg-ev"
              style={{ animation: `plg-dust-${i} 1.15s ease-out 0.08s forwards`, opacity: 0 }} />
          ))}
        </g>
      </g>
    );
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{ width: "100%", position: "relative" }}>
      {/* Toggle: today-only ↔ all-points */}
      <button
        onClick={() => setShowAllLabels((v) => !v)}
        aria-label={showAllLabels ? "Show today only" : "Show all data points"}
        style={{
          position:       "absolute",
          top:            "6px",
          right:          "6px",
          width:          "24px",
          height:         "24px",
          borderRadius:   "7px",
          background:     showAllLabels ? "rgba(107,143,255,0.15)" : "rgba(255,255,255,0.05)",
          border:         showAllLabels ? "1px solid rgba(107,143,255,0.50)" : "1px solid rgba(255,255,255,0.13)",
          cursor:         "pointer",
          display:        "flex",
          alignItems:     "center",
          justifyContent: "center",
          padding:        0,
          transition:     "background 0.2s, border-color 0.2s",
          zIndex:         10,
          boxShadow:      showAllLabels ? "0 0 8px rgba(107,143,255,0.28)" : "none",
        }}
      >
        <svg width="14" height="10" viewBox="0 0 14 10" fill="none">
          {/* Dashed baseline */}
          <line x1="1" y1="5" x2="13" y2="5"
            stroke={showAllLabels ? "rgba(107,143,255,0.55)" : "rgba(255,255,255,0.22)"}
            strokeWidth="0.9" strokeDasharray="2 1.5" />
          {showAllLabels ? (
            /* Three dots = all points mode */
            <>
              <circle cx="1.5"  cy="5" r="1.6" fill="rgba(107,143,255,0.90)" />
              <circle cx="7"    cy="5" r="1.6" fill="rgba(107,143,255,0.90)" />
              <circle cx="12.5" cy="5" r="1.6" fill="rgba(107,143,255,0.90)" />
            </>
          ) : (
            /* Single dot at end = today-only mode */
            <circle cx="12.5" cy="5" r="1.6" fill="rgba(255,255,255,0.55)" />
          )}
        </svg>
      </button>
      <style>{`
        @keyframes plg-ring {
          0%   { transform: scale(1);   opacity: 0.6; }
          75%  { transform: scale(3.2); opacity: 0.07; }
          100% { transform: scale(3.6); opacity: 0; }
        }
        .plg-ring { transform-box: fill-box; transform-origin: 50% 50%; }
        .plg-ev   { transform-box: fill-box; transform-origin: 50% 50%; }

        @keyframes plg-surge {
          0%   { stroke-opacity: 0; }
          10%  { stroke-opacity: 0.45; }
          100% { stroke-opacity: 0; }
        }
        @keyframes plg-aura {
          0%   { transform: scale(0.25); opacity: 0; }
          14%  { transform: scale(1);    opacity: 0.20; }
          100% { transform: scale(1.9);  opacity: 0; }
        }
        @keyframes plg-ring-b {
          0%   { transform: scale(0.2); opacity: 0.88; }
          100% { transform: scale(4.5); opacity: 0; }
        }
        @keyframes plg-spark-b {
          0%   { transform: scale(1);   opacity: 1; }
          45%  { transform: scale(1.6); opacity: 0.7; }
          100% { transform: scale(0.2); opacity: 0; }
        }
        @keyframes plg-dust-0 { 0% { transform:translate(0px,0px); opacity:.88; } 100% { transform:translate(15px,0px);   opacity:0; } }
        @keyframes plg-dust-1 { 0% { transform:translate(0px,0px); opacity:.88; } 100% { transform:translate(7px,13px);   opacity:0; } }
        @keyframes plg-dust-2 { 0% { transform:translate(0px,0px); opacity:.88; } 100% { transform:translate(-8px,13px);  opacity:0; } }
        @keyframes plg-dust-3 { 0% { transform:translate(0px,0px); opacity:.88; } 100% { transform:translate(-15px,0px);  opacity:0; } }
        @keyframes plg-dust-4 { 0% { transform:translate(0px,0px); opacity:.88; } 100% { transform:translate(-8px,-13px); opacity:0; } }
        @keyframes plg-dust-5 { 0% { transform:translate(0px,0px); opacity:.88; } 100% { transform:translate(7px,-13px);  opacity:0; } }
      `}</style>

      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        width="100%"
        height="auto"
        role="img"
        aria-label="Monthly leads by Indulge vertical — current month"
        style={{ display: "block" }}
      >
        <defs>
          <filter id="plg-glow" x="-20%" y="-80%" width="140%" height="260%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="1.6" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="plg-dot" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="1.8" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="plg-bloom" x="-120%" y="-120%" width="340%" height="340%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="7" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>

          {/* Area fill gradients per vertical */}
          {VERTICALS.map((v) => {
            const vGeo = geo.verticals[v];
            return (
              <linearGradient key={v} id={`plg-fill-${v.replace(/\s+/g, "-")}`}
                x1="0" y1={vGeo?.topY ?? MT} x2="0" y2={BOTTOM}
                gradientUnits="userSpaceOnUse">
                <stop offset="0%"   stopColor={VERTICAL_COLORS[v].line} stopOpacity="0.10" />
                <stop offset="100%" stopColor={VERTICAL_COLORS[v].line} stopOpacity="0" />
              </linearGradient>
            );
          })}
        </defs>

        {/* Chart area background */}
        <rect x={ML} y={MT} width={CHART_W} height={CHART_H}
          fill="rgba(255,255,255,0.015)" rx="2" />

        {/* Grid lines + Y-axis labels */}
        {Y_FRACS.map((f) => {
          const yPos      = MT + f * CHART_H;
          const value     = Math.round(geo.maxVal * (1 - f));
          const isBaseline = f === 1;
          return (
            <g key={f}>
              <line
                x1={ML} y1={yPos} x2={ML + CHART_W} y2={yPos}
                stroke={isBaseline ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.055)"}
                strokeWidth={isBaseline ? "0.8" : "0.5"}
                strokeDasharray={isBaseline ? undefined : "3 4"}
              />
              <line x1={ML - 3} y1={yPos} x2={ML} y2={yPos}
                stroke="rgba(255,255,255,0.16)" strokeWidth="0.6" />
              <text x={ML - 5} y={yPos} textAnchor="end" dominantBaseline="middle"
                fill="rgba(255,255,255,0.28)" fontSize="7"
                fontFamily="var(--font-inter, system-ui, sans-serif)">
                {value}
              </text>
            </g>
          );
        })}

        {/* Left Y-axis rail */}
        <line x1={ML} y1={MT} x2={ML} y2={BOTTOM}
          stroke="rgba(255,255,255,0.08)" strokeWidth="0.6" />

        {geo.isEmpty ? (
          <text x={VB_W / 2} y={VB_H / 2}
            textAnchor="middle" dominantBaseline="middle"
            fill="rgba(255,255,255,0.20)" fontSize="11"
            fontFamily="var(--font-inter, system-ui, sans-serif)">
            Collecting data…
          </text>
        ) : (
          <>
            {/* Area fills — rendered back-to-front so lower-volume lines stay visible */}
            {[...VERTICALS].reverse().map((v) => {
              const vGeo = geo.verticals[v];
              if (!vGeo?.area) return null;
              return (
                <path key={`area-${v}`} d={vGeo.area}
                  fill={`url(#plg-fill-${v.replace(/\s+/g, "-")})`} />
              );
            })}

            {/* Lines — same back-to-front order so Global (highest) renders on top */}
            {[...VERTICALS].reverse().map((v, idx) => {
              const vGeo = geo.verticals[v];
              if (!vGeo?.d) return null;
              return Line(`line-${v}`, vGeo.d, VERTICAL_COLORS[v].line, idx);
            })}

            {/* Event bursts */}
            {!reduced && pulseEvents.map((ev) => Burst(ev))}

            {/* Terminal pulse dots */}
            {VERTICALS.map((v, vi) => {
              const term = geo.verticals[v]?.term;
              if (!term) return null;
              const color = VERTICAL_COLORS[v].line;
              const ring  = VERTICAL_COLORS[v].ring;
              return (
                <g key={`term-${v}`}>
                  <circle className="plg-ring" cx={term.x} cy={term.y} r="5"
                    fill="none" stroke={ring} strokeWidth="0.8"
                    style={{
                      animation: reduced ? undefined : "plg-ring 2.5s ease-out infinite",
                      animationDelay: `${vi * 0.4}s`,
                    }} />
                  <circle cx={term.x} cy={term.y} r="2.5" fill={color} filter="url(#plg-dot)" />
                </g>
              );
            })}

            {/* Value labels — collision-resolved per day column */}
            {(() => {
              // Gather all label candidates
              type LblCandidate = { x: number; y: number; val: number; color: string; key: string };
              const candidates: LblCandidate[] = [];

              for (const v of VERTICALS) {
                const pts = geo.verticals[v]?.pts;
                if (!pts) continue;
                const color    = VERTICAL_COLORS[v].line;
                const toRender = showAllLabels
                  ? pts.filter((pt) => pt.val > 0)
                  : pts.slice(-1).filter((pt) => pt.val > 0);
                for (const pt of toRender) {
                  candidates.push({ x: pt.x, y: pt.y, val: pt.val, color, key: `lbl-${v}-${pts.indexOf(pt)}` });
                }
              }

              // Group by x-column, resolve vertical overlap
              const MIN_GAP = 10;
              const byX = new Map<number, LblCandidate[]>();
              for (const c of candidates) {
                const col = byX.get(c.x) ?? [];
                col.push(c);
                byX.set(c.x, col);
              }

              const resolved: Array<LblCandidate & { adjY: number }> = [];
              for (const col of byX.values()) {
                col.sort((a, b) => a.y - b.y);
                const adjY: number[] = [];
                for (let i = 0; i < col.length; i++) {
                  let y = col[i]!.y;
                  if (i > 0 && y - adjY[i - 1]! < MIN_GAP) y = adjY[i - 1]! + MIN_GAP;
                  y = Math.min(Math.max(y, MT + 5), BOTTOM - 5);
                  adjY.push(y);
                }
                col.forEach((c, i) => resolved.push({ ...c, adjY: adjY[i]! }));
              }

              return resolved.map(({ x, adjY, val, color, key }) => (
                <text
                  key={key}
                  x={x + 5} y={adjY}
                  textAnchor="start"
                  dominantBaseline="middle"
                  fill={color}
                  stroke="rgba(0,0,0,0.82)"
                  strokeWidth="2.8"
                  strokeLinejoin="round"
                  fontSize="7.5"
                  fontFamily="var(--font-inter, system-ui, sans-serif)"
                  fontWeight="700"
                  style={{ paintOrder: "stroke fill" }}
                >
                  {val}
                </text>
              ));
            })()}

            {/* X-axis day labels */}
            {geo.xLabels.map(({ x, label }) => (
              <text key={label} x={x} y={BOTTOM + 8}
                textAnchor="middle" dominantBaseline="hanging"
                fill="rgba(255,255,255,0.22)" fontSize="7.5"
                fontFamily="var(--font-inter, system-ui, sans-serif)">
                {label}
              </text>
            ))}

            {/* Legend — 2×2 grid top-right */}
            {VERTICALS.map((v, i) => {
              const col   = i % 2;
              const row   = Math.floor(i / 2);
              const cx    = VB_W - 110 + col * 56;
              const cy    = 8 + row * 12;
              const color = VERTICAL_COLORS[v].line;
              return (
                <g key={`leg-${v}`}>
                  <circle cx={cx} cy={cy} r="2.5" fill={color} fillOpacity="0.9" />
                  <text x={cx + 5} y={cy} dominantBaseline="middle"
                    fill="rgba(255,255,255,0.38)" fontSize="7"
                    fontFamily="var(--font-inter, system-ui, sans-serif)">
                    {VERTICAL_COLORS[v].label}
                  </text>
                </g>
              );
            })}
          </>
        )}
      </svg>
    </div>
  );
}
