"use client";

/**
 * hooks/useDaypartTheme.ts
 *
 * Serene Neumorphic daypart theme: cream ("light") 04:00–15:59 IST, warm
 * charcoal ("dark") otherwise. Sets `data-neu="light" | "dark"` on <html> —
 * the token layer (app/indulge-neumorphic-tokens.css) does the rest, and the
 * canvas flip is softened by `transition: background 500ms ease` on html/body
 * (globals.css).
 *
 * Invariant #1: the hour is computed through lib/istDate.ts (never the local
 * clock) so a deploy to a non-IST kiosk keeps the same daypart as the office.
 *
 * Dev override: `?neu=light` / `?neu=dark` pins the theme for side-by-side
 * comparison against the design specimen.
 *
 * Wire once in components/Dashboard.tsx.
 */

import { useEffect } from "react";
import { toISTHour } from "@/lib/istDate";

export type DaypartTheme = "light" | "dark";

const RECHECK_MS = 60_000;

/** Cream 04:00–15:59 IST, charcoal 16:00–03:59 IST. */
export function currentDaypartTheme(): DaypartTheme {
  const hour = toISTHour(new Date().toISOString());
  return hour >= 4 && hour < 16 ? "light" : "dark";
}

export function useDaypartTheme(): void {
  useEffect(() => {
    let override: DaypartTheme | null = null;
    try {
      const param = new URLSearchParams(window.location.search).get("neu");
      if (param === "light" || param === "dark") override = param;
    } catch {
      /* URLSearchParams unavailable — fall through to IST daypart */
    }

    const root = document.documentElement;
    const apply = () => {
      root.dataset.neu = override ?? currentDaypartTheme();
    };

    apply();
    const id = window.setInterval(apply, RECHECK_MS);
    return () => {
      window.clearInterval(id);
    };
  }, []);
}
