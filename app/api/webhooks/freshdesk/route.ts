/**
 * POST /api/webhooks/freshdesk
 *
 * Receives a Freshdesk automation webhook and upserts the ticket into
 * the Supabase `tickets` table using the service-role key (bypasses RLS).
 *
 * Freshdesk automation payload — map variables exactly as shown:
 *
 *   {
 *     "ticket_id":          "{{ticket.id}}",
 *     "status":             "{{ticket.status}}",
 *     "queendom_name":      "{{ticket.group.name}}",
 *     "agent_name":         "{{ticket.agent.name}}",
 *     "ticket_created_at":  "{{ticket.created_on}}",
 *     "resolved_date_time": "{{ticket.status_changed_on}}"
 *   }
 *
 * ── TIMEZONE HANDLING ─────────────────────────────────────────────────────────
 * Freshdesk sends timestamps WITHOUT an explicit timezone offset
 * (e.g. "2026-03-11 12:44:19"). PostgreSQL TIMESTAMPTZ stores values as UTC
 * internally. If we insert a bare IST string without an offset, Postgres
 * treats it as UTC — which is wrong by 5 h 30 min and causes all date-range
 * comparisons on the dashboard to be off.
 *
 * Fix: normalizeIST() detects a missing offset and appends "+05:30" before the
 * row is sent to Supabase. Postgres then stores the correct UTC equivalent, and
 * the API routes' UTC→IST date conversion always yields the right IST calendar
 * date regardless of server timezone (Vercel/Render both run UTC).
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Supabase table DDL (run once):
 * ─────────────────────────────────────────────────────────────────────────────
 *   CREATE TABLE public.tickets (
 *     ticket_id     TEXT        PRIMARY KEY,
 *     status        TEXT        NOT NULL,
 *     queendom_name TEXT        NOT NULL,
 *     agent_name    TEXT,
 *     created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 *     resolved_at   TIMESTAMPTZ
 *   );
 *   ALTER PUBLICATION supabase_realtime ADD TABLE public.tickets;
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

interface FreshdeskPayload {
  ticket_id: string | number;
  status: string;
  queendom_name: string;
  agent_name: string;
  ticket_created_at?: string;  // {{ticket.created_on}}
  resolved_date_time?: string; // {{ticket.status_changed_on}} — empty when not resolved
}

// ── Status sets ───────────────────────────────────────────────────────────────
const RESOLVED_STATUSES = new Set(["resolved", "closed"]);

const ACTIVE_STATUSES = new Set([
  "open",
  "pending",
  "nudge client",
  "nudge vendor",
  "ongoing delivery",
  "invoice due",
]);

// ── Helpers ───────────────────────────────────────────────────────────────────

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

/**
 * Returns true when `v` looks like a parseable date (≥10 chars, not a Freshdesk
 * placeholder literal like "{{ticket.created_on}}").
 */
const isValidDate = (v: string | undefined): v is string =>
  typeof v === "string" && v.trim().length >= 10 && !isNaN(Date.parse(v));

/**
 * Normalises an IST timestamp for safe storage in a PostgreSQL TIMESTAMPTZ column.
 *
 * Problem: Freshdesk sends bare timestamps without a timezone offset, e.g.
 *   "2026-03-11 12:44:19"
 * PostgreSQL interprets these as UTC, so it stores the wrong instant — off by
 * 5 h 30 min. Tickets created between midnight IST and 05:30 IST end up with
 * a UTC date that is one day EARLIER, breaking every "today" metric.
 *
 * Fix: append "+05:30" when the string has no timezone information so Postgres
 * stores the correct UTC equivalent of the IST moment.
 */
function normalizeIST(v: string | undefined): string | null {
  if (!isValidDate(v)) return null;
  const s = v.trim();
  // Already has a timezone indicator (Z, +HH:MM, -HH:MM, or +HHMM)
  if (/Z$/.test(s) || /[+\-]\d{2}:?\d{2}$/.test(s)) return s;
  // No timezone → assume IST; append explicit offset so Postgres stores UTC correctly
  return `${s}+05:30`;
}

// ── POST handler ──────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

  if (
    !supabaseUrl ||
    !serviceKey  ||
    serviceKey === "paste_your_service_role_key_here"
  ) {
    console.error("[freshdesk webhook] SUPABASE_SERVICE_ROLE_KEY is not configured");
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY is not configured" },
      { status: 503 },
    );
  }

  // ── Parse body ──────────────────────────────────────────────────────────────
  let payload: FreshdeskPayload;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { ticket_id, status, queendom_name, agent_name, ticket_created_at, resolved_date_time } = payload;

  if (!ticket_id || !status || !queendom_name) {
    console.error("[freshdesk webhook] missing required fields →", { ticket_id, status, queendom_name });
    return NextResponse.json(
      { error: "Missing required fields: ticket_id, status, queendom_name" },
      { status: 400 },
    );
  }

  // ── Build upsert row ────────────────────────────────────────────────────────
  const statusLower = status.toLowerCase().trim();

  const row: Record<string, unknown> = {
    ticket_id:     String(ticket_id),
    status,
    queendom_name,
    agent_name:    agent_name || null,
  };

  // created_at — normalised to IST so Postgres stores the right UTC instant.
  // On INSERT without it, DB DEFAULT NOW() (UTC) applies.
  // On conflict UPDATE, omitting it preserves the original creation time.
  const normCreated = normalizeIST(ticket_created_at);
  if (normCreated) row.created_at = normCreated;

  // resolved_at — set only for terminal statuses; cleared for re-opened tickets.
  if (RESOLVED_STATUSES.has(statusLower)) {
    // Use the Freshdesk status_changed_on time (normalised to IST); fall back
    // to server NOW() (already UTC) if Freshdesk didn't send a valid timestamp.
    row.resolved_at = normalizeIST(resolved_date_time) ?? new Date().toISOString();
  } else if (ACTIVE_STATUSES.has(statusLower)) {
    // Ticket re-opened → clear resolved_at so it no longer counts as solved.
    row.resolved_at = null;
  }
  // For other statuses (e.g. "Did not solve") we omit resolved_at entirely so
  // the ON CONFLICT UPDATE leaves the existing DB value untouched.

  // ── Upsert ──────────────────────────────────────────────────────────────────
  const { error } = await adminClient()
    .from("tickets")
    .upsert(row, { onConflict: "ticket_id" });

  if (error) {
    console.error("[freshdesk webhook] upsert error:", error.message, "| row:", row);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  console.info(
    `[freshdesk webhook] upserted ticket ${String(ticket_id)} → "${status}" (${queendom_name})`,
    `| agent: ${(row.agent_name as string | null) ?? "null"}`,
    `| created_at: ${(row.created_at as string | undefined) ?? "unchanged"}`,
    `| resolved_at: ${(row.resolved_at as string | null | undefined) ?? "unchanged"}`,
  );

  return NextResponse.json({ ok: true, ticket_id: String(ticket_id) });
}
