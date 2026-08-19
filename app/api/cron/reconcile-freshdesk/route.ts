/**
 * GET /api/cron/reconcile-freshdesk
 *
 * Self-healing Freshdesk↔Supabase sync. The webhook is fire-and-forget: a
 * deploy-window miss, an automation that didn't trigger (e.g. un-marking
 * spam fires nothing), or a 4xx/5xx response loses that update forever —
 * and a missed webhook is indistinguishable from "nothing happened". This
 * route re-reads every ticket Freshdesk says changed recently and upserts
 * the truth, so drift is bounded by the cron cadence instead of growing
 * forever (2026-08-20 audit: 162 lost tickets, 4,429 wrong created_at,
 * 1,819 "(Deactivated)" agent names accumulated in ~8 months).
 *
 * Schedule: vercel.json cron, every 3 hours. Lookback defaults to 4 hours
 * (cadence + overlap) — override with ?hours=N (max 168) for manual heals,
 * e.g. `?hours=48` after a long outage.
 *
 * Auth (production): `Authorization: Bearer <CRON_SECRET>` — Vercel sends
 * this automatically when the CRON_SECRET env var is set — or the existing
 * WEBHOOK_SECRET via either header for manual invocation.
 *
 * Policy notes:
 * - Upserts mirror the webhook's status policy via mapFreshdeskTicket().
 * - is_escalated is never set true here (CLAUDE.md invariant #5); it is
 *   only cleared for terminal/void statuses, same as the webhook.
 * - is_incomplete and tags are never touched (webhook-maintained).
 * - subject is only written when the DB row has none, so a manually
 *   curated subject is never clobbered.
 * - Rows identical in the DB are skipped, keeping Realtime churn ~zero on
 *   quiet runs.
 */

import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { requireSupabaseAdminOr503 } from "@/lib/supabaseAdmin";
import {
  fetchFreshdeskTicketsUpdatedSince,
  isFreshdeskConfigured,
  type ReconcileRow,
} from "@/lib/freshdeskApi";
import { utcMillisFromDbTimestamp } from "@/lib/istDate";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const DEFAULT_LOOKBACK_HOURS = 4;
const MAX_LOOKBACK_HOURS = 168; // one week — manual heal ceiling

function secretsEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

function isAuthorized(req: NextRequest): boolean {
  const bearer = (req.headers.get("authorization") ?? "").replace(
    /^Bearer\s+/i,
    "",
  );
  const headerSecret = req.headers.get("x-webhook-secret") ?? "";
  const candidates = [bearer, headerSecret].filter(Boolean);
  const secrets = [process.env.CRON_SECRET, process.env.WEBHOOK_SECRET].filter(
    (s): s is string => !!s,
  );
  if (secrets.length === 0) {
    // Same posture as webhookAuth: closed in production, open in dev.
    return process.env.NODE_ENV !== "production";
  }
  return candidates.some((c) => secrets.some((s) => secretsEqual(c, s)));
}

interface ExistingRow {
  ticket_id: string;
  status: string | null;
  queendom_name: string | null;
  agent_name: string | null;
  subject: string | null;
  created_at: string | null;
  resolved_at: string | null;
  fd_updated_at: string | null;
}

/** Two timestamps describe the same instant (2s tolerance for format drift). */
function sameInstant(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  const ma = a ? utcMillisFromDbTimestamp(a) : null;
  const mb = b ? utcMillisFromDbTimestamp(b) : null;
  if (ma == null || mb == null) return ma === mb;
  return Math.abs(ma - mb) <= 2000;
}

