"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import AnimatedCounter from "./AnimatedCounter";
import GoldPill from "./GoldPill";
import AgentLeaderboard from "./AgentLeaderboard";
import RenewalsPanel from "./RenewalsPanel";
import SpecialDates from "@/components/SpecialDates";
import type { QueenStats } from "@/lib/types";
import { getJokerNameForQueendom } from "@/lib/agentRoster";

interface RenewalsPanelData {
  totalRenewalsThisMonth: number;
  renewals: string[];
  assignments: string[];
}

interface QueendomPanelProps {
  name: string;
  stats: QueenStats;
  side: "left" | "right";
  delay?: number;
  celebrationAgent?: string | null;
  renewalsData?: RenewalsPanelData;
}

const itemVariants = {
  hidden: { opacity: 0, y: 28 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] },
  },
};

const containerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.14, delayChildren: 0.2 },
  },
};

// ── Reusable metric box for 5-metric hero row ──
function MetricBox({
  label,
  value,
  delay,
  slideOnChange,
  labelColor = "text-champagne",
  valueColor = "text-champagne",
}: {
  label: string;
  value: number;
  delay: number;
  slideOnChange?: boolean;
  labelColor?: string;
  valueColor?: string;
}) {
  return (
    <div
      className="flex-1 flex flex-col items-center justify-center text-center min-w-0 bg-black/30 rounded-xl border border-gold-500/20"
      style={{ padding: "1.2vh clamp(6px, 0.8vw, 14px)" }}
    >
      <p
        className={`font-inter font-semibold text-[clamp(16px,1.7vw,22px)] tracking-[0.25em] uppercase ${labelColor} mb-[0.2vh]`}
      >
        {label}
      </p>
      <AnimatedCounter
        value={value}
        className={`font-edu text-7xl min-[900px]:text-8xl leading-none ${valueColor} tabular-nums`}
        delay={delay}
        slideOnChange={slideOnChange}
      />
    </div>
  );
}

// ── Sanitize: null/undefined → 0 to prevent UI flicker on TV ─────────────────
export function safeNum(v: number | null | undefined): number {
  return typeof v === "number" && !Number.isNaN(v) ? v : 0;
}

