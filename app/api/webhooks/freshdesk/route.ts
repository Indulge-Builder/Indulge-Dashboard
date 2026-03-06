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
    agent_name: agent_name?.trim() || null,
    // Use Freshdesk's creation timestamp when valid; fall back to now()
    // only for genuinely new tickets where Freshdesk omits the field.
    created_at: isValidDate(ticket_created_at) ? ticket_created_at : now,
    // resolved_at is determined by status, not passed through blindly —
    // Freshdesk can send an empty string for unresolved tickets.
    resolved_at: (() => {
      if (RESOLVED_STATUSES.has(statusLower)) {
        // Use Freshdesk's timestamp if valid, otherwise stamp now.
        return isValidDate(resolved_date_time) ? resolved_date_time : now;
      }
      if (ACTIVE_STATUSES.has(statusLower)) {
        // Re-opened ticket — clear resolved_at so it no longer counts as solved.
        return null;
      }
      // Terminal statuses like "Did not solve" — leave resolved_at unchanged.
      return undefined;
    })(),
  };

  // Remove resolved_at from the row entirely when it should remain unchanged
  // (undefined means "don't touch this column on conflict update").
  if (row.resolved_at === undefined) {
    delete row.resolved_at;
  }

  const db = adminClient();
  const ticketIdStr = String(ticket_id);

  // ── Step 1: attempt UPDATE on the existing row ─────────────────────────────
  // Only touch the columns that legitimately change on a status update.
  // created_at is intentionally excluded — we never overwrite the original
  // ticket creation time when processing a status-change event.
  const updateCols: Record<string, unknown> = {
    status,
    queendom_name,
    agent_name: agent_name?.trim() || null,
  };
  if ("resolved_at" in row) updateCols.resolved_at = row.resolved_at;

  const { data: updated, error: updateError } = await db
    .from("tickets")
    .update(updateCols)
    .eq("ticket_id", ticketIdStr)
    .select("ticket_id");

  if (updateError) {
    console.error(
      "[freshdesk webhook] update error:",
      updateError.message,
      "| cols:",
      updateCols,
    );
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // ── Step 2: INSERT only when the ticket does not exist yet ─────────────────
  // updated is an empty array (not null) when no row matched the .eq() filter,
  // which means this is a brand-new ticket Freshdesk is telling us about.
  if (!updated || updated.length === 0) {
    const { error: insertError } = await db.from("tickets").insert(row);

    if (insertError) {
      console.error(
        "[freshdesk webhook] insert error:",
        insertError.message,
        "| row:",
        row,
      );
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    console.info(
      `[freshdesk webhook] INSERT ticket ${ticketIdStr} → "${status}" (${queendom_name})`,
      `| created_at: ${row.created_at} | resolved_at: ${row.resolved_at ?? "null"}`,
    );
  } else {
    console.info(
      `[freshdesk webhook] UPDATE ticket ${ticketIdStr} → "${status}" (${queendom_name})`,
      `| resolved_at: ${updateCols.resolved_at ?? "null/unchanged"}`,
    );
  }

  return NextResponse.json({ ok: true, ticket_id: ticketIdStr });
}
