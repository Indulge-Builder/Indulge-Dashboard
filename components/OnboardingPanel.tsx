"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { CSSProperties } from "react";
import { supabase } from "@/lib/supabase";
import type {
  OnboardingAgentRow,
  OnboardingApiPayload,
  OnboardingLedgerRow,
} from "@/lib/onboardingTypes";

/** Canonical left-to-right card order (matches dashboard layout). */
const AGENT_CARD_ORDER: readonly { id: string; name: string }[] = [
  { id: "amit", name: "Amit" },
  { id: "samson", name: "Samson" },
  { id: "meghana", name: "Meghana" },
];

/** Shown when /api/onboarding fails so the TV still lists the three sales seats. */
const FALLBACK_AGENTS: OnboardingAgentRow[] = AGENT_CARD_ORDER.map((s) => ({
  id: s.id,
  name: s.name,
  photoUrl: null,
  totalAttempted: 0,
  totalConverted: 0,
}));

function orderAgentsForDisplay(fromApi: OnboardingAgentRow[]): OnboardingAgentRow[] {
  const pool = [...fromApi];
  return AGENT_CARD_ORDER.map((spec) => {
    const idxId = pool.findIndex((a) => a.id === spec.id);
    if (idxId >= 0) {
      const [a] = pool.splice(idxId, 1);
      return a;
    }
    const idxName = pool.findIndex(
      (a) => a.name.trim().toLowerCase() === spec.name.toLowerCase(),
    );
    if (idxName >= 0) {
      const [a] = pool.splice(idxName, 1);
      return a;
    }
    return FALLBACK_AGENTS.find((f) => f.id === spec.id)!;
  });
}

/** Ledger amount: 1 Lakh = ₹1,00,000 — display as ₹4 L, ₹2.5 L, etc. */
function formatAmountLakh(amount: number): string {
  const lakhs = amount / 100_000;
  if (!Number.isFinite(lakhs)) return "—";
  if (lakhs === 0) return "₹0 L";
  const str =
    lakhs % 1 === 0
      ? String(lakhs)
      : lakhs.toFixed(2).replace(/\.?0+$/, "");
  return `₹${str} L`;
}

/** e.g. "22 March" — no time, no year */
function formatLedgerDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
    });
  } catch {
    return "—";
  }
}

function sortLedgerNewestFirst(rows: OnboardingLedgerRow[]): OnboardingLedgerRow[] {
  return [...rows].sort(
    (a, b) =>
      new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime(),
  );
}

/** Same scale as Elite Agent card names (`agent.name`) — one size for all ledger cells */
const LEDGER_ROW_TEXT =
  "text-4xl min-[900px]:text-5xl xl:text-6xl leading-none";

function ConversionLedgerRow({
  row,
  ariaHidden,
}: {
  row: OnboardingLedgerRow;
  ariaHidden?: boolean;
}) {
  return (
    <div
      className="grid grid-cols-4 items-center gap-x-2 border-b border-gold-500/[0.07] py-[clamp(14px,1.7vh,22px)] sm:gap-x-4"
      aria-hidden={ariaHidden}
    >
      <span
        className={`min-w-0 truncate px-1 text-center font-inter font-medium ${LEDGER_ROW_TEXT} text-champagne`}
      >
        {row.clientName}
      </span>
      <span
        className={`min-w-0 truncate px-1 text-center font-edu ${LEDGER_ROW_TEXT} tabular-nums text-emerald-400`}
      >
        {formatAmountLakh(row.amount)}
      </span>
      <span
        className={`min-w-0 truncate px-1 text-center font-inter font-medium ${LEDGER_ROW_TEXT} text-champagne/90`}
      >
        {formatLedgerDate(row.recordedAt)}
      </span>
      <span
        className={`min-w-0 truncate px-1 text-center font-inter font-semibold ${LEDGER_ROW_TEXT} text-champagne`}
      >
        {row.agentName}
      </span>
    </div>
  );
}

