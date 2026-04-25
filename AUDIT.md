# Indulge TV Dashboard — Codebase Audit

Generated: 2026-04-25

## 1. Project Overview

| Item | Value |
|------|--------|
| **Product** | Next.js + React live operations / TV dashboard (“Indulge Global — Live Operations Dashboard”) |
| **Framework** | **Next.js `^16.1.6`** (App Router) |
| **React** | **`^18`** (`react` / `react-dom`) |
| **Language** | **TypeScript** (`typescript ^5`, `strict: true`); `allowJs: true` for legacy `import_tickets.js` |
| **Styling** | **Tailwind CSS `^3.4.0`**, PostCSS, Autoprefixer; single global stylesheet `app/globals.css` |
| **Data** | **Supabase** (`@supabase/supabase-js ^2.39.0`) — browser client + service-role admin on server routes |
| **Animation** | **Framer Motion `^11.0.0`** |
| **Icons** | **lucide-react `^0.363.0`** |
| **Dates** | **date-fns `^3.6.0`** |
| **Other deps** | `csv-parser`, `dotenv` (scripts) |
| **Charting libs** | **None** (Recharts, Chart.js, D3, Victory, Tremor not in `package.json`) — charts are **custom SVG** + layout |
| **State management** | **No Redux/Zustand/Jotai** — React `useState` / `useRef` / `useMemo` / `useCallback` + custom hooks |
| **Bundler** | `next.config.js` sets **Turbopack `root: __dirname`**; no custom Webpack/Babel files in repo |
| **Router** | **App Router** only (`app/`); no `pages/` directory |

**Runtime model:** Client-heavy dashboard (`"use client"` on interactive tree). `app/page.tsx` renders `Dashboard`. Data: `fetch` to same-origin `/api/*` with `cache: "no-store"`, plus **Supabase Realtime** `postgres_changes` in `useDashboardData` and `OnboardingPanel` / `ActiveOutlays`.

---

## 2. Directory Structure

Below: **application-relevant** tree. Excluded: `node_modules/`, `.next/`, `.git/objects/*`. The repo also contains **`.cursor/skills/ui-ux-pro-max/`** (Cursor skill data + Python scripts) — not part of the deployed Next app.

```
.
├── .cursor/skills/ui-ux-pro-max/   # IDE skill (CSV/MD/PY) — not app bundle
├── .env.local                      # Local secrets (not committed; see §5.1 names only)
├── .gitignore
├── AUDIT.md
├── CLAUDE.md / claude.md
├── app/
│   ├── api/
│   │   ├── agents/route.ts
│   │   ├── clients/route.ts
│   │   ├── jokers/route.ts
│   │   ├── jokers/recommendations/route.ts
│   │   ├── onboarding/route.ts
│   │   ├── renewals-panel/route.ts
│   │   ├── tickets/route.ts
│   │   ├── tickets/rows/route.ts
│   │   └── webhooks/
│   │       ├── freshdesk/route.ts
│   │       ├── zoho-deals/route.ts
│   │       └── zoho-leads/route.ts
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── AnimatedCounter.tsx
│   ├── CelebrationOverlay.tsx
│   ├── Dashboard.tsx
│   ├── DashboardController.tsx
│   ├── JokerMetricsStrip.tsx
│   ├── QueendomPanel.tsx
│   ├── QueendomWingspanHeader.tsx
│   ├── RecommendationTicker.tsx
│   ├── RenewalsPanel.tsx
│   ├── SpecialDates.tsx
│   ├── TopBar.tsx
│   ├── finance/ActiveOutlays.tsx, OutlayLedger.tsx, utils.ts
│   ├── leaderboard/AgentIcon.tsx, AgentLeaderboard.tsx, AgentRow.tsx
│   ├── onboarding/*.tsx, utils.ts
│   ├── skeletons/OnboardingSkeleton.tsx, QueendomSkeleton.tsx
│   └── ui/ErrorBoundary.tsx, GlassPanel.tsx, SectionDivider.tsx, StatCard.tsx
├── hooks/useCelebrationDetection.ts, useDashboardData.ts, usePrefersReducedMotion.ts
├── import_tickets.js
├── last 30 - last 30.csv
├── lib/*.ts
├── onboarding-agents-images/*.webp
├── public/images/agents/*.png
├── scripts/importTickets.ts
├── supabase/migrations/*.sql, README.md
├── tickets.csv
├── next-env.d.ts, next.config.js, package.json, package-lock.json
├── postcss.config.js, tailwind.config.ts, tsconfig.json, tsconfig.tsbuildinfo
└── types/index.ts
```

**TypeScript (`tsconfig.json`):** `target: ES2017`, `module: esnext`, `moduleResolution: bundler`, `jsx: react-jsx`, path alias `@/*` → project root.

