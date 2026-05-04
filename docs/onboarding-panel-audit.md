# Onboarding panel — lead scoring audit

This document describes how lead-related metrics are produced end-to-end as implemented in the repository **today** (read-only audit). It is the basis for diagnosing incorrect “Leads (Today)” and related numbers on the Revenue Dashboard onboarding screen.

---

## 1. Data flow overview

**Plain-English journey**

1. **Zoho CRM** fires an automation (or equivalent) that `POST`s to **`/api/webhooks/zoho-leads`** when a lead is created or updated.
2. The webhook normalises `agent_name` (trim / collapse spaces only — full Zoho owner name is preserved), validates `business_vertical`, parses optional `created_at` / `modified_at` through Zoho-specific IST digit handling, then **upserts** a single row in Supabase table **`public.leads`** keyed by `lead_id`.
3. **On first insert**, `created_at` is set from the payload’s `created_at` if valid, otherwise **server receive time** (UTC ISO). **On updates**, `created_at` is **not** changed; only `modified_at` (and status, owner, etc.) updates.
4. The TV browser loads **`GET /api/onboarding`** (no-store). The route uses the service-role Supabase client to read **`leads`**, **`deals`**, and **`onboarding_sales_agents`**, then aggregates in Node.
5. **`hooks/useOnboardingPanelData`** calls that API on mount, every **5 minutes**, and schedules a **debounced (2.5s) refetch** after Realtime events on **`leads`** or **`deals`**.
6. **`OnboardingPanel`** → **`OnboardingLayout`** → **`DepartmentColumn`** renders agent cards. **“Leads (This Month)”** and **“Leads (Today)”** come straight from the API’s **`OnboardingAgentRow`** fields (`leadsThisMonth` / `totalAttempted` and **`leadsAttendToday`**). There is **no** client-side recomputation of those two numbers.

**Important:** There is **no** materialised score column for “today’s leads” in the database. The UI number is **always** derived at **API request time** from `leads.created_at` and IST day bounds.

---

## 2. Database layer

### 2.1 Evolution (migrations)

| Migration | Effect |
|-----------|--------|
| `20250401140000_create_onboarding_lead_touches.sql` | Created `onboarding_lead_touches` with `first_touched_at`, `updated_at`. |
| `20260424120000_onboarding_leads_deals_reschema.sql` | Replaced immutability model: added `created_at` / `modified_at`, dropped `first_touched_at` / `updated_at`, added `lead_name`, created **`onboarding_deals`**. |
| `20260425180000_rename_leads_add_business_vertical.sql` | Renamed **`onboarding_lead_touches` → `leads`**, added **`business_vertical`** (CHECK + NOT NULL + default). Updated RLS policy names and realtime publication. |
| `20250401170000_create_onboarding_conversion_ledger.sql` | Legacy **`onboarding_conversion_ledger`** (still in schema history). **Current** onboarding API ledger feed uses **`deals`**, not this table. |

There is **no** migration in this repo for **`onboarding_sales_agents`** (referenced by the API); it may exist only in the hosted Supabase project.

### 2.2 Table: `public.leads` (current name)

**Purpose:** One row per Zoho `lead_id`, upserted on CRM create/update.

| Column | Type (from migrations / webhook) | Notes |
|--------|----------------------------------|--------|
| `lead_id` | `text` PRIMARY KEY | Zoho lead id |
| `agent_name` | `text` NOT NULL | Full normalised owner string from Zoho |
| `latest_status` | `text` NOT NULL | Pipeline status string from Zoho |
| `lead_name` | `text` NOT NULL | Display name fragment(s) from webhook |
| `created_at` | `timestamptz` NOT NULL | **Webhook:** first insert only — Zoho `created_at` or server time |
| `modified_at` | `timestamptz` NOT NULL | **Webhook:** every write |
| `business_vertical` | `text` NOT NULL | One of: Indulge Global \| Shop \| House \| Legacy |

**Indexes (post-reschema / rename):** `(agent_name, created_at)`, `(created_at DESC)`, `(modified_at DESC)`, `(business_vertical, created_at DESC)`.

