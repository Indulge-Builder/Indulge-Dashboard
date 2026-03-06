"use client";

import { useEffect, useState, useCallback } from "react";
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
  solvedThisMonth: 0,
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

      {/* ── Two panels fill all remaining height ── */}
      <div className="relative flex flex-1 min-h-0">
        <QueendomPanel
          name="Ananyshree"
          stats={ananyshreeStats}
          side="left"
          delay={0}
        />

        {/* Gold centre divider */}
        <motion.div
          className="relative flex-shrink-0 flex items-center justify-center"
          style={{ width: 1 }}
          initial={{ scaleY: 0, opacity: 0 }}
          animate={{ scaleY: 1, opacity: 1 }}
          transition={{
            duration: 1.1,
            delay: 0.4,
            ease: [0.25, 0.46, 0.45, 0.94],
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-gold-500/30 to-transparent" />
          <motion.div
            className="relative w-[7px] h-[7px] rounded-full bg-gold-500/70 flex-shrink-0 z-10"
            style={{ boxShadow: "0 0 12px 3px rgba(201,168,76,0.55)" }}
            animate={{ opacity: [0.7, 1, 0.7] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          />
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
