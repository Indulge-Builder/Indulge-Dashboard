# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

A 24/7 real-time TV broadcast dashboard for **Indulge**, an Indian luxury concierge agency. It runs fullscreen on a 4K office TV (no cursor, no scroll) and auto-rotates between a **Concierge** screen (two teams called "Queendoms" — *Ananyshree* and *Anishqa* — handling Freshdesk tickets) and a **Revenue/Onboarding** screen (Zoho CRM leads and deals). Data is pushed into Supabase by webhooks; the browser subscribes via Supabase Realtime, so the TV updates within seconds.

**Deeper references in this repo** (read these before broad changes):

- `docs/master.md` — complete reference: every screen/panel, design system, DB schema, API surface, rosters. Compiled 2026-06-11; supersedes `blueprint.md` / `design.md` where they disagree.
- `docs/dry-audit.md` — refactor audit (2026-06-11): known duplication, dead code, and contradictions, with an active phased cleanup plan. Check it before "fixing" something that looks redundant — it may already have a decided plan.

## Commands

```bash
npm run dev              # Next.js dev server
npm run build            # production build
npm run lint             # next lint
npm run import-tickets   # one-off CSV ticket import (tsx scripts/importTickets.ts)
```

There is no test framework configured.

Stack: Next.js App Router + React 18 + TypeScript, Tailwind CSS, Framer Motion, Supabase (`@supabase/supabase-js`).

## Critical Invariants

Violating any of these causes **silently wrong metrics on the TV**:

1. **IST timezone is mandatory.** All "today" / "this month" logic goes through `lib/istDate.ts` (`istToday()`, `getCurrentIstMonthUtcBounds()`, …). Never use `new Date().toISOString().slice(0, 10)` — that's UTC, not India time.
2. **VOID tickets (`spam`, `deleted`) are stripped before ALL math** — the first step of every aggregation. They never count toward Received, Resolved, Pending, or agent stats.
3. **TERMINAL statuses are `{resolved, closed}` only.** `spam`/`deleted` are void, not terminal. The authoritative sets (and the webhook's SLA policy sets) live in `lib/ticketStatus.ts` — never redefine them locally.
4. **Cohort math is anchored to `created_at`.** "Resolved This Month" = tickets *created* this IST month whose status is now terminal — not tickets resolved this month.
5. **`is_escalated` can only be set `true` by the escalation-only webhook path** in `app/api/webhooks/freshdesk/route.ts`. The full-upsert path must omit the field for active non-SLA-safe statuses (preserves the DB value).
6. **Freshdesk timestamps are naive IST strings.** Always pass them through `freshdeskTimestampToIsoUtcForDb()` (`lib/istDate.ts`) before storage, or Postgres will treat them as UTC and shift everything by +5:30.
7. **The browser Supabase client (anon key, `lib/supabase.ts`) is for Realtime ONLY.** All data fetching goes through Next.js API routes using `supabaseAdmin` (service role, `lib/supabaseAdmin.ts`). Both clients are module-level singletons — never call `createClient` inside a component or hook.
8. **Queendom/group name matching uses `.includes()`, not equality** (Freshdesk sends e.g. `"Team Ananyshree"`) — always via `normalizeQueendom()` in `lib/queendom.ts`.
9. **Postgres error `23505` (PK violation) on `leads.lead_id` or `deals.deal_id` is expected dedup behavior**, not an error — silently ignore it.
10. **Soft-delete only.** Tickets are never `DELETE`d; deletion sets `status = "deleted"` and the VOID filter hides the row.
11. **Both screens stay always-mounted — ON THE TV TREE ONLY.** Rotation in `DashboardController.tsx` only crossfades opacity/zIndex — never unmount a screen to "optimize". The mobile tree (`components/mobile/`, added 2026-08-20) deliberately does the opposite: only the active tab renders (battery), rotation is replaced by tabs, and the marquee ticker by static alert lines. `components/DashboardRoot.tsx` splits the two by media query — its MOBILE_QUERY must stay identical to the mobile CSS override in `app/globals.css` (which unlocks html/body scrolling and resets the TV's root font-size slope on phones).
12. **Viewing can be passcode-gated** via `DASHBOARD_PIN` (lib/viewerGate.ts) — OPT-IN: unset → open (the TV deployment needs no config), set → 30-day signed cookie per device. Distinct from SETTINGS_PIN. Planned to be replaced by Supabase Auth shared with the Subscription Manager project.

## Architecture

### Data flow (push-based, no client-side CRM calls)

```
Freshdesk ticket event → POST /api/webhooks/freshdesk → upsert `tickets`
Zoho lead event        → POST /api/webhooks/zoho-leads → upsert `leads`
Zoho deal event        → POST /api/webhooks/zoho-deals → insert `deals`
Google Sheet sync      → `jokers` table (external)
        ↓ Supabase Realtime push
hooks/useDashboardData.ts        → concierge screen state (tickets/clients/jokers/renewals channels)
hooks/useOnboardingPanelData.ts  → revenue screen state (deals/leads channels, debounced /api/onboarding refetch)
        ↓
components/Dashboard.tsx → DashboardController.tsx (rotation) → QueendomPanel / OnboardingLayout / HomePanel
```

- **Ticket aggregation happens client-side**: `/api/tickets/rows` returns minimal rows; `lib/ticketAggregation.ts` computes all queendom/agent metrics in the browser and re-derives them on each Realtime patch. The webhook route in `app/api/webhooks/freshdesk/route.ts` is a three-path dispatcher (deletion / escalation-only / full upsert) — read its header comment before touching it.
- **Screen rotation config lives in `lib/dashboardScreens.ts`**: order, per-screen durations (concierge 60s, onboarding 10s, home 30s), and the `NEXT_PUBLIC_HOME_PANEL_ENABLED` gate for the WIP Home screen (`components/HomePanel.tsx`).
- **Keyboard/TV-remote controls** (`hooks/useKeyboardControls.ts`): `P`/`Space`/`Enter` = freeze toggle, arrow keys = manual screen switch.
- **`components/_unmounted/`** holds built-but-not-mounted widgets (finance outlays, bar/velocity charts). Don't mount them without wrapping in `ErrorBoundary`; don't delete them.
- The legacy `/api/tickets` (server-side aggregation) and `/api/agents` routes were deleted 2026-06-11 (dry-audit G1) — `/api/tickets/rows` + client-side aggregation is the only ticket path.

### Database (Supabase, `supabase/migrations/`)

Core tables: `tickets` (Freshdesk, PK `ticket_id`), `leads` (Zoho, PK `lead_id`), `deals` (Zoho, PK `deal_id`), `onboarding_conversion_ledger` (sales ledger UI), `jokers`, `clients`, `renewals`, `members`, `agents`, `finance_outlays`. All have Realtime enabled and the same RLS pattern (anon SELECT, authenticated ALL; service role bypasses). Canonical names after renames: `leads` (not `onboarding_lead_touches`), `deals` (not `onboarding_deals`). Full column-level schema is in `docs/master.md` §8.

## Environment Variables

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | both Supabase clients |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | browser client (Realtime only) |
| `SUPABASE_SERVICE_ROLE_KEY` | `supabaseAdmin` — all API routes return 503 if missing |
| `WEBHOOK_SECRET` | webhook auth (`x-webhook-secret` header); **fail-closed in production** if unset, fail-open in dev |
| `NEXT_PUBLIC_HOME_PANEL_ENABLED` | set `true` to preview the WIP Home screen in rotation |
| `SETTINGS_PIN` | shared PIN for `/settings`; **fail-closed in production** if unset, fail-open in dev (same policy as `WEBHOOK_SECRET`) |

### Settings page (`/settings`, added 2026-08-11)

A PIN-locked admin surface so non-technical staff can change things that used to require a code edit. Three tabs: **Agents** (the roster), **Renewals** (`renewals` rows), **New Clients** (`members` rows). Notes that matter:

- **The roster now lives in the `agents` table**, not `lib/agentRoster.ts`. `GET /api/roster` serves it; `useDashboardData` threads it into `mergeAndRankAgents(rows, roster)`. The hardcoded arrays remain as `FALLBACK_ROSTER` and are still the default parameter — an empty, missing, or unreachable `agents` table leaves the TV exactly as it was, so **do not delete them**.
- **Anything this app writes to `renewals` / `members` must use `QUEENDOM_LABEL`** (`lib/queendom.ts`) — `"Ananyshree Queendom"` / `"Anishqa Queendom"`. Those two tables were normalised to that form on 2026-08-11 (from `"ananyshree"` and `"Ananyshree's Queendom"` respectively) and a BEFORE-trigger keeps them there. `tickets` / `jokers` / `clients` were deliberately left on their own spellings — reads still go through `normalizeQueendom()`.
- **`renewals.created_at` / `members.created_at` are the business date, not the insert time** (renewal date / assignment date). The panel month-gates on them, so the Settings form writes a chosen date through `timestampStringToIsoUtcForDb()` — IST midnight.
- `/api/settings/*` routes verify the session cookie themselves via `withSettingsGuard`; the UI's PIN gate is convenience only.

## Known Sharp Edges

- **Overdue and Incomplete carry forward; every other metric (incl. Pending) is month-gated** (dry-audit **D2**, revised 2026-07-02): an escalated or incomplete ticket from an earlier month keeps counting until cleared, so the leaderboard's overdue/incomplete scores never reset at month rollover — Overdue can therefore exceed the month-gated Pending. All other metrics (Received / Resolved / Today / Monthly / Pending / Joker) are gated by explicit `toISTDay`/`toISTMonth` checks in `lib/ticketAggregation.ts`. The rows route fetches "current IST month ∪ open backlog" and `pruneTicketRowsForDashboardState` keeps the same set. Any NEW metric must choose its gate explicitly — the input rows are no longer month-only.
- Both data hooks now share `hooks/useRealtimeChannel.ts` (5-min poll + `CHANNEL_ERROR`/`TIMED_OUT` → refetch + 3s resubscribe; dry-audit **C2**). Channel names (`dashboard-*`, `deals-live`, `leads-touches-live`) are contractual — never rename them, and always clean up via `removeChannel` (the shared hook does both).
- Hidden screen layers stay mounted but pause their own clocks via `useScreenActive()` (rAF ledger scroll, HomePanel clocks) — resume is seamless because state lives in refs (dry-audit **H3/H4**).
- **Never bulk-import ticket CSVs through the Supabase table editor** — Freshdesk exports carry naive IST wall-clock timestamps and the table editor stores them verbatim as UTC, shifting every instant +5:30 into the future (froze the ResolveStopwatch at 00:00 on 2026-07-03, and skewed every IST-gated metric). The only sanctioned path is `npm run import-tickets -- <csv>` (`scripts/importTickets.ts`), which routes all timestamps through `lib/istDate.ts` — the same conversion service the Freshdesk webhook uses — and aborts if any converted timestamp lands in the future. It accepts both Freshdesk-style and DB-style CSV headers. Note a wipe-and-reimport resets webhook-maintained columns not present in exports (`is_incomplete`, `tags`).
- **The Joker roster was stale and silently zeroing a whole panel** (found 2026-08-11): `JOKER_ROSTER` named `"Shruti Sharma"` for anishqa, who has zero rows in `jokers` — the 694 anishqa rows all belong to `"Anil Talluri"`, so every anishqa Joker metric read 0. `/api/jokers` now resolves joker names from the `agents` table (`role = 'joker'`). Separately, `jokers` has had **no row newer than 2026-03-31** and the route is IST-month-gated, so both panels read 0 regardless — that upstream sync looks dead and is worth checking before trusting the Joker panel.
- **`jokers.queendom_name` is misspelled both ways** — `"ananyashree"` (extra `a`, 770 rows) and `"anisqa"` (missing `h`, 694 rows). Neither resolves through `normalizeQueendom()`. Harmless today only because `/api/jokers` keys off `joker_name`; any new code that trusts that column will silently drop every row. `onboarding_conversion_ledger.queendom_name` is empty string in all 109 rows for the same class of reason.
- `POST /api/webhooks/zoho-calls` is not implemented (README scaffold only).
- `onboarding_conversion_ledger` is orphaned in the DB (nothing reads/writes it); drop/archive decision pending (dry-audit **G4**).
