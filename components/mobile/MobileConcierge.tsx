"use client";

/**
 * Concierge tab — the ranked feed, now driven by a PERIOD FILTER:
 *
 *   1. Needs attention  — overdue tickets, always "now" (above the filter)
 *   2. Period filter    — Today / This Week / This Month / Last Month;
 *                          everything below re-anchors to it
 *   3. Resolved hero    — the period's headline (tap → Pulse analytics)
 *   4. The Queendoms    — tap a Queendom to filter the agent list to it
 *   5. The agents       — every active roster agent, ranked by ON-TIME
 *                          resolves, each racing a playful target meter
 *                          (125 on-time per month; paced down for shorter
 *                          periods), with the full breakdown on tap
 *   6. Service mix / Renewals — unchanged
 *
 * Data: GET /api/scoreboard?period= (insights_scoreboard — cohort math on
 * created_at, live Queendoms + active roster only). "On-time" = resolved
 * without going overdue (beat due_by, or no SLA clock). The realtime
 * overdue list and last-resolve ages still come from useDashboardData.
 */

import { useEffect, useMemo, useState } from "react";
import type { QueenStats } from "@/lib/types";
import type { OverdueTicketItem } from "@/types";
import { QUEENDOM_DISPLAY_NAME } from "@/lib/queendom";
import AnimatedCounter from "@/components/AnimatedCounter";
import { ServiceMixCard, type InsightsPayload } from "./MobileInsights";

const ALERTS_SHOWN = 3;
const AGENTS_SHOWN = 6;

type Period = "today" | "week" | "month" | "last-month";
type QueendomId = "ananyshree" | "anishqa";

const PERIODS: Array<{ id: Period; label: string }> = [
  { id: "today", label: "Today" },
  { id: "week", label: "Week" },
  { id: "month", label: "Month" },
  { id: "last-month", label: "Last Mo" },
];
const PERIOD_TITLE: Record<Period, string> = {
  today: "today",
  week: "this week",
  month: "this month",
  "last-month": "last month",
};
/** The game: 125 on-time resolves per agent per month, paced per period. */
const PERIOD_TARGET: Record<Period, number> = {
  today: 4, // ≈ 125 / 30, the daily pace
  week: 29, // ≈ 125 × 7/30
  month: 125,
  "last-month": 125,
};

interface ScoreAgent {
  name: string;
  queendom: QueendomId;
  received: number;
  resolved: number;
  ontime: number;
  pending: number;
  overdue_p: number;
  incomplete_p: number;
  avg_res_hr: number | null;
  reopens_p: number;
  overdue_open: number;
}
interface QueendomScore {
  received: number;
  resolved: number;
  ontime: number;
  pending: number;
}
interface Scoreboard {
  period: Period;
  queendoms: Partial<Record<QueendomId, QueendomScore>>;
  agents: ScoreAgent[];
}

