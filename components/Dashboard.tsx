"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import {
  buildRoster,
  ROSTER_ANANYSHREE,
  ROSTER_ANISHQA,
} from "@/lib/agentRoster";
import type {
  QueenStats,
  MemberStats,
  TicketStats,
  AgentStats,
  JokerStats,
} from "@/lib/types";
import type { TicketRowMinimal } from "@/lib/ticketAggregation";
import {
  aggregateTicketStats,
  mergeAndRankAgents,
} from "@/lib/ticketAggregation";
import type { JokerRecommendationItem } from "@/app/api/jokers/recommendations/route";
import TopBar from "./TopBar";
import DashboardController from "./DashboardController";
import CelebrationOverlay from "./CelebrationOverlay";
import RecommendationTicker from "./RecommendationTicker";

// ─────────────────────────────────────────────────────────────────────────────
// Fixed rosters — stats filled from ticket rows (initial load + Realtime patch)
// ─────────────────────────────────────────────────────────────────────────────
const AGENTS_ANANYSHREE = buildRoster(ROSTER_ANANYSHREE, "ananyshree");
const AGENTS_ANISHQA = buildRoster(ROSTER_ANISHQA, "anishqa");

// ─────────────────────────────────────────────────────────────────────────────
// Zero initial state — every counter animates up from 0 on first load
// ─────────────────────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────────────────
// API response shapes
// ─────────────────────────────────────────────────────────────────────────────
interface MemberApiResponse {
  ananyshree: MemberStats;
  anishqa: MemberStats;
}

interface RenewalsPanelData {
  totalRenewalsThisMonth: number;
  renewals: string[];
  assignments: string[];
}

