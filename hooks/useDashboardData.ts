"use client";

/**
 * hooks/useDashboardData.ts
 *
 * Single source of truth for all dashboard data state, fetch orchestration,
 * and Supabase Realtime subscriptions. Extracted from Dashboard.tsx.
 *
 * IMPORTANT — memory-safety guarantees preserved from the original:
 *   1. All four Supabase channels are removed in a single cleanup return of
 *      the Realtime useEffect (one cleanup removes all four).
 *   2. The 5-minute prune interval is cleared in its own cleanup return.
 *   3. All useCallback fetchers have stable references (empty dep arrays) so
 *      they never trigger Realtime re-subscription.
 *   4. The Realtime useEffect dep array is [ fetchJokers, fetchMembers,
 *      fetchRenewals ] — identical to original. fetchTicketRows is intentionally
 *      absent because the tickets handler only uses setTicketRows functional
 *      updates (no external reference needed).
 *
 * Math / business logic is NOT touched. All aggregation calls
 * (aggregateTicketStats, mergeAndRankAgents, pruneTicketRowsForDashboardState)
 * are delegated to lib/ticketAggregation.ts unchanged.
 */

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { buildRoster, ROSTER_ANANYSHREE, ROSTER_ANISHQA } from "@/lib/agentRoster";
import type { QueenStats, MemberStats, TicketStats, JokerStats } from "@/lib/types";
import type { TicketRowMinimal } from "@/lib/ticketAggregation";
import {
  aggregateTicketStats,
  mergeAndRankAgents,
  pruneTicketRowsForDashboardState,
} from "@/lib/ticketAggregation";
import type { JokerRecommendationItem, RenewalsPanelData, MemberApiResponse } from "@/types";

// ─── Zero initial state ───────────────────────────────────────────────────────
// All counters animate up from 0 on first load — this is intentional UX.

const ZERO_MEMBERS: MemberStats = { total: 0, celebrityActive: 0 };

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
    is_escalated:  (raw.is_escalated  as boolean | null)                ?? null,
    is_incomplete: (raw.is_incomplete as boolean | null)                ?? null,
    tags:          (raw.tags          as Record<string, unknown> | null) ?? null,
  };
}