**Environment variables referenced in code** (values live in `.env.local` / deployment; do not commit secrets):

| Variable | Where used |
|----------|------------|
| `NEXT_PUBLIC_SUPABASE_URL` | `lib/supabase.ts`, `lib/supabaseAdmin.ts`, `scripts/importTickets.ts`, `import_tickets.js` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `lib/supabase.ts`, `import_tickets.js` (fallback path) |
| `SUPABASE_SERVICE_ROLE_KEY` | `lib/supabaseAdmin.ts`, `scripts/importTickets.ts`, `import_tickets.js` |

No `next.config.js` env mapping. No `metadata.viewport` export in `layout.tsx` (Next may apply defaults).

---

## 3. Component Inventory (full table: name | path | type | props | state | hooks)

**Legend — Type:** page | layout | shell | section | card | widget | chart | table | skeleton | ui-primitive | utility-internal

**Legend — Context:** none of the components use `React.useContext`; no app-wide Context providers in tree.

| Component | Path | Type | Props (name : type, optional?) | State | Hooks / refs | Child tree (summary) |
|-----------|------|------|----------------------------------|-------|----------------|----------------------|
| **RootLayout** | `app/layout.tsx` | layout | `children: React.ReactNode` | none | next/font: Cinzel, Inter, Libre Baskerville, Montserrat → CSS variables on `<html>` | `body` → `{children}` |
| **Page** | `app/page.tsx` | page | none | none | none | `<Dashboard />` |
| **Dashboard** | `components/Dashboard.tsx` | shell | none | none | `useDashboardData`, `useCelebrationDetection` | ambient div, `ErrorBoundary`→`TopBar`, `ErrorBoundary`→`CelebrationOverlay`, `DashboardController`, `ErrorBoundary`→`RecommendationTicker` |
| **DashboardController** | `components/DashboardController.tsx` | shell | `className?`, `ananyshreeStats`, `anishqaStats`, `renewalsAnanyshree`, `renewalsAnishqa`, `celebrationAgent`, `isInitialLoading` | `activeScreen` `"concierge"\|"onboarding"`, `isFrozen` | `useEffect`×2 (screen rotate 30s; keydown capture), inline `RenewalsPanelData` duplicate of types | PAUSE button, two `motion.div` layers: concierge (`QueendomPanel`×2 + skeletons) vs onboarding (`OnboardingPanel` + skeleton) |
| **TopBar** | `components/TopBar.tsx` | section | none | `now: Date \| null` | `useEffect` 1s clock | `motion.header`, date, branding, clock, “Live” pill |
| **CelebrationOverlay** | `components/CelebrationOverlay.tsx` | widget | `agentName`, `onComplete` | none in wrapper; sub-memos | `useReducedMotion`, `useMemo`, `useEffect` (sound) | backdrop, particles, name, `memo` subcomponents |
| **RecommendationTicker** | `components/RecommendationTicker.tsx` | widget | `recommendations: JokerRecommendationItem[]` | `isPaused` | `useCallback`, `memo` | Lucide icons, `motion` marquee |
| **QueendomPanel** | `components/QueendomPanel.tsx` | section | `name`, `stats`, `side`, `delay?`, `celebrationAgent?`, `renewalsData?` | `leaderboardHeightPx` | `useMemo`×N, `useRef` leaderboard measure, `useEffect` ResizeObserver | radial glow, `QueendomWingspanHeader`, metric row, `RenewalsPanel`, glass card: `AgentLeaderboard`, `SpecialDates`, optional `JokerMetricsStrip` |
| **MetricBox** | `components/QueendomPanel.tsx` | utility-internal | `label`, `value`, `delay`, `slideOnChange?`, `labelColor?`, `valueColor?` | none | none | label + `AnimatedCounter` |
| **safeNum** | `components/QueendomPanel.tsx` | utility | n/a (function export) | — | — | — |
| **QueendomWingspanHeader** | `components/QueendomWingspanHeader.tsx` | card | `name`, `membersTotal`, `complimentaryCount`, `delayMs` | none | none | `MetricPill`×2, `AnimatedCounter`, queen name |
| **MetricPill** | `components/QueendomWingspanHeader.tsx` | utility-internal | `children`, `delaySec`, `slideFrom` | none | none | `motion.div` |
| **RenewalsPanel** | `components/RenewalsPanel.tsx` | card | `data` `{ totalRenewalsThisMonth, renewals[], assignments[] }`, `delay?` | none | none | `NameRow`, `AnimatedCounter`, lists |
| **NameRow** | `components/RenewalsPanel.tsx` | utility-internal | `name`, `isNew` | none | none | `Check` + span |
| **AgentLeaderboard** | `components/leaderboard/AgentLeaderboard.tsx` | widget | `agents`, `queendomDelay?`, `celebrationAgent?` | none | none | header grid + `AnimatePresence` → `AgentRow` |
| **AgentRow** | `components/leaderboard/AgentRow.tsx` | widget | `agent`, `index`, `totalAgents`, `baseDelay`, `isWinning` | `changePulse` (in `AnimatedValue`), `surgeKey` | `usePrevious`, `useRef`, `useEffect`, `useMemo` | `AgentIcon`, `AnimatedValue`, overdue styling |
| **AnimatedValue** | `components/leaderboard/AgentRow.tsx` | utility-internal | `value`, `className?`, `style?`, `highlightOnIncrease?` | `changePulse` | `usePrevious`, `useEffect` | `motion.span` layers |
| **AgentIcon** | `components/leaderboard/AgentIcon.tsx` | widget | `name`, `pct`, `animDelay`, `showCrown?` | none | none | SVG ring, `Crown`, `motion` |
| **JokerMetricsStrip** | `components/JokerMetricsStrip.tsx` | widget | `jokerName`, `joker`, `baseDelayMs`, `compact?` | none | `useMemo`×N | `JokerMetricBox`× several |
| **JokerMetricBox** | `components/JokerMetricsStrip.tsx` | utility-internal | label/value/delay/suffix slots | none | none | `AnimatedCounter` |
| **SpecialDates** | `components/SpecialDates.tsx` | widget | `queendomId` | `dateKey` | `useMemo`, `useEffect`, `midnightTimeoutRef` | `AnimatePresence` cards from `getSpecialDates()` |
| **AnimatedCounter** | `components/AnimatedCounter.tsx` | widget | `value?`, `className?`, `delay?`, `slideOnChange?` | motion-driven | `useMotionValue`, `useSpring`, `useTransform`, `useEffect`, `isFirstRender` ref, `prevValueRef` | `motion.span` / `AnimatePresence` branch |
| **OnboardingPanel** | `components/onboarding/OnboardingPanel.tsx` | section | none | `agents`, `ledger`, `pulseEvents`, `leadTrendline`, `leadStatusByAgent`, `teamAttendedTrend`, `verticalTrendline`, `leadMonthStats`, `deptStats`, `shimmerStampByAgentId`, `dealsReconnect`, `leadsReconnect` | `usePrefersReducedMotion`, many `useRef`/`useEffect` (load, interval 5m, Realtime deals/leads), `useMemo` concierge/shop agents | `DepartmentColumn`×2, middle column: metrics + `PerformanceLineGraph` + `ConversionLedger` |
| **DepartmentColumn** | `components/onboarding/DepartmentColumn.tsx` | section | `department`, `label`, `agents`, `shimmerStampByAgentId`, `prefersReducedMotion`, `leadStatusByAgent` | none in column | none | glass card, header, grid of `CompactAgentCard` |
| **CompactAgentCard** | `components/onboarding/DepartmentColumn.tsx` | card | `agent`, `department`, `shimmerStamp`, `prefersReducedMotion`, `accent`, `staggerDelay`, `leadStatus?` | `usePulse` inner → `active` bool×3 | `usePulse` uses `useRef`+`useState`+`useEffect` per metric | portrait, chips, `AgentVerticalBarChart`, `LeadStatusHealthBar` |
| **LeadVelocityChart** | `components/onboarding/LeadVelocityChart.tsx` | chart | `data: TeamAttendedDay[]` | none | `usePrefersReducedMotion`, `useMemo` | SVG paths, motion, labels |
| **PerformanceLineGraph** | `components/onboarding/PerformanceLineGraph.tsx` | chart | `data`, `pulseEvents?`, `todayDate?` | `showAllLabels`, `drawn` | `usePrefersReducedMotion`, `useMemo`, `useEffect` | SVG multi-line, legend, pulse overlays |
| **AgentVerticalBarChart** | `components/onboarding/AgentVerticalBarChart.tsx` | chart | `agents`, `accentColor?` | none | none | stacked flex bars, legend |
| **LeadStatusHealthBar** | `components/onboarding/LeadStatusHealthBar.tsx` | chart | `breakdown` (via props interface in file) | `mounted` | `useEffect`, `useMemo` | segments, gloss CSS classes |
| **ConversionLedger** | `components/onboarding/ConversionLedger.tsx` | table | `rows`, `scrollDuration`, `prefersReducedMotion` | none (rAF in refs) | `useRef`×many, `useLayoutEffect`, `useEffect` rAF loop | header + duplicated rows / static list |
| **ConversionLedgerRow** | `components/onboarding/ConversionLedger.tsx` | utility-internal | `row`, `ariaHidden?` | none | none | 3-col grid row |
| **ActiveOutlays** | `components/finance/ActiveOutlays.tsx` | section | `queendomId`, `delayMs?`, `fillRemaining?` | `outlays` | `usePrefersReducedMotion`, `useRef` timers, `useEffect` fetch + Realtime | `FinancesHeadingRail`, counters, `OutlayLedger` |
| **FinancesHeadingRail** | `components/finance/ActiveOutlays.tsx` | utility-internal | none | none | none | decorative heading |
| **OutlayLedger** | `components/finance/OutlayLedger.tsx` | table | (see file: rows + motion props) | none | see file | scrolling / static rows |
| **GlassPanel** | `components/ui/GlassPanel.tsx` | ui-primitive | `variant?`, `radius?`, `glow?`, `overlay?`, `shadow?`, `className?`, `style?`, `children?` | none | `forwardRef` → div | optional overlay wrapper |
| **StatCard** | `components/ui/StatCard.tsx` | ui-primitive | `label`, `children`, `accent?`, `className?`, `style?` | none | none | label + children |
| **SectionDivider** | `components/ui/SectionDivider.tsx` | ui-primitive | `label?`, `accent?`, `labelClass?`, `labelStyle?`, `className?` | none | none | `RuleArm`×2 or plain rule |
| **RuleArm** | `components/ui/SectionDivider.tsx` | utility-internal | `flip?` | none | none | div |
| **ErrorBoundary** | `components/ui/ErrorBoundary.tsx` | ui-primitive | `children`, `label?`, `fallback?`, `fillParent?` | `hasError`, `errorMsg` (class state) | class lifecycle | default offline UI + retry |
| **QueendomSkeleton** | `components/skeletons/QueendomSkeleton.tsx` | skeleton | `side: "left"\|"right"` | none | none | placeholder blocks |
| **OnboardingSkeleton** | `components/skeletons/OnboardingSkeleton.tsx` | skeleton | none | none | none | placeholder blocks |

