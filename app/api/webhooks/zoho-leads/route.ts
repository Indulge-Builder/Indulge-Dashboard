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
 * `agent_name` from Zoho is full name (e.g. Amit Agarwal, Samson Fernandes,
 * Meghana Singh); we normalize to Amit, Samson, or Meghana (see
 * normalizeZohoAgentName in lib/onboardingAgents.ts).
 *
 * Table (see migration 20250401140000_create_onboarding_lead_touches.sql):
 *   onboarding_lead_touches (lead_id PK, agent_name, latest_status, first_touched_at, updated_at)
 */

import { NextRequest, NextResponse } from "next/server";
import { requireSupabaseAdminOr503 } from "@/lib/supabaseAdmin";
import { normalizeZohoAgentName } from "@/lib/onboardingAgents";

interface ZohoLeadsPayload {
  lead_id?: string | number;
  agent_name?: string;
  latest_status?: string;
}

function safeJsonParse(text: string): { ok: true; value: unknown } | { ok: false; error: string } {
  try {
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch (e) {
    const msg =
      e instanceof Error ? e.message : typeof e === "string" ? e : "Unknown JSON parse error";
    return { ok: false, error: msg };
  }
}

function parseFormUrlEncoded(text: string): Record<string, string> {
  const params = new URLSearchParams(text);
  const out: Record<string, string> = {};
  // If keys repeat, keep the last value (most typical for form posts).
  params.forEach((v, k) => {
    out[k] = v;
  });
  return out;
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
    typeof o.agent_name === "string" ? normalizeZohoAgentName(o.agent_name) : "";
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

  const requestId =
    req.headers.get("x-request-id") ??
    req.headers.get("cf-ray") ??
    `local-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  const contentType = req.headers.get("content-type") ?? "";
  const userAgent = req.headers.get("user-agent") ?? "";

  let rawText = "";
  try {
    rawText = await req.text();
  } catch (e) {
    console.error("[zoho-leads webhook] failed reading body", { requestId, error: e });
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  console.log("[zoho-leads webhook] incoming", {
    requestId,
    contentType,
    userAgent,
    bodyLength: rawText.length,
    bodyPreview: rawText.slice(0, 2000),
  });

  let body: unknown;
  if (contentType.toLowerCase().includes("application/json")) {
    const parsedJson = safeJsonParse(rawText);
    if (!parsedJson.ok) {
      console.error("[zoho-leads webhook] invalid JSON", {
        requestId,
        parseError: parsedJson.error,
        bodyPreview: rawText.slice(0, 2000),
      });
      return NextResponse.json(
        { error: "Invalid JSON body", detail: parsedJson.error },
        { status: 400 },
      );
    }
    body = parsedJson.value;
  } else if (
    contentType.toLowerCase().includes("application/x-www-form-urlencoded")
  ) {
    body = parseFormUrlEncoded(rawText);
  } else {
    // Be permissive: Zoho/other senders sometimes omit or mis-set content-type.
    // Try JSON first, then fall back to form encoding.
    const parsedJson = safeJsonParse(rawText);
    body = parsedJson.ok ? parsedJson.value : parseFormUrlEncoded(rawText);
  }

  const parsed = parsePayload(body);
  if (!parsed) {
    const b = body as Record<string, unknown> | null;
    console.error("[zoho-leads webhook] payload mapping failed", {
      requestId,
      topLevelKeys:
        b && typeof b === "object" ? Object.keys(b).slice(0, 100) : null,
      lead_id: b && typeof b === "object" ? b["lead_id"] : null,
      agent_name: b && typeof b === "object" ? b["agent_name"] : null,
      latest_status: b && typeof b === "object" ? b["latest_status"] : null,
    });
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

  console.log("[zoho-leads webhook] mapped fields", {
    requestId,
    leadId,
    agentName,
    latestStatus,
  });

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
      console.log("[zoho-leads webhook] upsert result", {
        requestId,
        action: "updated",
        leadId,
      });
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
        console.log("[zoho-leads webhook] upsert result", {
          requestId,
          action: "updated",
          leadId,
          note: "insert race (duplicate lead_id) recovered via update",
        });
        return NextResponse.json({ ok: true, action: "updated" });
      }
      console.error("[zoho-leads webhook] insert", insErr);
      return NextResponse.json(
        { error: "Database error", detail: insErr.message },
        { status: 500 },
      );
    }

    console.log("[zoho-leads webhook] upsert result", {
      requestId,
      action: "inserted",
      leadId,
    });
    return NextResponse.json({ ok: true, action: "inserted" });
  } catch (e) {
    console.error("[zoho-leads webhook]", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
