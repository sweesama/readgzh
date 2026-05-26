import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function generateApiKey(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let key = "sk_live_";
  for (let i = 0; i < 40; i++) {
    key += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return key;
}

async function hashKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use service role client to validate token (avoids stale session issues)
    const svc = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await svc.auth.getUser(token);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse body ONCE upfront to avoid consuming the stream multiple times
    const body = await req.json().catch(() => ({}));
    const url = new URL(req.url);
    const action = url.searchParams.get("action") || body.action;

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    if (action === "create") {
      // Check existing key count (max 3 for free tier)
      const { count } = await serviceClient
        .from("api_keys")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("is_active", true);

      if ((count || 0) >= 3) {
        return new Response(
          JSON.stringify({ error: "Maximum 3 active keys allowed" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const keyName = body.name || "Default";
      const rawKey = generateApiKey();
      const keyHash = await hashKey(rawKey);
      const keyPrefix = rawKey.substring(0, 12) + "..." + rawKey.substring(rawKey.length - 4);

      // Check if user has any paid keys (active or revoked - to preserve tier on new keys)
      const { data: paidKeys } = await serviceClient
        .from("api_keys")
        .select("id, tier, daily_limit")
        .eq("user_id", user.id)
        .in("tier", ["lite", "pro", "pro_lifetime"])
        .limit(1);
      const hasPaid = (paidKeys && paidKeys.length > 0);
      const existingTier = paidKeys?.[0]?.tier || "free";
      const isLifetime = paidKeys?.some(k => k.tier === "pro_lifetime");
      const newTier = isLifetime ? "pro_lifetime" : (hasPaid ? existingTier : "free");
      
      // Set daily_limit based on tier (monthly budget for paid tiers)
      const tierLimits: Record<string, number> = { free: 30, lite: 300, pro: 2000, pro_lifetime: 2000 };
      const newLimit = tierLimits[newTier] || 30;

      const { data, error } = await serviceClient.from("api_keys").insert({
        user_id: user.id,
        key_hash: keyHash,
        key_prefix: keyPrefix,
        name: keyName,
        tier: newTier,
        daily_limit: newLimit,
      }).select().single();

      if (error) throw error;

      return new Response(
        JSON.stringify({
          success: true,
          key: rawKey, // Only shown once!
          key_id: data.id,
          key_prefix: keyPrefix,
          message: "请妥善保存此 Key，它只会显示一次！",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "list") {
      const { data, error } = await serviceClient
        .from("api_keys")
        .select("id, key_prefix, key_value, name, tier, daily_limit, is_active, last_used_at, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, keys: data }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "revoke") {
      const keyId = body.key_id;
      if (!keyId) {
        return new Response(
          JSON.stringify({ error: "key_id required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { error } = await serviceClient
        .from("api_keys")
        .update({ is_active: false })
        .eq("id", keyId)
        .eq("user_id", user.id);

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "usage") {
      const { data, error } = await serviceClient
        .from("api_usage")
        .select("usage_date, request_count, cached_count, api_key_id")
        .in(
          "api_key_id",
          (await serviceClient.from("api_keys").select("id").eq("user_id", user.id)).data?.map(k => k.id) || []
        )
        .gte("usage_date", new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0])
        .order("usage_date", { ascending: false });

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, usage: data }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "claim_credits") {
      // Check if already claimed today
      const today = new Date().toISOString().split("T")[0];
      const { data: existing } = await serviceClient
        .from("daily_credits")
        .select("id")
        .eq("user_id", user.id)
        .eq("claim_date", today)
        .maybeSingle();

      if (existing) {
        return new Response(
          JSON.stringify({ success: false, error: "今天已经领取过了", already_claimed: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check if user is paid (has any paid-tier active key)
      const { data: paidKeys } = await serviceClient
        .from("api_keys")
        .select("id, tier")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .in("tier", ["lite", "pro", "pro_lifetime"])
        .limit(1);

      const isPaid = (paidKeys && paidKeys.length > 0);
      const creditAmount = isPaid ? 0 : 30; // Paid users don't need to claim - monthly auto-grant

      // Paid users don't need to manually claim
      if (isPaid) {
        return new Response(
          JSON.stringify({ success: true, credits: 0, message: "订阅用户积分月初自动发放，无需手动领取", already_claimed: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { error } = await serviceClient.from("daily_credits").insert({
        user_id: user.id,
        claim_date: today,
        credits_claimed: creditAmount,
      });

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, credits: creditAmount, message: "成功领取 30 积分！" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "balance") {
      const { data, error } = await serviceClient.rpc("get_user_balance", { p_user_id: user.id });
      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, balance: data }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Unknown action. Use: create, list, revoke, usage, claim_credits, balance" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
