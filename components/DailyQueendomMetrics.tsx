"use client";

import { motion } from "framer-motion";
import AnimatedCounter from "./AnimatedCounter";
import type { TicketStats } from "@/lib/types";

interface DailyQueendomMetricsProps {
  tickets: TicketStats;
  /** Same `delay` value (in ms) passed down from QueendomPanel for stagger sync */
  delay?: number;
}

export default function DailyQueendomMetrics({
  tickets,
  delay = 0,
}: DailyQueendomMetricsProps) {
  // Total daily = tickets that are either resolved or still in flight today
  const totalToday = tickets.solvedToday + tickets.pendingToResolve;

  return (
    <motion.div
      className="flex-shrink-0 mb-[1.4vh]"
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.7,
        ease: [0.25, 0.46, 0.45, 0.94],
        delay: delay / 1000 + 0.12,
      }}
    >
      <div
        className="glass gold-border-glow rounded-2xl relative overflow-hidden"
        style={{ padding: "1.3vh clamp(10px, 2vw, 28px)" }}
      >
        {/* Subtle inner gradient wash */}
        <div className="absolute inset-0 bg-gradient-to-br from-gold-500/[0.03] to-transparent pointer-events-none rounded-2xl" />

        {/* Section eyebrow */}
        <p className="font-inter text-[clamp(9px,0.75vw,11px)] tracking-[0.60em] uppercase text-gold-500/35 mb-[0.75vh] text-center relative z-10">
          Daily Queendom
        </p>

        {/* 3-column metric grid divided by hairline borders */}
        <div className="grid grid-cols-3 divide-x divide-gold-500/[0.10] relative z-10">
          {/* ── Total ── */}
          <div className="flex flex-col items-center justify-center text-center px-[1vw] py-[0.2vh]">
            <AnimatedCounter
              value={totalToday}
              className="font-edu text-[clamp(2rem,3.2vw,4.2rem)] leading-none tabular-nums text-white/88"
              delay={delay + 700}
            />
            <p className="font-inter text-[clamp(8px,0.75vw,10px)] tracking-[0.50em] uppercase text-white/32 mt-[0.3vh]">
              Total
            </p>
          </div>

          {/* ── Solved ── muted gold-olive to signal completion */}
          <div className="flex flex-col items-center justify-center text-center px-[1vw] py-[0.2vh]">
            <AnimatedCounter
              value={tickets.solvedToday}
              className="font-edu text-[clamp(2rem,3.2vw,4.2rem)] leading-none tabular-nums text-olive-400"
              delay={delay + 870}
            />
            <p className="font-inter text-[clamp(8px,0.75vw,10px)] tracking-[0.50em] uppercase text-olive-400/55 mt-[0.3vh]">
              Solved
            </p>
          </div>

          {/* ── Pending ── recessive 40% white so it reads as a secondary signal */}
          <div className="flex flex-col items-center justify-center text-center px-[1vw] py-[0.2vh]">
            <AnimatedCounter
              value={tickets.pendingToResolve}
              className="font-edu text-[clamp(2rem,3.2vw,4.2rem)] leading-none tabular-nums text-white/40"
              delay={delay + 1040}
            />
            <p className="font-inter text-[clamp(8px,0.75vw,10px)] tracking-[0.50em] uppercase text-white/22 mt-[0.3vh]">
              Pending
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
