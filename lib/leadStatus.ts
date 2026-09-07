/**
 * lib/leadStatus.ts — the Zoho CRM `Lead_Status` vocabulary the Onboarding
 * screen renders, plus the single normaliser every reader goes through.
 *
 * Source of truth: the Zoho Leads module picklist as read via API on
 * 2026-09-07 —
 *   -None- | New | RNR | Conversing | Payment Link | Lost | Not Qualified |
 *   Junk | Nurturing | Cold | Win
 *
 * Zoho renamed / replaced the earlier pipeline (New → Touched → In Discussion
 * → Qualified) around 2026-09-03. Picklist renames do NOT fire the
 * field-update webhook, so `leads.latest_status` still carries the old labels
 * for rows last modified before the rename (58 September rows read `Touched`
 * while Zoho now says `RNR`, verified 1:1). The LEGACY map below keeps those
 * rows in the right bucket without a DB backfill.
 *
 * Pipeline order (best → worst) drives the segment order of the health bar.
 */

export const ZOHO_LEAD_STATUSES = [
  "Win",
  "Payment Link",
  "Conversing",
  "Nurturing",
  "RNR",
  "New",
  "Cold",
  "Lost",
  "Junk",
] as const;

export type ZohoLeadStatus = (typeof ZOHO_LEAD_STATUSES)[number];

/** lower-cased current picklist value → canonical label */
const CURRENT_BY_KEY: Readonly<Record<string, ZohoLeadStatus>> = Object.fromEntries(
  ZOHO_LEAD_STATUSES.map((s) => [s.toLowerCase(), s]),
) as Record<string, ZohoLeadStatus>;

/**
 * Old-pipeline labels still present in the DB (and `Not Qualified`, which is
 * a live picklist value we fold into Junk — zero rows so far, and the TV bar
 * has no room for a tenth segment).
 */
const LEGACY_BY_KEY: Readonly<Record<string, ZohoLeadStatus>> = {
  touched: "RNR", // renamed in Zoho — verified 58/58 on 2026-09-07
  attempted: "RNR",
  "in discussion": "Conversing",
  contacted: "Conversing", // one Feb-2026 row
  "action required": "Nurturing", // one Feb-2026 row
  qualified: "Win", // the pre-conversion stage of the old pipeline
  "not qualified": "Junk",
  trash: "Junk",
};

/** Statuses that count as "the agent has actioned this lead". */
export function isAttendedStatus(s: ZohoLeadStatus): boolean {
  return s !== "New" && s !== "Junk";
}

export function isJunkStatus(s: ZohoLeadStatus): boolean {
  return s === "Junk";
}

/**
 * Normalise a raw `latest_status` (webhook payload or DB value) to one of the
 * canonical labels. Blank / `-None-` is a freshly created lead → "New".
 * Anything unrecognised buckets into "Junk" (never dropped from totals);
 * callers that want to surface new picklist values should test
 * {@link isKnownLeadStatus} first and log.
 */
export function normalizeLeadStatus(raw: string | null | undefined): ZohoLeadStatus {
  const key = (raw ?? "").trim().toLowerCase();
  if (!key || key === "-none-") return "New";
  return CURRENT_BY_KEY[key] ?? LEGACY_BY_KEY[key] ?? "Junk";
}

export function isKnownLeadStatus(raw: string | null | undefined): boolean {
  const key = (raw ?? "").trim().toLowerCase();
  if (!key || key === "-none-") return true;
  return key in CURRENT_BY_KEY || key in LEGACY_BY_KEY;
}
