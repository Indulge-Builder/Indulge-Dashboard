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

/**
 * TEMPORARY (2026-07-04): the cream ("light") theme is pinned as the default
 * around the clock while the charcoal ("dark") theme is still being refined.
 * The daypart logic below is preserved but short-circuited — delete the early
 * return to re-enable the automatic cream/charcoal flip. The `?neu=dark` dev
 * override still works for previewing/refining the dark theme.
 */
const FORCE_LIGHT = true;

/** Cream 04:00–15:59 IST, charcoal 16:00–03:59 IST. */
export function currentDaypartTheme(): DaypartTheme {
  if (FORCE_LIGHT) return "light";
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
