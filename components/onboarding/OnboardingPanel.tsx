"use client";

/**
 * components/onboarding/OnboardingPanel.tsx
 *
 * Root orchestration shell for the Revenue Dashboard TV screen.
 *
 * Layout — 3-column CSS Grid:
 *
 *   ┌─────────────────────────────────────────────────────────────────────┐
 *   │                   ── Revenue Dashboard ──                          │  header
 *   ├──────────────────────┬──────────────────────┬──────────────────────┤
 *   │  DepartmentColumn    │  DepartmentColumn    │  Col 3: Live Action  │
 *   │  "Concierge"         │  "Shop"              │                      │
 *   │  Amit/Samson/Meghana │  Vikram/Katya/Harsh  │  [LeadVelocityChart] │  flex-[2]
 *   │  (EliteAgentCards    │  (EliteAgentCards    │  14-day dual-line    │
 *   │   grid-cols-3)       │   grid-cols-3)       ├──────────────────────┤
 *   │  [PipelineBar]       │  [PipelineBar]       │  [ConversionLedger]  │  flex-[3]
 *   └──────────────────────┴──────────────────────┴──────────────────────┘
 *
 * State management:
 *   - agents[]          flat array from API (pre-Step-3 fallback)
 *   - ledger[]          unified deal rows from both departments
 *   - deptStats         per-department rollup from API (post-Step-3)
 *   - conciergeAgents   derived: filter agents by department, ordered for display
 *   - shopAgents        derived: same for shop
 *   - shimmerStampByAgentId  maps agentId → timestamp of last win (triggers animation)
 *
 * Realtime:
 *   - onboarding-deals-live: optimistic prepend + refetch
 *   - onboarding-lead-touches-live: debounced refetch on change
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
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
import { DepartmentColumn } from "./DepartmentColumn";
import { ConversionLedger } from "./ConversionLedger";
import { PerformanceLineGraph } from "./PerformanceLineGraph";
import type { PulseEvent } from "./PerformanceLineGraph";
import {
  CONCIERGE_FALLBACK_AGENTS,
  SHOP_FALLBACK_AGENTS,
  LIVE_LEDGER_MAX,
  ONBOARDING_PAGE_TITLE_FONT,
  DEPT_HEADING_FONT,
  orderConciergeAgentsForDisplay,
  orderShopAgentsForDisplay,
  sortLedgerNewestFirst,
  ledgerRowFromInsertPayload,
} from "./utils";
// ── Component ─────────────────────────────────────────────────────────────────
export default function OnboardingPanel() {
  // ── State ─────────────────────────────────────────────────────────────────
  const [agents, setAgents] = useState<OnboardingAgentRow[]>([]);
  const [ledger, setLedger] = useState<OnboardingLedgerRow[]>([]);

  // ── Pulse events — fired when Realtime delivers a new lead or conversion ──
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

  // Cleanup timers on unmount
  useEffect(() => {
    const timers = pulseTimers.current;
    return () => { timers.forEach(clearTimeout); timers.clear(); };
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
    leads: 0, attended: 0, converted: 0, junk: 0,
  });

  /**
   * Per-department rollup from the API (populated after Step 3 updates the route).
   * When null, department agent lists are derived by filtering the flat `agents` array.
   */
  const [deptStats, setDeptStats] = useState<NonNullable<
    OnboardingApiPayload["departments"]
  > | null>(null);

  const prevConvertedRef = useRef<Record<string, number>>({});
  const [shimmerStampByAgentId, setShimmerStampByAgentId] = useState<
    Record<string, number>
  >({});
  const shimmerClearRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debouncedLoadRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reconnect counters — incrementing re-runs the corresponding Realtime effect,
  // causing a clean channel teardown + re-subscribe after a detected error.
  const [dealsReconnect, setDealsReconnect] = useState(0);
  const [leadsReconnect, setLeadsReconnect] = useState(0);

  const prefersReducedMotion = usePrefersReducedMotion();

  // ── Initial load ─────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/onboarding", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as OnboardingApiPayload;

      // Accept up to 6 agents (3 concierge + 3 shop)
      if (Array.isArray(data.agents) && data.agents.length > 0) {
        setAgents(data.agents.slice(0, 6));
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
    } catch {
      /* silently ignore — fallback state already set */
    }
  }, []);

  /**
   * Debounced refetch — coalesces bursts of Realtime events (e.g. bulk inserts)
   * into a single API call 2.5 s after the last event fires.
   * Optimistic state updates in the Realtime handlers carry the UI immediately;
   * this call is a sync safety-net only.
   */
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

  // ── 5-minute safety-net refresh (guards against silent Realtime disconnect) ──
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

  // ── Realtime: deals ───────────────────────────────────────────────────────
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
            // Fire a burst on the relevant team's graph line
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

  // ── Realtime: leads ───────────────────────────────────────────────────────
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

  // ── Derived: split agents by department ───────────────────────────────────

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

  /** All agents across both departments — used for shimmer detection. */
  const allAgents = useMemo(
    () => [...conciergeAgents, ...shopAgents],
    [conciergeAgents, shopAgents],
  );

  // ── Performance graph data derivation ─────────────────────────────────────

  /**
   * Merges the three daily time-series sources into PerformanceDayPoint[]:
   *   - leads     → leadTrendline  (conciergeLeads / shopLeads per day)
   *   - attended  → teamAttendedTrend (onboarding / shop per day)
   *   - converted → ledger rows grouped by IST date and department
   */
  const performanceData = useMemo<PerformanceDayPoint[]>(() => {
    // Build per-day conversion count from the ledger
    const convMap: Record<string, { onboarding: number; shop: number }> = {};
    for (const row of ledger) {
      const date = row.recordedAt.slice(0, 10); // "YYYY-MM-DD"
      if (!convMap[date]) convMap[date] = { onboarding: 0, shop: 0 };
      const dept = row.department ?? getAgentDepartment(row.agentName);
      if (dept === "concierge") convMap[date].onboarding++;
      else                      convMap[date].shop++;
    }

    const n = Math.max(leadTrendline.length, teamAttendedTrend.length);
    const points: PerformanceDayPoint[] = [];
    for (let i = 0; i < n; i++) {
      const lt   = leadTrendline[i];
      const at   = teamAttendedTrend[i];
      const date = lt?.date ?? at?.date ?? "";
      const conv = convMap[date] ?? { onboarding: 0, shop: 0 };
      points.push({
        date,
        onboarding: {
          leads:     lt?.conciergeLeads ?? 0,
          attended:  at?.onboarding ?? 0,
          converted: conv.onboarding,
        },
        shop: {
          leads:     lt?.shopLeads ?? 0,
          attended:  at?.shop ?? 0,
          converted: conv.shop,
        },
      });
    }
    return points;
  }, [leadTrendline, teamAttendedTrend, ledger]);

  /**
   * Period totals for the Performance Score formula.
   * Leads + Attended + Converted: summed from the daily series.
   * Junk: from leadStatusByAgent (current IST-month totals per agent).
   */
  const performanceTotals = useMemo<PerformanceTotals>(() => {
    const obLeads     = performanceData.reduce((s, d) => s + d.onboarding.leads,     0);
    const obAttended  = performanceData.reduce((s, d) => s + d.onboarding.attended,  0);
    const obConverted = performanceData.reduce((s, d) => s + d.onboarding.converted, 0);
    const shLeads     = performanceData.reduce((s, d) => s + d.shop.leads,     0);
    const shAttended  = performanceData.reduce((s, d) => s + d.shop.attended,  0);
    const shConverted = performanceData.reduce((s, d) => s + d.shop.converted, 0);

    const obJunk = (CONCIERGE_AGENT_DISPLAY_NAMES as readonly string[]).reduce(
      (s, n) => s + (leadStatusByAgent[n]?.Junk ?? 0), 0,
    );
    const shJunk = (SHOP_AGENT_DISPLAY_NAMES as readonly string[]).reduce(
      (s, n) => s + (leadStatusByAgent[n]?.Junk ?? 0), 0,
    );

    return {
      onboarding: { leads: obLeads, attended: obAttended, converted: obConverted, junk: obJunk },
      shop:       { leads: shLeads, attended: shAttended, converted: shConverted, junk: shJunk },
    };
  }, [performanceData, leadStatusByAgent]);


  // ── Shimmer detection: fires when any agent's totalConverted increases ─────
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

  // ── Derived: ledger scroll duration ──────────────────────────────────────
  // `ledger` is always written sorted (sortLedgerNewestFirst applied at every write).
  const ledgerScrollDuration = useMemo(() => {
    const n = ledger.length;
    return n === 0 ? "48s" : `${Math.max(32, n * 6)}s`;
  }, [ledger.length]);

  // ── Layout ────────────────────────────────────────────────────────────────
  return (
    <section
      className="relative flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden bg-obsidian"
      style={{
        padding:
          "clamp(0.6rem,min(1.6vh,1.8vmin),1.75rem) clamp(0.6rem,min(2.4vmin,3.2vw),2.5rem)",
      }}
    >
      {/* Ambient gold radial glow */}
      <div className="ambient-glow-center pointer-events-none absolute inset-0" />

      {/* ── Page header ── */}
      <div className="relative mb-[1.4vh] flex-shrink-0 text-center">
        <div className="mb-[0.7vh] flex w-full items-center gap-3">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gold-500/30 to-gold-500/50" />
          <div className="h-px flex-1 bg-gradient-to-l from-transparent via-gold-500/30 to-gold-500/50" />
        </div>
        <h2
          className="mb-[0.8vh] font-cinzel font-bold uppercase leading-none tracking-[0.28em] text-gold-400 queen-name-glow"
          style={{ fontSize: ONBOARDING_PAGE_TITLE_FONT }}
        >
          Revenue Dashboard
        </h2>
        <div className="flex w-full items-center gap-3">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gold-500/28 to-gold-500/45" />
          <div className="h-px flex-1 bg-gradient-to-l from-transparent via-gold-500/28 to-gold-500/45" />
        </div>
      </div>

      {/* ── 3-column grid ── */}
      <div
        className="relative grid min-h-0 flex-1"
        style={{
          gridTemplateColumns: "1fr 1fr 1.05fr",
          gap: "clamp(0.6rem,1.4vw,1.8rem)",
        }}
      >
        {/* ── Column 1: Concierge ── */}
        <DepartmentColumn
          department="concierge"
          label="Onboarding"
          agents={conciergeAgents}
          shimmerStampByAgentId={shimmerStampByAgentId}
          prefersReducedMotion={prefersReducedMotion}
          leadStatusByAgent={leadStatusByAgent}
        />

        {/* ── Column 2: Performance Line Graph + Conversion Ledger ── */}
        <div
          className="flex min-h-0 flex-col"
          style={{ gap: "clamp(0.55rem,1.2vh,1.25rem)" }}
        >
          {/* ── Top half: Performance Line Graph ── */}
          <div
            className="relative flex min-h-0 flex-[2] flex-col overflow-hidden rounded-2xl"
            style={{
              background: "rgba(10,10,10,0.88)",
              border:     "1px solid rgba(107,143,255,0.18)",
              boxShadow:
                "0 0 0 1px rgba(255,255,255,0.03) inset, 0 16px 40px rgba(0,0,0,0.45)",
              padding: "clamp(0.45rem,0.9vmin,1rem)",
              gap:     "clamp(0.2rem,0.4vmin,0.5rem)",
            }}
          >
            {/* Ambient bi-tonal sheen — faint blue left, faint gold right */}
            <div
              className="pointer-events-none absolute inset-0 rounded-2xl"
              style={{
                background:
                  "linear-gradient(135deg, rgba(107,143,255,0.022) 0%, transparent 45%, rgba(255,176,32,0.018) 100%)",
              }}
            />

            {/* Panel heading — mirrors DepartmentColumn header spacing exactly */}
            <div
              className="relative flex flex-shrink-0 flex-col"
              style={{
                gap:          "clamp(0.35rem, 0.7vmin, 0.8rem)",
                paddingTop:   "clamp(0.4rem, 0.9vmin, 1rem)",
                marginBottom: "0.4vh",
              }}
            >
              <div className="flex w-full items-center gap-2">
                <div
                  style={{
                    height: "clamp(1.5px, 0.22vmin, 3px)",
                    flex: 1,
                    minWidth: "clamp(22px, 3vw, 44px)",
                    background:
                      "linear-gradient(to right, transparent, rgba(107,143,255,0.30), rgba(107,143,255,0.55))",
                    boxShadow: "0 0 6px rgba(107,143,255,0.24)",
                  }}
                />
                <p
                  className="flex-shrink-0 font-cinzel font-bold uppercase leading-none tracking-[0.28em]"
                  style={{
                    fontSize:   DEPT_HEADING_FONT,
                    color:      "rgba(168,192,255,0.85)",
                    textShadow: "0 0 18px rgba(107,143,255,0.40)",
                  }}
                >
                  Performance
                </p>
                <div
                  style={{
                    height: "clamp(1.5px, 0.22vmin, 3px)",
                    flex: 1,
                    minWidth: "clamp(22px, 3vw, 44px)",
                    background:
                      "linear-gradient(to left, transparent, rgba(255,176,32,0.30), rgba(255,176,32,0.55))",
                    boxShadow: "0 0 6px rgba(255,176,32,0.24)",
                  }}
                />
              </div>
              {/* Bottom separator rule — matches DepartmentColumn bottom rule */}
              <div className="flex w-full items-center">
                <div
                  style={{
                    height: "1px",
                    flex: 1,
                    background: "linear-gradient(to right, transparent, rgba(107,143,255,0.28), rgba(107,143,255,0.45))",
                  }}
                />
                <div
                  style={{
                    height: "1px",
                    flex: 1,
                    background: "linear-gradient(to left, transparent, rgba(255,176,32,0.28), rgba(255,176,32,0.45))",
                  }}
                />
              </div>
            </div>

            {/* 4-metric tile row — sibling of heading, aligns with agent cards start row */}
            <div
              className="grid w-full flex-shrink-0"
              style={{ gridTemplateColumns: "repeat(4, 1fr)", gap: "clamp(6px, 1vw, 14px)" }}
            >
              {(
                [
                  { label: "Leads",     value: leadMonthStats.leads,     color: "rgba(192,200,220,0.85)", accent: "rgba(192,200,220,0.35)" },
                  { label: "Attended",  value: leadMonthStats.attended,  color: "#6B8FFF",                accent: "rgba(107,143,255,0.45)" },
                  { label: "Converted", value: leadMonthStats.converted, color: "#FFB020",                accent: "rgba(255,176,32,0.50)"  },
                  { label: "Junk",      value: leadMonthStats.junk,      color: "rgba(248,113,113,0.55)", accent: "rgba(248,113,113,0.28)" },
                ] as const
              ).map(({ label, value, color, accent }) => (
                <div
                  key={label}
                  style={{
                    display:         "flex",
                    flexDirection:   "column",
                    alignItems:      "center",
                    gap:             "clamp(2px, 0.4vmin, 5px)",
                    padding:         "clamp(6px, 1vmin, 12px) clamp(4px, 0.6vmin, 8px)",
                    borderRadius:    "clamp(6px, 0.9vmin, 11px)",
                    background:      "rgba(255,255,255,0.028)",
                    border:          `1px solid rgba(255,255,255,0.06)`,
                    borderTop:       `2px solid ${accent}`,
                    boxShadow:       `0 0 14px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.04)`,
                  }}
                >
                  <span
                    style={{
                      fontFamily:    "var(--font-inter, system-ui, sans-serif)",
                      fontSize:      "clamp(1.8rem, min(4.2vmin, 5vh), 5.5rem)",
                      fontWeight:    700,
                      lineHeight:    1,
                      color,
                      textShadow:    `0 0 24px ${color}55`,
                      letterSpacing: "-0.01em",
                    }}
                  >
                    {value}
                  </span>
                  <span
                    style={{
                      fontFamily:    "var(--font-inter, system-ui, sans-serif)",
                      fontSize:      "clamp(0.65rem, min(1.45vmin, 1.75vh), 1.6rem)",
                      fontWeight:    500,
                      textTransform: "uppercase",
                      letterSpacing: "0.18em",
                      color:         "rgba(255,255,255,0.38)",
                    }}
                  >
                    {label}
                  </span>
                </div>
              ))}
            </div>

            {/* Performance graph — fills remaining space */}
            <div className="relative min-h-0 flex-1">
              <PerformanceLineGraph
                data={verticalTrendline}
                pulseEvents={pulseEvents}
              />
            </div>
          </div>

          {/* ── Bottom half: Unified Conversion Ledger ── */}
          <div className="relative min-h-0 flex-[3]">
            <ConversionLedger
              rows={ledger}
              scrollDuration={ledgerScrollDuration}
              prefersReducedMotion={prefersReducedMotion}
            />
          </div>
        </div>

        {/* ── Column 3: Shop ── */}
        <DepartmentColumn
          department="shop"
          label="Shop"
          agents={shopAgents}
          shimmerStampByAgentId={shimmerStampByAgentId}
          prefersReducedMotion={prefersReducedMotion}
          leadStatusByAgent={leadStatusByAgent}
        />
      </div>
    </section>
  );
}
