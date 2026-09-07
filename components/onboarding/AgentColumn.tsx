"use client";

/**
 * components/onboarding/AgentColumn.tsx
 *
 * One column of Onboarding agent cards (the screen has two — `left` and
 * `right` in lib/onboardingAgents.ts). Formerly `DepartmentColumn`, which
 * themed a Concierge (gold) and a Shop (sky) department; the Shop team left in
 * June 2026, so both columns are now the same Onboarding roster in gold.
 */

import { memo, type CSSProperties } from "react";
import { motion } from "framer-motion";
import AnimatedCounter from "@/components/AnimatedCounter";
import { gpuStyle } from "@/lib/motionPresets";
import { usePulseOnChange } from "@/hooks/usePulseOnChange";
import {
  EMPTY_BREAKDOWN,
  type AgentLeadStatusBreakdown,
  type LeadStatusByAgent,
  type OnboardingAgentRow,
} from "@/lib/onboardingTypes";
import type { AgentColumn as AgentColumnId } from "@/lib/onboardingAgents";
import { agentPortraitSrc, DEPT_HEADING_FONT } from "./utils";
import { LeadStatusHealthBar } from "./LeadStatusHealthBar";

// font sizes intentionally omitted — applied via cqh inline styles inside the card
const METRIC_BOX_BASE =
  "flex min-w-0 flex-1 basis-0 flex-col items-center justify-center self-center text-center rounded-xl border border-gold-500/20 bg-[#101722]";
const METRIC_LABEL_CLASS =
  "font-montserrat shrink-0 font-semibold uppercase leading-none tracking-[0.25em]";
const METRIC_VALUE_CLASS =
  "font-cinzel font-bold leading-none tracking-[0.06em] tabular-nums";

/** Gold accent — the Onboarding identity (design system: gold on obsidian). */
const ACCENT = {
  color: "var(--gold-primary)",
  glowClass: "queen-name-glow",
  ruleLeft: {
    background:
      "linear-gradient(to right, transparent, rgba(212,175,55,0.30), rgba(212,175,55,0.50))",
  } as CSSProperties,
  ruleRight: {
    background:
      "linear-gradient(to left,  transparent, rgba(212,175,55,0.30), rgba(212,175,55,0.50))",
  } as CSSProperties,
} as const;

// -- AgentCardContent ---------------------------------------------------------

interface AgentCardContentProps {
  agent: OnboardingAgentRow;
  leadsMonth: number;
  closedCount: number;
  staggerDelay: number;
  slide: boolean;
  monthPulse: boolean;
  todayPulse: boolean;
  closedPulse: boolean;
  leadStatus: AgentLeadStatusBreakdown;
}

