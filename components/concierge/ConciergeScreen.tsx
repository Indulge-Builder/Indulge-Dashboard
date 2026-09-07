"use client";

/**
 * components/concierge/ConciergeScreen.tsx
 *
 * The concierge screen (handoff 1c): a full-width ScoreboardStrip, then one
 * QueendomColumn per queendom in TV order, separated by the gold hairline
 * columns. Takes `queendoms: QueendomView[]` — the count of columns is the
 * length of that array, so a fourth queendom is a registry change, not a
 * layout change.
 *
 * Each column is isolated in its own ErrorBoundary so one queendom's crash
 * never blanks the others.
 */

import { Fragment } from "react";
import { motion } from "framer-motion";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { fh, fw } from "@/lib/tvScale";
import type { QueendomView } from "@/types";
import QueendomColumn from "./QueendomColumn";
import ScoreboardStrip from "./ScoreboardStrip";
import { queendomContainerVariants } from "./motion";

/** Shell vertical padding (handoff: 52px ≈ 1.5cqh). */
export const SHELL_PADDING = `${fh(52)} var(--pad-panel)`;
/** Gap between the strip and the columns row (handoff: 40px). */
export const STRIP_GAP = fh(40);
/** Gap between a column and the separator column (handoff: 28.8px = gap-8). */
export const COLUMN_GAP = fw(28.8);

/** Full-height gold separator between two columns (the old center column). */
export function ColumnSeparator() {
  return (
    <div
      className="relative shrink-0 self-stretch"
      style={{ width: "var(--size-center-separator)" }}
      aria-hidden
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 160% 50% at 50% 50%, rgba(201,168,76,0.032), transparent)",
        }}
      />
      <div className="absolute left-1/2 top-[20px] bottom-[20px] w-px -translate-x-1/2 bg-gradient-to-b from-transparent via-gold-500/35 to-transparent" />
      <div
        className="pointer-events-none absolute left-1/2 top-[20px] bottom-[20px] w-[4px] -translate-x-1/2"
        style={{
          background:
            "linear-gradient(to bottom, transparent 8%, rgba(201,168,76,0.08) 30%, rgba(201,168,76,0.12) 50%, rgba(201,168,76,0.08) 70%, transparent 92%)",
          filter: "blur(2px)",
        }}
      />
    </div>
  );
}

interface ConciergeScreenProps {
  queendoms: QueendomView[];
  celebrationAgent: string | null;
}

export default function ConciergeScreen({ queendoms, celebrationAgent }: ConciergeScreenProps) {
  return (
    <motion.div
      className="flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden"
      style={{ padding: SHELL_PADDING }}
      variants={queendomContainerVariants}
      initial="hidden"
      animate="visible"
    >
      <ErrorBoundary label="Scoreboard">
        <ScoreboardStrip queendoms={queendoms} />
      </ErrorBoundary>

      <div
        className="flex min-h-0 flex-1 items-stretch"
        style={{ marginTop: STRIP_GAP, gap: COLUMN_GAP }}
      >
        {queendoms.map((q, i) => (
          <Fragment key={q.id}>
            {i > 0 && <ColumnSeparator />}
            <div className="relative flex min-h-0 min-w-0 flex-1 basis-0 flex-col">
              <ErrorBoundary label={q.name} fillParent>
                <QueendomColumn view={q} index={i} celebrationAgent={celebrationAgent} />
              </ErrorBoundary>
            </div>
          </Fragment>
        ))}
      </div>
    </motion.div>
  );
}
