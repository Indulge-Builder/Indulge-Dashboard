"use client";

/**
 * /settings/concierge — the Concierge domain's settings.
 *
 * Pick a Queendom, then a section: Agents (the leaderboard roster + Joker),
 * Renewals, New Members. Both choices live in the URL (?q=sanika&s=renewals)
 * so a link can land someone on exactly the right screen and the browser back
 * button behaves.
 */

import { Suspense, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { QUEENDOM_DISPLAY_NAME, QUEENDOM_IDS, isQueendomId } from "@/lib/queendom";
import type { QueendomId } from "@/types";
import { SettingsShell } from "@/components/settings/SettingsShell";
import { QueendomAgents } from "@/components/settings/QueendomAgents";
import {
  MEMBERS_CONFIG,
  QueendomClientRows,
  RENEWALS_CONFIG,
} from "@/components/settings/QueendomClientRows";
import { QUEENDOM_DOT_CLASS, SegmentedTabs } from "@/components/settings/ui";

type Section = "agents" | "renewals" | "members";
const SECTIONS: readonly { value: Section; label: string; hint: string }[] = [
  { value: "agents", label: "Agents", hint: "leaderboard roster" },
  { value: "renewals", label: "Renewals", hint: "this month" },
  { value: "members", label: "New Members", hint: "this month" },
];
const isSection = (v: string | null): v is Section =>
  v === "agents" || v === "renewals" || v === "members";

export default function ConciergeSettingsPage() {
  return (
    <Suspense fallback={null}>
      <ConciergeSettings />
    </Suspense>
  );
}

function ConciergeSettings() {
  const router = useRouter();
  const params = useSearchParams();
  const qParam = params.get("q");
  const queendom: QueendomId = isQueendomId(qParam) ? qParam : QUEENDOM_IDS[0];
  const sParam = params.get("s");
  const section: Section = isSection(sParam) ? sParam : "agents";

  const navigate = useCallback(
    (q: QueendomId, s: Section) => {
      router.replace(`/settings/concierge?q=${q}&s=${s}`, { scroll: false });
    },
    [router],
  );

  return (
    <SettingsShell crumbs={[{ label: "Concierge" }, { label: QUEENDOM_DISPLAY_NAME[queendom] }]}>
      {({ lock }) => (
        <div className="flex flex-col gap-6">
          {/* Queendom switcher — TV order, each with its chip colour */}
          <section aria-labelledby="queendom-title" className="flex flex-col gap-3">
            <h2 id="queendom-title" className="font-cinzel text-[11px] tracking-[0.3em] text-gold-400/80 uppercase">
              Queendom
            </h2>
            <SegmentedTabs
              ariaLabel="Queendom"
              value={queendom}
              onChange={(q) => navigate(q, section)}
              options={QUEENDOM_IDS.map((id) => ({
                value: id,
                label: QUEENDOM_DISPLAY_NAME[id],
                accentClass: QUEENDOM_DOT_CLASS[id],
              }))}
            />
          </section>

          {/* Section switcher */}
          <section aria-labelledby="section-title" className="flex flex-col gap-3">
            <h2 id="section-title" className="font-cinzel text-[11px] tracking-[0.3em] text-gold-400/80 uppercase">
              Manage
            </h2>
            <SegmentedTabs
              ariaLabel="Section"
              value={section}
              onChange={(s) => navigate(queendom, s)}
              options={SECTIONS}
            />
          </section>

          <div className="mt-2">
            {section === "agents" ? (
              <QueendomAgents queendom={queendom} onUnauthorized={lock} />
            ) : section === "renewals" ? (
              <QueendomClientRows queendom={queendom} config={RENEWALS_CONFIG} onUnauthorized={lock} />
            ) : (
              <QueendomClientRows queendom={queendom} config={MEMBERS_CONFIG} onUnauthorized={lock} />
            )}
          </div>
        </div>
      )}
    </SettingsShell>
  );
}