**RLS:** `leads_select_anon` (SELECT), `leads_all_authenticated` (ALL). Service role bypasses RLS for API/webhooks.

**Realtime:** Table `leads` is intended to be in `supabase_realtime` (migration updates publication after rename).

**Foreign keys:** None defined in these migrations (logical link to Zoho only).

**Where “score” lives:** **Nowhere in the DB** for per-agent “today” or “this month” counts. Only raw facts (`created_at`, `agent_name`, `latest_status`, etc.). Aggregates are computed in **`GET /api/onboarding`**.

### 2.3 Table: `public.deals`

**Purpose:** One row per Zoho deal creation event (`POST /api/webhooks/zoho-deals`).

| Column | Type | Notes |
|--------|------|--------|
| `deal_id` | `text` PK | |
| `deal_name` | `text` NOT NULL | |
| `agent_name` | `text` NOT NULL | |
| `created_at` | `timestamptz` NOT NULL | Deal event time |

Used for: scrolling **ledger** (last 25), **per-agent “Closures (This Month)”** counts, **`leadMonthStats.converted`** (monthly count of deals), department pipeline “Won”.

### 2.4 Table: `public.onboarding_sales_agents` (optional)

Queried as `id, display_name, photo_url, sort_order` with `.limit(7)`. Merged with static canonical cards in code. **Not** used to store lead scores.

### 2.5 Legacy: `public.onboarding_conversion_ledger`

Still described in older docs and in some **comments** in `app/api/onboarding/route.ts` / `lib/onboardingTypes.ts`. **Not** queried by the current `GET /api/onboarding` implementation in this repo.

---

## 3. API / data-fetching layer

### 3.1 `GET /api/onboarding` — `app/api/onboarding/route.ts`

**Transport:** `NextResponse.json` with `Cache-Control: no-store`.

**Supabase tables touched:**

| Read | Purpose |
|------|---------|
| `onboarding_sales_agents` | Portrait / display overrides (fallback to static 7 cards) |
| `deals` | Ledger list; monthly deal counts per agent; `leadMonthStats.converted` |
| `leads` | Paginated reads for IST-month windows (see below) |

**Lead pagination helper:** `fetchLeadsCreatedInWindow(selectCols, windowStart, windowEndExclusive)` — loops pages of 1000 rows, `.gte("created_at", windowStart).lt("created_at", windowEndExclusive)`, ordered by `created_at` ascending.

**IST bounds (shared with rest of app):** `lib/istDate.ts` — `getCurrentIstMonthUtcBounds()`, `getCurrentIstDayUtcBounds()`, `istToday()`, `utcMillisFromDbTimestamp()`, `toISTDay()`.

### 3.2 Returned shape (`lib/onboardingTypes.ts` — `OnboardingApiPayload`)

- **`agents`:** `OnboardingAgentRow[]` (7 agents: 4 concierge + 3 shop in static roster).
- **`ledger`:** from `deals`, mapped to `OnboardingLedgerRow`.
- **`departments`:** concierge + shop rollups (each includes same agent rows as filtered by department).
- **`leadTrendline`**, **`teamAttendedTrend`**, **`verticalTrendline`**, **`leadMonthStats`**, **`leadStatusByAgent`:** charts and tiles (see section 4).

### 3.3 Client hook — `hooks/useOnboardingPanelData.ts`

- **`fetch("/api/onboarding", { cache: "no-store" })`**
- **`setAgents(data.agents.slice(0, 6))`** — **only first 6 agents** from API are kept in state.
- **Canonical roster is 7** (Amit, Meghana, Samson, Kaniisha, Vikram, Katya, Harsh). **The 7th agent returned by the API is dropped** before render. If API order puts **Kaniisha** (or any 7th seat) after index 5, **that agent never appears** and their metrics are discarded client-side.

**Realtime:**

- Channel `deals-live` → `postgres_changes` on `public.deals` → optimistic ledger prepend on INSERT + `scheduleDebouncedLoad()`.
- Channel `leads-touches-live` → `postgres_changes` on `public.leads` → pulse on INSERT + `scheduleDebouncedLoad()`.

