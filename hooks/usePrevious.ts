"use client";

import { useEffect, useRef } from "react";

/**
 * Returns the value from the previous render (dry-audit B3 — previously
 * private to AgentRow). Used to detect increases without extra state.
 */
export function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T | undefined>(undefined);
  useEffect(() => {
    ref.current = value;
  }, [value]);
  return ref.current;
}
