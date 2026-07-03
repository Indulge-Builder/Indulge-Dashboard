# Handoff: Indulge Live Dashboard — Serene Neumorphic Reskin

## Overview
A full soft-3D / neumorphic reskin of the **Indulge Live Dashboard** (the 24/7 TV broadcast app — Next.js + Tailwind + framer-motion + Supabase Realtime). The gold-on-obsidian "luxury noir" skin is replaced with the **Serene Neumorphic** material: warm cream (day) / warm charcoal (night), honey-gold accent, one top-left light source, every surface carved from one material.

**This is a skin + motion upgrade only.** Layout, placement, component structure, fonts, data flow, hooks, aggregation math, rotation logic, and all 12 CLAUDE.md invariants are untouched.

## Files in this package
- `Indulge Dashboard Neumorphic.dc.html` — living specimen (open in a browser, keep `support.js` + `assets/` beside it). Both screens, both themes, all motion. Every style is inline — inspect any element for its exact recipe.
- `indulge-neumorphic-tokens.css` — the token layer + motion keyframes, ready to sit beside `app/globals.css`.
- `CLAUDE_CODE_PROMPT.md` — the implementation brief for Claude Code.
- `assets/agents/*.webp` — the onboarding agent portraits (already in the repo as `onboarding-agents-images/`).

## Fidelity
**High-fidelity.** Colors, shadows, radii, and motion grammar are final. Recreate through the codebase's Tailwind/token conventions — no hardcoded hex in components.

## The Rules
1. **One material, one light (315°).** Canvas is a warm midtone — cream `#ECE8E1` by day, warm charcoal `#28241C` by night. **Never** the old `#050507` obsidian; neumorphism dies on near-black.
2. **Shadows come in pairs.** Dark bottom-right + light top-left, always ("Whisper" depth recipes in the tokens file).
3. **Raised = content.** Panels, tiles, pills, chips, plinths, portraits — all raised with a 1px hairline edge. This dashboard deliberately raises things the Serene app allowed as wells: metric bands, clock, ledger rows (flat-on-card), legend chips.
4. **Inset = tracks & rails only.** Health-bar track, overdue ticker rail, segmented-control tracks, pressed states. Content never sinks.
5. **Daypart themes.** `data-neu` attribute on the root scope: cream **04:00–16:00 IST**, charcoal **16:00–04:00 IST**, driven by `lib/istDate.ts` (never local time).

## Design tokens (see `indulge-neumorphic-tokens.css`)
- **Radii — PEBBLE (final, only scale):** panels 20–22 · tiles 12 · chips/rows 9 · pills 999.
- **Accent — honey gold (single theme, no switcher):** `#D6BC82` / deep `#8A7448` / ink fg `#33290F`. Dark mode lifts to `#E0CA9B` / `#CBB183`.
- **Pastel support family:** sage (resolved/success), powder (Shop dept + info), butter (incomplete/warning), lilac, peach, danger `#D98E85` (pending/overdue). Deep variants for text.
- **Series colors (Performance graph):** Global = accent-deep · Shop = powder-deep · House = sage-deep · Legacy = lilac-deep.
- **Text:** `#38332B` / `#8A8274` / `#ABA396` (flipped warm-light on charcoal).
- **Typography unchanged:** Cinzel (display/headers), Montserrat (numerals, tabular-nums), Inter (body). Same sizes, same tracking. Gold *glow* text-shadows are retired — light-mode type carries a 1px letterpress highlight instead.

