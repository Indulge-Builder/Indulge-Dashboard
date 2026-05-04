"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { istToday, toISTDay } from "@/lib/istDate";
import {
  getAgentDepartment,
  CONCIERGE_AGENT_DISPLAY_NAMES,
  SHOP_AGENT_DISPLAY_NAMES,
} from "@/lib/onboardingAgents";
import type {
  LeadStatusByAgent,
  LeadTrendPoint,
  OnboardingAgentRow,
  OnboardingApiPayload,
  OnboardingLedgerRow,
  PerformanceDayPoint,
  PerformanceTotals,
  TeamAttendedDay,
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
  shimmerStampByAgentId: Record<string, number>;
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

  const [leadTrendline, setLeadTrendline] = useState<LeadTrendPoint[]>([]);
  const [leadStatusByAgent, setLeadStatusByAgent] = useState<LeadStatusByAgent>(
    {},
  );
  const [teamAttendedTrend, setTeamAttendedTrend] = useState<TeamAttendedDay[]>(
    [],
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

  const prevConvertedRef = useRef<Record<string, number>>({});
  const [shimmerStampByAgentId, setShimmerStampByAgentId] = useState<
    Record<string, number>
  >({});
  const shimmerClearRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debouncedLoadRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [dealsReconnect, setDealsReconnect] = useState(0);
  const [leadsReconnect, setLeadsReconnect] = useState(0);

  const prefersReducedMotion = usePrefersReducedMotion();

  const load = useCallback(async () => {
    const ac = new AbortController();
    try {
      const res = await fetch("/api/onboarding", {
        cache: "no-store",
        signal: ac.signal,
      });
      if (!res.ok) return;
      const data = (await res.json()) as OnboardingApiPayload;

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

      if (Array.isArray(data.leadTrendline) && data.leadTrendline.length > 0) {
        setLeadTrendline(data.leadTrendline);
      }

      if (data.leadStatusByAgent) setLeadStatusByAgent(data.leadStatusByAgent);
      if (data.teamAttendedTrend) setTeamAttendedTrend(data.teamAttendedTrend);
      if (Array.isArray(data.verticalTrendline) && data.verticalTrendline.length > 0) {
        setVerticalTrendline(data.verticalTrendline);
      }
      if (data.leadMonthStats) {
        setLeadMonthStats(data.leadMonthStats);
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      console.error("[OnboardingPanel] load failed:", err);
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
    };
  }, [load]);

  useEffect(() => {
    const client = supabase;
    if (!client) return;

    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const ch = client
      .channel("deals-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "deals" },
        (payload) => {
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
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          void load();
          reconnectTimer = setTimeout(
            () => setDealsReconnect((n) => n + 1),
            3000,
          );
        }
      });

    return () => {
      client.removeChannel(ch);
      if (reconnectTimer) clearTimeout(reconnectTimer);
    };
  }, [scheduleDebouncedLoad, load, firePulse, dealsReconnect]);

  useEffect(() => {
    const client = supabase;
    if (!client) return;

    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const ch = client
      .channel("leads-touches-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "leads" },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const raw = payload.new as Record<string, unknown> | null;
            const agentName = (raw?.agent_name as string | undefined) ?? "";
            const dept = getAgentDepartment(agentName);
            const team = dept === "shop" ? "shop" : "onboarding";
            firePulse(team);
          }
          scheduleDebouncedLoad();
        },
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          void load();
          reconnectTimer = setTimeout(
            () => setLeadsReconnect((n) => n + 1),
            3000,
          );
        }
      });

    return () => {
      client.removeChannel(ch);
      if (reconnectTimer) clearTimeout(reconnectTimer);
    };
  }, [scheduleDebouncedLoad, load, firePulse, leadsReconnect]);

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

  const allAgents = useMemo(
    () => [...conciergeAgents, ...shopAgents],
    [conciergeAgents, shopAgents],
  );

  const performanceData = useMemo<PerformanceDayPoint[]>(() => {
    const convMap: Record<string, { onboarding: number; shop: number }> = {};
    for (const row of ledger) {
      const date = toISTDay(row.recordedAt);
      if (!date) continue;
      if (!convMap[date]) convMap[date] = { onboarding: 0, shop: 0 };
      const dept = row.department ?? getAgentDepartment(row.agentName);
      if (dept === "concierge") convMap[date].onboarding++;
      else convMap[date].shop++;
    }

    const n = Math.max(leadTrendline.length, teamAttendedTrend.length);
    const points: PerformanceDayPoint[] = [];
    for (let i = 0; i < n; i++) {
      const lt = leadTrendline[i];
      const at = teamAttendedTrend[i];
      const date = lt?.date ?? at?.date ?? "";
      const conv = convMap[date] ?? { onboarding: 0, shop: 0 };
      points.push({
        date,
        onboarding: {
          leads: lt?.conciergeLeads ?? 0,
          attended: at?.onboarding ?? 0,
          converted: conv.onboarding,
        },
        shop: {
          leads: lt?.shopLeads ?? 0,
          attended: at?.shop ?? 0,
          converted: conv.shop,
        },
      });
    }
    return points;
  }, [leadTrendline, teamAttendedTrend, ledger]);

  const performanceTotals = useMemo<PerformanceTotals>(() => {
    const obLeads = performanceData.reduce((s, d) => s + d.onboarding.leads, 0);
    const obAttended = performanceData.reduce((s, d) => s + d.onboarding.attended, 0);
    const obConverted = performanceData.reduce((s, d) => s + d.onboarding.converted, 0);
    const shLeads = performanceData.reduce((s, d) => s + d.shop.leads, 0);
    const shAttended = performanceData.reduce((s, d) => s + d.shop.attended, 0);
    const shConverted = performanceData.reduce((s, d) => s + d.shop.converted, 0);

    const obJunk = (CONCIERGE_AGENT_DISPLAY_NAMES as readonly string[]).reduce(
      (s, n) => s + (leadStatusByAgent[n]?.Junk ?? 0),
      0,
    );
    const shJunk = (SHOP_AGENT_DISPLAY_NAMES as readonly string[]).reduce(
      (s, n) => s + (leadStatusByAgent[n]?.Junk ?? 0),
      0,
    );

    return {
      onboarding: {
        leads: obLeads,
        attended: obAttended,
        converted: obConverted,
        junk: obJunk,
      },
      shop: {
        leads: shLeads,
        attended: shAttended,
        converted: shConverted,
        junk: shJunk,
      },
    };
  }, [performanceData, leadStatusByAgent]);

  useEffect(() => {
    let winner: string | null = null;

    for (const agent of allAgents) {
      const prev = prevConvertedRef.current[agent.id];
      if (prev !== undefined && agent.totalConverted > prev) {
        winner = agent.id;
        break;
      }
    }

    for (const agent of allAgents) {
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
  }, [allAgents]);

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
    shimmerStampByAgentId,
    leadStatusByAgent,
    todayDate: istToday().day,
  };
}
