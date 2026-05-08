# CLAUDE.md — Indulge Live Dashboard

> **Authoritative project context for AI assistants.** Updated 2026-05-08 from full codebase scan.  
> Structure is optimized for AI retrieval: critical invariants first, then schema, then logic, then UI.

---

## ⚡ CRITICAL INVARIANTS — Read First

These rules are non-negotiable. Violating any of them causes **silent incorrect metrics** on the TV.

1. **IST timezone is mandatory.** All "today" and "this month" logic uses `istToday()` from `lib/istDate.ts` (UTC+05:30). Never use `new Date().toISOString().slice(0, 10)` — that gives UTC, not India time.

2. **VOID tickets are stripped before ALL math.** `spam` and `deleted` are `VOID_STATUSES`. Strip them in the very first step of every aggregation. They must never count toward Received, Resolved, Pending, or agent stats.

3. **TERMINAL statuses are `{resolved, closed}` only.** `spam` and `deleted` are NOT terminal — they are void. Do not conflate them.

4. **Cohort math is anchored to `created_at`.** "Resolved This Month" = tickets *created* in this IST month whose status is now terminal. It does NOT mean tickets whose `resolved_at` is this month.

5. **`is_escalated` can only be set to `true` by the escalation-only webhook path.** The full-upsert path must never set `is_escalated: true`. For active non-SLA-safe statuses, the field must be **omitted entirely** (preserves the DB value).

6. **Freshdesk timestamps are naive IST strings.** They must always pass through `freshdeskTimestampToIsoUtcForDb()` before storage. Never store naive datetime strings in PostgREST — Postgres will treat them as UTC, shifting everything by +5:30.

7. **Supabase browser client (anon key) is for Realtime ONLY.** All data fetching uses Next.js API routes which call `supabaseAdmin` (service role). Never fetch data directly from the browser client.

8. **Supabase browser client is a module-level singleton.** Never call `createClient` inside a React component or hook. The singleton lives in `lib/supabase.ts`.

9. **Queendom name matching uses `.includes()`, not strict equality.** Freshdesk sends names like `"Team Ananyshree"` — always match with substring check.

10. **Zoho lead deduplication: PK violation = expected.** `23505` on `leads.lead_id` is NOT an error. It means a duplicate lead was silently ignored.

11. **Zoho deal deduplication: same pattern.** `23505` on `deals.deal_id` PK = silently ignore. Same for `onboarding_conversion_ledger_deal_id_key` partial unique index.

12. **Soft-delete only.** No `DELETE FROM tickets` is ever called. Soft-delete sets `status = "deleted"`, `is_escalated = false`. The row stays for audit trail and is hidden by the VOID filter.

---

## 1. Project Overview

**Indulge Live Dashboard** is a 24/7 real-time TV/big-screen dashboard for an Indian luxury concierge agency. It displays live metrics for two operational teams ("Queendoms") — **Ananyshree** and **Anishqa** — plus a **Revenue Dashboard** for the sales/onboarding team. The TV auto-rotates between the Concierge view (30 seconds) and the Revenue view (30 seconds).

### Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Framework | Next.js App Router | ^16.1.6 |
| UI | React | ^18 |
| Language | TypeScript | ^5 |
| Animations | Framer Motion | ^11.0.0 |
| Styling | Tailwind CSS | ^3.4.0 |
| Database | Supabase (PostgreSQL + Realtime) | @supabase/supabase-js ^2.39.0 |
| Icons | lucide-react | ^0.363.0 |
| Date Utils | date-fns | ^3.6.0 |
| CRM Integrations | Freshdesk (tickets), Zoho CRM (leads + deals) | — |
| Script runner | tsx | ^4.7.0 |

### NPM Scripts

```json
{
  "dev":            "next dev",
  "build":          "next build",
  "start":          "next start",
  "lint":           "next lint",
  "import-tickets": "tsx scripts/importTickets.ts"
}
```

### Full File Tree

