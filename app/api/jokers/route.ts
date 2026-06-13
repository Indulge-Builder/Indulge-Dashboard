/**
 * GET /api/jokers
 *
 * Fetches from the `jokers` table and returns per-queendom Joker metrics for the
 * **current IST calendar month** only (monthly reset on the TV scorecard + strip).
 * Row month = `date` if set, else `created_at` (IST calendar month).
 *
 *   uniqueSuggestionsCount – distinct normalized suggestion text (this month)
 *   totalSent / totalSuggestions – row count this month
 *   acceptedCount – "yes" responses this month
 *   rejectedCount – "no" this month
 *   pendingSuggestions – pending / blank this month
 *   acceptedToday – "yes" where IST day is today (subset of this month)
 *   totalThisMonth – same as totalSent (all rows in the cohort)
 *
 * Returns: { ananyshree: JokerStats, anishqa: JokerStats }
 */

import { JOKER_ROSTER } from "@/lib/agentRoster";
import { withApiGuard, noStoreJson } from "@/lib/apiGuard";
import { istToday, toISTDay, toISTMonth } from "@/lib/istDate";
import type { JokerStats } from "@/lib/types";

interface JokerRow {
  joker_name: string | null;
  suggestion: string | null;
  response: string | null;
  date: string | null;
  created_at: string | null;
}

function rowIstMonth(row: JokerRow): string {
  const fromDate = toISTMonth(row.date);
  if (fromDate.length >= 7) return fromDate;
  return toISTMonth(row.created_at);
}

function rowIstDay(row: JokerRow): string {
  const fromDate = toISTDay(row.date);
  if (fromDate.length >= 10) return fromDate;
  return toISTDay(row.created_at);
}

const emptyStats: JokerStats = {
  uniqueSuggestionsCount: 0,
  totalSent: 0,
  totalSuggestions: 0,
  acceptedCount: 0,
  rejectedCount: 0,
  pendingSuggestions: 0,
  acceptedToday: 0,
  totalThisMonth: 0,
};

const emptyResponse = () =>
  noStoreJson({ ananyshree: emptyStats, anishqa: emptyStats });

// The TV must never see an error from this panel — every failure path degrades
// to zeroed stats (200), with the guard's 500 as a last-resort backstop.
export const GET = withApiGuard(async (_req, db) => {
  try {
    const { data: rows, error } = await db
      .from("jokers")
      .select("joker_name, suggestion, response, date, created_at");

    if (error) {
      console.error("[/api/jokers] Supabase error:", error.message);
      return emptyResponse();
    }

    const jokerRows = (rows ?? []) as JokerRow[];
    const { day: TODAY, month: THIS_MONTH } = istToday();

    const aggregateForJoker = (jokerName: string): JokerStats => {
      const nameLower = jokerName.toLowerCase();
      const matching = jokerRows.filter(
        (r) => (r.joker_name ?? "").toLowerCase().trim() === nameLower,
      );
      const cohort = matching.filter((r) => rowIstMonth(r) === THIS_MONTH);

      const uniqueSuggestionKeys = new Set<string>();
      for (const row of cohort) {
        const key = (row.suggestion ?? "").toLowerCase().trim();
        uniqueSuggestionKeys.add(key);
      }
      const uniqueSuggestionsCount = uniqueSuggestionKeys.size;

      const totalSent = cohort.length;
      const totalSuggestions = totalSent;

      let acceptedCount = 0;
      let rejectedCount = 0;
      let pendingSuggestions = 0;
      let acceptedToday = 0;

      for (const row of cohort) {
        const resp = (row.response ?? "").toLowerCase().trim();
        const rowDay = rowIstDay(row);

        if (resp === "yes") {
          acceptedCount++;
          if (rowDay === TODAY) acceptedToday++;
        } else if (resp === "no") {
          rejectedCount++;
        } else {
          pendingSuggestions++;
        }
      }

      return {
        uniqueSuggestionsCount,
        totalSent,
        totalSuggestions,
        acceptedCount,
        rejectedCount,
        pendingSuggestions,
        acceptedToday,
        totalThisMonth: totalSent,
      };
    };

    const result: Record<string, JokerStats> = {};
    for (const [name, queendom] of Object.entries(JOKER_ROSTER)) {
      result[queendom] = aggregateForJoker(name);
    }

    return noStoreJson({
      ananyshree: result.ananyshree ?? emptyStats,
      anishqa: result.anishqa ?? emptyStats,
    });
  } catch (err) {
    console.error("[/api/jokers] Unexpected error:", err);
    return emptyResponse();
  }
});
