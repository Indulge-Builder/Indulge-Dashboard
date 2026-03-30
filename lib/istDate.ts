/**
 * lib/istDate.ts
 *
 * IST (Asia/Kolkata, UTC+5:30) date helpers for ticket metrics.
 * Supabase stores TIMESTAMPTZ in UTC — we must convert to IST before
 * comparing "today" / "this month" boundaries.
 *
 * Ported from Live-Queendom-Dashboard for correct timezone handling.
 */

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

/**
 * Convert a Supabase UTC timestamp to the IST calendar date "YYYY-MM-DD".
 *
 * Supabase/PostgreSQL TIMESTAMPTZ can arrive in different formats. We normalize
 * to strict ISO 8601 before parsing so new Date() produces the correct UTC
 * instant, then format in IST.
 */
export function toISTDay(ts: string | null | undefined): string {
  if (!ts) return "";

  let s = ts.trim();

  // "YYYY-MM-DD HH:..." → "YYYY-MM-DDTHH:..."
  if (/^\d{4}-\d{2}-\d{2} \d{2}:/.test(s)) {
    s = s.replace(" ", "T");
  }

  // Datetime without timezone: treat as UTC (Supabase TIMESTAMPTZ + Freshdesk
  // webhooks use UTC). Parsing as local time breaks IST day on browsers/TVs
  // not set to Asia/Kolkata.
  if (s.includes("T")) {
    const rest = s.slice(s.indexOf("T") + 1);
    if (rest && !/[zZ]|[+-]\d/.test(rest)) {
      s = `${s}Z`;
    }
  }

  // "+HH" short offset → "+HH:00"
  if (s.includes("T")) {
    s = s.replace(/([+-]\d{2})$/, "$1:00");
  }

  const utc = new Date(s);
  if (isNaN(utc.getTime())) return "";
  return IST_FORMATTER.format(utc);
}

/** IST calendar month "YYYY-MM" for a timestamp. */
export function toISTMonth(ts: string | null | undefined): string {
  return toISTDay(ts).slice(0, 7);
}
