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

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Next calendar month as `YYYY-MM` (IST labels; used for exclusive end bounds). */
function addOneCalendarMonth(ym: string): string {
  const parts = ym.split("-");
  if (parts.length !== 2) return ym;
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  if (!Number.isFinite(y) || !Number.isFinite(m)) return ym;
  if (m === 12) return `${y + 1}-01`;
  return `${y}-${String(m + 1).padStart(2, "0")}`;
}

/**
 * First instant of the current IST calendar month and first instant of the next
 * month (UTC ISO), for PostgREST `created_at.gte` filters. Uses the same
 * `istToday` / `utcMillisFromDbTimestamp` rules as scorecard aggregation — not
 * a separate locale path.
 */
export function getCurrentIstMonthUtcBounds(): {
  startUtcIso: string;
  endExclusiveUtcIso: string;
} {
  const { month } = istToday();
  const startMs = utcMillisFromDbTimestamp(`${month}-01`);
  const endMs = utcMillisFromDbTimestamp(`${addOneCalendarMonth(month)}-01`);
  if (startMs != null && endMs != null) {
    return {
      startUtcIso: new Date(startMs).toISOString(),
      endExclusiveUtcIso: new Date(endMs).toISOString(),
    };
  }
  const day = IST_FORMATTER.format(new Date());
  const ym = day.slice(0, 7);
  const s = utcMillisFromDbTimestamp(`${ym}-01`);
  const e = utcMillisFromDbTimestamp(`${addOneCalendarMonth(ym)}-01`);
  if (s != null && e != null) {
    return {
      startUtcIso: new Date(s).toISOString(),
      endExclusiveUtcIso: new Date(e).toISOString(),
    };
  }
  const now = new Date();
  return {
    startUtcIso: new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0),
    ).toISOString(),
    endExclusiveUtcIso: new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0),
    ).toISOString(),
  };
}

/**
 * Current IST calendar day [start, endExclusive) as UTC ISO strings.
 * Aligns with `toISTDay` / `istToday().day`.
 */
export function getCurrentIstDayUtcBounds(): {
  startUtcIso: string;
  endExclusiveUtcIso: string;
} {
  const { day } = istToday();
  const startMs = utcMillisFromDbTimestamp(day);
  if (startMs != null) {
    return {
      startUtcIso: new Date(startMs).toISOString(),
      endExclusiveUtcIso: new Date(startMs + MS_PER_DAY).toISOString(),
    };
  }
  const d = IST_FORMATTER.format(new Date());
  const s = utcMillisFromDbTimestamp(d);
  if (s != null) {
    return {
      startUtcIso: new Date(s).toISOString(),
      endExclusiveUtcIso: new Date(s + MS_PER_DAY).toISOString(),
    };
  }
  const now = new Date();
  const start = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      0,
      0,
      0,
      0,
    ),
  );
  return {
    startUtcIso: start.toISOString(),
    endExclusiveUtcIso: new Date(start.getTime() + MS_PER_DAY).toISOString(),
  };
}
