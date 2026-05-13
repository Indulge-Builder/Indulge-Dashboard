/**
 * One-off bulk import: ./leads-export.csv → Supabase `leads` (upsert, batches of 200).
 *
 * Run from project root:
 *   node import_leads.js
 */

require("dotenv").config({ path: ".env.local", quiet: true });
require("dotenv").config({ quiet: true });

const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");
const { createClient } = require("@supabase/supabase-js");

const BATCH_SIZE = 200;
const CSV_FILE = path.join(__dirname, "leads-export.csv");

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

/**
 * Zoho exports timestamps as "YYYY-MM-DD HH:MM:SS" in IST (no tz suffix).
 * Convert to a proper UTC ISO string so Supabase stores the correct instant.
 */
function toUtcIso(zohoTimestamp) {
  if (!zohoTimestamp || !zohoTimestamp.trim()) return null;
  const s = zohoTimestamp.trim();
  // Already has tz info — pass through
  if (s.includes("T") || s.includes("+") || s.endsWith("Z")) return s;
  // "YYYY-MM-DD HH:MM:SS" → treat as IST (+05:30) → convert to UTC
  const istIso = s.replace(" ", "T") + "+05:30";
  const ms = Date.parse(istIso);
  if (!Number.isFinite(ms)) return null;
  return new Date(ms).toISOString();
}

const VALID_VERTICALS = ["Indulge Global", "Indulge Shop", "Indulge House", "Indulge Legacy"];

function parseRow(row) {
  const leadId = (row["lead_id"] ?? "").trim();
  if (!leadId) return null;

  const vertical = (row["business_vertical"] ?? "").trim();

  return {
    lead_id:           leadId,
    lead_name:         (row["lead_name"] ?? "").trim() || null,
    agent_name:        (row["agent_name"] ?? "").trim() || null,
    latest_status:     (row["latest_status"] ?? "").trim() || null,
    business_vertical: VALID_VERTICALS.includes(vertical) ? vertical : "Indulge Global",
    created_at:        toUtcIso(row["created_at"]),
    modified_at:       toUtcIso(row["modified_at"]),
  };
}

async function upsertBatch(rows) {
  const { error } = await supabase
    .from("leads")
    .upsert(rows, { onConflict: "lead_id" });
  if (error) throw new Error(error.message);
}

async function main() {
  if (!fs.existsSync(CSV_FILE)) {
    console.error(`CSV not found: ${CSV_FILE}`);
    process.exit(1);
  }

  const rows = [];
  let skipped = 0;

  await new Promise((resolve, reject) => {
    fs.createReadStream(CSV_FILE)
      .pipe(csv())
      .on("data", (raw) => {
        const parsed = parseRow(raw);
        if (parsed) rows.push(parsed);
        else skipped++;
      })
      .on("end", resolve)
      .on("error", reject);
  });

  console.log(`Parsed ${rows.length} rows (skipped ${skipped} with no lead_id)`);

  let inserted = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    await upsertBatch(batch);
    inserted += batch.length;
    console.log(`  Upserted ${inserted} / ${rows.length}`);
  }

  console.log(`Done. ${inserted} leads upserted into Supabase.`);
}

main().catch((err) => {
  console.error("Import failed:", err.message);
  process.exit(1);
});