**Custom hooks (not components):**

| Hook | Path | Returns / purpose |
|------|------|---------------------|
| `useDashboardData` | `hooks/useDashboardData.ts` | `ananyshreeStats`, `anishqaStats`, `recommendations`, `renewals*`, `isInitialLoading`; orchestrates fetches + 4 Realtime channels + 5m prune |
| `useCelebrationDetection` | `hooks/useCelebrationDetection.ts` | `{ celebrationAgent, clearCelebration }` |
| `usePrefersReducedMotion` | `hooks/usePrefersReducedMotion.ts` | `boolean` |

**Conditional rendering highlights:** `DashboardController` shows skeleton overlays while `isInitialLoading`; crossfade between concierge/onboarding by opacity/z-index; `QueendomPanel` shows `JokerMetricsStrip` only if `stats.joker` and `jokerDisplayName`; `RenewalsPanel` empty vs list; `SpecialDates` filters by month/past; `PerformanceLineGraph` empty state; `ConversionLedger` static vs scrolling based on reduced motion.

---

## 4. Design System

### 4.1 Typography (all fonts, sizes, weights — with usage context)

**Font families**

| Source | Families |
|--------|----------|
| **next/font/google** (`app/layout.tsx`) | **Cinzel** (400–700) → `--font-cinzel`; **Inter** → `--font-inter`; **Libre Baskerville** (400,700) → `--font-libre-baskerville`; **Montserrat** (600–800) → `--font-montserrat` |
| **Google Fonts CSS** (`globals.css` `@import`) | **Cinzel** (400–700), **Edu AU VIC WA NT Hand Arrows** (variable) — used via `--font-edu` legacy |
| **Tailwind `fontFamily`** (`tailwind.config.ts`) | `font-cinzel`, `font-playfair` (var only, Playfair not loaded in layout — **fallback serif**), `font-inter`, `font-edu`, `font-baskerville`, `font-montserrat` |

