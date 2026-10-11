import { afterEach, describe, expect, it, vi } from "vitest";
import { ConfigError, getSupabaseEnv } from "@/lib/env";

function fakeJwt(payload: object) {
  const part = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${part({ alg: "HS256", typ: "JWT" })}.${part(payload)}.signature`;
}

function withKey(key: string) {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", key);
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getSupabaseEnv", () => {
  it.each([
    ["a secret key", "sb_secret_fake123"],
    ["a legacy service_role JWT", fakeJwt({ role: "service_role", ref: "example" })],
  ])("accepts %s", (_label, key) => {
    withKey(key);
    expect(getSupabaseEnv().SUPABASE_SERVICE_ROLE_KEY).toBe(key);
  });

  it.each([
    ["a publishable key", "sb_publishable_fake123"],
    ["a legacy anon JWT", fakeJwt({ role: "anon", ref: "example" })],
    ["an empty value", ""],
  ])("rejects %s as SUPABASE_SERVICE_ROLE_KEY without exposing it", (_label, key) => {
    withKey(key);
    let error: unknown;
    try {
      getSupabaseEnv();
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(ConfigError);
    expect((error as ConfigError).missing).toEqual(["SUPABASE_SERVICE_ROLE_KEY"]);
    if (key) expect((error as ConfigError).message).not.toContain(key);
  });

  it("defaults the storage bucket", () => {
    withKey("sb_secret_fake123");
    expect(getSupabaseEnv().SUPABASE_STORAGE_BUCKET).toBe("report-images");
  });
});
