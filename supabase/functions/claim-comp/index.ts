import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

async function hashKey(key: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function generateApiKey(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = new Uint8Array(40);
  crypto.getRandomValues(bytes);
  let key = "sk_live_";
  for (const b of bytes) key += chars[b % chars.length];
  return key;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const svc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!jwt) return json({ error: "login_required" }, 401);
  const { data: auth, error: authErr } = await svc.auth.getUser(jwt);
  if (authErr || !auth?.user) return json({ error: "login_required" }, 401);
  const user = auth.user;

  const body = await req.json().catch(() => ({}));
  const token = typeof body.token === "string" ? body.token.trim() : "";
  if (!token || token.length > 100) return json({ error: "invalid_token" }, 400);

  const { data: grant } = await svc.from("comp_grants").select("*").eq("token", token).maybeSingle();
  if (!grant) return json({ error: "invalid_token" }, 404);
  if (grant.claimed_at) return json({ error: "already_claimed" }, 409);
  if ((user.email || "").toLowerCase() !== String(grant.email).toLowerCase()) {
    return json({ error: "wrong_account", hint: grant.email.replace(/^(.{2}).*@/, "$1***@") }, 403);
  }

  // Claim atomically: only succeeds if still unclaimed.
  const { data: claimed } = await svc
    .from("comp_grants")
    .update({ claimed_at: new Date().toISOString(), claimed_by: user.id })
    .eq("token", token)
    .is("claimed_at", null)
    .select()
    .maybeSingle();
  if (!claimed) return json({ error: "already_claimed" }, 409);

  const now = new Date();
  const expires = new Date(now.getTime() + grant.days * 86400000);
  await svc.from("manual_subscriptions").insert({
    user_id: user.id,
    tier: "pro_lifetime",
    daily_limit: 2000,
    starts_at: now.toISOString(),
    expires_at: expires.toISOString(),
    amount_cny: 0,
    payment_method: "compensation",
    note: grant.note || "补偿：免费会员",
    status: "active",
  });

  const { data: keys } = await svc.from("api_keys").select("id").eq("user_id", user.id).eq("is_active", true);
  if (keys && keys.length > 0) {
    await svc.from("api_keys").update({ tier: "pro_lifetime", daily_limit: 2000 }).eq("user_id", user.id).eq("is_active", true);
  } else {
    const raw = generateApiKey();
    await svc.from("api_keys").insert({
      user_id: user.id,
      key_hash: await hashKey(raw),
      key_prefix: raw.substring(0, 12) + "..." + raw.substring(raw.length - 4),
      name: "Default",
      tier: "pro_lifetime",
      daily_limit: 2000,
      paid_since: now.toISOString(),
    });
  }

  return json({ success: true, expires_at: expires.toISOString(), days: grant.days });
});
