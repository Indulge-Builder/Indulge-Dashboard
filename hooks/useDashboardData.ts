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

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchJson } from "@/lib/clientFetch";
import { useRealtimeChannel } from "@/hooks/useRealtimeChannel";
import {
  buildRoster,
  FALLBACK_ROSTER,
  ROSTER_ANANYSHREE,
  ROSTER_ANISHQA,
  type RosterSnapshot,
} from "@/lib/agentRoster";
import type { QueenStats, MemberStats, TicketStats, JokerStats } from "@/lib/types";
import type { TicketRowMinimal } from "@/lib/ticketAggregation";
import {
  aggregateTicketStats,
  isPrunedWhenTerminal,
  mergeAndRankAgents,
  pruneTicketRowsForDashboardState,
} from "@/lib/ticketAggregation";
import { buildTicketTimeSeries, resolutionEventMs } from "@/lib/ticketTimeSeries";
import type {
  OverdueTicketItem,
  RenewalsPanelData,
  MemberApiResponse,
  RenewalsDueResponse,
  QueendomId,
} from "@/types";

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

// Initial rosters — the hardcoded fallback, shown for the split second before
// GET /api/roster resolves. Stats fill in from ticket rows after that fetch.
const AGENTS_ANANYSHREE = buildRoster(ROSTER_ANANYSHREE, "ananyshree");
const AGENTS_ANISHQA = buildRoster(ROSTER_ANISHQA, "anishqa");

const INIT_ANANYSHREE: QueenStats = {
  members: ZERO_MEMBERS,
  tickets: ZERO_TICKETS,
  agents: AGENTS_ANANYSHREE,
  joker: ZERO_JOKER,
  lastResolvedAtMs: null,
  renewalsDue: [],
};

const INIT_ANISHQA: QueenStats = {
  members: ZERO_MEMBERS,
  tickets: ZERO_TICKETS,
  agents: AGENTS_ANISHQA,
  joker: ZERO_JOKER,
  lastResolvedAtMs: null,
  renewalsDue: [],
};

/**
 * Max of two nullable stopwatch-anchor candidates (rows-derived vs pruned
 * ledger). NOT a monotonic accumulator against previous state — the anchor is
 * fully re-derived on every change so a resolution that gets reverted stops
 * counting (see the anti-cheat note on the aggregation effect below).
 */
