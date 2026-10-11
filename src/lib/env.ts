import "server-only";
import { z } from "zod";

export class ConfigError extends Error {
  constructor(public readonly missing: string[]) {
    super(`Missing or invalid configuration: ${missing.join(", ")}`);
    this.name = "ConfigError";
  }
}

const supabaseEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SUPABASE_STORAGE_BUCKET: z.string().min(1).default("report-images"),
});

const geminiEnvSchema = z.object({
  GEMINI_API_KEY: z.string().min(1),
  GEMINI_MODEL: z.string().min(1),
});

export type SupabaseEnv = z.infer<typeof supabaseEnvSchema>;
export type GeminiEnv = z.infer<typeof geminiEnvSchema>;

function parseEnv<T extends z.ZodType>(schema: T): z.infer<T> {
  const result = schema.safeParse(process.env);
  if (!result.success) {
    const missing = [
      ...new Set(result.error.issues.map((issue) => String(issue.path[0]))),
    ];
    throw new ConfigError(missing);
  }
  return result.data;
}

/** Throws ConfigError (never the values) when Supabase is not configured. */
export function getSupabaseEnv(): SupabaseEnv {
  return parseEnv(supabaseEnvSchema);
}

/** Throws ConfigError (never the values) when Gemini is not configured. */
export function getGeminiEnv(): GeminiEnv {
  return parseEnv(geminiEnvSchema);
}

export function isConfigured(read: () => unknown): boolean {
  try {
    read();
    return true;
  } catch {
    return false;
  }
}
