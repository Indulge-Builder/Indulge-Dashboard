/**
 * GET /api/onboarding
 *
 * Returns stats for every Onboarding roster seat (lib/onboardingAgents.ts)
 * using strict This Month Cohort Math (IST calendar month).
 *
 * ── Cohort Math Rule ────────────────────────────────────────────────────────
 * ALL date-bound metrics use getCurrentIstMonthUtcBounds() exclusively.
 *
 * ── Data sources ─────────────────────────────────────────────────────────────
 *   Leads this month / today:  leads.created_at — webhook stores canonical UTC;
 *                              classify with utcMillisFromDbTimestamp.
 *   Pipeline per agent:        leads.latest_status → normalizeLeadStatus()
 *                              (lib/leadStatus.ts — current Zoho picklist plus
 *                              the legacy-label map for pre-rename rows).
 *   Closures:                  deals.{deal_name, agent_name, closing_date, created_at}
 *                              — one row per Zoho deal; a closure COUNTS on its
 *                              `closing_date` (Zoho Closing_Date, IST day) and
 *                              falls back to the `created_at` IST day when that
 *                              is NULL / not yet migrated. Deals are often
 *                              entered days after the sale (user decision
 *                              2026-09-07).
 *
 * Roster seats come from code (ONBOARDING_AGENT_CARDS). Rows whose
 * `agent_name` matches no seat (e.g. "Admin @ Indulge", the automation owner)
 * still count toward the month tiles and the trendline, never toward a card.
 *
 * ── Vertical scope ───────────────────────────────────────────────────────────
 * Cards, pipeline bars and tiles count ONLY `business_vertical =
 * METRIC_BUSINESS_VERTICAL` ("Indulge Global" — the Onboarding team's
 * vertical; user decision 2026-09-07). The trendline is a by-vertical chart and
 * keeps all four lines. `deals` has no vertical column, so closures are not
 * scoped (every 2026 deal in Zoho is Indulge Global anyway).
 */

import { withApiGuard, noStoreJson } from "@/lib/apiGuard";
import { paginateAll } from "@/lib/db";
import {
  getCurrentIstDayUtcBounds,
  getCurrentIstMonthUtcBounds,
  istToday,
  toISTDay,
  utcMillisFromDbTimestamp,
} from "@/lib/istDate";
import {
  isAttendedStatus,
  isJunkStatus,
  isKnownLeadStatus,
  normalizeLeadStatus,
} from "@/lib/leadStatus";
import {
  ONBOARDING_AGENT_CARDS,
  getDisplayAgentName,
  onboardingAgentNameMatches,
  type OnboardingAgentCard,
} from "@/lib/onboardingAgents";
import {
  BUSINESS_VERTICALS,
  METRIC_BUSINESS_VERTICAL,
  emptyBreakdown,
  type LeadMonthStats,
  type LeadStatusByAgent,
  type OnboardingAgentRow,
  type OnboardingApiPayload,
  type OnboardingLedgerRow,
  type VerticalTrendPoint,
} from "@/lib/onboardingTypes";

// ── Empty payload ─────────────────────────────────────────────────────────────

const EMPTY: OnboardingApiPayload = { agents: [], ledger: [] };

// ── Roster matching ───────────────────────────────────────────────────────────

/** Resolve a stored `agent_name` (Zoho owner full name) to its roster seat. */
function cardForAgentName(stored: string | null | undefined): OnboardingAgentCard | null {
  const s = String(stored ?? "").trim();
  if (!s) return null;
  const lower = s.toLowerCase();
  return (
    ONBOARDING_AGENT_CARDS.find((c) => c.zohoName.toLowerCase() === lower) ??
    ONBOARDING_AGENT_CARDS.find((c) => onboardingAgentNameMatches(c.name, s)) ??
    null
  );
}

// ── Deals ─────────────────────────────────────────────────────────────────────

type DealRow = {
  deal_id: string;
  deal_name: string;
  agent_name: string;
  created_at: string;
  closing_date?: string | null;
};

/** The IST calendar day a deal counts on. */
function dealClosedOn(d: DealRow): string {
  return d.closing_date && /^\d{4}-\d{2}-\d{2}$/.test(d.closing_date)
    ? d.closing_date
    : toISTDay(d.created_at);
}

/**
 * Every deal, newest entry first. Tries the `closing_date` column and, until
 * migration 20260907120000 is applied (42703 / PGRST204), falls back to the
 * pre-2026-09 shape so the TV never loses its closures.
 */
async function fetchDeals(
  db: Parameters<Parameters<typeof withApiGuard>[0]>[1],
): Promise<DealRow[]> {
  const select = (cols: string) =>
    paginateAll<Record<string, unknown>>((from, to) =>
      db.from("deals").select(cols).order("created_at", { ascending: false }).range(from, to),
    );
  let { rows, error } = await select("deal_id, deal_name, agent_name, created_at, closing_date");
  if (error && ((error as { code?: string }).code === "42703" || (error as { code?: string }).code === "PGRST204")) {
    console.warn("[/api/onboarding] deals.closing_date missing — counting closures by created_at; apply migration 20260907120000");
    ({ rows, error } = await select("deal_id, deal_name, agent_name, created_at"));
  }
  if (error) throw error;
  return rows as DealRow[];
}

