# Design & Layout Audit Report

**Project:** Indulge Live Dashboard (Next.js 16 App Router, React 18, Tailwind 3.4, Framer Motion 11)  
**Audit scope:** All `.tsx`, `.ts` (UI-relevant), and `app/globals.css` under the repository root. API-only routes and scripts are excluded from component inventory except where they affect no UI.  
**Method:** Static analysis of source (no runtime profiling). Line numbers refer to the workspace state at audit time.

---

## Executive Summary

The codebase is clearly optimized for a **fixed-viewport, kiosk-style TV** experience: generous `clamp()` typography on concierge panels, `vh`/`vw`-based padding in many places, and intentional GPU hints (`translateZ`, `will-change`). A **partial design token layer** exists in `app/globals.css` (`:root` CSS variables for colors, typography scale, spacing, radii) and is extended in `tailwind.config.ts` (surface colors, shadows, radii). In practice, **most screens still duplicate the same patterns** with Tailwind arbitrary values (`text-[clamp(...)]`), repeated `glass gold-border-glow rounded-2xl` stacks, and extensive inline `style={{}}` for gradients and layout—so the token system is **underutilized** relative to its documentation.

The **largest cross-device risks** are: (1) **`html { font-size: 125% }` only from `min-width: 768px`** (`app/globals.css` lines 125–136), which changes the entire rem-based Tailwind scale between “phone/small laptop” and “tablet+”, while many headline sizes are expressed in **px or arbitrary rem inside `clamp()`**, producing an inconsistent perceived scale; (2) **`DashboardController` hardcodes `width: 100vw` / `height: 100vh`** (lines 97–98), which is a classic source of **horizontal overflow** when a vertical scrollbar consumes width, and which does not track dynamic toolbars the way `dvh`/`svh` can; (3) **Onboarding and chart helper text** use clamps whose **minimum is well under 14px equivalent** (e.g. `0.55rem`, `0.6rem`), which fails both accessibility minimums and **10-foot TV readability** if those regions are ever viewed at distance.

Overall health: **strong for a single-target 1080p–1440p wall display**, **weaker for “one build, MacBook 1280px ↔ 4K 3840px with no zoom”** without further token unification and a few fixed-pixel hero elements (celebration avatar, separator column) that do not scale with resolution.

---

## Critical Issues (Must Fix)

1. **Viewport units + `100vw` on the main screen shell** — `components/DashboardController.tsx` lines 95–98: `style={{ width: "100vw", height: "100vh" }}` can introduce **1–17px horizontal scroll** on browsers that reserve scrollbar gutter, and `100vh` ignores mobile dynamic viewport. **Fix:** Prefer `w-full h-full` inside the parent that already uses `md:h-screen`, or `min-h-dvh` / `h-dvh` with overflow strategy documented; avoid `100vw` for full-bleed children of `overflow-hidden` body.

2. **Breakpoint discontinuity at 768px** — `app/globals.css` lines 125–136: `html { font-size: 125%; }` and locked `height: 100vh; overflow: hidden` apply only at `min-width: 768px`, matching Tailwind `md:`. Below that, `components/Dashboard.tsx` line 43 uses `overflow-auto` and no rem boost—**the same Tailwind `text-base` / rem utilities mean different physical sizes** above vs below 768px. **Fix:** Document a single “reference viewport” strategy; consider fluid root scaling via `clamp()` on `html` or move TV scaling to container queries, not a binary 768px step.

3. **Typography below 14px effective minimum in production UI** — Examples: `components/onboarding/utils.ts` `COMPACT_METRIC_LABEL_FONT` line 76–77 (`clamp(0.55rem, …, 1.5rem)` — **0.55rem ≈ 8.8px at 100% root**); `components/leaderboard/AgentIcon.tsx` line 89 `text-[0.6rem]` at default breakpoint (~9.6px at 100% root); `components/onboarding/LeadVelocityChart.tsx` lines 361–396 (`clamp(0.6rem, …)`); `components/onboarding/AgentVerticalBarChart.tsx` lines 113–127 (`clamp(0.45rem,…)`). **Fix:** Raise all mins to **≥14px** or **≥0.875rem** (and test at 125% root + distance viewing).

4. **Fixed 220px celebration avatar** — `components/CelebrationOverlay.tsx` lines 143–145 (`width: 220, height: 220`). On **3840px-wide 4K**, this reads as a small medallion; on **1280px**, it dominates. **Fix:** `clamp(140px, 18vmin, 280px)` or similar, aligned with token scale.

