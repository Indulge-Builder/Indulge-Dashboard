# Indulge Live Dashboard — Product Blueprint

> **The vision, features, and workflows of this product.** What we're building, why, what exists today, how data and people move through it, and how we develop on it.
>
> Rewritten 2026-06-11. For exhaustive technical detail this document defers to:
> `docs/master.md` (full reference — schema, API, components) · `docs/design.md` (visual system) · `claude.md` (AI-assistant context + critical invariants) · `docs/dry-audit.md` (active refactor plan).

---

## 1. Vision

**Indulge** is an Indian luxury concierge agency (Indulge Global) serving high-net-worth members across four business verticals: **Indulge Global** (concierge), **Indulge Shop**, **Indulge House**, and **Indulge Legacy**.

The **Live Dashboard** is the company's heartbeat on the office wall: a 24/7 broadcast instrument running fullscreen on a 75"+ 4K TV — no cursor, no scroll, no interaction beyond a TV remote. It exists to make the whole company feel the business move in real time:

- **Operations visibility** — every Freshdesk ticket a concierge agent touches is on the wall within seconds.
- **Healthy competition** — two operational teams ("**Queendoms**": *Ananyshree* and *Anishqa*, ~9 agents each) are displayed side-by-side with live leaderboards. Sales agents see their leads, closures, and pipeline next to their portrait.
- **Celebration culture** — when an agent completes a task, the entire screen erupts in a gold celebration with their name and a chime. Wins are *earned spectacle*; the default state is calm, quiet luxury (see `docs/design.md` §1).
- **Zero maintenance** — data is pushed in by webhooks (Freshdesk, Zoho CRM) and a Google Sheet sync; the TV self-updates via Supabase Realtime. Nobody should ever have to touch it.

Product principles that follow from this:

1. **The TV is the only user.** No auth screens, no navigation, no hover states. Readability from across a room beats density.
2. **Never visibly break.** Every widget is wrapped in an `ErrorBoundary`; one failure shows a small "OFFLINE" state, never a black screen.
3. **Never visibly stale.** Realtime first, 5-minute polling as a safety net, optimistic patches for instant feedback.
4. **Numbers must be trusted.** A wrong metric on the wall is worse than no metric — hence the critical invariants in `claude.md` (IST timezone, VOID filtering, cohort math).

---

## 2. The Product Today — Screens

Rotation (config: `lib/dashboardScreens.ts`): **Concierge 60 s → Revenue 10 s** (→ Home 30 s when enabled), 1.5 s gold crossfade, all layers always mounted. PAUSE/RESUME and arrow-key switching via TV remote (`hooks/useKeyboardControls.ts`).

### 2.1 Concierge screen (the Queendoms)

Two mirrored panels, Ananyshree left / Anishqa right, separated by a gold rule. Each shows:

| Feature | What it tells the room |
|---|---|
| Wingspan header | Queendom name + active member counts (total / celebrity-complimentary) from the `clients` table |
| 5-metric hero row | Resolved Today (emerald) · Received Month (champagne) · Resolved Month (green) · Pending (red) · Joker Accepted (gold) — all animated counters |
| Renewals panel | Renewals this month (handwritten numeral) + renewal names + new member assignments |
| Agent leaderboard | Ranked agent rows: progress ring + crown for #1, today and month completed/assigned, pending/overdue/incomplete. Ranking: month completions, then today's |
| Special dates | Client birthdays & anniversaries (static data, `lib/specialDates.ts`) |
| Joker metrics strip | Lifestyle-suggestion stats for the Queendom's Joker (sent / accepted / rejected / pending / today / month) |

Bottom dock (both screens): the **Recommendation Ticker** — latest 15 Joker suggestions scrolling marquee-style.

### 2.2 Revenue screen (Onboarding / Sales)

Three columns:

- **Left — Onboarding department** (Amit, Meghana, Samson, Kaniisha): portrait cards with leads this month/today, closures, and a segmented pipeline health bar per agent (Qualified / In Discussion / Nurturing / Attempted / New / Junk).
- **Center** — month stat tiles (leads / attended / deals closed / junk), the **Performance Line Graph** (one line per business vertical, current IST month by day), and the auto-scrolling **Conversion Ledger** of closed deals.
- **Right — Shop department** (Vikram, Katya, Harsh), sky-blue themed.

