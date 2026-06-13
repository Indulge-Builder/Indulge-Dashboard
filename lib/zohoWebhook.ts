/**
 * lib/zohoWebhook.ts — shared plumbing for the two Zoho CRM webhook routes
 * (dry-audit E2). zoho-leads and zoho-deals previously duplicated ~120 lines
 * of body parsing, timestamp normalization, and request-id derivation verbatim.
 *
 * The freshdesk webhook stays bespoke: its raw-body `is_escalated` regex fixup
 * must run before JSON.parse, so it cannot share this triage.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  freshdeskTimestampToIsoUtcForDb,
  normalizeZohoCrmTimestampForIstDigits,
} from "./istDate";

function safeJsonParse(
  text: string,
): { ok: true; value: unknown } | { ok: false; error: string } {
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

/**
 * Convert a Zoho CRM timestamp to a strict UTC ISO string for `timestamptz`.
 * Zoho sends India wall clock but merge fields often append Z / +00 — strip so
 * we store the true UTC instant (see normalizeZohoCrmTimestampForIstDigits).
 * Returns null for empty / unparseable input.
 */
export function zohoTimestampToDb(isoOrEmpty: string | null): string | null {
  if (!isoOrEmpty || !isoOrEmpty.trim()) return null;
  const zohoNormalized = normalizeZohoCrmTimestampForIstDigits(isoOrEmpty.trim());
  const normalized =
    freshdeskTimestampToIsoUtcForDb(zohoNormalized) ?? zohoNormalized;
  const t = Date.parse(normalized);
  return Number.isFinite(t) ? normalized : null;
}

/** Current instant as strict UTC ISO for `timestamptz` (server receive time). */
export function zohoNowUtcForDb(): string {
  return (
    freshdeskTimestampToIsoUtcForDb(new Date().toISOString()) ?? new Date().toISOString()
  );
}

export type ZohoBodyResult =
  | { ok: true; body: unknown; requestId: string }
  | { ok: false; response: NextResponse; requestId: string };

/**
 * Read + triage a Zoho webhook body. Zoho sends JSON or form-urlencoded
 * depending on the automation config; unknown content types try JSON first,
 * then fall back to form parsing. Error responses match the original routes
 * byte-for-byte: 400 `{ error: "Invalid request body" }` on read failure,
 * 400 `{ error: "Invalid JSON body", detail }` on declared-JSON parse failure.
 */
export async function readZohoWebhookBody(
  req: NextRequest,
  label: string,
): Promise<ZohoBodyResult> {
  const requestId =
    req.headers.get("x-request-id") ??
    req.headers.get("cf-ray") ??
    `local-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  const contentType = req.headers.get("content-type") ?? "";

  let rawText = "";
  try {
    rawText = await req.text();
  } catch (e) {
    console.error(`[${label}] failed reading body`, { requestId, error: e });
    return {
      ok: false,
      requestId,
      response: NextResponse.json({ error: "Invalid request body" }, { status: 400 }),
    };
  }

  console.info(`[${label}] accepted`, {
    requestId,
    contentType,
    bodyLength: rawText.length,
  });

  let body: unknown;
  if (contentType.toLowerCase().includes("application/json")) {
    const parsedJson = safeJsonParse(rawText);
    if (!parsedJson.ok) {
      console.error(`[${label}] invalid JSON`, {
        requestId,
        parseError: parsedJson.error,
        bodyPreview: rawText.slice(0, 2000),
      });
      return {
        ok: false,
        requestId,
        response: NextResponse.json(
          { error: "Invalid JSON body", detail: parsedJson.error },
          { status: 400 },
        ),
      };
    }
    body = parsedJson.value;
  } else if (contentType.toLowerCase().includes("application/x-www-form-urlencoded")) {
    body = parseFormUrlEncoded(rawText);
  } else {
    const parsedJson = safeJsonParse(rawText);
    body = parsedJson.ok ? parsedJson.value : parseFormUrlEncoded(rawText);
  }

  return { ok: true, body, requestId };
}