function AgentCardContent({
  agent,
  leadsMonth,
  closedCount,
  staggerDelay,
  slide,
  monthPulse,
  todayPulse,
  closedPulse,
  leadStatus,
}: AgentCardContentProps) {
  const pulseVar = { ["--ob-pulse-color" as string]: ACCENT.color } as CSSProperties;
  return (
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
        padding: "2.5cqh 2cqw",
        gap: "0.6cqh",
        border: "1px solid rgba(255,255,255,0.14)",
      }}
    >
      {/* Top zone: name */}
      <div style={{ flexShrink: 0 }}>
        <div
          className={`w-full min-w-0 truncate text-center font-cinzel font-bold uppercase leading-none tracking-[0.28em] text-gold-400 ${ACCENT.glowClass}`}
          style={{
            fontSize:     "clamp(1.9rem, 3.1cqw, 3.9rem)",
            background:   "#0f0f0f",
            border:       "1px solid rgba(255,255,255,0.14)",
            borderRadius: "clamp(5px, 0.6cqmin, 8px)",
            padding:      "1cqh 2cqw",
            boxShadow:    "none",
          }}
        >
          {agent.name.trim()}
        </div>

        <div
          style={{
            height: "1px",
            marginTop: "0.6cqh",
            flexShrink: 0,
            background: `linear-gradient(to right, ${ACCENT.color}70, transparent 75%)`,
          }}
        />
      </div>

      {/* Middle zone: score cards */}
      <div style={{ flex: "0 0 auto", minHeight: 0, display: "flex", alignItems: "stretch" }}>
        <div
          className="flex w-full min-w-0 flex-row items-stretch"
          style={{ minHeight: 0, gap: "clamp(3px, 1cqw, 14px)" }}
        >
          {/* Leads (This Month) */}
          <div className={METRIC_BOX_BASE} style={{ padding: "2cqh 1cqw" }}>
            <span
              className={`${METRIC_LABEL_CLASS} text-champagne`}
              style={{ fontSize: "clamp(1.35rem, 1.9cqw, 2.3rem)", marginBottom: 0 }}
            >
              Leads <br /> (This Month)
            </span>
            <span
              className={`${METRIC_VALUE_CLASS} text-champagne ${monthPulse ? "ob-metric-flash" : ""}`}
              style={{ fontSize: "clamp(1rem, 14cqh, 5.5rem)", ...pulseVar }}
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
          <div className={METRIC_BOX_BASE} style={{ padding: "2cqh 1cqw" }}>
            <span
              className={`${METRIC_LABEL_CLASS} tracking-[0.22em] text-emerald-300`}
              style={{ fontSize: "clamp(1.35rem, 1.9cqw, 2.3rem)", marginBottom: 0 }}
            >
              Leads <br /> (Today)
            </span>
            <span
              className={`${METRIC_VALUE_CLASS} text-emerald-400 emerald-glow-hero ${
                todayPulse ? "ob-metric-flash" : ""
              }`}
              style={{ fontSize: "clamp(1rem, 14cqh, 5.5rem)", ...pulseVar }}
            >
              <AnimatedCounter
                value={agent.leadsCreatedTodayIst}
                delay={staggerDelay + 110}
                slideOnChange={slide}
                className="text-current"
              />
            </span>
          </div>

          {/* Closures (This Month) */}
          <div className={METRIC_BOX_BASE} style={{ padding: "2cqh 1cqw" }}>
            <span
              className={`${METRIC_LABEL_CLASS} text-champagne`}
              style={{ fontSize: "clamp(1.35rem, 1.9cqw, 2.3rem)", marginBottom: 0 }}
            >
              Closures <br /> (This Month)
            </span>
            <span
              className={`${METRIC_VALUE_CLASS} text-gold-300 gold-glow ${
                closedPulse ? "ob-metric-flash" : ""
              }`}
              style={{ fontSize: "clamp(1rem, 14cqh, 5.5rem)", ...pulseVar }}
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
      </div>

      {/* Bottom zone: pipeline */}
      <div style={{ flexShrink: 0 }}>
        <div
          style={{
            height: "1px",
            marginBottom: "0.25cqh",
            background: `linear-gradient(to right, ${ACCENT.color}30, transparent 80%)`,
          }}
        />
        <LeadStatusHealthBar breakdown={leadStatus} />
      </div>
    </div>
  );
}

// -- CompactAgentCard ---------------------------------------------------------

interface CompactAgentCardProps {
  agent: OnboardingAgentRow;
  /** Portrait sits on the outer edge: left column → portrait left, right column → portrait right. */
  column: AgentColumnId;
  prefersReducedMotion: boolean;
  staggerDelay: number;
  leadStatus?: AgentLeadStatusBreakdown;
}