export default function QueendomPanel({
  name,
  stats,
  side,
  delay = 0,
  celebrationAgent = null,
  renewalsData,
}: QueendomPanelProps) {
  const radialOrigin = side === "left" ? "25% 45%" : "75% 45%";

  // Memoized selector for total count — stable as new rows stream in from WebSocket
  const totalReceived = useMemo(
    () => safeNum(stats.tickets.totalReceived),
    [stats.tickets.totalReceived],
  );
  const resolvedThisMonth = useMemo(
    () => safeNum(stats.tickets.resolvedThisMonth),
    [stats.tickets.resolvedThisMonth],
  );
  const solvedToday = useMemo(
    () => safeNum(stats.tickets.solvedToday),
    [stats.tickets.solvedToday],
  );
  const pendingToResolve = useMemo(
    () => safeNum(stats.tickets.pendingToResolve),
    [stats.tickets.pendingToResolve],
  );

  const jokerAccepted = useMemo(
    () => safeNum(stats.joker?.acceptedCount),
    [stats.joker?.acceptedCount],
  );

  return (
    <motion.section
      className="relative flex-1 flex flex-col min-h-[85svh] md:min-h-0 overflow-y-auto overflow-x-hidden"
      style={{ padding: "2vh clamp(12px, 3vw, 40px)" }}
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Ambient radial glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse 70% 65% at ${radialOrigin}, rgba(201,168,76,0.065), transparent)`,
        }}
      />

      {/* ── Header: centered title + Gold Pill below ── */}
      <motion.div
        className="relative flex flex-col items-center text-center mb-[1.8vh] flex-shrink-0"
        variants={itemVariants}
      >
        {/* Top ornamental rule */}
        <div className="flex items-center gap-3 w-full mb-[0.9vh]">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gold-500/30 to-gold-500/50" />
          <div className="h-px flex-1 bg-gradient-to-l from-transparent via-gold-500/30 to-gold-500/50" />
        </div>

        <div className="flex items-center justify-center gap-3 sm:gap-4 flex-wrap">
          <h2 className="font-cinzel text-5xl min-[900px]:text-6xl xl:text-7xl tracking-[0.28em] text-gold-400 queen-name-glow uppercase leading-none font-bold">
            {name}
          </h2>
          <GoldPill count={stats.members.total} delay={delay / 1000 + 0.5} />
        </div>
        <p className="font-inter text-[clamp(18px,1.6vw,24px)] tracking-[0.65em] uppercase text-gold-500/55 font-semibold mt-[5px] mb-[1.1vh]">
          Queendom
        </p>

        {/* Bottom ornamental rule */}
        <div className="flex items-center gap-3 w-full mt-[1.1vh]">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gold-500/28 to-gold-500/45" />
          <div className="h-px flex-1 bg-gradient-to-l from-transparent via-gold-500/28 to-gold-500/45" />
        </div>
      </motion.div>

      {/* ── 5-Metric Hero Row ── */}
      <motion.div className="flex-shrink-0 mb-[1.6vh]" variants={itemVariants}>
        <div
          className="glass gold-border-glow rounded-2xl relative overflow-hidden"
          style={{ padding: "1.6vh clamp(10px, 2vw, 28px)" }}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-gold-500/[0.04] to-transparent pointer-events-none rounded-2xl" />

          <div className="grid grid-cols-5 gap-2 sm:gap-3 lg:gap-4 w-full">
            {/* 1. Total Solved Today — ANCHOR (Green Glow) */}
            <div className="flex flex-col items-center justify-center text-center flex-1 min-w-0">
              <p className="font-inter font-semibold text-[clamp(16px,1.7vw,22px)] tracking-[0.35em] uppercase text-emerald-300 mb-[0.2vh]">
                Today
              </p>
              <AnimatedCounter
                value={solvedToday}
                className="font-edu text-7xl min-[900px]:text-8xl leading-none text-emerald-400 emerald-glow-hero tabular-nums"
                delay={delay + 800}
                slideOnChange
              />
            </div>

            {/* 2. Total Received — count of all tickets for this queendom */}
            <MetricBox
              label="Received"
              value={totalReceived}
              delay={delay + 900}
              slideOnChange
            />

            {/* 3. Total Solved Month — resolve column for current month */}
            <MetricBox
              label="Resolved"
              value={resolvedThisMonth}
              delay={delay + 1000}
              slideOnChange
              labelColor="text-green-400"
              valueColor="text-green-400"
            />

            {/* 4. Pending — yet to score */}
            <MetricBox
              label="Pending"
              value={pendingToResolve}
              delay={delay + 1100}
              slideOnChange
              labelColor="text-red-400"
              valueColor="text-red-400"
            />

            {/* 5. Spoiled — total accepted score for this Queendom's Joker */}
            <div className="flex flex-col items-center justify-center text-center flex-1 min-w-0 joker-box rounded-xl border border-liquid-gold-end/35">
              <p className="font-inter font-semibold text-[clamp(16px,1.7vw,22px)] tracking-[0.3em] uppercase text-champagne mb-[0.2vh]">
                Spoiled
              </p>
              <AnimatedCounter
                value={jokerAccepted}
                className="font-edu text-7xl min-[900px]:text-8xl leading-none text-gold-300 tabular-nums"
                delay={delay + 1200}
                slideOnChange
              />
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── RenewalsPanel: Counter | Renewals | Latest members ───────────────── */}
      <motion.div className="flex-shrink-0 mb-[1.6vh]" variants={itemVariants}>
        <RenewalsPanel
          data={renewalsData ?? { totalRenewalsThisMonth: 0, renewals: [], assignments: [] }}
          delay={delay + 1300}
        />
      </motion.div>

      {/* ── Agent Leaderboard (left) + Special Dates (right) ── */}
      <motion.div
        className="flex-1 min-h-0 flex flex-col md:flex-row gap-4 glass gold-border-glow rounded-2xl relative overflow-hidden"
        style={{ padding: "1.6vh clamp(10px, 2vw, 28px)" }}
        variants={itemVariants}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-gold-500/[0.03] to-transparent pointer-events-none rounded-2xl" />
        <div className="flex-1 min-h-0 min-w-0">
          <AgentLeaderboard
            agents={stats.agents}
            joker={stats.joker}
            jokerName={getJokerNameForQueendom(
              name.toLowerCase() as "ananyshree" | "anishqa",
            )}
            queendomDelay={delay / 1000 + 0.3}
            celebrationAgent={celebrationAgent}
          />
        </div>
        {/* ── Special Dates (right of Team Leaderboard) ── */}
        <div className="flex-shrink-0 md:w-[clamp(320px,38vw,520px)] flex flex-col items-center md:border-l border-gold-500/20 md:pl-4 pt-4 md:pt-0 md:border-t-0 border-t border-gold-500/20">
          <div className="flex items-center gap-3 w-full mb-[1.8vh]">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gold-500/30 to-gold-500/50" />
            <p className="font-inter font-semibold text-[clamp(0.9rem,1.2vw,1.4rem)] tracking-[0.4em] uppercase text-champagne flex-shrink-0">
              Special Dates
            </p>
            <div className="h-px flex-1 bg-gradient-to-l from-transparent via-gold-500/30 to-gold-500/50" />
          </div>
          <SpecialDates
            queendomId={name.toLowerCase() as "ananyshree" | "anishqa"}
          />
        </div>
      </motion.div>
    </motion.section>
  );
}
