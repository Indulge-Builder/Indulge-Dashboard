"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchJson } from "@/lib/clientFetch";
import { useRealtimeChannel } from "@/hooks/useRealtimeChannel";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { istToday } from "@/lib/istDate";
import { getAgentDepartment } from "@/lib/onboardingAgents";
import type {
  LeadStatusByAgent,
  OnboardingAgentRow,
  OnboardingApiPayload,
  OnboardingLedgerRow,
  VerticalTrendPoint,
  LeadMonthStats,
} from "@/lib/onboardingTypes";
import type { PulseEvent } from "@/components/onboarding/PerformanceLineGraph";
import {
  CONCIERGE_FALLBACK_AGENTS,
  SHOP_FALLBACK_AGENTS,
  LIVE_LEDGER_MAX,
  orderConciergeAgentsForDisplay,
  orderShopAgentsForDisplay,
  sortLedgerNewestFirst,
  ledgerRowFromInsertPayload,
} from "@/components/onboarding/utils";

export interface UseOnboardingPanelDataResult {
  conciergeAgents: OnboardingAgentRow[];
  shopAgents: OnboardingAgentRow[];
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

  const firePulse = useCallback((team: "onboarding" | "shop") => {
    const id = `pe-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setPulseEvents((prev) => [...prev, { id, team }]);
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
  const [leadMonthStats, setLeadMonthStats] = useState<LeadMonthStats>({
    leads: 0,
    attended: 0,
    dealsClosedThisMonth: 0,
    junk: 0,
  });

  const [deptStats, setDeptStats] = useState<NonNullable<
    OnboardingApiPayload["departments"]
  > | null>(null);

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
      setAgents([...CONCIERGE_FALLBACK_AGENTS, ...SHOP_FALLBACK_AGENTS]);
    }

    const raw = Array.isArray(data.ledger) ? data.ledger : [];
    setLedger(sortLedgerNewestFirst(raw).slice(0, LIVE_LEDGER_MAX));

    if (data.departments) {
      setDeptStats(data.departments);
    }

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
            const team = row.department === "shop" ? "shop" : "onboarding";
            firePulse(team);
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
          if (payload.eventType === "INSERT") {
            const raw = payload.new as Record<string, unknown> | null;
            const agentName = (raw?.agent_name as string | undefined) ?? "";
            const dept = getAgentDepartment(agentName);
            const team = dept === "shop" ? "shop" : "onboarding";
            firePulse(team);
          }
          scheduleDebouncedLoad();
        },
      },
    ],
    () => void load(),
  );

  const conciergeAgents = useMemo<OnboardingAgentRow[]>(() => {
    if (deptStats) return deptStats.concierge.agents;
    const fromFlat = agents.filter(
      (a) => (a.department ?? getAgentDepartment(a.name)) === "concierge",
    );
    return fromFlat.length > 0
      ? orderConciergeAgentsForDisplay(fromFlat)
      : [...CONCIERGE_FALLBACK_AGENTS];
  }, [agents, deptStats]);

  const shopAgents = useMemo<OnboardingAgentRow[]>(() => {
    if (deptStats) return deptStats.shop.agents;
    const fromFlat = agents.filter(
      (a) => (a.department ?? getAgentDepartment(a.name)) === "shop",
    );
    return fromFlat.length > 0
      ? orderShopAgentsForDisplay(fromFlat)
      : [...SHOP_FALLBACK_AGENTS];
  }, [agents, deptStats]);

  const ledgerScrollDuration = useMemo(() => {
    const n = ledger.length;
    return n === 0 ? "48s" : `${Math.max(32, n * 6)}s`;
  }, [ledger.length]);

  return {
    conciergeAgents,
    shopAgents,
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