**Polling:** `setInterval` every **5 minutes** → `load()`.

**No other server actions / route handlers** for onboarding leads were found in this pass. **No** `cron`, **no** Edge Functions, **no** `vercel.json` schedulers in repo for this flow.

---

## 4. Processing and scoring layer

### 4.1 Per-agent “Leads (This Month)” and “Leads (Today)”

**Source file:** `app/api/onboarding/route.ts`

Month window is applied **in SQL** via `fetchLeadsCreatedInWindow(..., monthStart, monthEndEx)`. Then:

1. **`allRawLeadsThisMonth`** — all rows returned (every agent / unknown owner), for **`leadMonthStats`** and status breakdown inputs (same month filter).
2. **`rows`** — filtered to rows whose `agent_name` matches **any** of the seven **`names`** from effective agent cards using **`onboardingAgentNameMatches`** (`lib/onboardingAgents.ts`).
3. **`attemptedByIdx`** — for each display name, count of `rows` where `onboardingAgentNameMatches` and **`touchInThisMonth(created_at)`**. Because `rows` are **already** restricted to the month query, **`touchInThisMonth` is redundant** (always true for valid parses).
4. **`leadsTodayByIdx`** — for each display name, count of `rows` where `onboardingAgentNameMatches` and **`touchInToday(created_at)`**.

Relevant implementation:

```142:153:app/api/onboarding/route.ts
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
```

```263:277:app/api/onboarding/route.ts
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
```

**Mapped onto API row:**

```431:449:app/api/onboarding/route.ts
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
```

**Exact meaning in code**

| UI label | Field | Meaning |
|----------|--------|---------|
| Leads (This Month) | `leadsThisMonth` / `totalAttempted` | Count of **`leads`** rows with **`created_at`** in **current IST calendar month** and **`agent_name`** matching that card (any `latest_status`). **Not** restricted to Zoho status `"Attempted"`. |
| Leads (Today) | `leadsAttendToday` | Count of **`leads`** rows with **`created_at`** in **current IST calendar day** and owner matching that card. **Not** “attended” or “touched” today — despite the legacy field name. |

**Name matching** (`lib/onboardingAgents.ts`):

```189:213:lib/onboardingAgents.ts
export function onboardingAgentNameMatches(
  cardDisplayName: string,
  storedAgentName: string,
): boolean {
  const stored = storedAgentName.trim().toLowerCase();
  if (!stored) return false;
  const card      = cardDisplayName.trim().toLowerCase();
  const cardFirst = card.split(/\s+/)[0] ?? "";

  if (stored === card)      return true;
  if (stored === cardFirst) return true;

  const storedFirst     = stored.split(/[/,]/)[0]?.trim() ?? stored;
  if (storedFirst === card)      return true;
  if (storedFirst === cardFirst) return true;

  const storedFirstWord = storedFirst.split(/\s+/)[0] ?? "";
  if (storedFirstWord === card)      return true;
  if (storedFirstWord === cardFirst) return true;

  if (stored.startsWith(`${card}/`)      || stored.startsWith(`${card} `))      return true;
  if (stored.startsWith(`${cardFirst}/`) || stored.startsWith(`${cardFirst} `)) return true;

  return false;
}
```

**Zoho webhook write path** (`app/api/webhooks/zoho-leads/route.ts`) — `created_at` on insert:

```85:94:app/api/webhooks/zoho-leads/route.ts
function toDbTimestamp(isoOrEmpty: string | null): string | null {
  if (!isoOrEmpty || !isoOrEmpty.trim()) return null;
  // Zoho sends India wall clock but merge fields often append Z / +00 — strip so we
  // store the true UTC instant (see normalizeZohoCrmTimestampForIstDigits).
  const zohoNormalized = normalizeZohoCrmTimestampForIstDigits(isoOrEmpty.trim());
  const normalized =
    freshdeskTimestampToIsoUtcForDb(zohoNormalized) ?? zohoNormalized;
  const t = Date.parse(normalized);
  return Number.isFinite(t) ? normalized : null;
}
```