5. **Duplicate / competing ticker typography** — `app/globals.css` lines 330–336 `.ticker-item { font-size: 2.5rem; padding: 0 5rem; }` vs `components/RecommendationTicker.tsx` line 116+ which uses `clamp()` on inner spans. The **cascade order** determines what wins; mixed sources increase drift. **Fix:** Single source (token or component-only).

6. **Explicit viewport metadata absent from `app/layout.tsx`** — Only default Next metadata (`title`, `description`). Project relies on framework defaults for `viewport`. For kiosk/TV, teams often add `width=device-width, initial-scale=1` and verify **no accidental zoom** on hardware. **Fix:** Export `viewport` from `layout.tsx` per Next 14+ metadata API and validate on target TVs.

---

## Layout Architecture

### Root shell

- **`app/layout.tsx`** — Loads Google fonts as CSS variables on `<html>`, applies `globals.css`, wraps children in `<body className="bg-obsidian text-champagne overflow-hidden antialiased">` (line 48).
- **`app/page.tsx`** — Renders `<Dashboard />` only.

### Nesting hierarchy (concierge + ticker)

```
body (overflow-hidden)
└── Dashboard (components/Dashboard.tsx)
    ├── div.ambient-glow-center (absolute decorative)
    ├── ErrorBoundary → TopBar (motion.header)
    ├── ErrorBoundary → CelebrationOverlay (fixed z-50 when active)
    ├── DashboardController (flex-1 min-h-0; main region)
    │   ├── button PAUSE/RESUME (absolute z-[100])
    │   ├── motion.div (concierge screen, opacity/zIndex crossfade)
    │   │   └── flex row (md) / col (<md)
    │   │       ├── QueendomPanel (Ananyshree) + skeleton overlay
    │   │       ├── center separator (md only, fixed 36px)
    │   │       └── QueendomPanel (Anishqa) + skeleton overlay
    │   └── motion.div (onboarding screen)
    │       └── OnboardingPanel + skeleton overlay
    └── div z-10 → ErrorBoundary → RecommendationTicker
```

### Layout systems in use

| Mechanism | Where |
|-----------|--------|
| **Flexbox** | Primary: `Dashboard`, `DashboardController`, `QueendomPanel`, `RenewalsPanel`, `OnboardingPanel`, most cards. |
| **CSS Grid** | Hero metrics (`grid-cols-2 min-[700px]:grid-cols-5`), onboarding `gridTemplateColumns: 1fr 1fr 1.05fr`, leaderboard `GRID_COLS` in `AgentRow.tsx`. |
| **Tailwind** | Throughout; arbitrary breakpoints `min-[500px]`, `min-[700px]`, `min-[900px]`. |
| **Container queries** | `components/onboarding/DepartmentColumn.tsx` — `cqw` / `cqh` units in inline styles for compact cards. |
| **Libraries** | No `react-grid-layout` / MUI Grid; **Framer Motion** for layout-adjacent animation (opacity, y, crossfade). |

### Overall pattern

**Full-bleed, no sidebar:** top header (`TopBar`) + **flex column** main (`DashboardController` grows) + **fixed-height ticker** at bottom (`shrink-0`). Concierge mode is **two equal flex columns** separated by a decorative column at `md+`. Onboarding is **full-screen overlay** in the same flex region with crossfade, not a separate route.

---

## Component Inventory

