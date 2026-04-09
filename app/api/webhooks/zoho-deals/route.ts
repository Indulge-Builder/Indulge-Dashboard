/**
 * POST /api/webhooks/zoho-deals
 *
 * Zoho CRM → Deal won / closure. Appends one row to `onboarding_conversion_ledger`
 * per unique `deal_id` so repeat webhooks do not inflate closure scores.
 *
 * JSON body:
 *   { "deal_id": "...", "agent_name": "...", "deal_name": "...", "amount": ... }
 *
 * `deal_name` maps to `client_name`. `amount` is INR (number or numeric string).
 * `recorded_at` is the webhook instant, normalized via istDate (same rules as Freshdesk).
 */

import { NextRequest, NextResponse } from "next/server";
import { freshdeskTimestampToIsoUtcForDb } from "@/lib/istDate";
import { normalizeZohoAgentName } from "@/lib/onboardingAgents";
import { requireSupabaseAdminOr503 } from "@/lib/supabaseAdmin";

interface ZohoDealsPayload {
  deal_id?: string | number;
  agent_name?: string;
  deal_name?: string;
  amount?: string | number;
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

function parseAmount(raw: string | number | undefined): number | null {
  if (raw == null) return null;
  if (typeof raw === "number") {
    return Number.isFinite(raw) ? raw : null;
  }
  const s = String(raw).trim().replace(/,/g, "");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function parsePayload(body: unknown): {
  dealId: string;
  agentName: string;
  dealName: string;
  amount: number;
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
  const amount = parseAmount(o.amount);
  if (!dealId || !agentName || !dealName || amount == null) return null;
  return { dealId, agentName, dealName, amount };
}

function recordedAtUtcForDb(): string {
  return (
    freshdeskTimestampToIsoUtcForDb(new Date().toISOString()) ?? new Date().toISOString()
  );
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
    console.error("[zoho-deals webhook] failed reading body", { requestId, error: e });
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  console.log("[zoho-deals webhook] incoming", {
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
      console.error("[zoho-deals webhook] invalid JSON", {
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
      amount: b && typeof b === "object" ? b["amount"] : null,
    });
    return NextResponse.json(
      {
        error:
          "Missing or invalid fields: deal_id, agent_name, deal_name, and amount are required",
      },
      { status: 400 },
    );
  }

  const { dealId, agentName, dealName, amount } = parsed;
  const recordedAt = recordedAtUtcForDb();

  console.log("[zoho-deals webhook] insert conversion", {
    requestId,
    dealId,
    agentName,
    dealName,
    amount,
  });

  try {
    const { error: insErr } = await db.from("onboarding_conversion_ledger").insert({
      deal_id: dealId,
      client_name: dealName,
      amount,
      agent_name: agentName,
      queendom_name: "",
      recorded_at: recordedAt,
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