**Typical usage:** Cinzel / gold-glow for headings and large numbers; Inter for labels, clocks, ledger; Montserrat referenced in tailwind for potential use; `font-edu` on Renewals counter.

**CSS variables — scale** (`globals.css` `:root`)

| Token | Role |
|-------|------|
| `--text-counter-hero` … `--text-counter-md` | Giant scoreboard clamps |
| `--text-heading-xl/md/lg` | Headings |
| `--text-label-xl/lg/md` | Labels |
| `--text-ob-*` | Onboarding-specific clamps |
| `--text-fin-cell` | Finance cells |

**Representative Tailwind / inline clamps** (non-exhaustive literals also appear in TSX):

- TopBar: `clamp(24px,3.075vw,45px)`, `clamp(2.1rem,4.65vw,4.425rem)`, `clamp(27px,3.375vw,48px)`, `clamp(24px,2.775vw,42px)`
- Queendom metrics: `text-8xl`, `min-[900px]:text-9xl`, `text-[clamp(27px,3vw,39px)]`
- Onboarding utils: `ONBOARDING_PAGE_TITLE_FONT`, `DEPT_HEADING_FONT`, ledger fonts, compact card fonts (see `components/onboarding/utils.ts`)
- Ticker CSS class `.ticker-item`: `font-size: 2rem`

