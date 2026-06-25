"use client";

/**
 * hooks/useDashboardData.ts
 *
 * Single source of truth for all dashboard data state, fetch orchestration,
 * and Supabase Realtime subscriptions. Extracted from Dashboard.tsx.
 *
 * IMPORTANT — memory-safety guarantees:
 *   1. Each Supabase channel lives in useRealtimeChannel, which removes it via
 *      supabase.removeChannel on cleanup and self-heals on CHANNEL_ERROR /
 *      TIMED_OUT (refetch + 3s resubscribe) — dry-audit C2.
 *   2. The 5-minute poll/prune interval is cleared in its own cleanup return.
 *   3. All useCallback fetchers have stable references (empty dep arrays).
 *
 * Math / business logic is NOT touched. All aggregation calls
 * (aggregateTicketStats, mergeAndRankAgents, pruneTicketRowsForDashboardState)
 * are delegated to lib/ticketAggregation.ts unchanged.
 */

import { useCallback, useEffect, useState } from "react";
import { fetchJson } from "@/lib/clientFetch";
import { useRealtimeChannel } from "@/hooks/useRealtimeChannel";
import { buildRoster, ROSTER_ANANYSHREE, ROSTER_ANISHQA } from "@/lib/agentRoster";
import type { QueenStats, MemberStats, TicketStats, JokerStats } from "@/lib/types";
import type { TicketRowMinimal } from "@/lib/ticketAggregation";
import {
  aggregateTicketStats,
  mergeAndRankAgents,
  pruneTicketRowsForDashboardState,
} from "@/lib/ticketAggregation";
import { buildTicketTimeSeries } from "@/lib/ticketTimeSeries";
import type { OverdueTicketItem, RenewalsPanelData, MemberApiResponse } from "@/types";

// ─── Zero initial state ───────────────────────────────────────────────────────
// All counters animate up from 0 on first load — this is intentional UX.

const ZERO_MEMBERS: MemberStats = { total: 0, celebrityActive: 0, toBeRevived: 0 };

const ZERO_TICKETS: TicketStats = {
  totalReceived: 0,
  resolvedThisMonth: 0,
  solvedToday: 0,
  pendingToResolve: 0,
  jokerSuggestion: 0,
};

const ZERO_JOKER: JokerStats = {
  uniqueSuggestionsCount: 0,
  totalSent: 0,
  totalSuggestions: 0,
  acceptedCount: 0,
  rejectedCount: 0,
  pendingSuggestions: 0,
  acceptedToday: 0,
  totalThisMonth: 0,
};

// Fixed rosters — stats are filled in from ticket rows after the initial fetch.
const AGENTS_ANANYSHREE = buildRoster(ROSTER_ANANYSHREE, "ananyshree");
const AGENTS_ANISHQA = buildRoster(ROSTER_ANISHQA, "anishqa");

const INIT_ANANYSHREE: QueenStats = {
  members: ZERO_MEMBERS,
  tickets: ZERO_TICKETS,
  agents: AGENTS_ANANYSHREE,
  joker: ZERO_JOKER,
};

const INIT_ANISHQA: QueenStats = {
  members: ZERO_MEMBERS,
  tickets: ZERO_TICKETS,
  agents: AGENTS_ANISHQA,
  joker: ZERO_JOKER,
};

// ─── Realtime payload normaliser ─────────────────────────────────────────────
/**
 * Maps a raw Supabase postgres_changes payload to a TicketRowMinimal.
 * Handles both `id` and `ticket_id` column names, and normalises numeric IDs
 * to strings (state dedup always compares string keys).
 */
function toTicketRow(raw: Record<string, unknown> | null): TicketRowMinimal | null {
  if (!raw) return null;
  const rawId = raw.id ?? raw.ticket_id;
  if (rawId == null) return null;
  const id = String(rawId);
  if (!id) return null;
  return {
    id,
    status:        (raw.status        as string | null)                 ?? null,
    queendom_name: (raw.queendom_name as string | null)                 ?? null,
    agent_name:    (raw.agent_name    as string | null)                 ?? null,
    created_at:    (raw.created_at    as string | null)                 ?? null,
    resolved_at:   (raw.resolved_at   as string | null)                 ?? null,
    is_escalated:  (raw.is_escalated  as boolean | null)                ?? null,
    is_incomplete: (raw.is_incomplete as boolean | null)                ?? null,
    tags:          (raw.tags          as Record<string, unknown> | null) ?? null,
  };
}

