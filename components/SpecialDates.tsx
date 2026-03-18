"use client";

import { useMemo } from "react";
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
  const filteredDates = useMemo(() => {
    return getSpecialDates()
      .filter((d) => d.queendom === queendomId)
      .filter((d) => isCurrentMonth(d.date))
      .filter((d) => !isDatePassed(d.date))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [queendomId]);

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
              animate={{ opacity: 1, scale: isTodayCard ? 1.05 : 1 }}
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
                        "linear-gradient(135deg, rgba(74,21,32,0.95) 0%, rgba(13,40,24,0.92) 50%, rgba(26,42,26,0.95) 100%), radial-gradient(ellipse 80% 100% at 20% 50%, rgba(212,175,55,0.08), transparent 50%)",
                      border: "1px solid rgba(212,175,55,0.4)",
                      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.03)",
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
