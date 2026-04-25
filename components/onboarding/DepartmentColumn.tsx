"use client";

import { memo, useEffect, useRef, useState, type CSSProperties } from "react";
import { motion } from "framer-motion";
import AnimatedCounter from "@/components/AnimatedCounter";
import { gpuStyle } from "@/lib/motionPresets";
import {
  EMPTY_BREAKDOWN,
  type AgentLeadStatusBreakdown,
  type Department,
  type LeadStatusByAgent,
  type OnboardingAgentRow,
} from "@/lib/onboardingTypes";
import { agentPortraitSrc, DEPT_HEADING_FONT } from "./utils";
import { LeadStatusHealthBar } from "./LeadStatusHealthBar";

interface DeptAccent {
  color: string;
  glowClass: string;
  cardBorder: string;
  glassBorder: string;
  glassBg: string;
  ruleLeft: CSSProperties;
  ruleRight: CSSProperties;
  chipBorderToday: string;
  chipBgToday: string;
}

// font sizes intentionally omitted — applied via cqh inline styles inside the card
const METRIC_BOX_BASE =
  "flex min-w-0 flex-1 basis-0 flex-col items-center justify-center self-center text-center rounded-xl border bg-black/30";
const METRIC_LABEL_CLASS =
  "font-inter shrink-0 font-semibold uppercase leading-none tracking-[0.25em]";
const METRIC_VALUE_CLASS =
  "font-cinzel font-bold leading-none tracking-[0.06em] tabular-nums";

const ACCENTS: Record<Department, DeptAccent> = {
  concierge: {
    color: "var(--gold-primary)",
    glowClass: "queen-name-glow",
    cardBorder: "rgba(212,175,55,0.45)",
    glassBorder: "rgba(212,175,55,0.18)",
    glassBg: "rgba(212,175,55,0.025)",
    ruleLeft: {
      background:
        "linear-gradient(to right, transparent, rgba(212,175,55,0.30), rgba(212,175,55,0.50))",
    },
    ruleRight: {
      background:
        "linear-gradient(to left,  transparent, rgba(212,175,55,0.30), rgba(212,175,55,0.50))",
    },
    chipBorderToday: "rgba(212,175,55,0.25)",
    chipBgToday: "rgba(212,175,55,0.06)",
  },
  shop: {
    color: "var(--color-sky)",
    glowClass: "sky-name-glow",
    cardBorder: "rgba(125,211,252,0.45)",
    glassBorder: "rgba(125,211,252,0.15)",
    glassBg: "rgba(125,211,252,0.020)",
    ruleLeft: {
      background:
        "linear-gradient(to right, transparent, rgba(125,211,252,0.28), rgba(125,211,252,0.45))",
    },
    ruleRight: {
      background:
        "linear-gradient(to left,  transparent, rgba(125,211,252,0.28), rgba(125,211,252,0.45))",
    },
    chipBorderToday: "rgba(125,211,252,0.25)",
    chipBgToday: "rgba(125,211,252,0.06)",
  },
};

interface CompactAgentCardProps {
  agent: OnboardingAgentRow;
  department: Department;
  shimmerStamp: number;
  prefersReducedMotion: boolean;
  accent: DeptAccent;
  staggerDelay: number;
  leadStatus?: AgentLeadStatusBreakdown;
}

