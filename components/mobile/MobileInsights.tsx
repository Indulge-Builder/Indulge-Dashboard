"use client";

/**
 * components/mobile/MobileInsights.tsx — the founder layer's sheets:
 *
 *   - useInsights(): GET /api/insights (30/90-day switch) — powers Pulse
 *   - PulseSheet: slimmed 2026-08-20 to the one chart that earns its keep —
 *     "When members ask" (hourly arrivals) + the reopened count. The daily
 *     line chart, backlog aging and breach list were cut (user: low value /
 *     duplicated the Needs-attention flow).
 *   - OverdueSheet: the Needs-attention drill-down — every open escalated
 *     ticket; tap one to unfold the detail the `tickets` table holds
 *     (status, priority, type, channel, created/due/waiting-since).
 */

import { useCallback, useEffect, useState } from "react";
import { HourBars, type PulsePoint } from "./charts";
import type { OverdueDetailRow } from "@/app/api/tickets/overdue-list/route";

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

function SheetFrame({
  open,
  onClose,
  title,
  sub,
  controls,
  children,
  label,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  sub: string;
  controls?: React.ReactNode;
  children: React.ReactNode;
  label: string;
}) {
  return (
    <div className="m-sheet" data-open={open} aria-hidden={!open}>
      <button
        className="m-sheet-backdrop"
        aria-label="Close"
        onClick={onClose}
        tabIndex={open ? 0 : -1}
      />
      <div className="m-sheet-panel" role="dialog" aria-modal="true" aria-label={label}>
        <header className="m-sheet-head">
          <div>
            <h2 className="m-sheet-title">{title}</h2>
            <p className="m-sheet-sub">{sub}</p>
          </div>
          <div className="m-sheet-controls">
            {controls}
            <button className="m-sheet-close" onClick={onClose} aria-label="Close">
              <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
                <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </header>
        <div className="m-sheet-body">{children}</div>
      </div>
    </div>
  );
}

// ── Pulse sheet — when members ask ───────────────────────────────────────────
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
  return (
    <SheetFrame
      open={open}
      onClose={onClose}
      title="Pulse"
      sub="Arrivals by hour · IST"
      label="Pulse — arrival analytics"
      controls={<RangeToggle days={days} setDays={setDays} />}
    >
      {!pulse || (loading && !insights) ? (
        <div className="m-card m-skeleton" style={{ height: "10rem" }} />
      ) : (
        <section className="m-card" aria-label="Arrivals by hour">
          <h3 className="m-label">When members ask · {days}d</h3>
          <HourBars hourly={pulse.hourly} />
          {pulse.reopened > 0 && (
            <p className="m-more-note">{pulse.reopened} tickets reopened in {days}d</p>
          )}
        </section>
      )}
    </SheetFrame>
  );
}

// ── Overdue sheet — the Needs-attention drill-down ──────────────────────────
const PRIORITY_LABEL: Record<number, string> = {
  1: "Low",
  2: "Medium",
  3: "High",
  4: "Urgent",
};

function istStamp(ts: string | null): string {
  if (!ts) return "–";
  return new Date(ts).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ageOf(ts: string | null): string {
  if (!ts) return "";
  const h = Math.floor((Date.now() - new Date(ts).getTime()) / 3_600_000);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function OverdueRow({ t }: { t: OverdueDetailRow }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="m-agent" data-open={open}>
      <button className="m-agent-row" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span className="m-alert-mark" aria-hidden />
        <span className="m-agent-name">
          {t.subject?.trim() || `Ticket #${t.ticket_id}`}
        </span>
        <span className="m-alert-agent">{ageOf(t.created_at)}</span>
        <svg className="m-agent-chevron" width="12" height="12" viewBox="0 0 12 12" aria-hidden>
          <path d="M3 4.5 6 7.5 9 4.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <div className="m-agent-detail">
        <div className="m-agent-detail-inner">
          <div className="m-mini-grid m-mini-grid-flush">
            <div className="m-mini">
              <span className="m-mini-label">Ticket</span>
              <span className="m-mini-num m-mini-text">#{t.ticket_id}</span>
            </div>
            <div className="m-mini">
              <span className="m-mini-label">Status</span>
              <span className="m-mini-num m-mini-text">{t.status ?? "–"}</span>
            </div>
            <div className="m-mini" data-warn={t.priority === 4}>
              <span className="m-mini-label">Priority</span>
              <span className="m-mini-num m-mini-text">
                {t.priority != null ? (PRIORITY_LABEL[t.priority] ?? t.priority) : "–"}
              </span>
            </div>
            <div className="m-mini">
              <span className="m-mini-label">Agent</span>
              <span className="m-mini-num m-mini-text">{t.agent_name ?? "Unassigned"}</span>
            </div>
            <div className="m-mini">
              <span className="m-mini-label">Queendom</span>
              <span className="m-mini-num m-mini-text">{t.queendom_name ?? "–"}</span>
            </div>
            <div className="m-mini">
              <span className="m-mini-label">Type</span>
              <span className="m-mini-num m-mini-text">{t.ticket_type ?? "–"}</span>
            </div>
            <div className="m-mini">
              <span className="m-mini-label">Channel</span>
              <span className="m-mini-num m-mini-text">{t.source ?? "–"}</span>
            </div>
            <div className="m-mini">
              <span className="m-mini-label">Created</span>
              <span className="m-mini-num m-mini-text">{istStamp(t.created_at)}</span>
            </div>
            <div className="m-mini" data-warn>
              <span className="m-mini-label">Due by</span>
              <span className="m-mini-num m-mini-text">{istStamp(t.due_by)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function OverdueSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [rows, setRows] = useState<OverdueDetailRow[] | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetch("/api/tickets/overdue-list")
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => !cancelled && setRows(d as OverdueDetailRow[]))
      .catch(() => !cancelled && setRows([]));
    return () => {
      cancelled = true;
    };
  }, [open]);

  return (
    <SheetFrame
      open={open}
      onClose={onClose}
      title="Needs attention"
      sub={rows ? `${rows.length} overdue · oldest first` : "Loading…"}
      label="Overdue tickets"
    >
      {rows == null ? (
        <div className="m-card m-skeleton" style={{ height: "10rem" }} />
      ) : rows.length === 0 ? (
        <p className="m-empty">Nothing overdue. ✦</p>
      ) : (
        <section className="m-card" aria-label="Overdue tickets, oldest first">
          <div className="m-agent-list">
            {rows.map((t) => (
              <OverdueRow key={t.ticket_id} t={t} />
            ))}
          </div>
        </section>
      )}
    </SheetFrame>
  );
}
