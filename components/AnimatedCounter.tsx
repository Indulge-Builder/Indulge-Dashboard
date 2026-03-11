"use client"

import React, { useEffect, useRef } from "react"
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion"

interface AnimatedCounterProps {
  value:      number
  className?: string
  style?:     React.CSSProperties
  /** Delay in ms — only honoured on the very first render (entrance stagger).
   *  Real-time updates animate immediately so the live feel isn't delayed. */
  delay?:     number
}

export default function AnimatedCounter({
  value,
  className,
  style,
  delay = 600,
}: AnimatedCounterProps) {
  const motionValue  = useMotionValue(0)
  const springValue  = useSpring(motionValue, { stiffness: 35, damping: 18, mass: 1.8 })
  const displayValue = useTransform(springValue, (v) =>
    Math.round(v).toLocaleString("en-IN")
  )

  const isFirstRender = useRef(true)

  useEffect(() => {
    const actualDelay = isFirstRender.current ? delay : 0
    isFirstRender.current = false

    const timer = setTimeout(() => motionValue.set(value), actualDelay)
    return () => clearTimeout(timer)
  }, [value, motionValue, delay])

  return <motion.span className={className} style={style}>{displayValue}</motion.span>
}
