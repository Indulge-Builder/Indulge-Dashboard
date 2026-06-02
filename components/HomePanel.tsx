"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Clock from "react-clock";
import "react-clock/dist/Clock.css";

import { GlassPanel } from "@/components/ui/GlassPanel";
import { SectionDivider } from "@/components/ui/SectionDivider";
import {
  gpuStyle,
  itemVariants,
  containerVariants,
  widgetFadeIn,
  EASE_LUXURY,
} from "@/lib/motionPresets";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";

// ─── Data ─────────────────────────────────────────────────────────────────────

const CITY_CLOCKS = [
  { label: "MUMBAI",   timezone: "Asia/Kolkata"     },
  { label: "LONDON",   timezone: "Europe/London"    },
  { label: "NEW YORK", timezone: "America/New_York" },
  { label: "DUBAI",    timezone: "Asia/Dubai"       },
] as const;

type CityClockEntry = (typeof CITY_CLOCKS)[number];

const DAILY_QUOTES = [
  {
    text:        "Elegance is not about being noticed, it is about being remembered.",
    attribution: "— Giorgio Armani",
  },
  {
    text:        "Details make perfection, and perfection is not a detail.",
    attribution: "— Leonardo da Vinci",
  },
  {
    text:        "Luxury is attention to detail, originality, exclusivity, and above all, quality.",
    attribution: "— Angelo Bonati",
  },
  {
    text:        "We are ladies and gentlemen, serving ladies and gentlemen.",
    attribution: "— The Ritz-Carlton Credo",
  },
  {
    text:        "Excellence is doing ordinary things extraordinarily well.",
    attribution: "— John W. Gardner",
  },
  {
    text:        "Perfection is achieved not when there is nothing more to add, but when there is nothing left to take away.",
    attribution: "— Antoine de Saint-Exupéry",
  },
  {
    text:        "Quality in a service or product is not what you put into it. It is what the client gets out of it.",
    attribution: "— Peter Drucker",
  },
  {
    text:        "Your work is going to fill a large part of your life, and the only way to be truly satisfied is to do what you believe is great work.",
    attribution: "— Steve Jobs",
  },
  {
    text:        "Give them quality. That is the best kind of advertising in the world.",
    attribution: "— Milton Hershey",
  },
  {
    text:        "The difference between something good and something great is attention to detail.",
    attribution: "— Charles R. Swindoll",
  },
  {
    text:        "Luxury must be comfortable, otherwise it is not luxury.",
    attribution: "— Coco Chanel",
  },
  {
    text:        "I want to give people the time of their lives — a place where everything is perfect.",
    attribution: "— César Ritz",
  },
] as const;

type DailyQuote = (typeof DAILY_QUOTES)[number];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Derive a local Date object in the given IANA timezone from a UTC base Date.
 * Uses Intl.DateTimeFormat.formatToParts — no external library required.
 */
function getCityDate(timezone: string, base: Date): Date {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year:     "numeric",
    month:    "numeric",
    day:      "numeric",
    hour:     "numeric",
    minute:   "numeric",
    second:   "numeric",
    hour12:   false,
  }).formatToParts(base);

  const n = (type: string): number =>
    parseInt(parts.find((p) => p.type === type)?.value ?? "0", 10);

  // hour12:false can return "24" for midnight; normalise to 0
  return new Date(n("year"), n("month") - 1, n("day"), n("hour") % 24, n("minute"), n("second"));
}

/** Format base Date as 12-hour time string in the given timezone. */
function getDigitalTime(timezone: string, base: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour:     "2-digit",
    minute:   "2-digit",
    second:   "2-digit",
    hour12:   true,
  }).format(base);
}

// ─── Clock Card ───────────────────────────────────────────────────────────────

interface ClockCardProps {
  entry:    CityClockEntry;
  baseDate: Date;
  reduced:  boolean;
}

function ClockCard({ entry, baseDate, reduced }: ClockCardProps) {
  const cityDate = getCityDate(entry.timezone, baseDate);
  const digital  = getDigitalTime(entry.timezone, baseDate);

  return (
    <motion.div variants={reduced ? undefined : itemVariants} style={gpuStyle}>
      <GlassPanel variant="card" radius="panel" shadow="md" glow overlay>
        {/* Inner flex wrapper — GlassPanel's overlay prop wraps children in a
            plain block div, so centering must live here, not on GlassPanel */}
        <div className="flex flex-col items-center justify-center gap-[clamp(0.5rem,1vh,1.1rem)] px-[clamp(1rem,2.5vw,2.25rem)] py-[clamp(0.85rem,1.6vh,1.75rem)]">
          <div
            className="home-panel-clock flex-shrink-0"
            style={{
              width:  "clamp(130px, 13vw, 210px)",
              height: "clamp(130px, 13vw, 210px)",
            }}
          >
            <Clock value={cityDate} renderNumbers={false} />
          </div>

          <p
            className="font-cinzel font-semibold uppercase tracking-[0.3em] text-gold-400 queen-name-glow text-center leading-none"
            style={{ fontSize: "var(--text-label-lg)" }}
          >
            {entry.label}
          </p>

          <p
            className="font-inter tabular-nums tracking-[0.2em] text-champagne/70 text-center leading-none"
            style={{ fontSize: "clamp(0.85rem, 1.1vw, 1.35rem)" }}
          >
            {digital}
          </p>
        </div>
      </GlassPanel>
    </motion.div>
  );
}

