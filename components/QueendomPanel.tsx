"use client";

import { motion } from "framer-motion";
import { CheckCircle, CalendarDays, Clock, TrendingUp, AlertTriangle } from "lucide-react";
import AnimatedCounter from "./AnimatedCounter";
import GoldPill from "./GoldPill";
import AgentLeaderboard from "./AgentLeaderboard";
import type { QueenStats, TicketStats } from "@/lib/types";

// ── Shared animation tokens ───────────────────────────────────────────────────
const itemVariants = {
  hidden: { opacity: 0, y: 22 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] },
  },
};

const containerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.12, delayChildren: 0.15 },
  },
};

// ── Modal 1 — Daily "Today's Pulse" ──────────────────────────────────────────
// Layout: hero Solved Today (emerald, largest) | Received Today | Pending
// Hierarchy enforced via descending font sizes left → right.
function DailyModal({ tickets, delay }: { tickets: TicketStats; delay: number }) {
  return (
    <div className="glass gold-border-glow rounded-2xl relative overflow-hidden flex flex-col"
      style={{ padding: "1.1vh clamp(10px, 1.8vw, 24px)" }}>
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/[0.04] to-transparent pointer-events-none rounded-2xl" />

      {/* Eyebrow */}
      <p className="font-inter text-[clamp(8px,0.68vw,10px)] tracking-[0.65em] uppercase text-gold-500/35 mb-[0.55vh] text-center relative z-10 flex-shrink-0">
        Today&apos;s Pulse
      </p>

      {/* 3-column metric row */}
      <div className="grid grid-cols-3 divide-x divide-gold-500/[0.09] flex-1 relative z-10">

        {/* Metric A — Solved Today (HERO, emerald) */}
        <div className="flex flex-col items-center justify-center text-center px-[0.8vw]">
          <div className="flex items-center gap-1 mb-[0.3vh]">
            <CheckCircle
              className="text-emerald-400/65 flex-shrink-0"
              style={{ width: "clamp(9px,0.9vw,13px)", height: "clamp(9px,0.9vw,13px)" }}
            />
            <span className="font-inter text-[clamp(8px,0.68vw,10px)] tracking-[0.45em] uppercase text-emerald-400/65">
              Solved
            </span>
          </div>
          <AnimatedCounter
            value={tickets.solvedToday}
            className="font-edu text-[clamp(1.9rem,3.4vw,4.6rem)] leading-none tabular-nums text-emerald-400 emerald-glow-hero"
            delay={delay + 800}
          />
        </div>

        {/* Metric B — Received Today (silver/white) */}
        <div className="flex flex-col items-center justify-center text-center px-[0.8vw]">
          <div className="flex items-center gap-1 mb-[0.3vh]">
            <CalendarDays
              className="text-white/35 flex-shrink-0"
              style={{ width: "clamp(9px,0.9vw,13px)", height: "clamp(9px,0.9vw,13px)" }}
            />
            <span className="font-inter text-[clamp(8px,0.68vw,10px)] tracking-[0.45em] uppercase text-white/35">
              Received
            </span>
          </div>
          <AnimatedCounter
            value={tickets.receivedToday}
            className="font-edu text-[clamp(1.5rem,2.6vw,3.6rem)] leading-none tabular-nums text-white/80"
            delay={delay + 960}
          />
        </div>

        {/* Metric C — Pending (muted, 45% white) */}
        <div className="flex flex-col items-center justify-center text-center px-[0.8vw]">
          <div className="flex items-center gap-1 mb-[0.3vh]">
            <Clock
              className="text-white/28 flex-shrink-0"
              style={{ width: "clamp(9px,0.9vw,13px)", height: "clamp(9px,0.9vw,13px)" }}
            />
            <span className="font-inter text-[clamp(8px,0.68vw,10px)] tracking-[0.45em] uppercase text-white/28">
              Pending
            </span>
          </div>
          <AnimatedCounter
            value={tickets.pendingToResolve}
            className="font-edu text-[clamp(1.3rem,2.2vw,3rem)] leading-none tabular-nums text-white/45"
            delay={delay + 1100}
          />
        </div>
      </div>
    </div>
  );
}