| Component | File | Role | Layout position | Notes |
|-----------|------|------|------------------|--------|
| `Dashboard` | `components/Dashboard.tsx` | Root shell; data hooks; composes regions | Root below `body` | Thin; delegates to hooks + children. |
| `TopBar` | `components/TopBar.tsx` | Branding, IST clock, date | **Header** (flex-shrink-0) | `motion.header`; height `18vh` clamped 96–165px (line 35). |
| `DashboardController` | `components/DashboardController.tsx` | Screen rotation, keyboard, skeletons | **Main** (flex-1) | `100vw`/`100vh` wrapper; PAUSE `z-[100]`. |
| `QueendomPanel` | `components/QueendomPanel.tsx` | Full half-queendom concierge UI | **Main column** | `motion.section`; scroll `overflow-y-auto` below `md`. |
| `QueendomWingspanHeader` | `components/QueendomWingspanHeader.tsx` | Member counts + queendom name | Top of panel | 3-col grid; `text-6xl` … `xl:text-8xl`. |
| `MetricBox` | `components/QueendomPanel.tsx` (local) | Single hero metric cell | Hero row | Padding `1.2vh` + horizontal `clamp`. |
| `AnimatedCounter` | `components/AnimatedCounter.tsx` | Number animation | Inside metrics / rows | Optional `slideOnChange`; no memo. |
| `RenewalsPanel` | `components/RenewalsPanel.tsx` | Renewals + assignments | Mid panel | Flex row; `vertical-separator` class. |
| `AgentLeaderboard` | `components/leaderboard/AgentLeaderboard.tsx` | Leaderboard container | Lower panel (left column) | Sticky header row + `AnimatePresence` list. |
| `AgentRow` | `components/leaderboard/AgentRow.tsx` | One agent row | Inside leaderboard | Memoized; surge + win shimmer layers. |
| `AgentIcon` | `components/leaderboard/AgentIcon.tsx` | Ring + crown + rank | Col 1 of row | Responsive `44→72px`; small label `0.6rem` base. |
| `SpecialDates` | `components/SpecialDates.tsx` | Birthday/anniversary cards | Right column (`md`) | `overflow-y-auto` list; motion cards. |
| `JokerMetricsStrip` | `components/JokerMetricsStrip.tsx` | Joker sub-metrics | Below leaderboard | `compact` mode in `QueendomPanel`. |
| `CelebrationOverlay` | `components/CelebrationOverlay.tsx` | Full-screen win | **Overlay** `fixed inset-0 z-50` | Memo inner; 220px avatar. |
| `RecommendationTicker` | `components/RecommendationTicker.tsx` | Bottom marquee | **Footer strip** | CSS `ticker-scroll`; memo items. |
| `OnboardingPanel` | `components/onboarding/OnboardingPanel.tsx` | Revenue dashboard | Full main (crossfade) | Large state + Realtime; **god component** (~650 lines). |
| `DepartmentColumn` | `components/onboarding/DepartmentColumn.tsx` | Concierge/shop column | Grid col 1 / 3 | `@container` typography. |
| `ConversionLedger` | `components/onboarding/ConversionLedger.tsx` | Deal ledger + rAF scroll | Grid col 2 bottom | Pixel `translateY` scroll. |
| `PerformanceLineGraph` | `components/onboarding/PerformanceLineGraph.tsx` | SVG line chart | Grid col 2 top | Inline SVG animation styles. |
| `LeadVelocityChart` | `components/onboarding/LeadVelocityChart.tsx` | Secondary chart | (if mounted from parent) | Small axis fonts. |
| `AgentVerticalBarChart` | `components/onboarding/AgentVerticalBarChart.tsx` | Bar chart | Inside dept column | Very small legend fonts. |
| `LeadStatusHealthBar` | `components/onboarding/LeadStatusHealthBar.tsx` | Pipeline health | Dept column | `BAR_H` clamp 44–78px. |
| `QueendomSkeleton` | `components/skeletons/QueendomSkeleton.tsx` | Loading chrome | Overlay on `QueendomPanel` | Mirrors layout. |
| `OnboardingSkeleton` | `components/skeletons/OnboardingSkeleton.tsx` | Loading chrome | Overlay on onboarding | Mirrors layout. |
| `ActiveOutlays` | `components/finance/ActiveOutlays.tsx` | Finance widget | **Not mounted** in `QueendomPanel` (per `CLAUDE.md`) | Complete implementation exists. |
| `OutlayLedger` | `components/finance/OutlayLedger.tsx` | Ledger rows | Child of `ActiveOutlays` | Grid 3-col. |
| `GlassPanel` | `components/ui/GlassPanel.tsx` | Glass container primitive | — | **No imports found** in app/components. |
| `StatCard` | `components/ui/StatCard.tsx` | Metric tile primitive | — | **No imports found**; `QueendomPanel` uses local `MetricBox` instead. |
| `SectionDivider` | `components/ui/SectionDivider.tsx` | Titled rule | — | **No imports found**; duplicated `h-px flex-1` patterns. |
| `ErrorBoundary` | `components/ui/ErrorBoundary.tsx` | Widget isolation | Wraps major regions | Class component; offline UI. |

**Parent usage summary:** `Dashboard` → `TopBar`, `CelebrationOverlay`, `DashboardController`, `RecommendationTicker`. `DashboardController` → two `QueendomPanel`s + `OnboardingPanel`. `QueendomPanel` → `QueendomWingspanHeader`, `AnimatedCounter`, `RenewalsPanel`, `AgentLeaderboard`, `SpecialDates`, `JokerMetricsStrip`.

