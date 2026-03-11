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
      className="flex items-center gap-2 bg-gradient-to-r from-yellow-600 to-yellow-400 text-black font-bold rounded-full px-5 py-1.5 shadow-[0_0_15px_rgba(234,179,8,0.3)] select-none flex-shrink-0"
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 260, damping: 20, delay }}
    >
      <Users size={15} strokeWidth={2.5} />
      <AnimatedCounter
        value={count}
        className="font-baskerville text-[1rem] leading-none tabular-nums"
        delay={delay * 1000 + 400}
      />
    </motion.div>
  );
}
