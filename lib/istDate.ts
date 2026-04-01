/**
 * lib/istDate.ts
 *
 * IST (Asia/Kolkata, UTC+5:30) date helpers for ticket metrics.
 * Supabase stores TIMESTAMPTZ in UTC; we convert instants to IST for “today” / “this month”.
 *
 * Timestamp parsing (must match ingestion in import + Freshdesk webhook):
 * - Explicit `Z` or `±offset` → use that instant (true UTC from PostgREST / TIMESTAMPTZ).
 * - Naive datetime (no zone) → **Asia/Kolkata wall time** (Freshdesk/CSV exports are India-local).
 * - Date-only `YYYY-MM-DD` → start of that calendar day in Asia/Kolkata.
 *
 * Naive-as-UTC (`…Z`) was wrong for CSV like `2026-03-31 22:00:00` that means IST, not UTC.
 */

const IST_OFFSET = "+05:30";

const IST_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Kolkata",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/**
 * Returns the current IST calendar date as { day: "YYYY-MM-DD", month: "YYYY-MM" }.
 */
export function istToday(): { day: string; month: string } {
  const day = IST_FORMATTER.format(new Date());
  return { day, month: day.slice(0, 7) };
}

/** Time part after `T` has an explicit zone (Z or ±…). */
function timePartHasExplicitZone(rest: string): boolean {
  return /[zZ]|[+-]\d/.test(rest);
}

/**
 * Parse CSV / DB / webhook timestamp strings to UTC epoch milliseconds.
 * Use for range filters and sorting — same rules as {@link toISTDay}.
 */
export function utcMillisFromDbTimestamp(
  ts: string | null | undefined,
): number | null {
  if (ts == null) return null;
  let s = String(ts).trim();
  if (!s) return null;

  // "YYYY-MM-DD HH:..." → "YYYY-MM-DDTHH:..."
  if (/^\d{4}-\d{2}-\d{2} \d{2}:/.test(s)) {
    s = s.replace(" ", "T");
  }

  // Calendar date only → IST midnight (matches onboarding ledger date-only handling).
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    s = `${s}T00:00:00${IST_OFFSET}`;
  } else if (s.includes("T")) {
    const tIdx = s.indexOf("T");
    const rest = s.slice(tIdx + 1);
    if (rest && !timePartHasExplicitZone(rest)) {
      s = `${s}${IST_OFFSET}`;
    }
  } else {
    return null;
  }

  // "+HH" short offset at end → "+HH:00" (e.g. Freshdesk "+00")
  if (s.includes("T")) {
    s = s.replace(/([+-]\d{2})$/, "$1:00");
  }

  const ms = new Date(s).getTime();
  return Number.isNaN(ms) ? null : ms;
}

/**
 * Normalize a timestamp string to ISO 8601 UTC for Supabase `timestamptz` columns.
 * Use in CSV import and Freshdesk webhook so stored instants match dashboard parsing.
 */
export function timestampStringToIsoUtcForDb(
  input: string | null | undefined,
): string | null {
  const ms = utcMillisFromDbTimestamp(input);
  if (ms == null) return null;
  return new Date(ms).toISOString();
}

/**
 * Convert a timestamp string to the IST calendar date "YYYY-MM-DD".
 */
export function toISTDay(ts: string | null | undefined): string {
  const ms = utcMillisFromDbTimestamp(ts);
  if (ms == null) return "";
  return IST_FORMATTER.format(new Date(ms));
}

/** IST calendar month "YYYY-MM" for a timestamp. */
export function toISTMonth(ts: string | null | undefined): string {
  return toISTDay(ts).slice(0, 7);
}