---

## Sizing & Spacing Catalog

Representative values (not every duplicate). **“Responsive?”** = scales with viewport or fluid typography.

| Location | Property | Value | Responsive? | Notes / recommended fix |
|----------|----------|-------|---------------|-------------------------|
| `DashboardController.tsx` L97–98 | width/height | `100vw` / `100vh` | Partial | ❌ Prefer `100%` of parent or `dvh`; avoid `vw` scrollbar gap. |
| `DashboardController.tsx` L104 | min size | `min-h-[48px] min-w-[140px]` | Fixed min | OK for TV touch; verify **140px** on 1280 with scaling. |
| `DashboardController.tsx` L156 | width | `36px` | Fixed | ❌ Consider `clamp(24px, 2vw, 48px)` for 4K proportion. |
| `TopBar.tsx` L35 | height | `18vh`, min `96px`, max `165px` | Yes | Good pattern; max caps TV giant headers. |
| `QueendomPanel.tsx` L149 | min-height | `min-h-[85svh]` & `md:min-h-0` | Yes | Allows mobile scroll column. |
| `QueendomPanel.tsx` L150, L194, L293 | padding | `2vh clamp(12px,3vw,40px)` etc. | Yes | Consistent token-like clamps. |
| `QueendomPanel.tsx` L311 | width | `md:w-[clamp(360px,46vw,680px)]` | Yes | ❌ **360px min** can steal width on **1280** split; monitor overflow with long names. |
| `RenewalsPanel.tsx` L43 | min-width | `min-w-[clamp(140px,18vw,200px)]` | Yes | OK. |
| `globals.css` L333 | padding | `0 5rem` on `.ticker-item` | Fixed rem | ❌ Very wide on large root font; tie to `clamp`. |
| `CelebrationOverlay.tsx` L143–145 | avatar | `220` px | No | ❌ Replace with vmin/clamp. |
| `AgentIcon.tsx` L50 | box | `w-[44px] h-[44px]` … `lg:w-[72px]` | Breakpoint-based | Meets **44px** touch min at base. |
| `onboarding/utils.ts` | font clamps | various | Mixed | Several **mins &lt; 14px** — see Critical. |
| `DepartmentColumn.tsx` | padding | `2cqh 1cqw` | Container-relative | Good for nested density. |
| `LeadStatusHealthBar.tsx` L93–94 | BAR_H, RADIUS | `clamp(44px,5.2vh,78px)` etc. | Yes | Strong TV pattern. |

---

## Typography Scale

### CSS variables (`app/globals.css` `:root`)

| Token | Definition (summary) |
|-------|----------------------|
| `--text-counter-hero` … `--text-counter-md` | `clamp()` with `vw` |
| `--text-heading-xl` … `--text-heading-md` | `clamp()` with `vmin`/`vh` |
| `--text-label-xl` … `--text-label-md` | `clamp()` |
| `--text-ob-*`, `--text-fin-cell` | Onboarding / finance scales |

### Tailwind theme (`tailwind.config.ts`)

- `fontSize` extend: `7xl` 4.5rem, `8xl` 6rem, `9xl` 8rem (fixed rem; affected by root `font-size`).

### Frequently repeated arbitrary classes (components)

- **Hero labels:** `text-[clamp(30px,3vw,46px)]` — `QueendomPanel`, `JokerMetricsStrip`, `RenewalsPanel`, `QueendomWingspanHeader` (metric label).
- **Leaderboard headers:** `clamp(1.5rem,2.5vw,3rem)` — `AgentLeaderboard`.
- **Agent name:** `clamp(1.425rem,2.325vw,2.925rem)` — `AgentRow`.
- **Numeric edu font:** up to `clamp(2.325rem,3.675vw,4.65rem)` — today/monthly columns.
- **TopBar title:** `clamp(2.1rem,4.65vw,4.425rem)` — `TopBar` L52.

### Issues

- **Inconsistent hierarchy:** same semantic “section label” uses `30px`-based clamps in one file and `1.5rem`-based in another.
- **`--text-heading-md` max `5.25rem`** (`globals.css` L66) — unusually large max vs min; verify intentional (possible typo vs `3.x rem`).
- **Sub-14px mins** in onboarding charts and compact cards (flagged in Critical).

---

## Responsiveness Gaps

