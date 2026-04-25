"use client";

/**
 * components/onboarding/AgentVerticalBarChart.tsx
 *
 * OLED-native vertical stacked bar chart showing per-agent pipeline breakdown.
 * Replaces the horizontal PipelineBar with a richer, spatially larger visual
 * that occupies the primary space below the agent portrait cards.
 *
 * Visual structure:
 *
 *   Pipeline                            47 leads   ← header row
 *
 *   │        │        │        │
 *   │▓▓ Lost │        │▓ Lost  │
 *   │▓▓▓ Won │▓ Won   │▓▓▓ Won │
 *   │▒▒ Disc │▒▒ Disc │        │        ← stacked bars, bottom-up
 *   │████ At │████ At │████ At │
 *   │▓▓ New  │▓ New   │▓▓▓ New │
 *   ─────────────────────────────
 *    AMIT     SAMSON   MEGHANA           ← X-axis labels
 *
 *   ● New  ● Attempted  ● In Disc  ● Won  ● Lost   ← legend
 *
 * Colour tokens (all from CSS variables — no hardcoded hex):
 *   New           → --color-sky
 *   Attempted     → --color-champagne
 *   In Discussion → --color-amber
 *   Won           → --color-emerald
 *   Lost          → --color-red
 *
 * Data fallback: when agent.pipeline is absent, derives Attempted from
 * totalAttempted and Won from totalConverted. Other stages default to 0.
 * This keeps the chart useful before the API route is updated.
 */

import type { CSSProperties } from "react";
import {
  PIPELINE_STATUSES,
  EMPTY_PIPELINE,
  type PipelineStatus,
  type PipelineStatusCounts,
  type OnboardingAgentRow,
} from "@/lib/onboardingTypes";

// ── Segment colour + label config ─────────────────────────────────────────────

interface SegmentCfg {
  /** Full CSS color — references a CSS variable */
  color:    string;
  /** Faint background tint for grid lines */
  glow:     string;
  /** Short legend label */
  label:    string;
}

const CFG: Record<PipelineStatus, SegmentCfg> = {
  "New":           { color: "var(--color-sky)",       glow: "rgba(125,211,252,0.08)",  label: "New"     },
  "Attempted":     { color: "var(--color-champagne)", glow: "rgba(245,230,200,0.08)",  label: "Attempt" },
  "In Discussion": { color: "var(--color-amber)",     glow: "rgba(252,211,77,0.08)",   label: "In Disc" },
  "Won":           { color: "var(--color-emerald)",   glow: "rgba(52,211,153,0.08)",   label: "Won"     },
  "Lost":          { color: "var(--color-red)",       glow: "rgba(248,113,113,0.08)",  label: "Lost"    },
};