```267:276:app/api/webhooks/zoho-leads/route.ts
    const createdAt = createdAtClient ?? touchedNow;
    const { error: insErr } = await db.from("leads").insert({
      lead_id: leadId,
      agent_name: agentName,
      latest_status: status,
      lead_name: leadName,
      business_vertical: businessVertical,
      created_at: createdAt,
      modified_at: modifiedAt,
    });
```

### 4.2 `leadMonthStats` (four tiles: Leads / Attended / Converted / Junk)

```353:376:app/api/onboarding/route.ts
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
```

- **`converted`** is **deal row count** for the month, **not** “Qualified” leads (the JSDoc on `LeadMonthStats` in `lib/onboardingTypes.ts` is **wrong** vs implementation).
- **`junk`** is a **residual** after subtracting attended statuses and **global** deal count — not a direct status count.

### 4.3 `leadStatusByAgent` (health bar)

Built from **`allTouchRowsThisMonth`**: same month cohort, agents matching the seven names, **`normalizeLeadStatus`** maps Zoho strings to buckets (`New`, `Attempted`, `In Discussion`, `Nurturing`, `Qualified`, `Junk`).

### 4.4 Trend series (different semantics again)

- **`leadTrendline`:** counts by **`created_at` → IST day** and **`getAgentDepartment(agent_name)`** (concierge vs shop). Only days from month start through “today” in IST.
- **`teamAttendedTrend`:** for each lead row, if **`latest_status` trim ≠ `"New"`**, bucket by **`modified_at` (fallback `created_at`) → IST day** — this is **“non-New activity by modification day”**, not the same as **`leadsAttendToday`**.

```610:620:app/api/onboarding/route.ts
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
```

### 4.5 `verticalTrendline`

Full IST month, buckets by **`toISTDay(created_at)`** and **`business_vertical`**.

### 4.6 Scoring timing summary

| Metric | When computed | Where |
|--------|----------------|--------|
| Leads (Today) / (This Month) per agent | Each GET | Server: `app/api/onboarding/route.ts` |
| Lead month tiles | Each GET | Server |
| Health bar | Each GET | Server |
| Ledger ordering | Each GET + INSERT realtime | Server + client sort |
| `performanceData` / `performanceTotals` in hook | Every render | Client — **computed in `useOnboardingPanelData` but not returned or used by `OnboardingLayout`** (dead weight unless something else imports the hook differently) |

---

## 5. UI layer

### 5.1 Component tree

- **`components/onboarding/OnboardingPanel.tsx`** — calls **`useOnboardingPanelData()`**, passes result to **`OnboardingLayout`**.
- **`components/onboarding/OnboardingLayout.tsx`** — Performance tiles from **`leadMonthStats`**, graph from **`verticalTrendline`**, ledger from **`ledger`**, agent columns from **`conciergeAgents` / `shopAgents`** and **`leadStatusByAgent`**.
- **`components/onboarding/DepartmentColumn.tsx`** — Renders **`Leads (This Month)`** = `agent.leadsThisMonth ?? agent.totalAttempted`, **`Leads (Today)`** = **`agent.leadsAttendToday`**, closures = **`agent.totalConverted`**.

```293:214:components/onboarding/DepartmentColumn.tsx
  const leadsMonth = agent.leadsThisMonth ?? agent.totalAttempted;
  const closedCount = agent.totalConverted;
  // ...
            <AnimatedCounter
              value={agent.leadsAttendToday}
```

### 5.2 “Today” in the UI

- **Agent card “Leads (Today)”** = API field **`leadsAttendToday`** = **`leads.created_at` ∈ [start of IST today, start of next IST day)** in **`getCurrentIstDayUtcBounds()`** using **`utcMillisFromDbTimestamp`** (see §4.1).
- **`todayDate` prop** (for graph marker) = **`istToday().day`** from **`useOnboardingPanelData`**, same calendar notion as server.

**No** extra client filter on those counts.

### 5.3 Department agents source

