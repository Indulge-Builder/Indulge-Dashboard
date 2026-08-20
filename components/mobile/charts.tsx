"use client";

/**
 * components/mobile/charts.tsx — dependency-free SVG charts for the founder
 * insight views, built per the dataviz method against the Indulge system:
 *
 * - Series palette = the customer app's own tokens (dark-example
 *   design-system): received = sky #94aecb, resolved = gold #d6ae68 —
 *   CVD ΔE 14.3, normal 15.4 on the row metal; the muted lightness and
 *   chroma ARE the app's shipped restraint (committed world), relieved
 *   by legend + the bone-plate tooltip + the value readout.
 * - Text wears text tokens (champagne inks), never series color; colored
 *   dots beside labels carry identity.
 * - Thin marks: 2px lines, recessive grid hairlines, tabular numerals.
 * - Touch = the hover layer: crosshair + tooltip on the line chart, per-bar
 *   tooltip on the histogram (hit targets are full-height columns).
 * - GPU discipline (DESIGN.md Law 1): tooltips reposition via transform.
 */

import { useMemo, useRef, useState } from "react";

export const SERIES = {
  received: "#94aecb", // the app's sky
  resolved: "#d6ae68", // the app's bullion gold
} as const;

/** rowMetal surface + gold hairline grid (the app's obsidian system). */
const SURFACE = "#141513";
const GRID = "rgba(214, 174, 104, 0.14)";
const BASELINE = "rgba(245, 241, 232, 0.18)";
const CROSSHAIR = "rgba(245, 241, 232, 0.3)";
const AREA_FILL = "rgba(214, 174, 104, 0.10)";

export interface PulsePoint {
  d: string; // YYYY-MM-DD (IST day)
  created: number;
  resolved: number;
}

const W = 320;
const H = 132;
const PAD_L = 6;
const PAD_R = 6;
const PAD_T = 10;
const PAD_B = 20;

