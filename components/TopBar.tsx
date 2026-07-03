"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { EASE_LUXURY } from "@/lib/motionPresets";

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
      className="relative flex items-center justify-between px-6 sm:px-12 lg:px-[4.5rem] neu-raised rounded-neu-field z-10 flex-shrink-0 mx-[0.6cqw] mt-[0.8cqh]"
      style={{ height: "18cqh", minHeight: "96px", maxHeight: "165px" }}
      initial={{ opacity: 0, y: -42 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.9, ease: EASE_LUXURY }}
    >
      {/* ── Date (left) — hidden on small screens ── */}
      <LiveTimeText
        formatter={DATE_FORMATTER}
        className="hidden md:block font-montserrat text-[clamp(24px,3.075cqw,45px)] tracking-[0.35em] uppercase text-neu-t2 tabular-nums flex-shrink-0"
      />
      {/* Spacer so branding stays centred when date is hidden */}
      <div className="md:hidden flex-1" />

      {/* ── Central Branding — title case, letterpress (glows retired) ── */}
      <div className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center select-none">
        <h1 className="font-cinzel font-extrabold text-[clamp(2.1rem,4.65cqw,4.425rem)] tracking-[0.3em] sm:tracking-[0.38em] text-neu-accent-deep neu-letterpress leading-none whitespace-nowrap">
          Indulge Global
        </h1>
      </div>

      {/* ── Raised clock pill (right): pulsing sage live-dot · time · IST tag ── */}
      <div className="flex h-full items-center justify-end gap-[clamp(1.5rem,2cqw,4rem)] flex-shrink-0">
        <span className="inline-flex items-center gap-[clamp(0.75rem,0.9cqw,1.75rem)] rounded-full neu-raised-sm px-6 py-[0.5625rem]">
          <span
            className="inline-block rounded-full bg-neu-sage-deep neu-anim-dot-pulse flex-shrink-0"
            style={{ width: "clamp(10px,0.5cqw,18px)", height: "clamp(10px,0.5cqw,18px)" }}
            aria-hidden
          />
          <LiveTimeText
            formatter={TIME_FORMATTER}
            className="font-montserrat text-[clamp(27px,3.375cqw,48px)] tracking-[0.25em] sm:tracking-[0.35em] text-neu-t1 tabular-nums"
          />
          <span className="font-montserrat font-semibold text-[clamp(16px,1.5cqw,26px)] tracking-[0.3em] uppercase text-neu-t3">
            IST
          </span>
        </span>
      </div>
    </motion.header>
  );
}
