"use client";

import React, { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import {
  ZOHO_LEAD_STATUSES,
  type AgentLeadStatusBreakdown,
  type ZohoLeadStatus,
} from "@/lib/onboardingTypes";

/**
 * One swatch per canonical Zoho lead status (lib/leadStatus.ts). Segment and
 * legend order follow ZOHO_LEAD_STATUSES (pipeline best → worst).
 */
export const STATUS_COLORS: Record<
  ZohoLeadStatus,
  {
    gradient: string;
    flat: string;
    glow: string;
    label: string;
    short: string;
  }
> = {
  /* Win — gold: the lead is won (the same gold as the Converted tile) */
  Win: {
    gradient: "linear-gradient(160deg, #fde68a 0%, #f59e0b 55%, #b45309 100%)",
    flat:     "#f59e0b",
    glow:     "rgba(245,158,11,0.75)",
    label:    "Win",
    short:    "Win",
  },
  /* Payment Link — rose: payment link sent, closing */
  "Payment Link": {
    gradient: "linear-gradient(160deg, #f9a8d4 0%, #ec4899 55%, #9d174d 100%)",
    flat:     "#ec4899",
    glow:     "rgba(236,72,153,0.75)",
    label:    "Payment Link",
    short:    "Pay Link",
  },
  /* Conversing — green: live conversation */
  Conversing: {
    gradient: "linear-gradient(160deg, #4ade80 0%, #22c55e 55%, #15803d 100%)",
    flat:     "#22c55e",
    glow:     "rgba(34,197,94,0.75)",
    label:    "Conversing",
    short:    "Conversing",
  },
  /* Nurturing — purple */
  Nurturing: {
    gradient: "linear-gradient(160deg, #c084fc 0%, #a855f7 55%, #7e22ce 100%)",
    flat:     "#a855f7",
    glow:     "rgba(168,85,247,0.75)",
    label:    "Nurturing",
    short:    "Nurturing",
  },
  /* RNR — yellow: rang, no response (legacy "Touched" / "Attempted" map here) */
  RNR: {
    gradient: "linear-gradient(160deg, #fef08a 0%, #eab308 55%, #a16207 100%)",
    flat:     "#eab308",
    glow:     "rgba(234,179,8,0.75)",
    label:    "RNR",
    short:    "RNR",
  },
  /* New — slate: untouched */
  New: {
    gradient: "linear-gradient(160deg, #cbd5e1 0%, #94a3b8 55%, #475569 100%)",
    flat:     "#94a3b8",
    glow:     "rgba(148,163,184,0.55)",
    label:    "New",
    short:    "New",
  },
  /* Cold — ice blue: went cold */
  Cold: {
    gradient: "linear-gradient(160deg, #bfdbfe 0%, #60a5fa 55%, #1d4ed8 100%)",
    flat:     "#60a5fa",
    glow:     "rgba(96,165,250,0.70)",
    label:    "Cold",
    short:    "Cold",
  },
  /* Lost — orange: engaged, then lost (distinct from Junk) */
  Lost: {
    gradient: "linear-gradient(160deg, #fdba74 0%, #f97316 55%, #c2410c 100%)",
    flat:     "#f97316",
    glow:     "rgba(249,115,22,0.75)",
    label:    "Lost",
    short:    "Lost",
  },
  /* Junk — red (Junk, Not Qualified, legacy Trash) */
  Junk: {
    gradient: "linear-gradient(160deg, #fca5a5 0%, #ef4444 55%, #991b1b 100%)",
    flat:     "#ef4444",
    glow:     "rgba(239,68,68,0.75)",
    label:    "Junk",
    short:    "Junk",
  },
};

/* Keep backward-compatible `bar` key used by sibling components */
export type StatusColorEntry = (typeof STATUS_COLORS)[ZohoLeadStatus];

interface LeadStatusHealthBarProps {
  breakdown: AgentLeadStatusBreakdown;
  className?: string;
}

function cn(...parts: Array<string | undefined | null | false>) {
  return parts.filter(Boolean).join(" ");
}

const ORDERED_STATUSES: readonly ZohoLeadStatus[] = ZOHO_LEAD_STATUSES;

const BAR_H   = "clamp(44px, 5.2cqh, 78px)";
const RADIUS  = "clamp(7px, 0.85cqh, 13px)";
const LEGEND_GAP = "clamp(6px, 0.65cqmin, 10px)";

/**
 * Balanced legend rows. Chips are first laid out at their natural width (so
 * "Conversing" is never truncated); this hook measures them, finds the fewest
 * rows they fit in, then splits the chips EVENLY across those rows (pipeline
 * order kept) and returns one flex-basis per chip — natural width plus an
 * equal share of the row's leftover — so every row is filled edge to edge and
 * no lone chip is stretched across a whole row. Re-runs on resize and
 * whenever the set of statuses changes. Returns null while measuring.
 */
function useBalancedChipRows(
  containerRef: React.RefObject<HTMLDivElement | null>,
  count: number,
  key: string,
): string[] | null {
  const [widths, setWidths] = useState<string[] | null>(null);
  // Width the current layout was computed for. Assigning chip widths changes
  // the legend's HEIGHT (rows wrap), which also fires the ResizeObserver — a
  // re-measure on every such fire oscillated between layouts at some zoom
  // levels ("vibrating boxes", 2026-09-07). Only a WIDTH change re-measures.
  const measuredWidth = useRef(-1);

  useLayoutEffect(() => {
    setWidths(null); // back to natural widths so the next measurement is true
    measuredWidth.current = -1;
    const el = containerRef.current;
    if (!el || count === 0) return;

    const measure = () => {
      const chips = Array.from(el.children) as HTMLElement[];
      if (chips.length !== count) return;
      const gap = parseFloat(getComputedStyle(el).columnGap) || 0;
      const W = el.clientWidth;
      if (W <= 0) return;
      measuredWidth.current = W;
      const natural = chips.map((c) => c.scrollWidth);

      // Greedy pack → minimal row count with natural widths.
      const greedy: number[][] = [];
      let row: number[] = [];
      let used = 0;
      natural.forEach((w, i) => {
        const need = (row.length ? gap : 0) + w;
        if (row.length && used + need > W) {
          greedy.push(row);
          row = [];
          used = 0;
        }
        row.push(i);
        used += (row.length > 1 ? gap : 0) + w;
      });
      if (row.length) greedy.push(row);

      // Even split into the same number of rows, if every row still fits.
      const r = greedy.length;
      const k = Math.ceil(count / r);
      const even: number[][] = [];
      for (let i = 0; i < count; i += k) even.push(natural.map((_, j) => j).slice(i, i + k));
      const fits = even.every(
        (ids) => ids.reduce((sum, i) => sum + natural[i], 0) + gap * (ids.length - 1) <= W,
      );
      const rows = fits ? even : greedy;

      // Each chip keeps its natural width; only the row's leftover is shared
      // equally — an equal split would squeeze "Conversing" under "RNR".
      const out = new Array<string>(count);
      for (const ids of rows) {
        const m = ids.length;
        const used = ids.reduce((sum, i) => sum + natural[i], 0) + gap * (m - 1);
        const extra = Math.max(0, W - used) / m;
        for (const i of ids) out[i] = `${Math.floor(natural[i] + extra)}px`;
      }
      setWidths(out);
    };

    // Measure after the natural-width paint, then keep it fresh on WIDTH
    // changes only (height changes are our own doing).
    let raf = requestAnimationFrame(measure);
    const ro = new ResizeObserver(() => {
      if (el.clientWidth === measuredWidth.current) return;
      measuredWidth.current = -1;
      setWidths(null);
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(measure);
    });
    ro.observe(el);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [containerRef, count, key]);

  return widths;
}


function LeadStatusHealthBar_({
  breakdown,
  className,
}: LeadStatusHealthBarProps) {
  const reduced = usePrefersReducedMotion();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  const orderedNonZero = useMemo(
    () => ORDERED_STATUSES.filter((s) => (breakdown?.[s] ?? 0) > 0),
    [breakdown],
  );
  const legendRef = useRef<HTMLDivElement | null>(null);
  const chipWidths = useBalancedChipRows(legendRef, orderedNonZero.length, orderedNonZero.join("|"));

  /* ── Empty state ─────────────────────────────────────────────────────────── */
  if (!breakdown || breakdown.total === 0) {
    return (
      <div className={cn("w-full select-none", className)}>
        <PipelineLabel />
        <div
          className="relative w-full overflow-hidden"
          style={{ height: BAR_H, borderRadius: RADIUS }}
        >
          <div
            className="absolute inset-0"
            style={{ background: "rgba(255,255,255,0.05)" }}
          />
          <div
            className="absolute inset-0 pointer-events-none"
            aria-hidden
            style={{
              background:
                "linear-gradient(115deg, transparent 20%, rgba(255,255,255,0.10) 45%, rgba(255,255,255,0.22) 50%, rgba(255,255,255,0.10) 55%, transparent 80%)",
              backgroundSize: "200% auto",
              animation: reduced
                ? undefined
                : "foil-shimmer 2.2s cubic-bezier(0.4,0,0.2,1) infinite",
              opacity: 0.4,
            }}
          />
        </div>
      </div>
    );
  }

  /* ── Populated bar ───────────────────────────────────────────────────────── */
  let cumulativePct = 0;

  return (
    <div className={cn("w-full select-none", className)}>
      {/* Pipeline header */}
      <PipelineLabel />

      {/* Segmented bar track */}
      <div
          className="relative w-full overflow-hidden"
          style={{
            height:     BAR_H,
            borderRadius: RADIUS,
            background: "rgba(255,255,255,0.05)",
            zIndex:     1,
          }}
          aria-label={`Pipeline: ${breakdown.total} leads`}
          role="img"
        >
          {/* Segments */}
          {orderedNonZero.map((status, idx) => {
            const count = breakdown[status] ?? 0;
            const pct   = (count / Math.max(breakdown.total, 1)) * 100;
            const left  = cumulativePct;
            cumulativePct += pct;
            const showCount = pct >= 5;

            return (
              <div
                key={status}
                style={{
                  position:   "absolute",
                  left:       `${left}%`,
                  width:      `${mounted ? pct : 0}%`,
                  height:     "100%",
                  background: STATUS_COLORS[status].gradient,
                  transition: reduced
                    ? "none"
                    : `width 0.9s cubic-bezier(0.16, 1, 0.32, 1) ${idx * 80}ms`,
                  willChange: reduced ? undefined : "width",
                  display:    "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  overflow:   "hidden",
                  boxShadow:  `inset 0 1px 0 rgba(255,255,255,0.28), inset 0 -1px 0 rgba(0,0,0,0.22)`,
                  zIndex:     2,
                }}
              >
                {/* Count label inside segment */}
                {showCount && (
                  <span
                    style={{
                      fontSize:      "clamp(22px, 2.8cqmin, 44px)",
                      fontFamily:    "'Cinzel', serif",
                      fontWeight:    700,
                      color:         "rgba(255,255,255,0.97)",
                      letterSpacing: "0.05em",
                      textShadow:    "0 2px 8px rgba(0,0,0,0.85)",
                      lineHeight:    1,
                      position:      "relative",
                      zIndex:        5,
                    }}
                  >
                    {count}
                  </span>
                )}
              </div>
            );
          })}

          {/* 1-px black dividers between segments */}
          <SegmentGaps segments={orderedNonZero} breakdown={breakdown} />

          {/* Top gloss stripe */}
          <div
            aria-hidden
            style={{
              position:   "absolute",
              top:        0,
              left:       0,
              right:      0,
              height:     "38%",
              background: "linear-gradient(to bottom, rgba(255,255,255,0.13) 0%, transparent 100%)",
              pointerEvents: "none",
              zIndex:     3,
            }}
          />

          {/* Bottom depth shadow */}
          <div
            aria-hidden
            style={{
              position:   "absolute",
              bottom:     0,
              left:       0,
              right:      0,
              height:     "28%",
              background: "linear-gradient(to top, rgba(0,0,0,0.28) 0%, transparent 100%)",
              pointerEvents: "none",
              zIndex:     3,
            }}
          />

          {/* Outer inset ring */}
          <div
            aria-hidden
            style={{
              position:   "absolute",
              inset:      0,
              borderRadius: RADIUS,
              boxShadow:  "inset 0 0 0 1px rgba(255,255,255,0.10)",
              pointerEvents: "none",
              zIndex:     6,
            }}
          />
        </div>

      {/* Legend — tinted chips: dot · label ·· count.
          Labels are never truncated: chips start at their natural width, the
          row WRAPS, and useBalancedChipRows then hands every chip a basis so
          the rows come out even (3+3, 3+2 …) and each fills its row. */}
      <div
        ref={legendRef}
        className="flex flex-row flex-wrap items-stretch"
        style={{
          marginTop: "clamp(10px, 1.5cqh, 20px)",
          gap:       LEGEND_GAP,
        }}
      >
        {orderedNonZero.map((status, idx) => {
          const count = breakdown[status] ?? 0;
          const cfg   = STATUS_COLORS[status];
          const basis = chipWidths?.[idx];
          return (
            <div
              key={status}
              className="flex items-center justify-between"
              style={{
                flex:      basis ? `0 0 ${basis}` : "0 0 auto",
                minWidth:  basis ? 0 : "max-content",
                minHeight:
                  "clamp(48px, 7cqh, 104px)",
                padding:
                  "clamp(10px, 1.4cqh, 18px) clamp(10px, 1.1cqmin, 18px)",
                borderRadius: "clamp(6px, 0.75cqmin, 11px)",
                background:   "#101722",
                border:       `1px solid color-mix(in srgb, ${cfg.flat} 30%, transparent)`,
                boxShadow:    "inset 0 1px 0 rgba(255,255,255,0.04)",
                gap:          "clamp(6px, 0.6cqmin, 10px)",
                opacity:      mounted ? 1 : 0,
                transform:    mounted ? "none" : "translateY(6px)",
                transition: reduced
                  ? "none"
                  : `opacity 0.45s cubic-bezier(0.23,1,0.32,1) ${idx * 50}ms, transform 0.45s cubic-bezier(0.23,1,0.32,1) ${idx * 50}ms`,
              }}
            >
              {/* Dot + status name — matches the card's Montserrat label tier */}
              <div
                className="flex min-w-0 items-center"
                style={{ gap: "clamp(5px, 0.5cqmin, 9px)" }}
              >
                <div
                  aria-hidden
                  style={{
                    width:        "clamp(10px, 1.2cqmin, 16px)",
                    height:       "clamp(10px, 1.2cqmin, 16px)",
                    borderRadius: "50%",
                    background:   cfg.flat,
                    boxShadow:    `0 0 8px ${cfg.glow}`,
                    flexShrink:   0,
                  }}
                />
                <span
                  className="whitespace-nowrap font-montserrat"
                  style={{
                    fontSize:
                      "clamp(19px, min(2.7cqmin, 2.9cqw), 38px)",
                    fontWeight:    600,
                    color:         cfg.flat,
                    letterSpacing: "0.12em",
                    textTransform: "uppercase" as const,
                    lineHeight:    1.1,
                    opacity:       0.9,
                  }}
                >
                  {cfg.short}
                </span>
              </div>

              {/* Count — quiet tier; the hero counts live inside the bar segments */}
              <span
                style={{
                  fontSize:
                    "clamp(26px, min(3.8cqmin, 4cqw), 54px)",
                  fontFamily:    "'Cinzel', serif",
                  fontWeight:    700,
                  color:         cfg.flat,
                  lineHeight:    1,
                  letterSpacing: "0.04em",
                  textShadow:    `0 0 10px ${cfg.glow}`,
                  flexShrink:    0,
                }}
              >
                {count}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Pipeline header label ─────────────────────────────────────────────────── */
function PipelineLabel() {
  return (
    <div
      className="flex items-center"
      style={{ marginTop: "clamp(6px, 0.9cqh, 13px)", marginBottom: "clamp(12px, 1.6cqh, 22px)", gap: "clamp(8px, 1cqmin, 14px)" }}
    >
      <div
        aria-hidden
        style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.09)" }}
      />
      {/* Band-title tier — matches QueendomPanel BAND_TITLE_CLASS
          ("Time Since Last Resolved"): Cinzel semibold, 0.24em tracking,
          width-fit font capped at 4rem, champagne. */}
      <span
        style={{
          fontSize:      "min(calc((100cqw - 5rem) / 20.5), 4rem)",
          fontFamily:    "'Cinzel', serif",
          fontWeight:    600,
          color:         "var(--color-champagne)",
          letterSpacing: "0.24em",
          lineHeight:    1.1,
          flexShrink:    0,
          textTransform: "uppercase" as const,
          whiteSpace:    "nowrap" as const,
        }}
      >
        Pipeline
      </span>
      <div
        aria-hidden
        style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.09)" }}
      />
    </div>
  );
}

/* ── 2px black gap dividers between segments ─────────────────────────────── */
function SegmentGaps({
  segments,
  breakdown,
}: {
  segments: ZohoLeadStatus[];
  breakdown: AgentLeadStatusBreakdown;
}) {
  let acc = 0;
  return (
    <>
      {segments.slice(0, -1).map((status) => {
        const pct = ((breakdown[status] ?? 0) / Math.max(breakdown.total, 1)) * 100;
        acc += pct;
        return (
          <div
            key={`gap-${status}`}
            aria-hidden
            style={{
              position:  "absolute",
              left:      `${acc}%`,
              top:       0,
              bottom:    0,
              width:     "2px",
              background: "rgba(0,0,0,0.6)",
              transform: "translateX(-50%)",
              zIndex:    5,
            }}
          />
        );
      })}
    </>
  );
}

export const LeadStatusHealthBar = memo(LeadStatusHealthBar_);
LeadStatusHealthBar.displayName = "LeadStatusHealthBar";