/** Maps an agent row to a preset key (handles UUID ids when display name matches). */
function agentPortraitPresetKey(
  agent: OnboardingAgentRow,
): "amit" | "samson" | "meghana" | null {
  const id = agent.id.trim().toLowerCase();
  if (id === "amit" || id === "samson" || id === "meghana") {
    return id;
  }
  const n = agent.name.trim().toLowerCase();
  if (n === "amit") return "amit";
  if (n === "samson") return "samson";
  if (n === "meghana") return "meghana";
  return null;
}

/**
 * Fallback portraits: same Dicebear avataaars SVG style as before, with fixed traits
 * so each seat reads at the intended age (Amit ~50, Samson ~25, Meghana ~30).
 */
const AVATAAARS_PRESETS: Record<
  "amit" | "samson" | "meghana",
  Record<string, string>
> = {
  amit: {
    seed: "IndulgeOnboardingAmit",
    backgroundColor: "transparent",
    facialHair: "beardMedium",
    facialHairProbability: "100",
    facialHairColor: "4a312c",
    top: "theCaesarAndSidePart",
    clothing: "blazerAndShirt",
    skinColor: "d08b5b",
    eyes: "default",
    mouth: "default",
    eyebrows: "defaultNatural",
  },
  samson: {
    seed: "IndulgeOnboardingSamson",
    backgroundColor: "transparent",
    facialHairProbability: "0",
    top: "shortWaved",
    clothing: "hoodie",
    skinColor: "ae5d29",
    eyes: "happy",
    mouth: "smile",
    eyebrows: "defaultNatural",
  },
  meghana: {
    seed: "IndulgeOnboardingMeghana",
    backgroundColor: "transparent",
    facialHairProbability: "0",
    top: "longButNotTooLong",
    clothing: "blazerAndShirt",
    skinColor: "edb98a",
    eyes: "default",
    mouth: "smile",
    eyebrows: "defaultNatural",
  },
};

function agentPortraitSrc(agent: OnboardingAgentRow): string {
  if (agent.photoUrl) return agent.photoUrl;
  const presetKey = agentPortraitPresetKey(agent);
  if (presetKey) {
    const q = new URLSearchParams(AVATAAARS_PRESETS[presetKey]);
    return `https://api.dicebear.com/7.x/avataaars/svg?${q.toString()}`;
  }
  const q = new URLSearchParams({
    seed: agent.name || agent.id,
    backgroundColor: "transparent",
  });
  return `https://api.dicebear.com/7.x/avataaars/svg?${q.toString()}`;
}

