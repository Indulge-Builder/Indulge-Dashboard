"use client";

/**
 * components/mobile/MobileInsights.tsx — the founder layer, woven into the
 * existing tabs (user decision 2026-08-20: no third tab):
 *
 *   - useInsights(): one fetch of GET /api/insights, 30/90-day switch
 *   - PulseSheet: full-screen slide-up opened from the Concierge hero —
 *     daily received/resolved chart, hourly arrival histogram, open-backlog
 *     aging, SLA breach-risk list
 *   - ServiceMixCard: collapsed card in the Concierge feed — the 17 luxury
 *     categories, channels, priorities
 *   - MembersCard / CsatCard: Revenue feed — top requesters, satisfaction
 *
 * Event math (labeled) — the TV's cohort math is a different definition.
 */

import { useCallback, useEffect, useState } from "react";
import { PulseChart, HourBars, MixBars, type PulsePoint } from "./charts";

// ── payload types (mirror /api/insights) ────────────────────────────────────
export interface InsightsPayload {
  days: number;
  pulse: {
    daily: PulsePoint[];
    hourly: number[];
    aging: { h4: number; h24: number; d3: number; older: number };
    open_now: number;
    breach_risk: Array<{
      ticket_id: string;
      subject: string;
      agent: string | null;
      due_by: string;
    }>;
    reopened: number;
  };
  agents: Array<{
    name: string;
    queendom: string | null;
    resolved: number;
    median_frt_min: number | null;
    p90_frt_min: number | null;
    median_res_hr: number | null;
    reopens: number;
    open_now: number;
    billable: number;
  }>;
  mix: {
    total: number;
    types: Array<{ k: string; n: number }>;
    sources: Array<{ k: string; n: number }>;
    priorities: Array<{ k: string; n: number }>;
    billable: number;
    invoice_total: number;
  };
  members: Array<{
    requester_id: number;
    client: string;
    tickets: number;
    open: number;
    urgent: number;
    types: string[] | null;
  }>;
  csat: {
    count: number;
    happy_pct: number | null;
    weekly: Array<{ w: string; happy: number; total: number }>;
    recent_low: Array<{
      ticket_id: string;
      agent: string | null;
      label: string;
      feedback: string;
      at: string;
    }>;
  };
}

