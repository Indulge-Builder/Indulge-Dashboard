/**
 * GET /api/insights?days=30
 *
 * Founder analytics payload for the mobile deep views. Fans out to the five
 * SQL aggregation functions (supabase/migrations/20260820000001) in one
 * parallel round trip and returns them as sections:
 *
 *   pulse   — daily created/resolved series, hourly arrival histogram (IST),
 *             open-backlog aging buckets, SLA breach-risk list, reopens
 *   agents  — per-agent speed (median/p90 first response, median resolution),
 *             reopens, live load, billable share
 *   mix     — ticket_type / source / priority breakdowns, billable count,
 *             invoice totals
 *   members — top requesters joined to `clients` via freshdesk_contact_id
 *   csat    — happiness %, weekly trend, recent low ratings
 *
 * Definitions are EVENT math (resolved counted on resolution date) — the
 * founder's view. The TV's cohort math is a different, deliberate definition
 * (CLAUDE.md invariant #4); the two are labeled, not reconciled.
 *
 * Fetch-on-open + pull-to-refresh; not Realtime (analytics, not a ticker).
 */

import { NextResponse } from "next/server";
import { withApiGuard, noStoreJson } from "@/lib/apiGuard";

const DEFAULT_DAYS = 30;
const MAX_DAYS = 365;

export const GET = withApiGuard(async (req, db) => {
  const daysParam = Number(new URL(req.url).searchParams.get("days"));
  const days =
    Number.isFinite(daysParam) && daysParam > 0
      ? Math.min(Math.round(daysParam), MAX_DAYS)
      : DEFAULT_DAYS;

  const [pulse, agents, mix, members, csat] = await Promise.all([
    db.rpc("insights_pulse", { p_days: days }),
    db.rpc("insights_agents", { p_days: days }),
    db.rpc("insights_mix", { p_days: days }),
    db.rpc("insights_members", { p_days: days }),
    db.rpc("insights_csat", { p_days: Math.max(days, 90) }),
  ]);

  const firstError =
    pulse.error ?? agents.error ?? mix.error ?? members.error ?? csat.error;
  if (firstError) {
    console.error("[/api/insights] rpc error:", firstError.message);
    return NextResponse.json({ error: firstError.message }, { status: 500 });
  }

  return noStoreJson({
    days,
    pulse: pulse.data,
    agents: agents.data,
    mix: mix.data,
    members: members.data,
    csat: csat.data,
  });
});
