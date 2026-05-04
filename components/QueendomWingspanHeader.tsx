"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";
import AnimatedCounter from "./AnimatedCounter";

const pillBase =
  "flex min-w-0 max-w-full flex-wrap items-center gap-x-4 gap-y-2 rounded-full border border-gold-500/20 bg-black/40 px-5 py-3.5 min-[500px]:gap-x-5 min-[500px]:px-6 min-[500px]:py-4 backdrop-blur-md shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]";

function MetricPill({
  children,
  delaySec,
  slideFrom,
}: {
  children: ReactNode;
  delaySec: number;
  slideFrom: "left" | "right";
}) {
  const xInit = slideFrom === "left" ? -12 : 12;
  return (
    <motion.div
      className={pillBase}
      initial={{ opacity: 0, x: xInit }}
      animate={{ opacity: 1, x: 0 }}
      transition={{
        opacity: {
          duration: 0.55,
          delay: delaySec,
          ease: [0.25, 0.46, 0.45, 0.94],
        },
        x: { duration: 0.55, delay: delaySec, ease: [0.25, 0.46, 0.45, 0.94] },
      }}
    >
      {children}
    </motion.div>
  );
}

/** Matches `MetricBox` / 5-metric hero label typography in QueendomPanel */
const metricLabelClass =
  "font-inter shrink-0 font-semibold text-[var(--text-label-xl)] tracking-[0.25em] uppercase leading-none";

/** Paid / Unpaid numeric readout — +30% vs prior clamp(1.5rem, 2.4vw, 2.35rem) */
const pillNumberSizeClass =
  "text-[clamp(2.15rem,3.45vw,3.45rem)]";

/** White readout with a softer gold aura than `gold-glow` on paid — still “ours,” still cherished */
const unpaidNumberClass =
  `font-inter ${pillNumberSizeClass} font-bold leading-none tracking-widest text-white tabular-nums [text-shadow:0_0_12px_rgba(212,175,55,0.42),0_0_26px_rgba(212,175,55,0.2),0_1px_0_rgba(253,230,138,0.28)]`;

interface QueendomWingspanHeaderProps {
  name: string;
  membersTotal: number;
  complimentaryCount: number;
  /** Base delay in ms for AnimatedCounter entrance stagger */
  delayMs: number;
}

export default function QueendomWingspanHeader({
  name,
  membersTotal,
  complimentaryCount,
  delayMs,
}: QueendomWingspanHeaderProps) {
  const leftDelay = delayMs + 400;
  const rightDelay = delayMs + 520;
  const delayLeftSec = delayMs / 1000;
  const delayRightSec = delayMs / 1000 + 0.04;

  return (
    <div className="w-full px-2 pt-2 pb-0 min-[500px]:px-4 min-[500px]:pt-3 min-[500px]:pb-0 sm:px-5">
      <div className="grid w-full grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-x-3 gap-y-4 min-[500px]:gap-x-4 sm:gap-x-5 lg:gap-x-6">
        {/* Left metric — hug center (end-aligned in column) */}
        <div className="flex min-w-0 justify-end justify-self-stretch pr-1 sm:pr-2">
          <MetricPill delaySec={delayLeftSec} slideFrom="left">
            <span className={`${metricLabelClass} text-champagne`}>Paid</span>
            <AnimatedCounter
              value={membersTotal}
              className={`font-inter ${pillNumberSizeClass} font-bold leading-none tracking-widest text-gold-300 tabular-nums gold-glow`}
              delay={leftDelay}
              slideOnChange
            />
          </MetricPill>
        </div>

        {/* Center — Queendom name (original broadcast styling) */}
        <h2 className="font-cinzel min-w-0 justify-self-center px-2 text-center text-6xl min-[900px]:text-7xl xl:text-8xl tracking-[0.28em] text-gold-400 queen-name-glow uppercase leading-none font-bold">
          {name}
        </h2>

        {/* Right metric — hug center (start-aligned in column) */}
        <div className="flex min-w-0 justify-start justify-self-stretch pl-1 sm:pl-2">
          <MetricPill delaySec={delayRightSec} slideFrom="right">
            <span className={`${metricLabelClass} text-champagne`}>Unpaid</span>
            <AnimatedCounter
              value={complimentaryCount}
              className={unpaidNumberClass}
              delay={rightDelay}
              slideOnChange
            />
          </MetricPill>
        </div>
      </div>
    </div>
  );
}
