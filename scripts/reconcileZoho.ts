/**
 * scripts/reconcileZoho.ts — Zoho CRM → Supabase `leads` / `deals` reconciliation.
 *
 *   npm run reconcile-zoho -- --leads a.ndjson b.ndjson --deals deals.ndjson            # dry run (diff only)
 *   npm run reconcile-zoho -- --leads ... --deals ... --apply                            # upsert changed + missing rows
 *   npm run reconcile-zoho -- --leads ... --deals ... --apply --delete-missing           # also delete DB rows Zoho no longer has
 *
 * --delete-missing is race-safe: a DB row created AFTER the newest Created_Time in the
 * dump is a live webhook arrival the dump could not contain, so it is never deleted
 * (2026-09-08: a lead created 2 h after the dump was wrongly removed before this guard).
 *
 * Zoho is the source of truth (user decision 2026-09-07). Input files are NDJSON
 * dumps of COQL rows (one Zoho record per line) with at least:
 *   Leads: id, Lead_Status, Owner{id,name}, Full_Name, Business_Vertical, Created_Time, Modified_Time
 *   Deals: id, Deal_Name, Owner{id,name}, Stage, Closing_Date, Created_Time
 * e.g. `select id, Lead_Status, Owner, Full_Name, Business_Vertical, Created_Time,
 * Modified_Time, Converted__s from Leads where ... order by id asc limit 200 offset N`
 * — pass the pages for converted leads too (COQL hides them unless
 * `Converted__s = true` is in the criteria); converted leads stay in the DB
 * with their last status, exactly like the webhook would have left them.
 *
 * Why not the webhook's shape: COQL returns `Owner.name` as the LAST name only
 * (or null), while the webhook stores the owner's full name — so owners are
 * resolved by id through OWNER_NAMES (Zoho users API, read 2026-09-07). Add a
 * line there when a Zoho user joins; unknown ids fall back to Owner.name.
 *
 * Reads .env.local itself (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY).
 * Timestamps: Zoho sends ISO with +05:30 offset → stored as UTC ISO (`Z`).
 * Compared at 1 s tolerance. Never touches `tickets`.
 */
import { readFileSync, existsSync } from "fs";
import { createClient } from "@supabase/supabase-js";
import { normalizeZohoAgentName } from "@/lib/onboardingAgents";
import { BUSINESS_VERTICALS } from "@/lib/onboardingTypes";

