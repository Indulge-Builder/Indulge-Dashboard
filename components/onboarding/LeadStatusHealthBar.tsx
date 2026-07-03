"use client";

import React, { memo, useEffect, useMemo, useState } from "react";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import type {
  AgentLeadStatusBreakdown,
  ZohoLeadStatus,
} from "@/lib/onboardingTypes";

/**
 * Neumorphic status palette — the pastel support family from
 * app/indulge-neumorphic-tokens.css. `flat` fills the bar segments and chip
 * washes; `deep` carries text/numerals. Order is the pipeline order.
 */
export const STATUS_COLORS: Record<
  ZohoLeadStatus,
  {
    flat: string;
    deep: string;
    label: string;
    short: string;
    order: number;
  }
> = {
  /* Qualified — sage (success family) */
  Qualified: {
    flat:  "var(--neu-sage)",
    deep:  "var(--neu-sage-deep)",
    label: "Qualified",
    short: "QUAL",
    order: 0,
  },
  /* In Discussion — powder */
  "In Discussion": {
    flat:  "var(--neu-powder)",
    deep:  "var(--neu-powder-deep)",
    label: "In Discussion",
    short: "DISC",
    order: 1,
  },
  /* Nurturing — lilac */
  Nurturing: {
    flat:  "var(--neu-lilac)",
    deep:  "var(--neu-lilac-deep)",
    label: "Nurturing",
    short: "NURT",
    order: 2,
  },
  /* Touched — butter (Zoho stage; legacy "Attempted" maps here in API) */
  Touched: {
    flat:  "var(--neu-butter)",
    deep:  "var(--neu-butter-deep)",
    label: "Touched",
    short: "TOUCH",
    order: 3,
  },
  /* New — peach */
  New: {
    flat:  "var(--neu-peach)",
    deep:  "var(--neu-peach-deep)",
    label: "New",
    short: "NEW",
    order: 4,
  },
  /* Junk — danger */
  Junk: {
    flat:  "var(--neu-danger)",
    deep:  "var(--neu-danger-deep)",
    label: "Junk",
    short: "JUNK",
    order: 5,
  },
};

/* Keep backward-compatible key used by sibling components */
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

const BAR_H   = "clamp(24px, 3cqh, 44px)";
const RADIUS  = "999px";

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

  const total = breakdown?.total ?? 0;

  /* ── Inset track — the ONLY well in the card (neumorphic rule #4) ────────── */
  const trackStyle: React.CSSProperties = {
    height: BAR_H,
    borderRadius: RADIUS,
    background: "var(--neu-well)",
    boxShadow: "var(--neu-shadow-inset)",
  };

  /* ── Empty state ─────────────────────────────────────────────────────────── */
  if (!breakdown || total === 0) {
    return (
      <div className={cn("w-full select-none", className)}>
        <PipelineLabel />
        <div className="relative w-full overflow-hidden" style={trackStyle}>
          <div
            className="absolute inset-0 pointer-events-none"
            aria-hidden
            style={{
              background:
                "linear-gradient(115deg, transparent 20%, rgb(var(--neu-light) / 0.25) 50%, transparent 80%)",
              backgroundSize: "200% auto",
              animation: reduced
                ? undefined
                : "foil-shimmer 2.2s cubic-bezier(0.4,0,0.2,1) infinite",
              opacity: 0.5,
            }}
          />
        </div>
        <StatusChipRow breakdown={breakdown} mounted={mounted} reduced={reduced} />
      </div>
    );
  }

  /* ── Populated bar ───────────────────────────────────────────────────────── */
  let cumulativePct = 0;

  return (
    <div className={cn("w-full select-none", className)}>
      {/* Pipeline header */}
      <PipelineLabel />

      {/* Segmented inset track */}
      <div
        className="relative w-full overflow-hidden"
        style={trackStyle}
        aria-label={`Pipeline: ${total} leads`}
        role="img"
      >
        {/* Segments — flat pastel fills, no gloss */}
        {orderedNonZero.map((status, idx) => {
          const count = breakdown[status] ?? 0;
          const pct   = (count / Math.max(total, 1)) * 100;
          const left  = cumulativePct;
          cumulativePct += pct;

          return (
            <div
              key={status}
              style={{
                position:   "absolute",
                left:       `${left}%`,
                width:      `${mounted ? pct : 0}%`,
                height:     "100%",
                background: STATUS_COLORS[status].flat,
                transition: reduced
                  ? "none"
                  : `width 0.9s cubic-bezier(0.16, 1, 0.32, 1) ${idx * 80}ms`,
                willChange: reduced ? undefined : "width",
                zIndex:     2,
              }}
            />
          );
        })}

        {/* Hairline dividers between segments */}
        <SegmentGaps segments={orderedNonZero} breakdown={breakdown} />
      </div>

      {/* Status-count chip row — all 6 statuses, pastel washes, deep numerals */}
      <StatusChipRow breakdown={breakdown} mounted={mounted} reduced={reduced} />
    </div>
  );
}

