"use client";

/**
 * components/mobile/MobileDashboard.tsx — phone shell.
 *
 * The TV's two rotating screens become two TABS the thumb switches between —
 * rank replaces rotation (the TV rotates because it can't ask what you want;
 * the phone doesn't have to guess). Under each tab a single ranked column:
 * what needs you now → today → the month → who's carrying it → extras.
 *
 * Composition mirrors Dashboard.tsx: this file only composes hooks and
 * regions. Both data hooks stay mounted at the shell so tab switches are
 * instant; only the ACTIVE tab's tree renders (no hidden-screen compositing
 * on a battery — the TV's invariant #11 deliberately does not apply here).
 *
 * All styling lives under the `.mroot` scope in globals.css — the mobile
 * type ramp never touches the TV's clamp() variables.
 */

import { useEffect, useState } from "react";
import { useDashboardData } from "@/hooks/useDashboardData";
import { useOnboardingPanelData } from "@/hooks/useOnboardingPanelData";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import MobileConcierge from "./MobileConcierge";
import MobileRevenue from "./MobileRevenue";
import { PulseSheet, OverdueSheet, useInsights } from "./MobileInsights";

type MobileTab = "concierge" | "revenue";

const IST_CLOCK = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
});

/** Minute-ticking IST wall clock — anchors every reading to office time. */
function useIstClock(): string {
  const [now, setNow] = useState(() => IST_CLOCK.format(new Date()));
  useEffect(() => {
    const id = setInterval(() => setNow(IST_CLOCK.format(new Date())), 15_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

export default function MobileDashboard() {
  const [tab, setTab] = useState<MobileTab>("concierge");
  const [pulseOpen, setPulseOpen] = useState(false);
  const [overdueOpen, setOverdueOpen] = useState(false);
  const istNow = useIstClock();
  const { insights, insightsLoading, days, setDays } = useInsights();

  const {
    ananyshreeStats,
    anishqaStats,
    overdueTickets,
    isInitialLoading,
  } = useDashboardData();

  const { conciergeAgents, shopAgents, ledger, leadMonthStats } =
    useOnboardingPanelData();

  return (
    <div className="mroot">
      <header className="m-header">
        <div className="m-header-row">
          <p className="m-wordmark">Indulge</p>
          <span className="m-header-meta">
            <span className="m-clock" aria-label="Current time in India">
              {istNow} IST
            </span>
            <span className="m-live" aria-label="Live data">
              <span className="m-live-dot" aria-hidden />
              Live
            </span>
          </span>
        </div>

        <nav className="m-tabs" role="tablist" aria-label="Dashboard sections">
          <span
            className="m-tab-pill"
            data-tab={tab}
            aria-hidden
          />
          <button
            role="tab"
            aria-selected={tab === "concierge"}
            className="m-tab"
            data-active={tab === "concierge"}
            onClick={() => setTab("concierge")}
          >
            Concierge
          </button>
          <button
            role="tab"
            aria-selected={tab === "revenue"}
            className="m-tab"
            data-active={tab === "revenue"}
            onClick={() => setTab("revenue")}
          >
            Revenue
          </button>
        </nav>
      </header>

      <main className="m-main" key={tab}>
        {tab === "concierge" ? (
          <ErrorBoundary label="Concierge (mobile)">
            <MobileConcierge
              ananyshreeStats={ananyshreeStats}
              anishqaStats={anishqaStats}
              overdueTickets={overdueTickets}
              isLoading={isInitialLoading}
              insights={insights}
              onOpenPulse={() => setPulseOpen(true)}
              onOpenOverdue={() => setOverdueOpen(true)}
            />
          </ErrorBoundary>
        ) : (
          <ErrorBoundary label="Revenue (mobile)">
            <MobileRevenue
              conciergeAgents={conciergeAgents}
              shopAgents={shopAgents}
              ledger={ledger}
              leadMonthStats={leadMonthStats}
              insights={insights}
            />
          </ErrorBoundary>
        )}
      </main>

      <OverdueSheet open={overdueOpen} onClose={() => setOverdueOpen(false)} />

      <PulseSheet
        open={pulseOpen}
        onClose={() => setPulseOpen(false)}
        insights={insights}
        loading={insightsLoading}
        days={days}
        setDays={setDays}
      />
    </div>
  );
}
