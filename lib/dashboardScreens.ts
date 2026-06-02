import type { ActiveScreen } from "@/types";

/**
 * Home panel is WIP — off in production until ready.
 * Set NEXT_PUBLIC_HOME_PANEL_ENABLED=true locally to preview it in rotation.
 */
export const HOME_PANEL_ENABLED =
  process.env.NEXT_PUBLIC_HOME_PANEL_ENABLED === "true";

export const ACTIVE_SCREEN_ORDER: ActiveScreen[] = HOME_PANEL_ENABLED
  ? ["concierge", "onboarding", "home"]
  : ["concierge", "onboarding"];

export const SCREEN_DURATIONS_MS: Record<ActiveScreen, number> = {
  concierge: 30_000,
  onboarding: 30_000,
  home: 30_000,
};

export function nextActiveScreen(current: ActiveScreen): ActiveScreen {
  const idx = ACTIVE_SCREEN_ORDER.indexOf(current);
  const safeIdx = idx >= 0 ? idx : 0;
  return ACTIVE_SCREEN_ORDER[(safeIdx + 1) % ACTIVE_SCREEN_ORDER.length];
}

export function stepActiveScreen(
  current: ActiveScreen,
  delta: -1 | 1,
): ActiveScreen {
  const order = ACTIVE_SCREEN_ORDER;
  const idx = order.indexOf(current);
  const safeIdx = idx >= 0 ? idx : 0;
  return order[(safeIdx + delta + order.length) % order.length];
}
