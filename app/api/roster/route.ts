/**
 * GET /api/roster
 *
 * The live concierge roster, read from the Supabase `agents` table (edited at
 * /settings). This is the read side — unauthenticated on purpose, because the
 * TV dashboard fetches it on every load and holds no credentials.
 *
 * Degrades to the hardcoded FALLBACK_ROSTER (lib/agentRoster.ts) whenever the
 * table is missing, empty, or errors — the leaderboard must never blank out
 * because someone mis-clicked in Settings or the migration hasn't run yet.
 * `source` tells the caller which one it got, for debugging.
 */

import { withApiGuard, noStoreJson } from "@/lib/apiGuard";
import {
  FALLBACK_ROSTER,
  rosterFromAgentRows,
  type AgentRecord,
  type RosterSnapshot,
} from "@/lib/agentRoster";

export interface RosterApiResponse extends RosterSnapshot {
  source: "agents-table" | "fallback";
}

const fallbackResponse = () =>
  noStoreJson({ ...FALLBACK_ROSTER, source: "fallback" } satisfies RosterApiResponse);

export const GET = withApiGuard(
  async (_req, db) => {
    const { data, error } = await db
      .from("agents")
      .select("id, name, queendom, role, is_active, sort_order");

    if (error) {
      // Expected while the migration is still pending — table simply not there.
      console.warn("[/api/roster] agents table unavailable:", error.message);
      return fallbackResponse();
    }

    const roster = rosterFromAgentRows(data as AgentRecord[]);
    if (!roster) return fallbackResponse();

    return noStoreJson({ ...roster, source: "agents-table" } satisfies RosterApiResponse);
  },
  { noDbResponse: fallbackResponse },
);
