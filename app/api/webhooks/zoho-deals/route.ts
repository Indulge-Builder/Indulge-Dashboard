/**
 * POST /api/webhooks/zoho-deals
 *
 * Zoho CRM → New deal created. Inserts one row into `deals` per unique
 * `deal_id` so repeat webhooks do not duplicate rows.
 *
 * JSON body:
 *   {
 *     "deal_id":    "...",
 *     "deal_name":  "...",
 *     "agent_name": "...",
 *     "created_at": "ISO-8601"   // optional — defaults to webhook receive time
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

interface ZohoDealsPayload {
  deal_id?: string | number;
  agent_name?: string;
  deal_name?: string;
  created_at?: string;
}

function parsePayload(body: unknown): {
  dealId: string;
  agentName: string;
  dealName: string;
  createdAt: string | null;
} | null {
  if (body == null || typeof body !== "object") return null;
  const o = body as ZohoDealsPayload;
  const rawDealId = o.deal_id;
  const dealId =
    rawDealId != null && String(rawDealId).trim() !== ""
      ? String(rawDealId).trim()
      : "";
  const agentName =
    typeof o.agent_name === "string" ? normalizeZohoAgentName(o.agent_name) : "";
  const dealName = typeof o.deal_name === "string" ? o.deal_name.trim() : "";
  if (!dealId || !agentName || !dealName) return null;
  const createdAt = typeof o.created_at === "string" ? zohoTimestampToDb(o.created_at) : null;
  return { dealId, agentName, dealName, createdAt };
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

  const bodyResult = await readZohoWebhookBody(req, "zoho-deals webhook");
  if (!bodyResult.ok) return bodyResult.response;
  const { body, requestId } = bodyResult;

  const parsed = parsePayload(body);
  if (!parsed) {
    const b = body as Record<string, unknown> | null;
    console.error("[zoho-deals webhook] payload mapping failed", {
      requestId,
      topLevelKeys:
        b && typeof b === "object" ? Object.keys(b).slice(0, 100) : null,
      deal_id: b && typeof b === "object" ? b["deal_id"] : null,
      agent_name: b && typeof b === "object" ? b["agent_name"] : null,
      deal_name: b && typeof b === "object" ? b["deal_name"] : null,
    });
    return NextResponse.json(
      {
        error:
          "Missing or invalid fields: deal_id, agent_name, and deal_name are required",
      },
      { status: 400 },
    );
  }

  const { dealId, agentName, dealName, createdAt } = parsed;
  const createdAtFinal = createdAt ?? zohoNowUtcForDb();

  console.log("[zoho-deals webhook] insert deal", {
    requestId,
    dealId,
    agentName,
    dealName,
  });

  try {
    const { error: insErr } = await db.from("deals").insert({
      deal_id: dealId,
      deal_name: dealName,
      agent_name: agentName,
      created_at: createdAtFinal,
    });

    if (insErr) {
      if (insErr.code === "23505") {
        console.log("[zoho-deals webhook] ignored (deal already logged)", {
          requestId,
          dealId,
        });
        return NextResponse.json({
          ok: true,
          action: "ignored",
          reason: "duplicate_deal",
        });
      }
      console.error("[zoho-deals webhook] insert", insErr);
      return NextResponse.json(
        { error: "Database error", detail: insErr.message },
        { status: 500 },
      );
    }

    console.log("[zoho-deals webhook] recorded", { requestId, dealId });
    return NextResponse.json({ ok: true, action: "recorded" });
  } catch (e) {
    console.error("[zoho-deals webhook]", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
