/**
 * GET /api/jokers
 *
 * Fetches from the `jokers` table and returns per-queendom Joker metrics:
 *   totalSuggestions  – count of rows where joker_name matches the Queendom's Joker
 *   acceptedCount    – count where response.toLowerCase() === 'yes'
 *   pendingSuggestions – count where response is neither 'yes' nor 'no'
 *
 * Returns: { ananyshree: JokerStats, anishqa: JokerStats }
 */

import { NextResponse } from "next/server";
import { JOKER_ROSTER } from "@/lib/agentRoster";
import { requireSupabaseAdminOr503 } from "@/lib/supabaseAdmin";
import { istToday, toISTDay, toISTMonth } from "@/lib/istDate";

interface JokerRow {
  joker_name: string | null;
  response: string | null;
  date: string | null;
}

interface JokerStats {
  totalSuggestions: number;
  acceptedCount: number;
  pendingSuggestions: number;
  acceptedToday: number;
  totalThisMonth: number;
}

const emptyStats: JokerStats = {
  totalSuggestions: 0,
  acceptedCount: 0,
  pendingSuggestions: 0,
  acceptedToday: 0,
  totalThisMonth: 0,
};

const emptyResponse = () =>
  NextResponse.json(
    { ananyshree: emptyStats, anishqa: emptyStats },
    { headers: { "Cache-Control": "no-store" } },
  );

export async function GET() {
  try {
    const { db, response } = requireSupabaseAdminOr503();
    if (!db) {
      return (
        response ??
        NextResponse.json(
          { error: "SUPABASE_SERVICE_ROLE_KEY is not configured" },
          { status: 503 },
        )
      );
    }

    const { data: rows, error } = await db
      .from("jokers")
      .select("joker_name, response, date");

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

      let totalSuggestions = matching.length;
      let acceptedCount = 0;
      let pendingSuggestions = 0;
      let acceptedToday = 0;
      let totalThisMonth = 0;

      for (const row of matching) {
        const resp = (row.response ?? "").toLowerCase().trim();
        const rowDay = toISTDay(row.date);
        const rowMonth = toISTMonth(row.date);

        if (resp === "yes") {
          acceptedCount++;
          if (rowDay === TODAY) acceptedToday++;
        } else if (resp !== "no") {
          pendingSuggestions++;
        }

        if (rowMonth === THIS_MONTH) totalThisMonth++;
      }

      return {
        totalSuggestions,
        acceptedCount,
        pendingSuggestions,
        acceptedToday,
        totalThisMonth,
      };
    };

    const result: Record<string, JokerStats> = {};
    for (const [name, queendom] of Object.entries(JOKER_ROSTER)) {
      result[queendom] = aggregateForJoker(name);
    }

    return NextResponse.json(
      {
        ananyshree: result.ananyshree ?? emptyStats,
        anishqa: result.anishqa ?? emptyStats,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    console.error("[/api/jokers] Unexpected error:", err);
    return emptyResponse();
  }
}