// ─── Home Panel ───────────────────────────────────────────────────────────────

export default function HomePanel() {
  const [now, setNow] = useState<Date>(() => new Date());
  const reduced       = usePrefersReducedMotion();

  // One interval drives all 4 clocks simultaneously
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const todayQuote: DailyQuote =
    DAILY_QUOTES[new Date().getDate() % DAILY_QUOTES.length];

  // Spread-safe animation props derived from reduced-motion preference
  const quoteWrapperAnim = reduced ? { ...widgetFadeIn(0), animate: { opacity: 1, y: 0 } } : widgetFadeIn(300);

  return (
    <div className="relative h-full w-full min-h-0 overflow-hidden flex flex-col bg-obsidian">
      {/* Ambient radial warmth */}
      <div className="pointer-events-none absolute inset-0 ambient-glow-center" aria-hidden />

      {/* ── Panel content — padding mirrors QueendomPanel/OnboardingLayout ── */}
      <div
        className="relative z-[1] flex-1 min-h-0 flex flex-col overflow-hidden gap-[clamp(0.4rem,0.8vh,0.9rem)]"
        style={{ padding: "2vh clamp(12px, 3vw, 40px) clamp(10px, 1.5vh, 20px)" }}
      >

        {/* ── Panel identity row — centered, flanked by gold rules ────────── */}
        <div className="flex-shrink-0 text-center">
          <SectionDivider className="mb-[0.6vh]" />
          <div className="flex flex-col items-center gap-[0.25em] py-[0.5vh]">
            <p
              className="font-inter uppercase tracking-[0.38em] text-champagne/45 leading-none"
              style={{ fontSize: "clamp(0.8rem, 1vw, 1.2rem)" }}
            >
              INDULGE LIVE
            </p>
            <h2
              className="font-cinzel font-bold uppercase tracking-[0.35em] text-gold-400 queen-name-glow leading-none"
              style={{ fontSize: "var(--text-heading-md)" }}
            >
              HOME
            </h2>
          </div>
          <SectionDivider className="mt-[0.6vh]" />
        </div>

        {/* ── World Clocks ────────────────────────────────────────────────── */}
        <motion.div
          variants={reduced ? undefined : containerVariants}
          initial={reduced ? false : "hidden"}
          animate={reduced ? undefined : "visible"}
          style={gpuStyle}
          className="grid grid-cols-4 gap-[clamp(0.75rem,1.6vw,2rem)] flex-shrink-0"
        >
          {CITY_CLOCKS.map((entry) => (
            <ClockCard
              key={entry.timezone}
              entry={entry}
              baseDate={now}
              reduced={reduced}
            />
          ))}
        </motion.div>

        <SectionDivider className="flex-shrink-0" />

        {/* ── Daily Quote ─────────────────────────────────────────────────── */}
        <div className="flex-[1] min-h-0 flex items-center justify-center overflow-hidden">
          <motion.div
            {...quoteWrapperAnim}
            style={gpuStyle}
            className="flex flex-col items-center gap-[clamp(0.4rem,0.8vh,0.9rem)] max-w-5xl mx-auto text-center px-6 w-full"
          >
            <p
              className="font-inter uppercase tracking-[0.5em] text-gold-400/60"
              style={{ fontSize: "clamp(0.75rem, 1vw, 1.1rem)" }}
            >
              DAILY REFLECTION
            </p>

            <motion.p
              initial={reduced ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={reduced ? undefined : { delay: 0.6, duration: 0.8, ease: EASE_LUXURY }}
              style={{ ...gpuStyle, fontSize: "clamp(1.6rem, 2.6vw, 3.4rem)" }}
              className="font-cinzel text-champagne/90 tracking-[0.04em] leading-relaxed text-center max-w-4xl queen-name-glow"
            >
              &ldquo;{todayQuote.text}&rdquo;
            </motion.p>

            <p
              className="font-baskerville italic text-champagne/55 text-center"
              style={{ fontSize: "clamp(1rem, 1.3vw, 1.6rem)" }}
            >
              {todayQuote.attribution}
            </p>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
