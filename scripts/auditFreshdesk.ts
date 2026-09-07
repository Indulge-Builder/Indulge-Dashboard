/**
 * scripts/auditFreshdesk.ts — Freshdesk ↔ Supabase ↔ dashboard reconciliation (READ-ONLY).
 *
 *   set -a; source .env.local; set +a; npm run audit-freshdesk
 *   DASHBOARD_URL=http://localhost:3000 npm run audit-freshdesk   # also diff /api/tickets/rows
 *
 * Pulls every ticket Freshdesk touched since the IST month start (+ the open
 * backlog via the search API), diffs each row against `tickets` (status, group,
 * agent, created_at, resolved_at, is_escalated), then recomputes the dashboard's
 * queendom + agent metrics from BOTH sources with lib/ticketAggregation and
 * prints the mismatches. First run 2026-09-05 found 20 missing tickets, 29 stale
 * statuses and 60 arrival-time created_at rows (see CLAUDE.md "Freshdesk ↔ DB
 * audit"); heal with GET /api/cron/reconcile-freshdesk?hours=168, then re-run.
 *
 * Notes: "missingInDb" also lists Freshdesk rows outside the DB's scope
 * (resolved tickets created before this month) — the true missing set is the
 * "created this month" subset. is_escalated diffs are definitional: Freshdesk's
 * own flag has no escalation levels configured, so it never flips.
 */
import { createClient } from "@supabase/supabase-js";
import { FD_STATUS_LABELS, cleanAgentName, UNASSIGNED_QUEENDOM } from "@/lib/freshdeskApi";
import { aggregateTicketStats, mergeAndRankAgents, pruneTicketRowsForDashboardState, type TicketRowMinimal } from "@/lib/ticketAggregation";
import { getCurrentIstMonthUtcBounds, istToday } from "@/lib/istDate";
import { normalizeQueendom, QUEENDOM_IDS } from "@/lib/queendom";
import { isTerminal, isVoid } from "@/lib/ticketStatus";
import { FALLBACK_ROSTER, rosterFromAgentRows, type AgentRecord, type RosterSnapshot } from "@/lib/agentRoster";

