"use client";

import { motion } from "framer-motion";
import { Users } from "lucide-react";
import AnimatedCounter from "./AnimatedCounter";

interface GoldPillProps {
  count: number;
  delay?: number;
}

export default function GoldPill({ count, delay = 0 }: GoldPillProps) {
  return (
    <motion.div
      className="glass-pill flex items-center gap-[clamp(6px,0.6vw,10px)] rounded-full select-none flex-shrink-0"
      style={{
        padding: "clamp(5px,0.55vh,9px) clamp(14px,1.4vw,22px)",
      }}
      initial={{ scale: 0.75, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 240, damping: 22, delay }}
    >
      <Users
        size={13}
        strokeWidth={2}
        className="text-gold-400/65 flex-shrink-0"
        style={{ width: "clamp(11px,1vw,15px)", height: "clamp(11px,1vw,15px)" }}
      />
      <AnimatedCounter
        value={count}
        className="font-inter text-[clamp(0.78rem,1.1vw,1rem)] leading-none tabular-nums text-gold-300 font-semibold tracking-widest"
        delay={delay * 1000 + 400}
      />
      <span className="font-inter text-[clamp(0.6rem,0.75vw,0.8rem)] tracking-[0.45em] uppercase text-gold-500/45 leading-none">
        Members
      </span>
    </motion.div>
  );
}
