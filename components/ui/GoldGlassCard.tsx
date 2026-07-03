/**
 * Canonical UI primitive — do not duplicate this pattern elsewhere.
 *
 * components/ui/GoldGlassCard.tsx
 *
 * Serene Neumorphic reskin (2026-07-03): the old gold glass trio
 * (`glass gold-border-glow` + gradient overlay) is retired. This card now
 * emits the raised neumorphic tile recipe — soft paired shadows, 1px hairline
 * edge, PEBBLE tile radius — while keeping the same component name, DOM shape
 * and prop signature so every call site migrates without structural change.
 *
 * `overlayClass` is kept for signature compatibility but the overlay div is
 * gone: neumorphic surfaces carry no gradient washes.
 */

import type { CSSProperties, ReactNode } from "react";

export function GoldGlassCard({
  children,
  className = "",
  style,
}: {
  children?: ReactNode;
  /** Extra layout classes appended to the raised-tile recipe. */
  className?: string;
  /** @deprecated Gradient overlays are retired in the neumorphic skin. */
  overlayClass?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      className={`neu-raised rounded-neu-tile relative overflow-hidden ${className}`.trim()}
      style={style}
    >
      {children}
    </div>
  );
}
