/**
 * GET /api/onboarding
 *
 * Returns stats for all 6 revenue agents (3 Concierge + 3 Shop) plus
 * per-department rollups using strict This Month Cohort Math (IST calendar month).
 *
 * ── Cohort Math Rule ────────────────────────────────────────────────────────
 * ALL date-bound metrics use getCurrentIstMonthUtcBounds() exclusively.
 * Rolling 30-day windows have been removed from this endpoint.
 *
 * ── Data sources ─────────────────────────────────────────────────────────────
 *   Leads this month / today:  leads.created_at — webhook stores canonical UTC
 *                              (`freshdeskTimestampToIsoUtcForDb`); classify with
 *                              utcMillisFromDbTimestamp (same as PostgREST reads).
 *   Closures count + ₹ sum:    onboarding_conversion_ledger.{recorded_at, amount}
 *   Ledger feed (UI table):    deals.{deal_name, agent_name, created_at}
 *   Pipeline Won count:        closure rows this month per department
 *   Pipeline Attempted count:  touch rows this month per department
 *   New / In Discussion / Lost: no data source yet — returns 0 (placeholder)
 *
 * ── Agent fallback strategy ──────────────────────────────────────────────────
 *   For each canonical seat (6 total: 3 concierge + 3 shop) the route uses
 *   the DB record from onboarding_sales_agents when present, else falls back
 *   to the static card spec. This handles the common case where the DB only
 *   has the original 3 concierge agents.
 */

import { NextResponse } from "next/server";
import {
  getCurrentIstDayUtcBounds,
  getCurrentIstMonthUtcBounds,
  istToday,
  toISTDay,
  utcMillisFromDbTimestamp,
} from "@/lib/istDate";
import {
  CONCIERGE_AGENT_CARDS,
  SHOP_AGENT_CARDS,
  onboardingAgentNameMatches,
  getAgentDepartment,
  getDisplayAgentName,
} from "@/lib/onboardingAgents";
import { requireSupabaseAdminOr503 } from "@/lib/supabaseAdmin";
import {
  EMPTY_BREAKDOWN,
  EMPTY_PIPELINE,
  type AgentLeadStatusBreakdown,
  type Department,
  type DepartmentStats,
  type LeadMonthStats,
  type LeadStatusByAgent,
  type LeadTrendPoint,
  type OnboardingAgentRow,
  type OnboardingApiPayload,
  type OnboardingLedgerRow,
  type PipelineStatusCounts,
  type TeamAttendedDay,
  type VerticalTrendPoint,
  type ZohoLeadStatus,
} from "@/lib/onboardingTypes";

// ── Canonical 6-seat roster (Concierge first, then Shop) ─────────────────────

const ALL_CANONICAL_CARDS = [
  ...CONCIERGE_AGENT_CARDS.map((c) => ({
    id: c.id,
    display_name: c.name,
    photo_url: null as string | null,
  })),
  ...SHOP_AGENT_CARDS.map((c) => ({
    id: c.id,
    display_name: c.name,
    photo_url: null as string | null,
  })),
];

// ── Empty payload ─────────────────────────────────────────────────────────────

const EMPTY_DEPT_STATS = (dept: Department): DepartmentStats => ({
  department: dept,
  totalRupeesClosedThisMonth: 0,
  totalLakhsClosedThisMonth: 0,
  pipeline: { ...EMPTY_PIPELINE },
  agents: [],
});

const EMPTY: OnboardingApiPayload = { agents: [], ledger: [] };

// ── Ledger row mapper (deals query) ───────────────────────────────────────────

function mapLedgerRows(ledgerQ: {
  data: unknown;
  error: { message: string } | null;
}): OnboardingLedgerRow[] {
  if (ledgerQ.error) return [];
  return (
    (
      ledgerQ.data as
        | {
            deal_id: string;
            deal_name: string;
            agent_name: string;
            created_at: string;
          }[]
        | null
    )?.map((r) => ({
      id: String(r.deal_id),
      clientName: r.deal_name,
      recordedAt: r.created_at,
      assignedTo: "",
      // Store full name in DB, render compact first-name label in UI.
      agentName: getDisplayAgentName(r.agent_name),
      department: getAgentDepartment(r.agent_name),
    })) ?? []
  );
}

