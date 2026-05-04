/**
 * components/ui/SectionDivider.tsx
 *
 * A "dumb" decorative section break, used in every panel of the dashboard.
 *
 * Two variants:
 *   - `rule`  — a plain horizontal gold gradient line (no label).
 *               Replaces the dozens of `<div className="h-px flex-1 bg-gradient-to-r …" />`
 *               pairs scattered across QueendomPanel, OnboardingPanel, etc.
 *   - `title` — the centered label flanked by two gradient rules.
 *               Matches the visual rhythm of "Queendom", "Onboarding",
 *               "Live Conversion Ledger", "Special Dates" headings.
 *
 * CSS tokens consumed (from globals.css Step 1):
 *   .separator-gold-h  — 1px gradient: transparent → rgba(212,175,55,0.25) → transparent
 *   --gold-primary     → text-gold-400
 *   --color-champagne  → text-champagne
 *
 * Usage:
 *   // Plain horizontal rule
 *   <SectionDivider />
 *
 *   // Titled divider — accent defaults to "gold"
 *   <SectionDivider label="Special Dates" />
 *
 *   // Titled with champagne label (subdued sections)
 *   <SectionDivider label="Queendom" accent="champagne" labelClass="queen-name-glow" />
 *
 *   // Custom label font size
 *   <SectionDivider label="Live Conversion Ledger" labelStyle={{ fontSize: "var(--text-heading-lg)" }} />
 */

import { type ReactNode, type CSSProperties } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

export type SectionDividerVariant = "rule" | "title";
export type SectionDividerAccent  = "gold" | "champagne" | "amber";

export interface SectionDividerProps {
  /**
   * When provided, renders the title variant (label flanked by rules).
   * Omit for a plain rule.
   */
  label?:      ReactNode;
  /**
   * Label colour. Ignored when no label is provided.
   * @default "gold"
   */
  accent?:     SectionDividerAccent;
  /**
   * Extra Tailwind classes applied to the label text element only.
   * Use to add `queen-name-glow`, `gold-glow`, custom tracking, etc.
   */
  labelClass?: string;
  labelStyle?: CSSProperties;
  /** Additional classes on the outer wrapper div. */
  className?:  string;
}

// ── Accent lookup ─────────────────────────────────────────────────────────────

const ACCENT_CLASS: Record<SectionDividerAccent, string> = {
  gold:      "text-gold-400",
  champagne: "text-champagne",
  amber:     "text-amber-300",
};

// ── Sub-component: gradient rule arm ─────────────────────────────────────────
// The rule arms use .separator-gold-h from globals.css (Step 1 utility class).
// Direction is reversed on the right arm via scale-x-[-1].

function RuleArm({ flip }: { flip?: boolean }) {
  return (
    <div
      className={[
        "separator-gold-h h-px flex-1 min-w-[1rem]",
        flip ? "scale-x-[-1]" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    />
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export function SectionDivider({
  label,
  accent     = "gold",
  labelClass = "",
  labelStyle,
  className  = "",
}: SectionDividerProps) {
  // Plain horizontal rule — no label
  if (!label) {
    return (
      <div className={["w-full separator-gold-h h-px", className].filter(Boolean).join(" ")} />
    );
  }

  // Titled rule — label flanked by two gradient rule arms
  return (
    <div
      className={[
        "flex w-full items-center gap-3",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <RuleArm />
      <div
        className={[
          "flex-shrink-0 font-cinzel font-bold uppercase leading-none tracking-[0.28em]",
          "text-[var(--text-label-lg)] px-2",
          ACCENT_CLASS[accent],
          labelClass,
        ]
          .filter(Boolean)
          .join(" ")}
        style={labelStyle}
      >
        {label}
      </div>
      <RuleArm flip />
    </div>
  );
}
