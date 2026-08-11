/**
 * /api/settings/agents — CRUD for the concierge roster (`agents` table).
 *
 *   GET    → { agents, unrostered }   all rows + names filing tickets this month
 *                                     that nobody has added to the roster yet
 *   POST   → { name, queendom, role? }          create
 *   PATCH  → { id, ...fields }                  update
 *   DELETE → { id }                             hard delete
 *
 * All four require a valid settings session (lib/settingsAuth.ts).
 *
 * `is_active: false` is the softer alternative to DELETE — the agent leaves the
 * TV but the row (and its exact name spelling) is kept so they can be restored.
 */

import { withSettingsGuard, settingsJson } from "@/lib/settingsAuth";
import { isMissingTableError } from "@/lib/apiGuard";
import { getCurrentIstMonthUtcBounds } from "@/lib/istDate";
import { normalizeQueendom } from "@/lib/queendom";
import type { AgentRecord, AgentRole } from "@/lib/agentRoster";
import type { QueendomId } from "@/types";

const AGENT_COLUMNS = "id, name, queendom, role, is_active, sort_order, created_at, updated_at";

/** Postgres unique-violation — a name already on the roster (case-insensitively). */
const PG_UNIQUE_VIOLATION = "23505";

const MAX_NAME_LENGTH = 80;
const TICKET_SCAN_CAP = 6000;

interface UnrosteredAgent {
  name: string;
  queendom: QueendomId | null;
  ticketsThisMonth: number;
}

// ─── Validation ───────────────────────────────────────────────────────────────

function parseName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const name = raw.trim().replace(/\s+/g, " ");
  if (!name || name.length > MAX_NAME_LENGTH) return null;
  return name;
}

function parseQueendom(raw: unknown): QueendomId | null {
  return raw === "ananyshree" || raw === "anishqa" ? raw : null;
}

function parseRole(raw: unknown): AgentRole | null {
  return raw === "agent" || raw === "joker" ? raw : null;
}

function missingTableResponse() {
  return settingsJson(
    {
      error:
        "The `agents` table does not exist yet. Apply supabase/migrations/20260811000000_agents_table_and_queendom_normalisation.sql in the Supabase SQL Editor.",
      code: "AGENTS_TABLE_MISSING",
    },
    503,
  );
}

