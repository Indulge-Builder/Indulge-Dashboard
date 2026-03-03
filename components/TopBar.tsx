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
      className="relative flex items-center justify-between px-12 border-b border-gold-500/15 z-10"
      style={{ height: "7.5vh" }}
      initial={{ opacity: 0, y: -28 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.9, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      {/* Ambient horizontal glow */}
      <div className="absolute inset-0 bg-gradient-to-r from-gold-500/5 via-gold-500/[0.02] to-gold-500/5 pointer-events-none" />

      {/* ── Date (left) ── */}
      <p className="font-inter text-[14px] tracking-[0.35em] uppercase text-gold-500 tabular-nums">
        {dateStr}
      </p>

      {/* ── Central Branding ── */}
      <div className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center select-none">
        <h1 className="font-playfair text-[1.65rem] tracking-[0.38em] text-gold-400 gold-glow uppercase leading-none">
          Indulge Global
        </h1>
        <div className="flex items-center gap-3 mt-[5px]">
          <div className="h-px w-14 bg-gradient-to-r from-transparent to-gold-500/50" />
          <span className="font-inter text-[8.5px] tracking-[0.55em] uppercase text-gold-500/40">
            Live Operations
          </span>
          <div className="h-px w-14 bg-gradient-to-l from-transparent to-gold-500/50" />
        </div>
      </div>

      {/* ── Live indicator + clock (right) ── */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          {/* Pulsing live dot */}
          <span className="relative flex h-2 w-2">
            <motion.span
              className="absolute inline-flex h-full w-full rounded-full bg-emerald-400/60"
              animate={{ scale: [1, 2.2, 1], opacity: [0.7, 0, 0.7] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
          </span>
          <span className="font-inter text-[10px] tracking-[0.35em] uppercase text-emerald-400/75">
            Live
          </span>
        </div>

        <p className="font-inter text-[14px] tracking-[0.35em] text-gold-400 tabular-nums">
          {timeStr}
        </p>
      </div>
    </motion.header>
  );
}
