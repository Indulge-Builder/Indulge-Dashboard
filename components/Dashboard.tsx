"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { motion } from "framer-motion";
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
} from "@/lib/types";
import TopBar from "./TopBar";
import QueendomPanel from "./QueendomPanel";
import CelebrationOverlay from "./CelebrationOverlay";

// ─────────────────────────────────────────────────────────────────────────────
// Fixed rosters — all stats start at 0 and are filled in by /api/agents
// ─────────────────────────────────────────────────────────────────────────────
const AGENTS_ANANYSHREE = buildRoster(ROSTER_ANANYSHREE, "ananyshree");
const AGENTS_ANISHQA = buildRoster(ROSTER_ANISHQA, "anishqa");

// ─────────────────────────────────────────────────────────────────────────────
// Zero initial state — every counter animates up from 0 on first load
// ─────────────────────────────────────────────────────────────────────────────
const ZERO_MEMBERS: MemberStats = { total: 0 };
const ZERO_TICKETS: TicketStats = {
  totalThisMonth: 0,
  solvedToday: 0,
  pendingToResolve: 0,
};

const INIT_ANANYSHREE: QueenStats = {
  members: ZERO_MEMBERS,
  tickets: ZERO_TICKETS,
  agents: AGENTS_ANANYSHREE,
};
const INIT_ANISHQA: QueenStats = {
  members: ZERO_MEMBERS,
  tickets: ZERO_TICKETS,
  agents: AGENTS_ANISHQA,
};

// ─────────────────────────────────────────────────────────────────────────────
// API response shapes
// ─────────────────────────────────────────────────────────────────────────────
interface MemberApiResponse {
  ananyshree: MemberStats;
  anishqa: MemberStats;
}

interface TicketApiResponse {
  ananyshree: TicketStats;
  anishqa: TicketStats;
}

// Per-agent live stats keyed by agent name
interface AgentLiveStats {
  tasksAssignedToday: number;
  tasksCompletedToday: number;
  tasksCompletedThisMonth: number;
}

interface AgentApiResponse {
  ananyshree: Record<string, AgentLiveStats>;
  anishqa: Record<string, AgentLiveStats>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Merges live stats into a roster, preserving order.
// Agents not present in the API response keep their current values (stay at 0
// on first render, then hold last-known values on partial updates).
// After merging, sort descending by completedToday → thisMonth so the
// best performer always floats to the top of the leaderboard.
// ─────────────────────────────────────────────────────────────────────────────
function mergeAndRank(
  roster: AgentStats[],
  live: Record<string, AgentLiveStats>,
): AgentStats[] {
  // Build a lowercase index of the live data so the lookup is case-insensitive.
  // The API returns canonical names but this guards against any future drift.
  const liveCI: Record<string, AgentLiveStats> = {};
  for (const [key, val] of Object.entries(live)) {
    liveCI[key.toLowerCase()] = val;
  }

  const merged = roster.map((agent) => {
    const stats = liveCI[agent.name.toLowerCase()];
    return stats ? { ...agent, ...stats } : agent;
  });

  return merged.sort(
    (a, b) =>
      b.tasksCompletedToday - a.tasksCompletedToday ||
      b.tasksCompletedThisMonth - a.tasksCompletedThisMonth,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Dashboard
// ─────────────────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [ananyshreeStats, setAnanyshreeStats] =
    useState<QueenStats>(INIT_ANANYSHREE);
  const [anishqaStats, setAnishqaStats] = useState<QueenStats>(INIT_ANISHQA);

  // ── Celebration state ────────────────────────────────────────────────────────
  const [celebrationAgent, setCelebrationAgent] = useState<string | null>(null);

  // Tracks the last known completedToday score per agent (keyed by name).
  // On the very first population (map is empty) we store values without
  // triggering a celebration — this prevents false positives on page load.
  const prevScoresRef = useRef<Map<string, number>>(new Map());

  // ── /api/clients — active member counts ─────────────────────────────────────
  const fetchMembers = useCallback(async () => {
    try {
      const res = await fetch("/api/clients", { cache: "no-store" });
      if (!res.ok) {
        console.error("[Dashboard] /api/clients →", res.status, res.statusText);
        return;
      }
      const data: MemberApiResponse = await res.json();
      setAnanyshreeStats((prev) => ({ ...prev, members: data.ananyshree }));
      setAnishqaStats((prev) => ({ ...prev, members: data.anishqa }));
    } catch (err) {
      console.error("[Dashboard] fetchMembers failed:", err);
    }
  }, []);

  // ── /api/tickets — queendom-level ticket metrics ─────────────────────────────
  const fetchTickets = useCallback(async () => {
    try {
      const res = await fetch("/api/tickets", { cache: "no-store" });
      if (!res.ok) {
        console.error("[Dashboard] /api/tickets →", res.status, res.statusText);
        return;
      }
      const data: TicketApiResponse = await res.json();
      setAnanyshreeStats((prev) => ({ ...prev, tickets: data.ananyshree }));
      setAnishqaStats((prev) => ({ ...prev, tickets: data.anishqa }));
    } catch (err) {
      console.error("[Dashboard] fetchTickets failed:", err);
    }
  }, []);

  // ── /api/agents — per-agent stats; merges into roster & re-ranks ────────────
  const fetchAgents = useCallback(async () => {
    try {
      const res = await fetch("/api/agents", { cache: "no-store" });
      if (!res.ok) {
        console.error("[Dashboard] /api/agents →", res.status, res.statusText);
        return;
      }
      const data: AgentApiResponse = await res.json();

      setAnanyshreeStats((prev) => ({
        ...prev,
        agents: mergeAndRank(prev.agents, data.ananyshree),
      }));
      setAnishqaStats((prev) => ({
        ...prev,
        agents: mergeAndRank(prev.agents, data.anishqa),
      }));
    } catch (err) {
      console.error("[Dashboard] fetchAgents failed:", err);
    }
  }, []);

  // ── Fetch everything in parallel ─────────────────────────────────────────────
  const fetchAll = useCallback(
    () => Promise.all([fetchMembers(), fetchTickets(), fetchAgents()]),
    [fetchMembers, fetchTickets, fetchAgents],
  );

  // ── Initial load ─────────────────────────────────────────────────────────────
  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // ── 20-second polling fallback ───────────────────────────────────────────────
  useEffect(() => {
    const id = setInterval(fetchAll, 20_000);
    return () => clearInterval(id);
  }, [fetchAll]);

  // ── Supabase Realtime subscriptions ─────────────────────────────────────────
  // clients table  → refresh member counts
  // tickets table  → refresh both queendom-level stats AND per-agent stats
  useEffect(() => {
    if (!supabase) return;

    const clientsChannel = supabase
      .channel("clients-channel")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "clients" },
        () => fetchMembers(),
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED")
          console.info("[Realtime] clients-channel active");
      });

    const ticketsChannel = supabase
      .channel("tickets-channel")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tickets" },
        // Single ticket change → refresh both queendom totals and per-agent rings
        () => {
          fetchTickets();
          fetchAgents();
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED")
          console.info("[Realtime] tickets-channel active");
      });

