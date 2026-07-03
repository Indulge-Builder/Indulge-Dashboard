"use client";

import { memo, type CSSProperties } from "react";
import { motion } from "framer-motion";
import AnimatedCounter from "@/components/AnimatedCounter";
import { usePulseOnChange } from "@/hooks/usePulseOnChange";
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
  /** Deep dept ink — nameplate text, dot, "Today" numerals. */
  color: string;
  /** Engraved nameplate plaque fill (dept-tinted gradient). */
  plaque: string;
  /** Name-flanking hairline gradients. */
  ruleLeft: CSSProperties;
  ruleRight: CSSProperties;
}

// font sizes intentionally omitted — applied via cqh inline styles inside the card
const METRIC_BOX_BASE =
  "flex min-w-0 flex-1 basis-0 flex-col items-center justify-center self-center text-center rounded-neu-chip border border-neu-edge bg-neu-surface shadow-neu-sm";
const METRIC_LABEL_CLASS =
  "font-montserrat shrink-0 font-semibold uppercase leading-none tracking-[0.25em] text-neu-t3";
const METRIC_VALUE_CLASS =
  "font-cinzel font-bold leading-none tracking-[0.06em] tabular-nums";

const ACCENTS: Record<Department, DeptAccent> = {
  concierge: {
    color: "var(--neu-concierge)",
    plaque:
      "linear-gradient(145deg, color-mix(in srgb, var(--neu-accent) 30%, var(--neu-surface)), color-mix(in srgb, var(--neu-accent) 12%, var(--neu-surface)))",
    ruleLeft: {
      background:
        "linear-gradient(to right, transparent, color-mix(in srgb, var(--neu-concierge) 55%, transparent))",
    },
    ruleRight: {
      background:
        "linear-gradient(to left, transparent, color-mix(in srgb, var(--neu-concierge) 55%, transparent))",
    },
  },
  shop: {
    color: "var(--neu-shop)",
    plaque:
      "linear-gradient(145deg, color-mix(in srgb, var(--neu-powder) 30%, var(--neu-surface)), color-mix(in srgb, var(--neu-powder) 12%, var(--neu-surface)))",
    ruleLeft: {
      background:
        "linear-gradient(to right, transparent, color-mix(in srgb, var(--neu-shop) 55%, transparent))",
    },
    ruleRight: {
      background:
        "linear-gradient(to left, transparent, color-mix(in srgb, var(--neu-shop) 55%, transparent))",
    },
  },
};

// -- AgentCardContent ---------------------------------------------------------

interface AgentCardContentProps {
  agent: OnboardingAgentRow;
  accent: DeptAccent;
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
  accent,
  leadsMonth,
  closedCount,
  staggerDelay,
  slide,
  monthPulse,
  todayPulse,
  closedPulse,
  leadStatus,
}: AgentCardContentProps) {
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
      }}
    >
      {/* Top zone: centered name flanked by dept hairlines */}
      <div style={{ flexShrink: 0 }} className="flex min-w-0 items-center gap-[clamp(0.4rem,0.55cqw,1rem)]">
        <div className="h-px flex-1 min-w-[1rem]" style={accent.ruleLeft} />
        <div
          className="min-w-0 truncate text-center font-cinzel font-bold uppercase leading-none tracking-[0.28em] neu-engraved"
          style={{
            fontSize: "clamp(1.9rem, 3.1cqw, 3.9rem)",
            color: accent.color,
            padding: "1cqh 0.5cqw",
          }}
        >
          {agent.name.trim()}
        </div>
        <div className="h-px flex-1 min-w-[1rem]" style={accent.ruleRight} />
      </div>

      {/* Middle zone: three raised metric tiles */}
      <div style={{ flex: "0 0 auto", minHeight: 0, display: "flex", alignItems: "stretch" }}>
        <div
          className="flex w-full min-w-0 flex-row items-stretch"
          style={{ minHeight: 0, gap: "clamp(3px, 1cqw, 14px)" }}
        >
        {/* Leads (This Month) */}
        <div className={METRIC_BOX_BASE} style={{ padding: "2cqh 1cqw" }}>
          <span
            className={METRIC_LABEL_CLASS}
            style={{ fontSize: "clamp(1.35rem, 1.9cqw, 2.3rem)", marginBottom: 0 }}
          >
            Leads <br /> (This Month)
          </span>
          <span
            className={`${METRIC_VALUE_CLASS} text-neu-t1 ${monthPulse ? "ob-metric-flash" : ""}`}
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
        <div className={METRIC_BOX_BASE} style={{ padding: "2cqh 1cqw" }}>
          <span
            className={`${METRIC_LABEL_CLASS} tracking-[0.22em]`}
            style={{ fontSize: "clamp(1.35rem, 1.9cqw, 2.3rem)", marginBottom: 0 }}
          >
            Leads <br /> (Today)
          </span>
          <span
            className={`${METRIC_VALUE_CLASS} ${todayPulse ? "ob-metric-flash" : ""}`}
            style={{
              fontSize: "clamp(1rem, 14cqh, 5.5rem)",
              color: accent.color,
              ["--ob-pulse-color" as string]: accent.color,
            } as CSSProperties}
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
            className={METRIC_LABEL_CLASS}
            style={{ fontSize: "clamp(1.35rem, 1.9cqw, 2.3rem)", marginBottom: 0 }}
          >
            Closures <br /> (This Month)
          </span>
          <span
            className={`${METRIC_VALUE_CLASS} text-neu-sage-deep ${closedPulse ? "ob-metric-flash" : ""}`}
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
      </div>

      {/* Bottom zone: pipeline (inset track + status-count chips) */}
      <div style={{ flexShrink: 0 }}>
        <LeadStatusHealthBar breakdown={leadStatus} />
      </div>
    </div>
  );
}