If **`data.departments`** exists, **`conciergeAgents` / `shopAgents`** come from **`deptStats.concierge.agents` / `deptStats.shop.agents`**. Those arrays are the **same** `OnboardingAgentRow` objects built in the API (split by `getAgentDepartment`), not re-scored.

---

## 6. Identified complexity and red flags

### 6.1 Duplicated or divergent “today” / “attended” semantics

- **`leadsAttendToday`** is **only** “leads **created** today (IST)”. The name and older comments suggest **attendance** or **touch** today.
- **`teamAttendedTrend`** uses **`modified_at`** when status ≠ `New` — closer to “activity day” but **not** wired to the agent card’s “Leads (Today)” tile.
- **Risk:** Stakeholders compare the TV number to Zoho’s “today” or “last activity” views → **systematic mismatch** without any code bug.

### 6.2 Misleading variable and API names

- **`attemptedByIdx` / `totalAttempted`** count **all monthly lead creations** for the agent, **not** Zoho `"Attempted"` status only.
- **`leadMonthStats` JSDoc** (`lib/onboardingTypes.ts`) claims **`converted`** comes from **Qualified** status; code uses **`deals`** count.
- **API file header** still mentions **`onboarding_conversion_ledger`** for closures; implementation uses **`deals`**.

### 6.3 Client truncates agents to six

```115:116:hooks/useOnboardingPanelData.ts
      if (Array.isArray(data.agents) && data.agents.length > 0) {
        setAgents(data.agents.slice(0, 6));
```

With a **7-seat** roster, **one agent’s metrics are always dropped** before UI. If that seat is not “dummy zero”, **scores are wrong** for whoever lands in slot 7.

### 6.4 Same transformation in multiple places

- **IST day bucketing:** `toISTDay` in API trend paths vs **`toISTDayFromZohoCrm`** in **`utils.ts`** for ledger display/sort — intentional split for Zoho-suffixed timestamps on deals/ledger, but easy to misuse when adding new charts.
- **Multiple paginated scans** of **`leads`** per request (month cohort for cards, month for vertical trend, month-to-date for team trend).

### 6.5 `getAgentDepartment` fallback

```134:140:lib/onboardingAgents.ts
export function getAgentDepartment(agentName: string): Department {
  const trimmed = agentName.trim().replace(/\s+/g, " ");
  if (!trimmed) return "concierge";

  // First-token extraction handles "Amit Agarwal", "Harsh/Backup", "samson".
  const firstToken = trimmed.split(/[\s/,]/)[0]?.toLowerCase() ?? "";
  return DEPARTMENT_BY_AGENT_KEY[firstToken] ?? "concierge";
}
```

Unknown first tokens map to **`concierge`**, so Shop volume can leak into Onboarding aggregates in charts.

### 6.6 Documentation drift

- **`CLAUDE.md`** still describes **`onboarding_lead_touches`**, **`first_touched_at`**, **`onboarding_conversion_ledger`** for onboarding TV metrics — **does not match** this codebase’s **`leads` / `deals`** implementation.

### 6.7 Dead / unused client computation

- **`performanceData`** and **`performanceTotals`** inside **`useOnboardingPanelData`** are not exposed in the hook’s return value and **`OnboardingLayout`** does not consume them — extra CPU on every relevant state change.

### 6.8 Stale data window

- After Realtime events, **`scheduleDebouncedLoad`** waits **2.5s** before refetch — brief staleness is expected.

---

## 7. Likely root causes for “incorrect today’s leads” (hypotheses tied to code)

1. **Definition mismatch:** UI counts **new CRM rows by `created_at`**, not “updated today”, “attempted today”, or “owner’s leads touched today”. Zoho UI may differ.
2. **Zoho `created_at` omitted or wrong on webhook:** Insert uses **server time** if `created_at` missing or invalid → Zoho “Created Time” and dashboard can disagree; IST day bucketing then follows **server** instant.
3. **`agents.slice(0, 6)`:** Seventh agent never shown; perceived “wrong” counts if expectations include that person.
4. **Owner name not matching any card:** Lead exists in **`leadMonthStats.leads`** but **omitted** from every agent’s “Today” / “This month” chips (`onboardingAgentNameMatches` fails).
5. **Timestamp zone bugs on ingest:** Mitigated for Zoho by **`normalizeZohoCrmTimestampForIstDigits`** in webhook; if payloads bypass that path or send non-standard strings, **`created_at`** could land on the wrong IST day.

