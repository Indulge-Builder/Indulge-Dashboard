"use client";

import { memo, useState, useCallback } from "react";
import {
  Utensils,
  MapPin,
  Bed,
  Leaf,
  Star,
  type LucideIcon,
} from "lucide-react";
import type { JokerRecommendationItem } from "@/app/api/jokers/recommendations/route";

// ── Map jokers.type (string) to Lucide icon ─────────────────────────────────
const TYPE_ICON_MAP: Record<string, LucideIcon> = {
  restaurant: Utensils,
  restaurants: Utensils,
  hotel: Bed,
  hotels: Bed,
  travel: MapPin,
  spa: Leaf,
  experience: Star,
  experiences: Star,
  default: Star,
};

// ── Type-based color coding (icon, border) — bright for 15ft visibility ───────
const TYPE_COLORS: Record<string, { icon: string; border: string }> = {
  restaurant: {
    icon: "#F5D76E",
    border: "rgba(245, 215, 110, 0.6)",
  },
  restaurants: {
    icon: "#F5D76E",
    border: "rgba(245, 215, 110, 0.6)",
  },
  travel: {
    icon: "#5DADE2",
    border: "rgba(93, 173, 226, 0.6)",
  },
  hotel: {
    icon: "#BB8FCE",
    border: "rgba(187, 143, 206, 0.6)",
  },
  hotels: {
    icon: "#BB8FCE",
    border: "rgba(187, 143, 206, 0.6)",
  },
  spa: {
    icon: "#58D68D",
    border: "rgba(88, 214, 141, 0.6)",
  },
  experience: {
    icon: "#F1948A",
    border: "rgba(241, 148, 138, 0.6)",
  },
  experiences: {
    icon: "#F1948A",
    border: "rgba(241, 148, 138, 0.6)",
  },
  default: {
    icon: "#F1948A",
    border: "rgba(241, 148, 138, 0.6)",
  },
};

function getIconForType(type: string): LucideIcon {
  const key = type.toLowerCase().trim().replace(/\s+/g, "");
  return TYPE_ICON_MAP[key] ?? TYPE_ICON_MAP.default;
}

function getColorsForType(type: string) {
  const key = type.toLowerCase().trim().replace(/\s+/g, "");
  return TYPE_COLORS[key] ?? TYPE_COLORS.default;
}

const TICKER_DURATION_S = 40; // seconds for full cycle — slower, calmer scroll

// ── Triple the array for seamless infinite scroll without gaps ───────────────
function tripleList<T>(items: T[]): T[] {
  if (items.length === 0) return [];
  return [...items, ...items, ...items];
}

// ─────────────────────────────────────────────────────────────────────────────
// Single ticker item — [CITY] | [TYPE]: [SUGGESTION]
// Cinzel for CITY/TYPE, Sans-Serif for SUGGESTION. Memoized by suggestion text.
// ─────────────────────────────────────────────────────────────────────────────
function tickerItemPropsAreEqual(
  prev: { item: JokerRecommendationItem; isLast: boolean },
  next: { item: JokerRecommendationItem; isLast: boolean },
) {
  return (
    prev.item.id === next.item.id &&
    prev.item.suggestion === next.item.suggestion &&
    prev.item.city === next.item.city &&
    prev.item.type === next.item.type &&
    prev.isLast === next.isLast
  );
}

const TickerItem = memo(function TickerItem({
  item,
  isLast,
}: {
  item: JokerRecommendationItem;
  isLast: boolean;
}) {
  const Icon = getIconForType(item.type);
  const colors = getColorsForType(item.type);
  return (
    <>
      <div className="ticker-item flex items-center gap-4 sm:gap-6 flex-shrink-0">
        <div
          className="flex-shrink-0 w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center"
          style={{
            border: `2px solid ${colors.border}`,
            background: "rgba(5, 5, 5, 0.85)",
          }}
        >
          <Icon
            className="w-7 h-7 sm:w-8 sm:h-8"
            style={{ color: colors.icon }}
            strokeWidth={2.5}
          />
        </div>
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          <span className="font-cinzel font-semibold text-[clamp(1.35rem,2.05vw,2.15rem)] text-white/95 tracking-wide whitespace-nowrap">
            {item.city}
          </span>
          <span className="text-gold-400/60 font-cinzel text-[clamp(1.15rem,1.6vw,1.7rem)]">
            |
          </span>
          <span className="font-baskerville font-semibold text-[clamp(1.35rem,2.05vw,2.15rem)] tracking-wide text-champagne truncate max-w-[20ch] sm:max-w-[28ch]">
            {item.suggestion}
          </span>
        </div>
      </div>
      {!isLast && (
        <div
          className="flex-shrink-0 w-px h-10 sm:h-14 bg-white/15"
          aria-hidden
        />
      )}
    </>
  );
}, tickerItemPropsAreEqual);

// ─────────────────────────────────────────────────────────────────────────────
// Joker Recommendations Ticker — data from parent only; no fetch or Supabase
// ─────────────────────────────────────────────────────────────────────────────
function RecommendationTickerInner({
  recommendations,
}: {
  recommendations: JokerRecommendationItem[];
}) {
  const [isPaused, setIsPaused] = useState(false);
  const tripledList = tripleList(recommendations);
  const doubledForScroll =
    tripledList.length > 0 ? [...tripledList, ...tripledList] : [];

  const handleMouseEnter = useCallback(() => setIsPaused(true), []);
  const handleMouseLeave = useCallback(() => setIsPaused(false), []);

  if (recommendations.length === 0) {
    return (
      <div
        className="relative w-full flex-shrink-0 py-4 overflow-hidden"
        style={{
          borderTop: "1px solid rgba(212, 175, 55, 0.2)",
          borderBottom: "1px solid rgba(212, 175, 55, 0.2)",
          background: "rgba(5, 5, 5, 0.92)",
        }}
      >
        <p className="font-cinzel text-center text-gold-500/60 text-[clamp(1.15rem,1.7vw,1.7rem)] tracking-widest uppercase">
          Loading recommendations…
        </p>
      </div>
    );
  }

  return (
    <div
      className="relative w-full flex-shrink-0 overflow-hidden"
      style={{
        borderTop: "1px solid rgba(212, 175, 55, 0.2)",
        borderBottom: "1px solid rgba(212, 175, 55, 0.2)",
        background: "rgba(5, 5, 5, 0.92)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Scrolling track — CSS animation for smooth 60fps, mask-image fade at edges */}
      <div
        className="relative overflow-hidden"
        style={{
          maskImage:
            "linear-gradient(to right, transparent 0%, black 12%, black 88%, transparent 100%)",
          WebkitMaskImage:
            "linear-gradient(to right, transparent 0%, black 12%, black 88%, transparent 100%)",
        }}
      >
        <div
          className={`ticker-track flex items-center ${isPaused ? "ticker-paused" : ""}`}
          style={{
            willChange: "transform",
            animation: `ticker-scroll ${TICKER_DURATION_S}s linear infinite`,
          }}
        >
          {doubledForScroll.map((item, i) => (
            <TickerItem
              key={`${item.id}-${i}`}
              item={item}
              isLast={i === doubledForScroll.length - 1}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

const RecommendationTicker = memo(RecommendationTickerInner);

export default RecommendationTicker;
