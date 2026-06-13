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
 *   Pipeline Touched count:  touch rows this month per department
 *   New / In Discussion / Lost: no data source yet — returns 0 (placeholder)
 *
 * ── Agent fallback strategy ──────────────────────────────────────────────────
 *   For each canonical seat (6 total: 3 concierge + 3 shop) the route uses
 *   the DB record from onboarding_sales_agents when present, else falls back
 *   to the static card spec. This handles the common case where the DB only
 *   has the original 3 concierge agents.
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
  CONCIERGE_AGENT_CARDS,
  SHOP_AGENT_CARDS,
  onboardingAgentNameMatches,
  getAgentDepartment,
  getDisplayAgentName,
} from "@/lib/onboardingAgents";
import {
  EMPTY_BREAKDOWN,
  type AgentLeadStatusBreakdown,
  type Department,
  type DepartmentStats,
  type LeadMonthStats,
  type LeadStatusByAgent,
  type OnboardingAgentRow,
  type OnboardingApiPayload,
  type OnboardingLedgerRow,
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
      // Store full name in DB, render compact first-name label in UI.
      agentName: getDisplayAgentName(r.agent_name),
      department: getAgentDepartment(r.agent_name),
    })) ?? []
  );
}

// ── GET handler ───────────────────────────────────────────────────────────────
// TV resilience: missing DB or any unexpected failure degrades to the EMPTY
// payload (200) — this screen must render zeros, never an error.

