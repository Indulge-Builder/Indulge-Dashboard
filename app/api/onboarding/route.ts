/**
 * GET /api/onboarding
 *
 * Returns up to three sales agent rows + recent conversion ledger for OnboardingPanel.
 *
 * Optional Supabase tables (create if you want live data):
 *
 *   CREATE TABLE public.onboarding_sales_agents (
 *     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 *     display_name text NOT NULL,
 *     photo_url text,
 *     total_attempted int NOT NULL DEFAULT 0,
 *     total_converted int NOT NULL DEFAULT 0,
 *     sort_order int NOT NULL DEFAULT 0
 *   );
 *
 *   CREATE TABLE public.onboarding_ledger (
 *     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 *     client_name text NOT NULL,
 *     amount numeric NOT NULL,
 *     recorded_at timestamptz NOT NULL DEFAULT now(),
 *     agent_name text NOT NULL
 *   );
 *
 *   ALTER PUBLICATION supabase_realtime ADD TABLE public.onboarding_ledger;
 */

import { NextResponse } from "next/server";
import { requireSupabaseAdminOr503 } from "@/lib/supabaseAdmin";
import type {
  OnboardingAgentRow,
  OnboardingApiPayload,
  OnboardingLedgerRow,
} from "@/lib/onboardingTypes";

function demoPayload(): OnboardingApiPayload {
  return {
    agents: [
      {
        id: "amit",
        name: "Amit",
        photoUrl: null,
        totalAttempted: 121,
        totalConverted: 48,
      },
      {
        id: "samson",
        name: "Samson",
        photoUrl: null,
        totalAttempted: 148,
        totalConverted: 62,
      },
      {
        id: "meghana",
        name: "Meghana",
        photoUrl: null,
        totalAttempted: 132,
        totalConverted: 55,
      },
    ],
    /** March 2026 conversions (demo when DB empty) — amounts in INR; UI shows ₹ Lakh */
    ledger: [
      {
        id: "demo-l-20260321",
        clientName: "Nachiket Pawar",
        amount: 250_000,
        recordedAt: new Date("2026-03-21T12:00:00+05:30").toISOString(),
        agentName: "Amit",
      },
      {
        id: "demo-l-20260319",
        clientName: "Kamyaa Misra",
        amount: 400_000,
        recordedAt: new Date("2026-03-19T12:00:00+05:30").toISOString(),
        agentName: "Samson/Neha",
      },
      {
        id: "demo-l-20260318",
        clientName: "Vybhav Srinivasan",
        amount: 200_000,
        recordedAt: new Date("2026-03-18T12:00:00+05:30").toISOString(),
        agentName: "Samson",
      },
      {
        id: "demo-l-20260317",
        clientName: "Jainita Shah",
        amount: 400_000,
        recordedAt: new Date("2026-03-17T12:00:00+05:30").toISOString(),
        agentName: "Amit",
      },
      {
        id: "demo-l-20260316",
        clientName: "Rahul Goel",
        amount: 300_000,
        recordedAt: new Date("2026-03-16T12:00:00+05:30").toISOString(),
        agentName: "Amit",
      },
      {
        id: "demo-l-20260309",
        clientName: "Priyanka Agarwal",
        amount: 300_000,
        recordedAt: new Date("2026-03-09T12:00:00+05:30").toISOString(),
        agentName: "Samson/Neha",
      },
      {
        id: "demo-l-20260306a",
        clientName: "Vishal Karamchandani",
        amount: 400_000,
        recordedAt: new Date("2026-03-06T14:00:00+05:30").toISOString(),
        agentName: "Kaniisha",
      },
      {
        id: "demo-l-20260306b",
        clientName: "Aniruddha Khopde",
        amount: 100_000,
        recordedAt: new Date("2026-03-06T10:00:00+05:30").toISOString(),
        agentName: "Kaniisha",
      },
    ],
  };
}

export async function GET() {
  const { db } = requireSupabaseAdminOr503();
  const fallback = demoPayload();

  if (!db) {
    return NextResponse.json(fallback, {
      headers: { "Cache-Control": "no-store" },
    });
  }

  try {
    const agentsQ = await db
      .from("onboarding_sales_agents")
      .select(
        "id, display_name, photo_url, total_attempted, total_converted, sort_order",
      )
      .order("sort_order", { ascending: true })
      .limit(3);

    const ledgerQ = await db
      .from("onboarding_ledger")
      .select("id, client_name, amount, recorded_at, agent_name")
      .order("recorded_at", { ascending: false })
      .limit(24);

    if (agentsQ.error) {
      return NextResponse.json(fallback, {
        headers: { "Cache-Control": "no-store" },
      });
    }

    const rawAgents = agentsQ.data ?? [];
    if (rawAgents.length === 0) {
      return NextResponse.json(fallback, {
        headers: { "Cache-Control": "no-store" },
      });
    }

    const agents: OnboardingAgentRow[] = rawAgents
      .map(
        (r: {
          id: string;
          display_name: string;
          photo_url: string | null;
          total_attempted: number;
          total_converted: number;
        }) => ({
          id: String(r.id),
          name: r.display_name,
          photoUrl: r.photo_url,
          totalAttempted: Number(r.total_attempted) || 0,
          totalConverted: Number(r.total_converted) || 0,
        }),
      )
      .slice(0, 3);

    const ledger: OnboardingLedgerRow[] = ledgerQ.error
      ? []
      : (ledgerQ.data ?? []).map(
          (r: {
            id: string;
            client_name: string;
            amount: number | string;
            recorded_at: string;
            agent_name: string;
          }) => ({
            id: String(r.id),
            clientName: r.client_name,
            amount:
              typeof r.amount === "string" ? parseFloat(r.amount) : r.amount,
            recordedAt: r.recorded_at,
            agentName: r.agent_name,
          }),
        );

    const payload: OnboardingApiPayload = { agents, ledger };
    return NextResponse.json(payload, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    console.error("[/api/onboarding]", e);
    return NextResponse.json(fallback, {
      headers: { "Cache-Control": "no-store" },
    });
  }
}