function EliteAgentCard({
  agent,
  shimmerStamp,
}: {
  agent: OnboardingAgentRow;
  shimmerStamp: number;
}) {
  return (
    <div className="relative flex h-full min-h-[min(44vh,360px)] min-w-0 w-full max-w-none flex-col">
      <div className="relative flex h-full min-h-0 w-full flex-1 flex-col overflow-visible rounded-2xl border border-gold-500/20 bg-[#0a0a0a] shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_16px_48px_rgba(0,0,0,0.5)]">
        {/* Foil: z-15 — above env + plate, below portrait (z-20) */}
        {shimmerStamp > 0 ? (
          <div
            key={shimmerStamp}
            className="card-win-shimmer rounded-2xl"
            aria-hidden
          />
        ) : null}

        {/* Top ~45% — hero environment (flex 9/20) */}
        <div className="pointer-events-none relative z-[1] min-h-0 flex-[9] overflow-hidden rounded-t-2xl">
          <div
            className="absolute inset-0 opacity-[0.35]"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E")`,
            }}
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse 85% 75% at 50% 85%, rgba(212,175,55,0.22), rgba(212,175,55,0.05) 45%, transparent 70%)",
            }}
          />
          <div
            className="absolute inset-0 bg-gradient-to-b from-[#121212] via-[#0a0a0a] to-transparent"
            style={{ opacity: 0.92 }}
          />
        </div>

        {/* Data plate — ~55% (flex 11/20); Resolved-style green for Closures */}
        <div
          className="relative z-[13] flex min-h-0 flex-[11] flex-col items-stretch text-center rounded-b-2xl border-t border-gold-400/45 glass gold-border-glow backdrop-blur-md"
          style={{
            borderTopWidth: "1px",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
            padding:
              "clamp(8px, 1.2vh, 14px) clamp(8px, 1.2vw, 16px) clamp(10px, 1.4vh, 18px)",
          }}
        >
          <div className="pointer-events-none absolute inset-0 rounded-b-2xl bg-gradient-to-br from-gold-500/[0.05] to-transparent" />

          <div className="relative flex min-h-0 w-full flex-1 flex-col justify-between gap-5 sm:gap-6">
            {/* Agent name — extra air + subtle luxe frame (hairline + soft bloom) */}
            <div className="relative w-full shrink-0 px-1 sm:px-2">
              <div className="pointer-events-none absolute left-1/2 top-1/2 h-[135%] w-[92%] max-w-[min(100%,22rem)] -translate-x-1/2 -translate-y-1/2 rounded-[50%] bg-[radial-gradient(ellipse_at_center,rgba(201,168,76,0.11),transparent_68%)]" />
              <div
                className="relative mx-auto w-full rounded-lg px-4 py-5 sm:px-7 sm:py-7 md:px-8 md:py-8"
                style={{
                  boxShadow:
                    "inset 0 0 0 1px rgba(201,168,76,0.16), inset 0 1px 0 rgba(255,255,255,0.05)",
                }}
              >
                <div className="pointer-events-none absolute inset-0 rounded-lg bg-gradient-to-b from-gold-500/[0.05] via-transparent to-gold-500/[0.03]" />
                <div className="relative space-y-5 sm:space-y-6">
                  <div className="flex w-full items-center gap-3 sm:gap-4">
                    <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gold-500/30 to-gold-500/45" />
                    <span
                      className="shrink-0 font-cinzel text-[0.55rem] leading-none text-gold-500/50 sm:text-[0.65rem]"
                      aria-hidden
                    >
                      ✦
                    </span>
                    <div className="h-px flex-1 bg-gradient-to-l from-transparent via-gold-500/30 to-gold-500/45" />
                  </div>
                  <h3 className="w-full px-0.5 font-cinzel text-4xl min-[900px]:text-5xl xl:text-6xl font-bold uppercase leading-none tracking-[0.32em] text-gold-400 queen-name-glow line-clamp-2">
                    {agent.name}
                  </h3>
                  <div className="flex w-full items-center gap-3 sm:gap-4">
                    <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gold-500/22 to-gold-500/38" />
                    <span
                      className="shrink-0 font-cinzel text-[0.55rem] leading-none text-gold-500/40 sm:text-[0.65rem]"
                      aria-hidden
                    >
                      ✦
                    </span>
                    <div className="h-px flex-1 bg-gradient-to-l from-transparent via-gold-500/22 to-gold-500/38" />
                  </div>
                </div>
              </div>
            </div>

            {/* Metric wells — label size +25% vs Queendom MetricBox */}
            <div className="grid min-h-0 w-full flex-1 grid-cols-2 items-stretch gap-2 sm:gap-3 lg:gap-4">
              <div
                className="flex min-h-0 min-w-0 flex-1 flex-col items-center justify-center rounded-xl border border-gold-500/20 bg-black/30 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
                style={{ padding: "1.2vh clamp(6px, 0.8vw, 14px)" }}
              >
                <p className="mb-[0.35vh] font-inter font-semibold text-[clamp(20px,2.125vw,28px)] uppercase tracking-[0.25em] text-champagne">
                  Attempted
                </p>
                <span className="font-edu text-7xl min-[900px]:text-8xl leading-none text-champagne tabular-nums">
                  {agent.totalAttempted}
                </span>
              </div>
              <div
                className="flex min-h-0 min-w-0 flex-1 flex-col items-center justify-center rounded-xl border border-gold-500/20 bg-black/30 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
                style={{ padding: "1.2vh clamp(6px, 0.8vw, 14px)" }}
              >
                <p className="mb-[0.35vh] font-inter font-semibold text-[clamp(20px,2.125vw,28px)] uppercase tracking-[0.25em] text-green-400">
                  Closures
                </p>
                <span className="font-edu text-7xl min-[900px]:text-8xl leading-none tabular-nums text-green-400">
                  {agent.totalConverted}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Pop-out portrait — z-20; bottom anchored to card midline; extends above card */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={agentPortraitSrc(agent)}
          alt=""
          className="pointer-events-none absolute left-1/2 z-[20] w-[88%] max-w-[min(100%,300px)] select-none object-contain object-bottom"
          style={{
            bottom: "55%",
            left: "50%",
            maxHeight: "82%",
            height: "auto",
            width: "88%",
            transform: "translate(-50%, -28px)",
            filter: "drop-shadow(0px 15px 15px rgba(0,0,0,0.6))",
            WebkitMaskImage:
              "linear-gradient(to bottom, black 0%, black 80%, transparent 100%)",
            maskImage:
              "linear-gradient(to bottom, black 0%, black 80%, transparent 100%)",
          }}
        />
      </div>
    </div>
  );
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const on = () => setReduced(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduced;
}

