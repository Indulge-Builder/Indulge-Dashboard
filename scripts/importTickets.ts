/**
 * Bulk import Freshdesk tickets from CSV into the Supabase `tickets` table
 * (upsert on ticket_id, batches of 400).
 *
 * Usage:
 *   npx tsx scripts/importTickets.ts <path-to-tickets.csv>
 *   npm run import-tickets -- path/to/tickets.csv
 *
 * This is the ONLY sanctioned bulk-import path. Never import a ticket CSV
 * through the Supabase table editor: Freshdesk exports carry naive IST
 * wall-clock timestamps, and the table editor stores them verbatim as UTC,
 * shifting every instant +5:30 into the future (this froze the
 * ResolveStopwatch at 00:00 on 2026-07-03). All timestamp conversion goes
 * through lib/istDate.ts — the same service the Freshdesk webhook and the
 * dashboard's display math use (naive → Asia/Kolkata, stored as UTC ISO).
 *
 * Accepts both header conventions:
 *   - Freshdesk export:  "Ticket ID", "Status", "Agent", "Group",
 *                        "Created time", "Resolved time", "Tags"
 *   - DB-style export:   ticket_id, status, agent_name, queendom_name,
 *                        created_at, resolved_at, is_escalated, subject
 *
 * `tags` is JSONB in the DB and is never written here (the Freshdesk "Tags"
 * export is a plain comma string, not JSON) — it only feeds the overdue_sync
 * escalation fallback. `is_incomplete` is webhook-maintained and not part of
 * any export; a wipe-and-reimport resets it to the column default (false).
 *
 * Loads .env.local from project root so NEXT_PUBLIC_SUPABASE_URL and
 * SUPABASE_SERVICE_ROLE_KEY are set.
 */

import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

// Load .env.local when running outside Next.js (tsx scripts/importTickets.ts)
const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, "utf8");
  for (const line of content.split("\n")) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (match) {
      const key = match[1];
      const value = match[2].replace(/^["']|["']$/g, "").trim();
      if (!process.env[key]) process.env[key] = value;
    }
  }
}
import csv from "csv-parser";
import { timestampStringToIsoUtcForDb } from "@/lib/istDate";

const BATCH_SIZE = 400;

type CsvRow = Record<string, string>;

interface TicketRow {
  ticket_id: string;
  status: string;
  agent_name: string;
  queendom_name: string;
  created_at: string;
  resolved_at: string | null;
  is_escalated: boolean;
  subject?: string;
}

/** First non-empty value among the given header names (DB-style or Freshdesk). */
function pick(row: CsvRow, ...headers: string[]): string {
  for (const h of headers) {
    const v = row[h];
    if (v != null && String(v).trim() !== "") return String(v).trim();
  }
  return "";
}

function parseTimestamp(value: string): string | null {
  if (value === "" || value.toUpperCase() === "NULL") return null;
  return timestampStringToIsoUtcForDb(value);
}

function parseBool(value: string): boolean {
  const v = value.trim().toUpperCase();
  return v === "TRUE" || v === "1";
}

function transformRow(row: CsvRow): TicketRow | null {
  const ticketIdRaw = pick(row, "ticket_id", "Ticket ID");
  if (!ticketIdRaw) return null;
  const ticketId = String(Number(ticketIdRaw) || ticketIdRaw);

  const status = pick(row, "status", "Status") || "open";
  const agentName = pick(row, "agent_name", "Agent");
  const queendomName = pick(row, "queendom_name", "Group");
  if (!queendomName) return null;

  const createdAt = parseTimestamp(pick(row, "created_at", "Created time"));
  if (!createdAt) return null;
  const resolvedAt = parseTimestamp(pick(row, "resolved_at", "Resolved time"));

  // Explicit is_escalated column wins; Freshdesk exports without one derive it
  // from the overdue_sync tag (same signal the escalation webhook path uses).
  const tags = pick(row, "tags", "Tags");
  const isEscalated =
    parseBool(pick(row, "is_escalated", "Is escalated")) ||
    tags.includes("overdue_sync");

  const ticket: TicketRow = {
    ticket_id: ticketId,
    status,
    agent_name: agentName,
    queendom_name: queendomName,
    created_at: createdAt,
    resolved_at: resolvedAt,
    is_escalated: isEscalated,
  };

  // Only send subject when present so an export without the column can't
  // blank webhook-populated values on upsert (mirrors the webhook rule).
  const subject = pick(row, "subject", "Subject");
  if (subject) ticket.subject = subject;

  return ticket;
}

function readCsv(filePath: string): Promise<TicketRow[]> {
  return new Promise((resolve, reject) => {
    const rows: TicketRow[] = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on("data", (row: CsvRow) => {
        const transformed = transformRow(row);
        if (transformed) rows.push(transformed);
      })
      .on("end", () => resolve(rows))
      .on("error", reject);
  });
}

async function main() {
  const csvPath = process.argv[2];
  if (!csvPath) {
    console.error(
      "Usage: npx tsx scripts/importTickets.ts <path-to-tickets.csv>",
    );
    process.exit(1);
  }

  const resolvedPath = path.resolve(process.cwd(), csvPath);
  if (!fs.existsSync(resolvedPath)) {
    console.error("File not found:", resolvedPath);
    process.exit(1);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (
    !supabaseUrl ||
    !serviceKey ||
    serviceKey === "paste_your_service_role_key_here"
  ) {
    console.error(
      "Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    );
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log("Reading CSV:", resolvedPath);
  const allRows = await readCsv(resolvedPath);
  console.log("Transformed rows:", allRows.length);

  if (allRows.length === 0) {
    console.log("No rows to import. Done.");
    process.exit(0);
  }

  // Sanity gate: a correctly converted export can never produce instants
  // meaningfully in the future. Catching it here beats debugging a frozen
  // stopwatch on the TV.
  const nowMs = Date.now();
  const future = allRows.filter(
    (r) =>
      new Date(r.created_at).getTime() > nowMs + 60_000 ||
      (r.resolved_at != null &&
        new Date(r.resolved_at).getTime() > nowMs + 60_000),
  );
  if (future.length > 0) {
    console.error(
      `Aborting: ${future.length} rows have timestamps in the future after IST→UTC conversion (first: ticket ${future[0].ticket_id}). The CSV timestamps are probably already UTC — check the export source.`,
    );
    process.exit(1);
  }

  let batchIndex = 0;
  let totalUpserted = 0;

  for (let i = 0; i < allRows.length; i += BATCH_SIZE) {
    const batch = allRows.slice(i, i + BATCH_SIZE);
    batchIndex += 1;
    const { error } = await supabase
      .from("tickets")
      .upsert(batch, { onConflict: "ticket_id" });

    if (error) {
      console.error("Batch", batchIndex, "failed:", error.message);
      throw error;
    }

    totalUpserted += batch.length;
    console.log(
      `Batch ${batchIndex}: upserted ${batch.length} rows (total so far: ${totalUpserted})`,
    );
  }

  console.log("Import complete. Total tickets upserted:", totalUpserted);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
