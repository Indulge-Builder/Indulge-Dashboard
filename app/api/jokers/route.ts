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

// ─── IST date helpers ────────────────────────────────────────────────────────
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; // UTC+5:30

function istToday(): { day: string; month: string } {
  const now = new Date(Date.now() + IST_OFFSET_MS);
  const y = now.getUTCFullYear();
  const mo = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  return { day: `${y}-${mo}-${d}`, month: `${y}-${mo}` };
}

function toDay(ts: string | null): string {
  return (ts ?? "").slice(0, 10);
}
function toMonth(ts: string | null): string {
  return (ts ?? "").slice(0, 7);
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
        const rowDay = toDay(row.date);
        const rowMonth = toMonth(row.date);

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
