/**
 * One-off bulk import: ./tickets.csv → Supabase `tickets` (upsert, batches of 100).
 *
 * Run from project root:
 *   node import_tickets.js
 */

require("dotenv").config({ path: ".env.local", quiet: true });
require("dotenv").config({ quiet: true });

const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");
const { createClient } = require("@supabase/supabase-js");

const BATCH_SIZE = 100;
const CSV_FILE = path.join(__dirname, "last 30 - last 30.csv");

function pick(row, ...names) {
  for (const n of names) {
    if (Object.prototype.hasOwnProperty.call(row, n) && row[n] !== undefined) {
      return row[n];
    }
  }
  const keys = Object.keys(row);
  const byLower = new Map(keys.map((k) => [k.trim().toLowerCase(), k]));
  for (const n of names) {
    const orig = byLower.get(n.trim().toLowerCase());
    if (orig !== undefined) return row[orig];
  }
  return undefined;
}

/**
 * Same rules as lib/istDate.ts: naive datetimes = Asia/Kolkata; explicit Z/offset = as given.
 * Keep in sync when changing ticket timestamp parsing.
 */
function utcMillisFromExportTimestamp(str) {
  let s = String(str).trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2} \d{2}:/.test(s)) s = s.replace(" ", "T");
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    s = `${s}T00:00:00+05:30`;
  } else if (s.includes("T")) {
    const rest = s.slice(s.indexOf("T") + 1);
    if (rest && !/[zZ]|[+-]\d/.test(rest)) s = `${s}+05:30`;
  } else return null;
  if (s.includes("T")) s = s.replace(/([+-]\d{2})$/, "$1:00");
  const t = new Date(s).getTime();
  return Number.isNaN(t) ? null : t;
}

function toIsoUtcFromExportTimestamp(str) {
  const ms = utcMillisFromExportTimestamp(str);
  if (ms == null) return null;
  return new Date(ms).toISOString();
}

/** "", "NULL" (any case), or undefined → null; otherwise ISO string or null if unparsable. */
function normalizeResolvedAt(raw) {
  if (raw === undefined || raw === null) return null;
  const s = String(raw).trim();
  if (s === "" || s.toUpperCase() === "NULL") return null;
  return toIsoUtcFromExportTimestamp(s);
}

/** Empty, whitespace-only, or "FALSE" (any case) → false; "TRUE"/"1" → true. */
function normalizeIsEscalated(raw) {
  if (raw === undefined || raw === null) return false;
  const s = String(raw).trim();
  if (s === "" || s.toUpperCase() === "FALSE") return false;
  const u = s.toUpperCase();
  if (u === "TRUE" || s === "1") return true;
  return false;
}

function transformRow(row) {
  const ticketIdRaw = pick(row, "ticket_id", "Ticket ID");
  if (ticketIdRaw == null || String(ticketIdRaw).trim() === "") return null;

  const ticket_id = String(
    Number(String(ticketIdRaw).trim()) || String(ticketIdRaw).trim(),
  );

  const status = (pick(row, "status", "Status") || "").trim() || "open";
  const agent_name = (pick(row, "agent_name", "Agent") || "").trim();
  const queendom_name = (pick(row, "queendom_name", "Group") || "").trim();
  if (!queendom_name) return null;

  const createdRaw = pick(row, "created_at", "Created time");
  const created_at = toIsoUtcFromExportTimestamp(String(createdRaw ?? "").trim());
  if (!created_at) return null;

  const resolvedRaw = pick(row, "resolved_at", "Resolved time");
  const resolved_at = normalizeResolvedAt(resolvedRaw);

  const escalatedRaw = pick(row, "is_escalated", "Is escalated");
  const is_escalated = normalizeIsEscalated(escalatedRaw);

  return {
    ticket_id,
    status,
    agent_name,
    queendom_name,
    created_at,
    resolved_at,
    is_escalated,
  };
}

function readCsv(filePath) {
  return new Promise((resolve, reject) => {
    const rows = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on("data", (row) => {
        const out = transformRow(row);
        if (out) rows.push(out);
      })
      .on("end", () => resolve(rows))
      .on("error", reject);
  });
}

async function main() {
  if (!fs.existsSync(CSV_FILE)) {
    console.error("Missing file:", CSV_FILE);
    process.exit(1);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const key = serviceKey || anonKey;
  const usingAnon = !serviceKey && !!anonKey;

  if (!supabaseUrl || !key) {
    console.error(
      "Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY if RLS permits inserts).",
    );
    process.exit(1);
  }

  if (usingAnon) {
    console.log(
      "[import_tickets] Using NEXT_PUBLIC_SUPABASE_ANON_KEY (service role not set).",
    );
  }

  const supabase = createClient(supabaseUrl, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log("[import_tickets] Reading", CSV_FILE);
  const cleanedRows = await readCsv(CSV_FILE);
  console.log("[import_tickets] Rows after transform:", cleanedRows.length);

  if (cleanedRows.length === 0) {
    console.log("[import_tickets] Nothing to import. Exiting.");
    return;
  }

  let total = 0;
  let batchNum = 0;

  for (let i = 0; i < cleanedRows.length; i += BATCH_SIZE) {
    const batch = cleanedRows.slice(i, i + BATCH_SIZE);
    batchNum += 1;

    console.log(
      `[import_tickets] Pushing batch ${batchNum} (${batch.length} rows, offset ${i})…`,
    );

    const { error } = await supabase
      .from("tickets")
      .upsert(batch, { onConflict: "ticket_id" });

    if (error) {
      console.error(
        `[import_tickets] Batch ${batchNum} failed:`,
        error.message,
      );
      throw error;
    }

    total += batch.length;
    console.log(
      `[import_tickets] Batch ${batchNum} OK — upserted ${batch.length} rows (running total: ${total})`,
    );
  }

  console.log("[import_tickets] Done. Total rows upserted:", total);
}

main().catch((err) => {
  console.error("[import_tickets] Fatal:", err);
  process.exit(1);
});
