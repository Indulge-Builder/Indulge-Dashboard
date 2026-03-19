"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Gift, Heart } from "lucide-react";
import { getSpecialDates } from "@/lib/specialDates";

function formatDay(dateStr: string): string {
  const [, , day] = dateStr.split("-");
  return day;
}

function isToday(dateStr: string): boolean {
  const today = new Date();
  const [y, m, d] = dateStr.split("-").map(Number);
  return today.getFullYear() === y && today.getMonth() === m - 1 && today.getDate() === d;
}

function isCurrentMonth(dateStr: string): boolean {
  const today = new Date();
  const [, m] = dateStr.split("-").map(Number);
  return m === today.getMonth() + 1;
}

function isDatePassed(dateStr: string): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [y, m, d] = dateStr.split("-").map(Number);
  const dateObj = new Date(y, m - 1, d);
  dateObj.setHours(0, 0, 0, 0);
  return dateObj.getTime() < today.getTime();
}

interface SpecialDatesProps {
  queendomId: "ananyshree" | "anishqa";
}

export default function SpecialDates({ queendomId }: SpecialDatesProps) {
  // Tick at midnight so the "today" card vanishes as soon as the day ends (e.g. dashboard left on overnight)
  const [dateKey, setDateKey] = useState(() => new Date().toDateString());
  const midnightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const scheduleNextMidnight = () => {
      const now = new Date();
      const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      const msUntilMidnight = nextMidnight.getTime() - now.getTime();
      return setTimeout(() => {
        setDateKey(new Date().toDateString());
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
    <div className="flex flex-col gap-3 overflow-y-auto pb-2 w-full">
      <AnimatePresence mode="popLayout">
        {filteredDates.map((item) => {
          const isTodayCard = isToday(item.date);
          const isAnniversary = item.type === "anniversary";
          return (
            <motion.div
              key={item.id}
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.3 } }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className={`
                relative flex-shrink-0 flex flex-row items-center justify-between
                w-full min-h-[clamp(70px,10vh,100px)]
                rounded-xl overflow-hidden px-4 py-3 gap-4
                ${isTodayCard ? "today-highlight" : ""}
                ${isAnniversary ? "anniversary-highlight" : ""}
              `}
              style={
                isTodayCard
                  ? {
                      background:
                        "linear-gradient(140deg, rgba(30,16,22,0.96) 0%, rgba(64,22,38,0.95) 34%, rgba(20,46,34,0.94) 68%, rgba(18,28,22,0.96) 100%), radial-gradient(circle at 14% 18%, rgba(249,226,126,0.2) 0%, rgba(249,226,126,0.05) 22%, transparent 48%), radial-gradient(circle at 88% 86%, rgba(212,175,55,0.18) 0%, transparent 52%)",
                      border: "1px solid rgba(212,175,55,0.58)",
                      boxShadow:
                        "inset 0 1px 0 rgba(255,255,255,0.09), inset 0 -1px 0 rgba(15,10,8,0.45), 0 0 0 1px rgba(249,226,126,0.12)",
                    }
                  : isAnniversary
                    ? {
                        background:
                          "linear-gradient(180deg, rgba(52,32,42,0.7) 0%, rgba(38,26,34,0.85) 100%), linear-gradient(90deg, rgba(212,175,55,0.08) 0%, rgba(180,100,120,0.06) 50%, transparent 100%)",
                        border: "1px solid rgba(212,175,55,0.35)",
                        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.02)",
                      }
                    : {
                        background:
                          "linear-gradient(180deg, rgba(42,38,35,0.6) 0%, rgba(28,26,24,0.8) 100%), linear-gradient(90deg, rgba(212,175,55,0.04) 0%, transparent 30%)",
                        border: "1px solid rgba(212,175,55,0.25)",
                        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.02)",
                      }
              }
            >
              <span className="font-edu font-bold text-[clamp(2rem,4vw,3rem)] tabular-nums text-champagne/95 leading-none flex-shrink-0">
                {formatDay(item.date)}
              </span>
              <div className="flex items-center justify-center gap-2 flex-1 min-w-0">
                {isTodayCard && (
                  <Gift
                    className="flex-shrink-0 w-5 h-5 text-[#D4AF37]"
                    strokeWidth={2}
                  />
                )}
                {isAnniversary && !isTodayCard && (
                  <Heart
                    className="flex-shrink-0 w-5 h-5 text-rose-400/90 fill-rose-400/30"
                    strokeWidth={2}
                  />
                )}
                <span className="font-baskerville font-semibold text-[clamp(1.25rem,2.2vw,1.75rem)] text-champagne/90 truncate text-center leading-tight">
                  {item.clientName}
                </span>
              </div>

              {isAnniversary && (
                <div className="absolute top-1 right-1 flex items-center gap-1">
                  <Heart className="w-3 h-3 text-rose-400/80 fill-rose-400/40" strokeWidth={2} />
                  <span className="text-[10px] font-inter uppercase tracking-wider text-rose-300/90 font-semibold">
                    Anniv
                  </span>
                </div>
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