async function readBody(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = await req.json();
    return body && typeof body === "object" ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

// ─── GET ──────────────────────────────────────────────────────────────────────

export const GET = withSettingsGuard(async (_req, db) => {
  const { data, error } = await db
    .from("agents")
    .select(AGENT_COLUMNS)
    .order("queendom", { ascending: true })
    .order("role", { ascending: true })
    .order("sort_order", { ascending: true });

  if (error) {
    if (isMissingTableError(error)) return missingTableResponse();
    console.error("[settings/agents] GET:", error.message);
    return settingsJson({ error: error.message }, 500);
  }

  const agents = (data ?? []) as AgentRecord[];

  // ── Unrostered agents ──────────────────────────────────────────────────────
  // Anyone whose name appears on this month's tickets but is not on the roster
  // is invisible on the leaderboard. Surfacing them here is the whole point:
  // it's how a non-technical user discovers there is someone to add.
  const rostered = new Set(agents.map((a) => a.name.trim().toLowerCase()));
  const unrostered: UnrosteredAgent[] = [];

  const { startUtcIso, endExclusiveUtcIso } = getCurrentIstMonthUtcBounds();
  const { data: ticketRows, error: ticketErr } = await db
    .from("tickets")
    .select("agent_name, queendom_name")
    .gte("created_at", startUtcIso)
    .lt("created_at", endExclusiveUtcIso)
    .limit(TICKET_SCAN_CAP);

  if (ticketErr) {
    console.warn("[settings/agents] unrostered scan failed:", ticketErr.message);
  } else {
    const tally = new Map<string, UnrosteredAgent>();
    for (const row of (ticketRows ?? []) as {
      agent_name: string | null;
      queendom_name: string | null;
    }[]) {
      const name = row.agent_name?.trim();
      if (!name) continue;
      const key = name.toLowerCase();
      if (rostered.has(key)) continue;
      const existing = tally.get(key);
      if (existing) {
        existing.ticketsThisMonth++;
      } else {
        tally.set(key, {
          name,
          queendom: normalizeQueendom(row.queendom_name),
          ticketsThisMonth: 1,
        });
      }
    }
    unrostered.push(
      ...[...tally.values()].sort((a, b) => b.ticketsThisMonth - a.ticketsThisMonth),
    );
  }

  return settingsJson({ agents, unrostered });
});

// ─── POST ─────────────────────────────────────────────────────────────────────

export const POST = withSettingsGuard(async (req, db) => {
  const body = await readBody(req);
  if (!body) return settingsJson({ error: "Invalid JSON body" }, 400);

  const name = parseName(body.name);
  const queendom = parseQueendom(body.queendom);
  const role = body.role === undefined ? "agent" : parseRole(body.role);

  if (!name) return settingsJson({ error: "Name is required (max 80 characters)." }, 400);
  if (!queendom) return settingsJson({ error: "Queendom must be ananyshree or anishqa." }, 400);
  if (!role) return settingsJson({ error: "Role must be agent or joker." }, 400);

  // Append to the end of that queendom's list.
  const { data: last } = await db
    .from("agents")
    .select("sort_order")
    .eq("queendom", queendom)
    .eq("role", role)
    .order("sort_order", { ascending: false })
    .limit(1);
  const sortOrder = ((last?.[0]?.sort_order as number | undefined) ?? 0) + 1;

  const { data, error } = await db
    .from("agents")
    .insert({ name, queendom, role, sort_order: sortOrder })
    .select(AGENT_COLUMNS)
    .single();

  if (error) {
    if (isMissingTableError(error)) return missingTableResponse();
    if (error.code === PG_UNIQUE_VIOLATION) {
      return settingsJson(
        { error: `"${name}" is already on the roster (names are case-insensitive).` },
        409,
      );
    }
    console.error("[settings/agents] POST:", error.message);
    return settingsJson({ error: error.message }, 500);
  }

  return settingsJson({ agent: data }, 201);
});

// ─── PATCH ────────────────────────────────────────────────────────────────────

export const PATCH = withSettingsGuard(async (req, db) => {
  const body = await readBody(req);
  if (!body) return settingsJson({ error: "Invalid JSON body" }, 400);

  const id = typeof body.id === "string" ? body.id : null;
  if (!id) return settingsJson({ error: "id is required." }, 400);

  const patch: Record<string, unknown> = {};

  if (body.name !== undefined) {
    const name = parseName(body.name);
    if (!name) return settingsJson({ error: "Name is required (max 80 characters)." }, 400);
    patch.name = name;
  }
  if (body.queendom !== undefined) {
    const queendom = parseQueendom(body.queendom);
    if (!queendom) return settingsJson({ error: "Queendom must be ananyshree or anishqa." }, 400);
    patch.queendom = queendom;
  }
  if (body.role !== undefined) {
    const role = parseRole(body.role);
    if (!role) return settingsJson({ error: "Role must be agent or joker." }, 400);
    patch.role = role;
  }
  if (body.is_active !== undefined) {
    if (typeof body.is_active !== "boolean") {
      return settingsJson({ error: "is_active must be a boolean." }, 400);
    }
    patch.is_active = body.is_active;
  }
  if (body.sort_order !== undefined) {
    if (!Number.isInteger(body.sort_order)) {
      return settingsJson({ error: "sort_order must be an integer." }, 400);
    }
    patch.sort_order = body.sort_order;
  }

  if (!Object.keys(patch).length) {
    return settingsJson({ error: "Nothing to update." }, 400);
  }

  const { data, error } = await db
    .from("agents")
    .update(patch)
    .eq("id", id)
    .select(AGENT_COLUMNS)
    .single();

  if (error) {
    if (isMissingTableError(error)) return missingTableResponse();
    if (error.code === PG_UNIQUE_VIOLATION) {
      return settingsJson(
        { error: "Another roster entry already uses that name." },
        409,
      );
    }
    console.error("[settings/agents] PATCH:", error.message);
    return settingsJson({ error: error.message }, 500);
  }

  return settingsJson({ agent: data });
});

// ─── DELETE ───────────────────────────────────────────────────────────────────

export const DELETE = withSettingsGuard(async (req, db) => {
  const body = await readBody(req);
  const id = typeof body?.id === "string" ? body.id : null;
  if (!id) return settingsJson({ error: "id is required." }, 400);

  const { error } = await db.from("agents").delete().eq("id", id);

  if (error) {
    if (isMissingTableError(error)) return missingTableResponse();
    console.error("[settings/agents] DELETE:", error.message);
    return settingsJson({ error: error.message }, 500);
  }

  return settingsJson({ ok: true });
});
