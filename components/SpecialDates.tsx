"use client";

/**
 * components/SpecialDates.tsx
 *
 * Client birthdays / anniversaries for one queendom (lib/specialDates.ts),
 * upcoming first, in a 2-column grid that FILLS the space the column has left
 * under the leaderboard: the number of rows is measured from the available
 * height (ResizeObserver), so a short roster shows more dates and a long one
 * fewer. No paging, no scrolling (user decision 2026-09-05): the list only
 * moves when a day passes — the midnight tick drops the passed cards and the
 * rest slide forward (AnimatePresence popLayout).
 *
 * "Today" / "passed" are IST calendar comparisons (dry-audit D7).
 */

import { useMemo, useState, useEffect, useRef, useLayoutEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Gift, Heart } from "lucide-react";
import { getSpecialDates } from "@/lib/specialDates";
import { istToday, getCurrentIstDayUtcBounds } from "@/lib/istDate";
import { fh, fw } from "@/lib/tvScale";
import type { QueendomId } from "@/types";

const COLUMNS = 2;
/** Rows shown before the first measurement / when the space is unknown. */
const DEFAULT_ROWS = 3;
/** Never show fewer than one row when there is anything to show. */
const MIN_ROWS = 1;

function parseYmd(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function formatDay(dateStr: string): string {
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit" }).format(parseYmd(dateStr));
}

function isToday(dateStr: string): boolean {
  return dateStr === istToday().day;
}

function isDatePassed(dateStr: string): boolean {
  return dateStr < istToday().day;
}

// ─── Stage-pinned sizes (handoff §B2) ─────────────────────────────────────────
const CARD_STYLE = { height: fh(130), gap: fw(24), padding: `0 ${fw(30)}` };
const DAY_STYLE = { fontSize: fw(52) };
const RULE_STYLE = { height: fh(48) };
const ICON_STYLE = { width: fw(38), height: fw(38) };
const NAME_STYLE = { fontSize: fw(44) };
const KIND_STYLE = { fontSize: fw(26), letterSpacing: "0.2em" };

interface SpecialDatesProps {
  queendomId: QueendomId;
}

export default function SpecialDates({ queendomId }: SpecialDatesProps) {
  // Tick at IST midnight so the "today" card vanishes as soon as the day ends
  // (e.g. dashboard left on overnight).
  const [dateKey, setDateKey] = useState(() => istToday().day);
  const midnightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const scheduleNextMidnight = () => {
      const { endExclusiveUtcIso } = getCurrentIstDayUtcBounds();
      const msUntilMidnight = Math.max(
        1000,
        Date.parse(endExclusiveUtcIso) - Date.now(),
      );
      return setTimeout(() => {
        setDateKey(istToday().day);
        midnightTimeoutRef.current = scheduleNextMidnight();
      }, msUntilMidnight);
    };
    midnightTimeoutRef.current = scheduleNextMidnight();
    return () => {
      if (midnightTimeoutRef.current) clearTimeout(midnightTimeoutRef.current);
    };
  }, []);

  const upcoming = useMemo(
    () =>
      getSpecialDates()
        .filter((d) => d.queendom === queendomId)
        // Passed dates are hidden; everything else (incl. next month) shows.
        .filter((d) => !isDatePassed(d.date))
        .sort((a, b) => a.date.localeCompare(b.date)),
    // dateKey re-derives the list at IST midnight.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [queendomId, dateKey],
  );

  // Fill the space: rows = how many card rows fit the container's height.
  // Measured from the first rendered card (its height is a clamp() that
  // depends on the viewport) and the container's box; re-measured on resize.
  const containerRef = useRef<HTMLDivElement>(null);
  const [rows, setRows] = useState(DEFAULT_ROWS);
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => {
      const card = el.querySelector<HTMLElement>("[data-special-date]");
      const cardH = card?.getBoundingClientRect().height ?? 0;
      const gap = parseFloat(getComputedStyle(el).rowGap) || 0;
      const avail = el.getBoundingClientRect().height;
      if (cardH <= 0 || avail <= 0) return;
      setRows(Math.max(MIN_ROWS, Math.floor((avail + gap) / (cardH + gap))));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [upcoming.length]);
  const visible = upcoming.slice(0, rows * COLUMNS);

  if (upcoming.length === 0) {
    return (
      <div className="flex w-full items-center justify-center" style={{ height: fh(130) }}>
        <span
          className="font-cinzel font-semibold uppercase tracking-[0.22em] text-champagne/40"
          style={{ fontSize: fw(34) }}
        >
          No special dates coming up
        </span>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="grid h-full w-full content-start overflow-hidden"
      style={{ gridTemplateColumns: `repeat(${COLUMNS}, minmax(0, 1fr))`, gap: `${fh(18)} ${fw(22)}` }}
      role="list"
      aria-label="Upcoming special dates"
    >
      <AnimatePresence mode="popLayout" initial={false}>
        {visible.map((item) => {
          const isTodayCard = isToday(item.date);
          const isAnniversary = item.type === "anniversary";
          const isExpired = item.isExpired === true;
          // Material lives in globals.css utilities (top-lit, rim-light).
          // Precedence: today (if not expired) → expired → anniversary → default.
          const stateClass =
            isTodayCard && !isExpired
              ? "special-date-today"
              : isExpired
                ? "special-date-expired"
                : isAnniversary
                  ? "anniversary-highlight"
                  : "special-date";
          const kind = isTodayCard ? "Today" : isAnniversary ? "Anniversary" : "Birthday";
          return (
            <motion.div
              key={item.id}
              data-special-date
              role="listitem"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.25 } }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className={`relative flex w-full min-w-0 items-center overflow-hidden rounded-xl ${stateClass}`}
              style={CARD_STYLE}
            >
              {/* Day of month — right-aligned 2ch column so the rule lines up */}
              <span
                className={`w-[2ch] flex-shrink-0 text-right font-montserrat font-bold leading-none tabular-nums ${
                  isExpired ? "text-stone-400/80" : isTodayCard ? "text-foil-gold" : "text-champagne/95"
                }`}
                style={DAY_STYLE}
              >
                {formatDay(item.date)}
              </span>
              <span className="w-px flex-shrink-0 bg-gold-500/25" style={RULE_STYLE} aria-hidden />

              <div className="flex min-w-0 flex-1 items-center" style={{ gap: fw(16) }}>
                {isTodayCard && !isExpired && (
                  <Gift className="flex-shrink-0 text-[#D4AF37]" style={ICON_STYLE} strokeWidth={1.75} aria-hidden />
                )}
                {isAnniversary && !isTodayCard && !isExpired && (
                  <Heart
                    className="flex-shrink-0 text-rose-400/90 fill-rose-400/30"
                    style={ICON_STYLE}
                    strokeWidth={1.75}
                    aria-hidden
                  />
                )}
                <span
                  className={`min-w-0 truncate font-cinzel font-semibold leading-[1.15] ${
                    isExpired ? "text-stone-400/75" : "text-champagne/90"
                  }`}
                  style={NAME_STYLE}
                >
                  {item.clientName}
                </span>
              </div>

              <span
                className="flex-shrink-0 font-cinzel font-semibold uppercase text-gold-400/70"
                style={KIND_STYLE}
              >
                {kind}
              </span>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
