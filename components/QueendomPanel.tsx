"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import AnimatedCounter from "./AnimatedCounter";
import QueendomWingspanHeader from "./QueendomWingspanHeader";
import AgentLeaderboard from "./leaderboard/AgentLeaderboard";
import JokerMetricsStrip from "./JokerMetricsStrip";
import RenewalsPanel from "./RenewalsPanel";
import SpecialDates from "@/components/SpecialDates";
import type { QueenStats } from "@/lib/types";
import { getJokerNameForQueendom } from "@/lib/agentRoster";
import type { RenewalsPanelData } from "@/types";

interface QueendomPanelProps {
  name: string;
  stats: QueenStats;
  side: "left" | "right";
  delay?: number;
  celebrationAgent?: string | null;
  renewalsData?: RenewalsPanelData;
}

const itemVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.6, ease: [0.4, 0, 0.2, 1] },
  },
};

const containerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.09, delayChildren: 0.08 },
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
  label: ReactNode;
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
        className={`font-inter font-semibold text-[clamp(30px,3vw,46px)] tracking-[0.25em] uppercase ${labelColor} mb-[0.2vh]`}
      >
        {label}
      </p>
      <AnimatedCounter
        value={value}
        className={`font-cinzel font-bold text-8xl min-[900px]:text-9xl leading-none tracking-[0.06em] ${valueColor} tabular-nums`}
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
  const jokerDisplayName = useMemo(
    () =>
      getJokerNameForQueendom(name.toLowerCase() as "ananyshree" | "anishqa"),
    [name],
  );

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

  const leaderboardMeasureRef = useRef<HTMLDivElement>(null);
  const [leaderboardHeightPx, setLeaderboardHeightPx] = useState<number | null>(
    null,
  );

  useEffect(() => {
    const el = leaderboardMeasureRef.current;
    if (!el) return;

    const mdQuery = window.matchMedia("(min-width: 768px)");

    const apply = () => {
      if (!mdQuery.matches) {
        setLeaderboardHeightPx(null);
        return;
      }
      setLeaderboardHeightPx(el.getBoundingClientRect().height);
    };

    const ro = new ResizeObserver(apply);
    ro.observe(el);
    mdQuery.addEventListener("change", apply);
    apply();

    return () => {
      ro.disconnect();
      mdQuery.removeEventListener("change", apply);
    };
  }, []);

  return (
    <motion.section
      className="relative flex min-h-[85svh] flex-1 flex-col overflow-y-auto overflow-x-hidden md:min-h-0"
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

      {/* ── Wingspan header: metrics | name | metrics (luxury broadcast) ── */}
      <motion.div
        className="relative mb-[1.6vh] flex w-full min-w-0 flex-shrink-0 flex-col items-center"
        variants={itemVariants}
      >
        <div className="mb-[1.1vh] flex w-full items-center gap-3">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gold-500/25 to-gold-500/40" />
          <div className="h-px flex-1 bg-gradient-to-l from-transparent via-gold-500/25 to-gold-500/40" />
        </div>

        <QueendomWingspanHeader
          name={name}
          membersTotal={safeNum(stats.members.total)}
          complimentaryCount={safeNum(stats.members.celebrityActive)}
          delayMs={delay}
        />

        <p className="font-inter mb-[0.9vh] mt-[0.35vh] text-[clamp(28px,2.5vw,52px)] font-semibold uppercase tracking-[0.42em] text-gold-300 gold-glow">
          Queendom
        </p>

        <div className="flex w-full items-center gap-3">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gold-500/22 to-gold-500/38" />
          <div className="h-px flex-1 bg-gradient-to-l from-transparent via-gold-500/22 to-gold-500/38" />
        </div>
      </motion.div>

      {/* ── 5-Metric Hero Row (tickets + Spoiled for this Queendom’s Joker) ── */}
      <motion.div className="flex-shrink-0 mb-[1.6vh]" variants={itemVariants}>
        <div
          className="glass gold-border-glow rounded-2xl relative overflow-hidden"
          style={{ padding: "1.6vh clamp(10px, 2vw, 28px)" }}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-gold-500/[0.04] to-transparent pointer-events-none rounded-2xl" />

          <div className="grid grid-cols-2 min-[700px]:grid-cols-5 gap-2 sm:gap-3 lg:gap-4 w-full">
            {/* 1. Total Solved Today — ANCHOR (Green Glow) */}
            <div className="flex flex-col items-center justify-center text-center flex-1 min-w-0">
              <p className="font-inter font-semibold text-[clamp(30px,3vw,46px)] tracking-[0.35em] uppercase text-emerald-300 mb-[0.2vh]">
                Resolved <br /> (Today)
              </p>
              <AnimatedCounter
                value={solvedToday}
                className="font-cinzel font-bold text-8xl min-[900px]:text-9xl leading-none tracking-[0.06em] text-emerald-400 emerald-glow-hero tabular-nums"
                delay={delay + 800}
                slideOnChange
              />
            </div>

            {/* 2. Received (This Month) — from aggregateTicketStats (IST created_at month) */}
            <MetricBox
              label={
                <>
                  Received
                  <br />
                  (This Month)
                </>
              }
              value={totalReceived}
              delay={delay + 900}
              slideOnChange
            />

            {/* 3. Resolved (This Month) — created this IST month + status resolved only */}
            <MetricBox
              label={
                <>
                  Resolved
                  <br />
                  (This Month)
                </>
              }
              value={resolvedThisMonth}
              delay={delay + 1000}
              slideOnChange
              labelColor="text-green-400"
              valueColor="text-green-400"
            />

            {/* 4. Pending — yet to score */}
            <MetricBox
              label={
                <>
                  Pending
                  <br />
                  (This Month)
                </>
              }
              value={pendingToResolve}
              delay={delay + 1100}
              slideOnChange
              labelColor="text-red-400"
              valueColor="text-red-400"
            />

            {/* 5. Spoiled — accepted wins (current IST month; see GET /api/jokers) */}
            <div className="flex flex-col items-center justify-center text-center flex-1 min-w-0 joker-box rounded-xl border border-liquid-gold-end/35">
              <p className="font-inter font-semibold text-[clamp(30px,3vw,46px)] tracking-[0.3em] uppercase text-champagne mb-[0.2vh]">
                Spoiled
                <br />
                (This Month)
              </p>
              <AnimatedCounter
                value={jokerAccepted}
                className="font-cinzel font-bold text-9xl min-[900px]:text-[9rem] leading-none tracking-[0.06em] text-gold-300 tabular-nums"
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
          data={
            renewalsData ?? {
              totalRenewalsThisMonth: 0,
              renewals: [],
              assignments: [],
            }
          }
          delay={delay + 1300}
        />
      </motion.div>

      {/* ── Agent Leaderboard (left) + Special Dates (right) ── */}
      <motion.div
        className="relative flex min-h-0 flex-1 flex-col gap-4 overflow-hidden rounded-2xl glass gold-border-glow"
        style={{ padding: "1.6vh clamp(10px, 2vw, 28px)" }}
        variants={itemVariants}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-gold-500/[0.03] to-transparent pointer-events-none rounded-2xl" />
        <div className="relative z-10 flex min-h-0 flex-1 flex-col gap-4">
          {/* Row 1: Leaderboard | Special Dates (same width rhythm as before) */}
          <div className="flex min-h-0 w-full flex-col md:flex-row md:items-start md:gap-8 lg:gap-10">
            <div
              ref={leaderboardMeasureRef}
              className="min-h-0 min-w-0 w-full flex-shrink-0 md:flex-1"
            >
              <AgentLeaderboard
                agents={stats.agents}
                queendomDelay={delay / 1000 + 0.3}
                celebrationAgent={celebrationAgent}
              />
            </div>
            <div
              className="flex w-full min-h-0 flex-shrink-0 flex-col overflow-hidden border-t border-gold-500/20 pt-4 md:w-[clamp(360px,46vw,680px)] md:border-l md:border-t-0 md:pt-0 md:pl-8 lg:pl-10 md:pr-2 lg:pr-4 md:self-start"
              style={
                leaderboardHeightPx != null && leaderboardHeightPx > 0
                  ? { height: leaderboardHeightPx }
                  : undefined
              }
            >
              <div className="mb-[2vh] flex w-full flex-shrink-0 items-center gap-4 px-1 sm:px-2">
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gold-500/30 to-gold-500/50" />
                <p className="font-inter flex-shrink-0 text-[clamp(1.5rem,2.2vw,2.6rem)] font-semibold uppercase tracking-[0.42em] text-champagne px-2">
                  Special Dates
                </p>
                <div className="h-px flex-1 bg-gradient-to-l from-transparent via-gold-500/30 to-gold-500/50" />
              </div>
              <div className="flex min-h-0 flex-1 flex-col">
                <SpecialDates
                  queendomId={name.toLowerCase() as "ananyshree" | "anishqa"}
                />
              </div>
            </div>
          </div>

          {/* Row 2–3: Joker — full width like scorecard & renewals */}
          {stats.joker != null && jokerDisplayName != null ? (
            <div className="flex w-full min-h-0 flex-1 flex-col gap-4 border-t border-gold-500/20 pt-4">
              <JokerMetricsStrip
                compact
                jokerName={jokerDisplayName}
                joker={stats.joker}
                baseDelayMs={delay + 1450}
              />
            </div>
          ) : null}
        </div>
      </motion.div>
    </motion.section>
  );
}
