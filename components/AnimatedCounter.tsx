"use client"

import { useEffect, useRef } from "react"
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from "framer-motion"

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
      motionValue.set(value)
    }, actualDelay)
    return () => clearTimeout(timer)
  }, [value, motionValue, delay])

  // Rolling digit / vertical slide: AnimatePresence wrapper when slideOnChange
  if (slideOnChange) {
    const slideDir = value > prevValueRef.current ? "up" : "down"
    return (
      <span className="relative inline-block overflow-hidden tabular-nums align-baseline">
        <AnimatePresence mode="wait">
          <motion.span
            key={value}
            className={className}
            initial={{
              y: slideDir === "up" ? 28 : -28,
              opacity: 0,
            }}
            animate={{ y: 0, opacity: 1 }}
            exit={{
              y: slideDir === "up" ? -28 : 28,
              opacity: 0,
            }}
            transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            {value.toLocaleString("en-IN")}
          </motion.span>
        </AnimatePresence>
      </span>
    );
  }

  return <motion.span className={className}>{displayValue}</motion.span>
}
