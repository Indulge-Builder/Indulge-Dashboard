"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Returns true for 560ms whenever `value` changes (dry-audit A8 — previously
 * declared inside CompactAgentCard's body, re-created per render). Drives the
 * `.ob-metric-flash` pulse on onboarding metric tiles.
 */
export function usePulseOnChange(value: number | string): boolean {
  const prevRef = useRef(value);
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (prevRef.current !== value) {
      setActive(true);
      const t = setTimeout(() => setActive(false), 560);
      prevRef.current = value;
      return () => clearTimeout(t);
    }
  }, [value]);

  return active;
}