function maxResolvedMs(
  a: number | null | undefined,
  b: number | null | undefined,
): number | null {
  if (a == null) return b ?? null;
  if (b == null) return a;
  return Math.max(a, b);
}

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
  // Live roster from the editable `agents` table. Starts as the hardcoded
  // fallback so the leaderboard renders immediately and never blanks if
  // /api/roster is slow or down.
  const [roster,             setRoster]             = useState<RosterSnapshot>(FALLBACK_ROSTER);
  // Whether the roster actually came from the `agents` table. Gates the
  // dashboard-agents Realtime channel — subscribing to a table that doesn't
  // exist yet would CHANNEL_ERROR and retry every 3s forever.
  const [hasAgentsTable,     setHasAgentsTable]     = useState(false);
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

  // ── Stopwatch ledger for resolutions the prune filter drops ─────────────────
  // A backlog ticket (created in an earlier IST month) that turns terminal is
  // pruned from ticketRows in the same update, so the rows-derived anchor
  // below never sees it. Its resolution is remembered here instead — keyed by
  // ticket id so a later event showing that ticket NON-terminal again revokes
  // the entry. The version counter re-runs the aggregation effect on ledger
  // changes that don't touch ticketRows.
  const prunedResolutionsRef = useRef(
    new Map<string, NonNullable<ReturnType<typeof resolutionEventMs>>>(),
  );
  const [prunedResolutionsVersion, setPrunedResolutionsVersion] = useState(0);

  // ── Derive ticket + agent stats whenever ticketRows changes ─────────────────
  // Aggregation is pure and runs only when ticketRows reference changes.
  // All math is delegated to lib/ticketAggregation — NOT modified here.
  //
  // Anti-cheat (2026-07-16): lastResolvedAtMs is fully RE-DERIVED here — max
  // resolved_at over rows that are terminal RIGHT NOW, plus the revocable
  // pruned-backlog ledger. It is deliberately not a monotonic max against
  // previous state: agents were resetting the ResolveStopwatch by flipping a
  // ticket to resolved and straight back. Now the revert removes the ticket
  // from both sources and the anchor falls back to the last genuine
  // resolution, so the timer jumps back up.
  useEffect(() => {
    const ticketStats = aggregateTicketStats(ticketRows);
    const { ananyshree: agentsA, anishqa: agentsB } = mergeAndRankAgents(
      ticketRows,
      roster,
    );
    const series = buildTicketTimeSeries(ticketRows);
    const ledgerMax: Record<QueendomId, number | null> = {
      ananyshree: null,
      anishqa: null,
    };
    for (const entry of prunedResolutionsRef.current.values()) {
      ledgerMax[entry.queendom] = maxResolvedMs(ledgerMax[entry.queendom], entry.ms);
    }
    setAnanyshreeStats((prev) => ({
      ...prev,
      tickets: ticketStats.ananyshree,
      agents: agentsA,
      series: series.ananyshree,
      lastResolvedAtMs: maxResolvedMs(series.ananyshree.lastResolvedMs, ledgerMax.ananyshree),
    }));
    setAnishqaStats((prev) => ({
      ...prev,
      tickets: ticketStats.anishqa,
      agents: agentsB,
      series: series.anishqa,
      lastResolvedAtMs: maxResolvedMs(series.anishqa.lastResolvedMs, ledgerMax.anishqa),
    }));
  }, [ticketRows, prunedResolutionsVersion, roster]);

  // ── Fetchers (all stable — empty dep arrays) ────────────────────────────────

  /**
   * Roster fetch. /api/roster already falls back to the hardcoded arrays
   * server-side, so a 200 is always usable; a null (network failure) leaves
   * whatever roster is currently in state untouched.
   */
  const fetchRoster = useCallback(async () => {
    const data = await fetchJson<RosterSnapshot & { source?: string }>("/api/roster");
    if (data === null || !Array.isArray(data.ananyshree)) return;
    setRoster({
      ananyshree: data.ananyshree,
      anishqa: data.anishqa ?? [],
      jokers: data.jokers ?? [],
    });
    setHasAgentsTable(data.source === "agents-table");
  }, []);

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

  const fetchRenewalsDue = useCallback(async () => {
    const data = await fetchJson<RenewalsDueResponse>("/api/clients/expiring");
    if (data === null) return;
    setAnanyshreeStats((prev) => ({ ...prev, renewalsDue: data.ananyshree ?? [] }));
    setAnishqaStats((prev)    => ({ ...prev, renewalsDue: data.anishqa ?? [] }));
  }, []);

  /**
   * ResolveStopwatch ledger bookkeeping, called on every ticket INSERT/UPDATE
   * event. Records the resolution of a ticket the prune filter is about to
   * drop (backlog ticket from an earlier month turning terminal — dry-audit
   * D2), and REVOKES the entry when the same ticket is seen non-terminal
   * again, so a resolve-then-revert never leaves a phantom anchor behind.
   * Current-month resolutions need no entry — they stay in ticketRows and the
   * aggregation effect derives them directly.
   */
  const noteResolutionEvent = useCallback((row: TicketRowMinimal) => {
    const ledger = prunedResolutionsRef.current;
    const resolution = resolutionEventMs(row);
    let changed: boolean;
    if (resolution && isPrunedWhenTerminal(row)) {
      const prev = ledger.get(row.id);
      changed = prev?.ms !== resolution.ms || prev?.queendom !== resolution.queendom;
      if (changed) ledger.set(row.id, resolution);
    } else {
      changed = ledger.delete(row.id);
    }
    if (changed) setPrunedResolutionsVersion((v) => v + 1);
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
        fetchRoster(),
        fetchTicketRows(),
        fetchMembers(),
        fetchRenewalsDue(),
        fetchJokers(),
        fetchOverdueTickets(),
        fetchRenewals("ananyshree"),
        fetchRenewals("anishqa"),
      ]),
    [fetchRoster, fetchTicketRows, fetchMembers, fetchRenewalsDue, fetchJokers, fetchOverdueTickets, fetchRenewals],
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
  // if the network is down so a month rollover still drops last month's resolved
  // rows — open backlog rows survive it (D2 revised: Pending carries forward).
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
  //   dashboard-clients  → clients table  → refetch /api/clients + /api/clients/expiring
  //   dashboard-jokers   → jokers table   → ticker patch + stats refetch
  //   dashboard-tickets  → tickets table  → optimistic patch ticketRows state
  //   dashboard-renewals → renewals+members tables → refetch /api/renewals-panel
  //   dashboard-agents   → agents table   → refetch /api/roster + /api/jokers

  // Roster edits made in /settings land on the TV without a reload. The Joker
  // stats are refetched too because which name each queendom's Joker metrics
  // aggregate over is itself a roster field.
  useRealtimeChannel(
    "dashboard-agents",
    [
      { table: "agents", handler: () => { fetchRoster(); } },
      { table: "agents", handler: () => { fetchJokers(); } },
    ],
    () => {
      fetchRoster();
      fetchJokers();
    },
    // Only once /api/roster confirms the table is really there. Until then the
    // 5-minute poll still picks up roster changes.
    hasAgentsTable,
  );

  // Two handlers (dry-audit C5 pattern): member counts and the renewals-due
  // list both live in the clients table but come from different routes.
  useRealtimeChannel(
    "dashboard-clients",
    [
      { table: "clients", handler: () => { fetchMembers(); } },
      { table: "clients", handler: () => { fetchRenewalsDue(); } },
    ],
    () => {
      fetchMembers();
      fetchRenewalsDue();
    },
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
            if (row) {
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
              noteResolutionEvent(row);
            }
          } else if (payload.eventType === "UPDATE" && payload.new) {
            const row = toTicketRow(payload.new as Record<string, unknown>);
            if (row) {
              setTicketRows((prev) =>
                pruneTicketRowsForDashboardState(
                  prev.map((r) => (r.id === row.id ? row : r)),
                ),
              );
              noteResolutionEvent(row);
            }
          } else if (payload.eventType === "DELETE" && payload.old) {
            const oldRow = toTicketRow(payload.old as Record<string, unknown>);
            if (oldRow) {
              setTicketRows((prev) => prev.filter((r) => r.id !== oldRow.id));
              // A hard-deleted ticket's resolution can't anchor the stopwatch.
              if (prunedResolutionsRef.current.delete(oldRow.id))
                setPrunedResolutionsVersion((v) => v + 1);
            }
          }
        },
      },
      // Second handler (dry-audit C5 pattern): the overdue ticker reads the
      // escalated set straight from /api/tickets/overdue — it needs the
      // `subject` column, which the minimal ticketRows state doesn't carry.
      // Any tickets change — escalation flip, status change, delete — refetches it.
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
