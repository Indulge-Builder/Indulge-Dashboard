/**
 * Canonical UI primitive — do not duplicate this pattern elsewhere.
 *
 * components/ui/GoldGlassCard.tsx
 *
 * The gold glass card trio (dry-audit A2): emits the exact class string
 * `glass gold-border-glow rounded-2xl relative overflow-hidden` plus the
 * absolute gold gradient overlay div that was previously hand-rolled in
 * QueendomPanel, RenewalsPanel, JokerMetricsStrip, and both skeletons.
 * Same DOM, same classes ⇒ same pixels.
 *
 * The overlay gradient opacity varies by site (0.03 / 0.04 / 0.06) — pass the
 * exact existing string via `overlayClass`.
 */

import type { CSSProperties, ReactNode } from "react";

export function GoldGlassCard({
  children,
  className = "",
  overlayClass = "bg-gradient-to-br from-gold-500/[0.04] to-transparent",
  style,
}: {
  children?: ReactNode;
  /** Extra layout classes appended to the standard glass trio. */
  className?: string;
  /** Gradient classes for the overlay div — pass the site's exact string. */
  overlayClass?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      className={`glass gold-border-glow rounded-2xl relative overflow-hidden ${className}`.trim()}
      style={style}
    >
      <div
        className={`absolute inset-0 ${overlayClass} pointer-events-none rounded-2xl`}
      />
      {children}
    </div>
  );
}
