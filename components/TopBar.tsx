"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

export default function TopBar() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const dateStr = now
    ? now.toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "";

  const timeStr = now
    ? now.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : "";

  return (
    <motion.header
      className="relative flex items-center justify-between px-4 sm:px-8 lg:px-12 border-b border-gold-500/15 z-10 flex-shrink-0"
      style={{ height: "12vh", minHeight: "64px", maxHeight: "110px" }}
      initial={{ opacity: 0, y: -28 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.9, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      {/* Ambient horizontal glow */}
      <div className="absolute inset-0 bg-gradient-to-r from-gold-500/5 via-gold-500/[0.02] to-gold-500/5 pointer-events-none" />

      {/* ── Date (left) — hidden on small screens ── */}
      <p className="hidden md:block font-inter text-[clamp(16px,2.05vw,30px)] tracking-[0.35em] uppercase text-gold-500 tabular-nums flex-shrink-0">
        {dateStr}
      </p>
      {/* Spacer so branding stays centred when date is hidden */}
      <div className="md:hidden flex-1" />

      {/* ── Central Branding ── */}
      <div className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center select-none">
        <h1 className="font-cinzel text-[clamp(1.4rem,3.1vw,2.95rem)] tracking-[0.3em] sm:tracking-[0.38em] text-gold-400 gold-glow uppercase leading-none whitespace-nowrap">
          Indulge Global
        </h1>
      </div>

      {/* ── Clock + Live (right) ── */}
      <div className="flex h-full items-center justify-end gap-4 sm:gap-6 flex-shrink-0">
        <p className="font-inter text-[clamp(18px,2.25vw,32px)] tracking-[0.25em] sm:tracking-[0.35em] text-gold-400 tabular-nums">
          {timeStr}
        </p>
        <span className="inline-flex items-center rounded-full border border-gold-500/40 bg-gold-500/5 px-4 py-1.5 font-inter text-[clamp(16px,1.85vw,28px)] tracking-[0.3em] uppercase text-gold-400 shadow-[0_0_12px_rgba(201,168,76,0.15)]">
          Live
        </span>
      </div>
    </motion.header>
  );
}