// ── Modal 2 — Monthly "Long-term Pulse" ──────────────────────────────────────
// Layout: hero Resolved This Month (gold, largest) | Received This Month | Overdue
// Overdue uses a muted amber/burnt-orange accent (#d97706 / amber-600).
function MonthlyModal({ tickets, delay }: { tickets: TicketStats; delay: number }) {
  return (
    <div className="glass gold-border-glow rounded-2xl relative overflow-hidden flex flex-col"
      style={{ padding: "1.1vh clamp(10px, 1.8vw, 24px)" }}>
      <div className="absolute inset-0 bg-gradient-to-br from-gold-500/[0.04] to-transparent pointer-events-none rounded-2xl" />

      {/* Eyebrow */}
      <p className="font-inter text-[clamp(8px,0.68vw,10px)] tracking-[0.65em] uppercase text-gold-500/35 mb-[0.55vh] text-center relative z-10 flex-shrink-0">
        Monthly Performance
      </p>

      {/* 3-column metric row */}
      <div className="grid grid-cols-3 divide-x divide-gold-500/[0.09] flex-1 relative z-10">

        {/* Metric A — Resolved This Month (HERO, warm gold) */}
        <div className="flex flex-col items-center justify-center text-center px-[0.8vw]">
          <div className="flex items-center gap-1 mb-[0.3vh]">
            <TrendingUp
              className="text-gold-400/70 flex-shrink-0"
              style={{ width: "clamp(9px,0.9vw,13px)", height: "clamp(9px,0.9vw,13px)" }}
            />
            <span className="font-inter text-[clamp(8px,0.68vw,10px)] tracking-[0.45em] uppercase text-gold-400/65">
              Resolved
            </span>
          </div>
          <AnimatedCounter
            value={tickets.resolvedThisMonth}
            className="font-edu text-[clamp(1.9rem,3.4vw,4.6rem)] leading-none tabular-nums text-gold-400"
            delay={delay + 850}
          />
        </div>

        {/* Metric B — Received This Month (champagne/silver) */}
        <div className="flex flex-col items-center justify-center text-center px-[0.8vw]">
          <div className="flex items-center gap-1 mb-[0.3vh]">
            <CalendarDays
              className="text-champagne/35 flex-shrink-0"
              style={{ width: "clamp(9px,0.9vw,13px)", height: "clamp(9px,0.9vw,13px)" }}
            />
            <span className="font-inter text-[clamp(8px,0.68vw,10px)] tracking-[0.45em] uppercase text-champagne/35">
              Received
            </span>
          </div>
          <AnimatedCounter
            value={tickets.totalThisMonth}
            className="font-edu text-[clamp(1.5rem,2.6vw,3.6rem)] leading-none tabular-nums text-champagne/75"
            delay={delay + 1000}
          />
        </div>

        {/* Metric C — Overdue (muted burnt-orange / amber warning) */}
        <div className="flex flex-col items-center justify-center text-center px-[0.8vw]">
          <div className="flex items-center gap-1 mb-[0.3vh]">
            <AlertTriangle
              className="flex-shrink-0"
              style={{
                width: "clamp(9px,0.9vw,13px)",
                height: "clamp(9px,0.9vw,13px)",
                color: "rgba(217,119,6,0.70)",
              }}
            />
            <span
              className="font-inter text-[clamp(8px,0.68vw,10px)] tracking-[0.45em] uppercase"
              style={{ color: "rgba(217,119,6,0.65)" }}
            >
              Overdue
            </span>
          </div>
          <AnimatedCounter
            value={tickets.overdueCount}
            className="font-edu text-[clamp(1.3rem,2.2vw,3rem)] leading-none tabular-nums text-amber-600/85"
            delay={delay + 1150}
          />
        </div>
      </div>
    </div>
  );
}

// ── QueendomPanel ─────────────────────────────────────────────────────────────
interface QueendomPanelProps {
  name: string;
  stats: QueenStats;
  side: "left" | "right";
  delay?: number;
}

export default function QueendomPanel({
  name,
  stats,
  side,
  delay = 0,
}: QueendomPanelProps) {
  const radialOrigin = side === "left" ? "25% 45%" : "75% 45%";

  return (
    // Strict TV column: fills exactly its half of the 100vh panel row.
    // No min-h mobile fallback — this layout targets a fixed-display TV.
    <motion.section
      className="relative flex-1 flex flex-col overflow-hidden"
      style={{ padding: "1.8vh clamp(12px, 2.5vw, 36px)" }}
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Ambient radial glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse 70% 60% at ${radialOrigin}, rgba(201,168,76,0.06), transparent)`,
        }}
      />

      {/* ── Header: name + subtitle + GoldPill ── */}
      <motion.div
        className="relative flex flex-col items-center text-center flex-shrink-0 mb-[1.1vh]"
        variants={itemVariants}
      >
        {/* Top ornamental rule */}
        <div className="flex items-center gap-4 w-full mb-[0.6vh]">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent to-gold-500/40" />
          <span className="text-gold-500/35 text-[13px]">✦</span>
          <div className="h-px flex-1 bg-gradient-to-l from-transparent to-gold-500/40" />
        </div>

        <h2 className="font-playfair text-[clamp(1.6rem,3.2vw,3.8rem)] tracking-[0.25em] text-champagne uppercase leading-none">
          {name}
        </h2>
        <p className="font-inter text-[clamp(9px,0.85vw,12px)] tracking-[0.7em] uppercase text-gold-500/40 mt-[3px] mb-[0.6vh]">
          Queendom
        </p>

        <GoldPill count={stats.members.total} delay={delay / 1000 + 0.5} />

        {/* Bottom ornamental rule */}
        <div className="flex items-center gap-4 w-full mt-[0.7vh]">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent to-gold-500/20" />
          <span className="text-[10px] tracking-[0.5em] text-gold-500/20">✦ &nbsp; ✦</span>
          <div className="h-px flex-1 bg-gradient-to-l from-transparent to-gold-500/20" />
        </div>
      </motion.div>

      {/* ── Two command modals — side by side, fixed vh height ── */}
      <motion.div
        className="flex-shrink-0 grid grid-cols-2 gap-[1.2vw] mb-[1.1vh]"
        style={{ height: "9.5vh" }}
        variants={itemVariants}
      >
        <DailyModal   tickets={stats.tickets} delay={delay} />
        <MonthlyModal tickets={stats.tickets} delay={delay} />
      </motion.div>

      {/* ── Agent Leaderboard — fills all remaining height ── */}
      {/* flex-1 + min-h-0 ensures this never pushes past 100vh */}
      <motion.div
        className="flex-1 min-h-0 flex flex-col glass gold-border-glow rounded-2xl relative overflow-hidden"
        style={{ padding: "1.2vh clamp(10px, 1.8vw, 24px)" }}
        variants={itemVariants}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-gold-500/[0.03] to-transparent pointer-events-none rounded-2xl" />
        <AgentLeaderboard
          agents={stats.agents}
          queendomDelay={delay / 1000 + 0.3}
        />
      </motion.div>
    </motion.section>
  );
}