```
app/
  page.tsx                              — Root page, renders <Dashboard />
  layout.tsx                            — Root layout, font imports
  globals.css                           — Tailwind + all custom CSS keyframes
  api/
    tickets/route.ts                    — GET /api/tickets (server-side aggregation)
    tickets/rows/route.ts               — GET /api/tickets/rows (client-side rows)
    agents/route.ts                     — GET /api/agents (legacy, not used by Dashboard)
    clients/route.ts                    — GET /api/clients (member counts)
    jokers/route.ts                     — GET /api/jokers
    jokers/recommendations/route.ts     — GET /api/jokers/recommendations
    onboarding/route.ts                 — GET /api/onboarding (large payload)
    renewals-panel/route.ts             — GET /api/renewals-panel?queendom=
    webhooks/
      freshdesk/route.ts                — POST /api/webhooks/freshdesk
      zoho-leads/route.ts               — POST /api/webhooks/zoho-leads
      zoho-deals/route.ts               — POST /api/webhooks/zoho-deals
      zoho-calls/README.md              — Scaffold notes only (no route.ts yet)

components/
  Dashboard.tsx                         — Composition shell; hooks + ErrorBoundary tree
  DashboardController.tsx               — Screen rotation, PAUSE, skeleton overlays
  QueendomPanel.tsx                     — One queendom's full concierge panel
  JokerMetricsStrip.tsx                 — Joker stats compact bar
  RecommendationTicker.tsx              — Horizontal scrolling ticker (bottom of screen)
  RenewalsPanel.tsx                     — Renewals & assignments widget
  CelebrationOverlay.tsx              — Full-screen win animation
  SpecialDates.tsx                      — Client birthdays & anniversaries
  TopBar.tsx                            — Top nav bar with live clock
  AnimatedCounter.tsx                   — Animated numeric counter (Framer Motion)
  QueendomWingspanHeader.tsx            — Header with queendom name + member counts

  leaderboard/
    AgentLeaderboard.tsx                — Agent stats table
    AgentRow.tsx                        — Single agent row (memo) + AnimatedValue + GRID_COLS
    AgentIcon.tsx                       — SVG ring progress icon + crown

  onboarding/
    OnboardingLayout.tsx                — Revenue Dashboard; calls useOnboardingPanelData
    DepartmentColumn.tsx                — One department column (Concierge or Shop)
    ConversionLedger.tsx                — rAF-based scrolling sales ledger
    PerformanceLineGraph.tsx            — SVG multi-line graph (4 business verticals)
    LeadStatusHealthBar.tsx             — Segmented pipeline status bar
    AgentVerticalBarChart.tsx           — Present; not mounted in OnboardingLayout
    LeadVelocityChart.tsx               — Present; not mounted in OnboardingLayout
    utils.ts                            — Typography clamp constants, formatters, portrait resolver

  _unmounted/
    README.md                           — Finance widgets parked until product mounts them
    ActiveOutlays.tsx                   — Finance outlays (not in QueendomPanel)
    OutlayLedger.tsx                    — CSS-marquee scrolling outlay list
    finance-utils.ts                    — PAID_EXIT_MS=2500, parseAmount, rowToDisplay

  skeletons/
    OnboardingSkeleton.tsx              — Pixel-stable skeleton for onboarding panel
    QueendomSkeleton.tsx                — Pixel-stable skeleton for queendom panel

  ui/
    ErrorBoundary.tsx                   — React class error boundary
    GlassPanel.tsx                      — Glassmorphism container primitive
    SectionDivider.tsx                  — Gold horizontal rule / titled divider
    StatCard.tsx                        — Metric tile (label + value slot)

hooks/
  useDashboardData.ts                   — Root data fetching + Realtime (tickets/clients/jokers/renewals)
  useCelebrationDetection.ts            — Detects agent tasksCompletedToday increase
  useOnboardingPanelData.ts           — Onboarding data fetching + Realtime (deals/leads)
  useKeyboardControls.ts              — TV/keyboard screen switch + freeze (used by DashboardController)
  usePrefersReducedMotion.ts          — matchMedia hook

lib/
  supabase.ts                           — Browser anon client singleton
  supabaseAdmin.ts                      — Server service-role client singleton
  types.ts                              — Core shared TypeScript interfaces
  onboardingTypes.ts                    — Onboarding-specific interfaces
  ticketAggregation.ts                  — All ticket math + agent ranking functions
  istDate.ts                            — IST helpers + month/day/30-day UTC bounds (merged ex–istMonthBounds)
  agentRoster.ts                        — Concierge agent name arrays + Joker roster
  onboardingAgents.ts                   — Onboarding agent normalization & mapping
  specialDates.ts                       — Static client birthday/anniversary data
  motionPresets.ts                      — Shared Framer Motion variant presets
  webhookAuth.ts                        — Webhook WEBHOOK_SECRET header validation
  webhookGuard.ts                       — Optional POST wrapper (auth + parse + 503 guard)
  apiGuard.ts                           — Optional GET wrapper (503 + error JSON)
  env.ts                                — assertServerEnv() for required server env vars
  dataSources.ts                        — Integration registry (Freshdesk, Zoho paths, Realtime channels)
  widgetRegistry.ts                     — Widget mount/data-source inventory

types/
  index.ts                              — Central type re-export + additional shared types

supabase/migrations/                    — 17 SQL migration files

scripts/
  importTickets.ts                      — One-off CSV import script

onboarding-agents-images/               — Agent portrait images (.webp)
  amit.webp, samson.webp, meghana.webp, kaniisha.webp
  vikram.webp, katya.webp, harsh.webp

blueprint.md, design.md                 — Human/AI reference docs (repo root)
```

---

## 2. Database Schema

All tables in `public` schema. Service role key bypasses RLS (used by all API routes). Anon key is SELECT-only (used for Realtime in browser).

---

### `tickets` — Primary concierge data source

Populated and updated exclusively via POST /api/webhooks/freshdesk.

| Column | Type | Constraint | Description |
|---|---|---|---|
| `ticket_id` | TEXT | PRIMARY KEY | Freshdesk ticket ID |
| `status` | TEXT | NOT NULL | Current status (see status classification below) |
| `queendom_name` | TEXT | NOT NULL | Freshdesk group name (matched via `.includes()`) |
| `agent_name` | TEXT | nullable | Assigned agent's full name |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | UTC (converted from naive IST string on ingest) |
| `resolved_at` | TIMESTAMPTZ | nullable | Set when resolved/closed; cleared on re-open |
| `is_escalated` | BOOLEAN | NOT NULL DEFAULT false | SLA breach. ONLY set to true by escalation-only webhook path |
| `tags` | JSONB | DEFAULT '{}' | `tags.joker_suggestion` = legacy Joker tracking field |
| `is_incomplete` | BOOLEAN | NOT NULL DEFAULT false | Incomplete flag (shown in AgentRow pending column); migration `20260508000000` |

**Realtime:** Yes (supabase_realtime publication).

---

### `leads` — Zoho lead tracking

*(Formerly `onboarding_lead_touches`, renamed in migration 20260425180000)*

One row per Zoho lead_id. Upserted on every Zoho CRM lead webhook (any status).