const CompactAgentCard = memo(function CompactAgentCard({
  agent,
  department,
  shimmerStamp,
  prefersReducedMotion,
  accent,
  staggerDelay,
  leadStatus = EMPTY_BREAKDOWN,
}: CompactAgentCardProps) {
  const slide = !prefersReducedMotion;
  const isConcierge = department === "concierge";
  const metricTileBorder = isConcierge
    ? "border-gold-500/20"
    : "border-sky-400/20";
  const leadsMonth = agent.leadsThisMonth ?? agent.totalAttempted;
  const closedCount = agent.totalConverted;
  const firstNameKey = agent.name.trim().toLowerCase().split(/[\s/,]/)[0];
  const idKey = agent.id.trim().toLowerCase();
  const isKatya = idKey === "katya" || firstNameKey === "katya";
  const isVikram = idKey === "vikram" || firstNameKey === "vikram";
  const useContainedPortrait = isKatya || isVikram;

  const usePulse = (value: number | string) => {
    const prevRef = useRef(value);
    const [active, setActive] = useState(false);

    useEffect(() => {
      if (prevRef.current !== value) {
        setActive(true);
        const t = setTimeout(() => setActive(false), 560);
        prevRef.current = value;
        return () => clearTimeout(t);
      }
    }, [value]);

    return active;
  };

  const monthPulse = usePulse(leadsMonth);
  const todayPulse = usePulse(agent.leadsAttendToday);
  const closedPulse = usePulse(closedCount);

  const index = Math.round(staggerDelay / 160);
  const motionProps = prefersReducedMotion
    ? { initial: {}, animate: {}, transition: { duration: 0 } }
    : {
        initial: { opacity: 0, y: 8 },
        animate: { opacity: 1, y: 0 },
        transition: {
          duration: 0.5,
          ease: [0.16, 1, 0.32, 1] as const,
          delay: index * 0.06,
        },
      };

  return (
    <motion.div
      {...motionProps}
      className="relative flex h-full min-h-0 w-full items-stretch overflow-hidden"
      style={{
        flexDirection: isConcierge ? "row" : "row-reverse",
        background: "rgba(255,255,255,0.03)",
        borderTop: "1px solid rgba(255,255,255,0.07)",
        borderLeft: isConcierge ? undefined : "1px solid rgba(255,255,255,0.07)",
        borderRight: isConcierge ? "1px solid rgba(255,255,255,0.07)" : undefined,
        borderBottom: "1px solid rgba(255,255,255,0.07)",
        borderRadius: "clamp(6px, 0.7vmin, 10px)",
        containerType: "size",
        ...gpuStyle,
      }}
    >
      {shimmerStamp > 0 && (
        <div key={shimmerStamp} className="card-win-shimmer" aria-hidden />
      )}

      {/* Portrait (40%) */}
      <div
        style={{
          position: "relative",
          width: "40%",
          flexShrink: 0,
          overflow: "hidden",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={agentPortraitSrc(agent)}
          alt={agent.name.trim() || "Agent portrait"}
          style={{
            width: "100%",
            height: "100%",
            objectFit: useContainedPortrait ? "contain" : "cover",
            objectPosition: useContainedPortrait ? "center" : "top center",
            display: "block",
          }}
        />
      </div>

      {/* Right 60% — scales with card height via cqh units */}
      <div
        style={{
          flex: 1,
          minWidth: 0,
          minHeight: 0,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "stretch",
          padding: "4cqh 3cqw 4cqh 2.5cqw",
          gap: "2cqh",
        }}
      >
        {/* Name */}
        <div
          className={`w-full min-w-0 truncate text-center font-cinzel font-bold uppercase leading-none tracking-[0.28em] ${
            isConcierge
              ? "text-gold-400 queen-name-glow"
              : "text-sky-200 sky-name-glow"
          }`}
          style={{
            fontSize:     "clamp(0.6rem, 9cqh, 3.5rem)",
            background:   accent.glassBg,
            border:       `1px solid ${accent.glassBorder}`,
            borderRadius: "clamp(5px, 0.6vmin, 8px)",
            padding:      "1.5cqh 3cqw",
            boxShadow:    "inset 0 1px 0 rgba(255,255,255,0.05)",
          }}
        >
          {agent.name.trim()}
        </div>

        {/* Rule under name */}
        <div
          style={{
            height: "1px",
            flexShrink: 0,
            background: `linear-gradient(to right, ${accent.color}70, transparent 75%)`,
          }}
        />

        {/* 3 metric tiles — flex-1 so they fill remaining space */}
        <div
          className="flex w-full min-w-0 flex-row items-stretch"
          style={{ flex: "1 1 0", minHeight: 0, gap: "1.5cqw" }}
        >
          {/* Leads (This Month) */}
          <div
            className={`${METRIC_BOX_BASE} ${metricTileBorder}`}
            style={{ padding: "2cqh 1cqw" }}
          >
            <span
              className={`${METRIC_LABEL_CLASS} ${
                isConcierge ? "text-champagne" : "text-sky-200"
              }`}
              style={{ fontSize: "clamp(0.35rem, 3.5cqh, 1.4rem)", marginBottom: "0.8cqh" }}
            >
              Leads <br /> (This Month)
            </span>
            <span
              className={`${METRIC_VALUE_CLASS} ${
                isConcierge ? "text-champagne" : "text-sky-200"
              } ${monthPulse ? "ob-metric-flash" : ""}`}
              style={{
                fontSize: "clamp(1rem, 14cqh, 5.5rem)",
                ["--ob-pulse-color" as string]: accent.color,
              } as CSSProperties}
            >
              <AnimatedCounter
                value={leadsMonth}
                delay={staggerDelay}
                slideOnChange={slide}
                className="text-current"
              />
            </span>
          </div>

          {/* Leads (Today) */}
          <div
            className={`${METRIC_BOX_BASE} ${metricTileBorder}`}
            style={{ padding: "2cqh 1cqw" }}
          >
            <span
              className={`${METRIC_LABEL_CLASS} tracking-[0.22em] text-emerald-300`}
              style={{ fontSize: "clamp(0.35rem, 3.5cqh, 1.4rem)", marginBottom: "0.8cqh" }}
            >
              Leads <br /> (Today)
            </span>
            <span
              className={`${METRIC_VALUE_CLASS} text-emerald-400 emerald-glow-hero ${
                todayPulse ? "ob-metric-flash" : ""
              }`}
              style={{
                fontSize: "clamp(1rem, 14cqh, 5.5rem)",
                ["--ob-pulse-color" as string]: accent.color,
              } as CSSProperties}
            >
              <AnimatedCounter
                value={agent.leadsAttendToday}
                delay={staggerDelay + 110}
                slideOnChange={slide}
                className="text-current"
              />
            </span>
          </div>

          {/* Closures (This Month) */}
          <div
            className={`${METRIC_BOX_BASE} ${metricTileBorder}`}
            style={{ padding: "2cqh 1cqw" }}
          >
            <span
              className={`${METRIC_LABEL_CLASS} ${
                isConcierge ? "text-champagne" : "text-sky-200"
              }`}
              style={{ fontSize: "clamp(0.35rem, 3.5cqh, 1.4rem)", marginBottom: "0.8cqh" }}
            >
              Closures <br /> (This Month)
            </span>
            <span
              className={`${METRIC_VALUE_CLASS} ${
                isConcierge
                  ? "text-gold-300 gold-glow"
                  : "text-sky-100 sky-name-glow"
              } ${closedPulse ? "ob-metric-flash" : ""}`}
              style={{
                fontSize: "clamp(1rem, 14cqh, 5.5rem)",
                ["--ob-pulse-color" as string]: accent.color,
              } as CSSProperties}
            >
              <AnimatedCounter
                value={closedCount}
                delay={staggerDelay + 220}
                slideOnChange={slide}
                className="text-current"
              />
            </span>
          </div>
        </div>

        {/* Rule above pipeline */}
        <div
          style={{
            height: "1px",
            flexShrink: 0,
            background: `linear-gradient(to right, ${accent.color}30, transparent 80%)`,
          }}
        />

        {/* Pipeline health bar */}
        <LeadStatusHealthBar breakdown={leadStatus} />
      </div>
    </motion.div>
  );
});

// -- DepartmentColumn ---------------------------------------------------------

export interface DepartmentColumnProps {
  department: Department;
  label: string;
  agents: OnboardingAgentRow[];
  shimmerStampByAgentId: Record<string, number>;
  prefersReducedMotion: boolean;
  leadStatusByAgent: LeadStatusByAgent;
}

export function DepartmentColumn({
  department,
  label,
  agents,
  shimmerStampByAgentId,
  prefersReducedMotion,
  leadStatusByAgent,
}: DepartmentColumnProps) {
  const accent = ACCENTS[department];

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Glass card */}
      <div
        className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl"
        style={{
          border: `1px solid ${accent.glassBorder}`,
          background: "rgba(10,10,10,0.88)",
          boxShadow:
            "0 0 0 1px rgba(255,255,255,0.03) inset, 0 20px 48px rgba(0,0,0,0.5)",
          padding: "clamp(0.45rem,0.9vmin,1rem)",
          gap: "clamp(0.2rem,0.4vmin,0.5rem)",
        }}
      >
        {/* Gradient sheen */}
        <div
          className="pointer-events-none absolute inset-0 rounded-2xl"
          style={{
            background: `linear-gradient(135deg, ${accent.glassBg} 0%, transparent 55%)`,
          }}
        />

        {/* Department header — inside the card */}
        <div
          className="relative flex flex-shrink-0 flex-col"
          style={{
            gap:           "clamp(0.35rem, 0.7vmin, 0.8rem)",
            paddingTop:    "clamp(0.4rem, 0.9vmin, 1rem)",
            marginBottom:  "0.4vh",
          }}
        >
          {/* Title row: rule — LABEL — rule */}
          <div className="flex w-full items-center gap-2">
            <div className="h-px flex-1" style={accent.ruleLeft} />
            <h3
              className={`flex-shrink-0 font-cinzel font-bold uppercase leading-none tracking-[0.32em] ${accent.glowClass}`}
              style={{ fontSize: DEPT_HEADING_FONT, color: accent.color }}
            >
              {label}
            </h3>
            <div className="h-px flex-1" style={accent.ruleRight} />
          </div>
          {/* Bottom separator rule */}
          <div className="flex w-full items-center">
            <div className="h-px flex-1" style={accent.ruleLeft} />
            <div className="h-px flex-1" style={accent.ruleRight} />
          </div>
        </div>

        {/* Agent cards — vertical stack */}
        <div
          className="relative grid min-h-0 w-full flex-1 items-stretch"
          style={{
            gridTemplateColumns: "minmax(0, 1fr)",
            gridTemplateRows: `repeat(${Math.max(agents.length, 1)}, minmax(0, 1fr))`,
            gap: "clamp(0.3rem,0.55vmin,0.7rem)",
          }}
        >
          {agents.map((agent, idx) => (
            <CompactAgentCard
              key={agent.id}
              agent={agent}
              department={department}
              shimmerStamp={shimmerStampByAgentId[agent.id] ?? 0}
              prefersReducedMotion={prefersReducedMotion}
              accent={accent}
              staggerDelay={idx * 160}
              leadStatus={leadStatusByAgent[agent.name] ?? EMPTY_BREAKDOWN}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