**Weights:** Tailwind `font-semibold`, `font-bold`, `font-medium`; Cinzel weights from next/font subset.

**Line-height / letter-spacing:** `leading-none`, `leading-snug`, `tracking-[0.25em]`–`[0.46em]` uppercase labels common.

### 4.2 Color Palette (all colors — with usage context)

**Tailwind extended palette** (`tailwind.config.ts`): `obsidian`, `rosegold`, `gold` 50–900, `liquid-gold` start/end, `champagne`, `charcoal` 50–900, `chocolate`, `olive`, plus CSS-var-backed `surface-*`, `status-*`.

**`:root` CSS variables** (`globals.css`): surfaces (`--surface-glass`, `--surface-card`, …), gold spectrum (`--gold-primary`, `--gold-bright`, …), borders (`--border-gold-*`, `--border-subtle`), shadows (`--shadow-gold-sm/md/lg`), status (`--color-emerald`, `--color-red`, `--color-red-overdue`, `--color-amber`, `--color-sky`, `--color-champagne`).

**Inline / component-specific:** `PerformanceLineGraph` vertical hex lines (`#6B8FFF`, `#FFB020`, `#34D399`, `#C084FC`); `LeadVelocityChart` `GOLD`/`SKY`; ticker type colors in `RecommendationTicker`; department accents in `DepartmentColumn` (`rgba(212,175,55,…)`, `rgba(125,211,252,…)`); Renewals gradient text utilities.

**Palette consistency:** Strong **token + Tailwind** baseline; **some chart and ticker colors are duplicated as hex/rgba** alongside tokens — see §11.

### 4.3 Spacing System (all margin/padding/gap values)

- **Global tokens:** `--pad-panel`, `--pad-card`, `--pad-cell`, `--gap-card` (all `clamp(...)`).
- **Patterns:** extensive `clamp()` in onboarding and finance; Tailwind `gap-*`, `p-*`, `px-*`, `py-*`, `mb-[vh]` style fractional viewport spacing; QueendomPanel `padding: 2vh clamp(12px, 3vw, 40px)`.
- **DashboardController:** center column `width: 36px`; inline `2vh` margins on separator.

### 4.4 Sizing & Layout (card sizes, grid configs, viewport handling)

- **Dashboard root:** `md:w-screen md:h-screen`; inner controller `width/height: 100vw/100vh`.
- **globals.css:** `@media (min-width: 768px)` → `html { font-size: 112.5% }`, `html,body { height: 100vh; overflow: hidden }` — **TV / tablet viewport lock**.
- **OnboardingPanel:** CSS grid `gridTemplateColumns: "1fr 1fr 1.05fr"`; Performance column `flex-[2]` / ledger `flex-[3]`; 4-metric row `repeat(4,1fr)`.
- **QueendomPanel:** `grid-cols-2 min-[700px]:grid-cols-5` for hero metrics; leaderboard + special dates `md:flex-row`; Special Dates column `md:w-[clamp(360px,46vw,680px)]` with height synced to leaderboard via `ResizeObserver`.
- **Agent leaderboard:** `GRID_COLS` responsive `minmax` template (see `AgentRow.tsx`).

### 4.5 Visual Effects (shadows, borders, animations)

- **Box-shadow:** `--shadow-gold-*`, Tailwind `shadow-gold-sm/md/lg`, inset highlights, `celebration-avatar-glow`, `drop-shadow-gold`, card/ledger shadows in onboarding Performance panel.
- **Text-shadow:** `.queen-name-glow`, `.sky-name-glow`, `.gold-glow`, `.emerald-glow-hero`, `.monthly-error-glow`, `.error-overdue-glow`, `.celebration-name-glow`, Tailwind arbitrary shadow on unpaid numbers, escalation keyframes in `tailwind.config.ts`.
- **Backdrop:** `backdrop-blur-md` / `backdrop-blur-sm` on pause button, wingspan pills, leaderboard header — **may be costly on old TV GPUs** (§8).
- **Border-radius:** `--radius-card` (1rem), `--radius-panel` (1.5rem), `rounded-2xl`, `rounded-full`, `rounded-xl`.
- **Animations:** Tailwind `animate-*` (pulse-ring, aura-pulse, halo-breathe, text-shimmer, escalation-breathe, gold-pulse); globals: `gold-sweep`, `row-shimmer`, `ticker-scroll`, `foil-shimmer`, `hot-pulse`, `healthbar-*`, `bar-gloss-sweep`, `ob-metric-pulse`, `lvc-pulse`, many `plg-*` in `PerformanceLineGraph` injected `<style>`; Framer Motion on dashboard, rows, ticker.
- **Noise overlay:** `body::before` SVG turbulence at 3% opacity.
- **Glass:** `.glass`, `.glass-pill`, `GlassPanel` variants.

