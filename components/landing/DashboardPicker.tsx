"use client";

/**
 * components/landing/DashboardPicker.tsx — the first screen at "/".
 *
 * Asks which dashboard to view: Concierge (/concierge) or Onboarding
 * (/onboarding). Built for the same 4K wall as the dashboards — one glance,
 * two large plinths, remote-friendly:
 *
 *   ◀ ▶ / ▲ ▼ / Tab   move the focus between the two cards
 *   Enter / OK        open the focused card (native <a> activation)
 *   pointer           press feedback on pointer-down (scale, 150 ms)
 *
 * The first card is focused on mount so a single OK press opens Concierge.
 * Focus/selection is a static class swap (Law 1 — no tweened glow); the
 * entrance is the dashboard's opacity/translate choreography and respects
 * prefers-reduced-motion. Both routes are prefetched by <Link>.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { Settings } from "lucide-react";
import TopBar from "@/components/TopBar";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { EASE_LUXURY } from "@/lib/motionPresets";
import { QUEENDOM_DISPLAY_NAME, QUEENDOM_IDS } from "@/lib/queendom";
import { fh, fw } from "@/lib/tvScale";

interface DashboardChoice {
  href: string;
  numeral: string;
  title: string;
  kicker: string;
  description: string;
  /** Small "what's inside" line under the description. */
  contents: string;
}

const CHOICES: DashboardChoice[] = [
  {
    href: "/concierge",
    numeral: "I",
    title: "Concierge",
    kicker: "Queendoms · Tickets · Renewals",
    description:
      "Every Queendom live from Freshdesk — the scoreboard, the Genie leaderboard, renewals, special dates and the overdue ticker.",
    contents: QUEENDOM_IDS.map((id) => QUEENDOM_DISPLAY_NAME[id]).join("  ·  "),
  },
  {
    href: "/onboarding",
    numeral: "II",
    title: "Onboarding",
    kicker: "Leads · Deals · Revenue",
    description:
      "The sales floor live from Zoho — the Onboarding team's leads and pipeline, the conversion ledger, targets and the lead pulse.",
    contents: "Indulge Global  ·  Shop  ·  House  ·  Legacy",
  },
];

// ─── Stage-pinned sizes (6144 × 3456; two plinths ≈ 1860 × 1500 each) ─────────
const EYEBROW_STYLE = { fontSize: fw(40), letterSpacing: "0.42em" };
const NUMERAL_STYLE = { fontSize: fw(48), letterSpacing: "0.3em" };
// Low floor so "ONBOARDING" still fits a phone-width plinth.
const TITLE_STYLE = { fontSize: fw(180, 0.18), letterSpacing: "0.08em" };
const KICKER_STYLE = { fontSize: fw(40), letterSpacing: "0.3em" };
const DESCRIPTION_STYLE = { fontSize: fw(44), lineHeight: 1.45 };
const CONTENTS_STYLE = { fontSize: fw(32), letterSpacing: "0.22em" };
const CTA_STYLE = { fontSize: fw(38), letterSpacing: "0.28em" };
const HINT_STYLE = { fontSize: fw(30), letterSpacing: "0.3em" };
const CARD_PADDING = `${fh(120)} ${fw(120)}`;
const CARD_MIN_HEIGHT = fh(1200, 0.2);
const CARD_GAP = fw(72);
const CARD_MAX_WIDTH = fw(3800, 0.45);

/** The Settings plate: glass rectangle, gold rim, lit on focus (static class swap). */
const SETTINGS_PLATE_CLASS =
  "inline-flex items-center justify-center border border-gold-500/40 bg-black/50 text-gold-300 shadow-lg transition-[background-color,border-color,color,transform] duration-150 ease-out hover:border-gold-400/70 hover:bg-black/65 hover:text-gold-200 active:scale-[0.97] focus:outline-none focus-visible:border-gold-400/80 focus-visible:ring-2 focus-visible:ring-gold-400/60";

