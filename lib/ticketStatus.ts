/**
 * Single source of truth for Freshdesk ticket status classification
 * (dry-audit D3). Every aggregation and webhook path imports from here —
 * never redefine these sets locally (CLAUDE.md invariants #2/#3).
 *
 * All membership tests are case-insensitive on the trimmed status string.
 */

const norm = (s: string | null | undefined): string =>
  (s ?? "").toLowerCase().trim();

/**
 * Void statuses: spam / deleted tickets stay in Supabase for audit but are
 * completely invisible to the TV dashboard — filtered out before any math.
 */
export const VOID_STATUSES = new Set(["spam", "deleted"]);

/** Statuses that mean a ticket is legitimately done (actual successes only). */
export const TERMINAL_STATUSES = new Set(["resolved", "closed"]);

/** Pending statuses where `is_incomplete` feeds the agent leaderboard incomplete column. */
export const INCOMPLETE_SCORE_STATUSES = new Set([
  "nudge client",
  "nudge vendor",
  "ongoing delivery",
  "invoice due",
]);

/**
 * Webhook upsert policy: statuses where SLA/overdue score must be cleared
 * (explicit `is_escalated: false`). Built from the shared sets so it can never
 * fork from them — terminal and void tickets are always SLA-safe, plus the
 * three waiting-on-someone-else statuses.
 */
export const SLA_SAFE_STATUSES = new Set([
  ...TERMINAL_STATUSES,
  ...VOID_STATUSES,
  "nudge client",
  "ongoing delivery",
  "invoice due",
]);

/**
 * Webhook upsert policy: active statuses that clear `resolved_at`. Listed
 * explicitly (not composed) because this is Freshdesk workflow policy, not
 * scoring policy. The red list inside it (open / pending / nudge vendor) must
 * NOT send `is_escalated` on upsert — preserves the DB value after SLA breach.
 */
export const ACTIVE_CLEAR_RESOLVED_AT = new Set([
  "open",
  "pending",
  "nudge client",
  "nudge vendor",
  "ongoing delivery",
  "invoice due",
]);

export const isVoid = (s: string | null): boolean => VOID_STATUSES.has(norm(s));

export const isTerminal = (s: string | null): boolean =>
  TERMINAL_STATUSES.has(norm(s));

export function isIncompleteScoreStatus(s: string | null): boolean {
  return INCOMPLETE_SCORE_STATUSES.has(norm(s));
}
