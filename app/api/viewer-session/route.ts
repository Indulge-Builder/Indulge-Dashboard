/**
 * POST /api/viewer-session
 *
 * Exchanges the dashboard passcode for the 30-day viewer cookie
 * (lib/viewerGate.ts). Body: { pin: string }. 204 on success (cookie
 * attached), 401 on a wrong passcode, 404 while the gate is disabled.
 *
 * Small fixed delay on failure blunts brute-forcing a short PIN without
 * needing per-IP state.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  VIEWER_COOKIE,
  VIEWER_COOKIE_OPTIONS,
  isCorrectPin,
  isViewerGateEnabled,
  mintViewerToken,
} from "@/lib/viewerGate";

export async function POST(req: NextRequest) {
  if (!isViewerGateEnabled()) {
    return NextResponse.json({ error: "Gate disabled" }, { status: 404 });
  }

  let pin = "";
  try {
    const body = (await req.json()) as { pin?: unknown };
    pin = typeof body.pin === "string" ? body.pin.trim() : "";
  } catch {
    /* fall through to the failure path */
  }

  if (!pin || !isCorrectPin(pin)) {
    await new Promise((r) => setTimeout(r, 600));
    return NextResponse.json({ error: "Wrong passcode" }, { status: 401 });
  }

  const res = new NextResponse(null, { status: 204 });
  res.cookies.set(VIEWER_COOKIE, mintViewerToken(), VIEWER_COOKIE_OPTIONS);
  return res;
}