| Column | Type | Constraint | Description |
|---|---|---|---|
| `lead_id` | TEXT | PRIMARY KEY | Zoho lead ID — deduplication key |
| `agent_name` | TEXT | NOT NULL | Agent name (normalized) |
| `latest_status` | TEXT | NOT NULL | Current Zoho lead status (Attempted, Qualified, In Discussion, Nurturing, New, Junk, Not Interested, etc.) |
| `lead_name` | TEXT | NOT NULL DEFAULT '' | Zoho lead display name |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() | First time this lead was received from Zoho |
| `modified_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() | Last update from Zoho |
| `business_vertical` | TEXT | NOT NULL DEFAULT 'Indulge Global' CHECK IN ('Indulge Global','Indulge Shop','Indulge House','Indulge Legacy') | Which Indulge revenue vertical |

**Indexes:** `(agent_name, created_at)`, `(created_at DESC)`, `(modified_at DESC)`, `(business_vertical, created_at DESC)`

**Realtime:** Yes. **RLS:** anon SELECT, authenticated ALL.

**Deduplication behavior:** Webhook does `UPSERT` on `lead_id` conflict — updates `latest_status`, `lead_name`, `modified_at`, `business_vertical`. `created_at` is immutable (set only on first insert).

---

### `deals` — Zoho deal tracking

*(Formerly `onboarding_deals`, created 20260424, renamed 20260425)*

One row per Zoho deal. Deal-level new-sales tracking.

| Column | Type | Constraint | Description |
|---|---|---|---|
| `deal_id` | TEXT | PRIMARY KEY | Zoho deal ID — deduplication key |
| `deal_name` | TEXT | NOT NULL | Deal/client name |
| `agent_name` | TEXT | NOT NULL | Agent who owns the deal |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() | Deal creation time |

**Indexes:** `(created_at DESC)`, `(agent_name, created_at DESC)`

**Realtime:** Yes. **RLS:** anon SELECT, authenticated ALL.

**Deduplication:** PK violation on `deal_id` (error `23505`) = silently ignored.

---

### `onboarding_conversion_ledger` — Sales closure display log

Populated in parallel with `deals` by POST /api/webhooks/zoho-deals. Used for the scrolling Live Conversion Ledger UI and agent closure counts.

| Column | Type | Constraint | Description |
|---|---|---|---|
| `id` | UUID | PRIMARY KEY DEFAULT gen_random_uuid() | PK |
| `client_name` | TEXT | NOT NULL | Client name (from deal_name) |
| `amount` | NUMERIC(14,2) | NOT NULL | Deal amount in INR |
| `agent_name` | TEXT | NOT NULL | Agent name (normalized) |
| `queendom_name` | TEXT | NOT NULL DEFAULT '' | Always empty string (queendom not inferred) |
| `recorded_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() | Closure instant (used for "last 30 days" filter) |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() | Row creation time |
| `deal_id` | TEXT | nullable | Zoho deal ID for deduplication |

**Partial Unique Index:** `(deal_id) WHERE deal_id IS NOT NULL` — deduplication mechanism.

**Index:** `(recorded_at DESC)` **Realtime:** Yes. **RLS:** anon SELECT, authenticated ALL.

---

### `jokers` — Joker suggestion tracking

Populated via external Google Sheet sync. Drives JokerMetricsStrip and RecommendationTicker.

| Column | Type | Description |
|---|---|---|
| `id` | UUID PK | |
| `client_name` | TEXT | Client the suggestion was sent to |
| `city` | TEXT | Location context |
| `date` | DATE | Suggestion date (IST-based today/month filters) |
| `type` | TEXT | Category (restaurant, travel, hotel, etc.) |
| `suggestion` | TEXT | Raw suggestion text |
| `response` | TEXT | `"yes"` = accepted, `"no"` = rejected, anything else = pending |
| `queendom_name` | TEXT | Queendom this Joker belongs to |
| `joker_name` | TEXT | Full name (matched against JOKER_ROSTER) |
| `created_at` | TIMESTAMPTZ | Row creation time |

**Realtime:** Yes. **RLS:** anon SELECT, authenticated ALL.

---

### `finance_outlays` — Concierge expense tracking

Drives `components/_unmounted/ActiveOutlays.tsx` when mounted (not in live Queendom panel today).

| Column | Type | Constraint | Description |
|---|---|---|---|
| `id` | UUID | PRIMARY KEY DEFAULT gen_random_uuid() | PK |
| `client_name` | TEXT | nullable | Client name |
| `task` | TEXT | nullable | Task description |
| `amount` | NUMERIC(14,2) | NOT NULL DEFAULT 0 | Amount in INR |
| `status` | TEXT | NOT NULL DEFAULT 'pending' CHECK IN ('pending','paid') | Payment status |
| `queendom_name` | TEXT | nullable | Queendom this outlay belongs to |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | |
| `updated_at` | TIMESTAMPTZ | DEFAULT now() | |

**Index:** `(queendom_name, status)` **Realtime:** Yes (with per-queendom filter). **RLS:** anon SELECT, authenticated ALL.

---

### `clients` — Member counts

| Column | Type | Notes |
|---|---|---|
| `group` | TEXT | Queendom name — matched via `.includes()` |
| `latest_subscription_status` | TEXT | `"Active"` or `"Expired"` (only Active fetched) |
| `latest_subscription_membership_type` | TEXT | `"Premium"`, `"Genie"`, `"Monthly Trial"`, `"Standard"` = paid; `"Celebrity"` = complimentary |

---

### `renewals` — Membership renewal log

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `client_name` | TEXT | |
| `group` | TEXT | Queendom identifier |
| `queendom` | TEXT | Duplicate of `group`; both checked in code |
| `created_at` | TIMESTAMPTZ | Renewal date |

**Realtime:** Yes. **RLS:** anon SELECT, authenticated ALL.

---

### `members` — New member assignment log

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `client_name` | TEXT | |
| `group` | TEXT | Queendom identifier |
| `queendom` | TEXT | Duplicate of `group` |
| `created_at` | TIMESTAMPTZ | Assignment date |

**Realtime:** Yes. **RLS:** anon SELECT, authenticated ALL.

---

