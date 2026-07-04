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

function NameRow({ name, isNew }: { name: string; isNew: boolean }) {
  return (
    <div className="flex items-center justify-center gap-3 min-w-0 w-full">
      <Check
        className="flex-shrink-0 w-9 h-9 text-gold-400"
        strokeWidth={2.5}
      />
      <span
        className={`font-montserrat font-semibold text-[clamp(1.425rem,2.325cqw,2.925rem)] truncate renewal-card-text ${
          isNew ? "celebration-shimmer-text" : ""
        }`}
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
      className="elevate-mid flex items-stretch gap-[var(--gap-metric)]"
      style={{ padding: "clamp(12px, 1.5cqw, 40px)" }}
    >
      {/* ── Counter (Left) — lit plinth, foil-gold engraved numerals ─────────── */}
      <div className="flex flex-col items-center justify-center text-center flex-shrink-0 min-w-[clamp(140px,18cqw,200px)] surface-luxe rounded-xl px-[var(--pad-cell)] py-3">
        <p className="label-field text-champagne mb-[0.4cqh]">
          Renewals
          <br />
          <span className="text-[0.62em] opacity-70">(This Month)</span>
        </p>
        <AnimatedCounter
          value={data.totalRenewalsThisMonth}
          className="font-montserrat text-8xl min-[900px]:text-9xl leading-none text-foil-gold tabular-nums"
          delay={delay + 200}
          slideOnChange
        />
      </div>

      {/* ── Renewals List (Center) ───────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col justify-center items-center gap-[var(--gap-list)] min-w-0">
        <p className="title-card text-champagne mb-[0.6cqh] text-center">
          Renewed Members
        </p>
        <div className="flex flex-col items-center gap-[var(--gap-list)] w-full">
          {data.renewals.length === 0 ? (
            <p className="font-montserrat font-semibold text-[clamp(1.425rem,2.325cqw,2.925rem)] text-champagne/50">
              —
            </p>
          ) : (
            data.renewals.map((name, i) => (
              <NameRow key={`${name}-${i}`} name={name} isNew={i === 0} />
            ))
          )}
        </div>
      </div>

      {/* ── Vertical Divider (1px gold, 20% opacity) ────────────────────────── */}
      <div className="vertical-separator flex-shrink-0 self-center" />

      {/* ── Latest members (Right) ───────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col justify-center items-center gap-[var(--gap-list)] min-w-0">
        <p className="title-card text-champagne mb-[0.6cqh] text-center">
          New Members
        </p>
        <div className="flex flex-col items-center gap-[var(--gap-list)] w-full">
          {data.assignments.length === 0 ? (
            <p className="font-montserrat font-semibold text-[clamp(1.425rem,2.325cqw,2.925rem)] text-champagne/50">
              —
            </p>
          ) : (
            data.assignments.map((name, i) => (
              <NameRow key={`${name}-${i}`} name={name} isNew={i === 0} />
            ))
          )}
        </div>
      </div>
    </GoldGlassCard>
  );
}
