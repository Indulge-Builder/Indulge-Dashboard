"use client";

/**
 * components/onboarding/OnboardingPanel.tsx
 *
 * Thin orchestration shell for the Onboarding screen.
 *
 * Responsibilities (and nothing more):
 *   - State:    agents, ledger, shimmerStampByAgentId
 *   - Fetching: initial load from /api/onboarding
 *   - Realtime: 2 Supabase channels with full cleanup on unmount
 *                 · onboarding-conversion-ledger-live
 *                 · onboarding-lead-touches-live
 *   - Shimmer:  detects totalConverted increases to fire per-card shimmer animation
 *   - Derived:  sortedLedger, ledgerScrollDuration, displayAgents (all useMemo)
 *   - Layout:   ambient glow · header · Section A (cards) · Section B (ledger)
 *
 * All rendering detail lives in EliteAgentCard and ConversionLedger.
 * usePrefersReducedMotion is the canonical hook from hooks/ (not re-defined here).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import type {
  OnboardingAgentRow,
  OnboardingApiPayload,
  OnboardingLedgerRow,
} from "@/lib/onboardingTypes";
import { EliteAgentCard } from "./EliteAgentCard";
import { ConversionLedger } from "./ConversionLedger";
import {
  FALLBACK_AGENTS,
  LIVE_LEDGER_MAX,
  ONBOARDING_PAGE_TITLE_FONT,
  orderAgentsForDisplay,
  sortLedgerNewestFirst,
  ledgerRowFromInsertPayload,
} from "./utils";

// ── Component ─────────────────────────────────────────────────────────────────
export default function OnboardingPanel() {
  const [agents, setAgents] = useState<OnboardingAgentRow[]>([]);
  const [ledger, setLedger] = useState<OnboardingLedgerRow[]>([]);
  const prevConvertedRef    = useRef<Record<string, number>>({});
  const [shimmerStampByAgentId, setShimmerStampByAgentId] = useState<
    Record<string, number>
  >({});
  const shimmerClearRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prefersReducedMotion = usePrefersReducedMotion();

  // ── Initial load ─────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    try {
      const res  = await fetch("/api/onboarding", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as OnboardingApiPayload;
      setAgents(
        Array.isArray(data.agents) && data.agents.length > 0
          ? data.agents.slice(0, 3)
          : FALLBACK_AGENTS,
      );
      const raw = Array.isArray(data.ledger) ? data.ledger : [];
      setLedger(sortLedgerNewestFirst(raw).slice(0, LIVE_LEDGER_MAX));
    } catch {
      /* silently ignore — fallback state is already set */
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // ── Realtime: onboarding_conversion_ledger ────────────────────────────────
  useEffect(() => {
    const client = supabase;
    if (!client) return;

    const ch = client
      .channel("onboarding-conversion-ledger-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "onboarding_conversion_ledger" },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const raw = payload.new as Record<string, unknown> | null;
            if (!raw) return;
            const row = ledgerRowFromInsertPayload(raw);
            if (!row) return;
            setLedger((prev) => {
              const withoutDup = prev.filter((r) => r.id !== row.id);
              return sortLedgerNewestFirst([row, ...withoutDup]).slice(
                0,
                LIVE_LEDGER_MAX,
              );
            });
          }
          void load();
        },
      )
      .subscribe();

    return () => {
      client.removeChannel(ch);
    };
  }, [load]);

  // ── Realtime: onboarding_lead_touches ─────────────────────────────────────
  useEffect(() => {
    const client = supabase;
    if (!client) return;

    const ch = client
      .channel("onboarding-lead-touches-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "onboarding_lead_touches" },
        () => {
          void load();
        },
      )
      .subscribe();

    return () => {
      client.removeChannel(ch);
    };
  }, [load]);

  // ── Shimmer detection: fires when an agent's totalConverted increases ─────
  useEffect(() => {
    let winner: string | null = null;
    for (const agent of agents) {
      const prev = prevConvertedRef.current[agent.id];
      if (prev !== undefined && agent.totalConverted > prev) {
        winner = agent.id;
        break;
      }
    }
    for (const agent of agents) {
      prevConvertedRef.current[agent.id] = agent.totalConverted;
    }
    if (winner) {
      if (shimmerClearRef.current) clearTimeout(shimmerClearRef.current);
      const stamp = Date.now();
      setShimmerStampByAgentId((m) => ({ ...m, [winner!]: stamp }));
      shimmerClearRef.current = setTimeout(() => {
        setShimmerStampByAgentId((m) => {
          const next = { ...m };
          delete next[winner!];
          return next;
        });
        shimmerClearRef.current = null;
      }, 2100);
    }
  }, [agents]);

  // ── Derived state ─────────────────────────────────────────────────────────
  const sortedLedger = useMemo(() => sortLedgerNewestFirst(ledger), [ledger]);

  const ledgerScrollDuration = useMemo(() => {
    const n = sortedLedger.length;
    return n === 0 ? "48s" : `${Math.max(32, n * 6)}s`;
  }, [sortedLedger.length]);

  const displayAgents = useMemo(() => {
    const fromApi = agents.length > 0 ? agents.slice(0, 3) : [];
    return orderAgentsForDisplay(fromApi);
  }, [agents]);

  // ── Layout ────────────────────────────────────────────────────────────────
  return (
    <section
      className="relative flex h-full min-h-0 w-full flex-1 flex-col overflow-x-hidden overflow-y-auto bg-obsidian md:overflow-y-hidden"
      style={{
        padding:
          "clamp(0.75rem, min(2vh, 2.5vmin), 2rem) clamp(0.75rem, min(3vmin, 4vw), 3rem)",
      }}
    >
      {/* Ambient gold radial glow — CSS utility class from globals.css Step 1 */}
      <div className="ambient-glow-center absolute inset-0 pointer-events-none" />

      {/* ── Header — matches QueendomPanel title + rule rhythm ── */}
      <div className="relative mb-[1.8vh] flex flex-shrink-0 flex-col items-center text-center">
        <div className="mb-[0.9vh] flex w-full items-center gap-3">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gold-500/30 to-gold-500/50" />
          <div className="h-px flex-1 bg-gradient-to-l from-transparent via-gold-500/30 to-gold-500/50" />
        </div>
        <h2
          className="mb-[1.1vh] font-cinzel font-bold uppercase leading-none tracking-[0.28em] text-gold-400 queen-name-glow"
          style={{ fontSize: ONBOARDING_PAGE_TITLE_FONT }}
        >
          Onboarding
        </h2>
        <div className="flex w-full items-center gap-3">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gold-500/28 to-gold-500/45" />
          <div className="h-px flex-1 bg-gradient-to-l from-transparent via-gold-500/28 to-gold-500/45" />
        </div>
      </div>

      {/* ── Section A: Agent portrait cards (flex-[3] ≈ 60% vertical) ── */}
      <div className="relative mb-[1.6vh] flex min-h-0 w-full min-w-0 flex-[3] flex-col">
        <div
          className="glass gold-border-glow relative flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden rounded-3xl"
          style={{
            padding:
              "clamp(0.65rem, min(1.6vh, 1.8vmin), 1.75rem) clamp(0.65rem, min(2.8vmin, 3.8vw), 3rem) clamp(0.65rem, min(1.5vh, 1.7vmin), 1.75rem)",
          }}
        >
          <div className="pointer-events-none absolute inset-0 rounded-3xl bg-gradient-to-br from-gold-500/[0.04] to-transparent" />
          <div className="relative grid h-full min-h-0 min-w-0 flex-1 auto-rows-fr grid-cols-1 items-stretch justify-items-stretch gap-[clamp(0.65rem,min(1.4vmin,1.8vh),2rem)] overflow-hidden pt-0 max-md:min-h-[min(34vmin,46svh)] md:grid-cols-3">
            {displayAgents.map((agent, cardIdx) => (
              <EliteAgentCard
                key={agent.id}
                agent={agent}
                shimmerStamp={shimmerStampByAgentId[agent.id] ?? 0}
                prefersReducedMotion={prefersReducedMotion}
                metricStaggerBase={cardIdx * 180}
              />
            ))}
          </div>
        </div>
      </div>

      {/* ── Section B: Live Conversion Ledger (flex-[2] ≈ 40% vertical) ── */}
      <div className="relative flex min-h-0 flex-[2] flex-col">
        <ConversionLedger
          rows={sortedLedger}
          scrollDuration={ledgerScrollDuration}
          prefersReducedMotion={prefersReducedMotion}
        />
      </div>
    </section>
  );
}
