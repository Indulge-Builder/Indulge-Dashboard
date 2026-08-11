"use client";

/**
 * components/settings/AgentsTab.tsx
 *
 * Roster editor. Replaces the old workflow of editing lib/agentRoster.ts and
 * redeploying, so joiners/leavers can be handled by whoever runs the floor.
 *
 * Three sections:
 *   1. Add — name + queendom + role
 *   2. Roster — one column per queendom, with show/hide, move, and remove
 *   3. Unrostered — names filing tickets this month that nobody has added yet.
 *      This is the section that matters most: an agent missing from the roster
 *      is silently absent from the leaderboard even though their tickets count
 *      toward the queendom total, and there was previously no way to notice.
 */

import { useCallback, useEffect, useState } from "react";
import type { AgentRecord, AgentRole } from "@/lib/agentRoster";
import { QUEENDOM_DISPLAY_NAME, QUEENDOM_IDS } from "@/lib/queendom";
import type { QueendomId } from "@/types";
import { settingsRequest } from "./api";
import {
  Button,
  Card,
  EmptyRow,
  Field,
  Notice,
  QUEENDOM_OPTIONS,
  Select,
  TextInput,
} from "./ui";

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
  { value: "agent", label: "Concierge agent" },
  { value: "joker", label: "Joker" },
];

