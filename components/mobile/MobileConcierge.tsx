"use client";

/**
 * Concierge tab — the ranked feed, in the order questions are asked:
 *
 *   1. Needs attention  — top overdue tickets, static lines (never a marquee)
 *   2. Right now        — open / solved today / overdue, one row of three
 *   3. The month        — the two Queendoms side by side, with time since
 *                          each Queendom's last resolution (the phone's
 *                          ResolveStopwatch)
 *   4. Who's carrying it — top agents as name + bar; tap a row for the full
 *                          seven-metric breakdown the TV leaderboard shows
 *   5. Renewals due      — collapsed until asked
 *
 * All numbers come from the SAME aggregation the TV renders
 * (lib/ticketAggregation.ts via useDashboardData) — nothing is recomputed
 * here, so the phone can never disagree with the wall. Numerals roll in via
 * AnimatedCounter (the TV's spring odometer, en-IN grouping).
 */

import { useEffect, useMemo, useState } from "react";
import type { QueenStats, AgentStats } from "@/lib/types";
import type { OverdueTicketItem } from "@/types";
import { QUEENDOM_DISPLAY_NAME } from "@/lib/queendom";
import AnimatedCounter from "@/components/AnimatedCounter";

const ALERTS_SHOWN = 3;
const AGENTS_SHOWN = 6;

interface Props {
  ananyshreeStats: QueenStats;
  anishqaStats: QueenStats;
  overdueTickets: OverdueTicketItem[];
  isLoading: boolean;
}

