# MASTER.md — Indulge Live Dashboard

> **The complete master reference for this codebase.** What the product is, every screen and panel, the full design language, all functionality, data flow, database schema, API surface, and known gaps. Compiled 2026-06-11 from a full codebase scan (supersedes details in `claude.md` / `design.md` / `blueprint.md` where they disagree — e.g. screen rotation timings).

---

## Table of Contents

1. [What This Project Is](#1-what-this-project-is)
2. [Tech Stack](#2-tech-stack)
3. [Screens & Rotation](#3-screens--rotation)
4. [Panels & Widgets — Full Inventory](#4-panels--widgets--full-inventory)
5. [Design Aesthetic & System](#5-design-aesthetic--system)
6. [Functionality & Business Logic](#6-functionality--business-logic)
7. [Data Architecture](#7-data-architecture)
8. [Database Schema](#8-database-schema)
9. [API Routes](#9-api-routes)
10. [Hooks Reference](#10-hooks-reference)
11. [Lib / Utilities Reference](#11-lib--utilities-reference)
12. [Agent & Joker Rosters](#12-agent--joker-rosters)
13. [Environment Variables & Setup](#13-environment-variables--setup)
14. [Critical Invariants](#14-critical-invariants)
15. [Known Gaps, Unmounted & WIP](#15-known-gaps-unmounted--wip)
16. [Migrations Log](#16-migrations-log)

---

## 1. What This Project Is

**Indulge Live Dashboard** is a 24/7 real-time TV / big-screen broadcast dashboard for **Indulge**, an Indian luxury concierge agency (Indulge Global). It runs fullscreen on a 75"+ 4K office TV in Chromium with no cursor and no scroll, and auto-rotates between screens.

It tracks three things live:

1. **Concierge operations** — two operational teams called **Queendoms** (*Ananyshree* and *Anishqa*), each with ~9 agents handling client tickets from Freshdesk.
2. **Revenue / Onboarding** — the sales team's leads and deals from Zoho CRM, split into a **Concierge (Onboarding)** department and a **Shop** department, across four business verticals (Indulge Global, Indulge Shop, Indulge House, Indulge Legacy).
3. **Engagement extras** — "Joker" lifestyle suggestions sent to clients, membership renewals, new member assignments, client birthdays/anniversaries.

Data is pushed into Supabase by webhooks (Freshdesk, Zoho) and an external Google Sheet sync (jokers); the browser subscribes via Supabase Realtime, so the TV updates within seconds of an event, with a full-screen gold **celebration** when an agent completes a task.

---

## 2. Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Framework | Next.js (App Router) | ^16.1.6 |
| UI | React | ^18 |
| Language | TypeScript | ^5 |
| Animations | Framer Motion | ^11.0.0 |
| Styling | Tailwind CSS | ^3.4.0 |
| Database / Realtime | Supabase (`@supabase/supabase-js`) | ^2.39.0 |
| Icons | lucide-react | ^0.363.0 |
| Dates | date-fns | ^3.6.0 |
| Analog clocks | react-clock | ^6.0.0 |
| CSV import | csv-parser + tsx | ^3.0.0 / ^4.7.0 |
| Integrations | Freshdesk (tickets), Zoho CRM (leads + deals), Google Sheet (jokers) | — |

**NPM scripts:** `dev`, `build`, `start`, `lint`, `import-tickets` (`tsx scripts/importTickets.ts`).

---

## 3. Screens & Rotation

Defined in `lib/dashboardScreens.ts`, driven by `components/DashboardController.tsx`.

| Screen | `ActiveScreen` id | Duration | Status |
|---|---|---|---|
| Concierge (two Queendom panels) | `concierge` | **60 s** | Live |
| Revenue Dashboard (Onboarding) | `onboarding` | **10 s** | Live |
| Home (clocks + daily quote) | `home` | 30 s | **WIP — off in production**; enable with `NEXT_PUBLIC_HOME_PANEL_ENABLED=true` |

Key rotation rules:

- **All screen layers are always mounted.** Rotation only crossfades `opacity` (1.5 s `easeInOut`) and swaps `zIndex` (10 active / 0 inactive). Never unmount a screen layer (Law 4, §5.2).
- `nextActiveScreen()` / `stepActiveScreen()` cycle through `ACTIVE_SCREEN_ORDER`.
- **Keyboard / TV remote** (`hooks/useKeyboardControls.ts`, window capture phase):
  - `P`, `Space`, `Enter`, `NumpadEnter`, `MediaPlayPause` → PAUSE/RESUME (freeze rotation)
  - `ArrowLeft` / `ArrowRight` → manual screen switch
  - On-screen PAUSE button: `min-width: 140px`, `min-height: 48px` (TV remote accuracy), z-index 100.
- While loading, pixel-stable **skeleton overlays** (`QueendomSkeleton`, `OnboardingSkeleton`) sit at z-index 20 and exit via `AnimatePresence` fade.

### Top-level component tree

```
app/page.tsx
└── Dashboard (components/Dashboard.tsx)            — composition shell, hooks, ErrorBoundaries
    ├── TopBar                                      — header strip, live clock (18vh, 96–165px)
    ├── CelebrationOverlay                          — fixed inset-0, z-50
    ├── DashboardController                         — rotation + PAUSE + skeletons
    │   ├── [concierge layer]
    │   │   ├── QueendomPanel (Ananyshree, side=left)
    │   │   ├── center separator column (gold vertical rule + ambient glow)
    │   │   └── QueendomPanel (Anishqa, side=right)
    │   ├── [onboarding layer] → OnboardingLayout
    │   └── [home layer]       → HomePanel (env-gated)
    └── ticker dock (z-10) → RecommendationTicker
```

---

## 4. Panels & Widgets — Full Inventory

A machine-readable inventory also lives in `lib/widgetRegistry.ts` (every widget has `screen`, `dataSources`, `mounted`).

### 4.1 Concierge screen — `QueendomPanel` (one per Queendom)

Layout top → bottom:

1. **`QueendomWingspanHeader`** — Queendom name (Cinzel, gold glow) + active member counts (total / celebrity-complimentary) from `clients` table.
2. **5-Metric Hero Row** (inline `MetricBox` × 5, all `AnimatedCounter`s):
   | Metric | Color | Definition |
   |---|---|---|
   | Resolved (Today) | Emerald + hero glow | Created IST-today, status terminal |
   | Received (Month) | Champagne | Created this IST month, not void |
   | Resolved (Month) | Green | Created this IST month, status terminal |
   | Pending (To Resolve) | Red | Created this IST month, status non-terminal (**month-gated**, like all metrics) |
   | Spoiled / Joker Accepted | Gold (`.joker-box`) | Joker accepted counts |
3. **`RenewalsPanel`** — renewals this month (big handwritten Edu numeral, gold drop shadow) + renewal client names + new member assignments.
4. **`AgentLeaderboard`** (left) + **`SpecialDates`** (right; height matched via ResizeObserver):
   - `AgentRow` 5-column grid: SVG progress ring + crown for rank 1 (`AgentIcon`, stroke `#c9a84c`) · agent name (Baskerville champagne) · `completedToday/assignedToday` · `completedThisMonth/assignedThisMonth` · `pending / overdue / incomplete` (red, escalation glow).
   - Ranking: `tasksCompletedThisMonth` DESC, then `tasksCompletedToday` DESC.
   - `SpecialDates` — static client birthdays/anniversaries from `lib/specialDates.ts`.
5. **`JokerMetricsStrip`** — compact bar of Joker stats (sent, accepted, rejected, pending, today, month).

### 4.2 Revenue screen — `OnboardingLayout` (3-column grid on lg+)

| Column | Contents |
|---|---|
| Left | `DepartmentColumn` — **Onboarding** (concierge dept): agent cards (Amit, Meghana, Samson, Kaniisha) with portraits, leads this month/today, closures, `LeadStatusHealthBar` pipeline bar per agent |
| Center | Lead month stat tiles (leads / attended / deals closed / junk) + `PerformanceLineGraph` + `ConversionLedger` |
| Right | `DepartmentColumn` — **Shop** dept (Vikram, Katya, Harsh) — sky-blue themed (`.sky-name-glow`) |

- **`PerformanceLineGraph`** — native SVG multi-line chart, one Catmull-Rom spline (tension 0.35) per business vertical, draw-in `pathLength` animation with 0.12 s stagger. Colors: Indulge Global `#6B8FFF`, Shop `#FFB020`, House `#34D399`, Legacy `#C084FC`.
- **`ConversionLedger`** — auto-scrolling sales closure ledger driven by `requestAnimationFrame` (not CSS keyframes); `dt` capped at 100 ms; on optimistic row prepend, scroll position compensates by average row height so visible content doesn't jump. Max 15 visible rows; scroll duration `max(32, rows × 6)` s.
- **`LeadStatusHealthBar`** — segmented pipeline bar per agent (Qualified / In Discussion / Nurturing / Touched / New / Junk; Zoho's `attempted` is normalized into `Touched`).
- Agent card metrics flash an `.ob-metric-flash` pulse when their numbers increase. (The old `.card-win-shimmer` gold-foil sweep was never wired up — its plumbing was removed in dry-audit G6.)

### 4.3 Home screen — `HomePanel` (WIP, env-gated)

- **4 world clocks** (`react-clock` analog + digital readout) in `GlassPanel` cards: Mumbai, London, New York, Dubai.
- **Daily rotating luxury quote** from a curated list of 12 (Armani, da Vinci, Ritz-Carlton credo, Chanel, etc.).
- Built entirely on shared primitives (GlassPanel, SectionDivider, motionPresets).

### 4.4 Global / cross-screen widgets

| Widget | File | Behavior |
|---|---|---|
| `TopBar` | `components/TopBar.tsx` | Brand header + live IST clock; fixed strip 18vh (96–165 px) |
| `RecommendationTicker` | `components/RecommendationTicker.tsx` | Bottom-docked horizontal marquee of latest 15 Joker suggestions (city · type · text), Cinzel gold text, 40 s loop, pausable |
| `CelebrationOverlay` | `components/CelebrationOverlay.tsx` | Full-screen (z-50) gold celebration when an agent's `tasksCompletedToday` increases: avatar with multi-ring gold glow, shimmer name text, diagonal gold sweep, Web Audio API chime. One at a time, ~3 s |
| `AnimatedCounter` | `components/AnimatedCounter.tsx` | Framer Motion numeric counter; `value`, `delay`, `slideOnChange` |

### 4.5 UI primitives (`components/ui/`)

| Primitive | Purpose | Key props |
|---|---|---|
| `GlassPanel` | The single glassmorphism container — never hand-roll `.glass` + border + radius | `variant` glass/card/elevated · `radius` card/panel/none · `glow` · `overlay` · `shadow` none/sm/md/lg |
| `StatCard` | Label + value tile | `label`, `accent` (champagne/emerald/red/amber/sky/gold), children = value |
| `SectionDivider` | Gold horizontal rule, optional centered title | `label`, `accent`, `labelClass` |
| `ErrorBoundary` | React class boundary — wraps every major region so one widget crash can't black the TV | — |

### 4.6 Built but not mounted

| Component | Location | Notes |
|---|---|---|
| `ActiveOutlays` + `OutlayLedger` | `components/_unmounted/` | Finance expense tracking (table `finance_outlays` exists, Realtime ready). Parked until product mounts them; wrap in ErrorBoundary when mounting |
| `LeadVelocityChart` | `components/onboarding/` | Not imported by OnboardingLayout |
| `AgentVerticalBarChart` | `components/onboarding/` | Not imported by OnboardingLayout |

---

## 5. Design Aesthetic & System

Authoritative source: `design.md` + `app/globals.css` + `tailwind.config.ts`. Summary below.

### 5.1 Identity: "Quiet Luxury / Cinematic HUD"

Not a dark-mode app — a **luxury broadcast instrument**: private-bank-vault meets cinematic command center.

- **Black, not dark grey.** Canvas is near-absolute obsidian `#050507`; panels are barely-there glass floating above it.
- **Gold, not yellow.** Antique metallic gold `#d4af37` — used only as signal (borders, glows, counters, dividers, celebration). Never a fill on large surfaces; champagne `#f5e6c8` carries body text.
- **Silence before spectacle.** Default state is calm; motion fires only when data changes. Celebration is earned, not ambient.
- **TV readability.** ~14 px effective minimum type, labels tracked `0.35em+`, numbers in Cinzel / Edu Hand with `tabular-nums`.
- **Texture, not gradients.** A fixed 3% SVG fractal-noise overlay on `body::before` gives film-grain depth. Never remove; never exceed 0.04 opacity.

### 5.2 The Four Laws (non-negotiable)

1. **Animate only `opacity` and `transform`** in Framer Motion / rAF loops. `box-shadow`/color breathing is allowed only via CSS `@keyframes` class toggles (CSS animation thread).
2. **Gold is a signal, not wallpaper.**
3. **Type lives on the `clamp()` scale.** No fixed px for primary copy; root `html` font scales ~16 px @1280 → ~20 px @1920.
4. **Both screens always mounted** during rotation — opacity/zIndex only.

### 5.3 Core tokens (CSS variables in `globals.css`)

- **Surfaces:** `--bg-obsidian #050507`, `--surface-glass rgba(10,10,10,.85)`, `--surface-card .92`, `--surface-elevated`, `--surface-inset`, `--surface-joker` (gold gradient).
- **Gold:** `--gold-primary #d4af37` (= Tailwind `gold-400`), `--gold-bright #f9e27e`, `--gold-accent #c9a84c`; border opacities dim/subtle/mid/bright (.08/.15/.25/.55); glow shadows `--shadow-gold-sm/md/lg`.
- **Status:** emerald `#34d399` (success/resolved), red `#f87171` (pending), overdue `#ff0000` (escalation neon), amber `#fcd34d`, sky `#7dd3fc` (Shop dept), champagne `#f5e6c8`.
- **Typography clamps:** counter hero→md, heading xl/lg/md, label xl/lg/md, full onboarding `--text-ob-*` scale, `--text-fin-cell`.
- **Spacing:** `--pad-panel`, `--pad-card`, `--pad-cell`, `--gap-card`; radii `--radius-card 1rem`, `--radius-panel 1.5rem`, pill.
- **Motion:** `--duration-crossfade 1.5s`, `--duration-counter 0.7s`, `--duration-row 0.55s`, `--ease-luxury cubic-bezier(0.25,0.46,0.45,0.94)`.

### 5.4 Fonts

| Family | Role |
|---|---|
| **Cinzel** | Headings, queendom names, metric labels, page titles, celebration |
| **Inter** | Body, UI labels, ledger, time |
| **Libre Baskerville** | Agent names, joker suggestion body |
| **Montserrat** | Department secondary labels |
| **Edu AU VIC WA NT Hand Arrows** | Handwritten numerals (renewal counter, leaderboard stats) |

Loaded via `next/font/google` in `app/layout.tsx` (+ Edu via CSS `@import`). New fonts must be added to both places.

### 5.5 Signature utility classes (`globals.css @layer utilities`)

`.glass`, `.glass-pill`, `.gold-border-glow` · text glows `.queen-name-glow`, `.sky-name-glow`, `.gold-glow`, `.emerald-glow-hero`, `.monthly-error-glow`, `.error-overdue-glow` · ambient radial glows `.ambient-glow-center/left/right/stage/column` · separators `.separator-gold-h/v` · `.skeleton-block` (gold foil shimmer) · celebration set (`.celebration-backdrop/-avatar-glow/-name-glow/-shimmer-text/-name-flash`) · win effects `.row-win-shimmer`, `.ob-metric-flash`, `.hot-lead-card-pulse` · `.tabular-nums`, ticker classes, `.renewal-card-text`, `.drop-shadow-gold`, `.joker-box`.

### 5.6 Motion presets (`lib/motionPresets.ts`)

`gpuStyle` (will-change + translateZ(0)) · `EASE_LUXURY` · `containerVariants`/`itemVariants` (stagger 0.14, fade-up 28 px) · `crossfadeTransition` (1.5 s) · `widgetFadeIn(delayMs)` · `rowVariants` · surge/win shimmer variants. GPU budget: ≤ 8–10 simultaneous Framer animate targets; stagger lists; `style={gpuStyle}` on anything persistent > 5 s; respect `usePrefersReducedMotion`.

### 5.7 TV engineering rules

- Layout pattern for every panel: `h-full w-full min-h-0 overflow-hidden flex flex-col`; never `100vw/100vh` inside children.
- All scrollbars hidden globally; no scroll on TV (`overflow: hidden` on html/body).
- Charts are **native SVG only** — no Recharts/Chart.js/D3.
- Z-index budget: noise 0 · content auto · active screen / TopBar / ticker 10 · card shimmer 15 · skeletons 20 · celebration 50 · PAUSE 100. New overlays: 11–49.
- Realtime: anon client for subscriptions only; every channel subscription must clean up via `supabase.removeChannel`; stable channel names.

---

## 6. Functionality & Business Logic

### 6.1 Ticket status model (`lib/ticketStatus.ts` — single source for all status sets)

```
VOID_STATUSES     = { spam, deleted }      → invisible to ALL math (stripped first, always)
TERMINAL_STATUSES = { resolved, closed }   → "done"
everything else                            → open/pending
```

### 6.2 Metric formulas (cohort anchored to `created_at`, all in IST)

| Metric | Formula |
|---|---|
| Received (Month) | created in current IST month, not void |
| Resolved (Month) | created in IST month AND now terminal (NOT "resolved_at this month") |
| Solved Today | created IST-today AND terminal |
| Pending | created in current IST month AND non-terminal — **month-gated** (decision 2026-06-11: every dashboard metric is month-gated; the rows route + client prune both enforce it) |
| Per-agent stats | same windows filtered by `agent_name`; `overdueCount` = pending ∧ `is_escalated`; `incomplete` = pending ∧ `is_incomplete` |

### 6.3 IST handling (`lib/istDate.ts`)

All "today"/"this month" logic is IST (UTC+05:30) via `istToday()` and `getCurrentIstMonthUtcBounds()` / `getCurrentIstDayUtcBounds()`. Freshdesk sends naive IST strings — `freshdeskTimestampToIsoUtcForDb()` normalizes (date-only → IST midnight; space or zone-less `T` → append `+05:30`; explicit zone → as-is) and always stores UTC `Z` ISO.

### 6.4 Queendom & name matching

- Queendom mapping uses lowercase `.includes("ananyshree" | "anishqa")` — Freshdesk sends e.g. `"Team Ananyshree"`.
- Zoho agent names: `normalizeZohoAgentName()` = trim + collapse whitespace; display resolution via `getDisplayAgentName()`.

### 6.5 Celebration

`useCelebrationDetection` diffs agent stats on each change; any increase of `tasksCompletedToday` triggers `CelebrationOverlay` (seeded on first load so nothing fires at startup).

### 6.6 Memory management

Ticket rows pruned client-side: filter to current IST month → keep newest 5000; re-pruned every 5 minutes (handles month rollover without reload).

---

## 7. Data Architecture

### 7.1 Flow

```
Freshdesk ticket event ─► POST /api/webhooks/freshdesk ─► upsert tickets
                              └► Supabase Realtime ─► useDashboardData patches ticketRows
                                   └► derived QueenStats ─► QueendomPanel re-render (+ celebration)

Zoho lead event ─► POST /api/webhooks/zoho-leads ─► upsert leads
Zoho deal event ─► POST /api/webhooks/zoho-deals ─► insert deals
                              └► Realtime ─► useOnboardingPanelData: pulse + optimistic ledger prepend
                                              + debounced (2.5 s) /api/onboarding refetch

Google Sheet sync ─► jokers table ─► Realtime ─► joker stats + ticker
```

Polling every 5 minutes is the safety net on both hooks; Realtime CHANNEL_ERROR/TIMED_OUT triggers reload + 3 s reconnect.

### 7.2 Realtime subscriptions

| Hook / Component | Channel | Table(s) | Events |
|---|---|---|---|
| useDashboardData | `dashboard-tickets` | tickets | * |
| useDashboardData | `dashboard-clients` | clients | * |
| useDashboardData | `dashboard-jokers` | jokers | * |
| useDashboardData | `dashboard-renewals` | renewals + members | INSERT |
| useOnboardingPanelData | `deals-live` | deals | * |
| useOnboardingPanelData | `leads-touches-live` | leads | * |
| ActiveOutlays (unmounted) | `finance-outlays-{queendom}` | finance_outlays (filtered) | I/U/D |

### 7.3 Client split

- `lib/supabase.ts` — browser **anon** client, module-level singleton, **Realtime only**.
- `lib/supabaseAdmin.ts` — server **service-role** client, singleton on `globalThis.__supabaseAdmin__`; all API routes use it; returns `null` (routes → 503) if key missing/placeholder.

---

## 8. Database Schema

All tables in `public`. Universal RLS: anon SELECT, authenticated ALL; service role bypasses.

| Table | Purpose | Key columns |
|---|---|---|
| **tickets** | Concierge tickets (Freshdesk webhook only) | `ticket_id` PK · `status` · `queendom_name` · `agent_name` · `created_at` · `resolved_at` · `is_escalated` (only escalation webhook path sets true) · `tags` JSONB · `is_incomplete` |
| **leads** | Zoho leads (ex `onboarding_lead_touches`) | `lead_id` PK · `agent_name` · `latest_status` · `lead_name` · `created_at` (immutable) · `modified_at` · `business_vertical` (4-value CHECK, default 'Indulge Global') |
| **deals** | Zoho deals (ex `onboarding_deals`) | `deal_id` PK · `deal_name` · `agent_name` · `created_at`; PK violation 23505 = expected dedup |
| **onboarding_conversion_ledger** | ⚠️ **Orphaned** — no code path writes or reads it (ledger UI + closure counts come from `deals`). Drop/archive decision pending (dry-audit G4) | `id` UUID · `client_name` · `amount` NUMERIC(14,2) INR · `agent_name` · `queendom_name` (always '') · `recorded_at` · `deal_id` (partial unique idx = dedup) |
| **jokers** | Joker suggestions (Google Sheet sync) | `client_name` · `city` · `date` · `type` · `suggestion` · `response` ("yes"/"no"/else=pending) · `queendom_name` · `joker_name` |
| **finance_outlays** | Expense tracking (unmounted widget) | `client_name` · `task` · `amount` · `status` pending/paid · `queendom_name` |
| **clients** | Member counts | `group` · `latest_subscription_status` (Active/Expired) · `latest_subscription_membership_type` (Premium/Genie/Monthly Trial/Standard = paid; Celebrity = complimentary) |
| **renewals** | Renewal log | `client_name` · `group` · `queendom` (dup of group; code checks both) · `created_at` |
| **members** | New member assignment log | same shape as renewals |
| **onboarding_sales_agents** | Optional agent roster table | `id` · `display_name` · `photo_url` · `sort_order`; falls back to `ONBOARDING_AGENT_CARDS` |

All event tables are in the `supabase_realtime` publication. **Soft-delete only** — tickets are never `DELETE`d; deletion webhook sets `status='deleted'`.

---

## 9. API Routes

All GET routes use `supabaseAdmin`, return `Cache-Control: no-store`.

| Route | Method | Purpose |
|---|---|---|
| `/api/tickets/rows` | GET | Minimal rows for client-side aggregation: current-IST-month rows only (all metrics, incl. Pending, are month-gated) |
| `/api/clients` | GET | Active members per queendom → `MemberStats` |
| `/api/jokers` | GET | Per-joker stats (sent/accepted/rejected/pending/today/month) |
| `/api/jokers/recommendations` | GET | Latest 15 joker rows for the ticker |
| `/api/onboarding` | GET | Big payload: agents, top-25 ledger, lead stats per agent, dept split, 4-vertical trendline, pipeline breakdown per agent |
| `/api/renewals-panel?queendom=` | GET | Renewals + assignments for one queendom |
| `/api/webhooks/freshdesk` | POST | "Smart Bouncer" — 3 paths: **deletion** (soft-delete), **escalation-only** (the only path that may set `is_escalated=true`; forced false for SLA-safe statuses), **full upsert** (status+queendom present; resolved → set `resolved_at`; active-clear statuses → clear it; active non-safe → omit `is_escalated` to preserve DB value). Raw body fixup replaces empty `is_escalated` placeholders with `false` |
| `/api/webhooks/zoho-leads` | POST | Upsert into `leads` on any status; JSON or form-urlencoded; `created_at` never overwritten |
| `/api/webhooks/zoho-deals` | POST | Insert `deals` only (deduped on `deal_id`; 23505 silently ignored). The old `onboarding_conversion_ledger` dual-write was removed — the table is orphaned (dry-audit G4, drop/archive decision pending) |
| `/api/webhooks/zoho-calls` | — | **Not implemented** — README scaffold only |

**Webhook auth** (`lib/webhookAuth.ts`): `x-webhook-secret` header, `Authorization: Bearer`, or `?secret=` query param vs `WEBHOOK_SECRET` env (timing-safe compare). **Fail-closed in production** when the env var is unset (401 everything); fail-open in dev only. ⚠️ The `?secret=` query param is an anti-pattern (URLs land in proxy/access logs) — kept until the Freshdesk/Zoho automation configs are confirmed not to use it (dry-audit E5); prefer the header. Helpers: `lib/webhookGuard.ts` (POST wrapper, currently unused — Zoho routes share `lib/zohoWebhook.ts` instead to keep their richer error responses), `lib/apiGuard.ts` (GET wrapper + `noStoreJson`, adopted by all GET routes).

Freshdesk status sets used by the webhook (all imported from `lib/ticketStatus.ts`):

```ts
TERMINAL_STATUSES        = { resolved, closed }
SLA_SAFE_STATUSES        = { resolved, closed, nudge client, ongoing delivery, invoice due, spam, deleted }
ACTIVE_CLEAR_RESOLVED_AT = { open, pending, nudge client, nudge vendor, ongoing delivery, invoice due }
VOID_STATUSES            = { spam, deleted }
```

---

## 10. Hooks Reference

| Hook | Role |
|---|---|
| `useDashboardData` | Central concierge state: fetches `/api/tickets/rows`, `/api/clients`, `/api/jokers`, `/api/renewals-panel`; 4 Realtime channels; 5-min polling; returns `{ ananyshreeStats, anishqaStats, renewalsAnanyshree, renewalsAnishqa, recommendations, isInitialLoading }` |
| `useOnboardingPanelData` | Revenue state: `/api/onboarding` + deals/leads Realtime (`useRealtimeChannel`); debounced 2.5 s refetch; returns concierge/shop agents, ledger, pulse events, `leadMonthStats`, `verticalTrendline`, `ledgerScrollDuration`, `leadStatusByAgent`, `todayDate` |
| `useCelebrationDetection` | Diffs `tasksCompletedToday` to fire celebrations |
| `useKeyboardControls` | TV remote / keyboard freeze + screen switching |
| `usePrefersReducedMotion` | `matchMedia` hook — skip infinite effects when true |

---

## 11. Lib / Utilities Reference

| File | Contents |
|---|---|
| `lib/ticketStatus.ts` | **Single source** for VOID / TERMINAL / INCOMPLETE_SCORE / SLA_SAFE / ACTIVE_CLEAR_RESOLVED_AT sets + `isVoid` / `isTerminal` / `isIncompleteScoreStatus` |
| `lib/queendom.ts` | `normalizeQueendom()` — the only queendom/group matcher (`.includes()`, never equality) |
| `lib/ticketAggregation.ts` | All ticket math, void filter, agent stats, ranking, `pruneTicketRowsForDashboardState`, `TicketRowMinimal` |
| `lib/istDate.ts` | `istToday()`, timestamp parsing rules, IST month/day UTC bounds |
| `lib/agentRoster.ts` | Concierge rosters + `JOKER_ROSTER` |
| `lib/onboardingAgents.ts` | `normalizeZohoAgentName`, `getDisplayAgentName`, department lookup, `CONCIERGE_*`/`SHOP_*` card specs + fallback agents |
| `lib/specialDates.ts` | Static birthday/anniversary data |
| `lib/motionPresets.ts` | Shared Framer Motion presets (§5.6) |
| `lib/dashboardScreens.ts` | Screen order, durations, home-panel feature flag |
| `lib/dataSources.ts` | Integration registry (Freshdesk, Zoho paths, Realtime channels, `implemented` flags) |
| `lib/widgetRegistry.ts` | Widget inventory with mount status + data sources |
| `lib/env.ts` | `assertServerEnv()` |
| `lib/types.ts` / `lib/onboardingTypes.ts` / `types/index.ts` | All shared interfaces: `QueenStats`, `TicketStats`, `AgentStats`, `MemberStats`, `JokerStats`, `SpecialDate`, `OnboardingAgentRow`, `OnboardingLedgerRow`, `LeadMonthStats`, `VerticalTrendPoint`, `LeadStatusByAgent`, `QueendomId`, `ActiveScreen` (now includes `"home"`), `RenewalsPanelData`, `DisplayOutlay`, `JokerRecommendationItem` |
| `scripts/importTickets.ts` | One-off CSV ticket import (`npm run import-tickets`) |
| `components/onboarding/utils.ts` | Onboarding typography clamp constants, formatters, portrait resolver |
| `components/_unmounted/finance-utils.ts` | `PAID_EXIT_MS=2500`, `parseAmount`, `rowToDisplay` |

---

## 12. Agent & Joker Rosters

> Source of truth: `lib/agentRoster.ts` (a name missing there silently zeroes that agent's stats on the TV).

**Queendom Ananyshree (9):** Sanika Ahire, Sakshi Bhutkar, Poorti Gulati, Anshika Eark, Ajith Sajan, Khushi Shah, Palak Kataria, Athul Jose, Ritika Jain.

**Queendom Anishqa (10):** Sagar Ali, Savio Francis Fernandes, Pranav Gadekar, Dhanush K, Charlotte Dias, Ria Pujhari, Rupali Chodankar, Eeti Srinivsulu, Ekta Nihalani, Rutika Kale.

**Jokers:** Lilian Albrecht → ananyshree · Shruti Sharma → anishqa.

**Onboarding (Concierge dept):** Amit, Meghana, Samson, Kaniisha. **Shop dept:** Vikram, Katya, Harsh. Portraits in `onboarding-agents-images/*.webp`; department lookup keyed on lowercase first name.

---

## 13. Environment Variables & Setup

| Variable | Used by | Required |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | both Supabase clients | Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | browser Realtime client | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | all API routes | Yes (routes 503 without it) |
| `WEBHOOK_SECRET` | webhook auth | **Fail-closed in production** if missing (401 all webhooks); fail-open in dev only |
| `NEXT_PUBLIC_HOME_PANEL_ENABLED` | Home screen rotation | Optional (`"true"` to enable WIP home panel) |

Run: `npm run dev` (local) / `npm run build && npm start` (production TV).

---

## 14. Critical Invariants

Violating any of these silently corrupts the numbers on the TV:

1. **IST everywhere** — never `new Date().toISOString().slice(0,10)` for "today".
2. **Void tickets stripped first** — spam/deleted never count anywhere.
3. **Terminal = {resolved, closed} only** — void ≠ terminal.
4. **Cohort math anchored to `created_at`**, not `resolved_at`.
5. **Only the escalation-only webhook path may set `is_escalated=true`**; the full-upsert path must omit the field for active non-SLA-safe statuses.
6. **Freshdesk timestamps go through `freshdeskTimestampToIsoUtcForDb()`** — never store naive datetimes.
7. **Anon client = Realtime only**; all fetching via API routes + service role.
8. **Supabase clients are module-level singletons** — never `createClient` in a component/hook.
9. **Queendom matching via `.includes()`**, never strict equality.
10. **Postgres `23505` on lead/deal insert = expected dedup**, not an error.
11. **Soft-delete only** for tickets.
12. **Both/all screens always mounted** — rotation is opacity/zIndex only.

---

## 15. Known Gaps, Unmounted & WIP

- **Home panel** — built but production-off (`NEXT_PUBLIC_HOME_PANEL_ENABLED`).
- **`/api/webhooks/zoho-calls`** — README only, no route; `dataSources.ts` marks `implemented: false`.
- **Finance widgets** (`ActiveOutlays`, `OutlayLedger`) and onboarding charts (`LeadVelocityChart`, `AgentVerticalBarChart`) — parked in `components/_unmounted/` (see its README; the charts' server data pipeline was removed and must be rebuilt before re-mounting).
- **`onboarding_conversion_ledger` table** — orphaned in the DB (no reads or writes); drop/archive decision pending (dry-audit G4).
- Rotation timing source of truth: `lib/dashboardScreens.ts` — **concierge 60 s / onboarding 10 s / home 30 s**.

---

## 16. Migrations Log

17 migrations in `supabase/migrations/`:

| Migration | Description |
|---|---|
| `20250318000000` | tickets: add `is_escalated` |
| `20250318100000` | tickets: add `tags` JSONB |
| `20250318110000` | create `jokers` |
| `20250318120000` / `…130000` | seed renewals (Ananyshree / Anishqa) |
| `20250401120000` | create `finance_outlays` |
| `20250401140000–160000` | create `onboarding_lead_touches` (now `leads`) + Realtime + RLS |
| `20250401170000–180000` | create `onboarding_conversion_ledger`; queendom default `''` |
| `20250409120000` | ledger: add `deal_id` + partial unique index |
| `20260417000000` | lead_touches: add intent/lead_name/company (later partly dropped) |
| `20260424120000` | leads/deals reschema; create `onboarding_deals` |
| `20260425152000` | rename `onboarding_deals` → `deals` |
| `20260425180000` | rename to `leads`; add `business_vertical` |
| `20260508000000` | tickets: add `is_incomplete` |

**Canonical table names today:** `leads`, `deals`, `onboarding_conversion_ledger`.

---

*Compiled 2026-06-11. When code and this document disagree, update this document — it is meant to stay the master.*