// ── env ──────────────────────────────────────────────────────────────────────
if (existsSync(".env.local")) {
  for (const l of readFileSync(".env.local", "utf8").split("\n")) {
    const m = l.match(/^([A-Z_]+)=(.*)$/);
    if (m && process.env[m[1]!] == null) process.env[m[1]!] = m[2]!.replace(/^"|"$/g, "");
  }
}
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL, KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY) { console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY"); process.exit(1); }
const db = createClient(URL, KEY, { auth: { persistSession: false } });

// ── args ─────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const APPLY = argv.includes("--apply");
const DELETE_MISSING = argv.includes("--delete-missing");

/** Newest Created_Time in the dump (ms). DB rows created after it post-date the dump. */
function dumpHorizonMs(rows: Record<string, unknown>[]): number {
  let max = 0;
  for (const r of rows) { const ms = Date.parse(toUtcIso(r.Created_Time) ?? ""); if (ms > max) max = ms; }
  return max;
}
/** Split DB-only rows into deletable (older than the dump) and post-dump arrivals to keep. */
function splitByHorizon<T extends { created_at: string }>(rows: T[], horizonMs: number) {
  const stale: T[] = [], fresh: T[] = [];
  for (const r of rows) (Date.parse(r.created_at) > horizonMs ? fresh : stale).push(r);
  return { stale, fresh };
}
function filesAfter(flag: string): string[] {
  const i = argv.indexOf(flag); if (i < 0) return [];
  const out: string[] = [];
  for (let j = i + 1; j < argv.length && !argv[j]!.startsWith("--"); j++) out.push(argv[j]!);
  return out;
}
const LEAD_FILES = filesAfter("--leads");
const DEAL_FILES = filesAfter("--deals");
if (LEAD_FILES.length === 0 && DEAL_FILES.length === 0) {
  console.error("Usage: reconcileZoho.ts --leads <ndjson...> [--deals <ndjson...>] [--apply] [--delete-missing]");
  process.exit(1);
}

// ── Zoho owner id → full name (Zoho users API, 2026-09-07) ──────────────────
const OWNER_NAMES: Record<string, string> = {
  "480426000000265001": "Admin @ Indulge",
  "480426000001330157": "Samson Fernandes",
  "480426000002132625": "Kaniisha Chamarria",
  "480426000007095004": "Nandini Pandey",
  "480426000007095022": "Kabeer Dhawan",
  "480426000007095036": "Surbhi Dewan",
  "480426000002105003": "Amit Agarwal",
  "480426000002105028": "Meghana Singh",
  "480426000001330194": "Meghana Singh",
  "480426000001330099": "Meghana",
  "480426000001330120": "Kaniisha",
  "480426000002105137": "Andreas Barua",
  "480426000001616131": "Arfam",
  "480426000002493001": "Vikram",
  "480426000002493026": "Harsh Gupta",
  "480426000002105068": "Katya",
};
const unknownOwners = new Map<string, number>();
function ownerName(o: { id?: string; name?: string | null } | null | undefined): string {
  const id = o?.id ?? "";
  const known = OWNER_NAMES[id];
  if (known) return known;
  if (id) unknownOwners.set(id, (unknownOwners.get(id) ?? 0) + 1);
  return normalizeZohoAgentName(o?.name ?? "") || "Unassigned";
}

// ── helpers ──────────────────────────────────────────────────────────────────
function readNdjson(files: string[]): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  for (const f of files) {
    for (const line of readFileSync(f, "utf8").split("\n")) {
      const t = line.trim(); if (!t) continue;
      out.push(JSON.parse(t) as Record<string, unknown>);
    }
  }
  return out;
}
function toUtcIso(zohoTime: unknown): string | null {
  if (typeof zohoTime !== "string" || !zohoTime.trim()) return null;
  const ms = Date.parse(zohoTime);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}
function sameInstant(a: string | null | undefined, b: string | null | undefined): boolean {
  const ma = a ? Date.parse(a) : NaN, mb = b ? Date.parse(b) : NaN;
  if (!Number.isFinite(ma) || !Number.isFinite(mb)) return a == null && b == null;
  return Math.abs(ma - mb) < 1000;
}
async function fetchAll<T>(table: string, cols: string): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from(table).select(cols).range(from, from + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    out.push(...(data as T[]));
    if (!data || data.length < 1000) break;
  }
  return out;
}
async function upsertBatches(table: string, key: string, rows: Record<string, unknown>[]) {
  for (let i = 0; i < rows.length; i += 200) {
    const { error } = await db.from(table).upsert(rows.slice(i, i + 200), { onConflict: key });
    if (error) throw new Error(`${table} upsert: ${error.message}`);
    if (rows.length > 200) process.stdout.write(`  ${Math.min(i + 200, rows.length)}/${rows.length}\r`);
  }
  if (rows.length > 200) process.stdout.write("\n");
}
async function deleteBatches(table: string, key: string, ids: string[]) {
  for (let i = 0; i < ids.length; i += 200) {
    const { error } = await db.from(table).delete().in(key, ids.slice(i, i + 200));
    if (error) throw new Error(`${table} delete: ${error.message}`);
  }
}
const inc = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + 1);

// ── leads ────────────────────────────────────────────────────────────────────
type DbLead = { lead_id: string; agent_name: string; latest_status: string | null; lead_name: string | null; business_vertical: string | null; created_at: string; modified_at: string | null };