export const GET = withApiGuard(
  async (_req, db) => {
  try {
    // ── IST month bounds (PostgREST filter) + same calendar logic as /api/tickets ──
    const { month: thisMonthIST } = istToday();
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

    /** Paginate half-open [start, end) so we never silently drop rows past a single limit. */
    const fetchLeadsCreatedInWindow = (
      selectCols: string,
      windowStart: string,
      windowEndExclusive: string,
    ) =>
      paginateAll<Record<string, unknown>>((from, to) =>
        db
          .from("leads")
          .select(selectCols)
          .gte("created_at", windowStart)
          .lt("created_at", windowEndExclusive)
          .order("created_at", { ascending: true })
          .range(from, to),
      );

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

    // ── 3. Single unified leads fetch (replaces three separate table scans) ────
    //
    // One paginated read fetches all columns needed by:
    //   • agent leads-this-month / today counts  (agent_name, created_at, latest_status)
    //   • vertical trendline            (business_vertical, created_at)
    //   • lead velocity chart           (agent_name, created_at, modified_at, latest_status)
    //
    // Month-level "Leads" / attended / junk tiles count every row in the window
    // (automation owners like "Admin @ Indulge" included). Per-agent cards and
    // pipeline health still use roster-matched rows only.

    let attemptedByIdx: number[] | null = null;
    let leadsTodayByIdx: number[] | null = null;
    /** All known-agent touch rows within this IST month for pipeline + dept counts */
    let allTouchRowsThisMonth: {
      agent_name: string;
      latest_status: string | null;
    }[] = [];

    /**
     * Every `leads` row in this IST month (same set as the Supabase export for the window).
     * Used by leadMonthStats for the 4 metric tiles.
     */
    let allRawLeadsThisMonth: { latest_status: string | null }[] = [];

    // Shared row cache reused by the trendline blocks below.
    type LeadRow = {
      agent_name: string;
      created_at: string;
      latest_status: string | null;
      business_vertical: string | null;
      modified_at: string | null;
    };
    let allLeadRowsThisMonth: LeadRow[] = [];
    let leadsMonthFetchError: Error | null = null;

    try {
      // No SQL .in(agent_name) — DB often stores Zoho full names ("Samson Fernandes")
      // while cards use display names ("Samson"). Exact .in would drop those rows.
      const { rows: touchRows, error: touchErr } = await fetchLeadsCreatedInWindow(
        "agent_name, created_at, latest_status, business_vertical, modified_at",
        monthStart,
        monthEndEx,
      );

      if (touchErr) throw touchErr;

      allLeadRowsThisMonth = touchRows as LeadRow[];

      allRawLeadsThisMonth = touchRows as { latest_status: string | null }[];

      const knownAgentRows = touchRows.filter((row) =>
        names.some((displayName) =>
          onboardingAgentNameMatches(
            displayName,
            String(row.agent_name ?? ""),
          ),
        ),
      );

      attemptedByIdx = names.map((displayName) => {
        return knownAgentRows.filter(
          (row) =>
            onboardingAgentNameMatches(displayName, String(row.agent_name)) &&
            touchInThisMonth(String(row.created_at)),
        ).length;
      });

      leadsTodayByIdx = names.map((displayName) => {
        return knownAgentRows.filter(
          (row) =>
            onboardingAgentNameMatches(displayName, String(row.agent_name)) &&
            touchInToday(String(row.created_at)),
        ).length;
      });

      allTouchRowsThisMonth = knownAgentRows.filter((row) =>
        touchInThisMonth(String(row.created_at)),
      ) as { agent_name: string; latest_status: string | null }[];
    } catch (e) {
      leadsMonthFetchError = e instanceof Error ? e : new Error(String(e));
      console.warn(
        "[/api/onboarding] leads fetch unreadable — lead counts zeroed",
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
      if (s === "touched" || s === "attempted") return "Touched";
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

    const knownPipelineStatusKeys = new Set([
      "new",
      "touched",
      "attempted",
      "in discussion",
      "nurturing",
      "qualified",
      "junk",
      "lost",
      "trash",
    ]);
    const unmappedStatusCounts = new Map<string, number>();

    for (const row of allTouchRowsThisMonth) {
      const canonicalName = names.find((n) =>
        onboardingAgentNameMatches(n, String(row.agent_name ?? "")),
      );
      if (!canonicalName) continue;

      const rawStatus = String(row.latest_status ?? "");
      const normalizedStatus = normalizeLeadStatus(rawStatus);
      const normalizedKey = rawStatus.trim().toLowerCase();
      if (normalizedKey && !knownPipelineStatusKeys.has(normalizedKey)) {
        unmappedStatusCounts.set(
          normalizedKey,
          (unmappedStatusCounts.get(normalizedKey) ?? 0) + 1,
        );
      }

      const bd = leadStatusByAgent[canonicalName] as AgentLeadStatusBreakdown;
      (bd[normalizedStatus] as number)++;
      bd.total++;
    }

    if (unmappedStatusCounts.size > 0) {
      console.warn(
        "[/api/onboarding] Unmapped latest_status values (bucketed as Junk for pipeline bar)",
        Object.fromEntries(unmappedStatusCounts),
      );
    }

    // ── Section B — leadMonthStats (metric tiles) ─────────────────────────────
    //
    // Leads    = total rows in leads table this IST month (all agents)
    // Attended = leads where latest_status IN (New | Touched | In Discussion)
    // Converted = count of rows in the deals table this IST month
    // Junk     = leads - attended - converted (everything else)

    let lmsAttended = 0;
    for (const row of allRawLeadsThisMonth) {
      const s = normalizeLeadStatus(String(row.latest_status ?? ""));
      if (s === "Touched" || s === "In Discussion" || s === "Nurturing") lmsAttended++;
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

    let lmsJunk = 0;
    for (const row of allRawLeadsThisMonth) {
      const s = normalizeLeadStatus(String(row.latest_status ?? ""));
      if (s === "Junk") lmsJunk++;
    }

    const leadMonthStats: LeadMonthStats = {
      leads:                allRawLeadsThisMonth.length,
      attended:             lmsAttended,
      dealsClosedThisMonth: dealsThisMonth,
      junk:                 lmsJunk,
    };

    // ── 4. Closure rows — THIS MONTH (IST cohort) from deals table ──────────
    type ClosureRow = { agent_name: string };
    let closureRows: ClosureRow[] = [];

    try {
      const { data: dealsData, error: dealsErr } = await db
        .from("deals")
        .select("agent_name")
        .gte("created_at", monthStart)
        .lt("created_at", monthEndEx)
        .limit(5000);

      if (!dealsErr) {
        closureRows = (dealsData ?? []) as ClosureRow[];
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
        leadsCreatedThisMonth: attempted,
        totalConverted: closed,
        leadsCreatedTodayIst: leadsToday,
        // leadsThisMonth kept as alias for any downstream consumers
        leadsThisMonth: attempted,
      };
    });

    // ── 7. Build per-department stats ──────────────────────────────────────
    // (dry-audit D6: the half-filled pipeline/rupees fields were dropped — the
    // UI consumes only departments.{concierge,shop}.agents.)
    const buildDeptStats = (dept: Department): DepartmentStats => ({
      department: dept,
      agents: agents.filter((a) => a.department === dept),
    });

    const departments: NonNullable<OnboardingApiPayload["departments"]> = {
      concierge: buildDeptStats("concierge"),
      shop: buildDeptStats("shop"),
    };

    // ── 8. Trendline — reuse allLeadRowsThisMonth (no extra DB round-trips) ──
    //
    // The vertical trendline is derived from the same month-window rows
    // already fetched in section 3. Zero extra reads.

    let verticalTrendline: VerticalTrendPoint[] = [];

    if (!leadsMonthFetchError) {
      try {
        const istFmt = new Intl.DateTimeFormat("en-CA", {
          timeZone: "Asia/Kolkata",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        });

        const [istY, istM] = thisMonthIST.split("-") as [string, string];
        const monthStartMs = new Date(`${istY}-${istM}-01T00:00:00+05:30`).getTime();
        const nextMonthMs  = new Date(
          Number(istM) === 12
            ? `${Number(istY) + 1}-01-01T00:00:00+05:30`
            : `${istY}-${String(Number(istM) + 1).padStart(2, "0")}-01T00:00:00+05:30`,
        ).getTime();
        const daysInMonth = Math.round((nextMonthMs - monthStartMs) / 86_400_000);

        // Full-month date keys (oldest → newest)
        const dateKeys: string[] = [];
        for (let d = 0; d < daysInMonth; d++) {
          dateKeys.push(istFmt.format(new Date(monthStartMs + d * 86_400_000)));
        }

        // ── Vertical trendline ───────────────────────────────────────────────
        const vertCounts: Record<string, Record<string, number>> = {};
        for (const key of dateKeys) {
          vertCounts[key] = {
            "Indulge Global": 0,
            "Indulge Shop":   0,
            "Indulge House":  0,
            "Indulge Legacy": 0,
          };
        }
        for (const row of allLeadRowsThisMonth) {
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

    // ── 9. Return payload ─────────────────────────────────────────────────
    const payload: OnboardingApiPayload = {
      agents,
      ledger,
      departments,
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
