/**
 * POST /api/webhooks/freshdesk
 *
 * Receives Freshdesk automation webhooks and updates the Supabase `tickets`
 * table. Supports two automations hitting the same route:
 *
 *   1. Status / ticket update — full payload (status, queendom_name, agent, …);
 *      partial upsert: **omit** `is_escalated` for active/red-list statuses so the
 *      DB value is preserved; **set** `is_escalated: false` only for SLA-safe
 *      statuses (see SLA_SAFE_STATUSES). Do **not** send `is_escalated` from
 *      Freshdesk placeholders (they often stringify to "" and corrupt booleans).
 *   2. SLA breached — minimal payload (`ticket_id` + `is_escalated: true` boolean);
 *      PATCH `is_escalated` only. This branch is the **only** code path that can
 *      set `is_escalated` to **true** (when existing status is not SLA-safe).
 *
 * PATCH: Only fields sent in the payload are updated (e.g. is_escalated-only
 * does not overwrite status).
 * Real-time: Supabase broadcasts UPDATEs; Dashboard refetches on postgres_changes.
 *
 * Expected JSON body — map your Freshdesk automation variables like this:
 *
 *   Upsert/update (**omit** is_escalated):
 *   {
 *     "ticket_id":          "{{ticket.id}}",
 *     "status":             "{{ticket.status}}",
 *     "queendom_name":      "{{ticket.group.name}}",
 *     "agent_name":         "{{ticket.agent.name}}",
 *     "ticket_created_at":  "{{ticket.created_at}}",
 *     "resolved_date_time": "{{ticket.resolved_at}}"
 *   }
 *
 *   Escalation-only (minimal payload):
 *   {
 *     "id":            "{{ticket.id}}",
 *     "is_escalated":  true
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
import { freshdeskTimestampToIsoUtcForDb } from "@/lib/istDate";

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
  resolved_date_time?: string; // {{ticket.resolved_at}} — empty string when not yet
  /** SLA breach automation only — must be a JSON boolean. */
  is_escalated?: boolean;
}

// Statuses where SLA/overdue score must be cleared (explicit false on upsert).
const SLA_SAFE_STATUSES = new Set([
  "resolved",
  "closed",
  "nudge client",
  "ongoing delivery",
  "invoice due",
]);

// Red list (Open, Pending, Nudge Vendor): do not send is_escalated on upsert —
// preserves DB (e.g. stays true after SLA breach). Same for resolved_at: clear.
const ACTIVE_CLEAR_RESOLVED_AT = new Set([
  "open",
  "pending",
  "nudge client",
  "nudge vendor",
  "ongoing delivery",
  "invoice due",
]);

// Terminal completion — stamp resolved_at and clear escalation (also in SLA_SAFE).
const RESOLVED_STATUSES = new Set(["resolved", "closed"]);

/**
 * Convert Freshdesk datetime strings to strict UTC ISO (`…Z`) for `timestamptz`.
 * Never return a naive string — PostgREST/Postgres may otherwise interpret it as UTC wall time.
 */
function parseWebhookInstant(v: string | undefined): string | null {
  if (v == null || typeof v !== "string") return null;
  const t = v.trim();
  if (t.length < 10) return null;
  return freshdeskTimestampToIsoUtcForDb(t);
}

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

  console.log("[freshdesk webhook] received payload:", JSON.stringify(payload));

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

  // ── Escalation-only (SLA breach): only path that may set is_escalated = true ─
  const isEscalatedPayload =
    typeof payload.is_escalated === "boolean" &&
    (!payload.status || !payload.queendom_name);

  if (isEscalatedPayload) {
    const { data: existing } = await db
      .from("tickets")
      .select("status")
      .eq("ticket_id", ticketIdStr)
      .maybeSingle();

    const statusLower = (existing?.status ?? "").toLowerCase().trim();
    const inSafe = SLA_SAFE_STATUSES.has(statusLower);
    const effectiveEscalated = inSafe ? false : payload.is_escalated;

    const { error } = await db
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

    if (inSafe && payload.is_escalated) {
      console.info(
        `[freshdesk webhook] ticket ${ticketIdStr} has SLA-safe status — forced is_escalated=false (ignored payload true)`,
      );
    } else {
      console.info(
        `[freshdesk webhook] patched is_escalated=${effectiveEscalated} for ticket ${ticketIdStr}`,
      );
    }

    return NextResponse.json({
      ok: true,
      ticket_id: ticketIdStr,
      is_escalated: effectiveEscalated,
    });
  }

  const { status, queendom_name, agent_name, ticket_created_at, resolved_date_time } =
    payload;

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

  const statusLower = status.toLowerCase().trim();
  const now = new Date().toISOString();

  const row: Record<string, unknown> = {
    ticket_id: ticketIdStr,
    status,
    queendom_name,
  };
  if (payload.agent_name !== undefined) {
    row.agent_name = agent_name;
  }

  const createdIso = parseWebhookInstant(ticket_created_at);
  if (createdIso) {
    row.created_at = createdIso;
  }

  if (RESOLVED_STATUSES.has(statusLower)) {
    row.resolved_at = parseWebhookInstant(resolved_date_time) ?? now;
    row.is_escalated = false;
  } else if (ACTIVE_CLEAR_RESOLVED_AT.has(statusLower)) {
    row.resolved_at = null;
    if (SLA_SAFE_STATUSES.has(statusLower)) {
      row.is_escalated = false;
    }
  }

  const { error } = await db.from("tickets").upsert(row, { onConflict: "ticket_id" });

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
