"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/lib/supabase";
import type { QueenStats, MemberStats, TicketStats } from "@/lib/types";
import TopBar from "./TopBar";
import QueendomPanel from "./QueendomPanel";

// ─────────────────────────────────────────────────────────────────────────────
// Zero initial state — every counter animates up from 0 on first load
// ─────────────────────────────────────────────────────────────────────────────
const ZERO_MEMBERS: MemberStats = { total: 0, yearly: 0, monthly: 0 };
const ZERO_TICKETS: TicketStats = {
  totalThisMonth: 0,
  solvedThisMonth: 0,
  solvedToday: 0,
  pendingToResolve: 0,
};

const INIT: QueenStats = { members: ZERO_MEMBERS, tickets: ZERO_TICKETS };

// ─────────────────────────────────────────────────────────────────────────────
// Response shapes returned by our two API routes
// ─────────────────────────────────────────────────────────────────────────────
interface MemberApiResponse {
  ananyshree: MemberStats;
  anishqa: MemberStats;
}

interface TicketApiResponse {
  ananyshree: TicketStats;
  anishqa: TicketStats;
}

// ─────────────────────────────────────────────────────────────────────────────
// Dashboard
// ─────────────────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [ananyshreeStats, setAnanyshreeStats] = useState<QueenStats>(INIT);
  const [anishqaStats, setAnishqaStats] = useState<QueenStats>(INIT);

  // ── Member fetch (calls /api/clients, service-role key, bypasses RLS) ───────
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

  // ── Ticket fetch (calls /api/tickets, aggregates active/solved metrics) ──────
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

  // ── Fetch both in parallel ───────────────────────────────────────────────────
  const fetchAll = useCallback(
    () => Promise.all([fetchMembers(), fetchTickets()]),
    [fetchMembers, fetchTickets],
  );

  // ── Initial load ────────────────────────────────────────────────────────────
  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // ── 20-second polling (guaranteed refresh regardless of realtime status) ────
  useEffect(() => {
    const id = setInterval(fetchAll, 20_000);
    return () => clearInterval(id);
  }, [fetchAll]);

  // ── Supabase Realtime subscriptions ─────────────────────────────────────────
  // Two separate channels so each table change triggers only the relevant fetch.
  // These fire instantly when a row changes — no waiting for the 20-s poll.
  // (If the anon key lacks a SELECT policy on a table, the subscription silently
  //  does nothing and the 20-s poll acts as the fallback.)
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
        () => fetchTickets(),
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED")
          console.info("[Realtime] tickets-channel active");
      });

    return () => {
      supabase?.removeChannel(clientsChannel);
      supabase?.removeChannel(ticketsChannel);
    };
  }, [fetchMembers, fetchTickets]);

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
