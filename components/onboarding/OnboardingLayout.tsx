"use client";

import { usePulseOnChange } from "@/hooks/usePulseOnChange";
import { useOnboardingPanelData } from "@/hooks/useOnboardingPanelData";
import { DepartmentColumn } from "./DepartmentColumn";
import { TargetMeter } from "./TargetMeter";
import { ConversionLedger } from "./ConversionLedger";
import { PerformanceLineGraph } from "./PerformanceLineGraph";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { DEPT_HEADING_FONT } from "./utils";

// ── Center stat tile — label + big numeral, static tile, squash-pop on change ──
function StatTile({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  const pulse = usePulseOnChange(value);
  return (
    <div
      className="neu-raised rounded-neu-tile flex flex-col items-center"
      style={{
        gap: "clamp(2px, 0.4cqmin, 9px)",
        padding: "clamp(6px, 1cqmin, 22px) clamp(4px, 0.6cqmin, 14px)",
      }}
    >
      <span
        key={pulse ? "pop" : "rest"}
        className={`font-montserrat tabular-nums ${pulse ? "neu-anim-pop" : ""}`}
        style={{
          fontSize: "clamp(1.8rem, min(4.2cqmin, 5cqh), 5.5rem)",
          fontWeight: 800,
          lineHeight: 1,
          color,
          letterSpacing: "-0.01em",
        }}
      >
        {value}
      </span>
      <span
        className="font-montserrat text-neu-t2"
        style={{
          fontSize: "clamp(14px, min(1.45cqmin, 1.75cqh), 1.6rem)",
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.18em",
        }}
      >
        {label}
      </span>
    </div>
  );
}

export default function OnboardingLayout() {
  const props = useOnboardingPanelData();
  const {
    conciergeAgents,
    shopAgents,
    ledger,
    pulseEvents,
    leadMonthStats,
    verticalTrendline,
    ledgerScrollDuration,
    prefersReducedMotion,
    leadStatusByAgent,
    todayDate,
  } = props;

  return (
    <section
      className="relative flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden"
      style={{
        padding:
          "clamp(0.6rem,min(1.6cqh,1.8cqmin),1.75rem) clamp(0.6rem,min(2.4cqmin,3.2cqw),2.5rem)",
      }}
    >
      {/* No screen-level heading — the global header row is the only header,
          same as the concierge screen (its "Revenue Dashboard" h2 was removed
          2026-07-03 as a duplicate). */}

      <div
        className="relative grid min-h-0 flex-1 grid-cols-1 gap-[clamp(0.6rem,1.4cqw,3.4rem)] lg:grid-cols-[1fr_1fr_1.05fr]"
      >
        <div className="flex min-h-[clamp(220px,28cqh,380px)] flex-col lg:min-h-0">
          <DepartmentColumn
            department="concierge"
            label="Onboarding"
            agents={conciergeAgents}
            prefersReducedMotion={prefersReducedMotion}
            leadStatusByAgent={leadStatusByAgent}
          />
        </div>

        <div
          className="flex min-h-[clamp(220px,28cqh,380px)] flex-col lg:min-h-0"
          style={{ gap: "clamp(0.55rem,1.2cqh,1.75rem)" }}
        >
          {/* ── Performance card: stat tiles + line graph ── */}
          <div
            className="relative flex min-h-0 flex-[2] flex-col overflow-hidden neu-raised rounded-neu-tile"
            style={{
              padding: "clamp(0.45rem,0.9cqmin,1.5rem)",
              gap: "clamp(0.2rem,0.4cqmin,0.75rem)",
            }}
          >
            <div
              className="relative flex flex-shrink-0 flex-col"
              style={{
                gap: "clamp(0.35rem, 0.7cqmin, 0.8rem)",
                paddingTop: "clamp(0.4rem, 0.9cqmin, 1rem)",
                marginBottom: "0.4cqh",
              }}
            >
              <div className="flex w-full items-center gap-2">
                <div className="neu-rule-l h-px flex-1 min-w-[clamp(22px,3cqw,44px)]" />
                <p
                  className="flex-shrink-0 font-cinzel font-bold uppercase leading-none tracking-[0.28em] text-neu-t1 neu-letterpress"
                  style={{ fontSize: DEPT_HEADING_FONT }}
                >
                  Performance
                </p>
                <div className="neu-rule-r h-px flex-1 min-w-[clamp(22px,3cqw,44px)]" />
              </div>
            </div>

            {/* Lead month stat tiles — label + numeral only, bob + pop */}
            <div
              className="grid w-full flex-shrink-0"
              style={{ gridTemplateColumns: "repeat(4, 1fr)", gap: "clamp(6px, 1cqw, 28px)" }}
            >
              <StatTile
                label="Leads"
                value={leadMonthStats.leads}
                color="var(--neu-text-primary)"
              />
              <StatTile
                label="Attended"
                value={leadMonthStats.attended}
                color="var(--neu-powder-deep)"
              />
              <StatTile
                label="Converted"
                value={leadMonthStats.dealsClosedThisMonth}
                color="var(--neu-sage-deep)"
              />
              <StatTile
                label="Junk"
                value={leadMonthStats.junk}
                color="var(--neu-text-secondary)"
              />
            </div>

            <div className="relative min-h-0 flex-1">
              <PerformanceLineGraph
                data={verticalTrendline}
                pulseEvents={pulseEvents}
                todayDate={todayDate}
              />
            </div>
          </div>

          {/* ── Bottom slot: TargetMeter beside Live Closures (36% / 64%) ── */}
          <div
            className="relative flex min-h-0 flex-[1.7] flex-row"
            style={{ gap: "clamp(0.55rem,1.2cqh,1.75rem)" }}
          >
            <div className="relative flex min-h-0 w-[36%] flex-shrink-0 flex-col">
              <TargetMeter
                agents={[...conciergeAgents, ...shopAgents]}
                totalClosed={leadMonthStats.dealsClosedThisMonth}
              />
            </div>

            <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
              <ErrorBoundary label="Conversion Ledger" fillParent>
                <ConversionLedger
                  rows={ledger}
                  scrollDuration={ledgerScrollDuration}
                  prefersReducedMotion={prefersReducedMotion}
                />
              </ErrorBoundary>
            </div>
          </div>
        </div>

        <div className="flex min-h-[clamp(220px,28cqh,380px)] flex-col lg:min-h-0">
          <DepartmentColumn
            department="shop"
            label="Shop"
            agents={shopAgents}
            prefersReducedMotion={prefersReducedMotion}
            leadStatusByAgent={leadStatusByAgent}
          />
        </div>
      </div>
    </section>
  );
}