// Luxurious easing shared with the old PipelineBar for visual consistency
const SEG_TRANSITION = "flex 0.85s cubic-bezier(0.25, 0.46, 0.45, 0.94)";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Derives pipeline counts from available agent fields when agent.pipeline is absent. */
function resolveAgentPipeline(agent: OnboardingAgentRow): PipelineStatusCounts {
  if (agent.pipeline) return agent.pipeline;
  return {
    ...EMPTY_PIPELINE,
    Attempted: agent.totalAttempted,
    Won:       agent.totalConverted,
  };
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface AgentVerticalBarChartProps {
  /** Exactly 3 agents for the department, in display order. */
  agents: OnboardingAgentRow[];
  /**
   * Optional accent override for the chart border/header.
   * Defaults to a neutral white/40 tone — override with dept colour.
   */
  accentColor?: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function AgentVerticalBarChart({
  agents,
  accentColor = "rgba(255,255,255,0.40)",
}: AgentVerticalBarChartProps) {
  const pipelines  = agents.map(resolveAgentPipeline);
  const totals     = pipelines.map((p) =>
    PIPELINE_STATUSES.reduce((s, st) => s + p[st], 0),
  );
  const maxTotal   = Math.max(1, ...totals);
  const grandTotal = totals.reduce((s, t) => s + t, 0);

  // Only render legend entries that have at least one non-zero count
  const activeStatuses = PIPELINE_STATUSES.filter((st) =>
    agents.some((_, i) => (pipelines[i]?.[st] ?? 0) > 0),
  );

  // ── Styles ────────────────────────────────────────────────────────────────

  const headerFont: CSSProperties = {
    fontSize:      "clamp(0.5rem,0.95vmin,0.82rem)",
    letterSpacing: "0.2em",
  };

  const totalFont: CSSProperties = {
    fontSize: "clamp(0.5rem,0.9vmin,0.78rem)",
  };

  const nameFont: CSSProperties = {
    fontSize:      "clamp(0.75rem,1.1vmin,1.0rem)",
    letterSpacing: "0.14em",
  };

  const legendFont: CSSProperties = {
    fontSize: "clamp(0.45rem,0.82vmin,0.72rem)",
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div
      className="flex w-full flex-col"
      style={{ gap: "clamp(4px,0.6vh,8px)" }}
    >
      {/* ── Header row ── */}
      <div className="flex flex-shrink-0 items-baseline justify-between">
        <p
          className="font-cinzel font-semibold uppercase leading-none tracking-[0.2em]"
          style={{ ...headerFont, color: accentColor, opacity: 0.65 }}
        >
          Pipeline
        </p>
        {grandTotal > 0 && (
          <p
            className="font-inter tabular-nums leading-none text-white/25"
            style={totalFont}
          >
            {grandTotal} leads
          </p>
        )}
      </div>

      {/* ── Bars area ── */}
      {/*
        Height is explicit (clamp) so that child percentage heights resolve
        correctly in all browsers. `items-end` anchors bars to the baseline.
      */}
      <div
        className="relative flex w-full items-end flex-shrink-0"
        style={{
          height: "clamp(72px,12vh,140px)",
          gap:    "clamp(8px,1.6vmin,20px)",
        }}
      >
        {agents.map((agent, i) => {
          const pipeline = pipelines[i]!;
          const total    = totals[i]!;
          const barPct   = (total / maxTotal) * 100;
          const firstName = agent.name.split(" ")[0] ?? agent.name;

          return (
            <div
              key={agent.id}
              className="flex h-full flex-1 flex-col items-center justify-end"
              style={{ gap: "clamp(4px,0.5vmin,6px)" }}
            >
              {/* ── Vertical bar ── */}
              <div
                className="relative w-full overflow-hidden rounded-t-md"
                style={{
                  height:          `${barPct}%`,
                  minHeight:       total > 0 ? 4 : 0,
                  transition:      "height 0.85s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
                  // Faint bar-track shadow so empty space is visible
                  boxShadow:       "inset 0 0 0 1px rgba(255,255,255,0.06)",
                  borderRadius:    "3px 3px 0 0",
                }}
              >
                {total === 0 ? (
                  /* Ghost bar for zero-count agents */
                  <div
                    className="h-full w-full"
                    style={{ background: "rgba(255,255,255,0.06)" }}
                  />
                ) : (
                  /*
                    flex-col-reverse: first item in PIPELINE_STATUSES (New) renders
                    at the bottom of the bar; Lost renders at the top.
                    flex: count proportionally sizes each segment inside the bar.
                  */
                  <div
                    className="flex h-full w-full flex-col-reverse"
                    style={{ gap: 0 }}
                  >
                    {PIPELINE_STATUSES.map((status) => {
                      const count = pipeline[status];
                      if (count <= 0) return null;
                      return (
                        <div
                          key={status}
                          style={{
                            flex:       count,
                            background: CFG[status].color,
                            transition: SEG_TRANSITION,
                            minHeight:  2,
                            // Subtle inner top-border for segment separation
                            boxShadow:  "inset 0 1px 0 rgba(0,0,0,0.20)",
                          }}
                        />
                      );
                    })}
                  </div>
                )}

                {/* Subtle sheen overlay on the whole bar */}
                <div
                  className="pointer-events-none absolute inset-0"
                  style={{
                    background:
                      "linear-gradient(to right, rgba(255,255,255,0.07) 0%, transparent 50%, rgba(0,0,0,0.08) 100%)",
                  }}
                />
              </div>

              {/* ── X-axis label ── */}
              <p
                className="flex-shrink-0 truncate text-center font-cinzel font-bold uppercase leading-none"
                style={{
                  ...nameFont,
                  color: accentColor,
                  opacity: 0.6,
                }}
              >
                {firstName}
              </p>
            </div>
          );
        })}
      </div>

      {/* ── X-axis baseline rule ── */}
      <div
        className="flex-shrink-0 w-full"
        style={{
          height:     1,
          background: `linear-gradient(to right, transparent, ${accentColor}44, transparent)`,
          marginTop:  "clamp(-2px,-0.3vmin,0px)",
        }}
      />

      {/* ── Legend ── */}
      {activeStatuses.length > 0 && (
        <div
          className="flex flex-shrink-0 flex-wrap items-center"
          style={{
            gap: "clamp(2px,0.3vh,4px) clamp(5px,1vmin,12px)",
          }}
        >
          {activeStatuses.map((status) => {
            const cfg = CFG[status];
            return (
              <div
                key={status}
                className="flex items-center"
                style={{ gap: "clamp(2px,0.3vmin,4px)" }}
              >
                {/* Colour swatch */}
                <div
                  className="flex-shrink-0 rounded-full"
                  style={{
                    width:      "clamp(4px,0.6vmin,7px)",
                    height:     "clamp(4px,0.6vmin,7px)",
                    background: cfg.color,
                    boxShadow:  `0 0 4px ${cfg.glow}`,
                  }}
                />
                {/* Label */}
                <span
                  className="font-inter leading-none tabular-nums"
                  style={{ ...legendFont, color: cfg.color, opacity: 0.85 }}
                >
                  {cfg.label}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