// ─── Return shape ─────────────────────────────────────────────────────────────
export interface DashboardData {
  ananyshreeStats:    QueenStats;
  anishqaStats:       QueenStats;
  recommendations:    JokerRecommendationItem[];
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
  const [recommendations,    setRecommendations]    = useState<JokerRecommendationItem[]>([]);
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
    setAnanyshreeStats((prev) => ({
      ...prev,
      tickets: ticketStats.ananyshree,
      agents: agentsA,
    }));
    setAnishqaStats((prev) => ({
      ...prev,
      tickets: ticketStats.anishqa,
      agents: agentsB,
    }));
  }, [ticketRows]);

  // ── Fetchers (all stable — empty dep arrays) ────────────────────────────────

  const fetchTicketRows = useCallback(async () => {
    try {
      const res = await fetch("/api/tickets/rows", { cache: "no-store" });
      if (!res.ok) return;
      const rows: TicketRowMinimal[] = await res.json();
      setTicketRows(
        pruneTicketRowsForDashboardState(Array.isArray(rows) ? rows : []),
      );
    } catch (err) {
      console.error("[useDashboardData] fetchTicketRows failed:", err);
    }
  }, []);

  const fetchMembers = useCallback(async () => {
    try {
      const res = await fetch("/api/clients", { cache: "no-store" });
      if (!res.ok) return;
      const data: MemberApiResponse = await res.json();
      setAnanyshreeStats((prev) => ({ ...prev, members: data.ananyshree }));
      setAnishqaStats((prev)    => ({ ...prev, members: data.anishqa }));
    } catch (err) {
      console.error("[useDashboardData] fetchMembers failed:", err);
    }
  }, []);

  const fetchJokers = useCallback(async () => {
    try {
      const res = await fetch("/api/jokers", { cache: "no-store" });
      if (!res.ok) return;
      const data: { ananyshree: JokerStats; anishqa: JokerStats } = await res.json();
      setAnanyshreeStats((prev) => ({ ...prev, joker: data.ananyshree }));
      setAnishqaStats((prev)    => ({ ...prev, joker: data.anishqa }));
    } catch (err) {
      console.error("[useDashboardData] fetchJokers failed:", err);
    }
  }, []);

  const fetchRecommendations = useCallback(async () => {
    try {
      const res = await fetch("/api/jokers/recommendations", { cache: "no-store" });
      if (!res.ok) return;
      const data: JokerRecommendationItem[] = await res.json();
      setRecommendations(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("[useDashboardData] fetchRecommendations failed:", err);
    }
  }, []);

  const fetchRenewals = useCallback(async (queendom: "ananyshree" | "anishqa") => {
    try {
      const res = await fetch(`/api/renewals-panel?queendom=${queendom}`, {
        cache: "no-store",
      });
      if (!res.ok) return;
      const data: RenewalsPanelData = await res.json();
      if (queendom === "ananyshree") setRenewalsAnanyshree(data);
      else setRenewalsAnishqa(data);
    } catch (err) {
      console.error("[useDashboardData] fetchRenewals failed:", err);
    }
  }, []);

  const fetchAll = useCallback(
    () =>
      Promise.all([
        fetchTicketRows(),
        fetchMembers(),
        fetchJokers(),
        fetchRecommendations(),
        fetchRenewals("ananyshree"),
        fetchRenewals("anishqa"),
      ]),
    [fetchTicketRows, fetchMembers, fetchJokers, fetchRecommendations, fetchRenewals],
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

  // ── 5-minute IST month-rollover prune ────────────────────────────────────────
  // Drops rows whose created_at has rolled into the previous IST month without
  // requiring a page reload. Cleanup: clearInterval prevents accumulation on
  // React Strict Mode double-mount and component unmount.
  useEffect(() => {
    const id = window.setInterval(() => {
      setTicketRows((prev) => pruneTicketRowsForDashboardState(prev));
    }, 5 * 60_000);
    return () => clearInterval(id);
  }, []);

  // ── Supabase Realtime subscriptions ──────────────────────────────────────────
  // Four channels, one useEffect, one cleanup that removes all four.
  //
  // Channel map:
  //   dashboard-clients  → clients table  → refetch /api/clients
  //   dashboard-jokers   → jokers table   → optimistic patch + refetch /api/jokers
  //   dashboard-tickets  → tickets table  → optimistic patch ticketRows state
  //   dashboard-renewals → renewals+members tables → refetch /api/renewals-panel
  //
  // Dep array: [fetchJokers, fetchMembers, fetchRenewals]
  //   fetchTicketRows is intentionally absent — the tickets handler uses only
  //   setTicketRows functional updates and never calls the fetcher directly.
  useEffect(() => {
    if (!supabase) return;

    // ── Channel 1: clients ──────────────────────────────────────────────────
    const clientsChannel = supabase
      .channel("dashboard-clients")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "clients" },
        () => { fetchMembers(); },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED" && process.env.NODE_ENV === "development")
          console.info("[Realtime] dashboard-clients active");
      });

    // ── Channel 2: jokers ───────────────────────────────────────────────────
    const jokersChannel = supabase
      .channel("dashboard-jokers")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "jokers" },
        (payload) => {
          if (payload.eventType === "INSERT" && payload.new) {
            const r = payload.new as Record<string, unknown>;
            setRecommendations((prev) =>
              [
                {
                  id:         String(r.id ?? crypto.randomUUID()),
                  city:       ((r.city       as string) ?? "").trim() || "Unknown",
                  type:       ((r.type       as string) ?? "").trim() || "Experience",
                  suggestion: ((r.suggestion as string) ?? "").trim() || "—",
                },
                ...prev,
              ].slice(0, 15),
            );
          } else if (payload.eventType === "UPDATE" && payload.new) {
            const r  = payload.new as Record<string, unknown>;
            const id = String(r.id ?? "");
            if (!id) return;
            setRecommendations((prev) =>
              prev.map((x) =>
                x.id === id
                  ? {
                      id,
                      city:       ((r.city       as string) ?? "").trim() || "Unknown",
                      type:       ((r.type       as string) ?? "").trim() || "Experience",
                      suggestion: ((r.suggestion as string) ?? "").trim() || "—",
                    }
                  : x,
              ),
            );
          } else if (payload.eventType === "DELETE" && payload.old) {
            const id = String((payload.old as Record<string, unknown>).id ?? "");
            if (!id) return;
            setRecommendations((prev) => prev.filter((x) => x.id !== id));
          }
          // Always refetch aggregated Joker stats after any row change
          fetchJokers();
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED" && process.env.NODE_ENV === "development")
          console.info("[Realtime] dashboard-jokers active");
      });

    // ── Channel 3: tickets ──────────────────────────────────────────────────
    // All three event types use functional setTicketRows updates so this handler
    // never needs to capture fetchTicketRows — no stale-closure risk.
    const ticketsChannel = supabase
      .channel("dashboard-tickets")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tickets" },
        (payload) => {
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
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED" && process.env.NODE_ENV === "development")
          console.info("[Realtime] dashboard-tickets active");
      });

    // ── Channel 4: renewals + members (multiplexed on one channel) ──────────
    const renewalsChannel = supabase
      .channel("dashboard-renewals")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "renewals" },
        () => {
          fetchRenewals("ananyshree");
          fetchRenewals("anishqa");
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "members" },
        () => {
          fetchRenewals("ananyshree");
          fetchRenewals("anishqa");
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED" && process.env.NODE_ENV === "development")
          console.info("[Realtime] dashboard-renewals active");
      });

    // ── CLEANUP — removes all four channels on unmount / dep change ─────────
    // Using optional-chaining on supabase for safety even though we checked
    // above, matching the original pattern exactly.
    return () => {
      supabase?.removeChannel(clientsChannel);
      supabase?.removeChannel(jokersChannel);
      supabase?.removeChannel(ticketsChannel);
      supabase?.removeChannel(renewalsChannel);
    };
  }, [fetchJokers, fetchMembers, fetchRenewals]);
  // fetchTicketRows intentionally absent from deps — see comment above channel 3.

  return {
    ananyshreeStats,
    anishqaStats,
    recommendations,
    renewalsAnanyshree,
    renewalsAnishqa,
    isInitialLoading,
  };
}
