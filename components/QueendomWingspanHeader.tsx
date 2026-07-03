"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";
import AnimatedCounter from "./AnimatedCounter";
import { EASE_LUXURY } from "@/lib/motionPresets";

// No backdrop-blur: the pill animates x on entrance, and backdrop-filter on a
// moving element forces a backdrop repaint every frame on TV GPUs.
// Neumorphic: raised pills with a gentle ambient bob (CSS keyframe — GPU-safe).
const pillBase =
  "flex min-w-0 max-w-full flex-wrap items-center gap-x-[clamp(1rem,1.2cqw,2.25rem)] gap-y-2 rounded-full neu-raised-sm neu-anim-bob-sm px-[clamp(1.25rem,1.5cqw,2.75rem)] py-[clamp(0.875rem,1.3cqh,1.75rem)]";

// Stacked variant: a softer rounded card (not a full pill) so the two-line
// block reads as one intentional unit rather than a squashed pill.
const stackedPillBase =
  "flex min-w-0 max-w-full flex-col gap-y-[clamp(0.5rem,0.9cqh,1.1rem)] rounded-[clamp(1.5rem,2cqw,2.75rem)] neu-raised-sm neu-anim-bob-sm px-[clamp(1.5rem,1.7cqw,3rem)] py-[clamp(0.875rem,1.3cqh,1.75rem)]";

function MetricPill({
  children,
  delaySec,
  slideFrom,
  stacked = false,
}: {
  children: ReactNode;
  delaySec: number;
  slideFrom: "left" | "right";
  stacked?: boolean;
}) {
  const xInit = slideFrom === "left" ? -12 : 12;
  return (
    <motion.div
      className="flex min-w-0 max-w-full"
      initial={{ opacity: 0, x: xInit }}
      animate={{ opacity: 1, x: 0 }}
      transition={{
        opacity: {
          duration: 0.55,
          delay: delaySec,
          ease: EASE_LUXURY,
        },
        x: { duration: 0.55, delay: delaySec, ease: EASE_LUXURY },
      }}
    >
      {/* Bob lives on an inner div — the CSS transform keyframe must never
          share an element with Framer's entrance transform. */}
      <div
        className={stacked ? stackedPillBase : pillBase}
        style={{ animationDelay: slideFrom === "right" ? "1.2s" : "0s" }}
      >
        {children}
      </div>
    </motion.div>
  );
}

/** Tier-3 field label (.label-field) — same caption voice as the hero metric
 *  labels and the leaderboard column headers. Pill labels are field captions,
 *  not section titles, so they share the quiet uniform tier (colour added at use). */
const metricLabelClass = "label-field shrink-0";

/** Paid / Unpaid numeric readout — +30% vs prior clamp(1.5rem, 2.4vw, 2.35rem) */
const pillNumberSizeClass = "text-[clamp(2.15rem,3.45cqw,3.45rem)]";

/** Neutral readout — primary ink with a letterpress lift (glows retired) */
const unpaidNumberClass = `font-montserrat ${pillNumberSizeClass} font-bold leading-none tracking-widest text-neu-t1 tabular-nums neu-letterpress`;

interface QueendomWingspanHeaderProps {
  name: string;
  membersTotal: number;
  complimentaryCount: number;
  /** Clients whose latest_subscription_status is Expired (To Be Revived pill). */
  toBeRevivedCount: number;
  /** Base delay in ms for AnimatedCounter entrance stagger */
  delayMs: number;
}

export default function QueendomWingspanHeader({
  name,
  membersTotal,
  complimentaryCount,
  toBeRevivedCount,
  delayMs,
}: QueendomWingspanHeaderProps) {
  const leftDelay = delayMs + 400;
  const rightDelay = delayMs + 520;
  const revivedDelay = delayMs + 640;
  const delayLeftSec = delayMs / 1000;
  const delayRightSec = delayMs / 1000 + 0.04;

  return (
    <div className="w-full px-2 pt-2 pb-0 min-[500px]:px-4 min-[500px]:pt-3 min-[500px]:pb-0 sm:px-5">
      <div className="grid w-full grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-x-[clamp(0.75rem,1.5cqw,3rem)] gap-y-4">
        {/* Left metric — hug center (end-aligned in column) */}
        <div className="flex min-w-0 justify-end justify-self-stretch pr-1 sm:pr-2">
          <MetricPill delaySec={delayLeftSec} slideFrom="left">
            <span className={`${metricLabelClass} text-neu-t2`}>Paid</span>
            <AnimatedCounter
              value={membersTotal}
              className={`font-montserrat ${pillNumberSizeClass} font-bold leading-none tracking-widest text-neu-accent-deep tabular-nums neu-letterpress`}
              delay={leftDelay}
              slideOnChange
            />
          </MetricPill>
        </div>

        {/* Center — Queendom name (letterpress ink, glow retired) */}
        <h2 className="font-cinzel min-w-0 justify-self-center px-2 text-center text-6xl min-[900px]:text-7xl xl:text-8xl tracking-[0.28em] text-neu-t1 neu-letterpress uppercase leading-none font-bold">
          {name}
        </h2>

        {/* Right metric — Celebrity over To Be Revived in one stacked pill */}
        <div className="flex min-w-0 justify-start justify-self-stretch pl-1 sm:pl-2">
          <MetricPill delaySec={delayRightSec} slideFrom="right" stacked>
            <div className="flex min-w-0 items-center justify-center gap-x-[clamp(1rem,1.2cqw,2.25rem)]">
              <span className={`${metricLabelClass} text-neu-t2`}>Celebrity</span>
              <AnimatedCounter
                value={complimentaryCount}
                className={unpaidNumberClass}
                delay={rightDelay}
                slideOnChange
              />
            </div>
            <div aria-hidden className="h-px w-full bg-neu-hairline" />
            <div className="flex min-w-0 items-center justify-center gap-x-[clamp(1rem,1.2cqw,2.25rem)]">
              <span className={`${metricLabelClass} text-neu-t2`}>To Be Revived</span>
              <AnimatedCounter
                value={toBeRevivedCount}
                className={unpaidNumberClass}
                delay={revivedDelay}
                slideOnChange
              />
            </div>
          </MetricPill>
        </div>
      </div>
    </div>
  );
}
