"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchJson } from "@/lib/clientFetch";
import { useRealtimeChannel } from "@/hooks/useRealtimeChannel";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { istToday } from "@/lib/istDate";
import type {
  LeadStatusByAgent,
  OnboardingAgentRow,
  OnboardingApiPayload,
  OnboardingLedgerRow,
  VerticalTrendPoint,
  LeadMonthStats,
} from "@/lib/onboardingTypes";
import { EMPTY_LEAD_MONTH_STATS } from "@/lib/onboardingTypes";
import type { PulseEvent } from "@/components/onboarding/PerformanceLineGraph";
import {
  ONBOARDING_FALLBACK_AGENTS,
  LIVE_LEDGER_MAX,
  orderAgentsForColumn,
  sortLedgerNewestFirst,
  ledgerRowFromInsertPayload,
} from "@/components/onboarding/utils";

export interface UseOnboardingPanelDataResult {
  /** Every roster seat, roster order. */
  agents: OnboardingAgentRow[];
  /** Seats for the left agent column (lib/onboardingAgents.ts `column`). */
  leftAgents: OnboardingAgentRow[];
  /** Seats for the right agent column. */
  rightAgents: OnboardingAgentRow[];
  ledger: OnboardingLedgerRow[];
  pulseEvents: PulseEvent[];
  leadMonthStats: LeadMonthStats;
  verticalTrendline: VerticalTrendPoint[];
  ledgerScrollDuration: string;
  prefersReducedMotion: boolean;
  leadStatusByAgent: LeadStatusByAgent;
  todayDate: string;
}

export function useOnboardingPanelData(): UseOnboardingPanelDataResult {
  const [agents, setAgents] = useState<OnboardingAgentRow[]>([]);
  const [ledger, setLedger] = useState<OnboardingLedgerRow[]>([]);

  const [pulseEvents, setPulseEvents] = useState<PulseEvent[]>([]);
  const pulseTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const firePulse = useCallback(() => {
    const id = `pe-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setPulseEvents((prev) => [...prev, { id }]);
    const t = setTimeout(() => {
      setPulseEvents((prev) => prev.filter((e) => e.id !== id));
      pulseTimers.current.delete(id);
    }, 2300);
    pulseTimers.current.set(id, t);
  }, []);

  useEffect(() => {
    const timers = pulseTimers.current;
    return () => {
      timers.forEach(clearTimeout);
      timers.clear();
    };
  }, []);

  const [leadStatusByAgent, setLeadStatusByAgent] = useState<LeadStatusByAgent>(
    {},
  );
  const [verticalTrendline, setVerticalTrendline] = useState<VerticalTrendPoint[]>([]);
  const [leadMonthStats, setLeadMonthStats] = useState<LeadMonthStats>(EMPTY_LEAD_MONTH_STATS);

  const debouncedLoadRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadAbortRef = useRef<AbortController | null>(null);

  const prefersReducedMotion = usePrefersReducedMotion();

  // Overlapping loads (5-min poll vs debounced Realtime refetch) race: abort
  // the previous in-flight request so a stale response can never land after a
  // fresher one (dry-audit C3).
  const load = useCallback(async () => {
    loadAbortRef.current?.abort();
    const ac = new AbortController();
    loadAbortRef.current = ac;

    const data = await fetchJson<OnboardingApiPayload>("/api/onboarding", {
      signal: ac.signal,
    });
    if (loadAbortRef.current === ac) loadAbortRef.current = null;
    if (data === null) return;

    if (Array.isArray(data.agents) && data.agents.length > 0) {
      setAgents(data.agents);
    } else {
      setAgents([...ONBOARDING_FALLBACK_AGENTS]);
    }

    const raw = Array.isArray(data.ledger) ? data.ledger : [];
    setLedger(sortLedgerNewestFirst(raw).slice(0, LIVE_LEDGER_MAX));

    if (data.leadStatusByAgent) setLeadStatusByAgent(data.leadStatusByAgent);
    if (Array.isArray(data.verticalTrendline) && data.verticalTrendline.length > 0) {
      setVerticalTrendline(data.verticalTrendline);
    }
    if (data.leadMonthStats) {
      setLeadMonthStats(data.leadMonthStats);
    }
  }, []);

  const scheduleDebouncedLoad = useCallback(() => {
    if (debouncedLoadRef.current) clearTimeout(debouncedLoadRef.current);
    debouncedLoadRef.current = setTimeout(() => {
      void load();
      debouncedLoadRef.current = null;
    }, 2500);
  }, [load]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const id = setInterval(
      () => {
        void load();
      },
      5 * 60 * 1000,
    );
    return () => {
      clearInterval(id);
      if (debouncedLoadRef.current) clearTimeout(debouncedLoadRef.current);
      loadAbortRef.current?.abort();
    };
  }, [load]);

  // Channel names are contractual (CLAUDE.md "Known Sharp Edges") — never rename.
  useRealtimeChannel(
    "deals-live",
    [
      {
        table: "deals",
        handler: (payload) => {
          if (payload.eventType === "INSERT") {
            const raw = payload.new as Record<string, unknown> | null;
            if (!raw) return;
            const row = ledgerRowFromInsertPayload(raw);
            if (!row) return;
            firePulse();
            setLedger((prev) => {
              const withoutDup = prev.filter((r) => r.id !== row.id);
              return sortLedgerNewestFirst([row, ...withoutDup]).slice(
                0,
                LIVE_LEDGER_MAX,
              );
            });
          }
          scheduleDebouncedLoad();
        },
      },
    ],
    () => void load(),
  );

  useRealtimeChannel(
    "leads-touches-live",
    [
      {
        table: "leads",
        handler: (payload) => {
          if (payload.eventType === "INSERT") firePulse();
          scheduleDebouncedLoad();
        },
      },
    ],
    () => void load(),
  );

  const leftAgents = useMemo(() => orderAgentsForColumn(agents, "left"), [agents]);
  const rightAgents = useMemo(() => orderAgentsForColumn(agents, "right"), [agents]);

  const ledgerScrollDuration = useMemo(() => {
    const n = ledger.length;
    return n === 0 ? "48s" : `${Math.max(32, n * 6)}s`;
  }, [ledger.length]);

  return {
    agents,
    leftAgents,
    rightAgents,
    ledger,
    pulseEvents,
    leadMonthStats,
    verticalTrendline,
    ledgerScrollDuration,
    prefersReducedMotion,
    leadStatusByAgent,
    todayDate: istToday().day,
  };
}
