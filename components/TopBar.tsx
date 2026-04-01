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
      className="relative flex items-center justify-between px-6 sm:px-12 lg:px-[4.5rem] border-b border-gold-500/15 z-10 flex-shrink-0"
      style={{ height: "18vh", minHeight: "96px", maxHeight: "165px" }}
      initial={{ opacity: 0, y: -42 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.9, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      {/* Ambient horizontal glow */}
      <div className="absolute inset-0 bg-gradient-to-r from-gold-500/5 via-gold-500/[0.02] to-gold-500/5 pointer-events-none" />

      {/* ── Date (left) — hidden on small screens ── */}
      <p className="hidden md:block font-inter text-[clamp(24px,3.075vw,45px)] tracking-[0.35em] uppercase text-gold-500 tabular-nums flex-shrink-0">
        {dateStr}
      </p>
      {/* Spacer so branding stays centred when date is hidden */}
      <div className="md:hidden flex-1" />

      {/* ── Central Branding ── */}
      <div className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center select-none">
        <h1 className="font-cinzel text-[clamp(2.1rem,4.65vw,4.425rem)] tracking-[0.3em] sm:tracking-[0.38em] text-gold-400 gold-glow uppercase leading-none whitespace-nowrap">
          Indulge Global
        </h1>
      </div>

      {/* ── Clock + Live (right) ── */}
      <div className="flex h-full items-center justify-end gap-6 sm:gap-9 flex-shrink-0">
        <p className="font-inter text-[clamp(27px,3.375vw,48px)] tracking-[0.25em] sm:tracking-[0.35em] text-gold-400 tabular-nums">
          {timeStr}
        </p>
        <span className="inline-flex items-center rounded-full border border-gold-500/40 bg-gold-500/5 px-6 py-[0.5625rem] font-inter text-[clamp(24px,2.775vw,42px)] tracking-[0.3em] uppercase text-gold-400 shadow-[0_0_18px_rgba(201,168,76,0.15)]">
          Live
        </span>
      </div>
    </motion.header>
  );
}