export default function DashboardPicker() {
  const reduceMotion = useReducedMotion();
  const linkRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const [focused, setFocused] = useState(0);

  const focusIndex = useCallback((i: number) => {
    const next = (i + CHOICES.length) % CHOICES.length;
    setFocused(next);
    linkRefs.current[next]?.focus({ preventScroll: true });
  }, []);

  // One OK press opens Concierge: focus the first plinth on mount.
  useEffect(() => {
    focusIndex(0);
  }, [focusIndex]);

  // TV remote: arrows move between the plinths; Enter activates the focused
  // <a> natively. Capture phase so an embedded TV browser can't swallow it.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowRight":
        case "ArrowDown":
          e.preventDefault();
          focusIndex(focused + 1);
          break;
        case "ArrowLeft":
        case "ArrowUp":
          e.preventDefault();
          focusIndex(focused - 1);
          break;
        default:
          return;
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [focused, focusIndex]);

  const entrance = (i: number) => ({
    initial: reduceMotion ? { opacity: 0 } : { opacity: 0, y: 28 },
    animate: reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 },
    transition: { duration: 0.65, ease: EASE_LUXURY, delay: 0.25 + i * 0.09 },
  });

  return (
    <main className="relative flex min-h-screen w-full flex-col bg-obsidian md:h-screen md:overflow-hidden">
      <div className="ambient-glow-center pointer-events-none absolute inset-0" />

      {/* The TV masthead from md up; phones get a one-line wordmark (the TV
          TopBar's clock/date collide below ~800px). */}
      <div className="hidden md:block">
        <ErrorBoundary label="Top Bar">
          <TopBar />
        </ErrorBoundary>
      </div>
      <header className="relative flex items-center justify-between border-b border-gold-500/15 px-6 py-5 md:hidden">
        <h1 className="font-cinzel text-xl tracking-[0.3em] text-gold-400 gold-glow uppercase leading-none">
          Indulge Global
        </h1>
        <span className="flex items-center gap-2">
          <span className="inline-flex items-center rounded-full border border-gold-500/40 bg-gold-500/5 px-3 py-1 font-montserrat text-xs tracking-[0.3em] uppercase text-gold-400">
            Live
          </span>
          <Link
            href="/settings"
            aria-label="Dashboard settings"
            className={`${SETTINGS_PLATE_CLASS} h-9 gap-1.5 rounded-lg px-3 font-cinzel text-[11px] font-semibold uppercase tracking-[0.22em]`}
          >
            <Settings className="h-4 w-4" strokeWidth={1.75} aria-hidden />
            Settings
          </Link>
        </span>
      </header>

      {/* Settings — only on this landing screen, never on the dashboards.
          A large labelled plate (not an icon) so a TV-remote pointer lands on
          it easily; sits just under the TopBar (18cqh clamped 96–165px).
          Tab-reachable; the arrow keys stay on the two plinths. */}
      <Link
        href="/settings"
        aria-label="Dashboard settings"
        className={`${SETTINGS_PLATE_CLASS} absolute right-[var(--pad-panel)] z-[100] hidden md:inline-flex`}
        style={{
          top: "calc(min(max(18cqh, 96px), 165px) + 1.5rem)",
          height: fh(120),
          padding: `0 ${fw(48)}`,
          gap: fw(22),
          borderRadius: fw(16),
        }}
      >
        <Settings style={{ width: fw(48), height: fw(48) }} strokeWidth={1.75} aria-hidden />
        <span
          className="font-cinzel font-semibold uppercase leading-none"
          style={{ fontSize: fw(36), letterSpacing: "0.28em" }}
        >
          Settings
        </span>
      </Link>

      <section
        className="relative flex min-h-0 flex-1 flex-col items-center justify-center"
        style={{ padding: `${fh(52)} var(--pad-panel)` }}
        aria-labelledby="picker-title"
      >
        <motion.p
          id="picker-title"
          className="font-cinzel font-semibold uppercase leading-none text-gold-300 gold-glow text-center"
          style={{ ...EYEBROW_STYLE, marginBottom: fh(64) }}
          {...entrance(0)}
        >
          Choose a dashboard
        </motion.p>

        <div
          className="flex w-full flex-col items-stretch md:flex-row md:justify-center"
          style={{ gap: CARD_GAP, maxWidth: CARD_MAX_WIDTH }}
        >
          {CHOICES.map((choice, i) => (
            <motion.div
              key={choice.href}
              className="flex min-w-0 flex-1 basis-0"
              {...entrance(i + 1)}
            >
              <Link
                ref={(el) => {
                  linkRefs.current[i] = el;
                }}
                href={choice.href}
                prefetch
                data-focused={focused === i}
                onFocus={() => setFocused(i)}
                onPointerEnter={() => setFocused(i)}
                className={[
                  "group relative flex w-full flex-col overflow-hidden rounded-2xl glass engrave-frame text-left",
                  "outline-none transition-transform duration-150 ease-out active:scale-[0.985]",
                  // Focus / hover = the hero elevation tier (static class swap, Law 1).
                  "data-[focused=true]:elevate-hero data-[focused=true]:border-gold-400/45",
                  "data-[focused=false]:elevate-mid",
                  "[@media(hover:hover)]:hover:border-gold-400/45",
                ].join(" ")}
                style={{ padding: CARD_PADDING, minHeight: CARD_MIN_HEIGHT }}
              >
                <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br from-gold-500/[0.05] to-transparent" />
                {/* Lit rim on the focused plinth — the light catches the top edge */}
                <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold-300/60 to-transparent opacity-0 group-data-[focused=true]:opacity-100" />

                <div className="relative flex min-h-0 flex-1 flex-col">
                  <span
                    className="font-cinzel font-semibold uppercase leading-none text-gold-400/60"
                    style={NUMERAL_STYLE}
                  >
                    {choice.numeral}
                  </span>

                  <h2
                    className="min-w-0 font-cinzel font-bold uppercase leading-none text-gold-400 queen-name-glow"
                    style={{ ...TITLE_STYLE, marginTop: fh(40) }}
                  >
                    {choice.title}
                  </h2>

                  <p
                    className="font-cinzel font-semibold uppercase leading-none text-champagne/85"
                    style={{ ...KICKER_STYLE, marginTop: fh(34) }}
                  >
                    {choice.kicker}
                  </p>

                  <span
                    className="separator-gold-h h-px w-full"
                    style={{ marginTop: fh(48), marginBottom: fh(48) }}
                    aria-hidden
                  />

                  <p className="font-montserrat text-champagne/70" style={DESCRIPTION_STYLE}>
                    {choice.description}
                  </p>

                  <p
                    className="font-cinzel font-semibold uppercase text-gold-400/70"
                    style={{ ...CONTENTS_STYLE, marginTop: fh(28) }}
                  >
                    {choice.contents}
                  </p>

                  <div
                    className="flex items-center justify-between"
                    style={{ marginTop: "auto", paddingTop: fh(72) }}
                  >
                    <span
                      className="font-cinzel font-semibold uppercase leading-none text-gold-300 gold-glow"
                      style={CTA_STYLE}
                    >
                      Open
                    </span>
                    <span
                      className="rounded-full border border-gold-500/30 bg-black/40 font-montserrat font-bold uppercase leading-none text-gold-400/70 opacity-0 group-data-[focused=true]:opacity-100"
                      style={{ fontSize: fw(24), letterSpacing: "0.2em", padding: `${fh(14)} ${fw(26)}` }}
                      aria-hidden
                    >
                      Enter
                    </span>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>

        <motion.p
          className="hidden font-cinzel font-semibold uppercase leading-none text-champagne/40 md:block"
          style={{ ...HINT_STYLE, marginTop: fh(64) }}
          {...entrance(3)}
          aria-hidden
        >
          ◀ ▶ choose &nbsp;·&nbsp; OK open
        </motion.p>
      </section>
    </main>
  );
}
