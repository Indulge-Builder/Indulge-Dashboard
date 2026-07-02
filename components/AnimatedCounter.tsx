"use client"

import { useEffect, useRef } from "react"
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform, type Variants } from "framer-motion"
import { EASE_LUXURY } from "@/lib/motionPresets"

// Odometer roll — direction (+1 up / -1 down / 0 first render) flows through
// `custom` so the EXITING digit always reads the direction of the change that
// evicted it (a stale-closure exit would slide the wrong way when a metric
// flips from rising to falling). Enter 350ms / exit 250ms: the leave is
// quicker than the arrival, so the eye lands on the new value.
const rollVariants: Variants = {
  enter: (dir: number) => ({ y: dir === 0 ? 0 : dir > 0 ? 12 : -12, opacity: 0 }),
  center: { y: 0, opacity: 1 },
  exit: (dir: number) => ({
    y: dir === 0 ? 0 : dir > 0 ? -12 : 12,
    opacity: 0,
    transition: { duration: 0.25, ease: EASE_LUXURY },
  }),
}

interface AnimatedCounterProps {
  value?:    number | null
  className?: string
  /** Delay in ms — only honoured on the very first render (entrance stagger).
   *  Real-time updates animate immediately so the live feel isn't delayed. */
  delay?:    number
  /** Use vertical slide animation on value change (rolling digit effect) */
  slideOnChange?: boolean
}

export default function AnimatedCounter({
  value: rawValue,
  className,
  delay = 600,
  slideOnChange = false,
}: AnimatedCounterProps) {
  const value = typeof rawValue === "number" && !Number.isNaN(rawValue) ? rawValue : 0
  const motionValue  = useMotionValue(0)
  const springValue  = useSpring(motionValue, { stiffness: 35, damping: 18, mass: 1.8 })
  const displayValue = useTransform(springValue, (v) =>
    Math.round(v).toLocaleString("en-IN")
  )

  const isFirstRender = useRef(true)
  const prevValueRef = useRef(value)

  useEffect(() => {
    const actualDelay = isFirstRender.current ? delay : 0
    isFirstRender.current = false

    const timer = setTimeout(() => {
      prevValueRef.current = value
      // Only drive the spring when it is actually displayed. In slideOnChange
      // mode the value renders via AnimatePresence below — feeding the spring
      // would tick a ~3s settling animation per counter on every update with
      // nothing subscribed to it (pure wasted frames on TV hardware).
      if (!slideOnChange) motionValue.set(value)
    }, actualDelay)
    return () => clearTimeout(timer)
  }, [value, motionValue, delay, slideOnChange])

  // Rolling digit / vertical slide: AnimatePresence wrapper when slideOnChange
  if (slideOnChange) {
    // On first render keep it a pure opacity fade — no y movement avoids
    // the jarring "all numbers slide in simultaneously" effect on TV screens.
    const isFirst = isFirstRender.current
    const dir = isFirst ? 0 : value > prevValueRef.current ? 1 : -1
    return (
      <span className="relative inline-block overflow-hidden tabular-nums align-baseline">
        {/* popLayout (not "wait"): the old digit slides out WHILE the new one
            slides in — a continuous odometer roll with no blank frame between
            values. The exiting span is popped to absolute inside this relative
            wrapper, so the overflow-hidden clip still applies. */}
        <AnimatePresence mode="popLayout" custom={dir}>
          <motion.span
            key={value}
            className={`inline-block ${className ?? ""}`}
            custom={dir}
            variants={rollVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: isFirst ? 0.5 : 0.35, ease: EASE_LUXURY }}
          >
            {value.toLocaleString("en-IN")}
          </motion.span>
        </AnimatePresence>
      </span>
    );
  }

  return <motion.span className={className}>{displayValue}</motion.span>
}
