/**
 * GET /api/onboarding
 *
 * Attempted + Leads today: public.onboarding_lead_touches (IST month/day).
 * Closures (last 30 days): fetch recent conversion rows (same pattern as
 * /api/tickets — load batch, filter in JS with istDate-normalized timestamps),
 * then count per agent where recorded_at falls in the rolling last-30-day window.
 * Ledger strip: same conversion table. Agents: onboarding_sales_agents when
 * present; otherwise canonical Amit / Samson / Meghana (same as OnboardingPanel)
 * so scorecard still fills from ledger + touches.
 */

import { NextResponse } from "next/server";
import {
  getCurrentIstDayUtcBounds,
  getCurrentIstMonthUtcBounds,
  getLast30DaysUtcBounds,
  isRecordedAtInInclusiveRange,
} from "@/lib/istMonthBounds";
import {
  ONBOARDING_AGENT_CARDS,
  ONBOARDING_AGENT_DISPLAY_NAMES,
  onboardingAgentNameMatches,
} from "@/lib/onboardingAgents";
import { requireSupabaseAdminOr503 } from "@/lib/supabaseAdmin";
import type {
  OnboardingAgentRow,
  OnboardingApiPayload,
  OnboardingLedgerRow,
} from "@/lib/onboardingTypes";

const EMPTY: OnboardingApiPayload = { agents: [], ledger: [] };

function mapLedgerRows(
  ledgerQ: {
    data: unknown;
    error: { message: string } | null;
  },
): OnboardingLedgerRow[] {
  if (ledgerQ.error) return [];
  return (ledgerQ.data as
    | {
        id: string;
        client_name: string;
        amount: number | string;
        recorded_at: string;
        queendom_name?: string | null;
        agent_name: string;
      }[]
    | null)?.map((r) => ({
    id: String(r.id),
    clientName: r.client_name,
    amount: typeof r.amount === "string" ? parseFloat(r.amount) : r.amount,
    recordedAt: r.recorded_at,
    assignedTo:
      r.queendom_name != null && String(r.queendom_name).trim() !== ""
        ? String(r.queendom_name).trim()
        : "",
    agentName: r.agent_name,
  })) ?? [];
}

/** Broaden `agent_name` IN list so Zoho casing still matches (Amit / amit). */
function agentNameInListForQuery(displayNames: string[]): string[] {
  const set = new Set<string>();
  for (const n of displayNames) {
    const t = n.trim();
    if (!t) continue;
    set.add(t);
    set.add(t.toLowerCase());
    set.add(t.charAt(0).toUpperCase() + t.slice(1).toLowerCase());
  }
  for (const c of ONBOARDING_AGENT_DISPLAY_NAMES) {
    set.add(c);
    set.add(c.toLowerCase());
  }
  return Array.from(set);
}