| Breakpoint / mechanism | Source | Components |
|------------------------|--------|------------|
| **640px (`sm:`)** | Tailwind | `TopBar`, `AgentRow`/`AgentLeaderboard` grid cols, `RecommendationTicker`, `AgentIcon`, `RenewalsPanel` (indirect), `QueendomWingspanHeader`. |
| **768px (`md:`)** | Tailwind + **globals.css** | `Dashboard`, `DashboardController`, `QueendomPanel`, `SpecialDates` side-by-side, date visibility in `TopBar`. **Binary behavior:** root `font-size` + viewport lock. |
| **1024px (`lg:`)** | Tailwind | Gaps, `AgentIcon`, grid gaps, `QueendomPanel` pl/pr. |
| **1280px (`xl:`)** | Tailwind | `AgentRow` grid; `QueendomWingspanHeader` title size. |
| **1536px (`2xl:`)** | — | Not heavily used. |
| **500px, 700px, 900px** | Arbitrary `min-[…]` | `QueendomWingspanHeader`, hero grid, counter `text-8xl` step, `RenewalsPanel` counter. |

### Zero / weak responsive handling

- **Celebration overlay** typography uses `text-8xl` / `text-9xl` with only `sm:` step — **no fine scaling** for 4K.
- **`.ticker-item` global** fixed `2.5rem` — does not track `RecommendationTicker` inner clamps.
- **Onboarding 3-column grid** (`OnboardingPanel.tsx` L461–466): `1fr 1fr 1.05fr` — **no breakpoint collapse**; narrow viewports rely on page scroll / overflow; **risk below ~1280** for readable density.

### MacBook 1280 ↔ 4K 3840 assessment

- **Concierge:** Mostly fluid; **risk** = horizontal crowding in **5-column hero** between 700–900px; **Special Dates** fixed `clamp(360px,46vw,680px)` can dominate half-width on 1280.
- **4K:** Counters grow well (`text-9xl` = 8rem); **celebration avatar** and **36px separator** stay physically small relative to screen.
- **No `zoom:`** property found (good).

---

## Code Duplication Map

| Pattern | Occurrences | Recommendation |
|---------|-------------|----------------|
| `glass gold-border-glow rounded-2xl` + inner `bg-gradient-to-br from-gold-500/[0.0x]` | `QueendomPanel`, `JokerMetricsStrip`, `RenewalsPanel` (partial), skeletons | Adopt **`GlassPanel` + overlay prop** or a single `LuxuryCard` wrapper. |
| Horizontal **gold gradient rules** flanking titles | `QueendomPanel`, `OnboardingPanel`, skeletons | Use **`SectionDivider`** (already built, unused). |
| **Metric box** (label + `AnimatedCounter`) | `MetricBox` in `QueendomPanel`, `JokerMetricBox` in `JokerMetricsStrip` | Merge with **`StatCard`** or shared primitive. |
| **Typography clamp for “broadcast label”** | Repeated `clamp(30px,3vw,46px)` | Map to **`--text-label-xl`** or one Tailwind `@utility`. |
| **Ambient radial backgrounds** | Inline in `QueendomPanel` vs classes `ambient-glow-left/right` | Prefer **class-only** for consistency. |
| **TYPE_COLORS** pattern | `RecommendationTicker` (icon border colors) | Acceptable single source within file. |

### Dead / unused UI modules

- `components/ui/GlassPanel.tsx`, `StatCard.tsx`, `SectionDivider.tsx` — **documented as canonical** but **not imported** by production components (grep: only `ErrorBoundary` from `@/components/ui` in `Dashboard` / `DashboardController`).

### Prop drilling

- `celebrationAgent` passed `Dashboard` → `DashboardController` → both `QueendomPanel`s (reasonable). `delay` / `renewalsData` per panel (reasonable).

---

## CSS Architecture Findings

| Layer | Role |
|-------|------|
| **`app/globals.css`** | Tailwind layers; **large `:root` token block**; utilities (glass, glows, ticker, skeleton, onboarding win shimmer); keyframes; **one `!important`** (`.ticker-paused` L310). |
| **Tailwind** | Utility-first; `tailwind.config.ts` extends colors, fonts, animations, shadows, radii. |
| **Inline `style={{}}`** | Heavy in **onboarding** (`OnboardingPanel`, `DepartmentColumn`, charts, `ConversionLedger`), **finance** (`ActiveOutlays`), **CelebrationOverlay**, **DashboardController** separator, **RecommendationTicker** borders/backdrop. |
| **Framer Motion** | `animate` props and `style` merges for GPU; not a separate CSS-in-JS library. |

