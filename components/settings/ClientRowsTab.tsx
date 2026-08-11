"use client";

/**
 * components/settings/ClientRowsTab.tsx
 *
 * One component for both the Renewals and New Clients tabs — the `renewals`
 * and `members` tables have the same shape and the same rule (a row counts for
 * the IST calendar month of its date).
 *
 * The date field is the important one: it is the renewal / assignment date,
 * NOT the moment the row was typed. Backdating a row into last month means the
 * TV will not show it, which is why the form says so out loud.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { QUEENDOM_DISPLAY_NAME } from "@/lib/queendom";
import type { QueendomId } from "@/types";
import { settingsRequest } from "./api";
import {
  Button,
  Card,
  DateInput,
  EmptyRow,
  Field,
  Notice,
  QUEENDOM_OPTIONS,
  QueendomChip,
  Select,
  TextInput,
} from "./ui";

interface ClientRowRecord {
  id: string;
  client_name: string | null;
  created_at: string | null;
  resolvedQueendom: QueendomId | null;
}

export interface ClientRowsTabConfig {
  /** API path segment — also the table name. */
  endpoint: "renewals" | "members";
  addTitle: string;
  addDescription: string;
  listTitle: string;
  listDescription: string;
  dateLabel: string;
  nameLabel: string;
  namePlaceholder: string;
  /** Verb used in the success message, e.g. "Renewal". */
  entityLabel: string;
}

/** IST "today" as YYYY-MM-DD, for the date field's default. */
function istTodayInputValue(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** Renders a stored timestamp as its IST calendar date. */
function formatIstDate(iso: string | null): string {
  if (!iso) return "—";
  const ms = new Date(iso).getTime();
  if (Number.isNaN(ms)) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(ms));
}

function istMonthOf(iso: string | null): string {
  if (!iso) return "";
  const ms = new Date(iso).getTime();
  if (Number.isNaN(ms)) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
  }).format(new Date(ms)).slice(0, 7);
}

export function ClientRowsTab({
  config,
  onUnauthorized,
}: {
  config: ClientRowsTabConfig;
  onUnauthorized: () => void;
}) {
  const [rows, setRows] = useState<ClientRowRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [queendom, setQueendom] = useState<QueendomId>("ananyshree");
  const [date, setDate] = useState(istTodayInputValue);
  const [saving, setSaving] = useState(false);

  const url = `/api/settings/${config.endpoint}`;

  const load = useCallback(async () => {
    setLoading(true);
    const res = await settingsRequest<{ rows: ClientRowRecord[] }>(`${url}?limit=60`);
    setLoading(false);
    if (res.unauthorized) return onUnauthorized();
    if (!res.ok || !res.data) return setError(res.error);
    setError(null);
    setRows(res.data.rows ?? []);
  }, [url, onUnauthorized]);

  useEffect(() => {
    void load();
  }, [load]);

  const submit = useCallback(async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Enter the client's name first.");
      return;
    }
    setSaving(true);
    const res = await settingsRequest(url, {
      method: "POST",
      body: { client_name: trimmed, queendom, date },
    });
    setSaving(false);
    if (res.unauthorized) return onUnauthorized();
    if (!res.ok) {
      setError(res.error);
      setNotice(null);
      return;
    }
    setError(null);
    setNotice(
      `${config.entityLabel} recorded for ${trimmed} (${QUEENDOM_DISPLAY_NAME[queendom]}).`,
    );
    setName("");
    await load();
  }, [name, queendom, date, url, config.entityLabel, load, onUnauthorized]);

  const remove = useCallback(
    async (row: ClientRowRecord) => {
      setBusyId(row.id);
      const res = await settingsRequest(url, { method: "DELETE", body: { id: row.id } });
      setBusyId(null);
      if (res.unauthorized) return onUnauthorized();
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setError(null);
      setNotice(`${row.client_name ?? "Entry"} removed.`);
      await load();
    },
    [url, load, onUnauthorized],
  );

  const currentMonth = useMemo(() => istMonthOf(new Date().toISOString()), []);
  const thisMonthCount = useMemo(
    () => rows.filter((r) => istMonthOf(r.created_at) === currentMonth).length,
    [rows, currentMonth],
  );

  // A date outside the current IST month is legal but will not appear on the
  // TV, which reads the current month only. Warn rather than block — backfilling
  // last month's records is a legitimate thing to want to do.
  const isOutsideCurrentMonth = date.slice(0, 7) !== currentMonth;

  return (
    <div className="flex flex-col gap-6">
      {error ? <Notice tone="error">{error}</Notice> : null}
      {notice && !error ? <Notice tone="success">{notice}</Notice> : null}

      <Card title={config.addTitle} description={config.addDescription}>
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <div className="min-w-[220px] flex-[2]">
            <Field label={config.nameLabel}>
              <TextInput
                value={name}
                onChange={setName}
                placeholder={config.namePlaceholder}
                maxLength={120}
              />
            </Field>
          </div>
          <div className="min-w-[160px] flex-1">
            <Field label="Queendom">
              <Select value={queendom} onChange={setQueendom} options={QUEENDOM_OPTIONS} />
            </Field>
          </div>
          <div className="min-w-[170px] flex-1">
            <Field label={config.dateLabel}>
              <DateInput value={date} onChange={setDate} />
            </Field>
          </div>
          <Button type="submit" disabled={saving || !name.trim()}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </form>

        {isOutsideCurrentMonth ? (
          <div className="mt-3">
            <Notice tone="info">
              That date is outside this month, so this entry will not appear on the TV —
              the dashboard shows the current month only. Save it anyway if you are
              backfilling records.
            </Notice>
          </div>
        ) : null}
      </Card>

      <Card
        title={config.listTitle}
        description={config.listDescription}
        action={
          <span className="rounded-full border border-[var(--border-gold-subtle)] px-3 py-1 font-montserrat text-[12px] text-gold-300">
            {thisMonthCount} this month
          </span>
        }
      >
        {loading ? (
          <EmptyRow>Loading…</EmptyRow>
        ) : rows.length === 0 ? (
          <EmptyRow>Nothing recorded yet.</EmptyRow>
        ) : (
          <ul className="flex flex-col divide-y divide-white/5">
            {rows.map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-3 py-2.5"
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <span className="min-w-0 truncate font-montserrat text-sm text-champagne">
                    {row.client_name || "—"}
                  </span>
                  <QueendomChip queendom={row.resolvedQueendom} />
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="font-montserrat text-[12px] text-charcoal-300">
                    {formatIstDate(row.created_at)}
                  </span>
                  <Button
                    variant="danger"
                    disabled={busyId === row.id}
                    onClick={() => void remove(row)}
                  >
                    {busyId === row.id ? "Removing…" : "Remove"}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
