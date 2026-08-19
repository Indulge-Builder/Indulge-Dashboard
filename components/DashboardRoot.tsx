"use client";

/**
 * Device-aware shell. One URL (dashboard.indulge.global) serves two products:
 *
 *   - TV / desktop → components/Dashboard.tsx, byte-for-byte the existing
 *     canvas. Every TV invariant (always-mounted screens, auto-rotation,
 *     marquee ticker) stays scoped to that tree.
 *   - Phone / small tablet → components/mobile/MobileDashboard.tsx, a
 *     tap-driven ranked feed. No rotation, no marquee, its own type ramp.
 *
 * The split is a media query, decided after hydration (SSR can't know the
 * device). Until the first layout effect runs we render the obsidian ground
 * only — one frame, invisible on the TV's dark wall, and it prevents the TV
 * from ever flashing the mobile layout (or vice versa).
 *
 * Phones in landscape stay mobile (coarse pointer ≤ 1180px), so rotating a
 * phone never teleports the user into the TV canvas mid-scroll.
 */

import { useLayoutEffect, useState } from "react";
import Dashboard from "./Dashboard";
import MobileDashboard from "./mobile/MobileDashboard";

const MOBILE_QUERY =
  "(max-width: 819px), ((pointer: coarse) and (max-width: 1180px))";

export default function DashboardRoot() {
  const [mode, setMode] = useState<"unknown" | "tv" | "mobile">("unknown");

  useLayoutEffect(() => {
    const mql = window.matchMedia(MOBILE_QUERY);
    const apply = () => setMode(mql.matches ? "mobile" : "tv");
    apply();
    // Live re-evaluation: a desktop window dragged narrow becomes mobile and
    // back. Cheap — both trees share the same hooks and repopulate instantly.
    mql.addEventListener("change", apply);
    return () => mql.removeEventListener("change", apply);
  }, []);

  if (mode === "unknown") {
    return <div className="min-h-screen w-full bg-obsidian" aria-hidden />;
  }
  return mode === "mobile" ? <MobileDashboard /> : <Dashboard />;
}
