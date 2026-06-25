"use client";

/**
 * components/charts/HeartbeatBars.tsx
 *
 * "The Heartbeat" — a thin, wide 24-bar burst showing the Queendom's daily
 * rhythm: how many tickets get resolved in each hour of the day (IST). The
 * tallest bar (peak hour) glows gold; the rest are champagne. Tick labels at
 * 0 / 6 / 12 / 18 / 24h anchor the eye.
 *
 * Native SVG only. 0..100 × 0..36 viewBox stretched to fill the container.
 */

import { useId, useMemo } from "react";
import { motion } from "framer-motion";

const VW = 100;
const VH = 36;
const PAD_TOP = 3;
const AXIS_H = 5; // room for hour labels at the bottom
const GAP = 0.35; // fraction of slot width left as gutter

// Anchor ticks at midnight / 6am / noon / 6pm / midnight, labelled 12-hour AM/PM.
const HOUR_TICKS = [0, 6, 12, 18, 24];

/** 0..24 hour-of-day → "12am" / "6am" / "12pm" / "6pm" label. */
function hourToAmPm(hr: number): string {
  const h = hr % 24; // 24 → 0 (midnight)
  const period = h < 12 ? "am" : "pm";
  const display = h % 12 === 0 ? 12 : h % 12;
  return `${display}${period}`;
}

interface HeartbeatBarsProps {
  /** 24-length array: tickets resolved per IST hour. */
  hourly: number[];
  peak: number;
  delay?: number;
}

export default function HeartbeatBars({ hourly, peak, delay = 0 }: HeartbeatBarsProps) {
  const uid = useId().replace(/[:]/g, "");
  const { bars, peakIdx, baseY } = useMemo(() => {
    const max = Math.max(peak, 1);
    const slotW = VW / 24;
    const barW = slotW * (1 - GAP);
    const usableH = VH - PAD_TOP - AXIS_H;
    const base = VH - AXIS_H;
    let pIdx = -1;
    for (let i = 0; i < 24; i++) if (hourly[i] === peak && peak > 0 && pIdx < 0) pIdx = i;

    const out = hourly.slice(0, 24).map((v, i) => {
      const h = (v / max) * usableH;
      return {
        x: i * slotW + (slotW - barW) / 2,
        y: base - h,
        w: barW,
        h: Math.max(h, v > 0 ? 0.6 : 0), // keep a sliver visible for any non-zero hour
        v,
        i,
      };
    });
    return { bars: out, peakIdx: pIdx, baseY: base };
  }, [hourly, peak]);

  const total = useMemo(() => hourly.reduce((a, b) => a + b, 0), [hourly]);

  if (total === 0) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <span className="label-field text-champagne/40">No resolutions yet today</span>
      </div>
    );
  }

  // Peak-bar label is rendered as an HTML overlay (not SVG <text>) because the
  // chart SVG uses preserveAspectRatio="none" — rotated text inside it would
  // shear. Position it by % so it tracks the bar at any container size.
  const peakBar = peakIdx >= 0 ? bars[peakIdx] : null;
  const peakLabel =
    peakBar && peakBar.v > 0
      ? {
          leftPct: ((peakBar.x + peakBar.w / 2) / VW) * 100,
          // anchor on the bar's vertical MIDPOINT so the rotated label sits
          // centered inside the bar (peakBar.y = top, baseY = bottom).
          topPct: (((peakBar.y + baseY) / 2) / VH) * 100,
        }
      : null;

  return (
    <div className="relative h-full w-full">
    <svg
      viewBox={`0 0 ${VW} ${VH}`}
      preserveAspectRatio="none"
      className="h-full w-full overflow-visible"
      role="img"
      aria-label="Tickets resolved by hour of day"
    >
      <defs>
        <linearGradient id={`barGold-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#F2D58A" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#c9a84c" stopOpacity="0.45" />
        </linearGradient>
        <linearGradient id={`barChamp-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#F7E7CE" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#F7E7CE" stopOpacity="0.10" />
        </linearGradient>
        <filter id={`hbGlow-${uid}`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="0.5" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* baseline */}
      <line x1="0" y1={baseY} x2={VW} y2={baseY} stroke="#c9a84c" strokeOpacity="0.18" strokeWidth="0.3" />

      {bars.map((b) =>
        b.h <= 0 ? null : (
          <motion.rect
            key={b.i}
            x={b.x}
            width={b.w}
            rx="0.4"
            fill={`url(#${b.i === peakIdx ? "barGold" : "barChamp"}-${uid})`}
            filter={b.i === peakIdx ? `url(#hbGlow-${uid})` : undefined}
            initial={{ height: 0, y: baseY }}
            animate={{ height: b.h, y: b.y }}
            transition={{ duration: 0.5, delay: delay + b.i * 0.012, ease: "easeOut" }}
          />
        ),
      )}

      {/* hour ticks */}
      {HOUR_TICKS.map((hr) => {
        const x = (hr / 24) * VW;
        return (
          <text
            key={hr}
            x={Math.min(Math.max(x, 2), VW - 2)}
            y={VH - 0.5}
            textAnchor={hr === 0 ? "start" : hr === 24 ? "end" : "middle"}
            fill="#F7E7CE"
            fillOpacity="0.4"
            fontSize="3"
            fontFamily="var(--font-montserrat, sans-serif)"
          >
            {hourToAmPm(hr)}
          </text>
        );
      })}
    </svg>

      {/* Peak-hour label — rotated, written INSIDE the gold bar (HTML overlay so
          it doesn't shear under the SVG's non-uniform scaling). */}
      {peakLabel && (
        <motion.span
          className="pointer-events-none absolute font-montserrat font-bold leading-none"
          style={{
            left: `${peakLabel.leftPct}%`,
            top: `${peakLabel.topPct}%`,
            transform: "translate(-50%, -50%) rotate(-90deg)",
            transformOrigin: "center center",
            color: "#3a2c08",
            fontSize: "clamp(12px, 1.7cqw, 20px)",
            letterSpacing: "0.04em",
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: delay + peakIdx * 0.012 + 0.45 }}
        >
          {hourToAmPm(peakIdx)}
        </motion.span>
      )}
    </div>
  );
}