---

## 5. Data Architecture

### 5.1 Data Sources & API Endpoints

| Route | Method | Role |
|-------|--------|------|
| `/api/tickets/rows` | GET | Minimal ticket rows for dashboard aggregation |
| `/api/clients` | GET | Member counts per queendom |
| `/api/jokers` | GET | Joker stats per queendom |
| `/api/jokers/recommendations` | GET | Ticker items |
| `/api/renewals-panel?queendom=` | GET | Renewals + assignments |
| `/api/onboarding` | GET | Full onboarding payload (agents, ledger, trends, stats) |
| `/api/tickets` | GET | (Heavier ticket API — used by scripts/docs; not the hook’s primary path) |
| `/api/agents` | GET | Agent-day stats (documented in route comments) |
| `/api/webhooks/freshdesk` | POST | Upsert/patch/delete tickets via **Supabase service role** |
| `/api/webhooks/zoho-leads` | POST | Lead pipeline ingestion |
| `/api/webhooks/zoho-deals` | POST | Deal logging |

**External service:** **Supabase** (Postgres + Realtime). Server routes use `lib/supabaseAdmin.ts` (`createClient` with service role). Browser uses `lib/supabase.ts` (anon, singleton).

**Static / seed data**

| File | Content |
|------|---------|
| `lib/specialDates.ts` | `SPECIAL_DATES_RAW` → `getSpecialDates()` |
| `lib/agentRoster.ts` | Fixed agent rosters for queendoms |
| `lib/onboardingAgents.ts` | Fallback agent cards / ordering |
| `tickets.csv`, `last 30 - last 30.csv` | Offline CSV (import scripts) |
| `public/images/agents/*.png`, `onboarding-agents-images/*.webp` | Imagery |

**Auth on webhooks:** No `Authorization` header checks grep’d in `app/api`; security relies on **secret URLs** and server-side Supabase keys — **verify HMAC or shared secret** is recommended (§11).

### 5.2 Fetching Strategy per Data Type

| Data | Mechanism | Refresh |
|------|-----------|---------|
| Main dashboard bundle | `useDashboardData` → `fetchAll()` on mount; each `fetch(..., { cache: "no-store" })` | Initial once + Realtime triggers refetch/patch |
| Tickets / agents / members / jokers | Supabase channels `dashboard-tickets`, `-clients`, `-jokers`; jokers also patch `recommendations` state | Realtime + 5m `setInterval` prune on `ticketRows` |
| Renewals | Channel on `renewals` INSERT + `members` INSERT → `fetchRenewals` | Event-driven |
| Onboarding | `OnboardingPanel.load()` on mount; debounced 2.5s after Realtime bursts; **5m interval** safety refresh | + Realtime reconnect counters |
| Finance (`ActiveOutlays`) | Initial Supabase query + channel `finance-outlays-{id}` | Realtime (widget unused in current tree — §11) |

**Loading UX:** `isInitialLoading` until all six dashboard fetches settle OR **8s safety timeout**; skeleton overlays on queendoms + onboarding.

**Errors:** Per-fetch `try/catch` with `console.error`; failed fetch leaves prior/zero state; onboarding `catch` swallows errors silently.

### 5.3 Transformation & Computation Layer

| Module | Role |
|--------|------|
| `lib/ticketAggregation.ts` | `aggregateTicketStats`, `mergeAndRankAgents`, `pruneTicketRowsForDashboardState` |
| `lib/istDate.ts`, `lib/istMonthBounds.ts` | IST boundaries for cohorts |
| `lib/onboardingAgents.ts` | Department mapping, rollups for API |
| `lib/onboardingTypes.ts` | Shapes for onboarding API |
| `components/onboarding/utils.ts` | Sort ledger, format dates/amounts, portrait map, typography constants |
| `components/finance/utils.ts` | `rowToDisplay`, caps, timing constants |

### 5.4 State Management

- **Local / hook state only** — no global store.
- **Dashboard:** all live metrics flow from `useDashboardData` into props.
- **Onboarding:** self-contained in `OnboardingPanel` with Supabase subscriptions.
- **Celebration:** `useCelebrationDetection` compares previous `tasksCompletedToday` via ref map.

---

## 6. Routing & Pages

