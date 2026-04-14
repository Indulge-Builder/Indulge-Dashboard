# claude.md — Master Project Context: Indulge Live Dashboard

> **Absolute source of truth.** Every AI or human reading this file must treat it as the definitive reference for database schema, API routing, webhook logic, business math, and frontend UI state. Nothing is vague or abbreviated.

---

## Table of Contents

1. [Project Overview & Architecture](#1-project-overview--architecture)
2. [Database Schema & RLS](#2-database-schema--rls)
3. [Third-Party Webhooks & API Endpoints](#3-third-party-webhooks--api-endpoints)
4. [Core Business Logic & Math Engine](#4-core-business-logic--math-engine)
5. [Realtime State & Frontend UI](#5-realtime-state--frontend-ui)
6. [Environment Variables](#6-environment-variables)
7. [Agent & Joker Rosters](#7-agent--joker-rosters)

---

## 1. Project Overview & Architecture

### What is this project?

**Indulge Live Dashboard** is a real-time TV/big-screen dashboard for an Indian luxury concierge agency called Indulge. It displays live metrics for two operational "Queendoms" (named **Ananyshree** and **Anishqa**), plus an **Onboarding** sales team panel. The dashboard runs 24/7 on a screen in the office, auto-rotating between the Concierge view (40 seconds) and the Onboarding view (20 seconds).

### Tech Stack

| Layer | Technology |
|---|---|
| Framework | **Next.js 16** (App Router, React 18) |
| Database & Auth | **Supabase** (PostgreSQL + PostgREST + Realtime) |
| Animations | **Framer Motion 11** |
| Styling | **Tailwind CSS 3.4** + custom CSS classes |
| Language | **TypeScript 5** |
| CRM Integrations | Freshdesk (ticket webhooks), Zoho CRM (leads + deals webhooks) |
| Package Manager | npm |
| Script runner | `tsx` (for one-off import scripts) |

### File Structure

```
app/
  page.tsx                          — root page (renders <Dashboard />)
  layout.tsx                        — root layout
  globals.css                       — Tailwind + custom animations
  api/
    tickets/
      route.ts                      — GET /api/tickets (aggregated stats)
      rows/route.ts                 — GET /api/tickets/rows (minimal rows for client-side)
    agents/route.ts                 — GET /api/agents
    clients/route.ts                — GET /api/clients (member counts)
    jokers/
      route.ts                      — GET /api/jokers
      recommendations/route.ts      — GET /api/jokers/recommendations
    onboarding/route.ts             — GET /api/onboarding
    renewals-panel/route.ts         — GET /api/renewals-panel
    webhooks/
      freshdesk/route.ts            — POST /api/webhooks/freshdesk
      zoho-leads/route.ts           — POST /api/webhooks/zoho-leads
      zoho-deals/route.ts           — POST /api/webhooks/zoho-deals

components/
  Dashboard.tsx                     — Root client component; owns all state
  DashboardController.tsx           — Auto-rotating screen switcher
  QueendomPanel.tsx                 — Single queendom's full panel
  AgentLeaderboard.tsx              — Per-agent stats table
  OnboardingPanel.tsx               — Sales team TV view
  ActiveOutlays.tsx                 — Finance outlays widget
  JokerMetricsStrip.tsx             — Joker stats bar
  RecommendationTicker.tsx          — Bottom ticker strip
  RenewalsPanel.tsx                 — Renewals & assignments mini-panel
  CelebrationOverlay.tsx            — Full-screen win animation
  SpecialDates.tsx                  — Client birthdays & anniversaries
  TopBar.tsx                        — Top navigation bar
  AnimatedCounter.tsx               — Animated numeric counter
  QueendomWingspanHeader.tsx        — Header with member counts

lib/
  supabase.ts                       — Browser (anon) Supabase singleton
  supabaseAdmin.ts                  — Server-side service-role Supabase singleton
  types.ts                          — Shared TypeScript interfaces
  onboardingTypes.ts                — Onboarding-specific interfaces
  ticketAggregation.ts              — All ticket math + agent ranking
  istDate.ts                        — IST timezone helpers (critical)
  istMonthBounds.ts                 — Month/day UTC bound helpers
  agentRoster.ts                    — Canonical agent name arrays
  onboardingAgents.ts               — Onboarding agent normalization
  specialDates.ts                   — Static client birthday/anniversary data

supabase/migrations/                — All schema migrations (SQL)
onboarding-agents-images/           — Bundled portrait images (Amit, Samson, Meghana)
```

---

## 2. Database Schema & RLS

All tables live in the `public` schema of Supabase (PostgreSQL). All API routes use the **service role key** (`supabaseAdmin`) which bypasses RLS entirely. The browser client uses the **anon key** which is subject to RLS policies.

---

### Table: `tickets`

**Primary key:** `ticket_id TEXT`

This table is the most important table. It is populated and updated exclusively via the Freshdesk webhook (`POST /api/webhooks/freshdesk`). It drives all concierge scorecard metrics.

| Column | Type | Constraint / Default | Description |
|---|---|---|---|
| `ticket_id` | `TEXT` | `PRIMARY KEY` | Freshdesk ticket ID (string, even if numeric) |
| `status` | `TEXT` | `NOT NULL` | Freshdesk status string (e.g. `open`, `resolved`, `pending`, `spam`, `deleted`) |
| `queendom_name` | `TEXT` | `NOT NULL` | Group name from Freshdesk (e.g. `Ananyshree`, `Anishqa`) |
| `agent_name` | `TEXT` | nullable | Assigned agent's full name |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT NOW()` | Ticket creation instant (stored as UTC, converted from IST on ingest) |
| `resolved_at` | `TIMESTAMPTZ` | nullable | Set when status becomes `resolved` or `closed`; cleared on re-open |
| `is_escalated` | `BOOLEAN` | `NOT NULL DEFAULT false` | SLA breach flag; only the escalation-only webhook path may set this to `true` |
| `tags` | `JSONB` | `DEFAULT '{}'` | Custom metadata (e.g. `tags.joker_suggestion` for legacy Joker tracking) |

**Realtime:** Added to `supabase_realtime` publication — all changes broadcast to dashboard.

**RLS:** Not explicitly defined in migrations (relies on service-role bypass for all API access). Anon reads are granted implicitly via publication for Realtime subscriptions.

---

### Table: `clients`

Used by `GET /api/clients` to count active members per queendom.

| Column | Type | Notes |
|---|---|---|
| `group` | `TEXT` | Maps to queendom name (e.g. `ananyshree`, `anishqa`) — matched via `.includes()` |
| `latest_subscription_status` | `TEXT` | `"Active"` or `"Expired"` — only `"Active"` rows are fetched |
| `latest_subscription_membership_type` | `TEXT` | `"Premium"`, `"Genie"`, `"Monthly Trial"`, `"Standard"` = paid; `"Celebrity"` = complimentary |

**Membership Logic:**
- **Paid members** (`total`): membership type in `{premium, genie, monthly trial, standard}` (case-insensitive, normalized with `.replace(/\s+/g, " ")`)
- **Celebrity members** (`celebrityActive`): membership type exactly `"celebrity"`
- Only rows with `latest_subscription_status = "Active"` are included

---

### Table: `jokers`

Populated via Google Sheet sync (external process). Drives `JokerMetricsStrip` and `RecommendationTicker`.

| Column | Type | Default | Description |
|---|---|---|---|
| `id` | `UUID` | `gen_random_uuid()` | PK |
| `client_name` | `TEXT` | — | Client the suggestion was sent to |
| `city` | `TEXT` | — | City/location context |
| `date` | `DATE` | — | Suggestion date (used for IST-based "today"/"this month" filters) |
| `type` | `TEXT` | — | Category (e.g. `restaurant`, `travel`, `hotel`) |
| `suggestion` | `TEXT` | — | Raw suggestion text |
| `response` | `TEXT` | — | Client response: `"yes"`, `"no"`, or anything else = pending |
| `queendom_name` | `TEXT` | — | Queendom this Joker belongs to |
| `joker_name` | `TEXT` | — | Full name of the Joker (matched against `JOKER_ROSTER` in `agentRoster.ts`) |
| `created_at` | `TIMESTAMPTZ` | `now()` | Row creation timestamp |

**RLS:**
- `anon`: SELECT only (`jokers_select_anon`)
- `authenticated`: full access (`jokers_all_authenticated`)

**Realtime:** Added to `supabase_realtime`.

---

### Table: `finance_outlays`

Live concierge expense / reimbursement tracking. Drives `ActiveOutlays` widget.

| Column | Type | Constraint / Default | Description |
|---|---|---|---|
| `id` | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()` | PK |
| `client_name` | `TEXT` | — | Client name |
| `task` | `TEXT` | — | Task description |
| `amount` | `NUMERIC(14,2)` | `NOT NULL DEFAULT 0` | Amount in INR |
| `status` | `TEXT` | `NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid'))` | Only `pending` or `paid` are valid |
| `queendom_name` | `TEXT` | — | Which queendom this outlay belongs to |
| `created_at` | `TIMESTAMPTZ` | `DEFAULT now()` | Row creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | `DEFAULT now()` | Last update timestamp |

**Index:** `finance_outlays_queendom_status_idx` on `(queendom_name, status)`

**RLS:**
- `anon`: SELECT only (`finance_outlays_select_anon`)
- `authenticated`: full access (`finance_outlays_all_authenticated`)

**Realtime:** Added to `supabase_realtime`. `ActiveOutlays` subscribes directly with a `queendom_name=eq.{queendomId}` filter.

---

### Table: `onboarding_lead_touches`

Deduplication table for Zoho CRM leads. One row per lead, ever. Populated by `POST /api/webhooks/zoho-leads`.

| Column | Type | Constraint / Default | Description |
|---|---|---|---|
| `lead_id` | `TEXT` | `PRIMARY KEY` | Zoho lead ID (string) — uniqueness enforced at PK level |
| `agent_name` | `TEXT` | `NOT NULL` | Canonical display name (normalized via `normalizeZohoAgentName`) |
| `latest_status` | `TEXT` | `NOT NULL` | Status at time of first touch (always `"Attempted"`) |
| `first_touched_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` | The instant this lead was first dialled — **never overwritten** |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` | Last update time (not used for dedup logic) |

**Index:** `onboarding_lead_touches_agent_first_touched_idx` on `(agent_name, first_touched_at)`

**RLS:**
- `anon`: SELECT only (`onboarding_lead_touches_select_anon`)
- `authenticated`: full access (`onboarding_lead_touches_all_authenticated`)

**Realtime:** `ALTER PUBLICATION supabase_realtime ADD TABLE public.onboarding_lead_touches`

---

### Table: `onboarding_conversion_ledger`

Sales closure log. One row per unique deal. Populated by `POST /api/webhooks/zoho-deals`.

| Column | Type | Constraint / Default | Description |
|---|---|---|---|
| `id` | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()` | PK |
| `client_name` | `TEXT` | `NOT NULL` | Client name (from `deal_name` field in Zoho payload) |
| `amount` | `NUMERIC(14,2)` | `NOT NULL` | Deal amount in INR |
| `agent_name` | `TEXT` | `NOT NULL` | Canonical display name (normalized via `normalizeZohoAgentName`) |
| `queendom_name` | `TEXT` | `NOT NULL DEFAULT ''` | Queendom assignment (defaults to empty string — **not** a queendom name) |
| `recorded_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` | Closure instant (used for "last 30 days" filter) |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` | Row creation time |
| `deal_id` | `TEXT` | nullable | Zoho deal ID for deduplication |

**Partial Unique Index:** `onboarding_conversion_ledger_deal_id_key` on `(deal_id) WHERE deal_id IS NOT NULL`
- This is the deduplication mechanism: inserting the same `deal_id` twice will raise error code `23505` (unique violation), which the webhook handler catches and silently ignores.

**Index:** `onboarding_conversion_ledger_recorded_at_idx` on `(recorded_at DESC)`

**RLS:**
- `anon`: SELECT only (`onboarding_conversion_ledger_select_anon`)
- `authenticated`: full access (`onboarding_conversion_ledger_all_authenticated`)

**Realtime:** Added to `supabase_realtime`.

---

### Table: `renewals`

Tracks client membership renewals. Used by `RenewalsPanel`.

| Column | Type | Default | Description |
|---|---|---|---|
| `id` | `UUID` | `gen_random_uuid()` | PK |
| `client_name` | `TEXT` | — | Client name |
| `group` | `TEXT` | — | Queendom identifier (e.g. `ananyshree`, `anishqa`) |
| `queendom` | `TEXT` | — | Duplicate of `group`; both columns are checked in code |
| `created_at` | `TIMESTAMPTZ` | `now()` | Renewal date / row creation |

**RLS:**
- `anon`: SELECT only (`renewals_select_anon`)
- `authenticated`: full access (`renewals_all_authenticated`)

**Realtime:** Added to `supabase_realtime`.

---

### Table: `members`

Tracks new member assignments. Used by `RenewalsPanel` for "Latest Assignments" section.

| Column | Type | Default | Description |
|---|---|---|---|
| `id` | `UUID` | `gen_random_uuid()` | PK |
| `client_name` | `TEXT` | — | Client name |
| `group` | `TEXT` | — | Queendom identifier |
| `queendom` | `TEXT` | — | Duplicate of `group` |
| `created_at` | `TIMESTAMPTZ` | `now()` | Assignment date |

**RLS:**
- `anon`: SELECT only (`members_select_anon`)
- `authenticated`: full access (`members_all_authenticated`)

**Realtime:** Added to `supabase_realtime`.

---

### Table: `onboarding_sales_agents` (optional, may not exist)

Referenced by `GET /api/onboarding` but falls back to `ONBOARDING_AGENT_CARDS` if the table doesn't exist or returns an error.

| Column | Type | Notes |
|---|---|---|
| `id` | `TEXT` | PK / display identifier |
| `display_name` | `TEXT` | Canonical name (e.g. `"Amit"`, `"Samson"`, `"Meghana"`) |
| `photo_url` | `TEXT` | Optional portrait URL |
| `sort_order` | `INTEGER` | Display order (ascending) |

---

### RLS Summary

All tables follow the same two-policy pattern:

| Policy name | Role | Operations |
|---|---|---|
| `{table}_select_anon` | `anon` | SELECT only, `USING (true)` |
| `{table}_all_authenticated` | `authenticated` | ALL (INSERT/UPDATE/DELETE/SELECT), `USING (true) WITH CHECK (true)` |
| service_role | bypasses RLS entirely | Used by all server-side API routes |

---

## 3. Third-Party Webhooks & API Endpoints

### POST `/api/webhooks/freshdesk` — The "Smart Bouncer"

**File:** `app/api/webhooks/freshdesk/route.ts`

This is the most complex webhook. It handles three distinct automation payloads from Freshdesk.

#### Payload Detection Flow

```
Incoming POST
    │
    ├─► Raw body fixup: regex replaces `"is_escalated": <empty>` with `false`
    │   (Freshdesk sometimes sends malformed JSON when placeholder is unset)
    │
    ├─► Parse JSON
    │
    ├─► Extract ticket_id (from `ticket_id`, `id`, or `ticket.id` — all tried)
    │
    ├─► Detect webhook_type (from `webhook_type`, `event`, or `type` field, lowercased)
    │
    ├─► Path 1: isDeletion? (type === "deletion" | "delete" | "ticket_deleted")
    │       → Soft-delete: UPDATE tickets SET status="deleted", is_escalated=false
    │         Row STAYS in Supabase for audit trail — it is hidden by VOID_STATUSES filter
    │
    ├─► Path 2: Escalation-only? (is_escalated is boolean AND no status/queendom_name)
    │       → Fetch existing row's status
    │       → If status is in SLA_SAFE_STATUSES → force is_escalated=false (ignore payload)
    │       → Else → PATCH is_escalated to payload value
    │       ⚠️ THIS IS THE ONLY PATH THAT CAN SET is_escalated = true
    │
    └─► Path 3: Full upsert (status + queendom_name present)
            → Build row object (only include agent_name if present in payload)
            → Parse ticket_created_at via freshdeskTimestampToIsoUtcForDb
            → If RESOLVED_STATUSES: set resolved_at + is_escalated=false
            → If VOID_STATUSES: set is_escalated=false
            → If ACTIVE_CLEAR_RESOLVED_AT + SLA_SAFE: clear resolved_at + set is_escalated=false
            → If active non-safe (open/pending): omit is_escalated entirely (preserve DB value)
            → UPSERT on conflict ticket_id
```

#### Status Classification Sets

```typescript
// Tickets marked done — legal resolutions only
const RESOLVED_STATUSES = new Set(["resolved", "closed"]);

// Statuses where SLA escalation must be cleared (is_escalated forced to false on upsert)
const SLA_SAFE_STATUSES = new Set([
  "resolved", "closed",
  "nudge client", "ongoing delivery",
  "invoice due", "spam", "deleted"
]);

// Active statuses where resolved_at is cleared (ticket re-opened or in-flight)
const ACTIVE_CLEAR_RESOLVED_AT = new Set([
  "open", "pending", "nudge client",
  "nudge vendor", "ongoing delivery", "invoice due"
]);

// Void — ticket is dead; kept in DB but invisible to all dashboard math
const VOID_STATUSES = new Set(["spam", "deleted"]);
```

#### **CRITICAL RULE: Never Trust Freshdesk `is_escalated` Placeholder**

> **NEVER** send the `is_escalated` Freshdesk placeholder variable in a full upsert automation. Freshdesk automation variables for boolean fields often stringify to an empty string `""` which corrupts the `BOOLEAN NOT NULL` column. The upsert path intentionally **omits** `is_escalated` for active/non-safe statuses so that the DB value is preserved (e.g. a ticket that is still overdue but got re-assigned stays `true`).

#### Soft-Delete vs Hard-Delete

- **Soft-delete** (used): Sets `status = "deleted"`, `is_escalated = false`. Row stays in DB forever for audit. The `VOID_STATUSES` filter in all math engines silently ignores it. The TV dashboard never shows it.
- **Hard-delete** (NOT used): No `DELETE FROM tickets` is ever called from any webhook. This is intentional.

#### Partial Upsert Logic

The upsert row object is built selectively:
- `agent_name` is only added if `payload.agent_name !== undefined` (prevents overwriting with null if field is missing)
- `created_at` is only set if `parseWebhookInstant(ticket_created_at)` returns a non-null ISO UTC string
- `resolved_at` is set for terminal statuses; cleared (`null`) for active statuses; **not touched** for void/SLA-safe statuses
- `is_escalated` is set for terminal + void (false); set for SLA-safe active statuses (false); **omitted** for red-list active statuses (preserves DB value)

---

### POST `/api/webhooks/zoho-leads` — First-Touch Deduplication

**File:** `app/api/webhooks/zoho-leads/route.ts`

Registers the **first time** an agent dials a Zoho lead. Used to compute "Attempted This Month" scorecard.

#### Logic

1. Accept `application/json` OR `application/x-www-form-urlencoded` (Zoho sends either)
2. Parse `{ lead_id, agent_name, status }` (also accepts `latest_status` as alias for `status`)
3. Normalize `agent_name` via `normalizeZohoAgentName()` → canonical display name
4. **Status gate:** Only proceed if `status.trim().toLowerCase() === "attempted"`. All other statuses (e.g. "Interested", "Not Interested") are acknowledged with `action: "ignored"` and no DB write.
5. Attempt `INSERT` into `onboarding_lead_touches`
6. If Postgres error code `23505` (unique key violation on `lead_id` PK) → silently return `action: "ignored", reason: "duplicate_lead"` — **do not update the row**
7. `first_touched_at` is **never overwritten** — only the initial INSERT sets it

#### `normalizeZohoAgentName()` Logic

```typescript
// lib/onboardingAgents.ts
const ZOHO_FULL_NAME_TO_DISPLAY = {
  "amit agarwal": "Amit",
  "samson fernandes": "Samson",
  "meghana singh": "Meghana",
};

function normalizeZohoAgentName(raw: string): string {
  const trimmed = raw.trim().replace(/\s+/g, " ");
  const asKey = trimmed.toLowerCase();
  // 1. Exact full-name match (case-insensitive)
  const fromFull = ZOHO_FULL_NAME_TO_DISPLAY[asKey];
  if (fromFull) return fromFull;
  // 2. First-word match against canonical display names (e.g. "Amit" → "Amit")
  const firstWord = trimmed.split(" ")[0] ?? trimmed;
  const match = ONBOARDING_AGENT_DISPLAY_NAMES.find(
    n => n.toLowerCase() === firstWord.toLowerCase()
  );
  return match ?? trimmed; // fallthrough: return as-is if unrecognized
}
```

---

### POST `/api/webhooks/zoho-deals` — Closure Deduplication

**File:** `app/api/webhooks/zoho-deals/route.ts`

Appends a new row to `onboarding_conversion_ledger` when a Zoho CRM deal is won.

#### Logic

1. Accept `application/json` OR `application/x-www-form-urlencoded`
2. Parse `{ deal_id, agent_name, deal_name, amount }`
3. `deal_name` maps to `client_name`
4. `amount` is parsed from either a number or a numeric string (commas stripped)
5. Normalize `agent_name` via `normalizeZohoAgentName()`
6. `recorded_at` = current UTC ISO (via `freshdeskTimestampToIsoUtcForDb`)
7. `queendom_name` is always set to `""` (empty string) — the queendom is not inferred from the deal
8. Attempt `INSERT` into `onboarding_conversion_ledger`
9. If Postgres error `23505` (unique violation on `deal_id` partial unique index) → silently return `action: "ignored", reason: "duplicate_deal"`

---

### GET `/api/tickets`

**File:** `app/api/tickets/route.ts`

Server-side aggregation for initial dashboard load. Paginates the full `tickets` table in 1000-row batches (Supabase PostgREST max), then runs the aggregation math in JavaScript.

**Returns:** `{ ananyshree: TicketStats, anishqa: TicketStats }`

**Selected columns:** `status, queendom_name, created_at, tags` (falls back to without `tags` if that column doesn't exist)

---

### GET `/api/tickets/rows`

**File:** `app/api/tickets/rows/route.ts`

Returns minimal ticket rows for **client-side** aggregation and Realtime patching.

**Selected columns:** `id:ticket_id, status, queendom_name, agent_name, created_at, is_escalated, tags`

**Filter applied server-side (OR filter):**
- `created_at >= start of current IST month (UTC)` — includes all this-month tickets
- `status NOT IN (resolved, Resolved, RESOLVED, closed, Closed, CLOSED)` — includes all open/pending tickets regardless of age (old open tickets must stay in Pending count)

This dual-filter ensures old pending tickets are never dropped from the state even as months roll over.

---

### GET `/api/agents`

**File:** `app/api/agents/route.ts`

Identical pagination and math to `/api/tickets` but returns per-agent stats grouped by queendom. Uses `agent_name`, `status`, `created_at`, `is_escalated` columns.

**Returns:** `{ ananyshree: Record<string, AgentStats>, anishqa: Record<string, AgentStats> }`

Note: `Dashboard.tsx` no longer calls this endpoint directly — it derives agent stats from `ticketRows` state using `mergeAndRankAgents()` client-side.

---

### GET `/api/clients`

**File:** `app/api/clients/route.ts`

Fetches `clients` table filtered to `latest_subscription_status = "Active"`. Aggregates `total` (paid) and `celebrityActive` per queendom.

**Returns:** `{ ananyshree: MemberStats, anishqa: MemberStats }`

---

### GET `/api/jokers`

**File:** `app/api/jokers/route.ts`

Fetches all rows from `jokers` table. For each joker in `JOKER_ROSTER`, runs aggregation:
- `uniqueSuggestionsCount`: distinct normalized (`toLowerCase().trim()`) suggestion strings
- `totalSent` / `totalSuggestions`: row count
- `acceptedCount`: `response.toLowerCase() === "yes"`
- `rejectedCount`: `response.toLowerCase() === "no"`
- `pendingSuggestions`: response is neither "yes" nor "no"
- `acceptedToday`: accepted rows where `date` in IST is today
- `totalThisMonth`: rows where `date` in IST is this month

---

### GET `/api/jokers/recommendations`

**File:** `app/api/jokers/recommendations/route.ts`

Returns latest 15 joker rows (ordered by `created_at DESC`) as `{ id, city, type, suggestion }[]`. Used by `RecommendationTicker`.

---

### GET `/api/onboarding`

**File:** `app/api/onboarding/route.ts`

Assembles the full onboarding panel payload:

1. **Agents:** Fetches from `onboarding_sales_agents` table (falls back to `ONBOARDING_AGENT_CARDS` if table missing or empty)
2. **Ledger:** Fetches top 25 rows from `onboarding_conversion_ledger` (falls back to `onboarding_ledger`)
3. **Attempted (This Month):** Queries `onboarding_lead_touches` with `agent_name IN [...]` and counts rows where `first_touched_at` falls within current IST month UTC bounds
4. **Leads Today:** Counts rows where `first_touched_at` falls within current IST day UTC bounds
5. **Closures (Last 30 Days):** Queries `onboarding_conversion_ledger` with `recorded_at >= now-30days` and counts per agent using `onboardingAgentNameMatches()`

**Returns:** `{ agents: OnboardingAgentRow[], ledger: OnboardingLedgerRow[] }`

---

### GET `/api/renewals-panel?queendom=ananyshree|anishqa`

**File:** `app/api/renewals-panel/route.ts`

Fetches renewal and member data for a specific queendom.
- Filters `renewals` and `members` tables by `group` column (using `normalizeQueendom()` which does `.includes()` matching)
- `totalRenewalsThisMonth`: count of renewals where `created_at` starts with current UTC `YYYY-MM` prefix
- `renewals`: top 2 latest renewal client names
- `assignments`: top 2 latest new member names

**Returns:** `{ totalRenewalsThisMonth, renewals: string[], assignments: string[] }`

---

## 4. Core Business Logic & Math Engine

### Timezone Handling (`lib/istDate.ts`)

**The Absolute Rule:** All timestamps must be stored in Supabase as strict UTC ISO strings (ending in `Z` or explicit offset). **Never send naive datetime strings to PostgREST** — Postgres will interpret them as UTC wall time, shifting India-origin instants by +5:30.

#### Why IST Matters

All "today" and "this month" calculations are based on **India Standard Time (UTC+05:30)**. A ticket created at `2026-04-13 23:45:00` IST is `2026-04-13T18:15:00Z` in UTC. If the dashboard uses UTC "today" (April 13) it correctly counts this ticket. But if someone sends the naive string `2026-04-13 23:45:00` to PostgREST without a timezone, Postgres stores it as UTC, meaning the IST date is now April 14 — an off-by-one error.

#### Timestamp Parsing Rules (`utcMillisFromDbTimestamp`)

```typescript
// Rule 1: Date-only string "YYYY-MM-DD" → treat as IST midnight
s = `${s}T00:00:00+05:30`

// Rule 2: "YYYY-MM-DD HH:..." (space separator, no zone) → IST wall time
s = s.replace(/^(\d{4}-\d{2}-\d{2}) /, "$1T") + "+05:30"

// Rule 3: Has "T" but no explicit zone → IST wall time (Freshdesk exports are IST)
s = `${s}+05:30`

// Rule 4: Has explicit "Z" or "±offset" → use as-is (true UTC from PostgREST)

// Rule 5: "+HH" short offset → normalize to "+HH:00"
```

#### `timestampStringToIsoUtcForDb` / `freshdeskTimestampToIsoUtcForDb`

These are aliases for the same function: parse any timestamp string using the rules above, then return `new Date(ms).toISOString()` (always ends in `Z`). Every Freshdesk webhook timestamp MUST pass through this before going to Supabase.

#### `istToday()`

Returns `{ day: "YYYY-MM-DD", month: "YYYY-MM" }` — the current calendar date and month **in IST**, derived from `Intl.DateTimeFormat` with `timeZone: "Asia/Kolkata"`.

---

### Cohort Math Engine (`lib/ticketAggregation.ts`)

**The Core Principle: All ticket metrics are Cohort Math based ONLY on `created_at`.**

This means "Resolved This Month" does NOT mean "tickets that were resolved during this month." It means "tickets that were **created** this month AND whose current status is terminal." This cohort approach prevents a ticket created last month from counting toward this month's resolution rate.

#### Status Classification

```typescript
// VOID — completely invisible to all dashboard math
// Filtered out BEFORE any metric is computed
export const VOID_STATUSES = new Set(["spam", "deleted"]);

// TERMINAL — legitimate completions (spam/deleted are explicitly excluded)
const TERMINAL_STATUSES = new Set(["resolved", "closed"]);
```

#### Metric Definitions

| Metric | Formula |
|---|---|
| **Received (This Month)** | `created_at` in current IST calendar month (regardless of status) |
| **Resolved (This Month)** | `created_at` in current IST month **AND** `status ∈ TERMINAL_STATUSES` |
| **Solved Today** | `created_at` is today in IST **AND** `status ∈ TERMINAL_STATUSES` |
| **Pending (To Resolve)** | `status ∉ TERMINAL_STATUSES` — **no date gate** — includes ALL open tickets ever |
| **Joker Suggestion** | `tags.joker_suggestion` is set and non-empty (legacy field) |

#### Void Filtering

Void tickets are stripped **before any iteration**:
```typescript
const seen = new Set<string>();
const uniqueRows: TicketRowMinimal[] = [];
for (const row of rows) {
  if (seen.has(row.id)) continue;     // dedup by id
  seen.add(row.id);
  if (!isVoid(row.status)) uniqueRows.push(row);  // strip void
}
// All math runs only on uniqueRows
```

#### Per-Agent Stats

```
tasksAssignedToday    = rows where agent_name matches AND created_at is today (IST)
tasksCompletedToday   = rows where agent_name matches AND created_at is today (IST) AND status is TERMINAL
tasksCompletedThisMonth = rows where agent_name matches AND created_at is this month (IST) AND status is TERMINAL
tasksAssignedThisMonth = rows where agent_name matches AND created_at is this month (IST)
pendingScore           = rows where agent_name matches AND status is NOT TERMINAL (no date gate)
overdueCount           = pendingScore subset where is_escalated === true
```

#### Agent Ranking (`mergeAndRankAgents`)

1. Build zero-stats roster arrays from `ROSTER_ANANYSHREE` / `ROSTER_ANISHQA`
2. Calculate live stats from ticket rows
3. Merge (case-insensitive name match)
4. Sort: primary = `tasksCompletedThisMonth` (desc), secondary = `tasksCompletedToday` (desc)

#### Memory Management (`pruneTicketRowsForDashboardState`)

- Max 5000 rows in Dashboard React state
- On prune: filter to current IST month only, then take newest 5000 by `created_at`
- A `setInterval` runs every 5 minutes to re-prune (handles IST month rollover without a page reload)

---

### Queendom Mapping

The queendom_name from Freshdesk is matched using **`.includes()`** (substring, case-insensitive), NOT strict equality.

```typescript
const queendom = (row.queendom_name ?? "").toLowerCase().trim();
if (queendom.includes("ananyshree")) bucket = result.ananyshree;
else if (queendom.includes("anishqa")) bucket = result.anishqa;
```

This means Freshdesk group names like `"Team Ananyshree"` or `"Ananyshree Concierge"` are correctly matched. **Do not change this to strict equality** — the Freshdesk group names contain the queendom name as a substring.

---

### IST Month Bounds (`lib/istMonthBounds.ts`)

**`getCurrentIstMonthUtcBounds()`** — Returns `{ startUtcIso, endExclusiveUtcIso }`:
- Start = first instant of the current IST calendar month as UTC ISO
- End = first instant of the next IST calendar month as UTC ISO (exclusive upper bound)

**`getCurrentIstDayUtcBounds()`** — Same pattern for today.

**`getLast30DaysUtcBounds()`** — Rolling 30×24h window ending now (used for closure scorecard).

**`recordedAtToMillis()`** — Parses `recorded_at` column which may be a full TIMESTAMPTZ or a date-only `YYYY-MM-DD` (treated as IST midnight).

---

## 5. Realtime State & Frontend UI

### How the TV Dashboard Stays Alive

`Dashboard.tsx` is the single root client component. It owns all application state and establishes 4 Supabase `postgres_changes` subscriptions on mount:

| Channel name | Table | Events | Action |
|---|---|---|---|
| `dashboard-clients` | `clients` | `*` | Refetch `/api/clients` |
| `dashboard-jokers` | `jokers` | `*` | Optimistic patch recommendations state + refetch `/api/jokers` |
| `dashboard-tickets` | `tickets` | `*` | Optimistic patch `ticketRows` state (see below) |
| `dashboard-renewals` | `renewals`, `members` | `INSERT` | Refetch `/api/renewals-panel` for both queendoms |

**Plus `ActiveOutlays`** has its own per-queendom subscription:
- Channel: `finance-outlays-{queendomId}`
- Filter: `queendom_name=eq.{queendomId}`
- Events: INSERT/UPDATE/DELETE with specific UI behavior per event type

**Plus `OnboardingPanel`** has two subscriptions:
- `onboarding-conversion-ledger-live` on `onboarding_conversion_ledger`
- `onboarding-lead-touches-live` on `onboarding_lead_touches`

---

### Realtime Deduplication Pattern

When a `postgres_changes` event arrives for the `tickets` table, the Dashboard uses `findIndex` to deduplicate by ticket `id`:

```typescript
// INSERT event
setTicketRows((prev) => {
  const i = prev.findIndex((r) => r.id === row.id);
  if (i >= 0) {
    // Ticket already in state (duplicate INSERT) — overwrite
    const next = [...prev];
    next[i] = row;
    return pruneTicketRowsForDashboardState(next);
  }
  // New ticket — append
  return pruneTicketRowsForDashboardState([...prev, row]);
});

// UPDATE event
setTicketRows((prev) =>
  pruneTicketRowsForDashboardState(
    prev.map((r) => (r.id === row.id ? row : r))
  )
);

// DELETE event
setTicketRows((prev) => prev.filter((r) => r.id !== oldRow.id));
```

Ticket stats and agent stats are derived **reactively** from `ticketRows` via a `useEffect` that runs on every `ticketRows` change — no separate polling needed.

---

### DashboardController — Screen Rotation

**File:** `components/DashboardController.tsx`

The controller manages the auto-rotating TV view. Both screens (`concierge` and `onboarding`) are **always mounted** — only opacity and z-index change (cinematic crossfade, no component unmount/remount which would cause flicker).

```typescript
const SCREEN_DURATIONS_MS = {
  concierge: 40_000,   // 40 seconds
  onboarding: 20_000,  // 20 seconds
};
```

**Freeze/Resume:** Press `P`, `Space`, `Enter`, or `MediaPlayPause` key to freeze on the current screen. A PAUSE/RESUME button is always visible in the top-right corner (minimum 48×140px for TV remote click accuracy). Keyboard events are captured at the `window` level with `capture: true` to work in fullscreen TV browsers.

**Manual navigation:** `ArrowLeft`/`ArrowRight` keys switch screens immediately.

**Framer Motion crossfade:**
```typescript
animate={{
  opacity: activeScreen === "concierge" ? 1 : 0,
  zIndex: activeScreen === "concierge" ? 10 : 0,
}}
transition={{ duration: 1.5, ease: "easeInOut" }}
```

---

### QueendomPanel — Core Concierge View

**File:** `components/QueendomPanel.tsx`

The panel renders a full half of the concierge screen for one queendom. Layout (top to bottom):

1. **QueendomWingspanHeader** — Name + member counts (paid total + celebrity)
2. **5-Metric Hero Row** — `Resolved Today` (emerald glow) | `Received (Month)` | `Resolved (Month)` (green) | `Pending (Month)` (red) | `Spoiled (Last 2 Weeks)` (Joker accepted count, gold)
3. **RenewalsPanel** — Renewal count + latest 2 renewals + latest 2 assignments
4. **AgentLeaderboard** (left) + **SpecialDates** (right, same height as leaderboard)
5. **JokerMetricsStrip** — compact Joker stats bar
6. **ActiveOutlays** — Finance outlays widget (fills remaining vertical space)

All sections use Framer Motion `containerVariants` / `itemVariants` with stagger animations on mount.

---

### AgentLeaderboard

**File:** `components/AgentLeaderboard.tsx`

5-column grid per agent:

| Col | Header | Data | Color |
|---|---|---|---|
| 1 | — | Gold ring progress icon (today completed / assigned ratio) + Crown for rank 1 | Gold |
| 2 | Genies | Agent name | Champagne |
| 3 | Today | `completedToday / assignedToday` | Green / white |
| 4 | Monthly | `completedThisMonth / assignedThisMonth` | Gold for rank 1, grey for others |
| 5 | Pending | `pendingScore / overdueCount` | Red / red glow for overdue |

**Animations:**
- On any stat change: gold shimmer sweep effect (`surgeKey`)
- When `celebrationAgent` matches the row: continuous gold shimmer (`isWinning`)
- `AnimatedValue` flashes emerald on increase for `tasksCompletedToday`

---

### ActiveOutlays — Finance Widget

**File:** `components/ActiveOutlays.tsx`

Subscribes directly to `finance_outlays` with a queendom filter. State management:

- **INSERT**: Add to top of list if `status === "pending"` and not already in list
- **UPDATE to "paid"**: Mark row as `pending: false` (turns green), then schedule removal after `PAID_EXIT_MS = 2500ms`
- **UPDATE to "pending"**: Update row data in-place at same position
- **DELETE**: Cancel any pending removal timer, remove immediately

**Ledger display:** Vertical marquee scroll (CSS animation via `--onboarding-ledger-duration`). Rows duplicated for seamless loop. Respects `prefers-reduced-motion`.

**Capital Pending scorecard:** Sum of all pending amounts. Displays as `₹{n}k` when ≥ ₹1000, else `₹{n}` (rounded). Uses `AnimatedCounter` with `slideOnChange`.

---

### OnboardingPanel — Sales Team View

**File:** `components/OnboardingPanel.tsx`

Displays 3 elite agent cards (Amit, Samson, Meghana) + Live Conversion Ledger.

**Agent cards:**
- Portrait image: bundled local files for `amit`, `samson`, `meghana`; falls back to DiceBear avatars for unrecognized IDs
- 3 metrics per card: `Attempted (This Month)` | `Closures (Last 30 Days)` | `Leads (Today)`
- **Win shimmer:** When `totalConverted` increases for an agent, a card-win-shimmer CSS animation fires for 2100ms

**Live Conversion Ledger:**
- 4 columns: Client | Amount (formatted as ₹N L lakhs) | Date (day + month name) | Agent
- Max 15 rows; newest first
- Vertical marquee scroll (same CSS animation as ActiveOutlays)
- On Realtime INSERT: optimistically prepend to ledger state + dedup by id

**Agent name matching** (`onboardingAgentNameMatches`): Fuzzy match handles edge cases:
- Exact match (case-insensitive)
- First-name-only match (e.g. `"Amit"` matches `"Amit Agarwal"`)
- Slash-separated names (e.g. `"Samson/Neha"` → matches `"Samson"`)

---

### CelebrationOverlay

**File:** `components/CelebrationOverlay.tsx`

Full-screen celebration animation that fires when any agent's `tasksCompletedToday` increases. Triggered from `Dashboard.tsx` via `celebrationAgent` state:

```typescript
// Dashboard.tsx — celebration detection
useEffect(() => {
  const allCurrent = [...ananyshreeStats.agents, ...anishqaStats.agents];
  const prevMap = prevScoresRef.current;
  const isInitialSeed = prevMap.size === 0;
  let celebCandidate: string | null = null;

  if (!isInitialSeed) {
    for (const agent of allCurrent) {
      const prev = prevMap.get(agent.name) ?? 0;
      if (agent.tasksCompletedToday > prev) {
        celebCandidate = agent.name;
        break;
      }
    }
  }
  // First call seeds the map — no celebration fires on initial load
  // Only one celebration at a time (checked via celebrationAgent !== null)
}, [ananyshreeStats.agents, anishqaStats.agents]);
```

---

### AnimatedCounter

**File:** `components/AnimatedCounter.tsx`

Animates numeric values from 0 (or previous value) to the new value. Accepts `delay` (ms) and `slideOnChange` prop. Uses Framer Motion internally. Used for all large scorecard numbers on the TV.

---

### RecommendationTicker

**File:** `components/RecommendationTicker.tsx`

Horizontally scrolling ticker pinned to the bottom of the screen. Displays Joker recommendations as `{type} in {city}: {suggestion}`. Auto-scrolls continuously using CSS animation.

---

## 6. Environment Variables

| Variable | Used by | Required |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `lib/supabase.ts`, `lib/supabaseAdmin.ts` | Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `lib/supabase.ts` (browser client) | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | `lib/supabaseAdmin.ts` (server-side API routes only) | Yes |

The `supabaseAdmin` singleton is created with `auth: { persistSession: false, autoRefreshToken: false }` and stored in `globalThis.__supabaseAdmin__` to survive Next.js hot-reload without creating duplicate connections.

If `SUPABASE_SERVICE_ROLE_KEY` is missing or equals the placeholder string `"paste_your_service_role_key_here"`, `supabaseAdmin` is `null` and all API routes return `503`.

---

## 7. Agent & Joker Rosters

### Concierge Agent Rosters (`lib/agentRoster.ts`)

These names MUST exactly match the `agent_name` column in Supabase (case-insensitive matching is applied at runtime, but canonical casing should be maintained).

**ROSTER_ANANYSHREE:**
- Sanika Ahire
- Ragadh Shahul
- Aditya Sonde
- Shaurya Verma
- Poorti Gulati
- Anshika Eark
- Ajith Sajan
- Khushi Shah

**ROSTER_ANISHQA:**
- Sagar Ali
- Savio Francis Fernandes
- Pranav Gadekar
- Dhanush K
- Charlotte Dias
- Aniruddha Morajkar
- Rupali Chodankar
- Eeti Srinivsulu

### Joker Roster (`lib/agentRoster.ts`)

| Joker Name | Queendom |
|---|---|
| Lilian Albrecht | ananyshree |
| Anil Talluri | anishqa |

### Onboarding Sales Agents (`lib/onboardingAgents.ts`)

| Display Name | Zoho Full Name | Portrait File |
|---|---|---|
| Amit | amit agarwal | `onboarding-agents-images/amit-sir.png` |
| Samson | samson fernandes | `onboarding-agents-images/samson.png` |
| Meghana | meghana singh | `onboarding-agents-images/meghana.png` |

Card display order is fixed: Amit → Samson → Meghana.

---

## Appendix: Key Invariants

These are rules that, if violated, will cause silent incorrect metrics on the TV:

1. **IST timezone is non-negotiable.** All date comparisons use `istToday()` from `lib/istDate.ts`. Never use `new Date().toISOString().slice(0, 10)` for "today" — that is UTC, not IST.

2. **VOID_STATUSES are stripped before ALL math.** `spam` and `deleted` tickets must be filtered out in the very first step of every aggregation function. They must not count toward Received, Resolved, Pending, or any agent stat.

3. **TERMINAL_STATUSES are `{resolved, closed}` only.** `spam` and `deleted` are NOT terminal — they are void. Including them as terminal would cause deleted spam to count as "resolved."

4. **Cohort math is creation-date based.** "Resolved This Month" = created this month AND terminal status. Not "resolved_at is this month."

5. **`is_escalated` can only be set to `true` by the escalation-only webhook path.** The upsert path must never set `is_escalated: true` and must omit the field for active non-SLA-safe statuses.

6. **Freshdesk `created_at` timestamps are naive IST strings.** They must pass through `freshdeskTimestampToIsoUtcForDb()` before storage. Never store naive strings.

7. **Zoho lead deduplication is by `lead_id` primary key.** Once inserted, a lead is never updated. `first_touched_at` is immutable.

8. **Zoho deal deduplication is by partial unique index on `deal_id`.** The `23505` error code is the expected deduplication response — it is NOT an error condition.

9. **The browser `supabase` client (anon key) is used ONLY for Realtime subscriptions.** All data fetching goes through Next.js API routes which use `supabaseAdmin` (service role). The anon key is safe to expose to the browser; the service role key is NOT.

10. **Supabase browser client is a singleton.** It is instantiated once in `lib/supabase.ts` module scope. Never call `createClient` inside a React component or hook.