async function reconcileLeads() {
  const zohoRows = readNdjson(LEAD_FILES);
  const zoho = new Map<string, Record<string, unknown>>();
  for (const r of zohoRows) zoho.set(String(r.id), r); // last page wins on duplicates
  console.log(`\n== LEADS ==  Zoho rows: ${zohoRows.length} (${zoho.size} unique ids)`);

  console.log("fetching DB leads…");
  const dbRows = await fetchAll<DbLead>("leads", "lead_id, agent_name, latest_status, lead_name, business_vertical, created_at, modified_at");
  const dbById = new Map(dbRows.map((r) => [r.lead_id, r]));
  console.log(`DB rows: ${dbRows.length}`);

  const toUpsert: Record<string, unknown>[] = [];
  const fieldDiffs = new Map<string, number>();
  const statusPairs = new Map<string, number>();
  let inserts = 0;

  for (const [id, z] of zoho) {
    const statusRaw = typeof z.Lead_Status === "string" ? z.Lead_Status.trim() : "";
    const expected = {
      lead_id: id,
      agent_name: ownerName(z.Owner as { id?: string; name?: string | null } | null),
      latest_status: !statusRaw || statusRaw === "-None-" ? "New" : statusRaw,
      lead_name: typeof z.Full_Name === "string" ? z.Full_Name.trim() : "",
      business_vertical: (BUSINESS_VERTICALS as readonly string[]).includes(String(z.Business_Vertical ?? ""))
        ? String(z.Business_Vertical) : "Indulge Global",
      created_at: toUtcIso(z.Created_Time),
      modified_at: toUtcIso(z.Modified_Time) ?? toUtcIso(z.Created_Time),
    };
    if (!expected.created_at) { console.warn(`skip ${id}: unparseable Created_Time`, z.Created_Time); continue; }

    const cur = dbById.get(id);
    if (!cur) { inserts++; toUpsert.push(expected); continue; }

    const diffs: string[] = [];
    if (cur.agent_name !== expected.agent_name) diffs.push("agent_name");
    if ((cur.latest_status ?? "") !== expected.latest_status) { diffs.push("latest_status"); inc(statusPairs, `${cur.latest_status} -> ${expected.latest_status}`); }
    if ((cur.lead_name ?? "") !== expected.lead_name) diffs.push("lead_name");
    if ((cur.business_vertical ?? "Indulge Global") !== expected.business_vertical) diffs.push("business_vertical");
    if (!sameInstant(cur.created_at, expected.created_at)) diffs.push("created_at");
    if (!sameInstant(cur.modified_at, expected.modified_at)) diffs.push("modified_at");
    if (diffs.length) { for (const d of diffs) inc(fieldDiffs, d); toUpsert.push(expected); }
  }

  const horizon = dumpHorizonMs(zohoRows);
  const { stale: missingInZoho, fresh: newerThanDump } = splitByHorizon(dbRows.filter((r) => !zoho.has(r.lead_id)), horizon);
  console.log(`inserts (in Zoho, not in DB): ${inserts}`);
  console.log(`updates (field diffs): ${toUpsert.length - inserts}`, Object.fromEntries(fieldDiffs));
  console.log("status transitions:", Object.fromEntries([...statusPairs].sort((a, b) => b[1] - a[1])));
  const missByStatus = new Map<string, number>(); for (const r of missingInZoho) inc(missByStatus, r.latest_status ?? "∅");
  console.log(`in DB, not in Zoho (deleted / trashed / not dumped): ${missingInZoho.length}`, Object.fromEntries(missByStatus));
  if (missingInZoho.length) console.log("  sample:", missingInZoho.slice(0, 8).map((r) => `${r.lead_id} ${r.lead_name} [${r.latest_status}] ${r.created_at.slice(0, 10)}`));
  if (newerThanDump.length) console.log(`in DB, newer than the dump (webhook arrivals after ${new Date(horizon).toISOString()} — kept, never deleted): ${newerThanDump.length}`, newerThanDump.map((r) => `${r.lead_id} ${r.lead_name}`));
  if (unknownOwners.size) console.warn("UNKNOWN owner ids (fell back to Owner.name) — extend OWNER_NAMES:", Object.fromEntries(unknownOwners));

  if (APPLY) {
    console.log(`applying ${toUpsert.length} lead upserts in batches of 200…`);
    await upsertBatches("leads", "lead_id", toUpsert);
    console.log(`APPLIED: upserted ${toUpsert.length} lead rows`);
    if (DELETE_MISSING && missingInZoho.length) {
      await deleteBatches("leads", "lead_id", missingInZoho.map((r) => r.lead_id));
      console.log(`APPLIED: deleted ${missingInZoho.length} lead rows absent from Zoho`);
    }
  } else {
    console.log("(dry run — pass --apply to write, --delete-missing to also remove rows Zoho no longer has)");
  }
}