export function AgentsTab({ onUnauthorized }: { onUnauthorized: () => void }) {
  const [agents, setAgents] = useState<AgentRecord[]>([]);
  const [unrostered, setUnrostered] = useState<UnrosteredAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Add-form state
  const [newName, setNewName] = useState("");
  const [newQueendom, setNewQueendom] = useState<QueendomId>("ananyshree");
  const [newRole, setNewRole] = useState<AgentRole>("agent");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await settingsRequest<AgentsPayload>("/api/settings/agents");
    setLoading(false);
    if (res.unauthorized) return onUnauthorized();
    if (!res.ok || !res.data) return setError(res.error);
    setError(null);
    setAgents(res.data.agents ?? []);
    setUnrostered(res.data.unrostered ?? []);
  }, [onUnauthorized]);

  useEffect(() => {
    void load();
  }, [load]);

  /** Every mutation re-reads the list, so the UI can never drift from the DB. */
  const mutate = useCallback(
    async (
      init: { method: string; body: unknown },
      successMessage: string,
      rowId?: string,
    ) => {
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
    async (name: string, queendom: QueendomId, role: AgentRole) => {
      const trimmed = name.trim();
      if (!trimmed) {
        setError("Enter the agent's name first.");
        return;
      }
      setSaving(true);
      const ok = await mutate(
        { method: "POST", body: { name: trimmed, queendom, role } },
        `${trimmed} added to ${QUEENDOM_DISPLAY_NAME[queendom]}.`,
      );
      setSaving(false);
      if (ok) setNewName("");
    },
    [mutate],
  );

  const roleAgents = (queendom: QueendomId, role: AgentRole) =>
    agents.filter((a) => a.queendom === queendom && a.role === role);

  return (
    <div className="flex flex-col gap-6">
      {error ? <Notice tone="error">{error}</Notice> : null}
      {notice && !error ? <Notice tone="success">{notice}</Notice> : null}

      {/* ── 1. Add ───────────────────────────────────────────────────────── */}
      <Card
        title="Add someone to the roster"
        description="The name must match how it appears in Freshdesk, or their tickets will not be counted. Capitalisation does not matter."
      >
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void addAgent(newName, newQueendom, newRole);
          }}
        >
          <div className="min-w-[220px] flex-[2]">
            <Field label="Full name">
              <TextInput
                value={newName}
                onChange={setNewName}
                placeholder="e.g. Anshika Eark"
                maxLength={80}
              />
            </Field>
          </div>
          <div className="min-w-[160px] flex-1">
            <Field label="Queendom">
              <Select value={newQueendom} onChange={setNewQueendom} options={QUEENDOM_OPTIONS} />
            </Field>
          </div>
          <div className="min-w-[180px] flex-1">
            <Field label="Role">
              <Select value={newRole} onChange={setNewRole} options={ROLE_OPTIONS} />
            </Field>
          </div>
          <Button type="submit" disabled={saving || !newName.trim()}>
            {saving ? "Adding…" : "Add"}
          </Button>
        </form>
      </Card>

      {/* ── 2. Roster ────────────────────────────────────────────────────── */}
      {loading ? (
        <Card title="Roster">
          <EmptyRow>Loading…</EmptyRow>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {QUEENDOM_IDS.map((queendom) => (
            <Card
              key={queendom}
              title={`${QUEENDOM_DISPLAY_NAME[queendom]}'s Queendom`}
              description={`${roleAgents(queendom, "agent").filter((a) => a.is_active).length} agents shown on the TV.`}
            >
              <ul className="flex flex-col divide-y divide-white/5">
                {roleAgents(queendom, "agent").length === 0 ? (
                  <EmptyRow>No agents yet.</EmptyRow>
                ) : (
                  roleAgents(queendom, "agent").map((agent) => (
                    <AgentRow
                      key={agent.id}
                      agent={agent}
                      busy={busyId === agent.id}
                      onToggleActive={() =>
                        mutate(
                          { method: "PATCH", body: { id: agent.id, is_active: !agent.is_active } },
                          agent.is_active
                            ? `${agent.name} hidden from the TV.`
                            : `${agent.name} is back on the TV.`,
                          agent.id,
                        )
                      }
                      onMove={() =>
                        mutate(
                          {
                            method: "PATCH",
                            body: {
                              id: agent.id,
                              queendom:
                                agent.queendom === "ananyshree" ? "anishqa" : "ananyshree",
                            },
                          },
                          `${agent.name} moved to ${
                            agent.queendom === "ananyshree"
                              ? QUEENDOM_DISPLAY_NAME.anishqa
                              : QUEENDOM_DISPLAY_NAME.ananyshree
                          }.`,
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
                  ))
                )}
              </ul>

              {/* Jokers live in the same table, separated for clarity. */}
              <div className="mt-5 border-t border-[var(--border-gold-dim)] pt-4">
                <h3 className="mb-2 font-montserrat text-[11px] uppercase tracking-[0.14em] text-gold-400/80">
                  Joker
                </h3>
                <ul className="flex flex-col divide-y divide-white/5">
                  {roleAgents(queendom, "joker").length === 0 ? (
                    <EmptyRow>No Joker set — this queendom&apos;s Joker panel will read zero.</EmptyRow>
                  ) : (
                    roleAgents(queendom, "joker").map((agent) => (
                      <AgentRow
                        key={agent.id}
                        agent={agent}
                        busy={busyId === agent.id}
                        onToggleActive={() =>
                          mutate(
                            { method: "PATCH", body: { id: agent.id, is_active: !agent.is_active } },
                            `${agent.name} updated.`,
                            agent.id,
                          )
                        }
                        onDelete={() =>
                          mutate(
                            { method: "DELETE", body: { id: agent.id } },
                            `${agent.name} removed.`,
                            agent.id,
                          )
                        }
                      />
                    ))
                  )}
                </ul>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* ── 3. Unrostered ────────────────────────────────────────────────── */}
      {unrostered.length > 0 ? (
        <Card
          title="Handling tickets but not on the roster"
          description="These names appear on this month's tickets but are missing from the roster above, so they do not show on the leaderboard. Their tickets still count toward the queendom totals."
        >
          <ul className="flex flex-col divide-y divide-white/5">
            {unrostered.map((person) => (
              <li
                key={person.name}
                className="flex flex-wrap items-center justify-between gap-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="truncate font-montserrat text-sm text-champagne">
                    {person.name}
                  </p>
                  <p className="font-montserrat text-[11px] text-charcoal-300">
                    {person.ticketsThisMonth} ticket
                    {person.ticketsThisMonth === 1 ? "" : "s"} this month
                    {person.queendom
                      ? ` · ${QUEENDOM_DISPLAY_NAME[person.queendom]}`
                      : " · queendom unclear"}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  disabled={busyId === "form"}
                  onClick={() =>
                    void addAgent(person.name, person.queendom ?? "ananyshree", "agent")
                  }
                >
                  Add to {QUEENDOM_DISPLAY_NAME[person.queendom ?? "ananyshree"]}
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
  onToggleActive,
  onMove,
  onDelete,
}: {
  agent: AgentRecord;
  busy: boolean;
  onToggleActive: () => void;
  onMove?: () => void;
  onDelete: () => void;
}) {
  const [confirming, setConfirming] = useState(false);

  return (
    <li className="flex flex-wrap items-center justify-between gap-2 py-2.5">
      <span
        className={`min-w-0 flex-1 truncate font-montserrat text-sm ${
          agent.is_active ? "text-champagne" : "text-charcoal-300 line-through"
        }`}
      >
        {agent.name}
      </span>

      <div className="flex shrink-0 items-center gap-2">
        <Button
          variant="ghost"
          disabled={busy}
          onClick={onToggleActive}
          title={
            agent.is_active
              ? "Hide from the TV but keep the name on file"
              : "Show on the TV again"
          }
        >
          {agent.is_active ? "Hide" : "Show"}
        </Button>

        {onMove ? (
          <Button variant="ghost" disabled={busy} onClick={onMove} title="Move to the other queendom">
            Move
          </Button>
        ) : null}

        {confirming ? (
          <>
            <Button variant="danger" disabled={busy} onClick={onDelete}>
              {busy ? "Removing…" : "Confirm"}
            </Button>
            <Button variant="ghost" disabled={busy} onClick={() => setConfirming(false)}>
              Cancel
            </Button>
          </>
        ) : (
          <Button variant="danger" disabled={busy} onClick={() => setConfirming(true)}>
            Remove
          </Button>
        )}
      </div>
    </li>
  );
}
