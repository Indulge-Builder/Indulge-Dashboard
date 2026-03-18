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
      className="glass-pill flex items-center gap-[clamp(16px,1.6vw,24px)] rounded-full select-none flex-shrink-0"
      style={{
        padding: "clamp(16px,1.6vh,24px) clamp(36px,3.6vw,56px)",
        boxShadow: "0 0 16px rgba(212, 175, 55, 0.4), 0 0 32px rgba(212, 175, 55, 0.18)",
      }}
      initial={{ scale: 0.75, opacity: 0 }}
      animate={{
        scale: 1,
        opacity: 1,
        boxShadow: [
          "0 0 12px rgba(212, 175, 55, 0.35), 0 0 24px rgba(212, 175, 55, 0.15)",
          "0 0 28px rgba(212, 175, 55, 0.55), 0 0 48px rgba(212, 175, 55, 0.25)",
          "0 0 12px rgba(212, 175, 55, 0.35), 0 0 24px rgba(212, 175, 55, 0.15)",
        ],
      }}
      transition={{
        scale: { type: "spring", stiffness: 240, damping: 22, delay },
        opacity: { delay },
        boxShadow: {
          duration: 2.5,
          repeat: Infinity,
          ease: "easeInOut",
          delay: delay + 0.3,
        },
      }}
    >
      <Users
        size={36}
        strokeWidth={2}
        className="text-gold-400/65 flex-shrink-0"
        style={{ width: "clamp(32px,2.8vw,44px)", height: "clamp(32px,2.8vw,44px)" }}
      />
      <AnimatedCounter
        value={count}
        className="font-inter text-[clamp(2.2rem,3.2vw,3rem)] leading-none tabular-nums text-gold-300 font-bold tracking-widest"
        delay={delay * 1000 + 400}
      />
    </motion.div>
  );
}
