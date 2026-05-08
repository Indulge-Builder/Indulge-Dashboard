# Indulge Dashboard — Frontend Design Reference

> **Single source of truth for all UI decisions.** Every token, rule, component contract, animation preset, and layout invariant lives here. If a visual or behavioral choice is not documented here (or exactly derivable from a cited token/rule), **stop and ask** before inventing it. Consistency on a 24/7 TV wall matters more than convenience.

---

## Table of Contents

1. [Design Language & Philosophy](#1-design-language--philosophy)
2. [Design Tokens — CSS Variables](#2-design-tokens--css-variables)
3. [Tailwind Configuration](#3-tailwind-configuration)
4. [Typography System](#4-typography-system)
5. [Utility Classes Catalog](#5-utility-classes-catalog)
6. [Component Library](#6-component-library)
7. [Layout Architecture](#7-layout-architecture)
8. [Animation & Motion System](#8-animation--motion-system)
9. [CSS Keyframes Catalog](#9-css-keyframes-catalog)
10. [Framer Motion Presets](#10-framer-motion-presets)
11. [TV-Specific Engineering Rules](#11-tv-specific-engineering-rules)
12. [Rules for Writing New UI](#12-rules-for-writing-new-ui)

---

## 1. Design Language & Philosophy

### 1.1 Aesthetic Identity: Quiet Luxury / Cinematic HUD

The Indulge dashboard is not a "dark mode app." It is a **luxury broadcast instrument** — the visual language of a private bank vault crossed with a cinematic command center. Every design decision flows from this identity:

- **Black, not dark grey.** The canvas is near-absolute obsidian (`#050507`). Panels float above it as barely-there glass.
- **Gold, not yellow.** The accent is antique metallic gold (`#d4af37`) — warm, aged, never garish. It appears in borders, glows, counters, and celebration. Never as a fill on large surfaces.
- **Silence before spectacle.** The default state is calm and uncluttered. Motion fires only when data changes — celebration is earned, not ambient.
- **TV readability over pixel-perfect density.** All type has a floor of ~14px effective size. Labels breathe with `letter-spacing: 0.35em+`. Numbers are set in Cinzel or Edu Hand with tabular figures.
- **Texture, not gradients.** A 3% SVG fractal noise overlay (`body::before`) gives depth without gradient bands.

### 1.2 The Four Laws of Indulge UI

These are non-negotiable constraints. Violating any of them produces a dashboard that looks broken on the TV wall.

**Law 1 — Animate only opacity and transform.**
Never animate `box-shadow`, `background-color`, `color`, `border`, `width`, `height`, or any layout property in a `requestAnimationFrame`/Framer Motion loop. These force paint every frame on the GPU, causing visible jank at 4K. Glow and color changes are applied via CSS class toggling or instantaneous state — never tweened.

**Law 2 — Gold is a signal, not wallpaper.**
Gold appears on: borders (`rgba(212,175,55,0.08–0.55)`), text glows (`.queen-name-glow`), counters, section dividers, celebration effects, and the ticker. Gold must NOT fill large cards, backgrounds, or hero areas as a solid or gradient fill. When in doubt, use champagne (`#f5e6c8`) for text and let gold be the frame.

**Law 3 — Type lives on the `clamp()` scale.**
Never use a fixed `px` font size for primary UI copy. Every font size is either a CSS variable (`--text-*`), a `clamp()` expression, or a Tailwind extended class (`text-8xl` etc., which are also `rem`-based). The root `html` font-size scales 1280→1920px, so `rem` values already adapt — clamps add the floor/ceiling needed for 4K screens.

**Law 4 — Both screens are always mounted.**
The concierge and onboarding views are never unmounted during auto-rotation. Only `opacity` and `zIndex` change. Do not add `AnimatePresence` unmounts to the top-level screen layers — it causes layout reflow and a visible flash as the component tree rebuilds.

### 1.3 Environment

- **Primary target:** 75"+ 4K display, fullscreen Chromium, no cursor.
- **Secondary:** MacBook 16" for development.
- **Root font:** `html` scales from ~16px (1280px wide) to ~20px (1920px wide), capped. See §2.3.
- **No scroll on TV:** `html, body { overflow: hidden }`. All panels must fit within viewport.
- **Interaction:** PAUSE/RESUME key (`Space`, `P`, `Enter`, `NumpadEnter`, `MediaPlayPause`), `ArrowLeft`/`ArrowRight` screen switch — implemented in `hooks/useKeyboardControls.ts` (window capture phase). No hover states are relied upon for readability.
- **Theme color:** `#050507` (viewport `themeColor` in `app/layout.tsx`).

### 1.4 The Noise Overlay

`body::before` applies a fixed SVG fractal noise texture at `opacity: 0.03`. It is always present. It is `pointer-events: none` and `z-index: 0`. It gives the black canvas a tactile film-grain quality. Never remove it. Never increase its opacity above 0.04 — it becomes visible lint instead of texture.

```css
body::before {
  content: "";
  position: fixed;
  inset: 0;
  background-image: url("data:image/svg+xml,..."); /* fractalNoise baseFrequency=0.9 */
  opacity: 0.03;
  pointer-events: none;
  z-index: 0;
}
```

---

## 2. Design Tokens — CSS Variables

**Authoritative source:** `app/globals.css` `:root { ... }`. All tokens below are verbatim from that file.

### 2.1 Surfaces

| Token | CSS Variable | Exact Value | When to Use |
|-------|-------------|-------------|-------------|
| Page canvas | `--bg-obsidian` | `#050507` | Canonical background token — use in new code |
| Body background | `--obsidian` | `#050505` | Legacy alias on `body` — do not use in new components |
| Glass panel | `--surface-glass` | `rgba(10, 10, 10, 0.85)` | Translucent panels (`.glass`) |
| Card | `--surface-card` | `rgba(10, 10, 10, 0.92)` | Opaque cards |
| Elevated | `--surface-elevated` | `rgba(15, 15, 20, 0.85)` | Lifted / modal tone |
| Inset | `--surface-inset` | `rgba(0, 0, 0, 0.5)` | Inset wells (StatCard background) |
| Joker gradient | `--surface-joker` | `linear-gradient(135deg, rgba(212,175,55,0.06) 0%, rgba(249,226,126,0.03) 100%)` | `.joker-box` background |

### 2.2 Gold Spectrum

| Token | CSS Variable | Exact Value | When to Use |
|-------|-------------|-------------|-------------|
| Primary gold | `--gold-primary` | `#d4af37` | Matches Tailwind `gold-400`; brand gold reference |
| Bright gold | `--gold-bright` | `#f9e27e` | Highlights, ticker text, celebration shimmer |
| Accent / stroke | `--gold-accent` | `#c9a84c` | SVG strokes (AgentIcon ring), inline rgba uses |
| Liquid start (legacy) | `--liquid-gold-start` | `#d4af37` | Alias — do not use in new code |
| Liquid end (legacy) | `--liquid-gold-end` | `#f9e27e` | Alias — do not use in new code |
| Border legacy | `--gold-border` | `rgba(212, 175, 55, 0.2)` | Legacy — use `--border-gold-*` family instead |

### 2.3 Border Opacities

| Token | CSS Variable | Exact Value | When to Use |
|-------|-------------|-------------|-------------|
| Dim | `--border-gold-dim` | `rgba(212, 175, 55, 0.08)` | Subtle separators, almost invisible |
| Subtle | `--border-gold-subtle` | `rgba(212, 175, 55, 0.15)` | Light frames |
| Mid | `--border-gold-mid` | `rgba(212, 175, 55, 0.25)` | StatCard / visible rules |
| Bright | `--border-gold-bright` | `rgba(212, 175, 55, 0.55)` | Strong outlines, active states |
| Neutral subtle | `--border-subtle` | `rgba(255, 255, 255, 0.06)` | Non-gold UI lines |

### 2.4 Gold Glow Shadows

| Token | CSS Variable | Exact Value | When to Use |
|-------|-------------|-------------|-------------|
| Small | `--shadow-gold-sm` | `0 0 12px rgba(212, 175, 55, 0.35)` | Icons, tight glow |
| Medium | `--shadow-gold-md` | `0 0 28px rgba(212, 175, 55, 0.22)` | Panel ambient glow |
| Large | `--shadow-gold-lg` | `0 0 48px rgba(212, 175, 55, 0.16)` | Wide hero emphasis |

These map to Tailwind: `shadow-gold-sm`, `shadow-gold-md`, `shadow-gold-lg`.

### 2.5 Status / Accent Colors

| Token | CSS Variable | Exact Value | When to Use |
|-------|-------------|-------------|-------------|
| Emerald | `--color-emerald` | `#34d399` | Resolved today, positive movement, success |
| Emerald dim | `--color-emerald-dim` | `rgba(52, 211, 153, 0.2)` | Emerald backgrounds |
| Emerald glow | `--color-emerald-glow` | `rgba(52, 211, 153, 0.28)` | Emerald glow effects |
| Red | `--color-red` | `#f87171` | Pending emphasis (soft) |
| Red overdue | `--color-red-overdue` | `#ff0000` | Escalation / overdue — full neon red |
| Amber | `--color-amber` | `#fcd34d` | Warnings, leaderboard "Genies" header |
| Sky | `--color-sky` | `#7dd3fc` | Shop department theme, info |
| Champagne | `--color-champagne` | `#f5e6c8` | Primary body text, labels on dark |

**Note:** Tailwind `champagne` color is `#F7E7CE` (slightly warmer). Both are in production. `--color-champagne` is the canonical token.

### 2.6 Typography Tokens

All defined on `:root`. These are fluid clamps — the floor/ceiling values are the constraints; the middle value drives the fluid growth.

**Counter / Hero Numerals**

| Token | CSS Variable | Value |
|-------|-------------|-------|
| Counter hero | `--text-counter-hero` | `clamp(4.5rem, 9vw, 9rem)` |
| Counter XL | `--text-counter-xl` | `clamp(2.3rem, 3.7vw, 4.7rem)` |
| Counter LG | `--text-counter-lg` | `clamp(2rem, 3.1vw, 4.1rem)` |
| Counter MD | `--text-counter-md` | `clamp(1.65rem, 2.175vw, 2.7rem)` |

**Headings / Names**

| Token | CSS Variable | Value |
|-------|-------------|-------|
| Heading XL | `--text-heading-xl` | `clamp(2rem, min(4.6vmin, 5.9vh), 4.4rem)` |
| Heading LG | `--text-heading-lg` | `clamp(1.65rem, min(3.85vmin, 4.9vh), 3.85rem)` |
| Heading MD | `--text-heading-md` | `clamp(1.5rem, min(3.85vmin, 4.4vh), 3.25rem)` |

**Labels — Broadcast Metric Captions**

| Token | CSS Variable | Value |
|-------|-------------|-------|
| Label XL | `--text-label-xl` | `clamp(30px, 3vw, 46px)` |
| Label LG | `--text-label-lg` | `clamp(1.5rem, 2.5vw, 3rem)` |
| Label MD | `--text-label-md` | `clamp(1.2rem, 1.9vw, 2.2rem)` |

**Onboarding Scale** (Revenue Dashboard)

| Token | CSS Variable | Value |
|-------|-------------|-------|
| OB page title | `--text-ob-page-title` | `clamp(2.2rem, min(5vmin, 6.2vh), 4.6rem)` |
| OB ledger title | `--text-ob-ledger-title` | `clamp(1.8rem, min(4.2vmin, 5.1vh), 4rem)` |
| OB agent name | `--text-ob-agent-name` | `clamp(1.6rem, min(4vmin, 4.6vh), 5.5rem)` |
| OB card title | `--text-ob-card-title` | `clamp(1.35rem, min(3.2vmin, 3.6vh), 3.85rem)` |
| OB metric value | `--text-ob-metric-value` | `clamp(1.6rem, min(4.6vmin, 5.4vh), 6rem)` |
| OB metric sub | `--text-ob-metric-sub` | `clamp(1.35rem, min(3.6vmin, 4.1vh), 2.55rem)` |
| OB ledger header | `--text-ob-ledger-hdr` | `clamp(1.25rem, min(2.85vmin, 3.3vh), 2.4rem)` |
| OB ledger cell | `--text-ob-ledger-cell` | `clamp(1.3rem, min(2.8vmin, 3.4vh), 3.6rem)` |

**Finance Widget**

| Token | CSS Variable | Value |
|-------|-------------|-------|
| Finance cell | `--text-fin-cell` | `clamp(1.725rem, min(3.975vmin, 4.875vh), 5.25rem)` |

### 2.7 Spacing Tokens

| Token | CSS Variable | Value | Usage |
|-------|-------------|-------|-------|
| Panel padding | `--pad-panel` | `clamp(12px, 3vw, 40px)` | Section outer padding |
| Card padding | `--pad-card` | `clamp(10px, 2vw, 28px)` | Inner card padding |
| Cell padding | `--pad-cell` | `clamp(6px, 0.8vw, 14px)` | Dense table cells |
| Card gap | `--gap-card` | `clamp(0.65rem, min(1.4vmin, 1.8vh), 2rem)` | Vertical spacing between cards |
| Ticker item X | `--pad-ticker-item-x` | `5rem` | Per-item horizontal padding in ticker |
| Celebration avatar | `--size-celebration-avatar` | `clamp(140px, 18vmin, 300px)` | Celebration overlay avatar size |
| Center separator | `--size-center-separator` | `clamp(24px, 2vw, 52px)` | Width of column between queendoms |

### 2.8 Border Radius Tokens

| Token | CSS Variable | Value | Usage |
|-------|-------------|-------|-------|
| Card | `--radius-card` | `1rem` (16px) | Cards, StatCard, skeleton blocks |
| Panel | `--radius-panel` | `1.5rem` (24px) | Large section panels |
| Pill | `--radius-pill` | `9999px` | PAUSE button, pill badges |

Tailwind aliases: `rounded-card` → `var(--radius-card)`, `rounded-panel` → `var(--radius-panel)`.

### 2.9 Motion Timing Tokens

| Token | CSS Variable | Value | Controls |
|-------|-------------|-------|---------|
| Crossfade | `--duration-crossfade` | `1.5s` | Screen transition opacity |
| Counter | `--duration-counter` | `0.7s` | Counter-like animations |
| Row | `--duration-row` | `0.55s` | Row/metric timing |
| Luxury ease | `--ease-luxury` | `cubic-bezier(0.25, 0.46, 0.45, 0.94)` | Default deceleration curve |

### 2.10 Root Font Scale

```css
html {
  font-size: clamp(
    calc(100% + (1024px - 1280px) * 4 / 640),   /* ~93.75% at ≤1024px */
    calc(100% + (100vw - 1280px) * 4 / 640),    /* fluid between 1024–1920px */
    calc(100% + (1920px - 1280px) * 4 / 640)    /* ~125% at ≥1920px */
  );
}
```

Practical effect: `1rem` ≈ 16px at 1280px width, ≈ 20px at 1920px. All `rem`-based tokens grow proportionally. Component-level `clamp()` adds floor/ceiling for 4K safety.

---

## 3. Tailwind Configuration

**File:** `tailwind.config.ts`

### 3.1 Extended Colors

**Brand palette (static hex)**

| Class | Hex |
|-------|-----|
| `bg-obsidian` / `text-obsidian` | `#050505` |
| `text-champagne` / `bg-champagne` | `#F7E7CE` |
| `text-rosegold` | `#C47451` |
| `gold-50` through `gold-900` | See scale below |
| `liquid-gold-start` | `#D4AF37` |
| `liquid-gold-end` | `#F9E27E` |

**Gold scale**

| Step | Hex |
|------|-----|
| 50 | `#FDF9EF` |
| 100 | `#FAF0D7` |
| 200 | `#F5E0A9` |
| 300 | `#ECC96A` |
| 400 | `#D4AF37` ← primary |
| 500 | `#AA7C11` |
| 600 | `#B08B30` |
| 700 | `#8B6914` |
| 800 | `#6B4F0F` |
| 900 | `#4A3509` |

**CSS variable-backed tokens**

| Tailwind class | Maps to |
|---------------|---------|
| `bg-surface-card` | `var(--surface-card)` |
| `bg-surface-glass` | `var(--surface-glass)` |
| `bg-surface-elevated` | `var(--surface-elevated)` |
| `bg-surface-inset` | `var(--surface-inset)` |
| `text-status-emerald` | `var(--color-emerald)` |
| `text-status-red` | `var(--color-red)` |
| `text-status-amber` | `var(--color-amber)` |
| `text-status-sky` | `var(--color-sky)` |

### 3.2 Extended Font Families

| Class | Variables / Fallbacks |
|-------|-----------------------|
| `font-cinzel` | `var(--font-cinzel)`, `Cinzel`, `serif` |
| `font-inter` | `var(--font-inter)`, `sans-serif` |
| `font-edu` | `var(--font-edu)`, `Oswald`, `sans-serif` |
| `font-baskerville` | `var(--font-libre-baskerville)`, `serif` |
| `font-montserrat` | `var(--font-montserrat)`, `Montserrat`, `sans-serif` |

### 3.3 Extended Font Sizes

| Class | Size |
|-------|------|
| `text-7xl` | `4.5rem` |
| `text-8xl` | `6rem` |
| `text-9xl` | `8rem` |

### 3.4 Extended Box Shadows

| Class | Value |
|-------|-------|
| `shadow-gold-sm` | `var(--shadow-gold-sm)` |
| `shadow-gold-md` | `var(--shadow-gold-md)` |
| `shadow-gold-lg` | `var(--shadow-gold-lg)` |

### 3.5 Extended Border Radii

| Class | Value |
|-------|-------|
| `rounded-card` | `var(--radius-card)` |
| `rounded-panel` | `var(--radius-panel)` |

### 3.6 Extended Keyframes & Animations

| Animation class | Keyframe | Duration / Curve |
|----------------|----------|-----------------|
| `animate-pulse-ring` | Scale 1→2.5 + opacity 0.8→0 | `1.8s cubic-bezier(0.4,0,0.6,1) infinite` |
| `animate-aura-pulse` | Box-shadow breathe (gold) | `2.5s ease-in-out infinite` |
| `animate-halo-breathe` | Opacity 0.35↔0.75 + scale 1↔1.06 | `2.4s ease-in-out infinite` |
| `animate-text-shimmer` | `background-position` sweep | `3s linear infinite` |
| `animate-escalation-breathe` | Text-shadow red pulse | `2s ease-in-out infinite` |
| `animate-gold-pulse` | Box-shadow gold breathe | `2s ease-in-out infinite` |

> ⚠ `aura-pulse` and `gold-pulse` animate `box-shadow` — these are **`@keyframes`-driven and class-toggled**, not Framer Motion tweens. This keeps them off the JS animation thread. Do not replicate as Framer Motion style animations.

---

## 4. Typography System

### 4.1 Font Families & Their Roles

| Family | Loaded Via | Role |
|--------|-----------|------|
| **Cinzel** | `next/font/google` + Google Fonts `@import` | Section headings, queendom names, metric labels, page titles, agent rank initials, celebration text |
| **Inter** | `next/font/google` | Body copy, UI labels, ledger text, date/time, TopBar secondary text |
| **Libre Baskerville** | `next/font/google` | Agent names in leaderboard, joker suggestion body text |
| **Montserrat** | `next/font/google` | Available via `font-montserrat`; use for department secondary labels |
| **Edu AU VIC WA NT Hand Arrows** | Google Fonts CSS `@import` | Renewal counter, leaderboard stat numerals (the handwritten numeral aesthetic) |

### 4.2 Type Scale Hierarchy

At 1280px (16px root) → 1920px (20px root):

| Level | Token / Pattern | At 1280px | At 1920px | Used For |
|-------|----------------|-----------|-----------|---------|
| Hero numeral | `text-9xl` | 128px | 160px | Celebration count |
| Hero metric | `text-8xl` + Cinzel | 96px | 120px | Resolved Today counter |
| Counter hero | `--text-counter-hero` | 72px | 180px | Giant stats |
| Queendom name | `--text-heading-xl` | 32px | 88px | Panel header names |
| Section title | `--text-label-lg` | 24px | 60px | SectionDivider labels |
| Metric caption | `--text-label-xl` | 30px | 46px | Hero metric labels |
| Leaderboard col header | `clamp(1.5rem,2.5vw,3rem)` | 24px | 60px | "Genies", "Today", etc. |
| Leaderboard agent name | `clamp(1.425rem,2.325vw,2.925rem)` | 22.8px | 58.5px | Agent names |
| Body / ledger | `--text-ob-ledger-cell` | 20.8px | 72px | Ledger rows |

### 4.3 Typography Patterns — Copy These Exactly

**Hero resolved-today counter (QueendomPanel)**
```tsx
<AnimatedCounter
  value={solvedToday}
  className="font-cinzel font-bold text-8xl min-[900px]:text-9xl leading-none tracking-[0.06em] text-emerald-400 emerald-glow-hero tabular-nums"
  delay={delay + 800}
  slideOnChange
/>
```

**Hero metric label**
```tsx
<p className="font-inter font-semibold text-[var(--text-label-xl)] tracking-[0.35em] uppercase text-emerald-300 mb-[0.2vh]">
  Resolved <br /> (Today)
</p>
```

**Queendom name / section header (Cinzel)**
```tsx
<div className="font-cinzel font-bold uppercase leading-none tracking-[0.28em] text-[var(--text-label-lg)] text-gold-400 queen-name-glow">
  {label}
</div>
```

**Leaderboard column header**
```tsx
<span className="font-inter text-[clamp(1.5rem,2.5vw,3rem)] tracking-[0.4em] uppercase text-amber-300/95 font-semibold text-center">
  Genies
</span>
```

**Leaderboard agent name**
```tsx
<motion.p className="min-w-0 font-baskerville font-semibold text-[clamp(1.425rem,2.325vw,2.925rem)] tracking-wide text-champagne leading-none text-center truncate px-1">
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

**Onboarding ledger title**
```tsx
<p
  className="font-cinzel px-[clamp(0.5rem,2vmin,1.5rem)] font-bold uppercase leading-none tracking-[0.28em] text-gold-400 queen-name-glow"
  style={{ fontSize: ONBOARDING_LEDGER_TITLE_FONT }}
>
  Conversion Ledger
</p>
```

**Ticker item text**
```tsx
<span className="font-cinzel font-semibold text-[clamp(1.7rem,2.8vw,3.3rem)] text-white/95 tracking-wide whitespace-nowrap">
```

**Empty states**
```tsx
// Ticker
className="font-cinzel text-center text-gold-500/60 text-[clamp(1.4rem,2vw,2.2rem)] tracking-widest uppercase"

// Conversion ledger
className="font-inter text-gold-500/50"  // + ONBOARDING_LEDGER_CELL_FONT size
```

### 4.4 Typography Rules

1. **TV floor:** Minimum effective size for any readable copy is ~14px. When setting small text, verify at 1280px that the computed size is ≥14px.
2. **No magic px on new code.** Use `--text-*` tokens or `clamp()`.
3. **`tabular-nums`:** Always apply `tabular-nums` (or `font-variant-numeric: tabular-nums`) to changing numbers. Use the `.tabular-nums` utility class.
4. **Tracking:** Labels use `tracking-[0.35em]`–`tracking-[0.4em]`. Headings use `tracking-[0.28em]`. Body text uses standard Tailwind `tracking-wide` or `tracking-widest`.
5. **Line height:** Hero counters use `leading-none`. Labels and body use `leading-snug`.

---

## 5. Utility Classes Catalog

All defined in `app/globals.css` `@layer utilities`.

### 5.1 Glass Surfaces

| Class | Definition |
|-------|-----------|
| `.glass` | `background: rgba(10,10,10,0.85); border: 1px solid rgba(212,175,55,0.18)` |
| `.glass-pill` | `background: rgba(10,10,10,0.88); border: 1px solid rgba(212,175,55,0.18)` |
| `.gold-border-glow` | `box-shadow: 0 0 0 1px rgba(212,175,55,0.08) inset` |

### 5.2 Text Glows

| Class | Effect | Use When |
|-------|--------|---------|
| `.queen-name-glow` | Multi-layer gold text shadow (20px → 100px, rgba decreasing) | Queendom names, section titles, all gold Cinzel headings |
| `.sky-name-glow` | Same as queen-name-glow but in sky blue (`rgba(125,211,252,*)`) | Shop department headings |
| `.gold-glow` | 3-layer gold text shadow (lighter than queen-name-glow) | Ticker labels, secondary gold text |
| `.emerald-glow-hero` | 2-layer emerald text shadow (16px, 36px) | Resolved-today hero counter |
| `.monthly-error-glow` | Red text shadow `rgba(220,38,38,0.5)` 8px | Soft pending error emphasis |
| `.error-overdue-glow` | `color: #ff0000` + hard red glow (6px, 12px) | Overdue count when `is_escalated > 0` |

### 5.3 Ambient Radial Glows

Place on a `position: absolute; inset: 0; pointer-events: none` div inside panel containers.

| Class | Radial Origin | Use In |
|-------|-------------|--------|
| `.ambient-glow-center` | 50% 42% | Dashboard root wrapper |
| `.ambient-glow-left` | 25% 45% | Ananyshree queendom panel |
| `.ambient-glow-right` | 75% 45% | Anishqa queendom panel |
| `.ambient-glow-stage` | 50% 38% | Onboarding panel center |
| `.ambient-glow-column` | 50% 50% (160% wide ellipse) | Center separator column |

All use `rgba(201, 168, 76, 0.032–0.065)` — barely visible gold warmth.

### 5.4 Separators

| Class | Definition |
|-------|-----------|
| `.separator-gold-h` | `height: 1px; background: linear-gradient(to right, transparent, rgba(212,175,55,0.25), transparent)` |
| `.separator-gold-v` | `width: 1px; background: linear-gradient(to bottom, transparent, rgba(212,175,55,0.35), transparent)` |
| `.vertical-separator` | `width: 1px; height: 80%; background: gradient to bottom (0.2 opacity)` — RenewalsPanel dividers |

### 5.5 Skeleton Loading

| Class | Definition |
|-------|-----------|
| `.skeleton-block` | Animated 400% wide gold-foil shimmer background; uses `--surface-card`, `--surface-elevated`, gold peak; `border-radius: var(--radius-card)`; `animation: foil-shimmer 2.4s ease-in-out infinite` |

### 5.6 Celebration

| Class | Purpose |
|-------|---------|
| `.celebration-backdrop` | `background: rgba(5,5,5,0.94)` — CelebrationOverlay backdrop |
| `.celebration-avatar-glow` | Multi-ring gold box-shadow (4 layers, 1px → 180px spread) |
| `.celebration-name-glow` | Champagne text shadow + strong drop shadow |
| `.celebration-shimmer-text` | Gold gradient text (`#d4af37` → `#f9e27e` → `#fdf9ef` → back) with `text-shimmer` animation |
| `.celebration-container` | `perspective: 1000px; transform-style: preserve-3d` — GPU layer for overlay |
| `.celebration-name-flash` | One-shot diagonal gold sweep (50% wide, `gold-sweep` keyframe, 1.2s) |

### 5.7 Animation Classes

| Class | Effect | Keyframe |
|-------|--------|---------|
| `.row-win-shimmer` | Background-position sweep on row | `row-shimmer 1.2s ease-out forwards` |
| `.ticker-paused` | `animation-play-state: paused !important` | Applied to ticker track on pause |
| `.card-win-shimmer` | Diagonal foil sweep over onboarding agent card, `z-index: 15`, runs once | `foil-shimmer 2s cubic-bezier(0.4,0,0.2,1) 1` |
| `.ob-metric-flash` | Color pulse from gold → white | `ob-metric-pulse 0.55s ease-out forwards` |
| `.hot-lead-card-pulse` | Opacity breathe 0.25↔1 on glow overlay | `hot-pulse 2.2s ease-in-out infinite; will-change: opacity` |

### 5.8 Other

| Class | Definition |
|-------|-----------|
| `.tabular-nums` | `font-variant-numeric: tabular-nums` |
| `.ticker-container` | `display: flex; white-space: nowrap; width: max-content; align-items: center` |
| `.ticker-item` | `display: inline-flex; padding: 0 var(--pad-ticker-item-x); color: #f9e27e` |
| `.renewal-card-text` | Gold gradient text (bottom-down), `font-weight: 800`, uppercase — renewal client names |
| `.drop-shadow-gold` | Filter drop-shadow 3-layer gold (12px → 40px) — renewal counter |
| `.card-gradient-overlay` | Top-left gold highlight `linear-gradient(to bottom right, rgba(212,175,55,0.04), transparent)` |
| `.joker-box` | `border: 1px solid rgba(249,226,126,0.35); background: --surface-joker gradient` |

---

## 6. Component Library

### 6.1 Primitive Components

#### `GlassPanel` — `components/ui/GlassPanel.tsx`

Glassmorphism container. The single source for bordered translucent surfaces. **Never** duplicate `.glass + border + radius` by hand — use this.

**Props:**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `variant` | `"glass" \| "card" \| "elevated"` | `"glass"` | Background tier |
| `radius` | `"card" \| "panel" \| "none"` | `"card"` | `--radius-card` / `--radius-panel` / no radius |
| `glow` | `boolean` | `false` | Adds `.gold-border-glow` inset shadow |
| `overlay` | `boolean` | `false` | Adds `.card-gradient-overlay` top-left highlight |
| `shadow` | `"none" \| "sm" \| "md" \| "lg"` | `"none"` | Applies `shadow-gold-*` |
| `className` | `string` | `""` | |
| `style` | `CSSProperties` | — | |

```tsx
<GlassPanel variant="card" radius="panel" shadow="md" glow overlay className="p-6">
  {children}
</GlassPanel>
```

---

#### `StatCard` — `components/ui/StatCard.tsx`

Label + metric value tile. The value slot accepts `AnimatedCounter` or any `ReactNode`.

**Props:**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `label` | `ReactNode` | required | Upper section label |
| `children` | `ReactNode` | required | Value (typically `AnimatedCounter`) |
| `accent` | `"champagne" \| "emerald" \| "red" \| "amber" \| "sky" \| "gold"` | `"champagne"` | Label color |
| `className` | `string` | `""` | |
| `style` | `CSSProperties` | — | |

`"gold"` accent also adds `queen-name-glow` to the label.

```tsx
<StatCard label={<>Received<br />(This Month)</>} accent="champagne">
  <AnimatedCounter value={n} className="font-cinzel font-bold text-[var(--text-counter-lg)] text-champagne tabular-nums" />
</StatCard>
```

> **Do not** use StatCard for the 5-metric hero row in QueendomPanel — that uses custom `MetricBox` layout. Follow the existing pattern.

---

#### `SectionDivider` — `components/ui/SectionDivider.tsx`

Horizontal gold rule with optional centered title flanked by `.separator-gold-h` lines.

**Props:**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `label` | `ReactNode` | — | If omitted → plain horizontal rule only |
| `accent` | `"gold" \| "champagne" \| "amber"` | `"gold"` | Title color |
| `labelClass` | `string` | `""` | Extra classes on title span |
| `labelStyle` | `CSSProperties` | — | |
| `className` | `string` | `""` | Outer wrapper class |

```tsx
<SectionDivider
  label="Special Dates"
  accent="champagne"
  labelClass="!font-inter !font-semibold text-[clamp(1.5rem,2.2vw,2.6rem)] tracking-[0.42em]"
/>
```

---

#### `AnimatedCounter` — `components/AnimatedCounter.tsx`

Animates a numeric value from 0 (or previous value) to a new value. Used for all TV scorecards.

**Key props:** `value: number`, `className?: string`, `delay?: number` (ms), `slideOnChange?: boolean`

---

### 6.2 Layout Components

| Component | File | Role | Key Sizing |
|-----------|------|------|-----------|
| `Dashboard` | `components/Dashboard.tsx` | Root shell; hooks + ErrorBoundary regions | `flex-col min-h-screen` |
| `DashboardController` | `components/DashboardController.tsx` | Screen switcher, PAUSE, skeleton overlays | `relative h-full w-full min-h-0 overflow-hidden` |
| `TopBar` | `components/TopBar.tsx` | Fixed header strip | `height: 18vh, minHeight: 96px, maxHeight: 165px` |
| `QueendomPanel` | `components/QueendomPanel.tsx` | One queendom column | `flex-1 flex-col min-h-0` |
| `OnboardingLayout` | `components/onboarding/OnboardingLayout.tsx` | Revenue Dashboard (`useOnboardingPanelData`), 3-column grid | `h-full min-h-0 flex-1 overflow-hidden` |
| `RecommendationTicker` | `components/RecommendationTicker.tsx` | Bottom dock horizontal ticker | `z-10`, CSS marquee `ticker-scroll` 40s |
| `CelebrationOverlay` | `components/CelebrationOverlay.tsx` | Full-screen win overlay | `fixed inset-0 z-50`, 3s timeout |

### 6.3 Data Display Components

| Component | File | Data |
|-----------|------|------|
| `AgentLeaderboard` | `components/leaderboard/AgentLeaderboard.tsx` | `stats.agents` |
| `AgentRow` | `components/leaderboard/AgentRow.tsx` | `AgentStats` — surge + win shimmer |
| `AgentIcon` | `components/leaderboard/AgentIcon.tsx` | SVG ring, 80×80 viewBox, stroke `#c9a84c` |
| `RenewalsPanel` | `components/RenewalsPanel.tsx` | `RenewalsPanelData` prop |
| `JokerMetricsStrip` | `components/JokerMetricsStrip.tsx` | `JokerStats` |
| `SpecialDates` | `components/SpecialDates.tsx` | Static from `lib/specialDates.ts` |
| `QueendomWingspanHeader` | `components/QueendomWingspanHeader.tsx` | Member counts |
| `ConversionLedger` | `components/onboarding/ConversionLedger.tsx` | rAF scroll, max 15 rows |
| `DepartmentColumn` | `components/onboarding/DepartmentColumn.tsx` | Agent cards + metrics |
| `PerformanceLineGraph` | `components/onboarding/PerformanceLineGraph.tsx` | Native SVG, 4 vertical trend lines |
| `LeadStatusHealthBar` | `components/onboarding/LeadStatusHealthBar.tsx` | Segmented pipeline bar |

**Unmounted / orphaned (exist in repo, not imported by OnboardingLayout):**
- `components/onboarding/LeadVelocityChart.tsx`
- `components/onboarding/AgentVerticalBarChart.tsx`

---

## 7. Layout Architecture

### 7.1 Component Tree

```
app/page.tsx
└── Dashboard (components/Dashboard.tsx)
    ├── ErrorBoundary → TopBar
    ├── ErrorBoundary → CelebrationOverlay (z-50, fixed)
    ├── DashboardController (flex-1 min-h-0)
    │   ├── PAUSE button (z-[100])
    │   ├── motion.div [concierge layer — opacity/zIndex]
    │   │   ├── Ananyshree column
    │   │   │   ├── ErrorBoundary → QueendomPanel (side=left)
    │   │   │   │   ├── ambient-glow-left
    │   │   │   │   ├── QueendomWingspanHeader
    │   │   │   │   ├── SectionDivider
    │   │   │   │   ├── 5-metric hero row (AnimatedCounter × MetricBox × joker-box)
    │   │   │   │   ├── RenewalsPanel
    │   │   │   │   └── glass card: AgentLeaderboard + SpecialDates + JokerMetricsStrip
    │   │   │   └── AnimatePresence → QueendomSkeleton
    │   │   ├── center separator column (md+ only, --size-center-separator wide)
    │   │   │   └── ambient-glow-column + separator-gold-v
    │   │   └── Anishqa column
    │   │       ├── ErrorBoundary → QueendomPanel (side=right)
    │   │       └── AnimatePresence → QueendomSkeleton
    │   └── motion.div [onboarding layer — opacity/zIndex]
    │       ├── ErrorBoundary → OnboardingLayout (calls useOnboardingPanelData)
    │       │   ├── ambient-glow-stage
    │       │   ├── header (SectionDivider × 2 + title)
    │       │   └── grid 3-col (lg)
    │       │       ├── DepartmentColumn (concierge / "Onboarding")
    │       │       ├── center: LeadMonthStats + PerformanceLineGraph + ConversionLedger
    │       │       └── DepartmentColumn (shop)
    │       └── AnimatePresence → OnboardingSkeleton
    └── div z-10 [ticker dock]
        └── ErrorBoundary → RecommendationTicker
```

### 7.2 Sizing Rules

1. **Never `100vw` / `100vh`** inside arbitrary children. Use `h-full` / `w-full` in flex parents with `min-h-0`.
2. **`min-h-0`** on every flex child that must shrink or clip.
3. **`overflow-hidden`** default for all TV panels.
4. New full-height panel pattern: `className="h-full w-full min-h-0 overflow-hidden flex flex-col"`.

### 7.3 Z-Index Scale

| Layer | z-index | Owner |
|-------|---------|-------|
| Noise overlay | `0` | `body::before` |
| Ambient glows | `0` (position: absolute) | Panel decoratives |
| Main content | auto | All panels |
| Active screen | `10` | DashboardController active layer |
| Inactive screen | `0` | DashboardController hidden layer |
| TopBar | `10` | `TopBar` wrapper |
| Ticker | `10` | Bottom ticker wrapper |
| Card win shimmer | `15` | `.card-win-shimmer` |
| Skeletons | `20` | Skeleton overlays inside DashboardController |
| Celebration | `50` | `CelebrationOverlay` (`fixed inset-0`) |
| PAUSE button | `100` | DashboardController control |

New global overlays: use **11–49** range. Do not collide with `50` (celebration) or `100` (controls).

### 7.4 Responsive Behavior

| Breakpoint | Concierge | Onboarding |
|-----------|-----------|-----------|
| `< lg` | Stacked vertically, horizontal gold rule between panels | Single column (`grid-cols-1`) |
| `lg+` | Side-by-side with center separator | 3 columns (`grid-cols-[1fr_1fr_1.05fr]`) |
| `md` scroll | `overflow-y-auto` on panels; desktop hides this | — |

**TV primary target is always `lg+`** with no scroll.

---

## 8. Animation & Motion System

### 8.1 The GPU Rule

Only animate `opacity` and `transform` (including `translateX/Y/Z`, `scale`, `rotate`). Never tween:
- `box-shadow` → use CSS class toggling with `@keyframes` on a separate pseudo-element or overlay
- `background-color` / `color` → use CSS class toggle or instant state change
- `border-color` / `border-width` → instant
- `width` / `height` / `padding` / `margin` → triggers layout, never animate
- `filter` → expensive on low-end TV hardware; use sparingly for static states only

**Promoted layers:** Apply `gpuStyle` (`will-change: transform, opacity; transform: translateZ(0)`) from `lib/motionPresets.ts` to animated Framer Motion elements that stay on screen for extended periods.

**Exception rule for `@keyframes`:** `animate-aura-pulse`, `animate-gold-pulse`, and `animate-escalation-breathe` animate `box-shadow` / `text-shadow` via CSS `@keyframes`. This is acceptable because they run on the CSS animation thread (not Framer Motion / JS), and they are class-toggled not continuously tweened. Do not replicate this pattern in Framer Motion `animate={}`.

### 8.2 Framer Motion Stagger Patterns

**Panel entry (QueendomPanel local variants)**
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

**Generic stagger (from `lib/motionPresets.ts`)**
```tsx
// containerVariants: staggerChildren: 0.14, delayChildren: 0.2
// itemVariants: fade-up 28px, duration 0.7, ease EASE_LUXURY
<motion.section variants={containerVariants} initial="hidden" animate="visible">
  <motion.div variants={itemVariants} style={gpuStyle} />
</motion.section>
```

**Screen crossfade**
```tsx
// crossfadeTransition = { duration: 1.5, ease: "easeInOut" }
animate={{ opacity: activeScreen === "concierge" ? 1 : 0, zIndex: ... }}
transition={crossfadeTransition}
```

**Leaderboard row entry**
```tsx
<motion.div
  variants={rowVariants}
  custom={baseDelay + index * 0.07}  // per-row delay
  initial="hidden"
  animate="visible"
  exit="exit"
  style={gpuStyle}
/>
```

**Widget fade-in**
```tsx
<motion.div {...widgetFadeIn(delayMs)} />
// Produces: initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }} transition={{ delay, duration:0.5 }}
```

### 8.3 AnimatePresence Rules

Use `AnimatePresence` for:
- Skeleton exit animations (opacity 0, duration 0.7, ease `[0.4,0,0.2,1]`)
- CelebrationOverlay mount/unmount

Do NOT use `AnimatePresence` for:
- Top-level screen switching (concierge ↔ onboarding) — see Law 4
- Leaderboard re-ordering (use `layoutId` only if truly needed; avoid layout animations)

### 8.4 Reduced Motion

```tsx
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";

const prefersReduced = usePrefersReducedMotion();
// Skip infinite scroll, win shimmers, and heavy particle effects when true
```

CSS counterpart: `@media (prefers-reduced-motion: reduce)` on `.hot-lead-card-pulse` sets `animation: none`.

---

## 9. CSS Keyframes Catalog

All defined in `app/globals.css`.

| Keyframe | Definition | Used By |
|----------|-----------|---------|
| `ticker-scroll` | `transform: translate3d(0,0,0)` → `translate3d(-50%,0,0)` | RecommendationTicker horizontal marquee; applied manually via JS in current code |
| `text-shimmer` | `background-position: -200% center` → `200% center` | `.celebration-shimmer-text` |
| `gold-sweep` | `translateX(-150%) skewX(-25deg)` → `translateX(150%) skewX(-25deg)` | `.celebration-name-flash` — one-shot sweep |
| `row-shimmer` | `background-position: -100% 0` → `200% 0` | `.row-win-shimmer` |
| `foil-shimmer` | `background-position: -200% center` → `200% center` | `.skeleton-block` (infinite), `.card-win-shimmer` (1 run) |
| `hot-pulse` | `opacity: 0.25` ↔ `1` | `.hot-lead-card-pulse` |
| `healthbar-pulse` | `opacity: 0.4` ↔ `1` | Health bar empty state |
| `bar-gloss-sweep` | `translateX(-180%) skewX(-18deg)` → `translateX(350%) skewX(-18deg)` with opacity fade | Health bar gloss |
| `bar-glow-breathe` | `opacity: 0.55` ↔ `1` | Health bar outer glow |
| `ob-metric-pulse` | Color: `var(--ob-pulse-color, #d4af37)` → `rgba(255,255,255,0.92)` | `.ob-metric-flash` — 0.55s on metric update |

**Tailwind-extended keyframes** (in `tailwind.config.ts`):

| Keyframe | Animation Class | Effect |
|----------|---------------|--------|
| `pulse-ring` | `animate-pulse-ring` | Scale 1→2.5, opacity 0.8→0 (AgentIcon ring) |
| `aura-pulse` | `animate-aura-pulse` | Box-shadow gold breathe |
| `halo-breathe` | `animate-halo-breathe` | Opacity + scale breathe |
| `text-shimmer` | `animate-text-shimmer` | Same as foil, for text gradient |
| `escalation-breathe` | `animate-escalation-breathe` | Red text-shadow pulse for escalated state |
| `gold-pulse` | `animate-gold-pulse` | Box-shadow gold breathe (brighter than aura) |

---

## 10. Framer Motion Presets

**File:** `lib/motionPresets.ts`

All exports are importable: `import { gpuStyle, itemVariants, ... } from "@/lib/motionPresets"`.

| Export | Type | Purpose |
|--------|------|---------|
| `gpuStyle` | `CSSProperties` | `will-change: transform, opacity; transform: translateZ(0)` — spread on animated `style` prop |
| `EASE_LUXURY` | `[0.25, 0.46, 0.45, 0.94]` | Primary easing curve; matches `--ease-luxury` CSS var |
| `containerVariants` | `Variants` | Stagger parent: `staggerChildren: 0.14, delayChildren: 0.2` |
| `itemVariants` | `Variants` | Child: fade-up 28px, `duration: 0.7, ease: EASE_LUXURY` |
| `crossfadeTransition` | `Transition` | `duration: 1.5, ease: "easeInOut"` — screen switch |
| `widgetFadeIn(delayMs)` | Function → props | Returns `initial/animate/transition` for fade-up 12px, `duration: 0.5` |
| `rowVariants` | `Variants` | Leaderboard row: fade-up 18px; `custom` prop = delay in seconds; exit: fade-up -6px, 0.3s |
| `surgeBgVariants` | Variants object | Gold background burst on score increase: `opacity [0.9, 0], scale [0.98, 1]`, 0.8s |
| `surgeSweepVariants` | Variants object | Row shimmer opacity `[1, 1, 0]`, 0.6s |
| `surgeSweepBarVariants` | Variants object | Horizontal bar `x: -100% → 200%`, 0.6s |
| `winShimmerBarVariants` | Variants object | Winning row bar `x: -100% → 300%`, 1.2s `EASE_LUXURY` |

**Usage pattern — all animated surfaces:**
```tsx
<motion.div
  variants={itemVariants}
  style={gpuStyle}
  className="..."
/>
```

---

## 11. TV-Specific Engineering Rules

### 11.1 Sizing

- Never hardcode `px` heights for regions that should fill the viewport — use flex + `min-h-0` + `h-full`.
- If a region seems to not fill the screen, check that every flex ancestor has `min-h-0`.
- Avoid `vh` units for component heights unless the component is a direct root child — prefer flex stretch.

### 11.2 Scrollbars

All scrollbars are hidden globally via:
```css
::-webkit-scrollbar { display: none; }
```
Do not add custom scrollbar styling. On TV there is no scroll affordance.

### 11.3 GPU Budget

- Maximum animated elements on screen simultaneously: ~8–10 independent Framer Motion `animate` targets.
- For list animations (leaderboard rows), stagger with delay rather than animating all simultaneously.
- Use `style={gpuStyle}` on Framer elements that persist for > 5 seconds.
- Use `will-change: opacity` on CSS-animation elements that run infinitely (see `.hot-lead-card-pulse`).

### 11.4 Font Loading

Fonts are loaded via `next/font/google` in `app/layout.tsx` (Inter, Cinzel, Libre Baskerville, Montserrat) and via `@import` in `globals.css` (Edu AU VIC WA NT Hand Arrows). **No FOUT** because Next.js font optimization preloads them. Do not add new fonts without adding them to both the `next/font` configuration and the CSS variable map.

### 11.5 Charts — Native SVG Only

No Recharts, Chart.js, D3, or external chart library. All graphs are native `<svg>` elements with Framer Motion for entrance animations. `PerformanceLineGraph` renders polylines, circles, and text directly in SVG. Follow this pattern for any new data visualization.

**Performance graph vertical colors:** `#6B8FFF` (Global), `#FFB020` (Shop), `#34D399` (Legacy), `#C084FC` (House).

### 11.6 Realtime Safety

- The anon Supabase client (`lib/supabase.ts`) is used **only** for Realtime subscriptions. Never call data-fetching queries from it in production components.
- Every `useEffect` that subscribes via `supabase.channel(...)` **must** return a cleanup: `return () => { supabase.removeChannel(ch); }`.
- Channel names must be unique per component mount: use stable identifiers like `"dashboard-tickets"`, not random UUIDs.

### 11.7 Keyboard Controls

PAUSE/RESUME is wired to `window` with `{ capture: true }` for fullscreen TV browser compatibility. Keys: `p`, `P`, ` ` (Space), `Enter`, `MediaPlayPause`. Left/Right arrows switch screens. Do not add new keyboard handlers that conflict with these.

---

## 12. Rules for Writing New UI

### Pre-implementation checklist

Before writing any new component or modifying an existing one:

- [ ] Locate the parent component in §7.1 tree
- [ ] Identify all colors needed — pick from §2.1–2.5 tokens. No new hex.
- [ ] Identify font sizes needed — pick from §2.6 or §4.2. No new `px` values.
- [ ] Check §6.1 — can GlassPanel, StatCard, or SectionDivider handle it?
- [ ] Check §10 — does widgetFadeIn / itemVariants cover the entrance animation?
- [ ] Apply `min-h-0` on all flex children that shrink. Apply `overflow-hidden` on panels.
- [ ] Apply `style={gpuStyle}` on Framer elements that persist > 5s.
- [ ] Test at both 1280px and 1920px widths.

### Color rules

1. Use **§2.1–2.5 tokens** only. No new inline hex.
2. No Tailwind default palette for branded surfaces (`bg-yellow-400`, `bg-blue-500`, etc.).
3. Gold = `text-gold-400`, `text-gold-300`, `border-gold-500/20`, or CSS var references.
4. Status = `text-emerald-400`, `text-red-400`, etc. mapped in §2.5.

### Typography rules

1. All font sizes via `--text-*` tokens or `clamp()` expressions.
2. `tabular-nums` on all changing numeric displays.
3. Minimum effective ~14px. Verify at 1280px.
4. Cinzel for headings/brand. Inter for labels/body. Baskerville for names. Edu for numerals with personality.

### Animation rules

1. Only `opacity` and `transform` in Framer Motion tweens — see §8.1.
2. Use `motionPresets` before writing new animation objects.
3. `AnimatePresence` only for skeleton exits and CelebrationOverlay.
4. Add `style={gpuStyle}` to persistent animated elements.
5. Check `usePrefersReducedMotion` before infinite effects.
6. Match durations to §2.9 tokens where possible (0.55s row, 0.7s item, 1.5s crossfade).

### Layout rules

1. `h-full w-full min-h-0 overflow-hidden flex flex-col` pattern for all new TV panels.
2. No `100vh` or `100vw` inside components — use flex stretch from parent.
3. Z-index: use §7.3 budget. No values > 100 without explicit justification.

### When in doubt

**Stop.** Ask the maintainer or document the new pattern here before shipping it.

---

*Last updated: 2026-05-08 — Full rewrite from codebase scan. Previous version superseded.*
