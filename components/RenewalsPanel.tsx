"use client";

import { Check } from "lucide-react";
import AnimatedCounter from "./AnimatedCounter";
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
        className={`font-inter font-semibold text-[clamp(1.425rem,2.325vw,2.925rem)] truncate renewal-card-text ${
          isNew ? "celebration-shimmer-text" : ""
        }`}
        style={{ maxWidth: "100%" }}
      >
        {name}
      </span>
    </div>
  );
}

export default function RenewalsPanel({
  data,
  delay = 0,
}: RenewalsPanelProps) {
  return (
    <div
      className="flex items-stretch gap-4 glass gold-border-glow rounded-2xl relative overflow-hidden"
      style={{ padding: "clamp(12px, 1.5vw, 24px)" }}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-gold-500/[0.04] to-transparent pointer-events-none rounded-2xl" />
      {/* ── Counter (Left) — same as Spoiled card (joker-box, text-gold-300) ──── */}
      <div className="flex flex-col items-center justify-center text-center flex-shrink-0 min-w-[clamp(140px,18vw,200px)] joker-box rounded-xl border border-liquid-gold-end/35 px-4 py-3">
        <p className="font-inter font-semibold text-[var(--text-label-xl)] tracking-[0.3em] uppercase text-champagne mb-[0.2vh]">
          RENEWALS
          <br />
          (This Month)
        </p>
        <AnimatedCounter
          value={data.totalRenewalsThisMonth}
          className="font-edu text-8xl min-[900px]:text-9xl leading-none text-gold-300 tabular-nums"
          delay={delay + 200}
          slideOnChange
        />
      </div>

      {/* ── Renewals List (Center) ───────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col justify-center items-center gap-4 min-w-0">
        <p className="font-inter font-semibold text-[clamp(1.575rem,2.1vw,2.4rem)] tracking-[0.4em] uppercase text-champagne mb-1 text-center">
          Latest Renewals
        </p>
        <div className="flex flex-col items-center gap-3 w-full">
          {data.renewals.length === 0 ? (
            <p className="font-inter font-semibold text-[clamp(1.425rem,2.325vw,2.925rem)] text-champagne/50">
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
      <div className="flex-1 flex flex-col justify-center items-center gap-4 min-w-0">
        <p className="font-inter font-semibold text-[clamp(1.575rem,2.1vw,2.4rem)] tracking-[0.4em] uppercase text-champagne mb-1 text-center">
          Latest Members
        </p>
        <div className="flex flex-col items-center gap-3 w-full">
          {data.assignments.length === 0 ? (
            <p className="font-inter font-semibold text-[clamp(1.425rem,2.325vw,2.925rem)] text-champagne/50">
              —
            </p>
          ) : (
            data.assignments.map((name, i) => (
              <NameRow key={`${name}-${i}`} name={name} isNew={i === 0} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