Agent cards flash a gold foil sweep + metric pulse when their numbers move.

### 2.3 Home screen (WIP — off in production)

Gated behind `NEXT_PUBLIC_HOME_PANEL_ENABLED=true`. Four world clocks (Mumbai, London, New York, Dubai) in glass cards + a daily rotating luxury quote. Intended as a calm "breather" screen in the rotation.

### 2.4 Cross-screen moments

- **Celebration overlay** — fires when any agent's `tasksCompletedToday` increases: full-screen gold backdrop, glowing avatar, shimmer name, Web Audio chime, ~3 s, one at a time.
- **Skeleton overlays** — pixel-stable loading states per screen so the TV never shows a layout jump on boot.

---

## 3. Feature Inventory & Status

Machine-readable registries: `lib/widgetRegistry.ts` (every widget: screen, data sources, `mounted` flag) and `lib/dataSources.ts` (every integration: webhook path, table, Realtime channel, `implemented` flag).

| Feature | Status |
|---|---|
| Queendom panels, leaderboard, renewals, special dates, joker strip, ticker | ✅ Live |
| Revenue dashboard (dept columns, line graph, ledger, pipeline bars) | ✅ Live |
| Celebration overlay | ✅ Live |
| Home panel (world clocks + quotes) | 🚧 Built, env-gated, off in production |
| Finance outlays (`ActiveOutlays`, `OutlayLedger`) | 📦 Built, parked in `components/_unmounted/` — table `finance_outlays` + Realtime ready; mount when product wants expense tracking |
| `LeadVelocityChart`, `AgentVerticalBarChart` | 📦 Parked in `_unmounted/` |
| Zoho **calls** integration | 📝 Planned — scaffold README at `app/api/webhooks/zoho-calls/`, `implemented: false` in `dataSources.ts` |
| Health-bar `GlossSweep` / `BreathingGlow` polish | 📝 Stubs returning `null` |

---

## 4. Data Workflows (end-to-end)

All data is **pushed** into Supabase; the dashboard never calls Freshdesk/Zoho directly. Full schema: `docs/master.md` §8.

### 4.1 Ticket lifecycle (Freshdesk → Queendom panels)

```
Agent works a ticket in Freshdesk
  → Freshdesk automation fires POST /api/webhooks/freshdesk (secret header)
  → Route dispatches one of three paths:
      deletion        → soft-delete (status="deleted"; row kept for audit)
      escalation-only → the ONLY path allowed to set is_escalated=true (SLA breach)
      full upsert     → status/agent/queendom upsert; timestamps converted from naive IST
  → Supabase Realtime pushes the row to the browser
  → useDashboardData patches ticketRows optimistically
  → lib/ticketAggregation.ts re-derives all metrics + leaderboard client-side
  → if an agent's completed-today count rose → CelebrationOverlay fires
```

Business rules that define the numbers (details in `claude.md` invariants):

- All "today"/"month" windows are **IST**. Metrics are **cohort-anchored to `created_at`** and **month-gated** — every metric, including Pending, counts only tickets created in the current IST month (product decision 2026-06-11, dry-audit D2).
- `spam`/`deleted` are **VOID** — invisible to every number. Terminal = `resolved`/`closed` only.

### 4.2 Lead lifecycle (Zoho CRM → Revenue dashboard)

```
Sales agent creates/updates a lead in Zoho
  → POST /api/webhooks/zoho-leads (JSON or form-encoded)
  → upsert into `leads` on lead_id (created_at immutable; status/vertical/name refreshed)
  → Realtime → useOnboardingPanelData: pulse on the graph + debounced (2.5 s) /api/onboarding refetch
  → agent card counts, pipeline bars, vertical trendline update
```

### 4.3 Deal lifecycle (Zoho CRM → Conversion ledger)

```
Deal closes in Zoho
  → POST /api/webhooks/zoho-deals
  → insert into `deals` (PK dedup: 23505 = already recorded, silently ignored)
  → Realtime → optimistic prepend to the ledger + pulse + debounced refetch
```

### 4.4 Everything else

- **Jokers** — an external Google Sheet sync writes lifestyle suggestions to the `jokers` table; drives the metrics strip + ticker. `response` field: `"yes"` accepted, `"no"` rejected, else pending.
- **Renewals / members / clients** — written by external processes into their tables; the dashboard reads via `/api/renewals-panel` and `/api/clients` and subscribes to inserts.
- Webhook auth: `x-webhook-secret` or Bearer header vs `WEBHOOK_SECRET` (fail-open if unset).