// ─── Return shape ─────────────────────────────────────────────────────────────
export interface DashboardData {
  ananyshreeStats:    QueenStats;
  anishqaStats:       QueenStats;
  overdueTickets:     OverdueTicketItem[];
  renewalsAnanyshree: RenewalsPanelData;
  renewalsAnishqa:    RenewalsPanelData;
  /**
   * True from mount until the first fetchAll() resolves (all six API calls
   * complete or fail individually). Used to render skeleton overlays in
   * DashboardController. An 8-second safety timeout prevents it from staying
   * true permanently on slow or partially-failing networks.
   */
  isInitialLoading:   boolean;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useDashboardData(): DashboardData {
  const [isInitialLoading,   setIsInitialLoading]   = useState(true);
  const [ticketRows,         setTicketRows]         = useState<TicketRowMinimal[]>([]);
  const [ananyshreeStats,    setAnanyshreeStats]    = useState<QueenStats>(INIT_ANANYSHREE);
  const [anishqaStats,       setAnishqaStats]       = useState<QueenStats>(INIT_ANISHQA);
  const [overdueTickets,     setOverdueTickets]     = useState<OverdueTicketItem[]>([]);
  const [renewalsAnanyshree, setRenewalsAnanyshree] = useState<RenewalsPanelData>({
    totalRenewalsThisMonth: 0,
    renewals: [],
    assignments: [],
  });
  const [renewalsAnishqa, setRenewalsAnishqa] = useState<RenewalsPanelData>({
    totalRenewalsThisMonth: 0,
    renewals: [],
    assignments: [],
  });

  // ── Derive ticket + agent stats whenever ticketRows changes ─────────────────
  // Aggregation is pure and runs only when ticketRows reference changes.
  // All math is delegated to lib/ticketAggregation — NOT modified here.
  useEffect(() => {
    const ticketStats = aggregateTicketStats(ticketRows);
    const { ananyshree: agentsA, anishqa: agentsB } = mergeAndRankAgents(ticketRows);
    const series = buildTicketTimeSeries(ticketRows);
    setAnanyshreeStats((prev) => ({
      ...prev,
      tickets: ticketStats.ananyshree,
      agents: agentsA,
      series: series.ananyshree,
    }));
    setAnishqaStats((prev) => ({
      ...prev,
      tickets: ticketStats.anishqa,
      agents: agentsB,
      series: series.anishqa,
    }));
  }, [ticketRows]);

  // ── Fetchers (all stable — empty dep arrays) ────────────────────────────────

  const fetchTicketRows = useCallback(async () => {
    const rows = await fetchJson<TicketRowMinimal[]>("/api/tickets/rows");
    if (rows === null) return;
    setTicketRows(
      pruneTicketRowsForDashboardState(Array.isArray(rows) ? rows : []),
    );
  }, []);

  const fetchMembers = useCallback(async () => {
    const data = await fetchJson<MemberApiResponse>("/api/clients");
    if (data === null) return;
    setAnanyshreeStats((prev) => ({ ...prev, members: data.ananyshree }));
    setAnishqaStats((prev)    => ({ ...prev, members: data.anishqa }));
  }, []);

  const fetchJokers = useCallback(async () => {
    const data = await fetchJson<{ ananyshree: JokerStats; anishqa: JokerStats }>(
      "/api/jokers",
    );
    if (data === null) return;
    setAnanyshreeStats((prev) => ({ ...prev, joker: data.ananyshree }));
    setAnishqaStats((prev)    => ({ ...prev, joker: data.anishqa }));
  }, []);

  const fetchOverdueTickets = useCallback(async () => {
    const data = await fetchJson<OverdueTicketItem[]>("/api/tickets/overdue");
    if (data === null) return;
    setOverdueTickets(Array.isArray(data) ? data : []);
  }, []);

  const fetchRenewals = useCallback(async (queendom: "ananyshree" | "anishqa") => {
    const data = await fetchJson<RenewalsPanelData>(
      `/api/renewals-panel?queendom=${queendom}`,
    );
    if (data === null) return;
    if (queendom === "ananyshree") setRenewalsAnanyshree(data);
    else setRenewalsAnishqa(data);
  }, []);

  const fetchAll = useCallback(
    () =>
      Promise.all([
        fetchTicketRows(),
        fetchMembers(),
        fetchJokers(),
        fetchOverdueTickets(),
        fetchRenewals("ananyshree"),
        fetchRenewals("anishqa"),
      ]),
    [fetchTicketRows, fetchMembers, fetchJokers, fetchOverdueTickets, fetchRenewals],
  );

  // ── Initial load ─────────────────────────────────────────────────────────────
  // Flips isInitialLoading to false once all six fetches complete.
  // Each individual fetcher has its own try/catch so fetchAll() never rejects.
  // The 8-second safety timeout ensures the skeleton never gets permanently stuck
  // on slow or partially-failing networks.
  useEffect(() => {
    const clearLoading = () => setIsInitialLoading(false);
    void fetchAll().then(clearLoading);
    const safety = setTimeout(clearLoading, 8_000);
    return () => clearTimeout(safety);
  }, [fetchAll]);

  // ── 5-minute safety poll + IST month-rollover prune ──────────────────────────
  // The poll-refetch is the documented safety net when Realtime silently misses
  // events (dry-audit C2 — matches useOnboardingPanelData). The prune runs even
  // if the network is down so a month rollover still drops last month's rows.
  useEffect(() => {
    const id = window.setInterval(() => {
      setTicketRows((prev) => pruneTicketRowsForDashboardState(prev));
      void fetchAll();
    }, 5 * 60_000);
    return () => clearInterval(id);
  }, [fetchAll]);

  // ── Supabase Realtime subscriptions ──────────────────────────────────────────
  // Four channels via useRealtimeChannel (CHANNEL_ERROR/TIMED_OUT → refetch +
  // 3s resubscribe; cleanup via removeChannel). Channel names are contractual.
  //
  // Channel map:
  //   dashboard-clients  → clients table  → refetch /api/clients
  //   dashboard-jokers   → jokers table   → ticker patch + stats refetch
  //   dashboard-tickets  → tickets table  → optimistic patch ticketRows state
  //   dashboard-renewals → renewals+members tables → refetch /api/renewals-panel

  useRealtimeChannel(
    "dashboard-clients",
    [{ table: "clients", handler: () => { fetchMembers(); } }],
    fetchMembers,
  );

  // Jokers feed the JokerMetricsStrip only (the ticker now shows overdue
  // tickets, not joker suggestions). Any jokers row change refetches the
  // aggregated Joker stats from the API.
  useRealtimeChannel(
    "dashboard-jokers",
    [{ table: "jokers", handler: () => { fetchJokers(); } }],
    fetchJokers,
  );

  // All three event types use functional setTicketRows updates — no stale-closure
  // risk. On channel failure, a full rows refetch heals any missed events.
  useRealtimeChannel(
    "dashboard-tickets",
    [
      {
        table: "tickets",
        handler: (payload) => {
          if (payload.eventType === "INSERT" && payload.new) {
            const row = toTicketRow(payload.new as Record<string, unknown>);
            if (row)
              setTicketRows((prev) => {
                // If the same ticket ID is already in state (possible with duplicate
                // INSERT events in Supabase Realtime), overwrite rather than append.
                const i = prev.findIndex((r) => r.id === row.id);
                if (i >= 0) {
                  const next = [...prev];
                  next[i] = row;
                  return pruneTicketRowsForDashboardState(next);
                }
                return pruneTicketRowsForDashboardState([...prev, row]);
              });
          } else if (payload.eventType === "UPDATE" && payload.new) {
            const row = toTicketRow(payload.new as Record<string, unknown>);
            if (row)
              setTicketRows((prev) =>
                pruneTicketRowsForDashboardState(
                  prev.map((r) => (r.id === row.id ? row : r)),
                ),
              );
          } else if (payload.eventType === "DELETE" && payload.old) {
            const oldRow = toTicketRow(payload.old as Record<string, unknown>);
            if (oldRow)
              setTicketRows((prev) => prev.filter((r) => r.id !== oldRow.id));
          }
        },
      },
      // Second handler (dry-audit C5 pattern): the overdue ticker reads the
      // escalated set straight from /api/tickets/overdue (not month-gated, so
      // it can't be patched from the month-scoped ticketRows state). Any
      // tickets change — escalation flip, status change, delete — refetches it.
      { table: "tickets", handler: () => { fetchOverdueTickets(); } },
    ],
    () => {
      fetchTicketRows();
      fetchOverdueTickets();
    },
  );

  useRealtimeChannel(
    "dashboard-renewals",
    [
      {
        table: "renewals",
        event: "INSERT",
        handler: () => {
          fetchRenewals("ananyshree");
          fetchRenewals("anishqa");
        },
      },
      {
        table: "members",
        event: "INSERT",
        handler: () => {
          fetchRenewals("ananyshree");
          fetchRenewals("anishqa");
        },
      },
    ],
    () => {
      fetchRenewals("ananyshree");
      fetchRenewals("anishqa");
    },
  );

  return {
    ananyshreeStats,
    anishqaStats,
    overdueTickets,
    renewalsAnanyshree,
    renewalsAnishqa,
    isInitialLoading,
  };
}