### `onboarding_sales_agents` (optional)

Referenced by GET /api/onboarding. Falls back to `ONBOARDING_AGENT_CARDS` if missing/empty.

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | Display identifier |
| `display_name` | TEXT | Canonical name |
| `photo_url` | TEXT | Optional portrait URL |
| `sort_order` | INTEGER | Display order (ascending) |

---

### RLS Pattern (universal)

```sql
CREATE POLICY "{table}_select_anon" ON public.{table} FOR SELECT TO anon USING (true);
CREATE POLICY "{table}_all_authenticated" ON public.{table} FOR ALL
  TO authenticated USING (true) WITH CHECK (true);
-- Service role bypasses RLS entirely (all Next.js API routes use this)
```

---

## 3. API Routes

All GET routes use `supabaseAdmin` (service role). All return `Cache-Control: no-store`.

### GET `/api/tickets`

Paginates the full `tickets` table in 1000-row batches, runs JS aggregation.  
**Returns:** `{ ananyshree: TicketStats, anishqa: TicketStats }`  
**Columns:** `status, queendom_name, created_at, tags`

---

### GET `/api/tickets/rows`

Returns minimal ticket rows for client-side aggregation and Realtime patching.  
**Returns:** rows with `id, status, queendom_name, agent_name, created_at, is_escalated, tags`  
**Filter (OR):**
- `created_at >= start of current IST month (UTC)` — all this-month tickets
- `status NOT IN (resolved, Resolved, RESOLVED, closed, Closed, CLOSED)` — all open tickets regardless of age

---

### GET `/api/agents` (legacy)

Per-agent stats from `tickets`. **Not called by Dashboard.tsx** — Dashboard derives agent stats client-side from `ticketRows`. Exists for potential external tooling.

---

### GET `/api/clients`

Fetches `clients` table where `latest_subscription_status = "Active"`.  
**Returns:** `{ ananyshree: MemberStats, anishqa: MemberStats }`

---

### GET `/api/jokers`

Fetches all `jokers` rows. For each joker in JOKER_ROSTER, computes:
- `uniqueSuggestionsCount`, `totalSent`, `acceptedCount`, `rejectedCount`, `pendingSuggestions`
- `acceptedToday` (IST today), `totalThisMonth` (IST month)

---

### GET `/api/jokers/recommendations`

Returns latest 15 joker rows (ordered by `created_at DESC`) as `{ id, city, type, suggestion }[]`.

---

### GET `/api/onboarding`

Large payload. Assembles:
1. Agent list (from `onboarding_sales_agents` table or `ONBOARDING_AGENT_CARDS` fallback)
2. Ledger (top 25 rows from `onboarding_conversion_ledger`)
3. Lead stats per agent (from `leads` table)
4. Department stats (concierge vs shop split)
5. Lead trendline by day (current IST month)
6. Business vertical trendline (4 verticals by day)
7. Lead status breakdown per agent (pipeline bar data)
8. Team attended trend

**Returns:** `OnboardingApiPayload` (see Types section)

---

### GET `/api/renewals-panel?queendom=ananyshree|anishqa`

Fetches `renewals` and `members` for a queendom. Uses `normalizeQueendom()` (`.includes()` matching).  
**Returns:** `{ totalRenewalsThisMonth, renewals: string[], assignments: string[] }`

---

### POST `/api/webhooks/freshdesk` — The Smart Bouncer

**Auth:** `x-webhook-secret` or `Authorization: Bearer` header vs `WEBHOOK_SECRET` env var. Fail-open if unset.

#### Detection Flow

```
Incoming POST body
  │
  ├─► Raw body fixup: regex replaces `"is_escalated": <empty>` → false
  │   (Freshdesk boolean placeholders stringify to "" — would corrupt BOOLEAN NOT NULL)
  │
  ├─► Parse JSON
  ├─► Extract ticket_id (tries: ticket_id, id, ticket.id)
  ├─► Detect webhook_type (tries: webhook_type, event, type — lowercased)
  │
  ├─► Path 1 — Deletion (type is "deletion" | "delete" | "ticket_deleted")
  │       → UPDATE tickets SET status="deleted", is_escalated=false
  │         Row stays in DB for audit. VOID filter hides it from all metrics.
  │
  ├─► Path 2 — Escalation-only (is_escalated is boolean AND no status/queendom_name)
  │       → Fetch existing row status
  │       → If status ∈ SLA_SAFE_STATUSES → force is_escalated=false (ignore payload)
  │       → Else → PATCH is_escalated to payload value
  │       ⚠️ THE ONLY PATH THAT CAN SET is_escalated = true
  │
  └─► Path 3 — Full upsert (status + queendom_name present)
          → Build row (only add agent_name if present in payload — avoids null overwrite)
          → Parse ticket_created_at via freshdeskTimestampToIsoUtcForDb
          → RESOLVED_STATUSES:  set resolved_at, is_escalated=false
          → VOID_STATUSES:      is_escalated=false
          → ACTIVE_CLEAR + SLA_SAFE: clear resolved_at, is_escalated=false
          → Active non-safe:    omit is_escalated (preserves DB value)
          → UPSERT on conflict ticket_id
```

#### Status Classification Sets

```typescript
const RESOLVED_STATUSES   = new Set(["resolved", "closed"]);

const SLA_SAFE_STATUSES   = new Set([
  "resolved", "closed", "nudge client",
  "ongoing delivery", "invoice due", "spam", "deleted"
]);

const ACTIVE_CLEAR_RESOLVED_AT = new Set([
  "open", "pending", "nudge client",
  "nudge vendor", "ongoing delivery", "invoice due"
]);

const VOID_STATUSES       = new Set(["spam", "deleted"]);   // invisible to all math
```

---

### POST `/api/webhooks/zoho-leads`

