"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { motion } from "framer-motion";
import AnimatedCounter from "./AnimatedCounter";
import { supabase } from "@/lib/supabase";

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

export type QueendomId = "ananyshree" | "anishqa";

type DisplayOutlay = {
  id: string;
  client_name: string;
  task: string;
  amount: number;
  /** When false, row is paid — show emerald success, then exit after delay */
  pending: boolean;
};

function parseAmount(raw: unknown): number {
  if (typeof raw === "number" && !Number.isNaN(raw)) return raw;
  if (typeof raw === "string") {
    const n = Number.parseFloat(raw);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function rowToDisplay(
  raw: Record<string, unknown>,
  pending: boolean
): DisplayOutlay | null {
  const id = raw.id != null ? String(raw.id) : "";
  if (!id) return null;
  return {
    id,
    client_name: String(raw.client_name ?? "").trim() || "—",
    task: String(raw.task ?? "").trim() || "—",
    amount: parseAmount(raw.amount),
    pending,
  };
}

const PAID_EXIT_MS = 2500;

/** Bound in-memory list so long TV uptimes do not grow unbounded. */
const MAX_OUTLAYS = 10;

/** Match JokerMetricsStrip `JokerMetricBox` label — Ideas / Response / Acceptance */
const FINANCES_LEDGER_HEADER_LABEL_CLASS =
  "font-inter font-semibold text-[clamp(18px,2vw,26px)] tracking-[0.25em] uppercase text-champagne leading-none";

/** Match OnboardingPanel `ONBOARDING_LEDGER_CELL_FONT` — ledger rows */
const FINANCES_LEDGER_CELL_FONT =
  "clamp(1.15rem, min(2.65vmin, 3.25vh), 3.5rem)";

function OutlayLedgerRow({
  o,
  ariaHidden,
}: {
  o: DisplayOutlay;
  ariaHidden?: boolean;
}) {
  const cell = { fontSize: FINANCES_LEDGER_CELL_FONT } as CSSProperties;
  return (
    <div
      className={`grid min-w-0 grid-cols-3 items-center gap-x-2 border-b border-gold-500/[0.07] py-[clamp(8px,min(1.4vmin,1.5vh),18px)] sm:gap-x-3 ${
        o.pending ? "" : "bg-emerald-500/[0.08]"
      }`}
      aria-hidden={ariaHidden}
    >
      <span
        className="min-w-0 justify-self-center truncate px-1 text-center font-inter font-semibold uppercase leading-none tracking-[0.1em] text-champagne"
        style={cell}
      >
        {o.client_name}
      </span>
      <span
        className="min-w-0 justify-self-center truncate px-1 text-center font-inter font-medium leading-none text-champagne/90"
        style={cell}
      >
        {o.task}
      </span>
      <span
        className={`min-w-0 justify-self-center truncate px-1 text-center font-cinzel font-semibold tabular-nums leading-none ${
          o.pending ? "text-amber-300" : "text-emerald-300"
        }`}
        style={cell}
      >
        ₹
        {o.amount.toLocaleString("en-IN", {
          minimumFractionDigits: 0,
          maximumFractionDigits: 2,
        })}
      </span>
    </div>
  );
}

interface ActiveOutlaysProps {
  queendomId: QueendomId;
  /** Stagger with other QueendomPanel motion (optional) */
  delayMs?: number;
  /** When true, fills remaining vertical space in a flex column. */
  fillRemaining?: boolean;
}

export default function ActiveOutlays({
  queendomId,
  delayMs = 0,
  fillRemaining = false,
}: ActiveOutlaysProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const [outlays, setOutlays] = useState<DisplayOutlay[]>([]);
  const removeTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map()
  );

  const clearTimer = useCallback((id: string) => {
    const t = removeTimersRef.current.get(id);
    if (t != null) {
      clearTimeout(t);
      removeTimersRef.current.delete(id);
    }
  }, []);

  const scheduleRemove = useCallback(
    (id: string) => {
      clearTimer(id);
      const t = setTimeout(() => {
        removeTimersRef.current.delete(id);
        setOutlays((prev) => prev.filter((x) => x.id !== id));
      }, PAID_EXIT_MS);
      removeTimersRef.current.set(id, t);
    },
    [clearTimer]
  );

  useEffect(() => {
    return () => {
      removeTimersRef.current.forEach((t) => clearTimeout(t));
      removeTimersRef.current.clear();
    };
  }, []);

  // Initial fetch: pending rows for this queendom
  useEffect(() => {
    if (!supabase) return;

    let cancelled = false;

    (async () => {
      const { data, error } = await supabase
        .from("finance_outlays")
        .select("*")
        .eq("queendom_name", queendomId)
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (cancelled || error) {
        if (error) console.error("[ActiveOutlays] initial fetch:", error);
        return;
      }

      const rows: DisplayOutlay[] = [];
      for (const raw of data ?? []) {
        const d = rowToDisplay(raw as Record<string, unknown>, true);
        if (d) rows.push(d);
      }
      setOutlays(rows.slice(0, MAX_OUTLAYS));
    })();

    return () => {
      cancelled = true;
    };
  }, [queendomId]);

  // Realtime: INSERT / UPDATE / DELETE on finance_outlays
  useEffect(() => {
    if (!supabase) return;
    const client = supabase;

    const filter = `queendom_name=eq.${queendomId}`;
    const channel = client
      .channel(`finance-outlays-${queendomId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "finance_outlays",
          filter,
        },
        (payload) => {
          if (payload.eventType === "INSERT" && payload.new) {
            const raw = payload.new as Record<string, unknown>;
            if (String(raw.status ?? "") !== "pending") return;
            const d = rowToDisplay(raw, true);
            if (!d) return;
            setOutlays((prev) => {
              if (prev.some((x) => x.id === d.id)) return prev;
              return [d, ...prev].slice(0, MAX_OUTLAYS);
            });
            return;
          }

          if (payload.eventType === "UPDATE" && payload.new) {
            const raw = payload.new as Record<string, unknown>;
            const id = String(raw.id ?? "");
            if (!id) return;
            const status = String(raw.status ?? "");

            if (status === "paid") {
              setOutlays((prev) => {
                if (!prev.some((x) => x.id === id)) return prev;
                return prev.map((x) =>
                  x.id === id ? { ...x, pending: false } : x
                );
              });
              scheduleRemove(id);
              return;
            }

            if (status === "pending") {
              const d = rowToDisplay(raw, true);
              if (!d) return;
              setOutlays((prev) => {
                const i = prev.findIndex((x) => x.id === id);
                if (i < 0) return [d, ...prev].slice(0, MAX_OUTLAYS);
                const next = [...prev];
                next[i] = { ...d, pending: prev[i].pending };
                return next;
              });
            }
            return;
          }

          if (payload.eventType === "DELETE" && payload.old) {
            const oldId = String(
              (payload.old as Record<string, unknown>).id ?? ""
            );
            if (!oldId) return;
            clearTimer(oldId);
            setOutlays((prev) => prev.filter((x) => x.id !== oldId));
          }
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED")
          console.info(`[Realtime] finance_outlays (${queendomId}) active`);
      });

    return () => {
      client.removeChannel(channel);
    };
  }, [queendomId, scheduleRemove, clearTimer]);

  const totalFloating = useMemo(
    () =>
      outlays.reduce((sum, o) => (o.pending ? sum + o.amount : sum), 0),
    [outlays]
  );

  /** Scorecard: ≥ ₹1k → animate thousands + “k”; below → full rupees */
  const capitalPendingDisplay = useMemo(() => {
    const t = totalFloating;
    if (t >= 1000) {
      return {
        mode: "k" as const,
        value: Math.round(t / 1000),
      };
    }
    return {
      mode: "rupees" as const,
      value: Math.round(t),
    };
  }, [totalFloating]);

  const ledgerScrollDuration = useMemo(() => {
    const n = outlays.length;
    if (n === 0) return "48s";
    return `${Math.max(32, n * 6)}s`;
  }, [outlays.length]);

  if (!supabase) {
    return (
      <div className="flex-shrink-0 mt-2 w-full border-t border-gold-500/15 pt-3">
        <div
          className="rounded-xl border border-gold-500/20 bg-black/30 px-3 py-2 text-center font-inter text-[clamp(0.9rem,1.15vw,1.05rem)] text-white/40"
          style={{ padding: "1.2vh clamp(6px, 0.8vw, 14px)" }}
        >
          Finances unavailable (configure Supabase env).
        </div>
      </div>
    );
  }

  /** Same section title as JokerMetricsStrip compact + QueendomPanel “Special Dates” */
  const sectionTitleClass =
    "font-inter font-semibold text-[clamp(1.05rem,1.4vw,1.6rem)] tracking-[0.4em] uppercase text-champagne";

  const metricLabelClass =
    "font-inter font-semibold text-[clamp(16px,1.75vw,23px)] tracking-[0.22em] uppercase text-amber-300 mb-[0.4vh]";

  const floatingValueClass =
    "font-cinzel font-bold text-8xl min-[900px]:text-9xl leading-none tracking-[0.06em] text-amber-400 tabular-nums";

  const suffixClass =
    "font-inter text-[clamp(1.5rem,2.45vw,2.5rem)] font-semibold text-amber-300/90";

  return (
    <motion.div
      className={
        fillRemaining
          ? "flex min-h-0 min-w-0 flex-1 flex-col"
          : "flex min-w-0 flex-shrink-0 flex-col"
      }
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: delayMs / 1000, duration: 0.5 }}
    >
      <div
        className={
          fillRemaining
            ? "mt-2 flex min-h-0 w-full flex-1 flex-col border-t border-gold-500/15 pt-3"
            : "mt-2 w-full border-t border-gold-500/15 pt-3"
        }
      >
        {/* Luxury section rail — matches QueendomPanel “Special Dates” / wingspan dividers */}
        <div className="relative mb-[1.4vh] flex w-full min-w-0 flex-shrink-0 items-center gap-3">
          <div className="h-px min-w-0 flex-1 bg-gradient-to-r from-transparent via-gold-500/30 to-gold-500/48" />
          <p className={`${sectionTitleClass} flex-shrink-0 px-[clamp(6px,1.2vw,14px)] text-center`}>
            Finances
          </p>
          <div className="h-px min-w-0 flex-1 bg-gradient-to-l from-transparent via-gold-500/30 to-gold-500/48" />
        </div>

        <div
          className={
            fillRemaining
              ? "flex min-h-0 w-full min-w-0 flex-1 flex-col gap-3 md:flex-row md:items-start md:gap-4"
              : "flex min-h-0 w-full min-w-0 flex-col gap-3 md:flex-row md:items-stretch md:gap-4"
          }
        >
          {/* Left on desktop — scorecard: capital pending (₹ in thousands + k) */}
          <div
            className={`joker-box flex w-full shrink-0 flex-col items-center justify-center rounded-xl border border-liquid-gold-end/35 text-center md:w-[clamp(168px,26%,240px)] ${
              fillRemaining ? "md:self-start" : "self-stretch"
            }`}
            style={{ padding: "1.2vh clamp(8px, 1vw, 16px)" }}
          >
            <p className={metricLabelClass}>
              Capital
              <br />
              pending
            </p>
            <div className="flex items-baseline justify-center gap-0.5">
              <span className="font-inter text-[clamp(1.2rem,2vw,1.95rem)] font-semibold text-amber-200/80">
                ₹
              </span>
              <AnimatedCounter
                value={capitalPendingDisplay.value}
                className={floatingValueClass}
                delay={delayMs + 100}
                slideOnChange
              />
              {capitalPendingDisplay.mode === "k" ? (
                <span className={suffixClass}>k</span>
              ) : null}
            </div>
          </div>

          {/* Right on desktop — vertical marquee ledger (OnboardingPanel pattern) */}
          <div
            className={`flex min-h-0 min-w-0 flex-1 flex-col ${
              fillRemaining ? "md:self-stretch" : "md:min-h-[min(28vh,280px)]"
            }`}
          >
            <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-gold-500/20 bg-black/25 shadow-[0_0_0_1px_rgba(201,168,76,0.06)]">
              <div className="relative border-b border-gold-500/15 bg-gradient-to-b from-gold-500/[0.06] to-transparent px-2 py-3">
                <div
                  className={`grid grid-cols-3 items-center gap-x-1 sm:gap-x-2 md:gap-x-4 ${FINANCES_LEDGER_HEADER_LABEL_CLASS}`}
                >
                  <span className="min-w-0 justify-self-center truncate px-1 text-center">
                    Client
                  </span>
                  <span className="min-w-0 justify-self-center truncate px-1 text-center">
                    Task
                  </span>
                  <span className="min-w-0 justify-self-center truncate px-1 text-center">
                    Amount
                  </span>
                </div>
              </div>

              <div className="relative min-h-0 flex-1 overflow-hidden">
                {outlays.length === 0 ? (
                  <p className="py-8 text-center font-inter text-[clamp(16px,1.6vw,19px)] text-champagne/40">
                    No pending items
                  </p>
                ) : (
                  <div
                    className={
                      prefersReducedMotion
                        ? "flex flex-col"
                        : "onboarding-ledger-track flex flex-col"
                    }
                    style={
                      prefersReducedMotion
                        ? undefined
                        : ({
                            "--onboarding-ledger-duration":
                              ledgerScrollDuration,
                          } as CSSProperties)
                    }
                  >
                    {outlays.map((o) => (
                      <OutlayLedgerRow key={o.id} o={o} />
                    ))}
                    {!prefersReducedMotion
                      ? outlays.map((o) => (
                          <OutlayLedgerRow
                            key={`${o.id}-dup`}
                            o={o}
                            ariaHidden
                          />
                        ))
                      : null}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
