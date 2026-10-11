import { connection } from "next/server";
import { getGeminiEnv, getSupabaseEnv, isConfigured } from "@/lib/env";

export async function GET() {
  // Read env at request time instead of baking build-time values into a prerender.
  await connection();

  return Response.json({
    ok: true,
    configured: {
      supabase: isConfigured(getSupabaseEnv),
      gemini: isConfigured(getGeminiEnv),
    },
  });
}
