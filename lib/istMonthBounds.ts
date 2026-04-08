import {
  utcMillisFromDbTimestamp,
  getCurrentIstMonthUtcBounds,
  getCurrentIstDayUtcBounds,
} from "./istDate";

export { getCurrentIstMonthUtcBounds, getCurrentIstDayUtcBounds };

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Rolling window: now minus 30×24h through now (inclusive), as UTC ISO strings
 * for filtering `recorded_at` on conversion ledger (closures scorecard).
 */
export function getLast30DaysUtcBounds(): {
  startUtcIso: string;
  endUtcIso: string;
} {
  const end = new Date();
  const start = new Date(end.getTime() - 30 * MS_PER_DAY);
  return {
    startUtcIso: start.toISOString(),
    endUtcIso: end.toISOString(),
  };
}

/**
 * Parse `recorded_at` from Postgres (timestamptz, or date / `YYYY-MM-DD`).
 * Date-only values use IST midnight (closure “calendar day” in India), matching
 * how other dashboard metrics use {@link utcMillisFromDbTimestamp} for real timestamps.
 */
export function recordedAtToMillis(
  raw: string | null | undefined,
): number | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const t = new Date(`${s}T00:00:00+05:30`).getTime();
    return Number.isNaN(t) ? null : t;
  }
  return utcMillisFromDbTimestamp(s);
}

/** Inclusive [startIso, endIso] compare using parsed millis (handles date-only columns). */
export function isRecordedAtInInclusiveRange(
  raw: string | null | undefined,
  startIso: string,
  endIso: string,
): boolean {
  const t = recordedAtToMillis(raw);
  if (t == null) return false;
  const a = new Date(startIso).getTime();
  const b = new Date(endIso).getTime();
  return t >= a && t <= b;
}