export function useInsights() {
  const [days, setDays] = useState<30 | 90>(30);
  const [data, setData] = useState<InsightsPayload | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (d: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/insights?days=${d}`);
      if (res.ok) setData((await res.json()) as InsightsPayload);
    } catch (err) {
      console.error("[useInsights] fetch failed:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(days);
  }, [days, load]);

  return { insights: data, insightsLoading: loading, days, setDays };
}

// ── shared bits ──────────────────────────────────────────────────────────────
function RangeToggle({
  days,
  setDays,
}: {
  days: 30 | 90;
  setDays: (d: 30 | 90) => void;
}) {
  return (
    <div className="m-range" role="tablist" aria-label="Time range">
      {([30, 90] as const).map((d) => (
        <button
          key={d}
          role="tab"
          aria-selected={days === d}
          className="m-range-btn"
          data-active={days === d}
          onClick={() => setDays(d)}
        >
          {d}D
        </button>
      ))}
    </div>
  );
}

function dueLabel(dueBy: string): string {
  const mins = Math.round((new Date(dueBy).getTime() - Date.now()) / 60_000);
  if (mins <= 0) return "past due";
  if (mins < 60) return `${mins}m left`;
  return `${Math.round(mins / 60)}h left`;
}

// ── Pulse sheet ──────────────────────────────────────────────────────────────
const AGING_ROWS = [
  ["h4", "Under 4 hours"],
  ["h24", "4 – 24 hours"],
  ["d3", "1 – 3 days"],
  ["older", "Over 3 days"],
] as const;

export function PulseSheet({
  open,
  onClose,
  insights,
  loading,
  days,
  setDays,
}: {
  open: boolean;
  onClose: () => void;
  insights: InsightsPayload | null;
  loading: boolean;
  days: 30 | 90;
  setDays: (d: 30 | 90) => void;
}) {
  const pulse = insights?.pulse;
  const agingMax = pulse
    ? Math.max(1, pulse.aging.h4, pulse.aging.h24, pulse.aging.d3, pulse.aging.older)
    : 1;

  return (
    <div className="m-sheet" data-open={open} aria-hidden={!open}>
      <button className="m-sheet-backdrop" aria-label="Close" onClick={onClose} tabIndex={open ? 0 : -1} />
      <div className="m-sheet-panel" role="dialog" aria-modal="true" aria-label="Pulse — ticket analytics">
        <header className="m-sheet-head">
          <div>
            <h2 className="m-sheet-title">Pulse</h2>
            <p className="m-sheet-sub">By event date · IST</p>
          </div>
          <div className="m-sheet-controls">
            <RangeToggle days={days} setDays={setDays} />
            <button className="m-sheet-close" onClick={onClose} aria-label="Close pulse view">
              <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
                <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </header>

        <div className="m-sheet-body">
          {!pulse || (loading && !insights) ? (
            <div className="m-card m-skeleton skeleton-block" style={{ height: "12rem" }} />
          ) : (
            <>
              <section className="m-card" aria-label="Daily volume">
                <h3 className="m-label">Received vs resolved · {days}d</h3>
                <PulseChart daily={pulse.daily} />
              </section>

              <section className="m-card" aria-label="Arrivals by hour">
                <h3 className="m-label">When members ask</h3>
                <HourBars hourly={pulse.hourly} />
              </section>

              <section className="m-card" aria-label="Backlog age">
                <header className="m-card-head">
                  <h3 className="m-label">Open backlog age</h3>
                  <span className="m-count-chip">{pulse.open_now}</span>
                </header>
                <div className="m-mixbars">
                  {AGING_ROWS.map(([key, label]) => {
                    const n = pulse.aging[key];
                    const stale = key === "older" && n > 0;
                    return (
                      <div key={key} className="m-mixbar">
                        <span className="m-mixbar-label">{label}</span>
                        <span className="m-mixbar-n" data-bad={stale}>
                          {n}
                        </span>
                        <div className="m-mixbar-track" aria-hidden>
                          <i style={{ transform: `scaleX(${n / agingMax})` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
                {pulse.reopened > 0 && (
                  <p className="m-more-note">{pulse.reopened} reopened in {days}d</p>
                )}
              </section>

              {pulse.breach_risk.length > 0 && (
                <section className="m-card" aria-label="SLA breach risk">
                  <h3 className="m-label m-label-alert">Due within 4 hours</h3>
                  <ul className="m-alert-list">
                    {pulse.breach_risk.map((b) => (
                      <li key={b.ticket_id} className="m-alert-line">
                        <span className="m-alert-mark" aria-hidden />
                        <span className="m-alert-subject">{b.subject}</span>
                        <span className="m-alert-agent">
                          {b.agent ?? "Unassigned"} · {dueLabel(b.due_by)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Service mix (Concierge feed card) ───────────────────────────────────────
const PRIORITY_LABEL: Record<string, string> = {
  "1": "Low",
  "2": "Medium",
  "3": "High",
  "4": "Urgent",
  "0": "Unset",
};

export function ServiceMixCard({
  insights,
}: {
  insights: InsightsPayload | null;
}) {
  const [openSection, setOpenSection] = useState(false);
  const mix = insights?.mix;
  if (!mix || mix.total === 0) return null;

  return (
    <section className="m-card m-card-fold" aria-label="Service mix">
      <button
        className="m-fold-head"
        onClick={() => setOpenSection((v) => !v)}
        aria-expanded={openSection}
      >
        <h2 className="m-label">Service mix · {insights.days}d</h2>
        <span className="m-fold-meta">
          <span className="m-count-chip">{mix.total.toLocaleString("en-IN")}</span>
          <svg className="m-fold-chevron" width="12" height="12" viewBox="0 0 12 12" aria-hidden>
            <path d="M3 4.5 6 7.5 9 4.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </button>
      <div className="m-fold-body" data-open={openSection}>
        <div className="m-fold-inner">
          <h3 className="m-sublabel">What members asked for</h3>
          <MixBars items={mix.types} />
          <h3 className="m-sublabel">How they reached us</h3>
          <MixBars items={mix.sources} topN={4} />
          <div className="m-prio-row" aria-label="Priority mix">
            {mix.priorities.map((p) => (
              <span key={p.k} className="m-prio-chip" data-urgent={p.k === "4"}>
                {PRIORITY_LABEL[p.k] ?? p.k} · {p.n.toLocaleString("en-IN")}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Members + CSAT (Revenue feed cards) ─────────────────────────────────────
export function MembersCard({ insights }: { insights: InsightsPayload | null }) {
  const members = insights?.members;
  if (!members || members.length === 0) return null;
  return (
    <section className="m-card" aria-label="Top requesters">
      <header className="m-card-head">
        <h2 className="m-label">Top members · {insights.days}d</h2>
      </header>
      <ul className="m-member-list">
        {members.slice(0, 8).map((m) => (
          <li key={m.requester_id} className="m-member">
            <span className="m-member-name">{m.client}</span>
            <span className="m-member-meta">
              {m.urgent > 0 && <em className="m-member-urgent">{m.urgent} urgent</em>}
              {m.open > 0 && <em>{m.open} open</em>}
            </span>
            <span className="m-member-count">{m.tickets}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function CsatCard({ insights }: { insights: InsightsPayload | null }) {
  const csat = insights?.csat;
  if (!csat || csat.count === 0) return null;
  return (
    <section className="m-card" aria-label="Member satisfaction">
      <header className="m-card-head">
        <h2 className="m-label">Member satisfaction</h2>
        <span className="m-pct" data-good={(csat.happy_pct ?? 0) >= 80}>
          {csat.happy_pct ?? "–"}%
        </span>
      </header>
      <p className="m-q-sub">
        happy across <strong>{csat.count.toLocaleString("en-IN")}</strong> survey responses
      </p>
      {csat.recent_low.length > 0 && (
        <ul className="m-alert-list">
          {csat.recent_low.slice(0, 3).map((r) => (
            <li key={`${r.ticket_id}-${r.at}`} className="m-alert-line">
              <span className="m-alert-mark" aria-hidden />
              <span className="m-alert-subject">
                {r.feedback || r.label}
              </span>
              <span className="m-alert-agent">{r.agent ?? ""}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
