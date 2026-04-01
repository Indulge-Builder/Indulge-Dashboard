/**
 * POST /api/webhooks/zoho-leads
 *
 * Zoho CRM workflow → Lead Status updates. Upserts `onboarding_lead_touches`:
 * new lead_id → insert (first_touched_at + updated_at = now);
 * existing lead_id → update latest_status + updated_at only (first_touched_at unchanged).
 *
 * JSON body (map Zoho merge fields):
 *   { "lead_id": "...", "agent_name": "...", "latest_status": "..." }
 *
 * `agent_name` should match onboarding sales agents: Amit, Samson, or Meghana
 * (see lib/onboardingAgents.ts — same as onboarding_sales_agents.display_name).
 *
 * Table (see migration 20250401140000_create_onboarding_lead_touches.sql):
 *   onboarding_lead_touches (lead_id PK, agent_name, latest_status, first_touched_at, updated_at)
 */

import { NextRequest, NextResponse } from "next/server";
import { requireSupabaseAdminOr503 } from "@/lib/supabaseAdmin";

interface ZohoLeadsPayload {
  lead_id?: string | number;
  agent_name?: string;
  latest_status?: string;
}

function parsePayload(body: unknown): {
  leadId: string;
  agentName: string;
  latestStatus: string;
} | null {
  if (body == null || typeof body !== "object") return null;
  const o = body as ZohoLeadsPayload;
  const rawId = o.lead_id;
  const leadId =
    rawId != null && String(rawId).trim() !== "" ? String(rawId).trim() : "";
  const agentName =
    typeof o.agent_name === "string" ? o.agent_name.trim() : "";
  const latestStatus =
    typeof o.latest_status === "string" ? o.latest_status.trim() : "";
  if (!leadId || !agentName || !latestStatus) return null;
  return { leadId, agentName, latestStatus };
}

export async function POST(req: NextRequest) {
  const { db, response } = requireSupabaseAdminOr503();
  if (!db) {
    return (
      response ??
      NextResponse.json(
        { error: "SUPABASE_SERVICE_ROLE_KEY is not configured" },
        { status: 503 },
      )
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = parsePayload(body);
  if (!parsed) {
    return NextResponse.json(
      {
        error:
          "Missing or invalid fields: lead_id, agent_name, and latest_status are required",
      },
      { status: 400 },
    );
  }

  const { leadId, agentName, latestStatus } = parsed;
  const nowIso = new Date().toISOString();

  try {
    const { data: existing, error: selErr } = await db
      .from("onboarding_lead_touches")
      .select("lead_id")
      .eq("lead_id", leadId)
      .maybeSingle();

    if (selErr) {
      console.error("[zoho-leads webhook] select", selErr);
      return NextResponse.json(
        { error: "Database error", detail: selErr.message },
        { status: 500 },
      );
    }

    if (existing) {
      const { error: updErr } = await db
        .from("onboarding_lead_touches")
        .update({
          latest_status: latestStatus,
          updated_at: nowIso,
        })
        .eq("lead_id", leadId);

      if (updErr) {
        console.error("[zoho-leads webhook] update", updErr);
        return NextResponse.json(
          { error: "Database error", detail: updErr.message },
          { status: 500 },
        );
      }
      return NextResponse.json({ ok: true, action: "updated" });
    }

    const { error: insErr } = await db.from("onboarding_lead_touches").insert({
      lead_id: leadId,
      agent_name: agentName,
      latest_status: latestStatus,
      first_touched_at: nowIso,
      updated_at: nowIso,
    });

    if (insErr) {
      // Race: another request inserted same lead_id
      if (insErr.code === "23505") {
        const { error: raceUpd } = await db
          .from("onboarding_lead_touches")
          .update({
            latest_status: latestStatus,
            updated_at: nowIso,
          })
          .eq("lead_id", leadId);
        if (raceUpd) {
          console.error("[zoho-leads webhook] race update", raceUpd);
          return NextResponse.json(
            { error: "Database error", detail: raceUpd.message },
            { status: 500 },
          );
        }
        return NextResponse.json({ ok: true, action: "updated" });
      }
      console.error("[zoho-leads webhook] insert", insErr);
      return NextResponse.json(
        { error: "Database error", detail: insErr.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true, action: "inserted" });
  } catch (e) {
    console.error("[zoho-leads webhook]", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