export default function OnboardingPanel() {
  const [agents, setAgents] = useState<OnboardingAgentRow[]>([]);
  const [ledger, setLedger] = useState<OnboardingLedgerRow[]>([]);
  const prevConvertedRef = useRef<Record<string, number>>({});
  const [shimmerStampByAgentId, setShimmerStampByAgentId] = useState<
    Record<string, number>
  >({});
  const shimmerClearRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prefersReducedMotion = usePrefersReducedMotion();

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/onboarding", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as OnboardingApiPayload;
      setAgents(
        Array.isArray(data.agents) && data.agents.length > 0
          ? data.agents.slice(0, 3)
          : FALLBACK_AGENTS,
      );
      setLedger(Array.isArray(data.ledger) ? data.ledger : []);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const id = window.setInterval(() => void load(), 10_000);
    return () => clearInterval(id);
  }, [load]);

  useEffect(() => {
    const client = supabase;
    if (!client) return;
    const ch = client
      .channel("onboarding-ledger-live")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "onboarding_ledger" },
        () => {
          void load();
        },
      )
      .subscribe();

    return () => {
      client.removeChannel(ch);
    };
  }, [load]);

  useEffect(() => {
    let winner: string | null = null;
    for (const agent of agents) {
      const prev = prevConvertedRef.current[agent.id];
      if (prev !== undefined && agent.totalConverted > prev) {
        winner = agent.id;
        break;
      }
    }
    for (const agent of agents) {
      prevConvertedRef.current[agent.id] = agent.totalConverted;
    }
    if (winner) {
      if (shimmerClearRef.current) clearTimeout(shimmerClearRef.current);
      const stamp = Date.now();
      setShimmerStampByAgentId((m) => ({
        ...m,
        [winner!]: stamp,
      }));
      shimmerClearRef.current = setTimeout(() => {
        setShimmerStampByAgentId((m) => {
          const next = { ...m };
          delete next[winner!];
          return next;
        });
        shimmerClearRef.current = null;
      }, 2100);
    }
  }, [agents]);

  const sortedLedger = useMemo(
    () => sortLedgerNewestFirst(ledger),
    [ledger],
  );

  const ledgerScrollDuration = useMemo(() => {
    const n = sortedLedger.length;
    if (n === 0) return "48s";
    return `${Math.max(32, n * 6)}s`;
  }, [sortedLedger.length]);

  const displayAgents = useMemo(() => {
    const fromApi = agents.length > 0 ? agents.slice(0, 3) : [];
    return orderAgentsForDisplay(fromApi);
  }, [agents]);

  return (
    <section
      className="relative flex w-full flex-1 flex-col overflow-y-auto overflow-x-hidden bg-obsidian min-h-[85svh] md:min-h-0"
      style={{ padding: "2vh clamp(16px, 3.5vw, 48px)" }}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 65% at 50% 38%, rgba(201,168,76,0.065), transparent)",
        }}
      />

      {/* Header — matches QueendomPanel title + subtitle rhythm */}
      <div className="relative mb-[1.8vh] flex flex-shrink-0 flex-col items-center text-center">
        <div className="mb-[0.9vh] flex w-full items-center gap-3">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gold-500/30 to-gold-500/50" />
          <div className="h-px flex-1 bg-gradient-to-l from-transparent via-gold-500/30 to-gold-500/50" />
        </div>

        <h2 className="mb-[1.1vh] font-cinzel text-5xl min-[900px]:text-6xl xl:text-7xl font-bold uppercase leading-none tracking-[0.28em] text-gold-400 queen-name-glow">
          Onboarding
        </h2>

        <div className="flex w-full items-center gap-3">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gold-500/28 to-gold-500/45" />
          <div className="h-px flex-1 bg-gradient-to-l from-transparent via-gold-500/28 to-gold-500/45" />
        </div>
      </div>

      {/* Section A — three sales cards (full-width responsive row) */}
      <div className="relative mb-[1.6vh] flex min-h-0 w-full min-w-0 flex-[3] flex-col">
        <div
          className="glass gold-border-glow relative flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-visible rounded-3xl"
          style={{
            padding:
              "clamp(1.5rem, 2.5vh, 2.25rem) clamp(18px, 3.5vw, 48px) clamp(1.25rem, 2vh, 2rem)",
          }}
        >
          <div className="pointer-events-none absolute inset-0 rounded-3xl bg-gradient-to-br from-gold-500/[0.04] to-transparent" />
          <div className="relative grid h-full min-h-0 w-full min-w-0 flex-1 grid-cols-1 auto-rows-fr items-stretch gap-6 overflow-visible pt-[clamp(4.5rem,10vh,6.5rem)] md:grid-cols-3 md:grid-rows-1 md:gap-6 lg:gap-8 xl:gap-10 2xl:gap-12">
            {displayAgents.map((agent) => (
              <EliteAgentCard
                key={agent.id}
                agent={agent}
                shimmerStamp={shimmerStampByAgentId[agent.id] ?? 0}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Section B — Ledger (matches AgentLeaderboard + glass row) */}
      <div className="relative flex min-h-0 flex-[2] flex-col">
        <div
          className="glass gold-border-glow relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl"
          style={{ padding: "2.2vh clamp(16px, 2.5vw, 40px)" }}
        >
          <div className="pointer-events-none absolute inset-0 rounded-3xl bg-gradient-to-br from-gold-500/[0.03] to-transparent" />

          <div className="relative mb-[1.8vh] flex w-full flex-shrink-0 items-center justify-center text-center">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gold-500/30 to-gold-500/50" />
            <p className="font-cinzel flex-shrink-0 px-4 text-4xl min-[900px]:text-5xl xl:text-6xl font-bold uppercase leading-none tracking-[0.28em] text-gold-400 queen-name-glow">
              Live Conversion Ledger
            </p>
            <div className="h-px flex-1 bg-gradient-to-l from-transparent via-gold-500/30 to-gold-500/50" />
          </div>

          <div className="relative border-b border-gold-500/10 pb-3 text-center">
            <div className="grid grid-cols-4 gap-x-2 sm:gap-x-4 font-inter font-semibold text-[clamp(22px,2.7vw,36px)] min-[900px]:text-[clamp(29px,3.5vw,48px)] uppercase tracking-[0.25em] text-champagne">
              <span className="min-w-0 truncate px-1 text-center">Client</span>
              <span className="min-w-0 truncate px-1 text-center">Amount (₹ L)</span>
              <span className="min-w-0 truncate px-1 text-center">Date</span>
              <span className="min-w-0 truncate px-1 text-center">Agent</span>
            </div>
          </div>

          <div className="relative min-h-0 flex-1 overflow-hidden pt-3">
            {sortedLedger.length === 0 ? (
              <p className="py-10 text-center font-inter text-[clamp(20px,2.2vw,28px)] text-gold-500/50">
                Awaiting conversions…
              </p>
            ) : (
              <div className="relative h-full min-h-[min(240px,34vh)] overflow-hidden">
                <div
                  className={
                    prefersReducedMotion
                      ? "flex flex-col text-center"
                      : "onboarding-ledger-track flex flex-col text-center"
                  }
                  style={
                    prefersReducedMotion
                      ? undefined
                      : ({
                          "--onboarding-ledger-duration": ledgerScrollDuration,
                        } as CSSProperties)
                  }
                >
                  {sortedLedger.map((row) => (
                    <ConversionLedgerRow key={row.id} row={row} />
                  ))}
                  {!prefersReducedMotion
                    ? sortedLedger.map((row) => (
                        <ConversionLedgerRow
                          key={`${row.id}-dup`}
                          row={row}
                          ariaHidden
                        />
                      ))
                    : null}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
