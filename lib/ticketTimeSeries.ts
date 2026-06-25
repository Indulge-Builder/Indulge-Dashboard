/**
 * lib/ticketTimeSeries.ts
 *
 * Pure time-series derivations from the same minimal ticket rows that feed
 * lib/ticketAggregation.ts. Powers the two thin Queendom graphs:
 *   - Pulse:     daily Received vs Resolved across the current IST month.
 *   - Heartbeat: tickets CREATED (arrived) per IST hour-of-day — shows what time
 *                of day the most tickets come in (load / staffing signal).
 *
 * Same invariants as aggregateTicketStats — dedup by id, strip VOID rows, match
 * queendom with normalizeQueendom, terminal = {resolved, closed}. Cohort math
 * here is intentionally event-time (when received / when resolved), NOT the
 * created_at-anchored cohort the scorecards use — the graph is a timeline, so a
 * ticket counts on the day it was received and again on the day it was resolved.
 */

import { istToday, toISTDay, toISTHour, toISTMonth } from "./istDate";
import { isVoid, isTerminal } from "./ticketStatus";
import { normalizeQueendom } from "./queendom";
import type { TicketRowMinimal } from "./ticketAggregation";

export type Queendom = "ananyshree" | "anishqa";

export interface DailyPoint {
  /** 1-based IST day-of-month. */
  day: number;
  received: number;
  resolved: number;
}

export interface TicketTimeSeries {
  /** One entry per IST day from 1 → today (inclusive). */
  daily: DailyPoint[];
  /** 24-length array indexed by IST hour-of-day: tickets CREATED (arrived) that hour. */
  hourlyArrivals: number[];
  /** Convenience peaks for axis scaling / labels (0 when empty). */
  peakDaily: number;
  peakHour: number;
}

const EMPTY_BOTH: Record<Queendom, TicketTimeSeries> = {
  ananyshree: emptySeries(),
  anishqa: emptySeries(),
};

function emptySeries(): TicketTimeSeries {
  return { daily: [], hourlyArrivals: new Array(24).fill(0), peakDaily: 0, peakHour: 0 };
}

/** Resolution timestamp for a terminal ticket — resolved_at, else created_at. */
function resolutionTs(row: TicketRowMinimal): string | null {
  return row.resolved_at ?? row.created_at ?? null;
}

/**
 * Build both Queendoms' time series in one pass. Returns fresh empty series
 * (never the shared EMPTY_BOTH) so callers can mutate safely if they wish.
 */
export function buildTicketTimeSeries(rows: TicketRowMinimal[]): Record<Queendom, TicketTimeSeries> {
  if (!rows.length) {
    return { ananyshree: emptySeries(), anishqa: emptySeries() };
  }

  const { day: todayIST, month: thisMonthIST } = istToday();
  const todayDom = Number(todayIST.slice(8, 10)); // 1..31

  // received[q][dom] and resolved[q][dom]; hourly[q][hour]
  const acc: Record<Queendom, { received: number[]; resolved: number[]; hourly: number[] }> = {
    ananyshree: { received: new Array(32).fill(0), resolved: new Array(32).fill(0), hourly: new Array(24).fill(0) },
    anishqa: { received: new Array(32).fill(0), resolved: new Array(32).fill(0), hourly: new Array(24).fill(0) },
  };

  const seen = new Set<string>();
  for (const row of rows) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    if (isVoid(row.status)) continue;

    const queendom = normalizeQueendom(row.queendom_name);
    if (!queendom) continue;
    const bucket = acc[queendom as Queendom];

    // Received — by created_at day, current IST month only. The Heartbeat's
    // hourly buckets are ARRIVAL-based (created_at hour) so the chart answers
    // "what time of day do the most tickets come in" — a load/staffing signal.
    if (toISTMonth(row.created_at) === thisMonthIST) {
      const dom = Number(toISTDay(row.created_at).slice(8, 10));
      if (dom >= 1 && dom <= 31) bucket.received[dom]++;
      const h = toISTHour(row.created_at);
      if (h >= 0 && h <= 23) bucket.hourly[h]++;
    }

    // Resolved — terminal tickets, bucketed by resolution day (Daily Flow line).
    if (isTerminal(row.status)) {
      const ts = resolutionTs(row);
      if (toISTMonth(ts) === thisMonthIST) {
        const dom = Number(toISTDay(ts).slice(8, 10));
        if (dom >= 1 && dom <= 31) bucket.resolved[dom]++;
      }
    }
  }

  const finalize = (q: Queendom): TicketTimeSeries => {
    const b = acc[q];
    const daily: DailyPoint[] = [];
    let peakDaily = 0;
    for (let dom = 1; dom <= todayDom; dom++) {
      const received = b.received[dom];
      const resolved = b.resolved[dom];
      daily.push({ day: dom, received, resolved });
      if (received > peakDaily) peakDaily = received;
      if (resolved > peakDaily) peakDaily = resolved;
    }
    const peakHour = b.hourly.reduce((m, v) => (v > m ? v : m), 0);
    return { daily, hourlyArrivals: b.hourly, peakDaily, peakHour };
  };

  return { ananyshree: finalize("ananyshree"), anishqa: finalize("anishqa") };
}

export { EMPTY_BOTH as EMPTY_TICKET_TIME_SERIES };
