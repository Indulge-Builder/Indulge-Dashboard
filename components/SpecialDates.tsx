"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Gift, Heart } from "lucide-react";
import { getSpecialDates } from "@/lib/specialDates";
import { istToday, getCurrentIstDayUtcBounds } from "@/lib/istDate";

function parseYmd(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function formatDay(dateStr: string): string {
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit" }).format(parseYmd(dateStr));
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

/** Event is in the current IST calendar month. */
function isCurrentMonth(dateStr: string): boolean {
  return dateStr.slice(0, 7) === istToday().month;
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
      .filter((d) => isCurrentMonth(d.date))
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
          // Material now lives in globals.css utilities (top-lit, rim-light).
          // Precedence matches the former inline branches: today (if not expired)
          // → expired → anniversary → default.
          const stateClass =
            isTodayCard && !isExpired
              ? "special-date-today"
              : isExpired
                ? "special-date-expired"
                : isAnniversary
                  ? "anniversary-highlight"
                  : "special-date";
          return (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.3 } }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className={`
                relative flex-shrink-0 flex w-full min-h-[clamp(70px,10cqh,160px)]
                flex-row items-center justify-between gap-[clamp(1.25rem,1.5cqw,2.75rem)]
                rounded-xl overflow-hidden px-[clamp(1.25rem,1.5cqw,2.75rem)] py-[clamp(0.875rem,1.4cqh,1.75rem)]
                ${stateClass}
              `}
            >
              <>
                <div className="flex items-center justify-center flex-shrink-0">
                  <span
                    className={`font-montserrat font-bold text-[clamp(2rem,4cqw,3.1rem)] leading-[1.1] tabular-nums ${
                      isExpired
                        ? "text-stone-400/80"
                        : isTodayCard
                          ? "text-foil-gold"
                          : "text-champagne/95"
                    }`}
                  >
                    {formatDay(item.date)}
                  </span>
                </div>
                <div
                  className={`flex flex-1 min-w-0 items-center justify-center ${
                    (isAnniversary && !isTodayCard && !isExpired) || isTodayCard
                      ? "gap-4 sm:gap-6"
                      : "gap-2"
                  }`}
                >
                  {isTodayCard && !isExpired && (
                    <Gift
                      className="flex-shrink-0 w-[clamp(2rem,3.5cqw,2.75rem)] h-[clamp(2rem,3.5cqw,2.75rem)] text-[#D4AF37]"
                      strokeWidth={1.75}
                      aria-hidden
                    />
                  )}
                  {isAnniversary && !isTodayCard && !isExpired && (
                    <Heart
                      className="flex-shrink-0 w-[clamp(2rem,3.5cqw,2.75rem)] h-[clamp(2rem,3.5cqw,2.75rem)] text-rose-400/90 fill-rose-400/30"
                      strokeWidth={1.75}
                      aria-hidden
                    />
                  )}
                  <span
                    className={`font-cinzel font-semibold text-[clamp(1.25rem,2.2cqw,2.2rem)] text-center leading-tight line-clamp-2 break-words ${
                      isExpired ? "text-stone-400/75" : "text-champagne/90"
                    }`}
                  >
                    {item.clientName}
                  </span>
                </div>
              </>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
