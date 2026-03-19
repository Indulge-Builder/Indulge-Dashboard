/**
 * One-time script: import historical Freshdesk tickets from CSV into Supabase tickets table.
 *
 * Usage:
 *   npx tsx scripts/importTickets.ts <path-to-tickets.csv>
 *   npm run import-tickets -- path/to/tickets.csv
 *
 * Loads .env.local from project root so NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set.
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

const BATCH_SIZE = 400;

type CsvRow = Record<string, string>;

interface TicketRow {
  ticket_id: string;
  status: string;
  agent_name: string;
  queendom_name: string;
  created_at: string;
  resolved_at: string | null;
  tags: string;
  is_escalated: boolean;
}

function parseTimestamp(value: string | undefined): string | null {
  if (value == null || String(value).trim() === "") return null;
  const trimmed = String(value).trim();
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function transformRow(row: CsvRow): TicketRow | null {
  const ticketIdRaw = row["Ticket ID"];
  if (ticketIdRaw == null || String(ticketIdRaw).trim() === "") return null;

  const ticketId = String(Number(ticketIdRaw) || ticketIdRaw.trim());
  const status = (row["Status"] ?? "").trim() || "open";
  const agentName = (row["Agent"] ?? "").trim();
  const queendomName = (row["Group"] ?? "").trim();
  if (!queendomName) return null;

  const createdAt = parseTimestamp(row["Created time"]);
  if (!createdAt) return null;

  const resolvedAt = parseTimestamp(row["Resolved time"]);
  const tags = (row["Tags"] ?? "").trim();
  const isEscalated = tags.includes("overdue_sync");

  return {
    ticket_id: ticketId,
    status,
    agent_name: agentName,
    queendom_name: queendomName,
    created_at: createdAt,
    resolved_at: resolvedAt,
    tags,
    is_escalated: isEscalated,
  };
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