Accepts `application/json` OR `application/x-www-form-urlencoded`.

**Payload fields:**
- `lead_id`: Zoho lead ID
- `agent_name`: Zoho owner full name (normalized to display name)
- `latest_status` (alias: `status`): ZohoLeadStatus
- `lead_name`: Lead display name
- `business_vertical`: One of 4 verticals (defaults to "Indulge Global")
- `created_at`, `modified_at`: IST timestamps from Zoho

**Logic:** Upserts to `leads` table on any status (no status gate). On `lead_id` conflict: updates `latest_status`, `lead_name`, `modified_at`, `business_vertical`. `created_at` is never overwritten.

**`normalizeZohoAgentName(raw)` — actual implementation:**
```typescript
// lib/onboardingAgents.ts — current code (no lookup table)
function normalizeZohoAgentName(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}
// Display name resolution is done separately by getDisplayAgentName()
```

---

### POST `/api/webhooks/zoho-deals`

Accepts `application/json` OR `application/x-www-form-urlencoded`.

**Payload fields:** `deal_id`, `agent_name`, `deal_name`, `created_at`

**Logic:**
1. Normalize `agent_name` via `normalizeZohoAgentName()`
2. Insert into `deals` table (dedup by `deal_id` PK — `23505` = silently ignore)
3. Insert into `onboarding_conversion_ledger` (dedup by partial unique index on `deal_id`)

**⚠️ Dual-write pattern:** Both tables get the same insert. If the webhook fails mid-transaction, they may drift out of sync. `deals` drives Realtime on the onboarding panel. `onboarding_conversion_ledger` drives the scrolling ledger UI.

---

## 4. Business Logic

### Ticket Status Sets (authoritative)

```typescript
// lib/ticketAggregation.ts
export const VOID_STATUSES     = new Set(["spam", "deleted"]);
const TERMINAL_STATUSES        = new Set(["resolved", "closed"]);
```

### Metric Definitions

| Metric | Formula |
|---|---|
| **Received (This Month)** | `created_at` in current IST month AND NOT void |
| **Resolved (This Month)** | `created_at` in IST month AND `status ∈ TERMINAL_STATUSES` |
| **Solved Today** | `created_at` is IST today AND `status ∈ TERMINAL_STATUSES` |
| **Pending (To Resolve)** | `status ∉ TERMINAL_STATUSES` — **no date gate** — all open tickets ever |
| **Joker Suggestion** | `tags.joker_suggestion` is truthy (legacy field) |

### Void Filtering (always first)

```typescript
const seen = new Set<string>();
const uniqueRows: TicketRowMinimal[] = [];
for (const row of rows) {
  if (seen.has(row.id)) continue;
  seen.add(row.id);
  if (!isVoid(row.status)) uniqueRows.push(row);
}
// ALL metric math runs only on uniqueRows
```

### Per-Agent Stats

```
tasksAssignedToday      = created_at is IST today AND agent_name matches
tasksCompletedToday     = created_at is IST today AND agent matches AND status ∈ TERMINAL
tasksCompletedThisMonth = created_at is IST month AND agent matches AND status ∈ TERMINAL
tasksAssignedThisMonth  = created_at is IST month AND agent matches
pendingScore            = status ∉ TERMINAL AND agent matches (no date gate)
overdueCount            = pendingScore subset where is_escalated === true
incomplete              = pendingScore subset where is_incomplete === true
```

### Agent Ranking Sort

```
Primary:   tasksCompletedThisMonth DESC
Secondary: tasksCompletedToday DESC
```

### Memory Management

`pruneTicketRowsForDashboardState`: filter to IST current month → take newest 5000 by `created_at`.  
`setInterval` re-prunes every 5 minutes (handles IST month rollover without page reload).

### Queendom Mapping

```typescript
const q = (row.queendom_name ?? "").toLowerCase().trim();
if (q.includes("ananyshree")) → ananyshree bucket
else if (q.includes("anishqa")) → anishqa bucket
```

### IST Timestamp Parsing Rules (`lib/istDate.ts`)

```typescript
// Rule 1: "YYYY-MM-DD" → IST midnight
s = `${s}T00:00:00+05:30`

// Rule 2: "YYYY-MM-DD HH:..." (space, no zone) → IST wall time
s = s.replace(/^(\d{4}-\d{2}-\d{2}) /, "$1T") + "+05:30"

// Rule 3: Has "T" but no zone → IST wall time (Freshdesk export format)
s = `${s}+05:30`

// Rule 4: Has "Z" or explicit offset → use as-is
// Rule 5: "+HH" short offset → normalize to "+HH:00"
```

`freshdeskTimestampToIsoUtcForDb(s)` = apply rules above → `new Date(ms).toISOString()` (always ends in `Z`).

### IST Month/Day Bounds & ledger windows (`lib/istDate.ts`)

Merged from the former `lib/istMonthBounds.ts` (removed — all exports live in `istDate.ts`).

- `getCurrentIstMonthUtcBounds()` → `{ startUtcIso, endExclusiveUtcIso }` (first instant of IST month / first instant of next IST month)
- `getCurrentIstDayUtcBounds()` → same pattern for today
- `getLast30DaysUtcBounds()` → rolling 30×24h window; returns `{ startUtcIso, endUtcIso }` (used for closure scorecard)
- `recordedAtToMillis()` / `isRecordedAtInInclusiveRange()` → parse `recorded_at` for ledger filters

---

## 5. Frontend State Architecture

### Data Flow

