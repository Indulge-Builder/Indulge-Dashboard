"use client"

import { AnimatePresence, motion } from "framer-motion"
import { Sparkles, Star } from "lucide-react"
import type { Onboarding, PlanTier } from "@/lib/types"

interface OnboardingBannerProps {
  onboardings:  Onboarding[]
  currentIndex: number
}

const PLAN_STYLES: Record<PlanTier, {
  border:  string
  bg:      string
  badge:   string
  nameColor: string
}> = {
  diamond: {
    border:    "border-sky-400/35",
    bg:        "from-sky-500/[0.12] via-indigo-500/[0.07] to-transparent",
    badge:     "bg-sky-500/15 text-sky-300 border border-sky-400/35",
    nameColor: "text-sky-100",
  },
  platinum: {
    border:    "border-slate-300/30",
    bg:        "from-slate-400/[0.12] via-gray-300/[0.06] to-transparent",
    badge:     "bg-slate-400/15 text-slate-200 border border-slate-300/30",
    nameColor: "text-slate-100",
  },
  gold: {
    border:    "border-gold-500/35",
    bg:        "from-gold-500/[0.14] via-amber-500/[0.07] to-transparent",
    badge:     "bg-gold-500/15 text-gold-300 border border-gold-500/35",
    nameColor: "text-champagne",
  },
  silver: {
    border:    "border-gray-400/25",
    bg:        "from-gray-400/[0.10] via-gray-300/[0.05] to-transparent",
    badge:     "bg-gray-400/15 text-gray-300 border border-gray-400/25",
    nameColor: "text-gray-100",
  },
}

export default function OnboardingBanner({ onboardings, currentIndex }: OnboardingBannerProps) {
  const current = onboardings[currentIndex]
  if (!current) return null

  const styles = PLAN_STYLES[current.planTier] ?? PLAN_STYLES.gold
  const displayCount = Math.min(onboardings.length, 7)
  const dotIndex     = currentIndex % displayCount

  return (
    <footer
      className="relative border-t border-gold-500/15 flex items-center overflow-hidden z-10"
      style={{ height: "19vh" }}
    >
      {/* Background ambient glow */}
      <div className="absolute inset-0 bg-gradient-to-t from-gold-500/[0.04] to-transparent pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-r from-gold-500/[0.04] via-transparent to-gold-500/[0.04] pointer-events-none" />

      {/* ── Left label ── */}
      <motion.div
        className="absolute left-10 flex flex-col items-start gap-[5px]"
        initial={{ opacity: 0, x: -24 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.8, delay: 0.5 }}
      >
        <div className="flex items-center gap-2">
          {/* Pulsing gold dot */}
          <span className="relative flex h-[9px] w-[9px]">
            <motion.span
              className="absolute inline-flex h-full w-full rounded-full bg-gold-500/50"
              animate={{ scale: [1, 2.6, 1], opacity: [0.7, 0, 0.7] }}
              transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
            />
            <span className="relative inline-flex rounded-full h-[9px] w-[9px] bg-gold-500" />
          </span>
          <span className="font-inter text-[9px] tracking-[0.55em] uppercase text-gold-500/55">
            Live Onboarding
          </span>
        </div>
        <div className="h-px w-28 bg-gradient-to-r from-gold-500/35 to-transparent" />
      </motion.div>

      {/* ── Centre animated card ── */}
      <div className="absolute left-1/2 -translate-x-1/2 w-full max-w-[860px] px-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={current.id}
            className={`glass-light rounded-2xl bg-gradient-to-r ${styles.bg} border ${styles.border} flex items-center justify-between gap-6 relative overflow-hidden`}
            style={{ padding: "2.4vh 3vw" }}
            initial={{ opacity: 0, y: 28, scale: 0.97 }}
            animate={{ opacity: 1, y: 0,  scale: 1    }}
            exit={{    opacity: 0, y: -28, scale: 0.97 }}
            transition={{ duration: 0.65, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            {/* Shimmer sweep on enter */}
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.04] to-transparent -translate-x-full pointer-events-none"
              animate={{ x: ["−100%", "200%"] }}
              transition={{ duration: 1.2, delay: 0.1, ease: "easeInOut" }}
            />

            {/* Sparkle icon */}
            <motion.div
              animate={{ rotate: [0, 10, -10, 0], scale: [1, 1.15, 1] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            >
              <Sparkles size={22} className="text-gold-400/70 flex-shrink-0" />
            </motion.div>

            {/* Client name */}
            <div className="flex flex-col min-w-0">
              <p className="font-inter text-[8.5px] tracking-[0.5em] uppercase text-gold-500/50 mb-[4px]">
                Welcome to the Family
              </p>
              <h3 className={`font-playfair text-[1.9rem] leading-none tracking-wide truncate ${styles.nameColor}`}>
                {current.clientName}
              </h3>
            </div>

            {/* Vertical divider */}
            <div className="h-10 w-px bg-gold-500/18 flex-shrink-0" />

            {/* Plan badge */}
            <div className="text-center flex-shrink-0">
              <p className="font-inter text-[8px] tracking-[0.45em] uppercase text-gold-500/45 mb-[6px]">
                Plan
              </p>
              <span className={`px-4 py-1.5 rounded-full font-inter text-[10px] tracking-[0.3em] uppercase ${styles.badge}`}>
                {current.plan}
              </span>
            </div>

            {/* Vertical divider */}
            <div className="h-10 w-px bg-gold-500/18 flex-shrink-0" />

            {/* Salesperson */}
            <div className="text-center flex-shrink-0">
              <p className="font-inter text-[8px] tracking-[0.45em] uppercase text-gold-500/45 mb-[4px]">
                Closed By
              </p>
              <p className="font-playfair text-[1.5rem] leading-none text-gold-400">
                {current.salesperson}
              </p>
            </div>

            <Star size={16} className="text-gold-400/40 flex-shrink-0" />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ── Right: progress dots ── */}
      <motion.div
        className="absolute right-10 flex items-center gap-[7px]"
        initial={{ opacity: 0, x: 24 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.8, delay: 0.6 }}
      >
        {Array.from({ length: displayCount }).map((_, i) => (
          <motion.div
            key={i}
            className="h-[3px] rounded-full"
            animate={{
              width:           i === dotIndex ? 22 : 6,
              backgroundColor: i === dotIndex
                ? "rgba(201,168,76,0.85)"
                : "rgba(201,168,76,0.20)",
            }}
            transition={{ duration: 0.35, ease: "easeInOut" }}
          />
        ))}
      </motion.div>
    </footer>
  )
}