### Conflicts / layering

- **Tailwind arbitrary font sizes** often **override** or **duplicate** CSS variable intent (`StatCard` uses `var(--text-label-xl)` correctly; most panels do not).
- **`!important`:** `app/globals.css` L310 `.ticker-paused { animation-play-state: paused !important; }` — justified for pause UX; document if adding other `!important`.

### Reset

- Tailwind **preflight** via `@tailwind base`; body `overflow-x: hidden` globally L120; scrollbar hidden WebKit L149–151 (**no scrollbar on any platform** — affects discoverability of `overflow-y-auto` regions, though intentional for TV).

### Organization

- **Single large `globals.css`** (~600 lines) vs **no per-component CSS modules**. Maintainability: moderate; onboarding complexity pushes inline styles.

---

## Design Token Status

### Present

- **Colors:** `--bg-obsidian`, `--gold-primary`, `--color-emerald`, `--color-champagne`, borders, shadows (`globals.css` L8–54); Tailwind maps `surface-*`, `status-*` to vars (`tailwind.config.ts` L54–64).
- **Typography:** `--text-counter-*`, `--text-heading-*`, `--text-label-*`, onboarding/finance text vars (`globals.css` L56–96).
- **Spacing:** `--pad-panel`, `--pad-card`, `--pad-cell`, `--gap-card` (L98–102) — **underused** vs inline `clamp` in TSX.
- **Radii:** `--radius-card`, `--radius-panel`, `--radius-pill` (L104–107); Tailwind `rounded-card`, `rounded-panel`.
- **Motion:** `--duration-crossfade`, `--ease-luxury` (L109–113).

### Missing / gaps

- **No semantic tokens** for “leaderboard header”, “ticker body”, “renewals title”—those are copy-pasted clamps.
- **No dark/light toggle** — single dark theme (acceptable for TV).
- **Contrast:** red `#ff0000` (`.error-overdue-glow`, `--color-red-overdue`) — high chroma; verify WCAG for small text (emotional intent understood).

---

## TV Display Readiness

| Criterion | Pass/Fail | Evidence |
|-----------|-----------|----------|
| Touch / remote targets ≥ 44px | **Pass** | PAUSE `min-h-[48px]` (`DashboardController` L104); `AgentIcon` 44px min. |
| 16:9 layout assumed | **Pass** (implicit) | Full-bleed flex; no aspect-ratio lock on root. |
| Text readable ~3m on TV | **Partial** | Large clamps on concierge; **fail** on small chart/compact labels. |
| Scroll on TV | **Risk** | `QueendomPanel` `overflow-y-auto` below `md`; `SpecialDates` scrolls inside column — **no visible scrollbar** (webkit hidden). |
| Viewport meta | **Unknown / default** | Not set in `layout.tsx`; rely on Next defaults. |
| TV-specific breakpoints | **None** | Only generic `md`/`lg` + arbitrary mins; **no** `min-resolution` / `pointer: coarse` media. |
| Reduced motion | **Partial** | `useReducedMotion` in celebration, onboarding, ticker pause; `globals.css` `prefers-reduced-motion` for `.hot-lead-card-pulse`. |

---

## Recommended Fixes (Prioritized)

### P0 — Layout breaking issues

1. Replace `100vw`/`100vh` on `DashboardController` root with parent-relative sizing + document overflow behavior (`components/DashboardController.tsx` L97–98).
2. Audit horizontal scroll at **1279px and 1281px** with concierge data; adjust `md:w-[clamp(360px,46vw,680px)]` if Special Dates squeezes leaderboard (`QueendomPanel.tsx` L311).

### P1 — Responsiveness & scaling

1. Unify **root font scaling** (`globals.css` L125–136) with Tailwind breakpoints—avoid 14px-equivalent discontinuity.
2. Scale **celebration avatar** and **center separator** with `clamp` / `vmin`.
3. Collapse onboarding **3-column grid** below `xl` or `lg` into stacked sections with explicit min heights.

### P2 — Typography & readability

1. Enforce **minimum 14px** (or `0.875rem`) on all production text clamps (`onboarding/utils.ts`, charts, `AgentIcon` label).
2. Fix or document **`--text-heading-md`** max value if unintended (`globals.css` L66).
3. Consolidate **hero label** sizes onto `--text-label-xl` or one shared class.