    return () => {
      supabase?.removeChannel(clientsChannel);
      supabase?.removeChannel(ticketsChannel);
    };
  }, [fetchMembers, fetchTickets, fetchAgents]);

  // ── Celebration detection ────────────────────────────────────────────────────
  // Runs whenever either queendom's agents array is updated.
  // Compares each agent's completedToday against the previously stored value.
  // The first call (empty map) just seeds the map — no celebration fires.
  useEffect(() => {
    const allCurrent = [
      ...ananyshreeStats.agents,
      ...anishqaStats.agents,
    ];

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
    <div className="relative flex flex-col w-screen h-screen bg-[#040302] overflow-hidden">
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

      {/* ── Two panels fill all remaining height ── */}
      <div className="relative flex flex-1 min-h-0">
        <QueendomPanel
          name="Ananyshree"
          stats={ananyshreeStats}
          side="left"
          delay={0}
        />

        {/* ── Gold centre divider ─────────────────────────────────────────── */}
        <motion.div
          className="relative flex-shrink-0 flex flex-col items-center justify-center"
          style={{ width: "36px" }}
          initial={{ scaleY: 0, opacity: 0 }}
          animate={{ scaleY: 1, opacity: 1 }}
          transition={{
            duration: 1.3,
            delay: 0.5,
            ease: [0.25, 0.46, 0.45, 0.94],
          }}
        >
          {/* Faint ambient wash — barely perceptible, just warms the seam */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "radial-gradient(ellipse 160% 50% at 50% 50%, rgba(201,168,76,0.032), transparent)",
            }}
          />

          {/* The hairline */}
          <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-px bg-gradient-to-b from-transparent via-gold-500/[0.22] to-transparent" />

          {/* Barely-there inner bloom — blends into background */}
          <div
            className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-[4px] pointer-events-none"
            style={{
              background:
                "linear-gradient(to bottom, transparent 8%, rgba(201,168,76,0.07) 30%, rgba(201,168,76,0.11) 50%, rgba(201,168,76,0.07) 70%, transparent 92%)",
              filter: "blur(2px)",
            }}
          />

          {/* Ornament cluster — very quiet, slow breath */}
          <motion.div
            className="relative z-10 flex flex-col items-center"
            style={{ gap: "9px" }}
            animate={{ opacity: [0.35, 0.65, 0.35] }}
            transition={{
              duration: 5.5,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          >
            {/* Top pip */}
            <div
              className="w-[4px] h-[4px] bg-gold-400/35 flex-shrink-0"
              style={{ transform: "rotate(45deg)" }}
            />

            {/* Centre orb */}
            <motion.div
              className="w-[8px] h-[8px] rounded-full flex-shrink-0"
              style={{
                background: "rgba(201,168,76,0.75)",
                boxShadow:
                  "0 0 0 1px rgba(201,168,76,0.15), 0 0 8px 2px rgba(201,168,76,0.20)",
              }}
              animate={{ scale: [1, 1.08, 1] }}
              transition={{
                duration: 5.5,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />

            {/* Bottom pip */}
            <div
              className="w-[4px] h-[4px] bg-gold-400/35 flex-shrink-0"
              style={{ transform: "rotate(45deg)" }}
            />
          </motion.div>
        </motion.div>

        <QueendomPanel
          name="Anishqa"
          stats={anishqaStats}
          side="right"
          delay={150}
        />
      </div>
    </div>
  );
}
