"use client";

/**
 * Revenue tab — the Zoho side, same ranked-feed grammar as Concierge:
 *
 *   1. The month     — closures + leads, one hero pair
 *   2. Lead health   — attended / closed / junk of this month's leads
 *   3. Departments   — Concierge Onboarding and Shop Sales agent rows
 *   4. Live ledger   — latest closures, newest first
 *
 * Data comes straight from useOnboardingPanelData — the same payload the TV
 * renders. Amounts are deliberately absent here (the ledger row shape has
 * none); if rupee figures ever join this view, revisit who can see them.
 */

import { useMemo } from "react";
import type {
  OnboardingAgentRow,
  OnboardingLedgerRow,
  LeadMonthStats,
} from "@/lib/onboardingTypes";
import { toISTDay, istToday } from "@/lib/istDate";

const LEDGER_SHOWN = 6;

interface Props {
  conciergeAgents: OnboardingAgentRow[];
  shopAgents: OnboardingAgentRow[];
  ledger: OnboardingLedgerRow[];
  leadMonthStats?: LeadMonthStats;
}

function DeptBlock({
  title,
  agents,
}: {
  title: string;
  agents: OnboardingAgentRow[];
}) {
  const ranked = useMemo(
    () => [...agents].sort((a, b) => b.totalConverted - a.totalConverted),
    [agents],
  );
  const max = ranked[0]?.totalConverted ?? 0;

  return (
    <section className="m-card" aria-label={title}>
      <header className="m-card-head">
        <h2 className="m-label">{title}</h2>
      </header>
      <div className="m-agent-list">
        {ranked.map((agent) => (
          <div key={agent.id} className="m-agent">
            <div className="m-agent-row m-agent-row-static">
              <span className="m-agent-name">{agent.name}</span>
              <span className="m-rev-leads">
                {agent.leadsCreatedThisMonth} leads
              </span>
              <span className="m-agent-score">{agent.totalConverted}</span>
            </div>
            <div className="m-agent-bar" aria-hidden>
              <i
                style={{
                  transform: `scaleX(${
                    max > 0 ? Math.max(0.04, agent.totalConverted / max) : 0
                  })`,
                }}
              />
            </div>
          </div>
        ))}
        {ranked.length === 0 && <p className="m-empty">No agents yet.</p>}
      </div>
    </section>
  );
}

export default function MobileRevenue({
  conciergeAgents,
  shopAgents,
  ledger,
  leadMonthStats,
}: Props) {
  const closuresThisMonth =
    (leadMonthStats?.dealsClosedThisMonth ?? 0) ||
    [...conciergeAgents, ...shopAgents].reduce(
      (sum, a) => sum + a.totalConverted,
      0,
    );
  const leads = leadMonthStats?.leads ?? 0;
  const attended = leadMonthStats?.attended ?? 0;
  const junk = leadMonthStats?.junk ?? 0;
  const attendedPct = leads > 0 ? attended / leads : 0;

  const todayIst = istToday().day;
  const recentLedger = ledger.slice(0, LEDGER_SHOWN);

  return (
    <div className="m-feed">
      {/* 1 ── The month */}
      <section className="m-card m-card-hero" aria-label="Closures this month">
        <h2 className="m-label">Closed this month</h2>
        <p className="m-hero-num">{closuresThisMonth}</p>
        <div className="m-stat-row" role="list">
          <div className="m-stat" role="listitem">
            <span className="m-stat-label">Leads</span>
            <span className="m-stat-num">{leads}</span>
          </div>
          <div className="m-stat" role="listitem">
            <span className="m-stat-label">Attended</span>
            <span className="m-stat-num">{attended}</span>
          </div>
          <div className="m-stat" role="listitem">
            <span className="m-stat-label">Junk</span>
            <span className="m-stat-num">{junk}</span>
          </div>
        </div>
      </section>

      {/* 2 ── Lead health */}
      {leads > 0 && (
        <section className="m-card" aria-label="Lead attention rate">
          <header className="m-card-head">
            <h2 className="m-label">Leads attended</h2>
            <span className="m-fold-meta m-pct">
              {Math.round(attendedPct * 100)}%
            </span>
          </header>
          <div className="m-q-meter m-meter-tall" aria-hidden>
            <i style={{ transform: `scaleX(${attendedPct})` }} />
          </div>
        </section>
      )}

      {/* 3 ── Departments */}
      <DeptBlock title="Concierge onboarding" agents={conciergeAgents} />
      <DeptBlock title="Shop sales" agents={shopAgents} />

      {/* 4 ── Live ledger */}
      <section className="m-card" aria-label="Latest closures">
        <header className="m-card-head">
          <h2 className="m-label">Latest closures</h2>
        </header>
        {recentLedger.length === 0 ? (
          <p className="m-empty">No closures recorded yet.</p>
        ) : (
          <ul className="m-ledger">
            {recentLedger.map((row) => {
              const isToday = toISTDay(row.recordedAt) === todayIst;
              return (
                <li key={row.id} className="m-ledger-row">
                  <span className="m-ledger-client">{row.clientName}</span>
                  <span className="m-ledger-agent">{row.agentName}</span>
                  <span className="m-ledger-when" data-today={isToday}>
                    {isToday ? "today" : toISTDay(row.recordedAt).slice(5)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
