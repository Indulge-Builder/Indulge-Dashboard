/**
 * lib/settingsClientRows.ts
 *
 * `renewals` and `members` are the same table twice — { client_name, group,
 * queendom, created_at } — so their Settings CRUD routes are generated from
 * one factory rather than copy-pasted.
 *
 *   renewals → "Renewals This Month" count + the latest-renewals list
 *   members  → the "Latest Assignments" list (i.e. newly onboarded clients)
 *
 * Two things this factory is careful about:
 *
 * 1. `created_at` is the BUSINESS date, not the insert time. The seed
 *    migrations backdated it and /api/renewals-panel filters the current IST
 *    month on it, so the form takes a date and it is written through
 *    timestampStringToIsoUtcForDb() — IST midnight, never UTC midnight
 *    (CLAUDE.md invariant #1).
 *
 * 2. `group` and `queendom` are redundant columns that have always held the
 *    same value. Both are written with the canonical QUEENDOM_LABEL so the
 *    2026-08-11 normalisation holds even before the DB trigger is applied.
 */

import { withSettingsGuard, settingsJson } from "./settingsAuth";
import { isMissingTableError } from "./apiGuard";
import { timestampStringToIsoUtcForDb } from "./istDate";
import { normalizeQueendom, QUEENDOM_LABEL } from "./queendom";
import type { QueendomId } from "@/types";

export type ClientRowTable = "renewals" | "members";

const COLUMNS = "id, client_name, group, queendom, created_at";
const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;
const MAX_NAME_LENGTH = 120;

export interface ClientRowRecord {
  id: string;
  client_name: string | null;
  group: string | null;
  queendom: string | null;
  created_at: string | null;
  /** Resolved via normalizeQueendom so the UI never re-implements matching. */
  resolvedQueendom: QueendomId | null;
}

interface RawRow {
  id: string;
  client_name: string | null;
  group: string | null;
  queendom: string | null;
  created_at: string | null;
}

function decorate(rows: RawRow[]): ClientRowRecord[] {
  return rows.map((r) => ({
    ...r,
    resolvedQueendom: normalizeQueendom(r.group ?? r.queendom),
  }));
}

function parseClientName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  // Matches the DB trigger: strip stray newlines the sheet sync leaves behind.
  const name = raw.replace(/[\s\r\n]+/g, " ").trim();
  if (!name || name.length > MAX_NAME_LENGTH) return null;
  return name;
}

function parseQueendom(raw: unknown): QueendomId | null {
  return raw === "ananyshree" || raw === "anishqa" ? raw : null;
}

/**
 * Accepts an IST calendar date "YYYY-MM-DD" and returns the UTC instant of IST
 * midnight that day. Undefined/empty → now. Returns undefined for a malformed
 * date so the caller can reject rather than silently store the wrong month.
 */
function parseIstDate(raw: unknown): string | null | undefined {
  if (raw === undefined || raw === null || raw === "") return new Date().toISOString();
  if (typeof raw !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(raw.trim())) return undefined;
  return timestampStringToIsoUtcForDb(raw.trim()) ?? undefined;
}

async function readBody(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = await req.json();
    return body && typeof body === "object" ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function missingTableResponse(table: ClientRowTable) {
  return settingsJson(
    { error: `The \`${table}\` table does not exist.`, code: "TABLE_MISSING" },
    503,
  );
}

/**
 * Builds the GET / POST / DELETE handlers for one of the two tables.
 * Every handler is already wrapped in withSettingsGuard (auth + DB + catch-all).
 */
export function createClientRowRoutes(table: ClientRowTable) {
  const GET = withSettingsGuard(async (req, db) => {
    const params = req.nextUrl.searchParams;
    const queendom = parseQueendom(params.get("queendom"));
    const limit = Math.min(
      Math.max(Number(params.get("limit")) || DEFAULT_LIMIT, 1),
      MAX_LIMIT,
    );

    const { data, error } = await db
      .from(table)
      .select(COLUMNS)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      if (isMissingTableError(error)) return missingTableResponse(table);
      console.error(`[settings/${table}] GET:`, error.message);
      return settingsJson({ error: error.message }, 500);
    }

    let rows = decorate((data ?? []) as RawRow[]);
    // Filtering here rather than in SQL: historical rows still carry the old
    // spellings, and normalizeQueendom is the only matcher that knows them all.
    if (queendom) rows = rows.filter((r) => r.resolvedQueendom === queendom);

    return settingsJson({ rows });
  });

  const POST = withSettingsGuard(async (req, db) => {
    const body = await readBody(req);
    if (!body) return settingsJson({ error: "Invalid JSON body" }, 400);

    const clientName = parseClientName(body.client_name);
    const queendom = parseQueendom(body.queendom);
    const createdAt = parseIstDate(body.date);

    if (!clientName) {
      return settingsJson(
        { error: `Client name is required (max ${MAX_NAME_LENGTH} characters).` },
        400,
      );
    }
    if (!queendom) {
      return settingsJson({ error: "Queendom must be ananyshree or anishqa." }, 400);
    }
    if (createdAt === undefined) {
      return settingsJson({ error: "Date must be in YYYY-MM-DD format." }, 400);
    }

    const label = QUEENDOM_LABEL[queendom];
    const { data, error } = await db
      .from(table)
      .insert({
        client_name: clientName,
        group: label,
        queendom: label,
        created_at: createdAt,
      })
      .select(COLUMNS)
      .single();

    if (error) {
      if (isMissingTableError(error)) return missingTableResponse(table);
      console.error(`[settings/${table}] POST:`, error.message);
      return settingsJson({ error: error.message }, 500);
    }

    return settingsJson({ row: decorate([data as RawRow])[0] }, 201);
  });

  const DELETE = withSettingsGuard(async (req, db) => {
    const body = await readBody(req);
    const id = typeof body?.id === "string" ? body.id : null;
    if (!id) return settingsJson({ error: "id is required." }, 400);

    const { error } = await db.from(table).delete().eq("id", id);
    if (error) {
      if (isMissingTableError(error)) return missingTableResponse(table);
      console.error(`[settings/${table}] DELETE:`, error.message);
      return settingsJson({ error: error.message }, 500);
    }

    return settingsJson({ ok: true });
  });

  return { GET, POST, DELETE };
}
