import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "@/lib/env";

let client: SupabaseClient | undefined;

/**
 * Service-role client. Bypasses RLS, so it must only be used from route
 * handlers / server code and never returned to the browser.
 */
export function getSupabaseAdmin(): SupabaseClient {
  if (!client) {
    const env = getSupabaseEnv();
    client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}
