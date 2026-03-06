"use client";

import { motion } from "framer-motion";
import {
  CheckCircle,
  Activity,
  Ticket,
  CalendarDays,
} from "lucide-react";
import AnimatedCounter from "./AnimatedCounter";
import GoldPill from "./GoldPill";
import AgentLeaderboard from "./AgentLeaderboard";
import type { QueenStats } from "@/lib/types";

interface QueendomPanelProps {
  name: string;
  stats: QueenStats;
  side: "left" | "right";
  delay?: number;
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

export default function QueendomPanel({
  name,
  stats,
  side,
  delay = 0,
}: QueendomPanelProps) {
  const radialOrigin = side === "left" ? "25% 45%" : "75% 45%";

  return (
    <motion.section
      className="relative flex-1 flex flex-col min-h-0 overflow-hidden"
      style={{ padding: "2vh 3vw" }}
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
        {/* Ornamental rule */}
        <div className="flex items-center gap-4 w-full mb-[0.8vh]">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent to-gold-500/40" />
          <span className="text-gold-500/35 text-[9px]">✦</span>
          <div className="h-px flex-1 bg-gradient-to-l from-transparent to-gold-500/40" />
        </div>

        <h2 className="font-playfair text-[2.6rem] tracking-[0.25em] text-champagne uppercase leading-none">
          {name}
        </h2>
        <p className="font-inter text-[8px] tracking-[0.7em] uppercase text-gold-500/40 mt-[3px] mb-[1vh]">
          Queendom
        </p>

        <GoldPill count={stats.members.total} delay={delay / 1000 + 0.5} />

        {/* Ornamental rule */}
        <div className="flex items-center gap-4 w-full mt-[1vh]">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent to-gold-500/20" />
          <span className="font-inter text-[7px] tracking-[0.5em] text-gold-500/20">✦ &nbsp; ✦</span>
          <div className="h-px flex-1 bg-gradient-to-l from-transparent to-gold-500/20" />
        </div>
      </motion.div>

      {/* ── Ticket Performance (compact) ── */}
      <motion.div
        className="flex-shrink-0 mb-[1.6vh]"
        variants={itemVariants}
      >
        <div
          className="glass gold-border-glow rounded-2xl relative overflow-hidden"
          style={{ padding: "1.6vh 2vw" }}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-gold-500/[0.04] to-transparent pointer-events-none rounded-2xl" />

          {/* Label */}
          <div className="flex items-center gap-2 mb-[1.2vh]">
            <Ticket size={11} className="text-gold-500/50" />
            <span className="font-inter text-[12px] tracking-[0.45em] uppercase text-gold-500/50">
              Ticket Performance
            </span>
          </div>

          <div className="flex items-center gap-[2vw]">
            {/* Hero: Solved Today */}
            <div className="flex flex-col items-center justify-center text-center flex-shrink-0">
              <div className="flex items-center gap-1.5 mb-[0.4vh]">
                <CheckCircle size={10} className="text-emerald-400/70" />
                <p className="font-inter text-[10px] tracking-[0.4em] uppercase text-emerald-400/70">
                  Solved Today
                </p>
              </div>
              <AnimatedCounter
                value={stats.tickets.solvedToday}
                className="font-edu text-[4.5rem] leading-none text-emerald-400 emerald-glow-hero tabular-nums"
                delay={delay + 1000}
              />
            </div>

            {/* Divider */}
            <div className="h-16 w-px bg-gradient-to-b from-transparent via-gold-500/20 to-transparent flex-shrink-0" />

            {/* Secondary stats */}
            <div className="flex gap-[1.2vw] flex-1">
              {/* Total Received */}
              <div
                className="flex-1 bg-black/40 rounded-xl border border-gold-500/[0.11] flex flex-col items-center justify-center text-center"
                style={{ padding: "1.2vh 0.8vw" }}
              >
                <div className="flex items-center gap-1 mb-[0.3vh]">
                  <CalendarDays size={9} className="text-gold-500/50" />
                  <p className="font-inter text-[9px] tracking-[0.3em] uppercase text-amber-400/65">
                    Received
                  </p>
                </div>
                <AnimatedCounter
                  value={stats.tickets.totalThisMonth}
                  className="font-edu text-[2.4rem] leading-none text-champagne tabular-nums"
                  delay={delay + 1200}
                />
                <p className="font-inter text-[8px] tracking-[0.25em] uppercase text-gold-500/50 mt-[0.3vh]">
                  This Month
                </p>
              </div>

              {/* Pending */}
              <div
                className="flex-1 bg-black/50 rounded-xl border border-amber-500/[0.18] flex flex-col items-center justify-center text-center"
                style={{ padding: "1.2vh 0.8vw" }}
              >
                <div className="flex items-center gap-1.5 mb-[0.3vh]">
                  <span className="relative flex h-[6px] w-[6px] flex-shrink-0">
                    <motion.span
                      className="absolute inline-flex h-full w-full rounded-full bg-amber-400/45"
                      animate={{ scale: [1, 2.8, 1], opacity: [0.65, 0, 0.65] }}
                      transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                    />
                    <span className="relative inline-flex rounded-full h-[6px] w-[6px] bg-amber-400" />
                  </span>
                  <Activity size={9} className="text-amber-400/65" />
                  <p className="font-inter text-[9px] tracking-[0.3em] uppercase text-amber-400/65">
                    Pending
                  </p>
                </div>
                <AnimatedCounter
                  value={stats.tickets.pendingToResolve}
                  className="font-edu text-[2.4rem] leading-none text-rosegold tabular-nums"
                  delay={delay + 1350}
                />
                <p className="font-inter text-[8px] tracking-[0.25em] uppercase text-gold-500/50 mt-[0.3vh]">
                  To Resolve
                </p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── Agent Leaderboard (fills remaining height) ── */}
      <motion.div
        className="flex-1 min-h-0 flex flex-col glass gold-border-glow rounded-2xl relative overflow-hidden"
        style={{ padding: "1.6vh 2vw" }}
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
