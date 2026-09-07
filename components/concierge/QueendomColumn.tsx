"use client";

/**
 * components/concierge/QueendomColumn.tsx
 *
 * One queendom's column under the scoreboard strip (handoff 1c §B):
 *   B1  Renewals card        — RenewalsPanel (count · renewed · new members)
 *   B2  Leaderboard card     — AgentLeaderboard over a Special Dates grid that
 *                              fills the remaining height (2 columns, rows measured)
 *   B3  Band                 — Since Last Resolved | Incoming Renewals
 *
 * The membership pills and the five ticket metrics now live in the strip;
 * everything else the old QueendomPanel showed is here, reading the same
 * QueenStats / RenewalsPanelData shapes.
 */

import { motion } from "framer-motion";
import AgentLeaderboard from "@/components/leaderboard/AgentLeaderboard";
import RenewalsPanel from "@/components/RenewalsPanel";
import ResolveStopwatch from "@/components/ResolveStopwatch";
import SpecialDates from "@/components/SpecialDates";
import UpcomingRenewals from "@/components/UpcomingRenewals";
import { SectionDivider } from "@/components/ui/SectionDivider";
import { fh, fw } from "@/lib/tvScale";
import type { QueendomView } from "@/types";
import {
  QUEENDOM_ENTRANCE_DELAY_MS,
  queendomContainerVariants,
  queendomItemVariants,
} from "./motion";

/** Block gap between the three cards (handoff: 40px). */
const BLOCK_GAP = fh(40);
/** Card padding (handoff: 40px / 43px). */
const CARD_PADDING = `${fh(40)} ${fw(43)}`;
/** Band height (handoff: 346px ≈ 10cqh). */
const BAND_HEIGHT = fh(346, 0.28);

const BAND_TITLE_CLASS =
  "!font-cinzel !font-semibold !leading-[1.1] !tracking-[0.2em] whitespace-nowrap";
const BAND_TITLE_STYLE = { fontSize: fw(34) };

interface QueendomColumnProps {
  view: QueendomView;
  /** 0-based column position — drives the left → right entrance stagger. */
  index: number;
  celebrationAgent: string | null;
}

export default function QueendomColumn({ view, index, celebrationAgent }: QueendomColumnProps) {
  const delayMs = QUEENDOM_ENTRANCE_DELAY_MS * index;

  return (
    <motion.section
      className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
      variants={queendomContainerVariants}
      initial="hidden"
      animate="visible"
      aria-label={`${view.name} Queendom`}
    >
      {/* Ambient radial glow — one per column so the three read as three stages */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 65% at 50% 40%, rgba(201,168,76,0.05), transparent)",
        }}
      />

      {/* B1 — Renewals */}
      <motion.div
        className="relative flex-shrink-0"
        style={{ marginBottom: BLOCK_GAP }}
        variants={queendomItemVariants}
      >
        <RenewalsPanel data={view.renewals} delay={delayMs + 1300} />
      </motion.div>

      {/* B2 — Leaderboard over Special Dates */}
      <motion.div
        className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl glass gold-border-glow"
        style={{ padding: CARD_PADDING }}
        variants={queendomItemVariants}
      >
        <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br from-gold-500/[0.03] to-transparent" />
        <div className="relative z-10 flex min-h-0 flex-1 flex-col" style={{ gap: fh(30) }}>
          {/* Leaderboard keeps its natural height; Special Dates fills what is left. */}
          <div className="flex flex-shrink-0 flex-col overflow-hidden">
            <AgentLeaderboard
              agents={view.stats.agents}
              queendomDelay={delayMs / 1000 + 0.3}
              celebrationAgent={celebrationAgent}
            />
          </div>

          <div
            className="flex min-h-0 flex-1 flex-col border-t border-gold-500/20"
            style={{ paddingTop: fh(30), minHeight: fh(320) }}
          >
            <SectionDivider
              label="Special Dates"
              accent="champagne"
              className="w-full flex-shrink-0 gap-3 px-1"
              labelClass="!font-cinzel !font-semibold !leading-[1.3] !tracking-[0.24em] whitespace-nowrap"
              labelStyle={{ fontSize: fw(38) }}
            />
            <div className="min-h-0 flex-1" style={{ marginTop: fh(24) }}>
              <SpecialDates queendomId={view.id} />
            </div>
          </div>
        </div>
      </motion.div>

      {/* B3 — Band: stopwatch | incoming renewals */}
      <motion.div
        className="relative w-full flex-shrink-0 overflow-hidden rounded-2xl glass gold-border-glow"
        style={{ padding: `${fh(30)} ${fw(43)}`, height: BAND_HEIGHT, marginTop: BLOCK_GAP }}
        variants={queendomItemVariants}
      >
        <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br from-gold-500/[0.03] to-transparent" />
        <div className="relative z-10 flex h-full w-full min-h-0" style={{ gap: fw(30) }}>
          {/* Time since the last ticket was resolved */}
          <div className="flex min-h-0 min-w-0 flex-col" style={{ flex: "0 0 42%" }}>
            <SectionDivider
              label="Since Last Resolved"
              accent="champagne"
              className="gap-2 px-1"
              labelClass={BAND_TITLE_CLASS}
              labelStyle={{ ...BAND_TITLE_STYLE, marginBottom: 0 }}
            />
            <div className="min-h-0 flex-1" style={{ marginTop: fh(14) }}>
              <ResolveStopwatch lastResolvedAtMs={view.stats.lastResolvedAtMs} compact />
            </div>
          </div>

          <div className="w-px self-stretch bg-gold-500/15" aria-hidden />

          {/* Memberships expiring this month — the renewals to land */}
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <SectionDivider
              label="Incoming Renewals"
              accent="champagne"
              className="gap-2 px-1"
              labelClass={BAND_TITLE_CLASS}
              labelStyle={BAND_TITLE_STYLE}
            />
            <div className="min-h-0 flex-1" style={{ marginTop: fh(14) }}>
              <UpcomingRenewals clients={view.stats.renewalsDue ?? []} />
            </div>
          </div>
        </div>
      </motion.div>
    </motion.section>
  );
}
