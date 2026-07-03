# Claude Code Prompt — Indulge Live Dashboard: Serene Neumorphic Reskin

Copy everything below into Claude Code, run from the `Indulge-Dashboard` repo root, with this handoff folder available.

---

You are reskinning the **Indulge Live Dashboard** (this repo: Next.js App Router + Tailwind v3 + framer-motion + Supabase Realtime; runs fullscreen on a 4K office TV) from its gold-on-obsidian theme to the **Serene Neumorphic** soft-3D system.

**Read first:**
1. `CLAUDE.md` and `docs/master.md` in this repo — the 12 invariants are law.
2. `README.md` in the handoff folder — the design rules and the component-by-component table.
3. `indulge-neumorphic-tokens.css` — the exact token values. Copy it into `app/` (import from `globals.css`, after the existing base).
4. Open `Indulge Dashboard Neumorphic.dc.html` in a browser (keep `support.js` + `assets/` beside it). It shows both screens, both themes, and every motion. All styles are inline — inspect elements for exact recipes. It is a **design reference**, not code to copy: recreate it through this codebase's existing components, Tailwind classes, and framer-motion patterns.

## Hard constraints
- **Zero changes** to: data hooks (`useDashboardData`, `useOnboardingPanelData`, `useRealtimeChannel`), API routes, webhooks, `lib/ticketAggregation.ts`, IST logic, rosters, rotation state machine (`DashboardController` — screens stay always-mounted with the 1.5s opacity crossfade), keyboard controls, `ErrorBoundary` structure.
- **Zero changes** to layout/placement/column order, font families (Cinzel / Montserrat / Inter stay via `next/font`), or size scales. This is styling + presentation motion only.
- Keep GPU discipline: JS/framer animates transform+opacity only; color/shadow loops via CSS keyframes; no `backdrop-blur` on moving elements; `usePrefersReducedMotion` / `prefers-reduced-motion` must disable all decorative loops.

## Step 1 — Token plumbing
- Add `indulge-neumorphic-tokens.css` beside `app/globals.css` and import it.
- Extend `tailwind.config.ts` with the `--neu-*` values (colors, boxShadow: `neu-sm/neu/neu-lg/neu-inset/neu-pressed`, borderRadius: `neu-panel/neu-tile/neu-chip`) so components use utilities, not arbitrary values everywhere.
- Retire in usage (leave tokens defined if referenced elsewhere): `bg-obsidian`, `ambient-glow-center`, `gold-glow`, `queen-name-glow`, `sky-name-glow`, `glass`, `gold-border-glow`, `surface-luxe*`, `elevate-*`, `engrave-frame`, `text-foil-*`. Their replacements are in the README table.

## Step 2 — Daypart theme (new, only new behavior allowed)
Create `hooks/useDaypartTheme.ts`:
- Compute the current IST hour via `lib/istDate.ts` helpers (never `new Date().getHours()` — invariant #1).
- `04 ≤ hour < 16` → `"light"`, else `"dark"`.
- Set `data-neu="light" | "dark"` on the `<html>` element (or the root wrapper in `Dashboard.tsx`); re-check every 60s; clean up the interval.
- Transition: root gets `transition: background 500ms ease` so the flip is soft.
- Optional dev override: `?neu=light|dark` query param.
Wire it once in `components/Dashboard.tsx`.

## Step 3 — Restyle, component by component
Follow the README table exactly. Order of work (visual weight first):

1. `app/globals.css` + `components/Dashboard.tsx` — canvas background `var(--neu-canvas)`, remove ambient obsidian glow, add the 3 drifting pastel blobs (pure CSS, `pointer-events-none`).
2. `components/TopBar.tsx` — raised bar; wordmark text becomes **"Indulge Global"** (title case); raised clock pill (pulsing sage dot + IST tag); pause button raised/pressed states.
3. `components/QueendomPanel.tsx` — panel card, wingspan pills (raised, `neu-bob-sm`), hero row (sage plinth for Resolved Today + raised "This Month" band with hairline splits), keep `queendomItemVariants` timings (invariant B2) but they now animate the neumorphic surfaces.
4. `components/leaderboard/*` —
   - `AgentRow.tsx`: rows absolutely positioned by rank; stable order in the DOM, `top` transitions 850ms `cubic-bezier(0.22,1,0.36,1)` → rank changes glide. Top-3 accent-wash row backgrounds (8/7/4%), **no rank medals**.
   - `AgentIcon.tsx`: ring stroke-width `3 + 2.2·pct`, stroke `color-mix(accent|sage → tertiary)` by pct, transitions on stroke props; sage ✓ badge at 100%; crown floats on rank 1.
   - Surge: gold sweep overlay + numeral squash-pop (`neu-pop`), keep the 1.5s mount-suppression guard.
5. `components/SpecialDates.tsx` — calendar-leaf date tiles; butter/rose row washes; ✦ / ♥ icons (typographic glyphs, keep lucide only if identical size); today = stronger wash + accent border.
6. `components/ResolveStopwatch.tsx` + `components/UpcomingRenewals.tsx` — gold plinth pill for the digits; raised marquee chips.
7. `components/OverdueTicker.tsx` — inset rail + luggage-tag stubs (subject card → tie → swinging agent tab with eyelet, `neu-tag-swing` staggered). Keep `repeatsPerHalf` + 40s baseline + mask fades.
8. `components/onboarding/*` — nameplate dept headers; full-height agent cards; raised portrait + 3 raised metric tiles; centered name with dept hairlines; status-count chip row under the health bar (counts from `LeadStatusByAgent`, same 6 statuses/colors as the bar); graph restyle (area fills 7%, draw-in, bloom on `PulseEvent`); `TargetMeter` moves beside `ConversionLedger` (36/64 split), soft palette from `--neu-series-*` + support family; ledger rows flat with hairlines + raised sage ✓ coin.
9. `components/CelebrationOverlay.tsx` — cream scrim, plinth pop, pastel confetti (7 support colors, mixed shapes, per-piece delay/duration/sway). Keep the singleton AudioContext chime and 3s duration.

## Step 4 — Verify
- `npm run dev`, compare side-by-side with the specimen at both `?neu=light` and `?neu=dark`, both screens, 4K and laptop widths.
- Trigger a Realtime event (or mock one) → confirm: surge sweep, numeral pop, leaderboard glide, ledger prepend rise, target-ring growth, celebration.
- `npm run lint` + `npm run build` clean.
- Confirm nothing in `lib/`, `hooks/use*Data*`, `app/api/**` changed except the new `useDaypartTheme.ts`.

Work through it file by file with small commits ("neu: topbar", "neu: leaderboard", …).