function needsUpsert(row: ReconcileRow, existing: ExistingRow): boolean {
  if (
    row.status.toLowerCase() !== (existing.status ?? "").trim().toLowerCase()
  ) {
    return true;
  }
  if (row.queendom_name !== (existing.queendom_name ?? "")) return true;
  if ((row.agent_name ?? null) !== (existing.agent_name ?? null)) return true;
  if (!sameInstant(row.created_at, existing.created_at)) return true;
  if ("resolved_at" in row && !sameInstant(row.resolved_at, existing.resolved_at)) {
    return true;
  }
  // Enrichment drift: fd_updated_at moves on ANY Freshdesk edit (priority,
  // type, first response, custom fields…), so one timestamp covers all
  // sixteen enrichment columns without field-by-field diffing.
  if (row.fd_updated_at && !sameInstant(row.fd_updated_at, existing.fd_updated_at)) {
    return true;
  }
  return false;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isFreshdeskConfigured()) {
    return NextResponse.json(
      { error: "FRESHDESK_DOMAIN / FRESHDESK_API_KEY not configured" },
      { status: 503 },
    );
  }
  const { db, response } = requireSupabaseAdminOr503();
  if (!db) return response!;

  const hoursParam = Number(req.nextUrl.searchParams.get("hours"));
  const hours =
    Number.isFinite(hoursParam) && hoursParam > 0
      ? Math.min(hoursParam, MAX_LOOKBACK_HOURS)
      : DEFAULT_LOOKBACK_HOURS;
  const sinceIso = new Date(Date.now() - hours * 3_600_000).toISOString();

  let fetched;
  try {
    fetched = await fetchFreshdeskTicketsUpdatedSince(sinceIso);
  } catch (err) {
    console.error("[reconcile-freshdesk] Freshdesk fetch failed:", err);
    return NextResponse.json(
      { error: `Freshdesk fetch failed: ${String(err)}` },
      { status: 502 },
    );
  }
  const { rows, pages, truncated } = fetched;

  // Load the current DB state for these ids and drop rows already in sync.
  const existingById = new Map<string, ExistingRow>();
  const ids = rows.map((r) => r.ticket_id);
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await db
      .from("tickets")
      .select(
        "ticket_id, status, queendom_name, agent_name, subject, created_at, resolved_at, fd_updated_at",
      )
      .in("ticket_id", ids.slice(i, i + 200));
    if (error) {
      console.error("[reconcile-freshdesk] read error:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    for (const row of (data ?? []) as ExistingRow[]) {
      existingById.set(row.ticket_id, row);
    }
  }

  const changed: ReconcileRow[] = [];
  const events: Array<Record<string, unknown>> = [];
  let inserted = 0;
  for (const row of rows) {
    const existing = existingById.get(row.ticket_id);
    if (!existing) {
      changed.push(row);
      inserted++;
      events.push({
        ticket_id: row.ticket_id,
        event_type: "created",
        to_value: row.status,
        agent_name: row.agent_name ?? null,
        queendom_name: row.queendom_name,
        occurred_at: row.created_at,
        source: "reconcile",
      });
      continue;
    }
    // Never clobber an existing subject (webhook keeps it fresher than us).
    if (existing.subject) delete row.subject;
    if (needsUpsert(row, existing)) {
      changed.push(row);
      const oldStatus = (existing.status ?? "").trim();
      if (oldStatus.toLowerCase() !== row.status.toLowerCase()) {
        events.push({
          ticket_id: row.ticket_id,
          event_type: "status_change",
          from_value: oldStatus,
          to_value: row.status,
          agent_name: row.agent_name ?? null,
          queendom_name: row.queendom_name,
          occurred_at: row.fd_updated_at ?? new Date().toISOString(),
          source: "reconcile",
        });
      }
    }
  }

  // PostgREST bulk upserts need uniform keys per request — group by key set.
  const byShape = new Map<string, ReconcileRow[]>();
  for (const row of changed) {
    const shape = Object.keys(row).sort().join(",");
    (byShape.get(shape) ?? byShape.set(shape, []).get(shape)!).push(row);
  }
  for (const [, batch] of byShape) {
    for (let i = 0; i < batch.length; i += 400) {
      const { error } = await db
        .from("tickets")
        .upsert(batch.slice(i, i + 400), { onConflict: "ticket_id" });
      if (error) {
        console.error("[reconcile-freshdesk] upsert error:", error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }
  }

  // Append state transitions for the founder timeline (best-effort — an
  // events hiccup must never fail the reconcile itself).
  if (events.length > 0) {
    const { error: evErr } = await db.from("ticket_events").insert(events);
    if (evErr) {
      console.error("[reconcile-freshdesk] ticket_events insert:", evErr.message);
    }
  }

  const summary = {
    ok: true,
    window_hours: hours,
    since: sinceIso,
    freshdesk_tickets_in_window: rows.length,
    pages,
    truncated,
    upserted: changed.length,
    inserted_missing: inserted,
    events_recorded: events.length,
    already_in_sync: rows.length - changed.length,
  };
  console.info("[reconcile-freshdesk]", JSON.stringify(summary));
  return NextResponse.json(summary);
}
