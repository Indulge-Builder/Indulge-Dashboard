"use client";

import React, { memo, useEffect, useMemo, useState } from "react";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import type {
  AgentLeadStatusBreakdown,
  ZohoLeadStatus,
} from "@/lib/onboardingTypes";

export const STATUS_COLORS: Record<
  ZohoLeadStatus,
  {
    gradient: string;
    flat: string;
    glow: string;
    label: string;
    short: string;
    order: number;
  }
> = {
  /* Qualified — teal/cyan, distinct from In Discussion green */
  Qualified: {
    gradient: "linear-gradient(160deg, #67e8f9 0%, #06b6d4 55%, #0e7490 100%)",
    flat:     "#06b6d4",
    glow:     "rgba(6,182,212,0.75)",
    label:    "Qualified",
    short:    "Qualified",
    order:    0,
  },
  /* In Discussion — green */
  "In Discussion": {
    gradient: "linear-gradient(160deg, #4ade80 0%, #22c55e 55%, #15803d 100%)",
    flat:     "#22c55e",
    glow:     "rgba(34,197,94,0.75)",
    label:    "In Discussion",
    short:    "In Discussion",
    order:    1,
  },
  /* Nurturing — purple (unchanged) */
  Nurturing: {
    gradient: "linear-gradient(160deg, #c084fc 0%, #a855f7 55%, #7e22ce 100%)",
    flat:     "#a855f7",
    glow:     "rgba(168,85,247,0.75)",
    label:    "Nurturing",
    short:    "Nurturing",
    order:    2,
  },
  /* Touched — yellow (Zoho stage; legacy "Attempted" maps here in API) */
  Touched: {
    gradient: "linear-gradient(160deg, #fef08a 0%, #eab308 55%, #a16207 100%)",
    flat:     "#eab308",
    glow:     "rgba(234,179,8,0.75)",
    label:    "Touched",
    short:    "Touched",
    order:    3,
  },
  /* New — slate */
  New: {
    gradient: "linear-gradient(160deg, #cbd5e1 0%, #94a3b8 55%, #475569 100%)",
    flat:     "#94a3b8",
    glow:     "rgba(148,163,184,0.55)",
    label:    "New",
    short:    "New",
    order:    4,
  },
  /* Junk — red */
  Junk: {
    gradient: "linear-gradient(160deg, #fca5a5 0%, #ef4444 55%, #991b1b 100%)",
    flat:     "#ef4444",
    glow:     "rgba(239,68,68,0.75)",
    label:    "Junk",
    short:    "Junk",
    order:    5,
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

const ORDERED_STATUSES: ZohoLeadStatus[] = (
  Object.keys(STATUS_COLORS) as ZohoLeadStatus[]
).sort((a, b) => STATUS_COLORS[a].order - STATUS_COLORS[b].order);

const BAR_H   = "clamp(44px, 5.2cqh, 78px)";
const RADIUS  = "clamp(7px, 0.85cqh, 13px)";


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

      {/* Legend — single-line tinted chips: dot · label ·· count */}
      <div
        className="flex flex-row items-stretch"
        style={{
          marginTop: "clamp(10px, 1.5cqh, 20px)",
          gap:       "clamp(6px, 0.65cqmin, 10px)",
        }}
      >
        {orderedNonZero.map((status, idx) => {
          const count = breakdown[status] ?? 0;
          const cfg   = STATUS_COLORS[status];
          return (
            <div
              key={status}
              className="flex min-w-0 flex-1 items-center justify-between"
              style={{
                minHeight:
                  "clamp(56px, 8.5cqh, 112px)",
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
                  className="truncate font-montserrat"
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
