# INDULGE ATLAS — HOLY GRAIL
### The Absolute Source of Truth for the Indulge Live Dashboard

> **Mandate.** Every developer — human or AI — touching this repository must treat this document as the supreme reference for design, architecture, data contracts, and developer workflow. Nothing here is aspirational: every rule, variable, and pattern is derived directly from the live codebase as of May 2026.

---

## Table of Contents

1. [Core Philosophy & Aesthetic Rules](#1-core-philosophy--aesthetic-rules)
2. [Architecture & Performance Mandates](#2-architecture--performance-mandates)
3. [The Data Engine & Timezones](#3-the-data-engine--timezones)
4. [The Module Dictionary](#4-the-module-dictionary)
5. [Agent & Department Mapping — The In-Memory Roster](#5-agent--department-mapping--the-in-memory-roster)
6. [The Developer Workflow Checklist](#6-the-developer-workflow-checklist)
7. [Appendix: Key Invariants (Breaking Any of These Is a Bug)](#7-appendix-key-invariants)

---

## 1. Core Philosophy & Aesthetic Rules

### 1.1 The Design Language: "Quiet Luxury / Cinematic HUD"

The Indulge dashboard is not a web app. It is a **24/7 broadcast experience** rendered on a large-format television in a luxury office. Every design decision flows from three constraints:

1. **Legibility at distance.** Text is never small. Font sizes are fluid `clamp()` values tied to viewport width, never fixed pixels below `1.2rem`.
2. **Zero cognitive load.** The screen must be parseable in under three seconds from across a room. Hierarchy is enforced with light (glow), weight (gold), and motion (entrance stagger), not colour alone.
3. **Quiet luxury, not visual noise.** The palette is almost monochromatic — obsidian black, muted gold, champagne white. Emerald and sky blue appear only as functional signals (resolved = good, shop = sky). Nothing is bright for brightness's sake.

#### The Four Laws of Indulge UI

| # | Law | Consequence of breaking it |
|---|-----|---------------------------|
| 1 | **No external chart libraries** (Recharts, Chart.js, Victory, etc.) | Bundle bloat, proprietary rendering paths, uncontrollable repaint on 24/7 displays |
| 2 | **No fixed pixel font sizes** | Breaks fluid scaling across 1280px → 4K |
| 3 | **No `box-shadow` inside animation loops** | Forces GPU repaint every frame; use `opacity` animation on a static shadow layer instead |
| 4 | **No white-screen state** | Every widget must be wrapped in `<ErrorBoundary>` |

---

### 1.2 The Design Token System — `app/globals.css`

All tokens live in the `:root` block. **Never hardcode hex values in components.** Always reference a CSS variable or a Tailwind class that maps to one.

#### Surfaces

| Variable | Value | When to Use |
|----------|-------|-------------|
| `--bg-obsidian` | `#050507` | Root background; ErrorBoundary fallback wrapper |
| `--obsidian` | `#050505` | Legacy alias for `--bg-obsidian`; prefer `--bg-obsidian` |
| `--surface-glass` | `rgba(10,10,10,0.85)` | Glass card background (also `.glass` utility) |
| `--surface-card` | `rgba(10,10,10,0.92)` | Higher-opacity card surfaces (skeleton base) |
| `--surface-elevated` | `rgba(15,15,20,0.85)` | Skeleton shimmer shoulder colour |
| `--surface-inset` | `rgba(0,0,0,0.5)` | Inset wells inside cards (e.g. count badges) |
| `--surface-joker` | linear-gradient (gold tint) | Joker metric box background only |

#### Gold Spectrum

| Variable | Hex / rgba | When to Use |
|----------|-----------|-------------|
| `--gold-primary` | `#d4af37` | Primary gold: headings, active states, borders |
| `--gold-bright` | `#f9e27e` | Liquid-gold highlight: shimmer peaks, ticker text |
| `--gold-accent` | `#c9a84c` | SVG strokes and inline `rgba(201,168,76)` for ambient glows |
| `--border-gold-dim` | `rgba(212,175,55,0.08)` | Near-invisible border for ErrorBoundary and quiet containers |
| `--border-gold-subtle` | `rgba(212,175,55,0.15)` | Default glass card border companion |
| `--border-gold-mid` | `rgba(212,175,55,0.25)` | Section separator lines |
| `--border-gold-bright` | `rgba(212,175,55,0.55)` | Active / focus ring / hot-lead card border |
| `--shadow-gold-sm` | `0 0 12px rgba(…35%)` | Tight glow on icons/pills |
| `--shadow-gold-md` | `0 0 28px rgba(…22%)` | Mid-range glow on cards |
| `--shadow-gold-lg` | `0 0 48px rgba(…16%)` | Wide halo for major panels |

#### Status Accent Colours

| Variable | Hex | Signal |
|----------|-----|--------|
| `--color-emerald` | `#34d399` | Success: resolved today, completed tasks, positive metrics |
| `--color-emerald-dim` | `rgba(52,211,153,0.2)` | Emerald background tint |
| `--color-emerald-glow` | `rgba(52,211,153,0.28)` | Emerald drop shadow |
| `--color-red` | `#f87171` | Error/danger: pending, overdue, negative |
| `--color-red-overdue` | `#ff0000` | Pure red with neon glow — used ONLY for `overdueCount > 0` in leaderboard |
| `--color-amber` | `#fcd34d` | Warning / intermediate state |
| `--color-sky` | `#7dd3fc` | Shop department accent; mirrors `--gold-primary` role for the right column |
| `--color-champagne` | `#f5e6c8` | Body text; agent names; secondary content |

#### Typography Scale (Fluid `clamp()` Values)

**Rule:** All font sizes in components must use `style={{ fontSize: "var(--text-…)" }}` or equivalent Tailwind mapping. Never write `text-[42px]` or `text-4xl` for any content that appears on the TV display.

| Variable | Clamped Range | Use Case |
|----------|--------------|----------|
| `--text-counter-hero` | `4.5rem → 9rem` | Giant scoreboard numbers (never used inline — reserved) |
| `--text-counter-xl` | `2.3rem → 4.7rem` | Queendom scorecard primary numbers |
| `--text-counter-lg` | `2rem → 4.1rem` | Agent leaderboard count values |
| `--text-counter-md` | `1.65rem → 2.7rem` | Secondary counters |
| `--text-heading-xl` | `2rem → 4.4rem` | Queendom name in header |
| `--text-heading-lg` | `1.65rem → 3.85rem` | Panel section titles |
| `--text-heading-md` | `1.5rem → 3.25rem` | Section sub-titles, leaderboard headers |
| `--text-label-xl` | `30px → 46px` | Scorecard metric labels |
| `--text-label-lg` | `1.5rem → 3rem` | Column headers |
| `--text-label-md` | `1.2rem → 2.2rem` | Small labels, ErrorBoundary body copy |
| `--text-ob-page-title` | `2.2rem → 4.6rem` | Onboarding panel page title |
| `--text-ob-agent-name` | `1.6rem → 5.5rem` | Onboarding agent card names |
| `--text-ob-metric-value` | `1.6rem → 6rem` | Onboarding metric numbers |
| `--text-ob-metric-sub` | `1.35rem → 2.55rem` | Onboarding metric sublabels |
| `--text-ob-ledger-cell` | `1.3rem → 3.6rem` | Conversion ledger rows |
| `--text-fin-cell` | `1.725rem → 5.25rem` | Finance outlay ledger cells |

#### Spacing & Layout Tokens

| Variable | Range | Use |
|----------|-------|-----|
| `--pad-panel` | `12px → 40px` | Outer panel padding |
| `--pad-card` | `10px → 28px` | Card inner padding |
| `--pad-cell` | `6px → 14px` | Table cell / metric cell padding |
| `--gap-card` | `0.65rem → 2rem` | Gap between stacked cards |
| `--radius-card` | `1rem` | Standard card border radius |
| `--radius-panel` | `1.5rem` | Outer panel border radius |
| `--radius-pill` | `9999px` | Pill badges and buttons |
| `--size-celebration-avatar` | `140px → 300px` | Celebration overlay portrait |

#### Animation Timing Tokens

| Variable | Value | Use |
|----------|-------|-----|
| `--duration-crossfade` | `1.5s` | DashboardController screen switch |
| `--duration-counter` | `0.7s` | AnimatedCounter number transition |
| `--duration-row` | `0.55s` | Leaderboard row entrance |
| `--ease-luxury` | `cubic-bezier(0.25,0.46,0.45,0.94)` | All smooth deceleration transitions |

#### The Noise Overlay

The `body::before` pseudo-element applies a 3% opacity SVG fractal noise texture over the entire viewport. This is the subtle film-grain texture that elevates the aesthetic from "dark website" to "cinematic broadcast". **Never remove it.**

```css
body::before {
  background-image: url("data:image/svg+xml,…feTurbulence…");
  opacity: 0.03;
  pointer-events: none;
  z-index: 0;
}
```

---

### 1.3 The Utility Class System

These are defined in `@layer utilities` in `globals.css`. Use them; do not reinvent them inline.

| Class | Effect | Use |
|-------|--------|-----|
| `.glass` | `bg rgba(10,10,10,0.85)` + gold border | Default glass card |
| `.glass-pill` | Same, slightly more opaque | Pill chips and badges |
| `.gold-border-glow` | Inset box-shadow glow | Subtle inner border effect |
| `.queen-name-glow` | Triple-layer gold text-shadow | Queendom name headings |
| `.sky-name-glow` | Triple-layer sky text-shadow | Shop department headings |
| `.gold-glow` | Triple-layer gold text-shadow (lighter) | Gold metric values |
| `.emerald-glow-hero` | Emerald text-shadow | "Solved Today" number |
| `.joker-box` | Gold-tinted border + gradient bg | Joker metric boxes |
| `.monthly-error-glow` | Red text-shadow 50% | Overdue count label |
| `.error-overdue-glow` | `color: #ff0000` + neon red glow | Overdue count value (only when >0) |
| `.tabular-nums` | `font-variant-numeric: tabular-nums` | All numeric columns |
| `.celebration-shimmer-text` | Animated gold gradient clip | New renewal/assignment names |
| `.skeleton-block` | Gold-foil shimmer animation | Loading placeholders |
| `.hot-lead-card-pulse` | Pulsing gold border glow | Freshest lead card indicator |
| `.ambient-glow-center` | Full-screen center radial | Dashboard root wrapper |
| `.ambient-glow-left` | Left panel radial (25% 45%) | Ananyshree panel |
| `.ambient-glow-right` | Right panel radial (75% 45%) | Anishqa panel |
| `.ambient-glow-stage` | Center radial (50% 38%) | Onboarding panel |
| `.ambient-glow-column` | Wide column radial | Center separator column |
| `.separator-gold-h` | 1px horizontal gold gradient | Section dividers |
| `.separator-gold-v` | 1px vertical gold gradient | Column separators |
| `.card-gradient-overlay` | Top-left gold highlight | Glass card inner overlay |
| `.renewal-card-text` | Vertical gold gradient clip text | Renewal/assignment client names |

---

### 1.4 The Font Stack

Defined in `app/layout.tsx` as Next.js font variables:

| Variable | Family | Weight | Use |
|----------|--------|--------|-----|
| `font-cinzel` | Cinzel (Google) | 400–700 | Queendom names, section titles, ErrorBoundary headings |
| `font-inter` | Inter (system) | 400–700 | Body text, metrics, leaderboard |
| `font-baskerville` | Libre Baskerville | 400 | Decorative prose (rarely used) |
| `font-montserrat` | Montserrat | 400–700 | Onboarding agent names, supplementary labels |

**Rule:** Use `font-cinzel` for all proper nouns and branding. Use `font-inter` for everything numeric or operational.

---

### 1.5 The Chart Mandate — Native SVG Only

**No Recharts. No Chart.js. No Victory. No D3.** All data visualisations are implemented as hand-coded SVG with computed `viewBox` and path geometry.

#### Why

- External chart libraries inject their own animation loops (usually `requestAnimationFrame`) that conflict with Framer Motion and cause jank on embedded TV hardware.
- They bring React-internal state machines that interact unpredictably with Supabase Realtime patches.
- They cannot consume the Indulge CSS token system natively, leading to hardcoded hex values scattered across 3rd-party code.

#### Existing Native SVG Implementations

| Component | File | What it renders |
|-----------|------|----------------|
| `LeadVelocityChart` | `components/onboarding/LeadVelocityChart.tsx` | Dual-series smooth Bézier curves + area fills for 14-day lead trends |
| `PerformanceLineGraph` | `components/onboarding/PerformanceLineGraph.tsx` | 4-line multi-series chart for business vertical performance |
| `LeadStatusHealthBar` | `components/onboarding/LeadStatusHealthBar.tsx` | Segmented horizontal bar chart with gloss sweep animation |
| `AgentVerticalBarChart` | `components/onboarding/AgentVerticalBarChart.tsx` | Stacked vertical pipeline bars per agent |
| `AgentIcon` (SVG ring) | `components/leaderboard/AgentIcon.tsx` | Circular progress ring via SVG `strokeDashoffset` |

**Pattern for new charts:**
1. Compute `points` array from props — never derive in render.
2. Use a `viewBox="0 0 {W} {H}"` with `preserveAspectRatio="none"` for fluid scaling.
3. Apply `will-change: transform` via `gpuStyle` if the chart animates.
4. Use CSS variables for all fill/stroke colours.
5. Wrap in `<ErrorBoundary label="Chart">` in the parent.

---

## 2. Architecture & Performance Mandates

### 2.1 The Application Shell

```
app/page.tsx                    → renders <Dashboard />
app/layout.tsx                  → fonts, metadata, body class
components/Dashboard.tsx        → ambient glow + TopBar + CelebrationOverlay
                                  + DashboardController + RecommendationTicker
hooks/useDashboardData.ts       → ALL ticket/member/joker/renewal state + subscriptions
hooks/useCelebrationDetection.ts → celebration trigger logic (isolated)
```

`Dashboard.tsx` is intentionally thin — under ~80 lines. It is a composition shell only. All data logic lives in hooks.

#### `useDashboardData` — The Central Nervous System

This hook owns the entire concierge-side data lifecycle:

| Responsibility | Implementation |
|----------------|----------------|
| Initial data fetch | `fetchAll()` on mount — hits `/api/tickets/rows`, `/api/clients`, `/api/jokers`, `/api/jokers/recommendations`, `/api/renewals-panel` ×2 |
| Loading state | `isInitialLoading` boolean; an 8s safety timeout also clears it if an API hangs |
| Derived stats | `useEffect` on `ticketRows` → calls `aggregateTicketStats` + `mergeAndRankAgents` → updates `ananyshreeStats` + `anishqaStats` |
| Memory guard | `setInterval` every 5 minutes → `pruneTicketRowsForDashboardState` (handles IST month rollover without reload) |
| Realtime | Four named Supabase channels (see §5.4) |

#### `useCelebrationDetection`

Compares `tasksCompletedToday` across all agents between renders. Seeds a `prevScoresRef.current` map on the first run (no celebration fires on initial load). Guards against stacking via an in-flight ref. Returns `celebrationAgent: string | null`.

---

### 2.2 Error Boundary Isolation Strategy

**The TV must never white-screen.** The rule is: every widget that performs async work or complex rendering is wrapped individually in `<ErrorBoundary>`.

```tsx
// components/ui/ErrorBoundary.tsx
// Class-based React error boundary with:
//   - label prop → "◈  LEADERBOARD  OFFLINE  ◈"
//   - fillParent prop → fills flex parent without layout collapse
//   - fallback prop → custom override
//   - handleRetry → resets boundary state (attempts re-render)
//   - console.error only (never shown on TV screen)
```

**The fallback design is intentional:**
- Gold diamond delimiter: `◈  {LABEL}  OFFLINE  ◈`
- Uses `--text-label-lg` for the heading (legible from distance)
- Uses `--border-gold-dim` border (near-invisible, not alarming)
- Retry button uses `--radius-pill` and gold outline — quiet, not red
- An ambient radial glow still shows (identical aesthetic to a healthy widget)

**Where boundaries are placed:**

```
Dashboard.tsx
└── ErrorBoundary (whole screen guard)
    ├── QueendomPanel
    │   ├── ErrorBoundary label="Leaderboard" → AgentLeaderboard
    │   ├── ErrorBoundary label="Renewals"    → RenewalsPanel
    │   └── ErrorBoundary label="Joker"       → JokerMetricsStrip
    ├── OnboardingPanel
    │   ├── ErrorBoundary label="Concierge"   → DepartmentColumn
    │   ├── ErrorBoundary label="Performance" → PerformanceLineGraph
    │   └── ErrorBoundary label="Shop"        → DepartmentColumn
    └── ErrorBoundary label="Finances"        → ActiveOutlays (when mounted)
```

---

### 2.3 GPU Acceleration Rules

All animated elements **must** be promoted to their own compositor layer. The shared preset is `lib/motionPresets.ts`:

```typescript
export const gpuStyle: CSSProperties = {
  willChange: "transform, opacity",
  transform: "translateZ(0)",
};
// Usage: <motion.div style={gpuStyle} ... />
```

#### Animation Composition Rules

| Allowed in animation | Reason |
|---------------------|--------|
| `opacity` | Compositor-only — zero paint |
| `transform` (translate, scale, rotate) | Compositor-only |
| `stroke-dashoffset` (SVG) | GPU-composited on modern browsers |

| Forbidden in animation loops | Reason |
|------------------------------|--------|
| `box-shadow` | Forces full repaint every frame |
| `background-color` | Forces paint |
| `width`, `height`, `top`, `left` | Triggers layout |
| `border-width` | Triggers layout + paint |

#### The Hot-Lead Pulse Pattern (Correct GPU Animation)

The `.hot-lead-card-pulse` class demonstrates the correct approach: the visible glow (`box-shadow` + `border`) is **static** on the element itself. The `@keyframes hot-pulse` only animates `opacity` on an overlay div — no repaint per frame.

```css
@keyframes hot-pulse {
  0%, 100% { opacity: 0.25; }
  50%       { opacity: 1;    }
}
.hot-lead-card-pulse {
  will-change: opacity;   /* compositor hint */
  /* static box-shadow here — never inside keyframes */
}
```

---

### 2.4 Framer Motion Presets (`lib/motionPresets.ts`)

Import from this module. Never define inline animation objects with the same values.

| Export | Type | Use |
|--------|------|-----|
| `gpuStyle` | `CSSProperties` | Spread on every `motion.*` element's `style` prop |
| `EASE_LUXURY` | `[0.25, 0.46, 0.45, 0.94]` | Default easing for all transitions |
| `containerVariants` | `Variants` | Parent stagger container (stagger 0.14s, delay 0.2s) |
| `itemVariants` | `Variants` | Child: fade up 28px, 0.7s duration |
| `crossfadeTransition` | `Transition` | DashboardController: 1.5s `easeInOut` |
| `widgetFadeIn(delayMs)` | function → props | Lightweight fade-in for widgets |
| `rowVariants` | `Variants` | Leaderboard row: fade up 18px, custom delay per row |
| `surgeBgVariants` | object | Gold bg burst on score increase |
| `surgeSweepVariants` | object | Shimmer sweep on score increase |
| `winShimmerBarVariants` | object | Continuous shimmer during celebration |

---

### 2.5 The Initial Loading Skeleton

When `isInitialLoading === true` in `useDashboardData`, `DashboardController` overlays the skeleton components:

- `components/skeletons/QueendomSkeleton.tsx` — concierge view placeholder
- `components/skeletons/OnboardingSkeleton.tsx` — onboarding view placeholder

Skeletons use the `.skeleton-block` utility class, which drives the `foil-shimmer` animation — a left-to-right gold-foil sweep (same keyframe reused from the `.card-win-shimmer` celebration effect). Each block can receive a staggered `animation-delay` inline for a cinematic cascade effect.

```css
.skeleton-block {
  background: linear-gradient(90deg,
    var(--surface-card) 0%,
    var(--surface-elevated) 35%,
    rgba(212,175,55,0.06) 50%,  /* gold peak */
    var(--surface-elevated) 65%,
    var(--surface-card) 100%
  );
  background-size: 400% 100%;
  animation: foil-shimmer 2.4s ease-in-out infinite;
  border-radius: var(--radius-card);
}
```

**Exit strategy:** Skeletons are overlaid with Framer Motion `AnimatePresence` and exit with a fade-out. Both the real content and the skeleton coexist briefly during the handoff — no flash of unstyled content.

---

### 2.6 DashboardController — The Screen Rotation Engine

**File:** `components/DashboardController.tsx`

Both screens are **always mounted** — never unmounted. Only `opacity` and `zIndex` change. This prevents the Supabase Realtime subscriptions and React state in `OnboardingPanel`/`QueendomPanel` from being torn down and re-initialized, which would cause a data refetch flash on every rotation.

```typescript
const SCREEN_DURATIONS_MS = {
  concierge: 30_000,   // 30 seconds
  onboarding: 30_000,  // 30 seconds
};

// Crossfade:
animate={{ opacity: activeScreen === "concierge" ? 1 : 0, zIndex: … }}
transition={{ duration: 1.5, ease: "easeInOut" }}  // crossfadeTransition
```

#### Controls

| Input | Action |
|-------|--------|
| `P`, `Space`, `Enter`, `MediaPlayPause` | Toggle freeze/resume |
| `ArrowLeft` / `ArrowRight` | Immediate screen switch |
| PAUSE/RESUME button | Always visible, `z-[100]`, min 48×140px for TV remote |

All keyboard listeners use `capture: true` on `window` to intercept events in fullscreen TV browsers.

---

## 3. The Data Engine & Timezones

### 3.1 The Timezone Rule — IST Is Non-Negotiable

**India Standard Time (IST) = UTC+05:30.** All "today" and "this month" boundaries are computed in IST, not UTC. A ticket created at `23:45 IST` on April 30 must count as April, even though its UTC timestamp is `18:15Z` on April 30 — and especially not shifted to May 1.

**The Single Rule:** All timestamps stored in Supabase must be strict UTC ISO strings (ending `Z`). All date comparisons must use `istToday()`, `toISTDay()`, or `toISTMonth()` from `lib/istDate.ts`.

```typescript
// CORRECT
const { day, month } = istToday();
if (toISTDay(row.created_at) === day) { /* today's ticket */ }

// WRONG — uses UTC, off by up to 5h30m
if (new Date(row.created_at).toISOString().slice(0, 10) === new Date().toISOString().slice(0, 10)) {}
```

---

### 3.2 Timestamp Parsing Rules (`lib/istDate.ts`)

The function `utcMillisFromDbTimestamp(ts)` handles all timestamp formats in the following priority order:

| Input format | Treatment |
|-------------|-----------|
| `YYYY-MM-DD` (date only) | IST midnight → e.g. `2026-05-04T00:00:00+05:30` |
| `YYYY-MM-DD HH:MM:SS` (space, no zone) | Naive IST wall time → append `+05:30` |
| `…T…` with no zone | Naive IST wall time → append `+05:30` (Freshdesk exports) |
| `…T…Z` or `…T…+05:30` | Explicit zone → use as-is |
| `…+HH` short offset | Normalise to `+HH:00` |

#### Zoho CRM Special Case

Zoho CRM merge fields frequently output IST wall-clock digits suffixed with `Z` or `+00`. This is **wrong** (the digits are IST, not UTC), but it is what Zoho sends. The function `normalizeZohoCrmTimestampForIstDigits(s)` strips a pure-UTC-zero suffix before passing to `utcMillisFromDbTimestamp`:

```typescript
normalizeZohoCrmTimestampForIstDigits("2026-05-04 10:00:00Z")
// → "2026-05-04 10:00:00"
// → then parsed as IST (Asia/Kolkata) wall time → correct epoch
```

Use `utcMillisFromZohoCrmDbTimestamp()` and `toISTDayFromZohoCrm()` for all `leads`/`deals` table timestamps. Never use the vanilla `utcMillisFromDbTimestamp` for Zoho data.

---

### 3.3 IST Month & Day Bounds (`lib/istDate.ts`, `lib/istMonthBounds.ts`)

| Function | Returns | Use |
|----------|---------|-----|
| `istToday()` | `{ day: "YYYY-MM-DD", month: "YYYY-MM" }` | IST calendar reference for all math |
| `getCurrentIstMonthUtcBounds()` | `{ startUtcIso, endExclusiveUtcIso }` | PostgREST filter for `created_at.gte` + `created_at.lt` |
| `getCurrentIstDayUtcBounds()` | Same shape | Filter for "today" queries |
| `getLast30DaysUtcBounds()` | Same shape | Rolling 30-day window for conversion ledger |
| `recordedAtToMillis()` | `number | null` | Parse `recorded_at` which may be date-only or full TIMESTAMPTZ |

---

### 3.4 Cohort Math — The Sacred Formula

**"This Month" never means "status changed this month."** It means "ticket was CREATED this IST calendar month." Status is checked independently.

#### Queendom Scorecard Metrics

| Metric | Formula (cohort math) |
|--------|-----------------------|
| **Received (This Month)** | `created_at` month = current IST month (any status) |
| **Resolved (This Month)** | `created_at` month = current IST month **AND** `status ∈ {resolved, closed}` |
| **Solved Today** | `created_at` day = today IST **AND** `status ∈ {resolved, closed}` |
| **Pending (To Resolve)** | `status ∉ {resolved, closed}` — **no date gate** — includes ALL open tickets ever created |
| **Spoiled (Joker)** | `tags.joker_suggestion` is set and non-empty |

#### Why Pending Has No Date Gate

If a ticket from March is still open in May, it must show in the Pending count. Removing the date gate on Pending is the design. This is not a bug. It reflects the reality that unresolved work does not disappear when a calendar month ends.

#### Void Statuses — Invisible to All Math

```typescript
export const VOID_STATUSES = new Set(["spam", "deleted"]);
```

Void tickets are stripped **in the very first pass** of every aggregation function, before any metric is computed. They are kept in the database for audit trail but are invisible to the TV. They do NOT count as Resolved, Received, or Pending.

`spam` and `deleted` are NOT terminal. Terminal statuses are `{resolved, closed}` only.

---

### 3.5 Queendom Routing — Substring Match

Freshdesk group names may be `"Team Ananyshree"`, `"Ananyshree Concierge"`, etc. The routing always uses `.includes()`:

```typescript
const queendom = (row.queendom_name ?? "").toLowerCase().trim();
if (queendom.includes("ananyshree")) → ananyshree bucket
else if (queendom.includes("anishqa")) → anishqa bucket
```

**Do not change this to strict equality.** The group names in Freshdesk are compound strings.

---

### 3.6 The Freshdesk Webhook — Three Paths

**File:** `app/api/webhooks/freshdesk/route.ts`

Every incoming POST is classified into one of three paths:

```
POST /api/webhooks/freshdesk
│
├── Path 1: Deletion (webhook_type ∈ {deletion, delete, ticket_deleted})
│   → UPDATE tickets SET status="deleted", is_escalated=false
│   → Row stays in DB (soft-delete for audit)
│
├── Path 2: Escalation-only (is_escalated is boolean, no status/queendom_name)
│   → Fetch existing status first
│   → If status ∈ SLA_SAFE_STATUSES → force is_escalated=false (ignore payload)
│   → Else → PATCH is_escalated to payload value
│   ⚠️ THIS IS THE ONLY PATH THAT CAN SET is_escalated = true
│
└── Path 3: Full upsert (status + queendom_name present)
    → resolved/closed → set resolved_at, force is_escalated=false
    → spam/deleted    → force is_escalated=false
    → nudge/invoice   → force is_escalated=false
    → open/pending    → OMIT is_escalated (preserve DB value)
    → UPSERT on conflict ticket_id
```

#### Critical Rule: Never Trust Freshdesk `is_escalated` in Full Upserts

Freshdesk automation variables for boolean fields sometimes stringify to `""` (empty string) rather than `false`. This corrupts the `BOOLEAN NOT NULL` column. The webhook pre-processes the raw body with a regex fix before JSON.parse:

```typescript
rawBody.replace(/"is_escalated"\s*:\s*,/, '"is_escalated": false,')
```

And the full-upsert path deliberately **omits** `is_escalated` for active statuses (open/pending) — allowing the existing DB value to persist across reassignments.

---

### 3.7 Zoho Webhook Flows

#### Leads — `POST /api/webhooks/zoho-leads`

Writes to the `leads` table (Supabase). First-touch deduplication via `lead_id` primary key.

1. Accept `application/json` or `application/x-www-form-urlencoded`
2. Parse `{ lead_id, agent_name, status }`
3. Status gate: only proceed for `status === "Attempted"` (case-insensitive) — all others are silently ignored
4. `INSERT` into `leads` — if `lead_id` already exists (PG error `23505`), return `{ action: "ignored", reason: "duplicate_lead" }` — no update
5. `first_touched_at` is **never overwritten** after initial insert

#### Deals — `POST /api/webhooks/zoho-deals`

Writes to the `deals` table. Deduplication via partial unique index on `deal_id`.

1. Accept JSON or form-encoded
2. Parse `{ deal_id, agent_name, deal_name, amount }`
3. Normalize `agent_name` via `normalizeZohoAgentName()` (trim + collapse whitespace)
4. Strip commas from `amount`, parse as float
5. `INSERT` into `deals` — if `deal_id` duplicate (PG `23505`), silently ignore

---

### 3.8 Realtime Subscription Architecture

Four named Supabase Postgres Changes channels in `useDashboardData`:

| Channel | Table | Events | Handler |
|---------|-------|--------|---------|
| `dashboard-clients` | `clients` | `*` | `fetchMembers()` |
| `dashboard-jokers` | `jokers` | `*` | Optimistic patch recommendations + `fetchJokers()` |
| `dashboard-tickets` | `tickets` | INSERT/UPDATE/DELETE | Optimistic patch `ticketRows` state |
| `dashboard-renewals` | `renewals`, `members` | INSERT | Both renewal fetches |

The Onboarding panel (`useOnboardingPanelData`) has two additional channels:
- `deals-live` on `deals` table
- `leads-touches-live` on `leads` table

Both trigger a debounced reload (2.5s) to avoid hammering `/api/onboarding` on rapid bulk updates.

#### Realtime Ticket Patch Pattern

```typescript
// INSERT — dedup first, then append
setTicketRows((prev) => {
  const i = prev.findIndex((r) => r.id === row.id);
  if (i >= 0) {
    const next = [...prev];
    next[i] = row;
    return pruneTicketRowsForDashboardState(next);
  }
  return pruneTicketRowsForDashboardState([...prev, row]);
});

// UPDATE — in-place replace
setTicketRows((prev) =>
  pruneTicketRowsForDashboardState(prev.map((r) => (r.id === row.id ? row : r)))
);

// DELETE — filter out by oldRow.id
setTicketRows((prev) => prev.filter((r) => r.id !== oldRow.id));
```

#### Memory Guard

```typescript
const MAX_TICKET_ROWS_IN_DASHBOARD_STATE = 5000;

function pruneTicketRowsForDashboardState(rows): TicketRowMinimal[] {
  const thisMonth = istToday().month;
  const inMonth = rows.filter((r) => toISTMonth(r.created_at) === thisMonth);
  if (inMonth.length <= 5000) return inMonth;
  return [...inMonth]
    .sort((a, b) => (utcMillisFromDbTimestamp(b.created_at) ?? 0)
                  - (utcMillisFromDbTimestamp(a.created_at) ?? 0))
    .slice(0, 5000);
}
```

A `setInterval` prunes every 5 minutes to handle IST month rollovers at `00:00 IST` without requiring a page reload.

---

## 4. The Module Dictionary

### 4.1 QueendomPanel — The Concierge Scoreboard

**File:** `components/QueendomPanel.tsx`

Props: `name`, `stats: QueenStats`, `side: "left" | "right"`, `delay`, `celebrationAgent`, `renewalsData`.

#### Layout (Top to Bottom)

```
┌─────────────────────────────────────────────┐
│  ambient-glow-{left|right}                  │  ← position:absolute, inset-0
│  QueendomWingspanHeader                     │  ← Name + Paid/Celebrity counts
│  SectionDivider ("Queendom")                │
│  5-Metric Hero Row                          │  ← scorecards
│  RenewalsPanel                              │
│  ┌──────────────────┬──────────────────┐    │
│  │ AgentLeaderboard │ SpecialDates     │    │  ← height-synced via ResizeObserver
│  └──────────────────┴──────────────────┘    │
│  JokerMetricsStrip (compact)                │
└─────────────────────────────────────────────┘
```

#### 5-Metric Hero Row

| Position | Metric | Colour | Data Source |
|----------|--------|--------|-------------|
| 1 | Solved Today | Emerald + `.emerald-glow-hero` | `stats.tickets.solvedToday` |
| 2 | Received (Month) | Champagne | `stats.tickets.totalReceived` |
| 3 | Resolved (Month) | Green | `stats.tickets.resolvedThisMonth` |
| 4 | Pending (Month) | Red | `stats.tickets.pendingToResolve` |
| 5 | Spoiled (Joker accepted today) | Gold | `stats.joker.acceptedToday` |

All numbers pass through `<AnimatedCounter>` for smooth animated transitions.

#### SLA Logic

- **Overdue** = `is_escalated === true` on a pending ticket (set by Freshdesk automation when SLA is breached)
- **Pending** = any non-terminal ticket, no date gate
- **Incomplete** = `is_incomplete === true` (separate field, tracked per-agent)
- Only the Freshdesk escalation-only webhook path can set `is_escalated = true`

---

### 4.2 AgentLeaderboard

**File:** `components/leaderboard/AgentLeaderboard.tsx`
**Row:** `components/leaderboard/AgentRow.tsx`
**Icon:** `components/leaderboard/AgentIcon.tsx`

#### Column Layout (5 columns)

| Col | Header | Data | Notes |
|-----|--------|------|-------|
| 1 | — | `AgentIcon` (SVG ring) + Crown for rank 1 | Ring = `completedToday / assignedToday` |
| 2 | Genies | Agent display name | `.font-cinzel`, champagne |
| 3 | Today | `completedToday / assignedToday` | Green value |
| 4 | Monthly | `completedThisMonth / assignedThisMonth` | Gold for rank 1, grey for others |
| 5 | Pending | `pendingScore` / `overdueCount` | `.error-overdue-glow` when `overdueCount > 0` |

#### Agent Ranking

Sort: `tasksCompletedThisMonth DESC`, tie-break `tasksCompletedToday DESC`. Rank is purely dynamic — highest producer gets the Crown.

#### Win Animations

- **Score increase detected** → `surgeKey` changes → `surgeBgVariants` (gold bg burst) + `surgeSweepVariants` (shimmer sweep)
- **`celebrationAgent === agent.name`** → continuous `.row-win-shimmer` (`winShimmerBarVariants`) until celebration ends

#### AgentIcon SVG Ring

```
radius = 38
circumference = 2π × 38 ≈ 238.76
strokeDasharray = circumference
strokeDashoffset = circumference × (1 - completedToday / assignedToday)
```

Animated via Framer Motion `animate={{ strokeDashoffset }}`.

---

### 4.3 QueendomWingspanHeader

**File:** `components/QueendomWingspanHeader.tsx`

Three-column grid: **Paid Count** | **Queendom Name** | **Celebrity Count**

- Queendom name: `font-cinzel`, `--text-heading-xl`, `.queen-name-glow`
- Paid count: `<AnimatedCounter>`, `--text-counter-xl`, emerald
- Celebrity count: `<AnimatedCounter>`, `--text-counter-xl`, gold
- Data: `stats.members.total` (paid) + `stats.members.celebrityActive` (celebrity)

---

### 4.4 RenewalsPanel

**File:** `components/RenewalsPanel.tsx`

Displays monthly renewal count, latest 2 renewals, and latest 2 new member assignments.

- **Monthly counter**: `AnimatedCounter`, gold, `.drop-shadow-gold`
- **Renewal names**: `.renewal-card-text` (gold gradient clip)
- **First/newest entry**: `.celebration-shimmer-text` (animated shimmer — signals this entry is new)
- Data source: `GET /api/renewals-panel?queendom={id}` → `renewals` + `members` tables

---

### 4.5 JokerMetricsStrip

**File:** `components/JokerMetricsStrip.tsx`

Compact strip showing three metrics for the queendom's designated Joker agent:

| Box | Metric |
|-----|--------|
| 1 | Unique recommendations (this month) |
| 2 | Yes / Total responses |
| 3 | Acceptance percentage |

Styled with `.joker-box` class. Optional `compact` prop collapses padding.

Joker assignment: `JOKER_ROSTER` in `lib/agentRoster.ts` — one Joker per queendom:
- Ananyshree → **Lilian Albrecht**
- Anishqa → **Shruti Sharma**

---

### 4.6 OnboardingPanel — Revenue & Sales Screen

**File:** `components/onboarding/OnboardingPanel.tsx`
**Layout:** `components/onboarding/OnboardingLayout.tsx`
**Data hook:** `hooks/useOnboardingPanelData.ts`

#### Grid Layout

```
┌───────────────────┬─────────────────────────┬───────────────────┐
│  DepartmentColumn │   Centre Column          │  DepartmentColumn │
│  "Onboarding"     │   Performance Header     │  "Shop"           │
│  (Concierge dept) │   4 Metric Tiles         │  (Shop dept)      │
│                   │   PerformanceLineGraph   │                   │
│  CompactAgentCard │   ConversionLedger       │  CompactAgentCard │
│  × 4 agents       │                          │  × 3 agents       │
└───────────────────┴─────────────────────────┴───────────────────┘
```

#### Centre Column Metric Tiles

| Tile | Metric | Source |
|------|--------|--------|
| Leads (Month) | `leadMonthStats.leads` | `leads` table, current IST month |
| Attended | `leadMonthStats.attended` | status ∈ {New, Attempted, In Discussion} |
| Converted | `leadMonthStats.converted` | status = Qualified |
| Junk | `leadMonthStats.junk` | All other statuses |

#### PerformanceLineGraph

Native SVG, 4 series lines — one per `BusinessVertical`:
- **Indulge Global** (highest expected volume)
- **Indulge Shop**
- **Indulge House**
- **Indulge Legacy**

Data: `verticalTrendline: VerticalTrendPoint[]` — daily counts for current IST calendar month, zero-filled for future days.

#### ConversionLedger

**File:** `components/onboarding/ConversionLedger.tsx`

Vertical auto-scroll driven by a `requestAnimationFrame` loop (pixel-based `translateY`), not CSS `@keyframes`. The element uses `will-change: transform` inline. Maximum 15 rows, newest first.

Columns: Client | Amount (₹N L) | Date (DD Mon) | Agent

On Realtime INSERT: optimistically prepend to state + dedup by `id`.

#### DepartmentColumn

**File:** `components/onboarding/DepartmentColumn.tsx`

Renders either the Concierge or Shop column:

- **Header**: department name with `.queen-name-glow` (Concierge) or `.sky-name-glow` (Shop)
- **Accent colour**: `--gold-primary` for Concierge, `--color-sky` for Shop
- **Agent cards**: `CompactAgentCard` — portrait + name + `LeadStatusHealthBar` + 3 metric values

Each agent card shows:
1. `totalAttempted` — leads attempted this month
2. `totalConverted` — deals closed this month
3. `leadsAttendToday` — leads today

Win shimmer: when `totalConverted` increases for an agent, `.card-win-shimmer` fires for 2.1s (foil-shimmer, `z-[15]`).

#### LeadStatusHealthBar

**File:** `components/onboarding/LeadStatusHealthBar.tsx`

Native SVG segmented bar for one agent's lead pipeline. Statuses and their visual roles:

| Status | Colour | Meaning |
|--------|--------|---------|
| New | Gold dim | Fresh, untouched leads |
| Attempted | Gold | Dialled at least once |
| In Discussion | Emerald | Active conversation |
| Nurturing | Amber | Long-cycle warm leads |
| Junk | Red dim | Unqualified / bad data |
| Qualified | Emerald bright | Won / qualified |

Animations: `bar-gloss-sweep` (diagonal gloss stripe) + `bar-glow-breathe` (outer glow pulse). Both are GPU-safe (opacity-only animation).

---

### 4.7 ActiveOutlays — Finance Widget

**File:** `components/finance/ActiveOutlays.tsx`

> **Status:** Component exists but is **not currently mounted** in `QueendomPanel.tsx`. Mount it (wrapped in `<ErrorBoundary label="Finances" fillParent>`) when product requires it.

Subscribes to `finance_outlays` with `queendom_name=eq.{queendomId}` filter.

| Event | Action |
|-------|--------|
| INSERT (pending) | Add to top of list |
| UPDATE → "paid" | Mark green, schedule removal after 2500ms |
| UPDATE → "pending" | Update in-place |
| DELETE | Cancel timer, remove immediately |

Capital Pending scorecard: sum of pending amounts. Displays as `₹{n}k` when ≥ ₹1000, else `₹{n}`.

---

### 4.8 CelebrationOverlay

**File:** `components/CelebrationOverlay.tsx`

Fires when any agent's `tasksCompletedToday` increases. Full-screen takeover:

- Web Audio API chime
- Gold dust particles (CSS keyframes, GPU-composited opacity)
- `AnimatePresence` spring backdrop + card
- 3-second auto-dismiss
- `@media (prefers-reduced-motion)` branch: particles suppressed, chime may vary

---

### 4.9 RecommendationTicker

**File:** `components/RecommendationTicker.tsx`

Horizontally scrolling ticker pinned to the bottom of the screen. Content: Joker recommendations formatted as `{type} in {city}: {suggestion}`. Items are duplicated for seamless infinite loop. CSS animation class: `ticker-scroll`. GPU-accelerated via `translate3d`.

---

### 4.10 AnimatedCounter

**File:** `components/AnimatedCounter.tsx`

Animates numeric values from 0 or previous value to the new target. Props: `value`, `delay` (ms), `slideOnChange` (boolean). Used for all large scoreboard numbers. Internally uses Framer Motion `useMotionValue` + `useTransform`.

---

### 4.11 GlassPanel Primitive

**File:** `components/ui/GlassPanel.tsx`

ForwardRef wrapper providing variants (`default`, `elevated`, `inset`), optional `glow`, `overlay` (`.card-gradient-overlay`), and configurable `radius`. This is the base primitive for all card containers in the dashboard. Always use `GlassPanel` rather than building `bg + border + backdrop` combinations from scratch.

---

### 4.12 SectionDivider

**File:** `components/ui/SectionDivider.tsx`

Renders either:
- A plain `.separator-gold-h` rule (rule-only mode)
- A centred title with gradient arms extending left and right (titled mode)

The titled variant uses `font-cinzel`, `--text-label-md`, and gold opacity.

---

## 5. Agent & Department Mapping — The In-Memory Roster

### 5.1 Concierge Agent Roster (`lib/agentRoster.ts`)

These are the exact strings that must match `agent_name` in Supabase (case-insensitive at runtime via `.toLowerCase()`):

**ROSTER_ANANYSHREE:**
```
Sanika Ahire, Ragadh Shahul, Aditya Sonde, Shaurya Verma,
Poorti Gulati, Anshika Eark, Ajith Sajan, Khushi Shah, Palak Kataria
```

**ROSTER_ANISHQA:**
```
Sagar Ali, Savio Francis Fernandes, Pranav Gadekar, Dhanush K,
Charlotte Dias, Ria Pujhari, Rupali Chodankar, Eeti Srinivsulu, Ekta Nihalani
```

**Rule:** When a new concierge agent joins, add their **exact Freshdesk name** to the appropriate roster array. The leaderboard will automatically create a zero-stats row for them.

---

### 5.2 Joker Roster (`lib/agentRoster.ts`)

```typescript
export const JOKER_ROSTER: Record<string, "ananyshree" | "anishqa"> = {
  "Lilian Albrecht": "ananyshree",
  "Shruti Sharma":   "anishqa",
};
```

One Joker per Queendom. To change a Joker, update this map.

---

### 5.3 Revenue Department Roster (`lib/onboardingAgents.ts`)

**Two departments, six agent seats:**

| Department | Agents (Display Names) | Card Order |
|-----------|------------------------|------------|
| Concierge | Amit, Meghana, Samson, Kaniisha | Left → Right |
| Shop | Vikram, Katya, Harsh | Left → Right |

**Canonical IDs:**

| ID | Name | Department |
|----|------|------------|
| `amit` | Amit | concierge |
| `meghana` | Meghana | concierge |
| `samson` | Samson | concierge |
| `kaniisha` | Kaniisha | concierge |
| `vikram` | Vikram | shop |
| `katya` | Katya | shop |
| `harsh` | Harsh | shop |

---

### 5.4 `getAgentDepartment()` — The Fallback Logic

**File:** `lib/onboardingAgents.ts`

This function resolves a raw `agent_name` string (from Zoho webhook, Supabase row, or API response) to a `Department` without any database query. It is the safety net that prevents unknown agents from crashing the UI.

```typescript
export function getAgentDepartment(agentName: string): Department {
  const trimmed = agentName.trim().replace(/\s+/g, " ");
  if (!trimmed) return "concierge";

  // First-token extraction: handles "Amit Agarwal", "Harsh/Backup", "samson"
  const firstToken = trimmed.split(/[\s/,]/)[0]?.toLowerCase() ?? "";
  return DEPARTMENT_BY_AGENT_KEY[firstToken] ?? "concierge";  // fallback: "concierge"
}
```

#### DEPARTMENT_BY_AGENT_KEY

```typescript
const DEPARTMENT_BY_AGENT_KEY = {
  // Concierge
  amit:     "concierge",
  samson:   "concierge",
  meghana:  "concierge",
  aniisha:  "concierge",
  kaniisha: "concierge",
  // Shop
  vikram:   "shop",
  katya:    "shop",
  harsh:    "shop",
};
```

**Critical:** The fallback is `"concierge"`. An unrecognised agent name will appear in the Concierge column rather than disappear. This is intentional to prevent data loss. When a genuinely new agent joins Shop, add their first-name key to `DEPARTMENT_BY_AGENT_KEY` and to `SHOP_AGENT_CARDS`.

#### `onboardingAgentNameMatches()` — Fuzzy Name Match

Used in `/api/onboarding` to count leads and deals per agent card. Handles:
- Exact match (case-insensitive)
- First-name-only match (`"Amit"` matches `"Amit Agarwal"`)
- Slash-separated names (`"Samson/Neha"` → matches `"Samson"`)
- Starts-with prefix check

```typescript
onboardingAgentNameMatches("Samson", "samson fernandes") // → true
onboardingAgentNameMatches("Harsh",  "Harsh/Backup")     // → true
onboardingAgentNameMatches("Amit",   "Amit")             // → true
onboardingAgentNameMatches("Vikram", "vikas sharma")     // → false
```

---

### 5.5 Fallback Agent Rows

When `/api/onboarding` fails or returns no data, each agent card falls back to a zeroed row from `CONCIERGE_FALLBACK_AGENTS` / `SHOP_FALLBACK_AGENTS`. **The TV always shows all seven seats** — it never shows an empty column.

---

### 5.6 Business Verticals

```typescript
export const BUSINESS_VERTICALS = [
  "Indulge Global",   // Highest expected lead volume
  "Indulge Shop",
  "Indulge House",
  "Indulge Legacy",
] as const;
```

Used in `verticalTrendline` data (one line per vertical in `PerformanceLineGraph`).

---

## 6. The Developer Workflow Checklist

Use this checklist for every new feature, bug fix, or component addition. Do not skip steps.

---

### Step 1 — Understand the Data Contract

- [ ] Check `lib/types.ts` and `lib/onboardingTypes.ts` for existing interfaces before creating new ones
- [ ] If adding a new API field, add it as an optional (`?`) field first to maintain backward compatibility
- [ ] If adding a new database column, write a Supabase migration in `supabase/migrations/`
- [ ] If the field involves a timestamp, confirm the IST vs UTC handling with `lib/istDate.ts`

### Step 2 — IST Math Compliance

- [ ] Every "today" comparison uses `istToday().day` from `lib/istDate.ts`
- [ ] Every "this month" comparison uses `istToday().month`
- [ ] Every "month boundary" server-side filter uses `getCurrentIstMonthUtcBounds()`
- [ ] For Zoho CRM data: use `utcMillisFromZohoCrmDbTimestamp()` / `toISTDayFromZohoCrm()`
- [ ] For Freshdesk data: use `freshdeskTimestampToIsoUtcForDb()` before storing
- [ ] Never use `new Date().toISOString().slice(0, 10)` — that is UTC

### Step 3 — Design Token Compliance

- [ ] All background colours reference a `--surface-*` CSS variable
- [ ] All gold/emerald/red colours reference a `--color-*` or `--border-gold-*` variable
- [ ] All font sizes reference a `--text-*` CSS variable (no fixed `px` or Tailwind size classes on TV-visible text)
- [ ] No `box-shadow` changes inside `@keyframes` or Framer Motion `animate` objects
- [ ] New animations use `will-change: transform` or `will-change: opacity` (never both unless necessary)
- [ ] New charts are pure SVG — no external chart library imports

### Step 4 — Error Boundary Wrapping

- [ ] Any new widget that fetches data or has complex rendering is wrapped in `<ErrorBoundary label="MyWidget">`
- [ ] Widgets that must fill their flex parent use `<ErrorBoundary fillParent>`
- [ ] The ErrorBoundary fallback does not use red, large text, or browser-native error messages

### Step 5 — Framer Motion Compliance

- [ ] `gpuStyle` from `lib/motionPresets.ts` is spread on the `style` prop of every `motion.*` element
- [ ] `containerVariants` + `itemVariants` are used for section entrance animations (not custom `initial`/`animate` objects that duplicate these values)
- [ ] `crossfadeTransition` is used for any screen-level transition
- [ ] Celebration / win animations follow the surge pattern: `surgeBgVariants` + `surgeSweepVariants`

### Step 6 — Realtime Safety

- [ ] New Realtime subscriptions follow the named-channel pattern (unique `channel` string)
- [ ] INSERT handlers deduplicate by `id` using `findIndex` before appending
- [ ] DELETE handlers filter by `oldRow.id` (not `row.id`)
- [ ] New data appended to Dashboard state is passed through `pruneTicketRowsForDashboardState` if it's ticket data
- [ ] Subscription cleanup is called in the `useEffect` return function

### Step 7 — Void & Terminal Status Handling

- [ ] New ticket-aggregating code calls `VOID_STATUSES.has(status.toLowerCase())` and skips void rows before any math
- [ ] Terminal statuses are ONLY `{resolved, closed}` — no other status counts as "done"
- [ ] `spam` and `deleted` are void, not terminal

### Step 8 — Agent Roster Updates

- [ ] New concierge agent: add exact Freshdesk `agent_name` to `ROSTER_ANANYSHREE` or `ROSTER_ANISHQA` in `lib/agentRoster.ts`
- [ ] New revenue agent: add to `CONCIERGE_AGENT_CARDS` or `SHOP_AGENT_CARDS` in `lib/onboardingAgents.ts` AND add first-name key to `DEPARTMENT_BY_AGENT_KEY`
- [ ] Joker reassignment: update `JOKER_ROSTER` in `lib/agentRoster.ts`

### Step 9 — Supabase Client Rules

- [ ] Server-side API routes use `supabaseAdmin` (service role) — never the anon client
- [ ] Browser/client components use `supabase` (anon) for Realtime subscriptions ONLY — never for data fetching
- [ ] The `supabase` browser client is never instantiated inside a React component or hook — it is a module-level singleton

### Step 10 — Verification

- [ ] Run `npm run build` — no TypeScript errors
- [ ] Open `http://localhost:3000` — check loading skeleton appears and transitions to live data
- [ ] Trigger a Freshdesk ticket update — verify Realtime patch appears without full refetch
- [ ] Check `isInitialLoading` clears within 8 seconds (even if an API is slow)
- [ ] Verify the browser console has no React errors or Supabase subscription warnings

---

## 7. Appendix: Key Invariants

These are absolute rules. Violating any of them causes silent incorrect metrics on the TV screen with no error thrown.

| # | Invariant | What breaks if violated |
|---|-----------|------------------------|
| 1 | IST timezone is non-negotiable for all date math | Off-by-one day for tickets created between 18:30 UTC and 23:59 UTC (IST midnight crossings) |
| 2 | VOID_STATUSES are stripped before ALL math | Deleted spam tickets appear as Received/Pending |
| 3 | TERMINAL_STATUSES = `{resolved, closed}` only | `spam` and `deleted` inflate resolution rate |
| 4 | Cohort math is creation-date based | "Resolved This Month" includes resolutions of old tickets |
| 5 | `is_escalated` can only be set `true` by the escalation-only webhook path | Full upsert corrupts the overdue flag |
| 6 | Freshdesk `created_at` must pass through `freshdeskTimestampToIsoUtcForDb()` | IST-origin instants stored 5.5h ahead in UTC |
| 7 | Zoho timestamps must use `normalizeZohoCrmTimestampForIstDigits()` | Zoho bogus-UTC suffix causes 5.5h date shift |
| 8 | Zoho lead deduplication is by `lead_id` PK; never update the row | `first_touched_at` gets overwritten, breaking "this month" counts |
| 9 | Zoho deal deduplication is by partial unique index on `deal_id`; error `23505` is expected | Duplicate deals inflate revenue totals |
| 10 | Browser `supabase` client (anon key) is for Realtime only | Service role key exposed to browser is a critical security breach |
| 11 | Supabase browser client is a module-level singleton | Duplicate clients cause stale subscriptions and memory leaks |
| 12 | No external chart libraries | Repaint jank, bundle bloat, uncontrollable re-renders on TV hardware |
| 13 | Every widget is wrapped in ErrorBoundary | Single widget JS error white-screens the entire broadcast |
| 14 | No fixed pixel font sizes in TV-visible text | Breaks fluid scaling; text clips or overflows at non-1080p resolutions |
| 15 | `box-shadow` is never animated in keyframes or Framer animate | Forced repaint per frame destroys 60fps on 24/7 TV hardware |
| 16 | Queendom routing uses `.includes()` substring match, not strict equality | Freshdesk group names like "Team Ananyshree" route to null bucket |
| 17 | `getAgentDepartment()` fallback is `"concierge"`, not an error | Unknown agent silently vanishes from UI instead of appearing in fallback column |
| 18 | `pruneTicketRowsForDashboardState()` runs after every Realtime patch | State grows unboundedly over 24h uptime; OOM crash on TV browser |

---

*Generated from full codebase scan — May 4, 2026. Authoritative version is always derived from the live source in this repository.*
