"use client";

/**
 * components/RenewalsPanel.tsx
 *
 * Renewals This Month counter + the latest renewed members and new-member
 * assignments for one queendom. Compacted for the three-column concierge
 * screen (handoff 1c §B1) — same data, tighter plinth and lists.
 */

import { Check } from "lucide-react";
import AnimatedCounter from "./AnimatedCounter";
import { GoldGlassCard } from "@/components/ui/GoldGlassCard";
import { fh, fw } from "@/lib/tvScale";
import type { RenewalsPanelData } from "@/types";

interface RenewalsPanelProps {
  /** Data from parent (Dashboard); no internal fetch or Supabase. */
  data: RenewalsPanelData;
  delay?: number;
}

// ─── Stage-pinned sizes (handoff §B1) ─────────────────────────────────────────
const CARD_STYLE = { padding: `${fh(34)} ${fw(40)}`, gap: fw(30) };
const PLINTH_STYLE = { minWidth: fw(200), padding: `${fh(10.8)} ${fw(28)}` };
const PLINTH_LABEL_STYLE = { fontSize: fw(40), marginBottom: fh(14) };
const PLINTH_VALUE_STYLE = { fontSize: fw(104) };
const LIST_TITLE_STYLE = { fontSize: fw(40), letterSpacing: "0.3em", marginBottom: fh(6) };
const NAME_STYLE = { fontSize: fw(38) };
const CHECK_STYLE = { width: fw(30), height: fw(30) };
const LIST_GAP = fh(18);

function NameRow({ name, isNew }: { name: string; isNew: boolean }) {
  return (
    <div className="flex w-full min-w-0 items-center justify-center" style={{ gap: fw(10.8) }}>
      <Check className="flex-shrink-0 text-gold-400" style={CHECK_STYLE} strokeWidth={2.5} />
      <span
        className={`font-montserrat truncate renewal-card-text ${isNew ? "celebration-shimmer-text" : ""}`}
        style={{ ...NAME_STYLE, maxWidth: "100%" }}
      >
        {name}
      </span>
    </div>
  );
}

function NameList({ title, names }: { title: string; names: string[] }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center justify-center" style={{ gap: LIST_GAP }}>
      <p
        className="font-cinzel font-semibold uppercase leading-[1.05] text-champagne text-center whitespace-nowrap"
        style={LIST_TITLE_STYLE}
      >
        {title}
      </p>
      <div className="flex w-full flex-col items-center" style={{ gap: LIST_GAP }}>
        {names.length === 0 ? (
          <p className="font-montserrat font-semibold text-champagne/50" style={NAME_STYLE}>
            —
          </p>
        ) : (
          names.map((name, i) => <NameRow key={`${name}-${i}`} name={name} isNew={i === 0} />)
        )}
      </div>
    </div>
  );
}

export default function RenewalsPanel({ data, delay = 0 }: RenewalsPanelProps) {
  return (
    <GoldGlassCard className="elevate-mid flex items-stretch" style={CARD_STYLE}>
      {/* Counter plinth — lit surface, foil-gold engraved numerals */}
      <div
        className="surface-luxe flex flex-shrink-0 flex-col items-center justify-center rounded-xl text-center"
        style={PLINTH_STYLE}
      >
        <p
          className="font-cinzel font-semibold uppercase leading-[1.15] tracking-[0.22em] text-champagne"
          style={PLINTH_LABEL_STYLE}
        >
          Renewals
          <br />
          <span className="text-[0.62em] opacity-70">(This Month)</span>
        </p>
        <AnimatedCounter
          value={data.totalRenewalsThisMonth}
          className="font-montserrat leading-none text-foil-gold tabular-nums"
          style={PLINTH_VALUE_STYLE}
          delay={delay + 200}
          slideOnChange
        />
      </div>

      <NameList title="Renewed Members" names={data.renewals} />

      <div className="vertical-separator flex-shrink-0 self-center" />

      <NameList title="New Members" names={data.assignments} />
    </GoldGlassCard>
  );
}
