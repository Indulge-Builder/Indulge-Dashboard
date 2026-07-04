"use client";

import { useMemo, useState, useEffect, useRef, type CSSProperties } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getSpecialDates } from "@/lib/specialDates";
import { istToday, getCurrentIstDayUtcBounds } from "@/lib/istDate";

function parseYmd(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function formatDay(dateStr: string): string {
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit" }).format(parseYmd(dateStr));
}

function formatMonthAbbrev(dateStr: string): string {
  return new Intl.DateTimeFormat("en-GB", { month: "short" })
    .format(parseYmd(dateStr))
    .toUpperCase();
}

// "Today" / "passed" / "this month" are IST calendar comparisons (dry-audit
// D7) — date strings are YYYY-MM-DD so lexicographic compare is correct.
// Identical output on the IST TV box; a UTC kiosk no longer shifts the day.

function isToday(dateStr: string): boolean {
  return dateStr === istToday().day;
}

function isDatePassed(dateStr: string): boolean {
  return dateStr < istToday().day;
}

interface SpecialDatesProps {
  queendomId: "ananyshree" | "anishqa";
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

  const filteredDates = useMemo(() => {
    return getSpecialDates()
      .filter((d) => d.queendom === queendomId)
      // Month gate removed: show all upcoming dates (incl. next month's July
      // list) while we're still in June. Passed dates are still hidden.
      .filter((d) => !isDatePassed(d.date))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [queendomId, dateKey]);

  return (
    <div className="flex h-full min-h-0 w-full flex-col gap-[var(--gap-list)] overflow-y-auto pb-3 pt-0.5">
      <AnimatePresence mode="popLayout">
        {filteredDates.map((item) => {
          const isTodayCard = isToday(item.date);
          const isAnniversary = item.type === "anniversary";
          const isExpired = item.isExpired === true;

          // Plain rows (washes removed 2026-07-04 request): the raised leaf
          // tile + type glyph carry the row; only TODAY gets a raised surface
          // with an accent border so it still pops.
          const rowStyle: CSSProperties =
            isTodayCard && !isExpired
              ? {
                  background: "var(--neu-surface)",
                  border:
                    "1px solid color-mix(in srgb, var(--neu-accent-deep) 35%, transparent)",
                  boxShadow: "var(--neu-shadow-raised)",
                }
              : {
                  background: "transparent",
                  border: "1px solid transparent",
                  boxShadow: "none",
                };

          return (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.3 } }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className="relative flex-shrink-0 flex w-full min-h-[clamp(70px,10cqh,160px)] flex-row items-center gap-[clamp(1rem,1.4cqw,2.5rem)] rounded-neu-chip overflow-hidden px-[clamp(1rem,1.4cqw,2.5rem)] py-[clamp(0.875rem,1.4cqh,1.75rem)]"
              style={rowStyle}
            >
              {/* Calendar leaf — raised month-over-day tile */}
              <div
                className={`flex flex-col items-center justify-center flex-shrink-0 neu-raised-sm rounded-neu-chip px-[clamp(0.6rem,0.8cqw,1.4rem)] py-[clamp(0.35rem,0.6cqh,0.9rem)] ${
                  isExpired ? "opacity-60" : ""
                }`}
              >
                <span className="font-montserrat font-bold uppercase tracking-[0.26em] leading-none text-[clamp(0.85rem,1.1cqw,1.5rem)] text-neu-t3 ml-[0.26em]">
                  {formatMonthAbbrev(item.date)}
                </span>
                <span
                  className={`font-montserrat font-extrabold text-[clamp(2rem,4cqw,3.1rem)] leading-[1.1] tabular-nums ${
                    isExpired ? "text-neu-t3" : "text-neu-t1"
                  }`}
                >
                  {formatDay(item.date)}
                </span>
              </div>

              {/* Client name */}
              <span
                className={`flex-1 min-w-0 font-cinzel font-semibold text-[clamp(1.9rem,3.1cqw,3.9rem)] text-center leading-tight line-clamp-2 break-words ${
                  isExpired ? "text-neu-t3" : "text-neu-t1"
                }`}
              >
                {item.clientName}
              </span>

              {/* Type glyph at row end — ✦ birthday · ♥ anniversary */}
              <span
                className="flex-shrink-0 leading-none neu-letterpress text-[clamp(1.8rem,2.6cqw,3rem)]"
                style={{
                  color: isExpired
                    ? "var(--neu-text-tertiary)"
                    : isAnniversary
                      ? "var(--neu-danger-deep)"
                      : "var(--neu-butter-deep)",
                }}
                aria-label={isAnniversary ? "Anniversary" : "Birthday"}
              >
                {isAnniversary ? "♥" : "✦"}
              </span>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
