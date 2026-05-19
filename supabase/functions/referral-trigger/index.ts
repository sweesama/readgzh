// Referral trigger — 被邀请人完成首次阅读后激活奖励
// 客户端在 ReadPage 文章加载成功后调用一次（幂等）
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
      return json({ triggered: false, reason: "unauthorized" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return json({ triggered: false, reason: "unauthorized" }, 401);
    }

    const adminClient = createClient(supabaseUrl, serviceKey);
    const { data, error } = await adminClient.rpc("issue_referral_reward", {
      p_invitee_id: userData.user.id,
    });
    if (error) {
      console.error("issue_referral_reward error", error);
      return json({ triggered: false, reason: "server_error" }, 500);
    }
    return json(data ?? { triggered: false });
  } catch (e) {
    console.error("referral-trigger crash", e);
    return json({ triggered: false, reason: "server_error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
