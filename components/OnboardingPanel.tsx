"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import AnimatedCounter from "./AnimatedCounter";
import { supabase } from "@/lib/supabase";
import { ONBOARDING_AGENT_CARDS } from "@/lib/onboardingAgents";
import type {
  OnboardingAgentRow,
  OnboardingApiPayload,
  OnboardingLedgerRow,
} from "@/lib/onboardingTypes";
import amitPortrait from "../onboarding-agents-images/amit-sir.png";
import meghanaPortrait from "../onboarding-agents-images/meghana.png";
import samsonPortrait from "../onboarding-agents-images/samson.png";

/** Shown when /api/onboarding fails so the TV still lists the three sales seats. */
const FALLBACK_AGENTS: OnboardingAgentRow[] = ONBOARDING_AGENT_CARDS.map((s) => ({
  id: s.id,
  name: s.name,
  photoUrl: null,
  totalAttempted: 0,
  totalConverted: 0,
  leadsAttendToday: 0,
}));

function orderAgentsForDisplay(
  fromApi: OnboardingAgentRow[],
): OnboardingAgentRow[] {
  const pool = [...fromApi];
  return ONBOARDING_AGENT_CARDS.map((spec) => {
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
    lakhs % 1 === 0 ? String(lakhs) : lakhs.toFixed(2).replace(/\.?0+$/, "");
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

function sortLedgerNewestFirst(
  rows: OnboardingLedgerRow[],
): OnboardingLedgerRow[] {
  return [...rows].sort(
    (a, b) =>
      new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime(),
  );
}

/** Max rows in the scrolling ledger (newest first; strict TV memory cap). */
const LIVE_LEDGER_MAX = 6;

/**
 * Maps a Supabase INSERT row (snake_case) to OnboardingLedgerRow.
 * Works for `onboarding_conversion_ledger` (and legacy onboarding_ledger) rows.
 */
function ledgerRowFromInsertPayload(
  raw: Record<string, unknown>,
): OnboardingLedgerRow | null {
  if (raw == null || typeof raw.id === "undefined") return null;
  const amountRaw = raw.amount;
  const amount =
    typeof amountRaw === "number"
      ? amountRaw
      : typeof amountRaw === "string"
        ? parseFloat(amountRaw)
        : NaN;
  if (!Number.isFinite(amount)) return null;
  const recordedAt =
    typeof raw.recorded_at === "string"
      ? raw.recorded_at
      : raw.recorded_at != null
        ? String(raw.recorded_at)
        : "";
  if (!recordedAt) return null;
  const q = raw.queendom_name;
  const assignedTo =
    q != null && String(q).trim() !== "" ? String(q).trim() : "";
  return {
    id: String(raw.id),
    clientName:
      typeof raw.client_name === "string" ? raw.client_name : String(raw.client_name ?? ""),
    amount,
    recordedAt,
    assignedTo,
    agentName:
      typeof raw.agent_name === "string"
        ? raw.agent_name
        : String(raw.agent_name ?? ""),
  };
}

/**
 * Fluid typography — middle term uses min(vmin,vh) so zoom + TV + ultrawide scale smoothly
 * (avoids vw-only or breakpoint jumps).
 */
const ONBOARDING_CARD_TITLE_FONT =
  "clamp(1.15rem, min(2.85vmin, 3.3vh), 3.85rem)";

const ONBOARDING_AGENT_NAME_FONT =
  "clamp(1.5rem, min(3.85vmin, 4.4vh), 5.25rem)";

const ONBOARDING_METRIC_VALUE_FONT =
  "clamp(1.5rem, min(4.4vmin, 5.2vh), 5.75rem)";

/** Attempted (This Month) / Closures (Last 30 Days) / Leads (Today) subtitles */
const ONBOARDING_METRIC_SUBTITLE_FONT =
  "clamp(1.25rem, min(3.5vmin, 3.95vh), 2.45rem)";

const ONBOARDING_METRIC_SUBTITLE_CLASS =
  "font-inter font-semibold uppercase leading-snug tracking-[0.22em]";

/** Page + ledger headings */
const ONBOARDING_PAGE_TITLE_FONT =
  "clamp(2rem, min(4.6vmin, 5.9vh), 4.4rem)";

const ONBOARDING_LEDGER_TITLE_FONT =
  "clamp(1.65rem, min(3.85vmin, 4.9vh), 3.85rem)";

const ONBOARDING_LEDGER_HEADER_FONT =
  "clamp(1.05rem, min(2.35vmin, 2.85vh), 2.05rem)";

const ONBOARDING_LEDGER_CELL_FONT =
  "clamp(1.15rem, min(2.65vmin, 3.25vh), 3.5rem)";

function ConversionLedgerRow({
  row,
  ariaHidden,
}: {
  row: OnboardingLedgerRow;
  ariaHidden?: boolean;
}) {
  const cell = { fontSize: ONBOARDING_LEDGER_CELL_FONT } as CSSProperties;
  return (
    <div
      className="grid grid-cols-4 items-center gap-x-1 border-b border-gold-500/[0.07] py-[clamp(10px,min(1.6vmin,1.8vh),22px)] sm:gap-x-2 md:gap-x-4"
      aria-hidden={ariaHidden}
    >
      <span
        className="min-w-0 truncate px-1 text-center font-inter font-medium leading-none text-champagne"
        style={cell}
      >
        {row.clientName}
      </span>
      <span
        className="min-w-0 truncate px-1 text-center font-edu tabular-nums leading-none text-emerald-400"
        style={cell}
      >
        {formatAmountLakh(row.amount)}
      </span>
      <span
        className="min-w-0 truncate px-1 text-center font-inter font-medium leading-none text-champagne/90"
        style={cell}
      >
        {formatLedgerDate(row.recordedAt)}
      </span>
      <span
        className="min-w-0 truncate px-1 text-center font-inter font-semibold leading-none text-champagne"
        style={cell}
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

function bundledImageSrc(
  img: string | { src: string },
): string {
  return typeof img === "string" ? img : img.src;
}

const LOCAL_ONBOARDING_PORTRAITS: Record<
  "amit" | "samson" | "meghana",
  string
> = {
  amit: bundledImageSrc(amitPortrait),
  samson: bundledImageSrc(samsonPortrait),
  meghana: bundledImageSrc(meghanaPortrait),
};

function agentPortraitSrc(agent: OnboardingAgentRow): string {
  if (agent.photoUrl) return agent.photoUrl;
  const presetKey = agentPortraitPresetKey(agent);
  if (presetKey) {
    return LOCAL_ONBOARDING_PORTRAITS[presetKey];
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
  prefersReducedMotion,
  metricStaggerBase,
}: {
  agent: OnboardingAgentRow;
  shimmerStamp: number;
  prefersReducedMotion: boolean;
  metricStaggerBase: number;
}) {
  const slide = !prefersReducedMotion;
  const d0 = metricStaggerBase;
  const d1 = metricStaggerBase + 140;
  const d2 = metricStaggerBase + 280;
  return (
    <div className="relative flex h-full min-h-0 w-full min-w-0 max-w-none flex-col">
      {/* Full-art TCG: height follows flex grid (TV / large screens); portrait fills cell */}
      <div className="relative flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden rounded-2xl border-2 border-gold-500/35 bg-[#0a0a0a] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_22px_56px_rgba(0,0,0,0.55)]">
        {shimmerStamp > 0 ? (
          <div
            key={shimmerStamp}
            className="card-win-shimmer rounded-2xl"
            aria-hidden
          />
        ) : null}

        {/* Portrait art — only this region; ends where the title strip begins */}
        <div className="relative z-0 min-h-0 flex-1 overflow-hidden bg-[#0a0a0a]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={agentPortraitSrc(agent)}
            alt=""
            className="absolute inset-0 h-full w-full scale-[1.02] select-none object-cover object-[50%_22%]"
          />
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.06]"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E")`,
            }}
          />
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse 85% 55% at 50% 28%, rgba(212,175,55,0.08), transparent 50%)",
            }}
          />
          <div
            className="pointer-events-none absolute rounded-lg ring-1 ring-gold-400/35 ring-inset sm:rounded-[0.85rem]"
            style={{
              inset: "clamp(4px, min(0.65vmin, 0.8vh), 12px)",
            }}
          />
        </div>

        {/* Title + stats — solid panel below the image (no photo behind the name) */}
        <div
          className="relative z-10 shrink-0 border-t border-gold-500/25 bg-[#0a0a0a]"
          style={{
            padding:
              "clamp(0.45rem, min(1.1vmin, 1.4vh), 1.25rem) clamp(0.4rem, min(1vmin, 1.2vh), 1rem)",
          }}
        >
          <div
            className="flex w-full flex-col"
            style={{ gap: "clamp(0.35rem, min(0.9vmin, 1.1vh), 0.9rem)" }}
          >
            <div className="rounded-lg border border-gold-500/35 bg-black/45 px-[clamp(0.35rem,1vmin,0.65rem)] py-[clamp(0.35rem,0.9vmin,0.65rem)] text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-md">
              <h3
                className="font-cinzel font-bold uppercase leading-none tracking-[0.24em] text-gold-300 queen-name-glow line-clamp-2"
                style={{
                  fontSize: ONBOARDING_AGENT_NAME_FONT,
                }}
              >
                {agent.name}
              </h3>
            </div>

            <div className="grid w-full grid-cols-3 items-stretch gap-[clamp(4px,0.85vmin,12px)]">
              <div
                className="flex min-h-0 min-w-0 flex-col items-center justify-center rounded-lg border border-gold-500/25 bg-black/50 py-[clamp(6px,1vmin,14px)] text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-sm"
                style={{ paddingLeft: "clamp(6px, 0.8vw, 14px)", paddingRight: "clamp(6px, 0.8vw, 14px)" }}
              >
                <div className="mb-[clamp(4px,0.6vmin,10px)] flex min-w-0 flex-col items-center gap-[0.15em]">
                  <p
                    className="font-cinzel font-bold uppercase leading-none tracking-[0.22em] text-champagne"
                    style={{
                      fontSize: ONBOARDING_CARD_TITLE_FONT,
                    }}
                  >
                    Attempted
                  </p>
                  <p
                    className={`text-champagne/80 ${ONBOARDING_METRIC_SUBTITLE_CLASS}`}
                    style={{ fontSize: ONBOARDING_METRIC_SUBTITLE_FONT }}
                  >
                    (This Month)
                  </p>
                </div>
                <span
                  className="inline-block leading-none"
                  style={{ fontSize: ONBOARDING_METRIC_VALUE_FONT }}
                >
                  <AnimatedCounter
                    value={agent.totalAttempted}
                    delay={d0}
                    slideOnChange={slide}
                    className="font-edu leading-none text-champagne tabular-nums"
                  />
                </span>
              </div>
              <div
                className="flex min-h-0 min-w-0 flex-col items-center justify-center rounded-lg border border-gold-500/25 bg-black/50 py-[clamp(6px,1vmin,14px)] text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-sm"
                style={{ paddingLeft: "clamp(6px, 0.8vw, 14px)", paddingRight: "clamp(6px, 0.8vw, 14px)" }}
              >
                <div className="mb-[clamp(4px,0.6vmin,10px)] flex min-w-0 flex-col items-center gap-[0.15em]">
                  <p
                    className="font-cinzel font-bold uppercase leading-none tracking-[0.22em] text-green-400"
                    style={{
                      fontSize: ONBOARDING_CARD_TITLE_FONT,
                    }}
                  >
                    Closures
                  </p>
                  <p
                    className={`text-green-400/90 ${ONBOARDING_METRIC_SUBTITLE_CLASS}`}
                    style={{ fontSize: ONBOARDING_METRIC_SUBTITLE_FONT }}
                  >
                    (Last 30 Days)
                  </p>
                </div>
                <span
                  className="inline-block leading-none"
                  style={{ fontSize: ONBOARDING_METRIC_VALUE_FONT }}
                >
                  <AnimatedCounter
                    value={agent.totalConverted}
                    delay={d1}
                    slideOnChange={slide}
                    className="font-edu leading-none tabular-nums text-green-400"
                  />
                </span>
              </div>
              <div
                className="flex min-h-0 min-w-0 flex-col items-center justify-center rounded-lg border border-gold-500/25 bg-black/50 py-[clamp(6px,1vmin,14px)] text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-sm"
                style={{ paddingLeft: "clamp(4px, 0.6vw, 10px)", paddingRight: "clamp(4px, 0.6vw, 10px)" }}
              >
                <div className="mb-[clamp(4px,0.6vmin,10px)] flex min-w-0 flex-col items-center gap-[0.15em]">
                  <p
                    className="font-cinzel font-bold uppercase leading-none tracking-[0.22em] text-sky-300"
                    style={{
                      fontSize: ONBOARDING_CARD_TITLE_FONT,
                    }}
                  >
                    Leads
                  </p>
                  <p
                    className={`text-sky-200 ${ONBOARDING_METRIC_SUBTITLE_CLASS}`}
                    style={{ fontSize: ONBOARDING_METRIC_SUBTITLE_FONT }}
                  >
                    (Today)
                  </p>
                </div>
                <span
                  className="inline-block leading-none"
                  style={{ fontSize: ONBOARDING_METRIC_VALUE_FONT }}
                >
                  <AnimatedCounter
                    value={agent.leadsAttendToday}
                    delay={d2}
                    slideOnChange={slide}
                    className="font-edu leading-none tabular-nums text-sky-200"
                  />
                </span>
              </div>
            </div>
          </div>
        </div>
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
      const raw = Array.isArray(data.ledger) ? data.ledger : [];
      setLedger(sortLedgerNewestFirst(raw).slice(0, LIVE_LEDGER_MAX));
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const client = supabase;
    if (!client) return;

    const ch = client
      .channel("onboarding-conversion-ledger-live")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "onboarding_conversion_ledger",
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const raw = payload.new as Record<string, unknown> | null;
            if (!raw) return;
            const row = ledgerRowFromInsertPayload(raw);
            if (!row) return;

            setLedger((prev) => {
              const withoutDup = prev.filter((r) => r.id !== row.id);
              const merged = sortLedgerNewestFirst([row, ...withoutDup]);
              return merged.slice(0, LIVE_LEDGER_MAX);
            });
          }

          void load();
        },
      )
      .subscribe();

    return () => {
      client.removeChannel(ch);
    };
  }, [load]);

  useEffect(() => {
    const client = supabase;
    if (!client) return;

    const ch = client
      .channel("onboarding-lead-touches-live")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "onboarding_lead_touches",
        },
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

  const sortedLedger = useMemo(() => sortLedgerNewestFirst(ledger), [ledger]);

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
      className="relative flex h-full min-h-0 w-full flex-1 flex-col overflow-x-hidden overflow-y-auto bg-obsidian md:overflow-y-hidden"
      style={{
        padding:
          "clamp(0.75rem, min(2vh, 2.5vmin), 2rem) clamp(0.75rem, min(3vmin, 4vw), 3rem)",
      }}
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

        <h2
          className="mb-[1.1vh] font-cinzel font-bold uppercase leading-none tracking-[0.28em] text-gold-400 queen-name-glow"
          style={{ fontSize: ONBOARDING_PAGE_TITLE_FONT }}
        >
          Onboarding
        </h2>

        <div className="flex w-full items-center gap-3">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gold-500/28 to-gold-500/45" />
          <div className="h-px flex-1 bg-gradient-to-l from-transparent via-gold-500/28 to-gold-500/45" />
        </div>
      </div>

      {/* Section A — cards share ~3/5 of main column height with ledger (flex-[2]) */}
      <div className="relative mb-[1.6vh] flex min-h-0 w-full min-w-0 flex-[3] flex-col">
        <div
          className="glass gold-border-glow relative flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden rounded-3xl"
          style={{
            padding:
              "clamp(0.65rem, min(1.6vh, 1.8vmin), 1.75rem) clamp(0.65rem, min(2.8vmin, 3.8vw), 3rem) clamp(0.65rem, min(1.5vh, 1.7vmin), 1.75rem)",
          }}
        >
          <div className="pointer-events-none absolute inset-0 rounded-3xl bg-gradient-to-br from-gold-500/[0.04] to-transparent" />
          <div className="relative grid h-full min-h-0 min-w-0 flex-1 auto-rows-fr grid-cols-1 items-stretch justify-items-stretch gap-[clamp(0.65rem,min(1.4vmin,1.8vh),2rem)] overflow-hidden pt-0 max-md:min-h-[min(34vmin,46svh)] md:grid-cols-3">
            {displayAgents.map((agent, cardIdx) => (
              <EliteAgentCard
                key={agent.id}
                agent={agent}
                shimmerStamp={shimmerStampByAgentId[agent.id] ?? 0}
                prefersReducedMotion={prefersReducedMotion}
                metricStaggerBase={cardIdx * 180}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Section B — Ledger (matches AgentLeaderboard + glass row) */}
      <div className="relative flex min-h-0 flex-[2] flex-col">
        <div
          className="glass gold-border-glow relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl"
          style={{
            padding:
              "clamp(0.85rem, min(2.1vh, 2.4vmin), 2rem) clamp(0.75rem, min(2.5vmin, 3.2vw), 2.5rem)",
          }}
        >
          <div className="pointer-events-none absolute inset-0 rounded-3xl bg-gradient-to-br from-gold-500/[0.03] to-transparent" />

          <div className="relative mb-[1.8vh] flex w-full flex-shrink-0 items-center justify-center text-center">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gold-500/30 to-gold-500/50" />
            <p
              className="font-cinzel flex-shrink-0 px-[clamp(0.5rem,2vmin,1.5rem)] font-bold uppercase leading-none tracking-[0.28em] text-gold-400 queen-name-glow"
              style={{ fontSize: ONBOARDING_LEDGER_TITLE_FONT }}
            >
              Live Conversion Ledger
            </p>
            <div className="h-px flex-1 bg-gradient-to-l from-transparent via-gold-500/30 to-gold-500/50" />
          </div>

          <div className="relative border-b border-gold-500/10 pb-3 text-center">
            <div
              className="grid grid-cols-4 gap-x-1 font-inter font-semibold uppercase tracking-[0.2em] text-champagne sm:gap-x-2 md:gap-x-4"
              style={{ fontSize: ONBOARDING_LEDGER_HEADER_FONT }}
            >
              <span className="min-w-0 truncate px-1 text-center">Client</span>
              <span className="min-w-0 truncate px-1 text-center">
                Amount
              </span>
              <span className="min-w-0 truncate px-1 text-center">Date</span>
              <span className="min-w-0 truncate px-1 text-center">Agent</span>
            </div>
          </div>

          <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden pt-3">
            {sortedLedger.length === 0 ? (
              <p
                className="py-10 text-center font-inter text-gold-500/50"
                style={{ fontSize: ONBOARDING_LEDGER_CELL_FONT }}
              >
                Awaiting conversions…
              </p>
            ) : (
              <div className="relative min-h-0 flex-1 overflow-hidden">
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