| Route | File | Notes |
|-------|------|-------|
| `/` | `app/page.tsx` → `Dashboard` | Single public route |
| API | `app/api/**/route.ts` | REST handlers only |

**No `middleware.ts`.** **No multi-page navigation** — TV UI is single URL with internal screen rotation (concierge ↔ onboarding every **30s** unless PAUSE / keyboard override).

**Layout nesting:** `app/layout.tsx` wraps all pages; body `overflow-hidden` + `bg-obsidian text-champagne`.

---

## 7. Charts & Visualisations

| Component | Library | Type | Data shape | Colors | Responsive | Interaction |
|-----------|---------|------|-------------|--------|--------------|-------------|
| **LeadVelocityChart** | Custom SVG + Framer | Dual smooth line + area | `TeamAttendedDay[]` | Gold `#d4af37`, sky `#7dd3fc` | `viewBox` scale | Reduced motion short-circuits animation |
| **PerformanceLineGraph** | Custom SVG + Framer + injected keyframes | 4 line + area, pulse bursts | `VerticalTrendPoint[]`, `PulseEvent[]` | Per-vertical hex map | `viewBox` | `showAllLabels` state; pulse by team |
| **AgentVerticalBarChart** | Flex stacked bars | Vertical stacked “pipeline” | `OnboardingAgentRow[]` (pipeline or derived) | CSS vars `--color-*` | flex stretch | none |
| **LeadStatusHealthBar** | div segments + CSS anim | Segmented health bar | `AgentLeadStatusBreakdown` | `STATUS_COLORS` record | flex | reduced motion in CSS |
| **Joker / ticket metrics** | Numeric | KPI-style | props | Tailwind semantic | grid | counters |
| **ConversionLedger** | DOM table + rAF scroll | Scrolling ledger | `OnboardingLedgerRow[]` | dept accent borders | height-driven speed | static if reduced motion |
| **RenewalsPanel** | Lists + counter | KPI + lists | renewals API shape | gold / gradient text | flex | none |
| **AgentIcon** | SVG stroke-dashoffset | Ring gauge | completion ratio | gold stroke | fixed breakpoints | none |

**No shared charting library** — consistent custom aesthetic, higher maintenance cost.

---

## 8. TV-Specific Concerns

| Topic | Finding |
|-------|---------|
| **Viewport meta** | Not explicitly set in `metadata` export; rely on browser default |
| **Scroll** | `overflow: hidden` on `html,body` for `min-width: 768px`; `Dashboard` uses `overflow-auto md:overflow-hidden`; **QueendomPanel** uses `overflow-y-auto` on small / min-height path — **small screens can scroll** |
| **Remote / keyboard** | `DashboardController`: Space/Enter/P/Arrow keys, capture phase; **PAUSE** button (`min-h-[48px]`, `aria-pressed`, `aria-label`) |
| **10-foot UI** | Large `clamp` typography, `html { font-size: 112.5% }` at 768px+, counters `text-8xl`/`9xl` |
| **Auto-refresh** | Realtime-driven; onboarding + dashboard **5 min** polling safety nets; TopBar clock **1s** |
| **CSS support risk** | **`min()` in `clamp()`** (e.g. `clamp(2rem, min(4.6vmin, 5.9vh), 4.4rem)`) — **older WebKit may choke** if TV browser is very old; **`svh`** on QueendomPanel (`min-h-[85svh]`); **`backdrop-filter`** — uneven support/perf; **`-webkit-background-clip: text`** used for shimmer text |
| **Heavy effects** | Continuous rAF ledger scroll; Framer layout animations; multiple Realtime channels; particle + Web Audio celebration |
| **Kiosk** | Full-viewport layout; no address bar control in app; PAUSE helps manual hold |

---

## 9. Performance Findings

| Area | Observation |
|------|----------------|
| **Bundle** | Framer Motion + lucide + full Supabase client; no `@next/bundle-analyzer` in repo |
| **Images** | **No `next/image` usage** in `components/` or `app/` — static imports for `.webp` portraits (bundled as assets); public PNGs for agents |
| **Code splitting** | No `dynamic()` imports for heavy panels |
| **Re-renders** | `memo` on `AgentRow`, `AgentIcon`, `LeadStatusHealthBar`, ticker, celebration dust; `useMemo` in several panels |
| **useEffect deps** | `useCelebrationDetection` **intentionally omits** `celebrationAgent` (documented + eslint-disable) to avoid feedback loop |
| **Intervals** | Dashboard 5m prune + 8s loading cap cleared; TopBar 1s cleared; onboarding 5m + debounce cleared; midnight timeout in `SpecialDates` cleared |
| **Duplicate fetch types** | `fetchRenewals` called twice in parallel for two queendoms — intentional |
| **ResizeObserver** | QueendomPanel observes leaderboard height — bounded |

