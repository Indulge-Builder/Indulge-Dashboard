import { createClient } from "@supabase/supabase-js"

const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL  ?? ""
const supabaseKey  = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""

/**
 * Returns a Supabase client only when both env vars are present.
 * The dashboard falls back to dummy data when this is null.
 */
export const supabase =
  supabaseUrl && supabaseKey
    ? createClient(supabaseUrl, supabaseKey)
    : null
