"use client";

/**
 * components/finance/ActiveOutlays.tsx
 *
 * Orchestration shell for the Finance widget inside each QueendomPanel.
 *
 * Responsibilities (and nothing more):
 *   - State:    outlays (DisplayOutlay[]), per-row removal timers
 *   - Fetching: initial load — pending rows for this queendom
 *   - Realtime: finance-outlays-{queendomId} channel with full cleanup on unmount
 *               Handles INSERT / UPDATE (pending → paid) / DELETE events
 *   - Derived:  totalFloating, capitalPendingDisplay, ledgerScrollDuration (useMemo)
 *   - Layout:   motion wrapper → "Finances" heading rail → scorecard + ledger
 *
 * All table rendering lives in OutlayLedger.
 * Types (QueendomId, DisplayOutlay) are the canonical copies from @/types.
 * usePrefersReducedMotion is the canonical hook from @/hooks.
 * Animation uses widgetFadeIn + gpuStyle from @/lib/motionPresets.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { motion } from "framer-motion";
import { widgetFadeIn, gpuStyle } from "@/lib/motionPresets";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import AnimatedCounter from "@/components/AnimatedCounter";
import { supabase } from "@/lib/supabase";
import type { DisplayOutlay, QueendomId } from "@/types";
import { OutlayLedger } from "./OutlayLedger";
import {
  PAID_EXIT_MS,
  MAX_OUTLAYS,
  rowToDisplay,
} from "./utils";

// ── Props ─────────────────────────────────────────────────────────────────────
interface ActiveOutlaysProps {
  queendomId:     QueendomId;
  /** Stagger with other QueendomPanel motion (optional). Milliseconds. */
  delayMs?:       number;
  /** When true, fills remaining vertical space in a flex column. */
  fillRemaining?: boolean;
}

// ── Finances heading rail (decorative gold-stem broadcast banner) ─────────────
// Kept as a private sub-component: single-use, ~50 lines, no props worth threading.
function FinancesHeadingRail() {
  const stemStyle = {
    height: "clamp(36px,5vh,56px)",
    alignSelf: "center" as const,
  };
  return (
    <div className="relative mb-[clamp(16px,2vh,26px)] w-full min-w-0 flex-shrink-0 px-[clamp(4px,1vw,12px)]">
      {/* Background rule */}
      <div
        className="pointer-events-none absolute left-[8%] right-[8%] top-1/2 h-px -translate-y-1/2 bg-gradient-to-r from-transparent via-gold-500/12 to-transparent"
        aria-hidden
      />

      <div className="relative flex min-w-0 items-stretch justify-center">
        {/* Left rule + stem */}
        <div className="flex min-w-0 flex-1 items-center">
          <div className="h-px min-w-[1rem] flex-1 bg-gradient-to-r from-transparent via-gold-500/28 to-gold-400/65" />
          <div
            className="mx-[clamp(4px,0.6vw,10px)] w-[2px] shrink-0 rounded-full bg-gradient-to-b from-gold-500/15 via-amber-400/90 to-gold-500/15 shadow-[0_0_14px_rgba(245,200,90,0.4)]"
            style={stemStyle}
            aria-hidden
          />
        </div>

        {/* Centre badge */}
        <div className="relative z-[1] flex shrink-0 flex-col items-center justify-center px-[clamp(12px,2vw,26px)] py-[clamp(8px,1vh,12px)]">
          <div
            className="absolute inset-0 -z-10 rounded-full border border-gold-500/35 bg-gradient-to-b from-gold-500/[0.14] via-black/45 to-black/55 shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_0_28px_rgba(201,168,76,0.14)]"
            aria-hidden
          />
          <p className="font-inter font-semibold text-[clamp(1.65rem,2.25vw,2.55rem)] tracking-[0.46em] uppercase text-amber-100 gold-glow text-center">
            Finances
          </p>
        </div>

        {/* Right stem + rule */}
        <div className="flex min-w-0 flex-1 items-center">
          <div
            className="mx-[clamp(4px,0.6vw,10px)] w-[2px] shrink-0 rounded-full bg-gradient-to-b from-gold-500/15 via-amber-400/90 to-gold-500/15 shadow-[0_0_14px_rgba(245,200,90,0.4)]"
            style={stemStyle}
            aria-hidden
          />
          <div className="h-px min-w-[1rem] flex-1 bg-gradient-to-l from-transparent via-gold-500/28 to-gold-400/65" />
        </div>
      </div>
    </div>
  );
}