---

## 10. Code Quality Findings

| Topic | Finding |
|-------|---------|
| **Naming** | Generally consistent PascalCase components, camelCase hooks |
| **Duplication** | `RenewalsPanelData` interface duplicated in `DashboardController.tsx` vs `types/index.ts` / props |
| **Prop drilling** | Mostly 1–2 levels from `Dashboard` → panels; onboarding is wide but local |
| **Dead / unused** | **`ActiveOutlays` / `OutlayLedger` / finance utils are not imported by any screen component** — only referenced in docs / `ErrorBoundary` comments → **dead feature path** unless wired back into `QueendomPanel` |
| **Console** | Many `console.error` / `console.info` / `console.log` in API routes, hooks (`useDashboardData` Realtime subscribe), webhooks — **acceptable for ops, noisy for production TV** |
| **Magic numbers** | Documented durations (30_000 ms screens, 8_000 ms skeleton cap, 5×60_000 prune, ticker 40s, etc.) |
| **Error boundaries** | Used in `Dashboard` around TopBar, Celebration, Ticker, and each major panel in `DashboardController` |
| **Accessibility** | Some `aria-hidden`, `aria-pressed`, `aria-label` on controls; leaderboard/ticker could use more live-region semantics for TV |

---

## 11. Issues & Recommendations

| Priority | Issue | Recommendation |
|----------|-------|----------------|
| **CRITICAL** | Webhook routes appear to have **no shared-secret validation** | Add HMAC or bearer token verification before mutating Supabase |
| **HIGH** | **`ActiveOutlays` finance widget not mounted** in live UI | Either integrate under `QueendomPanel` or remove dead code to reduce confusion |
| **HIGH** | **`font-playfair`** in Tailwind maps to variable **not loaded** in `layout.tsx` | Load Playfair via `next/font` or remove token |
| **MEDIUM** | **`min()` inside `clamp()`** in CSS variables | Test on target Sony WebKit; simplify to two-arg `clamp` if unsupported |
| **MEDIUM** | **`backdrop-blur`** on TV | Prefer solid fills or test on device; blur can drop frames |
| **MEDIUM** | Duplicate **`RenewalsPanelData`** type | Import shared type from `@/types` |
| **MEDIUM** | **`useCelebrationDetection`** reads `celebrationAgent` inside effect without dep | Intentional but fragile if logic changes — add comment at effect + consider ref-based guard |
| **LOW** | Production **console.info** on every Realtime subscribe | Gate behind `NODE_ENV` or remove |
| **LOW** | **No `next/image`** | For large PNGs/WebP, consider `next/image` with sizes for cache policy (if remote later) |
| **LOW** | Chart hex colors duplicated vs tokens | Map chart series to CSS variables for theming |

---

## 12. Quick Reference Cheat Sheet

### Font sizes (representative)

| Pattern | Example |
|---------|---------|
| CSS var clamps | `--text-counter-hero`, `--text-heading-xl`, `--text-label-xl`, `--text-ob-*`, `--text-fin-cell` |
| Tailwind extended | `text-7xl` 4.5rem, `text-8xl` 6rem, `text-9xl` 8rem |
| Inline clamps | TopBar date/time; Queendom `clamp(27px,3vw,39px)`; onboarding utils constants in `utils.ts` |
| Fixed | `.ticker-item` `2rem` |

### Colors (canonical)

| Token / name | Hex / form |
|--------------|------------|
| Obsidian | `#050505` / `#050507` |
| Gold primary | `#d4af37` (`gold-400`) |
| Gold bright | `#f9e27e` |
| Champagne | `#F7E7CE` / `#f5e6c8` |
| Emerald / red / amber / sky | `#34d399`, `#f87171`, `#fcd34d`, `#7dd3fc` |
| Vertical chart | `#6B8FFF`, `#FFB020`, `#34D399`, `#C084FC` |

### Spacing / gap (tokens)

| Token | Role |
|-------|------|
| `--pad-panel` | panel padding clamp |
| `--pad-card` | card padding clamp |
| `--pad-cell` | cell padding clamp |
| `--gap-card` | card gap clamp |

### Motion durations (cheat)

| Constant | Value |
|----------|--------|
| Screen rotation | 30s per screen |
| Crossfade | 1.5s Framer |
| Skeleton exit | 0.9s |
| Initial load cap | 8s |
| IST prune / onboarding poll | 5 min |
| Realtime debounce (onboarding) | 2.5s |
| Ticker cycle | 40s (`RecommendationTicker`) |

---

*End of audit. Application source files: `app/`, `components/`, `hooks/`, `lib/`, `types/`; infrastructure: `supabase/migrations/`; tooling: `scripts/`, root configs.*
