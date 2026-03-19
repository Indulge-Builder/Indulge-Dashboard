import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/**
 * Singleton Supabase browser client.
 * Must be instantiated exactly once outside the React render tree — never inside
 * a component or hook that runs on every render, to avoid connection leaks and
 * excessive DB usage. This module is evaluated once; the same instance is reused.
 */
let _client: SupabaseClient | null = null;

function getClient(): SupabaseClient | null {
  if (!supabaseUrl || !supabaseKey) return null;
  if (_client) return _client;
  _client = createClient(supabaseUrl, supabaseKey);
  return _client;
}

export const supabase = getClient();
