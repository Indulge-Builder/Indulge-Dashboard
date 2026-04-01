import { utcMillisFromDbTimestamp } from "./istDate";

/**
 * Current calendar month bounds in Asia/Kolkata (IST), expressed as UTC instants
 * for comparing timestamptz columns in Postgres.
 */
export function getCurrentIstMonthUtcBounds(): {
  startUtcIso: string;
  endExclusiveUtcIso: string;
} {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const y = Number(parts.find((p) => p.type === "year")?.value);
  const m = Number(parts.find((p) => p.type === "month")?.value);
  if (!Number.isFinite(y) || !Number.isFinite(m)) {
    const d = new Date(now);
    return {
      startUtcIso: new Date(
        Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 0, 0, 0, 0),
      ).toISOString(),
      endExclusiveUtcIso: new Date(
        Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1, 0, 0, 0, 0),
      ).toISOString(),
    };
  }
  const nextM = m === 12 ? 1 : m + 1;
  const nextY = m === 12 ? y + 1 : y;
  const pad = (n: number) => String(n).padStart(2, "0");
  const startUtcIso = new Date(
    `${y}-${pad(m)}-01T00:00:00+05:30`,
  ).toISOString();
  const endExclusiveUtcIso = new Date(
    `${nextY}-${pad(nextM)}-01T00:00:00+05:30`,
  ).toISOString();
  return { startUtcIso, endExclusiveUtcIso };
}

/**
 * Current calendar day in Asia/Kolkata (IST), as UTC instants [start, endExclusive)
 * for comparing timestamptz columns (e.g. “leads created today”).
 */
export function getCurrentIstDayUtcBounds(): {
  startUtcIso: string;
  endExclusiveUtcIso: string;
} {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const y = Number(parts.find((p) => p.type === "year")?.value);
  const m = Number(parts.find((p) => p.type === "month")?.value);
  const d = Number(parts.find((p) => p.type === "day")?.value);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) {
    const dt = new Date(now);
    const start = new Date(
      Date.UTC(
        dt.getUTCFullYear(),
        dt.getUTCMonth(),
        dt.getUTCDate(),
        0,
        0,
        0,
        0,
      ),
    );
    const end = new Date(
      Date.UTC(
        dt.getUTCFullYear(),
        dt.getUTCMonth(),
        dt.getUTCDate() + 1,
        0,
        0,
        0,
        0,
      ),
    );
    return {
      startUtcIso: start.toISOString(),
      endExclusiveUtcIso: end.toISOString(),
    };
  }
  const pad = (n: number) => String(n).padStart(2, "0");
  const startUtc = new Date(`${y}-${pad(m)}-${pad(d)}T00:00:00+05:30`);
  const endExclusiveUtc = new Date(startUtc.getTime() + 24 * 60 * 60 * 1000);
  return {
    startUtcIso: startUtc.toISOString(),
    endExclusiveUtcIso: endExclusiveUtc.toISOString(),
  };
}

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