// ── Normalize Realtime payload to TicketRowMinimal (id required for patch)
function toTicketRow(
  raw: Record<string, unknown> | null
): TicketRowMinimal | null {
  if (!raw) return null;
  const rawId = raw.id ?? raw.ticket_id;
  if (rawId == null) return null;

  // Supabase realtime payload can expose either `id` or `ticket_id`, and
  // IDs may be numeric depending on schema. Normalize to string for state keys.
  const id = String(rawId);
  if (!id) return null;

  return {
    id,
    status: (raw.status as string | null) ?? null,
    queendom_name: (raw.queendom_name as string | null) ?? null,
    agent_name: (raw.agent_name as string | null) ?? null,
    created_at: (raw.created_at as string | null) ?? null,
    resolved_at: (raw.resolved_at as string | null) ?? null,
    is_escalated: (raw.is_escalated as boolean | null) ?? null,
    tags: (raw.tags as Record<string, unknown> | null) ?? null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Dashboard — single source of truth; children receive data via props only
// ─────────────────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [ticketRows, setTicketRows] = useState<TicketRowMinimal[]>([]);
  const [ananyshreeStats, setAnanyshreeStats] =
    useState<QueenStats>(INIT_ANANYSHREE);
  const [anishqaStats, setAnishqaStats] = useState<QueenStats>(INIT_ANISHQA);
  const [recommendations, setRecommendations] = useState<
    JokerRecommendationItem[]
  >([]);
  const [renewalsAnanyshree, setRenewalsAnanyshree] =
    useState<RenewalsPanelData>({
      totalRenewalsThisMonth: 0,
      renewals: [],
      assignments: [],
    });
  const [renewalsAnishqa, setRenewalsAnishqa] = useState<RenewalsPanelData>({
    totalRenewalsThisMonth: 0,
    renewals: [],
    assignments: [],
  });
  const [celebrationAgent, setCelebrationAgent] = useState<string | null>(null);
  const prevScoresRef = useRef<Map<string, number>>(new Map());

  // Derive ticket + agent stats from ticket rows (no DB)
  useEffect(() => {
    if (ticketRows.length === 0) return;
    const ticketStats = aggregateTicketStats(ticketRows);
    const { ananyshree: agentsA, anishqa: agentsB } =
      mergeAndRankAgents(ticketRows);
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

  const fetchTicketRows = useCallback(async () => {
    try {
      const res = await fetch("/api/tickets/rows", { cache: "no-store" });
      if (!res.ok) return;
      const rows: TicketRowMinimal[] = await res.json();
      setTicketRows(Array.isArray(rows) ? rows : []);
    } catch (err) {
      console.error("[Dashboard] fetchTicketRows failed:", err);
    }
  }, []);

  const fetchMembers = useCallback(async () => {
    try {
      const res = await fetch("/api/clients", { cache: "no-store" });
      if (!res.ok) return;
      const data: MemberApiResponse = await res.json();
      setAnanyshreeStats((prev) => ({ ...prev, members: data.ananyshree }));
      setAnishqaStats((prev) => ({ ...prev, members: data.anishqa }));
    } catch (err) {
      console.error("[Dashboard] fetchMembers failed:", err);
    }
  }, []);

  const fetchJokers = useCallback(async () => {
    try {
      const res = await fetch("/api/jokers", { cache: "no-store" });
      if (!res.ok) return;
      const data: { ananyshree: JokerStats; anishqa: JokerStats } =
        await res.json();
      setAnanyshreeStats((prev) => ({ ...prev, joker: data.ananyshree }));
      setAnishqaStats((prev) => ({ ...prev, joker: data.anishqa }));
    } catch (err) {
      console.error("[Dashboard] fetchJokers failed:", err);
    }
  }, []);

  const fetchRecommendations = useCallback(async () => {
    try {
      const res = await fetch("/api/jokers/recommendations", {
        cache: "no-store",
      });
      if (!res.ok) return;
      const data: JokerRecommendationItem[] = await res.json();
      setRecommendations(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("[Dashboard] fetchRecommendations failed:", err);
    }
  }, []);

  const fetchRenewals = useCallback(
    async (queendom: "ananyshree" | "anishqa") => {
      try {
        const res = await fetch(
          `/api/renewals-panel?queendom=${queendom}`,
          { cache: "no-store" }
        );
        if (!res.ok) return;
        const data: RenewalsPanelData = await res.json();
        if (queendom === "ananyshree") setRenewalsAnanyshree(data);
        else setRenewalsAnishqa(data);
      } catch (err) {
        console.error("[Dashboard] fetchRenewals failed:", err);
      }
    },
    []
  );

  const fetchAll = useCallback(() => {
    return Promise.all([
      fetchTicketRows(),
      fetchMembers(),
      fetchJokers(),
      fetchRecommendations(),
      fetchRenewals("ananyshree"),
      fetchRenewals("anishqa"),
    ]);
  }, [
    fetchTicketRows,
    fetchMembers,
    fetchJokers,
    fetchRecommendations,
    fetchRenewals,
  ]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Realtime: optimistic patch only; no polling — subscriptions are the source of truth
  useEffect(() => {
    if (!supabase) return;

    const clientsChannel = supabase
      .channel("dashboard-clients")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "clients" },
        () => {
          fetchMembers();
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED")
          console.info("[Realtime] dashboard-clients active");
      });

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
                  id: String(r.id ?? crypto.randomUUID()),
                  city: ((r.city as string) ?? "").trim() || "Unknown",
                  type: ((r.type as string) ?? "").trim() || "Experience",
                  suggestion:
                    ((r.suggestion as string) ?? "").trim() || "—",
                },
                ...prev,
              ].slice(0, 15)
            );
          } else if (payload.eventType === "UPDATE" && payload.new) {
            const r = payload.new as Record<string, unknown>;
            const id = String(r.id ?? "");
            if (!id) return;
            setRecommendations((prev) =>
              prev.map((x) =>
                x.id === id
                  ? {
                      id,
                      city:
                        ((r.city as string) ?? "").trim() || "Unknown",
                      type:
                        ((r.type as string) ?? "").trim() || "Experience",
                      suggestion:
                        ((r.suggestion as string) ?? "").trim() || "—",
                    }
                  : x
              )
            );
          } else if (payload.eventType === "DELETE" && payload.old) {
            const id = String((payload.old as Record<string, unknown>).id ?? "");
            if (!id) return;
            setRecommendations((prev) => prev.filter((x) => x.id !== id));
          }
          fetchJokers();
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED")
          console.info("[Realtime] dashboard-jokers active");
      });

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
                const i = prev.findIndex((r) => r.id === row.id);
                if (i >= 0) {
                  const next = [...prev];
                  next[i] = row;
                  return next;
                }
                return [...prev, row];
              });
          } else if (payload.eventType === "UPDATE" && payload.new) {
            const row = toTicketRow(payload.new as Record<string, unknown>);
            if (row)
              setTicketRows((prev) =>
                prev.map((r) => (r.id === row.id ? row : r))
              );
          } else if (payload.eventType === "DELETE" && payload.old) {
            const oldRow = toTicketRow(payload.old as Record<string, unknown>);
            if (oldRow) {
              setTicketRows((prev) => prev.filter((r) => r.id !== oldRow.id));
            }
          }
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED")
          console.info("[Realtime] dashboard-tickets active");
      });

    const renewalsChannel = supabase
      .channel("dashboard-renewals")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "renewals" },
        () => {
          fetchRenewals("ananyshree");
          fetchRenewals("anishqa");
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "members" },
        () => {
          fetchRenewals("ananyshree");
          fetchRenewals("anishqa");
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED")
          console.info("[Realtime] dashboard-renewals active");
      });

    return () => {
      supabase?.removeChannel(clientsChannel);
      supabase?.removeChannel(jokersChannel);
      supabase?.removeChannel(ticketsChannel);
      supabase?.removeChannel(renewalsChannel);
    };
  }, [fetchJokers, fetchMembers, fetchRenewals]);

  // ── Celebration detection ────────────────────────────────────────────────────
  // Runs whenever either queendom's agents array is updated.
  // Compares each agent's completedToday against the previously stored value.
  // The first call (empty map) just seeds the map — no celebration fires.
  useEffect(() => {
    const allCurrent = [...ananyshreeStats.agents, ...anishqaStats.agents];

    const prevMap = prevScoresRef.current;
    const isInitialSeed = prevMap.size === 0;
    let celebCandidate: string | null = null;

    if (!isInitialSeed) {
      for (const agent of allCurrent) {
        const prev = prevMap.get(agent.name) ?? 0;
        if (agent.tasksCompletedToday > prev) {
          celebCandidate = agent.name;
          break;
        }
      }
    }

    // Always update the map with latest values
    for (const agent of allCurrent) {
      prevMap.set(agent.name, agent.tasksCompletedToday);
    }

    // Only trigger if no celebration is already running — avoids stacking
    if (celebCandidate && !celebrationAgent) {
      setCelebrationAgent(celebCandidate);
    }
    // celebrationAgent intentionally omitted: we only want to react to
    // agent score changes, not to the celebration state itself
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ananyshreeStats.agents, anishqaStats.agents]);

  // ───────────────────────────────────────────────────────────────────────────
  return (
    <div className="relative flex flex-col w-full min-h-screen md:w-screen md:h-screen bg-obsidian overflow-auto md:overflow-hidden">
      {/* Full-screen ambient radial glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 55% 45% at 50% 42%, rgba(201,168,76,0.045), transparent)",
        }}
      />

      <TopBar />

      {/* ── Hero celebration overlay ── */}
      <CelebrationOverlay
        agentName={celebrationAgent}
        onComplete={() => setCelebrationAgent(null)}
      />

      {/* ── Concierge ↔ Onboarding (manual only; ArrowLeft/ArrowRight) — flex-1 fills viewport under TopBar + ticker ── */}
      <DashboardController
        className="min-h-0"
        ananyshreeStats={ananyshreeStats}
        anishqaStats={anishqaStats}
        renewalsAnanyshree={renewalsAnanyshree}
        renewalsAnishqa={renewalsAnishqa}
        celebrationAgent={celebrationAgent}
      />

      {/* Ticker: Recommendation bar — data from Dashboard only */}
      <RecommendationTicker recommendations={recommendations} />
    </div>
  );
}