// ── ActiveOutlays ─────────────────────────────────────────────────────────────
export default function ActiveOutlays({
  queendomId,
  delayMs       = 0,
  fillRemaining = false,
}: ActiveOutlaysProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const [outlays, setOutlays]   = useState<DisplayOutlay[]>([]);
  const removeTimersRef         = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  );

  // ── Timer helpers ─────────────────────────────────────────────────────────
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
    [clearTimer],
  );

  // Clear all pending timers on unmount
  useEffect(() => {
    return () => {
      removeTimersRef.current.forEach((t) => clearTimeout(t));
      removeTimersRef.current.clear();
    };
  }, []);

  // ── Initial fetch: pending rows for this queendom ─────────────────────────
  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;

    void (async () => {
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

  // ── Realtime: INSERT / UPDATE / DELETE on finance_outlays ─────────────────
  useEffect(() => {
    if (!supabase) return;
    const client = supabase;
    const filter  = `queendom_name=eq.${queendomId}`;

    const channel = client
      .channel(`finance-outlays-${queendomId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "finance_outlays", filter },
        (payload) => {

          // ── INSERT: add to top if pending ──────────────────────────────
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

          // ── UPDATE: paid → show emerald then exit; pending → refresh ──
          if (payload.eventType === "UPDATE" && payload.new) {
            const raw    = payload.new as Record<string, unknown>;
            const id     = String(raw.id ?? "");
            if (!id) return;
            const status = String(raw.status ?? "");

            if (status === "paid") {
              setOutlays((prev) => {
                if (!prev.some((x) => x.id === id)) return prev;
                return prev.map((x) =>
                  x.id === id ? { ...x, pending: false } : x,
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

          // ── DELETE: cancel any pending exit timer, remove immediately ──
          if (payload.eventType === "DELETE" && payload.old) {
            const oldId = String(
              (payload.old as Record<string, unknown>).id ?? "",
            );
            if (!oldId) return;
            clearTimer(oldId);
            setOutlays((prev) => prev.filter((x) => x.id !== oldId));
          }
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED")
          console.info(`[Realtime] finance_outlays (${queendomId}) active`);
      });

    return () => {
      client.removeChannel(channel);
    };
  }, [queendomId, scheduleRemove, clearTimer]);

  // ── Derived state ─────────────────────────────────────────────────────────
  const totalFloating = useMemo(
    () => outlays.reduce((sum, o) => (o.pending ? sum + o.amount : sum), 0),
    [outlays],
  );

  /** Scorecard: ≥ ₹1k → show thousands + "k" suffix; below → full rupees. */
  const capitalPendingDisplay = useMemo(() => {
    const t = totalFloating;
    if (t >= 1000) return { mode: "k" as const, value: Math.round(t / 1000) };
    return { mode: "rupees" as const, value: Math.round(t) };
  }, [totalFloating]);

  const ledgerScrollDuration = useMemo(() => {
    const n = outlays.length;
    return n === 0 ? "48s" : `${Math.max(32, n * 6)}s`;
  }, [outlays.length]);

  // ── No-Supabase guard ─────────────────────────────────────────────────────
  if (!supabase) {
    return (
      <div className="flex-shrink-0 mt-2 w-full border-t border-gold-500/15 pt-3">
        <div
          className="rounded-xl border border-gold-500/20 bg-black/30 px-3 py-2 text-center font-inter text-[clamp(1.35rem,1.725vw,1.575rem)] text-white/40"
          style={{ padding: "1.2vh clamp(6px, 0.8vw, 14px)" }}
        >
          Finances unavailable (configure Supabase env).
        </div>
      </div>
    );
  }

  // ── Layout ────────────────────────────────────────────────────────────────
  return (
    <motion.div
      className={
        fillRemaining
          ? "flex min-h-0 min-w-0 flex-1 flex-col"
          : "flex min-w-0 flex-shrink-0 flex-col"
      }
      style={gpuStyle}
      {...widgetFadeIn(delayMs)}
    >
      <div
        className={
          fillRemaining
            ? "mt-3 flex min-h-0 w-full flex-1 flex-col border-t border-gold-500/25 pt-[clamp(18px,2.4vh,32px)] shadow-[0_-12px_32px_-8px_rgba(201,168,76,0.06)]"
            : "mt-3 w-full border-t border-gold-500/25 pt-[clamp(18px,2.4vh,32px)] shadow-[0_-12px_32px_-8px_rgba(201,168,76,0.06)]"
        }
      >
        {/* Decorative "Finances" heading rail */}
        <FinancesHeadingRail />

        {/* Scorecard (left) + ledger (right) */}
        <div
          className={
            fillRemaining
              ? "flex min-h-0 w-full min-w-0 flex-1 flex-col gap-3 md:flex-row md:items-start md:gap-4"
              : "flex min-h-0 w-full min-w-0 flex-col gap-3 md:flex-row md:items-stretch md:gap-4"
          }
        >
          {/* ── Capital pending scorecard ── */}
          <div
            className={`joker-box flex w-full shrink-0 flex-col items-center justify-center rounded-xl border border-liquid-gold-end/35 text-center md:w-[clamp(200px,30%,300px)] ${
              fillRemaining ? "md:self-start" : "self-stretch"
            }`}
            style={{ padding: "1.2vh clamp(8px, 1vw, 16px)" }}
          >
            <p className="font-inter font-semibold text-[clamp(27px,3vw,39px)] tracking-[0.25em] uppercase text-amber-300 mb-[0.4vh]">
              Capital
              <br />
              pending
            </p>
            <div className="flex items-baseline justify-center gap-0.5">
              <span className="font-inter text-[clamp(2.1rem,3.375vw,3.375rem)] font-semibold text-amber-200/80">
                ₹
              </span>
              <AnimatedCounter
                value={capitalPendingDisplay.value}
                className="font-cinzel font-bold text-9xl min-[900px]:text-[9rem] leading-none tracking-[0.06em] text-amber-400 tabular-nums"
                delay={delayMs + 100}
                slideOnChange
              />
              {capitalPendingDisplay.mode === "k" && (
                <span className="font-inter text-[clamp(2.25rem,3.675vw,3.75rem)] font-semibold text-amber-300/90">
                  k
                </span>
              )}
            </div>
          </div>

          {/* ── Scrolling outlay ledger ── */}
          <div
            className={`flex min-h-0 min-w-0 flex-1 flex-col ${
              fillRemaining ? "md:self-stretch" : "md:min-h-[min(28vh,280px)]"
            }`}
          >
            <OutlayLedger
              outlays={outlays}
              scrollDuration={ledgerScrollDuration}
              prefersReducedMotion={prefersReducedMotion}
            />
          </div>
        </div>
      </div>
    </motion.div>
  );
}