async function main() {
const FD = process.env.FRESHDESK_DOMAIN!, KEY = process.env.FRESHDESK_API_KEY!;
const auth = "Basic " + Buffer.from(`${KEY}:X`).toString("base64");
async function fd<T>(path: string): Promise<T> {
  for (let i = 0; i < 4; i++) {
    const r = await fetch(`https://${FD}/api/v2${path}`, { headers: { Authorization: auth } });
    if (r.status === 429) { const w = Math.min(Number(r.headers.get("Retry-After") ?? 30), 60); console.log(`  429 — waiting ${w}s`); await new Promise(res => setTimeout(res, w * 1000)); continue; }
    if (!r.ok) throw new Error(`FD ${path} → ${r.status}`);
    return r.json() as Promise<T>;
  }
  throw new Error("rate limited");
}
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const { startUtcIso } = getCurrentIstMonthUtcBounds();
const { day: TODAY, month: MONTH } = istToday();
console.log("IST today", TODAY, "month start UTC", startUtcIso);

// ── Freshdesk: names ──
const [groups, agents] = await Promise.all([
  fd<{ id: number; name: string }[]>("/groups?per_page=100"),
  fd<{ id: number; contact: { name: string } }[]>("/agents?per_page=100"),
]);
const gname = new Map(groups.map(g => [g.id, g.name]));
const aname = new Map(agents.map(a => [a.id, a.contact.name]));

interface FdT { id: number; status: number; group_id: number | null; responder_id: number | null; created_at: string; updated_at: string; is_escalated?: boolean; spam?: boolean; deleted?: boolean; due_by?: string | null; stats?: { resolved_at?: string | null; closed_at?: string | null } | null }
// ── Freshdesk: tickets updated since month start (⊇ created this month) ──
const fdMonth: FdT[] = [];
for (let page = 1; page <= 40; page++) {
  const b = await fd<FdT[]>(`/tickets?updated_since=${encodeURIComponent(startUtcIso)}&order_by=updated_at&order_type=asc&per_page=100&page=${page}&include=stats`);
  fdMonth.push(...b); if (b.length < 100) break;
}
const fdCreatedThisMonth = fdMonth.filter(t => t.created_at >= startUtcIso);
console.log(`FD: ${fdMonth.length} tickets updated since month start; ${fdCreatedThisMonth.length} created this month`);
// ── Freshdesk: open backlog created before this month (search API, 30/page, ≤10 pages) ──
const openStatuses = [2, 3, 6, 7, 8, 9, 9000];
const fdBacklog: FdT[] = [];
const beforeDay = startUtcIso.slice(0, 10); // created_at:< IST month start (UTC date is close enough; filtered exactly below)
for (let page = 1; page <= 10; page++) {
  const q = encodeURIComponent(`(${openStatuses.map(s => `status:${s}`).join(" OR ")}) AND created_at:<'${beforeDay}'`);
  const r = await fd<{ results: FdT[]; total: number }>(`/search/tickets?query="${q}"&page=${page}`);
  fdBacklog.push(...r.results); if (page === 1) console.log(`FD: open backlog before month per search: total=${r.total}`);
  if (r.results.length < 30) break;
}
const fdAll = new Map<number, FdT>();
for (const t of [...fdMonth, ...fdBacklog]) fdAll.set(t.id, t);

// ── Supabase: same scope as /api/tickets/rows ──
const cols = "ticket_id, status, queendom_name, agent_name, created_at, resolved_at, is_escalated, is_incomplete, tags, due_by";
async function pageAll(build: (from: number, to: number) => any) { const out: any[] = []; for (let from = 0; ; from += 1000) { const { data, error } = await build(from, from + 999); if (error) throw error; out.push(...data); if (data.length < 1000) break; } return out; }
const dbMonth = await pageAll((f, t) => db.from("tickets").select(cols).gte("created_at", startUtcIso).order("ticket_id").range(f, t));
let bq = db.from("tickets").select(cols).lt("created_at", startUtcIso);
for (const s of ["resolved", "closed", "spam", "deleted"]) bq = bq.not("status", "ilike", s);
const dbBacklog = await pageAll((f, t) => bq.order("ticket_id").range(f, t));
console.log(`DB: ${dbMonth.length} created this month; ${dbBacklog.length} open backlog before month`);
const dbAll = new Map<string, any>(); for (const r of [...dbMonth, ...dbBacklog]) dbAll.set(String(r.ticket_id), r);

// ── Row-level diff ──
const same = (a: string | null | undefined, b: string | null | undefined) => (a ? Date.parse(a) : null) === (b ? Date.parse(b) : null);
const issues: Record<string, string[]> = { missingInDb: [], status: [], group: [], agent: [], created_at: [], resolved_at: [], escalated: [], dbOnlyNonVoid: [] };
for (const t of fdAll.values()) {
  const r = dbAll.get(String(t.id));
  const fdStatus = t.deleted ? "deleted" : t.spam ? "spam" : (FD_STATUS_LABELS[t.status] ?? `#${t.status}`);
  if (!r) { if (!isVoid(fdStatus)) issues.missingInDb.push(`${t.id} ${fdStatus} ${gname.get(t.group_id!) ?? "-"} ${aname.get(t.responder_id!) ?? "-"} created ${t.created_at}`); continue; }
  if ((r.status ?? "").toLowerCase() !== fdStatus.toLowerCase()) issues.status.push(`${t.id} FD=${fdStatus} DB=${r.status}`);
  const fdGroup = (t.group_id != null ? gname.get(t.group_id) : null) ?? UNASSIGNED_QUEENDOM;
  if ((r.queendom_name ?? "") !== fdGroup) issues.group.push(`${t.id} FD=${fdGroup} DB=${r.queendom_name}`);
  const fdAgent = cleanAgentName(t.responder_id != null ? aname.get(t.responder_id) ?? null : null) ?? "Unassigned";
  if ((r.agent_name ?? "Unassigned").toLowerCase() !== fdAgent.toLowerCase()) issues.agent.push(`${t.id} FD=${fdAgent} DB=${r.agent_name}`);
  if (!same(t.created_at, r.created_at)) issues.created_at.push(`${t.id} FD=${t.created_at} DB=${r.created_at}`);
  if (isTerminal(fdStatus)) { const fdRes = t.stats?.resolved_at ?? t.stats?.closed_at ?? null; if (fdRes && !same(fdRes, r.resolved_at)) issues.resolved_at.push(`${t.id} FD=${fdRes} DB=${r.resolved_at}`); }
  else if (!isVoid(fdStatus) && t.is_escalated !== undefined && Boolean(t.is_escalated) !== Boolean(r.is_escalated)) issues.escalated.push(`${t.id} ${fdStatus} FD.is_escalated=${t.is_escalated} DB=${r.is_escalated} due_by=${t.due_by}`);
}
// DB rows (this month, non-void) that Freshdesk's list did not return → probably spam/deleted in FD now
const dbOnly = dbMonth.filter(r => !fdAll.has(Number(r.ticket_id)) && !isVoid(r.status));
for (const r of dbOnly.slice(0, 40)) { // verify individually (cheap GETs)
  try { const t = await fd<FdT>(`/tickets/${r.ticket_id}`); issues.dbOnlyNonVoid.push(`${r.ticket_id} DB=${r.status} FD=${t.deleted ? "deleted" : t.spam ? "spam" : FD_STATUS_LABELS[t.status]} (updated ${t.updated_at})`); }
  catch (e) { issues.dbOnlyNonVoid.push(`${r.ticket_id} DB=${r.status} FD=GET failed: ${(e as Error).message}`); }
}
if (dbOnly.length > 40) issues.dbOnlyNonVoid.push(`… ${dbOnly.length - 40} more not individually checked`);
console.log("\n=== ROW-LEVEL DIFF (Freshdesk vs Supabase) ===");
for (const [k, v] of Object.entries(issues)) { console.log(`${k}: ${v.length}`); for (const line of v.slice(0, 12)) console.log("   ", line); }

// ── Dashboard math: DB rows vs FD-derived rows, using the live roster ──
const base = process.env.DASHBOARD_URL ?? null;
let roster: RosterSnapshot;
let apiRows: TicketRowMinimal[] | null = null;
if (base) {
  roster = (await (await fetch(`${base}/api/roster`)).json()) as RosterSnapshot;
  apiRows = (await (await fetch(`${base}/api/tickets/rows`)).json()) as TicketRowMinimal[];
  console.log(`\n${base}/api/tickets/rows returned ${apiRows.length} rows; DB direct = ${dbMonth.length + dbBacklog.length}`);
} else {
  const { data: agentRows } = await db.from("agents").select("id, name, queendom, role, is_active, sort_order");
  roster = rosterFromAgentRows(agentRows as AgentRecord[] | null) ?? FALLBACK_ROSTER;
  console.log("\n(no DASHBOARD_URL — roster read from the agents table; API rows not diffed)");
}
const toMin = (r: any): TicketRowMinimal => ({ id: String(r.ticket_id), status: r.status, queendom_name: r.queendom_name, agent_name: r.agent_name, created_at: r.created_at, resolved_at: r.resolved_at, is_escalated: r.is_escalated, is_incomplete: r.is_incomplete, tags: r.tags });
const dbRows = pruneTicketRowsForDashboardState([...dbMonth, ...dbBacklog].map(toMin));
const fdRows = pruneTicketRowsForDashboardState([...fdAll.values()].map(t => ({
  id: String(t.id), status: t.deleted ? "deleted" : t.spam ? "spam" : (FD_STATUS_LABELS[t.status] ?? "Open"),
  queendom_name: (t.group_id != null ? gname.get(t.group_id) : null) ?? UNASSIGNED_QUEENDOM,
  agent_name: cleanAgentName(t.responder_id != null ? aname.get(t.responder_id) ?? null : null),
  created_at: t.created_at, resolved_at: t.stats?.resolved_at ?? t.stats?.closed_at ?? null,
  is_escalated: Boolean(t.is_escalated), is_incomplete: dbAll.get(String(t.id))?.is_incomplete ?? null, tags: null,
})));
const sDb = aggregateTicketStats(dbRows), sFd = aggregateTicketStats(fdRows), sApi = aggregateTicketStats(apiRows ?? dbRows);
console.log("\n=== QUEENDOM METRICS  (api-rows | db | freshdesk) ===");
for (const q of QUEENDOM_IDS) for (const k of ["solvedToday", "totalReceived", "resolvedThisMonth", "pendingToResolve"] as const) {
  const a = (sApi as any)[q][k], d = (sDb as any)[q][k], f = (sFd as any)[q][k];
  console.log(`${q.padEnd(11)} ${k.padEnd(18)} ${String(a).padStart(4)} | ${String(d).padStart(4)} | ${String(f).padStart(4)} ${a === d && d === f ? "" : "  <-- MISMATCH"}`);
}
const aDb = mergeAndRankAgents(dbRows, roster), aFd = mergeAndRankAgents(fdRows, roster);
console.log("\n=== AGENT ROWS with any difference (db vs freshdesk): today/received · month/assigned · pending/overdue/incomplete ===");
let agentDiffs = 0;
for (const q of QUEENDOM_IDS) for (const a of aDb[q]) {
  const f = aFd[q].find(x => x.name === a.name)!;
  const fmt = (x: any) => `${x.tasksCompletedToday}/${x.tasksAssignedToday} · ${x.tasksCompletedThisMonth}/${x.tasksAssignedThisMonth} · ${x.pendingScore}/${x.overdueCount}/${x.incomplete}`;
  if (fmt(a) !== fmt(f)) { agentDiffs++; console.log(`  ${q} ${a.name.padEnd(20)} db ${fmt(a)}   fd ${fmt(f)}`); }
}
console.log(agentDiffs === 0 ? "  none — every leaderboard row matches Freshdesk" : `  ${agentDiffs} agent rows differ`);
// Off-roster agents with tickets this month per queendom
console.log("\n=== Agents filing this month but NOT on the active roster (their tickets count in totals, not on the leaderboard) ===");
const rostered = new Set(QUEENDOM_IDS.flatMap(q => roster.agents[q]).map(n => n.toLowerCase()));
const off = new Map<string, number>();
for (const r of dbMonth) { const q = normalizeQueendom(r.queendom_name); if (!q || isVoid(r.status)) continue; const n = (r.agent_name ?? "Unassigned"); if (!rostered.has(n.toLowerCase())) off.set(`${q}: ${n}`, (off.get(`${q}: ${n}`) ?? 0) + 1); }
for (const [k, v] of [...off.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${k} — ${v}`);

}
main().catch((e) => { console.error(e); process.exit(1); });