### P3 — Code cleanup & duplication

1. **Import `SectionDivider`** and replace repeated rule pairs in `QueendomPanel` / `OnboardingPanel`.
2. Either **delete** unused `GlassPanel`/`StatCard` or **migrate** `MetricBox` / glass stacks to them.
3. Move `.ticker-item` font/padding into **one layer** (remove duplicate with TSX or vice versa).

### P4 — Architecture improvements

1. **Split `OnboardingPanel`** into hooks file + layout-only component (fetch, Realtime, shimmer in hook or child modules).
2. Add **`viewport` export** in `app/layout.tsx` and test on target hardware.
3. Consider **`@container`** for concierge right column instead of JS `ResizeObserver` height sync (`QueendomPanel.tsx` L117–145 vs L311–316) — reduces layout thrash.

---

## Appendix A — Full file tree (scan set)

Relevant UI / style / config files enumerated (67 TS/TSX/JS/CSS hits from workspace glob; API routes listed by name only):

```
app/
  layout.tsx, page.tsx, globals.css
  api/  (server routes — excluded from layout audit except as N/A)
components/
  Dashboard.tsx, DashboardController.tsx, TopBar.tsx, QueendomPanel.tsx,
  QueendomWingspanHeader.tsx, RenewalsPanel.tsx, SpecialDates.tsx,
  AnimatedCounter.tsx, CelebrationOverlay.tsx, RecommendationTicker.tsx,
  JokerMetricsStrip.tsx,
  finance/ActiveOutlays.tsx, finance/OutlayLedger.tsx, finance/utils.ts,
  leaderboard/AgentLeaderboard.tsx, leaderboard/AgentRow.tsx, leaderboard/AgentIcon.tsx,
  onboarding/OnboardingPanel.tsx, DepartmentColumn.tsx, ConversionLedger.tsx,
  PerformanceLineGraph.tsx, LeadVelocityChart.tsx, AgentVerticalBarChart.tsx,
  LeadStatusHealthBar.tsx, onboarding/utils.ts,
  skeletons/QueendomSkeleton.tsx, skeletons/OnboardingSkeleton.tsx,
  ui/ErrorBoundary.tsx, ui/GlassPanel.tsx, ui/StatCard.tsx, ui/SectionDivider.tsx
hooks/useDashboardData.ts, useCelebrationDetection.ts, usePrefersReducedMotion.ts
lib/motionPresets.ts, types, agentRoster, …
tailwind.config.ts, postcss.config.js, next.config.js
```

---

## Appendix B — `!important` inventory

| File | Line | Rule |
|------|------|------|
| `app/globals.css` | 310 | `.ticker-paused { animation-play-state: paused !important; }` |

---

*End of report. Analysis only — no code changes were made as part of this deliverable.*

## Phase P0 — Resolution Log

**Scope:** P0 layout-breaking fixes + prerequisite typo/token correction carried forward from audit ambiguity.

| Audit ID | Status | Files changed | Notes |
|----------|--------|---------------|--------|
| P0.1 | Done | `components/DashboardController.tsx`, `components/Dashboard.tsx` | Removed `100vw`/`100vh` from controller root; `h-full w-full min-h-0 min-w-0` + parent `flex-1 min-w-0`. |
| P0.2 | Done | `components/QueendomPanel.tsx` | Special Dates column: `md:w-[clamp(360px,46vw,680px)]` → `md:w-[clamp(220px,40%,680px)]` so width tracks **panel** %, not full-viewport `vw` (fixes squeeze ~1280px). |
| P2.2 | Done | `app/globals.css` | `--text-heading-md` max corrected to `3.25rem` with inline comment (*heading-md: section titles, leaderboard header*). |

**Tokens added:** none (P0).

**Build:** Run `npm run build` before merge; expect clean compile.

**Manual verification:**

1. **1280 × 800** — Concierge: no horizontal scroll at 1279px / 1281px; leaderboard + Special Dates share row without clipping; Special Dates column readable.
2. **3840 × 2160** (DevTools) — Same regions; Special Dates still capped at 680px width; layout stable.

**Deferred (per roadmap):** P1.1 root `font-size` — use **clamped** formula with min at ~1024px behavior, **max** capped at `calc(100% + (1920px - 1280px) * 4 / 640)` (~125%); replace `768px` media block; set `html, body { width: 100%; height: 100%; overflow: hidden; }` globally (no `100vw`/`100vh`).

---

