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
 *   --text-label-xl    clamp(1.35rem, 2.7cqw, 3.9rem)
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
  /**
   * Escape hatch (dry-audit A1): fully REPLACES the default surface classes
   * AND disables the default padding, so existing tiles can migrate with
   * their class strings verbatim — pixel-identical output. New tiles should
   * use the default surface instead.
   */
  surfaceClass?: string;
  /**
   * Escape hatch: fully REPLACES the default label classes (incl. accent).
   * Pass the site's exact existing label class string for verbatim migration.
   */
  labelClass?: string;
}

// ── Accent lookup ─────────────────────────────────────────────────────────────
// Each key maps to a Tailwind class that consumes the CSS variable token.

const LABEL_CLASS: Record<StatCardAccent, string> = {
  /* Neumorphic semantic mapping — the old status hues route to the pastel
     support family; glows are retired (letterpress instead). */
  champagne: "text-neu-t2",
  emerald:   "text-neu-sage-deep",
  red:       "text-neu-danger-deep",
  amber:     "text-neu-butter-deep",
  sky:       "text-neu-powder-deep",
  gold:      "text-neu-accent-deep neu-letterpress",
};

// ── Component ─────────────────────────────────────────────────────────────────

export function StatCard({
  label,
  children,
  accent    = "champagne",
  className = "",
  style,
  surfaceClass,
  labelClass,
}: StatCardProps) {
  return (
    <div
      className={[
        surfaceClass ??
          [
            // Surface: raised neumorphic tile, hairline edge
            "flex flex-1 flex-col items-center justify-center text-center min-w-0",
            "neu-raised-sm rounded-neu-tile",
          ].join(" "),
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={
        surfaceClass != null
          ? style
          : {
              padding: "clamp(10px, 1.2cqh, 20px) clamp(6px, 0.8cqw, 14px)",
              ...style,
            }
      }
    >
      {/* Label */}
      <p
        className={
          labelClass ??
          [
            "font-montserrat font-semibold uppercase leading-snug tracking-[0.25em]",
            "text-[var(--text-label-xl)] mb-[0.2cqh]",
            LABEL_CLASS[accent],
          ].join(" ")
        }
      >
        {label}
      </p>

      {/* Value slot — fully controlled by caller */}
      {children}
    </div>
  );
}
