/**
 * components/finance/utils.ts
 *
 * Pure helpers and display constants for the Finance / ActiveOutlays section.
 * No React imports — safe to import from Server Components or other non-client files.
 *
 * Sections:
 *   1. Timing constants
 *   2. Display class constants
 *   3. Amount parser
 *   4. Row mapper (Supabase raw row → DisplayOutlay)
 */

import type { DisplayOutlay } from "@/types";

// ── 1. Timing constants ───────────────────────────────────────────────────────

/**
 * How long a "paid" row stays visible (with emerald success colour) before
 * being removed from the list. Matches the exit animation duration.
 */
export const PAID_EXIT_MS = 2500;

/**
 * Hard cap on in-memory outlay rows so a long-running TV session never grows
 * the list unbounded.
 */
export const MAX_OUTLAYS = 10;

// ── 2. Display class constants ────────────────────────────────────────────────

/**
 * Column-header label style — matches the JokerMetricsStrip JokerMetricBox
 * label size so the two widgets share the same visual rhythm.
 */
export const FINANCES_LEDGER_HEADER_LABEL_CLASS =
  "font-inter font-semibold text-[clamp(27px,3vw,39px)] tracking-[0.25em] uppercase text-champagne leading-none";

/**
 * Cell font-size for every data row in the outlay ledger.
 * ≈1.5× larger than the previous baseline to fill the TV viewport comfortably.
 */
export const FINANCES_LEDGER_CELL_FONT =
  "clamp(1.725rem, min(3.975vmin, 4.875vh), 5.25rem)";

// ── 3. Amount parser ──────────────────────────────────────────────────────────

/**
 * Safely coerces any raw Supabase field to a finite number.
 * Returns 0 for nulls, NaN, and non-parseable strings.
 */
export function parseAmount(raw: unknown): number {
  if (typeof raw === "number" && !Number.isNaN(raw)) return raw;
  if (typeof raw === "string") {
    const n = Number.parseFloat(raw);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

// ── 4. Row mapper ─────────────────────────────────────────────────────────────

/**
 * Maps a raw Supabase row (INSERT / UPDATE payload or initial-fetch record)
 * to a DisplayOutlay.
 *
 * Returns null when the row has no usable `id` field so the caller can
 * safely skip it.
 *
 * @param raw     - snake_case record from Supabase
 * @param pending - true = currently pending; false = just paid (exit state)
 */
export function rowToDisplay(
  raw: Record<string, unknown>,
  pending: boolean,
): DisplayOutlay | null {
  const id = raw.id != null ? String(raw.id) : "";
  if (!id) return null;
  return {
    id,
    client_name: String(raw.client_name ?? "").trim() || "—",
    task:        String(raw.task        ?? "").trim() || "—",
    amount:      parseAmount(raw.amount),
    pending,
  };
}