export async function GET() {
  const { db } = requireSupabaseAdminOr503();

  if (!db) {
    return NextResponse.json(EMPTY, {
      headers: { "Cache-Control": "no-store" },
    });
  }

  try {
    const agentsQWithLeads = await db
      .from("onboarding_sales_agents")
      .select("id, display_name, photo_url, sort_order")
      .order("sort_order", { ascending: true })
      .limit(3);

    const agentsQ = agentsQWithLeads.error
      ? await db
          .from("onboarding_sales_agents")
          .select("id, display_name, photo_url, sort_order")
          .order("sort_order", { ascending: true })
          .limit(3)
      : agentsQWithLeads;

    const ledgerSelectFull =
      "id, client_name, amount, recorded_at, queendom_name, agent_name";

    const ledger = await (async (): Promise<OnboardingLedgerRow[]> => {
      const conv = await db
        .from("onboarding_conversion_ledger")
        .select(ledgerSelectFull)
        .order("recorded_at", { ascending: false })
        .limit(25);
      if (!conv.error) return mapLedgerRows(conv);

      const leg = await db
        .from("onboarding_ledger")
        .select(ledgerSelectFull)
        .order("recorded_at", { ascending: false })
        .limit(25);
      if (!leg.error) return mapLedgerRows(leg);

      const legacy = await db
        .from("onboarding_ledger")
        .select("id, client_name, amount, recorded_at, agent_name")
        .order("recorded_at", { ascending: false })
        .limit(25);
      return mapLedgerRows(legacy);
    })();

    type RawAgentRow = {
      id: string;
      display_name: string;
      photo_url: string | null;
    };

    const rawFromDb = agentsQ.error ? [] : ((agentsQ.data ?? []) as RawAgentRow[]);
    const effectiveAgents: RawAgentRow[] =
      rawFromDb.length > 0
        ? rawFromDb
        : ONBOARDING_AGENT_CARDS.map((c) => ({
            id: c.id,
            display_name: c.name,
            photo_url: null,
          }));

    const { startUtcIso: monthStart, endExclusiveUtcIso: monthEndEx } =
      getCurrentIstMonthUtcBounds();
    const { startUtcIso: dayStart, endExclusiveUtcIso: dayEndEx } =
      getCurrentIstDayUtcBounds();

    const tsInRange = (iso: string, start: string, endEx: string): boolean =>
      iso >= start && iso < endEx;

    const names = effectiveAgents.map((r) => String(r.display_name).trim());

    let attemptedFromTouches: number[] | null = null;
    let leadsTodayFromTouches: number[] | null = null;

    try {
      const { data: touchRows, error: touchErr } = await db
        .from("onboarding_lead_touches")
        .select("agent_name, first_touched_at, updated_at")
        .in("agent_name", agentNameInListForQuery(names));

      if (touchErr) throw touchErr;

      const rows = touchRows ?? [];
      const countTouches = (agentName: string) => {
        const mine = rows.filter((row) =>
          onboardingAgentNameMatches(agentName, String(row.agent_name)),
        );
        let attempted = 0;
        let leadsToday = 0;
        for (const row of mine) {
          const first = String(row.first_touched_at);
          if (tsInRange(first, monthStart, monthEndEx)) attempted += 1;
          if (tsInRange(first, dayStart, dayEndEx)) leadsToday += 1;
        }
        return { attempted, leadsToday };
      };

      attemptedFromTouches = names.map((n) => countTouches(n).attempted);
      leadsTodayFromTouches = names.map((n) => countTouches(n).leadsToday);
    } catch (e) {
      console.warn(
        "[/api/onboarding] onboarding_lead_touches unreadable; attempted/leads zeros",
        e,
      );
      attemptedFromTouches = null;
      leadsTodayFromTouches = null;
    }

    const { startUtcIso: closureWindowStart, endUtcIso: closureWindowEnd } =
      getLast30DaysUtcBounds();

    let closuresFromLedger: number[] | null = null;
    try {
      // Like /api/tickets: no PostgREST date filter (avoids timestamptz/format quirks);
      // take recent rows and apply the 30-day window in JS with recordedAtToMillis.
      const conv = await db
        .from("onboarding_conversion_ledger")
        .select("agent_name, recorded_at")
        .order("recorded_at", { ascending: false })
        .limit(5000);

      let closureRows: { agent_name: string; recorded_at: string }[] = [];
      if (!conv.error) {
        const raw =
          (conv.data as { agent_name: string; recorded_at: string }[] | null) ??
          [];
        closureRows = raw.filter((row) =>
          isRecordedAtInInclusiveRange(
            row.recorded_at,
            closureWindowStart,
            closureWindowEnd,
          ),
        );
      } else {
        const leg = await db
          .from("onboarding_ledger")
          .select("agent_name, recorded_at")
          .order("recorded_at", { ascending: false })
          .limit(5000);
        if (!leg.error) {
          const raw =
            (leg.data as { agent_name: string; recorded_at: string }[] | null) ??
            [];
          closureRows = raw.filter((row) =>
            isRecordedAtInInclusiveRange(
              row.recorded_at,
              closureWindowStart,
              closureWindowEnd,
            ),
          );
        } else {
          throw conv.error;
        }
      }

      closuresFromLedger = names.map(
        (displayName) =>
          closureRows.filter((row) =>
            onboardingAgentNameMatches(displayName, row.agent_name),
          ).length,
      );

      const closureSum = closuresFromLedger.reduce((a, b) => a + b, 0);
      if (closureRows.length > 0 && closureSum === 0) {
        const distinct = Array.from(
          new Set(
            closureRows.map(
              (r) => String(r.agent_name ?? "").trim() || "(empty)",
            ),
          ),
        );
        console.warn(
          "[/api/onboarding] closures: rows in last-30d window but no agent_name matched cards — check agent_name vs onboarding_sales_agents.display_name",
          { cardDisplayNames: names, distinctAgentNamesInLedger: distinct },
        );
      }
    } catch (e) {
      console.warn(
        "[/api/onboarding] conversion ledger closure counts skipped",
        e,
      );
      closuresFromLedger = null;
    }

    const agents: OnboardingAgentRow[] = effectiveAgents
      .map(
        (r: RawAgentRow, idx: number) => ({
          id: String(r.id),
          name: r.display_name,
          photoUrl: r.photo_url,
          totalAttempted:
            attemptedFromTouches != null
              ? (attemptedFromTouches[idx] ?? 0)
              : 0,
          totalConverted:
            closuresFromLedger != null ? (closuresFromLedger[idx] ?? 0) : 0,
          leadsAttendToday:
            leadsTodayFromTouches != null
              ? (leadsTodayFromTouches[idx] ?? 0)
              : 0,
        }),
      )
      .slice(0, 3);

    const payload: OnboardingApiPayload = { agents, ledger };
    return NextResponse.json(payload, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    console.error("[/api/onboarding]", e);
    return NextResponse.json(EMPTY, {
      headers: { "Cache-Control": "no-store" },
    });
  }
}