function fmtDay(d: string): string {
  const [, m, day] = d.split("-");
  const months = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${Number(day)} ${months[Number(m)] ?? ""}`;
}

/** Two-series line chart with touch crosshair. One y-axis, always. */
export function PulseChart({ daily }: { daily: PulsePoint[] }) {
  const [pick, setPick] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const { linesC, linesR, areaR, max, xs } = useMemo(() => {
    const max = Math.max(1, ...daily.map((p) => Math.max(p.created, p.resolved)));
    const n = daily.length;
    const xs = daily.map(
      (_, i) => PAD_L + (i * (W - PAD_L - PAD_R)) / Math.max(1, n - 1),
    );
    const y = (v: number) => PAD_T + (1 - v / max) * (H - PAD_T - PAD_B);
    const pts = (key: "created" | "resolved") =>
      daily.map((p, i) => `${xs[i]},${y(p[key])}`).join(" ");
    const areaR =
      n > 1
        ? `M${xs[0]},${y(daily[0].resolved)} L` +
          daily.map((p, i) => `${xs[i]},${y(p.resolved)}`).join(" L") +
          ` L${xs[n - 1]},${H - PAD_B} L${xs[0]},${H - PAD_B} Z`
        : "";
    return { linesC: pts("created"), linesR: pts("resolved"), areaR, max, xs };
  }, [daily]);

  if (daily.length < 2) return <p className="m-empty">Not enough history yet.</p>;

  const yOf = (v: number) => PAD_T + (1 - v / max) * (H - PAD_T - PAD_B);
  const last = daily[daily.length - 1];

  function locate(clientX: number) {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * W;
    let best = 0;
    let bestDist = Infinity;
    xs.forEach((px, i) => {
      const d = Math.abs(px - x);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    });
    setPick(best);
  }

  const p = pick != null ? daily[pick] : null;

  return (
    <div className="m-chart">
      <div className="m-chart-legend" aria-hidden>
        <span className="m-legend-item">
          <i style={{ background: SERIES.received }} /> Received
        </span>
        <span className="m-legend-item">
          <i style={{ background: SERIES.resolved }} /> Resolved
        </span>
      </div>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="m-chart-svg"
        role="img"
        aria-label={`Daily received and resolved tickets, last ${daily.length} days. Latest day: ${last.created} received, ${last.resolved} resolved.`}
        onPointerDown={(e) => locate(e.clientX)}
        onPointerMove={(e) => e.buttons > 0 && locate(e.clientX)}
        onPointerLeave={() => setPick(null)}
      >
        {/* recessive grid */}
        {[1 / 3, 2 / 3].map((f) => (
          <line
            key={f}
            x1={PAD_L}
            x2={W - PAD_R}
            y1={PAD_T + f * (H - PAD_T - PAD_B)}
            y2={PAD_T + f * (H - PAD_T - PAD_B)}
            stroke={GRID}
            strokeWidth="1"
            strokeDasharray="3 4"
          />
        ))}
        <line
          x1={PAD_L}
          x2={W - PAD_R}
          y1={H - PAD_B}
          y2={H - PAD_B}
          stroke={BASELINE}
          strokeWidth="1"
        />
        {/* resolved area + line (brand gold leads) */}
        <path d={areaR} fill={AREA_FILL} />
        <polyline
          points={linesR}
          fill="none"
          stroke={SERIES.resolved}
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <polyline
          points={linesC}
          fill="none"
          stroke={SERIES.received}
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
          opacity="0.9"
        />
        {/* endpoint dots with surface ring */}
        <circle cx={xs[xs.length - 1]} cy={yOf(last.resolved)} r="3.5" fill={SERIES.resolved} stroke={SURFACE} strokeWidth="2" />
        <circle cx={xs[xs.length - 1]} cy={yOf(last.created)} r="3.5" fill={SERIES.received} stroke={SURFACE} strokeWidth="2" />
        {/* crosshair */}
        {p && pick != null && (
          <g>
            <line x1={xs[pick]} x2={xs[pick]} y1={PAD_T} y2={H - PAD_B} stroke={CROSSHAIR} strokeWidth="1" />
            <circle cx={xs[pick]} cy={yOf(p.resolved)} r="4" fill={SERIES.resolved} stroke={SURFACE} strokeWidth="2" />
            <circle cx={xs[pick]} cy={yOf(p.created)} r="4" fill={SERIES.received} stroke={SURFACE} strokeWidth="2" />
          </g>
        )}
        {/* x labels: first / last */}
        <text x={PAD_L} y={H - 6} className="m-chart-tick" textAnchor="start">
          {fmtDay(daily[0].d)}
        </text>
        <text x={W - PAD_R} y={H - 6} className="m-chart-tick" textAnchor="end">
          {fmtDay(last.d)}
        </text>
        {/* y max */}
        <text x={PAD_L} y={PAD_T + 4} className="m-chart-tick" textAnchor="start" opacity="0.7">
          {max}
        </text>
      </svg>
      <div className="m-chart-tip" data-show={!!p} aria-live="polite">
        {p && (
          <>
            <span className="m-tip-day">{fmtDay(p.d)}</span>
            <span className="m-tip-val"><i style={{ background: SERIES.received }} />{p.created}</span>
            <span className="m-tip-val"><i style={{ background: SERIES.resolved }} />{p.resolved}</span>
          </>
        )}
      </div>
    </div>
  );
}

/** 24-column arrival histogram (IST hours). Single hue = magnitude. */
export function HourBars({ hourly }: { hourly: number[] }) {
  const [pick, setPick] = useState<number | null>(null);
  const max = Math.max(1, ...hourly);
  const peak = hourly.indexOf(Math.max(...hourly));
  return (
    <div className="m-chart">
      <div className="m-hourbars" role="img" aria-label={`Ticket arrivals by hour of day. Peak at ${peak}:00.`}>
        {hourly.map((n, h) => (
          <button
            key={h}
            className="m-hourbar-hit"
            data-active={pick === h}
            onPointerDown={() => setPick(h === pick ? null : h)}
            aria-label={`${h}:00 — ${n} tickets`}
          >
            <i
              style={{
                transform: `scaleY(${Math.max(0.03, n / max)})`,
                opacity: 0.35 + 0.65 * (n / max),
              }}
            />
          </button>
        ))}
      </div>
      <div className="m-hourbar-axis" aria-hidden>
        <span>12am</span><span>6am</span><span>12pm</span><span>6pm</span><span>11pm</span>
      </div>
      {pick != null ? (
        <button
          className="m-chart-note m-chart-note-clear"
          onClick={() => setPick(null)}
          aria-label="Clear hour selection"
        >
          {pick}:00 IST — {hourly[pick]} tickets ✕
        </button>
      ) : (
        <p className="m-chart-note">Peak hour: {peak}:00 IST</p>
      )}
    </div>
  );
}

/** Label + value + scaled bar rows — identity via position, one hue. */
export function MixBars({
  items,
  topN = 6,
}: {
  items: Array<{ k: string; n: number }>;
  topN?: number;
}) {
  const shown = items.slice(0, topN);
  const rest = items.slice(topN).reduce((s, i) => s + i.n, 0);
  const rows = rest > 0 ? [...shown, { k: "Other", n: rest }] : shown;
  const max = Math.max(1, ...rows.map((r) => r.n));
  return (
    <div className="m-mixbars">
      {rows.map((r) => (
        <div key={r.k} className="m-mixbar">
          <span className="m-mixbar-label">{r.k}</span>
          <span className="m-mixbar-n">{r.n.toLocaleString("en-IN")}</span>
          <div className="m-mixbar-track" aria-hidden>
            <i style={{ transform: `scaleX(${r.n / max})` }} />
          </div>
        </div>
      ))}
      {rows.length === 0 && <p className="m-empty">No data in this window.</p>}
    </div>
  );
}
