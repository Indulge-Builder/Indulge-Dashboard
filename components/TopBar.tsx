"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

// Module-level singletons — toLocale*String constructs a new Intl.DateTimeFormat
// on every call, which is expensive on TV CPUs and was happening twice per
// second, 24/7. Output is identical.
// Pinned to IST (dry-audit D7): the TV box runs in IST so output is unchanged,
// but a deploy to a UTC kiosk no longer silently shifts the clock.
const DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  year: "numeric",
  month: "long",
  day: "numeric",
  timeZone: "Asia/Kolkata",
});

const TIME_FORMATTER = new Intl.DateTimeFormat("en-US", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  timeZone: "Asia/Kolkata",
});

/**
 * Self-ticking time text (dry-audit H4): the per-second setState lives here,
 * so only this <p> re-renders every second — not the whole header tree.
 */
function LiveTimeText({
  formatter,
  className,
}: {
  formatter: Intl.DateTimeFormat;
  className: string;
}) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  return <p className={className}>{now ? formatter.format(now) : ""}</p>;
}

export default function TopBar() {
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
      <LiveTimeText
        formatter={DATE_FORMATTER}
        className="hidden md:block font-inter text-[clamp(24px,3.075vw,45px)] tracking-[0.35em] uppercase text-gold-500 tabular-nums flex-shrink-0"
      />
      {/* Spacer so branding stays centred when date is hidden */}
      <div className="md:hidden flex-1" />

      {/* ── Central Branding ── */}
      <div className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center select-none">
        <h1 className="font-cinzel text-[clamp(2.1rem,4.65vw,4.425rem)] tracking-[0.3em] sm:tracking-[0.38em] text-gold-400 gold-glow uppercase leading-none whitespace-nowrap">
          Indulge Global
        </h1>
      </div>

      {/* ── Clock + Live (right) ── */}
      <div className="flex h-full items-center justify-end gap-[clamp(1.5rem,2vw,4rem)] flex-shrink-0">
        <LiveTimeText
          formatter={TIME_FORMATTER}
          className="font-inter text-[clamp(27px,3.375vw,48px)] tracking-[0.25em] sm:tracking-[0.35em] text-gold-400 tabular-nums"
        />
        <span className="inline-flex items-center rounded-full border border-gold-500/40 bg-gold-500/5 px-6 py-[0.5625rem] font-inter text-[clamp(24px,2.775vw,42px)] tracking-[0.3em] uppercase text-gold-400 shadow-[0_0_18px_rgba(201,168,76,0.15)]">
          Live
        </span>
      </div>
    </motion.header>
  );
}