```
Freshdesk ticket event
  → POST /api/webhooks/freshdesk → upsert tickets table
  → Supabase Realtime push
  → useDashboardData: setTicketRows() (optimistic patch)
  → useEffect derives new QueenStats
  → QueendomPanel re-renders

Zoho lead event
  → POST /api/webhooks/zoho-leads → upsert leads table
  → Supabase Realtime push
  → useOnboardingPanelData: firePulse() + scheduleDebouncedLoad(2500ms)
  → /api/onboarding refetch → update agent stats

Zoho deal event
  → POST /api/webhooks/zoho-deals → insert deals + onboarding_conversion_ledger
  → Supabase Realtime push (deals table)
  → useOnboardingPanelData: optimistic prepend to ledger + firePulse() + scheduleDebouncedLoad()
```

### Realtime Subscriptions (all active in production)

| Hook / Component | Channel | Table | Filter | Events |
|---|---|---|---|---|
| useDashboardData | `dashboard-tickets` | `tickets` | none | * |
| useDashboardData | `dashboard-clients` | `clients` | none | * |
| useDashboardData | `dashboard-jokers` | `jokers` | none | * |
| useDashboardData | `dashboard-renewals` | `renewals` + `members` | none | INSERT |
| useOnboardingPanelData | `deals-live` | `deals` | none | * |
| useOnboardingPanelData | `leads-touches-live` | `leads` | none | * |
| ActiveOutlays | `finance-outlays-{queendomId}` | `finance_outlays` | `queendom_name=eq.{queendomId}` | INSERT/UPDATE/DELETE |

### Ticket Realtime Deduplication

```typescript
// INSERT
setTicketRows((prev) => {
  const i = prev.findIndex((r) => r.id === row.id);
  if (i >= 0) { const next = [...prev]; next[i] = row; return prune(next); }
  return prune([...prev, row]);
});
// UPDATE
setTicketRows((prev) => prune(prev.map((r) => (r.id === row.id ? row : r))));
// DELETE
setTicketRows((prev) => prev.filter((r) => r.id !== oldRow.id));
```

### Screen Rotation

`DashboardController.tsx` — both screens are **always mounted** (no unmount on rotation).

```typescript
const SCREEN_DURATIONS_MS = { concierge: 30_000, onboarding: 30_000 };
// Framer Motion crossfade: opacity 0↔1, zIndex 0↔10, duration: 1.5s easeInOut
```

**Input:** `hooks/useKeyboardControls.ts` — `P` / `Space` / `Enter` / `NumpadEnter` / `MediaPlayPause` = freeze toggle (capture phase).  
`ArrowLeft` / `ArrowRight` = manual screen switch.  
PAUSE/RESUME button: `min-width: 140px`, `min-height: 48px` (TV remote accuracy).

---

## 6. Component Reference

### `hooks/useDashboardData.ts`

Central data hook. Returns all concierge dashboard state:
- Fetches: `/api/tickets/rows`, `/api/clients`, `/api/jokers`, `/api/renewals-panel`
- Realtime: 4 channels (tickets, clients, jokers, renewals)
- Polling: every 5 minutes (safety net)
- Returns: `{ ananyshreeStats, anishqaStats, renewalsAnanyshree, renewalsAnishqa, recommendations, isInitialLoading }`

### `hooks/useCelebrationDetection.ts`

Scans agent stats on each change. When any agent's `tasksCompletedToday` increases: sets `celebrationAgent`. First call seeds `prevScoresRef` (no celebration fires on initial load).

### `hooks/useOnboardingPanelData.ts`

Returns `UseOnboardingPanelDataResult`:
```typescript
{
  conciergeAgents: OnboardingAgentRow[];   // 4 agents (Amit, Meghana, Samson, Kaniisha)
  shopAgents: OnboardingAgentRow[];        // 3 agents (Vikram, Katya, Harsh)
  ledger: OnboardingLedgerRow[];
  pulseEvents: PulseEvent[];
  leadMonthStats: LeadMonthStats;          // { leads, attended, dealsClosedThisMonth, junk }
  verticalTrendline: VerticalTrendPoint[]; // one entry per IST calendar day of current month
  ledgerScrollDuration: string;            // "Ns" — Math.max(32, ledger.length * 6)
  prefersReducedMotion: boolean;
  shimmerStampByAgentId: Record<string, number>;
  leadStatusByAgent: LeadStatusByAgent;
  todayDate: string;                       // "YYYY-MM-DD" IST
}
```

Polling: 5-minute interval + 2500ms debounced refetch on Realtime events. Error recovery: CHANNEL_ERROR / TIMED_OUT → reload + 3s reconnect timer.

### `components/onboarding/OnboardingLayout.tsx`

Renders the Revenue Dashboard screen. Calls `useOnboardingPanelData()` internally (there is no separate `OnboardingPanel` wrapper). Composes `DepartmentColumn` × 2, center performance tiles + `PerformanceLineGraph` + `ConversionLedger`.

### `components/QueendomPanel.tsx`

Layout (top to bottom):
1. `QueendomWingspanHeader` — name + member counts
2. 5-Metric Hero Row (inline `MetricBox` × 5):
   - Resolved Today (emerald glow)
   - Received (Month) (champagne)
   - Resolved (Month) (green)
   - Pending (To Resolve) (red)
   - Spoiled / Joker Accepted (gold)
3. `RenewalsPanel`
4. `AgentLeaderboard` (left) + `SpecialDates` (right, matched height via ResizeObserver)
5. `JokerMetricsStrip`

### `components/leaderboard/AgentRow.tsx`

5-column grid per agent:
| Col | Content | Color |
|---|---|---|
| 1 | SVG ring (pct = completedToday/assignedToday) + crown for rank 0 | Gold |
| 2 | Agent name | Champagne |
| 3 | `completedToday / assignedToday` | Green / white |
| 4 | `completedThisMonth / assignedThisMonth` | Gold (rank 0), grey (others) |
| 5 | `pendingScore / overdueCount / incomplete` | Red / red glow |

### `components/onboarding/ConversionLedger.tsx`

