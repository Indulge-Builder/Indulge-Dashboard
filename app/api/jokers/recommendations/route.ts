/**
 * GET /api/jokers/recommendations
 *
 * Fetches the latest 10-15 suggestions from the jokers table for the ticker.
 * Columns: city, type, suggestion, created_at
 * Ordered by created_at DESC so newest recommendations appear first.
 */

import { NextResponse } from "next/server";
import { requireSupabaseAdminOr503 } from "@/lib/supabaseAdmin";

interface JokerRecommendationRow {
  id: string;
  city: string | null;
  type: string | null;
  suggestion: string | null;
  created_at: string | null;
}

export interface JokerRecommendationItem {
  id: string;
  city: string;
  type: string;
  suggestion: string;
}

export async function GET() {
  try {
    const { db, response } = requireSupabaseAdminOr503();
    if (response || !db) return response;

    const { data: rows, error } = await db
      .from("jokers")
      .select("id, city, type, suggestion, created_at")
      .order("created_at", { ascending: false })
      .limit(15);

    if (error) {
      console.error(
        "[/api/jokers/recommendations] Supabase error:",
        error.message,
      );
      return NextResponse.json([] as JokerRecommendationItem[], {
        headers: { "Cache-Control": "no-store" },
      });
    }

    const items: JokerRecommendationItem[] = (rows ?? []).map(
      (r: JokerRecommendationRow) => ({
        id: r.id ?? crypto.randomUUID(),
        city: (r.city ?? "").trim() || "Unknown",
        type: (r.type ?? "").trim() || "Experience",
        suggestion: (r.suggestion ?? "").trim() || "—",
      }),
    );

    return NextResponse.json(items, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    console.error(
      "[/api/jokers/recommendations] Unexpected error:",
      err,
    );
    return NextResponse.json([] as JokerRecommendationItem[], {
      headers: { "Cache-Control": "no-store" },
    });
  }
}