// ── GET handler ───────────────────────────────────────────────────────────────

export async function GET() {
  const { db } = requireSupabaseAdminOr503();

  if (!db) {
    return NextResponse.json(EMPTY, {
      headers: { "Cache-Control": "no-store" },
    });
  }

  try {
    // ── IST month bounds (PostgREST filter) + same calendar logic as /api/tickets ──
    const { day: todayIST, month: thisMonthIST } = istToday();
    const { startUtcIso: monthStart, endExclusiveUtcIso: monthEndEx } =
      getCurrentIstMonthUtcBounds();
    const { startUtcIso: todayStartUtc, endExclusiveUtcIso: todayEndExclusiveUtc } =
      getCurrentIstDayUtcBounds();

    const monthStartMs = new Date(monthStart).getTime();
    const monthEndExMs = new Date(monthEndEx).getTime();
    const todayStartMs = new Date(todayStartUtc).getTime();
    const todayEndExMs = new Date(todayEndExclusiveUtc).getTime();

    /** IST month membership for a `leads.created_at` value read from TIMESTAMPTZ. */
    const touchInThisMonth = (createdAt: string | null | undefined): boolean => {
      const ms = utcMillisFromDbTimestamp(createdAt);
      if (ms == null) return false;
      return ms >= monthStartMs && ms < monthEndExMs;
    };
    /** Current IST calendar day for DB-stored instants (respects `…Z` from Postgres). */
    const touchInToday = (createdAt: string | null | undefined): boolean => {
      const ms = utcMillisFromDbTimestamp(createdAt);
      if (ms == null) return false;
      return ms >= todayStartMs && ms < todayEndExMs;
    };

    const LEADS_PAGE = 1000;
    const LEADS_MAX_PAGES = 250;

    /** Paginate half-open [start, end) so we never silently drop rows past a single limit. */
    const fetchLeadsCreatedInWindow = async (
      selectCols: string,
      windowStart: string,
      windowEndExclusive: string,
    ): Promise<{ rows: Record<string, unknown>[]; error: Error | null }> => {
      const rows: Record<string, unknown>[] = [];
      for (let p = 0; p < LEADS_MAX_PAGES; p++) {
        const from = p * LEADS_PAGE;
        const { data, error } = await db
          .from("leads")
          .select(selectCols)
          .gte("created_at", windowStart)
          .lt("created_at", windowEndExclusive)
          .order("created_at", { ascending: true })
          .range(from, from + LEADS_PAGE - 1);
        if (error) return { rows: [], error: new Error(error.message) };
        const batch = (data ?? []) as unknown as Record<string, unknown>[];
        rows.push(...batch);
        if (batch.length < LEADS_PAGE) break;
      }
      return { rows, error: null };
    };

  // ── 1. Agent rows from DB (limit 7; fall back per canonical seat) ──────
    const agentsDbQ = await db
      .from("onboarding_sales_agents")
      .select("id, display_name, photo_url, sort_order")
      .order("sort_order", { ascending: true })
      .limit(7);

    const rawFromDb = agentsDbQ.error
      ? []
      : ((agentsDbQ.data ?? []) as {
          id: string;
          display_name: string;
          photo_url: string | null;
        }[]);

    /**
     * For each canonical seat, use the DB record when one matches by id or
     * display_name, otherwise fall back to the static spec. This preserves
     * photo_url overrides from the DB while guaranteeing all 6 seats render.
     */
    const effectiveAgents = ALL_CANONICAL_CARDS.map((canonical) => {
      const fromDb = rawFromDb.find(
        (r) =>
          r.id === canonical.id ||
          r.display_name.trim().toLowerCase() ===
            canonical.display_name.toLowerCase(),
      );
      return fromDb ?? canonical;
    });

    const names = effectiveAgents.map((r) => String(r.display_name).trim());

    // ── 2. Display ledger (top 25, newest first from deals) ─────────────────
    const ledger = await (async (): Promise<OnboardingLedgerRow[]> => {
      const deals = await db
        .from("deals")
        .select("deal_id, deal_name, agent_name, created_at")
        .order("created_at", { ascending: false })
        .limit(25);
      if (!deals.error) return mapLedgerRows(deals);
      return [];
    })();

    // ── 3. Lead touches (this-month only — date-bounded to prevent full-table scan)
    let attemptedByIdx: number[] | null = null;
    let leadsTodayByIdx: number[] | null = null;
    /** All touch rows within this IST month for pipeline + dept counts */
    let allTouchRowsThisMonth: {
      agent_name: string;
      latest_status: string | null;
    }[] = [];

    /**
     * ALL leads rows for this IST month — unfiltered by agent name.
     * Used by leadMonthStats for the 4 metric tiles.
     */
    let allRawLeadsThisMonth: { latest_status: string | null }[] = [];

    try {
      // No SQL .in(agent_name) — DB often stores Zoho full names ("Samson Fernandes")
      // while cards use display names ("Samson"). Exact .in would drop those rows.
      const { rows: touchRows, error: touchErr } = await fetchLeadsCreatedInWindow(
        "agent_name, created_at, latest_status",
        monthStart,
        monthEndEx,
      );

      if (touchErr) throw touchErr;

      // Capture ALL rows this month (unfiltered) for the metric tiles
      allRawLeadsThisMonth = touchRows as { latest_status: string | null }[];

      const rows = touchRows.filter((row) =>
        names.some((displayName) =>
          onboardingAgentNameMatches(
            displayName,
            String(row.agent_name ?? ""),
          ),
        ),
      );

      attemptedByIdx = names.map((displayName) => {
        return rows.filter(
          (row) =>
            onboardingAgentNameMatches(displayName, String(row.agent_name)) &&
            touchInThisMonth(String(row.created_at)),
        ).length;
      });

      leadsTodayByIdx = names.map((displayName) => {
        return rows.filter(
          (row) =>
            onboardingAgentNameMatches(displayName, String(row.agent_name)) &&
            touchInToday(String(row.created_at)),
        ).length;
      });

      allTouchRowsThisMonth = rows.filter((row) =>
        touchInThisMonth(String(row.created_at)),
      ) as { agent_name: string; latest_status: string | null }[];
    } catch (e) {
      console.warn(
        "[/api/onboarding] onboarding_lead_touches unreadable — attempted/leads zeroed",
        e,
      );
    }

    // ── Section A — Lead status breakdown per agent (current IST month) ──────
    //
    // Derived directly from allTouchRowsThisMonth (no extra DB round-trip).
    // All 7 canonical agents are seeded with EMPTY_BREAKDOWN so they always appear.

    /**
     * Canonical pipeline statuses used by the agent health bar.
     * Zoho may send additional terminal labels (e.g. Lost, Trash) that
     * should be merged into our "Junk" bucket for display consistency.
     */
    const normalizeLeadStatus = (raw: string): ZohoLeadStatus => {
      const s = raw.trim().toLowerCase();
      if (!s) return "Junk";
      if (s === "new") return "New";
      if (s === "attempted") return "Attempted";
      if (s === "in discussion") return "In Discussion";
      if (s === "nurturing") return "Nurturing";
      if (s === "qualified") return "Qualified";
      if (s === "junk" || s === "lost" || s === "trash") return "Junk";
      return "Junk";
    };

    const leadStatusByAgent: LeadStatusByAgent = {};
    for (const displayName of names) {
      leadStatusByAgent[displayName] = { ...EMPTY_BREAKDOWN };
    }

    for (const row of allTouchRowsThisMonth) {
      const canonicalName = names.find((n) =>
        onboardingAgentNameMatches(n, String(row.agent_name ?? "")),
      );
      if (!canonicalName) continue;

      const rawStatus = String(row.latest_status ?? "");
      const normalizedStatus = normalizeLeadStatus(rawStatus);
      const normalizedKey = rawStatus.trim().toLowerCase();
      if (
        normalizedKey &&
        normalizedKey !== "new" &&
        normalizedKey !== "attempted" &&
        normalizedKey !== "in discussion" &&
        normalizedKey !== "nurturing" &&
        normalizedKey !== "qualified" &&
        normalizedKey !== "junk" &&
        normalizedKey !== "lost" &&
        normalizedKey !== "trash"
      ) {
        console.warn("[/api/onboarding] Unmapped latest_status mapped to Junk", {
          latest_status: rawStatus,
        });
      }

      const bd = leadStatusByAgent[canonicalName] as AgentLeadStatusBreakdown;
      (bd[normalizedStatus] as number)++;
      bd.total++;
    }

    // ── Section B — leadMonthStats (metric tiles) ─────────────────────────────
    //
    // Leads    = total rows in leads table this IST month (all agents)
    // Attended = leads where latest_status IN (New | Attempted | In Discussion)
    // Converted = count of rows in the deals table this IST month
    // Junk     = leads - attended - converted (everything else)

    let lmsAttended = 0;
    for (const row of allRawLeadsThisMonth) {
      const s = normalizeLeadStatus(String(row.latest_status ?? ""));
      if (s === "New" || s === "Attempted" || s === "In Discussion") lmsAttended++;
    }

    let dealsThisMonth = 0;
    try {
      const dealsCountQ = await db
        .from("deals")
        .select("deal_id", { count: "exact", head: true })
        .gte("created_at", monthStart)
        .lt("created_at", monthEndEx);
      dealsThisMonth = dealsCountQ.count ?? 0;
    } catch (e) {
      console.warn("[/api/onboarding] deals count query failed — converted zeroed", e);
    }

    const leadMonthStats: LeadMonthStats = {
      leads:     allRawLeadsThisMonth.length,
      attended:  lmsAttended,
      converted: dealsThisMonth,
      junk:      Math.max(0, allRawLeadsThisMonth.length - lmsAttended - dealsThisMonth),
    };

    // ── 4. Closure rows — THIS MONTH (IST cohort) from deals table ──────────
    type ClosureRow = { agent_name: string };
    let closureRows: ClosureRow[] = [];
    let closureDataAvailable = false;

    try {
      const { data: dealsData, error: dealsErr } = await db
        .from("deals")
        .select("agent_name")
        .gte("created_at", monthStart)
        .lt("created_at", monthEndEx)
        .limit(5000);

      if (!dealsErr) {
        closureRows = (dealsData ?? []) as ClosureRow[];
        closureDataAvailable = true;
      } else {
        console.warn("[/api/onboarding] deals closure query failed", dealsErr);
      }

      // Warn if rows exist but no agent names match — signals a config drift
      if (closureRows.length > 0) {
        const matchedAny = closureRows.some((row) =>
          names.some((n) => onboardingAgentNameMatches(n, row.agent_name)),
        );
        if (!matchedAny) {
          const distinct = Array.from(
            new Set(
              closureRows.map(
                (r) => String(r.agent_name ?? "").trim() || "(empty)",
              ),
            ),
          );
          console.warn(
            "[/api/onboarding] This-month closures: rows found but 0 agent names matched — check display_name vs deals agent_name",
            { cardDisplayNames: names, distinctAgentNamesInDeals: distinct },
          );
        }
      }
    } catch (e) {
      console.warn(
        "[/api/onboarding] deals closure query failed — counts zeroed",
        e,
      );
    }

    // ── 5. Per-agent closure stats ─────────────────────────────────────────
    const closureByIdx: number[] = names.map((displayName) =>
      closureRows.filter((r) =>
        onboardingAgentNameMatches(displayName, r.agent_name),
      ).length,
    );

    // ── 6. Build OnboardingAgentRow[] (all 6 agents) ──────────────────────
    const agents: OnboardingAgentRow[] = effectiveAgents.map((r, idx) => {
      const attempted = attemptedByIdx?.[idx] ?? 0;
      const leadsToday = leadsTodayByIdx?.[idx] ?? 0;
      const closed = closureByIdx[idx] ?? 0;

      return {
        id: String(r.id),
        name: r.display_name,
        photoUrl: r.photo_url,
        department: getAgentDepartment(r.display_name),
        // Legacy fields (backward compat + shimmer detection)
        totalAttempted: attempted,
        totalConverted: closed,
        leadsAttendToday: leadsToday,
        // This Month Cohort Math fields
        leadsThisMonth: attempted,
        closedLakhsThisMonth: closureDataAvailable ? 0 : undefined,
      };
    });

    // ── 7. Build per-department stats ──────────────────────────────────────
    const buildDeptStats = (dept: Department): DepartmentStats => {
      const deptAgents = agents.filter((a) => a.department === dept);

      // Attempted this month for this dept (from touch rows)
      const pipelineAttempted = allTouchRowsThisMonth.filter(
        (row) => getAgentDepartment(String(row.agent_name)) === dept,
      ).length;

      // Won count for this dept (from closure rows — already this-month scoped)
      const pipelineWon = closureRows.filter(
        (row) => getAgentDepartment(row.agent_name) === dept,
      ).length;

      const pipeline: PipelineStatusCounts = {
        ...EMPTY_PIPELINE,
        Attempted: pipelineAttempted,
        Won: pipelineWon,
      };

      return {
        department: dept,
        totalRupeesClosedThisMonth: 0,
        totalLakhsClosedThisMonth: 0,
        pipeline,
        agents: deptAgents,
      };
    };

    const departments: NonNullable<OnboardingApiPayload["departments"]> = {
      concierge: buildDeptStats("concierge"),
      shop: buildDeptStats("shop"),
    };

    // ── 8. Vertical Trendline — daily lead counts per business_vertical, last 7 IST days ──
    //
    // Simple approach: fetch `leads` rows for the last 7 IST calendar days,
    // bucket by (IST date, business_vertical), zero-fill missing cells.
    let leadTrendline: LeadTrendPoint[] = [];
    let teamAttendedTrend: TeamAttendedDay[] = [];
    let verticalTrendline: VerticalTrendPoint[] = [];

    try {
      const todayDate  = new Date(`${todayIST}T00:00:00+05:30`);

      const istFmt = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Kolkata",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });

      // Full current month: day 1 → last day of month
      const [istY, istM] = thisMonthIST.split("-") as [string, string];
      const monthStartMs  = new Date(`${istY}-${istM}-01T00:00:00+05:30`).getTime();
      const nextMonthMs   = new Date(
        Number(istM) === 12
          ? `${Number(istY) + 1}-01-01T00:00:00+05:30`
          : `${istY}-${String(Number(istM) + 1).padStart(2, "0")}-01T00:00:00+05:30`,
      ).getTime();
      const daysInMonth   = Math.round((nextMonthMs - monthStartMs) / 86_400_000);
      const windowStartUtc = new Date(monthStartMs).toISOString();

      // Build ordered date keys oldest → newest (full month)
      const dateKeys: string[] = [];
      for (let d = 0; d < daysInMonth; d++) {
        dateKeys.push(istFmt.format(new Date(monthStartMs + d * 86_400_000)));
      }

      const verticalFetch = await fetchLeadsCreatedInWindow(
        "business_vertical, created_at",
        windowStartUtc,
        monthEndEx,
      );

      if (!verticalFetch.error) {
        // Seed zero-filled maps for all 4 verticals × 7 days
        const counts: Record<string, Record<string, number>> = {};
        for (const key of dateKeys) {
          counts[key] = {
            "Indulge Global": 0,
            "Indulge Shop":   0,
            "Indulge House":  0,
            "Indulge Legacy": 0,
          };
        }

        for (const row of verticalFetch.rows as {
          business_vertical: string | null;
          created_at: string;
        }[]) {
          const key = toISTDay(String(row.created_at ?? ""));
          if (!key || !(key in counts)) continue;

          const vertical = row.business_vertical ?? "Indulge Global";
          const bucket = counts[key];
          if (bucket && vertical in bucket) {
            (bucket[vertical] as number)++;
          }
        }

        verticalTrendline = dateKeys.map((date) => ({
          date,
          "Indulge Global": counts[date]?.["Indulge Global"] ?? 0,
          "Indulge Shop":   counts[date]?.["Indulge Shop"]   ?? 0,
          "Indulge House":  counts[date]?.["Indulge House"]  ?? 0,
          "Indulge Legacy": counts[date]?.["Indulge Legacy"] ?? 0,
        }));
      }

      // ── Legacy leadTrendline + teamAttendedTrend (month-to-date, for stat tiles) ──
      const monthStart1st   = `${istY}-${istM}-01`;
      const monthStartDate  = new Date(`${monthStart1st}T00:00:00+05:30`);
      const monthWindowStartMs  = monthStartDate.getTime();
      const monthWindowStartUtc = monthStartDate.toISOString();

      const daysSoFar = Math.round(
        (todayDate.getTime() - monthStartDate.getTime()) / 86_400_000,
      ) + 1;

      const trendFetch = await fetchLeadsCreatedInWindow(
        "agent_name, created_at, modified_at, latest_status",
        monthWindowStartUtc,
        monthEndEx,
      );

      if (!trendFetch.error) {
        const monthDateKeys: string[] = [];
        for (let d = 0; d < daysSoFar; d++) {
          monthDateKeys.push(istFmt.format(new Date(monthWindowStartMs + d * 86_400_000)));
        }

        const conciergeByDate: Record<string, number> = {};
        const shopByDate: Record<string, number> = {};
        const onboardingAttendedByDate: Record<string, number> = {};
        const shopAttendedByDate: Record<string, number> = {};
        for (const key of monthDateKeys) {
          conciergeByDate[key] = 0;
          shopByDate[key] = 0;
          onboardingAttendedByDate[key] = 0;
          shopAttendedByDate[key] = 0;
        }

        for (const row of trendFetch.rows as {
          agent_name: string;
          created_at: string;
          modified_at: string;
          latest_status: string | null;
        }[]) {
          const createdKey = toISTDay(String(row.created_at ?? ""));
          if (!createdKey) continue;

          if (createdKey in conciergeByDate) {
            const dept = getAgentDepartment(String(row.agent_name ?? ""));
            if (dept === "concierge") conciergeByDate[createdKey]++;
            else shopByDate[createdKey]++;
          }

          const rowStatus = String(row.latest_status ?? "New").trim();
          if (rowStatus !== "New") {
            const modKey = toISTDay(
              String(row.modified_at ?? row.created_at ?? ""),
            );
            if (!modKey || !(modKey in conciergeByDate)) continue;
            const dept = getAgentDepartment(String(row.agent_name ?? ""));
            if (dept === "concierge")
              onboardingAttendedByDate[modKey] = (onboardingAttendedByDate[modKey] ?? 0) + 1;
            else shopAttendedByDate[modKey] = (shopAttendedByDate[modKey] ?? 0) + 1;
          }
        }

        leadTrendline = monthDateKeys.map((date) => ({
          date,
          conciergeLeads: conciergeByDate[date] ?? 0,
          shopLeads: shopByDate[date] ?? 0,
        }));

        teamAttendedTrend = monthDateKeys.map((date) => ({
          date,
          onboarding: onboardingAttendedByDate[date] ?? 0,
          shop: shopAttendedByDate[date] ?? 0,
        }));
      }
    } catch (e) {
      console.warn(
        "[/api/onboarding] trendline query failed — charts will be empty",
        e,
      );
    }

    // ── 9. Return payload ─────────────────────────────────────────────────
    const payload: OnboardingApiPayload = {
      agents,
      ledger,
      departments,
      leadTrendline,
      leadStatusByAgent,
      teamAttendedTrend,
      verticalTrendline,
      leadMonthStats,
    };
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
