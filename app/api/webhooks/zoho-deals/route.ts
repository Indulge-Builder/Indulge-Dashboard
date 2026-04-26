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
import {
  freshdeskTimestampToIsoUtcForDb,
  normalizeZohoCrmTimestampForIstDigits,
} from "@/lib/istDate";
import { normalizeZohoAgentName } from "@/lib/onboardingAgents";
import { requireSupabaseAdminOr503 } from "@/lib/supabaseAdmin";
import { assertWebhookSecret } from "@/lib/webhookAuth";

interface ZohoDealsPayload {
  deal_id?: string | number;
  agent_name?: string;
  deal_name?: string;
  created_at?: string;
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
  params.forEach((v, k) => {
    out[k] = v;
  });
  return out;
}

function toDbTimestamp(isoOrEmpty: string | null): string | null {
  if (!isoOrEmpty || !isoOrEmpty.trim()) return null;
  const zohoNormalized = normalizeZohoCrmTimestampForIstDigits(isoOrEmpty.trim());
  const normalized =
    freshdeskTimestampToIsoUtcForDb(zohoNormalized) ?? zohoNormalized;
  const t = Date.parse(normalized);
  return Number.isFinite(t) ? normalized : null;
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
  const createdAt = typeof o.created_at === "string" ? toDbTimestamp(o.created_at) : null;
  return { dealId, agentName, dealName, createdAt };
}

function recordedAtUtcForDb(): string {
  return (
    freshdeskTimestampToIsoUtcForDb(new Date().toISOString()) ?? new Date().toISOString()
  );
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

  const requestId =
    req.headers.get("x-request-id") ??
    req.headers.get("cf-ray") ??
    `local-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  const contentType = req.headers.get("content-type") ?? "";

  console.info("[zoho-deals webhook] accepted", {
    requestId,
    contentType,
  });

  let rawText = "";
  try {
    rawText = await req.text();
  } catch (e) {
    console.error("[zoho-deals webhook] failed reading body", { requestId, error: e });
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  let body: unknown;
  if (contentType.toLowerCase().includes("application/json")) {
    const parsedJson = safeJsonParse(rawText);
    if (!parsedJson.ok) {
      console.error("[zoho-deals webhook] invalid JSON", {
        requestId,
        parseError: parsedJson.error,
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
    const parsedJson = safeJsonParse(rawText);
    body = parsedJson.ok ? parsedJson.value : parseFormUrlEncoded(rawText);
  }

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
  const createdAtFinal = createdAt ?? recordedAtUtcForDb();

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
