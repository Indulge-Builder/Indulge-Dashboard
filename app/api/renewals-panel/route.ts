/**
 * GET /api/renewals-panel
 *
 * RenewalsPanel data for EVERY queendom in one response
 * (`Record<QueendomId, RenewalsPanelData>`): renewals count + latest names,
 * and the latest new-member assignments. One round-trip regardless of how
 * many queendoms exist (was one request per queendom before 2026-09-04).
 *
 * Count + "latest" lists use the **current IST calendar month** on
 * `created_at` (same timezone rule as tickets / jokers).
 *
 * Expected Supabase schema:
 * - renewals: { client_name, group (or queendom), created_at }
 * - members: { client_name, group (or queendom), created_at } — for new assignments
 *
 * Run: ALTER PUBLICATION supabase_realtime ADD TABLE public.renewals;
 *      ALTER PUBLICATION supabase_realtime ADD TABLE public.members;
 */

import { withApiGuard, noStoreJson } from "@/lib/apiGuard";
import { getCurrentIstMonthUtcBounds } from "@/lib/istDate";
import { normalizeQueendom, queendomRecord } from "@/lib/queendom";
import type { RenewalsPanelResponse } from "@/types";
import type { SupabaseClient } from "@supabase/supabase-js";

const MONTH_ROW_CAP = 2000;
const LATEST_NAMES = 2;

interface ClientRow {
  group?: string | null;
  queendom?: string | null;
  client_name?: string | null;
  name?: string | null;
}

/** This month's rows of `table`, newest first, bucketed by queendom. */
async function monthRowsByQueendom(
  db: SupabaseClient,
  table: "renewals" | "members",
): Promise<Record<string, ClientRow[]>> {
  const { startUtcIso, endExclusiveUtcIso } = getCurrentIstMonthUtcBounds();
  const { data, error } = await db
    .from(table)
    .select("group, client_name, created_at")
    .gte("created_at", startUtcIso)
    .lt("created_at", endExclusiveUtcIso)
    .order("created_at", { ascending: false })
    .limit(MONTH_ROW_CAP);

  const buckets: Record<string, ClientRow[]> = queendomRecord(() => []);
  if (error) {
    console.error(`[/api/renewals-panel] ${table} error:`, error.message);
    return buckets;
  }
  for (const row of (data ?? []) as ClientRow[]) {
    const id = normalizeQueendom(row.group ?? row.queendom ?? "");
    if (id) buckets[id].push(row);
  }
  return buckets;
}

const latestNames = (rows: ClientRow[]): string[] =>
  rows
    .slice(0, LATEST_NAMES)
    .map((r) => (r.client_name ?? r.name ?? "Unknown") as string)
    .filter(Boolean);

export const GET = withApiGuard(async (_req, db) => {
  try {
    const [renewals, members] = await Promise.all([
      monthRowsByQueendom(db, "renewals"),
      monthRowsByQueendom(db, "members"),
    ]);

    const payload: RenewalsPanelResponse = queendomRecord((id) => ({
      totalRenewalsThisMonth: renewals[id].length,
      renewals: latestNames(renewals[id]),
      assignments: latestNames(members[id]),
    }));
    return noStoreJson(payload);
  } catch (err) {
    console.error("[/api/renewals-panel] error:", err);
    return noStoreJson(
      queendomRecord(() => ({ totalRenewalsThisMonth: 0, renewals: [], assignments: [] })),
    );
  }
});
