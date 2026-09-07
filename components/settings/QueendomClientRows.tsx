"use client";

/**
 * components/settings/QueendomClientRows.tsx
 *
 * Renewals / New Members for ONE queendom — the `renewals` and `members`
 * tables have the same shape and the same rule (a row counts for the IST
 * calendar month of its date), so one component serves both sections.
 *
 * The date field is the important one: it is the renewal / assignment DATE,
 * not the moment the row was typed. A date outside this month is allowed
 * (backfilling) but the form says out loud that the TV will not show it.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { QUEENDOM_DISPLAY_NAME } from "@/lib/queendom";
import type { QueendomId } from "@/types";
import { settingsRequest } from "./api";
import { Button, Card, DateInput, EmptyRow, Field, Notice, TextInput } from "./ui";

interface ClientRowRecord {
  id: string;
  client_name: string | null;
  created_at: string | null;
  resolvedQueendom: QueendomId | null;
}

export interface ClientRowsConfig {
  /** API path segment — also the table name. */
  endpoint: "renewals" | "members";
  addTitle: string;
  addDescription: string;
  listTitle: string;
  listDescription: string;
  dateLabel: string;
  nameLabel: string;
  namePlaceholder: string;
  /** Noun used in feedback, e.g. "Renewal". */
  entityLabel: string;
}

export const RENEWALS_CONFIG: ClientRowsConfig = {
  endpoint: "renewals",
  addTitle: "Record a renewal",
  addDescription:
    "Counts toward Renewals This Month and appears under Renewed Members on this Queendom's column.",
  listTitle: "Renewals",
  listDescription: "Newest first. The TV shows only entries dated in the current month.",
  dateLabel: "Renewal date",
  nameLabel: "Client name",
  namePlaceholder: "e.g. Ravi Kailas",
  entityLabel: "Renewal",
};

export const MEMBERS_CONFIG: ClientRowsConfig = {
  endpoint: "members",
  addTitle: "Add a new member",
  addDescription:
    "Appears under New Members on this Queendom's column. The membership itself (plan, amount, expiry) still comes from the client system — this is the assignment only.",
  listTitle: "New members",
  listDescription: "Newest first. The TV shows only entries dated in the current month.",
  dateLabel: "Assigned on",
  nameLabel: "Client name",
  namePlaceholder: "e.g. Richa Raj",
  entityLabel: "New member",
};

/** IST "today" as YYYY-MM-DD, for the date field's default. */
function istTodayInputValue(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** Stored timestamp → IST calendar date for display ("05 Sep 2026"). */
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

/** Stored timestamp → IST "YYYY-MM-DD" (for the edit form's date input). */
function istDateInputOf(iso: string | null): string {
  if (!iso) return istTodayInputValue();
  const ms = new Date(iso).getTime();
  if (Number.isNaN(ms)) return istTodayInputValue();
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(ms));
}

