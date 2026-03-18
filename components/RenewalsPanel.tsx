"use client";

import { useEffect, useState, useCallback } from "react";
import { Check } from "lucide-react";
import { supabase } from "@/lib/supabase";
import AnimatedCounter from "./AnimatedCounter";

interface RenewalsPanelProps {
  queendomId: "ananyshree" | "anishqa";
  delay?: number;
}

interface PanelData {
  totalRenewalsThisMonth: number;
  renewals: string[];
  assignments: string[];
}

function NameRow({ name, isNew }: { name: string; isNew: boolean }) {
  return (
    <div className="flex items-center justify-center gap-3 min-w-0 w-full">
      <Check
        className="flex-shrink-0 w-6 h-6 text-[#D4AF37]"
        strokeWidth={2.5}
      />
      <span
        className={`font-inter font-semibold text-[clamp(1.25rem,2.2vw,1.75rem)] truncate renewal-card-text ${
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
  queendomId,
  delay = 0,
}: RenewalsPanelProps) {
  const [data, setData] = useState<PanelData>({
    totalRenewalsThisMonth: 0,
    renewals: [],
    assignments: [],
  });

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/renewals-panel?queendom=${queendomId}`, {
        cache: "no-store",
      });
      if (!res.ok) return;
      const json: PanelData = await res.json();
      setData(json);
    } catch (err) {
      console.error("[RenewalsPanel] fetch failed:", err);
    }
  }, [queendomId]);

  // Initial fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Supabase Realtime: INSERT on renewals or members → refresh + animation
  useEffect(() => {
    if (!supabase) return;

    const renewalsChannel = supabase
      .channel(`renewals-${queendomId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "renewals" },
        () => fetchData(),
      )
      .subscribe();

    const membersChannel = supabase
      .channel(`members-${queendomId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "members" },
        () => fetchData(),
      )
      .subscribe();

    return () => {
      supabase?.removeChannel(renewalsChannel);
      supabase?.removeChannel(membersChannel);
    };
  }, [queendomId, fetchData]);

  return (
    <div
      className="flex items-stretch gap-4 glass gold-border-glow rounded-2xl relative overflow-hidden"
      style={{ padding: "clamp(12px, 1.5vw, 24px)" }}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-gold-500/[0.04] to-transparent pointer-events-none rounded-2xl" />
      {/* ── Counter (Left) — same as Spoiled card (joker-box, text-gold-300) ──── */}
      <div className="flex flex-col items-center justify-center text-center flex-shrink-0 min-w-[clamp(140px,18vw,200px)] joker-box rounded-xl border border-liquid-gold-end/35 px-4 py-3">
        <p className="font-inter font-semibold text-[clamp(16px,1.7vw,22px)] tracking-[0.3em] uppercase text-champagne mb-[0.2vh]">
          RENEWALS
        </p>
        <AnimatedCounter
          value={data.totalRenewalsThisMonth}
          className="font-edu text-7xl min-[900px]:text-8xl leading-none text-gold-300 tabular-nums"
          delay={delay + 200}
          slideOnChange
        />
      </div>

      {/* ── Renewals List (Center) ───────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col justify-center items-center gap-4 min-w-0">
        <p className="font-inter font-semibold text-[clamp(0.9rem,1.2vw,1.4rem)] tracking-[0.4em] uppercase text-champagne mb-1 text-center">
          Latest Renewals
        </p>
        <div className="flex flex-col items-center gap-3 w-full">
          {data.renewals.length === 0 ? (
            <p className="font-inter font-semibold text-[clamp(1.25rem,2.2vw,1.75rem)] text-champagne/50">
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

      {/* ── New Members / Assignments (Right) ────────────────────────────────── */}
      <div className="flex-1 flex flex-col justify-center items-center gap-4 min-w-0">
        <p className="font-inter font-semibold text-[clamp(0.9rem,1.2vw,1.4rem)] tracking-[0.4em] uppercase text-champagne mb-1 text-center">
          LATEST ASSIGNMENTS
        </p>
        <div className="flex flex-col items-center gap-3 w-full">
          {data.assignments.length === 0 ? (
            <p className="font-inter font-semibold text-[clamp(1.25rem,2.2vw,1.75rem)] text-champagne/50">
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
