import type { SupabaseClient } from "@supabase/supabase-js";

export type QueryResult = { data: unknown; error: unknown };
export type Call = { method: string; args: unknown[] };

/**
 * Minimal stand-in for the supabase-js query builder. Each `from()` starts a
 * new recorded chain; awaiting a chain resolves to the next queued result.
 */
export function createFakeSupabase(results: QueryResult[]) {
  const queue = [...results];
  const queries: Call[][] = [];

  const client = {
    from(table: string) {
      const chain: Call[] = [{ method: "from", args: [table] }];
      queries.push(chain);
      const builder: object = new Proxy(
        {},
        {
          get(_target, prop) {
            if (prop === "then") {
              const result = queue.shift();
              if (!result) throw new Error("Fake Supabase: no queued result left");
              return (resolve: (value: QueryResult) => unknown) => resolve(result);
            }
            return (...args: unknown[]) => {
              chain.push({ method: String(prop), args });
              return builder;
            };
          },
        },
      );
      return builder;
    },
  };

  return { client: client as unknown as SupabaseClient, queries, remaining: () => queue.length };
}

export function methodCalls(chain: Call[], method: string): unknown[][] {
  return chain.filter((call) => call.method === method).map((call) => call.args);
}