function toLedgerRow(d: DealRow): OnboardingLedgerRow {
  return {
    id: String(d.deal_id),
    clientName: d.deal_name,
    recordedAt: d.closing_date && /^\d{4}-\d{2}-\d{2}$/.test(d.closing_date) ? d.closing_date : d.created_at,
    // Store full name in DB, render compact first-name label in UI.
    agentName: getDisplayAgentName(d.agent_name),
  };
}

// ── GET handler ───────────────────────────────────────────────────────────────
// TV resilience: missing DB or any unexpected failure degrades to the EMPTY
// payload (200) — this screen must render zeros, never an error.

export const GET = withApiGuard(
  async (_req, db) => {
    try {
      // ── IST month / day bounds ───────────────────────────────────────────
      const { month: thisMonthIST } = istToday();
      const { startUtcIso: monthStart, endExclusiveUtcIso: monthEndEx } =
        getCurrentIstMonthUtcBounds();
      const { startUtcIso: todayStartUtc, endExclusiveUtcIso: todayEndExclusiveUtc } =
        getCurrentIstDayUtcBounds();

      const monthStartMs = new Date(monthStart).getTime();
      const monthEndExMs = new Date(monthEndEx).getTime();
      const todayStartMs = new Date(todayStartUtc).getTime();
      const todayEndExMs = new Date(todayEndExclusiveUtc).getTime();

      const inThisMonth = (createdAt: string | null | undefined): boolean => {
        const ms = utcMillisFromDbTimestamp(createdAt);
        return ms != null && ms >= monthStartMs && ms < monthEndExMs;
      };
      const inToday = (createdAt: string | null | undefined): boolean => {
        const ms = utcMillisFromDbTimestamp(createdAt);
        return ms != null && ms >= todayStartMs && ms < todayEndExMs;
      };

      // ── 1. Deals: ledger (top 25 by closing day, then entry time) ─────────
      let deals: DealRow[] = [];
      try {
        deals = await fetchDeals(db);
      } catch (e) {
        console.warn("[/api/onboarding] deals fetch failed — ledger and closures zeroed", e);
      }
      const ledger: OnboardingLedgerRow[] = [...deals]
        .sort((a, b) => {
          const byDay = dealClosedOn(b).localeCompare(dealClosedOn(a));
          return byDay !== 0 ? byDay : b.created_at.localeCompare(a.created_at);
        })
        .slice(0, 25)
        .map(toLedgerRow);

      // ── 2. Single paginated leads fetch for the IST month ────────────────
      type LeadRow = {
        agent_name: string;
        created_at: string;
        latest_status: string | null;
        business_vertical: string | null;
      };
      let leadRows: LeadRow[] = [];
      let leadsFetchError: Error | null = null;

      try {
        const { rows, error } = await paginateAll<Record<string, unknown>>((from, to) =>
          db
            .from("leads")
            .select("agent_name, created_at, latest_status, business_vertical")
            .gte("created_at", monthStart)
            .lt("created_at", monthEndEx)
            .order("created_at", { ascending: true })
            .range(from, to),
        );
        if (error) throw error;
        leadRows = rows as LeadRow[];
      } catch (e) {
        leadsFetchError = e instanceof Error ? e : new Error(String(e));
        console.warn("[/api/onboarding] leads fetch unreadable — lead counts zeroed", e);
      }

      /** Rows that feed cards / pipeline / tiles — the Onboarding vertical only. */
      const metricRows = leadRows.filter(
        (r) => (r.business_vertical ?? "Indulge Global") === METRIC_BUSINESS_VERTICAL,
      );

      // ── 3. Per-seat lead counts + pipeline breakdown ─────────────────────
      const leadsMonthById = new Map<string, number>();
      const leadsTodayById = new Map<string, number>();
      const leadStatusByAgent: LeadStatusByAgent = {};
      for (const card of ONBOARDING_AGENT_CARDS) {
        leadsMonthById.set(card.id, 0);
        leadsTodayById.set(card.id, 0);
        leadStatusByAgent[card.name] = emptyBreakdown();
      }

      const unmappedStatusCounts = new Map<string, number>();

      for (const row of metricRows) {
        if (!isKnownLeadStatus(row.latest_status)) {
          const key = String(row.latest_status ?? "").trim().toLowerCase();
          unmappedStatusCounts.set(key, (unmappedStatusCounts.get(key) ?? 0) + 1);
        }

        const card = cardForAgentName(row.agent_name);
        if (!card) continue;

        if (inThisMonth(row.created_at)) {
          leadsMonthById.set(card.id, (leadsMonthById.get(card.id) ?? 0) + 1);
          const bd = leadStatusByAgent[card.name]!;
          bd[normalizeLeadStatus(row.latest_status)]++;
          bd.total++;
        }
        if (inToday(row.created_at)) {
          leadsTodayById.set(card.id, (leadsTodayById.get(card.id) ?? 0) + 1);
        }
      }

      if (unmappedStatusCounts.size > 0) {
        console.warn(
          "[/api/onboarding] Unmapped latest_status values (bucketed as Junk) — extend lib/leadStatus.ts",
          Object.fromEntries(unmappedStatusCounts),
        );
      }

      // ── 4. leadMonthStats (metric tiles — every scoped row, roster or not) ─
      let attended = 0;
      let junk = 0;
      for (const row of metricRows) {
        const s = normalizeLeadStatus(row.latest_status);
        if (isAttendedStatus(s)) attended++;
        if (isJunkStatus(s)) junk++;
      }

      // ── 5. Closures this month — by closing day (IST), not entry time ─────
      const closuresById = new Map<string, number>();
      for (const card of ONBOARDING_AGENT_CARDS) closuresById.set(card.id, 0);
      const dealsThisMonthRows = deals.filter((d) => dealClosedOn(d).slice(0, 7) === thisMonthIST);
      const dealsThisMonth = dealsThisMonthRows.length;

      let matchedAny = false;
      for (const d of dealsThisMonthRows) {
        const card = cardForAgentName(d.agent_name);
        if (!card) continue;
        matchedAny = true;
        closuresById.set(card.id, (closuresById.get(card.id) ?? 0) + 1);
      }
      if (dealsThisMonth > 0 && !matchedAny) {
        console.warn(
          "[/api/onboarding] This-month closures: rows found but 0 agent names matched the roster — check lib/onboardingAgents.ts",
          {
            roster: ONBOARDING_AGENT_CARDS.map((c) => c.zohoName),
            distinctAgentNamesInDeals: Array.from(
              new Set(dealsThisMonthRows.map((r) => String(r.agent_name ?? "").trim() || "(empty)")),
            ),
          },
        );
      }

      const leadMonthStats: LeadMonthStats = {
        leads: metricRows.length,
        attended,
        dealsClosedThisMonth: dealsThisMonth,
        junk,
      };

      // ── 6. Build OnboardingAgentRow[] in roster order ────────────────────
      const agents: OnboardingAgentRow[] = ONBOARDING_AGENT_CARDS.map((card) => {
        const leadsMonth = leadsMonthById.get(card.id) ?? 0;
        return {
          id: card.id,
          name: card.name,
          photoUrl: null,
          leadsCreatedThisMonth: leadsMonth,
          totalConverted: closuresById.get(card.id) ?? 0,
          leadsCreatedTodayIst: leadsTodayById.get(card.id) ?? 0,
          leadsThisMonth: leadsMonth,
        };
      });

      // ── 7. Trendline — reuse the month rows (no extra DB round-trips) ────
      let verticalTrendline: VerticalTrendPoint[] = [];

      if (!leadsFetchError) {
        try {
          const istFmt = new Intl.DateTimeFormat("en-CA", {
            timeZone: "Asia/Kolkata",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
          });

          const [istY, istM] = thisMonthIST.split("-") as [string, string];
          const firstDayMs = new Date(`${istY}-${istM}-01T00:00:00+05:30`).getTime();
          const nextMonthMs = new Date(
            Number(istM) === 12
              ? `${Number(istY) + 1}-01-01T00:00:00+05:30`
              : `${istY}-${String(Number(istM) + 1).padStart(2, "0")}-01T00:00:00+05:30`,
          ).getTime();
          const daysInMonth = Math.round((nextMonthMs - firstDayMs) / 86_400_000);

          const dateKeys: string[] = [];
          for (let d = 0; d < daysInMonth; d++) {
            dateKeys.push(istFmt.format(new Date(firstDayMs + d * 86_400_000)));
          }

          const vertCounts: Record<string, Record<string, number>> = {};
          for (const key of dateKeys) {
            vertCounts[key] = Object.fromEntries(BUSINESS_VERTICALS.map((v) => [v, 0]));
          }
          for (const row of leadRows) {
            const key = toISTDay(String(row.created_at ?? ""));
            if (!key || !(key in vertCounts)) continue;
            const vertical = row.business_vertical ?? "Indulge Global";
            const bucket = vertCounts[key];
            if (bucket && vertical in bucket) (bucket[vertical] as number)++;
          }
          verticalTrendline = dateKeys.map((date) => ({
            date,
            "Indulge Global": vertCounts[date]?.["Indulge Global"] ?? 0,
            "Indulge Shop":   vertCounts[date]?.["Indulge Shop"]   ?? 0,
            "Indulge House":  vertCounts[date]?.["Indulge House"]  ?? 0,
            "Indulge Legacy": vertCounts[date]?.["Indulge Legacy"] ?? 0,
          }));
        } catch (e) {
          console.warn("[/api/onboarding] trendline computation failed — charts will be empty", e);
        }
      }

      // ── 8. Return payload ────────────────────────────────────────────────
      const payload: OnboardingApiPayload = {
        agents,
        ledger,
        leadStatusByAgent,
        verticalTrendline,
        leadMonthStats,
      };
      return noStoreJson(payload);
    } catch (e) {
      console.error("[/api/onboarding]", e);
      return noStoreJson(EMPTY);
    }
  },
  { noDbResponse: () => noStoreJson(EMPTY) },
);
