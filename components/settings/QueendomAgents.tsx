"use client";

/**
 * components/settings/QueendomAgents.tsx
 *
 * The roster editor for ONE queendom: add · rename · hide/show · move · remove,
 * plus the queendom's Joker and the "filing tickets but not on the roster"
 * notice. Reads the whole `agents` table once (GET /api/settings/agents) and
 * scopes it client-side, so switching queendoms is instant.
 *
 * Why the Joker is here: the Spoiled tile (hidden for now) aggregates the
 * `jokers` table by the Joker's name, so the name must be on file even while
 * the tile is off. The leaderboard itself never shows Jokers.
 *
 * Fallback notice: when a queendom has ZERO rows on file (any role or state)
 * the TV falls back to the built-in list in lib/agentRoster.ts (see
 * rosterFromAgentRows). Staff are told so they know the names on screen are
 * not theirs until they add someone.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import type { AgentRecord, AgentRole } from "@/lib/agentRoster";
import { QUEENDOM_DISPLAY_NAME, QUEENDOM_IDS } from "@/lib/queendom";
import type { QueendomId } from "@/types";
import { settingsRequest } from "./api";
import { Button, Card, EmptyRow, Field, Notice, Select, TextInput } from "./ui";

interface UnrosteredAgent {
  name: string;
  queendom: QueendomId | null;
  ticketsThisMonth: number;
}

interface AgentsPayload {
  agents: AgentRecord[];
  unrostered: UnrosteredAgent[];
}

const ROLE_OPTIONS: readonly { value: AgentRole; label: string }[] = [
  { value: "agent", label: "Concierge agent (on the leaderboard)" },
  { value: "joker", label: "Joker" },
];

export function QueendomAgents({
  queendom,
  onUnauthorized,
}: {
  queendom: QueendomId;
  onUnauthorized: () => void;
}) {
  const [all, setAll] = useState<AgentRecord[]>([]);
  const [unrostered, setUnrostered] = useState<UnrosteredAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState<AgentRole>("agent");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await settingsRequest<AgentsPayload>("/api/settings/agents");
    setLoading(false);
    if (res.unauthorized) return onUnauthorized();
    if (!res.ok || !res.data) return setError(res.error);
    setError(null);
    setAll(res.data.agents ?? []);
    setUnrostered(res.data.unrostered ?? []);
  }, [onUnauthorized]);

  useEffect(() => {
    void load();
  }, [load]);

  // Switching queendom clears stale feedback from the previous one.
  useEffect(() => {
    setNotice(null);
    setError(null);
  }, [queendom]);

  /** Every mutation re-reads the list, so the UI can never drift from the DB. */
  const mutate = useCallback(
    async (init: { method: string; body: unknown }, successMessage: string, rowId?: string) => {
      setBusyId(rowId ?? "form");
      const res = await settingsRequest("/api/settings/agents", init);
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
    [load, onUnauthorized],
  );

  const addAgent = useCallback(
    async (name: string, role: AgentRole) => {
      const trimmed = name.trim();
      if (!trimmed) return setError("Enter the agent's name first.");
      setSaving(true);
      const ok = await mutate(
        { method: "POST", body: { name: trimmed, queendom, role } },
        `${trimmed} added to ${QUEENDOM_DISPLAY_NAME[queendom]}.`,
      );
      setSaving(false);
      if (ok) setNewName("");
    },
    [mutate, queendom],
  );

  const rows = useMemo(() => all.filter((a) => a.queendom === queendom), [all, queendom]);
  const agents = rows.filter((a) => a.role === "agent");
  const jokers = rows.filter((a) => a.role === "joker");
  const shownCount = agents.filter((a) => a.is_active).length;
  const mine = unrostered.filter((p) => p.queendom === queendom || p.queendom === null);
  const otherQueendoms = QUEENDOM_IDS.filter((q) => q !== queendom);

  return (
    <div className="flex flex-col gap-6">
      {error ? <Notice tone="error">{error}</Notice> : null}
      {notice && !error ? <Notice tone="success">{notice}</Notice> : null}

      {!loading && rows.length === 0 ? (
        <Notice tone="info">
          No names on file for {QUEENDOM_DISPLAY_NAME[queendom]} yet. Until you add someone, the TV
          shows the built-in default list for this Queendom.
        </Notice>
      ) : null}

      {/* ── Add ──────────────────────────────────────────────────────────── */}
      <Card
        title={`Add to ${QUEENDOM_DISPLAY_NAME[queendom]}'s roster`}
        description="Type the name exactly as it appears in Freshdesk, otherwise their tickets will not be counted. Capitalisation does not matter."
      >
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void addAgent(newName, newRole);
          }}
        >
          <div className="min-w-[240px] flex-[2]">
            <Field label="Full name">
              <TextInput value={newName} onChange={setNewName} placeholder="e.g. Anshika Eark" maxLength={80} />
            </Field>
          </div>
          <div className="min-w-[240px] flex-1">
            <Field label="Role">
              <Select value={newRole} onChange={setNewRole} options={ROLE_OPTIONS} />
            </Field>
          </div>
          <Button type="submit" disabled={saving || !newName.trim()}>
            {saving ? "Adding…" : "Add"}
          </Button>
        </form>
      </Card>

      {/* ── Roster ───────────────────────────────────────────────────────── */}
      <Card
        title="Leaderboard agents"
        description={
          loading
            ? undefined
            : `${shownCount} of ${agents.length} shown on the TV. Hidden names stay on file so their history is kept.`
        }
      >
        {loading ? (
          <EmptyRow>Loading…</EmptyRow>
        ) : agents.length === 0 ? (
          <EmptyRow>No agents yet — add the first one above.</EmptyRow>
        ) : (
          <ul className="flex flex-col divide-y divide-white/5">
            {agents.map((agent) => (
              <AgentRow
                key={agent.id}
                agent={agent}
                busy={busyId === agent.id}
                moveTargets={otherQueendoms}
                onRename={(name) =>
                  mutate(
                    { method: "PATCH", body: { id: agent.id, name } },
                    `Renamed to ${name}.`,
                    agent.id,
                  )
                }
                onToggleActive={() =>
                  mutate(
                    { method: "PATCH", body: { id: agent.id, is_active: !agent.is_active } },
                    agent.is_active ? `${agent.name} hidden from the TV.` : `${agent.name} is back on the TV.`,
                    agent.id,
                  )
                }
                onMove={(to) =>
                  mutate(
                    { method: "PATCH", body: { id: agent.id, queendom: to } },
                    `${agent.name} moved to ${QUEENDOM_DISPLAY_NAME[to]}.`,
                    agent.id,
                  )
                }
                onDelete={() =>
                  mutate(
                    { method: "DELETE", body: { id: agent.id } },
                    `${agent.name} removed from the roster.`,
                    agent.id,
                  )
                }
              />
            ))}
          </ul>
        )}
      </Card>

      {/* ── Joker ────────────────────────────────────────────────────────── */}
      <Card
        title="Joker"
        description="The person whose lifestyle suggestions this Queendom's Spoiled count is built from. One name per Queendom."
      >
        {loading ? (
          <EmptyRow>Loading…</EmptyRow>
        ) : jokers.length === 0 ? (
          <EmptyRow>No Joker set — the Spoiled count for this Queendom reads zero.</EmptyRow>
        ) : (
          <ul className="flex flex-col divide-y divide-white/5">
            {jokers.map((agent) => (
              <AgentRow
                key={agent.id}
                agent={agent}
                busy={busyId === agent.id}
                onRename={(name) =>
                  mutate({ method: "PATCH", body: { id: agent.id, name } }, `Renamed to ${name}.`, agent.id)
                }
                onToggleActive={() =>
                  mutate(
                    { method: "PATCH", body: { id: agent.id, is_active: !agent.is_active } },
                    `${agent.name} updated.`,
                    agent.id,
                  )
                }
                onDelete={() =>
                  mutate({ method: "DELETE", body: { id: agent.id } }, `${agent.name} removed.`, agent.id)
                }
              />
            ))}
          </ul>
        )}
      </Card>

      {/* ── Unrostered ───────────────────────────────────────────────────── */}
      {mine.length > 0 ? (
        <Card
          title="Handling tickets but not on the roster"
          description="These names appear on this month's tickets for this Queendom but are not on the roster, so they do not show on the leaderboard. Their tickets still count toward the Queendom totals."
        >
          <ul className="flex flex-col divide-y divide-white/5">
            {mine.map((person) => (
              <li key={person.name} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate font-montserrat text-sm text-champagne">{person.name}</p>
                  <p className="font-montserrat text-[11px] text-charcoal-300">
                    {person.ticketsThisMonth} ticket{person.ticketsThisMonth === 1 ? "" : "s"} this month
                    {person.queendom ? "" : " · queendom unclear"}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busyId === "form"}
                  onClick={() => void addAgent(person.name, "agent")}
                >
                  Add to {QUEENDOM_DISPLAY_NAME[queendom]}
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}

// ─── Row ──────────────────────────────────────────────────────────────────────

function AgentRow({
  agent,
  busy,
  moveTargets,
  onRename,
  onToggleActive,
  onMove,
  onDelete,
}: {
  agent: AgentRecord;
  busy: boolean;
  /** Other queendoms this person can be moved to (agents only). */
  moveTargets?: readonly QueendomId[];
  onRename: (name: string) => Promise<boolean | void>;
  onToggleActive: () => void;
  onMove?: (to: QueendomId) => void;
  onDelete: () => void;
}) {
  const [mode, setMode] = useState<"view" | "edit" | "move" | "confirm-delete">("view");
  const [draft, setDraft] = useState(agent.name);

  const startEdit = () => {
    setDraft(agent.name);
    setMode("edit");
  };
  const commitEdit = async () => {
    const next = draft.trim().replace(/\s+/g, " ");
    if (!next || next === agent.name) return setMode("view");
    const ok = await onRename(next);
    if (ok !== false) setMode("view");
  };

  return (
    <li className="flex flex-wrap items-center justify-between gap-2 py-2.5">
      {mode === "edit" ? (
        <form
          className="flex min-w-0 flex-1 items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void commitEdit();
          }}
        >
          <input
            autoFocus
            value={draft}
            maxLength={80}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setMode("view");
            }}
            aria-label={`New name for ${agent.name}`}
            className="min-w-0 flex-1 rounded-md border border-[var(--border-gold-bright)] bg-black/40 px-3 py-1.5 font-montserrat text-sm text-champagne focus:outline-none"
          />
          <Button type="submit" size="sm" disabled={busy || !draft.trim()}>
            {busy ? "Saving…" : "Save"}
          </Button>
          <Button variant="subtle" size="sm" disabled={busy} onClick={() => setMode("view")}>
            Cancel
          </Button>
        </form>
      ) : (
        <>
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <span
              className={`min-w-0 truncate font-montserrat text-sm ${
                agent.is_active ? "text-champagne" : "text-charcoal-300 line-through"
              }`}
            >
              {agent.name}
            </span>
            {!agent.is_active ? (
              <span className="rounded-full border border-white/10 px-2 py-0.5 font-montserrat text-[10px] uppercase tracking-[0.16em] text-charcoal-300">
                hidden
              </span>
            ) : null}
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-1">
            {mode === "move" && onMove && moveTargets ? (
              <>
                <span className="font-montserrat text-[12px] text-charcoal-300">Move to</span>
                {moveTargets.map((q) => (
                  <Button key={q} variant="ghost" size="sm" disabled={busy} onClick={() => onMove(q)}>
                    {QUEENDOM_DISPLAY_NAME[q]}
                  </Button>
                ))}
                <Button variant="subtle" size="sm" disabled={busy} onClick={() => setMode("view")}>
                  Cancel
                </Button>
              </>
            ) : mode === "confirm-delete" ? (
              <>
                <span className="font-montserrat text-[12px] text-red-200">Remove {agent.name}?</span>
                <Button variant="danger" size="sm" disabled={busy} onClick={onDelete}>
                  {busy ? "Removing…" : "Yes, remove"}
                </Button>
                <Button variant="subtle" size="sm" disabled={busy} onClick={() => setMode("view")}>
                  Cancel
                </Button>
              </>
            ) : (
              <>
                <Button variant="subtle" size="sm" disabled={busy} onClick={startEdit} title="Rename">
                  Edit
                </Button>
                <Button
                  variant="subtle"
                  size="sm"
                  disabled={busy}
                  onClick={onToggleActive}
                  title={agent.is_active ? "Hide from the TV but keep the name on file" : "Show on the TV again"}
                >
                  {agent.is_active ? "Hide" : "Show"}
                </Button>
                {onMove && moveTargets?.length ? (
                  <Button variant="subtle" size="sm" disabled={busy} onClick={() => setMode("move")} title="Move to another Queendom">
                    Move
                  </Button>
                ) : null}
                <Button variant="danger" size="sm" disabled={busy} onClick={() => setMode("confirm-delete")}>
                  Remove
                </Button>
              </>
            )}
          </div>
        </>
      )}
    </li>
  );
}
