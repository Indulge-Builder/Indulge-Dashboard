"use client";

/**
 * hooks/useCelebrationDetection.ts
 *
 * Detects when any agent's `tasksCompletedToday` increases and triggers a
 * full-screen celebration overlay for that agent. Extracted from Dashboard.tsx.
 *
 * Algorithm (preserved verbatim from original):
 *   1. On the very first call, prevScoresRef is empty → seed the map silently
 *      (no celebration fires on initial load).
 *   2. On every subsequent call, compare each agent's current score against
 *      the stored previous value. First agent whose score increased becomes
 *      the candidate.
 *   3. Always update the map to current values (whether or not a celebration
 *      fired) so the next comparison has a fresh baseline.
 *   4. Only fire if no celebration is already running (prevents stacking).
 *
 * IMPORTANT — intentional eslint-disable:
 *   `celebrationAgent` is intentionally excluded from the useEffect dep array.
 *   Including it would create a feedback loop where setting celebrationAgent
 *   triggers the effect again, which would find a "new" candidate immediately.
 *   The effect must ONLY react to agent score changes.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { AgentStats } from "@/lib/types";

export interface CelebrationState {
  /** Name of the agent currently being celebrated, or null. */
  celebrationAgent: string | null;
  /** Call this in CelebrationOverlay's onComplete prop to dismiss. */
  clearCelebration: () => void;
}

export function useCelebrationDetection(
  agentsA: AgentStats[],
  agentsB: AgentStats[],
): CelebrationState {
  const [celebrationAgent, setCelebrationAgent] = useState<string | null>(null);

  // Persists across renders without causing re-renders — a Map from agent name
  // to their last known tasksCompletedToday value.
  const prevScoresRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    const allCurrent = [...agentsA, ...agentsB];

    const prevMap      = prevScoresRef.current;
    const isInitialSeed = prevMap.size === 0;
    let celebCandidate: string | null = null;

    // Only compare if the map has been seeded — first run is always a seed.
    if (!isInitialSeed) {
      for (const agent of allCurrent) {
        const prev = prevMap.get(agent.name) ?? 0;
        if (agent.tasksCompletedToday > prev) {
          celebCandidate = agent.name;
          break; // first agent to score wins; one overlay at a time
        }
      }
    }

    // Always refresh the map so the next render has an accurate baseline.
    for (const agent of allCurrent) {
      prevMap.set(agent.name, agent.tasksCompletedToday);
    }

    // Guard: don't stack celebrations. If one is already showing, queue nothing.
    // celebrationAgent is intentionally excluded from the dep array below —
    // we only want this effect to react to agent score arrays, not to whether
    // the overlay is currently visible.
    if (celebCandidate && !celebrationAgent) {
      setCelebrationAgent(celebCandidate);
    }

    // celebrationAgent intentionally omitted from deps: reacting to it would
    // cause a feedback loop (overlay shown → effect re-runs → new candidate).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentsA, agentsB]);

  const clearCelebration = useCallback(() => setCelebrationAgent(null), []);

  return { celebrationAgent, clearCelebration };
}