## Phase P1 — Resolution Log

| Audit ID | Status | Files / notes |
|----------|--------|----------------|
| P1.1 | Done | `app/globals.css` — root `font-size` clamp + global `html, body` lock (already landed before this batch); retained `background: var(--obsidian)`. |
| P1.2 | Done | `globals.css` — `--size-celebration-avatar`, `--size-center-separator`; `CelebrationOverlay.tsx` — avatar box uses `var(--size-celebration-avatar)`; `DashboardController.tsx` — separator width `var(--size-center-separator)`. |
| P1.3 | Done | `OnboardingPanel.tsx` — grid `grid-cols-1` → `lg:grid-cols-[1fr_1fr_1.05fr]`; each column wrapped with `min-h-[clamp(220px,28vh,380px)] lg:min-h-0`. |

**Tokens added:** `--size-celebration-avatar`, `--size-center-separator`, `--pad-ticker-item-x` (ticker padding; see P3.3).

**Verify:** 1280×800 — onboarding stacks in one column below lg; 3840 — three columns; celebration avatar scales; center separator scales.

---

## Phase P2 — Resolution Log

| Audit ID | Status | Files / notes |
|----------|--------|----------------|
| P2.1 | Done | Raised sub-14px-effective mins: `onboarding/utils.ts` (compact metric fonts), `AgentIcon.tsx`, `LeadVelocityChart.tsx`, `AgentVerticalBarChart.tsx`, `OnboardingPanel.tsx` (performance tile labels), `DepartmentColumn.tsx` (agent name + metric chip labels). |
| P2.2 | Skipped | Already resolved (`--text-heading-md`). |
| P2.3 | Done | `globals.css` — `--text-label-xl: clamp(30px, 3vw, 46px)`; `QueendomPanel.tsx`, `JokerMetricsStrip.tsx`, `RenewalsPanel.tsx`, `QueendomWingspanHeader.tsx` use `text-[var(--text-label-xl)]`. |

**Verify:** No text below ~14px floor in touched onboarding/leaderboard targets; hero labels match token.

---

## Phase P3 — Resolution Log

| Audit ID | Status | Files / notes |
|----------|--------|----------------|
| P3.1 | Partial | `SectionDivider.tsx` — titled variant uses `<div>` for label (valid ReactNode / typography overrides). `QueendomPanel.tsx` — “Queendom” + “Special Dates” rules → `SectionDivider`. `OnboardingLayout.tsx` — page header rules → `SectionDivider`. **Intentionally skipped:** mirrored gold arm pairs flanking wingspan header only; Performance panel sky/gold rule arms (non–`separator-gold-h`). |
| P3.2 | Done | Primitives retained as library. MetricBox/JokerMetricBox migration deferred — high visual risk. New metric UI must use StatCard. **Files:** JSDoc only — `components/ui/GlassPanel.tsx`, `components/ui/StatCard.tsx`. |
| P3.3 | Done | `globals.css` — removed duplicate `font-size` from `.ticker-item` (TSX `clamp()` on spans was the effective size); horizontal padding → `--pad-ticker-item-x: 5rem` + `padding: 0 var(--pad-ticker-item-x)`. |

**Verify:** Ticker text size unchanged; item spacing unchanged; SectionDivider rows align with prior rhythm.

---

## Phase P4 — Resolution Log

| Audit ID | Status | Files / notes |
|----------|--------|----------------|
| P4.1 | Done | **Split executed per plan:** `hooks/useOnboardingPanelData.ts` — all fetch, intervals, debounced refetch, deals + leads Realtime, pulse timers, shimmer state, derived memos; **no public API renames** (same hook result keys / types). `components/onboarding/OnboardingLayout.tsx` — layout + render only (no data/Realtime/shimmer logic). `components/onboarding/OnboardingPanel.tsx` — thin shell: `useOnboardingPanelData()` + `<OnboardingLayout {...} />`. **Verify:** `npm run build` clean. |
| P4.2 | Done | `app/layout.tsx` — `export const viewport: Viewport` (`width: device-width`, `initialScale: 1`, `themeColor: "#050507"` matches `--bg-obsidian`). |
| P4.3 | Deferred indefinitely | P4.3: Deferred indefinitely. ResizeObserver behavior is correct and tested. CSS @container replacement is a future refactor, not a fix. **No code changes.** |

**Verify P4.2:** Mobile emulator + TV browser — no unintended zoom; theme color on task switcher matches chrome.

