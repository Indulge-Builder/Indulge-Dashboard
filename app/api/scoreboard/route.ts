/**
 * GET /api/scoreboard?period=today|week|month|last-month
 *
 * Period-scoped Queendom + agent scoreboard for the mobile Concierge's
 * filter row. Computes IST calendar bounds server-side (Monday-start weeks,
 * lib/istDate day/month helpers) and hands them to insights_scoreboard()
 * (migration 20260820000004) — cohort math anchored on created_at.
 *
 * "ontime" = resolved without going overdue (no SLA clock or beat due_by) —
 * the metric behind each agent's 125-per-month target meter.
 */

import { NextResponse } from "next/server";
import { withApiGuard, noStoreJson } from "@/lib/apiGuard";
import {
  istToday,
  utcMillisFromDbTimestamp,
  getCurrentIstDayUtcBounds,
  getCurrentIstMonthUtcBounds,
} from "@/lib/istDate";

export type ScoreboardPeriod = "today" | "week" | "month" | "last-month";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Previous IST calendar month as [start, endExclusive) UTC ISO. */
function lastIstMonthBounds(): { from: string; to: string } {
  const { month } = istToday(); // "YYYY-MM"
  const [y, m] = month.split("-").map(Number);
  const prev = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
  const from = utcMillisFromDbTimestamp(`${prev}-01`)!;
  const to = utcMillisFromDbTimestamp(`${month}-01`)!;
  return { from: new Date(from).toISOString(), to: new Date(to).toISOString() };
}

/** Current IST week (Monday 00:00 IST → now-exclusive end of today). */
function istWeekBounds(): { from: string; to: string } {
  const { day } = istToday(); // "YYYY-MM-DD" (IST calendar date)
  // Weekday of that calendar date is timezone-free once treated as UTC noon.
  const weekday = new Date(`${day}T12:00:00Z`).getUTCDay(); // 0=Sun
  const sinceMonday = (weekday + 6) % 7;
  const todayStart = utcMillisFromDbTimestamp(day)!;
  const from = todayStart - sinceMonday * MS_PER_DAY;
  return {
    from: new Date(from).toISOString(),
    to: new Date(todayStart + MS_PER_DAY).toISOString(),
  };
}

function boundsFor(period: ScoreboardPeriod): { from: string; to: string } {
  switch (period) {
    case "today": {
      const b = getCurrentIstDayUtcBounds();
      return { from: b.startUtcIso, to: b.endExclusiveUtcIso };
    }
    case "week":
      return istWeekBounds();
    case "last-month":
      return lastIstMonthBounds();
    case "month":
    default: {
      const b = getCurrentIstMonthUtcBounds();
      return { from: b.startUtcIso, to: b.endExclusiveUtcIso };
    }
  }
}

export const GET = withApiGuard(async (req, db) => {
  const raw = new URL(req.url).searchParams.get("period");
  const period: ScoreboardPeriod =
    raw === "today" || raw === "week" || raw === "last-month" ? raw : "month";
  const { from, to } = boundsFor(period);

  const { data, error } = await db.rpc("insights_scoreboard", {
    p_from: from,
    p_to: to,
  });
  if (error) {
    console.error("[/api/scoreboard] rpc error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return noStoreJson({ period, from, to, ...(data as object) });
});
