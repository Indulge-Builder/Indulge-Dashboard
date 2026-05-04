/**
 * Canonical UI primitive — do not duplicate this pattern elsewhere.
 * Use this component for any new glass-surface or metric-card UI.
 */

/**
 * components/ui/StatCard.tsx
 *
 * A "dumb" metric display tile: label on top, value below.
 * The value slot accepts any ReactNode — typically an <AnimatedCounter />,
 * a plain number, or a custom layout — so this component has zero
 * data-fetching or animation logic of its own.
 *
 * CSS tokens consumed (from globals.css Step 1):
 *   --surface-inset    rgba(0,0,0,0.50)   — inset background
 *   --border-gold-mid  rgba(212,175,55,0.25)
 *   --border-gold-dim  rgba(212,175,55,0.08)
 *   --color-emerald    #34d399
 *   --color-red        #f87171
 *   --color-amber      #fcd34d
 *   --color-sky        #7dd3fc
 *   --color-champagne  #f5e6c8
 *   --text-label-xl    clamp(1.35rem, 2.7vw, 3.9rem)
 *
 * Accent variants map directly to status semantic colors from the design system.
 * `gold` uses the queen-name-glow utility for premium crown/hero labels.
 *
 * Usage:
 *   <StatCard label="Resolved (Today)" accent="emerald">
 *     <AnimatedCounter value={solvedToday} ... />
 *   </StatCard>
 *
 *   <StatCard label={<>Received<br/>(This Month)</>} accent="champagne">
 *     <AnimatedCounter value={totalReceived} ... />
 *   </StatCard>
 */

import { type ReactNode, type CSSProperties } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

/**
 * Semantic accent colour for the label text (and optional value tint).
 * Each value maps to a CSS variable from the design system.
 */
export type StatCardAccent =
  | "champagne"   // --color-champagne  → neutral default
  | "emerald"     // --color-emerald    → resolved / success
  | "red"         // --color-red        → pending / error
  | "amber"       // --color-amber      → warning / finance
  | "sky"         // --color-sky        → leads / info
  | "gold";       // --gold-primary     → crown / hero metric

export interface StatCardProps {
  /** Label above the value. Accepts ReactNode for multi-line JSX like `<>Received<br/>(This Month)</>`. */
  label:      ReactNode;
  /** The metric value slot. Pass <AnimatedCounter />, a number, or any ReactNode. */
  children:   ReactNode;
  /**
   * Semantic accent colour applied to the label.
   * @default "champagne"
   */
  accent?:    StatCardAccent;
  className?: string;
  style?:     CSSProperties;
}

// ── Accent lookup ─────────────────────────────────────────────────────────────
// Each key maps to a Tailwind class that consumes the CSS variable token.

const LABEL_CLASS: Record<StatCardAccent, string> = {
  champagne: "text-champagne",
  emerald:   "text-status-emerald",
  red:       "text-status-red",
  amber:     "text-status-amber",
  sky:       "text-status-sky",
  gold:      "text-gold-300 queen-name-glow",
};

// ── Component ─────────────────────────────────────────────────────────────────

export function StatCard({
  label,
  children,
  accent    = "champagne",
  className = "",
  style,
}: StatCardProps) {
  return (
    <div
      className={[
        // Surface: inset dark background, subtle gold border, tight card radius
        "flex flex-1 flex-col items-center justify-center text-center min-w-0",
        "bg-surface-inset rounded-card border border-gold-500/20",
        "shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={{
        padding: "clamp(10px, 1.2vh, 20px) clamp(6px, 0.8vw, 14px)",
        ...style,
      }}
    >
      {/* Label */}
      <p
        className={[
          "font-inter font-semibold uppercase leading-snug tracking-[0.25em]",
          "text-[var(--text-label-xl)] mb-[0.2vh]",
          LABEL_CLASS[accent],
        ].join(" ")}
      >
        {label}
      </p>

      {/* Value slot — fully controlled by caller */}
      {children}
    </div>
  );
}
