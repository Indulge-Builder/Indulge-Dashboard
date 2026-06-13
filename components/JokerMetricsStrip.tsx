"use client";

import { useMemo, type ReactNode } from "react";
import AnimatedCounter from "./AnimatedCounter";
import { StatCard } from "@/components/ui/StatCard";
import { GoldGlassCard } from "@/components/ui/GoldGlassCard";
import { safeNum } from "@/lib/format";
import type { JokerStats } from "@/lib/types";

function JokerMetricBox({
  label,
  value,
  delay,
  valueClassName,
  suffix,
  suffixClassName,
}: {
  label: ReactNode;
  value: number;
  delay: number;
  valueClassName?: string;
  suffix?: ReactNode;
  suffixClassName?: string;
}) {
  // Labels match QueendomPanel `MetricBox` / RenewalsPanel RENEWALS; values match hero `AnimatedCounter`.
  const defaultValueClass = `font-cinzel font-bold text-8xl min-[900px]:text-9xl leading-none tracking-[0.06em] text-gold-300 tabular-nums`;
  const defaultSuffixClass =
    "font-inter text-[clamp(2.1rem,3.375vw,3.375rem)] text-white/45 font-semibold";

  return (
    <StatCard
      surfaceClass="flex flex-col items-center justify-center text-center flex-1 min-w-0 joker-box rounded-xl border border-liquid-gold-end/35"
      style={{ padding: "1.2vh var(--pad-cell)" }}
      labelClass="font-inter font-semibold text-[var(--text-label-xl)] tracking-[0.25em] uppercase text-champagne mb-[0.2vh]"
      label={label}
    >
      <div className="flex items-baseline justify-center gap-0.5">
        <AnimatedCounter
          value={value}
          className={valueClassName ?? defaultValueClass}
          delay={delay}
          slideOnChange
        />
        {suffix != null ? (
          <span className={suffixClassName ?? defaultSuffixClass}>{suffix}</span>
        ) : null}
      </div>
    </StatCard>
  );
}

interface JokerMetricsStripProps {
  jokerName: string;
  joker: JokerStats;
  baseDelayMs: number;
  /** Sits under the leaderboard inside the same glass card — no duplicate outer frame. */
  compact?: boolean;
}

/**
 * Joker stats for the current IST calendar month (`GET /api/jokers`) — same cohort as the Spoiled hero tile.
 * Acceptance score = Yes ÷ (Yes + No), excluding pending / blank responses.
 */
export default function JokerMetricsStrip({
  jokerName,
  joker,
  baseDelayMs,
  compact = false,
}: JokerMetricsStripProps) {
  const uniqueIdeas = useMemo(
    () => safeNum(joker.uniqueSuggestionsCount),
    [joker.uniqueSuggestionsCount],
  );
  const yesCount = useMemo(() => safeNum(joker.acceptedCount), [joker.acceptedCount]);
  const rejected = useMemo(() => safeNum(joker.rejectedCount), [joker.rejectedCount]);
  const totalRows = useMemo(
    () => safeNum(joker.totalSent ?? joker.totalSuggestions),
    [joker.totalSent, joker.totalSuggestions],
  );

  const acceptancePct = useMemo(() => {
    const decided = yesCount + rejected;
    return decided > 0 ? Math.round((yesCount / decided) * 100) : 0;
  }, [yesCount, rejected]);

  const yesValueClass =
    "font-cinzel font-bold text-8xl min-[900px]:text-9xl leading-none tracking-[0.06em] text-emerald-400 tabular-nums";
  const accValueClass =
    "font-cinzel font-bold text-8xl min-[900px]:text-9xl leading-none tracking-[0.06em] text-gold-300 tabular-nums";

  /** Same section title as RenewalsPanel “Latest Renewals” / “Latest Members”. */
  const jokerTitleClass =
    "font-inter font-semibold text-[clamp(1.575rem,2.1vw,2.4rem)] tracking-[0.4em] uppercase text-champagne";

  const innerGrid = (
    <div
      className={
        compact
          ? "grid grid-cols-3 gap-[var(--gap-metric)] w-full"
          : "grid grid-cols-1 sm:grid-cols-3 gap-[var(--gap-metric)] w-full relative"
      }
    >
      <JokerMetricBox
        label="Recommendations"
        value={uniqueIdeas}
        delay={baseDelayMs + 150}
      />
      <JokerMetricBox
        label="Responses"
        value={yesCount}
        delay={baseDelayMs + 250}
        valueClassName={yesValueClass}
        suffix={
          <>
            / {totalRows}
          </>
        }
        suffixClassName="font-inter text-[clamp(2.1rem,3.375vw,3.375rem)] text-champagne/45 font-semibold"
      />
      <JokerMetricBox
        label="Acceptance Rate"
        value={acceptancePct}
        delay={baseDelayMs + 350}
        valueClassName={accValueClass}
        suffix="%"
      />
    </div>
  );

  if (compact) {
    return (
      <div className="w-full flex-shrink-0">
        <p className={`text-center ${jokerTitleClass} mb-[1.2vh]`}>
          {jokerName}
        </p>
        {innerGrid}
      </div>
    );
  }

  return (
    <div className="flex-shrink-0 mb-[1.6vh]">
      <GoldGlassCard
        overlayClass="bg-gradient-to-br from-gold-500/[0.06] to-transparent"
        style={{ padding: "1.4vh var(--pad-card)" }}
      >
        <p className={`text-center ${jokerTitleClass} mb-[1vh]`}>
          {jokerName}
        </p>

        {innerGrid}
      </GoldGlassCard>
    </div>
  );
}
