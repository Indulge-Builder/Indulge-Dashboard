import { createClient } from "@supabase/supabase-js"
import { NextResponse }  from "next/server"

// ─── Types ────────────────────────────────────────────────────────────────────
interface ClientRow {
  group:                              string | null
  latest_subscription_plan_interval:  string | null
}

interface QueenBucket {
  total:   number
  yearly:  number
  monthly: number
}

interface AggregatedStats {
  ananyshree: QueenBucket
  anishqa:    QueenBucket
}

// ─── Aggregation (same logic as client-side, now runs on the server) ──────────
function aggregate(rows: ClientRow[]): AggregatedStats {
  const result: AggregatedStats = {
    ananyshree: { total: 0, yearly: 0, monthly: 0 },
    anishqa:    { total: 0, yearly: 0, monthly: 0 },
  }

  for (const row of rows) {
    const grp  = (row.group ?? "").toLowerCase().trim()
    // Values in DB are exactly "year" or "month"
    const interval = (row.latest_subscription_plan_interval ?? "").toLowerCase().trim()

    let bucket: QueenBucket | null = null
    if      (grp.includes("ananyshree")) bucket = result.ananyshree
    else if (grp.includes("anishqa"))    bucket = result.anishqa

    if (!bucket) continue

    bucket.total++
    if      (interval === "year")  bucket.yearly++
    else if (interval === "month") bucket.monthly++
  }

  return result
}

// ─── GET /api/clients ─────────────────────────────────────────────────────────
// Uses the service role key — runs on the server only, bypasses RLS entirely.
// The key is never sent to the browser.
export async function GET() {
  const url        = process.env.NEXT_PUBLIC_SUPABASE_URL      ?? ""
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY     ?? ""

  if (!url || !serviceKey || serviceKey === "paste_your_service_role_key_here") {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY is not configured in .env.local" },
      { status: 503 }
    )
  }

  // Server-side admin client — auth.persistSession must be false for API routes
  const db = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data, error } = await db
    .from("clients")
    .select("group, latest_subscription_plan_interval")

  if (error) {
    console.error("[/api/clients] Supabase error:", error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const stats = aggregate(data as ClientRow[])

  // Log so you can verify in terminal on first load
  const total = stats.ananyshree.total + stats.anishqa.total
  console.info(`[/api/clients] fetched ${total} clients total →`, stats)

  return NextResponse.json(stats, {
    headers: {
      // Never cache — always fresh for a live dashboard
      "Cache-Control": "no-store",
    },
  })
}