---

## 5. Operational Workflow (running the TV)

1. Deploy serves `/` — `Dashboard` mounts both/all screen layers, kicks off fetches + 6 Realtime channels.
2. Skeletons cover each screen until its first payload lands; rotation then runs unattended.
3. Office staff can freeze the rotation with the remote (`P`/`Space`/`Enter`/`MediaPlayPause`) or step screens with arrows; the PAUSE button is sized for TV-remote pointer accuracy.
4. Resilience: 5-minute polling backstop, channel-error reconnects (onboarding hook today; concierge hook being brought to parity — dry-audit C2), memory pruning of ticket rows every 5 minutes (handles IST month rollover without a reload).
5. If a widget throws, its ErrorBoundary shows OFFLINE for that region only; the rest of the TV keeps broadcasting.

---

## 6. Development Workflow

### 6.1 Working on the codebase

- `npm run dev` / `npm run build` / `npm run lint`. No test framework — verification is build + screenshot-diffing both screens at 1280 px and 1920 px (the TV never gets to look different by accident).
- **Read first:** `claude.md` invariants before touching metrics/webhooks; `docs/design.md` §12 checklist before any UI work; `docs/dry-audit.md` before "cleaning up" anything that looks redundant — it may already have a decided plan and sequence.
- Doc hierarchy when sources disagree: **code > `docs/master.md` > everything else**.

### 6.2 Adding a widget

Follow `lib/widgetRegistry.ts` header: add the `WidgetId`, register the config (`mounted: false` until ready), build the component on the primitives (`GlassPanel`, `StatCard`, `SectionDivider`, motion presets), then mount it in its screen component wrapped in `ErrorBoundary`. Flip `mounted: true`.

### 6.3 Adding a data source / integration

Follow `lib/dataSources.ts` header: add the `DataSourceId` + config, create `app/api/webhooks/<id>/route.ts` (use the auth + parse patterns of the existing Zoho routes), create the table via a new migration in `supabase/migrations/` (include Realtime publication + the standard RLS pair: anon SELECT, authenticated ALL), then register consuming widgets. The unbuilt `zoho-calls` scaffold documents this path.

### 6.4 Schema changes

Timestamped SQL files in `supabase/migrations/` (`YYYYMMDDHHMMSS_description.sql`). Always: enable Realtime for new tables, apply the standard RLS pattern, and prefer renames/backfills over destructive changes (see the lead/deal rename migrations for the pattern). Never `DELETE` ticket rows — soft-delete only.

### 6.5 Active refactor (dry-audit, 2026-06-11)

A phased DRY cleanup is in flight — each phase shippable and screenshot-gated:

- ✅ **Phase 0** (done 2026-06-11): dead routes `/api/tickets` + `/api/agents` deleted (G1), dead deps removed, charts moved to `_unmounted/`, dead exports pruned.
- ✅ **D2 decided**: Pending is month-gated (see §4.1).
- ⏳ **Phases 1–6**: single-source ticket-status sets → API-route guard adoption → client fetch/Realtime consolidation (incl. the C2 reconnect fix + AudioContext leak) → UI primitive adoption → hidden-layer power management → doc reconciliation.
- ❓ **Open decision items**: G4 (fate of `onboarding_conversion_ledger` table), G6 (card-win-shimmer: rebuild or remove plumbing), E5 (`?secret=` webhook param in use?), I1 (confirm roster correctness — a wrong roster silently zeroes an agent's stats).

---

## 7. Roadmap Snapshot

Near-term, in rough order of intent:

1. Finish dry-audit Phases 1–3 (correctness + 24/7 resilience: shared status sets, `useDashboardData` reconnect parity, AudioContext fix).
2. Resolve open decisions G4 / G6 / E5 / I1.
3. Ship the **Home panel** into the rotation once content is approved (currently env-gated).
4. **Zoho calls** integration (`zoho-calls` data source) — call-activity stats for the revenue screen.
5. Mount **finance outlays** when product wants live expense tracking on the Queendom panels.

---

*Rewritten 2026-06-11 as a product blueprint (vision / features / workflows). The previous exhaustive technical reference this file used to hold lives in `docs/master.md`.*