export function QueendomClientRows({
  queendom,
  config,
  onUnauthorized,
}: {
  queendom: QueendomId;
  config: ClientRowsConfig;
  onUnauthorized: () => void;
}) {
  const [rows, setRows] = useState<ClientRowRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [date, setDate] = useState(istTodayInputValue);
  const [saving, setSaving] = useState(false);

  const url = `/api/settings/${config.endpoint}`;

  const load = useCallback(async () => {
    setLoading(true);
    const res = await settingsRequest<{ rows: ClientRowRecord[] }>(
      `${url}?queendom=${queendom}&limit=120`,
    );
    setLoading(false);
    if (res.unauthorized) return onUnauthorized();
    if (!res.ok || !res.data) return setError(res.error);
    setError(null);
    setRows(res.data.rows ?? []);
  }, [url, queendom, onUnauthorized]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setNotice(null);
    setError(null);
  }, [queendom, config.endpoint]);

  const request = useCallback(
    async (init: { method: string; body: unknown }, successMessage: string, rowId?: string) => {
      setBusyId(rowId ?? "form");
      const res = await settingsRequest(url, init);
      setBusyId(null);
      if (res.unauthorized) return onUnauthorized();
      if (!res.ok) {
        setError(res.error);
        setNotice(null);
        return false;
      }
      setError(null);
      setNotice(successMessage);
      await load();
      return true;
    },
    [url, load, onUnauthorized],
  );

  const submit = useCallback(async () => {
    const trimmed = name.trim();
    if (!trimmed) return setError("Enter the client's name first.");
    setSaving(true);
    const ok = await request(
      { method: "POST", body: { client_name: trimmed, queendom, date } },
      `${config.entityLabel} recorded for ${trimmed} (${QUEENDOM_DISPLAY_NAME[queendom]}).`,
    );
    setSaving(false);
    if (ok) setName("");
  }, [name, queendom, date, request, config.entityLabel]);

  const currentMonth = useMemo(() => istTodayInputValue().slice(0, 7), []);
  const thisMonthCount = useMemo(
    () => rows.filter((r) => istDateInputOf(r.created_at).slice(0, 7) === currentMonth).length,
    [rows, currentMonth],
  );
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
          <div className="min-w-[240px] flex-[2]">
            <Field label={config.nameLabel}>
              <TextInput value={name} onChange={setName} placeholder={config.namePlaceholder} maxLength={120} />
            </Field>
          </div>
          <div className="min-w-[180px] flex-1">
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
              That date is outside this month, so this entry will not appear on the TV — the dashboard shows
              the current month only. Save it anyway if you are backfilling records.
            </Notice>
          </div>
        ) : null}
      </Card>

      <Card
        title={`${config.listTitle} · ${QUEENDOM_DISPLAY_NAME[queendom]}`}
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
          <EmptyRow>Nothing recorded for this Queendom yet.</EmptyRow>
        ) : (
          <ul className="flex flex-col divide-y divide-white/5">
            {rows.map((row) => (
              <ClientRow
                key={row.id}
                row={row}
                busy={busyId === row.id}
                onSave={(client_name, d) =>
                  request(
                    { method: "PATCH", body: { id: row.id, client_name, date: d } },
                    `${client_name} updated.`,
                    row.id,
                  )
                }
                onDelete={() =>
                  request({ method: "DELETE", body: { id: row.id } }, `${row.client_name ?? "Entry"} removed.`, row.id)
                }
              />
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

// ─── Row ──────────────────────────────────────────────────────────────────────

function ClientRow({
  row,
  busy,
  onSave,
  onDelete,
}: {
  row: ClientRowRecord;
  busy: boolean;
  onSave: (name: string, date: string) => Promise<boolean | void>;
  onDelete: () => void;
}) {
  const [mode, setMode] = useState<"view" | "edit" | "confirm-delete">("view");
  const [draftName, setDraftName] = useState(row.client_name ?? "");
  const [draftDate, setDraftDate] = useState(() => istDateInputOf(row.created_at));

  const startEdit = () => {
    setDraftName(row.client_name ?? "");
    setDraftDate(istDateInputOf(row.created_at));
    setMode("edit");
  };
  const commit = async () => {
    const next = draftName.trim().replace(/\s+/g, " ");
    if (!next) return;
    const ok = await onSave(next, draftDate);
    if (ok !== false) setMode("view");
  };

  if (mode === "edit") {
    return (
      <li className="py-2.5">
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void commit();
          }}
        >
          <div className="min-w-[200px] flex-[2]">
            <Field label="Client name">
              <TextInput value={draftName} onChange={setDraftName} maxLength={120} />
            </Field>
          </div>
          <div className="min-w-[160px] flex-1">
            <Field label="Date">
              <DateInput value={draftDate} onChange={setDraftDate} />
            </Field>
          </div>
          <Button type="submit" size="sm" disabled={busy || !draftName.trim()}>
            {busy ? "Saving…" : "Save"}
          </Button>
          <Button variant="subtle" size="sm" disabled={busy} onClick={() => setMode("view")}>
            Cancel
          </Button>
        </form>
      </li>
    );
  }

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 py-2.5">
      <span className="min-w-0 flex-1 truncate font-montserrat text-sm text-champagne">
        {row.client_name || "—"}
      </span>
      <div className="flex shrink-0 items-center gap-1">
        <span className="mr-2 font-montserrat text-[12px] tabular-nums text-charcoal-300">
          {formatIstDate(row.created_at)}
        </span>
        {mode === "confirm-delete" ? (
          <>
            <span className="font-montserrat text-[12px] text-red-200">Remove?</span>
            <Button variant="danger" size="sm" disabled={busy} onClick={onDelete}>
              {busy ? "Removing…" : "Yes, remove"}
            </Button>
            <Button variant="subtle" size="sm" disabled={busy} onClick={() => setMode("view")}>
              Cancel
            </Button>
          </>
        ) : (
          <>
            <Button variant="subtle" size="sm" disabled={busy} onClick={startEdit}>
              Edit
            </Button>
            <Button variant="danger" size="sm" disabled={busy} onClick={() => setMode("confirm-delete")}>
              Remove
            </Button>
          </>
        )}
      </div>
    </li>
  );
}
