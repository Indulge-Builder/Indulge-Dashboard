# design.md

## 0. Document Purpose & How to Use This File

This file is the **authoritative design and frontend system specification** for the Indulge Live Dashboard. It exists so any engineer or AI model can implement new UI that matches this codebase **without opening source files**—tokens, typography, layout contracts, motion, data boundaries, and naming are frozen here. **Single rule:** If a visual, structural, or behavioral choice is **not** documented in this file (or derivable exactly from a cited token/rule here), **stop and ask** before inventing it. Consistency on a 24/7 TV wall matters more than convenience.

---

## 1. Project Context

### 1.1 What this product is

**Indulge Live Dashboard** — a real-time, browser-based **TV / kiosk** display for Indulge Global operations. It auto-rotates between a **Concierge** view (two queendoms side by side) and a **Revenue Dashboard (Onboarding)** sales view. Primary environment: **large fixed display** (e.g. 75" 4K), often fullscreen; secondary: MacBook during development. **Interaction is minimal:** auto-rotation, **PAUSE/RESUME**, arrow keys to switch screens, optional mouse hover pausing the recommendation ticker—no forms or navigation.

### 1.2 Tech stack (exact versions)

From `package.json` (caret ranges—resolve with lockfile in CI):

| Package | Version |
|--------|---------|
| **Next.js** | `^16.1.6` |
| **React** | `^18` |
| **react-dom** | `^18` |
| **TypeScript** | `^5` |
| **Tailwind CSS** | `^3.4.0` |
| **Framer Motion** | `^11.0.0` |
| **@supabase/supabase-js** | `^2.39.0` |
| **lucide-react** | `^0.363.0` |
| **date-fns** | `^3.6.0` |
| **PostCSS** | `^8` |
| **Autoprefixer** | `^10.0.1` |
| **tsx** | `^4.7.0` (scripts) |

### 1.3 Rendering environment

- **Full viewport:** `html, body { width: 100%; height: 100%; overflow: hidden; background: var(--obsidian); }` (`app/globals.css`).
- **Dashboard shell:** Root `Dashboard` uses `min-h-screen` with `md:w-screen md:h-screen` and `overflow-auto md:overflow-hidden`—**kiosk/TV targets `md+` with no page scroll**; small widths may scroll (development).
- **Root font scaling (`html`):**

```css
font-size: clamp(
  calc(100% + (1024px - 1280px) * 4 / 640),
  calc(100% + (100vw - 1280px) * 4 / 640),
  calc(100% + (1920px - 1280px) * 4 / 640)
);
```

Meaning: **~100% (16px)** near **1280px** viewport width, ramping to **~125% (~20px)** toward **1920px**, **capped** at 1920px-scale behavior; larger viewports rely on **component-level `clamp()`** for type (4K-safe).

- **Theme color:** `viewport.themeColor` = `#050507` (`app/layout.tsx`).

### 1.4 File structure & path aliases

**Path aliases (`tsconfig.json`):**

| Alias | Maps to |
|-------|---------|
| `@/*` | Repository root `./*` |

**Top-level layout:**

| Path | Role |
|------|------|
| `app/` | Next.js App Router: `layout.tsx`, `globals.css`, `page.tsx`, `api/**` REST routes |
| `components/` | React UI: dashboard shell, queendom panels, onboarding, leaderboard, finance, skeletons, `ui/` primitives |
| `hooks/` | Client hooks: data, celebration, reduced motion, onboarding |
| `lib/` | Supabase clients, aggregation math, IST dates, types, motion presets, agent rosters |
| `types/` | Re-exports and shared UI types (`types/index.ts`) |
| `public/` | Static assets (if present) |
| `scripts/` | `tsx` maintenance scripts (e.g. ticket import) |
| `supabase/migrations/` | SQL migrations (see project docs) |
| `onboarding-agents-images/` | Bundled WebP portraits |
| `tailwind.config.ts` | Tailwind theme extensions |
| `postcss.config.js` | `tailwindcss`, `autoprefixer` |
| `next.config.js` | `reactStrictMode`, Turbopack `root` |

---

## 2. Design Tokens — The Single Source of Truth

**Authoritative source:** `app/globals.css` `:root { ... }`. Use these tokens in new code; do not invent raw hex for brand surfaces.

### 2.1 Color palette

**Legacy / font hooks**

| Token name | CSS variable | Exact value | When to use |
|------------|--------------|-------------|-------------|
| Edu font | `--font-edu` | `"Edu AU VIC WA NT Hand Arrows", cursive` | Display/accent script (also loaded via Google Fonts URL import) |
| Cinzel font | `--font-cinzel` | `"Cinzel", serif` | Headings; superseded on `body` by Next font CSS vars—see §4.1 |

**Backgrounds / surfaces**

| Token name | CSS variable | Exact value | When to use |
|------------|--------------|-------------|-------------|
| Page canvas (preferred) | `--bg-obsidian` | `#050507` | Canonical page background token |
| Legacy obsidian | `--obsidian` | `#050505` | `body` background; legacy alias |
| Glass panel | `--surface-glass` | `rgba(10, 10, 10, 0.85)` | Translucent panels |
| Card | `--surface-card` | `rgba(10, 10, 10, 0.92)` | Opaque cards |
| Elevated | `--surface-elevated` | `rgba(15, 15, 20, 0.85)` | Lifted / modal tone |
| Inset | `--surface-inset` | `rgba(0, 0, 0, 0.5)` | Inset wells (StatCard) |
| Joker gradient | `--surface-joker` | `linear-gradient(135deg, rgba(212,175,55,0.06) 0%, rgba(249,226,126,0.03) 100%)` | Reference / `.joker-box` uses similar |

**Gold spectrum**

| Token name | CSS variable | Exact value | When to use |
|------------|--------------|-------------|-------------|
| Primary gold | `--gold-primary` | `#d4af37` | Brand gold; maps to `gold-400` |
| Bright gold | `--gold-bright` | `#f9e27e` | Highlights, ticker emphasis |
| Accent / stroke | `--gold-accent` | `#c9a84c` | SVG strokes, rings (e.g. AgentIcon `#c9a84c`) |
| Liquid start (legacy) | `--liquid-gold-start` | `#d4af37` | Legacy alias |
| Liquid end (legacy) | `--liquid-gold-end` | `#f9e27e` | Legacy alias |
| Border legacy | `--gold-border` | `rgba(212, 175, 55, 0.2)` | Legacy |

**Border opacities**

| Token name | CSS variable | Exact value | When to use |
|------------|--------------|-------------|-------------|
| Dim | `--border-gold-dim` | `rgba(212, 175, 55, 0.08)` | Subtle separators |
| Subtle | `--border-gold-subtle` | `rgba(212, 175, 55, 0.15)` | Light frames |
| Mid | `--border-gold-mid` | `rgba(212, 175, 55, 0.25)` | StatCard / visible rules |
| Bright | `--border-gold-bright` | `rgba(212, 175, 55, 0.55)` | Strong outlines |
| Neutral subtle | `--border-subtle` | `rgba(255, 255, 255, 0.06)` | Non-gold UI lines |

**Shadows (gold glow)**

| Token name | CSS variable | Exact value | When to use |
|------------|--------------|-------------|-------------|
| Small | `--shadow-gold-sm` | `0 0 12px rgba(212, 175, 55, 0.35)` | Tight glow |
| Medium | `--shadow-gold-md` | `0 0 28px rgba(212, 175, 55, 0.22)` | Panel glow |
| Large | `--shadow-gold-lg` | `0 0 48px rgba(212, 175, 55, 0.16)` | Wide ambient |

**Status / accent colors**

| Token name | CSS variable | Exact value | When to use |
|------------|--------------|-------------|-------------|
| Emerald | `--color-emerald` | `#34d399` | Success / resolved / positive motion |
| Emerald dim | `--color-emerald-dim` | `rgba(52, 211, 153, 0.2)` | Backgrounds |
| Emerald glow | `--color-emerald-glow` | `rgba(52, 211, 153, 0.28)` | Effects |
| Red | `--color-red` | `#f87171` | Pending emphasis (soft) |
| Red overdue | `--color-red-overdue` | `#ff0000` | Escalation / overdue |
| Amber | `--color-amber` | `#fcd34d` | Warnings |
| Sky | `--color-sky` | `#7dd3fc` | Shop / info |
| Champagne | `--color-champagne` | `#f5e6c8` | Primary body / label on dark |

**Additional non-`:root` tokens used in CSS utilities**

- `--ob-pulse-color` — animated metric flash default `#d4af37` (overridable inline from department accent).

### 2.2 Typography tokens

All below are defined on `:root` in `app/globals.css`.

**Counter / hero**

| Token | CSS variable | Value | Notes |
|-------|--------------|-------|--------|
| Counter hero | `--text-counter-hero` | `clamp(4.5rem, 9vw, 9rem)` | Largest hero numerals |
| Counter XL | `--text-counter-xl` | `clamp(2.3rem, 3.7vw, 4.7rem)` | Large statistics |
| Counter LG | `--text-counter-lg` | `clamp(2rem, 3.1vw, 4.1rem)` | Large |
| Counter MD | `--text-counter-md` | `clamp(1.65rem, 2.175vw, 2.7rem)` | Medium counters |

**Headings**

| Token | CSS variable | Value |
|-------|--------------|-------|
| Heading XL | `--text-heading-xl` | `clamp(2rem, min(4.6vmin, 5.9vh), 4.4rem)` |
| Heading LG | `--text-heading-lg` | `clamp(1.65rem, min(3.85vmin, 4.9vh), 3.85rem)` |
| Heading MD | `--text-heading-md` | `clamp(1.5rem, min(3.85vmin, 4.4vh), 3.25rem)` |

**Labels**

| Token | CSS variable | Value |
|-------|--------------|-------|
| Label XL | `--text-label-xl` | `clamp(30px, 3vw, 46px)` |
| Label LG | `--text-label-lg` | `clamp(1.5rem, 2.5vw, 3rem)` |
| Label MD | `--text-label-md` | `clamp(1.2rem, 1.9vw, 2.2rem)` |

**Onboarding scale**

| Token | CSS variable | Value |
|-------|--------------|-------|
| OB page title | `--text-ob-page-title` | `clamp(2.2rem, min(5vmin, 6.2vh), 4.6rem)` |
| OB ledger title | `--text-ob-ledger-title` | `clamp(1.8rem, min(4.2vmin, 5.1vh), 4rem)` |
| OB agent name | `--text-ob-agent-name` | `clamp(1.6rem, min(4vmin, 4.6vh), 5.5rem)` |
| OB card title | `--text-ob-card-title` | `clamp(1.35rem, min(3.2vmin, 3.6vh), 3.85rem)` |
| OB metric value | `--text-ob-metric-value` | `clamp(1.6rem, min(4.6vmin, 5.4vh), 6rem)` |
| OB metric sub | `--text-ob-metric-sub` | `clamp(1.35rem, min(3.6vmin, 4.1vh), 2.55rem)` |
| OB ledger header | `--text-ob-ledger-hdr` | `clamp(1.25rem, min(2.85vmin, 3.3vh), 2.4rem)` |
| OB ledger cell | `--text-ob-ledger-cell` | `clamp(1.3rem, min(2.8vmin, 3.4vh), 3.6rem)` |

**Finance**

| Token | CSS variable | Value |
|-------|--------------|-------|
| Finance cell | `--text-fin-cell` | `clamp(1.725rem, min(3.975vmin, 4.875vh), 5.25rem)` |

**THE TYPOGRAPHY RULES**

1. **Readable TV floor:** Prefer **`clamp(..., ..., ...)` with minimum ≥ `14px` or ≥ `0.875rem`** for production UI copy. Several legacy paths use Tailwind `text-8xl`/`text-9xl` or arbitrary clamps—the root scale enlarges these on TV.
2. **Root scale:** §1.3 formula — between ~1280px and ~1920px width, `rem` grows smoothly; above cap, behavior stays at ~1920px effective root while section clamps expand.
3. **Prefer tokens:** Section titles and metric labels should use `--text-label-*`, `--text-heading-*`, or onboarding constants from `components/onboarding/utils.ts` where applicable.
4. **Do not** scatter magic **px** for fonts unless matched to an existing pattern (e.g. TopBar uses explicit clamps).

### 2.3 Spacing tokens

| Token | CSS variable | Value | Used for |
|-------|--------------|-------|----------|
| Panel padding | `--pad-panel` | `clamp(12px, 3vw, 40px)` | Section outer padding (QueendomPanel uses equivalent `2vh clamp(12px, 3vw, 40px)`) |
| Card padding | `--pad-card` | `clamp(10px, 2vw, 28px)` | Inner card padding |
| Cell padding | `--pad-cell` | `clamp(6px, 0.8vw, 14px)` | Dense cells |
| Gap between cards | `--gap-card` | `clamp(0.65rem, min(1.4vmin, 1.8vh), 2rem)` | Card spacing rhythm |
| Ticker item X | `--pad-ticker-item-x` | `5rem` | Horizontal padding per ticker item (`.ticker-item`) |
| Celebration avatar | `--size-celebration-avatar` | `clamp(140px, 18vmin, 300px)` | Celebration overlay avatar |
| Center separator | `--size-center-separator` | `clamp(24px, 2vw, 52px)` | Width between queendoms at `md+` |

**THE SPACING RULES**

- Reuse **`--pad-*` / `--gap-card`** for structural spacing before arbitrary Tailwind spacing.
- **Gap between cards / sections** in glass layouts: align with **`--gap-card`** or documented `gap-*` in onboarding grid (`clamp(0.6rem, 1.4vw, 1.8rem)` for main onboarding columns).

### 2.4 Border radius tokens

| Token | CSS variable | Value | Where |
|-------|--------------|-------|-------|
| Card | `--radius-card` | `1rem` (16px) | Cards, StatCard, skeleton |
| Panel | `--radius-panel` | `1.5rem` (24px) | Large panels |
| Pill | `--radius-pill` | `9999px` | Pills / PAUSE button |

### 2.5 Shadow tokens

| Level | Variable | Value | Use |
|-------|----------|-------|-----|
| sm | `--shadow-gold-sm` | `0 0 12px rgba(212,175,55,0.35)` | Icons, small emphasis |
| md | `--shadow-gold-md` | `0 0 28px rgba(212,175,55,0.22)` | Panels |
| lg | `--shadow-gold-lg` | `0 0 48px rgba(212,175,55,0.16)` | Hero emphasis |

Tailwind: `shadow-gold-sm`, `shadow-gold-md`, `shadow-gold-lg` map via `theme.extend.boxShadow`.

### 2.6 Motion tokens

| Token | Value | Controls |
|-------|-------|----------|
| `--duration-crossfade` | `1.5s` | Concierge ↔ Onboarding opacity crossfade (also hardcoded `1.5` in `DashboardController` — keep in sync) |
| `--duration-counter` | `0.7s` | Documented token for counter-like animations |
| `--duration-row` | `0.55s` | Row / metric timing reference |
| `--ease-luxury` | `cubic-bezier(0.25, 0.46, 0.45, 0.94)` | Default luxury ease; mirrored as `EASE_LUXURY` in `lib/motionPresets.ts` |

**THE ANIMATION RULES**

1. **Screen crossfade:** `DashboardController` uses `fadeTransition = { duration: 1.5, ease: "easeInOut" }` on **`opacity` + `zIndex` only** — not layout.
2. **Prefer CSS variables** for new shared timing; when using Framer Motion, **`duration` values often appear as numeric literals** in this repo (`0.55`, `0.6`, `1.5`, etc.) — **new code** should either reference **`motionPresets.ts`** (`crossfadeTransition`, `EASE_LUXURY`) or **read computed style** if wiring to CSS vars dynamically.
3. **GPU:** Use `gpuStyle` from `lib/motionPresets.ts` on animated TV surfaces where applicable.
4. **Reduced motion:** `usePrefersReducedMotion` — skip infinite scroll / heavy effects when `true`.

---

## 3. Tailwind Configuration

### 3.1 Theme extensions (`tailwind.config.ts`)

**`theme.extend.colors`**

- Legacy: `obsidian`, `rosegold`, `gold` (50–900), `liquid-gold` `{ start, end }`, `champagne` (`#F7E7CE`), `charcoal`, `chocolate`, `olive`.
- Semantic maps to CSS vars:
  - `surface-card` → `var(--surface-card)`
  - `surface-glass` → `var(--surface-glass)`
  - `surface-elevated` → `var(--surface-elevated)`
  - `surface-inset` → `var(--surface-inset)`
  - `status-emerald` → `var(--color-emerald)`
  - `status-red` → `var(--color-red)`
  - `status-amber` → `var(--color-amber)`
  - `status-sky` → `var(--color-sky)`

**`theme.extend.fontFamily`**

- `cinzel` → `var(--font-cinzel)`, fallbacks `Cinzel`, `serif`
- `inter` → `var(--font-inter)`, `sans-serif`
- `edu` → `var(--font-edu)`, `Oswald`, `sans-serif`
- `baskerville` → `var(--font-libre-baskerville)`, `serif`
- `montserrat` → `var(--font-montserrat)`, `Montserrat`, `sans-serif`

**`theme.extend.keyframes` / `animation`**

- `pulse-ring`, `aura-pulse`, `halo-breathe`, `text-shimmer`, `escalation-breathe`, `gold-pulse` — see config for full definitions.

**`theme.extend.fontSize`**

- `7xl`: `4.5rem`, `8xl`: `6rem`, `9xl`: `8rem`

**`theme.extend.boxShadow`**

- `gold-sm` → `var(--shadow-gold-sm)`
- `gold-md` → `var(--shadow-gold-md)`
- `gold-lg` → `var(--shadow-gold-lg)`

**`theme.extend.borderRadius`**

- `rounded-card` → `var(--radius-card)`
- `rounded-panel` → `var(--radius-panel)`

### 3.2 Tailwind color aliases

| Class | Maps to | Typical hex / var |
|-------|-----------|-------------------|
| `bg-obsidian` / `text-champagne` | Tailwind extended palette | `#050505` / `#F7E7CE` (champagne in theme is slightly different from `--color-champagne` — **body text uses `text-champagne` on `layout.tsx`**) |
| `bg-surface-card` etc. | CSS variables | §2.1 |
| `text-status-emerald` etc. | CSS variables | §2.1 |

> ⚠ **Assumed:** Use **`text-champagne`** for prose on `body` per `layout.tsx`; token `--color-champagne` is **`#f5e6c8`** — treat as intentional slight variance when matching Figma.

### 3.3 Custom font sizes

See §3.1 — `7xl`, `8xl`, `9xl` extended.

### 3.4 Custom shadows

`shadow-gold-sm`, `shadow-gold-md`, `shadow-gold-lg` → §2.5.

### 3.5 Custom border radius

`rounded-card`, `rounded-panel` → §2.4.

### 3.6 Tailwind usage rules

- Layout: `flex`, `grid`, `gap-*`, `min-h-0`, `min-w-0`, `overflow-hidden` for TV regions.
- Brand colors: **`bg-[var(--gold-primary)]`** or **`text-gold-400`** / **`border-gold-500/20`** — avoid unrelated Tailwind colors for primary UI.
- **Do not** use **`bg-yellow-400`** for brand gold — use gold scale / tokens.
- Arbitrary values **`[...]`** appear in production (e.g. leaderboard grid templates) — **only when no token exists**; prefer extending tokens if reused.

---

## 4. Typography System

### 4.1 Font families

| Display | CSS variable | Source | Where used |
|---------|--------------|--------|--------------|
| **Cinzel** | `--font-cinzel` | `next/font/google` `Cinzel` + Google Fonts link for Edu/Cinzel weights | TopBar title, queendom names, metric numerals, section labels (Cinzel), celebration hero |
| **Inter** | `--font-inter` | `next/font/google` `Inter` | Body UI, labels, ledger, TopBar date/time |
| **Libre Baskerville** | `--font-libre-baskerville` | `next/font/google` | Agent names (leaderboard), suggestion text (ticker) |
| **Montserrat** | `--font-montserrat` | `next/font/google` | Available via `font-montserrat` |
| **Edu AU VIC WA NT Hand Arrows** | `--font-edu` | `@import` in `globals.css` | Renewals counter, leaderboard numerals (`font-edu`) |

### 4.2 Type scale in use (effective sizes)

Root scales with viewport (§1.3). Approximate **effective rem** at **1280px** ≈ 16px base, at **1920px** ≈ 20px base. Below: **relative hierarchy** (not px-perfect).

| Level | Token / pattern | ~1280 context | ~1920 context | Used for |
|-------|-----------------|---------------|---------------|----------|
| Hero metric | `text-8xl` / `text-9xl` + counters | Very large | Largest | Queendom hero numbers, Spoiled |
| Broadcast label | `--text-label-xl` | 30px floor in clamp | Up to 46px | Metric captions |
| Section divider title | `--text-label-lg` + Cinzel | Mid | Large | `SectionDivider` label variant |
| TopBar brand | `clamp(2.1rem,4.65vw,4.425rem)` | Prominent | Hero | "Indulge Global" |
| Onboarding page title | `ONBOARDING_PAGE_TITLE_FONT` / `--text-heading-xl` overlap | Prominent | Hero | Revenue Dashboard |

### 4.3 Typography patterns (copy these exactly)

**Hero counter (Queendom — Today resolved)**

```tsx
<AnimatedCounter
  value={solvedToday}
  className="font-cinzel font-bold text-8xl min-[900px]:text-9xl leading-none tracking-[0.06em] text-emerald-400 emerald-glow-hero tabular-nums"
  delay={delay + 800}
  slideOnChange
/>
```

**Hero label (metric caption)**

```tsx
<p className="font-inter font-semibold text-[var(--text-label-xl)] tracking-[0.35em] uppercase text-emerald-300 mb-[0.2vh]">
  Resolved <br /> (Today)
</p>
```

**Panel section header (`SectionDivider` title variant)**

```tsx
<div
  className="flex-shrink-0 font-cinzel font-bold uppercase leading-none tracking-[0.28em] text-[var(--text-label-lg)] px-2 text-gold-400 ..."
>
  {label}
</div>
```

**Leaderboard column headers**

```tsx
<span className="font-inter text-[clamp(1.5rem,2.5vw,3rem)] tracking-[0.4em] uppercase text-amber-300/95 font-semibold text-center">
  Genies
</span>
```

**Leaderboard agent name**

```tsx
<motion.p className="min-w-0 font-baskerville font-semibold text-[clamp(1.425rem,2.325vw,2.925rem)] tracking-wide text-champagne leading-none text-center truncate px-1">
```

**Rank / initials (AgentIcon)**

```tsx
<span className="font-cinzel text-[0.875rem] sm:text-[1rem] lg:text-[1rem] tracking-widest text-gold-400 select-none">
```

**Metric card value (`StatCard` slot)**

Caller passes `<AnimatedCounter />` or children; label uses:

```tsx
<p className="font-inter font-semibold uppercase leading-snug tracking-[0.25em] text-[var(--text-label-xl)] mb-[0.2vh] ..." />
```

**Metric card label**

See StatCard — accent classes `text-champagne`, `text-status-emerald`, etc.

**Ticker item (city)**

```tsx
<span className="font-cinzel font-semibold text-[clamp(1.7rem,2.8vw,3.3rem)] text-white/95 tracking-wide whitespace-nowrap">
```

**Onboarding page title**

```tsx
<h2
  className="mb-[0.8vh] font-cinzel font-bold uppercase leading-none tracking-[0.28em] text-gold-400 queen-name-glow"
  style={{ fontSize: ONBOARDING_PAGE_TITLE_FONT }}
>
  Revenue Dashboard
</h2>
```

**Onboarding ledger header**

```tsx
<p
  className="font-cinzel flex-shrink-0 px-[clamp(0.5rem,2vmin,1.5rem)] font-bold uppercase leading-none tracking-[0.28em] text-gold-400 queen-name-glow"
  style={{ fontSize: ONBOARDING_LEDGER_TITLE_FONT }}
>
  Conversion Ledger
</p>
```

**ConversionLedger column headers**

```tsx
<div
  className="grid grid-cols-3 gap-x-1 font-inter font-semibold uppercase tracking-[0.2em] text-champagne ..."
  style={{ fontSize: ONBOARDING_LEDGER_HEADER_FONT }}
>
```

**Chart axis (PerformanceLineGraph)**

SVG text uses computed sizes inside component (see file); palette **`VERTICAL_COLORS`** for line labels ("Global", "Shop", etc.).

**Chart legend**

Performance graph renders legend **inside SVG** — colors `#6B8FFF`, `#FFB020`, `#34D399`, `#C084FC` for the four verticals.

**Empty states**

- Recommendation ticker: `font-cinzel text-center text-gold-500/60 text-[clamp(1.4rem,2vw,2.2rem)] tracking-widest uppercase` — "Loading recommendations…"
- Conversion ledger: `font-inter text-gold-500/50` with `ONBOARDING_LEDGER_CELL_FONT` — "Awaiting conversions…"

---

## 5. Color Usage Guide

### 5.1 Surface hierarchy

- **`--bg-obsidian` / `bg-obsidian`:** Root canvas behind everything.
- **`--surface-glass` / `.glass`:** Primary glass panels (translucent dark + gold border).
- **`--surface-card`:** StatCard not default variant — StatCard actually uses **`bg-surface-inset`** for inset tiles; elevated cards use GlassPanel **`variant="card"`**.
- **`--surface-elevated`:** Modals / raised tone (`GlassPanel`).
- **`--surface-inset`:** **`StatCard`** background.

### 5.2 Gold usage rules

- **Primary metallic text:** `text-gold-300`, `text-gold-400`, `queen-name-glow` for royal emphasis.
- **Borders:** `border-gold-500/15`–`/25` for frames; use **`--border-gold-*`** conceptually for custom CSS.
- **Glows:** `--shadow-gold-*` or utility `gold-glow` / `queen-name-glow`.
- **Gradients:** `.renewal-card-text`, `.celebration-shimmer-text` — reserved for **special celebration / renewal** treatment.

### 5.3 Status color usage

- **Emerald:** Resolved today, positive completion, `text-emerald-400`, `.emerald-glow-hero`.
- **Red:** Pending workload `text-red-400`; **overdue** uses `.error-overdue-glow` + `#ff0000`.
- **Amber:** Leaderboard "Genies" column header accent `text-amber-300/95`.
- **Sky:** Shop department theme `text-sky-200`, `sky-name-glow`, sky borders.
- **Champagne:** Neutral high-contrast body on dark `text-champagne`.

### 5.4 Border usage

- **Subtle division:** `border-gold-500/10`, `via-gold-500/25` gradients.
- **Glass outline:** `.glass` = `1px solid rgba(212,175,55,0.18)` (see `globals.css`).
- **Strong separation:** center column `via-gold-500/35`.

### 5.5 What never to do with color

1. No **random Tailwind default palette** for branded surfaces.
2. No **inline hex** for new brand colors — use tokens.
3. Do not **`opacity-*` on gold text** when a semantic token exists — use approved rgba tokens.

---

## 6. Component Library

### 6.1 Canonical UI primitives

#### GlassPanel

**File:** `components/ui/GlassPanel.tsx`  
**Purpose:** Glassmorphism container — single primitive for bordered translucent surfaces.

**Props:**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `variant` | `"glass" \| "card" \| "elevated"` | `"glass"` | Background + border tier |
| `radius` | `"card" \| "panel" \| "none"` | `"card"` | Maps to `--radius-card` / `--radius-panel` |
| `glow` | `boolean` | `false` | Adds `.gold-border-glow` |
| `overlay` | `boolean` | `false` | Top-left `.card-gradient-overlay` |
| `shadow` | `"none" \| "sm" \| "md" \| "lg"` | `"none"` | `shadow-gold-*` |
| `className` | `string` | `""` | |
| `style` | `CSSProperties` | — | |

**Variants:** `glass` = default panel; `card` = denser; `elevated` = cooler lift.

**Usage example:**

```tsx
<GlassPanel variant="card" radius="panel" shadow="md" glow overlay className="p-6">
  {children}
</GlassPanel>
```

**When NOT to use:** Raw `.glass` + manual div duplication for new features—extend **GlassPanel**.

**Rule:** Canonical — **do not duplicate** glass stacking.

---

#### StatCard

**File:** `components/ui/StatCard.tsx`  
**Purpose:** Label + value slot for metric tiles (value is `children`).

**Props:**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `label` | `ReactNode` | required | Upper section |
| `children` | `ReactNode` | required | Typically `AnimatedCounter` |
| `accent` | `StatCardAccent` | `"champagne"` | Label color family |
| `className` | `string` | `""` | |
| `style` | `CSSProperties` | — | |

**Accents:** `champagne` | `emerald` | `red` | `amber` | `sky` | `gold` (`gold` adds `queen-name-glow`).

**Usage example:**

```tsx
<StatCard label={<>Received<br />(This Month)</>} accent="champagne">
  <AnimatedCounter value={n} className="font-cinzel font-bold text-[var(--text-counter-lg)] text-champagne" />
</StatCard>
```

**When NOT to use:** Large hero row in QueendomPanel uses **custom MetricBox**, not StatCard—follow existing pattern for that grid.

---

#### SectionDivider

**File:** `components/ui/SectionDivider.tsx`  
**Purpose:** Horizontal gold rule; optional centered title flanked by `.separator-gold-h`.

**Props:**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `label` | `ReactNode` | — | If omitted → plain rule |
| `accent` | `"gold" \| "champagne" \| "amber"` | `"gold"` | Title color |
| `labelClass` | `string` | `""` | Extra classes on title |
| `labelStyle` | `CSSProperties` | — | |
| `className` | `string` | `""` | Outer wrapper |

**Usage example:**

```tsx
<SectionDivider label="Special Dates" accent="champagne" labelClass="!font-inter !font-semibold text-[clamp(1.5rem,2.2vw,2.6rem)] tracking-[0.42em]" />
```

---

### 6.2 Layout components

#### Dashboard

**File:** `components/Dashboard.tsx`  
**Role:** Root shell: `useDashboardData` + `useCelebrationDetection` → **TopBar**, **DashboardController**, **RecommendationTicker**, **CelebrationOverlay**.  
**Sizing:** `flex flex-col min-h-screen … flex-1` on controller region implied via child `className`.  
**Key props:** none (composition only).  
**Children:** ErrorBoundary-wrapped regions.  
**Do not:** Add fetching here—hooks only.

---

#### DashboardController

**File:** `components/DashboardController.tsx`  
**Role:** `flex-1` region; stacks **two absolute full-screen layers** (concierge split + onboarding).  
**Sizing:** Outer `relative h-full w-full min-h-0 min-w-0 overflow-hidden`; receives `className="min-h-0 min-w-0 flex-1"`.  
**Key props:** `ananyshreeStats`, `anishqaStats`, `renewals*`, `celebrationAgent`, `isInitialLoading`.  
**Children:** `QueendomPanel` ×2 (with center separator), `OnboardingPanel`, skeleton overlays, PAUSE button.  
**Do not:** Unmount screens—opacity/`zIndex` only.

---

#### TopBar

**File:** `components/TopBar.tsx`  
**Role:** Fixed header strip; date (md+), centered branding, clock + Live pill.  
**Sizing:** `height: 18vh`, `minHeight: 96px`, `maxHeight: 165px`; `flex-shrink-0`, `z-10`.  
**Do not:** Scroll content inside.

---

#### QueendomPanel

**File:** `components/QueendomPanel.tsx`  
**Role:** One queendom column: Wingspan → 5 metrics → Renewals → Leaderboard + SpecialDates + Joker strip.  
**Sizing:** `motion.section` `flex-1 flex-col` `min-h-[85svh] md:min-h-0` `overflow-y-auto` (mobile) / controlled overflow.  
**Key props:** `name`, `stats`, `side`, `delay`, `celebrationAgent`, `renewalsData`.

---

#### OnboardingPanel

**File:** `components/onboarding/OnboardingPanel.tsx`  
**Role:** Calls **`useOnboardingPanelData`** → **`OnboardingLayout`**.  
**Sizing:** Full flex child inside controller layer.

---

#### OnboardingLayout

**File:** `components/onboarding/OnboardingLayout.tsx`  
**Role:** 3-column grid (`lg:grid-cols-[1fr_1fr_1.05fr]`): Department columns + center Performance + Ledger.  
**Sizing:** `section` `h-full min-h-0 flex-1 overflow-hidden`; padding via inline clamp.

---

### 6.3 Data components

| Component | File | Data source | Notes |
|-----------|------|-------------|-------|
| AgentLeaderboard | `components/leaderboard/AgentLeaderboard.tsx` | `stats.agents` from panel | Sticky header + `AgentRow` list |
| AgentRow | `components/leaderboard/AgentRow.tsx` | `AgentStats` | Grid `GRID_COLS`, surge + win shimmer |
| AgentIcon | `components/leaderboard/AgentIcon.tsx` | derived | Ring SVG `80` viewBox, stroke `#c9a84c` |
| RenewalsPanel | `components/RenewalsPanel.tsx` | `RenewalsPanelData` prop | |
| JokerMetricsStrip | `components/JokerMetricsStrip.tsx` | `JokerStats` | Compact vs full |
| SpecialDates | `components/SpecialDates.tsx` | `getSpecialDates()` static lib | Lucide icons, inline gradients |
| QueendomWingspanHeader | `components/QueendomWingspanHeader.tsx` | member counts | Metric pills |
| RecommendationTicker | `components/RecommendationTicker.tsx` | `recommendations` prop | CSS `ticker-scroll` 40s |
| CelebrationOverlay | `components/CelebrationOverlay.tsx` | `celebrationAgent` | `z-50`, 3s timeout |
| ConversionLedger | `components/onboarding/ConversionLedger.tsx` | `ledger` prop | rAF scroll |
| DepartmentColumn | `components/onboarding/DepartmentColumn.tsx` | agents + hooks data | Compact cards |
| PerformanceLineGraph | `components/onboarding/PerformanceLineGraph.tsx` | `verticalTrendline` | SVG + Framer |
| LeadStatusHealthBar | `components/onboarding/LeadStatusHealthBar.tsx` | `AgentLeadStatusBreakdown` | Segmented pipeline |

**Unmounted / orphan components (present in repo, not in default tree):** `LeadVelocityChart.tsx`, `AgentVerticalBarChart.tsx` — **not** imported by `OnboardingLayout.tsx` in current code.

---

## 7. Layout Architecture

### 7.1 Full component tree

```
app/page.tsx
└── Dashboard (components/Dashboard.tsx)
    ├── ErrorBoundary [Top Bar]
    │   └── TopBar (components/TopBar.tsx)
    ├── ErrorBoundary [Celebration]
    │   └── CelebrationOverlay (components/CelebrationOverlay.tsx)
    ├── DashboardController (components/DashboardController.tsx)
    │   ├── [PAUSE Button]
    │   ├── motion.div [concierge layer z 10/0]
    │   │   ├── flex row (md+) / col (mobile)
    │   │   │   ├── div [Ananyshree column]
    │   │   │   │   ├── ErrorBoundary [Ananyshree]
    │   │   │   │   │   └── QueendomPanel (name=Ananyshree, side=left)
    │   │   │   │   │       ├── ambient radial
    │   │   │   │   │       ├── QueendomWingspanHeader
    │   │   │   │   │       ├── SectionDivider "Queendom"
    │   │   │   │   │       ├── 5-metric hero (AnimatedCounter, MetricBox, joker-box)
    │   │   │   │   │       ├── RenewalsPanel
    │   │   │   │   │       └── glass card: AgentLeaderboard + SpecialDates + JokerMetricsStrip
    │   │   │   │   └── AnimatePresence → motion.div skeleton → QueendomSkeleton
    │   │   │   ├── center separator column (md+ only, width --size-center-separator)
    │   │   │   └── div [Anishqa column]
    │   │   │       ├── ErrorBoundary [Anishqa]
    │   │   │       │   └── QueendomPanel (name=Anishqa, side=right)
    │   │   │       └── AnimatePresence → skeleton → QueendomSkeleton
    │   │   └── (mobile horizontal rule between panels)
    │   └── motion.div [onboarding layer z 10/0]
    │       ├── ErrorBoundary [Onboarding]
    │       │   └── OnboardingPanel (components/onboarding/OnboardingPanel.tsx)
    │       │       └── OnboardingLayout
    │       │           ├── ambient-glow-center
    │       │           ├── header: SectionDivider ×2 + Revenue Dashboard title
    │       │           └── grid 3 cols
    │       │               ├── DepartmentColumn (concierge / Onboarding)
    │       │               ├── center: Performance block (LeadMonthStats tiles + PerformanceLineGraph) + ConversionLedger
    │       │               └── DepartmentColumn (shop)
    │       └── AnimatePresence → OnboardingSkeleton
    └── div.relative.z-10 [ticker strip]
        └── ErrorBoundary [Recommendation Ticker]
            └── RecommendationTicker
```

### 7.2 Layout model

- **Column shell:** `Dashboard` = vertical **`flex-col`**: TopBar (shrink 0) → **flex-1 min-h-0** controller → ticker (shrink 0).
- **Crossfade:** Concierge and Onboarding **both mounted**; **`opacity` + `zIndex`** swap — **1.5s** `easeInOut`.
- **Ticker:** Bottom dock; **`z-10`** above main content background.

### 7.3 Sizing rules for new components

1. **Never `100vw` / `100vh`** inside arbitrary children — use **`h-full` / `w-full`** in a flex parent with **`min-h-0`**.
2. **`min-h-0`** on flex children that scroll or shrink.
3. **`overflow-hidden`** default for TV panels unless explicitly scrolling internal region.
4. New full panels: **`h-full w-full min-h-0 overflow-hidden`**.

### 7.4 Z-index scale ( ascending )

| z-index | Owner |
|---------|--------|
| `0` | Body noise overlay (`body::before`), ambient decorative layers |
| `1`–`3`, `10` | AgentRow surge / shimmer layers |
| `10` | TopBar, RecommendationTicker wrapper; active screen layer (`zIndex` 10 vs 0) |
| `15` | `.card-win-shimmer` (onboarding card win) |
| `20` | Skeleton overlays inside DashboardController |
| `50` | CelebrationOverlay (`fixed inset-0`) |
| `100` | PAUSE / RESUME button (`z-[100]`) |

**Budget:** New global overlays should stay **between 11–49** or reuse **50** pattern—avoid colliding with **100** (controls).

### 7.5 Responsive behavior

- **Below `lg`:** Onboarding **single column** grid (`grid-cols-1`); concierge stacks vertically with **horizontal gold divider** (`md:hidden` rule).
- **`lg` and up:** Onboarding **3 columns**; concierge **side-by-side** with center separator.
- **Root font:** §1.3 — scales **1280→1920**, capped.
- **No horizontal scroll** on TV target; root overflow hidden on `body`.

---

## 8. Animation & Motion System

### 8.1 Motion token reference

See §2.6. **JS constants:** `lib/motionPresets.ts` exports `EASE_LUXURY`, `crossfadeTransition` (`duration: 1.5`, `ease: "easeInOut"`), `containerVariants`, `itemVariants`, `rowVariants`, `gpuStyle`, `widgetFadeIn`.

### 8.2 Framer Motion patterns

**Panel stagger (QueendomPanel)** — local variants (not motionPresets container):

```tsx
const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.09, delayChildren: 0.08 } },
};
const itemVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.6, ease: [0.4, 0, 0.2, 1] } },
};
```

**Screen crossfade (DashboardController)**

```tsx
const fadeTransition = { duration: 1.5, ease: "easeInOut" as const };
// animate={{ opacity: activeScreen === "concierge" ? 1 : 0, zIndex: activeScreen === "concierge" ? 10 : 0 }}
```

**Leaderboard row (`rowVariants` + custom delay)**

```tsx
<motion.div variants={rowVariants} custom={rowDelay} initial="hidden" animate="visible" exit="exit" style={gpuStyle} />
```

**Celebration overlay**

```tsx
<motion.div variants={backdropVariants} initial="initial" animate="animate" exit="exit" />
<motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 1, opacity: 0, y: -20 }} transition={{ ...luxurySpring, exit: exitTransition }} />
```

### 8.3 Animation rules

1. **`AnimatePresence`** for skeleton exits and celebration; skeleton uses **`exit` opacity** with `duration: 0.7`, ease `[0.4, 0, 0.2, 1]`.
2. **Do not animate layout** for TV-critical paths—prefer **opacity/transform**.
3. **Stagger:** Queendom uses **0.09s** children; leaderboard rows use **`baseDelay + index * 0.07`**.
4. **Easing:** `EASE_LUXURY` or Material **`[0.4, 0, 0.2, 1]`** for short UI.

---

## 9. Data & State Architecture

### 9.1 Hook inventory

| Hook | File | Responsibility | Returns | Used by |
|------|------|----------------|---------|---------|
| `useDashboardData` | `hooks/useDashboardData.ts` | Fetches APIs, Supabase Realtime (clients, jokers, tickets, renewals/members), aggregates ticket rows | `ananyshreeStats`, `anishqaStats`, `recommendations`, renewals, `isInitialLoading` | `Dashboard.tsx` |
| `useCelebrationDetection` | `hooks/useCelebrationDetection.ts` | Detects `tasksCompletedToday` increase | `celebrationAgent`, `clearCelebration` | `Dashboard.tsx` |
| `useOnboardingPanelData` | `hooks/useOnboardingPanelData.ts` | Fetches `/api/onboarding`, polls, subscribes to **`deals`** + **`leads`** tables, shimmer logic | Full `UseOnboardingPanelDataResult` | `OnboardingPanel.tsx` |
| `usePrefersReducedMotion` | `hooks/usePrefersReducedMotion.ts` | Wraps `prefers-reduced-motion` | `boolean` | Onboarding, charts, ledger |

### 9.2 Realtime subscription pattern

- **`useDashboardData`:** One `useEffect`, **`supabase.channel(...).on("postgres_changes", ...)`**, cleanup **`removeChannel`** for **four** channels: `dashboard-clients`, `dashboard-jokers`, `dashboard-tickets`, `dashboard-renewals`.
- **`useOnboardingPanelData`:** Separate effects for **`deals-live`** (`deals` table) and **`leads-touches-live`** (`leads` table); debounced refetch; reconnect counters in deps.

**Pattern for new subscriptions:**

```tsx
useEffect(() => {
  if (!supabase) return;
  const ch = supabase.channel("unique-name").on(
    "postgres_changes",
    { event: "*", schema: "public", table: "your_table" },
    (payload) => { /* patch state or debounced fetch */ },
  ).subscribe();
  return () => { supabase.removeChannel(ch); };
}, [deps]);
```

### 9.3 Data flow diagram

```
GET /api/*  ─┐
             ├──► useDashboardData state ──► DashboardController ──► QueendomPanel / children
Supabase RT ─┘

GET /api/onboarding ─┐
Supabase deals/leads ─► useOnboardingPanelData ──► OnboardingLayout ──► columns + charts + ledger
```

### 9.4 State rules

- **No data fetching in presentational layouts** (`OnboardingLayout` is props-only).
- **Shimmer:** `shimmerStampByAgentId` managed in **`useOnboardingPanelData`**, not layout.
- **Derived stats:** Computed with **`useMemo`** inside hooks / panels where appropriate.

---

## 10. API & Database Reference

### 10.1 Database schema (as referenced in frontend)

| Table | Columns / usage in UI code | Notes |
|-------|------------------------------|-------|
| `clients` | subscription fields via `/api/clients` | Realtime refetch |
| `jokers` | Aggregated joker stats + recommendations | Realtime |
| `tickets` | Minimal rows via `/api/tickets/rows` + Realtime patches | `TicketRowMinimal` |
| `renewals` | INSERT → refetch renewals panel | |
| `members` | INSERT → refetch renewals panel | |
| `deals` | Onboarding ledger live inserts | Mapped in `ledgerRowFromInsertPayload` |
| `leads` | Lead touches / pulse | Department derivation |

> ⚠ **Assumed:** Production Supabase schema matches API routes in `app/api/**`; authoritative column lists live in migrations + `CLAUDE.md` project rule.

### 10.2 Supabase query patterns

Browser uses **`supabase` anon client** from `lib/supabase.ts` **only for Realtime**. Data reads use **Next.js routes + service role on server** — do not query sensitive tables from client except via Realtime events.

### 10.3 Type definitions (verbatim critical interfaces)

**`lib/types.ts`**

```ts
export interface MemberStats {
  total: number;
  celebrityActive: number;
}

export interface TicketStats {
  totalReceived: number;
  totalThisMonth?: number;
  resolvedThisMonth: number;
  solvedToday: number;
  pendingToResolve: number;
  jokerSuggestion: number;
}

export interface JokerStats {
  uniqueSuggestionsCount: number;
  totalSent: number;
  totalSuggestions: number;
  acceptedCount: number;
  rejectedCount: number;
  pendingSuggestions: number;
  acceptedToday: number;
  totalThisMonth: number;
}

export interface AgentStats {
  id: string;
  name: string;
  queendom: "ananyshree" | "anishqa";
  tasksAssignedToday: number;
  tasksCompletedToday: number;
  tasksCompletedThisMonth: number;
  tasksAssignedThisMonth: number;
  pendingScore: number;
  overdueCount: number;
  incomplete: number;
}

export interface QueenStats {
  members: MemberStats;
  tickets: TicketStats;
  agents: AgentStats[];
  joker?: JokerStats;
}

export interface JokerRecommendation {
  id: string;
  category: string;
  text: string;
  place: string;
  icon: "restaurant" | "travel" | "hotel" | "spa" | "experience";
}

export interface SpecialDate {
  id: string;
  clientName: string;
  date: string;
  type: "birthday" | "anniversary";
  queendom: "ananyshree" | "anishqa";
}
```

**`types/index.ts` (shared UI)**

```ts
export interface JokerRecommendationItem {
  id: string;
  city: string;
  type: string;
  suggestion: string;
}

export type QueendomId = "ananyshree" | "anishqa";
export type ActiveScreen = "concierge" | "onboarding";

export interface RenewalsPanelData {
  totalRenewalsThisMonth: number;
  renewals: string[];
  assignments: string[];
}

export interface MemberApiResponse {
  ananyshree: MemberStats;
  anishqa: MemberStats;
}

export interface DisplayOutlay {
  id: string;
  client_name: string;
  task: string;
  amount: number;
  pending: boolean;
}
```

**`lib/ticketAggregation.ts`**

```ts
export interface TicketRowMinimal {
  id: string;
  status: string | null;
  queendom_name: string | null;
  agent_name: string | null;
  created_at: string | null;
  is_escalated: boolean | null;
  is_incomplete?: boolean | null;
  tags?: Record<string, unknown> | null;
}
```

**Onboarding types:** Full definitions in `lib/onboardingTypes.ts` — copy file when extending (`Department`, `OnboardingAgentRow`, `OnboardingLedgerRow`, `VerticalTrendPoint`, `LeadMonthStats`, `OnboardingApiPayload`, etc.).

---

## 11. Naming Conventions

### 11.1 File naming

- Components: **`PascalCase.tsx`**
- Hooks: **`use*.ts`** in `hooks/`
- Utilities: **`camelCase.ts`** in `lib/` or `components/**/utils.ts`
- CSS: **kebab-case** classes; **`--kebab-case`** variables

### 11.2 CSS variable naming

Pattern: **`--{category}-{subcategory}-{modifier}`** (e.g. `--text-label-xl`, `--shadow-gold-md`).

### 11.3 Component props

- **`className`** optional last for primitives.
- **`children`** typed `React.ReactNode`.
- Presentational layouts accept **`style`** only when matching existing patterns.

### 11.4 Tailwind class ordering

**De facto:** layout (`flex`, `grid`, `relative`) → sizing (`w-full`, `min-h-0`) → spacing (`p-*`, `gap-*`) → typography → color → border → effects → motion. Not enforced by linter—follow nearby files.

---

## 12. Rules for Writing New Code

### 12.1 Before writing any new component

1. Read **this file**.
2. Locate parent in **§7.1**.
3. List **tokens** from **§2** for all colors/spacing/type.
4. Check **§6.1** primitives — **GlassPanel**, **StatCard**, **SectionDivider**.
5. Apply **§11** naming.

### 12.2 Color rules

- Only **§2.1** / Tailwind mappings — **no random palette**.

### 12.3 Typography rules

- Use **tokens** or onboarding **`utils.ts`** constants.
- Avoid new **`text-xs`** / **`text-sm`** for primary TV UI unless ≥ effective **14px**.

### 12.4 Layout rules

- **§7.3** — full-height discipline.

### 12.5 Animation rules

- **`AnimatePresence`** when exit animations matter.
- Align durations with **`motionPresets`** / §2.6.
- **Opacity/transform** first.

### 12.6 When in doubt

**Stop.** Ask the maintainer or update **this document** before introducing a new visual language.

---

## 13. Changelog

| Date | Change | Author |
|------|--------|--------|
| 2026-05-02 | Initial `design.md` generated from full codebase scan | Cursor |
