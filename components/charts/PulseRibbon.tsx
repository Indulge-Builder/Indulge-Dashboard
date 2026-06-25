"use client";

/**
 * components/charts/PulseRibbon.tsx
 *
 * "The Pulse" — a thin, wide dual-area ribbon of the month's daily ticket flow.
 * Champagne fill = received per day; emerald fill = resolved per day. Where
 * emerald rides above champagne the Queendom is clearing backlog; where it dips
 * below, work is piling up. A pulsing marker sits on the latest (today) point.
 *
 * Native SVG only (project rule: no Recharts/Chart.js/D3). Renders into a
 * 0..100 × 0..36 viewBox stretched to fill its container, so it scales with the
 * panel's container-query sizing without per-breakpoint math.
 */

import { useId, useMemo } from "react";
import { motion } from "framer-motion";
import type { DailyPoint } from "@/lib/ticketTimeSeries";

const VW = 100;
const VH = 36;
const PAD_TOP = 4;
const PAD_BOTTOM = 3;

interface PulseRibbonProps {
  daily: DailyPoint[];
  peak: number;
  /** Stagger the path draw-in (seconds). */
  delay?: number;
}

/** Catmull-Rom → cubic Bézier smoothing for a soft luxury curve. */
function smoothPath(points: Array<[number, number]>): string {
  if (points.length === 0) return "";
  if (points.length === 1) {
    const [x, y] = points[0];
    return `M ${x} ${y} L ${x} ${y}`;
  }
  let d = `M ${points[0][0]} ${points[0][1]}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2[0]} ${p2[1]}`;
  }
  return d;
}

export default function PulseRibbon({ daily, peak, delay = 0 }: PulseRibbonProps) {
  const uid = useId().replace(/[:]/g, "");
  const { receivedLine, receivedArea, resolvedLine, resolvedArea, lastPt } = useMemo(() => {
    const n = daily.length;
    const max = Math.max(peak, 1);
    const usableH = VH - PAD_TOP - PAD_BOTTOM;
    const baseY = VH - PAD_BOTTOM;
    const xAt = (i: number) => (n <= 1 ? VW / 2 : (i / (n - 1)) * VW);
    const yAt = (v: number) => baseY - (v / max) * usableH;

    const recvPts = daily.map((p, i) => [xAt(i), yAt(p.received)] as [number, number]);
    const resvPts = daily.map((p, i) => [xAt(i), yAt(p.resolved)] as [number, number]);

    const line = (pts: Array<[number, number]>) => smoothPath(pts);
    const area = (pts: Array<[number, number]>) =>
      pts.length ? `${smoothPath(pts)} L ${pts[pts.length - 1][0]} ${baseY} L ${pts[0][0]} ${baseY} Z` : "";

    return {
      receivedLine: line(recvPts),
      receivedArea: area(recvPts),
      resolvedLine: line(resvPts),
      resolvedArea: area(resvPts),
      lastPt: resvPts.length ? resvPts[resvPts.length - 1] : null,
    };
  }, [daily, peak]);

  if (!daily.length) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <span className="label-field text-champagne/40">No activity yet this month</span>
      </div>
    );
  }

  return (
    <svg
      viewBox={`0 0 ${VW} ${VH}`}
      preserveAspectRatio="none"
      className="h-full w-full overflow-visible"
      role="img"
      aria-label="Daily tickets received versus resolved this month"
    >
      <defs>
        <linearGradient id={`recvFill-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#F7E7CE" stopOpacity="0.30" />
          <stop offset="100%" stopColor="#F7E7CE" stopOpacity="0.02" />
        </linearGradient>
        <linearGradient id={`resvFill-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#34d399" stopOpacity="0.40" />
          <stop offset="100%" stopColor="#34d399" stopOpacity="0.03" />
        </linearGradient>
        <filter id={`glow-${uid}`} x="-20%" y="-40%" width="140%" height="200%">
          <feGaussianBlur stdDeviation="0.6" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Received — champagne, behind */}
      <motion.path
        d={receivedArea}
        fill={`url(#recvFill-${uid})`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, delay }}
      />
      <motion.path
        d={receivedLine}
        fill="none"
        stroke="#F7E7CE"
        strokeOpacity="0.55"
        strokeWidth="0.5"
        vectorEffect="non-scaling-stroke"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1.1, delay, ease: "easeInOut" }}
      />

      {/* Resolved — emerald, in front */}
      <motion.path
        d={resolvedArea}
        fill={`url(#resvFill-${uid})`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, delay: delay + 0.15 }}
      />
      <motion.path
        d={resolvedLine}
        fill="none"
        stroke="#34d399"
        strokeWidth="0.7"
        vectorEffect="non-scaling-stroke"
        filter={`url(#glow-${uid})`}
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1.1, delay: delay + 0.15, ease: "easeInOut" }}
      />

      {/* Today marker — pulsing emerald dot on the latest resolved point */}
      {lastPt && (
        <>
          <motion.circle
            cx={lastPt[0]}
            cy={lastPt[1]}
            r="1.4"
            fill="#34d399"
            fillOpacity="0.35"
            animate={{ r: [1.4, 3.2, 1.4], fillOpacity: [0.35, 0, 0.35] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
          />
          <circle cx={lastPt[0]} cy={lastPt[1]} r="0.9" fill="#34d399" filter={`url(#glow-${uid})`} />
        </>
      )}
    </svg>
  );
}