Uses `requestAnimationFrame` (not CSS keyframes) for smooth scrolling. `dt` capped at 100ms. On row prepend: `posRef` compensates by avg-row-height so visible content stays stationary.

### `components/onboarding/PerformanceLineGraph.tsx`

SVG multi-line graph. 4 lines (one per business vertical):
```
"Indulge Global"  → #6B8FFF (blue)
"Indulge Shop"    → #FFB020 (gold)
"Indulge House"   → #34D399 (green)
"Indulge Legacy"  → #C084FC (lavender)
```
Curve: Catmull-Rom spline, tension T=0.35. Draw-in animation: `pathLength 0→1`, 0.12s stagger.

### `components/_unmounted/ActiveOutlays.tsx`

**⚠️ Not mounted in `QueendomPanel.tsx`** (component lives under `_unmounted/`). Wrap in `<ErrorBoundary>` if mounting.

Realtime behavior:
- INSERT (pending, not duplicate) → prepend to list
- UPDATE to "paid" → mark row green, schedule removal after 2500ms
- UPDATE to "pending" → update in-place
- DELETE → cancel timer, remove immediately

### `components/CelebrationOverlay.tsx`

Full-screen gold animation. Fires when `celebrationAgent` is set. Uses Web Audio API chime sound. Only one celebration at a time.

---

## 7. Types Reference

### `lib/types.ts`

```typescript
interface MemberStats { total: number; celebrityActive: number; }

interface TicketStats {
  totalReceived: number; resolvedThisMonth: number;
  solvedToday: number; pendingToResolve: number; jokerSuggestion: number;
}

interface AgentStats {
  id: string; name: string; queendom: string;
  tasksAssignedToday: number; tasksCompletedToday: number;
  tasksCompletedThisMonth: number; tasksAssignedThisMonth: number;
  pendingScore: number; overdueCount: number; incomplete: number;
}

interface QueenStats { members: MemberStats; tickets: TicketStats; agents: AgentStats[]; joker?: JokerStats; }

interface JokerStats {
  uniqueSuggestionsCount: number; totalSent: number; totalSuggestions: number;
  acceptedCount: number; rejectedCount: number; pendingSuggestions: number;
  acceptedToday: number; totalThisMonth: number;
}

interface SpecialDate {
  id: string; clientName: string; date: string; // "YYYY-MM-DD"
  type: "birthday" | "anniversary";
  queendom: "ananyshree" | "anishqa";
}
```

### `lib/onboardingTypes.ts`

```typescript
type Department = "concierge" | "shop";
type BusinessVertical = "Indulge Global" | "Indulge Shop" | "Indulge House" | "Indulge Legacy";
type ZohoLeadStatus = "Qualified" | "In Discussion" | "Nurturing" | "Attempted" | "New" | "Junk";
type AgentLeadStatusBreakdown = Partial<Record<ZohoLeadStatus, number>> & { total: number };
type LeadStatusByAgent = Record<string, AgentLeadStatusBreakdown>;

interface OnboardingAgentRow {
  id: string; name: string; department?: Department;
  leadsCreatedThisMonth: number; totalConverted: number; leadsCreatedTodayIst: number;
  leadsThisMonth?: number;          // alias for leadsCreatedThisMonth
  closedLakhsThisMonth?: number;    // deal amount in lakhs
  pipeline?: AgentLeadStatusBreakdown;
}

interface OnboardingLedgerRow {
  id: string; clientName: string; recordedAt: string;
  assignedTo: string; agentName: string; department?: Department;
}

interface LeadMonthStats { leads: number; attended: number; dealsClosedThisMonth: number; junk: number; }

interface VerticalTrendPoint {
  date: string; // "YYYY-MM-DD"
  "Indulge Global": number; "Indulge Shop": number;
  "Indulge House": number; "Indulge Legacy": number;
}
```

### `types/index.ts`

```typescript
type QueendomId = "ananyshree" | "anishqa";
type ActiveScreen = "concierge" | "onboarding";

interface RenewalsPanelData {
  totalRenewalsThisMonth: number; renewals: string[]; assignments: string[];
}

interface DisplayOutlay {
  id: string; client_name: string; task: string;
  amount: number; pending: boolean; // false = paid (green, scheduled removal)
}

interface JokerRecommendationItem { id: string; city: string; type: string; suggestion: string; }
```

### `lib/ticketAggregation.ts`

```typescript
interface TicketRowMinimal {
  id: string; status: string; queendom_name: string;
  agent_name: string | null; created_at: string;
  is_escalated: boolean; is_incomplete?: boolean;
  tags?: Record<string, unknown>;
}
```

---

## 8. Agent & Joker Rosters

### `ROSTER_ANANYSHREE` — 9 agents

1. Sanika Ahire
2. Ragadh Shahul
3. Aditya Sonde
4. Shaurya Verma
5. Poorti Gulati
6. Anshika Eark
7. Ajith Sajan
8. Khushi Shah
9. Palak Kataria

### `ROSTER_ANISHQA` — 9 agents

1. Sagar Ali
2. Savio Francis Fernandes
3. Pranav Gadekar
4. Dhanush K
5. Charlotte Dias
6. Ria Pujhari
7. Rupali Chodankar
8. Eeti Srinivsulu
9. Ekta Nihalani

### `JOKER_ROSTER` (from `lib/agentRoster.ts`)

```typescript
{
  "Lilian Albrecht": "ananyshree",
  "Shruti Sharma":   "anishqa",       // ← previously "Anil Talluri" (now corrected)
}
```

### Onboarding Sales Agents (from `lib/onboardingAgents.ts`)

