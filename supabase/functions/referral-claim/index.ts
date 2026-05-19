// Referral claim — 注册后绑定邀请关系
// 客户端在用户首次登录/注册成功后调用一次
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ ok: false, reason: "unauthorized" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return json({ ok: false, reason: "unauthorized" }, 401);
    }
    const user = userData.user;

    const body = await req.json().catch(() => ({}));
    const code = String(body?.code ?? "").trim().toUpperCase();
    if (!/^[A-Z2-9]{8}$/.test(code)) {
      return json({ ok: false, reason: "invalid_code" }, 400);
    }

    // 注册时间太久（>7 天）的不予绑定，防止老用户后期补绑
    const createdAt = new Date(user.created_at).getTime();
    if (Date.now() - createdAt > 7 * 24 * 60 * 60 * 1000) {
      return json({ ok: false, reason: "account_too_old" }, 400);
    }

    const signupIp =
      req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      null;
    const signupUa = req.headers.get("user-agent") || null;

    const adminClient = createClient(supabaseUrl, serviceKey);
    const { data, error } = await adminClient.rpc("create_referral", {
      p_code: code,
      p_invitee_id: user.id,
      p_signup_ip: signupIp,
      p_signup_ua: signupUa,
      p_invitee_email: user.email ?? null,
    });

    if (error) {
      console.error("create_referral error", error);
      return json({ ok: false, reason: "server_error" }, 500);
    }

    return json(data ?? { ok: false, reason: "unknown" });
  } catch (e) {
    console.error("referral-claim crash", e);
    return json({ ok: false, reason: "server_error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
