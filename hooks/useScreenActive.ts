"use client";

/**
 * hooks/useScreenActive.ts — is my rotating screen layer currently visible?
 *
 * Provided by ScreenLayer in DashboardController (dry-audit H3): hidden layers
 * stay fully mounted (critical invariant), but components with their own
 * clocks — rAF loops, 1s intervals — pause them while the layer is faded out
 * and resume the moment the fade-in starts, so nothing is visibly frozen
 * during the 1.5s crossfade.
 *
 * Defaults to true so components rendered outside a ScreenLayer behave
 * exactly as before.
 */

import { createContext, useContext } from "react";

export const ScreenActivityContext = createContext(true);

export function useScreenActive(): boolean {
  return useContext(ScreenActivityContext);
}
