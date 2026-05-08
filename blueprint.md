# Indulge Live Dashboard — Complete Blueprint

> **Comprehensive technical reference.** Every table column, component prop, function signature, and business rule is documented here. This file is the single source of truth for AI agents, developers, and auditors working on this codebase.
>
> Generated from a full read of all source files.  
> **Files scanned:** 69 TS/TSX sources (approx.) | **Migrations:** 17 | **API route handlers:** 12

---

## Table of Contents

1. [Project Overview & Architecture](#1-project-overview--architecture)
2. [Database Schema — Full Reference](#2-database-schema--full-reference)
3. [Routing Map](#3-routing-map)
4. [Components Reference](#4-components-reference)
5. [Design System](#5-design-system)
6. [Lib / Utilities Reference](#6-lib--utilities-reference)
7. [API Routes Deep Dive](#7-api-routes-deep-dive)
8. [State Management](#8-state-management)
9. [Business Logic Reference](#9-business-logic-reference)
10. [Third-Party Integrations](#10-third-party-integrations)
11. [Types & Interfaces Full Reference](#11-types--interfaces-full-reference)
12. [Agent & Joker Rosters](#12-agent--joker-rosters)
13. [Dependencies Reference](#13-dependencies-reference)
14. [Product Understanding](#14-product-understanding)
15. [Migrations Log](#15-migrations-log)
16. [Known Gaps & Observations](#16-known-gaps--observations)

---

## 1. Project Overview & Architecture

### What It Is

**Indulge Live Dashboard** is a 24/7 real-time TV/big-screen dashboard for an Indian luxury concierge agency called Indulge. It displays live metrics for two operational teams ("Queendoms") named **Ananyshree** and **Anishqa**, plus a **Revenue Dashboard** (Onboarding/Sales) panel. The dashboard runs fullscreen on an office TV and auto-rotates between the concierge view and the revenue view every 30 seconds.

### Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Framework | Next.js (App Router) | ^16.1.6 |
| UI Library | React | ^18 |
| Language | TypeScript | ^5 |
| Animations | Framer Motion | ^11.0.0 |
| Styling | Tailwind CSS | ^3.4.0 |
| Database | Supabase (PostgreSQL) | @supabase/supabase-js ^2.39.0 |
| CRM Integrations | Freshdesk, Zoho CRM | — |
| Package Manager | npm | — |
| Script Runner | tsx | ^4.7.0 |
| Icons | lucide-react | ^0.363.0 |
| Date Utils | date-fns | ^3.6.0 |
| CSV Parsing | csv-parser | ^3.0.0 |
| Env loading | dotenv | ^17.3.1 |

### Key Architecture Principles

1. **IST timezone is non-negotiable.** India Standard Time (UTC+05:30) drives all "today" and "this month" calculations. `lib/istDate.ts` is the single entry point for all date math.
2. **Cohort math.** "Resolved This Month" means tickets *created* this IST month whose status is terminal — not tickets resolved within the month. The cohort is anchored to `created_at`.
3. **Void tickets are invisible.** `spam` and `deleted` are VOID_STATUSES and are stripped before any aggregation — they never count toward Received, Resolved, Pending, or agent stats.
4. **Service role for all server-side reads.** Every API route uses `supabaseAdmin` (service role key). The browser anon key is used only for Realtime subscriptions.
5. **Both screens always mounted.** DashboardController never unmounts panels; only opacity and z-index change on rotation. This prevents flicker and keeps Realtime subscriptions alive.
6. **Realtime-first, polling as fallback.** All live data is pushed via `postgres_changes` subscriptions. Polling intervals (5 min for concierge, 5 min for onboarding) are safety nets only.

### Full File Tree

```
app/
  page.tsx, layout.tsx, globals.css
  api/
    tickets/, tickets/rows/, agents/, clients/, jokers/, jokers/recommendations/
    onboarding/, renewals-panel/
    webhooks/ freshdesk, zoho-leads, zoho-deals, zoho-calls/README.md (no route.ts)

components/
  Dashboard.tsx, DashboardController.tsx, QueendomPanel.tsx, TopBar.tsx, …
  leaderboard/   AgentLeaderboard, AgentRow, AgentIcon
  onboarding/    OnboardingLayout, DepartmentColumn, ConversionLedger, PerformanceLineGraph,
                 LeadStatusHealthBar, AgentVerticalBarChart, LeadVelocityChart, utils
  _unmounted/    ActiveOutlays, OutlayLedger, finance-utils, README
  skeletons/     OnboardingSkeleton, QueendomSkeleton
  ui/            ErrorBoundary, GlassPanel, SectionDivider, StatCard

hooks/
  useDashboardData, useCelebrationDetection, useOnboardingPanelData,
  useKeyboardControls, usePrefersReducedMotion

lib/
  supabase, supabaseAdmin, types, onboardingTypes, ticketAggregation,
  istDate (includes former istMonthBounds exports), agentRoster, onboardingAgents,
  specialDates, motionPresets, webhookAuth, webhookGuard, apiGuard,
  env, dataSources, widgetRegistry

types/index.ts
scripts/importTickets.ts
supabase/migrations/ (17 files)
onboarding-agents-images/*.webp
blueprint.md, design.md, CLAUDE.md — repo root docs
```

---

## 2. Database Schema — Full Reference

All tables are in the `public` schema. Service role bypasses RLS. Anon role gets SELECT only.

---

### Table: `tickets`

Primary source of truth for all concierge metrics. Populated exclusively via the Freshdesk webhook.

| Column | Type | Constraint | Description |
|---|---|---|---|
| `ticket_id` | `TEXT` | `PRIMARY KEY` | Freshdesk ticket ID |
| `status` | `TEXT` | `NOT NULL` | Current status string (open, resolved, closed, pending, spam, deleted, nudge client, ongoing delivery, invoice due, nudge vendor) |
| `queendom_name` | `TEXT` | `NOT NULL` | Freshdesk group name (matched via `.includes()` against ananyshree/anishqa) |
| `agent_name` | `TEXT` | nullable | Assigned agent full name |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT NOW()` | Ticket creation instant (UTC, converted from IST Freshdesk string on ingest) |
| `resolved_at` | `TIMESTAMPTZ` | nullable | Set when status = resolved/closed; cleared on re-open; never set for other statuses |
| `is_escalated` | `BOOLEAN` | `NOT NULL DEFAULT false` | SLA breach flag. Can ONLY be set to `true` by the escalation-only webhook path |
| `tags` | `JSONB` | `DEFAULT '{}'` | Custom metadata. `tags.joker_suggestion` = legacy Joker tracking |
| `is_incomplete` | `BOOLEAN` | `NOT NULL DEFAULT false` | Incomplete ticket flag (`20260508000000`); shown in AgentRow pending column |

**Realtime:** Part of `supabase_realtime` publication.

**Indexes:** On `ticket_id` PK only (no explicit secondary indexes in migrations).

**RLS:** Not explicitly defined — relies on service-role bypass. Anon can read via Realtime publication.

---

### Table: `clients`

Member counts per queendom.

| Column | Type | Notes |
|---|---|---|
| `group` | `TEXT` | Queendom name (matched via `.includes()` — e.g. "Team Ananyshree" → ananyshree) |
| `latest_subscription_status` | `TEXT` | `"Active"` or `"Expired"` (only Active rows fetched) |
| `latest_subscription_membership_type` | `TEXT` | `"Premium"`, `"Genie"`, `"Monthly Trial"`, `"Standard"` = paid; `"Celebrity"` = complimentary |

**Membership type sets:**
- Paid: `{premium, genie, monthly trial, standard}` (case-insensitive, spaces normalized)
- Celebrity: `"celebrity"` (case-insensitive)

---

### Table: `leads`

(Formerly `onboarding_lead_touches`, renamed in migration `20260425180000`)

One row per Zoho lead_id. Upserted on Zoho CRM lead create/update.

| Column | Type | Constraint | Description |
|---|---|---|---|
| `lead_id` | `TEXT` | `PRIMARY KEY` | Zoho lead ID — uniqueness enforced at PK |
| `agent_name` | `TEXT` | `NOT NULL` | Agent full name (normalized via normalizeZohoAgentName) |
| `latest_status` | `TEXT` | `NOT NULL` | Lead status from Zoho (Attempted, Qualified, In Discussion, Nurturing, New, Junk, Not Interested, etc.) |
| `lead_name` | `TEXT` | `NOT NULL DEFAULT ''` | Zoho Lead display name |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` | When lead was first received from Zoho (lead created in CRM) |
| `modified_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` | Last update from Zoho for this lead row |
| `business_vertical` | `TEXT` | `NOT NULL DEFAULT 'Indulge Global' CHECK (IN ('Indulge Global','Indulge Shop','Indulge House','Indulge Legacy'))` | Which Indulge revenue vertical this lead belongs to |

**Indexes:**
- `leads_agent_created_idx` on `(agent_name, created_at)`
- `leads_created_at_idx` on `(created_at DESC)`
- `leads_modified_at_idx` on `(modified_at DESC)`
- `leads_vertical_created_idx` on `(business_vertical, created_at DESC)`

**Realtime:** Added to `supabase_realtime` publication.

**RLS:** `leads_select_anon` (SELECT to anon), `leads_all_authenticated` (ALL to authenticated).

**Historical columns (dropped):** `first_touched_at`, `updated_at`, `intent`, `company` (removed in migrations 20260417, 20260424).

---

### Table: `deals`

(Formerly `onboarding_deals`, created in 20260424, renamed in 20260425)

One row per Zoho deal creation event. Deal-level new-sales tracking.

| Column | Type | Constraint | Description |
|---|---|---|---|
| `deal_id` | `TEXT` | `PRIMARY KEY` | Zoho CRM deal ID — deduplication key |
| `deal_name` | `TEXT` | `NOT NULL` | Deal/client name from Zoho |
| `agent_name` | `TEXT` | `NOT NULL` | Agent who owns the deal |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` | Deal creation time |

**Indexes:**
- `deals_created_at_idx` on `(created_at DESC)`
- `deals_agent_created_idx` on `(agent_name, created_at DESC)`

**Realtime:** Added to `supabase_realtime`.

**RLS:** `deals_select_anon` (SELECT), `deals_all_authenticated` (ALL).

**Deduplication:** PK violation on `deal_id` (error code `23505`) = silently ignored by webhook handler.

---

### Table: `onboarding_conversion_ledger`

Sales closure log. Populated by POST /api/webhooks/zoho-deals (in parallel with `deals`). Used for the scrolling Live Conversion Ledger UI and agent closure counts.

| Column | Type | Constraint | Description |
|---|---|---|---|
| `id` | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()` | PK |
| `client_name` | `TEXT` | `NOT NULL` | Client/lead name (from deal_name in Zoho payload) |
| `amount` | `NUMERIC(14,2)` | `NOT NULL` | Deal amount in INR |
| `agent_name` | `TEXT` | `NOT NULL` | Agent name (normalized) |
| `queendom_name` | `TEXT` | `NOT NULL DEFAULT ''` | Queendom assignment (always empty string — not inferred from deal) |
| `recorded_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` | Closure instant (used for "last 30 days" filter) |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` | Row creation time |
| `deal_id` | `TEXT` | nullable | Zoho deal ID for deduplication |

**Partial Unique Index:** `onboarding_conversion_ledger_deal_id_key` on `(deal_id) WHERE deal_id IS NOT NULL` — deduplication mechanism.

**Indexes:** `onboarding_conversion_ledger_recorded_at_idx` on `(recorded_at DESC)`

**Realtime:** Added to `supabase_realtime`.

**RLS:** `onboarding_conversion_ledger_select_anon` (SELECT), `onboarding_conversion_ledger_all_authenticated` (ALL).

---

### Table: `jokers`

Populated via Google Sheet sync. Drives Joker metrics and recommendation ticker.

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()` |
| `client_name` | `TEXT` | Client the suggestion was sent to |
| `city` | `TEXT` | City/location context |
| `date` | `DATE` | Suggestion date (used for IST-based today/this month filters) |
| `type` | `TEXT` | Category (restaurant, travel, hotel, etc.) |
| `suggestion` | `TEXT` | Raw suggestion text |
| `response` | `TEXT` | `"yes"` = accepted, `"no"` = rejected, anything else = pending |
| `queendom_name` | `TEXT` | Queendom this Joker belongs to |
| `joker_name` | `TEXT` | Full name of the Joker (matched against JOKER_ROSTER) |
| `created_at` | `TIMESTAMPTZ` | `DEFAULT now()` |

**Realtime:** Added to `supabase_realtime`.

**RLS:** `jokers_select_anon` (SELECT), `jokers_all_authenticated` (ALL).

---

### Table: `finance_outlays`

Live concierge expense tracking. Intended UI: `components/_unmounted/ActiveOutlays.tsx` (not mounted in `QueendomPanel`).

| Column | Type | Constraint | Description |
|---|---|---|---|
| `id` | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()` | PK |
| `client_name` | `TEXT` | nullable | Client name |
| `task` | `TEXT` | nullable | Task description |
| `amount` | `NUMERIC(14,2)` | `NOT NULL DEFAULT 0` | Amount in INR |
| `status` | `TEXT` | `NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid'))` | Payment status |
| `queendom_name` | `TEXT` | nullable | Which queendom this outlay belongs to |
| `created_at` | `TIMESTAMPTZ` | `DEFAULT now()` | Creation time |
| `updated_at` | `TIMESTAMPTZ` | `DEFAULT now()` | Last update time |

**Index:** `finance_outlays_queendom_status_idx` on `(queendom_name, status)`

**Realtime:** Added to `supabase_realtime`.

**RLS:** `finance_outlays_select_anon` (SELECT), `finance_outlays_all_authenticated` (ALL).

---

### Table: `renewals`

Client membership renewal tracking.

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()` |
| `client_name` | `TEXT` | Client name |
| `group` | `TEXT` | Queendom identifier (e.g. `ananyshree`, `anishqa`) |
| `queendom` | `TEXT` | Duplicate of `group`; both columns checked in code |
| `created_at` | `TIMESTAMPTZ` | `DEFAULT now()` — renewal date |

**Realtime:** Added to `supabase_realtime`.

**RLS:** `renewals_select_anon` (SELECT), `renewals_all_authenticated` (ALL).

---

### Table: `members`

New member assignment tracking.

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()` |
| `client_name` | `TEXT` | Client name |
| `group` | `TEXT` | Queendom identifier |
| `queendom` | `TEXT` | Duplicate of `group` |
| `created_at` | `TIMESTAMPTZ` | `DEFAULT now()` — assignment date |

**Realtime:** Added to `supabase_realtime`.

**RLS:** `members_select_anon` (SELECT), `members_all_authenticated` (ALL).

---

### Table: `onboarding_sales_agents` (optional)

Optional agent roster table. API falls back to `ONBOARDING_AGENT_CARDS` if this table is missing or empty.

| Column | Type | Notes |
|---|---|---|
| `id` | `TEXT` | PK / display identifier |
| `display_name` | `TEXT` | Canonical name (e.g. `"Amit"`, `"Samson"`) |
| `photo_url` | `TEXT` | Optional portrait URL |
| `sort_order` | `INTEGER` | Display order (ascending) |

---

### RLS Pattern (universal)

All tables follow:

```sql
-- Read-only for anon browser client (used for Realtime)
CREATE POLICY "{table}_select_anon" ON public.{table} FOR SELECT TO anon USING (true);

-- Full access for authenticated (admin tools, sync services)
CREATE POLICY "{table}_all_authenticated" ON public.{table} FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

-- Service role bypasses RLS entirely (all Next.js API routes)
```

---

## 3. Routing Map

### Pages

| Path | File | Description |
|---|---|---|
| `/` | `app/page.tsx` | Root page — renders `<Dashboard />` |

### API Routes

| Method | Path | File | Auth |
|---|---|---|---|
| GET | `/api/tickets` | `app/api/tickets/route.ts` | Service role |
| GET | `/api/tickets/rows` | `app/api/tickets/rows/route.ts` | Service role |
| GET | `/api/agents` | `app/api/agents/route.ts` | Service role |
| GET | `/api/clients` | `app/api/clients/route.ts` | Service role |
| GET | `/api/jokers` | `app/api/jokers/route.ts` | Service role |
| GET | `/api/jokers/recommendations` | `app/api/jokers/recommendations/route.ts` | Service role |
| GET | `/api/onboarding` | `app/api/onboarding/route.ts` | Service role |
| GET | `/api/renewals-panel` | `app/api/renewals-panel/route.ts` | Service role |
| POST | `/api/webhooks/freshdesk` | `app/api/webhooks/freshdesk/route.ts` | WEBHOOK_SECRET header |
| POST | `/api/webhooks/zoho-leads` | `app/api/webhooks/zoho-leads/route.ts` | WEBHOOK_SECRET header |
| POST | `/api/webhooks/zoho-deals` | `app/api/webhooks/zoho-deals/route.ts` | WEBHOOK_SECRET header |
| POST | `/api/webhooks/zoho-calls` | — | **Not implemented** — see `app/api/webhooks/zoho-calls/README.md` |

### Cache-Control

All GET API routes return `Cache-Control: no-store` (set in route handler headers or via `cache: "no-store"` fetch option).

---

## 4. Components Reference

---

### `components/Dashboard.tsx`

Pure composition shell. Uses `useDashboardData()` and `useCelebrationDetection()`, renders the full app tree.

**No own state.** All state is from hooks.

**Renders:** `TopBar` + `CelebrationOverlay` + `DashboardController` + `RecommendationTicker`, all wrapped in `ErrorBoundary`.

---

### `components/DashboardController.tsx`

**Props:**
```typescript
interface DashboardControllerProps {
  className?: string;
  ananyshreeStats: QueenStats;
  anishqaStats: QueenStats;
  renewalsAnanyshree: RenewalsPanelData;
  renewalsAnishqa: RenewalsPanelData;
  celebrationAgent: string | null;
  isInitialLoading: boolean;
}
```

**State:**
- `activeScreen: ActiveScreen` ("concierge" | "onboarding") — which screen is currently visible
- `isFrozen: boolean` — whether auto-rotation is paused

**Screen durations:**
```typescript
const SCREEN_DURATIONS_MS = { concierge: 30_000, onboarding: 30_000 };
```

**Key behaviors:**
- Both screens (`QueendomPanel` pair + `OnboardingLayout`) are **always mounted** — only `opacity` and `z-index` change
- `AnimatePresence` skeleton overlays fade out on initial load (exit 0.7s)
- Keyboard / PAUSE: delegated to `hooks/useKeyboardControls.ts` — `P` / `Space` / `Enter` / `NumpadEnter` / `MediaPlayPause` = freeze toggle (`capture: true`); `ArrowLeft` / `ArrowRight` = manual screen switch
- PAUSE/RESUME button: `min-width: 140px`, `min-height: 48px` (TV remote accuracy)
- Framer Motion crossfade: `duration: 1.5, ease: "easeInOut"`, z-index 10/0 swap

---

### `components/QueendomPanel.tsx`

**Props:**
```typescript
interface QueendomPanelProps {
  name: string;            // Queendom display name
  stats: QueenStats;
  side: "left" | "right";
  delay?: number;          // Stagger delay for mount animation
  celebrationAgent?: string | null;
  renewalsData?: RenewalsPanelData;
}
```

**Layout (top to bottom):**
1. `QueendomWingspanHeader` — name + member counts
2. 5-Metric Hero Row (5 inline `MetricBox` sub-components):
   - Resolved Today (emerald glow)
   - Received (Month) (champagne)
   - Resolved (Month) (green)
   - Pending (To Resolve) (red)
   - Spoiled / Joker Accepted (gold joker-box)
3. `RenewalsPanel`
4. Bottom card: `AgentLeaderboard` (left) + `SpecialDates` (right)
5. `JokerMetricsStrip` (bottom)

**Side effects:**
- `ResizeObserver` on leaderboard div → matches `SpecialDates` panel height
- Framer Motion `containerVariants` / `itemVariants` on mount

**Internal `MetricBox`:** Inline sub-component wrapping `AnimatedCounter` + label.

---

### `components/leaderboard/AgentLeaderboard.tsx`

**Props:**
```typescript
interface AgentLeaderboardProps {
  agents: AgentStats[];
  queendomDelay?: number;     // Base animation delay
  celebrationAgent?: string | null;
}
```

**Structure:** Sticky header row + `AgentRow` per agent. Uses `GRID_COLS` from `AgentRow.tsx` for consistent column alignment.

**Header columns:** (icon placeholder) | Genies | Today | Monthly | Pending

---

### `components/leaderboard/AgentRow.tsx`

**Exports:**
- `GRID_COLS: string` — responsive 5-column CSS grid template string (used by both header and rows)
- `AgentRow` (memo component)
- `AnimatedValue` (memo, internal use)

**AgentRow Props:**
```typescript
interface AgentRowProps {
  agent: AgentStats;
  index: number;          // 0-based rank
  totalAgents: number;
  baseDelay: number;      // ms delay for stagger animation
  isWinning: boolean;     // true when celebrationAgent matches this agent
}
```

**AnimatedValue Props:**
```typescript
interface AnimatedValueProps {
  value: number;
  className?: string;
  flashOnIncrease?: boolean;  // emerald flash animation on increase
}
```

**Column contents:**
1. `AgentIcon` with `pct = tasksCompletedToday / tasksAssignedToday`, crown for rank 0
2. Agent name (champagne)
3. `{tasksCompletedToday} / {tasksAssignedToday}` (green / white)
4. `{tasksCompletedThisMonth} / {tasksAssignedThisMonth}` (gold for rank 0, grey others)
5. `{pendingScore} / {overdueCount} / {incomplete}` (red / red glow for overdue)

**Surge flash:** Fires when `tasksCompletedToday` or `pendingScore` increases. Suppressed during first 1500ms after mount via a ref.

**Win shimmer:** Continuous gold sweep animation when `isWinning === true`.

---

### `components/leaderboard/AgentIcon.tsx`

**Props:**
```typescript
interface AgentIconProps {
  name: string;
  pct: number;       // 0–1, drives SVG ring fill
  animDelay: number; // ms
  showCrown?: boolean;
}
```

**SVG constants:**
- `RING_SIZE = 80`
- `RING_R = 32`
- `CIRCUMFERENCE = 2 * Math.PI * 32 ≈ 201.06`
- Stroke color: `#c9a84c` (gold)
- Crown via `lucide-react Crown` icon, absolute top-right

---

### `components/onboarding/OnboardingLayout.tsx`

**Client component.** Calls `useOnboardingPanelData()` and composes the full Revenue Dashboard (no separate `OnboardingPanel` wrapper).

**Layout:** 3-column CSS grid (`1fr 1fr 1.05fr` at `lg`):
- Column 1: `DepartmentColumn` (department=`"concierge"`, label=`"Onboarding"`)
- Column 2: Performance summary tiles (`leadMonthStats`) + `PerformanceLineGraph` + `ConversionLedger`
- Column 3: `DepartmentColumn` (department=`"shop"`, label=`"Shop"`)

**Performance panel (center top):** Four metric tiles from `leadMonthStats`:
| Tile | Value | Color |
|---|---|---|
| Leads | `leadMonthStats.leads` | `rgba(192,200,220,0.85)` |
| Attended | `leadMonthStats.attended` | `#6B8FFF` |
| Converted | `leadMonthStats.dealsClosedThisMonth` | `#FFB020` |
| Junk | `leadMonthStats.junk` | `rgba(248,113,113,0.55)` |

---

### `components/onboarding/DepartmentColumn.tsx`

**DepartmentColumn Props:**
```typescript
interface DepartmentColumnProps {
  department: Department;                            // "concierge" | "shop"
  label: string;                                     // "Onboarding" | "Shop"
  agents: OnboardingAgentRow[];
  shimmerStampByAgentId: Record<string, number>;    // non-zero = shimmer active
  prefersReducedMotion: boolean;
  leadStatusByAgent: LeadStatusByAgent;
}
```

**CompactAgentCard (internal memo):**
```typescript
interface CompactAgentCardProps {
  agent: OnboardingAgentRow;
  shimmerStamp: number;                             // 0 = no shimmer
  prefersReducedMotion: boolean;
  accentColor: string;
  accentGlow: string;
  breakdown: AgentLeadStatusBreakdown;
}
```

**Card layout:**
- Portrait image (40% height), then data panel below (60%)
- Portrait `objectFit`: `"contain"` for Katya and Vikram; `"cover"` for all others
- 3 metric tiles per card:
  - Leads (Month): `leadsThisMonth ?? leadsCreatedThisMonth`
  - Leads (Today): `leadsCreatedTodayIst`
  - Closures (Month): `closedLakhsThisMonth` formatted as ₹N L
- `LeadStatusHealthBar` pipeline bar below metrics

**ACCENTS map:**
```typescript
const ACCENTS = {
  concierge: { color: "rgba(212,175,55,1)", glow: "rgba(212,175,55,0.55)" },
  shop:      { color: "rgba(125,211,252,1)", glow: "rgba(125,211,252,0.55)" },
};
```

---

### `components/onboarding/ConversionLedger.tsx`

**Props:**
```typescript
interface ConversionLedgerProps {
  rows: OnboardingLedgerRow[];
  scrollDuration: string;     // e.g. "48s"
  prefersReducedMotion: boolean;
}
```

**Scroll mechanism:** `requestAnimationFrame`-based pixel translation (NOT CSS `@keyframes`).
- `dt` capped at 100ms to prevent jumps after tab blur
- `primaryH` (height of first content list) cached in a ref via `ResizeObserver`
- **On row prepend:** `posRef` compensates by one avg-row-height so visible content stays stationary
- **Seamless wrap:** When `posRef >= primaryH`, subtract `primaryH` — content list is duplicated for the loop

**Grid columns (3):** Client | Date | Agent

**Department-colored left border:**
- Gold (`#FFB020`) for `department === "concierge"` or `assignedTo` matching concierge agents
- Sky (`#7dd3fc`) for shop agents
- Default dim white for unknown

**Date format:** `en-GB` locale, IST timezone, `{day} {3-letter month}` (e.g. "8 May")

---

### `components/onboarding/PerformanceLineGraph.tsx`

**Props:**
```typescript
interface PerformanceLineGraphProps {
  data: VerticalTrendPoint[];   // One entry per calendar day of current IST month
  pulseEvents?: PulseEvent[];
  todayDate?: string;           // "YYYY-MM-DD" IST — lines stop here; inferred if omitted
}

interface PulseEvent {
  id: string;
  team: "onboarding" | "shop";
}
```

**SVG coordinate system:**
- `VB_W = 460`, `VB_H = 248`
- Margins: `ML=36, MT=26, MR=12, MB=26`
- `CHART_W = 412`, `CHART_H = 196`, `BOTTOM = 222`

**Four vertical lines:**
```typescript
const VERTICAL_COLORS = {
  "Indulge Global": { line: "#6B8FFF", ring: "#5A7FFF", label: "Global" },
  "Indulge Shop":   { line: "#FFB020", ring: "#E09A30", label: "Shop"   },
  "Indulge House":  { line: "#34D399", ring: "#22C585", label: "House"  },
  "Indulge Legacy": { line: "#C084FC", ring: "#A855F7", label: "Legacy" },
};
```

**Curve algorithm:** Catmull-Rom spline with tension `T = 0.35`.

**Event burst system:** On `PulseEvent`, fires at terminal dot:
- Line surge glow (`plg-surge`, 0.9s)
- Bloom corona circle (2.0s)
- 2× expanding rings (`plg-ring-b`, 1.1s)
- Spark dot (`plg-spark-b`, 0.55s)
- 6 stardust particles at 60° intervals (`plg-dust-0..5`, 1.15s)

**Pulse → vertical mapping:** `"onboarding"` → `"Indulge Global"`, `"shop"` → `"Indulge Shop"`

**Draw-in animation:** `pathLength: 0→1` with 0.12s stagger per line. Gate: 1700ms delay, then transitions to `motion.path` with `animate={{d}}` for live updates.

**Toggle:** Button (top-right, 24×24px) switches between today-only labels and all-points labels.

---

### `components/onboarding/LeadStatusHealthBar.tsx`

**Props:**
```typescript
interface LeadStatusHealthBarProps {
  breakdown: AgentLeadStatusBreakdown;
  className?: string;
}
```

**Status colors:**
```typescript
export const STATUS_COLORS: Record<ZohoLeadStatus, { gradient, flat, glow, label, short, order }> = {
  Qualified:      { flat: "#06b6d4", order: 0 },  // teal/cyan
  "In Discussion": { flat: "#22c55e", order: 1 }, // green
  Nurturing:      { flat: "#a855f7", order: 2 },  // purple
  Attempted:      { flat: "#eab308", order: 3 },  // yellow
  New:            { flat: "#94a3b8", order: 4 },  // slate
  Junk:           { flat: "#ef4444", order: 5 },  // red
};
```

**Bar:** Segmented horizontal bar. Each segment is an absolutely-positioned div with `left: {cumulativePct}%`, `width: {pct}%`. Width transitions to 0 on unmount (reduced motion: instant).

**Legend:** Row of pills below the bar, one per non-zero status. Each pill shows glowing dot + status name + count.

**Empty state:** Shimmering foil placeholder (foil-shimmer keyframe if not reduced motion).

**Sub-components:** `PipelineLabel` (centered "Pipeline" heading), `SegmentGaps` (2px black dividers), `GlossSweep` (stub, returns null), `BreathingGlow` (stub, returns null).

---

### `components/_unmounted/ActiveOutlays.tsx`

**Not mounted in production** (`QueendomPanel` does not import it). See `lib/widgetRegistry.ts` (`finance-outlays.mounted: false`).

**Props:**
```typescript
interface ActiveOutlaysProps {
  queendomId: QueendomId;    // "ananyshree" | "anishqa"
  delayMs?: number;
  fillRemaining?: boolean;
}
```

**State:** `outlays: DisplayOutlay[]`, removal timers as `Map<string, NodeJS.Timeout>`

**Initial fetch:** `finance_outlays` where `status = "pending"`, ordered by `created_at DESC`

**Realtime channel:** `finance-outlays-{queendomId}`, filter `queendom_name=eq.{queendomId}`

**Realtime behavior per event type:**
| Event | Condition | Action |
|---|---|---|
| INSERT | status = "pending" AND not duplicate | Prepend to outlays list |
| UPDATE | status changed to "paid" | Mark `pending: false` → schedule removal after `PAID_EXIT_MS = 2500ms` |
| UPDATE | status = "pending" | Update row data in-place at same position |
| DELETE | any | Cancel pending removal timer → remove immediately |

**Derived:** `totalFloating` (sum of all pending amounts), `capitalPendingDisplay` (₹Nk when ≥1000, else ₹N, rounded), `ledgerScrollDuration`

---

### `components/_unmounted/OutlayLedger.tsx`

**Props:**
```typescript
interface OutlayLedgerProps {
  outlays: DisplayOutlay[];
  scrollDuration: string;
  prefersReducedMotion: boolean;
}
```

**Scroll:** CSS animation `onboarding-ledger-track` with `--onboarding-ledger-duration` CSS var. Rows duplicated for seamless loop. Paid rows show emerald background. 3-column grid: Client | Task | Amount.

---

### `components/JokerMetricsStrip.tsx`

**Props:**
```typescript
interface JokerMetricsStripProps {
  jokerName: string;
  joker: JokerStats;
  baseDelayMs: number;
  compact?: boolean;
}
```

**3 metrics displayed:**
- Recommendations: `uniqueSuggestionsCount`
- Responses: `{acceptedCount (yesCount)} / {totalSent (totalRows)}`
- Acceptance Rate: `acceptedCount / (acceptedCount + rejectedCount) * 100`%

---

### `components/RecommendationTicker.tsx`

**Props:**
```typescript
interface RecommendationTickerProps {
  recommendations: JokerRecommendationItem[];
}
```

**Behavior:** List tripled for seamless horizontal scroll. `TICKER_DURATION_S = 40`. Hover to pause. CSS animation `ticker-scroll`. Mask-image fade at left/right edges. Each item: `{TYPE_ICON} {type} in {city}: {suggestion}`.

---

### `components/RenewalsPanel.tsx`

**Props:**
```typescript
interface RenewalsPanelProps {
  data: RenewalsPanelData;
  delay?: number;
}
```

**No internal fetching.** Pure presentational. 3 sections: counter (`totalRenewalsThisMonth`), renewals list (latest 2), assignments list (latest 2).

---

### `components/CelebrationOverlay.tsx`

**Props:**
```typescript
interface CelebrationOverlayProps {
  agentName: string | null;
  onComplete: () => void;
}
```

**Key behaviors:**
- Renders null when `agentName === null`
- `playSuccessSound()`: Web Audio API — 3 sine-wave chimes at 523.25 Hz, 659.25 Hz, 783.99 Hz. Stagger: 0.13s each. Decay: 0.7s. Master gain: 0.14.
- Auto-dismiss after 3000ms via `setTimeout`
- 12 gold dust particles radially burst outward
- `luxurySpring`: `{ stiffness: 80, damping: 15, mass: 1.2 }`
- Backdrop: radial gradient, 94% black at edges

---

### `components/SpecialDates.tsx`

**Props:**
```typescript
interface SpecialDatesProps {
  queendomId: "ananyshree" | "anishqa";
}
```

**Behavior:** Reads from `lib/specialDates.ts` (static data). Filters to current IST month, excludes past dates, sorted by date ascending. Midnight timeout re-triggers computation for new day. `AnimatePresence` with spring `{ stiffness: 300, damping: 25 }`. Today-card has gold border + Gift icon; anniversary card has rose Heart icon.

---

### `components/TopBar.tsx`

**State:** `now: Date | null` (updated every 1 second via `setInterval`)

**Layout:**
- Left: Long date format (e.g. "Thursday, 8 May 2026")
- Center: "Indulge Global" in Cinzel font with `queen-name-glow`
- Right: Time HH:MM:SS + "Live" badge

---

### `components/AnimatedCounter.tsx`

**Props:**
```typescript
interface AnimatedCounterProps {
  value?: number | null;
  className?: string;
  delay?: number;            // ms, default 600
  slideOnChange?: boolean;   // y: ±10 slide on change
}
```

**Spring:** `{ stiffness: 35, damping: 18, mass: 1.8 }`

First render: uses `delay` prop. Subsequent renders: `delay = 0`. `slideOnChange` mode uses `AnimatePresence` with y slide animation.

---

### `components/QueendomWingspanHeader.tsx`

**Props:**
```typescript
interface QueendomWingspanHeaderProps {
  name: string;
  membersTotal: number;
  complimentaryCount: number;
  delayMs: number;
}
```

**Layout:** 3-column grid. Left: `MetricPill` (Paid count, gold). Center: queendom name (Cinzel, `queen-name-glow`). Right: `MetricPill` (Celebrity count, white).

---

### `components/ui/ErrorBoundary.tsx`

**Props:**
```typescript
interface ErrorBoundaryProps {
  children: ReactNode;
  label?: string;        // shown as "◈  {LABEL}  OFFLINE  ◈", default "SERVICE"
  fallback?: ReactNode;  // custom fallback — overrides default offline panel
  fillParent?: boolean;  // flex-1 h-full when true
}
```

React class component. `getDerivedStateFromError` captures error message. `componentDidCatch` logs to console only. `handleRetry` resets state. Default offline panel: obsidian background, near-invisible gold border, muted heading, RETRY button.

---

### `components/ui/GlassPanel.tsx`

**Props:**
```typescript
interface GlassPanelProps {
  children?: ReactNode;
  variant?: "glass" | "card" | "elevated";  // default "glass"
  radius?: "card" | "panel" | "none";       // default "card"
  glow?: boolean;                           // adds gold-border-glow inset ring
  overlay?: boolean;                        // absolute card-gradient-overlay child
  shadow?: "none" | "sm" | "md" | "lg";     // default "none"
  className?: string;
  style?: CSSProperties;
}
```

**`forwardRef` component.** Maps variant to CSS surface variable, radius to `--radius-*` CSS var, shadow to `shadow-gold-*` Tailwind class.

---

### `components/ui/SectionDivider.tsx`

**Props:**
```typescript
interface SectionDividerProps {
  label?: ReactNode;                           // if omitted = plain rule
  accent?: "gold" | "champagne" | "amber";    // default "gold"
  labelClass?: string;                         // extra classes on label element
  labelStyle?: CSSProperties;
  className?: string;
}
```

Two variants:
- **Plain rule** (no label): `<div className="w-full separator-gold-h h-px" />`
- **Titled rule** (with label): Label flanked by two `RuleArm` gradient lines. Right arm uses `scale-x-[-1]` CSS transform.

---

### `components/ui/StatCard.tsx`

**Props:**
```typescript
interface StatCardProps {
  label: ReactNode;
  children: ReactNode;        // metric value slot (AnimatedCounter or any node)
  accent?: StatCardAccent;    // default "champagne"
  className?: string;
  style?: CSSProperties;
}

type StatCardAccent = "champagne" | "emerald" | "red" | "amber" | "sky" | "gold";
```

**Surface:** `bg-surface-inset rounded-card border border-gold-500/20 shadow-[inset...]`

---

### Skeleton Components

**`OnboardingSkeleton`** (default export):
- Mirrors exact 3-column grid of `OnboardingLayout`
- Uses `.skeleton-block` shimmer class
- Staggered `animationDelay` per block
- `SkDeptColumn` (heading + 3 agent cards) and `SkCenterColumn` (performance + ledger) sub-components

**`QueendomSkeleton` (props: `{ side: "left" | "right" }`):**
- `side` selects `ambient-glow-left` or `ambient-glow-right` CSS class
- Mirrors: header (3-col wingspan) + hero row (5 tiles) + renewals + bottom card (leaderboard + special dates + joker strip)

---

## 5. Design System

### Color Palette (from `tailwind.config.ts`)

**Custom colors:**
```
obsidian:     #050505 (bg-obsidian)
rosegold:     #C47451
liquid-gold:  oklch(0.82 0.12 85)
champagne:    #F7E7CE (bg-champagne / text-champagne)
```

**Gold scale (bg-gold-50 … bg-gold-900):**
```
50:  #FFFBEB
100: #FEF3C7
200: #FDE68A
300: #FCD34D
400: #D4AF37  ← primary gold (queen-name-glow uses this)
500: #C9A84C  ← ring / border gold
600: #B7950B
700: #9A7D0A
800: #7D6608
900: #614E06
```

**Charcoal scale (50–900):** Dark neutral tones.

**Surface tokens (CSS vars in globals.css):**
```
--surface-glass:    rgba(10,10,10,0.85)
--surface-card:     rgba(10,10,10,0.92)
--surface-elevated: rgba(15,15,20,0.85)
--surface-inset:    rgba(0,0,0,0.50)
```

**Status colors:**
```
--color-emerald: #34d399 (resolved, success)
--color-red:     #f87171 (pending, error)
--color-amber:   #fcd34d (warning, finance)
--color-sky:     #7dd3fc (leads, info / Shop department)
```

**Tailwind status classes:** `text-status-emerald`, `text-status-red`, `text-status-amber`, `text-status-sky`

### Font Families

```
cinzel:      'Cinzel', serif (headings, queendom names, luxury labels)
inter:       'Inter', sans-serif (body, metrics, labels)
edu:         custom (decorative)
baskerville: 'Libre Baskerville', serif (editorial)
montserrat:  'Montserrat', sans-serif (alternative sans)
```

### Typography Scale (from `globals.css`, all fluid clamp)

```
--counter-hero:     clamp(3rem, min(7vmin,8vh), 9rem)
--text-heading-xl:  clamp(1.75rem, 3.5vw, 5rem)
--text-heading-lg:  clamp(1.35rem, 2.7vw, 3.9rem)
--text-heading-md:  clamp(1.1rem, 2.2vw, 3rem)
--text-label-xl:    clamp(1.35rem, 2.7vw, 3.9rem)
--text-label-lg:    clamp(1rem, 2vw, 2.8rem)
--text-label-md:    clamp(0.75rem, 1.5vw, 2.1rem)
--text-label-sm:    clamp(0.65rem, 1.2vw, 1.7rem)
```

**Root font-size:** Fluid clamp from 100% at 1280px to 125% at 1920px (TV scaling).

### Custom CSS Utility Classes (from `globals.css`)

```
.glass               — bg-surface-glass + 1px gold border at 18%
.glass-pill          — glass + rounded-full
.queen-name-glow     — text-gold-400 with glow filter
.sky-name-glow       — text-sky-400 with glow filter
.gold-glow           — generic gold text glow
.emerald-glow-hero   — emerald text with large glow
.joker-box           — gold gradient surface for Joker metric
.error-overdue-glow  — red glow for overdue agents
.celebration-backdrop — radial gradient celebration overlay
.row-win-shimmer     — row-level gold shimmer sweep
.card-win-shimmer    — card-level gold shimmer sweep
.ob-metric-flash     — metric pulse animation
.skeleton-block      — shimmer loading placeholder (hot-pulse keyframe)
.ambient-glow-center — centered gold radial glow (onboarding screen)
.ambient-glow-left   — left-side gold radial glow (ananyshree)
.ambient-glow-right  — right-side gold radial glow (anishqa)
.separator-gold-h    — 1px horizontal gold gradient rule
```

### Custom Keyframes (defined in `globals.css`)

| Name | Purpose |
|---|---|
| `ticker-scroll` | Horizontal ticker loop |
| `gold-sweep` | Left-to-right gold shimmer |
| `row-shimmer` | Per-row shimmer sweep |
| `foil-shimmer` | Foil metallic sweep (empty health bar) |
| `hot-pulse` | Skeleton loading pulse |
| `healthbar-pulse` | Health bar breathing |
| `bar-gloss-sweep` | Gloss highlight across bar |
| `bar-glow-breathe` | Outer bar glow breathing |
| `ob-metric-pulse` | Onboarding metric flash |

**PerformanceLineGraph keyframes (injected inline via `<style>`):**
`plg-ring`, `plg-surge`, `plg-aura`, `plg-ring-b`, `plg-spark-b`, `plg-dust-0..5`

### Border Radius Tokens

```
--radius-card:  1rem   (rounded-card)
--radius-panel: 1.5rem (rounded-panel)
--radius-pill:  9999px (rounded-full)
```

### Custom Tailwind Extensions

**`fontSize`:** 7xl (4.5rem), 8xl (6rem), 9xl (8rem)

**`boxShadow`:** `shadow-gold-sm`, `shadow-gold-md`, `shadow-gold-lg` (ambient gold glow levels)

**Custom keyframes registered in Tailwind config:** `pulse-ring`, `aura-pulse`, `halo-breathe`, `escalation-breathe`, `gold-pulse`, `text-shimmer`

---

## 6. Lib / Utilities Reference

---

### `lib/supabase.ts`

```typescript
// Browser singleton — anon key only
// Returns null if NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY is missing
let _client: SupabaseClient | null = null;
export const supabase: SupabaseClient | null = /* lazy init */;
```

**IMPORTANT:** Use ONLY for Realtime subscriptions in the browser. Never for data fetching.

---

### `lib/supabaseAdmin.ts`

```typescript
// Server-side service-role singleton
// Stored in globalThis.__supabaseAdmin__ to survive Next.js hot reload
// Returns null if SUPABASE_SERVICE_ROLE_KEY is missing or equals "paste_your_service_role_key_here"
export const supabaseAdmin: SupabaseClient | null;

// Convenience helper for API routes
export function requireSupabaseAdminOr503(): { db: SupabaseClient; response: null } | { db: null; response: NextResponse }
```

**Options:** `auth: { persistSession: false, autoRefreshToken: false }`

---

### `lib/istDate.ts`

IST parsing, `istToday()`, Zoho CRM timestamp normalization, **and** calendar bounds (`getCurrentIstMonthUtcBounds`, `getCurrentIstDayUtcBounds`, `getLast30DaysUtcBounds`, `recordedAtToMillis`, etc.). The standalone file `lib/istMonthBounds.ts` was removed — everything merged here.

**Constants:**
```typescript
const IST_OFFSET = "+05:30";
const IST_FORMATTER = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", /* date parts */ });
```

**Functions:**

```typescript
function istToday(): { day: "YYYY-MM-DD"; month: "YYYY-MM" }
// Returns current IST calendar date and month using Intl.DateTimeFormat

function utcMillisFromDbTimestamp(ts: string): number | null
// 5-rule timestamp parsing:
// Rule 1: "YYYY-MM-DD" (date-only) → treat as IST midnight (append T00:00:00+05:30)
// Rule 2: "YYYY-MM-DD HH:..." (space, no zone) → IST wall time (replace space with T, append +05:30)
// Rule 3: Has "T" but no zone → IST wall time (append +05:30)
// Rule 4: Has "Z" or explicit offset → use as-is
// Rule 5: Short offset "+HH" (no colon) → normalize to "+HH:00"

function timestampStringToIsoUtcForDb(ts: string): string
// Alias: freshdeskTimestampToIsoUtcForDb(ts: string): string
// Parse via utcMillisFromDbTimestamp → return new Date(ms).toISOString() (always ends in Z)

function toISTDay(ts: string): string | null
// Returns "YYYY-MM-DD" IST for a given timestamp string

function toISTMonth(ts: string): string | null
// Returns "YYYY-MM" IST for a given timestamp string

function getCurrentIstMonthUtcBounds(): { startUtcIso: string; endExclusiveUtcIso: string }
// Start = first instant of current IST calendar month as UTC ISO
// End = first instant of next IST calendar month as UTC ISO (exclusive)

function getCurrentIstDayUtcBounds(): { startUtcIso: string; endExclusiveUtcIso: string }
// Same pattern for today

function getLast30DaysUtcBounds(): { startUtcIso: string; endUtcIso: string }
// Rolling 30×24h window (ledger scorecard) — end key is `endUtcIso`, not endExclusive

function recordedAtToMillis(raw: string | null | undefined): number | null
// Parses recorded_at — TIMESTAMPTZ or date-only "YYYY-MM-DD" (IST midnight)

function isRecordedAtInInclusiveRange(raw: string | null | undefined, startIso: string, endIso: string): boolean
// Inclusive [start, end] compare for ledger filters

function normalizeZohoCrmTimestampForIstDigits(s: string): string
// Strips trailing Z or +00:00 so IST-digit strings are not double-shifted

function utcMillisFromZohoCrmDbTimestamp(ts: string): number | null
function toISTDayFromZohoCrm(ts: string): string | null
```

---

### `lib/ticketAggregation.ts`

**Constants:**
```typescript
export const VOID_STATUSES = new Set(["spam", "deleted"]);
const TERMINAL_STATUSES = new Set(["resolved", "closed"]);
export const MAX_TICKET_ROWS_IN_DASHBOARD_STATE = 5000;
```

**Types:**
```typescript
interface TicketRowMinimal {
  id: string;
  status: string;
  queendom_name: string;
  agent_name: string | null;
  created_at: string;
  is_escalated: boolean;
  is_incomplete?: boolean;
  tags?: Record<string, unknown>;
}
```

**Functions:**

```typescript
function isVoid(status: string): boolean
// Returns true if status.toLowerCase() is in VOID_STATUSES

function aggregateTicketStats(rows: TicketRowMinimal[]): { ananyshree: TicketStats; anishqa: TicketStats }
// 1. Filter out void statuses (first step, always)
// 2. Deduplicate by id
// 3. For each unique non-void row: bucket by queendom (.includes() match)
// 4. Compute: totalReceived (this IST month), resolvedThisMonth (created this month AND terminal),
//    solvedToday (created today IST AND terminal), pendingToResolve (not terminal, NO date gate),
//    jokerSuggestion (tags.joker_suggestion truthy)

function aggregateAgentStats(rows: TicketRowMinimal[]): { ananyshree: Record<string, AgentLiveStats>; anishqa: Record<string, AgentLiveStats> }
// Per-agent stats: tasksAssignedToday, tasksCompletedToday, tasksCompletedThisMonth,
// tasksAssignedThisMonth, pendingScore (no date gate), overdueCount (is_escalated === true),
// incomplete (pending rows with is_incomplete === true)

function mergeAndRankAgents(rows: TicketRowMinimal[]): { ananyshree: AgentStats[]; anishqa: AgentStats[] }
// 1. Build zero-stats roster from ROSTER_ANANYSHREE / ROSTER_ANISHQA
// 2. Merge live stats (case-insensitive name match)
// 3. Sort: primary = tasksCompletedThisMonth (desc), secondary = tasksCompletedToday (desc)

function pruneTicketRowsForDashboardState(rows: TicketRowMinimal[]): TicketRowMinimal[]
// Filter to current IST month only → cap at MAX_TICKET_ROWS_IN_DASHBOARD_STATE newest by created_at
```

---

### `lib/agentRoster.ts`

```typescript
export const ROSTER_ANANYSHREE = [
  "Sanika Ahire", "Ragadh Shahul", "Aditya Sonde", "Shaurya Verma",
  "Poorti Gulati", "Anshika Eark", "Ajith Sajan", "Khushi Shah", "Palak Kataria"
]; // 9 agents

export const ROSTER_ANISHQA = [
  "Sagar Ali", "Savio Francis Fernandes", "Pranav Gadekar", "Dhanush K",
  "Charlotte Dias", "Ria Pujhari", "Rupali Chodankar", "Eeti Srinivsulu", "Ekta Nihalani"
]; // 9 agents

export const JOKER_ROSTER: Record<string, string> = {
  "Lilian Albrecht": "ananyshree",
  "Shruti Sharma":   "anishqa",
};

export function getJokerNameForQueendom(queendom: string): string | undefined
// Returns joker name for a queendom (reverse lookup on JOKER_ROSTER)

export function buildRoster(names: string[], queendom: string): AgentStats[]
// Returns array of AgentStats with all numeric fields zeroed
```

---

### `lib/onboardingAgents.ts`

**Agent rosters:**
```typescript
export const CONCIERGE_AGENT_DISPLAY_NAMES = ["Amit", "Meghana", "Samson", "Kaniisha"];
export const SHOP_AGENT_DISPLAY_NAMES = ["Vikram", "Katya", "Harsh"];
export const ALL_AGENT_DISPLAY_NAMES = [...CONCIERGE_AGENT_DISPLAY_NAMES, ...SHOP_AGENT_DISPLAY_NAMES];
```

**Card specs:**
```typescript
export const CONCIERGE_AGENT_CARDS = [
  { id: "amit",     name: "Amit"     },
  { id: "meghana",  name: "Meghana"  },
  { id: "samson",   name: "Samson"   },
  { id: "kaniisha", name: "Kaniisha" },
];

export const SHOP_AGENT_CARDS = [
  { id: "vikram", name: "Vikram" },
  { id: "katya",  name: "Katya"  },
  { id: "harsh",  name: "Harsh"  },
];
```

**Department mapping:**
```typescript
export const DEPARTMENT_BY_AGENT_KEY: Record<string, Department> = {
  amit: "concierge", samson: "concierge", meghana: "concierge",
  aniisha: "concierge", kaniisha: "concierge",
  vikram: "shop", katya: "shop", harsh: "shop",
};
```

**Functions:**

```typescript
function getAgentDepartment(agentName: string): Department
// First-token extraction (split on whitespace/slash/comma) → lowercase lookup in DEPARTMENT_BY_AGENT_KEY
// Falls back to "concierge" for unknown agents

function getDisplayAgentName(raw: string): string
// Converts full Zoho owner name to card's first-name display
// First token → case-insensitive match against ALL_AGENT_DISPLAY_NAMES
// Falls back to capitalized first token

function normalizeZohoAgentName(raw: string): string
// Trim + collapse internal spaces (preserves full name as received from Zoho)

function onboardingAgentNameMatches(cardDisplayName: string, storedAgentName: string): boolean
// 6-step fuzzy match:
// 1. stored === card (exact, case-insensitive)
// 2. stored === card first word
// 3. storedFirst (split on /,) === card
// 4. storedFirst === card first word
// 5. storedFirstWord === card
// 6. storedFirstWord === card first word
// 7. stored starts with "{card}/" or "{card} "
// 8. stored starts with "{cardFirst}/" or "{cardFirst} "
```

**Fallback agents:**
```typescript
export const CONCIERGE_FALLBACK_AGENTS: OnboardingAgentRow[]  // Zeroed stats
export const SHOP_FALLBACK_AGENTS: OnboardingAgentRow[]       // Zeroed stats
export const FALLBACK_AGENTS = CONCIERGE_FALLBACK_AGENTS      // Legacy alias
```

**Legacy aliases:** `ONBOARDING_AGENT_DISPLAY_NAMES = ALL_AGENT_DISPLAY_NAMES`, `ONBOARDING_AGENT_CARDS = CONCIERGE_AGENT_CARDS`

---

### `lib/motionPresets.ts`

```typescript
export const gpuStyle = { willChange: "transform, opacity", transform: "translateZ(0)" }

export const EASE_LUXURY = [0.25, 0.46, 0.45, 0.94] as const

export const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.14, delayChildren: 0.2 } }
}

export const itemVariants = {
  hidden: { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: EASE_LUXURY } }
}

export const crossfadeTransition = { duration: 1.5, ease: "easeInOut" }

export function widgetFadeIn(delayMs: number): VariantDefinition
// Fade in with upward slide, delay in ms converted to seconds

export const rowVariants  // Fade up 18px with custom delay
export const surgeBgVariants
export const surgeSweepVariants
export const surgeSweepBarVariants
export const winShimmerBarVariants
```

---

### `lib/webhookAuth.ts`

```typescript
export function assertWebhookSecret(req: Request): Response | null
// Checks "x-webhook-secret" header or "Authorization: Bearer {token}" against WEBHOOK_SECRET env var
// Returns 401 Response if secret is set AND does not match
// Returns null (pass) if secret is unset (fail-open) OR if it matches
```

---

### `lib/specialDates.ts`

```typescript
interface SpecialDateRaw {
  clientName: string;
  month: number;   // 1-12
  day: number;
  type: "birthday" | "anniversary";
  queendom: "ananyshree" | "anishqa";
}

export function getSpecialDates(): SpecialDate[]
// Maps SPECIAL_DATES_RAW to SpecialDate[] using current calendar year
// SpecialDate: { id, clientName, date: "YYYY-MM-DD", type, queendom }
```

---

### `components/onboarding/utils.ts`

**Typography constants (fluid clamp strings):**
```typescript
export const ONBOARDING_PAGE_TITLE_FONT   // Page heading
export const ONBOARDING_LEDGER_TITLE_FONT // Ledger section heading
export const ONBOARDING_LEDGER_HEADER_FONT
export const ONBOARDING_LEDGER_CELL_FONT
export const COMPACT_AGENT_METRIC_VALUE_FONT
export const COMPACT_AGENT_METRIC_LABEL_FONT
export const COMPACT_AGENT_NAME_FONT
export const DEPT_HEADING_FONT
```

**Constants:**
```typescript
export const LIVE_LEDGER_MAX = 15
```

**Ordering functions:**
```typescript
export function orderConciergeAgentsForDisplay(agents: OnboardingAgentRow[]): OnboardingAgentRow[]
// Orders to match CONCIERGE_AGENT_CARDS fixed display order

export function orderShopAgentsForDisplay(agents: OnboardingAgentRow[]): OnboardingAgentRow[]
// Orders to match SHOP_AGENT_CARDS fixed display order
```

**Formatters:**
```typescript
export function formatAmountLakh(amountInr: number): string
// Formats INR to lakh string: "₹{n}L" or "₹{n.n}L"

export function formatLakhsDisplay(closedLakhsThisMonth: number): string
// Formats lakh value for agent card: "₹{n}L"

export function formatLedgerDate(recordedAt: string): string
// Parses recordedAt (TIMESTAMPTZ or date) → en-GB IST format: "8 May"
```

**Ledger utilities:**
```typescript
export function sortLedgerNewestFirst(rows: OnboardingLedgerRow[]): OnboardingLedgerRow[]

export function ledgerRowFromInsertPayload(raw: Record<string, unknown>): OnboardingLedgerRow | null
// Maps Supabase Realtime INSERT payload to OnboardingLedgerRow
// Handles both old (deal_id/client_name) and new (deal_id) field names
// Handles both recorded_at and created_at column names
```

**Portrait resolver:**
```typescript
// Bundled .webp images imported at module top for: amit, samson, meghana, kaniisha, vikram, katya, harsh
// Falls back to DiceBear avatar URL for unrecognized agent IDs
export function getPortraitSrc(agentId: string): string
```

---

### `components/_unmounted/finance-utils.ts`

```typescript
export const PAID_EXIT_MS = 2500   // ms before paid row is removed from UI
export const MAX_OUTLAYS = 10      // max rows in outlays display

export function parseAmount(raw: unknown): number
// Strips commas, parses as float, returns 0 on failure

export function rowToDisplay(raw: Record<string, unknown>, pending: boolean): DisplayOutlay | null
// Maps raw Supabase row to DisplayOutlay; returns null if id is missing
```

---

## 7. API Routes Deep Dive

---

### GET `/api/tickets`

**File:** `app/api/tickets/route.ts`

1. `requireSupabaseAdminOr503()` — returns 503 if admin client unavailable
2. Fetch `tickets` table: SELECT `status, queendom_name, created_at, tags` in 1000-row pagination
3. Fallback retry without `tags` column if first query errors
4. Run `aggregateTicketStats()` in JavaScript
5. Return `{ ananyshree: TicketStats, anishqa: TicketStats }` with `Cache-Control: no-store`

---

### GET `/api/tickets/rows`

**File:** `app/api/tickets/rows/route.ts`

1. `requireSupabaseAdminOr503()`
2. SELECT: `id:ticket_id, status, queendom_name, agent_name, created_at, is_escalated, is_incomplete, tags`
3. OR filter: `created_at >= IST month start (UTC)` OR `status NOT IN (resolved, Resolved, RESOLVED, closed, Closed, CLOSED)`
4. Paginated 1000/page
5. Fallback without `tags` column
6. Return raw rows array with `Cache-Control: no-store`

This dual-filter ensures old pending tickets from previous months are never dropped from state.

---

### GET `/api/agents`

**File:** `app/api/agents/route.ts`

Full table scan (paginated 1000/page). Aggregates per-agent stats by queendom. **Not called by Dashboard.tsx directly** — Dashboard derives agents from ticketRows client-side. Kept for standalone use.

---

### GET `/api/clients`

**File:** `app/api/clients/route.ts`

1. SELECT from `clients` where `latest_subscription_status = "Active"`
2. `PAID_MEMBERSHIP_TYPES = new Set(["premium", "genie", "monthly trial", "standard"])`
3. Aggregate per queendom (`.includes()` match against group column)
4. Return `{ ananyshree: MemberStats, anishqa: MemberStats }`

---

### GET `/api/jokers`

**File:** `app/api/jokers/route.ts`

1. Fetch all rows from `jokers` table
2. For each name in `JOKER_ROSTER`: filter rows by `joker_name`, compute:
   - `uniqueSuggestionsCount`: distinct `.toLowerCase().trim()` suggestion strings
   - `totalSent / totalSuggestions`: row count
   - `acceptedCount`: `response.toLowerCase() === "yes"`
   - `rejectedCount`: `response.toLowerCase() === "no"`
   - `pendingSuggestions`: neither yes nor no
   - `acceptedToday`: accepted rows where `date` in IST is today
   - `totalThisMonth`: rows where `date` in IST is this month (fallback to `created_at`)
3. Return `{ ananyshree: JokerStats, anishqa: JokerStats }`

---

### GET `/api/jokers/recommendations`

**File:** `app/api/jokers/recommendations/route.ts`

1. SELECT top 15 joker rows ordered by `created_at DESC`
2. Return `JokerRecommendationItem[]` (id, city, type, suggestion)

---

### GET `/api/onboarding`

**File:** `app/api/onboarding/route.ts`

This is the largest route. It assembles the full `OnboardingApiPayload`.

**Queries:**
1. `onboarding_sales_agents` — agent roster (falls back to `ALL_CANONICAL_CARDS` if table missing/empty)
2. `deals` — top 25 rows ordered by `created_at DESC` → builds ledger (`OnboardingLedgerRow[]`)
3. `leads` — paginated full fetch for current IST month window + selected columns including `latest_status`, `agent_name`, `created_at`, `business_vertical`, `lead_name`

**Computed from leads:**
- `leadStatusByAgent`: per-agent breakdown of ZohoLeadStatus counts
- `leadMonthStats`: `{ leads, attended, dealsClosedThisMonth, junk }` totals
- Closures per agent (from `deals`)
- Agent stats (6 agents total: 4 concierge + 3 shop)
- `leadTrendline` (LeadTrendPoint[]): daily counts by concierge/shop leads for current month
- `teamAttendedTrend` (TeamAttendedDay[]): daily attended counts by team
- `verticalTrendline` (VerticalTrendPoint[]): per-day counts for each of the 4 business verticals (full calendar month, up to today)

**Returns:** `OnboardingApiPayload` with `agents`, `ledger`, `departments`, `leadTrendline`, `teamAttendedTrend`, `verticalTrendline`, `leadMonthStats`, `leadStatusByAgent`

---

### GET `/api/renewals-panel`

**File:** `app/api/renewals-panel/route.ts`

**Query param:** `?queendom=ananyshree|anishqa`

1. `normalizeQueendom(raw)` — lowercase, trim (does NOT use `.includes()` — strict equality on normalized value)
2. Fetch `renewals` table: filter by `group` column containing queendom identifier, order by `created_at DESC`
3. Fetch `members` table: same filter and order
4. `totalRenewalsThisMonth`: count of renewals where `created_at` IST month matches current
5. Return `{ totalRenewalsThisMonth, renewals: string[] (top 2), assignments: string[] (top 2) }`

---

### POST `/api/webhooks/freshdesk`

**File:** `app/api/webhooks/freshdesk/route.ts`

**Status classification sets:**
```typescript
const RESOLVED_STATUSES    = new Set(["resolved", "closed"]);
const SLA_SAFE_STATUSES    = new Set(["resolved", "closed", "nudge client", "ongoing delivery", "invoice due", "spam", "deleted"]);
const ACTIVE_CLEAR_RESOLVED_AT = new Set(["open", "pending", "nudge client", "nudge vendor", "ongoing delivery", "invoice due"]);
const VOID_STATUSES        = new Set(["spam", "deleted"]);
```

**3-path detection flow:**
```
Incoming POST
  → Raw body fix: regex replaces '"is_escalated": <empty>' with 'false'
  → Parse JSON
  → Extract ticket_id (tries: payload.ticket_id, payload.id, payload.ticket?.id)
  → Detect webhook_type (from webhook_type, event, or type field, lowercased)

  → Path 1: isDeletion (type ∈ {"deletion","delete","ticket_deleted"})
      UPDATE tickets SET status="deleted", is_escalated=false WHERE ticket_id=?

  → Path 2: isEscalatedPayload (is_escalated is boolean AND no status/queendom_name)
      Fetch existing status
      IF existing status ∈ SLA_SAFE_STATUSES → force is_escalated=false (ignore payload)
      ELSE → PATCH is_escalated to payload value
      ⚠️ THIS IS THE ONLY PATH THAT CAN SET is_escalated = true

  → Path 3: Full upsert (status + queendom_name present)
      Build row selectively:
        - agent_name: only if payload.agent_name !== undefined
        - created_at: only if freshdeskTimestampToIsoUtcForDb() returns non-null
        - resolved_at: set for RESOLVED_STATUSES; cleared for ACTIVE_CLEAR_RESOLVED_AT; not touched for others
        - is_escalated:
            • RESOLVED_STATUSES or VOID_STATUSES → false
            • SLA_SAFE active statuses → false
            • Active non-safe (open/pending) → OMIT (preserve DB value)
      UPSERT on conflict ticket_id
```

---

### POST `/api/webhooks/zoho-leads`

**File:** `app/api/webhooks/zoho-leads/route.ts`

1. Accepts `application/json` OR `application/x-www-form-urlencoded`
2. Parses: `lead_id`, `agent_name`, `latest_status` (alias: `status`), `lead_name`, `business_vertical`, `created_at`, `modified_at`
3. Normalizes `agent_name` via `normalizeZohoAgentName()`
4. Validates `business_vertical` — defaults to `"Indulge Global"` if missing/invalid
5. Parses timestamps via `normalizeZohoCrmTimestampForIstDigits()` → `utcMillisFromZohoCrmDbTimestamp()`
6. **UPSERT** to `leads` table on conflict `lead_id`, updating `latest_status`, `lead_name`, `modified_at`, `business_vertical`
7. On error code `23505` (duplicate key): silently return `action: "ignored", reason: "duplicate_lead"` (fallback for race conditions)

**Note on status gate:** The webhook no longer has a strict "Attempted"-only gate. It upserts on any status — the `latest_status` column tracks the most recent status from Zoho.

---

### POST `/api/webhooks/zoho-deals`

**File:** `app/api/webhooks/zoho-deals/route.ts`

1. Accepts `application/json` OR `application/x-www-form-urlencoded`
2. Parses: `deal_id`, `agent_name`, `deal_name`, `created_at`
3. Normalizes `agent_name` via `normalizeZohoAgentName()`
4. Parses `created_at` timestamp
5. INSERT into `deals` table (PK: `deal_id`)
6. On error code `23505` (duplicate `deal_id`) → silently return `action: "ignored", reason: "duplicate_deal"`
7. Also inserts into `onboarding_conversion_ledger` for the scrolling ledger UI (if applicable)

---

## 8. State Management

### Root Data Hook: `hooks/useDashboardData.ts`

**Returns:**
```typescript
interface DashboardData {
  ananyshreeStats: QueenStats;
  anishqaStats: QueenStats;
  recommendations: JokerRecommendationItem[];
  renewalsAnanyshree: RenewalsPanelData;
  renewalsAnishqa: RenewalsPanelData;
  isInitialLoading: boolean;
}
```

**State owned:**
- `ticketRows: TicketRowMinimal[]` — raw ticket rows (max 5000, IST-month filtered)
- `ananyshreeStats: QueenStats` — derived from ticketRows via useEffect
- `anishqaStats: QueenStats`
- `recommendations: JokerRecommendationItem[]`
- `renewalsAnanyshree: RenewalsPanelData`
- `renewalsAnishqa: RenewalsPanelData`
- `isInitialLoading: boolean`

**Derived (via useEffect):** On every `ticketRows` change → `aggregateTicketStats()` + `mergeAndRankAgents()` → update queendom stats

**Initial load:** `Promise.all([fetchTicketRows, fetchMembers, fetchJokers, fetchRecommendations, fetchRenewals("ananyshree"), fetchRenewals("anishqa")])` → `setIsInitialLoading(false)`. 8-second safety timeout also sets loading false.

**Intervals:**
- 5-minute prune: `pruneTicketRowsForDashboardState()` on all ticketRows

**4 Realtime channels:**

| Channel | Table(s) | Events | Action |
|---|---|---|---|
| `dashboard-clients` | `clients` | `*` | `fetchMembers()` |
| `dashboard-jokers` | `jokers` | `*` | Optimistic patch recommendations + `fetchJokers()` |
| `dashboard-tickets` | `tickets` | `*` | Functional `setTicketRows` updates (see below) |
| `dashboard-renewals` | `renewals`, `members` | `INSERT` | `fetchRenewals("ananyshree")`, `fetchRenewals("anishqa")` |

**Tickets Realtime deduplication pattern:**
```typescript
// INSERT:
setTicketRows((prev) => {
  const i = prev.findIndex((r) => r.id === row.id);
  if (i >= 0) { const next = [...prev]; next[i] = row; return prune(next); }
  return prune([...prev, row]);
});
// UPDATE:
setTicketRows((prev) => prune(prev.map((r) => r.id === row.id ? row : r)));
// DELETE:
setTicketRows((prev) => prev.filter((r) => r.id !== oldRow.id));
```

**`toTicketRow(raw)`:** Normalizes both `id` and `ticket_id` column name variants.

---

### Celebration Detection Hook: `hooks/useCelebrationDetection.ts`

```typescript
function useCelebrationDetection(agentsA: AgentStats[], agentsB: AgentStats[]): {
  celebrationAgent: string | null;
  clearCelebration: () => void;
}
```

**Logic:** `prevScoresRef` Map seeded on first call (no celebration fires on initial load). On subsequent calls, scans all agents for `tasksCompletedToday > prevScore`. First match wins. `celebrationAgent` intentionally excluded from useEffect deps to prevent feedback loop.

---

### Onboarding Panel Data Hook: `hooks/useOnboardingPanelData.ts`

**Returns:** `UseOnboardingPanelDataResult`:
```typescript
interface UseOnboardingPanelDataResult {
  conciergeAgents: OnboardingAgentRow[];
  shopAgents: OnboardingAgentRow[];
  ledger: OnboardingLedgerRow[];
  pulseEvents: PulseEvent[];
  leadMonthStats: LeadMonthStats;
  verticalTrendline: VerticalTrendPoint[];
  ledgerScrollDuration: string;
  prefersReducedMotion: boolean;
  shimmerStampByAgentId: Record<string, number>;
  leadStatusByAgent: LeadStatusByAgent;
  todayDate: string;  // "YYYY-MM-DD" IST
}
```

**State owned:** `agents`, `ledger`, `pulseEvents`, `leadTrendline`, `leadStatusByAgent`, `teamAttendedTrend`, `verticalTrendline`, `leadMonthStats`, `deptStats`, `shimmerStampByAgentId`, `dealsReconnect`, `leadsReconnect`

**Load:** Fetches `/api/onboarding` on mount + every 5 minutes. `scheduleDebouncedLoad` has 2500ms debounce.

**2 Realtime channels:**

| Channel | Table | Events | Action |
|---|---|---|---|
| `deals-live` | `deals` | `*` | INSERT → optimistic prepend to ledger + `firePulse` + `scheduleDebouncedLoad` |
| `leads-touches-live` | `leads` | `*` | INSERT → `firePulse` + `scheduleDebouncedLoad` |

**Error recovery:** `CHANNEL_ERROR` or `TIMED_OUT` → `load()` + reconnect timer (3s, increments reconnect counter to force channel recreation)

**`firePulse(team)`:** Creates `PulseEvent` with unique id, adds to `pulseEvents`, removes after 2300ms

**shimmerStampByAgentId:** On `totalConverted` increase → sets timestamp, clears after 2100ms

**Derived:**
- `conciergeAgents` / `shopAgents`: from `deptStats` (preferred) or filtered from flat `agents` array
- `performanceData`: merges `leadTrendline` + `teamAttendedTrend` + ledger conversion counts per day
- `performanceTotals`: sums all `performanceData` — NOTE: these totals are computed but not currently surfaced in `UseOnboardingPanelDataResult` (internal use only for legacy code)
- `ledgerScrollDuration`: `Math.max(32, ledger.length * 6)` seconds

---

### `hooks/usePrefersReducedMotion.ts`

```typescript
function usePrefersReducedMotion(): boolean
// matchMedia("(prefers-reduced-motion: reduce)") with addEventListener cleanup
```

---

## 9. Business Logic Reference

### Ticket Metric Definitions (Cohort Math)

| Metric | Formula |
|---|---|
| **Received (This Month)** | `created_at` in current IST calendar month, non-void |
| **Resolved (This Month)** | `created_at` in current IST month AND `status ∈ {resolved, closed}` |
| **Solved Today** | `created_at` is today in IST AND `status ∈ {resolved, closed}` |
| **Pending (To Resolve)** | `status ∉ {resolved, closed}` — **no date gate** — includes all open tickets regardless of age |
| **Joker Suggestion** | `tags.joker_suggestion` is truthy |

**VOID tickets** (`spam`, `deleted`) are stripped **before any metric is computed**. They are invisible to all math.

**TERMINAL statuses** are `{resolved, closed}` only. `spam` and `deleted` are NOT terminal — they are void.

### IST Timezone Rule

Every "today" and "this month" comparison MUST use `istToday()` from `lib/istDate.ts`. Never use `new Date().toISOString().slice(0, 10)` — that is UTC, not IST. A ticket created at 23:45 IST is still IST-today even though it's already UTC tomorrow.

### Freshdesk Timestamp Rule

Freshdesk timestamps are naive IST strings (no timezone marker). They MUST pass through `freshdeskTimestampToIsoUtcForDb()` before storage. This function appends `+05:30` and converts to UTC ISO (ends in `Z`).

### Agent Ranking Sort

```
Primary:   tasksCompletedThisMonth (descending)
Secondary: tasksCompletedToday (descending)
```

### Zoho Lead Deduplication

Leads table PK is `lead_id`. The webhook upserts on conflict, updating `latest_status`, `lead_name`, `modified_at`, `business_vertical`. Row is never deleted. `created_at` is set only on first insert.

### Zoho Deal Deduplication

`deals` table PK is `deal_id`. Any duplicate `deal_id` causes a `23505` unique violation, which the webhook silently ignores. Same pattern for `onboarding_conversion_ledger` via partial unique index on `deal_id WHERE deal_id IS NOT NULL`.

### Queendom Name Matching

The `queendom_name` column from Freshdesk is matched using `.includes()` (substring, case-insensitive):
```
"Team Ananyshree"     → ananyshree bucket
"Ananyshree Concierge"→ ananyshree bucket
"anishqa"             → anishqa bucket
```

**Do not change to strict equality** — Freshdesk group names contain the queendom name as a substring.

### Memory Management

`pruneTicketRowsForDashboardState`:
1. Filter to current IST calendar month
2. Take newest 5000 by `created_at`

A `setInterval` re-prunes every 5 minutes. This handles IST month rollover without a page reload — old month tickets are gradually purged as the new month's tickets fill the state.

---

## 10. Third-Party Integrations

### Freshdesk

**Connection type:** Webhook push (Freshdesk Automation → POST to our endpoint)

**Endpoint:** `POST /api/webhooks/freshdesk`

**Auth:** `x-webhook-secret` or `Authorization: Bearer` header checked against `WEBHOOK_SECRET` env var. Fail-open if `WEBHOOK_SECRET` is unset.

**3 automation types:**
1. **Ticket creation/update (full upsert):** Sends `status`, `queendom_name`, optionally `agent_name`, `ticket_created_at`
2. **Ticket deletion:** Sends `webhook_type: "deletion"` or `"ticket_deleted"` — triggers soft-delete
3. **SLA escalation:** Sends `is_escalated: true/false` with no `status` field — ONLY this path can set `is_escalated = true`

**Critical quirk:** Freshdesk boolean placeholders sometimes stringify to empty string `""`. The raw body fix regex catches `"is_escalated": <empty>` patterns before JSON parse.

### Zoho CRM

**Connection type:** Webhook push (Zoho CRM Automation → POST to our endpoints)

**Endpoints:**
- `POST /api/webhooks/zoho-leads` — lead create/update events
- `POST /api/webhooks/zoho-deals` — deal creation events

**Content-Type:** Either `application/json` or `application/x-www-form-urlencoded` (Zoho sends either)

**Auth:** Same WEBHOOK_SECRET pattern as Freshdesk.

**Lead webhook payload fields:**
- `lead_id`: Zoho lead ID (string)
- `agent_name`: Zoho owner full name (e.g. "Amit Agarwal") — normalized to display name
- `latest_status` (alias: `status`): ZohoLeadStatus string
- `lead_name`: Lead's display name
- `business_vertical`: One of 4 verticals; defaults to "Indulge Global"
- `created_at`, `modified_at`: IST timestamps from Zoho

**Deal webhook payload fields:**
- `deal_id`: Zoho deal ID
- `agent_name`: Deal owner
- `deal_name`: Deal/client name
- `created_at`: Deal creation time from Zoho

**`zoho-calls/` directory:** Exists but is empty — no route.ts file present. Placeholder for future Zoho call webhook integration.

### Supabase Realtime

**Subscriptions active in production:**

| Component | Channel | Table | Filter |
|---|---|---|---|
| useDashboardData | `dashboard-tickets` | `tickets` | none |
| useDashboardData | `dashboard-clients` | `clients` | none |
| useDashboardData | `dashboard-jokers` | `jokers` | none |
| useDashboardData | `dashboard-renewals` | `renewals` + `members` | none |
| useOnboardingPanelData | `deals-live` | `deals` | none |
| useOnboardingPanelData | `leads-touches-live` | `leads` | none |
| ActiveOutlays | `finance-outlays-{queendomId}` | `finance_outlays` | `queendom_name=eq.{queendomId}` |

---

## 11. Types & Interfaces Full Reference

### `lib/types.ts`

```typescript
interface MemberStats {
  total: number;           // paid members (premium/genie/monthly trial/standard)
  celebrityActive: number; // celebrity/complimentary members
}

interface TicketStats {
  totalReceived: number;
  resolvedThisMonth: number;
  solvedToday: number;
  pendingToResolve: number;
  jokerSuggestion: number;
}

interface JokerStats {
  uniqueSuggestionsCount: number;
  totalSent: number;
  totalSuggestions: number;
  acceptedCount: number;
  rejectedCount: number;
  pendingSuggestions: number;
  acceptedToday: number;
  totalThisMonth: number;
}

interface AgentStats {
  id: string;
  name: string;
  queendom: string;
  tasksAssignedToday: number;
  tasksCompletedToday: number;
  tasksCompletedThisMonth: number;
  tasksAssignedThisMonth: number;
  pendingScore: number;
  overdueCount: number;
  incomplete: number;
}

interface QueenStats {
  members: MemberStats;
  tickets: TicketStats;
  agents: AgentStats[];
  joker?: JokerStats;
}

interface JokerRecommendation {
  id: string;
  category: string;
  text: string;
  place: string;
  icon: string;
}

interface SpecialDate {
  id: string;
  clientName: string;
  date: string;  // "YYYY-MM-DD"
  type: "birthday" | "anniversary";
  queendom: "ananyshree" | "anishqa";
}
```

### `lib/onboardingTypes.ts`

```typescript
type Department = "concierge" | "shop";

type BusinessVertical = "Indulge Global" | "Indulge Shop" | "Indulge House" | "Indulge Legacy";

type ZohoLeadStatus = "Qualified" | "In Discussion" | "Nurturing" | "Attempted" | "New" | "Junk";

type PipelineStatus = ZohoLeadStatus;

type PipelineStatusCounts = Record<ZohoLeadStatus, number> & { total: number };

type AgentLeadStatusBreakdown = Partial<Record<ZohoLeadStatus, number>> & { total: number };

type LeadStatusByAgent = Record<string, AgentLeadStatusBreakdown>;

interface OnboardingAgentRow {
  id: string;
  name: string;
  department?: Department;
  leadsCreatedThisMonth: number;   // total leads this month
  totalConverted: number;          // closures count (last 30 days)
  leadsCreatedTodayIst: number;    // leads today (IST)
  leadsThisMonth?: number;         // alias for leadsCreatedThisMonth
  closedLakhsThisMonth?: number;   // deal amount in lakhs this month
  pipeline?: AgentLeadStatusBreakdown;
}

interface OnboardingLedgerRow {
  id: string;
  clientName: string;
  recordedAt: string;     // ISO timestamp string
  assignedTo: string;     // queendom_name (often empty string)
  agentName: string;
  department?: Department;
}

interface DepartmentStats {
  agents: OnboardingAgentRow[];
}

interface LeadTrendPoint {
  date: string;           // "YYYY-MM-DD"
  conciergeLeads: number;
  shopLeads: number;
}

interface VerticalTrendPoint {
  date: string;           // "YYYY-MM-DD"
  "Indulge Global": number;
  "Indulge Shop": number;
  "Indulge House": number;
  "Indulge Legacy": number;
}

interface TeamAttendedDay {
  date: string;
  onboarding: number;
  shop: number;
}

interface PerformanceDayPoint {
  date: string;
  onboarding: { leads: number; attended: number; converted: number };
  shop: { leads: number; attended: number; converted: number };
}

interface PerformanceTotals {
  onboarding: { leads: number; attended: number; converted: number; junk: number };
  shop: { leads: number; attended: number; converted: number; junk: number };
}

interface LeadMonthStats {
  leads: number;
  attended: number;
  dealsClosedThisMonth: number;
  junk: number;
}

interface OnboardingApiPayload {
  agents?: OnboardingAgentRow[];
  ledger?: OnboardingLedgerRow[];
  departments?: {
    concierge: DepartmentStats;
    shop: DepartmentStats;
  };
  leadTrendline?: LeadTrendPoint[];
  teamAttendedTrend?: TeamAttendedDay[];
  verticalTrendline?: VerticalTrendPoint[];
  leadMonthStats?: LeadMonthStats;
  leadStatusByAgent?: LeadStatusByAgent;
}
```

### `types/index.ts` (additional types)

```typescript
interface JokerRecommendationItem {
  id: string;
  city: string;
  type: string;
  suggestion: string;
}

type QueendomId = "ananyshree" | "anishqa";

type ActiveScreen = "concierge" | "onboarding";

interface RenewalsPanelData {
  totalRenewalsThisMonth: number;
  renewals: string[];    // latest 2 client names
  assignments: string[]; // latest 2 new member names
}

interface MemberApiResponse {
  ananyshree: MemberStats;
  anishqa: MemberStats;
}

interface DisplayOutlay {
  id: string;
  client_name: string;
  task: string;
  amount: number;
  pending: boolean;   // false = paid, green, scheduled for removal
}
```

### `lib/ticketAggregation.ts` (exported types)

```typescript
interface TicketRowMinimal {
  id: string;
  status: string;
  queendom_name: string;
  agent_name: string | null;
  created_at: string;
  is_escalated: boolean;
  is_incomplete?: boolean;
  tags?: Record<string, unknown>;
}
```

---

## 12. Agent & Joker Rosters

### Concierge Agent Rosters (`lib/agentRoster.ts`)

**ROSTER_ANANYSHREE (9 agents):**
1. Sanika Ahire
2. Ragadh Shahul
3. Aditya Sonde
4. Shaurya Verma
5. Poorti Gulati
6. Anshika Eark
7. Ajith Sajan
8. Khushi Shah
9. Palak Kataria

**ROSTER_ANISHQA (9 agents):**
1. Sagar Ali
2. Savio Francis Fernandes
3. Pranav Gadekar
4. Dhanush K
5. Charlotte Dias
6. Ria Pujhari
7. Rupali Chodankar
8. Eeti Srinivsulu
9. Ekta Nihalani

**Joker Roster:**
```typescript
JOKER_ROSTER = {
  "Lilian Albrecht": "ananyshree",
  "Shruti Sharma":   "anishqa",
}
```

### Onboarding Sales Agents (`lib/onboardingAgents.ts`)

**Concierge Department (left column, "Onboarding" label):**
| Card ID | Display Name | Portrait File |
|---|---|---|
| `amit` | Amit | `onboarding-agents-images/amit.webp` |
| `meghana` | Meghana | `onboarding-agents-images/meghana.webp` |
| `samson` | Samson | `onboarding-agents-images/samson.webp` |
| `kaniisha` | Kaniisha | `onboarding-agents-images/kaniisha.webp` |

**Shop Department (right column, "Shop" label):**
| Card ID | Display Name | Portrait File |
|---|---|---|
| `vikram` | Vikram | `onboarding-agents-images/vikram.webp` |
| `katya` | Katya | `onboarding-agents-images/katya.webp` |
| `harsh` | Harsh | `onboarding-agents-images/harsh.webp` |

**Portrait display notes:**
- Katya: `objectFit: "contain"` (full-body or different aspect ratio)
- Vikram: `objectFit: "contain"`
- All others: `objectFit: "cover"` (headshots)

**Department lookup keys (all lowercase):**
```
"amit", "samson", "meghana", "aniisha", "kaniisha" → "concierge"
"vikram", "katya", "harsh" → "shop"
```

**Business Verticals (for leads):**
```
"Indulge Global"  → blue  #6B8FFF
"Indulge Shop"    → gold  #FFB020
"Indulge House"   → green #34D399
"Indulge Legacy"  → lavender #C084FC
```

---

## 13. Dependencies Reference

### Production Dependencies

| Package | Version | Purpose |
|---|---|---|
| `next` | ^16.1.6 | Framework (App Router, React Server Components) |
| `react` | ^18 | UI library |
| `react-dom` | ^18 | DOM renderer |
| `framer-motion` | ^11.0.0 | Animations (spring physics, AnimatePresence, motion.path) |
| `@supabase/supabase-js` | ^2.39.0 | Database client + Realtime subscriptions |
| `lucide-react` | ^0.363.0 | Icon library (Crown, Gift, Heart, etc.) |
| `date-fns` | ^3.6.0 | Date utility (used in some formatting) |
| `dotenv` | ^17.3.1 | Env loading for scripts |
| `csv-parser` | ^3.0.0 | CSV parsing for `importTickets.ts` script |

### Development Dependencies

| Package | Version | Purpose |
|---|---|---|
| `typescript` | ^5 | Type checking |
| `tailwindcss` | ^3.4.0 | Utility CSS |
| `postcss` | ^8 | CSS processing |
| `autoprefixer` | ^10 | CSS vendor prefixes |
| `tsx` | ^4.7.0 | TypeScript script runner (`scripts/importTickets.ts`) |
| `eslint` | — | Linting |
| `@types/react` | — | React type definitions |

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

---

## 14. Product Understanding

### Screen Layout

The TV renders in 2 modes that auto-rotate every 30 seconds:

**Mode 1: Concierge View (30 seconds)**
- Two `QueendomPanel` side-by-side
- Left panel: Ananyshree (agents: 9)
- Right panel: Anishqa (agents: 9)
- Each panel shows: member counts, 5 ticket metrics, renewals, agent leaderboard, special dates, joker strip
- Bottom of screen: horizontal recommendation ticker (Joker suggestions)

**Mode 2: Revenue Dashboard (30 seconds)**
- Full-width `OnboardingLayout`
- Left column: Onboarding/Concierge department (4 agents: Amit, Meghana, Samson, Kaniisha)
- Center: Performance metrics (4 tiles) + multi-line graph (4 Indulge verticals) + scrolling conversion ledger
- Right column: Shop department (3 agents: Vikram, Katya, Harsh)

### Key UX Design Principles

1. **Premium, luxury aesthetic** — obsidian black background, gold accents, Cinzel font for luxury feel
2. **TV-safe sizing** — all fonts use fluid `clamp()` scaling from 1280px to 1920px resolution
3. **Celebration moments** — when any agent closes a ticket today, full-screen gold celebration with Web Audio API chime
4. **Reduced motion support** — all animations conditionally disabled via `usePrefersReducedMotion()`
5. **Error isolation** — every widget wrapped in `ErrorBoundary`; failures show "OFFLINE" state, not broken UI
6. **Always-live** — no data is stale; Realtime pushes keep everything current; polling is only a safety net

### Data Flow Overview

```
Freshdesk Ticket Created/Updated
  → POST /api/webhooks/freshdesk
  → Upsert to tickets table
  → Supabase Realtime push to browser
  → useDashboardData.setTicketRows() (optimistic)
  → useEffect derives new QueenStats
  → QueendomPanel re-renders

Zoho Lead Created/Updated
  → POST /api/webhooks/zoho-leads
  → Upsert to leads table
  → Supabase Realtime → useOnboardingPanelData
  → firePulse() (visual burst on line graph)
  → scheduleDebouncedLoad() → /api/onboarding after 2.5s

Zoho Deal Closed
  → POST /api/webhooks/zoho-deals
  → Insert to deals table
  → Supabase Realtime → useOnboardingPanelData
  → Optimistic prepend to ledger
  → firePulse()
  → scheduleDebouncedLoad()
```

---

## 15. Migrations Log

Listed in chronological order (migration filenames are timestamps):

| Migration | Date | Description |
|---|---|---|
| `20250318000000_add_is_escalated.sql` | 2025-03-18 | Added `is_escalated BOOLEAN NOT NULL DEFAULT false` to `tickets` |
| `20250318100000_add_tickets_tags.sql` | 2025-03-18 | Added `tags JSONB DEFAULT '{}'` to `tickets` |
| `20250318110000_create_jokers.sql` | 2025-03-18 | Created `jokers` table + Realtime + RLS |
| `20250318120000_seed_renewals_ananyshree.sql` | 2025-03-18 | Seeded initial renewal data for Ananyshree |
| `20250318130000_seed_renewals_anishqa.sql` | 2025-03-18 | Seeded initial renewal data for Anishqa |
| `20250401120000_create_finance_outlays.sql` | 2025-04-01 | Created `finance_outlays` table + Realtime + RLS |
| `20250401140000_create_onboarding_lead_touches.sql` | 2025-04-01 | Created `onboarding_lead_touches` (now `leads`) with `lead_id` PK, `agent_name`, `latest_status`, `first_touched_at`, `updated_at` |
| `20250401150000_onboarding_lead_touches_realtime.sql` | 2025-04-01 | Added `onboarding_lead_touches` to Realtime publication |
| `20250401160000_onboarding_lead_touches_rls.sql` | 2025-04-01 | Added RLS policies for `onboarding_lead_touches` |
| `20250401170000_create_onboarding_conversion_ledger.sql` | 2025-04-01 | Created `onboarding_conversion_ledger` table + Realtime + RLS |
| `20250401180000_conversion_ledger_queendom_no_default.sql` | 2025-04-01 | Changed `queendom_name` default from empty Ananyshree to `''` |
| `20250409120000_onboarding_conversion_ledger_deal_id.sql` | 2025-04-09 | Added `deal_id TEXT` nullable + partial unique index on `(deal_id) WHERE deal_id IS NOT NULL` |
| `20260417000000_add_intent_lead_name_to_lead_touches.sql` | 2026-04-17 | Added `intent`, `lead_name`, `company` columns to `onboarding_lead_touches` for Hot Leads Radar (later dropped) |
| `20260424120000_onboarding_leads_deals_reschema.sql` | 2026-04-24 | Major reshape: replaced `first_touched_at`/`updated_at` with `created_at`/`modified_at`; dropped `intent`/`company`; added `lead_name` NOT NULL DEFAULT ''; created new `onboarding_deals` table |
| `20260425152000_rename_onboarding_deals_to_deals.sql` | 2026-04-25 | Renamed `onboarding_deals` → `deals`; handles 3 cases (rename, backfill, create); updated RLS and Realtime |
| `20260425180000_rename_leads_add_business_vertical.sql` | 2026-04-25 | Renamed `onboarding_lead_touches` → `leads`; renamed indexes; added `business_vertical TEXT CHECK (IN 4 verticals) DEFAULT 'Indulge Global' NOT NULL`; added `leads_vertical_created_idx`; updated RLS + Realtime |
| `20260508000000_add_is_incomplete_to_tickets.sql` | 2026-05-08 | Added `is_incomplete BOOLEAN NOT NULL DEFAULT false` to `tickets` |

**Current table names (as of latest migration):**
- `leads` (formerly `onboarding_lead_touches`)
- `deals` (formerly `onboarding_deals` — never `onboarding_conversion_ledger`)
- `onboarding_conversion_ledger` — still exists, used for the scrolling UI ledger

---

## 16. Known Gaps & Observations

### Still missing / unmounted

1. **`POST /api/webhooks/zoho-calls`** — No `route.ts`. `app/api/webhooks/zoho-calls/README.md` and `lib/dataSources.ts` document the intended integration; `implemented: false`.
2. **`ActiveOutlays`** — `components/_unmounted/ActiveOutlays.tsx` is not imported by `QueendomPanel`. Mount via `ErrorBoundary` when product needs finance tracking (`lib/widgetRegistry`: `finance-outlays.mounted: false`).
3. **`LeadStatusHealthBar`:** `GlossSweep` and `BreathingGlow` return `null` (visual stubs).
4. **`/api/agents`** — Not used by the live UI; agent stats come from `ticketRows` + `ticketAggregation` client-side.
5. **Dual-write:** `zoho-deals` webhook writes both `deals` and `onboarding_conversion_ledger`; failure between inserts can drift Realtime vs ledger UI.

### Implementation notes

1. **`normalizeZohoAgentName`** — `lib/onboardingAgents.ts` is trim + whitespace collapse only; display names use `getDisplayAgentName()` and card metadata separately.
2. **`performanceTotals` / `performanceData`** — Still computed inside `useOnboardingPanelData` but not returned on the hook API (internal only).
3. **Deprecated fallbacks** — `ONBOARDING_AGENT_DISPLAY_NAMES`, `ONBOARDING_AGENT_CARDS`, `FALLBACK_AGENTS` in `onboardingAgents.ts` remain for backward compatibility.

---

*Blueprint updated 2026-05-08 to match repo layout (OnboardingLayout owns onboarding hook; finance widgets under `_unmounted`; `istMonthBounds` merged into `istDate`; migration `20260508000000`).*
