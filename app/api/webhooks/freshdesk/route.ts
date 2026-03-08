/**
 * POST /api/webhooks/freshdesk
 *
 * Receives a Freshdesk automation webhook and upserts the ticket into
 * the Supabase `tickets` table using the service-role key (bypasses RLS).
 *
 * Expected JSON body — map your Freshdesk automation variables like this:
 *   {
 *     "ticket_id":          "{{ticket.id}}",
 *     "status":             "{{ticket.status}}",
 *     "queendom_name":      "{{ticket.group.name}}",
 *     "agent_name":         "{{ticket.agent.name}}",
 *     "ticket_created_at":  "{{ticket.created_at}}",
 *     "resolved_date_time": "{{ticket.resolved_at}}"
 *   }
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
  ticket_id:          string | number;
  status:             string;
  queendom_name:      string;
  agent_name?:        string; // {{ticket.agent.name}}
  ticket_created_at?: string; // {{ticket.created_at}}
  resolved_date_time?: string; // {{ticket.resolved_at}} — empty string when not yet resolved
}

// Completed statuses — resolved_at is stamped
const RESOLVED_STATUSES = new Set(["resolved", "closed"]);

// Active statuses — resolved_at is cleared so re-opened tickets stop counting as solved
const ACTIVE_STATUSES = new Set([
  "open",
  "pending",
  "nudge client",
  "nudge vendor",
  "ongoing delivery",
  "invoice due",
]);

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

// Freshdesk sends "" or "null" for unset timestamp fields — treat those as null.
const isValidDate = (v: string | undefined): v is string =>
  typeof v === "string" && v.trim().length >= 10 && !isNaN(Date.parse(v));

export async function POST(req: NextRequest) {
  // ── Guard: env vars must be present ───────────────────────────────────────
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

  if (
    !supabaseUrl ||
    !serviceKey ||
    serviceKey === "paste_your_service_role_key_here"
  ) {
    console.error(
      "[freshdesk webhook] SUPABASE_SERVICE_ROLE_KEY is not configured",
    );
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY is not configured" },
      { status: 503 },
    );
  }

  // ── Parse body ─────────────────────────────────────────────────────────────
  let payload: FreshdeskPayload;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const {
    ticket_id,
    status,
    queendom_name,
    agent_name,
    ticket_created_at,
    resolved_date_time,
  } = payload;

  console.info(
    "[freshdesk webhook] incoming payload →",
    JSON.stringify(
      { ticket_id, status, queendom_name, agent_name, ticket_created_at, resolved_date_time },
      null,
      2,
    ),
  );

  if (!ticket_id || !status || !queendom_name) {
    console.error("[freshdesk webhook] missing required fields →", {
      ticket_id,
      status,
      queendom_name,
    });
    return NextResponse.json(
      { error: "Missing required fields: ticket_id, status, queendom_name" },
      { status: 400 },
    );
  }

  // ── Build upsert row ───────────────────────────────────────────────────────
  const statusLower = status.toLowerCase().trim();
  const now = new Date().toISOString();

  const row: Record<string, unknown> = {
    ticket_id: String(ticket_id),
    status,
    queendom_name,
    agent_name: agent_name && agent_name.trim().length > 0 ? agent_name.trim() : null,
  };

  // Include created_at only when Freshdesk sends a valid timestamp.
  // On INSERT without it, the DB DEFAULT NOW() applies automatically.
  // On conflict UPDATE, omitting it preserves the original creation time.
  if (isValidDate(ticket_created_at)) {
    row.created_at = ticket_created_at;
  }

  // resolved_at is determined by status category, not passed through blindly.
  // Freshdesk can send an empty string for unresolved tickets.
  // For terminal statuses (e.g. "Did not solve"), the key is omitted entirely
  // so the ON CONFLICT UPDATE leaves the existing DB value untouched.
  if (RESOLVED_STATUSES.has(statusLower)) {
    row.resolved_at = isValidDate(resolved_date_time) ? resolved_date_time : now;
  } else if (ACTIVE_STATUSES.has(statusLower)) {
    // Re-opened ticket — clear resolved_at so it no longer counts as solved.
    row.resolved_at = null;
  }

  const ticketIdStr = String(ticket_id);

  console.info("[freshdesk webhook] built row →", JSON.stringify(row, null, 2));

  // ── Upsert ─────────────────────────────────────────────────────────────────
  // Columns intentionally omitted from `row` are excluded from the generated
  // ON CONFLICT DO UPDATE SET clause, so their existing DB values are preserved:
  //
  //   created_at  — only included when Freshdesk sends a valid timestamp;
  //                 omitting it on conflict preserves the original creation time,
  //                 and the DB DEFAULT NOW() covers brand-new tickets.
  //
  //   resolved_at — omitted for terminal statuses (e.g. "Did not solve") so the
  //                 existing value is left untouched on conflict.
  const { error } = await adminClient()
    .from("tickets")
    .upsert(row, { onConflict: "ticket_id" });

  if (error) {
    console.error(
      "[freshdesk webhook] upsert error:",
      error.message,
      "| row:",
      row,
    );
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  console.info(
    `[freshdesk webhook] upserted ticket ${ticketIdStr} → "${status}" (${queendom_name})`,
    `| agent_name: ${(row.agent_name as string | null) ?? "null"} | resolved_at: ${(row.resolved_at as string | null | undefined) ?? "unchanged"}`,
  );

  return NextResponse.json({ ok: true, ticket_id: ticketIdStr });
}
