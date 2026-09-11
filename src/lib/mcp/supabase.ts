import { createClient } from "@supabase/supabase-js";
import type { ToolContext } from "@lovable.dev/mcp-js";

type RuntimeGlobals = typeof globalThis & {
  Deno?: { env?: { get?: (name: string) => string | undefined } };
  process?: { env?: Record<string, string | undefined> };
};

function runtimeEnv(name: string): string | undefined {
  const runtime = globalThis as RuntimeGlobals;
  return runtime.Deno?.env?.get?.(name) ?? runtime.process?.env?.[name];
}

function configuredEnv(names: readonly string[]): string | undefined {
  for (const name of names) {
    const value = runtimeEnv(name)?.trim();
    if (value) return value;
  }
  return undefined;
}

export function supabaseProjectUrl(): string {
  const url = configuredEnv(["SUPABASE_URL", "VITE_SUPABASE_URL"]);
  if (!url) throw new Error("SUPABASE_URL (or VITE_SUPABASE_URL) is required");
  return url;
}

function supabasePublishableKey(): string {
  const direct = configuredEnv([
    "SUPABASE_PUBLISHABLE_KEY",
    "VITE_SUPABASE_PUBLISHABLE_KEY",
  ]);
  if (direct) return direct;
  const keyset = runtimeEnv("SUPABASE_PUBLISHABLE_KEYS");
  if (keyset) {
    try {
      const parsed: unknown = JSON.parse(keyset);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        const keys = parsed as Record<string, unknown>;
        const key = [keys.default, ...Object.values(keys)]
          .find((v): v is string => typeof v === "string" && v.trim().startsWith("sb_publishable_"))
          ?.trim();
        if (key) return key;
      }
    } catch {
      // Malformed dictionary; fall through to legacy names.
    }
  }
  const legacy = configuredEnv(["SUPABASE_ANON_KEY", "VITE_SUPABASE_ANON_KEY"]);
  if (legacy) return legacy;
  throw new Error("SUPABASE_PUBLISHABLE_KEY, SUPABASE_PUBLISHABLE_KEYS, or SUPABASE_ANON_KEY is required");
}

/** No caller identity — RLS runs as `anon`. Only for intentionally public reads. */
export function supabaseAnon() {
  return createClient(supabaseProjectUrl(), supabasePublishableKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Forwards the verified bearer token so RLS runs as the signed-in user. */
export function supabaseForUser(ctx: ToolContext) {
  const token = ctx.getToken();
  if (!token) throw new Error("supabaseForUser requires a verified OAuth token");
  return createClient(supabaseProjectUrl(), supabasePublishableKey(), {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Privileged server-only client. Used after MCP authentication for credit
 * metering and for bounded article reads whose selected fields are already
 * exposed by the public SECURITY DEFINER article RPCs.
 */
export function supabaseService() {
  const key = configuredEnv(["SUPABASE_SERVICE_ROLE_KEY"]);
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is required");
  return createClient(supabaseProjectUrl(), key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