// -- CompactAgentCard ---------------------------------------------------------

interface CompactAgentCardProps {
  agent: OnboardingAgentRow;
  department: Department;
  prefersReducedMotion: boolean;
  accent: DeptAccent;
  staggerDelay: number;
  leadStatus?: AgentLeadStatusBreakdown;
}

const CompactAgentCard = memo(function CompactAgentCard({
  agent,
  department,
  prefersReducedMotion,
  accent,
  staggerDelay,
  leadStatus = EMPTY_BREAKDOWN,
}: CompactAgentCardProps) {
  const slide = !prefersReducedMotion;
  const isConcierge = department === "concierge";
  const leadsMonth = agent.leadsThisMonth ?? agent.leadsCreatedThisMonth;
  const closedCount = agent.totalConverted;
  const firstNameKey = agent.name.trim().toLowerCase().split(/[\s/,]/)[0];
  const idKey = agent.id.trim().toLowerCase();
  const isKatya = idKey === "katya" || firstNameKey === "katya";
  const isVikram = idKey === "vikram" || firstNameKey === "vikram";
  const useContainedPortrait = isKatya || isVikram;

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
        },
      };

  return (
    // Raised tile with a slow ambient bob (CSS transform keyframe, staggered
    // per card). Framer only animates opacity here, so the keyframe owns the
    // transform channel without conflict.
    <motion.div
      {...motionProps}
      className="relative flex h-full min-h-0 w-full items-stretch overflow-hidden neu-raised rounded-neu-tile neu-anim-bob-sm"
      style={{
        flexDirection: isConcierge ? "row" : "row-reverse",
        containerType: "size",
        animationDelay: `${index * 1.1}s`,
        willChange: "opacity",
      }}
    >
      {/* Portrait (40%) — raised tile */}
      <div
        className="border border-neu-edge shadow-neu-sm bg-neu-surface"
        style={{
          position: "relative",
          width: "40%",
          flexShrink: 0,
          overflow: "hidden",
          borderRadius: "var(--neu-radius-chip)",
          margin: "1cqh 0.6cqw",
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

      {/* Data panel (60%) */}
      <AgentCardContent
        agent={agent}
        accent={accent}
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

// -- DepartmentColumn ---------------------------------------------------------

export interface DepartmentColumnProps {
  department: Department;
  label: string;
  agents: OnboardingAgentRow[];
  prefersReducedMotion: boolean;
  leadStatusByAgent: LeadStatusByAgent;
}

export function DepartmentColumn({
  department,
  label,
  agents,
  prefersReducedMotion,
  leadStatusByAgent,
}: DepartmentColumnProps) {
  const accent = ACCENTS[department];

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Raised panel card */}
      <div
        className="relative flex min-h-0 flex-1 flex-col neu-raised rounded-neu-panel"
        style={{
          padding: "clamp(0.45rem,0.9cqmin,1.5rem)",
          gap: "clamp(0.2rem,0.4cqmin,0.75rem)",
        }}
      >
        {/* Department header — engraved nameplate plaque */}
        <div
          className="relative flex flex-shrink-0 justify-center"
          style={{
            paddingTop:   "clamp(0.4rem, 0.9cqmin, 1rem)",
            marginBottom: "0.4cqh",
          }}
        >
          <div
            className="neu-plaque flex items-center gap-[clamp(0.4rem,0.6cqw,1rem)]"
            style={{
              background: accent.plaque,
              padding: "0.75cqh 1.8cqw",
            }}
          >
            <span
              className="rounded-full neu-anim-dot-pulse flex-shrink-0"
              style={{
                width: "clamp(8px,0.42cqw,15px)",
                height: "clamp(8px,0.42cqw,15px)",
                background: accent.color,
              }}
              aria-hidden
            />
            <h3
              className="flex-shrink-0 font-cinzel font-bold uppercase leading-none tracking-[0.32em]"
              style={{ fontSize: DEPT_HEADING_FONT, color: accent.color }}
            >
              {label}
            </h3>
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
              department={department}
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
