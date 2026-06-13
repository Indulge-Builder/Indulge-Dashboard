"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { motion } from "framer-motion";
import AnimatedCounter from "./AnimatedCounter";
import QueendomWingspanHeader from "./QueendomWingspanHeader";
import AgentLeaderboard from "./leaderboard/AgentLeaderboard";
import RenewalsPanel from "./RenewalsPanel";
import SpecialDates from "@/components/SpecialDates";
import { SectionDivider } from "@/components/ui/SectionDivider";
import { StatCard } from "@/components/ui/StatCard";
import { GoldGlassCard } from "@/components/ui/GoldGlassCard";
import type { QueenStats } from "@/lib/types";
import { safeNum } from "@/lib/format";
import type { RenewalsPanelData } from "@/types";

interface QueendomPanelProps {
  name: string;
  stats: QueenStats;
  side: "left" | "right";
  delay?: number;
  celebrationAgent?: string | null;
  renewalsData?: RenewalsPanelData;
}

// Intentionally different from lib/motionPresets' fade-up itemVariants
// (opacity-only 0.6s / 0.09 stagger vs fade-up-28px 0.7s / 0.14) — do NOT
// unify the values, that would change visible motion (dry-audit B2).
const queendomItemVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.6, ease: [0.4, 0, 0.2, 1] },
  },
};

const queendomContainerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.09, delayChildren: 0.08 },
  },
};

/**
 * The right column (Special Dates) width — single source of truth for the
 * panel AND QueendomSkeleton so the layouts stay pixel-stable (dry-audit A9).
 */
export const SPECIAL_DATES_COL_WIDTH_CLASS = "md:w-[clamp(220px,40%,680px)]";

// ── Metric box for the 5-metric hero row (StatCard with verbatim classes) ──
function MetricBox({
  label,
  value,
  delay,
  slideOnChange,
  labelColor = "text-champagne",
  valueColor = "text-champagne",
  labelTracking = "tracking-[0.25em]",
  valueSizeClass = "text-8xl min-[900px]:text-9xl",
  boxClass = "flex-1 flex flex-col items-center justify-center text-center min-w-0 bg-black/30 rounded-xl border border-gold-500/20",
  boxStyle = { padding: "1.2vh var(--pad-cell)" },
}: {
  label: ReactNode;
  value: number;
  delay: number;
  slideOnChange?: boolean;
  labelColor?: string;
  valueColor?: string;
  labelTracking?: string;
  valueSizeClass?: string;
  boxClass?: string;
  boxStyle?: CSSProperties;
}) {
  return (
    <StatCard
      surfaceClass={boxClass}
      style={boxStyle}
      labelClass={`font-inter font-semibold text-[clamp(2.5rem,3.6vw,4.25rem)] ${labelTracking} uppercase ${labelColor} mb-[0.2vh]`}
      label={label}
    >
      <AnimatedCounter
        value={value}
        className={`font-cinzel font-bold ${valueSizeClass} leading-none tracking-[0.06em] ${valueColor} tabular-nums`}
        delay={delay}
        slideOnChange={slideOnChange}
      />
    </StatCard>
  );
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
      style={{ padding: "2vh var(--pad-panel)" }}
      variants={queendomContainerVariants}
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
        variants={queendomItemVariants}
      >
        <SectionDivider
          className="mb-[1.1vh]"
          leftRuleClass="bg-gradient-to-r from-transparent via-gold-500/25 to-gold-500/40"
          rightRuleClass="bg-gradient-to-l from-transparent via-gold-500/25 to-gold-500/40"
        />

        <QueendomWingspanHeader
          name={name}
          membersTotal={safeNum(stats.members.total)}
          complimentaryCount={safeNum(stats.members.celebrityActive)}
          toBeRevivedCount={safeNum(stats.members.toBeRevived)}
          delayMs={delay}
        />

        <SectionDivider
          label="Queendom"
          accent="champagne"
          className="my-[0.35vh]"
          labelClass="!font-inter !font-semibold text-[clamp(28px,2.5vw,52px)] tracking-[0.42em] text-gold-300 gold-glow"
        />
      </motion.div>

      {/* ── 5-Metric Hero Row (tickets + Spoiled for this Queendom’s Joker) ── */}
      <motion.div className="flex-shrink-0 mb-[1.6vh]" variants={queendomItemVariants}>
        <GoldGlassCard style={{ padding: "1.6vh var(--pad-card)" }}>
          <div className="grid grid-cols-2 min-[700px]:grid-cols-5 gap-[var(--gap-metric)] w-full">
            {/* 1. Total Solved Today — ANCHOR (Green Glow) */}
            <MetricBox
              label={
                <>
                  Resolved <br /> (Today)
                </>
              }
              value={solvedToday}
              delay={delay + 800}
              slideOnChange
              labelColor="text-emerald-300"
              labelTracking="tracking-[0.35em]"
              valueColor="text-emerald-400 emerald-glow-hero"
              boxClass="flex flex-col items-center justify-center text-center flex-1 min-w-0"
              boxStyle={{}}
            />

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
            <MetricBox
              label={
                <>
                  Spoiled
                  <br />
                  (This Month)
                </>
              }
              value={jokerAccepted}
              delay={delay + 1200}
              slideOnChange
              labelTracking="tracking-[0.3em]"
              valueColor="text-gold-300"
              valueSizeClass="text-9xl min-[900px]:text-[9rem]"
              boxClass="flex flex-col items-center justify-center text-center flex-1 min-w-0 joker-box rounded-xl border border-liquid-gold-end/35"
              boxStyle={{}}
            />
          </div>
        </GoldGlassCard>
      </motion.div>

      {/* ── RenewalsPanel: Counter | Renewals | Latest members ───────────────── */}
      <motion.div className="flex-shrink-0 mb-[1.6vh]" variants={queendomItemVariants}>
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
      {/* Glass trio inlined here (not GoldGlassCard): this wrapper is a motion.div
          participating in the stagger — wrapping would change the animation tree. */}
      <motion.div
        className="relative flex min-h-0 flex-1 flex-col gap-[var(--gap-card)] overflow-hidden rounded-2xl glass gold-border-glow"
        style={{ padding: "1.6vh var(--pad-card)" }}
        variants={queendomItemVariants}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-gold-500/[0.03] to-transparent pointer-events-none rounded-2xl" />
        <div className="relative z-10 flex min-h-0 flex-1 flex-col gap-[var(--gap-card)]">
          {/* Row 1: Leaderboard | Special Dates (same width rhythm as before) */}
          <div className="flex min-h-0 w-full flex-col md:flex-row md:items-start md:gap-[var(--gap-section)]">
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
              className={`flex w-full min-h-0 flex-shrink-0 flex-col overflow-hidden border-t border-gold-500/20 pt-4 ${SPECIAL_DATES_COL_WIDTH_CLASS} md:border-l md:border-t-0 md:pt-0 md:pl-[var(--gap-section)] md:pr-2 lg:pr-4 md:self-start`}
              style={
                leaderboardHeightPx != null && leaderboardHeightPx > 0
                  ? { height: leaderboardHeightPx }
                  : undefined
              }
            >
              <SectionDivider
                label="Special Dates"
                accent="champagne"
                className="mb-[2vh] w-full flex-shrink-0 gap-4 px-1 sm:px-2"
                labelClass="!font-inter !font-semibold text-[clamp(1.5rem,2.2vw,2.6rem)] tracking-[0.42em]"
              />
              <div className="flex min-h-0 flex-1 flex-col">
                <SpecialDates
                  queendomId={name.toLowerCase() as "ananyshree" | "anishqa"}
                />
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.section>
  );
}
