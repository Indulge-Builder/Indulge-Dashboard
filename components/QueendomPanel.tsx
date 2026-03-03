"use client";

import { motion } from "framer-motion";
import {
  Users,
  CheckCircle,
  Activity,
  Ticket,
  CalendarDays,
} from "lucide-react";
import AnimatedCounter from "./AnimatedCounter";
import type { QueenStats } from "@/lib/types";

interface QueendomPanelProps {
  name: string;
  stats: QueenStats;
  side: "left" | "right";
  delay?: number;
}

const containerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.16, delayChildren: 0.25 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 36 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.75, ease: [0.25, 0.46, 0.45, 0.94] },
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
      className="relative flex-1 flex flex-col items-center justify-center overflow-hidden"
      style={{ padding: "2.5vh 5vw" }}
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Ambient radial glow specific to each side */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse 70% 65% at ${radialOrigin}, rgba(201,168,76,0.065), transparent)`,
        }}
      />

      {/* ── Queen Header ── */}
      <motion.div
        className="w-full max-w-[620px] text-center mb-[2.8vh]"
        variants={itemVariants}
      >
        <div className="flex items-center gap-4 mb-[1vh]">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent to-gold-500/45" />
          <span className="text-gold-500/40 text-[10px]">✦</span>
          <div className="h-px flex-1 bg-gradient-to-l from-transparent to-gold-500/45" />
        </div>

        <h2 className="font-playfair text-[2.6rem] tracking-[0.25em] text-champagne uppercase leading-none">
          {name}
        </h2>
        <p className="font-inter text-[9px] tracking-[0.7em] uppercase text-gold-500/45 mt-[5px]">
          Queendom
        </p>

        <div className="flex items-center gap-4 mt-[1vh]">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent to-gold-500/20" />
          <span className="font-inter text-[7px] tracking-[0.6em] uppercase text-gold-500/25">
            ✦ &nbsp; ✦ &nbsp; ✦
          </span>
          <div className="h-px flex-1 bg-gradient-to-l from-transparent to-gold-500/20" />
        </div>
      </motion.div>

      {/* ── Section 1: Ticket Performance (Top) ── */}
      <motion.div
        className="w-full max-w-[620px] mb-[2vh]"
        variants={itemVariants}
      >
        <div
          className="glass gold-border-glow rounded-2xl relative overflow-hidden"
          style={{ padding: "2.4vh 2.6vw" }}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-gold-500/[0.04] to-transparent pointer-events-none rounded-2xl" />

          {/* Section label */}
          <div className="flex items-center gap-2 mb-[2vh]">
            <Ticket size={12} className="text-gold-500/50" />
            <span className="font-inter text-[14px] tracking-[0.45em] uppercase text-gold-500/50">
              Ticket Performance
            </span>
          </div>

          {/* ── Hero: Solved Today ── */}
          <div className="flex flex-col items-center justify-center text-center mb-[2vh]">
            <div className="flex items-center gap-2 mb-[1vh]">
              <CheckCircle size={11} className="text-emerald-400/70" />
              <p className="font-inter text-[12px] tracking-[0.45em] uppercase text-emerald-400/70">
                Solved Today
              </p>
            </div>
            <AnimatedCounter
              value={stats.tickets.solvedToday}
              className="font-edu text-[7.5rem] leading-none text-emerald-400 emerald-glow-hero tabular-nums"
              delay={delay + 1000}
            />
          </div>

          {/* Ornamental divider */}
          <div className="flex items-center gap-3 mb-[2vh]">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent to-gold-500/20" />
            <span className="text-gold-500/25 text-[7px]">✦</span>
            <div className="h-px flex-1 bg-gradient-to-l from-transparent to-gold-500/20" />
          </div>

          {/* ── Secondary Row: Total Received This Month + Total Pending ── */}
          <div className="grid grid-cols-2 gap-[10px]">
            {/* Total Received This Month */}
            <div
              className="bg-black/40 rounded-xl border border-gold-500/[0.11] flex flex-col items-center justify-center text-center"
              style={{ padding: "1.8vh 1vw" }}
            >
              <div className="flex items-center gap-1.5 mb-[0.8vh]">
                <CalendarDays size={10} className="text-gold-500/50" />
                <p className="font-inter text-[10px] tracking-[0.3em] uppercase text-amber-400/65">
                  Total Received
                </p>
              </div>
              <AnimatedCounter
                value={stats.tickets.totalThisMonth}
                className="font-edu text-[3.2rem] leading-none text-champagne tabular-nums"
                delay={delay + 1200}
              />
              <p className="font-inter text-[10px] tracking-[0.3em] uppercase text-gold-500/70 mt-[0.5vh]">
                This Month
              </p>
            </div>

            {/* Total Pending – live pulse */}
            <div
              className="bg-black/50 rounded-xl border border-amber-500/[0.18] flex flex-col items-center justify-center text-center"
              style={{ padding: "1.8vh 1vw" }}
            >
              <div className="flex items-center gap-2 mb-[0.8vh]">
                {/* Live pulse dot */}
                <span className="relative flex h-[8px] w-[8px] flex-shrink-0">
                  <motion.span
                    className="absolute inline-flex h-full w-full rounded-full bg-amber-400/45"
                    animate={{ scale: [1, 2.8, 1], opacity: [0.65, 0, 0.65] }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                  />
                  <span className="relative inline-flex rounded-full h-[8px] w-[8px] bg-amber-400" />
                </span>
                <Activity size={10} className="text-amber-400/65" />
                <p className="font-inter text-[10px] tracking-[0.3em] uppercase text-amber-400/65">
                  Pending
                </p>
              </div>
              <AnimatedCounter
                value={stats.tickets.pendingToResolve}
                className="font-edu text-[3.2rem] leading-none text-rosegold tabular-nums"
                delay={delay + 1350}
              />
              <p className="font-inter text-[10px] tracking-[0.3em] uppercase text-gold-500/70 mt-[0.5vh]">
                To Resolve
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── Section 2: Members (Bottom) ── */}
      <motion.div className="w-full max-w-[620px]" variants={itemVariants}>
        <div
          className="glass gold-border-glow rounded-2xl relative overflow-hidden"
          style={{ padding: "2.4vh 2.6vw" }}
        >
          {/* Subtle inner gradient */}
          <div className="absolute inset-0 bg-gradient-to-br from-gold-500/[0.06] to-transparent pointer-events-none rounded-2xl" />

          {/* Section label */}
          <div className="flex items-center gap-2 mb-[1.5vh]">
            <Users size={12} className="text-gold-500" />
            <span className="font-inter text-[14px] tracking-[0.45em] uppercase text-gold-500/50">
              Our Members
            </span>
          </div>

          {/* Big total number */}
          <div className="text-center mb-[2vh]">
            <AnimatedCounter
              value={stats.members.total}
              className="font-edu text-[5.5rem] leading-none text-gold-400 gold-glow tabular-nums"
              delay={delay + 700}
            />
          </div>

          {/* Yearly / Monthly split */}
          <div className="grid grid-cols-2 gap-3">
            <div
              className="bg-black/35 rounded-xl border border-gold-500/[0.09] text-center"
              style={{ padding: "1.6vh 1vw" }}
            >
              <p className="font-inter text-[10px] tracking-[0.5em] uppercase text-amber-400/65 mb-[0.8vh]">
                Yearly
              </p>
              <AnimatedCounter
                value={stats.members.yearly}
                className="font-edu text-[2.6rem] leading-none text-gold-400 gold-glow tabular-nums"
                delay={delay + 900}
              />
            </div>
            <div
              className="bg-black/35 rounded-xl border border-gold-500/[0.09] text-center"
              style={{ padding: "1.6vh 1vw" }}
            >
              <p className="font-inter text-[10px] tracking-[0.5em] uppercase text-amber-400/65 mb-[0.8vh]">
                Monthly
              </p>
              <AnimatedCounter
                value={stats.members.monthly}
                className="font-edu text-[2.6rem] leading-none text-slate-300 tabular-nums"
                delay={delay + 1000}
              />
            </div>
          </div>
        </div>
      </motion.div>
    </motion.section>
  );
}
