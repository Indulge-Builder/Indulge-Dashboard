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
 *     "subject":            "{{ticket.subject}}",
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
 *     subject       TEXT,
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
import { assertWebhookSecret } from "@/lib/webhookAuth";
import { cleanAgentName, UNASSIGNED_QUEENDOM } from "@/lib/freshdeskApi";
import {
  SLA_SAFE_STATUSES,
  ACTIVE_CLEAR_RESOLVED_AT,
  TERMINAL_STATUSES,
  VOID_STATUSES,
} from "@/lib/ticketStatus";

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
  subject?: string; // {{ticket.subject}} — shown in the Overdue Ticker
  ticket_created_at?: string; // {{ticket.created_at}}
  resolved_date_time?: string; // {{ticket.resolved_at}} — empty string when not yet
  /** SLA breach automation only — must be a JSON boolean. */
  is_escalated?: boolean;
}

// Status policy sets (SLA_SAFE / ACTIVE_CLEAR_RESOLVED_AT / TERMINAL / VOID)
// are shared with the aggregation math — single source: lib/ticketStatus.ts.

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
  const unauthorized = assertWebhookSecret(req);
  if (unauthorized) return unauthorized;

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

  const ticketIdRaw =
    payload.ticket_id ??
    payload.id ??
    (payload as { ticket?: { id?: string | number } }).ticket?.id;
  if (!ticketIdRaw) {
    console.error("[freshdesk webhook] 400 Missing ticket_id or id", {
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

  console.info("[freshdesk webhook] accepted", {
    ticketId: ticketIdStr,
    webhookType: webhookType || "upsert",
  });

  const isDeletion =
    webhookType === "deletion" ||
    webhookType === "delete" ||
    webhookType === "ticket_deleted";

  if (isDeletion) {
    // Soft-delete: keep the row in Supabase for audit but mark it "deleted" so
    // the math engine's VOID_STATUSES filter hides it from all dashboard metrics.
    console.info(
      `[freshdesk webhook] soft-deleting ticket ${ticketIdStr} (status → "deleted")`,
    );
    const { error } = await db
      .from("tickets")
      .update({ status: "deleted", is_escalated: false })
      .eq("ticket_id", ticketIdStr);

    if (error) {
      console.error(
        `[freshdesk webhook] soft-deletion error for ticket ${ticketIdStr}:`,
        error.message,
      );
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.info(
      `[freshdesk webhook] ticket ${ticketIdStr} marked deleted (invisible to TV dashboard)`,
    );
    void db.from("ticket_events").insert({
      ticket_id: ticketIdStr,
      event_type: "status_change",
      to_value: "deleted",
      source: "webhook",
    });

    return NextResponse.json({ ok: true, voided: ticketIdStr, status: "deleted" });
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
      if (effectiveEscalated === true) {
        // Founder timeline — best-effort, never fails the webhook.
        void db.from("ticket_events").insert({
          ticket_id: ticketIdStr,
          event_type: "escalated",
          to_value: "true",
          source: "webhook",
        });
      }
    }

    return NextResponse.json({
      ok: true,
      ticket_id: ticketIdStr,
      is_escalated: effectiveEscalated,
    });
  }

  const { status, queendom_name, agent_name, ticket_created_at, resolved_date_time } =
    payload;

  if (!status) {
    console.error("[freshdesk webhook] 400 Missing status", {
      ticket_id: ticketIdStr,
      fullPayload: payload,
    });
    return NextResponse.json(
      { error: "Missing required field: status" },
      { status: 400 },
    );
  }

  // Unassigned Freshdesk tickets render {{ticket.group.name}} as empty — store
  // them under a sentinel group instead of bouncing the webhook (a 400 here
  // means the ticket never reaches the DB at all until reconciliation).
  const queendomName = queendom_name?.trim() || UNASSIGNED_QUEENDOM;

  const statusLower = status.toLowerCase().trim();
  const now = new Date().toISOString();

  const row: Record<string, unknown> = {
    ticket_id: ticketIdStr,
    status,
    queendom_name: queendomName,
  };
  if (payload.agent_name !== undefined) {
    // Freshdesk suffixes "(Deactivated)" onto deactivated agents' names, which
    // forks them off the roster — store the clean name (lib/freshdeskApi.ts).
    row.agent_name = cleanAgentName(agent_name);
  }
  // Only overwrite subject when the payload actually carries one, so an update
  // webhook that omits {{ticket.subject}} can't blank a previously-stored value.
  if (typeof payload.subject === "string" && payload.subject.trim()) {
    row.subject = payload.subject.trim();
  }

  const createdIso = parseWebhookInstant(ticket_created_at);
  if (createdIso) {
    row.created_at = createdIso;
  }

  if (TERMINAL_STATUSES.has(statusLower)) {
    // Terminal completion — stamp resolved_at and clear escalation (also in SLA_SAFE).
    row.resolved_at = parseWebhookInstant(resolved_date_time) ?? now;
    row.is_escalated = false;
  } else if (VOID_STATUSES.has(statusLower)) {
    // Spam / deleted arriving via a normal status-update webhook — clear escalation.
    row.is_escalated = false;
  } else if (ACTIVE_CLEAR_RESOLVED_AT.has(statusLower)) {
    row.resolved_at = null;
    if (SLA_SAFE_STATUSES.has(statusLower)) {
      row.is_escalated = false;
    }
  }

  // Prior state for the founder timeline (one indexed PK read per webhook).
  const { data: prior } = await db
    .from("tickets")
    .select("status")
    .eq("ticket_id", ticketIdStr)
    .maybeSingle();

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

  // Append the transition (best-effort — an events hiccup never fails the
  // webhook; the reconcile cron records anything missed here).
  const priorStatus = (prior?.status ?? "").trim();
  if (!prior) {
    void db.from("ticket_events").insert({
      ticket_id: ticketIdStr,
      event_type: "created",
      to_value: status,
      agent_name: (row.agent_name as string | null) ?? null,
      queendom_name: queendomName,
      occurred_at: createdIso ?? now,
      source: "webhook",
    });
  } else if (priorStatus.toLowerCase() !== statusLower) {
    void db.from("ticket_events").insert({
      ticket_id: ticketIdStr,
      event_type: "status_change",
      from_value: priorStatus,
      to_value: status,
      agent_name: (row.agent_name as string | null) ?? null,
      queendom_name: queendomName,
      source: "webhook",
    });
  }

  console.info(
    `[freshdesk webhook] upserted ticket ${ticketIdStr} → "${status}" (${queendomName})`,
    `| agent_name: ${(row.agent_name as string | null) ?? "null"} | resolved_at: ${(row.resolved_at as string | null | undefined) ?? "unchanged"}`,
  );

  return NextResponse.json({ ok: true, ticket_id: ticketIdStr });
}
