/**
 * lib/freshdeskApi.ts
 *
 * Read-side Freshdesk REST v2 client for the reconciliation cron
 * (app/api/cron/reconcile-freshdesk). The webhook stays the fast path;
 * this client is the truth path — it re-reads recently-updated tickets
 * straight from Freshdesk so missed webhooks can never silently diverge
 * the `tickets` table (2026-08-20 audit found 162 lost tickets, 4,429
 * arrival-time created_at stamps and 1,819 "(Deactivated)" agent names).
 *
 * Env: FRESHDESK_DOMAIN (e.g. indulge.freshdesk.com), FRESHDESK_API_KEY.
 *
 * Freshdesk API facts this module encodes (developers.freshdesk.com/api):
 * - Auth is HTTP Basic with the API key as username, "X" as password.
 * - GET /tickets?updated_since=… pages at 100/ticket max, ~minute-level
 *   rate limiting (429 + Retry-After) on this account's plan.
 * - `include=stats` adds resolved_at/closed_at per ticket (1 extra credit).
 * - Spam / permanently deleted tickets are NOT returned by the list API,
 *   so reconciliation can never resurrect a soft-deleted row.
 * - Numeric status ids map to the labels below; 5 is agent-facing
 *   "Closed" (customers see "Did not solve").
 */

import {
  TERMINAL_STATUSES,
  VOID_STATUSES,
  ACTIVE_CLEAR_RESOLVED_AT,
} from "./ticketStatus";

/** Agent-facing labels for Freshdesk's numeric ticket status ids. */
export const FD_STATUS_LABELS: Record<number, string> = {
  2: "Open",
  3: "Pending",
  4: "Resolved",
  5: "Closed",
  6: "Nudge Client",
  7: "Nudge Vendor",
  8: "Ongoing Delivery",
  9: "Invoice Due",
  9000: "Assigned to AI Agent",
};

/**
 * Freshdesk appends "(Deactivated)" to `{{ticket.agent.name}}` once an agent
 * is deactivated, which forked 1,819 rows off the roster (leaderboard rows
 * silently zeroed). Strip it everywhere a Freshdesk agent name is stored.
 */
export function cleanAgentName(
  raw: string | null | undefined,
): string | null {
  if (raw == null) return null;
  const cleaned = raw.replace(/\s*\(deactivated\)\s*$/i, "").trim();
  return cleaned || null;
}

/** Written to queendom_name when a Freshdesk ticket has no group. */
export const UNASSIGNED_QUEENDOM = "Unassigned";

/** Freshdesk numeric source ids → labels (channel mix analytics). */
export const FD_SOURCE_LABELS: Record<number, string> = {
  1: "Email",
  2: "Portal",
  3: "Phone",
  4: "Forum",
  6: "Facebook",
  7: "Chat",
  8: "MobiHelp",
  9: "Feedback Widget",
  10: "Outbound Email",
  11: "Ecommerce",
  12: "Bot",
  13: "WhatsApp",
};

interface FdTicketApi {
  id: number;
  status: number;
  priority?: number | null;
  source?: number | null;
  type?: string | null;
  group_id: number | null;
  responder_id: number | null;
  requester_id?: number | null;
  company_id?: number | null;
  subject: string | null;
  created_at: string;
  updated_at: string;
  due_by?: string | null;
  fr_due_by?: string | null;
  fr_escalated?: boolean;
  spam?: boolean;
  deleted?: boolean;
  custom_fields?: Record<string, unknown> | null;
  stats?: {
    resolved_at?: string | null;
    closed_at?: string | null;
    first_responded_at?: string | null;
    agent_responded_at?: string | null;
    reopened_at?: string | null;
    pending_since?: string | null;
  } | null;
}

/** Row shape upserted into `tickets` (same policy as the webhook upsert path). */
export interface ReconcileRow {
  ticket_id: string;
  status: string;
  queendom_name: string;
  created_at: string;
  agent_name?: string | null;
  subject?: string;
  resolved_at?: string | null;
  is_escalated?: boolean;
  // Founder-insight enrichment (2026-08-20) — nullable, TV never reads them.
  priority?: number | null;
  source?: string | null;
  ticket_type?: string | null;
  requester_id?: number | null;
  company_id?: number | null;
  first_responded_at?: string | null;
  agent_responded_at?: string | null;
  reopened_at?: string | null;
  pending_since?: string | null;
  closed_at?: string | null;
  due_by?: string | null;
  fr_due_by?: string | null;
  fr_escalated?: boolean | null;
  is_billable?: boolean | null;
  invoice_amount?: number | null;
  fd_updated_at?: string;
}