// ── deals ────────────────────────────────────────────────────────────────────
type DbDeal = { deal_id: string; deal_name: string; agent_name: string; created_at: string; closing_date: string | null };

async function reconcileDeals() {
  const zohoRows = readNdjson(DEAL_FILES);
  const zoho = new Map<string, Record<string, unknown>>();
  for (const r of zohoRows) zoho.set(String(r.id), r);
  console.log(`\n== DEALS ==  Zoho rows: ${zohoRows.length} (${zoho.size} unique ids)`);
  const stages = new Map<string, number>(); for (const r of zoho.values()) inc(stages, String(r.Stage ?? "∅"));
  console.log("Zoho stages:", Object.fromEntries(stages));

  // Requires migration 20260907120000 (deals.closing_date) — the error names it otherwise.
  const dbRows = await fetchAll<DbDeal>("deals", "deal_id, deal_name, agent_name, created_at, closing_date");
  const dbById = new Map(dbRows.map((r) => [r.deal_id, r]));
  console.log(`DB rows: ${dbRows.length}`);

  const toUpsert: Record<string, unknown>[] = [];
  const fieldDiffs = new Map<string, number>();
  let inserts = 0;
  for (const [id, z] of zoho) {
    const expected = {
      deal_id: id,
      deal_name: typeof z.Deal_Name === "string" ? z.Deal_Name.trim() : "",
      agent_name: ownerName(z.Owner as { id?: string; name?: string | null } | null),
      created_at: toUtcIso(z.Created_Time),
      closing_date: typeof z.Closing_Date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(z.Closing_Date) ? z.Closing_Date : null,
    };
    if (!expected.created_at || !expected.deal_name) { console.warn(`skip deal ${id}: missing name/time`); continue; }
    const cur = dbById.get(id);
    if (!cur) { inserts++; toUpsert.push(expected); continue; }
    const diffs: string[] = [];
    if (cur.deal_name !== expected.deal_name) diffs.push("deal_name");
    if (cur.agent_name !== expected.agent_name) diffs.push("agent_name");
    if (!sameInstant(cur.created_at, expected.created_at)) diffs.push("created_at");
    if ((cur.closing_date ?? null) !== expected.closing_date) diffs.push("closing_date");
    if (diffs.length) { for (const d of diffs) inc(fieldDiffs, d); toUpsert.push(expected); }
  }
  const horizon = dumpHorizonMs(zohoRows);
  const { stale: missingInZoho, fresh: newerThanDump } = splitByHorizon(dbRows.filter((r) => !zoho.has(r.deal_id)), horizon);
  console.log(`inserts: ${inserts}; updates: ${toUpsert.length - inserts}`, Object.fromEntries(fieldDiffs));
  console.log(`in DB, not in Zoho: ${missingInZoho.length}`, missingInZoho.map((r) => `${r.deal_id} ${r.deal_name} (${r.agent_name}) ${r.created_at.slice(0, 10)}`));
  if (newerThanDump.length) console.log(`in DB, newer than the dump (kept, never deleted): ${newerThanDump.length}`, newerThanDump.map((r) => `${r.deal_id} ${r.deal_name}`));

  if (APPLY) {
    await upsertBatches("deals", "deal_id", toUpsert);
    console.log(`APPLIED: upserted ${toUpsert.length} deal rows`);
    if (DELETE_MISSING && missingInZoho.length) {
      await deleteBatches("deals", "deal_id", missingInZoho.map((r) => r.deal_id));
      console.log(`APPLIED: deleted ${missingInZoho.length} deal rows absent from Zoho`);
    }
  }
}

(async () => {
  if (LEAD_FILES.length) await reconcileLeads();
  if (DEAL_FILES.length) await reconcileDeals();
  process.exit(0); // don't let a lingering client socket keep the process alive
})().catch((e) => { console.error(e); process.exit(1); });
