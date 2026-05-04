"use client";

/**
 * Presentational shell for the Revenue Dashboard onboarding TV screen.
 * No fetching, Realtime, or shimmer logic — data arrives via props only.
 */

import type { UseOnboardingPanelDataResult } from "@/hooks/useOnboardingPanelData";
import { SectionDivider } from "@/components/ui/SectionDivider";
import { DepartmentColumn } from "./DepartmentColumn";
import { ConversionLedger } from "./ConversionLedger";
import { PerformanceLineGraph } from "./PerformanceLineGraph";
import {
  DEPT_HEADING_FONT,
  ONBOARDING_PAGE_TITLE_FONT,
} from "./utils";

export default function OnboardingLayout(props: UseOnboardingPanelDataResult) {
  const {
    conciergeAgents,
    shopAgents,
    ledger,
    pulseEvents,
    leadMonthStats,
    verticalTrendline,
    ledgerScrollDuration,
    prefersReducedMotion,
    shimmerStampByAgentId,
    leadStatusByAgent,
    todayDate,
  } = props;

  return (
    <section
      className="relative flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden bg-obsidian"
      style={{
        padding:
          "clamp(0.6rem,min(1.6vh,1.8vmin),1.75rem) clamp(0.6rem,min(2.4vmin,3.2vw),2.5rem)",
      }}
    >
      <div className="ambient-glow-center pointer-events-none absolute inset-0" />

      <div className="relative mb-[1.4vh] flex-shrink-0 text-center">
        <SectionDivider className="mb-[0.7vh]" />
        <h2
          className="mb-[0.8vh] font-cinzel font-bold uppercase leading-none tracking-[0.28em] text-gold-400 queen-name-glow"
          style={{ fontSize: ONBOARDING_PAGE_TITLE_FONT }}
        >
          Revenue Dashboard
        </h2>
        <SectionDivider />
      </div>

      <div
        className="relative grid min-h-0 flex-1 grid-cols-1 gap-[clamp(0.6rem,1.4vw,1.8rem)] lg:grid-cols-[1fr_1fr_1.05fr]"
      >
        <div className="flex min-h-[clamp(220px,28vh,380px)] flex-col lg:min-h-0">
          <DepartmentColumn
            department="concierge"
            label="Onboarding"
            agents={conciergeAgents}
            shimmerStampByAgentId={shimmerStampByAgentId}
            prefersReducedMotion={prefersReducedMotion}
            leadStatusByAgent={leadStatusByAgent}
          />
        </div>

        <div
          className="flex min-h-[clamp(220px,28vh,380px)] flex-col lg:min-h-0"
          style={{ gap: "clamp(0.55rem,1.2vh,1.25rem)" }}
        >
          <div
            className="relative flex min-h-0 flex-[2] flex-col overflow-hidden rounded-2xl"
            style={{
              background: "rgba(10,10,10,0.88)",
              border: "1px solid rgba(255,255,255,0.14)",
              boxShadow:
                "0 0 0 1px rgba(255,255,255,0.03) inset, 0 16px 40px rgba(0,0,0,0.45)",
              padding: "clamp(0.45rem,0.9vmin,1rem)",
              gap: "clamp(0.2rem,0.4vmin,0.5rem)",
            }}
          >
            <div
              className="pointer-events-none absolute inset-0 rounded-2xl"
              style={{
                background:
                  "linear-gradient(135deg, transparent 45%, rgba(255,176,32,0.018) 100%)",
              }}
            />

            <div
              className="relative flex flex-shrink-0 flex-col"
              style={{
                gap: "clamp(0.35rem, 0.7vmin, 0.8rem)",
                paddingTop: "clamp(0.4rem, 0.9vmin, 1rem)",
                marginBottom: "0.4vh",
              }}
            >
              <div className="flex w-full items-center gap-2">
                <div
                  style={{
                    height: "clamp(1.5px, 0.22vmin, 3px)",
                    flex: 1,
                    minWidth: "clamp(22px, 3vw, 44px)",
                    background:
                      "linear-gradient(to right, transparent, rgba(107,143,255,0.30), rgba(107,143,255,0.55))",
                    boxShadow: "0 0 6px rgba(107,143,255,0.24)",
                  }}
                />
                <p
                  className="flex-shrink-0 font-cinzel font-bold uppercase leading-none tracking-[0.28em]"
                  style={{
                    fontSize: DEPT_HEADING_FONT,
                    color: "rgba(168,192,255,0.85)",
                    textShadow: "0 0 18px rgba(107,143,255,0.40)",
                  }}
                >
                  Performance
                </p>
                <div
                  style={{
                    height: "clamp(1.5px, 0.22vmin, 3px)",
                    flex: 1,
                    minWidth: "clamp(22px, 3vw, 44px)",
                    background:
                      "linear-gradient(to left, transparent, rgba(255,176,32,0.30), rgba(255,176,32,0.55))",
                    boxShadow: "0 0 6px rgba(255,176,32,0.24)",
                  }}
                />
              </div>
              <div className="flex w-full items-center">
                <div
                  style={{
                    height: "1px",
                    flex: 1,
                    background:
                      "linear-gradient(to right, transparent, rgba(107,143,255,0.28), rgba(107,143,255,0.45))",
                  }}
                />
                <div
                  style={{
                    height: "1px",
                    flex: 1,
                    background:
                      "linear-gradient(to left, transparent, rgba(255,176,32,0.28), rgba(255,176,32,0.45))",
                  }}
                />
              </div>
            </div>

            <div
              className="grid w-full flex-shrink-0"
              style={{ gridTemplateColumns: "repeat(4, 1fr)", gap: "clamp(6px, 1vw, 14px)" }}
            >
              {(
                [
                  {
                    label: "Leads",
                    value: leadMonthStats.leads,
                    color: "rgba(192,200,220,0.85)",
                    accent: "rgba(192,200,220,0.35)",
                  },
                  {
                    label: "Attended",
                    value: leadMonthStats.attended,
                    color: "#6B8FFF",
                    accent: "rgba(107,143,255,0.45)",
                  },
                  {
                    label: "Converted",
                    value: leadMonthStats.dealsClosedThisMonth,
                    color: "#FFB020",
                    accent: "rgba(255,176,32,0.50)",
                  },
                  {
                    label: "Junk",
                    value: leadMonthStats.junk,
                    color: "rgba(248,113,113,0.55)",
                    accent: "rgba(248,113,113,0.28)",
                  },
                ] as const
              ).map(({ label, value, color, accent }) => (
                <div
                  key={label}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "clamp(2px, 0.4vmin, 5px)",
                    padding: "clamp(6px, 1vmin, 12px) clamp(4px, 0.6vmin, 8px)",
                    borderRadius: "clamp(6px, 0.9vmin, 11px)",
                    background: "rgba(255,255,255,0.028)",
                    border: `1px solid rgba(255,255,255,0.06)`,
                    borderTop: `2px solid ${accent}`,
                    boxShadow:
                      "0 0 14px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.04)",
                  }}
                >
                  <span
                    style={{
                      fontFamily: "var(--font-inter, system-ui, sans-serif)",
                      fontSize: "clamp(1.8rem, min(4.2vmin, 5vh), 5.5rem)",
                      fontWeight: 700,
                      lineHeight: 1,
                      color,
                      textShadow: `0 0 24px ${color}55`,
                      letterSpacing: "-0.01em",
                    }}
                  >
                    {value}
                  </span>
                  <span
                    style={{
                      fontFamily: "var(--font-inter, system-ui, sans-serif)",
                      fontSize: "clamp(14px, min(1.45vmin, 1.75vh), 1.6rem)",
                      fontWeight: 500,
                      textTransform: "uppercase",
                      letterSpacing: "0.18em",
                      color: "rgba(255,255,255,0.38)",
                    }}
                  >
                    {label}
                  </span>
                </div>
              ))}
            </div>

            <div className="relative min-h-0 flex-1">
              <PerformanceLineGraph
                data={verticalTrendline}
                pulseEvents={pulseEvents}
                todayDate={todayDate}
              />
            </div>
          </div>

          <div className="relative min-h-0 flex-[3]">
            <ConversionLedger
              rows={ledger}
              scrollDuration={ledgerScrollDuration}
              prefersReducedMotion={prefersReducedMotion}
            />
          </div>
        </div>

        <div className="flex min-h-[clamp(220px,28vh,380px)] flex-col lg:min-h-0">
          <DepartmentColumn
            department="shop"
            label="Shop"
            agents={shopAgents}
            shimmerStampByAgentId={shimmerStampByAgentId}
            prefersReducedMotion={prefersReducedMotion}
            leadStatusByAgent={leadStatusByAgent}
          />
        </div>
      </div>
    </section>
  );
}