const CompactAgentCard = memo(function CompactAgentCard({
  agent,
  column,
  prefersReducedMotion,
  staggerDelay,
  leadStatus = EMPTY_BREAKDOWN,
}: CompactAgentCardProps) {
  const slide = !prefersReducedMotion;
  const portraitLeft = column === "left";
  const leadsMonth = agent.leadsThisMonth ?? agent.leadsCreatedThisMonth;
  const closedCount = agent.totalConverted;

  const portrait = agentPortraitSrc(agent);

  const monthPulse = usePulseOnChange(leadsMonth);
  const todayPulse = usePulseOnChange(agent.leadsCreatedTodayIst);
  const closedPulse = usePulseOnChange(closedCount);

  const index = Math.round(staggerDelay / 160);
  const motionProps = prefersReducedMotion
    ? { initial: {}, animate: {}, transition: { duration: 0 } }
    : {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        transition: {
          duration: 0.55,
          ease: [0.4, 0, 0.2, 1] as const,
          delay: index * 0.07,
          layout: { duration: 0.4, ease: [0.4, 0, 0.2, 1] },
        },
      };

  return (
    <motion.div
      {...motionProps}
      layout={!prefersReducedMotion}
      className="relative flex h-full min-h-0 w-full items-stretch overflow-hidden"
      style={{
        flexDirection: portraitLeft ? "row" : "row-reverse",
        background: "#0b0b0b",
        borderTop: "1px solid rgba(255,255,255,0.14)",
        borderLeft: portraitLeft ? undefined : "1px solid rgba(255,255,255,0.14)",
        borderRight: portraitLeft ? "1px solid rgba(255,255,255,0.14)" : undefined,
        borderBottom: "1px solid rgba(255,255,255,0.14)",
        borderRadius: "clamp(6px, 0.7cqmin, 10px)",
        containerType: "size",
        ...gpuStyle,
      }}
    >
      {/* Portrait (40%) — blank black frame when no photo is on file */}
      <div
        style={{
          position: "relative",
          width: "40%",
          flexShrink: 0,
          overflow: "hidden",
          background: "#000",
        }}
        aria-label={portrait ? undefined : `${agent.name.trim()} — portrait pending`}
      >
        {portrait && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={portrait}
            alt={agent.name.trim() || "Agent portrait"}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: "top center",
              display: "block",
            }}
          />
        )}
      </div>

      {/* Data panel (60%) */}
      <AgentCardContent
        agent={agent}
        leadsMonth={leadsMonth}
        closedCount={closedCount}
        staggerDelay={staggerDelay}
        slide={slide}
        monthPulse={monthPulse}
        todayPulse={todayPulse}
        closedPulse={closedPulse}
        leadStatus={leadStatus}
      />
    </motion.div>
  );
});

// -- AgentColumn ---------------------------------------------------------------

export interface AgentColumnProps {
  column: AgentColumnId;
  label: string;
  agents: OnboardingAgentRow[];
  prefersReducedMotion: boolean;
  leadStatusByAgent: LeadStatusByAgent;
}

export function AgentColumn({
  column,
  label,
  agents,
  prefersReducedMotion,
  leadStatusByAgent,
}: AgentColumnProps) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Glass card */}
      <div
        className="relative flex min-h-0 flex-1 flex-col rounded-2xl"
        style={{
          border: "1px solid rgba(255,255,255,0.14)",
          background: "#0a0a0a",
          boxShadow: "none",
          padding: "clamp(0.45rem,0.9cqmin,1.5rem)",
          gap: "clamp(0.2rem,0.4cqmin,0.75rem)",
        }}
      >
        {/* Column header — inside the card */}
        <div
          className="relative flex flex-shrink-0 flex-col"
          style={{
            gap:           "clamp(0.35rem, 0.7cqmin, 0.8rem)",
            paddingTop:    "clamp(0.4rem, 0.9cqmin, 1rem)",
            marginBottom:  "0.4cqh",
          }}
        >
          {/* Title row: rule — LABEL — rule */}
          <div className="flex w-full items-center gap-2">
            <div className="h-px flex-1" style={ACCENT.ruleLeft} />
            <h3
              className={`flex-shrink-0 font-cinzel font-bold uppercase leading-none tracking-[0.32em] ${ACCENT.glowClass}`}
              style={{ fontSize: DEPT_HEADING_FONT, color: ACCENT.color }}
            >
              {label}
            </h3>
            <div className="h-px flex-1" style={ACCENT.ruleRight} />
          </div>
          {/* Bottom separator rule */}
          <div className="flex w-full items-center">
            <div className="h-px flex-1" style={ACCENT.ruleLeft} />
            <div className="h-px flex-1" style={ACCENT.ruleRight} />
          </div>
        </div>

        {/* Agent cards — vertical stack */}
        <div
          className="relative grid min-h-0 w-full flex-1 items-stretch"
          style={{
            gridTemplateColumns: "minmax(0, 1fr)",
            gridTemplateRows: `repeat(${Math.max(agents.length, 1)}, minmax(0, 1fr))`,
            gap: "clamp(0.3rem,0.7cqmin,1.1rem)",
          }}
        >
          {agents.map((agent, idx) => (
            <CompactAgentCard
              key={agent.id}
              agent={agent}
              column={column}
              prefersReducedMotion={prefersReducedMotion}
              staggerDelay={idx * 160}
              leadStatus={leadStatusByAgent[agent.name] ?? EMPTY_BREAKDOWN}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