function parseInvoiceAmount(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(String(v).replace(/[₹,\s]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function fdCredentials(): { domain: string; authHeader: string } | null {
  const domain = process.env.FRESHDESK_DOMAIN?.trim();
  const key = process.env.FRESHDESK_API_KEY?.trim();
  if (!domain || !key) return null;
  return {
    domain,
    authHeader: `Basic ${Buffer.from(`${key}:X`).toString("base64")}`,
  };
}

export function isFreshdeskConfigured(): boolean {
  return fdCredentials() !== null;
}

async function fdGet<T>(path: string): Promise<T> {
  const creds = fdCredentials();
  if (!creds) {
    throw new Error("FRESHDESK_DOMAIN / FRESHDESK_API_KEY not configured");
  }
  const url = `https://${creds.domain}/api/v2${path}`;
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch(url, {
      headers: { Authorization: creds.authHeader },
      cache: "no-store",
    });
    if (res.status === 429 && attempt === 0) {
      const wait = Math.min(Number(res.headers.get("Retry-After") ?? 30), 40);
      await new Promise((r) => setTimeout(r, wait * 1000));
      continue;
    }
    if (!res.ok) {
      throw new Error(`Freshdesk GET ${path} → HTTP ${res.status}`);
    }
    return (await res.json()) as T;
  }
  throw new Error(`Freshdesk GET ${path} → rate-limited twice`);
}

/** Map a raw Freshdesk API ticket to a `tickets` upsert row (webhook policy). */
export function mapFreshdeskTicket(
  t: FdTicketApi,
  groupNames: Map<number, string>,
  agentNames: Map<number, string>,
): ReconcileRow {
  const status = t.deleted
    ? "deleted"
    : t.spam
      ? "spam"
      : (FD_STATUS_LABELS[t.status] ?? "Open");
  const statusLower = status.toLowerCase();

  const row: ReconcileRow = {
    ticket_id: String(t.id),
    status,
    queendom_name:
      (t.group_id != null ? groupNames.get(t.group_id) : null) ??
      UNASSIGNED_QUEENDOM,
    created_at: t.created_at,
    agent_name: cleanAgentName(
      t.responder_id != null ? (agentNames.get(t.responder_id) ?? null) : null,
    ),
  };
  const subject = (t.subject ?? "").trim();
  if (subject) row.subject = subject;

  // Enrichment columns — everything the founder analytics read.
  const cf = t.custom_fields ?? {};
  const billableRaw = cf["cf_is_the_request_billable"];
  const stats = t.stats ?? {};
  Object.assign(row, {
    priority: t.priority ?? null,
    source:
      t.source != null
        ? (FD_SOURCE_LABELS[t.source] ?? String(t.source))
        : null,
    ticket_type: t.type ?? null,
    requester_id: t.requester_id ?? null,
    company_id: t.company_id ?? null,
    first_responded_at: stats.first_responded_at ?? null,
    agent_responded_at: stats.agent_responded_at ?? null,
    reopened_at: stats.reopened_at ?? null,
    pending_since: stats.pending_since ?? null,
    closed_at: stats.closed_at ?? null,
    due_by: t.due_by ?? null,
    fr_due_by: t.fr_due_by ?? null,
    fr_escalated: t.fr_escalated ?? null,
    is_billable:
      billableRaw != null
        ? String(billableRaw).trim().toLowerCase() === "yes"
        : null,
    invoice_amount: parseInvoiceAmount(cf["cf_invoice_amount"]),
    fd_updated_at: t.updated_at,
  });

  // Mirror the webhook's status policy exactly (lib/ticketStatus.ts):
  // terminal → stamp resolved_at + clear escalation; void → clear escalation;
  // active → resolved_at must be NULL. is_escalated is never set true here —
  // only the SLA-breach webhook may do that (CLAUDE.md invariant #5).
  if (TERMINAL_STATUSES.has(statusLower)) {
    row.resolved_at =
      t.stats?.resolved_at ?? t.stats?.closed_at ?? t.updated_at;
    row.is_escalated = false;
  } else if (VOID_STATUSES.has(statusLower)) {
    row.is_escalated = false;
  } else if (ACTIVE_CLEAR_RESOLVED_AT.has(statusLower)) {
    row.resolved_at = null;
  }
  return row;
}

/**
 * Fetch every ticket updated in Freshdesk since `sinceIso` (UTC ISO) mapped
 * to upsert rows. Also returns the group/agent name maps for diagnostics.
 *
 * `maxPages` bounds a runaway window (100 tickets/page); at the dashboard's
 * ~130 tickets/day a 4-hour window is normally a single page.
 */
export async function fetchFreshdeskTicketsUpdatedSince(
  sinceIso: string,
  maxPages = 30,
): Promise<{ rows: ReconcileRow[]; pages: number; truncated: boolean }> {
  const [groups, agents] = await Promise.all([
    fdGet<Array<{ id: number; name: string }>>("/groups?per_page=100"),
    fdGet<Array<{ id: number; contact: { name: string } }>>(
      "/agents?per_page=100",
    ),
  ]);
  const groupNames = new Map(groups.map((g) => [g.id, g.name]));
  const agentNames = new Map(agents.map((a) => [a.id, a.contact.name]));

  const rows: ReconcileRow[] = [];
  let page = 1;
  let truncated = false;
  for (; page <= maxPages; page++) {
    const batch = await fdGet<FdTicketApi[]>(
      `/tickets?updated_since=${encodeURIComponent(sinceIso)}` +
        `&order_by=updated_at&order_type=asc&per_page=100&page=${page}&include=stats`,
    );
    for (const t of batch) {
      rows.push(mapFreshdeskTicket(t, groupNames, agentNames));
    }
    if (batch.length < 100) return { rows, pages: page, truncated };
  }
  truncated = true;
  console.warn(
    `[freshdeskApi] reconcile window truncated at ${maxPages} pages — widen the cron or shrink the window`,
  );
  return { rows, pages: maxPages, truncated };
}