/* ── Status-count chip row (QUAL · DISC · NURT · TOUCH · NEW · JUNK) ────────── */
function StatusChipRow({
  breakdown,
  mounted,
  reduced,
}: {
  breakdown: AgentLeadStatusBreakdown;
  mounted: boolean;
  reduced: boolean;
}) {
  return (
    <div
      className="flex flex-row items-stretch"
      style={{
        marginTop: "clamp(8px, 1.2cqh, 16px)",
        gap:       "clamp(4px, 0.5cqmin, 9px)",
      }}
    >
      {ORDERED_STATUSES.map((status, idx) => {
        const count = breakdown?.[status] ?? 0;
        const cfg   = STATUS_COLORS[status];
        return (
          <div
            key={status}
            className="flex min-w-0 flex-1 flex-col items-center justify-center"
            style={{
              minHeight:
                "clamp(44px, 6.5cqh, 96px)",
              padding:
                "clamp(6px, 0.9cqh, 12px) clamp(4px, 0.5cqmin, 10px)",
              borderRadius: "clamp(6px, 0.75cqmin, 11px)",
              background:   `color-mix(in srgb, ${cfg.flat} 24%, var(--neu-surface))`,
              border:       "1px solid var(--neu-edge)",
              boxShadow:    "var(--neu-shadow-raised-sm)",
              gap:          "clamp(3px, 0.4cqh, 8px)",
              opacity:      mounted ? 1 : 0,
              transform:    mounted ? "none" : "translateY(6px)",
              transition: reduced
                ? "none"
                : `opacity 0.45s cubic-bezier(0.23,1,0.32,1) ${idx * 50}ms, transform 0.45s cubic-bezier(0.23,1,0.32,1) ${idx * 50}ms`,
            }}
          >
            <span
              className="truncate font-montserrat"
              style={{
                fontSize:      "clamp(15px, min(1.9cqmin, 2cqw), 28px)",
                fontWeight:    700,
                color:         cfg.deep,
                letterSpacing: "0.14em",
                lineHeight:    1,
                opacity:       0.85,
              }}
            >
              {cfg.short}
            </span>
            <span
              className="font-montserrat tabular-nums"
              style={{
                fontSize:   "clamp(24px, min(3.4cqmin, 3.6cqw), 50px)",
                fontWeight: 800,
                color:      cfg.deep,
                lineHeight: 1,
                flexShrink: 0,
              }}
            >
              {count}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ── Pipeline header label ─────────────────────────────────────────────────── */
function PipelineLabel() {
  return (
    <div
      className="flex items-center"
      style={{ marginTop: "clamp(6px, 0.9cqh, 13px)", marginBottom: "clamp(10px, 1.4cqh, 20px)", gap: "clamp(8px, 1cqmin, 14px)" }}
    >
      <div aria-hidden className="neu-rule-l" style={{ flex: 1, height: "1px" }} />
      {/* Band-title tier — matches QueendomPanel BAND_TITLE_CLASS
          ("Time Since Last Resolved"): Cinzel semibold, 0.24em tracking,
          width-fit font capped at 4rem. */}
      <span
        className="neu-letterpress"
        style={{
          fontSize:      "min(calc((100cqw - 5rem) / 20.5), 4rem)",
          fontFamily:    "var(--font-cinzel), serif",
          fontWeight:    600,
          color:         "var(--neu-text-secondary)",
          letterSpacing: "0.24em",
          lineHeight:    1.1,
          flexShrink:    0,
          textTransform: "uppercase" as const,
          whiteSpace:    "nowrap" as const,
        }}
      >
        Pipeline
      </span>
      <div aria-hidden className="neu-rule-r" style={{ flex: 1, height: "1px" }} />
    </div>
  );
}

/* ── Hairline gap dividers between segments ─────────────────────────────── */
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
              width:     "1px",
              background: "rgb(var(--neu-dark) / 0.35)",
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
