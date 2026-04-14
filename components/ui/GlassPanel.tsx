/**
 * components/ui/GlassPanel.tsx
 *
 * Core glassmorphism container. Every panel, card, and widget surface in the
 * dashboard should be built on this primitive instead of writing raw Tailwind
 * glass/border/radius combinations inline.
 *
 * CSS tokens consumed (from globals.css Step 1):
 *   --surface-glass    rgba(10,10,10,0.85)  — default; translucent
 *   --surface-card     rgba(10,10,10,0.92)  — more opaque, for content cards
 *   --surface-elevated rgba(15,15,20,0.85)  — slightly lifted tone
 *   --radius-card      1rem (16px)           — tight cards
 *   --radius-panel     1.5rem (24px)         — section panels
 *   --shadow-gold-sm/md/lg                  — ambient gold glow levels
 *
 * CSS utility classes consumed:
 *   .glass             — bg + 1px gold border at 18%
 *   .gold-border-glow  — inset 1px gold ring at 8%
 *   .card-gradient-overlay — top-left gold highlight gradient (absolute)
 *
 * Usage:
 *   <GlassPanel>…</GlassPanel>
 *   <GlassPanel variant="card" radius="panel" glow overlay>…</GlassPanel>
 *   <GlassPanel variant="elevated" shadow="lg" className="…">…</GlassPanel>
 */

import { forwardRef, type ReactNode, type CSSProperties } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

/** Visual weight of the surface background. */
export type GlassPanelVariant = "glass" | "card" | "elevated";

/** Border-radius preset. Maps to --radius-card (1rem) or --radius-panel (1.5rem). */
export type GlassPanelRadius = "card" | "panel" | "none";

/** Ambient gold glow level applied as box-shadow. */
export type GlassPanelShadow = "none" | "sm" | "md" | "lg";

export interface GlassPanelProps {
  children?:  ReactNode;
  /**
   * Surface opacity tier.
   * - `glass`    → bg-surface-glass   (0.85) — translucent; for outer panels
   * - `card`     → bg-surface-card    (0.92) — standard content card
   * - `elevated` → bg-surface-elevated (0.85, cooler) — floating / modal-like
   * @default "glass"
   */
  variant?:   GlassPanelVariant;
  /**
   * Border-radius preset.
   * - `card`  → var(--radius-card)  = 1rem
   * - `panel` → var(--radius-panel) = 1.5rem
   * - `none`  → no radius
   * @default "card"
   */
  radius?:    GlassPanelRadius;
  /**
   * When true, adds .gold-border-glow inset ring (8% gold shadow).
   * @default false
   */
  glow?:      boolean;
  /**
   * When true, renders an absolutely-positioned .card-gradient-overlay child
   * (top-left gold highlight, pointer-events: none).
   * @default false
   */
  overlay?:   boolean;
  /**
   * Ambient gold glow shadow level.
   * @default "none"
   */
  shadow?:    GlassPanelShadow;
  className?: string;
  style?:     CSSProperties;
}

// ── Lookup maps ───────────────────────────────────────────────────────────────

const VARIANT_CLASS: Record<GlassPanelVariant, string> = {
  glass:    "bg-surface-glass  border border-gold-500/[0.18]",
  card:     "bg-surface-card   border border-gold-500/20",
  elevated: "bg-surface-elevated border border-gold-500/20",
};

const RADIUS_STYLE: Record<GlassPanelRadius, CSSProperties> = {
  card:  { borderRadius: "var(--radius-card)" },
  panel: { borderRadius: "var(--radius-panel)" },
  none:  {},
};

const SHADOW_CLASS: Record<GlassPanelShadow, string> = {
  none: "",
  sm:   "shadow-gold-sm",
  md:   "shadow-gold-md",
  lg:   "shadow-gold-lg",
};

// ── Component ─────────────────────────────────────────────────────────────────

export const GlassPanel = forwardRef<HTMLDivElement, GlassPanelProps>(
  function GlassPanel(
    {
      children,
      variant  = "glass",
      radius   = "card",
      glow     = false,
      overlay  = false,
      shadow   = "none",
      className = "",
      style,
    },
    ref,
  ) {
    const classes = [
      "relative overflow-hidden",
      VARIANT_CLASS[variant],
      glow ? "gold-border-glow" : "",
      SHADOW_CLASS[shadow],
      className,
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <div
        ref={ref}
        className={classes}
        style={{ ...RADIUS_STYLE[radius], ...style }}
      >
        {/* Optional top-left gold highlight gradient */}
        {overlay && (
          <div className="card-gradient-overlay absolute inset-0 z-0" aria-hidden />
        )}
        {/* Render children above overlay */}
        <div className={overlay ? "relative z-[1]" : undefined}>
          {children}
        </div>
      </div>
    );
  },
);