**Concierge Department — left column ("Onboarding" label):**
| ID | Display Name | Portrait |
|---|---|---|
| `amit` | Amit | `onboarding-agents-images/amit.webp` |
| `meghana` | Meghana | `onboarding-agents-images/meghana.webp` |
| `samson` | Samson | `onboarding-agents-images/samson.webp` |
| `kaniisha` | Kaniisha | `onboarding-agents-images/kaniisha.webp` |

**Shop Department — right column ("Shop" label):**
| ID | Display Name | Portrait | objectFit |
|---|---|---|---|
| `vikram` | Vikram | `onboarding-agents-images/vikram.webp` | contain |
| `katya` | Katya | `onboarding-agents-images/katya.webp` | contain |
| `harsh` | Harsh | `onboarding-agents-images/harsh.webp` | cover |

**Department lookup (lowercase key):**
```
"amit", "samson", "meghana", "kaniisha", "aniisha" → "concierge"
"vikram", "katya", "harsh" → "shop"
```

---

## 9. Environment Variables

| Variable | Used by | Required |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `lib/supabase.ts`, `lib/supabaseAdmin.ts` | Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `lib/supabase.ts` (browser Realtime only) | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | `lib/supabaseAdmin.ts` (all API routes) | Yes |
| `WEBHOOK_SECRET` | `lib/webhookAuth.ts` | Optional (fail-open if missing) |

**`supabaseAdmin` singleton:** Stored in `globalThis.__supabaseAdmin__` to survive Next.js hot-reload. Created with `auth: { persistSession: false, autoRefreshToken: false }`. Returns `null` if `SUPABASE_SERVICE_ROLE_KEY` is missing or equals `"paste_your_service_role_key_here"` — all API routes return 503 in that case.

---

## 10. Active Gaps & Known Issues

### Not Yet Implemented
- **`POST /api/webhooks/zoho-calls`** — No `route.ts`; only `app/api/webhooks/zoho-calls/README.md` documents the intended handler. `lib/dataSources.ts` marks `zoho-calls` as `implemented: false`.
- **`GlossSweep` and `BreathingGlow` in `LeadStatusHealthBar.tsx`** — Both sub-components exist but return `null`. Visual polish stubs.

### Not Mounted
- **`ActiveOutlays`** (`components/_unmounted/ActiveOutlays.tsx`) — Not imported into `QueendomPanel.tsx`. Mount wrapped in `<ErrorBoundary>` when product requires finance tracking.

### Potential Data Issues
- **Dual-write risk:** `POST /api/webhooks/zoho-deals` inserts into both `deals` and `onboarding_conversion_ledger`. If the webhook fails between the two inserts, the tables can drift out of sync. `deals` drives Realtime; `onboarding_conversion_ledger` drives the ledger UI.

### Code Quality
- **Deprecated exports in `lib/onboardingAgents.ts`:** `ONBOARDING_AGENT_DISPLAY_NAMES`, `ONBOARDING_AGENT_CARDS`, `FALLBACK_AGENTS` are marked `@deprecated` but still present. Do not use these in new code.
- **`performanceTotals` computed but not returned** in `useOnboardingPanelData` return value — internal-only computation.

---

## 11. Migrations Log

| Migration | Date | Description |
|---|---|---|
| `20250318000000_add_is_escalated.sql` | 2025-03-18 | Added `is_escalated BOOLEAN NOT NULL DEFAULT false` to `tickets` |
| `20250318100000_add_tickets_tags.sql` | 2025-03-18 | Added `tags JSONB DEFAULT '{}'` to `tickets` |
| `20250318110000_create_jokers.sql` | 2025-03-18 | Created `jokers` table + Realtime + RLS |
| `20250318120000_seed_renewals_ananyshree.sql` | 2025-03-18 | Seeded initial renewal data (Ananyshree) |
| `20250318130000_seed_renewals_anishqa.sql` | 2025-03-18 | Seeded initial renewal data (Anishqa) |
| `20250401120000_create_finance_outlays.sql` | 2025-04-01 | Created `finance_outlays` + Realtime + RLS |
| `20250401140000_create_onboarding_lead_touches.sql` | 2025-04-01 | Created `onboarding_lead_touches` (now `leads`) |
| `20250401150000_onboarding_lead_touches_realtime.sql` | 2025-04-01 | Added to Realtime |
| `20250401160000_onboarding_lead_touches_rls.sql` | 2025-04-01 | RLS policies |
| `20250401170000_create_onboarding_conversion_ledger.sql` | 2025-04-01 | Created `onboarding_conversion_ledger` + Realtime + RLS |
| `20250401180000_conversion_ledger_queendom_no_default.sql` | 2025-04-01 | `queendom_name` default → `''` |
| `20250409120000_onboarding_conversion_ledger_deal_id.sql` | 2025-04-09 | Added `deal_id` + partial unique index |
| `20260417000000_add_intent_lead_name_to_lead_touches.sql` | 2026-04-17 | Added `intent`, `lead_name`, `company` (later dropped) |
| `20260424120000_onboarding_leads_deals_reschema.sql` | 2026-04-24 | Replaced `first_touched_at`/`updated_at` with `created_at`/`modified_at`; added `lead_name`; created `onboarding_deals` table |
| `20260425152000_rename_onboarding_deals_to_deals.sql` | 2026-04-25 | Renamed `onboarding_deals` → `deals`; updated RLS + Realtime |
| `20260425180000_rename_leads_add_business_vertical.sql` | 2026-04-25 | Renamed `onboarding_lead_touches` → `leads`; added `business_vertical` column + index |
| `20260508000000_add_is_incomplete_to_tickets.sql` | 2026-05-08 | Added `is_incomplete BOOLEAN NOT NULL DEFAULT false` to `tickets` |

**Current canonical table names:**
- `leads` (NOT `onboarding_lead_touches`)
- `deals` (NOT `onboarding_deals`)
- `onboarding_conversion_ledger` (unchanged — still exists)
