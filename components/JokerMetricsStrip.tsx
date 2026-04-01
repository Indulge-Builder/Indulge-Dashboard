"use client";

import { useMemo, type ReactNode } from "react";
import AnimatedCounter from "./AnimatedCounter";
import type { JokerStats } from "@/lib/types";

function safeNum(v: number | null | undefined): number {
  return typeof v === "number" && !Number.isNaN(v) ? v : 0;
}

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
  // Labels match QueendomPanel `MetricBox`; values match hero `AnimatedCounter`.
  const labelClass =
    "font-inter font-semibold text-[clamp(18px,2vw,26px)] tracking-[0.25em] uppercase text-champagne mb-[0.2vh]";
  const defaultValueClass = `font-cinzel font-bold text-8xl min-[900px]:text-9xl leading-none tracking-[0.06em] text-gold-300 tabular-nums`;
  const defaultSuffixClass =
    "font-inter text-[clamp(1.4rem,2.25vw,2.25rem)] text-white/45 font-semibold";

  return (
    <div
      className="flex flex-col items-center justify-center text-center flex-1 min-w-0 joker-box rounded-xl border border-liquid-gold-end/35"
      style={{ padding: "1.2vh clamp(6px, 0.8vw, 14px)" }}
    >
      <p className={labelClass}>{label}</p>
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
    </div>
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
 * All-time Joker stats from the `jokers` table — separate from the ticket “today / this month” hero row.
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

  /** Same section title as QueendomPanel “Special Dates”. */
  const jokerTitleClass =
    "font-inter font-semibold text-[clamp(1.05rem,1.4vw,1.6rem)] tracking-[0.4em] uppercase text-champagne";

  const innerGrid = (
    <div
      className={
        compact
          ? "grid grid-cols-3 gap-2 sm:gap-3 lg:gap-4 w-full"
          : "grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3 lg:gap-4 w-full relative"
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
        suffixClassName="font-inter text-[clamp(1.4rem,2.25vw,2.25rem)] text-champagne/45 font-semibold"
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
      <div className="flex-shrink-0 w-full mt-2 pt-3 border-t border-gold-500/15">
        <p className={`text-center ${jokerTitleClass} mb-[1.2vh]`}>
          {jokerName}
        </p>
        {innerGrid}
      </div>
    );
  }

  return (
    <div className="flex-shrink-0 mb-[1.6vh]">
      <div
        className="glass gold-border-glow rounded-2xl relative overflow-hidden"
        style={{ padding: "1.4vh clamp(10px, 2vw, 28px)" }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-gold-500/[0.06] to-transparent pointer-events-none rounded-2xl" />

        <p className={`text-center ${jokerTitleClass} mb-[1vh]`}>
          {jokerName}
        </p>

        {innerGrid}
      </div>
    </div>
  );
}
