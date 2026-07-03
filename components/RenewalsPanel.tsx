"use client";

import { Check } from "lucide-react";
import AnimatedCounter from "./AnimatedCounter";
import { GoldGlassCard } from "@/components/ui/GoldGlassCard";
import type { RenewalsPanelData } from "@/types";

interface RenewalsPanelProps {
  /** Data from parent (Dashboard); no internal fetch or Supabase. */
  data: RenewalsPanelData;
  delay?: number;
}

function NameRow({
  name,
  isNew,
  checkClass,
}: {
  name: string;
  isNew: boolean;
  checkClass: string;
}) {
  return (
    // First (newest) item rises in — keyed remount replays the CSS animation.
    // The old gold shimmer is retired in favour of this rise (handoff README).
    <div
      className={`flex items-center justify-center gap-3 min-w-0 w-full ${
        isNew ? "neu-anim-rise" : ""
      }`}
    >
      <Check className={`flex-shrink-0 w-9 h-9 ${checkClass}`} strokeWidth={2.5} />
      <span
        className="font-montserrat font-bold uppercase tracking-[0.05em] text-[clamp(1.425rem,2.325cqw,2.925rem)] truncate text-neu-t1"
        style={{ maxWidth: "100%" }}
      >
        {name}
      </span>
    </div>
  );
}

export default function RenewalsPanel({ data, delay = 0 }: RenewalsPanelProps) {
  return (
    <GoldGlassCard
      className="flex items-stretch gap-[var(--gap-metric)]"
      style={{ padding: "clamp(12px, 1.5cqw, 40px)" }}
    >
      {/* ── Counter (Left) — raised honey-gold plinth ────────────────────────── */}
      <div className="flex flex-col items-center justify-center text-center flex-shrink-0 min-w-[clamp(140px,18cqw,200px)] neu-plinth-accent rounded-neu-chip px-[var(--pad-cell)] py-3">
        <p className="label-field text-neu-accent-deep mb-[0.4cqh]">
          Renewals
          <br />
          <span className="text-[0.62em] opacity-70">(This Month)</span>
        </p>
        <AnimatedCounter
          value={data.totalRenewalsThisMonth}
          className="font-montserrat font-extrabold text-8xl min-[900px]:text-9xl leading-none text-neu-accent-deep tabular-nums"
          delay={delay + 200}
          slideOnChange
        />
      </div>

      {/* ── Renewals List (Center) ───────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col justify-center items-center gap-[var(--gap-list)] min-w-0">
        <p className="title-card text-neu-t2 mb-[0.6cqh] text-center">
          Renewed Members
        </p>
        <div className="flex flex-col items-center gap-[var(--gap-list)] w-full">
          {data.renewals.length === 0 ? (
            <p className="font-montserrat font-semibold text-[clamp(1.425rem,2.325cqw,2.925rem)] text-neu-t3">
              —
            </p>
          ) : (
            data.renewals.map((name, i) => (
              <NameRow
                key={`${name}-${i}`}
                name={name}
                isNew={i === 0}
                checkClass="text-neu-sage-deep"
              />
            ))
          )}
        </div>
      </div>

      {/* ── Vertical hairline divider ────────────────────────────────────────── */}
      <div
        className="flex-shrink-0 self-center w-px"
        style={{ height: "80%", background: "var(--neu-hairline)" }}
        aria-hidden
      />

      {/* ── Latest members (Right) ───────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col justify-center items-center gap-[var(--gap-list)] min-w-0">
        <p className="title-card text-neu-t2 mb-[0.6cqh] text-center">
          New Members
        </p>
        <div className="flex flex-col items-center gap-[var(--gap-list)] w-full">
          {data.assignments.length === 0 ? (
            <p className="font-montserrat font-semibold text-[clamp(1.425rem,2.325cqw,2.925rem)] text-neu-t3">
              —
            </p>
          ) : (
            data.assignments.map((name, i) => (
              <NameRow
                key={`${name}-${i}`}
                name={name}
                isNew={i === 0}
                checkClass="text-neu-accent-deep"
              />
            ))
          )}
        </div>
      </div>
    </GoldGlassCard>
  );
}