/** "3m ago" / "2h ago" — minute-level is plenty for a glance. */
function timeAgo(ms: number | null | undefined, nowMs: number): string | null {
  if (!ms) return null;
  const mins = Math.max(0, Math.floor((nowMs - ms) / 60_000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function AgentRow({
  agent,
  maxScore,
  rank,
}: {
  agent: AgentStats;
  maxScore: number;
  rank: number;
}) {
  const [open, setOpen] = useState(false);
  const pct =
    maxScore > 0
      ? Math.max(4, Math.round((agent.tasksCompletedThisMonth / maxScore) * 100))
      : 0;

  return (
    <div className="m-agent" data-open={open} data-first={rank === 1}>
      <button
        className="m-agent-row"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="m-agent-rank">{rank}</span>
        <span className="m-agent-name">{agent.name}</span>
        <span className="m-agent-queendom" data-q={agent.queendom} aria-hidden />
        <span className="m-agent-score">{agent.tasksCompletedThisMonth}</span>
        <svg
          className="m-agent-chevron"
          width="12"
          height="12"
          viewBox="0 0 12 12"
          aria-hidden
        >
          <path
            d="M3 4.5 6 7.5 9 4.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      <div className="m-agent-bar" aria-hidden>
        <i style={{ transform: `scaleX(${pct / 100})` }} />
      </div>
      <div className="m-agent-detail">
        <div className="m-agent-detail-inner">
          <div className="m-mini-grid">
            <div className="m-mini">
              <span className="m-mini-label">Today</span>
              <span className="m-mini-num">
                {agent.tasksCompletedToday}
                <em>/{agent.tasksAssignedToday}</em>
              </span>
            </div>
            <div className="m-mini">
              <span className="m-mini-label">Month</span>
              <span className="m-mini-num">
                {agent.tasksCompletedThisMonth}
                <em>/{agent.tasksAssignedThisMonth}</em>
              </span>
            </div>
            <div className="m-mini">
              <span className="m-mini-label">Pending</span>
              <span className="m-mini-num">{agent.pendingScore}</span>
            </div>
            <div className="m-mini" data-warn={agent.overdueCount > 0}>
              <span className="m-mini-label">Overdue</span>
              <span className="m-mini-num">{agent.overdueCount}</span>
            </div>
            <div className="m-mini" data-warn={agent.incomplete > 0}>
              <span className="m-mini-label">Incomplete</span>
              <span className="m-mini-num">{agent.incomplete}</span>
            </div>
            <div className="m-mini">
              <span className="m-mini-label">Queendom</span>
              <span className="m-mini-num m-mini-text">
                {QUEENDOM_DISPLAY_NAME[agent.queendom]}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function MobileConcierge({
  ananyshreeStats,
  anishqaStats,
  overdueTickets,
  isLoading,
}: Props) {
  const [showAllAgents, setShowAllAgents] = useState(false);
  const [renewalsOpen, setRenewalsOpen] = useState(false);

  // Minute tick for the "last resolve" ages — glance-level freshness.
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const a = ananyshreeStats.tickets;
  const b = anishqaStats.tickets;

  const rankedAgents = useMemo(() => {
    return [...ananyshreeStats.agents, ...anishqaStats.agents].sort(
      (x, y) =>
        y.tasksCompletedThisMonth - x.tasksCompletedThisMonth ||
        y.tasksCompletedToday - x.tasksCompletedToday,
    );
  }, [ananyshreeStats.agents, anishqaStats.agents]);

  const visibleAgents = showAllAgents
    ? rankedAgents
    : rankedAgents.slice(0, AGENTS_SHOWN);
  const maxScore = rankedAgents[0]?.tasksCompletedThisMonth ?? 0;

  const renewalsDue = useMemo(() => {
    const all = [
      ...(ananyshreeStats.renewalsDue ?? []),
      ...(anishqaStats.renewalsDue ?? []),
    ];
    return all.sort((x, y) => x.endDate.localeCompare(y.endDate));
  }, [ananyshreeStats.renewalsDue, anishqaStats.renewalsDue]);

  const openNow = a.pendingToResolve + b.pendingToResolve;
  const solvedToday = a.solvedToday + b.solvedToday;

  if (isLoading) {
    return (
      <div className="m-feed" aria-busy>
        <div className="m-card m-skeleton skeleton-block" style={{ height: "8rem" }} />
        <div className="m-card m-skeleton skeleton-block" style={{ height: "5.5rem" }} />
        <div className="m-card m-skeleton skeleton-block" style={{ height: "14rem" }} />
      </div>
    );
  }

  const queendoms = [
    ["ananyshree", a, ananyshreeStats.lastResolvedAtMs] as const,
    ["anishqa", b, anishqaStats.lastResolvedAtMs] as const,
  ];

  return (
    <div className="m-feed">
      {/* 1 ── Needs attention */}
      {overdueTickets.length > 0 && (
        <section className="m-card" aria-label="Overdue tickets">
          <header className="m-card-head">
            <h2 className="m-label m-label-alert">Needs attention</h2>
            <span className="m-count-chip">{overdueTickets.length}</span>
          </header>
          <ul className="m-alert-list">
            {overdueTickets.slice(0, ALERTS_SHOWN).map((t) => (
              <li key={t.id} className="m-alert-line">
                <span className="m-alert-mark" aria-hidden />
                <span className="m-alert-subject">{t.subject}</span>
                <span className="m-alert-agent">{t.agentName}</span>
              </li>
            ))}
          </ul>
          {overdueTickets.length > ALERTS_SHOWN && (
            <p className="m-more-note">
              +{overdueTickets.length - ALERTS_SHOWN} more overdue
            </p>
          )}
        </section>
      )}

      {/* 2 ── Right now */}
      <section className="m-card m-card-hero" aria-label="Open tickets now">
        <h2 className="m-label">Open right now</h2>
        <p className="m-hero-num">
          <AnimatedCounter value={openNow} delay={250} slideOnChange />
        </p>
        <div className="m-stat-row" role="list">
          <div className="m-stat" role="listitem">
            <span className="m-stat-label">Solved today</span>
            <span className="m-stat-num" data-good={solvedToday > 0}>
              <AnimatedCounter value={solvedToday} delay={350} />
            </span>
          </div>
          <div className="m-stat" role="listitem">
            <span className="m-stat-label">Received</span>
            <span className="m-stat-num">
              <AnimatedCounter value={a.totalReceived + b.totalReceived} delay={450} />
            </span>
          </div>
          <div className="m-stat" role="listitem">
            <span className="m-stat-label">Overdue</span>
            <span className="m-stat-num" data-bad={overdueTickets.length > 0}>
              <AnimatedCounter value={overdueTickets.length} delay={550} />
            </span>
          </div>
        </div>
      </section>

      {/* 3 ── The month, per Queendom */}
      <section aria-label="This month by Queendom" className="m-queendoms">
        {queendoms.map(([id, t, lastResolvedAtMs]) => {
          const last = timeAgo(lastResolvedAtMs, nowMs);
          const fresh =
            !!lastResolvedAtMs && nowMs - lastResolvedAtMs < 30 * 60_000;
          return (
            <div key={id} className="m-card m-queendom-card">
              <h2 className="m-q-name">{QUEENDOM_DISPLAY_NAME[id]}</h2>
              <p className="m-q-num">
                <AnimatedCounter value={t.resolvedThisMonth} delay={500} />
              </p>
              <p className="m-q-sub">
                resolved of <strong>{t.totalReceived.toLocaleString("en-IN")}</strong>
              </p>
              <div className="m-q-meter" aria-hidden>
                <i
                  style={{
                    transform: `scaleX(${
                      t.totalReceived > 0
                        ? t.resolvedThisMonth / t.totalReceived
                        : 0
                    })`,
                  }}
                />
              </div>
              <div className="m-q-foot">
                <p className="m-q-pending" data-none={t.pendingToResolve === 0}>
                  {t.pendingToResolve} pending
                </p>
                {last && (
                  <p
                    className="m-q-last"
                    data-fresh={fresh}
                    title="Time since last resolution"
                  >
                    ✦ {last}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </section>

      {/* 4 ── Who's carrying it */}
      <section className="m-card" aria-label="Agent leaderboard">
        <header className="m-card-head">
          <h2 className="m-label">Top agents · this month</h2>
        </header>
        <div className="m-agent-list">
          {visibleAgents.map((agent, i) => (
            <AgentRow
              key={`${agent.queendom}-${agent.id}`}
              agent={agent}
              maxScore={maxScore}
              rank={i + 1}
            />
          ))}
        </div>
        {rankedAgents.length > AGENTS_SHOWN && (
          <button
            className="m-ghost-button"
            onClick={() => setShowAllAgents((v) => !v)}
            aria-expanded={showAllAgents}
          >
            {showAllAgents
              ? "Show fewer"
              : `All ${rankedAgents.length} agents`}
          </button>
        )}
      </section>

      {/* 5 ── Renewals, collapsed */}
      <section className="m-card m-card-fold" aria-label="Renewals due">
        <button
          className="m-fold-head"
          onClick={() => setRenewalsOpen((v) => !v)}
          aria-expanded={renewalsOpen}
        >
          <h2 className="m-label">Renewals due this month</h2>
          <span className="m-fold-meta">
            {renewalsDue.length > 0 && (
              <span className="m-count-chip">{renewalsDue.length}</span>
            )}
            <svg
              className="m-fold-chevron"
              width="12"
              height="12"
              viewBox="0 0 12 12"
              aria-hidden
            >
              <path
                d="M3 4.5 6 7.5 9 4.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        </button>
        <div className="m-fold-body" data-open={renewalsOpen}>
          <div className="m-fold-inner">
            {renewalsDue.length === 0 ? (
              <p className="m-empty">Nothing due this month.</p>
            ) : (
              <ul className="m-renewal-list">
                {renewalsDue.map((r, i) => (
                  <li key={`${r.name}-${r.endDate}-${i}`} className="m-renewal">
                    <span className="m-renewal-name">{r.name}</span>
                    <span className="m-renewal-type">
                      {r.membershipType ?? ""}
                    </span>
                    <span className="m-renewal-date">
                      {r.endDate.slice(8)}·{r.endDate.slice(5, 7)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
