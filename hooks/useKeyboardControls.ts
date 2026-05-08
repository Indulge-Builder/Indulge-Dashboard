"use client";

/**
 * hooks/useKeyboardControls.ts
 *
 * Keyboard and media-key handling for the dashboard screen switcher.
 * Extracted from DashboardController to separate input concerns from rendering.
 *
 * Supports:
 *   P / Space / Enter / NumpadEnter / MediaPlayPause → toggle freeze
 *   ArrowLeft / ArrowRight → manual screen switch
 *
 * Uses capture-phase listener so events arrive before fullscreen UI or other
 * handlers intercept them — important for TV remote / embedded browser engines.
 */

import { useEffect } from "react";
import type { ActiveScreen } from "@/types";

type ScreenDispatch = (updater: (s: ActiveScreen) => ActiveScreen) => void;
type FreezeDispatch = (updater: (v: boolean) => boolean) => void;

function isFreezeToggleKey(e: KeyboardEvent): boolean {
  if (e.key === "p" || e.key === "P") return true;
  if (e.key === " " || e.code === "Space") return true;
  if (e.key === "Enter" || e.code === "Enter" || e.code === "NumpadEnter") return true;
  if (e.code === "MediaPlayPause") return true;
  if (typeof e.keyCode === "number" && e.keyCode === 13) return true;
  return false;
}

export function useKeyboardControls(
  setActiveScreen: ScreenDispatch,
  setIsFrozen: FreezeDispatch,
): void {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isFreezeToggleKey(e)) {
        e.preventDefault();
        e.stopPropagation();
        setIsFrozen((v) => !v);
        return;
      }
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      e.preventDefault();
      setActiveScreen((s) => (s === "concierge" ? "onboarding" : "concierge"));
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [setActiveScreen, setIsFrozen]);
}
