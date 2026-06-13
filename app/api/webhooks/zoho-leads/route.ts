/**
 * POST /api/webhooks/zoho-leads
 *
 * Zoho CRM → Lead create / update. Upserts one row per `lead_id` in
 * `leads` with columns:
 *   lead_id, agent_name, latest_status, lead_name, business_vertical,
 *   created_at, modified_at
 *
 * JSON body (map Zoho merge fields):
 *   {
 *     "lead_id":           "...",
 *     "agent_name":        "...",
 *     "status":            "...",        // or "latest_status"
 *     "lead_name":         "...",        // optional — first_name / full name
 *     "business_vertical": "Indulge Global", // one of the 4 verticals; default Global
 *     "created_at":        "ISO-8601",   // optional — Zoho create time; else server now on insert
 *     "modified_at":       "ISO-8601"    // optional — else server now on every write
 *   }
 *
 * `agent_name` is normalised for storage (trim/collapse spaces) via
 * {@link normalizeZohoAgentName} while preserving full Zoho owner name.
 */

import { NextRequest, NextResponse } from "next/server";
import { normalizeZohoAgentName } from "@/lib/onboardingAgents";
import { requireSupabaseAdminOr503 } from "@/lib/supabaseAdmin";
import { assertWebhookSecret } from "@/lib/webhookAuth";
import {
  readZohoWebhookBody,
  zohoNowUtcForDb,
  zohoTimestampToDb,
} from "@/lib/zohoWebhook";

const VALID_VERTICALS = [
  "Indulge Global",
  "Indulge Shop",
  "Indulge House",
  "Indulge Legacy",
] as const;

type BusinessVertical = (typeof VALID_VERTICALS)[number];

function parseBusinessVertical(raw: unknown): BusinessVertical {
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if ((VALID_VERTICALS as readonly string[]).includes(trimmed)) {
      return trimmed as BusinessVertical;
    }
  }
  return "Indulge Global";
}

interface ZohoLeadsPayload {
  lead_id?: string | number;
  agent_name?: string;
  status?: string;
  latest_status?: string;
  lead_name?: string;
  first_name?: string;
  business_vertical?: string;
  created_at?: string;
  modified_at?: string;
}

function parsePayload(body: unknown): {
  leadId: string;
  agentName: string;
  status: string;
  leadName: string;
  businessVertical: BusinessVertical;
  createdAtClient: string | null;
  modifiedAtClient: string | null;
} | null {
  if (body == null || typeof body !== "object") return null;
  const o = body as ZohoLeadsPayload;

  const rawId = o.lead_id;
  const leadId =
    rawId != null && String(rawId).trim() !== "" ? String(rawId).trim() : "";
  const agentName =
    typeof o.agent_name === "string" ? normalizeZohoAgentName(o.agent_name) : "";
  const statusRaw =
    typeof o.status === "string"
      ? o.status.trim()
      : typeof o.latest_status === "string"
        ? o.latest_status.trim()
        : "";

  const leadNameRaw =
    typeof o.lead_name === "string" && o.lead_name.trim()
      ? o.lead_name.trim()
      : typeof o.first_name === "string" && o.first_name.trim()
        ? o.first_name.trim()
        : "";

  if (!leadId || !agentName || !statusRaw) return null;

  return {
    leadId,
    agentName,
    status: statusRaw,
    leadName: leadNameRaw,
    businessVertical: parseBusinessVertical(o.business_vertical),
    createdAtClient: typeof o.created_at === "string" ? zohoTimestampToDb(o.created_at) : null,
    modifiedAtClient: typeof o.modified_at === "string" ? zohoTimestampToDb(o.modified_at) : null,
  };
}

export async function POST(req: NextRequest) {
  const unauthorized = assertWebhookSecret(req);
  if (unauthorized) return unauthorized;

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

  const bodyResult = await readZohoWebhookBody(req, "zoho-leads webhook");
  if (!bodyResult.ok) return bodyResult.response;
  const { body, requestId } = bodyResult;

  const parsed = parsePayload(body);
  if (!parsed) {
    const b = body as Record<string, unknown> | null;
    console.error("[zoho-leads webhook] payload mapping failed", {
      requestId,
      topLevelKeys:
        b && typeof b === "object" ? Object.keys(b).slice(0, 100) : null,
      lead_id: b && typeof b === "object" ? b["lead_id"] : null,
      agent_name: b && typeof b === "object" ? b["agent_name"] : null,
      status: b && typeof b === "object" ? b["status"] : null,
      latest_status: b && typeof b === "object" ? b["latest_status"] : null,
    });
    return NextResponse.json(
      {
        error:
          "Missing or invalid fields: lead_id, agent_name, and status (or latest_status) are required",
      },
      { status: 400 },
    );
  }

  const { leadId, agentName, status, leadName, businessVertical, createdAtClient, modifiedAtClient } = parsed;
  const touchedNow = zohoNowUtcForDb();
  const modifiedAt = modifiedAtClient ?? touchedNow;

  // Deliberately two-step (select → update/insert) instead of a single upsert:
  // `created_at` is immutable after first insert (cohort anchor), and a blind
  // upsert would overwrite it on every repeat webhook. The 23505 retry below
  // covers the insert race (expected dedup, see CLAUDE.md invariant #9).
  try {
    const { data: existing, error: selErr } = await db
      .from("leads")
      .select("lead_id, created_at")
      .eq("lead_id", leadId)
      .maybeSingle();

    if (selErr) {
      console.error("[zoho-leads webhook] select error", selErr);
      return NextResponse.json(
        { error: "Database error", detail: selErr.message },
        { status: 500 },
      );
    }

    if (existing?.lead_id) {
      const { error: updErr } = await db
        .from("leads")
        .update({
          agent_name: agentName,
          latest_status: status,
          lead_name: leadName,
          business_vertical: businessVertical,
          modified_at: modifiedAt,
        })
        .eq("lead_id", leadId);

      if (updErr) {
        console.error("[zoho-leads webhook] update error", updErr);
        return NextResponse.json(
          { error: "Database error", detail: updErr.message },
          { status: 500 },
        );
      }
      console.log("[zoho-leads webhook] updated", { requestId, leadId });
      return NextResponse.json({ ok: true, action: "updated" });
    }

    const createdAt = createdAtClient ?? touchedNow;
    const { error: insErr } = await db.from("leads").insert({
      lead_id: leadId,
      agent_name: agentName,
      latest_status: status,
      lead_name: leadName,
      business_vertical: businessVertical,
      created_at: createdAt,
      modified_at: modifiedAt,
    });

    if (insErr) {
      if (insErr.code === "23505") {
        console.log("[zoho-leads webhook] race — retry as update", { requestId, leadId });
        const { error: updErr2 } = await db
          .from("leads")
          .update({
            agent_name: agentName,
            latest_status: status,
            lead_name: leadName,
            business_vertical: businessVertical,
            modified_at: modifiedAt,
          })
          .eq("lead_id", leadId);
        if (updErr2) {
          console.error("[zoho-leads webhook] update after race failed", updErr2);
          return NextResponse.json(
            { error: "Database error", detail: updErr2.message },
            { status: 500 },
          );
        }
        return NextResponse.json({ ok: true, action: "updated" });
      }
      console.error("[zoho-leads webhook] insert error", insErr);
      return NextResponse.json(
        { error: "Database error", detail: insErr.message },
        { status: 500 },
      );
    }

    console.log("[zoho-leads webhook] inserted", { requestId, leadId });
    return NextResponse.json({ ok: true, action: "inserted" });
  } catch (e) {
    console.error("[zoho-leads webhook]", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