## Component-by-component (what changed visually)
| Component | Neumorphic treatment |
|---|---|
| `TopBar` | Raised bar; wordmark **"Indulge Global"** (title case, Cinzel 800); raised clock pill with pulsing sage live-dot + IST tag; pause/resume as raised pill (pressed state when paused). |
| `QueendomPanel` | Whole panel = raised `--neu-radius-panel` card. Wingspan pills raised + gently bobbing. Hero row: "Resolved Today" on a **sage plinth** (gradient wash) with bloom ring on increase; "This Month" = raised band, 4 metrics split by hairlines (Received t1 · Resolved sage · Pending danger · Spoiled accent). |
| `RenewalsPanel` | Counter on **gold plinth**; ✓ name lists; first item shimmer retired in favor of rise-in. |
| `AgentLeaderboard` / `AgentRow` / `AgentIcon` | **Live reorder:** rows keep stable DOM order, are absolutely positioned by rank (`top = rank·rowH`) and **glide** (850ms `--neu-ease-glide`) on rank change. Top-3 get warm accent-wash plinths (8%/7%/4%); **no rank number coins**. Crown ♛ floats above #1's ring. **Richer ring:** stroke thickens 3→5.2 and color brightens (mix toward tertiary when low) as today-completion approaches 100%; sage ✓ coin pops in at 100%. Surge = gold sweep overlay + number squash-pop. Columns unchanged: ring+initials · name · Today c/a · Month c/a · P·O·I. |
| `SpecialDates` | Calendar-leaf date tiles (MON over day, raised). Row wash by type: **butter = birthday (✦)**, **rose = anniversary (♥)** — icon at row end, no type chips. Today = stronger wash + accent border + raised. |
| Pulse band | Stopwatch digits on **gold plinth pill** (accent-deep numerals, breathing sage dot); Incoming Renewals = raised chips on a 26s marquee with edge masks. |
| `OverdueTicker` | Inset **rail**; items are **luggage-tag stubs**: subject card (⚠ + subject + #id) → tie-string → accent-washed agent tab with punched eyelet, each tab swinging ±3° (staggered). 42s loop, mask-fade edges, pause-on-hover irrelevant on TV. |
| `OnboardingLayout` / `DepartmentColumn` | Dept headers = **engraved nameplates**: dept-tinted plaque (gold = Onboarding, powder = Shop), letterpress type, pulsing dot. Agent cards stretch to fill column height; raised portrait tile; centered name flanked by dept hairlines; 3 raised metric tiles (Leads/Today/Closed); health bar stays an inset **track**; below it a 6-chip row of per-status counts (QUAL·DISC·NURT·TOUCH·NEW·JUNK, pastel washes + deep-tone numerals). |
| Stat tiles (center) | Label + big numeral only (sparklines removed), gentle bob, squash-pop on change. |
| `PerformanceLineGraph` | 4 smooth lines + 7% area fills; stroke draw-in (2s staggered) on screen activation; end dots with bloom rings on pulse events; raised legend chips with month totals. Putty-toned dashed gridlines. |
| `TargetMeter` | Sits **beside** Live Closures (36%/64% split of the bottom slot). Ring r41/stroke 11.5, cumulative per-agent arcs (rounded caps, drawn back-to-front), rank palette accent→powder→sage→lilac→peach→danger→butter, pulsing halo + dot at the leading edge, center total-of-target, agent legend. Grows live on deal events. |
| `ConversionLedger` | Flat rows on the card (no row containers) split by faint hairlines; raised sage ✓ coin per row; new deal = rise-in prepend; agent name in accent-deep caps + time in tertiary. |
| `CelebrationOverlay` | Cream scrim (62%); plinth card pops (spring 0.65s); floating crown; initials disc on accent gradient; **pastel confetti** (7 support colors, mixed circles/rects, per-piece sway/duration/delay); keep the 3-note chime + 3s duration. |

## Motion grammar (Motion level: 7/10 — "alive but calm")
- **Ambient:** 3 drifting pastel radial blobs behind content (46–58s); cards bob ±0.25–0.45cqh over 6.5–8s with staggered phase.
- **Entrance:** sections rise 0.7s `--neu-ease-glide`, 0.12s stagger; replayed on screen switch.
- **Numbers:** count-up odometers on load (1.5s easeOutCubic, existing `AnimatedCounter` covers this); squash-pop `--neu-dur-pop` spring on live change.
- **Events:** row surge sweep 0.9s; bloom rings 0.9s; ledger rise-in; leaderboard glide 850ms; ring/arc draws 1.4–2s.
- **Always:** transform/opacity only in JS-driven motion, no backdrop-blur on movers, `prefers-reduced-motion` kills all loops (existing repo patterns stand).

## What must NOT change
- All 12 invariants in the repo's CLAUDE.md (IST math, void-ticket stripping, always-mounted crossfade rotation, channel names, singletons, etc.).
- Layout/placement/columns/order of every component; font families and size scales; framer-motion architecture; data hooks and API routes; Supabase logic.
- The 1.5s crossfade rotation timing (Concierge 60s → Revenue 10s in production; the specimen demos at 12s/8s).