function useScoreboard(period: Period) {
  const [board, setBoard] = useState<Scoreboard | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`/api/scoreboard?period=${period}`);
        if (res.ok && !cancelled) setBoard((await res.json()) as Scoreboard);
      } catch (err) {
        console.error("[useScoreboard]", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    setLoading(true);
    void load();
    const id = setInterval(load, 60_000); // keep the game live
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [period]);
  return { board, loading };
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

interface Props {
  ananyshreeStats: QueenStats;
  anishqaStats: QueenStats;
  overdueTickets: OverdueTicketItem[];
  isLoading: boolean;
  insights: InsightsPayload | null;
  onOpenPulse: () => void;
}

function AgentRow({
  agent,
  rank,
  target,
}: {
  agent: ScoreAgent;
  rank: number;
  target: number;
}) {
  const [open, setOpen] = useState(false);
  const met = agent.ontime >= target;
  // Stacked composition of the period's tickets — full bar = received.
  // Escalated wins over incomplete (they partition the open cohort);
  // the neutral remainder is the calm pending rest.
  const total = Math.max(1, agent.received);
  const pendingRest = Math.max(
    0,
    agent.pending - agent.overdue_p - agent.incomplete_p,
  );
  const seg = (n: number) => `${(n / total) * 100}%`;

  return (
    <div className="m-agent" data-open={open} data-first={rank === 1} data-met={met}>
      <button
        className="m-agent-row"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="m-agent-rank">{rank}</span>
        <span className="m-agent-name">{agent.name}</span>
        <span className="m-agent-queendom" data-q={agent.queendom} aria-hidden />
        {met && (
          <span className="m-target-star" title="Target met" aria-label="Target met">
            ✦
          </span>
        )}
        <span className="m-agent-score" data-met={met}>
          {agent.ontime}
          <em>/{target}</em>
        </span>
        <svg className="m-agent-chevron" width="12" height="12" viewBox="0 0 12 12" aria-hidden>
          <path d="M3 4.5 6 7.5 9 4.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {/* composition bar — the period's tickets, colour-coded */}
      <div
        className="m-comp-bar"
        role="img"
        aria-label={`${agent.received} tickets: ${agent.resolved} resolved, ${agent.overdue_p} overdue, ${agent.incomplete_p} incomplete, ${pendingRest} pending`}
      >
        {agent.resolved > 0 && (
          <i className="m-seg-resolved" style={{ width: seg(agent.resolved) }} />
        )}
        {agent.incomplete_p > 0 && (
          <i className="m-seg-incomplete" style={{ width: seg(agent.incomplete_p) }} />
        )}
        {agent.overdue_p > 0 && (
          <i className="m-seg-overdue" style={{ width: seg(agent.overdue_p) }} />
        )}
        {pendingRest > 0 && (
          <i className="m-seg-pending" style={{ width: seg(pendingRest) }} />
        )}
      </div>
      <div className="m-agent-detail">
        <div className="m-agent-detail-inner">
          <div className="m-mini-grid">
            <div className="m-mini">
              <span className="m-mini-label">
                <i className="m-key m-seg-resolved" aria-hidden />Resolved
              </span>
              <span className="m-mini-num">{agent.resolved}</span>
            </div>
            <div className="m-mini" data-warn={agent.overdue_p > 0}>
              <span className="m-mini-label">
                <i className="m-key m-seg-overdue" aria-hidden />Overdue
              </span>
              <span className="m-mini-num">{agent.overdue_p}</span>
            </div>
            <div className="m-mini">
              <span className="m-mini-label">
                <i className="m-key m-seg-incomplete" aria-hidden />Incomplete
              </span>
              <span className="m-mini-num">{agent.incomplete_p}</span>
            </div>
            <div className="m-mini">
              <span className="m-mini-label">
                <i className="m-key m-seg-pending" aria-hidden />Pending
              </span>
              <span className="m-mini-num">{pendingRest}</span>
            </div>
            <div className="m-mini">
              <span className="m-mini-label">On-time</span>
              <span className="m-mini-num">
                {agent.ontime}
                <em>/{agent.resolved}</em>
              </span>
            </div>
            <div className="m-mini">
              <span className="m-mini-label">Received</span>
              <span className="m-mini-num">{agent.received}</span>
            </div>
            <div className="m-mini">
              <span className="m-mini-label">Avg resolution</span>
              <span className="m-mini-num">
                {agent.avg_res_hr != null ? `${agent.avg_res_hr}h` : "–"}
              </span>
            </div>
            <div className="m-mini" data-warn={agent.reopens_p > 0}>
              <span className="m-mini-label">Reopens</span>
              <span className="m-mini-num">{agent.reopens_p}</span>
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
  insights,
  onOpenPulse,
}: Props) {
  const [period, setPeriod] = useState<Period>("month");
  const [selectedQ, setSelectedQ] = useState<QueendomId | null>(null);
  const [showAllAgents, setShowAllAgents] = useState(false);
  const [renewalsOpen, setRenewalsOpen] = useState(false);
  const { board, loading: boardLoading } = useScoreboard(period);

  // Minute tick for the "last resolve" ages — glance-level freshness.
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const target = PERIOD_TARGET[period];
  const qa: QueendomScore =
    board?.queendoms.ananyshree ?? { received: 0, resolved: 0, ontime: 0, pending: 0 };
  const qb: QueendomScore =
    board?.queendoms.anishqa ?? { received: 0, resolved: 0, ontime: 0, pending: 0 };

  const agents = useMemo(() => {
    const all = board?.agents ?? [];
    return selectedQ ? all.filter((a) => a.queendom === selectedQ) : all;
  }, [board?.agents, selectedQ]);
  const visibleAgents = showAllAgents ? agents : agents.slice(0, AGENTS_SHOWN);

  const renewalsDue = useMemo(() => {
    const all = [
      ...(ananyshreeStats.renewalsDue ?? []),
      ...(anishqaStats.renewalsDue ?? []),
    ];
    return all.sort((x, y) => x.endDate.localeCompare(y.endDate));
  }, [ananyshreeStats.renewalsDue, anishqaStats.renewalsDue]);

  const lastResolved: Record<QueendomId, number | null | undefined> = {
    ananyshree: ananyshreeStats.lastResolvedAtMs,
    anishqa: anishqaStats.lastResolvedAtMs,
  };

  if (isLoading && !board) {
    return (
      <div className="m-feed" aria-busy>
        <div className="m-card m-skeleton" style={{ height: "8rem" }} />
        <div className="m-card m-skeleton" style={{ height: "5.5rem" }} />
        <div className="m-card m-skeleton" style={{ height: "14rem" }} />
      </div>
    );
  }

  const queendomCards: Array<[QueendomId, QueendomScore]> = [
    ["ananyshree", qa],
    ["anishqa", qb],
  ];

  return (
    <div className="m-feed">
      {/* 1 ── Needs attention — always NOW, above the period filter */}
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

      {/* 2 ── Period filter — everything below re-anchors to it */}
      <nav className="m-period" role="tablist" aria-label="Time period">
        {PERIODS.map((p) => (
          <button
            key={p.id}
            role="tab"
            aria-selected={period === p.id}
            className="m-period-btn"
            data-active={period === p.id}
            onClick={() => setPeriod(p.id)}
          >
            {p.label}
          </button>
        ))}
      </nav>

      {/* 3 ── Resolved hero (tap → Pulse) */}
      <button
        className="m-card m-card-hero m-card-tap"
        aria-label={`Resolved ${PERIOD_TITLE[period]} — tap for pulse analytics`}
        onClick={onOpenPulse}
        data-dim={boardLoading}
      >
        <span className="m-card-head">
          <h2 className="m-label">Resolved · {PERIOD_TITLE[period]}</h2>
          <span className="m-tap-hint" aria-hidden>
            Pulse
            <svg width="11" height="11" viewBox="0 0 12 12">
              <path d="M4.5 3 7.5 6 4.5 9" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </span>
        <p className="m-hero-num">
          <AnimatedCounter key={period} value={qa.resolved + qb.resolved} delay={250} slideOnChange />
        </p>
        <div className="m-stat-row" role="list">
          <div className="m-stat" role="listitem">
            <span className="m-stat-label">Received</span>
            <span className="m-stat-num">
              <AnimatedCounter key={period} value={qa.received + qb.received} delay={350} />
            </span>
          </div>
          <div className="m-stat" role="listitem">
            <span className="m-stat-label">On-time</span>
            <span className="m-stat-num" data-good={qa.ontime + qb.ontime > 0}>
              <AnimatedCounter key={period} value={qa.ontime + qb.ontime} delay={450} />
            </span>
          </div>
          <div className="m-stat" role="listitem">
            <span className="m-stat-label">Pending</span>
            <span className="m-stat-num">
              <AnimatedCounter key={period} value={qa.pending + qb.pending} delay={550} />
            </span>
          </div>
        </div>
      </button>

      {/* 4 ── The Queendoms — tap one to focus its agents */}
      <section aria-label="Queendoms" className="m-queendoms">
        {queendomCards.map(([id, q]) => {
          const last = timeAgo(lastResolved[id], nowMs);
          const fresh = !!lastResolved[id] && nowMs - lastResolved[id]! < 30 * 60_000;
          const selected = selectedQ === id;
          return (
            <button
              key={id}
              className="m-card m-queendom-card m-card-tap"
              aria-pressed={selected}
              data-selected={selected}
              onClick={() => setSelectedQ(selected ? null : id)}
            >
              <h2 className="m-q-name">{QUEENDOM_DISPLAY_NAME[id]}</h2>
              <p className="m-q-num">
                <AnimatedCounter key={period} value={q.resolved} delay={500} />
              </p>
              <p className="m-q-sub">
                resolved of <strong>{q.received.toLocaleString("en-IN")}</strong>
              </p>
              <div className="m-q-meter" aria-hidden>
                <i
                  style={{
                    transform: `scaleX(${q.received > 0 ? q.resolved / q.received : 0})`,
                  }}
                />
              </div>
              <span className="m-q-foot">
                <span className="m-q-pending" data-none={q.pending === 0}>
                  {q.pending} pending
                </span>
                {last && (
                  <span className="m-q-last" data-fresh={fresh}>
                    ✦ {last}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </section>

      {/* 5 ── The agents, racing the target */}
      <section className="m-card" aria-label="Agent leaderboard">
        <header className="m-card-head">
          <h2 className="m-label">
            {selectedQ
              ? `${QUEENDOM_DISPLAY_NAME[selectedQ]}'s agents`
              : "Agents · on-time race"}
          </h2>
          {selectedQ ? (
            <button className="m-clear-filter" onClick={() => setSelectedQ(null)}>
              All agents ✕
            </button>
          ) : (
            <span className="m-target-note">target {target}</span>
          )}
        </header>
        <div className="m-agent-list" data-dim={boardLoading}>
          {visibleAgents.map((agent, i) => (
            <AgentRow
              key={`${agent.queendom}-${agent.name}`}
              agent={agent}
              rank={i + 1}
              target={target}
            />
          ))}
          {visibleAgents.length === 0 && (
            <p className="m-empty">No agents yet for this view.</p>
          )}
        </div>
        {agents.length > AGENTS_SHOWN && (
          <button
            className="m-ghost-button"
            onClick={() => setShowAllAgents((v) => !v)}
            aria-expanded={showAllAgents}
          >
            {showAllAgents ? "Show fewer" : `All ${agents.length} agents`}
          </button>
        )}
      </section>

      {/* 6 ── Service mix (founder layer) */}
      <ServiceMixCard insights={insights} />

      {/* 7 ── Renewals, collapsed */}
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
            <svg className="m-fold-chevron" width="12" height="12" viewBox="0 0 12 12" aria-hidden>
              <path d="M3 4.5 6 7.5 9 4.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
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
                    <span className="m-renewal-type">{r.membershipType ?? ""}</span>
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
