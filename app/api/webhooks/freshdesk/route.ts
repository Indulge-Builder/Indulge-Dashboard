/**
 * POST /api/webhooks/freshdesk
 *
 * Receives Freshdesk automation webhooks and updates the Supabase `tickets`
 * table. Supports two automations hitting the same route:
 *
 *   1. Status Change — full payload (status, queendom_name, etc.); full sync.
 *   2. SLA Breached — minimal payload (id + is_escalated); PATCH only.
 *
 * PATCH: Only fields sent in the payload are updated (e.g. is_escalated-only
 * does not overwrite status).
 * Sync: If status is Resolved, is_escalated is forced to false (safety check).
 * Real-time: Supabase broadcasts UPDATEs; Dashboard refetches on postgres_changes.
 *
 * Expected JSON body — map your Freshdesk automation variables like this:
 *
 *   Upsert/update:
 *   {
 *     "ticket_id":          "{{ticket.id}}",
 *     "status":             "{{ticket.status}}",
 *     "queendom_name":      "{{ticket.group.name}}",
 *     "agent_name":         "{{ticket.agent.name}}",
 *     "ticket_created_at":  "{{ticket.created_at}}",
 *     "resolved_date_time": "{{ticket.resolved_at}}",
 *     "is_escalated":       true   // optional; SLA escalation flag
 *   }
 *
 *   Escalation-only (minimal payload):
 *   {
 *     "id":            "{{ticket.id}}",
 *     "is_escalated":   true
 *   }
 *
 *   Deletion (ticket deleted in Freshdesk):
 *   {
 *     "webhook_type": "deletion",
 *     "ticket_id":    "{{ticket.id}}"
 *   }
 *   Also accepts: webhook_type "delete" or "ticket_deleted"; or event/type instead of webhook_type.
 *
 * Supabase table DDL (run once):
 * ─────────────────────────────────────────────────────────────────────────────
 *   CREATE TABLE public.tickets (
 *     ticket_id     TEXT        PRIMARY KEY,
 *     status        TEXT        NOT NULL,
 *     queendom_name TEXT        NOT NULL,
 *     agent_name    TEXT,
 *     created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 *     resolved_at   TIMESTAMPTZ,
 *     is_escalated  BOOLEAN     NOT NULL DEFAULT false
 *   );
 *   ALTER PUBLICATION supabase_realtime ADD TABLE public.tickets;
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { NextRequest, NextResponse } from "next/server";
import { requireSupabaseAdminOr503 } from "@/lib/supabaseAdmin";

type WebhookType = "upsert" | "update" | "deletion";

interface FreshdeskPayload {
  webhook_type?: WebhookType;
  ticket_id?: string | number;
  id?: string | number; // alias for ticket_id (Freshdesk: {{ticket.id}})
  ticket?: { id?: string | number };
  // Fields below are only present for upsert/update webhooks.
  status?: string;
  queendom_name?: string;
  agent_name?: string; // {{ticket.agent.name}}
  ticket_created_at?: string; // {{ticket.created_at}}
  resolved_date_time?: string; // {{ticket.resolved_at}} — empty string when not yet resolved
  is_escalated?: boolean;
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

// Freshdesk sends "" or "null" for unset timestamp fields — treat those as null.
const isValidDate = (v: string | undefined): v is string =>
  typeof v === "string" && v.trim().length >= 10 && !isNaN(Date.parse(v));

export async function POST(req: NextRequest) {
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

  // ── Parse body ─────────────────────────────────────────────────────────────
  let rawBody = await req.text();

  // Freshdesk sometimes sends "is_escalated": \n} (empty value) when the
  // variable is unset — invalid JSON. Fix before parsing.
  rawBody = rawBody.replace(
    /"is_escalated"\s*:\s*(?=\s*[,\}\]])/g,
    '"is_escalated": false',
  );

  let payload: FreshdeskPayload;
  try {
    payload = JSON.parse(rawBody) as FreshdeskPayload;
  } catch (parseErr) {
    console.error("[freshdesk webhook] 400 Invalid JSON body", {
      parseError: String(parseErr),
      rawBodyPreview: rawBody?.slice?.(0, 500),
    });
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Log full payload for debugging 400s — visible in Vercel Function Logs
  console.log("[freshdesk webhook] received payload:", JSON.stringify(payload));

  // Resolve ticket_id — support ticket_id, id, or nested payload.ticket.id
  const ticketIdRaw =
    payload.ticket_id ??
    payload.id ??
    (payload as { ticket?: { id?: string | number } }).ticket?.id;
  if (!ticketIdRaw) {
    console.error("[freshdesk webhook] 400 Missing ticket_id or id", {
      payload,
      hasTicketId: !!payload.ticket_id,
      hasId: !!payload.id,
    });
    return NextResponse.json(
      { error: "Missing required field: ticket_id or id" },
      { status: 400 },
    );
  }

  const ticketIdStr = String(ticketIdRaw);

  // Detect deletion — Freshdesk may send webhook_type, event, or type
  const webhookType = (
    payload.webhook_type ??
    (payload as { event?: string }).event ??
    (payload as { type?: string }).type ??
    ""
  ).toLowerCase();

  const isDeletion =
    webhookType === "deletion" ||
    webhookType === "delete" ||
    webhookType === "ticket_deleted";

  // ── Deletion branch ────────────────────────────────────────────────────────
  if (isDeletion) {
    console.info(
      `[freshdesk webhook] handling deletion for ticket ${ticketIdStr}`,
    );
    const { data: deleted, error } = await db
      .from("tickets")
      .delete()
      .eq("ticket_id", ticketIdStr)
      .select("ticket_id");

    if (error) {
      console.error(
        `[freshdesk webhook] deletion error for ticket ${ticketIdStr}:`,
        error.message,
      );
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const rowCount = Array.isArray(deleted) ? deleted.length : 0;
    if (rowCount === 0) {
      console.warn(
        `[freshdesk webhook] deletion: ticket ${ticketIdStr} not found in DB (already gone or never synced)`,
      );
    } else {
      console.info(
        `[freshdesk webhook] deleted ticket ${ticketIdStr} from dashboard`,
      );
    }

    return NextResponse.json({
      ok: true,
      deleted: ticketIdStr,
      rows_removed: rowCount,
    });
  }

  // ── Escalation-only branch (PATCH: only is_escalated; SLA Breached automation) ─
  // When only is_escalated is sent, we PATCH that field only — never overwrite
  // status, queendom_name, agent_name, etc. Sync state: if ticket is Resolved,
  // force is_escalated=false regardless of payload (safety check).
  const isEscalatedPayload =
    typeof payload.is_escalated === "boolean" &&
    (!payload.status || !payload.queendom_name);

  if (isEscalatedPayload) {
    const client = db;

    // Safety: fetch current status — if Resolved/Closed, force is_escalated=false
    const { data: existing } = await client
      .from("tickets")
      .select("status")
      .eq("ticket_id", ticketIdStr)
      .maybeSingle();

    const statusLower = (existing?.status ?? "").toLowerCase().trim();
    const isResolved = RESOLVED_STATUSES.has(statusLower);
    const effectiveEscalated = isResolved ? false : payload.is_escalated;

    const { error } = await client
      .from("tickets")
      .update({ is_escalated: effectiveEscalated })
      .eq("ticket_id", ticketIdStr);

    if (error) {
      console.error(
        `[freshdesk webhook] escalation update error for ticket ${ticketIdStr}:`,
        error.message,
      );
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (isResolved && payload.is_escalated) {
      console.info(
        `[freshdesk webhook] ticket ${ticketIdStr} is Resolved — forced is_escalated=false (ignored payload true)`,
      );
    } else {
      console.info(
        `[freshdesk webhook] patched is_escalated=${effectiveEscalated} for ticket ${ticketIdStr}`,
      );
    }

    // Supabase Realtime broadcasts this UPDATE; Dashboard tickets-channel will
    // receive postgres_changes and refetch agents, updating the Leaderboard.
    return NextResponse.json({
      ok: true,
      ticket_id: ticketIdStr,
      is_escalated: effectiveEscalated,
    });
  }

  // ── Full sync branch (Status Change automation) ────────────────────────────
  // Requires status + queendom_name. Sync state: if status is Resolved, force
  // is_escalated=false regardless of payload (safety check).
  const { status, queendom_name, agent_name, ticket_created_at, resolved_date_time, is_escalated } = payload;

  if (!status || !queendom_name) {
    console.error("[freshdesk webhook] 400 Missing status or queendom_name", {
      ticket_id: ticketIdStr,
      status: status ?? "(missing)",
      queendom_name: queendom_name ?? "(missing)",
      fullPayload: payload,
    });
    return NextResponse.json(
      { error: "Missing required fields: status, queendom_name" },
      { status: 400 },
    );
  }

  // ── Build upsert row (only fields sent in payload) ──────────────────────────
  const statusLower = status.toLowerCase().trim();
  const now = new Date().toISOString();

  const row: Record<string, unknown> = {
    ticket_id: ticketIdStr,
    status,
    queendom_name,
  };
  // Patch: only include agent_name if explicitly sent (avoid overwriting with null)
  if (payload.agent_name !== undefined) {
    row.agent_name = agent_name;
  }

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
    row.resolved_at = isValidDate(resolved_date_time)
      ? resolved_date_time
      : now;
    // Sync state: Resolved → force is_escalated=false (ignores payload)
    row.is_escalated = false;
  } else if (ACTIVE_STATUSES.has(statusLower)) {
    // Re-opened ticket — clear resolved_at so it no longer counts as solved.
    row.resolved_at = null;
    // Only update is_escalated when explicitly provided in payload
    if (typeof is_escalated === "boolean") {
      row.is_escalated = is_escalated;
    }
  } else {
    // Other statuses (e.g. "Did not solve") — update is_escalated if provided
    if (typeof is_escalated === "boolean") {
      row.is_escalated = is_escalated;
    }
  }

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
  const { error } = await db
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
