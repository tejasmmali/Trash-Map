import "server-only";
import { GoogleGenAI } from "@google/genai";
import { getGeminiEnv } from "@/lib/env";

let client: GoogleGenAI | undefined;
let clientKey: string | undefined;

/** Throws ConfigError when GEMINI_API_KEY or GEMINI_MODEL is missing. */
export function getGemini(): { ai: GoogleGenAI; model: string } {
  const env = getGeminiEnv();
  if (!client || clientKey !== env.GEMINI_API_KEY) {
    client = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
    clientKey = env.GEMINI_API_KEY;
  }
  return { ai: client, model: env.GEMINI_MODEL };
}