---

## 8. Recommended approach (clean-slate architecture)

### 8.1 Simplest honest data flow

1. **Single source of truth in Postgres:** Keep **`leads`** as one row per `lead_id` with **`created_at`**, **`modified_at`**, **`agent_id` or normalised owner key`**, **`latest_status`**, **`business_vertical`**.
2. **Define metrics explicitly in SQL or a view**, e.g.:
   - **`leads_created_on_ist_date(agent_key, ist_date)`** via `(created_at AT TIME ZONE …)::date` in Asia/Kolkata, or a nightly **materialised view** per agent per IST day.
   - Optionally separate columns: **`first_seen_at`**, **`last_activity_at`** if product wants “touched today”.
3. **`GET /api/onboarding`** becomes a thin aggregator: read pre-grouped counts (or a single RPC returning JSON). **No** 250× paginated full-month scans in Node for TV load.
4. **Realtime:** On change, either **subscribe per aggregate** (hard in PostgREST) or **debounced refetch of one RPC** — keep debouncing, but cheaper query.

### 8.2 Layers to collapse or remove

- Collapse **three** separate **`leads`** window scans in **`route.ts`** into **one** query (or materialised view) that returns all needed dimensions.
- Remove or fix **`agents.slice(0, 6)`** — must align card count with API (6 vs 7 is a product decision, not silent truncation).
- Delete unused **`performanceData` / `performanceTotals`** block or wire it to UI.
- Align **`LeadMonthStats`** docs with **`deals`**-based **`converted`**, or change code to match docs.

### 8.3 Where scoring should live

- **Ideal:** **Database** (view / generated column / RPC) encodes the **definition** of “today” and “this month” once; app **displays** numbers.
- **Acceptable:** One **Postgres function** `get_onboarding_dashboard()` called from the route — still “compute once per request” in the DB engine with correct IST date truncation.

### 8.4 Supabase features that help

- **`TIMESTAMPTZ` + `(created_at AT TIME ZONE 'Asia/Kolkata')::date`** in a **SQL view** for daily buckets (avoids duplicating IST logic in TS).
- **RLS** unchanged for TV (anon read); service role for webhooks.
- **Realtime** on **`leads`** remains valid; consider **Broadcast** or lighter refetch if payload size grows.

### 8.5 Product clarity

- Rename **`leadsAttendToday` → `leadsCreatedTodayIst`** (or similar) and label the tile **“New leads today (CRM created time)”** if that is the intended definition — eliminates false “bugs” from naming alone.

---

## 9. File index (onboarding lead scoring path)

| Layer | Path |
|-------|------|
| Webhook ingest | `app/api/webhooks/zoho-leads/route.ts` |
| Deal ingest | `app/api/webhooks/zoho-deals/route.ts` |
| Aggregation API | `app/api/onboarding/route.ts` |
| IST / timestamps | `lib/istDate.ts` |
| Types | `lib/onboardingTypes.ts` |
| Agents / matching | `lib/onboardingAgents.ts` |
| Client data | `hooks/useOnboardingPanelData.ts` |
| UI root | `components/onboarding/OnboardingPanel.tsx`, `OnboardingLayout.tsx`, `DepartmentColumn.tsx` |
| Ledger helpers | `components/onboarding/utils.ts` |
| Schema history | `supabase/migrations/20250401140000_*.sql` … `20260425180000_*.sql` |

**Related but not on critical path for agent “Leads (Today)”:** `LeadVelocityChart.tsx` (not mounted in `OnboardingLayout`), `PerformanceLineGraph.tsx` (vertical trend + pulses), `LeadStatusHealthBar.tsx`, `ConversionLedger.tsx`.

---

*End of audit — code changes intentionally omitted per request.*
